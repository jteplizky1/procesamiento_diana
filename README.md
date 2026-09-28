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

- `GEMINI_API_KEY`: solamente para desarrollo local sin ADC; es opcional en Cloud Run.
- `GCS_BUCKET` o `GCS_PROJECTS_BUCKET`: bucket donde se guardan y recuperan proyectos; por defecto `wildfi-sandbox-diana-analysis`.
- `GOOGLE_CLOUD_PROJECT`: proyecto de Google Cloud para Vertex AI; en el sandbox es `566529420133`.
- `GOOGLE_CLOUD_LOCATION`: región de Vertex AI, por defecto `us-central1`.
- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave exclusiva del backend para sincronización.
- `PORT` y `HOST`: para despliegue; Cloud Run usa `PORT=8080` y `HOST=0.0.0.0`.

En Cloud Run, Gemini se invoca mediante Vertex AI y Application Default Credentials usando la identidad asociada al servicio. No se configura una clave JSON ni `GEMINI_API_KEY` en producción. El contenedor escucha en `0.0.0.0:$PORT`.

La misma identidad se usa para Cloud Storage. Debe tener permisos para listar, crear, leer y actualizar objetos en `gs://wildfi-sandbox-diana-analysis` (por ejemplo, `roles/storage.objectUser` sobre ese bucket). En una PC local, iniciá ADC una vez con:

```powershell
gcloud auth application-default login
```

El botón **Guardar en sandbox** crea `projects/<nombre>--<id>/` con `project.json`, la copia `source.jsonl` y, cuando corresponde, `processed-results.xlsx`. **Abrir del sandbox** restaura esos archivos localmente para continuar o retrabajar el proyecto. La descarga directa a la PC sigue disponible en Exportación.

Ejecutá `supabase/migrations/001_survey_storage.sql` en Supabase antes de usar **Sincronizar con Supabase**. Después configurá Supabase Pipelines con la publicación `survey_bigquery_publication` y BigQuery como destino.

## Datos y seguridad

`projects/`, `snapshots/`, exportaciones y variables de entorno están excluidos de Git. No subas respuestas, claves ni archivos generados al repositorio.

## Pruebas

```powershell
python -m unittest discover -q
node --check static/app.js
```
