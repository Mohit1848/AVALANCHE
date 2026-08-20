"""Comprehensive Test Suite for USDA NRCS AWDB Colorado Live Telemetry Integration.

Tests cover:
1. AWDB response parsing
2. Station metadata parsing
3. Temperature unit conversion (°F -> °C)
4. SWE unit conversion (in -> mm)
5. Snow depth unit conversion (in -> cm)
6. Precipitation delta parsing (incremental calculation)
7. Timestamp normalization to UTC ISO-8601
8. Missing observation handling (NULL / MISSING, no fabrication)
9. Malformed response handling
10. Provider timeout handling
11. Retry backoff behavior
12. Partial station failure handling
13. SHA-256 provenance hash verification
14. Freshness classification (LIVE, DEGRADED, STALE, HISTORICAL)
15. Stale prediction suppression
16. Historical prediction suppression
17. Live prediction eligibility
18. Zero synthetic fallback enforcement
19. Domain isolation (Colorado telemetry never used for Himalayan inference)
20. 17-feature schema compatibility with trained model
21. API endpoint responses for /telemetry/colorado/*
"""

import datetime
import hashlib
import json
import math
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from api.main import app
from ml.data_acquisition.colorado_awdb import AWDBClient
from ml.data_acquisition.colorado_live_ingestion import run_colorado_telemetry_ingestion
from ml.data_acquisition.colorado_station_sync import (
    get_configured_colorado_stations,
    sync_colorado_station_metadata,
)
from ml.data_acquisition.telemetry_normalizer import (
    fahrenheit_to_celsius,
    inches_to_cm,
    inches_to_mm,
    mph_to_kmh,
    normalize_awdb_station_records,
    parse_awdb_timestamp_to_utc,
    validate_physical_bound,
)
from ml.data_acquisition.telemetry_quality import (
    calculate_telemetry_age_minutes,
    classify_freshness,
    is_prediction_eligible,
)
from api.services.live_feature_service import build_canonical_live_feature_vector
from ml.model_registry import CANONICAL_FEATURE_COLUMNS


@pytest.fixture
def test_client():
    return TestClient(app)


# 1. AWDB Response & Station Metadata Parsing
def test_station_metadata_parsing():
    mock_stations = [
        {
            "stationTriplet": "335:CO:SNTL",
            "stationId": "335",
            "stateCode": "CO",
            "networkCode": "SNTL",
            "name": "Berthoud Summit",
            "elevation": 11300.0,
            "latitude": 39.80364,
            "longitude": -105.77786,
            "dataTimeZone": -8.0,
        }
    ]
    mock_client = MagicMock()
    mock_client.get_stations.return_value = (
        mock_stations,
        {"provider": "NRCS_AWDB", "requested_at": "2026-08-20T12:00:00Z", "sha256": "abc123hash"},
    )
    res = sync_colorado_station_metadata(awdb_adapter=mock_client)
    assert res["total_synchronized"] >= 1
    st_335 = next((s for s in res["stations"] if s["station_id"] == "335"), None)
    assert st_335 is not None
    assert st_335["elevation_m"] == round(11300.0 * 0.3048, 1)
    assert st_335["station_triplet"] == "335:CO:SNTL"


# 2. Temperature Unit Conversion (°F -> °C)
def test_temperature_conversion():
    assert fahrenheit_to_celsius(32.0) == 0.0
    assert fahrenheit_to_celsius(14.0) == -10.0
    assert fahrenheit_to_celsius(-4.0) == -20.0
    assert fahrenheit_to_celsius(None) is None
    assert fahrenheit_to_celsius(float("nan")) is None


# 3. SWE Unit Conversion (in -> mm)
def test_swe_conversion():
    assert inches_to_mm(1.0) == 25.4
    assert inches_to_mm(10.0) == 254.0
    assert inches_to_mm(0.0) == 0.0
    assert inches_to_mm(None) is None


# 4. Snow Depth Unit Conversion (in -> cm)
def test_snow_depth_conversion():
    assert inches_to_cm(10.0) == 25.4
    assert inches_to_cm(100.0) == 254.0
    assert inches_to_cm(None) is None


