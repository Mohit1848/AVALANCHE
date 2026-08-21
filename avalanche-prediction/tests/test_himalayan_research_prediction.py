"""Tests for Himalayan Model Research Prediction Endpoint and Gating Isolation."""

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


class TestHimalayanResearchPredictionEndpoint:
    """Validate dedicated non-operational Himalayan research inference."""

    def test_himalayan_operational_inference_remains_blocked_http_503(self):
        """Operational prediction on /predict/point must remain blocked with HTTP 503."""
        payload = {
            "domain": "HIMALAYA",
            "latitude": 27.988,
            "longitude": 86.925,
            "elevation": 5364.0,
            "slope": 44.0,
            "aspect": 210.0,
        }
        res = client.post("/predict/point", json=payload)
        assert res.status_code == 503, "Operational Himalayan inference must remain strictly blocked"
        assert "not enabled" in res.json()["detail"].lower() or "insufficient_data" in res.json()["detail"].lower()

    def test_himalayan_research_prediction_success_mount_everest(self):
        """Research prediction on /model/himalaya/research-predict produces real model outputs."""
        payload = {
            "location_id": "Mount Everest - Khumbu Icefall",
            "latitude": 27.988,
            "longitude": 86.925,
            "elevation": 5364.0,
            "slope": 44.0,
            "aspect": 210.0,
            "temperature": -18.5,
            "snow_depth": 190.0,
            "snow_water_equivalent": 320.0,
            "snowfall_6h": 15.0,
            "snowfall_24h": 38.0,
            "snowfall_72h": 75.0,
            "temperature_delta_24h": -2.0,
            "wind_speed_mean_24h": 35.0,
            "wind_speed_max_24h": 72.0,
            "source": "CUSTOM_CSV",
        }

        res = client.post("/model/himalaya/research-predict", json=payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

        data = res.json()
        assert data["domain"] == "HIMALAYA"
        assert data["mode"] == "RESEARCH"
        assert data["model_state"] == "CALIBRATED"
        assert data["operational_enabled"] is False
        assert data["research_prediction_enabled"] is True

        # Valid numeric probability & risk score from real Himalayan model
        assert isinstance(data["probability"], float)
        assert 0.0 <= data["probability"] <= 1.0
        assert isinstance(data["risk_score"], float)
        assert 0.0 <= data["risk_score"] <= 100.0
        assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]

        # High risk conditions on steep 44° slope with 38mm snowfall
        assert data["risk_level"] == "HIGH"
        assert data["risk_score"] >= 70.0

        # Mandatory safety warnings
        assert "RESEARCH ONLY" in data["warning"]
        assert "not a certified avalanche warning" in data["disclaimer"].lower()

    def test_himalayan_research_prediction_low_risk_scenario(self):
        """Gentle slope with no snowfall produces a lower probability."""
        payload = {
            "location_id": "Low Risk Himalayan Valley",
            "latitude": 32.243,
            "longitude": 77.189,
            "elevation": 2050.0,
            "slope": 12.0,  # Below avalanche threshold
            "aspect": 180.0,
            "temperature": 4.0,
            "snow_depth": 10.0,
            "snow_water_equivalent": 15.0,
            "snowfall_6h": 0.0,
            "snowfall_24h": 0.0,
            "snowfall_72h": 0.0,
            "temperature_delta_24h": 1.0,
            "wind_speed_mean_24h": 5.0,
            "wind_speed_max_24h": 12.0,
            "source": "CUSTOM_CSV",
        }

        res = client.post("/model/himalaya/research-predict", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["probability"] < 0.40
        assert data["risk_level"] == "LOW"

    def test_himalayan_research_prediction_deterministic(self):
        """Repeated research prediction calls with identical inputs must be strictly deterministic."""
        payload = {
            "location_id": "Determinism Test Peak",
            "latitude": 34.150,
            "longitude": 74.800,
            "elevation": 3950.0,
            "slope": 37.0,
            "aspect": 45.0,
            "temperature": -8.0,
            "snowfall_24h": 22.0,
        }

        res1 = client.post("/model/himalaya/research-predict", json=payload)
        res2 = client.post("/model/himalaya/research-predict", json=payload)

        assert res1.status_code == 200
        assert res2.status_code == 200
        assert res1.json()["probability"] == res2.json()["probability"]
        assert res1.json()["risk_score"] == res2.json()["risk_score"]

    def test_himalayan_research_prediction_missing_required_bounds_rejected_422(self):
        """Missing or out-of-bounds coordinates return HTTP 422."""
        invalid_payload = {
            "latitude": 150.0,  # Invalid latitude
            "longitude": 86.925,
            "elevation": 5364.0,
            "slope": 44.0,
        }
        res = client.post("/model/himalaya/research-predict", json=invalid_payload)
        assert res.status_code == 422
