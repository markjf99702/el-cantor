"""Cards 13–22, 24 and 25."""
from card import INK, CREAM, RED, RED2, TEAL, TEAL2, GOLD, GOLD2, GREEN, GREEN2, PINK, SKIN, SKIN2, SKIN3

ART = {}

ART[13] = ('El Gorrito', '#F6E3B4', f'''
  <g transform="translate(200 330) scale(1.12) translate(-200 -316)">
  <clipPath id="gor13"><path d="M90,384 C90,252 140,184 200,184 C260,184 310,252 310,384 Z"/></clipPath>
  
  <path d="M90,384 C90,252 140,184 200,184 C260,184 310,252 310,384 Z" fill="{RED}" filter="url(#cut)"/>
  <g clip-path="url(#gor13)"><rect x="80" y="262" width="240" height="22" fill="{CREAM}"/><rect x="80" y="318" width="240" height="22" fill="{CREAM}"/></g>
  <path d="M78,372 L322,372 L322,430 C322,440 314,448 304,448 L96,448 C86,448 78,440 78,430 Z" fill="{TEAL}" filter="url(#cut)"/>
  <g stroke="{TEAL2}" stroke-width="5">{''.join(f'<path d="M{x},380 L{x},440"/>' for x in range(96, 312, 16))}</g>
  <g filter="url(#cut)"><circle cx="200" cy="170" r="40" fill="{CREAM}"/></g>
  <g fill="#E7D5AE">{''.join(f'<circle cx="{x}" cy="{y}" r="5"/>' for x, y in [(184, 160), (212, 154), (200, 180), (220, 176), (180, 184)])}</g>
  </g>
''')

ART[14] = ('La Muerte', '#D9CFE8', f'''
  <path d="M0,510 L400,510 L400,560 L0,560 Z" fill="#B9A6D3"/>
  <path d="M300,526 L262,112" stroke="#7A5230" stroke-width="10" stroke-linecap="round" filter="url(#cut)"/>
  <path d="M266,116 C226,86 150,90 104,138 C160,118 222,124 262,150 Z" fill="#C9CED6" filter="url(#cut)"/>
  <path d="M110,134 C160,116 222,122 262,146" stroke="#EEF0F3" stroke-width="3" fill="none"/>
  <path d="M200,150 C150,150 124,200 120,262 C110,362 96,452 80,520 L320,520 C304,452 290,362 280,262 C276,200 250,150 200,150 Z" fill="{INK}" filter="url(#cut)"/>
  <ellipse cx="200" cy="240" rx="48" ry="58" fill="#120D0A"/>
  <circle cx="200" cy="232" r="36" fill="{CREAM}"/>
  <path d="M180,252 L220,252 L218,282 L182,282 Z" fill="{CREAM}"/>
  <ellipse cx="186" cy="234" rx="10" ry="11" fill="{INK}"/><ellipse cx="214" cy="234" rx="10" ry="11" fill="{INK}"/>
  <path d="M200,246 L195,258 L205,258 Z" fill="{INK}"/>
  <g stroke="{INK}" stroke-width="2.5"><path d="M184,270 L216,270"/><path d="M190,264 L190,278 M200,264 L200,278 M210,264 L210,278"/></g>
  <circle cx="282" cy="330" r="13" fill="{CREAM}"/>
  <g stroke="{CREAM}" stroke-width="5" stroke-linecap="round"><path d="M270,322 L262,316 M270,332 L260,332 M272,342 L264,346"/></g>
''')

ART[15] = ('La Pera', RED, f'''
  <path d="M0,500 L400,500 L400,560 L0,560 Z" fill="#9A2A27"/>
  <ellipse cx="200" cy="496" rx="86" ry="11" fill="{INK}" opacity=".25"/>
  <path d="M200,152 C206,130 210,116 214,104" stroke="#6E4526" stroke-width="9" stroke-linecap="round" fill="none"/>
  <g filter="url(#cut)">
    <path d="M200,150 C228,150 238,180 240,214 C242,252 292,292 292,372 C292,442 252,492 200,492 C148,492 108,442 108,372 C108,292 158,252 160,214 C162,180 172,150 200,150 Z" fill="#CBD35C"/>
    <path d="M210,114 C228,88 264,88 280,106 C262,124 232,128 210,114 Z" fill="{GREEN}"/>
  </g>
  <path d="M214,112 C236,106 256,104 272,106" stroke="{GREEN2}" stroke-width="3" fill="none"/>
  <ellipse cx="246" cy="398" rx="40" ry="54" fill="#E07050" opacity=".22"/>
  <ellipse cx="150" cy="360" rx="14" ry="34" fill="#F3F0C0" opacity=".7" transform="rotate(12 150 360)"/>
''')

