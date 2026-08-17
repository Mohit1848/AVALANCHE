import React from 'react';
import { Mountain, ShieldAlert, Database, Info, Layers, CheckCircle2 } from 'lucide-react';
import type { IndianPeak } from '../../types';


interface IndianPeakPanelProps {
  peak: IndianPeak | null;
}

export const IndianPeakPanel: React.FC<IndianPeakPanelProps> = ({ peak }) => {
  if (!peak) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center space-y-3 text-slate-400 font-sans min-w-0">
        <Mountain className="w-8 h-8 text-amber-400 mx-auto" />
        <h3 className="text-sm font-bold text-slate-200">No Indian Peak Selected</h3>
        <p className="text-xs">
          Select an Indian Himalayan peak from the GIS map or use the search bar above to view geographic details and terrain metadata.
        </p>
      </div>
    );
  }

  const elevationFeet = (peak.elevation_m * 3.28084).toFixed(0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-4.5 space-y-3.5 shadow-xl text-slate-100 font-sans min-w-0">
      {/* 1. Header & Peak Identity */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono tracking-wider text-amber-400 font-semibold uppercase block truncate">
              INDIAN HIMALAYAN PEAK EVALUATION
            </span>
            <span className="text-[9px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded shrink-0">
              {peak.id}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white leading-tight break-words flex items-center gap-2">
            <span>{peak.name}</span>
            {peak.verified && (
              <span title="Verified Geographic Record">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              </span>
            )}
          </h2>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-bold">
            {peak.type.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* 2. Topographic & Geographic Identity Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 min-w-0">
        {/* Elevation */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 min-w-0 space-y-0.5">
          <span className="text-[10px] text-slate-400 font-semibold block truncate">SUMMIT ELEVATION</span>
          <div className="text-base sm:text-lg font-bold font-mono text-amber-300 truncate">
            {peak.elevation_m.toLocaleString()} m
          </div>
          <span className="text-[10px] text-slate-500 font-mono block truncate">
            {elevationFeet} ft above MSL
          </span>
        </div>

        {/* State / Region */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 min-w-0 space-y-0.5">
          <span className="text-[10px] text-slate-400 font-semibold block truncate">STATE & REGION</span>
          <div className="text-sm font-bold text-slate-100 truncate">{peak.state}</div>
          <span className="text-[10px] text-slate-400 block truncate">{peak.region}</span>
        </div>

        {/* Mountain Range */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 min-w-0 space-y-0.5">
          <span className="text-[10px] text-slate-400 font-semibold block truncate">MOUNTAIN RANGE</span>
          <div className="text-xs font-semibold text-slate-200 truncate">{peak.mountain_range}</div>
          <span className="text-[9px] text-slate-500 block truncate">{peak.country}</span>
        </div>

        {/* Coordinates */}
        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 min-w-0 space-y-0.5">
          <span className="text-[10px] text-slate-400 font-semibold block truncate">COORDINATES (WGS84)</span>
          <div className="text-xs font-mono font-bold text-cyan-300 truncate">
            {peak.latitude.toFixed(3)}°N, {peak.longitude.toFixed(3)}°E
          </div>
          <span className="text-[9px] text-slate-500 font-mono block truncate">EPSG:4326 Datum</span>
        </div>
      </div>

      {/* 3. Terrain Availability Status */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5 min-w-0">
        <div className="flex items-center justify-between gap-1 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Digital Elevation Model (DEM):</span>
          </span>
          <span className="font-mono text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded font-bold shrink-0">
            Terrain: NOT AVAILABLE
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          High-resolution Survey of India and localized Copernicus GLO-30 DEM slope/aspect contours for this sector are pending ingestion. Synthetic or fabricated slope angles are strictly prohibited.
        </p>
      </div>

      {/* 4. Model Safety Guard: Avalanche Model Status */}
      <div className="bg-amber-950/30 border border-amber-800/80 rounded-lg p-3 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2 border-b border-amber-800/40 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold font-mono uppercase text-amber-200 truncate">
              AVALANCHE MODEL STATUS
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold bg-amber-900/60 border border-amber-700 text-amber-300 px-2 py-0.5 rounded shrink-0">
            {peak.risk_capability}
          </span>
        </div>

        <div className="space-y-1 text-xs text-amber-200/90 leading-relaxed">
          <div className="font-semibold text-white flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>INDIAN GEOGRAPHIC MODE — Risk Prediction: NOT ENABLED</span>
          </div>
          <p className="text-[11px] text-slate-300">
            <strong>Reason:</strong> The current statistical avalanche model was trained and evaluated on Colorado Rocky Mountain telemetry and is not scientifically validated for Indian Himalayan snowpack conditions.
          </p>
        </div>
      </div>

      {/* 5. Data Provenance & Authoritative Sources */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1.5 min-w-0 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
          <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>DATA PROVENANCE & ATTRIBUTION</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] font-mono text-slate-400">
          <div>Geographic Source: <span className="text-slate-200">{peak.data_source}</span></div>
          <div>Terrain Source: <span className="text-slate-200">{peak.terrain_source}</span></div>
          <div>Catalog ID: <span className="text-slate-200">{peak.id}</span></div>
          <div>Verification: <span className="text-emerald-400">AUTHORITATIVE_VERIFIED</span></div>
        </div>
      </div>

      {/* 6. Scientific Research Note */}
      <div className="border-t border-slate-800 pt-2 text-[10px] text-slate-400 space-y-1">
        <div className="font-mono text-slate-300">
          Future Roadmap: DGRE / SASE Telemetry &rarr; Indian Snowpack Calibration &rarr; Local Risk Engine.
        </div>
      </div>
    </div>
  );
};
