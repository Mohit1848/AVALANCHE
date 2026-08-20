"""Tests for Domain-Aware Avalanche Prediction Architecture, Scientific Gating, and Zero-Fallback Policy."""

import pytest
from fastapi.testclient import TestClient
from api.main import app
from ml.model_registry import (
    model_registry,
    Domain,
    GatingState,
    ModelUnavailableError,
    DomainMismatchError,
)
from ml.data_acquisition.audit_himalaya_data import audit_workspace
from ml.spatial.idw import load_idw_config

client = TestClient(app)


class TestHimalayanGatingAndAudit:
    """Validate the Himalayan Model Gating State Machine and audit results."""

    def test_audit_identifies_data_status(self):
        """Audit must accurately inventory repository records and gating verdict."""
        audit = audit_workspace()
        assert audit["status"] in ["GEOGRAPHIC_ONLY", "DATA_AUDITED", "TRAINING_READY"]
        assert audit["readiness_verdict"] in ["NOT_READY", "TRAINING_READY"]

    def test_himalayan_gating_state_blocks_model_enablement(self):
        """ModelRegistry must report Himalayan domain as not model-enabled."""
        assert model_registry.is_model_enabled(Domain.HIMALAYA) is False
        assert model_registry.is_model_enabled(Domain.INDIA) is False
        assert model_registry.is_model_enabled(Domain.NEPAL) is False
        assert model_registry.is_model_enabled(Domain.BHUTAN) is False
        assert model_registry.is_model_enabled(Domain.PAKISTAN) is False
        assert model_registry.is_model_enabled(Domain.COLORADO) is True

    def test_get_himalayan_model_raises_model_unavailable(self):
        """Attempting to load Himalayan model artifact must raise ModelUnavailableError."""
        with pytest.raises(ModelUnavailableError) as exc_info:
            model_registry.get_model_bundle(Domain.HIMALAYA)
        assert "Zero-fallback" in str(exc_info.value)


class TestZeroFallbackPolicy:
    """Validate that API endpoints never silently invoke Colorado model for Himalayan coordinates."""

    def test_himalayan_point_prediction_rejected_503(self):
        """Point prediction for Himalaya must return HTTP 503 and clear refusal message."""
        payload = {
            "domain": "HIMALAYA",
            "latitude": 32.37,  # Rohtang Pass, India
            "longitude": 77.24,
            "elevation": 3978.0,
            "slope": 38.0,
            "temperature": -8.0,
        }
        resp = client.post("/predict/point", json=payload)
        assert resp.status_code == 503
        data = resp.json()
        assert "Zero-fallback" in data["detail"]

    def test_himalayan_telemetry_prediction_rejected_503(self):
        """Telemetry prediction for Himalaya must return HTTP 503."""
        payload = {
            "domain": "HIMALAYA",
            "station_id": "IMD-KEYLONG",
            "latitude": 32.57,
            "longitude": 77.03,
            "elevation": 3080.0,
            "observations": [
                {"timestamp": "2026-02-15T12:00:00Z", "temperature": -6.0, "snow_depth": 85.0}
            ],
        }
        resp = client.post("/predict/telemetry", json=payload)
        assert resp.status_code == 503
        data = resp.json()
        assert "Zero-fallback" in data["detail"] or "NOT available" in data["detail"]

    def test_himalayan_spatial_prediction_rejected_503(self):
        """Spatial risk surface for Himalaya must return HTTP 503."""
        payload = {
            "domain": "HIMALAYA",
            "min_latitude": 32.0,
            "max_latitude": 33.0,
            "min_longitude": 76.5,
            "max_longitude": 77.5,
        }
        resp = client.post("/spatial/predict/spatial", json=payload)
        assert resp.status_code == 503
        data = resp.json()
        assert "Zero-fallback" in data["detail"]


