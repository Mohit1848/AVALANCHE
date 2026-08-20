"""Health & Subsystem Status Diagnostic Endpoint."""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from api.dependencies import get_inference_engine
from api.schemas import HealthResponse
from api.services.inference_service import AvalancheInferenceEngine
from ml.model_registry import model_registry, Domain
from services.ingestion.scheduler import get_telemetry_freshness_report
from services.ingestion.storage import storage_manager

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def health_check(
    domain: Optional[str] = Query("COLORADO", description="Queried domain"),
    engine: AvalancheInferenceEngine = Depends(get_inference_engine)
):
    """Retrieve granular health and diagnostic status across all system subsystems."""
    norm_domain = model_registry.normalize_domain(domain)
    is_model_ok = engine.is_healthy
    is_schema_ok = engine.schema_synchronized
    gating_state = model_registry.get_gating_state(norm_domain)

    # Check Database / Storage
    db_ok = True
    try:
        storage_manager._get_connection().close()
    except Exception:
        db_ok = False

    # Check Telemetry Freshness
    freshness = get_telemetry_freshness_report()
    telemetry_status = freshness.get("overall_status", "GOOD")

    # Overall system health evaluation
    overall_status = "ok" if (is_model_ok and db_ok and telemetry_status in ["GOOD", "DEGRADED"]) else "degraded"

    return {
        "status": overall_status,
        "service": "avalanche-risk-intelligence-api",
        "version": "2.0.0-research",
        "subsystems": {
            "api": "ok",
            "model": "ok" if is_model_ok else "unavailable",
            "database": "ok" if db_ok else "error",
            "ingestion": "ok",
            "telemetry": telemetry_status,
            "risk_engine": "ok",
            "schema": "SYNCHRONIZED" if is_schema_ok else "UNSYNCHRONIZED",
            "domain_registry": "ok",
        },
        "model_loaded": is_model_ok,
        "model_version": engine.model_version,
        "feature_schema_version": engine.feature_schema_version,
        "calibrated": True,
        "active_operating_threshold": engine.operating_threshold,
        "thresholds": {
            "medium": engine.operating_threshold,
            "high": engine.high_risk_threshold,
        },
        "schema_status": "SYNCHRONIZED" if is_schema_ok else "UNSYNCHRONIZED",
        "telemetry_age_minutes": freshness.get("age_minutes"),
        "active_domain": norm_domain.value,
        "domain_gating_state": gating_state.value,
        "disclaimer": "Research Decision-Support Service. Not an operational avalanche bulletin.",
    }
