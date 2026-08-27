# Magneetar — Project Status

**Date:** August 27, 2026
**Version:** 1.4.4
**Status:** Pilot-ready MVP

---

## What happened

The project started as a feature-heavy anti-theft platform with 25 route modules, a Guardian Network, P2P device pairing, USSD payments, WhatsApp bots, digital inheritance, community watch maps, recovery bounties, referral programs, NPS surveys, trust scores, and "AI-powered smart geofences."

That was too much for one person.

On August 27, the project was stripped to its core: **tracking, theft detection, alerts, and remote commands.** 19 route modules deleted. 8 dashboard pages removed. 7 component directories cleaned out. The app icon was fixed to stop overflowing the Android squircle.

The result: a lean, focused MVP that actually works.

## Current state

| Component | Status | Tests |
|-----------|--------|-------|
| **Server (FastAPI)** | 4 route modules, 73 endpoints | 535 passing |
| **Dashboard (Next.js)** | Stripped to core pages | 209 passing |
| **Android app** | APK built (7.4MB) | - |
| **TypeScript** | Clean | 0 errors |
| **Server** | Deployed, healthy | `/health` green |

## What was removed

### Server (20 route modules deleted)
- Guardian Network (community recovery)
- P2P device pairing
- Paystack payments
- Family Safety Circles
- Community Watch Map
- Recovery Bounties
- Support Tickets
- NPS Surveys
- Email Tracking
- Trust Scores / IMEI verification
- Digital Inheritance
- Smart Geofences (AI)
- Referral Program
- WhatsApp Bot
- USSD Menu / USSD Payments
- WhatsApp Catalog
- GDPR data export
- Developer API Keys

### Dashboard (8 pages, 7 component directories deleted)
- Community, Compare, Developers, Trust, Admin, Payment-Success pages
- Bounty, Family, Inheritance, Referral, Trust, Admin components
- GuardianPanel, AnalyticsPanel, CommunityHeatmap

### What remains
- Device registration + JWT auth
- Real-time GPS tracking (3s intervals)
- Sentinel theft detection + auto-evidence capture
- Remote commands (lock, siren, alarm, wipe, capture)
- Geofencing with auto-actions
- Device sharing with RBAC (owner/admin/viewer/device_only)
- Push/SMS/WhatsApp alerts
- Evidence PDF export
- Location CSV export
- 2FA (TOTP)

## App icon fix

**Problem:** The M mark was 315x512px, going edge-to-edge vertically (0px top/bottom margin). Android's squircle mask clipped the top and bottom.

**Fix:** Scaled to 286x286px, centered with 113px margins on all sides. Regenerated all mipmap densities (mdpi through xxxhdpi).

## Pilot prep

| File | Purpose |
|------|---------|
| `scripts/deploy-mvp.sh` | One-command Docker deploy |
| `docs/PILOT_BRIEF.md` | Product brief for testers |
| `docs/QUICK_START.md` | 30-second install guide |
| `docs/TESTER_INVITE.md` | WhatsApp message template |
| `docs/PRE_LAUNCH_CHECKLIST.md` | Everything before sending APK |

## What's next

1. Configure alerts (Twilio or Firebase)
2. Test on own phone first
3. Send to 1 person, watch them install
4. Send to 10 people
5. After 30 days, ask: "Would you pay ₦500/month?"

## Numbers

- **26,370 → 18,081 lines** of Python (31% reduction)
- **25 → 4 route modules**
- **129 → 73 HTTP endpoints**
- **835 → 744 tests** (535 backend + 209 dashboard)
- **3 clean commits**, all pre-commit hooks passing
