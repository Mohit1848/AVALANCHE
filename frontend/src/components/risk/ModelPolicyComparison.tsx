import React from 'react';
import { ArrowRight, Cpu, ShieldAlert } from 'lucide-react';
import { StatusPill, riskTone } from '../ui/Primitives';
import type { RiskDisplayState } from '../../types';

interface ModelPolicyComparisonProps {
  displayState: RiskDisplayState;
}

export const ModelPolicyComparison: React.FC<ModelPolicyComparisonProps> = ({ displayState }) => {
  const {
    kind,
    hasValidScore,
    score,
    level,
    modelScore,
    modelLevel,
    calibratedProbability,
    isEscalated,
    isResearchDomain,
  } = displayState;

  const isResearch = kind === 'RESEARCH' || (isResearchDomain && hasValidScore && typeof score === 'number' && Number.isFinite(score));
  const isOperationalAvailable = kind === 'AVAILABLE' && hasValidScore;
  const isAvailable = isOperationalAvailable || isResearch;
  const isStale = kind === 'STALE';

  const showModelScore =
    isAvailable &&
    ((modelScore !== null && typeof modelScore === 'number' && Number.isFinite(modelScore)) ||
      (score !== null && typeof score === 'number' && Number.isFinite(score)));

  const showPolicyScore =
    isOperationalAvailable &&
    score !== null &&
    typeof score === 'number' &&
    Number.isFinite(score);

  const displayModelScore = modelScore ?? score;

  return (
    <div className="space-y-2 min-w-0" data-testid="model-policy-decision">
      <div className="t-section text-slate-400">MODEL → POLICY DECISION</div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2.5 min-w-0">
        {/* Card 1: Statistical Model */}
        <div
          className="panel-inset p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col justify-between min-w-0"
          data-testid="statistical-model-block"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              {isResearch ? 'HIMALAYAN MODEL (ML)' : 'STATISTICAL MODEL'}
            </span>
          </div>

          <div
            className="text-lg font-mono font-bold text-slate-100 tabular-nums my-0.5"
            data-testid="model-risk-score"
          >
            {showModelScore ? (
              <span>{Math.round(displayModelScore!)} / 100</span>
            ) : isStale ? (
              <span className="text-red-400">STALE</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl text-slate-400">—</span>
                <span className="text-[10px] text-slate-500 font-normal">NO DATA</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <StatusPill
              tone={isStale ? 'critical' : isAvailable ? riskTone(modelLevel || level) : 'neutral'}
              label={isStale ? 'STALE' : isAvailable ? (modelLevel || level) : 'UNAVAILABLE'}
              glyph="◆"
            />
          </div>

          <div className="text-[11px] font-mono text-slate-400 mt-2 wrap-safe">
            {isAvailable ? (
              <>
                Calibrated probability:{' '}
                <span className="text-slate-200 font-semibold">
                  {calibratedProbability !== null && calibratedProbability !== undefined
                    ? `${(calibratedProbability * 100).toFixed(0)}%`
                    : `${Math.round(displayModelScore ?? 0)}%`}
                </span>
              </>
            ) : isStale ? (
              <span className="text-red-400">Telemetry expired</span>
            ) : (
              <span>Inference unavailable</span>
            )}
          </div>
        </div>

        {/* Transition Arrow */}
        <div className="flex sm:flex-col items-center justify-center p-1" aria-hidden="true">
          <ArrowRight className="w-4 h-4 text-cyan-400 hidden sm:block" />
          <span className="text-xs font-mono text-cyan-400 sm:hidden">↓</span>
        </div>

        {/* Card 2: Safety Policy Engine */}
        <div
          className={`panel-inset p-3 bg-slate-950/80 border rounded-lg flex flex-col justify-between min-w-0 ${
            isAvailable && isEscalated
              ? 'border-amber-500/50 bg-amber-950/10'
              : 'border-slate-800'
          }`}
          data-testid="safety-policy-block"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              SAFETY POLICY ENGINE
            </span>
          </div>

          <div
            className="text-lg font-mono font-bold text-slate-100 tabular-nums my-0.5"
            data-testid="final-policy-score"
          >
            {isResearch ? (
              <span className="text-sm font-bold text-cyan-300">RESEARCH OUTPUT</span>
            ) : showPolicyScore ? (
              <span>{Math.round(score!)} / 100</span>
            ) : isStale ? (
              <span className="text-red-400">STALE</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl text-slate-400">—</span>
                <span className="text-[10px] text-slate-500 font-normal">NOT EVALUATED</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <StatusPill
              tone={isStale ? 'critical' : isResearch ? 'warn' : isOperationalAvailable ? riskTone(level) : 'neutral'}
              label={isStale ? 'STALE' : isResearch ? 'RESEARCH ONLY' : isOperationalAvailable ? level : 'NOT EVALUATED'}
              glyph="◆"
            />
          </div>

          <div className="text-[11px] font-mono mt-2 wrap-safe">
            {isResearch ? (
              <span className="text-amber-400/90 font-medium">Operational policy not enabled</span>
            ) : isOperationalAvailable ? (
              isEscalated ? (
                <span className="text-amber-400 font-bold">Escalated by Safety Policy</span>
              ) : (
                <span className="text-slate-400">Not escalated (Agrees)</span>
              )
            ) : isStale ? (
              <span className="text-red-400 font-semibold">Suppressed (Stale)</span>
            ) : (
              <span className="text-slate-500">No model output available</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

