"""
Magneetar Location Validator
Rejects obviously invalid GPS coordinates (ocean, Antarctica, etc.)
"""

from typing import Optional, Tuple

# Known landmass bounding boxes (simplified, covers major continents)
# Format: (min_lat, max_lat, min_lng, max_lng)
LAND_BBOXES = [
    # Africa (primary market)
    (-35.0, 37.5, -18.0, 52.0),
    # Europe
    (35.0, 71.0, -25.0, 45.0),
    # Asia
    (-10.0, 75.0, 25.0, 180.0),
    # North America
    (7.0, 85.0, -170.0, -50.0),
    # South America
    (-56.0, 15.0, -82.0, -34.0),
    # Australia
    (-45.0, -10.0, 110.0, 155.0),
]


def is_on_land(lat: float, lng: float) -> bool:
    """Check if coordinates are within a simplified land bounding box."""
    for min_lat, max_lat, min_lng, max_lng in LAND_BBOXES:
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            return True
    return False


def is_valid_location(
    lat: float,
    lng: float,
    accuracy: Optional[float] = None,
    provider: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Validate that GPS coordinates are plausible.

    Returns:
        (is_valid, reason) tuple
    """
    # Basic mathematical range check (Pydantic already enforces this, but
    # defense in depth)
    if not (-90 <= lat <= 90):
        return False, f"Latitude {lat} out of range [-90, 90]"
    if not (-180 <= lng <= 180):
        return False, f"Longitude {lng} out of range [-180, 180]"

    # Check for obviously invalid coordinates
    # (0, 0) is often a GPS default/null value (Gulf of Guinea)
    if lat == 0.0 and lng == 0.0:
        return False, "Coordinates (0, 0) are likely a GPS default value"

    # Very low accuracy suggests a garbage fix
    if accuracy is not None and accuracy > 1000:
        return False, f"Accuracy {accuracy}m is too low (likely garbage fix)"

    # Check if coordinates are on land (simplified)
    if not is_on_land(lat, lng):
        # Allow if accuracy is very high (might be a small island)
        if accuracy is not None and accuracy < 50:
            return True, "High accuracy, likely on land despite bounding box"
        return False, f"Coordinates ({lat}, {lng}) appear to be in the ocean"

    return True, "Valid"


def validate_location_report(
    lat: float,
    lng: float,
    accuracy: Optional[float] = None,
    provider: Optional[str] = None,
) -> Tuple[bool, str, Optional[str]]:
    """
    Full location validation for a telemetry report.

    Returns:
        (is_valid, reason, warning) tuple
        - is_valid: False if the location should be rejected
        - reason: Human-readable explanation
        - warning: Non-fatal warning (e.g., low accuracy)
    """
    is_valid, reason = is_valid_location(lat, lng, accuracy, provider)

    warning = None
    if accuracy is not None and accuracy > 100:
        warning = f"Low accuracy: ±{accuracy}m"

    return is_valid, reason, warning
