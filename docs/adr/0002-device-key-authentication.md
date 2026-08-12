# ADR-0002: Device Key Authentication Architecture

**Date:** 2026-08-09  
**Status:** Accepted  
**Deciders:** Oluwanifemi Tinubu  
**Technical Story:** Need to document the security architecture for device authentication

## Context

Magneetar needs a secure authentication system that:
1. Prevents unauthorized access to device telemetry
2. Works even when the APK is publicly available
3. Supports multiple devices per user
4. Maintains backward compatibility during key rotation

The threat model includes:
- APK extraction and key harvesting
- Database breaches
- Man-in-the-middle attacks
- Stolen devices

## Decision

Implement a **two-tier key architecture**:

### Tier 1: Master Key (`MT_API_KEY`)
- Server-side only, never embedded in APK
- Grants dashboard admin access
- Used for: dashboard login, admin operations, step-up authentication

### Tier 2: Device Key (`MT_DEVICE_KEY`)
- Embedded in every APK (`BuildConfig.DEVICE_KEY`)
- Low-privilege, device-scope only
- Used for: device registration, location uploads, media uploads, command polling

### Tier 3: Legacy Device Key (`MT_LEGACY_DEVICE_KEY`)
- The pre-split master key
- Accepted only for device-scope auth during rotation grace period
- Allows old APKs to keep working until users upgrade

> **Update (2026-08-10):** Tier 3 is **retired** — `MT_LEGACY_DEVICE_KEY`
> was removed from the codebase (`config.py`, `auth.py`, env templates) and
> `test_device_key_separation.py` asserts a legacy-style key is rejected.
> Installed APKs that still present the old master key can no longer
> authenticate; upgrade them to an APK embedding `MT_DEVICE_KEY`.

### Authentication Flow

```
Device Request
    ↓
Check x-device-key header
    ↓
Hash with SHA-256
    ↓
Compare against stored device_key_hash
    ↓
If match → allow device-scope operations
If no match → try x-api-key (must be device key)
If no match → 401 Unauthorized
```

### Why This Architecture?

1. **Defense in depth**: Extracting the device key from APK buys nothing (can't access dashboard)
2. **Graceful rotation**: Old APKs keep working via legacy key
3. **Blast radius containment**: Compromising one device doesn't affect others
4. **Audit trail**: Each device has unique identity in logs

## Consequences

### Positive
- APK extraction is low-value (device key only)
- Key rotation is safe and gradual
- Per-device identity enables fine-grained access control
- Simple implementation with strong security properties

### Negative
- More complex than single-key approach
- Need to manage multiple key types
- Legacy key adds temporary attack surface (retired after fleet upgrade)

## Related ADRs
- ADR-0001: SQLite as Primary Database
