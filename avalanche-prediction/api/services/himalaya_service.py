"""Himalayan Domain Research Inference Service.

Provides controlled, non-operational research inference using the trained and
calibrated Himalayan model artifact bundle (N=44).

Enforces:
1. Operational inference remains strictly DISABLED (HTTP 503 on /predict/point).
2. Research inference is enabled via dedicated /model/himalaya/research-predict endpoint.
3. Zero-fallback invariant: Colorado model is NEVER used as a fallback for Himalayan targets.
4. Deterministic feature extraction and preprocessing using the saved joblib pipeline.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional
import joblib
import numpy as np
import pandas as pd

from api.schemas import (
    HimalayaResearchPredictionRequest,
    HimalayaResearchPredictionResponse,
)
from ml.model_registry import HIMALAYA_MODEL_PATH, model_registry, Domain


class HimalayanResearchInferenceEngine:
    """Specialized engine for evaluating research-mode predictions on Himalayan targets."""

    def __init__(self, model_path: Path = HIMALAYA_MODEL_PATH):
        self.model_path = model_path
        self.bundle: Optional[Dict[str, Any]] = None
        self._load_bundle()

    def _load_bundle(self) -> None:
        """Load Himalayan model bundle from disk."""
        if self.model_path.exists():
            try:
                artifact = joblib.load(self.model_path)
                if isinstance(artifact, dict) and "model" in artifact and "preprocessor" in artifact:
                    self.bundle = artifact
            except Exception as e:
                print(f"HimalayanResearchInferenceEngine: Error loading artifact from {self.model_path}: {e}")

    @property
    def is_available(self) -> bool:
        return self.bundle is not None

    def predict_research(
        self,
        request: HimalayaResearchPredictionRequest
    ) -> HimalayaResearchPredictionResponse:
        """Execute research prediction for a Himalayan target using the trained Himalayan model."""
        if self.bundle is None:
            self._load_bundle()

        if self.bundle is None:
            raise RuntimeError(
                "Himalayan research model artifact is not available on disk at models/himalaya/avalanche_model.joblib."
            )

        # 1. Validate required terrain features
        if request.latitude is None or request.longitude is None:
            raise ValueError("Latitude and longitude are required for Himalayan research prediction.")
        if request.elevation is None or request.slope is None:
            raise ValueError("Elevation and slope are required for Himalayan research prediction.")

        # 2. Decompose aspect into cyclic sine/cosine encodings
        aspect_val = request.aspect if request.aspect is not None else 0.0
        aspect_rad = np.radians(float(aspect_val))
        aspect_sin = float(np.sin(aspect_rad))
        aspect_cos = float(np.cos(aspect_rad))

        # 3. Construct canonical feature dictionary
        feature_dict: Dict[str, Any] = {
            "slope": float(request.slope),
            "aspect_sin": aspect_sin,
            "aspect_cos": aspect_cos,
            "elevation": float(request.elevation),
            "temperature": float(request.temperature) if request.temperature is not None else None,
            "humidity": float(request.humidity) if request.humidity is not None else None,
            "pressure": float(request.pressure) if request.pressure is not None else None,
            "precipitation": float(request.precipitation) if request.precipitation is not None else None,
            "snow_depth": float(request.snow_depth) if request.snow_depth is not None else None,
            "snow_water_equivalent": float(request.snow_water_equivalent) if request.snow_water_equivalent is not None else None,
            "snowfall_6h": float(request.snowfall_6h) if request.snowfall_6h is not None else 0.0,
            "snowfall_24h": float(request.snowfall_24h) if request.snowfall_24h is not None else None,
            "snowfall_72h": float(request.snowfall_72h) if request.snowfall_72h is not None else None,
            "temperature_delta_24h": float(request.temperature_delta_24h) if request.temperature_delta_24h is not None else 0.0,
            "temperature_delta_72h": float(request.temperature_delta_72h) if request.temperature_delta_72h is not None else None,
            "wind_speed_mean_24h": float(request.wind_speed_mean_24h) if request.wind_speed_mean_24h is not None else None,
            "wind_speed_max_24h": float(request.wind_speed_max_24h) if request.wind_speed_max_24h is not None else None,
        }

        feature_cols = self.bundle.get("feature_columns", list(feature_dict.keys()))
        df_input = pd.DataFrame([feature_dict])[feature_cols]

        # 4. Preprocess through saved Imputer & RobustScaler
        preprocessor = self.bundle["preprocessor"]
        x_proc = preprocessor.transform(df_input)

        # 5. Predict calibrated probability
        model = self.bundle["model"]
        classes = list(getattr(model, "classes_", [0, 1]))
        pos_idx = classes.index(1) if 1 in classes else (len(classes) - 1)

        probs = model.predict_proba(x_proc)[0]
        calibrated_prob = float(probs[pos_idx])
        raw_prob = calibrated_prob

        # 6. Map probability to 0-100 risk score and risk level tier
        risk_score = round(calibrated_prob * 100.0, 1)
        raw_thresholds = self.bundle.get("risk_thresholds", {"medium": 0.40, "high": 0.70})
        med_thresh = float(raw_thresholds.get("medium", 0.40))
        high_thresh = float(raw_thresholds.get("high", 0.70))
        numeric_thresholds = {"medium": med_thresh, "high": high_thresh}

        if calibrated_prob >= high_thresh:
            risk_level = "HIGH"
        elif calibrated_prob >= med_thresh:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        model_version = self.bundle.get("model_name", "himalaya_random_forest_v1")
        source = request.source or "CUSTOM_CSV"
        location_id = request.location_id or "HIMALAYAN_TARGET"

        provenance = {
            "domain": "HIMALAYA",
            "mode": "RESEARCH",
            "source": source,
            "location_id": location_id,
            "model_version": model_version,
            "gating_state": "CALIBRATED",
            "model_status": "RESEARCH_ONLY",
            "dataset": "CANONICAL_HIMALAYA_2014_2024_v1",
            "training_samples": self.bundle.get("sample_size", 44),
            "synthetic": False,
        }

        return HimalayaResearchPredictionResponse(
            domain="HIMALAYA",
            mode="RESEARCH",
            model_state="CALIBRATED",
            operational_enabled=False,
            research_prediction_enabled=True,
            risk_score=risk_score,
            probability=round(calibrated_prob, 4),
            calibrated_probability=round(calibrated_prob, 4),
            raw_probability=round(raw_prob, 4),
            risk_level=risk_level,
            model_risk_level=risk_level,
            final_risk_level=risk_level,
            model_version=model_version,
            source=source,
            location_id=location_id,
            latitude=request.latitude,
            longitude=request.longitude,
            elevation=request.elevation,
            slope=request.slope,
            aspect=request.aspect,
            warning="RESEARCH ONLY — NOT AN OPERATIONAL AVALANCHE WARNING",
            disclaimer=(
                "This model is a research decision-support model (N=44) and is not a certified avalanche warning system. "
                "Operational avalanche forecasting for the Himalayas remains disabled for scientific safety."
            ),
            operating_threshold=med_thresh,
            thresholds=numeric_thresholds,
            provenance=provenance,
        )


# Singleton instance
himalaya_inference_engine = HimalayanResearchInferenceEngine()
