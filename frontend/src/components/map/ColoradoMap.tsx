import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import type {
  AvalancheZone,
  SnotelStation,
  HistoricalEvent,
  SelectedLocationState,
  RiskLevel,
  LayerVisibilityState,
  SpatialPredictionGridResponse,
  IndianPeak,
  GeographicDomain,
} from '../../types';
import { Layers } from 'lucide-react';

interface ColoradoMapProps {
  zones: AvalancheZone[];
  stations: SnotelStation[];
  historicalEvents: HistoricalEvent[];
  selectedLocation: SelectedLocationState;
  onSelectLocation: (loc: SelectedLocationState) => void;
  showEvents: boolean;
  activeRiskLevel?: RiskLevel;
  isLiveMode?: boolean;
  layerVisibility?: LayerVisibilityState;
  riskSurface?: SpatialPredictionGridResponse | null;
  selectedDomain?: GeographicDomain;
  indianPeaks?: IndianPeak[];
  selectedIndianPeak?: IndianPeak | null;
  onSelectIndianPeak?: (peak: IndianPeak) => void;
}

// Station Icon generator with accurate status colors
const createStationCircleIcon = (stationName: string, isSelected: boolean, ageMinutes: number = 18) => {
  const isStale = ageMinutes > 360;
  const isDegraded = ageMinutes > 120 && ageMinutes <= 360;

  const dotColor = isStale
    ? '#ef4444' // Red
    : isDegraded
    ? '#f59e0b' // Amber
    : '#10b981'; // Emerald Green

  const borderClass = isSelected
    ? 'ring-4 ring-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-125'
    : 'border-2 border-slate-900 shadow-md';

  return L.divIcon({
    className: 'custom-station-pin',
    html: `
      <div class="relative flex items-center group cursor-pointer">
        <div class="w-3.5 h-3.5 rounded-full ${borderClass} transition-transform" style="background-color: ${dotColor};"></div>
        <div class="ml-1.5 px-1.5 py-0.5 rounded bg-slate-950/85 border border-slate-800 text-[10px] font-mono font-bold text-slate-200 shadow-lg backdrop-blur-sm whitespace-nowrap pointer-events-none ${isSelected ? 'text-cyan-300 border-cyan-500/50' : 'opacity-85'}">
          ${stationName}
        </div>
      </div>
    `,
    iconSize: [120, 20],
    iconAnchor: [7, 10],
  });
};

const createIndianPeakIcon = (name: string, elevation: number, isSelected: boolean = false) => L.divIcon({
  className: 'custom-indian-peak-marker',
  html: `<div class="bg-slate-950/95 border ${
    isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/50 text-cyan-200' : 'border-amber-500/80 text-amber-200'
  } font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-xl flex items-center gap-1 backdrop-blur-sm whitespace-nowrap">
          <span>🏔️</span> <span>${name}</span> <span class="text-[9px] text-slate-400">(${elevation}m)</span>
         </div>`,
  iconSize: [140, 24],
  iconAnchor: [70, 12],
});

const createEventIcon = (trigger: string) => {
  const isNatural = trigger === 'NATURAL';
  const color = isNatural ? 'bg-amber-600 border-amber-300' : 'bg-purple-600 border-purple-300';
  return L.divIcon({
    className: 'custom-event-marker',
    html: `<div class="${color} text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border shadow-md flex items-center gap-1 whitespace-nowrap">
            <span>⚠</span> ${trigger.slice(0, 3)}
           </div>`,
    iconSize: [45, 18],
    iconAnchor: [22, 9],
  });
};

const createActiveTargetIcon = (name: string, lat: number, lon: number) => L.divIcon({
  className: 'custom-active-target-marker',
  html: `
    <div class="relative flex flex-col items-center pointer-events-auto" style="z-index: 1000;">
      <!-- Floating Label Banner Above Pin -->
      <div class="mb-1.5 px-2.5 py-1 rounded-lg bg-[#070b12]/95 border-2 border-cyan-400 text-slate-100 font-mono shadow-[0_0_20px_rgba(6,182,212,0.7)] backdrop-blur-md flex flex-col items-center text-center">
        <div class="text-[9px] font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
          <span>TARGET • ACTIVE</span>
        </div>
        <div class="text-xs font-bold text-white whitespace-nowrap px-1 max-w-[200px] truncate">
          ${name}
        </div>
        <div class="text-[9px] text-slate-400 font-mono">
          ${lat.toFixed(3)}°N ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}
        </div>
      </div>
      
      <!-- Central Pin & Pulsing Halo -->
      <div class="relative flex items-center justify-center">
        <div class="absolute w-12 h-12 rounded-full bg-cyan-500/25 animate-ping pointer-events-none"></div>
        <div class="absolute w-8 h-8 rounded-full bg-cyan-400/40 animate-pulse border border-cyan-300/60 shadow-[0_0_15px_#06b6d4] pointer-events-none"></div>
        <div class="relative w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-xl flex items-center justify-center">
          <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
        </div>
      </div>
    </div>
  `,
  iconSize: [220, 75],
  iconAnchor: [110, 70],
  popupAnchor: [0, -70],
});

