package com.magneetar.app

import android.Manifest
import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.result.ActivityResultLauncher
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat

/**
 * Contextual Permission Helper — requests permissions WHEN features need them.
 *
 * This is how Opay, Kuda, and Life360 work:
 * - Don't show a wall of permissions upfront
 * - Request location when user enables tracking
 * - Request camera when user tries to capture evidence
 * - Request Device Admin when user enables anti-theft
 *
 * Each permission request has clear context explaining WHY it's needed.
 */
object PermissionHelper {

    private const val TAG = "PermissionHelper"

    // ── Permission Check Functions ─────────────────────────────────────

    fun hasLocation(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED

    fun hasBackgroundLocation(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_BACKGROUND_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasCamera(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED

    fun hasMic(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED

    fun hasNotifications(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
    }

    fun hasSms(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) ==
                PackageManager.PERMISSION_GRANTED
    }

    fun isDeviceAdmin(context: Context): Boolean {
        val adminComponent = ComponentName(context, AdminReceiver::class.java)
        return try {
            val pm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            pm.isAdminActive(adminComponent)
        } catch (e: Exception) { false }
    }

    fun isDeviceAdminAvailable(context: Context): Boolean {
        val adminComponent = ComponentName(context, AdminReceiver::class.java)
        return try {
            context.packageManager.getReceiverInfo(adminComponent, 0) != null
        } catch (e: Exception) { false }
    }

    fun isBatteryOptimized(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        return try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            pm.isIgnoringBatteryOptimizations(context.packageName)
        } catch (e: Exception) { true }
    }

    // ── Contextual Permission Requests ─────────────────────────────────

    /**
     * Request location permission when user enables device tracking.
     * Shows a clear explanation of WHY location is needed.
     */
    fun requestLocationPermission(
        activity: Activity,
        launcher: ActivityResultLauncher<Array<String>>
    ) {
        if (hasLocation(activity)) {
            // Already granted, check background if needed
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !hasBackgroundLocation(activity)) {
                requestBackgroundLocation(activity, launcher)
            }
            return
        }

        AlertDialog.Builder(activity)
            .setTitle("Enable Location Tracking")
            .setMessage(
                "Magneetar needs your device location to:\n\n" +
                "• Show your device on the map\n" +
                "• Track movement if stolen\n" +
                "• Trigger alerts when leaving safe zones\n\n" +
                "Your location is only shared with your account."
            )
            .setPositiveButton("Allow") { _, _ ->
                launcher.launch(arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ))
            }
            .setNegativeButton("Not Now", null)
            .show()
    }

