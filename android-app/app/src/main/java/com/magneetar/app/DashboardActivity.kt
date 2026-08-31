package com.magneetar.app

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.compass.CompassOverlay
import org.osmdroid.views.overlay.gestures.RotationGestureOverlay
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Single-screen dashboard — matches the web dashboard layout.
 * Everything visible on one screen: device status, map, commands, activity.
 * No tabs. No hidden sections. What you see is what you get.
 */
class DashboardActivity : AppCompatActivity() {

    // Views
    private lateinit var tvOnlineStatus: TextView
    private lateinit var statusDot: View
    private lateinit var tvDeviceName: TextView
    private lateinit var tvDeviceModel: TextView
    private lateinit var tvBattery: TextView
    private lateinit var tvSignal: TextView
    private lateinit var tvThreat: TextView
    private lateinit var tvLocation: TextView
    private lateinit var tvSpeed: TextView
    private lateinit var tvCommandStatus: TextView
    private lateinit var tvEmptyActivity: TextView
    private lateinit var lockOverlay: View
    private var osmMap: MapView? = null
    private lateinit var rvActivity: RecyclerView

    // HTTP client
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    // Data
    private var devices = mutableListOf<JSONObject>()
    private var selectedDeviceId = ""
    private var alerts = mutableListOf<JSONObject>()

    // Refresh
    private val refreshHandler = Handler(Looper.getMainLooper())
    private val REFRESH_INTERVAL = 15_000L
    private val refreshRunnable = object : Runnable {
        override fun run() {
            loadDevices()
            loadActivity()
            refreshHandler.postDelayed(this, REFRESH_INTERVAL)
        }
    }

    // Lock timer (2-min Opay-style)
    private val lockHandler = Handler(Looper.getMainLooper())
    private val LOCK_TIMEOUT_MS = 2 * 60 * 1000L
    private val lockRunnable = Runnable { lockApp() }

