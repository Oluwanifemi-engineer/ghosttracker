package com.magneetar.app

import android.content.Context
import android.util.Log
import android.os.Build
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Silent emergency beacon triggered when the duress PIN is entered.
 *
 * Sends a high-priority alert to the server with:
 * - Current GPS coordinates
 * - Device info (IMEI, model, battery)
 * - Timestamp
 * - "duress" flag that tells the dashboard this is a forced situation
 *
 * The beacon is sent even if the user appears to be using the app normally.
 * The fake dashboard shows normal family tracking — the attacker sees nothing.
 */
object DuressBeacon {

    private const val TAG = "DuressBeacon"

    fun sendBeacon(context: Context) {
        Thread {
            try {
                val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
                val securityPrefs = context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
                val serverUrl = prefs.getString("server_url", "") ?: ""
                val userToken = TokenVault.accessToken(context)
                val deviceId = prefs.getString("device_id", "") ?: ""

                if (serverUrl.isEmpty() || userToken.isEmpty()) {
                    Log.w(TAG, "Cannot send beacon — no server or token")
                    return@Thread
                }

                // Get current location
                val lat = prefs.getFloat("last_lat", 0f).toDouble()
                val lng = prefs.getFloat("last_lng", 0f).toDouble()

                // Get device info
                val model = prefs.getString("device_model", Build.MODEL) ?: Build.MODEL
                val battery = prefs.getInt("battery_percent", -1)

                val body = JSONObject().apply {
                    put("type", "duress_beacon")
                    put("priority", "critical")
                    put("device_id", deviceId)
                    put("latitude", lat)
                    put("longitude", lng)
                    put("model", model)
                    put("battery_percent", battery)
                    put("timestamp", System.currentTimeMillis())
                    put("message", "DURESS: User forced to enter duress PIN. Silent beacon triggered.")
                }

                val client = OkHttpClient.Builder()
                    .connectTimeout(5, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build()

                val request = Request.Builder()
                    .url("$serverUrl/api/dashboard/alerts")
                    .addHeader("Authorization", "Bearer $userToken")
                    .addHeader("Content-Type", "application/json")
                    .post(body.toString().toRequestBody("application/json".toMediaType()))
                    .build()

                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    Log.i(TAG, "Duress beacon sent successfully")
                    // Record that beacon was sent
                    securityPrefs.edit()
                        .putLong("duress_beacon_sent_at", System.currentTimeMillis())
                        .apply()
                } else {
                    Log.w(TAG, "Beacon failed: HTTP ${response.code}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Beacon failed: ${e.message}")
            }
        }.start()
    }
}
