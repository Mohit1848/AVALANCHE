# Avalanche Risk Intelligence Platform — Documentation

Research-grade spatiotemporal decision-support system for avalanche risk
assessment across alpine SNOTEL corridors.

Built for Smart India Hackathon problem **SIH260105: Novel Technologies for
Early Detection and Mitigation of Avalanches**.

> [!WARNING]
> **RESEARCH DECISION-SUPPORT ONLY — NO AUTONOMOUS PUBLIC ALERTING.**
> This system is an academic research prototype for evaluation and local
> demonstration. It is **not** a certified avalanche safety or warning
> authority. Every prediction must be evaluated alongside official regional
> bulletins (CAIC, EAWS) and certified mountain-safety forecasters.
> See [USAGE_CONSTRAINTS.md](./USAGE_CONSTRAINTS.md).

---

## 1. Documentation Map

| Document | Covers | Read it when you need to… |
|---|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Component topology, request lifecycle, module map | Understand how the pieces fit together |
| [DATA_PIPELINE.md](./DATA_PIPELINE.md) | Ingestion, validation, freshness, storage schema, feature engineering | Trace a telemetry reading to a feature vector |
| [RISK_ENGINE.md](./RISK_ENGINE.md) | Deterministic safety policy, escalation rules, fail-safe states | Understand why a risk level was assigned |
| [API_REFERENCE.md](./API_REFERENCE.md) | All 26 REST endpoints with payloads | Call the backend or build a client |
| [SCIENTIFIC_VALIDATION.md](./SCIENTIFIC_VALIDATION.md) | Validation methodology, measured results, known inconsistencies | Judge how much to trust the model |
| [USAGE_CONSTRAINTS.md](./USAGE_CONSTRAINTS.md) | Research limitations, deployment prohibitions | Decide what this system may be used for |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Setup, run, test, troubleshoot | Get the system running locally |

---

## 2. What the System Does

The platform converts alpine weather and snowpack telemetry into audited,
explainable risk assessments through a five-stage pipeline:

```text
SNOTEL telemetry  →  validation &   →  feature      →  calibrated  →  deterministic
(10 CO stations)     freshness         engineering     ML model       risk engine
                     gating            (17 features)   (RF)           (safety policy)
                                                                            ↓
                                                          persisted audit record
                                                                            ↓
                                                          React GIS console
```

Three properties distinguish it from a plain classifier:

1. **Policy is separated from prediction.** The ML model emits a probability.
   A separate deterministic engine decides the operational risk level and
   records *why* it escalated. Both values are surfaced, never merged.
2. **Data quality gates output.** Missing critical telemetry produces
   `INSUFFICIENT_DATA`, not a confident guess. Stale telemetry is flagged
   prominently rather than silently served.
3. **Every prediction carries provenance.** Model version, feature schema
   version, risk engine version, and data source travel with each result and
   are persisted for audit.

---

## 3. Repository Layout

| Path | Contents |
|---|---|
| `avalanche-prediction/api/` | FastAPI service — routes, schemas, inference/feature/risk services |
| `avalanche-prediction/ml/` | Training, evaluation framework, risk engine, spatial interpolation |
| `avalanche-prediction/services/ingestion/` | SNOTEL worker, validator, scheduler, SQLite storage |
| `avalanche-prediction/config/` | `stations.yaml` (telemetry stations), `spatial.yaml` (IDW parameters) |
| `avalanche-prediction/data/` | Raw CAIC/SNOTEL inputs, processed canonical dataset, terrain, geography |
| `avalanche-prediction/reports/evaluation/` | Generated validation metrics and audit reports |
| `avalanche-prediction/tests/` | 62 backend tests across 9 modules |
| `frontend/` | React 19 + TypeScript + Leaflet GIS console |
| `docs/` | This documentation set |

---

## 4. Quick Start

Full instructions, prerequisites, and troubleshooting live in
[DEVELOPMENT.md](./DEVELOPMENT.md). The short version:

```bash
# Terminal 1 — backend (port 8000)
cd avalanche-prediction
.venv/Scripts/python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — frontend (port 5173)
cd frontend
npm install
npm run dev
```

| Surface | URL |
|---|---|
| GIS Console | http://localhost:5173 |
| API root | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Health probe | http://localhost:8000/health |

---

## 5. Current System Status

Verified by direct execution on 2026-08-17:

| Check | Result |
|---|---|
| Backend test suite | 62 passed (`pytest`) |
| Frontend test suite | 16 passed (`npx vitest run`) |
| Backend startup | Clean; 26 routes mounted |
| Frontend runtime | All 5 console tabs render, zero console errors |
| Trained model artifact | **Absent** — service runs the heuristic fallback pipeline |
| Telemetry freshness | `STALE` — seeded observations are from the 2023–24 season |

The last two rows are expected in a fresh checkout, not faults. See
[DEVELOPMENT.md §6](./DEVELOPMENT.md#6-expected-notices-not-bugs).

---

## 6. Console Tabs

| Tab | Purpose |
|---|---|
| Risk Console | Leaflet GIS map, target-location evaluation, terrain/snowpack/weather panels |
| Spatial Intelligence | IDW interpolation controls, risk-surface grid generation, layer toggles |
| Risk History | Calibrated probability vs. final policy score over time, escalation audit cards |
| Historical Playback | Reconstruction of three confirmed Colorado storm cycles |
| Model Evaluation | Validation metrics, calibration reliability curve, threshold tradeoff table |

A region selector switches between **Colorado** (alpine model enabled) and
**Indian Himalayas** (geographic catalog only — no trained model).
