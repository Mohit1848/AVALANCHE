# Development Guide

Setup, running, testing, and troubleshooting. Every command here was executed
against this repository on 2026-08-17; the notices in
[§6](#6-expected-notices-not-bugs) are the ones you should actually expect to
see.

---

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | Backend and ML pipeline |
| Node.js | 20+ | Frontend toolchain (Vite 8) |
| npm | 10+ | Ships with Node |
| Git | any | — |

Platform note: this guide uses Windows paths (`.venv/Scripts/`). On
Linux/macOS substitute `.venv/bin/`.

---

## 2. Initial Setup

### 2.1 Backend

```bash
cd avalanche-prediction
python -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Dependencies: `pandas`, `numpy`, `scikit-learn`, `joblib`, `pytest`, `fastapi`,
`uvicorn`, `pydantic`, `xgboost`, `lightgbm`, `catboost`.

> [!NOTE]
> `requirements.txt` does not pin `pyyaml`, though `config/stations.yaml` and
> `config/spatial.yaml` are loaded at runtime. It resolves transitively today,
> but a clean environment may need `pip install pyyaml` explicitly.

### 2.2 Frontend

```bash
cd frontend
npm install
```

---

## 3. Running the System

Both services must run concurrently — the frontend has no offline mode and
displays an inference-service notice when the backend is unreachable.

### 3.1 Backend (port 8000)

```bash
cd avalanche-prediction
.venv/Scripts/python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Add `--reload` for auto-restart during development. Expected startup:

```text
INFO:     Started server process [38816]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### 3.2 Frontend (port 5173)

```bash
cd frontend
npm run dev
```

```text
VITE v8.2.1  ready in 435 ms
➜  Local:   http://localhost:5173/
```

### 3.3 Entry Points

| Surface | URL |
|---|---|
| GIS Console | http://localhost:5173 |
| API root | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| OpenAPI JSON | http://localhost:8000/openapi.json |

### 3.4 Smoke Test

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/predict/point \
  -H "Content-Type: application/json" \
  -d '{"latitude":39.64,"longitude":-105.88,"slope":38,"temperature":-4.5,
       "snowfall_24h":65,"snowfall_72h":110}'
```

A healthy response returns `final_risk_level: "HIGH"` with a populated
`risk_escalation_reasons` array.

---

## 4. Testing

### 4.1 Backend — 62 tests

```bash
cd avalanche-prediction
.venv/Scripts/python.exe -m pytest          # all
.venv/Scripts/python.exe -m pytest -v       # verbose
.venv/Scripts/python.exe -m pytest tests/test_risk_engine.py -v
```

| Module | Tests | Covers |
|---|---|---|
| `test_spatial.py` | 14 | IDW, kriging, uncertainty, spatial endpoints |
| `test_scientific_validation.py` | 11 | Evaluation framework integrity |
| `test_api.py` | 9 | Endpoint contracts, validation errors |
| `test_live_telemetry.py` | 9 | Ingestion, freshness, storage |
| `test_acquisition_pipeline.py` | 5 | Data acquisition and joining |
| `test_geography.py` | 5 | Geography catalog endpoints |
| `test_preprocessing.py` | 5 | Feature engineering |
| `test_risk_engine.py` | 3 | Escalation rules, fail-safes |
| `test_artifact.py` | 1 | Model artifact loading |

Configuration lives in `pytest.ini` (`testpaths = tests`, `pythonpath = .`).
Run pytest from the `avalanche-prediction/` directory so `pythonpath` resolves.

### 4.2 Frontend — 16 tests

```bash
cd frontend
npx vitest run          # single pass
npx vitest              # watch mode
```

Vitest is configured inside `vite.config.ts` (`environment: 'jsdom'`,
`globals: true`). Tests live in `src/tests/console.test.tsx`.

### 4.3 Current Status

Verified 2026-08-17:

```text
backend:   62 passed, 3 warnings in 5.85s
frontend:  16 passed (1 file) in 2.56s
```

The three backend warnings are third-party deprecations
(`StarletteDeprecationWarning` for `httpx` in the test client and
`HTTP_422_UNPROCESSABLE_ENTITY`), not failures in this codebase.

---

## 5. Other Workflows

### 5.1 Training

```bash
cd avalanche-prediction
.venv/Scripts/python.exe -m ml.train
```

Writes `models/avalanche_baseline.joblib`. The API loads this artifact at
startup — **restart the backend** after retraining, since the inference engine
is a singleton constructed at import.

### 5.2 Regenerating Evaluation Reports

```bash
.venv/Scripts/python.exe -m ml.evaluation.run_all
```

Rewrites `reports/evaluation/`. Individual analyses run as modules, e.g.
`python -m ml.evaluation.calibration`.

### 5.3 Data Acquisition

```bash
.venv/Scripts/python.exe -m ml.data_acquisition.fetch_snotel
.venv/Scripts/python.exe -m ml.data_acquisition.fetch_caic
.venv/Scripts/python.exe -m ml.data_acquisition.spatial_joiner
```

### 5.4 Manual Ingestion Cycle

```bash
.venv/Scripts/python.exe -m services.ingestion.scheduler
```

Prints a freshness report and runs a prediction cycle across enabled stations.

### 5.5 Frontend Build and Lint

```bash
cd frontend
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve the production build
npm run lint       # oxlint
```

---

## 6. Expected Notices (Not Bugs)

Four messages appear on a clean checkout and are all correct behaviour.

### 6.1 Missing Model Artifact

```text
Notice: Model artifact not found at .../models/avalanche_baseline.joblib.
Running research fallback pipeline.
```

No trained artifact is committed. The service runs a heuristic scoring path and
`/health` reports `schema_status: FALLBACK_INITIALIZED`. Run `ml.train` to
produce a real artifact. Predictions in this state are **not model-derived**.

### 6.2 Telemetry Reported as STALE

`/health` returns `"status": "degraded"` with `telemetry: "STALE"`, and all 10
stations report ages around 1.3 million minutes. Seeded observations are real
readings from the 2023–24 season, so the freshness gate correctly classifies
them as stale. See
[DATA_PIPELINE.md §5](./DATA_PIPELINE.md#5-stage-4--freshness-gating).

### 6.3 Console Shows `TELEMETRY: STALE`

The frontend badge reflects §6.2. The console still renders fully and
predictions still resolve.

### 6.4 Perfect Evaluation Metrics

Reports show 100% recall and precision across every fold and threshold. This is
a dataset construction artifact, not model quality — see
[SCIENTIFIC_VALIDATION.md §6](./SCIENTIFIC_VALIDATION.md#6-the-separability-problem).

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: api` | Wrong working directory | Run from `avalanche-prediction/` |
| Backend starts, no response on curl | Bound to the wrong interface, or a sandbox blocked the socket bind | Use `--host 127.0.0.1`; confirm the port is free |
| `Address already in use` | Port 8000 or 5173 occupied | Kill the process or pass a different `--port` |
| Console shows "INFERENCE SERVICE NOTICE" | Backend down or on another port | Start the backend on 8000 — the URL is hardcoded in `src/services/api.ts` |
| `422` on a prediction request | Value outside schema bounds | Check `validation_errors` in the response; see [API_REFERENCE.md §3.1](./API_REFERENCE.md#31-post-predictpoint) |
| `INSUFFICIENT_DATA` with null scores | `slope` or `temperature` missing | Both are critical features; supply them |
| Model changes have no effect | Singleton engine cached at import | Restart the backend |
| `yaml` import error | `pyyaml` not pinned in requirements | `pip install pyyaml` |
| Frontend can't reach a remote backend | `API_BASE_URL` is a hardcoded literal | Edit `src/services/api.ts` |

---

## 8. Code Map

### Backend

| Path | Responsibility |
|---|---|
| `api/main.py` | App factory, CORS, exception handlers, router mounting |
| `api/schemas.py` | Pydantic request/response models |
| `api/dependencies.py` | Dependency injection providers |
| `api/routes/` | Six routers — health, prediction, telemetry, model, spatial, geography |
| `api/services/feature_service.py` | Feature engineering, rolling windows |
| `api/services/inference_service.py` | Model loading, prediction, fallback |
| `api/services/risk_service.py` | Risk engine adapter |
| `ml/risk_engine.py` | Deterministic safety policy |
| `ml/train.py`, `ml/evaluate.py`, `ml/predict.py` | Training and offline inference |
| `ml/evaluation/` | Twelve-module validation framework |
| `ml/spatial/` | IDW, kriging, uncertainty, LOSO validation |
| `ml/data_acquisition/` | SNOTEL/CAIC fetching, spatial joining |
| `services/ingestion/` | Worker, validator, scheduler, SQLite storage |

### Frontend

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Tab routing, region selection, global state |
| `src/services/api.ts` | Single HTTP boundary to the backend |
| `src/types/index.ts` | Shared TypeScript types |
| `src/components/map/` | Leaflet GIS console |
| `src/components/risk/` | Risk assessment panel |
| `src/components/spatial/` | IDW surface controls |
| `src/components/history/` | Risk timeline, historical playback |
| `src/components/model/` | Evaluation metrics page |
| `src/components/{terrain,snowpack,weather,telemetry}/` | Domain panels |
| `src/components/india/` | Himalayan catalog panel |
| `src/components/common/` | Header, disclaimer banner |

---

## 9. Contribution Notes

1. **Keep policy in the backend.** Never compute risk levels, thresholds, or
   escalations in the frontend — see
   [USAGE_CONSTRAINTS.md §7](./USAGE_CONSTRAINTS.md#7-architectural-principle).
2. **Version any policy change.** Editing `ml/risk_engine.py` means bumping the
   risk engine version in `services/ingestion/scheduler.py`, so stored
   predictions stay interpretable.
3. **Version any schema change.** Changing the feature list means bumping
   `feature_schema_version` in `inference_service.py` and retraining.
4. **Test both sides of a threshold.** Escalation rules need firing and
   non-firing cases — see `tests/test_risk_engine.py`.
5. **Never weaken a disclaimer.** Response `disclaimer` fields and the console
   banner are constraints, not boilerplate.
6. **Report unfavourable results.** If an evaluation produces a worse number,
   publish it — the project's stated primary criterion is scientific honesty.
