"""Cards 28–37, 39 and 40."""
import math
from card import INK, CREAM, RED, RED2, TEAL, TEAL2, GOLD, GOLD2, GREEN, GREEN2, PINK, SKIN, SKIN2, SKIN3

ART = {}


def pol(cx, cy, r, a):
    return cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))


# ---- 28 La Sandía: a whole melon behind, a big slice in front
seeds28 = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="5" ry="8" transform="rotate({r} {x} {y})" fill="{INK}"/>'
                  for x, y, r in [(130, 392, -30), (170, 420, -12), (214, 424, 8), (256, 408, 24), (292, 384, 38), (150, 366, -24), (196, 384, 0), (240, 376, 16), (272, 358, 30)])
ART[28] = ('La Sandía', '#9BCFCB', f'''
  <path d="M0,500 L400,500 L400,560 L0,560 Z" fill="#7FB9B4"/>
  <g filter="url(#cut)"><ellipse cx="206" cy="232" rx="138" ry="100" fill="{GREEN}"/></g>
  <clipPath id="melon28"><ellipse cx="206" cy="232" rx="138" ry="100"/></clipPath>
  <g stroke="#2E5E38" stroke-width="12" fill="none" stroke-linecap="round" clip-path="url(#melon28)">
    {''.join(f'<path d="M{206 + dx},{140 + abs(dx) * .12:.0f} C{206 + dx * 1.25:.0f},{200} {206 + dx * 1.25:.0f},{270} {206 + dx},{324 - abs(dx) * .12:.0f}"/>' for dx in (-96, -48, 0, 48, 96))}
  </g>
  <g transform="rotate(-6 200 330)" filter="url(#cut)">
    <path d="M36,330 A164,164 0 0 0 364,330 Z" fill="{GREEN}"/>
    <path d="M50,330 A150,150 0 0 0 350,330 Z" fill="#EAF2D0"/>
    <path d="M62,330 A138,138 0 0 0 338,330 Z" fill="{RED2}"/>
  </g>
  <g transform="rotate(-6 200 330)">{seeds28}</g>
''')

# ---- 29 El Tambor
zig = ' '.join(f'{"M" if i == 0 else "L"}{x},{262 if i % 2 == 0 else 452}' for i, x in enumerate(range(104, 300, 32)))
ART[29] = ('El Tambor', '#F4C9A0', f'''
  <path d="M0,510 L400,510 L400,560 L0,560 Z" fill="#E0A878"/>
  <ellipse cx="200" cy="480" rx="112" ry="16" fill="{INK}" opacity=".18"/>
  <g stroke="#7A4A28" stroke-width="10" stroke-linecap="round" filter="url(#cut)"><path d="M108,106 L240,238"/><path d="M292,106 L160,238"/></g>
  <circle cx="106" cy="104" r="13" fill="{CREAM}" filter="url(#cut)"/><circle cx="294" cy="104" r="13" fill="{CREAM}" filter="url(#cut)"/>
  <g filter="url(#cut)">
    <path d="M98,256 L98,452 C98,474 144,486 200,486 C256,486 302,474 302,452 L302,256 Z" fill="{RED}"/>
  </g>
  <path d="{zig}" stroke="{GOLD2}" stroke-width="5" fill="none" stroke-linejoin="round"/>
  <path d="M98,452 C98,474 144,486 200,486 C256,486 302,474 302,452" stroke="{TEAL}" stroke-width="14" fill="none"/>
  <ellipse cx="200" cy="256" rx="102" ry="30" fill="{CREAM}"/>
  <ellipse cx="200" cy="256" rx="102" ry="30" fill="none" stroke="{TEAL}" stroke-width="14"/>
''')

# ---- 30 El Camarón: a curled shrimp, segments from tail to head
segs = []
for i, (a, r) in enumerate([(-290, 22), (-262, 26), (-234, 30), (-206, 34), (-178, 38), (-150, 40), (-122, 42)]):
    x, y = pol(200, 312, 100, a)
    segs.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{r + 6}" ry="{r}" transform="rotate({a + 90} {x:.1f} {y:.1f})" fill="#F07C5A"/>'
                f'<path d="M{pol(x, y, r * .8, a - 60)[0]:.1f},{pol(x, y, r * .8, a - 60)[1]:.1f} Q{pol(x, y, r * .2, a + 180)[0]:.1f},{pol(x, y, r * .2, a + 180)[1]:.1f} {pol(x, y, r * .8, a + 60)[0]:.1f},{pol(x, y, r * .8, a + 60)[1]:.1f}" stroke="#F8B08E" stroke-width="4" fill="none"/>')
