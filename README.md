# El Cantor

**Play it: [el-cantor.junkdrawer.works](https://el-cantor.junkdrawer.works/)**

**Lotería for the family table, in one package.** Everything stays on the device, unless you turn on saving to Google Drive so your tablas follow you to your other devices.

<p align="center">
  <img src="docs/phone-cantor.png" alt="El Cantor on a phone, five cards into round 2: card No. 1, El Gallo, face up with its verse, and La Rosa, El Corazón and La Sirena in the row of cards called before it" width="250">
  &nbsp;
  <img src="docs/phone-board.png" alt="My tablas on a phone: Mark's four tablas with beans on the eight cards called so far, Tabla 1 outlined in green for a línea across its top row, and La Araña as the last card called" width="250">
  &nbsp;
  <img src="docs/phone-print.png" alt="Make tablas on a phone: Tabla 1 full, with Las Jaras on it twice, Tabla 2 nine cards in with its tenth square picked, and the deck of cards below to tap or drag from" width="250">
</p>

Install it from the browser (on an iPhone, Share → Add to Home Screen) and it runs as its own app. It works offline too: installing keeps the card pictures, and the recorded voices are kept as they play. The home screen has three choices:

- **El Cantor** (`cantor.html`) calls the game: the phone, tablet or laptop at the head of the table that replaces the deck and the person reading it.
- **My tablas** (`board.html`) is the play-along board: each player marks their own tablas on their phone as cards are called.
- **Make tablas** (`print.html`) makes tablas by hand, with drag and drop, and prints them.

Every page has a ⌂ button back to the home screen. They all load the same `deck.js` and card images.

**English or Español.** The home screen has an **English | Español** switch, and so do the top of Settings in El Cantor and My tablas and the foot of Make tablas. A device's first visit to My tablas has it too, at the foot of who's playing and of a shared link's offer: the offer comes back in the new language with the same tablas, and a name already typed stays. The choice is kept on each device (it doesn't go to Google Drive), and a phone or computer set to Spanish starts in Español. All three tools follow it, and so do the tablas El Cantor prints and what Google Drive saving says, dates included. The card names, the verses and the recorded voices are Spanish either way.

## How it plays

### El Cantor — calling the game

- **Calls the cards.** Shuffles the 54 cards and turns them over one at a time, calling each one aloud in Spanish. It says just the name by default, or the verse and then the name. Tap ▶, or the card itself, to call on its own and to pause; **Next card** turns them by hand. On a phone, the timer button beside it switches between slow, normal and fast (7, 4 or 2 seconds between cards).
- **Recorded voices.** Dora, Alex or Santa read the cards, so every phone and tablet sounds the same. The device's own Spanish voice is the fallback. On an iPhone it plays even with the silent switch on.
- **Adivinanza** mode reads the verse with the card face down, so the table can guess before it turns over.
- **The sábana** shows all 54 cards, lit in the order they were called.
- **Print tablas** makes a PDF of numbered tablas to print at home, one large or two per page, Letter or A4. A set — a *juego* — is built from its name, so `CANELA` tabla 7 is always the same tabla.
- **¡Lotería!** takes the winner's word by default: a cheer, the winner's name (one tap for past winners), and the next round, which asks what the table plays next (**Done** keeps the game). Before the first card it only says that ▶ starts the round, so a slip of the finger cheers nobody.
  - Tables that check can switch that in Settings, or tap **Check a tabla first**, which brings the name along. The checker keeps **Who won?**, the past winners and **¡Buena! New round** at the bottom of the screen. When a tabla isn't good yet, **Keep calling** is the main button there, and **Count it anyway** still counts the win.
  - To check a printed tabla, type its juego and tabla number. El Cantor shows the tabla with beans on the called cards, whether it wins the current game (the winning line outlined in gold), and when it first did. It remembers the juego, so the next check opens on it, ready for a number.
  - For store-bought tablas, tap the cards the player reads out instead.
- **Games:** Clásico (4 in a row, 4 corners, or 4 in a square), or a single shape. The shapes are Línea, Esquinas, Centro, Cuadrito, La Ele, La Equis, El Marco, Rieles, Escalera, Siete Loco and Tabla Llena. Hold a shape for a second to add it to the game; then a tabla wins on any one of them. Clásico already wins with every shape but Siete Loco, so on Clásico only Siete Loco goes on top (**Clásico + Siete Loco**), and holding another one says so.
- **Keeps a tally** of who won each round. A name counts once whatever its capitals: typed the way a past winner's was, "abuela" is saved as "Abuela", and a name first saved as "abuela" becomes "Abuela" once someone types it with its capital.

