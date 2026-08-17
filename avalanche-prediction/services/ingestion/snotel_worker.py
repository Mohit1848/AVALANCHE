"""SNOTEL Automated Telemetry Ingestion Worker."""

from __future__ import annotations

import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd

from services.ingestion.validator import validate_observation
from services.ingestion.storage import storage_manager

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "stations.yaml"
RAW_DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "processed" / "canonical_training_2015_2024.csv"


def load_configured_stations() -> List[Dict[str, Any]]:
    """Load configured telemetry stations."""
    # Fallback configuration if pyyaml not in minimal runtime
    return [
        {"station_id": "335", "name": "Berthoud Summit", "latitude": 39.7980, "longitude": -105.7780, "elevation_m": 3444.0, "zone_id": "CO_FRONT_RANGE", "enabled": True},
        {"station_id": "586", "name": "Loveland Basin", "latitude": 39.6739, "longitude": -105.8972, "elevation_m": 3475.0, "zone_id": "CO_FRONT_RANGE", "enabled": True},
        {"station_id": "505", "name": "Grizzly Peak", "latitude": 39.6450, "longitude": -105.8670, "elevation_m": 3383.0, "zone_id": "CO_VAIL_SUMMIT", "enabled": True},
        {"station_id": "531", "name": "Hoosier Pass", "latitude": 39.3620, "longitude": -106.0610, "elevation_m": 3475.0, "zone_id": "CO_VAIL_SUMMIT", "enabled": True},
        {"station_id": "415", "name": "Copper Mountain", "latitude": 39.4750, "longitude": -106.1520, "elevation_m": 3216.0, "zone_id": "CO_VAIL_SUMMIT", "enabled": True},
        {"station_id": "485", "name": "Fremont Pass", "latitude": 39.3780, "longitude": -106.1880, "elevation_m": 3475.0, "zone_id": "CO_SAWATCH", "enabled": True},
        {"station_id": "542", "name": "Independence Pass", "latitude": 39.1080, "longitude": -106.6020, "elevation_m": 3688.0, "zone_id": "CO_ASPEN", "enabled": True},
        {"station_id": "737", "name": "Schofield Pass", "latitude": 39.0150, "longitude": -107.0480, "elevation_m": 3261.0, "zone_id": "CO_GUNNISON", "enabled": True},
        {"station_id": "709", "name": "Red Mountain Pass", "latitude": 37.8990, "longitude": -107.7140, "elevation_m": 3414.0, "zone_id": "CO_SAN_JUAN", "enabled": True},
        {"station_id": "1030", "name": "Arapaho Ridge", "latitude": 40.3510, "longitude": -106.3810, "elevation_m": 3341.0, "zone_id": "CO_STEAMBOAT", "enabled": True},
    ]


def ingest_station_telemetry_batch(
    station_id: str,
    raw_observations: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Ingest, validate, and store raw observations for a station."""
    validated_list: List[Dict[str, Any]] = []
    all_warnings: List[str] = []

    for raw in raw_observations:
        val_obs, warns = validate_observation(station_id, raw)
        all_warnings.extend(warns)
        if val_obs is not None:
            validated_list.append(val_obs)

    # Insert into persistent storage
    stored_count = storage_manager.insert_observations(validated_list)

    return {
        "station_id": station_id,
        "received_count": len(raw_observations),
        "validated_count": len(validated_list),
        "stored_count": stored_count,
        "warnings": all_warnings,
        "ingested_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def seed_initial_telemetry_from_dataset() -> int:
    """Seed the telemetry database with observations from the canonical dataset."""
    if not RAW_DATA_PATH.exists():
        return 0

    try:
        df = pd.read_csv(RAW_DATA_PATH)
        stations = load_configured_stations()
        st_map = {s["name"]: s["station_id"] for s in stations}
        
        total_seeded = 0
        for _, row in df.iterrows():
            loc_id = str(row.get("location_id", ""))
            st_id = "586"  # default
            for s_id in ["335", "586", "505", "531", "415", "485", "542", "737", "709", "1030"]:
                if s_id in loc_id:
                    st_id = s_id
                    break

            ts = str(row.get("timestamp"))
            val_obs, _ = validate_observation(st_id, {
                "timestamp": ts,
                "temperature": row.get("temperature"),
                "snow_depth": row.get("snow_depth"),
                "snow_water_equivalent": row.get("snow_water_equivalent"),
                "precipitation": row.get("precipitation"),
                "wind_speed": row.get("wind_speed_mean_24h"),
            })
            if val_obs:
                storage_manager.insert_observations([val_obs])
                total_seeded += 1
        return total_seeded
    except Exception as exc:
        print(f"Notice: Initial telemetry seeding error: {exc}")
        return 0
