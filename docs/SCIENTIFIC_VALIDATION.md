# Scientific Validation

Validation methodology, measured results, and — most importantly — an honest
account of what those results do and do not establish.

Generated artifacts: `avalanche-prediction/reports/evaluation/`
Evaluation framework: `avalanche-prediction/ml/evaluation/`

> [!CAUTION]
> **Read [§6](#6-the-separability-problem) before quoting any metric from this
> document.** The headline scores are 100% across every model, every threshold,
> and every fold. That is not evidence of an excellent model — it is evidence
> that the evaluation task, as currently constructed, is too easy to be
> informative.

---

## 1. Evaluation Framework

`ml/evaluation/` implements twelve analysis modules, orchestrated by
`run_all.py`:

| Module | Analysis |
|---|---|
| `temporal_holdout.py` | Season-based holdout (2023–24 withheld) |
| `walk_forward.py` | Forward-chaining chronological cross-validation |
| `spatial_generalization.py` | Group location holdout (unseen corridors) |
| `calibration.py` | Reliability curves, Brier score, ECE |
| `thresholds.py` | Operating-point tradeoff sweep |
| `model_comparison.py` | Five classifier families benchmarked |
| `feature_stability.py` | Importance rank stability across folds |
| `ablation.py` | Feature-group contribution |
| `error_analysis.py` | Per-record misclassification inspection |
| `subgroups.py` | Performance by trigger type and elevation band |
| `quality_analysis.py` | Performance stratified by data-quality state |
| `run_all.py` | Full reproducible pipeline |

---

## 2. Methodology

### 2.1 Dataset

| Property | Value |
|---|---|
| Total records | 96 |
| Positive (avalanche observed) | 61 (63.5%) |
| Negative (background control) | 35 (36.5%) |
| Seasons | 9 (2015–16 … 2023–24) |
| Temporal range | 2015-11-20 → 2024-04-18 |
| Locations | 11 SNOTEL corridors |
| Synthetic | `false` — real CAIC and SNOTEL data |

### 2.2 Temporal Holdout

The 2023–24 season was withheld from feature selection, model selection,
hyperparameter tuning, and calibration fitting. Test partition: n=16
(10 positive, 6 negative).

### 2.3 Walk-Forward Cross-Validation

Expanding-window chronological folds — a model never sees a season later than
the one it is tested on:

| Fold | Training seasons | Test season | n |
|---|---|---|---|
| 1 | 2015–16 … 2020–21 | 2021–22 | 16 |
| 2 | 2015–16 … 2021–22 | 2022–23 | 18 |
| 3 | 2015–16 … 2022–23 | 2023–24 | 16 |

### 2.4 Temporal Isolation

Feature windows filter strictly to `T_obs <= T_target`
(`feature_service.process_telemetry_batch()`), so no post-target observation
can influence a prediction. This is enforced in code, not by convention.

### 2.5 Spatial Generalization

Group holdout on location: Copper Mountain (415) and Fremont Pass (485) were
withheld entirely, then evaluated as unseen geography (24 samples) against seen
corridors (40 samples).

---

## 3. Measured Results

All figures below are read directly from `reports/evaluation/`.

### 3.1 Held-Out Season (2023–24)

| Metric | Value |
|---|---|
| Confusion matrix | TP 10 · FP 0 · TN 6 · FN 0 |
| Recall | 100.0% |
| Precision | 100.0% |
| F1 / F2 | 1.000 / 1.000 |
| Specificity | 100.0% |
| PR-AUC / ROC-AUC | 1.000 / 1.000 |
| Brier score | 0.0077 |

### 3.2 Walk-Forward Cross-Validation

| Fold | Test season | Recall | Precision | F2 | Brier |
|---|---|---|---|---|---|
| 1 | 2021–22 | 100.0% | 100.0% | 1.000 | 0.0125 |
| 2 | 2022–23 | 100.0% | 100.0% | 1.000 | 0.0144 |
| 3 | 2023–24 | 100.0% | 100.0% | 1.000 | 0.0048 |
| **Mean** | | **100.0%** | **100.0%** | **1.000** | **0.0106** |

### 3.3 Spatial Generalization

| Partition | n | Positives | Recall | Precision | F2 | Brier |
|---|---|---|---|---|---|---|
| Seen locations | 40 | 22 | 100.0% | 100.0% | 1.000 | 0.0071 |
| Unseen locations | 24 | 16 | 100.0% | 100.0% | 1.000 | 0.0178 |

Recall drop-off across unseen geography: 0.0.

### 3.4 Threshold Sweep

| θ | TP | FP | TN | FN | Recall | Precision | F2 |
|---|---|---|---|---|---|---|---|
| 0.20 | 10 | 0 | 6 | 0 | 100% | 100% | 1.000 |
| 0.30 | 10 | 0 | 6 | 0 | 100% | 100% | 1.000 |
| 0.40 | 10 | 0 | 6 | 0 | 100% | 100% | 1.000 |
| 0.50 | 10 | 0 | 6 | 0 | 100% | 100% | 1.000 |
| 0.60 | 10 | 0 | 6 | 0 | 100% | 100% | 1.000 |
| 0.70 | 10 | 0 | 6 | 0 | 100% | 100% | 1.000 |
| 0.80 | 10 | 0 | 6 | 0 | 100% | 100% | 1.000 |

**The confusion matrix does not change anywhere between θ=0.20 and θ=0.80.**
A threshold sweep exists to expose the recall/precision tradeoff; a flat sweep
means there is no tradeoff to expose, because no test point falls near any
decision boundary.

### 3.5 Model Comparison

| Model | Recall | Precision | F2 | Brier | ECE |
|---|---|---|---|---|---|
| Random Forest | 1.000 | 1.000 | 1.000 | 0.0048 | 0.0656 |
| Gradient Boosting | 1.000 | 1.000 | 1.000 | 0.0046 | 0.0640 |
| HistGradientBoosting | 1.000 | 1.000 | 1.000 | 0.0073 | 0.0799 |
| Extra Trees | 1.000 | 1.000 | 1.000 | 0.0058 | 0.0717 |
| Logistic Regression (L2) | 1.000 | 1.000 | 1.000 | 0.0240 | 0.1118 |

Five architectures of very different capacity — including plain L2 logistic
regression — all achieve identical perfect classification. When model capacity
makes no difference whatsoever, the discriminating signal is in the data, not
the model.

### 3.6 Feature Stability

Mean importance across folds (`feature_stability.csv`):

| Rank | Feature | Mean importance | Std |
|---|---|---|---|
| 1 | `slope` | 0.1806 | 0.0224 |
| 2 | `wind_speed_max_24h` | 0.1616 | 0.0312 |
| 3 | `snowfall_72h` | 0.1393 | 0.0293 |
| 4 | `humidity` | 0.1355 | 0.0155 |
| 5 | `wind_speed_mean_24h` | 0.1306 | 0.0222 |
| 6 | `snowfall_24h` | 0.0806 | 0.0064 |
| 7 | `precipitation` | 0.0527 | 0.0245 |
| 8 | `snowfall_6h` | 0.0459 | 0.0200 |

Every feature is labelled `MODEL ASSOCIATION (NOT CAUSALITY)` in the generated
report — correctly. See [§6.3](#63-why-humidity-ranks-fourth) on the `humidity`
result, which is a dataset artifact rather than a physical finding.

### 3.7 Subgroup Analysis

The framework suppresses subgroups below n=5 rather than publishing misleading
percentages — a good practice worth preserving:

| Subgroup | n | Status |
|---|---|---|
| `HUMAN_TRIGGERED` | 6 | Valid — recall 1.000 |
| `NATURAL` | 3 | **Suppressed** (n < 5) |
| `EXPLOSIVE` | 1 | **Suppressed** (n < 5) |
| Elevation > 3,500 m | 7 | Valid — recall 1.000 |
| Elevation 3,200–3,500 m | 7 | Valid — recall 1.000 |
| Elevation < 3,200 m | 2 | **Suppressed** (n < 5) |

### 3.8 Spatial Interpolation (LOSO)

| Variable | MAE | RMSE | Bias | Stations |
|---|---|---|---|---|
| `temperature` | 4.23 °C | 4.73 | +0.47 | 8 |
| `snow_water_equivalent` | 81.51 mm | 87.04 | +7.90 | 8 |
| `snowfall_24h` | 0.00 mm | 0.00 | 0.00 | 8 |

This measures **interpolation error between stations**, not classification
skill. Two cautions: a 4.23 °C mean temperature error is large relative to the
risk engine's 3.0 °C thermal trigger, and the 0.00 snowfall error reflects a
validation window in which observed 24h snowfall was uniformly zero — it
demonstrates nothing about interpolation skill for that variable.

---

## 4. Calibration

`calibration.json` reports the following:

| Model state | Brier | ECE |
|---|---|---|
| Uncalibrated | 0.0004 | 0.0071 |
| Calibrated (sigmoid) | 0.0077 | 0.0854 |

| Field | Value |
|---|---|
| `brier_improvement` | **−0.0074** |
| `calibration_improves_reliability` | **`false`** |

> [!WARNING]
> **Calibration made probability reliability worse on this dataset**, by both
> Brier score (0.0004 → 0.0077) and ECE (0.0071 → 0.0854). The generated report
> states this plainly in `calibration_improves_reliability: false`.
>
> This contradicts the claim in earlier documentation that "calibrated outputs
> significantly improved the Brier score," and it contradicts the
> console's Model Evaluation tab, which displays an uncalibrated Brier of
> 0.0340 and the annotation "Sigmoid probability scaling prevents overconfident
> predictions."
>
> The likely mechanism is not that calibration is broken: the uncalibrated
> model is already producing near-0/1 outputs on a perfectly separable problem,
> so Platt scaling can only pull confident-and-correct predictions toward the
> middle. This is another symptom of [§6](#6-the-separability-problem), not an
> independent defect.

---

## 5. Risk Engine Impact

Over the 16 held-out evaluations (`metrics.json` → `risk_engine_impact`):

| Outcome | Count |
|---|---|
| Policy left model level unchanged | 16 |
| Escalated LOW → MEDIUM | 0 |
| Escalated MEDIUM → HIGH | 0 |
| Escalated LOW → HIGH | 0 |
| Suppressed for insufficient data | 0 |

The deterministic rules never altered a model decision on the test partition.
Given that the model scored every test record confidently and correctly, this
is unsurprising and is **not** evidence that the rules are inert — they are
exercised directly in `tests/test_risk_engine.py`.

---

## 6. The Separability Problem

This section is the most important in the document.

### 6.1 The Observation

Every metric in [§3](#3-measured-results) is perfect: all five model families,
all three walk-forward folds, all seven decision thresholds, both seen and
unseen geography. Perfect scores that are this uniform are almost never a
property of a good model. They are a property of an easy problem.

### 6.2 The Cause

Inspecting the corpus directly shows that the positive and negative classes do
not overlap at all on several individual features:

| Feature | Negative range | Positive range | Overlap |
|---|---|---|---|
| `slope` | 18.0 – 25.0° | 34.0 – 44.0° | **none — 9° gap** |
| `humidity` | 38.0 – 52.0% | 62.0 – 92.0% | **none — 10% gap** |
| `wind_speed_max_24h` | 16.0 – 24.0 km/h | 28.0 – 80.0 km/h | **none — 4 km/h gap** |
| `snowfall_24h` | 0.0 – 0.0 mm | 0.0 – 55.0 mm | partial |
| `temperature` | −14.0 – −5.0 °C | −11.0 – 4.0 °C | partial |

Any one of these three thresholds classifies the entire 96-record corpus
without a single error:

```text
slope              >= 34.0      →  96/96 correct
humidity           >= 62.0      →  96/96 correct
wind_speed_max_24h >= 28.0      →  96/96 correct
```

A single hand-written comparison achieves what the calibrated Random Forest
achieves. That is the definition of a trivially separable task.

The mechanism is how the negative class was constructed. The 35 background
controls average 21.9° slope, 0.0 mm of 24h snowfall, and 19.5 km/h peak wind —
calm, dry days on terrain **below the angle at which slab avalanches release at
all**. The 61 positives average 37.4° slope, 20.4 mm snowfall, and 47.3 km/h
wind.

The model is therefore being asked: *can you distinguish a storm on a steep
slope from a calm day on a gentle slope?* It can, perfectly. But so can the
number 34. The operationally valuable question — *on a steep slope during a
storm, will it slide today or not?* — is not represented anywhere in this
dataset, because no such negative examples exist in it.

### 6.3 Why `humidity` Ranks Fourth

`humidity` carries 0.1355 mean importance, ranking above `snowfall_24h`. This
is not a physical finding. Humidity in the training corpus separates the
classes perfectly by construction (38–52% vs 62–92%), so any model will lean on
it. Compounding this, the live pipeline **does not measure humidity at all** —
`feature_service.py` hardcodes it to `70.0` for every telemetry-derived
prediction, because SNOTEL stations do not report relative humidity.

The consequence: a feature the model treats as its fourth-strongest signal is a
constant at inference time, and its apparent importance comes from a
training-set artifact. The same applies to `pressure`, which is computed
deterministically from elevation.

### 6.4 What the Metrics Do and Do Not Establish

**Do establish:**

- The end-to-end pipeline runs without leakage — temporal isolation, holdouts,
  and group splits are correctly implemented.
- The evaluation framework itself is well built: walk-forward folds, spatial
  holdouts, subgroup suppression below n=5, and explicit
  association-not-causality labelling are all sound practice.
- The model can reproduce a decision boundary that already exists in the data.

**Do not establish:**

- Any operational forecasting skill.
- That the model discriminates avalanche from non-avalanche conditions under
  comparable weather and terrain.
- That the calibrated probabilities correspond to real-world event frequencies.
  The 63.5% positive rate is a case-control artifact, not a base rate.
- That performance would survive contact with a realistic negative class.

### 6.5 Recommended Remediation

In rough priority order:

1. **Rebuild the negative class with matched controls.** Sample non-avalanche
   days from the *same* stations, *same* seasons, and *same* terrain angles as
   the positives — storm days on 34°+ slopes where nothing released. This is
   the single change that would make every other metric meaningful.
2. **Report the trivial baseline alongside the model.** Publish
   `slope >= 34` as a baseline in `model_comparison.csv`. Any model that does
   not beat it has not been shown to add value.
3. **Drop or fix `humidity` and `pressure`.** Either source real measurements
   or remove them from the feature schema. A constant at inference time should
   not be a top-ranked training feature.
4. **Re-examine calibration after (1).** The current negative Brier improvement
   is a symptom of separability; it should be re-measured on a realistic task
   before concluding anything about Platt scaling.
5. **Expand the corpus.** n=96 with n=16 test partitions cannot support
   confidence intervals narrow enough for safety claims.

---

## 7. Known Inconsistencies

Three unreconciled discrepancies exist in the current system. They are recorded
here rather than quietly resolved, because picking a favourite number would
itself be a scientific-honesty failure.

### 7.1 Two Metric Sources Disagree

| Metric | `/model/metadata` (hardcoded) | `/model/scientific-evaluation` (generated) |
|---|---|---|
| Walk-forward recall | 91.67% | 100.0% |
| Walk-forward precision | 84.62% | 100.0% |
| Walk-forward F2 | 0.9014 | 1.000 |
| Held-out recall | 90.0% | 100.0% |
| Held-out Brier | 0.0985 | 0.0077 |
| Training records | 48 | 96 (corpus) |

`api/routes/model.py` returns a hardcoded `metrics` dict; the evaluation
endpoint reads generated report files. The console's Model Evaluation tab shows
the hardcoded values (91.67% / 84.62%) beside the generated calibration curve,
so **a single screen currently mixes both sources**.

Neither set has been demonstrated to be the reproducible one. The generated
files at least have a traceable pipeline (`ml/evaluation/run_all.py`); the
hardcoded values have no derivation recorded.

### 7.2 Calibration Direction

`calibration.json` reports `calibration_improves_reliability: false` with a
Brier change of −0.0074. Prose documentation and the console annotation both
assert the opposite. See [§4](#4-calibration).

### 7.3 Dataset Size Reporting

`96` (full corpus), `80` (dataset version string surfaced in the console as
`2015_2024_multi_season_expanded (N=80)`), and `48` (`total_training_records`
in `/model/metadata`) all appear in the running system. The 48 figure is
consistent with the six training seasons named on that endpoint, but the three
numbers are not labelled distinctly enough for a reader to tell which
population each describes.

---

## 8. Reproducing the Evaluation

```bash
cd avalanche-prediction
.venv/Scripts/python.exe -m ml.evaluation.run_all
```

Regenerates all files in `reports/evaluation/`. Individual analyses can be run
as modules, e.g. `python -m ml.evaluation.calibration`.

Validation-related tests:

```bash
.venv/Scripts/python.exe -m pytest tests/test_scientific_validation.py -v   # 11 tests
.venv/Scripts/python.exe -m pytest tests/test_spatial.py -v                 # 14 tests
```

---

## 9. Summary Position

The evaluation *framework* in this project is genuinely well constructed —
temporal isolation is enforced in code, holdouts are real, subgroups below n=5
are suppressed, and feature importance is explicitly labelled as association
rather than causality. That machinery is reusable and worth keeping.

The evaluation *result* is currently uninformative, because the dataset's
negative class is drawn from conditions where avalanches cannot occur. Until
matched controls replace it, the honest characterization of this system is:

> A correctly implemented pipeline whose predictive claims are unvalidated.

Stating that plainly is consistent with the project's own primary success
criterion — scientific honesty — as set out in
[USAGE_CONSTRAINTS.md §4](./USAGE_CONSTRAINTS.md#4-scientific-honesty).
