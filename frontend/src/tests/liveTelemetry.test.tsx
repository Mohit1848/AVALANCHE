import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RiskAssessmentPanel } from '../components/risk/RiskAssessmentPanel';
import { Header } from '../components/common/Header';
import type { PredictionContext, HealthStatus, TelemetryFreshnessStatus } from '../types';

describe('Live Colorado SNOTEL / AWDB Telemetry Integration', () => {
  const baseLiveContext: PredictionContext = {
    target_id: 'SNTL_335',
    target_name: 'SNOTEL 335: Berthoud Summit',
    target_type: 'STATION',
    latitude: 39.798,
    longitude: -105.778,
    elevation: 3444,
    slope: 38.0,
    aspect: 45.0,
    aspect_direction: 'NE',
    temperature: -5.5,
    humidity: 70.0,
    pressure: 640.0,
    precipitation: 4.2,
    wind_speed_mean_24h: 22.0,
    wind_speed_max_24h: 45.0,
    snow_depth: 145.0,
    snow_water_equivalent: 260.0,
    snowfall_6h: 6.0,
    snowfall_24h: 18.0,
    snowfall_72h: 32.0,
    temperature_delta_24h: -2.5,
    temperature_delta_72h: -4.0,
    telemetry_timestamp: '2026-08-20T14:30:00Z',
    telemetry_age_minutes: 25,
    data_quality: 'GOOD',
    freshness_state: 'GOOD',
    assessment_status: 'CURRENT',
    prediction_available: true,
    suppression_reason: null,
    current_utc: '2026-08-20T14:55:00Z',
    telemetry_status: 'GOOD',
    last_observation_timestamp: '2026-08-20T14:30:00Z',
    telemetry_source: 'USDA NRCS AWDB SNOTEL (Live Stream)',
    terrain_source: 'Copernicus 30m DEM (Valid)',
    prediction: {
      domain: 'COLORADO',
      model_risk_score: 65,
      final_risk_score: 65,
      model_risk_level: 'MEDIUM',
      final_risk_level: 'MEDIUM',
      risk_level: 'MEDIUM',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD',
      warnings: [],
      raw_probability: 0.62,
      calibrated_probability: 0.65,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.4,
      thresholds: { medium: 0.4, high: 0.7 },
      rule_evaluations: [],
      provenance: { source: 'USDA_NRCS_AWDB' },
      disclaimer: 'Research Decision-Support Prototype.',
    },
    rules_evaluation: [],
    isLoading: false,
    error: null,
  };

  it('renders LIVE stream banner and observation age when telemetry is fresh', () => {
    render(<RiskAssessmentPanel context={baseLiveContext} onRefresh={vi.fn()} />);

    expect(screen.getByText(/TELEMETRY: LIVE • SOURCE: NRCS AWDB/i)).toBeTruthy();
    expect(screen.getByText(/AGE: 25m/i)).toBeTruthy();
    expect(screen.getByText(/ACTIVE PREDICTION/i)).toBeTruthy();
  });

  it('renders expandable LIVE TELEMETRY DETAILS with exact physical variables', () => {
    render(<RiskAssessmentPanel context={baseLiveContext} onRefresh={vi.fn()} />);

    expect(screen.getByText(/LIVE TELEMETRY DETAILS \(USDA NRCS AWDB\)/i)).toBeTruthy();
    expect(screen.getByText(/-5.5 °C/i)).toBeTruthy();
    expect(screen.getByText(/145 cm/i)).toBeTruthy();
    expect(screen.getByText(/260 mm/i)).toBeTruthy();
    expect(screen.getByText(/4.2 mm/i)).toBeTruthy();
    expect(screen.getByText(/22 km\/h \(24h mean\)/i)).toBeTruthy();
  });

  it('displays MISSING for stations lacking wind anemometer without fabricating values', () => {
    const missingWindContext: PredictionContext = {
      ...baseLiveContext,
      wind_speed_mean_24h: null,
      wind_speed_max_24h: null,
    };
    render(<RiskAssessmentPanel context={missingWindContext} onRefresh={vi.fn()} />);

    expect(screen.getByText(/MISSING \/ SENSOR NOT MONITORED/i)).toBeTruthy();
  });

  it('suppresses live prediction and displays prominent suppression banner with reason when stale', () => {
    const staleContext: PredictionContext = {
      ...baseLiveContext,
      telemetry_timestamp: '2026-08-20T08:00:00Z',
      telemetry_age_minutes: 452,
      freshness_state: 'STALE',
      data_quality: 'STALE',
      assessment_status: 'SUPPRESSED',
      prediction_available: false,
      prediction: {
        ...baseLiveContext.prediction!,
        final_risk_level: 'STALE',
        model_risk_level: 'STALE',
      },
    };

    render(<RiskAssessmentPanel context={staleContext} onRefresh={vi.fn()} />);

    expect(screen.getAllByText(/LIVE PREDICTION SUPPRESSED/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Reason: Latest NRCS AWDB observation exceeds the 6-hour freshness limit./i)).toBeTruthy();
    expect(screen.getAllByText(/2026-08-20 08:00 UTC/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/\(SUPPRESSED\)/i)).toBeTruthy();
  });

  it('renders DATA SOURCE & PROVENANCE section with complete metadata disclosure', () => {
    render(<RiskAssessmentPanel context={baseLiveContext} onRefresh={vi.fn()} />);

    expect(screen.getByText(/DATA SOURCE & PROVENANCE/i)).toBeTruthy();
    expect(screen.getAllByText(/USDA NRCS AWDB/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/SNTL/i)).toBeTruthy();
  });

  it('renders Header with STATIONS breakdown, age, and SYNC NOW button', () => {
    const health: HealthStatus = {
      status: 'ok',
      service: 'avalanche-risk-intelligence-api',
      version: '2.0.0-research',
      subsystems: { api: 'ok', model: 'ok', database: 'ok', risk_engine: 'ok', schema: 'SYNCHRONIZED' },
      model_loaded: true,
      model_version: 'colorado_avalanche_rf_v3',
      feature_schema_version: 'v2_spatiotemporal_17f',
      calibrated: true,
      active_operating_threshold: 0.4,
      thresholds: { medium: 0.4, high: 0.7 },
      schema_status: 'SYNCHRONIZED',
      telemetry_age_minutes: 452,
      disclaimer: 'Research Prototype.',
    };

    const freshness: TelemetryFreshnessStatus = {
      overall_status: 'STALE',
      last_update: '2026-08-20T08:00:00Z',
      age_minutes: 452,
      stations_total: 10,
      stations_healthy: 0,
      stations_degraded: 0,
      stations_stale: 10,
      warnings: [],
    };

    const mockSync = vi.fn();

    render(
      <Header
        health={health}
        freshness={freshness}
        context={baseLiveContext}
        activeTab="console"
        setActiveTab={vi.fn()}
        isLivePolling={true}
        setIsLivePolling={vi.fn()}
        selectedDomain="COLORADO"
        setSelectedDomain={vi.fn()}
        onSync={mockSync}
      />
    );

    expect(screen.getByText(/NRCS AWDB/i)).toBeTruthy();
    expect(screen.getByText(/STATIONS:/i)).toBeTruthy();
    expect(screen.getByText(/0 LIVE/i)).toBeTruthy();
    expect(screen.getByText(/10 STALE/i)).toBeTruthy();

    const syncBtn = screen.getByText(/SYNC NOW/i);
    expect(syncBtn).toBeTruthy();
    fireEvent.click(syncBtn);
    expect(mockSync).toHaveBeenCalledTimes(1);
  });
});
