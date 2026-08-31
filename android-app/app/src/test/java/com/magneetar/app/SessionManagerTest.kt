package com.magneetar.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [SessionManager] — the pure session timeout logic.
 *
 * All timestamps are explicit millis (no System.currentTimeMillis() dependency),
 * so tests can inject frozen or future times without mocking the clock.
 *
 * Session lifecycle (Opay/Piggyvest/Kuda research-backed):
 * - Idle timeout: 15 minutes → biometric re-auth
 * - Hard timeout: 24 hours → force re-login
 * - First launch (both = 0) → no timeout
 */
class SessionManagerTest {

    private val fifteenMinutes = 15 * 60 * 1000L
    private val twentyFourHours = 24 * 60 * 60 * 1000L
    private val oneHour = 60 * 60 * 1000L

    // ── isSessionExpired (idle timeout) ──────────────────────────────────

    @Test
    fun `not expired when never interacted (first launch)`() {
        assertFalse(SessionManager.isSessionExpired(lastInteraction = 0, now = 1000))
    }

    @Test
    fun `not expired when just interacted`() {
        val now = System.currentTimeMillis()
        assertFalse(SessionManager.isSessionExpired(lastInteraction = now, now = now))
    }

    @Test
    fun `not expired when 14 minutes idle`() {
        val now = System.currentTimeMillis()
        val fourteenMinutesAgo = now - (14 * 60 * 1000L)
        assertFalse(SessionManager.isSessionExpired(lastInteraction = fourteenMinutesAgo, now = now))
    }

    @Test
    fun `expired when 16 minutes idle`() {
        val now = System.currentTimeMillis()
        val sixteenMinutesAgo = now - (16 * 60 * 1000L)
        assertTrue(SessionManager.isSessionExpired(lastInteraction = sixteenMinutesAgo, now = now))
    }

    @Test
    fun `expired exactly at 15 minutes + 1ms`() {
        val now = System.currentTimeMillis()
        val threshold = now - (fifteenMinutes + 1)
        assertTrue(SessionManager.isSessionExpired(lastInteraction = threshold, now = now))
    }

    @Test
    fun `not expired exactly at 15 minutes`() {
        val now = System.currentTimeMillis()
        val threshold = now - fifteenMinutes
        assertFalse(SessionManager.isSessionExpired(lastInteraction = threshold, now = now))
    }

    @Test
    fun `expired after 1 hour idle`() {
        val now = System.currentTimeMillis()
        val oneHourAgo = now - oneHour
        assertTrue(SessionManager.isSessionExpired(lastInteraction = oneHourAgo, now = now))
    }

    // ── isHardTimeout ────────────────────────────────────────────────────

    @Test
    fun `not hard timeout when never started (first launch)`() {
        assertFalse(SessionManager.isHardTimeout(sessionStart = 0, now = 1000))
    }

    @Test
    fun `not hard timeout when session just started`() {
        val now = System.currentTimeMillis()
        assertFalse(SessionManager.isHardTimeout(sessionStart = now, now = now))
    }

    @Test
    fun `not hard timeout when 23 hours old`() {
        val now = System.currentTimeMillis()
        val twentyThreeHoursAgo = now - (23 * 60 * 60 * 1000L)
        assertFalse(SessionManager.isHardTimeout(sessionStart = twentyThreeHoursAgo, now = now))
    }

    @Test
    fun `hard timeout when 25 hours old`() {
        val now = System.currentTimeMillis()
        val twentyFiveHoursAgo = now - (25 * 60 * 60 * 1000L)
        assertTrue(SessionManager.isHardTimeout(sessionStart = twentyFiveHoursAgo, now = now))
    }

    @Test
    fun `hard timeout exactly at 24 hours + 1ms`() {
        val now = System.currentTimeMillis()
        val threshold = now - (twentyFourHours + 1)
        assertTrue(SessionManager.isHardTimeout(sessionStart = threshold, now = now))
    }

    @Test
    fun `not hard timeout exactly at 24 hours`() {
        val now = System.currentTimeMillis()
        val threshold = now - twentyFourHours
        assertFalse(SessionManager.isHardTimeout(sessionStart = threshold, now = now))
    }

    // ── resolveTimeoutAction ─────────────────────────────────────────────

    @Test
    fun `no action on first launch`() {
        val action = SessionManager.resolveTimeoutAction(
            sessionStart = 0,
            lastInteraction = 0,
            now = System.currentTimeMillis(),
        )
        assertEquals(SessionManager.TimeoutAction.NONE, action)
    }

    @Test
    fun `no action when session is fresh`() {
        val now = System.currentTimeMillis()
        val action = SessionManager.resolveTimeoutAction(
            sessionStart = now - 1000,
            lastInteraction = now - 1000,
            now = now,
        )
        assertEquals(SessionManager.TimeoutAction.NONE, action)
    }

    @Test
    fun `biometric reauth when idle timeout triggered`() {
        val now = System.currentTimeMillis()
        val action = SessionManager.resolveTimeoutAction(
            sessionStart = now - oneHour, // Session is 1 hour old (not hard timeout)
            lastInteraction = now - (16 * 60 * 1000L), // 16 min idle (hard timeout)
            now = now,
        )
        assertEquals(SessionManager.TimeoutAction.BIOMETRIC_REAUTH, action)
    }

    @Test
    fun `force relogin when hard timeout triggered`() {
        val now = System.currentTimeMillis()
        val action = SessionManager.resolveTimeoutAction(
            sessionStart = now - (25 * 60 * 60 * 1000L), // 25 hours old
            lastInteraction = now - 1000, // But just interacted
            now = now,
        )
        assertEquals(SessionManager.TimeoutAction.FORCE_RELOGIN, action)
    }

    @Test
    fun `hard timeout takes priority over idle timeout`() {
        // Both timeouts triggered — hard timeout should win
        val now = System.currentTimeMillis()
        val action = SessionManager.resolveTimeoutAction(
            sessionStart = now - (25 * 60 * 60 * 1000L), // 25 hours (hard timeout)
            lastInteraction = now - (20 * 60 * 1000L), // 20 min idle (idle timeout)
            now = now,
        )
        assertEquals(SessionManager.TimeoutAction.FORCE_RELOGIN, action)
    }

    // ── Constants ────────────────────────────────────────────────────────

    @Test
    fun `idle timeout is 15 minutes`() {
        assertEquals(15 * 60 * 1000L, SessionManager.IDLE_TIMEOUT_MS)
    }

    @Test
    fun `hard timeout is 24 hours`() {
        assertEquals(24 * 60 * 60 * 1000L, SessionManager.HARD_TIMEOUT_MS)
    }
}
