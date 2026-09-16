"""Deterministic brand formatting and project-local correction memory."""
import re
from difflib import SequenceMatcher

DEFAULT_BRANDS = ['Toyota', 'Hyundai', 'Kia', 'BMW', 'Audi', 'Mercedes Benz', 'Volkswagen',
                  'Ford', 'Chevrolet', 'Honda', 'Nissan', 'Renault', 'Peugeot', 'Citroën',
                  'Fiat', 'Jeep', 'Suzuki', 'Mazda', 'Subaru', 'Volvo', 'Tesla', 'BYD',
                  'Chery', 'Omoda', 'Jaecoo', 'MG', 'GWM', 'Land Rover', 'No identificable', 'Requiere revisión']


def brand_key(value):
    return re.sub(r'[\s-]+', '', value).casefold()


def normalize_brand(value, known=()):
    catalog = {brand_key(v): v for v in DEFAULT_BRANDS}
    for item in known:
        cleaned = re.sub(r'\s+', ' ', item).strip()
        if cleaned:
            catalog[brand_key(item)] = cleaned[0].upper() + cleaned[1:]
    output = []
    for part in value.split(';'):
        part = part.strip()
        if not part:
            continue
        key = brand_key(part)
        brand = catalog.get(key)
        if not brand:
            # Strip an explicit model suffix, never guess a parent conglomerate.
            for candidate in sorted(catalog.values(), key=len, reverse=True):
                pattern = r'^[\s-]*' + r'[\s-]*'.join(map(re.escape, candidate)) + r'(?=\s|$)'
                if re.match(pattern, part, re.I):
                    brand = candidate
                    break
        if not brand:
            brand = re.sub(r'\s+', ' ', part).strip().lower()
            brand = brand[0].upper() + brand[1:]
        if not brand[0].isalpha():
            brand = 'No identificable'
        if brand not in output:
            output.append(brand)
    return ';'.join(output) or 'No identificable'


def brand_memory(project):
    examples = {'Chebroleth': 'Chevrolet', 'jiundai': 'Hyundai', 'Corolla': 'Toyota', 'RAV4': 'Toyota'}
    known = list(DEFAULT_BRANDS)
    for question, mapping in project.get('text_classifications', {}).items():
        mode = project.get('text_processing_modes', {}).get(question) or project.get('text_question_settings', {}).get(question, {}).get('mode')
        if mode != 'brands':
            continue
        for answer, item in mapping.items():
            if item.get('approved') or item.get('reviewed'):
                if brand_key(item['segment']) in ('requiererevision', 'requiererevisión', 'noidentificable'):
                    continue
                value = normalize_brand(item['segment'], known)
                examples[answer] = value
                known.extend(value.split(';'))
    return known, examples


def resolve_brand(answer, predicted, known, examples):
    corrections = {brand_key(k): v for k, v in examples.items()}
    if brand_key(answer) in corrections:
        return normalize_brand(corrections[brand_key(answer)], known)
    # A short explicit brand + model is stronger evidence than a model guess.
    explicit = normalize_brand(answer, known)
    direct = brand_key(answer) == brand_key(explicit)
    model = any(c.isdigit() for c in answer) and not re.search(r'[,;/]|\b(y|o|no|ni|pero)\b', answer, re.I)
    if len(answer.split()) <= 4 and (direct or model) and explicit in known:
        return explicit
    return normalize_brand(predicted, known)


def brand_candidates(text, known, limit=5):
    """Suggestions, never automatic fuzzy replacements."""
    key = brand_key(text)
    return sorted(set(known) - {'No identificable', 'Requiere revisión'},
                  key=lambda name: SequenceMatcher(None, key, brand_key(name)).ratio(), reverse=True)[:limit]


def doubtful_brand(original, predicted, known):
    catalog = {brand_key(v) for v in known} - {'noidentificable', 'requiererevision', 'requiererevisión'}
    parts = [p.strip() for p in predicted.split(';') if p.strip()]
    return not parts or any(brand_key(p) not in catalog for p in parts)
