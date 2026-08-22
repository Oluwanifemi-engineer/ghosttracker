# Magneetar — Play Console Upload Guide

**Purpose:** Step-by-step guide for uploading v1.4.4 to the Play internal testing
track (G1/G2 install channel per ADR-0007).

**Time estimate:** 45–60 minutes for first-time setup, 10 minutes for subsequent
uploads.

**Prerequisites:**
- Google Play Console developer account ($25 one-time fee)
- v1.4.4 AAB: `server/static/apk/magneetar-v1.4.4-play.aab`
- Store listing copy: `docs/play-listing-copy-1.4.4.md`
- Feature graphic + icon: `docs/play-assets/`
- Privacy policy live at `https://magneetar.me/privacy`

---

## Step 1: Create the app (one-time)

1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - **App name:** `Magneetar — Anti-Theft Guardian`
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
4. Acknowledge the developer program policies
5. Click **Create app**

## Step 2: Complete App Content (required before any release)

### 2a. Privacy Policy

1. Go to **App content** → **Privacy policy**
2. Enter URL: `https://magneetar.me/privacy`
3. Click **Save**

### 2b. Data Safety

1. Go to **App content** → **Data safety**
2. Answer per `docs/play-listing-copy-1.4.4.md` § Data Safety Form:
   - **Location:** Collected → Yes (Precise + Approximate) → App Functionality → Not shared
   - **Photos and videos:** Collected → Yes → App Functionality → Not shared
   - **Audio:** Collected → Yes → App Functionality → Not shared
   - **Personal info:** Email → Yes → App Functionality → Not shared
   - **Device and other IDs:** Firebase instance ID → Yes → App functionality → Not shared
   - **Security practices:** Data encrypted in transit ✓, Data can be deleted ✓, Data is not shared ✓
3. Click **Save**

### 2c. Permissions Declaration

1. Go to **App content** → **Permissions declarations**
2. Add each permission with the explanation from `docs/play-listing-copy-1.4.4.md`:

| Permission | Explanation |
|-----------|-------------|
| `ACCESS_BACKGROUND_LOCATION` | Theft detection requires location even when the app is in the background; a foreground location service runs while tracking is enabled; per-device opt-in with prominent disclosure. |
| `SCHEDULE_EXACT_ALARM` | Watchdog/health alarms keep the protection service alive; the app degrades to inexact alarms when the user has not granted this. |
| `SYSTEM_ALERT_WINDOW` | Theft-deterrent overlay shown on the lock screen during an active theft response; rationale shown on-device. |
| `BIND_DEVICE_ADMIN` | Thief-resistant uninstall protection + remote lock during an armed theft response; user-consented at activation (single-purpose AdminReceiver with lock-task/force-lock; wipe-data NOT used in the Play build's declared policy set). |

3. Click **Save**

### 2d. Content Rating

1. Go to **App content** → **Content rating**
2. Complete the IARC questionnaire:
   - Violence: None or Mild (anti-theft tooling, no graphic content)
   - Location sharing: Yes (theft tracking)
   - Surveillance: Yes (remote evidence capture during theft response)
   - Result: **18+** rating
3. Click **Save**

### 2e. Target Audience

1. Go to **App content** → **Target audience**
2. Select: **18+** (not designed for children)
3. Click **Save**

### 2f. Account Deletion

1. Go to **App content** → **Account deletion**
2. Select: **Yes, my app allows users to request account deletion**
3. Provide URL: `https://magneetar.me/privacy` (deletion endpoints documented there)
4. Click **Save**

## Step 3: Store Listing

### 3a. Main store listing

1. Go to **Store presence** → **Main store listing**
2. **App name:** `Magneetar — Anti-Theft Guardian`
3. **Short description:** Copy from `docs/play-listing-copy-1.4.4.md` (64 chars)
4. **Full description:** Copy from `docs/play-listing-copy-1.4.4.md` (3,331 chars)
5. **App icon:** Upload `docs/play-assets/icon-512.png`
6. **Feature graphic:** Upload `docs/play-assets/feature-graphic-1024x500.png`
7. **Phone screenshots:** Upload 6–8 screenshots (see §3b below)
8. Click **Save**

### 3b. Screenshots to capture

These must be captured on a real device (cannot be generated):

| # | Screenshot | How to capture |
|---|-----------|----------------|
| 1 | **Prominent-disclosure dialog** (background location) | First-launch dialog in `PermissionsActivity` |
| 2 | **Dashboard device map view** | Open dashboard → select device → map view |
| 3 | **Command panel** | Dashboard → device → Commands tab |
| 4 | **Evidence case** | Dashboard → device → Evidence tab (after a capture) |
| 5 | **Guardian Network** | Dashboard → Guardian panel |
| 6 | **Lost Mode screen** | Trigger lost mode → show the lock screen on the phone |

**Screenshot requirements:**
- Minimum 2, recommend 6–8
- 16:9 or 9:16 aspect ratio
- PNG or JPEG
- Min dimension: 320px, max: 3840px
- At least one screenshot must show the prominent-disclosure dialog

### 3c. App category

1. Go to **Store presence** → **Store listing**
2. Set **App category:** Tools (or Security)
3. Click **Save**

## Step 4: Upload AAB to Internal Testing Track

1. Go to **Testing** → **Internal testing**
2. Click **Create new release**
3. Upload: `server/static/apk/magneetar-v1.4.4-play.aab`
4. **Release name:** `1.4.4 (vc13) — trigger-first audio, evidence capture, adaptive cadence`
5. **Release notes:** Copy from `docs/play-listing-copy-1.4.4.md` § Release notes
6. Click **Review release**

## Step 5: Add Testers

1. Go to **Testing** → **Internal testing** → **Testers**
2. Click **Create email list** or **Create new list**
3. Add tester emails (G1 recruitment targets)
4. Save the list
5. Go back to the release → **Add testers to track**
6. Select the tester list
7. Click **Start rollout to Internal testing**

## Step 6: Verify

1. Testers receive an email with the Play Store link
2. Testers install from the Play Store (no sideload, no Play Protect block)
3. Verify each tester sees the app in their Play Store → Manage apps & device → Available updates

---

## Subsequent uploads (version bumps)

1. Bump `versionCode` in `android-app/app/build.gradle.kts`
2. Run `./gradlew bundlePlayRelease`
3. Go to **Testing** → **Internal testing** → **Create new release**
4. Upload the new AAB
5. Testers auto-update within hours

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Upload failed" | Ensure AAB is signed with the release keystore (`release.keystore`, alias `magneetar`) |
| "Version code too low" | `versionCode` must be strictly increasing; current is 13 |
| "Missing privacy policy" | Complete §2a above |
| "Permission declaration required" | Complete §2c above |
| Testers don't see update | Check they're on the internal testing opt-in list; clear Play Store cache |
| "App not available in your country" | Go to **Pricing & distribution** → set countries |
