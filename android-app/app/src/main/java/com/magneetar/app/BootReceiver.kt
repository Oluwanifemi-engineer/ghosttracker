package com.magneetar.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Enhanced boot receiver — restarts all services after device reboot.
 *
 * On Chinese OEMs, additional steps are needed to survive aggressive
 * power management after boot (e.g., delaying start slightly to let
 * the system initialize fully).
 *
 * OEM-specific boot behavior:
 *   - Huawei PowerGenie: may kill services started too early after boot
 *   - Xiaomi MIUI: has a startup manager that blocks auto-start
 *   - Transsion HiOS/XOS: aggressive battery optimization on boot
 *   - Samsung: generally reliable but Adaptive Battery may delay
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MagneetarBoot"

        /**
         * OEM-specific boot delays (milliseconds).
         * Chinese OEMs need more time for their system services to initialize
         * before they'll allow background services to run.
         */
        private const val BOOT_DELAY_DEFAULT_MS = 5_000L
        private const val BOOT_DELAY_HUAWEI_MS = 15_000L // PowerGenie needs extra time
        private const val BOOT_DELAY_XIAOMI_MS = 12_000L // MIUI startup manager
        private const val BOOT_DELAY_TRANSSION_MS = 10_000L // HiOS/XOS
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON" ||
            intent.action == "android.intent.action.LOCKED_BOOT_COMPLETED"
        ) {
            Log.i(TAG, "Boot detected (${intent.action}). Starting services...")

            // Record boot time for OEM auto-start detection
            context.getSharedPreferences("mt", Context.MODE_PRIVATE).edit()
                .putLong("last_boot_restart", System.currentTimeMillis())
                .apply()

            // OEM-specific delays to let system services initialize
            val delayMs = getBootDelay()
            if (delayMs > 0) {
                Log.d(TAG, "OEM detected — delaying service start by ${delayMs}ms")
                @Suppress("DEPRECATION")
                android.os.Handler().postDelayed({
                    startServices(context)
                }, delayMs)
            } else {
                startServices(context)
            }
        }
    }

    /**
     * Get the appropriate boot delay for this device's OEM.
     */
    private fun getBootDelay(): Long {
        val manufacturer = Build.MANUFACTURER.lowercase()
        return when {
            manufacturer.contains("huawei") || manufacturer.contains("honor") ->
                BOOT_DELAY_HUAWEI_MS
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") ||
                manufacturer.contains("poco") ->
                BOOT_DELAY_XIAOMI_MS
            manufacturer.contains("tecno") || manufacturer.contains("infinix") ||
                manufacturer.contains("itel") || manufacturer.contains("transsion") ->
                BOOT_DELAY_TRANSSION_MS
            OEMUtils.isChineseOEM() ->
                BOOT_DELAY_DEFAULT_MS
            else ->
                0L // Stock Android / Samsung — no delay needed
        }
    }

    private fun startServices(context: Context) {
        var retryCount = 0
        val maxRetries = 3

        while (retryCount < maxRetries) {
            try {
                // Start the main tracking service
                val trackingIntent = Intent(context, TrackingService::class.java)
                ContextCompat.startForegroundService(context, trackingIntent)

                // Start the dual-service persistence layer
                val persistenceIntent = Intent(context, PersistenceService::class.java)
                ContextCompat.startForegroundService(context, persistenceIntent)

                // Schedule the AlarmManager watchdog as an immediate backup
                WatchdogReceiver.scheduleWatchdog(context)

                // Schedule WorkManager health check as a third layer
                HealthCheckWorker.schedule(context)

                // Re-arm remote capture if it was armed before the reboot.
                // A camera|microphone FGS cannot be started from BOOT_COMPLETED on
                // Android 15+, so post the tap-to-re-arm notification — the tap is
                // a user action that grants the background-start exemption.
                if (MediaCaptureService.wasArmedBeforeRestart(context)) {
                    MediaCaptureService.postRearmNotification(context)
                }

                // Same for the audio evidence watch: a microphone FGS from
                // BOOT_COMPLETED is banned on API 34+, so post its own re-arm
                // prompt instead of trying a forbidden background start.
                if (ArmedAudioService.wasArmedBeforeRestart(context)) {
                    ArmedAudioService.postRearmNotification(context)
                }

                Log.i(TAG, "Services started successfully (attempt ${retryCount + 1})")
                return // Success — no more retries needed
            } catch (e: Exception) {
                retryCount++
                Log.e(TAG, "Failed to start services (attempt $retryCount/$maxRetries): ${e.message}")

                if (retryCount < maxRetries) {
                    // Exponential backoff: 5s, 15s, 45s
                    val retryDelay = 5_000L * (3L.pow(retryCount))
                    @Suppress("DEPRECATION")
                    android.os.Handler().postDelayed({
                        // Retry will happen in the while loop
                    }, retryDelay)
                    Thread.sleep(retryDelay) // Block until retry
                }
            }
        }
        Log.e(TAG, "Failed to start services after $maxRetries attempts")
    }

    /** Simple power function for retry backoff. */
    private fun Long.pow(n: Int): Long {
        var result = 1L
        repeat(n) { result *= this }
        return result
    }
}
