import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RiskAssessmentPanel } from '../components/risk/RiskAssessmentPanel';
import { TerrainPanel } from '../components/terrain/TerrainPanel';
import { SnowpackPanel } from '../components/snowpack/SnowpackPanel';
import { WeatherPanel } from '../components/weather/WeatherPanel';
import type { PredictionContext } from '../types';

describe('Colorado Risk Console: Single Source of Truth & Policy Consistency Suite', () => {
  const dummyContextBerthoud: PredictionContext = {
    target_id: '335',
    target_name: 'SNOTEL 335: Berthoud Summit',
    target_type: 'STATION',
    latitude: 39.798,
    longitude: -105.778,
    elevation: 3444,
    slope: 36.0,
    aspect: 45.0,
    temperature: -10.0,
    humidity: 70.0,
    pressure: 670.0,
    precipitation: 0.0,
    wind_speed_mean_24h: 15.0,
    wind_speed_max_24h: 30.0,
    snow_depth: 115.0,
    snow_water_equivalent: 195.0,
    snowfall_6h: 2.0,
    snowfall_24h: 7.5,
    snowfall_72h: 7.5,
    temperature_delta_24h: -1.0,
    temperature_delta_72h: -2.0,
    telemetry_timestamp: '2026-08-20T12:00:00Z',
    telemetry_age_minutes: 38,
    data_quality: 'GOOD',
    freshness_state: 'GOOD',
    assessment_status: 'CURRENT',
    prediction_available: true,
    suppression_reason: null,
    current_utc: '2026-08-20T12:38:00Z',
    last_observation_timestamp: '2026-08-20T12:00:00Z',
    telemetry_status: 'GOOD',
    telemetry_source: 'SNOTEL Automated Telemetry (AWDB)',
    terrain_source: 'Copernicus GLO-30 DEM (30m)',
    prediction: {
      model_risk_score: 30.0,
      final_risk_score: 30.0,
      model_risk_level: 'LOW',
      final_risk_level: 'LOW',
      risk_level: 'LOW',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD',
      warnings: [],
      raw_probability: 0.30,
      calibrated_probability: 0.30,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.40,
      thresholds: { medium: 0.40, high: 0.70 },
      provenance: { synthetic: false },
      disclaimer: 'Research Decision-Support Prototype.',
    },
    rules_evaluation: [
      {
        rule_id: 'HEAVY_SNOWFALL_STEEP_SLOPE',
        rule_name: 'Heavy Snowfall on Steep Slope',
        description: 'Heavy storm snowfall (24h >= 30mm or 72h >= 45mm) on steep starting zone (slope >= 34 deg)',
        condition: '(snowfall_24h >= 30.0 or snowfall_72h >= 45.0) and slope >= 34.0',
        actual_values: { snowfall_24h: 7.5, snowfall_72h: 7.5, slope: 36.0 },
        thresholds: { snowfall_24h: '>= 30.0 mm', snowfall_72h: '>= 45.0 mm', slope: '>= 34.0 deg' },
        status: 'NOT MET',
        target_minimum_level: 'HIGH',
      },
      {
        rule_id: 'RAPID_THERMAL_WARMING',
        rule_name: 'Rapid Thermal Warming',
        description: 'Rapid thermal warming (T >= 3.0 C or 24h delta >= 6.0 C) on steep slope (slope >= 35 deg)',
        condition: '(temp >= 3.0 or temp_delta_24h >= 6.0) and slope >= 35.0',
        actual_values: { temperature: -10.0, temperature_delta_24h: -1.0, slope: 36.0 },
        thresholds: { temperature: '>= 3.0 C', temperature_delta_24h: '>= 6.0 C', slope: '>= 35.0 deg' },
        status: 'NOT MET',
        target_minimum_level: 'HIGH',
      },
    ],
    isLoading: false,
    error: null,
  };

  const dummyContextFremontEscalated: PredictionContext = {
    target_id: '485',
    target_name: 'SNOTEL 485: Fremont Pass',
    target_type: 'STATION',
    latitude: 39.378,
    longitude: -106.188,
    elevation: 3475,
    slope: 36.0,
    aspect: 45.0,
    temperature: 3.0,
    humidity: 65.0,
    pressure: 668.0,
    precipitation: 0.0,
    wind_speed_mean_24h: 18.0,
    wind_speed_max_24h: 35.0,
    snow_depth: 155.0,
    snow_water_equivalent: 310.0,
    snowfall_6h: 0.0,
    snowfall_24h: 1.0,
    snowfall_72h: 1.0,
    temperature_delta_24h: 0.0,
    temperature_delta_72h: 0.0,
    telemetry_timestamp: '2026-08-20T12:00:00Z',
    telemetry_age_minutes: 25,
    data_quality: 'GOOD',
    freshness_state: 'GOOD',
    assessment_status: 'CURRENT',
    prediction_available: true,
    suppression_reason: null,
    current_utc: '2026-08-20T12:25:00Z',
    last_observation_timestamp: '2026-08-20T12:00:00Z',
    telemetry_status: 'GOOD',
    telemetry_source: 'SNOTEL Automated Telemetry (AWDB)',
    terrain_source: 'Copernicus GLO-30 DEM (30m)',
    prediction: {
      model_risk_score: 30.0,
      final_risk_score: 70.0,
      model_risk_level: 'LOW',
      final_risk_level: 'HIGH',
      risk_level: 'HIGH',
      risk_escalated: true,
      risk_escalation_reasons: [
        'Deterministic Engineering Rule: Rapid thermal warming (T=3.0C, 24h delta=0.0C) on steep starting zone (36.0 deg).',
      ],
      data_quality: 'GOOD',
      warnings: [
        'Deterministic Engineering Rule: Rapid thermal warming (T=3.0C, 24h delta=0.0C) on steep starting zone (36.0 deg).',
      ],
      raw_probability: 0.30,
      calibrated_probability: 0.30,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.40,
      thresholds: { medium: 0.40, high: 0.70 },
      provenance: { synthetic: false },
      disclaimer: 'Research Decision-Support Prototype.',
    },
    rules_evaluation: [
      {
        rule_id: 'HEAVY_SNOWFALL_STEEP_SLOPE',
        rule_name: 'Heavy Snowfall on Steep Slope',
        description: 'Heavy storm snowfall (24h >= 30mm or 72h >= 45mm) on steep starting zone (slope >= 34 deg)',
        condition: '(snowfall_24h >= 30.0 or snowfall_72h >= 45.0) and slope >= 34.0',
        actual_values: { snowfall_24h: 1.0, snowfall_72h: 1.0, slope: 36.0 },
        thresholds: { snowfall_24h: '>= 30.0 mm', snowfall_72h: '>= 45.0 mm', slope: '>= 34.0 deg' },
        status: 'NOT MET',
        target_minimum_level: 'HIGH',
      },
      {
        rule_id: 'RAPID_THERMAL_WARMING',
        rule_name: 'Rapid Thermal Warming',
        description: 'Rapid thermal warming (T >= 3.0 C or 24h delta >= 6.0 C) on steep slope (slope >= 35 deg)',
        condition: '(temp >= 3.0 or temp_delta_24h >= 6.0) and slope >= 35.0',
        actual_values: { temperature: 3.0, temperature_delta_24h: 0.0, slope: 36.0 },
        thresholds: { temperature: '>= 3.0 C', temperature_delta_24h: '>= 6.0 C', slope: '>= 35.0 deg' },
        status: 'TRIGGERED',
        target_minimum_level: 'HIGH',
      },
    ],
    isLoading: false,
    error: null,
  };

  // TEST 1: Station Selection Data Flow
  it('TEST 1: Renders Berthoud Summit (335) assessment data faithfully from context', () => {
    render(<RiskAssessmentPanel context={dummyContextBerthoud} onRefresh={() => {}} />);
    expect(screen.getByText(/Berthoud Summit/i)).toBeDefined();
    expect(screen.getAllByText(/30\/100/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('LOW').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GOOD').length).toBeGreaterThan(0);
    expect(screen.queryByText(/HISTORICAL DATA — LIVE PREDICTION UNAVAILABLE/i)).toBeNull();
  });

  // TEST 2: Station Switching Independence
  it('TEST 2: Switching station replaces all values cleanly without stale remnants', () => {
    const { rerender } = render(<RiskAssessmentPanel context={dummyContextBerthoud} onRefresh={() => {}} />);
    expect(screen.getByText(/Berthoud Summit/i)).toBeDefined();

    // Rerender with Fremont Pass
    rerender(<RiskAssessmentPanel context={dummyContextFremontEscalated} onRefresh={() => {}} />);
    expect(screen.queryByText(/Berthoud Summit/i)).toBeNull();
    expect(screen.getByText(/Fremont Pass/i)).toBeDefined();
    expect(screen.getAllByText(/70\/100/i).length).toBeGreaterThan(0);
  });

  // TEST 3: Policy Escalation Display Consistency
  it('TEST 3: Displays policy escalation banner with matched reasons and TRIGGERED rule status', () => {
    render(<RiskAssessmentPanel context={dummyContextFremontEscalated} onRefresh={() => {}} />);

    // Verification of policy escalation banner
    expect(screen.getByText(/POLICY ESCALATION: MODEL RISK \(LOW\) OVERRIDDEN TO HIGH/i)).toBeDefined();
    expect(screen.getAllByText(/Rapid thermal warming/i).length).toBeGreaterThan(0);

    // Expand historical rules to verify TRIGGERED badge
    fireEvent.click(screen.getByText(/View historical rules/i));
    expect(screen.getAllByText('TRIGGERED').length).toBeGreaterThan(0);
  });

  // TEST 4: Policy Heuristic Transparency
  it('TEST 4: Displays each deterministic rule with actual values, thresholds, and transparent status when expanded', () => {
    render(<RiskAssessmentPanel context={dummyContextFremontEscalated} onRefresh={() => {}} />);
    expect(screen.getByText(/Historical Rule Evaluation — Diagnostic Only/i)).toBeDefined();
    
    // Expand rules
    fireEvent.click(screen.getByText(/View historical rules/i));
    expect(screen.getByText('Rapid Thermal Warming')).toBeDefined();
    expect(screen.getByText('Heavy Snowfall on Steep Slope')).toBeDefined();
    expect(screen.getAllByText('NOT MET').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TRIGGERED').length).toBeGreaterThan(0);
  });

  // TEST 5: Model vs Policy Risk Separation
  it('TEST 5: Clearly separates ML statistical model outputs from safety policy outputs', () => {
    render(<RiskAssessmentPanel context={dummyContextFremontEscalated} onRefresh={() => {}} />);
    expect(screen.getByText(/ML STATISTICAL MODEL/i)).toBeDefined();
    expect(screen.getByText(/SAFETY RISK POLICY/i)).toBeDefined();
    expect(screen.getByText('30.0%')).toBeDefined(); // Calibrated prob
    expect(screen.getByText('YES')).toBeDefined(); // Policy escalated
  });

  // TEST 6: Telemetry Freshness & Stale Data Protection
  it('TEST 6: Triggers prominent HISTORICAL DATA banner and suppresses ML output when telemetry age exceeds 360m', () => {
    const staleContext: PredictionContext = {
      ...dummyContextBerthoud,
      telemetry_timestamp: '2023-12-18T23:59:59Z',
      telemetry_age_minutes: 1404858,
      telemetry_status: 'STALE',
      freshness_state: 'STALE',
      data_quality: 'STALE',
      assessment_status: 'SUPPRESSED',
      prediction_available: false,
      prediction: {
        ...dummyContextBerthoud.prediction!,
        data_quality: 'STALE',
        final_risk_level: 'STALE',
      },
    };

    render(<RiskAssessmentPanel context={staleContext} onRefresh={() => {}} />);
    expect(screen.getByText(/HISTORICAL DATA — LIVE PREDICTION UNAVAILABLE/i)).toBeDefined();
    expect(screen.getByText(/STALE \/ NOT CURRENT/i)).toBeDefined();
    // Clear separation sections
    expect(screen.getByText('CURRENT ASSESSMENT')).toBeDefined();
    expect(screen.getByText('HISTORICAL DIAGNOSTICS')).toBeDefined();
    // Data quality badge must be STALE, NEVER GOOD
    expect(screen.queryByText('GOOD')).toBeNull();
    expect(screen.getAllByText('STALE').length).toBeGreaterThan(0);
    // ML section must be marked SUPPRESSED and UNAVAILABLE
    expect(screen.getByText('ML STATISTICAL MODEL')).toBeDefined();
    expect(screen.getAllByText('SUPPRESSED').length).toBeGreaterThan(0);
    expect(screen.getByText('UNAVAILABLE')).toBeDefined();
    expect(screen.getByText(/Historical Model Output — Diagnostic Only/i)).toBeDefined();
    expect(screen.getByText(/\[NOT CURRENT\]/i)).toBeDefined();
  });

  // TEST 7: Terrain Panel Data Flow
  it('TEST 7: TerrainPanel faithfully renders starting elevation, slope, and aspect from PredictionContext', () => {
    render(<TerrainPanel context={dummyContextBerthoud} />);
    expect(screen.getByText(/3,444 meters/i)).toBeDefined();
    expect(screen.getByText(/36.0°/i)).toBeDefined();
    expect(screen.getByText(/NE \(45°\)/i)).toBeDefined();
  });

  // TEST 8: Snowpack Panel Data Flow
  it('TEST 8: SnowpackPanel faithfully renders snow depth, SWE, 24h snowfall, and 72h snowfall from PredictionContext', () => {
    render(<SnowpackPanel context={dummyContextBerthoud} />);
    expect(screen.getByText('115 cm')).toBeDefined();
    expect(screen.getByText('195 mm')).toBeDefined();
    expect(screen.getAllByText('7.5 mm SWE').length).toBe(2);
  });

  // TEST 9: Weather Panel Data Flow
  it('TEST 9: WeatherPanel faithfully renders temperature, wind speeds, and atmospheric pressure from PredictionContext', () => {
    render(<WeatherPanel context={dummyContextBerthoud} />);
    expect(screen.getByText('-10.0°C')).toBeDefined();
    expect(screen.getByText('15.0 km/h')).toBeDefined();
    expect(screen.getByText('30.0 km/h')).toBeDefined();
    expect(screen.getByText('670.0 hPa')).toBeDefined();
  });

  // TEST 10: Loading State Rendering
  it('TEST 10: Renders animated loading skeleton during active prediction requests', () => {
    const loadingContext: PredictionContext = {
      ...dummyContextBerthoud,
      isLoading: true,
      prediction: null,
    };
    render(<RiskAssessmentPanel context={loadingContext} onRefresh={() => {}} />);
    expect(screen.getByText(/LOADING ASSESSMENT & RUNNING SAFETY EVALUATION/i)).toBeDefined();
  });

  // TEST 11: FormatTelemetryAge formatting accuracy
  it('TEST 11: formatTelemetryAge and formatTelemetryAgeCompact accurately format <60m, hours, and multi-day ages', async () => {
    const { formatTelemetryAge, formatTelemetryAgeCompact } = await import('../utils/formatters');
    expect(formatTelemetryAge(null)).toBe('UNAVAILABLE');
    expect(formatTelemetryAge(undefined)).toBe('UNAVAILABLE');
    expect(formatTelemetryAge(38)).toBe('38m');
    expect(formatTelemetryAge(180)).toBe('3h');
    expect(formatTelemetryAge(480)).toBe('8h');
    expect(formatTelemetryAge(1404858)).toBe('975d 14h');

    expect(formatTelemetryAgeCompact(null)).toBe('N/A');
    expect(formatTelemetryAgeCompact(38)).toBe('38m');
    expect(formatTelemetryAgeCompact(180)).toBe('3h');
    expect(formatTelemetryAgeCompact(480)).toBe('8h');
    expect(formatTelemetryAgeCompact(1404858)).toBe('975d');
  });

  // TEST 12: Missing Telemetry produces INSUFFICIENT_DATA
  it('TEST 12: Missing telemetry produces INSUFFICIENT data quality badge and UNAVAILABLE ML prediction', () => {
    const insufficientContext: PredictionContext = {
      ...dummyContextBerthoud,
      telemetry_timestamp: null,
      telemetry_age_minutes: null,
      telemetry_status: 'INSUFFICIENT',
      freshness_state: 'INSUFFICIENT',
      data_quality: 'INSUFFICIENT',
      assessment_status: 'UNAVAILABLE',
      prediction_available: false,
      prediction: {
        ...dummyContextBerthoud.prediction!,
        data_quality: 'INSUFFICIENT',
        final_risk_level: 'INSUFFICIENT_DATA',
        risk_level: 'INSUFFICIENT_DATA',
      },
    };

    render(<RiskAssessmentPanel context={insufficientContext} onRefresh={() => {}} />);
    expect(screen.getAllByText('INSUFFICIENT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('INSUFFICIENT_DATA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('UNAVAILABLE').length).toBeGreaterThan(0);
  });

  // TEST 13: Stale Telemetry Rule Collapse & Expand Control
  it('TEST 13: Collapses historical rules by default and expands on click', () => {
    const staleContext: PredictionContext = {
      ...dummyContextBerthoud,
      telemetry_timestamp: '2023-12-18T23:59:59Z',
      telemetry_age_minutes: 1404858,
      telemetry_status: 'STALE',
      freshness_state: 'STALE',
      data_quality: 'STALE',
      assessment_status: 'SUPPRESSED',
      prediction_available: false,
      prediction: {
        ...dummyContextBerthoud.prediction!,
        data_quality: 'STALE',
        final_risk_level: 'STALE',
      },
    };

    render(<RiskAssessmentPanel context={staleContext} onRefresh={() => {}} />);
    // Closed by default
    expect(screen.queryByText(/Rules below reflect historical sensor values/i)).toBeNull();
    expect(screen.getByText(/View historical rules/i)).toBeDefined();

    // Click to expand
    fireEvent.click(screen.getByText(/View historical rules/i));
    expect(screen.getByText(/Rules below reflect historical sensor values/i)).toBeDefined();
    expect(screen.getByText(/Hide rules/i)).toBeDefined();
    expect(screen.getByText('Rapid Thermal Warming')).toBeDefined();
  });

  // TEST 14: Stale Lower Data Cards & Metric Labels
  it('TEST 14: Marks lower telemetry cards HISTORICAL / STALE with observation metadata and HISTORICAL VALUE labels', () => {
    const staleContext: PredictionContext = {
      ...dummyContextBerthoud,
      telemetry_timestamp: '2023-12-18T23:59:59Z',
      telemetry_age_minutes: 1404858,
      telemetry_status: 'STALE',
      freshness_state: 'STALE',
      data_quality: 'STALE',
      assessment_status: 'SUPPRESSED',
      prediction_available: false,
    };

    // Render WeatherPanel
    const { unmount: unmountWeather } = render(<WeatherPanel context={staleContext} />);
    expect(screen.getByText(/HISTORICAL \/ STALE/i)).toBeDefined();
    expect(screen.getByText(/2023-12-18T23:59:59Z/i)).toBeDefined();
    expect(screen.getAllByText('HISTORICAL VALUE').length).toBe(4);
    expect(screen.getAllByText('NOT CURRENT').length).toBeGreaterThan(0);
    unmountWeather();

    // Render SnowpackPanel
    const { unmount: unmountSnowpack } = render(<SnowpackPanel context={staleContext} />);
    expect(screen.getByText(/HISTORICAL \/ STALE/i)).toBeDefined();
    expect(screen.getByText(/2023-12-18T23:59:59Z/i)).toBeDefined();
    expect(screen.getAllByText('HISTORICAL VALUE').length).toBe(4);
    expect(screen.getAllByText('NOT CURRENT').length).toBeGreaterThan(0);
    unmountSnowpack();
  });

  // TEST 15: Fresh Telemetry Switchability
  it('TEST 15: Automatically switches to CURRENT TELEMETRY, LIVE TELEMETRY, and CURRENT VALUE when fresh', () => {
    // Render fresh WeatherPanel
    const { unmount: unmountWeather } = render(<WeatherPanel context={dummyContextBerthoud} />);
    expect(screen.getByText(/CURRENT TELEMETRY/i)).toBeDefined();
    expect(screen.getByText(/LIVE TELEMETRY/i)).toBeDefined();
    expect(screen.getAllByText('CURRENT VALUE').length).toBe(4);
    expect(screen.queryByText(/HISTORICAL \/ STALE/i)).toBeNull();
    expect(screen.queryByText('NOT CURRENT')).toBeNull();
    unmountWeather();

    // Render fresh SnowpackPanel
    const { unmount: unmountSnowpack } = render(<SnowpackPanel context={dummyContextBerthoud} />);
    expect(screen.getByText(/CURRENT TELEMETRY/i)).toBeDefined();
    expect(screen.getByText(/LIVE TELEMETRY/i)).toBeDefined();
    expect(screen.getAllByText('CURRENT VALUE').length).toBe(4);
    expect(screen.queryByText(/HISTORICAL \/ STALE/i)).toBeNull();
    expect(screen.queryByText('NOT CURRENT')).toBeNull();
    unmountSnowpack();
  });

  // TEST 16: Static Terrain Baseline Display
  it('TEST 16: TerrainPanel consistently identifies Copernicus DEM as STATIC TERRAIN BASELINE', () => {
    render(<TerrainPanel context={dummyContextBerthoud} />);
    expect(screen.getByText(/STATIC TERRAIN BASELINE/i)).toBeDefined();
  });

  // TEST 17: Scientific Disclaimer Preservation
  it('TEST 17: Preserves mandatory scientific prototype and operational warning disclaimer', async () => {
    const { DisclaimerBanner } = await import('../components/common/DisclaimerBanner');
    render(<DisclaimerBanner />);
    expect(screen.getByText(/RESEARCH DECISION-SUPPORT PROTOTYPE/i)).toBeDefined();
    expect(screen.getByText(/a certified operational avalanche warning authority/i)).toBeDefined();
  });
});



