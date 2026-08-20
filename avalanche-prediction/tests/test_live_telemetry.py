"""Comprehensive Backend Test Suite for Phase 4: Live Telemetry, Ingestion, Freshness & Stale Data Protection."""

import pytest
import datetime
from fastapi.testclient import TestClient
from api.main import app
from services.ingestion.validator import validate_observation, normalize_timestamp_utc
from services.ingestion.storage import StorageManager, storage_manager
from services.ingestion.scheduler import calculate_telemetry_age_minutes, get_freshness_status, get_telemetry_freshness_report, execute_live_prediction_cycle
from services.ingestion.snotel_worker import load_configured_stations, ingest_station_telemetry_batch
from api.services.feature_service import process_telemetry_batch
from api.schemas import StationTelemetryBatchRequest, TelemetryObservation

client = TestClient(app)


class TestTelemetryIngestionAndValidation:
    """Test observation ingestion, range validation, and UTC normalization."""

    def test_utc_timestamp_normalization(self):
        ts = "2024-01-15T05:00:00-07:00"
        norm = normalize_timestamp_utc(ts)
        assert norm == "2024-01-15T12:00:00Z"

        bad_ts = "invalid-date-string"
        assert normalize_timestamp_utc(bad_ts) is None

    def test_sensor_physical_bounds_validation(self):
        valid_raw = {
            "timestamp": "2024-01-15T12:00:00Z",
            "temperature": -6.5,
            "snow_depth": 140.0,
            "snow_water_equivalent": 220.0,
            "precipitation": 2.5,
            "wind_speed": 35.0,
        }
        obs, warnings = validate_observation("586", valid_raw)
        assert obs is not None
        assert obs["temperature"] == -6.5
        assert obs["snow_depth"] == 140.0
        assert len(warnings) == 0

        # Section 9: Invalid sensor values rejected and warning recorded
        invalid_raw = {
            "timestamp": "2024-01-15T12:00:00Z",
            "temperature": -95.0,    # Out of bounds [-60, 45]
            "snow_depth": 5000.0,    # Out of bounds [0, 1500]
        }
        obs_bad, warnings_bad = validate_observation("586", invalid_raw)
        assert obs_bad is not None
        assert obs_bad["temperature"] is None
        assert obs_bad["snow_depth"] is None
        assert len(warnings_bad) == 2


class TestFreshnessAndStaleDataProtection:
    """Test age calculations, freshness state transitions, and stale protection (Section 5 & 11)."""

    def test_freshness_categorization_three_states(self):
        # A. GOOD (< 2h)
        assert get_freshness_status(30) == "GOOD"
        assert get_freshness_status(120) == "GOOD"
        # B. DEGRADED (2h - 6h)
        assert get_freshness_status(180) == "DEGRADED"
        assert get_freshness_status(360) == "DEGRADED"
        # C. STALE (> 6h)
        assert get_freshness_status(480) == "STALE"
        # INSUFFICIENT
        assert get_freshness_status(None) == "INSUFFICIENT"

    def test_stale_data_age_calculation(self):
        now = datetime.datetime.now(datetime.timezone.utc)
        past_8h = (now - datetime.timedelta(hours=8)).strftime("%Y-%m-%dT%H:%M:%SZ")
        age = calculate_telemetry_age_minutes(past_8h)
        assert age is not None
        assert 475 <= age <= 485
        assert get_freshness_status(age) == "STALE"


class TestTemporalIsolationAndFeatureExtraction:
    """Verify strictly backward-looking temporal feature generation and zero future leakage (Section 7)."""

    def test_strictly_backward_looking_isolation_and_leakage_invariance(self):
        target_ts = "2024-01-15T12:00:00Z"
        obs_base = [
            TelemetryObservation(timestamp="2024-01-14T12:00:00Z", temperature=-10.0, snow_depth=100.0, snow_water_equivalent=150.0, precipitation=2.0),
            TelemetryObservation(timestamp="2024-01-15T06:00:00Z", temperature=-8.0, snow_depth=115.0, snow_water_equivalent=175.0, precipitation=5.0),
            TelemetryObservation(timestamp="2024-01-15T12:00:00Z", temperature=-6.0, snow_depth=125.0, snow_water_equivalent=190.0, precipitation=3.0),
        ]

        req_base = StationTelemetryBatchRequest(
            station_id="586",
            station_name="Loveland Basin",
            latitude=39.6739,
            longitude=-105.8972,
            elevation=3475.0,
            default_slope=38.0,
            default_aspect=45.0,
            target_timestamp=target_ts,
            observations=obs_base,
        )
        features_base, _ = process_telemetry_batch(req_base)

        # Now add future observations occurring AFTER target_ts (+6h, +12h, +24h with massive storm)
        obs_augmented = obs_base + [
            TelemetryObservation(timestamp="2024-01-15T18:00:00Z", temperature=+5.0, snow_depth=200.0, snow_water_equivalent=300.0, precipitation=50.0),
            TelemetryObservation(timestamp="2024-01-16T00:00:00Z", temperature=+10.0, snow_depth=250.0, snow_water_equivalent=400.0, precipitation=80.0),
        ]

        req_augmented = StationTelemetryBatchRequest(
            station_id="586",
            station_name="Loveland Basin",
            latitude=39.6739,
            longitude=-105.8972,
            elevation=3475.0,
            default_slope=38.0,
            default_aspect=45.0,
            target_timestamp=target_ts,
            observations=obs_augmented,
        )
        features_augmented, _ = process_telemetry_batch(req_augmented)

        # All rolling features at T_target MUST remain strictly identical
        assert features_base["temperature"] == features_augmented["temperature"] == -6.0
        assert features_base["snowfall_6h"] == features_augmented["snowfall_6h"]
        assert features_base["snowfall_24h"] == features_augmented["snowfall_24h"]
        assert features_base["snowfall_72h"] == features_augmented["snowfall_72h"]
        assert features_base["temperature_delta_24h"] == features_augmented["temperature_delta_24h"]
        assert features_base["temperature_delta_72h"] == features_augmented["temperature_delta_72h"]


