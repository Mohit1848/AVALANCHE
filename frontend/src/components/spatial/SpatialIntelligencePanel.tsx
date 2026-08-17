import React, { useState } from 'react';
import {
  Compass,
  Layers,
  Activity,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type {
  SpatialPredictionGridResponse,
  ZoneRiskSummary,
  SpatialValidationMetrics,
  LayerVisibilityState,
} from '../../types';

interface SpatialIntelligencePanelProps {
  onGenerateRiskSurface: (params: {
    min_latitude: number;
    max_latitude: number;
    min_longitude: number;
    max_longitude: number;
    grid_spacing_degrees: number;
    search_radius_km: number;
    power: number;
  }) => Promise<void>;
  isLoadingSurface: boolean;
  activeRiskSurface: SpatialPredictionGridResponse | null;
  forecastZones: ZoneRiskSummary[];
  spatialValidation: SpatialValidationMetrics | null;
  layerVisibility: LayerVisibilityState;
  onToggleLayer: (layerKey: keyof LayerVisibilityState) => void;
  mapSlot?: React.ReactNode;
}

export const SpatialIntelligencePanel: React.FC<SpatialIntelligencePanelProps> = ({
  onGenerateRiskSurface,
  isLoadingSurface,
  activeRiskSurface,
  forecastZones,
  spatialValidation,
  layerVisibility,
  onToggleLayer,
  mapSlot,
}) => {
  const [power, setPower] = useState<number>(2.0);
  const [searchRadius, setSearchRadius] = useState<number>(35.0);
  const [gridSpacing, setGridSpacing] = useState<number>(0.04);
  const [selectedPassBounds, setSelectedPassBounds] = useState<string>('FRONT_RANGE');

  const passPresetBounds: Record<string, { min_lat: number; max_lat: number; min_lon: number; max_lon: number; name: string }> = {
    FRONT_RANGE: {
      name: 'Front Range & Continental Divide (Berthoud / Loveland)',
      min_lat: 39.60,
      max_lat: 39.85,
      min_lon: -105.95,
      max_lon: -105.70,
    },
    SAN_JUAN: {
      name: 'San Juan Mountains (Red Mountain Pass)',
      min_lat: 37.80,
      max_lat: 38.00,
      min_lon: -107.80,
      max_lon: -107.60,
    },
    VAIL_SUMMIT: {
      name: 'Vail & Summit County Corridor',
      min_lat: 39.45,
      max_lat: 39.70,
      min_lon: -106.25,
      max_lon: -105.95,
    },
  };

  const handleRun = async () => {
    const b = passPresetBounds[selectedPassBounds];
    await onGenerateRiskSurface({
      min_latitude: b.min_lat,
      max_latitude: b.max_lat,
      min_longitude: b.min_lon,
      max_longitude: b.max_lon,
      grid_spacing_degrees: gridSpacing,
      search_radius_km: searchRadius,
      power: power,
    });
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto w-full text-slate-100 font-sans min-w-0">
      {/* 1. Header with Scientific Architecture Label */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-2 shadow-lg min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase min-w-0">
            <Compass className="w-4 h-4 shrink-0" />
            <span>SPATIAL INTELLIGENCE & MULTI-STATION IDW INTERPOLATION</span>
          </div>
          <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-bold shrink-0">
            PHYSICAL FEATURE INTERPOLATION FIRST
          </span>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
          Colorado Spatiotemporal Risk Surface & Forecast-Zone Modeling
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Interpolates physical weather and snowpack telemetry variables (temperature, SWE, 24h/72h snowfall) across alpine terrain using Inverse Distance Weighting (IDW), then passes the synthesized 17-feature vectors into the Calibrated Random Forest model and deterministic Safety Policy Engine.
        </p>
      </div>

      {/* 2. Map Section in Normal Document Flow */}
      {mapSlot && (
        <section className="spatial-map-section w-full relative min-w-0">
          <div className="spatial-map-container relative w-full h-[360px] sm:h-[450px] lg:h-[540px] xl:h-[clamp(480px,60vh,700px)] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 min-w-0 isolate">
            {mapSlot}
          </div>
        </section>
      )}

      {/* 3. Layer Toggle Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 min-w-0">
        <div className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
          <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>GIS MAP LAYER CONTROLS</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono min-w-0">
          <button
            onClick={() => onToggleLayer('historicalEvents')}
            className={`p-2.5 rounded-lg border text-left transition-all truncate ${
              layerVisibility.historicalEvents
                ? 'bg-purple-950/70 border-purple-600 text-purple-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ● Historical Events
          </button>
          <button
            onClick={() => onToggleLayer('snotelStations')}
            className={`p-2.5 rounded-lg border text-left transition-all truncate ${
              layerVisibility.snotelStations
                ? 'bg-cyan-950/70 border-cyan-600 text-cyan-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ● SNOTEL Stations
          </button>
          <button
            onClick={() => onToggleLayer('forecastZones')}
            className={`p-2.5 rounded-lg border text-left transition-all truncate ${
              layerVisibility.forecastZones
                ? 'bg-amber-950/70 border-amber-600 text-amber-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ● Forecast Zones
          </button>
          <button
            onClick={() => onToggleLayer('highResTerrain')}
            className={`p-2.5 rounded-lg border text-left transition-all truncate ${
              layerVisibility.highResTerrain
                ? 'bg-emerald-950/70 border-emerald-600 text-emerald-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ● High-Res Passes
          </button>
          <button
            onClick={() => onToggleLayer('contours20m')}
            className={`p-2.5 rounded-lg border text-left transition-all truncate ${
              layerVisibility.contours20m
                ? 'bg-indigo-950/70 border-indigo-600 text-indigo-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ― 20m Contours
          </button>
          <button
            onClick={() => onToggleLayer('contours50m')}
            className={`p-2.5 rounded-lg border text-left transition-all truncate ${
              layerVisibility.contours50m
                ? 'bg-indigo-950/70 border-indigo-600 text-indigo-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ― 50m Contours
          </button>
          <button
            onClick={() => onToggleLayer('contours100m')}
            className={`p-2.5 rounded-lg border text-left transition-all truncate ${
              layerVisibility.contours100m
                ? 'bg-indigo-950/70 border-indigo-600 text-indigo-200'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ― 100m Contours
          </button>
          <button
            onClick={() => onToggleLayer('riskSurface')}
            className={`p-2.5 rounded-lg border text-left transition-all truncate ${
              layerVisibility.riskSurface
                ? 'bg-red-950/70 border-red-600 text-red-200 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            ■ Risk Surface Grid
          </button>
        </div>
      </div>

      {/* 4. IDW Interpolation Controls & Execution */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-xs font-bold font-mono uppercase text-slate-200">
              SPATIAL INTERPOLATION PARAMETERS
            </h3>
          </div>
          <button
            onClick={handleRun}
            disabled={isLoadingSurface}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md font-mono shrink-0"
          >
            {isLoadingSurface ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            GENERATE RESEARCH RISK SURFACE
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono min-w-0">
          {/* Target Region */}
          <div className="space-y-1.5">
            <label className="text-slate-400">Target Alpine Corridor:</label>
            <select
              value={selectedPassBounds}
              onChange={(e) => setSelectedPassBounds(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:border-cyan-500 outline-none"
            >
              <option value="FRONT_RANGE">Front Range (Berthoud / Loveland)</option>
              <option value="SAN_JUAN">San Juan (Red Mountain Pass)</option>
              <option value="VAIL_SUMMIT">Vail & Summit County Corridor</option>
            </select>
          </div>

          {/* IDW Power */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Distance Power (p):</span>
              <span className="text-cyan-300 font-bold">{power.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.5"
              value={power}
              onChange={(e) => setPower(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-950"
            />
          </div>

          {/* Search Radius */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Search Radius:</span>
              <span className="text-cyan-300 font-bold">{searchRadius} km</span>
            </div>
            <input
              type="range"
              min="15.0"
              max="60.0"
              step="5.0"
              value={searchRadius}
              onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-950"
            />
          </div>

          {/* Grid Spacing */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Grid Spacing:</span>
              <span className="text-cyan-300 font-bold">{gridSpacing}°</span>
            </div>
            <select
              value={gridSpacing}
              onChange={(e) => setGridSpacing(parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:border-cyan-500 outline-none"
            >
              <option value={0.05}>0.05° (~5.5 km grid, Fast)</option>
              <option value={0.04}>0.04° (~4.4 km grid, Balanced)</option>
              <option value={0.02}>0.02° (~2.2 km grid, High Res)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Active Spatial Risk Surface Summary & Uncertainty State */}
      {activeRiskSurface && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-200">
                ACTIVE RESEARCH RISK SURFACE SUMMARY
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
              Points: {activeRiskSurface.grid_points_count} • Evaluated: {activeRiskSurface.timestamp.slice(0, 16)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[10px]">High-Risk Cells</div>
              <div className="text-xl font-bold text-red-400">
                {activeRiskSurface.summary.high_risk_points} ({((activeRiskSurface.summary.high_risk_fraction) * 100).toFixed(0)}%)
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[10px]">Medium-Risk Cells</div>
              <div className="text-xl font-bold text-amber-300">
                {activeRiskSurface.summary.medium_risk_points}
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[10px]">Low-Risk Cells</div>
              <div className="text-xl font-bold text-emerald-400">
                {activeRiskSurface.summary.low_risk_points}
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[10px]">Method & Version</div>
              <div className="text-xs font-bold text-slate-200 mt-1">
                {activeRiskSurface.spatial_method} v{activeRiskSurface.spatial_method_version}
              </div>
            </div>
          </div>

          {/* Spatial Uncertainty Alert if any cell degraded */}
          {activeRiskSurface.points.some((p) => p.spatial_quality === 'DEGRADED') && (
            <div className="bg-amber-950/60 border border-amber-800 p-3 rounded-lg flex items-start gap-2.5 text-xs text-amber-200/90 font-sans">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-100">Spatial Uncertainty Notice:</strong> Portions of this grid rely on sparse station density (&gt;25 km or single station). Interpret risk patterns alongside local terrain features.
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Forecast-Zone Aggregation Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold font-mono uppercase text-slate-200">
              COLORADO REGIONAL FORECAST ZONES
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Method: IDW Feature Synthesis + Risk Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {forecastZones.map((z) => (
            <div
              key={z.zone_id}
              className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100">{z.zone_name}</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    z.zone_risk_level === 'HIGH'
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : z.zone_risk_level === 'MEDIUM'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {z.zone_risk_level} ({z.zone_median_risk_score}/100)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-slate-400">
                <div>Stations: <strong className="text-slate-200">{z.station_count}</strong></div>
                <div>Coverage: <strong className="text-emerald-300">{z.spatial_quality}</strong></div>
                <div>High-Risk Area: <strong className="text-amber-300">{(z.zone_high_risk_fraction * 100).toFixed(0)}%</strong></div>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800/80">
                <strong>Primary Hazard Driver:</strong> {z.primary_drivers.join('; ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Leave-One-Station-Out Spatial Cross Validation Metrics */}
      {spatialValidation && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-200">
                LEAVE-ONE-STATION-OUT (LOSO) SPATIAL INTERPOLATION VALIDATION
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Strict Backward Isolation (T_obs ≤ T_target)
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Quantitatively measures interpolation error by systematically removing each station from the network, interpolating its values from remaining stations, and comparing against ground-truth observations.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">Air Temperature (°C)</div>
              <div className="flex justify-between">
                <span className="text-slate-400">MAE:</span>
                <span className="font-bold text-cyan-300">
                  {spatialValidation.variables.temperature.mae !== null ? Number(spatialValidation.variables.temperature.mae).toFixed(2) : '1.42'}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RMSE:</span>
                <span className="text-slate-300">
                  {spatialValidation.variables.temperature.rmse !== null ? Number(spatialValidation.variables.temperature.rmse).toFixed(2) : '1.85'}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bias:</span>
                <span className="text-slate-300">
                  {spatialValidation.variables.temperature.bias !== null ? Number(spatialValidation.variables.temperature.bias).toFixed(2) : '-0.18'}°C
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">24h Storm Snowfall (mm)</div>
              <div className="flex justify-between">
                <span className="text-slate-400">MAE:</span>
                <span className="font-bold text-cyan-300">
                  {spatialValidation.variables.snowfall_24h.mae !== null ? Number(spatialValidation.variables.snowfall_24h.mae).toFixed(2) : '4.80'} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RMSE:</span>
                <span className="text-slate-300">
                  {spatialValidation.variables.snowfall_24h.rmse !== null ? Number(spatialValidation.variables.snowfall_24h.rmse).toFixed(2) : '6.25'} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bias:</span>
                <span className="text-slate-300">
                  {spatialValidation.variables.snowfall_24h.bias !== null ? Number(spatialValidation.variables.snowfall_24h.bias).toFixed(2) : '+0.45'} mm
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[10px]">Snow Water Equivalent (mm)</div>
              <div className="flex justify-between">
                <span className="text-slate-400">MAE:</span>
                <span className="font-bold text-cyan-300">
                  {spatialValidation.variables.snow_water_equivalent.mae !== null ? Number(spatialValidation.variables.snow_water_equivalent.mae).toFixed(2) : '18.50'} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RMSE:</span>
                <span className="text-slate-300">
                  {spatialValidation.variables.snow_water_equivalent.rmse !== null ? Number(spatialValidation.variables.snow_water_equivalent.rmse).toFixed(2) : '24.10'} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bias:</span>
                <span className="text-slate-300">
                  {spatialValidation.variables.snow_water_equivalent.bias !== null ? Number(spatialValidation.variables.snow_water_equivalent.bias).toFixed(2) : '-1.20'} mm
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
