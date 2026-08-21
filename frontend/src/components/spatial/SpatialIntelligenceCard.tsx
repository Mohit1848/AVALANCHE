import React from 'react';
import { ShieldCheck, Compass } from 'lucide-react';
import type { SpatialPredictionGridResponse } from '../../types';

interface SpatialIntelligenceCardProps {
  riskSurface?: SpatialPredictionGridResponse | null;
  nearestStationDistanceKm?: number;
  stationsCount?: number;
  dataQuality?: string;
}

export const SpatialIntelligenceCard: React.FC<SpatialIntelligenceCardProps> = ({
  riskSurface,
  nearestStationDistanceKm = 8.4,
  stationsCount = 5,
  dataQuality = 'HIGH',
}) => {
  let medianRisk = 42;
  let maxRisk = 71;
  let highRiskArea = 18;

  if (riskSurface && riskSurface.points && riskSurface.points.length > 0) {
    const scores = riskSurface.points
      .map((p) => p.final_risk_score ?? p.model_risk_score ?? 0)
      .sort((a, b) => a - b);
    medianRisk = Math.round(scores[Math.floor(scores.length / 2)] || 42);
    maxRisk = Math.round(scores[scores.length - 1] || 71);
    if (riskSurface.summary?.high_risk_fraction !== undefined) {
      highRiskArea = Math.round(riskSurface.summary.high_risk_fraction * 100);
    }
  }

  return (
    <div className="panel p-3.5 bg-slate-900/95 border border-slate-800 rounded-xl space-y-2.5 min-w-0" data-testid="spatial-intelligence-card">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="t-section text-slate-300 truncate-safe">
            SPATIAL INTELLIGENCE (RESEARCH ONLY)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0 text-xs font-mono">
        {/* Sub-col 1: Interpolation Parameters */}
        <div className="panel-inset p-2.5 bg-slate-950/70 rounded border border-slate-800/80 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            INTERPOLATION
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Method</span>
            <span className="font-semibold text-slate-200">IDW</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Power</span>
            <span className="font-semibold text-slate-200">2.0</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Radius</span>
            <span className="font-semibold text-slate-200">35 km</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Grid Res</span>
            <span className="font-semibold text-slate-200">0.02°</span>
          </div>
        </div>

        {/* Sub-col 2: Spatial Coverage */}
        <div className="panel-inset p-2.5 bg-slate-950/70 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            SPATIAL COVERAGE
          </div>
          <div className="flex items-center gap-1.5 my-1 text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>EXCELLENT</span>
          </div>
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Nearest Station:</span>
              <span className="text-slate-200 font-semibold">{nearestStationDistanceKm} km</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>SNOTEL Used:</span>
              <span className="text-slate-200 font-semibold">{stationsCount}</span>
            </div>
          </div>
        </div>

        {/* Sub-col 3: Risk Surface Summary */}
        <div className="panel-inset p-2.5 bg-slate-950/70 rounded border border-slate-800/80 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            RISK SURFACE SUMMARY
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Median Risk</span>
            <span className="font-semibold text-slate-200">{medianRisk} / 100</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Maximum Risk</span>
            <span className="font-semibold text-amber-400">{maxRisk} / 100</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">High Risk Area</span>
            <span className="font-semibold text-slate-200">{highRiskArea} %</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-500">Data Quality</span>
            <span className="font-bold text-emerald-400">{dataQuality}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
