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

/**
 * A shop where the ready box has arrived; `only` keeps one order type. Every type is in training
 * unless `modes` (or `compete: true`, for all of them) says competition.
 */
type T = 'A' | 'B' | 'C' | 'D' | 'E'
type M = 'help' | 'compete'
export function shopWith(
  options: {
    only?: T
    levels?: Partial<Record<T, 1 | 2 | 3>>
    modes?: Partial<Record<T, M>>
    compete?: boolean
    points?: number
    day?: number
    closings?: number
    arrived?: T[]
    served?: number
    houses?: Record<string, { found: number[] }>
    seen?: string[]
  } = {},
) {
  const arrived = options.arrived ?? (options.only && !['A', 'C'].includes(options.only) ? ['A', 'C', 'B', 'D', 'E'] : ['A', 'C'])
  return {
    day: options.day ?? 3,
    points: options.points ?? 0,
    closings: options.closings ?? 3,
    served: options.served ?? 4,
    arrived,
    disabled: options.only ? (['A', 'B', 'C', 'D', 'E'] as T[]).filter((t) => t !== options.only) : [],
    types: Object.fromEntries(
      (['A', 'B', 'C', 'D', 'E'] as T[]).map((t) => [t, { level: options.levels?.[t] ?? 1, history: [] as boolean[], served: 3, mode: options.modes?.[t] ?? (options.compete ? 'compete' : 'help'), modeHistory: [] as boolean[] }]),
    ),
    houses: options.houses ?? {},
    seen: options.seen ?? [
      'g/goal',
      'g/open',
      'g/train',
      'g/tap-jar',
      'g/take-out',
      'g/ring-bell',
      'g/ready-box',
      'g/tap-box',
      'g/new-day',
      'g/compete',
      'g/points-yes',
      'g/points-no',
      'g/two-bags',
      'g/two-bags-new',
      'g/delivery',
      'g/ride',
      'g/door',
      'g/sticker',
    ],
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

const shop = (page: Page) => page.locator('.shop')

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

/**
 * Taps the source until the box holds `count`. Two bags: `right` pieces into the right bag (half,
 * rounded up, unless given), the rest into the left one.
 */
export async function packTo(page: Page, order: OrderInfo, count: number, right = Math.ceil(count / 2)) {
  const packed = async () => Number(await shop(page).getAttribute('data-packed'))
  const source = page.locator(`[data-src="${order.good}"]`)
  if (order.type === 'B') {
    const inBag = (side: string) => page.locator(`[data-bag="${side}"] [data-bag-piece]`).count()
    await page.locator('[data-bag-pick="right"]').click()
    for (let guard = 0; guard < 12 && (await inBag('right')) < Math.min(right, count); guard += 1) await source.click()
    await page.locator('[data-bag-pick="left"]').click()
    for (let guard = 0; guard < 12 && (await packed()) < count; guard += 1) await source.click()
    for (let guard = 0; guard < 12 && (await packed()) > count; guard += 1) await page.locator('.two-bags [data-bag-piece]').last().click()
  } else {
    for (let guard = 0; guard < 12 && (await packed()) < count; guard += 1) await source.click()
    for (let guard = 0; guard < 12 && (await packed()) > count; guard += 1) {
      await page.locator(order.type === 'A' ? '.tray [data-piece]' : '.side-tray [data-side-piece]').last().click()
    }
  }
  await expect(shop(page)).toHaveAttribute('data-packed', String(count))
}

/**
 * Serves the customer on screen. `mismatch`: first ring with one too many (or one too few), check
 * the customer peeks and counts, then fix it and ring again.
 */
export async function serve(page: Page, order: OrderInfo, mismatch = false) {
  if (order.type === 'D') return deliver(page, order, mismatch)
  if (order.type === 'E') return sticker(page, order, mismatch)
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

/** Plays a whole day; returns the orders seen. */
export async function playDay(page: Page, mismatches: number[] = []): Promise<OrderInfo[]> {
  const seen: OrderInfo[] = []
  let previous = -1
  for (let i = 0; i < 5; i += 1) {
    const order = await nextOrder(page, previous)
    seen.push(order)
    await serve(page, order, mismatches.includes(order.customer))
    previous = order.customer
  }
  await expect(page.getByRole('button', { name: 'يوم جديد' }).or(page.locator('.coupon-overlay'))).toBeVisible()
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
    document.querySelectorAll('button, .candy:not(.flying), .order-bubble, .packing-box, .ready-zone, .receipt, .prize-board, .takis-bag').forEach((node) => {
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

/** «توصيل»: ride (levels 1-2) and tap the door; `wrong`: a wrong door first. */
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

/** «كيس واحد»: tap the sticker of the total; `wrong`: a wrong sticker first. */
export async function sticker(page: Page, order: OrderInfo, wrong = false) {
  if (wrong) {
    const bad = order.n < 10 ? order.n + 1 : order.n - 1
    await page.locator(`[data-sticker-n="${bad}"]`).click()
    await expect(shop(page)).toHaveAttribute('data-phase', /checking|packing/)
    await expect(shop(page)).toHaveAttribute('data-phase', 'packing')
    await expect(page.locator(`[data-sticker-n="${bad}"]`)).toHaveClass(/is-peeled/)
  }
  await page.locator(`[data-sticker-n="${order.n}"]`).click()
}
