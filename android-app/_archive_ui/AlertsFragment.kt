package com.magneetar.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.magneetar.app.R
import com.magneetar.app.TokenVault
import okhttp3.*
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Alerts screen — shows theft alerts, SIM changes, and offline notifications.
 */
class AlertsFragment : Fragment() {

    private lateinit var rvAlerts: RecyclerView
    private lateinit var emptyState: LinearLayout
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()
    private val alerts = mutableListOf<JSONObject>()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_alerts, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        rvAlerts = view.findViewById(R.id.rv_alerts)
        emptyState = view.findViewById(R.id.emptyState)

        rvAlerts.layoutManager = LinearLayoutManager(requireContext())
        rvAlerts.adapter = AlertAdapter(alerts)

        loadAlerts()
    }

    override fun onResume() {
        super.onResume()
        loadAlerts()
    }

    private fun loadAlerts() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())

        if (serverUrl.isEmpty() || userToken.isEmpty()) {
            showEmpty()
            return
        }

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/alerts")
            .addHeader("Authorization", "Bearer $userToken")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                activity?.runOnUiThread { showEmpty() }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: return
                activity?.runOnUiThread {
                    try {
                        val json = JSONObject(body)
                        val arr = json.optJSONArray("alerts") ?: return@runOnUiThread
                        alerts.clear()
                        for (i in 0 until arr.length()) {
                            alerts.add(arr.getJSONObject(i))
                        }
                        if (alerts.isEmpty()) {
                            showEmpty()
                        } else {
                            emptyState.visibility = View.GONE
                            rvAlerts.visibility = View.VISIBLE
                            rvAlerts.adapter?.notifyDataSetChanged()
                        }
                    } catch (e: Exception) {
                        showEmpty()
                    }
                }
            }
        })
    }

    private fun showEmpty() {
        emptyState.visibility = View.VISIBLE
        rvAlerts.visibility = View.GONE
    }

    inner class AlertAdapter(private val items: List<JSONObject>) :
        RecyclerView.Adapter<AlertAdapter.VH>() {

        inner class VH(view: View) : RecyclerView.ViewHolder(view) {
            val tvType: TextView = view.findViewById(R.id.tv_alert_type)
            val tvMessage: TextView = view.findViewById(R.id.tv_alert_message)
            val tvTime: TextView = view.findViewById(R.id.tv_alert_time)
            val tvDevice: TextView = view.findViewById(R.id.tv_alert_device)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_alert, parent, false)
            return VH(view)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val alert = items[position]
            val type = alert.optString("type", "unknown")
            val message = alert.optString("message", "Alert received")
            val deviceName = alert.optString("device_name", "")
            val createdAt = alert.optString("created_at", "")

            // Set icon/color based on type
            val (icon, color) = when (type.lowercase()) {
                "theft", "theft_detected" -> "🚨" to "#FF4444"
                "sim_changed" -> "📱" to "#FFB800"
                "device_offline" -> "📴" to "#FF8800"
                "failed_unlock" -> "🔓" to "#FF6666"
                "motion_detected" -> "🏃" to "#FFB800"
                else -> "🔔" to "#707070"
            }

            holder.tvType.text = "$icon ${type.replace("_", " ").uppercase()}"
            holder.tvType.setTextColor(android.graphics.Color.parseColor(color))
            holder.tvMessage.text = message
            holder.tvDevice.text = deviceName
            holder.tvTime.text = formatTime(createdAt)
        }

        override fun getItemCount() = items.size

        private fun formatTime(isoTime: String): String {
            if (isoTime.isEmpty()) return ""
            return try {
                // Simple parsing — just show the time part
                val parts = isoTime.split("T")
                if (parts.size > 1) {
                    parts[1].take(5) // HH:MM
                } else {
                    isoTime.take(10)
                }
            } catch (_: Exception) { isoTime }
        }
    }
}