tx, ty = pol(200, 312, 100, -300)
legs30 = ''.join(f'<path d="M{pol(200, 312, 70, a)[0]:.0f},{pol(200, 312, 70, a)[1]:.0f} L{pol(200, 312, 40, a + 8)[0]:.0f},{pol(200, 312, 40, a + 8)[1]:.0f}"/>' for a in (-250, -220, -190, -160, -130))
hx, hy = pol(200, 312, 100, -92)
ART[30] = ('El Camarón', TEAL2, f'''
  <g stroke="#E8663F" stroke-width="3" fill="none" stroke-linecap="round">
    <path d="M{hx + 10:.0f},{hy - 20:.0f} C200,90 110,70 50,120"/><path d="M{hx + 16:.0f},{hy - 14:.0f} C230,80 170,40 90,58"/>
  </g>
  <g stroke="#E8663F" stroke-width="5" stroke-linecap="round">{legs30}</g>
  <g filter="url(#cut)">
    <path d="M{tx:.0f},{ty:.0f} l34,26 l-10,14 Z M{tx:.0f},{ty:.0f} l40,-4 l0,16 Z M{tx:.0f},{ty:.0f} l20,36 l-16,6 Z" fill="#E8663F"/>
    {''.join(segs)}
    <ellipse cx="{hx:.1f}" cy="{hy:.1f}" rx="52" ry="40" transform="rotate(-10 {hx:.1f} {hy:.1f})" fill="#F07C5A"/>
    <path d="M{hx + 44:.0f},{hy - 8:.0f} L{hx + 84:.0f},{hy - 20:.0f} L{hx + 46:.0f},{hy + 6:.0f} Z" fill="#E8663F"/>
  </g>
  <circle cx="{hx + 20:.0f}" cy="{hy - 14:.0f}" r="9" fill="{INK}"/><circle cx="{hx + 23:.0f}" cy="{hy - 17:.0f}" r="3" fill="{CREAM}"/>
''')


# ---- 31 Las Jaras: three arrows fanned and tied
def arrow(angle, fl):
    return (f'<g transform="rotate({angle} 200 360)">'
            f'<path d="M200,120 L200,530" stroke="#8A5A33" stroke-width="9" stroke-linecap="round"/>'
            f'<path d="M186,132 L200,82 L214,132 Z" fill="#6E7F94"/>'
            f'<path d="M200,470 L178,452 L178,500 L200,516 Z M200,470 L222,452 L222,500 L200,516 Z" fill="{fl}"/>'
            f'</g>')
ART[31] = ('Las Jaras', '#F6E3B4', f'''
  <g filter="url(#cut)">{arrow(-20, TEAL)}{arrow(20, TEAL)}{arrow(0, RED)}</g>
  <g filter="url(#cut)">
    <path d="M172,350 C186,344 214,344 228,350 L228,372 C214,366 186,366 172,372 Z" fill="{RED}"/>
    <path d="M200,362 C180,390 170,410 160,432 L176,430 C186,412 194,394 200,376 Z M200,362 C220,390 230,410 240,432 L224,430 C214,412 206,394 200,376 Z" fill="{RED}"/>
  </g>
''')

