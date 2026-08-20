"""Colorado Live Telemetry Ingestion Pipeline.

Fetches real-time SNOTEL observations from USDA NRCS AWDB, validates ranges,
normalizes units, persists to local database, and updates freshness status.
"""

from __future__ import annotations

import argparse
import datetime
import logging
import sys
from typing import Any, Dict, List, Optional

from ml.data_acquisition.colorado_awdb import awdb_client
from ml.data_acquisition.colorado_station_sync import (
    get_configured_colorado_stations,
    load_telemetry_config,
    sync_colorado_station_metadata,
)
from ml.data_acquisition.telemetry_normalizer import normalize_awdb_station_records
from ml.data_acquisition.telemetry_quality import (
    calculate_telemetry_age_minutes,
    classify_freshness,
)
from services.ingestion.storage import storage_manager

logger = logging.getLogger("avalanche.live_ingestion")


def run_colorado_telemetry_ingestion(
    awdb_adapter=None,
    days_back: int = 3,
) -> Dict[str, Any]:
    """Execute complete live Colorado SNOTEL telemetry ingestion cycle from USDA NRCS AWDB.

    Returns:
        Summary of ingestion results including station statuses and observation counts.
    """
    client = awdb_adapter or awdb_client
    stations = get_configured_colorado_stations()
    if not stations:
        return {"status": "EMPTY", "error": "No enabled Colorado stations found in configuration."}

    cfg = load_telemetry_config()
    elements = [
        e["code"]
        for e in cfg.get("colorado", {}).get("elements", [])
        if "code" in e
    ]
    if not elements:
        elements = ["TOBS", "SNWD", "WTEQ", "PREC", "WSPDV", "WDIRV"]

    triplets = [s["station_triplet"] for s in stations if "station_triplet" in s]
    st_by_triplet = {s["station_triplet"]: s for s in stations}

    now = datetime.datetime.now(datetime.timezone.utc)
    begin_date = (now - datetime.timedelta(days=days_back)).strftime("%Y-%m-%d")
    end_date = now.strftime("%Y-%m-%d")

    logger.info(f"Initiating AWDB live telemetry sync for {len(triplets)} stations ({begin_date} to {end_date})...")

    try:
        raw_data, provenance = client.get_hourly_data(
            station_triplets=triplets,
            elements=elements,
            begin_date=begin_date,
            end_date=end_date,
        )
    except Exception as exc:
        logger.error(f"Failed to retrieve data from AWDB: {exc}")
        return {
            "status": "OFFLINE",
            "provider": "NRCS_AWDB",
            "timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "error": str(exc),
            "stations_total": len(stations),
            "stations_live": 0,
            "stations_degraded": 0,
            "stations_stale": 0,
            "stations_failed": len(stations),
            "station_reports": [],
        }

    raw_by_triplet = {item.get("stationTriplet"): item for item in raw_data if item.get("stationTriplet")}

    station_reports: List[Dict[str, Any]] = []
    total_stored = 0
    live_count = 0
    degraded_count = 0
    stale_count = 0
    failed_count = 0
    latest_global_obs: Optional[str] = None

    for triplet in triplets:
        cfg_st = st_by_triplet[triplet]
        station_id = cfg_st["station_id"]
        display_name = cfg_st.get("name", f"SNOTEL {station_id}")
        tz_offset = cfg_st.get("data_timezone", -8.0)

        raw_station = raw_by_triplet.get(triplet)
        if not raw_station:
            failed_count += 1
            station_reports.append({
                "station_id": station_id,
                "station_triplet": triplet,
                "name": display_name,
                "status": "FAILED",
                "freshness_state": "MISSING",
                "observations_stored": 0,
                "latest_observation": None,
                "age_minutes": None,
                "error": "No data returned by AWDB for this station.",
            })
            continue

        try:
            canonical_obs = normalize_awdb_station_records(
                station_id=station_id,
                station_triplet=triplet,
                raw_station_data=raw_station,
                timezone_offset=tz_offset,
                provenance_meta=provenance,
            )

            if canonical_obs:
                stored = storage_manager.insert_observations(canonical_obs)
                total_stored += stored

                latest_obs = canonical_obs[-1]
                latest_ts = latest_obs.get("timestamp")
                age_min = calculate_telemetry_age_minutes(latest_ts)
                freshness = classify_freshness(age_min)

                if freshness == "LIVE":
                    live_count += 1
                elif freshness == "DEGRADED":
                    degraded_count += 1
                else:
                    stale_count += 1

                if latest_ts and (latest_global_obs is None or latest_ts > latest_global_obs):
                    latest_global_obs = latest_ts

                station_reports.append({
                    "station_id": station_id,
                    "station_triplet": triplet,
                    "name": display_name,
                    "status": "SUCCESS",
                    "freshness_state": freshness,
                    "observations_stored": stored,
                    "latest_observation": latest_ts,
                    "age_minutes": age_min,
                    "latest_values": {
                        "temperature": latest_obs.get("temperature"),
                        "snow_depth": latest_obs.get("snow_depth"),
                        "snow_water_equivalent": latest_obs.get("snow_water_equivalent"),
                        "precipitation": latest_obs.get("precipitation"),
                        "wind_speed": latest_obs.get("wind_speed"),
                    },
                })
            else:
                failed_count += 1
                station_reports.append({
                    "station_id": station_id,
                    "station_triplet": triplet,
                    "name": display_name,
                    "status": "NO_VALID_OBSERVATIONS",
                    "freshness_state": "MISSING",
                    "observations_stored": 0,
                    "latest_observation": None,
                    "age_minutes": None,
                })
        except Exception as st_exc:
            logger.error(f"Error normalizing station {triplet}: {st_exc}")
            failed_count += 1
            station_reports.append({
                "station_id": station_id,
                "station_triplet": triplet,
                "name": display_name,
                "status": "ERROR",
                "freshness_state": "MISSING",
                "observations_stored": 0,
                "latest_observation": None,
                "age_minutes": None,
                "error": str(st_exc),
            })

    provider_status = "LIVE" if live_count > 0 else ("DEGRADED" if degraded_count > 0 else "STALE")
    if failed_count == len(triplets):
        provider_status = "OFFLINE"

    result = {
        "status": provider_status,
        "provider": "NRCS_AWDB",
        "sync_timestamp": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latest_observation_utc": latest_global_obs,
        "stations_total": len(stations),
        "stations_live": live_count,
        "stations_degraded": degraded_count,
        "stations_stale": stale_count,
        "stations_failed": failed_count,
        "total_observations_stored": total_stored,
        "provenance_sha256": provenance.get("sha256"),
        "station_reports": station_reports,
    }

    logger.info(
        f"AWDB Sync Completed: Status={provider_status}, Live={live_count}, Degraded={degraded_count}, "
        f"Stale={stale_count}, Failed={failed_count}, Total Obs={total_stored}"
    )
    storage_manager.record_sync_log(result)
    return result


