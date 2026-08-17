# Avalanche Risk Intelligence — Backend Service

AI/ML spatiotemporal decision-support backend for Smart India Hackathon problem
**SIH260105: Novel Technologies for Early Detection and Mitigation of
Avalanches**.

> [!WARNING]
> **RESEARCH DECISION-SUPPORT SYSTEM.**
> This service provides research decision-support indicators. It is **not** a
> certified operational avalanche warning authority. Predictions must be
> evaluated alongside official regional bulletins (CAIC, EAWS) and certified
> mountain-safety forecasters.

> [!CAUTION]
> The model's predictive claims are currently **unvalidated**. Reported
> evaluation metrics reach 100% because the dataset's negative class is
> trivially separable from the positive class — see
> [../docs/SCIENTIFIC_VALIDATION.md §6](../docs/SCIENTIFIC_VALIDATION.md#6-the-separability-problem)
> before quoting any performance figure.

---

## 1. Documentation

Full documentation lives in [`../docs/`](../docs/README.md):

| Document | Covers |
|---|---|
| [ARCHITECTURE.md](../docs/ARCHITECTURE.md) | Component topology, request lifecycle, module map |
| [DATA_PIPELINE.md](../docs/DATA_PIPELINE.md) | Ingestion, validation, freshness, storage, features |
| [RISK_ENGINE.md](../docs/RISK_ENGINE.md) | Deterministic safety policy and escalation rules |
| [API_REFERENCE.md](../docs/API_REFERENCE.md) | All 26 REST endpoints |
| [SCIENTIFIC_VALIDATION.md](../docs/SCIENTIFIC_VALIDATION.md) | Methodology, results, limitations |
| [USAGE_CONSTRAINTS.md](../docs/USAGE_CONSTRAINTS.md) | What this system may and may not be used for |
| [DEVELOPMENT.md](../docs/DEVELOPMENT.md) | Setup, running, testing, troubleshooting |

---

## 2. Pipeline

```text
SNOTEL telemetry stations              config/stations.yaml
        ↓
Validation & provenance                services/ingestion/validator.py
        ↓
SQLite observation store               services/ingestion/storage.py
        ↓
Freshness gating (GOOD/DEGRADED/STALE) services/ingestion/scheduler.py
        ↓
Canonical 17-feature generation        api/services/feature_service.py
        ↓
Calibrated Random Forest inference     api/services/inference_service.py
        ↓
Deterministic risk engine              ml/risk_engine.py
        ↓
Persisted prediction history           SQLite prediction_history
        ↓
FastAPI service                        api/main.py
```

---

## 3. Key Capabilities

1. **Configurable stations** — 10 Colorado SNOTEL stations enabled and
   parameterized through `config/stations.yaml` with no code changes.
2. **Validation and provenance** — physical bounds enforced (air temperature
   −60…45 °C, snow depth 0…1500 cm, SWE 0…3000 mm), UTC normalization, and
   provenance attached to every record. Out-of-range values are nulled with a
   warning rather than clamped.
3. **Freshness protection** — telemetry ≤2h is `GOOD`, 2–6h `DEGRADED`, >6h
   `STALE`. Stale telemetry suppresses predictions and raises a prominent
   notice.
4. **Policy/prediction separation** — the model emits a probability; a separate
   deterministic engine sets the operational level and records why.
5. **Fail-safe output** — missing critical features yield `INSUFFICIENT_DATA`
   with null scores, never a fabricated number.
6. **Full audit trail** — every prediction persists its input feature vector
   plus model, dataset, feature-schema, and risk-engine versions.
7. **Spatial intelligence** — IDW interpolation of *physical* variables
   followed by per-cell inference; probabilities are never interpolated.

---

## 4. Running

```bash
cd avalanche-prediction
.venv/Scripts/python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

| Surface | URL |
|---|---|
| API root | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Health probe | http://localhost:8000/health |

Full setup instructions: [../docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md).

---

## 5. Testing

```bash
.venv/Scripts/python.exe -m pytest        # 62 tests
```

**Status (verified 2026-08-17):** 62 passed in 5.85s. The 3 warnings emitted
are third-party deprecations, not failures in this codebase.

| Module | Tests |
|---|---|
| `test_spatial.py` | 14 |
| `test_scientific_validation.py` | 11 |
| `test_api.py` | 9 |
| `test_live_telemetry.py` | 9 |
| `test_acquisition_pipeline.py` | 5 |
| `test_geography.py` | 5 |
| `test_preprocessing.py` | 5 |
| `test_risk_engine.py` | 3 |
| `test_artifact.py` | 1 |

The companion frontend suite is 16 tests (`cd frontend && npx vitest run`),
also passing.

---

## 6. Expected Startup Notice

```text
Notice: Model artifact not found at .../models/avalanche_baseline.joblib.
Running research fallback pipeline.
```

No trained artifact is committed to the repository. The service runs a
heuristic scoring path and reports `schema_status: FALLBACK_INITIALIZED` on
`/health`. Run `python -m ml.train` to produce a real artifact, then restart the
service — the inference engine is a singleton constructed at import.

Predictions produced in fallback mode are **not model-derived**.

---

## 7. Layout

| Path | Contents |
|---|---|
| `api/` | FastAPI app, routes, schemas, services |
| `ml/` | Training, evaluation framework, risk engine, spatial modules |
| `services/ingestion/` | SNOTEL worker, validator, scheduler, storage |
| `config/` | `stations.yaml`, `spatial.yaml` |
| `data/` | Raw inputs, processed dataset, terrain, geography — see [data/README.md](./data/README.md) |
| `reports/evaluation/` | Generated validation metrics and audit reports |
| `tests/` | 62 backend tests |
