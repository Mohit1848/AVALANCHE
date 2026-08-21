import React from 'react';
import { Layers, FileSpreadsheet, TrendingUp, AlertTriangle, History } from 'lucide-react';

export type TabKey = 'console' | 'custom-data' | 'analytics' | 'advisories' | 'history';

interface NavigationTabsProps {
  activeTab?: TabKey;
  setActiveTab?: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'console', label: 'Operations Console', icon: <Layers className="w-3.5 h-3.5" /> },
  { key: 'custom-data', label: 'CSV Data Studio', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
  { key: 'analytics', label: 'Snow & Weather Analytics', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: 'advisories', label: 'Safety Advisories', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { key: 'history', label: 'Historical Events', icon: <History className="w-3.5 h-3.5" /> },
];

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab = 'console',
  setActiveTab,
}) => {
  return (
    <nav
      className="bg-[#070b12] border-t border-[#1e293b] px-3 sm:px-5 font-mono text-xs overflow-x-auto scroll-x"
      aria-label="Primary application views"
    >
      <div className="max-w-[1920px] mx-auto flex items-center gap-1 sm:gap-3">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab?.(t.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`tap gap-2 px-3 py-2 font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${
                isActive
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span className={isActive ? 'text-cyan-400' : 'text-slate-500'}>
                {t.icon}
              </span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
