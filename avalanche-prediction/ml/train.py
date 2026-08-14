"""Train baseline avalanche-risk classification models."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline

from preprocessing import PreprocessingConfig, create_preprocessor, prepare_train_test_data


DEFAULT_MODEL_PATH = Path("models/avalanche_baseline.joblib")


def parse_feature_columns(raw_features: str | None) -> list[str] | None:
    """Convert a comma-separated feature list into Python values."""

    if not raw_features:
        return None
    return [feature.strip() for feature in raw_features.split(",") if feature.strip()]


def parse_risk_thresholds(raw_thresholds: str | None) -> dict[str, float]:
    """Parse configurable probability thresholds for LOW/MEDIUM/HIGH risk."""

    if not raw_thresholds:
        return {"medium": 0.4, "high": 0.7}

    thresholds = json.loads(raw_thresholds)
    medium = float(thresholds["medium"])
    high = float(thresholds["high"])
    if not 0 <= medium < high <= 1:
        raise ValueError("Risk thresholds must satisfy 0 <= medium < high <= 1.")
    return {"medium": medium, "high": high}


def build_models(random_state: int) -> dict[str, Pipeline]:
    """Create simple baseline models. Deep learning is intentionally avoided."""

    return {
        "random_forest": Pipeline(
            [
                ("preprocessor", create_preprocessor(scale_numeric=False)),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=200,
                        class_weight="balanced",
                        random_state=random_state,
                    ),
                ),
            ]
        ),
        "logistic_regression": Pipeline(
            [
                ("preprocessor", create_preprocessor(scale_numeric=True)),
                (
                    "classifier",
                    LogisticRegression(
                        max_iter=1000,
                        class_weight="balanced",
                        random_state=random_state,
                    ),
                ),
            ]
        ),
    }


def resolve_positive_label(classes: list[Any], requested_label: str | None) -> Any:
    """Resolve the avalanche-event class for binary recall/probability reporting."""

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


def evaluate_model(model: Pipeline, x_test, y_test, positive_label: Any) -> dict[str, float | None]:
    """Calculate metrics, emphasizing recall for the avalanche-event class."""

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
        "roc_auc": None,
    }

    if positive_label is not None and hasattr(model, "predict_proba"):
        classes = list(model.classes_)
        positive_index = classes.index(positive_label)
        probabilities = model.predict_proba(x_test)[:, positive_index]
        metrics["roc_auc"] = roc_auc_score(y_test == positive_label, probabilities)

    return metrics


def choose_best_model(results: dict[str, dict[str, float | None]]) -> str:
    """Choose the model with highest recall, then F1, for safety-oriented baseline."""

    return max(
        results,
        key=lambda name: (
            results[name]["recall"] or 0,
            results[name]["f1"] or 0,
            results[name]["accuracy"] or 0,
        ),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Train avalanche prediction baseline models.")
    parser.add_argument("--data", required=True, help="Path to CSV dataset.")
    parser.add_argument("--target", required=True, help="Target column for avalanche occurrence/risk.")
    parser.add_argument(
        "--features",
        help="Optional comma-separated feature columns. Defaults to all columns except target.",
    )
    parser.add_argument(
        "--positive-label",
        help="Class value that represents avalanche occurrence for binary classification.",
    )
    parser.add_argument("--test-size", type=float, default=0.2, help="Test split size. Default: 0.2")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed. Default: 42")
    parser.add_argument("--model-out", default=str(DEFAULT_MODEL_PATH), help="Output model path.")
    parser.add_argument(
        "--risk-thresholds",
        help='JSON thresholds, for example: {"medium": 0.4, "high": 0.7}',
    )
    args = parser.parse_args()

    config = PreprocessingConfig(
        target_column=args.target,
        feature_columns=parse_feature_columns(args.features),
        test_size=args.test_size,
        random_state=args.random_state,
    )
    x_train, x_test, y_train, y_test, inspection, cleaning_notes, feature_columns = prepare_train_test_data(
        args.data, config
    )

    classes = sorted(list(y_train.dropna().unique()), key=lambda value: str(value))
    positive_label = resolve_positive_label(classes, args.positive_label)
    models = build_models(args.random_state)
    results: dict[str, dict[str, float | None]] = {}

    print("Dataset inspection:")
    print(json.dumps(inspection, indent=2))
    if cleaning_notes:
        print("\nCleaning notes:")
        for note in cleaning_notes:
            print(f"- {note}")

    print("\nTraining baseline models...")
    for model_name, model in models.items():
        model.fit(x_train, y_train)
        results[model_name] = evaluate_model(model, x_test, y_test, positive_label)
        print(f"\n{model_name}:")
        for metric_name, metric_value in results[model_name].items():
            if metric_value is None:
                print(f"  {metric_name}: not available")
            else:
                print(f"  {metric_name}: {metric_value:.4f}")

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
        },
        output_path,
    )

    print(f"\nBest model: {best_model_name}")
    print(f"Saved model artifact to: {output_path}")
    print(
        "Recall is prioritized because missed avalanche events are more dangerous "
        "than many other error types in an early-warning prototype."
    )


if __name__ == "__main__":
    main()
