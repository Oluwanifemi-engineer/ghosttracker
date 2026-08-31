package com.magneetar.app

/**
 * Feature flags for controlling which features are enabled.
 *
 * Anti-theft features (device admin, accessibility, silent capture, SMS, mesh,
 * uninstall guard) are DISABLED for Play Store compliance. The code remains
 * intact so the sideload build can re-enable them later.
 *
 * Core features (IMEI storage, SIM detection, location tracking, remote
 * commands) are always ENABLED.
 */
object FeatureFlags {

    /** Device Admin lock/wipe/uninstall protection — DISABLED for Play Store */
    const val DEVICE_ADMIN_ENABLED = false

    /** Accessibility-based uninstall guard — DISABLED for Play Store */
    const val ACCESSIBILITY_GUARD_ENABLED = false

    /** Silent photo/audio capture — DISABLED for Play Store */
    const val SILENT_CAPTURE_ENABLED = false

    /** SMS command receiver — DISABLED for Play Store */
    const val SMS_COMMANDS_ENABLED = false

    /** P2P mesh networking — DISABLED for Play Store */
    const val MESH_NETWORKING_ENABLED = false

    /** Uninstall protection — DISABLED for Play Store */
    const val UNINSTALL_PROTECTION_ENABLED = false

    /** Failed unlock detection (theftie) — DISABLED for Play Store */
    const val FAILED_UNLOCK_DETECTION = false

    // ── Core features (always enabled) ──────────────────────────────────

    /** IMEI capture and storage — always enabled */
    const val IMEI_STORAGE_ENABLED = true

    /** SIM change detection — always enabled */
    const val SIM_CHANGE_DETECTION = true

    /** Location tracking — always enabled */
    const val LOCATION_TRACKING = true

    /** Remote commands via FCM — always enabled */
    const val REMOTE_COMMANDS_ENABLED = true

    /** Police report generation — always enabled */
    const val POLICE_REPORT_ENABLED = true

    /** Location history + export — always enabled */
    const val LOCATION_HISTORY_ENABLED = true
}
