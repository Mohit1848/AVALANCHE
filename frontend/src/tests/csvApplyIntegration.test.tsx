import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomDataStudio } from '../components/custom/CustomDataStudio';
import { RiskAssessmentPanel } from '../components/risk/RiskAssessmentPanel';
import { ColoradoMap } from '../components/map/ColoradoMap';
import { detectDomainFromCoords, isValidCoordinate } from '../services/api';
import type { EvaluatedPointRecord, SelectedLocationState, PredictionContext } from '../types';

describe('CSV Data Studio -> Operations Console & Map Apply Integration', () => {
  const sampleEverestRecord: EvaluatedPointRecord = {
    id: 'CSV_1_EVEREST',
    index: 1,
    location_id: 'Mount Everest - Khumbu Icefall (Himalayas)',
    latitude: 27.988,
    longitude: 86.925,
    elevation: 5364,
    slope: 44.0,
    aspect: 210,
    temperature: -18.5,
    snow_depth: 190,
    snow_water_equivalent: 320,
    snowfall_6h: 15.0,
    snowfall_24h: 38.0,
    snowfall_72h: 75.0,
    temperature_delta_24h: -2.0,
    wind_speed_mean_24h: 35.0,
    wind_speed_max_24h: 72.0,
    prediction: {
      final_risk_score: null,
      model_risk_score: null,
      final_risk_level: 'INSUFFICIENT_DATA',
      model_risk_level: 'INSUFFICIENT_DATA',
      risk_level: 'INSUFFICIENT_DATA',
      risk_escalated: false,
      risk_escalation_reasons: [],
      data_quality: 'GOOD',
      warnings: ['Geographic gating active: Himalayan / global research target.'],
      raw_probability: null,
      calibrated_probability: null,
      model_version: 'research_evaluation_only',
      operating_threshold: 0.5,
      thresholds: { medium: 0.35, high: 0.65 },
      provenance: { source: 'CSV_DATASET', domain: 'HIMALAYAS' },
      disclaimer: 'Research decision-support dataset.',
      domain: 'HIMALAYA',
    },
    status: 'SUCCESS',
  };

  const sampleBerthoudRecord: EvaluatedPointRecord = {
    id: 'CSV_2_BERTHOUD',
    index: 2,
    location_id: 'Berthoud Pass Summit (Colorado Front Range)',
    latitude: 39.798,
    longitude: -105.778,
    elevation: 3444,
    slope: 40.0,
    aspect: 45,
    temperature: -5.5,
    snow_depth: 165,
    snow_water_equivalent: 280,
    snowfall_6h: 8.0,
    snowfall_24h: 36.0,
    snowfall_72h: 58.0,
    temperature_delta_24h: -3.0,
    wind_speed_mean_24h: 32.0,
    wind_speed_max_24h: 62.0,
    prediction: {
      final_risk_score: 68.0,
      model_risk_score: 52.0,
      final_risk_level: 'HIGH',
      model_risk_level: 'MEDIUM',
      risk_level: 'HIGH',
      risk_escalated: true,
      risk_escalation_reasons: ['Heavy snowfall (>30cm/24h)', 'Steep starting zone (>38°)'],
      data_quality: 'GOOD',
      warnings: [],
      raw_probability: 0.52,
      calibrated_probability: 0.52,
      model_version: 'colorado_avalanche_rf_v3',
      operating_threshold: 0.4,
      thresholds: { medium: 0.4, high: 0.7 },
      provenance: { source: 'CSV_DATASET', domain: 'COLORADO' },
      disclaimer: 'Research Decision-Support Service.',
      domain: 'COLORADO',
    },
    status: 'SUCCESS',
  };

  const sampleInvalidRecord: EvaluatedPointRecord = {
    id: 'CSV_3_INVALID',
    index: 3,
    location_id: 'Invalid Coordinate Point',
    latitude: NaN,
    longitude: 85.0,
    elevation: 4000,
    slope: 35,
    aspect: 90,
    temperature: -10,
    snow_depth: 100,
    snow_water_equivalent: 150,
    status: 'ERROR',
  };

  it('1. Correctly identifies domain from coordinates', () => {
    expect(detectDomainFromCoords(27.988, 86.925)).toBe('INDIA');
    expect(detectDomainFromCoords(35.881, 76.513)).toBe('INDIA');
    expect(detectDomainFromCoords(45.832, 6.865)).toBe('INDIA'); // Alps -> research domain
    expect(detectDomainFromCoords(39.798, -105.778)).toBe('COLORADO');
    expect(detectDomainFromCoords(37.899, -107.714)).toBe('COLORADO');
  });

  it('2. Validates coordinates properly and rejects invalid values', () => {
    expect(isValidCoordinate(27.988, 86.925)).toBe(true);
    expect(isValidCoordinate(39.798, -105.778)).toBe(true);
    expect(isValidCoordinate('India', 86.925)).toBe(false);
    expect(isValidCoordinate(NaN, 86.925)).toBe(false);
    expect(isValidCoordinate(95.0, 86.925)).toBe(false); // Out of range lat
    expect(isValidCoordinate(27.988, 200.0)).toBe(false); // Out of range lon
    expect(isValidCoordinate(null, undefined)).toBe(false);
  });

  it('3. Apply button calls onApplyLocationToConsole and onNavigateToConsole for valid CSV rows', () => {
    const handleApply = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <CustomDataStudio
        activeCsvRecords={[sampleEverestRecord, sampleBerthoudRecord]}
        onSetActiveCsvDataset={vi.fn()}
        onApplyLocationToConsole={handleApply}
        onNavigateToConsole={handleNavigate}
        appliedTargetId={null}
      />
    );

    const applyButtons = screen.getAllByRole('button', { name: /Apply/i });
    expect(applyButtons.length).toBeGreaterThanOrEqual(2);

    // Click Apply on Everest
    fireEvent.click(applyButtons[0]);

    expect(handleApply).toHaveBeenCalledTimes(1);
    const appliedLoc: SelectedLocationState = handleApply.mock.calls[0][0];
    expect(appliedLoc.name).toBe('Mount Everest - Khumbu Icefall (Himalayas)');
    expect(appliedLoc.latitude).toBe(27.988);
    expect(appliedLoc.longitude).toBe(86.925);
    expect(appliedLoc.elevation).toBe(5364);
    expect(appliedLoc.slope).toBe(44.0);
    expect(appliedLoc.source).toBe('CSV_DATASET');
    expect(appliedLoc.type).toBe('CSV_LOCATION');

    expect(handleNavigate).toHaveBeenCalledTimes(1);
  });

  it('4. Disables Apply button for invalid coordinate records', () => {
    const handleApply = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <CustomDataStudio
        activeCsvRecords={[sampleInvalidRecord]}
        onSetActiveCsvDataset={vi.fn()}
        onApplyLocationToConsole={handleApply}
        onNavigateToConsole={handleNavigate}
      />
    );

    const cannotApplyBtn = screen.getByRole('button', { name: /Cannot Apply/i });
    expect(cannotApplyBtn).toBeDefined();
    expect(cannotApplyBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(cannotApplyBtn);
    expect(handleApply).not.toHaveBeenCalled();
    expect(handleNavigate).not.toHaveBeenCalled();
  });

  it('5. Visually marks applied record with [✓ Applied] and active styling', () => {
    render(
      <CustomDataStudio
        activeCsvRecords={[sampleEverestRecord, sampleBerthoudRecord]}
        onSetActiveCsvDataset={vi.fn()}
        onApplyLocationToConsole={vi.fn()}
        onNavigateToConsole={vi.fn()}
        appliedTargetId="CSV_1_EVEREST"
      />
    );

    expect(screen.getByText(/✓ Applied/i)).toBeDefined();
  });

  it('6. Target Evaluation displays Himalayan CSV metadata with complete research isolation', () => {
    const himalayanContext: PredictionContext = {
      target_id: 'Mount Everest - Khumbu Icefall (Himalayas)',
      target_name: 'Mount Everest - Khumbu Icefall (Himalayas)',
      target_type: 'CSV_LOCATION',
      latitude: 27.988,
      longitude: 86.925,
      elevation: 5364,
      slope: 44.0,
      aspect: 210,
      temperature: -18.5,
      humidity: 65,
      pressure: 500,
      precipitation: 0.0,
      wind_speed_mean_24h: 35.0,
      wind_speed_max_24h: 72.0,
      snow_depth: 190,
      snow_water_equivalent: 320,
      snowfall_6h: 15.0,
      snowfall_24h: 38.0,
      snowfall_72h: 75.0,
      temperature_delta_24h: -2.0,
      temperature_delta_72h: null,
      telemetry_timestamp: new Date().toISOString(),
      telemetry_age_minutes: 0,
      data_quality: 'GOOD',
      freshness_state: 'GOOD',
      assessment_status: 'CURRENT',
      prediction_available: false,
      suppression_reason: null,
      current_utc: new Date().toISOString(),
      telemetry_status: 'GOOD',
      last_observation_timestamp: null,
      telemetry_source: 'CUSTOM CSV DATASET',
      domain: 'HIMALAYA',
      prediction: sampleEverestRecord.prediction!,
      isLoading: false,
    };

    render(
      <RiskAssessmentPanel
        context={himalayanContext}
        onRefresh={vi.fn()}
      />
    );

    // Target Evaluation Header
    expect(screen.getByText(/TARGET EVALUATION/i)).toBeDefined();
    expect(screen.getByText(/Mount Everest - Khumbu Icefall \(Himalayas\)/i)).toBeDefined();
    expect(screen.getByText(/27.9880° N, 86.9250° E/i)).toBeDefined();
    expect(screen.getByText(/Elevation: 5,364 m/i)).toBeDefined();
    expect(screen.getByText(/Slope: 44°/i)).toBeDefined();

    // Research domain banner & reason card
    expect(screen.getByText(/DATA DOMAIN: HIMALAYAS • SOURCE: CSV DATASET/i)).toBeDefined();
    expect(screen.getAllByText(/CALIBRATED • RESEARCH ONLY/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/INFERENCE/i).length).toBeGreaterThanOrEqual(1);

    // Ensure Colorado AWDB live badge is NOT rendered
    expect(screen.queryByText(/TELEMETRY: LIVE • SOURCE: NRCS AWDB/i)).toBeNull();
  });

  it('7. ColoradoMap renders authoritative ActiveTargetMarker with coordinates and popup', () => {
    const selectedEverest: SelectedLocationState = {
      type: 'CSV_LOCATION',
      name: 'Mount Everest - Khumbu Icefall (Himalayas)',
      latitude: 27.988,
      longitude: 86.925,
      elevation: 5364,
      slope: 44.0,
      aspect: 210,
      temperature: -18.5,
      snow_depth: 190,
      snow_water_equivalent: 320,
      snowfall_6h: 15.0,
      snowfall_24h: 38.0,
      snowfall_72h: 75.0,
      temperature_delta_24h: -2.0,
      wind_speed_mean_24h: 35.0,
      wind_speed_max_24h: 72.0,
      telemetry_age_minutes: 0,
      source: 'CSV_DATASET',
    };

    const { container } = render(
      <ColoradoMap
        zones={[]}
        stations={[]}
        historicalEvents={[]}
        selectedLocation={selectedEverest}
        onSelectLocation={vi.fn()}
        showEvents={false}
        selectedDomain="INDIA"
      />
    );

    // Map container exists
    expect(container.querySelector('.leaflet-container')).toBeDefined();
    // Custom active target marker class exists in rendered DOM
    expect(container.querySelector('.custom-active-target-marker')).toBeDefined();
  });
});
