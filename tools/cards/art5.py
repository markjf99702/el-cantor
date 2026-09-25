"""Cards 41–54."""
import math
from card import INK, CREAM, RED, RED2, TEAL, TEAL2, GOLD, GOLD2, GREEN, GREEN2, PINK, SKIN, SKIN2, SKIN3, flower

ART = {}


def pol(cx, cy, r, a):
    return cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))


# ---- 41 La Rosa
ART[41] = ('La Rosa', '#CFE3C5', f'''
  <path d="M200,292 C196,360 206,430 196,524" stroke="{GREEN}" stroke-width="11" fill="none" stroke-linecap="round" filter="url(#cut)"/>
  <g fill="{GREEN}" filter="url(#cut)">
    <path d="M198,400 C160,370 118,378 100,404 C132,420 170,420 198,400 Z"/><path d="M202,356 C236,322 280,326 298,352 C266,370 230,372 202,356 Z"/>
  </g>
  <g stroke="{GREEN2}" stroke-width="3" fill="none"><path d="M196,400 C166,396 138,398 112,404"/><path d="M204,356 C232,350 258,348 286,352"/></g>
  <g fill="{GREEN}"><path d="M196,450 L184,444 L196,440 Z"/><path d="M200,480 L212,474 L200,470 Z"/></g>
  <g filter="url(#cut)" fill="{RED}">
    {''.join(f'<ellipse cx="{pol(200, 214, 52, a)[0]:.0f}" cy="{pol(200, 214, 52, a)[1]:.0f}" rx="50" ry="40" transform="rotate({a + 90} {pol(200, 214, 52, a)[0]:.0f} {pol(200, 214, 52, a)[1]:.0f})"/>' for a in range(-90, 270, 72))}
    <circle cx="200" cy="214" r="62"/>
  </g>
  <path d="M200,214 m-12,0 a12,12 0 1,1 24,0 a24,24 0 1,1 -44,4 a38,38 0 1,1 68,-8 a54,54 0 1,1 -96,20" stroke="#8E2A26" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M152,176 C164,154 188,146 206,150" stroke="{RED2}" stroke-width="8" fill="none" stroke-linecap="round" opacity=".8"/>
''')

# ---- 42 La Calavera: a sugar skull and crossed bones
bone = lambda x1, y1, x2, y2: (f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{CREAM}" stroke-width="26" stroke-linecap="round"/>'
                               + ''.join(f'<circle cx="{x + dx}" cy="{y + dy}" r="17" fill="{CREAM}"/>' for x, y in ((x1, y1), (x2, y2)) for dx, dy in ((-9, -9), (9, 9))))
ART[42] = ('La Calavera', TEAL2, f'''
  <g transform="translate(200 262) scale(1.18) translate(-200 -262)">
  <g filter="url(#cut)">
    <circle cx="200" cy="236" r="112" fill="{CREAM}"/>
    <path d="M140,300 L260,300 L256,376 C256,388 246,394 234,394 L166,394 C154,394 144,388 144,376 Z" fill="{CREAM}"/>
  </g>
  <ellipse cx="156" cy="250" rx="34" ry="36" fill="{INK}"/><ellipse cx="244" cy="250" rx="34" ry="36" fill="{INK}"/>
  <g fill="{GOLD2}">{''.join(f'<circle cx="{pol(156, 250, 46, a)[0]:.0f}" cy="{pol(156, 250, 46, a)[1]:.0f}" r="4.5"/><circle cx="{pol(244, 250, 46, a)[0]:.0f}" cy="{pol(244, 250, 46, a)[1]:.0f}" r="4.5"/>' for a in range(200, 350, 30))}</g>
  <path d="M200,296 C188,282 176,300 200,322 C224,300 212,282 200,296 Z" fill="{INK}"/>
  <path d="M152,346 L248,346 L248,378 L152,378 Z" fill="{INK}"/>
  <g stroke="{CREAM}" stroke-width="4">{''.join(f'<path d="M{x},346 L{x},378"/>' for x in range(168, 248, 16))}</g>
  {flower(200, 170, 22)}{flower(148, 186, 12, petal=GOLD2, mid=RED)}{flower(252, 186, 12, petal=GOLD2, mid=RED)}
  </g>
  {''.join(flower(x, y, r, petal='#F29A55', mid=GOLD, n=8) for x, y, r in [(70, 500, 30), (140, 520, 24), (330, 500, 30), (262, 522, 24), (200, 530, 20)])}
''')

