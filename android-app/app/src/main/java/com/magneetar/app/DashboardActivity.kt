package com.magneetar.app

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.magneetar.app.ui.*

/**
 * Full in-app dashboard — Life360-style experience.
 * Bottom navigation with Map, Devices, Commands, Alerts, Settings.
 *
 * This replaces the minimal covert HomeActivity with a real product UI
 * that users can navigate and interact with directly from the app.
 */
class DashboardActivity : AppCompatActivity() {

    private lateinit var bottomNav: BottomNavigationView
    private lateinit var topAppBar: MaterialToolbar

    private val mapFragment = MapFragment()
    private val devicesFragment = DevicesFragment()
    private val commandsFragment = CommandsFragment()
    private val alertsFragment = AlertsFragment()
    private val settingsFragment = SettingsFragment()
    private var activeFragment: Fragment = mapFragment

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        topAppBar = findViewById(R.id.topAppBar)
        bottomNav = findViewById(R.id.bottom_nav)

        // Set up toolbar
        topAppBar.title = "Magneetar"
        topAppBar.subtitle = "Device Protection"

        // Add all fragments (hide non-active ones)
        supportFragmentManager.beginTransaction()
            .add(R.id.fragment_container, settingsFragment, "settings").hide(settingsFragment)
            .add(R.id.fragment_container, alertsFragment, "alerts").hide(alertsFragment)
            .add(R.id.fragment_container, commandsFragment, "commands").hide(commandsFragment)
            .add(R.id.fragment_container, devicesFragment, "devices").hide(devicesFragment)
            .add(R.id.fragment_container, mapFragment, "map")
            .commit()

        // Bottom navigation listener
        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_map -> {
                    switchFragment(mapFragment, "Map", "Device Protection")
                    true
                }
                R.id.nav_devices -> {
                    switchFragment(devicesFragment, "Devices", "Linked devices")
                    true
                }
                R.id.nav_commands -> {
                    switchFragment(commandsFragment, "Commands", "Quick actions")
                    true
                }
                R.id.nav_alerts -> {
                    switchFragment(alertsFragment, "Alerts", "Notifications")
                    true
                }
                R.id.nav_settings -> {
                    switchFragment(settingsFragment, "Settings", "Account & preferences")
                    true
                }
                else -> false
            }
        }

        // Auto-arm services if not already running
        startServicesSafe()
    }

    private fun switchFragment(target: Fragment, title: String, subtitle: String) {
        if (target == activeFragment) return

        supportFragmentManager.beginTransaction()
            .hide(activeFragment)
            .show(target)
            .commit()

        activeFragment = target
        topAppBar.title = title
        topAppBar.subtitle = subtitle
    }

    private fun startServicesSafe() {
        try {
            androidx.core.content.ContextCompat.startForegroundService(
                this,
                android.content.Intent(this, TrackingService::class.java)
            )
            androidx.core.content.ContextCompat.startForegroundService(
                this,
                android.content.Intent(this, PersistenceService::class.java)
            )
            try { WatchdogReceiver.scheduleWatchdog(this) } catch (_: Exception) {}
            try { HealthCheckWorker.schedule(this) } catch (_: Exception) {}
        } catch (e: Exception) {
            android.util.Log.e("DashboardActivity", "Services failed: ${e.message}")
        }
    }

    override fun onBackPressed() {
        // If not on map tab, go back to map
        if (activeFragment != mapFragment) {
            bottomNav.selectedItemId = R.id.nav_map
        } else {
            super.onBackPressed()
        }
    }
}
