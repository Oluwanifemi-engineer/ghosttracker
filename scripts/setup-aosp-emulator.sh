#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Magneetar — AOSP Emulator Setup for D6 Validation Slot
#
# Creates an AVD with an AOSP system image (NO Google Play services) to
# regression-lock the v1.4.2 provider fix. On AOSP images, the "network"
# location provider is absent — the app must not crash-loop when GPS is
# the only provider available.
#
# Prerequisites:
#   - Android Studio installed (with SDK command-line tools)
#   - ANDROID_HOME or ANDROID_SDK_ROOT set
#   - JAVA_HOME pointing to JDK 17+ (JDK 21 recommended)
#
# Usage:
#   bash scripts/setup-aosp-emulator.sh          # create AVD
#   bash scripts/setup-aosp-emulator.sh --run     # create + boot
#   bash scripts/setup-aosp-emulator.sh --teardown # delete AVD
#
# The AVD is named "magneetar-d6" and uses:
#   - AOSP system image (no Play services, no "network" location provider)
#   - Android 14 (API 34) — tests FGS rules + provider fallback
#   - 2 GB RAM, 2 GB internal storage, 200 MB SD card
#   - No hardware keyboard, no GPU (software rendering for CI)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

AVD_NAME="magneetar-d6"
DEVICE_PROFILE="pixel_6"
SYSTEM_IMAGE="system-images;android-34;default;x86_64"  # AOSP (no Play)
RAM_MB=2048
INTERNAL_STORAGE_MB=2048
SD_CARD_MB=200

# ── Resolve SDK tools ────────────────────────────────────────────────────────
if [[ -n "${ANDROID_HOME:-}" ]]; then
    SDK_ROOT="$ANDROID_HOME"
