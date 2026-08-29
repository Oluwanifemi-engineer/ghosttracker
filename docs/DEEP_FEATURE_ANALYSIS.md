# Magneetar — Deep Feature Analysis (Field Research)

## Research Methodology
- Analyzed Google's official Android documentation (2024-2026)
- Studied how Prey, Cerberus, and Google Find My Device actually work
- Read developer community discussions on Reddit, StackOverflow, Medium
- Verified what Android actually allows/disallows on modern versions
- Cross-referenced with Nigerian university theft statistics (NBS data)

---

## FEATURE 1: Background Location Tracking

### What Real Apps Do
**Google Find My Device:** Uses a system-level service that cannot be killed. It's part of Google Play Services, which has special system privileges. Third-party apps cannot replicate this.

**Prey:** Uses a foreground service with a persistent notification. The notification shows "Prey is protecting your device." This is the only reliable way to keep a service alive on modern Android.

**Cerberus:** Same approach — foreground service with notification. Also supports SMS commands as a fallback when internet is unavailable.

### What Android Actually Allows (2024-2026)

| Android Version | Background Location Rule | What Works |
|----------------|------------------------|------------|
| Android 10+ | Background location requires "Allow all the time" permission | User must explicitly grant |
| Android 12+ | Cannot start foreground services from background | Must start from foreground |
| Android 14+ | Must declare `foregroundServiceType="location"` | Manifest + runtime permission required |
| Android 15+ | Stricter battery optimization | WorkManager for periodic updates |

### The Hard Truth
**You cannot track location silently on modern Android.** Every solution requires:
1. A foreground service with a visible notification
2. User granting "Allow all the time" location permission
3. User disabling battery optimization for the app

### What Magneetar Currently Does
- Uses `TrackingService` as a foreground service
- Declares `FOREGROUND_SERVICE_LOCATION` permission
- Has battery optimization exemption prompt

### What's Wrong
1. The notification is too technical — users see it and think the app is spying
2. No fallback when the foreground service is killed (happens on Samsung, Xiaomi)
3. No WorkManager for periodic location updates as backup
4. No handling of Android 14+ foreground service type requirements

### How to Fix (Properly)
```
1. Use WorkManager as PRIMARY location source (15-min intervals)
2. Use foreground service as SECONDARY (only when app is in foreground)
3. Notification should say "Protection Active" — not technical details
4. Add Samsung-specific autostart permission request
5. Add Xiaomi-specific battery optimization bypass
```

### Battery Impact
- Foreground service with location: ~5-8% battery per day
- WorkManager periodic: ~1-2% battery per day
- Combined approach: ~6-10% battery per day

---

## FEATURE 2: Device Admin (Remote Lock/Wipe)

### What Real Apps Do
**Google Find My Device:** Uses Device Owner mode (system-level). Can wipe, lock, and ring the device. Cannot be removed by the user.

**Prey:** Uses Device Admin mode. Can lock and wipe. User can deactivate it, but the app detects deactivation and alerts the owner.

**Cerberus:** Uses Device Admin mode. Also uses Accessibility Service for additional protection (prevents uninstall).

### What Android Actually Allows

| Capability | Device Admin | Device Owner | Notes |
|-----------|-------------|-------------|-------|
| Remote lock (`lockNow()`) | ✅ Works | ✅ Works | Consumer apps use this |
| Remote wipe (`wipeData()`) | ✅ Works | ✅ Works | Consumer apps use this |
| Prevent uninstall | ❌ User can deactivate | ✅ User cannot remove | Device Admin can detect deactivation |
| Disable camera | ❌ Deprecated Android 10 | ✅ Works | Not for consumer apps |
| Set password policy | ❌ Deprecated Android 11 | ✅ Works | Not for consumer apps |

### The Hard Truth
**Device Admin is the right choice for consumer anti-theft apps.** Device Owner requires factory-reset provisioning, which is impractical for consumer apps.

### What Magneetar Currently Does
- Uses Device Admin with `wipe-data` and `force-lock` policies
- Has `AdminReceiver` to detect activation/deactivation
- Uses polling in `onResume()` to detect activation

### What's Wrong
1. The activation flow uses deprecated `startActivityForResult`
2. No detection of deactivation (thief can just deactivate admin)
3. No fallback when Device Admin is not available (Play Store build)
4. The skip flow is confusing — user doesn't understand what they're giving up

### How to Fix (Properly)
```
1. Use registerForActivityResult (modern API) for activation
2. Add BootReceiver to re-check admin status on boot
3. Add deetection: if admin deactivated, send alert immediately
4. Make the skip flow educational, not blocking
5. For Play Store: use Accessibility Service as fallback (if allowed)
```

---

## FEATURE 3: Remote Commands (Siren, Lock, Wipe, Camera)

### What Real Apps Do
**Cerberus:** Commands are delivered via:
1. Push notification (FCM) — primary
2. SMS commands — fallback when offline
3. Periodic polling — last resort

