package com.magneetar.app

/**
 * Pure session timeout logic — no Android dependencies.
 *
 * Separated from TokenVault so the timeout calculations can be unit-tested
 * without Robolectric or a real SharedPreferences instance.
 *
 * Session lifecycle (Opay/Piggyvest/Kuda research-backed):
 * 1. startSession() → record session start + first interaction
 * 2. recordInteraction() → update last interaction timestamp
 * 3. isSessionExpired(now) → true if idle > 15 minutes
 * 4. isHardTimeout(now) → true if session > 24 hours
 *
 * All methods take explicit timestamps (millis since epoch) instead of
 * reading System.currentTimeMillis(), so tests can inject frozen/future
 * times without mocking the clock.
 */
object SessionManager {

    /** Idle timeout: 15 minutes of inactivity → require biometric re-auth */
    const val IDLE_TIMEOUT_MS = 15 * 60 * 1000L

    /** Hard timeout: 24 hours → require full re-login */
    const val HARD_TIMEOUT_MS = 24 * 60 * 60 * 1000L

    /**
     * Check if the session has timed out due to inactivity.
     *
     * @param lastInteraction Timestamp of last user interaction (millis)
     * @param now Current time (millis)
     * @return true if idle time exceeds [IDLE_TIMEOUT_MS]
     */
    fun isSessionExpired(lastInteraction: Long, now: Long): Boolean {
        if (lastInteraction == 0L) return false // First launch, no timeout yet
        return now - lastInteraction > IDLE_TIMEOUT_MS
    }

    /**
     * Check if the hard timeout has been exceeded.
     *
     * @param sessionStart Timestamp when the session began (millis)
     * @param now Current time (millis)
     * @return true if session duration exceeds [HARD_TIMEOUT_MS]
     */
    fun isHardTimeout(sessionStart: Long, now: Long): Boolean {
        if (sessionStart == 0L) return false // First launch, no timeout yet
        return now - sessionStart > HARD_TIMEOUT_MS
    }

    /**
     * Determine the timeout action needed based on current state.
     *
     * @param sessionStart When the session started (millis), 0 if none
     * @param lastInteraction Last user interaction (millis), 0 if none
     * @param now Current time (millis)
     * @return TimeoutAction indicating what the UI should do
     */
    fun resolveTimeoutAction(
        sessionStart: Long,
        lastInteraction: Long,
        now: Long,
    ): TimeoutAction {
        // Hard timeout takes priority over idle timeout
        if (isHardTimeout(sessionStart, now)) {
            return TimeoutAction.FORCE_RELOGIN
        }
        if (isSessionExpired(lastInteraction, now)) {
            return TimeoutAction.BIOMETRIC_REAUTH
        }
        return TimeoutAction.NONE
    }

    enum class TimeoutAction {
        /** No timeout — continue as normal */
        NONE,
        /** Idle timeout — require biometric presence check */
        BIOMETRIC_REAUTH,
        /** Hard timeout — force full re-login (clear tokens) */
        FORCE_RELOGIN,
    }
}
