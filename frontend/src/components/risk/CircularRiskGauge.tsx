import React from 'react';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import type { RiskDisplayState } from '../../types';

interface CircularRiskGaugeProps {
  displayState: RiskDisplayState;
}

export const CircularRiskGauge: React.FC<CircularRiskGaugeProps> = ({ displayState }) => {
  const {
    kind,
    hasValidScore,
    score,
    level,
    modelScore,
    isEscalated,
    isResearchDomain,
  } = displayState;

  const isResearch = kind === 'RESEARCH' || (isResearchDomain && hasValidScore && typeof score === 'number' && Number.isFinite(score));
  const isOperationalAvailable = kind === 'AVAILABLE' && hasValidScore && typeof score === 'number' && Number.isFinite(score);
  const isAvailable = isOperationalAvailable || isResearch;
  const isStale = kind === 'STALE';

  // Determine colors
  let strokeColor = '#475569'; // Neutral slate for unavailable
  let levelColor = '#94a3b8';
  let glowFilter = '';

  if (isAvailable && score !== null) {
    const normLevel = (level || '').toUpperCase();
    if (score >= 65 || normLevel === 'HIGH' || normLevel === 'EXTREME' || normLevel === 'CRITICAL') {
      strokeColor = '#ef4444'; // Red
      levelColor = '#ef4444';
      glowFilter = 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))';
    } else if (score >= 35 || normLevel === 'MEDIUM' || normLevel === 'MODERATE') {
      strokeColor = '#f59e0b'; // Amber
      levelColor = '#f59e0b';
      glowFilter = 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.35))';
    } else {
      strokeColor = '#10b981'; // Green
      levelColor = '#10b981';
      glowFilter = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.35))';
    }
  } else if (isStale) {
    levelColor = '#f87171'; // Red-400 for stale warning
  }

  // SVG Gauge Math (radius = 48, Circumference ≈ 301.59)
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = isAvailable && score !== null ? Math.max(0, Math.min(100, score)) : 0;
  const strokeDashoffset = isAvailable ? circumference - (clampedScore / 100) * circumference : circumference;

  const subtitle = isStale
    ? 'Inference suppressed (stale data)'
    : isResearch
    ? 'RESEARCH PREDICTION'
    : isAvailable
    ? isEscalated
      ? 'Escalated by Safety Policy Engine'
      : 'policy agrees with model'
    : 'Risk assessment unavailable for this target.';

  return (
    <div className="flex flex-col gap-3 min-w-0" data-testid="circular-risk-gauge">
      <div className="flex items-center gap-5 min-w-0">
        {/* SVG Circular Gauge Ring */}
        <div className="relative shrink-0 w-28 h-28 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 116 116">
            {/* Background Track */}
            <circle
              cx="58"
              cy="58"
              r={radius}
              fill="transparent"
              stroke="#1e293b"
              strokeWidth="8"
            />
            {/* Dynamic Progress Arc (Only rendered if available) */}
            {isAvailable ? (
              <circle
                cx="58"
                cy="58"
                r={radius}
                fill="transparent"
                stroke={strokeColor}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  filter: glowFilter,
                  transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease',
                }}
              />
            ) : (
              /* Neutral static dashed ring for unavailable states */
              <circle
                cx="58"
                cy="58"
                r={radius}
                fill="transparent"
                stroke="#334155"
                strokeWidth="6"
                strokeDasharray="4 4"
              />
            )}
          </svg>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
            {isAvailable && score !== null ? (
              <span
                className="font-mono font-extrabold tracking-tight leading-none text-[28px]"
                style={{ color: levelColor }}
                data-testid="policy-risk-score"
              >
                {Math.round(score)}
                <span className="text-xs text-slate-400 font-normal"> /100</span>
              </span>
            ) : (
              <div className="flex flex-col items-center justify-center" data-testid="policy-risk-score">
                <span className="font-mono font-extrabold text-2xl text-slate-400 leading-none">
                  —
                </span>
                <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase tracking-wider font-bold">
                  {isStale ? '(SUPPRESSED)' : 'NO DATA'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Details */}
        <div className="flex flex-col justify-center min-w-0">
          <div
            className="font-mono font-bold tracking-tight uppercase leading-none text-xl"
            style={{ color: levelColor }}
            data-testid="policy-risk-level"
          >
            {isAvailable ? level : isStale ? 'STALE' : (level || 'INSUFFICIENT_DATA')}
          </div>
          <div className="text-xs font-semibold text-slate-300 mt-1">
            {isResearch ? 'RESEARCH PREDICTION' : 'policy risk (final)'}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5 wrap-safe leading-snug">
            {isResearch ? 'Provisional research output (N=44)' : subtitle}
          </div>
        </div>
      </div>

      {/* Conditional Bottom Panel: Numeric 0-100 Scale ONLY when Available */}
      {isAvailable && score !== null ? (
        <div className="space-y-1 pt-1 min-w-0" data-testid="numeric-risk-scale">
          <div className="relative h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800">
            {/* Gradient Ramp: Green -> Yellow -> Red */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to right, #10b981 0%, #34d399 25%, #f59e0b 50%, #f97316 75%, #ef4444 100%)',
                opacity: 0.85,
              }}
            />

            {/* Model Score Tick Indicator */}
            {modelScore !== null && modelScore !== undefined && typeof modelScore === 'number' && Number.isFinite(modelScore) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-cyan-300 opacity-70 z-10"
                style={{
                  left: `calc(${Math.max(0, Math.min(100, modelScore))}% - 1px)`,
                }}
                title={`Model Score: ${modelScore}/100`}
              />
            )}

            {/* Current Score Indicator Needle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-md z-10"
              style={{
                left: `calc(${clampedScore}% - 2px)`,
                transition: 'left 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              title={`Risk Score: ${score}/100`}
            />
          </div>

          {/* Scale Numbers */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 px-0.5">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      ) : (
        /* Neutral Status Panel when No Valid Numeric Score Exists */
        <div
          className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono space-y-1 motion-fade"
          data-testid="no-score-panel"
        >
          <div className="text-slate-400 font-bold flex items-center gap-1.5">
            <span>NO VALID RISK SCORE</span>
          </div>
          <div className="text-slate-500 leading-relaxed text-[10px]">
            The model did not produce an operational risk prediction for this target.
          </div>
        </div>
      )}

      {/* Himalayan Research Prediction Callout Card */}
      {isResearch && (
        <div
          className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/40 text-xs font-mono space-y-2 motion-fade"
          data-testid="himalayan-research-card"
        >
          <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-cyan-800/40 pb-1.5">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>HIMALAYAN RESEARCH MODEL</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-semibold">
              CALIBRATED (N=44)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Calibrated Probability:</span>
              <span className="font-bold text-slate-100">
                {displayState.calibratedProbability !== null
                  ? `${Math.round(displayState.calibratedProbability * 100)}%`
                  : `${Math.round(score ?? 0)}%`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Research Risk Score:</span>
              <span className="font-bold text-cyan-300">{Math.round(score ?? 0)} / 100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Risk Level:</span>
              <span className="font-bold" style={{ color: levelColor }}>{level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Model Version:</span>
              <span className="text-slate-200">himalaya_rf_v1</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-cyan-800/30 flex items-start gap-1.5 text-[10px] text-amber-300/90 leading-tight">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
            <span>
              <strong>RESEARCH ONLY:</strong> Provisional scientific estimate. Not certified as an operational avalanche warning.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