Keyboard: Space starts or pauses · → next card · ← puts the last card back · L checks a ¡Lotería! · Enter in **Who won?** counts the win (a phone's Go key does the same)

### My tablas — playing along

Someone calls the cards; you tap **Cantaron…**, pick the card, and it marks itself on every tabla where it appears. A card picked again stays marked. To take one back, tap its square or its name in the row of called cards, or ↶ for the last one.

- Pick the game each round: Clásico, or a single shape, the same list El Cantor uses.
- A win cheers, outlines the tabla and says what to tell the caller: *juego CANELA, tabla 7* for a tabla added with **+ A printed tabla**, so El Cantor can check it by number, or else the winning cards to read out (just "the cards with a bean" for a big shape like Tabla Llena). Its **New round** asks before it takes the beans off, as ↺ does.
- Edit tablas square by square. Doubles are fine (family rule) — when that card is called, both squares get a bean — but not three of a card. Up to six tablas per person.
- **Random tabla** deals 16 different cards, with no double, as a start to edit from. Make tablas' **Random** makes one like Mark's four instead.
- **+ A printed tabla** adds a tabla from El Cantor's printed juegos by its name and number. It starts with the juego El Cantor last printed or checked on this device.
- **The first visit** asks who's playing on the device: a name, which it waits for, and two random tablas to edit or Mark's four to start with. **Not now** goes back to the home screen without saving anything, and the question comes back next time.
- Several people on one device, each with their own tablas. The name of whoever is playing takes the place of the Lotería title at the top, and a tap on it switches to someone else. **Share** makes a link that carries a set of tablas to another phone.

### Make tablas — by hand, to print

- Drag cards from the deck onto a tabla. On a phone or iPad, press and hold a card before you drag it. Drag a square to move it, onto another tabla to copy it, or back to the deck to take it off. You can also tap a square and then tap cards.
- **Doubles ✓** is the family rule: a card can go on a tabla twice, but not three times. **Random** makes a tabla like Mark's four, with 15 cards and one of them twice, side by side in the middle. Turn it off to allow each card only once.
- A double covers two squares, so a tabla with one needs a card fewer for some shapes and wins a little more often than a tabla without, most at Centro, where the double sits. Among Mark's four, which all have one, it evens out.
- **Print…** fits 1, 2 or 4 tablas on a Letter or A4 page. With 2 per page the tablas print sideways.
- Copy in Mark's four, or anyone's tablas from My tablas on this device. **Play these in the app…** sends full tablas to My tablas, on this phone or another.
- Hand-made tablas aren't numbered, so El Cantor checks them card by card. For a set it checks by number, use El Cantor's **Print tablas**.

## Saving to Google Drive

Anyone can turn this on from the home screen, from Settings in My tablas or El Cantor, or from the bottom of Make tablas. It needs a Google account, and each person's tablas go to their own Drive. Everyone who signs in with the same account shares one set.

- **What's saved:** the people and tablas in My tablas, the tablas in Make tablas, El Cantor's winners and the juego it last printed or checked. Called cards, voices and other settings stay with each device.
- **Where:** one file, `Lotería tablas.json`, in a `Lotería` folder in the person's Google Drive. The app asks only for `drive.file`, Google's narrowest Drive permission: the junkdrawer.works apps can open only the files they made, and nothing else in Drive. Deleting the folder removes the Drive copy; the next sync makes a new one from whatever the device has.
- **How changes combine:** each device keeps working from its own copy and syncs when a page opens, a few seconds after a change, and when **Sync now** is tapped. Changes merge one tabla at a time, so edits on two devices both survive; if the same tabla changed on both, the newer change wins. The first time a device joins, nothing is thrown away: someone set up under the same name on both devices becomes one person with the tablas from both, spelled the way Drive already has it ("Mark", even if the new phone said "mark").
- **The one-hour rule:** Google lets a website with no server of its own use Drive for an hour after signing in. After that, the ☁ button in My tablas and Make tablas shows a red dot. Tap it once to sync again; it usually goes by without asking anything.
- **When something goes wrong,** the ☁ button's dot turns red, and a tap on it, or on **Sync now**, says what happened for a few seconds, in the language chosen: no connection (the tablas are kept on the device and sync once it's back online), a full Google Drive (nothing new is saved there until some space is freed), Drive busy (it tries again by itself a minute later), or Google's sign-in not loading. Settings says the same under **Saved to Google Drive**.
- **Stop saving on this device** turns it off here. The tablas stay on the device and in Drive.

### Setting it up

