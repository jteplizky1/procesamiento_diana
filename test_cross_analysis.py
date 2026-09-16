import unittest
import pandas as pd
import cross_analysis as c
def split(x): return [v.strip() for v in str(x).split(';') if v.strip()]
class CrossTests(unittest.TestCase):
 def setUp(self):
  p={'dictionary':[{'pregunta':'Sexo','tipo':'demográfica','incluir':True},{'pregunta':'Auto','tipo':'selección única','incluir':True},{'pregunta':'Marca','tipo':'texto libre','incluir':True}],'sample_weights':{'1':5,'2':1},'text_classifications':{'Marca':{'omoda':{'segment':'Omoda'},'toyota':{'segment':'Toyota'}}}}
  self.data,self.kinds=c.dataset(p,pd.DataFrame({'Sexo':['Hombre','Mujer'],'Auto':['Sí','Sí'],'Marca':['omoda','toyota']}),['1','2'],split)
 def test_filter_processed_and_weight(self):
  r=c.analyze(self.data,self.kinds,'Marca [procesada]',[],[{'question':'Sexo','values':['Hombre']},{'question':'Auto','values':['Sí']}],split)
  self.assertEqual((r['respondents'],r['weighted_base'],r['rows'][0]['Marca [procesada]']),(1,5,'Omoda'))
 def test_multiple_values_and_breakdown(self):
  r=c.analyze(self.data,self.kinds,'Auto',['Sexo'],[{'question':'Marca [procesada]','values':['Omoda','Toyota']}],split)
  self.assertEqual(sum(x['cantidad_ponderada'] for x in r['rows']),6)
if __name__=='__main__':unittest.main()
