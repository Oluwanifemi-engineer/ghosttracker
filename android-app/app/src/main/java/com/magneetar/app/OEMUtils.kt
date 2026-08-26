package com.magneetar.app

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/**
 * OEM-specific utilities for background persistence.
 * Detects phone manufacturers and provides:
 * 1. Step-by-step guidance for enabling auto-start and disabling battery optimization
 * 2. Direct intents to open relevant OEM settings pages
 * 3. WakeLock tag spoofing for Huawei PowerGenie whitelist
 * 4. Battery optimization exemption requests
 * 5. Detection of aggressive OEM kill behaviors
 *
 * Survival hierarchy (each layer catches what the previous misses):
 *   Layer 1: Foreground services (location + dataSync types)
 *   Layer 2: Battery optimization exemption (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
 *   Layer 3: OEM auto-start / app-lock settings
 *   Layer 4: AlarmManager watchdog (survives Doze)
 *   Layer 5: WorkManager health check (survives OEM kills)
 *   Layer 6: EnvironmentReceiver (power/connectivity restarts)
 */
object OEMUtils {

    private const val TAG = "OEMUtils"

    /** Manufacturer identifiers for Chinese OEMs */
    private val CHINESE_OEM_MANUFACTURERS = setOf(
        "xiaomi", "redmi", "poco", "huawei", "honor", "oppo",
        "realme", "vivo", "oneplus", "meizu", "lenovo", "zte",
        "nubia", "coolpad", "gionee", "letv", "smartisan",
        // Transsion — Tecno / Infinix / Itel are the dominant brands in Nigeria
        // and much of Africa; their HiOS/XOS battery killers are aggressive.
        "tecno", "infinix", "itel", "tcl", "transsion"
    )

    /** Whether this device is from a Chinese OEM */
    fun isChineseOEM(): Boolean {
        val manufacturer = Build.MANUFACTURER.lowercase().replace(" ", "")
        return CHINESE_OEM_MANUFACTURERS.any { manufacturer.contains(it) }
    }

    /** Whether this device has Huawei's PowerGenie task killer */
    fun isHuaweiPowerGenieDevice(): Boolean {
        return Build.MANUFACTURER.lowercase().let {
            it.contains("huawei") || it.contains("honor")
        } && Build.VERSION.SDK_INT >= 28 // EMUI 9+ (Android P+)
    }

    /** Whether this device is from Transsion (Tecno/Infinix/Itel) */
    fun isTranssionDevice(): Boolean {
        return Build.MANUFACTURER.lowercase().let {
            it.contains("tecno") || it.contains("infinix") ||
                it.contains("itel") || it.contains("transsion")
        }
    }

    /** OEM display name for user-facing messages */
    fun getOEMName(): String {
        return when {
            Build.MANUFACTURER.lowercase().contains("xiaomi") || Build.MANUFACTURER.lowercase().contains("redmi") -> "Xiaomi MIUI/HyperOS"
            Build.MANUFACTURER.lowercase().contains("huawei") || Build.MANUFACTURER.lowercase().contains("honor") -> "Huawei EMUI/HarmonyOS"
            Build.MANUFACTURER.lowercase().contains("oppo") -> "Oppo ColorOS"
            Build.MANUFACTURER.lowercase().contains("realme") -> "Realme UI"
            Build.MANUFACTURER.lowercase().contains("vivo") -> "Vivo Funtouch OS"
            Build.MANUFACTURER.lowercase().contains("oneplus") -> "OnePlus OxygenOS/ColorOS"
            Build.MANUFACTURER.lowercase().contains("meizu") -> "Meizu Flyme"
            Build.MANUFACTURER.lowercase().contains("tecno") || Build.MANUFACTURER.lowercase().contains("infinix") ||
                Build.MANUFACTURER.lowercase().contains("itel") || Build.MANUFACTURER.lowercase().contains("transsion") ->
                "Transsion HiOS/XOS (Tecno/Infinix/Itel)"
            else -> "${Build.MANUFACTURER} ${Build.BRAND}"
        }
    }

