import fs from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { seed, shopWith } from './helpers'

// The pace after a right bell (§3.2 and §8.4), on a paused fake clock with `?pace=1` (silent, but
// every recorded clip takes its real length), so what is measured is real playback time, the same
// in every browser and on any machine:
//   - after a right «طلب», the next order is usable within 3 s;
//   - after a right ready box, the receipt stays from the first word of its sentence until at least
//     1.2 s after the last, and the next order is usable within 1.5 s of the receipt leaving.

const STEP = 20
const manifest = JSON.parse(fs.readFileSync('public/audio/manifest.json', 'utf8')) as { clips: Record<string, { durationMs: number }> }
/** Joined clips hand over this much before their file ends (src/audio/player.ts). */
const JOIN_OVERLAP_MS = 70

interface State {
  customer: number
  ready: boolean
  n: number
  a: number
  b: number
  type: string
  good: string
  receipt: boolean
  time: number
}

async function state(page: Page): Promise<State> {
  return page.evaluate(() => {
    const d = document.querySelector<HTMLElement>('.shop')?.dataset ?? {}
    return {
      customer: d.customer ? Number(d.customer) : -1,
      ready: d.ready === '1',
      n: Number(d.n),
      a: Number(d.a),
      b: Number(d.b),
      type: d.order ?? '',
      good: d.good ?? '',
      // What the sentence is about: the receipt (not an order card), or a delivery's ticket once its
      // sum is shown (the street itself may stay for the next delivery).
      receipt: document.querySelector('.receipt:not(.is-card):not(.ticket-receipt)') !== null || document.querySelector('.ticket-receipt .chip-sum') !== null,
      time: Date.now(),
    }
  })
}

async function runUntil(page: Page, done: (s: State) => boolean, limit = 60_000, watch?: (s: State) => void): Promise<State> {
  for (let elapsed = 0; ; elapsed += STEP) {
    const s = await state(page)
    watch?.(s)
    if (done(s)) return s
    if (elapsed >= limit) throw new Error(`the clock ran ${limit} ms without getting there: ${JSON.stringify(s)}`)
    await page.clock.runFor(STEP)
  }
}

const cases = [
  ...([1, 2, 3] as const).map((level) => ({ name: `«طلب» level ${level}`, shop: shopWith({ only: 'A', levels: { A: level } }) })),
  ...([1, 2, 3] as const).map((level) => ({ name: `ready box level ${level}`, shop: shopWith({ only: 'C', levels: { C: level } }) })),
  { name: 'a mixed day', shop: shopWith({ levels: { A: 2, C: 2 } }) },
  ...([1, 3] as const).map((level) => ({ name: `«كيسين» level ${level}`, shop: shopWith({ only: 'B', levels: { B: level } }) })),
  ...([1, 2, 3] as const).map((level) => ({ name: `«توصيل» level ${level}`, shop: shopWith({ only: 'D', levels: { D: level } }) })),
  ...([1, 3] as const).map((level) => ({ name: `«كيس واحد» level ${level}`, shop: shopWith({ only: 'E', levels: { E: level } }) })),
  { name: 'everything has arrived', shop: shopWith({ arrived: ['A', 'C', 'B', 'D', 'E'], levels: { A: 2, B: 2, C: 2, D: 2, E: 2 } }) },
  { name: 'everything in competition', shop: shopWith({ arrived: ['A', 'C', 'B', 'D', 'E'], levels: { A: 3, B: 3, C: 3, D: 3, E: 3 }, compete: true }) },
]

for (const { name, shop } of cases) {
  test(`pace after a right bell: ${name}`, async ({ page }, info) => {
    test.skip(!info.project.name.endsWith('ipad-landscape'), 'the clock is the same at every size')
    await page.clock.install({ time: 0 })
    await page.clock.pauseAt(1000)
    await seed(page, shop)
    await page.goto('/?pace=1&seed=12')
    await runUntil(page, () => true)
    await page.getByRole('button', { name: 'مسكر' }).click()
    const results: string[] = []
    for (let k = 0; k < 4; k += 1) {
      const s = await runUntil(page, (x) => x.customer === k && x.ready)
      if (s.type === 'D') {
        // Training: along the trail; competition: straight to the door.
        if ((await page.locator('.shop').getAttribute('data-mode')) === 'help') {
          for (let i = 0; i < s.b; i += 1) {
            await page.locator('[data-scooter]').click()
            await page.clock.runFor(600)
          }
        }
      } else if (s.type !== 'E') {
        const source = page.locator(`[data-src="${s.good}"]`)
        for (let i = 0; i < s.n - (s.type === 'C' ? s.a : 0); i += 1) {
          await source.click()
          await page.clock.runFor(300)
        }
      }
      await page.clock.runFor(5000)
      const bell = (await state(page)).time
      if (s.type === 'D') await page.locator(`[data-door="${s.n}"]`).click()
      else if (s.type === 'E') await page.locator(`[data-sticker-n="${s.n}"]`).click()
      else await page.locator('[data-bell]').click()
      if (s.type === 'A') {
        const next = await runUntil(page, (x) => x.customer === k + 1 && x.ready, 20_000)
        const ms = next.time - bell
        results.push(`A→${next.type}: ${(ms / 1000).toFixed(2)} s`)
        expect(ms, results.at(-1)).toBeLessThanOrEqual(3000)
        continue
      }
      // The receipt: shown, said in full, kept 1.2 s more, then the next order within 1.5 s.
      let shownAt = -1
      let goneAt = -1
      const next = await runUntil(
        page,
        (x) => x.customer === k + 1 && x.ready,
        30_000,
        (x) => {
          if (x.receipt && shownAt < 0) shownAt = x.time
          if (!x.receipt && shownAt >= 0 && goneAt < 0) goneAt = x.time
        },
      )
      const log = await page.evaluate(() => (window as unknown as { __paceLog: { clip: string; at: number }[] }).__paceLog)
      // Two bags, everything in the right one (where pieces go first): its receipt reads «n + 0 = n».
      const [ra, rb] = s.type === 'B' ? [s.n, 0] : [s.a, s.b]
      const sentence = [`ar/n/${ra}`, 'ar/ui/plus', `ar/n/${rb}`, 'ar/ui/equal', `ar/n/${s.n}`]
      const afterBell = log.filter((e) => e.at >= bell)
      const start = afterBell.findIndex((e, i) => sentence.every((clip, j) => afterBell[i + j]?.clip === clip))
      expect(start, `the receipt sentence was said: ${afterBell.map((e) => e.clip).join(' ')}`).toBeGreaterThanOrEqual(0)
      const firstWord = afterBell[start]!.at
      const last = afterBell[start + 4]!
      const lastEnds = last.at + (manifest.clips[last.clip]?.durationMs ?? 0) - JOIN_OVERLAP_MS
      // (sampled every STEP ms: shown within the same step as the first word)
      expect(shownAt, 'the receipt is on screen from its first word').toBeLessThanOrEqual(firstWord + STEP)
      expect(goneAt - lastEnds, 'the receipt stays at least 1.2 s after the last word').toBeGreaterThanOrEqual(1200 - STEP)
      const ms = next.time - goneAt
      results.push(`${s.type}→${next.type}: receipt ${((goneAt - shownAt) / 1000).toFixed(2)} s, next ${(ms / 1000).toFixed(2)} s after it left`)
      expect(ms, results.at(-1)).toBeLessThanOrEqual(1500)
    }
    console.log(`PACE ${name}: ${results.join(' · ')}`)
  })
}
