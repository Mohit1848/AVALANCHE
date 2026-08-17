"""Comprehensive Unit and Integration Tests for FastAPI Avalanche Intelligence Service."""

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Avalanche Risk Intelligence API"
    assert "Research Decision-Support Service" in data["disclaimer"]


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert data["model_loaded"] is True
    assert data["feature_schema_version"] == "v2_spatiotemporal_17f"
    assert "Research Decision-Support Service" in data["disclaimer"]


def test_point_prediction_low_risk():
    """Test standard low-risk point prediction."""
    payload = {
        "latitude": 39.6642,
        "longitude": -105.8789,
        "elevation": 3400.0,
        "slope": 20.0,  # Below avalanche release slope (<30°)
        "aspect": 180.0,
        "temperature": -8.0,
        "humidity": 45.0,
        "pressure": 678.0,
        "precipitation": 0.0,
        "snow_depth": 90.0,
        "snow_water_equivalent": 150.0,
        "snowfall_6h": 0.0,
        "snowfall_24h": 0.0,
        "snowfall_72h": 0.0,
        "temperature_delta_24h": 0.5,
        "temperature_delta_72h": -1.0,
        "wind_speed_mean_24h": 10.0,
        "wind_speed_max_24h": 20.0,
    }
    response = client.post("/predict/point", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["data_quality"] == "GOOD"
    assert data["model_risk_level"] == "LOW"
    assert data["final_risk_level"] == "LOW"
    assert data["risk_escalated"] is False
    assert data["final_risk_score"] is not None


def test_point_prediction_policy_escalation_to_high():
    """Test policy escalation where model probability is moderate (~0.48, MEDIUM)

    but heavy snowfall on steep starting slope deterministically escalates to HIGH.
    """
    payload = {
        "latitude": 39.6642,
        "longitude": -105.8789,
        "elevation": 3654.0,
        "slope": 38.0,  # Steep avalanche terrain
        "aspect": 45.0,
        "temperature": -6.0,
        "humidity": 85.0,
        "pressure": 662.0,
        "precipitation": 5.0,
        "snow_depth": 140.0,
        "snow_water_equivalent": 220.0,
        "snowfall_6h": 12.0,
        "snowfall_24h": 35.0,  # > 30mm heavy snow trigger
        "snowfall_72h": 50.0,
        "temperature_delta_24h": -2.0,
        "temperature_delta_72h": -5.0,
        "wind_speed_mean_24h": 25.0,
        "wind_speed_max_24h": 50.0,
    }
    response = client.post("/predict/point", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["final_risk_level"] == "HIGH"
    assert data["final_risk_score"] >= 70.0
    # Must document escalation reasons
    assert any("Heavy snowfall" in r or "steep" in r for r in data["warnings"])


def test_point_prediction_fail_safe_missing_critical():
    """Verify that omitting slope and temperature returns INSUFFICIENT_DATA and null score."""
    payload = {
        "latitude": 39.6642,
        "longitude": -105.8789,
        "humidity": 78.0,
    }
    response = client.post("/predict/point", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["data_quality"] == "INSUFFICIENT"
    assert data["model_risk_level"] == "INSUFFICIENT_DATA"
    assert data["final_risk_level"] == "INSUFFICIENT_DATA"
    assert data["final_risk_score"] is None
    assert any("Missing critical features" in w for w in data["warnings"])


def test_point_prediction_invalid_bounds_rejected():
    """Verify that physically impossible slope angles (>90 deg) are caught."""
    payload = {
        "latitude": 39.6642,
        "longitude": -105.8789,
        "slope": 125.0,  # Invalid
        "temperature": -5.0,
    }
    response = client.post("/predict/point", json=payload)
    # Pydantic schema validation returns 422
    assert response.status_code == 422
    data = response.json()
    assert data["error_code"] == "INVALID_PAYLOAD_SCHEMA"


def test_telemetry_stream_prediction_and_sorting():
    """Test out-of-order timestamp sorting and rolling feature calculations."""
    payload = {
        "station_id": "335",
        "station_name": "Berthoud Summit",
        "latitude": 39.7980,
        "longitude": -105.7780,
        "elevation": 3444.0,
        "default_slope": 37.0,
        "default_aspect": 90.0,
        "observations": [
            # Deliberately out-of-order timestamps
            {"timestamp": "2024-01-01T18:00:00Z", "temperature": -6.0, "snow_depth": 130.0, "snow_water_equivalent": 215.0, "precipitation": 18.0, "wind_speed": 35.0},
            {"timestamp": "2024-01-01T00:00:00Z", "temperature": -12.0, "snow_depth": 100.0, "snow_water_equivalent": 180.0, "precipitation": 0.0, "wind_speed": 15.0},
            {"timestamp": "2024-01-01T12:00:00Z", "temperature": -8.0, "snow_depth": 115.0, "snow_water_equivalent": 195.0, "precipitation": 6.0, "wind_speed": 25.0},
        ]
    }
    response = client.post("/predict/telemetry", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["final_risk_score"] is not None
    assert "provenance" in data
    assert data["provenance"]["synthetic"] is False


def test_telemetry_temporal_isolation_regression():
    """REGRESSION TEST: Verify that future observations cannot leak into historical window.

    A query up to T=2024-01-01T12:00:00Z must produce the exact same features
    regardless of whether future observations exist in the stream.
    """
    base_observations = [
        {"timestamp": "2024-01-01T00:00:00Z", "temperature": -10.0, "snow_depth": 100.0, "snow_water_equivalent": 180.0, "precipitation": 0.0, "wind_speed": 15.0},
        {"timestamp": "2024-01-01T06:00:00Z", "temperature": -8.0, "snow_depth": 105.0, "snow_water_equivalent": 185.0, "precipitation": 2.0, "wind_speed": 20.0},
        {"timestamp": "2024-01-01T12:00:00Z", "temperature": -7.0, "snow_depth": 110.0, "snow_water_equivalent": 190.0, "precipitation": 3.0, "wind_speed": 22.0},
    ]

    payload_historical = {
        "station_id": "586",
        "latitude": 39.6739,
        "longitude": -105.8972,
        "elevation": 3475.0,
        "default_slope": 36.0,
        "observations": base_observations
    }

    res1 = client.post("/predict/telemetry", json=payload_historical)
    assert res1.status_code == 200
    data1 = res1.json()

    # Add duplicate timestamp (should deduplicate without changing state)
    dedup_observations = list(base_observations) + [
        {"timestamp": "2024-01-01T12:00:00Z", "temperature": -7.0, "snow_depth": 110.0, "snow_water_equivalent": 190.0, "precipitation": 3.0, "wind_speed": 22.0},
    ]
    payload_dedup = {
        "station_id": "586",
        "latitude": 39.6739,
        "longitude": -105.8972,
        "elevation": 3475.0,
        "default_slope": 36.0,
        "observations": dedup_observations
    }
    res2 = client.post("/predict/telemetry", json=payload_dedup)
    assert res2.status_code == 200
    data2 = res2.json()

    # Scores and levels must be identical
    assert data1["final_risk_score"] == data2["final_risk_score"]
    assert data1["final_risk_level"] == data2["final_risk_level"]


def test_model_metadata_and_zones():
    meta_res = client.get("/model/metadata")
    assert meta_res.status_code == 200
    meta_data = meta_res.json()
    assert meta_data["operating_threshold"] == 0.40
    assert len(meta_data["features"]) == 17
    assert "slope" in meta_data["features"]

    zones_res = client.get("/model/zones")
    assert zones_res.status_code == 200
    zones = zones_res.json()
    assert len(zones) >= 7
    assert any(z["name"] == "Front Range" for z in zones)
