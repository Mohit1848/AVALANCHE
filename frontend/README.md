# Avalanche Risk Intelligence — GIS Console

Interactive React GIS console for the Avalanche Risk Intelligence Platform.
Visualizes spatiotemporal risk surfaces, telemetry reliability, prediction
audit history, and model validation metrics.

> [!WARNING]
> This console renders **research decision-support indicators**. It is not a
> certified avalanche warning interface. The disclaimer banner and
> `NON-AUTONOMOUS` indicator are constraints, not decoration — they must not be
> removed or de-emphasized. See
> [../docs/USAGE_CONSTRAINTS.md](../docs/USAGE_CONSTRAINTS.md).

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Mapping | Leaflet + react-leaflet |
| Charts | Recharts |
| Styling | Tailwind CSS 4 (PostCSS) |
| Icons | lucide-react |
| Testing | Vitest + Testing Library (jsdom) |
| Linting | oxlint |

---

## 2. Running

The backend must be running first — the console has no offline mode.

```bash
# Backend (separate terminal, from repo root)
cd avalanche-prediction
.venv/Scripts/python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Console: http://localhost:5173

If the backend is unreachable the console displays an
**INFERENCE SERVICE NOTICE** banner rather than degrading silently.

### Scripts

| Command | Effect |
|---|---|
| `npm run dev` | Vite dev server with HMR on 5173 |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |
| `npx vitest run` | Run the test suite once |
| `npx vitest` | Watch mode |

---

## 3. Console Tabs

| Tab | Contents |
|---|---|
| **Risk Console** | Leaflet map with station markers, forecast zones, CAIC event pins, risk-surface cells and contours; target-location evaluation; terrain, snowpack, and weather panels |
| **Spatial Intelligence** | IDW interpolation parameters, risk-surface generation, GIS layer toggles |
| **Risk History** | Calibrated probability vs. final policy score over time, with explainable escalation audit cards |
| **Historical Playback** | Reconstruction of three confirmed Colorado storm cycles, labelled `HISTORICAL RECONSTRUCTION • NOT A LIVE FORECAST` |
| **Model Evaluation** | Validation metrics, calibration reliability curve, threshold tradeoff table |

A region selector switches between **Colorado** (alpine model enabled) and
**Indian Himalayas** (geographic catalog only — no trained model, no
predictions).

### Status Indicators

The header exposes live system state: `LIVE MODE`, `API: ONLINE/OFFLINE`,
`MODEL: LOADED`, `TELEMETRY: GOOD/DEGRADED/STALE`, and telemetry age.

> [!NOTE]
> `TELEMETRY: STALE` is expected on a fresh checkout — seeded observations are
> real readings from the 2023–24 season, so the freshness gate correctly
> classifies them as stale.

---

## 4. Structure

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Tab routing, region selection, global state |
| `src/services/api.ts` | **Single HTTP boundary** to the backend |
| `src/types/index.ts` | Shared TypeScript types |
| `src/components/map/` | `ColoradoMap` — Leaflet GIS console |
| `src/components/risk/` | `RiskAssessmentPanel` |
| `src/components/spatial/` | `SpatialIntelligencePanel` |
| `src/components/history/` | `RiskHistoryTimeline`, `HistoricalPlaybackPanel` |
| `src/components/model/` | `ModelResearchPage` |
| `src/components/terrain/` | `TerrainPanel` — DEM, slope, aspect |
| `src/components/snowpack/` | `SnowpackPanel` — depth, SWE, load deltas |
| `src/components/weather/` | `WeatherPanel` |
| `src/components/telemetry/` | `TelemetrySimulationPanel` |
| `src/components/india/` | `IndianPeakPanel` |
| `src/components/common/` | `Header`, `DisclaimerBanner` |

---

## 5. Architectural Constraint

> [!IMPORTANT]
> **The backend is the single source of truth for predictions.** This console
> must never compute probabilities, apply thresholds, or execute risk-engine
> policy. It renders what the API returns.

Duplicated policy logic drifts: if the frontend recomputed a risk level, a rule
change in `ml/risk_engine.py` would silently produce two different answers for
the same conditions, and the stored audit trail would no longer describe what
the user actually saw.

Adding a display that appears to compute risk? Add a backend field and render
it instead.

---

## 6. Backend Configuration

`API_BASE_URL` is a hardcoded literal in `src/services/api.ts`:

```ts
const API_BASE_URL = 'http://localhost:8000';
```

It is not environment-configurable. Pointing the console at a different backend
currently requires editing that file.

---

## 7. Testing

```bash
npx vitest run
```

**Status (verified 2026-08-17):** 16 tests passing in
`src/tests/console.test.tsx`.

Vitest configuration lives inside `vite.config.ts` (`environment: 'jsdom'`,
`globals: true`) rather than a separate config file.

---

## 8. Further Documentation

| Document | Covers |
|---|---|
| [../docs/README.md](../docs/README.md) | Documentation index |
| [../docs/API_REFERENCE.md](../docs/API_REFERENCE.md) | Endpoints this console consumes |
| [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | System topology |
| [../docs/USAGE_CONSTRAINTS.md](../docs/USAGE_CONSTRAINTS.md) | Display and disclaimer requirements |
| [../docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md) | Setup and troubleshooting |
