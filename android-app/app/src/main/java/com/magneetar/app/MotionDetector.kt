package com.magneetar.app

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import kotlin.math.sqrt

/**
 * Motion detector for phone snatch scenarios.
 *
 * Uses the accelerometer to detect:
 * 1. Sudden high-velocity jerk (phone being grabbed/snatched)
 * 2. Rapid acceleration (running with the phone)
 *
 * When both conditions are met within a short window, the app:
 * - Force-locks the phone screen
 * - Sends emergency beacon with current location
 * - Starts recording audio
 * - Sends coordinates to family circle
 *
 * This is the "PalmPay-style" snatch protection.
 */
class MotionDetector(context: Context) : SensorEventListener {

    private companion object {
        const val TAG = "MotionDetector"

        /** Acceleration threshold for snatch detection (m/s²) */
        const val SNATCH_THRESHOLD = 25.0f

        /** Threshold for running detection (m/s²) */
        const val RUNNING_THRESHOLD = 15.0f

        /** Time window to detect running after snatch (ms) */
        const val POST_SNATCH_WINDOW_MS = 5_000L

        /** Cooldown between detections (ms) */
        const val DETECTION_COOLDOWN_MS = 30_000L

        /** Number of consecutive high-acceleration readings to confirm running */
        const val RUNNING_CONFIRM_COUNT = 3
    }

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private var lastX = 0f
    private var lastY = 0f
    private var lastZ = 0f
    private var snatchDetectedAt = 0L
    private var runningCount = 0
    private var lastDetectionTime = 0L
    private var isListening = false

    private var onSnatchDetected: (() -> Unit)? = null

    /**
     * Start listening for motion events.
     */
    fun start(onSnatch: () -> Unit) {
        onSnatchDetected = onSnatch
        if (accelerometer != null && !isListening) {
            sensorManager.registerListener(
                this,
                accelerometer,
                SensorManager.SENSOR_DELAY_UI
            )
            isListening = true
            Log.i(TAG, "Motion detection started")
        }
    }

    /**
     * Stop listening for motion events.
     */
    fun stop() {
        if (isListening) {
            sensorManager.unregisterListener(this)
            isListening = false
            Log.i(TAG, "Motion detection stopped")
        }
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return

        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        // Calculate acceleration delta (jerk)
        val deltaX = Math.abs(x - lastX)
        val deltaY = Math.abs(y - lastY)
        val deltaZ = Math.abs(z - lastZ)
        val delta = sqrt((deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ))

        lastX = x
        lastY = y
        lastZ = z

        val now = System.currentTimeMillis()

        // Cooldown check
        if (now - lastDetectionTime < DETECTION_COOLDOWN_MS) return

        // Phase 1: Detect sudden jerk (snatch)
        if (snatchDetectedAt == 0L && delta > SNATCH_THRESHOLD) {
            snatchDetectedAt = now
            Log.w(TAG, "Potential snatch detected — delta=$delta, monitoring for running...")
            return
        }

        // Phase 2: Detect running after snatch
        if (snatchDetectedAt > 0 && now - snatchDetectedAt < POST_SNATCH_WINDOW_MS) {
            val magnitude = sqrt((x * x + y * y + z * z))

            if (magnitude > RUNNING_THRESHOLD) {
                runningCount++
                if (runningCount >= RUNNING_CONFIRM_COUNT) {
                    // CONFIRMED: Snatch + Running = Phone theft in progress
                    Log.w(TAG, "SNATCH + RUNNING CONFIRMED — triggering emergency response")
                    lastDetectionTime = now
                    snatchDetectedAt = 0L
                    runningCount = 0
                    onSnatchDetected?.invoke()
                    return
                }
            } else {
                runningCount = 0
            }
        } else if (snatchDetectedAt > 0) {
            // Window expired without running — false alarm
            snatchDetectedAt = 0L
            runningCount = 0
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
