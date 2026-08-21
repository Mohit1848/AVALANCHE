import React from 'react';
import { FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EvaluatedPointRecord } from '../../types';

interface DatasetContextBarProps {
  filename: string;
  records: EvaluatedPointRecord[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  regionFilter: 'ALL' | 'HIMALAYAS' | 'ALPS' | 'AMERICAS' | 'PACIFIC';
  onRegionChange: (reg: 'ALL' | 'HIMALAYAS' | 'ALPS' | 'AMERICAS' | 'PACIFIC') => void;
  onOpenDataStudio: () => void;
}

export const DatasetContextBar: React.FC<DatasetContextBarProps> = ({
  filename,
  records,
  selectedIndex,
  onSelectIndex,
  regionFilter,
  onRegionChange,
  onOpenDataStudio,
}) => {
  const isRecordInRegion = (r: EvaluatedPointRecord, reg: string) => {
    if (reg === 'ALL') return true;
    const lat = r.latitude;
    const lon = r.longitude;
    if (reg === 'HIMALAYAS') return lat >= 20 && lat <= 40 && lon >= 68 && lon <= 100;
    if (reg === 'ALPS') return lat >= 42 && lat <= 49 && lon >= 4 && lon <= 17;
    if (reg === 'AMERICAS') return (lat >= 30 && lat <= 70 && lon >= -170 && lon <= -60) || (lat >= -56 && lat <= 15 && lon >= -82 && lon <= -60);
    if (reg === 'PACIFIC') return (lat >= -48 && lat <= -34 && lon >= 165 && lon <= 179) || (lat >= 30 && lat <= 46 && lon >= 128 && lon <= 146) || (lat >= 40 && lat <= 45 && lon >= 38 && lon <= 50) || (lat >= 58 && lat <= 72 && lon >= 5 && lon <= 30);
    return true;
  };

  const filteredRecords = records.filter((r) => isRecordInRegion(r, regionFilter));

  const regionTabs = [
    { key: 'ALL', label: `ALL (${records.length})` },
    { key: 'HIMALAYAS', label: 'HIMALAYAS & ASIA' },
    { key: 'ALPS', label: 'EUROPEAN ALPS' },
    { key: 'AMERICAS', label: 'AMERICAS' },
    { key: 'PACIFIC', label: 'JAPAN / NZ / SCANDINAVIA' },
  ] as const;

  return (
    <div className="bg-[#090e18] border-b border-[#1e293b] px-3 sm:px-5 py-2 font-mono text-xs shadow-inner">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Left: Dataset name and Prev / Next Controls */}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-[10px] text-slate-500 font-bold uppercase">DATASET</span>
            <span className="font-semibold text-slate-200 truncate-safe max-w-[200px] sm:max-w-[260px]">
              {filename}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
              disabled={selectedIndex <= 0}
              className="px-2 py-1 rounded bg-slate-950 text-slate-300 hover:text-cyan-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
              aria-label="Previous mountain location"
            >
              <ChevronLeft className="w-3 h-3" />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <span className="px-2 text-cyan-400 font-bold tabular-nums">
              {records.length > 0 ? selectedIndex + 1 : 0} / {records.length}
            </span>
            <button
              type="button"
              onClick={() => onSelectIndex(Math.min(records.length - 1, selectedIndex + 1))}
              disabled={selectedIndex >= records.length - 1}
              className="px-2 py-1 rounded bg-slate-950 text-slate-300 hover:text-cyan-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
              aria-label="Next mountain location"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Location Selector Dropdown */}
          <select
            value={selectedIndex}
            onChange={(e) => onSelectIndex(parseInt(e.target.value, 10))}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-cyan-500 max-w-[240px] truncate-safe"
            aria-label="Select mountain location"
          >
            {filteredRecords.map((r) => {
              const actualIdx = records.findIndex((item) => item.id === r.id);
              return (
                <option key={r.id} value={actualIdx}>
                  {actualIdx + 1}. {r.location_id} ({r.prediction?.final_risk_level ?? 'CALC'})
                </option>
              );
            })}
          </select>
        </div>

        {/* Right: Region Filters */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by region">
            {regionTabs.map((tab) => {
              const isActive = regionFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onRegionChange(tab.key as any)}
                  aria-pressed={isActive}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenDataStudio}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 text-xs font-bold shrink-0 ml-1"
          >
            Upload / Presets
          </button>
        </div>
      </div>
    </div>
  );
};
