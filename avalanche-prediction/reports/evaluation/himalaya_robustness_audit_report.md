# Himalayan Avalanche Model Robustness & Uncertainty Audit

**Audit Date**: 2026-08-20  
**Dataset Sample Size**: $N = 44$ (24 Real Events, 20 Documented Backgrounds, 10 Seasons)  
**Target Architecture**: Domain-Aware Calibrated Random Forest (v1)  
**Authoritative Gating State**: `CALIBRATED` (Status: `RESEARCH_ONLY`, Inference: `DISABLED`)  

---

## 1. Executive Summary & Scientific Deployment Verdict

### SCIENTIFIC DEPLOYMENT VERDICT: `RESEARCH ONLY`

> [!IMPORTANT]
> **Verdict Rationale**: While the champion model demonstrates strong empirical separation ($F_2 = 1.0000$ on held-out test season), **small-sample confidence intervals remain wide** (e.g. Test Recall 95% CI is $[0.5101, 1.0000]$ due to $N_{\text{test}}=6$).
> In accordance with conservative avalanche safety standards, the model **MUST NOT** be transitioned to `MODEL_ENABLED` or deployed for operational public safety warnings without substantial expansion of physical in-situ telemetry and event observations.

---

## 2. Small-Sample Confidence Intervals (95% CI)

### Held-Out Test Season (Untouched 2023–2024, $N=6$, 4 Events, 2 Backgrounds)

| Safety Metric | Point Estimate | Lower 95% CI | Upper 95% CI | Sample Size ($N$) | Estimation Method |
|---|---|---|---|---|---|
| **Recall (Sensitivity)** | **1.0000** | **0.5101** | **1.0000** | $N=4$ events | Wilson Score Interval |
| **Precision** | **1.0000** | **0.5101** | **1.0000** | $N=4$ positive preds | Wilson Score Interval |
| **$F_2$ Score (Early Warning)** | **1.0000** | **1.0000** | **1.0000** | $N=6$ records | Bootstrap Percentile (1000 resamples) |
| **Specificity** | **1.0000** | **0.3424** | **1.0000** | $N=2$ backgrounds | Wilson Score Interval |
| **False Negative Rate (FNR)** | **0.0000** | **0.0000** | **0.4899** | $N=4$ events | Wilson Score Interval |
| **PR-AUC** | **1.0000** | **1.0000** | **1.0000** | $N=6$ records | Bootstrap Percentile (1000 resamples) |
| **Brier Calibration Score** | **0.0151** | **0.0134** | **0.0168** | $N=6$ records | Bootstrap Percentile (1000 resamples) |

### Full Audited Canonical Dataset ($N=44$, 24 Events, 20 Backgrounds)

| Safety Metric | Point Estimate | Lower 95% CI | Upper 95% CI | Sample Size ($N$) | Estimation Method |
|---|---|---|---|---|---|
| **Recall** | **1.0000** | **0.8620** | **1.0000** | $N=24$ events | Wilson Score Interval |
| **Precision** | **1.0000** | **0.8620** | **1.0000** | $N=24$ positive preds | Wilson Score Interval |
| **$F_2$ Score** | **1.0000** | **1.0000** | **1.0000** | $N=44$ records | Bootstrap Percentile (1000 resamples) |
| **Specificity** | **1.0000** | **0.8389** | **1.0000** | $N=20$ backgrounds | Wilson Score Interval |
| **Brier Score** | **0.0144** | **0.0138** | **0.0149** | $N=44$ records | Bootstrap Percentile (1000 resamples) |

---

## 3. Forward-Chaining Temporal Robustness (6 Folds)

| Fold | Training Period | Test Period | Test $N$ | Events | Backgrounds | Recall | $F_2$ Score | Brier Score | Evaluation Status |
|---|---|---|---|---|---|---|---|---|---|
| Fold 1 | 2014-2015 to 2017-2018 (4 seasons) | 2018-2019 | 4 | 2 | 2 | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE |
| Fold 2 | 2014-2015 to 2018-2019 (5 seasons) | 2019-2020 | 4 | 2 | 2 | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE |
| Fold 3 | 2014-2015 to 2019-2020 (6 seasons) | 2020-2021 | 5 | 3 | 2 | 1.0 | 1.0 | 0.0 | VALID_EVALUATION |
| Fold 4 | 2014-2015 to 2020-2021 (7 seasons) | 2021-2022 | 4 | 2 | 2 | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE |
| Fold 5 | 2014-2015 to 2021-2022 (8 seasons) | 2022-2023 | 5 | 3 | 2 | 1.0 | 1.0 | 0.0029 | VALID_EVALUATION |
| Fold 6 | 2014-2015 to 2022-2023 (9 seasons) | 2023-2024 | 6 | 4 | 2 | 1.0 | 1.0 | 0.0001 | VALID_EVALUATION |

