# Deterministic Risk Engine

The safety policy layer that sits between the statistical model and the
operational risk level shown to a user.

Implementation: `avalanche-prediction/ml/risk_engine.py`
Tests: `avalanche-prediction/tests/test_risk_engine.py`

---

## 1. Why a Separate Engine

A calibrated classifier trained on 96 records cannot be the sole authority on a
life-safety decision. The risk engine exists so that a small set of explicit,
auditable physical rules can raise — never lower — the risk level the model
produced, and so that every such intervention is recorded with a reason.

Three consequences follow from this design:

- **Escalation is one-directional.** No rule reduces a risk level. The model's
  own assessment is the floor.
- **Both values are always reported.** `model_risk_level` and
  `final_risk_level` are separate response fields. A consumer can always see
  what the statistics said before policy was applied.
- **Every escalation carries a sentence.** `risk_escalation_reasons` contains
  human-readable text naming the rule and the values that triggered it.

---

## 2. Evaluation Sequence

`evaluate_risk()` executes three stages, short-circuiting on failure:

```text
┌─ Stage 1 ── assess_data_quality() ──────────────────────┐
│  Critical features present?  ── no ──→ INSUFFICIENT_DATA│
│         │ yes                                            │
│  All optional features present? ── no ──→ DEGRADED       │
│         │ yes                                            │
│         └──────────────────────────────→ GOOD            │
└──────────────────────────┬───────────────────────────────┘
                           ▼
┌─ Stage 2 ── probability availability ───────────────────┐
│  calibrated_probability is None? ── yes ─→ INSUFFICIENT_ │
│                                             DATA         │
└──────────────────────────┬───────────────────────────────┘
                           ▼
┌─ Stage 3 ── apply_safety_escalations() ─────────────────┐
│  Base level from thresholds, then Rule 1 / 2 / 3        │
│  (evaluated as if/elif — at most one rule fires)        │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Stage 1 — Data Quality Assessment

### 3.1 Critical Features

Without these, no quantitative estimate is produced at all:

| Feature | Rationale |
|---|---|
| `temperature` | Drives thermal weakening and wet-slab processes |
| `slope` | Without an incline angle no release assessment is meaningful |

### 3.2 Optional Features

Fifteen features degrade quality when absent but do not block evaluation:

```text
snowfall_6h, snowfall_24h, snowfall_72h, snow_depth,
snow_water_equivalent, temperature_delta_24h, temperature_delta_72h,
wind_speed_mean_24h, wind_speed_max_24h, humidity, pressure,
precipitation, aspect_sin, aspect_cos, elevation
```

### 3.3 Quality States

| State | Condition | Effect on output |
|---|---|---|
| `GOOD` | All critical and optional features present | Full evaluation |
| `DEGRADED` | Critical present, ≥1 optional missing | Evaluation proceeds; warning lists the missing features |
| `INSUFFICIENT` | ≥1 critical missing | All scores `null`; level is `INSUFFICIENT_DATA` |

A feature counts as missing when its value is `None` or an empty string, and
only when it appears in the active `feature_columns` list.

---

## 4. Stage 3 — Escalation Rules

Rules are evaluated as an `if / elif / elif` chain, so **at most one rule fires
per evaluation** — the first match wins, ordered most-severe first.

### Base Level Mapping

Before any rule, the calibrated probability maps to a level:

| Calibrated probability | Level |
|---|---|
| `p < 0.40` | `LOW` |
| `0.40 ≤ p < 0.70` | `MEDIUM` |
| `p ≥ 0.70` | `HIGH` |

Thresholds come from the model artifact (`risk_thresholds`), defaulting to
`{medium: 0.40, high: 0.70}`.

### Rule 1 — Heavy Storm Loading on Steep Terrain

| | |
|---|---|
| **Trigger** | (`snowfall_24h ≥ 30.0` **or** `snowfall_72h ≥ 45.0`) **and** `slope ≥ 34.0` |
| **Action** | Force `final_level = HIGH`; raise score to at least 70.0 |
| **Rationale** | Rapid storm loading on terrain within the common release-angle band is the dominant slab-avalanche driver |

### Rule 2 — Rapid Thermal Warming on Steep Terrain

| | |
|---|---|
| **Trigger** | (`temperature ≥ 3.0` **or** `temperature_delta_24h ≥ 6.0`) **and** `slope ≥ 35.0` |
| **Action** | Force `final_level = HIGH`; raise score to at least 70.0 |
| **Rationale** | Warming drives free-water percolation and bond weakening, producing wet-slab and loose-wet instability |

### Rule 3 — Moderate Loading on Release-Capable Terrain

| | |
|---|---|
| **Trigger** | (`snowfall_24h ≥ 15.0` **or** `snowfall_72h ≥ 25.0`) **and** `slope ≥ 30.0` |
| **Action** | Raise score to at least 40.0; promote `LOW` → `MEDIUM` (leaves `MEDIUM`/`HIGH` unchanged) |
| **Rationale** | Moderate loading on lower-angle terrain warrants elevated attention without a maximum-severity call |

### Threshold Summary

| Parameter | Rule 1 | Rule 2 | Rule 3 |
|---|---|---|---|
| Slope | ≥ 34.0° | ≥ 35.0° | ≥ 30.0° |
| 24h snowfall | ≥ 30.0 mm | — | ≥ 15.0 mm |
| 72h snowfall | ≥ 45.0 mm | — | ≥ 25.0 mm |
| Temperature | — | ≥ 3.0 °C | — |
| 24h temp delta | — | ≥ 6.0 °C | — |
| Resulting floor | HIGH (70.0) | HIGH (70.0) | MEDIUM (40.0) |

> [!NOTE]
> These are **engineering heuristics**, not validated physical models. The
> slope band reflects the commonly cited 30°–45° release range; the loading and
> thermal thresholds are engineering judgment, not values fitted from this
> project's dataset.

---

## 5. Worked Example

Input: `slope = 38.0°`, `snowfall_24h = 65.0 mm`, `snowfall_72h = 110.0 mm`,
`temperature = -4.5 °C`, all other features present.

```text
Stage 1  all critical + optional present            → data_quality = GOOD
Stage 2  calibrated_probability = 0.85              → proceed
Stage 3  base level: 0.85 ≥ 0.70                    → model_risk_level = HIGH
         Rule 1: 65.0 ≥ 30.0 AND 38.0 ≥ 34.0        → FIRES
                 final_level = HIGH
                 final_score = max(85.0, 70.0) = 85.0
         risk_escalated = (HIGH != HIGH)             → false
