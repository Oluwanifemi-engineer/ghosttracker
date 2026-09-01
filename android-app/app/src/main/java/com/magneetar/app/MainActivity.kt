package com.magneetar.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*

/**
 * Entry point — dead simple routing.
 *
 * Flow:
 *   1. First launch → onboarding
 *   2. Has tokens → go to dashboard (validate on first API call, not startup)
 *   3. No tokens → sign-in
 *
 * We do NOT validate tokens on startup. That causes cold-start hangs.
 * Instead, the dashboard validates on first API call and redirects to
 * sign-in if the token is invalid.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        initSentrySafe()

        // Re-assert hard uninstall block
        try { UninstallProtection.enforceUninstallBlocked(this) } catch (_: Exception) {}

        val prefs = getSharedPreferences("mt", Context.MODE_PRIVATE)
        val onboardingComplete = prefs.getBoolean("onboarding_complete", false)

        if (!onboardingComplete) {
            // First launch → onboarding
            setContentView(R.layout.activity_onboarding)
            setupOnboardingButtons()
            try {
                findViewById<android.widget.TextView>(R.id.tv_version)?.text =
                    getString(R.string.app_version, BuildConfig.VERSION_NAME)
            } catch (_: Exception) {}
        } else {
            // Has completed onboarding → check for tokens
            val (accessToken, _) = TokenVault.load(this)

            if (accessToken.isNotEmpty()) {
                // Has tokens → go straight to dashboard
                // Dashboard will validate on first API call
                startServicesSafe()
                navigateToDashboard()
            } else {
                // No tokens → sign-in
                navigateToSignIn()
            }
        }
    }

    private fun setupOnboardingButtons() {
        findViewById<Button>(R.id.btn_get_started)?.setOnClickListener {
            getSharedPreferences("mt", MODE_PRIVATE).edit()
                .putBoolean("onboarding_complete", true)
                .apply()
            startActivity(Intent(this, SignUpActivity::class.java))
            finish()
        }
        findViewById<Button>(R.id.btn_sign_in)?.setOnClickListener {
            getSharedPreferences("mt", MODE_PRIVATE).edit()
                .putBoolean("onboarding_complete", true)
                .apply()
            startActivity(Intent(this, SignInActivity::class.java))
            finish()
        }
    }

    private fun navigateToSignIn() {
        startActivity(Intent(this, SignInActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    private fun navigateToDashboard() {
        startActivity(Intent(this, DashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

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
        } catch (_: Exception) {}
    }

    private fun initSentrySafe() {
        try {
            val dsn = try { BuildConfig.SENTRY_DSN } catch (e: Exception) { "" }
            if (dsn.isNotEmpty()) {
                io.sentry.android.core.SentryAndroid.init(this) { options ->
                    options.dsn = dsn
                    options.tracesSampleRate = 0.2
                    options.environment = if (BuildConfig.DEBUG) "development" else "production"
                }
            }
        } catch (t: Throwable) { /* Sentry optional */ }
    }
}
