package com.magneetar.app

/**
 * Pure parsing for the 'lost_mode' command params — JVM-testable (no Android
 * classes), same pattern as CaptureRouting.
 *
 * The dashboard sends a free-text recovery message via params (e.g. "This
 * phone is lost — call +2348012345678"). A phone number found inside is
 * extracted so the finder can call the owner with one tap; the full message
 * is preserved for display. Empty params fall back to a sensible default so
 * a bare command still produces a useful lock screen.
 */
object LostModeParams {
    const val DEFAULT_MESSAGE = "This device is lost. If found, please call the owner."

    /** 7+ digit numbers with optional country code, separators, and parens. */
    private val PHONE_RE = Regex("""\+?\d[\d\s()\-.]{6,}\d""")

    data class Parsed(val message: String, val phone: String?, val raw: String)

    fun parse(params: String?): Parsed {
        val raw = params?.trim().orEmpty()
        if (raw.isEmpty()) return Parsed(DEFAULT_MESSAGE, null, "")
        val phone = PHONE_RE.find(raw)?.value?.filter { it.isDigit() || it == '+' }
        return Parsed(raw, phone, raw)
    }
}
