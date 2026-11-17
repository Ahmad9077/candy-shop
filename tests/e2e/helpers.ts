import { expect, type Page } from '@playwright/test'

export const STORAGE_KEY = 'candy-shop:v3'

/** Saves a shop before the page loads (once per test, so reloads keep what the game saved). */
export async function seed(page: Page, progress: Record<string, unknown>) {
  await page.addInitScript(
    ([key, saved]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, saved)
        sessionStorage.setItem('seeded', '1')
      }
    },
    [STORAGE_KEY, JSON.stringify(progress)] as const,
  )
}

type T = 'A' | 'C' | 'D'
type M = 'help' | 'bridge' | 'compete'
export const TYPES: T[] = ['C', 'A', 'D']

/** Every first-time guide line, already said (a test that wants one leaves it out). */
export const ALL_SEEN = ['g/goal', 'g/open', 'g/train', 'g/tap-jar', 'g/take-out', 'g/ring-bell', 'g/ready-box', 'g/tap-box', 'g/compete', 'g/points-yes', 'g/delivery', 'g/ride', 'g/door', 'g/count-on', 'g/bridge']

/**
 * A saved shop (§12 shape). By default the stream is the ready box (C) alone, as a new shop has it;
 * `only` keeps another single type, `on` opens several. Every type is in training unless `modes`
 * (or `compete: true`, for all of them) says otherwise.
 */
export function shopWith(
  options: {
    only?: T
    on?: T[]
    levels?: Partial<Record<T, 1 | 2 | 3>>
    modes?: Partial<Record<T, M>>
    modeHistory?: Partial<Record<T, boolean[]>>
    compete?: boolean
    points?: number
    won?: boolean
    epoch?: number
    served?: number
    met?: string[]
    seen?: string[]
  } = {},
) {
  const on = options.on ?? [options.only ?? 'C']
  return {
    rev: 3,
    points: options.points ?? 0,
    won: options.won ?? false,
    epoch: options.epoch ?? 0,
    nearSaid: 0,
    served: options.served ?? 4,
    disabled: TYPES.filter((t) => !on.includes(t)),
    types: Object.fromEntries(
      TYPES.map((t) => [t, { level: options.levels?.[t] ?? 1, history: [] as boolean[], served: 3, mode: options.modes?.[t] ?? (options.compete ? 'compete' : 'help'), modeHistory: options.modeHistory?.[t] ?? [] }]),
    ),
    missed: {},
    met: options.met ?? ['rabbit', 'cat', 'duck'],
    seen: options.seen ?? ALL_SEEN,
    voice: true,
    batch: { served: 0, firstBells: 0, orders: [] },
  }
}

/** The shop front: tap the sign, in we go. */
export async function openShop(page: Page, query = '?fast=1&seed=7') {
  await page.goto(`/${query}`)
  await page.getByRole('button', { name: 'مسكر' }).click()
  await expect(page.locator('.shop')).toBeVisible()
}

export interface OrderInfo {
  customer: number
  type: string
  level: number
  a: number
  b: number
  n: number
  good: string
  mode: string
}

export const shop = (page: Page) => page.locator('.shop')
export const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
export const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? [])

/** Waits for the customer after `previous` to be ready, and reads the order. */
export async function nextOrder(page: Page, previous: number): Promise<OrderInfo> {
  const ready = page.locator(`.shop[data-ready="1"]:not([data-customer="${previous}"])`)
  await expect(ready).toHaveCount(1)
  const read = async (name: string) => (await ready.getAttribute(`data-${name}`)) ?? ''
  return {
    customer: Number(await read('customer')),
    type: await read('order'),
    level: Number(await read('level')),
    a: Number(await read('a')),
    b: Number(await read('b')),
    n: Number(await read('n')),
    good: await read('good'),
    mode: await read('mode'),
  }
}

