"""Telemetry Normalization and Unit Conversion Module.

Converts raw USDA NRCS AWDB station observations into standard canonical metric units:
- Air Temperature: Fahrenheit -> Celsius (°C)
- Snow Depth: Inches -> Centimeters (cm)
- Snow Water Equivalent (SWE): Inches -> Millimeters (mm)
- Precipitation: Inches -> Millimeters (mm)
- Wind Speed: Miles per Hour (mph) -> Kilometers per Hour (km/h)
- Timestamps: Station Local Time -> UTC ISO-8601
"""

from __future__ import annotations

import datetime
import math
from typing import Any, Dict, List, Optional, Tuple

# Physical range bounds for data validation
PHYSICAL_BOUNDS = {
    "temperature": (-50.0, 45.0),          # °C
    "snow_depth": (0.0, 800.0),            # cm
    "snow_water_equivalent": (0.0, 2500.0),# mm
    "precipitation": (0.0, 500.0),         # mm
    "wind_speed": (0.0, 250.0),            # km/h
    "wind_direction": (0.0, 360.0),        # degrees
}


def fahrenheit_to_celsius(f_val: Optional[float]) -> Optional[float]:
    """Convert Fahrenheit to Celsius."""
    if f_val is None or math.isnan(f_val):
        return None
    return round((float(f_val) - 32.0) * (5.0 / 9.0), 2)


def inches_to_cm(in_val: Optional[float]) -> Optional[float]:
    """Convert inches to centimeters."""
    if in_val is None or math.isnan(in_val):
        return None
    return round(float(in_val) * 2.54, 2)


def inches_to_mm(in_val: Optional[float]) -> Optional[float]:
    """Convert inches to millimeters."""
    if in_val is None or math.isnan(in_val):
        return None
    return round(float(in_val) * 25.4, 2)


def mph_to_kmh(mph_val: Optional[float]) -> Optional[float]:
    """Convert miles per hour to kilometers per hour."""
    if mph_val is None or math.isnan(mph_val):
        return None
    return round(float(mph_val) * 1.60934, 2)


def parse_awdb_timestamp_to_utc(
    date_str: str,
    timezone_offset_hours: float = -8.0
) -> Tuple[str, Optional[str]]:
    """Parse AWDB date string (e.g. '2026-08-20 10:00') into UTC ISO-8601 string.

    AWDB SNOTEL stations record in local standard time (typically dataTimeZone = -8.0 for Pacific or -7.0 for Mountain).
    """
    if not date_str:
        raise ValueError("Empty timestamp provided.")

    # Try common AWDB formats
    dt: Optional[datetime.datetime] = None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            dt = datetime.datetime.strptime(date_str.strip(), fmt)
            break
        except ValueError:
            continue

    if dt is None:
        raise ValueError(f"Cannot parse timestamp '{date_str}'")

    # If timezone naive, attach station timezone offset
    st_tz = datetime.timezone(datetime.timedelta(hours=timezone_offset_hours))
    local_dt = dt.replace(tzinfo=st_tz)
    utc_dt = local_dt.astimezone(datetime.timezone.utc)
    utc_iso = utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return utc_iso, f"UTC{timezone_offset_hours:+.1f}"


def validate_physical_bound(element_name: str, val: Optional[float]) -> Tuple[Optional[float], Optional[str]]:
    """Validate that a normalized physical variable falls within realistic bounds."""
    if val is None:
        return None, None

    bounds = PHYSICAL_BOUNDS.get(element_name)
    if bounds:
        min_v, max_v = bounds
        if val < min_v or val > max_v:
            return None, f"{element_name} value {val} out of physical bounds [{min_v}, {max_v}]."

    return val, None


