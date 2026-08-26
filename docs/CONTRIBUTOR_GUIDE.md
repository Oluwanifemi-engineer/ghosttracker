# Magneetar — Contributor Guide

**Last Updated:** August 2026  
**Purpose:** Get a new developer productive in < 2 hours

---

## Quick Start

```bash
# 1. Clone and setup
git clone <repo-url> && cd magneetar
bash scripts/generate-env.sh    # Generate secure secrets
make setup                       # Install all dependencies

# 2. Run the dev stack
make dev                         # Docker Compose (prod-parity)
# API: http://localhost:8000
# Dashboard: http://localhost:3000

# 3. Run tests
make test                        # Backend + Dashboard tests
make validate                    # Full CI-equivalent gate
```

---

## Architecture in 60 Seconds

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Android App │────▶│   Magneetar API  │────▶│     SQLite     │
│  (Kotlin)    │     │   (FastAPI/Py)   │     │  (WAL mode)    │
└──────┬───────┘     └────────┬─────────┘     └────────────────┘
       │                      │
       │  x-device-key        │  WebSocket
       │                      │
       ▼                      ▼
┌──────────────┐     ┌──────────────────┐
│  FCM Push    │     │   Next.js        │
│  Notifications│     │   Dashboard      │
└──────────────┘     └──────────────────┘
```

### Key Concepts

1. **Device Key Auth**: Each device has a unique 256-bit key. The shared `MT_DEVICE_KEY` is only for initial registration.
2. **Sentinel AI**: Server-side theft detection scoring (0-100). Score ≥ 80 = stolen mode.
3. **Evidence Chain**: SHA-256 hash chain links all evidence items for police/insurer handover.
4. **RBAC**: Owner > Admin > Viewer > Device_only. Enforced on every endpoint.

---

## Project Structure

### Backend (`server/`)

| File | Purpose |
|------|---------|
| `main.py` | App setup, middleware, route registration, APK download |
| `auth.py` | JWT + device key authentication |
| `config.py` | Environment variable loading (Pydantic Settings) |
| `database.py` | SQLite schema, migrations, connection pooling |
| `sentinel.py` | Theft detection scoring engine |
| `alerts.py` | Multi-channel alert delivery (SMS, WhatsApp, Push, Email) |
| `evidence.py` | Evidence chain management |
| `evidence_pdf.py` | PDF report generation (ReportLab) |
| `encryption.py` | AES-256-GCM at-rest encryption |
| `models.py` | Pydantic request/response models |
| `routes/` | API endpoint modules (devices, dashboard, guardian, etc.) |
| `tests/` | pytest test suite (617+ tests) |

### Android (`android-app/`)

| Package | Purpose |
|---------|---------|
| `TrackingService.kt` | Background location, heartbeat, command loop |
| `MediaCaptureService.kt` | Camera/audio evidence capture |
| `AdminReceiver.kt` | Device admin (lock, wipe) |
| `BootReceiver.kt` | Auto-start on boot |
| `OEMUtils.kt` | Chinese OEM battery killer workarounds |

### Dashboard (`dashboard/`)

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js pages (login, dashboard, download) |
| `src/components/` | React components (map, device panel, commands) |
| `src/__tests__/` | Jest test suite (214+ tests) |

---

## Development Workflow

### Making Changes

1. **Create a branch:** `git checkout -b feat/my-feature`
2. **Write code** following existing patterns
3. **Write tests** for new functionality
4. **Run `make validate`** — must pass before committing
5. **Commit** with a descriptive message (see `COMMIT_GUIDELINES.md`)
6. **Push and create a PR**

### Code Quality

- **Python:** black formatter, isort, flake8 (configured in `.flake8`)
- **TypeScript:** ESLint, TypeScript strict mode
- **Pre-commit hooks** run all checks automatically

### Testing

```bash
# Backend only
cd server && python -m pytest tests/ -v

# Dashboard only
cd dashboard && npx jest

# Full suite
make test
```

---

## Common Tasks

### Adding a New API Endpoint

1. Create route in `server/routes/your_feature.py`
2. Add Pydantic models in `server/models.py`
3. Register router in `server/main.py` (`app.include_router()`)
4. Add database tables/migrations in `server/database.py`
5. Write tests in `server/tests/test_your_feature.py`
6. Run `make test` to verify

### Adding a New Android Feature

1. Add Kotlin files in `android-app/app/src/main/java/com/magneetar/app/`
2. Update `AndroidManifest.xml` if new permissions/services needed
3. Add JVM tests in `android-app/app/src/test/java/`
4. Build: `./gradlew assembleDebug`

### Adding a New Dashboard Component

1. Create component in `dashboard/src/components/`
2. Add tests in `dashboard/src/__tests__/`
3. Import in relevant page under `dashboard/src/app/`
4. Run `npx jest` to verify

---

## Key Architecture Decisions

Read these ADRs before making significant changes:

| ADR | Decision | Why |
|-----|----------|-----|
| `docs/adr/0001-sqlite-as-primary-database.md` | SQLite is the production data plane | Simplicity, zero-config, WAL mode handles concurrency |
| `docs/adr/0002-device-key-authentication.md` | Device key for registration only | Prevents APK extraction from compromising admin |
| `docs/adr/0005-postgres-storage-interface.md` | Postgres adapter is frozen/experimental | Don't touch unless you have 1,000+ users |
| `docs/adr/0006-play-submission-gated-on-real-world-validation.md` | Play Store blocked until validation passes | No shortcuts on quality |

---

## Security Checklist

Before merging any PR, verify:

- [ ] No secrets in code (use environment variables)
- [ ] Authentication required on all protected endpoints
- [ ] Input validation on all user-facing inputs
- [ ] SQL injection prevention (parameterized queries only)
- [ ] Rate limiting on auth endpoints
- [ ] Audit logging for sensitive operations
- [ ] Tests pass (`make validate`)

---

## Getting Help

- **Architecture docs:** `docs/architecture.md`
- **API reference:** `docs/api-reference.md`
- **Security policy:** `SECURITY.md`
- **Deployment:** `docs/DEPLOYMENT_INSTRUCTIONS.md`
- **Runbooks:** `docs/runbooks/incident-response.md`

---

## First Task Suggestions

Pick one of these to get familiar with the codebase:

1. **Fix a flaky test** — run `make test` and investigate any failures
2. **Add a new Sentinel signal** — add a detection rule to `sentinel.py`
3. **Improve error messages** — make API errors more descriptive
4. **Write documentation** — fill gaps in `docs/`
5. **Add a dashboard metric** — expose a new Prometheus metric