ART[16] = ('La Bandera', '#BFD9E8', f'''
  <path d="M0,506 L400,506 L400,560 L0,560 Z" fill="#9FC39A"/>
  <g transform="translate(30 70) scale(1.1) translate(-40 -60)">
  <clipPath id="flag16"><path d="M96,122 C150,100 200,146 260,124 C300,110 322,112 344,118 L344,334 C322,328 300,326 260,340 C200,362 150,316 96,336 Z"/></clipPath>
  <path d="M92,104 L92,470" stroke="#6E4526" stroke-width="9" stroke-linecap="round" filter="url(#cut)"/>
  <circle cx="92" cy="98" r="11" fill="{GOLD2}"/>
  <g filter="url(#cut)"><path d="M96,122 C150,100 200,146 260,124 C300,110 322,112 344,118 L344,334 C322,328 300,326 260,340 C200,362 150,316 96,336 Z" fill="{CREAM}"/></g>
  <g clip-path="url(#flag16)">
    <rect x="90" y="90" width="86" height="280" fill="#2E7D4F"/>
    <rect x="264" y="90" width="90" height="280" fill="{RED}"/>
    <path d="M96,160 C150,140 200,186 260,164 C300,150 322,152 344,158 L344,190 C322,184 300,182 260,196 C200,218 150,172 96,192 Z" fill="#000" opacity=".06"/>
  </g>
  <path d="M200,256 Q220,276 240,256" stroke="#2E7D4F" stroke-width="6" fill="none" stroke-linecap="round"/>
  <g fill="#7A4A28">
    <ellipse cx="220" cy="232" rx="11" ry="17"/><circle cx="214" cy="212" r="7"/>
    <path d="M212,222 C196,206 186,214 188,236 C198,230 204,232 212,236 Z"/><path d="M228,222 C244,206 254,214 252,236 C242,230 236,232 228,236 Z"/>
  </g>
  </g>
''')

ART[17] = ('El Bandolón', '#9BCFCB', f'''
  <g transform="rotate(-14 200 330)">
    <g filter="url(#cut)">
      <path d="M186,84 L214,84 L218,126 L182,126 Z" fill="#7A4A28"/>
      <rect x="189" y="120" width="22" height="196" fill="#7A4A28"/>
    </g>
    <rect x="194" y="126" width="12" height="186" fill="#3A2A22"/>
    <g fill="{CREAM}"><circle cx="180" cy="94" r="5"/><circle cx="178" cy="108" r="5"/><circle cx="220" cy="94" r="5"/><circle cx="222" cy="108" r="5"/></g>
    <g filter="url(#cut)">
      <path d="M200,298 C272,298 304,360 304,424 C304,486 258,526 200,526 C142,526 96,486 96,424 C96,360 128,298 200,298 Z" fill="#8A5A33"/>
      <path d="M200,308 C264,308 294,364 294,424 C294,480 252,516 200,516 C148,516 106,480 106,424 C106,364 136,308 200,308 Z" fill="#D9A05C"/>
    </g>
    <circle cx="200" cy="398" r="36" fill="none" stroke="{GOLD}" stroke-width="7"/>
    <circle cx="200" cy="398" r="26" fill="{INK}"/>
    <rect x="174" y="466" width="52" height="9" rx="2" fill="{INK}"/>
    <g stroke="{CREAM}" stroke-width="1.8"><path d="M196,126 L190,468"/><path d="M200,126 L200,468"/><path d="M204,126 L210,468"/></g>
  </g>
''')

