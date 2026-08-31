#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Kotlin Dead Code Detection — Pre-commit hook
#
# Checks for common dead code patterns in Kotlin files:
# 1. Empty catch blocks (with named exception variable — underscore is OK)
# 2. TODO/FIXME/HACK markers
# 3. Commented-out code blocks (3+ consecutive lines)
# 4. Unused private functions (informational)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
export RED
YELLOW='\033[0;33m'
export YELLOW
GREEN='\033[0;32m'
export GREEN
NC='\033[0m' # No Color
export NC

ISSUES=0

check_file() {
    local file="$1"
    local filename
    filename=$(basename "$file")

    # Skip test files — they can have unused imports and commented code
    if [[ "$file" == *Test.kt ]] || [[ "$file" == *test* ]]; then
        return
    fi

    # 1. Check for empty catch blocks
    # Kotlin convention: `catch (_: Exception) {}` with underscore means
    # "I intentionally ignore this" — skip those. Only flag named catches
    # that swallow exceptions silently.
    local empty_catches
    empty_catches=$(grep -n 'catch.*{[[:space:]]*}' "$file" 2>/dev/null | grep -v 'catch (_:' || true)
    if [[ -n "$empty_catches" ]]; then
        echo -e "${YELLOW}⚠️  Empty catch block in $filename (consider using _ to signal intent):${NC}"
        echo "$empty_catches" | head -5
        echo ""
        ISSUES=$((ISSUES + 1))
    fi

    # 2. Check for TODO/FIXME/HACK markers (informational, not blocking)
    local todos
    todos=$(grep -n -i "TODO\|FIXME\|HACK\|XXX" "$file" 2>/dev/null | grep -v "//.*generated\|//.*noinspection" || true)
    if [[ -n "$todos" ]]; then
        local count
        count=$(echo "$todos" | wc -l)
        echo -e "${YELLOW}📝 $count TODO/FIXME markers in $filename:${NC}"
        echo "$todos" | head -3
        if [[ $count -gt 3 ]]; then
            echo "  ... and $((count - 3)) more"
        fi
        echo ""
    fi

    # 3. Check for large blocks of commented-out code (3+ consecutive lines)
    local commented_blocks
    commented_blocks=$(awk '
        /^[[:space:]]*\/\// { consecutive++; next }
        { consecutive = 0 }
        consecutive == 3 { printf "%s:%d: 3+ consecutive commented lines\n", FILENAME, NR-2; consecutive = 0 }
    ' "$file" 2>/dev/null || true)
    if [[ -n "$commented_blocks" ]]; then
        echo -e "${YELLOW}🗑️  Commented-out code block in $filename:${NC}"
        echo "$commented_blocks" | head -3
        echo ""
    fi

    # 4. Check for `private fun` that might be unused (heuristic: not called in same file)
    local private_funs
    private_funs=$(grep -n "private fun " "$file" 2>/dev/null | head -5 || true)
    if [[ -n "$private_funs" ]]; then
        local fun_count
        fun_count=$(grep -c "private fun " "$file" 2>/dev/null || echo 0)
        if [[ $fun_count -gt 2 ]]; then
            echo -e "${GREEN}ℹ️  $fun_count private functions in $filename (review for dead code)${NC}"
        fi
    fi
}

# Process all Kotlin files passed as arguments
if [[ $# -eq 0 ]]; then
    echo "No Kotlin files to check."
    exit 0
fi

echo -e "${GREEN}🔍 Checking Kotlin files for dead code patterns...${NC}"
echo ""

for file in "$@"; do
    if [[ -f "$file" ]] && [[ "$file" == *.kt ]]; then
        check_file "$file"
    fi
done

if [[ $ISSUES -gt 0 ]]; then
    echo -e "${YELLOW}💡 Found $ISSUES potential issues. Review above before committing.${NC}"
    echo -e "${YELLOW}   (These are warnings, not errors — commit will proceed)${NC}"
fi

exit 0
