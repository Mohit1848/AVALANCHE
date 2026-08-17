"""Inverse Distance Weighting (IDW) Multi-Station Interpolator.

Performs deterministic inverse-distance weighted interpolation of continuous
meteorological and snowpack telemetry variables across alpine terrain.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import yaml

from ml.spatial.uncertainty import evaluate_spatial_quality, SpatialQualityResult

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "spatial.yaml"


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    r_earth_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r_earth_km * c, 3)


def load_idw_config() -> Dict[str, Any]:
    """Load IDW parameters from configuration."""
    defaults = {
        "power": 2.0,
        "default_search_radius_km": 35.0,
        "min_stations": 2,
        "max_stations": 6,
    }
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f)
                if cfg and "spatial" in cfg and "idw" in cfg["spatial"]:
                    defaults.update(cfg["spatial"]["idw"])
        except Exception:
            pass
    return defaults


class InverseDistanceWeightingInterpolator:
    """Configurable Inverse Distance Weighting interpolator."""

    def __init__(
        self,
        power: float = 2.0,
        search_radius_km: float = 35.0,
        min_stations: int = 2,
        max_stations: int = 6,
    ):
        self.power = power
        self.search_radius_km = search_radius_km
        self.min_stations = min_stations
        self.max_stations = max_stations

    def interpolate_single_variable(
        self,
        target_lat: float,
        target_lon: float,
        station_values: List[Tuple[float, float, Optional[float], str]],
    ) -> Tuple[Optional[float], List[Tuple[float, str]]]:
        """Interpolate a single variable at target (lat, lon).

        Args:
            target_lat: Target latitude
            target_lon: Target longitude
            station_values: List of (lat, lon, value, station_id)

        Returns:
            (interpolated_value, list_of_used_distances_and_station_ids)
        """
        # Filter stations that have non-null, valid numeric values
        eligible: List[Tuple[float, float, str]] = []  # (dist_km, value, station_id)

        for lat, lon, val, st_id in station_values:
            if val is None or math.isnan(val):
                continue
            dist = haversine_distance_km(target_lat, target_lon, lat, lon)
            eligible.append((dist, float(val), st_id))

        if not eligible:
            return None, []

        # Sort by distance
        eligible.sort(key=lambda x: x[0])

        # 1. Zero-distance check: if target is at an exact station (<= 50 meters)
        if eligible[0][0] <= 0.05:
            return round(eligible[0][1], 2), [(eligible[0][0], eligible[0][2])]

        # 2. Radius filtering
        within_radius = [x for x in eligible if x[0] <= self.search_radius_km]
        if not within_radius:
            # Fallback to nearest station if none within radius, but mark as outside radius
            return None, [(eligible[0][0], eligible[0][2])]

        # 3. Limit to max_stations
        selected = within_radius[: self.max_stations]

        # 4. Calculate IDW weights
        weights = [1.0 / (dist ** self.power) for dist, _, _ in selected]
        sum_weights = sum(weights)

        if sum_weights == 0.0:
            return None, [(d, sid) for d, _, sid in selected]

        weighted_sum = sum(w * val for w, (_, val, _) in zip(weights, selected))
        interpolated = round(weighted_sum / sum_weights, 2)
        used_stations = [(d, sid) for d, _, sid in selected]

        return interpolated, used_stations


def interpolate_station_features(
    target_lat: float,
    target_lon: float,
    station_features_list: List[Dict[str, Any]],
    power: float = 2.0,
    search_radius_km: float = 35.0,
    min_stations: int = 2,
    max_stations: int = 6,
) -> Tuple[Dict[str, Any], SpatialQualityResult]:
    """Interpolate physical weather and snowpack variables at a target coordinate.

    Args:
        target_lat: Query latitude
        target_lon: Query longitude
        station_features_list: List of station dictionaries containing coordinates and features.
        power: IDW exponent
        search_radius_km: Radius in km
        min_stations: Minimum required stations
        max_stations: Maximum stations used

    Returns:
        (interpolated_physical_features, spatial_quality_result)
    """
    interpolator = InverseDistanceWeightingInterpolator(
        power=power,
        search_radius_km=search_radius_km,
        min_stations=min_stations,
        max_stations=max_stations,
    )

    # Physical variables to interpolate
    variables = [
        "temperature",
        "snow_depth",
        "snow_water_equivalent",
        "snowfall_6h",
        "snowfall_24h",
        "snowfall_72h",
        "temperature_delta_24h",
        "temperature_delta_72h",
        "wind_speed_mean_24h",
        "wind_speed_max_24h",
        "precipitation",
        "humidity",
    ]

    all_station_distances: List[Tuple[float, str]] = []
    for st in station_features_list:
        st_lat = st.get("latitude")
        st_lon = st.get("longitude")
        st_id = str(st.get("station_id", "UNKNOWN"))
        if st_lat is not None and st_lon is not None:
            d = haversine_distance_km(target_lat, target_lon, float(st_lat), float(st_lon))
            if d <= search_radius_km:
                all_station_distances.append((d, st_id))

    spatial_quality = evaluate_spatial_quality(
        all_station_distances,
        search_radius_km=search_radius_km,
        interpolation_method="IDW",
    )

    interpolated_features: Dict[str, Any] = {}

    for var in variables:
        station_tuples = []
        for st in station_features_list:
            lat = st.get("latitude")
            lon = st.get("longitude")
            val = st.get(var)
            st_id = str(st.get("station_id", ""))
            if lat is not None and lon is not None:
                station_tuples.append((float(lat), float(lon), val, st_id))

        interp_val, _ = interpolator.interpolate_single_variable(
            target_lat, target_lon, station_tuples
        )
        interpolated_features[var] = interp_val

    return interpolated_features, spatial_quality
