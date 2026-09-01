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
 * Premium sign-up screen — Opay-style flow.
 * Server URL is hardcoded in BuildConfig; never shown to the user.
 *
 * Architecture:
 * - Shared OkHttpClient (connection pool reused)
 * - Proper coroutine scope with SupervisorJob
 * - Password validation matches server-side rules
 * - After signup, navigates to sign-in (pre-filled email)
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

    // Shared HTTP client
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

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

                val response = httpClient.newCall(
                    okhttp3.Request.Builder()
                        .url("$serverUrl/api/auth/register")
                        .post(json.toString().toRequestBody("application/json".toMediaType()))
                        .build()
                ).execute()

                val body = response.body?.string()

                if (response.isSuccessful && body != null) {
                    // Account created → navigate to sign-in with pre-filled email
                    withContext(Dispatchers.Main) {
                        val intent = Intent(this@SignUpActivity, SignInActivity::class.java)
                        intent.putExtra("email", email)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        startActivity(intent)
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
}
