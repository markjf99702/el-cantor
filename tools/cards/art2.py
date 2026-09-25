"""Cards 2, 5, 7–12, 26 and 38."""
import math
from card import INK, CREAM, RED, RED2, TEAL, TEAL2, GOLD, GOLD2, GREEN, GREEN2, PINK, SKIN, SKIN2, SKIN3

ART = {}


def drop(x, y, s=1, fill='#2C5E73'):
    return (f'<path transform="translate({x} {y}) scale({s})" d="M0,-16 C9,-3 10,6 0,10 C-10,6 -9,-3 0,-16 Z" fill="{fill}"/>')


ART[2] = ('El Diablito', '#CFE3C5', f'''
  <path d="M0,500 C120,490 280,490 400,500 L400,560 L0,560 Z" fill="#A9CC9E"/>
  <g stroke="{INK}" stroke-width="7" fill="none" stroke-linecap="round" filter="url(#cut)">
    <path d="M118,150 L118,512"/><path d="M92,146 L92,184 C92,202 144,202 144,184 L144,146"/>
  </g>
  <g fill="{INK}"><path d="M86,150 L92,128 L98,150 Z"/><path d="M112,150 L118,126 L124,150 Z"/><path d="M138,150 L144,128 L150,150 Z"/></g>
  <path d="M232,430 C300,450 336,390 302,344" stroke="{RED}" stroke-width="10" fill="none" stroke-linecap="round" filter="url(#cut)"/>
  <path d="M292,352 L300,322 L316,350 Z" fill="{RED}"/>
  <g stroke="{RED}" stroke-width="26" stroke-linecap="round" filter="url(#cut)"><path d="M180,440 L174,494"/><path d="M220,440 L226,494"/></g>
  <ellipse cx="170" cy="504" rx="17" ry="9" fill="{INK}"/><ellipse cx="230" cy="504" rx="17" ry="9" fill="{INK}"/>
  <ellipse cx="200" cy="382" rx="64" ry="80" fill="{RED}" filter="url(#cut)"/>
  <ellipse cx="200" cy="398" rx="34" ry="44" fill="{RED2}"/>
  <path d="M150,346 C136,340 128,334 122,330" stroke="{RED}" stroke-width="22" stroke-linecap="round" fill="none"/>
  <circle cx="120" cy="330" r="13" fill="{RED}"/>
  <path d="M250,346 C272,362 276,384 254,404" stroke="{RED}" stroke-width="20" stroke-linecap="round" fill="none"/>
  <g filter="url(#cut)">
    <path d="M160,232 C148,204 154,184 166,174 C168,196 178,212 188,222 Z" fill="{GOLD2}"/>
    <path d="M240,232 C252,204 246,184 234,174 C232,196 222,212 212,222 Z" fill="{GOLD2}"/>
    <path d="M152,256 L130,236 L150,280 Z M248,256 L270,236 L250,280 Z" fill="{RED}"/>
    <circle cx="200" cy="264" r="54" fill="{RED}"/>
  </g>
  <ellipse cx="181" cy="258" rx="12" ry="14" fill="{CREAM}"/><ellipse cx="219" cy="258" rx="12" ry="14" fill="{CREAM}"/>
  <circle cx="184" cy="261" r="6" fill="{INK}"/><circle cx="222" cy="261" r="6" fill="{INK}"/>
  <g stroke="{INK}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M166,238 L192,248"/><path d="M234,238 L208,248"/><path d="M178,286 Q200,304 222,286"/></g>
  <path d="M206,292 L212,292 L209,301 Z" fill="{CREAM}"/>
  <path d="M192,312 L208,312 L200,334 Z" fill="{INK}"/>
''')

ART[5] = ('El Paraguas', '#BFD9E8', f'''
  {''.join(drop(x, y) for x, y in [(78, 100), (150, 76), (262, 88), (330, 118), (58, 330), (96, 428), (306, 380), (342, 470), (254, 492)])}
  <g filter="url(#cut)">
    <path d="M200,122 C130,122 60,170 50,280 Q87,256 125,280 C140,210 170,150 200,122 Z" fill="{RED}"/>
    <path d="M200,122 C170,150 140,210 125,280 Q162,256 200,280 Z" fill="{GOLD2}"/>
    <path d="M200,122 L200,280 Q237,256 275,280 C260,210 230,150 200,122 Z" fill="{RED}"/>
    <path d="M200,122 C230,150 260,210 275,280 Q312,256 350,280 C340,170 270,122 200,122 Z" fill="{GOLD2}"/>
  </g>
  <path d="M195,124 L200,98 L205,124 Z" fill="{INK}"/>
  <path d="M200,276 L200,470" stroke="{INK}" stroke-width="7"/>
  <path d="M200,468 C200,506 244,506 244,470" stroke="#5B3518" stroke-width="11" fill="none" stroke-linecap="round" filter="url(#cut)"/>
''')

