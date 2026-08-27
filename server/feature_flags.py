"""
Magneetar Feature Flag System
Toggle features without redeploying. Flags are stored in a JSON file
and served via /api/config. Environment variables can override any flag.

Usage:
    from feature_flags import flags

    if flags.is_enabled("beta_p2p_pairing"):
        # new feature code
        pass

    if flags.is_enabled("maintenance_mode"):
        return {"maintenance": True}
"""

import json
import os
import threading
import time
from typing import Optional


class FeatureFlags:
    """Thread-safe feature flag manager with file-based storage and env overrides.

    Flag resolution order (highest priority first):
    1. Environment variable MT_FEATURE_<NAME>=true/false
    2. Feature flags JSON file (server/feature_flags.json)
    3. Default value passed to is_enabled()
    """

    def __init__(self, flags_file: Optional[str] = None):
        # In Docker, the file is mounted at /app/feature_flags.json
        # In dev, it's at server/feature_flags.json relative to project root
        if flags_file:
            self._flags_file = flags_file
        elif os.path.exists("/app/feature_flags.json"):
            self._flags_file = "/app/feature_flags.json"
        else:
            self._flags_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "server", "feature_flags.json")
        self._cache: dict[str, bool] = {}
        self._cache_mtime: float = 0
        self._lock = threading.Lock()

        # Ensure the file exists
        if not os.path.exists(self._flags_file):
            self._write_default_flags()

    def _write_default_flags(self):
        """Create the default feature flags file."""
        defaults = {
            "_comment": "Magneetar feature flags. Set to true/false. Env vars MT_FEATURE_<NAME> override these.",
            "maintenance_mode": False,
            "beta_p2p_pairing": True,
            "beta_guardian_network": True,
            "new_geofence_ui": True,
            "developer_api_keys": True,
            "family_circles": True,
            "community_watch": True,
            "recovery_bounties": False,
            "digital_inheritance": False,
            "smart_geofence": False,
            "ussd_payments": False,
            "nps_surveys": False,
            "email_tracking": False,
        }
        try:
            os.makedirs(os.path.dirname(self._flags_file), exist_ok=True)
            with open(self._flags_file, "w") as f:
                json.dump(defaults, f, indent=2)
        except Exception:
            pass  # Non-fatal — will use in-memory defaults

    def _load_flags(self) -> dict[str, bool]:
        """Load flags from file, with caching and env overrides."""
        now = time.time()

        # Check if file changed (reload every 5 seconds max)
        with self._lock:
            if self._cache and (now - self._cache_mtime) < 5:
                return self._cache.copy()

        # Read from file
        file_flags: dict[str, bool] = {}
        try:
            with open(self._flags_file) as f:
                raw = json.load(f)
            for key, value in raw.items():
                if key.startswith("_"):
                    continue
                if isinstance(value, bool):
                    file_flags[key] = value
                elif isinstance(value, str):
                    file_flags[key] = value.lower() in ("true", "1", "yes", "on")
        except (FileNotFoundError, json.JSONDecodeError):
            pass

        # Apply env var overrides (MT_FEATURE_<NAME>=true/false)
        env_flags = {}
        for key in list(file_flags.keys()):
            env_key = f"MT_FEATURE_{key.upper()}"
            env_val = os.environ.get(env_key)
            if env_val is not None:
                env_flags[key] = env_val.lower() in ("true", "1", "yes", "on")

        # Merge: file defaults + env overrides
        merged = {**file_flags, **env_flags}

        # Cache
        with self._lock:
            self._cache = merged
            self._cache_mtime = now

        return merged

    def is_enabled(self, flag_name: str, default: bool = False) -> bool:
        """Check if a feature flag is enabled.

        Args:
            flag_name: The flag name (e.g. 'maintenance_mode')
            default: Value to return if flag is not defined

        Returns:
            True if enabled, False otherwise
        """
        flags = self._load_flags()
        return flags.get(flag_name, default)

    def set_flag(self, flag_name: str, enabled: bool):
        """Update a flag in the JSON file (runtime + persistent).

        This is for admin use — the file is re-read by all workers
        within 5 seconds.
        """
        with self._lock:
            self._cache[flag_name] = enabled
            self._cache_mtime = time.time()

        # Persist to file
        try:
            if os.path.exists(self._flags_file):
                with open(self._flags_file) as f:
                    data = json.load(f)
            else:
                data = {}
            data[flag_name] = enabled
            with open(self._flags_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass

    def get_all(self) -> dict[str, bool]:
        """Return all flags as a dict (for /api/config endpoint)."""
        return self._load_flags()

    def reload(self):
        """Force a reload from disk (called after external file changes)."""
        with self._lock:
            self._cache = {}
            self._cache_mtime = 0


# Singleton
flags = FeatureFlags()
