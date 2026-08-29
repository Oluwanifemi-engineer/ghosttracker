package com.magneetar.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MarkerOptions
import com.magneetar.app.R
import okhttp3.*
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Map screen — shows all linked devices on a Google Map.
 * Pulls device locations from the server API and places markers.
 */
class MapFragment : Fragment(), OnMapReadyCallback {

    private var googleMap: GoogleMap? = null
    private lateinit var tvActiveDevice: TextView
    private lateinit var tvLastUpdate: TextView
    private lateinit var tvLocationInfo: TextView
    private lateinit var tvSpeedInfo: TextView

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    // Default: OAU campus, Ile-Ife, Nigeria
    private val defaultLocation = LatLng(7.518, 4.528)

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_map, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        tvActiveDevice = view.findViewById(R.id.tv_active_device)
        tvLastUpdate = view.findViewById(R.id.tv_last_update)
        tvLocationInfo = view.findViewById(R.id.tv_location_info)
        tvSpeedInfo = view.findViewById(R.id.tv_speed_info)

        val mapFragment = childFragmentManager.findFragmentById(R.id.mapFragment) as? SupportMapFragment
        mapFragment?.getMapAsync(this)
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map

        // Dark map style
        try {
            val style = com.google.android.gms.maps.model.MapStyleOptions.loadRawResourceStyle(
                requireContext(), R.raw.map_style_dark
            )
            map.setMapStyle(style)
        } catch (_: Exception) {
            // Default style is fine
        }

        map.moveCamera(CameraUpdateFactory.newLatLngZoom(defaultLocation, 15f))
        map.uiSettings.isZoomControlsEnabled = true
        map.uiSettings.isMyLocationButtonEnabled = false

        // Load devices
        loadDevices()
    }

    override fun onResume() {
        super.onResume()
        loadDevices()
    }

    private fun loadDevices() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = com.magneetar.app.TokenVault.accessToken(requireContext())

        if (serverUrl.isEmpty() || userToken.isEmpty()) {
            tvActiveDevice.text = "Not signed in"
            return
        }

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices")
            .addHeader("Authorization", "Bearer $userToken")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                activity?.runOnUiThread {
                    tvActiveDevice.text = "Connection failed"
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: return
                activity?.runOnUiThread {
                    try {
                        val json = JSONObject(body)
                        val devices = json.optJSONArray("devices") ?: return@runOnUiThread

                        if (devices.length() == 0) {
                            tvActiveDevice.text = "No devices linked"
                            return@runOnUiThread
                        }

                        googleMap?.clear()
                        var lastDevice: JSONObject? = null

                        for (i in 0 until devices.length()) {
                            val device = devices.getJSONObject(i)
                            val lat = device.optDouble("latitude", 0.0)
                            val lng = device.optDouble("longitude", 0.0)

                            if (lat != 0.0 && lng != 0.0) {
                                val position = LatLng(lat, lng)
                                val name = device.optString("name", device.optString("model", "Device"))

                                googleMap?.addMarker(
                                    MarkerOptions()
                                        .position(position)
                                        .title(name)
                                        .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_GREEN))
                                )

                                lastDevice = device

                                // Center on first device
                                if (i == 0) {
                                    googleMap?.animateCamera(CameraUpdateFactory.newLatLngZoom(position, 16f))
                                }
                            }
                        }

                        // Update status bar
                        if (lastDevice != null) {
                            val name = lastDevice.optString("name", lastDevice.optString("model", "Device"))
                            val lat = lastDevice.optDouble("latitude", 0.0)
                            val lng = lastDevice.optDouble("longitude", 0.0)
                            val speed = lastDevice.optDouble("speed", 0.0)

                            tvActiveDevice.text = name
                            tvLocationInfo.text = String.format("%.4f, %.4f", lat, lng)
                            tvSpeedInfo.text = if (speed > 0) String.format("%.1f m/s", speed) else ""
                            tvLastUpdate.text = "Live"
                        }
                    } catch (e: Exception) {
                        tvActiveDevice.text = "Error loading devices"
                    }
                }
            }
        })
    }
}
