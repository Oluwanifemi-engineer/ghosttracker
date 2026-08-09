# Incident Response Playbook

## Overview

This playbook provides step-by-step procedures for responding to incidents in Magneetar. Follow these procedures to minimize impact and restore service quickly.

## Incident Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P1 - Critical** | Complete service outage or data breach | 15 minutes | Server down, database corruption |
| **P2 - High** | Major feature unavailable | 1 hour | Dashboard inaccessible, alerts failing |
| **P3 - Medium** | Degraded performance | 4 hours | Slow API responses, partial feature loss |
| **P4 - Low** | Minor issue, workaround exists | 24 hours | UI bug, non-critical error logs |

## Incident Response Phases

### 1. Detection & Triage

**Immediate Actions:**
1. Acknowledge the alert/incident
2. Assess severity using the matrix above
3. Notify appropriate team members
4. Create incident ticket with timeline

**Commands:**
```bash
# Check server health
curl -s https://api.magneetar.me/health | jq .

# Check Docker status
docker compose ps

# Check recent logs
docker compose logs server --tail=100
```

### 2. Investigation

**Data Collection:**
```bash
# Server logs
docker compose logs server -f --since=30m

# Database status
docker exec magneetar-server python3 -c "
import sqlite3
conn = sqlite3.connect('/app/data/magneetar.db')
print('Tables:', conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall())
print('Device count:', conn.execute('SELECT COUNT(*) FROM devices').fetchone()[0])
"

# System resources
docker stats --no-stream

# Network connectivity
curl -I https://api.magneetar.me/health
```

**Common Issues:**
- **Database locked**: SQLite write contention → check `MT_WRITE_BATCH_MS`
- **Memory pressure**: Container OOM → increase memory limits
- **Network timeout**: Check Cloudflare Tunnel status
- **Auth failures**: Verify API keys are correct

### 3. Containment

**For Service Outage:**
```bash
# Restart specific service
docker compose restart server

# Full stack restart
docker compose down && docker compose up -d

# Check if issue persists
curl -s https://api.magneetar.me/health | jq .status
```

**For Data Issues:**
```bash
# Stop writes immediately
docker compose stop server

# Create emergency backup
bash scripts/backup-db.sh

# Investigate data integrity
docker exec magneetar-server python3 -c "
import sqlite3
conn = sqlite3.connect('/app/data/magneetar.db')
print('Integrity check:', conn.execute('PRAGMA integrity_check').fetchone())
"
```

**For Security Incident:**
```bash
# Rotate compromised secrets immediately
python -c "import secrets; print(secrets.token_hex(32))"

# Update server/.env with new secrets
# Deploy immediately
bash scripts/deploy.sh

# Invalidate all tokens (if JWT secret compromised)
# Users and devices will need to re-authenticate
```

### 4. Resolution

**Service Restoration:**
```bash
# Verify fix
curl -s https://api.magneetar.me/health | jq .

# Monitor for 15 minutes
watch -n 30 'curl -s https://api.magneetar.me/health | jq .status'

# Confirm alerts are working
python scripts/alert-smoke-test.py
```

**Data Recovery:**
```bash
# Restore from backup if needed
bash scripts/backup-db.sh --restore /path/to/backup.db

# Verify data integrity
docker exec magneetar-server python3 -c "
import sqlite3
conn = sqlite3.connect('/app/data/magneetar.db')
print('Integrity:', conn.execute('PRAGMA integrity_check').fetchone())
"
```

### 5. Post-Incident

**Documentation:**
1. Update incident timeline
2. Document root cause
3. List all actions taken
4. Identify prevention measures
5. Schedule post-mortem meeting

**Post-Mortem Template:**
```markdown
# Incident Post-Mortem: [Title]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: P1/P2/P3/P4
- **Impact**: Description of user impact

## Timeline
- HH:MM - Incident detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service restored

## Root Cause
[Detailed explanation of what went wrong]

## Resolution
[What was done to fix the issue]

## Prevention
[What changes will prevent this from happening again]

## Action Items
- [ ] [Action item 1]
- [ ] [Action item 2]
```

## Common Scenarios

### Scenario: Database Corruption

**Symptoms:**
- `database is locked` errors
- Data inconsistency
- Integrity check fails

**Response:**
1. Stop server immediately
2. Create backup of corrupted DB
3. Run integrity check
4. Restore from last known good backup
5. Investigate cause (power failure? disk full?)

### Scenario: Alert Delivery Failure

**Symptoms:**
- Users not receiving alerts
- Circuit breaker open in logs
- SendGrid/Twilio errors

**Response:**
1. Check provider status pages
2. Verify API keys are correct
3. Check rate limits
4. Test with `alert-smoke-test.py`
5. Switch to fallback providers if available

### Scenario: High Memory Usage

**Symptoms:**
- Container restarts
- Slow API responses
- OOM kills in logs

**Response:**
1. Check `docker stats`
2. Identify memory leak (if any)
3. Increase container memory limit
4. Restart service
5. Monitor for recurrence

### Scenario: WebSocket Disconnections

**Symptoms:**
- Dashboard not updating
- Frequent reconnection attempts
- `WebSocketDisconnect` in logs

**Response:**
1. Check connection limits
2. Verify Redis connectivity (if multi-worker)
3. Check network stability
4. Review heartbeat configuration
5. Monitor `active_dashboard_connections`

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Availability**: Health endpoint response
2. **Latency**: API response times (p50, p95, p99)
3. **Errors**: Error rate by endpoint
4. **Throughput**: Requests per second
5. **Database**: Connection pool, query times
6. **Memory**: Container memory usage
7. **Disk**: Database file size, media storage

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Health check | > 2s | > 5s or failed |
| API latency (p95) | > 1s | > 3s |
| Error rate | > 1% | > 5% |
| Memory usage | > 80% | > 95% |
| Disk usage | > 80% | > 90% |

### Dashboard Queries

```sql
-- Recent alerts
SELECT * FROM alerts ORDER BY created_at DESC LIMIT 10;

-- Device activity
SELECT id, last_seen, owner_id FROM devices ORDER BY last_seen DESC;

-- Error log
SELECT * FROM error_log ORDER BY created_at DESC LIMIT 20;

-- Rate limit hits
SELECT * FROM rate_limits WHERE timestamp > datetime('now', '-1 hour');
```

## Contact Information

- **Primary On-call**: Oluwanifemi Tinubu
- **Escalation**: [Add escalation path]
- **External Services**:
  - Cloudflare Support: [Link]
  - Twilio Support: [Link]
  - SendGrid Support: [Link]

## Resources

- [Monitoring Guide](../monitoring.md)
- [Secret Rotation Runbook](../secret-rotation.md)
- [Deployment Guide](../deployment.md)
- [Security Notes](../security.md)
