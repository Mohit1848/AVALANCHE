"""Geography API Routes for India / Himalayan Peaks and Colorado Reference Corridors."""

import json
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from api.schemas import (
    IndianPeaksResponse,
    IndianPeakRecord,
    IndianRegionsResponse,
    ErrorResponse,
)

router = APIRouter(prefix="/geography", tags=["Geography"])

DATA_ROOT = Path(__file__).resolve().parent.parent.parent / "data" / "geography"
INDIA_DIR = DATA_ROOT / "india"
COLORADO_DIR = DATA_ROOT / "colorado"


def _load_json(file_path: Path) -> dict:
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Geographic data file {file_path.name} not found."
        )
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read geographic database: {str(e)}"
        )


@router.get(
    "/india/peaks",
    response_model=IndianPeaksResponse,
    summary="Get verified Indian Himalayan peaks catalog",
    description=(
        "Retrieves authoritative list of major Indian Himalayan peaks with coordinates, elevations, "
        "and data provenance. Marked as GEOGRAPHIC_ONLY risk capability."
    ),
)
def get_indian_peaks(
    region: Optional[str] = Query(None, description="Filter by Himalayan region"),
    state: Optional[str] = Query(None, description="Filter by Indian State (e.g. Uttarakhand, Ladakh, Sikkim, Himachal Pradesh)"),
    search: Optional[str] = Query(None, description="Case-insensitive search query by peak or mountain range name"),
):
    data = _load_json(INDIA_DIR / "peaks.json")
    peaks = data.get("peaks", [])
    provenance = data.get("provenance", {})

    filtered = peaks
    if region:
        filtered = [p for p in filtered if region.lower() in p["region"].lower()]
    if state:
        filtered = [p for p in filtered if state.lower() in p["state"].lower()]
    if search:
        s = search.lower().strip()
        filtered = [
            p for p in filtered
            if s in p["name"].lower() or s in p["mountain_range"].lower() or s in p["region"].lower()
        ]

    return {
        "provenance": provenance,
        "count": len(filtered),
        "peaks": filtered,
    }


@router.get(
    "/india/peaks/{peak_id}",
    response_model=IndianPeakRecord,
    responses={404: {"model": ErrorResponse}},
    summary="Get details for a specific Indian Himalayan peak",
)
def get_indian_peak_by_id(peak_id: str):
    data = _load_json(INDIA_DIR / "peaks.json")
    peaks = data.get("peaks", [])

    for peak in peaks:
        if peak["id"].lower() == peak_id.lower():
            return peak

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Peak with ID '{peak_id}' not found in Indian Himalayan catalog."
    )


@router.get(
    "/india/regions",
    response_model=IndianRegionsResponse,
    summary="Get Indian Himalayan geographical regions",
)
def get_indian_regions():
    data = _load_json(INDIA_DIR / "regions.json")
    return {
        "provenance": data.get("provenance", {}),
        "count": len(data.get("regions", [])),
        "regions": data.get("regions", []),
    }


@router.get(
    "/india/terrain",
    summary="Get Indian Himalayan terrain dataset readiness & provenance status",
)
def get_indian_terrain_status():
    return _load_json(INDIA_DIR / "terrain.json")


@router.get(
    "/colorado/stations",
    summary="Get Colorado reference SNOTEL weather stations",
)
def get_colorado_stations():
    return _load_json(COLORADO_DIR / "stations.json")


@router.get(
    "/colorado/zones",
    summary="Get Colorado reference CAIC forecast zones",
)
def get_colorado_zones():
    return _load_json(COLORADO_DIR / "zones.json")


@router.get(
    "/colorado/events",
    summary="Get Colorado CAIC historical avalanche event archive",
)
def get_colorado_events():
    return _load_json(COLORADO_DIR / "events.json")
