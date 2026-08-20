"""Colorado SNOTEL Station Synchronization Module.

Discovers, verifies, and synchronizes official metadata from USDA NRCS AWDB for Colorado stations.
"""

from __future__ import annotations

import datetime
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

from ml.data_acquisition.colorado_awdb import awdb_client

logger = logging.getLogger("avalanche.station_sync")

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "telemetry.yaml"
FALLBACK_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "stations.yaml"
METADATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "processed" / "colorado" / "telemetry"


def load_telemetry_config() -> Dict[str, Any]:
    """Load configuration from config/telemetry.yaml with fallback to stations.yaml."""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    elif FALLBACK_CONFIG_PATH.exists():
        with open(FALLBACK_CONFIG_PATH, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
            return {"colorado": {"stations": raw.get("stations", [])}}
    return {"colorado": {"stations": []}}


def get_configured_colorado_stations() -> List[Dict[str, Any]]:
    """Retrieve list of enabled Colorado stations from configuration."""
    cfg = load_telemetry_config()
    stations = cfg.get("colorado", {}).get("stations", [])
    return [s for s in stations if s.get("enabled", True)]


def sync_colorado_station_metadata(
    awdb_adapter=None
) -> Dict[str, Any]:
    """Synchronize station metadata from official USDA NRCS AWDB REST API.

    Returns:
        Sync result summary dictionary with synchronized stations and provenance.
    """
    client = awdb_adapter or awdb_client
    configured = get_configured_colorado_stations()
    triplets = [s["station_triplet"] for s in configured if "station_triplet" in s]

    logger.info(f"Synchronizing metadata for {len(triplets)} Colorado SNOTEL stations from AWDB...")
    raw_stations, provenance = client.get_stations(station_triplets=triplets)

    # Build lookup by station triplet
    awdb_by_triplet = {s.get("stationTriplet"): s for s in raw_stations if s.get("stationTriplet")}

    synced_stations: List[Dict[str, Any]] = []
    unmatched_stations: List[str] = []

    for cfg_st in configured:
        triplet = cfg_st.get("station_triplet")
        awdb_meta = awdb_by_triplet.get(triplet)

        if awdb_meta:
            # Elevation in AWDB is in feet; convert to meters for canonical schema
            elev_ft = awdb_meta.get("elevation")
            elev_m = round(float(elev_ft) * 0.3048, 1) if elev_ft is not None else cfg_st.get("elevation_m")

            synced = {
                "station_id": cfg_st["station_id"],
                "station_triplet": triplet,
                "name": cfg_st.get("name", awdb_meta.get("name")),
                "awdb_name": awdb_meta.get("name"),
                "zone_id": cfg_st.get("zone_id", "CO_FRONT_RANGE"),
                "zone_name": cfg_st.get("zone_name", "Colorado Mountain Corridor"),
                "latitude": float(awdb_meta.get("latitude", cfg_st.get("latitude"))),
                "longitude": float(awdb_meta.get("longitude", cfg_st.get("longitude"))),
                "elevation_m": elev_m,
                "elevation_ft": elev_ft,
                "network": awdb_meta.get("networkCode", "SNTL"),
                "state": awdb_meta.get("stateCode", "CO"),
                "county": awdb_meta.get("countyName"),
                "huc": awdb_meta.get("huc"),
                "data_timezone": awdb_meta.get("dataTimeZone", -8.0),
                "shef_id": awdb_meta.get("shefId"),
                "active_status": "ACTIVE",
                "provider": "USDA_NRCS_AWDB",
                "last_synced_at": provenance.get("requested_at"),
            }
            synced_stations.append(synced)
        else:
            unmatched_stations.append(triplet or cfg_st.get("station_id", "UNKNOWN"))

    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    out_file = METADATA_DIR / "colorado_stations_inventory.json"
    sync_record = {
        "sync_timestamp": provenance.get("requested_at"),
        "provider": "NRCS_AWDB",
        "total_configured": len(configured),
        "total_synchronized": len(synced_stations),
        "unmatched_count": len(unmatched_stations),
        "unmatched_stations": unmatched_stations,
        "provenance": provenance,
        "stations": synced_stations,
    }

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(sync_record, f, indent=2)

    logger.info(f"Successfully synchronized {len(synced_stations)}/{len(configured)} Colorado SNOTEL stations.")
    return sync_record
