"""
Magneetar Hardware Tag Tracking Module
Supports BLE tracking tags similar to AirTag/Tile.
"""

import logging
import time
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class HardwareTag:
    """Represents a hardware tracking tag."""

    tag_id: str
    owner_id: str
    tag_type: str  # "ble", "rfid", "gps"
    name: str
    battery_level: int
    last_seen: float
    last_location: Optional[dict] = None
    is_active: bool = True


class HardwareTagService:
    """Service for managing hardware tracking tags."""

    def __init__(self):
        self._tags = {}  # tag_id -> HardwareTag
        self._initialized = False

    def initialize(self):
        """Initialize the hardware tag service."""
        self._initialized = True
        logger.info("Hardware tag service initialized")

    def is_configured(self) -> bool:
        return self._initialized

    def register_tag(self, tag_id: str, owner_id: str, tag_type: str, name: str) -> dict:
        """Register a new hardware tag.

        Args:
            tag_id: Unique tag identifier (MAC address or serial)
            owner_id: Owner's user ID
            tag_type: Type of tag ("ble", "rfid", "gps")
            name: Human-readable name

        Returns:
            Registration result
        """
        if tag_id in self._tags:
            return {"error": "Tag already registered", "tag_id": tag_id}

        tag = HardwareTag(
            tag_id=tag_id,
            owner_id=owner_id,
            tag_type=tag_type,
            name=name,
            battery_level=100,
            last_seen=time.time(),
            is_active=True,
        )

        self._tags[tag_id] = tag
        logger.info(f"Hardware tag registered: {tag_id} for user {owner_id}")

        return {"success": True, "tag_id": tag_id, "name": name, "type": tag_type}

    def update_tag_location(self, tag_id: str, location: dict, battery: int) -> dict:
        """Update tag location (called by scanning device).

        Args:
            tag_id: Tag identifier
            location: Location data (lat, lng, accuracy)
            battery: Battery level (0-100)

        Returns:
            Update result
        """
        tag = self._tags.get(tag_id)
        if not tag:
            return {"error": "Tag not found", "tag_id": tag_id}

        tag.last_seen = time.time()
        tag.last_location = location
        tag.battery_level = battery

        return {"success": True, "tag_id": tag_id, "location": location, "battery": battery}

    def get_user_tags(self, owner_id: str) -> List[dict]:
        """Get all tags for a user."""
        user_tags = [
            {
                "tag_id": tag.tag_id,
                "name": tag.name,
                "type": tag.tag_type,
                "battery_level": tag.battery_level,
                "last_seen": tag.last_seen,
                "last_location": tag.last_location,
                "is_active": tag.is_active,
            }
            for tag in self._tags.values()
            if tag.owner_id == owner_id
        ]
        return user_tags

    def get_tag_status(self, tag_id: str) -> Optional[dict]:
        """Get detailed tag status."""
        tag = self._tags.get(tag_id)
        if not tag:
            return None

        # Check if tag is stale (no update in 24 hours)
        hours_since_seen = (time.time() - tag.last_seen) / 3600

        return {
            "tag_id": tag.tag_id,
            "name": tag.name,
            "type": tag.tag_type,
            "battery_level": tag.battery_level,
            "last_seen": tag.last_seen,
            "hours_since_seen": round(hours_since_seen, 1),
            "is_online": hours_since_seen < 1,
            "last_location": tag.last_location,
            "is_active": tag.is_active,
        }

    def remove_tag(self, tag_id: str, owner_id: str) -> dict:
        """Remove a tag (owner only)."""
        tag = self._tags.get(tag_id)
        if not tag:
            return {"error": "Tag not found"}

        if tag.owner_id != owner_id:
            return {"error": "Not authorized"}

        del self._tags[tag_id]
        logger.info(f"Hardware tag removed: {tag_id}")

        return {"success": True, "tag_id": tag_id}

    def find_nearby_tags(self, location: dict, radius_km: float = 0.1) -> List[dict]:
        """Find tags near a location (for Guardian Network).

        Args:
            location: Center location {lat, lng}
            radius_km: Search radius in kilometers

        Returns:
            List of nearby tags
        """
        import math

        def haversine_distance(lat1, lon1, lat2, lon2):
            """Calculate distance between two points in km."""
            R = 6371  # Earth's radius in km

            lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

            dlat = lat2 - lat1
            dlon = lon2 - lon1

            a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
            c = 2 * math.asin(math.sqrt(a))

            return R * c

        nearby = []
        center_lat = location.get("lat", 0)
        center_lng = location.get("lng", 0)

        for tag in self._tags.values():
            if not tag.last_location or not tag.is_active:
                continue

            dist = haversine_distance(
                center_lat, center_lng, tag.last_location.get("lat", 0), tag.last_location.get("lng", 0)
            )

            if dist <= radius_km:
                nearby.append(
                    {
                        "tag_id": tag.tag_id,
                        "name": tag.name,
                        "distance_km": round(dist, 2),
                        "location": tag.last_location,
                    }
                )

        return sorted(nearby, key=lambda x: x["distance_km"])


# Singleton instance
hardware_tag_service = HardwareTagService()


def get_nearby_tags(location: dict, radius_km: float = 0.1) -> List[dict]:
    """Convenience function to find nearby tags."""
    return hardware_tag_service.find_nearby_tags(location, radius_km)
