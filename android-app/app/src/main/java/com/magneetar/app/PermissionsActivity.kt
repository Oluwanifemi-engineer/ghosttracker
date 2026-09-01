package com.magneetar.app

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Research-backed permission request flow.
 *
 * Architecture based on:
 * - Android official guidelines: "Ask in context, explain WHY, don't block"
 * - Life360: Location "all the time" + notifications + battery optimization
 * - Opay/Moniepoint: Step-by-step with clear rationale before each request
 * - UX research: "Pre-permission explanation → 60% higher grant rate"
 *
 * Order (by criticality for a tracking app):
 * 1. Location (foreground) — core feature, must have
 * 2. Background Location — theft recovery when app is closed
 * 3. Notifications — theft/SIM change alerts
 * 4. Device Admin — anti-uninstall, remote lock
 * 5. Battery Optimization — background survival
 * 6. Camera — evidence capture (optional, can skip)
 * 7. Microphone — audio evidence (optional, can skip)
 *
 * Each step:
 * 1. Shows rationale BEFORE the system dialog
 * 2. If denied permanently, offers Settings redirect
 * 3. If skipped, degrades gracefully (feature disabled)
 */
class PermissionsActivity : AppCompatActivity() {

    private lateinit var tvStepTitle: TextView
    private lateinit var tvStepDescription: TextView
    private lateinit var tvStepWhy: TextView
    private lateinit var ivStepIcon: ImageView
    private lateinit var btnAllow: Button
    private lateinit var btnSkip: Button
    private lateinit var progressSteps: ProgressBar
    private lateinit var tvStepCount: TextView
    private lateinit var layoutStatus: LinearLayout
    private lateinit var tvStatus: TextView
    private lateinit var layoutDenied: LinearLayout
    private lateinit var btnOpenSettings: Button

    private var currentStep = 0
    private val steps = mutableListOf<PermissionStep>()

    data class PermissionStep(
        val title: String,
        val description: String,
        val why: String,
        val iconRes: Int,
        val isGranted: () -> Boolean,
        val request: () -> Unit,
        val isCritical: Boolean = true
    )

