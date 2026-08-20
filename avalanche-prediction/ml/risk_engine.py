"""Safety-Critical Avalanche Risk Assessment Engine.

Decouples raw statistical ML output probabilities from deterministic safety policies,
data quality bounds, and operational fail-safes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RiskResult:
    """Standard output schema for risk assessment evaluation."""
    model_risk_score: float | None
    final_risk_score: float | None
    model_risk_level: str
    final_risk_level: str
    risk_level: str
    risk_escalated: bool
    risk_escalation_reasons: list[str]
    data_quality: str
    warnings: list[str] = field(default_factory=list)
    rule_evaluations: list[dict[str, Any]] = field(default_factory=list)


def evaluate_deterministic_rules(input_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Compute transparent evaluation status for all deterministic engineering safety rules."""
    slope = float(input_data.get("slope", 0.0) or 0.0)
    temp = float(input_data.get("temperature", 0.0) or 0.0)
    temp_delta_24h = float(input_data.get("temperature_delta_24h", 0.0) or 0.0)
    snowfall_24h = float(input_data.get("snowfall_24h", 0.0) or input_data.get("snowfall", 0.0) or 0.0)
    snowfall_72h = float(input_data.get("snowfall_72h", 0.0) or 0.0)

    r1_triggered = (snowfall_24h >= 30.0 or snowfall_72h >= 45.0) and slope >= 34.0
    r2_triggered = (temp >= 3.0 or temp_delta_24h >= 6.0) and slope >= 35.0
    r3_triggered = (snowfall_24h >= 15.0 or snowfall_72h >= 25.0) and slope >= 30.0

    return [
        {
            "rule_id": "HEAVY_SNOWFALL_STEEP_SLOPE",
            "rule_name": "Heavy Snowfall on Steep Slope",
            "description": "Heavy storm snowfall (24h >= 30mm or 72h >= 45mm) on steep starting zone (slope >= 34 deg)",
            "condition": "(snowfall_24h >= 30.0 or snowfall_72h >= 45.0) and slope >= 34.0",
            "actual_values": {
                "snowfall_24h": round(snowfall_24h, 1),
                "snowfall_72h": round(snowfall_72h, 1),
                "slope": round(slope, 1),
            },
            "thresholds": {
                "snowfall_24h": ">= 30.0 mm",
                "snowfall_72h": ">= 45.0 mm",
                "slope": ">= 34.0 deg",
            },
            "status": "TRIGGERED" if r1_triggered else "NOT MET",
            "target_minimum_level": "HIGH",
        },
        {
            "rule_id": "RAPID_THERMAL_WARMING",
            "rule_name": "Rapid Thermal Warming",
            "description": "Rapid thermal warming (T >= 3.0 C or 24h delta >= 6.0 C) on steep slope (slope >= 35 deg)",
            "condition": "(temp >= 3.0 or temp_delta_24h >= 6.0) and slope >= 35.0",
            "actual_values": {
                "temperature": round(temp, 1),
                "temperature_delta_24h": round(temp_delta_24h, 1),
                "slope": round(slope, 1),
            },
            "thresholds": {
                "temperature": ">= 3.0 C",
                "temperature_delta_24h": ">= 6.0 C",
                "slope": ">= 35.0 deg",
            },
            "status": "TRIGGERED" if r2_triggered else "NOT MET",
            "target_minimum_level": "HIGH",
        },
        {
            "rule_id": "MODERATE_STORM_LOADING",
            "rule_name": "Moderate Storm Loading",
            "description": "Moderate storm loading (24h >= 15mm or 72h >= 25mm) on avalanche terrain (slope >= 30 deg)",
            "condition": "(snowfall_24h >= 15.0 or snowfall_72h >= 25.0) and slope >= 30.0",
            "actual_values": {
                "snowfall_24h": round(snowfall_24h, 1),
                "snowfall_72h": round(snowfall_72h, 1),
                "slope": round(slope, 1),
            },
            "thresholds": {
                "snowfall_24h": ">= 15.0 mm",
                "snowfall_72h": ">= 25.0 mm",
                "slope": ">= 30.0 deg",
            },
            "status": "TRIGGERED" if r3_triggered else "NOT MET",
            "target_minimum_level": "MEDIUM",
        },
    ]