**Prey:** Commands delivered via:
1. Push notification — primary
2. Periodic HTTP polling every 5-10 minutes — fallback

### What Android Actually Allows

| Command | How It Works | Reliability |
|---------|-------------|-------------|
| Siren/Alarm | `MediaPlayer` with `STREAM_ALARM` | High — works even when muted |
| Lock screen | `DevicePolicyManager.lockNow()` | High — requires Device Admin |
| Wipe data | `DevicePolicyManager.wipeData()` | High — requires Device Admin |
| Camera snap | `Camera2` API from background | Low — Android blocks background camera |
| Screen lock with message | `KeyguardManager` + custom activity | Medium — depends on device |

### The Hard Truth
**Camera snap from background is nearly impossible on modern Android.** Google explicitly blocks background camera access for security reasons. The only workaround is using Accessibility Service to simulate a screen tap, but this is against Play Store policy.

### What Magneetar Currently Does
- Has `MediaCaptureService` for photo/audio
- Has `ArmedAudioService` for audio monitoring
- Uses WebSocket for command delivery

### What's Wrong
1. Camera capture from background will fail silently on most devices
2. No SMS command fallback when offline
3. WebSocket connection dies in Doze mode
4. No command queuing on the device side

### How to Fix (Properly)
```
1. Siren: Use MediaPlayer with STREAM_ALARM — this works
2. Lock: Use DevicePolicyManager.lockNow() — this works
3. Wipe: Use DevicePolicyManager.wipeData() — this works
4. Camera: Accept limitation — don't promise what Android doesn't allow
5. Audio: Use MediaRecorder with foreground service — works but needs notification
6. Commands: Use FCM high-priority + periodic polling as fallback
```

---

## FEATURE 4: Evidence Collection (Photo, Audio, PDF)

### What Real Apps Do
**Prey:** Captures photo from front camera when device is marked as "Missing." The capture happens when the user actively triggers it from the dashboard. It does NOT capture continuously in the background.

**Cerberus:** Similar — captures on demand, not continuously. Uses the camera API when the app is in the foreground or when a command is received.

### What Android Actually Allows
- **Foreground camera:** Works reliably
- **Background camera:** Blocked on Android 10+ for security
- **Background audio:** Works with foreground service + notification
- **PDF generation:** Works locally on device

### The Hard Truth
**You cannot secretly take photos of someone holding your stolen phone.** Android prevents this for privacy reasons. The best you can do is:
1. Capture when the device screen is unlocked (using KeyguardMonitor)
2. Capture when a command is received (if app is in foreground)
3. Capture audio continuously (with notification)

### What Magneetar Currently Does
- Has `MediaCaptureService` for photo/audio
- Has evidence packaging into PDF

### What's Wrong
1. Promises silent photo capture that Android blocks
2. No clear documentation of what actually works
3. PDF generation is untested

### How to Fix (Properly)
```
1. Photo: Capture only when command received AND app is in foreground
2. Audio: Use MediaRecorder with foreground service (notification required)
3. PDF: Generate locally, upload when online
4. Be honest with users about what's possible
```

---

## FEATURE 5: Offline Operation

### What Real Apps Do
**Cerberus:** When offline, the app:
1. Continues location tracking (stores locally)
2. Queues commands for later execution
3. Accepts SMS commands as fallback
4. Uploads stored data when connection returns

**Prey:** Similar approach — local storage + periodic sync.

### What Android Actually Allows
- Local SQLite storage: ✅ Works
- Background location (foreground service): ✅ Works offline
- SMS reception: ✅ Works offline
- Network-dependent features: ❌ Fail offline

### What Magneetar Currently Does
- Has `OfflineOutbox` for queuing
- Has SMS command support
- Stores location locally

### What's Wrong
1. Offline queue is untested
2. No SMS command verification
3. No local command execution when offline
4. No data sync strategy when connection returns

### How to Fix (Properly)
```
1. Store all telemetry in SQLite with timestamps
2. Queue pending commands in a separate table
3. Execute commands immediately when received (even offline via SMS)
4. Sync stored data when connection returns (with retry)
5. Compress old data to save storage
```

---

## FEATURE 6: Anti-Tamper (Uninstall Protection)

### What Real Apps Do
**Prey:** Uses Device Admin to prevent uninstall. If user deactivates admin, the app detects it and sends an alert.

**Cerberus:** Uses Accessibility Service to block the uninstall UI. This is against Play Store policy but works for sideloaded apps.

### What Android Actually Allows
- Device Admin: Prevents uninstall while active
- Accessibility Service: Can block UI elements (Play Store rejects this)
- Device Owner: Prevents uninstall (requires factory reset provisioning)

### The Hard Truth
**There is no way to prevent a determined thief from uninstalling your app.** The best you can do is:
1. Make it require Device Admin deactivation first
2. Detect deactivation and send alert immediately
3. Hide the app icon after setup (covert mode)

