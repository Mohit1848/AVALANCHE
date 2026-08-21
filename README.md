# 🏔️ AVALANCHE: Global Mountain Risk Intelligence & Decision Support System

[![Frontend: React + Vite + TypeScript](https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20TypeScript-blue.svg)](https://github.com/Mohit1848/AVALANCHE)
[![Backend: FastAPI + Python](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.13-009688.svg)](https://github.com/Mohit1848/AVALANCHE)
[![Dataset: 65+ Global Avalanche Mountains](https://img.shields.io/badge/Dataset-65%2B%20Global%20Mountains-emerald.svg)](https://github.com/Mohit1848/AVALANCHE/blob/main/global_avalanche_mountains_master.csv)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Real-World Decision Support Platform for Avalanche Risk Assessment, Mountain Highway Safety, and Backcountry Intelligence.**  
> Combines calibrated machine learning models, deterministic physical heuristic safety overrides, high-resolution GIS topographic mapping, real-time SNOTEL/AWS telemetry ingestion, and a CSV-first Data Studio covering **65+ premier avalanche-prone peaks and passes across all 7 major mountain ranges worldwide**.

---

## 📸 System Overview & Core Capabilities

```
                  ┌──────────────────────────────────────────────────┐
                  │          AVALANCHE OPERATIONS CONSOLE            │
                  └─────────────────────────┬────────────────────────┘
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         ▼                                  ▼                                  ▼
┌──────────────────┐               ┌──────────────────┐               ┌──────────────────┐
│  🗺️ GIS CONSOLE  │               │ 📊 CSV STUDIO    │               │ 📈 ANALYTICS &   │
│  & TOPOGRAPHY    │               │ & BATCH INGEST   │               │   SAFETY BULLETINS│
├──────────────────┤               ├──────────────────┤               ├──────────────────┤
│• Worldwide GIS   │               │• CSV-first data  │               │• Snowfall 24h/72h│
│• Auto-detected   │               │• 1-Click Presets │               │• Wind vs Slope   │
│  7 continents    │               │• Drag & drop upload│             │• NA 1-5 Danger   │
│• 50m Contours    │               │• Real-time batch │               │  Scale Reference │
│• SNOTEL overlay  │               │  risk inference  │               │• Route bulletins │
└──────────────────┘               └──────────────────┘               └──────────────────┘
```

---

## 🌍 Global Mountain Coverage (65+ Worldwide Locations)

The system includes a master dataset (`global_avalanche_mountains_master.csv`) spanning all major avalanche-prone alpine corridors:

| Region | Key Peaks, Passes & Avalanche Corridors |
| :--- | :--- |
| **🏔️ Himalayas & Karakoram (Asia)** | Mount Everest (Khumbu Icefall), K2 (Bottleneck & Abruzzi Spur), Annapurna I (North Face Chute), Nanga Parbat (Rupal Face), Manaslu, Nanda Devi, Kedarnath, Rohtang Pass, Khardung La, Zojila Highway, Gulmarg Apharwat Peak, Nathu La, Siachen Ridge, Kamet, Kangchenjunga |
| **⛷️ European Alps (Europe)** | Mont Blanc (Grand Couloir), Matterhorn (East Face), Eiger (Nordwand), Jungfraujoch, Großglockner, Zugspitze, Chamonix (Aiguille du Midi), St. Anton am Arlberg, Val Thorens, Verbier, Monte Rosa, Cortina d'Ampezzo, Marmolada, Gotthard Pass, Stelvio Pass |
| **🌲 North America (Rockies, Cascades, Sierra & Alaska)** | Denali (Kahiltna Pass), Mount Rainier (Disappointment Cleaver), Mount Whitney, Grand Teton, Berthoud Pass Summit, Loveland Pass, Red Mountain Pass, Rogers Pass (BC Canada), Whistler Peak, Mount Washington, Mount Baker, Mount Shasta, Independence Pass, Thompson Pass, Haines Pass |
| **🌋 South American Andes** | Aconcagua (Polish Glacier), Huascarán (North Face), Alpamayo, Chimborazo, Cotopaxi Glacier, Paso Los Libertadores / Portillo, Cerro Fitz Roy (Supercanaleta), Torres del Paine |
| **🗾 Japan, NZ, Scandinavia & Caucasus** | Aoraki / Mount Cook, Mount Aspiring, Milford Sound Avalanche Highway (SH94), The Remarkables, Mount Fuji, Mount Hakuba (Happo-One), Mount Yotei / Niseko, Galdhøpiggen (Norway), Tromsø Lyngen Alps, Mount Elbrus, Mount Kazbek, Gudauri Pass |

---

## 📊 Standard CSV Data Schema

Every location conforms strictly to the standardized 13-column schema:

```csv
location_id,latitude,longitude,elevation,slope,aspect,temperature,snow_depth,snow_water_equivalent,snowfall_24h,snowfall_72h,wind_speed_mean_24h,wind_speed_max_24h
Mount Everest - Khumbu Icefall (Himalayas),27.988,86.925,5364,44.0,210,-18.5,190,320,38.0,75.0,35.0,72.0
Mont Blanc - Grand Couloir (French Alps),45.832,6.865,3800,42.5,310,-12.0,280,450,46.0,88.0,38.0,76.0
Denali - Kahiltna Pass (Alaska Range),63.069,-151.007,4300,43.0,225,-26.0,310,480,52.0,105.0,45.0,92.0
Aoraki / Mount Cook - Linda Glacier (NZ),-43.595,170.142,3500,45.0,45,-11.0,350,560,58.0,115.0,44.0,90.0
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18+) & **npm**
- **Python** (v3.10+)

### 1. Start the ML Backend (FastAPI)
```powershell
cd avalanche-prediction
python -m venv .venv
# Activate venv: .\.venv\Scripts\Activate.ps1 (Windows) or source .venv/bin/activate (Linux/Mac)
pip install -r requirements.txt
python -m uvicorn api.main:app --port 8000 --reload
```
- API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Start the Frontend (React + Vite)
```powershell
cd frontend
npm install
npm run dev
```
- Web Application: [http://localhost:5173/](http://localhost:5173/)

---

## 🏗️ Project Architecture

```
SIH AVALANCHE/
├── global_avalanche_mountains_master.csv  # Master 65+ Global Mountain Avalanche Dataset
├── avalanche-prediction/                  # FastAPI Backend & Machine Learning Pipeline
│   ├── api/                               # REST Endpoints (Prediction, Spatial, Telemetry, Health)
│   │   ├── routes/
│   │   │   ├── prediction.py              # Point & Batch CSV Inference Routes
│   │   │   ├── spatial.py                 # DEM & Spatial Grid Risk Surfaces
│   │   │   └── telemetry.py               # NRCS AWDB / SNOTEL Live Ingestion
│   │   ├── main.py                        # FastAPI Application Entrypoint
│   │   └── schemas.py                     # Pydantic Schemas & Validations
│   ├── data/                              # Training & Processed Datasets
│   ├── models/                            # Serialized ML Models & Calibrators
│   └── services/                          # Risk Engine & Deterministic Heuristics
└── frontend/                              # High-Performance React + Vite Web App
    ├── src/
    │   ├── components/
    │   │   ├── custom/CustomDataStudio.tsx     # CSV Data Studio & Batch Ingestion
    │   │   ├── analytics/SnowWeatherAnalytics.tsx # Multi-Pass Analytics Charts
    │   │   ├── advisories/SafetyAdvisoriesPanel.tsx # Emergency Bulletins & Mitigation
    │   │   ├── map/ColoradoMap.tsx             # Global Leaflet GIS Console
    │   │   └── risk/RiskAssessmentPanel.tsx    # Real-Time Risk Intelligence Card
    │   ├── services/api.ts                # API Client, CSV Parser, Auto-Mapper & Exporter
    │   ├── types/index.ts                 # Authoritative TypeScript Definitions
    │   └── App.tsx                        # Main Operational View Controller
    └── public/
        └── global_avalanche_mountains_master.csv # Public Downloadable Dataset
```

---

## 🛡️ Risk Assessment Engine & Heuristics

The platform uses a safety-critical **dual-layer evaluation model**:

1. **Calibrated Machine Learning Core**: Evaluates multi-dimensional meteorological & topographical features (temperature gradients, 24h/72h snowfall accumulation, wind loading, slope angle, aspect).
2. **Deterministic Safety Overrides**: Safety-critical heuristic policies automatically escalate risk levels to protect lives:
   - **Critical Starting Zone Slope Rule**: Slopes $\ge 34^\circ$ with rapid new snow accumulation $\ge 30\text{mm}$.
   - **High Wind Loading Rule**: Mean 24h wind $> 30\text{km/h}$ on lee aspects.
   - **Stale Telemetry Protection**: Automatically warns or suppresses risk predictions when sensor data exceeds 6 hours.

---

## 📜 License
This project is open-source under the [MIT License](LICENSE).
