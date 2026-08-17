import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Cpu,
  Info,
  AlertOctagon,
} from 'lucide-react';
import type { RiskPredictionResponse, SelectedLocationState } from '../../types';

interface RiskAssessmentPanelProps {
  prediction: RiskPredictionResponse | null;
  selectedLocation: SelectedLocationState;
  isLoading: boolean;
  onRefresh: () => void;
}

export const RiskAssessmentPanel: React.FC<RiskAssessmentPanelProps> = ({
  prediction,
  selectedLocation,
  isLoading,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-4 animate-pulse">
        <div className="w-12 h-12 bg-slate-800 rounded-full mx-auto"></div>
        <div className="h-4 bg-slate-800 rounded w-3/4 mx-auto"></div>
        <div className="h-3 bg-slate-800 rounded w-1/2 mx-auto"></div>
        <div className="text-xs text-slate-400 font-mono">Running Inference & Safety Evaluation...</div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-400 space-y-3">
        <Info className="w-8 h-8 text-cyan-400 mx-auto" />
        <div className="font-semibold text-slate-200">No Assessment Query Active</div>
        <p className="text-xs">Click a map coordinate, select a forecast zone, or run a telemetry replay.</p>
        <button
          onClick={onRefresh}
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Evaluate Current Location
        </button>
      </div>
    );
  }

  const isStale = (selectedLocation.telemetry_age_minutes && selectedLocation.telemetry_age_minutes > 360) || prediction.data_quality === 'STALE';
  const finalLevel = isStale ? 'STALE' : (prediction.final_risk_level || prediction.risk_level);
  const modelLevel = prediction.model_risk_level || 'UNKNOWN';
  const isEscalated = prediction.risk_escalated && !isStale;
  const quality = prediction.data_quality;

  // Visual color theme for final level
  const getBadgeStyle = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'bg-red-950/80 border-red-700 text-red-300 shadow-red-950/50';
      case 'MEDIUM':
        return 'bg-amber-950/80 border-amber-700 text-amber-300 shadow-amber-950/50';
      case 'LOW':
        return 'bg-emerald-950/80 border-emerald-700 text-emerald-300 shadow-emerald-950/50';
      case 'STALE':
        return 'bg-red-950/90 border-red-500 text-red-200 shadow-red-950/80';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  const getQualityBadge = (q: string) => {
    switch (q) {
      case 'GOOD':
        return 'bg-emerald-950/60 border-emerald-700 text-emerald-300';
      case 'DEGRADED':
        return 'bg-amber-950/60 border-amber-700 text-amber-300';
      case 'STALE':
        return 'bg-red-950/60 border-red-700 text-red-300 font-bold';
      default:
        return 'bg-red-950/60 border-red-700 text-red-300';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-4.5 space-y-3.5 shadow-xl text-slate-100 font-sans min-w-0">
      {/* 1. Header & Location Title */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-mono tracking-wider text-cyan-400 font-semibold uppercase block truncate">
            TARGET LOCATION EVALUATION
          </span>
          <h2 className="text-base font-bold text-white leading-tight break-words">{selectedLocation.name}</h2>
          <div className="text-xs text-slate-400 font-mono truncate">
            {selectedLocation.latitude.toFixed(4)}°N, {Math.abs(selectedLocation.longitude).toFixed(4)}°W • Elev: {selectedLocation.elevation}m
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-mono shrink-0"
        >
          Re-evaluate
        </button>
      </div>

      {/* 2. STALE DATA PROTECTION BANNER */}
      {isStale && (
        <div className="bg-red-950/90 border-2 border-red-600 p-3.5 rounded-xl space-y-1 text-xs text-red-200 shadow-lg min-w-0">
          <div className="flex items-center gap-2 font-bold text-red-100 text-sm">
            <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
            <span>STALE DATA PROTECTION ACTIVE</span>
          </div>
          <p className="pl-7 text-[11px] break-words">
            Latest telemetry is <strong>{selectedLocation.telemetry_age_minutes || 480} minutes old (&gt;6h)</strong>. Previous risk predictions are suppressed to avoid false certainty.
          </p>
          <div className="pl-7 font-mono text-[10px] text-red-300">
            Assessment Status: <strong>STALE / NOT CURRENT</strong>
          </div>
        </div>
      )}

      {/* 3. Primary Final Risk Level Card */}
      <div className={`p-3.5 sm:p-4 rounded-xl border-2 shadow-lg flex flex-wrap items-center justify-between gap-3 min-w-0 ${getBadgeStyle(finalLevel)}`}>
        <div className="space-y-1 min-w-0">
          <div className="text-[11px] font-mono tracking-wider font-semibold uppercase opacity-90 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>FINAL POLICY RISK LEVEL</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight flex items-baseline gap-2">
            <span>{finalLevel}</span>
            {!isStale && prediction.final_risk_score !== null && (
              <span className="text-base sm:text-lg font-mono font-normal opacity-80">
                ({prediction.final_risk_score}/100)
              </span>
            )}
          </div>
        </div>
        <div className="text-right font-mono text-xs space-y-1 shrink-0">
          <div className="opacity-80">Data Quality:</div>
          <div className={`px-2 py-0.5 rounded border text-[11px] font-bold inline-block ${getQualityBadge(quality)}`}>
            {quality}
          </div>
        </div>
      </div>

      {/* 4. Deterministic Escalation Alert */}
      {isEscalated && (
        <div className="bg-amber-950/70 border border-amber-600/80 p-3 rounded-lg space-y-2 shadow-inner min-w-0">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="break-words">POLICY ESCALATION: MODEL RISK ({modelLevel}) OVERRIDDEN TO HIGH</span>
          </div>
          <div className="text-xs text-amber-200/90 pl-6 space-y-1">
            <p className="font-semibold text-amber-100">Why was the risk escalated?</p>
            {prediction.risk_escalation_reasons.length > 0 ? (
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] break-words">
                {prediction.risk_escalation_reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px]">Deterministic safety rule triggered on extreme terrain and snowfall conditions.</p>
            )}
          </div>
        </div>
      )}

      {/* 5. Deterministic Policy Rule Transparency Breakdown */}
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2 text-xs min-w-0">
        <div className="text-[11px] font-mono font-bold text-slate-300 border-b border-slate-800 pb-1 flex flex-wrap items-center justify-between gap-1">
          <span>ENGINEERING HEURISTIC POLICIES</span>
          <span className="text-slate-500 font-normal">Deterministic Verification</span>
        </div>
        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 bg-slate-900 p-2 rounded min-w-0">
            <span className="text-slate-300 break-words">Heavy 24h Snowfall (&gt;30mm) on Steep Slope (&gt;34°):</span>
            <span className={`shrink-0 ${selectedLocation.snowfall_24h > 30.0 && selectedLocation.slope > 34.0 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
              {selectedLocation.snowfall_24h > 30.0 && selectedLocation.slope > 34.0 ? 'TRIGGERED (ESCALATED)' : 'NOT MET'}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 bg-slate-900 p-2 rounded min-w-0">
            <span className="text-slate-300 break-words">72h Extreme Storm Cycle Load (&gt;50mm SWE):</span>
            <span className={`shrink-0 ${selectedLocation.snowfall_72h > 50.0 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
              {selectedLocation.snowfall_72h > 50.0 ? 'TRIGGERED (ESCALATED)' : 'NOT MET'}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Model vs Policy Separation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5 min-w-0">
        {/* ML Statistical Model Output */}
        <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg space-y-2 min-w-0">
          <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] font-bold border-b border-slate-800 pb-1">
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>ML STATISTICAL MODEL</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Model Level:</span>
              <span className="font-bold text-slate-100">{modelLevel}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Calibrated Prob:</span>
              <span className="font-mono font-bold text-cyan-300">
                {prediction.calibrated_probability !== null ? `${(prediction.calibrated_probability * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Raw Model Prob:</span>
              <span className="font-mono text-slate-300">
                {prediction.raw_probability !== null ? `${(prediction.raw_probability * 100).toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Safety Policy Engine Output */}
        <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg space-y-2 min-w-0">
          <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px] font-bold border-b border-slate-800 pb-1">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>SAFETY RISK POLICY</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Final Policy Level:</span>
              <span className="font-bold text-slate-100">{finalLevel}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Final Risk Score:</span>
              <span className="font-mono font-bold text-amber-300">
                {prediction.final_risk_score !== null ? `${prediction.final_risk_score}` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">Policy Escalated:</span>
              <span className={`font-bold ${isEscalated ? 'text-amber-400' : 'text-slate-400'}`}>
                {isEscalated ? 'YES' : 'NO'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Comprehensive Model & System Version Metadata Audit */}
      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-[10px] font-mono text-slate-400 space-y-1 min-w-0">
        <div className="flex justify-between items-center gap-2 min-w-0">
          <span className="shrink-0">Model Version:</span>
          <span className="text-slate-200 truncate">{prediction.model_version || 'calibrated_random_forest_2015_2024'}</span>
        </div>
        <div className="flex justify-between items-center gap-2 min-w-0">
          <span className="shrink-0">Dataset Version:</span>
          <span className="text-slate-200 truncate">2015_2024_multi_season_expanded (N=80)</span>
        </div>
        <div className="flex justify-between items-center gap-2 min-w-0">
          <span className="shrink-0">Feature Schema:</span>
          <span className="text-slate-200 truncate">v2_spatiotemporal_17f</span>
        </div>
        <div className="flex justify-between items-center gap-2 min-w-0">
          <span className="shrink-0">Risk Engine Version:</span>
          <span className="text-slate-200 truncate">2.0.0 (Deterministic Override)</span>
        </div>
      </div>
    </div>
  );
};
