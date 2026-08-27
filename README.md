# Magneetar

> **Anti-theft tracking for Android.** When your phone is stolen, Magneetar keeps reporting its location, captures evidence, and lets you lock or alarm it remotely.

![Status](https://img.shields.io/badge/status-pilot-green)
![Tests](https://img.shields.io/badge/tests-535%20backend%20%2B%20209%20dashboard-brightgreen)
![Python](https://img.shields.io/badge/python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.140-green)
![Kotlin](https://img.shields.io/badge/kotlin-Android-orange)

---

## What it does

| Feature | How it works |
|---------|-------------|
| **Real-time tracking** | Phone reports GPS location every 3 seconds |
| **Theft detection** | Sentinel scores suspicious activity (SIM change, failed unlocks, device admin disabled) |
| **Evidence capture** | Auto-photos and audio when theft is detected |
| **Remote commands** | Lock, siren alarm, front-camera photo, audio recording, full wipe |
| **SMS commands** | Commands arrive via SMS when phone is offline |
| **Geofencing** | Safe zones with exit alerts and auto-actions |
| **Push alerts** | Theft, SIM change, geofence exit → instant notification |
| **Web dashboard** | See your devices on a live map from any browser |

## Architecture

```
Android App ──▶ Magneetar API ──▶ SQLite (WAL)
  (Kotlin)       (FastAPI)        (Redis for WebSocket fan-out)
                      │
                      ▼
                 Next.js Dashboard
```

- **Server:** Python 3.12, FastAPI, SQLite with WAL mode, Redis for multi-worker WebSocket
- **Dashboard:** Next.js 14, TypeScript, Tailwind CSS, Leaflet maps
- **Android:** Kotlin, Jetpack, Firebase Cloud Messaging, Camera2 API

## Quick start

### For testers

1. Download the APK (link sent by developer)
2. Enable "Install from unknown sources"
3. Open Magneetar → Sign Up → grant permissions
4. Done — the app runs silently in the background

### For developers

```bash
# Clone and setup
git clone <repo-url> && cd magneetar
bash scripts/generate-env.sh   # Generate secrets
make setup                      # Install dependencies

# Run locally
make server      # API on :8000
make dashboard   # Dashboard on :3000

# Run tests
make test        # 535 backend + 209 dashboard tests

# Deploy (Docker)
bash scripts/deploy-mvp.sh
```

## Project structure

```
server/                  # Python FastAPI backend
├── main.py              # App setup, middleware, WebSocket
├── routes/devices.py    # Device API (register, location, commands)
├── routes/dashboard.py  # Dashboard API (login, devices, evidence)
├── routes/admin.py      # Admin stats (WebSocket only)
├── routes/metrics.py    # Observability endpoints
├── auth.py              # JWT + device key authentication
├── database.py          # SQLite schema + helpers
├── sentinel.py          # Theft detection scoring
├── alerts.py            # SMS/WhatsApp/push alerts
├── models.py            # Pydantic request/response models
└── tests/               # 535 tests

dashboard/               # Next.js web dashboard
├── src/app/             # Pages (landing, login, dashboard)
├── src/components/      # UI components
├── src/lib/             # API client
└── src/__tests__/       # 209 tests

android-app/             # Android Kotlin app
├── app/src/main/java/   # Services & activities
└── app/build.gradle.kts # Build config

scripts/                 # Deploy & utilities
├── deploy-mvp.sh        # One-command Docker deploy
├── backup-db.sh         # Database backup
└── generate-env.sh      # Secret generation
```

## API endpoints

**Device-facing (phone → server):**
- `POST /api/device/register` — register device, get JWT
- `POST /api/device/location` — telemetry ping
- `POST /api/device/heartbeat` — heartbeat
- `POST /api/device/media` — upload evidence
- `GET /api/device/commands/{id}` — poll commands
- `POST /api/device/commands/{id}/ack` — acknowledge command

**Dashboard-facing (web → server):**
- `POST /api/auth/login` — dashboard login
- `GET /api/dashboard/devices` — list devices with locations
- `POST /api/dashboard/command` — issue remote command
- `GET /api/dashboard/evidence/{id}` — evidence cases
- `POST /api/dashboard/geofence` — create geofence
- `GET /api/dashboard/locations/{id}/export/csv` — location export

**System:**
- `GET /health` — health check
- `GET /metrics` — Prometheus metrics
- `WS /ws/dashboard` — real-time updates

## Security

- **Device key auth:** Each device generates its own 256-bit secret key
- **JWT tokens:** Short-lived access tokens, long-lived refresh tokens
- **Encrypted at rest:** AES-256-GCM for location data and TOTP secrets
- **Rate limiting:** Per-endpoint rate limits prevent abuse
- **No tracking:** Photos only captured when theft is detected

## License

Business Source License 1.1 — source-available, non-commercial use allowed.
Converts to Apache 2.0 on 2030-08-01.

## Author

Oluwanifemi Tinubu — Electronic and Electrical Engineering, OAU
