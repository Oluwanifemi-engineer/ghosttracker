package com.magneetar.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.magneetar.app.R
import com.magneetar.app.TokenVault
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Commands screen — all 5 actions visible in a grid, no scrolling.
 * Contextual permissions: camera/mic requested only when Capture is tapped.
 */
class CommandsFragment : Fragment() {

    private lateinit var spinnerDevices: Spinner
    private lateinit var tvStatus: TextView
    private var devices = mutableListOf<JSONObject>()
    private var selectedDeviceId: String = ""

    private val capturePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val camera = permissions[Manifest.permission.CAMERA] == true
        val mic = permissions[Manifest.permission.RECORD_AUDIO] == true
        if (camera && mic) sendCommand("capture")
        else showStatus("Camera and microphone permissions are required for capture", false)
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.fragment_commands, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        spinnerDevices = view.findViewById(R.id.spinner_devices)
        tvStatus = view.findViewById(R.id.tv_command_status)

        // Command actions — all visible
        view.findViewById<View>(R.id.cmd_ring)?.setOnClickListener { sendCommand("ring") }
        view.findViewById<View>(R.id.cmd_lock)?.setOnClickListener { sendCommand("lock") }
        view.findViewById<View>(R.id.cmd_locate)?.setOnClickListener { sendCommand("locate") }
        view.findViewById<View>(R.id.cmd_capture)?.setOnClickListener { requestCapturePermissionsAndSend() }
        view.findViewById<View>(R.id.cmd_wipe)?.setOnClickListener { confirmWipe() }

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
                        devices.clear()
                        val names = mutableListOf<String>()
                        for (i in 0 until arr.length()) {
                            val device = arr.getJSONObject(i)
                            devices.add(device)
                            names.add(device.optString("name", device.optString("model", "Device $i")))
                        }
                        if (devices.isNotEmpty()) {
                            selectedDeviceId = devices[0].optString("device_id", "")
                        }

                        val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, names)
                        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                        spinnerDevices.adapter = adapter
                        spinnerDevices.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                            override fun onItemSelected(parent: AdapterView<*>?, view: View?, pos: Int, id: Long) {
                                selectedDeviceId = devices[pos].optString("device_id", "")
                            }
                            override fun onNothingSelected(parent: AdapterView<*>?) {}
                        }
                    } catch (_: Exception) {}
                }
            }
        })
    }

    private fun requestCapturePermissionsAndSend() {
        val hasCamera = ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        val hasMic = ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        if (hasCamera && hasMic) {
            sendCommand("capture")
            return
        }

        if (shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) ||
            shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)) {
            AlertDialog.Builder(requireContext(), com.google.android.material.R.style.ThemeOverlay_Material3_MaterialAlertDialog)
                .setTitle("Evidence Capture")
                .setMessage(
                    "Magneetar needs camera and microphone to take a photo " +
                    "and record audio when you send a capture command."
                )
                .setPositiveButton("Allow") { _, _ ->
                    capturePermissionLauncher.launch(
                        arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
                    )
                }
                .setNegativeButton("Not Now", null)
                .show()
        } else {
            capturePermissionLauncher.launch(
                arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
            )
        }
    }

    private fun sendCommand(command: String) {
        if (selectedDeviceId.isEmpty()) {
            showStatus("No device selected", false)
            return
        }

        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())

        if (serverUrl.isEmpty() || userToken.isEmpty()) {
            showStatus("Not signed in", false)
            return
        }

        showStatus("Sending $command...", true)

        val body = JSONObject().apply { put("command", command) }.toString()

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices/$selectedDeviceId/commands")
            .addHeader("Authorization", "Bearer $userToken")
            .addHeader("Content-Type", "application/json")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                activity?.runOnUiThread {
                    showStatus("Failed: ${e.message}", false)
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string() ?: ""
                activity?.runOnUiThread {
                    if (response.isSuccessful) {
                        showStatus("✓ $command sent", true)
                    } else {
                        val errorMsg = try {
                            JSONObject(responseBody).optString("detail", "Error ${response.code}")
                        } catch (_: Exception) { "Error ${response.code}" }
                        showStatus("✗ $errorMsg", false)
                    }
                }
            }
        })
    }

    private fun confirmWipe() {
        if (selectedDeviceId.isEmpty()) {
            showStatus("No device selected", false)
            return
        }

        AlertDialog.Builder(requireContext(), com.google.android.material.R.style.ThemeOverlay_Material3_MaterialAlertDialog)
            .setTitle("Factory Reset")
            .setMessage("This will erase ALL data on the device. This action cannot be undone.\n\nAre you sure?")
            .setPositiveButton("Wipe Device") { _, _ -> sendCommand("wipe") }
            .setNegativeButton("Cancel", null)
            .setCancelable(true)
            .show()
    }

    private fun showStatus(message: String, success: Boolean) {
        tvStatus.text = message
        tvStatus.setTextColor(
            ContextCompat.getColor(requireContext(), if (success) R.color.status_online else R.color.status_offline)
        )
        tvStatus.visibility = View.VISIBLE
    }
}