rails = [(120, 534, 188, 66), (208, 534, 276, 66)]
rungs = ''.join(
    f'<path d="M{120 + 68 * t:.0f},{534 - 468 * t:.0f} L{208 + 68 * t:.0f},{534 - 468 * t:.0f}"/>' for t in [i / 9 for i in range(1, 9)])
ART[7] = ('La Escalera', '#F4C9A0', f'''
  <path d="M0,506 L400,506 L400,560 L0,560 Z" fill="#E0A878"/>
  <g filter="url(#cut)">
    <g stroke="#B07B4C" stroke-width="13" stroke-linecap="round">{rungs}</g>
    <g stroke="#8A5A33" stroke-width="20" stroke-linecap="round">{''.join(f'<path d="M{a},{b} L{c},{d}"/>' for a, b, c, d in rails)}</g>
  </g>
''')

ART[8] = ('La Botella', '#D9CFE8', f'''
  <path d="M0,512 L400,512 L400,560 L0,560 Z" fill="#B9A6D3"/>
  <g filter="url(#cut)">
    <path d="M140,490 L140,300 C140,258 176,242 184,210 L184,138 L216,138 L216,210 C224,242 260,258 260,300 L260,490 C260,504 250,512 236,512 L164,512 C150,512 140,504 140,490 Z" fill="#2F6B45"/>
    <rect x="178" y="126" width="44" height="14" rx="4" fill="#3E7D4A"/>
    <rect x="186" y="96" width="28" height="34" rx="5" fill="#C9A26B"/>
  </g>
  <path d="M158,300 L158,474" stroke="#7FB88A" stroke-width="10" stroke-linecap="round" opacity=".55"/>
  <path d="M193,150 L193,204" stroke="#7FB88A" stroke-width="5" stroke-linecap="round" opacity=".55"/>
  <g filter="url(#cut)"><rect x="150" y="340" width="100" height="94" rx="4" fill="{CREAM}"/></g>
  <rect x="150" y="352" width="100" height="8" fill="{RED}"/><rect x="150" y="414" width="100" height="8" fill="{RED}"/>
  <path d="M200,370 L212,387 L200,404 L188,387 Z" fill="{GOLD}"/>
''')

hoops = ''.join(f'<path d="M113,{y} C170,{y + 14} 230,{y + 14} 287,{y}"/>' for y in (198, 228, 410, 440))
ART[9] = ('El Barril', TEAL2, f'''
  <path d="M0,480 L400,480 L400,560 L0,560 Z" fill="#2F7F7B"/>
  <ellipse cx="200" cy="484" rx="104" ry="13" fill="{INK}" opacity=".22"/>
  <g filter="url(#cut)">
    <path d="M120,160 C104,260 104,380 120,480 L280,480 C296,380 296,260 280,160 Z" fill="#A0673A"/>
  </g>
  <g stroke="#7A4A28" stroke-width="3.5" fill="none"><path d="M160,164 C150,260 150,380 160,480"/><path d="M200,166 L200,480"/><path d="M240,164 C250,260 250,380 240,480"/></g>
  <g stroke="#3F3530" stroke-width="12" fill="none">{hoops}</g>
  <ellipse cx="200" cy="160" rx="80" ry="22" fill="#8A5A33"/><ellipse cx="200" cy="162" rx="64" ry="15" fill="#6E4526"/>
''')

ART[10] = ('El Árbol', '#F6E3B4', f'''
  <path d="M0,506 C120,494 280,494 400,506 L400,560 L0,560 Z" fill="#9BBF7A"/>
  <g filter="url(#cut)">
    <path d="M176,520 C186,470 188,420 186,352 L214,352 C212,420 214,470 224,520 Z" fill="#7A5230"/>
    <g stroke="#7A5230" stroke-width="14" stroke-linecap="round" fill="none"><path d="M192,400 C170,378 150,360 140,336"/><path d="M208,390 C232,366 250,350 262,324"/></g>
  </g>
  <g filter="url(#cut)" fill="{GREEN}">
    <circle cx="200" cy="250" r="118"/><circle cx="118" cy="296" r="70"/><circle cx="282" cy="296" r="70"/><circle cx="200" cy="162" r="84"/>
  </g>
  <g fill="{GREEN2}"><circle cx="160" cy="190" r="44"/><circle cx="98" cy="282" r="30"/><circle cx="236" cy="150" r="30"/></g>
''')

