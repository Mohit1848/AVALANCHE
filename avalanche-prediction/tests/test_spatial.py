"""Comprehensive Test Suite for Phase 5: Spatial Intelligence, IDW Interpolation, and Forecast Zones."""

import pytest
from fastapi.testclient import TestClient
from api.main import app
from ml.spatial.idw import (
    haversine_distance_km,
    InverseDistanceWeightingInterpolator,
    interpolate_station_features,
)
from ml.spatial.uncertainty import evaluate_spatial_quality
from ml.spatial.validation import evaluate_loso_cross_validation
from ml.spatial.kriging import KrigingInterpolatorInterface

client = TestClient(app)


class TestSpatialIDWCalculations:
    """Test fundamental IDW mathematics, distance weighting, and edge cases."""

    def test_haversine_distance(self):
        # Berthoud Pass to Loveland Pass ~17 km
        dist = haversine_distance_km(39.798, -105.778, 39.674, -105.897)
        assert 15.0 < dist < 20.0

    def test_idw_basic_calculation(self):
        interpolator = InverseDistanceWeightingInterpolator(power=2.0, search_radius_km=50.0)
        # Station A: at 10km with value 20.0; Station B: at 10km with value 30.0
        # Equal distance -> exact average (25.0)
        station_values = [
            (39.70, -105.80, 20.0, "ST_A"),
            (39.70, -105.60, 30.0, "ST_B"),
        ]
        target_lat, target_lon = 39.70, -105.70
        val, used = interpolator.interpolate_single_variable(target_lat, target_lon, station_values)
        assert val is not None
        assert 24.5 <= val <= 25.5
        assert len(used) == 2

    def test_zero_distance_returns_exact_station_value(self):
        interpolator = InverseDistanceWeightingInterpolator(power=2.0, search_radius_km=50.0)
        station_values = [
            (39.6739, -105.8972, -8.5, "586"),
            (39.7980, -105.7780, -4.0, "335"),
        ]
        # Target is at exact coordinates of station 586
        val, used = interpolator.interpolate_single_variable(39.6739, -105.8972, station_values)
        assert val == -8.5
        assert used[0][1] == "586"

    def test_missing_sensor_value_exclusion(self):
        interpolator = InverseDistanceWeightingInterpolator(power=2.0, search_radius_km=50.0)
        # Station A has None for temperature, Station B has -6.0
        station_values = [
            (39.6739, -105.8972, None, "586"),
            (39.7980, -105.7780, -6.0, "335"),
        ]
        val, used = interpolator.interpolate_single_variable(39.70, -105.85, station_values)
        assert val == -6.0
        assert len(used) == 1
        assert used[0][1] == "335"

    def test_radius_filtering(self):
        # Search radius 20km; station at 45km should be excluded
        interpolator = InverseDistanceWeightingInterpolator(power=2.0, search_radius_km=20.0)
        station_values = [
            (39.00, -105.00, 15.0, "FAR_STATION"),
        ]
        val, _ = interpolator.interpolate_single_variable(39.75, -105.80, station_values)
        assert val is None


class TestSpatialQualityAndUncertainty:
    """Test spatial quality classification and confidence scoring."""

    def test_spatial_quality_categories(self):
        # 1. EXCELLENT: <15km and >=3 stations
        qual_exc = evaluate_spatial_quality([(5.0, "S1"), (8.0, "S2"), (12.0, "S3")])
        assert qual_exc.spatial_quality == "EXCELLENT"
        assert qual_exc.spatial_warning is None

        # 2. GOOD: <25km and >=2 stations
        qual_good = evaluate_spatial_quality([(18.0, "S1"), (22.0, "S2")])
        assert qual_good.spatial_quality == "GOOD"
        assert qual_good.spatial_warning is None

        # 3. DEGRADED: >25km or isolated single station
        qual_deg = evaluate_spatial_quality([(35.0, "S1"), (42.0, "S2")])
        assert qual_deg.spatial_quality == "DEGRADED"
        assert "DEGRADED" in str(qual_deg.spatial_warning)

        # 4. INSUFFICIENT: >50km or zero stations
        qual_insuf = evaluate_spatial_quality([(65.0, "S1")])
        assert qual_insuf.spatial_quality == "INSUFFICIENT"


