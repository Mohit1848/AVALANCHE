import { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { ColoradoMap } from './components/map/ColoradoMap';
import { RiskAssessmentPanel } from './components/risk/RiskAssessmentPanel';
import { TerrainPanel } from './components/terrain/TerrainPanel';
import { SnowpackPanel } from './components/snowpack/SnowpackPanel';
import { WeatherPanel } from './components/weather/WeatherPanel';
import { CustomDataStudio } from './components/custom/CustomDataStudio';
import { SnowWeatherAnalytics } from './components/analytics/SnowWeatherAnalytics';
import { SafetyAdvisoriesPanel } from './components/advisories/SafetyAdvisoriesPanel';
import { api, parseCSV, SAMPLE_TEMPLATES } from './services/api';
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
} from './types';
import { Layers, FileSpreadsheet, MapPin } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'console' | 'custom-data' | 'analytics' | 'advisories'>('console');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [freshness, setFreshness] = useState<TelemetryFreshnessStatus | null>(null);
  const [zones, setZones] = useState<AvalancheZone[]>([]);
  const [stations, setStations] = useState<SnotelStation[]>([]);
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEvent[]>([]);

  // Active CSV Dataset State (Powers the whole application)
  const [activeCsvRecords, setActiveCsvRecords] = useState<EvaluatedPointRecord[]>([]);
  const [activeCsvFilename, setActiveCsvFilename] = useState<string>('global_avalanche_mountains_master.csv');
  const [selectedCsvIndex, setSelectedCsvIndex] = useState<number>(0);
  const [regionFilter, setRegionFilter] = useState<'ALL' | 'HIMALAYAS' | 'ALPS' | 'AMERICAS' | 'PACIFIC'>('ALL');

  // Spatial & Layer state
  const [activeRiskSurface] = useState<SpatialPredictionGridResponse | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityState>({
    historicalEvents: true,
    snotelStations: true,
    forecastZones: true,
    highResTerrain: true,
    contours20m: false,
    contours50m: true,
    contours100m: true,
    riskSurface: true,
  });

  // Map Filter state
  const [showHistoricalEvents, setShowHistoricalEvents] = useState<boolean>(true);

  // Selected Location / Query State
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationState>({
    type: 'COORDINATE',
    name: 'Berthoud Pass Summit',
    latitude: 39.798,
    longitude: -105.778,
    elevation: 3444.0,
    slope: 40.0,
    aspect: 45.0,
    temperature: -5.5,
    snow_depth: 165.0,
    snow_water_equivalent: 280.0,
    snowfall_6h: 8.0,
    snowfall_24h: 36.0,
    snowfall_72h: 58.0,
    temperature_delta_24h: -3.0,
    wind_speed_mean_24h: 32.0,
    wind_speed_max_24h: 62.0,
    telemetry_age_minutes: 12,
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

  // 2. Initial evaluation of default CSV dataset so app starts with real CSV-powered mountain data
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
              elevation: pt.elevation ?? 3400,
              slope: pt.slope ?? 36,
              aspect: pt.aspect ?? 45,
              temperature: pt.temperature ?? -5,
              humidity: pt.humidity,
              pressure: pt.pressure,
              snow_depth: pt.snow_depth ?? 120,
              snow_water_equivalent: pt.snow_water_equivalent ?? 200,
              snowfall_6h: pt.snowfall_6h ?? 0,
              snowfall_24h: pt.snowfall_24h ?? 15,
              snowfall_72h: pt.snowfall_72h ?? 35,
              wind_speed_mean_24h: pt.wind_speed_mean_24h ?? 20,
              wind_speed_max_24h: pt.wind_speed_max_24h ?? 40,
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
              snow_depth: first.snow_depth ?? 120,
              snow_water_equivalent: first.snow_water_equivalent ?? 200,
              snowfall_6h: first.snowfall_6h ?? 0,
              snowfall_24h: first.snowfall_24h ?? 15,
              snowfall_72h: first.snowfall_72h ?? 35,
              temperature_delta_24h: first.temperature_delta_24h ?? 0,
              wind_speed_mean_24h: first.wind_speed_mean_24h ?? 20,
              wind_speed_max_24h: first.wind_speed_max_24h ?? 40,
              telemetry_age_minutes: 0,
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
  };

  // Run initial prediction on default location
  useEffect(() => {
    evaluateLocationRisk(selectedLocation);
  }, []);

  const selectCsvRecordByIndex = (records: EvaluatedPointRecord[], index: number) => {
    if (!records || records.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, records.length - 1));
    setSelectedCsvIndex(clampedIndex);
    const rec = records[clampedIndex];
    if (rec) {
      const locState: SelectedLocationState = {
        type: 'COORDINATE',
        name: rec.location_id,
        latitude: rec.latitude,
        longitude: rec.longitude,
        elevation: rec.elevation,
        slope: rec.slope,
        aspect: rec.aspect,
        temperature: rec.temperature,
        snow_depth: rec.snow_depth ?? 120,
        snow_water_equivalent: rec.snow_water_equivalent ?? 200,
        snowfall_6h: rec.snowfall_6h ?? 0,
        snowfall_24h: rec.snowfall_24h ?? 15,
        snowfall_72h: rec.snowfall_72h ?? 35,
        temperature_delta_24h: rec.temperature_delta_24h ?? 0,
        wind_speed_mean_24h: rec.wind_speed_mean_24h ?? 20,
        wind_speed_max_24h: rec.wind_speed_max_24h ?? 40,
        telemetry_age_minutes: 0,
      };
      setSelectedLocation(locState);
      if (rec.prediction) {
        setPrediction(rec.prediction);
      } else {
        evaluateLocationRisk(locState);
      }
    }
  };

  const handleSelectLocation = (loc: SelectedLocationState) => {
    setSelectedLocation(loc);
    evaluateLocationRisk(loc);
  };

  const isRecordInRegion = (r: EvaluatedPointRecord, reg: string) => {
    if (reg === 'ALL') return true;
    const lat = r.latitude;
    const lon = r.longitude;
    if (reg === 'HIMALAYAS') return lat >= 20 && lat <= 40 && lon >= 68 && lon <= 100;
    if (reg === 'ALPS') return lat >= 42 && lat <= 49 && lon >= 4 && lon <= 17;
    if (reg === 'AMERICAS') return (lat >= 30 && lat <= 70 && lon >= -170 && lon <= -60) || (lat >= -56 && lat <= 15 && lon >= -82 && lon <= -60);
    if (reg === 'PACIFIC') return (lat >= -48 && lat <= -34 && lon >= 165 && lon <= 179) || (lat >= 30 && lat <= 46 && lon >= 128 && lon <= 146) || (lat >= 40 && lat <= 45 && lon >= 38 && lon <= 50) || (lat >= 58 && lat <= 72 && lon >= 5 && lon <= 30);
    return true;
  };

  const filteredNavRecords = activeCsvRecords.filter((r) => isRecordInRegion(r, regionFilter));

  const handleRegionChange = (newReg: 'ALL' | 'HIMALAYAS' | 'ALPS' | 'AMERICAS' | 'PACIFIC') => {
    setRegionFilter(newReg);
    const subset = activeCsvRecords.filter((r) => isRecordInRegion(r, newReg));
    if (subset.length > 0) {
      const firstIndex = activeCsvRecords.findIndex((r) => r.id === subset[0].id);
      if (firstIndex >= 0) {
        selectCsvRecordByIndex(activeCsvRecords, firstIndex);
      }
    }
  };

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
    humidity: selectedLocation.humidity ?? 65,
    pressure: selectedLocation.pressure ?? 700,
    precipitation: selectedLocation.precipitation ?? 0,
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
    telemetry_age_minutes: selectedLocation.telemetry_age_minutes ?? 0,
    data_quality: prediction?.data_quality ?? 'GOOD',
    freshness_state: 'GOOD',
    assessment_status: 'CURRENT',
    prediction_available: !!prediction,
    suppression_reason: null,
    current_utc: new Date().toISOString(),
    telemetry_status: 'GOOD',
    last_observation_timestamp: new Date().toISOString(),
    prediction: prediction,
    isLoading: isLoadingPrediction,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Real-World Clean Brand Header */}
      <Header
        health={health}
        freshness={freshness}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePassCount={activeCsvRecords.length}
      />

      {/* 2. Main Operational Views */}
      {activeTab === 'custom-data' ? (
        <main className="flex-1 p-3.5 sm:p-5 min-w-0">
          <CustomDataStudio
            activeCsvRecords={activeCsvRecords}
            activeCsvFilename={activeCsvFilename}
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
        <main className="flex-1 p-3.5 sm:p-5 min-w-0">
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
        <main className="flex-1 p-3.5 sm:p-5 min-w-0">
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
      ) : (
        /* OPERATIONS CONSOLE */
        <main className="flex-1 p-3.5 sm:p-5 space-y-4 max-w-[1600px] mx-auto w-full min-w-0">
          {/* Active Mountain Pass Navigator Bar */}
          {activeCsvRecords.length > 0 && (
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-800/60 rounded-xl p-3 flex flex-col gap-2.5 text-xs shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="bg-emerald-950 p-2 rounded-xl border border-emerald-700 text-emerald-400 shrink-0 shadow-sm">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">OPERATIONAL DATASET:</span>
                      <strong className="text-emerald-300 text-xs font-mono truncate">{activeCsvFilename}</strong>
                      <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                        {activeCsvRecords.length} Global Mountains Loaded
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pass Quick Chips & Controls */}
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => selectCsvRecordByIndex(activeCsvRecords, selectedCsvIndex - 1)}
                      disabled={selectedCsvIndex <= 0}
                      className="px-2.5 py-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold transition-all"
                      title="Previous mountain"
                    >
                      &larr; Prev
                    </button>
                    <span className="px-2.5 text-emerald-400 font-bold border-x border-slate-800">
                      {selectedCsvIndex + 1} / {activeCsvRecords.length}
                    </span>
                    <button
                      onClick={() => selectCsvRecordByIndex(activeCsvRecords, selectedCsvIndex + 1)}
                      disabled={selectedCsvIndex >= activeCsvRecords.length - 1}
                      className="px-2.5 py-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold transition-all"
                      title="Next mountain"
                    >
                      Next &rarr;
                    </button>
                  </div>

                  <select
                    value={selectedCsvIndex}
                    onChange={(e) => selectCsvRecordByIndex(activeCsvRecords, parseInt(e.target.value, 10))}
                    className="bg-slate-950 border border-emerald-700/80 text-emerald-300 font-bold rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[320px] truncate shadow-inner"
                    aria-label="Select Mountain Location"
                  >
                    {filteredNavRecords.map((r) => {
                      const actualIdx = activeCsvRecords.findIndex((item) => item.id === r.id);
                      return (
                        <option key={r.id} value={actualIdx}>
                          {actualIdx + 1}. {r.location_id} ({r.prediction?.final_risk_level ?? 'CALC'})
                        </option>
                      );
                    })}
                  </select>

                  <button
                    onClick={() => setActiveTab('custom-data')}
                    className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-all shadow-sm"
                  >
                    Upload / Presets
                  </button>
                </div>
              </div>

              {/* Quick Continent Filter Bar */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">FILTER CONTINENT:</span>
                <button
                  onClick={() => handleRegionChange('ALL')}
                  className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                    regionFilter === 'ALL'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  🌍 All ({activeCsvRecords.length})
                </button>
                <button
                  onClick={() => handleRegionChange('HIMALAYAS')}
                  className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                    regionFilter === 'HIMALAYAS'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'bg-slate-950 text-amber-400 hover:text-amber-200 border border-amber-900/60'
                  }`}
                >
                  🏔️ Himalayas & Asia
                </button>
                <button
                  onClick={() => handleRegionChange('ALPS')}
                  className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                    regionFilter === 'ALPS'
                      ? 'bg-cyan-600 text-white font-bold shadow-sm'
                      : 'bg-slate-950 text-cyan-400 hover:text-cyan-200 border border-cyan-900/60'
                  }`}
                >
                  ⛷️ European Alps
                </button>
                <button
                  onClick={() => handleRegionChange('AMERICAS')}
                  className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                    regionFilter === 'AMERICAS'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-slate-950 text-emerald-400 hover:text-emerald-200 border border-emerald-900/60'
                  }`}
                >
                  🌲 Americas (Rockies & Andes)
                </button>
                <button
                  onClick={() => handleRegionChange('PACIFIC')}
                  className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                    regionFilter === 'PACIFIC'
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'bg-slate-950 text-indigo-400 hover:text-indigo-200 border border-indigo-900/60'
                  }`}
                >
                  🗾 Japan, NZ & Scandinavia
                </button>
              </div>
            </div>
          )}

          {/* Main Operational Split Grid: GIS Map (Left) + Risk Intelligence Card (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-w-0">
            {/* LEFT (7 Cols): Interactive Topographic GIS Map */}
            <div className="lg:col-span-7 flex flex-col space-y-2.5 min-w-0 w-full">
              {/* Map Layer Toolbar */}
              <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>GIS LAYERS:</span>
                  </span>
                  <div className="flex flex-wrap gap-1 text-[11px] font-mono">
                    <button
                      onClick={() =>
                        setLayerVisibility((prev) => ({ ...prev, contours50m: !prev.contours50m }))
                      }
                      className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        layerVisibility.contours50m
                          ? 'bg-cyan-950 border-cyan-700 text-cyan-300 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      50m Contours
                    </button>
                    <button
                      onClick={() =>
                        setLayerVisibility((prev) => ({ ...prev, snotelStations: !prev.snotelStations }))
                      }
                      className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        layerVisibility.snotelStations
                          ? 'bg-emerald-950 border-emerald-700 text-emerald-300 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      SNOTEL
                    </button>
                    <button
                      onClick={() => setShowHistoricalEvents((prev) => !prev)}
                      className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        showHistoricalEvents
                          ? 'bg-purple-950 border-purple-700 text-purple-300 font-semibold'
                          : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      Historical
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px] truncate">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{selectedLocation.name}</span>
                </div>
              </div>

              {/* Leaflet Map Box */}
              <div className="relative w-full h-[380px] sm:h-[440px] md:h-[480px] lg:h-[500px] xl:h-[clamp(500px,58vh,640px)] rounded-xl overflow-hidden min-w-0 shadow-xl border border-slate-800">
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
                  selectedDomain="COLORADO"
                />
              </div>
            </div>

            {/* RIGHT (5 Cols): Real-Time Risk Intelligence & Safety Assessment */}
            <div className="lg:col-span-5 flex flex-col space-y-3 min-w-0 w-full">
              <RiskAssessmentPanel
                context={currentContext}
                onRefresh={() => evaluateLocationRisk(selectedLocation)}
              />
            </div>
          </div>

          {/* Bottom Diagnostics Grid: Terrain + Snowpack + Weather */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0 w-full">
            <div className="min-w-0 w-full">
              <TerrainPanel context={currentContext} />
            </div>
            <div className="min-w-0 w-full">
              <SnowpackPanel context={currentContext} />
            </div>
            <div className="min-w-0 w-full">
              <WeatherPanel context={currentContext} />
            </div>
          </div>
        </main>
      )}

      {/* Modern Operational Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-500 font-mono flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>AVALANCHE RISK INTELLIGENCE • MOUNTAIN SAFETY OPERATIONS SYSTEM</span>
        </div>
        <div className="text-slate-600 text-[11px]">
          Operational Decision Support for Backcountry, Highways & Search and Rescue
        </div>
      </footer>
    </div>
  );
}

export default App;
