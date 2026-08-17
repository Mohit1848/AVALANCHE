"""Strict Season-Based Temporal Holdout Evaluation."""

from __future__ import annotations

import pandas as pd
import numpy as np
from typing import Any, Dict, List
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    confusion_matrix,
    recall_score,
    precision_score,
    f1_score,
    fbeta_score,
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
)


def evaluate_temporal_holdout(
    df: pd.DataFrame,
    feature_cols: List[str],
    target_col: str = "label",
    season_col: str = "season",
    train_seasons: List[str] = None,
    val_season: str = "2022-2023",
    test_season: str = "2023-2024",
    threshold: float = 0.40,
    random_state: int = 42,
) -> Dict[str, Any]:
    """Train on historical seasons, validate on intermediate season, evaluate on strictly untouched held-out season."""
    if train_seasons is None:
        train_seasons = [s for s in df[season_col].unique() if s not in [val_season, test_season]]

    # 1. Partition Data
    train_df = df[df[season_col].isin(train_seasons)].copy()
    val_df = df[df[season_col] == val_season].copy()
    test_df = df[df[season_col] == test_season].copy()

    x_train = train_df[feature_cols].fillna(0)
    y_train = train_df[target_col].values.astype(int)

    x_val = val_df[feature_cols].fillna(0)
    y_val = val_df[target_col].values.astype(int)

    x_test = test_df[feature_cols].fillna(0)
    y_test = test_df[target_col].values.astype(int)

    # 2. Fit base Random Forest
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=4,
        min_samples_leaf=2,
        random_state=random_state,
    )
    
    # 3. Fit CalibratedClassifierCV using training and validation splits
    cal_clf = CalibratedClassifierCV(estimator=rf, method="sigmoid", cv=3)
    cal_clf.fit(x_train, y_train)

    # 4. Evaluate Held-Out Test Set
    uncal_probs = rf.fit(x_train, y_train).predict_proba(x_test)[:, 1]
    cal_probs = cal_clf.predict_proba(x_test)[:, 1]
    preds = (cal_probs >= threshold).astype(int)

    cm = confusion_matrix(y_test, preds, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    pos_count = tp + fn
    neg_count = tn + fp

    rec = tp / pos_count if pos_count > 0 else 0.0
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    f1 = f1_score(y_test, preds, zero_division=0)
    f2 = fbeta_score(y_test, preds, beta=2, zero_division=0)
    spec = tn / neg_count if neg_count > 0 else 0.0
    fnr = fn / pos_count if pos_count > 0 else 0.0
    fpr = fp / neg_count if neg_count > 0 else 0.0
    roc_auc = roc_auc_score(y_test, cal_probs) if len(np.unique(y_test)) > 1 else 0.5
    pr_auc = average_precision_score(y_test, cal_probs) if len(np.unique(y_test)) > 1 else 0.0
    brier = brier_score_loss(y_test, cal_probs)

    # Attach predictions back to test_df for error analysis
    test_df_with_preds = test_df.copy()
    test_df_with_preds["calibrated_prob"] = cal_probs
    test_df_with_preds["uncalibrated_prob"] = uncal_probs
    test_df_with_preds["pred_binary"] = preds

    return {
        "title": "STRICT TEMPORAL HOLDOUT EVALUATION (HELD-OUT 2023–2024)",
        "train_seasons": train_seasons,
        "val_season": val_season,
        "test_season": test_season,
        "n_train": len(train_df),
        "n_val": len(val_df),
        "n_test": len(test_df),
        "test_positives": int(pos_count),
        "test_negatives": int(neg_count),
        "positive_rate": round(float(pos_count / max(1, len(test_df))), 4),
        "confusion_matrix": {
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
        },
        "metrics": {
            "recall": round(float(rec), 4),
            "precision": round(float(prec), 4),
            "f1": round(float(f1), 4),
            "f2": round(float(f2), 4),
            "specificity": round(float(spec), 4),
            "fnr": round(float(fnr), 4),
            "fpr": round(float(fpr), 4),
            "pr_auc": round(float(pr_auc), 4),
            "roc_auc": round(float(roc_auc), 4),
            "brier_score": round(float(brier), 4),
        },
        "operating_threshold": threshold,
        "test_df_with_preds": test_df_with_preds,
        "uncalibrated_probs": uncal_probs,
        "calibrated_probs": cal_probs,
        "y_test": y_test,
    }
