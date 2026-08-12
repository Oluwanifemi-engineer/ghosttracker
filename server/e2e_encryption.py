"""
Magneetar End-to-End Encryption Module  ⚠️ EXPERIMENTAL SCAFFOLD — NOT WIRED

STATUS (2026-08-11): this module remains INERT as a scaffold for TRUE
end-to-end encryption (device-side keys, server never decrypts). Server-side
at-rest encryption is implemented separately and live since v1.5
(`encryption.py`: `encrypt_location_for_store()` / `decrypt_location_row()`
set `locations.location_encrypted=1` and store AES-256-GCM ciphertext in
`location_data` with per-device HKDF keys; account secrets — TOTP — are
always encrypted via user_security.py).

Do NOT reference this module as a shipped feature in user-facing copy, and do
NOT wire it into routes without a full key-management design (key
provisioning, recovery, and who can decrypt what). It is kept only as a
starting point for that future work.
"""

import hashlib
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


class E2EEncryption:
    """End-to-end encryption using AES-256-GCM."""

    def __init__(self):
        self._initialized = False

    def initialize(self, master_key: Optional[str] = None):
        """Initialize encryption with a master key."""
        self._initialized = True
        logger.info("E2E encryption module initialized")

    def is_configured(self) -> bool:
        """Check if E2E encryption is configured."""
        return self._initialized

    def generate_device_key(self, device_id: str, user_secret: str) -> str:
        """Generate a unique encryption key for a device.

        Args:
            device_id: The device identifier
            user_secret: User-provided secret (e.g., password hash)

        Returns:
            Base64-encoded encryption key
        """
        # Derive key from device_id + user_secret
        key_material = f"{device_id}:{user_secret}".encode()
        key = hashlib.pbkdf2_hmac("sha256", key_material, b"magneetar-e2e", 100000)
        return key.hex()

    def encrypt_location(self, data: dict, key: str) -> dict:
        """Encrypt location data before storage.

        Args:
            data: Location data dictionary
            key: Encryption key (hex string)

        Returns:
            Encrypted data with metadata
        """
        try:
            import json

            from cryptography.hazmat.primitives.ciphers.aead import AESGCM

            # Generate random nonce
            nonce = os.urandom(12)

            # Serialize data
            plaintext = json.dumps(data).encode()

            # Encrypt
            key_bytes = bytes.fromhex(key)
            cipher = AESGCM(key_bytes)
            ciphertext = cipher.encrypt(nonce, plaintext, None)

            return {"encrypted": True, "nonce": nonce.hex(), "ciphertext": ciphertext.hex(), "version": 1}
        except ImportError:
            logger.warning("cryptography package not installed - E2E encryption disabled")
            return {"encrypted": False, "data": data}
        except Exception as e:
            logger.error(f"E2E encryption failed: {e}")
            return {"encrypted": False, "data": data}

    def decrypt_location(self, encrypted_data: dict, key: str) -> dict:
        """Decrypt location data.

        Args:
            encrypted_data: Encrypted data dictionary
            key: Encryption key (hex string)

        Returns:
            Decrypted location data
        """
        if not encrypted_data.get("encrypted"):
            return encrypted_data.get("data", encrypted_data)

        try:
            import json

            from cryptography.hazmat.primitives.ciphers.aead import AESGCM

            # Extract components
            nonce = bytes.fromhex(encrypted_data["nonce"])
            ciphertext = bytes.fromhex(encrypted_data["ciphertext"])

            # Decrypt
            key_bytes = bytes.fromhex(key)
            cipher = AESGCM(key_bytes)
            plaintext = cipher.decrypt(nonce, ciphertext, None)

            return json.loads(plaintext)
        except ImportError:
            logger.warning("cryptography package not installed - cannot decrypt")
            return {}
        except Exception as e:
            logger.error(f"E2E decryption failed: {e}")
            return {}

    def encrypt_media_key(self, media_id: str, key: str) -> str:
        """Generate encryption key for media file.

        Args:
            media_id: Media identifier
            key: User's encryption key

        Returns:
            Media-specific encryption key
        """
        material = f"{media_id}:{key}".encode()
        return hashlib.sha256(material).hexdigest()

    def derive_shared_key(self, key1: str, key2: str) -> str:
        """Derive a shared key for Guardian Network recovery.

        Args:
            key1: Owner's key
            key2: Guardian's key

        Returns:
            Shared encryption key
        """
        material = f"{key1}:{key2}".encode()
        return hashlib.sha256(material).hexdigest()


class KeyManager:
    """Manages encryption keys for users and devices."""

    def __init__(self):
        self._keys = {}  # device_id -> (key, expiry)

    def store_device_key(self, device_id: str, key: str, ttl_seconds: int = 3600):
        """Store a device encryption key temporarily."""
        import time

        self._keys[device_id] = (key, time.time() + ttl_seconds)

    def get_device_key(self, device_id: str) -> Optional[str]:
        """Retrieve a device encryption key."""
        import time

        entry = self._keys.get(device_id)
        if entry is None:
            return None

        key, expiry = entry
        if time.time() > expiry:
            del self._keys[device_id]
            return None

        return key

    def revoke_device_key(self, device_id: str):
        """Revoke a device encryption key."""
        self._keys.pop(device_id, None)

    def revoke_all_keys(self, user_id: str):
        """Revoke all keys for a user."""
        # In production, this would query the database
        self._keys.clear()


# Singleton instances
e2e_encryption = E2EEncryption()
key_manager = KeyManager()


def encrypt_sensitive_data(data: dict, key: str) -> dict:
    """Convenience function to encrypt sensitive data."""
    return e2e_encryption.encrypt_location(data, key)


def decrypt_sensitive_data(encrypted_data: dict, key: str) -> dict:
    """Convenience function to decrypt sensitive data."""
    return e2e_encryption.decrypt_location(encrypted_data, key)
