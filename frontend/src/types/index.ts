export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';
export type DataQuality = 'GOOD' | 'DEGRADED' | 'STALE' | 'INSUFFICIENT';
export type SpatialQuality = 'EXCELLENT' | 'GOOD' | 'DEGRADED' | 'INSUFFICIENT';

export interface RiskPredictionResponse {
  model_risk_score: number | null;
  final_risk_score: number | null;
  model_risk_level: RiskLevel;
  final_risk_level: RiskLevel;
  risk_level: RiskLevel;
  risk_escalated: boolean;
  risk_escalation_reasons: string[];
  data_quality: DataQuality;
  warnings: string[];
  raw_probability: number | null;
  calibrated_probability: number | null;
  model_version: string;
  operating_threshold: number;
  thresholds: {
    medium: number;
    high: number;
  };
  provenance: Record<string, unknown>;
  disclaimer: string;
}

export interface PointPredictionPayload {
  latitude: number;
  longitude: number;
  elevation?: number;
  slope?: number;
  aspect?: number;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  precipitation?: number;
  snow_depth?: number;
  snow_water_equivalent?: number;
  snowfall_6h?: number;
  snowfall_24h?: number;
  snowfall_72h?: number;
  temperature_delta_24h?: number;
  temperature_delta_72h?: number;
  wind_speed_mean_24h?: number;
  wind_speed_max_24h?: number;
  location_id?: string;
}

export interface TelemetryObservation {
  timestamp: string;
  temperature?: number;
  snow_depth?: number;
  snow_water_equivalent?: number;
  precipitation?: number;
  wind_speed?: number;
}

export interface StationTelemetryBatchRequest {
  station_id: string;
  station_name?: string;
  latitude: number;
  longitude: number;
  elevation: number;
  default_slope?: number;
  default_aspect?: number;
  target_timestamp?: string;
  observations: TelemetryObservation[];
}

export interface SelectedLocationState {
  type: 'COORDINATE' | 'ZONE' | 'STATION';
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  slope: number;
  aspect: number;
  temperature: number;
  snow_depth: number;
  snow_water_equivalent: number;
  snowfall_6h: number;
  snowfall_24h: number;
  snowfall_72h: number;
  temperature_delta_24h: number;
  wind_speed_mean_24h: number;
  wind_speed_max_24h: number;
  telemetry_age_minutes?: number;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  subsystems?: Record<string, string>;
  model_loaded: boolean;
  model_version: string;
  feature_schema_version: string;
  calibrated: boolean;
  active_operating_threshold: number;
  thresholds: { medium: number; high: number };
  schema_status: string;
  telemetry_age_minutes?: number;
  disclaimer: string;
}

export interface TelemetryFreshnessStatus {
  overall_status: DataQuality;
  last_update: string;
  age_minutes: number;
  stations_total: number;
  stations_healthy: number;
  stations_degraded: number;
  stations_stale: number;
  warnings: string[];
}

export interface AvalancheZone {
  zone_id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  elevation_range_m: string;
  primary_snotel_stations: string[];
}

export interface SnotelStation {
  station_id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  elevation_m?: number;
  zone_id: string;
}

export interface HistoricalEvent {
  event_id: string;
  date: string;
  location: string;
  latitude: number;
  longitude: number;
  avalanche_type: string;
  trigger_category: string;
  d_size?: string;
}

export interface PersistedPredictionRecord {
  prediction_id: string;
  station_id: string;
  zone_id: string;
  timestamp: string;
  evaluation_timestamp: string;
  model_version: string;
  dataset_version: string;
  feature_schema_version: string;
  risk_engine_version: string;
  raw_probability: number | null;
  calibrated_probability: number | null;
  model_risk_score: number | null;
  final_risk_score: number | null;
  model_risk_level: RiskLevel;
  final_risk_level: RiskLevel;
  risk_escalated: boolean;
  risk_escalation_reasons: string[];
  data_quality: DataQuality;
  warnings: string[];
}

export interface ModelMetadata {
  model_name: string;
  model_version: string;
  feature_schema_version: string;
  training_seasons: string[];
  total_training_records: number;
  features: string[];
  calibration_method: string;
  validation_strategy: string;
  operating_threshold: number;
  metrics: {
    walk_forward_average_recall: number;
    walk_forward_average_precision: number;
    walk_forward_average_f2: number;
    walk_forward_average_pr_auc: number;
    held_out_2023_2024_recall: number;
    held_out_2023_2024_precision: number;
    held_out_2023_2024_f2: number;
    held_out_2023_2024_brier: number;
  };
  feature_importance: Array<{ feature: string; importance: number }>;
  disclaimer: string;
}

// =====================================================================
// Phase 5: Spatial Intelligence Types
// =====================================================================

export interface SpatialGridPoint {
  latitude: number;
  longitude: number;
  elevation: number;
  slope: number;
  aspect: number;
  temperature: number | null;
  snowfall_24h: number | null;
  snowfall_72h: number | null;
  snow_water_equivalent: number | null;
  raw_probability: number | null;
  calibrated_probability: number | null;
  model_risk_score: number | null;
  final_risk_score: number | null;
  model_risk_level: RiskLevel;
  final_risk_level: RiskLevel;
  risk_escalated: boolean;
  risk_escalation_reasons: string[];
  spatial_quality: SpatialQuality;
  nearest_station_distance_km: number | null;
  station_count: number;
  stations_used: string[];
  spatial_warning: string | null;
}