seeds = ''.join(
    f'<ellipse cx="{200 + dx:.1f}" cy="{300 + dy:.1f}" rx="6" ry="3.2" transform="rotate({r} {200 + dx:.1f} {300 + dy:.1f})" fill="{CREAM}"/>'
    for dx, dy, r in [(-40, -6, 10), (-24, 8, -20), (-8, -10, 30), (8, 9, -10), (24, -8, 20), (40, 5, -30), (-30, -14, 40), (30, 14, 10), (-12, 14, 0), (14, -14, -35)])
net = ''.join(f'<path d="M{200 + 140 * math.cos(a):.0f},300 Q{200 + 60 * math.cos(a):.0f},420 {200 + 20 * math.cos(a):.0f},450"/>' for a in [0.3, 0.8, 1.3, 1.8, 2.3, 2.8])
ART[11] = ('El Melón', '#9BCFCB', f'''
  <path d="M0,480 L400,480 L400,560 L0,560 Z" fill="#7FB9B4"/>
  <ellipse cx="200" cy="452" rx="120" ry="14" fill="{INK}" opacity=".2"/>
  <g filter="url(#cut)">
    <path d="M58,300 C58,396 124,452 200,452 C276,452 342,396 342,300 Z" fill="#C2B070"/>
  </g>
  <g stroke="#A8964F" stroke-width="3" fill="none">{net}</g>
  <ellipse cx="200" cy="300" rx="142" ry="54" fill="#CFE08E"/>
  <ellipse cx="200" cy="300" rx="130" ry="47" fill="#F29A55"/>
  <ellipse cx="200" cy="302" rx="66" ry="24" fill="#E0793A"/>
  {seeds}
''')

ART[12] = ('El Valiente', '#F3D3CB', f'''
  <clipPath id="srp12"><path d="M150,276 C176,270 198,282 198,300 L188,462 L110,452 C114,380 128,310 150,276 Z"/></clipPath>
  <path d="M0,506 L400,506 L400,560 L0,560 Z" fill="#E4B3A6"/>
  <g transform="translate(200 524) scale(1.2) translate(-200 -524)">
  <g filter="url(#cut)" fill="#EFE6D2">
    <path d="M170,400 L197,400 L195,516 L172,516 Z"/><path d="M203,400 L230,400 L228,516 L205,516 Z"/>
  </g>
  <ellipse cx="182" cy="522" rx="19" ry="7" fill="#7A4A28"/><ellipse cx="218" cy="522" rx="19" ry="7" fill="#7A4A28"/>
  <path d="M158,282 C152,330 154,370 160,404 L240,404 C246,370 248,330 242,282 C224,270 176,270 158,282 Z" fill="#EFE6D2" filter="url(#cut)"/>
  <rect x="158" y="390" width="84" height="16" fill="{RED}"/>
  <path d="M240,292 C262,272 276,248 282,220" stroke="#EFE6D2" stroke-width="22" stroke-linecap="round" fill="none"/>
  <g filter="url(#cut)">
    <path d="M276,204 L300,122 C308,146 306,182 292,208 Z" fill="#DCDCD4"/>
    <rect x="274" y="198" width="22" height="30" rx="4" fill="{INK}" transform="rotate(14 285 213)"/>
  </g>
  <circle cx="285" cy="214" r="12" fill="{SKIN}"/>
  <g filter="url(#cut)"><path d="M150,276 C176,270 198,282 198,300 L188,462 L110,452 C114,380 128,310 150,276 Z" fill="{RED}"/></g>
  <g clip-path="url(#srp12)">
    {''.join(f'<rect x="100" y="{y}" width="110" height="{h}" fill="{c}"/>' for y, h, c in [(300, 10, GOLD2), (316, 6, TEAL), (350, 14, CREAM), (370, 6, TEAL), (400, 10, GOLD2), (420, 6, INK)])}
  </g>
  <g stroke="{RED}" stroke-width="3">{''.join(f'<path d="M{x},{int(452 + (x - 110) * .12)} L{x - 1},{int(466 + (x - 110) * .12)}"/>' for x in range(114, 188, 7))}</g>
  <rect x="192" y="246" width="16" height="22" fill="{SKIN3}"/>
  <ellipse cx="200" cy="228" rx="25" ry="29" fill="{SKIN}"/>
  <path d="M175,226 C172,196 198,188 216,194 C232,200 230,218 226,228 C216,210 196,208 180,230 Z" fill="{INK}"/>
  <path d="M184,246 C192,240 208,240 216,246 C222,256 212,256 200,251 C188,256 178,256 184,246 Z" fill="{INK}"/>
  <g stroke="{INK}" stroke-width="3.5" stroke-linecap="round"><path d="M181,214 L195,220"/><path d="M219,214 L205,220"/></g>
  <circle cx="190" cy="226" r="2.8" fill="{INK}"/><circle cx="210" cy="226" r="2.8" fill="{INK}"/>
  </g>
''')