# ---- 43 La Campana
ART[43] = ('La Campana', '#D9CFE8', f'''
  <rect x="50" y="96" width="300" height="20" rx="4" fill="#7A5230" filter="url(#cut)"/>
  <g stroke="{CREAM}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9">
    <path d="M62,286 C50,310 50,340 62,364"/><path d="M40,270 C24,306 24,346 40,382"/><path d="M338,286 C350,310 350,340 338,364"/><path d="M360,270 C376,306 376,346 360,382"/>
  </g>
  <g filter="url(#cut)">
    <rect x="184" y="112" width="32" height="36" rx="6" fill="{GOLD}"/>
    <circle cx="200" cy="426" r="20" fill="#7A5230"/>
    <path d="M200,140 C150,140 136,190 134,260 C132,330 120,370 90,402 L310,402 C280,370 268,330 266,260 C264,190 250,140 200,140 Z" fill="{GOLD2}"/>
    <rect x="84" y="394" width="232" height="24" rx="11" fill="{GOLD}"/>
  </g>
  <path d="M152,190 C146,240 146,300 136,364" stroke="#F6D98A" stroke-width="12" fill="none" stroke-linecap="round"/>
  <path d="M136,330 C170,340 230,340 264,330" stroke="{GOLD}" stroke-width="5" fill="none"/>
''')

# ---- 44 El Cantarito: a clay jug
ART[44] = ('El Cantarito', '#9BCFCB', f'''
  <path d="M0,500 L400,500 L400,560 L0,560 Z" fill="#7FB9B4"/>
  <ellipse cx="200" cy="486" rx="110" ry="12" fill="{INK}" opacity=".2"/>
  <path d="M238,214 C310,210 330,270 296,318" stroke="#A04E22" stroke-width="20" fill="none" stroke-linecap="round" filter="url(#cut)"/>
  <g filter="url(#cut)">
    <path d="M166,190 L234,190 L240,244 C300,260 330,310 326,360 C322,432 268,480 200,480 C132,480 78,432 74,360 C70,310 100,260 160,244 Z" fill="#C4622D"/>
    <ellipse cx="200" cy="188" rx="50" ry="14" fill="#A04E22"/>
  </g>
  <ellipse cx="200" cy="188" rx="38" ry="8" fill="#5B2A12"/>
  <path d="M84,346 C140,366 260,366 316,346" stroke="{CREAM}" stroke-width="4" fill="none"/>
  <path d="M86,386 C140,406 260,406 314,386" stroke="{CREAM}" stroke-width="4" fill="none"/>
  <g fill="{CREAM}">{''.join(f'<circle cx="{x}" cy="{366 + 10 * math.sin((x - 100) / 30):.0f}" r="5"/>' for x in range(104, 300, 24))}</g>
  <path d="M112,300 C104,330 104,360 112,390" stroke="#E0905A" stroke-width="10" fill="none" stroke-linecap="round" opacity=".7"/>
''')

