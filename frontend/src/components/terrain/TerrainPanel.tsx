import React from 'react';
import { Mountain } from 'lucide-react';
import type { SelectedLocationState } from '../../types';

interface TerrainPanelProps {
  location: SelectedLocationState;
}

export const TerrainPanel: React.FC<TerrainPanelProps> = ({ location }) => {
  const isProneSlope = location.slope >= 30.0 && location.slope <= 45.0;

  // Aspect compass needle angle
  const aspectAngle = location.aspect;
  const getAspectDirection = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    return directions[idx];
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 font-sans text-slate-100 min-w-0">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Mountain className="w-4 h-4 text-cyan-400 shrink-0" />
          <h3 className="text-xs font-bold font-mono uppercase text-slate-200 truncate">
            TERRAIN & DIGITAL ELEVATION MODEL (DEM)
          </h3>
        </div>
        <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400 shrink-0">
          Copernicus GLO-30 (30m)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        {/* 1. Slope Angle Meter with Scientific Nuance */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 min-w-0">
          <div className="flex justify-between items-center text-xs gap-1">
            <span className="text-slate-400 font-semibold truncate">Starting Zone Slope:</span>
            <span className={`font-mono font-bold text-sm shrink-0 ${isProneSlope ? 'text-amber-400' : 'text-slate-200'}`}>
              {location.slope.toFixed(1)}°
            </span>
          </div>

          {/* Visual slope range bar */}
          <div className="space-y-1 min-w-0">
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
              {/* Prone 30-45 deg zone highlight */}
              <div className="absolute left-[33%] w-[17%] h-full bg-amber-500/30"></div>
              <div
                className={`h-full transition-all duration-300 ${
                  isProneSlope ? 'bg-amber-400' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, (location.slope / 60) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>0°</span>
              <span className="text-amber-400 font-bold">30°–45° Prone Range (Heuristic)</span>
              <span>60°+</span>
            </div>
          </div>
          {isProneSlope && (
            <div className="text-[10px] text-amber-300 font-mono break-words leading-tight">
              <span>⚠️ Terrain heuristic: slope falls within common avalanche-prone slope-angle range</span>
            </div>
          )}
        </div>

        {/* 2. Aspect Compass Rose with Wind-Direction Caveat */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-2 min-w-0">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="text-xs text-slate-400 font-semibold truncate">Slope Aspect:</div>
            <div className="text-base font-bold text-slate-100 font-mono">
              {getAspectDirection(aspectAngle)} ({aspectAngle.toFixed(0)}°)
            </div>
            <div className="text-[10px] text-slate-400 leading-tight break-words">
              Wind-loading assessment requires localized wind-direction telemetry
            </div>
          </div>

          {/* Visual Compass SVG */}
          <div className="relative w-12 h-12 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center shrink-0">
            <div className="text-[8px] font-mono absolute top-0.5 text-slate-400">N</div>
            <div className="text-[8px] font-mono absolute bottom-0.5 text-slate-400">S</div>
            <div className="text-[8px] font-mono absolute left-0.5 text-slate-400">W</div>
            <div className="text-[8px] font-mono absolute right-0.5 text-slate-400">E</div>
            {/* Needle */}
            <div
              className="w-1 h-8 bg-gradient-to-t from-transparent via-cyan-400 to-red-500 rounded transition-transform duration-300"
              style={{ transform: `rotate(${aspectAngle}deg)` }}
            ></div>
          </div>
        </div>

        {/* 3. Elevation & Topographic Setting */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 min-w-0">
          <div className="text-xs text-slate-400 font-semibold truncate">Starting Elevation:</div>
          <div className="text-base sm:text-lg font-bold text-slate-100 font-mono break-words">
            {location.elevation.toLocaleString()} meters
            <span className="text-xs font-normal text-slate-400 ml-1">
              ({(location.elevation * 3.28084).toFixed(0)} ft)
            </span>
          </div>
          <div className="text-[10px] font-mono text-cyan-400 truncate">
            {location.elevation > 3500 ? 'Alpine Zone (Above Treeline)' : 'Near / Below Treeline'}
          </div>
        </div>
      </div>
    </div>
  );
};
