import pytest
from ml.risk_engine import evaluate_risk, RiskResult

def test_evaluate_risk_insufficient_data():
    input_data = {"humidity": 50.0}
    feature_columns = ["temperature", "slope", "snowfall", "humidity"]
    thresholds = {"medium": 0.4, "high": 0.7}
    
    result = evaluate_risk(0.5, 0.5, input_data, feature_columns, thresholds)
    
    assert result.data_quality == "INSUFFICIENT"
    assert result.risk_level == "INSUFFICIENT_DATA"
    assert result.final_risk_score is None


def test_evaluate_risk_degraded_data():
    input_data = {"temperature": -5.0, "slope": 30.0, "snowfall": 10.0}
    feature_columns = ["temperature", "slope", "snowfall", "humidity"]
    thresholds = {"medium": 0.4, "high": 0.7}
    
    # Missing humidity (not critical)
    result = evaluate_risk(0.2, 0.2, input_data, feature_columns, thresholds)
    
    assert result.data_quality == "DEGRADED"
    assert result.risk_level == "LOW"
    assert result.final_risk_score == 20.0
    assert any("Missing optional features" in w for w in result.warnings)


def test_evaluate_risk_safety_escalation():
    input_data = {"temperature": 10.0, "slope": 40.0, "snowfall": 0.0, "humidity": 50.0}
    feature_columns = ["temperature", "slope", "snowfall", "humidity"]
    thresholds = {"medium": 0.4, "high": 0.7}
    
    # Raw model gives low probability (e.g. 0.1)
    result = evaluate_risk(0.1, 0.1, input_data, feature_columns, thresholds)
    
    assert result.data_quality == "GOOD"
    # Safety rules should escalate to HIGH due to rapid warming on steep slope
    assert result.risk_level == "HIGH"
    assert result.final_risk_score == 70.0
    assert result.model_risk_score == 10.0
    assert any("Deterministic Engineering Rule" in w or "Rapid thermal warming" in w for w in result.warnings)
