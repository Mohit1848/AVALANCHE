"""Station Telemetry Ingestion, History & Freshness Status Routes."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from api.dependencies import get_inference_engine
from api.schemas import StationTelemetryBatchRequest, RiskPredictionResponse, ErrorResponse
from api.services.feature_service import process_telemetry_batch
from api.services.inference_service import AvalancheInferenceEngine
from services.ingestion.scheduler import get_telemetry_freshness_report, execute_live_prediction_cycle
from services.ingestion.storage import storage_manager
from services.ingestion.snotel_worker import ingest_station_telemetry_batch

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