ART[18] = ('El Violoncello', '#F3D3CB', f'''
  <path d="M0,512 L400,512 L400,560 L0,560 Z" fill="#E4B3A6"/>
  <path d="M200,500 L200,528" stroke="{INK}" stroke-width="5"/>
  <g filter="url(#cut)">
    <rect x="191" y="98" width="18" height="120" fill="#3A2A22"/>
    <circle cx="200" cy="88" r="14" fill="#6E2E17"/>
    <path d="M200,210 C236,210 268,228 268,262 C268,292 244,300 240,322 C236,344 288,360 288,420 C288,470 250,502 200,502 C150,502 112,470 112,420 C112,360 164,344 160,322 C156,300 132,292 132,262 C132,228 164,210 200,210 Z" fill="#9A4322"/>
  </g>
  <path d="M200,86 m-7,0 a7,7 0 1,1 7,7" stroke="#3A1A0C" stroke-width="3" fill="none"/>
  <path d="M200,222 C230,222 256,236 256,262 C256,284 236,296 230,316 C226,344 276,362 276,420 C276,462 244,490 200,490 C156,490 124,462 124,420 C124,362 174,344 170,316 C164,296 144,284 144,262 C144,236 170,222 200,222 Z" fill="none" stroke="#6E2E17" stroke-width="3"/>
  <g stroke="{INK}" stroke-width="4.5" fill="none" stroke-linecap="round">
    <path d="M168,352 C158,364 176,374 168,386 C160,398 176,406 168,416"/><path d="M232,352 C242,364 224,374 232,386 C240,398 224,406 232,416"/>
  </g>
  <rect x="176" y="420" width="48" height="10" rx="2" fill="{CREAM}"/>
  <path d="M188,438 L212,438 L206,486 L194,486 Z" fill="{INK}"/>
  <g stroke="{CREAM}" stroke-width="1.6"><path d="M195,104 L187,438"/><path d="M198,104 L196,438"/><path d="M202,104 L204,438"/><path d="M205,104 L213,438"/></g>
''')

ART[19] = ('La Garza', GOLD2, f'''
  <path d="M0,474 C100,466 300,480 400,470 L400,560 L0,560 Z" fill="{TEAL2}"/>
  <g stroke="{CREAM}" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"><path d="M170,498 q20,-8 40,0 q20,8 40,0"/><path d="M60,520 q16,-6 32,0"/><path d="M300,512 q16,-6 32,0"/></g>
  <g stroke="#C9A26B" stroke-width="7" stroke-linecap="round" fill="none"><path d="M214,376 L212,490"/><path d="M222,376 L250,418 L220,438"/></g>
  <path d="M168,300 C140,270 170,234 180,208 C190,182 172,160 150,160" stroke="#F4F0E8" stroke-width="24" stroke-linecap="round" fill="none" filter="url(#cut)"/>
  <g filter="url(#cut)">
    <path d="M150,300 C172,270 252,270 282,300 C302,320 300,362 272,380 C242,398 180,394 160,372 C140,352 134,320 150,300 Z" fill="#F4F0E8"/>
    <path d="M176,298 C206,284 264,290 290,318 C276,356 236,374 200,372 C224,350 214,318 176,298 Z" fill="#A7B5C6"/>
    <path d="M286,330 L330,352 L322,364 L278,356 Z" fill="#6E7F94"/>
  </g>
  <ellipse cx="150" cy="156" rx="21" ry="16" fill="#F4F0E8"/>
  <path d="M162,148 C182,138 200,140 214,146 C196,152 182,154 166,158 Z" fill="{INK}"/>
  <path d="M132,150 L64,166 L132,164 Z" fill="{GOLD}"/>
  <circle cx="145" cy="152" r="3.5" fill="{INK}"/>
''')

ART[20] = ('El Pájaro', '#CFE3C5', f'''
  <g filter="url(#cut)">
    <path d="M24,424 C140,410 260,396 376,384 L376,398 C260,410 140,424 24,440 Z" fill="#7A5230"/>
    <path d="M300,390 C318,366 344,362 360,372 C344,388 322,394 300,390 Z" fill="{GREEN}"/>
    <path d="M86,428 C80,404 94,386 112,380 C112,402 104,418 86,428 Z" fill="{GREEN}"/>
  </g>
  <g stroke="{GOLD}" stroke-width="6" stroke-linecap="round"><path d="M190,384 L186,414"/><path d="M216,384 L216,410"/></g>
  <g filter="url(#cut)">
    <path d="M276,344 L366,392 L352,412 L264,372 Z" fill="#1F4E73"/>
    <ellipse cx="212" cy="326" rx="92" ry="68" fill="#2E6E9E" transform="rotate(-12 212 326)"/>
    <circle cx="150" cy="258" r="46" fill="#2E6E9E"/>
  </g>
  <ellipse cx="172" cy="330" rx="50" ry="50" fill="#F29A55"/>
  <path d="M206,296 C256,276 306,296 318,338 C288,350 248,354 214,344 C226,330 222,310 206,296 Z" fill="#1F4E73" filter="url(#cut)"/>
  <path d="M110,252 L80,262 L110,272 Z" fill="{GOLD2}"/>
  <circle cx="142" cy="250" r="8" fill="{CREAM}"/><circle cx="140" cy="250" r="4" fill="{INK}"/>
''')

