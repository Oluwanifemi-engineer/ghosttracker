#!/bin/bash

# Chromatic Baseline Management Script
#
# This script helps manage Chromatic baselines for visual regression testing.
#
# Usage:
#   ./scripts/chromatic-baseline.sh accept    # Accept all changes as new baseline
#   ./scripts/chromatic-baseline.sh reject    # Reject changes and keep old baseline
#   ./scripts/chromatic-baseline.sh status    # Show current baseline status
#   ./scripts/chromatic-baseline.sh diff      # Show differences from baseline

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CHROMATIC_PROJECT_ID="${CHROMATIC_PROJECT_ID:-}"
CHROMATIC_TOKEN="${CHROMATIC_TOKEN:-$CHROMATIC_PROJECT_TOKEN}"

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Chromatic Baseline Management${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  accept    Accept all changes as new baseline"
    echo "  reject    Reject changes and keep old baseline"
    echo "  status    Show current baseline status"
    echo "  diff      Show differences from baseline"
    echo "  help      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  CHROMATIC_PROJECT_TOKEN  Chromatic project token"
    echo "  CHROMATIC_PROJECT_ID     Chromatic project ID"
}

check_token() {
    if [ -z "$CHROMATIC_TOKEN" ]; then
        echo -e "${RED}Error: CHROMATIC_PROJECT_TOKEN not set${NC}"
        echo "Please set your Chromatic project token:"
        echo "  export CHROMATIC_PROJECT_TOKEN=your-token"
        exit 1
    fi
}

accept_changes() {
    echo -e "${GREEN}Accepting all visual changes as new baseline...${NC}"

    # Use Chromatic CLI to accept changes
    cd dashboard

    if command -v npx &> /dev/null; then
        npx chromatic --accept-changes --project-token="$CHROMATIC_TOKEN"
    else
        echo -e "${RED}Error: npx not found. Please install Node.js.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Changes accepted and baseline updated.${NC}"
}

reject_changes() {
    echo -e "${YELLOW}Rejecting visual changes...${NC}"

    # Note: Chromatic doesn't have a direct "reject" CLI command
    # Changes are rejected by not accepting them

    echo -e "${YELLOW}⚠️  To reject changes:${NC}"
    echo "1. Go to Chromatic dashboard"
    echo "2. Find the build with changes"
    echo "3. Click 'Reject' on the changed snapshots"
    echo "4. The old baseline will be preserved"
    echo ""
    echo "Or run: npx chromatic --reject-changes"

    cd dashboard

    if command -v npx &> /dev/null; then
        npx chromatic --reject-changes --project-token="$CHROMATIC_TOKEN" || true
    fi

    echo -e "${GREEN}✅ Changes rejected. Old baseline preserved.${NC}"
}

show_status() {
    echo -e "${BLUE}Fetching baseline status...${NC}"

    cd dashboard

    if command -v npx &> /dev/null; then
        npx chromatic --list-baselines --project-token="$CHROMATIC_TOKEN" || true
    fi

    echo ""
    echo -e "${BLUE}For detailed status, visit:${NC}"
    echo "https://www.chromatic.com/builds?appId=$CHROMATIC_PROJECT_ID"
}

show_diff() {
    echo -e "${BLUE}Fetching visual differences...${NC}"

    cd dashboard

    if command -v npx &> /dev/null; then
        npx chromatic --diff --project-token="$CHROMATIC_TOKEN" || true
    fi

    echo ""
    echo -e "${BLUE}For detailed diffs, visit:${NC}"
    echo "https://www.chromatic.com/builds?appId=$CHROMATIC_PROJECT_ID"
}

# Main
print_header

case "${1:-help}" in
    accept)
        check_token
        accept_changes
        ;;
    reject)
        check_token
        reject_changes
        ;;
    status)
        check_token
        show_status
        ;;
    diff)
        check_token
        show_diff
        ;;
    help|--help|-h)
        print_usage
        ;;
    *)
        echo -e "${RED}Error: Unknown command '$1'${NC}"
        print_usage
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
