# Magneetar — Google Play & Play Protect Policy Analysis

**Date:** 2026-08-11 · **Question answered:** *"If we build SIM-change detection,
Lost Mode, the Recovery Dossier, OpenCelliD — will the app be hard-blocked by
the Play Store / Play Protect?"*

**Short answer: No.** None of the roadmap features listed below cause a Play
hard block. The hard block you already hit is **not a feature problem — it is a
distribution-channel problem** (sideloading), and the fix is Play Store
submission, which the existing checklist already covers (~90% complete).

---

## 1. The hard block you experienced — what it actually is

Two different systems, two different rules:

### 1a. Play Protect (sideloads from a website) — the "App blocked" dialog

Google's **Enhanced Fraud Protection** (rolled out globally, protecting 2.8B+
devices) gives an **unconditional hard block** — no "Install anyway" button —
when an app meets **both**:

1. It is sideloaded from an **internet source** (browser, file manager, messaging app), **and**
2. It declares high-risk permissions: `RECEIVE_SMS`/`READ_SMS`,
   `BIND_NOTIFICATION_LISTENER`, or `BIND_ACCESSIBILITY_SERVICE`.

Sources: Google security guidance + Play Protect documentation (2025–2026).

**What this means for Magneetar — confirmed on-device (2026-08-11):**

| Served build | SMS/accessibility perms | Play Protect result (user-verified) |
|---|---|---|
| Sideload flavor (has `RECEIVE_SMS` for the offline SMS relay) | ❌ has SMS | **Hard block** — `RECEIVE_SMS` is the #1 deterministic trigger |
| Play-clean build (SMS + accessibility stripped) | ✅ clean | **Still hard blocked** — device admin + camera/mic + background location + overlay profile is enough for current Android to refuse internet-sideloaded installs |

**Conclusion (matches the 2026-08-11 verdict already documented in
`docs/play-store-checklist.md`):** *NO permission profile that keeps
Magneetar's anti-theft features can be sideloaded on current Android.* The
download page is a discovery page; **Google Play is the only friction-free
install channel.**

### 1b. Play Store review (the channel that matters)

Play-installed apps inherit a trust baseline. **Prey, Cerberus, and other
anti-theft apps ship on Play with device admin, background location, camera
and microphone** — the same profile Magneetar's play flavor carries — declared
honestly via the Permissions Declaration form. Play review is a *manual*
review for this category (expect questions; the checklist's section J already
documents the answers), not a block.

---

## 2. Per-feature verdicts for the roadmap

| Feature | Play-safety | Why | Play-side work needed |
|---|---|---|---|
| **SIM-change detection** | ✅ **Safe** | Implemented permission-free: `ACTION_SIM_STATE_CHANGED` broadcast + `TelephonyManager.getSimOperator()`/`getSimOperatorName()` — **no `READ_PHONE_STATE`, no `READ_PHONE_NUMBERS`** (both restricted/Play-gated). Works identically on the play flavor. No new declarations, no data-safety impact. | None |
| **Lost Mode** (remote lock + "call this number / reward" screen) | ✅ **Safe with one design rule** | Remote lock = existing Device Admin `force-lock` (already declared). On-screen message must use **`showWhenLocked` + `turnScreenOn` on an activity** (or `SYSTEM_ALERT_WINDOW`, already declared), **NOT** auto-granted `USE_FULL_SCREEN_INTENT` — since Jan 2025 that special access is auto-granted only to calling/alarm apps; an anti-theft app must degrade to a high-priority heads-up notification or prompt the user to grant it. | Permissions Declaration (already planned): `SYSTEM_ALERT_WINDOW`, `BIND_DEVICE_ADMIN` |
| **Recovery Dossier PDF** | ✅ **Safe** | Server-side only (evidence PDF + timeline). Zero manifest/API impact. | None |
| **OpenCelliD offline resolution** | ✅ **Safe** | Server-side only (bundled MCC 621 dump + existing `/cell-locate`). No app changes. | None |
| **Trip history / heatmap, Guardian Network, BLE Find Network** | ✅ **Safe** | No new sensitive permissions; BLE scanning uses existing location perms; guardian sightings are already opt-in server data. | None (BLE: declare `BLUETOOTH_SCAN` as normal permission, nothing Play-gated) |
| **SMS offline command relay** | ❌ **Not Play-compatible** | Play policy requires default-SMS-handler status or SMS-core functionality; the relay is neither. It is already stripped from the play flavor (`src/play/AndroidManifest.xml`), and its `RECEIVE_SMS` is the deterministic sideload hard-block trigger — **it must never return to the served/download APK**. | None (feature remains sideload-only, documented) |

---

## 3. The one live issue this analysis exposes

The APK currently served at `magneetar.me/download` is the **sideload flavor**
(`assembleSideloadRelease` — carries `RECEIVE_SMS`), which is *definitively*
hard-blocked by the research above. The play-clean build is **also** blocked,
but it is the minimal-risk profile and matches the Play binary. **Action taken
this session:** the download page is restored to serving the **play-flavor
build** (same signing key, same device key, no SMS permissions), consistent
with the 2026-08-11 decision in `docs/play-store-checklist.md`. The SMS-capable
sideload build remains buildable + backed up for power users who accept the
block or install via adb.

---

## 4. Play submission posture after these features

Everything in the roadmap is additive to the **existing** submission plan
(`docs/play-store-checklist.md` — targetSdk 36 ✓, data-safety form mapped ✓,
permissions declaration listed ✓, AAB built ✓). No roadmap feature adds a
declaration or a data-safety answer. The remaining pre-submission items are
unchanged and not feature-dependent:

1. Capture the background-location prominent-disclosure screenshots.
2. Confirm `https://magneetar.me/privacy` is live.
3. Back up `release.keystore` + `local.properties` off-machine (rotate the
   fallback keystore password).
4. Submit the play-flavor AAB (Play App Signing) + fill the declaration forms.

---

## 5. Sources

- Google Play Protect / Enhanced Fraud Protection rollout & hard-block criteria
  (2025–2026 security guidance).
- Google Play "Permissions and APIs that Access Sensitive Information" policy
  (SMS/Call-log restricted permissions; `QUERY_ALL_PACKAGES` security-scanner
  exception).
- Google Play Foreground Services Policy (camera/microphone/location FGS types
  + Play Console declarations).
- Android 14 behavior changes + Play policy on `USE_FULL_SCREEN_INTENT`
  (calling/alarm core-functionality restriction; runtime grant fallback).
- On-device verification: `docs/play-store-checklist.md` (2026-08-11 entries).
