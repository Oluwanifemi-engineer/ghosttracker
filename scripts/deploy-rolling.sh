#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MAGNEETAR — Rolling Deploy Script (zero-downtime edition)
# Updates services ONE AT A TIME with health gates between each step.
# At no point are all services down simultaneously.
#
# Usage: bash scripts/deploy-rolling.sh
#        bash scripts/deploy-rolling.sh --skip-dashboard  (API-only deploy)
#        bash scripts/deploy-rolling.sh --skip-server     (dashboard-only deploy)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ── Parse args ────────────────────────────────────────────────────────────────
SKIP_SERVER=false
SKIP_DASHBOARD=false
for arg in "$@"; do
    case "$arg" in
        --skip-server) SKIP_SERVER=true ;;
        --skip-dashboard) SKIP_DASHBOARD=true ;;
        --help)
            echo "Usage: $0 [--skip-server] [--skip-dashboard]"
            echo "  --skip-server     Only deploy dashboard (no API restart)"
            echo "  --skip-dashboard  Only deploy server (no dashboard restart)"
            exit 0
            ;;
    esac
done

# ── Version wiring ────────────────────────────────────────────────────────────
MT_APP_VERSION="$(cat "$PROJECT_DIR/VERSION" 2>/dev/null || echo 1.4.0)"
export MT_APP_VERSION
ROLLBACK_TAG="predeploy"
SERVER_IMAGE="magneetar-server"
DASHBOARD_IMAGE="magneetar-dashboard"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║      MAGNEETAR — Rolling Deploy (zero-downtime)            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "   📦 Version: v${MT_APP_VERSION}"
if [ "$SKIP_SERVER" = true ]; then
    services="dashboard-only"
elif [ "$SKIP_DASHBOARD" = true ]; then
    services="server-only"
else
    services="server + dashboard"
fi
echo "   Services:  $services"
echo ""

# ── 0. Pre-flight ─────────────────────────────────────────────────────────────
if ! docker compose version > /dev/null 2>&1; then
    echo "   ❌ docker compose not available — aborting"
    exit 1
fi

# ── 1. Pull latest code ──────────────────────────────────────────────────────
echo "📦 [1/7] Pulling latest code..."
if git pull 2>&1; then
    echo "   ✅ Code updated"
else
    echo "   ⚠️  Git pull failed, continuing with current code"
fi
echo ""

# ── 2. Generate env if needed ────────────────────────────────────────────────
if [ ! -f server/.env ] || [ ! -s server/.env ]; then
    echo "🔐 [2/7] Generating environment secrets..."
    bash scripts/generate-env.sh
    echo "   ✅ Environment generated"
else
    echo "🔐 [2/7] Environment already configured"
fi
echo ""

# ── 3. BACKUP the live database FIRST ────────────────────────────────────────
echo "🗄️  [3/7] Backing up live database (pre-deploy checkpoint)..."
if bash scripts/backup-db.sh; then
    echo "   ✅ Database backup taken"
else
    echo "   ❌ Database backup FAILED — refusing to deploy over a DB we cannot restore"
    exit 1
fi
echo ""

# ── 4. Tag current images for rollback ────────────────────────────────────────
echo "🏷️  [4/7] Tagging current images for rollback..."
for img in "$SERVER_IMAGE" "$DASHBOARD_IMAGE"; do
    if docker image inspect "$img:latest" > /dev/null 2>&1; then
        docker tag "$img:latest" "$img:$ROLLBACK_TAG" 2>/dev/null && echo "   ✅ $img:latest → $img:$ROLLBACK_TAG"
    else
        echo "   ⚠️  $img:latest not found (first deploy?)"
    fi
done
echo ""

# ── 5. Ensure Redis is up ────────────────────────────────────────────────────
echo "🚀 [5/7] Ensuring Redis (realtime bus) is up..."
docker compose up -d redis 2>&1
echo "   ✅ Redis service ensured"
echo ""

# ── Helper: health gate ───────────────────────────────────────────────────────
HEALTH_RETRIES=18  # 3 minutes max
HEALTH_URL=""

