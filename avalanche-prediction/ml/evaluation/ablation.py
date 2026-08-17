"""Feature Group Ablation Study."""

from __future__ import annotations

import pandas as pd
import numpy as np
from typing import Any, Dict, List
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import recall_score, precision_score, fbeta_score, average_precision_score, brier_score_loss


FEATURE_GROUPS = {
    "A. Terrain Only": ["slope", "aspect_sin", "aspect_cos", "elevation"],
    "B. Weather Only": ["temperature", "humidity", "pressure", "precipitation", "wind_speed_mean_24h", "wind_speed_max_24h"],
    "C. Snowpack Only": ["snow_depth", "snow_water_equivalent", "snowfall_6h", "snowfall_24h", "snowfall_72h"],
    "D. Temporal Deltas Only": ["temperature_delta_24h", "temperature_delta_72h"],
    "E. Terrain + Weather": ["slope", "aspect_sin", "aspect_cos", "elevation", "temperature", "humidity", "pressure", "precipitation", "wind_speed_mean_24h", "wind_speed_max_24h"],
    "F. Terrain + Snowpack": ["slope", "aspect_sin", "aspect_cos", "elevation", "snow_depth", "snow_water_equivalent", "snowfall_6h", "snowfall_24h", "snowfall_72h"],
    "G. Full Model (17 Features)": [
        "slope", "aspect_sin", "aspect_cos", "elevation",
        "temperature", "humidity", "pressure", "precipitation",
        "snow_depth", "snow_water_equivalent",
        "snowfall_6h", "snowfall_24h", "snowfall_72h",
        "temperature_delta_24h", "temperature_delta_72h",
        "wind_speed_mean_24h", "wind_speed_max_24h"
    ],
}


def run_ablation_study(
    x_train: pd.DataFrame,
    y_train: np.ndarray,
    x_test: pd.DataFrame,
    y_test: np.ndarray,
    threshold: float = 0.40,
    random_state: int = 42,
) -> List[Dict[str, Any]]:
    """Train and evaluate each feature group under identical split and calibration protocol."""
    results: List[Dict[str, Any]] = []

    y_train = np.asarray(y_train, dtype=int)
    y_test = np.asarray(y_test, dtype=int)

    n_pos_tr = int(np.sum(y_train))
    n_neg_tr = len(y_train) - n_pos_tr
    min_class_count = min(n_pos_tr, n_neg_tr)

    for group_name, features in FEATURE_GROUPS.items():
        # Select available features
        avail_feats = [f for f in features if f in x_train.columns and f in x_test.columns]
        if not avail_feats:
            continue

        x_tr = x_train[avail_feats].fillna(0)
        x_te = x_test[avail_feats].fillna(0)

        # Train base RF
        base_rf = RandomForestClassifier(
            n_estimators=100,
            max_depth=4,
            min_samples_leaf=2,
            random_state=random_state,
        )
        
        # Calibrated classifier if class counts permit
        if min_class_count >= 2:
            cv_folds = min(3, min_class_count)
            cal_clf = CalibratedClassifierCV(estimator=base_rf, method="sigmoid", cv=cv_folds)
            cal_clf.fit(x_tr, y_train)
            probs = cal_clf.predict_proba(x_te)[:, 1]
        else:
            base_rf.fit(x_tr, y_train)
            probs = base_rf.predict_proba(x_te)[:, 1]

        preds = (probs >= threshold).astype(int)

        n_pos = int(np.sum(y_test))
        rec = float(recall_score(y_test, preds, zero_division=0)) if n_pos > 0 else 0.0
        prec = float(precision_score(y_test, preds, zero_division=0)) if n_pos > 0 else 0.0
        f2 = float(fbeta_score(y_test, preds, beta=2, zero_division=0)) if n_pos > 0 else 0.0
        pr_auc = float(average_precision_score(y_test, probs)) if n_pos > 0 and len(np.unique(y_test)) > 1 else 0.0
        brier = float(brier_score_loss(y_test, probs))

        results.append({
            "ablation_group": group_name,
            "feature_count": len(avail_feats),
            "features_used": ", ".join(avail_feats),
            "recall": round(rec, 4),
            "precision": round(prec, 4),
            "f2": round(f2, 4),
            "pr_auc": round(pr_auc, 4),
            "brier_score": round(brier, 4),
        })

    return results