NSKIN, NINK = '#7A4B2C', '#1E1611'
ART[26] = ('El Negrito', RED, f'''
  <path d="M0,506 C120,496 280,496 400,506 L400,560 L0,560 Z" fill="#9A2A27"/>
  <g transform="translate(200 524) scale(1.2) translate(-200 -524)">
  <g filter="url(#cut)" fill="#F2E8D5">
    <path d="M170,414 L197,414 L195,516 L172,516 Z"/><path d="M203,414 L230,414 L228,516 L205,516 Z"/>
  </g>
  <g stroke="#D9CBB0" stroke-width="2"><path d="M184,420 L183,512"/><path d="M216,420 L217,512"/></g>
  <ellipse cx="180" cy="522" rx="22" ry="8" fill="{NINK}"/><ellipse cx="222" cy="522" rx="22" ry="8" fill="{NINK}"/>
  <ellipse cx="168" cy="522" rx="9" ry="6" fill="#F2E8D5"/><ellipse cx="234" cy="522" rx="9" ry="6" fill="#F2E8D5"/>
  <path d="M158,292 C150,330 150,360 152,392" stroke="#F2E8D5" stroke-width="22" stroke-linecap="round" fill="none"/>
  <path d="M154,280 C148,330 150,380 154,428 L246,428 C250,380 252,330 246,280 C226,268 174,268 154,280 Z" fill="#F2E8D5" filter="url(#cut)"/>
  <path d="M156,392 L200,392" stroke="#D9CBB0" stroke-width="3"/>
  <path d="M188,276 L212,276 L200,336 Z" fill="#FFFDF6"/>
  <path d="M186,276 L170,300 L196,346 Z M214,276 L230,300 L204,346 Z" fill="#E3D6BC"/>
  <path d="M196,284 L204,284 L208,330 L200,342 L192,330 Z" fill="{TEAL}"/><rect x="194" y="278" width="12" height="9" rx="2" fill="{TEAL}"/>
  <g fill="{NINK}"><circle cx="186" cy="364" r="3.5"/><circle cx="214" cy="364" r="3.5"/><circle cx="186" cy="392" r="3.5"/><circle cx="214" cy="392" r="3.5"/></g>
  <path d="M220,318 L236,318 L232,306 L226,314 L222,306 Z" fill="{GOLD2}"/>
  <path d="M242,292 C270,272 278,242 252,206" stroke="#F2E8D5" stroke-width="22" stroke-linecap="round" fill="none"/>
  <rect x="192" y="244" width="16" height="24" fill="{NSKIN}"/>
  <ellipse cx="176" cy="228" rx="5" ry="8" fill="{NSKIN}"/><ellipse cx="224" cy="228" rx="5" ry="8" fill="{NSKIN}"/>
  <ellipse cx="200" cy="226" rx="25" ry="29" fill="{NSKIN}"/>
  <path d="M176,214 C176,204 180,198 186,196 L186,210 Z M224,214 C224,204 220,198 214,196 L214,210 Z" fill="{NINK}"/>
  <circle cx="190" cy="222" r="3" fill="{NINK}"/><circle cx="210" cy="222" r="3" fill="{NINK}"/>
  <g stroke="{NINK}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M184,213 L195,212"/><path d="M205,212 L216,213"/><path d="M192,236 Q200,233 208,236"/></g>
  <path d="M192,243 Q200,249 208,243" stroke="#3A2418" stroke-width="3" stroke-linecap="round" fill="none"/>
  <g transform="rotate(-8 200 190)" filter="url(#cut)">
    <path d="M172,198 C170,170 180,154 200,154 C220,154 230,170 228,198 Z" fill="#1F4F52"/>
    <path d="M190,158 L200,168 L210,158" stroke="#173E40" stroke-width="3" fill="none"/>
    <rect x="172" y="184" width="56" height="10" fill="{NINK}"/>
    <ellipse cx="200" cy="198" rx="50" ry="9" fill="#1F4F52"/>
  </g>
  <circle cx="250" cy="200" r="12" fill="{NSKIN}"/>
  </g>
''')

