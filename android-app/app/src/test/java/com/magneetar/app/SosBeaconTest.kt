package com.magneetar.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks the Find Network wire contract between the Android beacon and the
 * server's `secrets.token_hex(8)` format (16 lowercase hex chars).
 *
 * The beacon UUID is deterministic from the token, so the scanner can
 * BLE-filter on it, and the "MG" magic rejects foreign advertisements before
 * any sighting work. Any drift in the byte layout silently breaks the Find
 * Network — these vectors are the tripwire.
 */
class SosBeaconTest {

    @Test
    fun `round-trips a valid server token`() {
        val token = "0123456789abcdef" // the exact shape of token_hex(8)
        val uuid = SosBeacon.serviceUuidFor(token)
        assertTrue("valid token must yield a UUID", uuid != null)
        assertEquals(token, SosBeacon.tokenFromServiceUuid(uuid!!))
    }

    @Test
    fun `round-trips a random token`() {
        val token = "a1b2c3d4e5f60718"
        val uuid = SosBeacon.serviceUuidFor(token)!!
        assertEquals(token, SosBeacon.tokenFromServiceUuid(uuid))
    }

    @Test
    fun `rejects non-Magneetar UUIDs`() {
        // A random UUID (not built from our magic) must decode to null.
        val foreign = java.util.UUID.randomUUID()
        assertNull(SosBeacon.tokenFromServiceUuid(foreign))
    }

    @Test
    fun `rejects malformed tokens`() {
        assertNull(SosBeacon.serviceUuidFor("short"))
        assertNull(SosBeacon.serviceUuidFor("0123456789abcdeG")) // 16 chars, non-hex
        assertNull(SosBeacon.serviceUuidFor("0123456789ABCDEF")) // uppercase
        assertNull(SosBeacon.serviceUuidFor(""))
        assertNull(SosBeacon.serviceUuidFor("0123456789abcdef0")) // 17 chars
    }

    @Test
    fun `rejects a token with the right length but wrong magic`() {
        // 16 hex chars but the token itself can't start with our magic pattern
        // mismatch — feed a UUID with magic bytes intact but corrupt version.
        val good = SosBeacon.serviceUuidFor("0123456789abcdef")!!
        // Flip the version byte (index 2) — the beacon must be rejected.
        val msb = good.mostSignificantBits
        val corrupted = java.util.UUID(msb xor (0xFFL shl 48), good.leastSignificantBits)
        assertNull(SosBeacon.tokenFromServiceUuid(corrupted))
    }

    @Test
    fun `different tokens yield different UUIDs`() {
        val a = SosBeacon.serviceUuidFor("0123456789abcdef")!!
        val b = SosBeacon.serviceUuidFor("abcdef0123456789")!!
        assertTrue(a != b)
    }

    @Test
    fun `same token always yields the same UUID`() {
        val a = SosBeacon.serviceUuidFor("0123456789abcdef")!!
        val b = SosBeacon.serviceUuidFor("0123456789abcdef")!!
        assertEquals(a, b)
    }
}
