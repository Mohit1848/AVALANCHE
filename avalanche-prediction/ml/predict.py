"""Make avalanche-risk predictions from environmental input."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
import dataclasses

import joblib
import pandas as pd

from risk_engine import evaluate_risk


def load_input(input_json: str) -> dict[str, Any]:
    """Load prediction input from an inline JSON object or a JSON file path."""
    possible_path = Path(input_json)
    if possible_path.exists():
        return json.loads(possible_path.read_text(encoding="utf-8-sig"))
    return json.loads(input_json)


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
    
    calibration_info = artifact.get("calibration_metadata", {})
    is_calibrated = calibration_info.get("calibrated", False)

    input_data = load_input(args.input)
    
    # Check if there are any missing required features or if we can proceed
    frame = pd.DataFrame([{feature: input_data.get(feature, None) for feature in feature_columns}])

    raw_probability = None
    calibrated_probability = None

    if not hasattr(model, "predict_proba") or positive_label is None:
        pass # probability remains None
    else:
        # We assume imputation handles missing data during predict
        classes = list(model.classes_)
        positive_index = classes.index(positive_label)
        prob = float(model.predict_proba(frame)[0, positive_index])
        
        if is_calibrated:
            calibrated_probability = prob
            raw_probability = None # We don't save raw easily from CalibratedClassifierCV
        else:
            raw_probability = prob
            calibrated_probability = None

    risk_result = evaluate_risk(
        raw_probability=raw_probability,
        calibrated_probability=calibrated_probability,
        input_data=input_data,
        feature_columns=feature_columns,
        thresholds=thresholds
    )

    result = dataclasses.asdict(risk_result)
    result["model_version"] = artifact.get("model_name", "unknown")
    result["thresholds"] = thresholds
    result["note"] = "Prototype thresholds are configurable and not scientifically validated."

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
