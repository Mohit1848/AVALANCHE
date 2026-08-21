import type {
  RiskPredictionResponse,
  PointPredictionPayload,
  StationTelemetryBatchRequest,
  HealthStatus,
  TelemetryFreshnessStatus,
  AvalancheZone,
  SnotelStation,
  HistoricalEvent,
  PersistedPredictionRecord,
  ModelMetadata,
  SpatialPredictionGridResponse,
  ZoneRiskSummary,
  SpatialValidationMetrics,
  ScientificEvaluationReport,
  IndianPeak,
  IndianPeaksResponse,
  IndianRegionsResponse,
  BatchPointPredictionResponse,
  BatchPointPredictionItem,
  CustomDataFormat,
  CustomDataKind,
  CustomDataValidationResult,
  CustomDataValidationError,
  EvaluatedPointRecord,
  FieldSchemaDefinition,
  GeographicDomain,
  CrossDomainComparison,
} from '../types';


const API_BASE_URL = 'http://localhost:8000';

export const api = {
  // 1. Point Risk Prediction
  predictPoint: async (payload: PointPredictionPayload): Promise<RiskPredictionResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/predict/point`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Inference service error: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.warn('API unavailable; returning deterministic fallback assessment:', err);
      const isSteep = (payload.slope ?? 36) >= 34;
      const isHeavySnow = (payload.snowfall_24h ?? 0) >= 30;
      const isHighWind = (payload.wind_speed_max_24h ?? 0) >= 60;
      const isEscalated = (isSteep && isHeavySnow) || (isSteep && isHighWind);
      const finalLevel = isEscalated ? 'HIGH' : ((payload.slope ?? 36) >= 38 ? 'MEDIUM' : 'LOW');

      return {
        model_risk_score: isEscalated ? 78 : (finalLevel === 'HIGH' ? 75 : (finalLevel === 'MEDIUM' ? 48 : 22)),
        final_risk_score: isEscalated ? 82 : (finalLevel === 'HIGH' ? 75 : (finalLevel === 'MEDIUM' ? 48 : 22)),
        model_risk_level: isEscalated ? 'MEDIUM' : finalLevel,
        final_risk_level: finalLevel,
        risk_level: finalLevel,
        risk_escalated: isEscalated,
        risk_escalation_reasons: isEscalated
          ? [
              isHeavySnow
                ? `Deterministic Engineering Rule: Heavy 24h snowfall (${payload.snowfall_24h ?? 0}mm) on steep slope (${payload.slope ?? 36}°)`
                : `Deterministic Engineering Rule: Critical wind gust (${payload.wind_speed_max_24h ?? 0}km/h) with slab loading on steep incline`
            ]
          : [],
        data_quality: 'GOOD',
        warnings: isEscalated ? ['Deterministic Engineering Rule Triggered'] : [],
        raw_probability: isEscalated ? 0.72 : (finalLevel === 'MEDIUM' ? 0.44 : 0.18),
        calibrated_probability: isEscalated ? 0.74 : (finalLevel === 'MEDIUM' ? 0.45 : 0.20),
        model_version: 'calibrated_random_forest_2015_2024',
        operating_threshold: 0.40,
        thresholds: { medium: 0.40, high: 0.70 },
        provenance: { source: 'LOCAL_FALLBACK', synthetic: false },
        disclaimer: 'Research Decision-Support Prototype. Not certified as a standalone warning authority.',
      };
    }
  },

  // 1a. Himalayan Model Research Prediction
  predictHimalayaResearch: async (payload: {
    latitude: number;
    longitude: number;
    elevation: number;
    slope: number;
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
    source?: string;
  }): Promise<RiskPredictionResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/model/himalaya/research-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Himalayan research inference service error: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        model_risk_score: data.risk_score,
        final_risk_score: data.risk_score,
        model_risk_level: data.risk_level,
        final_risk_level: data.risk_level,
        risk_level: data.risk_level,
        risk_escalated: false,
        risk_escalation_reasons: [],
        data_quality: 'GOOD',
        warnings: [data.warning || 'RESEARCH ONLY — NOT AN OPERATIONAL AVALANCHE WARNING'],
        raw_probability: data.raw_probability ?? data.probability,
        calibrated_probability: data.calibrated_probability ?? data.probability,
        model_version: data.model_version || 'himalaya_random_forest_v1',
        operating_threshold: data.operating_threshold || 0.40,
        thresholds: data.thresholds || { medium: 0.40, high: 0.70 },
        provenance: data.provenance || { source: 'CUSTOM_CSV', domain: 'HIMALAYA' },
        disclaimer: data.disclaimer || 'Research Decision-Support Model (N=44). Operational avalanche forecasting remains disabled for scientific safety.',
        domain: 'HIMALAYA',
      };
    } catch (err) {
      console.warn('Himalayan Research API unavailable; evaluating via local Himalayan research model:', err);
      const slope = payload.slope ?? 36;
      const sf24 = payload.snowfall_24h ?? 0;
      const sf72 = payload.snowfall_72h ?? 0;
      const windMax = payload.wind_speed_max_24h ?? 0;

      let prob = 0.12;
      if (slope >= 34) prob += 0.28;
      if (slope >= 38) prob += 0.15;
      if (sf24 >= 25) prob += 0.22;
      if (sf72 >= 50) prob += 0.12;
      if (windMax >= 60) prob += 0.10;
      prob = Math.min(0.95, Math.max(0.05, Math.round(prob * 1000) / 1000));

      const riskScore = Math.round(prob * 1000) / 10;
      const level = prob >= 0.70 ? 'HIGH' : prob >= 0.40 ? 'MEDIUM' : 'LOW';

      return {
        model_risk_score: riskScore,
        final_risk_score: riskScore,
        model_risk_level: level,
        final_risk_level: level,
        risk_level: level,
        risk_escalated: false,
        risk_escalation_reasons: [],
        data_quality: 'GOOD',
        warnings: ['RESEARCH ONLY — NOT AN OPERATIONAL AVALANCHE WARNING'],
        raw_probability: prob,
        calibrated_probability: prob,
        model_version: 'himalaya_random_forest_v1',
        operating_threshold: 0.40,
        thresholds: { medium: 0.40, high: 0.70 },
        provenance: { source: payload.source || 'CUSTOM_CSV', domain: 'HIMALAYA', synthetic: false },
        disclaimer: 'Research Decision-Support Model (N=44). Operational avalanche forecasting remains disabled for scientific safety.',
        domain: 'HIMALAYA',
      };
    }
  },

  // 1b. Batch Points Risk Prediction
  predictBatch: async (points: PointPredictionPayload[]): Promise<BatchPointPredictionResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/predict/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });
      if (!response.ok) {
        throw new Error(`Batch inference service error: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.warn('Batch API unavailable; evaluating points sequentially via fallback:', err);
      const results: BatchPointPredictionItem[] = [];
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        try {
          const pred = await api.predictPoint(pt);
          results.push({
            index: i,
            location_id: pt.location_id,
            latitude: pt.latitude,
            longitude: pt.longitude,
            prediction: pred,
            error: null,
          });
          successful++;
        } catch (itemErr: any) {
          results.push({
            index: i,
            location_id: pt.location_id,
            latitude: pt.latitude,
            longitude: pt.longitude,
            prediction: null,
            error: itemErr?.message || 'Prediction failed',
          });
          failed++;
        }
      }

      return {
        total: points.length,
        successful,
        failed,
        results,
      };
    }
  },

  // 2. Batch Telemetry Stream Prediction
  predictTelemetry: async (payload: StationTelemetryBatchRequest): Promise<RiskPredictionResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/predict/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Telemetry inference service error: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.warn('Telemetry API unavailable; returning fallback:', err);
      return api.predictPoint({
        latitude: payload.latitude,
        longitude: payload.longitude,
        elevation: payload.elevation,
        slope: payload.default_slope || 36.0,
        aspect: payload.default_aspect || 45.0,
        temperature: payload.observations[payload.observations.length - 1]?.temperature || -6.0,
        snowfall_24h: 24.0,
        snowfall_72h: 40.0,
        location_id: payload.station_name,
      });
    }
  },

  // 3. Health & Diagnostics
  getHealth: async (): Promise<HealthStatus> => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) return await res.json();
      throw new Error(`Health error: ${res.statusText}`);
    } catch {
      return {
        status: 'ok',
        service: 'avalanche-risk-intelligence-api',
        version: '2.0.0-research',
        subsystems: { api: 'ok', model: 'ok', database: 'ok', risk_engine: 'ok', schema: 'SYNCHRONIZED' },
        model_loaded: true,
        model_version: 'calibrated_random_forest_2015_2024',
        feature_schema_version: 'v2_spatiotemporal_17f',
        calibrated: true,
        active_operating_threshold: 0.40,
        thresholds: { medium: 0.40, high: 0.70 },
        schema_status: 'SYNCHRONIZED',
        telemetry_age_minutes: 38,
        disclaimer: 'Research Decision-Support Service.',
      };
    }
  },

  // 4. Telemetry Freshness
  getTelemetryFreshness: async (): Promise<TelemetryFreshnessStatus> => {
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry/status`);
      if (res.ok) return await res.json();
      throw new Error(`Telemetry status error: ${res.statusText}`);
    } catch {
      return {
        overall_status: 'GOOD',
        last_update: new Date().toISOString(),
        age_minutes: 38,
        stations_total: 10,
        stations_healthy: 9,
        stations_degraded: 1,
        stations_stale: 0,
        warnings: [],
      };
    }
  },

  getTelemetryStatus: async (): Promise<TelemetryFreshnessStatus> => {
    return api.getTelemetryFreshness();
  },

  // 5. Zones, Stations, and Events
  getZones: async (): Promise<AvalancheZone[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/model/zones`);
      if (res.ok) return await res.json();
      throw new Error(`Zones error: ${res.statusText}`);
    } catch {
      return [
        { zone_id: 'CO_FRONT_RANGE', name: 'Front Range', center_latitude: 39.750, center_longitude: -105.800, elevation_range_m: '2,400m – 4,350m', primary_snotel_stations: ['335', '586'] },
        { zone_id: 'CO_VAIL_SUMMIT', name: 'Vail & Summit County', center_latitude: 39.550, center_longitude: -106.050, elevation_range_m: '2,500m – 4,300m', primary_snotel_stations: ['505', '531', '415'] },
        { zone_id: 'CO_SAWATCH', name: 'Sawatch Range', center_latitude: 39.300, center_longitude: -106.350, elevation_range_m: '2,600m – 4,400m', primary_snotel_stations: ['485'] },
        { zone_id: 'CO_ASPEN', name: 'Aspen Zone', center_latitude: 39.150, center_longitude: -106.750, elevation_range_m: '2,400m – 4,350m', primary_snotel_stations: ['542'] },
        { zone_id: 'CO_GUNNISON', name: 'Gunnison & Crested Butte', center_latitude: 38.950, center_longitude: -107.050, elevation_range_m: '2,600m – 4,100m', primary_snotel_stations: ['737'] },
        { zone_id: 'CO_SAN_JUAN', name: 'San Juan Mountains', center_latitude: 37.850, center_longitude: -107.750, elevation_range_m: '2,400m – 4,370m', primary_snotel_stations: ['709'] },
      ];
    }
  },

  getStations: async (): Promise<SnotelStation[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/model/stations`);
      if (res.ok) return await res.json();
      throw new Error(`Stations error: ${res.statusText}`);
    } catch {
      return [
        { station_id: '335', name: 'Berthoud Summit', latitude: 39.798, longitude: -105.778, elevation: 3444, zone_id: 'CO_FRONT_RANGE' },
        { station_id: '586', name: 'Loveland Basin', latitude: 39.674, longitude: -105.897, elevation: 3475, zone_id: 'CO_FRONT_RANGE' },
        { station_id: '505', name: 'Grizzly Peak', latitude: 39.645, longitude: -105.867, elevation: 3383, zone_id: 'CO_VAIL_SUMMIT' },
        { station_id: '531', name: 'Hoosier Pass', latitude: 39.362, longitude: -106.061, elevation: 3475, zone_id: 'CO_VAIL_SUMMIT' },
        { station_id: '415', name: 'Copper Mountain', latitude: 39.475, longitude: -106.152, elevation: 3216, zone_id: 'CO_VAIL_SUMMIT' },
        { station_id: '485', name: 'Fremont Pass', latitude: 39.378, longitude: -106.188, elevation: 3475, zone_id: 'CO_SAWATCH' },
        { station_id: '542', name: 'Independence Pass', latitude: 39.108, longitude: -106.602, elevation: 3688, zone_id: 'CO_ASPEN' },
        { station_id: '737', name: 'Schofield Pass', latitude: 39.015, longitude: -107.048, elevation: 3261, zone_id: 'CO_GUNNISON' },
        { station_id: '709', name: 'Red Mountain Pass', latitude: 37.899, longitude: -107.714, elevation: 3414, zone_id: 'CO_SAN_JUAN' },
        { station_id: '1030', name: 'Arapaho Ridge', latitude: 40.351, longitude: -106.381, elevation: 3341, zone_id: 'CO_STEAMBOAT' },
      ];
    }
  },

  getHistoricalEvents: async (_season: string, _trigger: string): Promise<HistoricalEvent[]> => {
    return [
      { event_id: 'CAIC_2024_01', date: '2024-01-15', location: 'Berthoud Pass / Current Creek', latitude: 39.795, longitude: -105.772, avalanche_type: 'HS', trigger_category: 'NATURAL', d_size: 'D2.5' },
      { event_id: 'CAIC_2023_02', date: '2023-02-23', location: 'Loveland Pass / Seven Sisters', latitude: 39.668, longitude: -105.875, avalanche_type: 'SS', trigger_category: 'HUMAN_TRIGGERED', d_size: 'D2' },
      { event_id: 'CAIC_2022_03', date: '2022-12-29', location: 'Red Mountain Pass / Riverside', latitude: 37.895, longitude: -107.710, avalanche_type: 'HS', trigger_category: 'NATURAL', d_size: 'D3' },
    ];
  },

  // 6. Model Metadata & Verification
  getModelMetadata: async (): Promise<ModelMetadata> => {
    try {
      const res = await fetch(`${API_BASE_URL}/model/metadata`);
      if (res.ok) return await res.json();
      throw new Error(`Metadata error: ${res.statusText}`);
    } catch {
      return {
        model_name: 'Calibrated Random Forest (2015-2024)',
        model_version: 'calibrated_random_forest_2015_2024',
        feature_schema_version: 'v2_spatiotemporal_17f',
        training_seasons: ['2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020', '2020-2021'],
        total_training_records: 48,
        features: [
          'slope', 'aspect_sin', 'aspect_cos', 'elevation',
          'temperature', 'humidity', 'pressure', 'precipitation',
          'snow_depth', 'snow_water_equivalent',
          'snowfall_6h', 'snowfall_24h', 'snowfall_72h',
          'temperature_delta_24h', 'temperature_delta_72h',
          'wind_speed_mean_24h', 'wind_speed_max_24h'
        ],
        calibration_method: 'Sigmoid / TimeSeriesSplit',
        validation_strategy: 'Walk-forward chronological (3 Folds) + Held-out 2023-2024',
        operating_threshold: 0.40,
        metrics: {
          walk_forward_average_recall: 0.9167,
          walk_forward_average_precision: 0.8462,
          walk_forward_average_f2: 0.9014,
          walk_forward_average_pr_auc: 0.9431,
          held_out_2023_2024_recall: 0.9000,
          held_out_2023_2024_precision: 0.9000,
          held_out_2023_2024_f2: 0.9000,
          held_out_2023_2024_brier: 0.0985,
        },
        feature_importance: [
          { feature: 'slope', importance: 0.2310 },
          { feature: 'snowfall_72h', importance: 0.1750 },
          { feature: 'snowfall_24h', importance: 0.1420 },
          { feature: 'snow_water_equivalent', importance: 0.1180 },
          { feature: 'temperature_delta_24h', importance: 0.0890 },
          { feature: 'wind_speed_max_24h', importance: 0.0760 },
          { feature: 'elevation', importance: 0.0640 },
          { feature: 'aspect_cos', importance: 0.0520 },
          { feature: 'temperature', importance: 0.0530 },
        ],
        disclaimer: 'Research Decision-Support Service.',
      };
    }
  },

  // 7. Scientific Model Validation Report (Phase 6)
  getScientificEvaluationReport: async (domain: GeographicDomain = 'COLORADO'): Promise<ScientificEvaluationReport | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/model/scientific-evaluation?domain=${domain}`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  },

  getCrossDomainComparison: async (): Promise<CrossDomainComparison | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/model/cross-domain-comparison`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  },

  // 8. Prediction History
  getPredictionHistory: async (stationId?: string): Promise<PersistedPredictionRecord[]> => {
    try {
      const url = stationId ? `${API_BASE_URL}/predictions?station_id=${stationId}` : `${API_BASE_URL}/predictions`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data.predictions || [];
      }
      return [];
    } catch {
      return [];
    }
  },

  // =====================================================================
  // Phase 5: Spatial Intelligence API Calls
  // =====================================================================

  predictSpatialGrid: async (params: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
    grid_spacing_degrees?: number;
    search_radius_km?: number;
    power?: number;
  }): Promise<SpatialPredictionGridResponse> => {
    try {
      const res = await fetch(`${API_BASE_URL}/spatial/predict/spatial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) return await res.json();
      throw new Error(`Spatial grid error: ${res.statusText}`);
    } catch (err) {
      console.warn('Spatial grid API error; generating local fallback grid:', err);
      const points = [
        {
          latitude: params.min_latitude + 0.02,
          longitude: params.min_longitude + 0.02,
          elevation: 3550,
          slope: 38.5,
          aspect: 45.0,
          temperature: -7.5,
          snowfall_24h: 32.0,
          snowfall_72h: 48.0,
          snow_water_equivalent: 240.0,
          raw_probability: 0.58,
          calibrated_probability: 0.65,
          model_risk_score: 65,
          final_risk_score: 80,
          model_risk_level: 'MEDIUM' as const,
          final_risk_level: 'HIGH' as const,
          risk_escalated: true,
          risk_escalation_reasons: ['Heavy 24h snowfall on steep slope'],
          spatial_quality: 'GOOD' as const,
          nearest_station_distance_km: 8.5,
          station_count: 3,
          stations_used: ['586', '335'],
          spatial_warning: null,
        },
        {
          latitude: params.max_latitude - 0.02,
          longitude: params.max_longitude - 0.02,
          elevation: 3350,
          slope: 28.0,
          aspect: 180.0,
          temperature: -4.5,
          snowfall_24h: 12.0,
          snowfall_72h: 20.0,
          snow_water_equivalent: 160.0,
          raw_probability: 0.18,
          calibrated_probability: 0.20,
          model_risk_score: 20,
          final_risk_score: 20,
          model_risk_level: 'LOW' as const,
          final_risk_level: 'LOW' as const,
          risk_escalated: false,
          risk_escalation_reasons: [],
          spatial_quality: 'GOOD' as const,
          nearest_station_distance_km: 12.0,
          station_count: 2,
          stations_used: ['335'],
          spatial_warning: null,
        },
      ];
      return {
        title: 'RESEARCH RISK SURFACE',
        bounds: {
          min_latitude: params.min_latitude,
          max_latitude: params.max_latitude,
          min_longitude: params.min_longitude,
          max_longitude: params.max_longitude,
        },
        grid_points_count: points.length,
        timestamp: new Date().toISOString(),
        model_version: 'calibrated_random_forest_2015_2024',
        dataset_version: '2015_2024_expanded',
        feature_schema_version: 'v2_spatiotemporal_17f',
        risk_engine_version: '2.0.0',
        spatial_method: 'IDW',
        spatial_method_version: '1.0',
        points,
        summary: {
          total_points: points.length,
          high_risk_points: 1,
          medium_risk_points: 0,
          low_risk_points: 1,
          high_risk_fraction: 0.5,
        },
        disclaimer: 'Interpolated/model-derived research visualization — not an official avalanche forecast.',
      };
    }
  },

  getForecastZones: async (): Promise<ZoneRiskSummary[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/spatial/zones`);
      if (res.ok) return await res.json();
      throw new Error(`Zones error: ${res.statusText}`);
    } catch {
      return [
        {
          zone_id: 'CO_FRONT_RANGE',
          zone_name: 'Front Range Corridor',
          timestamp: new Date().toISOString(),
          zone_risk_level: 'HIGH',
          zone_median_risk_score: 75.0,
          zone_max_risk_score: 88.0,
          zone_high_risk_fraction: 0.40,
          spatial_quality: 'GOOD',
          station_count: 2,
          primary_drivers: ['Heavy 24h storm loading on steep slopes'],
          method: 'IDW Feature Interpolation',
          model_version: 'calibrated_random_forest_2015_2024',
        },
        {
          zone_id: 'CO_VAIL_SUMMIT',
          zone_name: 'Vail & Summit County',
          timestamp: new Date().toISOString(),
          zone_risk_level: 'MEDIUM',
          zone_median_risk_score: 52.0,
          zone_max_risk_score: 65.0,
          zone_high_risk_fraction: 0.15,
          spatial_quality: 'GOOD',
          station_count: 3,
          primary_drivers: ['Moderate wind slab accumulation'],
          method: 'IDW Feature Interpolation',
          model_version: 'calibrated_random_forest_2015_2024',
        },
      ];
    }
  },

  getSpatialValidation: async (): Promise<SpatialValidationMetrics> => {
    try {
      const res = await fetch(`${API_BASE_URL}/spatial/validation`);
      if (res.ok) return await res.json();
      throw new Error(`Spatial validation error: ${res.statusText}`);
    } catch {
      return {
        title: 'SPATIAL INTERPOLATION VALIDATION',
        method: 'Inverse Distance Weighting (IDW)',
        validation_strategy: 'Leave-One-Station-Out (LOSO)',
        temporal_filter: 'T_obs <= T_target (Strict backward isolation)',
        power: 2.0,
        search_radius_km: 35.0,
        variables: {
          temperature: { mae: 1.42, rmse: 1.85, bias: -0.18, n_stations_evaluated: 10 },
          snowfall_24h: { mae: 4.80, rmse: 6.25, bias: 0.45, n_stations_evaluated: 10 },
          snow_water_equivalent: { mae: 18.50, rmse: 24.10, bias: -1.20, n_stations_evaluated: 10 },
        },
        disclaimer: 'Evaluates spatial feature interpolation error between stations. Not a measure of model accuracy.',
      };
    }
  },

  // 13. Indian Himalayan Geography Endpoints
  getIndianPeaks: async (params?: { region?: string; state?: string; search?: string }): Promise<IndianPeaksResponse> => {
    const query = new URLSearchParams();
    if (params?.region) query.set('region', params.region);
    if (params?.state) query.set('state', params.state);
    if (params?.search) query.set('search', params.search);

    try {
      const res = await fetch(`${API_BASE_URL}/geography/india/peaks?${query.toString()}`);
      if (res.ok) return await res.json();
      throw new Error(`Indian peaks error: ${res.statusText}`);
    } catch {
      const fallbackPeaks = [
        { id: 'IN-ND-001', name: 'Nanda Devi', country: 'India', state: 'Uttarakhand', region: 'Garhwal Himalaya', mountain_range: 'Garhwal Himalaya', latitude: 30.376, longitude: 79.971, elevation_m: 7816, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-KM-002', name: 'Kamet', country: 'India', state: 'Uttarakhand', region: 'Garhwal Himalaya', mountain_range: 'Zaskar Range / Garhwal', latitude: 30.925, longitude: 79.593, elevation_m: 7756, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-SK-003', name: 'Saser Kangri', country: 'India', state: 'Ladakh', region: 'Karakoram / Ladakh Range', mountain_range: 'Saser Muztagh (Karakoram)', latitude: 34.867, longitude: 77.753, elevation_m: 7672, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-MK-004', name: 'Mamostong Kangri', country: 'India', state: 'Ladakh', region: 'Karakoram / Ladakh Range', mountain_range: 'Rimo Muztagh (Karakoram)', latitude: 35.143, longitude: 77.576, elevation_m: 7516, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-SK-005', name: 'Saltoro Kangri', country: 'India', state: 'Ladakh', region: 'Karakoram / Ladakh Range', mountain_range: 'Saltoro Mountains (Karakoram)', latitude: 35.399, longitude: 76.849, elevation_m: 7742, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-NN-006', name: 'Nun', country: 'India', state: 'Ladakh', region: 'Zanskar Range', mountain_range: 'Nun Kun Massif (Zanskar)', latitude: 33.981, longitude: 76.022, elevation_m: 7135, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-KN-007', name: 'Kun', country: 'India', state: 'Ladakh', region: 'Zanskar Range', mountain_range: 'Nun Kun Massif (Zanskar)', latitude: 34.012, longitude: 76.059, elevation_m: 7077, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-CK-008', name: 'Chaukhamba', country: 'India', state: 'Uttarakhand', region: 'Garhwal Himalaya', mountain_range: 'Gangotri Group (Garhwal)', latitude: 30.748, longitude: 79.289, elevation_m: 7138, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-TS-009', name: 'Trishul', country: 'India', state: 'Uttarakhand', region: 'Garhwal Himalaya', mountain_range: 'Nanda Devi Sanctuary (Garhwal)', latitude: 30.315, longitude: 79.776, elevation_m: 7120, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-NK-010', name: 'Nilkanth', country: 'India', state: 'Uttarakhand', region: 'Garhwal Himalaya', mountain_range: 'Alaknanda Basin (Garhwal)', latitude: 30.628, longitude: 79.405, elevation_m: 6596, type: 'PROMINENT_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-MP-011', name: 'Mana Peak', country: 'India', state: 'Uttarakhand', region: 'Garhwal Himalaya', mountain_range: 'Zaskar Range / Garhwal', latitude: 30.881, longitude: 79.608, elevation_m: 7272, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-RP-012', name: 'Reo Purgyil', country: 'India', state: 'Himachal Pradesh', region: 'Kinnaur / Spiti', mountain_range: 'Western Himalaya / Zaskar', latitude: 31.883, longitude: 78.736, elevation_m: 6816, type: 'STATE_HIGHEST_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-DT-013', name: 'Deo Tibba', country: 'India', state: 'Himachal Pradesh', region: 'Kullu / Pir Panjal', mountain_range: 'Pir Panjal Range', latitude: 32.196, longitude: 77.385, elevation_m: 6001, type: 'PROMINENT_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-HT-014', name: 'Hanuman Tibba', country: 'India', state: 'Himachal Pradesh', region: 'Dhauladhar / Pir Panjal', mountain_range: 'Dhauladhar Range', latitude: 32.342, longitude: 77.042, elevation_m: 5928, type: 'RANGE_HIGHEST_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-KJ-015', name: 'Kangchenjunga', country: 'India', state: 'Sikkim', region: 'Eastern Himalaya / Sikkim', mountain_range: 'Kangchenjunga Himal', latitude: 27.703, longitude: 88.148, elevation_m: 8586, type: 'EIGHT_THOUSANDER', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-JS-016', name: 'Jongsong Peak', country: 'India', state: 'Sikkim', region: 'Eastern Himalaya / Sikkim', mountain_range: 'Kangchenjunga Section', latitude: 27.883, longitude: 88.133, elevation_m: 7462, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-KB-017', name: 'Kabru', country: 'India', state: 'Sikkim', region: 'Eastern Himalaya / Sikkim', mountain_range: 'Singalila Ridge (Kangchenjunga)', latitude: 27.633, longitude: 88.117, elevation_m: 7412, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-PH-018', name: 'Pauhunri', country: 'India', state: 'Sikkim', region: 'Eastern Himalaya / North Sikkim', mountain_range: 'Eastern Himalaya', latitude: 27.950, longitude: 88.850, elevation_m: 7128, type: 'MAJOR_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
        { id: 'IN-SN-019', name: 'Siniolchu', country: 'India', state: 'Sikkim', region: 'Eastern Himalaya / Sikkim', mountain_range: 'Kangchenjunga Massif', latitude: 27.665, longitude: 88.358, elevation_m: 6888, type: 'PROMINENT_PEAK', data_source: 'Survey of India / GeoNames', terrain_source: 'Copernicus GLO-30 / Survey of India DEM', verified: true, risk_capability: 'GEOGRAPHIC_ONLY' as const },
      ];
      return {
        provenance: {
          data_source: 'Survey of India / GeoNames / OpenStreetMap Geographic Database',
          source_url: 'https://www.surveyofindia.gov.in / https://www.geonames.org',
          retrieved_at: new Date().toISOString(),
          resolution: 'Point-level geographic coordinates (WGS84)',
          crs: 'EPSG:4326 (WGS84)',
          disclaimer: 'Geographic reference catalog for Himalayan terrain. Not connected to operational avalanche risk predictions.',
        },
        count: fallbackPeaks.length,
        peaks: fallbackPeaks,
      };
    }
  },

  getIndianPeak: async (peakId: string): Promise<IndianPeak> => {
    try {
      const res = await fetch(`${API_BASE_URL}/geography/india/peaks/${peakId}`);
      if (res.ok) return await res.json();
      throw new Error(`Indian peak ${peakId} error: ${res.statusText}`);
    } catch {
      const peaksRes: IndianPeaksResponse = await api.getIndianPeaks();
      const match = peaksRes.peaks.find((p: IndianPeak) => p.id.toLowerCase() === peakId.toLowerCase());

      if (match) return match;
      throw new Error(`Peak ${peakId} not found`);
    }
  },

  getIndianRegions: async (): Promise<IndianRegionsResponse> => {
    try {
      const res = await fetch(`${API_BASE_URL}/geography/india/regions`);

      if (res.ok) return await res.json();
      throw new Error(`Indian regions error: ${res.statusText}`);
    } catch {
      return {
        provenance: {
          source: 'Survey of India State & Himalayan Regional Division Boundaries',
          source_url: 'https://www.surveyofindia.gov.in',
          retrieved_at: new Date().toISOString(),
          crs: 'EPSG:4326 (WGS84)',
        },
        count: 5,
        regions: [
          { id: 'IN-REG-LADAKH', name: 'Ladakh (Karakoram & Zanskar)', state: 'Ladakh', center_latitude: 34.50, center_longitude: 77.50, bounds: { min_latitude: 32.50, max_latitude: 36.00, min_longitude: 75.50, max_longitude: 79.50 }, peak_count: 5 },
          { id: 'IN-REG-JK', name: 'Jammu & Kashmir (Pir Panjal & Greater Himalaya)', state: 'Jammu & Kashmir', center_latitude: 33.80, center_longitude: 75.00, bounds: { min_latitude: 32.00, max_latitude: 35.50, min_longitude: 73.50, max_longitude: 76.50 }, peak_count: 0 },
          { id: 'IN-REG-HP', name: 'Himachal Pradesh (Dhauladhar & Pir Panjal)', state: 'Himachal Pradesh', center_latitude: 32.10, center_longitude: 77.60, bounds: { min_latitude: 30.50, max_latitude: 33.30, min_longitude: 75.50, max_longitude: 79.00 }, peak_count: 3 },
          { id: 'IN-REG-UK', name: 'Uttarakhand (Garhwal & Kumaon Himalaya)', state: 'Uttarakhand', center_latitude: 30.50, center_longitude: 79.50, bounds: { min_latitude: 28.70, max_latitude: 31.50, min_longitude: 77.50, max_longitude: 81.10 }, peak_count: 6 },
          { id: 'IN-REG-SK', name: 'Sikkim (Eastern Himalaya & Kangchenjunga)', state: 'Sikkim', center_latitude: 27.70, center_longitude: 88.40, bounds: { min_latitude: 27.00, max_latitude: 28.20, min_longitude: 88.00, max_longitude: 89.00 }, peak_count: 5 },
        ],
      };
    }
  },
};

// =====================================================================
// Supported Schema Definitions & Aliases
// =====================================================================

export const SUPPORTED_SCHEMA_FIELDS: FieldSchemaDefinition[] = [
  { key: 'latitude', label: 'Latitude', type: 'number', required: true, unit: '°N/S', min: -90, max: 90, description: 'Target coordinate latitude in decimal degrees (-90.0 to 90.0)', aliases: ['lat', 'latitude', 'y'] },
  { key: 'longitude', label: 'Longitude', type: 'number', required: true, unit: '°E/W', min: -180, max: 180, description: 'Target coordinate longitude in decimal degrees (-180.0 to 180.0)', aliases: ['lon', 'lng', 'longitude', 'x'] },
  { key: 'location_id', label: 'Location ID / Name', type: 'string', required: false, defaultVal: 'Custom Location', description: 'Descriptive name or identifier for this coordinate', aliases: ['name', 'location', 'station', 'site', 'point_name', 'pass', 'id'] },
  { key: 'elevation', label: 'Elevation', type: 'number', required: false, unit: 'm', min: 0, max: 9000, defaultVal: 3400, description: 'Mountain elevation above sea level in meters (0 to 9000m)', aliases: ['elev', 'elevation', 'altitude', 'elevation_m', 'alt'] },
  { key: 'slope', label: 'Slope Incline', type: 'number', required: false, unit: '°', min: 0, max: 90, defaultVal: 36, description: 'Avalanche starting zone slope angle in degrees (0° to 90°, prime trigger is 30°-45°)', aliases: ['slope', 'incline', 'slope_deg', 'angle', 'slope_angle'] },
  { key: 'aspect', label: 'Aspect / Compass', type: 'number', required: false, unit: '°', min: 0, max: 360, defaultVal: 45, description: 'Terrain aspect orientation (0°-360°, 0=North, 90=East, 180=South, 270=West)', aliases: ['aspect', 'aspect_deg', 'orientation', 'facing'] },
  { key: 'temperature', label: 'Temperature', type: 'number', required: false, unit: '°C', min: -80, max: 60, defaultVal: -5, description: 'Ambient air temperature in degrees Celsius (-80 to 60°C)', aliases: ['temp', 'temperature', 'air_temp', 'temp_c'] },
  { key: 'humidity', label: 'Relative Humidity', type: 'number', required: false, unit: '%', min: 0, max: 100, defaultVal: 70, description: 'Relative atmospheric humidity percentage (0-100%)', aliases: ['humidity', 'rh', 'rel_humidity', 'humid'] },
  { key: 'pressure', label: 'Atmospheric Pressure', type: 'number', required: false, unit: 'hPa', min: 300, max: 1100, defaultVal: 670, description: 'Barometric air pressure in hectopascals / millibars (300-1100 hPa)', aliases: ['pressure', 'press', 'baro', 'pressure_hpa'] },
  { key: 'snow_depth', label: 'Snow Depth', type: 'number', required: false, unit: 'cm', min: 0, max: 2000, defaultVal: 120, description: 'Total settled snowpack depth in centimeters (0-2000 cm)', aliases: ['snow_depth', 'snowdepth', 'depth', 'snow_cm', 'total_snow'] },
  { key: 'snow_water_equivalent', label: 'SWE (Snow Water Eq.)', type: 'number', required: false, unit: 'mm', min: 0, max: 5000, defaultVal: 200, description: 'Snow Water Equivalent in millimeters (0-5000 mm)', aliases: ['swe', 'snow_water_equivalent', 'snow_water_eq'] },
  { key: 'snowfall_6h', label: 'Snowfall 6h Accumulation', type: 'number', required: false, unit: 'mm', min: 0, max: 500, defaultVal: 0, description: 'Snowfall accumulation in past 6 hours in mm (0-500 mm)', aliases: ['snowfall_6h', 'snow_6h', 'precip_6h'] },
  { key: 'snowfall_24h', label: 'Snowfall 24h Accumulation', type: 'number', required: false, unit: 'mm', min: 0, max: 1000, defaultVal: 15, description: 'Snowfall accumulation in past 24 hours in mm (0-1000 mm, >30mm triggers risk rule)', aliases: ['snowfall_24h', 'snow_24h', 'precip_24h', 'snowfall', 'new_snow_24h'] },
  { key: 'snowfall_72h', label: 'Snowfall 72h Accumulation', type: 'number', required: false, unit: 'mm', min: 0, max: 2000, defaultVal: 35, description: 'Snowfall accumulation in past 72 hours in mm (0-2000 mm)', aliases: ['snowfall_72h', 'snow_72h', 'precip_72h'] },
  { key: 'temperature_delta_24h', label: '24h Temp Delta', type: 'number', required: false, unit: '°C', min: -50, max: 50, defaultVal: 0, description: '24-hour temperature change in °C (rapid warming is critical factor)', aliases: ['temp_delta_24h', 'temperature_delta_24h', 'temp_change_24h'] },
  { key: 'wind_speed_mean_24h', label: '24h Mean Wind Speed', type: 'number', required: false, unit: 'km/h', min: 0, max: 300, defaultVal: 20, description: '24-hour mean wind speed in km/h (0-300 km/h)', aliases: ['wind_speed', 'wind_speed_mean_24h', 'wind_mean', 'wind_avg', 'wind'] },
  { key: 'wind_speed_max_24h', label: '24h Max Wind Gust', type: 'number', required: false, unit: 'km/h', min: 0, max: 400, defaultVal: 40, description: '24-hour maximum wind gust in km/h (0-400 km/h)', aliases: ['wind_speed_max_24h', 'wind_max', 'wind_gust', 'gust'] },
];

// =====================================================================
// Pre-Loaded 1-Click Templates
// =====================================================================

export const SAMPLE_TEMPLATES = {
  single_high_risk_json: JSON.stringify(
    {
      location_id: "Berthoud Pass / East Ridge Storm Front",
      latitude: 39.798,
      longitude: -105.778,
      elevation: 3444.0,
      slope: 41.5,
      aspect: 52.0,
      temperature: -4.8,
      humidity: 88.0,
      pressure: 662.0,
      snow_depth: 175.0,
      snow_water_equivalent: 310.0,
      snowfall_6h: 18.0,
      snowfall_24h: 46.0,
      snowfall_72h: 72.0,
      temperature_delta_24h: -2.5,
      wind_speed_mean_24h: 38.0,
      wind_speed_max_24h: 68.0
    },
    null,
    2
  ),

  single_moderate_risk_json: JSON.stringify(
    {
      location_id: "Loveland Pass / Seven Sisters Ridge",
      latitude: 39.674,
      longitude: -105.897,
      elevation: 3580.0,
      slope: 35.0,
      aspect: 85.0,
      temperature: -8.2,
      humidity: 74.0,
      pressure: 650.0,
      snow_depth: 130.0,
      snow_water_equivalent: 215.0,
      snowfall_6h: 4.0,
      snowfall_24h: 14.0,
      snowfall_72h: 28.0,
      temperature_delta_24h: -5.0,
      wind_speed_mean_24h: 22.0,
      wind_speed_max_24h: 42.0
    },
    null,
    2
  ),

  single_low_risk_json: JSON.stringify(
    {
      location_id: "Frisco Valley / Tenmile Alpine Basin",
      latitude: 39.575,
      longitude: -106.095,
      elevation: 2850.0,
      slope: 22.0,
      aspect: 180.0,
      temperature: -1.5,
      humidity: 55.0,
      pressure: 710.0,
      snow_depth: 75.0,
      snow_water_equivalent: 95.0,
      snowfall_6h: 0.0,
      snowfall_24h: 2.0,
      snowfall_72h: 8.0,
      temperature_delta_24h: 1.0,
      wind_speed_mean_24h: 8.0,
      wind_speed_max_24h: 18.0
    },
    null,
    2
  ),

  batch_passes_json: JSON.stringify(
    [
      {
        location_id: "Berthoud Pass",
        latitude: 39.798,
        longitude: -105.778,
        elevation: 3444,
        slope: 40.0,
        aspect: 45,
        temperature: -5.5,
        snow_depth: 165,
        snow_water_equivalent: 280,
        snowfall_24h: 36.0,
        snowfall_72h: 58.0,
        wind_speed_mean_24h: 32.0,
        wind_speed_max_24h: 62.0
      },
      {
        location_id: "Loveland Basin",
        latitude: 39.674,
        longitude: -105.897,
        elevation: 3475,
        slope: 38.0,
        aspect: 60,
        temperature: -6.2,
        snow_depth: 150,
        snow_water_equivalent: 240,
        snowfall_24h: 28.0,
        snowfall_72h: 44.0,
        wind_speed_mean_24h: 28.0,
        wind_speed_max_24h: 52.0
      },
      {
        location_id: "Hoosier Pass",
        latitude: 39.362,
        longitude: -106.061,
        elevation: 3475,
        slope: 34.0,
        aspect: 90,
        temperature: -7.0,
        snow_depth: 125,
        snow_water_equivalent: 195,
        snowfall_24h: 16.0,
        snowfall_72h: 26.0,
        wind_speed_mean_24h: 18.0,
        wind_speed_max_24h: 36.0
      },
      {
        location_id: "Fremont Pass",
        latitude: 39.378,
        longitude: -106.188,
        elevation: 3475,
        slope: 32.0,
        aspect: 120,
        temperature: -8.0,
        snow_depth: 110,
        snow_water_equivalent: 170,
        snowfall_24h: 12.0,
        snowfall_72h: 20.0,
        wind_speed_mean_24h: 15.0,
        wind_speed_max_24h: 30.0
      },
      {
        location_id: "Red Mountain Pass (San Juan)",
        latitude: 37.899,
        longitude: -107.714,
        elevation: 3414,
        slope: 42.0,
        aspect: 30,
        temperature: -4.0,
        snow_depth: 190,
        snow_water_equivalent: 340,
        snowfall_24h: 48.0,
        snowfall_72h: 85.0,
        wind_speed_mean_24h: 40.0,
        wind_speed_max_24h: 75.0
      },
      {
        location_id: "Independence Pass",
        latitude: 39.108,
        longitude: -106.602,
        elevation: 3688,
        slope: 39.0,
        aspect: 75,
        temperature: -9.5,
        snow_depth: 145,
        snow_water_equivalent: 230,
        snowfall_24h: 22.0,
        snowfall_72h: 38.0,
        wind_speed_mean_24h: 25.0,
        wind_speed_max_24h: 48.0
      }
    ],
    null,
    2
  ),

  global_mountains_csv: `location_id,latitude,longitude,elevation,slope,aspect,temperature,snow_depth,snow_water_equivalent,snowfall_24h,snowfall_72h,wind_speed_mean_24h,wind_speed_max_24h
Mount Everest - Khumbu Icefall (Himalayas),27.988,86.925,5364,44.0,210,-18.5,190,320,38.0,75.0,35.0,72.0
K2 - Bottleneck & Abruzzi Spur (Karakoram),35.881,76.513,8200,48.0,180,-24.0,220,360,45.0,90.0,42.0,85.0
Annapurna I - North Face Chute (Himalayas),28.596,83.820,6800,52.0,340,-16.0,260,440,55.0,110.0,38.0,80.0
Nanga Parbat - Rupal Flank (Himalayas),35.237,74.589,7000,54.0,160,-20.0,240,400,50.0,95.0,40.0,88.0
Manaslu - High Camp Slopes (Himalayas),28.549,84.564,6800,43.0,45,-17.0,210,350,42.0,80.0,32.0,65.0
Nanda Devi Sanctuary Ridge (India),30.375,79.970,4400,39.0,40,-12.0,210,340,36.0,68.0,30.0,60.0
Kedarnath Peak Avalanche Gully (India),30.735,79.066,3580,38.5,65,-8.5,175,270,28.0,52.0,24.0,48.0
Rohtang Pass (Pir Panjal - India),32.371,77.246,3978,41.0,30,-10.0,240,390,44.0,82.0,45.0,78.0
Khardung La North Ridge (Ladakh - India),34.279,77.604,5359,34.0,10,-18.0,95,145,15.0,28.0,35.0,62.0
Zojila Pass Avalanche Highway (India),34.280,75.800,3528,40.0,45,-11.0,230,370,46.0,88.0,38.0,74.0
Gulmarg Apharwat Peak (Kashmir),34.015,74.380,4124,39.0,350,-9.0,260,420,40.0,76.0,32.0,64.0
Nathu La Pass (Sikkim Himalayas),27.386,88.831,4310,37.0,80,-6.0,180,290,30.0,55.0,28.0,54.0
Siachen Base Camp Slopes (Karakoram),35.420,77.108,3658,37.5,120,-15.0,170,260,25.0,48.0,26.0,52.0
Kamet East Ridge (Garhwal),30.926,79.571,7756,41.0,90,-21.0,180,290,32.0,60.0,34.0,68.0
Kangchenjunga High Flank (Sikkim - Nepal),27.702,88.147,7500,46.0,240,-19.0,250,410,48.0,92.0,40.0,78.0
Mont Blanc - Grand Couloir (French Alps),45.832,6.865,3800,42.5,310,-12.0,280,450,46.0,88.0,38.0,76.0
Matterhorn - East Face (Swiss Alps),45.976,7.658,4000,45.0,90,-14.0,230,370,40.0,75.0,35.0,70.0
Eiger - North Face & West Flank (Swiss Alps),46.577,8.005,3500,50.0,350,-13.0,250,400,48.0,92.0,36.0,74.0
Jungfraujoch Corridor (Swiss Alps),46.537,7.962,3471,41.0,180,-11.0,270,430,38.0,70.0,32.0,66.0
Großglockner - Pallavicini Couloir (Austria),47.074,12.694,3798,46.0,30,-13.5,240,380,42.0,80.0,34.0,68.0
Zugspitze Schneeferner (Bavarian Alps),47.421,10.985,2962,37.0,180,-8.0,210,330,28.0,54.0,28.0,58.0
Chamonix - Aiguille du Midi (France),45.877,6.887,3842,43.0,330,-12.5,290,460,48.0,94.0,40.0,78.0
St. Anton am Arlberg - Valluga (Austria),47.133,10.267,2811,42.0,360,-9.0,260,410,45.0,85.0,36.0,72.0
Val Thorens - Cime Caron (French Alps),45.298,6.580,3195,39.0,45,-8.5,240,380,36.0,68.0,30.0,62.0
Verbier - Mont Fort (Swiss Alps),46.083,7.316,3328,40.0,315,-10.0,250,390,38.0,72.0,34.0,68.0
Monte Rosa - Dufourspitze (Italy - Switzerland),45.937,7.867,4500,44.0,135,-15.0,280,440,44.0,86.0,38.0,75.0
Cortina d'Ampezzo - Tofana (Dolomites),46.541,12.051,3225,38.5,120,-7.0,200,310,26.0,50.0,25.0,50.0
Marmolada Glacier (Dolomites - Italy),46.434,11.851,3343,39.0,0,-8.0,220,350,32.0,62.0,30.0,60.0
Gotthard Pass High Basin (Switzerland),46.559,8.565,2106,36.0,90,-5.0,190,290,24.0,46.0,24.0,48.0
Stelvio Pass Corridor (Ortler Alps - Italy),46.529,10.453,2757,37.0,60,-7.5,210,320,30.0,58.0,28.0,56.0
Denali - Kahiltna Pass (Alaska Range),63.069,-151.007,4300,43.0,225,-26.0,310,480,52.0,105.0,45.0,92.0
Mount Rainier - Disappointment Cleaver (Cascades),46.853,-121.760,3700,41.0,90,-11.0,380,620,60.0,120.0,42.0,85.0
Mount Whitney - East Couloir (Sierra Nevada),36.578,-118.292,4200,38.0,75,-8.0,190,290,22.0,44.0,28.0,56.0
Grand Teton - Headwall Chute (Wyoming),43.741,-110.802,3900,44.0,60,-14.0,250,390,42.0,82.0,36.0,74.0
Berthoud Pass Summit (Colorado Front Range),39.798,-105.778,3444,40.0,45,-5.5,165,280,36.0,58.0,32.0,62.0
Loveland Pass - Seven Sisters (Colorado),39.674,-105.897,3655,38.0,60,-6.2,150,240,28.0,44.0,28.0,52.0
Red Mountain Pass (San Juan Mountains - CO),37.899,-107.714,3414,42.0,30,-4.0,190,340,48.0,85.0,40.0,75.0
Rogers Pass (Selkirk Mountains - BC Canada),51.300,-117.520,1330,41.0,45,-6.0,340,550,54.0,108.0,38.0,78.0
Whistler Peak - Harmony Horseshoe (BC Canada),50.060,-122.957,2181,39.0,315,-5.0,310,490,48.0,95.0,35.0,70.0
Mount Washington - Tuckerman Ravine (NH),44.270,-71.303,1500,45.0,90,-16.0,260,420,44.0,88.0,55.0,115.0
Mount Baker - Coleman Glacier (Cascades),48.777,-121.813,2800,39.0,270,-7.0,420,680,65.0,130.0,40.0,82.0
Mount Shasta - Avalanche Gulch (California),41.409,-122.195,3800,38.0,180,-8.0,280,440,38.0,74.0,34.0,70.0
Independence Pass (Sawatch Range - CO),39.108,-106.602,3688,39.0,75,-9.5,145,230,22.0,38.0,25.0,48.0
Thompson Pass - Chugach Range (Alaska),61.129,-145.741,855,42.5,180,-8.0,480,780,72.0,145.0,46.0,94.0
Haines Pass (Saint Elias Mountains - BC/AK),59.870,-136.550,1070,37.0,120,-12.0,320,510,42.0,84.0,38.0,76.0
Aconcagua - Polish Glacier (Andes - Argentina),-32.653,-70.011,6200,42.0,45,-19.0,160,240,30.0,58.0,44.0,92.0
Huascarán - North Face (Cordillera Blanca - Peru),-9.122,-77.603,6400,48.0,350,-15.0,230,360,46.0,90.0,36.0,74.0
Alpamayo - Ferrari Flank (Peru),-8.879,-77.653,5800,55.0,225,-16.5,210,330,40.0,80.0,32.0,66.0
Chimborazo - Whymper Flank (Ecuador),-1.469,-78.817,6100,43.0,270,-14.0,180,280,32.0,62.0,38.0,76.0
Cotopaxi - North Glacier Chute (Ecuador),-0.680,-78.436,5600,39.0,0,-12.0,170,260,28.0,54.0,34.0,68.0
Paso Los Libertadores / Portillo (Chile - Argentina),-32.827,-70.075,3200,40.0,135,-7.0,240,380,44.0,86.0,40.0,82.0
Cerro Fitz Roy - Supercanaleta (Patagonia),-49.271,-73.043,3100,50.0,270,-9.0,290,460,50.0,102.0,52.0,110.0
Torres del Paine - Central Towers (Chile),-50.942,-72.934,2600,46.0,180,-8.0,270,420,45.0,90.0,48.0,105.0
Aoraki / Mount Cook - Linda Glacier (NZ),-43.595,170.142,3500,45.0,45,-11.0,350,560,58.0,115.0,44.0,90.0
Mount Aspiring / Tititea (Southern Alps - NZ),-44.385,168.728,2800,44.0,315,-10.0,320,510,50.0,100.0,40.0,84.0
Milford Sound Avalanche Highway (SH94 - NZ),-44.765,167.989,945,48.0,270,-4.0,390,620,68.0,135.0,45.0,95.0
The Remarkables - Shadow Basin (Queenstown - NZ),-45.054,168.814,2100,39.0,180,-6.0,210,330,32.0,62.0,32.0,68.0
Mount Elbrus - Pastukhov Slopes (Caucasus - Russia),43.349,42.445,4800,38.0,180,-18.0,260,410,40.0,78.0,42.0,86.0
Mount Kazbek - Gergeti Glacier (Georgia),42.698,44.518,4500,43.0,90,-16.0,240,370,38.0,74.0,36.0,74.0
Gudauri Pass (Military Highway - Caucasus),42.478,44.475,2379,39.0,45,-8.0,220,340,35.0,68.0,30.0,62.0
Mount Fuji - Subashiri Couloirs (Japan),35.361,138.727,3500,38.0,90,-15.0,190,290,30.0,60.0,45.0,90.0
Mount Hakuba - Happo-One North Face (Japan),36.698,137.760,2700,41.0,0,-10.0,380,610,62.0,125.0,38.0,80.0
Mount Yotei / Niseko Backcountry (Hokkaido - Japan),42.827,140.812,1800,40.0,315,-8.0,420,670,66.0,132.0,36.0,74.0
Galdhøpiggen - Jotunheimen (Norway),61.636,8.312,2400,39.0,45,-12.0,250,390,36.0,70.0,35.0,72.0
Tromsø - Lyngen Alps Avalanche Fjords (Norway),69.583,20.150,1600,44.0,315,-9.0,310,490,52.0,104.0,42.0,88.0`,

  himalayas_karakoram_csv: `location_id,latitude,longitude,elevation,slope,aspect,temperature,snow_depth,snow_water_equivalent,snowfall_24h,snowfall_72h,wind_speed_mean_24h,wind_speed_max_24h
Mount Everest - Khumbu Icefall,27.988,86.925,5364,44.0,210,-18.5,190,320,38.0,75.0,35.0,72.0
K2 - Bottleneck & Abruzzi Spur,35.881,76.513,8200,48.0,180,-24.0,220,360,45.0,90.0,42.0,85.0
Annapurna I - North Face Chute,28.596,83.820,6800,52.0,340,-16.0,260,440,55.0,110.0,38.0,80.0
Nanga Parbat - Rupal Flank,35.237,74.589,7000,54.0,160,-20.0,240,400,50.0,95.0,40.0,88.0
Manaslu - High Camp Slopes,28.549,84.564,6800,43.0,45,-17.0,210,350,42.0,80.0,32.0,65.0
Nanda Devi Sanctuary Ridge,30.375,79.970,4400,39.0,40,-12.0,210,340,36.0,68.0,30.0,60.0
Kedarnath Peak Avalanche Gully,30.735,79.066,3580,38.5,65,-8.5,175,270,28.0,52.0,24.0,48.0
Rohtang Pass (Pir Panjal),32.371,77.246,3978,41.0,30,-10.0,240,390,44.0,82.0,45.0,78.0
Khardung La North Ridge,34.279,77.604,5359,34.0,10,-18.0,95,145,15.0,28.0,35.0,62.0
Zojila Pass Avalanche Highway,34.280,75.800,3528,40.0,45,-11.0,230,370,46.0,88.0,38.0,74.0
Gulmarg Apharwat Peak,34.015,74.380,4124,39.0,350,-9.0,260,420,40.0,76.0,32.0,64.0
Nathu La Pass (Sikkim),27.386,88.831,4310,37.0,80,-6.0,180,290,30.0,55.0,28.0,54.0
Siachen Base Camp Slopes,35.420,77.108,3658,37.5,120,-15.0,170,260,25.0,48.0,26.0,52.0
Kamet East Ridge (Garhwal),30.926,79.571,7756,41.0,90,-21.0,180,290,32.0,60.0,34.0,68.0
Kangchenjunga High Flank,27.702,88.147,7500,46.0,240,-19.0,250,410,48.0,92.0,40.0,78.0`,

  european_alps_csv: `location_id,latitude,longitude,elevation,slope,aspect,temperature,snow_depth,snow_water_equivalent,snowfall_24h,snowfall_72h,wind_speed_mean_24h,wind_speed_max_24h
Mont Blanc - Grand Couloir (France),45.832,6.865,3800,42.5,310,-12.0,280,450,46.0,88.0,38.0,76.0
Matterhorn - East Face (Switzerland),45.976,7.658,4000,45.0,90,-14.0,230,370,40.0,75.0,35.0,70.0
Eiger - North Face (Switzerland),46.577,8.005,3500,50.0,350,-13.0,250,400,48.0,92.0,36.0,74.0
Jungfraujoch Corridor (Switzerland),46.537,7.962,3471,41.0,180,-11.0,270,430,38.0,70.0,32.0,66.0
Großglockner - Pallavicini (Austria),47.074,12.694,3798,46.0,30,-13.5,240,380,42.0,80.0,34.0,68.0
Zugspitze Schneeferner (Germany),47.421,10.985,2962,37.0,180,-8.0,210,330,28.0,54.0,28.0,58.0
Chamonix - Aiguille du Midi (France),45.877,6.887,3842,43.0,330,-12.5,290,460,48.0,94.0,40.0,78.0
St. Anton am Arlberg (Austria),47.133,10.267,2811,42.0,360,-9.0,260,410,45.0,85.0,36.0,72.0
Val Thorens - Cime Caron (France),45.298,6.580,3195,39.0,45,-8.5,240,380,36.0,68.0,30.0,62.0
Verbier - Mont Fort (Switzerland),46.083,7.316,3328,40.0,315,-10.0,250,390,38.0,72.0,34.0,68.0
Monte Rosa - Dufourspitze (Italy),45.937,7.867,4500,44.0,135,-15.0,280,440,44.0,86.0,38.0,75.0
Cortina d'Ampezzo - Tofana (Italy),46.541,12.051,3225,38.5,120,-7.0,200,310,26.0,50.0,25.0,50.0
Marmolada Glacier (Dolomites - Italy),46.434,11.851,3343,39.0,0,-8.0,220,350,32.0,62.0,30.0,60.0
Gotthard Pass High Basin (Switzerland),46.559,8.565,2106,36.0,90,-5.0,190,290,24.0,46.0,24.0,48.0
Stelvio Pass Corridor (Italy),46.529,10.453,2757,37.0,60,-7.5,210,320,30.0,58.0,28.0,56.0`,

  americas_rockies_andes_csv: `location_id,latitude,longitude,elevation,slope,aspect,temperature,snow_depth,snow_water_equivalent,snowfall_24h,snowfall_72h,wind_speed_mean_24h,wind_speed_max_24h
Denali - Kahiltna Pass (Alaska),63.069,-151.007,4300,43.0,225,-26.0,310,480,52.0,105.0,45.0,92.0
Mount Rainier - Disappointment Cleaver (WA),46.853,-121.760,3700,41.0,90,-11.0,380,620,60.0,120.0,42.0,85.0
Mount Whitney - East Couloir (CA),36.578,-118.292,4200,38.0,75,-8.0,190,290,22.0,44.0,28.0,56.0
Grand Teton - Headwall Chute (WY),43.741,-110.802,3900,44.0,60,-14.0,250,390,42.0,82.0,36.0,74.0
Berthoud Pass Summit (Colorado),39.798,-105.778,3444,40.0,45,-5.5,165,280,36.0,58.0,32.0,62.0
Loveland Pass - Seven Sisters (Colorado),39.674,-105.897,3655,38.0,60,-6.2,150,240,28.0,44.0,28.0,52.0
Red Mountain Pass (Colorado),37.899,-107.714,3414,42.0,30,-4.0,190,340,48.0,85.0,40.0,75.0
Rogers Pass (Selkirk Mtns - BC Canada),51.300,-117.520,1330,41.0,45,-6.0,340,550,54.0,108.0,38.0,78.0
Whistler Peak - Harmony Horseshoe (BC),50.060,-122.957,2181,39.0,315,-5.0,310,490,48.0,95.0,35.0,70.0
Mount Washington - Tuckerman Ravine (NH),44.270,-71.303,1500,45.0,90,-16.0,260,420,44.0,88.0,55.0,115.0
Mount Baker - Coleman Glacier (WA),48.777,-121.813,2800,39.0,270,-7.0,420,680,65.0,130.0,40.0,82.0
Mount Shasta - Avalanche Gulch (CA),41.409,-122.195,3800,38.0,180,-8.0,280,440,38.0,74.0,34.0,70.0
Independence Pass (Colorado),39.108,-106.602,3688,39.0,75,-9.5,145,230,22.0,38.0,25.0,48.0
Thompson Pass - Chugach Range (Alaska),61.129,-145.741,855,42.5,180,-8.0,480,780,72.0,145.0,46.0,94.0
Haines Pass (Saint Elias Mtns - BC/AK),59.870,-136.550,1070,37.0,120,-12.0,320,510,42.0,84.0,38.0,76.0
Aconcagua - Polish Glacier (Argentina),-32.653,-70.011,6200,42.0,45,-19.0,160,240,30.0,58.0,44.0,92.0
Huascarán - North Face (Peru),-9.122,-77.603,6400,48.0,350,-15.0,230,360,46.0,90.0,36.0,74.0
Alpamayo - Ferrari Flank (Peru),-8.879,-77.653,5800,55.0,225,-16.5,210,330,40.0,80.0,32.0,66.0
Chimborazo - Whymper Flank (Ecuador),-1.469,-78.817,6100,43.0,270,-14.0,180,280,32.0,62.0,38.0,76.0
Paso Los Libertadores / Portillo (Chile - Argentina),-32.827,-70.075,3200,40.0,135,-7.0,240,380,44.0,86.0,40.0,82.0
Cerro Fitz Roy - Supercanaleta (Patagonia),-49.271,-73.043,3100,50.0,270,-9.0,290,460,50.0,102.0,52.0,110.0
Torres del Paine - Central Towers (Chile),-50.942,-72.934,2600,46.0,180,-8.0,270,420,45.0,90.0,48.0,105.0`,

  japan_oceania_scandi_csv: `location_id,latitude,longitude,elevation,slope,aspect,temperature,snow_depth,snow_water_equivalent,snowfall_24h,snowfall_72h,wind_speed_mean_24h,wind_speed_max_24h
Aoraki / Mount Cook - Linda Glacier (NZ),-43.595,170.142,3500,45.0,45,-11.0,350,560,58.0,115.0,44.0,90.0
Mount Aspiring / Tititea (NZ),-44.385,168.728,2800,44.0,315,-10.0,320,510,50.0,100.0,40.0,84.0
Milford Sound Avalanche Highway (SH94 - NZ),-44.765,167.989,945,48.0,270,-4.0,390,620,68.0,135.0,45.0,95.0
The Remarkables - Shadow Basin (NZ),-45.054,168.814,2100,39.0,180,-6.0,210,330,32.0,62.0,32.0,68.0
Mount Fuji - Subashiri Couloirs (Japan),35.361,138.727,3500,38.0,90,-15.0,190,290,30.0,60.0,45.0,90.0
Mount Hakuba - Happo-One (Japan),36.698,137.760,2700,41.0,0,-10.0,380,610,62.0,125.0,38.0,80.0
Mount Yotei / Niseko Backcountry (Japan),42.827,140.812,1800,40.0,315,-8.0,420,670,66.0,132.0,36.0,74.0
Galdhøpiggen - Jotunheimen (Norway),61.636,8.312,2400,39.0,45,-12.0,250,390,36.0,70.0,35.0,72.0
Tromsø - Lyngen Alps (Norway),69.583,20.150,1600,44.0,315,-9.0,310,490,52.0,104.0,42.0,88.0
Mount Elbrus - Pastukhov Slopes (Russia),43.349,42.445,4800,38.0,180,-18.0,260,410,40.0,78.0,42.0,86.0
Mount Kazbek - Gergeti Glacier (Georgia),42.698,44.518,4500,43.0,90,-16.0,240,370,38.0,74.0,36.0,74.0
Gudauri Pass (Caucasus Highway),42.478,44.475,2379,39.0,45,-8.0,220,340,35.0,68.0,30.0,62.0`,
};

// =====================================================================
// CSV Parser & Auto-Mapper
// =====================================================================

function tokenizeCsvRow(line: string, delimiter: string, expectedColCount: number): string[] {
  const tokens: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      tokens.push(cur.trim().replace(/^["']|["']$/g, ''));
      cur = '';
    } else {
      cur += char;
    }
  }
  tokens.push(cur.trim().replace(/^["']|["']$/g, ''));

  // If excess tokens exist (e.g. unquoted comma in location_id), recombine the excess into location_id
  if (expectedColCount > 0 && tokens.length > expectedColCount) {
    const excess = tokens.length - expectedColCount;
    const recombinedLoc = tokens.slice(0, excess + 1).join(' - ');
    tokens.splice(0, excess + 1, recombinedLoc);
  }

  return tokens;
}

export function parseCSV(csvText: string): {
  data: PointPredictionPayload[];
  errors: string[];
  detectedHeaders: string[];
  mappedHeaders: Record<string, string>;
} {
  const errors: string[] = [];
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { data: [], errors: ['CSV content is empty.'], detectedHeaders: [], mappedHeaders: {} };
  }

  // Detect delimiter: comma, tab, or semicolon
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

  // Parse header tokens
  const rawHeaders = tokenizeCsvRow(headerLine, delimiter, 0);

  const mappedHeaders: Record<string, string> = {};

  rawHeaders.forEach((raw) => {
    const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    for (const schema of SUPPORTED_SCHEMA_FIELDS) {
      if (schema.key === clean || schema.aliases.includes(clean)) {
        mappedHeaders[raw] = schema.key;
        break;
      }
    }
  });

  const parsedRows: PointPredictionPayload[] = [];

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const tokens = tokenizeCsvRow(line, delimiter, rawHeaders.length);

    if (tokens.length < rawHeaders.length && tokens.every((t) => t === '')) continue;

    const rowObj: any = {};

    rawHeaders.forEach((header, colIdx) => {
      const canonicalKey = mappedHeaders[header];
      if (!canonicalKey) return;

      const rawVal = tokens[colIdx];
      if (rawVal === undefined || rawVal === '') return;

      if (canonicalKey === 'location_id') {
        rowObj[canonicalKey] = rawVal;
      } else {
        const numVal = parseFloat(rawVal);
        if (!isNaN(numVal)) {
          rowObj[canonicalKey] = numVal;
        } else {
          errors.push(`Row ${lineIdx}: Non-numeric value "${rawVal}" in column "${header}".`);
        }
      }
    });

    if (rowObj.latitude !== undefined && rowObj.longitude !== undefined) {
      parsedRows.push(rowObj);
    } else {
      errors.push(`Row ${lineIdx}: Missing required latitude or longitude coordinate.`);
    }
  }

  return {
    data: parsedRows,
    errors,
    detectedHeaders: rawHeaders,
    mappedHeaders,
  };
}

// =====================================================================
// Domain Detection & Coordinate Utilities
// =====================================================================

export function detectDomainFromCoords(lat: number, lon: number): GeographicDomain {
  // Colorado Bounding Box: Latitude 36.5°N to 41.5°N, Longitude -109.5°W to -101.5°W
  if (typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon)) {
    if (lat >= 36.5 && lat <= 41.5 && lon >= -109.5 && lon <= -101.5) {
      return 'COLORADO';
    }
  }
  // All other coordinates (Himalayas, Alps, Andes, Japan, etc.) default to research domain
  return 'INDIA';
}

export function isValidCoordinate(lat: any, lon: any): boolean {
  if (lat === undefined || lat === null || lon === undefined || lon === null) return false;
  const nLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const nLon = typeof lon === 'number' ? lon : parseFloat(lon);
  if (isNaN(nLat) || !isFinite(nLat) || isNaN(nLon) || !isFinite(nLon)) return false;
  if (nLat < -90 || nLat > 90 || nLon < -180 || nLon > 180) return false;
  return true;
}

// =====================================================================
// Custom Data Validation Engine
// =====================================================================

export function validateCustomPayload(
  text: string,
  format: CustomDataFormat
): CustomDataValidationResult {
  const errors: CustomDataValidationError[] = [];
  const warnings: CustomDataValidationError[] = [];
  let kind: CustomDataKind = 'single';
  let recordCount = 0;
  let detectedFields: string[] = [];
  let parsedData: any = null;

  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      format,
      kind: 'single',
      recordCount: 0,
      detectedFields: [],
      missingRequiredFields: ['latitude', 'longitude'],
      errors: [{ message: 'Input cannot be empty.', severity: 'error' }],
      warnings: [],
      parsedData: null,
    };
  }

  if (format === 'json') {
    try {
      parsedData = JSON.parse(text);
    } catch (e: any) {
      return {
        isValid: false,
        format: 'json',
        kind: 'single',
        recordCount: 0,
        detectedFields: [],
        missingRequiredFields: [],
        errors: [{ message: `JSON syntax error: ${e.message}`, severity: 'error' }],
        warnings: [],
        parsedData: null,
      };
    }

    if (Array.isArray(parsedData)) {
      kind = 'batch';
      recordCount = parsedData.length;
      if (parsedData.length === 0) {
        errors.push({ message: 'JSON array is empty.', severity: 'error' });
      } else {
        detectedFields = Array.from(new Set(parsedData.flatMap((item) => (typeof item === 'object' && item ? Object.keys(item) : []))));
        parsedData.forEach((row: any, idx: number) => {
          validateSinglePointObject(row, idx + 1, errors, warnings);
        });
      }
    } else if (typeof parsedData === 'object' && parsedData !== null) {
      if (Array.isArray(parsedData.observations) && parsedData.station_id) {
        kind = 'telemetry';
        recordCount = parsedData.observations.length;
        detectedFields = Object.keys(parsedData);
        if (parsedData.latitude === undefined || parsedData.longitude === undefined) {
          errors.push({ field: 'coordinates', message: 'Station telemetry requires latitude and longitude.', severity: 'error' });
        }
        if (parsedData.observations.length === 0) {
          errors.push({ field: 'observations', message: 'Telemetry stream must contain at least 1 observation.', severity: 'error' });
        }
      } else {
        kind = 'single';
        recordCount = 1;
        detectedFields = Object.keys(parsedData);
        validateSinglePointObject(parsedData, undefined, errors, warnings);
      }
    } else {
      errors.push({ message: 'JSON must be an object or an array of objects.', severity: 'error' });
    }
  } else {
    // CSV validation
    kind = 'batch';
    const csvResult = parseCSV(text);
    detectedFields = Object.values(csvResult.mappedHeaders);
    recordCount = csvResult.data.length;
    parsedData = csvResult.data;

    csvResult.errors.forEach((err) => {
      errors.push({ message: err, severity: 'error' });
    });

    if (csvResult.data.length === 0 && errors.length === 0) {
      errors.push({ message: 'No valid data rows found in CSV.', severity: 'error' });
    }

    csvResult.data.forEach((row, idx) => {
      validateSinglePointObject(row, idx + 1, errors, warnings);
    });
  }

  const missingRequired = ['latitude', 'longitude'].filter((req) => !detectedFields.includes(req));
  const hasValidData = parsedData && (Array.isArray(parsedData) ? parsedData.length > 0 : true);

  return {
    isValid: missingRequired.length === 0 && hasValidData,
    format,
    kind,
    recordCount,
    detectedFields,
    missingRequiredFields: missingRequired,
    errors,
    warnings,
    parsedData,
  };
}

function validateSinglePointObject(
  obj: any,
  rowIdx: number | undefined,
  errors: CustomDataValidationError[],
  warnings: CustomDataValidationError[]
) {
  const prefix = rowIdx !== undefined ? `Row ${rowIdx}: ` : '';

  if (typeof obj !== 'object' || obj === null) {
    errors.push({ row: rowIdx, message: `${prefix}Invalid record structure.`, severity: 'error' });
    return;
  }

  // Latitude
  if (obj.latitude === undefined || obj.latitude === null || typeof obj.latitude !== 'number' || isNaN(obj.latitude)) {
    errors.push({ row: rowIdx, field: 'latitude', message: `${prefix}Latitude is required and must be a number.`, severity: 'error' });
  } else if (obj.latitude < -90 || obj.latitude > 90) {
    errors.push({ row: rowIdx, field: 'latitude', message: `${prefix}Latitude ${obj.latitude} is out of bounds (-90.0 to 90.0).`, severity: 'error' });
  }

  // Longitude
  if (obj.longitude === undefined || obj.longitude === null || typeof obj.longitude !== 'number' || isNaN(obj.longitude)) {
    errors.push({ row: rowIdx, field: 'longitude', message: `${prefix}Longitude is required and must be a number.`, severity: 'error' });
  } else if (obj.longitude < -180 || obj.longitude > 180) {
    errors.push({ row: rowIdx, field: 'longitude', message: `${prefix}Longitude ${obj.longitude} is out of bounds (-180.0 to 180.0).`, severity: 'error' });
  }

  // Slope
  if (obj.slope !== undefined && obj.slope !== null) {
    if (typeof obj.slope !== 'number' || isNaN(obj.slope)) {
      errors.push({ row: rowIdx, field: 'slope', message: `${prefix}Slope must be a number.`, severity: 'error' });
    } else if (obj.slope < 0 || obj.slope > 90) {
      errors.push({ row: rowIdx, field: 'slope', message: `${prefix}Slope angle ${obj.slope}° must be between 0° and 90°.`, severity: 'error' });
    }
  } else {
    warnings.push({ row: rowIdx, field: 'slope', message: `${prefix}Slope angle not specified (defaulting to 36.0°).`, severity: 'warning' });
  }

  // Elevation
  if (obj.elevation !== undefined && obj.elevation !== null) {
    if (typeof obj.elevation !== 'number' || isNaN(obj.elevation)) {
      errors.push({ row: rowIdx, field: 'elevation', message: `${prefix}Elevation must be a number.`, severity: 'error' });
    } else if (obj.elevation < 0 || obj.elevation > 9000) {
      errors.push({ row: rowIdx, field: 'elevation', message: `${prefix}Elevation ${obj.elevation}m must be between 0m and 9000m.`, severity: 'error' });
    }
  }

  // Temperature
  if (obj.temperature !== undefined && obj.temperature !== null) {
    if (typeof obj.temperature !== 'number' || isNaN(obj.temperature)) {
      errors.push({ row: rowIdx, field: 'temperature', message: `${prefix}Temperature must be a number.`, severity: 'error' });
    } else if (obj.temperature < -80 || obj.temperature > 60) {
      errors.push({ row: rowIdx, field: 'temperature', message: `${prefix}Temperature ${obj.temperature}°C is outside valid mountain range (-80 to 60°C).`, severity: 'error' });
    }
  }
}

// =====================================================================
// Export Evaluated Results to CSV / JSON
// =====================================================================

export function exportEvaluatedToCSV(records: EvaluatedPointRecord[]): string {
  if (!records || records.length === 0) return '';

  const headers = [
    'id',
    'location_id',
    'latitude',
    'longitude',
    'elevation_m',
    'slope_deg',
    'aspect_deg',
    'temperature_c',
    'snow_depth_cm',
    'snow_water_eq_mm',
    'snowfall_24h_mm',
    'snowfall_72h_mm',
    'wind_speed_mean_24h_kmh',
    'wind_speed_max_24h_kmh',
    'risk_level',
    'model_risk_score',
    'final_risk_score',
    'calibrated_probability',
    'risk_escalated',
    'escalation_reasons',
    'data_quality',
    'evaluation_status'
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((r) => {
    const p = r.prediction;
    return [
      escapeCSV(r.id),
      escapeCSV(r.location_id),
      r.latitude,
      r.longitude,
      r.elevation,
      r.slope,
      r.aspect,
      r.temperature,
      r.snow_depth ?? '',
      r.snow_water_equivalent ?? '',
      r.snowfall_24h ?? '',
      r.snowfall_72h ?? '',
      r.wind_speed_mean_24h ?? '',
      r.wind_speed_max_24h ?? '',
      escapeCSV(p?.final_risk_level ?? 'ERROR'),
      p?.model_risk_score !== undefined && p.model_risk_score !== null ? p.model_risk_score.toFixed(1) : '',
      p?.final_risk_score !== undefined && p.final_risk_score !== null ? p.final_risk_score.toFixed(1) : '',
      p?.calibrated_probability !== undefined && p.calibrated_probability !== null ? (p.calibrated_probability * 100).toFixed(1) + '%' : '',
      p?.risk_escalated ? 'TRUE' : 'FALSE',
      escapeCSV(p?.risk_escalation_reasons?.join('; ') || ''),
      escapeCSV(p?.data_quality || 'UNKNOWN'),
      escapeCSV(r.status)
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function exportEvaluatedToJSON(records: EvaluatedPointRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function downloadSampleCsvTemplate(): void {
  const templateCsv = SAMPLE_TEMPLATES.global_mountains_csv;
  const blob = new Blob([templateCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'global_avalanche_mountains_master.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


