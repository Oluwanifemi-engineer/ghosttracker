package com.magneetar.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Failed-unlock ("theftie") screen-state listener.
 *
 * Feeds the keyguard heuristic in [FailedUnlockMonitor]:
 *
 *   - `ACTION_SCREEN_ON` — if the keyguard is still locked, opens a locked
 *     session (a screen-on that never reaches the launcher).
 *   - `ACTION_SCREEN_OFF` — a still-locked session counts as one failed
 *     attempt.
 *   - `ACTION_USER_PRESENT` — a successful unlock resets the counter.
 *
 * These are protected system broadcasts (exempt from the implicit-broadcast
 * ban), so a manifest receiver receives them with zero permissions and no
 * runtime registration — the same pattern as SimChangeReceiver. The receiver
 * never touches the network; it only updates a SharedPreferences counter
 * that the next telemetry ping / heartbeat reports.
 *
 * KNOWN LIMIT (honest, same as SimChangeMonitor's): the broadcast fires for
 * the app's own unlocks too — the server's reaction is threshold-gated
 * (default 5) and the DPC count (when the app is device admin/owner) is
 * authoritative, so a normal owner's single missed unlock never trips it.
 */
class FailedUnlockReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SCREEN_ON -> FailedUnlockMonitor.onScreenOn(context)
            Intent.ACTION_SCREEN_OFF -> FailedUnlockMonitor.onScreenOff(context)
            Intent.ACTION_USER_PRESENT -> FailedUnlockMonitor.onUserPresent(context)
        }
    }
}
