# El Cantor

Lotería for the family table, in one package. Everything stays on the device, unless you turn on saving to Google Drive so your tablas follow you to your other devices.

Open `index.html` from any static host (GitHub Pages works). Put it on the home screen and it runs full screen. The home screen has three choices:

- **El Cantor** (`cantor.html`) calls the game: the phone, tablet or laptop at the head of the table that replaces the deck and the person reading it.
- **My tablas** (`board.html`) is the play-along board: each player marks their own tablas on their phone as cards are called.
- **Make tablas** (`print.html`) makes tablas by hand, with drag and drop, and prints them.

Every page has a ⌂ button back to the home screen. They all load the same `deck.js` and card images.

## El Cantor

## What it does

- **Calls the cards.** Shuffles the 54 cards and turns them over one at a time, calling each one aloud in Spanish. It says just the name by default, or the verse and then the name. Tap ▶, or the card itself, to call on its own and to pause; **Next card** turns them by hand. On a phone, the timer button beside it switches between slow, normal and fast (7, 4 or 2 seconds between cards).
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

## My tablas — playing along

Someone calls the cards; you tap **Cantaron…**, pick the card, and it marks itself on every tabla where it appears.

- Pick the game each round: Clásico, or a single shape, the same list El Cantor uses.
- Edit tablas square by square. Doubles are fine (family rule): when that card is called, both squares get a bean. Up to six tablas per person.
- **+ A printed tabla** adds a tabla from El Cantor's printed juegos by its name and number. It starts with the juego El Cantor last printed on this device.
- Several people on one device, each with their own tablas. **Share** makes a link that carries a set of tablas to another phone.

## Make tablas — by hand, to print

- Drag cards from the deck onto a tabla. On a phone or iPad, press and hold a card before you drag it. Drag a square to move it, onto another tabla to copy it, or back to the deck to take it off. You can also tap a square and then tap cards.
- **Doubles ✓** is the family rule: a card can go on a tabla twice, but not three times. **Random** makes a tabla like Mark's four, with 15 cards and one of them twice, side by side in the middle. Turn it off to allow each card only once.
- **Print…** fits 1, 2 or 4 tablas on a Letter or A4 page. With 2 per page the tablas print sideways.
- Copy in Mark's four, or anyone's tablas from My tablas on this device. **Play these in the app…** sends full tablas to My tablas, on this phone or another.
- Hand-made tablas aren't numbered, so El Cantor checks them card by card. For a set it checks by number, use El Cantor's **Print tablas**.

## Saving to Google Drive

Anyone can turn this on from the home screen, from Settings in My tablas or El Cantor, or from the bottom of Make tablas. It needs a Google account, and each person's tablas go to their own Drive. Everyone who signs in with the same account shares one set.

- **What's saved:** the people and tablas in My tablas, the tablas in Make tablas, El Cantor's winners and the juego it last printed. Called cards, voices and other settings stay with each device.
- **Where:** one small file, `loteria-sync.json`, in the hidden app-data folder of the person's Google Drive. The app asks only for that folder (the `drive.appdata` permission); it can't see anything else in Drive. To delete the copy, open Google Drive → Settings → Manage apps, find the junkdrawer.works app (listed under the shared Google project's name), and choose Delete hidden app data.
- **How changes combine:** each device keeps working from its own copy and syncs when a page opens, a few seconds after a change, and when **Sync now** is tapped. Changes merge one tabla at a time, so edits on two devices both survive; if the same tabla changed on both, the newer change wins. The first time a device joins, nothing is thrown away: someone set up under the same name on both devices becomes one person with the tablas from both.
- **The one-hour rule:** Google lets a website with no server of its own use Drive for an hour after signing in. After that, the ☁ button in My tablas and Make tablas shows a red dot. Tap it once to sync again; it usually goes by without asking anything.
- **Stop saving on this device** turns it off here. The tablas stay on the device and in Drive.

### Setting it up

`sync.js` uses the junkdrawer.works OAuth client that Shelfmark and Terraville also use, authorized for `https://junkdrawer.works`, and Drive saving shows only at that address. In its Google Cloud project, **Google Auth Platform → Data Access** must list `.../auth/drive.appdata` next to the other apps' `drive.file`. Google classes both as non-sensitive, so no review is needed.

Two consequences of sharing the client:

- **One hidden folder:** the hidden app-data folder belongs to the Google project, so it would be shared by any junkdrawer.works app that used it. This app only reads and writes `loteria-sync.json`.
- **No revoking:** **Stop saving on this device** forgets the sign-in without revoking it, because revoking cancels the permission for every app on the client. Sign-in also asks only for this app's folder (`include_granted_scopes: false`), so the token kept on the device can't reach the other apps' Drive files.

To run it from another address, create a Web client with the Drive API on and `drive.appdata` allowed, add that origin under **Authorized JavaScript origins**, and put the client ID and origin in `sync.js`.

## Files

- `index.html` — the home screen.
- `cantor.html` — El Cantor.
- `board.html` — My tablas, the play-along board.
- `print.html` — Make tablas.
- `sync.js` — saving to Google Drive: signing in, the Drive file, and merging changes from every device.
- `deck.js` — the cards, their verses, the winning shapes, Mark's four tablas, and the juego generator. Every page loads it.
  - The generator is frozen: changing it would change every tabla already printed.
- `cards/` — the 54 card images, drawn for El Cantor.
- `tools/cards/` — draws the cards.
  - Each card is an SVG in a cut-paper style, written in Python: `card.py` is the template and shared pieces, and `art1.py` to `art5.py` hold the pictures.
  - `python3 tools/cards/build.py` writes the SVGs, then `node tools/cards/render.mjs` (with [Playwright](https://playwright.dev)) turns them into `cards/*.jpg`. Rerun both after changing a card.
- `audio/` — the recorded voices.
  - One clip per card: the verse, a breath, the name. Plus the opening line and ¡Lotería!
  - `voices.json` lists the voices and where each verse ends, so Adivinanza can stop before the name.
- `tools/make_voices.py` — renders `audio/` with [Kokoro-82M](https://github.com/hexgrad/kokoro) (Apache-2.0), using espeak-ng's Latin American Spanish for pronunciation. Rerun it after changing a verse in `deck.js`; the usage is at the top of the script.

## License

The code, the card art and the recorded voices are MIT — see [LICENSE](LICENSE).
