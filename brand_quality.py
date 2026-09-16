"""One bounded second pass, using the original text and no guessed auto-approval."""
import json
from brand_rules import brand_candidates, doubtful_brand, resolve_brand
from text_prompts import classification_request


def review_doubtful(question, valid, raw_predictions, known, examples, instructions, call, progress):
    suspects = [answer for answer in valid if doubtful_brand(answer, raw_predictions[answer], known)
                and answer not in examples]
    if not suspects:
        return valid
    request = classification_request(question, suspects, 'brands', instructions=instructions, known=known, examples=examples)
    request['messages'][0]['content'] += (
        '\nSEGUNDA REVISIÓN: la primera propuesta puede estar equivocada. Compará fonética y ortografía '
        'con el texto COMPLETO y el contexto de la pregunta. Identificá marca explícita o relación modelo-marca. '
        'Los candidatos son sugerencias por similitud, NO evidencia: no elijas el más parecido sin contexto. '
        'Si la evidencia es insuficiente devolvé Requiere revisión. No inventes marcas ni repitas faltas '
        'ortográficas como marcas nuevas. Para una marca nueva fuera del catálogo, pedí revisión humana.')
    payload = json.loads(request['messages'][1]['content'])
    payload['primera_propuesta_y_candidatos'] = [
        {'id': i, 'propuesta': raw_predictions[a], 'candidatos': brand_candidates(a, known)}
        for i, a in enumerate(suspects)]
    request['messages'][1]['content'] = json.dumps(payload, ensure_ascii=False)
    progress(0, f'Segunda revisión: {len(suspects)} marcas dudosas')
    result = call(request['messages'], request['schema'])
    checked = {}
    for item in result.get('items', []):
        if not isinstance(item, dict):
            continue
        index = item.get('id')
        segment = item.get('segment')
        if type(index) is int and 0 <= index < len(suspects) and isinstance(segment, str) and segment.strip():
            checked[index] = segment
    for i, answer in enumerate(suspects):
        proposal = checked.get(i, '')
        resolved = resolve_brand(answer, proposal, known, examples)
        unresolved = not proposal or doubtful_brand(answer, resolved, known)
        valid[answer].update(segment='Requiere revisión' if unresolved else resolved,
                             needs_review=unresolved, second_pass=True,
                             reason='No se pudo identificar con suficiente evidencia; corregir manualmente.' if unresolved else 'Segunda revisión completada.')
    return valid
