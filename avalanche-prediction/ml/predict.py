"""Make avalanche-risk predictions from environmental input."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


def load_input(input_json: str) -> dict[str, Any]:
    """Load prediction input from an inline JSON object or a JSON file path."""

    possible_path = Path(input_json)
    if possible_path.exists():
        return json.loads(possible_path.read_text(encoding="utf-8-sig"))
    return json.loads(input_json)


def risk_level(probability: float, thresholds: dict[str, float]) -> str:
    """Convert probability into configurable prototype risk levels."""

    if probability >= thresholds["high"]:
        return "HIGH"
    if probability >= thresholds["medium"]:
        return "MEDIUM"
    return "LOW"


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict avalanche probability and risk level.")
    parser.add_argument("--model", required=True, help="Path to saved joblib model artifact.")
    parser.add_argument(
        "--input",
        required=True,
        help='Inline JSON or path to JSON file. Example: {"temperature": -5, "snow_depth": 120}',
    )
    parser.add_argument(
        "--risk-thresholds",
        help='Optional JSON thresholds, for example: {"medium": 0.4, "high": 0.7}',
    )
    args = parser.parse_args()

    artifact = joblib.load(args.model)
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    positive_label = artifact.get("positive_label")
    thresholds = artifact.get("risk_thresholds", {"medium": 0.4, "high": 0.7})
    if args.risk_thresholds:
        thresholds = json.loads(args.risk_thresholds)

    input_data = load_input(args.input)
    missing_features = [feature for feature in feature_columns if feature not in input_data]
    if missing_features:
        raise ValueError(
            f"Missing required features: {missing_features}. "
            f"Expected features: {feature_columns}"
        )

    frame = pd.DataFrame([{feature: input_data[feature] for feature in feature_columns}])

    if not hasattr(model, "predict_proba") or positive_label is None:
        prediction = model.predict(frame)[0]
        result = {
            "predicted_class": str(prediction),
            "avalanche_probability": None,
            "risk_score": None,
            "risk_level": "UNAVAILABLE",
            "note": "Probability is unavailable for this model/problem configuration.",
        }
    else:
        classes = list(model.classes_)
        positive_index = classes.index(positive_label)
        probability = float(model.predict_proba(frame)[0, positive_index])
        result = {
            "avalanche_probability": probability,
            "risk_score": round(probability * 100, 2),
            "risk_level": risk_level(probability, thresholds),
            "thresholds": thresholds,
            "note": "Prototype thresholds are configurable and not scientifically validated.",
        }

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
