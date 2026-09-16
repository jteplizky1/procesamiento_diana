"""Proveedor de IA desacoplado. Gemini es el proveedor productivo por defecto."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from text_resilience import OutputLimitError


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def _config(project: dict) -> dict:
    return project.get("ai", {})


def _api_key(config: dict) -> str:
    return (config.get("api_key") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()


def _error_detail(error: urllib.error.HTTPError, secret: str) -> str:
    detail = error.read().decode("utf-8", errors="replace")
    return detail.replace(secret, "[clave oculta]") if secret else detail


def _vertex_payload(config: dict, model: str, body: dict) -> tuple[dict, str]:
    """Llama Vertex AI con ADC; en Cloud Run usa automáticamente la service identity."""
    try:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
    except ImportError as error:
        raise ValueError("Falta google-auth[requests] para usar Gemini mediante Vertex AI.") from error
    credentials, detected_project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    project_id = (config.get("project_id") or os.getenv("GOOGLE_CLOUD_PROJECT") or
                  os.getenv("GCLOUD_PROJECT") or detected_project)
    if not project_id:
        raise ValueError("Vertex AI no pudo determinar el proyecto de Google Cloud mediante ADC.")
    location = config.get("location") or os.getenv("GOOGLE_CLOUD_LOCATION") or "us-central1"
    url = (f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}"
           f"/publishers/google/models/{urllib.parse.quote(model, safe='')}:generateContent")
    response = AuthorizedSession(credentials).post(url, json=body, timeout=int(config.get("timeout_seconds", 300)))
    if response.status_code >= 400:
        raise ValueError(f"Vertex AI respondió con HTTP {response.status_code}: {response.text}")
    return response.json(), "vertex-ai"


def gemini_request(project: dict, messages: list[dict], schema: dict, notify=lambda **kw: None) -> dict:
    config = _config(project)
    key = _api_key(config)
    provider = (config.get("provider") or "auto").strip().lower()
    model = (config.get("model") or DEFAULT_GEMINI_MODEL).strip()
    system = "\n\n".join(str(m.get("content", "")) for m in messages if m.get("role") == "system").strip()
    contents = []
    for message in messages:
        if message.get("role") == "system":
            continue
        role = "model" if message.get("role") in {"assistant", "model"} else "user"
        contents.append({"role": role, "parts": [{"text": str(message.get("content", ""))}]})
    generation = {"responseMimeType": "application/json", "responseJsonSchema": schema,
                  "temperature": float(config.get("temperature", 0.1)),
                  "maxOutputTokens": int(config.get("max_output_tokens", 8192))}
    body = {"contents": contents, "generationConfig": generation}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    started = time.monotonic()
    notify(generated_chars=0, waiting_since=time.time(), last_activity=None, prompt_messages=messages,
           prompt_schema=schema, model=model, options=generation)
    selected_provider = "gemini-api"
    if provider == "vertex" or (provider == "auto" and (os.getenv("K_SERVICE") or not key)):
        payload, selected_provider = _vertex_payload(config, model, body)
    else:
        if not key:
            raise ValueError("Falta GEMINI_API_KEY para uso local o configurá credenciales ADC de Google Cloud.")
        url = (config.get("base_url") or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        url += f"/models/{urllib.parse.quote(model, safe='')}:generateContent"
        request = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                                         headers={"Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urllib.request.urlopen(request, timeout=int(config.get("timeout_seconds", 300))) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = _error_detail(error, key)
            if error.code in (401, 403):
                raise ValueError(f"Gemini rechazó la autenticación ({error.code}). Revisá GEMINI_API_KEY.\n{detail}") from error
            if error.code == 429:
                raise ValueError(f"Gemini alcanzó el límite temporal de solicitudes (429). El lote puede reintentarse.\n{detail}") from error
            raise ValueError(f"Gemini respondió con error HTTP {error.code}.\n{detail}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            raise ValueError(f"No se pudo completar la llamada a Gemini: {getattr(error, 'reason', error)}") from error
    candidates = payload.get("candidates") or []
    if not candidates:
        raise ValueError(f"Gemini no devolvió candidatos válidos: {json.dumps(payload, ensure_ascii=False)[:1000]}")
    candidate = candidates[0]
    if candidate.get("finishReason") in {"MAX_TOKENS", "MALFORMED_FUNCTION_CALL"}:
        raise OutputLimitError(f"Gemini interrumpió la salida ({candidate.get('finishReason')}). Reducí el lote.")
    text = "".join(part.get("text", "") for part in candidate.get("content", {}).get("parts", []))
    notify(generated_chars=len(text), last_activity=time.time())
    if not text.strip():
        raise ValueError("Gemini devolvió una respuesta vacía.")
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(f"Gemini devolvió JSON inválido: {text[:1000]}") from error


def test_gemini(config: dict) -> dict:
    project = {"ai": config}
    started = time.perf_counter()
    result = gemini_request(project, [{"role": "user", "content": "Respondé con ok=true."}],
                             {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"]})
    return {"ok": bool(result.get("ok")), "latency_ms": round((time.perf_counter() - started) * 1000),
            "model": (config.get("model") or DEFAULT_GEMINI_MODEL),
            "provider": config.get("provider") or "auto"}
