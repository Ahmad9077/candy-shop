import { expect, test, type Page } from '@playwright/test'
import { STORAGE_KEY, nextOrder, noHorizontalScroll, nothingClipped, openShop, packTo, playDay, seed, serve, shopWith } from './helpers'

const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? [])

test('the first opening shows the challenge, then a training day of «طلب» across the three goods', async ({ page }) => {
  await openShop(page)
  const said = await spoken(page)
  // The big board and «g/goal» come before the first customer and «g/open».
  expect(said.indexOf('ar/g/goal')).toBeGreaterThanOrEqual(0)
  expect(said.indexOf('ar/g/goal')).toBeLessThan(said.indexOf('ar/g/open'))
  const orders = await playDay(page, [1])
  expect(orders.map((o) => o.type)).toEqual(['A', 'A', 'A', 'A', 'A'])
  expect(new Set(orders.map((o) => o.good)).size).toBeGreaterThanOrEqual(2)
  for (let i = 1; i < orders.length; i += 1) expect(orders[i]!.good).not.toBe(orders[i - 1]!.good)
  const all = await spoken(page)
  // The order: «أبي» + number + the good.
  for (const o of orders) expect(all.join(' ')).toContain(`ar/c/want ar/n/${o.n} ar/c/p-${o.good}`)
  // Training: Dabdoob counts with her (the count is said on the taps), no points. «g/train» once;
  // four of five right, so «طلب» enters the competition after the fifth (the board lights up).
  for (const id of ['ar/g/train', 'ar/g/compete', 'ar/g/closed', 'ar/g/goal']) expect(all.filter((c) => c === id), id).toHaveLength(1)
  expect(all.indexOf('ar/g/train')).toBeLessThan(all.indexOf('ar/g/compete'))
  expect(all).toContain('ar/n/1')
  for (const id of ['ar/g/points-yes', 'ar/g/points-no', 'ar/g/day-down']) expect(all, id).not.toContain(id)
  // A day with no change: no closing line, and no coins of today on the big board.
  expect(all.some((c) => /^ar\/g\/(near-\d|goal-\d+)$/.test(c))).toBe(false)
  const progress = await saved(page)
  expect(progress.points).toBe(0)
  expect(progress.types.A.mode).toBe('compete')
  await expect(page.locator('.board-overlay .pb-num')).toHaveAttribute('data-points', '0')
  await expect(page.locator('.board-overlay .pb-today')).toHaveCount(0)
  expect(progress.day).toBe(2)
  // A new day: the ready box arrives whatever happened.
  await page.getByRole('button', { name: 'يوم جديد' }).click()
  const first = await nextOrder(page, -1)
  expect(first.type).toBe('C')
  await expect(page.locator('.shop')).toHaveAttribute('data-day', '2')
})

