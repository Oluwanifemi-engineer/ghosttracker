"""
Magneetar CDN Storage Module
Provides abstraction for media storage with CDN support.
Supports local storage, S3, Cloudflare R2, and other providers.
"""

import hashlib
import logging
import os

from config import settings

logger = logging.getLogger(__name__)


class CDNStorage:
    """Abstraction layer for media storage with CDN support."""

    def __init__(self):
        self._provider = None
        self._initialized = False

    def initialize(self, provider: str = "local"):
        """Initialize storage provider.

        Args:
            provider: Storage provider ("local", "s3", "r2", "gcs")
        """
        self._provider = provider
        self._initialized = True
        logger.info(f"CDN storage initialized: {provider}")

    def is_configured(self) -> bool:
        return self._initialized

    def get_provider(self) -> str:
        return self._provider or "local"

    def store_media(self, media_id: str, data: bytes, content_type: str) -> dict:
        """Store media file.

        Args:
            media_id: Unique media identifier
            data: File content bytes
            content_type: MIME type

        Returns:
            Storage result with URL
        """
        if self._provider == "s3":
            return self._store_s3(media_id, data, content_type)
        elif self._provider == "r2":
            return self._store_r2(media_id, data, content_type)
        elif self._provider == "gcs":
            return self._store_gcs(media_id, data, content_type)
        else:
            return self._store_local(media_id, data, content_type)

    def get_media_url(self, media_id: str) -> str:
        """Get CDN URL for media file."""
        if self._provider in ("s3", "r2", "gcs"):
            # Return CDN URL
            cdn_base = os.environ.get("MT_CDN_BASE_URL", "")
            if cdn_base:
                return f"{cdn_base}/media/{media_id}"

        # Local storage
        api_base = os.environ.get("MT_API_BASE_URL", "https://api.magneetar.me")
        return f"{api_base}/api/media/{media_id}/file"

    def delete_media(self, media_id: str) -> bool:
        """Delete media file."""
        try:
            if self._provider == "s3":
                return self._delete_s3(media_id)
            elif self._provider == "r2":
                return self._delete_r2(media_id)
            elif self._provider == "gcs":
                return self._delete_gcs(media_id)
            else:
                return self._delete_local(media_id)
        except Exception as e:
            logger.error(f"Failed to delete media {media_id}: {e}")
            return False

    def _store_local(self, media_id: str, data: bytes, content_type: str) -> dict:
        """Store to local filesystem."""
        try:
            media_dir = settings.MEDIA_DIR
            os.makedirs(media_dir, exist_ok=True)

            # Create subdirectory based on media_id hash
            subdir = hashlib.md5(media_id.encode()).hexdigest()[:2]
            full_dir = os.path.join(media_dir, subdir)
            os.makedirs(full_dir, exist_ok=True)

            filepath = os.path.join(full_dir, media_id)
            with open(filepath, "wb") as f:
                f.write(data)

            return {"success": True, "provider": "local", "path": filepath, "size": len(data)}
        except Exception as e:
            logger.error(f"Local storage failed: {e}")
            return {"success": False, "error": str(e)}

    def _store_s3(self, media_id: str, data: bytes, content_type: str) -> dict:
        """Store to AWS S3."""
        try:
            import boto3

            s3 = boto3.client(
                "s3",
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
                region_name=os.environ.get("AWS_REGION", "us-east-1"),
            )

            bucket = os.environ.get("AWS_S3_BUCKET", "magneetar-media")
            key = f"media/{media_id}"

            s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)

            return {"success": True, "provider": "s3", "bucket": bucket, "key": key, "size": len(data)}
        except ImportError:
            logger.warning("boto3 not installed - S3 storage unavailable")
            return self._store_local(media_id, data, content_type)
        except Exception as e:
            logger.error(f"S3 storage failed: {e}")
            return {"success": False, "error": str(e)}

    def _store_r2(self, media_id: str, data: bytes, content_type: str) -> dict:
        """Store to Cloudflare R2 (S3-compatible)."""
        try:
            import boto3

            s3 = boto3.client(
                "s3",
                endpoint_url=os.environ.get("R2_ENDPOINT_URL"),
                aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
            )

            bucket = os.environ.get("R2_BUCKET", "magneetar-media")
            key = f"media/{media_id}"

            s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)

            return {"success": True, "provider": "r2", "bucket": bucket, "key": key, "size": len(data)}
        except ImportError:
            logger.warning("boto3 not installed - R2 storage unavailable")
            return self._store_local(media_id, data, content_type)
        except Exception as e:
            logger.error(f"R2 storage failed: {e}")
            return {"success": False, "error": str(e)}

    def _store_gcs(self, media_id: str, data: bytes, content_type: str) -> dict:
        """Store to Google Cloud Storage."""
        try:
            from google.cloud import storage

            client = storage.Client()
            bucket_name = os.environ.get("GCS_BUCKET", "magneetar-media")
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(f"media/{media_id}")

            blob.upload_from_string(data, content_type=content_type)

            return {
                "success": True,
                "provider": "gcs",
                "bucket": bucket_name,
                "path": f"media/{media_id}",
                "size": len(data),
            }
        except ImportError:
            logger.warning("google-cloud-storage not installed - GCS storage unavailable")
            return self._store_local(media_id, data, content_type)
        except Exception as e:
            logger.error(f"GCS storage failed: {e}")
            return {"success": False, "error": str(e)}

    def _delete_local(self, media_id: str) -> bool:
        """Delete from local filesystem."""
        media_dir = settings.MEDIA_DIR
        subdir = hashlib.md5(media_id.encode()).hexdigest()[:2]
        filepath = os.path.join(media_dir, subdir, media_id)

        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False

    def _delete_s3(self, media_id: str) -> bool:
        """Delete from S3."""
        try:
            import boto3

            s3 = boto3.client(
                "s3",
                aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            )

            bucket = os.environ.get("AWS_S3_BUCKET", "magneetar-media")
            key = f"media/{media_id}"

            s3.delete_object(Bucket=bucket, Key=key)
            return True
        except Exception as e:
            logger.error(f"S3 delete failed: {e}")
            return False

    def _delete_r2(self, media_id: str) -> bool:
        """Delete from R2."""
        try:
            import boto3

            s3 = boto3.client(
                "s3",
                endpoint_url=os.environ.get("R2_ENDPOINT_URL"),
                aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
                aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
            )

            bucket = os.environ.get("R2_BUCKET", "magneetar-media")
            key = f"media/{media_id}"

            s3.delete_object(Bucket=bucket, Key=key)
            return True
        except Exception as e:
            logger.error(f"R2 delete failed: {e}")
            return False

    def _delete_gcs(self, media_id: str) -> bool:
        """Delete from GCS."""
        try:
            from google.cloud import storage

            client = storage.Client()
            bucket_name = os.environ.get("GCS_BUCKET", "magneetar-media")
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(f"media/{media_id}")

            blob.delete()
            return True
        except Exception as e:
            logger.error(f"GCS delete failed: {e}")
            return False


# Singleton instance
cdn_storage = CDNStorage()


def store_media_file(media_id: str, data: bytes, content_type: str) -> dict:
    """Convenience function to store media."""
    return cdn_storage.store_media(media_id, data, content_type)


def get_media_cdn_url(media_id: str) -> str:
    """Convenience function to get CDN URL."""
    return cdn_storage.get_media_url(media_id)
