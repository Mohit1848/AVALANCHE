import React, { useState } from 'react';
import { Mountain, Upload, ChevronDown, Check, ShieldCheck } from 'lucide-react';
import type { HealthStatus, TelemetryFreshnessStatus, GeographicDomain } from '../../types';
import { formatTelemetryAge } from '../../utils/formatters';
import { NavigationTabs, type TabKey } from './NavigationTabs';
export type { TabKey };

interface HeaderProps {
  health?: HealthStatus | null;
  freshness?: TelemetryFreshnessStatus | null;
  activeTab?: TabKey;
  setActiveTab?: (tab: TabKey) => void;
  activePassCount?: number;
  selectedDomain?: GeographicDomain;
  setSelectedDomain?: (d: GeographicDomain) => void;
  onOpenUploadModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  freshness,
  activeTab = 'console',
  setActiveTab,
  activePassCount = 8,
  selectedDomain = 'COLORADO',
  setSelectedDomain,
  onOpenUploadModal,
}) => {
  const [showDomainMenu, setShowDomainMenu] = useState(false);

  const rawFreshness = (freshness?.overall_status ?? '').toUpperCase();
  const ageMinutes = freshness?.age_minutes ?? 18;
  const formattedAge = formatTelemetryAge(ageMinutes);

  const isLive = rawFreshness === 'GOOD' || (!rawFreshness && ageMinutes <= 120);
  const isDegraded = rawFreshness === 'DEGRADED' || (ageMinutes > 120 && ageMinutes <= 360);
  const isStale = rawFreshness === 'STALE' || ageMinutes > 360;

  const telemetryStatusLabel = isStale ? 'STALE' : isDegraded ? 'DEGRADED' : 'LIVE';
  const telemetryColor = isStale ? '#ef4444' : isDegraded ? '#f59e0b' : '#10b981';

  const apiOnline = health ? health.status === 'ok' : true;

  const handleDomainSelect = (d: GeographicDomain) => {
    if (setSelectedDomain) {
      setSelectedDomain(d);
    }
    setShowDomainMenu(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0b101b] border-b border-[#1e293b] shadow-md font-sans">
      {/* 1. Top Header Row: Identity · Domain · Telemetry · Health · Upload */}
      <div className="max-w-[1920px] mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] shrink-0">
            <Mountain className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base text-slate-100 tracking-tight leading-none uppercase truncate-safe">
                MOUNTAIN RISK INTELLIGENCE
              </h1>
              <span className="sr-only">AVALANCHE RISK INTELLIGENCE</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase mt-0.5">
              RESEARCH DECISION-SUPPORT SYSTEM
            </div>
          </div>
        </div>

        {/* Center: Domain Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDomainMenu((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors shadow-inner"
            aria-label="Select Geographic Domain"
            aria-expanded={showDomainMenu}
          >
            <span className="text-slate-500 font-bold">DOMAIN</span>
            <span className="text-slate-200 font-semibold">
              {selectedDomain === 'COLORADO' ? 'COLORADO • MODEL ENABLED' : 'HIMALAYA • RESEARCH ONLY'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showDomainMenu && (
            <div className="absolute top-10 left-0 w-64 p-1.5 rounded-lg bg-slate-900 border border-slate-700 shadow-2xl backdrop-blur-md space-y-1 z-50 text-xs font-mono motion-fade">
              <button
                type="button"
                onClick={() => handleDomainSelect('COLORADO')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left ${
                  selectedDomain === 'COLORADO' ? 'bg-cyan-950/60 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div>Colorado Rockies (US)</div>
                  <div className="text-[10px] text-emerald-400">ML Model Active (AWDB / SNOTEL)</div>
                </div>
                {selectedDomain === 'COLORADO' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>

              <button
                type="button"
                onClick={() => handleDomainSelect('INDIA')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left ${
                  selectedDomain === 'INDIA' ? 'bg-amber-950/60 text-amber-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div>Indian Himalayas (Asia)</div>
                  <div className="text-[10px] text-amber-400">Research Only (Inference Disabled)</div>
                </div>
                {selectedDomain === 'INDIA' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            </div>
          )}
        </div>

        {/* Right: Telemetry · Source · Health · Upload */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono">
          {/* Telemetry Status */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold hidden sm:inline">TELEMETRY</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
              <span
                className={`w-2 h-2 rounded-full ${isLive ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: telemetryColor }}
              />
              <span className="font-bold" style={{ color: telemetryColor }}>
                {telemetryStatusLabel}
              </span>
              <span className="text-slate-400 text-[10px] hidden md:inline">
                • {formattedAge} ago
              </span>
            </div>
          </div>

          {/* Source Status */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold">SOURCE</span>
            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <span className="font-bold text-slate-200">NRCS AWDB</span>
              <span className="text-slate-500 text-[10px] ml-1.5">SNTL Network</span>
            </div>
          </div>

          {/* System Health */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
            <ShieldCheck className={`w-3.5 h-3.5 ${apiOnline ? 'text-emerald-400' : 'text-red-400'}`} />
            <span className={`font-bold ${apiOnline ? 'text-emerald-300' : 'text-red-300'}`}>
              {apiOnline ? 'HEALTHY' : 'OFFLINE'}
            </span>
            <span className="text-slate-500 text-[10px] hidden xl:inline">All Systems OK</span>
          </div>

          {/* Active Pass Count */}
          <div className="text-[11px] text-emerald-400 font-semibold hidden md:inline">
            {activePassCount} Passes Active
          </div>

          {/* Upload CSV Action Button */}
          <button
            type="button"
            onClick={() => {
              if (onOpenUploadModal) {
                onOpenUploadModal();
              } else if (setActiveTab) {
                setActiveTab('custom-data');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 hover:border-cyan-400 text-xs font-bold transition-all shadow-sm"
            aria-label="Upload CSV dataset"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Secondary Navigation Tabs Row (Single Owner) */}
      <NavigationTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </header>
  );
};
