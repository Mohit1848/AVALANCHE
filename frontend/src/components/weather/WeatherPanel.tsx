import React from 'react';
import { Wind, Clock } from 'lucide-react';
import type { PredictionContext } from '../../types';
import { formatTelemetryAge } from '../../utils/formatters';

interface WeatherPanelProps {
  context: PredictionContext;
}

export const WeatherPanel: React.FC<WeatherPanelProps> = ({ context }) => {
  const isStale =
    context.freshness_state === 'STALE' ||
    (context.telemetry_age_minutes !== null && context.telemetry_age_minutes > 360) ||
    context.data_quality === 'STALE';

  const temp = context.temperature;
  const windMax = context.wind_speed_max_24h;
  const windMean = context.wind_speed_mean_24h;
  const isHighWind = windMax !== null && windMax >= 40.0;
  const isFreezingWarm = temp !== null && temp >= 0.0;
  const formattedAge = formatTelemetryAge(context.telemetry_age_minutes);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 font-sans text-slate-100 min-w-0">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
          <h3 className="text-xs font-bold font-mono uppercase text-slate-200 truncate">
            METEOROLOGICAL & ATMOSPHERIC CONDITIONS
          </h3>
        </div>
        <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 shrink-0 border border-slate-700">
          {context.telemetry_source} · {isStale ? 'HISTORICAL / STALE' : 'CURRENT TELEMETRY'}
        </span>
      </div>

      {/* Observation Metadata Banner */}
      {isStale ? (
        <div className="flex flex-wrap items-center justify-between text-[10px] font-mono bg-slate-950/80 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-400 gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Observation: <strong className="text-slate-200">{context.telemetry_timestamp || context.last_observation_timestamp || 'UNAVAILABLE'}</strong></span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span>Age: <strong className="text-slate-200">{formattedAge}</strong></span>
            <span className="text-red-400 font-bold bg-red-950/90 px-1.5 py-0.2 rounded border border-red-800">
              STALE / NOT CURRENT
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between text-[10px] font-mono bg-slate-950/50 border border-slate-800/80 px-2.5 py-1 rounded text-slate-400 gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Observation: <strong className="text-slate-200">{context.telemetry_timestamp || context.last_observation_timestamp || 'CURRENT'}</strong></span>
          </div>
          <span className="text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800 shrink-0">
            LIVE TELEMETRY
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0">
        {/* Temperature */}
        <div className={`p-2.5 rounded-lg border space-y-1 min-w-0 ${
          isFreezingWarm ? 'bg-amber-950/30 border-amber-800/80' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
            <span className="truncate">Air Temperature</span>
            {isFreezingWarm && <span className="text-amber-400 text-[10px] shrink-0 font-medium">Warm</span>}
          </div>
          <div className={`text-base font-bold font-mono truncate ${isFreezingWarm ? 'text-amber-300' : 'text-slate-100'}`}>
            {temp !== null ? `${temp >= 0 ? `+${temp.toFixed(1)}` : temp.toFixed(1)}°C` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {temp !== null ? `${((temp * 9) / 5 + 32).toFixed(1)}°F` : '—'}
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-slate-900 text-slate-500">
            <span>{isStale ? 'HISTORICAL VALUE' : 'CURRENT VALUE'}</span>
            {isStale && <span className="uppercase text-slate-600">NOT CURRENT</span>}
          </div>
        </div>

        {/* 24h Average Wind */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">24h Mean Wind</div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            {windMean !== null ? `${windMean.toFixed(1)} km/h` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {windMean !== null ? `${(windMean * 0.621371).toFixed(1)} mph` : '—'}
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-slate-900 text-slate-500">
            <span>{isStale ? 'HISTORICAL VALUE' : 'CURRENT VALUE'}</span>
            {isStale && <span className="uppercase text-slate-600">NOT CURRENT</span>}
          </div>
        </div>

        {/* Peak Wind Gust */}
        <div className={`p-2.5 rounded-lg border space-y-1 min-w-0 ${
          isHighWind ? 'bg-amber-950/30 border-amber-800/80' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
            <span className="truncate">Peak 24h Wind Gust</span>
            {isHighWind && <span className="text-amber-400 text-[10px] shrink-0 font-medium">Slab Loading</span>}
          </div>
          <div className={`text-base font-bold font-mono truncate ${isHighWind ? 'text-amber-300' : 'text-slate-100'}`}>
            {windMax !== null ? `${windMax.toFixed(1)} km/h` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">Leeward Drift Formation</div>
          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-slate-900 text-slate-500">
            <span>{isStale ? 'HISTORICAL VALUE' : 'CURRENT VALUE'}</span>
            {isStale && <span className="uppercase text-slate-600">NOT CURRENT</span>}
          </div>
        </div>

        {/* Barometric Pressure & Humidity */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">Atmospheric Setting</div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            {context.pressure !== null ? `${context.pressure.toFixed(1)} hPa` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            Humidity: {context.humidity !== null ? `${context.humidity.toFixed(0)}%` : 'N/A'}
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-slate-900 text-slate-500">
            <span>{isStale ? 'HISTORICAL VALUE' : 'CURRENT VALUE'}</span>
            {isStale && <span className="uppercase text-slate-600">NOT CURRENT</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
