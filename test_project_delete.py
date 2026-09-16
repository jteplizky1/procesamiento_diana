import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

import server


class ProjectDeleteTests(unittest.TestCase):
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
