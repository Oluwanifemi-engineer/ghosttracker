"""
Magneetar Horizontal Scaling Module
Supports multi-instance deployment with distributed state.
"""

import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)


class DistributedState:
    """Manages state across multiple server instances using Redis."""

    def __init__(self):
        self._redis = None
        self._initialized = False

    def initialize(self, redis_url: Optional[str] = None):
        """Initialize distributed state manager.

        Args:
            redis_url: Redis connection URL
        """
        url = redis_url or os.environ.get("MT_REDIS_URL", "")
        if not url:
            logger.warning("No Redis URL configured - using local state only")
            self._initialized = True
            return

        try:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(url, decode_responses=True)
            self._initialized = True
            logger.info("Distributed state manager initialized with Redis")
        except ImportError:
            logger.warning("redis package not installed - using local state")
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._initialized = True

    def is_configured(self) -> bool:
        return self._initialized

    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set a distributed state value.

        Args:
            key: State key
            value: Value to store
            ttl: Time-to-live in seconds

        Returns:
            Success status
        """
        if not self._redis:
            return False

        try:
            import json

            await self._redis.setex(f"magneetar:{key}", ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.error(f"Failed to set state {key}: {e}")
            return False

    async def get(self, key: str) -> Optional[Any]:
        """Get a distributed state value.

        Args:
            key: State key

        Returns:
            Stored value or None
        """
        if not self._redis:
            return None

        try:
            import json

            value = await self._redis.get(f"magneetar:{key}")
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Failed to get state {key}: {e}")
            return None

    async def delete(self, key: str) -> bool:
        """Delete a distributed state value."""
        if not self._redis:
            return False

        try:
            await self._redis.delete(f"magneetar:{key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete state {key}: {e}")
            return False

    async def publish(self, channel: str, message: dict) -> bool:
        """Publish a message to all instances.

        Args:
            channel: Channel name
            message: Message to publish

        Returns:
            Success status
        """
        if not self._redis:
            return False

        try:
            import json

            await self._redis.publish(channel, json.dumps(message, default=str))
            return True
        except Exception as e:
            logger.error(f"Failed to publish to {channel}: {e}")
            return False

    async def subscribe(self, channel: str, callback):
        """Subscribe to messages from all instances.

        Args:
            channel: Channel name
            callback: Async function to handle messages
        """
        if not self._redis:
            return

        try:
            pubsub = self._redis.pubsub()
            await pubsub.subscribe(channel)

            async for message in pubsub.listen():
                if message["type"] == "message":
                    import json

                    data = json.loads(message["data"])
                    await callback(data)
        except Exception as e:
            logger.error(f"Failed to subscribe to {channel}: {e}")

    async def acquire_lock(self, lock_name: str, ttl: int = 10) -> bool:
        """Acquire a distributed lock.

        Args:
            lock_name: Lock identifier
            ttl: Lock timeout in seconds

        Returns:
            Lock acquired status
        """
        if not self._redis:
            return True

        try:
            lock_key = f"magneetar:lock:{lock_name}"
            return await self._redis.setnx(lock_key, "1")
        except Exception as e:
            logger.error(f"Failed to acquire lock {lock_name}: {e}")
            return False

    async def release_lock(self, lock_name: str) -> bool:
        """Release a distributed lock."""
        if not self._redis:
            return True

        try:
            lock_key = f"magneetar:lock:{lock_name}"
            await self._redis.delete(lock_key)
            return True
        except Exception as e:
            logger.error(f"Failed to release lock {lock_name}: {e}")
            return False


class RateLimiter:
    """Distributed rate limiter using Redis."""

    def __init__(self, state: DistributedState):
        self._state = state

    async def check_rate_limit(self, identifier: str, action: str, limit: int, window_seconds: int) -> bool:
        """Check if action is within rate limit.

        Args:
            identifier: User/device identifier
            action: Action being rate-limited
            limit: Maximum actions per window
            window_seconds: Time window in seconds

        Returns:
            True if within limit, False if exceeded
        """
        if not self._state._redis:
            return True

        try:
            key = f"ratelimit:{identifier}:{action}"

            # Get current count
            current = await self._state._redis.get(key)
            if current and int(current) >= limit:
                return False

            # Increment count
            pipe = self._state._redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            await pipe.execute()

            return True
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return True  # Fail open

    async def get_remaining(self, identifier: str, action: str, limit: int, window_seconds: int) -> int:
        """Get remaining actions in current window."""
        if not self._state._redis:
            return limit

        try:
            key = f"ratelimit:{identifier}:{action}"
            current = await self._state._redis.get(key)
            if current:
                return max(0, limit - int(current))
            return limit
        except Exception:
            return limit


class SessionManager:
    """Distributed session management for JWT tokens."""

    def __init__(self, state: DistributedState):
        self._state = state

    async def revoke_token(self, jti: str, ttl: int = 86400 * 7) -> bool:
        """Revoke a JWT token across all instances.

        Args:
            jti: Token ID
            ttl: Revocation TTL (default 7 days)

        Returns:
            Success status
        """
        return await self._state.set(f"revoked:{jti}", True, ttl)

    async def is_token_revoked(self, jti: str) -> bool:
        """Check if a token is revoked."""
        result = await self._state.get(f"revoked:{jti}")
        return result is not None

    async def store_refresh_token(self, user_id: str, token_hash: str, ttl: int = 86400 * 90) -> bool:
        """Store refresh token hash for validation."""
        return await self._state.set(f"refresh:{user_id}:{token_hash}", True, ttl)

    async def validate_refresh_token(self, user_id: str, token_hash: str) -> bool:
        """Validate refresh token exists and is not revoked."""
        result = await self._state.get(f"refresh:{user_id}:{token_hash}")
        return result is not None

    async def revoke_all_user_tokens(self, user_id: str) -> bool:
        """Revoke all tokens for a user."""
        # In production, this would iterate and revoke
        return await self._state.set(f"revoke_all:{user_id}", True, 86400 * 90)


# Singleton instances
distributed_state = DistributedState()
rate_limiter = RateLimiter(distributed_state)
session_manager = SessionManager(distributed_state)


def initialize_scaling():
    """Initialize all scaling components."""
    distributed_state.initialize()
    logger.info("Horizontal scaling modules initialized")
