import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  return (
    <div className="bg-amber-950/40 border-b border-amber-900/60 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          <strong className="font-semibold text-amber-200">RESEARCH DECISION-SUPPORT PROTOTYPE:</strong> This system is for scientific modeling and situational awareness. It is <strong>NOT</strong> a certified operational avalanche warning authority. Always consult official CAIC / regional forecast bulletins.
        </span>
      </div>
      <span className="font-mono text-[10px] bg-amber-900/40 border border-amber-700/50 px-1.5 py-0.5 rounded text-amber-300 hidden md:inline">
        NON-AUTONOMOUS
      </span>
    </div>
  );
};
