#!/usr/bin/env python3
"""Record El Cantor's voices ahead of time with Kokoro-82M (Apache-2.0).

Each card becomes one clip: the verse, a breath, then the name. audio/voices.json
records where the verse ends and the name starts, so Adivinanza can stop between them.

  pip install onnxruntime numpy misaki espeakng-loader phonemizer-fork lameenc
  python3 tools/make_voices.py --model kokoro-v1.0.onnx --voices path/to/voices --config config.json \
      --voice dora=ef_dora:"female voice" --voice alex=em_alex:"male voice"

The first voice listed becomes El Cantor's default.

  --model   Kokoro-82M v1.0 ONNX (fp32)
  --voices  folder of Kokoro voice styles, <name>.bin (510 x 256 float32), as shipped in kokoro-js
  --config  Kokoro config.json, for the phoneme vocabulary
"""
import argparse, json, re, sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import lameenc
from misaki import espeak

HERE = Path(__file__).resolve().parent
RATE = 24000

# Spellings the speech engine reads wrong, rewritten the way a caller says them.
SPOKEN = [
    (r'\bViolon[cç]ello\b', 'Violonchelo'), (r'\bviolon[cç]ello\b', 'violonchelo'),
    (r'\bp’al\b', 'pal'), (r'\bpa’', 'pa'),
]
OPENING = '¡Se va y se corre, con la vieja en el coche!'
LOTERIA = '¡Lotería!'


def cards_from_deck(deck):
    src = deck.read_text(encoding='utf-8')
    rows = re.findall(r"\['([A-Z]\w+)', '([^']+)', '([^']+)'\]", src)
    if len(rows) != 54:
        sys.exit(f'expected 54 cards in {deck}, found {len(rows)}')
    return [{'n': i + 1, 'name': name, 'verse': verse} for i, (_, name, verse) in enumerate(rows)]


def spoken(text):
    for pat, rep in SPOKEN:
        text = re.sub(pat, rep, text)
    return text


class Kokoro:
    def __init__(self, model, config, lang):
        self.vocab = json.loads(Path(config).read_text(encoding='utf-8'))['vocab']
        self.g2p = espeak.EspeakG2P(language=lang)
        self.sess = ort.InferenceSession(str(model), providers=['CPUExecutionProvider'])
        self.inputs = {i.name: i for i in self.sess.get_inputs()}

    def phonemes(self, text):
        ps, _ = self.g2p(text)
        # es-419 writes the ll of "gallo" as a doubled glide; Mexican Spanish says it like the y of "yo".
        ps = ps.replace('jj', 'ʝ')
        dropped = sorted({c for c in ps if c not in self.vocab and c not in '¡¿'})
        if dropped:
            print(f'  note: no token for {"".join(dropped)!r} in {text!r}', file=sys.stderr)
        return ps

    def __call__(self, text, style, speed):
        ps = self.phonemes(text)
        ids = [self.vocab[c] for c in ps if c in self.vocab][:510]
        feed = {}
        for name, inp in self.inputs.items():
            if 'style' in name:
                feed[name] = style[len(ids)].reshape(1, 256).astype(np.float32)
            elif 'speed' in name:
                feed[name] = np.array([speed], dtype=np.int32 if 'int' in inp.type else np.float32)
            else:
                feed[name] = np.array([[0, *ids, 0]], dtype=np.int64)
        audio = self.sess.run(None, feed)[0]
        return np.asarray(audio, dtype=np.float32).reshape(-1), ps


def trim(x, floor=0.012, pad=0.03):
    loud = np.flatnonzero(np.abs(x) > floor * max(1e-6, np.abs(x).max()))
    if not len(loud):
        return x
    p = int(pad * RATE)
    return x[max(0, loud[0] - p): loud[-1] + p]


def level(x, rms=0.09, peak=0.95):
    voiced = x[np.abs(x) > 0.02 * np.abs(x).max()]
    r = float(np.sqrt(np.mean(voiced ** 2))) if len(voiced) else 1.0
    return x * min(rms / max(r, 1e-6), peak / max(1e-6, np.abs(x).max()))


def silence(sec):
    return np.zeros(int(sec * RATE), dtype=np.float32)


def mp3(x, path, kbps):
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps); enc.set_in_sample_rate(RATE); enc.set_channels(1); enc.set_quality(2)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    path.write_bytes(enc.encode(pcm) + enc.flush())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    ap.add_argument('--config', required=True)
    ap.add_argument('--voice', action='append', required=True, help='id=kokoro_voice:"about", e.g. alex=em_alex:"male voice"')
    ap.add_argument('--deck', default=str(HERE.parent / 'deck.js'))
    ap.add_argument('--out', default=str(HERE.parent / 'audio'))
    ap.add_argument('--lang', default='es-419', help='espeak-ng language; es-419 is Latin American Spanish')
    ap.add_argument('--speed', type=float, default=0.9)
    ap.add_argument('--gap', type=float, default=0.45, help='seconds between the verse and the name')
    ap.add_argument('--kbps', type=int, default=48)
    ap.add_argument('--only', help='comma-separated card numbers, for trying a voice out')
    a = ap.parse_args()

    cards = cards_from_deck(Path(a.deck))
    if a.only:
        keep = {int(x) for x in a.only.split(',')}
        cards = [c for c in cards if c['n'] in keep]
    tts = Kokoro(a.model, a.config, a.lang)
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / 'voices.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'voices': []}

    for spec in a.voice:
        vid, rest = spec.split('=', 1)
        kname, _, about = rest.partition(':')
        style = np.fromfile(Path(a.voices) / f'{kname}.bin', dtype=np.float32).reshape(-1, 256)
        folder = out / vid; folder.mkdir(exist_ok=True)
        entry = next((v for v in manifest['voices'] if v['id'] == vid), None)
        if entry is None:
            entry = {'id': vid}; manifest['voices'].append(entry)
        entry.update({'name': vid.capitalize(), 'about': about.strip('"'), 'ext': 'mp3', 'model': f'Kokoro-82M {kname}'})
        entry.setdefault('cards', {})
        lead = 0.06
        for c in cards:
            verse, vps = tts(spoken(c['verse']), style, a.speed)
            name, nps = tts(spoken(f"¡{c['name']}!"), style, a.speed)
            verse, name = level(trim(verse)), level(trim(name))
            clip = np.concatenate([silence(lead), verse, silence(a.gap), name, silence(0.12)])
            mp3(clip, folder / f"{c['n']:02d}.mp3", a.kbps)
            v_end = lead + len(verse) / RATE
            entry['cards'][str(c['n'])] = [round(v_end, 3), round(v_end + a.gap, 3)]
            print(f"{vid} {c['n']:02d} {len(clip) / RATE:4.1f}s  {c['name']}  /{nps}/  {vps}", flush=True)
        if not a.only:
            for fname, text in (('open', OPENING), ('loteria', LOTERIA)):
                x, ps = tts(text, style, a.speed)
                mp3(np.concatenate([silence(lead), level(trim(x)), silence(0.12)]), folder / f'{fname}.mp3', a.kbps)
                print(f'{vid} {fname}  /{ps}/', flush=True)
    manifest['credit'] = 'Voices rendered with Kokoro-82M by hexgrad (Apache-2.0).'
    voices = ',\n'.join('  ' + json.dumps(v, ensure_ascii=False, separators=(',', ':')) for v in manifest['voices'])
    manifest_path.write_text('{\n "credit": ' + json.dumps(manifest['credit'], ensure_ascii=False) + ',\n "voices": [\n' + voices + '\n ]\n}\n', encoding='utf-8')


if __name__ == '__main__':
    main()
