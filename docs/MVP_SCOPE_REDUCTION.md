# Magneetar — MVP Scope Reduction

**Date:** August 2026  
**Status:** Actionable — execute before writing any new code

---

## The Problem

The codebase has **57 Python source files, 79 Kotlin files, 30+ route modules, and 12+ dashboard components**. This is an enterprise-scale feature set built by one person with zero users. The scope is killing the project more than any technical debt.

**Rule of thumb:** If you can't explain your MVP in one sentence, it's too big.

**One sentence:** "Magneetar tracks your Android phone, alerts you when it's stolen, and helps you recover it."

---

## What to CUT (permanently, not "later")

These features exist in the codebase but **no real user has ever needed them**. Cut them to reduce cognitive load and maintenance burden:

| Feature | Why Cut | Lines Saved (est.) |
|---------|---------|-------------------|
| **USSD routes** (`ussd.py`, `ussd_payments.py`) | No USSD provider configured, no users | ~700 |
| **WhatsApp catalog** (`whatsapp_catalog.py`) | WhatsApp Business catalog for what? | ~330 |
| **Referral program** (`referrals.py`) | No users = no referrals | ~200 |
| **NPS surveys** (`nps.py`) | Survey for 0 users | ~150 |
| **Email tracking** (`email_tracking.py`) | Track emails nobody sends | ~150 |
| **Support tickets** (`support.py`) | Support for 0 users | ~200 |
| **Trust score** (`trust_score.py`) | IMEI verification with no database | ~200 |
| **Digital inheritance** (`inheritance.py`) | Future feature, not MVP | ~200 |
| **Smart geofence AI** (`smart_geofence.py`) | AI geofencing is overkill for MVP | ~200 |
| **Community watch map** (`community.py`) | Needs users to generate data | ~200 |
| **Bounties** (`bounties.py`) | Needs users + payment integration | ~200 |
| **Family circles** (`family.py`) | Overlaps with device sharing (already built) | ~200 |
| **Developer API keys** (`api_keys.py`) | External API for 0 integrations | ~300 |

**Total: ~3,430 lines of dead code removed.**

---

## The MVP: 5 Features That Actually Matter

### Feature 1: Device Tracking (the core)
**What:** Android phone reports GPS location every 3 seconds, dashboard shows live map.  
**Already built:** ✅ Yes — `routes/devices.py`, `TrackingService.kt`, Leaflet map.  
**Keep:** Everything in `routes/devices.py` related to location, heartbeat, registration.  
**Status:** PRODUCTION READY

### Feature 2: Theft Detection + Alerts (the differentiator)
**What:** Sentinel AI detects theft (SIM change, speed, failed unlocks), auto-alerts owner via push/SMS/WhatsApp.  
**Already built:** ✅ Yes — `sentinel.py`, `alerts.py`, FCM integration.  
**Keep:** `sentinel.py`, `alerts.py`, all alert channel integrations.  
**Status:** PRODUCTION READY

### Feature 3: Remote Commands (the recovery)
**What:** Owner can lock, alarm, wipe, capture photo/audio from the dashboard.  
**Already built:** ✅ Yes — command system in `routes/devices.py`, Android command handler.  
**Keep:** Lock, alarm, wipe, capture_photo, capture_audio commands.  
**Status:** PRODUCTION READY

### Feature 4: Evidence Capture + PDF (the proof)
**What:** Auto-capture photos/audio on theft, generate police-ready PDF evidence report.  
**Already built:** ✅ Yes — `evidence.py`, `evidence_pdf.py`, `media_store.py`.  
**Keep:** Evidence chain, PDF generation, media storage.  
**Status:** PRODUCTION READY

### Feature 5: Device Sharing (the family angle)
**What:** Share device access with family members (viewer/admin roles).  
**Already built:** ✅ Yes — `device_shares` table, RBAC in `routes/dashboard.py`.  
**Keep:** Sharing endpoints, role enforcement, dashboard sharing UI.  
**Status:** PRODUCTION READY

---

## What to DEFER (not cut, but don't touch until you have 10 users)

| Feature | Why Defer | When to Revisit |
|---------|-----------|-----------------|
| iOS app | Build pending a Mac; Android-first market | After 100 Android users |
| BLE Find Network | Needs guardian adoption first | After 50 active users |
| Payments (Paystack) | No revenue until users exist | After first paying user |
| Kubernetes deployment | Single server handles 1,000 users | After SQLite hits limits |
| Multi-language | English works for Nigerian tech users | After international expansion |
| Hardware tags | Manufacturing + certification = months | After software product-market fit |
| E2E encryption | Scaffold only; security is already solid | After threat model requires it |

---

## The Math

| Metric | Before | After |
|--------|--------|-------|
| Python source files | 57 | ~35 |
| Route modules | 30+ | ~10 |
| Android Kotlin files | 79 | 79 (keep all — they're all needed) |
| Dashboard components | 25+ test files | 25 (keep all — they test real features) |
| Dead code lines | ~3,400 | 0 |
| Maintenance surface | Massive | Focused |

---

## How to Execute

1. **Don't delete the cut files** — move them to `archive/` with a README explaining why
2. **Remove the route includes** from `main.py` (the `app.include_router()` calls)
3. **Update the dashboard** to hide tabs for deferred features
4. **Update the README** to reflect the 5-feature MVP
5. **Run `make test`** — if tests break, the cut features had hidden dependencies

---

## The One Rule

**No new features until 10 real users are using these 5 features daily.**

Every hour spent on USSD payments, referral programs, or AI geofencing is an hour not spent getting the APK on real phones.