ART[21] = ('La Mano', TEAL2, f'''
  <g stroke="{SKIN2}" stroke-linecap="round" fill="none" filter="url(#cut)">
    <path d="M160,290 L148,150" stroke-width="38"/><path d="M198,284 L198,120" stroke-width="40"/>
    <path d="M236,290 L246,146" stroke-width="38"/><path d="M266,312 L290,200" stroke-width="32"/>
    <path d="M146,392 L94,300" stroke-width="42"/>
  </g>
  <path d="M130,300 C130,270 150,262 200,262 C250,262 272,270 272,304 L272,404 C272,452 242,482 200,482 C158,482 130,452 130,404 Z" fill="{SKIN2}" filter="url(#cut)"/>
  <g stroke="{SKIN}" stroke-width="4" fill="none" stroke-linecap="round"><path d="M154,378 Q204,356 252,338"/><path d="M160,420 Q196,408 236,416"/></g>
  <path d="M168,470 L232,470 L236,520 L164,520 Z" fill="{SKIN2}"/>
  <g filter="url(#cut)"><path d="M140,500 L260,500 L264,548 L136,548 Z" fill="{CREAM}"/></g>
  <rect x="138" y="506" width="124" height="8" fill="{RED}"/>
''')

ART[22] = ('La Bota', '#22304F', f'''
  <path d="M0,500 L400,500 L400,560 L0,560 Z" fill="#1B2640"/>
  <ellipse cx="190" cy="500" rx="140" ry="10" fill="#000" opacity=".3"/>
  <g filter="url(#cut)">
    <path d="M180,128 L284,128 L280,380 C282,410 290,440 292,470 L292,496 L250,496 L246,484 L160,484 C120,484 76,482 60,468 C58,452 80,446 110,442 C150,436 176,418 180,380 Z" fill="#B0643A"/>
  </g>
  <path d="M60,468 C76,482 120,484 160,484 L246,484 L250,496 L60,480 Z" fill="#3A2418"/>
  <rect x="250" y="470" width="42" height="26" fill="#5B3518"/>
  <path d="M60,468 C60,454 80,446 110,442 C130,440 146,434 158,426 C160,446 150,470 120,476 C96,478 70,476 60,468 Z" fill="#8A4A28"/>
  <path d="M178,128 L286,128 L286,158 C268,150 252,164 232,154 C212,164 196,150 178,158 Z" fill="#7A3B1E"/>
  <g stroke="{GOLD2}" stroke-width="3" fill="none" stroke-dasharray="6 5" stroke-linecap="round">
    <path d="M258,184 C214,190 206,236 236,246 C258,252 262,222 242,220"/><path d="M204,300 C248,294 262,340 230,350 C208,356 204,326 224,324"/>
  </g>
''')

