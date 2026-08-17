"""Detailed Instance Error Analysis (False Negatives & False Positives)."""

from __future__ import annotations

import pandas as pd
from typing import Any, Dict, List
from ml.risk_engine import evaluate_risk


def perform_error_analysis(
    df: pd.DataFrame,
    y_true_col: str,
    y_prob_col: str,
    threshold: float = 0.40,
) -> List[Dict[str, Any]]:
    """Produce detailed record-by-record breakdown of all classification errors."""
    df = df.copy()
    df["pred_binary"] = (df[y_prob_col] >= threshold).astype(int)

    error_records: List[Dict[str, Any]] = []

    for _, row in df.iterrows():
        actual = int(row[y_true_col])
        pred = int(row["pred_binary"])
        prob = float(row[y_prob_col])

        if actual == pred:
            continue  # Correct prediction (TP or TN)

        error_type = "FALSE_NEGATIVE" if actual == 1 and pred == 0 else "FALSE_POSITIVE"

        # Evaluate through Risk Engine
        feature_dict = row.to_dict()
        risk_eval = evaluate_risk(
            raw_probability=prob,
            calibrated_probability=prob,
            input_data=feature_dict,
            feature_columns=list(feature_dict.keys()),
            thresholds={"medium": threshold, "high": 0.70},
        )

        error_records.append({
            "error_type": error_type,
            "event_id": str(row.get("event_id", row.get("id", "N/A"))),
            "timestamp": str(row.get("timestamp", "N/A")),
            "location": str(row.get("location_id", row.get("location", "N/A"))),
            "zone_id": str(row.get("zone_id", "N/A")),
            "slope": float(row.get("slope", 0.0)),
            "elevation": float(row.get("elevation", 0.0)),
            "snowfall_24h": float(row.get("snowfall_24h", 0.0)),
            "snowfall_72h": float(row.get("snowfall_72h", 0.0)),
            "snow_water_equivalent": float(row.get("snow_water_equivalent", 0.0)),
            "temperature_delta_24h": float(row.get("temperature_delta_24h", 0.0)),
            "model_probability": round(prob, 4),
            "model_risk_level": risk_eval.model_risk_level,
            "final_policy_risk_level": risk_eval.final_risk_level,
            "risk_escalated": risk_eval.risk_escalated,
            "risk_escalation_reasons": "; ".join(risk_eval.risk_escalation_reasons),
            "data_quality": str(row.get("data_quality", "GOOD")),
            "spatial_quality": str(row.get("spatial_quality", "GOOD")),
            "trigger_category": str(row.get("trigger_category", "UNKNOWN")),
            "error_description": (
                "Missed observed event in the evaluation dataset (Model probability fell below operating threshold)."
                if error_type == "FALSE_NEGATIVE"
                else "False alarm control record in evaluation dataset (Model probability exceeded operating threshold)."
            ),
        })

    return error_records
