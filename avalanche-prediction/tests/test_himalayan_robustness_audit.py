"""Tests for Phase 8.5 Himalayan Robustness, Small-Sample Confidence Intervals, and Uncertainty Audit."""

import json
from pathlib import Path
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
from ml.model_registry import model_registry, Domain, GatingState
from ml.evaluation.himalaya_robustness_audit import (
    wilson_score_interval,
    bootstrap_ci,
    compute_all_confidence_intervals,
    run_forward_chaining_temporal_robustness,
    run_location_robustness_lolo,
    run_model_stability_benchmark,
    run_feature_stability_audit,
    run_threshold_sensitivity_audit,
)
import joblib

client = TestClient(app)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_HIMALAYA_CSV = PROJECT_ROOT / "data" / "processed" / "himalaya" / "canonical_training_himalaya.csv"
HIMALAYA_MODEL_PATH = PROJECT_ROOT / "models" / "himalaya" / "avalanche_model.joblib"
REPORTS_DIR = PROJECT_ROOT / "reports" / "evaluation"


class TestSmallSampleConfidenceIntervals:
    """Validate Wilson score and bootstrap interval mathematics and bounds."""

    def test_wilson_score_interval_bounds(self):
        # 4 successes out of 4 (Held-out test recall)
        low, high = wilson_score_interval(4, 4, confidence=0.95)
        assert 0.40 <= low <= 0.60
        assert high == 1.0000

        # 0 successes out of 4 (FNR)
        low_fnr, high_fnr = wilson_score_interval(0, 4, confidence=0.95)
        assert low_fnr == 0.0000
        assert 0.40 <= high_fnr <= 0.60

    def test_bootstrap_ci_reproducibility(self):
        y_t = np.array([1, 1, 1, 1, 0, 0])
        y_p = np.array([0.9, 0.85, 0.88, 0.92, 0.1, 0.15])
        low, high = bootstrap_ci(y_t, y_p, lambda yt, yp: np.mean(yp[yt == 1]), n_resamples=500, random_state=42)
        assert 0.70 <= low <= high <= 1.0

    def test_confidence_intervals_json_artifact(self):
        ci_path = REPORTS_DIR / "himalaya_confidence_intervals.json"
        assert ci_path.exists(), "himalaya_confidence_intervals.json must exist"
        with open(ci_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert "held_out_test_season_2023_2024" in data
        assert "full_canonical_dataset_n44" in data
        test_block = data["held_out_test_season_2023_2024"]["metrics_with_intervals"]
        assert "recall" in test_block
        assert test_block["recall"]["lower_95_ci"] < test_block["recall"]["upper_95_ci"]


class TestTemporalAndLocationRobustness:
    """Validate forward-chaining and LOLO location isolation."""

    def test_forward_chaining_temporal_folds_strict_ordering(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        folds = run_forward_chaining_temporal_robustness(df)
        assert len(folds) >= 5

        for f in folds:
            assert f["train_N"] > 0
            assert f["test_N"] > 0
            # Ensure chronological order
            assert f["train_period"] < f["test_period"]

    def test_lolo_n_less_than_5_guard(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        loc_results = run_location_robustness_lolo(df)
        assert len(loc_results) >= 6

        for r in loc_results:
            if r["sample_size_N"] < 5:
                assert r["status"] == "INSUFFICIENT_SAMPLE"
                assert r["recall"] == "INSUFFICIENT_SAMPLE"


class TestModelAndFeatureStability:
    """Validate multi-model stability and feature importance causality disclaimer."""

    def test_multi_model_stability_ranking(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        stability = run_model_stability_benchmark(df)
        assert len(stability) == 5
        # Verify ranking order
        ranks = [m["overall_rank"] for m in stability]
        assert ranks == [1, 2, 3, 4, 5]

    def test_feature_stability_causality_disclaimer(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        features_res = run_feature_stability_audit(df)
        assert len(features_res) == 17
        for feat in features_res:
            assert feat["scientific_interpretation"] == "MODEL ASSOCIATION — NOT CAUSALITY"


class TestThresholdSensitivityAndGatingState:
    """Validate threshold sensitivity sweep and strict research-only status."""

    def test_threshold_sensitivity_tradeoffs(self):
        df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
        model_bundle = joblib.load(HIMALAYA_MODEL_PATH)
        tradeoffs = run_threshold_sensitivity_audit(df, model_bundle)
        assert len(tradeoffs) >= 10
        for t in tradeoffs:
            assert t["operational_status"] == "UNVALIDATED"

    def test_model_registry_authoritative_state(self):
        """Himalayan domain must remain CALIBRATED and RESEARCH_ONLY with inference disabled."""
        state = model_registry.get_gating_state(Domain.HIMALAYA)
        assert state == GatingState.CALIBRATED
        assert model_registry.is_model_enabled(Domain.HIMALAYA) is False

    def test_himalayan_inference_blocked_http_503(self):
        """Zero-fallback invariant: Himalayan point prediction returns 503."""
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