wait_for_health() {
    local service_name="$1"
    local port="$2"
    local path="${3:-/health}"

    HEALTH_URL="http://localhost:${port}${path}"
    echo "⏳ Waiting for ${service_name} health (up to ${HEALTH_RETRIES}x10s)..."

    for i in $(seq 1 "$HEALTH_RETRIES"); do
        STATUS=$(curl -sf "${HEALTH_URL}" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
        if [ "$STATUS" = "online" ]; then
            echo "   ✅ ${service_name} is healthy (attempt $i)"
            return 0
        fi
        echo "   ⏳ ${service_name} attempt $i/${HEALTH_RETRIES} (status: ${STATUS:-unknown})..."
        sleep 10
    done

    echo "   ❌ ${service_name} did not become healthy within timeout"
    return 1
}

wait_for_serving() {
    local service_name="$1"
    local url="$2"

    echo "⏳ Waiting for ${service_name} to serve..."
    for i in $(seq 1 6); do
        if curl -sf -o /dev/null "$url" 2>/dev/null; then
            echo "   ✅ ${service_name} is serving"
            return 0
        fi
        echo "   ⏳ ${service_name} attempt $i/6..."
        sleep 5
    done

    echo "   ⚠️  ${service_name} may not be ready — check logs"
    return 0  # Non-fatal for dashboard (static files)
}

# ── 6. ROLLING DEPLOY ────────────────────────────────────────────────────────
echo "🏗️  [6/7] Rolling deploy..."
echo ""

# ─── Step A: Deploy SERVER first (API stays up during build via old container) ─
if [ "$SKIP_SERVER" = false ]; then
    echo "   ┌─ Rolling: SERVER ──────────────────────────────────────────"

    # Build the new server image (old container keeps serving)
    echo "   │ 🏗️  Building new server image..."
    docker compose build server 2>&1 | tail -3
    echo "   │ ✅ Server image built"

    # Restart server (brief ~5-10s gap while container recreates)
    echo "   │ 🔄 Restarting server..."
    docker compose up -d --no-deps server 2>&1

    # Health gate — server MUST be healthy before we touch dashboard
    if wait_for_health "server" 8002; then
        echo "   └─ ✅ Server rolling deploy complete"
    else
        echo "   └─ ❌ Server health check failed — rolling back server"
        docker tag "$SERVER_IMAGE:$ROLLBACK_TAG" "$SERVER_IMAGE:latest" 2>/dev/null
        docker compose up -d --no-deps server 2>&1
        echo "       Server restored to pre-deploy image"
        echo ""
        echo "   ❌ Deploy aborted — server is down"
        exit 1
    fi
    echo ""
fi

# ─── Step B: Deploy DASHBOARD (Nginx serves static files, brief swap) ────────
if [ "$SKIP_DASHBOARD" = false ]; then
    echo "   ┌─ Rolling: DASHBOARD ─────────────────────────────────────"

    # Build the new dashboard image (old Nginx keeps serving)
    echo "   │ 🏗️  Building new dashboard image..."
    docker compose build dashboard 2>&1 | tail -3
    echo "   │ ✅ Dashboard image built"

    # Restart dashboard (static files swap in ~1-2s)
    echo "   │ 🔄 Restarting dashboard..."
    docker compose up -d --no-deps dashboard 2>&1

    # Verify dashboard is serving
    if wait_for_serving "dashboard" "http://localhost:3000"; then
        echo "   └─ ✅ Dashboard rolling deploy complete"
    else
        echo "   └─ ⚠️  Dashboard may need attention — check logs"
    fi
    echo ""
fi

# ── 7. Post-deploy verification ──────────────────────────────────────────────
echo "🔒 [7/7] Post-deploy verification..."
echo ""

# Cloudflare tunnel
echo "   Checking Cloudflare tunnel..."
if docker compose ps cloudflared --format '{{.Status}}' 2>/dev/null | grep -qi 'Up'; then
    echo "   ✅ Cloudflare tunnel is running"
else
    echo "   ⚠️  Cloudflare tunnel down — restarting..."
    docker compose up -d --no-deps cloudflared 2>&1 || true
fi

# Public endpoints
echo ""
echo "   Checking public endpoints..."
if curl -sf https://api.magneetar.me/health > /dev/null 2>&1; then
    echo "   ✅ api.magneetar.me is live"
else
    echo "   ⚠️  api.magneetar.me not responding"
fi

# Build consistency check
page_chunk_hash() {
    curl -sf "$1" 2>/dev/null | grep -oE '/_next/static/chunks/[a-zA-Z0-9_-]+\.js' | sort -u | md5sum | cut -d' ' -f1
}
BARE_HASH=$(page_chunk_hash https://magneetar.me/)
APP_HASH=$(page_chunk_hash https://app.magneetar.me/)
if [ -n "$BARE_HASH" ] && [ "$BARE_HASH" = "$APP_HASH" ]; then
    echo "   ✅ magneetar.me and app.magneetar.me serve the same build"
else
    echo "   ⚠️  Build divergence detected between hosts"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           ✅  Rolling Deploy Complete!                      ║"
echo "║                                                              ║"
echo "║  API:       https://api.magneetar.me/health                  ║"
echo "║  Dashboard: https://app.magneetar.me                         ║"
echo "║  Rollback:  bash scripts/rollback.sh                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
