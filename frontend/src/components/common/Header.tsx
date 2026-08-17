import React from 'react';
import { Shield, Activity, Cpu, Radio, Clock } from 'lucide-react';
import type { HealthStatus, TelemetryFreshnessStatus, GeographicDomain } from '../../types';

interface HeaderProps {
  health: HealthStatus | null;
  freshness: TelemetryFreshnessStatus | null;
  activeTab: 'console' | 'spatial' | 'history' | 'playback' | 'research';
  setActiveTab: (tab: 'console' | 'spatial' | 'history' | 'playback' | 'research') => void;
  isLivePolling: boolean;
  setIsLivePolling: (v: boolean) => void;
  selectedDomain: GeographicDomain;
  setSelectedDomain: (d: GeographicDomain) => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  freshness,
  activeTab,
  setActiveTab,
  isLivePolling,
  setIsLivePolling,
  selectedDomain,
  setSelectedDomain,
}) => {
  const isOnline = health?.status === 'ok' || health?.status === 'degraded';
  const isModelLoaded = health?.model_loaded ?? false;
  const telStatus = freshness?.overall_status || 'GOOD';
  const ageMin = freshness?.age_minutes ?? health?.telemetry_age_minutes ?? 38;

  const getTelemetryBadgeColor = (st: string) => {
    switch (st) {
      case 'GOOD':
        return 'bg-emerald-950/60 border-emerald-800 text-emerald-300';
      case 'DEGRADED':
        return 'bg-amber-950/60 border-amber-800 text-amber-300';
      case 'STALE':
        return 'bg-red-950/60 border-red-800 text-red-300 animate-pulse';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  const isIndia = selectedDomain === 'INDIA';

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2.5 text-slate-100 flex flex-wrap items-center justify-between gap-3 shadow-lg sticky top-0 z-30 font-sans min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`bg-gradient-to-br ${isIndia ? 'from-amber-500 to-orange-600 shadow-amber-500/20' : 'from-cyan-500 to-blue-600 shadow-cyan-500/20'} p-2 rounded-lg text-white shadow-md shrink-0 transition-colors`}>
          <Shield className="w-5 sm:w-6 h-5 sm:h-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2 truncate">
              <span>AVALANCHE RISK INTELLIGENCE</span>
              <span className={`text-[10px] sm:text-xs font-mono font-normal ${isIndia ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-cyan-950 text-cyan-400 border-cyan-800'} border px-1.5 sm:px-2 py-0.5 rounded shrink-0`}>
                {isIndia ? 'HIMALAYAN GEOGRAPHY' : 'RESEARCH v2.0'}
              </span>
            </h1>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 truncate">
            {isIndia
              ? 'Himalayan Geographic Decision-Support Console • Northern India Peak Catalog'
              : 'Spatiotemporal Decision-Support Console • Colorado Rocky Mountains'}
          </p>
        </div>
      </div>

      {/* Geographic Region Selector */}
      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono gap-2 shrink-0">
        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">REGION:</span>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value as GeographicDomain)}
          className="bg-slate-900 text-cyan-300 font-bold border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
          aria-label="Geographic Region Selector"
        >
          <option value="COLORADO">Colorado (Alpine Model Enabled)</option>
          <option value="INDIA">Indian Himalayas (Geographic Catalog)</option>
        </select>
      </div>


      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center bg-slate-950 border border-slate-800 p-1 rounded-lg gap-0.5 min-w-0">
        <button
          onClick={() => setActiveTab('console')}
          className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'console'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Risk Console
        </button>
        <button
          onClick={() => setActiveTab('spatial')}
          className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'spatial'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Spatial Intelligence
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'history'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Risk History
        </button>
        <button
          onClick={() => setActiveTab('playback')}
          className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'playback'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Historical Playback
        </button>
        <button
          onClick={() => setActiveTab('research')}
          className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all shrink-0 ${
            activeTab === 'research'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Model Evaluation
        </button>
      </div>

      {/* Subsystem Health & Freshness Indicators */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs min-w-0">
        {/* Live Research Toggle */}
        <button
          onClick={() => setIsLivePolling(!isLivePolling)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-bold transition-all shrink-0 ${
            isLivePolling
              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950'
              : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isLivePolling ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`}></span>
          <span>LIVE MODE</span>
        </button>

        {/* API */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border shrink-0 ${
          isOnline ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-red-950/60 border-red-800 text-red-300'
        }`}>
          <Activity className="w-3.5 h-3.5" />
          <span>API: {isOnline ? 'ONLINE' : 'UNREACHABLE'}</span>
        </div>

        {/* MODEL */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border shrink-0 ${
          isModelLoaded ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300' : 'bg-amber-950/60 border-amber-800 text-amber-300'
        }`}>
          <Cpu className="w-3.5 h-3.5" />
          <span>MODEL: {isModelLoaded ? 'LOADED' : 'DEGRADED'}</span>
        </div>

        {/* TELEMETRY FRESHNESS */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border shrink-0 ${getTelemetryBadgeColor(telStatus)}`}>
          <Radio className="w-3.5 h-3.5" />
          <span>TELEMETRY: {telStatus}</span>
        </div>

        {/* TELEMETRY AGE */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] shrink-0">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Age: {ageMin}m</span>
        </div>
      </div>
    </header>
  );
};
