import React, { useState } from 'react';
import { Activity, Mountain, Snowflake, Wind, ChevronDown, ChevronUp } from 'lucide-react';
import type { PredictionContext, SpatialPredictionGridResponse } from '../../types';
import { formatTelemetryAge } from '../../utils/formatters';
import { StatusPill } from '../ui/Primitives';
import { SpatialIntelligenceCard } from '../spatial/SpatialIntelligenceCard';

interface TelemetryMatrixPanelProps {
  context: PredictionContext;
  riskSurface?: SpatialPredictionGridResponse | null;
}

const getAspectDirection = (deg: number | null | undefined) => {
  if (deg === null || deg === undefined || isNaN(deg)) return 'N/A';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(deg / 45) % 8];
};

const fmt = (v: number | null | undefined, unit: string, digits = 0) =>
  v !== null && v !== undefined ? `${v.toFixed(digits)} ${unit}` : '—';

export const TelemetryMatrixPanel: React.FC<TelemetryMatrixPanelProps> = ({
  context,
  riskSurface,
}) => {
  const [showTelemetryDetails, setShowTelemetryDetails] = useState(true);

  const isStale =
    (context.freshness_state as string) === 'STALE' ||
    (context.freshness_state as string) === 'HISTORICAL' ||
    (context.data_quality as string) === 'STALE';

  const isDegraded = !isStale && (context.freshness_state as string) === 'DEGRADED';
  const formattedAge = formatTelemetryAge(context.telemetry_age_minutes);
  const quality = isStale ? 'STALE' : (context.data_quality || 'GOOD');
  const qualityTone = isStale ? 'critical' : isDegraded ? 'warn' : 'live';

  const MISSING = 'MISSING / SENSOR NOT MONITORED';
  const val = (v: number | null | undefined, formatFn: (n: number) => string) =>
    v === null || v === undefined ? MISSING : formatFn(v);

  const telemetryRows = [
    {
      label: 'Air Temperature (TOBS)',
      value: val(context.temperature, (n) => `${n.toFixed(1)} °C`),
      missing: context.temperature === null || context.temperature === undefined,
    },
    {
      label: 'Snow Depth (SNWD)',
      value: val(context.snow_depth, (n) => `${n.toFixed(0)} cm`),
      missing: context.snow_depth === null || context.snow_depth === undefined,
    },
    {
      label: 'Snow Water Equivalent (WTEQ)',
      value: val(context.snow_water_equivalent, (n) => `${n.toFixed(0)} mm`),
      missing: context.snow_water_equivalent === null || context.snow_water_equivalent === undefined,
    },
    {
      label: 'Precipitation (PREC)',
      value: val(context.precipitation, (n) => `${n.toFixed(1)} mm`),
      missing: context.precipitation === null || context.precipitation === undefined,
    },
    {
      label: 'Wind Speed (WSPDV)',
      value: val(context.wind_speed_mean_24h, (n) => `${n.toFixed(0)} km/h (24h mean)`),
      missing: context.wind_speed_mean_24h === null || context.wind_speed_mean_24h === undefined,
    },
  ];

  const varStatus = isStale ? 'STALE' : isDegraded ? 'AGED' : 'GOOD';
  const varTone = isStale ? 'critical' : isDegraded ? 'warn' : 'live';

  const slope = context.slope;
  const isProneSlope = slope !== null && slope !== undefined && slope >= 30.0 && slope <= 45.0;
  const aspectAngle = context.aspect;
  const gust = context.wind_speed_max_24h;
  const delta24 = context.temperature_delta_24h;

  return (
    <div className="space-y-3 min-w-0" data-testid="telemetry-matrix-panel">
      {/* ================= 1. LIVE TELEMETRY DETAILS TABLE ================= */}
      <div className="panel p-3.5 bg-slate-900/95 border border-slate-800 rounded-xl space-y-2.5">
        <button
          type="button"
          onClick={() => setShowTelemetryDetails((v) => !v)}
          className="tap w-full flex items-center justify-between gap-2 text-left"
          aria-expanded={showTelemetryDetails}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="t-section text-slate-200 truncate-safe">
              LIVE TELEMETRY DETAILS (USDA NRCS AWDB)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill tone={qualityTone as any} label={quality} glyph="●" />
            {showTelemetryDetails ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </button>

        {showTelemetryDetails && (
          <div className="motion-fade space-y-2">
            <div className="scroll-x">
              <table className="w-full text-xs font-mono border-collapse" data-testid="telemetry-table">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="py-1.5 text-left font-bold">VARIABLE</th>
                    <th className="py-1.5 text-right font-bold">VALUE</th>
                    <th className="py-1.5 text-right font-bold">AGE</th>
                    <th className="py-1.5 text-right font-bold">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {telemetryRows.map((r) => (
                    <tr key={r.label} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-1.5 text-slate-300 pr-2 whitespace-nowrap">{r.label}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-100 tabular-nums whitespace-nowrap">
                        {r.missing ? (
                          <span className="text-slate-500 italic text-[11px]">{r.value}</span>
                        ) : (
                          r.value
                        )}
                      </td>
                      <td className="py-1.5 text-right text-slate-400 tabular-nums whitespace-nowrap">
                        {r.missing ? '—' : formattedAge}
                      </td>
                      <td className="py-1.5 text-right pl-2 whitespace-nowrap">
                        <StatusPill
                          tone={r.missing ? 'neutral' : (varTone as any)}
                          label={r.missing ? 'NO SENSOR' : varStatus}
                          glyph={r.missing ? '○' : '●'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
              <span>Source: {context.telemetry_source || (context.domain === 'HIMALAYA' || context.domain === 'INDIA' ? 'Custom CSV Dataset' : 'USDA NRCS AWDB')}</span>
              <span>Network: {context.domain === 'HIMALAYA' || context.domain === 'INDIA' ? 'CSV Telemetry' : 'SNTL'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ================= 2. COMPACT 3-CARD DIAGNOSTIC MATRIX ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
        {/* TERRAIN */}
        <div className="panel p-3 bg-slate-900/95 border border-slate-800 rounded-xl space-y-1.5 min-w-0" data-testid="terrain-panel">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 pb-1 border-b border-slate-800">
            <Mountain className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>TERRAIN</span>
          </div>

          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between" data-testid="terrain-slope">
              <span className="text-slate-400">Slope</span>
              <span className={`font-bold ${isProneSlope ? 'text-amber-400' : 'text-slate-200'}`}>
                {slope !== null && slope !== undefined ? `${slope.toFixed(1)}°` : 'N/A'}
              </span>
            </div>

            <div className="flex justify-between" data-testid="terrain-aspect">
              <span className="text-slate-400">Aspect</span>
              <span className="text-slate-200 font-semibold">
                {aspectAngle !== null && aspectAngle !== undefined
                  ? `${getAspectDirection(aspectAngle)} ${aspectAngle.toFixed(0)}°`
                  : 'N/A'}
              </span>
            </div>

            <div className="flex justify-between" data-testid="terrain-elevation">
              <span className="text-slate-400">Elevation</span>
              <span className="text-slate-200 font-semibold">
                {context.elevation !== null && context.elevation !== undefined
                  ? `${context.elevation.toLocaleString()} m`
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Prone Range Heuristic Tag */}
          <div className="pt-1 mt-1 border-t border-slate-800/80">
            <span className="text-[10px] font-mono font-bold text-amber-400 block truncate-safe">
              30°–45° Prone Range (Heuristic)
            </span>
            <div className="text-[9px] font-mono text-slate-500 mt-0.5 wrap-safe leading-tight">
              Wind-loading assessment requires localized wind-direction telemetry
            </div>
          </div>
        </div>

        {/* SNOWPACK */}
        <div className="panel p-3 bg-slate-900/95 border border-slate-800 rounded-xl space-y-1.5 min-w-0" data-testid="snowpack-panel">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 pb-1 border-b border-slate-800">
            <Snowflake className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>SNOWPACK</span>
          </div>

          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between" data-testid="snowpack-depth">
              <span className="text-slate-400">Snow Depth</span>
              <span className="text-slate-200 font-semibold">{fmt(context.snow_depth, 'cm')}</span>
            </div>

            <div className="flex justify-between" data-testid="snowpack-swe">
              <span className="text-slate-400">SWE</span>
              <span className="text-slate-200 font-semibold">{fmt(context.snow_water_equivalent, 'mm')}</span>
            </div>

            <div className="flex justify-between" data-testid="snowpack-24h">
              <span className="text-slate-400">Snow 24h</span>
              <span className="text-slate-200 font-semibold">{fmt(context.snowfall_24h, 'mm')}</span>
            </div>

            <div className="flex justify-between" data-testid="snowpack-72h">
              <span className="text-slate-400">Snow 72h</span>
              <span className="text-slate-200 font-semibold">{fmt(context.snowfall_72h, 'mm')}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Temp Δ24h</span>
              <span className="text-slate-200 font-semibold">
                {delta24 !== null && delta24 !== undefined
                  ? `${delta24 > 0 ? '+' : ''}${delta24.toFixed(1)} °C`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* WEATHER (24H) */}
        <div className="panel p-3 bg-slate-900/95 border border-slate-800 rounded-xl space-y-1.5 min-w-0" data-testid="weather-panel">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 pb-1 border-b border-slate-800">
            <Wind className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>WEATHER (24H)</span>
          </div>

          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between" data-testid="weather-temp">
              <span className="text-slate-400">Air Temp</span>
              <span className="text-slate-200 font-semibold">
                {context.temperature !== null && context.temperature !== undefined
                  ? `${context.temperature.toFixed(1)} °C`
                  : '—'}
              </span>
            </div>

            <div className="flex justify-between" data-testid="weather-wind">
              <span className="text-slate-400">Wind (mean)</span>
              <span className="text-slate-200 font-semibold">{fmt(context.wind_speed_mean_24h, 'km/h')}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Wind (gust)</span>
              <span className="text-slate-200 font-semibold">{fmt(gust, 'km/h')}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Pressure</span>
              <span className="text-slate-200 font-semibold">{fmt(context.pressure, 'hPa')}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">RH (mean)</span>
              <span className="text-slate-200 font-semibold">{fmt(context.humidity, '%')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 3. SPATIAL INTELLIGENCE CARD ================= */}
      <SpatialIntelligenceCard
        riskSurface={riskSurface}
        nearestStationDistanceKm={8.4}
        stationsCount={5}
        dataQuality="HIGH"
      />
    </div>
  );
};
