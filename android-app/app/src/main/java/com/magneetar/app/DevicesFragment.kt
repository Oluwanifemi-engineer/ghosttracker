package com.magneetar.app

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class DevicesFragment : Fragment() {

    private lateinit var layoutDeviceList: LinearLayout
    private lateinit var tvEmpty: TextView

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val refreshHandler = Handler(Looper.getMainLooper())
    private val refreshRunnable = object : Runnable {
        override fun run() {
            loadDevices()
            refreshHandler.postDelayed(this, 10_000L)
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        return inflater.inflate(R.layout.fragment_devices, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        layoutDeviceList = view.findViewById(R.id.layout_device_list)
        tvEmpty = view.findViewById(R.id.tv_empty)
        loadDevices()
        refreshHandler.postDelayed(refreshRunnable, 10_000L)
    }

    override fun onResume() {
        super.onResume()
        loadDevices()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        refreshHandler.removeCallbacks(refreshRunnable)
    }

    private fun loadDevices() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())
        if (serverUrl.isEmpty() || userToken.isEmpty()) return

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices")
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
                        val arr = json.optJSONArray("devices") ?: return@runOnUiThread

                        layoutDeviceList.removeAllViews()

                        if (arr.length() == 0) {
                            tvEmpty.visibility = View.VISIBLE
                            layoutDeviceList.visibility = View.GONE
                            return@runOnUiThread
                        }

                        tvEmpty.visibility = View.GONE
                        layoutDeviceList.visibility = View.VISIBLE

                        for (i in 0 until arr.length()) {
                            val device = arr.getJSONObject(i)
                            val card = createDeviceCard(device)
                            layoutDeviceList.addView(card)
                            if (i < arr.length() - 1) {
                                val spacer = View(requireContext())
                                spacer.layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.MATCH_PARENT, 12)
                                layoutDeviceList.addView(spacer)
                            }
                        }
                    } catch (_: Exception) {}
                }
            }
        })
    }

    private fun createDeviceCard(device: JSONObject): View {
        val inflater = LayoutInflater.from(requireContext())
        val card = inflater.inflate(R.layout.item_device_card, layoutDeviceList, false)

        val deviceId = device.optString("id", "")
        val alias = device.optString("alias", "")
        val model = device.optString("model", "Unknown Device")
        val osVersion = device.optString("os_version", "")
        val isOnline = device.optBoolean("is_online", false)
        val battery = device.optInt("battery_percent", -1)
        val lat = device.optDouble("lat", 0.0)
        val lng = device.optDouble("lng", 0.0)
        val sentinelScore = device.optInt("sentinel_score", 0)

        card.findViewById<TextView>(R.id.tv_device_name).text = alias.ifEmpty { model }
        card.findViewById<TextView>(R.id.tv_device_model).text = "$model · $osVersion"

        val statusBadge = card.findViewById<TextView>(R.id.tv_status_badge)
        if (isOnline) {
            statusBadge.text = "SECURED"
            statusBadge.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_online))
            statusBadge.setBackgroundResource(R.drawable.badge_secured)
        } else {
            statusBadge.text = "OFFLINE"
            statusBadge.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_offline))
        }

        val tvBattery = card.findViewById<TextView>(R.id.tv_battery)
        if (battery >= 0) {
            tvBattery.text = "$battery%"
            tvBattery.setTextColor(ContextCompat.getColor(requireContext(),
                if (battery > 20) R.color.status_online else R.color.alert_warning))
        } else {
            tvBattery.text = "—"
        }

        val tvLocation = card.findViewById<TextView>(R.id.tv_location)
        if (lat != 0.0 && lng != 0.0) {
            tvLocation.text = String.format("%.4f°N %.4f°E", lat, lng)
        } else {
            tvLocation.text = "No location data"
        }

        // Action buttons
        card.findViewById<View>(R.id.btn_locate)?.setOnClickListener {
            sendCommand(deviceId, "locate")
        }
        card.findViewById<View>(R.id.btn_lock)?.setOnClickListener {
            sendCommand(deviceId, "lock")
        }
        card.findViewById<View>(R.id.btn_wipe)?.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Wipe Device")
                .setMessage("This will protect your data. Continue?")
                .setPositiveButton("Wipe") { _, _ -> sendCommand(deviceId, "wipe") }
                .setNegativeButton("Cancel", null)
                .show()
        }

        return card
    }

    private fun sendCommand(deviceId: String, command: String) {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())
        if (serverUrl.isEmpty() || userToken.isEmpty() || deviceId.isEmpty()) return

        val body = JSONObject().apply { put("command", command) }.toString()
        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices/$deviceId/commands")
            .addHeader("Authorization", "Bearer $userToken")
            .addHeader("Content-Type", "application/json")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) {
                activity?.runOnUiThread {
                    val msg = if (response.isSuccessful) "✓ $command sent" else "✗ Failed"
                    android.widget.Toast.makeText(requireContext(), msg, android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        })
    }
}
