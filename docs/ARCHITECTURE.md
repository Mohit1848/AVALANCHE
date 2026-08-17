# Architecture

How the system is decomposed, how a request flows through it, and which module
owns each responsibility.

Related: [DATA_PIPELINE.md](./DATA_PIPELINE.md) ·
[RISK_ENGINE.md](./RISK_ENGINE.md) · [API_REFERENCE.md](./API_REFERENCE.md)

---

## 1. Design Principles

| Principle | Consequence in the code |
|---|---|
| **Backend is the single source of truth** | The frontend never computes probabilities, thresholds, or escalations. It renders what the API returns. |
| **Policy is separated from prediction** | `inference_service` produces a probability; `risk_engine` decides the operational level. Both are returned separately. |
| **Fail safe, not silent** | Missing critical features yield `INSUFFICIENT_DATA` rather than a fabricated score. |
| **Strict temporal isolation** | Feature windows filter `T_obs <= T_target`, so no future observation can leak into a past prediction. |
| **Provenance travels with data** | Every observation and prediction carries source, version, and validation metadata. |

---

## 2. Component Topology

```text
┌─────────────────────────────────────────────────────────────────┐
│  CONFIGURATION                                                   │
│  config/stations.yaml  ·  config/spatial.yaml                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ drives
┌────────────────────────────▼────────────────────────────────────┐
│  INGESTION LAYER          services/ingestion/                    │
│  snotel_worker.py  →  validator.py  →  storage.py                │
│                       (physical bounds,   (SQLite:               │
│                        UTC normalize,      telemetry_observations│
│                        provenance)         prediction_history)   │
│                             ↓                                    │
│                       scheduler.py  (freshness gating: GOOD /    │
│                                      DEGRADED / STALE)           │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  FEATURE LAYER            api/services/feature_service.py        │
│  Rolling 6h/24h/72h windows · cyclic aspect encoding ·           │
│  temperature deltas · wind aggregation → 17-feature vector       │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
┌─────────────▼─────────────┐  ┌────────────▼─────────────────────┐
│  SPATIAL LAYER            │  │  INFERENCE LAYER                 │
│  ml/spatial/idw.py        │  │  api/services/inference_service  │
│  IDW interpolation of     │  │  Calibrated Random Forest        │
│  PHYSICAL features, then  │  │  (CalibratedClassifierCV)        │
│  per-cell model inference │  │  → raw + calibrated probability  │
└─────────────┬─────────────┘  └────────────┬─────────────────────┘
              │                             │
              └──────────────┬──────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  POLICY LAYER             ml/risk_engine.py                      │
│  Data-quality assessment · 3 deterministic escalation rules ·    │
│  fail-safe states → final_risk_level + escalation reasons        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  API LAYER                api/main.py + api/routes/*             │
│  26 REST endpoints · CORS · sanitized error handlers             │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON
┌────────────────────────────▼────────────────────────────────────┐
│  PRESENTATION             frontend/ (React 19 + TS + Leaflet)    │
│  5 console tabs · GIS overlays · audit timeline                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Layer Responsibilities

### 3.1 Configuration Layer

Stations are enabled and parameterized entirely through YAML — no code change
is needed to add, remove, or retune a station.

**`config/stations.yaml`** — 10 Colorado SNOTEL stations, each with:
`station_id`, `station_triplet`, `name`, `zone_id`, latitude/longitude,
`elevation_m`, `enabled`, `default_slope_deg`, `default_aspect_deg`, and the
list of `available_variables` (`TOBS`, `SNWD`, `WTEQ`, `PREC`).

**`config/spatial.yaml`** — IDW parameters and safety limits:

| Group | Keys |
|---|---|
| `idw` | `power: 2.0`, `default_search_radius_km: 35.0`, `min_stations: 2`, `max_stations: 6` |
| `quality_thresholds` | Distance/station-count bands for `EXCELLENT` / `GOOD` / `DEGRADED` |
| `computation_limits` | `max_bbox_span_degrees: 1.5`, `max_grid_points: 625`, `min_grid_spacing_degrees: 0.02`, `max_search_radius_km: 80.0` |
| `zone_aggregation` | Risk score thresholds (70.0 high, 40.0 medium) and `high_risk_area_escalation_fraction: 0.25` |

The `computation_limits` block is a denial-of-service guard: requests exceeding
these bounds are rejected with `422` rather than allowed to expand into an
unbounded grid computation.

### 3.2 Ingestion Layer — `services/ingestion/`

| Module | Responsibility |
|---|---|
| `snotel_worker.py` | Loads enabled stations, fetches/seeds telemetry batches |
| `validator.py` | Enforces physical bounds, normalizes timestamps to ISO-8601 UTC, attaches provenance |
| `storage.py` | SQLite persistence — `telemetry_observations` and `prediction_history` tables |
| `scheduler.py` | Computes telemetry age, assigns freshness state, runs live prediction cycles |

Out-of-range values are **nulled with a recorded warning**, never clamped —
clamping would silently manufacture a plausible-looking reading.

### 3.3 Feature Layer — `api/services/feature_service.py`

Two entry points:

- `enrich_point_features()` — for direct coordinate queries; adds cyclic aspect
  encoding (`aspect_sin`, `aspect_cos`).
- `process_telemetry_batch()` — for time-series streams; sorts chronologically,
  deduplicates by timestamp, filters to `T_obs <= T_target`, then derives
  rolling 6h/24h/72h aggregations.

Coverage shortfalls degrade quality rather than fail: a stream spanning under
24h emits a warning that 24h/72h features may be underestimated.

### 3.4 Spatial Layer — `ml/spatial/`

| Module | Role |
|---|---|
| `idw.py` | Inverse Distance Weighting interpolator, haversine distances |
| `kriging.py` | Alternative geostatistical interpolation |
| `uncertainty.py` | Interpolation uncertainty quantification |
| `validation.py` | Leave-One-Station-Out (LOSO) cross-validation |

**Critical ordering:** IDW interpolates *physical variables* (temperature, SWE,
snowfall) across space, and the model is then run per grid cell. Probabilities
are never themselves interpolated — averaging probabilities would smooth away
exactly the sharp gradients that matter operationally.

### 3.5 Inference Layer — `api/services/inference_service.py`

A singleton `AvalancheInferenceEngine` loads the model artifact at import and
exposes a canonical 17-feature schema (`v2_spatiotemporal_17f`):

```text
slope, aspect_sin, aspect_cos, elevation,
temperature, humidity, pressure, precipitation,
snow_depth, snow_water_equivalent,
snowfall_6h, snowfall_24h, snowfall_72h,
temperature_delta_24h, temperature_delta_72h,
wind_speed_mean_24h, wind_speed_max_24h
```

Artifact loading is defensive, with an explicit status for each outcome:

| `schema_status` | Meaning |
|---|---|
| `SYNCHRONIZED` | Artifact loaded; features match the canonical schema |
| `SCHEMA_WARNING` | Artifact loaded but its feature set differs from canonical |
| `FALLBACK_INITIALIZED` | No artifact on disk; heuristic scoring path active |
| `INVALID_ARTIFACT` | File present but not a valid artifact dict |
| `LOAD_ERROR: …` | Exception during load, message retained |

When no artifact exists the engine runs an additive heuristic (base 0.08, with
increments for slope ≥34°/≥38°, 24h snowfall ≥15mm, 72h snowfall ≥30mm, and 24h
temperature rise ≥4°C, capped at 0.95). This keeps the API demonstrable without
a trained model — and it is **not** a validated model. Check `/health` for
`schema_status` before treating output as model-derived.

### 3.6 Policy Layer — `ml/risk_engine.py`

Documented in full in [RISK_ENGINE.md](./RISK_ENGINE.md). In summary: assesses
data quality, applies three deterministic escalation rules, and returns a
`RiskResult` carrying both the model level and the final policy level with
human-readable escalation reasons.

### 3.7 API Layer — `api/`

`main.py` mounts six routers and installs two exception handlers that return
structured JSON error codes (`INVALID_PAYLOAD_SCHEMA`, `SERVER_ERROR`) instead
of stack traces — internal paths and framework internals are never leaked to
clients. CORS is currently `allow_origins=["*"]`, appropriate for local
research use only.

| Router | Prefix | Endpoints |
|---|---|---|
| `health` | — | 1 |
| `prediction` | — | 4 |
| `telemetry` | `/telemetry` | 4 |
| `model` | `/model` | 5 |
| `spatial` | `/spatial` | 4 |
| `geography` | `/geography` | 7 |

### 3.8 Presentation Layer — `frontend/`

React 19 + TypeScript, Vite build, Leaflet mapping, Recharts plotting, Tailwind
styling. `src/services/api.ts` is the single HTTP boundary — all backend access
funnels through it against `API_BASE_URL = 'http://localhost:8000'`.

Components are organized by domain: `map/`, `risk/`, `spatial/`, `history/`,
`model/`, `terrain/`, `snowpack/`, `weather/`, `telemetry/`, `india/`, `common/`.

---

## 4. Request Lifecycle: `POST /predict/point`

```text
1. FastAPI validates payload against PointPredictionRequest
       └─ out-of-range value → 422 INVALID_PAYLOAD_SCHEMA
