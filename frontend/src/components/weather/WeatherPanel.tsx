import React from 'react';
import { Wind } from 'lucide-react';
import type { SelectedLocationState } from '../../types';

interface WeatherPanelProps {
  location: SelectedLocationState;
}

export const WeatherPanel: React.FC<WeatherPanelProps> = ({ location }) => {
  const isHighWind = location.wind_speed_max_24h >= 40.0;
  const isFreezingWarm = location.temperature >= 0.0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 font-sans text-slate-100 min-w-0">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
          <h3 className="text-xs font-bold font-mono uppercase text-slate-200 truncate">
            METEOROLOGICAL & ATMOSPHERIC CONDITIONS
          </h3>
        </div>
        <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400 shrink-0">
          Alpine High-Resolution Telemetry
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0">
        {/* Temperature */}
        <div className={`p-2.5 rounded-lg border space-y-1 min-w-0 ${
          isFreezingWarm ? 'bg-amber-950/40 border-amber-800' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
            <span className="truncate">Air Temperature</span>
            {isFreezingWarm && <span className="text-amber-400 text-[10px] shrink-0">Warm</span>}
          </div>
          <div className={`text-base font-bold font-mono truncate ${isFreezingWarm ? 'text-amber-300' : 'text-slate-100'}`}>
            {location.temperature >= 0 ? `+${location.temperature.toFixed(1)}°C` : `${location.temperature.toFixed(1)}°C`}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {((location.temperature * 9) / 5 + 32).toFixed(1)}°F
          </div>
        </div>

        {/* 24h Average Wind */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">24h Mean Wind</div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            {location.wind_speed_mean_24h.toFixed(1)} km/h
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {(location.wind_speed_mean_24h * 0.621371).toFixed(1)} mph
          </div>
        </div>

        {/* Peak Wind Gust */}
        <div className={`p-2.5 rounded-lg border space-y-1 min-w-0 ${
          isHighWind ? 'bg-amber-950/40 border-amber-800' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
            <span className="truncate">Peak 24h Wind Gust</span>
            {isHighWind && <span className="text-amber-400 text-[10px] shrink-0">Slab Loading</span>}
          </div>
          <div className={`text-base font-bold font-mono truncate ${isHighWind ? 'text-amber-300' : 'text-slate-100'}`}>
            {location.wind_speed_max_24h.toFixed(1)} km/h
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">Leeward Drift Formation</div>
        </div>

        {/* Barometric Pressure & Humidity */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">Atmospheric Setting</div>
          <div className="text-base font-bold font-mono text-slate-100 truncate">
            670.0 hPa
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">Alpine Barometric Base</div>
        </div>
      </div>
    </div>
  );
};
