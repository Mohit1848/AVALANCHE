"""Feature Engineering & Processing Service.

Extracts, validates, and computes spatiotemporal features with strict temporal isolation.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple
import pandas as pd
from api.schemas import PointPredictionRequest, StationTelemetryBatchRequest


def enrich_point_features(req: PointPredictionRequest) -> Dict[str, Any]:
    """Calculate trigonometric cyclic angles and assemble model feature vector for a point."""
    data = req.model_dump()

    # Cyclic aspect encoding
    aspect = data.get("aspect")
    if aspect is not None:
        aspect_rad = math.radians(float(aspect))
        data["aspect_sin"] = round(math.sin(aspect_rad), 4)
        data["aspect_cos"] = round(math.cos(aspect_rad), 4)
    else:
        data["aspect_sin"] = None
        data["aspect_cos"] = None

    return data


def process_telemetry_batch(req: StationTelemetryBatchRequest) -> Tuple[Dict[str, Any], List[str]]:
    """Process raw station time-series observations into canonical spatiotemporal features.

    Returns:
        (feature_dict, quality_warnings)
    """
    quality_warnings: List[str] = []

    if not req.observations:
        return {}, ["Empty observation stream provided."]

    # Convert to DataFrame
    obs_list = [o.model_dump() for o in req.observations]
    df = pd.DataFrame(obs_list)

    # 1. Parse and Standardize Timestamps
    df["timestamp_dt"] = pd.to_datetime(df["timestamp"], utc=True)

    # 2. Sort chronologically and deduplicate (keep latest update per timestamp)
    df = df.sort_values(by="timestamp_dt").drop_duplicates(subset=["timestamp_dt"], keep="last").reset_index(drop=True)

    # 3. Target observation is strictly target_timestamp or the latest chronological timestamp
    if req.target_timestamp:
        target_dt = pd.to_datetime(req.target_timestamp, utc=True)
        # Filter strictly T <= target_dt to guarantee zero future temporal leakage
        df = df[df["timestamp_dt"] <= target_dt].reset_index(drop=True)
        if len(df) == 0:
            return {}, [f"No observations available at or before target timestamp {req.target_timestamp}."]
    else:
        target_dt = df["timestamp_dt"].iloc[-1]

    current = df.iloc[-1]

    # 4. Check Telemetry Time Span Coverage
    first_dt = df["timestamp_dt"].iloc[0]
    total_hours_span = (target_dt - first_dt).total_seconds() / 3600.0

    if total_hours_span < 24.0:
        quality_warnings.append(
            f"Telemetry time span is only {total_hours_span:.1f} hours (<24h). 24h/72h rolling features may be underestimated."
        )
    elif total_hours_span < 72.0:
        quality_warnings.append(
            f"Telemetry time span is {total_hours_span:.1f} hours (<72h). 72h rolling snowfall may be incomplete."
        )

    # 5. Backward-Looking Slices (Strictly T <= target_dt)
    w6 = df[(df["timestamp_dt"] <= target_dt) & (df["timestamp_dt"] >= (target_dt - timedelta(hours=6)))]
    w24 = df[(df["timestamp_dt"] <= target_dt) & (df["timestamp_dt"] >= (target_dt - timedelta(hours=24)))]
    w72 = df[(df["timestamp_dt"] <= target_dt) & (df["timestamp_dt"] >= (target_dt - timedelta(hours=72)))]

    # 6. Snowfall accumulation calculation
    def calc_snowfall_window(w_df: pd.DataFrame) -> float:
        if len(w_df) < 1:
            return 0.0
        # Method A: Cumulative incremental precipitation
        if "precipitation" in w_df.columns and w_df["precipitation"].notna().any():
            precip_sum = float(w_df["precipitation"].clip(lower=0.0).sum())
            return round(precip_sum, 1)
        # Method B: SWE delta (end - start)
        if "snow_water_equivalent" in w_df.columns:
            valid_swe = w_df["snow_water_equivalent"].dropna()
            if len(valid_swe) >= 2:
                delta = float(valid_swe.iloc[-1] - valid_swe.iloc[0])
                return max(0.0, round(delta, 1))
        return 0.0

    snowfall_6h = calc_snowfall_window(w6)
    snowfall_24h = calc_snowfall_window(w24)
    snowfall_72h = calc_snowfall_window(w72)

    # 7. Temperature Deltas
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

    # 8. Wind Speed Aggregations
    wind_mean_24h = None
    wind_max_24h = None
    if "wind_speed" in w24.columns and w24["wind_speed"].notna().any():
        valid_w = w24["wind_speed"].dropna().clip(lower=0.0)
        if len(valid_w) > 0:
            wind_mean_24h = round(float(valid_w.mean()), 1)
            wind_max_24h = round(float(valid_w.max()), 1)

    # 9. Cyclic Aspect
    aspect = req.default_aspect
    aspect_sin = round(math.sin(math.radians(aspect)), 4) if aspect is not None else None
    aspect_cos = round(math.cos(math.radians(aspect)), 4) if aspect is not None else None

    # 10. Assemble Feature Vector
    features = {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "location_id": f"SNTL_{req.station_id}",
        "elevation": req.elevation,
        "slope": req.default_slope,
        "aspect": aspect,
        "aspect_sin": aspect_sin,
        "aspect_cos": aspect_cos,
        "temperature": float(current["temperature"]) if pd.notna(current.get("temperature")) else None,
        "humidity": 70.0,
        "pressure": round(675.0 - ((req.elevation - 3000.0) * 0.08), 1),
        "precipitation": float(current["precipitation"]) if pd.notna(current.get("precipitation")) else 0.0,
        "snow_depth": float(current["snow_depth"]) if pd.notna(current.get("snow_depth")) else None,
        "snow_water_equivalent": float(current["snow_water_equivalent"]) if pd.notna(current.get("snow_water_equivalent")) else None,
        "snowfall_6h": snowfall_6h,
        "snowfall_24h": snowfall_24h,
        "snowfall_72h": snowfall_72h,
        "temperature_delta_24h": temp_delta_24h,
        "temperature_delta_72h": temp_delta_72h,
        "wind_speed_mean_24h": wind_mean_24h,
        "wind_speed_max_24h": wind_max_24h,
        "timestamp": target_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "station_distance_km": 0.0,
        "station_match_quality": "EXCELLENT",
        "data_quality": "DEGRADED" if quality_warnings else "GOOD",
    }

    return features, quality_warnings
