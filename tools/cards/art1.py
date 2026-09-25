"""Cards 1, 3, 4, 6, 23, 27: El Gallo, La Dama, El Catrín, La Sirena, La Luna, El Corazón."""
from card import star, note, INK, CREAM, RED, RED2, TEAL, TEAL2, GOLD, GOLD2, GREEN, GREEN2, PINK, SKIN, SKIN2, SKIN3

ART = {}

ART[1] = ('El Gallo', '#9BCFCB', f'''
  <circle cx="240" cy="280" r="118" fill="{GOLD2}"/>
  <path d="M0,488 C120,472 280,474 400,492 L400,560 L0,560 Z" fill="{GREEN}" filter="url(#cut)"/>
  <g transform="translate(212 316) scale(1.14) translate(-238 -325)">
    <g filter="url(#cut)">
      <path d="M258,360 C258,280 306,212 352,224 C318,240 294,292 287,368 Z" fill="{INK}"/>
      <path d="M262,366 C286,300 336,268 366,288 C332,294 306,330 293,374 Z" fill="{TEAL}"/>
      <path d="M266,374 C302,336 348,330 364,354 C332,350 306,368 293,388 Z" fill="{GREEN}"/>
    </g>
    <path d="M178,208 C186,250 196,285 214,305 C236,330 262,338 280,352 C298,368 292,410 262,428 C225,450 168,440 145,405 C122,370 132,320 140,280 C144,255 142,232 150,214 Z" fill="{RED}" filter="url(#cut)"/>
    <path d="M154,224 C170,216 184,222 190,242 L200,292 L188,280 L186,304 L175,286 L168,310 L158,288 L150,306 L144,282 C140,262 144,238 154,224 Z" fill="{GOLD}" filter="url(#cut)"/>
    <path d="M198,352 C230,330 278,352 270,394 C252,382 238,388 224,402 C228,386 214,370 198,352 Z" fill="#7E2622" filter="url(#cut)"/>
    <g stroke="{GOLD}" stroke-width="8" stroke-linecap="round" fill="none">
      <path d="M204,432 L198,484 M198,484 L180,492 M198,484 L204,496 M198,484 L214,490"/>
      <path d="M236,434 L242,486 M242,486 L224,494 M242,486 L248,498 M242,486 L258,492"/>
    </g>
    <g filter="url(#cut)">
      <path d="M150,186 C144,168 158,160 165,174 C164,154 182,150 184,168 C190,154 206,160 198,180 C190,190 160,192 150,186 Z" fill="{RED2}"/>
      <circle cx="166" cy="206" r="25" fill="{RED}"/>
      <path d="M144,196 L110,176 L142,206 Z" fill="{GOLD2}"/>
      <path d="M143,209 L114,206 L146,216 Z" fill="{GOLD}"/>
      <path d="M147,216 C140,236 150,250 159,242 C164,232 157,222 152,216 Z" fill="{RED2}"/>
    </g>
    <circle cx="160" cy="199" r="6.5" fill="{CREAM}"/><circle cx="158.5" cy="198.5" r="3.2" fill="{INK}"/>
  </g>
''')

ART[23] = ('La Luna', '#22304F', f'''
  {''.join(star(x, y, r) for x, y, r in [(74, 96, 12), (326, 470, 11), (84, 470, 8), (318, 92, 7)])}
  <circle cx="200" cy="284" r="172" fill="#F2D98B" opacity=".1"/>
  <circle cx="200" cy="284" r="150" fill="#F2D98B" filter="url(#cut)"/>
  <circle cx="136" cy="214" r="21" fill="#E6C470"/><circle cx="272" cy="360" r="16" fill="#E6C470"/>
  <g transform="translate(200 290) scale(1.25) translate(-200 -262)">
    <g stroke="#7A5A20" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M148,254 q18,14 36,0"/><path d="M216,254 q18,14 36,0"/>
      <path d="M200,262 q-7,18 5,21" stroke-width="3.5"/>
      <path d="M186,300 q14,11 28,0"/>
    </g>
    <circle cx="158" cy="284" r="14" fill="#E58A7A" opacity=".55"/><circle cx="242" cy="284" r="14" fill="#E58A7A" opacity=".55"/>
  </g>
''')

ART[27] = ('El Corazón', TEAL2, f'''
  <g transform="translate(200 352) scale(1.22) translate(-200 -345)">
    <g filter="url(#cut)">
      <path d="M200,112 C226,146 246,170 230,210 C220,188 212,196 202,222 C192,196 182,188 170,210 C154,170 174,146 200,112 Z" fill="{GOLD2}"/>
      <path d="M200,150 C214,172 222,188 212,214 C206,202 202,206 200,222 C198,206 194,202 188,214 C178,188 186,172 200,150 Z" fill="{RED2}"/>
    </g>
    <path d="M200,478 C150,428 84,386 84,304 C84,254 122,218 164,218 C184,218 197,228 200,244 C203,228 216,218 236,218 C278,218 316,254 316,304 C316,386 250,428 200,478 Z" fill="{RED}" filter="url(#cut)"/>
    <path d="M118,284 C118,258 138,244 160,246" stroke="{RED2}" stroke-width="13" fill="none" stroke-linecap="round"/>
  </g>
''')

