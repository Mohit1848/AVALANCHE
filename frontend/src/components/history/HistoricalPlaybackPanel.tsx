import React, { useState } from 'react';
import { PlayCircle, RotateCcw, Cpu } from 'lucide-react';
import type { RiskPredictionResponse } from '../../types';
import { api } from '../../services/api';

export const HistoricalPlaybackPanel: React.FC = () => {
  const [selectedStormCase, setSelectedStormCase] = useState<string>('BERTHOUD_2024');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [playbackResult, setPlaybackResult] = useState<RiskPredictionResponse | null>(null);

  const stormCases = [
    {
      id: 'BERTHOUD_2024',
      title: 'January 14–16, 2024: Berthoud Pass Heavy Slab Cycle',
      zone: 'Front Range Corridor',
      station: 'SNTL-335 (Berthoud Summit)',
      date: '2024-01-15T12:00:00Z',
      slope: 39.0,
      aspect: 45.0,
      elevation: 3444.0,
      temp: -8.5,
      snow_depth: 165.0,
      swe: 280.0,
      snowfall_6h: 12.0,
      snowfall_24h: 38.0,
      snowfall_72h: 58.0,
      temp_delta: -4.0,
      wind_mean: 28.0,
      wind_max: 65.0,
      historical_outcome: 'Confirmed CAIC D2.5 Hard Slab Avalanche on leeward aspect.',
    },
    {
      id: 'LOVELAND_2023',
      title: 'February 22–24, 2023: Loveland Basin Wind Loading Event',
      zone: 'Front Range / Loveland Pass',
      station: 'SNTL-586 (Loveland Basin)',
      date: '2023-02-23T18:00:00Z',
      slope: 38.0,
      aspect: 90.0,
      elevation: 3475.0,
      temp: -12.0,
      snow_depth: 140.0,
      swe: 215.0,
      snowfall_6h: 8.0,
      snowfall_24h: 26.0,
      snowfall_72h: 42.0,
      temp_delta: -6.0,
      wind_mean: 34.0,
      wind_max: 78.0,
      historical_outcome: 'Confirmed CAIC D2 Soft Slab Avalanche triggered on steep easterly slope.',
    },
    {
      id: 'RED_MOUNTAIN_2022',
      title: 'December 28–30, 2022: San Juan Heavy Atmospheric River Cycle',
      zone: 'San Juan Mountains',
      station: 'SNTL-709 (Red Mountain Pass)',
      date: '2022-12-29T15:00:00Z',
      slope: 41.0,
      aspect: 90.0,
      elevation: 3414.0,
      temp: -4.0,
      snow_depth: 195.0,
      swe: 340.0,
      snowfall_6h: 15.0,
      snowfall_24h: 45.0,
      snowfall_72h: 75.0,
      temp_delta: +2.0,
      wind_mean: 26.0,
      wind_max: 55.0,
      historical_outcome: 'Widespread D3 Natural Avalanche Cycle across Million Dollar Highway corridor.',
    },
  ];

  const currentCase = stormCases.find((c) => c.id === selectedStormCase) || stormCases[0];

  const handleRunPlayback = async () => {
    setIsLoading(true);
    try {
      const pred = await api.predictPoint({
        latitude: 39.798,
        longitude: -105.778,
        elevation: currentCase.elevation,
        slope: currentCase.slope,
        aspect: currentCase.aspect,
        temperature: currentCase.temp,
        snow_depth: currentCase.snow_depth,
        snow_water_equivalent: currentCase.swe,
        snowfall_6h: currentCase.snowfall_6h,
        snowfall_24h: currentCase.snowfall_24h,
        snowfall_72h: currentCase.snowfall_72h,
        temperature_delta_24h: currentCase.temp_delta,
        wind_speed_mean_24h: currentCase.wind_mean,
        wind_speed_max_24h: currentCase.wind_max,
        location_id: currentCase.station,
      });
      setPlaybackResult(pred);
    } catch (err) {
      console.error('Playback error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto p-4 text-slate-100 font-sans">
      {/* 1. Header with Clear Non-Forecast Labeling */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold uppercase">
            <PlayCircle className="w-4 h-4" />
            HISTORICAL RISK PLAYBACK & COUNTERFACTUAL RECONSTRUCTION
          </div>
          <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-bold">
            HISTORICAL RECONSTRUCTION • NOT A LIVE FORECAST
          </span>
        </div>
        <h2 className="text-xl font-bold text-white">
          Colorado Multi-Season Storm Cycle Historical Playback
        </h2>
        <p className="text-xs text-slate-400">
          Reconstructs meteorological observations and telemetry features from confirmed historical avalanche cycles to evaluate model behavior and deterministic escalation responses.
        </p>
      </div>

      {/* 2. Storm Case Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {stormCases.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedStormCase(c.id);
              setPlaybackResult(null);
            }}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedStormCase === c.id
                ? 'bg-purple-950/70 border-purple-600 text-white shadow-lg'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold text-xs text-slate-100">{c.title}</div>
            <div className="text-[11px] text-purple-300 font-mono mt-1">{c.station}</div>
            <div className="text-[10px] text-slate-400 mt-2 line-clamp-2">{c.historical_outcome}</div>
          </button>
        ))}
      </div>

      {/* 3. Reconstructed Conditions Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase">
              RECONSTRUCTED SPATIOTEMPORAL CONDITIONS
            </div>
            <div className="text-sm font-bold text-slate-100">{currentCase.title}</div>
          </div>
          <button
            onClick={handleRunPlayback}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md font-mono"
          >
            {isLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
            Run Historical Reconstruction
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[10px]">Slope Angle Heuristic</div>
            <div className="text-base font-bold text-slate-100">{currentCase.slope}°</div>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[10px]">24h Storm Snowfall</div>
            <div className="text-base font-bold text-amber-300">{currentCase.snowfall_24h} mm SWE</div>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[10px]">72h Storm Cycle Load</div>
            <div className="text-base font-bold text-amber-300">{currentCase.snowfall_72h} mm SWE</div>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="text-slate-400 text-[10px]">Peak 24h Gust</div>
            <div className="text-base font-bold text-slate-100">{currentCase.wind_max} km/h</div>
          </div>
        </div>
      </div>

      {/* 4. Playback Result */}
      {playbackResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold font-mono uppercase text-slate-200">
                HISTORICAL RECONSTRUCTION PREDICTION RESULT
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
              Reconstructed: {currentCase.date}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Model Calibrated Probability</div>
              <div className="text-2xl font-bold font-mono text-cyan-300">
                {(playbackResult.calibrated_probability! * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-400">Model Risk Level: {playbackResult.model_risk_level}</div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
              <div className="text-xs text-slate-400">Final Evaluated Risk Level</div>
              <div className={`text-2xl font-bold font-mono ${
                playbackResult.final_risk_level === 'HIGH' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {playbackResult.final_risk_level}
              </div>
              <div className="text-[11px] text-slate-400">Policy Escalated: {playbackResult.risk_escalated ? 'YES' : 'NO'}</div>
            </div>
          </div>

          {playbackResult.risk_escalation_reasons.length > 0 && (
            <div className="bg-amber-950/70 border border-amber-800 p-3 rounded-lg text-xs space-y-1">
              <div className="font-bold text-amber-300">Deterministic Safety Policy Escalations:</div>
              <ul className="list-disc pl-4 text-amber-200/90 text-[11px]">
                {playbackResult.risk_escalation_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
