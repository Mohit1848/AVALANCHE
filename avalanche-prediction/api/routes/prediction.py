"""Point Prediction, Telemetry Inference & Prediction History Routes."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from api.dependencies import get_inference_engine
from api.schemas import (
    PointPredictionRequest,
    BatchPointPredictionRequest,
    BatchPointPredictionResponse,
    BatchPointPredictionItem,
    StationTelemetryBatchRequest,
    RiskPredictionResponse,
    ErrorResponse,
)
from api.services.feature_service import enrich_point_features, process_telemetry_batch
from api.services.inference_service import AvalancheInferenceEngine
from ml.model_registry import ModelUnavailableError, DomainMismatchError
from services.ingestion.storage import storage_manager

router = APIRouter(tags=["Prediction & History"])


@router.post(
    "/predict/point",
    response_model=RiskPredictionResponse,
    responses={
        422: {"model": ErrorResponse, "description": "Domain boundary coordinate mismatch or validation error"},
        500: {"model": ErrorResponse, "description": "Internal prediction failure"},
        503: {"model": ErrorResponse, "description": "Inference engine unavailable or domain model not ready"}
    }
)
def predict_point_risk(
    request: PointPredictionRequest,
    engine: AvalancheInferenceEngine = Depends(get_inference_engine)
):
    """Predict avalanche probability and policy-evaluated risk level for specific mountain coordinates."""
    if not engine.is_healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inference engine is not healthy or model artifact could not be initialized."
        )

    try:
        feature_dict = enrich_point_features(request)
        feature_dict["latitude"] = request.latitude
        feature_dict["longitude"] = request.longitude
        domain = request.domain or "COLORADO"
        return engine.predict_risk(feature_dict, domain=domain)
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc)
        )
    except DomainMismatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while evaluating point avalanche risk: {str(exc)}"
        )


@router.post(
    "/predict/batch",
    response_model=BatchPointPredictionResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Batch prediction processing failure"},
        503: {"model": ErrorResponse, "description": "Inference engine unavailable"}
    }
)
def predict_batch_points(
    request: BatchPointPredictionRequest,
    engine: AvalancheInferenceEngine = Depends(get_inference_engine)
):
    """Batch evaluate avalanche risk for a list of mountain coordinates (e.g. uploaded CSV/JSON rows)."""
    if not engine.is_healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inference engine is not healthy or model artifact could not be initialized."
        )

    results: List[BatchPointPredictionItem] = []
    successful = 0
    failed = 0

    for idx, point in enumerate(request.points):
        try:
            feat_dict = enrich_point_features(point)
            pred = engine.predict_risk(feat_dict)
            results.append(
                BatchPointPredictionItem(
                    index=idx,
                    location_id=point.location_id,
                    latitude=point.latitude,
                    longitude=point.longitude,
                    prediction=pred,
                    error=None
                )
            )
            successful += 1
        except Exception as exc:
            results.append(
                BatchPointPredictionItem(
                    index=idx,
                    location_id=point.location_id,
                    latitude=point.latitude,
                    longitude=point.longitude,
                    prediction=None,
                    error=str(exc)
                )
            )
            failed += 1

    return BatchPointPredictionResponse(
        total=len(request.points),
        successful=successful,
        failed=failed,
        results=results
    )


@router.post(
    "/predict/telemetry",
    response_model=RiskPredictionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid telemetry time-series"},
        422: {"model": ErrorResponse, "description": "Domain boundary mismatch"},
        500: {"model": ErrorResponse, "description": "Internal stream processing failure"},
        503: {"model": ErrorResponse, "description": "Inference engine unavailable or domain model not ready"}
    }
)
def predict_from_telemetry_stream(
    request: StationTelemetryBatchRequest,
    engine: AvalancheInferenceEngine = Depends(get_inference_engine)
):
    """Ingest time-series telemetry, compute strictly backward-looking 6h/24h/72h features, and evaluate risk."""
    if not engine.is_healthy:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inference engine is not healthy or model artifact could not be initialized."
        )

    if not request.observations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telemetry observation list cannot be empty."
        )

    try:
        feature_dict, quality_warnings = process_telemetry_batch(request)
        feature_dict["latitude"] = request.latitude
        feature_dict["longitude"] = request.longitude
        domain = request.domain or "COLORADO"
        return engine.predict_risk(feature_dict, domain=domain, external_warnings=quality_warnings)
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc)
        )
    except DomainMismatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing time-series telemetry: {str(exc)}"
        )


@router.get("/predictions")
def get_prediction_history(
    station_id: Optional[str] = Query(None, description="Filter by SNOTEL station ID"),
    risk_level: Optional[str] = Query(None, description="Filter by final risk level (LOW, MEDIUM, HIGH, INSUFFICIENT_DATA)"),
    limit: int = Query(30, ge=1, le=200, description="Max records to return")
):
    """Retrieve persisted prediction history to inspect temporal risk transitions."""
    try:
        preds = storage_manager.get_predictions(station_id=station_id, risk_level=risk_level, limit=limit)
        return {
            "count": len(preds),
            "predictions": preds,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving prediction history."
        )


@router.get("/predictions/{prediction_id}")
def get_prediction_detail(prediction_id: str):
    """Retrieve complete prediction audit record including model version, features, and escalation rules."""
    pred = storage_manager.get_prediction_by_id(prediction_id)
    if not pred:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prediction record '{prediction_id}' not found."
        )
    return pred
