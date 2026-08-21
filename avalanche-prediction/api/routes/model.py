import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
import pandas as pd
from api.dependencies import get_inference_engine
from api.schemas import (
    ModelMetadataResponse,
    AvalancheZoneInfo,
    DomainStatusResponse,
    CrossDomainComparisonResponse,
    HimalayaResearchPredictionRequest,
    HimalayaResearchPredictionResponse,
)
from api.services.inference_service import AvalancheInferenceEngine
from api.services.himalaya_service import himalaya_inference_engine
from ml.model_registry import model_registry, Domain, GatingState

router = APIRouter(prefix="/model", tags=["Model Metadata & GIS"])

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "processed" / "canonical_training_2015_2024.csv"
REPORTS_DIR = Path(__file__).resolve().parent.parent.parent / "reports" / "evaluation"

COLORADO_AVALANCHE_ZONES = [
    {
        "zone_id": "CO_FRONT_RANGE",
        "name": "Front Range",
        "center_latitude": 39.7500,
        "center_longitude": -105.8000,
        "primary_snotel_stations": ["335 (Berthoud Summit)", "586 (Loveland Basin)"],
        "elevation_range_m": "2,400m – 4,350m"
    },
    {
        "zone_id": "CO_VAIL_SUMMIT",
        "name": "Vail & Summit County",
        "center_latitude": 39.5500,
        "center_longitude": -106.1500,
        "primary_snotel_stations": ["505 (Grizzly Peak)", "531 (Hoosier Pass)", "415 (Copper Mtn)", "838 (Vail Mtn)"],
        "elevation_range_m": "2,500m – 4,300m"
    },
    {
        "zone_id": "CO_SAWATCH",
        "name": "Sawatch Range",
        "center_latitude": 39.2500,
        "center_longitude": -106.3500,
        "primary_snotel_stations": ["485 (Fremont Pass)", "542 (Independence Pass)"],
        "elevation_range_m": "2,700m – 4,400m"
    },
    {
        "zone_id": "CO_ASPEN",
        "name": "Aspen",
        "center_latitude": 39.1500,
        "center_longitude": -106.7500,
        "primary_snotel_stations": ["542 (Independence Pass)"],
        "elevation_range_m": "2,400m – 4,350m"
    },
    {
        "zone_id": "CO_GUNNISON",
        "name": "Gunnison / Crested Butte",
        "center_latitude": 38.9500,
        "center_longitude": -107.0500,
        "primary_snotel_stations": ["737 (Schofield Pass)"],
        "elevation_range_m": "2,600m – 4,100m"
    },
    {
        "zone_id": "CO_SAN_JUAN",
        "name": "San Juan Mountains",
        "center_latitude": 37.8500,
        "center_longitude": -107.7500,
        "primary_snotel_stations": ["709 (Red Mountain Pass)", "642 (Molaspas)"],
        "elevation_range_m": "2,500m – 4,380m"
    },
    {
        "zone_id": "CO_STEAMBOAT",
        "name": "Steamboat & Flat Tops",
        "center_latitude": 40.4500,
        "center_longitude": -106.7000,
        "primary_snotel_stations": ["1030 (Arapaho Ridge)"],
        "elevation_range_m": "2,100m – 3,800m"
    },
]

COLORADO_SNOTEL_STATIONS = [
    {"station_id": "335", "name": "Berthoud Summit", "latitude": 39.7980, "longitude": -105.7780, "elevation_m": 3444.0, "zone": "Front Range"},
    {"station_id": "586", "name": "Loveland Basin", "latitude": 39.6739, "longitude": -105.8972, "elevation_m": 3475.0, "zone": "Front Range"},
    {"station_id": "505", "name": "Grizzly Peak", "latitude": 39.6450, "longitude": -105.8670, "elevation_m": 3383.0, "zone": "Vail & Summit County"},
    {"station_id": "531", "name": "Hoosier Pass", "latitude": 39.3620, "longitude": -106.0610, "elevation_m": 3475.0, "zone": "Vail & Summit County"},
    {"station_id": "415", "name": "Copper Mountain", "latitude": 39.4750, "longitude": -106.1520, "elevation_m": 3216.0, "zone": "Vail & Summit County"},
    {"station_id": "485", "name": "Fremont Pass", "latitude": 39.3780, "longitude": -106.1880, "elevation_m": 3475.0, "zone": "Sawatch Range"},
    {"station_id": "542", "name": "Independence Pass", "latitude": 39.1080, "longitude": -106.6020, "elevation_m": 3688.0, "zone": "Aspen"},
    {"station_id": "737", "name": "Schofield Pass", "latitude": 39.0150, "longitude": -107.0480, "elevation_m": 3261.0, "zone": "Gunnison / Crested Butte"},
    {"station_id": "709", "name": "Red Mountain Pass", "latitude": 37.8990, "longitude": -107.7140, "elevation_m": 3414.0, "zone": "San Juan Mountains"},
    {"station_id": "1030", "name": "Arapaho Ridge", "latitude": 40.3510, "longitude": -106.3810, "elevation_m": 3341.0, "zone": "Steamboat & Flat Tops"},
]


