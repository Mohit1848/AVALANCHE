"""Dataset validation script for avalanche risk prediction datasets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


PHYSICAL_RANGES: dict[str, tuple[float | None, float | None]] = {
    "latitude": (-90.0, 90.0),
    "longitude": (-180.0, 180.0),
    "elevation": (0.0, 9000.0),
    "slope": (0.0, 90.0),
    "aspect": (0.0, 360.0),
    "temperature": (-80.0, 60.0),
    "snow_depth": (0.0, 2000.0),
    "snow_water_equivalent": (0.0, 5000.0),
    "snowfall_24h": (0.0, 1000.0),
    "snowfall_72h": (0.0, 2000.0),
    "wind_speed_mean_24h": (0.0, 300.0),
    "wind_speed_max_24h": (0.0, 400.0),
}


def validate_dataset(csv_path: str | Path) -> dict[str, Any]:
    """Perform comprehensive data quality and schema validation."""
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path}")

    df = pd.read_csv(path)
    total_rows, total_cols = df.shape

    # 1. Schema check
    expected_cols = [
        "timestamp",
        "location_id",
        "latitude",
        "longitude",
        "elevation",
        "slope",
        "aspect",
        "temperature",
        "snow_depth",
        "snow_water_equivalent",
        "snowfall_24h",
        "snowfall_72h",
        "wind_speed_mean_24h",
        "wind_speed_max_24h",
        "avalanche_occurred",
        "data_type",
    ]
    present_cols = list(df.columns)
    missing_cols = [c for c in expected_cols if c not in present_cols]
    extra_cols = [c for c in present_cols if c not in expected_cols]

    # 2. Missing values & Duplicates
    missing_counts = df.isna().sum().to_dict()
    total_missing = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())

    # 3. Data types
    dtypes = {c: str(df[c].dtype) for c in df.columns}

    # 4. Target distribution
    target_col = "avalanche_occurred"
    target_stats: dict[str, Any] = {}
    if target_col in df.columns:
        counts = df[target_col].value_counts().to_dict()
        proportions = df[target_col].value_counts(normalize=True).to_dict()
        target_stats = {
            "counts": {str(k): int(v) for k, v in counts.items()},
            "proportions": {str(k): round(float(v), 4) for k, v in proportions.items()},
            "imbalance_ratio": round(
                float(counts.get(1, 0)) / float(counts.get(0, 1)), 4
            )
            if counts.get(0, 0) > 0
            else None,
        }

    # 5. Range checks
    range_violations: dict[str, int] = {}
    range_summaries: dict[str, dict[str, float]] = {}
    for col, (min_val, max_val) in PHYSICAL_RANGES.items():
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            s = df[col].dropna()
            violations = 0
            if min_val is not None:
                violations += int((s < min_val).sum())
            if max_val is not None:
                violations += int((s > max_val).sum())
            range_violations[col] = violations
            range_summaries[col] = {
                "min": round(float(s.min()), 2),
                "max": round(float(s.max()), 2),
                "mean": round(float(s.mean()), 2),
                "std": round(float(s.std()), 2),
            }

    # 6. Categorical & Metadata distribution
    locations = {}
    if "location_id" in df.columns:
        locations = {str(k): int(v) for k, v in df["location_id"].value_counts().items()}

    data_types = {}
    if "data_type" in df.columns:
        data_types = {str(k): int(v) for k, v in df["data_type"].value_counts().items()}

    # 7. Timestamp validation
    ts_info: dict[str, Any] = {}
    if "timestamp" in df.columns:
        parsed_ts = pd.to_datetime(df["timestamp"], errors="coerce")
        invalid_ts = int(parsed_ts.isna().sum())
        ts_info = {
            "valid_timestamps": total_rows - invalid_ts,
            "invalid_timestamps": invalid_ts,
            "min_timestamp": str(parsed_ts.min()) if not parsed_ts.empty else None,
            "max_timestamp": str(parsed_ts.max()) if not parsed_ts.empty else None,
            "span_days": round((parsed_ts.max() - parsed_ts.min()).total_seconds() / 86400, 1)
            if not parsed_ts.empty
            else 0,
        }

    report = {
        "dataset_path": str(path),
        "total_rows": total_rows,
        "total_columns": total_cols,
        "schema_validation": {
            "expected_columns": expected_cols,
            "missing_columns": missing_cols,
            "extra_columns": extra_cols,
            "is_valid": len(missing_cols) == 0,
        },
        "data_quality": {
            "total_missing_values": total_missing,
            "missing_per_column": missing_counts,
            "duplicate_rows": duplicate_rows,
            "range_violations": range_violations,
        },
        "target_distribution": target_stats,
        "feature_summary": range_summaries,
        "locations": {
            "count": len(locations),
            "distribution": locations,
        },
        "data_type_metadata": data_types,
        "timestamp_summary": ts_info,
        "synthetic_notice": (
            "NOTICE: Target labels in this dataset are simulated using a synthetic heuristic. "
            "Data must not be represented as verified field observations."
        ),
    }

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate avalanche dataset schema and data quality.")
    parser.add_argument(
        "--data",
        default="data/avalanche_synthetic_20000.csv",
        help="Path to CSV dataset.",
    )
    parser.add_argument(
        "--output",
        default="reports/evaluation/dataset_validation_report.json",
        help="Path to save validation report JSON.",
    )
    args = parser.parse_args()

    report = validate_dataset(args.data)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"=== Dataset Validation Report ===")
    print(f"Dataset: {report['dataset_path']}")
    print(f"Rows: {report['total_rows']}, Columns: {report['total_columns']}")
    print(f"Schema Valid: {report['schema_validation']['is_valid']}")
    print(f"Duplicates: {report['data_quality']['duplicate_rows']}")
    print(f"Missing Values: {report['data_quality']['total_missing_values']}")
    print(f"Target Distribution: {report['target_distribution']['counts']}")
    print(f"Locations ({report['locations']['count']}): {list(report['locations']['distribution'].keys())[:5]}...")
    print(f"Saved validation report to: {out_path}")


if __name__ == "__main__":
    main()