# Critical features required for any quantitative risk estimate
CRITICAL_FEATURES = [
    "temperature",
    "slope",
]

# Standard optional spatiotemporal features
OPTIONAL_FEATURES = [
    "snowfall_6h",
    "snowfall_24h",
    "snowfall_72h",
    "snow_depth",
    "snow_water_equivalent",
    "temperature_delta_24h",
    "temperature_delta_72h",
    "wind_speed_mean_24h",
    "wind_speed_max_24h",
    "humidity",
    "pressure",
    "precipitation",
    "aspect_sin",
    "aspect_cos",
    "elevation",
]


def assess_data_quality(
    input_data: dict[str, Any],
    feature_columns: list[str]
) -> tuple[str, list[str]]:
    """Assess whether input telemetry satisfies minimal and optional completeness.

    Returns:
        (data_quality_label, list_of_warnings)
    """
    warnings: list[str] = []

    # 1. Check critical features
    missing_critical = [
        f for f in CRITICAL_FEATURES
        if f in feature_columns and (input_data.get(f) is None or input_data.get(f) == "")
    ]
    if missing_critical:
        warnings.append(
            f"Missing critical features: {missing_critical}. Cannot produce reliable risk estimate."
        )
        return "INSUFFICIENT", warnings

    # 2. Check optional features
    missing_optional = [
        f for f in OPTIONAL_FEATURES
        if f in feature_columns and (input_data.get(f) is None or input_data.get(f) == "")
    ]
    if missing_optional:
        warnings.append(
            f"Missing optional features ({len(missing_optional)}/{len(OPTIONAL_FEATURES)}): {missing_optional}."
        )
        return "DEGRADED", warnings

    return "GOOD", warnings


def calculate_base_risk_level(
    prob: float,
    thresholds: dict[str, float]
) -> str:
    """Map calibrated probability to qualitative base risk level."""
    med_thresh = thresholds.get("medium", 0.40)
    high_thresh = thresholds.get("high", 0.70)

    if prob < med_thresh:
        return "LOW"
    elif prob < high_thresh:
        return "MEDIUM"
    else:
        return "HIGH"


