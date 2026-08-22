# Google Play Store Submission Checklist

## Overview

This document outlines the process for submitting Magneetar to the Google
Play Store. The **canonical store listing copy** lives in
`docs/play-listing-copy-1.4.4.md` — do not maintain duplicate descriptions
here.

**Timeline**: 2-4 weeks (including closed testing requirement)

**Cost**: $25 USD (one-time developer account fee)

---

## Prerequisites

### 1. Developer Account Setup
- [ ] Create Google Play Console account at https://play.google.com/console
- [ ] Pay $25 USD registration fee
- [ ] Provide legal/contact details
- [ ] Verify email address

### 2. Technical Requirements
- [ ] Android App Bundle (.aab) format
- [ ] Target SDK 36+ (required Aug 31, 2026)
- [ ] Signed with release keystore
- [ ] No SMS permissions (handled via Play flavor)

---

## App Content Requirements

### 3. Store Listing

> **Copy source:** `docs/play-listing-copy-1.4.4.md` — short description,
> full description, permissions explanations, and Play Console form answers
> are all maintained there. Copy-paste from that file.

**Graphics & Media:**
- [ ] **App Icon**: 512 x 512 px PNG (`docs/play-assets/icon-512.png`)
- [ ] **Feature Graphic**: 1024 x 500 px (`docs/play-assets/feature-graphic-1024x500.png`)
- [ ] **Phone Screenshots**: 6–8 screenshots (16:9 or 9:16)
  - [ ] Prominent-disclosure dialog (background location) — **required**
  - [ ] Dashboard device map view
  - [ ] Command panel (lock / alarm / evidence)
  - [ ] Evidence case (photos + audio)
  - [ ] Guardian Network view

### 4. Privacy Policy

Publicly hosted at `https://magneetar.me/privacy` (verified 200).

---

## Data Safety Form

> **Answers:** see `docs/play-listing-copy-1.4.4.md` § Play Console form
> answers → Data Safety Form section.

---

## Testing Requirements

### 5. Closed Testing (Required for New Accounts)

For personal developer accounts created after Nov 13, 2023:

- [ ] Create closed testing track
- [ ] Recruit minimum 12 testers
- [ ] Run test for minimum 14 consecutive days
- [ ] Collect feedback and fix any issues
- [ ] Document test results

---

## Submission Checklist

### 6. Pre-Submission Verification

- [ ] AAB builds successfully: `./gradlew bundlePlayRelease`
- [ ] AAB installs on test device via internal testing track
- [ ] All features work correctly — no crashes, no errors
- [ ] Privacy policy URL accessible
- [ ] Store listing complete (copy from `play-listing-copy-1.4.4.md`)
- [ ] Screenshots uploaded (6–8, incl. prominent disclosure)
- [ ] Data safety form complete
- [ ] Content rating complete

### 7. Upload to Play Console

- [ ] Upload AAB to internal testing track
- [ ] Add tester emails
- [ ] Send tester invite links
- [ ] Iterate on feedback
- [ ] Promote to closed testing (G2 gate)
- [ ] After G1 + G2 pass → production release

### 8. Review Process

- [ ] Wait for Google review (typically 3–7 days)
- [ ] Address any rejection feedback
- [ ] Resubmit if needed

---

## Common Rejection Reasons to Avoid

1. **SMS Permissions**: Removed in Play flavor ✅
2. **Background Location Disclosure**: In-app prominent disclosure shipped ✅
3. **Device Admin**: Declare via Permissions Declaration (not EMM) ✅
4. **Demo Credentials**: Provide test account for reviewers
5. **Misleading Description**: All claims verifiable (S-7 rule) ✅

---

## Post-Approval

### 9. Production Release

- [ ] Staged rollout: 1–5% → 10–20% → 50% → 100%
- [ ] Monitor crash reports (Play Console quality page)
- [ ] Respond to user reviews
- [ ] Plan regular updates

### 10. Ongoing Compliance

- [ ] Update target SDK when required
- [ ] Respond to policy changes
- [ ] Maintain privacy policy
- [ ] Address user feedback

---

## Resources

- [Play Console Help](https://support.google.com/googleplay/android-developer)
- [Developer Program Policies](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Data Safety Requirements](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Location Permissions](https://support.google.com/googleplay/android-developer/answer/9799150)
