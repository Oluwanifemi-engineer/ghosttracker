package com.magneetar.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Bomb-proof entry point — synchronous routing in onCreate.
 *
 * Flow:
 *   1. First launch → onboarding
 *   2. Has token → validate against server → dashboard or sign-in
 *   3. No token → sign-in
 *
 * Opay-style: every app open requires authentication. No silent bypass.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Safe Sentry init (optional, never crashes)
        initSentrySafe()

        val prefs = getSharedPreferences("mt", Context.MODE_PRIVATE)
        val onboardingComplete = prefs.getBoolean("onboarding_complete", false)

        // Re-assert hard uninstall block
        try { UninstallProtection.enforceUninstallBlocked(this) } catch (_: Exception) {}

        if (!onboardingComplete) {
            // First launch → onboarding
            setContentView(R.layout.activity_onboarding)
            setupOnboardingButtons()
            try {
                findViewById<android.widget.TextView>(R.id.tv_version)?.text =
                    getString(R.string.app_version, BuildConfig.VERSION_NAME)
            } catch (_: Exception) {}
        } else {
            // Onboarding done → must sign in
            // Never auto-bypass auth. The user must authenticate every session.
            // Token expiry is handled by DashboardActivity's 2-minute timeout.
            startActivity(Intent(this, SignInActivity::class.java))
            finish()
        }
    }

    private fun setupOnboardingButtons() {
        findViewById<Button>(R.id.btn_get_started)?.setOnClickListener {
            // Mark onboarding as seen, then go to signup
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
