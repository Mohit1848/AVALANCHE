"""Preprocessing utilities for the avalanche prediction baseline.

The functions in this module avoid hard-coded dataset assumptions. Column names
are supplied by the training/evaluation scripts so the same pipeline can work
with different avalanche, weather, and terrain datasets.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer, make_column_selector
from sklearn.impute import SimpleImputer
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

DEFAULT_EXPECTED_FEATURES = [
    "temperature",
    "snow_depth",
    "snowfall",
    "humidity",
    "wind_speed",
    "wind_direction",
    "pressure",
    "slope",
    "aspect",
    "elevation",
    "snow_density",
]


@dataclass
class PreprocessingConfig:
    """Configuration for mapping an external CSV dataset into model inputs."""

    target_column: str
    feature_columns: list[str] | None = None
    timestamp_column: str | None = None
    group_column: str | None = None
    validation_strategy: str = "auto"
    test_size: float = 0.2
    random_state: int = 42


def load_csv(csv_path: str) -> pd.DataFrame:
    """Load a CSV file and fail clearly if it cannot be read."""
    try:
        return pd.read_csv(csv_path)
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Dataset not found: {csv_path}") from exc
    except pd.errors.EmptyDataError as exc:
        raise ValueError(f"Dataset is empty: {csv_path}") from exc


def inspect_dataframe(df: pd.DataFrame) -> dict:
    """Return beginner-friendly information about columns and data quality."""
    return {
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "column_names": list(df.columns),
        "data_types": {column: str(dtype) for column, dtype in df.dtypes.items()},
        "missing_values": df.isna().sum().to_dict(),
        "duplicate_rows": int(df.duplicated().sum()),
    }


def resolve_feature_columns(df: pd.DataFrame, config: PreprocessingConfig) -> list[str]:
    """Validate feature/target columns and infer features when not provided."""
    if config.target_column not in df.columns:
        raise ValueError(
            f"Target column '{config.target_column}' was not found. "
            f"Available columns: {list(df.columns)}"
        )

    if config.timestamp_column and config.timestamp_column not in df.columns:
        raise ValueError(
            f"Timestamp column '{config.timestamp_column}' was requested but does not exist. "
            f"Available columns: {list(df.columns)}"
        )

    if config.group_column and config.group_column not in df.columns:
        raise ValueError(
            f"Group column '{config.group_column}' was requested but does not exist. "
            f"Available columns: {list(df.columns)}"
        )

    if config.feature_columns:
        missing_features = [column for column in config.feature_columns if column not in df.columns]
        if missing_features:
            raise ValueError(
                f"Feature columns not found: {missing_features}. "
                f"Available columns: {list(df.columns)}"
            )
        return config.feature_columns

    exclude_cols = {
        config.target_column,
        config.timestamp_column,
        config.group_column,
        "event_id",
        "synthetic",
        "data_quality",
    }
    return [column for column in df.columns if column not in exclude_cols]


def clean_dataframe(
    df: pd.DataFrame,
    feature_columns: Iterable[str],
    target_column: str,
    timestamp_column: str | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    """Remove duplicates, handle infinite values, and mark invalid values missing."""
    cleaned = df.copy()
    notes: list[str] = []

    if timestamp_column and timestamp_column in cleaned.columns:
        cleaned[timestamp_column] = pd.to_datetime(cleaned[timestamp_column], errors="coerce")
        missing_ts = int(cleaned[timestamp_column].isna().sum())
        if missing_ts > 0:
            notes.append(f"Marked {missing_ts} rows with invalid timestamps as missing.")

    duplicate_count = int(cleaned.duplicated().sum())
    if duplicate_count:
        cleaned = cleaned.drop_duplicates()
        notes.append(f"Removed {duplicate_count} duplicate rows.")

    numeric_columns = cleaned.select_dtypes(include=[np.number]).columns
    infinite_count = (
        int(np.isinf(cleaned[numeric_columns]).sum().sum()) if len(numeric_columns) else 0
    )
    if infinite_count:
        cleaned = cleaned.replace([np.inf, -np.inf], np.nan)
        notes.append(f"Replaced {infinite_count} infinite numeric values with missing values.")

    invalid_notes = _mark_obvious_invalid_values(cleaned, feature_columns)
    notes.extend(invalid_notes)

    before_target_drop = len(cleaned)
    cleaned = cleaned.dropna(subset=[target_column])
    dropped_target_rows = before_target_drop - len(cleaned)
    if dropped_target_rows:
        notes.append(f"Dropped {dropped_target_rows} rows with missing target values.")

    if cleaned.empty:
        raise ValueError("No rows remain after cleaning. Check dataset and target column.")

    return cleaned, notes


def _mark_obvious_invalid_values(df: pd.DataFrame, feature_columns: Iterable[str]) -> list[str]:
    """Detect values that are physically implausible for known environmental fields."""
    rules = {
        "temperature": (-80, 60),
        "snow_depth": (0, None),
        "snowfall": (0, None),
        "humidity": (0, 100),
        "wind_speed": (0, 200),
        "wind_direction": (0, 360),
        "pressure": (300, 1100),
        "slope": (0, 90),
        "aspect": (0, 360),
        "elevation": (-500, 9000),
        "snow_density": (0, 1000),
        "precipitation": (0, None),
    }
    notes: list[str] = []

    for column in feature_columns:
        if column not in df.columns or not pd.api.types.is_numeric_dtype(df[column]):
            continue

        lower_name = column.lower()
        if lower_name not in rules:
            continue

        minimum, maximum = rules[lower_name]
        invalid_mask = pd.Series(False, index=df.index)
        if minimum is not None:
            invalid_mask |= df[column] < minimum
        if maximum is not None:
            invalid_mask |= df[column] > maximum

        invalid_count = int(invalid_mask.sum())
        if invalid_count:
            df.loc[invalid_mask, column] = np.nan
            notes.append(
                f"Marked {invalid_count} invalid values in '{column}' as missing "
                f"using rule range {minimum} to {maximum}."
            )

    return notes


def engineer_features(df: pd.DataFrame, config: PreprocessingConfig) -> pd.DataFrame:
    """Implement spatiotemporal feature engineering layer.

    Strictly adheres to backward-looking temporal calculations without future leakage.
    """
    engineered = df.copy()
    ts_col = config.timestamp_column
    group_col = config.group_column

    # 1. Cyclic features for angular terrain & meteorological variables
    if "aspect" in engineered.columns and pd.api.types.is_numeric_dtype(engineered["aspect"]):
        engineered["aspect_sin"] = np.sin(np.radians(engineered["aspect"]))
        engineered["aspect_cos"] = np.cos(np.radians(engineered["aspect"]))

    if "wind_direction" in engineered.columns and pd.api.types.is_numeric_dtype(
        engineered["wind_direction"]
    ):
        engineered["wind_direction_sin"] = np.sin(np.radians(engineered["wind_direction"]))
        engineered["wind_direction_cos"] = np.cos(np.radians(engineered["wind_direction"]))

    # 2. Heuristic domain indicators (engineering proxies, not validated science)
    if "temperature" in engineered.columns and pd.api.types.is_numeric_dtype(
        engineered["temperature"]
    ):
        engineered["rapid_warming_indicator"] = (engineered["temperature"] > 0).astype(int)

    if (
        "wind_speed" in engineered.columns
        and "snowfall" in engineered.columns
        and pd.api.types.is_numeric_dtype(engineered["wind_speed"])
        and pd.api.types.is_numeric_dtype(engineered["snowfall"])
    ):
        engineered["wind_drift_index"] = engineered["wind_speed"] * engineered["snowfall"]

    # 3. Rolling Temporal Features (strictly backward looking with closed='right')
    if ts_col and ts_col in engineered.columns:
        engineered[ts_col] = pd.to_datetime(engineered[ts_col], errors="coerce")
        valid_ts_mask = engineered[ts_col].notna()

        if valid_ts_mask.any():
            sort_cols = [group_col, ts_col] if group_col and group_col in engineered.columns else [ts_col]
            engineered = engineered.sort_values(by=sort_cols).reset_index(drop=True)

            orig_index = engineered.index
            engineered = engineered.set_index(ts_col)

            for window in ["6h", "24h", "72h"]:
                # Rolling snowfall accumulation
                if "snowfall" in engineered.columns and pd.api.types.is_numeric_dtype(
                    engineered["snowfall"]
                ):
                    if group_col and group_col in engineered.columns:
                        engineered[f"snowfall_{window}"] = engineered.groupby(group_col)[
                            "snowfall"
                        ].transform(lambda x: x.rolling(window, closed="right").sum())
                    else:
                        engineered[f"snowfall_{window}"] = (
                            engineered["snowfall"].rolling(window, closed="right").sum()
                        )

                # Temperature delta over window: T(now) - T(window_start)
                if "temperature" in engineered.columns and pd.api.types.is_numeric_dtype(
                    engineered["temperature"]
                ):
                    if group_col and group_col in engineered.columns:
                        engineered[f"temperature_delta_{window}"] = engineered.groupby(group_col)[
                            "temperature"
                        ].transform(
                            lambda x: x - x.rolling(window, closed="right").apply(
                                lambda s: s.iloc[0] if len(s) > 0 else np.nan, raw=False
                            )
                        )
                    else:
                        engineered[f"temperature_delta_{window}"] = (
                            engineered["temperature"]
                            - engineered["temperature"]
                            .rolling(window, closed="right")
                            .apply(lambda s: s.iloc[0] if len(s) > 0 else np.nan, raw=False)
                        )

            # Wind speed aggregation over 24h
            if "wind_speed" in engineered.columns and pd.api.types.is_numeric_dtype(
                engineered["wind_speed"]
            ):
                if group_col and group_col in engineered.columns:
                    engineered["wind_speed_mean_24h"] = engineered.groupby(group_col)[
                        "wind_speed"
                    ].transform(lambda x: x.rolling("24h", closed="right").mean())
                    engineered["wind_speed_max_24h"] = engineered.groupby(group_col)[
                        "wind_speed"
                    ].transform(lambda x: x.rolling("24h", closed="right").max())
                else:
                    engineered["wind_speed_mean_24h"] = (
                        engineered["wind_speed"].rolling("24h", closed="right").mean()
                    )
                    engineered["wind_speed_max_24h"] = (
                        engineered["wind_speed"].rolling("24h", closed="right").max()
                    )

            engineered = engineered.reset_index()

    return engineered


def split_features_target(
    df: pd.DataFrame, feature_columns: list[str], target_column: str
) -> tuple[pd.DataFrame, pd.Series]:
    """Separate model features from the avalanche target."""
    return df[feature_columns], df[target_column]


def split_data(
    df: pd.DataFrame, config: PreprocessingConfig
) -> tuple[pd.Index, pd.Index, str]:
    """Perform leakage-safe validation splitting (temporal, group, random)."""
    strategy = config.validation_strategy

    if strategy == "auto":
        if config.timestamp_column and config.timestamp_column in df.columns:
            strategy = "temporal"
        elif config.group_column and config.group_column in df.columns:
            strategy = "group"
        else:
            strategy = "random"

    if strategy == "temporal":
        if not config.timestamp_column or config.timestamp_column not in df.columns:
            raise ValueError("Temporal split requested but timestamp column is missing.")
        df_sorted = df.sort_values(by=config.timestamp_column)
        split_idx = int(len(df_sorted) * (1 - config.test_size))
        train_idx = df_sorted.index[:split_idx]
        test_idx = df_sorted.index[split_idx:]
        return train_idx, test_idx, "temporal"

    elif strategy == "group":
        if not config.group_column or config.group_column not in df.columns:
            raise ValueError("Group split requested but group column is missing.")
        gss = GroupShuffleSplit(
            n_splits=1, test_size=config.test_size, random_state=config.random_state
        )
        train_iloc, test_iloc = next(gss.split(df, groups=df[config.group_column]))
        return df.index[train_iloc], df.index[test_iloc], "group"

    else:  # random stratified
        target = df[config.target_column]
        stratify = (
            target if target.nunique(dropna=True) > 1 and target.value_counts().min() >= 2 else None
        )
        train_idx, test_idx = train_test_split(
            df.index,
            test_size=config.test_size,
            random_state=config.random_state,
            stratify=stratify,
        )
        return train_idx, test_idx, "random"


def create_preprocessor(scale_numeric: bool) -> ColumnTransformer:
    """Create preprocessing for numeric and categorical features."""
    numeric_steps: list[tuple[str, object]] = [("imputer", SimpleImputer(strategy="median"))]
    if scale_numeric:
        numeric_steps.append(("scaler", StandardScaler()))

    numeric_pipeline = Pipeline(numeric_steps)
    categorical_pipeline = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, make_column_selector(dtype_include=np.number)),
            ("categorical", categorical_pipeline, make_column_selector(dtype_exclude=np.number)),
        ]
    )


def prepare_train_test_data(
    csv_path: str, config: PreprocessingConfig
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, dict, list[str], list[str], str]:
    """Load, inspect, clean, engineer, and split a CSV dataset for classification."""
    raw_df = load_csv(csv_path)
    inspection = inspect_dataframe(raw_df)

    # 1. Clean data and apply domain physical-range checks
    feature_columns = resolve_feature_columns(raw_df, config)
    cleaned_df, cleaning_notes = clean_dataframe(
        raw_df, feature_columns, config.target_column, config.timestamp_column
    )

    # 2. Engineer spatiotemporal and cyclic features
    engineered_df = engineer_features(cleaned_df, config)

    # Re-evaluate feature columns after engineering to exclude metadata/targets
    exclude_metadata = {
        config.target_column,
        config.timestamp_column,
        config.group_column,
        "event_id",
        "synthetic",
        "data_quality",
    }
    feature_columns = [col for col in engineered_df.columns if col not in exclude_metadata]

    # 3. Perform Leakage-Safe Split (temporal, group, or random)
    train_idx, test_idx, strategy_used = split_data(engineered_df, config)

    train_df = engineered_df.loc[train_idx]
    test_df = engineered_df.loc[test_idx]

    # 4. Separate Features & Target (Preprocessing pipeline will only be fitted on x_train)
    x_train, y_train = split_features_target(train_df, feature_columns, config.target_column)
    x_test, y_test = split_features_target(test_df, feature_columns, config.target_column)

    return (
        x_train,
        x_test,
        y_train,
        y_test,
        inspection,
        cleaning_notes,
        feature_columns,
        strategy_used,
    )
