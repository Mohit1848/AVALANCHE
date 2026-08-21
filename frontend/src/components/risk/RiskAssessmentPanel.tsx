import React, { useState } from 'react';
import {
  AlertTriangle,
  Radio,
  RefreshCw,
  Target,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Database,
  Activity,
} from 'lucide-react';
import type { PredictionContext } from '../../types';
import { formatTelemetryAge } from '../../utils/formatters';
import { resolveRiskDisplayState } from '../../utils/riskDisplayAdapter';
import { StatusPill, DataTable, DataRow } from '../ui/Primitives';
import { CircularRiskGauge } from './CircularRiskGauge';
import { ModelPolicyComparison } from './ModelPolicyComparison';
import { PolicyEscalationReasons } from './PolicyEscalationReasons';

interface RiskAssessmentPanelProps {
  context: PredictionContext;
  onRefresh: () => void;
  onSync?: () => Promise<void> | void;
  isSyncing?: boolean;
}

export const RiskAssessmentPanel: React.FC<RiskAssessmentPanelProps> = ({
  context,
  onRefresh,
  onSync,
  isSyncing = false,
}) => {
  const [showHistoricalRules, setShowHistoricalRules] = useState(false);
  const [showTelemetryDetails, setShowTelemetryDetails] = useState(true);
  const [showProvenanceDetails, setShowProvenanceDetails] = useState(true);

  if (context.isLoading) {
    return (
      <div className="panel p-8 text-center space-y-4 bg-slate-900/90 border border-slate-800" data-testid="risk-panel-loading">
        <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto" />
        <div className="t-section text-cyan-400 font-mono">
          RUNNING SAFETY &amp; ML RISK EVALUATION…
        </div>
      </div>
    );
  }

  if (context.error) {
    return (
      <div
        className="panel p-6 text-center space-y-3 bg-red-950/20 border border-red-500/50"
        data-testid="risk-panel-error"
      >
        <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
        <div className="font-mono font-bold text-red-400">PREDICTION UNAVAILABLE</div>
        <p className="text-xs font-mono text-slate-300 wrap-safe">{context.error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="tap px-3 py-1.5 rounded-md font-mono text-xs font-bold mx-auto bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          Retry Assessment
        </button>
      </div>
    );
  }

  // Single authoritative risk display state adapter
  const displayState = resolveRiskDisplayState(context);

  const isStale = displayState.kind === 'STALE';
  const isDegraded = !isStale && (context.freshness_state as string) === 'DEGRADED';
  const isResearchDomain = displayState.isResearchDomain;

  const rawObsTs = context.telemetry_timestamp || context.last_observation_timestamp || '2026-08-20T08:00:00Z';
  const formattedObsUtc = rawObsTs.replace('T', ' ').replace(':00Z', ' UTC').replace('Z', ' UTC');

  const quality = isStale ? 'STALE' : (context.data_quality || 'GOOD');
  const formattedAge = formatTelemetryAge(context.telemetry_age_minutes);

  const qualityTone =
    quality === 'GOOD' ? 'live' : quality === 'DEGRADED' ? 'warn' : quality === 'STALE' ? 'critical' : 'neutral';

  const MISSING = 'MISSING / SENSOR NOT MONITORED';
  const val = (v: number | null | undefined, fmt: (n: number) => string) =>
    v === null || v === undefined ? MISSING : fmt(v);

  const telemetryRows = [
    { label: 'Air Temp (TOBS)', value: val(context.temperature, (n) => `${n.toFixed(1)} °C`), missing: context.temperature === null || context.temperature === undefined },
    { label: 'Snow Depth (SNWD)', value: val(context.snow_depth, (n) => `${n.toFixed(0)} cm`), missing: context.snow_depth === null || context.snow_depth === undefined },
    { label: 'SWE (WTEQ)', value: val(context.snow_water_equivalent, (n) => `${n.toFixed(0)} mm`), missing: context.snow_water_equivalent === null || context.snow_water_equivalent === undefined },
    { label: 'Precip (PREC)', value: val(context.precipitation, (n) => `${n.toFixed(1)} mm`), missing: context.precipitation === null || context.precipitation === undefined },
    { label: 'Wind (WSPDV)', value: val(context.wind_speed_mean_24h, (n) => `${n.toFixed(0)} km/h (24h mean)`), missing: context.wind_speed_mean_24h === null || context.wind_speed_mean_24h === undefined },
  ];

  const varStatus = isStale ? 'STALE' : isDegraded ? 'AGED' : 'GOOD';
  const varTone = isStale ? 'critical' : isDegraded ? 'warn' : 'live';

  return (
    <div className="space-y-3 min-w-0" data-testid="risk-assessment-panel">
      {/* ================= 1. TARGET EVALUATION HEADER ================= */}
      <div className="panel p-3.5 bg-slate-900/95 border border-slate-800 rounded-xl space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>TARGET EVALUATION</span>
            </div>

            <h2 className="text-lg font-bold text-slate-100 tracking-tight wrap-safe mt-0.5">
              {context.target_name}
            </h2>

            <div className="text-xs font-mono text-slate-400 wrap-safe mt-0.5">
              {context.latitude?.toFixed(4)}° N, {Math.abs(context.longitude ?? 0).toFixed(4)}° {context.longitude >= 0 ? 'E' : 'W'}
              {' • '}Elevation: {context.elevation?.toLocaleString()} m
              {context.slope !== null && <> • Slope: {context.slope}°</>}
              {context.telemetry_source === 'CUSTOM CSV DATASET' && <> • Source: Custom CSV Dataset</>}
            </div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="tap gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs font-bold shrink-0 bg-slate-950 border border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
            aria-label="Re-evaluate risk for this location"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            <span>Re-evaluate</span>
          </button>
        </div>

        {/* Telemetry Stream Badge */}
        {isResearchDomain ? (
          <div
            className="rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs bg-cyan-950/30 border border-cyan-500/40 text-cyan-300 motion-fade"
            data-testid="telemetry-research-banner"
          >
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <Database className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              <span className="font-bold">DATA DOMAIN: HIMALAYAS • SOURCE: CSV DATASET</span>
              <span className="text-slate-400">• MODEL STATUS: <strong className="text-amber-300">{displayState.modelStatusText}</strong></span>
              <span className="text-slate-400 hidden sm:inline">• INFERENCE: <strong className="text-slate-200">{displayState.inferenceStatusText}</strong></span>
            </div>
            <StatusPill tone="neutral" label="RESEARCH" glyph="◉" />
          </div>
        ) : isStale ? (
          <div
            className="rounded-lg p-2.5 bg-red-950/30 border border-red-500/50 text-xs font-mono space-y-1 motion-fade"
            role="alert"
            data-testid="telemetry-stale-banner"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-red-400 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>TELEMETRY STALE — STALE DATA PROTECTION ACTIVE</span>
              </div>
              <StatusPill tone="critical" label="STALE" glyph="⚠" testId="data-quality-badge" />
            </div>

            <div className="text-slate-300">
              NRCS AWDB • Last observation {formattedAge} ago
            </div>

            <div className="text-red-300 font-semibold">
              LIVE PREDICTION SUPPRESSED · Status: <strong>STALE / NOT CURRENT</strong>
            </div>

            <div className="text-slate-400">
              Reason: Latest NRCS AWDB observation exceeds the 6-hour freshness limit.
            </div>

            <div className="text-slate-400">
              Last observation: {formattedObsUtc}
            </div>

            {onSync && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onSync()}
                  disabled={isSyncing}
                  className="tap gap-1.5 px-2.5 py-1 rounded font-bold bg-red-950 border border-red-500 text-red-300 hover:bg-red-900"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'SYNCING…' : 'SYNC NOW'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs ${
              isDegraded
                ? 'bg-amber-950/20 border border-amber-500/40 text-amber-300'
                : 'bg-emerald-950/20 border border-emerald-500/40 text-emerald-300'
            }`}
            data-testid="telemetry-live-banner"
          >
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <Radio className={`w-3.5 h-3.5 shrink-0 ${isDegraded ? 'text-amber-400' : 'text-emerald-400 animate-pulse'}`} />
              <span className="font-bold">
                {isDegraded
                  ? 'TELEMETRY: DEGRADED • SOURCE: NRCS AWDB'
                  : 'TELEMETRY: LIVE • SOURCE: NRCS AWDB'}
              </span>
              <span className="text-slate-400">• AGE: {formattedAge}</span>
              <span className="text-slate-400 hidden sm:inline">
                Model gating: <strong className="text-slate-200">ACTIVE PREDICTION</strong>
              </span>
            </div>
            <StatusPill tone={qualityTone as any} label={quality} glyph="◆" testId="data-quality-badge" />
          </div>
        )}
      </div>

      {/* ================= 2. FINAL POLICY RISK (CIRCULAR GAUGE) ================= */}
      <div
        className="panel p-4 bg-slate-900/95 border border-slate-800 rounded-xl space-y-2.5 shadow-md"
        data-testid="primary-risk-block"
      >
        <div className="t-section text-slate-400">FINAL POLICY RISK</div>

        <CircularRiskGauge displayState={displayState} />

        {/* Reason & Data Requirement Card (Rendered for Unavailable/Research/Insufficient States) */}
        {!displayState.hasValidScore && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1" data-testid="unavailable-reason-card">
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">MODEL STATUS</div>
              <div className="font-bold text-amber-300 mt-0.5">{displayState.modelStatusText}</div>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">INFERENCE</div>
              <div className="font-bold text-slate-200 mt-0.5">{displayState.inferenceStatusText}</div>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">DATA REQUIREMENT</div>
              <div className="font-bold text-slate-300 mt-0.5">{displayState.dataRequirementText}</div>
            </div>
          </div>
        )}
      </div>

      {/* ================= 3. MODEL → POLICY DECISION ================= */}
      <div className="panel p-4 bg-slate-900/95 border border-slate-800 rounded-xl">
        <ModelPolicyComparison displayState={displayState} />
      </div>

      {/* ================= 4. POLICY ESCALATION REASONS ================= */}
      <div className="panel p-4 bg-slate-900/95 border border-slate-800 rounded-xl">
        <PolicyEscalationReasons
          context={context}
          displayState={displayState}
        />
      </div>

      {/* ================= 5. ESCALATION OVERRIDE BANNER (IF ACTIVE) ================= */}
      {displayState.kind === 'AVAILABLE' && displayState.isEscalated && (
        <div
          className="rounded-lg p-3 bg-amber-950/25 border border-amber-500/50 flex items-start gap-2 motion-fade"
          data-testid="policy-escalation-banner"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span className="font-mono font-bold text-xs text-amber-300 wrap-safe">
            POLICY ESCALATION: MODEL RISK ({displayState.modelLevel}) OVERRIDDEN TO {displayState.level}
          </span>
        </div>
      )}

      {/* ================= 6. LIVE TELEMETRY DETAILS DRAWER ================= */}
      <div className="panel p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => setShowTelemetryDetails((v) => !v)}
          aria-expanded={showTelemetryDetails}
          className="tap w-full flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="t-section text-slate-200 truncate-safe">
              LIVE TELEMETRY DETAILS (USDA NRCS AWDB)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill tone={qualityTone as any} label={quality} glyph="●" />
            {showTelemetryDetails ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </button>

        {showTelemetryDetails && (
          <div className="mt-2.5 motion-fade space-y-2">
            <DataTable
              columns={['Variable', 'Value', 'Age', 'Status']}
              caption="Live telemetry variables with observation age and status"
              testId="telemetry-table"
            >
              {telemetryRows.map((r) => (
                <DataRow
                  key={r.label}
                  cells={[
                    r.label,
                    r.missing ? (
                      <span key="v" className="text-slate-500 italic text-[11px]">{r.value}</span>
                    ) : (
                      r.value
                    ),
                    r.missing ? '—' : formattedAge,
                    <StatusPill
                      key="s"
                      tone={r.missing ? 'neutral' : (varTone as any)}
                      label={r.missing ? 'NO SENSOR' : varStatus}
                      glyph={r.missing ? '○' : '●'}
                    />,
                  ]}
                />
              ))}
            </DataTable>
            <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
              Source: USDA NRCS AWDB • SNOTEL Network
            </div>
          </div>
        )}
      </div>

      {/* ================= 7. HISTORICAL RULE EVALUATION DRAWER ================= */}
      <div className="panel p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => setShowHistoricalRules((v) => !v)}
          aria-expanded={showHistoricalRules}
          className="tap w-full flex items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            {showHistoricalRules ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            <span className="t-section text-slate-300 truncate-safe">
              Historical Rule Evaluation — Diagnostic Only
            </span>
          </span>
          <span className="text-[10px] font-mono text-slate-400 shrink-0">
            ({context.rules_evaluation?.length || 0} rules)
          </span>
        </button>

        {showHistoricalRules && (
          <div className="mt-2.5 space-y-1.5 motion-fade max-h-56 overflow-y-auto pr-1">
            {isStale && (
              <div className="p-2 rounded bg-amber-950/20 border border-amber-500/30 text-[11px] font-mono text-amber-300">
                <strong>Diagnostic Reference:</strong> Rules reflect historical sensor data from <code>{context.telemetry_timestamp || context.last_observation_timestamp}</code>.
              </div>
            )}

            {context.rules_evaluation && context.rules_evaluation.length > 0 ? (
              context.rules_evaluation.map((rule: any) => {
                const isTriggered = rule.status === 'TRIGGERED' || rule.triggered === true;
                return (
                  <div
                    key={rule.rule_id}
                    className={`panel-inset p-2 rounded border ${
                      isTriggered ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0 text-xs font-mono">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {isTriggered ? (
                          <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-slate-600 shrink-0" />
                        )}
                        <span className="truncate-safe text-slate-200 font-semibold">{rule.rule_name}</span>
                      </span>
                      <StatusPill
                        tone={isTriggered ? 'warn' : 'neutral'}
                        label={rule.status || (isTriggered ? 'TRIGGERED' : 'CLEAR')}
                        glyph={isTriggered ? '▲' : '○'}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 pl-4 mt-0.5">
                      {rule.description || rule.rationale}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-[11px] font-mono text-slate-500 italic p-1">
                No deterministic override rules evaluated.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= 8. PROVENANCE SUMMARY BLOCK ================= */}
      <div className="panel p-3 bg-slate-900/90 border border-slate-800 rounded-xl" data-testid="provenance-block">
        <button
          type="button"
          onClick={() => setShowProvenanceDetails((v) => !v)}
          className="tap w-full flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="t-section text-slate-300">DATA SOURCE &amp; PROVENANCE</span>
          </div>
          {showProvenanceDetails ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {showProvenanceDetails && (
          <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-300 motion-fade">
            <div className="flex justify-between">
              <span className="text-slate-500">Provider:</span>
              <span className="text-slate-200 font-semibold">USDA NRCS AWDB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Network:</span>
              <span className="text-slate-200 font-semibold">SNTL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Last Sync:</span>
              <span className="text-slate-200">{context.current_utc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Latest Obs:</span>
              <span className="text-slate-200">{formattedObsUtc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Freshness:</span>
              <span className="text-slate-200">{context.freshness_state} ({formattedAge})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Model Gate:</span>
              <span className={isStale ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {isStale ? 'GATED (HOLD)' : 'ACTIVE INFERENCE'}
              </span>
            </div>
            <div className="col-span-full pt-1 text-[10px] text-slate-400 flex justify-between border-t border-slate-800/50 mt-1">
              <span>Terrain: {context.terrain_source || 'Copernicus 30m DEM'}</span>
              <span>Model: {context.prediction?.model_version || (isResearchDomain ? 'research_evaluation_only' : 'colorado_avalanche_rf_v3')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