export interface SpatialPredictionGridResponse {
  title: string;
  bounds: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
  };
  grid_points_count: number;
  timestamp: string;
  model_version: string;
  dataset_version: string;
  feature_schema_version: string;
  risk_engine_version: string;
  spatial_method: string;
  spatial_method_version: string;
  points: SpatialGridPoint[];
  summary: {
    total_points: number;
    high_risk_points: number;
    medium_risk_points: number;
    low_risk_points: number;
    high_risk_fraction: number;
  };
  disclaimer: string;
}

export interface ZoneRiskSummary {
  zone_id: string;
  zone_name: string;
  timestamp: string;
  zone_risk_level: RiskLevel;
  zone_median_risk_score: number;
  zone_max_risk_score: number;
  zone_high_risk_fraction: number;
  spatial_quality: SpatialQuality;
  station_count: number;
  primary_drivers: string[];
  method: string;
  model_version: string;
}

export interface SpatialValidationMetrics {
  title: string;
  method: string;
  validation_strategy: string;
  temporal_filter: string;
  power: number;
  search_radius_km: number;
  variables: {
    temperature: { mae: number | null; rmse: number | null; bias: number | null; n_stations_evaluated: number };
    snowfall_24h: { mae: number | null; rmse: number | null; bias: number | null; n_stations_evaluated: number };
    snow_water_equivalent: { mae: number | null; rmse: number | null; bias: number | null; n_stations_evaluated: number };
  };
  disclaimer: string;
}

export interface LayerVisibilityState {
  historicalEvents: boolean;
  snotelStations: boolean;
  forecastZones: boolean;
  highResTerrain: boolean;
  contours20m: boolean;
  contours50m: boolean;
  contours100m: boolean;
  riskSurface: boolean;
}

// =====================================================================
// Phase 6: Scientific Model Validation & Reliability Types
// =====================================================================

export interface ThresholdTradeoffRow {
  threshold: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  recall: number;
  precision: number;
  f1: number;
  f2: number;
  fnr: number;
  fpr: number;
  specificity: number;
  missed_events_count: number;
  false_alarms_count: number;
}

export interface ModelComparisonRow {
  model_name: string;
  recall: number | null;
  precision: number | null;
  f1: number | null;
  f2: number | null;
  pr_auc: number | null;
  roc_auc: number | null;
  brier_score: number | null;
  ece: number | null;
  status: string;
}

export interface FeatureStabilityRow {
  feature: string;
  mean_importance: number;
  std_importance: number;
  mean_rank: number;
  rank_std: number;
  stability_status: string;
  semantic_label: string;
}

export interface ScientificEvaluationReport {
  status: string;
  title: string;
  metrics: {
    dataset: {
      total_records: number;
      positive_events: number;
      background_controls: number;
      positive_rate: number;
      seasons: string[];
    };
    temporal_holdout_2023_2024: {
      recall: number;
      precision: number;
      f1: number;
      f2: number;
      specificity: number;
      fnr: number;
      fpr: number;
      pr_auc: number;
      roc_auc: number;
      brier_score: number;
    };
    walk_forward_cross_validation: {
      recall: number;
      precision: number;
      f1: number;
      f2: number;
      pr_auc: number;
      roc_auc: number;
      brier_score: number;
    };
    spatial_generalization: {
      seen_locations: { recall: number; precision: number; f2: number; pr_auc: number; brier_score: number };
      unseen_locations: { recall: number; precision: number; f2: number; pr_auc: number; brier_score: number };
      spatial_dropoff_recall: number;
    };
    joint_spatiotemporal_holdout: {
      recall: number;
      precision: number;
      f2: number;
      pr_auc: number;
      brier_score: number;
      conditions_satisfied: string[];
    };
  };
  calibration: {
    uncalibrated: { brier_score: number; ece: number; calibration_curve: Array<{ mean_predicted: number; fraction_positives: number }> };
    calibrated: { brier_score: number; ece: number; calibration_curve: Array<{ mean_predicted: number; fraction_positives: number }> };
    brier_improvement: number;
    calibration_improves_reliability: boolean;
  };
  threshold_tradeoffs: ThresholdTradeoffRow[];
  model_comparison: ModelComparisonRow[];
  feature_stability: FeatureStabilityRow[];
  spatial_validation: SpatialValidationMetrics;
  disclaimer: string;
}

export type GeographicDomain = 'COLORADO' | 'INDIA';

export interface DataProvenance {
  data_source?: string;
  source?: string;
  source_url?: string;
  retrieved_at?: string;
  resolution?: string;
  crs?: string;
  disclaimer?: string;
}

export interface IndianPeak {
  id: string;
  name: string;
  country: string;
  state: string;
  region: string;
  mountain_range: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  type: string;
  data_source: string;
  terrain_source: string;
  verified: boolean;
  risk_capability: 'GEOGRAPHIC_ONLY';
}

export interface IndianPeaksResponse {
  provenance: DataProvenance;
  count: number;
  peaks: IndianPeak[];
}

export interface IndianRegion {
  id: string;
  name: string;
  state: string;
  center_latitude: number;
  center_longitude: number;
  bounds: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
  };
  peak_count: number;
}

export interface IndianRegionsResponse {
  provenance: DataProvenance;
  count: number;
  regions: IndianRegion[];
}

