package com.magneetar.app.ui

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import com.magneetar.app.AdminReceiver
import com.magneetar.app.R
import com.magneetar.app.TokenVault
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Settings screen — account info, circles, protection status, preferences.
 */
class SettingsFragment : Fragment() {

    private lateinit var tvUserName: TextView
    private lateinit var tvUserEmail: TextView
    private lateinit var tvUserTier: TextView
    private lateinit var tvAdminStatus: TextView
    private lateinit var tvTrackingStatus: TextView

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_settings, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        tvUserName = view.findViewById(R.id.tv_user_name)
        tvUserEmail = view.findViewById(R.id.tv_user_email)
        tvUserTier = view.findViewById(R.id.tv_user_tier)
        tvAdminStatus = view.findViewById(R.id.tv_admin_status)
        tvTrackingStatus = view.findViewById(R.id.tv_tracking_status)

        // Load user profile
        loadProfile()

        // Check protection status
        updateProtectionStatus()

        // Circle buttons
        view.findViewById<LinearLayout>(R.id.btn_create_circle)?.setOnClickListener {
            createCircle()
        }
        view.findViewById<LinearLayout>(R.id.btn_join_circle)?.setOnClickListener {
            joinCircle()
        }

        // Battery optimization
        view.findViewById<LinearLayout>(R.id.btn_battery)?.setOnClickListener {
            requestBatteryOptimization()
        }

        // Open web dashboard
        view.findViewById<LinearLayout>(R.id.btn_open_dashboard)?.setOnClickListener {
            openDashboard()
        }

        // Logout
        view.findViewById<LinearLayout>(R.id.btn_logout)?.setOnClickListener {
            confirmLogout()
        }
    }

    override fun onResume() {
        super.onResume()
        updateProtectionStatus()
    }

    private fun loadProfile() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())

        if (serverUrl.isEmpty() || userToken.isEmpty()) {
            tvUserName.text = "Not signed in"
            return
        }

        val request = Request.Builder()
            .url("$serverUrl/api/auth/me")
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
                        tvUserName.text = json.optString("full_name", json.optString("username", "User"))
                        tvUserEmail.text = json.optString("email", "")
                        val tier = json.optString("tier", "free")
                        tvUserTier.text = "${tier.replaceFirstChar { it.uppercase() }} Tier"
                    } catch (_: Exception) {}
                }
            }
        })
    }

    private fun updateProtectionStatus() {
        // Device Admin
        val isDeviceAdmin = try {
            val dpm = requireContext().getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(requireContext(), AdminReceiver::class.java)
            dpm.isAdminActive(adminComponent)
        } catch (e: Exception) { false }

        tvAdminStatus.text = if (isDeviceAdmin) "Active ✓" else "Inactive"
        tvAdminStatus.setTextColor(
            android.graphics.Color.parseColor(if (isDeviceAdmin) "#00FF88" else "#FF4444")
        )

        // Background tracking
        val isTracking = try {
            val pm = requireContext().getSystemService(Context.POWER_SERVICE) as PowerManager
            pm.isIgnoringBatteryOptimizations(requireContext().packageName)
        } catch (e: Exception) { true }

        tvTrackingStatus.text = "Active"
        tvTrackingStatus.setTextColor(android.graphics.Color.parseColor("#00FF88"))
    }

    private fun createCircle() {
        val input = android.widget.EditText(requireContext()).apply {
            hint = "Circle name"
            setPadding(64, 32, 64, 32)
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Create Circle")
            .setMessage("Enter a name for your circle (family, friends, etc.)")
            .setView(input)
            .setPositiveButton("CREATE") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isNotEmpty()) {
                    doCreateCircle(name)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun doCreateCircle(name: String) {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())

        val body = JSONObject().apply { put("name", name) }.toString()
        val request = Request.Builder()
            .url("$serverUrl/api/circles")
            .addHeader("Authorization", "Bearer $userToken")
            .addHeader("Content-Type", "application/json")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) {
                activity?.runOnUiThread {
                    if (response.isSuccessful) {
                        val resp = JSONObject(response.body?.string() ?: "{}")
                        val inviteCode = resp.optString("invite_code", "")
                        AlertDialog.Builder(requireContext())
                            .setTitle("Circle Created!")
                            .setMessage("Share this invite code with family/friends:\n\n$inviteCode")
                            .setPositiveButton("OK", null)
                            .show()
                    } else {
                        AlertDialog.Builder(requireContext())
                            .setTitle("Error")
                            .setMessage("Could not create circle. You may need a paid plan.")
                            .setPositiveButton("OK", null)
                            .show()
                    }
                }
            }
        })
    }

    private fun joinCircle() {
        val input = android.widget.EditText(requireContext()).apply {
            hint = "Invite code"
            setPadding(64, 32, 64, 32)
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Join Circle")
            .setMessage("Enter the invite code shared with you")
            .setView(input)
            .setPositiveButton("JOIN") { _, _ ->
                val code = input.text.toString().trim()
                if (code.isNotEmpty()) {
                    doJoinCircle(code)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun doJoinCircle(code: String) {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(requireContext())

        val body = JSONObject().apply { put("invite_code", code) }.toString()
        val request = Request.Builder()
            .url("$serverUrl/api/circles/join")
            .addHeader("Authorization", "Bearer $userToken")
            .addHeader("Content-Type", "application/json")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) {
                activity?.runOnUiThread {
                    if (response.isSuccessful) {
                        AlertDialog.Builder(requireContext())
                            .setTitle("Joined!")
                            .setMessage("You've joined the circle successfully.")
                            .setPositiveButton("OK", null)
                            .show()
                    } else {
                        AlertDialog.Builder(requireContext())
                            .setTitle("Error")
                            .setMessage("Invalid invite code.")
                            .setPositiveButton("OK", null)
                            .show()
                    }
                }
            }
        })
    }

    private fun requestBatteryOptimization() {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${requireContext().packageName}")
            }
            startActivity(intent)
        } catch (e: Exception) {
            AlertDialog.Builder(requireContext())
                .setTitle("Battery Settings")
                .setMessage("Could not open battery settings. Please disable battery optimization for Magneetar manually.")
                .setPositiveButton("OK", null)
                .show()
        }
    }

    private fun openDashboard() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""

        val dashboardUrl = try {
            val uri = Uri.parse(serverUrl)
            val host = uri.host
            if (host != null && host.startsWith("api.")) {
                val scheme = uri.scheme ?: "https"
                "$scheme://app.${host.removePrefix("api.")}/login"
            } else {
                serverUrl
            }
        } catch (e: Exception) { serverUrl }

        try {
            startActivity(Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse(dashboardUrl)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            })
        } catch (e: Exception) {}
    }

    private fun confirmLogout() {
        AlertDialog.Builder(requireContext())
            .setTitle("Sign Out")
            .setMessage("Are you sure you want to sign out? Background protection will stop.")
            .setPositiveButton("SIGN OUT") { _, _ -> doLogout() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun doLogout() {
        val prefs = requireContext().getSharedPreferences("mt", 0)
        prefs.edit().clear().apply()

        // Clear encrypted tokens
        try {
            val keyStore = java.security.KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)
            keyStore.deleteEntry("magneetar_session_key")
        } catch (_: Exception) {}

        // Navigate to main activity
        val intent = Intent(requireContext(), com.magneetar.app.MainActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        requireActivity().finish()
    }
}
