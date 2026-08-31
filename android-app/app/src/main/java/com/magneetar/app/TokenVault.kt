package com.magneetar.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Encrypted vault for the user's session credentials (the 24h access JWT and
 * the 90-day refresh token).
 *
 * These were previously stored in plain SharedPreferences — readable by
 * anyone with root on a stolen device, which would hand over a full 90-day
 * account session (view all linked devices, issue commands, wipe other
 * devices). They are now wrapped in AES-256-GCM under an AndroidKeyStore
 * key: the key never leaves the device (hardware-backed on modern phones),
 * so even a full extraction of the prefs XML yields only ciphertext.
 *
 * Migration: the first read after an upgrade transparently encrypts any
 * legacy plaintext tokens and deletes the plaintext copies.
 *
 * Degradation: if the Keystore key is gone (app data cleared / reinstall),
 * reads return empty strings and callers degrade to the sign-in screen —
 * never a crash. The key survives app updates and is independent of the
 * lock screen (background services must read it while the phone is locked).
 */
object TokenVault {

    private const val KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "magneetar_session_key"
    private const val PREF_ACCESS = "user_token_v2"
    private const val PREF_REFRESH = "user_refresh_token_v2"
    private const val LEGACY_ACCESS = "user_token"
    private const val LEGACY_REFRESH = "user_refresh_token"
    private const val GCM_TAG_BITS = 128

    private fun getOrCreateKey(): SecretKey? = try {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (ks.getKey(KEY_ALIAS, null) as? SecretKey) ?: run {
            val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
            generator.init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build()
            )
            generator.generateKey()
        }
    } catch (e: Exception) {
        null
    }

    private fun encrypt(key: SecretKey, plain: String): String? = try {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val ct = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + "." + Base64.encodeToString(ct, Base64.NO_WRAP)
    } catch (e: Exception) {
        null
    }

    private fun decrypt(key: SecretKey, blob: String): String? = try {
        val parts = blob.split(".", limit = 2)
        if (parts.size != 2) {
            null
        } else {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                GCMParameterSpec(GCM_TAG_BITS, Base64.decode(parts[0], Base64.NO_WRAP))
            )
            String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
        }
    } catch (e: Exception) {
        null
    }

    /** Save both session tokens (encrypted). Never leaves plaintext behind. */
    fun save(context: Context, accessToken: String, refreshToken: String) {
        val key = getOrCreateKey() ?: return
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        prefs.edit().apply {
            encrypt(key, accessToken)?.let { putString(PREF_ACCESS, it) }
            encrypt(key, refreshToken)?.let { putString(PREF_REFRESH, it) }
            remove(LEGACY_ACCESS)
            remove(LEGACY_REFRESH)
        }.apply()
    }

    /** Read both session tokens; transparently migrates legacy plaintext. */
    fun load(context: Context): Pair<String, String> {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        var access = prefs.getString(PREF_ACCESS, "") ?: ""
        var refresh = prefs.getString(PREF_REFRESH, "") ?: ""
        if (access.isEmpty() || refresh.isEmpty()) {
            val legacyAccess = prefs.getString(LEGACY_ACCESS, "") ?: ""
            val legacyRefresh = prefs.getString(LEGACY_REFRESH, "") ?: ""
            if (legacyAccess.isNotEmpty() || legacyRefresh.isNotEmpty()) {
                save(context, legacyAccess, legacyRefresh)
                access = prefs.getString(PREF_ACCESS, "") ?: ""
                refresh = prefs.getString(PREF_REFRESH, "") ?: ""
            }
        }
        val key = getOrCreateKey() ?: return Pair("", "")
        return Pair(
            if (access.isNotEmpty()) decrypt(key, access) ?: "" else "",
            if (refresh.isNotEmpty()) decrypt(key, refresh) ?: "" else ""
        )
    }

    /** Convenience: read just the access token. */
    fun accessToken(context: Context): String = load(context).first

    /** Convenience: read just the refresh token. */
    fun refreshToken(context: Context): String = load(context).second

    /** Clear all stored tokens — called on sign-out or when token is invalid.
     *
     * NOTE: The Keystore key is deliberately NOT deleted. It survives app
     * data clears and is hardware-backed on modern phones. Deleting it would
     * make all encrypted data permanently unrecoverable if there's a crash
     * during sign-out or if the user accidentally clears app data.
     */
    fun clear(context: Context) {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        prefs.edit().apply {
            remove(PREF_ACCESS)
            remove(PREF_REFRESH)
            remove(LEGACY_ACCESS)
            remove(LEGACY_REFRESH)
            remove("session_last_interaction")
            remove("session_bio_authenticated")
            remove("session_start_time")
            remove("last_background_time")
        }.apply()
    }

    // ── Session Management ──────────────────────────────────────────────
    // Delegates to SessionManager for testable pure logic.

    /** Session timeout: 15 minutes of inactivity (banking standard) */
    const val SESSION_IDLE_TIMEOUT_MS = SessionManager.IDLE_TIMEOUT_MS

    /** Hard timeout: 24 hours — require full re-login */
    const val SESSION_HARD_TIMEOUT_MS = SessionManager.HARD_TIMEOUT_MS

    /** Record that the user interacted with the app (call on every onResume). */
    fun recordInteraction(context: Context) {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        prefs.edit().putLong("session_last_interaction", System.currentTimeMillis()).apply()
    }

    /** Check if session has timed out (idle > 15 min). */
    fun isSessionExpired(context: Context): Boolean {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        val lastInteraction = prefs.getLong("session_last_interaction", 0)
        return SessionManager.isSessionExpired(lastInteraction, System.currentTimeMillis())
    }

    /** Check if hard timeout exceeded — require full re-login. */
    fun isHardTimeout(context: Context): Boolean {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        val sessionStart = prefs.getLong("session_start_time", 0)
        return SessionManager.isHardTimeout(sessionStart, System.currentTimeMillis())
    }

    /** Mark session as started (call after successful login). */
    fun startSession(context: Context) {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putLong("session_start_time", System.currentTimeMillis())
            putLong("session_last_interaction", System.currentTimeMillis())
            putBoolean("session_bio_authenticated", false)
        }.apply()
    }

    /** Mark biometric as verified (for idle timeout re-auth). */
    fun markBioAuthenticated(context: Context) {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean("session_bio_authenticated", true)
            putLong("session_last_interaction", System.currentTimeMillis())
        }.apply()
    }

    /** Check if biometric has been verified in this session. */
    fun isBioAuthenticated(context: Context): Boolean {
        val prefs = context.getSharedPreferences("mt", Context.MODE_PRIVATE)
        return prefs.getBoolean("session_bio_authenticated", false)
    }
}
