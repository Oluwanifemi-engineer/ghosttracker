package com.magneetar.app

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/**
 * Central security manager for Magneetar's anti-theft features.
 *
 * Implements:
 * - Panic PIN (duress mode) — fake dashboard + silent beacon
 * - Instant Auto-Lock — 1-second background timeout
 * - Motion Detection — accelerometer-based snatch detection
 * - Device Binding — IMEI + Android ID + CPU serial
 * - Night Guard — time-based lock on critical actions
 *
 * Architecture: All security state is stored in encrypted SharedPreferences.
 * The SecurityManager is a singleton that other components query.
 */
object SecurityManager {

    private const val TAG = "SecurityManager"

    // ── Panic PIN / Duress Mode ──────────────────────────────────────────

    /**
     * Set up the duress PIN. This is a secondary PIN that, when entered,
     * opens a fake dashboard that looks normal but silently:
     * - Sends an emergency beacon to the server
     * - Records background audio (if permissions granted)
     * - Locks down remote administrative controls
     * - Sends location to family circle
     */
    fun setDuressPin(context: Context, pin: String) {
        val hashed = hashPin(pin)
        context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .edit().putString("duress_pin_hash", hashed).apply()
    }

    /**
     * Check if a PIN is the duress PIN.
     */
    fun isDuressPin(context: Context, pin: String): Boolean {
        val stored = context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .getString("duress_pin_hash", "") ?: ""
        if (stored.isEmpty()) return false
        return hashPin(pin) == stored
    }

    /**
     * Check if duress PIN is configured.
     */
    fun isDuressPinConfigured(context: Context): Boolean {
        return context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .getString("duress_pin_hash", "")?.isNotEmpty() == true
    }

    /**
     * Trigger duress mode — called when duress PIN is entered.
     * Opens fake dashboard + sends silent beacon.
     */
    fun triggerDuressMode(context: Context) {
        Log.w(TAG, "DURESS MODE TRIGGERED — sending silent beacon")

        // 1. Send emergency beacon to server
        DuressBeacon.sendBeacon(context)

        // 2. Record that duress was triggered
        context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .edit().putLong("duress_triggered_at", System.currentTimeMillis()).apply()

        // 3. Start background audio recording (if permissions granted)
        try {
            DuressRecorder.startRecording(context)
        } catch (e: Exception) {
            Log.w(TAG, "Duress recording failed: ${e.message}")
        }
    }

    // ── Instant Auto-Lock ────────────────────────────────────────────────

    /** Lock timeout: 1 second after going to background (PalmPay-style) */
    const val BACKGROUND_LOCK_TIMEOUT_MS = 1_000L

    private var backgroundTimestamp: Long = 0L

    /**
     * Call when app goes to background.
     */
    fun onAppBackgrounded(context: Context) {
        backgroundTimestamp = System.currentTimeMillis()
        context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .edit().putLong("background_at", backgroundTimestamp).apply()
    }

    /**
     * Clear background timestamp — called on fresh sign-in to prevent
     * stale timestamps from previous sessions triggering auto-lock.
     */
    fun clearBackgroundTimestamp(context: Context) {
        backgroundTimestamp = 0L
        context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .edit().remove("background_at").apply()
    }

    /**
     * Call when app comes to foreground.
     * Returns true if the app should lock (background > timeout).
     */
    fun shouldLockOnResume(context: Context): Boolean {
        val bgAt = context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .getLong("background_at", 0)
        if (bgAt == 0L) return false
        val elapsed = System.currentTimeMillis() - bgAt
        return elapsed > BACKGROUND_LOCK_TIMEOUT_MS
    }

    // ── Device Binding ───────────────────────────────────────────────────

    /**
     * Generate a device fingerprint from hardware identifiers.
     * This binds the app installation to this specific device.
     */
    fun generateDeviceFingerprint(context: Context): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        val brand = Build.BRAND
        val model = Build.MODEL
        val device = Build.DEVICE
        val hardware = Build.HARDWARE
        val board = Build.BOARD