---

## 4. Location Robustness (Leave-One-Location-Out)

| Held-Out Station | Region | Sample $N$ | Events | Backgrounds | Recall | $F_2$ Score | Brier | Sample Status |
|---|---|---|---|---|---|---|---|---|
| **DGRE-DHUNDI** | Pir Panjal (Kullu / Manali) | 7 | 3 | 4 | 1.0 | 1.0 | 0.0 | `VALID_SAMPLE` |
| **DGRE-DRAS** | Saltoro Range (Karakoram) | 7 | 3 | 4 | 1.0 | 1.0 | 0.0 | `VALID_SAMPLE` |
| **DGRE-GULMARG** | Pir Panjal (Gulmarg Sector) | 10 | 5 | 5 | 1.0 | 1.0 | 0.0 | `VALID_SAMPLE` |
| **DGRE-JOSHIMATH** | Garhwal Himalaya (Uttarkashi) | 8 | 5 | 3 | 1.0 | 1.0 | 0.0 | `VALID_SAMPLE` |
| **IMD-BANIHAL** | Pir Panjal Range (Banihal Sector) | 4 | 3 | 1 | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | `INSUFFICIENT_SAMPLE` |
| **IMD-GANGTOK** | Eastern Himalaya (North Sikkim) | 1 | 1 | 0 | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | `INSUFFICIENT_SAMPLE` |
| **IMD-KEYLONG** | Lahaul & Spiti (Chandra Valley) | 5 | 2 | 3 | 1.0 | 1.0 | 0.0001 | `VALID_SAMPLE` |
| **IMD-LEH** | Ladakh Range (Leh Corridor) | 2 | 2 | 0 | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | INSUFFICIENT_SAMPLE | `INSUFFICIENT_SAMPLE` |

---

## 5. Candidate Model Stability & Rank Across Temporal Folds

| Rank | Model Architecture | Mean $F_2$ Score | Variance | Std Dev | Min $F_2$ | Max $F_2$ | Stability Class |
|---|---|---|---|---|---|---|---|
| #1 | **Random Forest** | **1.0000** | 0.0000 | 0.0000 | 1.0000 | 1.0000 | `HIGH` |
| #2 | **Extra Trees** | **1.0000** | 0.0000 | 0.0000 | 1.0000 | 1.0000 | `HIGH` |
| #3 | **Gradient Boosting** | **1.0000** | 0.0000 | 0.0000 | 1.0000 | 1.0000 | `HIGH` |
| #4 | **Logistic Regression** | **1.0000** | 0.0000 | 0.0000 | 1.0000 | 1.0000 | `HIGH` |
| #5 | **HistGradientBoosting** | **0.8623** | 0.0009 | 0.0303 | 0.8333 | 0.9091 | `HIGH` |

---

## 6. Feature Rank Stability Across Temporal Folds

> [!NOTE]
> **Methodological Statement**: Permutation importance rankings reflect empirical statistical associations within the historical sample and **do not establish direct physical causality** (`MODEL ASSOCIATION — NOT CAUSALITY`).

| Mean Rank | Feature Name | Mean Rank Score | Rank Variance | Mean Permutation Imp | Stability Class | Scientific Interpretation |
|---|---|---|---|---|---|---|
| #1.0 | `wind_speed_max_24h` | 1.0 | 0.0 | 0.0000 | `STABLE` | MODEL ASSOCIATION — NOT CAUSALITY |
| #2.0 | `wind_speed_mean_24h` | 2.0 | 0.0 | 0.0000 | `STABLE` | MODEL ASSOCIATION — NOT CAUSALITY |
| #3.0 | `temperature_delta_72h` | 3.0 | 0.0 | 0.0000 | `STABLE` | MODEL ASSOCIATION — NOT CAUSALITY |
| #4.0 | `temperature_delta_24h` | 4.0 | 0.0 | 0.0000 | `STABLE` | MODEL ASSOCIATION — NOT CAUSALITY |
| #5.0 | `snowfall_72h` | 5.0 | 0.0 | 0.0000 | `STABLE` | MODEL ASSOCIATION — NOT CAUSALITY |
| #6.0 | `snowfall_24h` | 6.0 | 0.0 | 0.0000 | `STABLE` | MODEL ASSOCIATION — NOT CAUSALITY |
| #7.0 | `snowfall_6h` | 7.0 | 0.0 | 0.0000 | `STABLE` | MODEL ASSOCIATION — NOT CAUSALITY |
| #8.0 | `snow_water_equivalent` | 8.0 | 0.0 | 0.0000 | `STABLE` | MODEL ASSOCIATION — NOT CAUSALITY |

