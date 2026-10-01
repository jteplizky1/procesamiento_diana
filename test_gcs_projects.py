import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import gcs_projects


class GcsProjectsTests(unittest.TestCase):
    def test_job_progress_is_stored_as_json(self):
        job = {'id': 'job123', 'project_id': 'project1', 'status': 'running', 'percent': 25}
        with patch.object(gcs_projects, 'upload') as upload:
            gcs_projects.save_job(job)
        name, payload, content_type = upload.call_args.args
        self.assertEqual(name, 'jobs/job123.json')
        self.assertEqual(json.loads(payload), job)
        self.assertEqual(content_type, 'application/json; charset=utf-8')

    def test_job_progress_can_be_loaded(self):
        with patch.object(gcs_projects, 'download', return_value=b'{"id":"job123","status":"complete"}'):
            job = gcs_projects.load_job('job123')
        self.assertEqual(job['status'], 'complete')

    def test_prefix_uses_safe_name_and_id(self):
        self.assertEqual(
            gcs_projects.project_prefix({"id": "abc123", "name": "Encuesta Región Ñ"}),
            "projects/encuesta-region-n--abc123/",
        )

    def test_restore_writes_project_and_source(self):
        project = {"id": "abc123", "name": "Encuesta"}
        payloads = {
            "projects/encuesta--abc123/project.json": json.dumps(project).encode(),
            "projects/encuesta--abc123/source.jsonl": b'{"respuesta":"si"}\n',
        }
        with tempfile.TemporaryDirectory() as folder, patch.object(
            gcs_projects, "download", side_effect=lambda name: payloads[name]
        ):
            root = Path(folder)
            result = gcs_projects.restore(
                "projects/encuesta--abc123/", root / "projects", root / "snapshots"
            )
            self.assertEqual(result, project)
            self.assertTrue((root / "projects" / "abc123.json").exists())
            self.assertTrue((root / "snapshots" / "abc123.jsonl").exists())

    def test_restore_rejects_unsafe_prefix(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with self.assertRaises(ValueError):
                gcs_projects.restore("../secrets/", root, root)


if __name__ == "__main__":
    unittest.main()
