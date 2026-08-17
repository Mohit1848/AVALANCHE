"""Probability Calibration & Reliability Evaluation."""

from __future__ import annotations

import numpy as np
from typing import Any, Dict, List, Tuple
from sklearn.calibration import calibration_curve
from sklearn.metrics import brier_score_loss


def calculate_ece(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 5) -> float:
    """Calculate Expected Calibration Error (ECE)."""
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    n = len(y_true)
    if n == 0:
        return 0.0

    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        mask = (y_prob >= bin_lower) & (y_prob < bin_upper if i < n_bins - 1 else y_prob <= bin_upper)
        n_in_bin = np.sum(mask)
        if n_in_bin > 0:
            bin_acc = np.mean(y_true[mask])
            bin_conf = np.mean(y_prob[mask])
            ece += (n_in_bin / n) * abs(bin_acc - bin_conf)

    return float(ece)


def evaluate_calibration(
    y_true: np.ndarray,
    uncalibrated_probs: np.ndarray,
    calibrated_probs: np.ndarray,
    n_bins: int = 5,
) -> Dict[str, Any]:
    """Compare uncalibrated vs calibrated probabilities."""
    y_true = np.asarray(y_true, dtype=int)
    uncalibrated_probs = np.asarray(uncalibrated_probs, dtype=float)
    calibrated_probs = np.asarray(calibrated_probs, dtype=float)

    # 1. Brier scores
    brier_uncal = float(brier_score_loss(y_true, uncalibrated_probs))
    brier_cal = float(brier_score_loss(y_true, calibrated_probs))
    brier_improvement = float(brier_uncal - brier_cal)

    # 2. ECE
    ece_uncal = calculate_ece(y_true, uncalibrated_probs, n_bins=n_bins)
    ece_cal = calculate_ece(y_true, calibrated_probs, n_bins=n_bins)

    # 3. Calibration curves
    prob_true_uncal, prob_pred_uncal = calibration_curve(y_true, uncalibrated_probs, n_bins=n_bins, strategy="uniform")
    prob_true_cal, prob_pred_cal = calibration_curve(y_true, calibrated_probs, n_bins=n_bins, strategy="uniform")

    curve_uncal = [
        {"mean_predicted": round(float(p), 4), "fraction_positives": round(float(f), 4)}
        for p, f in zip(prob_pred_uncal, prob_true_uncal)
    ]
    curve_cal = [
        {"mean_predicted": round(float(p), 4), "fraction_positives": round(float(f), 4)}
        for p, f in zip(prob_pred_cal, prob_true_cal)
    ]

    return {
        "uncalibrated": {
            "brier_score": round(brier_uncal, 4),
            "ece": round(ece_uncal, 4),
            "calibration_curve": curve_uncal,
        },
        "calibrated": {
            "brier_score": round(brier_cal, 4),
            "ece": round(ece_cal, 4),
            "calibration_curve": curve_cal,
        },
        "brier_improvement": round(brier_improvement, 4),
        "calibration_improves_reliability": brier_cal <= brier_uncal,
        "n_samples": len(y_true),
        "positive_rate": round(float(np.mean(y_true)), 4) if len(y_true) > 0 else 0.0,
    }