    /**
     * Returns step-by-step guidance for enabling auto-start on this device.
     * Used in the onboarding flow and on the home screen.
     */
    fun getAutoStartGuidance(): String {
        val manufacturer = Build.MANUFACTURER.lowercase()
        return when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") ->
                "1. Open Settings → Apps → Manage apps\n" +
                "2. Find Magneetar → toggle \"Auto-start\" ON\n" +
                "3. Open Settings → Battery → Battery saver → tap the gear icon\n" +
                "4. Find Magneetar → disable \"Restrict background apps\"\n" +
                "5. Lock Magneetar in Recent Apps (pull the app card down and tap the lock icon)"

            manufacturer.contains("huawei") || manufacturer.contains("honor") ->
                "1. Open Phone Manager → App Launch\n" +
                "2. Find Magneetar → toggle \"Manage automatically\" OFF\n" +
                "3. Enable all three toggles: Auto-launch, Secondary launch, Run in background\n" +
                "4. Go to Settings → Battery → App Launch → ensure Magneetar is set to \"Manage manually\"\n" +
                "5. Go to Settings → Apps → Magneetar → Battery → enable \"Keep running after screen off\"\n" +
                "6. Open Settings → Battery → Battery optimization → tap \"Don't allow\" dropdown → All apps → find Magneetar → Don't allow"

            manufacturer.contains("oppo") || manufacturer.contains("realme") ->
                "1. Open Settings → Apps → App Management\n" +
                "2. Find Magneetar → tap → Battery usage → enable \"Allow background activity\"\n" +
                "3. Also enable \"Allow auto launch\"\n" +
                "4. Open Phone Manager → Permissions → Auto-launch → enable Magneetar\n" +
                "5. Go to Settings → Battery → Battery optimization → find Magneetar → Don't optimize\n" +
                "6. Lock Magneetar in Recent Apps (swipe down on the app card and tap the lock)"

            manufacturer.contains("vivo") ->
                "1. Open Settings → More Settings → Apps → Autostart\n" +
                "2. Enable Magneetar\n" +
                "3. Go to Settings → Battery → Background power consumption → select Magneetar → \"Allow\"\n" +
                "4. Open iManager → App Manager → Magneetar → enable \"Allow background running\"\n" +
                "5. Lock Magneetar in Recent Apps (swipe down on the app card)"

            manufacturer.contains("oneplus") ->
                "1. Open Settings → Battery → Battery Optimization\n" +
                "2. Find Magneetar → select \"Don't optimize\"\n" +
                "3. Go to Settings → Apps → Magneetar → Battery → set to \"Unrestricted\"\n" +
                "4. Open Recent Apps and lock Magneetar (tap the three dots → Lock)"

            manufacturer.contains("tecno") || manufacturer.contains("infinix") ||
                manufacturer.contains("itel") || manufacturer.contains("transsion") ->
                "1. Open the Phone Manager app → Autostart (or Auto-launch)\n" +
                "2. Find Magneetar → toggle ON\n" +
                "3. Go to Settings → Battery → App Power Management → find Magneetar\n" +
                "4. Set to \"Allow background running\" (not \"Smart optimization\")\n" +
                "5. Open XPanel/HiPanel → App Management → Magneetar → enable \"Allow auto-start\"\n" +
                "6. Lock Magneetar in Recent Apps (pull the app card down and tap the lock icon)\n" +
                "7. On HiOS 12+: Settings → Privacy & Security → App Lock → disable for Magneetar"

            manufacturer.contains("samsung") ->
                "1. Open Settings → Device care → Battery → App power management\n" +
                "2. Find Magneetar → set to \"Unrestricted\"\n" +
                "3. Go to Settings → Apps → Magneetar → Battery → \"Allow background activity\"\n" +
                "4. Open Device care → Battery → three dots → Settings → disable \"Adaptive battery\" if too aggressive"

            else ->
                "1. Open Settings → Apps → Magneetar → Battery → Unrestricted\n" +
                "2. Also enable \"Auto-start\" if available\n" +
                "3. Lock the app in Recent Apps (pull the app card down)"
        }
    }

    /**
     * Returns a brief summary of the OEM-specific risk level.
     * Used to show a warning badge on the home screen.
     */
    fun getOEMRiskLevel(): Pair<OEMRisk, String> {
        val manufacturer = Build.MANUFACTURER.lowercase()
        return when {
            // Huawei PowerGenie is the most aggressive — kills everything not whitelisted
            manufacturer.contains("huawei") || manufacturer.contains("honor") ->
                OEMRisk.HIGH to "Huawei's PowerGenie may kill background services. Disable it via ADB or follow the setup guide."

            // Xiaomi/MIUI/HyperOS has aggressive app standby buckets
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco") ->
                OEMRisk.HIGH to "MIUI/HyperOS aggressively manages background apps. Enable Auto-start and lock in Recents."

            // Transsion HiOS/XOS is very aggressive on African market devices
            manufacturer.contains("tecno") || manufacturer.contains("infinix") ||
                manufacturer.contains("itel") || manufacturer.contains("transsion") ->
                OEMRisk.HIGH to "HiOS/XOS kills background apps aggressively. Enable all battery exemptions."

            // Oppo/Realme/OnePlus share ColorOS heritage
            manufacturer.contains("oppo") || manufacturer.contains("realme") ||
                manufacturer.contains("oneplus") ->
                OEMRisk.MEDIUM to "ColorOS variants may restrict background activity. Disable battery optimization."

            // Vivo Funtouch
            manufacturer.contains("vivo") ->
                OEMRisk.MEDIUM to "Funtouch OS may restrict background apps. Enable autostart and unrestricted battery."

            // Samsung is generally better but Adaptive Battery can be aggressive
            manufacturer.contains("samsung") ->
                OEMRisk.LOW to "Samsung's Adaptive Battery may occasionally restrict background activity."

            // Stock Android / Pixel / other — minimal risk
            else ->
                OEMRisk.LOW to "Standard Android — battery optimization may still apply."
        }
    }

    /**
     * Attempts to open the auto-start settings page for this manufacturer.
     * Returns true if a specific intent was launched.
     */
    fun openAutoStartSettings(context: Context): Boolean {
        return try {
            val intent = when {
                Build.MANUFACTURER.lowercase().contains("xiaomi") -> {
                    Intent().apply {
                        action = "miui.intent.action.OP_AUTO_START"
                        addCategory(Intent.CATEGORY_DEFAULT)
                        putExtra("package_name", context.packageName)
                        putExtra("pkg", context.packageName)
                        `package` = "com.miui.securitycenter"
                    }
                }
                Build.MANUFACTURER.lowercase().contains("huawei") || Build.MANUFACTURER.lowercase().contains("honor") -> {
                    Intent().apply {
                        action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                        data = Uri.parse("package:${context.packageName}")
                    }
                }
                Build.MANUFACTURER.lowercase().contains("oppo") || Build.MANUFACTURER.lowercase().contains("realme") -> {
                    Intent().apply {
                        action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                        data = Uri.parse("package:${context.packageName}")
                    }
                }
                Build.MANUFACTURER.lowercase().contains("vivo") -> {
                    Intent().apply {
                        action = "com.vivo.safeheart.action.ACTION_AUTOSTART_SETTING"
                        addCategory(Intent.CATEGORY_DEFAULT)
                        putExtra("packageName", context.packageName)
                        putExtra("pkg_name", context.packageName)
                        `package` = "com.iqoo.secure"
                    }
                }
                // Transsion devices gate auto-start inside the stock Phone Manager
                // app; app-details settings is the reliable universal entry point.
                Build.MANUFACTURER.lowercase().let {
                    it.contains("tecno") || it.contains("infinix") ||
                        it.contains("itel") || it.contains("transsion")
                } -> {
                    Intent().apply {
                        action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                        data = Uri.parse("package:${context.packageName}")
                    }
                }
                else -> {
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:${context.packageName}")
                    }
                }
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            // Fallback to app settings
            try {
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    /**
     * Open the battery optimization settings for this app.
     * This is the most reliable way to exempt the app from Doze mode.
     */
    fun openBatteryOptimizationSettings(context: Context): Boolean {
        return try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Failed to open battery optimization settings: ${e.message}")
            false
        }
    }

    /**
     * Request to be added to the battery optimization whitelist.
     * This shows a system dialog asking the user to confirm.
     * Returns true if the intent was launched (doesn't mean the user accepted).
     */
    fun requestBatteryOptimizationExemption(context: Context): Boolean {
        return try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (powerManager.isIgnoringBatteryOptimizations(context.packageName)) {
                Log.d(TAG, "Already whitelisted from battery optimization")
                return true
            }
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Failed to request battery optimization exemption: ${e.message}")
            false
        }
    }

    /**
     * Check if the app is currently whitelisted from battery optimization.
     */
    fun isBatteryOptimizationWhitelisted(context: Context): Boolean {
        return try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            powerManager.isIgnoringBatteryOptimizations(context.packageName)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Returns the optimal WakeLock tag for this device.
     * On Huawei/Honor, use a whitelisted system tag to avoid PowerGenie killing us.
     * PowerGenie terminates wakelocks with non-whitelisted tags held for >60 min.
     *
     * Whitelisted tags (Huawei EMUI 4+):
     * "AudioMix", "AudioIn", "AudioDup", "AudioDirectOut",
     * "AudioOffload", "LocationManagerService"
     */
    fun getWakeLockTag(): String {
        return if (isHuaweiPowerGenieDevice()) {
            "LocationManagerService" // Huawei-whitelisted system tag
        } else {
            "Magneetar:WakeLock"
        }
    }

    /**
     * Returns the autostart permission state based on manufacturer.
     * On Xiaomi/HyperOS, this can check the autostart setting.
     */
    fun isAutoStartEnabled(context: Context): Boolean {
        // Most Chinese OEMs don't expose auto-start state via public API.
        // We use a heuristic: if the app has persisted through a recent reboot
        // (checked via shared prefs timestamp), auto-start is likely enabled.
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        val lastBootRestart = prefs.getLong("last_boot_restart", 0L)
        val lastManualRestart = prefs.getLong("last_manual_restart", 0L)
        // If we've successfully restarted after boot, auto-start is likely enabled
        return lastBootRestart > 0 && lastBootRestart > lastManualRestart
    }

    /**
     * Check if the app is in the recent apps list and locked (Xiaomi/MIUI).
     * This is a heuristic — we can't directly query the recents lock state.
     */
    fun shouldShowRecentsLockHint(): Boolean {
        return Build.MANUFACTURER.lowercase().let {
            it.contains("xiaomi") || it.contains("redmi") || it.contains("poco") ||
                it.contains("huawei") || it.contains("honor") ||
                it.contains("tecno") || it.contains("infinix") ||
                it.contains("itel") || it.contains("transsion")
        }
    }
}

/** OEM risk level for background persistence. */
enum class OEMRisk(val level: String) {
    HIGH("High"),
    MEDIUM("Medium"),
    LOW("Low")
}
