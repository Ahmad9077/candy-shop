# البقالة (internal id `candy-shop`)

A calm iPad game in which a Grade 1 child runs a neighbourhood grocery and, without being asked a
single question, learns to add within ten by **counting on**: she keeps the first number and goes on
counting from it. Customers walk in one after another, with no days or rounds; each asks for a number
of one good («أبي سبعة تاكيز»). Dabdoob sets a closed ready box with its number on the counter (٥); she
taps the ordered good at the bottom (the Takis bag, the strawberry jar or the chocolate jar) and each tap
drops one piece onto the tray beside the box, until the tray makes up the order; then she rings the
bell. The goal is 100 points and a real-world prize. The design brief is kept outside this repository
(the comments' `DESIGN.md §n` point into it).

**Three steps of help (§12.1).** *Training* (`help`, where she starts): the box pulses; her first tap
(on the box or on the good) makes its number swell and be said, then the voice counts on with every
piece («ستة، سبعة») and each piece on the tray carries its number. *Light training* (`bridge`): the box's
number is said; the pieces only plip. *Competition* (`compete`): no counting help; two gold coins wait by
the bell and Dabdoob steps back with a paw over his mouth; a right first bell is +2. Nothing is ever
taken away. She moves up a step after 4 of her last 5 first tries in a step were right, and back down
after two wrong first tries in a row. The hidden number level of the ready box moves only in
competition. The box never opens for a peek (that would invite counting from one).

**A wrong bell (§12.2)**: nobody says a sentence. The pieces show the answer: the box opens, its pieces
framed under their one number (said once), and her pieces are counted on up to the order; what is
missing appears as ghost cups with their numbers, pieces past the order fade. She fixes the tray (a tap
on the good fills a ghost, a tap on a piece sends it back) and rings again.

**The fade.** While it is her turn, everything but the task (the box, the tray, the ordered good, the
bell, the order) fades and holds still; the colour comes back with the answer.

**The goal.** +2 per right first try in competition, up to 100. As the points land, after the receipt
has been read: the big board opens by itself at 25, 50 and 75, a short «near» line at the other tens,
and the golden coupon at 100. In the Hub build her balance is synced with the Hub, so the Admin can see
it and reset it.

The other order types stay in the game, off unless a parent switches them on: **A «طلب»** (pack N) and
**D «توصيل»** (the number street). The parents' page (hold «للأهل» for 2 s) explains the rule, shows
each type with its step, level and customers served, sets the step, switches types on or off, turns the
voice off, resets the balance («تصفير الرصيد») and resets everything.

The Takis bag and the Takis piece are the owner's photos (`src/assets/takis-bag.webp`,
`src/assets/takis-piece.webp`), bundled and inlined as they are; everything else is original drawing.

## Run it

```sh
npm install
npm run dev            # http://127.0.0.1:4195/ (preview mode)
```

Address flags: `?fast=1` makes animations and narration waits almost instant (used by the tests),
`?seed=123` makes a session repeatable, and `?pace=1` is silent but gives every recorded clip its real
length (used by `tests/e2e/pace.spec.ts`, which checks on a fake clock that after a right «طلب» the
next order is usable within 3 s, and that every receipt (the ready box, the delivery ticket) stays from its first word to 1.2 s after its last, with the next order usable within 1.5 s
of it leaving).

| command | what it does |
|---|---|
| `npm run check` | lint, typecheck, unit tests, preview build |
| `npm run test:e2e` | Playwright: iPad landscape (1180×820), iPad portrait (820×1180) and iPhone (390×844), each in WebKit and Chromium |
| `npm run shots` | screenshots of the ready box in its three steps, the fade, a wrong bell (too few, too many), the board, a milestone, the coupon and the parents' page, at the three sizes, in `shots/` (not tracked) |
| `npm run build:hub` | production Hub build in `dist-hub/`, base `/candy-shop/` |
| `npm run build:artifact` | preview build, then `preview/candy-shop.html`: one self-contained file (script, styles, fonts and recorded clips inlined) that plays in a sandboxed iframe with no network |
| `npm run list:audio` | every narration cue and its text (`node scripts/list-audio-cues.ts --missing` lists only the clips not recorded yet) |

## Narration and the audio workflow

Every clip is being re-recorded in a young Gulf girl's voice (`AUDIO_REVISION` `baqala-v1`). A clip
plays only if the manifest holds a take with the text the game says now; anything else is silent
(and captioned in preview builds). Counting is the narrator with the number clips; the receipt sentence joins the numbers
with «زائد» and «يساوي». Customers speak the `c/` lines, the same recordings played at each animal's
playback rate. Dabdoob's guide lines (`g/`) are said once the first time a thing comes up and again
when she taps his «؟». Nobody praises: sounds and the customers' reactions carry the feeling. Every line
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
  the Hub's `config.js?v=4` and `access-guard.js?v=3`, then `progress-client.js?v=6`. Every five
  orders it reports one aggregate through `QuizzesHubProgress.record({ quizId: 'candy-shop', score:
  firstTries, total: 5, level, details: { points, served, wrongCount, orders, step, numbers } })`.
  Her balance is synced through `QuizzesHubSupabaseClient.rpc('game_balance_sync', { p_game_id,
  p_points, p_epoch })` at start (at most 2.5 s before the shop opens), 1.5 s after a change of
  points, after a reset and when the page is seen again; a newer epoch (an Admin reset) wins, and in
  the same epoch the larger points. Every Hub call is wrapped: a failure is ignored.

## Code map

- `src/domain/`: orders and goods, hidden levels and the steps of help, who comes next, customers,
  her name in the customers' lines (`orders.ts`); the saved state and its migration, points (+2, cap
  100), what is said as points land, the balance and its resets, the Hub batch and missed facts
  (`progress.ts`); the seeded random generator.
- `src/game/`: the shop scene and its director (`Shop.tsx`), the delivery street (`Street.tsx`),
  the script runner (`job.ts`), flights and touch-down taps.
- `src/art/`: the art, as original inline SVG and CSS (candies, the gift box, Dabdoob, the eight
  customers, the jars, the bell, coins, the prize board, the coupon, the groceries, the window, the
  door and sign, the shop front), plus the two owner's photos.
- `src/audio/`: the narrator (Web Audio, per-cue playback rate, missing clips resolve at once,
  blocked audio cannot stall the game) and synthesized sound effects.
- `src/hub/`: Hub bootstrap and bridge.
