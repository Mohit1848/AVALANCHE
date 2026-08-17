# Data Pipeline

How a raw sensor reading becomes a validated observation, then a feature
vector, then a persisted prediction.

Implementation: `avalanche-prediction/services/ingestion/` and
`avalanche-prediction/api/services/feature_service.py`

---

## 1. Pipeline Overview

```text
SNOTEL station
     │  raw reading
     ▼
[1] snotel_worker.py      fetch / seed batch for enabled stations
     ▼
[2] validator.py          physical bounds · UTC normalization · provenance
     │                    out-of-range → null + warning (never clamped)
     ▼
[3] storage.py            SQLite upsert into telemetry_observations
     ▼
[4] scheduler.py          age computation → GOOD / DEGRADED / STALE
     ▼
[5] feature_service.py    dedupe · temporal filter · rolling windows
     │                    → 17-feature canonical vector
     ▼
[6] inference + risk engine
     ▼
[7] storage.py            SQLite insert into prediction_history
```

---

## 2. Stage 1 — Station Configuration and Acquisition

Stations are declared in `config/stations.yaml`. Only entries with
`enabled: true` participate in ingestion.

### Configured Stations

| ID | Name | Zone | Elevation | Default slope | Default aspect |
|---|---|---|---|---|---|
| 335 | Berthoud Summit | CO_FRONT_RANGE | 3444 m | 38.0° | 45° |
| 586 | Loveland Basin | CO_FRONT_RANGE | 3475 m | 37.0° | 90° |
| 505 | Grizzly Peak | CO_VAIL_SUMMIT | 3383 m | 36.0° | 45° |
| 531 | Hoosier Pass | CO_VAIL_SUMMIT | 3475 m | 36.5° | 180° |
| 415 | Copper Mountain | CO_VAIL_SUMMIT | 3216 m | 35.0° | 45° |
| 485 | Fremont Pass | CO_SAWATCH | 3475 m | 38.5° | 90° |
| 542 | Independence Pass | CO_ASPEN | 3688 m | 39.0° | 45° |
| 737 | Schofield Pass | CO_GUNNISON | 3261 m | 36.0° | 45° |
| 709 | Red Mountain Pass | CO_SAN_JUAN | 3414 m | 41.0° | 90° |
| 1030 | Arapaho Ridge | CO_STEAMBOAT | 3341 m | 34.0° | 90° |

`default_slope_deg` and `default_aspect_deg` are terrain assumptions for the
representative starting zone near each station — SNOTEL sites themselves sit on
flat ground, so these describe the adjacent avalanche terrain being assessed,
not the sensor location.

### SNOTEL Sensor Codes

| Code | Variable | Unit |
|---|---|---|
| `TOBS` | Air temperature | °C |
| `SNWD` | Snow depth | cm |
| `WTEQ` | Snow water equivalent | mm |
| `PREC` | Precipitation accumulation | mm |

---

## 3. Stage 2 — Validation and Provenance

`validator.validate_observation()` applies three checks before a reading is
allowed into storage.

### 3.1 Timestamp Normalization

Every timestamp is parsed (accepting a trailing `Z`), given UTC if naive,
converted to UTC if offset-aware, and re-emitted as `%Y-%m-%dT%H:%M:%SZ`.
A missing or unparseable timestamp **rejects the entire observation** — an
undatable reading cannot be placed in a rolling window.

### 3.2 Physical Bounds

| Variable | Minimum | Maximum | Unit |
|---|---|---|---|
| `temperature` | −60.0 | 45.0 | °C |
| `snow_depth` | 0.0 | 1500.0 | cm |
| `snow_water_equivalent` | 0.0 | 3000.0 | mm |
| `precipitation` | 0.0 | 500.0 | mm |
| `wind_speed` | 0.0 | 350.0 | km/h |

Out-of-range values are **set to `null` with a recorded warning**, not clamped
to the boundary. Clamping would convert a sensor fault into a plausible-looking
reading and hide the failure from downstream quality assessment.

### 3.3 Provenance Attachment

Each validated observation carries:

```json
{
  "source": "SNOTEL_AWDB",
  "ingestion_timestamp": "<UTC now>",
  "provenance": {
    "source": "SNOTEL",
    "station_id": "335",
    "network": "NRCS_SNOTEL",
    "validated_at": "<UTC now>"
  }
}
```

---

## 4. Stage 3 — Persistence

SQLite database at `avalanche-prediction/data/avalanche_telemetry.db`, created
on first use with a 15-second lock timeout.

### `telemetry_observations`

| Column | Type | Notes |
|---|---|---|
| `station_id` | TEXT | Composite primary key |
| `timestamp` | TEXT | Composite primary key; ISO-8601 UTC |
| `ingestion_timestamp` | TEXT | When the record entered the system |
| `temperature` | REAL | Nullable |
| `snow_depth` | REAL | Nullable |
| `snow_water_equivalent` | REAL | Nullable |
| `precipitation` | REAL | Nullable |
| `wind_speed` | REAL | Nullable |
| `provenance_json` | TEXT | Serialized provenance block |

