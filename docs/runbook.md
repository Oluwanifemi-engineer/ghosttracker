# Magneetar Operational Runbook

## Quick Reference

| Issue | Severity | Response Time | Action |
|-------|----------|---------------|--------|
| Server down | Critical | 5 min | Check health endpoint, restart if needed |
| Database connection lost | Critical | 5 min | Check Neon dashboard, restart connection pool |
| High error rate (>5%) | High | 15 min | Check logs, identify failing endpoint |
| Memory usage >80% | Medium | 30 min | Check for memory leaks, restart worker |
| Slow response times (>2s) | Medium | 30 min | Check database queries, Redis connectivity |

## Incident Response

### 1. Server Down

```bash
# Check health
curl -s https://api.magneetar.me/health

# Check Railway status
railway status

# Check logs
railway logs --limit 100

# Restart service
railway service restart
```

### 2. Database Connection Lost

```bash
# Check Neon dashboard
# https://console.neon.tech/app/projects/calm-leaf-04683662

# Check connection pool
curl -s https://api.magneetar.me/health | jq '.database'

# Restart server (clears stale connections)
railway service restart
```

### 3. High Error Rate

```bash
# Check Sentry dashboard
# https://sentry.io/organizations/magneetar/issues/

# Check specific endpoint errors
railway logs --filter "ERROR" --limit 50

# Common causes:
# - Database timeout (increase pool size)
# - External service failure (check Twilio/Firebase status)
# - Rate limiting (check if legitimate traffic spike)
```

### 4. Memory Usage High

```bash
# Check memory usage
railway metrics

# Common causes:
# - Memory leak in WebSocket connections
# - Unbounded cache growth
# - Large response payloads

# Fix: Restart worker
railway service restart
```

## Deployment Procedures

### Standard Deployment (Auto-deploy from main)

1. Push to `main` branch
2. Railway auto-deploys within 2-3 minutes
3. Monitor health endpoint after deployment
4. Check Sentry for new errors

### Manual Deployment

```bash
# Deploy specific version
railway service restart

# Rollback to previous version
railway service rollback
```

### Database Migration

```bash
# Migrations are idempotent (safe to re-run)
# No manual migration step needed — schema auto-updates on server start

# Verify schema
psql $DATABASE_URL -c "\dt"
```

## Monitoring

### Health Check

```bash
# Basic health
curl -s https://api.magneetar.me/health

# Detailed health (includes database, Redis, feature flags)
curl -s https://api.magneetar.me/health/detailed
```

### Metrics

```bash
# Prometheus metrics
curl -s https://api.magneetar.me/metrics

# Key metrics to watch:
# - http_requests_total (request rate)
# - http_request_duration_seconds (latency)
# - db_connections_active (connection pool)
# - websocket_connections_active (real-time users)
```

## Backup Procedures

### Database Backup

Neon handles automated backups with point-in-time recovery. To manually trigger:

```bash
# Via Neon API
curl -X POST https://console.neon.tech/api/projects/<project_id>/branches/<branch_id>/restore
```

### Media Backup

```bash
# Media files are stored on Railway volume
# Backup to external storage
railway run tar -czf media-backup-$(date +%Y%m%d).tar.gz /app/media
```

## Security Incidents

### Suspected Data Breach

1. **Immediately:** Rotate all API keys and secrets
2. **Notify:** Send breach notification to affected users within 72 hours (NDPR requirement)
3. **Investigate:** Check audit logs for unauthorized access
4. **Report:** File report with Nigeria Data Protection Commission if required

### Compromised API Key

```bash
# Rotate MT_API_KEY
railway variables set MT_API_KEY=<new-key>

# Rotate MT_JWT_SECRET (invalidates all existing tokens)
railway variables set MT_JWT_SECRET=<new-secret>

# Redeploy
railway service restart
```

## Scaling

### Current Capacity

- **Server:** 4 uvicorn workers, ~1,000 concurrent devices
- **Database:** Neon free tier (0.5 GB storage, 24/7 compute)
- **Redis:** 64 MB memory, LRU eviction

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | >1% | Check for bottlenecks |
| Response time p95 | >1s | Optimize queries, add caching |
| Database connections | >80% pool | Increase pool size |
| Memory usage | >80% | Restart worker, check for leaks |
| Storage | >80% | Archive old data, upgrade plan |

### Scale Up

```bash
# Increase workers
railway service scale --count 6

# Upgrade Neon plan
# https://console.neon.tech/app/projects/calm-leaf-04683662/settings
```

## Common Issues

### "Device limit reached" error

- User has hit their device allowance (free: 3 devices)
- Check: `SELECT tier FROM users WHERE id = ?`
- Fix: User upgrades plan or delete unused devices

### "Token expired" error

- JWT access token expired (24 hour lifetime)
- Client should use refresh token to get new access token
- Check: Token expiry in `jwt_tokens` table

### Location not updating

- Check if device is sending heartbeats: `SELECT * FROM heartbeats WHERE device_id = ? ORDER BY timestamp DESC LIMIT 5`
- Check if TrackingService is running: `adb shell dumpsys activity services com.magneetar.app`
- Check server logs for location POST errors

### Dashboard shows "offline"

- Device hasn't sent heartbeat in >30 minutes
- Check device connectivity
- Check if TrackingService was killed by Android battery optimization
