# Dataset Requirements

No dataset is currently present in this project.

This Phase 1 prototype expects a CSV file containing environmental and/or terrain observations, plus a target column representing avalanche occurrence or avalanche-risk class.

Useful feature columns may include:

- `temperature`
- `snow_depth`
- `snowfall`
- `humidity`
- `wind_speed`
- `wind_direction`
- `pressure`
- `slope`
- `snow_density`

The code does not require these exact names. When training, pass your actual target column with `--target` and optionally pass feature columns with `--features`.

Example target columns:

- `avalanche_occurred` with values like `0` and `1`
- `risk_level` with values like `low`, `medium`, `high`
- `danger_level` from an avalanche bulletin dataset

Recommended public data sources to investigate:

- European Avalanche Warning Services avalanche bulletins and danger ratings
- Swiss WSL Institute for Snow and Avalanche Research SLF datasets and bulletins
- Colorado Avalanche Information Center accident and forecast archives
- Utah Avalanche Center avalanche observations
- NOAA / Meteostat / ERA5 weather data for temperature, wind, snowfall, and pressure
- NASA SRTM or Copernicus DEM terrain data for slope/elevation-derived features

Important note: do not mix weather, terrain, and avalanche labels without aligning them by location and timestamp. A reliable dataset should describe where and when each observation was recorded.