ASKIN, ASHADE, HAIR = '#A86B42', '#8E5634', '#1E1611'
ART[38] = ('El Apache', '#E9A96B', f'''
  <path d="M24,356 L96,356 L112,318 L206,318 L222,356 L400,356 L400,560 L0,560 Z" fill="#D98D55"/>
  <path d="M0,500 L400,500 L400,560 L0,560 Z" fill="#C97B45"/>
  <g transform="translate(200 524) scale(1.2) translate(-200 -524)">
  <path d="M164,236 C156,184 244,184 236,236 C240,270 248,310 252,346 C230,356 170,356 148,346 C152,310 160,270 164,236 Z" fill="{HAIR}"/>
  <g filter="url(#cut)" fill="#F2E8D5">
    <path d="M166,410 L198,410 L194,514 L166,514 Z"/><path d="M202,410 L234,410 L234,514 L206,514 Z"/>
  </g>
  <ellipse cx="180" cy="516" rx="14" ry="6" fill="{ASKIN}"/><ellipse cx="220" cy="516" rx="14" ry="6" fill="{ASKIN}"/>
  <ellipse cx="180" cy="523" rx="21" ry="7" fill="#7A4A28"/><ellipse cx="220" cy="523" rx="21" ry="7" fill="#7A4A28"/>
  <path d="M140,280 C150,270 250,270 260,280 C262,322 246,372 236,404 L164,404 C154,372 138,322 140,280 Z" fill="{ASKIN}" filter="url(#cut)"/>
  <g stroke="{ASHADE}" stroke-width="3" fill="none" stroke-linecap="round"><path d="M166,322 Q183,334 198,322"/><path d="M202,322 Q217,334 234,322"/></g>
  <rect x="162" y="398" width="76" height="18" fill="{RED}"/><path d="M224,414 L240,462 L226,464 Z" fill="{RED}"/>
  <path d="M146,290 C136,320 128,356 118,394" stroke="{ASKIN}" stroke-width="30" stroke-linecap="round" fill="none"/>
  <ellipse cx="140" cy="326" rx="18" ry="28" fill="{ASKIN}" transform="rotate(16 140 326)"/>
  <path d="M254,290 C266,322 272,358 276,396" stroke="{ASKIN}" stroke-width="30" stroke-linecap="round" fill="none"/>
  <ellipse cx="262" cy="326" rx="18" ry="28" fill="{ASKIN}" transform="rotate(-12 262 326)"/>
  <circle cx="277" cy="404" r="14" fill="{ASKIN}"/>
  <path d="M130,246 Q94,394 130,542" stroke="#7A4A28" stroke-width="8" fill="none" stroke-linecap="round" filter="url(#cut)"/>
  <path d="M130,246 L130,542" stroke="#F2E8D5" stroke-width="2"/>
  <circle cx="116" cy="396" r="14" fill="{ASKIN}"/>
  <rect x="187" y="248" width="26" height="30" fill="{ASHADE}"/>
  <path d="M176,208 C176,186 224,186 224,208 L224,238 C224,256 212,266 200,266 C188,266 176,256 176,238 Z" fill="{ASKIN}"/>
  <path d="M175,212 C172,184 228,184 225,212 C214,202 186,202 175,212 Z" fill="{HAIR}"/>
  <path d="M177,224 C166,262 160,302 156,346 C164,352 174,352 180,348 C180,304 184,264 188,234 Z" fill="{HAIR}"/>
  <path d="M223,224 C234,262 240,302 244,346 C236,352 226,352 220,348 C220,304 216,264 212,234 Z" fill="{HAIR}"/>
  <path d="M173,204 C190,198 210,198 227,204 L227,216 C210,210 190,210 173,216 Z" fill="{RED}"/>
  <path d="M226,208 L246,228 L238,234 Z M226,212 L242,246 L234,248 Z" fill="{RED}"/>
  <circle cx="190" cy="228" r="2.8" fill="{INK}"/><circle cx="210" cy="228" r="2.8" fill="{INK}"/>
  <g stroke="{INK}" stroke-width="3.2" stroke-linecap="round" fill="none"><path d="M183,220 L196,219"/><path d="M204,219 L217,220"/></g>
  <path d="M200,230 L198,242 L203,243" stroke="{ASHADE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M193,252 Q200,255 207,252" stroke="#6B3A1E" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
''')