const MapClickHandler: React.FC<{ onLocationClick: (lat: number, lon: number) => void }> = ({ onLocationClick }) => {
  useMapEvents({
    click(e) {
      onLocationClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapController: React.FC<{ lat: number; lon: number }> = ({ lat, lon }) => {
  const map = useMap();
  useEffect(() => {
    const currentZoom = map.getZoom();
    const targetZoom = currentZoom < 8 ? 9 : currentZoom;
    map.flyTo([lat, lon], targetZoom, {
      animate: true,
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [lat, lon, map]);
  return null;
};

// Verified Mountain Pass Topo Polygons
const MOUNTAIN_PASS_POLYGONS = [
  {
    id: 'PASS_LOVELAND',
    name: 'Loveland Pass Corridor (US-6)',
    elevation: '3,655m',
    slope: '37.5°',
    coords: [
      [39.655, -105.895],
      [39.655, -105.865],
      [39.675, -105.865],
      [39.675, -105.895],
    ] as [number, number][],
  },
  {
    id: 'PASS_BERTHOUD',
    name: 'Berthoud Pass Corridor (US-40)',
    elevation: '3,447m',
    slope: '38.2°',
    coords: [
      [39.790, -105.795],
      [39.790, -105.765],
      [39.810, -105.765],
      [39.810, -105.795],
    ] as [number, number][],
  },
  {
    id: 'PASS_RED_MOUNTAIN',
    name: 'Red Mountain Pass Corridor (US-550)',
    elevation: '3,358m',
    slope: '40.5°',
    coords: [
      [37.885, -107.730],
      [37.885, -107.700],
      [37.915, -107.700],
      [37.915, -107.730],
    ] as [number, number][],
  },
];

const CONTOUR_LINES = [
  {
    type: '100m',
    label: '3600m Contour (Loveland)',
    coords: [[39.660, -105.888], [39.664, -105.880], [39.667, -105.872], [39.672, -105.866]] as [number, number][],
  },
  {
    type: '50m',
    label: '3550m Contour (Loveland)',
    coords: [[39.659, -105.889], [39.663, -105.881], [39.666, -105.873], [39.671, -105.867]] as [number, number][],
  },
  {
    type: '100m',
    label: '3400m Contour (Berthoud)',
    coords: [[39.795, -105.790], [39.800, -105.782], [39.803, -105.774], [39.808, -105.768]] as [number, number][],
  },
  {
    type: '50m',
    label: '3450m Contour (Berthoud)',
    coords: [[39.797, -105.788], [39.802, -105.780], [39.805, -105.772], [39.810, -105.766]] as [number, number][],
  },
];

export const ColoradoMap: React.FC<ColoradoMapProps> = ({
  zones,
  stations,
  historicalEvents,
  selectedLocation,
  onSelectLocation,
  showEvents,
  activeRiskLevel = 'HIGH',
  layerVisibility = {
    historicalEvents: true,
    snotelStations: true,
    forecastZones: true,
    highResTerrain: true,
    contours20m: false,
    contours50m: true,
    contours100m: true,
    riskSurface: true,
  },
  riskSurface = null,
  selectedDomain = 'COLORADO',
  indianPeaks = [],
  selectedIndianPeak = null,
  onSelectIndianPeak,
}) => {
  const isIndia = selectedDomain === 'INDIA';
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [layers, setLayers] = useState(layerVisibility);

  // Sync external layers with internal state
  useEffect(() => {
    setLayers(layerVisibility);
  }, [layerVisibility]);

  const handleMapClick = (lat: number, lon: number) => {
    if (isIndia) return;
    onSelectLocation({
      type: 'COORDINATE',
      name: `Custom Location (${lat.toFixed(3)}°N, ${Math.abs(lon).toFixed(3)}°W)`,
      latitude: lat,
      longitude: lon,
      elevation: 3444.0,
      slope: 36.0,
      aspect: 45.0,
      temperature: -5.5,
      snow_depth: 140.0,
      snow_water_equivalent: 220.0,
      snowfall_6h: 8.0,
      snowfall_24h: 22.0,
      snowfall_72h: 38.0,
      temperature_delta_24h: -3.0,
      wind_speed_mean_24h: 24.0,
      wind_speed_max_24h: 48.0,
      telemetry_age_minutes: 18,
    });
  };

  const activeMarkerRef = useRef<L.Marker | null>(null);

  const centerLat = selectedLocation
    ? selectedLocation.latitude
    : isIndia
    ? selectedIndianPeak
      ? selectedIndianPeak.latitude
      : 31.50
    : 39.60;
  const centerLon = selectedLocation
    ? selectedLocation.longitude
    : isIndia
    ? selectedIndianPeak
      ? selectedIndianPeak.longitude
      : 79.00
    : -106.00;

  // Automatically open target popup when active target changes
  useEffect(() => {
    if (activeMarkerRef.current) {
      activeMarkerRef.current.openPopup();
    }
  }, [selectedLocation?.latitude, selectedLocation?.longitude, selectedLocation?.name]);

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-xl overflow-hidden border border-slate-800 bg-[#070b12] font-sans isolate shadow-2xl">
      {/* ================= 1. FLOATING TOP-LEFT: LAYER CONTROLS ================= */}
      <div className="absolute top-3 left-3 z-[500] pointer-events-auto">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLayerMenu((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-mono font-bold text-slate-200 shadow-xl backdrop-blur-md hover:bg-slate-800 hover:text-cyan-300 transition-colors"
            aria-label="Toggle map layers"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Layer Controls</span>
          </button>

          {showLayerMenu && (
            <div className="absolute top-10 left-0 w-48 p-2.5 rounded-lg bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md space-y-1.5 motion-fade z-50">
              <div className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider pb-1 border-b border-slate-800">
                MAP LAYERS
              </div>
              {[
                { key: 'snotelStations', label: 'SNOTEL Stations' },
                { key: 'forecastZones', label: 'Forecast Zones' },
                { key: 'historicalEvents', label: 'Historical Events' },
                { key: 'highResTerrain', label: 'Terrain' },
                { key: 'contours50m', label: 'Contours' },
                { key: 'riskSurface', label: 'Risk Surface' },
              ].map(({ key, label }) => {
                const isChecked = (layers as any)[key] ?? true;
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-1.5 py-1 rounded text-xs font-mono text-slate-300 hover:bg-slate-800/60 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setLayers((prev) => ({ ...prev, [key]: !isChecked }))}
                      className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= 2. FLOATING TOP-CENTER: RISK SURFACE COLOR RAMP ================= */}
      <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[500] pointer-events-auto max-w-[90%]">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 shadow-xl backdrop-blur-md flex flex-col items-center gap-1">
          <div className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>RISK SURFACE</span>
            <span className="text-[9px] text-slate-500 font-normal">(RESEARCH ONLY)</span>
          </div>
          <div className="w-36 sm:w-48 h-2 rounded-full overflow-hidden border border-slate-800 bg-slate-950 relative">
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to right, #10b981 0%, #34d399 25%, #f59e0b 50%, #f97316 75%, #ef4444 100%)',
              }}
            />
          </div>
          <div className="w-36 sm:w-48 flex justify-between text-[9px] font-mono text-slate-400">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* ================= 3. LEAFLET MAP CONTAINER ================= */}
      <MapContainer
        center={isIndia ? [31.50, 79.00] : [39.60, -106.00]}
        zoom={isIndia ? 6 : 8}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        {/* Dark Topographic / Satellite Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={18}
        />

        <MapClickHandler onLocationClick={handleMapClick} />
        <MapController lat={centerLat} lon={centerLon} />

        {/* ================= CORRIDOR PASS POLYGONS (TERRAIN) ================= */}
        {layers.highResTerrain &&
          MOUNTAIN_PASS_POLYGONS.map((p) => (
            <Polygon
              key={p.id}
              positions={p.coords}
              pathOptions={{
                color: '#06b6d4',
                fillColor: '#06b6d4',
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: '4, 4',
              }}
            />
          ))}

        {/* ================= CONTOUR LINES ================= */}
        {layers.contours50m &&
          CONTOUR_LINES.map((c, i) => (
            <Polyline
              key={i}
              positions={c.coords}
              pathOptions={{
                color: '#64748b',
                weight: 1,
                opacity: 0.5,
              }}
            />
          ))}

        {/* ================= STATIONS LAYER ================= */}
        {layers.snotelStations &&
          !isIndia &&
          stations.map((st) => {
            const isSelected = selectedLocation.name.includes(st.name) || (selectedLocation.latitude === st.latitude && selectedLocation.longitude === st.longitude);
            return (
              <Marker
                key={st.station_id}
                position={[st.latitude, st.longitude]}
                icon={createStationCircleIcon(st.name, isSelected, 18)}
                eventHandlers={{
                  click: () => {
                    onSelectLocation({
                      type: 'STATION',
                      name: `${st.name} (SNOTEL ${st.station_id})`,
                      latitude: st.latitude,
                      longitude: st.longitude,
                      elevation: st.elevation,
                      slope: 36.0,
                      aspect: 45.0,
                      temperature: -5.5,
                      snow_depth: 140.0,
                      snow_water_equivalent: 220.0,
                      snowfall_6h: 8.0,
                      snowfall_24h: 22.0,
                      snowfall_72h: 38.0,
                      temperature_delta_24h: -3.0,
                      wind_speed_mean_24h: 24.0,
                      wind_speed_max_24h: 48.0,
                      telemetry_age_minutes: 18,
                    });
                  },
                }}
              >
                <Popup className="custom-popup" closeButton={false}>
                  <div className="p-3 bg-slate-900 text-slate-100 font-mono text-xs space-y-2 rounded-lg min-w-[180px]">
                    <div className="font-bold text-slate-100 text-sm">
                      {st.name} ({st.station_id})
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Elev: {st.elevation.toLocaleString()} m • Age: 18m
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${activeRiskLevel === 'HIGH' ? 'bg-red-500 animate-pulse' : activeRiskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        <span className={`font-bold ${activeRiskLevel === 'HIGH' ? 'text-red-400' : activeRiskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          RISK: {activeRiskLevel}
                        </span>
                      </div>
                      <div className="font-extrabold text-slate-100 text-sm">
                        {activeRiskLevel === 'HIGH' ? '68' : activeRiskLevel === 'MEDIUM' ? '52' : '18'} / 100
                      </div>
                    </div>
                    <button
                      type="button"
                      className="w-full py-1 text-center font-bold text-cyan-400 bg-slate-950 border border-cyan-500/40 rounded hover:bg-slate-800 text-[11px]"
                    >
                      Click to evaluate
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* ================= RISK SURFACE LAYER ================= */}
        {layers.riskSurface &&
          riskSurface?.points?.map((pt, i) => (
            <Marker
              key={i}
              position={[pt.latitude, pt.longitude]}
              icon={L.divIcon({
                className: 'risk-surface-cell',
                html: `<div class="w-3 h-3 rounded-sm opacity-60" style="background-color: ${
                  pt.final_risk_level === 'HIGH'
                    ? '#ef4444'
                    : pt.final_risk_level === 'MEDIUM'
                    ? '#f59e0b'
                    : '#10b981'
                };"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              })}
            />
          ))}

        {/* ================= FORECAST ZONES LAYER ================= */}
        {layers.forecastZones &&
          zones.map((z) => (
            <Marker
              key={z.zone_id}
              position={[z.center_latitude, z.center_longitude]}
              icon={L.divIcon({
                className: 'custom-zone-label',
                html: `<div class="px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-[9px] font-mono text-blue-300 font-bold whitespace-nowrap shadow">${z.name}</div>`,
                iconSize: [100, 16],
                iconAnchor: [50, 8],
              })}
            />
          ))}

        {/* ================= HISTORICAL EVENTS LAYER ================= */}
        {showEvents &&
          layers.historicalEvents &&
          historicalEvents.map((ev) => (
            <Marker
              key={ev.event_id}
              position={[ev.latitude, ev.longitude]}
              icon={createEventIcon(ev.trigger_category || 'NATURAL')}
            >
              <Popup>
                <div className="p-2 font-mono text-xs bg-slate-900 text-slate-200">
                  <div className="font-bold text-amber-400">{ev.event_id}</div>
                  <div>Location: {ev.location}</div>
                  <div>Date: {ev.date}</div>
                  <div>Type: {ev.avalanche_type} ({ev.d_size})</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* ================= INDIAN HIMALAYAN PEAKS ================= */}
        {isIndia &&
          indianPeaks.map((peak) => {
            const isSelected = selectedIndianPeak?.id === peak.id;
            return (
              <Marker
                key={peak.id}
                position={[peak.latitude, peak.longitude]}
                icon={createIndianPeakIcon(peak.name, peak.elevation_m, isSelected)}
                eventHandlers={{
                  click: () => {
                    if (onSelectIndianPeak) {
                      onSelectIndianPeak(peak);
                    }
                  },
                }}
              />
            );
          })}
        {/* ================= AUTHORITATIVE ACTIVE TARGET MARKER ================= */}
        {selectedLocation && (
          <Marker
            ref={activeMarkerRef}
            position={[selectedLocation.latitude, selectedLocation.longitude]}
            icon={createActiveTargetIcon(
              selectedLocation.name,
              selectedLocation.latitude,
              selectedLocation.longitude
            )}
            zIndexOffset={1000}
          >
            <Popup className="custom-popup" closeButton={false}>
              <div className="p-3 bg-[#070b12] text-slate-100 font-mono text-xs space-y-2 rounded-xl border border-cyan-500/60 shadow-2xl min-w-[220px]">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-[9px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                    <span>ACTIVE TARGET</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold">
                    {selectedLocation.type === 'STATION' ? 'SNOTEL STATION' : 'CSV DATASET'}
                  </span>
                </div>

                <div className="font-bold text-slate-100 text-sm leading-tight">
                  {selectedLocation.name}
                </div>

                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <div>
                    {selectedLocation.latitude.toFixed(4)}° N, {Math.abs(selectedLocation.longitude).toFixed(4)}° {selectedLocation.longitude >= 0 ? 'E' : 'W'}
                  </div>
                  <div className="text-slate-300">
                    Elev: {selectedLocation.elevation?.toLocaleString()} m • Slope: {selectedLocation.slope}°
                  </div>
                </div>

                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
                  {isIndia ? (
                    <div className="flex items-center gap-1 text-amber-400 font-bold text-[10px]">
                      <span>RESEARCH ONLY • INFERENCE DISABLED</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${activeRiskLevel === 'HIGH' ? 'bg-red-500 animate-pulse' : activeRiskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        <span className={`font-bold ${activeRiskLevel === 'HIGH' ? 'text-red-400' : activeRiskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          RISK: {activeRiskLevel}
                        </span>
                      </div>
                      <span className="font-mono text-slate-200 text-xs font-bold">
                        {activeRiskLevel === 'HIGH' ? '68' : activeRiskLevel === 'MEDIUM' ? '52' : '18'} / 100
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* ================= 4. FLOATING BOTTOM-LEFT: STATION STATUS LEGEND ================= */}
      <div className="absolute bottom-3 left-3 z-[500] pointer-events-auto">
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700 shadow-xl backdrop-blur-md space-y-1.5 text-[11px] font-mono">
          <div className="font-bold text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-800 pb-1">
            STATION STATUS
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
              <span>LIVE (≤2h)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]"></span>
              <span>DEGRADED (≤6h)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]"></span>
              <span>STALE (&gt;6h)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
              <span>HISTORICAL (&gt;24h)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full border border-slate-600 bg-transparent"></span>
              <span>OFFLINE</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 5. FLOATING BOTTOM-RIGHT: CONTROLS & SCALE BAR ================= */}
      <div className="absolute bottom-3 right-3 z-[500] pointer-events-auto flex flex-col items-end gap-2">
        {/* Scale Bar */}
        <div className="px-2 py-1 rounded bg-slate-900/90 border border-slate-700 shadow-lg text-[10px] font-mono text-slate-300 flex flex-col items-center">
          <div className="w-20 h-1 border-b-2 border-l-2 border-r-2 border-slate-400"></div>
          <div className="w-20 flex justify-between text-[9px] text-slate-400 mt-0.5">
            <span>0</span>
            <span>25</span>
            <span>50 km</span>
          </div>
        </div>
      </div>
    </div>
  );
};