# ---- 32 El Músico: a mariachi and his guitar
ART[32] = ('El Músico', '#BFD9E8', f'''
  <path d="M0,506 L400,506 L400,560 L0,560 Z" fill="#9FC0D6"/>
  <g transform="translate(200 524) scale(1.18) translate(-200 -524)">
    <g filter="url(#cut)" fill="{INK}"><path d="M170,400 L197,400 L195,516 L172,516 Z"/><path d="M203,400 L230,400 L228,516 L205,516 Z"/></g>
    <g fill="#C9CED6">{''.join(f'<circle cx="{x}" cy="{y}" r="2.6"/>' for y in range(412, 512, 14) for x in (174, 226))}</g>
    <ellipse cx="180" cy="522" rx="20" ry="7" fill="{INK}"/><ellipse cx="222" cy="522" rx="20" ry="7" fill="{INK}"/>
    <path d="M158,282 C152,330 154,370 160,406 L240,406 C246,370 248,330 242,282 C224,270 176,270 158,282 Z" fill="{INK}" filter="url(#cut)"/>
    <path d="M184,276 L216,276 L212,406 L188,406 Z" fill="{CREAM}"/>
    <path d="M160,282 L166,330 M240,282 L234,330" stroke="{GOLD2}" stroke-width="4"/>
    <path d="M200,280 L182,268 L182,292 Z M200,280 L218,268 L218,292 Z" fill="{RED}"/><circle cx="200" cy="280" r="5" fill="{RED}"/>
    <path d="M158,292 C142,310 138,324 150,334" stroke="{INK}" stroke-width="20" stroke-linecap="round" fill="none"/>
    <g transform="translate(222 372) rotate(-55)" filter="url(#cut)">
      <rect x="-7" y="-122" width="14" height="104" fill="#7A4A28"/><rect x="-10" y="-150" width="20" height="32" rx="3" fill="#5B3518"/>
      <circle cx="0" cy="40" r="48" fill="#D9A05C"/><circle cx="0" cy="-20" r="37" fill="#D9A05C"/>
      <rect x="-36" y="-20" width="72" height="50" fill="#D9A05C"/>
    </g>
    <g transform="translate(222 372) rotate(-55)">
      <circle cx="0" cy="6" r="14" fill="{INK}"/><rect x="-15" y="56" width="30" height="6" fill="{INK}"/>
      <g stroke="{CREAM}" stroke-width="1.4"><path d="M-3,-140 L-3,58 M1,-140 L1,58 M5,-140 L5,58"/></g>
    </g>
    <circle cx="150" cy="330" r="11" fill="{SKIN}"/>
    <path d="M242,292 C258,318 258,350 244,378" stroke="{INK}" stroke-width="20" stroke-linecap="round" fill="none"/>
    <circle cx="240" cy="382" r="11" fill="{SKIN}"/>
    <rect x="192" y="246" width="16" height="22" fill="{SKIN3}"/>
    <ellipse cx="200" cy="228" rx="25" ry="29" fill="{SKIN}"/>
    <path d="M184,246 C192,240 208,240 216,246 C220,254 212,254 200,250 C188,254 180,254 184,246 Z" fill="{INK}"/>
    <g stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"><path d="M184,226 q6,4 12,0"/><path d="M204,226 q6,4 12,0"/></g>
    <g filter="url(#cut)">
      <path d="M168,204 C166,162 180,146 200,146 C220,146 234,162 232,204 Z" fill="#D9B46A"/>
      <ellipse cx="200" cy="204" rx="80" ry="15" fill="#D9B46A"/>
    </g>
    <rect x="168" y="190" width="64" height="9" fill="{RED}"/>
    <g fill="{GOLD2}">{''.join(f'<circle cx="{x}" cy="206" r="2.6"/>' for x in range(134, 270, 14))}</g>
  </g>
''')

# ---- 33 La Araña
web = []
for k in range(8):
    a = k * 45 + 22.5
    x, y = pol(200, 260, 320, a)
    web.append(f'<path d="M200,260 L{x:.0f},{y:.0f}"/>')
for r in (50, 90, 130, 170, 210):
    pts = [pol(200, 260, r, k * 45 + 22.5) for k in range(9)]
    web.append('<path d="M' + ' L'.join(f'{x:.0f},{y:.0f}' for x, y in pts) + '"/>')
legs33 = ''
for side in (-1, 1):
    for i, (ky, fy, kx, fx) in enumerate([(236, 180, 62, 104), (256, 238, 70, 120), (276, 310, 70, 120), (296, 370, 62, 104)]):
        legs33 += f'<path d="M{200 + side * 20},{ky} L{200 + side * kx},{ky - 24 + i * 10} L{200 + side * fx},{fy}"/>'
ART[33] = ('La Araña', '#D9CFE8', f'''
  <g stroke="#8D7E9C" stroke-width="2.5" fill="none">{''.join(web)}</g>
  <path d="M200,24 L200,220" stroke="#8D7E9C" stroke-width="2.5"/>
  <g stroke="{INK}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#cut)">{legs33}</g>
  <g filter="url(#cut)"><ellipse cx="200" cy="312" rx="44" ry="52" fill="{INK}"/><circle cx="200" cy="244" r="28" fill="{INK}"/></g>
  <path d="M190,300 L210,300 L200,316 Z M190,332 L210,332 L200,316 Z" fill="{RED}"/>
  <circle cx="190" cy="240" r="6" fill="{CREAM}"/><circle cx="210" cy="240" r="6" fill="{CREAM}"/>
  <circle cx="191" cy="241" r="2.5" fill="{INK}"/><circle cx="211" cy="241" r="2.5" fill="{INK}"/>
''')

