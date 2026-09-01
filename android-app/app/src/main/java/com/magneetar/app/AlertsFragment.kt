package com.magneetar.app

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import okhttp3.*
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class AlertsFragment : Fragment() {

    private lateinit var layoutAlertList: LinearLayout
    private lateinit var tvEmpty: TextView
    private lateinit var tvCriticalCount: TextView

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val refreshHandler = Handler(Looper.getMainLooper())
    private val refreshRunnable = object : Runnable {
        override fun run() { loadAlerts(); refreshHandler.postDelayed(this, 15_000L) }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        return inflater.inflate(R.layout.fragment_alerts, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        layoutAlertList = view.findViewById(R.id.layout_alert_list)
        tvEmpty = view.findViewById(R.id.tv_empty)
        tvCriticalCount = view.findViewById(R.id.tv_critical_count)
        loadAlerts()
        refreshHandler.postDelayed(refreshRunnable, 15_000L)
    }

    override fun onResume() { super.onResume(); loadAlerts() }
    override fun onDestroyView() { super.onDestroyView(); refreshHandler.removeCallbacks(refreshRunnable) }

    private fun loadAlerts() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())
        if (serverUrl.isEmpty() || userToken.isEmpty()) return

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/alerts")
            .addHeader("Authorization", "Bearer $userToken")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: return
                activity?.runOnUiThread {
                    try {
                        val json = JSONObject(body)
                        val arr = json.optJSONArray("alerts") ?: return@runOnUiThread

                        layoutAlertList.removeAllViews()

                        if (arr.length() == 0) {
                            tvEmpty.visibility = View.VISIBLE
                            layoutAlertList.visibility = View.GONE
                            return@runOnUiThread
                        }

                        tvEmpty.visibility = View.GONE
                        layoutAlertList.visibility = View.VISIBLE

                        var criticalCount = 0
                        for (i in 0 until minOf(arr.length(), 50)) {
                            val alert = arr.getJSONObject(i)
                            val type = alert.optString("type", "unknown")
                            if (type.contains("theft") || type.contains("critical")) criticalCount++

                            val card = createAlertCard(alert)
                            layoutAlertList.addView(card)
                            if (i < arr.length() - 1) {
                                val spacer = View(requireContext())
                                spacer.layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.MATCH_PARENT, 8)
                                layoutAlertList.addView(spacer)
                            }
                        }

                        if (criticalCount > 0) {
                            tvCriticalCount.text = "$criticalCount critical"
                            tvCriticalCount.visibility = View.VISIBLE
                        } else {
                            tvCriticalCount.visibility = View.GONE
                        }
                    } catch (_: Exception) {}
                }
            }
        })
    }

    private fun createAlertCard(alert: JSONObject): View {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.item_alert_card, layoutAlertList, false)

        val type = alert.optString("type", "unknown")
        val message = alert.optString("message", alert.optString("details", "Alert received"))
        val createdAt = alert.optString("created_at", "")

        val severity = when {
            type.contains("theft") || type.contains("critical") -> "CRITICAL"
            type.contains("sim") || type.contains("offline") || type.contains("unlock") -> "WARNING"
            else -> "INFO"
        }

        val colorRes = when (severity) {
            "CRITICAL" -> R.color.alert_critical
            "WARNING" -> R.color.alert_warning
            else -> R.color.alert_info
        }

        view.findViewById<TextView>(R.id.tv_alert_type).text = severity
        view.findViewById<TextView>(R.id.tv_alert_type).setTextColor(
            ContextCompat.getColor(requireContext(), colorRes))
        view.findViewById<TextView>(R.id.tv_alert_message).text = message
        view.findViewById<TextView>(R.id.tv_alert_time).text = formatTime(createdAt)

        return view
    }

    private fun formatTime(iso: String): String {
        return try {
            val parts = iso.split("T")
            if (parts.size > 1) parts[1].take(5) else iso.take(10)
        } catch (_: Exception) { iso }
    }
}
