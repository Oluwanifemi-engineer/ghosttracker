package com.magneetar.app

import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.text.format.DateFormat
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * Generates a police report with all available evidence.
 *
 * One-tap, works offline. The report includes:
 * - Device information (IMEI, model, OS version, app version)
 * - Owner information (if available)
 * - Last known location with coordinates
 * - SIM change detection evidence
 * - Timeline of alerts
 * - Instructions for the police officer
 *
 * The report is saved as a text file and shared via the system share sheet.
 */
object PoliceReportGenerator {

    data class ReportData(
        val deviceImei: String = "",
        val deviceModel: String = "",
        val osVersion: String = "",
        val appVersion: String = "",
        val deviceName: String = "",
        val ownerName: String = "",
        val ownerPhone: String = "",
        val lastKnownLat: Double = 0.0,
        val lastKnownLng: Double = 0.0,
        val lastSeenTime: String = "",
        val simChanged: Boolean = false,
        val oldSimOperator: String = "",
        val newSimOperator: String = "",
        val theftDetected: Boolean = false,
        val alerts: List<String> = emptyList()
    )

    /**
     * Generate a police report and return a shareable file URI.
     */
    fun generate(context: Context, data: ReportData): File {
        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
        val dateStamp = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        val report = buildString {
            appendLine("═══════════════════════════════════════════════════════════")
            appendLine("              MAGNEETAR THEFT REPORT")
            appendLine("              Generated: $timestamp")
            appendLine("═══════════════════════════════════════════════════════════")
            appendLine()

            // Section 1: Device Information
            appendLine("1. DEVICE INFORMATION")
            appendLine("───────────────────────────────────────────────────────────")
            appendLine("  Device Name:     ${data.deviceName.ifEmpty { "Unknown" }}")
            appendLine("  Model:           ${data.deviceModel.ifEmpty { "Unknown" }}")
            appendLine("  IMEI:            ${data.deviceImei.ifEmpty { "Not captured" }}")
            appendLine("  OS Version:      ${data.osVersion.ifEmpty { "Unknown" }}")
            appendLine("  App Version:     ${data.appVersion.ifEmpty { "Unknown" }}")
            appendLine()

            // Section 2: Owner Information
            appendLine("2. OWNER INFORMATION")
            appendLine("───────────────────────────────────────────────────────────")
            appendLine("  Name:            ${data.ownerName.ifEmpty { "Not provided" }}")
            appendLine("  Phone:           ${data.ownerPhone.ifEmpty { "Not provided" }}")
            appendLine()

            // Section 3: Theft Details
            appendLine("3. THEFT DETAILS")
            appendLine("───────────────────────────────────────────────────────────")
            appendLine("  Report Date:     $dateStamp")
            appendLine("  Theft Detected:  ${if (data.theftDetected) "YES" else "No"}")
            appendLine()

            // Section 4: Last Known Location
            appendLine("4. LAST KNOWN LOCATION")
            appendLine("───────────────────────────────────────────────────────────")
            if (data.lastKnownLat != 0.0 && data.lastKnownLng != 0.0) {
                appendLine("  Latitude:        ${String.format("%.6f", data.lastKnownLat)}")
                appendLine("  Longitude:       ${String.format("%.6f", data.lastKnownLng)}")
                appendLine("  Google Maps:     https://maps.google.com/?q=${data.lastKnownLat},${data.lastKnownLng}")
                appendLine("  Last Seen:       ${data.lastSeenTime.ifEmpty { "Unknown" }}")
            } else {
                appendLine("  No location data available")
                appendLine("  (Device may have been offline before location was acquired)")
            }
            appendLine()

            // Section 5: SIM Change Evidence
            appendLine("5. SIM CHANGE EVIDENCE")
            appendLine("───────────────────────────────────────────────────────────")
            if (data.simChanged) {
                appendLine("  ⚠ SIM CARD CHANGE DETECTED")
                appendLine("  Previous SIM:    ${data.oldSimOperator.ifEmpty { "Unknown" }}")
                appendLine("  Current SIM:     ${data.newSimOperator.ifEmpty { "Unknown" }}")
                appendLine()
                appendLine("  NOTE: The SIM card in the device has been changed since")
                appendLine("  the theft was detected. This is strong evidence that the")
                appendLine("  device is in unauthorized possession.")
            } else {
                appendLine("  No SIM change detected")
            }
            appendLine()

            // Section 6: Alert Timeline
            appendLine("6. ALERT TIMELINE")
            appendLine("───────────────────────────────────────────────────────────")
            if (data.alerts.isNotEmpty()) {
                data.alerts.forEach { alert ->
                    appendLine("  • $alert")
                }
            } else {
                appendLine("  No alerts recorded")
            }
            appendLine()

            // Section 7: Recovery Instructions
            appendLine("7. RECOVERY INSTRUCTIONS")
            appendLine("───────────────────────────────────────────────────────────")
            appendLine("  a) File a police report at the nearest station with this document")
            appendLine("  b) Request the police to track the IMEI through the NCC-DMS")
            appendLine("     (Device Management System) at the network operator level")
            appendLine("  c) Visit the FHQ Abuja tracking office (free service)")
            appendLine("     or the state command tracking unit")
            appendLine("  d) Provide this report as evidence of ownership and theft")
            appendLine("  e) If the device is recovered, verify the IMEI matches")
            appendLine()

            // Section 8: Legal Notice
            appendLine("8. LEGAL NOTICE")
            appendLine("───────────────────────────────────────────────────────────")
            appendLine("  This report was automatically generated by Magneetar,")
            appendLine("  a device protection application. The data contained herein")
            appendLine("  is telemetry data collected by the device with the owner's")
            appendLine("  consent. This report is admissible as evidence of device")
            appendLine("  ownership and theft detection.")
            appendLine()

            // Footer
            appendLine("═══════════════════════════════════════════════════════════")
            appendLine("  Magneetar Device Protection")
            appendLine("  https://magneetar.me")
            appendLine("  This report was generated automatically.")
            appendLine("  For verification, contact support@magneetar.me")
            appendLine("═══════════════════════════════════════════════════════════")
        }

        // Save to app cache
        val filename = "Magneetar_Theft_Report_${dateStamp}.txt"
        val file = File(context.cacheDir, filename)
        file.writeText(report)
        return file
    }

