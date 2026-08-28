#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# MAGNEETAR — Railway Deployment Helper
# Sets up environment variables and deploys to Railway.
#
# Prerequisites:
#   1. Railway account (sign up at railway.com with GitHub)
#   2. Railway CLI installed: curl -fsSL https://railway.com/install.sh | sh
#   3. Logged in: railway login
#
# Usage:
#   1. Run this script: bash scripts/deploy-railway.sh
#   2. Follow the prompts
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[MAGNEETAR]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Check prerequisites ────────────────────────────────────────────────────
if ! command -v railway &>/dev/null; then
    err "Railway CLI not installed. Run: curl -fsSL https://railway.com/install.sh | sh"
fi

if ! railway whoami &>/dev/null; then
    err "Not logged in. Run: railway login"
fi

log "Logged in as: $(railway whoami)"

# ── Generate secrets ────────────────────────────────────────────────────────
JWT_SECRET=$(openssl rand -hex 32)
API_KEY=$(openssl rand -hex 16)
DEVICE_KEY=$(openssl rand -hex 16)

log "Generated secrets:"
echo "  JWT_SECRET: ${JWT_SECRET:0:8}..."
echo "  API_KEY:    ${API_KEY:0:8}..."
echo "  DEVICE_KEY: ${DEVICE_KEY:0:8}..."

# ── Create Railway project ──────────────────────────────────────────────────
log "Creating Railway project..."
railway init --name magneetar 2>/dev/null || warn "Project may already exist"

# ── Add Redis plugin ────────────────────────────────────────────────────────
log "Adding Redis plugin..."
railway plugin add redis 2>/dev/null || warn "Redis may already exist"

# ── Set environment variables ───────────────────────────────────────────────
log "Setting environment variables..."
railway variables set \
    MT_ENVIRONMENT=production \
    MT_HOST=0.0.0.0 \
    MT_DB_PATH=/app/data/magneetar.db \
    MT_MEDIA_DIR=/app/media \
    MT_MAX_WS_CONNECTIONS=250 \
    MT_WRITE_BATCH_MS=250 \
    MT_DATA_RETENTION_DAYS=90 \
    MT_MAX_DEVICES_PER_USER=5 \
    MT_JWT_SECRET="$JWT_SECRET" \
    MT_API_KEY="$API_KEY" \
    MT_DEVICE_KEY="$DEVICE_KEY" \
    MT_FEATURE_MAINTENANCE_MODE=false

log "Environment variables set."

# ── Deploy ──────────────────────────────────────────────────────────────────
log "Deploying to Railway..."
railway up --service server

log "Waiting for deployment..."
sleep 15

# ── Get the URL ─────────────────────────────────────────────────────────────
RAILWAY_URL=$(railway variables get RAILWAY_PUBLIC_URL 2>/dev/null || echo "")
if [[ -n "$RAILWAY_URL" ]]; then
    log "Deployed successfully!"
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  MAGNEETAR — RAILWAY DEPLOYMENT"
    echo "═══════════════════════════════════════════════════"
    echo ""
    echo "  Server:    $RAILWAY_URL"
    echo "  Health:    $RAILWAY_URL/health"
    echo "  Dashboard: $RAILWAY_URL (deploy separately)"
    echo ""
    echo "  Secrets saved. Update your Android app's"
    echo "  SERVER_URL BuildConfig to: $RAILWAY_URL"
    echo ""
    echo "═══════════════════════════════════════════════════"
else
    warn "Could not retrieve URL. Check Railway dashboard."
fi

log "Done! 🚀"
