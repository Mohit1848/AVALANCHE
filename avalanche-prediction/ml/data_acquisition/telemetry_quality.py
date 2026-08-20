"""Telemetry Freshness, Quality Validation, and Assessment Suppression Engine.

Evaluates data freshness and enforces strict scientific safety gating:
- LIVE: Age <= 120 minutes (2h) -> Active real-time model prediction
- RECENT / DEGRADED: Age <= 360 minutes (6h) -> Prediction active with quality warnings
- STALE: Age > 360 minutes (6h) -> Prediction SUPPRESSED (Diagnostic reference only)
- HISTORICAL: Age > 1440 minutes (24h) -> Prediction SUPPRESSED (Historical reference only)
- MISSING / INSUFFICIENT: No data -> Prediction UNAVAILABLE
"""

from __future__ import annotations

import datetime
from typing import Any, Dict, Optional, Tuple


DEFAULT_FRESHNESS_CONFIG = {
    "live_max_age_minutes": 120,
    "recent_max_age_minutes": 360,
    "stale_after_minutes": 360,
    "historical_after_minutes": 1440,
}


def calculate_telemetry_age_minutes(
    obs_timestamp_utc: Optional[str],
    reference_time_utc: Optional[datetime.datetime] = None
) -> Optional[int]:
    """Calculate the physical observation age in minutes relative to current UTC."""
    if not obs_timestamp_utc:
        return None

    try:
        ts_clean = obs_timestamp_utc.replace("Z", "+00:00")
        dt_obs = datetime.datetime.fromisoformat(ts_clean)
        if dt_obs.tzinfo is None:
            dt_obs = dt_obs.replace(tzinfo=datetime.timezone.utc)

        ref = reference_time_utc or datetime.datetime.now(datetime.timezone.utc)
        delta_sec = (ref - dt_obs).total_seconds()
        return max(0, int(delta_sec // 60))
    except Exception:
        return None


def classify_freshness(
    age_minutes: Optional[int],
    config: Optional[Dict[str, int]] = None
) -> str:
    """Classify observation age into canonical freshness states."""
    if age_minutes is None:
        return "MISSING"

    cfg = config or DEFAULT_FRESHNESS_CONFIG
    live_max = cfg.get("live_max_age_minutes", 120)
    recent_max = cfg.get("recent_max_age_minutes", 360)
    historical_after = cfg.get("historical_after_minutes", 1440)

    if age_minutes <= live_max:
        return "LIVE"
    elif age_minutes <= recent_max:
        return "DEGRADED"
    elif age_minutes <= historical_after:
        return "STALE"
    else:
        return "HISTORICAL"


def is_prediction_eligible(freshness_state: str) -> Tuple[bool, Optional[str]]:
    """Determine whether an observation's freshness qualifies for real-time model prediction."""
    if freshness_state in ("LIVE", "DEGRADED"):
        return True, None
    elif freshness_state == "STALE":
        return False, "Telemetry observation is STALE (>6h). Current assessment is SUPPRESSED to prevent false certainty."
    elif freshness_state == "HISTORICAL":
        return False, "Telemetry observation is HISTORICAL (>24h). Real-time assessment is SUPPRESSED."
    else:
        return False, "Telemetry observation is MISSING or INSUFFICIENT. Real-time assessment UNAVAILABLE."
