# Magneetar — Manual Phone Test Checklist (Pre-Play Gate)

**Version:** 1.1 · **Prepared:** 2026-08-11
**Scope:** Full real-device test of the **v1.4.0 device-key build** against the **live production stack**
(`magneetar.me` download page, `api.magneetar.me`, `app.magneetar.me` dashboard).
**Gate:** this checklist must pass **before** the Play Store submission is uploaded.

> Companion to `docs/TEST_PLAN.md` (older, dev-server focused). This checklist is
> the production/live run, and it is the one that gates the Play upload.

---

## 0. Test Environment

| Requirement | Value |
|---|---|
| Android Device | Physical phone, **Android 8.0 (API 26) – Android 16 (API 36)** (targetSdk 36) |
| Sideload APK | Download from **https://magneetar.me/download** (ticket-gated flow) |
| Served build | **Play-clean flavor** (no SMS/phone-state permissions — the hard block is still possible because device-admin remains; see §1 note for the install path; offline SMS relay unavailable on it) |
| Served SHA-256 | `5958bbb415158bf9270458b459fa3a5d04a831215ff12fc457b4fcac0467a003` |
| Server API | `https://api.magneetar.me` (health: `{"status":"online","version":"1.4.0","database":true}`) |
| Dashboard | `https://app.magneetar.me` |
| A tester | One physical phone + one browser (laptop/desktop or a second phone) |
| Test SIM | Any active SIM (a second SIM useful for the SIM-swap test) |

**Verify before starting** — run these checks in a browser / terminal:

```bash
# Landing + download page
curl -s -o /dev/null -w '%{http_code}\n' https://magneetar.me          # 200
curl -s -o /dev/null -w '%{http_code}\n' https://magneetar.me/download  # 200

# APK checksum (must match the table above)
curl -s https://api.magneetar.me/apk/checksum
#   expect sha256 5958bbb4…a003 (Play-clean build — no SMS/phone permissions)

# Server health
curl -s https://api.magneetar.me/health
```

---

## 1. Install & Authenticity

| # | Action | Expected Result | Pass/Fail |
|---|--------|-----------------|-----------|
| 1.1 | Open `magneetar.me/download` in a mobile browser | Download button, version **1.4.0**, and the SHA-256 checksum displayed | ☐ |
| 1.2 | Tap **Download APK** | A signed download URL is minted (`api.magneetar.me/apk/download?expires=…&sig=…`) and the APK downloads | ☐ |
| 1.3 | If Play Protect shows **"App blocked to protect your device"** (expected for any sideload of an anti-theft app) | The old "More details → Install anyway" flow no longer exists — see the note below; verify the checksum against the page's SHA-256 first | ☐ |
| 1.4 | Install the APK | App installs with the **Magneetar** icon | ☐ |
| 1.5 | Open the app | Onboarding / Welcome screen appears (no crash) | ☐ |

> **Expected warning, not a bug:** Play Protect hard-blocks unknown sideload apps that
> declare sensitive permissions (SMS, **device admin**, background location) — with only
> an OK button and **no "Install anyway" on current Android**. The served Play-clean
> build still declares device-admin, so it can be blocked too; **no permission profile
> that keeps Magneetar's anti-theft features can be sideloaded today.**
> **(The download page no longer documents this — removed 2026-08-11 because it read
> like a scam warning to new installers; the workaround lives here.)**
> The reliable install path is to
> **temporarily pause Play Protect scanning** (Settings → Security & privacy → App
> security → Google Play Protect → ⚙️ → off), install, then re-enable it. The Play
> Store listing is the only friction-free channel for end users.

---

## 2. Account & Permissions