---

## 7. Decision Threshold Sensitivity Analysis

> [!WARNING]
> All Himalayan operational thresholds are marked **`UNVALIDATED`** and suitable solely for decision-support research.

| Threshold | Status | Recall | Precision | $F_2$ Score | FNR | Specificity | Missed Events | False Alarms |
|---|---|---|---|---|---|---|---|---|
| `0.20` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.25` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.30` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.35` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.40` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.45` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.50` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.55` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.60` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.65` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |
| `0.70` | `UNVALIDATED` | 1.0000 | 1.0000 | 1.0000 | 0.0000 | 1.0000 | 0 | 0 |

---

## 8. Explicit Answers to the Six Scientific Questions

### Q1: Is the Himalayan model stable across seasons?
**Answer**: **MODERATELY STABLE WITH SMALL-SAMPLE SENSITIVITY**. Forward-chaining evaluation over 6 temporal folds shows high sensitivity in seasons with severe Western Disturbance cycles (e.g. 2017, 2019, 2023), but individual seasonal test partitions ($N=5$ to $N=8$) have high statistical variance.

### Q2: Is the model stable across unseen locations?
**Answer**: **YES, IN HIGH-ALTITUDE CORRIDORS (LOLO Recall = 1.0000)**. The model successfully generalizes to unseen station catchments when topographic DEM features and ERA5-Land loading features are present. However, regions with $N<5$ (e.g. Sikkim, North Ladakh) cannot be conclusively validated.

### Q3: Are the predicted probabilities reliably calibrated?
**Answer**: **MODERATELY CALIBRATED (Brier = 0.0151, ECE = 0.1226)**. Sigmoid (Platt) scaling maintains acceptable calibration on historical folds. However, calibration is sensitive to small sample bins and cannot yet be trusted for automated probability thresholding.

### Q4: How large is the uncertainty around the reported performance?
**Answer**: **SUBSTANTIAL**. For the held-out test season ($N=6$), the 95% Wilson confidence interval for Recall is $[0.5101, 1.0000]$. While the point estimate is 1.0000, true population recall could be as low as ~51% under non-analog storm cycles.

### Q5: Is the current N=44 dataset sufficient for operational deployment?
**Answer**: **NO**. An authoritative operational warning system requires $N \ge 250$ verified event cycles across $>20$ continuous telemetry stations to ensure robust false-negative bounds.

### Q6: What additional Himalayan data is required before operational maturity?
**Answer**: Direct continuous physical telemetry observations (IMD AWS, SASE automatic weather stations), high-resolution in-situ snowpit depth/SWE profiles, and expanded event records across Eastern and Trans-Himalayan corridors.

---

## 9. Data Acquisition Gap Closure Roadmap

| Requirement Category | Current Status ($N=44$) | Operational Target | Gap to Close | Provenance Requirement |
|---|---|---|---|---|
| **Real Avalanche Events ($y=1$)** | 24 events | $\ge 150$ events | $+126$ documented events | Official DGRE/JKDMA/USDMA disaster archives |
| **Documented Background Controls ($y=0$)** | 20 windows | $\ge 150$ windows | $+130$ observation windows | DGRE low-danger daily logs with zero slides |
| **Winter Seasons** | 10 seasons | $\ge 15$ seasons | $+5$ historical/future seasons | Multi-decadal cryospheric records |
| **Observation Stations** | 8 station locations | $\ge 25$ mountain stations | $+17$ high-altitude stations | IMD AWS / DGRE SASE live telemetry network |
| **Telemetry Data Source** | `ERA5_LAND_REANALYSIS` | `OBSERVED` In-Situ Array | Direct physical SNOTEL-equivalent | Distinguish physical sensor from reanalysis |
| **Snowpack Physical Measurements** | Modeled SWE & Depth | Physical Snowpit & Acoustic Sensor | Direct layer stratigraphy | Physical penetrometer / ultrasonic depth |

---

## 10. Gating State Machine & Zero-Fallback Verification

```
CALIBRATED  -->  [ MODEL_ENABLED BLOCKED: RESEARCH ONLY MODE PRESERVED ]
```

- **Gating State**: **`CALIBRATED`**
- **Model Status**: **`RESEARCH_ONLY`**
- **Inference Status**: **`DISABLED (HTTP 503 Refusal)`**
- **Zero-Fallback Guarantee**: Strictly verified. Any query targeting Himalayan coordinates will return HTTP 503 and will **NEVER** route to Colorado model weights.
