"""Generate a synthetic dataset strictly for pipeline testing.

DO NOT use this data to make scientific claims about avalanche prediction accuracy.
All generated records are explicitly marked with `synthetic=True`.
"""

import argparse
from datetime import datetime, timedelta
import random
from pathlib import Path

import pandas as pd
import numpy as np

def generate_synthetic_data(num_records: int, output_path: str):
    random.seed(42)
    np.random.seed(42)

    locations = [f"LOC_{i:03d}" for i in range(10)]
    
    start_date = datetime(2020, 1, 1)
    
    records = []
    
    for i in range(num_records):
        loc = random.choice(locations)
        # Random time between 2020 and 2025
        dt = start_date + timedelta(days=random.randint(0, 1800), hours=random.randint(0, 23))
        
        # Base features
        temp = random.uniform(-25.0, 10.0)
        humidity = random.uniform(30.0, 100.0)
        pressure = random.uniform(800.0, 1050.0)
        wind_speed = random.uniform(0.0, 100.0)
        wind_direction = random.uniform(0.0, 360.0)
        snowfall = max(0.0, random.gauss(5.0, 10.0)) if random.random() > 0.5 else 0.0
        snow_depth = random.uniform(20.0, 300.0)
        
        slope = random.uniform(0.0, 60.0)
        aspect = random.uniform(0.0, 360.0)
        elevation = random.uniform(1500.0, 4000.0)
        
        # Simplistic heuristic for target (just for pipeline testing)
        avalanche_prob = 0.05
        if slope > 30 and slope < 45:
            avalanche_prob += 0.2
        if snowfall > 20:
            avalanche_prob += 0.3
        if wind_speed > 50:
            avalanche_prob += 0.1
        if temp > 0:
            avalanche_prob += 0.15
            
        avalanche_occurred = 1 if random.random() < avalanche_prob else 0
        event_id = f"EVT_{i:05d}" if avalanche_occurred else None
        
        records.append({
            "timestamp": dt.isoformat(),
            "location_id": loc,
            "event_id": event_id,
            "temperature": round(temp, 2),
            "humidity": round(humidity, 1),
            "pressure": round(pressure, 1),
            "wind_speed": round(wind_speed, 1),
            "wind_direction": round(wind_direction, 1),
            "snowfall": round(snowfall, 1),
            "snow_depth": round(snow_depth, 1),
            "slope": round(slope, 1),
            "aspect": round(aspect, 1),
            "elevation": round(elevation, 1),
            "avalanche_occurred": avalanche_occurred,
            "synthetic": True,
        })

    # Sort by location and time to simulate time-series per location
    df = pd.DataFrame(records)
    df = df.sort_values(by=["location_id", "timestamp"]).reset_index(drop=True)
    
    # Introduce some data quality issues for testing fail-safes
    # E.g., make some timestamps impossible or features missing
    issue_indices = np.random.choice(df.index, size=int(num_records * 0.05), replace=False)
    for idx in issue_indices:
        issue_type = random.choice(["missing_temp", "negative_snow", "invalid_coords"])
        if issue_type == "missing_temp":
            df.at[idx, "temperature"] = np.nan
        elif issue_type == "negative_snow":
            df.at[idx, "snowfall"] = -10.0
        elif issue_type == "invalid_coords":
            df.at[idx, "slope"] = 150.0  # Invalid slope
    
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    print(f"Generated {num_records} synthetic records at {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic avalanche dataset")
    parser.add_argument("--records", type=int, default=5000, help="Number of records to generate")
    parser.add_argument("--out", default="data/synthetic_avalanche.csv", help="Output CSV path")
    args = parser.parse_args()
    
    generate_synthetic_data(args.records, args.out)

if __name__ == "__main__":
    main()
