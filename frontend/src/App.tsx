import { useState, useEffect } from 'react';
import { Header, type TabKey } from './components/common/Header';
import { DatasetContextBar } from './components/common/DatasetContextBar';
import { DisclaimerBanner } from './components/common/DisclaimerBanner';
import { DataProvenanceModal } from './components/provenance/DataProvenanceModal';
import { ColoradoMap } from './components/map/ColoradoMap';
import { RiskAssessmentPanel } from './components/risk/RiskAssessmentPanel';
import { TelemetryMatrixPanel } from './components/telemetry/TelemetryMatrixPanel';
import { CustomDataStudio } from './components/custom/CustomDataStudio';
import { SnowWeatherAnalytics } from './components/analytics/SnowWeatherAnalytics';
import { SafetyAdvisoriesPanel } from './components/advisories/SafetyAdvisoriesPanel';
import { HistoricalPlaybackPanel } from './components/history/HistoricalPlaybackPanel';
import { api, parseCSV, SAMPLE_TEMPLATES, detectDomainFromCoords } from './services/api';
import type {
  HealthStatus,
  TelemetryFreshnessStatus,
  AvalancheZone,
  SnotelStation,
  HistoricalEvent,
  RiskPredictionResponse,
  SelectedLocationState,
  SpatialPredictionGridResponse,
  LayerVisibilityState,
  EvaluatedPointRecord,
  PredictionContext,
  GeographicDomain,
} from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('console');
  const [selectedDomain, setSelectedDomain] = useState<GeographicDomain>('COLORADO');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [freshness, setFreshness] = useState<TelemetryFreshnessStatus | null>(null);
  const [zones, setZones] = useState<AvalancheZone[]>([]);
  const [stations, setStations] = useState<SnotelStation[]>([]);
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEvent[]>([]);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState<boolean>(false);

  // Active CSV Dataset State (Powers the application)
  const [activeCsvRecords, setActiveCsvRecords] = useState<EvaluatedPointRecord[]>([]);
  const [activeCsvFilename, setActiveCsvFilename] = useState<string>('global_avalanche_mountains_master.csv');
  const [selectedCsvIndex, setSelectedCsvIndex] = useState<number>(0);
  const [regionFilter, setRegionFilter] = useState<'ALL' | 'HIMALAYAS' | 'ALPS' | 'AMERICAS' | 'PACIFIC'>('ALL');
  const [appliedTargetId, setAppliedTargetId] = useState<string | null>(null);

  // Spatial & Layer state
  const [activeRiskSurface] = useState<SpatialPredictionGridResponse | null>(null);
  const [layerVisibility] = useState<LayerVisibilityState>({
    historicalEvents: true,
    snotelStations: true,
    forecastZones: true,
    highResTerrain: true,
    contours20m: false,
    contours50m: true,
    contours100m: true,
    riskSurface: true,
  });

  const [showHistoricalEvents] = useState<boolean>(true);

  // Selected Location / Query State
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationState>({
    type: 'COORDINATE',
    name: 'Berthoud Summit (SNOTEL 335)',
    latitude: 39.798,
    longitude: -105.778,
    elevation: 3444.0,
    slope: 36.0,
    aspect: 45.0,
    temperature: -5.5,
    snow_depth: 140.0,
    snow_water_equivalent: 220.0,
    snowfall_6h: 8.0,
    snowfall_24h: 22.0,
    snowfall_72h: 38.0,
    temperature_delta_24h: -3.0,
    wind_speed_mean_24h: 24.0,
    wind_speed_max_24h: 48.0,
    telemetry_age_minutes: 18,
    source: 'NRCS_AWDB',
  });

  // Active ML Prediction State
  const [prediction, setPrediction] = useState<RiskPredictionResponse | null>(null);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState<boolean>(false);

  // 1. Initial Load of Health, Freshness, Stations, and Events
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [hRes, fRes] = await Promise.all([
          api.getHealth(),
          api.getTelemetryFreshness(),
        ]);
        setHealth(hRes);
        setFreshness(fRes);

        // Standard Colorado Avalanche Zones and Stations for Map
        setZones([
          { zone_id: 'CO_FRONT_RANGE', name: 'Front Range', center_latitude: 39.750, center_longitude: -105.800, elevation_range_m: '2,400m – 4,350m', primary_snotel_stations: ['335', '586'] },
          { zone_id: 'CO_VAIL_SUMMIT', name: 'Vail & Summit County', center_latitude: 39.550, center_longitude: -106.050, elevation_range_m: '2,500m – 4,300m', primary_snotel_stations: ['505', '531', '415'] },
          { zone_id: 'CO_SAWATCH', name: 'Sawatch Range', center_latitude: 39.300, center_longitude: -106.350, elevation_range_m: '2,600m – 4,400m', primary_snotel_stations: ['485'] },
          { zone_id: 'CO_ASPEN', name: 'Aspen Zone', center_latitude: 39.150, center_longitude: -106.750, elevation_range_m: '2,400m – 4,350m', primary_snotel_stations: ['542'] },
          { zone_id: 'CO_GUNNISON', name: 'Gunnison & Crested Butte', center_latitude: 38.950, center_longitude: -107.050, elevation_range_m: '2,600m – 4,100m', primary_snotel_stations: ['737'] },
          { zone_id: 'CO_SAN_JUAN', name: 'San Juan Mountains', center_latitude: 37.850, center_longitude: -107.750, elevation_range_m: '2,400m – 4,370m', primary_snotel_stations: ['709'] },
        ]);

        setStations([
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
        ]);

        setHistoricalEvents([
          { event_id: 'CAIC_2024_01', date: '2024-01-15', location: 'Berthoud Pass / Current Creek', latitude: 39.795, longitude: -105.772, avalanche_type: 'HS', trigger_category: 'NATURAL', d_size: 'D2.5' },
          { event_id: 'CAIC_2023_02', date: '2023-02-23', location: 'Loveland Pass / Seven Sisters', latitude: 39.668, longitude: -105.875, avalanche_type: 'SS', trigger_category: 'HUMAN_TRIGGERED', d_size: 'D2' },
          { event_id: 'CAIC_2022_03', date: '2022-12-29', location: 'Red Mountain Pass / Riverside', latitude: 37.895, longitude: -107.710, avalanche_type: 'HS', trigger_category: 'NATURAL', d_size: 'D3' },
        ]);
      } catch (err) {
        console.error('Initial data fetch error:', err);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Initial evaluation of default CSV dataset
  useEffect(() => {
    const initDefaultCsv = async () => {
      try {
        const csvResult = parseCSV(SAMPLE_TEMPLATES.global_mountains_csv);
        if (csvResult.data.length > 0) {
          const batchResp = await api.predictBatch(csvResult.data);
          const records: EvaluatedPointRecord[] = csvResult.data.map((pt, idx) => {
            const resItem = batchResp.results.find((r) => r.index === idx);
            return {
              id: `CSV_${idx + 1}`,
              index: idx + 1,
              location_id: pt.location_id || `CSV Row #${idx + 1}`,
              latitude: pt.latitude,
              longitude: pt.longitude,
              elevation: pt.elevation ?? 3444,
              slope: pt.slope ?? 36,
              aspect: pt.aspect ?? 45,
              temperature: pt.temperature ?? -5.5,
              humidity: pt.humidity,
              pressure: pt.pressure,
              snow_depth: pt.snow_depth ?? 140,
              snow_water_equivalent: pt.snow_water_equivalent ?? 220,
              snowfall_6h: pt.snowfall_6h ?? 8,
              snowfall_24h: pt.snowfall_24h ?? 22,
              snowfall_72h: pt.snowfall_72h ?? 38,
              wind_speed_mean_24h: pt.wind_speed_mean_24h ?? 24,
              wind_speed_max_24h: pt.wind_speed_max_24h ?? 48,
              prediction: resItem?.prediction || undefined,
              status: resItem?.error ? 'ERROR' : 'SUCCESS',
              errorMessage: resItem?.error || undefined,
            };
          });
          setActiveCsvRecords(records);
          if (records.length > 0) {
            const first = records[0];
            setSelectedLocation({
              type: 'COORDINATE',
              name: first.location_id,
              latitude: first.latitude,
              longitude: first.longitude,
              elevation: first.elevation,
              slope: first.slope,
              aspect: first.aspect,
              temperature: first.temperature,
              snow_depth: first.snow_depth ?? 140,
              snow_water_equivalent: first.snow_water_equivalent ?? 220,
              snowfall_6h: first.snowfall_6h ?? 8,
              snowfall_24h: first.snowfall_24h ?? 22,
              snowfall_72h: first.snowfall_72h ?? 38,
              temperature_delta_24h: first.temperature_delta_24h ?? -3.0,
              wind_speed_mean_24h: first.wind_speed_mean_24h ?? 24,
              wind_speed_max_24h: first.wind_speed_max_24h ?? 48,
              telemetry_age_minutes: 18,
            });
            if (first.prediction) {
              setPrediction(first.prediction);
            }
          }
        }
      } catch (err) {
        console.warn('Initial CSV evaluation warning:', err);
      }
    };
    initDefaultCsv();
  }, []);

  // 3. Evaluate Risk for Selected Location
  const evaluateLocationRisk = async (loc: SelectedLocationState) => {
    const domain = detectDomainFromCoords(loc.latitude, loc.longitude);
    if (domain === 'COLORADO') {
      setIsLoadingPrediction(true);
      try {
        const pred = await api.predictPoint({
          latitude: loc.latitude,
          longitude: loc.longitude,
          elevation: loc.elevation,
          slope: loc.slope,
          aspect: loc.aspect,
          temperature: loc.temperature,
          snow_depth: loc.snow_depth,
          snow_water_equivalent: loc.snow_water_equivalent,
          snowfall_6h: loc.snowfall_6h,
          snowfall_24h: loc.snowfall_24h,
          snowfall_72h: loc.snowfall_72h,
          temperature_delta_24h: loc.temperature_delta_24h,
          wind_speed_mean_24h: loc.wind_speed_mean_24h,
          wind_speed_max_24h: loc.wind_speed_max_24h,
          location_id: loc.name,
        });
        setPrediction(pred);
      } catch (err: any) {
        console.error('Prediction query error:', err);
      } finally {
        setIsLoadingPrediction(false);
      }
    } else {
      // Research domain (Himalayas): execute dedicated Himalayan research inference (N=44)
      setIsLoadingPrediction(true);
      try {
        const pred = await api.predictHimalayaResearch({
          latitude: loc.latitude,
          longitude: loc.longitude,
          elevation: loc.elevation,
          slope: loc.slope,
          aspect: loc.aspect,
          temperature: loc.temperature,
          snow_depth: loc.snow_depth,
          snow_water_equivalent: loc.snow_water_equivalent,
          snowfall_6h: loc.snowfall_6h,
          snowfall_24h: loc.snowfall_24h,
          snowfall_72h: loc.snowfall_72h,
          temperature_delta_24h: loc.temperature_delta_24h,
          wind_speed_mean_24h: loc.wind_speed_mean_24h,
          wind_speed_max_24h: loc.wind_speed_max_24h,
          location_id: loc.name,
          source: loc.source || 'CUSTOM_CSV',
        });
        setPrediction(pred);
      } catch (err: any) {
        console.error('Himalayan research prediction error:', err);
        setPrediction({
          model_risk_score: null,
          final_risk_score: null,
          model_risk_level: 'INSUFFICIENT_DATA',
          final_risk_level: 'INSUFFICIENT_DATA',
          risk_level: 'INSUFFICIENT_DATA',
          risk_escalated: false,
          risk_escalation_reasons: [],
          data_quality: 'GOOD',
          warnings: ['Himalayan research model could not evaluate target.'],
          raw_probability: null,
          calibrated_probability: null,
          model_version: 'himalaya_random_forest_v1',
          operating_threshold: 0.40,
          thresholds: { medium: 0.40, high: 0.70 },
          provenance: { source: loc.source || 'CSV_DATASET', domain: 'HIMALAYA' },
          disclaimer: 'Research Decision-Support Prototype. Operational avalanche forecasting remains disabled for scientific safety.',
          domain: 'HIMALAYA',
        });
      } finally {
        setIsLoadingPrediction(false);
      }
    }
  };

  // Run initial prediction on default location
  useEffect(() => {
    evaluateLocationRisk(selectedLocation);
  }, []);

  const handleSelectLocation = (loc: SelectedLocationState) => {
    const domain = detectDomainFromCoords(loc.latitude, loc.longitude);
    setSelectedDomain(domain);
    setSelectedLocation(loc);
    setAppliedTargetId(loc.id || loc.name);
    evaluateLocationRisk(loc);
  };

  const selectCsvRecordByIndex = (records: EvaluatedPointRecord[], index: number) => {
    if (!records || records.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, records.length - 1));
    setSelectedCsvIndex(clampedIndex);
    const rec = records[clampedIndex];
    if (rec) {
      const locState: SelectedLocationState = {
        type: 'CSV_LOCATION',
        id: rec.id,
        name: rec.location_id,
        latitude: rec.latitude,
        longitude: rec.longitude,
        elevation: rec.elevation,
        slope: rec.slope,
        aspect: rec.aspect,
        temperature: rec.temperature,
        snow_depth: rec.snow_depth ?? 140,
        snow_water_equivalent: rec.snow_water_equivalent ?? 220,
        snowfall_6h: rec.snowfall_6h ?? 8,
        snowfall_24h: rec.snowfall_24h ?? 22,
        snowfall_72h: rec.snowfall_72h ?? 38,
        temperature_delta_24h: rec.temperature_delta_24h ?? -3.0,
        wind_speed_mean_24h: rec.wind_speed_mean_24h ?? 24,
        wind_speed_max_24h: rec.wind_speed_max_24h ?? 48,
        telemetry_age_minutes: 0,
        source: 'CSV_DATASET',
      };
      handleSelectLocation(locState);
    }
  };

  const isCsvSource = selectedLocation.source === 'CSV_DATASET' || selectedLocation.type === 'CSV_LOCATION';
  const isResearchDomain = selectedDomain === 'INDIA' || isCsvSource;

  const currentContext: PredictionContext = {
    target_id: selectedLocation.name,
    target_name: selectedLocation.name,
    target_type: selectedLocation.type === 'STATION' ? 'STATION' : 'COORDINATE',
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
    elevation: selectedLocation.elevation,
    slope: selectedLocation.slope,
    aspect: selectedLocation.aspect,
    temperature: selectedLocation.temperature,
    humidity: selectedLocation.humidity ?? 72,
    pressure: selectedLocation.pressure ?? 670,
    precipitation: selectedLocation.precipitation ?? 8.0,
    wind_speed_mean_24h: selectedLocation.wind_speed_mean_24h,
    wind_speed_max_24h: selectedLocation.wind_speed_max_24h,
    snow_depth: selectedLocation.snow_depth,
    snow_water_equivalent: selectedLocation.snow_water_equivalent,
    snowfall_6h: selectedLocation.snowfall_6h,
    snowfall_24h: selectedLocation.snowfall_24h,
    snowfall_72h: selectedLocation.snowfall_72h,
    temperature_delta_24h: selectedLocation.temperature_delta_24h,
    temperature_delta_72h: selectedLocation.temperature_delta_72h ?? null,
    telemetry_timestamp: new Date().toISOString(),
    telemetry_age_minutes: isResearchDomain ? 0 : (selectedLocation.telemetry_age_minutes ?? 18),
    data_quality: isResearchDomain ? 'GOOD' : (prediction?.data_quality ?? 'GOOD'),
    freshness_state: 'GOOD',
    assessment_status: 'CURRENT',
    prediction_available: !isResearchDomain && !!prediction,
    suppression_reason: null,
    current_utc: new Date().toISOString(),
    telemetry_status: 'GOOD',
    last_observation_timestamp: isResearchDomain ? null : new Date().toISOString(),
    telemetry_source: isResearchDomain ? 'CUSTOM CSV DATASET' : 'USDA NRCS AWDB',
    domain: selectedDomain === 'INDIA' ? 'HIMALAYA' : 'COLORADO',
    prediction: prediction,
    isLoading: isLoadingPrediction,
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* 1. Header (Brand Identity + Single Navigation Bar) */}
      <Header
        health={health}
        freshness={freshness}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePassCount={activeCsvRecords.length || 8}
        selectedDomain={selectedDomain}
        setSelectedDomain={setSelectedDomain}
        onOpenUploadModal={() => setActiveTab('custom-data')}
      />

      {/* 2. Main Views */}
      {activeTab === 'custom-data' ? (
        <main className="flex-1 p-3.5 sm:p-5 min-w-0 max-w-[1920px] mx-auto w-full">
          <CustomDataStudio
            activeCsvRecords={activeCsvRecords}
            activeCsvFilename={activeCsvFilename}
            appliedTargetId={appliedTargetId}
            onSetActiveCsvDataset={(records, filename) => {
              setActiveCsvRecords(records);
              setActiveCsvFilename(filename);
              if (records.length > 0) {
                selectCsvRecordByIndex(records, 0);
              }
            }}
            onApplyLocationToConsole={(loc) => {
              handleSelectLocation(loc);
              setActiveTab('console');
            }}
            onNavigateToConsole={() => setActiveTab('console')}
          />
        </main>
      ) : activeTab === 'analytics' ? (
        <main className="flex-1 p-3.5 sm:p-5 min-w-0 max-w-[1920px] mx-auto w-full">
          <SnowWeatherAnalytics
            records={activeCsvRecords}
            activeCsvFilename={activeCsvFilename}
            onSelectLocation={(loc) => {
              handleSelectLocation(loc);
              setActiveTab('console');
            }}
            onNavigateToConsole={() => setActiveTab('console')}
          />
        </main>
      ) : activeTab === 'advisories' ? (
        <main className="flex-1 p-3.5 sm:p-5 min-w-0 max-w-[1920px] mx-auto w-full">
          <SafetyAdvisoriesPanel
            records={activeCsvRecords}
            activeCsvFilename={activeCsvFilename}
            onSelectLocation={(loc) => {
              handleSelectLocation(loc);
              setActiveTab('console');
            }}
            onNavigateToConsole={() => setActiveTab('console')}
          />
        </main>
      ) : activeTab === 'history' ? (
        <main className="flex-1 p-3.5 sm:p-5 min-w-0 max-w-[1920px] mx-auto w-full">
          <HistoricalPlaybackPanel />
        </main>
      ) : (
        /* ================= 4. OPERATIONS CONSOLE (3-COLUMN LAYOUT) ================= */
        <main className="flex-1 flex flex-col min-w-0 w-full">
          {/* Dataset Context Bar */}
          {activeCsvRecords.length > 0 && (
            <DatasetContextBar
              filename={activeCsvFilename}
              records={activeCsvRecords}
              selectedIndex={selectedCsvIndex}
              onSelectIndex={(idx) => selectCsvRecordByIndex(activeCsvRecords, idx)}
              regionFilter={regionFilter}
              onRegionChange={(reg) => {
                setRegionFilter(reg);
                const subset = activeCsvRecords.filter((r) => {
                  if (reg === 'ALL') return true;
                  const lat = r.latitude;
                  const lon = r.longitude;
                  if (reg === 'HIMALAYAS') return lat >= 20 && lat <= 40 && lon >= 68 && lon <= 100;
                  if (reg === 'ALPS') return lat >= 42 && lat <= 49 && lon >= 4 && lon <= 17;
                  if (reg === 'AMERICAS') return (lat >= 30 && lat <= 70 && lon >= -170 && lon <= -60) || (lat >= -56 && lat <= 15 && lon >= -82 && lon <= -60);
                  if (reg === 'PACIFIC') return (lat >= -48 && lat <= -34 && lon >= 165 && lon <= 179) || (lat >= 30 && lat <= 46 && lon >= 128 && lon <= 146) || (lat >= 40 && lat <= 45 && lon >= 38 && lon <= 50) || (lat >= 58 && lat <= 72 && lon >= 5 && lon <= 30);
                  return true;
                });
                if (subset.length > 0) {
                  const firstIndex = activeCsvRecords.findIndex((r) => r.id === subset[0].id);
                  if (firstIndex >= 0) {
                    selectCsvRecordByIndex(activeCsvRecords, firstIndex);
                  }
                }
              }}
              onOpenDataStudio={() => setActiveTab('custom-data')}
            />
          )}

          {/* 3-Column Grid Container */}
          <div className="p-3 sm:p-4 max-w-[1920px] mx-auto w-full flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start min-w-0">
              {/* COLUMN 1: GIS Operations Map (Left ~38-40%) */}
              <div className="lg:col-span-5 xl:col-span-5 min-w-0 w-full h-full min-h-[500px] lg:min-h-[720px] flex flex-col">
                <ColoradoMap
                  zones={zones}
                  stations={stations}
                  historicalEvents={historicalEvents}
                  selectedLocation={selectedLocation}
                  onSelectLocation={handleSelectLocation}
                  showEvents={showHistoricalEvents}
                  activeRiskLevel={prediction?.final_risk_level}
                  layerVisibility={layerVisibility}
                  riskSurface={activeRiskSurface}
                  selectedDomain={selectedDomain}
                />
              </div>

              {/* COLUMN 2: Target Evaluation & Decision Policy Engine (Center ~33-35%) */}
              <div className="lg:col-span-4 xl:col-span-4 min-w-0 w-full space-y-3">
                <RiskAssessmentPanel
                  context={currentContext}
                  onRefresh={() => evaluateLocationRisk(selectedLocation)}
                />
              </div>

              {/* COLUMN 3: Live Telemetry, Diagnostics & Spatial Intelligence (Right ~28-30%) */}
              <div className="lg:col-span-3 xl:col-span-3 min-w-0 w-full space-y-3">
                <TelemetryMatrixPanel
                  context={currentContext}
                  riskSurface={activeRiskSurface}
                />
              </div>
            </div>
          </div>
        </main>
      )}

      {/* 5. Bottom Operational Disclaimer & Provenance Bar */}
      <DisclaimerBanner
        onOpenProvenance={() => setIsProvenanceModalOpen(true)}
        modelVersion={prediction?.model_version || 'Colorado Avalanche RF v3 (Calibrated)'}
        syncTimestamp="2026-05-15 10:24 UTC"
      />

      {/* 6. Data Provenance Modal */}
      <DataProvenanceModal
        isOpen={isProvenanceModalOpen}
        onClose={() => setIsProvenanceModalOpen(false)}
        context={currentContext}
      />
    </div>
  );
}

export default App;
