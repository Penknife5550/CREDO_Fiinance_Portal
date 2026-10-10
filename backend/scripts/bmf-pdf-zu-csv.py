"""Hilfsskript (einmalig, Python 3 + PyMuPDF): Extrahiert die Ländertabelle (Anlage) aus dem BMF-Schreiben vom 05.12.2025.

Wörter je Zeile über die y-Koordinate gruppieren, Spalten über x:
  Name < 240 | 24h 240–310 | 8h 310–380 | Übernachtung 380–480.
Bindestrich-Zeilen ('– Stadt', '– im Übrigen') gehören zum vorangehenden Staat.
"""
import fitz, sys, json

PDF = sys.argv[1]
CSV = sys.argv[2]
MAP = sys.argv[3]

# BMF-Name -> Bestands-Key aus Migration 0008 (nie umbenennen)
STAAT_KEY = {
    'Vereinigte Staaten von Amerika (USA)': 'USA',
    'Vereinigtes Königreich von Großbritannien und Nordirland': 'Großbritannien',
    'Tschechische Republik': 'Tschechien',
}
STADT_KEY = {
    'Paris sowie die Departments 77, 78, 91 bis 95': 'Paris',
}

doc = fitz.open(PDF)
assert 'Auslandsreisen ab 1. Januar 2026' in doc.metadata['title'], doc.metadata['title']

zeilen = []  # (seite, y, name_woerter, [z24, z8, ue])
for pi in range(3, 10):
    words = doc[pi].get_text('words')
    rows = {}
    for w in words:
        y = (w[1] + w[3]) / 2
        if y < 280 or y > 790:  # Kopf (wiederholt je Seite) und Seitenzahl
            continue
        key = next((k for k in rows if abs(k - y) <= 3), None)
        if key is None:
            key = y
            rows[key] = []
        rows[key].append(w)
    for y in sorted(rows):
        r = sorted(rows[y], key=lambda w: w[0])
        name = [w for w in r if w[0] < 240]
        zahlen = [None, None, None]
        for w in r:
            if w[0] < 240:
                continue
            spalte = 0 if w[0] < 310 else 1 if w[0] < 380 else 2 if w[0] < 480 else None
            assert spalte is not None and zahlen[spalte] is None and w[4].isdigit(), (pi + 1, y, w)
            zahlen[spalte] = int(w[4])
        assert all(z is None for z in zahlen) or all(z is not None for z in zahlen), (pi + 1, y, r)
        zeilen.append((pi + 1, round(y), name, zahlen))

eintraege = []  # (bmf_name, staat, stadt|None, z24, z8, ue)
staat = None          # aktueller Staat (für Bindestrich-Zeilen)
staat_offen = False   # Staat ohne Werte, Name evtl. mehrzeilig
letzte = None         # 'staat' | 'stadt' | 'uebrige' | 'kopf'
for seite, y, name, z in zeilen:
    text = ' '.join(w[4] for w in name)
    ist_strich = name and name[0][4] == '–' and name[0][0] < 90
    hat_werte = z[0] is not None
    if ist_strich:
        assert staat and hat_werte, (seite, y, text)
        stadt = ' '.join(w[4] for w in name[1:])
        if stadt == 'im Übrigen':
            eintraege.append([f'{staat} – im Übrigen', staat, None, *z])
            letzte = 'uebrige'
        else:
            eintraege.append([f'{staat} – {stadt}', staat, stadt, *z])
            letzte = 'stadt'
        staat_offen = False
    elif not hat_werte:
        if letzte == 'stadt':
            # Fortsetzung eines Stadtnamens (Paris sowie die / Departments ...)
            e = eintraege[-1]
            e[2] = f'{e[2]} {text}'
            e[0] = f'{e[1]} – {e[2]}'
        elif staat_offen:
            staat = f'{staat} {text}'  # mehrzeiliger Staatsname
        else:
            staat = text
            staat_offen = True
            letzte = 'kopf'
    else:
        eintraege.append([text, text, None, *z])
        staat = text
        staat_offen = False
        letzte = 'staat'

# Jeder Staat mit Städten braucht eine 'im Übrigen'-Zeile
staaten_mit_stadt = {e[1] for e in eintraege if e[2]}
staaten_uebrige = {e[1] for e in eintraege if e[0].endswith('– im Übrigen')}
assert staaten_mit_stadt == staaten_uebrige, staaten_mit_stadt ^ staaten_uebrige

def key_von(e):
    staat = STAAT_KEY.get(e[1], e[1])
    if e[2] is None:
        return staat
    return f'{staat} — {STADT_KEY.get(e[2], e[2])}'

ausgabe = []
for e in eintraege:
    ausgabe.append((key_von(e), e[3], e[4], e[5], e[0]))
keys = [a[0] for a in ausgabe]
assert len(keys) == len(set(keys)), 'doppelte Keys'

with open(CSV, 'w', encoding='utf-8', newline='\n') as f:
    f.write('land_key;tagessatz_24h;tagessatz_8h;uebernachtung\n')
    for k, a, b, c, _ in ausgabe:
        assert ';' not in k and '"' not in k
        f.write(f'{k};{a};{b};{c}\n')
with open(MAP, 'w', encoding='utf-8') as f:
    json.dump({a[0]: a[4] for a in ausgabe}, f, ensure_ascii=False, indent=1)
print(len(ausgabe), 'Zeilen')
