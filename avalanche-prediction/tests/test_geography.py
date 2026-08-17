"""Automated Tests for Indian Himalayan & Colorado Geography Subsystems."""

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_get_indian_peaks_all():
    """Verify that all 19 major Himalayan peaks are loaded with complete provenance."""
    response = client.get("/geography/india/peaks")
    assert response.status_code == 200
    data = response.json()

    assert "provenance" in data
    assert data["provenance"]["crs"] == "EPSG:4326 (WGS84)"
    assert data["count"] >= 19
    assert len(data["peaks"]) >= 19

    # Required peaks check
    expected_peaks = [
        "Nanda Devi", "Kamet", "Saser Kangri", "Mamostong Kangri", "Saltoro Kangri",
        "Nun", "Kun", "Chaukhamba", "Trishul", "Nilkanth", "Mana Peak",
        "Reo Purgyil", "Deo Tibba", "Hanuman Tibba", "Kangchenjunga",
        "Jongsong Peak", "Kabru", "Pauhunri", "Siniolchu"
    ]
    peak_names = [p["name"] for p in data["peaks"]]
    for expected in expected_peaks:
        assert expected in peak_names, f"Expected peak '{expected}' missing from catalog"

    # Schema and coordinate validation
    for peak in data["peaks"]:
        assert peak["risk_capability"] == "GEOGRAPHIC_ONLY"
        assert peak["country"] == "India"
        assert peak["verified"] is True
        assert 25.0 <= peak["latitude"] <= 38.0
        assert 70.0 <= peak["longitude"] <= 92.0
        assert peak["elevation_m"] >= 5000.0


def test_get_indian_peaks_filtering_and_search():
    """Verify filtering by state, region, and search term."""
    # Filter by state
    uk_res = client.get("/geography/india/peaks?state=Uttarakhand")
    assert uk_res.status_code == 200
    uk_data = uk_res.json()
    assert all(p["state"] == "Uttarakhand" for p in uk_data["peaks"])
    assert uk_data["count"] >= 6

    # Search by name
    search_res = client.get("/geography/india/peaks?search=Nanda")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["count"] >= 1
    assert search_data["peaks"][0]["name"] == "Nanda Devi"


def test_get_indian_peak_by_id():
    """Verify fetching single peak by ID."""
    res = client.get("/geography/india/peaks/IN-ND-001")
    assert res.status_code == 200
    peak = res.json()
    assert peak["name"] == "Nanda Devi"
    assert peak["elevation_m"] == 7816
    assert peak["risk_capability"] == "GEOGRAPHIC_ONLY"

    # Non-existent peak returns 404
    missing_res = client.get("/geography/india/peaks/NON_EXISTENT_999")
    assert missing_res.status_code == 404


def test_get_indian_regions():
    """Verify Indian Himalayan regional boundaries."""
    res = client.get("/geography/india/regions")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 5

    region_names = [r["name"] for r in data["regions"]]
    assert any("Ladakh" in name for name in region_names)
    assert any("Uttarakhand" in name for name in region_names)
    assert any("Sikkim" in name for name in region_names)
    assert any("Himachal Pradesh" in name for name in region_names)

    for r in data["regions"]:
        bounds = r["bounds"]
        assert bounds["min_latitude"] < bounds["max_latitude"]
        assert bounds["min_longitude"] < bounds["max_longitude"]


def test_get_colorado_geography():
    """Verify Colorado reference stations and zones."""
    st_res = client.get("/geography/colorado/stations")
    assert st_res.status_code == 200
    assert len(st_res.json().get("stations", [])) >= 10

    zone_res = client.get("/geography/colorado/zones")
    assert zone_res.status_code == 200
    assert len(zone_res.json().get("zones", [])) >= 6