def normalize_awdb_station_records(
    station_id: str,
    station_triplet: str,
    raw_station_data: Dict[str, Any],
    timezone_offset: float = -8.0,
    provenance_meta: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Normalize multi-element time series from AWDB /data endpoint into canonical observations."""
    data_list = raw_station_data.get("data", [])
    if not data_list:
        return []

    # Map by timestamp
    # Element codes: TOBS, SNWD, WTEQ, PREC, WSPDV, WDIRV
    records_by_time: Dict[str, Dict[str, Any]] = {}
    prev_prec_val: Optional[float] = None

    for elem_block in data_list:
        elem_meta = elem_block.get("stationElement", {})
        elem_code = elem_meta.get("elementCode")
        values = elem_block.get("values", [])

        for v in values:
            date_raw = v.get("date")
            raw_num = v.get("value")
            if not date_raw:
                continue

            try:
                utc_ts, tz_info = parse_awdb_timestamp_to_utc(date_raw, timezone_offset)
            except Exception:
                continue

            if utc_ts not in records_by_time:
                records_by_time[utc_ts] = {
                    "station_id": station_id,
                    "station_triplet": station_triplet,
                    "timestamp": utc_ts,
                    "raw_date": date_raw,
                    "source_timezone": tz_info,
                    "temperature": None,
                    "snow_depth": None,
                    "snow_water_equivalent": None,
                    "precipitation": None,
                    "raw_precip_acc": None,
                    "wind_speed": None,
                    "wind_direction": None,
                    "quality_flags": [],
                }

            rec = records_by_time[utc_ts]
            if raw_num is None:
                continue

            try:
                num_val = float(raw_num)
            except (ValueError, TypeError):
                continue

            if elem_code == "TOBS":
                norm_c = fahrenheit_to_celsius(num_val)
                val, warn = validate_physical_bound("temperature", norm_c)
                rec["temperature"] = val
                if warn:
                    rec["quality_flags"].append(warn)
            elif elem_code == "SNWD":
                norm_cm = inches_to_cm(num_val)
                val, warn = validate_physical_bound("snow_depth", norm_cm)
                rec["snow_depth"] = val
                if warn:
                    rec["quality_flags"].append(warn)
            elif elem_code == "WTEQ":
                norm_mm = inches_to_mm(num_val)
                val, warn = validate_physical_bound("snow_water_equivalent", norm_mm)
                rec["snow_water_equivalent"] = val
                if warn:
                    rec["quality_flags"].append(warn)
            elif elem_code == "PREC":
                norm_mm = inches_to_mm(num_val)
                rec["raw_precip_acc"] = norm_mm
            elif elem_code in ("WSPDV", "WSPD"):
                norm_kmh = mph_to_kmh(num_val)
                val, warn = validate_physical_bound("wind_speed", norm_kmh)
                rec["wind_speed"] = val
                if warn:
                    rec["quality_flags"].append(warn)
            elif elem_code in ("WDIRV", "WDIR"):
                rec["wind_direction"] = float(num_val)

    # Sort chronologically and derive hourly incremental precipitation from cumulative counter
    sorted_ts = sorted(records_by_time.keys())
    canonical_observations: List[Dict[str, Any]] = []

    prev_acc: Optional[float] = None
    ingestion_ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    for ts in sorted_ts:
        rec = records_by_time[ts]
        cur_acc = rec.pop("raw_precip_acc", None)

        if cur_acc is not None:
            if prev_acc is not None:
                # Incremental precipitation in the past hour
                inc_precip = max(0.0, round(cur_acc - prev_acc, 2))
                val, warn = validate_physical_bound("precipitation", inc_precip)
                rec["precipitation"] = val
                if warn:
                    rec["quality_flags"].append(warn)
            else:
                rec["precipitation"] = 0.0
            prev_acc = cur_acc
        else:
            rec["precipitation"] = None

        rec["ingestion_timestamp"] = ingestion_ts
        rec["provenance"] = {
            "provider": "NRCS_AWDB",
            "station_triplet": station_triplet,
            "raw_sha256": provenance_meta.get("sha256") if provenance_meta else None,
            "raw_date": rec.pop("raw_date", None),
            "source_timezone": rec.pop("source_timezone", None),
            "quality_status": "VALID" if not rec["quality_flags"] else "VALIDATED_WITH_WARNINGS",
        }
        canonical_observations.append(rec)

    return canonical_observations
