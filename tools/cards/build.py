#!/usr/bin/env python3
"""Draw El Cantor's 54 cards as SVG.

  python3 tools/cards/build.py          # all 54
  python3 tools/cards/build.py 1,23     # just some, by number

Writes tools/cards/build/NN.svg and build/cards.json; then tools/cards/render.mjs turns
them into cards/<File>.jpg. The file names come from deck.js."""
import json, re, sys
from pathlib import Path
from card import card_svg
import art1, art2, art3, art4, art5

HERE = Path(__file__).resolve().parent
ART = {}
for m in (art1, art2, art3, art4, art5):
    ART.update(m.ART)
files = re.findall(r"\['([A-Z]\w+)', '[^']+', '[^']+'\]", (HERE.parent.parent / 'deck.js').read_text(encoding='utf-8'))
if len(files) != 54 or len(ART) != 54:
    sys.exit(f'expected 54 cards, found {len(files)} in deck.js and {len(ART)} drawn')
only = {int(x) for x in sys.argv[1].split(',')} if len(sys.argv) > 1 else set(ART)
out = HERE / 'build'; out.mkdir(exist_ok=True)
cards = {}
for n in sorted(only):
    svg = card_svg(n, *ART[n])
    (out / f'{n:02d}.svg').write_text(svg, encoding='utf-8')
    cards[n] = {'file': files[n - 1], 'svg': svg}
(out / 'cards.json').write_text(json.dumps(cards, ensure_ascii=False), encoding='utf-8')
print('drew', len(cards), 'cards')
