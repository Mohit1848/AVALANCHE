"""Live Telemetry Service Coordinator.

Provides high-level business logic for Colorado SNOTEL live telemetry status,
station detail queries, rate-limited manual sync, and health monitoring.
"""

from __future__ import annotations

import datetime
import time
from typing import Any, Dict, List, Optional

from ml.data_acquisition.colorado_live_ingestion import run_colorado_telemetry_ingestion
from ml.data_acquisition.colorado_station_sync import get_configured_colorado_stations
from ml.data_acquisition.telemetry_quality import (
    calculate_telemetry_age_minutes,
    classify_freshness,
)
from services.ingestion.storage import storage_manager

_LAST_MANUAL_SYNC_TIMESTAMP: float = 0.0
MANUAL_SYNC_MIN_INTERVAL_SECONDS: float = 30.0


def get_colorado_telemetry_status() -> Dict[str, Any]:
    """Retrieve system-wide status of Colorado NRCS AWDB telemetry."""
    latest_sync = storage_manager.get_latest_sync_log()
    stations = get_configured_colorado_stations()

    live_count = 0
    degraded_count = 0
    stale_count = 0
    historical_count = 0
    missing_count = 0

    latest_global_ts: Optional[str] = None
    latest_global_age: Optional[int] = None

    for st in stations:
        st_id = st["station_id"]
        latest_obs = storage_manager.get_latest_observation(st_id)
        if latest_obs and latest_obs.get("timestamp"):
            ts = latest_obs["timestamp"]
            age = calculate_telemetry_age_minutes(ts)
            state = classify_freshness(age)

            if state == "LIVE":
                live_count += 1
            elif state == "DEGRADED":
                degraded_count += 1
            elif state == "STALE":
                stale_count += 1
            else:
                historical_count += 1

            if ts and (latest_global_ts is None or ts > latest_global_ts):
                latest_global_ts = ts
                latest_global_age = age
        else:
            missing_count += 1

    overall_status = "LIVE" if live_count > 0 else ("DEGRADED" if degraded_count > 0 else ("STALE" if stale_count > 0 else "HISTORICAL"))
    if missing_count == len(stations) and not latest_global_ts:
        overall_status = "OFFLINE"

    return {
        "provider": "NRCS_AWDB",
        "status": overall_status,
        "last_successful_sync": latest_sync.get("sync_timestamp") if latest_sync else None,
        "latest_observation_utc": latest_global_ts,
        "latest_observation_age_minutes": latest_global_age,
        "stations_total": len(stations),
        "stations_live": live_count,
        "stations_degraded": degraded_count,
        "stations_stale": stale_count,
        "stations_historical": historical_count,
        "stations_missing": missing_count,
    }


def get_colorado_stations_overview() -> List[Dict[str, Any]]:
    """Retrieve normalized station metadata with current freshness and latest observations."""
    stations = get_configured_colorado_stations()
    overview: List[Dict[str, Any]] = []

    for st in stations:
        st_id = st["station_id"]
        latest_obs = storage_manager.get_latest_observation(st_id)

        if latest_obs and latest_obs.get("timestamp"):
            obs_ts = latest_obs["timestamp"]
            age_min = calculate_telemetry_age_minutes(obs_ts)
            freshness = classify_freshness(age_min)
            values = {
                "temperature": latest_obs.get("temperature"),
                "snow_depth": latest_obs.get("snow_depth"),
                "snow_water_equivalent": latest_obs.get("snow_water_equivalent"),
                "precipitation": latest_obs.get("precipitation"),
                "wind_speed": latest_obs.get("wind_speed"),
            }
        else:
            obs_ts = None
            age_min = None
            freshness = "MISSING"
            values = {}

        overview.append({
            "station_id": st_id,
            "station_triplet": st.get("station_triplet", f"{st_id}:CO:SNTL"),
            "name": st.get("name"),
            "zone_id": st.get("zone_id"),
            "zone_name": st.get("zone_name"),
            "latitude": st.get("latitude"),
            "longitude": st.get("longitude"),
            "elevation_m": st.get("elevation_m"),
            "freshness_state": freshness,
            "observation_age_minutes": age_min,
            "last_observation_utc": obs_ts,
            "provider": "NRCS_AWDB",
            "latest_values": values,
        })

    return overview


def get_colorado_station_detail(station_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve detailed telemetry observations, age, quality, and provenance for a station."""
    stations = get_configured_colorado_stations()
    st_match = next((s for s in stations if str(s["station_id"]) == str(station_id)), None)
    if not st_match:
        return None

    obs_history = storage_manager.get_telemetry_history(station_id, limit=72)
    latest_obs = storage_manager.get_latest_observation(station_id)

    if latest_obs and latest_obs.get("timestamp"):
        obs_ts = latest_obs["timestamp"]
        age_min = calculate_telemetry_age_minutes(obs_ts)
        freshness = classify_freshness(age_min)
    else:
        obs_ts = None
        age_min = None
        freshness = "MISSING"

    return {
        "station_id": station_id,
        "station_triplet": st_match.get("station_triplet", f"{station_id}:CO:SNTL"),
        "name": st_match.get("name"),
        "zone_id": st_match.get("zone_id"),
        "zone_name": st_match.get("zone_name"),
        "latitude": st_match.get("latitude"),
        "longitude": st_match.get("longitude"),
        "elevation_m": st_match.get("elevation_m"),
        "freshness_state": freshness,
        "observation_age_minutes": age_min,
        "last_observation_utc": obs_ts,
        "ingestion_timestamp": latest_obs.get("ingestion_timestamp") if latest_obs else None,
        "provider": "NRCS_AWDB",
        "latest_observation": latest_obs,
        "recent_history_count": len(obs_history),
        "recent_observations": obs_history,
    }


def trigger_manual_colorado_sync() -> Tuple[Dict[str, Any], bool]:
    """Execute manual synchronization with rate-limiting / debounce protection.

    Returns:
        (result_dict, was_rate_limited)
    """
    global _LAST_MANUAL_SYNC_TIMESTAMP
    now_monotonic = time.monotonic()
    elapsed = now_monotonic - _LAST_MANUAL_SYNC_TIMESTAMP

    if elapsed < MANUAL_SYNC_MIN_INTERVAL_SECONDS:
        remaining = int(MANUAL_SYNC_MIN_INTERVAL_SECONDS - elapsed)
        latest_status = get_colorado_telemetry_status()
        return {
            "status": "RATE_LIMITED",
            "message": f"Manual synchronization rate-limited. Please wait {remaining}s.",
            "current_status": latest_status,
        }, True

    _LAST_MANUAL_SYNC_TIMESTAMP = now_monotonic
    sync_res = run_colorado_telemetry_ingestion()
    return sync_res, False


def get_colorado_telemetry_health() -> Dict[str, Any]:
    """Check connectivity and health of NRCS AWDB live ingestion."""
    latest_sync = storage_manager.get_latest_sync_log()
    status_overview = get_colorado_telemetry_status()

    is_healthy = status_overview["status"] in ("LIVE", "DEGRADED", "STALE")
    return {
        "provider": "NRCS_AWDB",
        "healthy": is_healthy,
        "status": status_overview["status"],
        "last_sync": latest_sync.get("sync_timestamp") if latest_sync else None,
        "stations_configured": status_overview["stations_total"],
        "stations_active": status_overview["stations_live"] + status_overview["stations_degraded"] + status_overview["stations_stale"],
        "stations_failed": status_overview["stations_missing"],
    }
