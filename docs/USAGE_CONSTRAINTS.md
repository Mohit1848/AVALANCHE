# Usage Constraints & Research Limitations

What this system may be used for, what it must not be used for, and the
limitations a user must understand before acting on any output.

> [!CAUTION]
> **This system must not be used to make travel, rescue, closure, or
> life-safety decisions.** It is an academic research prototype. Its predictive
> claims are currently **unvalidated** — see
> [SCIENTIFIC_VALIDATION.md §6](./SCIENTIFIC_VALIDATION.md#6-the-separability-problem).

---

## 1. Research Decision-Support Only

The platform exists to evaluate and visualize historical and theoretical
avalanche risk patterns from meteorological telemetry. It supplements analysis;
it does not replace:

- Official regional forecasts (CAIC, EAWS, or the relevant national authority)
- Certified mountain-safety forecasters and professional judgment
- Field observation, snowpack testing, and direct terrain assessment

Every API response carries a `disclaimer` field, and the console renders a
persistent banner. Neither may be removed, suppressed, or styled to be less
prominent in any derived work.

---

## 2. No Autonomous Public Alerting

The system **must not** be connected to:

| Prohibited integration | Reason |
|---|---|
| Public alerting or emergency notification networks | Unvalidated model; no certification |
| Social media broadcast automation | No human review in the loop |
| SMS/push warning distribution | Same |
| Automated road, gate, or lift closure control | Physical-safety actuation |
| Explosive-control or mitigation triggering | Life-safety actuation |
| Any system that acts without a qualified human decision | No accountable reviewer |

The console displays a `NON-AUTONOMOUS` indicator to make this constraint
visible at a glance. The objective of the project is to *study* risk, not to
*broadcast* warnings.

---

## 3. Dataset Adequacy

| Property | Value | Implication |
|---|---|---|
| Total records | 96 | Too few for narrow confidence intervals |
| Test partitions | 16–18 per fold | A single error moves recall by ~6–10 points |
| Positive rate | 63.5% | Case-control artifact, **not** a field base rate |
| Seasons | 9 | Limited climate variability |
| Locations | 11 Colorado corridors | Single mountain range, single snow climate |

The underlying data is real — CAIC observations and SNOTEL telemetry, with
`synthetic = false` throughout — but real data in insufficient quantity still
yields limited-sample evidence, not statistical safety guarantees.

### 3.1 The Negative Class Is Not Representative

The most consequential limitation. The 35 background control records average
21.9° slope and 0.0 mm of 24h snowfall — calm, dry days on terrain below the
angle at which slab avalanches release at all. The classes are perfectly
separable by `slope >= 34` alone.

The model has therefore never been tested on the question that matters: *on
avalanche terrain during a storm, will it release?* Reported metrics describe
performance on a task that a single threshold comparison also solves perfectly.

Full analysis:
[SCIENTIFIC_VALIDATION.md §6](./SCIENTIFIC_VALIDATION.md#6-the-separability-problem).

---

## 4. Scientific Honesty

The primary success criterion of this project is scientific honesty: **if the
evidence is weak, the system says so.**

In practice this means:

- Validation uses strict walk-forward testing, temporal holdouts, and spatial
  generalization checks rather than a single favourable split.
- Subgroups below n=5 are suppressed rather than reported as percentages.
- Feature importance is explicitly labelled `MODEL ASSOCIATION (NOT CAUSALITY)`.
- Generated reports record unfavourable findings — `calibration.json` states
  `calibration_improves_reliability: false` rather than hiding it.
- Known contradictions between components are documented in
  [SCIENTIFIC_VALIDATION.md §7](./SCIENTIFIC_VALIDATION.md#7-known-inconsistencies)
  rather than silently reconciled.

This criterion applies to derived work. Reporting the 100% headline metrics
without the separability caveat would violate the project's own stated
standard.

---

## 5. Geographic Scope

| Region | Status |
|---|---|
| Colorado Rocky Mountains | Model trained and evaluated; 10 SNOTEL stations, 7 forecast zones |
| Indian Himalayas | **Geographic catalog only** — no trained model, no predictions |

The console's region selector labels Colorado as "Alpine Model Enabled" and
India as "Geographic Catalog". Himalayan endpoints under `/geography/india/*`
return reference data only.

Applying the Colorado model to another range would be invalid without
retraining and revalidation: snow climate, terrain, and storm dynamics differ
substantially, and the model has only ever been tested within a single
continental snow climate.

---

## 6. Operational Data Limitations

### 6.1 Telemetry Freshness

| Age | State | Behaviour |
|---|---|---|
| ≤ 2h | `GOOD` | Normal operation |
| 2–6h | `DEGRADED` | Warning surfaced |
| > 6h | `STALE` | Predictions suppressed; prominent notice |

On a fresh checkout all stations report `STALE` because seeded observations are
from the 2023–24 season. This is the freshness gate working correctly.

### 6.2 Unmeasured Features

Two of the 17 model features are not measured at inference time:

| Feature | Actual source at inference |
|---|---|
| `humidity` | Hardcoded constant `70.0` — SNOTEL does not report RH |
| `pressure` | Derived from elevation: `675.0 − (elevation − 3000.0) × 0.08` |

Neither carries station-specific information in live operation, yet `humidity`
ranks fourth in training feature importance. Treat any explanation that leans
on these two features as an artifact.

### 6.3 Wind Direction Absent

The system assesses wind *speed* but not *direction*. Wind loading is
directional — leeward slopes accumulate slab while windward slopes scour — so
no genuine wind-loading assessment is possible. The console states this
explicitly: *"Wind-loading assessment requires localized wind-direction
telemetry."*

### 6.4 Terrain Assumptions

`slope` and `aspect` for station-based predictions come from
`default_slope_deg` / `default_aspect_deg` in `config/stations.yaml`. These are
fixed assumptions about representative nearby starting zones, not measurements
of any specific slope a user might be standing on. SNOTEL sensors themselves
sit on flat ground.

### 6.5 Interpolation Error

IDW leave-one-station-out mean absolute error is 4.23 °C for temperature and
81.51 mm for SWE. The risk engine's thermal escalation triggers at 3.0 °C —
smaller than the interpolation error. Interpolated values near a rule boundary
should be treated as uncertain.

### 6.6 Fallback Inference Path

When no trained artifact is present at `models/avalanche_baseline.joblib`, the
service runs an additive heuristic instead of a model, and `/health` reports
`schema_status: FALLBACK_INITIALIZED`. Output in this state is **not
model-derived** and carries none of the validation described elsewhere. Always
check `/health` before interpreting results.

---

## 7. Architectural Principle

The backend FastAPI inference service is the **single source of truth** for
predictions. The GIS frontend is a visualization layer and must not duplicate
machine-learning logic, thresholding, or risk-engine policy.

Rationale: duplicated policy logic drifts. If the frontend recomputed a risk
level, a rule change in `ml/risk_engine.py` would silently produce two
different answers for the same conditions, and the audit trail would no longer
describe what the user actually saw.

Any contributor adding a display that appears to compute risk should instead
add a backend field and render it.

---

## 8. Security Constraints

Current configuration is suitable for **localhost research only**:

| Setting | Current value | Constraint |
|---|---|---|
| CORS origins | `["*"]` with `allow_credentials=True` | Must be restricted before any networked deployment |
| Authentication | None | All endpoints unauthenticated |
| Frontend API base | Hardcoded `http://localhost:8000` | Not environment-configurable |
| Ingestion endpoints | Unauthenticated `POST` | Anyone with network access can write telemetry |

Error handlers do sanitize output — validation and internal errors return
structured codes without stack traces or filesystem paths. That is the one
hardening measure already in place; it is not sufficient on its own for
exposure beyond localhost.

---

## 9. Permitted Uses

The following are consistent with the constraints above:

- Academic research into spatiotemporal avalanche risk modelling
- Hackathon and coursework demonstration, with limitations stated
- Methodology development — evaluation frameworks, calibration studies,
  interpolation validation
- Retrospective analysis of historical storm cycles
- A reference implementation of policy/prediction separation and provenance
  tracking

In every case, the separability limitation
([SCIENTIFIC_VALIDATION.md §6](./SCIENTIFIC_VALIDATION.md#6-the-separability-problem))
must be disclosed alongside any quoted performance metric.

---

## 10. Path to Operational Credibility

This system is not on the verge of being deployable. Minimum prerequisites:

1. Rebuild the negative class with matched controls — storm days on avalanche
   terrain where no release occurred.
2. Expand the corpus by orders of magnitude, across multiple snow climates.
3. Re-validate everything against the rebuilt dataset, including calibration.
4. Benchmark against the trivial `slope >= 34` baseline and against
   professional forecaster skill.
5. Source real humidity and wind-direction telemetry, or drop the features that
   depend on them.
6. Obtain independent review by certified avalanche forecasters.
7. Add authentication, restrict CORS, and harden ingestion.
8. Establish accountable human review for any output reaching a decision-maker.

Steps 1 and 2 are prerequisites for the rest: without a realistic negative
class, no amount of additional validation produces meaningful evidence.
