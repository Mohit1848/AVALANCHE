import React from 'react';
import { TriangleAlert, FileText } from 'lucide-react';

interface DisclaimerBannerProps {
  onOpenProvenance?: () => void;
  syncTimestamp?: string;
  modelVersion?: string;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({
  onOpenProvenance,
  syncTimestamp = '2026-05-15 10:24 UTC',
  modelVersion = 'Colorado Avalanche RF v3 (Calibrated)',
}) => {
  return (
    <footer
      className="w-full bg-[#070b12] border-t border-[#1e293b] py-3 px-3 sm:px-5 font-mono text-xs text-slate-400 min-w-0"
      data-testid="research-disclosure"
    >
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {/* ================= LEFT: RESEARCH WARNING ================= */}
        <div className="flex items-start gap-2.5 max-w-xl min-w-0">
          <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-amber-300 text-[11px] tracking-wide uppercase">
              RESEARCH DECISION-SUPPORT SYSTEM
            </div>
            <p className="text-[11px] text-slate-400 leading-snug wrap-safe">
              Not a certified public avalanche warning system. Model associations are not causal conclusions.
              Always apply professional judgment and follow local avalanche advisories.
            </p>
          </div>
        </div>

        {/* ================= CENTER: MODEL & GATING METADATA ================= */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <div>
            <span className="text-slate-500">Model: </span>
            <span className="text-slate-200 font-semibold">{modelVersion}</span>
          </div>
          <div className="hidden sm:inline text-slate-600">|</div>
          <div>
            <span className="text-slate-500">Gating: </span>
            <span className="text-emerald-400 font-semibold">MODEL ENABLED</span>
            <span className="text-slate-500"> • Data Policy: </span>
            <span className="text-slate-200 font-semibold">ZERO FALLBACK</span>
          </div>
          <div className="hidden sm:inline text-slate-600">|</div>
          <div>
            <span className="text-slate-500">Last Data Sync: </span>
            <span className="text-slate-300">{syncTimestamp}</span>
          </div>
        </div>

        {/* ================= RIGHT: DATA PROVENANCE BUTTON ================= */}
        {onOpenProvenance && (
          <button
            type="button"
            onClick={onOpenProvenance}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 text-xs font-bold transition-all shadow-sm shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>View Data Provenance</span>
          </button>
        )}
      </div>
    </footer>
  );
};
