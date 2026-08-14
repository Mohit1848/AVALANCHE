# Avalanche Prediction

AI/ML baseline for Smart India Hackathon problem SIH260105: Novel Technologies for Early Detection and Mitigation of Avalanches.

## Objective

Build a Phase 1 avalanche early-warning prototype that learns from CSV-based environmental and terrain data, then predicts avalanche probability and a configurable risk level.

Current Phase 1 architecture:

```text
Dataset
  -> Preprocessing
  -> ML Model
  -> Avalanche Probability
  -> Risk Level
```

Future phases may add IoT sensors, weather APIs, satellite/terrain feeds, FastAPI, React dashboard, RAG, LLM explanations, and alerting. They are intentionally not implemented yet.

## Current Dataset Status

No dataset was found in the workspace during setup. The project therefore does not include fake training data and does not claim any model performance.

Place a real CSV file inside `data/`, then provide the actual target column name during training.

## Dataset Requirements

The CSV should contain observations with weather, snowpack, terrain, and avalanche label/risk information. Possible features include temperature, snow depth, snowfall, humidity, wind speed, wind direction, pressure, slope, and snow density.

The exact column names are configurable. If your dataset uses names such as `temp_c`, `new_snow_cm`, or `avalanche_flag`, pass them through the command line.

## Installation

```bash
cd avalanche-prediction
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS/Linux, activate with:

```bash
source .venv/bin/activate
```

## Train

Example using all columns except the target:

```bash
python ml/train.py --data data/your_dataset.csv --target avalanche_occurred --positive-label 1
```

Example with explicit feature columns:

```bash
python ml/train.py --data data/your_dataset.csv --target avalanche_occurred --features temperature,snow_depth,snowfall,humidity,wind_speed,slope --positive-label 1
```

The script trains:

- Random Forest
- Logistic Regression

It saves the best recall-aware baseline model to:

```text
models/avalanche_baseline.joblib
```

## Evaluate

```bash
python ml/evaluate.py --data data/your_dataset.csv --model models/avalanche_baseline.joblib
```

Metrics include accuracy, precision, recall, F1-score, confusion matrix, and ROC-AUC when binary probabilities are available.

Recall is especially important because this is a safety-related classification problem. A false negative means the model failed to flag a possible avalanche event.

## Predict

Example:

```bash
python ml/predict.py --model models/avalanche_baseline.joblib --input "{\"temperature\": -5, \"snow_depth\": 120, \"snowfall\": 25, \"humidity\": 80, \"wind_speed\": 35, \"slope\": 38}"
```

The output includes:

- avalanche probability
- risk score from 0 to 100
- risk level: `LOW`, `MEDIUM`, or `HIGH`

Risk thresholds default to:

```json
{"medium": 0.4, "high": 0.7}
```

These thresholds are prototype settings only. They are configurable and are not scientifically validated.

Override them like this:

```bash
python ml/predict.py --model models/avalanche_baseline.joblib --input input.json --risk-thresholds "{\"medium\": 0.35, \"high\": 0.65}"
```

## File Guide

- `data/README.md`: explains required dataset structure and recommended data sources.
- `ml/preprocessing.py`: configurable CSV loading, inspection, cleaning, feature/target separation, encoding, scaling, and train/test split.
- `ml/train.py`: trains Random Forest and Logistic Regression baselines and saves the best model.
- `ml/evaluate.py`: evaluates a saved model on a CSV file.
- `ml/predict.py`: predicts avalanche probability and configurable LOW/MEDIUM/HIGH risk level.
- `models/`: stores trained model artifacts.
- `notebooks/`: reserved for exploratory analysis.
- `requirements.txt`: Python dependencies.

## Prototype Limitations

- No real dataset is included yet.
- Model performance cannot be reported until a validated dataset is added.
- Risk thresholds are configurable prototype values, not scientific warning thresholds.
- The model only learns patterns available in the supplied CSV.
- Location, timestamp alignment, terrain resolution, and avalanche-label quality will strongly affect reliability.
- This baseline is not suitable for operational public safety decisions without expert validation.