# ---- 34 El Soldado
UNI = '#2E5E3E'
ART[34] = ('El Soldado', GOLD2, f'''
  <path d="M0,506 C120,496 280,496 400,506 L400,560 L0,560 Z" fill="{GOLD}"/>
  <g transform="translate(200 524) scale(1.18) translate(-200 -524)">
    <g filter="url(#cut)" fill="#3A4A5A"><path d="M170,404 L197,404 L195,480 L172,480 Z"/><path d="M203,404 L230,404 L228,480 L205,480 Z"/></g>
    <g stroke="{RED}" stroke-width="4"><path d="M174,406 L174,478"/><path d="M226,406 L226,478"/></g>
    <g fill="{INK}"><path d="M170,476 L196,476 L196,520 L170,520 Z"/><path d="M204,476 L230,476 L230,520 L204,520 Z"/></g>
    <ellipse cx="180" cy="522" rx="20" ry="7" fill="{INK}"/><ellipse cx="222" cy="522" rx="20" ry="7" fill="{INK}"/>
    <path d="M156,292 C148,330 146,360 150,396" stroke="{UNI}" stroke-width="20" stroke-linecap="round" fill="none"/>
    <circle cx="151" cy="400" r="11" fill="{SKIN}"/>
    <path d="M156,282 C150,330 152,370 158,410 L242,410 C248,370 250,330 244,282 C224,270 176,270 156,282 Z" fill="{UNI}" filter="url(#cut)"/>
    <path d="M164,284 L236,390 M236,284 L164,390" stroke="{CREAM}" stroke-width="9"/>
    <rect x="156" y="386" width="88" height="14" fill="{INK}"/><rect x="192" y="384" width="16" height="18" fill="{GOLD2}"/>
    <g fill="{GOLD2}"><circle cx="200" cy="300" r="3.5"/><circle cx="200" cy="322" r="3.5"/><circle cx="200" cy="364" r="3.5"/></g>
    <path d="M182,270 L218,270 L216,284 L184,284 Z" fill="{RED}"/>
    <g filter="url(#cut)">
      <path d="M252,400 L244,344 L262,340 L270,398 Z" fill="#7A4A28"/>
      <path d="M254,344 L276,112 L284,113 L264,344 Z" fill="#3F3530"/>
    </g>
    <path d="M244,290 C262,306 266,330 258,352" stroke="{UNI}" stroke-width="20" stroke-linecap="round" fill="none"/>
    <circle cx="258" cy="354" r="11" fill="{SKIN}"/>
    <rect x="192" y="246" width="16" height="24" fill="{SKIN3}"/>
    <ellipse cx="200" cy="230" rx="25" ry="29" fill="{SKIN}"/>
    <path d="M188,246 C194,242 206,242 212,246 C214,252 206,252 200,249 C194,252 186,252 188,246 Z" fill="{INK}"/>
    <circle cx="190" cy="228" r="2.8" fill="{INK}"/><circle cx="210" cy="228" r="2.8" fill="{INK}"/>
    <g filter="url(#cut)">
      <path d="M176,172 L224,172 L228,208 L172,208 Z" fill="#274F35"/>
      <rect x="172" y="196" width="56" height="9" fill="{RED}"/>
      <path d="M170,206 C182,216 200,216 212,208 Z" fill="{INK}"/>
    </g>
    <circle cx="200" cy="184" r="5" fill="{GOLD2}"/>
  </g>
''')

