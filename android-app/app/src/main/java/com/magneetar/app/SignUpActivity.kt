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
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Premium sign-up screen — Opay-style flow.
 * Server URL is hardcoded in BuildConfig; never shown to the user.
 */
class SignUpActivity : AppCompatActivity() {

    private lateinit var etName: EditText
    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var etConfirmPassword: EditText
    private lateinit var tvError: TextView
    private lateinit var btnSignUp: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var btnBack: View

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_signup)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false

        etName = findViewById(R.id.et_name)
        etEmail = findViewById(R.id.et_email)
        etPassword = findViewById(R.id.et_password)
        etConfirmPassword = findViewById(R.id.et_confirm_password)
        tvError = findViewById(R.id.tv_error)
        btnSignUp = findViewById(R.id.btn_signup)
        progressBar = findViewById(R.id.progress_bar)
        btnBack = findViewById(R.id.btn_back)

        btnBack.setOnClickListener { finish() }

        findViewById<TextView>(R.id.tv_signin_link).setOnClickListener {
            startActivity(Intent(this, SignInActivity::class.java))
            finish()
        }

        btnSignUp.setOnClickListener { attemptSignUp() }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    private fun attemptSignUp() {
        val name = etName.text.toString().trim()
        val email = etEmail.text.toString().trim()
        val password = etPassword.text.toString()
        val confirm = etConfirmPassword.text.toString()

        // Validation
        if (name.isEmpty()) {
            showError("Enter your name")
            etName.requestFocus()
            return
        }
        if (name.length < 2) {
            showError("Name must be at least 2 characters")
            etName.requestFocus()
            return
        }
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
        if (password.length < 8) {
            showError("Password must be at least 8 characters")
            etPassword.requestFocus()
            return
        }
        if (!password.any { it.isUpperCase() }) {
            showError("Password must contain an uppercase letter")
            etPassword.requestFocus()
            return
        }
        if (!password.any { it.isLowerCase() }) {
            showError("Password must contain a lowercase letter")
            etPassword.requestFocus()
            return
        }
        if (!password.any { it.isDigit() }) {
            showError("Password must contain a number")
            etPassword.requestFocus()
            return
        }
        if (password != confirm) {
            showError("Passwords do not match")
            etConfirmPassword.requestFocus()
            return
        }

        hideError()
        setLoading(true)

        scope.launch {
            try {
                val serverUrl = BuildConfig.SERVER_URL
                val json = org.json.JSONObject().apply {
                    put("full_name", name)
                    put("email", email)
                    put("password", password)
                }

                val client = buildHttpClient()
                val response = client.newCall(
                    okhttp3.Request.Builder()
                        .url("$serverUrl/api/auth/user/register")
                        .post(json.toString().toRequestBody("application/json".toMediaTypeOrNull()!!))
                        .addHeader("Content-Type", "application/json")
                        .build()
                ).execute()
                val body = response.body?.string()

                if (response.isSuccessful && body != null) {
                    val jsonResponse = org.json.JSONObject(body)
                    val token = jsonResponse.getString("token")
                    val refreshToken = jsonResponse.optString("refresh_token", "")

                    with(getSharedPreferences("mt", MODE_PRIVATE).edit()) {
                        putString("server_url", serverUrl)
                        putString("user_email", email)
                        putString("user_name", name)
                        putString("auth_method", "user")
                        apply()
                    }
                    TokenVault.save(this@SignUpActivity, token, refreshToken)
                    TokenVault.startSession(this@SignUpActivity)

                    // Mark onboarding as complete
                    with(getSharedPreferences("mt", MODE_PRIVATE).edit()) {
                        putBoolean("onboarding_complete", true)
                        apply()
                    }

                    // Link device and start services
                    scope.launch { DeviceLinker.linkToAccount(this@SignUpActivity, serverUrl, token) }
                    startServicesSafe()

                    withContext(Dispatchers.Main) {
                        startActivity(Intent(this@SignUpActivity, DashboardActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        })
                        finish()
                    }
                } else {
                    val errorMsg = parseError(body, response.code)
                    withContext(Dispatchers.Main) { showError(errorMsg) }
                }
            } catch (e: Throwable) {
                val msg = when {
                    e.message?.contains("timeout", true) == true -> "Connection timed out"
                    e.message?.contains("resolve", true) == true -> "Cannot reach server"
                    e.message?.contains("connect", true) == true -> "No internet connection"
                    else -> "Registration failed. Try again."
                }
                withContext(Dispatchers.Main) { showError(msg) }
            } finally {
                withContext(Dispatchers.Main) { setLoading(false) }
            }
        }
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

    private fun hideError() { tvError.visibility = View.GONE }

    private fun setLoading(loading: Boolean) {
        btnSignUp.isEnabled = !loading
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnSignUp.text = if (loading) "" else "CREATE ACCOUNT"
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

    private fun buildHttpClient(): okhttp3.OkHttpClient =
        okhttp3.OkHttpClient.Builder()
            .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .build()
}
