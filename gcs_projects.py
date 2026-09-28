"""Persistencia de proyectos en Google Cloud Storage usando ADC.

No guarda credenciales: en Cloud Run usa la identidad del servicio y en una PC
usa Application Default Credentials (gcloud auth application-default login).
"""
from __future__ import annotations

import json
import os
import re
import urllib.parse
from pathlib import Path


DEFAULT_BUCKET = "wildfi-sandbox-diana-analysis"


def bucket_name() -> str:
    value = (os.getenv("GCS_PROJECTS_BUCKET") or DEFAULT_BUCKET).strip()
    return value.removeprefix("gs://").strip("/")


def _session():
    try:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
    except ImportError as error:
        raise ValueError("Falta google-auth[requests] para conectarse a Cloud Storage.") from error
    credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    return AuthorizedSession(credentials)


def _slug(value: str) -> str:
    import unicodedata
    value = "".join(c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c))
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-.").lower()
    return value[:80] or "proyecto"


def project_prefix(project: dict) -> str:
    # El ID evita colisiones entre proyectos que tengan el mismo nombre.
    return f"projects/{_slug(project.get('name', 'proyecto'))}--{project['id']}/"


def _object_url(name: str, *, media: bool = False) -> str:
    base = f"https://storage.googleapis.com/storage/v1/b/{urllib.parse.quote(bucket_name(), safe='')}/o"
    encoded = urllib.parse.quote(name, safe="")
    return f"{base}/{encoded}" + ("?alt=media" if media else "")


def upload(name: str, payload: bytes, content_type: str) -> None:
    url = (f"https://storage.googleapis.com/upload/storage/v1/b/{urllib.parse.quote(bucket_name(), safe='')}"
           f"/o?uploadType=media&name={urllib.parse.quote(name, safe='')}")
    response = _session().post(url, data=payload, headers={"Content-Type": content_type}, timeout=180)
    if response.status_code >= 400:
        raise ValueError(f"Cloud Storage respondió HTTP {response.status_code}: {response.text[:1500]}")


def download(name: str) -> bytes:
    response = _session().get(_object_url(name, media=True), timeout=180)
    if response.status_code >= 400:
        raise ValueError(f"No se pudo descargar {name}: HTTP {response.status_code}: {response.text[:1000]}")
    return response.content


def list_cloud_projects() -> list[dict]:
    url = (f"https://storage.googleapis.com/storage/v1/b/{urllib.parse.quote(bucket_name(), safe='')}/o"
           "?prefix=projects%2F")
    response = _session().get(url, timeout=120)
    if response.status_code >= 400:
        raise ValueError(f"No se pudieron listar los proyectos: HTTP {response.status_code}: {response.text[:1200]}")
    result = []
    for item in response.json().get("items", []):
        if not item.get("name", "").endswith("/project.json"):
            continue
        try:
            project = json.loads(download(item["name"]).decode("utf-8"))
            result.append({
                "id": project["id"], "name": project.get("name", "Sin nombre"),
                "description": project.get("description", ""),
                "updated_at": project.get("updated_at", item.get("updated", "")),
                "prefix": item["name"].removesuffix("project.json"),
            })
        except Exception:
            continue
    return sorted(result, key=lambda row: row.get("updated_at", ""), reverse=True)


def save_bundle(project: dict, project_file: Path, snapshot_file: Path | None, workbook: bytes | None) -> dict:
    prefix = project_prefix(project)
    upload(prefix + "project.json", project_file.read_bytes(), "application/json; charset=utf-8")
    files = ["project.json"]
    if snapshot_file and snapshot_file.exists():
        upload(prefix + "source.jsonl", snapshot_file.read_bytes(), "application/x-ndjson; charset=utf-8")
        files.append("source.jsonl")
    if workbook is not None:
        upload(prefix + "processed-results.xlsx", workbook,
               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        files.append("processed-results.xlsx")
    return {"saved": True, "bucket": f"gs://{bucket_name()}", "prefix": prefix, "files": files}


def restore(prefix: str, projects_dir: Path, snapshots_dir: Path) -> dict:
    if not re.fullmatch(r"projects/[A-Za-z0-9._/-]+/", prefix or ""):
        raise ValueError("Ruta de proyecto inválida en Cloud Storage.")
    project = json.loads(download(prefix + "project.json").decode("utf-8"))
    project_id = str(project.get("id", ""))
    if not re.fullmatch(r"[A-Za-z0-9_-]+", project_id):
        raise ValueError("El proyecto remoto contiene un ID inválido.")
    projects_dir.mkdir(parents=True, exist_ok=True)
    snapshots_dir.mkdir(parents=True, exist_ok=True)
    (projects_dir / f"{project_id}.json").write_text(
        json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    try:
        source = download(prefix + "source.jsonl")
    except ValueError as error:
        if "HTTP 404" not in str(error):
            raise
    else:
        (snapshots_dir / f"{project_id}.jsonl").write_bytes(source)
    return project
