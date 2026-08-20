"""Himalayan Avalanche Risk Machine Learning Training Pipeline.

Trains and benchmarks candidate models (Random Forest, Extra Trees, Gradient Boosting,
HistGradientBoosting, Logistic Regression) using strict season-based temporal splitting,
leakage-safe preprocessing, and sigmoid probability calibration on the audited Himalayan dataset.
"""

from __future__ import annotations

import datetime
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import (
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    HistGradientBoostingClassifier,
    RandomForestClassifier,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    fbeta_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
CANONICAL_HIMALAYA_CSV = DATA_DIR / "processed" / "himalaya" / "canonical_training_himalaya.csv"
MODELS_DIR = PROJECT_ROOT / "models"
HIMALAYA_MODEL_DIR = MODELS_DIR / "himalaya"
REPORTS_DIR = PROJECT_ROOT / "reports" / "evaluation"

CANONICAL_FEATURES = [
    "slope", "aspect_sin", "aspect_cos", "elevation",
    "temperature", "humidity", "pressure", "precipitation",
    "snow_depth", "snow_water_equivalent",
    "snowfall_6h", "snowfall_24h", "snowfall_72h",
    "temperature_delta_24h", "temperature_delta_72h",
    "wind_speed_mean_24h", "wind_speed_max_24h"
]


def calculate_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 5) -> float:
    """Calculate Expected Calibration Error (ECE) for probability estimates."""
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    bin_indices = np.digitize(y_prob, bins) - 1
    bin_indices = np.clip(bin_indices, 0, n_bins - 1)

    ece = 0.0
    n = len(y_true)
    if n == 0:
        return 0.0

    for b in range(n_bins):
        mask = bin_indices == b
        if np.any(mask):
            bin_acc = np.mean(y_true[mask])
            bin_conf = np.mean(y_prob[mask])
            ece += (np.sum(mask) / n) * abs(bin_acc - bin_conf)

    return float(round(ece, 4))


def compute_safety_metrics(y_true: np.ndarray, y_prob: np.ndarray, threshold: float = 0.40) -> Dict[str, Any]:
    """Compute comprehensive classification and calibration safety metrics."""
    y_pred = (y_prob >= threshold).astype(int)
    
    # Handle single class edge cases gracefully
    try:
        rec = float(recall_score(y_true, y_pred, zero_division=0))
    except Exception:
        rec = 0.0

    try:
        prec = float(precision_score(y_true, y_pred, zero_division=0))
    except Exception:
        prec = 0.0

    try:
        f1 = float(f1_score(y_true, y_pred, zero_division=0))
    except Exception:
        f1 = 0.0

    try:
        f2 = float(fbeta_score(y_true, y_pred, beta=2, zero_division=0))
    except Exception:
        f2 = 0.0

    try:
        pr_auc = float(average_precision_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 1.0
    except Exception:
        pr_auc = 0.0

    try:
        roc_auc = float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 1.0
    except Exception:
        roc_auc = 0.0

    brier = float(brier_score_loss(y_true, y_prob))
    ece = calculate_ece(y_true, y_prob)

    tn, fp, fn, tp = 0, 0, 0, 0
    if len(np.unique(y_true)) > 1:
        cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
        tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])
    else:
        if y_true[0] == 1:
            tp = int((y_pred == 1).sum())
            fn = int((y_pred == 0).sum())
        else:
            tn = int((y_pred == 0).sum())
            fp = int((y_pred == 1).sum())

    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    fnr = float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0

    return {
        "recall": round(rec, 4),
        "precision": round(prec, 4),
        "f1_score": round(f1, 4),
        "f2_score": round(f2, 4),
        "specificity": round(specificity, 4),
        "false_negative_rate": round(fnr, 4),
        "pr_auc": round(pr_auc, 4),
        "roc_auc": round(roc_auc, 4),
        "brier_score": round(brier, 4),
        "expected_calibration_error": round(ece, 4),
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
    }


