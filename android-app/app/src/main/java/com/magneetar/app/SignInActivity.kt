package com.magneetar.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Premium sign-in screen — Opay-style flow.
 * Server URL is hardcoded in BuildConfig; never shown to the user.
 * Supports two-factor authentication (TOTP) as a second step.
 *
 * Architecture:
 * - Shared OkHttpClient (connection pool reused across requests)
 * - Proper coroutine scope with SupervisorJob (one failure doesn't cancel siblings)
 * - Token refresh on app restart (handled by MainActivity)
 * - Session tracking starts after successful login
 */
class SignInActivity : AppCompatActivity() {

    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var tvPasswordLabel: TextView
    private lateinit var tv2faLabel: TextView
    private lateinit var tv2faHint: TextView
    private lateinit var et2faCode: EditText
    private lateinit var tvError: TextView
    private lateinit var btnSignIn: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var btnBack: View

    private var twoFactorToken: String? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Shared HTTP client — connection pool reused across all requests
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_signin)

        // Premium: edge-to-edge with dark status bar
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false

        etEmail = findViewById(R.id.et_email)
        etPassword = findViewById(R.id.et_password)
        tvPasswordLabel = findViewById(R.id.tv_password_label)
        tv2faLabel = findViewById(R.id.tv_2fa_label)
        tv2faHint = findViewById(R.id.tv_2fa_hint)
        et2faCode = findViewById(R.id.et_2fa_code)
        tvError = findViewById(R.id.tv_error)
        btnSignIn = findViewById(R.id.btn_signin)
        progressBar = findViewById(R.id.progress_bar)
        btnBack = findViewById(R.id.btn_back)

        btnBack.setOnClickListener { finish() }

        // Ensure button starts enabled
        btnSignIn.isEnabled = true
        progressBar.visibility = View.GONE

        // Pre-fill email if coming from sign-up
        val prefilledEmail = intent.getStringExtra("email")
        if (prefilledEmail != null) {
            etEmail.setText(prefilledEmail)
            etPassword.requestFocus()
        }

        findViewById<TextView>(R.id.tv_signup_link).setOnClickListener {
            startActivity(Intent(this, SignUpActivity::class.java))
            finish()
        }

        btnSignIn.setOnClickListener {
            if (twoFactorToken != null) {
                attemptTwoFactorCode()
            } else {
                attemptSignIn()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    private fun attemptSignIn() {
        val email = etEmail.text.toString().trim()
        val password = etPassword.text.toString()

        // Validation
        if (email.isEmpty()) {
            showError("Enter your email")
            etEmail.requestFocus()
            return
        }
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            showError("Enter a valid email address")
            etEmail.requestFocus()
            return
        }
        if (password.isEmpty()) {
            showError("Enter your password")
            etPassword.requestFocus()
            return
        }

        // Check for duress PIN
        if (SecurityManager.isDuressPinConfigured(this) && SecurityManager.isDuressPin(this, password)) {
            // Duress PIN entered — show fake dashboard + send silent beacon
            SecurityManager.triggerDuressMode(this)
            startActivity(Intent(this, FakeDashboardActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
            finish()
            return
        }

        hideError()
        setLoading(true)

        scope.launch {
            try {
                val serverUrl = BuildConfig.SERVER_URL
                val json = org.json.JSONObject().apply {
                    put("email", email)
                    put("password", password)
                }

                val response = httpClient.newCall(
                    okhttp3.Request.Builder()
                        .url("$serverUrl/api/auth/user/login")
                        .post(json.toString().toRequestBody("application/json".toMediaType()))
                        .build()
                ).execute()

                val body = response.body?.string()
                val httpCode = response.code

                if (response.isSuccessful && body != null) {
                    val jsonResponse = org.json.JSONObject(body)

                    // Two-factor step
                    if (jsonResponse.optBoolean("requires_2fa") &&
                        jsonResponse.has("two_factor_token")
                    ) {
                        enterTwoFactorStep(email, jsonResponse.getString("two_factor_token"))
                        return@launch
                    }

                    val token = jsonResponse.getString("token")
                    val refreshToken = jsonResponse.optString("refresh_token", "")

                    // Save credentials
                    saveSession(email, token, refreshToken)

                    // Link device in background
                    scope.launch { DeviceLinker.linkToAccount(this@SignInActivity, serverUrl, token) }

                    // Start background services
                    startServicesSafe()

                    withContext(Dispatchers.Main) {
                        navigateToDashboard()
                    }
                } else {
                    val errorMsg = parseError(body, httpCode)
                    withContext(Dispatchers.Main) { showError(errorMsg) }
                }
            } catch (e: Throwable) {
                val msg = when {
                    e.message?.contains("timeout", true) == true -> "Connection timed out"
                    e.message?.contains("resolve", true) == true -> "Cannot reach server"
                    e.message?.contains("connect", true) == true -> "No internet connection"
                    else -> "Login failed. Try again."
                }
                withContext(Dispatchers.Main) { showError(msg) }
            } finally {
                withContext(Dispatchers.Main) { setLoading(false) }
            }
        }
    }

    private fun enterTwoFactorStep(email: String, challengeToken: String) {
        twoFactorToken = challengeToken
        with(getSharedPreferences("mt", MODE_PRIVATE).edit()) {
            putString("user_email", email)
            apply()
        }
        runOnUiThread {
            tvPasswordLabel.visibility = View.GONE
            etPassword.visibility = View.GONE
            tv2faLabel.visibility = View.VISIBLE
            tv2faHint.visibility = View.VISIBLE
            et2faCode.visibility = View.VISIBLE
            hideError()
            btnSignIn.text = "VERIFY"
            setLoading(false)
            et2faCode.requestFocus()
        }
    }

    private fun attemptTwoFactorCode() {
        val code = et2faCode.text.toString().trim()
        if (code.isEmpty() || code.length < 6) {
            showError("Enter the 6-digit code")
            return
        }

        val challengeToken = twoFactorToken ?: return
        val email = getSharedPreferences("mt", MODE_PRIVATE).getString("user_email", "") ?: return

        hideError()
        setLoading(true)

        scope.launch {
            try {
                val serverUrl = BuildConfig.SERVER_URL
                val json = org.json.JSONObject().apply {
                    put("email", email)
                    put("two_factor_token", challengeToken)
                    put("code", code)
                }

                val response = httpClient.newCall(
                    okhttp3.Request.Builder()
                        .url("$serverUrl/api/auth/user/login/2fa")
                        .post(json.toString().toRequestBody("application/json".toMediaType()))
                        .build()
                ).execute()

                val body = response.body?.string()

                if (response.isSuccessful && body != null) {
                    val jsonResponse = org.json.JSONObject(body)
                    val token = jsonResponse.getString("token")
                    val refreshToken = jsonResponse.optString("refresh_token", "")

                    saveSession(email, token, refreshToken)
                    startServicesSafe()

                    withContext(Dispatchers.Main) {
                        navigateToDashboard()
                    }
                } else {
                    val errorMsg = parseError(body, response.code)
                    withContext(Dispatchers.Main) { showError(errorMsg) }
                }
            } catch (e: Throwable) {
                withContext(Dispatchers.Main) { showError("Verification failed. Try again.") }
            } finally {
                withContext(Dispatchers.Main) { setLoading(false) }
            }
        }
    }

    private fun saveSession(email: String, token: String, refreshToken: String) {
        with(getSharedPreferences("mt", MODE_PRIVATE).edit()) {
            putString("server_url", BuildConfig.SERVER_URL)
            putString("user_email", email)
            putString("auth_method", "user")
            apply()
        }
        TokenVault.save(this@SignInActivity, token, refreshToken)
        TokenVault.startSession(this@SignInActivity)
    }

    private fun navigateToDashboard() {
        // Check if permissions need to be requested
        if (!PermissionHelper.hasLocation(this) || !PermissionHelper.hasNotifications(this)) {
            startActivity(Intent(this, PermissionsActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
        } else {
            startActivity(Intent(this, DashboardActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
        }
        finish()
    }

    private fun parseError(body: String?, httpCode: Int): String {
        if (body == null) return "Server error ($httpCode)"
        return try {
            val json = org.json.JSONObject(body)
            json.optString("detail", json.optString("message", "Error $httpCode"))
        } catch (_: Exception) {
            if (body.length > 100) "Error $httpCode" else body.ifEmpty { "Error $httpCode" }
        }
    }

    private fun showError(msg: String) {
        tvError.text = msg
        tvError.visibility = View.VISIBLE
    }

    private fun hideError() {
        tvError.visibility = View.GONE
    }

    private fun setLoading(loading: Boolean) {
        btnSignIn.isEnabled = !loading
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        if (loading) {
            btnSignIn.text = ""
        } else {
            btnSignIn.text = if (twoFactorToken != null) "VERIFY" else "SIGN IN"
        }
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
}
