import { useState, useEffect, useRef } from 'react';
import { Header } from './components/common/Header';
import { DisclaimerBanner } from './components/common/DisclaimerBanner';
import { ColoradoMap } from './components/map/ColoradoMap';
import { RiskAssessmentPanel } from './components/risk/RiskAssessmentPanel';
import { IndianPeakPanel } from './components/india/IndianPeakPanel';
import { TerrainPanel } from './components/terrain/TerrainPanel';
import { SnowpackPanel } from './components/snowpack/SnowpackPanel';
import { WeatherPanel } from './components/weather/WeatherPanel';
import { TelemetrySimulationPanel } from './components/telemetry/TelemetrySimulationPanel';
import { ModelResearchPage } from './components/model/ModelResearchPage';
import { RiskHistoryTimeline } from './components/history/RiskHistoryTimeline';
import { HistoricalPlaybackPanel } from './components/history/HistoricalPlaybackPanel';
import { SpatialIntelligencePanel } from './components/spatial/SpatialIntelligencePanel';
import { api } from './services/api';
import type {
  HealthStatus,
  TelemetryFreshnessStatus,
  AvalancheZone,
  SnotelStation,
  HistoricalEvent,
  RiskPredictionResponse,
  PersistedPredictionRecord,
  ModelMetadata,
  SelectedLocationState,
  SpatialPredictionGridResponse,
  ZoneRiskSummary,
  SpatialValidationMetrics,
  LayerVisibilityState,
  IndianPeak,
  IndianRegion,
  GeographicDomain,
  PredictionContext,
} from './types';
import { Layers, AlertCircle, Search, Mountain, ShieldAlert } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'console' | 'spatial' | 'history' | 'playback' | 'research'>('console');
  const [selectedDomain, setSelectedDomain] = useState<GeographicDomain>('COLORADO');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [freshness, setFreshness] = useState<TelemetryFreshnessStatus | null>(null);
  const [zones, setZones] = useState<AvalancheZone[]>([]);
  const [stations, setStations] = useState<SnotelStation[]>([]);
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEvent[]>([]);
  const [predictionsHistory, setPredictionsHistory] = useState<PersistedPredictionRecord[]>([]);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [isLivePolling, setIsLivePolling] = useState<boolean>(true);

  // Indian Himalayan Geography State
  const [indianPeaks, setIndianPeaks] = useState<IndianPeak[]>([]);
  const [indianRegions, setIndianRegions] = useState<IndianRegion[]>([]);
  const [selectedIndianPeak, setSelectedIndianPeak] = useState<IndianPeak | null>(null);
  const [peakSearchQuery, setPeakSearchQuery] = useState<string>('');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');

  // Phase 5 Spatial state
  const [activeRiskSurface, setActiveRiskSurface] = useState<SpatialPredictionGridResponse | null>(null);
  const [forecastZones, setForecastZones] = useState<ZoneRiskSummary[]>([]);
  const [spatialValidation, setSpatialValidation] = useState<SpatialValidationMetrics | null>(null);
  const [isLoadingSurface, setIsLoadingSurface] = useState<boolean>(false);
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
  const [selectedSeason, setSelectedSeason] = useState<string>('ALL');
  const [selectedTrigger, setSelectedTrigger] = useState<string>('ALL');

  // Single Source of Truth Prediction Context
  const [predictionContext, setPredictionContext] = useState<PredictionContext>({
    target_id: '335',
    target_name: 'SNOTEL 335: Berthoud Summit',
    target_type: 'STATION',
    latitude: 39.798,
    longitude: -105.778,
    elevation: 3444,
    slope: 36.0,
    aspect: 45.0,
    temperature: null,
    humidity: null,
    pressure: null,
    precipitation: null,
    wind_speed_mean_24h: null,
    wind_speed_max_24h: null,
    snow_depth: null,
    snow_water_equivalent: null,
    snowfall_6h: null,
    snowfall_24h: null,
    snowfall_72h: null,
    temperature_delta_24h: null,
    temperature_delta_72h: null,
    telemetry_timestamp: null,
    telemetry_age_minutes: null,
    data_quality: 'GOOD',
    freshness_state: 'GOOD',
    assessment_status: 'CURRENT',
    prediction_available: true,
    suppression_reason: null,
    current_utc: new Date().toISOString(),
    last_observation_timestamp: null,
    telemetry_status: 'GOOD',
    telemetry_source: 'SNOTEL Automated Telemetry (AWDB)',
    terrain_source: 'Copernicus GLO-30 DEM (30m)',
    prediction: null,
    rules_evaluation: [],
    isLoading: true,
    error: null,
  });

  // Request sequence and abort controller for race-condition safety
  const activeRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const toggleLayer = (layerKey: keyof LayerVisibilityState) => {
    setLayerVisibility((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // 1. Initial Load of Health, Freshness, Zones, Stations, Events, History, and Indian Geography
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [hRes, fRes, mRes, histRes, zRes, sValRes, peaksRes, regionsRes] = await Promise.all([
          api.getHealth(),
          api.getTelemetryFreshness(),
          api.getModelMetadata(),
          api.getPredictionHistory(),
          api.getForecastZones(),
          api.getSpatialValidation(),
          api.getIndianPeaks(),
          api.getIndianRegions(),
        ]);
        setHealth(hRes);
        setFreshness(fRes);
        setMetadata(mRes);
        setPredictionsHistory(histRes);
        setForecastZones(zRes);
        setSpatialValidation(sValRes);
        setIndianPeaks(peaksRes.peaks);
        setIndianRegions(regionsRes.regions);

        if (peaksRes.peaks.length > 0) {
          setSelectedIndianPeak(peaksRes.peaks[0]);
        }

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

  // 2. Live Polling Effect (every 30s)
  useEffect(() => {
    if (!isLivePolling) return;
    const interval = setInterval(async () => {
      try {
        const [hRes, fRes, histRes] = await Promise.all([
          api.getHealth(),
          api.getTelemetryFreshness(),
          api.getPredictionHistory(),
        ]);
        setHealth(hRes);
        setFreshness(fRes);
        setPredictionsHistory(histRes);
      } catch (err) {
        console.warn('Live polling warning:', err);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isLivePolling]);

  // 3. Load Authoritative Station Assessment (Single Source of Truth)
  const loadStationAssessment = async (
    stationId: string,
    name: string,
    lat: number,
    lon: number,
    elev: number,
    slope: number = 36.0,
    aspect: number = 45.0
  ) => {
    if (selectedDomain === 'INDIA') return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const reqId = ++activeRequestIdRef.current;

    // Immediately set into clean loading state with cleared previous prediction
    setPredictionContext((prev) => ({
      ...prev,
      target_id: stationId,
      target_name: `SNOTEL ${stationId}: ${name}`,
      target_type: 'STATION',
      latitude: lat,
      longitude: lon,
      elevation: elev,
      slope,
      aspect,
      isLoading: true,
      error: null,
      prediction: null,
      rules_evaluation: [],
    }));

    try {
      const res = await api.getStationAssessment(stationId, slope, aspect, controller.signal);
      if (activeRequestIdRef.current !== reqId) return;

      setPredictionContext({
        target_id: stationId,
        target_name: `SNOTEL ${stationId}: ${res.station_name || name}`,
        target_type: 'STATION',
        latitude: res.latitude ?? lat,
        longitude: res.longitude ?? lon,
        elevation: res.elevation ?? elev,
        slope: res.slope ?? slope,
        aspect: res.aspect ?? aspect,
        temperature: res.features?.temperature ?? null,
        humidity: res.features?.humidity ?? null,
        pressure: res.features?.pressure ?? null,
        precipitation: res.features?.precipitation ?? null,
        wind_speed_mean_24h: res.features?.wind_speed_mean_24h ?? null,
        wind_speed_max_24h: res.features?.wind_speed_max_24h ?? null,
        snow_depth: res.features?.snow_depth ?? null,
        snow_water_equivalent: res.features?.snow_water_equivalent ?? null,
        snowfall_6h: res.features?.snowfall_6h ?? null,
        snowfall_24h: res.features?.snowfall_24h ?? null,
        snowfall_72h: res.features?.snowfall_72h ?? null,
        temperature_delta_24h: res.features?.temperature_delta_24h ?? null,
        temperature_delta_72h: res.features?.temperature_delta_72h ?? null,
        telemetry_timestamp: res.telemetry_timestamp || res.last_observation_timestamp,
        telemetry_age_minutes: res.telemetry_age_minutes,
        data_quality: res.data_quality || res.telemetry_status || 'GOOD',
        freshness_state: res.freshness_state || res.telemetry_status || 'GOOD',
        assessment_status: res.assessment_status || (res.telemetry_status === 'STALE' ? 'SUPPRESSED' : 'CURRENT'),
        prediction_available: res.prediction_available ?? (res.telemetry_status !== 'STALE'),
        suppression_reason: res.suppression_reason,
        current_utc: res.current_utc || new Date().toISOString(),
        last_observation_timestamp: res.last_observation_timestamp || res.telemetry_timestamp,
        telemetry_status: res.telemetry_status || 'GOOD',
        telemetry_source: 'SNOTEL Automated Telemetry (AWDB)',
        terrain_source: 'Copernicus GLO-30 DEM (30m)',
        prediction: res.prediction,
        rules_evaluation: res.rules_evaluation || res.prediction?.rule_evaluations || [],
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (activeRequestIdRef.current !== reqId) return;
      console.error(`Failed to load assessment for station ${stationId}:`, err);
      setPredictionContext((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || `Failed to retrieve assessment for station ${stationId}`,
      }));
    }
  };

  // 4. Load Custom Point / Zone Assessment
  const evaluateCustomPointRisk = async (
    targetName: string,
    lat: number,
    lon: number,
    elev: number = 3450.0,
    slope: number = 36.0,
    aspect: number = 45.0,
    type: 'COORDINATE' | 'ZONE' = 'COORDINATE'
  ) => {
    if (selectedDomain === 'INDIA') return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const reqId = ++activeRequestIdRef.current;

    setPredictionContext((prev) => ({
      ...prev,
      target_id: `${lat.toFixed(3)},${lon.toFixed(3)}`,
      target_name: targetName,
      target_type: type,
      latitude: lat,
      longitude: lon,
      elevation: elev,
      slope,
      aspect,
      isLoading: true,
      error: null,
      prediction: null,
      rules_evaluation: [],
    }));

    try {
      const pred = await api.predictPoint({
        latitude: lat,
        longitude: lon,
        elevation: elev,
        slope,
        aspect,
        location_id: targetName,
      });

      if (activeRequestIdRef.current !== reqId) return;

      const ageMin = freshness?.age_minutes ?? null;
      const status = freshness?.overall_status || 'GOOD';

      setPredictionContext({
        target_id: `${lat.toFixed(3)},${lon.toFixed(3)}`,
        target_name: targetName,
        target_type: type,
        latitude: lat,
        longitude: lon,
        elevation: elev,
        slope,
        aspect,
        temperature: pred.features?.temperature ?? null,
        humidity: pred.features?.humidity ?? null,
        pressure: pred.features?.pressure ?? null,
        precipitation: pred.features?.precipitation ?? null,
        wind_speed_mean_24h: pred.features?.wind_speed_mean_24h ?? null,
        wind_speed_max_24h: pred.features?.wind_speed_max_24h ?? null,
        snow_depth: pred.features?.snow_depth ?? null,
        snow_water_equivalent: pred.features?.snow_water_equivalent ?? null,
        snowfall_6h: pred.features?.snowfall_6h ?? null,
        snowfall_24h: pred.features?.snowfall_24h ?? null,
        snowfall_72h: pred.features?.snowfall_72h ?? null,
        temperature_delta_24h: pred.features?.temperature_delta_24h ?? null,
        temperature_delta_72h: pred.features?.temperature_delta_72h ?? null,
        telemetry_timestamp: freshness?.last_update || null,
        telemetry_age_minutes: ageMin,
        data_quality: pred.data_quality || status,
        freshness_state: status,
        assessment_status: status === 'STALE' ? 'SUPPRESSED' : 'CURRENT',
        prediction_available: status !== 'STALE',
        suppression_reason: status === 'STALE' ? 'Telemetry is stale (>6h)' : null,
        current_utc: new Date().toISOString(),
        last_observation_timestamp: freshness?.last_update || null,
        telemetry_status: status,
        telemetry_source: 'SNOTEL Regional Spatial Interpolation',
        terrain_source: 'Copernicus GLO-30 DEM (30m)',
        prediction: pred,
        rules_evaluation: pred.rule_evaluations || [],
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (activeRequestIdRef.current !== reqId) return;
      console.error('Point prediction query error:', err);
      setPredictionContext((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to communicate with prediction service.',
      }));
    }
  };

  // Initial assessment load on Colorado startup
  useEffect(() => {
    if (selectedDomain === 'COLORADO') {
      loadStationAssessment('335', 'Berthoud Summit', 39.798, -105.778, 3444);
    }
  }, [selectedDomain]);

  const handleSelectLocation = (loc: SelectedLocationState) => {
    if (loc.type === 'STATION') {
      // Find matching station ID if present in name or coords
      const matchedStation = stations.find(
        (s) => Math.abs(s.latitude - loc.latitude) < 0.01 && Math.abs(s.longitude - loc.longitude) < 0.01
      );
      if (matchedStation) {
        loadStationAssessment(matchedStation.station_id, matchedStation.name, matchedStation.latitude, matchedStation.longitude, matchedStation.elevation, loc.slope, loc.aspect);
        return;
      }
    }
    evaluateCustomPointRisk(loc.name, loc.latitude, loc.longitude, loc.elevation, loc.slope, loc.aspect, loc.type === 'ZONE' ? 'ZONE' : 'COORDINATE');
  };

  const handleSelectStation = (stationId: string, name: string, lat: number, lon: number, elev: number) => {
    loadStationAssessment(stationId, name, lat, lon, elev, 36.0, 45.0);
  };

  const handleTelemetryPrediction = (pred: RiskPredictionResponse) => {
    setPredictionContext((prev) => ({
      ...prev,
      prediction: pred,
      rules_evaluation: pred.rule_evaluations || prev.rules_evaluation,
    }));
  };

  const handleGenerateRiskSurface = async (params: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
    grid_spacing_degrees: number;
    search_radius_km: number;
    power: number;
  }) => {
    setIsLoadingSurface(true);
    try {
      const surf = await api.predictSpatialGrid(params);
      setActiveRiskSurface(surf);
      setLayerVisibility((prev) => ({ ...prev, riskSurface: true }));
    } catch (err) {
      console.error('Failed to generate spatial risk surface:', err);
    } finally {
      setIsLoadingSurface(false);
    }
  };

  // Filtered Indian peaks based on search and state filter
  const filteredIndianPeaks = indianPeaks.filter((p) => {
    const matchesSearch = peakSearchQuery.trim() === '' ||
      p.name.toLowerCase().includes(peakSearchQuery.toLowerCase()) ||
      p.region.toLowerCase().includes(peakSearchQuery.toLowerCase()) ||
      p.mountain_range.toLowerCase().includes(peakSearchQuery.toLowerCase());
    const matchesState = selectedStateFilter === 'ALL' || p.state === selectedStateFilter;
    return matchesSearch && matchesState;
  });

  // Location state for map centering/active point
  const mapSelectedLocation: SelectedLocationState = {
    type: predictionContext.target_type === 'STATION' ? 'STATION' : predictionContext.target_type === 'ZONE' ? 'ZONE' : 'COORDINATE',
    name: predictionContext.target_name,
    latitude: predictionContext.latitude,
    longitude: predictionContext.longitude,
    elevation: predictionContext.elevation,
    slope: predictionContext.slope,
    aspect: predictionContext.aspect,
    temperature: predictionContext.temperature ?? 0,
    snow_depth: predictionContext.snow_depth ?? 0,
    snow_water_equivalent: predictionContext.snow_water_equivalent ?? 0,
    snowfall_6h: predictionContext.snowfall_6h ?? 0,
    snowfall_24h: predictionContext.snowfall_24h ?? 0,
    snowfall_72h: predictionContext.snowfall_72h ?? 0,
    temperature_delta_24h: predictionContext.temperature_delta_24h ?? 0,
    wind_speed_mean_24h: predictionContext.wind_speed_mean_24h ?? 0,
    wind_speed_max_24h: predictionContext.wind_speed_max_24h ?? 0,
    telemetry_age_minutes: predictionContext.telemetry_age_minutes ?? undefined,
  };

  const [isSyncingTelemetry, setIsSyncingTelemetry] = useState<boolean>(false);

  const handleSyncColoradoTelemetry = async () => {
    setIsSyncingTelemetry(true);
    try {
      await api.syncColoradoTelemetry();
      const [hRes, fRes] = await Promise.all([
        api.getHealth(),
        api.getTelemetryFreshness(),
      ]);
      setHealth(hRes);
      setFreshness(fRes);
      if (predictionContext.target_type === 'STATION' && predictionContext.target_id) {
        loadStationAssessment(
          predictionContext.target_id,
          predictionContext.target_name,
          predictionContext.latitude,
          predictionContext.longitude,
          predictionContext.elevation,
          predictionContext.slope,
          predictionContext.aspect
        );
      }
    } catch (err) {
      console.error('Colorado telemetry sync error:', err);
    } finally {
      setIsSyncingTelemetry(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Header & Diagnostics */}
      <Header
        health={health}
        freshness={freshness}
        context={predictionContext}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLivePolling={isLivePolling}
        setIsLivePolling={setIsLivePolling}
        selectedDomain={selectedDomain}
        setSelectedDomain={setSelectedDomain}
        onSync={handleSyncColoradoTelemetry}
        isSyncing={isSyncingTelemetry}
      />

      {/* 2. Research Disclaimer Banner */}
      <DisclaimerBanner />

      {/* 3. API Disconnected Warning */}
      {health?.status === 'error' && (
        <div className="bg-red-950 border-b border-red-800 p-3 text-red-200 text-xs flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>
              <strong>INFERENCE SERVICE NOTICE:</strong> Backend at http://localhost:8000 is currently unreachable.
            </span>
          </div>
          <span className="font-mono bg-red-900 px-2 py-0.5 rounded text-[10px]">HTTP 503</span>
        </div>
      )}

      {/* 4. Tab Routing */}
      {activeTab === 'research' ? (
        <main className="flex-1 p-3.5 sm:p-4 min-w-0">
          <ModelResearchPage metadata={metadata} />
        </main>
      ) : activeTab === 'spatial' ? (
        <main className="flex-1 p-3.5 sm:p-4 space-y-4 max-w-[1600px] mx-auto w-full min-w-0">
          <SpatialIntelligencePanel
            onGenerateRiskSurface={handleGenerateRiskSurface}
            isLoadingSurface={isLoadingSurface}
            activeRiskSurface={activeRiskSurface}
            forecastZones={forecastZones}
            spatialValidation={spatialValidation}
            layerVisibility={layerVisibility}
            onToggleLayer={toggleLayer}
            mapSlot={
              <ColoradoMap
                zones={zones}
                stations={stations}
                historicalEvents={historicalEvents}
                selectedLocation={mapSelectedLocation}
                onSelectLocation={handleSelectLocation}
                onSelectStation={handleSelectStation}
                showEvents={showHistoricalEvents}
                activeRiskLevel={predictionContext.prediction?.final_risk_level}
                isLiveMode={isLivePolling}
                layerVisibility={layerVisibility}
                riskSurface={activeRiskSurface}
                selectedDomain={selectedDomain}
                indianPeaks={filteredIndianPeaks}
                selectedIndianPeak={selectedIndianPeak}
                onSelectIndianPeak={(peak) => setSelectedIndianPeak(peak)}
                freshness={freshness}
                context={predictionContext}
              />
            }
          />
        </main>
      ) : activeTab === 'history' ? (
        <main className="flex-1 p-3.5 sm:p-4 min-w-0">
          <RiskHistoryTimeline predictions={predictionsHistory} />
        </main>
      ) : activeTab === 'playback' ? (
        <main className="flex-1 p-3.5 sm:p-4 min-w-0">
          <HistoricalPlaybackPanel />
        </main>
      ) : (
        <main className="flex-1 p-3.5 sm:p-4 space-y-4 max-w-[1600px] mx-auto w-full min-w-0">
          {/* Main Top Split Grid: GIS Map (Left) + Selected Location / Peak Panel (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-w-0">
            {/* LEFT / MAIN (7 Cols): Interactive GIS Map & Layer Controls */}
            <div className="lg:col-span-7 flex flex-col space-y-2.5 min-w-0 w-full">
              {/* Map Layer Toolbar */}
              <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
                {selectedDomain === 'INDIA' ? (
                  /* Indian Himalayan Peak Search & State Filter Toolbar */
                  <div className="flex flex-wrap items-center gap-2.5 w-full min-w-0">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold shrink-0">
                      <Search className="w-4 h-4" />
                      <span className="text-xs font-mono uppercase">Search Peak:</span>
                    </div>

                    <div className="relative flex-1 min-w-[180px]">
                      <input
                        type="text"
                        value={peakSearchQuery}
                        onChange={(e) => setPeakSearchQuery(e.target.value)}
                        placeholder="Search mountain / peak (e.g. Nanda Devi, Kamet, Kangchenjunga)..."
                        className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
                        aria-label="Search mountain or peak"
                      />
                    </div>

                    <select
                      value={selectedStateFilter}
                      onChange={(e) => setSelectedStateFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 font-semibold rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500 shrink-0"
                      aria-label="Filter peaks by State"
                    >
                      <option value="ALL">All States ({indianPeaks.length} Peaks)</option>
                      <option value="Uttarakhand">Uttarakhand (6)</option>
                      <option value="Ladakh">Ladakh (5)</option>
                      <option value="Himachal Pradesh">Himachal Pradesh (3)</option>
                      <option value="Sikkim">Sikkim (5)</option>
                    </select>

                    <div className="text-[11px] font-mono text-slate-400 shrink-0">
                      Showing: <strong className="text-amber-300">{filteredIndianPeaks.length}</strong> peaks
                    </div>
                  </div>
                ) : (
                  /* Colorado GIS Layer Toolbar */
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-bold text-slate-200 shrink-0">GIS Layers:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer ml-1 text-slate-300 text-xs">
                        <input
                          type="checkbox"
                          checked={showHistoricalEvents}
                          onChange={(e) => setShowHistoricalEvents(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-cyan-500"
                        />
                        <span className="truncate">CAIC Historical Events</span>
                      </label>
                    </div>

                    {showHistoricalEvents && (
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <select
                          value={selectedSeason}
                          onChange={(e) => setSelectedSeason(e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-slate-300 rounded px-2 py-1"
                        >
                          <option value="ALL">All Seasons (2015–24)</option>
                          <option value="2023-2024">2023–2024</option>
                          <option value="2022-2023">2022–2023</option>
                          <option value="2021-2022">2021–2022</option>
                          <option value="2020-2021">2020–2021</option>
                        </select>

                        <select
                          value={selectedTrigger}
                          onChange={(e) => setSelectedTrigger(e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-slate-300 rounded px-2 py-1"
                        >
                          <option value="ALL">All Triggers</option>
                          <option value="NATURAL">Natural</option>
                          <option value="HUMAN_TRIGGERED">Human-Triggered</option>
                          <option value="EXPLOSIVE">Explosive</option>
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Quick Peak Selection Badges (Indian Himalayas Only) */}
              {selectedDomain === 'INDIA' && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono no-scrollbar">
                  <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">Quick Peaks:</span>
                  {indianPeaks.slice(0, 8).map((peak) => {
                    const isSelected = selectedIndianPeak?.id === peak.id;
                    return (
                      <button
                        key={peak.id}
                        onClick={() => {
                          setSelectedIndianPeak(peak);
                        }}
                        className={`px-2 py-0.5 rounded-full border transition-all whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-400 font-bold shadow-md shadow-amber-900/50'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {peak.name} ({peak.elevation_m}m)
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Leaflet Map Box */}
              <div className="relative w-full h-[360px] sm:h-[420px] md:h-[460px] lg:h-[480px] xl:h-[clamp(480px,55vh,620px)] rounded-xl overflow-hidden min-w-0">
                <ColoradoMap
                  zones={zones}
                  stations={stations}
                  historicalEvents={historicalEvents}
                  selectedLocation={mapSelectedLocation}
                  onSelectLocation={handleSelectLocation}
                  onSelectStation={handleSelectStation}
                  showEvents={showHistoricalEvents}
                  activeRiskLevel={predictionContext.prediction?.final_risk_level}
                  isLiveMode={isLivePolling}
                  layerVisibility={layerVisibility}
                  riskSurface={activeRiskSurface}
                  selectedDomain={selectedDomain}
                  indianPeaks={filteredIndianPeaks}
                  selectedIndianPeak={selectedIndianPeak}
                  onSelectIndianPeak={(peak) => setSelectedIndianPeak(peak)}
                  freshness={freshness}
                  context={predictionContext}
                />
              </div>
            </div>

            {/* RIGHT (5 Cols): Selected Location Assessment / Indian Peak Details */}
            <div className="lg:col-span-5 flex flex-col space-y-3 min-w-0 w-full">
              {selectedDomain === 'INDIA' ? (
                <IndianPeakPanel peak={selectedIndianPeak} />
              ) : (
                <RiskAssessmentPanel
                  context={predictionContext}
                  onSync={handleSyncColoradoTelemetry}
                  isSyncing={isSyncingTelemetry}
                  onRefresh={() => {
                    if (predictionContext.target_type === 'STATION') {
                      loadStationAssessment(
                        predictionContext.target_id,
                        predictionContext.target_name,
                        predictionContext.latitude,
                        predictionContext.longitude,
                        predictionContext.elevation,
                        predictionContext.slope,
                        predictionContext.aspect
                      );
                    } else {
                      evaluateCustomPointRisk(
                        predictionContext.target_name,
                        predictionContext.latitude,
                        predictionContext.longitude,
                        predictionContext.elevation,
                        predictionContext.slope,
                        predictionContext.aspect,
                        predictionContext.target_type === 'ZONE' ? 'ZONE' : 'COORDINATE'
                      );
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Bottom Panels: Diagnostics (Colorado) or Himalayan Geographic Overview (India) */}
          {selectedDomain === 'INDIA' ? (
            <div className="space-y-4 min-w-0 w-full">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 font-sans text-slate-100 min-w-0">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mountain className="w-4 h-4 text-amber-400 shrink-0" />
                    <h3 className="text-xs font-bold font-mono uppercase text-slate-200 truncate">
                      INDIAN HIMALAYAN REGIONAL DIVISIONS (SURVEY OF INDIA)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800 px-2 py-0.5 rounded shrink-0">
                    5 Sectors • 19 Verified Peaks
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
                  {indianRegions.map((reg) => (
                    <div key={reg.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 min-w-0">
                      <div className="text-xs font-bold text-amber-300 truncate">{reg.name}</div>
                      <div className="text-[11px] text-slate-400">State: <strong className="text-slate-200">{reg.state}</strong></div>
                      <div className="text-[10px] font-mono text-slate-400">Center: {reg.center_latitude}°N, {reg.center_longitude}°E</div>
                      <div className="text-[10px] font-mono text-cyan-400">Cataloged Peaks: {reg.peak_count}</div>
                    </div>
                  ))}

                  <div className="bg-amber-950/20 border border-amber-900/60 p-3 rounded-lg space-y-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Model Boundary Constraint</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Colorado avalanche ML weights are strictly decoupled from Indian Himalayan coordinates. Autonomous prediction is blocked.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Bottom Diagnostics Grid: Terrain + Snowpack + Weather (Connected to Single PredictionContext) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0 w-full">
                <div className="min-w-0 w-full">
                  <TerrainPanel context={predictionContext} />
                </div>
                <div className="min-w-0 w-full">
                  <SnowpackPanel context={predictionContext} />
                </div>
                <div className="min-w-0 w-full">
                  <WeatherPanel context={predictionContext} />
                </div>
              </div>

              {/* Bottom Telemetry Stream Simulator */}
              <div className="min-w-0 w-full">
                <TelemetrySimulationPanel
                  stations={stations}
                  onTelemetryPrediction={handleTelemetryPrediction}
                />
              </div>
            </>
          )}
        </main>
      )}

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-500 font-mono">
        SIH260105 Novel Technologies for Early Detection and Mitigation of Avalanches • Research Decision-Support Console
      </footer>
    </div>
  );
}

export default App;
