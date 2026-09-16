# Procesamiento Diana

Aplicación web para preparar, balancear, ponderar y analizar encuestas. Procesa respuestas abiertas con Gemini, exporta bases originales/limpias/ponderadas y puede sincronizar resultados con Supabase para replicarlos a BigQuery.

Repositorio canónico: `jteplizky1/procesamiento_diana`. Las copias en otras cuentas u organizaciones no transfieren la titularidad ni reemplazan este origen.

## Inicio local

```powershell
python -m pip install -r requirements.txt
$env:GEMINI_API_KEY="..."
python server.py
```

También se puede usar `Iniciar Survey Studio V2.bat`. La aplicación abre `http://127.0.0.1:8765`.

## Variables de entorno

Copiá `.env.example` como referencia y configurá los secretos en el sistema o plataforma; la aplicación no carga `.env` automáticamente.

- `GEMINI_API_KEY`: clave backend de Gemini.
- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave exclusiva del backend para sincronización.
- `PORT` y `HOST`: para despliegue; Cloud Run usa `PORT=8080` y `HOST=0.0.0.0`.

Ejecutá `supabase/migrations/001_survey_storage.sql` en Supabase antes de usar **Sincronizar con Supabase**. Después configurá Supabase Pipelines con la publicación `survey_bigquery_publication` y BigQuery como destino.

## Datos y seguridad

`projects/`, `snapshots/`, exportaciones y variables de entorno están excluidos de Git. No subas respuestas, claves ni archivos generados al repositorio.

## Pruebas

```powershell
python -m unittest discover -q
node --check static/app.js
```