/** Taps the source until the box holds `count` (A and C). */
export async function packTo(page: Page, order: OrderInfo, count: number) {
  const packed = async () => Number(await shop(page).getAttribute('data-packed'))
  const source = page.locator(`[data-src="${order.good}"]`)
  for (let guard = 0; guard < 12 && (await packed()) < count; guard += 1) await source.click()
  for (let guard = 0; guard < 12 && (await packed()) > count; guard += 1) {
    await page.locator(order.type === 'A' ? '.tray [data-piece]' : '.side-tray [data-side-piece]').last().click()
  }
  await expect(shop(page)).toHaveAttribute('data-packed', String(count))
}

/**
 * Serves the customer on screen. `mismatch`: first a wrong answer (one too many or one too few),
 * check the pieces show it and her turn comes back, then the right one.
 */
export async function serve(page: Page, order: OrderInfo, mismatch = false) {
  if (order.type === 'D') return deliver(page, order, mismatch)
  if (mismatch) {
    const wrong = order.n < 10 ? order.n + 1 : order.n - 1
    await packTo(page, order, wrong)
    await page.locator('[data-bell]').click()
    await expect(shop(page)).toHaveAttribute('data-phase', /checking|packing/)
    await expect(shop(page)).toHaveAttribute('data-phase', 'packing')
    await expect(shop(page)).toHaveAttribute('data-ready', '1')
  }
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
}

/** Serves `count` customers one after another; returns the orders seen. */
export async function playStream(page: Page, count: number, mismatches: number[] = []): Promise<OrderInfo[]> {
  const seen: OrderInfo[] = []
  let previous = -1
  for (let i = 0; i < count; i += 1) {
    const order = await nextOrder(page, previous)
    seen.push(order)
    await serve(page, order, mismatches.includes(i))
    previous = order.customer
  }
  return seen
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

/** Every visible control and candy is inside the viewport, and nothing scrolls. */
export async function nothingClipped(page: Page) {
  const problems = await page.evaluate(() => {
    const out: string[] = []
    const w = window.innerWidth
    const h = window.innerHeight
    if (document.documentElement.scrollHeight > h + 1) out.push(`page scrolls ${document.documentElement.scrollHeight} > ${h}`)
    if (document.documentElement.scrollWidth > w + 1) out.push(`page scrolls sideways ${document.documentElement.scrollWidth} > ${w}`)
    document.querySelectorAll('button, .candy:not(.flying), .order-bubble, .packing-box, .ready-zone, .sticker-zone, .reveal-tray, .count-chip, .piece-tag, .group-num, .receipt, .prize-board, .takis-bag').forEach((node) => {
      const el = node as HTMLElement
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') return
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      if (r.left < -1 || r.top < -1 || r.right > w + 1 || r.bottom > h + 1) out.push(`${el.className || el.tagName} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`)
    })
    return out
  })
  expect(problems).toEqual([])
}

/** «توصيل»: ride (in training) and tap the door; `wrong`: a wrong door first. */
export async function deliver(page: Page, order: OrderInfo, wrong = false) {
  const street = page.locator('.street')
  await expect(street).toHaveAttribute('data-ready', '1')
  if (wrong) {
    const door = order.n < 10 ? order.n + 1 : order.n - 1
    await page.locator(`[data-door="${door}"]`).click()
    await expect(street).toHaveAttribute('data-pos', String(order.n))
    await expect(street).toHaveAttribute('data-ready', '1')
    await expect(page.locator(`[data-door="${order.n}"]`)).toHaveClass(/guide/)
  } else if (order.mode !== 'compete') {
    // Training: ride along the trail, house by house.
    for (let i = 0; i < order.b; i += 1) await page.locator('[data-scooter]').click()
    await expect(street).toHaveAttribute('data-pos', String(order.n))
  }
  await page.locator(`[data-door="${order.n}"]`).click()
}

/** Holds «للأهل» for `ms`. */
export async function holdParents(page: Page, ms = 2300) {
  const box = (await page.locator('.hold-button').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
}
