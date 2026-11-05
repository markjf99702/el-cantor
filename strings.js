// Every word the app shows, in English and in Spanish, and the English / Español setting.
//
// The language is kept per device, in localStorage 'loteria.lang' ('en' or 'es'; Google Drive doesn't carry it).
// With nothing chosen, a device whose first language is Spanish gets Español, and every other one English.
// <html lang> follows the language shown. The card names, verses, shape names and recorded voices are Spanish in both.
//
// Each page loads this in <head>, so the words are ready before anything is drawn:
//   T(key, vars)       the text, with {name} filled in from vars. A count's text is { one, other }, picked by vars.n.
//   T.html(key, vars)  the same for a key ending _html: its own <b> and <a> stay, and the values are escaped.
//                      A key missing in Spanish falls back to English, then to the key itself.
//   T.list(names)      'A, B and C' / 'A, B y C'.        T.ord(5)    '5th' / '5.ª'.
//   T.locale           'en-US' / 'es-MX', for dates.     T.lang      'en' / 'es'.
//   T.apply(root)      fills in markup: data-t (its text), data-t-html, data-t-aria (aria-label), data-t-title
//                      (title) and data-t-ph (placeholder). The markup keeps its English, and a page runs
//                      T.apply(document) right after it, so English never flashes up first.
//   T.switch(host, reopen)  draws the English | Español control. A tap saves the choice and reloads the page; reopen
//                      ('settings') is left in sessionStorage 'loteria.reopen' so the page opens that sheet again.
// test/e2e.mjs's 'strings' check fails when a key is missing in either language, a {value} or a plural form is
// missing on one side, or a key is used nowhere. Change a wording in both languages.
//
// Spanish: Mexican, with tú. One word for each thing:
//   card carta · deck baraja · shuffle barajar · call cantar, a called card una carta cantada (or que ya salió)
//   round ronda · square casilla · bean frijol · shape figura · a printed set juego (only that: never "game")
//   "what are we playing" ¿A qué jugamos? / Elige a qué jugar · Settings Ajustes · Done Listo · link liga
//   printed page hoja · on / off Sí / No · My tablas Mis tablas · Make tablas Hacer tablas
//   Letter paper, beside a count of cards or tablas, is "tamaño carta", so it isn't read as a lotería card.
//   The iPhone's own Settings app is Configuración (Apple's Spanish support pages call it that).
// Spoken Spanish stays as it is: "Felicidades, …", the opening line, and La Luna in Try it.
(function () {
  'use strict';
  var S = {
    en: {
      'lang.label': 'Idioma · Language',
      'lang.en': 'English',
      'lang.es': 'Español',
      'and': ' and ',
      'tool.board': 'My tablas',
      'tool.print': 'Make tablas',
      'foot.part': 'Part of junkdrawer.works',
      'foot.privacy': 'Privacy',

      // the home screen
      'home.sub': 'Call the game, play along, or make your own tablas.',
      'home.nav': 'Lotería tools',
      'home.cantor.eyebrow': 'Call the game',
      'home.cantor.text': 'Shuffles the deck and calls each card aloud in Spanish. For the phone or tablet at the head of the table; it checks a ¡Lotería! too.',
      'home.cantor.go': 'Start calling →',
      'home.board.eyebrow': 'Play along',
      'home.board.text': 'Your tablas on your own phone. Tap the card that was called and it marks itself, with a cheer when you win.',
      'home.board.go': 'Open my tablas →',
      'home.print.eyebrow': 'Print',
      'home.print.text': 'Drag and drop cards onto your own tablas, doubles and all, and print them 1, 2 or 4 to a page.',
      'home.print.go': 'Make tablas →',
      'home.privacy': 'Everything stays on this device: no accounts, nothing sent anywhere.',
      'home.privacyDrive': 'Everything stays on this device unless you save to Google Drive, which keeps your tablas in a Lotería folder in your own Drive.',
      'home.juegos_html': 'Numbered juegos that El Cantor checks by number print from El Cantor’s <b>Print tablas</b>.',
      // shared by the pages
      'home.aria': 'Home — all the Lotería tools',
      'home.title': 'Home',
      'settings': 'Settings',
      'done': 'Done',
      'on': 'On',
      'off': 'Off',
      'newRound': 'New round',
      'whatPlaying': 'What are we playing?',
      'noMatch': 'No card matches “{q}”.',
      'calledAria': '{card}, called',
      'tablaNumber': 'Tabla number',
      'sounds': 'Sounds',
      'printTablas': 'Print tablas',
      'cards': { one: '1 card', other: '{n} cards' },
      'tablas': { one: '1 tabla', other: '{n} tablas' },
      'pages': { one: '1 page', other: '{n} pages' },
      'paper': 'Paper',
      'paper.letter': 'Letter',
      'paper.letterSize': 'Letter', // beside a count of pages: "12 pages, Letter"

      // the shapes (deck.js), in both game pickers, and what holding one does
      'pat.clasico': '4 in a row, 4 corners, or 4 in a square',
      'pat.linea': 'any row, column or diagonal',
      'pat.esquinas': 'the four corners',
      'pat.centro': 'the middle four',
      'pat.cuadro': 'any 2×2 block',
      'pat.ele': 'left column + bottom row',
      'pat.equis': 'both diagonals',
      'pat.marco': 'the outer ring',
      'pat.rieles': 'the two middle rows',
      'pat.escalera': 'the two middle columns',
      'pat.siete': 'any seven, anywhere',
      'pat.llena': 'every card',
      'pat.none': 'Pick a game',
      'shapeAdded': '{shape} added',
      'shapeIn': '{shape} is already in the game',
      'shapeClasico': 'Clásico already wins with {shape}',

      // the recorded voices (audio/voices.json), in El Cantor's voice list
      'voice.dora': 'female voice',
      'voice.alex': 'male voice',
      'voice.santa': 'deeper male voice',

      // El Cantor: the top and the bar
      'cantor.sabanaTitle': 'Sábana — every card, called or not',
      'cantor.back': 'Put the last card back',
      'cantor.next': 'Next card',
      'cantor.paceGroup': 'Time between cards',
      'pace.slow': 'Slow',
      'pace.normal': 'Normal',
      'pace.fast': 'Fast',
      'cantor.paceOpt': '{pace} · {s}s',
      'cantor.paceChip': '{s}s',
      'cantor.paceAria': '{pace}: {s} seconds between cards. Tap to change.',
      'cantor.paceToast': '{pace} — {s} seconds between cards',
      'cantor.start': 'Start calling',
      'cantor.pause': 'Pause',
      'cantor.keepCalling': 'Keep calling',
      'cantor.sub': 'Round {r} · {n} of 54',
      'cantor.st.done': 'That’s the whole deck',
      'cantor.st.go': 'Here we go…',
      'cantor.st.calling': 'Calling…',
      'cantor.st.reading': 'Reading…',
      'cantor.st.next': 'Next card in {s}s',
      'cantor.st.ready': 'Ready',
      'cantor.st.paused': 'Paused',

      // El Cantor: the call
      'cantor.roundGame': 'Round {r} · {game}',
      'cantor.readyH': 'Ready when you are',
      'cantor.readyP': 'All 54 cards are shuffled. El Cantor turns them over one at a time and reads each one out.',
      'cantor.capNo': 'No. {n} · {ord} card',
      'cantor.lastCard': 'That was the last card — ↺ below starts a new round',
      'cantor.firstCard': 'First card of the round',
      'cantor.before': 'Before',
      'cantor.calledN': { one: '1 called', other: '{n} called' },
      'cantor.leftN': { one: '1 left', other: '{n} left' },
      'cantor.putBack': 'Put it back — {card} is showing',
      'cantor.fullDeck': 'Back to a full deck',
      'cantor.startRoundQ': 'Start round {n}?',
      'cantor.startRoundNote': { one: 'The 1 card called so far goes back in the deck and it gets shuffled. Tell everyone to clear their tablas.', other: 'The {n} cards called so far go back in the deck and it gets shuffled. Tell everyone to clear their tablas.' },
      'cantor.shuffleNew': 'Shuffle — new round',
      'cantor.keepRound': 'Keep this round',
      'cantor.roundWhat': 'Round {r} — what are we playing?',
      'cantor.patsNote_html': 'Tell the table what wins this round. <b>Clásico</b> is the regular game — 4 in a row, 4 corners, or 4 in a square. Hold a shape for a second to add it on top of what’s picked; a tabla wins on any one of them. El Cantor checks winning tablas against this.',
      'cantor.otherWindow': 'Paused — another window turned a card',
      'cantor.tapToKeep': 'Paused — tap the card to keep calling',

      // El Cantor: Settings
      'cantor.readAloud': 'Read the cards aloud',
      'cantor.voice': 'Voice',
      'cantor.tryIt': 'Try it',
      'cantor.tryBetween': 'Try it between cards',
      'cantor.rate': 'Reading speed',
      'cantor.rate.normal': 'normal',
      'cantor.rate.slower': 'slower',
      'cantor.rate.faster': 'faster',
      'cantor.styleH': 'How each card is called',
      'cantor.style.name': 'Name only',
      'cantor.style.nameNote': 'Just the card: “¡La Luna!” The verse still shows on screen.',
      'cantor.style.verse': 'Verse, then name',
      'cantor.style.verseNote': '“El farol de los enamorados… ¡La Luna!” The card turns over right away.',
      'cantor.style.riddleNote': 'Reads the verse with the card face down so the table can guess, then turns it over and says the name.',
      'cantor.paceNote': 'Counted after the card is read. ▶ turns the next card automatically; Next card turns it now.',
      'cantor.shoutH': 'When someone shouts ¡Lotería!',
      'cantor.trust': 'Take their word',
      'cantor.check': 'Check the tabla',
      'cantor.chk.on': 'The ¡Lotería! button opens the checker first: type a printed tabla’s number, or tap the cards they read out.',
      'cantor.chk.off': 'The ¡Lotería! button goes straight to the celebration and the next round. Checking a tabla is still one tap away there.',
      'cantor.soundsNote': 'A card snap on each turn, a fanfare for a good ¡Lotería!',
      'cantor.awake': 'Keep the screen on',
      'cantor.awakeNote': 'While a round is going, if this device allows it.',
      'cantor.v.cant': 'This browser can’t speak, so El Cantor shows each card and you read it.',
      'cantor.v.off': 'Off — El Cantor shows each card and you read it out.',
      'cantor.v.pack': 'A recorded Spanish voice — it sounds the same on every phone and tablet.',
      'cantor.v.device': 'This device’s own Spanish voice.',
      'cantor.v.none': 'This device has no Spanish voice, so it reads with its default one and mangles the words. On an iPhone or iPad, add one under Settings › Accessibility › Spoken Content › Voices › Spanish.',
      'cantor.v.groupPack': 'Recorded voices',
      'cantor.v.groupDevice': 'This device',
      'cantor.v.default': 'This device’s default voice',
      'cantor.winners': 'Winners',
      'cantor.winnersNone': 'When you confirm a ¡Lotería!, add the winner’s name and it’s kept here.',
      'cantor.unnamed': 'Unnamed',
      'cantor.clear': 'Clear',
      'cantor.clearAgain': 'Tap again to clear',
      'cantor.round': 'Round {r}',
      'cantor.alongH': 'Playing along',
      'cantor.along_html': 'Anyone can mark their tablas on their own phone with <a href="board.html">My tablas</a> — tap <b>Cantaron…</b> there as you call. Printed tablas work too: <b>Print tablas</b> makes a numbered set, or <a href="print.html">make your own</a> card by card.',
      'cantor.keyboardH': 'Keyboard',
      'cantor.keyboard': 'Space starts or pauses · → next card · ← puts the last card back · L checks a ¡Lotería!',

      // El Cantor: ¡Lotería!
      'cantor.cardsCalled': { one: '1 card called', other: '{n} cards called' },
      'cantor.whoWon': 'Who won? (optional)',
      'cantor.whoWonAria': 'Who won',
      'cantor.shuffleFor': 'Shuffle for round {r}',
      'cantor.checkFirst': 'Check a tabla first',
      'cantor.checkIt': '¡Lotería! — check it',
      'cantor.printedTabla': 'Printed tabla',
      'cantor.cardByCard': 'Card by card',
      'cantor.buenaNew': '¡Buena! New round',
      'cantor.countAnyway': 'Count it anyway',
      'cantor.prevTabla': 'Previous tabla',
      'cantor.nextTabla': 'Next tabla',
      'cantor.findCard': 'Find a card — name or number',
      'cantor.typeJuego_html': 'Type the juego name printed along the bottom of the tabla (make a set under <b>Print tablas</b>), then its number from the top corner.',
      'cantor.typeJuegoHave': 'Type the juego name printed along the bottom of the tabla, then its number from the top corner.',
      'cantor.typeNumber': 'Now the tabla number — it’s the big number at the top right of their tabla.',
      'cantor.goodLine': '{juego} No. {k} — {when}',
      'cantor.when.now': 'It finished on the card just called, {card}.',
      'cantor.when.ago': { one: 'It was already good 1 card ago, on {card} — the {ord} card.', other: 'It was already good {n} cards ago, on {card} — the {ord} card.' },
      'cantor.notYet': 'Not yet',
      'cantor.moreCards': { one: '1 more card', other: '{n} more cards' },
      'cantor.closest_html': { one: '{juego} No. {k} is closest to <b>{shape}</b> and still needs {miss}. Squares outlined in red haven’t been called.', other: '{juego} No. {k} is closest to <b>{shape}</b> and still needs {miss}. Squares outlined in red haven’t been called.' },
      'cantor.takeOff': 'Take {card} off',
      'cantor.notYetChip': ' · not yet',
      'cantor.readOut': 'Have them read out their winning cards, and tap each one below. A tabla from a store or another set works this way.',
      'cantor.notCalled': { one: '{list} hasn’t been called.', other: '{list} haven’t been called.' },
      'cantor.allOut': { one: 'It’s out', other: 'All {n} are out' },
      'cantor.ifShape': 'If they make the shape — {game} — it’s good. {when}',
      'cantor.won_html': '<b>{who}</b> wins round {r} after {cards}.',
      'cantor.wonNobody': 'Round {r} is won after {cards}.',

      // El Cantor: Print tablas, and the PDF
      'cantor.prIntro_html': 'Makes a PDF of numbered tablas to print at home. A set of tablas — a <b>juego</b> — is built from its name, so the same name always gives the same tablas. When someone shouts ¡Lotería!, you check their tabla here by its number.',
      'cantor.prByHand_html': 'Rather pick the cards yourself, doubles and all? <a href="print.html">Make tablas by hand</a> — you check those card by card.',
      'cantor.prName': 'Juego name',
      'cantor.prNew': 'New name',
      'cantor.prHowMany': 'How many',
      'cantor.prFewer': 'Fewer',
      'cantor.prCountAria': 'Number of tablas',
      'cantor.prMore': 'More',
      'cantor.prPer': 'Per page',
      'cantor.prOneBig': 'One, big',
      'cantor.prTwo': 'Two',
      'cantor.prGo': 'Make the PDF',
      'cantor.prMaking': 'Making…',
      'cantor.prInfo_html': '<b>{tablas}</b> from juego <b>{name}</b> · {pages}, {paper}',
      'cantor.prSideways': ' sideways',
      'cantor.prNoName': 'Give the juego a name — letters and numbers.',
      'cantor.prDone': '{how} — {tablas}, {mb} MB. Keep the name {name}.',
      'cantor.prSaved': 'Saved',
      'cantor.prDownloaded': 'Downloaded',
      'cantor.prFail': 'Couldn’t make the PDF — try again',
      'cantor.prNoSave': 'Saving files isn’t available in this view',
      'cantor.prWaiting': 'A save is already waiting for an answer',
      'cantor.prBadImage': 'A card image couldn’t be read',
      'cantor.prFileUrl': 'Open El Cantor from a web address to make PDFs',
      'cantor.prImgLoad': 'A card image didn’t load — check the connection',
      'pdf.footer': 'Juego {name} · Tabla {k} · El Cantor can check this tabla by its number',

      // shared by My tablas and Make tablas
      'cancel': 'Cancel',
      'emptySquare': 'Empty square',
      'tablaName': 'Tabla name',
      'alreadyTwice': '{card} is already on {tabla} twice',
      'twice': 'Twice',
      'remove': 'Remove',
      'copyLink': 'Copy link',
      'linkCopied': 'Link copied',

      // My tablas: the top, the tablas and the called cards
      'board.title': 'Lotería · My tablas',
      'board.theyCalled': 'they called',
      'board.player': 'Player', // the name of someone set up without one, saved as it is
      'board.whoTablas': { one: '{name} · 1 tabla', other: '{name} · {n} tablas' },
      'board.nothingYet_html': 'Nothing called yet. Tap <b>Cantaron…</b> when they call a card, or tap the card on a tabla.',
      'board.notOnYours': 'not on your tablas',
      'board.undoCall': 'Undo the last call',
      'board.enlarge': 'Enlarge',
      'board.showAll': 'Show all the tablas',
      'board.histEmpty': 'Called cards show up here',
      'board.calledN': { one: '1 called', other: '{n} called' },
      'board.uncall': 'Tap to un-call',
      'board.tookBack': 'Took {card} back off',
      'board.alreadyCalled': '{card} is already called',
      'board.searchCall': 'Name or number… “luna”, 23',
      'board.searchSquare': 'Pick a card for this square',
      'board.newRoundWhat': 'New round — what are we playing?',
      'board.patsNote_html': 'Tap the game for this round. <b>Clásico</b> is the regular game — a tabla wins on 4 in a row, 4 corners, or 4 in a square. The others are single shapes; hold one for a second to add it on top of what’s selected, and a tabla wins on any one of them.',
      'board.andMore': ' — and {n} more',
      'board.shout': 'Shout it before somebody else does.',
      'board.keepPlaying': 'Keep playing',
      'board.clearH': 'Clear the round?',
      'board.clearNote': 'Takes the beans off all {n} called cards so you can start the next round.',
      'board.clearGo': 'Clear for a new round',

      // My tablas: Settings
      'board.marker': 'Marker',
      'board.soundsNote': 'A bean drop on each mark, a little fanfare on a win.',
      'board.dim': 'Dim squares outside the pattern',
      'board.dimNote': 'Only for fixed shapes like Esquinas or La Ele.',
      'board.whoH': 'Who is playing on this device',
      'board.addPerson': 'Add a person',
      'board.add': 'Add',
      'board.gotTwo': '{name} gets two random tablas to start — edit them under Tablas',
      'board.eachPerson_html': 'Each person keeps their own tablas. To send someone your tablas, use <b>Share</b> on the Tablas screen.',
      'board.callingH': 'Calling the game?',
      'board.calling_html': '<a href="cantor.html">El Cantor</a> shuffles a deck and reads each card aloud, prints numbered tablas, and checks a ¡Lotería! by tabla number.',
      'board.about': 'About',
      'board.aboutDrive': 'Everything lives on this device, and in your Google Drive if you save there. Reload-safe: the round survives a refresh.',
      'board.aboutLocal': 'Everything lives on this device — nothing is sent anywhere. Reload-safe: the round survives a refresh.',

      // My tablas: Tablas, and a printed tabla
      'board.playerName': 'Player name',
      'board.share': 'Share',
      'board.editNote': 'Tap any square to change its card. Doubles are fine (house rules) — when that card is called, both squares get a bean — but not three of a card. Names are editable.',
      'board.addTabla': '+ Add a tabla',
      'board.addPrinted': '+ A printed tabla',
      'board.restore': 'Restore the original four',
      'board.makeToPrint': 'Make tablas to print',
      'board.removePerson': 'Remove this person',
      'timesN': '{k}×',
      'board.randomTabla': 'Random tabla',
      'board.removedElsewhere': '{tabla} was removed on another device',
      'board.replaceCardsAgain': 'Tap again to replace {tabla}’s cards',
      'board.removeTablaAgain': 'Tap again to remove {tabla}', // a tabla: no personal "a" in Spanish
      'board.sixPlenty': 'Six tablas is plenty',
      'board.replaceAllAgain': { one: 'Tap again to replace your tabla', other: 'Tap again to replace all {n} tablas' },
      'board.needOne': 'Add someone else first — the app needs one player',
      'board.removePersonAgain': 'Tap again to remove {name}', // a person: "quitar a {name}"
      'board.addPrintedH': 'Add a printed tabla',
      'board.printedNote': 'Tablas printed from El Cantor carry a juego name along the bottom and a number at the top. Type both and the same tabla shows up here, square for square — so the caller can still check it by number.',
      'board.juegoLike': 'Juego, like CANELA',
      'board.addIt': 'Add it',
      'board.added': '{name} added',

      // My tablas: Share, a shared link, and the first visit
      'board.shareH': 'Share {name}’s tablas',
      'board.shareNote': { one: 'Anyone who opens this link gets a copy of this tabla on their own device, under the name “{name}”. The link is the whole thing — nothing is stored anywhere else.', other: 'Anyone who opens this link gets a copy of these {n} tablas on their own device, under the name “{name}”. The link is the whole thing — nothing is stored anywhere else.' },
      'board.send': 'Send…',
      'board.selectCopy': 'Select the link and copy it',
      'board.shareTitle': 'Lotería tablas',
      'board.shareText': '{name}’s tablas',
      'board.guest': 'Guest', // the name of someone a link doesn't name, saved as it is
      'board.importH': 'Tablas from {name}',
      'board.importNote': { one: 'This link carries 1 tabla for “{name}”.', other: 'This link carries {n} tablas for “{name}”.' },
      'board.importHave': 'You already have a {name} on this device — importing replaces their tablas.',
      'board.replaceUse': 'Replace and use',
      'board.addUse': 'Add and use',
      'board.noThanks': 'No thanks',
      'board.playingAs': 'Playing as {name}',
      'board.welcomeH': 'Who’s playing on this device?',
      'board.welcomeDrive': 'Asked once. Tablas are saved on this phone or tablet, and in your own Google Drive if you turn that on below.',
      'board.welcomeLocal': 'Asked once. Tablas are saved on this phone or tablet only, so what you set up here is yours and nobody else’s.',
      'board.yourName': 'Your name',
      'board.startWith': 'Start with',
      'board.wRandom': 'Random tablas I’ll edit',
      'board.wMark': 'Mark’s four tablas',
      'board.eitherWay_html': 'Either way you can change every square later under <b>Tablas</b>.',
      'board.alreadyDrive': 'Already saving tablas to Google Drive on another device? Turn it on here and they come right over.',
      'board.tapTablas': '{name}, tap Tablas to set up your cards',
      'board.fromDrive': 'Your tablas are here from Google Drive'
    },
    es: {
      'lang.label': 'Idioma · Language',
      'lang.en': 'English',
      'lang.es': 'Español',
      'and': ' y ',
      'tool.board': 'Mis tablas',
      'tool.print': 'Hacer tablas',
      'foot.part': 'Parte de junkdrawer.works',
      'foot.privacy': 'Privacidad',

      // the home screen
      'home.sub': 'Canta la lotería, juega en tu teléfono o haz tus propias tablas.',
      'home.nav': 'Herramientas de lotería',
      'home.cantor.eyebrow': 'Canta la lotería',
      'home.cantor.text': 'Baraja las cartas y canta cada una en voz alta. Para el teléfono o la tableta en la cabecera de la mesa; también revisa una ¡Lotería!',
      'home.cantor.go': 'Empezar a cantar →',
      'home.board.eyebrow': 'Juega',
      'home.board.text': 'Tus tablas en tu propio teléfono. Toca la carta que cantaron y se marca sola, con festejo cuando ganas.',
      'home.board.go': 'Abrir mis tablas →',
      'home.print.eyebrow': 'Imprime',
      'home.print.text': 'Arrastra cartas a tus propias tablas, con dobles y todo, e imprímelas de 1, 2 o 4 por hoja.',
      'home.print.go': 'Hacer tablas →',
      'home.privacy': 'Todo se queda en este dispositivo: sin cuentas, nada se manda a ningún lado.',
      'home.privacyDrive': 'Todo se queda en este dispositivo, a menos que guardes en Google Drive: ahí tus tablas van a una carpeta Lotería en tu propio Drive.',
      'home.juegos_html': 'Los juegos numerados, que El Cantor revisa por número, se imprimen desde <b>Imprimir tablas</b> en El Cantor.',
      // shared by the pages
      'home.aria': 'Inicio — todas las herramientas de Lotería',
      'home.title': 'Inicio',
      'settings': 'Ajustes',
      'done': 'Listo',
      'on': 'Sí',
      'off': 'No',
      'newRound': 'Ronda nueva',
      'whatPlaying': '¿A qué jugamos?',
      'noMatch': 'Ninguna carta coincide con “{q}”.',
      'calledAria': '{card}, cantada',
      'tablaNumber': 'Número de tabla',
      'sounds': 'Sonidos',
      'printTablas': 'Imprimir tablas',
      'cards': { one: '1 carta', other: '{n} cartas' },
      'tablas': { one: '1 tabla', other: '{n} tablas' },
      'pages': { one: '1 hoja', other: '{n} hojas' },
      'paper': 'Papel',
      'paper.letter': 'Carta',
      'paper.letterSize': 'tamaño carta',

      // the shapes (deck.js), in both game pickers, and what holding one does
      'pat.clasico': '4 en línea, 4 esquinas o 4 en cuadro',
      'pat.linea': 'cualquier fila, columna o diagonal',
      'pat.esquinas': 'las cuatro esquinas',
      'pat.centro': 'las cuatro del centro',
      'pat.cuadro': 'cualquier cuadro de 2×2',
      'pat.ele': 'columna izquierda + fila de abajo',
      'pat.equis': 'las dos diagonales',
      'pat.marco': 'toda la orilla',
      'pat.rieles': 'las dos filas del centro',
      'pat.escalera': 'las dos columnas del centro',
      'pat.siete': 'siete cualesquiera, donde sea',
      'pat.llena': 'todas las cartas',
      'pat.none': 'Elige a qué jugar',
      'shapeAdded': 'Se agregó {shape}',
      'shapeIn': 'Ya se juega {shape}',
      'shapeClasico': 'Clásico ya gana con {shape}',

      // the recorded voices (audio/voices.json), in El Cantor's voice list
      'voice.dora': 'voz de mujer',
      'voice.alex': 'voz de hombre',
      'voice.santa': 'voz de hombre más grave',

      // El Cantor: the top and the bar
      'cantor.sabanaTitle': 'Sábana — todas las cartas, cantadas o no',
      'cantor.back': 'Regresar la última carta',
      'cantor.next': 'Siguiente carta',
      'cantor.paceGroup': 'Tiempo entre cartas',
      'pace.slow': 'Lento',
      'pace.normal': 'Normal',
      'pace.fast': 'Rápido',
      'cantor.paceOpt': '{pace} · {s} s',
      'cantor.paceChip': '{s} s',
      'cantor.paceAria': '{pace}: {s} segundos entre cartas. Toca para cambiar.',
      'cantor.paceToast': '{pace} — {s} segundos entre cartas',
      'cantor.start': 'Empezar a cantar',
      'cantor.pause': 'Pausa',
      'cantor.keepCalling': 'Seguir cantando',
      'cantor.sub': 'Ronda {r} · {n} de 54',
      'cantor.st.done': 'Se acabó la baraja',
      'cantor.st.go': 'Ahí va…',
      'cantor.st.calling': 'Cantando…',
      'cantor.st.reading': 'Leyendo…',
      'cantor.st.next': 'Siguiente en {s} s',
      'cantor.st.ready': 'Todo listo',
      'cantor.st.paused': 'En pausa',

      // El Cantor: the call
      'cantor.roundGame': 'Ronda {r} · {game}',
      'cantor.readyH': 'Cuando quieras',
      'cantor.readyP': 'Las 54 cartas ya están barajadas. El Cantor las voltea una por una y canta cada una.',
      'cantor.capNo': 'No. {n} · {ord} en salir',
      'cantor.lastCard': 'Esa fue la última carta — ↺ abajo empieza otra ronda',
      'cantor.firstCard': 'Primera carta de la ronda',
      'cantor.before': 'Antes',
      'cantor.calledN': { one: '1 cantada', other: '{n} cantadas' },
      'cantor.leftN': { one: 'falta 1', other: 'faltan {n}' },
      'cantor.putBack': 'Se regresó a la baraja — ahora se ve {card}',
      'cantor.fullDeck': 'La baraja está completa otra vez',
      'cantor.startRoundQ': '¿Empezar la ronda {n}?',
      'cantor.startRoundNote': { one: 'La carta que ya salió vuelve a la baraja y se baraja de nuevo. Avísales a todos que quiten los frijoles de sus tablas.', other: 'Las {n} cartas que ya salieron vuelven a la baraja y se barajan de nuevo. Avísales a todos que quiten los frijoles de sus tablas.' },
      'cantor.shuffleNew': 'Barajar — ronda nueva',
      'cantor.keepRound': 'Seguir con esta ronda',
      'cantor.roundWhat': 'Ronda {r} — ¿a qué jugamos?',
      'cantor.patsNote_html': 'Dile a la mesa qué gana esta ronda. <b>Clásico</b> es lo de siempre — 4 en línea, 4 esquinas o 4 en cuadro. Mantén presionada una figura un segundo para sumarla a lo elegido; una tabla gana con cualquiera de ellas. El Cantor revisa las tablas ganadoras con esto.',
      'cantor.otherWindow': 'En pausa — otra ventana volteó una carta',
      'cantor.tapToKeep': 'En pausa — toca la carta para seguir cantando',

      // El Cantor: Settings
      'cantor.readAloud': 'Cantar las cartas en voz alta',
      'cantor.voice': 'Voz',
      'cantor.tryIt': 'Probar',
      'cantor.tryBetween': 'Pruébala entre carta y carta',
      'cantor.rate': 'Velocidad',
      'cantor.rate.normal': 'normal',
      'cantor.rate.slower': 'más lenta',
      'cantor.rate.faster': 'más rápida',
      'cantor.styleH': 'Cómo se canta cada carta',
      'cantor.style.name': 'Solo el nombre',
      'cantor.style.nameNote': 'Nada más la carta: “¡La Luna!” El verso sigue en la pantalla.',
      'cantor.style.verse': 'Verso y luego nombre',
      'cantor.style.verseNote': '“El farol de los enamorados… ¡La Luna!” La carta se voltea enseguida.',
      'cantor.style.riddleNote': 'Canta el verso con la carta boca abajo para que la mesa adivine; luego la voltea y dice el nombre.',
      'cantor.paceNote': 'Se cuenta después de cantar la carta. ▶ voltea la siguiente solita; Siguiente carta la voltea ya.',
      'cantor.shoutH': 'Cuando alguien grita ¡Lotería!',
      'cantor.trust': 'Se le cree',
      'cantor.check': 'Se revisa la tabla',
      'cantor.chk.on': 'El botón ¡Lotería! abre primero la revisión: escribe el número de una tabla impresa o toca las cartas que te lean.',
      'cantor.chk.off': 'El botón ¡Lotería! va directo al festejo y a la siguiente ronda. Revisar una tabla sigue a un toque de ahí.',
      'cantor.soundsNote': 'Un chasquido al voltear cada carta y una fanfarria para una ¡Lotería! buena.',
      'cantor.awake': 'Pantalla siempre encendida',
      'cantor.awakeNote': 'Mientras dura la ronda, si este dispositivo lo permite.',
      'cantor.v.cant': 'Este navegador no puede hablar, así que El Cantor enseña cada carta y tú la cantas.',
      'cantor.v.off': 'Apagado — El Cantor enseña cada carta y tú la cantas.',
      'cantor.v.pack': 'Una voz grabada en español — suena igual en todos los teléfonos y tabletas.',
      'cantor.v.device': 'La voz en español de este dispositivo.',
      'cantor.v.none': 'Este dispositivo no tiene voz en español, así que lee con la que trae y pronuncia mal las palabras. En un iPhone o iPad, agrega una en Configuración › Accesibilidad › Contenido leído › Voces › Español.',
      'cantor.v.groupPack': 'Voces grabadas',
      'cantor.v.groupDevice': 'De este dispositivo',
      'cantor.v.default': 'La voz que trae este dispositivo',
      'cantor.winners': 'Ganadores',
      'cantor.winnersNone': 'Cuando confirmes una ¡Lotería!, escribe quién ganó y aquí se guarda.',
      'cantor.unnamed': 'Sin nombre',
      'cantor.clear': 'Borrar',
      'cantor.clearAgain': 'Toca otra vez para borrar',
      'cantor.round': 'Ronda {r}',
      'cantor.alongH': 'Jugar en el teléfono',
      'cantor.along_html': 'Cada quien puede marcar sus tablas en su propio teléfono con <a href="board.html">Mis tablas</a> — ahí tocan <b>Cantaron…</b> mientras cantas. También sirven tablas impresas: <b>Imprimir tablas</b> hace un juego numerado, o <a href="print.html">haz las tuyas</a> carta por carta.',
      'cantor.keyboardH': 'Teclado',
      'cantor.keyboard': 'Espacio empieza o pausa · → siguiente carta · ← regresa la última carta · L revisa una ¡Lotería!',

      // El Cantor: ¡Lotería!
      'cantor.cardsCalled': { one: '1 carta cantada', other: '{n} cartas cantadas' },
      'cantor.whoWon': '¿Quién ganó? (opcional)',
      'cantor.whoWonAria': 'Quién ganó',
      'cantor.shuffleFor': 'Barajar para la ronda {r}',
      'cantor.checkFirst': 'Revisar una tabla primero',
      'cantor.checkIt': '¡Lotería! — a revisar',
      'cantor.printedTabla': 'Tabla impresa',
      'cantor.cardByCard': 'Carta por carta',
      'cantor.buenaNew': '¡Buena! Ronda nueva',
      'cantor.countAnyway': 'Darla por buena',
      'cantor.prevTabla': 'Tabla anterior',
      'cantor.nextTabla': 'Tabla siguiente',
      'cantor.findCard': 'Busca una carta — nombre o número',
      'cantor.typeJuego_html': 'Escribe el nombre del juego que viene impreso abajo de la tabla (haz un juego en <b>Imprimir tablas</b>) y luego su número de la esquina de arriba.',
      'cantor.typeJuegoHave': 'Escribe el nombre del juego que viene impreso abajo de la tabla y luego su número de la esquina de arriba.',
      'cantor.typeNumber': 'Ahora el número — es el número grande arriba a la derecha de su tabla.',
      'cantor.goodLine': '{juego} No. {k} — {when}',
      'cantor.when.now': 'Se completó con la carta que acaba de salir, {card}.',
      'cantor.when.ago': { one: 'Ya estaba completa desde la carta anterior: {card}, la {ord} en salir.', other: 'Ya estaba completa desde hace {n} cartas: {card}, la {ord} en salir.' },
      'cantor.notYet': 'Todavía no',
      'cantor.moreCards': { one: '1 carta más', other: '{n} cartas más' },
      'cantor.closest_html': { one: '{juego} No. {k} va más cerca de <b>{shape}</b> y le falta {miss}. Las casillas con borde rojo todavía no salen.', other: '{juego} No. {k} va más cerca de <b>{shape}</b> y le faltan {miss}. Las casillas con borde rojo todavía no salen.' },
      'cantor.takeOff': 'Quitar {card}',
      'cantor.notYetChip': ' · todavía no',
      'cantor.readOut': 'Pídeles que lean sus cartas ganadoras y toca cada una abajo. Así funciona con una tabla de la tienda o de otro juego.',
      'cantor.notCalled': { one: '{list} todavía no sale.', other: '{list} todavía no salen.' },
      'cantor.allOut': { one: 'Ya salió', other: 'Ya salieron las {n}' },
      'cantor.ifShape': 'Si forman la figura — {game} — es buena. {when}',
      'cantor.won_html': '<b>{who}</b> gana la ronda {r} con {cards}.',
      'cantor.wonNobody': 'Se ganó la ronda {r} con {cards}.',

      // El Cantor: Print tablas, and the PDF
      'cantor.prIntro_html': 'Hace un PDF de tablas numeradas para imprimir en casa. Un <b>juego</b> de tablas sale de su nombre, así que el mismo nombre siempre da las mismas tablas. Cuando alguien grite ¡Lotería!, aquí revisas su tabla por su número.',
      'cantor.prByHand_html': '¿Prefieres escoger tú las cartas, con dobles y todo? <a href="print.html">Haz tablas a mano</a> — esas se revisan carta por carta.',
      'cantor.prName': 'Nombre del juego',
      'cantor.prNew': 'Otro nombre',
      'cantor.prHowMany': 'Cuántas',
      'cantor.prFewer': 'Menos',
      'cantor.prCountAria': 'Número de tablas',
      'cantor.prMore': 'Más',
      'cantor.prPer': 'Por hoja',
      'cantor.prOneBig': 'Una grande',
      'cantor.prTwo': 'Dos',
      'cantor.prGo': 'Hacer el PDF',
      'cantor.prMaking': 'Haciendo…',
      'cantor.prInfo_html': '<b>{tablas}</b> del juego <b>{name}</b> · {pages}, {paper}',
      'cantor.prSideways': ', en horizontal',
      'cantor.prNoName': 'Ponle nombre al juego — letras y números.',
      'cantor.prDone': '{how} — {tablas}, {mb} MB. Apunta el nombre: {name}.',
      'cantor.prSaved': 'Guardado',
      'cantor.prDownloaded': 'Descargado',
      'cantor.prFail': 'No se pudo hacer el PDF — inténtalo otra vez',
      'cantor.prNoSave': 'Aquí no se pueden guardar archivos',
      'cantor.prWaiting': 'Ya hay un archivo esperando respuesta',
      'cantor.prBadImage': 'No se pudo leer la imagen de una carta',
      'cantor.prFileUrl': 'Abre El Cantor desde una dirección web para hacer PDFs',
      'cantor.prImgLoad': 'No cargó la imagen de una carta — revisa la conexión',
      'pdf.footer': 'Juego {name} · Tabla {k} · El Cantor puede revisar esta tabla por su número',

      // shared by My tablas and Make tablas
      'cancel': 'Cancelar',
      'emptySquare': 'Casilla vacía',
      'tablaName': 'Nombre de la tabla',
      'alreadyTwice': '{card} ya está dos veces en {tabla}',
      'twice': 'Dos veces',
      'remove': 'Quitar',
      'copyLink': 'Copiar liga',
      'linkCopied': 'Liga copiada',

      // My tablas: the top, the tablas and the called cards
      'board.title': 'Lotería · Mis tablas',
      'board.theyCalled': '¿cuál salió?',
      'board.player': 'Jugador',
      'board.whoTablas': { one: '{name} · 1 tabla', other: '{name} · {n} tablas' },
      'board.nothingYet_html': 'Todavía no cantan nada. Toca <b>Cantaron…</b> cuando canten una carta, o toca la carta en una tabla.',
      'board.notOnYours': 'no está en tus tablas',
      'board.undoCall': 'Quitar la última carta cantada',
      'board.enlarge': 'Agrandar',
      'board.showAll': 'Ver todas las tablas',
      'board.histEmpty': 'Aquí salen las cartas cantadas',
      'board.calledN': { one: '1 cantada', other: '{n} cantadas' },
      'board.uncall': 'Toca para quitarla',
      'board.tookBack': 'Se quitó {card}',
      'board.alreadyCalled': '{card} ya salió',
      'board.searchCall': 'Nombre o número… “luna”, 23',
      'board.searchSquare': 'Escoge una carta para esta casilla',
      'board.newRoundWhat': 'Ronda nueva — ¿a qué jugamos?',
      'board.patsNote_html': 'Toca a qué se juega esta ronda. <b>Clásico</b> es lo de siempre — una tabla gana con 4 en línea, 4 esquinas o 4 en cuadro. Las demás son figuras sueltas; mantén presionada una un segundo para sumarla a lo elegido, y una tabla gana con cualquiera de ellas.',
      'board.andMore': ' — y {n} más',
      'board.shout': '¡Grítala antes que nadie!',
      'board.keepPlaying': 'Seguir jugando',
      'board.clearH': '¿Limpiar la ronda?',
      'board.clearNote': 'Quita los frijoles de las {n} cartas cantadas para empezar la siguiente ronda.',
      'board.clearGo': 'Limpiar para otra ronda',

      // My tablas: Settings
      'board.marker': 'Con qué marcar',
      'board.soundsNote': 'Un frijolito al marcar y una fanfarria cuando ganas.',
      'board.dim': 'Opacar las casillas fuera de la figura',
      'board.dimNote': 'Solo con figuras fijas, como Esquinas o La Ele.',
      'board.whoH': 'Quién juega en este dispositivo',
      'board.addPerson': 'Agregar a alguien',
      'board.add': 'Agregar',
      'board.gotTwo': '{name} empieza con dos tablas al azar — cámbialas en Tablas',
      'board.eachPerson_html': 'Cada quien tiene sus propias tablas. Para mandarle tus tablas a alguien, usa <b>Compartir</b> en Tablas.',
      'board.callingH': '¿Vas a cantar?',
      'board.calling_html': '<a href="cantor.html">El Cantor</a> baraja las cartas y canta cada una en voz alta, imprime tablas numeradas y revisa una ¡Lotería! por número de tabla.',
      'board.about': 'Acerca de',
      'board.aboutDrive': 'Todo vive en este dispositivo, y en tu Google Drive si guardas ahí. Si recargas la página, la ronda sigue.',
      'board.aboutLocal': 'Todo vive en este dispositivo — nada se manda a ningún lado. Si recargas la página, la ronda sigue.',

      // My tablas: Tablas, and a printed tabla
      'board.playerName': 'Nombre de quien juega',
      'board.share': 'Compartir',
      'board.editNote': 'Toca cualquier casilla para cambiar su carta. Se vale repetir una carta (regla de la casa) — cuando la cantan, las dos casillas llevan frijol — pero no tres veces. Los nombres se pueden cambiar.',
      'board.addTabla': '+ Otra tabla',
      'board.addPrinted': '+ Una tabla impresa',
      'board.restore': 'Volver a las cuatro originales',
      'board.makeToPrint': 'Hacer tablas para imprimir',
      'board.removePerson': 'Quitar a esta persona',
      'timesN': '{k} veces',
      'board.randomTabla': 'Tabla al azar',
      'board.removedElsewhere': '{tabla} se quitó en otro dispositivo',
      'board.replaceCardsAgain': 'Toca otra vez para cambiar las cartas de {tabla}',
      'board.removeTablaAgain': 'Toca otra vez para quitar {tabla}',
      'board.sixPlenty': 'Con seis tablas basta',
      'board.replaceAllAgain': { one: 'Toca otra vez para reemplazar tu tabla', other: 'Toca otra vez para reemplazar tus {n} tablas' },
      'board.needOne': 'Primero agrega a alguien más — la app necesita a alguien que juegue',
      'board.removePersonAgain': 'Toca otra vez para quitar a {name}',
      'board.addPrintedH': 'Agregar una tabla impresa',
      'board.printedNote': 'Las tablas que imprime El Cantor traen el nombre del juego abajo y un número arriba. Escribe los dos y aquí aparece la misma tabla, casilla por casilla — así quien canta la puede revisar por número.',
      'board.juegoLike': 'Juego, como CANELA',
      'board.addIt': 'Agregarla',
      'board.added': 'Se agregó {name}',

      // My tablas: Share, a shared link, and the first visit
      'board.shareH': 'Compartir las tablas de {name}',
      'board.shareNote': { one: 'Quien abra esta liga recibe una copia de esta tabla en su dispositivo, con el nombre “{name}”. La liga lo lleva todo — no se guarda nada en otro lado.', other: 'Quien abra esta liga recibe una copia de estas {n} tablas en su dispositivo, con el nombre “{name}”. La liga lo lleva todo — no se guarda nada en otro lado.' },
      'board.send': 'Enviar…',
      'board.selectCopy': 'Selecciona la liga y cópiala',
      'board.shareTitle': 'Tablas de lotería',
      'board.shareText': 'Las tablas de {name}',
      'board.guest': 'Invitado',
      'board.importH': 'Tablas de {name}',
      'board.importNote': { one: 'Esta liga trae 1 tabla para “{name}”.', other: 'Esta liga trae {n} tablas para “{name}”.' },
      'board.importHave': 'Ya hay alguien llamado {name} en este dispositivo; con esta liga se reemplazan sus tablas.',
      'board.replaceUse': 'Reemplazar y usar',
      'board.addUse': 'Agregar y usar',
      'board.noThanks': 'No, gracias',
      'board.playingAs': 'Juegas como {name}',
      'board.welcomeH': '¿Quién juega en este dispositivo?',
      'board.welcomeDrive': 'Solo se pregunta una vez. Las tablas se guardan en este teléfono o tableta, y en tu propio Google Drive si lo activas abajo.',
      'board.welcomeLocal': 'Solo se pregunta una vez. Las tablas se guardan nada más en este teléfono o tableta, así que lo que armes aquí es tuyo y de nadie más.',
      'board.yourName': 'Tu nombre',
      'board.startWith': 'Empieza con',
      'board.wRandom': 'Tablas al azar para cambiar',
      'board.wMark': 'Las cuatro tablas de Mark',
      'board.eitherWay_html': 'Como sea, después puedes cambiar cada casilla en <b>Tablas</b>.',
      'board.alreadyDrive': '¿Ya guardas tablas en Google Drive en otro dispositivo? Actívalo aquí y llegan solitas.',
      'board.tapTablas': '{name}, toca Tablas para armar tus cartas',
      'board.fromDrive': 'Tus tablas llegaron de Google Drive'
    }
  };

  var KEY = 'loteria.lang', nav = window.navigator || {};
  function chosen() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) { }
    if (v === 'en' || v === 'es') return v;
    var first = nav.languages && nav.languages.length ? nav.languages[0] : nav.language || '';
    return /^es(-|$)/i.test(first) ? 'es' : 'en';
  }
  var lang = chosen();
  try { document.documentElement.lang = lang === 'es' ? 'es-MX' : 'en'; } catch (e) { }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function text(key, vars, html) {
    var v = S[lang][key];
    if (v == null) v = S.en[key];
    if (v == null) return key;
    if (typeof v === 'object') v = vars && vars.n === 1 ? v.one : v.other;
    return v.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? (html ? esc(vars[k]) : String(vars[k])) : m; });
  }
  function T(key, vars) { return text(key, vars, false); }
  T.html = function (key, vars) { return text(key, vars, true); };
  T.lang = lang;
  T.locale = lang === 'es' ? 'es-MX' : 'en-US';
  T.list = function (names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + T('and') + names[names.length - 1]; };
  T.ord = function (n) {
    if (lang === 'es') return n + '.ª'; // la 5.ª carta: a card is feminine
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  T.apply = function (root) {
    function each(attr, f) { var els = root.querySelectorAll('[' + attr + ']'); for (var i = 0; i < els.length; i++) f(els[i], els[i].getAttribute(attr)); }
    each('data-t', function (el, k) { el.textContent = T(k); });
    each('data-t-html', function (el, k) { el.innerHTML = T.html(k); });
    each('data-t-aria', function (el, k) { el.setAttribute('aria-label', T(k)); });
    each('data-t-title', function (el, k) { el.title = T(k); });
    each('data-t-ph', function (el, k) { el.placeholder = T(k); });
  };
  T.set = function (to, reopen) {
    if (to === lang || !S[to]) return;
    try { localStorage.setItem(KEY, to); } catch (e) { }
    try { if (reopen) sessionStorage.setItem('loteria.reopen', reopen); } catch (e) { }
    location.reload();
  };
  // Each label in its own language (the same in both tables), so someone who reads only one of them can find it.
  T.switch = function (host, reopen) {
    var label = { en: T('lang.en'), es: T('lang.es') };
    host.innerHTML = '<div class="seg lang" role="group" aria-label="' + esc(T('lang.label')) + '">' + ['en', 'es'].map(function (l) {
      return '<button type="button" lang="' + l + '" data-lang="' + l + '" aria-pressed="' + (l === lang) + '"' + (l === lang ? ' class="on"' : '') + '>' + esc(label[l]) + '</button>';
    }).join('') + '</div>';
    var bs = host.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) bs[i].addEventListener('click', function () { T.set(this.getAttribute('data-lang'), reopen); });
  };
  T.S = S; // the tables, for test/e2e.mjs
  window.T = T;
})();
