"""Pydantic Request & Response Schemas for Avalanche Risk Intelligence API."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GeographicDomain(str, Enum):
    COLORADO = "COLORADO"
    HIMALAYA = "HIMALAYA"
    INDIA = "INDIA"
    NEPAL = "NEPAL"
    BHUTAN = "BHUTAN"
    PAKISTAN = "PAKISTAN"


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall service status ('ok', 'degraded', 'error')")
    service: str = Field("avalanche-risk-intelligence-api", description="Service identifier")
    version: str = Field("2.0.0-research", description="Service semantic version")
    subsystems: Optional[Dict[str, str]] = Field(None, description="Subsystem health status map")
    model_loaded: bool = Field(..., description="True if trained ML artifact is loaded into memory")
    model_version: Optional[str] = Field(None, description="Trained model version identifier")
    feature_schema_version: Optional[str] = Field(None, description="Feature contract schema version")
    calibrated: bool = Field(..., description="True if calibrated probabilities are active")
    active_operating_threshold: float = Field(..., description="Operating threshold for medium/high risk classification")
    thresholds: Dict[str, float] = Field(..., description="Risk tier thresholds")
    schema_status: str = Field(..., description="Feature schema alignment status ('SYNCHRONIZED', 'SCHEMA_WARNING')")
    telemetry_age_minutes: Optional[int] = Field(None, description="Age of most recent telemetry observation in minutes")
    active_domain: Optional[str] = Field("COLORADO", description="Active queried geographic domain")
    domain_gating_state: Optional[str] = Field("MODEL_ENABLED", description="Active domain model gating state")
    disclaimer: str = Field(..., description="Operational non-autonomous research disclaimer")


class PointPredictionRequest(BaseModel):
    domain: Optional[str] = Field("COLORADO", description="Target domain: 'COLORADO' or 'HIMALAYA'")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    elevation: Optional[float] = Field(3400.0, ge=0.0, le=9000.0, description="Elevation in meters")
    slope: Optional[float] = Field(None, ge=0.0, le=90.0, description="Incline slope angle in degrees")
    aspect: Optional[float] = Field(None, ge=0.0, le=360.0, description="Terrain aspect in degrees (0-360, 0=North)")
    temperature: Optional[float] = Field(None, ge=-80.0, le=60.0, description="Air temperature in °C")
    humidity: Optional[float] = Field(70.0, ge=0.0, le=100.0, description="Relative humidity %")
    pressure: Optional[float] = Field(670.0, ge=300.0, le=1100.0, description="Atmospheric pressure in hPa")
    precipitation: Optional[float] = Field(0.0, ge=0.0, le=500.0, description="Liquid precipitation in mm")
    snow_depth: Optional[float] = Field(None, ge=0.0, le=2000.0, description="Snow depth in cm")
    snow_water_equivalent: Optional[float] = Field(None, ge=0.0, le=5000.0, description="SWE in mm")
    snowfall_6h: Optional[float] = Field(0.0, ge=0.0, le=500.0, description="Snowfall accumulation past 6 hours in mm")
    snowfall_24h: Optional[float] = Field(0.0, ge=0.0, le=1000.0, description="Snowfall accumulation past 24 hours in mm")
    snowfall_72h: Optional[float] = Field(0.0, ge=0.0, le=2000.0, description="Snowfall accumulation past 72 hours in mm")
    temperature_delta_24h: Optional[float] = Field(0.0, ge=-50.0, le=50.0, description="24h temperature change in °C")
    temperature_delta_72h: Optional[float] = Field(0.0, ge=-50.0, le=50.0, description="72h temperature change in °C")
    wind_speed_mean_24h: Optional[float] = Field(0.0, ge=0.0, le=300.0, description="24h mean wind speed in km/h")
    wind_speed_max_24h: Optional[float] = Field(0.0, ge=0.0, le=400.0, description="24h max wind gust in km/h")
    location_id: Optional[str] = Field("POINT_QUERY", description="Optional identifier for target location")


class BatchPointPredictionRequest(BaseModel):
    points: List[PointPredictionRequest] = Field(..., min_length=1, max_length=500, description="Batch list of mountain coordinate points")


class BatchPointPredictionItem(BaseModel):
    index: int
    location_id: Optional[str] = None
    latitude: float
    longitude: float
    prediction: Optional[RiskPredictionResponse] = None
    error: Optional[str] = None


class BatchPointPredictionResponse(BaseModel):
    total: int
    successful: int
    failed: int
    results: List[BatchPointPredictionItem] = Field(..., description="Batch prediction results per coordinate point")


class TelemetryObservation(BaseModel):
    timestamp: str = Field(..., description="Observation timestamp in ISO-8601 format (UTC)")
    temperature: Optional[float] = Field(None, ge=-80.0, le=60.0, description="Air temperature in °C")
    snow_depth: Optional[float] = Field(None, ge=0.0, le=2000.0, description="Snow depth in cm")
    snow_water_equivalent: Optional[float] = Field(None, ge=0.0, le=5000.0, description="SWE in mm")
    precipitation: Optional[float] = Field(None, ge=0.0, le=500.0, description="Incremental liquid precipitation in mm")
    wind_speed: Optional[float] = Field(None, ge=0.0, le=400.0, description="Wind speed in km/h")


class StationTelemetryBatchRequest(BaseModel):
    domain: Optional[str] = Field("COLORADO", description="Target domain: 'COLORADO' or 'HIMALAYA'")
    station_id: str = Field(..., description="SNOTEL or weather station ID")
    station_name: Optional[str] = Field(None, description="Station name")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Station latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Station longitude")
    elevation: float = Field(..., ge=0.0, le=9000.0, description="Station elevation in meters")
    default_slope: Optional[float] = Field(36.0, ge=0.0, le=90.0, description="Avalanche starting zone slope in degrees")
    default_aspect: Optional[float] = Field(45.0, ge=0.0, le=360.0, description="Starting zone aspect in degrees")
    target_timestamp: Optional[str] = Field(None, description="Optional target assessment timestamp; observations strictly after this will be ignored to prevent future leakage")
    observations: List[TelemetryObservation] = Field(
        ..., min_length=1, description="Time-series observations up to current/target timestamp"
    )


class RiskPredictionResponse(BaseModel):
    domain: Optional[str] = Field("COLORADO", description="Target geographic domain")
    model_risk_score: Optional[float] = Field(None, description="Raw ML-derived risk score (0-100) before policy rules")
    final_risk_score: Optional[float] = Field(None, description="Final risk score (0-100) after deterministic policy rules")
    model_risk_level: str = Field(..., description="ML classification: 'LOW', 'MEDIUM', 'HIGH', or 'INSUFFICIENT_DATA'")
    final_risk_level: str = Field(..., description="Final policy level: 'LOW', 'MEDIUM', 'HIGH', or 'INSUFFICIENT_DATA'")
    risk_level: str = Field(..., description="Alias for final_risk_level")
    risk_escalated: bool = Field(False, description="True if a deterministic safety rule escalated the risk level above the ML level")
    risk_escalation_reasons: List[str] = Field(default_factory=list, description="Descriptions of any deterministic engineering rules triggered")
    data_quality: str = Field(..., description="'GOOD', 'DEGRADED', or 'INSUFFICIENT'")
    warnings: List[str] = Field(default_factory=list, description="Quality warnings, missing field notices, or escalation tags")
    raw_probability: Optional[float] = Field(None, description="Uncalibrated probability from base Random Forest estimator (if accessible)")
    calibrated_probability: Optional[float] = Field(None, description="Probability calibrated via TimeSeriesSplit")
    model_version: str = Field(..., description="Model artifact training version")
    operating_threshold: float = Field(0.40, description="Operational medium/high boundary threshold")
    thresholds: Dict[str, float] = Field(default_factory=lambda: {"medium": 0.40, "high": 0.70}, description="Configured thresholds for risk level boundaries")
    rule_evaluations: List[Dict[str, Any]] = Field(default_factory=list, description="Evaluated deterministic engineering safety rules")
    features: Optional[Dict[str, Any]] = Field(default=None, description="Actual physical and terrain features evaluated")
    provenance: Dict[str, Any] = Field(default_factory=dict, description="Metadata trace including sources and calibration info")
    disclaimer: str = Field(
        "Decision-support research prototype. Not an official avalanche bulletin. Use official regional forecasts for travel safety.",
        description="Public safety non-autonomous research notice"
    )


class ModelMetadataResponse(BaseModel):
    domain: str = "COLORADO"
    model_name: str
    model_version: str
    feature_schema_version: str
    training_seasons: List[str]
    total_training_records: int
    features: List[str]
    calibration_method: str
    validation_strategy: str
    operating_threshold: float
    metrics: Dict[str, float]
    feature_importance: List[Dict[str, Any]]
    disclaimer: str


class AvalancheZoneInfo(BaseModel):
    zone_id: str
    name: str
    center_latitude: float
    center_longitude: float
    elevation_range_m: str
    primary_snotel_stations: List[str]


class SpatialPredictionRequest(BaseModel):
    domain: Optional[str] = Field("COLORADO", description="Target domain: 'COLORADO' or 'HIMALAYA'")
    min_latitude: float = Field(..., ge=-90.0, le=90.0, description="Bounding box minimum latitude")
    max_latitude: float = Field(..., ge=-90.0, le=90.0, description="Bounding box maximum latitude")
    min_longitude: float = Field(..., ge=-180.0, le=180.0, description="Bounding box minimum longitude")
    max_longitude: float = Field(..., ge=-180.0, le=180.0, description="Bounding box maximum longitude")
    grid_spacing_degrees: Optional[float] = Field(0.04, ge=0.02, le=0.5, description="Grid interval in degrees")
    target_timestamp: Optional[str] = Field(None, description="Assessment target timestamp (UTC ISO-8601)")
    search_radius_km: Optional[float] = Field(None, ge=5.0, le=120.0, description="IDW search radius in km (defaults by domain)")
    power: Optional[float] = Field(2.0, ge=1.0, le=4.0, description="IDW distance power exponent")
    interpolation_method: Optional[str] = Field("IDW", description="Spatial interpolation method ('IDW')")


class SpatialGridPoint(BaseModel):
    latitude: float
    longitude: float
    elevation: float
    slope: float
    aspect: float
    temperature: Optional[float]
    snowfall_24h: Optional[float]
    snowfall_72h: Optional[float]
    snow_water_equivalent: Optional[float]
    raw_probability: Optional[float]
    calibrated_probability: Optional[float]
    model_risk_score: Optional[float]
    final_risk_score: Optional[float]
    model_risk_level: str
    final_risk_level: str
    risk_escalated: bool
    risk_escalation_reasons: List[str]
    spatial_quality: str
    nearest_station_distance_km: Optional[float]
    station_count: int
    stations_used: List[str]
    spatial_warning: Optional[str]


class SpatialPredictionGridResponse(BaseModel):
    title: str = "RESEARCH RISK SURFACE"
    domain: str = "COLORADO"
    bounds: Dict[str, float]
    grid_points_count: int
    timestamp: str
    model_version: str
    dataset_version: str
    feature_schema_version: str
    risk_engine_version: str
    spatial_method: str
    spatial_method_version: str
    points: List[SpatialGridPoint]
    summary: Dict[str, Any]
    disclaimer: str = (
        "Interpolated/model-derived research visualization — not an official avalanche forecast. "
        "Use official regional avalanche bulletins for all travel decisions."
    )


class ZoneRiskSummary(BaseModel):
    zone_id: str
    zone_name: str
    domain: Optional[str] = "COLORADO"
    timestamp: str
    zone_risk_level: str
    zone_median_risk_score: float
    zone_max_risk_score: float
    zone_high_risk_fraction: float
    spatial_quality: str
    station_count: int
    primary_drivers: List[str]
    method: str
    model_version: str
    disclaimer: str = "Research decision-support zone evaluation."


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message description")
    code: int = Field(..., description="HTTP status code")
    detail: Optional[str] = Field(None, description="Additional context or validation details")


class DataProvenanceSchema(BaseModel):
    data_source: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    retrieved_at: Optional[str] = None
    resolution: Optional[str] = None
    crs: Optional[str] = None
    disclaimer: Optional[str] = None


class IndianPeakRecord(BaseModel):
    id: str
    name: str
    country: str
    state: str
    region: str
    mountain_range: str
    latitude: float
    longitude: float
    elevation_m: float
    type: str
    data_source: str
    terrain_source: str
    verified: bool
    risk_capability: str = "GEOGRAPHIC_ONLY"


class IndianPeaksResponse(BaseModel):
    provenance: DataProvenanceSchema
    count: int
    peaks: List[IndianPeakRecord]


class IndianRegionBounds(BaseModel):
    min_latitude: float
    max_latitude: float
    min_longitude: float
    max_longitude: float


class IndianRegionRecord(BaseModel):
    id: str
    name: str
    state: str
    center_latitude: float
    center_longitude: float
    bounds: IndianRegionBounds
    peak_count: int


class IndianRegionsResponse(BaseModel):
    provenance: DataProvenanceSchema
    count: int
    regions: List[IndianRegionRecord]


class DomainStatusResponse(BaseModel):
    domain: str
    display_name: str
    gating_state: str
    model_loaded: bool
    model_status: str
    model_version: str
    dataset_version: str
    feature_schema_version: str
    calibration_status: str
    operating_threshold: float
    thresholds: Dict[str, float]
    disclaimer: str


class CrossDomainComparisonResponse(BaseModel):
    comparison_title: str
    scientific_disclaimer: str
    domains: Dict[str, DomainStatusResponse]
    metrics_table: List[Dict[str, Any]]
    domain_shift_experiment: Dict[str, Any]


class HimalayaResearchPredictionRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    elevation: float = Field(..., ge=0.0, le=9000.0, description="Elevation in meters")
    slope: float = Field(..., ge=0.0, le=90.0, description="Slope incline angle in degrees")
    aspect: Optional[float] = Field(None, ge=0.0, le=360.0, description="Aspect in degrees (0-360, 0=North)")
    temperature: Optional[float] = Field(None, ge=-80.0, le=60.0, description="Air temperature in °C")
    humidity: Optional[float] = Field(None, ge=0.0, le=100.0, description="Relative humidity %")
    pressure: Optional[float] = Field(None, ge=300.0, le=1100.0, description="Atmospheric pressure in hPa")
    precipitation: Optional[float] = Field(None, ge=0.0, le=500.0, description="Liquid precipitation in mm")
    snow_depth: Optional[float] = Field(None, ge=0.0, le=2000.0, description="Snow depth in cm")
    snow_water_equivalent: Optional[float] = Field(None, ge=0.0, le=5000.0, description="SWE in mm")
    snowfall_6h: Optional[float] = Field(0.0, ge=0.0, le=500.0, description="6h snowfall in mm")
    snowfall_24h: Optional[float] = Field(None, ge=0.0, le=1000.0, description="24h snowfall in mm")
    snowfall_72h: Optional[float] = Field(None, ge=0.0, le=2000.0, description="72h snowfall in mm")
    temperature_delta_24h: Optional[float] = Field(0.0, ge=-50.0, le=50.0, description="24h temp delta in °C")
    temperature_delta_72h: Optional[float] = Field(None, ge=-50.0, le=50.0, description="72h temp delta in °C")
    wind_speed_mean_24h: Optional[float] = Field(None, ge=0.0, le=300.0, description="24h mean wind speed in km/h")
    wind_speed_max_24h: Optional[float] = Field(None, ge=0.0, le=400.0, description="24h max wind speed in km/h")
    location_id: Optional[str] = Field("HIMALAYAN_TARGET", description="Location name or identifier")
    source: Optional[str] = Field("CUSTOM_CSV", description="Data source identifier")


class HimalayaResearchPredictionResponse(BaseModel):
    domain: str = Field("HIMALAYA", description="Geographic domain")
    mode: str = Field("RESEARCH", description="Inference mode: 'RESEARCH' or 'OPERATIONAL'")
    model_state: str = Field("CALIBRATED", description="Domain scientific gating state")
    operational_enabled: bool = Field(False, description="True if certified for operational forecasting")
    research_prediction_enabled: bool = Field(True, description="True if research-mode prediction is enabled")
    risk_score: float = Field(..., description="Calibrated research risk score on 0-100 scale")
    probability: float = Field(..., description="Calibrated probability of avalanche occurrence")
    calibrated_probability: float = Field(..., description="Calibrated probability")
    raw_probability: Optional[float] = Field(None, description="Uncalibrated probability")
    risk_level: str = Field(..., description="Risk classification tier: 'LOW', 'MEDIUM', 'HIGH'")
    model_risk_level: Optional[str] = Field(None, description="Model risk level")
    final_risk_level: Optional[str] = Field(None, description="Final risk level")
    model_version: str = Field(..., description="Trained Himalayan model artifact identifier")
    source: str = Field("CUSTOM_CSV", description="Input dataset source")
    location_id: str = Field(..., description="Location name or identifier")
    latitude: float
    longitude: float
    elevation: float
    slope: float
    aspect: Optional[float] = None
    warning: str = Field(
        "RESEARCH ONLY — NOT AN OPERATIONAL AVALANCHE WARNING",
        description="Mandatory scientific safety warning"
    )
    disclaimer: str = Field(
        "This model is a research decision-support model and is not a certified avalanche warning system.",
        description="Non-autonomous research disclaimer"
    )
    operating_threshold: float = Field(0.40, description="Medium risk threshold")
    thresholds: Dict[str, float] = Field(default_factory=lambda: {"medium": 0.40, "high": 0.70})
    provenance: Dict[str, Any] = Field(default_factory=dict)