2. enrich_point_features()      → adds aspect_sin / aspect_cos
3. inference_engine.predict_risk()
       ├─ align dict to the 17 canonical feature columns
       ├─ pipeline present  → predict_proba → calibrated + raw probability
       └─ pipeline absent   → additive heuristic fallback
4. evaluate_safety_policy()  →  ml/risk_engine.evaluate_risk()
       ├─ assess_data_quality()      → GOOD | DEGRADED | INSUFFICIENT
       ├─ short-circuit if INSUFFICIENT or probability is None
       └─ apply_safety_escalations() → 3 deterministic rules
5. Assemble RiskPredictionResponse with provenance block
6. Return JSON
```

A worked example of step 4 appears in
[RISK_ENGINE.md §5](./RISK_ENGINE.md#5-worked-example).

---

## 5. Versioning Surfaces

Four independent versions are reported so a stored prediction remains
interpretable after any component changes:

| Version | Current value | Set in |
|---|---|---|
| Model version | `calibrated_random_forest_2015_2024` | Artifact, or engine default |
| Feature schema | `v2_spatiotemporal_17f` | `inference_service.py` |
| Risk engine | `2.0.0` | `scheduler.py` prediction record |
| Dataset | `2015_2024_expanded` | `scheduler.py` prediction record |

---

## 6. Known Architectural Constraints

1. **Singleton inference engine.** Instantiated at module import. Replacing the
   model requires a process restart; there is no hot-reload path.
2. **Module-import side effect.** `scheduler.py` calls
   `seed_initial_telemetry_from_dataset()` at import time, so importing the
   module writes to the database.
3. **Hardcoded frontend API base.** `API_BASE_URL` is a literal in
   `src/services/api.ts`, not an environment variable — the frontend cannot be
   pointed at a non-local backend without a code edit.
4. **Two metric sources.** `/model/metadata` returns hardcoded metrics while
   `/model/scientific-evaluation` reads generated report files; the two
   disagree. See
   [SCIENTIFIC_VALIDATION.md §7](./SCIENTIFIC_VALIDATION.md#7-known-inconsistencies).
5. **Permissive CORS.** `allow_origins=["*"]` with `allow_credentials=True` is
   acceptable for localhost research only and must be tightened before any
   networked deployment.
