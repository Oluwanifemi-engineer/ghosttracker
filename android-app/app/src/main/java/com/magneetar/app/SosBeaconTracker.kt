package com.magneetar.app

import android.content.Context

/**
 * Find Network (COMPETITOR_AUDIT P1 #6, Phase 1) — guardian-side sighting
 * cooldown memory.
 *
 * A guardian's BLE scanner sees a Magneetar SOS beacon repeatedly while in
 * range (BLE advertisements repeat every ~100ms-1s, and the phone may pass
 * the stolen device, leave, and come back). Blindly reporting every scan
 * would spam the server's sighting endpoint — which is rate-limited per
 * guardian (10/hour) and would burn the whole budget on ONE beacon.
 *
 * This tracker remembers which beacon tokens were already reported and skips
 * re-reports within a cooldown window (default 2 hours — long enough to
 * cover a user crossing the same area twice, short enough that a genuinely
 * re-encountered device (recovered, re-stolen, new request) gets reported
 * again).
 *
 * The cooldown is keyed by the beacon token itself, so:
 *   - the SAME stolen device seen twice → reported once (dedup);
 *   - a NEW recovery request for the same physical phone mints a NEW token →
 *     reported again (correct — it is a fresh, actionable sighting).
 *
 * Pure JVM (injected StringStore + clock, dependency-free serialization —
 * deliberately NOT org.json, whose methods are unmocked stubs in local unit
 * tests) so the cooldown contract is locked by SosBeaconTrackerTest.kt
 * without an emulator, mirroring RecentCommandTracker. [persistent] provides
 * the SharedPreferences-backed production store.
 */
class SosBeaconTracker(
    private val store: StringStore,
    private val nowMs: () -> Long = System::currentTimeMillis,
) {
    /**
     * Record that [token] was reported at this moment. Idempotent — a
     * re-record just refreshes the timestamp (keeps a beacon inside its
     * cooldown while it is still in range).
     */
    fun rememberReported(token: String) {
        val map = read()
        map[token] = nowMs().toString()
        write(pruned(map))
    }

    /**
     * True when [token] was reported within [cooldownMs] — i.e. the scanner
     * should NOT report it again yet. False for unknown/expired tokens.
     */
    fun isInCooldown(token: String, cooldownMs: Long = DEFAULT_COOLDOWN_MS): Boolean {
        val at = read()[token]?.toLongOrNull() ?: return false
        return nowMs() - at <= cooldownMs
    }

    /** Parse "token=ts;token=ts;..." back into a map. Corrupt input degrades to empty. */
    private fun read(): MutableMap<String, String> {
        val result = LinkedHashMap<String, String>()
        val serialized = store.read()
        if (serialized.isEmpty()) return result
        for (record in serialized.split(';')) {
            if (record.isEmpty()) continue
            val eq = record.indexOf('=')
            if (eq <= 0) continue
            result[record.substring(0, eq)] = record.substring(eq + 1)
        }
        return result
    }

    private fun write(map: Map<String, String>) {
        store.write(map.entries.joinToString(";") { "${it.key}=${it.value}" })
    }

    /** Drop entries older than 2× cooldown so prefs stay bounded. */
    private fun pruned(map: MutableMap<String, String>): MutableMap<String, String> {
        val cutoff = nowMs() - DEFAULT_COOLDOWN_MS * 2
        val stale = map.entries.filter { (_, raw) ->
            val at = raw.toLongOrNull()
            at == null || at < cutoff
        }.map { it.key }
        stale.forEach { map.remove(it) }
        return map
    }

    companion object {
        const val DEFAULT_COOLDOWN_MS = 2L * 60 * 60 * 1000L // 2 hours

        /** SharedPreferences-backed production store. */
        fun persistent(context: Context): SosBeaconTracker {
            val prefs = context.getSharedPreferences("mt_sos_tracker", Context.MODE_PRIVATE)
            return SosBeaconTracker(
                object : StringStore {
                    override fun read(): String = prefs.getString("reported", "") ?: ""
                    override fun write(json: String) {
                        prefs.edit().putString("reported", json).apply()
                    }
                }
            )
        }
    }
}