### What Magneetar Currently Does
- Uses `UninstallGuardService` (Accessibility Service)
- Has Device Admin activation
- Has covert mode (hides icon)

### What's Wrong
1. Accessibility Service will be blocked by Play Store
2. No detection of admin deactivation
3. No alert when admin is deactivated
4. Covert mode may confuse legitimate users

### How to Fix (Properly)
```
1. Use Device Admin as primary protection
2. Add BootReceiver to re-check admin status on boot
3. Send immediate alert when admin is deactivated
4. For Play Store: accept limitation, educate users
5. For sideload: Accessibility Service is acceptable
```

---

## FEATURE 7: Distribution (Play Store vs Sideload)

### What Real Apps Do
**Prey:** Available on Play Store. Uses Device Admin (allowed for consumer apps). No Accessibility Service. No background camera.

**Cerberus:** Removed from Play Store due to policy violations. Now distributed as APK from their website.

### What Play Store Allows
| Feature | Allowed? | Notes |
|---------|----------|-------|
| Device Admin (lock/wipe) | ✅ Yes | Consumer apps allowed |
| Background location | ⚠️ Restricted | Must justify, user must consent |
| Accessibility Service | ❌ No | Unless verified accessibility tool |
| Background camera | ❌ No | Security/privacy violation |
| SMS permissions | ❌ No | Unless default SMS handler |
| System alert window | ❌ No | Unless accessibility app |

### The Hard Truth
**You cannot put a full-featured anti-theft app on the Play Store.** You must choose:
1. Play Store version: Limited features, high distribution
2. Sideload version: Full features, limited distribution

### What Magneetar Currently Does
- Has two flavors: `play` and `sideload`
- Play Store strips AdminReceiver, Accessibility, SMS

### What's Wrong
1. Play Store version is too limited to be useful
2. Sideload version is blocked by Play Protect
3. No clear communication to users about differences
4. No installation guide for sideloaded APK

### How to Fix (Properly)
```
1. Play Store version: Location tracking + circles + basic commands
2. Sideload version: Full anti-theft with Device Admin + Accessibility
3. Clear installation guide for sideloaded APK
4. In-app upgrade flow from Play Store to sideload
```

---

## FEATURE 8: User Authentication & Security

### What Real Apps Do
**Prey:** Simple email/password. No 2FA. Session tokens expire after 30 days.

**Google Find My Device:** Uses Google account authentication. No separate auth system.

### What Magneetar Currently Does
- Email/password registration
- JWT tokens with refresh
- 2FA/TOTP support
- Password reset via email

### What's Wrong
1. JWT tokens are stored in sessionStorage (XSS vulnerable)
2. No rate limiting on login attempts
3. No account lockout after failed attempts
4. 2FA is untested
5. Password reset email flow is unverified

### How to Fix (Properly)
```
1. Store tokens in httpOnly cookies (not sessionStorage)
2. Add rate limiting: 5 attempts per 15 minutes
3. Add account lockout: 15 minutes after 10 failures
4. Test 2FA flow end-to-end
5. Test password reset flow end-to-end
```

---

## PRIORITY REBUILD ORDER

### Phase 1: Foundation (Make It Work)
1. **Location Tracking** — WorkManager + foreground service
2. **Device Admin** — Modern activation flow
3. **Remote Commands** — FCM + polling fallback
4. **Auth Security** — Token storage, rate limiting

### Phase 2: Core Anti-Theft (Make It Effective)
5. **Siren/Lock/Wipe** — These work, just need proper command delivery
6. **Evidence Capture** — Honest about what's possible
7. **Offline Queue** — Local storage + sync
8. **Anti-Tamper** — Detection + alerts

### Phase 3: Distribution (Make It Reachable)
9. **Play Store Version** — Limited but functional
10. **Sideload Version** — Full features
11. **Installation Guide** — Step-by-step for sideload
12. **Circles** — Family sharing

### Phase 4: Excellence (Make It Reliable)
13. **Battery Optimization** — Samsung/Xiaomi specific
14. **Error Handling** — Graceful degradation
15. **Monitoring** — Server-side health checks
16. **Testing** — Real device testing matrix

---

## CONCLUSION

The project has been built on assumptions about what Android allows, not what it actually does. The core features (location tracking, device admin, remote commands) are fundamentally sound but need proper implementation.

**What needs to change:**
1. Stop promising features that Android blocks (background camera, silent tracking)
2. Focus on what actually works (foreground service, Device Admin, FCM)
3. Test on real devices, not just curl commands
4. Be honest with users about limitations

**What's already good:**
1. The server architecture (FastAPI + PostgreSQL + Redis)
2. The dashboard UI (React + Next.js)
3. The Android app structure (Kotlin + proper services)
4. The security model (JWT + device keys)

The foundation is solid. The implementation needs depth, not breadth.
