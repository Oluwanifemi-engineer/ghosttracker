package com.magneetar.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Permission-free SIM-change listener.
 *
 * The `android.intent.action.SIM_STATE_CHANGED` system broadcast may be
 * received by any app with ZERO permissions (no RECEIVE_SMS / READ_PHONE_STATE
 * — Play-safe, works on both flavors). Note the action is referenced by its
 * literal string: `TelephonyManager.ACTION_SIM_STATE_CHANGED` is hidden from
 * third-party SDK stubs (unresolvable in Kotlin), and the manifest
 * intent-filter already declares the same literal.
 *
 * The receiver just runs the same compare-and-baseline logic as the telemetry
 * path; whichever sees the change first (receiver vs next heartbeat/telemetry)
 * flags it exactly once, and the server fires the always-deliver `sim_changed`
 * alert.
 */
class SimChangeReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "android.intent.action.SIM_STATE_CHANGED") {
            SimChangeMonitor.detect(context)
        }
    }
}
