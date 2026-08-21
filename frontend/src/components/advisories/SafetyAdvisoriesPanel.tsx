import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  ArrowRight,
  Info,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import type { EvaluatedPointRecord, SelectedLocationState } from '../../types';

interface SafetyAdvisoriesPanelProps {
  records: EvaluatedPointRecord[];
  activeCsvFilename: string;
  onSelectLocation: (location: SelectedLocationState) => void;
  onNavigateToConsole: () => void;
}

export const SafetyAdvisoriesPanel: React.FC<SafetyAdvisoriesPanelProps> = ({
  records,
  activeCsvFilename,
  onSelectLocation,
  onNavigateToConsole,
}) => {
  const highRiskPasses = records.filter((r) => r.prediction?.final_risk_level === 'HIGH');

  const handleJumpToLocation = (r: EvaluatedPointRecord) => {
    onSelectLocation({
      type: 'COORDINATE',
      name: r.location_id,
      latitude: r.latitude,
      longitude: r.longitude,
      elevation: r.elevation,
      slope: r.slope,
      aspect: r.aspect,
      temperature: r.temperature,
      snow_depth: r.snow_depth ?? 120,
      snow_water_equivalent: r.snow_water_equivalent ?? 200,
      snowfall_6h: r.snowfall_6h ?? 0,
      snowfall_24h: r.snowfall_24h ?? 15,
      snowfall_72h: r.snowfall_72h ?? 35,
      temperature_delta_24h: r.temperature_delta_24h ?? 0,
      wind_speed_mean_24h: r.wind_speed_mean_24h ?? 20,
      wind_speed_max_24h: r.wind_speed_max_24h ?? 40,
      telemetry_age_minutes: 0,
    });
    onNavigateToConsole();
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto w-full min-w-0 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-gradient-to-br from-red-500 to-amber-600 p-2.5 rounded-xl text-white shadow-md shadow-red-500/20 shrink-0">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2 truncate">
                <span>ACTIVE AVALANCHE SAFETY BULLETINS & PASS ADVISORIES</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Operational safety warnings, highway pass status, backcountry hazard levels, and mitigation advisories.
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToConsole}
          className="flex items-center gap-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
        >
          <span>View on Live Map</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Critical High Risk Alerts Feed */}
      {highRiskPasses.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-400 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>CRITICAL MOUNTAIN PASS WARNINGS ({highRiskPasses.length} ACTIVE)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {highRiskPasses.map((pass) => (
              <div
                key={pass.id}
                className="bg-gradient-to-br from-red-950/70 via-slate-900 to-slate-900 border border-red-800/80 rounded-xl p-4 space-y-3 shadow-lg relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-red-600 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded shadow-sm">
                        HIGH HAZARD
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">Score: {pass.prediction?.final_risk_score?.toFixed(0)}/100</span>
                    </div>
                    <h4 className="text-base font-bold text-white pt-1">{pass.location_id}</h4>
                    <p className="text-[11px] text-slate-300">
                      Elevation: <strong className="text-white">{pass.elevation}m</strong> • Slope: <strong className="text-red-300">{pass.slope}°</strong> • 24h Snow: <strong className="text-cyan-300">{pass.snowfall_24h ?? 0}mm</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => handleJumpToLocation(pass)}
                    className="bg-red-900/80 hover:bg-red-800 border border-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm"
                  >
                    View Map &rarr;
                  </button>
                </div>

                {/* Triggered Policy Reasons */}
                {pass.prediction?.risk_escalation_reasons && pass.prediction.risk_escalation_reasons.length > 0 && (
                  <div className="bg-red-950/90 border border-red-900 p-2.5 rounded-lg space-y-1 text-xs">
                    <span className="font-bold text-red-200 text-[11px] flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span>Physical Hazard Triggers:</span>
                    </span>
                    <ul className="space-y-0.5 text-[11px] text-red-200/90 font-mono pl-2 border-l border-red-700">
                      {pass.prediction.risk_escalation_reasons.map((r, i) => (
                        <li key={i}>&bull; {r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-[11px] text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <strong className="text-amber-300">Field Safety Directive:</strong> Large natural and human-triggered slab avalanches very likely on steep lee slopes. Backcountry travel in avalanche terrain strongly discouraged. Active highway avalanche mitigation protocol recommended.
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/30 border border-emerald-800/80 rounded-xl p-4 text-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <strong>No Critical High Risk Warnings Active:</strong> All monitored mountain passes in dataset <strong>{activeCsvFilename}</strong> are currently within Low to Moderate stability thresholds.
          </div>
        </div>
      )}

      {/* 3. Mountain Highway & Backcountry Travel Advisory Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Mountain Pass Travel & Mitigation Advisory Matrix
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {records.length} Monitored Corridors
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
          <table className="w-full text-left text-xs font-mono divide-y divide-slate-800">
            <thead className="bg-slate-900 text-slate-300 uppercase text-[10px]">
              <tr>
                <th className="p-3">Mountain Pass / Corridor</th>
                <th className="p-3">Avalanche Hazard</th>
                <th className="p-3">Primary Trigger Concern</th>
                <th className="p-3">Operational Recommendation</th>
                <th className="p-3 text-right">Map View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {records.map((r) => {
                const level = r.prediction?.final_risk_level ?? 'LOW';
                return (
                  <tr key={r.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-3 font-bold font-sans text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{r.location_id}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        level === 'HIGH' ? 'bg-red-950 text-red-300 border-red-800' :
                        level === 'MEDIUM' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                        'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                        {level} RISK ({r.prediction?.final_risk_score?.toFixed(0) ?? 25})
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 font-sans text-xs">
                      {level === 'HIGH'
                        ? 'Rapid storm snow loading & high wind slabs on steep starting zones'
                        : level === 'MEDIUM'
                        ? 'Wind-drifted snow on lee aspects; heightened hazard on specific features'
                        : 'Stable snowpack; isolated pocket hazards on extreme terrain'}
                    </td>
                    <td className="p-3 font-sans text-xs">
                      {level === 'HIGH' ? (
                        <span className="text-red-300 font-semibold">Travel discouraged • Active avalanche control</span>
                      ) : level === 'MEDIUM' ? (
                        <span className="text-amber-300 font-semibold">Heightened caution • Evaluate slope angles</span>
                      ) : (
                        <span className="text-emerald-300 font-semibold">Normal alpine travel conditions</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleJumpToLocation(r)}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer"
                      >
                        Inspect &rarr;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Public Avalanche Danger Scale Reference */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
          <Info className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            North American Public Avalanche Danger Scale Reference
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          <div className="bg-emerald-950/40 border border-emerald-800 p-3 rounded-lg space-y-1">
            <div className="flex items-center justify-between font-bold text-emerald-300">
              <span>1 - LOW</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Generally safe avalanche conditions. Watch for unstable snow on isolated features.
            </p>
          </div>

          <div className="bg-amber-950/40 border border-amber-800 p-3 rounded-lg space-y-1">
            <div className="flex items-center justify-between font-bold text-amber-300">
              <span>2 - MODERATE</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Heightened avalanche conditions on specific terrain. Evaluate snowpack carefully.
            </p>
          </div>

          <div className="bg-orange-950/40 border border-orange-800 p-3 rounded-lg space-y-1">
            <div className="flex items-center justify-between font-bold text-orange-300">
              <span>3 - CONSIDERABLE</span>
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Dangerous avalanche conditions. Careful snowpack evaluation and cautious route-finding required.
            </p>
          </div>

          <div className="bg-red-950/40 border border-red-800 p-3 rounded-lg space-y-1">
            <div className="flex items-center justify-between font-bold text-red-300">
              <span>4 - HIGH</span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Very dangerous avalanche conditions. Travel in avalanche terrain not recommended.
            </p>
          </div>

          <div className="bg-purple-950/40 border border-purple-800 p-3 rounded-lg space-y-1">
            <div className="flex items-center justify-between font-bold text-purple-300">
              <span>5 - EXTREME</span>
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Extraordinary avalanche danger. Avoid all avalanche terrain. Widespread natural avalanches.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
