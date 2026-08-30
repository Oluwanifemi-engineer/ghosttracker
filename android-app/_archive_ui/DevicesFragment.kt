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
 * Devices screen — shows all linked devices with status, location, and battery.
 */
class DevicesFragment : Fragment() {

    private lateinit var rvDevices: RecyclerView
    private lateinit var emptyState: LinearLayout
    private lateinit var tvDeviceCount: TextView
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()
    private val devices = mutableListOf<JSONObject>()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_devices, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        rvDevices = view.findViewById(R.id.rv_devices)
        emptyState = view.findViewById(R.id.emptyState)
        tvDeviceCount = view.findViewById(R.id.tv_device_count)

        rvDevices.layoutManager = LinearLayoutManager(requireContext())
        rvDevices.adapter = DeviceAdapter(devices)

        loadDevices()
    }

    override fun onResume() {
        super.onResume()
        loadDevices()
    }

    private fun loadDevices() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())

        if (serverUrl.isEmpty() || userToken.isEmpty()) {
            showEmpty()
            return
        }

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices")
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
                        val arr = json.optJSONArray("devices") ?: return@runOnUiThread
                        devices.clear()
                        for (i in 0 until arr.length()) {
                            devices.add(arr.getJSONObject(i))
                        }
                        if (devices.isEmpty()) {
                            showEmpty()
                        } else {
                            emptyState.visibility = View.GONE
                            rvDevices.visibility = View.VISIBLE
                            tvDeviceCount.text = "${devices.size} device${if (devices.size != 1) "s" else ""} linked"
                            rvDevices.adapter?.notifyDataSetChanged()
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
        rvDevices.visibility = View.GONE
        tvDeviceCount.text = "0 devices linked"
    }

    inner class DeviceAdapter(private val items: List<JSONObject>) :
        RecyclerView.Adapter<DeviceAdapter.VH>() {

        inner class VH(view: View) : RecyclerView.ViewHolder(view) {
            val tvName: TextView = view.findViewById(R.id.tv_device_name)
            val tvModel: TextView = view.findViewById(R.id.tv_device_model)
            val tvStatus: TextView = view.findViewById(R.id.tv_device_status)
            val tvLocation: TextView = view.findViewById(R.id.tv_device_location)
            val tvLastSeen: TextView = view.findViewById(R.id.tv_device_last_seen)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_device, parent, false)
            return VH(view)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            val device = items[position]
            val name = device.optString("name", device.optString("model", "Unknown Device"))
            val model = device.optString("model", "")
            val isOnline = device.optBoolean("is_online", false)
            val lat = device.optDouble("latitude", 0.0)
            val lng = device.optDouble("longitude", 0.0)

            holder.tvName.text = name
            holder.tvModel.text = model
            holder.tvStatus.text = if (isOnline) "Online" else "Offline"
            holder.tvStatus.setTextColor(
                android.graphics.Color.parseColor(if (isOnline) "#00FF88" else "#FF4444")
            )

            if (lat != 0.0 && lng != 0.0) {
                holder.tvLocation.text = String.format("%.4f, %.4f", lat, lng)
            } else {
                holder.tvLocation.text = "No location"
            }

            // Calculate last seen
            val lastSeen = device.optLong("last_seen", 0)
            if (lastSeen > 0) {
                val diff = System.currentTimeMillis() / 1000 - lastSeen
                holder.tvLastSeen.text = when {
                    diff < 60 -> "Just now"
                    diff < 3600 -> "${diff / 60}m ago"
                    diff < 86400 -> "${diff / 3600}h ago"
                    else -> "${diff / 86400}d ago"
                }
            } else {
                holder.tvLastSeen.text = "Never"
            }
        }

        override fun getItemCount() = items.size
    }
}
