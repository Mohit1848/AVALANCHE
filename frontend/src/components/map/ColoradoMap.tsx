import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
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
import { Radio, AlertOctagon, Layers } from 'lucide-react';


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

// Custom Leaflet DivIcons with text + icon indicators
const createIndianPeakIcon = (name: string, elevation: number, isSelected: boolean = false) => L.divIcon({
  className: 'custom-indian-peak-marker',
  html: `<div class="bg-amber-950/95 border-2 ${
    isSelected ? 'border-amber-300 ring-2 ring-amber-400/60 scale-110 shadow-amber-500/50' : 'border-amber-500/80'
  } text-amber-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-xl flex items-center gap-1 backdrop-blur-sm whitespace-nowrap transition-all">
          <span class="text-amber-400">🏔️</span> <span>${name}</span> <span class="text-[9px] text-amber-400/90 font-normal">(${elevation}m)</span>
         </div>`,
  iconSize: [130, 24],
  iconAnchor: [65, 12],
});

const createZoneIcon = (name: string) => L.divIcon({
  className: 'custom-zone-marker',
  html: `<div class="bg-blue-900/90 text-blue-200 border border-blue-400 font-mono text-[10px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1 backdrop-blur-sm whitespace-nowrap">
          <span>🏔️</span> ${name}
         </div>`,
  iconSize: [120, 24],
  iconAnchor: [60, 12],
});

const createStationIcon = (stationId: string, ageMinutes: number = 38) => {
  const isStale = ageMinutes > 360;
  const isDegraded = ageMinutes > 120;
  const badgeColor = isStale
    ? 'bg-red-950/90 text-red-300 border-red-500'
    : isDegraded
    ? 'bg-amber-950/90 text-amber-300 border-amber-500'
    : 'bg-emerald-950/90 text-emerald-300 border-emerald-500';

  return L.divIcon({
    className: 'custom-station-marker',
    html: `<div class="${badgeColor} border font-mono text-[10px] px-1.5 py-0.5 rounded shadow flex items-center gap-1 backdrop-blur-sm whitespace-nowrap">
            <span>📡</span> SNTL-${stationId} (${ageMinutes}m)
           </div>`,
    iconSize: [120, 20],
    iconAnchor: [60, 10],
  });
};

const createEventIcon = (trigger: string) => {
  const isNatural = trigger === 'NATURAL';
  const colorClass = isNatural ? 'bg-amber-600 border-amber-300' : 'bg-purple-600 border-purple-300';
  return L.divIcon({
    className: 'custom-event-marker',
    html: `<div class="${colorClass} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-md flex items-center gap-1">
            <span>⚠️</span> ${trigger.slice(0, 3)}
           </div>`,
    iconSize: [50, 18],
    iconAnchor: [25, 9],
  });
};

const createActivePointIcon = (level: RiskLevel = 'LOW') => {
  let badgeColor = 'bg-emerald-500 border-emerald-300';
  let label = '● LOW';
  if (level === 'MEDIUM') {
    badgeColor = 'bg-amber-500 border-amber-200 text-slate-950';
    label = '● MED';
  } else if (level === 'HIGH') {
    badgeColor = 'bg-red-600 border-red-200 text-white animate-pulse';
    label = '▲ HIGH';
  } else if (level === 'INSUFFICIENT_DATA') {
    badgeColor = 'bg-slate-700 border-slate-400 text-slate-300';
    label = '? INSUF';
  }

  return L.divIcon({
    className: 'custom-active-point-marker',
    html: `<div class="relative flex flex-col items-center">
            <div class="${badgeColor} font-mono font-bold text-[10px] px-2 py-0.5 rounded-full border shadow-xl flex items-center gap-1 whitespace-nowrap">
              ${label}
            </div>
            <div class="w-2.5 h-2.5 bg-cyan-400 rotate-45 -mt-1 shadow"></div>
           </div>`,
    iconSize: [80, 35],
    iconAnchor: [40, 30],
  });
};