`sync.js` uses the junkdrawer.works OAuth client that Shelfmark and Terraville also use. It is authorized for `https://el-cantor.junkdrawer.works` (and for `https://junkdrawer.works`, where El Cantor used to live), and Drive saving shows only there. All three apps ask for the same permission, `drive.file`, so there's nothing to add in Google Cloud, and approving it once covers every app.

Things that come with sharing the client:

- **One sign-in for the hour.** The Google sign-in is kept under the `junkdrawer.google` key in localStorage, the same key every junkdrawer.works app uses. Each app has its own address now, so each keeps its own copy: a sign-in lasts the hour here, and the next one remembers the account.
- **No revoking.** **Stop saving on this device** turns saving off here without revoking anything, because revoking cancels the permission for every app on the client.
- **Files are found by tags, not names.** Each app's files carry `appProperties` naming the app (`loteria: 'folder'`, `loteria: 'sync'`), and the app searches by those, so apps sharing the client never pick up each other's files.

To run it from another address, create a Web client with the Drive API turned on and `drive.file` allowed, add that origin under **Authorized JavaScript origins**, and put the client ID and origin in `sync.js`.

## Running it

It's a static site: plain HTML, CSS and JavaScript, with no build step. It runs from any static host as it is.

```sh
npx serve .                   # or any static file server, then open the printed address
npm test                      # uses the three tools in Chromium through the real pages (needs Playwright)
npm install                   # once, for the screenshots
node tools/screenshots.mjs    # redraws the pictures in docs/
node tools/make-icons.mjs     # redraws the PNG icons from icon.svg
```

To put it online with GitHub Pages: **Settings → Pages → Build and deployment → Deploy from a branch**, then pick `main` and `/ (root)`.

### Files

- `index.html` — the home screen.
- `cantor.html` — El Cantor.
- `board.html` — My tablas, the play-along board.
- `print.html` — Make tablas.
- `carry.js` — the first time it opens at el-cantor.junkdrawer.works, brings the tablas saved at its old address, junkdrawer.works/el-cantor/.
- `strings.js` — every word the app shows, in English and in Spanish, and the English / Español setting. Change a wording in both languages: `npm test` fails when a word is missing in either one, or is there but used nowhere.
- `manifest.webmanifest`, `icon.svg` and the `icon-*.png` sizes — installing it as an app. `node tools/make-icons.mjs` redraws the PNGs from `icon.svg` and `tools/icon-full-bleed.svg`.
- `sw.js` — the offline copy: the pages, the fonts, the card pictures, and each voice clip once it has played. On a connection that isn't answering, a page opens from that copy after four seconds. `FILES` in it is a fingerprint of the files it keeps: change one and `npm test` says what to set it to, so a release never leaves the copy half old.
- `sync.js` — saving to Google Drive: signing in, the Drive file, and merging changes from every device.
- `deck.js` — the cards, their verses, the winning shapes, Mark's four tablas, and the juego generator. Every page loads it.
  - The generator is frozen: changing it would change every tabla already printed.
- `cards/` — the 54 card images, drawn for El Cantor.
- `fonts/` — Bree Serif and Nunito Sans (SIL Open Font License), served from here so nothing loads from elsewhere.
- `tools/cards/` — draws the cards.
  - Each card is an SVG in a cut-paper style, written in Python: `card.py` is the template and shared pieces, and `art1.py` to `art5.py` hold the pictures.
  - `python3 tools/cards/build.py` writes the SVGs, then `node tools/cards/render.mjs` (with [Playwright](https://playwright.dev)) turns them into `cards/*.jpg`. Rerun both after changing a card.
- `audio/` — the recorded voices.
  - One clip per card: the verse, a breath, the name. Plus the opening line and ¡Lotería!
  - `voices.json` lists the voices and where each verse ends, so Adivinanza can stop before the name.
- `tools/make_voices.py` — renders `audio/` with [Kokoro-82M](https://github.com/hexgrad/kokoro) (Apache-2.0), using espeak-ng's Latin American Spanish for pronunciation. Rerun it after changing a verse in `deck.js`; the usage is at the top of the script.
- `tools/screenshots.mjs` — draws the pictures in `docs/`, with each tool opened on the same saved tablas every time. It saves them with 256 colours using upng-js, from `npm install`.
- `test/e2e.mjs` — what `npm test` runs: El Cantor, My tablas and Make tablas used through the real pages in Chromium, two devices saving to a stand-in Google Drive (`test/fake-google.mjs`), every page offline, and the words: each one in English and Spanish, and the screens in Spanish swept for English left behind. It runs Chromium in US English, whatever the computer's language, and so does `tools/screenshots.mjs`.

## License

The code, the card art and the recorded voices are MIT — see [LICENSE](LICENSE).
