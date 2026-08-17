"""Spatial Intelligence & Multi-Station Interpolation Package.

Provides spatial feature interpolation (IDW), spatial uncertainty evaluation,
Leave-One-Station-Out cross validation, and terrain feature synthesis.
"""

from ml.spatial.idw import InverseDistanceWeightingInterpolator, interpolate_station_features
from ml.spatial.uncertainty import evaluate_spatial_quality, SpatialQualityResult
from ml.spatial.validation import evaluate_loso_cross_validation

__all__ = [
    "InverseDistanceWeightingInterpolator",
    "interpolate_station_features",
    "evaluate_spatial_quality",
    "SpatialQualityResult",
    "evaluate_loso_cross_validation",
]
