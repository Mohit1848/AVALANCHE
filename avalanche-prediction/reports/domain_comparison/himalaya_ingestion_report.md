# Himalayan Domain Ingestion & Provenance Report

**Date**: 2026-08-20  
**Status**: Complete  
**State Machine**: `TRAINING_READY`  
**Readiness Verdict**: `TRAINING_READY`  

---

## 1. Ingestion Overview

The Phase 7 ingestion pipeline successfully acquired and processed real Himalayan cryospheric, meteorological, and topographic datasets across five Indian Himalayan states (Jammu & Kashmir, Ladakh, Himachal Pradesh, Uttarakhand, Sikkim).

### Key Statistics
- **Total Real Avalanche Events ($y=1$)**: `24`
- **Total Documented Background Controls ($y=0$)**: `20`
- **Unverified Observations Excluded ($y=-1$)**: `2`
- **Winter Seasons**: `10` seasons (2014-2015, 2015-2016, 2016-2017, 2017-2018, 2018-2019, 2019-2020, 2020-2021, 2021-2022, 2022-2023, 2023-2024)
- **Active Station Corridors**: `8` stations (DGRE-DHUNDI, DGRE-DRAS, DGRE-GULMARG, DGRE-JOSHIMATH, IMD-BANIHAL, IMD-GANGTOK, IMD-KEYLONG, IMD-LEH)
- **Mountain Valleys / Regions**: `27` regions (Eastern Himalaya (North Sikkim), Garhwal Himalaya (Alaknanda Basin), Garhwal Himalaya (Bhagirathi Valley), Garhwal Himalaya (Bhyundar Valley), Garhwal Himalaya (Chamoli), Garhwal Himalaya (Joshimath), Garhwal Himalaya (Uttarkashi), Greater Himalaya (Bandipora / Gurez), Greater Himalaya (Sind Valley), Karakoram (Saser Muztagh), Kinnaur / Western Himalaya, Ladakh Range (Leh Corridor), Lahaul & Spiti (Chandra Valley), Lahaul Valley (Keylong Sector), Pir Panjal (Gulmarg Sector), Pir Panjal (Kullu / Manali), Pir Panjal (Kullu), Pir Panjal (Ramban Sector), Pir Panjal (Solang Valley), Pir Panjal Range (Banihal Sector), Pir Panjal Range (Banihal), Pir Panjal Range (Kulgam), Saltoro Range (Karakoram), Shamsbari Range (Kupwara), Zanskar / Great Himalaya Ridge, Zanskar Range (Dras Sector), Zanskar Valley (Kargil District))

---

## 2. Provenance & Dataset Integrity

- **Event Source**: DGRE / SASE technical bulletins, NDMA incident archives, JKDMA/USDMA disaster records, and academic cryospheric field reports.
- **Weather Source**: ECMWF ERA5-Land Hourly Reanalysis (Copernicus / Open-Meteo) tagged explicitly with `weather_source = 'ERA5_LAND_REANALYSIS'`.
- **Terrain Source**: Copernicus Global 30m DEM (GLO-30) tagged with `terrain_source = 'Copernicus GLO-30 DEM'`.
- **Synthetic Records**: `synthetic = False` for all canonical training examples.
- **Cryptographic Verification**: All acquired raw files are checksummed in `data/raw/himalaya/metadata/catalog.json` with SHA-256.

---

## 3. Backward Temporal Joins ($T_{obs} \le T_{target}$)

All rolling features (`snowfall_6h`, `snowfall_24h`, `snowfall_72h`, `temperature_delta_24h`, `temperature_delta_72h`, `wind_speed_mean_24h`, `wind_speed_max_24h`) were computed strictly backwards in time from the target evaluation timestamp.
