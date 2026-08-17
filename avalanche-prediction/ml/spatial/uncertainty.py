"""Spatial Uncertainty & Data Quality Engine.

Evaluates spatial coverage, nearest station proximity, station density,
and assigns engineering quality categories (EXCELLENT, GOOD, DEGRADED, INSUFFICIENT).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "spatial.yaml"


@dataclass
class SpatialQualityResult:
    """Standard spatial quality metadata container."""
    spatial_quality: str
    nearest_station_distance_km: float | None
    station_count: int
    stations_used: List[str]
    search_radius_km: float
    interpolation_method: str
    spatial_warning: Optional[str] = None
    spatial_coverage_score: float = 0.0


def load_spatial_quality_config() -> Dict[str, Any]:
    """Load spatial quality thresholds from configuration."""
    defaults = {
        "excellent_max_distance_km": 15.0,
        "excellent_min_stations": 3,
        "good_max_distance_km": 25.0,
        "good_min_stations": 2,
        "degraded_max_distance_km": 50.0,
    }
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f)
                if cfg and "spatial" in cfg and "quality_thresholds" in cfg["spatial"]:
                    defaults.update(cfg["spatial"]["quality_thresholds"])
        except Exception:
            pass
    return defaults


def evaluate_spatial_quality(
    distances_and_stations: List[tuple[float, str]],
    search_radius_km: float = 35.0,
    interpolation_method: str = "IDW",
    custom_thresholds: Optional[Dict[str, Any]] = None,
) -> SpatialQualityResult:
    """Evaluate spatial confidence metrics and assign engineering quality state.

    Args:
        distances_and_stations: List of tuples (distance_km, station_id) within search radius.
        search_radius_km: Active interpolation radius in km.
        interpolation_method: Active algorithm ("IDW").
        custom_thresholds: Optional threshold overrides.

    Returns:
        SpatialQualityResult
    """
    thresholds = custom_thresholds or load_spatial_quality_config()
    exc_dist = float(thresholds.get("excellent_max_distance_km", 15.0))
    exc_min_st = int(thresholds.get("excellent_min_stations", 3))
    good_dist = float(thresholds.get("good_max_distance_km", 25.0))
    good_min_st = int(thresholds.get("good_min_stations", 2))
    deg_dist = float(thresholds.get("degraded_max_distance_km", 50.0))

    usable_stations = sorted(distances_and_stations, key=lambda x: x[0])
    count = len(usable_stations)
    stations_used = [st_id for _, st_id in usable_stations]
    nearest_dist = round(usable_stations[0][0], 1) if count > 0 else None

    # INSUFFICIENT: No stations or nearest station beyond maximum degraded range (>50km)
    if count == 0 or nearest_dist is None or nearest_dist > deg_dist:
        return SpatialQualityResult(
            spatial_quality="INSUFFICIENT",
            nearest_station_distance_km=nearest_dist,
            station_count=count,
            stations_used=[],
            search_radius_km=search_radius_km,
            interpolation_method=interpolation_method,
            spatial_warning="No SNOTEL stations within valid interpolation radius (>50km). Cannot compute reliable spatial estimate.",
            spatial_coverage_score=0.0,
        )

    # EXCELLENT: Close proximity (<15km) and high station density (>=3)
    if nearest_dist <= exc_dist and count >= exc_min_st:
        coverage = min(1.0, round(0.85 + (count * 0.05), 2))
        return SpatialQualityResult(
            spatial_quality="EXCELLENT",
            nearest_station_distance_km=nearest_dist,
            station_count=count,
            stations_used=stations_used,
            search_radius_km=search_radius_km,
            interpolation_method=interpolation_method,
            spatial_warning=None,
            spatial_coverage_score=coverage,
        )

    # GOOD: Solid proximity (<25km) and adequate station density (>=2)
    if nearest_dist <= good_dist and count >= good_min_st:
        coverage = min(1.0, round(0.65 + (count * 0.08), 2))
        return SpatialQualityResult(
            spatial_quality="GOOD",
            nearest_station_distance_km=nearest_dist,
            station_count=count,
            stations_used=stations_used,
            search_radius_km=search_radius_km,
            interpolation_method=interpolation_method,
            spatial_warning=None,
            spatial_coverage_score=coverage,
        )

    # DEGRADED: Moderate distance (25-50km) or isolated single station
    warning_reasons = []
    if count == 1:
        warning_reasons.append("Single-station estimate (isolated).")
    if nearest_dist > good_dist:
        warning_reasons.append(f"Nearest station is {nearest_dist} km away.")

    warning_str = f"Spatial coverage is DEGRADED: {'; '.join(warning_reasons)}"
    coverage = round(max(0.20, 0.50 - (nearest_dist / 100.0)), 2)

    return SpatialQualityResult(
        spatial_quality="DEGRADED",
        nearest_station_distance_km=nearest_dist,
        station_count=count,
        stations_used=stations_used,
        search_radius_km=search_radius_km,
        interpolation_method=interpolation_method,
        spatial_warning=warning_str,
        spatial_coverage_score=coverage,
    )