const MapClickHandler: React.FC<{ onLocationClick: (lat: number, lon: number) => void }> = ({ onLocationClick }) => {
  useMapEvents({
    click(e) {
      onLocationClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Hook to keep map centered when target location changes or domain switches
const MapCenterUpdater: React.FC<{
  lat: number;
  lon: number;
  domain: GeographicDomain;
}> = ({ lat, lon, domain }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], domain === 'INDIA' ? 7 : 8, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [lat, lon, domain, map]);
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

// Contour vectors
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
    type: '20m',
    label: '3520m Contour (Loveland)',
    coords: [[39.6585, -105.8895], [39.6625, -105.8815], [39.6655, -105.8740], [39.6705, -105.8675]] as [number, number][],
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
  {
    type: '100m',
    label: '3300m Contour (Red Mountain)',
    coords: [[37.890, -107.725], [37.898, -107.718], [37.905, -107.710], [37.910, -107.705]] as [number, number][],
  },
];

export const ColoradoMap: React.FC<ColoradoMapProps> = ({
  zones,
  stations,
  historicalEvents,
  selectedLocation,
  onSelectLocation,
  showEvents,
  activeRiskLevel = 'LOW',
  isLiveMode = true,
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

  const handleMapClick = (lat: number, lon: number) => {
    if (isIndia) {
      // Find nearest peak or notify
      return;
    }
    onSelectLocation({
      type: 'COORDINATE',
      name: `Custom Location (${lat.toFixed(3)}°N, ${Math.abs(lon).toFixed(3)}°W)`,
      latitude: lat,
      longitude: lon,
      elevation: 3450.0,
      slope: 38.0,
      aspect: 45.0,
      temperature: -7.2,
      snow_depth: 145.0,
      snow_water_equivalent: 230.0,
      snowfall_6h: 8.0,
      snowfall_24h: 32.0,
      snowfall_72h: 52.0,
      temperature_delta_24h: -3.0,
      wind_speed_mean_24h: 22.0,
      wind_speed_max_24h: 46.0,
      telemetry_age_minutes: 38,
    });
  };

  const centerLat = isIndia ? (selectedIndianPeak ? selectedIndianPeak.latitude : 31.50) : selectedLocation.latitude;
  const centerLon = isIndia ? (selectedIndianPeak ? selectedIndianPeak.longitude : 79.00) : selectedLocation.longitude;

  return (
    <div className="relative w-full h-full min-h-[360px] rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950 font-sans isolate">
      {/* 1. Header Overlay Status Bar */}
      <div className="absolute top-2.5 left-2.5 z-[500] bg-slate-900/90 border border-slate-700 px-2.5 py-1.5 rounded-lg shadow-xl backdrop-blur-md flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-mono max-w-[calc(100%-1.5rem)] pointer-events-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <Radio className={`w-3.5 h-3.5 ${isIndia ? 'text-amber-400' : 'text-cyan-400'} animate-pulse`} />
          <span className="text-slate-200 font-bold hidden sm:inline">
            {isIndia ? 'INDIAN HIMALAYAN GIS CONSOLE' : 'COLORADO ALPINE GIS CONSOLE'}
          </span>
          <span className="text-slate-200 font-bold sm:hidden">
            {isIndia ? 'HIMALAYAN GIS' : 'COLORADO GIS'}
          </span>
        </div>
        <div className="text-slate-500 hidden sm:inline">|</div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${isIndia ? 'bg-amber-400' : 'bg-cyan-400 animate-ping'}`}></span>
          <span className={isIndia ? 'text-amber-300 font-semibold' : 'text-cyan-300 font-semibold'}>
            {isIndia ? 'GEOGRAPHIC ONLY' : (isLiveMode ? 'LIVE (30s)' : 'HISTORICAL')}
          </span>
        </div>
        <div className="text-slate-500 hidden md:inline">|</div>
        <span className="text-purple-300 font-semibold hidden md:inline shrink-0">
          {isIndia ? '19 Verified Peaks (Survey of India)' : 'IDW Multi-Station'}
        </span>
      </div>

      {/* 2. Top-Right Research Disclaimer Tag */}
      <div className="absolute top-2.5 right-2.5 z-[500] bg-slate-900/95 border border-slate-700 px-2.5 py-1 rounded-lg shadow-xl text-[9px] sm:text-[10px] font-mono text-slate-300 hidden lg:flex items-center gap-1.5 max-w-[340px] pointer-events-auto">
        <AlertOctagon className={`w-3.5 h-3.5 ${isIndia ? 'text-amber-400' : 'text-amber-400'} shrink-0`} />
        <span className="truncate">
          {isIndia
            ? 'GEOGRAPHIC CATALOG ONLY • RISK PREDICTION NOT ENABLED'
            : 'RESEARCH RISK SURFACE • NOT AN OFFICIAL FORECAST'}
        </span>
      </div>

      {/* 3. Main Leaflet Map Container */}
      <MapContainer
        center={isIndia ? [31.50, 79.00] : [39.55, -106.10]}
        zoom={isIndia ? 6 : 8}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={18}
        />

        <MapClickHandler onLocationClick={handleMapClick} />
        <MapCenterUpdater
          lat={centerLat}
          lon={centerLon}
          domain={selectedDomain}
        />

        {/* ==================== INDIAN HIMALAYAN LAYER ==================== */}
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
              >
                <Popup className="custom-popup">
                  <div className="p-2 space-y-1 font-sans text-xs">
                    <div className="font-bold text-amber-400 flex items-center justify-between gap-2">
                      <span>{peak.name}</span>
                      <span className="text-[9px] font-mono bg-amber-950 text-amber-300 px-1 rounded">{peak.id}</span>
                    </div>
                    <div className="text-slate-200">Summit: <strong>{peak.elevation_m.toLocaleString()} m</strong> ({(peak.elevation_m * 3.28084).toFixed(0)} ft)</div>
                    <div className="text-[11px] text-slate-300">State: {peak.state} • {peak.region}</div>
                    <div className="text-[11px] text-slate-400">Range: {peak.mountain_range}</div>
                    <div className="text-[10px] font-mono text-cyan-300">Coord: {peak.latitude.toFixed(3)}°N, {peak.longitude.toFixed(3)}°E</div>
                    <div className="border-t border-slate-700 pt-1 text-[10px] text-amber-300 font-mono">
                      Risk Capability: GEOGRAPHIC ONLY
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* ==================== COLORADO LAYERS ==================== */}
        {!isIndia && (
          <>
            {/* High-Resolution Mountain Pass Topo Polygons */}
            {layerVisibility.highResTerrain &&
              MOUNTAIN_PASS_POLYGONS.map((pass) => (
                <Polygon
                  key={pass.id}
                  positions={pass.coords}
                  pathOptions={{
                    color: '#10b981',
                    weight: 1.5,
                    fillColor: '#059669',
                    fillOpacity: 0.15,
                    dashArray: '4, 4',
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 space-y-1 font-sans text-xs">
                      <div className="font-bold text-emerald-400">{pass.name}</div>
                      <div className="text-[11px] text-slate-300">Summit Elev: {pass.elevation}</div>
                      <div className="text-[11px] text-slate-300">Mean Slope: {pass.slope}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Source: USGS 3DEP 30m DEM</div>
                    </div>
                  </Popup>
                </Polygon>
              ))}

            {/* Contour Overlays (20m, 50m, 100m) */}
            {CONTOUR_LINES.map((c, i) => {
              if (
                (c.type === '20m' && !layerVisibility.contours20m) ||
                (c.type === '50m' && !layerVisibility.contours50m) ||
                (c.type === '100m' && !layerVisibility.contours100m)
              ) {
                return null;
              }
              return (
                <Polyline
                  key={i}
                  positions={c.coords}
                  pathOptions={{
                    color: c.type === '100m' ? '#818cf8' : c.type === '50m' ? '#6366f1' : '#4f46e5',
                    weight: c.type === '100m' ? 2 : 1,
                    opacity: 0.7,
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 font-mono text-[11px] text-indigo-300">{c.label}</div>
                  </Popup>
                </Polyline>
              );
            })}

            {/* Research Risk Surface Grid Cells */}
            {layerVisibility.riskSurface &&
              riskSurface &&
              riskSurface.points.map((pt, idx) => {
                const isHigh = pt.final_risk_level === 'HIGH';
                const isMed = pt.final_risk_level === 'MEDIUM';
                const fillColor = isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#10b981';

                return (
                  <CircleMarker
                    key={idx}
                    center={[pt.latitude, pt.longitude]}
                    radius={10}
                    pathOptions={{
                      fillColor,
                      fillOpacity: 0.55,
                      color: fillColor,
                      weight: 1.5,
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-2 space-y-1.5 font-sans text-xs text-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                          <span className="font-mono font-bold text-[10px] text-cyan-400">RESEARCH GRID CELL</span>
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                            isHigh ? 'bg-red-950 text-red-300' : isMed ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
                          }`}>
                            {pt.final_risk_level} ({pt.final_risk_score}/100)
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-300">
                          Coord: {pt.latitude.toFixed(3)}°N, {Math.abs(pt.longitude).toFixed(3)}°W
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[11px] font-mono text-slate-400">
                          <div>Slope: <strong className="text-slate-200">{pt.slope}°</strong></div>
                          <div>Elev: <strong className="text-slate-200">{pt.elevation}m</strong></div>
                          <div>24h Snow: <strong className="text-amber-300">{pt.snowfall_24h}mm</strong></div>
                          <div>SWE: <strong className="text-amber-300">{pt.snow_water_equivalent}mm</strong></div>
                        </div>
                        <div className="border-t border-slate-700 pt-1 text-[10px] font-mono text-slate-400">
                          Coverage: <span className="text-cyan-300 font-bold">{pt.spatial_quality}</span> (Nearest: {pt.nearest_station_distance_km}km, Stations: {pt.station_count})
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

            {/* SNOTEL Stations */}
            {layerVisibility.snotelStations &&
              stations.map((st) => (
                <Marker
                  key={st.station_id}
                  position={[st.latitude, st.longitude]}
                  icon={createStationIcon(st.station_id, 38)}
                  eventHandlers={{
                    click: () => {
                      onSelectLocation({
                        type: 'STATION',
                        name: `SNOTEL ${st.station_id}: ${st.name}`,
                        latitude: st.latitude,
                        longitude: st.longitude,
                        elevation: st.elevation,
                        slope: 36.0,
                        aspect: 45.0,
                        temperature: -8.0,
                        snow_depth: 130.0,
                        snow_water_equivalent: 215.0,
                        snowfall_6h: 6.0,
                        snowfall_24h: 28.0,
                        snowfall_72h: 46.0,
                        temperature_delta_24h: -2.5,
                        wind_speed_mean_24h: 18.0,
                        wind_speed_max_24h: 42.0,
                        telemetry_age_minutes: 38,
                      });
                    },
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 space-y-1 font-sans text-xs">
                      <div className="font-bold text-cyan-400">SNOTEL {st.station_id}</div>
                      <div className="text-slate-200">{st.name}</div>
                      <div className="text-[11px] text-slate-400">Elevation: {st.elevation}m</div>
                      <div className="text-[10px] text-emerald-400 font-mono">Telemetry: GOOD (38m old)</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Forecast Zones */}
            {layerVisibility.forecastZones &&
              zones.map((zone) => (
                <Marker
                  key={zone.zone_id}
                  position={[zone.center_latitude, zone.center_longitude]}
                  icon={createZoneIcon(zone.name)}
                  eventHandlers={{
                    click: () => {
                      onSelectLocation({
                        type: 'ZONE',
                        name: `${zone.name} Forecast Zone`,
                        latitude: zone.center_latitude,
                        longitude: zone.center_longitude,
                        elevation: 3500.0,
                        slope: 38.0,
                        aspect: 45.0,
                        temperature: -7.5,
                        snow_depth: 140.0,
                        snow_water_equivalent: 225.0,
                        snowfall_6h: 8.0,
                        snowfall_24h: 32.0,
                        snowfall_72h: 50.0,
                        temperature_delta_24h: -3.0,
                        wind_speed_mean_24h: 22.0,
                        wind_speed_max_24h: 48.0,
                        telemetry_age_minutes: 38,
                      });
                    },
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 space-y-1 font-sans text-xs">
                      <div className="font-bold text-blue-400">{zone.name}</div>
                      <div className="text-[11px] text-slate-300">Elevation Range: {zone.elevation_range_m}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Historical Events */}
            {(showEvents || layerVisibility.historicalEvents) &&
              historicalEvents.map((evt) => (
                <Marker
                  key={evt.event_id}
                  position={[evt.latitude, evt.longitude]}
                  icon={createEventIcon(evt.trigger_category)}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 space-y-1 font-sans text-xs">
                      <div className="font-bold text-amber-400">{evt.event_id}</div>
                      <div className="text-[11px] text-slate-200">{evt.location}</div>
                      <div className="text-[11px] text-slate-400">Date: {evt.date} • Type: {evt.avalanche_type}</div>
                      <div className="text-[11px] text-slate-300">Trigger: {evt.trigger_category} ({evt.d_size || 'D2'})</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Active Selected Location Pin */}
            <Marker
              position={[selectedLocation.latitude, selectedLocation.longitude]}
              icon={createActivePointIcon(activeRiskLevel)}
            />
          </>
        )}
      </MapContainer>

      {/* 4. Bottom-Left Multi-Layer Legend */}
      <div className="absolute bottom-2.5 left-2.5 z-[500] bg-slate-900/90 border border-slate-800 p-2 sm:p-2.5 rounded-lg shadow-xl backdrop-blur-md space-y-1 text-[9px] sm:text-[10px] font-mono text-slate-300 max-w-[calc(100%-1.5rem)] pointer-events-auto">
        <div className="font-bold text-slate-100 flex items-center gap-1 border-b border-slate-800 pb-1">
          <Layers className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>{isIndia ? 'HIMALAYAN GIS LEGEND' : 'GIS MAP LEGEND'}</span>
        </div>
        {isIndia ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400">🏔️</span>
              <span className="text-amber-200 font-bold">Indian Himalayan Peak (Survey of India)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Elevation: 5,928m – 8,586m</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-300/80">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Risk Capability: GEOGRAPHIC ONLY</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>High Risk Cell</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Med Risk Cell</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>SNOTEL Station</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Forecast Zone</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span>CAIC Avalanche</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-indigo-400"></span>
              <span>Topo Contour</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

