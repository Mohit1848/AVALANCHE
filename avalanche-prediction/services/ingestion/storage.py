"""Telemetry & Prediction Storage Engine."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "avalanche_telemetry.db"


class StorageManager:
    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=15.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Initialize telemetry and prediction database tables."""
        with self._get_connection() as conn:
            # 1. Telemetry Observations Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS telemetry_observations (
                    station_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    ingestion_timestamp TEXT NOT NULL,
                    temperature REAL,
                    snow_depth REAL,
                    snow_water_equivalent REAL,
                    precipitation REAL,
                    wind_speed REAL,
                    provenance_json TEXT,
                    PRIMARY KEY (station_id, timestamp)
                )
            """)

            # 2. Persisted Predictions History Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS prediction_history (
                    prediction_id TEXT PRIMARY KEY,
                    station_id TEXT NOT NULL,
                    zone_id TEXT,
                    timestamp TEXT NOT NULL,
                    evaluation_timestamp TEXT NOT NULL,
                    model_version TEXT NOT NULL,
                    dataset_version TEXT NOT NULL,
                    feature_schema_version TEXT NOT NULL,
                    risk_engine_version TEXT NOT NULL,
                    raw_probability REAL,
                    calibrated_probability REAL,
                    model_risk_score REAL,
                    final_risk_score REAL,
                    model_risk_level TEXT NOT NULL,
                    final_risk_level TEXT NOT NULL,
                    risk_escalated INTEGER NOT NULL,
                    risk_escalation_reasons_json TEXT,
                    data_quality TEXT NOT NULL,
                    warnings_json TEXT,
                    features_json TEXT,
                    provenance_json TEXT
                )
            """)
            conn.commit()

    def insert_observations(self, observations: List[Dict[str, Any]]) -> int:
        """Insert or replace telemetry observations."""
        if not observations:
            return 0
        
        inserted_count = 0
        with self._get_connection() as conn:
            for obs in observations:
                try:
                    conn.execute("""
                        INSERT OR REPLACE INTO telemetry_observations (
                            station_id, timestamp, ingestion_timestamp,
                            temperature, snow_depth, snow_water_equivalent,
                            precipitation, wind_speed, provenance_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        obs["station_id"],
                        obs["timestamp"],
                        obs["ingestion_timestamp"],
                        obs.get("temperature"),
                        obs.get("snow_depth"),
                        obs.get("snow_water_equivalent"),
                        obs.get("precipitation"),
                        obs.get("wind_speed"),
                        json.dumps(obs.get("provenance", {})),
                    ))
                    inserted_count += 1
                except Exception as exc:
                    print(f"Storage insert error for station {obs.get('station_id')}: {exc}")
            conn.commit()
        return inserted_count

    def get_telemetry_history(
        self,
        station_id: str,
        start_ts: Optional[str] = None,
        end_ts: Optional[str] = None,
        limit: int = 120
    ) -> List[Dict[str, Any]]:
        """Retrieve chronological telemetry time-series for a station."""
        query = "SELECT * FROM telemetry_observations WHERE station_id = ?"
        params: List[Any] = [str(station_id)]

        if start_ts:
            query += " AND timestamp >= ?"
            params.append(start_ts)
        if end_ts:
            query += " AND timestamp <= ?"
            params.append(end_ts)

        query += " ORDER BY timestamp ASC LIMIT ?"
        params.append(limit)

        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def get_latest_observation(self, station_id: str) -> Optional[Dict[str, Any]]:
        """Get the most recent observation for a station."""
        with self._get_connection() as conn:
            row = conn.execute("""
                SELECT * FROM telemetry_observations
                WHERE station_id = ?
                ORDER BY timestamp DESC LIMIT 1
            """, (str(station_id),)).fetchone()
            return dict(row) if row else None

    def insert_prediction(self, pred_data: Dict[str, Any]) -> None:
        """Insert prediction record into historical audit store."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO prediction_history (
                    prediction_id, station_id, zone_id, timestamp, evaluation_timestamp,
                    model_version, dataset_version, feature_schema_version, risk_engine_version,
                    raw_probability, calibrated_probability, model_risk_score, final_risk_score,
                    model_risk_level, final_risk_level, risk_escalated, risk_escalation_reasons_json,
                    data_quality, warnings_json, features_json, provenance_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                pred_data["prediction_id"],
                pred_data["station_id"],
                pred_data.get("zone_id", "UNKNOWN"),
                pred_data["timestamp"],
                pred_data["evaluation_timestamp"],
                pred_data.get("model_version", "v2_random_forest"),
                pred_data.get("dataset_version", "2015_2024_expanded"),
                pred_data.get("feature_schema_version", "v2_spatiotemporal_17f"),
                pred_data.get("risk_engine_version", "2.0.0"),
                pred_data.get("raw_probability"),
                pred_data.get("calibrated_probability"),
                pred_data.get("model_risk_score"),
                pred_data.get("final_risk_score"),
                pred_data.get("model_risk_level", "UNKNOWN"),
                pred_data.get("final_risk_level", "UNKNOWN"),
                1 if pred_data.get("risk_escalated") else 0,
                json.dumps(pred_data.get("risk_escalation_reasons", [])),
                pred_data.get("data_quality", "GOOD"),
                json.dumps(pred_data.get("warnings", [])),
                json.dumps(pred_data.get("features", {})),
                json.dumps(pred_data.get("provenance", {})),
            ))
            conn.commit()

    def get_predictions(
        self,
        station_id: Optional[str] = None,
        risk_level: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Retrieve recent prediction history with optional filtering."""
        query = "SELECT * FROM prediction_history WHERE 1=1"
        params: List[Any] = []

        if station_id:
            query += " AND station_id = ?"
            params.append(str(station_id))
        if risk_level:
            query += " AND final_risk_level = ?"
            params.append(risk_level)

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["risk_escalated"] = bool(d["risk_escalated"])
                d["risk_escalation_reasons"] = json.loads(d.get("risk_escalation_reasons_json") or "[]")
                d["warnings"] = json.loads(d.get("warnings_json") or "[]")
                results.append(d)
            return results

    def get_prediction_by_id(self, prediction_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific prediction record."""
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM prediction_history WHERE prediction_id = ?", (prediction_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["risk_escalated"] = bool(d["risk_escalated"])
            d["risk_escalation_reasons"] = json.loads(d.get("risk_escalation_reasons_json") or "[]")
            d["warnings"] = json.loads(d.get("warnings_json") or "[]")
            d["features"] = json.loads(d.get("features_json") or "{}")
            d["provenance"] = json.loads(d.get("provenance_json") or "{}")
            return d


storage_manager = StorageManager()
