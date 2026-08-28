#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# MAGNEETAR — Oracle Cloud Always Free Tier Deployment
# Deploys server + dashboard + Redis to Oracle Cloud's free ARM instance.
#
# Prerequisites:
#   1. Oracle Cloud account (free tier)
#   2. An ARM instance created (VM.Standard.A1.Flex, 2 cores, 12GB RAM)
#   3. SSH access to the instance
#
# Usage:
#   1. Copy this script to your local machine
#   2. Edit the variables below
#   3. Run: bash deploy-oracle-free.sh
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration (edit these) ──────────────────────────────────────────────
ORACLE_HOST=""          # e.g. "129.153.xx.xx" (your instance's public IP)
ORACLE_USER="ubuntu"    # or "opc" depending on your image
SSH_KEY="$HOME/.ssh/id_rsa"  # path to your SSH private key
# DOMAIN=""             # e.g. "magneetar.me" (optional, can use IP directly)

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[MAGNEETAR]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Validate ────────────────────────────────────────────────────────────────
[[ -z "$ORACLE_HOST" ]] && err "Set ORACLE_HOST to your Oracle Cloud instance IP"
[[ -z "$ORACLE_USER" ]] && err "Set ORACLE_USER (ubuntu or opc)"
[[ ! -f "$SSH_KEY" ]] && err "SSH key not found at $SSH_KEY"

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $ORACLE_USER@$ORACLE_HOST"
SCP_CMD="scp -i $SSH_KEY -o StrictHostKeyChecking=no"

log "Deploying Magneetar to Oracle Cloud: $ORACLE_HOST"

# ── Step 1: Install Docker on the instance ──────────────────────────────────
log "Step 1: Installing Docker..."
$SSH_CMD << 'REMOTE'
if ! command -v docker &>/dev/null; then
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose-v2
    sudo usermod -aG docker $USER
    sudo systemctl enable docker
    sudo systemctl start docker
    echo "Docker installed successfully"
else
    echo "Docker already installed"
fi
REMOTE

# ── Step 2: Create deployment directory ─────────────────────────────────────
log "Step 2: Creating deployment directory..."
$SSH_CMD << 'REMOTE'
mkdir -p ~/magneetar/data
mkdir -p ~/magneetar/media
mkdir -p ~/magneetar/static/apk
mkdir -p ~/magneetar/deploy/cloudflared
REMOTE

# ── Step 3: Copy files to instance ──────────────────────────────────────────
log "Step 3: Copying files..."
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

$SCP_CMD -r "$PROJECT_DIR/server" "$ORACLE_USER@$ORACLE_HOST:~/magneetar/"
$SCP_CMD -r "$PROJECT_DIR/dashboard" "$ORACLE_USER@$ORACLE_HOST:~/magneetar/"
$SCP_CMD -r "$PROJECT_DIR/docker-compose.yml" "$ORACLE_USER@$ORACLE_HOST:~/magneetar/"
$SCP_CMD -r "$PROJECT_DIR/VERSION" "$ORACLE_USER@$ORACLE_HOST:~/magneetar/" 2>/dev/null || true

# ── Step 4: Create .env on the instance ─────────────────────────────────────
log "Step 4: Creating .env file..."
$SSH_CMD << 'REMOTE'
if [ ! -f ~/magneetar/server/.env ]; then
    cat > ~/magneetar/server/.env << 'ENVFILE'
# Magneetar Server Configuration
MT_ENVIRONMENT=production
MT_HOST=0.0.0.0
MT_PORT=8000
MT_DB_PATH=/app/data/magneetar.db
MT_MEDIA_DIR=/app/media
MT_REDIS_URL=redis://redis:6379/0
MT_MAX_WS_CONNECTIONS=250
MT_WRITE_BATCH_MS=250
MT_DATA_RETENTION_DAYS=90
MT_MAX_DEVICES_PER_USER=5

# Security (CHANGE THESE)
MT_JWT_SECRET=CHANGE_ME_TO_A_RANDOM_64_CHAR_STRING
MT_API_KEY=CHANGE_ME_TO_A_RANDOM_32_CHAR_STRING
MT_DEVICE_KEY=CHANGE_ME_TO_A_RANDOM_32_CHAR_STRING

# Optional: Firebase FCM (get from Firebase Console)
# MT_FIREBASE_KEY=./firebase-key.json

# Optional: Twilio SMS (get from twilio.com)
# MT_TWILIO_ACCOUNT_SID=
# MT_TWILIO_AUTH_TOKEN=
# MT_TWILIO_SMS_FROM=

# Optional: Africa's Talking USSD
# MT_AT_API_KEY=
# MT_AT_USERNAME=

# Feature flags
MT_FEATURE_MAINTENANCE_MODE=false
ENVFILE
    echo "⚠️  IMPORTANT: Edit ~/magneetar/server/.env with your actual secrets!"
    echo "   Run: nano ~/magneetar/server/.env"
else
    echo ".env already exists — skipping"
fi
REMOTE

# ── Step 5: Start services ──────────────────────────────────────────────────
log "Step 5: Starting Magneetar..."
$SSH_CMD << 'REMOTE'
cd ~/magneetar
docker compose up -d --build
echo ""
echo "Waiting for server to start..."
sleep 10
curl -sf http://localhost:8002/health && echo "✅ Server is healthy!" || echo "⚠️  Server may still be starting..."
REMOTE

# ── Step 6: Print status ────────────────────────────────────────────────────
log "Step 6: Deployment status..."
$SSH_CMD << 'REMOTE'
echo ""
echo "═══════════════════════════════════════════════════"
echo "  MAGNEETAR DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Server:   http://$(curl -s ifconfig.me):8002/health"
echo "  Dashboard: http://$(curl -s ifconfig.me):3000"
echo ""
echo "  Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep magneetar
echo ""
echo "  To configure Firebase FCM:"
echo "    1. Copy firebase-key.json to ~/magneetar/server/"
echo "    2. Uncomment MT_FIREBASE_KEY in server/.env"
echo "    3. Run: cd ~/magneetar && docker compose restart server"
echo ""
echo "  To configure Twilio SMS:"
echo "    1. Edit server/.env with Twilio credentials"
echo "    2. Run: cd ~/magneetar && docker compose restart server"
echo ""
echo "  To view logs:"
echo "    docker logs -f magneetar-server"
echo "═══════════════════════════════════════════════════"
REMOTE

log "Deployment complete! 🚀"
