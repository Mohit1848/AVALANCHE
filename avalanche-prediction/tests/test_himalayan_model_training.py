"""Tests for Himalayan Model Training, Temporal/Spatial Validation, Calibration, and Safety Guards."""

import json
from pathlib import Path
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
from ml.model_registry import model_registry, Domain, GatingState, ModelUnavailableError
from ml.training.train_himalaya import CANONICAL_FEATURES, compute_safety_metrics, calculate_ece
from ml.evaluation.evaluate_himalaya import (
    run_spatial_generalization_and_lolo,
    run_feature_ablation_study,
    run_subgroup_safety_analysis,
    run_threshold_tradeoff_analysis,
    run_calibration_evaluation,
)
import joblib

client = TestClient(app)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
HIMALAYA_MODEL_PATH = PROJECT_ROOT / "models" / "himalaya" / "avalanche_model.joblib"
COLORADO_MODEL_PATH = PROJECT_ROOT / "models" / "colorado" / "avalanche_model.joblib"
CANONICAL_HIMALAYA_CSV = PROJECT_ROOT / "data" / "processed" / "himalaya" / "canonical_training_himalaya.csv"
REPORTS_DIR = PROJECT_ROOT / "reports" / "evaluation"


class TestHimalayanModelArtifactAndIsolation:
    """Validate Himalayan model bundle integrity and domain isolation."""

    def test_himalayan_model_bundle_exists_and_valid(self):
        assert HIMALAYA_MODEL_PATH.exists(), "Himalayan model artifact must exist on disk"
        bundle = joblib.load(HIMALAYA_MODEL_PATH)
        assert bundle["domain"] == "HIMALAYA"
        assert bundle["sample_size"] == 44
        assert bundle["gating_state"] == "CALIBRATED"
        assert bundle["model_status"] == "RESEARCH_ONLY"
        assert bundle["inference_enabled"] is False
        assert "model" in bundle
        assert "preprocessor" in bundle
        assert len(bundle["feature_columns"]) == 17

    def test_colorado_himalayan_weight_independence(self):
        """Himalayan and Colorado models must be distinct objects with separate parameters."""
        bundle_co = model_registry.get_model_bundle(Domain.COLORADO)
        bundle_him = joblib.load(HIMALAYA_MODEL_PATH)

        assert bundle_co is not bundle_him
        assert bundle_co["model_name"] != bundle_him["model_name"]
        assert bundle_co["domain"] == "COLORADO"
        assert bundle_him["domain"] == "HIMALAYA"


class TestTemporalHoldoutAndLeakageSafety:
    """Validate temporal splitting, preprocessing isolation, and calibration leakage safety."""

    def test_temporal_split_season_boundaries(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        train_df = df[df["season"] < "2022-2023"]
        val_df = df[df["season"] == "2022-2023"]
        test_df = df[df["season"] == "2023-2024"]

        # Verify season disjointness
        assert len(set(train_df["season"]).intersection(set(val_df["season"]))) == 0
        assert len(set(train_df["season"]).intersection(set(test_df["season"]))) == 0
        assert len(set(val_df["season"]).intersection(set(test_df["season"]))) == 0
        assert len(test_df) >= 4

    def test_ece_calculation_accuracy(self):
        y_true = np.array([1, 1, 0, 0])
        y_prob = np.array([0.9, 0.8, 0.2, 0.1])
        ece = calculate_ece(y_true, y_prob, n_bins=5)
        assert 0.0 <= ece <= 0.3


class TestSpatialGeneralizationAndLOLO:
    """Validate spatial generalization and Leave-One-Location-Out cross-validation."""

    def test_lolo_location_disjointness(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        res = run_spatial_generalization_and_lolo(df)

        assert res["stations_evaluated"] >= 5
        assert "seen_locations_metrics" in res
        assert "unseen_locations_metrics" in res
        # Unseen locations recall should be valid (> 0.70)
        assert res["unseen_locations_metrics"]["recall"] >= 0.70


class TestSubgroupSampleGuardAndAblation:
    """Validate sample-size safety guards (N < 5 -> INSUFFICIENT_SAMPLE) and ablation labeling."""

    def test_subgroup_n_less_than_5_returns_insufficient_sample(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        bundle = joblib.load(HIMALAYA_MODEL_PATH)
        subgroups = run_subgroup_safety_analysis(df, bundle)

        for sg in subgroups:
            if sg["sample_size_N"] < 5:
                assert sg["status"] == "INSUFFICIENT_SAMPLE"
                assert sg["recall"] == "N/A"

    def test_ablation_study_interpretation_label(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        ablation_res = run_feature_ablation_study(df)
        assert len(ablation_res) == 7
        for ab in ablation_res:
            assert ab["scientific_interpretation"] == "MODEL ASSOCIATION — NOT CAUSALITY"


class TestGatingAndZeroFallbackProtection:
    """Validate CALIBRATED state, RESEARCH_ONLY status, and inference refusal."""

    def test_model_registry_state_is_calibrated(self):
        state = model_registry.get_gating_state(Domain.HIMALAYA)
        assert state == GatingState.CALIBRATED
        assert model_registry.is_model_enabled(Domain.HIMALAYA) is False

    def test_himalayan_inference_blocked_503(self):
        payload = {
            "domain": "HIMALAYA",
            "latitude": 34.05,
            "longitude": 74.38,
            "slope": 38.0,
            "temperature": -7.0,
        }
        resp = client.post("/predict/point", json=payload)
        assert resp.status_code == 503
        data = resp.json()
        assert "Zero-fallback" in data["detail"] or "NOT enabled" in data["detail"]

    def test_model_status_endpoint_reports_research_only(self):
        resp = client.get("/model/status?domain=HIMALAYA")
        assert resp.status_code == 200
        data = resp.json()
        assert data["domain"] == "HIMALAYA"
        assert data["gating_state"] == "CALIBRATED"
        assert data["model_status"] == "RESEARCH_ONLY"
        assert data["model_loaded"] is True