| # | Action | Expected Result | Pass/Fail |
|---|--------|-----------------|-----------|
| 2.1 | Tap **GET STARTED** (or **SIGN IN** if you already have an account) | Create-account / Sign-in screen | ☐ |
| 2.2 | Server URL | `https://api.magneetar.me` (default) | ☐ |
| 2.3 | Register with a **real email** + password ≥ 8 chars (verify email if prompted) | Account created; navigate to Permissions screen | ☐ |
| 2.4 | **Prominent disclosure dialog** for background location appears | Dialog explains location is used in the background for theft protection and how to stop it — **screenshot this for the Play declaration** | ☐ |
| 2.5 | Grant **Location** ("Allow all the time" + precise) | Granted | ☐ |
| 2.6 | Grant **Camera**, **Microphone** | Granted | ☐ |
| 2.7 | **Device Admin** → Activate | Activated (enables lock/wipe + uninstall resistance) | ☐ |
| 2.8 | **Battery optimization** → Don't optimize | Excluded (required for background persistence) | ☐ |
| 2.9 | Tap **CONTINUE** | Home screen shows **Device Protected** + "Connected — your@email.com" | ☐ |

---

## 3. Live Tracking & Device Visibility

| # | Action | Expected Result | Pass/Fail |
|---|--------|-----------------|-----------|
| 3.1 | Log in to `app.magneetar.me` with the same account | Device appears in the device list within ~1 minute | ☐ |
| 3.2 | Rename the device from the dashboard | New name persists on the map + panel | ☐ |
| 3.3 | Walk 20–50 m with the phone | Map pin moves and settles (Kalman-filtered, no teleporting); accuracy + battery shown | ☐ |
| 3.4 | Trigger **LOCATION BURST** from the dashboard | 5 fresh fixes reported; map converges on the current position | ☐ |
| 3.5 | Check **Sentinel** panel | Sentinel score ~0 at rest (no anomalies) | ☐ |

---

## 4. Remote Commands

| # | Command | Expected Result | Pass/Fail |
|---|---------|-----------------|-----------|
| 4.1 | **PING** | Phone notification: "Ping received"; command acks `executed` on the dashboard | ☐ |
| 4.2 | **PHOTO** (rear) | Photo lands in the dashboard Media gallery (evidence case) | ☐ |
| 4.3 | **FRONT** (selfie) | Front-camera photo in the gallery | ☐ |
| 4.4 | **AUDIO** | ~30 s audio clip in the gallery | ☐ |
| 4.5 | **SIREN** | Max-volume dual-tone alarm on the phone (5 s) even in silent/DND mode | ☐ |
| 4.6 | **LOCK** | Phone locks instantly | ☐ |
| 4.7 | **WIPE** (factory reset) | Requires password confirmation in the dashboard; device admin active → phone wipes **— only run on a disposable test phone** | ☐ |

**Capture-armed behavior (Android 14+):** if a capture command acks `failed` with a
"Re-arm" note, the armed capture service was not running — tap **Re-arm** in the app's
notification, then retry. The dashboard honestly shows "Unarmed" when capture is off.

---

## 5. Background Persistence (the anti-theft core)

| # | Action | Expected Result | Pass/Fail |
|---|--------|-----------------|-----------|
| 5.1 | Swipe the app away from Recents | App restarts via the watchdog within **5 minutes**; two notifications (Security + Protection) return | ☐ |
| 5.2 | Force-stop via Settings → Apps → Magneetar → Force stop | Recovers within 5 minutes | ☐ |
| 5.3 | **Reboot** the phone | App auto-starts within ~2 minutes (10 s delay on Chinese OEMs); dashboard shows online again | ☐ |
| 5.4 | Leave the phone idle (screen off, Doze) for 30+ min | Dashboard still shows the device online with recent heartbeat | ☐ |
| 5.5 | Charge state / network type | Dashboard reflects battery %, charging, WiFi/cellular | ☐ |

---

## 6. Theft Mode & Sentinel

> ⚠️ **Do this on a disposable phone or a phone you can recover** — SIM-swap arming is
> a live theft response.