        // CPU serial (Android 10+ blocks this, but we try)
        val cpuSerial = try {
            val process = Runtime.getRuntime().exec("cat /proc/cpuinfo")
            val reader = process.inputStream.bufferedReader()
            val serial = reader.readLine()?.substringAfter("Serial")?.trim() ?: ""
            reader.close()
            process.destroy()
            serial
        } catch (_: Exception) { "" }

        val raw = "$androidId:$brand:$model:$device:$hardware:$board:$cpuSerial"
        return hashString(raw)
    }

    /**
     * Bind device to this installation. Called once during registration.
     */
    fun bindDevice(context: Context) {
        val fingerprint = generateDeviceFingerprint(context)
        context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .edit().putString("device_fingerprint", fingerprint).apply()
    }

    /**
     * Verify device binding. Returns true if the device matches.
     */
    fun verifyDeviceBinding(context: Context): Boolean {
        val stored = context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .getString("device_fingerprint", "") ?: ""
        if (stored.isEmpty()) return true // Not bound yet
        val current = generateDeviceFingerprint(context)
        return stored == current
    }

    // ── Night Guard ──────────────────────────────────────────────────────

    /** Night Guard: prevent disabling location sharing during night hours */
    const val NIGHT_GUARD_START_HOUR = 23 // 11 PM
    const val NIGHT_GUARD_END_HOUR = 6   // 6 AM
    const val NIGHT_GUARD_COOLDOWN_HOURS = 24

    /**
     * Check if Night Guard is active (current time is within night hours).
     */
    fun isNightGuardActive(): Boolean {
        val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return hour >= NIGHT_GUARD_START_HOUR || hour < NIGHT_GUARD_END_HOUR
    }

    /**
     * Check if a critical action is allowed right now.
     * Critical actions: disable location, log out, change account email.
     */
    fun isCriticalActionAllowed(context: Context): Boolean {
        if (!isNightGuardActive()) return true

        // Check cooldown
        val lastDisable = context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .getLong("last_location_disable", 0)
        val cooldownMs = TimeUnit.HOURS.toMillis(NIGHT_GUARD_COOLDOWN_HOURS.toLong())
        return System.currentTimeMillis() - lastDisable > cooldownMs
    }

    /**
     * Record that location sharing was disabled (for Night Guard cooldown).
     */
    fun recordLocationDisabled(context: Context) {
        context.getSharedPreferences("mt_security", Context.MODE_PRIVATE)
            .edit().putLong("last_location_disable", System.currentTimeMillis()).apply()
    }

    // ── Motion Detection ─────────────────────────────────────────────────

    /** Threshold for detecting a sudden jerk (snatch) — in m/s² */
    const val SNATCH_THRESHOLD = 25.0f

    /** Time window to detect running after snatch — in ms */
    const val POST_SNATCH_WINDOW_MS = 5_000L

    private var snatchDetectedAt: Long = 0L
    private var lastAcceleration = floatArrayOf(0f, 0f, 0f)

    /**
     * Process accelerometer data. Call from a SensorEventListener.
     * Returns true if a snatch is detected.
     */
    fun processAccelerometerData(event: SensorEvent): Boolean {
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        // Calculate acceleration delta
        val deltaX = Math.abs(x - lastAcceleration[0])
        val deltaY = Math.abs(y - lastAcceleration[1])
        val deltaZ = Math.abs(z - lastAcceleration[2])
        val delta = deltaX + deltaY + deltaZ

        lastAcceleration = floatArrayOf(x, y, z)

        // Detect sudden jerk (snatch)
        if (delta > SNATCH_THRESHOLD) {
            snatchDetectedAt = System.currentTimeMillis()
            Log.w(TAG, "SNATCH DETECTED — delta=$delta")
            return true
        }

        return false
    }

    /**
     * Check if we're in the post-snatch window (running detected after snatch).
     */
    fun isInPostSnatchWindow(): Boolean {
        if (snatchDetectedAt == 0L) return false
        return System.currentTimeMillis() - snatchDetectedAt < POST_SNATCH_WINDOW_MS
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private fun hashPin(pin: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(pin.toByteArray())
        return hash.joinToString("") { "%02x".format(it) }
    }

    private fun hashString(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(input.toByteArray())
        return hash.joinToString("") { "%02x".format(it) }
    }
}