# ---- 45 El Venado
DEER, DEER2 = '#B5773F', '#8E5634'
ART[45] = ('El Venado', '#F6E3B4', f'''
  <path d="M0,500 C120,488 280,488 400,500 L400,560 L0,560 Z" fill="#9BBF7A"/>
  <g stroke="{DEER2}" stroke-width="13" stroke-linecap="round" filter="url(#cut)">
    <path d="M166,380 L160,498"/><path d="M196,382 L200,500"/><path d="M270,378 L262,496"/><path d="M300,370 L306,494"/>
  </g>
  <g fill="{INK}"><ellipse cx="160" cy="502" rx="8" ry="5"/><ellipse cx="200" cy="504" rx="8" ry="5"/><ellipse cx="262" cy="500" rx="8" ry="5"/><ellipse cx="306" cy="498" rx="8" ry="5"/></g>
  <g stroke="#7A5230" stroke-width="7" fill="none" stroke-linecap="round" filter="url(#cut)">
    <path d="M142,168 C150,130 176,108 206,98 M160,134 C150,114 146,98 150,82 M180,114 C178,94 182,78 190,66"/>
    <path d="M122,166 C108,130 110,100 126,76 M114,124 C98,116 88,104 84,88"/>
  </g>
  <g filter="url(#cut)">
    <ellipse cx="228" cy="330" rx="104" ry="58" fill="{DEER}"/>
    <path d="M318,300 C336,296 344,306 338,318 C330,318 322,314 318,300 Z" fill="{CREAM}"/>
    <path d="M136,318 C124,280 124,236 132,204 L166,210 C164,246 170,288 190,318 Z" fill="{DEER}"/>
    <ellipse cx="128" cy="194" rx="40" ry="26" transform="rotate(20 128 194)" fill="{DEER}"/>
    <path d="M154,172 C170,150 190,148 196,156 C184,170 168,178 154,172 Z" fill="{DEER}"/>
  </g>
  <path d="M136,236 C140,270 150,296 170,318 C150,300 138,280 134,250 Z" fill="{CREAM}" opacity=".85"/>
  <ellipse cx="94" cy="206" rx="7" ry="6" fill="{INK}"/>
  <circle cx="124" cy="186" r="4" fill="{INK}"/>
''')

# ---- 46 El Sol
rays46 = ''.join(f'<path d="M{pol(200, 276, 112, a - 8)[0]:.1f},{pol(200, 276, 112, a - 8)[1]:.1f} L{pol(200, 276, 176 if i % 2 == 0 else 150, a)[0]:.1f},{pol(200, 276, 176 if i % 2 == 0 else 150, a)[1]:.1f} L{pol(200, 276, 112, a + 8)[0]:.1f},{pol(200, 276, 112, a + 8)[1]:.1f} Z" fill="{GOLD if i % 2 else "#F29A55"}"/>'
                 for i, a in enumerate(range(0, 360, 22)))
ART[46] = ('El Sol', '#BFD9E8', f'''
  <g filter="url(#cut)">{rays46}</g>
  <g filter="url(#cut)"><circle cx="200" cy="276" r="120" fill="{GOLD2}"/></g>
  <circle cx="200" cy="276" r="96" fill="#F0C667"/>
  <circle cx="164" cy="258" r="8" fill="{INK}"/><circle cx="236" cy="258" r="8" fill="{INK}"/>
  <g stroke="{INK}" stroke-width="4.5" fill="none" stroke-linecap="round"><path d="M148,236 q16,-10 32,0"/><path d="M220,236 q16,-10 32,0"/><path d="M162,306 Q200,340 238,306"/></g>
  <circle cx="148" cy="294" r="15" fill="#F29A55" opacity=".55"/><circle cx="252" cy="294" r="15" fill="#F29A55" opacity=".55"/>
''')

# ---- 47 La Corona
ART[47] = ('La Corona', RED, f'''
  <path d="M0,500 L400,500 L400,560 L0,560 Z" fill="#9A2A27"/>
  <g filter="url(#cut)">
    <path d="M96,420 C96,448 304,448 304,420 L304,402 L96,402 Z" fill="#6E1F7A"/>
    <path d="M86,392 L86,212 L144,292 L172,176 L200,262 L228,176 L256,292 L314,212 L314,392 Z" fill="{GOLD2}"/>
    <rect x="80" y="352" width="240" height="48" rx="6" fill="{GOLD}"/>
  </g>
  <g fill="{CREAM}" filter="url(#cut)"><circle cx="86" cy="206" r="13"/><circle cx="172" cy="170" r="13"/><circle cx="228" cy="170" r="13"/><circle cx="314" cy="206" r="13"/><circle cx="200" cy="252" r="11"/></g>
  <ellipse cx="200" cy="376" rx="16" ry="14" fill="{RED2}" stroke="{CREAM}" stroke-width="3"/>
  <ellipse cx="138" cy="376" rx="12" ry="11" fill="{TEAL}"/><ellipse cx="262" cy="376" rx="12" ry="11" fill="{TEAL}"/>
  <ellipse cx="200" cy="316" rx="12" ry="16" fill="{TEAL2}"/><ellipse cx="116" cy="310" rx="9" ry="12" fill="{GREEN}"/><ellipse cx="284" cy="310" rx="9" ry="12" fill="{GREEN}"/>
  <path d="M104,236 L104,340" stroke="#F6D98A" stroke-width="9" stroke-linecap="round"/>
''')

