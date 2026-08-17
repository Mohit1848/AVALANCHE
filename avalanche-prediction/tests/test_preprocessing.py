"""Unit and regression tests for preprocessing, domain validation, and temporal leakage prevention."""

from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import pytest

from ml.preprocessing import (
    PreprocessingConfig,
    clean_dataframe,
    engineer_features,
    split_data,
)


def test_future_observation_modification_does_not_affect_past_features():
    """Regression test: altering a future observation must NOT change past rolling features."""
    base_time = datetime(2023, 1, 1, 0, 0)
    timestamps = [base_time + timedelta(hours=6 * i) for i in range(10)]

    df_original = pd.DataFrame(
        {
            "timestamp": timestamps,
            "location_id": ["LOC_001"] * 10,
            "snowfall": [5.0, 10.0, 0.0, 15.0, 20.0, 0.0, 5.0, 10.0, 15.0, 25.0],
            "temperature": [-10.0, -8.0, -5.0, -2.0, 0.0, 2.0, -1.0, -4.0, -7.0, -10.0],
            "wind_speed": [10.0, 15.0, 25.0, 30.0, 20.0, 15.0, 10.0, 5.0, 20.0, 40.0],
        }
    )

    config = PreprocessingConfig(
        target_column="target", timestamp_column="timestamp", group_column="location_id"
    )

    # Compute features on original dataset
    feat_orig = engineer_features(df_original, config)

    # Create modified dataset where the LAST 2 future observations are drastically changed
    df_modified = df_original.copy()
    df_modified.loc[8, "snowfall"] = 999.0
    df_modified.loc[9, "snowfall"] = 999.0
    df_modified.loc[8, "temperature"] = 50.0
    df_modified.loc[9, "temperature"] = 50.0
    df_modified.loc[8, "wind_speed"] = 200.0
    df_modified.loc[9, "wind_speed"] = 200.0

    # Recompute features on modified dataset
    feat_mod = engineer_features(df_modified, config)

    # For all timestamps prior to the modified records (indices 0 to 7),
    # verify that ALL computed rolling and derived features are identical.
    eval_cols = [
        "snowfall_6h",
        "snowfall_24h",
        "snowfall_72h",
        "temperature_delta_6h",
        "temperature_delta_24h",
        "temperature_delta_72h",
        "wind_speed_mean_24h",
        "wind_speed_max_24h",
        "wind_drift_index",
        "rapid_warming_indicator",
    ]

    for col in eval_cols:
        if col in feat_orig.columns and col in feat_mod.columns:
            np.testing.assert_allclose(
                feat_orig.loc[:7, col].values,
                feat_mod.loc[:7, col].values,
                err_msg=f"Future data leakage detected in feature '{col}'!",
            )


def test_temporal_split_strict_ordering():
    """Verify that training set timestamps strictly precede test set timestamps."""
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2022-01-01", periods=100, freq="D"),
            "target": np.random.choice([0, 1], size=100),
            "feature": np.random.randn(100),
        }
    )

    config = PreprocessingConfig(
        target_column="target",
        timestamp_column="timestamp",
        validation_strategy="temporal",
        test_size=0.2,
    )

    train_idx, test_idx, strategy = split_data(df, config)

    assert strategy == "temporal"
    assert len(train_idx) == 80
    assert len(test_idx) == 20

    train_max_time = df.loc[train_idx, "timestamp"].max()
    test_min_time = df.loc[test_idx, "timestamp"].min()

    assert train_max_time < test_min_time, "Temporal split violated: test data overlaps or precedes train data!"


def test_group_split_zero_leakage():
    """Verify that locations/groups never appear in both train and test partitions."""
    df = pd.DataFrame(
        {
            "location_id": ["STATION_A", "STATION_B", "STATION_C", "STATION_D", "STATION_E"] * 20,
            "target": np.random.choice([0, 1], size=100),
            "feature": np.random.randn(100),
        }
    )

    config = PreprocessingConfig(
        target_column="target",
        group_column="location_id",
        validation_strategy="group",
        test_size=0.4,
        random_state=42,
    )

    train_idx, test_idx, strategy = split_data(df, config)

    assert strategy == "group"
    train_groups = set(df.loc[train_idx, "location_id"])
    test_groups = set(df.loc[test_idx, "location_id"])

    assert len(train_groups.intersection(test_groups)) == 0, "Group leakage detected!"


def test_cyclic_encodings():
    """Verify correct trigonometric encoding of angular features."""
    df = pd.DataFrame(
        {
            "aspect": [0.0, 90.0, 180.0, 270.0],
            "wind_direction": [0.0, 90.0, 180.0, 270.0],
        }
    )
    config = PreprocessingConfig(target_column="target")
    engineered = engineer_features(df, config)

    # 0 deg: sin = 0, cos = 1
    assert np.isclose(engineered.loc[0, "aspect_sin"], 0.0, atol=1e-5)
    assert np.isclose(engineered.loc[0, "aspect_cos"], 1.0, atol=1e-5)

    # 90 deg: sin = 1, cos = 0
    assert np.isclose(engineered.loc[1, "aspect_sin"], 1.0, atol=1e-5)
    assert np.isclose(engineered.loc[1, "aspect_cos"], 0.0, atol=1e-5)


def test_domain_validation_range_rules():
    """Verify that physically implausible values are safely marked NaN without deleting rows."""
    df = pd.DataFrame(
        {
            "temperature": [-100.0, 20.0, 70.0],  # -100 and 70 are out of bounds (-80 to 60)
            "humidity": [-5.0, 50.0, 150.0],  # -5 and 150 are out of bounds (0 to 100)
            "slope": [-10.0, 35.0, 95.0],  # -10 and 95 are out of bounds (0 to 90)
            "snowfall": [-10.0, 15.0, 30.0],  # -10 is invalid
            "target": [0, 1, 0],
        }
    )

    cleaned, notes = clean_dataframe(
        df,
        feature_columns=["temperature", "humidity", "slope", "snowfall"],
        target_column="target",
    )

    assert len(cleaned) == 3  # All rows preserved
    assert np.isnan(cleaned.loc[0, "temperature"])
    assert np.isnan(cleaned.loc[2, "temperature"])
    assert np.isnan(cleaned.loc[0, "humidity"])
    assert np.isnan(cleaned.loc[2, "humidity"])
    assert np.isnan(cleaned.loc[0, "slope"])
    assert np.isnan(cleaned.loc[2, "slope"])
    assert np.isnan(cleaned.loc[0, "snowfall"])
    assert len(notes) > 0
