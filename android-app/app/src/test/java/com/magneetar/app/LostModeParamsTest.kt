package com.magneetar.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LostModeParamsTest {

    @Test
    fun emptyParamsUseDefaultMessage() {
        val p = LostModeParams.parse(null)
        assertEquals(LostModeParams.DEFAULT_MESSAGE, p.message)
        assertNull(p.phone)
    }

    @Test
    fun blankParamsUseDefaultMessage() {
        val p = LostModeParams.parse("   ")
        assertEquals(LostModeParams.DEFAULT_MESSAGE, p.message)
        assertNull(p.phone)
    }

    @Test
    fun messagePreservedWithoutPhone() {
        val p = LostModeParams.parse("Please return this phone to the university security office")
        assertEquals("Please return this phone to the university security office", p.message)
        assertNull(p.phone)
    }

    @Test
    fun phoneExtractedFromMessage() {
        val p = LostModeParams.parse("This phone is lost — call +2348012345678")
        assertEquals("+2348012345678", p.phone)
        assertEquals("This phone is lost — call +2348012345678", p.message)
    }

    @Test
    fun localFormatPhoneExtracted() {
        val p = LostModeParams.parse("Reward if returned. Call 08081234567.")
        assertEquals("08081234567", p.phone)
    }

    @Test
    fun messageWithPunctuationStaysIntact() {
        val message = "If found: call 09033334444, please. Thank you!"
        val p = LostModeParams.parse(message)
        assertEquals("09033334444", p.phone)
        assertEquals(message, p.message)
    }
}
