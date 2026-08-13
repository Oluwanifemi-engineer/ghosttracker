package com.magneetar.app

import java.util.UUID

/**
 * Find Network (COMPETITOR_AUDIT P1 #6, Phase 1) — the on-air beacon codec.
 *
 * The stolen device broadcasts its recovery request's opaque `beacon_token`
 * over BLE; guardian phones in range pick it up and report the token back to
 * the server (which resolves token -> request). Two privacy properties are
 * baked into the design:
 *
 *   1. The REQUEST ID never goes on the air — only the random per-request
 *      token, which is meaningless without the server-side mapping. A random
 *      scanner cannot tell whose phone is broadcasting.
 *   2. The service UUID is deterministic from the token, so a guardian's
 *      scanner can BLE-filter on it (power-efficient) and validate it on
 *      receipt via the "MG" magic — foreign BLE advertisements are rejected
 *      before any sighting work happens.
 *
 * Wire format (16 bytes, the size of a 128-bit UUID):
 *
 *   [ 0x4D 0x47 ] [ 0x01 ] [ 8 raw bytes = 16 hex chars of token ] [ 5 zero pad ]
 *        magic      version                   token                       reserved
 *
 *   - 0x4D 0x47 = "MG" magic — instant rejection of non-Magneetar beacons.
 *   - version 0x01 = the current format.
 *   - the 16-char lowercase-hex beacon_token (server: `secrets.token_hex(8)`)
 *     is packed into 8 raw bytes so it fits the fixed 16-byte UUID.
 *   - the RFC-4122 version/variant nibbles are deliberately NOT set: Android's
 *     BluetoothLeAdvertiser accepts any UUID object (the UUID(msb, lsb)
 *     constructor does not validate them), and reserving those bits would
 *     corrupt token bytes 6 and 8.
 *
 * This file is deliberately free of Android types so the wire contract is
 * locked on the plain JVM (see SosBeaconTest.kt). Drift on either side
 * silently breaks the Find Network — the test is the tripwire.
 */
object SosBeacon {

    /** Fixed magic bytes — "MG" as the first two UUID bytes. */
    private val MAGIC = byteArrayOf(0x4D, 0x47)

    private const val VERSION: Byte = 0x01

    /** A token is 16 lowercase hex chars (server: `secrets.token_hex(8)`). */
    fun isValidToken(token: String?): Boolean =
        token != null && token.length == 16 && token.all { it in "0123456789abcdef" }

    /**
     * Build the 128-bit service UUID to advertise for [token].
     * Returns null when the token is malformed (never throws).
     */
    fun serviceUuidFor(token: String): UUID? {
        if (!isValidToken(token)) return null
        return try {
            val bytes = ByteArray(16)
            MAGIC.copyInto(bytes, 0)
            bytes[2] = VERSION
            // Pack the 16 hex chars into 8 raw bytes (two chars per byte).
            for (i in 0 until 8) {
                val hi = hexNibble(token[i * 2])
                val lo = hexNibble(token[i * 2 + 1])
                bytes[3 + i] = ((hi shl 4) or lo).toByte()
            }
            // bytes[11..15] stay zero (reserved).
            uuidFromBytes(bytes)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Recover the token from a detected UUID, or null when it is not a
     * Magneetar SOS beacon (magic mismatch / malformed token). Inverse of
     * [serviceUuidFor]; used by the guardian scanner to decide whether a
     * sighting should be reported.
     */
    fun tokenFromServiceUuid(uuid: UUID): String? {
        return try {
            val bytes = toBytes(uuid)
            if (bytes.size != 16) return null
            if (bytes[0] != MAGIC[0] || bytes[1] != MAGIC[1]) return null
            if (bytes[2] != VERSION) return null
            val sb = StringBuilder(16)
            for (i in 0 until 8) {
                val b = bytes[3 + i].toInt() and 0xFF
                sb.append("0123456789abcdef"[b shr 4])
                sb.append("0123456789abcdef"[b and 0x0F])
            }
            val token = sb.toString()
            if (isValidToken(token)) token else null
        } catch (e: Exception) {
            null
        }
    }

    private fun hexNibble(c: Char): Int = when (c) {
        in '0'..'9' -> c - '0'
        in 'a'..'f' -> c - 'a' + 10
        in 'A'..'F' -> c - 'A' + 10
        else -> 0
    }

    private fun uuidFromBytes(bytes: ByteArray): UUID {
        var msb = 0L
        var lsb = 0L
        for (i in 0 until 8) msb = (msb shl 8) or (bytes[i].toLong() and 0xFF)
        for (i in 8 until 16) lsb = (lsb shl 8) or (bytes[i].toLong() and 0xFF)
        return UUID(msb, lsb)
    }

    private fun toBytes(uuid: UUID): ByteArray {
        val msb = uuid.mostSignificantBits
        val lsb = uuid.leastSignificantBits
        return ByteArray(16).also { out ->
            for (i in 0 until 8) out[i] = (msb shr ((7 - i) * 8)).toByte()
            for (i in 0 until 8) out[8 + i] = (lsb shr ((7 - i) * 8)).toByte()
        }
    }
}
