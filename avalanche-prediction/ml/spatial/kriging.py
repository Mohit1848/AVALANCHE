"""Geostatistical Kriging Spatial Interpolator Interface.

Provides a clean abstract baseline for future ordinary/universal kriging
with experimental variogram fitting.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


class KrigingInterpolatorInterface:
    """Abstract baseline interface for geostatistical Kriging."""

    def __init__(self, variogram_model: str = "spherical"):
        self.variogram_model = variogram_model
        self.is_fitted: bool = False
        self.status: str = "INTERFACE_BASELINE (IDW Active in Production)"

    def fit_variogram(self, coordinates: List[Tuple[float, float]], values: List[float]) -> None:
        """Fit empirical variogram and estimate nugget, sill, and range."""
        raise NotImplementedError(
            "Kriging variogram fitting is an experimental baseline. IDW is the production standard."
        )

    def predict(self, target_lat: float, target_lon: float) -> Tuple[Optional[float], Optional[float]]:
        """Predict value and kriging estimation variance at target coordinate."""
        raise NotImplementedError(
            "Use InverseDistanceWeightingInterpolator for operational spatial predictions."
        )
