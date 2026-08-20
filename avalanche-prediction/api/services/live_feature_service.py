"""Live Feature Vector Generation Service.

Converts live/provisional SNOTEL telemetry time-series into the exact 17-feature canonical
vector required by the calibrated Colorado Random Forest model.
"""

from __future__ import annotations

import datetime
import math
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd

from ml.model_registry import CANONICAL_FEATURE_COLUMNS


def build_canonical_live_feature_vector(
    station_meta: Dict[str, Any],
    observations: List[Dict[str, Any]],
    target_timestamp_utc: Optional[str] = None,
    slope: Optional[float] = None,
    aspect: Optional[float] = None,
) -> Tuple[Optional[Dict[str, Any]], List[str], str]:
    """Construct exact 17-feature vector from chronological observations at or before target timestamp.

    Returns:
        (feature_dict, quality_warnings, data_quality_level)
    """
    quality_warnings: List[str] = []

    if not observations:
        return None, ["No telemetry observations available for feature extraction."], "INSUFFICIENT"

    df = pd.DataFrame(observations)
    if "timestamp" not in df.columns or len(df) == 0:
        return None, ["Malformed telemetry observations provided."], "INSUFFICIENT"

    # 1. Parse and Standardize Timestamps
    df["timestamp_dt"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values(by="timestamp_dt").drop_duplicates(subset=["timestamp_dt"], keep="last").reset_index(drop=True)

    # 2. Strict Temporal Isolation (T_obs <= T_target)
    if target_timestamp_utc:
        target_dt = pd.to_datetime(target_timestamp_utc, utc=True)
        df = df[df["timestamp_dt"] <= target_dt].reset_index(drop=True)
        if len(df) == 0:
            return None, [f"No observations recorded at or before target timestamp {target_timestamp_utc}."], "INSUFFICIENT"
    else:
        target_dt = df["timestamp_dt"].iloc[-1]

    current = df.iloc[-1]
    first_dt = df["timestamp_dt"].iloc[0]
    total_hours_span = (target_dt - first_dt).total_seconds() / 3600.0

    if total_hours_span < 24.0:
        quality_warnings.append(
            f"Available time-series span is {total_hours_span:.1f}h (<24h). Rolling multi-hour features may be underestimated."
        )
    elif total_hours_span < 72.0:
        quality_warnings.append(
            f"Available time-series span is {total_hours_span:.1f}h (<72h). 72h storm snowfall window is partially covered."
        )

    # 3. Backward-Looking Rolling Windows (Strictly T <= target_dt)
    w6 = df[(df["timestamp_dt"] <= target_dt) & (df["timestamp_dt"] >= (target_dt - datetime.timedelta(hours=6)))]
    w24 = df[(df["timestamp_dt"] <= target_dt) & (df["timestamp_dt"] >= (target_dt - datetime.timedelta(hours=24)))]
    w72 = df[(df["timestamp_dt"] <= target_dt) & (df["timestamp_dt"] >= (target_dt - datetime.timedelta(hours=72)))]

    # 4. Snowfall Accumulation (mm SWE)
    def calc_snowfall(w_df: pd.DataFrame) -> float:
        if len(w_df) < 1:
            return 0.0
        # Sum incremental hourly precipitation if present
        if "precipitation" in w_df.columns and w_df["precipitation"].notna().any():
            precip_sum = float(w_df["precipitation"].clip(lower=0.0).sum())
            return round(precip_sum, 1)
        # Fallback: SWE delta
        if "snow_water_equivalent" in w_df.columns:
            valid_swe = w_df["snow_water_equivalent"].dropna()
            if len(valid_swe) >= 2:
                delta = float(valid_swe.iloc[-1] - valid_swe.iloc[0])
                return max(0.0, round(delta, 1))
        return 0.0

    snowfall_6h = calc_snowfall(w6)
    snowfall_24h = calc_snowfall(w24)
    snowfall_72h = calc_snowfall(w72)

    # 5. Temperature Deltas (°C)
    temp_delta_24h = 0.0
    if len(w24) >= 2 and "temperature" in w24.columns:
        valid_t = w24["temperature"].dropna()
        if len(valid_t) >= 2:
            temp_delta_24h = round(float(valid_t.iloc[-1] - valid_t.iloc[0]), 1)

    temp_delta_72h = 0.0
    if len(w72) >= 2 and "temperature" in w72.columns:
        valid_t = w72["temperature"].dropna()
        if len(valid_t) >= 2:
            temp_delta_72h = round(float(valid_t.iloc[-1] - valid_t.iloc[0]), 1)

    # 6. Wind Speed Metrics (km/h)
    wind_mean_24h = None
    wind_max_24h = None
    if "wind_speed" in w24.columns and w24["wind_speed"].notna().any():
        valid_w = w24["wind_speed"].dropna().clip(lower=0.0)
        if len(valid_w) > 0:
            wind_mean_24h = round(float(valid_w.mean()), 1)
            wind_max_24h = round(float(valid_w.max()), 1)
    else:
        quality_warnings.append("Station lacks active wind sensor telemetry (WSPDV unavailable).")

    # 7. Terrain & Cyclic Aspect
    st_slope = slope if slope is not None else station_meta.get("default_slope_deg", 36.0)
    st_aspect = aspect if aspect is not None else station_meta.get("default_aspect_deg", 45.0)
    st_elev = station_meta.get("elevation_m", 3400.0)

    aspect_sin = round(math.sin(math.radians(st_aspect)), 4) if st_aspect is not None else 0.0
    aspect_cos = round(math.cos(math.radians(st_aspect)), 4) if st_aspect is not None else 0.0

    # 8. Atmospheric Barometric Baseline
    pressure_hpa = round(675.0 - ((float(st_elev) - 3000.0) * 0.08), 1)

    # 9. Current Instantaneous Readings
    cur_temp = float(current["temperature"]) if pd.notna(current.get("temperature")) else None
    cur_depth = float(current["snow_depth"]) if pd.notna(current.get("snow_depth")) else None
    cur_swe = float(current["snow_water_equivalent"]) if pd.notna(current.get("snow_water_equivalent")) else None
    cur_precip = float(current["precipitation"]) if pd.notna(current.get("precipitation")) else 0.0

    # Assemble canonical 17-feature dictionary
    features: Dict[str, Any] = {
        "slope": float(st_slope),
        "aspect_sin": aspect_sin,
        "aspect_cos": aspect_cos,
        "elevation": float(st_elev),
        "temperature": cur_temp,
        "humidity": 70.0,
        "pressure": pressure_hpa,
        "precipitation": cur_precip,
        "snow_depth": cur_depth,
        "snow_water_equivalent": cur_swe,
        "snowfall_6h": snowfall_6h,
        "snowfall_24h": snowfall_24h,
        "snowfall_72h": snowfall_72h,
        "temperature_delta_24h": temp_delta_24h,
        "temperature_delta_72h": temp_delta_72h,
        "wind_speed_mean_24h": wind_mean_24h if wind_mean_24h is not None else 15.0,  # Baseline fallback for model vector if sensor absent
        "wind_speed_max_24h": wind_max_24h if wind_max_24h is not None else 30.0,
    }

    # Additional contextual metadata
    features["latitude"] = station_meta.get("latitude")
    features["longitude"] = station_meta.get("longitude")
    features["aspect"] = st_aspect
    features["timestamp"] = target_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    data_quality = "DEGRADED" if quality_warnings else "GOOD"
    return features, quality_warnings, data_quality
