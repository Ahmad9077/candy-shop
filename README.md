# البقالة (internal id `candy-shop`)

A calm iPad game in which a Grade 1 child runs a neighbourhood grocery and, without being asked a
single question, learns to add within ten. Customers walk in with an order of كاكاو, حلاو or تاكيز
(always one good per order); she packs it by tapping the goods, rings the bell to hand it over, and
works toward one goal: 200 points and a real-world prize. A mismatch is a customer who peeks in
and counts with her; then she fixes the order herself. The design brief is kept outside this
repository (the comments' `DESIGN.md §n` point into it).

**Training and competition (§10.2).** Every order type is in one of two modes, saved per type.
*Training* (`help`, where every type starts): Dabdoob leans in and counts with her (the count is
said on every tap, the box's number tag, the tags over added pieces, the dots in the bubble, the
trail and the spoken house numbers of the street, the loose pieces of «كيس واحد», a tap on the
closed box opens it and says its number), and the board never moves. *Competition* (`compete`):
no counting help at all (taps only plip; a tap on the closed box only wobbles; its label stays),
two gold coins wait by the bell and Dabdoob steps back with a paw over his mouth. Right the first
time +2 (two coins fly from the customer to the board); wrong the first time −2 at once (two coins
drop out of the board, never below 0), then the peek-and-count, she fixes it, nothing more for that
order. A type moves to competition when 4 of her last 5 training orders were right first time, and
back to training when 1 or fewer of her last 5 in competition were; the hidden number range (levels
1–3) moves by its own 4-of-5 rule in both modes. The parents can move a type by hand.

**Status.** The shop front, the grocery, the day of five customers and eight customers (rabbit, cat
and duck, then hedgehog, panda, frog, fox and penguin after 5, 10, 16, 24 and 34 served), and the five
order types, arriving one per morning (day 1 A, day 2 C, then B, D, E after a good day or two days):

- **A «طلب»**: pack N of one good.
- **C «علبة جاهزة»**: count on from a closed box of a pieces of one good; the same good is added on
  the lime side tray and keeps its lime ring in the lineup.
- **B «كيسين»**: N pieces of one good in two open bags, split any way she likes (each piece drops
  into the bag she tapped last); the number house of N records the split, the right bag's count on
  the right; in competition +1 for a new split and +5 once for a full house.
- **D «توصيل»**: the number street, houses ٠–١٠ left to right; Dabdoob rides from house a, she taps
  the door of a + b; a wrong door's resident says it is not their house and Dabdoob rides back,
  house by house, aloud.
- **E «كيس واحد»**: the order card «a + b», a closed box of the bigger number, the rest loose
  (training) or in a second closed bag (competition), and a sticker roll ٠–١٠: she sticks the total.

Every receipt reads «a + b = n», the first chip in the good's colour (brown, pink or the bag's
purple), the second lime. The parents' page (hold «للأهل» for 2 s) explains the rule, shows each type
with its mode, level and customers served, switches each type on or off and between training and
competition, opens every type, turns the voice off, starts «تحدي جديد» and resets.

The Takis bag and the Takis piece are the owner's photos (`src/assets/takis-bag.webp`,
`src/assets/takis-piece.webp`), bundled and inlined as they are; everything else is original drawing.

## Run it

```sh
npm install
npm run dev            # http://127.0.0.1:4195/ (preview mode)
```

Address flags: `?fast=1` makes animations and narration waits almost instant (used by the tests),
`?seed=123` makes a day repeatable, and `?pace=1` is silent but gives every recorded clip its real
length (used by `tests/e2e/pace.spec.ts`, which checks on a fake clock that after a right «طلب» the
next order is usable within 3 s, and that every receipt (ready box, two bags, sticker, the delivery
ticket) stays from its first word to 1.2 s after its last, with the next order usable within 1.5 s
of it leaving).

| command | what it does |
|---|---|
| `npm run check` | lint, typecheck, unit tests, preview build |
| `npm run test:e2e` | Playwright: iPad landscape (1180×820), iPad portrait (820×1180) and iPhone (390×844), each in WebKit and Chromium |
| `npm run shots` | screenshots of every order type in training and in competition, the closing board and the parents' page, at the three sizes, in `shots/` (not tracked) |
| `npm run build:hub` | production Hub build in `dist-hub/`, base `/candy-shop/` |
| `npm run build:artifact` | preview build, then `preview/candy-shop.html`: one self-contained file (script, styles, fonts and recorded clips inlined) that plays in a sandboxed iframe with no network |
| `npm run list:audio` | every narration cue and its text (`node scripts/list-audio-cues.ts --missing` lists only the clips not recorded yet) |

## Narration and the audio workflow

Every clip is being re-recorded in a young Gulf girl's voice (`AUDIO_REVISION` `baqala-v1`). A clip
plays only if the manifest holds a take with the text the game says now; anything else is silent
(and captioned in preview builds). Counting is the narrator with the number clips; the receipt sentence joins the numbers
with «زائد» and «يساوي». Customers speak the `c/` lines, the same recordings played at each animal's
playback rate. Dabdoob's guide lines (`g/`) are said once when a thing first arrives and again when
she taps his «؟». Nobody praises: sounds and the customers' reactions carry the feeling. Every line
is in `src/data/lines.ts`; `tests/unit/lines.test.ts` checks the brief's texts, rejects any line of
the earlier quizzes (`tests/fixtures/old-quiz-lines.json`) and the banned praise, and keeps the
older rules.

Any clip not recorded resolves at once and silently: the game plays fully without it. In preview builds, the text of an unrecorded line shows
briefly at the top so the flow can be reviewed.

To record, after the owner has reviewed the lines (this spends ElevenLabs credits):

```sh
npm run list:audio                        # review the texts
python3 scripts/generate-audio.py --dry-run
python3 scripts/generate-audio.py         # only with the owner's go-ahead
python3 scripts/check-audio.py            # local whisper check of the takes
```

## Two build modes

- **preview** (`npm run dev`, `npm run build:preview`, `npm run build:artifact`): relative base,
  never touches the Hub, shows the «نسخة تجريبية» badge and the captions of unrecorded lines.
- **production-hub** (`npm run build:hub`): base `/candy-shop/`. Before the game renders, it loads
  the Hub's `config.js?v=4` and `access-guard.js?v=3`, then `progress-client.js?v=6`. At the end of
  each day it reports one aggregate through `QuizzesHubProgress.record({ quizId: 'candy-shop',
  score: firstBellDeliveries, total: customers, level, details: { day, orders } })`. There is no
  adaptive plan and there are no per-question calls.

## Code map

- `src/domain/`: orders and goods, hidden levels and the two modes, the plan of a day, arrivals,
  customers, her name in the customers' lines (`orders.ts`); the saved state, points (±2, floor 0,
  cap 200), number houses, the goal, closing lines and missed facts (`progress.ts`); the seeded
  random generator.
- `src/game/`: the shop scene and its director (`Shop.tsx`), the delivery street (`Street.tsx`),
  the script runner (`job.ts`), flights and touch-down taps.
- `src/art/`: the art, as original inline SVG and CSS (candies, the gift box, Dabdoob, the eight
  customers, the jars, the bell, coins, the prize board, the coupon, the groceries, the window, the
  door and sign, the shop front), plus the two owner's photos.
- `src/audio/`: the narrator (Web Audio, per-cue playback rate, missing clips resolve at once,
  blocked audio cannot stall the game) and synthesized sound effects.
- `src/hub/`: Hub bootstrap and bridge.