    // Screen receiver
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF -> lockHandler.removeCallbacks(lockRunnable)
                Intent.ACTION_SCREEN_ON -> resumeLockTimer()
                Intent.ACTION_USER_PRESENT -> resumeLockTimer()
            }
        }
    }

    // Permission launcher for capture
    private val capturePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val camera = permissions[Manifest.permission.CAMERA] == true
        val mic = permissions[Manifest.permission.RECORD_AUDIO] == true
        if (camera && mic) sendCommand("capture")
        else showCommandStatus("Camera & mic permissions required", false)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_dashboard)

        // Initialize OSMDroid
        Configuration.getInstance().userAgentValue = packageName

        // Bind views
        tvOnlineStatus = findViewById(R.id.tv_online_status)
        statusDot = findViewById(R.id.status_dot)
        tvDeviceName = findViewById(R.id.tv_device_name)
        tvDeviceModel = findViewById(R.id.tv_device_model)
        tvBattery = findViewById(R.id.tv_battery)
        tvSignal = findViewById(R.id.tv_signal)
        tvThreat = findViewById(R.id.tv_threat)
        tvLocation = findViewById(R.id.tv_location)
        tvSpeed = findViewById(R.id.tv_speed)
        tvCommandStatus = findViewById(R.id.tv_command_status)
        tvEmptyActivity = findViewById(R.id.tv_empty_activity)
        lockOverlay = findViewById(R.id.lock_overlay)
        osmMap = findViewById(R.id.osm_map)
        rvActivity = findViewById(R.id.rv_activity)

        // Setup map
        osmMap?.let { setupMap(it) }

        // Setup activity list
        rvActivity.layoutManager = LinearLayoutManager(this)
        rvActivity.adapter = ActivityAdapter(alerts)

        // Command buttons
        findViewById<View>(R.id.cmd_ring)?.setOnClickListener { sendCommand("ring") }
        findViewById<View>(R.id.cmd_lock)?.setOnClickListener { sendCommand("lock") }
        findViewById<View>(R.id.cmd_locate)?.setOnClickListener { sendCommand("locate") }
        findViewById<View>(R.id.cmd_capture)?.setOnClickListener { requestCaptureAndSend() }
        findViewById<View>(R.id.cmd_wipe)?.setOnClickListener { confirmWipe() }

        // Police Report
        findViewById<View>(R.id.cmd_police_report)?.setOnClickListener { generatePoliceReport() }

        // Lock overlay
        lockOverlay.setOnClickListener { navigateToLogin() }

        // Register screen receiver
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        registerReceiver(screenReceiver, filter)

        // Start background services
        startServicesSafe()

        // Load data
        loadDevices()
        loadActivity()

        // Start refresh and lock timers
        refreshHandler.postDelayed(refreshRunnable, REFRESH_INTERVAL)
        recordInteraction()
    }

    override fun onResume() {
        super.onResume()
        osmMap?.onResume()
        resumeLockTimer()
        loadDevices()
        loadActivity()
    }

    override fun onPause() {
        super.onPause()
        osmMap?.onPause()
        getSharedPreferences("mt", MODE_PRIVATE).edit()
            .putLong("last_background_time", System.currentTimeMillis())
            .apply()
    }

    override fun onDestroy() {
        super.onDestroy()
        refreshHandler.removeCallbacks(refreshRunnable)
        lockHandler.removeCallbacks(lockRunnable)
        try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}
    }

    // ── Map ──────────────────────────────────────────────────────────────

    private fun setupMap(map: MapView) {
        map.setTileSource(TileSourceFactory.MAPNIK)
        map.setMultiTouchControls(true)
        map.controller.setZoom(16.0)
        map.controller.setCenter(GeoPoint(7.518, 4.528))

        try {
            val compass = CompassOverlay(this, map)
            compass.enableCompass()
            map.overlays.add(compass)
        } catch (_: Exception) {}

        val rotation = RotationGestureOverlay(map)
        rotation.isEnabled = true
        map.overlays.add(rotation)
        map.invalidate()
    }

    // ── Device Loading ───────────────────────────────────────────────────

    private fun loadDevices() {
        val prefs = getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(this)

        if (serverUrl.isEmpty() || userToken.isEmpty()) {
            tvDeviceName.text = "Not signed in"
            return
        }

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices")
            .addHeader("Authorization", "Bearer $userToken")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: return
                runOnUiThread {
                    try {
                        val json = JSONObject(body)
                        val arr = json.optJSONArray("devices") ?: return@runOnUiThread

                        devices.clear()
                        for (i in 0 until arr.length()) {
                            devices.add(arr.getJSONObject(i))
                        }

                        if (devices.isEmpty()) {
                            tvDeviceName.text = "No device linked"
                            tvDeviceModel.text = "Sign in on another device"
                            tvBattery.text = "—"
                            tvSignal.text = "—"
                            tvThreat.text = "0"
                            tvLocation.text = "—"
                            tvSpeed.text = ""
                            tvOnlineStatus.text = ""
                            return@runOnUiThread
                        }

                        // Show first device
                        val device = devices[0]
                        selectedDeviceId = device.optString("device_id", "")

                        val name = device.optString("name", device.optString("model", "Device"))
                        val model = device.optString("model", "")
                        val isOnline = device.optBoolean("is_online", false)
                        val battery = device.optInt("battery_percent", -1)
                        val threat = device.optInt("sentinel_score", 0)
                        val lat = device.optDouble("latitude", 0.0)
                        val lng = device.optDouble("longitude", 0.0)
                        val speed = device.optDouble("speed", 0.0)

                        tvDeviceName.text = name
                        tvDeviceModel.text = model

                        // Online status
                        if (isOnline) {
                            tvOnlineStatus.text = "● LIVE"
                            tvOnlineStatus.setTextColor(ContextCompat.getColor(this@DashboardActivity, R.color.status_online))
                            statusDot.background = ContextCompat.getDrawable(this@DashboardActivity, R.drawable.dot_green)
                        } else {
                            tvOnlineStatus.text = "OFFLINE"
                            tvOnlineStatus.setTextColor(ContextCompat.getColor(this@DashboardActivity, R.color.status_offline))
                            statusDot.background = ContextCompat.getDrawable(this@DashboardActivity, R.drawable.dot_green)
                        }

                        // Stats
                        tvBattery.text = if (battery >= 0) "$battery%" else "—"
                        tvSignal.text = "—"
                        tvThreat.text = "$threat"

                        // Threat color
                        val threatColor = when {
                            threat >= 70 -> ContextCompat.getColor(this@DashboardActivity, R.color.alert_critical)
                            threat >= 40 -> ContextCompat.getColor(this@DashboardActivity, R.color.alert_warning)
                            else -> ContextCompat.getColor(this@DashboardActivity, R.color.status_online)
                        }
                        tvThreat.setTextColor(threatColor)

                        // Location
                        if (lat != 0.0 && lng != 0.0) {
                            tvLocation.text = String.format("%.4f°N %.4f°E", lat, lng)
                            tvSpeed.text = if (speed > 0) String.format("%.1f m/s", speed) else ""

                            // Store for police report
                            getSharedPreferences("mt", MODE_PRIVATE).edit()
                                .putFloat("last_lat", lat.toFloat())
                                .putFloat("last_lng", lng.toFloat())
                                .putString("last_seen", System.currentTimeMillis().toString())
                                .putString("device_model", model)
                                .putString("device_name", name)
                                .apply()

                            // Update map
                            osmMap?.overlays?.removeIf { it is Marker }
                            val marker = Marker(osmMap)
                            marker.position = GeoPoint(lat, lng)
                            marker.title = name
                            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            marker.icon = ContextCompat.getDrawable(this@DashboardActivity, R.drawable.map_marker_blue)
                            osmMap?.overlays?.add(marker)
                            osmMap?.controller?.animateTo(GeoPoint(lat, lng))
                            osmMap?.invalidate()
                        } else {
                            tvLocation.text = "No location data"
                            tvSpeed.text = ""
                        }
                    } catch (_: Exception) {}
                }
            }
        })
    }

    // ── Activity Loading ─────────────────────────────────────────────────

    private fun loadActivity() {
        val prefs = getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(this)

        if (serverUrl.isEmpty() || userToken.isEmpty()) return

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/alerts")
            .addHeader("Authorization", "Bearer $userToken")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: return
                runOnUiThread {
                    try {
                        val json = JSONObject(body)
                        val arr = json.optJSONArray("alerts") ?: return@runOnUiThread
                        alerts.clear()
                        for (i in 0 until arr.length()) {
                            alerts.add(arr.getJSONObject(i))
                        }
                        if (alerts.isEmpty()) {
                            tvEmptyActivity.visibility = View.VISIBLE
                            rvActivity.visibility = View.GONE
                        } else {
                            tvEmptyActivity.visibility = View.GONE
                            rvActivity.visibility = View.VISIBLE
                            rvActivity.adapter?.notifyDataSetChanged()
                        }
                    } catch (_: Exception) {}
                }
            }
        })
    }

    // ── Commands ─────────────────────────────────────────────────────────

    private fun sendCommand(command: String) {
        if (selectedDeviceId.isEmpty()) {
            showCommandStatus("No device selected", false)
            return
        }

        val prefs = getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(this)

        if (serverUrl.isEmpty() || userToken.isEmpty()) {
            showCommandStatus("Not signed in", false)
            return
        }

        showCommandStatus("Sending $command...", true)

        val body = JSONObject().apply { put("command", command) }.toString()
        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices/$selectedDeviceId/commands")
            .addHeader("Authorization", "Bearer $userToken")
            .addHeader("Content-Type", "application/json")
            .post(jsonStringBody(body))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread { showCommandStatus("Failed: ${e.message}", false) }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                runOnUiThread {
                    if (response.isSuccessful) {
                        showCommandStatus("✓ $command sent", true)
                    } else {
                        val errorMsg = try {
                            JSONObject(responseBody).optString("detail", "Error ${response.code}")
                        } catch (_: Exception) { "Error ${response.code}" }
                        showCommandStatus("✗ $errorMsg", false)
                    }
                }
            }
        })
    }

    private fun requestCaptureAndSend() {
        val hasCamera = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (hasCamera && hasMic) {
            sendCommand("capture")
        } else {
            capturePermissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        }
    }

    private fun confirmWipe() {
        AlertDialog.Builder(this, com.google.android.material.R.style.ThemeOverlay_Material3_MaterialAlertDialog)
            .setTitle("Factory Reset")
            .setMessage("This will erase ALL data on the device. This action cannot be undone.\n\nAre you sure?")
            .setPositiveButton("Wipe Device") { _, _ -> sendCommand("wipe") }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showCommandStatus(message: String, success: Boolean) {
        tvCommandStatus.text = message
        tvCommandStatus.setTextColor(ContextCompat.getColor(this,
            if (success) R.color.status_online else R.color.status_offline))
        tvCommandStatus.visibility = View.VISIBLE
    }

    // ── OkHttp helpers ──
    @Suppress("NOTHING_TO_INLINE")
    private inline fun jsonStringBody(json: String): RequestBody =
        json.toRequestBody("application/json".toMediaType())

    // ── Police Report ──────────────────────────────────────────────────

    private fun generatePoliceReport() {
        val data = PoliceReportGenerator.buildFromPrefs(this)
        val file = PoliceReportGenerator.generate(this, data)
        PoliceReportGenerator.share(this, file)
    }

    // ── Lock Timer ───────────────────────────────────────────────────────

    private fun recordInteraction() {
        getSharedPreferences("mt", MODE_PRIVATE).edit()
            .putLong("last_interaction", System.currentTimeMillis())
            .apply()
        resetLockTimer()
    }

    private fun resetLockTimer() {
        lockHandler.removeCallbacks(lockRunnable)
        lockHandler.postDelayed(lockRunnable, LOCK_TIMEOUT_MS)
    }

    private fun resumeLockTimer() {
        val lastBg = getSharedPreferences("mt", MODE_PRIVATE)
            .getLong("last_background_time", 0)
        val elapsed = System.currentTimeMillis() - lastBg
        if (elapsed > LOCK_TIMEOUT_MS) {
            lockApp()
        } else {
            lockHandler.removeCallbacks(lockRunnable)
            lockHandler.postDelayed(lockRunnable, LOCK_TIMEOUT_MS - elapsed)
        }
    }

    private fun lockApp() {
        lockOverlay.visibility = View.VISIBLE
        getSharedPreferences("mt", MODE_PRIVATE).edit()
            .putLong("last_interaction", 0)
            .apply()
    }

    private fun navigateToLogin() {
        TokenVault.clear(this)
        getSharedPreferences("mt", MODE_PRIVATE).edit().clear().apply()
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    // ── Services ─────────────────────────────────────────────────────────

    private fun startServicesSafe() {
        try {
            ContextCompat.startForegroundService(this, Intent(this, TrackingService::class.java))
            ContextCompat.startForegroundService(this, Intent(this, PersistenceService::class.java))
            try { WatchdogReceiver.scheduleWatchdog(this) } catch (_: Exception) {}
            try { HealthCheckWorker.schedule(this) } catch (_: Exception) {}
        } catch (e: Exception) {
            android.util.Log.e("DashboardActivity", "Services failed: ${e.message}")
        }
    }

    // ── Activity Adapter ─────────────────────────────────────────────────

    inner class ActivityAdapter(private val items: List<JSONObject>) :
        RecyclerView.Adapter<ActivityAdapter.VH>() {

        inner class VH(view: View) : RecyclerView.ViewHolder(view) {
            val tvType: TextView = view.findViewById(R.id.tv_alert_type)
            val tvMessage: TextView = view.findViewById(R.id.tv_alert_message)
            val tvTime: TextView = view.findViewById(R.id.tv_alert_time)
            val tvDevice: TextView = view.findViewById(R.id.tv_alert_device)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_alert, parent, false)
            return VH(view)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val alert = items[position]
            val type = alert.optString("type", "unknown")
            val message = alert.optString("message", "Alert received")
            val deviceName = alert.optString("device_name", "")
            val createdAt = alert.optString("created_at", "")

            val colorRes = when (type.lowercase()) {
                "theft", "theft_detected" -> R.color.alert_critical
                "sim_changed", "device_offline" -> R.color.alert_warning
                "failed_unlock" -> R.color.alert_error
                else -> R.color.status_offline
            }

            val typeLabel = when (type.lowercase()) {
                "theft", "theft_detected" -> "THEFT DETECTED"
                "sim_changed" -> "SIM CHANGED"
                "device_offline" -> "DEVICE OFFLINE"
                "failed_unlock" -> "FAILED UNLOCK"
                else -> type.replace("_", " ").uppercase()
            }

            holder.tvType.text = typeLabel
            holder.tvType.setTextColor(ContextCompat.getColor(this@DashboardActivity, colorRes))
            holder.tvMessage.text = message
            holder.tvDevice.text = deviceName
            holder.tvTime.text = try {
                val parts = createdAt.split("T")
                if (parts.size > 1) parts[1].take(5) else createdAt.take(10)
            } catch (_: Exception) { createdAt }
        }

        override fun getItemCount() = items.size
    }
}
