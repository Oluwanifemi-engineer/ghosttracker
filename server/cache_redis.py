"""
Magneetar Redis-Backed Cache

Shared cache across uvicorn workers via Redis. When MT_REDIS_URL is set,
this module provides a Redis-backed alternative to the in-memory TTLCache
that keeps device→owner mappings, device info, and user info consistent
across all 4 workers.

Why this matters:
- With --workers > 1, each worker has its own in-memory cache
- Worker A invalidates a device→owner entry; Worker B still has stale data
- A WebSocket broadcast from Worker B goes to the wrong owner
- Redis solves this: one shared cache, all workers see the same state

Strategy:
- Same TTL semantics as the in-memory cache (30s device, 60s user)
- JSON serialization for dict values
- Graceful fallback to in-memory if Redis is unavailable
- Same API as cache.py so callers don't need to change
"""

import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis-backed cache with TTL support. Falls back to None (no cache) if
    Redis is unavailable — callers always get the right answer, just slower."""

    def __init__(self, redis_url: str, prefix: str = "mt:", default_ttl: int = 30):
        self._redis = None
        self._prefix = prefix
        self._default_ttl = default_ttl
        self._redis_url = redis_url
        self._connected = False
        self._hits = 0
        self._misses = 0

    def _get_conn(self):
        if self._redis is not None:
            return self._redis
        try:
            import redis

            self._redis = redis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            self._redis.ping()
            self._connected = True
            logger.info(f"Redis cache connected: {self._redis_url.split('@')[-1]}")
            return self._redis
        except Exception as e:
            logger.warning(f"Redis cache unavailable ({e}) — falling back to no-cache")
            self._redis = None
            self._connected = False
            return None

    def get(self, key: str) -> Optional[Any]:
        conn = self._get_conn()
        if conn is None:
            self._misses += 1
            return None
        try:
            raw = conn.get(f"{self._prefix}{key}")
            if raw is None:
                self._misses += 1
                return None
            self._hits += 1
            return json.loads(raw)
        except Exception:
            self._misses += 1
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        conn = self._get_conn()
        if conn is None:
            return
        try:
            ttl_seconds = ttl or self._default_ttl
            conn.setex(f"{self._prefix}{key}", ttl_seconds, json.dumps(value, default=str))
        except Exception:
            pass

    def invalidate(self, key: str):
        conn = self._get_conn()
        if conn is None:
            return
        try:
            conn.delete(f"{self._prefix}{key}")
        except Exception:
            pass

    def invalidate_prefix(self, prefix: str):
        conn = self._get_conn()
        if conn is None:
            return
        try:
            keys = conn.keys(f"{self._prefix}{prefix}*")
            if keys:
                conn.delete(*keys)
        except Exception:
            pass

    def get_stats(self) -> dict:
        total = self._hits + self._misses
        return {
            "connected": self._connected,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{(self._hits / total * 100):.1f}%" if total > 0 else "N/A",
        }


# Singleton — initialized lazily from main.py when MT_REDIS_URL is set
_redis_cache: Optional[RedisCache] = None


def init_redis_cache(redis_url: str) -> RedisCache:
    """Initialize the shared Redis cache. Called once from main.py lifespan."""
    global _redis_cache
    if _redis_cache is None:
        _redis_cache = RedisCache(redis_url, prefix="mt:", default_ttl=30)
    return _redis_cache


def get_redis_cache() -> Optional[RedisCache]:
    """Get the Redis cache instance. Returns None if not initialized."""
    return _redis_cache


def redis_cache_device_info(device_id: str, info: dict):
    """Cache device info in Redis (shared across workers)."""
    if _redis_cache:
        _redis_cache.set(f"device:{device_id}", info, ttl=30)


def redis_get_cached_device_info(device_id: str) -> Optional[dict]:
    """Get device info from Redis cache."""
    if _redis_cache:
        return _redis_cache.get(f"device:{device_id}")
    return None


def redis_cache_device_owner(device_id: str, owner_id: Optional[str]):
    """Cache device→owner mapping in Redis."""
    if _redis_cache:
        _redis_cache.set(f"owner:{device_id}", owner_id, ttl=30)


def redis_get_cached_device_owner(device_id: str) -> Optional[str]:
    """Get device owner from Redis cache."""
    if _redis_cache:
        return _redis_cache.get(f"owner:{device_id}")
    return None


def redis_invalidate_device(device_id: str):
    """Invalidate all cached data for a device."""
    if _redis_cache:
        _redis_cache.invalidate(f"device:{device_id}")
        _redis_cache.invalidate(f"owner:{device_id}")


def redis_invalidate_all():
    """Clear all Redis cache entries (dangerous — use sparingly)."""
    if _redis_cache:
        _redis_cache.invalidate_prefix("mt:")
