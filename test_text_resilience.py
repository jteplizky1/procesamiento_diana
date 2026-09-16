import unittest
import urllib.error
import json
from text_resilience import run_with_retries, StopRequested
from text_prompts import classification_request


class ResilienceTests(unittest.TestCase):
    def test_retry_smaller_batch_and_pause(self):
        sizes, pauses = [], []
        def operation(size):
            sizes.append(size)
            if len(sizes) < 3:
                try:
                    raise TimeoutError('slow')
                except TimeoutError as cause:
                    raise ValueError('wrapped') from cause
            return 'ok'
        result = run_with_retries(operation, 10, lambda **kw: None, lambda: False, pauses.append)
        self.assertEqual(result, 'ok')
        self.assertEqual(sizes, [10, 5, 2])
        self.assertEqual(sum(pauses), 90)

    def test_auth_not_retried(self):
        attempts = []
        def operation(size):
            attempts.append(size)
            raise urllib.error.HTTPError('test', 401, 'unauthorized', {}, None)
        with self.assertRaises(urllib.error.HTTPError):
            run_with_retries(operation, 10, lambda **kw: None, lambda: False, lambda _: None)
        self.assertEqual(len(attempts), 1)

    def test_stop_during_pause(self):
        paused = []
        def operation(size):
            raise TimeoutError()
        with self.assertRaises(StopRequested):
            run_with_retries(operation, 5, lambda **kw: None, lambda: bool(paused), paused.append)

    def test_reference_budget_and_relevance(self):
        examples = {f'example {i}': 'Brand' for i in range(100)}
        examples['volkswajen'] = 'Volkswagen'
        request = classification_request('Q', ['volkswajen'], 'brands', examples=examples)
        selected = json.loads(request['messages'][1]['content'])['correcciones_humanas']
        self.assertEqual(selected['volkswajen'], 'Volkswagen')
        self.assertLessEqual(len(selected), 12)
        self.assertLessEqual(sum(len(k)+len(v) for k,v in selected.items()), 1800)

if __name__ == '__main__':
    unittest.main()
