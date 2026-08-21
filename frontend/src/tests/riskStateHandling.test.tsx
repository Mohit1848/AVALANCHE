import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CircularRiskGauge } from '../components/risk/CircularRiskGauge';
import { ModelPolicyComparison } from '../components/risk/ModelPolicyComparison';
import { RiskAssessmentPanel } from '../components/risk/RiskAssessmentPanel';
import { resolveRiskDisplayState } from '../utils/riskDisplayAdapter';
import type { PredictionContext, RiskPredictionResponse } from '../types';

describe('Risk Display State Integrity & INSUFFICIENT_DATA Handling', () => {
  const baseContext: PredictionContext = {
    target_id: 'Test Location',
    target_name: 'Test Location',
    target_type: 'COORDINATE',
    latitude: 39.75,
    longitude: -105.8,
    elevation: 3500,
    slope: 35,
    aspect: 90,
    temperature: -5.0,
    humidity: 70,
    pressure: 680,
    precipitation: 2.0,
    wind_speed_mean_24h: 20,
    wind_speed_max_24h: 40,
    snow_depth: 150,
    snow_water_equivalent: 200,
    snowfall_6h: 5,
    snowfall_24h: 15,
    snowfall_72h: 25,
    temperature_delta_24h: -1.0,
    temperature_delta_72h: null,
    telemetry_timestamp: new Date().toISOString(),
    telemetry_age_minutes: 20,
    data_quality: 'GOOD',
    freshness_state: 'GOOD',
    assessment_status: 'CURRENT',
    prediction_available: true,
    suppression_reason: null,
    current_utc: new Date().toISOString(),
    telemetry_status: 'GOOD',
    last_observation_timestamp: new Date().toISOString(),
    telemetry_source: 'USDA NRCS AWDB',
    domain: 'COLORADO',
    prediction: null,
    isLoading: false,
  };

  it('1. Correctly resolves AVAILABLE state for high risk score (82 / 100 HIGH)', () => {
    const highPred: RiskPredictionResponse = {
      model_risk_score: 75,
      final_risk_score: 82,
      model_risk_level: 'HIGH',
      final_risk_level: 'HIGH',
      risk_level: 'HIGH',
      risk_escalated: true,
      risk_escalation_reasons: ['Heavy snowfall (>30mm/24h)'],
      data_quality: 'GOOD',
      warnings: [],
      raw_probability: 0.82,
      calibrated_probability: 0.82,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.5,
      thresholds: { medium: 0.35, high: 0.65 },
      provenance: { source: 'USDA_NRCS_AWDB', domain: 'COLORADO' },
      disclaimer: 'Research Decision-Support Service.',
      domain: 'COLORADO',
    };

    const displayState = resolveRiskDisplayState({
      ...baseContext,
      prediction: highPred,
    });

    expect(displayState.kind).toBe('AVAILABLE');
    expect(displayState.hasValidScore).toBe(true);
    expect(displayState.score).toBe(82);
    expect(displayState.level).toBe('HIGH');
    expect(displayState.modelScore).toBe(75);

    render(<CircularRiskGauge displayState={displayState} />);
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('82');
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('/100');
    expect(screen.getByTestId('policy-risk-level').textContent).toBe('HIGH');
    // Numeric scale must be present
    expect(screen.getByTestId('numeric-risk-scale')).toBeDefined();
    // No-score panel must NOT be present
    expect(screen.queryByTestId('no-score-panel')).toBeNull();
  });

  it('2. Correctly resolves AVAILABLE state for low risk score (15 / 100 LOW)', () => {
    const lowPred: RiskPredictionResponse = {
      model_risk_score: 15,
      final_risk_score: 15,
      model_risk_level: 'LOW',
      final_risk_level: 'LOW',
      risk_level: 'LOW',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD',
      warnings: [],
      raw_probability: 0.15,
      calibrated_probability: 0.15,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.5,
      thresholds: { medium: 0.35, high: 0.65 },
      provenance: { source: 'USDA_NRCS_AWDB', domain: 'COLORADO' },
      disclaimer: 'Research Decision-Support Service.',
      domain: 'COLORADO',
    };

    const displayState = resolveRiskDisplayState({
      ...baseContext,
      prediction: lowPred,
    });

    expect(displayState.kind).toBe('AVAILABLE');
    expect(displayState.score).toBe(15);
    expect(displayState.level).toBe('LOW');

    render(<CircularRiskGauge displayState={displayState} />);
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('15');
    expect(screen.getByTestId('policy-risk-level').textContent).toBe('LOW');
    expect(screen.getByTestId('numeric-risk-scale')).toBeDefined();
  });

  it('3. Correctly resolves AVAILABLE state for moderate risk score (48 / 100 MODERATE)', () => {
    const modPred: RiskPredictionResponse = {
      model_risk_score: 48,
      final_risk_score: 48,
      model_risk_level: 'MEDIUM',
      final_risk_level: 'MEDIUM',
      risk_level: 'MEDIUM',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD',
      warnings: [],
      raw_probability: 0.48,
      calibrated_probability: 0.48,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.5,
      thresholds: { medium: 0.35, high: 0.65 },
      provenance: { source: 'USDA_NRCS_AWDB', domain: 'COLORADO' },
      disclaimer: 'Research Decision-Support Service.',
      domain: 'COLORADO',
    };

    const displayState = resolveRiskDisplayState({
      ...baseContext,
      prediction: modPred,
    });

    expect(displayState.kind).toBe('AVAILABLE');
    expect(displayState.score).toBe(48);
    expect(displayState.level).toBe('MEDIUM');

    render(<CircularRiskGauge displayState={displayState} />);
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('48');
    expect(screen.getByTestId('numeric-risk-scale')).toBeDefined();
  });

  it('4. Handles riskScore = null: renders em-dash, NO DATA, and HIDES 0-100 scale', () => {
    const nullScorePred: RiskPredictionResponse = {
      model_risk_score: null,
      final_risk_score: null,
      model_risk_level: 'INSUFFICIENT_DATA',
      final_risk_level: 'INSUFFICIENT_DATA',
      risk_level: 'INSUFFICIENT_DATA',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD',
      warnings: [],
      raw_probability: null,
      calibrated_probability: null,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.5,
      thresholds: { medium: 0.35, high: 0.65 },
      provenance: { source: 'USDA_NRCS_AWDB', domain: 'COLORADO' },
      disclaimer: 'Research Decision-Support Service.',
      domain: 'COLORADO',
    };

    const displayState = resolveRiskDisplayState({
      ...baseContext,
      prediction: nullScorePred,
    });

    expect(displayState.kind).toBe('INSUFFICIENT_DATA');
    expect(displayState.hasValidScore).toBe(false);
    expect(displayState.score).toBeNull();
    expect(displayState.modelScore).toBeNull();

    render(<CircularRiskGauge displayState={displayState} />);
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('—');
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('NO DATA');
    expect(screen.getByTestId('policy-risk-level').textContent).toBe('INSUFFICIENT_DATA');

    // CRITICAL REQUIREMENT: 0-100 numeric scale must be completely hidden!
    expect(screen.queryByTestId('numeric-risk-scale')).toBeNull();
    // Neutral status panel must be displayed
    expect(screen.getByTestId('no-score-panel')).toBeDefined();
    expect(screen.getByText(/NO VALID RISK SCORE/i)).toBeDefined();
  });

  it('5. Handles riskScore = undefined / prediction = null without converting to 0', () => {
    const displayState = resolveRiskDisplayState({
      ...baseContext,
      prediction: null,
    });

    expect(displayState.kind).toBe('INSUFFICIENT_DATA');
    expect(displayState.hasValidScore).toBe(false);
    expect(displayState.score).toBeNull();
    expect(displayState.score).not.toBe(0);

    render(<CircularRiskGauge displayState={displayState} />);
    expect(screen.queryByTestId('numeric-risk-scale')).toBeNull();
    expect(screen.getByTestId('no-score-panel')).toBeDefined();
  });

  it('6. Handles Himalayan target: INFERENCE DISABLED, no Colorado model output, reason card displayed', () => {
    const himalayanContext: PredictionContext = {
      ...baseContext,
      target_name: 'Mount Everest - Khumbu Icefall',
      latitude: 27.988,
      longitude: 86.925,
      domain: 'HIMALAYA',
      telemetry_source: 'CUSTOM CSV DATASET',
      target_type: 'CSV_LOCATION',
      prediction: {
        model_risk_score: null,
        final_risk_score: null,
        model_risk_level: 'INSUFFICIENT_DATA',
        final_risk_level: 'INSUFFICIENT_DATA',
        risk_level: 'INSUFFICIENT_DATA',
        risk_escalated: false,
        risk_escalation_reasons: [],
        data_quality: 'GOOD',
        warnings: ['Geographic gating active.'],
        raw_probability: null,
        calibrated_probability: null,
        model_version: 'research_evaluation_only',
        operating_threshold: 0.5,
        thresholds: { medium: 0.35, high: 0.65 },
        provenance: { source: 'CSV_DATASET', domain: 'HIMALAYAS' },
        disclaimer: 'Research decision-support dataset.',
        domain: 'HIMALAYA',
      },
    };

    const displayState = resolveRiskDisplayState(himalayanContext);
    expect(displayState.kind).toBe('DISABLED');
    expect(displayState.isResearchDomain).toBe(true);
    expect(displayState.hasValidScore).toBe(false);
    expect(displayState.score).toBeNull();
    expect(displayState.modelStatusText).toBe('CALIBRATED • RESEARCH ONLY');
    expect(displayState.inferenceStatusText).toBe('DISABLED');

    render(<RiskAssessmentPanel context={himalayanContext} onRefresh={vi.fn()} />);

    // Reason card must be present
    expect(screen.getByTestId('unavailable-reason-card')).toBeDefined();
    expect(screen.getAllByText(/RESEARCH ONLY/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/DISABLED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Insufficient validated data/i)).toBeDefined();

    // Model Policy Comparison must show UNAVAILABLE / NOT EVALUATED
    expect(screen.getByText(/Inference unavailable/i)).toBeDefined();
    expect(screen.getByText(/No model output available/i)).toBeDefined();
    expect(screen.queryByTestId('numeric-risk-scale')).toBeNull();
  });

  it('7. Handles STALE telemetry: STALE / SUPPRESSED, previous score suppressed, no 0-100 scale', () => {
    const staleContext: PredictionContext = {
      ...baseContext,
      freshness_state: 'STALE',
      data_quality: 'STALE',
      telemetry_age_minutes: 450, // > 6h
      prediction: {
        model_risk_score: 72, // Stale historical score
        final_risk_score: 72,
        model_risk_level: 'HIGH',
        final_risk_level: 'HIGH',
        risk_level: 'HIGH',
        risk_escalated: false,
        risk_escalation_reasons: [],
        data_quality: 'STALE',
        warnings: ['Telemetry stale'],
        raw_probability: 0.72,
        calibrated_probability: 0.72,
        model_version: 'colorado_avalanche_rf_v3',
        operating_threshold: 0.5,
        thresholds: { medium: 0.35, high: 0.65 },
        provenance: { source: 'USDA_NRCS_AWDB', domain: 'COLORADO' },
        disclaimer: 'Research Decision-Support Service.',
        domain: 'COLORADO',
      },
    };

    const displayState = resolveRiskDisplayState(staleContext);
    expect(displayState.kind).toBe('STALE');
    expect(displayState.hasValidScore).toBe(false);
    expect(displayState.score).toBeNull(); // Suppressed!

    render(<CircularRiskGauge displayState={displayState} />);
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('(SUPPRESSED)');
    expect(screen.getByTestId('policy-risk-level').textContent).toBe('STALE');
    expect(screen.queryByTestId('numeric-risk-scale')).toBeNull();
  });

  it('8. ModelPolicyComparison renders UNAVAILABLE and NOT EVALUATED for unavailable states', () => {
    const displayState = resolveRiskDisplayState({
      ...baseContext,
      prediction: null,
    });

    render(<ModelPolicyComparison displayState={displayState} />);
    expect(screen.getByTestId('model-risk-score').textContent).toContain('NO DATA');
    expect(screen.getByTestId('final-policy-score').textContent).toContain('NOT EVALUATED');
    expect(screen.getByText(/Inference unavailable/i)).toBeDefined();
    expect(screen.getByText(/No model output available/i)).toBeDefined();
  });

  it('9. Zero Fallback Invariant: Null/NaN values NEVER become 0 or fake score', () => {
    const corruptedPred = {
      model_risk_score: NaN,
      final_risk_score: NaN,
      model_risk_level: 'INSUFFICIENT_DATA' as any,
      final_risk_level: 'INSUFFICIENT_DATA' as any,
      risk_level: 'INSUFFICIENT_DATA' as any,
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD' as any,
      warnings: [],
      raw_probability: null,
      calibrated_probability: null,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.5,
      thresholds: { medium: 0.35, high: 0.65 },
      provenance: {},
      disclaimer: '',
    };

    const displayState = resolveRiskDisplayState({
      ...baseContext,
      prediction: corruptedPred,
    });

    expect(displayState.hasValidScore).toBe(false);
    expect(displayState.score).toBeNull();
    expect(displayState.score).not.toBe(0);
    expect(displayState.kind).toBe('INSUFFICIENT_DATA');
  });

  it('10. Himalayan Research Prediction: Renders real score, 0-100 scale, and research policy notice', () => {
    const himalayanResearchPred: RiskPredictionResponse = {
      model_risk_score: 81.1,
      final_risk_score: 81.1,
      model_risk_level: 'HIGH',
      final_risk_level: 'HIGH',
      risk_level: 'HIGH',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD',
      warnings: ['RESEARCH ONLY — NOT AN OPERATIONAL AVALANCHE WARNING'],
      raw_probability: 0.8113,
      calibrated_probability: 0.8113,
      model_version: 'himalaya_random_forest_v1',
      operating_threshold: 0.40,
      thresholds: { medium: 0.40, high: 0.70 },
      provenance: { source: 'CUSTOM_CSV', domain: 'HIMALAYA' },
      disclaimer: 'Research Decision-Support Model (N=44). Operational avalanche forecasting remains disabled.',
      domain: 'HIMALAYA',
    };

    const himalayanResearchContext: PredictionContext = {
      ...baseContext,
      target_name: 'Mount Everest - Khumbu Icefall',
      latitude: 27.988,
      longitude: 86.925,
      elevation: 5364,
      slope: 44,
      domain: 'HIMALAYA',
      telemetry_source: 'CUSTOM CSV DATASET',
      target_type: 'CSV_LOCATION',
      prediction: himalayanResearchPred,
    };

    const displayState = resolveRiskDisplayState(himalayanResearchContext);
    expect(displayState.kind).toBe('RESEARCH');
    expect(displayState.hasValidScore).toBe(true);
    expect(displayState.score).toBe(81.1);
    expect(displayState.level).toBe('HIGH');
    expect(displayState.isResearchDomain).toBe(true);

    // 1. Test CircularRiskGauge
    render(<CircularRiskGauge displayState={displayState} />);
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('81');
    expect(screen.getByTestId('policy-risk-score').textContent).toContain('/100');
    expect(screen.getByTestId('policy-risk-level').textContent).toBe('HIGH');
    expect(screen.getAllByText(/RESEARCH PREDICTION/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('numeric-risk-scale')).toBeDefined();
    expect(screen.getByTestId('himalayan-research-card')).toBeDefined();
    expect(screen.getByText(/HIMALAYAN RESEARCH MODEL/i)).toBeDefined();

    // 2. Test ModelPolicyComparison
    render(<ModelPolicyComparison displayState={displayState} />);
    expect(screen.getByTestId('model-risk-score').textContent).toContain('81');
    expect(screen.getByTestId('final-policy-score').textContent).toContain('RESEARCH OUTPUT');
    expect(screen.getAllByText(/RESEARCH ONLY/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Operational policy not enabled/i)).toBeDefined();
  });
});
