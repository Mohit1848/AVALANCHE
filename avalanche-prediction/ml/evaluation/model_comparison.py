"""Multi-Model Comparative Benchmark."""

from __future__ import annotations

import pandas as pd
import numpy as np
from typing import Any, Dict, List
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, ExtraTreesClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import recall_score, precision_score, f1_score, fbeta_score, roc_auc_score, average_precision_score, brier_score_loss

from ml.evaluation.calibration import calculate_ece


def compare_models(
    x_train: pd.DataFrame,
    y_train: np.ndarray,
    x_test: pd.DataFrame,
    y_test: np.ndarray,
    threshold: float = 0.40,
    random_state: int = 42,
) -> List[Dict[str, Any]]:
    """Compare multiple model families under identical train/test split and calibration procedure."""
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=4, min_samples_leaf=2, random_state=random_state),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=80, max_depth=3, learning_rate=0.08, random_state=random_state),
        "HistGradientBoosting": HistGradientBoostingClassifier(max_iter=100, max_depth=4, random_state=random_state),
        "Extra Trees": ExtraTreesClassifier(n_estimators=100, max_depth=4, min_samples_leaf=2, random_state=random_state),
        "Logistic Regression (L2)": make_pipeline(StandardScaler(), LogisticRegression(C=1.0, random_state=random_state)),
    }

    results: List[Dict[str, Any]] = []

    y_train = np.asarray(y_train, dtype=int)
    y_test = np.asarray(y_test, dtype=int)

    n_pos_tr = int(np.sum(y_train))
    n_neg_tr = len(y_train) - n_pos_tr
    min_class_count = min(n_pos_tr, n_neg_tr)

    for name, base_estimator in models.items():
        try:
            if min_class_count >= 2:
                cv_folds = min(3, min_class_count)
                cal_clf = CalibratedClassifierCV(estimator=base_estimator, method="sigmoid", cv=cv_folds)
                cal_clf.fit(x_train.fillna(0), y_train)
                probs = cal_clf.predict_proba(x_test.fillna(0))[:, 1]
            else:
                base_estimator.fit(x_train.fillna(0), y_train)
                probs = base_estimator.predict_proba(x_test.fillna(0))[:, 1]

            preds = (probs >= threshold).astype(int)

            n_pos = int(np.sum(y_test))
            rec = float(recall_score(y_test, preds, zero_division=0)) if n_pos > 0 else 0.0
            prec = float(precision_score(y_test, preds, zero_division=0)) if n_pos > 0 else 0.0
            f1 = float(f1_score(y_test, preds, zero_division=0)) if n_pos > 0 else 0.0
            f2 = float(fbeta_score(y_test, preds, beta=2, zero_division=0)) if n_pos > 0 else 0.0
            roc_auc = float(roc_auc_score(y_test, probs)) if len(np.unique(y_test)) > 1 else 0.5
            pr_auc = float(average_precision_score(y_test, probs)) if len(np.unique(y_test)) > 1 else 0.0
            brier = float(brier_score_loss(y_test, probs))
            ece = calculate_ece(y_test, probs, n_bins=5)

            results.append({
                "model_name": name,
                "recall": round(rec, 4),
                "precision": round(prec, 4),
                "f1": round(f1, 4),
                "f2": round(f2, 4),
                "pr_auc": round(pr_auc, 4),
                "roc_auc": round(roc_auc, 4),
                "brier_score": round(brier, 4),
                "ece": round(ece, 4),
                "status": "CONVERGED",
            })
        except Exception as ex:
            results.append({
                "model_name": name,
                "recall": None,
                "precision": None,
                "f1": None,
                "f2": None,
                "pr_auc": None,
                "roc_auc": None,
                "brier_score": None,
                "ece": None,
                "status": f"FAILED: {str(ex)}",
            })

    return results
