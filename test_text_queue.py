import copy
import io
import json
import threading
import unittest
from unittest.mock import patch

import pandas as pd
import server
from text_prompts import category_request, classification_request


class QueueTests(unittest.TestCase):
    def setUp(self):
        server.TEXT_JOBS.clear()
        self.project = {'id': 'test', 'dictionary': [
            {'pregunta': q, 'tipo': 'texto libre', 'incluir': True} for q in ['Q1', 'Q2']]}
        self.frame = pd.DataFrame({'Q1': ['a', 'b'], 'Q2': ['c', 'd']})

    def test_queue_finishes_question_before_next(self):
        finished = threading.Event()
        calls = []
        def fake_process(project, frame, question, *args):
            calls.append(question)
            n = calls.count(question)
            answer = self.frame[question][n-1]
            self.project.setdefault('text_classifications', {}).setdefault(question, {})[answer] = {'segment': 'X'}
            if len(calls) == 4:
                finished.set()
            return {'processed': 1, 'remaining': 2-n}
        with patch.object(server, 'read_project', side_effect=lambda _: copy.deepcopy(self.project)), \
             patch.object(server, 'load_source', return_value=self.frame), \
             patch.object(server, 'sample_frame', return_value=self.frame), \
             patch.object(server, 'process_text', side_effect=fake_process):
            job = server.start_text_job('test', {'questions': ['Q1', 'Q2']})
            self.assertTrue(finished.wait(3))
            worker = next((t for t in threading.enumerate() if t.name == 'text-job-'+job['id'][:8]), None)
            if worker:
                worker.join(3)
        self.assertEqual(calls, ['Q1', 'Q1', 'Q2', 'Q2'])
        final = server.TEXT_JOBS[job['id']]
        self.assertEqual(final['status'], 'complete')
        self.assertEqual(final['percent'], 100)
        self.assertEqual(final['completed'], 4)
        self.assertEqual(final['saved_batches'], 4)
        self.assertEqual([b['question'] for b in final['batches']], ['Q1', 'Q1', 'Q2', 'Q2'])
        self.assertEqual([b['number'] for b in final['batches']], [1, 2, 3, 4])
        self.assertEqual(sum(b['processed'] for b in final['batches']), 4)

    def test_refuses_concurrent_queue(self):
        server.TEXT_JOBS['busy'] = {'status': 'running'}
        with patch.object(server, 'read_project', return_value=self.project):
            with self.assertRaisesRegex(ValueError, 'Ya hay una cola'):
                server.start_text_job('test', {'questions': ['Q1']})

    def test_failed_question_does_not_block_next(self):
        import time
        calls = []
        def process(project, frame, question, *args):
            calls.append(question)
            if question == 'Q1':
                raise ValueError('Invalid model output')
            self.project.setdefault('text_classifications', {})[question] = {v: {'segment': 'X'} for v in self.frame[question]}
            return {'processed': 2, 'remaining': 0}
        with patch.object(server, 'read_project', side_effect=lambda _: copy.deepcopy(self.project)), \
             patch.object(server, 'load_source', return_value=self.frame), \
             patch.object(server, 'sample_frame', return_value=self.frame), \
             patch.object(server, 'process_text', side_effect=process):
            job = server.start_text_job('test', {'questions': ['Q1', 'Q2']})
            deadline = time.monotonic()+3
            while server.TEXT_JOBS[job['id']]['status'] == 'running' and time.monotonic() < deadline:
                time.sleep(.01)
        final = server.TEXT_JOBS[job['id']]
        self.assertEqual(calls, ['Q1', 'Q2'])
        self.assertEqual(final['status'], 'partial')
        self.assertEqual(final['remaining'], 2)
        self.assertEqual(final['completed'], 2)
        self.assertEqual(final['failed_questions'][0]['question'], 'Q1')

    def test_category_sample_is_bounded_and_whole(self):
        answers = [str(i)+' '+('x'*400) for i in range(220)]
        request = category_request('Q', answers)
        selected = json.loads(request['messages'][1]['content'])['respuestas_de_muestra']
        self.assertLessEqual(len(selected), 50)
        self.assertLessEqual(sum(map(len, selected)), 14000)
        self.assertTrue(all(v in answers for v in selected))

    def test_stance_template_requires_standard_prefixes(self):
        catalog = category_request('¿Lo compraría?', ['Sí, porque es económico'], mode='semantic_stance')
        self.assertIn('"Si,"', catalog['messages'][0]['content'])
        request = classification_request('¿Lo compraría?', ['tal vez si baja de precio'], 'semantic_stance',
                                         ['Depende, precio'])
        prompt = request['messages'][0]['content']
        self.assertIn('"Si,"', prompt)
        self.assertIn('"No,"', prompt)
        self.assertIn('"Depende,"', prompt)

    def test_text_selection_accepts_three_standard_templates(self):
        for mode in ('brands', 'semantic', 'semantic_stance'):
            questions, settings = server.text_selection(self.project, {
                'questions': ['Q1'], 'settings': {'Q1': {'mode': mode}}
            })
            self.assertEqual(questions, ['Q1'])
            self.assertEqual(settings['Q1']['mode'], mode)

    def test_brand_preview_skips_catalog(self):
        self.project['text_classifications'] = {}
        with patch.object(server, 'sample_frame', return_value=self.frame):
            preview = server.text_prompt_preview(self.project, self.frame, {
                'questions': ['Q1'], 'settings': {'Q1': {'mode': 'brands'}}})
        self.assertEqual(len(preview['requests']), 1)
        known, examples = server.brand_memory(self.project)
        self.assertEqual(preview['requests'][0], classification_request('Q1', ['a', 'b'], 'brands', known=known, examples=examples))

    def test_stream_collects_complete_json(self):
        payload = json.dumps({'items': [{'id': 0, 'segment': 'Toyota'}]})
        response = {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': payload}]}}]}
        with patch.object(server.urllib.request, 'urlopen', return_value=io.BytesIO(json.dumps(response).encode())):
            result = server.ai_request({'ai': {'api_key': 'test'}}, [{'role':'user','content':'x'}], {})
        self.assertEqual(result['items'][0]['segment'], 'Toyota')

    def test_http_error_keeps_full_body_without_password(self):
        message = 'Detalle técnico\n' + 'x' * 6000 + '\nFIN test-secret'
        for operation in (lambda: server.ai_request({'ai': {'api_key': 'test-secret'}}, [{'role':'user','content':'x'}], {}),
                          lambda: server.test_gemini({'api_key': 'test-secret'})):
            error = server.urllib.error.HTTPError('http://test/api', 500, 'Failure', {}, io.BytesIO(message.encode()))
            with patch.object(server.urllib.request, 'urlopen', side_effect=error):
                with self.assertRaises(ValueError) as raised:
                    operation()
            self.assertIn('x' * 6000, str(raised.exception))
            self.assertIn('FIN [clave oculta]', str(raised.exception))
            self.assertNotIn('test-secret', str(raised.exception))


if __name__ == '__main__':
    unittest.main()
