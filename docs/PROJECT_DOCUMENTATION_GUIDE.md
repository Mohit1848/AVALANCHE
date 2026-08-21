# 🏔️ Global Avalanche Risk Intelligence System — Complete Human-Friendly Guide

> **A plain-English, beginner-friendly, and complete guide to how this project works, what each part does, and how anyone can run, understand, and present it.**

---

## 📖 1. What is this project?

The **Avalanche Risk Intelligence System** is a real-world decision-support platform designed to predict and monitor avalanche release hazards in mountainous terrain across the globe.

### 🎯 The Real-World Problem It Solves:
Every winter, avalanches cause loss of life, block strategic mountain highways (such as **Rohtang Pass**, **Zojila Pass**, **Red Mountain Pass**, and **Milford Sound Highway**), and endanger alpine expeditions. 

Traditional avalanche forecasting often relies purely on manual snow pit observations, which can be slow and dangerous to collect. This system combines **calibrated Machine Learning** with **physics-based safety rules** to deliver instant, reliable risk assessments for **65 premier mountain passes and peaks worldwide**.

---

## ⚙️ 2. How It Works (The 3-Step System)

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│   1. DATA COLLECTION    │ ──> │    2. DUAL AI ENGINE    │ ──> │   3. ACTIONABLE ALERTS  │
│ Terrain + Snowpack +    │     │ ML Model (Base Score)   │     │ Risk Score (0-100),     │
│ Weather Telemetry       │     │    + Safety Overrides   │     │ Advisories, Map Display │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

### Step 1: Gathering Mountain Data
The system looks at 13 key environmental and topographical factors:
1. **Latitude & Longitude**: Exact geographical location on Earth.
2. **Elevation**: Altitude in meters above sea level (e.g., 5,364m at Everest Base Camp).
3. **Slope Angle**: How steep the mountain slope is (the "sweet spot" for slab avalanches is $30^\circ$ to $45^\circ$).
4. **Aspect**: Which direction the slope faces (e.g., North, East, South, West) which dictates sun exposure and wind loading.
5. **Air Temperature**: Warmer temps cause wet loose avalanches; freezing temps preserve fragile weak layers.
6. **Snow Depth & Snow Water Equivalent (SWE)**: Total snow on the ground and its water density.
7. **24-Hour & 72-Hour New Snowfall**: How much fresh weight was suddenly dumped on old snow.
8. **Mean & Peak Wind Speeds**: Strong winds strip snow from windward faces and deposit dense, deadly "wind slabs" onto leeward chutes.

### Step 2: The Dual-Layer Brain
Instead of trusting a single black-box algorithm, the system uses two layers:
- **Layer A: Calibrated Machine Learning Model**:
  - Scikit-Learn models trained on historical meteorological and snowpack data to produce an initial probability score.
- **Layer B: Deterministic Physical Safety Rules (Overrides)**:
  - **Rule 1 (Storm Slab)**: If slope $\ge 34^\circ$ and 24h new snow $\ge 30\text{mm}$, risk is automatically upgraded to **HIGH** ($82/100$).
  - **Rule 2 (Wind Slab)**: If peak ridgeline winds exceed $65\text{ km/h}$, wind slab warnings are triggered.
  - **Rule 3 (Stale Data Protection)**: If remote weather sensors stop reporting for $>6\text{ hours}$, the status changes to "Degraded/Stale" so authorities don't make decisions on outdated numbers.

### Step 3: Clear Human Output
The system produces:
- **Numerical Risk Score (0 to 100)**
- **Danger Level**: Low (Green), Moderate (Yellow), Considerable/High (Red)
- **Active Safety Directive**: Immediate highway closure, Gazex detonation required, or safe for transit.

---

## 🖥️ 3. Tour of the Web Interface (The 4 Main Tabs)

When you open the web application at **`http://localhost:5173/`**, you have 4 tabs:

### 1. 🗺️ Operations Console
- **Interactive Topographic Map**: Real-time Leaflet GIS map showing color-coded pins for mountains worldwide. You can toggle 50m terrain contour lines, SNOTEL weather stations, and danger zones.
- **Global Mountain Pass Selector**: Filter 65 mountains by continent (**Himalayas**, **Alps**, **Americas**, **Pacific / Japan / NZ / Scandinavia**).
- **Physical Metrics Gauges**: Instant visual meters for temperature, snow depth, slope angle, wind speed, and precipitation.
- **Live Safety Recommendation Box**: Displays specific action steps for highway operators and rescue teams.

### 2. 📊 CSV Data Studio
- **Upload Your Own Data**: Drag and drop any `.csv` file containing custom mountain coordinates and weather readings.
- **1-Click Global Presets**: Instant buttons to test regional datasets with zero typing.
- **Intelligent Row Tokenizer**: Automatically parses columns, cleans unquoted commas, and validates numbers in real-time.
- **Batch Risk Evaluator**: Run predictions on dozens of mountains simultaneously with progress indicators and summary tables.

