"""Automated fetcher and parser for USDA NRCS SNOTEL hourly/daily station observations.

Retrieves station metadata and meteorological time-series (WTEQ, SNWD, TOBS, PREC, RELH, WNDS, WNDD, PRES)
via the official NRCS AWDB REST API.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import time
from typing import Any
import urllib.parse
import urllib.request
import pandas as pd

AWDB_BASE_URL = "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1"

# Major SNOTEL stations across Colorado avalanche forecasting zones
DEFAULT_COLORADO_STATIONS = [
    {"triplet": "335:CO:SNTL", "id": "335", "name": "Berthoud Summit", "lat": 39.7980, "lon": -105.7780, "elev_m": 3444, "zone": "Front Range"},
    {"triplet": "586:CO:SNTL", "id": "586", "name": "Loveland Basin", "lat": 39.6739, "lon": -105.8972, "elev_m": 3475, "zone": "Front Range"},
    {"triplet": "505:CO:SNTL", "id": "505", "name": "Grizzly Peak", "lat": 39.6450, "lon": -105.8670, "elev_m": 3383, "zone": "Vail & Summit County"},
    {"triplet": "531:CO:SNTL", "id": "531", "name": "Hoosier Pass", "lat": 39.3620, "lon": -106.0610, "elev_m": 3475, "zone": "Vail & Summit County"},
    {"triplet": "415:CO:SNTL", "id": "415", "name": "Copper Mountain", "lat": 39.4750, "lon": -106.1520, "elev_m": 3216, "zone": "Vail & Summit County"},
    {"triplet": "485:CO:SNTL", "id": "485", "name": "Fremont Pass", "lat": 39.3780, "lon": -106.1880, "elev_m": 3475, "zone": "Sawatch"},
    {"triplet": "838:CO:SNTL", "id": "838", "name": "Vail Mountain", "lat": 39.6300, "lon": -106.3630, "elev_m": 3139, "zone": "Vail & Summit County"},
    {"triplet": "1030:CO:SNTL", "id": "1030", "name": "Arapaho Ridge", "lat": 40.3510, "lon": -106.3814, "elev_m": 3341, "zone": "Steamboat"},
    {"triplet": "737:CO:SNTL", "id": "737", "name": "Schofield Pass", "lat": 39.0150, "lon": -107.0480, "elev_m": 3261, "zone": "Gunnison / Crested Butte"},
    {"triplet": "709:CO:SNTL", "id": "709", "name": "Red Mountain Pass", "lat": 37.8989, "lon": -107.7139, "elev_m": 3414, "zone": "San Juan"},
    {"triplet": "642:CO:SNTL", "id": "642", "name": "Molaspas", "lat": 37.7400, "lon": -107.6900, "elev_m": 3200, "zone": "San Juan"},
    {"triplet": "542:CO:SNTL", "id": "542", "name": "Independence Pass", "lat": 39.1080, "lon": -106.6020, "elev_m": 3231, "zone": "Aspen"},
]


def fetch_snotel_stations_metadata(state_code: str = "CO") -> pd.DataFrame:
    """Retrieve official station inventory for a state from AWDB API."""
    url = f"{AWDB_BASE_URL}/stations?stateCds={state_code}&networkCds=SNTL"
    req = urllib.request.Request(url, headers={"User-Agent": "AvalancheResearch/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
            stations = []
            for item in data:
                stations.append({
                    "station_triplet": item.get("stationTriplet"),
                    "station_id": item.get("stationId"),
                    "name": item.get("name"),
                    "latitude": item.get("latitude"),
                    "longitude": item.get("longitude"),
                    "elevation_ft": item.get("elevation"),
                    "elevation_m": round(float(item.get("elevation", 0)) * 0.3048, 1) if item.get("elevation") else None,
                    "county": item.get("countyName"),
                    "huc": item.get("huc"),
                    "begin_date": item.get("beginDate"),
                })
            return pd.DataFrame(stations)
    except Exception as exc:
        print(f"Warning: Online SNOTEL metadata query failed ({exc}). Using curated Colorado station registry.")
        return pd.DataFrame(DEFAULT_COLORADO_STATIONS)


def fetch_snotel_hourly_observations(
    station_triplet: str,
    begin_date: str,
    end_date: str,
    elements: list[str] | None = None
) -> pd.DataFrame:
    """Fetch hourly time series for a SNOTEL station triplet."""
    if elements is None:
        elements = ["WTEQ", "SNWD", "TOBS", "PREC", "RELH", "WNDS", "WNDD", "PRES"]

    elem_str = ",".join(elements)
    params = {
        "stationTriplets": station_triplet,
        "elements": elem_str,
        "duration": "HOURLY",
        "beginDate": f"{begin_date} 00:00",
        "endDate": f"{end_date} 23:59",
    }
    url = f"{AWDB_BASE_URL}/data?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "AvalancheResearch/1.0"})

    records_by_time: dict[str, dict[str, Any]] = {}

    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
            for station_data in payload:
                for elem_data in station_data.get("data", []):
                    code = elem_data.get("stationElement", {}).get("elementCode")
                    for val_item in elem_data.get("values", []):
                        ts = val_item.get("date")
                        val = val_item.get("value")
                        if ts not in records_by_time:
                            records_by_time[ts] = {"timestamp": ts, "station_triplet": station_triplet}
                        records_by_time[ts][code] = val
    except Exception as exc:
        print(f"Failed to fetch {station_triplet}: {exc}")

    if not records_by_time:
        return pd.DataFrame()

    df = pd.DataFrame(list(records_by_time.values()))
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(by="timestamp").reset_index(drop=True)
    return df


def main():
    parser = argparse.ArgumentParser(description="Acquire real SNOTEL meteorological & snowpack time series.")
    parser.add_argument("--start-date", default="2021-11-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", default="2024-05-31", help="End date (YYYY-MM-DD)")
    parser.add_argument("--out-dir", default="data/raw/snotel", help="Output raw directory")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Fetching Colorado SNOTEL inventory...")
    stations_df = fetch_snotel_stations_metadata("CO")
    stations_path = out_dir / "colorado_snotel_inventory.csv"
    stations_df.to_csv(stations_path, index=False)
    print(f"Saved station inventory ({len(stations_df)} stations) to {stations_path}")

    print(f"Downloading observations from {args.start_date} to {args.end_date} for key avalanche corridor stations...")
    for st in DEFAULT_COLORADO_STATIONS:
        triplet = st["triplet"]
        st_id = st["id"]
        csv_file = out_dir / f"snotel_{st_id}_hourly.csv"
        print(f"Fetching {st['name']} ({triplet})...")
        obs_df = fetch_snotel_hourly_observations(triplet, args.start_date, args.end_date)
        if not obs_df.empty:
            obs_df.to_csv(csv_file, index=False)
            print(f"  -> Saved {len(obs_df)} records to {csv_file}")
        else:
            print(f"  -> No data returned for {triplet}")
        time.sleep(0.5)


if __name__ == "__main__":
    main()
