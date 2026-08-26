package com.magneetar.app

import android.annotation.SuppressLint
import android.app.*
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.*

/**
 * Dual-service redundancy layer.
 *
 * This is a second foreground service that runs alongside TrackingService.
 * Its sole purpose is to:
 * 1. Monitor TrackingService health via periodic checks
 * 2. Restart TrackingService if it dies
 * 3. Hold a WakeLock to prevent deep sleep from killing everything
 * 4. Maintain a low-profile notification
 *
 * Chinese OEMs often kill individual services but rarely kill TWO services
 * simultaneously, especially when they run different foreground service types.
 *
 * TrackingService uses foregroundServiceType="location"
 * PersistenceService uses foregroundServiceType="dataSync"
 *
 * Android 15+ (targetSdk 36): dataSync foreground services have a 6-hour
 * time limit per 24-hour period. When onTimeout() fires, we gracefully
 * stop this service and let the AlarmManager watchdog + WorkManager health
 * check + EnvironmentReceiver restart it after a cooldown, effectively
 * creating a duty-cycling pattern that stays alive indefinitely while
 * respecting the OS limit.
 */
class PersistenceService : Service() {

    companion object {
        private const val TAG = "MagneetarPersistence"
        private const val CHANNEL_ID = "mt_persistence"
        private const val NOTIF_ID = 2
        private const val CHECK_INTERVAL_MS = 60_000L // Check every minute

        /**
         * Android 15+ dataSync timeout: 6 hours. We stop 5 minutes early
         * to avoid the fatal RemoteServiceException and let the restart
         * mechanisms (WatchdogReceiver + WorkManager) bring us back after
         * a brief cooldown.
         */
        private const val TIMEOUT_BUFFER_MS = 5 * 60 * 1000L // 5 min early stop
        private const val FGS_TIMEOUT_MS = 6L * 60 * 60 * 1000L - TIMEOUT_BUFFER_MS

        /** Cooldown before restarting after an onTimeout stop. */
        private const val POST_TIMEOUT_RESTART_DELAY_MS = 30_000L // 30 seconds

        /** Runtime flag — true when service is running. */
        @Volatile
        var isRunning: Boolean = false
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var wakeLock: PowerManager.WakeLock? = null
    private var timeoutJob: Job? = null

    private fun isActive(): Boolean = scope.isActive

    // Lint false positive (AGP 8.10.1, play flavor only): the merged manifest
    // declares android:foregroundServiceType="dataSync" on PersistenceService,
    // but the play overlay's tools:node="remove" trips the ForegroundServiceType
    // check. Sideload variants lint clean with identical code + manifest.
    @SuppressLint("ForegroundServiceType")
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Persistence service starting...")
        isRunning = true

        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification("Watchdog active"))

        // Acquire WakeLock — use Huawei-whitelisted tag on Huawei/Honor devices
        acquireWakeLock()

        // Start monitoring loop
        scope.launch {
            monitoringLoop()
        }

        // Android 15+: schedule a self-stop before the 6-hour FGS timeout.
        // After the stop, WorkManager/AlarmManager restart us in a new window.
        scheduleTimeoutStop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // If restarted after a timeout stop, re-schedule the next window.
        if (intent?.getBooleanExtra("post_timeout_restart", false) == true) {
            Log.i(TAG, "Restarted after timeout cooldown — scheduling new FGS window")
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Android 15+ (API 35+): handle the dataSync FGS timeout callback.
     * The system calls this when the 6-hour limit is reached. We must
     * call stopSelf() within a few seconds or the OS throws a fatal
     * RemoteServiceException.
     *
     * On pre-35 devices this method is never called.
     */
    override fun onTimeout(startId: Int) {
        Log.w(TAG, "Android 15+ FGS timeout reached — gracefully stopping")
        // Cancel the self-stop job (we're already being stopped)
        timeoutJob?.cancel()
        // The monitoring loop will detect we're gone and WatchdogReceiver
        // will restart us after a cooldown.
        stopSelf()
    }

    /**
     * Schedule a self-stop at 5 hours 55 minutes to avoid the fatal
     * RemoteServiceException on Android 15+. On pre-35 devices this is
     * a no-op (no FGS timeout exists).
     */
    private fun scheduleTimeoutStop() {
        if (Build.VERSION.SDK_INT < 35) return // No timeout on pre-Android 15
        timeoutJob?.cancel()
        timeoutJob = scope.launch {
            Log.d(TAG, "Scheduling FGS timeout self-stop in ${FGS_TIMEOUT_MS / 1000}s")
            delay(FGS_TIMEOUT_MS)
            Log.w(TAG, "FGS timeout approaching — stopping service for restart cycle")
            stopSelf()
            // Schedule restart after cooldown so the watchdog picks us up
            delay(POST_TIMEOUT_RESTART_DELAY_MS)
            try {
                val intent = Intent(this@PersistenceService, PersistenceService::class.java)
                    .putExtra("post_timeout_restart", true)
                ContextCompat.startForegroundService(this@PersistenceService, intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to restart after timeout: ${e.message}")
            }
        }
    }

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager

            // On Huawei/Honor, use a whitelisted system tag to avoid PowerGenie killing us
            // PowerGenie (Huawei's task killer) aggressively terminates wakelocks
            // with non-whitelisted tags held for more than 60 minutes.
            val isHuawei = Build.MANUFACTURER.lowercase().contains("huawei") ||
                    Build.MANUFACTURER.lowercase().contains("honor")

            val tag = if (isHuawei) {
                "LocationManagerService" // Huawei-whitelisted system tag
            } else {
                "Magneetar:PersistenceWakeLock"
            }

            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                tag
            ).apply {
                // Set timeout to avoid holding indefinitely if something goes wrong
                acquire(30 * 60 * 1000L) // 30 minutes max
            }
            Log.d(TAG, "WakeLock acquired (tag=$tag)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to acquire WakeLock: ${e.message}")
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                }
            }
        } catch (e: Exception) {
            // Ignore
        }
    }

    private suspend fun monitoringLoop() {
        while (isActive()) {
            try {
                if (!isTrackingServiceRunning()) {
                    Log.w(TAG, "TrackingService is dead! Restarting...")
                    restartTrackingService()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Monitoring error: ${e.message}")
            }
            delay(CHECK_INTERVAL_MS)
        }
    }

    private fun isTrackingServiceRunning(): Boolean {
        return TrackingService.isRunning
    }

    private fun restartTrackingService() {
        try {
            val intent = Intent(this, TrackingService::class.java)
            intent.putExtra("restarted_by", "persistence_service")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            Log.i(TAG, "TrackingService restart triggered")

            // Also re-schedule the AlarmManager watchdog as a backup
            WatchdogReceiver.scheduleWatchdog(this)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restart TrackingService: ${e.message}")
        }
    }

    // ── Notification ────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Magneetar Protection",
                NotificationManager.IMPORTANCE_MIN  // Lowest importance — no sound, no popup
            ).apply {
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
                setDescription("Background protection watchdog")
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛡 Magneetar")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        isRunning = false
        super.onDestroy()
        scope.cancel()
        releaseWakeLock()
        Log.d(TAG, "Persistence service destroyed")

        // If this service is killed, fire the watchdog immediately
        WatchdogReceiver.fireImmediateRestart(this)
    }
}