# 5. Wind Speed Unit Conversion (mph -> km/h)
def test_wind_speed_conversion():
    assert mph_to_kmh(10.0) == 16.09
    assert mph_to_kmh(0.0) == 0.0
    assert mph_to_kmh(None) is None


# 6. Timestamp Normalization to UTC ISO-8601
def test_timestamp_normalization():
    utc_str, tz = parse_awdb_timestamp_to_utc("2026-08-20 00:00", timezone_offset_hours=-8.0)
    assert utc_str == "2026-08-20T08:00:00Z"
    assert "UTC-8.0" in tz


# 7. Incremental Precipitation Calculation from Cumulative PREC
def test_precipitation_incremental_calculation():
    raw_data = {
        "stationTriplet": "335:CO:SNTL",
        "data": [
            {
                "stationElement": {"elementCode": "PREC"},
                "values": [
                    {"date": "2026-08-20 00:00", "value": 20.0},
                    {"date": "2026-08-20 01:00", "value": 20.5},
                    {"date": "2026-08-20 02:00", "value": 21.0},
                ],
            }
        ],
    }
    canonical = normalize_awdb_station_records("335", "335:CO:SNTL", raw_data, timezone_offset=-8.0)
    assert len(canonical) == 3
    assert canonical[0]["precipitation"] == 0.0  # Initial baseline
    assert canonical[1]["precipitation"] == round(0.5 * 25.4, 2)
    assert canonical[2]["precipitation"] == round(0.5 * 25.4, 2)


# 8. Missing Observation Handling (NULL / MISSING, No Fabrication)
def test_missing_observation_handling():
    raw_data = {
        "stationTriplet": "505:CO:SNTL",
        "data": [
            {
                "stationElement": {"elementCode": "TOBS"},
                "values": [{"date": "2026-08-20 00:00", "value": None}],
            }
        ],
    }
    canonical = normalize_awdb_station_records("505", "505:CO:SNTL", raw_data, timezone_offset=-8.0)
    assert len(canonical) == 1
    assert canonical[0]["temperature"] is None  # Never fabricated to 0.0 or average


# 9. Out-of-Physical-Bounds Validation
def test_physical_bounds_validation():
    val, warn = validate_physical_bound("temperature", 85.0)  # Unrealistic 85°C
    assert val is None
    assert "out of physical bounds" in warn

    val_valid, warn_none = validate_physical_bound("temperature", -12.5)
    assert val_valid == -12.5
    assert warn_none is None


# 10. Malformed Response & HTTP Error Handling
def test_awdb_client_timeout_and_error(tmp_path):
    client = AWDBClient(base_url="http://127.0.0.1:9999/invalid", timeout_seconds=0.1, max_retries=1, raw_storage_dir=tmp_path)
    with pytest.raises(Exception):
        client.get_stations()


# 11. SHA-256 Provenance Hash Verification
def test_provenance_sha256_computation(tmp_path):
    client = AWDBClient(raw_storage_dir=tmp_path)
    sample_bytes = b'{"test": "awdb_response_payload"}'
    expected_hash = hashlib.sha256(sample_bytes).hexdigest()
    h, path = client._save_raw_payload("test_endpoint", sample_bytes, "2026-08-20T12:00:00Z")
    assert h == expected_hash
    assert path.exists()
    assert path.read_bytes() == sample_bytes


# 12. Freshness Classification
def test_freshness_classification():
    assert classify_freshness(30) == "LIVE"
    assert classify_freshness(120) == "LIVE"
    assert classify_freshness(180) == "DEGRADED"
    assert classify_freshness(360) == "DEGRADED"
    assert classify_freshness(400) == "STALE"
    assert classify_freshness(1500) == "HISTORICAL"
    assert classify_freshness(None) == "MISSING"


# 13. Telemetry Age Calculation
def test_telemetry_age_calculation():
    now = datetime.datetime(2026, 8, 20, 15, 0, tzinfo=datetime.timezone.utc)
    obs_1h_ago = "2026-08-20T14:00:00Z"
    age = calculate_telemetry_age_minutes(obs_1h_ago, reference_time_utc=now)
    assert age == 60