The composite primary key on `(station_id, timestamp)` makes re-ingestion
idempotent — replaying a batch overwrites rather than duplicates.

### `prediction_history`

| Column | Type | Notes |
|---|---|---|
| `prediction_id` | TEXT | Primary key, `PRED_<station>_<hex8>` |
| `station_id`, `zone_id` | TEXT | Spatial attribution |
| `timestamp` | TEXT | Observation time the prediction describes |
| `evaluation_timestamp` | TEXT | When inference ran |
| `model_version` | TEXT | e.g. `calibrated_random_forest_2015_2024` |
| `dataset_version` | TEXT | e.g. `2015_2024_expanded` |
| `feature_schema_version` | TEXT | e.g. `v2_spatiotemporal_17f` |
| `risk_engine_version` | TEXT | e.g. `2.0.0` |
| `raw_probability`, `calibrated_probability` | REAL | Pre- and post-calibration |
| `model_risk_score`, `final_risk_score` | REAL | 0–100 scale |
| `model_risk_level`, `final_risk_level` | TEXT | Qualitative levels |
| `risk_escalated` | INTEGER | 0/1 |
| `risk_escalation_reasons_json` | TEXT | Serialized reason list |
| `data_quality` | TEXT | GOOD / DEGRADED / INSUFFICIENT |
| `warnings_json`, `features_json`, `provenance_json` | TEXT | Full audit payload |

Storing all four version fields alongside the complete input feature vector is
what makes a historical prediction reproducible after the model changes.

---

## 5. Stage 4 — Freshness Gating

`scheduler.get_freshness_status()` categorizes each station by observation age.

| Age | Status | Interpretation |
|---|---|---|
| ≤ 120 min (2h) | `GOOD` | Fresh — suitable for current assessment |
| 121–360 min (2–6h) | `DEGRADED` | Usable with caution; surfaced as a warning |
| > 360 min (6h) | `STALE` | Predictions suppressed; prominent notice displayed |
| `None` | `INSUFFICIENT` | No usable timestamp |

### System-Wide Rollup

`get_telemetry_freshness_report()` aggregates per-station states:

| Condition | `overall_status` |
|---|---|
| No stale stations, degraded ≤ half of total | `GOOD` |
| Any stale station, or degraded > half of total | `DEGRADED` |
| **All** stations stale | `STALE` |

