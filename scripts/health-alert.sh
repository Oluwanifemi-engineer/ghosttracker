#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MAGNEETAR — Automated Health Alert Monitor
# Checks /health at intervals, sends alerts on downtime, and recovers on return.
#
# Features:
#   - Configurable check interval (default: 60s)
#   - Alert on downtime via email, SMS, or webhook
#   - Recovery notification when service comes back
#   - State file to prevent alert spam (one alert per incident)
#   - Cron-friendly (runs as a daemon or one-shot)
#
# Usage:
#   bash scripts/health-alert.sh                    # One-shot check
#   bash scripts/health-alert.sh --daemon           # Continuous monitoring
#   bash scripts/health-alert.sh --init-cron        # Install cron job (every 2 min)
#   bash scripts/health-alert.sh --status           # Show current state
#
# Environment:
#   MT_API_ENDPOINT       - API URL (default: https://api.magneetar.me)
#   MT_ALERT_EMAIL        - Email for alerts (optional)
#   MT_ALERT_PHONE        - Phone for SMS alerts (optional)
#   MT_ALERT_WEBHOOK      - Webhook URL for alerts (optional, e.g. Slack/Discord)
#   MT_CHECK_INTERVAL     - Seconds between checks (default: 60)
#   MT_ALERT_COOLDOWN     - Minutes between repeated alerts (default: 30)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
API="${MT_API_ENDPOINT:-https://api.magneetar.me}"
CHECK_INTERVAL="${MT_CHECK_INTERVAL:-60}"
ALERT_COOLDOWN="${MT_ALERT_COOLDOWN:-30}"
STATE_DIR="/tmp/magneetar-monitor"
STATE_FILE="$STATE_DIR/health-state.json"
LOG_FILE="$STATE_DIR/health.log"
ALERT_EMAIL="${MT_ALERT_EMAIL:-}"
ALERT_PHONE="${MT_ALERT_PHONE:-}"
ALERT_WEBHOOK="${MT_ALERT_WEBHOOK:-}"

mkdir -p "$STATE_DIR"

# ── Helpers ────────────────────────────────────────────────────────────────────

timestamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

log() {
    local ts
    ts=$(timestamp)
    echo "$ts | $1" >> "$LOG_FILE"
    echo "$1"
}

# Read state from JSON file
get_state() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    else
        echo '{"status":"unknown","last_check":"","last_alert":"","incident_start":""}'
    fi
}

# Write state
set_state() {
    local status="$1"
    local incident_start="$2"
    local last_alert="$3"
    cat > "$STATE_FILE" <<EOF
{"status":"$status","last_check":"$(timestamp)","last_alert":"$last_alert","incident_start":"$incident_start"}
EOF
}

