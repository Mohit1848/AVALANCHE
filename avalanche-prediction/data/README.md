# Dataset Architecture & Provenance

Describes the data present in this directory, the schema it follows, and its
known limitations.

> [!CAUTION]
> **The dataset is real but its negative class is not representative.**
> 96 records of genuine CAIC observations and SNOTEL telemetry are present
> (`synthetic = false`). However, the 35 background controls are drawn from
> calm, dry days on terrain below the avalanche release angle, which makes the
> classification task trivially separable. No claim about real-world detection
> accuracy can be supported until matched controls replace them. See
> [../../docs/SCIENTIFIC_VALIDATION.md §6](../../docs/SCIENTIFIC_VALIDATION.md#6-the-separability-problem).

---

## 1. Directory Contents

| Path | Contents |
|---|---|
| `processed/canonical_training_2015_2024.csv` | Primary corpus — 96 records, 9 seasons |
| `processed/canonical_training_2021_2024.csv` | Recent-seasons subset |
| `processed/canonical_spike_sample.csv` | Small development sample |
| `raw/caic/`, `raw/caic_sample_events_2023.csv` | CAIC avalanche observations |
| `raw/snotel_stations_co.csv` | SNOTEL station reference |
| `terrain/mountain_passes.json` | Verified mountain pass polygons |
| `terrain/contours_20m_50m_100m.json` | Topographic contours at three intervals |
| `geography/colorado/` | Colorado stations, zones, events |
| `geography/india/` | Himalayan peaks, regions, terrain (catalog only) |
| `avalanche_telemetry.db` | SQLite runtime store (generated, not source data) |

---

## 2. Primary Corpus

`processed/canonical_training_2015_2024.csv`

| Property | Value |
|---|---|
| Records | 96 |
| Positive (avalanche observed) | 61 (63.5%) |
| Background controls | 35 (36.5%) |
| Seasons | 9 (2015–16 … 2023–24) |
| Temporal range | 2015-11-20 → 2024-04-18 |
| Locations | 11 SNOTEL corridors |
| Synthetic | `false` |

> [!WARNING]
> The 63.5% positive rate is a **case-control sampling artifact**, not the
> field base rate of avalanche occurrence. Model probabilities therefore do not
> correspond to real-world event frequencies.

### 2.1 Class Composition by Trigger

| Trigger category | Positive | Negative |
|---|---|---|
| `HUMAN_TRIGGERED` | 34 | 0 |
| `NATURAL` | 22 | 0 |
| `EXPLOSIVE` | 5 | 0 |
| `NONE` | 0 | 35 |

### 2.2 Class Separation

The positive and negative classes do not overlap at all on three features:

| Feature | Negative range | Positive range |
|---|---|---|
| `slope` | 18.0 – 25.0° | 34.0 – 44.0° |
| `humidity` | 38.0 – 52.0% | 62.0 – 92.0% |
| `wind_speed_max_24h` | 16.0 – 24.0 km/h | 28.0 – 80.0 km/h |

`slope >= 34` alone classifies all 96 records correctly. This is the central
limitation of the corpus and the reason every reported model metric is 100%.

---

## 3. Schema

### 3.1 Model Features (17) — `v2_spatiotemporal_17f`

| Group | Columns |
|---|---|
| Terrain | `slope`, `aspect_sin`, `aspect_cos`, `elevation` |
| Meteorological | `temperature`, `humidity`, `pressure`, `precipitation` |
| Snowpack | `snow_depth`, `snow_water_equivalent` |
| Temporal | `snowfall_6h`, `snowfall_24h`, `snowfall_72h`, `temperature_delta_24h`, `temperature_delta_72h`, `wind_speed_mean_24h`, `wind_speed_max_24h` |

Aspect is cyclically encoded so that 359° and 1° are near-neighbours rather
than opposite extremes.

> [!IMPORTANT]
> `humidity` and `pressure` are **not measured at inference time**. The live
> pipeline hardcodes `humidity = 70.0` (SNOTEL does not report relative
> humidity) and derives `pressure` from elevation. Their training-set
> importance is an artifact and should not be read as a physical finding.

### 3.2 Provenance & Audit Columns

| Column | Meaning |
|---|---|
| `timestamp` | ISO-8601 UTC observation time |
| `latitude`, `longitude`, `location_id` | Spatial identity |
| `event_id` | CAIC event identifier (positives) |
| `season` | Winter season label |
| `source`, `label_source`, `label_type` | Data and label origin |
| `trigger_category` | `NATURAL` / `HUMAN_TRIGGERED` / `EXPLOSIVE` / `NONE` |
| `weather_source`, `terrain_source` | Feature provenance |
| `data_quality` | `GOOD` / `DEGRADED` / `INSUFFICIENT` |
| `synthetic` | `false` throughout |
| `station_distance_km` | Event-to-station distance |
| `station_elevation_difference_m` | Elevation mismatch |
| `station_match_quality` | Spatial join confidence |
| `dem_resolution_m` | DEM source resolution (Copernicus GLO-30) |
| `timestamp_precision` | Temporal resolution of the record |
| `avalanche_occurred` | Binary label — 0 background, 1 observed event |

---

## 4. Features Not Currently Available

| Desired feature | Status |
|---|---|
| `wind_direction` | **Absent** — no genuine wind-loading assessment is possible without it |
| `snow_density` | Absent |
| `curvature`, `roughness` | Absent — DEM-derived terrain shape beyond slope/aspect |
| `temperature_delta_6h` | Absent (24h and 72h present) |
| Real `humidity` | Absent — constant at inference |

---

## 5. Data Sources

| Source | Used for |
|---|---|
| **CAIC** (Colorado Avalanche Information Center) | Field observations, event labels, trigger categories |
| **NRCS SNOTEL** | Continuous telemetry — `TOBS`, `SNWD`, `WTEQ`, `PREC` |
| **Copernicus DEM GLO-30** | Slope, aspect, elevation at 30 m resolution |

Additional sources worth incorporating for a rebuilt corpus: EAWS bulletins,
WSL/SLF snowpack profiles, Utah Avalanche Center records, and ECMWF ERA5 /
NOAA HRRR reanalysis for gap-filling meteorology.

---

## 6. Acquisition Pipeline

```bash
cd avalanche-prediction
.venv/Scripts/python.exe -m ml.data_acquisition.fetch_snotel
.venv/Scripts/python.exe -m ml.data_acquisition.fetch_caic
.venv/Scripts/python.exe -m ml.data_acquisition.spatial_joiner
.venv/Scripts/python.exe -m ml.data_acquisition.expand_historical_dataset
.venv/Scripts/python.exe -m ml.data_acquisition.eda_report
```

`ml/synthetic_data.py` generates synthetic records for pipeline testing only.
Synthetic data must never enter a training corpus used for reported metrics —
the `synthetic` column exists to make any such contamination detectable.

---

## 7. Remediation Checklist

Ordered by impact on scientific validity:

1. [ ] **Rebuild the negative class with matched controls** — storm days at the
       same stations, seasons, and slope angles as the positives, where no
       release occurred. Prerequisite for everything below.
2. [ ] Expand the corpus substantially beyond n=96.
3. [ ] Source real humidity and wind-direction telemetry, or drop the features
       that depend on them.
4. [ ] Extend beyond a single snow climate before making transferability
       claims.
5. [ ] Re-run leakage-safe temporal and group validation on the rebuilt corpus.
6. [ ] Re-measure calibration — the current result shows sigmoid scaling
       *worsening* reliability, itself a symptom of separability.
7. [ ] Benchmark against the trivial `slope >= 34` baseline.
8. [ ] Obtain domain-expert review of risk thresholds.
