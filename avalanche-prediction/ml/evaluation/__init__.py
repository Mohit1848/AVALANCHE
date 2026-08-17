"""Scientific Model Validation & Forecast Reliability Package for Avalanche Risk Intelligence."""

from ml.evaluation.temporal_holdout import evaluate_temporal_holdout
from ml.evaluation.walk_forward import evaluate_walk_forward
from ml.evaluation.calibration import evaluate_calibration
from ml.evaluation.thresholds import evaluate_thresholds
from ml.evaluation.subgroups import evaluate_subgroups
from ml.evaluation.spatial_generalization import evaluate_spatial_generalization, evaluate_joint_spatiotemporal_holdout
from ml.evaluation.ablation import run_ablation_study
from ml.evaluation.model_comparison import compare_models
from ml.evaluation.feature_stability import evaluate_feature_stability
from ml.evaluation.error_analysis import perform_error_analysis
from ml.evaluation.quality_analysis import evaluate_quality_impact

__all__ = [
    "evaluate_temporal_holdout",
    "evaluate_walk_forward",
    "evaluate_calibration",
    "evaluate_thresholds",
    "evaluate_subgroups",
    "evaluate_spatial_generalization",
    "evaluate_joint_spatiotemporal_holdout",
    "run_ablation_study",
    "compare_models",
    "evaluate_feature_stability",
    "perform_error_analysis",
    "evaluate_quality_impact",
]
