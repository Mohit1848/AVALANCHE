"""Subgroup Analysis with Minimum Sample Guard."""

from __future__ import annotations

import pandas as pd
import numpy as np
from typing import Any, Dict, List
from sklearn.metrics import recall_score, precision_score, fbeta_score


def evaluate_subgroups(
    df: pd.DataFrame,
    y_true_col: str,
    y_prob_col: str,
    threshold: float = 0.40,
    min_sample_size: int = 5,
) -> Dict[str, List[Dict[str, Any]]]:
    """Perform subgroup performance evaluation across triggers, zones, elevation bands, slope bands, and seasons."""
    df = df.copy()
    df["pred_binary"] = (df[y_prob_col] >= threshold).astype(int)

    categories = {
        "trigger_category": "Trigger Subgroups",
        "zone_id": "Forecast Zone Subgroups",
        "elevation_band": "Elevation Bands",
        "slope_band": "Slope Angle Bands",
        "season": "Winter Seasons",
    }

    # Generate synthetic category columns if not present
    if "elevation_band" not in df.columns and "elevation" in df.columns:
        df["elevation_band"] = pd.cut(
            df["elevation"],
            bins=[-np.inf, 3200, 3500, np.inf],
            labels=["< 3,200m", "3,200m - 3,500m", "> 3,500m"],
        )

    if "slope_band" not in df.columns and "slope" in df.columns:
        df["slope_band"] = pd.cut(
            df["slope"],
            bins=[-np.inf, 30.0, 38.0, np.inf],
            labels=["< 30° (Sub-critical)", "30° - 38° (Core Prone)", "> 38° (Steep Release)"],
        )

    report: Dict[str, List[Dict[str, Any]]] = {}

    for col, group_title in categories.items():
        if col not in df.columns:
            continue

        group_results: List[Dict[str, Any]] = []
        for group_val, grp_df in df.groupby(col, observed=True):
            n_total = len(grp_df)
            n_pos = int(grp_df[y_true_col].sum())
            n_neg = n_total - n_pos

            if n_total < min_sample_size:
                group_results.append({
                    "subgroup_column": col,
                    "subgroup_value": str(group_val),
                    "status": "INSUFFICIENT SAMPLE",
                    "n_total": n_total,
                    "n_positive": n_pos,
                    "n_negative": n_neg,
                    "recall": None,
                    "precision": None,
                    "f2": None,
                    "missed_events": None,
                    "note": f"Sample size (N={n_total}) < threshold ({min_sample_size}). Suppressed to prevent misleading percentages.",
                })
                continue

            # Calculate metrics if positives exist
            if n_pos > 0:
                rec = float(recall_score(grp_df[y_true_col], grp_df["pred_binary"], zero_division=0))
                prec = float(precision_score(grp_df[y_true_col], grp_df["pred_binary"], zero_division=0))
                f2 = float(fbeta_score(grp_df[y_true_col], grp_df["pred_binary"], beta=2, zero_division=0))
                missed = int(grp_df[(grp_df[y_true_col] == 1) & (grp_df["pred_binary"] == 0)].shape[0])
            else:
                rec = None
                prec = None
                f2 = None
                missed = 0

            group_results.append({
                "subgroup_column": col,
                "subgroup_value": str(group_val),
                "status": "VALID",
                "n_total": n_total,
                "n_positive": n_pos,
                "n_negative": n_neg,
                "recall": round(rec, 4) if rec is not None else None,
                "precision": round(prec, 4) if prec is not None else None,
                "f2": round(f2, 4) if f2 is not None else None,
                "missed_events": missed,
                "note": "Evaluated at operating threshold θ = 0.40.",
            })

        report[col] = group_results

    return report