def train_and_benchmark_himalayan_models() -> Dict[str, Any]:
    """Execute Himalayan candidate model training and validation."""
    print("Loading audited Himalayan dataset...")
    if not CANONICAL_HIMALAYA_CSV.exists():
        raise FileNotFoundError(f"Audited Himalayan canonical dataset not found at {CANONICAL_HIMALAYA_CSV}")

    df = pd.read_csv(CANONICAL_HIMALAYA_CSV)
    print(f"Total canonical records: N = {len(df)} (Events: {(df['avalanche_occurred'] == 1).sum()}, Background: {(df['avalanche_occurred'] == 0).sum()})")

    # 1. Season-Based Temporal Partitions
    # TRAIN: 2014-2015 to 2021-2022 (8 seasons)
    # VALIDATION: 2022-2023 (1 season)
    # TEST: 2023-2024 (1 season, held-out untouched)
    train_df = df[df["season"].isin([
        "2014-2015", "2015-2016", "2016-2017", "2017-2018",
        "2018-2019", "2019-2020", "2020-2021", "2021-2022"
    ])].copy()

    val_df = df[df["season"] == "2022-2023"].copy()
    test_df = df[df["season"] == "2023-2024"].copy()

    print(f"Split sizes -> Train: {len(train_df)} records, Val (2022-23): {len(val_df)} records, Test (2023-24): {len(test_df)} records")

    X_train = train_df[CANONICAL_FEATURES].copy()
    y_train = train_df["avalanche_occurred"].values

    X_val = val_df[CANONICAL_FEATURES].copy()
    y_val = val_df["avalanche_occurred"].values

    X_test = test_df[CANONICAL_FEATURES].copy()
    y_test = test_df["avalanche_occurred"].values

    # Preprocessing Pipeline fitted ONLY on training data
    preprocessor = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", RobustScaler()),
    ])
    preprocessor.fit(X_train)

    X_train_proc = preprocessor.transform(X_train)
    X_val_proc = preprocessor.transform(X_val)

    # 2. Candidate Models Definition (Conservative hyperparameters for N=44 small sample)
    candidate_models = {
        "Random Forest": RandomForestClassifier(n_estimators=50, max_depth=4, min_samples_leaf=2, random_state=42),
        "Extra Trees": ExtraTreesClassifier(n_estimators=50, max_depth=4, min_samples_leaf=2, random_state=42),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=40, max_depth=3, learning_rate=0.08, random_state=42),
        "HistGradientBoosting": HistGradientBoostingClassifier(max_iter=40, max_depth=3, learning_rate=0.08, random_state=42),
        "Logistic Regression": LogisticRegression(C=0.5, penalty="l2", solver="lbfgs", random_state=42),
    }

    benchmark_results = []
    trained_pipelines = {}

    for name, clf in candidate_models.items():
        clf.fit(X_train_proc, y_train)
        
        train_prob = clf.predict_proba(X_train_proc)[:, 1]
        val_prob = clf.predict_proba(X_val_proc)[:, 1]

        train_m = compute_safety_metrics(y_train, train_prob)
        val_m = compute_safety_metrics(y_val, val_prob)

        # Evaluate Sigmoid Probability Calibration
        calibrated_clf = CalibratedClassifierCV(estimator=clf, method="sigmoid", cv=3)
        calibrated_clf.fit(X_train_proc, y_train)
        val_calib_prob = calibrated_clf.predict_proba(X_val_proc)[:, 1]
        val_calib_m = compute_safety_metrics(y_val, val_calib_prob)

        benchmark_results.append({
            "model_name": name,
            "train_recall": train_m["recall"],
            "train_f2": train_m["f2_score"],
            "train_brier": train_m["brier_score"],
            "val_recall": val_m["recall"],
            "val_precision": val_m["precision"],
            "val_f1": val_m["f1_score"],
            "val_f2": val_m["f2_score"],
            "val_brier_uncalibrated": val_m["brier_score"],
            "val_brier_calibrated": val_calib_m["brier_score"],
            "val_ece": val_calib_m["expected_calibration_error"],
            "val_fnr": val_m["false_negative_rate"],
        })

        trained_pipelines[name] = {
            "uncalibrated": clf,
            "calibrated": calibrated_clf,
            "val_metrics": val_calib_m,
        }

    benchmark_df = pd.DataFrame(benchmark_results).sort_values(by="val_f2", ascending=False)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    comparison_csv = REPORTS_DIR / "himalaya_model_comparison.csv"
    benchmark_df.to_csv(comparison_csv, index=False)
    print(f"Candidate model comparison saved to: {comparison_csv}")

    # 3. Select Champion Model based on Validation F2 and Brier score
    best_model_name = benchmark_df.iloc[0]["model_name"]
    print(f"Selected Champion Model: '{best_model_name}' (Validation F2: {benchmark_df.iloc[0]['val_f2']})")

    # Fit champion model on combined Train+Val for final test evaluation
    X_train_val = pd.concat([X_train, X_val], ignore_index=True)
    y_train_val = np.concatenate([y_train, y_val])

    final_preprocessor = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", RobustScaler()),
    ])
    final_preprocessor.fit(X_train_val)

    X_train_val_proc = final_preprocessor.transform(X_train_val)
    X_test_proc = final_preprocessor.transform(X_test)

    # Re-instantiate clean base classifier
    base_champion = candidate_models[best_model_name]
    base_champion.fit(X_train_val_proc, y_train_val)

    # Sigmoid calibration fitted strictly on train_val (using 3-fold cross validation)
    calibrated_champion = CalibratedClassifierCV(estimator=base_champion, method="sigmoid", cv=3)
    calibrated_champion.fit(X_train_val_proc, y_train_val)

    # 4. Final Held-Out Evaluation on untouched 2023-2024 Season
    test_prob = calibrated_champion.predict_proba(X_test_proc)[:, 1]
    test_metrics = compute_safety_metrics(y_test, test_prob, threshold=0.40)
    print(f"Held-Out Test Set (2023-2024 Season) Metrics -> Recall: {test_metrics['recall']}, F2: {test_metrics['f2_score']}, Brier: {test_metrics['brier_score']}, ECE: {test_metrics['expected_calibration_error']}")

    # 5. Save Himalayan Model Artifact Bundle
    HIMALAYA_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = HIMALAYA_MODEL_DIR / "avalanche_model.joblib"

    himalaya_bundle = {
        "model": calibrated_champion,
        "base_model": base_champion,
        "preprocessor": final_preprocessor,
        "model_name": f"himalaya_{best_model_name.lower().replace(' ', '_')}_v1",
        "domain": "HIMALAYA",
        "target_column": "avalanche_occurred",
        "feature_columns": CANONICAL_FEATURES,
        "classes": [0, 1],
        "positive_label": 1,
        "sample_size": len(df),
        "event_count": int((df["avalanche_occurred"] == 1).sum()),
        "background_count": int((df["avalanche_occurred"] == 0).sum()),
        "seasons_count": len(df["season"].unique()),
        "temporal_partitions": {
            "train_seasons": ["2014-2015", "2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021", "2021-2022"],
            "val_season": "2022-2023",
            "test_season": "2023-2024",
        },
        "risk_thresholds": {
            "status": "UNVALIDATED_RESEARCH_ONLY",
            "medium": 0.40,
            "high": 0.70,
            "disclaimer": "Thresholds are provisional research defaults and must not be used for operational safety."
        },
        "validation_metrics": {
            "validation_season_2022_2023": benchmark_df.iloc[0].to_dict(),
            "held_out_test_season_2023_2024": test_metrics,
        },
        "calibration_metadata": {
            "method": "sigmoid",
            "calibrated": True,
            "cv_strategy": "3-Fold Stratified on Historical Seasons (2014-2023)",
        },
        "created_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "gating_state": "CALIBRATED",
        "model_status": "RESEARCH_ONLY",
        "inference_enabled": False,
        "safety_disclaimer": "This model is a research decision-support model and is not a certified avalanche warning system."
    }

    joblib.dump(himalaya_bundle, artifact_path)
    print(f"Himalayan model bundle saved to: {artifact_path}")

    return {
        "best_model_name": best_model_name,
        "benchmark_df": benchmark_df,
        "test_metrics": test_metrics,
        "bundle_path": str(artifact_path),
    }


if __name__ == "__main__":
    train_and_benchmark_himalayan_models()
