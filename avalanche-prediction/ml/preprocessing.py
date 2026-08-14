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
from sklearn.model_selection import train_test_split
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
    "snow_density",
]


@dataclass
class PreprocessingConfig:
    """Configuration for mapping an external CSV dataset into model inputs."""

    target_column: str
    feature_columns: list[str] | None = None
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

    if config.feature_columns:
        missing_features = [column for column in config.feature_columns if column not in df.columns]
        if missing_features:
            raise ValueError(
                f"Feature columns not found: {missing_features}. "
                f"Available columns: {list(df.columns)}"
            )
        return config.feature_columns

    return [column for column in df.columns if column != config.target_column]


def clean_dataframe(
    df: pd.DataFrame, feature_columns: Iterable[str], target_column: str
) -> tuple[pd.DataFrame, list[str]]:
    """Remove duplicates, handle infinite values, and mark invalid values missing."""

    cleaned = df.copy()
    notes: list[str] = []

    duplicate_count = int(cleaned.duplicated().sum())
    if duplicate_count:
        cleaned = cleaned.drop_duplicates()
        notes.append(f"Removed {duplicate_count} duplicate rows.")

    numeric_columns = cleaned.select_dtypes(include=[np.number]).columns
    infinite_count = int(np.isinf(cleaned[numeric_columns]).sum().sum()) if len(numeric_columns) else 0
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
        "wind_speed": (0, None),
        "wind_direction": (0, 360),
        "pressure": (300, 1100),
        "slope": (0, 90),
        "snow_density": (0, None),
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


def split_features_target(
    df: pd.DataFrame, feature_columns: list[str], target_column: str
) -> tuple[pd.DataFrame, pd.Series]:
    """Separate model features from the avalanche target."""

    return df[feature_columns], df[target_column]


def create_preprocessor(scale_numeric: bool) -> ColumnTransformer:
    """Create preprocessing for numeric and categorical features.

    Random Forest does not need scaled numeric values. Logistic Regression is
    sensitive to feature scale, so it should use scaling.
    """

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
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, dict, list[str], list[str]]:
    """Load, inspect, clean, and split a CSV dataset for classification."""

    raw_df = load_csv(csv_path)
    inspection = inspect_dataframe(raw_df)
    feature_columns = resolve_feature_columns(raw_df, config)
    cleaned_df, cleaning_notes = clean_dataframe(raw_df, feature_columns, config.target_column)
    x, y = split_features_target(cleaned_df, feature_columns, config.target_column)

    stratify = y if y.nunique(dropna=True) > 1 and y.value_counts().min() >= 2 else None
    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=config.test_size,
        random_state=config.random_state,
        stratify=stratify,
    )

    return x_train, x_test, y_train, y_test, inspection, cleaning_notes, feature_columns
