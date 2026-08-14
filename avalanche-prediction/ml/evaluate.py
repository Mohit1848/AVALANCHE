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
    precision_score,
    recall_score,
    roc_auc_score,
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
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=labels).tolist(),
        "labels": [str(label) for label in labels],
        "roc_auc": None,
    }

    if positive_label is not None and len(labels) == 2 and hasattr(model, "predict_proba"):
        positive_index = labels.index(positive_label)
        probabilities = model.predict_proba(x_test)[:, positive_index]
        metrics["roc_auc"] = roc_auc_score(y_test == positive_label, probabilities)

    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a saved avalanche prediction model.")
    parser.add_argument("--data", required=True, help="Path to CSV dataset.")
    parser.add_argument("--model", required=True, help="Path to saved joblib model artifact.")
    parser.add_argument("--test-size", type=float, default=0.2, help="Test split size. Default: 0.2")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed. Default: 42")
    args = parser.parse_args()

    artifact = joblib.load(args.model)
    config = PreprocessingConfig(
        target_column=artifact["target_column"],
        feature_columns=artifact["feature_columns"],
        test_size=args.test_size,
        random_state=args.random_state,
    )
    _, x_test, _, y_test, inspection, cleaning_notes, _ = prepare_train_test_data(args.data, config)

    print("Dataset inspection:")
    print(json.dumps(inspection, indent=2))
    if cleaning_notes:
        print("\nCleaning notes:")
        for note in cleaning_notes:
            print(f"- {note}")

    metrics = calculate_metrics(artifact["model"], x_test, y_test, artifact.get("positive_label"))
    print("\nEvaluation metrics:")
    print(json.dumps(metrics, indent=2))
    print(
        "\nSafety note: recall for avalanche events deserves special attention because "
        "a false negative can mean failing to warn users about a dangerous event."
    )


if __name__ == "__main__":
    main()
