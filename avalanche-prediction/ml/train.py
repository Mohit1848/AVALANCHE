"""Train baseline avalanche-risk classification models."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
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
from sklearn.model_selection import GroupKFold, TimeSeriesSplit
from sklearn.pipeline import Pipeline

from preprocessing import PreprocessingConfig, create_preprocessor, prepare_train_test_data

DEFAULT_MODEL_PATH = Path("models/avalanche_baseline.joblib")

# Optional dependencies
try:
    import xgboost as xgb

    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

try:
    import lightgbm as lgb

    LGBM_AVAILABLE = True
except ImportError:
    LGBM_AVAILABLE = False

try:
    import catboost as cb

    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False


def parse_feature_columns(raw_features: str | None) -> list[str] | None:
    if not raw_features:
        return None
    return [feature.strip() for feature in raw_features.split(",") if feature.strip()]


def parse_risk_thresholds(raw_thresholds: str | None) -> dict[str, float]:
    if not raw_thresholds:
        return {"medium": 0.4, "high": 0.7}

    thresholds = json.loads(raw_thresholds)
    medium = float(thresholds["medium"])
    high = float(thresholds["high"])
    if not 0 <= medium < high <= 1:
        raise ValueError("Risk thresholds must satisfy 0 <= medium < high <= 1.")
    return {"medium": medium, "high": high}


def get_calibration_cv(strategy: str) -> Any:
    """Return appropriate cross-validator for calibration to prevent temporal/group leakage."""
    if strategy == "temporal":
        return TimeSeriesSplit(n_splits=3)
    return 3


def build_models(random_state: int, calibration_cv: Any = 3) -> dict[str, Pipeline]:
    models = {
        "random_forest": Pipeline(
            [
                ("preprocessor", create_preprocessor(scale_numeric=False)),
                (
                    "classifier",
                    CalibratedClassifierCV(
                        estimator=RandomForestClassifier(
                            n_estimators=200,
                            class_weight="balanced",
                            random_state=random_state,
                        ),
                        method="sigmoid",
                        cv=calibration_cv,
                    ),
                ),
            ]
        ),
        "logistic_regression": Pipeline(
            [
                ("preprocessor", create_preprocessor(scale_numeric=True)),
                (
                    "classifier",
                    CalibratedClassifierCV(
                        estimator=LogisticRegression(
                            max_iter=1000,
                            class_weight="balanced",
                            random_state=random_state,
                        ),
                        method="sigmoid",
                        cv=calibration_cv,
                    ),
                ),
            ]
        ),
    }

    if XGB_AVAILABLE:
        models["xgboost"] = Pipeline(
            [
                ("preprocessor", create_preprocessor(scale_numeric=False)),
                (
                    "classifier",
                    CalibratedClassifierCV(
                        estimator=xgb.XGBClassifier(
                            n_estimators=200,
                            scale_pos_weight=2.0,
                            random_state=random_state,
                            eval_metric="logloss",
                        ),
                        method="sigmoid",
                        cv=calibration_cv,
                    ),
                ),
            ]
        )
    else:
        print("Model unavailable: xgboost (dependency not installed)")

    if LGBM_AVAILABLE:
        models["lightgbm"] = Pipeline(
            [
                ("preprocessor", create_preprocessor(scale_numeric=False)),
                (
                    "classifier",
                    CalibratedClassifierCV(
                        estimator=lgb.LGBMClassifier(
                            n_estimators=200,
                            class_weight="balanced",
                            random_state=random_state,
                        ),
                        method="sigmoid",
                        cv=calibration_cv,
                    ),
                ),
            ]
        )
    else:
        print("Model unavailable: lightgbm (dependency not installed)")

    if CATBOOST_AVAILABLE:
        models["catboost"] = Pipeline(
            [
                ("preprocessor", create_preprocessor(scale_numeric=False)),
                (
                    "classifier",
                    CalibratedClassifierCV(
                        estimator=cb.CatBoostClassifier(
                            iterations=200,
                            auto_class_weights="Balanced",
                            random_state=random_state,
                            verbose=0,
                        ),
                        method="sigmoid",
                        cv=calibration_cv,
                    ),
                ),
            ]
        )
    else:
        print("Model unavailable: catboost (dependency not installed)")

    return models


def resolve_positive_label(classes: list[Any], requested_label: str | None) -> Any:
    if len(classes) != 2:
        return None

    if requested_label is not None:
        for class_value in classes:
            if str(class_value) == requested_label:
                return class_value
        raise ValueError(f"Positive label '{requested_label}' was not found in classes {classes}.")

    for candidate in [1, "1", True, "true", "yes", "avalanche", "event", "high"]:
        for class_value in classes:
            if str(class_value).lower() == str(candidate).lower():
                return class_value

    return classes[1]


def evaluate_model(
    model: Pipeline, x_test: pd.DataFrame, y_test: pd.Series, positive_label: Any
) -> dict[str, float | None]:
    predictions = model.predict(x_test)
    average = "binary" if positive_label is not None else "weighted"
    metric_kwargs = {"zero_division": 0}
    if average == "binary":
        metric_kwargs["pos_label"] = positive_label

    metrics = {
        "accuracy": accuracy_score(y_test, predictions),
        "precision": precision_score(y_test, predictions, average=average, **metric_kwargs),
        "recall": recall_score(y_test, predictions, average=average, **metric_kwargs),
        "f1": f1_score(y_test, predictions, average=average, **metric_kwargs),
        "f2": fbeta_score(y_test, predictions, beta=2, average=average, **metric_kwargs),
        "roc_auc": None,
        "pr_auc": None,
        "brier_score": None,
        "fnr": None,
        "fpr": None,
        "specificity": None,
    }

    if positive_label is not None:
        classes = list(model.classes_)
        positive_index = classes.index(positive_label)

        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(x_test)[:, positive_index]
            y_test_binary = (y_test == positive_label).astype(int)
            metrics["roc_auc"] = roc_auc_score(y_test_binary, probabilities)
            metrics["pr_auc"] = average_precision_score(y_test_binary, probabilities)
            metrics["brier_score"] = brier_score_loss(y_test_binary, probabilities)

        tn, fp, fn, tp = confusion_matrix(
            y_test, predictions, labels=[classes[1 - positive_index], positive_label]
        ).ravel()
        metrics["fnr"] = fn / (fn + tp) if (fn + tp) > 0 else 0.0
        metrics["fpr"] = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        metrics["specificity"] = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    return metrics


def choose_best_model(results: dict[str, dict[str, float | None]]) -> str:
    # Rank by safety priority: Recall first, then F2, then PR_AUC, then F1
    return max(
        results,
        key=lambda name: (
            results[name]["recall"] or 0,
            results[name]["f2"] or 0,
            results[name]["pr_auc"] or 0,
            results[name]["f1"] or 0,
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Train avalanche prediction baseline models.")
    parser.add_argument("--data", required=True, help="Path to CSV dataset.")
    parser.add_argument(
        "--target", required=True, help="Target column for avalanche occurrence/risk."
    )
    parser.add_argument("--features", help="Optional comma-separated feature columns.")
    parser.add_argument(
        "--timestamp-column", help="Optional column containing observation timestamp."
    )
    parser.add_argument(
        "--group-column", help="Optional column containing group identifier (e.g., location)."
    )
    parser.add_argument(
        "--validation-strategy",
        choices=["auto", "temporal", "group", "random"],
        default="auto",
        help="Validation splitting strategy.",
    )
    parser.add_argument(
        "--positive-label", help="Class value that represents avalanche occurrence."
    )
    parser.add_argument(
        "--test-size", type=float, default=0.2, help="Test split size. Default: 0.2"
    )
    parser.add_argument("--random-state", type=int, default=42, help="Random seed. Default: 42")
    parser.add_argument("--model-out", default=str(DEFAULT_MODEL_PATH), help="Output model path.")
    parser.add_argument(
        "--risk-thresholds", help='JSON thresholds, for example: {"medium": 0.4, "high": 0.7}'
    )
    args = parser.parse_args()

    config = PreprocessingConfig(
        target_column=args.target,
        feature_columns=parse_feature_columns(args.features),
        timestamp_column=args.timestamp_column,
        group_column=args.group_column,
        validation_strategy=args.validation_strategy,
        test_size=args.test_size,
        random_state=args.random_state,
    )

    (
        x_train,
        x_test,
        y_train,
        y_test,
        inspection,
        cleaning_notes,
        feature_columns,
        strategy_used,
    ) = prepare_train_test_data(args.data, config)

    classes = sorted(list(y_train.dropna().unique()), key=lambda value: str(value))
    positive_label = resolve_positive_label(classes, args.positive_label)
    calib_cv = get_calibration_cv(strategy_used)
    models = build_models(args.random_state, calibration_cv=calib_cv)
    results: dict[str, dict[str, float | None]] = {}

    print("Dataset inspection:")
    print(json.dumps(inspection, indent=2))
    print(f"\nValidation Strategy Used: {strategy_used.upper()}")
    print(f"Calibration Strategy: {'TimeSeriesSplit(n_splits=3)' if strategy_used == 'temporal' else '3-Fold CV'}")

    if cleaning_notes:
        print("\nCleaning notes:")
        for note in cleaning_notes:
            print(f"- {note}")

    print("\nTraining models with Probability Calibration...")
    for model_name, model in models.items():
        try:
            model.fit(x_train, y_train)
            results[model_name] = evaluate_model(model, x_test, y_test, positive_label)
            print(f"\n{model_name}:")
            for metric_name, metric_value in results[model_name].items():
                if metric_value is None:
                    print(f"  {metric_name}: not available")
                else:
                    print(f"  {metric_name}: {metric_value:.4f}")
        except Exception as e:
            print(f"\n{model_name} failed to train: {e}")

    best_model_name = choose_best_model(results)
    output_path = Path(args.model_out)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(
        {
            "model": models[best_model_name],
            "model_name": best_model_name,
            "target_column": args.target,
            "feature_columns": feature_columns,
            "positive_label": positive_label,
            "classes": classes,
            "risk_thresholds": parse_risk_thresholds(args.risk_thresholds),
            "metrics": results[best_model_name],
            "validation_strategy": strategy_used,
            "calibration_metadata": {
                "method": "sigmoid",
                "calibrated": True,
                "cv_strategy": "TimeSeriesSplit" if strategy_used == "temporal" else "StandardCV",
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "feature_engineering_version": "v2_spatiotemporal",
        },
        output_path,
    )

    print(f"\nBest model: {best_model_name}")
    print(f"Saved model artifact to: {output_path}")


if __name__ == "__main__":
    main()
