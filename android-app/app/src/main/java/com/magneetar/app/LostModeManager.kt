package com.magneetar.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat

/**
 * Lost Mode (v1.5) — the remote 'lost_mode' command locks the device to a
 * full-screen recovery message with a one-tap call button.
 *
 * Background-activity rules (Android 10+) mean a service cannot always launch
 * the activity directly — and the app is foreground only when the owner is
 * using it, precisely when the phone is NOT lost. The reliable path is an
 * ongoing HIGH-priority notification whose tap (a user action, always
 * exempt) opens [LostModeActivity] (showWhenLocked in the manifest). The
 * activity is ALSO started directly when the app happens to be foreground.
 * State persists in prefs so a service restart / boot re-posts the
 * notification — honest availability, the same philosophy as the Armed Watch
 * capture contract: never claim the lock screen is showing if it isn't.
 */
object LostModeManager {
    private const val PREFS = "mt_lost_mode"
    private const val KEY_ACTIVE = "active"
    private const val KEY_MESSAGE = "message"
    private const val KEY_PHONE = "phone"
    private const val NOTIF_ID = 4242
    private const val CHANNEL_ID = "mt_lost_mode"

    fun isActive(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ACTIVE, false)

    /** Enter lost mode: persist state, post the notification, try to show the activity. */
    fun enter(context: Context, params: String?): LostModeParams.Parsed {
        val parsed = LostModeParams.parse(params)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean(KEY_ACTIVE, true)
            .putString(KEY_MESSAGE, parsed.message)
            .putString(KEY_PHONE, parsed.phone)
            .apply()
        postNotification(context, parsed.message, parsed.phone)
        launchActivity(context, parsed.message, parsed.phone)
        return parsed
    }

    /** Owner confirmed — clear state and dismiss the notification. */
    fun exit(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIF_ID)
    }

    /** Re-post the notification after a service restart / boot (state persisted). */
    fun reapply(context: Context) {
        if (!isActive(context)) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        postNotification(
            context,
            prefs.getString(KEY_MESSAGE, LostModeParams.DEFAULT_MESSAGE) ?: LostModeParams.DEFAULT_MESSAGE,
            prefs.getString(KEY_PHONE, null),
        )
    }

    private fun postNotification(context: Context, message: String, phone: String?) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Lost Mode", NotificationManager.IMPORTANCE_HIGH)
        )
        val openIntent = PendingIntent.getActivity(
            context,
            0,
            Intent(context, LostModeActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(LostModeActivity.EXTRA_MESSAGE, message)
                putExtra(LostModeActivity.EXTRA_PHONE, phone)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            // Monochrome white-M drawable — launcher mipmaps render as a
            // solid square blob in the status bar on many devices.
            .setSmallIcon(R.drawable.ic_stat_m)
            .setContentTitle("This device is in Lost Mode")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(openIntent)
        if (phone != null) {
            val callIntent = PendingIntent.getActivity(
                context,
                1,
                Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            builder.addAction(0, "Call owner", callIntent)
        }
        nm.notify(NOTIF_ID, builder.build())
    }

    private fun launchActivity(context: Context, message: String, phone: String?) {
        try {
            val intent = Intent(context, LostModeActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(LostModeActivity.EXTRA_MESSAGE, message)
                putExtra(LostModeActivity.EXTRA_PHONE, phone)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            // Background activity-start blocked (Android 10+) — the
            // notification is the reliable path. Never fail the command ack
            // over this; the state is already persisted.
        }
    }
}