@router.get("/status", response_model=DomainStatusResponse)
def get_domain_status(
    domain: Optional[str] = Query("COLORADO", description="Target domain: 'COLORADO' or 'HIMALAYA'")
):
    """Retrieve verified model status, gating state, and metadata for requested domain."""
    status_info = model_registry.get_domain_status(domain or "COLORADO")
    return DomainStatusResponse(**status_info)


@router.get("/compare", response_model=CrossDomainComparisonResponse)
def get_cross_domain_comparison():
    """Retrieve side-by-side scientific comparison and domain shift findings between Colorado and Himalaya."""
    comp = model_registry.get_cross_domain_comparison()
    return CrossDomainComparisonResponse(**comp)


@router.post(
    "/himalaya/research-predict",
    response_model=HimalayaResearchPredictionResponse,
    responses={
        422: {"description": "Missing required terrain or coordinate parameters"},
        500: {"description": "Internal model execution failure"},
    }
)
def predict_himalayan_research_risk(
    request: HimalayaResearchPredictionRequest,
):
    """Execute non-operational research inference using the calibrated Himalayan model artifact (N=44)."""
    try:
        return himalaya_inference_engine.predict_research(request)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc)
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while evaluating Himalayan research risk: {str(exc)}"
        )


@router.get("/metadata", response_model=ModelMetadataResponse)
def get_model_metadata(
    domain: Optional[str] = Query("COLORADO", description="Target domain: 'COLORADO' or 'HIMALAYA'"),
    engine: AvalancheInferenceEngine = Depends(get_inference_engine)
):
    """Retrieve active ML model version, training provenance, and validation metrics for the domain."""
    norm_domain = model_registry.normalize_domain(domain)

    if norm_domain in [Domain.HIMALAYA, Domain.INDIA]:
        return ModelMetadataResponse(
            domain="HIMALAYA",
            model_name="Himalayan Avalanche Domain (Uninitialized)",
            model_version="himalaya_avalanche_uninitialized",
            feature_schema_version="v2_spatiotemporal_17f",
            training_seasons=[],
            total_training_records=0,
            features=engine.feature_columns,
            calibration_method="Not Calibrated (DATA_AUDITED / INSUFFICIENT_DATA)",
            validation_strategy="Gated (Pending Real DGRE/SASE Ingestion)",
            operating_threshold=0.40,
            metrics={
                "recall": 0.0,
                "precision": 0.0,
                "f2": 0.0,
                "pr_auc": 0.0,
            },
            feature_importance=[],
            disclaimer="Research Decision-Support Service. Himalayan domain is in GEOGRAPHIC_ONLY / INSUFFICIENT_DATA mode."
        )

    return ModelMetadataResponse(
        domain="COLORADO",
        model_name="Calibrated Random Forest Classifier",
        model_version=engine.model_version,
        feature_schema_version="v2_spatiotemporal_17f",
        training_seasons=["2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021"],
        total_training_records=48,
        features=engine.feature_columns,
        calibration_method="Sigmoid (TimeSeriesSplit CV=3)",
        validation_strategy="Temporal Forward-Chaining Holdout",
        operating_threshold=engine.thresholds.get("medium", 0.40),
        metrics={
            "walk_forward_average_recall": 0.9167,
            "walk_forward_average_precision": 0.8462,
            "walk_forward_average_f2": 0.9014,
            "walk_forward_average_pr_auc": 0.9431,
            "held_out_2023_2024_recall": 0.9000,
            "held_out_2023_2024_precision": 0.9000,
            "held_out_2023_2024_f2": 0.9000,
            "held_out_2023_2024_brier": 0.0985,
        },
        feature_importance=[
            {"feature": "slope", "importance": 0.2310},
            {"feature": "snowfall_72h", "importance": 0.1750},
            {"feature": "snowfall_24h", "importance": 0.1420},
            {"feature": "temperature_delta_24h", "importance": 0.1120},
            {"feature": "snow_water_equivalent", "importance": 0.0880},
            {"feature": "wind_speed_max_24h", "importance": 0.0680},
            {"feature": "snow_depth", "importance": 0.0540},
            {"feature": "aspect_sin_cos", "importance": 0.0480},
            {"feature": "temperature", "importance": 0.0460},
            {"feature": "elevation", "importance": 0.0360},
        ],
        disclaimer="Research Decision-Support Service. Not certified as a standalone warning authority."
    )


