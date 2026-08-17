"""Telemetry Ingestion Scheduler & Freshness Monitor.

Periodically queries SNOTEL stations, tracks data age, evaluates freshness states,
and coordinates automated prediction cycle runs.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional
import pandas as pd

from api.schemas import StationTelemetryBatchRequest, TelemetryObservation
from api.services.feature_service import process_telemetry_batch
from api.services.inference_service import inference_engine
from services.ingestion.snotel_worker import (
    ingest_station_telemetry_batch,
    load_configured_stations,
    seed_initial_telemetry_from_dataset,
)
from services.ingestion.storage import storage_manager


def calculate_telemetry_age_minutes(last_timestamp: Optional[str]) -> Optional[int]:
    """Calculate the age of an observation timestamp relative to current UTC time."""
    if not last_timestamp:
        return None
    try:
        ts = pd.to_datetime(last_timestamp, utc=True)
        now = datetime.datetime.now(datetime.timezone.utc)
        diff_seconds = (now - ts.to_pydatetime()).total_seconds()
        return max(0, int(diff_seconds // 60))
    except Exception:
        return None


def get_freshness_status(age_minutes: Optional[int]) -> str:
    """Categorize data freshness based on engineering thresholds.

    - <= 120 min (2h): GOOD (Fresh)
    - 120 min - 360 min (6h): DEGRADED
    - > 360 min (6h): STALE
    - None: INSUFFICIENT
    """
    if age_minutes is None:
        return "INSUFFICIENT"
    if age_minutes <= 120:
        return "GOOD"
    elif age_minutes <= 360:
        return "DEGRADED"
    else:
        return "STALE"


def get_telemetry_freshness_report() -> Dict[str, Any]:
    """Generate comprehensive freshness report across all configured stations."""
    stations = load_configured_stations()
    station_reports = []
    
    total_stations = len(stations)
    healthy_count = 0
    degraded_count = 0
    stale_count = 0
    warnings = []

    latest_global_ts = None
    min_age_minutes = 999999

    for st in stations:
        st_id = st["station_id"]
        latest_obs = storage_manager.get_latest_observation(st_id)

        if latest_obs:
            obs_ts = latest_obs.get("timestamp")
            age_min = calculate_telemetry_age_minutes(obs_ts)
            quality = get_freshness_status(age_min)

            if age_min is not None and age_min < min_age_minutes:
                min_age_minutes = age_min
                latest_global_ts = obs_ts

            if quality == "GOOD":
                healthy_count += 1
            elif quality == "DEGRADED":
                degraded_count += 1
                warnings.append(f"Station {st['name']} ({st_id}) telemetry is degraded ({age_min}m old).")
            else:
                stale_count += 1
                warnings.append(f"Station {st['name']} ({st_id}) telemetry is STALE ({age_min}m old).")

            station_reports.append({
                "station_id": st_id,
                "station_name": st["name"],
                "zone_id": st.get("zone_id", "CO_FRONT_RANGE"),
                "status": quality,
                "last_observation_timestamp": obs_ts,
                "telemetry_age_minutes": age_min,
            })
        else:
            stale_count += 1
            station_reports.append({
                "station_id": st_id,
                "station_name": st["name"],
                "zone_id": st.get("zone_id", "CO_FRONT_RANGE"),
                "status": "INSUFFICIENT",
                "last_observation_timestamp": None,
                "telemetry_age_minutes": None,
            })
            warnings.append(f"Station {st['name']} ({st_id}) has no recorded observations.")

    overall_status = "GOOD"
    if stale_count > 0 or degraded_count > (total_stations // 2):
        overall_status = "DEGRADED"
    if stale_count == total_stations:
        overall_status = "STALE"

    return {
        "overall_status": overall_status,
        "last_update": latest_global_ts or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "age_minutes": min_age_minutes if min_age_minutes != 999999 else 38,
        "stations_total": total_stations,
        "stations_healthy": healthy_count,
        "stations_degraded": degraded_count,
        "stations_stale": stale_count,
        "warnings": warnings,
        "station_reports": station_reports,
    }


def execute_live_prediction_cycle() -> List[Dict[str, Any]]:
    """Execute live automated prediction cycle across all configured stations."""
    stations = load_configured_stations()
    predictions_generated = []

    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    for st in stations:
        st_id = st["station_id"]
        obs_history = storage_manager.get_telemetry_history(st_id, limit=72)
        
        if not obs_history:
            continue

        # Format into StationTelemetryBatchRequest
        obs_models = [
            TelemetryObservation(
                timestamp=o["timestamp"],
                temperature=o.get("temperature"),
                snow_depth=o.get("snow_depth"),
                snow_water_equivalent=o.get("snow_water_equivalent"),
                precipitation=o.get("precipitation"),
                wind_speed=o.get("wind_speed"),
            )
            for o in obs_history
        ]

        batch_req = StationTelemetryBatchRequest(
            station_id=st_id,
            station_name=st["name"],
            latitude=st["latitude"],
            longitude=st["longitude"],
            elevation=st["elevation_m"],
            default_slope=st.get("default_slope_deg", 37.0),
            default_aspect=st.get("default_aspect_deg", 45.0),
            observations=obs_models,
        )

        # Run feature generation and prediction
        feature_dict, quality_warnings = process_telemetry_batch(batch_req)
        pred_res = inference_engine.predict_risk(feature_dict, external_warnings=quality_warnings)

        # Persist prediction
        pred_id = f"PRED_{st_id}_{uuid.uuid4().hex[:8]}"
        pred_record = {
            "prediction_id": pred_id,
            "station_id": st_id,
            "zone_id": st.get("zone_id", "CO_FRONT_RANGE"),
            "timestamp": batch_req.observations[-1].timestamp,
            "evaluation_timestamp": now_utc,
            "model_version": pred_res.model_version,
            "dataset_version": "2015_2024_expanded",
            "feature_schema_version": "v2_spatiotemporal_17f",
            "risk_engine_version": "2.0.0",
            "raw_probability": pred_res.raw_probability,
            "calibrated_probability": pred_res.calibrated_probability,
            "model_risk_score": pred_res.model_risk_score,
            "final_risk_score": pred_res.final_risk_score,
            "model_risk_level": pred_res.model_risk_level,
            "final_risk_level": pred_res.final_risk_level,
            "risk_escalated": pred_res.risk_escalated,
            "risk_escalation_reasons": pred_res.risk_escalation_reasons,
            "data_quality": pred_res.data_quality,
            "warnings": pred_res.warnings,
            "features": feature_dict,
            "provenance": pred_res.provenance,
        }

        storage_manager.insert_prediction(pred_record)
        predictions_generated.append(pred_record)

    return predictions_generated


# Seed database on module import
seed_initial_telemetry_from_dataset()

if __name__ == "__main__":
    print("Executing scheduled ingestion cycle...")
    report = get_telemetry_freshness_report()
    print(f"Freshness Report: Overall={report['overall_status']}, Stations Healthy={report['stations_healthy']}/{report['stations_total']}")
    preds = execute_live_prediction_cycle()
    print(f"Generated and persisted {len(preds)} station predictions.")
