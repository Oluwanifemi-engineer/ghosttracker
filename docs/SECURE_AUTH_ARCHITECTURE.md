# Magneetar Secure Authentication Architecture

## Executive Summary

Based on deep research of banking apps (Opay, Piggyvest, Kuda), OWASP MASVS V4, and Android security best practices, here is the authentication architecture Magneetar implements.

---

## How Banking Apps Work (Research Findings)

### Session Lifecycle (Opay/Piggyvest/Kuda Pattern)
1. **Initial Authentication**: Email + password → server validates → returns JWT access token (24h) + refresh token (90d)
2. **Token Storage**: Access token + refresh token stored in AndroidKeyStore-backed AES-256-GCM vault (hardware-backed on modern phones)
3. **Token Refresh**: Before access token expires, app silently uses refresh token to get new access token
4. **Session Timeout**: After 15 minutes of inactivity → require biometric re-authentication (presence check)
5. **Hard Timeout**: After 24 hours → require full re-login (email + password)
6. **Background Timeout**: After 5 minutes in background → require biometric on return

### Opay "Double Diamond" Approach
- **Tier 1 (Quick Check)**: 0-2 min background → no re-auth needed
- **Tier 2 (Active Use)**: 2-5 min background → biometric prompt
- **Tier 3 (Idle)**: 5-15 min background → force re-login
- **Tier 4 (Extended)**: 15+ min → clear session, full re-login

### Security Layers
1. **Transport**: All API calls over HTTPS (Cloudflare Tunnel)
2. **Storage**: Tokens encrypted in AndroidKeyStore (hardware-backed)
3. **Validation**: Token validated against server on every app launch
4. **Biometric**: Used as PRESENCE ASSERTION (confirms device owner is present), NOT as authentication itself
5. **Session Timeout**: 15-minute idle timeout, 24-hour hard timeout

---

## What Magneetar Implements

### Layer 1: Token Security ✅
- **Access Token**: 24 hours — used for API calls
- **Refresh Token**: 90 days — used to get new access tokens
- **Storage**: Custom AES-256-GCM vault under AndroidKeyStore (`TokenVault.kt`)
- **On App Launch**: Check for stored tokens → if present, go to dashboard; if absent, show sign-in
- **Token Refresh**: `TrackingService.kt` silently refreshes tokens before expiry

### Layer 2: Session Management ✅
- **Idle Timeout**: 15 minutes of no interaction → require biometric re-authentication
- **Hard Timeout**: 24 hours → require full re-login (clears all tokens)
- **Background Timeout**: 5 minutes in background → require biometric on return
- **Implementation**: `TokenVault.kt` tracks `session_last_interaction` and `session_start_time`
- **Check Point**: `DashboardActivity.onResume()` calls `checkSessionTimeout()`

### Layer 3: Biometric Authentication ✅
- **NOT authentication** — it's a presence assertion (confirms device owner is present)
- **When to use**: After session timeout (15min idle or 5min background)
- **Fallback**: "Sign out" button if biometric fails or user cancels
- **Library**: AndroidX Biometric (`BiometricPrompt`)
- **Implementation**: `DashboardActivity.showBiometricPrompt()`

### Layer 4: Secure Communication ✅
- **HTTPS**: All API calls over TLS via Cloudflare Tunnel
- **Token in Header**: `Authorization: Bearer <token>` (never in URL)
- **No certificate pinning**: Cloudflare handles MITM protection

---

## Implementation Details

### TokenVault (`TokenVault.kt`)
```
┌─────────────────────────────────────────────────────┐
│ TokenVault                                          │
├─────────────────────────────────────────────────────┤
│ save(context, accessToken, refreshToken)            │
│   → AES-256-GCM encrypt under AndroidKeyStore key  │
│                                                     │
│ load(context) → Pair<String, String>                │
│   → Decrypt tokens, return (access, refresh)        │
│                                                     │
│ clear(context)                                      │
│   → Remove all tokens + session state               │
│   → Keystore key preserved (survives data clears)   │
│                                                     │
│ recordInteraction(context)                          │
│   → Update session_last_interaction timestamp       │
│                                                     │
│ isSessionExpired(context) → Boolean                 │
│   → True if idle > 15 minutes                       │
│                                                     │
│ isHardTimeout(context) → Boolean                    │
│   → True if session > 24 hours                      │
│                                                     │
│ startSession(context)                               │
│   → Record session start time (after login)         │
│                                                     │
│ markBioAuthenticated(context)                       │
│   → Record biometric verification                   │
└─────────────────────────────────────────────────────┘
```

### Session Flow
```
App Launch (MainActivity)
    ↓
Has tokens? → Yes → Dashboard
                   ↓
              onResume()
                   ↓
              checkSessionTimeout()
                   ↓
              ┌─ Hard timeout (24h)? → Yes → clear() → Sign In
              │
              └─ No → Idle timeout (15min)? → Yes → Biometric Prompt
                                                      ↓
                                              ┌─ Success → Continue
                                              │
                                              └─ Fail/Cancel → clear() → Sign In
```

### Server JWT Settings
- Access token: 24 hours (matches app hard timeout)
- Refresh token: 90 days
- Token type: "dashboard" for user sessions, "device" for device sessions
- 2FA challenge: 5 minutes (single-use)

---

## What's NOT Implemented (Future)

1. **Certificate Pinning**: Cloudflare handles this at the edge
2. **EncryptedSharedPreferences**: Custom AES-GCM vault is equivalent
3. **PIN fallback**: Biometric "Sign out" is the only fallback (simpler)
4. **Concurrent session control**: Single-device session model
5. **Server-side session invalidation**: JWT is stateless; refresh token rotation handles revocation

---

## References

1. Opay Digital Banking App — Session Time-out UX (Medium, 2022)
2. Secure Session Management in Mobile Banking Apps (Simpa Labs, 2025)
3. OWASP MASVS V4 — Authentication and Session Management
4. Android Developer Documentation — Secure user authentication (2026)
5. JWT Security Best Practices (Curity, 2024)
6. Session Timeout Best Practices (Descope, 2025)
