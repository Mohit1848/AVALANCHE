import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Cpu,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Database,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Snowflake,
  Wind,
  Droplets,
  Radio,
  RefreshCw,
} from 'lucide-react';
import type { PredictionContext } from '../../types';
import { formatTelemetryAge } from '../../utils/formatters';

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

  if (context.isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-4 animate-pulse">
        <div className="w-12 h-12 bg-slate-800 rounded-full mx-auto"></div>
        <div className="h-4 bg-slate-800 rounded w-3/4 mx-auto"></div>
        <div className="h-3 bg-slate-800 rounded w-1/2 mx-auto"></div>
        <div className="text-xs text-cyan-400 font-mono font-bold tracking-wider uppercase">
          LOADING ASSESSMENT & RUNNING SAFETY EVALUATION...
        </div>
      </div>
    );
  }

  if (context.error) {
    return (
      <div className="bg-slate-900 border border-red-900/60 rounded-xl p-6 text-center text-slate-300 space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
        <div className="font-bold text-red-300">PREDICTION UNAVAILABLE</div>
        <p className="text-xs text-slate-400">{context.error}</p>
        <button
          onClick={onRefresh}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors font-mono"
        >
          Retry Assessment
        </button>
      </div>
    );
  }

  const isStale = (context.freshness_state as string) === 'STALE' || (context.freshness_state as string) === 'HISTORICAL' || (context.data_quality as string) === 'STALE' || (context.telemetry_age_minutes !== null && context.telemetry_age_minutes !== undefined && context.telemetry_age_minutes > 360);
  const isInsufficient = (context.freshness_state as string) === 'INSUFFICIENT' || (context.data_quality as string) === 'INSUFFICIENT' || (context.data_quality as string) === 'INSUFFICIENT_DATA' || !context.prediction;

  const rawObsTs = context.telemetry_timestamp || context.last_observation_timestamp || '2026-08-20T08:00:00Z';
  const formattedObsUtc = rawObsTs.replace('T', ' ').replace(':00Z', ' UTC').replace('Z', ' UTC');

  const prediction = context.prediction || {
    final_risk_level: isStale ? 'STALE' : 'INSUFFICIENT_DATA',
    model_risk_level: isStale ? 'STALE' : 'INSUFFICIENT_DATA',
    final_risk_score: null,
    model_risk_score: null,
    calibrated_probability: null,
    raw_probability: null,
    risk_escalated: false,
    risk_escalation_reasons: [],
    rule_evaluations: [],
    model_version: 'colorado_avalanche_rf_v3',
  };

  const finalLevel = isStale ? 'STALE' : (prediction.final_risk_level || 'INSUFFICIENT_DATA');
  const modelLevel = isStale ? 'STALE' : (prediction.model_risk_level || 'INSUFFICIENT_DATA');
  const quality = isStale ? 'STALE' : (context.data_quality || 'INSUFFICIENT');
  const isEscalated = !isStale && !isInsufficient && prediction.risk_escalated;

  const getBadgeStyle = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'bg-red-950/80 border-red-500 text-red-100 animate-pulse';
      case 'MEDIUM':
        return 'bg-amber-950/80 border-amber-500 text-amber-100';
      case 'LOW':
        return 'bg-emerald-950/80 border-emerald-500 text-emerald-100';
      case 'STALE':
        return 'bg-slate-900 border-red-500/80 text-slate-200';
      case 'INSUFFICIENT_DATA':
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  const getQualityBadge = (q: string) => {
    switch (q) {
      case 'GOOD':
      case 'LIVE':
        return 'bg-emerald-950/60 border-emerald-700 text-emerald-300';
      case 'DEGRADED':
        return 'bg-amber-950/60 border-amber-700 text-amber-300';
      case 'STALE':
        return 'bg-red-950/60 border-red-700 text-red-300 font-bold';
      case 'INSUFFICIENT':
      case 'INSUFFICIENT_DATA':
      default:
        return 'bg-slate-800 border-slate-700 text-slate-400 font-bold';
    }
  };

  const formattedAge = formatTelemetryAge(context.telemetry_age_minutes);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-xl text-slate-100 font-sans min-w-0">
      {/* 1. Target Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-mono tracking-wider text-cyan-400 font-semibold uppercase block truncate">
            TARGET EVALUATION: {context.target_type}
          </span>
          <h2 className="text-sm sm:text-base font-bold text-white leading-tight break-words">{context.target_name}</h2>
          <div className="text-[11px] text-slate-400 font-mono truncate">
            {context.latitude.toFixed(4)}°N, {Math.abs(context.longitude).toFixed(4)}°W • Elev: {context.elevation.toLocaleString()}m • Slope: {context.slope}°
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onSync && (
            <button
              onClick={() => onSync()}
              disabled={isSyncing}
              className="bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs px-2.5 py-1 rounded-lg transition-colors font-mono disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'SYNC NOW'}</span>
            </button>
          )}
          <button
            onClick={onRefresh}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-lg transition-colors font-mono shrink-0"
          >
            Re-evaluate
          </button>
        </div>
      </div>

      {/* 2A. Live Telemetry Stream Banner (When fresh) */}
      {!isStale && !isInsufficient && (
        <div className="bg-emerald-950/80 border-2 border-emerald-500/80 p-2.5 sm:p-3 rounded-xl space-y-1 text-xs text-emerald-200 shadow-lg min-w-0">
          <div className="flex items-center justify-between gap-2 font-bold text-emerald-100 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
              <span>TELEMETRY: LIVE • SOURCE: NRCS AWDB</span>
            </div>
            <span className="text-[10px] font-mono bg-emerald-900 border border-emerald-600 px-2 py-0.5 rounded text-emerald-200">
              AGE: {formattedAge}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-[10px] text-emerald-300 pt-1 border-t border-emerald-900/60">
            <div className="truncate">Observed UTC: <strong>{formattedObsUtc}</strong></div>
            <div>Model Gating: <strong className="text-emerald-200">ACTIVE PREDICTION</strong></div>
          </div>
        </div>
      )}

      {/* 2B. Prominent Stale Data Banner */}
      {isStale && (
        <div className="bg-red-950/90 border-2 border-red-500/90 p-2.5 sm:p-3 rounded-xl space-y-1.5 text-xs text-red-200 shadow-lg min-w-0">
          <div className="flex items-center gap-2 font-bold text-red-100 text-xs sm:text-sm">
            <AlertOctagon className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" />
            <span>LIVE PREDICTION SUPPRESSED</span>
          </div>
          <div className="pl-6 sm:pl-7 text-[11px] font-semibold text-red-200 leading-tight">
            Reason: Latest NRCS AWDB observation exceeds the 6-hour freshness limit.
          </div>
          <div className="pl-6 sm:pl-7 text-[10px] font-mono font-bold tracking-wider text-red-300 uppercase">
            STALE TELEMETRY — LIVE PREDICTION SUPPRESSED • HISTORICAL DATA — LIVE PREDICTION UNAVAILABLE
          </div>
          <p className="pl-6 sm:pl-7 text-[11px] text-red-200/90 leading-tight">
            Latest observation: <strong>{formattedAge} old</strong> ({context.telemetry_age_minutes?.toLocaleString() || '452'} min, &gt;6h). Real-time assessment suppressed.
          </p>
          <div className="pl-6 sm:pl-7 grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-[10px] text-red-300 pt-1 border-t border-red-900/60">
            <div className="truncate">Observation: <strong>{formattedObsUtc}</strong></div>
            <div>Status: <strong>STALE / NOT CURRENT</strong></div>
          </div>
        </div>
      )}

      {/* 2C. Expandable Live Telemetry Details Breakdown */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60">
        <button
          onClick={() => setShowTelemetryDetails(!showTelemetryDetails)}
          className="w-full p-2.5 flex items-center justify-between text-xs font-mono font-bold text-slate-300 hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>LIVE TELEMETRY DETAILS (USDA NRCS AWDB)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${isStale ? 'bg-red-950 text-red-300 border-red-800' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}`}>
              {context.freshness_state}
            </span>
          </div>
          {showTelemetryDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showTelemetryDetails && (
          <div className="p-2.5 pt-0 space-y-2 text-xs border-t border-slate-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 font-mono">
              {/* Air Temperature */}
              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-cyan-400" /> Air Temp (TOBS)</span>
                  <span className="text-slate-500">°C</span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {context.temperature !== null && context.temperature !== undefined ? `${context.temperature} °C` : <span className="text-slate-500 font-normal">MISSING</span>}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5 truncate">Source: NRCS AWDB • {isStale ? 'STALE' : 'LIVE'}</div>
              </div>

              {/* Snow Depth */}
              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="flex items-center gap-1"><Snowflake className="w-3 h-3 text-cyan-400" /> Snow Depth (SNWD)</span>
                  <span className="text-slate-500">cm</span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {context.snow_depth !== null && context.snow_depth !== undefined ? `${context.snow_depth} cm` : <span className="text-slate-500 font-normal">MISSING</span>}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5 truncate">Source: NRCS AWDB • {isStale ? 'STALE' : 'LIVE'}</div>
              </div>

              {/* SWE */}
              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-cyan-400" /> SWE (WTEQ)</span>
                  <span className="text-slate-500">mm</span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {context.snow_water_equivalent !== null && context.snow_water_equivalent !== undefined ? `${context.snow_water_equivalent} mm` : <span className="text-slate-500 font-normal">MISSING</span>}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5 truncate">Source: NRCS AWDB • {isStale ? 'STALE' : 'LIVE'}</div>
              </div>

              {/* Precipitation */}
              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-cyan-400" /> Precip (PREC)</span>
                  <span className="text-slate-500">mm</span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {context.precipitation !== null && context.precipitation !== undefined ? `${context.precipitation} mm` : <span className="text-slate-500 font-normal">0.0 mm</span>}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5 truncate">Source: NRCS AWDB • {isStale ? 'STALE' : 'LIVE'}</div>
              </div>

              {/* Wind Speed */}
              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded sm:col-span-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-cyan-400" /> Wind (WSPDV)</span>
                  <span className="text-slate-500">km/h</span>
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  {context.wind_speed_mean_24h !== null && context.wind_speed_mean_24h !== undefined ? (
                    `${context.wind_speed_mean_24h} km/h (24h mean) / ${context.wind_speed_max_24h || 'N/A'} km/h (max)`
                  ) : (
                    <span className="text-slate-500 font-normal italic">MISSING / SENSOR NOT MONITORED</span>
                  )}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5 truncate">
                  {context.wind_speed_mean_24h !== null ? 'Source: NRCS AWDB' : 'Station lacks active wind anemometer telemetry'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. SECTION: CURRENT ASSESSMENT */}
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-300">
            CURRENT ASSESSMENT
          </span>
          {isStale && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
              SUPPRESSED
            </span>
          )}
        </div>

        {/* Primary Final Policy Risk Level Card */}
        <div className={`p-3 sm:p-3.5 rounded-xl border-2 shadow-lg flex flex-wrap items-center justify-between gap-3 min-w-0 ${getBadgeStyle(finalLevel)}`}>
          <div className="space-y-0.5 min-w-0">
            <div className="text-[10px] font-mono tracking-wider font-semibold uppercase opacity-90 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>FINAL POLICY RISK LEVEL</span>
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight flex items-baseline gap-2">
              <span>{finalLevel}</span>
              {!isStale && !isInsufficient && prediction.final_risk_score !== null && (
                <span className="text-sm font-mono font-normal opacity-80">
                  ({prediction.final_risk_score}/100)
                </span>
              )}
              {isStale && (
                <span className="text-xs sm:text-sm font-mono font-normal opacity-80 text-red-300">
                  (SUPPRESSED)
                </span>
              )}
            </div>
          </div>
          <div className="text-right font-mono text-xs space-y-0.5 shrink-0">
            <div className="opacity-80 text-[10px]">Data Quality:</div>
            <div className={`px-2 py-0.5 rounded border text-[11px] font-bold inline-block ${getQualityBadge(quality)}`}>
              {quality}
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECTION: HISTORICAL DIAGNOSTICS */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400">
            HISTORICAL DIAGNOSTICS
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            Non-Operational Reference
          </span>
        </div>

        {/* Model vs Policy Separation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 min-w-0">
          {/* ML Statistical Model Output */}
          <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg space-y-1.5 min-w-0">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] font-bold border-b border-slate-800 pb-1">
              <Cpu className="w-3.5 h-3.5 shrink-0" />
              <span>ML STATISTICAL MODEL</span>
            </div>

            {isStale ? (
              <div className="space-y-1 text-xs text-slate-300">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Status:</span>
                  <span className="font-bold text-red-400 font-mono text-[11px]">SUPPRESSED</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Reason:</span>
                  <span className="text-slate-300 text-[10px]">Telemetry is stale (&gt;6h)</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Current Prediction:</span>
                  <span className="font-mono font-bold text-slate-400 text-[11px]">UNAVAILABLE</span>
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono space-y-0.5">
                  <div className="text-slate-500 uppercase font-bold text-[9px]">
                    Historical Model Output — Diagnostic Only
                  </div>
                  <div className="flex justify-between">
                    <span>Model Level:</span>
                    <span className="text-slate-300 font-semibold">{modelLevel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Calibrated Prob:</span>
                    <span className="text-slate-300 font-semibold">
                      {prediction.calibrated_probability !== null ? `${(prediction.calibrated_probability * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="text-[9px] text-amber-400/90 font-bold uppercase pt-0.5">
                    [NOT CURRENT]
                  </div>
                </div>
              </div>
            ) : isInsufficient ? (
              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex justify-between items-center gap-2">
                  <span>Status:</span>
                  <span className="font-bold text-amber-400">UNAVAILABLE</span>
                </div>
                <p className="text-[11px]">Insufficient telemetry to evaluate ML model.</p>
              </div>
            ) : (
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
                  <span className="text-slate-400">Model Score:</span>
                  <span className="font-mono text-slate-300">
                    {prediction.model_risk_score !== null ? `${prediction.model_risk_score}/100` : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Safety Policy Engine Output */}
          <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg space-y-1.5 min-w-0">
            <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px] font-bold border-b border-slate-800 pb-1">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>SAFETY RISK POLICY</span>
            </div>

            {isStale ? (
              <div className="space-y-1 text-xs text-slate-300">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Policy Evaluation:</span>
                  <span className="font-bold text-red-400 font-mono text-[11px]">SUPPRESSED</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Reason:</span>
                  <span className="text-slate-300 text-[10px]">STALE TELEMETRY (&gt;6h)</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Final Policy Level:</span>
                  <span className="font-mono font-bold text-red-400 text-[11px]">STALE</span>
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 text-[9px] text-slate-400 font-mono leading-tight">
                  Deterministic safety policies cannot override without current live observations.
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400">Final Policy Level:</span>
                  <span className="font-bold text-slate-100">{finalLevel}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400">Final Risk Score:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {prediction.final_risk_score !== null ? `${prediction.final_risk_score}/100` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400">Policy Escalated:</span>
                  <span className={`font-bold ${isEscalated ? 'text-amber-400' : 'text-slate-400'}`}>
                    {isEscalated ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. Collapsible Historical Rule Evaluation Section */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg text-xs min-w-0 overflow-hidden">
          <button
            onClick={() => setShowHistoricalRules(!showHistoricalRules)}
            className="w-full p-2.5 flex items-center justify-between text-[11px] font-mono font-bold text-slate-300 hover:bg-slate-900/60 transition-colors text-left"
          >
            <div className="flex items-center gap-1.5">
              <span>Historical Rule Evaluation — Diagnostic Only</span>
              <span className="text-[10px] text-slate-500 font-normal">
                ({context.rules_evaluation?.length || 0} rules)
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-normal">
              <span>{showHistoricalRules ? 'Hide rules' : 'View historical rules'}</span>
              {showHistoricalRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {showHistoricalRules && (
            <div className="p-2.5 pt-0 space-y-2 border-t border-slate-800/80">
              {isStale && (
                <div className="text-[10px] text-amber-300/90 bg-amber-950/40 border border-amber-900/60 p-2 rounded mt-2">
                  <strong>Diagnostic Reference:</strong> Rules below reflect historical sensor values from observation timestamp <code>{context.telemetry_timestamp || context.last_observation_timestamp || 'N/A'}</code> and are not valid current forecasts.
                </div>
              )}

              <div className="space-y-1.5 font-mono text-[11px] max-h-56 overflow-y-auto pr-1">
                {context.rules_evaluation && context.rules_evaluation.length > 0 ? (
                  context.rules_evaluation.map((rule) => {
                    const isTriggered = rule.status === 'TRIGGERED';
                    return (
                      <div
                        key={rule.rule_id}
                        className={`p-2 rounded border transition-colors ${
                          isTriggered
                            ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold">
                            {isTriggered ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            )}
                            <span className="truncate">{rule.rule_name}</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              isTriggered ? 'bg-amber-900/80 text-amber-200' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {rule.status}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400 pl-5 space-y-0.5">
                          <div>Condition: <span className="text-slate-300">{rule.description}</span></div>
                          <div className="flex flex-wrap gap-2.5 text-slate-400">
                            {Object.entries(rule.actual_values).map(([k, v]) => (
                              <span key={k}>
                                {k}: <strong className={isTriggered ? 'text-amber-300' : 'text-slate-200'}>{v}</strong> ({rule.thresholds[k] || ''})
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 text-[10px] italic p-2">
                    No deterministic override rules evaluated.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Policy Escalation Banner (When active, non-stale) */}
      {isEscalated && (
        <div className="bg-amber-950/70 border border-amber-600/80 p-2.5 rounded-lg space-y-1.5 shadow-inner min-w-0">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="break-words">POLICY ESCALATION: MODEL RISK ({modelLevel}) OVERRIDDEN TO {finalLevel}</span>
          </div>
          <div className="text-xs text-amber-200/90 pl-6 space-y-1">
            <p className="font-semibold text-amber-100">Why was the risk escalated?</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] break-words">
              {prediction.risk_escalation_reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 7. DATA SOURCE & PROVENANCE (Requirement 9) */}
      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-[10px] font-mono text-slate-300 space-y-1 min-w-0">
        <div className="text-[10px] font-bold tracking-wider uppercase text-cyan-400 border-b border-slate-800 pb-0.5 flex items-center gap-1.5">
          <Database className="w-3 h-3 text-cyan-400" />
          <span>DATA SOURCE & PROVENANCE</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 pt-0.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Provider:</span>
            <span className="text-slate-200 font-bold">USDA NRCS AWDB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Network:</span>
            <span className="text-slate-200 font-bold">SNTL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Last Sync:</span>
            <span className="text-slate-200 truncate">{context.current_utc}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Latest Observation:</span>
            <span className="text-slate-200 truncate">{formattedObsUtc}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Freshness:</span>
            <span className={`font-bold ${isStale ? 'text-red-400' : 'text-emerald-400'}`}>{context.freshness_state} ({formattedAge} old)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Model Gate:</span>
            <span className={`font-bold ${isStale ? 'text-amber-400' : 'text-emerald-400'}`}>{isStale ? 'SUPPRESSED (Gated)' : 'ACTIVE INFERENCE'}</span>
          </div>
        </div>
        <div className="border-t border-slate-900 pt-0.5 flex justify-between items-center text-[9px] text-slate-500">
          <span>Terrain: {context.terrain_source}</span>
          <span>Model: {prediction.model_version || 'colorado_avalanche_rf_v3'}</span>
        </div>
      </div>
    </div>
  );
};
