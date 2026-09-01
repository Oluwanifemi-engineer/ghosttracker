package com.magneetar.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class DashboardActivity : AppCompatActivity() {

    private lateinit var bottomNav: BottomNavigationView

    // Session timer — uses TokenVault's banking-standard timeouts:
    //   - 15 min idle → lock overlay (re-auth required)
    //   - 24h hard timeout → force sign-in
    private val sessionHandler = Handler(Looper.getMainLooper())
    private val sessionCheckRunnable = object : Runnable {
        override fun run() {
            checkSession()
            sessionHandler.postDelayed(this, 30_000L) // Check every 30s
        }
    }

    // Screen receiver
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF -> { /* Timer keeps running */ }
                Intent.ACTION_SCREEN_ON -> TokenVault.recordInteraction(this@DashboardActivity)
                Intent.ACTION_USER_PRESENT -> TokenVault.recordInteraction(this@DashboardActivity)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_dashboard_v2)

        bottomNav = findViewById(R.id.bottom_nav)

        // Fragment references
        val homeFragment = HomeFragment()
        val mapFragment = MapFragment()
        val devicesFragment = DevicesFragment()
        val alertsFragment = AlertsFragment()
        val securityFragment = SecurityFragment()

        // Default: Home
        loadFragment(homeFragment, "home")

        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> { loadFragment(homeFragment, "home"); true }
                R.id.nav_map -> { loadFragment(mapFragment, "map"); true }
                R.id.nav_devices -> { loadFragment(devicesFragment, "devices"); true }
                R.id.nav_alerts -> { loadFragment(alertsFragment, "alerts"); true }
                R.id.nav_security -> { loadFragment(securityFragment, "security"); true }
                else -> false
            }
        }

        // Register screen receiver
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        registerReceiver(screenReceiver, filter)

        // Start services
        startServicesSafe()

        // Load device ID for commands
        loadDeviceId()

        // Clear any stale background timestamp from a previous session
        // (prevents PalmPay auto-lock from triggering on first resume)
        SecurityManager.clearBackgroundTimestamp(this)

        // Start session tracking
        TokenVault.recordInteraction(this)
        sessionHandler.postDelayed(sessionCheckRunnable, 30_000L)
    }

    override fun onResume() {
        super.onResume()
        TokenVault.recordInteraction(this)
        checkSession()
    }

    override fun onPause() {
        super.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        sessionHandler.removeCallbacks(sessionCheckRunnable)
        try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}
    }

    private fun loadFragment(fragment: Fragment, tag: String) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment, tag)
            .commit()
    }

    fun navigateToTab(itemId: Int) {
        bottomNav.selectedItemId = itemId
    }

    fun sendWipeCommand(deviceId: String) {
        val prefs = getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(this)

        if (serverUrl.isEmpty() || userToken.isEmpty()) return

        val body = JSONObject().apply { put("command", "wipe") }.toString()
        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices/$deviceId/commands")
            .addHeader("Authorization", "Bearer $userToken")
            .addHeader("Content-Type", "application/json")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()

        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .build()
            .newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {}
                override fun onResponse(call: Call, response: Response) {}
            })
    }

    private fun loadDeviceId() {
        val prefs = getSharedPreferences("mt", 0)
        val serverUrl = prefs.getString("server_url", "") ?: ""
        val userToken = TokenVault.accessToken(this)

        if (serverUrl.isEmpty() || userToken.isEmpty()) return

        val request = Request.Builder()
            .url("$serverUrl/api/dashboard/devices")
            .addHeader("Authorization", "Bearer $userToken")
            .get()
            .build()

        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .build()
            .newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {}
                override fun onResponse(call: Call, response: Response) {
                    val body = response.body?.string() ?: return
                    try {
                        val json = JSONObject(body)
                        val arr = json.optJSONArray("devices") ?: return
                        if (arr.length() > 0) {
                            val deviceId = arr.getJSONObject(0).optString("device_id", "")
                            prefs.edit().putString("selected_device_id", deviceId).apply()
                        }
                    } catch (_: Exception) {}
                }
            })
    }

    // ── Session Management (Opay-style) ──

    private fun checkSession() {
        when {
            // Hard timeout: 24h → force re-login
            TokenVault.isHardTimeout(this) -> {
                forceSignOut("Session expired. Please sign in again.")
            }
            // Token missing → force re-login
            TokenVault.accessToken(this).isEmpty() -> {
                forceSignOut("Session expired.")
            }
        }
    }

    private fun forceSignOut(message: String) {
        TokenVault.clear(this)
        // Only clear session data, NOT onboarding_complete
        getSharedPreferences("mt", MODE_PRIVATE).edit()
            .remove("server_url")
            .remove("user_email")
            .remove("user_name")
            .remove("auth_method")
            .remove("selected_device_id")
            .remove("last_interaction")
            .remove("last_background_time")
            .remove("session_last_interaction")
            .remove("session_start_time")
            .remove("session_bio_authenticated")
            .apply()
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    // ── Services ──

    private fun startServicesSafe() {
        try {
            ContextCompat.startForegroundService(this, Intent(this, TrackingService::class.java))
            ContextCompat.startForegroundService(this, Intent(this, PersistenceService::class.java))
            try { WatchdogReceiver.scheduleWatchdog(this) } catch (_: Exception) {}
            try { HealthCheckWorker.schedule(this) } catch (_: Exception) {}
        } catch (e: Exception) {
            android.util.Log.e("DashboardActivity", "Services failed: ${e.message}")
        }
    }
}
