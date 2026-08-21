import React from 'react';
import { Shield, FileSpreadsheet, TrendingUp, AlertOctagon, Layers, Upload } from 'lucide-react';
import type { HealthStatus, TelemetryFreshnessStatus } from '../../types';

interface HeaderProps {
  health?: HealthStatus | null;
  freshness?: TelemetryFreshnessStatus | null;
  activeTab: 'console' | 'custom-data' | 'analytics' | 'advisories';
  setActiveTab: (tab: 'console' | 'custom-data' | 'analytics' | 'advisories') => void;
  activePassCount?: number;
  isLivePolling?: boolean;
  setIsLivePolling?: (v: boolean) => void;
  selectedDomain?: string;
  setSelectedDomain?: (d: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activePassCount = 8,
}) => {

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-3.5 sm:px-5 py-2.5 text-slate-100 flex flex-wrap items-center justify-between gap-3 shadow-lg sticky top-0 z-30 font-sans min-w-0">
      {/* Brand & System Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl text-white shadow-md shadow-cyan-500/20 shrink-0">
          <Shield className="w-5 sm:w-6 h-5 sm:h-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2 truncate">
              <span>AVALANCHE RISK INTELLIGENCE</span>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded shrink-0">
                OPERATIONAL OS
              </span>
            </h1>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 truncate">
            Real-Time Mountain Hazard Decision Support & GIS Snowpack Intelligence
          </p>
        </div>
      </div>

      {/* Main Real-World Operational Navigation Tabs */}
      <div className="flex flex-wrap items-center bg-slate-950 border border-slate-800 p-1 rounded-xl gap-1 min-w-0 shadow-inner">
        <button
          onClick={() => setActiveTab('console')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'console'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Operations Console</span>
        </button>

        <button
          onClick={() => setActiveTab('custom-data')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'custom-data'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950'
              : 'text-emerald-400 hover:text-emerald-200 bg-emerald-950/30'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>CSV Data Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Snow & Weather Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('advisories')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'advisories'
              ? 'bg-red-600 text-white shadow-md shadow-red-950'
              : 'text-red-400 hover:text-red-200 bg-red-950/30'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>Safety Advisories</span>
        </button>
      </div>

      {/* Real-World Operational Status Indicators */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs shrink-0">
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-emerald-300 font-bold">{activePassCount} Passes Active</span>
        </div>

        <button
          onClick={() => setActiveTab('custom-data')}
          className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-emerald-700 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
        >
          <Upload className="w-3.5 h-3.5 text-emerald-400" />
          <span>Upload CSV</span>
        </button>
      </div>
    </header>
  );
};
