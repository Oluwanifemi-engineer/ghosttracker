package com.magneetar.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

/**
 * Handles incoming push notifications for anomaly alerts.
 *
 * Anomaly types:
 * - late_departure: Device left a known zone much later than usual
 * - extended_absence: Device hasn't been in any known zone during daytime
 * - new_location: Device at a new location far from all known zones
 * - unusual_route: Device deviated from its usual route
 * - geofence_enter: Device entered a monitored zone
 * - geofence_exit: Device exited a monitored zone
 * - sos_alert: Emergency SOS activated
 * - theft_detected: Theft behavior detected
 * - bounty_nearby: A recovery bounty is active nearby
 */
class AnomalyNotificationService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "AnomalyNotifService"
        private const val CHANNEL_ANOMALY = "anomaly_alerts"
        private const val CHANNEL_SOS = "sos_alerts"
        private const val CHANNEL_BOUNTY = "bounty_alerts"
        private const val CHANNEL_GEOFENCE = "geofence_alerts"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token refreshed: ${token.take(20)}...")
        // Register new token with server
        registerTokenWithServer(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        val type = data["type"] ?: "unknown"

        Log.d(TAG, "Push received: type=$type")

        when (type) {
            // Anomaly alerts
            "late_departure" -> handleAnomalyAlert(data, "Late Departure", "⚠️")
            "extended_absence" -> handleAnomalyAlert(data, "Extended Absence", "🕐")
            "new_location" -> handleAnomalyAlert(data, "New Location", "📍")
            "unusual_route" -> handleAnomalyAlert(data, "Unusual Route", "🛣️")

            // Geofence alerts
            "geofence_enter" -> handleGeofenceAlert(data, "entered")
            "geofence_exit" -> handleGeofenceAlert(data, "exited")

            // SOS / Emergency
            "sos_alert" -> handleSOSAlert(data)

            // Theft detection
            "theft_detected" -> handleTheftAlert(data)

            // Bounty alerts
            "bounty_nearby" -> handleBountyAlert(data)

            // System notifications
            "shutdown" -> handleShutdownAlert(data)

            else -> Log.d(TAG, "Unknown notification type: $type")
        }
    }

    private fun handleAnomalyAlert(data: Map<String, String>, title: String, emoji: String) {
        val deviceName = data["device_name"] ?: "Unknown Device"
        val description = data["description"] ?: "Anomaly detected"
        val severity = data["severity"] ?: "medium"
        val deviceId = data["device_id"] ?: ""

        val notificationTitle = "$emoji $title — $deviceName"
        val notificationBody = description

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "dashboard")
            putExtra("device_id", deviceId)
        }

        val priority = when (severity) {
            "high" -> NotificationCompat.PRIORITY_HIGH
            "medium" -> NotificationCompat.PRIORITY_DEFAULT
            else -> NotificationCompat.PRIORITY_LOW
        }

        showNotification(
            channelId = CHANNEL_ANOMALY,
            notificationId = System.currentTimeMillis().toInt(),
            title = notificationTitle,
            body = notificationBody,
            intent = intent,
            priority = priority,
            autoCancel = true,
        )
    }

    private fun handleGeofenceAlert(data: Map<String, String>, action: String) {
        val deviceName = data["device_name"] ?: "Unknown Device"
        val zoneName = data["zone_name"] ?: "Unknown Zone"
        val deviceId = data["device_id"] ?: ""

        val notificationTitle = "📍 Geofence Alert"
        val notificationBody = "$deviceName $action \"$zoneName\""

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "map")
            putExtra("device_id", deviceId)
        }

        showNotification(
            channelId = CHANNEL_GEOFENCE,
            notificationId = System.currentTimeMillis().toInt(),
            title = notificationTitle,
            body = notificationBody,
            intent = intent,
            priority = NotificationCompat.PRIORITY_DEFAULT,
            autoCancel = true,
        )
    }

    private fun handleSOSAlert(data: Map<String, String>) {
        val deviceName = data["device_name"] ?: "Unknown Device"
        val userName = data["user_name"] ?: "Someone"
        val location = data["location"] ?: "Unknown location"
        val deviceId = data["device_id"] ?: ""

        val notificationTitle = "🚨 EMERGENCY SOS"
        val notificationBody = "$userName needs help! Last seen: $location"

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "sos")
            putExtra("device_id", deviceId)
        }

        showNotification(
            channelId = CHANNEL_SOS,
            notificationId = System.currentTimeMillis().toInt(),
            title = notificationTitle,
            body = notificationBody,
            intent = intent,
            priority = NotificationCompat.PRIORITY_MAX,
            autoCancel = false,
            ongoing = true,
        )
    }

    private fun handleTheftAlert(data: Map<String, String>) {
        val deviceName = data["device_name"] ?: "Unknown Device"
        val description = data["description"] ?: "Theft behavior detected"
        val deviceId = data["device_id"] ?: ""

        val notificationTitle = "🔴 Theft Detected — $deviceName"
        val notificationBody = description

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "dashboard")
            putExtra("device_id", deviceId)
        }

        showNotification(
            channelId = CHANNEL_ANOMALY,
            notificationId = System.currentTimeMillis().toInt(),
            title = notificationTitle,
            body = notificationBody,
            intent = intent,
            priority = NotificationCompat.PRIORITY_MAX,
            autoCancel = false,
        )
    }

    private fun handleBountyAlert(data: Map<String, String>) {
        val amount = data["amount"] ?: "₦0"
        val deviceName = data["device_name"] ?: "Unknown Device"
        val bountyId = data["bounty_id"] ?: ""

        val notificationTitle = "💰 Bounty Nearby: $amount"
        val notificationBody = "A reward is offered for finding $deviceName"

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "bounties")
            putExtra("bounty_id", bountyId)
        }

        showNotification(
            channelId = CHANNEL_BOUNTY,
            notificationId = System.currentTimeMillis().toInt(),
            title = notificationTitle,
            body = notificationBody,
            intent = intent,
            priority = NotificationCompat.PRIORITY_HIGH,
            autoCancel = true,
        )
    }

    private fun handleShutdownAlert(data: Map<String, String>) {
        val message = data["message"] ?: "Server is shutting down"

        val notificationTitle = "⚠️ Server Update"
        val notificationBody = "$message. You may temporarily lose connection."

        showNotification(
            channelId = CHANNEL_ANOMALY,
            notificationId = System.currentTimeMillis().toInt(),
            title = notificationTitle,
            body = notificationBody,
            intent = null,
            priority = NotificationCompat.PRIORITY_LOW,
            autoCancel = true,
        )
    }

    private fun showNotification(
        channelId: String,
        notificationId: Int,
        title: String,
        body: String,
        intent: Intent?,
        priority: Int,
        autoCancel: Boolean,
        ongoing: Boolean = false,
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channels (Android 8+)
        createNotificationChannels(notificationManager)

        val pendingIntent = intent?.let {
            PendingIntent.getActivity(
                this,
                notificationId,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_m)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(priority)
            .setAutoCancel(autoCancel)
            .setOngoing(ongoing)
            .apply {
                if (pendingIntent != null) {
                    setContentIntent(pendingIntent)
                }
            }
            .build()

        notificationManager.notify(notificationId, notification)
    }

    private fun createNotificationChannels(notificationManager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channels = listOf(
                NotificationChannel(
                    CHANNEL_ANOMALY,
                    "Anomaly Alerts",
                    NotificationManager.IMPORTANCE_DEFAULT,
                ).apply {
                    description = "Alerts for unusual device behavior"
                },
                NotificationChannel(
                    CHANNEL_SOS,
                    "Emergency SOS",
                    NotificationManager.IMPORTANCE_MAX,
                ).apply {
                    description = "Emergency SOS alerts from family/coworkers"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                },
                NotificationChannel(
                    CHANNEL_BOUNTY,
                    "Bounty Alerts",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Nearby recovery bounty notifications"
                },
                NotificationChannel(
                    CHANNEL_GEOFENCE,
                    "Geofence Alerts",
                    NotificationManager.IMPORTANCE_DEFAULT,
                ).apply {
                    description = "Zone entry/exit notifications"
                },
            )

            notificationManager.createNotificationChannels(channels)
        }
    }

    private fun registerTokenWithServer(token: String) {
        // Fire-and-forget registration with the server
        Thread {
            try {
                val url = java.net.URL("${BuildConfig.SERVER_URL}/notifications/fcm-token")
                val connection = url.openConnection() as java.net.HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true

                val body = JSONObject().apply {
                    put("token", token)
                    put("platform", "android")
                }

                connection.outputStream.use { os ->
                    os.write(body.toString().toByteArray())
                }

                val responseCode = connection.responseCode
                Log.d(TAG, "Token registration response: $responseCode")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to register token: ${e.message}")
            }
        }.start()
    }
}
