import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

import server


class ProjectDeleteTests(unittest.TestCase):
    def test_every_project_save_schedules_cloud_checkpoint(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / 'abc123.json'
            with patch.object(server, 'project_path', return_value=path), patch.object(
                server, 'schedule_cloud_checkpoint'
            ) as schedule:
                server.save_project({'id': 'abc123', 'name': 'Persistente'})
            self.assertTrue(path.exists())
            schedule.assert_called_once_with('abc123')

    def test_cloud_hydration_restores_missing_projects(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            projects, snapshots = root / 'projects', root / 'snapshots'
            projects.mkdir(); snapshots.mkdir()
            remote = {'id': 'remote1', 'prefix': 'projects/remoto--remote1/',
                      'updated_at': '2026-10-01T10:00:00'}
            with patch.object(server, 'PROJECTS_DIR', projects), patch.object(
                server, 'SNAPSHOTS_DIR', snapshots
            ), patch.object(server, 'project_path', side_effect=lambda pid: projects / f'{pid}.json'), patch.object(
                server.gcs_projects, 'list_cloud_projects', return_value=[remote]
            ), patch.object(server.gcs_projects, 'restore') as restore:
                server.CLOUD_HYDRATION.update({'attempted_at': 0.0, 'complete': False, 'error': ''})
                result = server.hydrate_cloud_projects(force=True)
            self.assertTrue(result['complete'])
            restore.assert_called_once_with(remote['prefix'], projects, snapshots)

    def test_deletes_project_snapshot_and_cache(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            projects, snapshots, legacy = root / 'projects', root / 'snapshots', root / 'legacy'
            for folder in (projects, snapshots, legacy):
                folder.mkdir()
            (projects / 'abc123.json').write_text(json.dumps({'id': 'abc123'}), encoding='utf-8')
            (snapshots / 'abc123.jsonl').write_text('{}\n', encoding='utf-8')
            server.DATA_CACHE['abc123'] = pd.DataFrame({'x': [1]})
            with patch.object(server, 'PROJECTS_DIR', projects), patch.object(server, 'SNAPSHOTS_DIR', snapshots), patch.object(server, 'V1_PROJECTS', legacy):
                result = server.delete_project('abc123')
            self.assertTrue(result['deleted'])
            self.assertFalse((projects / 'abc123.json').exists())
            self.assertFalse((snapshots / 'abc123.jsonl').exists())
            self.assertNotIn('abc123', server.DATA_CACHE)

    def test_rejects_path_traversal(self):
        with self.assertRaisesRegex(ValueError, 'inválido'):
            server.delete_project('../projects')


if __name__ == '__main__':
    unittest.main()
