import React from 'react';
import { Snowflake } from 'lucide-react';
import type { SelectedLocationState } from '../../types';

interface SnowpackPanelProps {
  location: SelectedLocationState;
}

export const SnowpackPanel: React.FC<SnowpackPanelProps> = ({ location }) => {
  const isHeavy24h = location.snowfall_24h >= 25.0;
  const isHeavy72h = location.snowfall_72h >= 40.0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 font-sans text-slate-100 min-w-0">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Snowflake className="w-4 h-4 text-cyan-400 shrink-0" />
          <h3 className="text-xs font-bold font-mono uppercase text-slate-200 truncate">
            SNOWPACK STRUCTURE & ROLLING LOAD DELTAS
          </h3>
        </div>
        <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400 shrink-0">
          Telemetry: SNOTEL AWDB
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0">
        {/* Total Depth */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">Total Snow Depth</div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            {location.snow_depth ? `${location.snow_depth.toFixed(0)} cm` : 'Unavailable'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {location.snow_depth ? `${(location.snow_depth / 2.54).toFixed(1)} in` : '—'}
          </div>
        </div>

        {/* SWE */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">Snow Water Equiv (SWE)</div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            {location.snow_water_equivalent ? `${location.snow_water_equivalent.toFixed(0)} mm` : 'Unavailable'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">Total Overburden Mass</div>
        </div>

        {/* Snowfall 24h */}
        <div className={`p-2.5 rounded-lg border space-y-1 min-w-0 ${
          isHeavy24h ? 'bg-amber-950/40 border-amber-800' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
            <span className="truncate">Past 24h Snowfall</span>
            {isHeavy24h && <span className="text-amber-400 text-[10px] shrink-0">★ Heavy</span>}
          </div>
          <div className={`text-base font-bold font-mono truncate ${isHeavy24h ? 'text-amber-300' : 'text-slate-100'}`}>
            {location.snowfall_24h.toFixed(1)} mm SWE
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">6h: {location.snowfall_6h.toFixed(1)} mm</div>
        </div>

        {/* Snowfall 72h Storm Cycle */}
        <div className={`p-2.5 rounded-lg border space-y-1 min-w-0 ${
          isHeavy72h ? 'bg-amber-950/40 border-amber-800' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
            <span className="truncate">Past 72h Storm Snow</span>
            {isHeavy72h && <span className="text-amber-400 text-[10px] shrink-0">★ Storm</span>}
          </div>
          <div className={`text-base font-bold font-mono truncate ${isHeavy72h ? 'text-amber-300' : 'text-slate-100'}`}>
            {location.snowfall_72h.toFixed(1)} mm SWE
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {location.temperature_delta_24h >= 0 ? `+${location.temperature_delta_24h.toFixed(1)}°C` : `${location.temperature_delta_24h.toFixed(1)}°C`} (24h Temp Δ)
          </div>
        </div>
      </div>
    </div>
  );
};
