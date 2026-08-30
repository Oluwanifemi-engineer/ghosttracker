package com.magneetar.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.appbar.MaterialToolbar
import com.magneetar.app.ui.*

/**
 * Full in-app dashboard — Life360-style experience with Opay-level security.
 *
 * Security: 2-minute inactivity timeout. After 2 minutes in background,
 * the app locks and requires re-authentication. Every app open shows
 * the login screen first (via MainActivity).
 */
class DashboardActivity : AppCompatActivity() {

    private lateinit var bottomNav: BottomNavigationView
    private lateinit var topAppBar: MaterialToolbar
    private lateinit var lockOverlay: View

    private val mapFragment = MapFragment()
    private val devicesFragment = DevicesFragment()
    private val commandsFragment = CommandsFragment()
    private val alertsFragment = AlertsFragment()
    private val settingsFragment = SettingsFragment()
    private var activeFragment: Fragment = mapFragment

    // Opay-style: 2-minute inactivity lock
    private val lockHandler = Handler(Looper.getMainLooper())
    private val LOCK_TIMEOUT_MS = 2 * 60 * 1000L // 2 minutes

    private val lockRunnable = Runnable {
        lockApp()
    }

    // Screen on/off receiver — pause timeout when screen is off
    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF -> pauseLockTimer()
                Intent.ACTION_SCREEN_ON -> resumeLockTimer()
                Intent.ACTION_USER_PRESENT -> resumeLockTimer()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge dark theme
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_dashboard)

        topAppBar = findViewById(R.id.topAppBar)
        bottomNav = findViewById(R.id.bottom_nav)
        lockOverlay = findViewById(R.id.lock_overlay)

        // Toolbar
        topAppBar.title = "Magneetar"
        topAppBar.subtitle = "Device Protection"

        // Add all fragments (hide non-active)
        supportFragmentManager.beginTransaction()
            .add(R.id.fragment_container, settingsFragment, "settings").hide(settingsFragment)
            .add(R.id.fragment_container, alertsFragment, "alerts").hide(alertsFragment)
            .add(R.id.fragment_container, commandsFragment, "commands").hide(commandsFragment)
            .add(R.id.fragment_container, devicesFragment, "devices").hide(devicesFragment)
            .add(R.id.fragment_container, mapFragment, "map")
            .commit()

        // Bottom navigation
        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_map -> { switchFragment(mapFragment, "Map", "Device Protection"); true }
                R.id.nav_devices -> { switchFragment(devicesFragment, "Devices", "Linked devices"); true }
                R.id.nav_commands -> { switchFragment(commandsFragment, "Commands", "Quick actions"); true }
                R.id.nav_alerts -> { switchFragment(alertsFragment, "Alerts", "Notifications"); true }
                R.id.nav_settings -> { switchFragment(settingsFragment, "Settings", "Account & preferences"); true }
                else -> false
            }
        }

        // Lock overlay tap → go to login
        lockOverlay.setOnClickListener {
            navigateToLogin()
        }

        // Register screen receiver
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        registerReceiver(screenReceiver, filter)

        // Start background services
        startServicesSafe()

        // Record interaction and start lock timer
        recordInteraction()
    }

    override fun onResume() {
        super.onResume()
        resumeLockTimer()
        recordInteraction()
    }

    override fun onPause() {
        super.onPause()
        // Record last interaction time
        getSharedPreferences("mt", MODE_PRIVATE).edit()
            .putLong("last_background_time", System.currentTimeMillis())
            .apply()
    }

    override fun onDestroy() {
        super.onDestroy()
        lockHandler.removeCallbacks(lockRunnable)
        try { unregisterReceiver(screenReceiver) } catch (_: Exception) {}
    }

    // ── Opay-style lock timer ──────────────────────────────────────────

    private fun recordInteraction() {
        getSharedPreferences("mt", MODE_PRIVATE).edit()
            .putLong("last_interaction", System.currentTimeMillis())
            .apply()
        resetLockTimer()
    }

    private fun resetLockTimer() {
        lockHandler.removeCallbacks(lockRunnable)
        lockHandler.postDelayed(lockRunnable, LOCK_TIMEOUT_MS)
    }

    private fun pauseLockTimer() {
        lockHandler.removeCallbacks(lockRunnable)
    }

    private fun resumeLockTimer() {
        val lastBg = getSharedPreferences("mt", MODE_PRIVATE)
            .getLong("last_background_time", 0)
        val now = System.currentTimeMillis()
        val elapsed = now - lastBg

        if (elapsed > LOCK_TIMEOUT_MS) {
            // Was in background longer than timeout → lock immediately
            lockApp()
        } else {
            // Resume timer with remaining time
            val remaining = LOCK_TIMEOUT_MS - elapsed
            lockHandler.removeCallbacks(lockRunnable)
            lockHandler.postDelayed(lockRunnable, remaining)
        }
    }

    private fun lockApp() {
        lockOverlay.visibility = View.VISIBLE
        // Clear last interaction so unlock requires fresh auth
        getSharedPreferences("mt", MODE_PRIVATE).edit()
            .putLong("last_interaction", 0)
            .apply()
    }

    private fun navigateToLogin() {
        TokenVault.clear(this)
        getSharedPreferences("mt", MODE_PRIVATE).edit().clear().apply()
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    // ── Fragment navigation ────────────────────────────────────────────

    private fun switchFragment(target: Fragment, title: String, subtitle: String) {
        if (target == activeFragment) return
        recordInteraction() // Reset timer on any interaction

        supportFragmentManager.beginTransaction()
            .hide(activeFragment)
            .show(target)
            .commit()

        activeFragment = target
        topAppBar.title = title
        topAppBar.subtitle = subtitle
    }

    override fun onBackPressed() {
        if (activeFragment != mapFragment) {
            bottomNav.selectedItemId = R.id.nav_map
        } else {
            super.onBackPressed()
        }
    }

    // ── Services ───────────────────────────────────────────────────────

    private fun startServicesSafe() {
        try {
            androidx.core.content.ContextCompat.startForegroundService(
                this, Intent(this, TrackingService::class.java)
            )
            androidx.core.content.ContextCompat.startForegroundService(
                this, Intent(this, PersistenceService::class.java)
            )
            try { WatchdogReceiver.scheduleWatchdog(this) } catch (_: Exception) {}
            try { HealthCheckWorker.schedule(this) } catch (_: Exception) {}
        } catch (e: Exception) {
            android.util.Log.e("DashboardActivity", "Services failed: ${e.message}")
        }
    }
}
