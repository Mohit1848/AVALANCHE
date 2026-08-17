"""Unit and leakage tests for data acquisition, normalization, and spatial matching."""

from datetime import datetime, timedelta
import pandas as pd
import pytest

from ml.data_acquisition.fetch_caic import (
    classify_trigger,
    determine_timestamp_precision,
    normalize_caic_dataframe,
)
from ml.data_acquisition.spatial_joiner import (
    categorize_match_quality,
    extract_snotel_72h_window,
    find_best_snotel_station,
    haversine_distance_km,
)


def test_haversine_distance_calculation():
    # Distance between Loveland Pass (39.6642, -105.8789) and Loveland Basin SNOTEL (39.6739, -105.8972)
    dist = haversine_distance_km(39.6642, -105.8789, 39.6739, -105.8972)
    assert 1.5 < dist < 2.5
    assert categorize_match_quality(dist, 180.0) == "EXCELLENT"


def test_spatial_matching_nearest_station():
    stations_df = pd.DataFrame([
        {"station_triplet": "335:CO:SNTL", "station_id": "335", "name": "Berthoud", "latitude": 39.798, "longitude": -105.778, "elevation_m": 3444},
        {"station_triplet": "586:CO:SNTL", "station_id": "586", "name": "Loveland", "latitude": 39.674, "longitude": -105.897, "elevation_m": 3475},
    ])
    
    # Event near Berthoud Pass
    match = find_best_snotel_station(39.805, -105.772, 3550.0, stations_df)
    assert match["station_id"] == "335"
    assert match["station_distance_km"] < 2.0
    assert match["station_match_quality"] == "EXCELLENT"


def test_snotel_72h_window_zero_future_leakage():
    # Construct time series with historical points and a future point
    target_dt = datetime(2023, 1, 10, 12, 0)
    timestamps = [target_dt - timedelta(hours=i) for i in range(100, -5, -1)]  # From -100h up to +4h in future
    
    obs_df = pd.DataFrame({
        "timestamp": timestamps,
        "TOBS": [20.0 + i for i in range(len(timestamps))],
        "PREC": [10.0 + (i * 0.1) for i in range(len(timestamps))],
        "SNWD": [40.0 for _ in range(len(timestamps))],
        "WTEQ": [10.0 for _ in range(len(timestamps))],
    })
    
    feats = extract_snotel_72h_window(obs_df, target_dt)
    
    # Verify that future rows (> 12:00) were NOT included in current temperature or precipitation
    # Row at 12:00 has TOBS corresponding to target_dt
    t_target_f = obs_df[obs_df["timestamp"] == target_dt]["TOBS"].iloc[0]
    expected_temp_c = round((t_target_f - 32.0) * 5.0 / 9.0, 1)
    
    assert feats["temperature"] == expected_temp_c


def test_caic_trigger_classification():
    assert classify_trigger("Skier triggered slab", "AS") == "HUMAN_TRIGGERED"
    assert classify_trigger("Snowboarder caught", "AB") == "HUMAN_TRIGGERED"
    assert classify_trigger("Natural storm cycle", "N") == "NATURAL"
    assert classify_trigger("Explosive mitigation", "AE") == "EXPLOSIVE"
    assert classify_trigger("Unknown release", "U") == "OTHER_UNKNOWN"


def test_caic_timestamp_precision():
    assert determine_timestamp_precision("14:30") == "EXACT_HOUR"
    assert determine_timestamp_precision("09:15") == "EXACT_HOUR"
    assert determine_timestamp_precision("2 pm") == "ESTIMATED_HOUR"
    assert determine_timestamp_precision(None) == "DAILY_MAX_ESTIMATE"
    assert determine_timestamp_precision("") == "DAILY_MAX_ESTIMATE"
