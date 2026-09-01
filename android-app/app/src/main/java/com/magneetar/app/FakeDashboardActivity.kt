package com.magneetar.app

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Fake Dashboard — appears when the duress PIN is entered.
 *
 * This looks exactly like the real dashboard but:
 * 1. Silently sends an emergency beacon to the server
 * 2. Records background audio (if permissions granted)
 * 3. Locks down remote administrative controls
 * 4. Sends current location to family circle
 * 5. Shows a "normal" family tracking view
 *
 * The attacker sees a normal family tracking app. They have no idea
 * the victim triggered an emergency signal.
 *
 * After 30 seconds, this activity closes and the real app locks.
 */
class FakeDashboardActivity : AppCompatActivity() {

    private val handler = Handler(Looper.getMainLooper())
    private val AUTO_CLOSE_MS = 30_000L // 30 seconds

    private val autoCloseRunnable = Runnable {
        // Lock the real app and close the fake dashboard
        val intent = Intent(this, DashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("force_lock", true)
        }
        startActivity(intent)
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Make this look like the real dashboard
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Trigger duress mode silently
        SecurityManager.triggerDuressMode(this)

        // Show a fake family tracking dashboard
        setContentView(R.layout.activity_fake_dashboard)

        // Auto-close after 30 seconds
        handler.postDelayed(autoCloseRunnable, AUTO_CLOSE_MS)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(autoCloseRunnable)
    }

    override fun onBackPressed() {
        // Don't allow back — the attacker shouldn't navigate away
        // Just let the auto-close handle it
    }
}
