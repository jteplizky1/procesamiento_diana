"""Synthetic quality check. No survey responses are read or stored.

python benchmark_brands.py --live --limit 5
Without --live only validates the 50-case fixture; this is NOT model accuracy.
"""
import argparse
import copy
import time
from unittest.mock import patch
import pandas as pd
import server

CASES = [
    ('toyyota', 'Toyota'), ('hynday', 'Hyundai'), ('chevrole', 'Chevrolet'),
    ('volkswajen', 'Volkswagen'), ('nisan', 'Nissan'), ('peuyot', 'Peugeot'),
    ('renol', 'Renault'), ('susuki', 'Suzuki'), ('mersedes benz', 'MercedesBenz'),
    ('jaeko', 'Jaecoo'), ('omoda', 'Omoda'), ('cherri', 'Chery'),
    ('Toyota RAV4', 'Toyota'), ('Toyota Corolla Cross', 'Toyota'),
    ('Hyundai Tucson', 'Hyundai'), ('Kia Sportage', 'Kia'), ('Nissan Kicks', 'Nissan'),
    ('Honda CR-V', 'Honda'), ('Ford Territory', 'Ford'), ('Chevrolet Tracker', 'Chevrolet'),
    ('Volkswagen Tiguan', 'Volkswagen'), ('Peugeot 3008', 'Peugeot'),
    ('Renault Duster', 'Renault'), ('Mazda CX-5', 'Mazda'), ('Subaru Forester', 'Subaru'),
    ('Tucson', 'Hyundai'), ('Sportage', 'Kia'), ('Tiguan', 'Volkswagen'),
    ('Kicks', 'Nissan'), ('Forester', 'Subaru'), ('BMW X3', 'BMW'), ('Audi Q5', 'Audi'),
    ('Volvo XC60', 'Volvo'), ('Tesla Model Y', 'Tesla'), ('BYD Song Plus', 'BYD'),
    ('BMW', 'BMW'), ('Audi', 'Audi'), ('LAND ROVER', 'LandRover'),
    ('Toyota y Hyundai', 'Toyota;Hyundai'), ('BMW, Audi', 'BMW;Audi'),
    ('Me gusta Nissan, especialmente Kicks', 'Nissan'),
    ('Creo que se escribe volswagen, la del Tiguan', 'Volkswagen'),
    ('La coreana jiunday, la Tucson', 'Hyundai'),
    ('No sé', 'RequiereRevision'), ('No recuerdo ninguna', 'RequiereRevision'),
    ('Una japonesa', 'RequiereRevision'), ('SUV', 'RequiereRevision'),
    ('La del logo redondo', 'RequiereRevision'), ('zzqxx', 'RequiereRevision'),
    ('2024', 'RequiereRevision'),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true')
    parser.add_argument('--limit', type=int, default=50)
    args = parser.parse_args()
    assert len(CASES) == 50 and len(dict(CASES)) == 50
    if not 1 <= args.limit <= 50:
        parser.error('--limit debe estar entre 1 y 50')
    if not args.live:
        print('50 casos sintéticos válidos. Ollama no fue evaluado. Usá --live para medir calidad.')
        return
    cases = CASES[:args.limit]
    saved = {'id': 'synthetic-quality-check'}
    def persist(project):
        saved.clear(); saved.update(copy.deepcopy(project))
    frame = pd.DataFrame({'¿Qué marcas de automóviles recordás?': [x[0] for x in cases]})
    question = frame.columns[0]
    started = time.monotonic()
    with patch.object(server, 'read_project', side_effect=lambda _: copy.deepcopy(saved)), \
         patch.object(server, 'save_project', side_effect=persist), \
         patch.object(server, 'sample_frame', return_value=frame):
        while True:
            result = server.process_text(copy.deepcopy(saved), frame, question, 5, 'brands',
                                         progress=lambda _, phase, **kw: print(phase, flush=True))
            if result['remaining'] == 0:
                break
    correct = 0
    for text, expected in cases:
        actual = saved['text_classifications'][question][text]['segment']
        ok = set(actual.split(';')) == set(expected.split(';'))
        correct += ok
        print(f'{"OK" if ok else "ERROR"}: {text} -> {actual} (esperado: {expected})')
    print(f'Calidad del sistema: {correct}/{len(cases)} = {correct/len(cases):.0%}; {time.monotonic()-started:.1f}s')


if __name__ == '__main__':
    main()
