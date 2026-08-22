# Magneetar — G1 Recruitment Action Plan

**Created:** 2026-08-22  
**Goal:** Fill the G1 device matrix (≥6 devices, ≥4 OEMs, ≥5 real users)  
**Deadline:** Devices installed + running by 2026-09-05 (2-week window ends 09-19)

---

## Current State

| Slot | Device | Status | OEM |
|------|--------|--------|-----|
| D1 | Samsung SM-A037F (Galaxy A03s) | ✅ Running (since 08-14) | Samsung |
| D2 | Tecno / Infinix / Itel | ❌ **EMPTY** | Transsion |
| D3 | Xiaomi / Redmi | ❌ **EMPTY** | Xiaomi |
| D4 | Low-end 2–3 GB RAM | ❌ **EMPTY** | Any |
| D5 | Android 14/15 device | ❌ **EMPTY** | Any |
| D6 | AOSP (no "network" provider) | ❌ **EMPTY** | AOSP |

**Gap:** 5 devices needed across 3+ additional OEMs.

---

## Recruitment Targets

### Priority 1: Transsion devices (Tecno / Infinix / Itel)
- **Why:** Core Nigerian market; aggressive battery killers — the hardest OEM to survive
- **Target:** 1–2 devices
- **Where to recruit:** University WhatsApp groups, family, OAU campus contacts
- **Message:** Template A (group) → Template B (one-to-one)

### Priority 2: Xiaomi / Redmi (MIUI)
- **Why:** Battery optimization + autostart quirks — different failure mode from Samsung
- **Target:** 1 device
- **Where to recruit:** Tech communities, developer friends, Xiaomi user groups

### Priority 3: Low-end device (2–3 GB RAM, Android 10–12)
- **Why:** Memory pressure, slow GPS, background death risk
- **Target:** 1 device
- **Where to recruit:** Any tester with an older phone — "do you have a spare phone lying around?"

### Priority 4: Android 14/15 device
- **Why:** Foreground service + background execution rules (FGS camera/mic)
- **Target:** 1 device
- **Where to recruit:** Recent phone buyers, flagship users

### Priority 5: AOSP image (no "network" location provider)
- **Why:** Regression lock for the v1.4.2 crash fix
- **Target:** 1 device (emulator acceptable)
- **Where to recruit:** Developer tool — set up an AOSP emulator on a PC

---

## Timeline

| Week | Action | Owner |
|------|--------|-------|
| **Week 1 (Aug 22–28)** | Send recruitment messages to 10+ candidates | Owner |
| | Identify devices across OEM matrix | Owner |
| | Install on 3+ devices (D2, D3, D4) | Testers |
| **Week 2 (Aug 29–Sep 5)** | Install on remaining devices (D5, D6) | Testers |
| | First feedback forms sent (Week 1 check-in) | Owner |
| | Mid-window nudge to all testers | Owner |
| **Week 3 (Sep 6–12)** | Second feedback forms sent (Week 2 check-in) | Owner |
| | Triage any P0/P1 findings | Owner |
| | Fix + redeploy if needed | Owner |
| **Week 4 (Sep 13–19)** | End-of-window forms sent | Owner |
| | Final 7-day soak (zero P0s, no silent-tracking-death) | Automated |
| | Compile exit documentation | Owner |
| | **G1 gate decision** | Owner |

---

## Action Items (This Week)

### Immediate (today/tomorrow)
- [ ] **Send Template A** to 3 WhatsApp groups (university, family, tech)
- [ ] **Identify 10+ candidates** with target device types
- [ ] **Set up AOSP emulator** (Android Studio) for D6 slot

### By Aug 28
- [ ] **Confirm 5+ testers** with devices across 4+ OEMs
- [ ] **Send Template B** (install steps) to confirmed testers
- [ ] **Verify installs** — each tester sends a screenshot of the dashboard showing their device

### By Sep 5
- [ ] **All 6 device slots filled** and running
- [ ] **First feedback forms** collected
- [ ] **D1 2-week window closes** — verify exit criteria

---

## Install Channel

Per ADR-0007, the install channel is the **Play internal testing track**:

1. Owner uploads the AAB to Play Console → Internal testing track
2. Owner adds tester emails to the internal testing list
3. Testers install from the Play Store (no sideload, no Play Protect warning)
4. New builds auto-update testers

**Fallback:** `magneetar.me/download` for testers who can't use Play (older Android, no Google account).

---

## Success Criteria (G1 Exit)

| Criterion | Target | Current |
|-----------|--------|---------|
| Devices in matrix | ≥6 | 1 |
| OEM diversity | ≥4 OEMs | 1 |
| Real users | ≥5 | 1 |
| 2-week windows | All complete | D1 in progress |
| Recovery drill 12/12 | Every device | D1 PASS |
| Zero P0 bugs | Required | ✅ 0 open |
| Silent-tracking-death | None in final week | ✅ 0 gaps |
| User approval | ≥80% "keep using" | 100% (n=1) |

---

## Key Contacts

| Role | Who | Notes |
|------|-----|-------|
| Owner / recruiter | Oluwanifemi | Sends messages, triages feedback |
| D1 tester | Owner | Samsung A03s, running since 08-14 |
| D2–D6 testers | **TODO** | Recruit this week |

---

## Recruitment Message Templates

See `docs/tester-recruitment-message.md` for copy-paste WhatsApp messages:
- **Template A:** Group pitch (send to WhatsApp groups)
- **Template B:** One-to-one follow-up (install steps)
- **Template C:** Mid-window nudge (day ~4)
- **Template D:** End-of-window wrap-up (day ~15)

---

## Feedback Collection

See `docs/tester-feedback-form.md` for the weekly form:
- **Week 1 form:** Send at day 7
- **Week 2 form:** Send at day 14
- **End-of-window form:** Send at day 15 (replaces week 2 form)
- **Triage:** P0 = fix immediately, P1 = fix before exit, P2 = fix when convenient
