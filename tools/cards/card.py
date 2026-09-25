"""The card template and shared drawing helpers for El Cantor's deck.

Each card is 400 x 656 (the deck's 1 : 1.64), drawn as SVG in a cut-paper style: a cream card,
one flat colored panel with a single bold subject, the number in a paper tag and the name
along the bottom. The art for each card lives in art1.py ... art5.py."""
import math

INK, CREAM, RED, RED2, TEAL, TEAL2, GOLD, GOLD2, GREEN, GREEN2, PINK = (
    '#2B221C', '#FBF4E4', '#B7332F', '#E2554F', '#1F6F6D', '#3E9591', '#D99A2B', '#E8B24A', '#3E7D4A', '#5B9D67', '#C2477A')
SKIN, SKIN2, SKIN3 = '#C98B5E', '#D9A07A', '#A86B42'


def rays(cx, cy, r0, r1, n, fill, width=0.5, rot=0):
    out = []
    for i in range(n):
        a = rot + i * 2 * math.pi / n
        a0, a1 = a - width * math.pi / n, a + width * math.pi / n
        pts = [(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)),
               (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1))]
        out.append('M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + ' Z')
    return f'<path d="{" ".join(out)}" fill="{fill}"/>'


def star(x, y, r, fill=CREAM, k=0.38):
    pts = []
    for i in range(8):
        rr = r if i % 2 == 0 else r * k
        a = -math.pi / 2 + i * math.pi / 4
        pts.append(f'{x + rr * math.cos(a):.1f},{y + rr * math.sin(a):.1f}')
    return f'<path d="M{" L".join(pts)} Z" fill="{fill}"/>'


def flower(x, y, r, petal=PINK, mid=GOLD2, n=5, rot=0):
    ps = ''.join(f'<ellipse cx="{x + r * .62 * math.cos(rot + i * 2 * math.pi / n):.1f}" cy="{y + r * .62 * math.sin(rot + i * 2 * math.pi / n):.1f}" '
                 f'rx="{r * .5:.1f}" ry="{r * .32:.1f}" transform="rotate({math.degrees(rot + i * 2 * math.pi / n):.1f} '
                 f'{x + r * .62 * math.cos(rot + i * 2 * math.pi / n):.1f} {y + r * .62 * math.sin(rot + i * 2 * math.pi / n):.1f})" fill="{petal}"/>'
                 for i in range(n))
    return f'<g filter="url(#cut)">{ps}<circle cx="{x}" cy="{y}" r="{r * .28:.1f}" fill="{mid}"/></g>'


def note(x, y, s=1, fill=INK):
    return (f'<g transform="translate({x} {y}) scale({s}) rotate(-12)" fill="{fill}">'
            f'<ellipse cx="0" cy="0" rx="10" ry="7.5"/><rect x="7" y="-42" width="4" height="42"/>'
            f'<path d="M11,-42 C22,-36 30,-28 24,-14 C24,-24 18,-30 11,-31 Z"/></g>')


def card_svg(n, name, bg, art):
    label = name.upper()
    fs = min(44, int(262 / (len(label) * .64)))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 656" width="400" height="656">
<defs>
  <clipPath id="panel{n}"><rect x="24" y="24" width="352" height="520" rx="6"/></clipPath>
  <filter id="cut" filterUnits="userSpaceOnUse" x="-60" y="-60" width="520" height="780"><feDropShadow dx="1.6" dy="2.6" stdDeviation="1.8" flood-color="#3b2410" flood-opacity=".38"/></filter>
  <filter id="grain{n}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="{n}"/>
    <feColorMatrix values="0 0 0 0 .32  0 0 0 0 .22  0 0 0 0 .12  1.4 0 0 0 -.62"/>
  </filter>
</defs>
<rect width="400" height="656" rx="16" fill="{CREAM}"/>
<g clip-path="url(#panel{n})"><rect x="24" y="24" width="352" height="520" fill="{bg}"/>{art}</g>
<rect x="24" y="24" width="352" height="520" rx="6" fill="none" stroke="{INK}" stroke-width="3.5"/>
<g filter="url(#cut)"><rect x="36" y="36" width="56" height="46" rx="7" fill="{CREAM}"/></g>
<text x="64" y="71" font-family="Bree Serif" font-size="32" text-anchor="middle" fill="{INK}">{n}</text>
<path d="M44,600 l9,-9 l9,9 l-9,9 Z M338,600 l9,-9 l9,9 l-9,9 Z" fill="{RED}"/>
<text x="200" y="{600 + fs * .36:.0f}" font-family="Bree Serif" font-size="{fs}" text-anchor="middle" fill="{INK}" letter-spacing="1.5">{label}</text>
<rect x="9" y="9" width="382" height="638" rx="12" fill="none" stroke="{INK}" stroke-width="2"/>
<rect width="400" height="656" rx="16" filter="url(#grain{n})" opacity=".22"/>
</svg>'''