# ---- 48 La Chalupa: Lupita rowing her flower boat
ART[48] = ('La Chalupa', '#F4C9A0', f'''
  <g transform="translate(200 440) scale(1.12) translate(-200 -430)">
  <path d="M0,416 C100,408 300,420 400,410 L400,560 L0,560 Z" fill="{TEAL2}"/>
  <g stroke="{CREAM}" stroke-width="3.5" fill="none" opacity=".7" stroke-linecap="round"><path d="M40,480 q16,-7 32,0 q16,7 32,0"/><path d="M250,500 q16,-7 32,0 q16,7 32,0"/><path d="M140,522 q14,-6 28,0"/></g>
  <path d="M330,120 L150,532" stroke="#7A5230" stroke-width="8" stroke-linecap="round" filter="url(#cut)"/>
  <path d="M252,340 C262,330 268,318 272,306" stroke="{SKIN}" stroke-width="13" stroke-linecap="round" fill="none"/>
  <path d="M212,340 C224,350 238,356 250,356" stroke="{SKIN}" stroke-width="13" stroke-linecap="round" fill="none"/>
  <g filter="url(#cut)">
    <path d="M212,352 C176,366 164,394 156,414 L290,414 C284,392 270,366 240,352 Z" fill="{TEAL}"/>
    <path d="M208,290 C200,316 200,340 206,360 L246,360 C252,340 252,316 244,290 C234,282 218,282 208,290 Z" fill="{CREAM}"/>
  </g>
  <path d="M210,306 L242,306" stroke="{RED}" stroke-width="5"/><g fill="{PINK}"><circle cx="218" cy="318" r="3"/><circle cx="226" cy="322" r="3"/><circle cx="234" cy="318" r="3"/></g>
  <circle cx="274" cy="302" r="9" fill="{SKIN}"/><circle cx="252" cy="358" r="9" fill="{SKIN}"/>
  <path d="M206,236 C200,270 204,300 200,320 L210,322 C214,300 212,270 214,244 Z M246,236 C252,270 248,300 252,320 L242,322 C238,300 240,270 238,244 Z" fill="#3A2A22"/>
  <circle cx="200" cy="322" r="4" fill="{RED}"/><circle cx="252" cy="322" r="4" fill="{RED}"/>
  <rect x="218" y="262" width="16" height="26" fill="{SKIN3}"/>
  <ellipse cx="226" cy="246" rx="23" ry="27" fill="{SKIN}"/>
  <path d="M202,246 C200,218 218,208 234,212 C250,216 252,232 250,242 C240,230 222,228 208,252 Z" fill="#3A2A22"/>
  <circle cx="246" cy="222" r="9" fill="{RED}"/>
  <circle cx="218" cy="248" r="2.6" fill="{INK}"/><circle cx="236" cy="248" r="2.6" fill="{INK}"/>
  <path d="M220,260 Q227,265 234,260" stroke="{INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <g filter="url(#cut)">
    <path d="M44,408 L356,408 L330,454 L70,454 Z" fill="#8A5A33"/>
    <rect x="58" y="414" width="286" height="12" fill="{RED}"/>
  </g>
  <g fill="{GOLD2}">{''.join(f'<circle cx="{x}" cy="438" r="4"/>' for x in range(90, 320, 26))}</g>
  {flower(84, 390, 20)}{flower(116, 380, 16, petal=GOLD2, mid=RED)}{flower(146, 392, 18, petal=RED2, mid=GOLD2)}{flower(318, 392, 16, petal=GOLD2, mid=RED)}
  </g>
''')

