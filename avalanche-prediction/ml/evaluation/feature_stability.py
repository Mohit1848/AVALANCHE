"""Feature Importance Stability & Association Analysis."""

from __future__ import annotations

import pandas as pd
import numpy as np
from typing import Any, Dict, List
from sklearn.ensemble import RandomForestClassifier


def evaluate_feature_stability(
    x_folds: List[pd.DataFrame],
    y_folds: List[np.ndarray],
    feature_names: List[str],
    random_state: int = 42,
) -> List[Dict[str, Any]]:
    """Evaluate feature importance variance and rank stability across multiple cross-validation folds."""
    all_importances: List[np.ndarray] = []

    for x_f, y_f in zip(x_folds, y_folds):
        rf = RandomForestClassifier(n_estimators=100, max_depth=4, min_samples_leaf=2, random_state=random_state)
        rf.fit(x_f[feature_names].fillna(0), np.asarray(y_f, dtype=int))
        all_importances.append(rf.feature_importances_)

    imp_matrix = np.array(all_importances)  # shape (n_folds, n_features)
    mean_imp = np.mean(imp_matrix, axis=0)
    std_imp = np.std(imp_matrix, axis=0)

    # Rank per fold (1 = highest importance)
    ranks = np.zeros_like(imp_matrix)
    for i in range(len(imp_matrix)):
        ranks[i] = len(feature_names) - np.argsort(np.argsort(imp_matrix[i]))

    mean_rank = np.mean(ranks, axis=0)
    rank_std = np.std(ranks, axis=0)

    results: List[Dict[str, Any]] = []
    for idx, f in enumerate(feature_names):
        results.append({
            "feature": f,
            "mean_importance": round(float(mean_imp[idx]), 4),
            "std_importance": round(float(std_imp[idx]), 4),
            "mean_rank": round(float(mean_rank[idx]), 2),
            "rank_std": round(float(rank_std[idx]), 2),
            "stability_status": "HIGH STABILITY" if rank_std[idx] <= 2.0 else "MODERATE VARIANCE",
            "semantic_label": "MODEL ASSOCIATION (NOT CAUSALITY)",
        })

    results.sort(key=lambda item: item["mean_importance"], reverse=True)
    return results
