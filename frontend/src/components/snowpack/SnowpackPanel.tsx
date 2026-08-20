import React from 'react';
import { Snowflake, Clock } from 'lucide-react';
import type { PredictionContext } from '../../types';
import { formatTelemetryAge } from '../../utils/formatters';

interface SnowpackPanelProps {
  context: PredictionContext;
}

export const SnowpackPanel: React.FC<SnowpackPanelProps> = ({ context }) => {
  const isStale =
    context.freshness_state === 'STALE' ||
    (context.telemetry_age_minutes !== null && context.telemetry_age_minutes > 360) ||
    context.data_quality === 'STALE';

  const sf24 = context.snowfall_24h;
  const sf72 = context.snowfall_72h;
  const isHeavy24h = sf24 !== null && sf24 >= 25.0;
  const isHeavy72h = sf72 !== null && sf72 >= 40.0;
  const formattedAge = formatTelemetryAge(context.telemetry_age_minutes);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 font-sans text-slate-100 min-w-0">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Snowflake className="w-4 h-4 text-cyan-400 shrink-0" />
          <h3 className="text-xs font-bold font-mono uppercase text-slate-200 truncate">
            SNOWPACK STRUCTURE & ROLLING LOAD DELTAS
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
        {/* Total Depth */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">Total Snow Depth</div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            {context.snow_depth !== null ? `${context.snow_depth.toFixed(0)} cm` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {context.snow_depth !== null ? `${(context.snow_depth / 2.54).toFixed(1)} in` : '—'}
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-slate-900 text-slate-500">
            <span>{isStale ? 'HISTORICAL VALUE' : 'CURRENT VALUE'}</span>
            {isStale && <span className="uppercase text-slate-600">NOT CURRENT</span>}
          </div>
        </div>

        {/* SWE */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">Snow Water Equiv (SWE)</div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            {context.snow_water_equivalent !== null ? `${context.snow_water_equivalent.toFixed(0)} mm` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">Total Overburden Mass</div>
          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-slate-900 text-slate-500">
            <span>{isStale ? 'HISTORICAL VALUE' : 'CURRENT VALUE'}</span>
            {isStale && <span className="uppercase text-slate-600">NOT CURRENT</span>}
          </div>
        </div>

        {/* Snowfall 24h */}
        <div className={`p-2.5 rounded-lg border space-y-1 min-w-0 ${
          isHeavy24h ? 'bg-amber-950/30 border-amber-800/80' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
            <span className="truncate">Past 24h Snowfall</span>
            {isHeavy24h && <span className="text-amber-400 text-[10px] shrink-0 font-medium">★ Heavy</span>}
          </div>
          <div className={`text-base font-bold font-mono truncate ${isHeavy24h ? 'text-amber-300' : 'text-slate-100'}`}>
            {sf24 !== null ? `${sf24.toFixed(1)} mm SWE` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            6h: {context.snowfall_6h !== null ? `${context.snowfall_6h.toFixed(1)} mm` : 'N/A'}
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono pt-1 border-t border-slate-900 text-slate-500">
            <span>{isStale ? 'HISTORICAL VALUE' : 'CURRENT VALUE'}</span>
            {isStale && <span className="uppercase text-slate-600">NOT CURRENT</span>}
          </div>
        </div>

        {/* Snowfall 72h Storm Cycle */}
        <div className={`p-2.5 rounded-lg border space-y-1 min-w-0 ${
          isHeavy72h ? 'bg-amber-950/30 border-amber-800/80' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
            <span className="truncate">Past 72h Storm Snow</span>
            {isHeavy72h && <span className="text-amber-400 text-[10px] shrink-0 font-medium">★ Storm</span>}
          </div>
          <div className={`text-base font-bold font-mono truncate ${isHeavy72h ? 'text-amber-300' : 'text-slate-100'}`}>
            {sf72 !== null ? `${sf72.toFixed(1)} mm SWE` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {context.temperature_delta_24h !== null
              ? `${context.temperature_delta_24h >= 0 ? `+${context.temperature_delta_24h.toFixed(1)}` : context.temperature_delta_24h.toFixed(1)}°C (24h Temp Δ)`
              : 'N/A (Temp Δ)'}
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
