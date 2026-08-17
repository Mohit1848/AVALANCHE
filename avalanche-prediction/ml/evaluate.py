"""Evaluate a saved avalanche prediction model on a CSV dataset."""

from __future__ import annotations

import argparse
import json
from typing import Any

import joblib
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    fbeta_score,
    precision_score,
    recall_score,
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
)

from preprocessing import PreprocessingConfig, prepare_train_test_data


def calculate_metrics(model, x_test, y_test, positive_label: Any) -> dict[str, Any]:
    """Return standard classification metrics for the saved model."""
    predictions = model.predict(x_test)
    labels = list(model.classes_)
    average = "binary" if positive_label is not None and len(labels) == 2 else "weighted"
    metric_kwargs = {"zero_division": 0}
    if average == "binary":
        metric_kwargs["pos_label"] = positive_label

    metrics: dict[str, Any] = {
        "accuracy": accuracy_score(y_test, predictions),
        "precision": precision_score(y_test, predictions, average=average, **metric_kwargs),
        "recall": recall_score(y_test, predictions, average=average, **metric_kwargs),
        "f1": f1_score(y_test, predictions, average=average, **metric_kwargs),
        "f2": fbeta_score(y_test, predictions, beta=2, average=average, **metric_kwargs),
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=labels).tolist(),
        "labels": [str(label) for label in labels],
        "roc_auc": None,
        "pr_auc": None,
        "brier_score": None,
        "fnr": None,
        "fpr": None,
        "specificity": None,
    }

    if positive_label is not None and len(labels) == 2:
        positive_index = labels.index(positive_label)
        
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(x_test)[:, positive_index]
            y_test_binary = (y_test == positive_label).astype(int)
            metrics["roc_auc"] = roc_auc_score(y_test_binary, probabilities)
            metrics["pr_auc"] = average_precision_score(y_test_binary, probabilities)
            metrics["brier_score"] = brier_score_loss(y_test_binary, probabilities)

        tn, fp, fn, tp = confusion_matrix(y_test, predictions, labels=[labels[1-positive_index], positive_label]).ravel()
        metrics["fnr"] = fn / (fn + tp) if (fn + tp) > 0 else 0.0
        metrics["fpr"] = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        metrics["specificity"] = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a saved avalanche prediction model.")
    parser.add_argument("--data", required=True, help="Path to CSV dataset.")
    parser.add_argument("--model", required=True, help="Path to saved joblib model artifact.")
    parser.add_argument("--timestamp-column", help="Optional column containing observation timestamp.")
    parser.add_argument("--group-column", help="Optional column containing group identifier (e.g., location).")
    parser.add_argument("--validation-strategy", choices=["auto", "temporal", "group", "random"], default="auto", help="Validation splitting strategy.")
    parser.add_argument("--test-size", type=float, default=0.2, help="Test split size. Default: 0.2")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed. Default: 42")
    args = parser.parse_args()

    artifact = joblib.load(args.model)
    config = PreprocessingConfig(
        target_column=artifact["target_column"],
        feature_columns=artifact["feature_columns"],
        timestamp_column=args.timestamp_column,
        group_column=args.group_column,
        validation_strategy=args.validation_strategy,
        test_size=args.test_size,
        random_state=args.random_state,
    )
    
    _, x_test, _, y_test, inspection, cleaning_notes, _, strategy_used = prepare_train_test_data(args.data, config)

    print("Dataset inspection:")
    print(json.dumps(inspection, indent=2))
    print(f"\nValidation Strategy Used: {strategy_used.upper()}")
    
    if cleaning_notes:
        print("\nCleaning notes:")
        for note in cleaning_notes:
            print(f"- {note}")

    metrics = calculate_metrics(artifact["model"], x_test, y_test, artifact.get("positive_label"))
    print("\nEvaluation metrics:")
    print(json.dumps(metrics, indent=2))
    print(
        "\nSafety note: recall and F2 for avalanche events deserve special attention because "
        "a false negative can mean failing to warn users about a dangerous event."
    )


if __name__ == "__main__":
    main()
