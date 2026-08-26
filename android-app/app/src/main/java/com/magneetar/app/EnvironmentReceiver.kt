package com.magneetar.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Environment-triggered restart receiver.
 *
 * OEM battery killers (especially on Transsion/Xiaomi/Huawei) pause background
 * apps at rest and only release them on events the system can't defer: power
 * plugged in, network regained, time changed, or the user unlocking the phone.
 * Firing a service restart on those events closes the gap between "the OS
 * paused the app" and "the owner notices the device went offline".
 *
 * This is a best-effort companion to the AlarmManager watchdog, WorkManager
 * health check, and the dual foreground services — not a replacement.
 *
 * OEM-specific restart behavior:
 *   - Transsion HiOS/XOS: Very aggressive — only restarts on power events
 *   - Xiaomi MIUI: Restarts on connectivity + power events
 *   - Huawei EMUI: Restarts on power + user present events
 *   - Samsung: Generally reliable, restarts on all events
 */
class EnvironmentReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MagneetarEnv"

        /**
         * Minimum interval between restart attempts (milliseconds).
         * Prevents rapid restart loops when multiple events fire quickly.
         */
        private const val MIN_RESTART_INTERVAL_MS = 30_000L // 30 seconds

        @Volatile
        private var lastRestartMs = 0L
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val relevant = action == Intent.ACTION_POWER_CONNECTED ||
            action == Intent.ACTION_POWER_DISCONNECTED ||
            action == Intent.ACTION_BATTERY_LOW ||
            action == Intent.ACTION_TIME_CHANGED ||
            action == Intent.ACTION_TIMEZONE_CHANGED ||
            action == ConnectivityManager.CONNECTIVITY_ACTION ||
            action == Intent.ACTION_USER_PRESENT
        if (!relevant) return

        // If already running, just re-arm the watchdog
        if (TrackingService.isRunning) {
            WatchdogReceiver.scheduleWatchdog(context)
            return
        }

        // Rate-limit restarts to avoid rapid restart loops
        val now = System.currentTimeMillis()
        if (now - lastRestartMs < MIN_RESTART_INTERVAL_MS) {
            Log.d(TAG, "Skipping restart — too soon since last attempt")
            return
        }
        lastRestartMs = now

        // Only restart on connectivity events when the network is actually
        // back — battery/display events can fire before it is.
        if (action == ConnectivityManager.CONNECTIVITY_ACTION) {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val active = cm?.activeNetworkInfo
            if (active == null || !active.isConnectedOrConnecting) return
        }

        Log.i(TAG, "Restarting services after $action")
        startServicesWithRetry(context)
    }

    /**
     * Start services with OEM-specific retry logic.
     * Transsion devices need extra retries because HiOS/XOS may kill
     * services immediately after start if the system isn't ready.
     */
    private fun startServicesWithRetry(context: Context) {
        val maxRetries = if (OEMUtils.isTranssionDevice()) 3 else 2
        var attempt = 0

        fun tryStart() {
            attempt++
            try {
                ContextCompat.startForegroundService(context, Intent(context, TrackingService::class.java))
                ContextCompat.startForegroundService(context, Intent(context, PersistenceService::class.java))
                WatchdogReceiver.scheduleWatchdog(context)
                HealthCheckWorker.schedule(context)
                Log.i(TAG, "Services started successfully (attempt $attempt/$maxRetries)")
            } catch (e: Exception) {
                Log.e(TAG, "Restart attempt $attempt failed: ${e.message}")
                if (attempt < maxRetries) {
                    // Retry after a delay — Transsion needs more time
                    val delay = if (OEMUtils.isTranssionDevice()) 10_000L else 5_000L
                    @Suppress("DEPRECATION")
                    android.os.Handler().postDelayed({ tryStart() }, delay)
                }
            }
        }

        tryStart()
    }
}