| # | Action | Expected Result | Pass/Fail |
|---|--------|-----------------|-----------|
| 6.1 | **SIM-swap test:** power off, swap the SIM for a different one, power on | SIM-change alert fires (push/email/WhatsApp per your alert settings); **theft mode arms** | ☐ |
| 6.2 | Dashboard **Sentinel** panel | Sentinel score rises; theft detected state shown; evidence case auto-created | ☐ |
| 6.3 | While armed, issue **PHOTO / FRONT / AUDIO** | Capture runs even with screen locked (armed MediaCaptureService) | ☐ |
| 6.4 | Evidence panel | Photos/audio + location trail present with **SHA-256 chain-of-custody** hashes | ☐ |
| 6.5 | Guardian network panel | Device marked lost; nearby guardians (if any) can submit sightings | ☐ |
| 6.6 | **Failed-unlock "theftie" (v1.5.1):** with the device locked, enter the wrong PIN/pattern ≥ 5 times across screen-on/off cycles, then check the dashboard | `failed_unlock_attempts` alert fires + `capture_photo_front`/`capture_audio` queued (evidence lands in the gallery). On device-owner installs (provisioned via `scripts/enable-uninstall-protection.sh`) the DPC's exact count is used; otherwise the keyguard heuristic counts locked screen-on sessions (one per screen-on/off cycle). A correct unlock resets the counter | ☐ |
| 6.7 | End the response (mark recovered / disarm) | Theft mode clears; device returns to normal tracking | ☐ |

---

## 7. Offline Resilience & Alerts

| # | Action | Expected Result | Pass/Fail |
|---|--------|-----------------|-----------|
| 7.1 | Airplane mode ON for 5 min, then OFF | No crash; queued locations + acks flush when connectivity returns (offline outbox) | ☐ |
| 7.2 | With airplane mode ON, trigger a **SIREN** from the dashboard | Command sits pending; on reconnect the device picks it up and executes + acks | ☐ |
| 7.3 | ~~Sideload build only~~ — the served build is now the SMS-free Play flavor, so the offline SMS relay is **not** available on the installed APK (network/FCM commands + offline queue still work) | N/A for this build | ☐ |
| 7.4 | Alert settings: verify push/email/WhatsApp alert channels (non-emergency test) | Alert arrives | ☐ |
| 7.5 | Remove SIM **without** pre-authorization in settings | SIM-change alert (emergency alerts are always on) | ☐ |

---

## 8. Play-Flavor Differences (know before publishing)

The **Play build** (`Magneetar-v1.4.0-b6.aab`) deliberately strips the SMS/phone
permissions. After you test the sideload build, confirm you understand:

- **No offline SMS relay** in the Play build (offline queue + FCM commands still work).
- **No SMS/phone-state permissions** → Play Protect and Play review see a clean
  permission profile (this is the point of the split).
- Everything else (tracking, commands, Sentinel, guardian, wipe, lock, capture) is
  identical — same codebase, same signing key, same `targetSdk 36`.

---

## 9. Test Results Summary

| Test Section | Description | Status | Notes |
|--------------|-------------|--------|-------|
| §1 | Install & authenticity | ☐ | |
| §2 | Account & permissions | ☐ | |
| §3 | Live tracking | ☐ | |
| §4 | Remote commands | ☐ | |
| §5 | Background persistence | ☐ | |
| §6 | Theft mode & Sentinel | ☐ | |
| §7 | Offline & alerts | ☐ | |
| §8 | Play-flavor understanding | ☐ | |

**Overall verdict:** ☐ PASS / ☐ FAIL with notes

---

## 10. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Engineer | | | |
| Product | | | |

---

## Appendix: Useful ADB Commands

```bash
# Install the downloaded APK over USB
adb install -r /tmp/downloaded.apk

# Simulate the OS killing the app (watchdog recovery test)
adb shell am force-stop com.magneetar.app

# Grant/revoke permissions silently
adb shell pm grant com.magneetar.app android.permission.ACCESS_FINE_LOCATION
adb shell pm revoke com.magneetar.app android.permission.CAMERA

# Check services are running
adb shell dumpsys activity services | grep -E 'TrackingService|PersistenceService|MediaCaptureService'

# Watch app logs
adb logcat -s Magneetar TrackingService MagneetarWatchdog MagneetarFCM
```