    /**
     * Share the report via the system share sheet.
     */
    fun share(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Magneetar Theft Report")
            putExtra(Intent.EXTRA_TEXT, "Attached is the Magneetar theft report for my stolen device.")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share Theft Report"))
    }

    /**
     * Build report data from the app's stored information.
     */
    fun buildFromPrefs(context: Context): ReportData {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)

        val imei = prefs.getString("device_imei", "") ?: ""
        val model = prefs.getString("device_model", "") ?: ""
        val osVersion = prefs.getString("os_version", "") ?: ""
        val appVersion = BuildConfig.VERSION_NAME
        val deviceName = prefs.getString("device_name", "") ?: ""
        val lastLat = prefs.getFloat("last_lat", 0f).toDouble()
        val lastLng = prefs.getFloat("last_lng", 0f).toDouble()
        val lastSeen = prefs.getString("last_seen", "") ?: ""
        val simChanged = prefs.getBoolean("sim_change_pending", false)
        val oldSim = prefs.getString("last_sim_operator", "") ?: ""
        val newSim = prefs.getString("current_sim_operator", "") ?: ""

        // Build alert list from stored alerts
        val alerts = mutableListOf<String>()
        val alertsJson = prefs.getString("recent_alerts", "[]") ?: "[]"
        try {
            val arr = org.json.JSONArray(alertsJson)
            for (i in 0 until arr.length()) {
                alerts.add(arr.getString(i))
            }
        } catch (_: Exception) {}

        return ReportData(
            deviceImei = imei,
            deviceModel = model,
            osVersion = osVersion,
            appVersion = appVersion,
            deviceName = deviceName,
            lastKnownLat = lastLat,
            lastKnownLng = lastLng,
            lastSeenTime = lastSeen,
            simChanged = simChanged,
            oldSimOperator = oldSim,
            newSimOperator = newSim,
            theftDetected = simChanged,
            alerts = alerts
        )
    }
}
