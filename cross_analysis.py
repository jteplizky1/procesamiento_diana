"""Weighted, ID-aligned analysis with arbitrary breakdowns and filters."""
import itertools
from collections import defaultdict
import pandas as pd


def dataset(project, frame, ids, split_answers):
    data = frame.copy()
    data['__id'] = ids
    data['__weight'] = [float(project.get('sample_weights', {}).get(rid, 1)) for rid in ids]
    kinds = {x['pregunta']: x.get('tipo','') for x in project.get('dictionary', []) if x.get('incluir')}
    overrides = project.get('text_response_overrides', {})
    for question, mapping in project.get('text_classifications', {}).items():
        if question not in data: continue
        name = question+' [procesada]'
        data[name] = [overrides.get(question,{}).get(rid, mapping.get(str(raw),{})).get('segment','')
                      for rid,raw in zip(ids,data[question])]
        kinds[name] = 'selección única'
    return data, kinds


def values(data, kinds, split_answers):
    result = {}
    for q in kinds:
        if q not in data: continue
        vals=[]
        for raw in data[q].dropna().astype(str):
            vals.extend(split_answers(raw) if kinds[q]=='selección múltiple' else [raw])
        result[q] = sorted(set(v for v in vals if v.strip()), key=str.casefold)
    return result


def analyze(data, kinds, primary, breakdowns, filters, split_answers):
    questions = [primary]+list(breakdowns)
    if not primary or any(q not in data for q in questions): raise ValueError('Elegí preguntas válidas.')
    if len(set(questions)) != len(questions): raise ValueError('No repitas la pregunta principal en los desgloses.')
    mask = pd.Series(True,index=data.index)
    for f in filters:
        q, selected = f.get('question'), set(map(str,f.get('values',[])))
        if q not in data or not selected: raise ValueError('Cada filtro debe tener una pregunta y al menos una respuesta.')
        mask &= data[q].fillna('').astype(str).map(lambda raw:any(v in selected for v in (split_answers(raw) if kinds.get(q)=='selección múltiple' else [raw])))
    base=data.loc[mask]; totals=defaultdict(lambda:[0,0.0])
    for _,row in base.iterrows():
        dimensions=[]
        for q in questions:
            raw='' if pd.isna(row[q]) else str(row[q])
            vals=split_answers(raw) if kinds.get(q)=='selección múltiple' else [raw]
            dimensions.append(vals or ['(Sin respuesta)'])
        for combination in itertools.product(*dimensions):
            totals[combination][0]+=1; totals[combination][1]+=row['__weight']
    denominator=float(base['__weight'].sum())
    rows=[]
    for combination,(real,weighted) in totals.items():
        item={q:v for q,v in zip(questions,combination)}
        item.update({'cantidad_real':real,'cantidad_ponderada':round(weighted,2),
                     'porcentaje_ponderado':round(weighted/denominator*100,2) if denominator else 0})
        rows.append(item)
    rows.sort(key=lambda x:x['cantidad_ponderada'],reverse=True)
    return {'rows':rows,'respondents':len(base),'weighted_base':round(denominator,2),'filtered_out':len(data)-len(base)}
