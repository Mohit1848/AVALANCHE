# Project Structure

This repository uses one canonical layout:

```text
SIH AVLANCHE/
├── avalanche-prediction/          # FastAPI backend, ML pipeline, data, tests
├── frontend/                      # React + Vite web application
├── docs/                          # Architecture, API, validation, reports
├── global_avalanche_mountains_master.csv
├── README.md
└── PROJECT_STRUCTURE.md
```

## Where To Work

- Backend/API changes: `avalanche-prediction/api/`
- ML and evaluation changes: `avalanche-prediction/ml/`
- Backend tests: `avalanche-prediction/tests/`
- Frontend UI changes: `frontend/src/`
- Frontend tests: `frontend/src/tests/`
- Project documentation: `docs/`

## Archived Material

Generated exports, duplicate snapshots, and loose draft files belong in
`_archive/` or `docs/archive/` so the project root stays focused on the active
application.
