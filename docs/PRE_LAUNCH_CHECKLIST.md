# Pre-Launch Checklist — 10-Person Pilot

## ✅ Done (code ready)

- [x] Server stripped to MVP (4 route modules, 73 endpoints)
- [x] Dashboard stripped (removed 8 pages, 7 component directories)
- [x] 535 backend tests passing
- [x] 209 dashboard tests passing
- [x] TypeScript clean
- [x] App icon fixed (M mark centered in safe zone)
- [x] APK built (7.4MB sideload release)
- [x] Server deployed and healthy on :8002
- [x] Dashboard running on :3000
- [x] Deploy script ready (scripts/deploy-mvp.sh)
- [x] Pilot docs written (PILOT_BRIEF.md, QUICK_START.md, TESTER_INVITE.md)
- [x] All changes committed (3 commits)

## 🔲 Before sending APK to testers

### Server
- [ ] Set `MT_ENVIRONMENT=production` in server/.env
- [ ] Configure at least ONE alert channel:
  - [ ] Twilio (SMS + WhatsApp): set MT_TWILIO_SID, MT_TWILIO_AUTH_TOKEN, MT_TWILIO_SMS_FROM
  - [ ] OR Firebase (push): set MT_FIREBASE_KEY to service account JSON path
  - [ ] OR both
- [ ] Set MT_ALERT_PHONE to your phone number (to receive test alerts)
- [ ] Set MT_ALERT_EMAIL to your email (to receive test alerts)
- [ ] Verify Cloudflare Tunnel is routing correctly (api.magneetar.me → server)

### Android
- [ ] Build signed release APK with your keystore
- [ ] Test APK install on a real phone
- [ ] Test registration flow (sign up → verify email → see device on dashboard)
- [ ] Test one remote command (siren from dashboard)
- [ ] Test theft detection (lock phone 5 times → check if alert fires)

### Dashboard
- [ ] Verify login works
- [ ] Verify device appears on map after registration
- [ ] Verify commands work (siren, lock)
- [ ] Verify evidence panel shows captured media

### Infrastructure
- [ ] Database backup cron is running (daily at 3am)
- [ ] Health monitor is running (health-alert.sh --daemon)
- [ ] Docker restart policy is `unless-stopped`

## 🔲 Day 0 (first tester)

- [ ] Send APK to first tester
- [ ] Walk them through install (2 minutes)
- [ ] Verify their device appears on dashboard
- [ ] Send them a test alert (trigger theft detection)

## 🔲 Week 1

- [ ] Check in with all testers
- [ ] Review server logs for errors
- [ ] Check database size (should be < 100MB for 10 devices)
- [ ] Verify alerts are delivering (SMS/WhatsApp/push)

## 🔲 Week 2

- [ ] Mid-pilot survey (WhatsApp or form)
- [ ] Check false positive rate for theft detection
- [ ] Review battery impact reports
- [ ] Fix any critical bugs

## 🔲 Week 4 (end of pilot)

- [ ] End-of-pilot survey
- [ ] Ask the one question: "Would you pay ₦500/month?"
- [ ] Compile results
- [ ] Decide: continue, pivot, or stop

## Emergency contacts

| Issue | What to do |
|-------|-----------|
| Server down | `docker compose up -d` |
| Database corrupted | Restore from backup: `bash scripts/backup-db.sh --restore` |
| Alert not sending | Check Twilio/Firebase credentials in server/.env |
| APK crashes | Check logcat: `adb logcat | grep Magneetar` |
