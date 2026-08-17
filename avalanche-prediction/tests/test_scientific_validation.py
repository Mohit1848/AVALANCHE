"""Scientific Model Validation, Reliability, Calibration & Ablation Test Suite."""

import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from api.main import app
from ml.evaluation.calibration import calculate_ece, evaluate_calibration
from ml.evaluation.thresholds import evaluate_thresholds
from ml.evaluation.subgroups import evaluate_subgroups
from ml.evaluation.spatial_generalization import evaluate_spatial_generalization, evaluate_joint_spatiotemporal_holdout
from ml.evaluation.ablation import run_ablation_study
from ml.evaluation.model_comparison import compare_models
from ml.evaluation.feature_stability import evaluate_feature_stability
from ml.evaluation.error_analysis import perform_error_analysis
from ml.evaluation.temporal_holdout import evaluate_temporal_holdout
from ml.evaluation.walk_forward import evaluate_walk_forward

client = TestClient(app)


class TestProbabilityCalibration:
    """Test calibration curve and Expected Calibration Error calculation."""

    def test_ece_calculation(self):
        y_true = np.array([1, 1, 0, 0, 1, 0, 1, 0, 1, 0])
        y_prob = np.array([0.9, 0.8, 0.1, 0.2, 0.85, 0.15, 0.75, 0.3, 0.95, 0.05])
        ece = calculate_ece(y_true, y_prob, n_bins=5)
        assert 0.0 <= ece <= 1.0

    def test_calibration_evaluation(self):
        y_true = np.array([1, 1, 0, 0, 1, 0, 1, 0])
        uncal_probs = np.array([0.95, 0.90, 0.40, 0.30, 0.85, 0.45, 0.80, 0.20])
        cal_probs = np.array([0.85, 0.80, 0.20, 0.15, 0.75, 0.25, 0.70, 0.10])

        res = evaluate_calibration(y_true, uncal_probs, cal_probs, n_bins=4)
        assert "uncalibrated" in res
        assert "calibrated" in res
        assert "brier_score" in res["calibrated"]
        assert "calibration_curve" in res["calibrated"]


class TestDecisionThresholdTradeoffs:
    """Test multi-threshold classification metrics and F2 optimization."""

    def test_threshold_tradeoff_table(self):
        y_true = np.array([1, 1, 1, 1, 0, 0, 0, 0])
        y_prob = np.array([0.85, 0.65, 0.45, 0.25, 0.35, 0.15, 0.10, 0.05])

        res = evaluate_thresholds(y_true, y_prob, thresholds=[0.20, 0.40, 0.70])
        table = res["threshold_table"]
        assert len(table) == 3

        # At low threshold (0.20), recall should be high
        low_th = next(t for t in table if t["threshold"] == 0.20)
        assert low_th["recall"] >= 0.75

        # At high threshold (0.70), precision should be high
        high_th = next(t for t in table if t["threshold"] == 0.70)
        assert high_th["precision"] == 1.0


class TestSubgroupSampleGuard:
    """Verify minimum sample protection suppresses misleading metrics on tiny subgroups."""

    def test_subgroup_insufficient_sample_protection(self):
        # Create small dataframe with trigger subgroups
        df = pd.DataFrame([
            {"trigger_category": "EXPLOSIVE", "label": 1, "calibrated_prob": 0.8, "elevation": 3600, "slope": 38.0},
            {"trigger_category": "EXPLOSIVE", "label": 1, "calibrated_prob": 0.75, "elevation": 3500, "slope": 36.0},
            {"trigger_category": "NATURAL", "label": 1, "calibrated_prob": 0.85, "elevation": 3400, "slope": 37.0},
            {"trigger_category": "NATURAL", "label": 1, "calibrated_prob": 0.90, "elevation": 3450, "slope": 38.0},
            {"trigger_category": "NATURAL", "label": 1, "calibrated_prob": 0.80, "elevation": 3300, "slope": 35.0},
            {"trigger_category": "NATURAL", "label": 0, "calibrated_prob": 0.20, "elevation": 3200, "slope": 28.0},
            {"trigger_category": "NATURAL", "label": 0, "calibrated_prob": 0.15, "elevation": 3100, "slope": 25.0},
        ])

        subgroups = evaluate_subgroups(df, y_true_col="label", y_prob_col="calibrated_prob", min_sample_size=5)
        trigger_results = subgroups["trigger_category"]

        # EXPLOSIVE group has N=2 < 5 -> INSUFFICIENT SAMPLE
        exp_res = next(r for r in trigger_results if r["subgroup_value"] == "EXPLOSIVE")
        assert exp_res["status"] == "INSUFFICIENT SAMPLE"
        assert exp_res["recall"] is None

        # NATURAL group has N=5 >= 5 -> VALID
        nat_res = next(r for r in trigger_results if r["subgroup_value"] == "NATURAL")
        assert nat_res["status"] == "VALID"
        assert nat_res["recall"] is not None