test('a wrong source only wobbles: nothing drops, nothing is lost, the right one pulses', async ({ page }) => {
  await seed(page, shopWith({ only: 'A' }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  expect(order.mode).toBe('help')
  const other = order.good === 'takis' ? 'choc' : 'takis'
  await page.locator(`[data-src="${other}"]`).click()
  await expect(page.locator('.shop')).toHaveAttribute('data-packed', '0')
  await expect(page.locator('.shop')).toHaveAttribute('data-phase', 'packing')
  await expect(page.locator(`[data-src="${order.good}"]`)).toHaveClass(/guide/)
  await serve(page, order)
  await nextOrder(page, order.customer)
  expect((await saved(page)).today.served).toBe(1)
})

for (const level of [1, 2, 3] as const) {
  test(`a competition day of ready boxes at level ${level}: one good per box, −2 for a mismatch, +2 for the rest`, async ({ page }) => {
    await seed(page, shopWith({ only: 'C', levels: { C: level }, compete: true, points: 10 }))
    await openShop(page, `?fast=1&seed=${20 + level}`)
    const orders = await playDay(page, [0])
    for (const o of orders) {
      expect(o.type).toBe('C')
      expect(o.level).toBe(level)
      expect(o.a + o.b).toBe(o.n)
      expect(['choc', 'candy', 'takis']).toContain(o.good)
      expect(o.mode).toBe('compete')
    }
    expect(new Set(orders.map((o) => o.good)).size).toBeGreaterThanOrEqual(2)
    const said = await spoken(page)
    expect(said.join(' ')).toContain(['ar/n/' + orders[1]!.a, 'ar/ui/plus', 'ar/n/' + orders[1]!.b, 'ar/ui/equal', 'ar/n/' + orders[1]!.n].join(' '))
    // 10 − 2 + 4 × 2: today's six coins pulse on the big board, and a «near» line closes the day.
    expect((await saved(page)).points).toBe(16)
    await expect(page.locator('.board-overlay .pb-today')).toHaveAttribute('data-today', '6')
    expect(said.filter((c) => /^ar\/g\/near-\d$/.test(c))).toHaveLength(1)
  })
}

for (const level of [1, 2, 3] as const) {
  test(`a day of «طلب» at level ${level}`, async ({ page }) => {
    await seed(page, shopWith({ only: 'A', levels: { A: level } }))
    await openShop(page, `?fast=1&seed=${30 + level}`)
    const orders = await playDay(page, [2])
    const [min, max] = level === 1 ? [1, 5] : level === 2 ? [3, 10] : [5, 10]
    for (const o of orders) {
      expect(o.n).toBeGreaterThanOrEqual(min)
      expect(o.n).toBeLessThanOrEqual(max)
    }
  })
}

test('every ready box is one good: the same good added on the lime tray, lime rings in the lineup, the good\'s colour then lime on the receipt', async ({ page }) => {
  await seed(page, shopWith({ only: 'C' }))
  await openShop(page, '?seed=2')
  const goods = new Set<string>()
  let previous = -1
  for (let k = 0; k < 3; k += 1) {
    const order = await nextOrder(page, previous)
    goods.add(order.good)
    const flavor = order.good === 'candy' ? 'pink' : order.good
    await packTo(page, order, order.n)
    await expect(page.locator(`.side-tray .candy-${flavor}`)).toHaveCount(order.b)
    await expect(page.locator('.side-tray .candy:not(.candy-' + flavor + ')')).toHaveCount(0)
    await page.locator('[data-bell]').click()
    await expect(page.locator('.receipt:not(.is-card)')).toHaveClass(new RegExp(`receipt-${order.good}`))
    await expect(page.locator('.tray .ring-lime')).toHaveCount(order.b)
    await expect(page.locator(`.tray .candy-${flavor}`)).toHaveCount(order.n)
    await expect(page.locator('.receipt:not(.is-card) .chip-second')).toHaveCSS('background-color', 'rgb(166, 226, 46)')
    previous = order.customer
  }
  expect(goods.size).toBeGreaterThanOrEqual(2)
})

test('reaching 200 at closing: the coupon, then «تحدي جديد» in the parents\' page', async ({ page }) => {
  await seed(page, shopWith({ only: 'A', compete: true, points: 194 }))
  await openShop(page)
  await playDay(page)
  await expect(page.locator('.coupon-overlay')).toBeVisible()
  await expect(page.locator('.coupon-card')).toContainText('ديما جمعت ٢٠٠ نقطة بدون مساعدة')
  expect(await spoken(page)).toContain('ar/g/goal-200')
  const progress = await saved(page)
  expect(progress.points).toBe(200)
  expect(progress.won).toBe(true)
  await page.getByRole('button', { name: 'نرجع البقالة' }).click()
  await expect(page.locator('.coupon-overlay')).toHaveCount(0)
  await expect(page.locator('[data-board] .pb-ticket')).toBeVisible()
  // The small board shows the coupon again.
  await page.getByRole('button', { name: 'يوم جديد' }).click()
  await nextOrder(page, -1)
  await page.locator('[data-board]').click()
  await expect(page.locator('.coupon-overlay')).toBeVisible()
  await page.getByRole('button', { name: 'نرجع البقالة' }).click()
  // The parents start a new challenge: points back to zero, levels kept.
  const box = (await page.locator('.hold-button').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(2300)
  await page.mouse.up()
  await expect(page.locator('[data-parent-points]')).toHaveAttribute('data-parent-points', '200')
  await page.getByRole('button', { name: 'تحدي جديد' }).click()
  await page.getByRole('button', { name: 'نعم، تحدي جديد' }).click()
  await expect(page.locator('[data-parent-points]')).toHaveAttribute('data-parent-points', '0')
  const after = await saved(page)
  expect(after.points).toBe(0)
  expect(after.won).toBe(false)
})

test('nothing clipped at 1024×768 either, with the board and the bag', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await seed(page, shopWith({ only: 'C' }))
  await openShop(page, '?seed=5')
  const order = await nextOrder(page, -1)
  await noHorizontalScroll(page)
  await nothingClipped(page)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(page.locator('.receipt')).toBeVisible()
  await nothingClipped(page)
})

test('fast taps: every tap is one piece, a double ring hands over once', async ({ page }) => {
  await seed(page, shopWith({ only: 'A', levels: { A: 2 }, compete: true }))
  await openShop(page, '?seed=40')
  const order = await nextOrder(page, -1)
  for (let i = 0; i < order.n; i += 1) await page.locator(`[data-src="${order.good}"]`).click({ noWaitAfter: true })
  await expect(page.locator('.shop')).toHaveAttribute('data-packed', String(order.n))
  await page.locator('[data-bell]').dblclick()
  await nextOrder(page, order.customer)
  expect((await saved(page)).today.served).toBe(1)
  expect((await saved(page)).points).toBe(2)
})

test('the game plays with storage blocked and with no clips at all', async ({ page }) => {
  await page.route(/\.mp3(\?|$)/, (route) => route.abort())
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked')
      },
    })
  })
  await openShop(page, '?seed=3')
  await page.locator('.board-overlay').click({ timeout: 10_000 }).catch(() => undefined)
  const order = await nextOrder(page, -1)
  for (let i = 0; i < order.n; i += 1) await page.locator(`[data-src="${order.good}"]`).click()
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
})
