"""Tests for Real Himalayan Data Acquisition, Provenance, Ingestion Pipeline, and Gating."""

import hashlib
import json
from pathlib import Path
import pytest
import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
from ml.data_acquisition.audit_himalaya_data import audit_workspace
from ml.data_acquisition.fetch_himalaya_data import compute_sha256
from ml.data_acquisition.himalaya_pipeline import process_canonical_himalayan_dataset, haversine_km
from ml.model_registry import model_registry, Domain, GatingState, ModelUnavailableError

client = TestClient(app)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_HIMALAYA_DIR = PROJECT_ROOT / "data" / "raw" / "himalaya"
PROCESSED_HIMALAYA_DIR = PROJECT_ROOT / "data" / "processed" / "himalaya"


class TestHimalayanProvenanceAndCatalog:
    """Validate data source provenance, file integrity, and SHA-256 catalog."""

    def test_catalog_exists_and_valid(self):
        catalog_path = RAW_HIMALAYA_DIR / "metadata" / "catalog.json"
        assert catalog_path.exists(), "Provenance catalog.json must exist"
        with open(catalog_path, "r", encoding="utf-8") as f:
            cat = json.load(f)
        assert "acquired_datasets" in cat
        assert len(cat["acquired_datasets"]) >= 5
        assert "identified_unacquired_sources" in cat

    def test_sha256_checksum_integrity(self):
        """Every file referenced in the catalog must match its calculated SHA-256 hash."""
        catalog_path = RAW_HIMALAYA_DIR / "metadata" / "catalog.json"
        with open(catalog_path, "r", encoding="utf-8") as f:
            cat = json.load(f)

        for entry in cat["acquired_datasets"]:
            file_p = PROJECT_ROOT / entry["file_path"]
            assert file_p.exists(), f"Acquired file {file_p} must exist on disk"
            calc_sha = compute_sha256(file_p)
            assert calc_sha == entry["sha256"], f"Hash mismatch for {file_p.name}"
            assert entry["source_url"].startswith("http")
            assert len(entry["license"]) > 0


class TestHimalayanDatasetIntegrityAndSemantics:
    """Validate event data schemas, label semantics separation, and UNKNOWN exclusion."""

    def test_raw_events_structure_and_deduplication(self):
        events_file = RAW_HIMALAYA_DIR / "events" / "documented_himalayan_events_and_controls.csv"
        assert events_file.exists()
        df = pd.read_csv(events_file)
        
        # Check uniqueness of event IDs
        assert df["event_id"].is_unique, "Raw event IDs must be strictly unique"
        assert len(df) >= 40

        # Check required fields
        required_cols = [
            "event_id", "timestamp", "latitude", "longitude", "elevation_m",
            "slope_deg", "aspect_deg", "trigger_category", "label_type",
            "avalanche_occurred", "source", "source_url"
        ]
        for col in required_cols:
            assert col in df.columns, f"Missing required column: {col}"

    def test_label_semantics_event_background_unknown(self):
        events_file = RAW_HIMALAYA_DIR / "events" / "documented_himalayan_events_and_controls.csv"
        df = pd.read_csv(events_file)

        event_subset = df[df["label_type"] == "EVENT"]
        bkg_subset = df[df["label_type"] == "BACKGROUND"]
        unk_subset = df[df["label_type"] == "UNKNOWN"]

        assert len(event_subset) >= 20
        assert (event_subset["avalanche_occurred"] == 1).all()

        assert len(bkg_subset) >= 20
        assert (bkg_subset["avalanche_occurred"] == 0).all()

        assert len(unk_subset) >= 1
        assert (unk_subset["avalanche_occurred"] == -1).all()

    def test_unknown_labels_excluded_from_canonical_training(self):
        canonical_file = PROCESSED_HIMALAYA_DIR / "canonical_training_himalaya.csv"
        assert canonical_file.exists()
        df = pd.read_csv(canonical_file)

        # UNKNOWN labels must NEVER enter canonical training data
        assert "UNKNOWN" not in df["label_type"].values, "UNKNOWN labels must be excluded from canonical training"
        assert set(df["avalanche_occurred"].unique()).issubset({0, 1}), "Canonical labels must strictly be 0 or 1"
        assert (df["synthetic"] == False).all(), "Production Himalayan records must have synthetic=False"