# Check if we should send an alert (cooldown)
should_alert() {
    local last_alert="$1"
    if [ -z "$last_alert" ] || [ "$last_alert" = "null" ]; then
        return 0  # Never alerted → alert now
    fi
    # Parse ISO timestamp to epoch
    local last_epoch now_epoch diff_minutes
    last_epoch=$(date -d "$last_alert" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    diff_minutes=$(( (now_epoch - last_epoch) / 60 ))
    if [ "$diff_minutes" -ge "$ALERT_COOLDOWN" ]; then
        return 0  # Cooldown elapsed
    fi
    return 1  # Still in cooldown
}

# ── Send Alerts ────────────────────────────────────────────────────────────────

send_alert() {
    local level="$1"  # "down" or "recovery"
    local message="$2"
    local ts
    ts=$(timestamp)

    # Email
    if [ -n "$ALERT_EMAIL" ] && command -v mail &>/dev/null; then
        echo "$message" | mail -s "🚨 Magneetar $level at $ts" "$ALERT_EMAIL" 2>/dev/null || true
    fi

    # SMS via Twilio (if configured)
    if [ -n "$ALERT_PHONE" ] && [ -n "${MT_TWILIO_SID:-}" ] && [ -n "${MT_TWILIO_AUTH_TOKEN:-}" ]; then
        curl -sf -X POST \
            "https://api.twilio.com/2010-04-01/Accounts/${MT_TWILIO_SID}/Messages.json" \
            -u "${MT_TWILIO_SID}:${MT_TWILIO_AUTH_TOKEN}" \
            -d "To=${ALERT_PHONE}" \
            -d "From=${MT_TWILIO_SMS_FROM:-+1234567890}" \
            -d "Body=Magneetar ALERT: $level — $message" \
            2>/dev/null || true
    fi

    # Webhook (Slack/Discord/custom)
    if [ -n "$ALERT_WEBHOOK" ]; then
        local emoji="🔴"
        [ "$level" = "recovery" ] && emoji="🟢"

        # Slack-compatible payload (also works with Discord webhooks)
        curl -sf -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"${emoji} Magneetar ${level}: ${message}\",\"content\":\"${emoji} Magneetar ${level}: ${message}\"}" \
            2>/dev/null || true
    fi

    log "ALERT [$level]: $message"
}

# ── Health Check ───────────────────────────────────────────────────────────────

check_health() {
    local http_code
    http_code=$(curl -s -o /dev/null -w '%{http_code}' \
        --connect-timeout 10 --max-time 15 \
        "$API/health" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
        # Parse response for deeper check
        local status
        status=$(curl -sf "$API/health" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
        if [ "$status" = "online" ]; then
            echo "healthy"
        else
            echo "degraded"
        fi
    elif [ "$http_code" = "000" ]; then
        echo "unreachable"
    else
        echo "error_$http_code"
    fi
}

# ── One-Shot Check ─────────────────────────────────────────────────────────────

run_check() {
    local state incident_start last_alert
    state=$(get_state)
    incident_start=$(echo "$state" | python3 -c "import json,sys; print(json.load(sys.stdin).get('incident_start',''))" 2>/dev/null || echo "")
    last_alert=$(echo "$state" | python3 -c "import json,sys; print(json.load(sys.stdin).get('last_alert',''))" 2>/dev/null || echo "")
    local prev_status
    prev_status=$(echo "$state" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")

    local health
    health=$(check_health)
    log "Health check: $health (previous: $prev_status)"

    case "$health" in
        healthy)
            if [ "$prev_status" != "healthy" ] && [ "$prev_status" != "unknown" ]; then
                # Recovery!
                send_alert "recovery" "Service recovered. Was $prev_status since $incident_start."
            fi
            set_state "healthy" "" ""
            ;;
        degraded)
            if [ "$prev_status" = "healthy" ] || [ "$prev_status" = "unknown" ]; then
                # New incident
                incident_start=$(timestamp)
                if should_alert "$last_alert"; then
                    send_alert "down" "Service is DEGRADED (database issue). Incident started: $incident_start"
                    last_alert=$(timestamp)
                fi
            elif should_alert "$last_alert"; then
                send_alert "down" "Service still DEGRADED. Ongoing since: $incident_start"
                last_alert=$(timestamp)
            fi
            set_state "degraded" "$incident_start" "$last_alert"
            ;;
        *)
            # unreachable or error
            if [ "$prev_status" = "healthy" ] || [ "$prev_status" = "unknown" ]; then
                # New incident
                incident_start=$(timestamp)
                if should_alert "$last_alert"; then
                    send_alert "down" "Service UNREACHABLE ($health). Incident started: $incident_start"
                    last_alert=$(timestamp)
                fi
            elif should_alert "$last_alert"; then
                send_alert "down" "Service still DOWN ($health). Ongoing since: $incident_start"
                last_alert=$(timestamp)
            fi
            set_state "$health" "$incident_start" "$last_alert"
            ;;
    esac
}

# ── Status Display ─────────────────────────────────────────────────────────────

show_status() {
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║       Magneetar Health Monitor Status                       ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Endpoint:  $API/health"
    echo "  Interval:  ${CHECK_INTERVAL}s"
    echo "  Cooldown:  ${ALERT_COOLDOWN}min between alerts"
    echo ""

    local state
    state=$(get_state)
    echo "  State:"
    echo "$state" | python3 -c "
import json, sys
s = json.load(sys.stdin)
status = s.get('status', 'unknown')
emoji = {'healthy': '✅', 'degraded': '⚠️'}.get(status, '❌')
print(f\"    Status:      {emoji} {status}\")
print(f\"    Last check:  {s.get('last_check', 'never')}\")
print(f\"    Last alert:  {s.get('last_alert', 'never')}\")
if s.get('incident_start'):
    print(f\"    Incident:    {s['incident_start']}\")
" 2>/dev/null || echo "    (no state)"

    echo ""
    echo "  Alert channels:"
    echo "    Email:    ${ALERT_EMAIL:-not configured}"
    echo "    SMS:      ${ALERT_PHONE:-not configured}"
    echo "    Webhook:  ${ALERT_WEBHOOK:-not configured}"
    echo ""

    if [ -f "$LOG_FILE" ]; then
        echo "  Recent checks:"
        tail -10 "$LOG_FILE" | sed 's/^/    /'
    fi
    echo ""
}

# ── Cron Setup ─────────────────────────────────────────────────────────────────

init_cron() {
    local script_path
    script_path="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
    local cron_job
cron_job="*/2 * * * * cd $(dirname "$script_path")/.. && bash $script_path >> /tmp/magneetar-monitor/cron.log 2>&1"

    if crontab -l 2>/dev/null | grep -q "health-alert.sh"; then
        echo "✅ Cron job already configured"
    else
        (crontab -l 2>/dev/null; echo "# Magneetar — Health monitor (every 2 minutes)"; echo "$cron_job") | crontab -
        echo "✅ Cron job installed (every 2 minutes)"
    fi
    crontab -l | grep -A1 'Magneetar.*Health'
}

# ── Main ───────────────────────────────────────────────────────────────────────

case "${1:-}" in
    --daemon)
        echo "🔍 Magneetar Health Monitor — Daemon Mode"
        echo "   Checking $API/health every ${CHECK_INTERVAL}s"
        echo "   Alerts: email=${ALERT_EMAIL:-off} sms=${ALERT_PHONE:-off} webhook=${ALERT_WEBHOOK:-off}"
        echo ""
        while true; do
            run_check
            sleep "$CHECK_INTERVAL"
        done
        ;;
    --status)
        show_status
        ;;
    --init-cron)
        init_cron
        ;;
    --help)
        echo "Usage: $0 [--daemon|--status|--init-cron|--help]"
        echo ""
        echo "Options:"
        echo "  (none)       One-shot health check"
        echo "  --daemon     Continuous monitoring (Ctrl+C to stop)"
        echo "  --status     Show current state and config"
        echo "  --init-cron  Install cron job (every 2 minutes)"
        echo "  --help       Show this help"
        echo ""
        echo "Environment:"
        echo "  MT_API_ENDPOINT      API URL (default: https://api.magneetar.me)"
        echo "  MT_ALERT_EMAIL       Email for alerts"
        echo "  MT_ALERT_PHONE       Phone for SMS alerts"
        echo "  MT_ALERT_WEBHOOK     Webhook URL (Slack/Discord)"
        echo "  MT_CHECK_INTERVAL    Seconds between checks (default: 60)"
        echo "  MT_ALERT_COOLDOWN    Minutes between alerts (default: 30)"
        ;;
    *)
        run_check
        ;;
esac
