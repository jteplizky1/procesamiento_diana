"""Sincronización explícita de resultados con Supabase mediante PostgREST."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


def configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


def _request(path: str, method="GET", body=None, prefer=None):
    base = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base or not key:
        raise ValueError("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    request = urllib.request.Request(base + "/rest/v1/" + path, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace").replace(key, "[clave oculta]")
        raise ValueError(f"Supabase respondió con HTTP {error.code}: {detail}") from error


def _replace(table: str, project_id: str, rows: list[dict], chunk_size=250):
    encoded = urllib.parse.quote(project_id, safe="")
    _request(f"{table}?project_id=eq.{encoded}", method="DELETE", prefer="return=minimal")
    for start in range(0, len(rows), chunk_size):
        _request(table, method="POST", body=rows[start:start + chunk_size], prefer="return=minimal")


def sync(project: dict, raw_rows: list[dict], processed_rows: list[dict], result_rows: list[dict]) -> dict:
    project_id = project["id"]
    now = datetime.now(timezone.utc).isoformat()
    public_project = {k: v for k, v in project.items() if k not in {"ai", "ollama"}}
    _request("survey_projects?on_conflict=id", method="POST", body=[{
        "id": project_id, "name": project.get("name", ""), "description": project.get("description", ""),
        "config": public_project, "updated_at": now,
    }], prefer="resolution=merge-duplicates,return=minimal")
    _replace("survey_raw_responses", project_id, raw_rows)
    _replace("survey_processed_responses", project_id, processed_rows)
    _replace("survey_quota_results", project_id, result_rows)
    return {"ok": True, "raw": len(raw_rows), "processed": len(processed_rows), "results": len(result_rows), "synced_at": now}
