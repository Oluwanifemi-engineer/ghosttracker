"""
Magneetar In-Memory Cache
Provides caching for frequently accessed, rarely changing data.

Why this matters:
- Device info, user info, and device owner mappings are queried on EVERY request
- Without caching, every location ping requires 2-3 database queries
- With thousands of devices, this becomes a bottleneck
- Cache reduces database load by 80-90% for hot paths

Strategy:
- Short TTL (30-60 seconds) for data that changes occasionally
- Longer TTL (5-10 minutes) for data that rarely changes
- LRU eviction when cache is full
- Automatic invalidation on writes
"""

import logging
import threading
import time
from collections import OrderedDict
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Cache configuration
DEFAULT_TTL = 30  # seconds
MAX_CACHE_SIZE = 10000  # maximum entries per cache


class TTLCache:
    """Thread-safe LRU cache with TTL expiration."""

    def __init__(self, max_size: int = MAX_CACHE_SIZE, default_ttl: int = DEFAULT_TTL):
        self._cache: OrderedDict = OrderedDict()
        self._timestamps: dict = {}
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0
        self._evictions = 0

    def get(self, key: str) -> Optional[Any]:
        """Get a value from the cache. Returns None if not found or expired."""
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None

            # Check TTL
            timestamp = self._timestamps.get(key, 0)
            if time.time() - timestamp > self._default_ttl:
                # Expired
                del self._cache[key]
                del self._timestamps[key]
                self._misses += 1
                return None

            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._hits += 1
            return self._cache[key]

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set a value in the cache."""
        with self._lock:
            # Remove if exists (to update position)
            if key in self._cache:
                del self._cache[key]
                del self._timestamps[key]

            # Evict if at capacity
            while len(self._cache) >= self._max_size:
                oldest_key, _ = self._cache.popitem(last=False)
                self._timestamps.pop(oldest_key, None)
                self._evictions += 1

            # Add new entry
            self._cache[key] = value
            self._timestamps[key] = time.time()

    def invalidate(self, key: str):
        """Remove a key from the cache."""
        with self._lock:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        """Remove all keys starting with a prefix."""
        with self._lock:
            keys_to_remove = [k for k in self._cache.keys() if k.startswith(prefix)]
            for key in keys_to_remove:
                del self._cache[key]
                self._timestamps.pop(key, None)

    def clear(self):
        """Clear all cached data."""
        with self._lock:
            self._cache.clear()
            self._timestamps.clear()

    def get_stats(self) -> dict:
        """Get cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": f"{(self._hits / total * 100):.1f}%" if total > 0 else "N/A",
                "evictions": self._evictions,
            }


# Global cache instances
_device_cache = TTLCache(max_size=5000, default_ttl=30)  # 30 second TTL for device info
_user_cache = TTLCache(max_size=2000, default_ttl=60)  # 60 second TTL for user info
_owner_cache = TTLCache(max_size=5000, default_ttl=30)  # 30 second TTL for device->owner mapping
_config_cache = TTLCache(max_size=100, default_ttl=300)  # 5 minute TTL for config values


def cache_device_info(device_id: str, info: dict):
    """Cache device information."""
    _device_cache.set(f"device:{device_id}", info)


def get_cached_device_info(device_id: str) -> Optional[dict]:
    """Get cached device information."""
    return _device_cache.get(f"device:{device_id}")


def invalidate_device_cache(device_id: str):
    """Invalidate cached device info."""
    _device_cache.invalidate(f"device:{device_id}")


def cache_user_info(user_id: str, info: dict):
    """Cache user information."""
    _user_cache.set(f"user:{user_id}", info)


def get_cached_user_info(user_id: str) -> Optional[dict]:
    """Get cached user information."""
    return _user_cache.get(f"user:{user_id}")


def invalidate_user_cache(user_id: str):
    """Invalidate cached user info."""
    _user_cache.invalidate(f"user:{user_id}")


def cache_device_owner(device_id: str, owner_id: Optional[str]):
    """Cache device->owner mapping."""
    _owner_cache.set(f"owner:{device_id}", owner_id)


def get_cached_device_owner(device_id: str) -> Optional[str]:
    """Get cached device owner."""
    return _owner_cache.get(f"owner:{device_id}")


def invalidate_device_owner(device_id: str):
    """Invalidate device owner cache."""
    _owner_cache.invalidate(f"owner:{device_id}")


def cache_config(key: str, value: Any):
    """Cache a configuration value."""
    _config_cache.set(f"config:{key}", value)


def get_cached_config(key: str) -> Optional[Any]:
    """Get a cached configuration value."""
    return _config_cache.get(f"config:{key}")


def invalidate_all_caches():
    """Clear all caches."""
    _device_cache.clear()
    _user_cache.clear()
    _owner_cache.clear()
    _config_cache.clear()
    logger.info("All caches cleared")


def get_all_cache_stats() -> dict:
    """Get statistics for all caches."""
    return {
        "device_cache": _device_cache.get_stats(),
        "user_cache": _user_cache.get_stats(),
        "owner_cache": _owner_cache.get_stats(),
        "config_cache": _config_cache.get_stats(),
    }


def cached_query(cache_key: str, ttl: int = DEFAULT_TTL):
    """Decorator to cache query results."""

    def decorator(func: Callable):
        def wrapper(*args, **kwargs):
            # Build cache key from function name and args
            key = f"{cache_key}:{hash(str(args) + str(kwargs))}"

            # Try cache first
            result = _device_cache.get(key)  # Use device_cache for now
            if result is not None:
                return result

            # Execute query
            result = func(*args, **kwargs)

            # Cache result
            if result is not None:
                _device_cache.set(key, result, ttl)

            return result

        return wrapper

    return decorator
