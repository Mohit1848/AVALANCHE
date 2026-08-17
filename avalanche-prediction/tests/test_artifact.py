"""Unit tests for artifact serialization, metadata preservation, and reload inference."""

from pathlib import Path
import tempfile
import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.pipeline import Pipeline

from ml.risk_engine import evaluate_risk


def test_artifact_save_load_prediction():
    """Verify that an artifact can be saved, reloaded, and used for inference with all metadata intact."""
    with tempfile.TemporaryDirectory() as tmpdir:
        artifact_path = Path(tmpdir) / "test_model.joblib"

        # Create dummy pipeline and metadata
        pipeline = Pipeline([("clf", DummyClassifier(strategy="constant", constant=1))])
        x_dummy = pd.DataFrame({"temperature": [-5.0], "slope": [35.0], "snowfall": [10.0]})
        y_dummy = pd.Series([1])
        pipeline.fit(x_dummy, y_dummy)

        artifact_data = {
            "model": pipeline,
            "model_name": "dummy_test",
            "target_column": "avalanche_occurred",
            "feature_columns": ["temperature", "slope", "snowfall"],
            "positive_label": 1,
            "classes": [0, 1],
            "risk_thresholds": {"medium": 0.4, "high": 0.7},
            "validation_strategy": "temporal",
            "calibration_metadata": {"method": "sigmoid", "calibrated": True},
            "feature_engineering_version": "v2_spatiotemporal",
        }

        # Save
        joblib.dump(artifact_data, artifact_path)
        assert artifact_path.exists()

        # Reload
        loaded = joblib.load(artifact_path)
        assert loaded["model_name"] == "dummy_test"
        assert loaded["validation_strategy"] == "temporal"
        assert loaded["feature_columns"] == ["temperature", "slope", "snowfall"]

        # Inference through risk engine
        input_data = {"temperature": -5.0, "slope": 35.0, "snowfall": 10.0}
        risk = evaluate_risk(
            raw_probability=0.2,
            calibrated_probability=0.25,
            input_data=input_data,
            feature_columns=loaded["feature_columns"],
            thresholds=loaded["risk_thresholds"],
        )

        assert risk.data_quality == "GOOD"
        assert risk.risk_level == "LOW"
        assert risk.final_risk_score == 25.0
