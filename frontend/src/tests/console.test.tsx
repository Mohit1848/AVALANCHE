import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskAssessmentPanel } from '../components/risk/RiskAssessmentPanel';
import { Header } from '../components/common/Header';
import { ModelResearchPage } from '../components/model/ModelResearchPage';
import { TerrainPanel } from '../components/terrain/TerrainPanel';
import { RiskHistoryTimeline } from '../components/history/RiskHistoryTimeline';
import { HistoricalPlaybackPanel } from '../components/history/HistoricalPlaybackPanel';
import { SpatialIntelligencePanel } from '../components/spatial/SpatialIntelligencePanel';
import { IndianPeakPanel } from '../components/india/IndianPeakPanel';
import { api } from '../services/api';
import type {
  RiskPredictionResponse,
  SelectedLocationState,
  PersistedPredictionRecord,
  ModelMetadata,
  SpatialPredictionGridResponse,
  ZoneRiskSummary,
  SpatialValidationMetrics,
  LayerVisibilityState,
  IndianPeak,
  IndianRegion,
  PredictionContext,
} from '../types';

describe('Phase 4 & 5: Mountain Risk Intelligence Console - Verification Suite', () => {
  const dummyLocation: SelectedLocationState = {
    type: 'ZONE',
    name: 'Front Range Corridor',
    latitude: 39.75,
    longitude: -105.80,
    elevation: 3550.0,
    slope: 38.0,
    aspect: 45.0,
    temperature: -6.5,
    snow_depth: 140.0,
    snow_water_equivalent: 225.0,
    snowfall_6h: 8.0,
    snowfall_24h: 34.0,
    snowfall_72h: 52.0,
    temperature_delta_24h: -3.0,
    wind_speed_mean_24h: 24.0,
    wind_speed_max_24h: 48.0,
    telemetry_age_minutes: 38,
  };

  function createTestContext(
    loc: SelectedLocationState,
    pred: RiskPredictionResponse | null,
    isLoading = false
  ): PredictionContext {
    return {
      target_id: loc.name,
      target_name: loc.name,
      target_type: 'COORDINATE',
      latitude: loc.latitude,
      longitude: loc.longitude,
      elevation: loc.elevation,
      slope: loc.slope,
      aspect: loc.aspect,
      temperature: loc.temperature,
      humidity: loc.humidity ?? 65,
      pressure: loc.pressure ?? 700,
      precipitation: loc.precipitation ?? 0,
      wind_speed_mean_24h: loc.wind_speed_mean_24h,
      wind_speed_max_24h: loc.wind_speed_max_24h,
      snow_depth: loc.snow_depth,
      snow_water_equivalent: loc.snow_water_equivalent,
      snowfall_6h: loc.snowfall_6h,
      snowfall_24h: loc.snowfall_24h,
      snowfall_72h: loc.snowfall_72h,
      temperature_delta_24h: loc.temperature_delta_24h,
      temperature_delta_72h: loc.temperature_delta_72h ?? null,
      telemetry_timestamp: new Date().toISOString(),
      telemetry_age_minutes: loc.telemetry_age_minutes ?? 0,
      data_quality: pred?.data_quality ?? 'GOOD',
      freshness_state: 'GOOD',
      assessment_status: 'CURRENT',
      prediction_available: !!pred,
      suppression_reason: null,
      current_utc: new Date().toISOString(),
      telemetry_status: 'GOOD',
      last_observation_timestamp: new Date().toISOString(),
      prediction: pred,
      isLoading,
    };
  }

  it('1. Renders FRESH telemetry & LOW risk prediction', () => {
    const lowPred: RiskPredictionResponse = {
      model_risk_score: 15.0,
      final_risk_score: 15.0,
      model_risk_level: 'LOW',
      final_risk_level: 'LOW',
      risk_level: 'LOW',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD',
      warnings: [],
      raw_probability: 0.15,
      calibrated_probability: 0.15,
      model_version: 'calibrated_random_forest_2015_2024',
      operating_threshold: 0.40,
      thresholds: { medium: 0.40, high: 0.70 },
      provenance: { synthetic: false },
      disclaimer: 'Research decision-support output.',
    };

    render(
      <RiskAssessmentPanel
        context={createTestContext(dummyLocation, lowPred)}
        onRefresh={() => {}}
      />
    );

    // Semantic selector: the hero score is intentionally split into
    // value + '/100' spans for typographic hierarchy.
    expect(screen.getByTestId('policy-risk-score').textContent).toMatch(/15\s*\/100/);
    expect(screen.getByTestId('model-risk-score').textContent).toMatch(/15/);
    expect(screen.getByTestId('data-quality-badge').textContent).toMatch(/GOOD/);
    expect(screen.queryByText(/STALE DATA PROTECTION ACTIVE/i)).toBeNull();
  });

  it('2. STALE DATA PROTECTION: Suppresses outdated prediction when telemetry age > 6h', () => {
    const staleLocation: SelectedLocationState = {
      ...dummyLocation,
      telemetry_age_minutes: 480, // 8 hours old
    };

    const stalePred: RiskPredictionResponse = {
      model_risk_score: 80.0,
      final_risk_score: 80.0,
      model_risk_level: 'HIGH',
      final_risk_level: 'HIGH',
      risk_level: 'HIGH',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'STALE',
      warnings: ['Telemetry age is 480 minutes old.'],
      raw_probability: 0.80,
      calibrated_probability: 0.82,
      model_version: 'calibrated_random_forest_2015_2024',
      operating_threshold: 0.40,
      thresholds: { medium: 0.40, high: 0.70 },
      provenance: { synthetic: false },
      disclaimer: 'Research decision-support output.',
    };

    render(
      <RiskAssessmentPanel
        context={createTestContext(staleLocation, stalePred)}
        onRefresh={() => {}}
      />
    );

    expect(screen.getByText(/STALE DATA PROTECTION ACTIVE/i)).toBeDefined();
    expect(screen.getByText(/STALE \/ NOT CURRENT/i)).toBeDefined();
  });

  it('3. Renders DETERMINISTIC HEURISTIC BREAKDOWN and Policy Escalation', () => {
    const escalatedPred: RiskPredictionResponse = {
      model_risk_score: 52.0,
      final_risk_score: 70.0,
      model_risk_level: 'MEDIUM',
      final_risk_level: 'HIGH',
      risk_level: 'HIGH',
      risk_escalated: true,
      risk_escalation_reasons: [
        'Deterministic Engineering Rule: Heavy snowfall (34.0mm/24h) on steep starting slope (38.0°).'
      ],
      data_quality: 'GOOD',
      warnings: ['Deterministic Engineering Rule: Heavy snowfall (34.0mm/24h) on steep starting slope (38.0°).'],
      raw_probability: 0.48,
      calibrated_probability: 0.52,
      model_version: 'calibrated_random_forest_2015_2024',
      operating_threshold: 0.40,
      thresholds: { medium: 0.40, high: 0.70 },
      provenance: { synthetic: false },
      disclaimer: 'Research decision-support output.',
    };

    render(
      <RiskAssessmentPanel
        context={createTestContext(dummyLocation, escalatedPred)}
        onRefresh={() => {}}
      />
    );

    expect(screen.getByText(/POLICY ESCALATION: MODEL RISK/i)).toBeDefined();
    expect(screen.getByText(/ENGINEERING HEURISTIC POLICIES/i)).toBeDefined();
    expect(screen.getAllByText(/TRIGGERED \(ESCALATED\)/i).length).toBeGreaterThanOrEqual(1);
  });

  it('4. Renders INSUFFICIENT_DATA fail-safe state correctly', () => {
    const insufficientPred: RiskPredictionResponse = {
      model_risk_score: null,
      final_risk_score: null,
      model_risk_level: 'INSUFFICIENT_DATA',
      final_risk_level: 'INSUFFICIENT_DATA',
      risk_level: 'INSUFFICIENT_DATA',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'INSUFFICIENT',
      warnings: ["Missing critical features: ['slope', 'temperature']. Cannot produce reliable risk estimate."],
      raw_probability: null,
      calibrated_probability: null,
      model_version: 'calibrated_random_forest_2015_2024',
      operating_threshold: 0.40,
      thresholds: { medium: 0.40, high: 0.70 },
      provenance: { synthetic: false },
      disclaimer: 'Research decision-support output.',
    };

    render(
      <RiskAssessmentPanel
        context={createTestContext(dummyLocation, insufficientPred)}
        onRefresh={() => {}}
      />
    );

    expect(screen.getAllByText(/INSUFFICIENT_DATA/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('data-quality-badge').textContent).toMatch(/INSUFFICIENT/);
  });

  it('5. Renders System Status Header with active pass count', () => {
    render(
      <Header
        activeTab="console"
        setActiveTab={() => {}}
        activePassCount={8}
      />
    );

    expect(screen.getByText(/AVALANCHE RISK INTELLIGENCE/i)).toBeDefined();
    expect(screen.getByText(/8 Passes Active/i)).toBeDefined();
  });

  it('6. Renders Terrain Panel with scientifically grounded heuristic language', () => {
    render(<TerrainPanel context={createTestContext(dummyLocation, null)} />);
    expect(screen.getByText('38.0°')).toBeDefined();
    expect(screen.getByText(/30°–45° Prone Range \(Heuristic\)/i)).toBeDefined();
    expect(screen.getByText(/Wind-loading assessment requires localized wind-direction telemetry/i)).toBeDefined();
  });

  it('7. Renders Risk History Timeline & Explainable Transitions', () => {
    const sampleHistory: PersistedPredictionRecord[] = [
      {
        prediction_id: 'PRED_1',
        station_id: '586',
        zone_id: 'CO_FRONT_RANGE',
        timestamp: '2024-01-15T10:00:00Z',
        evaluation_timestamp: '2024-01-15T10:00:00Z',
        model_version: 'calibrated_random_forest_2015_2024',
        dataset_version: '2015_2024_expanded',
        feature_schema_version: 'v2_spatiotemporal_17f',
        risk_engine_version: '2.0.0',
        raw_probability: 0.15,
        calibrated_probability: 0.18,
        model_risk_score: 18.0,
        final_risk_score: 18.0,
        model_risk_level: 'LOW',
        final_risk_level: 'LOW',
        risk_escalated: false,
        risk_escalation_reasons: [],
        data_quality: 'GOOD',
        warnings: [],
      },
    ];

    render(<RiskHistoryTimeline predictions={sampleHistory} />);
    expect(screen.getByText(/TEMPORAL RISK TRANSITION MONITORING/i)).toBeDefined();
    expect(screen.getByText(/CALIBRATED PROBABILITY & POLICY RISK OVER TIME/i)).toBeDefined();
  });

  it('8. Renders Historical Reconstruction Playback with clear Non-Forecast disclaimer', () => {
    render(<HistoricalPlaybackPanel />);
    expect(screen.getByText(/HISTORICAL RECONSTRUCTION • NOT A LIVE FORECAST/i)).toBeDefined();
    expect(screen.getAllByText(/Berthoud Pass Heavy Slab Cycle/i).length).toBeGreaterThanOrEqual(1);
  });

  it('9. Renders Model Research Page with walk-forward validation and feature importances', () => {
    const meta: ModelMetadata = {
      model_name: 'Calibrated Random Forest',
      model_version: 'calibrated_random_forest_2015_2024',
      feature_schema_version: 'v2_spatiotemporal_17f',
      training_seasons: ['2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020', '2020-2021'],
      total_training_records: 48,
      features: ['slope', 'snowfall_72h', 'snowfall_24h'],
      calibration_method: 'Sigmoid',
      validation_strategy: 'Walk-forward chronological',
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
      ],
      disclaimer: 'Research Decision-Support Service.',
    };

    render(<ModelResearchPage metadata={meta} />);
    expect(screen.getByText('91.67%')).toBeDefined();
    expect(screen.getByText(/11 \/ 12 positive events detected/i)).toBeDefined();
    expect(screen.getByText('0.9014')).toBeDefined();
    expect(screen.getByText(/SPATIAL INTERPOLATION VALIDATION/i)).toBeDefined();
  });

  it('10. Renders Spatial Intelligence Panel with IDW parameters and LOSO cross validation', () => {
    const dummyValidation: SpatialValidationMetrics = {
      title: 'SPATIAL INTERPOLATION VALIDATION',
      method: 'Inverse Distance Weighting (IDW)',
      validation_strategy: 'Leave-One-Station-Out (LOSO)',
      temporal_filter: 'T_obs <= T_target',
      power: 2.0,
      search_radius_km: 35.0,
      variables: {
        temperature: { mae: 1.42, rmse: 1.85, bias: -0.18, n_stations_evaluated: 10 },
        snowfall_24h: { mae: 4.80, rmse: 6.25, bias: 0.45, n_stations_evaluated: 10 },
        snow_water_equivalent: { mae: 18.50, rmse: 24.10, bias: -1.20, n_stations_evaluated: 10 },
      },
      disclaimer: 'Evaluates spatial feature interpolation error between stations.',
    };

    const dummyZones: ZoneRiskSummary[] = [
      {
        zone_id: 'CO_FRONT_RANGE',
        zone_name: 'Front Range Corridor',
        timestamp: '2024-01-15T12:00:00Z',
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
    ];

    const layerVis: LayerVisibilityState = {
      historicalEvents: true,
      snotelStations: true,
      forecastZones: true,
      highResTerrain: true,
      contours20m: false,
      contours50m: true,
      contours100m: true,
      riskSurface: true,
    };

    render(
      <SpatialIntelligencePanel
        onGenerateRiskSurface={async () => {}}
        isLoadingSurface={false}
        activeRiskSurface={null}
        forecastZones={dummyZones}
        spatialValidation={dummyValidation}
        layerVisibility={layerVis}
        onToggleLayer={() => {}}
      />
    );

    expect(screen.getByText(/SPATIAL INTELLIGENCE & MULTI-STATION IDW INTERPOLATION/i)).toBeDefined();
    expect(screen.getByText(/PHYSICAL FEATURE INTERPOLATION FIRST/i)).toBeDefined();
    expect(screen.getByText(/GENERATE RESEARCH RISK SURFACE/i)).toBeDefined();
    expect(screen.getByText('Front Range Corridor')).toBeDefined();
    expect(screen.getByText(/1.42°C/i)).toBeDefined();
    expect(screen.getByText(/4.80 mm/i)).toBeDefined();
  });

  it('11. Renders Spatial Uncertainty Alert when spatial coverage is degraded', () => {
    const dummySurface: SpatialPredictionGridResponse = {
      title: 'RESEARCH RISK SURFACE',
      bounds: { min_latitude: 39.60, max_latitude: 39.85, min_longitude: -105.95, max_longitude: -105.70 },
      grid_points_count: 4,
      timestamp: '2024-01-15T12:00:00Z',
      model_version: 'calibrated_random_forest_2015_2024',
      dataset_version: '2015_2024_expanded',
      feature_schema_version: 'v2_spatiotemporal_17f',
      risk_engine_version: '2.0.0',
      spatial_method: 'IDW',
      spatial_method_version: '1.0',
      points: [
        {
          latitude: 39.65,
          longitude: -105.85,
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
          model_risk_level: 'MEDIUM',
          final_risk_level: 'HIGH',
          risk_escalated: true,
          risk_escalation_reasons: ['Heavy 24h snowfall on steep slope'],
          spatial_quality: 'DEGRADED',
          nearest_station_distance_km: 32.5,
          station_count: 1,
          stations_used: ['586'],
          spatial_warning: 'Spatial coverage is DEGRADED: Single-station estimate.',
        },
      ],
      summary: {
        total_points: 4,
        high_risk_points: 2,
        medium_risk_points: 1,
        low_risk_points: 1,
        high_risk_fraction: 0.50,
      },
      disclaimer: 'Interpolated/model-derived research visualization — not an official avalanche forecast.',
    };

    const layerVis: LayerVisibilityState = {
      historicalEvents: true,
      snotelStations: true,
      forecastZones: true,
      highResTerrain: true,
      contours20m: false,
      contours50m: true,
      contours100m: true,
      riskSurface: true,
    };

    render(
      <SpatialIntelligencePanel
        onGenerateRiskSurface={async () => {}}
        isLoadingSurface={false}
        activeRiskSurface={dummySurface}
        forecastZones={[]}
        spatialValidation={null}
        layerVisibility={layerVis}
        onToggleLayer={() => {}}
      />
    );

    expect(screen.getByText(/ACTIVE RESEARCH RISK SURFACE SUMMARY/i)).toBeDefined();
    expect(screen.getByText(/Spatial Uncertainty Notice:/i)).toBeDefined();
    expect(screen.getByText(/Portions of this grid rely on sparse station density/i)).toBeDefined();
  });

  it('12. Renders Decision Threshold Tradeoffs and Calibration Reliability on Model Research Page', () => {
    const meta: ModelMetadata = {
      model_name: 'Calibrated Random Forest',
      model_version: 'calibrated_random_forest_2015_2024',
      feature_schema_version: 'v2_spatiotemporal_17f',
      training_seasons: ['2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020', '2020-2021'],
      total_training_records: 48,
      features: ['slope', 'snowfall_72h', 'snowfall_24h'],
      calibration_method: 'Sigmoid',
      validation_strategy: 'Walk-forward chronological',
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
      ],
      disclaimer: 'Research Decision-Support Service.',
    };

    render(<ModelResearchPage metadata={meta} />);
    expect(screen.getByText(/DECISION THRESHOLD TRADEOFF ANALYSIS/i)).toBeDefined();
    expect(screen.getByText(/MULTI-MODEL ALGORITHM BENCHMARK/i)).toBeDefined();
    expect(screen.getByText(/PROBABILITY CALIBRATION & RELIABILITY CURVE/i)).toBeDefined();
    expect(screen.getByText(/MODEL ASSOCIATION ONLY \(NOT CAUSALITY\)/i)).toBeDefined();
  });

  it('13. Renders Indian Himalayan Peak Panel with GEOGRAPHIC ONLY risk status and terrain unavailable notice', () => {
    const nandaDevi: IndianPeak = {
      id: 'IN-ND-001',
      name: 'Nanda Devi',
      country: 'India',
      state: 'Uttarakhand',
      region: 'Garhwal Himalaya',
      mountain_range: 'Garhwal Himalaya',
      latitude: 30.376,
      longitude: 79.971,
      elevation_m: 7816,
      type: 'MAJOR_PEAK',
      data_source: 'Survey of India / GeoNames',
      terrain_source: 'Copernicus GLO-30 / Survey of India DEM',
      verified: true,
      risk_capability: 'GEOGRAPHIC_ONLY',
    };

    render(<IndianPeakPanel peak={nandaDevi} />);

    expect(screen.getByText('Nanda Devi')).toBeDefined();
    expect(screen.getByText('7,816 m')).toBeDefined();
    expect(screen.getByText('Uttarakhand')).toBeDefined();
    expect(screen.getByText(/Terrain: NOT AVAILABLE/i)).toBeDefined();
    expect(screen.getByText(/INDIAN GEOGRAPHIC MODE — Risk Prediction: NOT ENABLED/i)).toBeDefined();
    expect(screen.getByText(/The current statistical avalanche model was trained and evaluated on Colorado/i)).toBeDefined();
    expect(screen.getByText('GEOGRAPHIC_ONLY')).toBeDefined();
  });

  it('14. Validates Indian Peak Catalog completeness & coordinate bounds from API service', async () => {
    const peaksRes = await api.getIndianPeaks();
    expect(peaksRes.count).toBeGreaterThanOrEqual(19);

    const requiredPeaks = [
      'Nanda Devi', 'Kamet', 'Saser Kangri', 'Mamostong Kangri', 'Saltoro Kangri',
      'Nun', 'Kun', 'Chaukhamba', 'Trishul', 'Nilkanth', 'Mana Peak',
      'Reo Purgyil', 'Deo Tibba', 'Hanuman Tibba', 'Kangchenjunga',
      'Jongsong Peak', 'Kabru', 'Pauhunri', 'Siniolchu'
    ];

    const loadedNames = peaksRes.peaks.map((p: IndianPeak) => p.name);
    for (const req of requiredPeaks) {
      expect(loadedNames).toContain(req);
    }

    for (const peak of peaksRes.peaks) {
      expect(peak.country).toBe('India');
      expect(peak.verified).toBe(true);
      expect(peak.risk_capability).toBe('GEOGRAPHIC_ONLY');
      expect(peak.latitude).toBeGreaterThanOrEqual(25.0);
      expect(peak.latitude).toBeLessThanOrEqual(38.0);
      expect(peak.longitude).toBeGreaterThanOrEqual(70.0);
      expect(peak.longitude).toBeLessThanOrEqual(92.0);
      expect(peak.elevation_m).toBeGreaterThanOrEqual(5000);
    }
  });

  it('15. Validates Model Safety Guard: Indian Himalayan peaks do not trigger Colorado ML predictions', async () => {
    const nandaDevi = await api.getIndianPeak('IN-ND-001');
    expect(nandaDevi.risk_capability).toBe('GEOGRAPHIC_ONLY');
    expect(nandaDevi.name).toBe('Nanda Devi');

    // Confirm that the Indian peak catalog clearly decouples risk predictions
    const regionsRes = await api.getIndianRegions();
    expect(regionsRes.count).toBe(5);
    expect(regionsRes.regions.map((r: IndianRegion) => r.state)).toContain('Uttarakhand');
    expect(regionsRes.regions.map((r: IndianRegion) => r.state)).toContain('Ladakh');
    expect(regionsRes.regions.map((r: IndianRegion) => r.state)).toContain('Sikkim');
  });

  it('16. Renders Header with modern operational navigation tabs', () => {
    render(
      <Header
        activeTab="console"
        setActiveTab={() => {}}
        activePassCount={8}
      />
    );

    expect(screen.getByText(/Operations Console/i)).toBeDefined();
    expect(screen.getByText(/CSV Data Studio/i)).toBeDefined();
    expect(screen.getByText(/Snow & Weather Analytics/i)).toBeDefined();
    expect(screen.getByText(/Safety Advisories/i)).toBeDefined();
  });
});


