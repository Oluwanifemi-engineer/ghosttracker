# Magneetar — Competitive Gap Audit

**Date:** 2026-08-11 · **Scope:** Consumer anti-theft features vs **Cerberus**,
**Google Find My Device**, and **Prey** (consumer/standard tier). Context: the
owner asked, sincerely, whether Magneetar is "near Prey's level." The honest
answer is **no** — this document quantifies exactly how far, feature by
feature, and prioritizes what closes the gap with the least effort.

---

## 1. Feature matrix

| Feature | Magneetar (v1.4.1) | Prey (consumer) | Cerberus | Find My Device |
|---|---|---|---|---|
| Real-time location tracking | ✅ (~3s, Kalman-filtered) | ✅ (always-on) | ✅ | ✅ |
| Location history | ⚠️ rolling/limited | ✅ 1 month + CSV export | ✅ | ✅ (limited) |
| Remote lock | ✅ (Device Admin) | ✅ | ✅ | ✅ |
| Remote alarm / siren | ✅ | ✅ | ✅ (max volume, silent mode bypass) | ✅ (ring) |
| Remote wipe | ✅ (admin wipe) | ✅ (disk/factory + file retrieval first) | ✅ | ✅ (erase) |
| Camera capture (front/rear) | ✅ | ✅ (opt-in) | ✅ (front/rear) | ❌ |
| Audio capture | ✅ | ❌ consumer | ⚠️ | ❌ |
| **SIM-change detection + alert** | ✅ **new (v1.4.1)** | ✅ | ✅ (cornerstone) | ❌ |
| Geofencing | ✅ (radius, exit alerts) | ✅ radius + geo-divisions, **automated actions** | ✅ + automated reactions | ✅ (notifications) |
| **Failed-unlock "theftie" capture** | ✅ **new (v1.5.1)** | ❌ | ✅ | ❌ |
| Custom lock-screen recovery message ("Lost mode") | ❌ (roadmap P0) | ✅ (alert message) | ✅ | ✅ |
| Screenshots of thief's screen | ❌ | ✅ (opt-in) | ✅ | ❌ |
| Stealth / hidden icon | ⚠️ covert minimize only | ✅ | ✅ (sideload APK) | ❌ (system) |
| Offline crowdsourced finding (BLE mesh) | ❌ (roadmap: **Magneetar Find Network**) | ❌ | ❌ | ✅ (billions of devices) |
| Background survival (OEM battery killers) | ✅ 3-layer + OEM map | ✅ (mature) | ✅ (admin/accessibility/FGS) | ✅ (system) |
| Multi-device / family | ✅ (multi-user, ownership) | ✅ | ✅ | ✅ |
| Law-enforcement evidence package | ⚠️ SHA-256 chain (dossier roadmap) | ✅ (incident reports) | ✅ | ❌ |
| Cross-platform (iOS/desktop) | ❌ Android only | ✅ all platforms | ⚠️ Android-centric | ✅ (Android/Wear/web) |
| Pricing | free/self-hosted | $2.99+/mo | subscription | free (built-in) |

---

## 2. The three honest conclusions

1. **The core loop is now genuinely comparable.** With SIM-change detection
   shipped this session, Magneetar's *track → detect → alert → command →
   evidence* loop matches the consumer "Protection" tier of all three
   competitors on the features that matter most (locate, lock, alarm, wipe,
   camera, SIM swap). That is not nothing — but it is table stakes, not a moat.

2. **Prey/Cerberus/Find My are years and millions of devices ahead on the
   hard infrastructure** — background survival across every OEM skin,
   cross-platform clients, location-history scale, and (for Google) a
   system-level offline-finding network that **is closed to third-party
   apps** (no public API/SDK — confirmed by research). Magneetar cannot
   out-build Google's mesh; it must differentiate elsewhere.

3. **Magneetar's defensible wedge is the same one Prey doesn't offer
   consumers: a private, opt-in crowdsourced find network** (roadmap Phase B).
   Google's network is closed; Cerberus has no mesh; Prey's consumer tier is
   single-account. A BLE mesh + Guardian sighting pipeline is the only feature
   in this table no competitor can copy for free.

---

## 3. Prioritized gap-closing plan (effort-ranked)

| # | Gap | Priority | Effort | Play-risk | Notes |
|---|---|---|---|---|---|
| 1 | **Geofence automated actions** — exit safe zone at 2am → auto siren + front capture + alert | 🔴 P0 | ~1 wk | ✅ none | Sentinel already scores exits; wire per-zone policy + queue the capture commands server-side (same machinery as theft-mode auto-capture) |
| 2 | **Lost Mode** — remote lock + full-screen "call this number / reward" message | 🔴 P0 | ~1 wk | ✅ with one rule | Use `showWhenLocked` activity / existing `SYSTEM_ALERT_WINDOW`; degrade to high-priority notification on Android 14+ (no auto `USE_FULL_SCREEN_INTENT`) — see `docs/PLAY_POLICY_ANALYSIS.md` §2 |
| 3 | **Recovery Dossier** — one-click police/insurer PDF (timeline + evidence + chain) | 🔴 P0 | ~1 wk | ✅ none (server-side) | `evidence_pdf.py` exists; wire a dashboard "Export dossier" |
| 4 | **Failed-unlock "theftie"** — auto front-camera capture on N failed unlocks | 🟡 P1 | 1–2 wks | ✅ none | ✅ **CLOSED (2026-08-12)** — Android `FailedUnlockMonitor` (DPC exact count when device admin/owner, else keyguard heuristic via `FailedUnlockReceiver`) reports the count on every ping/heartbeat; Sentinel now actually scores the previously-dead `failed_unlocks` signal (+20) over `MT_FAILED_UNLOCK_THRESHOLD` (default 5); both telemetry paths queue `capture_photo_front` + `capture_audio` + an always-deliver alert with 10-min dedup. 4 API + 3 Sentinel + 11 Android tests |
| 5 | **Location history + CSV export** — 30-day persistence + export | 🟡 P1 | 1–2 wks | ✅ none | Prey parity; also a free/paid lever |
| 6 | **Magneetar Find Network** (offline BLE mesh) | 🟡 P1 | 2–3 mo | ✅ with BLE scan declaration | The differentiator; rides the existing Guardian sighting pipeline |
| 7 | **Wear OS companion** (panic siren, last-known glance) | 🟢 P2 | 3 wks | ✅ | Cheap win, big demo value |
| 8 | **Screenshot capture / icon-hiding stealth** | ❌ **out of scope** | — | ⚠️ high | mSpy-class surveillance optics + Play review risk + stalking liability — explicitly rejected by the brand guardrails in `docs/roadmap.md` |

---

## 4. What this means for the owner's question

- **Feature level:** after v1.4.1, Magneetar is at "Prey Protection tier,
  single platform, pre-scale" — the *features* gap is now small and
  closable (items 1–5 are weeks, not years).
- **The un-closable gap is institutional:** Prey has 17 years, 7.7M users and
  every OEM's battery killer catalogued; Google owns the OS. Magneetar cannot
  match that — and does not need to, to win the Nigerian market it targets.
- **The strategy this audit supports:** ship items 1–5 (Phase A quick wins),
  then bet on item 6 (Find Network) as the differentiator. Compete on focus
  (Android + recovery outcomes), not on breadth.
