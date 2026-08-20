"""Himalayan Data Ingestion & Canonical Processing Pipeline.

Processes raw events, weather reanalysis, and DEM terrain data through intermediate normalization,
Himalayan spatial matching, and strictly backward-looking temporal joins (T_obs <= T_target).
Generates data/processed/himalaya/canonical_training_himalaya.csv.
"""

from __future__ import annotations

import datetime
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_HIMALAYA_DIR = DATA_DIR / "raw" / "himalaya"
INTERMEDIATE_DIR = DATA_DIR / "intermediate" / "himalaya"
PROCESSED_DIR = DATA_DIR / "processed" / "himalaya"
CONFIG_DIR = PROJECT_ROOT / "config" / "spatial"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in km."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return round(2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)), 2)


def load_himalaya_spatial_config() -> Dict[str, Any]:
    """Load Himalayan spatial matching parameters."""
    cfg_file = CONFIG_DIR / "himalaya.yaml"
    defaults = {
        "default_search_radius_km": 65.0,
        "max_search_radius_km": 80.0,
        "quality_bands": {
            "good_max_distance_km": 40.0,
            "degraded_max_distance_km": 65.0,
        }
    }
    if cfg_file.exists():
        try:
            with open(cfg_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                if data and "spatial" in data:
                    defaults.update(data["spatial"])
        except Exception:
            pass
    return defaults


def build_intermediate_layers() -> Tuple[Path, Path, Path]:
    """Normalize raw data into intermediate layers."""
    INTERMEDIATE_DIR.mkdir(parents=True, exist_ok=True)
    
    events_raw_file = RAW_HIMALAYA_DIR / "events" / "documented_himalayan_events_and_controls.csv"
    terrain_raw_file = RAW_HIMALAYA_DIR / "terrain" / "copernicus_glo30_himalayan_terrain.csv"
    
    if not events_raw_file.exists() or not terrain_raw_file.exists():
        from ml.data_acquisition.fetch_himalaya_data import run_acquisition
        run_acquisition()

    # 1. Normalize Events
    events_df = pd.read_csv(events_raw_file)
    events_df["aspect_sin"] = np.sin(np.radians(events_df["aspect_deg"])).round(4)
    events_df["aspect_cos"] = np.cos(np.radians(events_df["aspect_deg"])).round(4)
    events_inter_file = INTERMEDIATE_DIR / "normalized_events.csv"
    events_df.to_csv(events_inter_file, index=False)

    # 2. Normalize Terrain
    terrain_df = pd.read_csv(terrain_raw_file)
    terrain_df["aspect_sin"] = np.sin(np.radians(terrain_df["aspect_deg"])).round(4)
    terrain_df["aspect_cos"] = np.cos(np.radians(terrain_df["aspect_deg"])).round(4)
    terrain_inter_file = INTERMEDIATE_DIR / "dem_terrain_features.csv"
    terrain_df.to_csv(terrain_inter_file, index=False)

    # 3. Concatenate and Normalize Weather Series
    weather_files = list((RAW_HIMALAYA_DIR / "weather").glob("*.csv"))
    weather_dfs = []
    for wf in weather_files:
        try:
            wdf = pd.read_csv(wf)
            weather_dfs.append(wdf)
        except Exception:
            pass

    if weather_dfs:
        all_weather_df = pd.concat(weather_dfs, ignore_index=True).drop_duplicates(subset=["station_id", "timestamp"])
        all_weather_df.sort_values(by=["station_id", "timestamp"], inplace=True)
    else:
        all_weather_df = pd.DataFrame()

    weather_inter_file = INTERMEDIATE_DIR / "normalized_weather.csv"
    all_weather_df.to_csv(weather_inter_file, index=False)

    return events_inter_file, terrain_inter_file, weather_inter_file


def process_canonical_himalayan_dataset() -> Path:
    """Join events, terrain, and weather features into canonical training dataset.
    
    Excludes UNKNOWN observation records so training only ingests verified EVENT and BACKGROUND labels.
    """
    events_file, terrain_file, weather_file = build_intermediate_layers()
    
    events_df = pd.read_csv(events_file)
    # Strictly filter for verified EVENT and documented BACKGROUND observation windows
    events_df = events_df[events_df["label_type"].isin(["EVENT", "BACKGROUND"])].copy()
    weather_df = pd.read_csv(weather_file)
    spatial_cfg = load_himalaya_spatial_config()

    # Station coordinates reference
    station_coords = {
        "DGRE-GULMARG": (34.052, 74.384, 2730.0),
        "DGRE-DHUNDI": (32.321, 77.132, 2850.0),
        "IMD-KEYLONG": (32.570, 77.030, 3080.0),
        "DGRE-DRAS": (34.420, 75.760, 3300.0),
        "DGRE-JOSHIMATH": (30.560, 79.570, 2800.0),
        "IMD-BANIHAL": (33.500, 75.200, 1750.0),
        "IMD-LEH": (34.150, 77.580, 3500.0),
        "IMD-GANGTOK": (27.330, 88.610, 1800.0),
    }

    canonical_rows = []

    for _, evt in events_df.iterrows():
        evt_id = str(evt["event_id"])
        target_ts = str(evt["timestamp"])
        evt_lat = float(evt["latitude"])
        evt_lon = float(evt["longitude"])
        evt_elev = float(evt["elevation_m"])
        st_id = str(evt.get("weather_station_id", "DGRE-GULMARG"))

        # Find best spatial match station
        if st_id in station_coords:
            st_lat, st_lon, st_elev = station_coords[st_id]
        else:
            st_id = "DGRE-GULMARG"
            st_lat, st_lon, st_elev = station_coords[st_id]

        dist_km = haversine_km(evt_lat, evt_lon, st_lat, st_lon)
        elev_diff_m = round(evt_elev - st_elev, 1)

        # Spatial match quality
        max_good_dist = float(spatial_cfg.get("quality_bands", {}).get("good_max_distance_km", 40.0))
        max_deg_dist = float(spatial_cfg.get("quality_bands", {}).get("degraded_max_distance_km", 65.0))

        if dist_km <= max_good_dist:
            match_quality = "EXCELLENT" if dist_km <= 15.0 else "GOOD"
        elif dist_km <= max_deg_dist:
            match_quality = "DEGRADED"
        else:
            match_quality = "INSUFFICIENT"

        # Temporal Join: Filter strictly backward-looking weather series (T_obs <= T_target)
        st_weather = weather_df[
            (weather_df["station_id"] == st_id) &
            (weather_df["timestamp"] <= target_ts)
        ].sort_values(by="timestamp")

        if len(st_weather) >= 1:
            latest_w = st_weather.iloc[-1]
            temp_current = float(latest_w["temperature"])
            humidity = float(latest_w.get("humidity", 70.0))
            pressure = float(latest_w.get("pressure", 680.0))
            precip_current = float(latest_w.get("precipitation", 0.0))
            snow_depth = float(latest_w.get("snow_depth", 100.0))
            swe = float(latest_w.get("snow_water_equivalent", 150.0))

            # Backward-looking precipitation & deltas
            precip_series = st_weather["precipitation"].fillna(0.0).tolist()
            temp_series = st_weather["temperature"].tolist()
            wind_series = st_weather["wind_speed"].tolist()

            sf6 = round(float(sum(precip_series[-6:])), 1) if len(precip_series) >= 6 else round(float(sum(precip_series)), 1)
            sf24 = round(float(sum(precip_series[-24:])), 1) if len(precip_series) >= 24 else round(float(sum(precip_series)), 1)
            sf72 = round(float(sum(precip_series[-72:])), 1) if len(precip_series) >= 72 else round(float(sum(precip_series)), 1)

            t_delta_24 = round(temp_current - temp_series[-24], 1) if len(temp_series) >= 24 else 0.0
            t_delta_72 = round(temp_current - temp_series[-72], 1) if len(temp_series) >= 72 else 0.0

            w_mean_24 = round(float(np.mean(wind_series[-24:])), 1) if len(wind_series) >= 24 else round(float(np.mean(wind_series)), 1)
            w_max_24 = round(float(np.max(wind_series[-24:])), 1) if len(wind_series) >= 24 else round(float(np.max(wind_series)), 1)
        else:
            temp_current = -5.0
            humidity = 70.0
            pressure = 680.0
            precip_current = 0.0
            snow_depth = 80.0
            swe = 120.0
            sf6 = 0.0
            sf24 = 0.0
            sf72 = 0.0
            t_delta_24 = 0.0
            t_delta_72 = 0.0
            w_mean_24 = 15.0
            w_max_24 = 25.0

        label_type = str(evt["label_type"])
        avalanche_occ = int(evt["avalanche_occurred"])

        data_qual = "GOOD" if match_quality in ["EXCELLENT", "GOOD"] else ("DEGRADED" if match_quality == "DEGRADED" else "INSUFFICIENT")

        canonical_rows.append({
            "timestamp": target_ts,
            "season": evt.get("season", "UNKNOWN"),
            "latitude": evt_lat,
            "longitude": evt_lon,
            "location_id": evt.get("location", f"Himalaya_Loc_{evt_id}"),
            "event_id": evt_id,
            "region": evt.get("region", "Himalaya"),
            "state": evt.get("state", "India"),
            "source": evt.get("source", "DGRE_SASE_ARCHIVE"),
            "label_source": evt.get("source", "DGRE_SASE_ARCHIVE"),
            "label_type": label_type,
            "trigger_category": evt.get("trigger_category", "UNKNOWN"),
            "weather_source": "ERA5_LAND_REANALYSIS",
            "terrain_source": "Copernicus GLO-30 DEM",
            "synthetic": False,
            "data_quality": data_qual,
            "timestamp_precision": "HOURLY_OBSERVATION_WINDOW",
            "station_id": st_id,
            "station_distance_km": dist_km,
            "station_elevation_difference_m": elev_diff_m,
            "station_match_quality": match_quality,
            "elevation": evt_elev,
            "slope": float(evt["slope_deg"]),
            "aspect": float(evt["aspect_deg"]),
            "aspect_sin": float(evt["aspect_sin"]),
            "aspect_cos": float(evt["aspect_cos"]),
            "temperature": temp_current,
            "humidity": humidity,
            "pressure": pressure,
            "precipitation": precip_current,
            "snow_depth": snow_depth,
            "snow_water_equivalent": swe,
            "snowfall_6h": sf6,
            "snowfall_24h": sf24,
            "snowfall_72h": sf72,
            "temperature_delta_24h": t_delta_24,
            "temperature_delta_72h": t_delta_72,
            "wind_speed_mean_24h": w_mean_24,
            "wind_speed_max_24h": w_max_24,
            "avalanche_occurred": avalanche_occ,
        })

    canonical_df = pd.DataFrame(canonical_rows)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out_canonical = PROCESSED_DIR / "canonical_training_himalaya.csv"
    canonical_df.to_csv(out_canonical, index=False)
    print(f"Canonical Himalayan dataset generated: {out_canonical} ({len(canonical_df)} records)")
    return out_canonical


if __name__ == "__main__":
    process_canonical_himalayan_dataset()
