"""
Magneetar API Versioning
────────────────────────
Provides API version management with backward-compatible routing.

The API supports two routing modes:
1. Versioned: /api/v1/..., /api/v2/... (preferred for new clients)
2. Unversioned: /api/... (legacy, redirects to v1 or serves directly)

Version lifecycle:
- Current: v1 (all endpoints)
- Deprecated: None yet
- Sunset: None yet

When a new version is introduced:
1. v1 endpoints are marked deprecated in OpenAPI docs
2. A Sunset header is added to deprecated version responses
3. After 6 months, deprecated versions return 410 Gone
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse  # noqa: F401

# ─── Version Configuration ───────────────────────────────────────────────────

API_VERSIONS = {
    "v1": {
        "status": "current",
        "released": "2026-06-01",
        "deprecated": None,
        "sunset": None,
        "description": "Initial stable API — device management, location tracking, alerts, evidence capture",
    },
}

CURRENT_VERSION = "v1"
SUPPORTED_VERSIONS = list(API_VERSIONS.keys())

# Headers injected into every versioned response
VERSION_HEADERS = {
    "X-API-Version": CURRENT_VERSION,
    "X-API-Versions-Supported": ", ".join(SUPPORTED_VERSIONS),
}


def get_version_info(version: str) -> Optional[dict]:
    """Return version metadata or None if unsupported."""
    return API_VERSIONS.get(version)


def is_deprecated(version: str) -> bool:
    """True when a version is past its sunset date."""
    info = get_version_info(version)
    if not info:
        return False
    if info["sunset"]:
        try:
            sunset_date = datetime.fromisoformat(info["sunset"])
            return datetime.now(timezone.utc) >= sunset_date
        except (ValueError, TypeError):
            pass
    return False


# ─── Versioned Router Factory ────────────────────────────────────────────────


def create_versioned_router(version: str = CURRENT_VERSION) -> APIRouter:
    """Create a router prefixed with /api/{version}/.

    All new route modules should register on this router. Legacy unversioned
    routes continue to work — they are just the v1 routes without the prefix.
    """
    info = get_version_info(version)
    tags = [f"API {version.upper()}"]
    if info and info["status"] == "current":
        tags.append("Current")
    if info and info.get("deprecated"):
        tags.append("Deprecated")

    router = APIRouter(
        prefix=f"/api/{version}",
        tags=tags,
    )
    return router


# ─── Version Middleware ───────────────────────────────────────────────────────


async def api_version_middleware(request: Request, call_next):
    """Inject version headers into responses and handle deprecated versions.

    - Adds X-API-Version header to all /api/ responses
    - Adds Sunset header for deprecated versions
    - Returns 410 Gone for sunset versions
    """
    path = request.url.path

    # Only process API routes
    if not path.startswith("/api/"):
        return await call_next(request)

    # Extract version from path (e.g., /api/v1/devices → v1)
    version = None
    parts = path.strip("/").split("/")
    if len(parts) >= 2 and parts[0] == "api" and parts[1].startswith("v"):
        version = parts[1]

    # Legacy unversioned routes get the current version header
    if version is None:
        version = CURRENT_VERSION

    # Check if the version is sunset
    if is_deprecated(version):
        return JSONResponse(
            status_code=410,
            content={
                "detail": f"API {version} has been sunset. Please migrate to {CURRENT_VERSION}.",
                "current_version": CURRENT_VERSION,
                "migration_guide": f"/docs/migration-{version}-to-{CURRENT_VERSION}",
            },
        )

    response = await call_next(request)

    # Inject version headers
    response.headers["X-API-Version"] = version
    response.headers["X-API-Versions-Supported"] = ", ".join(SUPPORTED_VERSIONS)

    # Add Sunset header for deprecated versions
    info = get_version_info(version)
    if info and info.get("deprecated"):
        response.headers["Sunset"] = info["deprecated"]
        response.headers["Deprecation"] = "true"
        response.headers["Link"] = f'</api/{CURRENT_VERSION}{path}>; rel="successor-version"'

    return response


# ─── OpenAPI Schema Customization ────────────────────────────────────────────


def customize_openapi_schema(app: FastAPI):
    """Enhance the OpenAPI schema with version info, security schemes, and examples.

    This runs once at startup to generate rich documentation.
    """
    if app.openapi_schema:
        return app.openapi_schema

    from fastapi.openapi.utils import get_openapi

    schema = get_openapi(
        title="Magneetar API",
        version=API_VERSIONS[CURRENT_VERSION]["released"],
        description="""
# Magneetar Anti-Theft Tracking API

A production-grade API for device tracking, anti-theft protection, and family safety.

## Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header.

### Token Types
| Token Type | Purpose | Issued By |
|------------|---------|-----------|
| `user` | User account operations | `/api/auth/register`, `/api/auth/user/login` |
| `device` | Device telemetry & commands | `/api/device/register` |
| `dashboard` | Dashboard/admin operations | `/api/auth/login` (API key) |

### Security Model
- **JWT tokens** with RS256 signing and configurable expiry
- **Device keys** (HMAC-SHA256) for device authentication
- **Rate limiting** per IP and per device
- **Step-up authentication** for destructive actions (password re-verification)
- **2FA (TOTP)** for account security

## Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Registration | 10 requests | 10 minutes |
| Login | 5 attempts | 15 minutes |
| Location ping | Per-device | Configurable |
| Media upload | Per-device | Configurable |
| Command poll | Per-device | Configurable |

## API Versions

| Version | Status | Released |
|---------|--------|----------|
| v1 | Current | 2026-06-01 |

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request (validation error) |
| 401 | Authentication required or invalid |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate email) |
| 410 | API version sunset |
| 422 | Validation error |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable (maintenance) |
        """,
        routes=app.routes,
        tags=[
            {"name": "Authentication", "description": "User registration, login, and token management"},
            {"name": "Device", "description": "Device registration, location, media, and commands"},
            {"name": "Dashboard", "description": "Web dashboard operations (devices, shares, evidence)"},
            {"name": "Security", "description": "2FA, password reset, email verification"},
            {"name": "Monitoring", "description": "Metrics, health checks, and observability"},
        ],
    )

    # Add security schemes
    schema["components"] = schema.get("components", {})
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token from /api/auth/register or /api/auth/user/login",
        },
        "DeviceKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-Device-Key",
            "description": "Device secret key from registration",
        },
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "Server API key for dashboard/admin access",
        },
    }

    # Add common response schemas
    schema["components"]["schemas"] = schema["components"].get("schemas", {})
    schema["components"]["schemas"]["ErrorResponse"] = {
        "type": "object",
        "properties": {
            "detail": {"type": "string", "description": "Human-readable error message"},
            "error_code": {"type": "string", "description": "Machine-readable error code"},
        },
        "required": ["detail"],
    }
    schema["components"]["schemas"]["StatusResponse"] = {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ["ok", "error"]},
            "message": {"type": "string"},
        },
    }

    app.openapi_schema = schema
    return schema
