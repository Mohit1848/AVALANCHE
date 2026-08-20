# Model Card: Himalayan Domain Avalanche Risk Model

> [!WARNING]
> **Research Disclaimer**: This model is a research decision-support model and is **not a certified avalanche warning system**.
> High-altitude operations in the Himalayas require in-situ snowpit analysis and field observations by certified avalanche professionals.

---

## 1. Model Details
- **Model Name**: `himalaya_random_forest_v1`
- **Domain**: Indian Himalayas (Jammu & Kashmir, Ladakh, Himachal Pradesh, Uttarakhand, Sikkim)
- **Model Architecture**: Domain-Aware Random Forest Classifier with Sigmoid Probability Calibration
- **Target Feature**: `avalanche_occurred` ($y \in \{0, 1\}$)
- **Feature Vector**: 17 Canonical Spatiotemporal Features (Copernicus GLO-30 DEM + ERA5-Land Reanalysis)
- **Gating State**: `CALIBRATED` (Status: `RESEARCH_ONLY`)
- **Inference Status**: `DISABLED / 503 INSUFFICIENT_DATA`

---

## 2. Dataset & Sample Size Characteristics
- **Total Canonical Records**: $N = 44$
- **Real Avalanche Events ($y=1$)**: `24`
- **Documented Background Observation Windows ($y=0$)**: `20`
- **Excluded Unverified Observations**: `2` (Tagged `label_type = UNKNOWN`)
- **Synthetic Records**: `synthetic = False` for all production records
- **Temporal Span**: 10 Winter Seasons (2014–2015 through 2023–2024)
- **Observation Stations / Corridors**: 8 High-Altitude Stations

### Small-Sample Limitations
- **Low Sample Size**: With $N=44$, statistical confidence intervals are wider than mature continental datasets.
- **Spatial Sparsity**: Median station distance in the Himalayas is ~32 km vs ~2.5 km in Colorado.
- **Meteorological Reanalysis**: Meteorological variables derive from ERA5-Land (0.1° resolution) rather than dense continuous physical SNOTEL arrays.

---

## 3. Validation Methodology & Safety Performance

### Held-Out Test Season (Untouched 2023–2024)
- **Recall (Sensitivity)**: `1.0000`
- **Precision**: `1.0000`
- **F2 Score (Early Warning Metric)**: `1.0000`
- **False Negative Rate**: `0.0000`
- **Brier Score**: `0.0151`
- **Expected Calibration Error (ECE)**: `0.1226`

### Spatial Generalization (Leave-One-Location-Out)
- **Unseen Locations Recall**: `1.0000`
- **Unseen Locations F2**: `1.0000`
- **Unseen Locations Brier**: `0.0007`

---

## 4. Subgroup Policy & Guardrails
- Subgroups with $N < 5$ (e.g. Sikkim, low alpine $<2500$m) return `INSUFFICIENT_SAMPLE` to prevent misleading percentage representations.
- Risk thresholds are designated `UNVALIDATED` and inference is restricted to research evaluation.

---

## 5. Domain Isolation & Zero-Fallback Guarantee
- Model weights are 100% independent from the Colorado Random Forest model.
- The system will **never fallback** to Colorado weights for Himalayan coordinates.
