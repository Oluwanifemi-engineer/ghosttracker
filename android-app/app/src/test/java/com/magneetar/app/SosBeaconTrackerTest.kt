package com.magneetar.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks the guardian sighting cooldown contract: a beacon token reported
 * within the cooldown window is never re-reported (the server rate-limits
 * guardians to 10 sightings/hour, so a scanner that reported every repeated
 * BLE advertisement would burn the whole budget on one device).
 */
class SosBeaconTrackerTest {

    private class MemoryStore(var json: String = "") : StringStore {
        override fun read(): String = json
        override fun write(json: String) { this.json = json }
    }

    private var now = 1_000_000L

    private fun tracker(store: MemoryStore = MemoryStore()) =
        SosBeaconTracker(store, nowMs = { now })

    @Test
    fun `unknown token is not in cooldown`() {
        assertFalse(tracker().isInCooldown("0123456789abcdef"))
    }

    @Test
    fun `reported token is in cooldown immediately`() {
        val t = tracker()
        t.rememberReported("0123456789abcdef")
        assertTrue(t.isInCooldown("0123456789abcdef"))
    }

    @Test
    fun `cooldown expires after the window`() {
        val t = tracker()
        t.rememberReported("0123456789abcdef")
        now += SosBeaconTracker.DEFAULT_COOLDOWN_MS + 1
        assertFalse(t.isInCooldown("0123456789abcdef"))
    }

    @Test
    fun `re-remembering refreshes the cooldown window`() {
        val t = tracker()
        t.rememberReported("0123456789abcdef")
        now += SosBeaconTracker.DEFAULT_COOLDOWN_MS - 1_000
        // Still in range — the scanner refreshes the record.
        t.rememberReported("0123456789abcdef")
        now += 2_000
        assertTrue(t.isInCooldown("0123456789abcdef"))
    }

    @Test
    fun `a new token for the same device is not blocked`() {
        // A NEW recovery request mints a NEW token — the cooldown must not
        // suppress a genuinely fresh, actionable sighting.
        val t = tracker()
        t.rememberReported("0123456789abcdef")
        assertFalse(t.isInCooldown("abcdef0123456789"))
    }

    @Test
    fun `distinct tokens are tracked independently`() {
        val t = tracker()
        t.rememberReported("aaaa000000000000")
        assertTrue(t.isInCooldown("aaaa000000000000"))
        assertFalse(t.isInCooldown("bbbb000000000000"))
    }

    @Test
    fun `old entries are pruned on write`() {
        val store = MemoryStore()
        val t = tracker(store)
        t.rememberReported("aaaa000000000000")
        now += SosBeaconTracker.DEFAULT_COOLDOWN_MS * 2 + 5_000
        t.rememberReported("bbbb000000000000")
        assertFalse(t.isInCooldown("aaaa000000000000"))
        assertTrue(t.isInCooldown("bbbb000000000000"))
        // The serialized store stays bounded.
        assertEquals(1, store.json.split(";").filter { it.isNotEmpty() }.size)
    }

    @Test
    fun `corrupt store degrades to empty instead of crashing`() {
        val t = tracker(MemoryStore("{not a token map"))
        assertFalse(t.isInCooldown("0123456789abcdef"))
        t.rememberReported("0123456789abcdef")
        assertTrue(t.isInCooldown("0123456789abcdef"))
    }
}
