# Contributing to Magneetar

Thank you for your interest in contributing to Magneetar. This document explains how to get started.

## What is Magneetar?

Magneetar is an anti-theft tracking system for Android phones, designed for students and families in Africa. It combines:

- **Prey-style anti-theft:** Remote lock, alarm, wipe, evidence capture
- **Life360-style family tracking:** Real-time location sharing, circles, alerts
- **Anti-coercion security:** Duress PIN, panic mode, tamper detection

## Project Structure

```
magneetar/
├── server/                    # FastAPI backend (Python 3.12)
│   ├── main.py               # App entry point
│   ├── config.py             # Environment configuration
│   ├── models.py             # SQLAlchemy models
│   ├── routes/               # API route modules
│   │   ├── auth.py           # Sign up / sign in / token refresh
│   │   ├── devices.py        # Device registration and management
│   │   ├── dashboard.py      # Dashboard API (devices, alerts, commands)
│   │   ├── commands.py       # Remote command execution
│   │   └── admin.py          # Admin endpoints
│   ├── tests/                # 556+ pytest tests
│   └── requirements.txt
│
├── android-app/               # Android app (Kotlin)
│   └── app/src/main/java/com/magneetar/app/
│       ├── MainActivity.kt           # Entry point, onboarding router
│       ├── SignInActivity.kt         # Auth (Opay-style biometric)
│       ├── SignUpActivity.kt         # Registration
│       ├── PermissionsActivity.kt    # Step-by-step permission flow
│       ├── DashboardActivity.kt      # Main dashboard with bottom nav
│       ├── HomeFragment.kt           # Security score, quick actions
│       ├── MapFragment.kt            # OSMDroid live map
│       ├── DevicesFragment.kt        # Device cards with commands
│       ├── AlertsFragment.kt         # Activity feed
│       ├── SecurityFragment.kt       # IMEI vault, admin, emergency
│       ├── TrackingService.kt        # Foreground service, location, heartbeat
│       ├── DeviceAdmin.kt            # Anti-uninstall protection
│       ├── SentinelEngine.kt         # Theft detection scoring
│       └── CommandExecutor.kt        # Remote command handling
│
├── dashboard/                 # Next.js web dashboard (TypeScript)
│   └── src/
│       ├── app/              # App router pages
│       ├── components/       # React components
│       ├── hooks/            # Custom hooks
│       └── lib/              # API client, utilities
│
├── tests/                     # Integration tests
├── scripts/                   # Deployment and utility scripts
├── docs/                      # Documentation
└── .github/workflows/         # CI/CD (7 workflows)
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Server | Python 3.12, FastAPI | Async WebSocket support, fast development |
| Database | PostgreSQL (Neon) | Relational data, PostGIS for geofencing |
| Cache | Redis | Real-time location caching, WebSocket fan-out |
| Dashboard | Next.js 14, TypeScript, Tailwind | Server-side rendering, type safety |
| Maps | Leaflet + OpenStreetMap | Free, no API key required |
| Android | Kotlin, Jetpack, Material Design 3 | Native performance, modern UI |
| CI/CD | GitHub Actions | Automated testing, linting, deployment |
| Hosting | Railway (server), Vercel (dashboard) | Free tier, auto-deploy from git |

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Android Studio (for Android development)
- PostgreSQL 14+ (or use Neon free tier)
- Redis (or use a managed service)

### Server Setup

```bash
cd server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost/magneetar"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="your-secret-key"
export CORS_ORIGINS="http://localhost:3000"

# Run tests
pytest

# Start server
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### Dashboard Setup

```bash
cd dashboard
npm install

# Set environment variables
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local

# Run dev server
npm run dev
```

### Android Setup

```bash
cd android-app
# Open in Android Studio
# Set SERVER_URL in local.properties or build.gradle
```

## How to Contribute

### Good First Issues

Look for issues labeled `good first issue`. These are scoped to be completable in a single session:

- UI improvements (layouts, colors, spacing)
- Documentation fixes
- Test additions
- Bug fixes with clear reproduction steps

### Development Workflow

1. **Fork** the repository
2. **Create a branch** from `main` for your feature/fix
3. **Make changes** following the conventions below
4. **Write or update tests** for your changes
5. **Run the full test suite** to ensure nothing breaks
6. **Submit a pull request** with a clear description

### Code Conventions

#### Python (Server)
- Format with `black`
- Sort imports with `isort`
- Lint with `flake8`
- Write tests in `server/tests/` using pytest
- Use async/await for all database and HTTP operations
- Type hints are required on all public functions

#### Kotlin (Android)
- Follow Android Kotlin style guide
- Use Material Design 3 components
- Dark theme colors from `colors.xml` (never hardcode hex values)
- Use `BuildConfig.SERVER_URL` for API base URL
- Foreground services must declare `foregroundServiceType` in manifest

#### TypeScript (Dashboard)
- Format with Prettier
- Lint with ESLint
- Type all props and state
- Use Tailwind CSS utility classes
- Server components by default, `'use client'` only when needed

### Testing

```bash
# Server tests (556+ tests)
cd server && pytest -v

# Dashboard tests (209+ tests)
cd dashboard && npm test

# Android: build check
cd android-app && ./gradlew assembleDebug
```

All CI checks must pass before a PR can be merged.

## Architecture Decisions

### Why SQLite + Redis instead of PostgreSQL directly?

The current server uses SQLite with WAL mode for simplicity and zero-config deployment. Redis handles real-time WebSocket fan-out. This will migrate to PostgreSQL as user count grows.

### Why OSMDroid instead of Google Maps?

Google Maps requires an API key with billing. OSMDroid uses OpenStreetMap tiles which are free and work offline — critical for our target users in Africa where data is expensive.

### Why split the app into Play Store + direct download?

Google Play Store policies restrict apps with Device Admin, accessibility services, and silent SMS interception. The Play Store version has core tracking features. The direct download version unlocks advanced anti-theft capabilities.

## Reporting Issues

When reporting bugs, please include:

1. **Device** (make, model, Android version)
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshots or logs** if possible

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Welcome newcomers and help them learn
- Disagreements are fine; personal attacks are not

## Questions?

Open a GitHub Discussion or reach out on the project's communication channel.
