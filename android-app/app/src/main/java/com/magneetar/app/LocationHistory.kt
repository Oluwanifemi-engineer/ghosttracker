package com.magneetar.app

import android.content.Context
import android.content.Intent
import android.text.format.DateFormat
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * Stores location history locally and exports as CSV for police evidence.
 *
 * Keeps the last 7 days of location fixes. Each fix includes:
 * - Timestamp
 * - Latitude, Longitude
 * - Speed
 * - Battery level
 * - Network type
 *
 * The CSV is formatted for easy import into spreadsheets and police evidence.
 */
object LocationHistory {

    private const val MAX_ENTRIES = 10_000 // ~7 days at 1 fix/minute
    private const val PREFS = "mt"
    private const val KEY_HISTORY = "location_history"

    /**
     * Add a location fix to the history.
     */
    fun addEntry(
        context: Context,
        lat: Double,
        lng: Double,
        speed: Double = 0.0,
        battery: Int = -1,
        network: String = ""
    ) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_HISTORY, "") ?: ""

        val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
        val entry = "$timestamp,${lat},${lng},${speed},${battery},$network"

        val updated = if (existing.isEmpty()) {
            entry
        } else {
            val entries = existing.split("\n").filter { it.isNotBlank() }.toMutableList()
            entries.add(entry)
            // Trim to MAX_ENTRIES
            while (entries.size > MAX_ENTRIES) entries.removeAt(0)
            entries.joinToString("\n")
        }

        prefs.edit().putString(KEY_HISTORY, updated).apply()
    }

    /**
     * Get all location history entries.
     */
    fun getEntries(context: Context): List<LocationEntry> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val data = prefs.getString(KEY_HISTORY, "") ?: ""
        if (data.isBlank()) return emptyList()

        return data.split("\n").filter { it.isNotBlank() }.mapNotNull { line ->
            try {
                val parts = line.split(",")
                if (parts.size >= 3) {
                    LocationEntry(
                        timestamp = parts[0],
                        lat = parts[1].toDouble(),
                        lng = parts[2].toDouble(),
                        speed = parts.getOrNull(3)?.toDoubleOrNull() ?: 0.0,
                        battery = parts.getOrNull(4)?.toIntOrNull() ?: -1,
                        network = parts.getOrNull(5) ?: ""
                    )
                } else null
            } catch (_: Exception) { null }
        }
    }

    /**
     * Export location history as CSV and share it.
     */
    fun exportAndShare(context: Context) {
        val entries = getEntries(context)
        if (entries.isEmpty()) return

        val timestamp = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        val csv = buildString {
            appendLine("Timestamp,Latitude,Longitude,Speed (m/s),Battery (%),Network")
            entries.forEach { e ->
                appendLine("${e.timestamp},${e.lat},${e.lng},${e.speed},${e.battery},${e.network}")
            }
        }

        val filename = "Magneetar_Location_History_$timestamp.csv"
        val file = File(context.cacheDir, filename)
        file.writeText(csv)

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/csv"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Magneetar Location History")
            putExtra(Intent.EXTRA_TEXT, "Attached is the location history for my device.")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Export Location History"))
    }

    /**
     * Clear old entries (older than 7 days).
     */
    fun pruneOldEntries(context: Context) {
        val cutoff = System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000L)
        val cutoffStr = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(cutoff))

        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val data = prefs.getString(KEY_HISTORY, "") ?: ""
        if (data.isBlank()) return

        val kept = data.split("\n").filter { line ->
            try {
                val timestamp = line.split(",").firstOrNull() ?: ""
                timestamp >= cutoffStr
            } catch (_: Exception) { false }
        }

        prefs.edit().putString(KEY_HISTORY, kept.joinToString("\n")).apply()
    }

    data class LocationEntry(
        val timestamp: String,
        val lat: Double,
        val lng: Double,
        val speed: Double = 0.0,
        val battery: Int = -1,
        val network: String = ""
    )
}