### 3. 📈 Snow & Weather Analytics
- **Multi-Mountain Comparison Charts**: Compare snowpack depth vs snowfall across multiple ranges.
- **Wind vs Slope Scatter Plots**: Understand which mountains have dangerous wind-loading at steep angles.
- **Elevation Profiles**: Rank mountains from sea-level coastal fjords (Norway) up to 8,000m Himalayan giants (Everest, K2).

### 4. ⚠️ Safety Advisories & Bulletins
- **Active Highway Emergency Alerts**: Real-time status for 8 critical transportation passes (**Rohtang Pass NH-3**, **Zojila NH-1**, **Red Mountain Pass US-550**, **Rogers Pass Trans-Canada Hwy**, **Milford Highway SH94**, etc.).
- **North American Avalanche Danger Scale**: Comprehensive 5-tier safety matrix (Low, Moderate, Considerable, High, Extreme).
- **Essential Safety Checklist**: Required gear guide (3-antenna 457 kHz beacons, 280cm probes, metal shovels, airbag packs).

---

## 📁 4. Project Structure & What Files Do

```
SIH AVALANCHE/
│
├── 📄 global_avalanche_mountains_master.csv  <-- Master dataset of 65 global mountain corridors
├── 📄 README.md                             <-- Main GitHub repository overview and badges
│
├── 📂 docs/                                 <-- All reports and documentation
│   ├── 📄 GLOBAL_AVALANCHE_ANALYSIS_REPORT.md   <-- Markdown version of global risk report
│   ├── 📄 GLOBAL_AVALANCHE_ANALYSIS_REPORT.html <-- Styled printable HTML format
│   ├── 📄 GLOBAL_AVALANCHE_ANALYSIS_REPORT.pdf  <-- Official multi-page PDF analysis report
│   ├── 📄 PROJECT_DOCUMENTATION_GUIDE.md        <-- This human-friendly guide
│   └── 📄 ARCHITECTURE.md                       <-- Technical system architecture & schemas
│
├── 📂 avalanche-prediction/                 <-- Backend & Machine Learning Service
│   ├── 📂 api/
│   │   ├── 📄 main.py                       <-- FastAPI server initialization & endpoints
│   │   └── 📂 routes/
│   │       ├── 📄 prediction.py             <-- Single point & batch inference logic
│   │       ├── 📄 telemetry.py              <-- Weather station telemetry ingestion
│   │       └── 📄 gis.py                    <-- GeoJSON elevation & spatial endpoints
│   ├── 📂 models/                           <-- Trained Scikit-Learn ML models (.joblib)
│   ├── 📂 pipelines/                        <-- Feature engineering & data preprocessing
│   └── 📄 generate_pdf_report.py            <-- Python script to compile the PDF report
│
└── 📂 frontend/                             <-- Modern React + TypeScript Web App
    ├── 📂 public/
    │   ├── 📄 global_avalanche_mountains_master.csv
    │   └── 📄 GLOBAL_AVALANCHE_ANALYSIS_REPORT.pdf
    └── 📂 src/
        ├── 📄 App.tsx                       <-- Main application controller & state
        ├── 📂 components/
        │   ├── 📂 console/                  <-- Operations Console & GIS Map
        │   ├── 📂 custom/                   <-- CSV Data Studio & Batch Processor
        │   ├── 📂 analytics/                <-- Weather & Snowpack Analytics Charts
        │   └── 📂 advisories/               <-- Highway Advisories & Bulletins
        ├── 📂 services/
        │   └── 📄 api.ts                    <-- API client, CSV tokenizer & preset templates
        └── 📂 types/
            └── 📄 index.ts                  <-- TypeScript interfaces & data contracts
```

---

## 🔑 5. Security, API Keys & Costs

- **Paid API Keys Required**: **0** (Zero).
- **External Subscriptions**: **None**.
- **Basemaps Used**: Free OpenStreetMap and CartoDB Dark basemaps via standard public tile servers.
- **Data Privacy**: All machine learning calculations run locally on your machine. No telemetry data is sent to external third parties.

---

## 🚀 6. How to Run the Project (Step-by-Step)

### Prerequisites:
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)

### 1. Start the Python Backend:
Open a terminal in the project directory:
```powershell
python -m uvicorn api.main:app --port 8000
```
- API will be live at: **`http://localhost:8000/`**
- Interactive Swagger docs at: **`http://localhost:8000/docs`**

### 2. Start the React Frontend:
Open a second terminal window:
```powershell
cd frontend
npm install
npm run dev
```
- Web Application will be live at: **`http://localhost:5173/`**

---

## 🏆 7. Summary for Demonstrations & Presentations

When explaining this project to evaluators, judges, or teammates, use this 30-second summary:
> *"Our project is an end-to-end Global Avalanche Decision-Support Platform. It processes real-time weather and terrain data across 65 major mountain corridors worldwide. It pairs a calibrated machine learning prediction engine with physical safety overrides to generate instant risk scores, interactive GIS maps, and automated highway advisories—allowing authorities to prevent avalanche disasters before they happen."*