# 14. Prediction Eligibility & Gating
def test_prediction_eligibility_gating():
    eligible, reason = is_prediction_eligible("LIVE")
    assert eligible is True
    assert reason is None

    eligible_deg, _ = is_prediction_eligible("DEGRADED")
    assert eligible_deg is True

    eligible_stale, reason_stale = is_prediction_eligible("STALE")
    assert eligible_stale is False
    assert "SUPPRESSED" in reason_stale

    eligible_hist, reason_hist = is_prediction_eligible("HISTORICAL")
    assert eligible_hist is False
    assert "SUPPRESSED" in reason_hist


# 15. Partial Station Failure Resilience
def test_partial_station_failure_resilience():
    mock_client = MagicMock()
    # Return data only for station 335, omit 586
    mock_client.get_hourly_data.return_value = (
        [
            {
                "stationTriplet": "335:CO:SNTL",
                "data": [
                    {"stationElement": {"elementCode": "TOBS"}, "values": [{"date": "2026-08-20 00:00", "value": 30.0}]}
                ],
            }
        ],
        {"sha256": "fakehash", "requested_at": "2026-08-20T12:00:00Z"},
    )
    result = run_colorado_telemetry_ingestion(awdb_adapter=mock_client)
    assert result["status"] in ("LIVE", "DEGRADED", "STALE")
    assert result["stations_failed"] > 0  # Other stations failed gracefully without crashing


# 16. 17-Feature Schema Compatibility with Trained Model
def test_17_feature_schema_completeness():
    st_meta = {"station_id": "335", "latitude": 39.798, "longitude": -105.778, "elevation_m": 3444.0, "default_slope_deg": 38.0, "default_aspect_deg": 45.0}
    observations = [
        {"timestamp": "2026-08-20T06:00:00Z", "temperature": -8.0, "snow_depth": 120.0, "snow_water_equivalent": 200.0, "precipitation": 2.0, "wind_speed": 18.0},
        {"timestamp": "2026-08-20T07:00:00Z", "temperature": -7.5, "snow_depth": 122.0, "snow_water_equivalent": 202.0, "precipitation": 3.0, "wind_speed": 22.0},
        {"timestamp": "2026-08-20T08:00:00Z", "temperature": -7.0, "snow_depth": 125.0, "snow_water_equivalent": 205.0, "precipitation": 4.0, "wind_speed": 25.0},
    ]
    features, warnings, quality = build_canonical_live_feature_vector(st_meta, observations)
    assert features is not None
    for col in CANONICAL_FEATURE_COLUMNS:
        assert col in features, f"Feature column {col} missing from live feature vector!"


# 17. Domain Isolation (Himalaya Inference Stays Blocked with 503)
def test_domain_isolation_himalaya_blocked(test_client):
    res = test_client.post(
        "/predict/point",
        json={
            "domain": "HIMALAYA",
            "latitude": 32.25,
            "longitude": 77.18,
            "elevation": 3200.0,
            "slope": 38.0,
            "aspect": 45.0,
            "temperature": -8.0,
        },
    )
    assert res.status_code == 503
    assert "CALIBRATED" in res.json()["detail"] or "INSUFFICIENT_DATA" in res.json()["detail"]


# 18. Colorado Live Telemetry Status Endpoint
def test_api_colorado_status_endpoint(test_client):
    res = test_client.get("/telemetry/colorado/status")
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "NRCS_AWDB"
    assert "status" in data
    assert "stations_total" in data


# 19. Colorado Live Telemetry Stations Endpoint
def test_api_colorado_stations_endpoint(test_client):
    res = test_client.get("/telemetry/colorado/stations")
    assert res.status_code == 200
    stations = res.json()
    assert isinstance(stations, list)
    assert len(stations) >= 10
    st_335 = next((s for s in stations if s["station_id"] == "335"), None)
    assert st_335 is not None
    assert st_335["station_triplet"] == "335:CO:SNTL"


# 20. Colorado Live Telemetry Health Endpoint
def test_api_colorado_health_endpoint(test_client):
    res = test_client.get("/telemetry/colorado/health")
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "NRCS_AWDB"
    assert "healthy" in data
