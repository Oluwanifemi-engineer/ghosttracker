package com.magneetar.app

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * JVM tests for the adaptive location cadence logic (G1-battery).
 *
 * Tests the pure [TrackingService.resolveLocationInterval] function which
 * determines the GPS update interval based on stationary state, debounce
 * timing, and battery level. No Android types needed — pure math.
 */
class AdaptiveCadenceTest {

    // Mirror the constants from TrackingService companion
    private val LOCATION_INTERVAL_MS = 3_000L
    private val STATIONARY_INTERVAL_MS = 30_000L
    private val STATIONARY_DEBOUNCE_MS = 60_000L
    private val BATTERY_SAVER_INTERVAL_MS = 60_000L
    private val BATTERY_SAVER_THRESHOLD = 15

    @Test
    fun `moving device uses fast interval`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = false,
            wasStationary = false,
            elapsedSinceTransitionMs = 0,
            batteryPercent = 80,
            isCharging = false,
        )
        assertEquals(LOCATION_INTERVAL_MS, result)
    }

    @Test
    fun `moving device uses fast interval even after being stationary`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = false,
            wasStationary = true,
            elapsedSinceTransitionMs = 120_000,
            batteryPercent = 80,
            isCharging = false,
        )
        assertEquals(LOCATION_INTERVAL_MS, result)
    }

    @Test
    fun `stationary first frame starts debounce`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = true,
            wasStationary = false,
            elapsedSinceTransitionMs = 0,
            batteryPercent = 80,
            isCharging = false,
        )
        assertEquals(LOCATION_INTERVAL_MS, result)
    }

    @Test
    fun `stationary during debounce keeps fast interval`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = true,
            wasStationary = true,
            elapsedSinceTransitionMs = 30_000, // 30s < 60s debounce
            batteryPercent = 80,
            isCharging = false,
        )
        assertEquals(LOCATION_INTERVAL_MS, result)
    }

    @Test
    fun `stationary after debounce relaxes to slow interval`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = true,
            wasStationary = true,
            elapsedSinceTransitionMs = 60_000, // exactly 60s debounce
            batteryPercent = 80,
            isCharging = false,
        )
        assertEquals(STATIONARY_INTERVAL_MS, result)
    }

    @Test
    fun `stationary well past debounce uses slow interval`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = true,
            wasStationary = true,
            elapsedSinceTransitionMs = 300_000, // 5 minutes
            batteryPercent = 80,
            isCharging = false,
        )
        assertEquals(STATIONARY_INTERVAL_MS, result)
    }

    @Test
    fun `battery saver overrides stationary to longest interval`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = true,
            wasStationary = true,
            elapsedSinceTransitionMs = 120_000,
            batteryPercent = 10,
            isCharging = false,
        )
        assertEquals(BATTERY_SAVER_INTERVAL_MS, result)
    }

    @Test
    fun `battery saver overrides moving to longest interval`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = false,
            wasStationary = false,
            elapsedSinceTransitionMs = 0,
            batteryPercent = 5,
            isCharging = false,
        )
        assertEquals(BATTERY_SAVER_INTERVAL_MS, result)
    }

    @Test
    fun `charging disables battery saver`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = false,
            wasStationary = false,
            elapsedSinceTransitionMs = 0,
            batteryPercent = 5,
            isCharging = true,
        )
        assertEquals(LOCATION_INTERVAL_MS, result)
    }

    @Test
    fun `battery at zero percent is not battery saver`() {
        // 0% is outside the 1..15 range — device is about to die,
        // not in battery-saver mode (would be dead soon anyway)
        val result = TrackingService.resolveLocationInterval(
            isStationary = false,
            wasStationary = false,
            elapsedSinceTransitionMs = 0,
            batteryPercent = 0,
            isCharging = false,
        )
        assertEquals(LOCATION_INTERVAL_MS, result)
    }

    @Test
    fun `battery at 16 percent is not battery saver`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = false,
            wasStationary = false,
            elapsedSinceTransitionMs = 0,
            batteryPercent = 16,
            isCharging = false,
        )
        assertEquals(LOCATION_INTERVAL_MS, result)
    }

    @Test
    fun `exact debounce boundary relaxes`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = true,
            wasStationary = true,
            elapsedSinceTransitionMs = STATIONARY_DEBOUNCE_MS,
            batteryPercent = 80,
            isCharging = false,
        )
        assertEquals(STATIONARY_INTERVAL_MS, result)
    }

    @Test
    fun `one ms before debounce keeps fast`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = true,
            wasStationary = true,
            elapsedSinceTransitionMs = STATIONARY_DEBOUNCE_MS - 1,
            batteryPercent = 80,
            isCharging = false,
        )
        assertEquals(LOCATION_INTERVAL_MS, result)
    }

    @Test
    fun `battery saver at exact threshold`() {
        val result = TrackingService.resolveLocationInterval(
            isStationary = false,
            wasStationary = false,
            elapsedSinceTransitionMs = 0,
            batteryPercent = BATTERY_SAVER_THRESHOLD,
            isCharging = false,
        )
        assertEquals(BATTERY_SAVER_INTERVAL_MS, result)
    }
}
