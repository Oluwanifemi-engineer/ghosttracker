package com.magneetar.app

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Find Network (COMPETITOR_AUDIT P1 #6, Phase 1) — the stolen phone's SOS
 * beacon broadcaster.
 *
 * While this device has an ACTIVE recovery request, it broadcasts the
 * request's opaque beacon_token over BLE so nearby guardian phones can pick
 * it up and report sightings. The beacon advertises a service UUID derived
 * from the token (see SosBeacon.kt) — the request id itself never goes on
 * the air, and the token is meaningless without the server-side mapping.
 *
 * Lifecycle: polls `GET /api/device/recovery/beacon` (device auth via
 * x-device-key) every few minutes. When a token exists, advertising starts;
 * when the token disappears (request closed / recovered), advertising stops.
 * Runs as a dataSync foreground service with an ongoing low-profile
 * notification, mirroring PersistenceService.
 *
 * Honest availability: if BLE advertising is unavailable (no adapter,
 * permission denied, advertiser limit), the service simply doesn't advertise
 * — the phone still reports normally, and the Find Network degrades to
 * guardian scans of OTHER phones' beacons. It never fakes a broadcast.
 */
class SosBeaconBroadcaster : Service() {

    companion object {
        private const val TAG = "MagneetarSosBeacon"
        private const val CHANNEL_ID = "mt_sos_beacon"
        private const val NOTIF_ID = 4848
        private const val POLL_INTERVAL_MS = 5L * 60 * 1000 // every 5 min
        private const val ADVERTISE_TX_POWER = AdvertiseSettings.ADVERTISE_TX_POWER_HIGH

        /** Start (or re-arm) the broadcaster. Safe to call repeatedly. */
        fun start(context: Context) {
            try {
                androidx.core.content.ContextCompat.startForegroundService(
                    context,
                    Intent(context, SosBeaconBroadcaster::class.java),
                )
            } catch (e: Exception) {
                Log.w(TAG, "startForegroundService failed: ${e.message}")
            }
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private var advertiseJob: Job? = null
    private var advertisingToken: String? = null

    @SuppressLint("ForegroundServiceType")
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification("SOS beacon: idle"))
        scope.launch { run() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        stopAdvertising()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private suspend fun run() {
        while (scope.isActive) {
            try {
                val token = fetchBeaconToken()
                if (token != null) {
                    updateNotification("SOS beacon: active")
                    startAdvertising(token)
                } else {
                    updateNotification("SOS beacon: idle")
                    stopAdvertising()
                }
            } catch (e: Exception) {
                Log.w(TAG, "beacon poll failed: ${e.message}")
            }
            delay(POLL_INTERVAL_MS)
        }
    }

    /** GET /api/device/recovery/beacon with the device's unique key. */
    private fun fetchBeaconToken(): String? {
        val prefs = getSharedPreferences("mt", Context.MODE_PRIVATE)
        val deviceKey = prefs.getString("device_key", "") ?: ""
        if (deviceKey.isEmpty()) return null

        val request = Request.Builder()
            .url("${BuildConfig.SERVER_URL}/api/device/recovery/beacon")
            .get()
            .addHeader("x-device-key", deviceKey)
            .build()

        return try {
            client.newCall(request).execute().use { resp ->
                if (resp.code != 200) return null
                val body = resp.body?.string() ?: return null
                val token = JSONObject(body).optString("beacon_token", "").takeIf { it.isNotEmpty() }
                if (token != null && SosBeacon.isValidToken(token)) token else null
            }
        } catch (e: Exception) {
            Log.w(TAG, "beacon fetch failed: ${e.message}")
            null
        }
    }

    private fun startAdvertising(token: String) {
        // Same token already on the air — nothing to do (also avoids the
        // "advertisement already started" BluetoothIllegalStateException).
        if (advertisingToken == token && advertiseJob != null) return

        if (!hasAdvertisePermission()) {
            Log.w(TAG, "no BLUETOOTH_ADVERTISE permission — beacon unavailable")
            advertisingToken = null
            return
        }

        val adapter = bluetoothAdapter() ?: run {
            Log.w(TAG, "no Bluetooth adapter — beacon unavailable")
            advertisingToken = null
            return
        }
        val advertiser = adapter.bluetoothLeAdvertiser ?: run {
            Log.w(TAG, "no BLE advertiser — beacon unavailable")
            advertisingToken = null
            return
        }
        val uuid = SosBeacon.serviceUuidFor(token) ?: return

        stopAdvertising()
        advertisingToken = token

        val data = AdvertiseData.Builder()
            .addServiceUuid(android.os.ParcelUuid(uuid))
            .setIncludeDeviceName(false)
            .build()
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(ADVERTISE_TX_POWER)
            .setConnectable(false)
            .build()

        advertiseJob = scope.launch {
            try {
                advertiser.startAdvertising(settings, data, advertiseCallback)
            } catch (e: Exception) {
                Log.w(TAG, "advertise start failed: ${e.message}")
                advertisingToken = null
            }
        }
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
            Log.d(TAG, "SOS beacon advertising")
        }

        override fun onStartFailure(errorCode: Int) {
            Log.w(TAG, "SOS beacon advertise failed: code $errorCode")
            advertisingToken = null
        }
    }

    // Only stops advertising this service started; BLUETOOTH_ADVERTISE was
    // held when startAdvertising ran (lint can't see the runtime guard).
    @SuppressLint("MissingPermission")
    private fun stopAdvertising() {
        if (advertiseJob == null && advertisingToken == null) return
        advertiseJob?.cancel()
        advertiseJob = null
        try {
            bluetoothAdapter()?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
        } catch (e: Exception) {
            Log.w(TAG, "advertise stop failed: ${e.message}")
        }
        advertisingToken = null
    }

    private fun bluetoothAdapter(): BluetoothAdapter? = try {
        val manager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        manager.adapter
    } catch (e: Exception) {
        null
    }

    private fun hasAdvertisePermission(): Boolean {
        // BLUETOOTH_ADVERTISE is a runtime permission on API 31+; on older
        // devices advertising rides on the classic BLUETOOTH permission
        // (install-time, always granted).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return checkSelfPermission(android.Manifest.permission.BLUETOOTH_ADVERTISE) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "SOS Beacon", NotificationManager.IMPORTANCE_LOW)
            )
        }
    }

    private fun buildNotification(text: String) =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_m)
            .setContentTitle("Magneetar Find Network")
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

    private fun updateNotification(text: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(text))
    }
}