def main():
    """CLI Entrypoint for diagnostic Colorado telemetry synchronization."""
    parser = argparse.ArgumentParser(description="Synchronize live Colorado SNOTEL telemetry from USDA NRCS AWDB.")
    parser.add_argument("--once", action="store_true", help="Execute single live synchronization run and print report.")
    parser.add_argument("--sync-meta", action="store_true", help="Synchronize station metadata.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    if args.sync_meta:
        print("Synchronizing station metadata from NRCS AWDB...")
        meta_res = sync_colorado_station_metadata()
        print(f"Synchronized {meta_res.get('total_synchronized')} stations.")

    print("\n=============================================")
    print("COLORADO LIVE TELEMETRY SYNC")
    print("=============================================\n")
    print("Provider: NRCS_AWDB\n")
    print("Stations:")

    res = run_colorado_telemetry_ingestion()

    reports = res.get("station_reports", [])
    for r in reports:
        name = r.get("name", "Unknown")
        state = r.get("freshness_state", "UNKNOWN")
        age = r.get("age_minutes")
        age_str = f"{age}m" if age is not None else "N/A"
        print(f"  {name:22} {state:10} {age_str:>8}")

    successful = res.get("stations_live", 0) + res.get("stations_degraded", 0) + res.get("stations_stale", 0)
    failed = res.get("stations_failed", 0)

    print(f"\nSuccessful: {successful}")
    print(f"Failed: {failed}")
    print(f"\nLatest observation:")
    print(res.get("latest_observation_utc") or "N/A")
    print("\n=============================================")
    print("SYNC COMPLETE")
    print("=============================================\n")


if __name__ == "__main__":
    main()