The report also returns `age_minutes` (the freshest station's age), per-station
counts, a warnings list, and a `station_reports` array.

> [!NOTE]
> On a fresh checkout all 10 stations report `STALE`, because the seeded
> observations are real historical readings from the 2023–24 season. This is
> the freshness gate working correctly on old data, not a fault.

---

## 6. Stage 5 — Feature Engineering

`feature_service.process_telemetry_batch()` converts an observation stream into
the canonical 17-feature vector.

### 6.1 Temporal Isolation

The step that prevents label leakage:

1. Parse all timestamps as UTC.
2. Sort chronologically; deduplicate on timestamp keeping the **latest** write.
3. If `target_timestamp` is supplied, filter strictly to `T_obs <= T_target`.
   Otherwise the newest observation becomes the target.
4. Build all rolling windows backward from the target only.

No observation after the target time can influence the prediction — enforced in
code, not by convention.

### 6.2 Coverage Warnings

| Stream span | Warning |
|---|---|
| < 24 h | 24h and 72h rolling features may be underestimated |
| 24–72 h | 72h rolling snowfall may be incomplete |

Coverage shortfalls set `data_quality` to `DEGRADED` rather than failing.

### 6.3 Derived Features

| Feature | Method |
|---|---|
| `snowfall_6h` / `_24h` / `_72h` | **Method A**: sum of non-negative `precipitation` over the window. **Method B** (fallback when precipitation is absent): SWE delta (last − first), floored at 0 |
| `temperature_delta_24h` / `_72h` | Last − first valid temperature in the window; 0.0 if fewer than 2 readings |
| `wind_speed_mean_24h` / `_max_24h` | Mean and max of non-negative wind readings in the 24h window; `None` if no readings |
| `aspect_sin` / `aspect_cos` | `sin(radians(aspect))`, `cos(radians(aspect))` — cyclic encoding so 359° and 1° are near-neighbours rather than opposite extremes |
| `pressure` | Estimated barometrically: `675.0 − (elevation − 3000.0) × 0.08` hPa |
| `humidity` | Fixed at 70.0 — SNOTEL sites do not report relative humidity |

> [!IMPORTANT]
> `humidity` is a constant and `pressure` is a deterministic function of
> elevation. Neither carries station-specific information. Any reported feature
> importance for these two should be read with that in mind.

### 6.4 Canonical Feature Vector (`v2_spatiotemporal_17f`)

| # | Feature | Group |
|---|---|---|
| 1 | `slope` | Terrain |
| 2 | `aspect_sin` | Terrain (cyclic) |
| 3 | `aspect_cos` | Terrain (cyclic) |
| 4 | `elevation` | Terrain |
| 5 | `temperature` | Meteorological |
| 6 | `humidity` | Meteorological (constant) |
| 7 | `pressure` | Meteorological (elevation-derived) |
| 8 | `precipitation` | Meteorological |
| 9 | `snow_depth` | Snowpack |
| 10 | `snow_water_equivalent` | Snowpack |
| 11 | `snowfall_6h` | Temporal |
| 12 | `snowfall_24h` | Temporal |
| 13 | `snowfall_72h` | Temporal |
| 14 | `temperature_delta_24h` | Temporal |
| 15 | `temperature_delta_72h` | Temporal |
| 16 | `wind_speed_mean_24h` | Temporal |
| 17 | `wind_speed_max_24h` | Temporal |

---

## 7. Training Dataset

`data/processed/canonical_training_2015_2024.csv`

| Property | Value |
|---|---|
| Records | 96 |
| Positive events | 61 |
| Background controls | 35 |
| Positive rate | 63.5% |
| Seasons | 9 (2015–16 through 2023–24) |
| Locations | 11 SNOTEL corridors |
| Synthetic | `false` — real CAIC observations and SNOTEL telemetry |

Alongside the 17 model features, each row carries audit columns: `event_id`,
`season`, `source`, `label_source`, `label_type`, `trigger_category`,
`weather_source`, `terrain_source`, `data_quality`, `synthetic`,
`station_distance_km`, `station_elevation_difference_m`,
`station_match_quality`, `dem_resolution_m`, `timestamp_precision`, and the
`avalanche_occurred` label.

Companion datasets: `canonical_training_2021_2024.csv` (recent-seasons subset)
and `canonical_spike_sample.csv` (development sample).

> [!WARNING]
> The 63.5% positive rate does not reflect the true base rate of avalanche
> occurrence. This is a case-control corpus of confirmed events plus sampled
> background conditions, so absolute probabilities are not field frequencies.
> See [SCIENTIFIC_VALIDATION.md](./SCIENTIFIC_VALIDATION.md).

---

## 8. Spatial Interpolation

Configured in `config/spatial.yaml`, implemented in `ml/spatial/idw.py`.

### Method

Inverse Distance Weighting with haversine ground distances:

```text
w_i = 1 / d_i^p          (p = 2.0)
value = Σ(w_i · v_i) / Σ(w_i)
```

Stations are ranked by distance, filtered to those within
`search_radius_km` (default 35 km), and capped at `max_stations` (6). If no
station falls within the radius, the nearest is used and the result is flagged
as outside-radius.

### Quality Bands

| Band | Criteria |
|---|---|
| `EXCELLENT` | ≥ 3 stations within 15 km |
| `GOOD` | ≥ 2 stations within 25 km |
| `DEGRADED` | Within 50 km |

### Ordering Guarantee

Physical variables are interpolated **first**, then the model is evaluated per
grid cell. Probabilities are never interpolated — spatially averaging model
outputs would smooth away the sharp risk gradients that matter operationally.

### Computation Guards

`max_bbox_span_degrees: 1.5`, `max_grid_points: 625`,
`min_grid_spacing_degrees: 0.02`, `max_search_radius_km: 80.0`. Requests
exceeding any limit are rejected with `422`.

### LOSO Validation Results

Leave-One-Station-Out error, from `reports/evaluation/spatial_validation.json`:

| Variable | MAE | RMSE | Bias | Stations |
|---|---|---|---|---|
| `temperature` | 4.23 °C | 4.73 | +0.47 | 8 |
| `snow_water_equivalent` | 81.51 mm | 87.04 | +7.90 | 8 |
| `snowfall_24h` | 0.00 mm | 0.00 | 0.00 | 8 |

A 4.23 °C mean temperature error is substantial relative to the risk engine's
3.0 °C thermal trigger — interpolated values near a rule boundary should be
treated as uncertain. The 0.00 snowfall error reflects a window in which
observed 24h snowfall was uniformly zero across stations, so it demonstrates
nothing about interpolation skill for that variable.

---

## 9. Data Acquisition Scripts

`ml/data_acquisition/`

| Script | Purpose |
|---|---|
| `fetch_snotel.py` | Retrieve SNOTEL station telemetry |
| `fetch_caic.py` | Retrieve CAIC avalanche observation records |
| `spatial_joiner.py` | Join events to nearest station telemetry and DEM terrain |
| `expand_historical_dataset.py` | Extend the corpus across additional seasons |
| `eda_report.py` | Exploratory data analysis output |

---

## 10. Reference Geography Data

| Path | Contents |
|---|---|
| `data/geography/colorado/` | Colorado stations, zones, historical events |
| `data/geography/india/` | Himalayan peaks, regions, terrain (catalog only — no trained model) |
| `data/terrain/mountain_passes.json` | Verified mountain pass polygons |
| `data/terrain/contours_20m_50m_100m.json` | Topographic contour vectors at three intervals |

Indian Himalayan data is served through `/geography/india/*` as a geographic
reference catalog. **No model is trained on Himalayan data**, and the console
labels this region accordingly.
