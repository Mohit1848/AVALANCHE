"""Ingestion, normalization, and classification of Colorado Avalanche Information Center (CAIC) observations."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import re
from typing import Any
import pandas as pd


def determine_timestamp_precision(time_val: Any) -> str:
    """Classify the temporal precision of an avalanche observation."""
    if pd.isna(time_val) or time_val is None or str(time_val).strip() in ("", "None", "nan"):
        return "DAILY_MAX_ESTIMATE"
    
    t_str = str(time_val).strip()
    # Check if exact hour:minute is recorded (e.g., 14:30 or 09:15)
    if re.match(r"^\d{1,2}:\d{2}$", t_str):
        return "EXACT_HOUR"
    if re.match(r"^\d{1,2}\s*(am|pm|AM|PM)$", t_str):
        return "ESTIMATED_HOUR"
    
    return "DAILY_MAX_ESTIMATE"


def classify_trigger(trigger_raw: Any, trigger_code: Any = None) -> str:
    """Standardize avalanche release trigger category for analysis."""
    raw = str(trigger_raw).lower() if trigger_raw is not None else ""
    code = str(trigger_code).strip().lower() if trigger_code is not None else ""
    text = f"{raw} {code}".strip()

    # Match explicit code tokens
    if code in ["n", "nat"]:
        return "NATURAL"
    if code in ["as", "ab", "am", "ar", "ai", "af", "ac"]:
        return "HUMAN_TRIGGERED"
    if code in ["ae", "aa", "al"]:
        return "EXPLOSIVE"
    if code in ["u", "unk"]:
        return "OTHER_UNKNOWN"

    if any(k in text for k in ["natural", "glide", "cornice fall", "dry loose natural", "wet loose natural"]):
        return "NATURAL"
    if any(k in text for k in ["skier", "snowboarder", "snowmobiler", "snowshoer", "hiker", "human", "recreation"]):
        return "HUMAN_TRIGGERED"
    if any(k in text for k in ["explosive", "control", "artillery", "gun", "hand charge"]):
        return "EXPLOSIVE"
    
    return "OTHER_UNKNOWN"


def normalize_caic_dataframe(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names, compute timestamp precision, and extract standardized event attributes."""
    df = df_raw.copy()
    
    col_map = {
        "Incident ID": "event_id",
        "Avalanche ID": "event_id",
        "Date": "date",
        "Time": "time",
        "Zone": "zone",
        "Location Description": "location",
        "Path Name": "location",
        "Latitude": "latitude",
        "Longitude": "longitude",
        "Elevation (ft)": "elevation_ft",
        "Elevation": "elevation_ft",
        "Slope Angle": "slope",
        "Aspect": "aspect_str",
        "Type": "avalanche_type",
        "Trigger": "trigger_raw",
        "Trigger Code": "trigger_code",
        "D-Size": "d_size",
        "R-Size": "r_size",
        "Slab Width (ft)": "slab_width_ft",
        "Slab Thickness (in)": "slab_thickness_in",
        "Vertical Fall (ft)": "vertical_fall_ft",
    }
    
    for old_col, new_col in col_map.items():
        if old_col in df.columns and new_col not in df.columns:
            df = df.rename(columns={old_col: new_col})

    if "event_id" not in df.columns:
        df["event_id"] = [f"CAIC_{i+1:05d}" for i in range(len(df))]

    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    df["timestamp_precision"] = df["time"].apply(determine_timestamp_precision) if "time" in df.columns else "DAILY_MAX_ESTIMATE"

    def make_iso_timestamp(row):
        d_str = row["date"]
        t_str = str(row["time"]).strip() if "time" in row and pd.notna(row["time"]) else ""
        prec = row["timestamp_precision"]
        
        if prec == "EXACT_HOUR" and re.match(r"^\d{1,2}:\d{2}$", t_str):
            parts = t_str.split(":")
            return f"{d_str}T{int(parts[0]):02d}:{int(parts[1]):02d}:00Z"
        elif prec == "DAILY_MAX_ESTIMATE":
            return f"{d_str}T23:59:59Z"
        else:
            return f"{d_str}T12:00:00Z"

    df["timestamp"] = df.apply(make_iso_timestamp, axis=1)

    trigger_code_col = "trigger_code" if "trigger_code" in df.columns else None
    df["trigger_category"] = df.apply(
        lambda r: classify_trigger(r.get("trigger_raw", ""), r.get(trigger_code_col, "")), axis=1
    )

    if "elevation_ft" in df.columns:
        df["elevation"] = df["elevation_ft"].apply(lambda v: round(float(v) * 0.3048, 1) if pd.notna(v) and str(v).replace('.', '', 1).isdigit() else None)
    
    aspect_map = {
        "n": 0.0, "north": 0.0, "nne": 22.5, "ne": 45.0, "ene": 67.5,
        "e": 90.0, "east": 90.0, "ese": 112.5, "se": 135.0, "sse": 157.5,
        "s": 180.0, "south": 180.0, "ssw": 202.5, "sw": 225.0, "wsw": 247.5,
        "w": 270.0, "west": 270.0, "wnw": 292.5, "nw": 315.0, "nnw": 337.5,
    }
    
    if "aspect_str" in df.columns:
        def convert_aspect(v):
            if pd.isna(v): return None
            s = str(v).strip().lower()
            if s in aspect_map: return aspect_map[s]
            try: return float(s)
            except ValueError: return None
        df["aspect"] = df["aspect_str"].apply(convert_aspect)

    for num_col in ["latitude", "longitude", "slope"]:
        if num_col in df.columns:
            df[num_col] = pd.to_numeric(df[num_col], errors="coerce")

    valid_mask = df["latitude"].notna() & df["longitude"].notna() & df["date"].notna()
    normalized = df[valid_mask].copy().reset_index(drop=True)
    return normalized


def load_caic_raw_archive(raw_path: str) -> pd.DataFrame:
    """Load raw CAIC CSV export and return normalized dataframe."""
    p = Path(raw_path)
    if not p.exists():
        raise FileNotFoundError(f"CAIC raw archive not found: {raw_path}")
    raw_df = pd.read_csv(p)
    return normalize_caic_dataframe(raw_df)


def main():
    parser = argparse.ArgumentParser(description="Normalize CAIC avalanche occurrence dataset.")
    parser.add_argument("--input", default="data/raw/caic/caic_observations_2021_2024.csv", help="Input raw CAIC CSV")
    parser.add_argument("--out", default="data/intermediate/caic_normalized_2021_2024.csv", help="Output normalized CSV")
    args = parser.parse_args()

    out_p = Path(args.out)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    print(f"Normalizing CAIC data from {args.input}...")
    df = load_caic_raw_archive(args.input)
    df.to_csv(out_p, index=False)
    print(f"Successfully normalized {len(df)} avalanche events to {out_p}")


if __name__ == "__main__":
    main()