class TestDuplicateHandling:
    """Test duplicate observation handling (Section 8)."""

    def test_duplicate_telemetry_deduplication(self):
        target_ts = "2024-01-15T12:00:00Z"
        obs_duplicates = [
            TelemetryObservation(timestamp="2024-01-15T06:00:00Z", temperature=-8.0, precipitation=5.0),
            TelemetryObservation(timestamp="2024-01-15T06:00:00Z", temperature=-8.0, precipitation=5.0), # Exact duplicate
            TelemetryObservation(timestamp="2024-01-15T12:00:00Z", temperature=-6.0, precipitation=3.0),
            TelemetryObservation(timestamp="2024-01-15T12:00:00Z", temperature=-6.0, precipitation=3.0), # Exact duplicate
        ]
        req = StationTelemetryBatchRequest(
            station_id="586",
            latitude=39.6739,
            longitude=-105.8972,
            elevation=3475.0,
            target_timestamp=target_ts,
            observations=obs_duplicates,
        )
        features, _ = process_telemetry_batch(req)
        # Precipitation should not be duplicated (5.0 + 3.0 = 8.0, NOT 16.0)
        assert features["snowfall_24h"] == 8.0


class TestEndToEndApiAndPersistence:
    """Test end-to-end ingestion, cycle triggering, prediction persistence, and audit retrieval (Sections 4, 12, 13, 14, 17, 18)."""

    def test_end_to_end_telemetry_ingest_and_prediction_cycle(self):
        # 1. Ingest telemetry stream
        ingest_payload = [
            {"timestamp": "2024-01-15T00:00:00Z", "temperature": -10.0, "snow_depth": 110.0, "snow_water_equivalent": 160.0, "precipitation": 0.0},
            {"timestamp": "2024-01-15T06:00:00Z", "temperature": -8.0, "snow_depth": 125.0, "snow_water_equivalent": 180.0, "precipitation": 15.0},
            {"timestamp": "2024-01-15T12:00:00Z", "temperature": -6.0, "snow_depth": 145.0, "snow_water_equivalent": 200.0, "precipitation": 20.0},
        ]
        res_ingest = client.post("/telemetry/ingest?station_id=586", json=ingest_payload)
        assert res_ingest.status_code == 200
        assert res_ingest.json()["stored_count"] >= 1

        # 2. Check Telemetry Status
        res_status = client.get("/telemetry/status")
        assert res_status.status_code == 200
        status_data = res_status.json()
        assert "overall_status" in status_data
        assert status_data["stations_total"] >= 6

        # 3. Trigger Live Prediction Cycle
        res_cycle = client.post("/telemetry/trigger-cycle")
        assert res_cycle.status_code == 200
        cycle_data = res_cycle.json()
        assert cycle_data["status"] == "success"
        assert cycle_data["predictions_count"] >= 1

        # 4. Query Prediction History
        res_hist = client.get("/predictions?station_id=586")
        assert res_hist.status_code == 200
        hist_data = res_hist.json()
        assert len(hist_data["predictions"]) >= 1

        # 5. Query Specific Prediction Detail (Section 12 & 13 auditability)
        pred_id = hist_data["predictions"][0]["prediction_id"]
        res_detail = client.get(f"/predictions/{pred_id}")
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert detail["prediction_id"] == pred_id
        assert detail["station_id"] == "586"
        assert "model_version" in detail
        assert "dataset_version" in detail
        assert "feature_schema_version" in detail
        assert "risk_engine_version" in detail
        assert "calibrated_probability" in detail
        assert "final_risk_level" in detail

    def test_granular_health_subsystems(self):
        """Test GET /health subsystem reporting (Section 14)."""
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert "subsystems" in data
        assert data["subsystems"]["api"] == "ok"
        assert data["subsystems"]["model"] == "ok"
        assert data["subsystems"]["database"] == "ok"
        assert data["subsystems"]["risk_engine"] == "ok"
        assert data["subsystems"]["schema"] == "SYNCHRONIZED"

    def test_sqlite_restart_persistence(self):
        """Verify that telemetry and predictions persist across fresh StorageManager instances (Section 17)."""
        # Create fresh manager instance connecting to same SQLite file
        fresh_manager = StorageManager()
        history = fresh_manager.get_telemetry_history("586", limit=10)
        assert len(history) >= 1
        preds = fresh_manager.get_predictions(station_id="586", limit=10)
        assert len(preds) >= 1

    def test_station_assessment_freshness_authoritative_contract(self):
        """Verify that /telemetry/{station_id}/assessment returns authoritative freshness attributes and suppresses stale predictions."""
        res = client.get("/telemetry/335/assessment")
        assert res.status_code == 200
        data = res.json()
        assert "telemetry_timestamp" in data
        assert "telemetry_age_minutes" in data
        assert "data_quality" in data
        assert "freshness_state" in data
        assert "assessment_status" in data
        assert "prediction_available" in data
        assert "current_utc" in data

        if data["freshness_state"] == "STALE":
            assert data["data_quality"] == "STALE"
            assert data["prediction_available"] is False
            assert data["assessment_status"] == "SUPPRESSED"
            assert data["prediction"]["final_risk_level"] == "STALE"
            assert data["prediction"]["data_quality"] == "STALE"
            assert any("STALE" in w for w in data["prediction"]["warnings"])

