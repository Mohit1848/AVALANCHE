"""Safety Risk Engine Integration Service."""

from __future__ import annotations

import dataclasses
import sys
from pathlib import Path
from typing import Any, Dict

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR / "ml") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "ml"))

from risk_engine import evaluate_risk, RiskResult


def evaluate_safety_policy(
    raw_probability: float | None,
    calibrated_probability: float | None,
    input_data: Dict[str, Any],
    feature_columns: list[str],
    thresholds: Dict[str, float] | None = None
) -> RiskResult:
    """Evaluate safety-critical risk engine rules and fail-safe data validation."""
    if thresholds is None:
        thresholds = {"medium": 0.40, "high": 0.70}

    return evaluate_risk(
        raw_probability=raw_probability,
        calibrated_probability=calibrated_probability,
        input_data=input_data,
        feature_columns=feature_columns,
        thresholds=thresholds
    )
