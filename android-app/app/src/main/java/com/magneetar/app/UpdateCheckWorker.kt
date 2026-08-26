package com.magneetar.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker that checks for app updates in the background.
 *
 * This runs periodically (every 6 hours) to check if a new version is available.
 * When an update is found, it shows a notification with an "Update now" action.
 *
 * The actual download and installation is handled by AppUpdaterService when
 * the user taps the notification.
 *
 * Security:
 *   - Only runs when network is available
 *   - Only runs when battery is not low
 *   - Respects the "installed via Play Store" check (Play handles updates)
 *   - Uses the same /apk/checksum endpoint as the manual update flow
 */
class UpdateCheckWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "UpdateCheckWorker"
        private const val CHANNEL_ID = "mt_update"
        private const val NOTIF_ID = 41

        /** SharedPreferences key for last update check timestamp. */
        private const val LAST_CHECK_KEY = "last_update_check_ms"

        /** Minimum interval between checks (6 hours). */
        private const val MIN_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000L
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        Log.d(TAG, "Background update check starting...")

        // Rate-limit: don't check more than once per 6 hours
        val prefs = applicationContext.getSharedPreferences("mt", Context.MODE_PRIVATE)
        val lastCheck = prefs.getLong(LAST_CHECK_KEY, 0L)
        val now = System.currentTimeMillis()
        if (now - lastCheck < MIN_CHECK_INTERVAL_MS) {
            Log.d(TAG, "Skipping check — too soon since last check (${(now - lastCheck) / 1000}s ago)")
            return Result.success()
        }

        // Don't check if installed via Play Store
        if (AppUpdater.isInstalledViaPlayStore(applicationContext)) {
            Log.d(TAG, "Play Store install — skipping update check")
            return Result.success()
        }

        // Don't check if user hasn't granted install permission yet
        if (!AppUpdater.canRequestInstalls(applicationContext)) {
            Log.d(TAG, "Install permission not granted — skipping update check")
            return Result.success()
        }

        return try {
            val latestVersion = fetchLatestVersion()
            if (latestVersion.isEmpty()) {
                Log.d(TAG, "No version info available")
                prefs.edit().putLong(LAST_CHECK_KEY, now).apply()
                return Result.success()
            }

            val currentVersion = BuildConfig.VERSION_NAME
            if (latestVersion == currentVersion) {
                Log.d(TAG, "App is up to date ($currentVersion)")
                prefs.edit().putLong(LAST_CHECK_KEY, now).apply()
                return Result.success()
            }

            // New version available — show notification
            Log.i(TAG, "Update available: $currentVersion → $latestVersion")
            showUpdateNotification(latestVersion)
            prefs.edit().putLong(LAST_CHECK_KEY, now).apply()

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Update check failed: ${e.message}")
            Result.retry()
        }
    }

    /**
     * Fetch the latest version from /apk/version.
     * Returns empty string on failure.
     */
    private fun fetchLatestVersion(): String {
        return try {
            val url = "${BuildConfig.SERVER_URL}/apk/version?current_version=${BuildConfig.VERSION_NAME}"
            val request = Request.Builder()
                .url(url)
                .header("X-Magneetar-Client", "app-updater-worker")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (response.code !in 200..299) return@use ""
                val body = response.body?.string() ?: return@use ""
                val json = JSONObject(body)

                // Check if update is available
                val updateAvailable = json.optBoolean("update_available", false)
                if (!updateAvailable) {
                    Log.d(TAG, "No update available")
                    return@use ""
                }

                // Return the latest version
                json.optString("latest_version", "")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch latest version: ${e.message}")
            ""
        }
    }

    /**
     * Show a notification when an update is available.
     * The notification has an "Update now" action that starts AppUpdaterService.
     */
    private fun showUpdateNotification(version: String) {
        createChannel()

        // Intent to start the update service
        val updateIntent = Intent(applicationContext, AppUpdaterService::class.java)
            .putExtra(AppUpdaterService.EXTRA_UPDATE_TO, version)
        val updatePi = PendingIntent.getService(
            applicationContext,
            NOTIF_ID,
            updateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent to open the app (when user taps the notification body)
        val openIntent = Intent(applicationContext, MainActivity::class.java)
        val openPi = PendingIntent.getActivity(
            applicationContext,
            NOTIF_ID + 1,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("Magneetar update available")
            .setContentText("Version $version is ready — tap to update")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setContentIntent(openPi)
            .addAction(0, "Update now", updatePi)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        val mgr = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.notify(NOTIF_ID, notification)

        Log.d(TAG, "Update notification shown for version $version")
    }

    private fun createChannel() {
        val mgr = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "App updates", NotificationManager.IMPORTANCE_DEFAULT)
        )
    }
}