class TestSpatialAndSpatiotemporalHoldout:
    """Test seen vs unseen location generalization and joint spatiotemporal holdout."""

    def test_spatial_generalization_partitioning(self):
        df = pd.DataFrame([
            {"location": "Berthoud Pass", "label": 1, "calibrated_prob": 0.85},
            {"location": "Loveland Pass", "label": 1, "calibrated_prob": 0.80},
            {"location": "Red Mountain Pass", "label": 1, "calibrated_prob": 0.70},
            {"location": "Red Mountain Pass", "label": 0, "calibrated_prob": 0.20},
        ])
        train_locs = ["Berthoud Pass", "Loveland Pass"]
        test_locs = ["Red Mountain Pass"]

        gen_res = evaluate_spatial_generalization(df, train_locs, test_locs, y_true_col="label", y_prob_col="calibrated_prob")
        assert gen_res["seen_locations"]["n_samples"] == 2
        assert gen_res["unseen_locations"]["n_samples"] == 2
        assert gen_res["unseen_locations"]["recall"] is not None

    def test_joint_spatiotemporal_holdout(self):
        df = pd.DataFrame([
            {"season": "2023-2024", "location": "Red Mountain Pass", "label": 1, "calibrated_prob": 0.88},
            {"season": "2023-2024", "location": "Red Mountain Pass", "label": 0, "calibrated_prob": 0.12},
        ])
        res = evaluate_joint_spatiotemporal_holdout(
            df,
            held_out_season="2023-2024",
            held_out_locations=["Red Mountain Pass"],
            y_true_col="label",
            y_prob_col="calibrated_prob",
        )
        assert res["title"] == "JOINT TEMPORAL + SPATIAL HOLDOUT VALIDATION"
        assert res["n_samples"] == 2
        assert res["recall"] == 1.0


class TestAblationAndModelBenchmark:
    """Test feature group ablation and model comparisons."""

    def test_ablation_study_execution(self):
        x_train = pd.DataFrame({
            "slope": [38.0, 36.0, 28.0, 25.0],
            "aspect_sin": [0.7, 0.7, 0.0, 0.0],
            "aspect_cos": [0.7, 0.7, 1.0, 1.0],
            "elevation": [3500, 3400, 2800, 2700],
            "temperature": [-6.0, -8.0, 2.0, 4.0],
            "humidity": [80, 85, 50, 45],
            "pressure": [660, 670, 720, 730],
            "precipitation": [10.0, 15.0, 0.0, 0.0],
            "snow_depth": [150, 160, 20, 10],
            "snow_water_equivalent": [220, 240, 30, 15],
            "snowfall_6h": [6.0, 8.0, 0.0, 0.0],
            "snowfall_24h": [24.0, 32.0, 0.0, 0.0],
            "snowfall_72h": [40.0, 50.0, 0.0, 0.0],
            "temperature_delta_24h": [-3.0, -4.0, 1.0, 2.0],
            "temperature_delta_72h": [-5.0, -6.0, 2.0, 3.0],
            "wind_speed_mean_24h": [20.0, 25.0, 5.0, 6.0],
            "wind_speed_max_24h": [45.0, 50.0, 12.0, 14.0],
        })
        y_train = np.array([1, 1, 0, 0])
        x_test = x_train.copy()
        y_test = y_train.copy()

        ablation_res = run_ablation_study(x_train, y_train, x_test, y_test)
        assert len(ablation_res) >= 5
        full_group = next(a for a in ablation_res if "Full Model" in a["ablation_group"])
        assert full_group["recall"] >= 0.5

    def test_model_comparison_benchmark(self):
        x_train = pd.DataFrame({
            "slope": [38.0, 36.0, 28.0, 25.0, 39.0, 26.0],
            "snowfall_24h": [24.0, 32.0, 0.0, 0.0, 30.0, 0.0],
            "elevation": [3500, 3400, 2800, 2700, 3600, 2600],
        })
        y_train = np.array([1, 1, 0, 0, 1, 0])
        x_test = x_train.copy()
        y_test = y_train.copy()

        comp = compare_models(x_train, y_train, x_test, y_test)
        assert len(comp) >= 3
        rf_model = next(m for m in comp if m["model_name"] == "Random Forest")
        assert rf_model["status"] == "CONVERGED"


class TestFeatureStabilityAndErrors:
    """Test feature stability ranking and instance error analysis."""

    def test_feature_stability_calculation(self):
        folds_x = [
            pd.DataFrame({"slope": [38, 25], "snowfall_24h": [30, 0]}),
            pd.DataFrame({"slope": [36, 28], "snowfall_24h": [28, 0]}),
        ]
        folds_y = [np.array([1, 0]), np.array([1, 0])]

        stability = evaluate_feature_stability(folds_x, folds_y, ["slope", "snowfall_24h"])
        assert len(stability) == 2
        assert "mean_importance" in stability[0]
        assert "stability_status" in stability[0]

    def test_error_analysis_fn_description(self):
        df = pd.DataFrame([
            {
                "event_id": "EVT_100",
                "label": 1,
                "calibrated_prob": 0.25,  # Missed event (FN)
                "slope": 38.0,
                "elevation": 3500.0,
                "snowfall_24h": 32.0,
                "snowfall_72h": 45.0,
                "snow_water_equivalent": 210.0,
                "temperature_delta_24h": -3.0,
            },
        ])
        errors = perform_error_analysis(df, y_true_col="label", y_prob_col="calibrated_prob", threshold=0.40)
        assert len(errors) == 1
        assert errors[0]["error_type"] == "FALSE_NEGATIVE"
        assert "Missed observed event in the evaluation dataset" in errors[0]["error_description"]


class TestScientificApiEndpoint:
    """Test FastAPI /model/scientific-evaluation route."""

    def test_scientific_evaluation_endpoint(self):
        res = client.get("/model/scientific-evaluation")
        assert res.status_code == 200
        data = res.json()
        assert data["title"] == "SCIENTIFIC MODEL VALIDATION & FORECAST RELIABILITY"
        assert "metrics" in data
        assert "calibration" in data
        assert "threshold_tradeoffs" in data
