import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  CloudSnow,
  Wind,
  Thermometer,
  Mountain,
  MapPin,
  ArrowRight,
  Filter,
  Layers,
} from 'lucide-react';
import type { EvaluatedPointRecord, SelectedLocationState, RiskLevel } from '../../types';

interface SnowWeatherAnalyticsProps {
  records: EvaluatedPointRecord[];
  activeCsvFilename: string;
  onSelectLocation: (location: SelectedLocationState) => void;
  onNavigateToConsole: () => void;
}

export const SnowWeatherAnalytics: React.FC<SnowWeatherAnalyticsProps> = ({
  records,
  activeCsvFilename,
  onSelectLocation,
  onNavigateToConsole,
}) => {
  const [chartView, setChartView] = useState<'snowfall' | 'winds' | 'temperature'>('snowfall');
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  if (!records || records.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
        <CloudSnow className="w-10 h-10 text-cyan-400 mx-auto" />
        <h3 className="text-base font-bold text-white">No Mountain Dataset Loaded</h3>
        <p className="text-xs text-slate-400">
          Upload or select a CSV dataset in the CSV Data Studio to view comprehensive snow and weather analytics.
        </p>
      </div>
    );
  }

  // Compute key KPI metrics
  const heaviestSnowPass = records.reduce((max, r) =>
    (r.snowfall_24h ?? 0) > (max.snowfall_24h ?? 0) ? r : max, records[0]);

  const deepestSnowPass = records.reduce((max, r) =>
    (r.snow_depth ?? 0) > (max.snow_depth ?? 0) ? r : max, records[0]);

  const highestWindPass = records.reduce((max, r) =>
    (r.wind_speed_max_24h ?? 0) > (max.wind_speed_max_24h ?? 0) ? r : max, records[0]);

  const coldestPass = records.reduce((min, r) =>
    r.temperature < min.temperature ? r : min, records[0]);

  // Chart data format
  const chartData = records.map((r) => ({
    name: r.location_id.length > 14 ? r.location_id.slice(0, 12) + '…' : r.location_id,
    fullName: r.location_id,
    snowfall24h: r.snowfall_24h ?? 0,
    snowfall72h: r.snowfall_72h ?? 0,
    snowDepth: r.snow_depth ?? 0,
    swe: r.snow_water_equivalent ?? 0,
    maxWind: r.wind_speed_max_24h ?? 0,
    meanWind: r.wind_speed_mean_24h ?? 0,
    slope: r.slope,
    temperature: r.temperature,
    elevation: r.elevation,
    riskLevel: r.prediction?.final_risk_level ?? 'LOW',
    riskScore: r.prediction?.final_risk_score ?? 20,
  }));

  const filteredRecords = records.filter((r) =>
    filterRisk === 'ALL' || r.prediction?.final_risk_level === filterRisk
  );

  const getRiskBadgeClasses = (level?: RiskLevel) => {
    switch (level) {
      case 'HIGH':
        return 'bg-red-950 text-red-300 border-red-800';
      case 'MEDIUM':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'LOW':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

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
          <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl text-white shadow-md shadow-cyan-500/20 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2 truncate">
                <span>SNOWPACK & MOUNTAIN WEATHER ANALYTICS</span>
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded shrink-0">
                  {records.length} PASSES ANALYZED
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Dataset: <strong className="text-cyan-300 font-mono">{activeCsvFilename}</strong> • Comparative meteorological trends, storm accumulations, and wind loading profiles.
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

      {/* 2. Key Weather Highlights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase font-mono text-[10px]">Heaviest 24h Snowfall</span>
            <CloudSnow className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            {heaviestSnowPass.snowfall_24h ?? 0} <span className="text-xs font-normal text-slate-400">mm</span>
          </div>
          <div className="text-xs font-bold text-slate-200 truncate">
            {heaviestSnowPass.location_id}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase font-mono text-[10px]">Peak Wind Gust</span>
            <Wind className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-300">
            {highestWindPass.wind_speed_max_24h ?? 0} <span className="text-xs font-normal text-slate-400">km/h</span>
          </div>
          <div className="text-xs font-bold text-slate-200 truncate">
            {highestWindPass.location_id}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase font-mono text-[10px]">Deepest Snowpack</span>
            <Mountain className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-300">
            {deepestSnowPass.snow_depth ?? 0} <span className="text-xs font-normal text-slate-400">cm</span>
          </div>
          <div className="text-xs font-bold text-slate-200 truncate">
            {deepestSnowPass.location_id}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase font-mono text-[10px]">Coldest Pass Temp</span>
            <Thermometer className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-300">
            {coldestPass.temperature} <span className="text-xs font-normal text-slate-400">°C</span>
          </div>
          <div className="text-xs font-bold text-slate-200 truncate">
            {coldestPass.location_id}
          </div>
        </div>
      </div>

      {/* 3. Main Analytics Chart Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Cross-Pass Comparative Analysis
            </h3>
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-lg gap-1">
            <button
              onClick={() => setChartView('snowfall')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                chartView === 'snowfall'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Snowfall (24h vs 72h)
            </button>
            <button
              onClick={() => setChartView('winds')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                chartView === 'winds'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Winds vs Slope
            </button>
            <button
              onClick={() => setChartView('temperature')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                chartView === 'temperature'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Temp & Elevation
            </button>
          </div>
        </div>

        {/* Chart View Rendering */}
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'snowfall' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-20} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={11} unit=" mm" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="snowfall24h" name="24h Snowfall (mm)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="snowfall72h" name="72h Snowfall (mm)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chartView === 'winds' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-20} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="maxWind" name="Peak Wind Gust (km/h)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="slope" name="Slope Angle (°)" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-20} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="temperature" name="Air Temperature (°C)" stroke="#38bdf8" fill="#0284c7" fillOpacity={0.3} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Comparative Mountain Pass Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Mountain Pass Telemetry & Avalanche Risk Matrix
            </h3>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setFilterRisk('ALL')}
              className={`px-2.5 py-0.5 rounded cursor-pointer ${
                filterRisk === 'ALL' ? 'bg-cyan-600 text-white font-bold' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({records.length})
            </button>
            <button
              onClick={() => setFilterRisk('HIGH')}
              className={`px-2.5 py-0.5 rounded cursor-pointer ${
                filterRisk === 'HIGH' ? 'bg-red-600 text-white font-bold' : 'bg-slate-950 text-red-300 hover:text-red-100'
              }`}
            >
              High
            </button>
            <button
              onClick={() => setFilterRisk('MEDIUM')}
              className={`px-2.5 py-0.5 rounded cursor-pointer ${
                filterRisk === 'MEDIUM' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-950 text-amber-300 hover:text-amber-100'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => setFilterRisk('LOW')}
              className={`px-2.5 py-0.5 rounded cursor-pointer ${
                filterRisk === 'LOW' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-950 text-emerald-300 hover:text-emerald-100'
              }`}
            >
              Low
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
          <table className="w-full text-left text-xs font-mono divide-y divide-slate-800">
            <thead className="bg-slate-900 text-slate-300 uppercase text-[10px]">
              <tr>
                <th className="p-3">Mountain Pass / Station</th>
                <th className="p-3">Elevation</th>
                <th className="p-3">Slope Incline</th>
                <th className="p-3">24h Snow</th>
                <th className="p-3">72h Snow</th>
                <th className="p-3">Peak Wind</th>
                <th className="p-3">Temperature</th>
                <th className="p-3">Avalanche Risk</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="p-3 font-bold font-sans text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{r.location_id}</span>
                  </td>
                  <td className="p-3 text-slate-300">{r.elevation}m</td>
                  <td className="p-3">
                    <span className={r.slope >= 34 && r.slope <= 45 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                      {r.slope}°
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={(r.snowfall_24h ?? 0) >= 30 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                      {r.snowfall_24h ?? 0}mm
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">{r.snowfall_72h ?? 0}mm</td>
                  <td className="p-3">{r.wind_speed_max_24h ?? 0}km/h</td>
                  <td className="p-3">{r.temperature}°C</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRiskBadgeClasses(r.prediction?.final_risk_level)}`}>
                      {r.prediction?.final_risk_level ?? 'LOW'} ({r.prediction?.final_risk_score?.toFixed(0) ?? 25})
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleJumpToLocation(r)}
                      className="bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer"
                    >
                      View on Map &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
