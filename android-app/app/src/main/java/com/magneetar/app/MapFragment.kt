package com.magneetar.app

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import okhttp3.*
import org.json.JSONObject
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import java.io.IOException
import java.util.concurrent.TimeUnit

class MapFragment : Fragment() {

    private var osmMap: MapView? = null
    private var progressMap: ProgressBar? = null
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        return inflater.inflate(R.layout.fragment_map, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        osmMap = view.findViewById(R.id.osm_map)
        progressMap = view.findViewById(R.id.progress_map)

        Configuration.getInstance().userAgentValue = requireContext().packageName

        osmMap?.let { map ->
            map.setTileSource(TileSourceFactory.MAPNIK)
            map.setMultiTouchControls(true)
            map.controller.setZoom(16.0)
            map.controller.setCenter(GeoPoint(7.518, 4.528))
            map.invalidate()
        }

        loadDeviceLocation()
    }

    override fun onResume() {
        super.onResume()
        osmMap?.onResume()
        loadDeviceLocation()
    }

    override fun onPause() {
        super.onPause()
        osmMap?.onPause()
    }

    private fun loadDeviceLocation() {
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
                        if (arr.length() == 0) return@runOnUiThread

                        val device = arr.getJSONObject(0)
                        val lat = device.optDouble("latitude", 0.0)
                        val lng = device.optDouble("longitude", 0.0)
                        val name = device.optString("name", device.optString("model", "Device"))

                        if (lat != 0.0 && lng != 0.0) {
                            osmMap?.overlays?.clear()
                            val marker = Marker(osmMap)
                            marker.position = GeoPoint(lat, lng)
                            marker.title = name
                            marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            marker.icon = ContextCompat.getDrawable(requireContext(), R.drawable.map_marker_blue)
                            osmMap?.overlays?.add(marker)
                            osmMap?.controller?.animateTo(GeoPoint(lat, lng))
                            osmMap?.invalidate()
                        }
                    } catch (_: Exception) {}
                }
            }
        })
    }
}