# ---- 35 La Estrella
pts = [pol(200, 284, 150 if k % 2 == 0 else 62, -90 + k * 36) for k in range(10)]
facets = ''.join(f'<path d="M200,284 L{pts[k][0]:.1f},{pts[k][1]:.1f} L{pts[(k + 1) % 10][0]:.1f},{pts[(k + 1) % 10][1]:.1f} Z" fill="{GOLD2 if k % 2 == 0 else GOLD}"/>' for k in range(10))
ART[35] = ('La Estrella', '#22304F', f'''
  <circle cx="200" cy="284" r="190" fill="{GOLD2}" opacity=".07"/>
  <g filter="url(#cut)"><path d="M{' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)} Z" fill="{GOLD2}"/></g>
  {facets}
  <g fill="{CREAM}">
    <path d="M72,96 l5,14 l14,5 l-14,5 l-5,14 l-5,-14 l-14,-5 l14,-5 Z"/><path d="M330,440 l5,14 l14,5 l-14,5 l-5,14 l-5,-14 l-14,-5 l14,-5 Z"/>
    <path d="M332,112 l3,8 l8,3 l-8,3 l-3,8 l-3,-8 l-8,-3 l8,-3 Z"/><path d="M76,454 l3,8 l8,3 l-8,3 l-3,8 l-3,-8 l-8,-3 l8,-3 Z"/>
  </g>
''')

# ---- 36 El Cazo: a copper pot, steaming
ART[36] = ('El Cazo', '#CFE3C5', f'''
  <path d="M0,500 L400,500 L400,560 L0,560 Z" fill="#A9CC9E"/>
  <ellipse cx="200" cy="494" rx="130" ry="14" fill="{INK}" opacity=".18"/>
  <g stroke="{CREAM}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9">
    <path d="M150,230 C136,200 164,180 150,150 C140,128 152,110 160,98"/><path d="M200,220 C186,190 214,170 200,140 C190,118 202,100 210,88"/><path d="M250,230 C236,200 264,180 250,150 C240,128 252,110 260,98"/>
  </g>
  <g stroke="#9C4A22" stroke-width="12" fill="none" stroke-linecap="round" filter="url(#cut)">
    <path d="M70,300 C30,296 30,346 74,350"/><path d="M330,300 C370,296 370,346 326,350"/>
  </g>
  <g filter="url(#cut)">
    <path d="M60,290 C60,420 120,492 200,492 C280,492 340,420 340,290 Z" fill="#C4622D"/>
  </g>
  <path d="M96,320 C104,400 140,452 180,468" stroke="#E0905A" stroke-width="12" fill="none" stroke-linecap="round" opacity=".7"/>
  <ellipse cx="200" cy="290" rx="146" ry="30" fill="#9C4A22"/>
  <ellipse cx="200" cy="292" rx="132" ry="22" fill="#6E3418"/>
''')

# ---- 37 El Mundo: a globe on its stand
ART[37] = ('El Mundo', '#F3D3CB', f'''
  <path d="M0,506 L400,506 L400,560 L0,560 Z" fill="#E4B3A6"/>
  <g filter="url(#cut)">
    <path d="M150,500 L250,500 L236,478 L164,478 Z" fill="{GOLD}"/><rect x="194" y="424" width="12" height="60" fill="{GOLD}"/>
  </g>
  <path d="M114,378 A140,140 0 0 1 200,110" stroke="{GOLD}" stroke-width="10" fill="none" transform="rotate(-20 200 260)"/>
  <g filter="url(#cut)"><circle cx="200" cy="264" r="128" fill="#3F7FB0"/></g>
  <clipPath id="globe37"><circle cx="200" cy="264" r="128"/></clipPath>
  <g clip-path="url(#globe37)" fill="{GREEN2}">
    <path d="M120,168 C150,150 196,156 214,176 C226,192 210,210 196,214 C184,218 186,236 172,244 C160,252 150,266 150,282 C140,270 124,262 112,240 C100,220 100,190 120,168 Z"/>
    <path d="M180,286 C200,280 222,292 226,316 C230,346 216,376 204,404 C198,418 186,420 184,404 C180,380 170,352 168,326 C166,306 168,292 180,286 Z"/>
    <path d="M270,176 C290,170 316,186 322,210 C312,212 296,206 282,210 C270,202 262,188 270,176 Z"/>
  </g>
  <g stroke="#FFFFFF" stroke-width="2" fill="none" opacity=".25" clip-path="url(#globe37)">
    <ellipse cx="200" cy="264" rx="60" ry="128"/><path d="M72,264 L328,264"/><ellipse cx="200" cy="264" rx="128" ry="50"/>
  </g>
  <path d="M130,186 C150,160 180,148 206,150" stroke="#FFFFFF" stroke-width="8" fill="none" stroke-linecap="round" opacity=".35"/>
  <path d="M118,370 A140,140 0 0 0 290,380" stroke="{GOLD}" stroke-width="10" fill="none"/>
''')