elif [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
    SDK_ROOT="$ANDROID_SDK_ROOT"
elif [[ -d "$HOME/Android/Sdk" ]]; then
    SDK_ROOT="$HOME/Android/Sdk"
elif [[ -d "$HOME/Library/Android/sdk" ]]; then
    SDK_ROOT="$HOME/Library/Android/sdk"
else
    echo "❌ ANDROID_HOME not set and no SDK found. Install Android Studio first." >&2
    exit 1
fi

CMDLINE_TOOLS="$SDK_ROOT/cmdline-tools/latest/bin"
if [[ ! -d "$CMDLINE_TOOLS" ]]; then
    # Try the older "tools" layout
    CMDLINE_TOOLS="$SDK_ROOT/tools/bin"
fi

if [[ ! -f "$CMDLINE_TOOLS/sdkmanager" ]]; then
    echo "❌ sdkmanager not found at $CMDLINE_TOOLS" >&2
    echo "   Install Android Studio → SDK Manager → SDK Tools → Android SDK Command-line Tools" >&2
    exit 1
fi

AVD_MANAGER="$CMDLINE_TOOLS/avdmanager"
EMULATOR="$SDK_ROOT/emulator/emulator"

# ── Functions ────────────────────────────────────────────────────────────────
install_system_image() {
    echo "📦 Installing AOSP system image: $SYSTEM_IMAGE"
    yes | "$CMDLINE_TOOLS/sdkmanager" "$SYSTEM_IMAGE" platform-tools emulator 2>&1 | tail -5
}

create_avd() {
    echo "🔧 Creating AVD: $AVD_NAME"

    # Delete existing AVD if present
    "$AVD_MANAGER" delete avd -n "$AVD_NAME" 2>/dev/null || true

    # Create the AVD with automated responses
    echo "no" | "$AVD_MANAGER" create avd \
        --name "$AVD_NAME" \
        --package "$SYSTEM_IMAGE" \
        --device "$DEVICE_PROFILE" \
        --force \
        --path "$SDK_ROOT/avd/${AVD_NAME}.avd" 2>&1

    # Override config.ini for resource limits
    AVD_CONFIG="$SDK_ROOT/avd/${AVD_NAME}.avd/config.ini"
    if [[ -f "$AVD_CONFIG" ]]; then
        cat >> "$AVD_CONFIG" <<EOF

# ── Magneetar D6 overrides ──────────────────────────────────────────────────
# AOSP image: no Google Play services, no "network" location provider.
# Regression-locks the v1.4.2 provider fallback fix.
hw.ramSize=${RAM_MB}
disk.dataPartition.size=${INTERNAL_STORAGE_MB}M
sdcard.size=${SD_CARD_MB}M
hw.keyboard=no
hw.gpu.enabled=no
hw.gpu.mode=software
hw.mainKeys=no
hw.back=yes
tag.display=AOSP
tag.id=default
EOF
        echo "✅ AVD config patched: $AVD_CONFIG"
    fi

    echo "✅ AVD '$AVD_NAME' created (AOSP, no Play services, no network provider)"
}

boot_avd() {
    echo "🚀 Booting AVD: $AVD_NAME"
    "$EMULATOR" -avd "$AVD_NAME" \
        -no-audio \
        -no-window \
        -gpu software \
        -no-snapshot \
        -wipe-data \
        -port 5556 \
        &
    echo "⏳ Waiting for emulator to boot (up to 120s)..."
    "$SDK_ROOT/platform-tools/adb" wait-for-device

    # Wait for boot_completed property
    for i in $(seq 1 120); do
        BOOT=$("$SDK_ROOT/platform-tools/adb" -s emulator-5556 shell getprop sys.boot_completed 2>/dev/null || echo "")
        if [[ "$BOOT" == "1" ]]; then
            echo "✅ Emulator booted in ${i}s"
            echo "   ADB serial: emulator-5556"
            echo "   Verify no network provider: adb -s emulator-5556 shell location providers"
            return 0
        fi
        sleep 1
    done

    echo "⚠️  Emulator boot timed out after 120s. Check logs." >&2
    return 1
}

teardown() {
    echo "🗑️  Deleting AVD: $AVD_NAME"
    "$AVD_MANAGER" delete avd -n "$AVD_NAME" 2>/dev/null || echo "AVD not found"
    echo "✅ AVD '$AVD_NAME' deleted"
}

verify_no_network_provider() {
    echo "🔍 Verifying AOSP has no 'network' location provider..."
    PROVIDERS=$("$SDK_ROOT/platform-tools/adb" -s emulator-5556 shell location providers 2>/dev/null || echo "")
    echo "   Available providers: $PROVIDERS"
    if echo "$PROVIDERS" | grep -q "network"; then
        echo "❌ WARNING: 'network' provider found — this is NOT a pure AOSP image!" >&2
        echo "   Use 'system-images;android-34;default;x86_64' (AOSP, not google_apis)" >&2
        return 1
    else
        echo "✅ No 'network' provider — AOSP regression test is valid"
        return 0
    fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
case "${1:-}" in
    --teardown|-t)
        teardown
        ;;
    --run|-r)
        install_system_image
        create_avd
        boot_avd
        verify_no_network_provider
        echo ""
        echo "══════════════════════════════════════════════════════════════"
        echo "  D6 AOSP Emulator ready"
        echo "  Install Magneetar: adb -s emulator-5556 install app-play-release.apk"
        echo "  Check providers:  adb -s emulator-5556 shell location providers"
        echo "  Stop emulator:    adb -s emulator-5556 emu kill"
        echo "══════════════════════════════════════════════════════════════"
        ;;
    --help|-h)
        echo "Usage: $0 [--run | --teardown | --help]"
        echo ""
        echo "  (no args)   Create the AOSP AVD (don't boot)"
        echo "  --run       Create + boot + verify no network provider"
        echo "  --teardown  Delete the AVD"
        ;;
    *)
        install_system_image
        create_avd
        echo ""
        echo "To boot: $0 --run"
        echo "To delete: $0 --teardown"
        ;;
esac
