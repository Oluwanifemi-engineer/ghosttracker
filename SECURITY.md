# 🔒 Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Magneetar, please report it responsibly. **Do not open a public GitHub issue for security vulnerabilities.**

### How to Report

- **Email:** security@magneetar.me
- **Subject line:** `[SECURITY] Brief description of the vulnerability`
- **Include:**
  - Description of the vulnerability
  - Steps to reproduce
  - Potential impact assessment
  - Any suggested fixes (optional)

### What to Expect

| Stage | Timeline |
|-------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Fix timeline | Depends on severity (see below) |
| Disclosure | After fix is deployed |

### Severity Classification

| Severity | Response Time | Examples |
|----------|--------------|----------|
| **Critical** | 24-48 hours | Remote code execution, authentication bypass, data exfiltration |
| **High** | 1 week | Privilege escalation, sensitive data exposure, SMS command injection |
| **Medium** | 2 weeks | Rate limit bypass, information disclosure, CSRF |
| **Low** | 1 month | Minor UI issues, non-sensitive data leaks, best-practice improvements |

## Scope

### In Scope

- **Server** (Python/FastAPI): Authentication, authorization, encryption, API endpoints, database queries, WebSocket security
- **Android App** (Kotlin): Device key handling, SMS command verification, data storage, network security, permissions
- **Dashboard** (Next.js/React): XSS, CSRF, authentication flow, token handling, client-side security
- **Infrastructure**: Docker configuration, CI/CD pipeline, deployment scripts, secrets management

### Out of Scope

- Third-party services (Twilio, SendGrid, Firebase, Cloudflare)
- Social engineering attacks
- Physical device security
- Denial of service attacks against infrastructure we don't control
- Issues in dependencies that are already publicly disclosed and patched

## Security Architecture

For details on Magneetar's security design, see:
- [docs/security.md](docs/security.md) — Full security architecture documentation
- [docs/adr/](docs/adr/) — Architecture Decision Records for security choices

### Key Security Features

- **AES-256-GCM** encryption at rest: account secrets (TOTP 2FA) always encrypted; location telemetry encrypted with per-device HKDF keys when `MT_ENCRYPTION_KEY` is set (v1.5+); SHA-256 chain-of-custody hashing for evidence; TLS in transit
- **JWT tokens** with refresh rotation and revocation (in-memory + DB cache)
- **Separate device key** (low-privilege, in APK) vs master API key (dashboard only)
- **Step-up authentication** for destructive actions (wipe, device/media deletion)
- **Rate limiting** with CGNAT awareness for Nigerian ISP shared IPs
- **TOTP 2FA** with encrypted secrets at rest and replay protection
- **Constant-time comparisons** for all credential checks (hmac.compare_digest)
- **SMS command security** — sender allowlist + pairing code + brute-force cooldown
- **Audit logging** for all sensitive operations
- **Security headers** — HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy

## Residual Risks (documented, accepted)

- **The shared device key is public** (`MT_DEVICE_KEY` ships inside every
  APK). Anyone with the APK can register UNOWNED devices (capped by
  `MAX_UNOWNED_DEVICES`) and write telemetry under the device-scope
  `api_key_user` identity. This is the accepted trade-off of keyless
  self-hosted onboarding; mitigations: unowned-registration cap, no row
  creation on the FCM-token path, `device_id` mismatch checks, and the
  per-device `x-device-key` secret for real devices. An unowned device's
  authenticity is therefore NOT cryptographic — **link devices to an account
  (or pair them) before relying on their alerts.** A future hardening option
  (not yet implemented): suppress theft-mode auto-alerts for unowned
  devices.
- **Location/command data is only as secure as the deployment host.**
  SQLite at-rest encryption covers coordinates (AES-256-GCM, per-device
  HKDF keys when `MT_ENCRYPTION_KEY` is set); hosts should still encrypt
  disks and rotate `MT_ENCRYPTION_KEY` with a migration plan.

## Responsible Disclosure

We follow [ISO 29147](https://www.iso.org/standard/72704.html) guidelines for vulnerability disclosure. We request:

1. **Give us reasonable time** to fix the issue before public disclosure
2. **Make a good faith effort** to avoid privacy violations and data destruction
3. **Do not access or modify** data belonging to other users

### Safe Harbor

We will not pursue legal action against researchers who:

- Make a good faith effort to avoid privacy violations
- Do not access or modify data belonging to other users
- Report vulnerabilities promptly
- Do not exploit vulnerabilities beyond what is necessary to demonstrate the issue

## Bug Bounty

Currently, Magneetar does not offer a formal bug bounty program. However, we deeply appreciate security researchers who help us improve. Acknowledgments may be given (with permission) in our security advisories.

## Security Contact

- **Primary:** security@magneetar.me
- **GPG Key:** Available upon request
- **Response SLA:** 48-hour acknowledgment guarantee

---

*Last updated: August 2026*
