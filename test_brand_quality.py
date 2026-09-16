import unittest
from brand_quality import review_doubtful
from brand_rules import brand_memory, brand_candidates, resolve_brand


class QualityTests(unittest.TestCase):
    def run_review(self, raw, result):
        known, examples = brand_memory({})
        valid = {a: {'segment': v, 'approved': False} for a, v in raw.items()}
        self.calls = []
        def call(messages, schema):
            self.calls.append(messages)
            return result
        return review_doubtful('Autos', valid, raw, known, examples, '', call, lambda *a: None)

    def test_second_pass_corrects_unseen_typo(self):
        result = self.run_review({'volkswajen': 'Volkswajen'}, {'items': [{'id': 0, 'segment': 'Volkswagen'}]})
        self.assertEqual(result['volkswajen']['segment'], 'Volkswagen')
        self.assertEqual(len(self.calls), 1)
        self.assertFalse(result['volkswajen']['approved'])

    def test_unknown_and_missing_stay_for_review(self):
        result = self.run_review({'xyz': 'Xyz', 'unknown': 'Unknown'}, {'items': [{'id': 0, 'segment': 'Xyz'}]})
        self.assertTrue(all(v['segment'] == 'Requiere revisión' for v in result.values()))

    def test_known_brand_needs_no_extra_call(self):
        self.run_review({'Ford': 'Ford'}, {})
        self.assertEqual(self.calls, [])

    def test_candidates_are_not_classification(self):
        self.assertIn('Volkswagen', brand_candidates('volkswajen', brand_memory({})[0]))

    def test_multiple_brands_not_cut_to_first(self):
        known, examples = brand_memory({})
        self.assertEqual(resolve_brand('Toyota y Hyundai', 'Toyota;Hyundai', known, examples), 'Toyota;Hyundai')

if __name__ == '__main__':
    unittest.main()