ART[6] = ('La Sirena', '#F6E3B4', f'''
  {note(268, 150, 1.35)}{note(322, 222, 1.05)}
  <path d="M0,404 C80,392 160,402 240,396 C300,392 350,398 400,394 L400,560 L0,560 Z" fill="{TEAL2}" filter="url(#cut)"/>
  <g transform="translate(-12 -8)">
    <g filter="url(#cut)">
      <path d="M132,382 C146,436 204,470 258,458 C292,450 310,424 320,398 L340,396 C332,428 306,476 262,488 C204,504 132,474 114,400 Z" fill="{GREEN2}"/>
      <path d="M318,398 C318,368 340,350 368,350 C356,366 350,380 352,396 C364,388 380,392 386,404 C364,406 348,404 336,398 Z" fill="{GOLD}"/>
    </g>
    <g transform="translate(158 392) scale(1.22) translate(-158 -392)">
    <path d="M128,300 C110,210 144,184 176,196 C206,208 198,262 208,300 C214,322 226,340 236,356 C216,350 200,334 192,318 L186,306 L132,306 C124,326 114,340 104,348 C112,332 120,318 128,300 Z" fill="#3A2A22" filter="url(#cut)"/>
    <path d="M136,306 C120,290 112,276 112,258 C108,238 100,222 96,208" stroke="{SKIN}" stroke-width="16" stroke-linecap="round" fill="none"/>
    <circle cx="95" cy="202" r="11" fill="{SKIN}"/>
    <path d="M178,312 C196,334 206,352 214,370" stroke="{SKIN}" stroke-width="15" stroke-linecap="round" fill="none"/>
    <rect x="148" y="266" width="18" height="30" fill="{SKIN3}"/>
    <path d="M134,300 C130,330 128,360 132,388 L184,388 C188,360 186,330 182,300 C168,292 148,292 134,300 Z" fill="{SKIN}"/>
    <path d="M132,318 C150,310 168,310 184,318 L186,356 C168,364 150,364 130,356 Z" fill="{PINK}" filter="url(#cut)"/>
    <path d="M128,384 C140,392 176,392 190,384 L192,400 C174,408 142,408 126,400 Z" fill="{GOLD}" filter="url(#cut)"/>
    <ellipse cx="157" cy="246" rx="25" ry="29" fill="{SKIN}"/>
    <path d="M130,248 C130,218 150,208 170,212 C186,216 188,232 184,242 C170,230 150,232 136,254 Z" fill="#3A2A22"/>
    <circle cx="180" cy="218" r="9" fill="{PINK}"/>
    <g stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"><path d="M141,248 q6,4 12,0"/><path d="M162,248 q6,4 12,0"/></g>
    <ellipse cx="158" cy="264" rx="5" ry="6" fill="#7E2622"/>
    </g>
  </g>
  <path d="M0,470 C90,460 170,470 250,464 C320,458 360,466 400,462 L400,560 L0,560 Z" fill="{TEAL}" filter="url(#cut)"/>
''')

