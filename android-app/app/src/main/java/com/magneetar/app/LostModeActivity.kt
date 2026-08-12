package com.magneetar.app

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Full-screen Lost Mode lock (v1.5). Launched from the LostModeManager
 * notification (a tap is a user action — exempt from background-activity
 * limits) or directly when the app is foreground. The manifest declares
 * showWhenLocked + turnScreenOn + excludeFromRecents, so the recovery message
 * is visible even on a locked screen and never appears in recents.
 *
 * Security: the finder can CALL the owner in one tap (ACTION_DIAL — no call
 * permission needed), but CANNOT dismiss lost mode: exiting requires the
 * owner's pairing code (first 8 hex of SHA-256(device_key), shown in the
 * Magneetar app's Home screen). A thief holding the phone cannot clear it.
 * Ancient installs without a stored device key fall back to unauthenticated
 * exit (documented edge case).
 */
class LostModeActivity : Activity() {

    companion object {
        const val EXTRA_MESSAGE = "lost_mode_message"
        const val EXTRA_PHONE = "lost_mode_phone"
    }

    private lateinit var pairingInput: EditText
    private lateinit var pairingError: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val message = intent?.getStringExtra(EXTRA_MESSAGE) ?: LostModeParams.DEFAULT_MESSAGE
        val phone = intent?.getStringExtra(EXTRA_PHONE)

        // Programmatic covert-styled layout (the app's design system is
        // code-built, not XML-resource driven).
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
            setBackgroundColor(Color.parseColor("#0B0B12"))
        }

        root.addView(TextView(this).apply {
            text = "📵"
            textSize = 56f
            gravity = Gravity.CENTER
        })

        root.addView(TextView(this).apply {
            text = "This device is in Lost Mode"
            textSize = 22f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 8)
        })

        root.addView(TextView(this).apply {
            text = message
            textSize = 16f
            setTextColor(Color.parseColor("#C9C9D6"))
            gravity = Gravity.CENTER
            setPadding(0, 8, 0, 32)
        })

        if (phone != null) {
            root.addView(Button(this).apply {
                text = "Call owner: $phone"
                setOnClickListener {
                    startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                }
            })
        }

        // ── Pairing-code-gated exit ───────────────────────────────────────
        // The pairing code is the first 8 hex chars of SHA-256(device_key) —
        // shown in the Magneetar app (Home → pairing code). Only someone who
        // can read the owner's app (i.e. the owner) can dismiss lost mode.
        root.addView(TextView(this).apply {
            text = "This is my phone — enter the pairing code from the Magneetar app"
            textSize = 13f
            setTextColor(Color.parseColor("#8B8B9E"))
            gravity = Gravity.CENTER
            setPadding(0, 36, 0, 6)
        })

        pairingInput = EditText(this).apply {
            hint = "Pairing code (8 characters)"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.parseColor("#5A5A6E"))
            gravity = Gravity.CENTER
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
        }

        root.addView(pairingInput)

        pairingError = TextView(this).apply {
            textSize = 12f
            setTextColor(Color.parseColor("#FF6B6B"))
            gravity = Gravity.CENTER
            visibility = android.view.View.GONE
            setPadding(0, 8, 0, 0)
        }

        root.addView(Button(this).apply {
            text = "Exit Lost Mode"
            setOnClickListener { attemptExit() }
        })
        root.addView(pairingError)

        setContentView(root)
    }

    private fun attemptExit() {
        // Ancient install without a stored device key → allow (documented).
        val prefs = getSharedPreferences("mt", MODE_PRIVATE)
        val deviceKey = prefs.getString("device_key", null)
        if (deviceKey.isNullOrEmpty()) {
            LostModeManager.exit(this)
            finish()
            return
        }
        val entered = pairingInput.text?.toString()?.trim()?.lowercase() ?: ""
        if (entered == PairingCode.of(deviceKey)) {
            LostModeManager.exit(this)
            finish()
        } else {
            pairingError.text = "Incorrect code — it's shown in the Magneetar app (Home → pairing code)."
            pairingError.visibility = android.view.View.VISIBLE
        }
    }
}
