package com.magneetar.app

import android.content.Context
import android.telephony.TelephonyManager

/**
 * Permission-free SIM-change detection.
 *
 * On Android 10+ the SIM serial and IMSI are gated to privileged apps, so a
 * plain app cannot read them. Instead we fingerprint the SIM with operator
 * codes that require NO permissions — [TelephonyManager.getSimOperator]
 * ("mcc-mnc") and [TelephonyManager.getSimOperatorName] — and compare against
 * a persisted baseline:
 *
 *   - First run (no baseline) → persist silently, NEVER alert (a fresh
 *     install must not look like a theft).
 *   - Fingerprint differs from the baseline → persist the new baseline and
 *     flag the change exactly once; the next telemetry/heartbeat reports it
 *     and the server fires the always-deliver `sim_changed` alert.
 *
 * Play-policy safe by construction: no READ_PHONE_STATE / READ_PHONE_NUMBERS
 * anywhere in this path, so it behaves identically on the Play and sideload
 * flavors (the Play build strips the phone-state permissions).
 *
 * KNOWN LIMITS (permission-free approach, documented honestly):
 *  - getSimOperator() reflects the DEFAULT data SIM — a swap of a secondary
 *    dual-SIM slot is not detected;
 *  - a same-carrier swap (identical MCC/MNC + operator name) is invisible;
 *  - the new SIM's phone number/ICCID cannot be read on Android 10+ (gated
 *    to privileged apps), so the alert cannot report them.
 * A swap to a different carrier (the common theft case) is detected.
 */
object SimChangeMonitor {

    private const val PREFS = "mt"
    private const val KEY_LAST_SIM_OP = "last_sim_operator"
    private const val KEY_CHANGE_PENDING = "sim_change_pending"

    /**
     * Current permission-free SIM fingerprint: "mcc-mnc|operatorName".
     * Empty when the SIM is absent, still loading, or telephony is
     * unavailable (Wi-Fi-only device) — an empty fingerprint never triggers
     * a change signal.
     */
    fun currentFingerprint(context: Context): String {
        return try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
                ?: return ""
            val state = tm.simState
            // SIM_STATE_READY (5) is the public, stable "SIM usable" state.
            // (SIM_STATE_LOADED is @SystemApi — hidden from third-party SDK
            // stubs — so it must not be referenced from app code.)
            if (state != TelephonyManager.SIM_STATE_READY) {
                return ""
            }
            // Each read is independent + best-effort: a SecurityException on
            // one (exotic OEM gating) must not lose the other.
            val op = try { tm.simOperator ?: "" } catch (e: Exception) { "" }
            val name = try { tm.simOperatorName ?: "" } catch (e: Exception) { "" }
            if (op.isEmpty() && name.isEmpty()) "" else "$op|$name"
        } catch (e: Exception) {
            ""
        }
    }

    /**
     * Compare the current fingerprint against the persisted baseline and flag
     * a change when they differ. Safe to call from the SIM-state receiver and
     * from every telemetry/heartbeat round — whichever sees the change first
     * flags it, and the flag is consumed exactly once by [consume].
     */
    @Synchronized
    fun detect(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // Already flagged and not yet reported — nothing to do.
        if (prefs.getBoolean(KEY_CHANGE_PENDING, false)) return
        val current = currentFingerprint(context)
        if (current.isEmpty()) return
        val last = prefs.getString(KEY_LAST_SIM_OP, null)
        if (last == null) {
            // First run — baseline only, never alert.
            prefs.edit().putString(KEY_LAST_SIM_OP, current).apply()
            return
        }
        if (current != last) {
            prefs.edit()
                .putString(KEY_LAST_SIM_OP, current)
                .putBoolean(KEY_CHANGE_PENDING, true)
                .apply()
            android.util.Log.i("SimChangeMonitor", "SIM operator changed: $last -> $current")
        }
    }

    /**
     * Report-and-clear the pending change flag. Returns true EXACTLY once per
     * detected change; every later call returns false until a new change is
     * detected. Synchronized so concurrent telemetry/heartbeat coroutines
     * cannot both consume the same change.
     */
    @Synchronized
    fun consume(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_CHANGE_PENDING, false)) {
            prefs.edit().putBoolean(KEY_CHANGE_PENDING, false).apply()
            return true
        }
        return false
    }

    /**
     * Persist the current fingerprint as the baseline without flagging
     * (called right after a successful registration, so an app that was
     * reinstalled on the same phone never false-alerts).
     */
    @Synchronized
    fun baseline(context: Context) {
        val fp = currentFingerprint(context)
        if (fp.isEmpty()) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_SIM_OP, fp)
            .apply()
    }
}