# ---- 49 El Pino
tiers = [(90, 310, 470, 360), (108, 292, 390, 282), (128, 272, 310, 204), (152, 248, 232, 124)]
ART[49] = ('El Pino', '#F3D3CB', f'''
  <path d="M0,506 C120,494 280,494 400,506 L400,560 L0,560 Z" fill="#E4B3A6"/>
  <rect x="186" y="456" width="28" height="60" fill="#7A5230" filter="url(#cut)"/>
  <g filter="url(#cut)">{''.join(f'<path d="M{x0},{yb} L200,{yt} L{x1},{yb} Z" fill="#2E5E38"/>' for x0, x1, yb, yt in tiers)}</g>
  {''.join(f'<path d="M{x0},{yb} L200,{yt} L200,{yb} Z" fill="{GREEN}"/>' for x0, x1, yb, yt in tiers)}
''')

# ---- 50 El Pescado
scales = ''.join(f'<path d="M{x},{y - 12} q10,12 0,24" />' for x in range(150, 260, 24) for y in (280, 312))
ART[50] = ('El Pescado', '#22304F', f'''
  <g fill="none" stroke="{CREAM}" stroke-width="3" opacity=".8"><circle cx="76" cy="206" r="12"/><circle cx="58" cy="164" r="8"/><circle cx="70" cy="128" r="5"/></g>
  <g stroke="#2F5E4A" stroke-width="10" fill="none" stroke-linecap="round" opacity=".9"><path d="M60,544 C50,480 80,440 64,390"/><path d="M340,544 C352,470 320,440 338,380"/></g>
  <g filter="url(#cut)" fill="#E8663F">
    <path d="M292,300 L360,236 L352,300 L360,364 Z"/>
    <path d="M160,244 C190,190 250,196 272,236 Z"/><path d="M190,352 C210,388 244,390 260,362 Z"/>
    <ellipse cx="196" cy="300" rx="116" ry="66" fill="#F29A55"/>
  </g>
  <g stroke="#E8663F" stroke-width="3" fill="none">{scales}</g>
  <path d="M126,256 C112,280 112,320 126,344" stroke="#E8663F" stroke-width="4" fill="none"/>
  <circle cx="112" cy="286" r="12" fill="{CREAM}"/><circle cx="109" cy="286" r="6" fill="{INK}"/>
  <path d="M82,316 Q92,322 100,316" stroke="{INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
''')

# ---- 51 La Palma
fronds = ''.join(f'<path d="M226,168 C{226 + dx * .5:.0f},{168 + dy * .5 - 34:.0f} {226 + dx * .9:.0f},{168 + dy * .8:.0f} {226 + dx},{168 + dy} C{226 + dx * .7:.0f},{168 + dy * .6 + 10:.0f} {226 + dx * .4:.0f},{168 + dy * .3 + 16:.0f} 226,176 Z"/>'
                 for dx, dy in [(-150, 30), (-120, -60), (-40, -110), (70, -100), (140, -30), (150, 50), (-90, 80)])
ART[51] = ('La Palma', '#F6E3B4', f'''
  <path d="M0,440 C100,432 300,444 400,436 L400,560 L0,560 Z" fill="{TEAL2}"/>
  <path d="M40,500 C120,440 280,440 360,500 L360,560 L40,560 Z" fill="#EBD5A0" filter="url(#cut)"/>
  <path d="M190,478 C196,400 200,300 226,172" stroke="#8A5A33" stroke-width="22" fill="none" stroke-linecap="round" filter="url(#cut)"/>
  <g stroke="#6E4526" stroke-width="3">{''.join(f'<path d="M{190 + (478 - y) * .12 - 11:.0f},{y} L{190 + (478 - y) * .12 + 11:.0f},{y - 4}"/>' for y in range(460, 200, -26))}</g>
  <g fill="{GREEN}" filter="url(#cut)">{fronds}</g>
  <g fill="#6E4526"><circle cx="214" cy="186" r="13"/><circle cx="238" cy="190" r="13"/><circle cx="226" cy="204" r="13"/></g>
''')

