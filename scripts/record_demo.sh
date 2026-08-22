#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Magneetar Demo Recording Setup
# ═══════════════════════════════════════════════════════════════════════════════
#
# Automates the dashboard state for recording a 30-second product demo.
# Run this script, then start your screen recorder (OBS, QuickTime, etc.).
#
# Usage:
#   ./scripts/record_demo.sh [--device DEVICE_ID]
#
# Prerequisites:
#   - Server running on http://localhost:8002
#   - Dashboard running on http://localhost:3000
#   - Chrome/Chromium installed
#   - At least one device registered and online
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SERVER_URL="${MT_SERVER_URL:-http://localhost:8002}"
DASHBOARD_URL="${MT_DASHBOARD_URL:-http://localhost:3000}"
# DEVICE_ID can be passed as $1 for future device-specific setup
# DEVICE_ID="${1:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Magneetar Demo Recording Setup${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""

# ─── Step 1: Check prerequisites ──────────────────────────────────────────
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

# Check server
if curl -s "${SERVER_URL}/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Server is running at ${SERVER_URL}"
else
    echo -e "  ${RED}✗${NC} Server not reachable at ${SERVER_URL}"
    echo -e "    Start with: cd server && python main.py"
    exit 1
fi

# Check dashboard
if curl -s "${DASHBOARD_URL}" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Dashboard is running at ${DASHBOARD_URL}"
else
    echo -e "  ${RED}✗${NC} Dashboard not reachable at ${DASHBOARD_URL}"
    echo -e "    Start with: cd dashboard && npm run dev"
    exit 1
fi

# Check Chrome
if command -v google-chrome &> /dev/null || command -v chromium-browser &> /dev/null || command -v chromium &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Chrome/Chromium found"
else
    echo -e "  ${YELLOW}!${NC} Chrome not found — you'll need to open the dashboard manually"
fi

# ─── Step 2: Check devices ────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/5] Checking registered devices...${NC}"

HEALTH=$(curl -s "${SERVER_URL}/health" 2>/dev/null)
echo -e "  Server health: ${GREEN}$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo 'ok')${NC}"

# ─── Step 3: Create demo recording bookmarklet ────────────────────────────
echo ""
echo -e "${YELLOW}[3/5] Generating demo state script...${NC}"

cat > /tmp/magneetar_demo_state.js << 'BOOKMARKLET'
// ═══════════════════════════════════════════════════════════════════════════════
// Magneetar Demo State Script
// Run this in the browser console after logging into the dashboard.
// It sets up the optimal state for screen recording.
// ═══════════════════════════════════════════════════════════════════════════════

(function() {
  console.log('🎯 Setting up demo recording state...');

  // 1. Expand sidebar
  const sidebar = document.querySelector('aside');
  if (sidebar && sidebar.classList.contains('w-12')) {
    const toggleBtn = sidebar.querySelector('button');
    if (toggleBtn) toggleBtn.click();
    console.log('  ✓ Sidebar expanded');
  }

  // 2. Select first device (if any)
  setTimeout(() => {
    const deviceButtons = document.querySelectorAll('aside button[class*="text-left"]');
    if (deviceButtons.length > 0) {
      deviceButtons[0].click();
      console.log('  ✓ First device selected');
    } else {
      console.log('  ⚠ No devices found — register a device first');
    }
  }, 500);

  // 3. Set optimal viewport for recording
  // (Use Chrome DevTools device toolbar for mobile recording)

  // 4. Hide any error toasts after 3 seconds
  setTimeout(() => {
    const toasts = document.querySelectorAll('[class*="toast"], [class*="Toast"]');
    toasts.forEach(t => t.style.display = 'none');
    console.log('  ✓ Toasts hidden');
  }, 3000);

  console.log('');
  console.log('🎬 Ready to record! Start your screen recorder now.');
  console.log('   Recommended: 1920x1080, 30fps, 30 seconds');
  console.log('');
  console.log('📋 Recording script:');
  console.log('   0:00-0:05  Dashboard overview (sidebar + map)');
  console.log('   0:05-0:12  Click device → map zoom + GPS trail');
  console.log('   0:12-0:18  Sentinel tab → theft score animation');
  console.log('   0:18-0:25  Commands tab → Lock Screen → Execute');
  console.log('   0:25-0:30  Capture Photo → Evidence gallery');
})();
BOOKMARKLET

echo -e "  ${GREEN}✓${NC} Demo state script saved to /tmp/magneetar_demo_state.js"
echo -e "    Paste this into the browser console after logging in"

# ─── Step 4: Open dashboard ───────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/5] Opening dashboard...${NC}"

if command -v google-chrome &> /dev/null; then
    google-chrome "${DASHBOARD_URL}" --new-window 2>/dev/null &
    echo -e "  ${GREEN}✓${NC} Chrome opened with dashboard"
elif command -v chromium-browser &> /dev/null; then
    chromium-browser "${DASHBOARD_URL}" --new-window 2>/dev/null &
    echo -e "  ${GREEN}✓${NC} Chromium opened with dashboard"
elif command -v xdg-open &> /dev/null; then
    xdg-open "${DASHBOARD_URL}" 2>/dev/null &
    echo -e "  ${GREEN}✓${NC} Browser opened with dashboard"
else
    echo -e "  ${YELLOW}!${NC} Open ${DASHBOARD_URL} manually in your browser"
fi

# ─── Step 5: Instructions ─────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/5] Recording instructions${NC}"
echo ""
echo -e "${CYAN}  ┌─────────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}  │  DEMO RECORDING CHECKLIST                          │${NC}"
echo -e "${CYAN}  ├─────────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}  │                                                     │${NC}"
echo -e "${CYAN}  │  1. Log into the dashboard in the opened browser    │${NC}"
echo -e "${CYAN}  │  2. Open browser console (F12 → Console)            │${NC}"
echo -e "${CYAN}  │  3. Paste the script from /tmp/magneetar_demo_state.js │${NC}"
echo -e "${CYAN}  │  4. Start your screen recorder (OBS, QuickTime)     │${NC}"
echo -e "${CYAN}  │  5. Follow the 30-second script below:              │${NC}"
echo -e "${CYAN}  │                                                     │${NC}"
echo -e "${CYAN}  │  0:00-0:05  Dashboard overview                      │${NC}"
echo -e "${CYAN}  │  0:05-0:12  Click device → map zoom                 │${NC}"
echo -e "${CYAN}  │  0:12-0:18  Sentinel tab → theft score              │${NC}"
echo -e "${CYAN}  │  0:18-0:25  Commands → Lock Screen                  │${NC}"
echo -e "${CYAN}  │  0:25-0:30  Capture Photo → Evidence                │${NC}"
echo -e "${CYAN}  │                                                     │${NC}"
echo -e "${CYAN}  │  6. Stop recording at 30 seconds                    │${NC}"
echo -e "${CYAN}  │  7. Export as 1080p MP4, < 10MB                     │${NC}"
echo -e "${CYAN}  │  8. Upload to YouTube (unlisted)                    │${NC}"
echo -e "${CYAN}  │  9. Set DEMO_VIDEO_URL in VideoDemo.tsx             │${NC}"
echo -e "${CYAN}  │                                                     │${NC}"
echo -e "${CYAN}  └─────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "${GREEN}Setup complete! Happy recording 🎬${NC}"