    // ── Launchers ──────────────────────────────────────────────────────

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.values.any { it }
        if (granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            !PermissionHelper.hasBackgroundLocation(this)
        ) {
            // Foreground granted — now request background separately (Android 11+ requirement)
            showBackgroundLocationRationale()
        } else {
            onStepResult(granted)
        }
    }

    private val backgroundLocationLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        onStepResult(granted)
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        onStepResult(granted)
    }

    private val micPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        onStepResult(granted)
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        onStepResult(granted)
    }

    private val deviceAdminLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        onStepResult(PermissionHelper.isDeviceAdmin(this))
    }

    // ── Lifecycle ──────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_permissions)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false

        tvStepTitle = findViewById(R.id.tv_step_title)
        tvStepDescription = findViewById(R.id.tv_step_description)
        tvStepWhy = findViewById(R.id.tv_step_why)
        ivStepIcon = findViewById(R.id.iv_step_icon)
        btnAllow = findViewById(R.id.btn_allow)
        btnSkip = findViewById(R.id.btn_skip)
        progressSteps = findViewById(R.id.progress_steps)
        tvStepCount = findViewById(R.id.tv_step_count)
        layoutStatus = findViewById(R.id.layout_status)
        tvStatus = findViewById(R.id.tv_status)
        layoutDenied = findViewById(R.id.layout_denied)
        btnOpenSettings = findViewById(R.id.btn_open_settings)

        btnOpenSettings.setOnClickListener {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        }

        buildSteps()
        showCurrentStep()
    }

    override fun onResume() {
        super.onResume()
        // When returning from Settings, re-check current step
        if (steps.isNotEmpty() && currentStep < steps.size) {
            if (steps[currentStep].isGranted()) {
                onStepResult(true)
            }
        }
    }

    // ── Step Building ──────────────────────────────────────────────────

    private fun buildSteps() {
        steps.clear()

        // Step 1: Location (CRITICAL — core feature)
        steps.add(PermissionStep(
            title = "Location Access",
            description = "Magneetar uses your location to:\n\n" +
                "• Show your device on the map in real-time\n" +
                "• Track movement if your phone is stolen\n" +
                "• Alert you when your device leaves a safe zone",
            why = "Without location, Magneetar cannot track or recover your device.",
            iconRes = android.R.drawable.ic_menu_mylocation,
            isGranted = { PermissionHelper.hasLocation(this) },
            request = {
                if (shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) {
                    showRationaleDialog(
                        "Location is essential for Magneetar to work.",
                        "Your location data is encrypted and only visible to you. " +
                            "It's never shared with third parties."
                    ) {
                        locationPermissionLauncher.launch(arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        ))
                    }
                } else {
                    locationPermissionLauncher.launch(arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    ))
                }
            },
            isCritical = true
        ))

        // Step 2: Notifications (CRITICAL — theft alerts)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            steps.add(PermissionStep(
                title = "Notifications",
                description = "Magneetar sends alerts when:\n\n" +
                    "• Your device is stolen or goes offline\n" +
                    "• SIM card is changed by someone else\n" +
                    "• Your device leaves a safe zone\n" +
                    "• Battery is critically low",
                why = "Without notifications, you won't know when your device needs attention.",
                iconRes = android.R.drawable.ic_popup_reminder,
                isGranted = { PermissionHelper.hasNotifications(this) },
                request = {
                    if (shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                        showRationaleDialog(
                            "Notifications keep you informed about your device's safety.",
                            "You can customize which alerts you receive in Settings."
                        ) {
                            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    } else {
                        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                },
                isCritical = true
            ))
        }

        // Step 3: Device Admin (CRITICAL — anti-uninstall + remote lock)
        steps.add(PermissionStep(
            title = "Device Admin",
            description = "Device Admin protects your phone by:\n\n" +
                "• Preventing the app from being uninstalled\n" +
                "• Allowing remote lock if your phone is stolen\n" +
                "• Enabling remote alarm to find your phone\n" +
                "• Last resort: factory reset to protect your data",
            why = "Without Device Admin, a thief can simply uninstall Magneetar.",
            iconRes = android.R.drawable.ic_lock_lock,
            isGranted = { PermissionHelper.isDeviceAdmin(this) },
            request = {
                val adminComponent = ComponentName(this, AdminReceiver::class.java)
                val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                    putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                    putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                        "Magneetar needs Device Admin to prevent uninstallation " +
                            "and enable remote lock. This protects your phone from theft.")
                }
                deviceAdminLauncher.launch(intent)
            },
            isCritical = true
        ))

        // Step 4: Battery Optimization (IMPORTANT — background survival)
        steps.add(PermissionStep(
            title = "Background Protection",
            description = "Magneetar needs to run in the background to:\n\n" +
                "• Track your device even when the screen is off\n" +
                "• Respond to remote commands instantly\n" +
                "• Send theft alerts without delay",
            why = "Without this, Android may stop Magneetar when your phone is locked.",
            iconRes = android.R.drawable.ic_lock_idle_low_battery,
            isGranted = { PermissionHelper.isBatteryOptimized(this) },
            request = {
                AlertDialog.Builder(this)
                    .setTitle("Enable Background Protection")
                    .setMessage("Allow Magneetar to run without battery restrictions?\n\n" +
                        "This ensures your device stays protected even when locked.")
                    .setPositiveButton("Allow") { _, _ ->
                        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                            data = Uri.parse("package:$packageName")
                        }
                        startActivity(intent)
                        // Check on resume
                        layoutStatus.visibility = View.VISIBLE
                        tvStatus.text = "Enabling in Settings..."
                        tvStatus.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
                    }
                    .setNegativeButton("Not Now") { _, _ ->
                        onStepResult(false)
                    }
                    .setCancelable(false)
                    .show()
            },
            isCritical = false
        ))

        // Step 5: Camera (OPTIONAL — evidence capture)
        steps.add(PermissionStep(
            title = "Camera Access",
            description = "Magneetar can capture photos when your phone is stolen:\n\n" +
                "• Take a photo of whoever has your phone\n" +
                "• Evidence photos sent to your dashboard\n" +
                "• Helps identify and recover your device",
            why = "Optional — but helps gather evidence if your phone is stolen.",
            iconRes = android.R.drawable.ic_menu_camera,
            isGranted = { PermissionHelper.hasCamera(this) },
            request = {
                if (shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)) {
                    showRationaleDialog(
                        "Camera is used to capture evidence during theft.",
                        "Photos are encrypted and only accessible by you."
                    ) {
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                } else {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
            },
            isCritical = false
        ))

        // Step 6: Microphone (OPTIONAL — audio evidence)
        steps.add(PermissionStep(
            title = "Microphone Access",
            description = "Magneetar can record audio when your phone is stolen:\n\n" +
                "• Capture ambient sounds for evidence\n" +
                "• Help identify location from background noise\n" +
                "• Audio sent securely to your dashboard",
            why = "Optional — but provides additional evidence for recovery.",
            iconRes = android.R.drawable.ic_btn_speak_now,
            isGranted = { PermissionHelper.hasMic(this) },
            request = {
                if (shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)) {
                    showRationaleDialog(
                        "Microphone is used to capture audio evidence during theft.",
                        "Audio is encrypted and only accessible by you."
                    ) {
                        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                } else {
                    micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
            },
            isCritical = false
        ))

        progressSteps.max = steps.size
    }

    // ── UI ─────────────────────────────────────────────────────────────

    private fun showCurrentStep() {
        // Skip already-granted steps
        while (currentStep < steps.size && steps[currentStep].isGranted()) {
            currentStep++
        }

        if (currentStep >= steps.size) {
            // All done — check if critical permissions are missing
            val hasLocation = PermissionHelper.hasLocation(this)
            if (!hasLocation) {
                // Critical permission missing — warn before proceeding
                AlertDialog.Builder(this)
                    .setTitle("Location Required")
                    .setMessage("Magneetar needs location access to protect your device.\n\n" +
                        "Without it, tracking and recovery features won't work.\n\n" +
                        "You can enable it later in Settings.")
                    .setPositiveButton("Enable Location") { _, _ ->
                        currentStep = 0 // Go back to location step
                        showCurrentStep()
                    }
                    .setNegativeButton("Continue Anyway") { _, _ ->
                        navigateToDashboard()
                    }
                    .setCancelable(false)
                    .show()
                return
            }
            navigateToDashboard()
            return
        }

        val step = steps[currentStep]
        progressSteps.progress = currentStep + 1
        tvStepCount.text = "Step ${currentStep + 1} of ${steps.size}"
        tvStepTitle.text = step.title
        tvStepDescription.text = step.description
        tvStepWhy.text = step.why
        ivStepIcon.setImageResource(step.iconRes)

        // Show/hide skip button based on criticality
        btnSkip.text = if (step.isCritical) "Skip (not recommended)" else "Skip"
        btnSkip.visibility = View.VISIBLE

        btnAllow.text = "Allow ${step.title}"
        btnAllow.setOnClickListener { step.request() }

        btnSkip.setOnClickListener {
            if (step.isCritical) {
                AlertDialog.Builder(this)
                    .setTitle("Skip ${step.title}?")
                    .setMessage("This permission is important for device protection.\n\n" +
                        "Without it, ${getSkipImpact(step.title)}")
                    .setPositiveButton("Skip Anyway") { _, _ ->
                        currentStep++
                        showCurrentStep()
                    }
                    .setNegativeButton("Grant Permission", null)
                    .show()
            } else {
                currentStep++
                showCurrentStep()
            }
        }

        layoutStatus.visibility = View.GONE
        layoutDenied.visibility = View.GONE
    }

    private fun getSkipImpact(title: String): String {
        return when {
            title.contains("Location") -> "Magneetar cannot track or recover your device."
            title.contains("Notification") -> "You won't receive theft or safety alerts."
            title.contains("Device Admin") -> "A thief can uninstall Magneetar to disable protection."
            title.contains("Background") -> "Protection may stop when your phone is locked."
            title.contains("Camera") -> "No evidence photos will be captured during theft."
            title.contains("Microphone") -> "No audio evidence will be captured during theft."
            else -> "Some features may not work properly."
        }
    }

    private fun onStepResult(granted: Boolean) {
        if (granted) {
            layoutStatus.visibility = View.VISIBLE
            layoutDenied.visibility = View.GONE
            tvStatus.text = "✓ Permission granted"
            tvStatus.setTextColor(ContextCompat.getColor(this, R.color.status_online))
        } else {
            // Check if permanently denied
            val step = steps[currentStep]
            val perm = when (currentStep) {
                0 -> Manifest.permission.ACCESS_FINE_LOCATION
                1 -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) Manifest.permission.POST_NOTIFICATIONS else null
                2 -> null // Device admin doesn't have shouldShowRequestPermissionRationale
                3 -> null // Battery optimization is a system intent
                4 -> Manifest.permission.CAMERA
                5 -> Manifest.permission.RECORD_AUDIO
                else -> null
            }

            val permanentlyDenied = perm != null &&
                !shouldShowRequestPermissionRationale(perm) &&
                ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED

            if (permanentlyDenied) {
                // Show settings redirect
                layoutStatus.visibility = View.GONE
                layoutDenied.visibility = View.VISIBLE
                return
            }

            layoutStatus.visibility = View.VISIBLE
            layoutDenied.visibility = View.GONE
            tvStatus.text = if (step.isCritical) "Skipped — this is important for protection" else "Skipped"
            tvStatus.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
        }

        // Auto-advance after brief feedback
        tvStatus.postDelayed({
            currentStep++
            showCurrentStep()
        }, 1200)
    }

    // ── Rationale Dialogs ──────────────────────────────────────────────

    private fun showRationaleDialog(title: String, message: String, onAllow: () -> Unit) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Allow") { _, _ -> onAllow() }
            .setNegativeButton("Not Now") { _, _ -> onStepResult(false) }
            .setCancelable(false)
            .show()
    }

    private fun showBackgroundLocationRationale() {
        AlertDialog.Builder(this)
            .setTitle("Background Location")
            .setMessage("To protect your device when it's stolen, Magneetar needs " +
                "to track location even when the app is closed.\n\n" +
                "This is used ONLY for:\n" +
                "• Theft recovery tracking\n" +
                "• Safe zone alerts\n" +
                "• Evidence capture location\n\n" +
                "You can disable this anytime in Settings.")
            .setPositiveButton("Allow All The Time") { _, _ ->
                backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }
            .setNegativeButton("Not Now") { _, _ ->
                onStepResult(false)
            }
            .setCancelable(false)
            .show()
    }

    // ── Navigation ─────────────────────────────────────────────────────

    private fun navigateToDashboard() {
        // Start tracking service if location is available
        if (PermissionHelper.hasLocation(this)) {
            try {
                ContextCompat.startForegroundService(this, Intent(this, TrackingService::class.java))
            } catch (_: Exception) {}
        }

        startActivity(Intent(this, DashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }
}