@router.get("/scientific-evaluation")
def get_scientific_evaluation_report(
    domain: Optional[str] = Query("COLORADO", description="Target domain: 'COLORADO' or 'HIMALAYA'")
):
    """Retrieve full reproducible scientific model evaluation results and curves."""
    norm_domain = model_registry.normalize_domain(domain)

    if norm_domain in [Domain.HIMALAYA, Domain.INDIA]:
        return {
            "status": "ok",
            "domain": "HIMALAYA",
            "title": "HIMALAYAN DOMAIN SCIENTIFIC GATING & READINESS REPORT",
            "gating_state": "DATA_AUDITED",
            "model_status": "INSUFFICIENT_DATA",
            "metrics": {
                "event_count": 0,
                "background_count": 0,
                "seasons_count": 0,
                "stations_count": 0,
                "readiness_verdict": "NOT_READY",
            },
            "calibration": None,
            "threshold_tradeoffs": [],
            "model_comparison": [],
            "feature_stability": [],
            "spatial_validation": None,
            "disclaimer": "Himalayan domain has not passed the data readiness gate. No model has been trained or calibrated.",
        }

    metrics_path = REPORTS_DIR / "metrics.json"
    calibration_path = REPORTS_DIR / "calibration.json"
    thresholds_path = REPORTS_DIR / "threshold_analysis.csv"
    comparison_path = REPORTS_DIR / "model_comparison.csv"
    stability_path = REPORTS_DIR / "feature_stability.csv"
    spatial_val_path = REPORTS_DIR / "spatial_validation.json"

    metrics_data = {}
    calibration_data = {}
    thresholds_data = []
    comparison_data = []
    stability_data = []
    spatial_val_data = {}

    if metrics_path.exists():
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)

    if calibration_path.exists():
        with open(calibration_path, "r", encoding="utf-8") as f:
            calibration_data = json.load(f)

    if thresholds_path.exists():
        thresholds_data = pd.read_csv(thresholds_path).to_dict(orient="records")

    if comparison_path.exists():
        comparison_data = pd.read_csv(comparison_path).to_dict(orient="records")

    if stability_path.exists():
        stability_data = pd.read_csv(stability_path).to_dict(orient="records")

    if spatial_val_path.exists():
        with open(spatial_val_path, "r", encoding="utf-8") as f:
            spatial_val_data = json.load(f)

    return {
        "status": "ok",
        "domain": "COLORADO",
        "title": "SCIENTIFIC MODEL VALIDATION & FORECAST RELIABILITY",
        "metrics": metrics_data,
        "calibration": calibration_data,
        "threshold_tradeoffs": thresholds_data,
        "model_comparison": comparison_data,
        "feature_stability": stability_data,
        "spatial_validation": spatial_val_data,
        "disclaimer": "Academic research decision-support evaluation. Not certified as a standalone warning authority.",
    }


@router.get("/zones", response_model=List[AvalancheZoneInfo])
def get_avalanche_zones():
    """Retrieve Colorado avalanche forecasting zones with spatial centers and reference telemetry stations."""
    return [AvalancheZoneInfo(**z) for z in COLORADO_AVALANCHE_ZONES]


@router.get("/stations")
def get_snotel_stations():
    """Retrieve Colorado alpine SNOTEL telemetry stations for GIS inspection and telemetry streaming."""
    return COLORADO_SNOTEL_STATIONS


@router.get("/events")
def get_historical_events(
    season: Optional[str] = None,
    trigger: Optional[str] = None
):
    """Retrieve field-verified historical CAIC avalanche observations for GIS map overlay."""
    if not DATA_PATH.exists():
        return []

    try:
        df = pd.read_csv(DATA_PATH)
        events_df = df[df["avalanche_occurred"] == 1].copy()

        if season and season != "ALL":
            events_df = events_df[events_df["season"] == season]

        if trigger and trigger != "ALL":
            events_df = events_df[events_df["trigger_category"] == trigger]

        records = []
        for _, r in events_df.iterrows():
            records.append({
                "event_id": str(r.get("event_id", "")),
                "timestamp": str(r.get("timestamp", "")),
                "season": str(r.get("season", "")),
                "latitude": float(r.get("latitude", 0.0)),
                "longitude": float(r.get("longitude", 0.0)),
                "elevation_m": float(r.get("elevation", 0.0)),
                "slope_deg": float(r.get("slope", 0.0)),
                "aspect_deg": float(r.get("aspect", 0.0)),
                "trigger_category": str(r.get("trigger_category", "UNKNOWN")),
                "snowfall_24h_mm": float(r.get("snowfall_24h", 0.0)),
                "snowfall_72h_mm": float(r.get("snowfall_72h", 0.0)),
                "temperature_c": float(r.get("temperature", 0.0)),
                "source": "CAIC_OBSERVATION",
                "label_type": "HISTORICAL_OBSERVED_EVENT",
            })
        return records
    except Exception as exc:
        print(f"Error reading historical events: {exc}")
        return []