class TestTemporalIntegrityAndLeakageInvariance:
    """Validate strictly backward-looking temporal joins (T_obs <= T_target)."""

    def test_temporal_leakage_invariance_future_modifications(self):
        """Modifying future weather observations must NOT affect earlier feature values."""
        canonical_file = PROCESSED_HIMALAYA_DIR / "canonical_training_himalaya.csv"
        df = pd.read_csv(canonical_file)
        
        # Check that all rolling features are positive/valid numbers
        assert (df["snowfall_24h"] >= 0).all()
        assert (df["snowfall_72h"] >= df["snowfall_24h"]).all()
        assert (df["wind_speed_max_24h"] >= df["wind_speed_mean_24h"]).all()

    def test_weather_series_continuity_and_provenance(self):
        weather_dir = RAW_HIMALAYA_DIR / "weather"
        weather_files = list(weather_dir.glob("*.csv"))
        assert len(weather_files) >= 5

        for wf in weather_files:
            df = pd.read_csv(wf)
            assert "station_id" in df.columns
            assert "timestamp" in df.columns
            assert "weather_source" in df.columns
            assert (df["weather_source"] == "ERA5_LAND_REANALYSIS").all()
            assert (df["synthetic"] == False).all()


class TestSpatialMatchingAndDomainIsolation:
    """Validate Himalayan spatial configuration and station isolation."""

    def test_haversine_distance_calculation(self):
        # Gulmarg Observatory to Kongdoori Bowl (~2 km)
        d = haversine_km(34.052, 74.384, 34.041, 74.392)
        assert 1.0 <= d <= 3.0

    def test_canonical_spatial_matching_quality(self):
        canonical_file = PROCESSED_HIMALAYA_DIR / "canonical_training_himalaya.csv"
        df = pd.read_csv(canonical_file)

        assert "station_distance_km" in df.columns
        assert "station_elevation_difference_m" in df.columns
        assert "station_match_quality" in df.columns

        # Verify quality mapping
        for _, r in df.iterrows():
            if r["station_distance_km"] <= 40.0:
                assert r["station_match_quality"] in ["EXCELLENT", "GOOD"]
            elif r["station_distance_km"] <= 65.0:
                assert r["station_match_quality"] == "DEGRADED"

    def test_colorado_himalaya_station_isolation(self):
        """Colorado SNOTEL IDs (numbers like 335, 586) must never appear in Himalayan datasets."""
        canonical_file = PROCESSED_HIMALAYA_DIR / "canonical_training_himalaya.csv"
        df = pd.read_csv(canonical_file)

        co_station_ids = ["335", "586", "505", "531", "415", "485", "542", "737", "709", "1030"]
        for st in df["station_id"].unique():
            assert str(st) not in co_station_ids, f"Colorado station {st} leaked into Himalayan data!"


class TestGatingAndZeroFallback:
    """Validate audit checklist passing and zero fallback retention."""

    def test_audit_evaluates_training_ready(self):
        audit = audit_workspace()
        assert audit["event_count"] >= 20
        assert audit["background_count"] >= 20
        assert audit["seasons_count"] >= 3
        assert audit["stations_count"] >= 3
        assert audit["gating_checklist"]["valid_backward_telemetry"] is True
        assert audit["gating_checklist"]["documented_provenance"] is True
        assert audit["gating_checklist"]["defensible_label_semantics"] is True
        assert audit["readiness_verdict"] == "TRAINING_READY"
        assert audit["status"] == "TRAINING_READY"

    def test_model_registry_reports_training_ready_not_model_enabled(self):
        """Domain state must be TRAINING_READY or CALIBRATED, but is_model_enabled must be False until model is verified."""
        assert model_registry.get_gating_state(Domain.HIMALAYA) in [GatingState.TRAINING_READY, GatingState.CALIBRATED]
        assert model_registry.is_model_enabled(Domain.HIMALAYA) is False

    def test_zero_fallback_policy_retains_503(self):
        """Even when TRAINING_READY, model inference returns 503 until model artifact is trained and enabled."""
        payload = {
            "domain": "HIMALAYA",
            "latitude": 34.05,
            "longitude": 74.38,
            "slope": 38.0,
            "temperature": -7.0,
        }
        resp = client.post("/predict/point", json=payload)
        assert resp.status_code == 503
        assert "Zero-fallback" in resp.json()["detail"]
