import copy
import io
import json
import unittest
from unittest.mock import patch
import pandas as pd
import server
from text_prompts import category_request
from text_resilience import (OutputLimitError, ModelInterruptedError, RETRY_ATTEMPT,
                             run_with_retries)


class SemanticRecoveryTests(unittest.TestCase):
    def test_catalog_recovery_uses_smaller_whole_samples(self):
        frame = pd.DataFrame({'Q': [f'Respuesta completa {i}' for i in range(60)]})
        saved = {'id': 'test'}
        samples = []
        def persist(project):
            saved.clear(); saved.update(copy.deepcopy(project))
        def call(project, messages, schema):
            payload = json.loads(messages[1]['content'])
            if 'respuestas_de_muestra' in payload:
                sample = payload['respuestas_de_muestra']
                samples.append(sample)
                self.assertTrue(all(v in frame['Q'].tolist() for v in sample))
                if len(samples) < 3:
                    raise OutputLimitError('Creación de categorías: salida agotada')
                return {'segments': [{'name': 'Interés por diseño'}]}
            return {'items': [{'id': 0, 'segment': 'Interés por diseño'}]}
        with patch.object(server, 'sample_frame', return_value=frame), \
             patch.object(server, 'read_project', side_effect=lambda _: copy.deepcopy(saved)), \
             patch.object(server, 'save_project', side_effect=persist), \
             patch.object(server, 'ai_request', side_effect=call):
            result = run_with_retries(lambda size: server.process_text(copy.deepcopy(saved), frame, 'Q', size),
                                      4, lambda **kw: None, lambda: False, lambda _: None)
        self.assertEqual(list(map(len, samples)), [50, 25, 12])
        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['remaining'], 59)
        self.assertIn('Q [segmentos:libre]', saved['text_codebooks'])
        self.assertEqual(RETRY_ATTEMPT.get(), 0)

    def test_length_is_typed_and_includes_stage(self):
        raw = json.dumps({'candidates': [{'finishReason': 'MAX_TOKENS', 'content': {'parts': []}}]})
        with patch.object(server.urllib.request, 'urlopen', return_value=io.BytesIO(raw.encode())):
            with self.assertRaisesRegex(OutputLimitError, 'MAX_TOKENS'):
                server.ai_request({'ai': {'api_key': 'test'}}, [{'role':'user','content':'x'}], {})

    def test_no_unrequested_category_count(self):
        request = category_request('Q', ['Una respuesta'], retry_attempt=2)
        self.assertNotIn('maxItems', request['schema']['properties']['segments'])
        fixed = category_request('Q', ['Una respuesta'], count=15, retry_attempt=2)
        self.assertEqual(fixed['schema']['properties']['segments']['maxItems'], 15)

    def test_eof_exhaustion_is_bounded(self):
        calls = []
        def fail(size):
            calls.append(size)
            raise ModelInterruptedError('unexpected EOF')
        with self.assertRaises(ModelInterruptedError):
            run_with_retries(fail, 1, lambda **kw: None, lambda: False, lambda _: None)
        self.assertEqual(calls, [1, 1, 1])

if __name__ == '__main__':
    unittest.main()
