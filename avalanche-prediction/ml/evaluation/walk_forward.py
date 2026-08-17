"""Chronological Forward-Chaining Walk-Forward Cross-Validation."""

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


def evaluate_walk_forward(
    df: pd.DataFrame,
    feature_cols: List[str],
    target_col: str = "label",
    season_col: str = "season",
    folds_config: List[Dict[str, Any]] = None,
    threshold: float = 0.40,
    random_state: int = 42,
) -> Dict[str, Any]:
    """Execute forward-chaining chronological walk-forward splits."""
    if folds_config is None:
        folds_config = [
            {
                "fold_id": 1,
                "train_seasons": ["2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021"],
                "test_season": "2021-2022",
            },
            {
                "fold_id": 2,
                "train_seasons": ["2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021", "2021-2022"],
                "test_season": "2022-2023",
            },
            {
                "fold_id": 3,
                "train_seasons": ["2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021", "2021-2022", "2022-2023"],
                "test_season": "2023-2024",
            },
        ]

    fold_results: List[Dict[str, Any]] = []
    x_folds_train: List[pd.DataFrame] = []
    y_folds_train: List[np.ndarray] = []

    for fold in folds_config:
        train_df = df[df[season_col].isin(fold["train_seasons"])].copy()
        test_df = df[df[season_col] == fold["test_season"]].copy()

        if len(train_df) == 0 or len(test_df) == 0:
            continue

        x_train = train_df[feature_cols].fillna(0)
        y_train = train_df[target_col].values.astype(int)
        x_test = test_df[feature_cols].fillna(0)
        y_test = test_df[target_col].values.astype(int)

        x_folds_train.append(x_train)
        y_folds_train.append(y_train)

        rf = RandomForestClassifier(n_estimators=100, max_depth=4, min_samples_leaf=2, random_state=random_state)
        cal_clf = CalibratedClassifierCV(estimator=rf, method="sigmoid", cv=3)
        cal_clf.fit(x_train, y_train)

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
        roc_auc = roc_auc_score(y_test, cal_probs) if len(np.unique(y_test)) > 1 else 0.5
        pr_auc = average_precision_score(y_test, cal_probs) if len(np.unique(y_test)) > 1 else 0.0
        brier = brier_score_loss(y_test, cal_probs)

        fold_results.append({
            "fold_id": fold["fold_id"],
            "train_seasons": fold["train_seasons"],
            "test_season": fold["test_season"],
            "n_train": len(train_df),
            "n_test": len(test_df),
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
            "recall": round(float(rec), 4),
            "precision": round(float(prec), 4),
            "f1": round(float(f1), 4),
            "f2": round(float(f2), 4),
            "specificity": round(float(spec), 4),
            "fnr": round(float(fnr), 4),
            "pr_auc": round(float(pr_auc), 4),
            "roc_auc": round(float(roc_auc), 4),
            "brier_score": round(float(brier), 4),
        })

    # Average metrics across walk-forward folds
    avg_recall = float(np.mean([f["recall"] for f in fold_results])) if fold_results else 0.0
    avg_precision = float(np.mean([f["precision"] for f in fold_results])) if fold_results else 0.0
    avg_f1 = float(np.mean([f["f1"] for f in fold_results])) if fold_results else 0.0
    avg_f2 = float(np.mean([f["f2"] for f in fold_results])) if fold_results else 0.0
    avg_pr_auc = float(np.mean([f["pr_auc"] for f in fold_results])) if fold_results else 0.0
    avg_roc_auc = float(np.mean([f["roc_auc"] for f in fold_results])) if fold_results else 0.0
    avg_brier = float(np.mean([f["brier_score"] for f in fold_results])) if fold_results else 0.0

    return {
        "title": "WALK-FORWARD CHRONOLOGICAL CROSS-VALIDATION",
        "folds": fold_results,
        "average_metrics": {
            "recall": round(avg_recall, 4),
            "precision": round(avg_precision, 4),
            "f1": round(avg_f1, 4),
            "f2": round(avg_f2, 4),
            "pr_auc": round(avg_pr_auc, 4),
            "roc_auc": round(avg_roc_auc, 4),
            "brier_score": round(avg_brier, 4),
        },
        "x_folds_train": x_folds_train,
        "y_folds_train": y_folds_train,
    }
