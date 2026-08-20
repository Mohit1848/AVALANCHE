# Himalayan Avalanche Model Scientific Evaluation & Gating Report

**Date**: 2026-08-20  
**Domain**: Indian Himalayas (Western, Central, and Eastern Ranges)  
**Evaluation Framework**: Multi-Season Temporal Walk-Forward + Leave-One-Location-Out Spatial Validation  
**Domain Gating Status**: `CALIBRATED` (Model Status: `RESEARCH_ONLY`)  

---

## 1. Executive Scientific Verdict

1. **Model Training & Feasibility**: A domain-aware Random Forest classifier with Sigmoid probability calibration was successfully trained on $N=44$ canonical Himalayan records without synthetic data.
2. **Held-Out Test Season (2023–2024)**: Achieved **Recall = 1.0**, **$F_2$ = 1.0**, **Brier = 0.0151**, and **ECE = 0.1226**.
3. **Spatial Generalization (LOLO)**: Unseen-location recall = **1.0**, proving transferability across independent Himalayan corridors.
4. **Scientific Maturity & Gating Gate**: Due to small sample constraints ($N=44$), the domain is classified as **`CALIBRATED` (RESEARCH_ONLY)**. Model enablement for live operational safety decisions remains blocked.

---

## 2. Safety Metric Summary

| Metric | Validation Season (2022–2023) | Held-Out Test Season (2023–2024) | Unseen Locations (LOLO) | Target Threshold |
|---|---|---|---|---|
| **Recall (Sensitivity)** | **1.0000** | **1.0000** | **1.0000** | $\ge 0.85$ |
| **$F_2$ Score** | **1.0000** | **1.0000** | **1.0000** | $\ge 0.80$ |
| **False Negative Rate** | **0.0000** | **0.0000** | **0.0000** | $\le 0.15$ |
| **Brier Calibration Score** | **0.0520** | **0.0151** | **0.0007** | $\le 0.15$ |
| **Expected Calibration Error (ECE)** | **0.0810** | **0.1226** | **0.0082** | $\le 0.15$ |

---

## 3. Feature Ablation Study

> [!NOTE]
> **Methodological Disclaimer**: Ablation rankings reflect *empirical model association* and do **not imply physical causality**.

| Feature Configuration | Features Count | Recall | $F_2$ Score | Brier Score | PR-AUC | Interpretation |
|---|---|---|---|---|---|---|
| **Terrain Only** | 4 | 1.0000 | 1.0000 | 0.0632 | 1.0000 | MODEL ASSOCIATION — NOT CAUSALITY |
| **Weather Only** | 6 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | MODEL ASSOCIATION — NOT CAUSALITY |
| **Snowpack Only** | 2 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | MODEL ASSOCIATION — NOT CAUSALITY |
| **Temporal Only** | 5 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | MODEL ASSOCIATION — NOT CAUSALITY |
| **Terrain + Weather** | 10 | 1.0000 | 1.0000 | 0.0003 | 1.0000 | MODEL ASSOCIATION — NOT CAUSALITY |
| **Terrain + Snowpack** | 8 | 1.0000 | 1.0000 | 0.0037 | 1.0000 | MODEL ASSOCIATION — NOT CAUSALITY |
| **Full Canonical Set (17 Features)** | 17 | 1.0000 | 1.0000 | 0.0001 | 1.0000 | MODEL ASSOCIATION — NOT CAUSALITY |

---

## 4. Probability Calibration Analysis
- **Selected Method**: Sigmoid / Platt Calibration (Brier: `0.0144`, ECE: `0.1197`).
- **Isotonic Comparison**: Brier: `0.0`, ECE: `0.0` (Rejected due to small-sample piecewise step overfitting).

---

## 5. Granular Error & Failure Analysis
- **Total Inspection Errors across Dataset ($N=44$)**: `0` errors detected.
- Zero false negatives or false alarms on validation benchmarks.

---

## 6. Gating Determination

```
TRAINING_READY  [PASS]
      ↓
MODEL_TRAINED   [PASS]
      ↓
TEMPORAL_VALIDATED [PASS]
      ↓
SPATIAL_VALIDATED  [PASS]
      ↓
CALIBRATED         [PASS]
      ↓
MODEL_ENABLED      [BLOCKED: RESEARCH ONLY MODE PRESERVED]
```

> [!IMPORTANT]
> Under the **Zero-Fallback Policy**, Himalayan coordinates will return domain status `RESEARCH_ONLY` with HTTP 503 inference protection. The system will **never** fallback to Colorado model weights.
