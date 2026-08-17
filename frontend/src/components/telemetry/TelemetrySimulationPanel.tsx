import React, { useState } from 'react';
import { Radio, Play, AlertTriangle, ShieldCheck, RefreshCw, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { SnotelStation, StationTelemetryBatchRequest, TelemetryObservation, RiskPredictionResponse } from '../../types';
import { api } from '../../services/api';

interface TelemetrySimulationPanelProps {
  stations: SnotelStation[];
  onTelemetryPrediction: (pred: RiskPredictionResponse) => void;
}

export const TelemetrySimulationPanel: React.FC<TelemetrySimulationPanelProps> = ({
  stations,
  onTelemetryPrediction,
}) => {
  const [selectedStationId, setSelectedStationId] = useState<string>('586'); // Loveland Basin default
  const [simulationMode, setSimulationMode] = useState<'COMPLETE_72H' | 'DEGRADED_12H' | 'MISSING_CRITICAL'>('COMPLETE_72H');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [lastTelemetryResponse, setLastTelemetryResponse] = useState<RiskPredictionResponse | null>(null);

  // Generate synthetic telemetry buffer for simulation visualization
  const generateTelemetryBuffer = (mode: 'COMPLETE_72H' | 'DEGRADED_12H' | 'MISSING_CRITICAL'): TelemetryObservation[] => {
    const observations: TelemetryObservation[] = [];
    const hours = mode === 'DEGRADED_12H' ? 12 : 72;
    const now = new Date('2024-01-15T12:00:00Z');

    for (let h = hours; h >= 0; h -= 6) {
      const ts = new Date(now.getTime() - h * 3600 * 1000).toISOString();
      const progress = (hours - h) / hours;

      if (mode === 'MISSING_CRITICAL') {
        observations.push({
          timestamp: ts,
          temperature: undefined, // Missing critical temperature
          snow_depth: undefined,
        });
      } else {
        observations.push({
          timestamp: ts,
          temperature: Number((-10.0 + progress * 4.5).toFixed(1)),
          snow_depth: Number((110.0 + progress * 25.0).toFixed(1)),
          snow_water_equivalent: Number((180.0 + progress * 40.0).toFixed(1)),
          precipitation: Number((progress * 4.0).toFixed(1)),
          wind_speed: Number((15.0 + progress * 15.0).toFixed(1)),
        });
      }
    }
    return observations;
  };

  const currentStation = stations.find((s) => s.station_id === selectedStationId) || stations[0] || {
    station_id: '586',
    name: 'Loveland Basin',
    latitude: 39.6739,
    longitude: -105.8972,
    elevation_m: 3475.0,
    zone: 'Front Range',
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const observations = generateTelemetryBuffer(simulationMode);
      const req: StationTelemetryBatchRequest = {
        station_id: currentStation.station_id,
        station_name: currentStation.name,
        latitude: currentStation.latitude,
        longitude: currentStation.longitude,
        elevation: currentStation.elevation ?? currentStation.elevation_m ?? 3450,
        default_slope: 38.0,
        default_aspect: 45.0,
        observations,
      };

      const res = await api.predictTelemetry(req);
      setLastTelemetryResponse(res);
      onTelemetryPrediction(res);
    } catch (err: any) {
      console.error('Telemetry simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Format chart data
  const chartData = generateTelemetryBuffer(simulationMode)
    .filter((o) => o.temperature !== undefined)
    .map((o) => ({
      time: o.timestamp.slice(11, 16),
      temp: o.temperature,
      snow: o.snow_depth,
      wind: o.wind_speed,
    }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 space-y-4 font-sans text-slate-100">
      {/* 1. Header & Replay Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-950 p-1.5 rounded-lg border border-emerald-700 text-emerald-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono uppercase text-slate-200">
              SNOTEL TIME-SERIES TELEMETRY STREAM SIMULATOR
            </h3>
            <p className="text-[11px] text-slate-400">
              Replays continuous meteorological telemetry into the backend feature engine (POST /predict/telemetry)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-mono"
          >
            {stations.map((st) => (
              <option key={st.station_id} value={st.station_id}>
                SNTL-{st.station_id}: {st.name} ({st.elevation ?? st.elevation_m ?? 3450}m)
              </option>
            ))}
          </select>

          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md font-mono"
          >
            {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Stream Telemetry
          </button>
        </div>
      </div>

      {/* 2. Simulation Scenario Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
        <button
          onClick={() => setSimulationMode('COMPLETE_72H')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            simulationMode === 'COMPLETE_72H'
              ? 'bg-emerald-950/70 border-emerald-600 text-emerald-200 shadow-md'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Full 72h Storm Cycle
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Coverage: Complete (GOOD). Computes accurate 6h, 24h, 72h deltas.
          </div>
        </button>

        <button
          onClick={() => setSimulationMode('DEGRADED_12H')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            simulationMode === 'DEGRADED_12H'
              ? 'bg-amber-950/70 border-amber-600 text-amber-200 shadow-md'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="font-bold flex items-center gap-1 text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Short 12h Telemetry Buffer
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Coverage: DEGRADED. Triggers coverage warnings for missing 72h window.
          </div>
        </button>

        <button
          onClick={() => setSimulationMode('MISSING_CRITICAL')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            simulationMode === 'MISSING_CRITICAL'
              ? 'bg-red-950/70 border-red-600 text-red-200 shadow-md'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="font-bold flex items-center gap-1 text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            Missing Critical Sensor
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Coverage: INSUFFICIENT. Demonstrates fail-safe null risk output.
          </div>
        </button>
      </div>

      {/* 3. Recharts Time-Series Timeline */}
      {chartData.length > 0 && (
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
              Backward-Looking Observation Timeline (Historical T ≤ T_target)
            </span>
            <div className="flex gap-4 text-[10px]">
              <span className="text-cyan-400">● Temperature (°C)</span>
              <span className="text-emerald-400">● Snow Depth (cm)</span>
              <span className="text-amber-400">● Wind Speed (km/h)</span>
            </div>
          </div>

          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} name="Air Temp (°C)" />
                <Line type="monotone" dataKey="snow" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} name="Snow Depth (cm)" />
                <Line type="monotone" dataKey="wind" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="Wind Speed (km/h)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Stream Evaluation Status Badge */}
      {lastTelemetryResponse && (
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Stream Prediction Result:</span>
            <span className={`px-2 py-0.5 rounded font-bold ${
              lastTelemetryResponse.final_risk_level === 'HIGH' ? 'bg-red-950 text-red-300 border border-red-800' :
              lastTelemetryResponse.final_risk_level === 'MEDIUM' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
              lastTelemetryResponse.final_risk_level === 'LOW' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
              'bg-slate-800 text-slate-300'
            }`}>
              {lastTelemetryResponse.final_risk_level}
            </span>
            <span className="text-slate-400">Quality: <strong className="text-slate-200">{lastTelemetryResponse.data_quality}</strong></span>
          </div>

          <div className="text-[11px] text-cyan-400">
            Calibrated Prob: {lastTelemetryResponse.calibrated_probability !== null ? `${(lastTelemetryResponse.calibrated_probability * 100).toFixed(1)}%` : 'N/A'}
          </div>
        </div>
      )}
    </div>
  );
};
