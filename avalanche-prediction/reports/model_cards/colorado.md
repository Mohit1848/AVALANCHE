# Model Card: Colorado Avalanche Prediction System

**Model Version**: `colorado_avalanche_rf_v3`  
**Domain**: Colorado Rocky Mountains (United States)  
**Status**: `MODEL_ENABLED`  
**Architecture**: Calibrated Random Forest Classifier (`CalibratedClassifierCV` via `TimeSeriesSplit(n_splits=3)`)  
**Feature Schema Version**: `v2_spatiotemporal_17f`  
**Primary Evaluated Seasons**: 2015-2016 through 2023-2024  
**Date**: 2026-08-20  

---

## 1. Intended Use & Scope
- **Intended Use**: Operational research decision-support for mountain safety analysts and research personnel assessing regional avalanche release likelihood across Colorado alpine zones.
- **Out-of-Scope Use**: Not intended as an automated evacuation trigger or official public emergency forecast without human backcountry specialist review. Must never be used outside Colorado terrain.

---

## 2. Training & Telemetry Sources
- **Avalanche Incident Archive**: Colorado Avalanche Information Center (CAIC) field-verified observation records.
- **Meteorological & Snowpack Telemetry**: USDA NRCS SNOTEL automated alpine telemetry stations.
- **Topographic Terrain Model**: Copernicus GLO-30 / USGS 30m Digital Elevation Models.
- **Features (17)**: `slope`, `aspect_sin`, `aspect_cos`, `elevation`, `temperature`, `humidity`, `pressure`, `precipitation`, `snow_depth`, `snow_water_equivalent`, `snowfall_6h`, `snowfall_24h`, `snowfall_72h`, `temperature_delta_24h`, `temperature_delta_72h`, `wind_speed_mean_24h`, `wind_speed_max_24h`.

---

## 3. Validation Strategy & Performance Metrics
- **Temporal Splitting**: Strictly chronological splits to prevent future-to-past leakage ($T_{obs} \le T_{target}$).
- **Spatial Validation**: Leave-One-Station-Out (LOSO) cross-validation across 10 SNOTEL sites.
- **Key Metrics (Held-Out Evaluation)**:
  - **Recall**: 1.0000 (Wilson 95% CI: [0.722, 1.000])
  - **F2 Score**: 1.0000
  - **PR-AUC**: 1.0000
  - **Precision**: 1.0000
  - **F1 Score**: 1.0000
  - **Brier Score**: 0.0077
  - **Expected Calibration Error (ECE)**: 0.0210
  - **False Negative Rate (FNR)**: 0.0000

---

## 4. Operating Thresholds & Safety Policies
- **Medium Risk Operating Threshold**: 0.40
- **High Risk Threshold**: 0.70
- **Deterministic Safety Overrides**:
  1. Heavy storm snowfall ($>30$ mm / 24h or $>45$ mm / 72h) on steep slopes ($\ge 34^\circ$) $\to$ minimum `HIGH`.
  2. Rapid thermal warming ($T \ge 3^\circ\text{C}$ or 24h $\Delta T \ge 6^\circ\text{C}$) on steep slopes ($\ge 35^\circ$) $\to$ minimum `HIGH`.
  3. Moderate storm snowfall ($>15$ mm / 24h) on slopes $\ge 30^\circ$ $\to$ minimum `MEDIUM`.

---

## 5. Limitations & Known Biases
- Low-elevation valley observations may not capture ridge-top wind scouring or localized wind-slab loading.
- Sub-hourly rapid temperature spikes between reporting cycles are smoothed.
- Explicitly calibrated for continental snowpacks (facets, depth hoar) — **not transferable to maritime or monsoon regimes**.
