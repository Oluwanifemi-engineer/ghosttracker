# Magneetar API Versioning Guide

## Overview

Magneetar uses URL-based API versioning with backward-compatible routing. All new endpoints are added to the current version (v1), and breaking changes trigger a new version.

## Current Versions

| Version | Status | Released | Sunset | Description |
|---------|--------|----------|--------|-------------|
| v1 | **Current** | 2026-06-01 | — | Initial stable API |

## URL Structure

```
/api/v1/devices        → Versioned (preferred)
/api/devices           → Unversioned (legacy, same as v1)
```

Both paths work. New clients should use the versioned path.

## Authentication

All authenticated endpoints require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### Token Types

| Type | Purpose | Issued By | Expires |
|------|---------|-----------|---------|
| `user` | Account operations | `/api/auth/register`, `/api/auth/user/login` | 1 hour |
| `device` | Telemetry & commands | `/api/device/register` | 24 hours |
| `dashboard` | Dashboard operations | `/api/auth/login` (API key) | 1 hour |
| `2fa` | 2FA challenge | `/api/auth/user/login` (when 2FA enabled) | 5 minutes |

## Version Headers

Every API response includes:

```http
X-API-Version: v1
X-API-Versions-Supported: v1
```

### Deprecated Versions

When a version is deprecated:

```http
Sunset: 2027-06-01
Deprecation: true
Link: </api/v2/endpoint>; rel="successor-version"
```

## Migration from Unversioned to v1

### Step 1: Update Base URL

```diff
- https://api.magneetar.me/api/devices
+ https://api.magneetar.me/api/v1/devices
```

### Step 2: Update Headers

Add the version header to all requests:

```http
X-API-Version: v1
```

### Step 3: Handle Version Headers

Read version info from responses:

```javascript
const version = response.headers.get('X-API-Version');
const supported = response.headers.get('X-API-Versions-Supported');
```

## Breaking Changes Policy

A new version is created when:

1. **Response structure changes** (fields added/removed/renamed)
2. **Authentication method changes**
3. **Endpoint removal or renaming**
4. **Error response format changes**

### Non-Breaking Changes (Added to Current Version)

- New optional request fields
- New response fields
- New endpoints
- New optional query parameters

## Error Responses

All errors follow a consistent format:

```json
{
  "detail": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE"
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Request body validation failed |
| 401 | `AUTHENTICATION_REQUIRED` | Missing or invalid token |
| 401 | `INVALID_CREDENTIALS` | Wrong email/password |
| 403 | `INSUFFICIENT_PERMISSIONS` | Token valid but access denied |
| 404 | `RESOURCE_NOT_FOUND` | Endpoint or resource doesn't exist |
| 409 | `CONFLICT` | Resource already exists (e.g., duplicate email) |
| 410 | `VERSION_SUNSET` | API version no longer available |
| 422 | `UNPROCESSABLE_ENTITY` | Request well-formed but semantically invalid |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | Maintenance mode |

## Rate Limits

| Endpoint Category | Limit | Window | Scope |
|-------------------|-------|--------|-------|
| Registration | 10 | 10 min | Per IP |
| Login | 5 | 15 min | Per IP |
| Password Reset | 5 | 15 min | Per IP |
| 2FA Verification | 5 | 15 min | Per user |
| Location Ping | Configurable | Per device | Per device |
| Media Upload | Configurable | Per device | Per device |
| Command Poll | Configurable | Per device | Per device |
| APK Ticket | 20 | 10 min | Per IP |

## OpenAPI Documentation

Interactive API docs are available at:

- **Swagger UI**: `/docs` (dev/staging only)
- **ReDoc**: `/redoc` (dev/staging only)
- **OpenAPI JSON**: `/openapi.json` (dev/staging only)

Production environments disable documentation endpoints for security.

## Version Lifecycle

```
Current → Deprecated → Sunset → Removed
   ↓         ↓           ↓         ↓
Active   Warnings    410 Gone   Deleted
```

### Timeline

1. **Current**: Active development, no warnings
2. **Deprecated**: Sunset header added, warnings in docs
3. **Sunset**: Returns 410 Gone with migration guidance
4. **Removed**: Endpoints deleted (after 6 months of sunset)

## Client SDK Examples

### JavaScript/TypeScript

```typescript
const API_BASE = 'https://api.magneetar.me/api/v1';

const response = await fetch(`${API_BASE}/devices`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-API-Version': 'v1',
  },
});

// Check version compatibility
const version = response.headers.get('X-API-Version');
if (version !== 'v1') {
  console.warn(`API version mismatch: expected v1, got ${version}`);
}
```

### Python

```python
import httpx

API_BASE = 'https://api.magneetar.me/api/v1'

response = httpx.get(
    f'{API_BASE}/devices',
    headers={
        'Authorization': f'Bearer {token}',
        'X-API-Version': 'v1',
    },
)

# Check for deprecation warnings
if response.headers.get('Deprecation') == 'true':
    sunset = response.headers.get('Sunset')
    print(f'Warning: API version sunset on {sunset}')
```

### cURL

```bash
curl -X GET https://api.magneetar.me/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-API-Version: v1"
```

## Best Practices

1. **Always use versioned URLs** for new integrations
2. **Check version headers** in responses for compatibility
3. **Handle 410 Gone** gracefully with migration logic
4. **Test against multiple versions** before upgrading
5. **Monitor deprecation warnings** in logs

## Support

For migration assistance:
- Documentation: `/docs`
- Email: support@magneetar.me
- Status: status.magneetar.me
