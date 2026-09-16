import unittest
import io
import pandas as pd
from openpyxl import load_workbook
from unittest.mock import patch
import external_review as er
import server


class ExternalReviewTests(unittest.TestCase):
    def setUp(self):
        self.frame = pd.DataFrame({'response id': ['001', '002'], 'Q': ['Caro y mala calidad', 'Caro y mala calidad']})
        self.p = {'id': 'test', 'sample_response_ids': ['001', '002'], 'text_question_settings': {'Q': {'mode': 'semantic'}}}
        self.rows = er.sheet_rows(self.p, self.frame, 'Q', ['001', '002'])

    def test_duplicate_text_independent_ids_and_partial_paste(self):
        data = [{'id': '002', 'original': self.rows[1]['original'], 'segment': 'Precio/calidad'}]
        change = er.compare(self.p, 'Q', self.rows, er.tsv(data))
        er.apply_changes(self.p, 'Q', change['changes'])
        rows = er.sheet_rows(self.p, self.frame, 'Q', ['001', '002'])
        self.assertEqual(rows[0]['segment'], '')
        self.assertEqual(rows[1]['segment'], 'Precio/calidad')

    def test_two_column_paste_applies_to_every_matching_respondent(self):
        pasted='Respuesta original\tMarca o categoría\nCaro y mala calidad\tPrecio/calidad\n'
        result=er.compare(self.p,'Q',self.rows,pasted)
        self.assertEqual(result['received'],2)
        self.assertEqual({x['id'] for x in result['changes']},{'001','002'})

    def test_two_column_unknown_and_conflicting_correction_rejected(self):
        with self.assertRaisesRegex(ValueError,'no se encontró'):
            er.compare(self.p,'Q',self.rows,'Otra respuesta\tPrecio\n')
        with self.assertRaisesRegex(ValueError,'dos correcciones'):
            er.compare(self.p,'Q',self.rows,'Caro y mala calidad\tPrecio\nCaro y mala calidad\tCalidad\n')

    def test_unknown_duplicate_altered_and_blank_rejected(self):
        for rid, original, segment in [('999',self.rows[0]['original'],'X'), ('001',self.rows[0]['original'],'')]:
            with self.assertRaises(ValueError):
                er.compare(self.p,'Q',self.rows,er.tsv([{'id':rid,'original':original,'segment':segment}]))
        row={**self.rows[0],'segment':'X'}
        with self.assertRaises(ValueError):
            er.compare(self.p,'Q',self.rows,er.tsv([row,row]))

    def test_invisible_edge_spaces_from_external_tool_are_safe(self):
        rows=[{'id':'40802','original':'Toyota ','segment':'Omoda'}]
        pasted=er.tsv([{'id':'40802','original':'Toyota','segment':'Toyota'}])
        result=er.compare(self.p,'Q',rows,pasted)
        self.assertEqual(result['changes'],[{'id':'40802','original':'Toyota ','before':'Omoda','after':'Toyota'}])
        altered=er.compare(self.p,'Q',rows,er.tsv([{'id':'40802','original':'Toyata','segment':'Toyota'}]))
        self.assertEqual(altered['altered_originals'],1)
        self.assertEqual(altered['changes'][0]['original'],'Toyota ')

    def test_tsv_multiline_tabs_quotes_roundtrip(self):
        rows=[{'id':'001','original':'Dice "caro"\npero\tbueno','segment':'Precio/calidad'}]
        result=er.compare(self.p,'Q',rows,er.tsv(rows))
        self.assertEqual(result['changes'],[])

    def test_excel_alternative_headers_and_blank_original(self):
        rows=[{'id':'40797','original':'SUV.','segment':''},
              {'id':'40802','original':'','segment':''}]
        pasted=('ID de respuesta\tValor inicial\tValor corregido\n'
                '40797\tSUV.\tSUV.\n'
                '40802\t\tSin información\n')
        result=er.compare(self.p,'Q',rows,pasted)
        self.assertEqual(result['received'],2)
        self.assertEqual(result['changes'],[
            {'id':'40797','original':'SUV.','before':'','after':'SUV.'},
            {'id':'40802','original':'','before':'','after':'Sin información'}])

    def test_revision_changes_and_prompts(self):
        self.assertNotEqual(er.revision(self.rows),er.revision([{**self.rows[0],'segment':'X'}]))
        self.assertIn('Precio/calidad',er.review_prompt('Q','semantic'))
        self.assertIn('Toyota RAV4',er.review_prompt('Q','brands'))

    def test_export_uses_id_overrides_without_ollama(self):
        er.apply_changes(self.p,'Q',[{'id':'002','original':self.rows[1]['original'],'after':'Precio/calidad'}])
        content=server.export_workbook(self.p,self.frame)
        sheet=load_workbook(io.BytesIO(content))['Base limpia']
        rows=list(sheet.values)
        col=rows[0].index('Q')
        self.assertEqual(rows[1][col],'Caro y mala calidad')
        self.assertEqual(rows[2][col],'Precio/calidad')
        self.assertNotIn('Q [segmento]',rows[0])
        self.assertIn('ID de revisión',rows[0])

if __name__=='__main__':
    unittest.main()
