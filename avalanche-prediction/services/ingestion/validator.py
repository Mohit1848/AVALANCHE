"""Data Validation & Provenance Engine for Telemetry Ingestion."""

from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional, Tuple


# Physical Bounds (Engineering Sanity Limits)
VARIABLE_PHYSICAL_BOUNDS: Dict[str, Tuple[float, float]] = {
    "temperature": (-60.0, 45.0),      # Air Temp in °C
    "snow_depth": (0.0, 1500.0),       # Snow Depth in cm
    "snow_water_equivalent": (0.0, 3000.0), # SWE in mm
    "precipitation": (0.0, 500.0),     # Liquid Precip in mm
    "wind_speed": (0.0, 350.0),        # Wind Speed in km/h
}


def normalize_timestamp_utc(ts_str: str) -> Optional[str]:
    """Parse and normalize timestamp string to standard ISO-8601 UTC string."""
    try:
        dt = datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        else:
            dt = dt.astimezone(datetime.timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None


def validate_observation(
    station_id: str,
    raw_obs: Dict[str, Any]
) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """Validate physical plausibility, normalize timestamp, and attach provenance.

    Returns:
        (validated_observation_or_None, list_of_warnings)
    """
    warnings: List[str] = []

    ts_raw = raw_obs.get("timestamp")
    if not ts_raw:
        return None, ["Missing required observation timestamp."]

    norm_ts = normalize_timestamp_utc(str(ts_raw))
    if not norm_ts:
        return None, [f"Malformed timestamp: '{ts_raw}'."]

    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    validated: Dict[str, Any] = {
        "station_id": str(station_id),
        "timestamp": norm_ts,
        "ingestion_timestamp": now_utc,
        "source": "SNOTEL_AWDB",
        "provenance": {
            "source": "SNOTEL",
            "station_id": str(station_id),
            "network": "NRCS_SNOTEL",
            "validated_at": now_utc,
        },
    }

    # Validate individual physical variables
    for var, (min_val, max_val) in VARIABLE_PHYSICAL_BOUNDS.items():
        val = raw_obs.get(var)
        if val is not None:
            try:
                num_val = float(val)
                if min_val <= num_val <= max_val:
                    validated[var] = round(num_val, 2)
                else:
                    warnings.append(
                        f"Variable '{var}' value {num_val} at station {station_id} is outside physical bounds [{min_val}, {max_val}]. Dropped to null."
                    )
                    validated[var] = None
            except (ValueError, TypeError):
                warnings.append(f"Non-numeric value for '{var}': {val}. Dropped to null.")
                validated[var] = None
        else:
            validated[var] = None

    return validated, warnings
