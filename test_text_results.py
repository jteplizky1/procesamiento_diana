import copy
import unittest
from unittest.mock import patch

import pandas as pd
import server


class TextResultsTests(unittest.TestCase):
    def setUp(self):
        self.frame = pd.DataFrame({'Q': ['jiundai', 'Corolla', 'Ford']})
        self.saved = {'id': 'synthetic-test', 'text_codebooks': {
            'Q [marcas]': [{'name': 'Hyundai'}, {'name': 'Toyota'}, {'name': 'Ford'}]}}
        self.stack = []
        for target, effect in [
            ('sample_frame', lambda frame, project: frame),
            ('read_project', lambda pid: copy.deepcopy(self.saved)),
            ('save_project', self.persist),
        ]:
            mocker = patch.object(server, target, side_effect=effect)
            mocker.start()
            self.addCleanup(mocker.stop)

    def persist(self, project):
        self.saved = copy.deepcopy(project)

    def run_batch(self, items, size=2):
        with patch.object(server, 'ai_request', return_value={'items': items}):
            return server.process_text(copy.deepcopy(self.saved), self.frame, 'Q', size, 'brands')

    def test_batches_append_and_preserve_review(self):
        result = self.run_batch([{'id': 1, 'segment': 'Toyota'}, {'id': 0, 'segment': 'Hyundai'}])
        self.assertEqual(result['processed'], 2)
        self.saved['text_classifications']['Q']['jiundai']['approved'] = True
        result = self.run_batch([{'id': 0, 'segment': 'Ford'}])
        rows = self.saved['text_classifications']['Q']
        self.assertEqual(list(rows), ['jiundai', 'Corolla', 'Ford'])
        self.assertEqual([r['batch'] for r in rows.values()], [1, 1, 2])
        self.assertTrue(rows['jiundai']['approved'])
        self.assertEqual(result['completed'], 3)
        self.assertEqual(result['remaining'], 0)

    def test_empty_is_not_success(self):
        with self.assertRaisesRegex(ValueError, 'no devolvió clasificaciones válidas'):
            self.run_batch([])
        self.assertNotIn('text_classifications', self.saved)

    def test_partial_counts_only_saved(self):
        result = self.run_batch([{'id': 0, 'segment': 'Hyundai'}, {'id': 99, 'segment': 'Invalid'}])
        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['remaining'], 2)


if __name__ == '__main__':
    unittest.main()