ART[24] = ('El Cotorro', '#F6E3B4', f'''
  <path d="M40,436 L360,436" stroke="#7A5230" stroke-width="16" stroke-linecap="round" filter="url(#cut)"/>
  <g filter="url(#cut)">
    <path d="M190,456 L170,540 L196,540 L212,458 Z" fill="{RED}"/><path d="M208,456 L214,540 L236,536 L224,456 Z" fill="#2E6E9E"/>
    <path d="M200,204 C252,204 272,254 268,314 C264,384 242,440 212,468 L190,468 C168,420 146,362 148,302 C150,242 160,204 200,204 Z" fill="#3FA34D"/>
    <circle cx="196" cy="192" r="50" fill="#3FA34D"/>
  </g>
  <path d="M216,252 C258,254 272,306 264,364 C254,404 234,424 216,434 C228,384 230,322 216,252 Z" fill="#2B7A36" filter="url(#cut)"/>
  <path d="M216,396 C232,388 252,380 262,366 C256,394 238,418 216,434 Z" fill="{RED}"/>
  <path d="M232,420 C244,412 252,400 256,392 C254,410 246,424 234,432 Z" fill="#2E6E9E"/>
  <ellipse cx="176" cy="188" rx="19" ry="17" fill="{CREAM}"/><circle cx="176" cy="188" r="6" fill="{INK}"/>
  <path d="M150,186 C128,186 112,204 118,236 C126,220 140,214 156,218 Z" fill="{GOLD2}" filter="url(#cut)"/>
  <path d="M152,214 C144,222 144,232 150,238 C156,232 160,224 158,216 Z" fill="{GOLD}"/>
  <g stroke="#6E6E6E" stroke-width="6" stroke-linecap="round"><path d="M188,430 L184,446"/><path d="M216,430 L220,446"/></g>
''')

BSKIN = SKIN
ART[25] = ('El Borracho', '#F4C9A0', f'''
  <path d="M0,506 L400,506 L400,560 L0,560 Z" fill="#E0A878"/>
  <g fill="{CREAM}" stroke="#C98B5E" stroke-width="2" filter="url(#cut)"><circle cx="112" cy="146" r="15"/><circle cx="88" cy="112" r="10"/><circle cx="74" cy="84" r="6"/></g>
  <g transform="translate(-34 0) rotate(7 200 524)">
  <g transform="translate(200 524) scale(1.18) translate(-200 -524)">
    <g filter="url(#cut)" fill="#3A4A5A"><path d="M170,400 L197,400 L193,516 L170,516 Z"/><path d="M203,400 L230,400 L230,516 L207,516 Z"/></g>
    <ellipse cx="178" cy="522" rx="20" ry="7" fill="{INK}"/><ellipse cx="224" cy="522" rx="20" ry="7" fill="{INK}"/>
    <path d="M156,292 C136,316 118,336 100,344" stroke="#EFE6D2" stroke-width="20" stroke-linecap="round" fill="none"/>
    <circle cx="96" cy="346" r="11" fill="{BSKIN}"/>
    <path d="M158,282 C152,330 154,370 160,408 L240,408 C246,370 248,330 242,282 C224,270 176,270 158,282 Z" fill="#EFE6D2" filter="url(#cut)"/>
    <path d="M160,396 L200,408 L160,410 Z" fill="#E3D6BC"/>
    <g stroke="{RED}" stroke-width="7"><path d="M176,280 L176,404"/><path d="M224,280 L224,404"/></g>
    <path d="M242,292 C262,276 272,250 274,222" stroke="#EFE6D2" stroke-width="20" stroke-linecap="round" fill="none"/>
    <g filter="url(#cut)" transform="rotate(24 280 190)">
      <path d="M270,210 L270,162 C270,152 276,148 276,140 L276,118 L286,118 L286,140 C286,148 292,152 292,162 L292,210 Z" fill="#2F6B45"/>
    </g>
    <circle cx="276" cy="216" r="12" fill="{BSKIN}"/>
    <rect x="192" y="246" width="16" height="22" fill="{SKIN3}"/>
    <ellipse cx="200" cy="228" rx="25" ry="29" fill="{BSKIN}"/>
    <g stroke="{INK}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M184,224 q6,4 12,0"/><path d="M204,224 q6,4 12,0"/><path d="M190,246 Q202,252 212,242"/></g>
    <circle cx="200" cy="236" r="6" fill="{RED2}"/>
    <circle cx="184" cy="238" r="6" fill="{RED2}" opacity=".35"/><circle cx="216" cy="238" r="6" fill="{RED2}" opacity=".35"/>
    <path d="M178,242 C184,256 196,260 204,256" stroke="#3A2A22" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g transform="rotate(-22 200 200)" filter="url(#cut)">
      <ellipse cx="200" cy="206" rx="58" ry="12" fill="#D9B46A"/>
      <path d="M172,206 C172,174 184,160 200,160 C216,160 228,174 228,206 Z" fill="#D9B46A"/>
      <rect x="172" y="194" width="56" height="8" fill="{RED}"/>
    </g>
  </g>
  </g>
''')
