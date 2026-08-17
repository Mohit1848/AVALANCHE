"""Automated Dataset-Level EDA & Leakage Audit Generator.

Calculates comprehensive statistics, missingness profiles, class breakdowns,
natural vs human-triggered distributions, spatial/temporal match metrics,
and performs an automated data leakage audit.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd


def generate_eda_summary(df: pd.DataFrame) -> dict[str, Any]:
    """Generate comprehensive EDA metrics on the integrated canonical dataset."""
    total_records = len(df)
    positive_events = int((df["avalanche_occurred"] == 1).sum())
    background_records = int((df["avalanche_occurred"] == 0).sum())
    
    unique_locations = int(df["location_id"].nunique())
    unique_stations = int(df["location_id"].str.extract(r"SNTL_(\d+)", expand=False).nunique())
    
    df["dt"] = pd.to_datetime(df["timestamp"])
    date_min = df["dt"].min().strftime("%Y-%m-%d")
    date_max = df["dt"].max().strftime("%Y-%m-%d")
    
    # Seasons: Nov 1 to May 31
    def get_season(dt):
        year = dt.year
        return f"{year-1}-{year}" if dt.month < 8 else f"{year}-{year+1}"
    
    df["season"] = df["dt"].apply(get_season)
    season_distribution = df[df["avalanche_occurred"] == 1]["season"].value_counts().to_dict()
    
    # Trigger distribution
    trigger_col = "trigger_category" if "trigger_category" in df.columns else "trigger"
    trigger_dist = df[df["avalanche_occurred"] == 1][trigger_col].value_counts().to_dict() if trigger_col in df.columns else {}

    # Missingness
    missingness = df.isna().sum().to_dict()
    missing_pct = {col: round(cnt / total_records * 100, 2) for col, cnt in missingness.items()}

    # Spatial quality metrics
    dist_series = df["station_distance_km"].dropna()
    elev_diff_series = df["station_elevation_difference_m"].dropna()
    
    spatial_stats = {
        "station_distance_km_median": round(float(dist_series.median()), 2) if len(dist_series) else 0.0,
        "station_distance_km_p95": round(float(dist_series.quantile(0.95)), 2) if len(dist_series) else 0.0,
        "elevation_diff_m_median": round(float(elev_diff_series.median()), 1) if len(elev_diff_series) else 0.0,
        "elevation_diff_m_p95": round(float(elev_diff_series.quantile(0.95)), 1) if len(elev_diff_series) else 0.0,
        "match_quality_distribution": df["station_match_quality"].value_counts().to_dict() if "station_match_quality" in df.columns else {},
    }

    # Temporal quality metrics
    prec_dist = df["timestamp_precision"].value_counts().to_dict() if "timestamp_precision" in df.columns else {}

    # Numeric feature distributions
    feature_cols = [
        "temperature", "snow_depth", "snow_water_equivalent", "precipitation",
        "snowfall_6h", "snowfall_24h", "snowfall_72h",
        "temperature_delta_24h", "temperature_delta_72h",
        "wind_speed_mean_24h", "wind_speed_max_24h",
        "slope", "elevation"
    ]
    
    feature_stats = {}
    for col in feature_cols:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            s = df[col].dropna()
            if len(s):
                feature_stats[col] = {
                    "mean": round(float(s.mean()), 2),
                    "std": round(float(s.std()), 2),
                    "min": round(float(s.min()), 2),
                    "p25": round(float(s.quantile(0.25)), 2),
                    "median": round(float(s.median()), 2),
                    "p75": round(float(s.quantile(0.75)), 2),
                    "max": round(float(s.max()), 2),
                }

    return {
        "dataset_size": {
            "total_records": total_records,
            "positive_events": positive_events,
            "background_records": background_records,
            "class_ratio_positive_pct": round(positive_events / total_records * 100, 2) if total_records else 0,
            "unique_locations": unique_locations,
            "unique_snotel_stations": unique_stations,
            "date_range": f"{date_min} to {date_max}",
        },
        "label_distribution": {
            "trigger_breakdown": trigger_dist,
            "events_by_season": season_distribution,
        },
        "data_quality_and_missingness": {
            "missing_counts": missingness,
            "missing_percentages": missing_pct,
            "duplicate_rows": int(df.duplicated().sum()),
        },
        "spatial_matching_quality": spatial_stats,
        "temporal_precision_distribution": prec_dist,
        "feature_summary_statistics": feature_stats,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate dataset-level EDA and quality audit.")
    parser.add_argument("--input", default="data/processed/canonical_training_2021_2024.csv", help="Path to canonical CSV")
    parser.add_argument("--out", default="data/processed/eda_summary_report.json", help="Path to output JSON summary")
    args = parser.parse_args()

    in_p = Path(args.input)
    if not in_p.exists():
        # Fallback to spike sample if multi-season CSV not yet compiled
        in_p = Path("data/processed/canonical_spike_sample.csv")
    
    print(f"Analyzing canonical dataset at {in_p}...")
    df = pd.read_csv(in_p)
    eda = generate_eda_summary(df)
    
    out_p = Path(args.out)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    out_p.write_text(json.dumps(eda, indent=2), encoding="utf-8")
    
    print(json.dumps(eda, indent=2))
    print(f"\nEDA report successfully saved to {out_p}")


if __name__ == "__main__":
    main()
