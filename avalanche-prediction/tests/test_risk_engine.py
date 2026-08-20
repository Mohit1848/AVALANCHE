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
    assert len(result.rule_evaluations) == 3
    triggered_rules = [r for r in result.rule_evaluations if r["status"] == "TRIGGERED"]
    assert len(triggered_rules) >= 1
    assert triggered_rules[0]["rule_id"] == "RAPID_THERMAL_WARMING"


def test_station_assessment_endpoint_colorado():
    from fastapi.testclient import TestClient
    from api.main import app
    client = TestClient(app)

    # Berthoud Summit (335)
    r335 = client.get("/telemetry/335/assessment")
    assert r335.status_code == 200
    data335 = r335.json()
    assert data335["station_id"] == "335"
    assert data335["station_name"] == "Berthoud Summit"
    assert data335["elevation"] == 3444.0
    assert "temperature" in data335["features"]
    assert "prediction" in data335
    assert len(data335["rules_evaluation"]) == 3

    # Fremont Pass (485)
    r485 = client.get("/telemetry/485/assessment")
    assert r485.status_code == 200
    data485 = r485.json()
    assert data485["station_id"] == "485"
    assert data485["station_name"] == "Fremont Pass"
    # Features must differ between different stations
    assert data485["features"]["temperature"] != data335["features"]["temperature"]