# ---- 52 La Maceta
ART[52] = ('La Maceta', '#D9CFE8', f'''
  <path d="M0,506 L400,506 L400,560 L0,560 Z" fill="#B9A6D3"/>
  <g filter="url(#cut)" fill="{GREEN}">
    <path d="M200,330 C170,280 120,250 84,262 C104,300 150,322 200,330 Z"/><path d="M200,330 C230,280 280,250 316,262 C296,300 250,322 200,330 Z"/>
    <path d="M198,330 C160,300 150,240 170,196 C196,236 204,290 198,330 Z"/><path d="M202,330 C240,300 250,240 230,196 C204,236 196,290 202,330 Z"/>
  </g>
  <g stroke="{GREEN}" stroke-width="7" fill="none" stroke-linecap="round"><path d="M200,330 L200,176"/><path d="M200,300 C180,260 150,230 128,208"/><path d="M200,300 C220,260 250,230 272,208"/></g>
  {flower(200, 164, 30, petal=RED2, mid=GOLD2)}{flower(124, 204, 24, petal=GOLD2, mid=RED)}{flower(276, 204, 24, petal=PINK, mid=GOLD2)}
  <g filter="url(#cut)">
    <path d="M122,352 L278,352 L256,500 L144,500 Z" fill="#C4622D"/>
    <rect x="108" y="330" width="184" height="36" rx="5" fill="#A04E22"/>
  </g>
  <path d="M132,420 L268,420" stroke="{CREAM}" stroke-width="4"/>
  <g fill="{CREAM}">{''.join(f'<path d="M{x},404 l6,8 l-6,8 l-6,-8 Z"/>' for x in range(150, 256, 22))}</g>
''')

# ---- 53 El Arpa
strings = ''.join(f'<path d="M{x},{156 + (x - 118) * 36 / 188:.0f} L{x},{168 + (288 - x) * 336 / 154:.0f}"/>' for x in range(136, 282, 12))
ART[53] = ('El Arpa', '#9BCFCB', f'''
  <path d="M0,506 L400,506 L400,560 L0,560 Z" fill="#7FB9B4"/>
  <g stroke="{CREAM}" stroke-width="2">{strings}</g>
  <g filter="url(#cut)">
    <path d="M288,168 L320,184 L172,504 L134,504 Z" fill="#A0673A"/>
    <path d="M100,130 C160,98 222,150 300,164 L306,190 C228,176 170,132 118,154 Z" fill="#8A5A33"/>
    <path d="M98,124 L124,124 L130,500 L100,500 Z" fill="{GOLD}"/>
    <rect x="88" y="494" width="100" height="20" rx="4" fill="#5B3518"/>
    <circle cx="110" cy="118" r="16" fill="{GOLD2}"/>
  </g>
  <g fill="{GOLD2}">{''.join(f'<circle cx="{302 - (y - 200) * 140 / 324:.0f}" cy="{y}" r="4"/>' for y in range(210, 490, 36))}</g>
''')

# ---- 54 La Rana, on a lily pad
ART[54] = ('La Rana', GOLD2, f'''
  <path d="M0,420 C100,412 300,424 400,416 L400,560 L0,560 Z" fill="{TEAL2}"/>
  <path d="M40,470 C40,430 110,410 200,410 C290,410 360,430 360,470 C360,500 290,520 200,520 C150,520 110,514 80,500 L200,470 Z" fill="{GREEN}" filter="url(#cut)"/>
  <g filter="url(#cut)" fill="{GREEN2}">
    <path d="M110,440 C70,430 70,380 110,360 C130,380 140,410 130,440 Z"/><path d="M290,440 C330,430 330,380 290,360 C270,380 260,410 270,440 Z"/>
    <ellipse cx="200" cy="370" rx="104" ry="80"/>
    <circle cx="150" cy="292" r="36"/><circle cx="250" cy="292" r="36"/>
  </g>
  <ellipse cx="200" cy="396" rx="62" ry="46" fill="#CFE08E"/>
  <circle cx="150" cy="290" r="22" fill="{CREAM}"/><circle cx="250" cy="290" r="22" fill="{CREAM}"/>
  <circle cx="154" cy="294" r="11" fill="{INK}"/><circle cx="246" cy="294" r="11" fill="{INK}"/>
  <path d="M136,346 Q200,384 264,346" stroke="#2E5E38" stroke-width="5" fill="none" stroke-linecap="round"/>
  <g fill="{GREEN2}" filter="url(#cut)"><ellipse cx="160" cy="448" rx="24" ry="10"/><ellipse cx="240" cy="448" rx="24" ry="10"/></g>
''')
