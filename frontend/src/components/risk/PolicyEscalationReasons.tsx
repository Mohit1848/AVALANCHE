import React from 'react';
import { Snowflake, TriangleAlert, Wind, CheckCircle2, XCircle } from 'lucide-react';
import type { PredictionContext, RiskDisplayState } from '../../types';

interface PolicyEscalationReasonsProps {
  context: PredictionContext;
  displayState: RiskDisplayState;
}

export const PolicyEscalationReasons: React.FC<PolicyEscalationReasonsProps> = ({
  context,
  displayState,
}) => {
  const { kind, isEscalated, escalationReasons, isResearchDomain } = displayState;
  const isAvailable = kind === 'AVAILABLE';
  const isStale = kind === 'STALE';

  const slope = context.slope ?? 0;
  const snow24 = context.snowfall_24h ?? 0;
  const snow72 = context.snowfall_72h ?? 0;
  const windGust = context.wind_speed_max_24h ?? (context.wind_speed_mean_24h ? context.wind_speed_mean_24h * 1.5 : 0);

  // Evaluate heuristics for live operational targets
  const isSteep = slope >= 30.0;
  const isHeavySnow = snow24 >= 20.0 || snow72 >= 35.0;
  const isHighWind = windGust >= 45.0;

  const heuristicChips = [
    {
      id: 'snow',
      icon: <Snowflake className="w-3.5 h-3.5 text-cyan-400 shrink-0" />,
      title: 'Heavy snowfall',
      detail: `24h: ${snow24.toFixed(0)}mm | 72h: ${snow72.toFixed(0)}mm`,
      condition: '≥20mm/24h or ≥35mm/72h',
      met: isAvailable ? isHeavySnow : false,
      observed: isHeavySnow,
    },
    {
      id: 'slope',
      icon: <TriangleAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      title: 'Steep starting zone',
      detail: `Slope: ${slope.toFixed(1)}°`,
      condition: '≥30° prone terrain',
      met: isAvailable ? isSteep : false,
      observed: isSteep,
    },
    {
      id: 'wind',
      icon: <Wind className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
      title: 'Elevated wind loading',
      detail: `24h gusts: ${windGust.toFixed(0)} km/h`,
      condition: '≥45 km/h peak gust',
      met: isAvailable ? isHighWind : false,
      observed: isHighWind,
    },
  ];

  return (
    <div className="space-y-2 min-w-0" data-testid="policy-escalation-reasons-container">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="t-section text-slate-400">
          POLICY ESCALATION REASONS
        </span>
        <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
          ENGINEERING HEURISTIC POLICIES
        </span>
      </div>

      {isAvailable && isEscalated && escalationReasons.length > 0 ? (
        <div className="space-y-1.5" data-testid="escalation-reasons">
          {/* Explicit Triggered Escalation Reasons List */}
          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/40 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
              <span>SAFETY ENGINE ESCALATION TRIGGERED</span>
            </div>
            {escalationReasons.map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs text-slate-200 font-mono pl-5">
                <span>{r}</span>
                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  TRIGGERED (ESCALATED)
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Structured 3-Chip Heuristic Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
        {heuristicChips.map((chip) => (
          <div
            key={chip.id}
            className={`panel-inset p-2.5 rounded-lg flex flex-col justify-between border ${
              isAvailable && chip.met
                ? 'border-amber-500/30 bg-amber-950/10'
                : 'border-slate-800 bg-slate-950/60'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {chip.icon}
                <span className="text-[11px] font-semibold text-slate-200 truncate-safe">
                  {chip.title}
                </span>
              </div>
              {isAvailable ? (
                chip.met ? (
                  <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-amber-400 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" />
                    MET
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-mono text-slate-500 shrink-0">
                    <XCircle className="w-3 h-3 text-slate-600" />
                    CLEAR
                  </span>
                )
              ) : (
                <span className="text-[9px] font-mono text-slate-500 shrink-0">
                  {isResearchDomain ? 'OBSERVED' : 'UNAVAILABLE'}
                </span>
              )}
            </div>

            <div className="text-xs font-mono font-bold text-slate-300">
              {chip.detail}
            </div>

            <div className="text-[10px] font-mono text-slate-500 mt-1">
              {chip.condition}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[11px] font-mono text-slate-400 px-1">
        {isAvailable ? (
          isEscalated
            ? 'Safety policy engine escalated the operational assessment based on active physical heuristics.'
            : 'No deterministic rule escalated this assessment.'
        ) : isResearchDomain ? (
          'Deterministic safety policy engine is not active for research domain / non-Colorado targets.'
        ) : isStale ? (
          'Deterministic policy not evaluated — telemetry outside freshness gate.'
        ) : (
          'Deterministic policy not evaluated — insufficient operational data.'
        )}
      </div>
    </div>
  );
};
