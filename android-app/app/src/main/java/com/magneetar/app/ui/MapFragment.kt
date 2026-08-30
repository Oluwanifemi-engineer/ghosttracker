package com.magneetar.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.magneetar.app.R
import com.magneetar.app.TokenVault
import okhttp3.*
import org.json.JSONObject
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.compass.CompassOverlay
import org.osmdroid.views.overlay.gestures.RotationGestureOverlay
import org.osmdroid.views.overlay.mylocation.MyLocationNewOverlay
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Map screen using OSMDroid (OpenStreetMap) with CartoDB Dark Matter tiles.
 * Matches the dashboard's dark Leaflet/OSM theme exactly.
 * Auto-refreshes every 15 seconds for real-time tracking.
 */
class MapFragment : Fragment() {

    private var osmMap: MapView? = null
    private lateinit var tvActiveDevice: TextView
    private lateinit var tvLastUpdate: TextView
    private lateinit var tvLocationInfo: TextView
    private lateinit var tvSpeedInfo: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var statusDot: View

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val defaultLocation = GeoPoint(7.518, 4.528)
    private val refreshHandler = Handler(Looper.getMainLooper())
    private val REFRESH_INTERVAL = 15_000L

    private val refreshRunnable = object : Runnable {
        override fun run() {
            loadDevices()
            refreshHandler.postDelayed(this, REFRESH_INTERVAL)
        }
    }

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) enableMyLocation()
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.fragment_map, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        tvActiveDevice = view.findViewById(R.id.tv_active_device)
        tvLastUpdate = view.findViewById(R.id.tv_last_update)
        tvLocationInfo = view.findViewById(R.id.tv_location_info)
        tvSpeedInfo = view.findViewById(R.id.tv_speed_info)
        progressBar = view.findViewById(R.id.progress_bar)
        statusDot = view.findViewById(R.id.status_dot)

        Configuration.getInstance().userAgentValue = requireContext().packageName

        osmMap = view.findViewById(R.id.osm_map)
        osmMap?.let { setupMap(it) }

        checkAndRequestLocationPermission()
    }

    private fun setupMap(map: MapView) {
        // Standard OSM tiles (free, no API key)
        map.setTileSource(TileSourceFactory.MAPNIK)
        map.setMultiTouchControls(true)
        map.controller.setZoom(16.0)
        map.controller.setCenter(defaultLocation)

        // Compass
        try {
            val compass = CompassOverlay(requireContext(), map)
            compass.enableCompass()
            map.overlays.add(compass)
        } catch (_: Exception) {}

        // Rotation
        val rotation = RotationGestureOverlay(map)
        rotation.isEnabled = true
        map.overlays.add(rotation)

        map.invalidate()
    }

    private fun enableMyLocation() {
        osmMap?.let { map ->
            try {
                val myLocOverlay = MyLocationNewOverlay(map)
                myLocOverlay.enableMyLocation()
                myLocOverlay.enableFollowLocation()
                map.overlays.add(0, myLocOverlay)
                map.invalidate()
            } catch (_: SecurityException) {}
        }
    }

    private fun checkAndRequestLocationPermission() {
        val hasFine = ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasCoarse = ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasFine || hasCoarse) {
            enableMyLocation()
            return
        }

        if (shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) {
            AlertDialog.Builder(requireContext(), com.google.android.material.R.style.ThemeOverlay_Material3_MaterialAlertDialog)
                .setTitle("Location Access")
                .setMessage(
                    "Magneetar needs your location to show devices on the map " +
                    "and track them if stolen.\n\n" +
                    "Your location is only used for device tracking."
                )
                .setPositiveButton("Allow") { _, _ ->
                    locationPermissionLauncher.launch(
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                    )
                }
                .setNegativeButton("Not Now", null)
                .show()
        } else {
            locationPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        }
    }

    override fun onResume() {
        super.onResume()
        osmMap?.onResume()
        loadDevices()
        refreshHandler.postDelayed(refreshRunnable, REFRESH_INTERVAL)
    }

    override fun onPause() {
        super.onPause()
        refreshHandler.removeCallbacks(refreshRunnable)
        osmMap?.onPause()
    }

    private fun loadDevices() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())

        if (serverUrl.isEmpty() || userToken.isEmpty()) {
            tvActiveDevice.text = "Not signed in"
            return
        }

        progressBar.visibility = View.VISIBLE

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices")
            .addHeader("Authorization", "Bearer $userToken")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                activity?.runOnUiThread {
                    progressBar.visibility = View.GONE
                    tvActiveDevice.text = "Connection failed"
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: return
                activity?.runOnUiThread {
                    progressBar.visibility = View.GONE
                    try {
                        val json = JSONObject(body)
                        val devices = json.optJSONArray("devices") ?: return@runOnUiThread

                        if (devices.length() == 0) {
                            tvActiveDevice.text = "No devices linked"
                            tvLocationInfo.text = "—"
                            tvSpeedInfo.text = ""
                            tvLastUpdate.text = ""
                            return@runOnUiThread
                        }

                        // Clear old markers
                        osmMap?.overlays?.removeIf { it is Marker }

                        var lastDevice: JSONObject? = null

                        for (i in 0 until devices.length()) {
                            val device = devices.getJSONObject(i)
                            val lat = device.optDouble("latitude", 0.0)
                            val lng = device.optDouble("longitude", 0.0)

                            if (lat != 0.0 && lng != 0.0) {
                                val point = GeoPoint(lat, lng)
                                val name = device.optString("name", device.optString("model", "Device"))

                                val marker = Marker(osmMap)
                                marker.position = point
                                marker.title = name
                                marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                                marker.icon = ContextCompat.getDrawable(requireContext(), R.drawable.map_marker_blue)
                                osmMap?.overlays?.add(marker)

                                lastDevice = device

                                if (i == 0) {
                                    osmMap?.controller?.animateTo(point)
                                }
                            }
                        }

                        osmMap?.invalidate()

                        if (lastDevice != null) {
                            val name = lastDevice.optString("name", lastDevice.optString("model", "Device"))
                            val lat = lastDevice.optDouble("latitude", 0.0)
                            val lng = lastDevice.optDouble("longitude", 0.0)
                            val speed = lastDevice.optDouble("speed", 0.0)
                            val isOnline = lastDevice.optBoolean("is_online", false)

                            tvActiveDevice.text = name
                            tvLocationInfo.text = String.format("%.4f, %.4f", lat, lng)
                            tvSpeedInfo.text = if (speed > 0) String.format("%.1f m/s", speed) else ""
                            tvLastUpdate.text = if (isOnline) "Live" else "Last known"
                        }
                    } catch (_: Exception) {
                        tvActiveDevice.text = "Error loading devices"
                    }
                }
            }
        })
    }
}
