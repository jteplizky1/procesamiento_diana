import json
import unittest
from brand_rules import brand_memory, normalize_brand, resolve_brand
from text_prompts import classification_request, category_request


class BrandTests(unittest.TestCase):
    def test_typo_and_models(self):
        known, examples = brand_memory({})
        for raw in ['Chebroleth', 'CHEBROLETH', ' Chebroleth ']:
            self.assertEqual(resolve_brand(raw, 'No identificable', known, examples), 'Chevrolet')
        for raw in ['Toyota RAV4', 'toyota rav4', 'RAV4', 'Corolla']:
            self.assertEqual(resolve_brand(raw, 'Incorrecto', known, examples), 'Toyota')

    def test_format(self):
        self.assertEqual(normalize_brand(' toyota RAV4 ; TOYOTA ; bmw ; land rover '), 'Toyota;BMW;Land Rover')
        self.assertEqual(normalize_brand('marca nueva'), 'Marca nueva')
        self.assertEqual(normalize_brand('  no   identificable  '), 'No identificable')

    def test_saved_corrections_are_project_memory(self):
        project = {'text_processing_modes': {'Q': 'brands'}, 'text_classifications': {'Q': {
            'nueba': {'segment': 'Novara', 'reviewed': True},
            'bad': {'segment': 'Wrong', 'approved': False}}}}
        known, examples = brand_memory(project)
        self.assertIn('Novara', known)
        self.assertNotIn('bad', examples)
        self.assertEqual(resolve_brand('NUEBA', 'Wrong', known, examples), 'Novara')
        request = classification_request('Q', ['nueba'], 'brands', instructions='Sólo marcas', known=known, examples=examples)
        self.assertIn('Sólo marcas', request['messages'][0]['content'])
        self.assertEqual(json.loads(request['messages'][1]['content'])['correcciones_humanas']['nueba'], 'Novara')
        self.assertIn('Mi criterio', category_request('Q', ['abc'], instructions='Mi criterio')['messages'][0]['content'])


if __name__ == '__main__':
    unittest.main()
