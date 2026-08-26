package com.magneetar.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Watchdog receiver that fires periodically via AlarmManager to ensure
 * the TrackingService is still alive. If not, it restarts it.
 *
 * This is a critical survival mechanism for Chinese OEMs that aggressively
 * kill background services. The AlarmManager alarm is one of the few
 * things that survives OEM task killers.
 *
 * OEM-specific watchdog behavior:
 *   - Huawei PowerGenie: 5-minute interval (minimum effective)
 *   - Xiaomi MIUI: 3-minute interval (more aggressive kills)
 *   - Transsion HiOS/XOS: 3-minute interval (very aggressive)
 *   - Samsung/Stock: 5-minute interval (standard)
 */
class WatchdogReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MagneetarWatchdog"
        private const val REQUEST_CODE = 300

        /**
         * OEM-specific watchdog intervals (milliseconds).
         * Aggressive OEMs need shorter intervals because they kill services faster.
         */
        private const val WATCHDOG_INTERVAL_AGGRESSIVE_MS = 3 * 60 * 1000L // 3 minutes
        private const val WATCHDOG_INTERVAL_STANDARD_MS = 5 * 60 * 1000L // 5 minutes

        private fun getWatchdogInterval(): Long {
            val manufacturer = Build.MANUFACTURER.lowercase()
            return when {
                // Most aggressive OEMs — check more frequently
                manufacturer.contains("xiaomi") || manufacturer.contains("redmi") ||
                    manufacturer.contains("huawei") || manufacturer.contains("honor") ||
                    manufacturer.contains("tecno") || manufacturer.contains("infinix") ||
                    manufacturer.contains("itel") || manufacturer.contains("transsion") ->
                    WATCHDOG_INTERVAL_AGGRESSIVE_MS
                // Standard interval for everyone else
                else -> WATCHDOG_INTERVAL_STANDARD_MS
            }
        }

        /**
         * Schedule the watchdog alarm. Call this after the TrackingService starts.
         * Uses setInexactRepeating for efficiency while maintaining regular checks.
         */
        fun scheduleWatchdog(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, WatchdogReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context, REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val intervalMs = getWatchdogInterval()

            // Use inexact repeating to minimize battery impact
            alarmManager.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + intervalMs,
                intervalMs,
                pendingIntent
            )

            Log.d(TAG, "Watchdog scheduled every ${intervalMs / 60000} minutes")
        }

        /**
         * Cancel the watchdog alarm. Call this when the service shuts down gracefully.
         */
        fun cancelWatchdog(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, WatchdogReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context, REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)
            Log.d(TAG, "Watchdog cancelled")
        }

        /**
         * Fire an immediate restart (for use from onDestroy of TrackingService).
         *
         * Exact-alarm compatibility: `setExactAndAllowWhileIdle` requires the
         * SCHEDULE_EXACT_ALARM permission on Android 12+ (API 31+) and throws
         * SecurityException without it. We deliberately do NOT declare the
         * Play-restricted USE_EXACT_ALARM permission, and SCHEDULE_EXACT_ALARM
         * is only declared so the capability exists where the user grants it
         * in system settings. When exact alarms are not available we fall back
         * to an inexact `set()` in the same time window — the watchdog's job
         * is to nudge a dead service back to life, and a minute of slop does
         * not change the outcome (services are also restarted by the dual-FGS
         * loop, WorkManager, and OEM event receivers).
         */
        fun fireImmediateRestart(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, WatchdogReceiver::class.java).apply {
                putExtra("immediate", true)
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, REQUEST_CODE + 1, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Fire in 3 seconds to avoid rapid restart loops. Prefer an exact
            // alarm only where the system lets us; otherwise degrade to an
            // inexact alarm scheduled for the same moment.
            if (canScheduleExactAlarms(context)) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + 3000,
                    pendingIntent
                )
            } else {
                alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + 3000,
                    pendingIntent
                )
            }
            Log.d(TAG, "Immediate restart scheduled in 3 seconds (exact=${canScheduleExactAlarms(context)})")
        }

        /**
         * True when the app may use exact alarms on this device/OS. On
         * Android 12+ this reflects the user's SCHEDULE_EXACT_ALARM grant
         * (system settings → alarms & reminders); below that exact alarms are
         * always allowed. Checking this before every exact-alarm call avoids
         * the SecurityException that would otherwise be thrown.
         */
        private fun canScheduleExactAlarms(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                try {
                    alarmManager.canScheduleExactAlarms()
                } catch (e: Exception) {
                    false
                }
            } else {
                true
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val immediate = intent.getBooleanExtra("immediate", false)
        Log.d(TAG, "Watchdog fired (immediate=$immediate)")

        // Check if TrackingService is running
        if (!isServiceRunning(context)) {
            Log.w(TAG, "TrackingService is NOT running! Restarting...")
            restartService(context)
        } else {
            Log.d(TAG, "TrackingService is running. All good.")
            // Re-arm the watchdog even when alive — the inexact alarm
            // may have drifted or been cleared by an OEM kill.
            scheduleWatchdog(context)
        }
    }

    private fun isServiceRunning(context: Context): Boolean {
        return TrackingService.isRunning
    }

    private fun restartService(context: Context) {
        var attempt = 0
        val maxRetries = if (OEMUtils.isChineseOEM()) 3 else 2

        fun tryRestart() {
            attempt++
            try {
                val serviceIntent = Intent(context, TrackingService::class.java)
                ContextCompat.startForegroundService(context, serviceIntent)

                // Also start the persistence service for dual-service redundancy
                val persistenceIntent = Intent(context, PersistenceService::class.java)
                ContextCompat.startForegroundService(context, persistenceIntent)

                Log.i(TAG, "Services restarted successfully (attempt $attempt/$maxRetries)")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to restart services (attempt $attempt/$maxRetries): ${e.message}")
                if (attempt < maxRetries) {
                    val delay = if (OEMUtils.isChineseOEM()) 5_000L else 3_000L
                    @Suppress("DEPRECATION")
                    android.os.Handler().postDelayed({ tryRestart() }, delay)
                }
            }
        }

        tryRestart()
    }
}
