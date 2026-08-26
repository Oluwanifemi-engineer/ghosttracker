package com.magneetar.app

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.*

/**
 * WorkManager-based periodic health check.
 *
 * This is a third layer of redundancy (beyond the foreground services
 * and AlarmManager watchdog). WorkManager is the most battery-friendly
 * scheduling mechanism because Android/Google Play Services manages
 * it centrally.
 *
 * While WorkManager can't ensure real-time execution, it provides a
 * reliable fallback that even aggressive OEMs have difficulty blocking
 * (since WorkManager is part of Jetpack and has system-level reliability).
 *
 * OEM-specific scheduling:
 *   - Transsion HiOS/XOS: 15-minute interval (more aggressive restarts)
 *   - Xiaomi MIUI: 20-minute interval
 *   - Huawei EMUI: 20-minute interval
 *   - Samsung/Stock: 30-minute interval (standard)
 */
class HealthCheckWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "MagneetarHealthCheck"
        private const val WORK_NAME = "magneetar_health_check"

        /**
         * OEM-specific health check intervals (minutes).
         * Aggressive OEMs need shorter intervals to detect and recover from kills faster.
         */
        private const val HEALTH_CHECK_INTERVAL_AGGRESSIVE_MIN = 15L
        private const val HEALTH_CHECK_INTERVAL_STANDARD_MIN = 30L
        private const val HEALTH_CHECK_FLEX_MIN = 10L

        private fun getHealthCheckInterval(): Pair<Long, Long> {
            val manufacturer = android.os.Build.MANUFACTURER.lowercase()
            return when {
                // Most aggressive OEMs
                manufacturer.contains("tecno") || manufacturer.contains("infinix") ||
                    manufacturer.contains("itel") || manufacturer.contains("transsion") ->
                    HEALTH_CHECK_INTERVAL_AGGRESSIVE_MIN to HEALTH_CHECK_FLEX_MIN
                // Moderately aggressive
                manufacturer.contains("xiaomi") || manufacturer.contains("redmi") ||
                    manufacturer.contains("huawei") || manufacturer.contains("honor") ->
                    20L to HEALTH_CHECK_FLEX_MIN
                // Standard
                else ->
                    HEALTH_CHECK_INTERVAL_STANDARD_MIN to HEALTH_CHECK_FLEX_MIN
            }
        }

        /**
         * Schedule periodic health checks.
         * Uses OEM-specific intervals for optimal recovery on aggressive devices.
         */
        fun schedule(context: Context) {
            val (intervalMin, flexMin) = getHealthCheckInterval()

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
                .build()

            val request = PeriodicWorkRequestBuilder<HealthCheckWorker>(
                intervalMin, java.util.concurrent.TimeUnit.MINUTES,
                flexMin, java.util.concurrent.TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    2, java.util.concurrent.TimeUnit.MINUTES
                )
                .addTag(WORK_NAME)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE, // UPDATE ensures interval changes take effect
                request
            )

            Log.d(TAG, "Health check worker scheduled every $intervalMin minutes")
        }

        /**
         * Cancel the health check worker.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "Health check worker cancelled")
        }
    }

    override suspend fun doWork(): Result {
        Log.d(TAG, "Health check executing...")

        return try {
            val isTrackingRunning = isServiceRunning(TrackingService::class.java.name)
            val isPersistenceRunning = isServiceRunning(PersistenceService::class.java.name)

            if (!isTrackingRunning) {
                Log.w(TAG, "TrackingService not running! Restarting...")
                val intent = Intent(applicationContext, TrackingService::class.java)
                ContextCompat.startForegroundService(applicationContext, intent)
            }

            if (!isPersistenceRunning) {
                Log.w(TAG, "PersistenceService not running! Restarting...")
                val intent = Intent(applicationContext, PersistenceService::class.java)
                ContextCompat.startForegroundService(applicationContext, intent)
            }

            if (isTrackingRunning && isPersistenceRunning) {
                Log.d(TAG, "Both services running. Health check passed.")
            }

            // Re-schedule watchdog alarm as backup
            WatchdogReceiver.scheduleWatchdog(applicationContext)

            // Request battery optimization exemption if not already granted
            // This is a best-effort — the user may have denied it
            OEMUtils.requestBatteryOptimizationExemption(applicationContext)

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Health check failed: ${e.message}")
            Result.retry()
        }
    }

    private fun isServiceRunning(className: String): Boolean {
        return when (className) {
            TrackingService::class.java.name -> TrackingService.isRunning
            PersistenceService::class.java.name -> PersistenceService.isRunning
            else -> false
        }
    }
}