def apply_safety_escalations(
    calibrated_prob: float,
    input_data: dict[str, Any],
    thresholds: dict[str, float]
) -> tuple[float, str, str, bool, list[str], list[str]]:
    """Apply deterministic safety rules to adjust or escalate model scores.

    Returns:
        (final_risk_score, model_risk_level, final_risk_level, risk_escalated, escalation_reasons, warnings)
    """
    model_score = calibrated_prob * 100.0
    final_score = model_score
    model_level = calculate_base_risk_level(calibrated_prob, thresholds)
    final_level = model_level

    escalation_reasons: list[str] = []
    warnings: list[str] = []

    slope = float(input_data.get("slope", 0.0) or 0.0)
    temp = float(input_data.get("temperature", 0.0) or 0.0)
    temp_delta_24h = float(input_data.get("temperature_delta_24h", 0.0) or 0.0)
    snowfall_24h = float(input_data.get("snowfall_24h", 0.0) or input_data.get("snowfall", 0.0) or 0.0)
    snowfall_72h = float(input_data.get("snowfall_72h", 0.0) or 0.0)

    # Engineering Rule 1: Heavy storm snowfall (>30mm SWE / cm) on steep avalanche slope (>34°) -> Minimum HIGH
    if (snowfall_24h >= 30.0 or snowfall_72h >= 45.0) and slope >= 34.0:
        final_level = "HIGH"
        if final_score < thresholds.get("high", 0.70) * 100.0:
            final_score = max(final_score, thresholds.get("high", 0.70) * 100.0)
        reason = f"Deterministic Engineering Rule: Heavy snowfall (24h={snowfall_24h}mm, 72h={snowfall_72h}mm) on steep starting zone ({slope}°)."
        escalation_reasons.append(reason)
        warnings.append(reason)

    # Engineering Rule 2: Rapid spring warming (T > 3°C or delta > 6°C) on steep slope -> Minimum HIGH
    elif (temp >= 3.0 or temp_delta_24h >= 6.0) and slope >= 35.0:
        final_level = "HIGH"
        if final_score < thresholds.get("high", 0.70) * 100.0:
            final_score = max(final_score, thresholds.get("high", 0.70) * 100.0)
        reason = f"Deterministic Engineering Rule: Rapid thermal warming (T={temp}°C, 24h delta={temp_delta_24h}°C) on steep starting zone ({slope}°)."
        escalation_reasons.append(reason)
        warnings.append(reason)

    # Engineering Rule 3: Moderate snowfall (>15mm SWE) on avalanche terrain -> Minimum MEDIUM
    elif (snowfall_24h >= 15.0 or snowfall_72h >= 25.0) and slope >= 30.0:
        if final_score < thresholds.get("medium", 0.40) * 100.0:
            final_score = max(final_score, thresholds.get("medium", 0.40) * 100.0)
        if final_level == "LOW":
            final_level = "MEDIUM"
        reason = f"Deterministic Engineering Rule: Moderate storm loading ({snowfall_24h}mm/24h) on potential release slope ({slope}°)."
        escalation_reasons.append(reason)
        warnings.append(reason)

    risk_escalated = final_level != model_level

    return final_score, model_level, final_level, risk_escalated, escalation_reasons, warnings


def evaluate_risk(
    raw_probability: float | None,
    calibrated_probability: float | None,
    input_data: dict[str, Any],
    feature_columns: list[str],
    thresholds: dict[str, float]
) -> RiskResult:
    """Main risk engine entry point ensuring fail-safe execution."""
    rules_eval = evaluate_deterministic_rules(input_data)

    # 1. Assess Data Quality
    quality, warnings = assess_data_quality(input_data, feature_columns)

    if quality == "INSUFFICIENT":
        return RiskResult(
            model_risk_score=None,
            final_risk_score=None,
            model_risk_level="INSUFFICIENT_DATA",
            final_risk_level="INSUFFICIENT_DATA",
            risk_level="INSUFFICIENT_DATA",
            risk_escalated=False,
            risk_escalation_reasons=[],
            data_quality="INSUFFICIENT",
            warnings=warnings,
            rule_evaluations=rules_eval,
        )

    # 2. Handle missing model probability
    if calibrated_probability is None:
        warnings.append("Model probability unavailable. Emitting fail-safe assessment.")
        return RiskResult(
            model_risk_score=None,
            final_risk_score=None,
            model_risk_level="INSUFFICIENT_DATA",
            final_risk_level="INSUFFICIENT_DATA",
            risk_level="INSUFFICIENT_DATA",
            risk_escalated=False,
            risk_escalation_reasons=[],
            data_quality=quality,
            warnings=warnings,
            rule_evaluations=rules_eval,
        )

    # 3. Apply Safety Policy and Escalations
    final_score, model_level, final_level, is_escalated, esc_reasons, esc_warnings = apply_safety_escalations(
        calibrated_probability, input_data, thresholds
    )

    warnings.extend(esc_warnings)
    model_score = round(calibrated_probability * 100.0, 1)

    return RiskResult(
        model_risk_score=model_score,
        final_risk_score=round(final_score, 1),
        model_risk_level=model_level,
        final_risk_level=final_level,
        risk_level=final_level,
        risk_escalated=is_escalated,
        risk_escalation_reasons=esc_reasons,
        data_quality=quality,
        warnings=warnings,
        rule_evaluations=rules_eval,
    )
