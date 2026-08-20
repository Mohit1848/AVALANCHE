"""Station Telemetry Ingestion, History & Freshness Status Routes."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from api.dependencies import get_inference_engine
from api.schemas import StationTelemetryBatchRequest, RiskPredictionResponse, ErrorResponse
from api.services.feature_service import process_telemetry_batch
from api.services.inference_service import AvalancheInferenceEngine
from services.ingestion.scheduler import get_telemetry_freshness_report, execute_live_prediction_cycle
from services.ingestion.storage import storage_manager
from services.ingestion.snotel_worker import ingest_station_telemetry_batch, load_configured_stations

router = APIRouter(prefix="/telemetry", tags=["Telemetry Stream & Freshness"])


@router.get("/status")
def get_telemetry_status():
    """Retrieve system-wide telemetry freshness, data age, and per-station operational status."""
    try:
        return get_telemetry_freshness_report()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to evaluate telemetry freshness: {exc}"
        )


@router.get("/{station_id}/history")
def get_station_history(
    station_id: str,
    start_ts: Optional[str] = Query(None, description="Start timestamp filter (ISO-8601)"),
    end_ts: Optional[str] = Query(None, description="End timestamp filter (ISO-8601)"),
    limit: int = Query(72, ge=1, le=500, description="Max observations to return")
):
    """Retrieve normalized chronological telemetry observations for a specific SNOTEL station."""
    try:
        obs = storage_manager.get_telemetry_history(station_id, start_ts=start_ts, end_ts=end_ts, limit=limit)
        return {
            "station_id": station_id,
            "count": len(obs),
            "observations": obs,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving station historical telemetry."
        )


@router.get("/{station_id}/assessment")
def get_station_assessment(
    station_id: str,
    slope: float = Query(36.0, ge=0.0, le=90.0, description="Starting zone slope angle in degrees"),
    aspect: float = Query(45.0, ge=0.0, le=360.0, description="Starting zone aspect in degrees"),
    engine: AvalancheInferenceEngine = Depends(get_inference_engine),
):
    """Retrieve the authoritative prediction context and risk assessment for a specific Colorado SNOTEL station."""
    stations = load_configured_stations()
    st_dict = {str(s["station_id"]): s for s in stations}
    if station_id not in st_dict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Station '{station_id}' is not in configured SNOTEL network."
        )

    st = st_dict[station_id]
    obs_history = storage_manager.get_telemetry_history(station_id, limit=72)

    import datetime
    current_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if not obs_history:
        return {
            "station_id": station_id,
            "station_name": st["name"],
            "latitude": st["latitude"],
            "longitude": st["longitude"],
            "elevation": st["elevation_m"],
            "slope": slope,
            "aspect": aspect,
            "telemetry_timestamp": None,
            "telemetry_age_minutes": None,
            "data_quality": "INSUFFICIENT",
            "freshness_state": "INSUFFICIENT",
            "assessment_status": "UNAVAILABLE",
            "prediction_available": False,
            "suppression_reason": "No telemetry observations recorded for this station.",
            "current_utc": current_utc,
            "telemetry_status": "INSUFFICIENT",
            "last_observation_timestamp": None,
            "features": None,
            "prediction": None,
            "rules_evaluation": [],
        }

    latest_obs = obs_history[-1]
    obs_ts = latest_obs.get("timestamp")
    from services.ingestion.scheduler import calculate_telemetry_age_minutes, get_freshness_status
    age_min = calculate_telemetry_age_minutes(obs_ts)
    quality = get_freshness_status(age_min)

    from api.schemas import TelemetryObservation
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
        domain="COLORADO",
        station_id=station_id,
        station_name=st["name"],
        latitude=st["latitude"],
        longitude=st["longitude"],
        elevation=st["elevation_m"],
        default_slope=slope,
        default_aspect=aspect,
        observations=obs_models,
    )

    feature_dict, quality_warnings = process_telemetry_batch(batch_req)
    feature_dict["latitude"] = st["latitude"]
    feature_dict["longitude"] = st["longitude"]
    feature_dict["elevation"] = st["elevation_m"]
    feature_dict["slope"] = slope
    feature_dict["aspect"] = aspect

    pred_res = engine.predict_risk(feature_dict, domain="COLORADO", external_warnings=quality_warnings)

    if quality == "STALE":
        pred_res.data_quality = "STALE"
        pred_res.final_risk_level = "STALE"
        pred_res.risk_level = "STALE"
        prediction_available = False
        assessment_status = "SUPPRESSED"
        suppression_reason = f"Telemetry observation is {age_min} minutes old (>6h). Current assessment is suppressed to prevent false certainty."
        pred_res.warnings.append(f"STALE TELEMETRY: Observation is {age_min}m old. Real-time assessment suppressed.")
    elif quality == "DEGRADED":
        pred_res.data_quality = "DEGRADED"
        prediction_available = True
        assessment_status = "CURRENT"
        suppression_reason = None
    elif quality == "GOOD":
        pred_res.data_quality = "GOOD"
        prediction_available = True
        assessment_status = "CURRENT"
        suppression_reason = None
    else:
        pred_res.data_quality = "INSUFFICIENT"
        pred_res.final_risk_level = "INSUFFICIENT_DATA"
        pred_res.risk_level = "INSUFFICIENT_DATA"
        prediction_available = False
        assessment_status = "UNAVAILABLE"
        suppression_reason = "Missing critical telemetry observations."

    return {
        "station_id": station_id,
        "station_name": st["name"],
        "latitude": st["latitude"],
        "longitude": st["longitude"],
        "elevation": st["elevation_m"],
        "slope": slope,
        "aspect": aspect,
        "telemetry_timestamp": obs_ts,
        "telemetry_age_minutes": age_min,
        "data_quality": quality,
        "freshness_state": quality,
        "assessment_status": assessment_status,
        "prediction_available": prediction_available,
        "suppression_reason": suppression_reason,
        "current_utc": current_utc,
        "telemetry_status": quality,
        "last_observation_timestamp": obs_ts,
        "features": feature_dict,
        "prediction": pred_res,
        "rules_evaluation": pred_res.rule_evaluations,
    }


@router.post("/ingest")
def ingest_telemetry_stream(
    station_id: str,
    observations: List[Dict[str, Any]]
):
    """Ingest, validate physical ranges, normalize timestamps, and store raw station telemetry."""
    if not observations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Observation payload cannot be empty."
        )
    try:
        result = ingest_station_telemetry_batch(station_id, observations)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ingest telemetry stream."
        )


@router.post("/trigger-cycle")
def trigger_prediction_cycle():
    """Trigger an automated live prediction cycle across all enabled SNOTEL stations."""
    try:
        preds = execute_live_prediction_cycle()
        return {
            "status": "success",
            "predictions_count": len(preds),
            "predictions": preds,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute live prediction cycle: {exc}"
        )
