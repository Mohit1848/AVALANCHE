"""Decision Threshold Tradeoff Analysis."""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any, Dict, List
from sklearn.metrics import confusion_matrix


def evaluate_thresholds(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    thresholds: List[float] = None,
) -> Dict[str, Any]:
    """Evaluate classification performance across multiple decision thresholds."""
    if thresholds is None:
        thresholds = [0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80]

    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob, dtype=float)

    results: List[Dict[str, Any]] = []

    for th in thresholds:
        preds = (y_prob >= th).astype(int)
        
        # Calculate confusion matrix components safely
        cm = confusion_matrix(y_true, preds, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()

        pos_count = tp + fn
        neg_count = tn + fp

        recall = tp / pos_count if pos_count > 0 else 0.0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        specificity = tn / neg_count if neg_count > 0 else 0.0
        fnr = fn / pos_count if pos_count > 0 else 0.0
        fpr = fp / neg_count if neg_count > 0 else 0.0

        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        f2 = (5 * precision * recall) / (4 * precision + recall) if (4 * precision + recall) > 0 else 0.0

        results.append({
            "threshold": round(th, 2),
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
            "recall": round(recall, 4),
            "precision": round(precision, 4),
            "f1": round(f1, 4),
            "f2": round(f2, 4),
            "fnr": round(fnr, 4),
            "fpr": round(fpr, 4),
            "specificity": round(specificity, 4),
            "missed_events_count": int(fn),
            "false_alarms_count": int(fp),
        })

    df = pd.DataFrame(results)
    
    # Identify highest F2 threshold as safety recommendation candidate
    best_f2_idx = df["f2"].idxmax()
    recommended_safety_th = float(df.loc[best_f2_idx, "threshold"])

    return {
        "threshold_table": results,
        "recommended_safety_threshold": recommended_safety_th,
        "operating_threshold_current": 0.40,
        "n_samples": len(y_true),
        "total_positive_events": int(np.sum(y_true)),
        "total_background_records": int(len(y_true) - np.sum(y_true)),
    }
