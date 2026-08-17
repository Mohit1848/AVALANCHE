# API Reference

FastAPI service — **Avalanche Risk Intelligence API**, version
`2.0.0-research`.

Base URL: `http://localhost:8000`
Interactive docs: `/docs` (Swagger UI) · `/redoc` (ReDoc)
OpenAPI schema: `/openapi.json`

Every response carries a `disclaimer` field. The service is a research
decision-support prototype, not a certified warning authority.

---

## 1. Endpoint Index

| Method | Path | Purpose |
|---|---|---|
| `GET` | [`/`](#21-get-) | Service identity |
| `GET` | [`/health`](#22-get-health) | Subsystem diagnostics |
| `POST` | [`/predict/point`](#31-post-predictpoint) | Risk for a coordinate |
| `POST` | [`/predict/telemetry`](#32-post-predicttelemetry) | Risk from an observation stream |
| `GET` | [`/predictions`](#33-get-predictions) | Prediction history |
| `GET` | [`/predictions/{prediction_id}`](#34-get-predictionsprediction_id) | Single audit record |
| `GET` | [`/telemetry/status`](#41-get-telemetrystatus) | Freshness across stations |
| `GET` | [`/telemetry/{station_id}/history`](#42-get-telemetrystation_idhistory) | Station observations |
| `POST` | [`/telemetry/ingest`](#43-post-telemetryingest) | Validate and store readings |
| `POST` | [`/telemetry/trigger-cycle`](#44-post-telemetrytrigger-cycle) | Run prediction cycle |
| `GET` | [`/model/metadata`](#51-get-modelmetadata) | Model version and metrics |
| `GET` | [`/model/scientific-evaluation`](#52-get-modelscientific-evaluation) | Full validation report |
| `GET` | [`/model/zones`](#53-get-modelzones) | Forecast zones |
| `GET` | [`/model/stations`](#54-get-modelstations) | SNOTEL stations |
| `GET` | [`/model/events`](#55-get-modelevents) | Historical CAIC events |
| `POST` | [`/spatial/predict/spatial`](#61-post-spatialpredictspatial) | Interpolated risk surface |
| `GET` | [`/spatial/zones`](#62-get-spatialzones) | Aggregated zone risk |
| `GET` | [`/spatial/terrain`](#63-get-spatialterrain) | Pass polygons and contours |
| `GET` | [`/spatial/validation`](#64-get-spatialvalidation) | LOSO interpolation metrics |
| `GET` | [`/geography/india/peaks`](#71-indian-himalayas) | Himalayan peak catalog |
| `GET` | [`/geography/india/peaks/{peak_id}`](#71-indian-himalayas) | Single peak |
| `GET` | [`/geography/india/regions`](#71-indian-himalayas) | Himalayan regions |
| `GET` | [`/geography/india/terrain`](#71-indian-himalayas) | Terrain availability |
| `GET` | [`/geography/colorado/stations`](#72-colorado-reference) | Colorado stations |
| `GET` | [`/geography/colorado/zones`](#72-colorado-reference) | Colorado zones |
| `GET` | [`/geography/colorado/events`](#72-colorado-reference) | Colorado events |

---

## 2. System

### 2.1 `GET /`

Service identity and status.

```json
{
  "service": "Avalanche Risk Intelligence API",
  "version": "2.0.0-research",
  "status": "online",
  "docs": "/docs",
  "disclaimer": "Research Decision-Support Service. Not certified as a standalone warning authority."
}
```

### 2.2 `GET /health`

Granular subsystem diagnostics. Use this before trusting any prediction — it
reveals whether a real model artifact is loaded and whether telemetry is fresh.

```json
{
  "status": "degraded",
  "service": "avalanche-risk-intelligence-api",
  "version": "2.0.0-research",
  "subsystems": {
    "api": "ok", "model": "ok", "database": "ok",
    "ingestion": "ok", "telemetry": "STALE",
    "risk_engine": "ok", "schema": "SYNCHRONIZED"
  },
  "model_loaded": true,
  "model_version": "calibrated_random_forest_2015_2024",
  "feature_schema_version": "v2_spatiotemporal_17f",
  "calibrated": true,
  "active_operating_threshold": 0.4,
  "thresholds": { "medium": 0.4, "high": 0.7 },
  "schema_status": "SYNCHRONIZED",
  "telemetry_age_minutes": 38
}
```

| Field | Meaning |
|---|---|
| `status` | `ok` when all subsystems nominal; `degraded` when any is impaired |
| `schema_status` | `SYNCHRONIZED`, `SCHEMA_WARNING`, `FALLBACK_INITIALIZED`, `INVALID_ARTIFACT`, or `LOAD_ERROR: …` |
| `subsystems.telemetry` | `GOOD` / `DEGRADED` / `STALE` |

> [!IMPORTANT]
> `schema_status: FALLBACK_INITIALIZED` means **no trained model artifact is
> loaded** and predictions come from the heuristic fallback path. Verify this
> field before interpreting output as model-derived.

---

## 3. Prediction

### 3.1 `POST /predict/point`

Evaluate risk for specific coordinates with directly supplied conditions.

**Request** — `PointPredictionRequest`. Only `latitude` and `longitude` are
required.

| Field | Type | Range | Default |
|---|---|---|---|
| `latitude` | float | −90 … 90 | **required** |
| `longitude` | float | −180 … 180 | **required** |
| `elevation` | float | 0 … 9000 | 3400.0 |
| `slope` | float | 0 … 90 | `null` |
| `aspect` | float | 0 … 360 (0 = N) | `null` |
| `temperature` | float | −80 … 60 °C | `null` |
| `humidity` | float | 0 … 100 % | 70.0 |
| `pressure` | float | 300 … 1100 hPa | 670.0 |
| `precipitation` | float | 0 … 500 mm | 0.0 |
| `snow_depth` | float | 0 … 2000 cm | `null` |
| `snow_water_equivalent` | float | 0 … 5000 mm | `null` |
| `snowfall_6h` | float | 0 … 500 mm | 0.0 |
| `snowfall_24h` | float | 0 … 1000 mm | 0.0 |
| `snowfall_72h` | float | 0 … 2000 mm | 0.0 |
| `temperature_delta_24h` | float | −50 … 50 °C | 0.0 |
| `temperature_delta_72h` | float | −50 … 50 °C | 0.0 |
| `wind_speed_mean_24h` | float | 0 … 300 km/h | 0.0 |
| `wind_speed_max_24h` | float | 0 … 400 km/h | 0.0 |
| `location_id` | string | — | `"POINT_QUERY"` |

> [!NOTE]
> `slope` and `temperature` are the risk engine's **critical features**.
> Omitting either yields `INSUFFICIENT_DATA` with null scores, regardless of
> how complete the rest of the payload is.

**Example**

```bash
curl -X POST http://localhost:8000/predict/point \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 39.6403, "longitude": -105.8767,
    "elevation": 3600, "slope": 38, "aspect": 45,
    "temperature": -4.5, "snow_depth": 180,
    "snow_water_equivalent": 420,
    "snowfall_24h": 65, "snowfall_72h": 110,
    "temperature_delta_24h": 7.5,
    "wind_speed_mean_24h": 45, "wind_speed_max_24h": 90,
    "location_id": "LOVELAND_PASS"
  }'
```

**Response** — `RiskPredictionResponse`

```json
{
  "model_risk_score": 85.0,
  "final_risk_score": 85.0,
  "model_risk_level": "HIGH",
  "final_risk_level": "HIGH",
  "risk_level": "HIGH",
  "risk_escalated": false,
  "risk_escalation_reasons": [
    "Deterministic Engineering Rule: Heavy snowfall (24h=65.0mm, 72h=110.0mm) on steep starting zone (38.0°)."
  ],
  "data_quality": "GOOD",
  "warnings": ["..."],
  "raw_probability": 0.85,
  "calibrated_probability": 0.85,
  "model_version": "calibrated_random_forest_2015_2024",
  "operating_threshold": 0.4,
  "thresholds": { "medium": 0.4, "high": 0.7 },
  "provenance": {
    "source": "CAIC_SNOTEL_DEM_v2",
    "model_architecture": "CalibratedRandomForest",
    "calibration_strategy": "TimeSeriesSplit",
    "feature_schema_version": "v2_spatiotemporal_17f",
    "location_id": "LOVELAND_PASS",
    "timestamp": "LIVE",
    "synthetic": false
  }
}
```

Field semantics are documented in
[RISK_ENGINE.md §7](./RISK_ENGINE.md#7-output-schema--riskresult). Note that
`risk_escalated` means *policy changed the level*, not *a rule matched*.

### 3.2 `POST /predict/telemetry`

Ingest a time-series stream, derive backward-looking 6h/24h/72h features, and
evaluate risk. Use this rather than `/predict/point` when you have raw
observations and want the service to compute rolling features.

**Request** — `StationTelemetryBatchRequest`

| Field | Type | Notes |
|---|---|---|
| `station_id` | string | **required** |
| `latitude`, `longitude`, `elevation` | float | **required** |
| `observations` | array | **required**, ≥1 `TelemetryObservation` |
| `station_name` | string | optional |
| `default_slope` | float | default 36.0 |
| `default_aspect` | float | default 45.0 |
| `target_timestamp` | string | optional; filters strictly to `T_obs <= T_target` |

`TelemetryObservation` — `timestamp` required (ISO-8601); optional
`temperature`, `snow_depth`, `snow_water_equivalent`, `precipitation`,
`wind_speed`.

```bash
curl -X POST http://localhost:8000/predict/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "station_id": "335", "station_name": "Berthoud Summit",
    "latitude": 39.798, "longitude": -105.778, "elevation": 3444,
    "default_slope": 38.0, "default_aspect": 45.0,
    "observations": [
      {"timestamp": "2024-01-14T00:00:00Z", "temperature": -8.0, "snow_water_equivalent": 380, "snow_depth": 165, "precipitation": 0.0, "wind_speed": 20},
      {"timestamp": "2024-01-15T00:00:00Z", "temperature": -5.5, "snow_water_equivalent": 405, "snow_depth": 178, "precipitation": 18.0, "wind_speed": 48},
      {"timestamp": "2024-01-16T00:00:00Z", "temperature": -3.0, "snow_water_equivalent": 438, "snow_depth": 192, "precipitation": 22.0, "wind_speed": 65}
    ]
  }'
```

Returns the same `RiskPredictionResponse` shape, with coverage warnings
appended when the stream spans under 24h or 72h.

### 3.3 `GET /predictions`

Persisted prediction history.

| Query | Type | Default |
|---|---|---|
| `station_id` | string | all stations |
| `risk_level` | string | all levels |
| `limit` | int | service default |

### 3.4 `GET /predictions/{prediction_id}`

Complete audit record for one prediction, including the full input feature
vector, all four version fields, escalation reasons, and provenance.

---

## 4. Telemetry

### 4.1 `GET /telemetry/status`

System-wide freshness. Returns `overall_status`, `last_update`, `age_minutes`,
station counts, a `warnings` array, and per-station `station_reports`.

Freshness bands are documented in
[DATA_PIPELINE.md §5](./DATA_PIPELINE.md#5-stage-4--freshness-gating).

### 4.2 `GET /telemetry/{station_id}/history`

Chronological normalized observations for one station.

| Query | Type | Notes |
|---|---|---|
| `start_ts` | string | ISO-8601 lower bound |
| `end_ts` | string | ISO-8601 upper bound |
| `limit` | int | maximum records |

### 4.3 `POST /telemetry/ingest`

Validate physical ranges, normalize timestamps, attach provenance, and persist.

| Parameter | In | Required |
|---|---|---|
| `station_id` | query | **yes** |

Body is an observation array. Out-of-range values are stored as `null` with a
warning; records with missing or malformed timestamps are rejected outright.
Re-ingesting the same `(station_id, timestamp)` overwrites rather than
duplicates.

### 4.4 `POST /telemetry/trigger-cycle`

Run an automated prediction cycle across all enabled stations: pull up to 72
recent observations per station, generate features, run inference and policy,
and persist each result to `prediction_history`.

---

## 5. Model Metadata

### 5.1 `GET /model/metadata`

Active model version, training provenance, metrics, and feature importance.

> [!WARNING]
> The metric values on this endpoint are **hardcoded in
> `api/routes/model.py`** and disagree with the generated reports served by
> `/model/scientific-evaluation`. See
> [SCIENTIFIC_VALIDATION.md §7](./SCIENTIFIC_VALIDATION.md#7-known-inconsistencies).

### 5.2 `GET /model/scientific-evaluation`

Full validation report assembled from `reports/evaluation/`:

| Key | Source file |
|---|---|
| `metrics` | `metrics.json` |
| `calibration` | `calibration.json` |
| `threshold_tradeoffs` | `threshold_analysis.csv` |
| `model_comparison` | `model_comparison.csv` |
| `feature_stability` | `feature_stability.csv` |
| `spatial_validation` | `spatial_validation.json` |

Missing report files yield empty sections rather than an error.

### 5.3 `GET /model/zones`

Seven Colorado forecast zones with centers, elevation ranges, and reference
stations.

### 5.4 `GET /model/stations`

Ten SNOTEL stations with coordinates, elevation, and zone assignment.

### 5.5 `GET /model/events`

Field-verified historical CAIC avalanche observations for map overlay.

| Query | Values |
|---|---|
| `season` | e.g. `2023-2024`, or `ALL` |
| `trigger` | e.g. `NATURAL`, `HUMAN`, `EXPLOSIVE`, or `ALL` |

Each record carries `label_type: "HISTORICAL_OBSERVED_EVENT"` and
`source: "CAIC_OBSERVATION"` — these are observed events, not predictions.

---

## 6. Spatial Intelligence

### 6.1 `POST /spatial/predict/spatial`

Interpolate physical features across a bounding box and evaluate risk per grid
cell.

| Field | Type | Default |
|---|---|---|
| `min_latitude`, `max_latitude` | float | **required** |
| `min_longitude`, `max_longitude` | float | **required** |
| `grid_spacing_degrees` | float | 0.04 |
| `search_radius_km` | float | 35.0 |
| `power` | float | 2.0 |
| `interpolation_method` | string | `"IDW"` |
| `target_timestamp` | string | `null` |

```bash
curl -X POST http://localhost:8000/spatial/predict/spatial \
  -H "Content-Type: application/json" \
  -d '{"min_latitude": 39.4, "max_latitude": 39.9,
       "min_longitude": -106.2, "max_longitude": -105.6,
       "grid_spacing_degrees": 0.05}'
```

Requests exceeding `config/spatial.yaml` computation limits (bbox span > 1.5°,
> 625 grid points, spacing < 0.02°, radius > 80 km) are rejected with `422`.

### 6.2 `GET /spatial/zones`

Aggregated risk and spatial data quality per forecast zone. Optional
`target_timestamp` query for historical evaluation.

### 6.3 `GET /spatial/terrain`

Verified mountain pass polygons and contour vectors (20m/50m/100m) with
provenance.

### 6.4 `GET /spatial/validation`

Leave-One-Station-Out interpolation error metrics — see
[DATA_PIPELINE.md §8](./DATA_PIPELINE.md#8-spatial-interpolation).

---

## 7. Geography

### 7.1 Indian Himalayas

| Endpoint | Query params |
|---|---|
| `GET /geography/india/peaks` | `region`, `state`, `search` |
| `GET /geography/india/peaks/{peak_id}` | — |
| `GET /geography/india/regions` | — |
| `GET /geography/india/terrain` | — |

> [!IMPORTANT]
> Himalayan endpoints serve a **geographic reference catalog only**. No model
> is trained on Himalayan data and no risk predictions are available for this
> region.

### 7.2 Colorado Reference

`GET /geography/colorado/stations`, `/zones`, `/events` — reference views of
the Colorado corridors.

---

## 8. Error Handling

Handlers in `api/main.py` return structured JSON with error codes; internal
paths and stack traces are never exposed.

### `422` — Validation Failure

```json
{
  "error": "Validation Error",
  "error_code": "INVALID_PAYLOAD_SCHEMA",
  "detail": "Input payload failed schema validation.",
  "validation_errors": ["body -> latitude: Input should be less than or equal to 90"],
  "disclaimer": "Research Decision-Support Service. Not certified as a standalone warning authority."
}
```

### `500` — Internal Error

```json
{
  "error": "Internal Processing Error",
  "error_code": "SERVER_ERROR",
  "detail": "An internal server error occurred while processing the request.",
  "disclaimer": "Research Decision-Support Service. Not certified as a standalone warning authority."
}
```

---

## 9. Client Integration Notes

1. **Check `/health` first.** Confirm `schema_status` is not
   `FALLBACK_INITIALIZED` before treating results as model-derived.
2. **Handle `INSUFFICIENT_DATA`.** `model_risk_score` and `final_risk_score`
   are `null` in this state; a client that assumes a number will fail.
3. **Read both risk levels.** `model_risk_level` and `final_risk_level` differ
   whenever policy escalates. Display the final level, but keep the model level
   available for audit.
4. **Respect `data_quality`.** `DEGRADED` means features were missing;
   communicate that rather than presenting the score as fully supported.
5. **Persist the provenance block.** Without the version fields, a stored
   prediction cannot be reinterpreted after the model changes.
6. **CORS is fully open** (`allow_origins=["*"]`), appropriate for localhost
   research only.
