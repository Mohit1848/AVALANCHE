"""USDA NRCS National Water and Climate Center AWDB REST API Client.

Official data source adapter for live Colorado SNOTEL telemetry.
Base URL: https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1
Documentation: https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui.html
"""

from __future__ import annotations

import datetime
import hashlib
import json
import logging
import os
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("avalanche.awdb")

DEFAULT_AWDB_BASE_URL = "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1"
RAW_AWDB_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "raw" / "colorado" / "awdb"


class AWDBClient:
    """Client for USDA NRCS AWDB RESTful Web Service."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout_seconds: float = 15.0,
        max_retries: int = 3,
        retry_backoff_factor: float = 1.5,
        raw_storage_dir: Optional[Path] = None,
    ):
        self.base_url = (base_url or os.environ.get("AWDB_BASE_URL") or DEFAULT_AWDB_BASE_URL).rstrip("/")
        self.timeout_seconds = float(timeout_seconds)
        self.max_retries = int(max_retries)
        self.retry_backoff_factor = float(retry_backoff_factor)
        self.raw_storage_dir = raw_storage_dir or RAW_AWDB_DIR
        self.raw_storage_dir.mkdir(parents=True, exist_ok=True)
        self._ssl_context = ssl.create_default_context()

    def _http_get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Tuple[bytes, int, Dict[str, str]]:
        """Perform an HTTP GET request with exponential backoff retry."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        if params:
            query_str = urllib.parse.urlencode(params)
            url = f"{url}?{query_str}"

        headers = {
            "User-Agent": "AvalanchePredictionSystem/1.0 (USDA NRCS SNOTEL Client)",
            "Accept": "application/json",
        }

        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            req = urllib.request.Request(url, headers=headers, method="GET")
            try:
                logger.info(f"AWDB Request [Attempt {attempt}/{self.max_retries}]: {url}")
                with urllib.request.urlopen(req, timeout=self.timeout_seconds, context=self._ssl_context) as resp:
                    status_code = resp.status
                    resp_bytes = resp.read()
                    resp_headers = dict(resp.getheaders())
                    return resp_bytes, status_code, resp_headers
            except urllib.error.HTTPError as http_err:
                last_exc = http_err
                logger.warning(f"AWDB HTTP error {http_err.code} on {url}: {http_err.reason}")
                if http_err.code in (400, 404, 422):
                    # Client errors that won't benefit from immediate retry
                    raise http_err
            except (urllib.error.URLError, TimeoutError, ConnectionError) as net_err:
                last_exc = net_err
                logger.warning(f"AWDB Network error on attempt {attempt}: {net_err}")

            if attempt < self.max_retries:
                sleep_time = self.retry_backoff_factor ** attempt
                logger.info(f"Backing off for {sleep_time:.2f}s before retry...")
                time.sleep(sleep_time)

        raise RuntimeError(f"AWDB request failed after {self.max_retries} attempts: {last_exc}") from last_exc

    def _save_raw_payload(
        self,
        endpoint_tag: str,
        raw_bytes: bytes,
        requested_at: str,
        station_id: Optional[str] = None
    ) -> Tuple[str, Path]:
        """Save raw immutable response to disk and compute SHA-256 hash for provenance."""
        sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
        date_str = requested_at.replace(":", "-").replace("Z", "")
        suffix = f"_{station_id}" if station_id else ""
        filename = f"{endpoint_tag}_{date_str}{suffix}_{sha256_hash[:8]}.json"
        filepath = self.raw_storage_dir / filename
        filepath.write_bytes(raw_bytes)
        return sha256_hash, filepath

    def get_stations(
        self,
        station_triplets: Optional[List[str]] = None,
        state_code: str = "CO",
        network_code: str = "SNTL"
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Fetch SNOTEL station metadata from AWDB.

        Endpoint: /stations
        """
        params: Dict[str, Any] = {}
        if station_triplets:
            params["stationTriplets"] = ",".join(station_triplets)
        else:
            if state_code:
                params["stateCds"] = state_code
            if network_code:
                params["networkCds"] = network_code

        requested_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        raw_bytes, status_code, _ = self._http_get("stations", params)
        sha256, filepath = self._save_raw_payload("stations_metadata", raw_bytes, requested_at)

        data = json.loads(raw_bytes.decode("utf-8"))
        if not isinstance(data, list):
            data = [data] if data else []

        provenance = {
            "provider": "NRCS_AWDB",
            "source_url": f"{self.base_url}/stations",
            "requested_at": requested_at,
            "status_code": status_code,
            "sha256": sha256,
            "raw_file_path": str(filepath),
            "record_count": len(data),
            "license": "USDA NRCS National Water and Climate Center (Public Domain)",
        }
        return data, provenance

    def get_hourly_data(
        self,
        station_triplets: List[str],
        elements: List[str],
        begin_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Fetch hourly observation time-series from AWDB.

        Endpoint: /data
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")
        if not begin_date:
            begin_date = (now - datetime.timedelta(days=3)).strftime("%Y-%m-%d")

        params = {
            "stationTriplets": ",".join(station_triplets),
            "elements": ",".join(elements),
            "duration": "HOURLY",
            "beginDate": begin_date,
            "endDate": end_date,
        }

        requested_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        raw_bytes, status_code, _ = self._http_get("data", params)
        sha256, filepath = self._save_raw_payload("hourly_observations", raw_bytes, requested_at)

        data = json.loads(raw_bytes.decode("utf-8"))
        if not isinstance(data, list):
            data = [data] if data else []

        provenance = {
            "provider": "NRCS_AWDB",
            "source_url": f"{self.base_url}/data",
            "requested_at": requested_at,
            "period": {"begin_date": begin_date, "end_date": end_date},
            "status_code": status_code,
            "sha256": sha256,
            "raw_file_path": str(filepath),
            "stations_requested": station_triplets,
            "elements_requested": elements,
            "license": "USDA NRCS National Water and Climate Center (Public Domain)",
        }
        return data, provenance


awdb_client = AWDBClient()