ART[3] = ('La Dama', '#F3D3CB', f'''
  <path d="M0,500 L400,500 L400,560 L0,560 Z" fill="#E4B3A6"/>
  <g transform="translate(200 345) scale(1.08) translate(-200 -360)">
    <path d="M168,330 L232,330 C252,400 290,466 312,512 C250,532 150,532 88,512 C110,466 148,400 168,330 Z" fill="{TEAL}" filter="url(#cut)"/>
    <path d="M112,470 C170,480 230,480 288,470 L296,486 C232,498 168,498 104,486 Z" fill="{GOLD2}"/>
    <g fill="{TEAL2}" filter="url(#cut)">{''.join(f'<circle cx="{x}" cy="{int(516 - abs(x - 200) * .04)}" r="12"/>' for x in range(96, 312, 22))}</g>
    <ellipse cx="178" cy="530" rx="15" ry="7" fill="{INK}"/><ellipse cx="224" cy="530" rx="15" ry="7" fill="{INK}"/>
    <path d="M136,294 C126,316 118,330 110,340" stroke="{SKIN2}" stroke-width="13" stroke-linecap="round" fill="none"/>
    <g filter="url(#cut)" transform="translate(98 352) rotate(-20)">
      <path d="M0,0 L-54,-40 A68,68 0 0 1 10,-68 Z" fill="{RED}"/>
      <g stroke="{GOLD2}" stroke-width="3"><path d="M0,0 L-40,-54 M0,0 L-18,-66 M0,0 L-2,-68"/></g>
    </g>
    <circle cx="106" cy="344" r="9" fill="{SKIN2}"/>
    <path d="M264,294 C274,316 272,336 256,352" stroke="{SKIN2}" stroke-width="13" stroke-linecap="round" fill="none"/>
    <circle cx="252" cy="352" r="9" fill="{SKIN2}"/>
    <path d="M172,262 C168,290 168,314 170,334 L230,334 C232,314 232,290 228,262 C214,254 186,254 172,262 Z" fill="{TEAL}" filter="url(#cut)"/>
    <circle cx="166" cy="276" r="18" fill="{TEAL2}" filter="url(#cut)"/><circle cx="234" cy="276" r="18" fill="{TEAL2}" filter="url(#cut)"/>
    <path d="M170,326 L230,326 L228,338 L172,338 Z" fill="{GOLD2}"/>
    <rect x="191" y="238" width="18" height="24" fill="{SKIN3}"/>
    <path d="M180,262 C190,272 210,272 220,262" stroke="{CREAM}" stroke-width="6" fill="none"/>
    <circle cx="226" cy="186" r="19" fill="#3A2A22" filter="url(#cut)"/>
    <ellipse cx="200" cy="218" rx="25" ry="29" fill="{SKIN2}"/>
    <path d="M174,218 C170,186 196,178 214,184 C230,190 230,210 226,222 C216,204 196,200 180,224 Z" fill="#3A2A22"/>
    <circle cx="182" cy="192" r="11" fill="{RED}"/>
    <circle cx="191" cy="222" r="2.8" fill="{INK}"/><circle cx="210" cy="222" r="2.8" fill="{INK}"/>
    <path d="M194,236 q6,5 12,0 q-6,-3 -12,0 Z" fill="{RED}"/>
  </g>
''')

ART[4] = ('El Catrín', GOLD2, f'''
  <path d="M0,502 C120,492 280,492 400,502 L400,560 L0,560 Z" fill="{GOLD}"/>
  <g transform="translate(200 318) scale(1.08) translate(-200 -323)">
    <g filter="url(#cut)" fill="{INK}">
      <path d="M158,410 L144,486 L182,474 L186,418 Z"/><path d="M242,410 L256,486 L218,474 L214,418 Z"/>
    </g>
    <g filter="url(#cut)" fill="#8D7E6C">
      <path d="M170,414 L198,414 L195,516 L172,516 Z"/><path d="M202,414 L230,414 L228,516 L205,516 Z"/>
    </g>
    <rect x="170" y="502" width="26" height="16" fill="{CREAM}"/><rect x="204" y="502" width="26" height="16" fill="{CREAM}"/>
    <ellipse cx="180" cy="522" rx="22" ry="8" fill="{INK}"/><ellipse cx="222" cy="522" rx="22" ry="8" fill="{INK}"/>
    <path d="M156,286 C142,320 134,360 130,394" stroke="{INK}" stroke-width="22" stroke-linecap="round" fill="none"/>
    <path d="M106,528 L128,396" stroke="#5B3518" stroke-width="7" stroke-linecap="round"/>
    <circle cx="132" cy="404" r="12" fill="{CREAM}"/>
    <path d="M244,288 C268,318 280,340 270,360 C262,374 248,380 238,380" stroke="{INK}" stroke-width="22" stroke-linecap="round" fill="none"/>
    <circle cx="238" cy="378" r="11" fill="{CREAM}"/>
    <path d="M156,280 C150,330 150,380 156,420 L244,420 C250,380 250,330 244,280 C225,268 175,268 156,280 Z" fill="{INK}" filter="url(#cut)"/>
    <path d="M184,276 L216,276 L200,352 Z" fill="{CREAM}"/>
    <path d="M184,266 L216,266 L214,280 L186,280 Z" fill="{CREAM}"/>
    <path d="M200,274 L182,264 L182,286 Z M200,274 L218,264 L218,286 Z" fill="{RED}"/><circle cx="200" cy="274" r="5" fill="{RED}"/>
    <rect x="192" y="246" width="16" height="20" fill="{SKIN3}"/>
    <ellipse cx="200" cy="226" rx="25" ry="29" fill="{SKIN}"/>
    <path d="M200,242 C190,234 176,236 168,248 C176,244 188,246 200,250 C212,246 224,244 232,248 C224,236 210,234 200,242 Z" fill="{INK}"/>
    <circle cx="188" cy="220" r="2.8" fill="{INK}"/><circle cx="212" cy="220" r="2.8" fill="{INK}"/>
    <circle cx="212" cy="220" r="9" fill="none" stroke="{CREAM}" stroke-width="2.5"/>
    <g filter="url(#cut)">
      <path d="M170,116 L230,116 L234,196 L166,196 Z" fill="{INK}"/>
      <rect x="166" y="178" width="68" height="12" fill="{RED}"/>
      <ellipse cx="200" cy="198" rx="58" ry="11" fill="{INK}"/>
    </g>
  </g>
''')
