# El Cantor

A Lotería caller for the phone, tablet or laptop at the head of the table. It replaces the deck and the person reading it. Everything stays on the device: no accounts, nothing sent anywhere.

Open `index.html` from any static host (GitHub Pages works). Put it on the home screen and it runs full screen.

## What it does

- **Calls the cards.** Shuffles the 54 cards and turns them over one at a time, calling each one aloud in Spanish. It says just the name by default, or the verse and then the name. Tap ▶ to call on its own at a slow, normal or fast pace, or turn each card by hand.
- **Recorded voices.** Dora, Alex or Santa read the cards, so every phone and tablet sounds the same. The device's own Spanish voice is the fallback. On an iPhone it plays even with the silent switch on.
- **Adivinanza** mode reads the verse with the card face down, so the table can guess before it turns over.
- **The sábana** shows all 54 cards, lit in the order they were called.
- **Print tablas** makes a PDF of numbered tablas to print at home, one large or two per page, Letter or A4. A set — a *juego* — is built from its name, so `CANELA` tabla 7 is always the same tabla.
- **¡Lotería!** takes the winner's word by default: a cheer, the winner's name (one tap for past winners), and the next round.
  - Tables that check can switch that in Settings, or tap **Check a tabla first**.
  - To check a printed tabla, type its juego and tabla number. El Cantor shows the tabla with beans on the called cards, whether it wins the current game, and when it first did.
  - For store-bought tablas, tap the cards the player reads out instead.
- **Games:** Clásico (4 in a row, 4 corners, or 4 in a square), or a single shape. The shapes are La Equis, La Ele, El Marco, Rieles, Escalera, Centro, Siete Loco and Tabla Llena.
- **Keeps a tally** of who won each round.

Keyboard: Space starts or pauses · → next card · ← puts the last card back · L checks a ¡Lotería!

## Playing along on phones

The play-along board lives in [markjf99702/loteria-cards](https://github.com/markjf99702/loteria-cards). Each player marks their own tablas on their phone as cards are called. The board can also load a tabla printed here, by its juego name and number.

To link it from El Cantor's Settings, set `BOARD_URL` near the top of the script in `index.html` to the board's address.

## Files

- `index.html` — El Cantor.
- `deck.js` — the cards, their verses, the winning shapes, and the juego generator.
  - The generator is frozen: changing it would change every tabla already printed.
  - The board carries the same file; keep the two copies in step.
- `cards/` — the 54 card images.
- `audio/` — the recorded voices.
  - One clip per card: the verse, a breath, the name. Plus the opening line and ¡Lotería!
  - `voices.json` lists the voices and where each verse ends, so Adivinanza can stop before the name.
- `tools/make_voices.py` — renders `audio/` with [Kokoro-82M](https://github.com/hexgrad/kokoro) (Apache-2.0), using espeak-ng's Latin American Spanish for pronunciation. Rerun it after changing a verse in `deck.js`; the usage is at the top of the script.