    /**
     * Request background location separately (required on Android 11+).
     */
    fun requestBackgroundLocation(
        activity: Activity,
        launcher: ActivityResultLauncher<Array<String>>
    ) {
        AlertDialog.Builder(activity)
            .setTitle("Background Location Access")
            .setMessage(
                "To protect your device when it's stolen, Magneetar needs " +
                "to track location even when the app is closed.\n\n" +
                "This is used ONLY for:\n" +
                "• Theft recovery tracking\n" +
                "• Safe zone alerts\n" +
                "• Evidence capture location\n\n" +
                "You can disable this anytime in Settings."
            )
            .setPositiveButton("Allow All The Time") { _, _ ->
                launcher.launch(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
            }
            .setNegativeButton("Not Now", null)
            .show()
    }

    /**
     * Request camera permission when user tries to capture evidence.
     */
    fun requestCameraPermission(
        activity: Activity,
        launcher: ActivityResultLauncher<String>
    ) {
        if (hasCamera(activity)) return

        AlertDialog.Builder(activity)
            .setTitle("Camera Access")
            .setMessage(
                "Magneetar needs camera access to:\n\n" +
                "• Capture photos when your device is stolen\n" +
                "• Take evidence photos remotely\n" +
                "• Record intruder selfies\n\n" +
                "Photos are encrypted and stored securely."
            )
            .setPositiveButton("Allow") { _, _ ->
                launcher.launch(Manifest.permission.CAMERA)
            }
            .setNegativeButton("Not Now", null)
            .show()
    }

    /**
     * Request microphone permission when user enables audio capture.
     */
    fun requestMicPermission(
        activity: Activity,
        launcher: ActivityResultLauncher<String>
    ) {
        if (hasMic(activity)) return

        AlertDialog.Builder(activity)
            .setTitle("Microphone Access")
            .setMessage(
                "Magneetar needs microphone access to:\n\n" +
                "• Record audio when your device is stolen\n" +
                "• Capture ambient sounds remotely\n" +
                "• Evidence collection for recovery\n\n" +
                "Audio is encrypted and stored securely."
            )
            .setPositiveButton("Allow") { _, _ ->
                launcher.launch(Manifest.permission.RECORD_AUDIO)
            }
            .setNegativeButton("Not Now", null)
            .show()
    }

    /**
     * Request notification permission (Android 13+).
     */
    fun requestNotificationPermission(
        activity: Activity,
        launcher: ActivityResultLauncher<String>
    ) {
        if (hasNotifications(activity)) return

        AlertDialog.Builder(activity)
            .setTitle("Notifications")
            .setMessage(
                "Magneetar needs notifications to alert you when:\n\n" +
                "• Your device is stolen\n" +
                "• SIM card is changed\n" +
                "• Device leaves a safe zone\n" +
                "• Battery is low\n\n" +
                "You can customize which alerts you receive."
            )
            .setPositiveButton("Allow") { _, _ ->
                launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            .setNegativeButton("Not Now", null)
            .show()
    }

    /**
     * Request Device Admin when user enables anti-theft features.
     * This is the CRITICAL fix — the old code had Samsung callback bugs.
     */
    fun requestDeviceAdmin(
        activity: Activity,
        launcher: ActivityResultLauncher<Intent>
    ) {
        if (!isDeviceAdminAvailable(activity)) return
        if (isDeviceAdmin(activity)) return

        val adminComponent = ComponentName(activity, AdminReceiver::class.java)
        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
            putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
            putExtra(
                DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "Magneetar needs Device Admin to:\n" +
                "• Remotely lock your stolen phone\n" +
                "• Sound the alarm remotely\n" +
                "• Prevent the app from being uninstalled\n" +
                "• Factory reset as last resort"
            )
        }
        launcher.launch(intent)
    }

    /**
     * Request battery optimization exemption.
     */
    fun requestBatteryOptimization(activity: Activity) {
        if (isBatteryOptimized(activity)) return

        AlertDialog.Builder(activity)
            .setTitle("Battery Optimization")
            .setMessage(
                "Magneetar needs to run in the background to protect your device.\n\n" +
                "Without this, Android may stop Magneetar when your phone is " +
                "locked, making it unable to:\n" +
                "• Track your device\n" +
                "• Respond to remote commands\n" +
                "• Send theft alerts\n\n" +
                "Allow Magneetar to run without battery restrictions?"
            )
            .setPositiveButton("Allow") { _, _ ->
                val batteryIntent = Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                ).apply {
                    data = Uri.parse("package:${activity.packageName}")
                }
                activity.startActivity(batteryIntent)
            }
            .setNegativeButton("Not Now", null)
            .show()
    }

    /**
     * Check if all core permissions are granted.
     */
    fun hasCorePermissions(context: Context): Boolean {
        return hasLocation(context) &&
                hasCamera(context) &&
                hasMic(context) &&
                hasNotifications(context)
    }

    /**
     * Get list of missing core permissions.
     */
    fun getMissingPermissions(context: Context): List<String> {
        val missing = mutableListOf<String>()
        if (!hasLocation(context)) missing.add("Location")
        if (!hasCamera(context)) missing.add("Camera")
        if (!hasMic(context)) missing.add("Microphone")
        if (!hasNotifications(context)) missing.add("Notifications")
        return missing
    }
}