# ---- 39 El Nopal
pad = lambda x, y, rx, ry, r, c=GREEN: f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" transform="rotate({r} {x} {y})" fill="{c}"/>'
spines = ''.join(f'<path d="M{x},{y} l-5,-4 M{x},{y} l5,-4"/>' for x, y in [(198, 430), (186, 400), (212, 392), (200, 360), (140, 310), (128, 280), (152, 270), (262, 300), (274, 272), (250, 262), (200, 220), (186, 196), (214, 190), (112, 196), (292, 190)])
ART[39] = ('El Nopal', '#F4C9A0', f'''
  <path d="M0,500 C120,486 280,486 400,500 L400,560 L0,560 Z" fill="#D9975E"/>
  <g filter="url(#cut)">
    {pad(200, 410, 58, 78, 0)}
    {pad(136, 292, 48, 64, -24, GREEN2)}{pad(266, 286, 48, 64, 22, GREEN2)}
    {pad(200, 212, 46, 62, 0)}
    {pad(108, 190, 36, 48, -30)}{pad(296, 184, 36, 48, 28)}
  </g>
  <g stroke="#E9DDB8" stroke-width="2.5" stroke-linecap="round">{spines}</g>
  <g filter="url(#cut)" fill="{PINK}">
    <ellipse cx="190" cy="142" rx="13" ry="17"/><ellipse cx="220" cy="146" rx="12" ry="16"/><ellipse cx="92" cy="138" rx="12" ry="16" transform="rotate(-30 92 138)"/>
    <ellipse cx="312" cy="132" rx="12" ry="16" transform="rotate(28 312 132)"/><ellipse cx="102" cy="230" rx="11" ry="15" transform="rotate(-70 102 230)"/>
  </g>
''')

# ---- 40 El Alacrán, seen from above
tail = [(200, 392, 20), (236, 434, 18), (284, 432, 17), (318, 396, 16), (322, 348, 15), (302, 312, 14)]
legs40 = ''.join(f'<path d="M{200 + s * 24},{y} L{200 + s * 70},{y + dy} L{200 + s * 96},{y + dy + 34}"/>' for s in (-1, 1) for y, dy in [(276, -18), (298, -6), (320, 8), (342, 20)])
ART[40] = ('El Alacrán', '#EBD5A0', f'''
  <g stroke="#5B3518" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#cut)">{legs40}</g>
  <g stroke="#5B3518" stroke-width="14" fill="none" stroke-linecap="round" filter="url(#cut)"><path d="M186,236 L140,196 L124,160"/><path d="M214,236 L260,196 L276,160"/></g>
  <g filter="url(#cut)" fill="#5B3518">
    <path d="M124,166 C96,150 92,110 112,92 C116,112 126,126 140,132 C138,108 146,94 160,88 C164,116 156,150 124,166 Z"/>
    <path d="M276,166 C304,150 308,110 288,92 C284,112 274,126 260,132 C262,108 254,94 240,88 C236,116 244,150 276,166 Z"/>
    <path d="M200,380 C206,470 318,478 324,388 C326,352 318,330 304,318" stroke="#5B3518" stroke-width="26" fill="none" stroke-linecap="round"/>
    <circle cx="302" cy="314" r="17"/>
    <path d="M292,306 C282,280 294,258 316,252 C308,272 308,290 308,306 Z"/>
    <ellipse cx="200" cy="318" rx="40" ry="78"/>
    <ellipse cx="200" cy="244" rx="30" ry="24"/>
  </g>
  <g stroke="#7A4A28" stroke-width="4" fill="none">{''.join(f'<path d="M166,{y} Q200,{y + 10} 234,{y}"/>' for y in (272, 300, 328, 356))}</g>
  <g stroke="#7A4A28" stroke-width="4" fill="none">{''.join(f'<path d="M{x - 13},{y - 6} L{x + 13},{y + 6}"/>' for x, y in [(214, 436), (252, 458), (292, 450), (318, 418), (322, 380)])}</g>
  <circle cx="192" cy="238" r="3.5" fill="{CREAM}"/><circle cx="208" cy="238" r="3.5" fill="{CREAM}"/>
''')