class TestCoordinateAndDomainValidation:
    """Validate spatial bounding box protection and domain mismatch rejection."""

    def test_indian_coordinates_with_colorado_domain_rejected_422(self):
        """Sending Himalayan coordinates under Colorado domain must be rejected with HTTP 422."""
        payload = {
            "domain": "COLORADO",
            "latitude": 30.376,  # Nanda Devi, India
            "longitude": 79.971,
            "slope": 38.0,
            "temperature": -10.0,
        }
        resp = client.post("/predict/point", json=payload)
        assert resp.status_code == 422
        assert "outside valid bounding box for COLORADO" in resp.json()["detail"]

    def test_colorado_coordinates_with_himalayan_domain_rejected_422(self):
        """Sending Colorado coordinates under Himalayan domain must be rejected with HTTP 422."""
        payload = {
            "domain": "HIMALAYA",
            "latitude": 39.75,  # Berthoud Pass, CO
            "longitude": -105.80,
            "slope": 38.0,
            "temperature": -6.0,
        }
        resp = client.post("/predict/point", json=payload)
        assert resp.status_code == 422
        assert "outside valid bounding box for HIMALAYA" in resp.json()["detail"]

    def test_invalid_domain_rejected_422(self):
        """Passing an unknown domain string must be rejected with HTTP 422."""
        payload = {
            "domain": "MARS_ALPINE",
            "latitude": 39.75,
            "longitude": -105.80,
        }
        resp = client.post("/predict/point", json=payload)
        assert resp.status_code == 422


class TestModelEndpointsAndDomainIsolation:
    """Validate model status, compare, and metadata endpoints across domains."""

    def test_get_domain_status_colorado(self):
        resp = client.get("/model/status?domain=COLORADO")
        assert resp.status_code == 200
        data = resp.json()
        assert data["domain"] == "COLORADO"
        assert data["gating_state"] == "MODEL_ENABLED"
        assert data["model_loaded"] is True

    def test_get_domain_status_himalaya(self):
        resp = client.get("/model/status?domain=HIMALAYA")
        assert resp.status_code == 200
        data = resp.json()
        assert data["domain"] == "HIMALAYA"
        assert data["gating_state"] in ["DATA_AUDITED", "TRAINING_READY", "CALIBRATED"]

    def test_get_cross_domain_comparison(self):
        resp = client.get("/model/compare")
        assert resp.status_code == 200
        data = resp.json()
        assert "comparison_title" in data
        assert "domains" in data
        assert "colorado" in data["domains"]
        assert "himalaya" in data["domains"]
        assert "metrics_table" in data
        assert "domain_shift_experiment" in data

    def test_get_model_metadata_domain_aware(self):
        resp_co = client.get("/model/metadata?domain=COLORADO")
        assert resp_co.status_code == 200
        assert resp_co.json()["domain"] == "COLORADO"

        resp_him = client.get("/model/metadata?domain=HIMALAYA")
        assert resp_him.status_code == 200
        assert resp_him.json()["domain"] == "HIMALAYA"

    def test_forecast_zones_domain_switching(self):
        resp_co = client.get("/spatial/zones?domain=COLORADO")
        assert resp_co.status_code == 200
        assert len(resp_co.json()) >= 6
        assert resp_co.json()[0]["domain"] == "COLORADO"

        resp_him = client.get("/spatial/zones?domain=HIMALAYA")
        assert resp_him.status_code == 200
        assert len(resp_him.json()) >= 5
        assert resp_him.json()[0]["domain"] == "HIMALAYA"


class TestSpatialConfigAndIsolation:
    """Validate domain-isolated spatial configuration."""

    def test_colorado_idw_config(self):
        cfg = load_idw_config("COLORADO")
        assert cfg["default_search_radius_km"] == 35.0
        assert cfg["min_stations"] == 2

    def test_himalaya_idw_config(self):
        cfg = load_idw_config("HIMALAYA")
        assert cfg["default_search_radius_km"] == 65.0
        assert cfg["max_stations"] == 5