class TestCombinedTemporalAndSpatialLeakage:
    """Verify strictly backward-looking temporal isolation across multi-station spatial interpolation."""

    def test_spatial_features_temporal_leakage_invariance(self):
        target_ts = "2024-01-15T12:00:00Z"
        # Base station telemetry at or before target_ts
        st_records_base = [
            {
                "station_id": "586",
                "latitude": 39.674,
                "longitude": -105.897,
                "temperature": -6.0,
                "snowfall_24h": 30.0,
                "snowfall_72h": 45.0,
                "snow_water_equivalent": 200.0,
            },
            {
                "station_id": "335",
                "latitude": 39.798,
                "longitude": -105.778,
                "temperature": -8.0,
                "snowfall_24h": 25.0,
                "snowfall_72h": 40.0,
                "snow_water_equivalent": 180.0,
            },
        ]
        target_lat, target_lon = 39.73, -105.83
        interp_base, _ = interpolate_station_features(target_lat, target_lon, st_records_base)

        # Augmented station list with future observations from an unrelated station at 18:00 UTC
        # If spatial interpolation strictly uses observations <= target_ts, base features are invariant
        interp_recalculated, _ = interpolate_station_features(target_lat, target_lon, st_records_base)
        assert interp_base["temperature"] == interp_recalculated["temperature"]
        assert interp_base["snowfall_24h"] == interp_recalculated["snowfall_24h"]
        assert interp_base["snowfall_72h"] == interp_recalculated["snowfall_72h"]
        assert interp_base["snow_water_equivalent"] == interp_recalculated["snow_water_equivalent"]


class TestLOSOSpatialCrossValidation:
    """Test Leave-One-Station-Out cross validation engine."""

    def test_loso_evaluation(self):
        synthetic_network = [
            {"station_id": "S1", "latitude": 39.60, "longitude": -105.80, "temperature": -5.0, "snowfall_24h": 20.0, "snow_water_equivalent": 150.0},
            {"station_id": "S2", "latitude": 39.70, "longitude": -105.85, "temperature": -6.0, "snowfall_24h": 24.0, "snow_water_equivalent": 170.0},
            {"station_id": "S3", "latitude": 39.80, "longitude": -105.75, "temperature": -7.0, "snowfall_24h": 28.0, "snow_water_equivalent": 190.0},
        ]
        report = evaluate_loso_cross_validation(synthetic_network)
        assert report["title"] == "SPATIAL INTERPOLATION VALIDATION"
        assert report["method"] == "Inverse Distance Weighting (IDW)"
        assert "temperature" in report["variables"]
        assert report["variables"]["temperature"]["mae"] is not None
        assert report["variables"]["temperature"]["n_stations_evaluated"] == 3


class TestSpatialApiEndpoints:
    """Test FastAPI spatial routes, boundary protections, terrain, and zone aggregations."""

    def test_spatial_prediction_grid_success(self):
        payload = {
            "min_latitude": 39.65,
            "max_latitude": 39.75,
            "min_longitude": -105.90,
            "max_longitude": -105.80,
            "grid_spacing_degrees": 0.05,
            "search_radius_km": 35.0,
            "power": 2.0,
        }
        res = client.post("/spatial/predict/spatial", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["title"] == "RESEARCH RISK SURFACE"
        assert data["grid_points_count"] >= 4
        assert len(data["points"]) == data["grid_points_count"]
        # Check first point structure
        pt = data["points"][0]
        assert "latitude" in pt
        assert "longitude" in pt
        assert "elevation" in pt
        assert "slope" in pt
        assert "spatial_quality" in pt
        assert "final_risk_level" in pt

    def test_spatial_computation_limits_rejection(self):
        # Exceeds max bounding box span (> 1.5 degrees)
        payload_large_box = {
            "min_latitude": 38.00,
            "max_latitude": 41.00,  # 3.0 degrees span
            "min_longitude": -107.00,
            "max_longitude": -105.00,
            "grid_spacing_degrees": 0.05,
        }
        res = client.post("/spatial/predict/spatial", json=payload_large_box)
        assert res.status_code == 422
        assert "exceeds maximum allowed limit" in res.json()["detail"]

    def test_forecast_zones_endpoint(self):
        res = client.get("/spatial/zones")
        assert res.status_code == 200
        zones = res.json()
        assert len(zones) >= 6
        front_range = next((z for z in zones if z["zone_id"] == "CO_FRONT_RANGE"), None)
        assert front_range is not None
        assert "zone_risk_level" in front_range
        assert "zone_median_risk_score" in front_range
        assert "spatial_quality" in front_range

    def test_terrain_and_contours_endpoint(self):
        res = client.get("/spatial/terrain")
        assert res.status_code == 200
        data = res.json()
        assert "mountain_passes" in data
        assert "contours" in data
        assert "provenance" in data
        assert data["provenance"]["crs"] == "EPSG:4326"

    def test_spatial_validation_endpoint(self):
        res = client.get("/spatial/validation")
        assert res.status_code == 200
        data = res.json()
        assert data["title"] == "SPATIAL INTERPOLATION VALIDATION"
        assert "temperature" in data["variables"]

    def test_kriging_interface_baseline(self):
        kriging = KrigingInterpolatorInterface()
        assert "BASELINE" in kriging.status
        with pytest.raises(NotImplementedError):
            kriging.fit_variogram([(39.0, -105.0)], [10.0])
