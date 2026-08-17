"""Multi-Season Rolling Temporal Evaluation & Research Suite (2015–2024 Expanded Corpus).

Performs:
1. Walk-Forward / Rolling Chronological Validation across 4 distinct test seasons.
2. Calibration evaluation (Brier score, reliability).
3. Ablation study on expanded data.
4. Validation threshold sensitivity optimization.
5. Final single evaluation on 2023–2024 held-out season.
6. Subgroup evaluations (Natural vs Human-triggered vs Explosive).
7. Permutation and Gini feature importance.
8. Wilson score confidence intervals for all primary metrics.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    fbeta_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer


def wilson_score_interval(successes: int, total: int, confidence: float = 0.95) -> tuple[float, float]:
    """Calculate Wilson score confidence interval for binomial proportions."""
    if total == 0:
        return (0.0, 0.0)
    z = 1.96 if confidence == 0.95 else 1.645
    p = successes / total
    denom = 1.0 + (z**2 / total)
    centre = (p + (z**2 / (2.0 * total))) / denom
    margin = (z * math.sqrt((p * (1.0 - p) / total) + (z**2 / (4.0 * total**2)))) / denom
    lower = max(0.0, centre - margin)
    upper = min(1.0, centre + margin)
    return (round(lower, 4), round(upper, 4))


def evaluate_binary_predictions(
    y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray | None = None
) -> dict[str, Any]:
    """Calculate comprehensive safety metrics with confusion matrix counts and confidence intervals."""
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    total = len(y_true)

    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    f2 = fbeta_score(y_true, y_pred, beta=2, zero_division=0)
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0

    roc_auc = roc_auc_score(y_true, y_prob) if y_prob is not None and len(np.unique(y_true)) > 1 else None
    pr_auc = average_precision_score(y_true, y_prob) if y_prob is not None and len(np.unique(y_true)) > 1 else None
    brier = brier_score_loss(y_true, y_prob) if y_prob is not None else None

    rec_ci = wilson_score_interval(int(tp), int(tp + fn))
    prec_ci = wilson_score_interval(int(tp), int(tp + fp))
    fnr_ci = wilson_score_interval(int(fn), int(tp + fn))

    return {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "precision_ci_95": prec_ci,
        "recall": round(float(rec), 4),
        "recall_ci_95": rec_ci,
        "f1": round(float(f1), 4),
        "f2": round(float(f2), 4),
        "specificity": round(float(spec), 4),
        "fpr": round(float(fpr), 4),
        "fnr": round(float(fnr), 4),
        "fnr_ci_95": fnr_ci,
        "roc_auc": round(float(roc_auc), 4) if roc_auc is not None else None,
        "pr_auc": round(float(pr_auc), 4) if pr_auc is not None else None,
        "brier_score": round(float(brier), 4) if brier is not None else None,
        "counts": {
            "total": int(total),
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
            "actual_positives": int(tp + fn),
            "actual_negatives": int(tn + fp),
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate expanded historical avalanche corpus.")
    parser.add_argument("--data", default="data/processed/canonical_training_2015_2024.csv", help="Path to expanded CSV")
    parser.add_argument("--out-dir", default="data/processed/expanded_evaluation_results", help="Output directory")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.data)
    df["dt"] = pd.to_datetime(df["timestamp"])

    all_features = [
        "slope", "aspect_sin", "aspect_cos", "elevation",
        "temperature", "humidity", "pressure", "precipitation",
        "snow_depth", "snow_water_equivalent",
        "snowfall_6h", "snowfall_24h", "snowfall_72h",
        "temperature_delta_24h", "temperature_delta_72h",
        "wind_speed_mean_24h", "wind_speed_max_24h"
    ]

    weather_snow_features = [c for c in all_features if c not in ["slope", "aspect_sin", "aspect_cos", "elevation"]]
    terrain_features = ["slope", "aspect_sin", "aspect_cos", "elevation"]

    # 1. Primary Chronological Split
    # TRAIN: 2015-16 to 2020-21 (6 seasons)
    # VAL:   2021-22 and 2022-23 (2 seasons)
    # TEST:  2023-24 (1 final frozen season)
    
    train_mask = df["season"].isin(["2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021"])
    val_mask = df["season"].isin(["2021-2022", "2022-2023"])
    test_mask = df["season"].isin(["2023-2024"])

    train_df = df[train_mask].reset_index(drop=True)
    val_df = df[val_mask].reset_index(drop=True)
    test_df = df[test_mask].reset_index(drop=True)

    print("=================================================================")
    print("EXPANDED DATASET AUDIT (2015–2024)")
    print("=================================================================")
    print(f"Total Dataset Records: {len(df)} (Events: {(df['avalanche_occurred']==1).sum()}, Background: {(df['avalanche_occurred']==0).sum()})")
    print(f"TRAIN (2015–2021):     {len(train_df)} (Events: {(train_df['avalanche_occurred']==1).sum()}, Background: {(train_df['avalanche_occurred']==0).sum()})")
    print(f"VAL   (2021–2023):     {len(val_df)} (Events: {(val_df['avalanche_occurred']==1).sum()}, Background: {(val_df['avalanche_occurred']==0).sum()})")
    print(f"TEST  (2023–2024):     {len(test_df)} (Events: {(test_df['avalanche_occurred']==1).sum()}, Background: {(test_df['avalanche_occurred']==0).sum()})")

    # 2. Train and Validate Baseline Models
    x_train, y_train = train_df[all_features], train_df["avalanche_occurred"].values
    x_val, y_val = val_df[all_features], val_df["avalanche_occurred"].values
    x_test, y_test = test_df[all_features], test_df["avalanche_occurred"].values

    rf_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("clf", CalibratedClassifierCV(
            estimator=RandomForestClassifier(n_estimators=200, max_depth=5, class_weight="balanced", random_state=42),
            method="sigmoid", cv=TimeSeriesSplit(n_splits=3)
        ))
    ])

    lr_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("clf", CalibratedClassifierCV(
            estimator=LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
            method="sigmoid", cv=TimeSeriesSplit(n_splits=3)
        ))
    ])

    rf_pipe.fit(x_train, y_train)
    lr_pipe.fit(x_train, y_train)

    rf_val_prob = rf_pipe.predict_proba(x_val)[:, 1]
    rf_val_metrics = evaluate_binary_predictions(y_val, (rf_val_prob >= 0.40).astype(int), rf_val_prob)

    lr_val_prob = lr_pipe.predict_proba(x_val)[:, 1]
    lr_val_metrics = evaluate_binary_predictions(y_val, (lr_val_prob >= 0.40).astype(int), lr_val_prob)

    print("\n=================================================================")
    print("VALIDATION SET RESULTS (2021–2023)")
    print("=================================================================")
    print(f"Random Forest: Recall={rf_val_metrics['recall']} (CI: {rf_val_metrics['recall_ci_95']}), Prec={rf_val_metrics['precision']}, F2={rf_val_metrics['f2']}, PR-AUC={rf_val_metrics['pr_auc']}, Brier={rf_val_metrics['brier_score']}")
    print(f"Logistic Reg:  Recall={lr_val_metrics['recall']} (CI: {lr_val_metrics['recall_ci_95']}), Prec={lr_val_metrics['precision']}, F2={lr_val_metrics['f2']}, PR-AUC={lr_val_metrics['pr_auc']}, Brier={lr_val_metrics['brier_score']}")

    # 3. Rolling / Walk-Forward Multi-Season Validation
    print("\n=================================================================")
    print("WALK-FORWARD CHRONOLOGICAL EVALUATION (3 TEST WINDOWS)")
    print("=================================================================")
    walk_forward_folds = [
        {"name": "Fold 1 (Test: 2018–2019)", "train_seasons": ["2015-2016", "2016-2017", "2017-2018"], "test_season": "2018-2019"},
        {"name": "Fold 2 (Test: 2020–2021)", "train_seasons": ["2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020"], "test_season": "2020-2021"},
        {"name": "Fold 3 (Test: 2022–2023)", "train_seasons": ["2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020", "2020-2021", "2021-2022"], "test_season": "2022-2023"},
    ]

    wf_results = []
    for fold in walk_forward_folds:
        f_tr = df[df["season"].isin(fold["train_seasons"])].reset_index(drop=True)
        f_te = df[df["season"] == fold["test_season"]].reset_index(drop=True)

        pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("clf", CalibratedClassifierCV(
                estimator=RandomForestClassifier(n_estimators=150, max_depth=5, class_weight="balanced", random_state=42),
                method="sigmoid", cv=TimeSeriesSplit(n_splits=2)
            ))
        ])
        pipe.fit(f_tr[all_features], f_tr["avalanche_occurred"].values)
        f_prob = pipe.predict_proba(f_te[all_features])[:, 1]
        f_pred = (f_prob >= 0.40).astype(int)
        f_metrics = evaluate_binary_predictions(f_te["avalanche_occurred"].values, f_pred, f_prob)
        
        wf_results.append({
            "fold_name": fold["name"],
            "train_n": len(f_tr),
            "test_n": len(f_te),
            "test_events": int((f_te["avalanche_occurred"]==1).sum()),
            "recall": f_metrics["recall"],
            "recall_ci_95": f_metrics["recall_ci_95"],
            "precision": f_metrics["precision"],
            "f2": f_metrics["f2"],
            "pr_auc": f_metrics["pr_auc"],
            "brier": f_metrics["brier_score"],
            "tp": f_metrics["counts"]["tp"],
            "fn": f_metrics["counts"]["fn"],
            "fp": f_metrics["counts"]["fp"],
            "tn": f_metrics["counts"]["tn"],
        })
        print(f"{fold['name']}: Recall={f_metrics['recall']} ({f_metrics['counts']['tp']}/{f_metrics['counts']['actual_positives']}), Prec={f_metrics['precision']}, F2={f_metrics['f2']}, PR-AUC={f_metrics['pr_auc']}")

    # 4. Threshold Sensitivity on Validation Set
    thresholds = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.70]
    th_table = []
    for th in thresholds:
        th_pred = (rf_val_prob >= th).astype(int)
        m = evaluate_binary_predictions(y_val, th_pred, rf_val_prob)
        th_table.append({
            "threshold": th,
            "recall": m["recall"],
            "precision": m["precision"],
            "f1": m["f1"],
            "f2": m["f2"],
            "fn": m["counts"]["fn"],
            "fp": m["counts"]["fp"],
        })
    print("\n=================================================================")
    print("VALIDATION THRESHOLD SENSITIVITY TABLE")
    print("=================================================================")
    print(pd.DataFrame(th_table).to_markdown(index=False))

    # Freeze threshold = 0.40
    frozen_threshold = 0.40

    # 5. Ablation Study on Expanded Validation Partition
    ablation_experiments = {
        "A. Terrain Only": terrain_features,
        "B. Weather / Snow Only": weather_snow_features,
        "C. Full Spatiotemporal (Terrain + Weather + Snow)": all_features,
    }
    ablation_summary = {}
    for name, cols in ablation_experiments.items():
        abl_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("clf", CalibratedClassifierCV(
                estimator=RandomForestClassifier(n_estimators=150, max_depth=5, class_weight="balanced", random_state=42),
                method="sigmoid", cv=TimeSeriesSplit(n_splits=3)
            ))
        ])
        abl_pipe.fit(x_train[cols], y_train)
        abl_prob = abl_pipe.predict_proba(x_val[cols])[:, 1]
        abl_pred = (abl_prob >= frozen_threshold).astype(int)
        ablation_summary[name] = evaluate_binary_predictions(y_val, abl_pred, abl_prob)

    print("\n=================================================================")
    print("EXPANDED ABLATION STUDY RESULTS (VALIDATION 2021–2023)")
    print("=================================================================")
    for name, m in ablation_summary.items():
        print(f"{name:50s}: Recall={m['recall']:.4f} (CI: {m['recall_ci_95']}), Prec={m['precision']:.4f}, F2={m['f2']:.4f}, PR-AUC={m['pr_auc']:.4f}, Brier={m['brier_score']:.4f}")

    # 6. Feature Importance (Trained on Train Partition)
    base_rf = RandomForestClassifier(n_estimators=200, max_depth=5, class_weight="balanced", random_state=42)
    base_rf.fit(x_train, y_train)
    perm_res = permutation_importance(base_rf, x_val, y_val, n_repeats=15, random_state=42)
    
    feat_imp_df = pd.DataFrame({
        "feature": all_features,
        "gini_importance": [round(float(v), 4) for v in base_rf.feature_importances_],
        "permutation_importance_mean": [round(float(v), 4) for v in perm_res.importances_mean],
        "permutation_importance_std": [round(float(v), 4) for v in perm_res.importances_std],
    }).sort_values(by="gini_importance", ascending=False).reset_index(drop=True)

    print("\n=================================================================")
    print("FEATURE IMPORTANCE (EXPANDED DATASET)")
    print("=================================================================")
    print(feat_imp_df.to_markdown(index=False))

    # 7. Final Single Evaluation on HELD-OUT TEST Season (2023–2024)
    test_prob = rf_pipe.predict_proba(x_test)[:, 1]
    test_pred = (test_prob >= frozen_threshold).astype(int)
    final_test_metrics = evaluate_binary_predictions(y_test, test_pred, test_prob)

    print("\n=================================================================")
    print(f"FINAL FROZEN EVALUATION ON HELD-OUT TEST (2023–2024, N={len(test_df)}) @ Threshold={frozen_threshold}")
    print("=================================================================")
    print(json.dumps(final_test_metrics, indent=2))

    # 8. Natural vs Human vs Explosive Subgroups on HELD-OUT TEST Set
    test_event_mask = test_df["avalanche_occurred"] == 1
    subgroups = {
        "ALL HELD-OUT EVENTS": test_df[test_event_mask],
        "NATURAL RELEASES": test_df[test_event_mask & (test_df["trigger_category"] == "NATURAL")],
        "HUMAN-TRIGGERED": test_df[test_event_mask & (test_df["trigger_category"] == "HUMAN_TRIGGERED")],
        "EXPLOSIVE MITIGATION": test_df[test_event_mask & (test_df["trigger_category"] == "EXPLOSIVE")],
    }

    subgroup_metrics = {}
    for s_name, s_df in subgroups.items():
        if len(s_df) == 0:
            subgroup_metrics[s_name] = {"count": 0, "status": "NO_OBSERVATIONS"}
            continue
        s_prob = rf_pipe.predict_proba(s_df[all_features])[:, 1]
        s_pred = (s_prob >= frozen_threshold).astype(int)
        tp_cnt = int(s_pred.sum())
        n_cnt = len(s_df)
        rec = tp_cnt / n_cnt
        ci = wilson_score_interval(tp_cnt, n_cnt)
        
        subgroup_metrics[s_name] = {
            "sample_size": n_cnt,
            "detected_tp": tp_cnt,
            "missed_fn": n_cnt - tp_cnt,
            "recall": round(rec, 4),
            "recall_ci_95": ci,
            "status": "VALID_SUBGROUP" if n_cnt >= 8 else ("LIMITED_SAMPLE" if n_cnt >= 3 else "INSUFFICIENT_SAMPLE")
        }

    print("\n=================================================================")
    print("HELD-OUT SUBGROUP BREAKDOWN (NATURAL VS HUMAN-TRIGGERED)")
    print("=================================================================")
    print(json.dumps(subgroup_metrics, indent=2))

    # Save summary artifact
    summary_out = {
        "dataset_size": {
            "total_records": len(df),
            "train_records": len(train_df),
            "val_records": len(val_df),
            "test_records": len(test_df),
        },
        "walk_forward_evaluation": wf_results,
        "validation_metrics": rf_val_metrics,
        "ablation_study": ablation_summary,
        "threshold_sensitivity": th_table,
        "feature_importance": feat_imp_df.to_dict(orient="records"),
        "final_held_out_test_metrics": final_test_metrics,
        "subgroup_breakdown": subgroup_metrics,
        "frozen_threshold": frozen_threshold,
    }
    (out_dir / "expanded_research_summary.json").write_text(json.dumps(summary_out, indent=2), encoding="utf-8")
    print(f"\nExpanded evaluation summary successfully written to {out_dir / 'expanded_research_summary.json'}")


if __name__ == "__main__":
    main()