```

Response excerpt:

```json
{
  "model_risk_score": 85.0,
  "final_risk_score": 85.0,
  "model_risk_level": "HIGH",
  "final_risk_level": "HIGH",
  "risk_escalated": false,
  "risk_escalation_reasons": [
    "Deterministic Engineering Rule: Heavy snowfall (24h=65.0mm, 72h=110.0mm) on steep starting zone (38.0°)."
  ],
  "data_quality": "GOOD"
}
```

Note that `risk_escalated` is `false` even though a rule fired: the flag means
*the policy changed the level*, not *a rule matched*. The model had already
independently reached `HIGH`. The reason string is still recorded, so the audit
trail shows the rule agreed with the model.

---

## 6. Fail-Safe Behaviour

Two conditions produce a null-score response rather than a number:

| Condition | `risk_level` | Scores | Warning |
|---|---|---|---|
| Missing critical feature | `INSUFFICIENT_DATA` | `null` | `Missing critical features: [...]. Cannot produce reliable risk estimate.` |
| Model probability unavailable | `INSUFFICIENT_DATA` | `null` | `Model probability unavailable. Emitting fail-safe assessment.` |

This is a deliberate design choice: a `null` that a client must handle is safer
than a plausible number derived from absent data.

---

## 7. Output Schema — `RiskResult`

| Field | Type | Meaning |
|---|---|---|
| `model_risk_score` | `float \| None` | Calibrated probability × 100, rounded to 1dp |
| `final_risk_score` | `float \| None` | Score after policy floors applied |
| `model_risk_level` | `str` | Level from probability thresholds alone |
| `final_risk_level` | `str` | Level after deterministic policy |
| `risk_level` | `str` | Alias of `final_risk_level` (backward compatibility) |
| `risk_escalated` | `bool` | True only when policy *changed* the level |
| `risk_escalation_reasons` | `list[str]` | Human-readable rule explanations |
| `data_quality` | `str` | `GOOD` / `DEGRADED` / `INSUFFICIENT` |
| `warnings` | `list[str]` | Quality warnings plus escalation reasons |

---

## 8. Measured Engine Behaviour

From `reports/evaluation/metrics.json` (`risk_engine_impact`), over the 16
held-out test evaluations:

| Outcome | Count |
|---|---|
| Policy left model level unchanged | 16 |
| Escalated LOW → MEDIUM | 0 |
| Escalated MEDIUM → HIGH | 0 |
| Escalated LOW → HIGH | 0 |
| Suppressed for insufficient data | 0 |

The engine never altered a model decision on the held-out set. This is a
consequence of the test partition being small (n=16) and the model already
scoring confidently on it — it is **not** evidence that the rules are inert.
The escalation paths are exercised directly by
`tests/test_risk_engine.py` and are visible in the console's Risk History tab,
where seeded records show Rule 2 promoting `LOW (30%)` to a final `HIGH`.

---

## 9. Extending the Rules

To add a rule, edit `apply_safety_escalations()` in `ml/risk_engine.py`:

1. Insert the branch in severity order — the chain is `if/elif`, so position
   determines precedence.
2. Set `final_level` and raise `final_score` with `max()`; never lower either.
3. Append a reason string naming the rule and the triggering values.
4. Add a test in `tests/test_risk_engine.py` covering both the firing and
   non-firing sides of each threshold.
5. Bump the risk engine version in `services/ingestion/scheduler.py` so stored
   predictions remain interpretable.
