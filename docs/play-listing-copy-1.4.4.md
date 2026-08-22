# Magneetar — Google Play listing copy (v1.4.4 AAB)

> Status: **DRAFT for the internal-testing upload** (ADR-0007). This copy is
> written for the first AAB upload to the **internal testing track** — it is
> NOT a production listing yet (gated on G1/G2 real-world validation per
> ADR-0006). Every claim below is verifiable; there are NO adoption numbers,
> NO recovery-rate statistics, and NO unverifiable marketing (S-7 rule:
> "EVERY CLAIM ON THIS PAGE IS VERIFIABLE").

---

## App name
Magneetar — Anti-Theft Guardian

## Short description (≤80 chars)
```
Anti-theft for Android: track, lock, alarm, and capture evidence on theft.
```
(64 chars — within the 80-char limit.)

## Full description (≤4,000 chars)

```
Magneetar protects your Android phone against theft and loss. It runs on
stock Android — no root, no jailbreak — and turns your phone into a
theft-resistant device.

WHAT MAGNEETAR DOES
• Real-time tracking — follow your device on a live map with fresh
  location updates every few seconds.
• Sentinel theft detection — an AI score watches for theft signals: SIM
  change, failed unlocks, location off, airplane mode, device-admin
  disabled, unusual movement, geofence exit. When the threshold is
  crossed, the device escalates to evidence mode automatically.
• Evidence capture — during a theft response the device takes a front-
  camera photo burst and records ambient audio (VAD-gated), building a
  SHA-256-chained evidence case for the owner.
• Remote commands — lock the screen, sound an alarm, or wipe the device
  from the web dashboard.
• Geofences — mark a safe zone; leaving it triggers an alert and optional
  on-device reaction (capture, siren, or alert only).
• Always-deliver alerts — theft signals reach you through every enabled
  channel: push notification, email, SMS, or WhatsApp.
• Role-based sharing — grant family or team members viewer, admin, or
  privacy-only (status glance, no location) access.
• Guardian Network — the optional community recovery feature lets nearby
  opted-in volunteers receive a privacy-preserving beacon when your
  device is reported stolen.

PRIVACY & SECURITY
• Encrypted in transit (TLS) and at rest (AES-256-GCM).
• Evidence captured only during an armed theft response — never
  continuously.
• TOTP two-factor authentication; destructive actions re-verify your
  password.
• No ads, no analytics SDKs, no data sold. Your data lives on your own
  Magneetar server and is yours to export or delete.
• Source is published as release tarballs so claims can be verified.

PERMISSIONS — WHAT THEY ARE FOR
• Location (incl. background): theft tracking. Prominent disclosure shown
  at first launch; tracking can be switched off anytime.
• Camera + Microphone: evidence capture during a theft response only.
• Notifications: theft alerts and command results.
• Device admin: prevents a thief from uninstalling the app and enables
  remote lock. Activated with your explicit consent.
• Overlay: theft-deterrent warning screen during a response.

Magneetar is for owners protecting their own devices. It is not a
surveillance tool — you may only use it on devices you own or have
explicit permission to protect.
```

## Play Console form answers (mapped from docs/play-store-checklist.md)

### Permissions Declaration
| Permission | Explanation (feature, user value, data handling) |
|---|---|
| `ACCESS_BACKGROUND_LOCATION` | Theft detection requires location even when the app is in the background; a foreground location service runs while tracking is enabled; per-device opt-in with prominent disclosure (screenshot below). |
| `SCHEDULE_EXACT_ALARM` | Watchdog/health alarms keep the protection service alive; the app degrades to inexact alarms when the user has not granted this. |
| `SYSTEM_ALERT_WINDOW` | Theft-deterrent overlay shown on the lock screen during an active theft response; rationale shown on-device. |
| `BIND_DEVICE_ADMIN` | Thief-resistant uninstall protection + remote lock during an armed theft response; user-consented at activation (single-purpose AdminReceiver with lock-task/force-lock; `wipe-data` NOT used in the Play build's declared policy set). |

### Data Safety Form
- **Location:** Approximate + Precise — collected (device telemetry for theft
  tracking), used for App Functionality, **not shared**.
- **Photos / Audio:** collected **only during an active armed theft response**
  for the owner's evidence case; not shared; user can delete.
- **Personal info:** email (account), display name, phone number only if the
  user sets an alert phone.
- **Device/other IDs:** Firebase instance ID (linked to the account).
- **Security practices:** TLS in transit; bcrypt password hashing + AES-256-GCM
  at-rest encryption for location/evidence (when server-side key is set);
  TOTP 2FA; data deletion supported (account + device endpoints, 90-day
  retention purge).

### Content rating / audience
- IARC questionnaire: violence none/mild (anti-theft tooling, no graphic
  content); answer the location-sharing and surveillance flags honestly → 18+.
- Target audience 18+, no ads, no in-app purchases (free tier + self-hosted).

### Account deletion
- In-app: Settings → Danger Zone → Delete account (two-step confirm).
- Web API: `DELETE /api/auth/user/account` and per-device
  `DELETE /api/dashboard/devices/{id}` — documented on the privacy page.

## Screenshots still to capture (checklist item)
- [ ] Prominent-disclosure dialog (background location) — required for the
      declaration.
- [ ] Dashboard device map view.
- [ ] Command panel (lock / alarm / evidence).
- [ ] Evidence case (photos + audio segments).

## Release notes for the AAB upload (internal testing, v1.4.4, versionCode 13)
```
• Trigger-first armed audio: mic is closed while armed (no permanent
  indicator); it opens on a theft signal and closes itself when the
  evidence window ends. Optional always-listen mode keeps the pre-roll.
• Armed camera photo burst during theft responses.
• Failed-unlock theft detection fixed and live-verified.
• Theft-flood failure mode fixed: the capture reaction is bounded to one
  window, so a locked screen can never flood the device's network.
• Location-disabled / airplane-mode theft signals now report correctly.
• TOTP 2FA, role-based device sharing, step-up password verification.
• Security: SMS relay number removed from public config; tampered download
  links return a clean 403.
```

## Upload checklist (internal testing track)
1. AAB: `server/static/apk/magneetar-v1.4.4-play.aab` (**versionCode 13**,
   SHA-256 `3cc83b5c…`, zero SMS, zero accessibility service — verified
   2026-08-16 after the rebuild that added the G1-11 trigger-first audio).
2. Fill store listing with the copy above.
3. Complete app content (privacy policy URL `https://magneetar.me/privacy`,
   data safety, permissions declaration, IARC, account deletion).
4. Upload AAB to the **internal testing** track; add testers' emails.
5. Send the tester invite links (device owners in the G1/G2 program).
6. Iterate on feedback; keep production empty until G1/G2 exit (ADR-0006).
