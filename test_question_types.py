import unittest

import pandas as pd

import server


class QuestionTypeTests(unittest.TestCase):
    def test_detects_colon_scores_as_matrix_scale(self):
        value = ("EV (Electric Vehicle):5\nHEV (Hybrid Electric Vehicle):5\n"
                 "PHEV (Plug-In Hybrid Electric Vehicle):5\nSHS (Super Hybrid System):5")
        self.assertEqual(server.detect_type(pd.Series([value, value]), "Motorizaciones"), "matriz de escala")

    def test_detects_newline_options_as_multiple_selection(self):
        values = pd.Series(["Tecnología\nModa\nDiseño", "Tecnología\nDiseño", None])
        self.assertEqual(server.detect_type(values, "Atributos asociados"), "selección múltiple")

    def test_matrix_frequency_is_per_item(self):
        frame = pd.DataFrame({'Q': ['EV:5\nHEV:4', 'EV:4\nHEV:4']})
        rows = server.frequencies(frame, 'Q', 'matriz de escala', pd.Series([1.0, 1.0]))
        ev = [row for row in rows if row['ítem'] == 'EV']
        self.assertEqual(sum(row['porcentaje'] for row in ev), 100)
        self.assertTrue(all(row['promedio_ítem'] == 4.5 for row in ev))


if __name__ == '__main__':
    unittest.main()
