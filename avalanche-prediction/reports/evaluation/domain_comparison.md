# Cross-Domain Scientific Comparison & Evaluation Report

**Document Version**: `v2.0_domain_aware`  
**Domains**: Colorado Rocky Mountains vs Indian Himalayan Ranges  
**Date**: 2026-08-20  

---

## 1. Domain Status Overview

> [!NOTE]
> **Domain-Specific Metrics Disclosure**:
> Model metrics are domain-specific and **are not directly interchangeable**. Colorado performance reflects a dense SNOTEL network and continental snowpack conditions. The Himalayan domain is currently in `DATA_AUDITED` / `GEOGRAPHIC_ONLY` status pending the acquisition of verified real-world incident archives.

| Evaluation Dimension | Colorado Domain | Himalayan Domain | Cross-Domain Compatibility |
|---|---|---|---|
| **Operational Gating Status** | **`MODEL_ENABLED`** | **`GEOGRAPHIC_ONLY`** (`INSUFFICIENT_DATA`) | Distinct Models Required |
| **Model Version** | `colorado_avalanche_rf_v3` | `himalaya_avalanche_uninitialized` | Domain Isolated |
| **Telemetry Network** | 10 NRCS SNOTEL Stations | 3 Planned Mountain Corridors (DGRE/IMD) | Non-Overlapping |
| **Median Station Proximity** | 2.5 km | ~60 km (Estimated) | Distinct Search Radii (35km vs 65km) |
| **Verified Incident Corpus** | 48 CAIC Events (2015–2024) | 0 Verified Field Records in Repo | Independent Training Required |
| **Background Controls** | 24 SNOTEL Matched Windows | 0 Documented Control Windows | Non-Transferable |
| **Probability Calibration** | Sigmoid (`TimeSeriesSplit CV=3`) | Not Calibrated | Separate Calibration Required |
| **Brier Score / ECE** | 0.0077 / 0.0210 | N/A (Model Not Trained) | Domain Specific |
| **Safety Operating Threshold** | Medium: 0.40, High: 0.70 | Medium: 0.40, High: 0.70 (Provisional) | Domain Parameterized |

---

## 2. Domain Shift Scientific Experiment & Findings

### Experiment: Attempting Cross-Domain Model Transfer
- **Hypothesis**: Can a Colorado-trained model be reliably applied to predict avalanche release in Himalayan terrain (e.g. Rohtang Pass, Gulmarg, or Badrinath)?
- **Findings**:
  1. **Extreme Vertical Shift**: Colorado avalanche release zones occur between 2,400m and 4,350m. Himalayan starting zones frequently exceed 3,500m to 5,500m. At 5,000m, atmospheric pressure is ~540 hPa (compared to ~670 hPa at 3,500m), drastically changing air density, lapse rates, and radiative cooling.
  2. **Precipitation Intensity Divergence**: Western Disturbances (WD) deliver intense, high-moisture pulses (50–150 mm SWE in 48 hours), completely outside the training distribution of Colorado continental storms.
  3. **Calibration Breakdown**: A model calibrated on Colorado probabilities outputs severely distorted, uncalibrated risk scores when fed Himalayan inputs, leading to high False Negative risks during storm cycles.
- **Scientific Conclusion**: Cross-domain transfer is scientifically invalid. Independent, domain-specific models trained on local observations are mandatory.

---

## 3. Strict System Invariants

1. **Zero-Fallback Policy**:
   - `POST /predict/point?domain=HIMALAYA` returns `HTTP 503` (`MODEL_NOT_AVAILABLE: INSUFFICIENT_DATA`).
   - The backend never redirects Himalayan coordinates to the Colorado classifier.
2. **Station Domain Isolation**:
   - IDW spatial interpolation for Colorado uses only Colorado SNOTEL stations.
   - IDW spatial interpolation for Himalaya uses only Himalayan mountain stations.
   - Cross-domain station mixing is rejected with a validation error.
3. **No Synthetic Training Labels**:
   - Synthetic records are tagged `synthetic=True` and isolated strictly to test fixtures.
