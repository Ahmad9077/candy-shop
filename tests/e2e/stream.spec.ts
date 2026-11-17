// One continuous stream of the ready box (DESIGN.md §12.1, §11.4, §11.5): no days, no rounds, the
// goal of 100 told as the points land.
import { expect, test, type Page } from '@playwright/test'
import { holdParents, nextOrder, noHorizontalScroll, nothingClipped, openShop, packTo, playStream, saved, seed, serve, shop, shopWith, spoken, type OrderInfo } from './helpers'

/** Packs the order right and rings. */
const rightAway = async (page: Page, order: OrderInfo) => {
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
}

test('a new shop: the challenge of 100, then customers one after another, all ready boxes, no day ends', async ({ page }) => {
  await openShop(page)
  // The challenge first, then the shop opens for the first customer.
  await expect.poll(() => spoken(page)).toContain('ar/g/open')
  const said = await spoken(page)
  expect(said.indexOf('ar/g/goal')).toBeGreaterThanOrEqual(0)
  expect(said.indexOf('ar/g/goal')).toBeLessThan(said.indexOf('ar/g/open'))
  await expect(shop(page)).toHaveAttribute('data-time', '1')
  const orders = await playStream(page, 7, [2])
  for (const o of orders) {
    expect(o.type).toBe('C')
    expect(o.a).toBeGreaterThanOrEqual(o.b)
    expect(o.n).toBeLessThanOrEqual(10)
  }
  for (let i = 1; i < orders.length; i += 1) expect(orders[i]!.good).not.toBe(orders[i - 1]!.good)
  // The eighth customer is already on the way: nothing closes, nothing asks for a new day.
  await nextOrder(page, orders.at(-1)!.customer)
  await expect(page.getByRole('button', { name: 'يوم جديد' })).toHaveCount(0)
  await expect(page.locator('.sticker-roll, .paper-bag, [data-loose]')).toHaveCount(0)
  const all = await spoken(page)
  const words = { choc: 'c/p-choc', candy: 'c/p-candy', takis: 'c/p-takis' } as Record<string, string>
  for (const o of orders) expect(all.join(' ')).toContain(`ar/c/want ar/n/${o.n} ar/${words[o.good]}`)
  // The first-time lines of the ready box, once each, in order.
  for (const id of ['ar/g/train', 'ar/g/ready-box', 'ar/g/count-on', 'ar/g/ring-bell']) expect(all.filter((c) => c === id), id).toHaveLength(1)
  expect(all.indexOf('ar/g/ready-box')).toBeLessThan(all.indexOf('ar/g/count-on'))
  expect(all.indexOf('ar/g/count-on')).toBeLessThan(all.indexOf('ar/g/ring-bell'))
  // Her name: the very first customer greets her (none served before).
  expect(all).toContain('ar/c/hi-dima')
  for (const gone of ['ar/g/closed', 'ar/g/new-day', 'ar/g/points-no', 'ar/g/sticker', 'ar/g/hold', 'ar/g/pick', 'ar/c/may-i']) expect(all, gone).not.toContain(gone)
  const progress = await saved(page)
  expect(progress.served).toBe(7)
  expect(progress.points).toBe(0)
  expect(progress.rev).toBe(3)
  expect(Object.keys(progress)).not.toContain('today')
  expect(Object.keys(progress.types)).toEqual(['A', 'C', 'D'])
  // Four of five right first tries in training: training → the bridge, with its line.
  expect(all).toContain('ar/g/bridge')
  expect(progress.types.C.mode).toBe('bridge')
})

test('a reload simply opens the shop with a fresh customer; what was earned is kept', async ({ page }) => {
  await seed(page, shopWith({ compete: true, points: 10 }))
  await openShop(page)
  const [first] = await playStream(page, 1)
  await nextOrder(page, first!.customer)
  expect((await saved(page)).points).toBe(12)
  await page.reload()
  await page.getByRole('button', { name: 'مسكر' }).click()
  const fresh = await nextOrder(page, -1)
  expect(fresh.customer).toBe(0)
  expect(fresh.type).toBe('C')
  await expect(page.locator('[data-board] .pb-num')).toHaveAttribute('data-points', '12')
})

test('a newcomer walks in right after joining, announced once; her name now and then', async ({ page }) => {
  await seed(page, shopWith({ served: 4, met: ['rabbit', 'cat', 'duck'] }))
  await openShop(page)
  const [first] = await playStream(page, 1)
  expect(first).toBeDefined()
  await nextOrder(page, first!.customer)
  const said = await spoken(page)
  expect(said.filter((c) => c === 'ar/g/new-customer')).toHaveLength(1)
  expect((await saved(page)).met).toContain('hedgehog')
  await expect(page.locator('.customer-spot:not(.is-leaving) .customer-hedgehog')).toBeVisible()
  // Three more: the one served after seven before it is thanked by name.
  await playStream(page, 3)
  await expect.poll(() => spoken(page)).toContain('ar/c/thanks-dima')
})

test('a milestone opens the big board by itself, after the receipt has been read', async ({ page }) => {
  await seed(page, shopWith({ compete: true, points: 24 }))
  // Real speed: the receipt is read, then the board stays a few seconds.
  await openShop(page, '?seed=7')
  const order = await nextOrder(page, -1)
  await rightAway(page, order)
  await expect(page.locator('.receipt')).toBeVisible()
  await expect(page.locator('.board-overlay')).toBeVisible()
  // Never over the receipt: it has gone by the time the board opens.
  await expect(page.locator('.receipt')).toHaveCount(0)
  await expect(page.locator('.board-overlay .pb-num')).toHaveAttribute('data-points', '26')
  await expect(page.locator('.board-overlay .pb-step.on')).toHaveCount(5)
  await expect(page.locator('.board-overlay .pb-step')).toHaveCount(20)
  await nextOrder(page, order.customer)
  await expect(page.locator('.board-overlay')).toHaveCount(0)
})

test('the milestone line is said after the receipt sentence', async ({ page }) => {
  await seed(page, shopWith({ compete: true, points: 48 }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  await rightAway(page, order)
  await nextOrder(page, order.customer)
  const said = await spoken(page)
  const receipt = said.join(' ').lastIndexOf(`ar/n/${order.a} ar/ui/plus ar/n/${order.b} ar/ui/equal ar/n/${order.n}`)
  expect(receipt).toBeGreaterThanOrEqual(0)
  expect(said.join(' ').indexOf('ar/g/goal-50')).toBeGreaterThan(receipt)
})

test('every other ten: one «near» line from the guide, without the board', async ({ page }) => {
  await seed(page, shopWith({ compete: true, points: 8 }))
  await openShop(page)
  const [first] = await playStream(page, 1)
  await nextOrder(page, first!.customer)
  const said = await spoken(page)
  expect(said.filter((c) => /^ar\/g\/near-\d$/.test(c))).toHaveLength(1)
  expect((await saved(page)).nearSaid).toBe(1)
  await expect(page.locator('.board-overlay')).toHaveCount(0)
})

test('reaching 100: the coupon; orders go on, the counter stays; «تصفير الرصيد» brings it back to 0', async ({ page }) => {
  await seed(page, shopWith({ compete: true, points: 98 }))
  await openShop(page)
  const first = await nextOrder(page, -1)
  await rightAway(page, first)
  await expect(page.locator('.coupon-overlay')).toBeVisible()
  await expect(page.locator('.coupon-card')).toContainText('ديما جمعت ١٠٠ نقطة بدون مساعدة')
  expect(await spoken(page)).toContain('ar/g/goal-100')
  expect(await saved(page)).toMatchObject({ points: 100, won: true })
  await page.getByRole('button', { name: 'نرجع البقالة' }).click()
  await expect(page.locator('.coupon-overlay')).toHaveCount(0)
  await expect(page.locator('[data-board] .pb-ticket')).toBeVisible()
  // Orders go on; a right one in competition does not move the counter.
  const second = await nextOrder(page, first.customer)
  await rightAway(page, second)
  const third = await nextOrder(page, second.customer)
  expect((await saved(page)).points).toBe(100)
  // The small board shows the coupon again, and back to her order.
  await page.locator('[data-board]').click()
  await expect(page.locator('.coupon-overlay')).toBeVisible()
  await page.getByRole('button', { name: 'نرجع البقالة' }).click()
  await expect(shop(page)).toHaveAttribute('data-ready', '1')
  await expect(shop(page)).toHaveAttribute('data-customer', String(third.customer))
  await holdParents(page)
  await expect(page.locator('[data-parent-points]')).toHaveAttribute('data-parent-points', '100')
  await page.getByRole('button', { name: 'تصفير الرصيد' }).click()
  await page.getByRole('button', { name: 'نعم، نصفر الرصيد' }).click()
  await expect(page.locator('[data-parent-points]')).toHaveAttribute('data-parent-points', '0')
  expect(await saved(page)).toMatchObject({ points: 0, won: false, epoch: 1 })
})

test('an earlier save keeps her points and starts the ready box in training, its guides told again', async ({ page }) => {
  await seed(page, { day: 6, points: 150, won: false, closings: 5, served: 30, arrived: ['A', 'C', 'B', 'D', 'E'], types: { C: { level: 3, history: [], served: 9, mode: 'compete', modeHistory: [] } }, houses: { 5: { found: [1] } }, seen: ['g/goal', 'g/open', 'g/train', 'g/ready-box', 'g/tap-box'], voice: true, disabled: [], today: null })
  await openShop(page)
  const order = await nextOrder(page, -1)
  expect(order).toMatchObject({ type: 'C', mode: 'help', level: 1 })
  const progress = await saved(page)
  expect(progress).toMatchObject({ rev: 3, points: 100, won: true, served: 30, disabled: ['A', 'D'] })
  await expect.poll(() => spoken(page)).toContain('ar/g/ready-box')
  expect(await spoken(page)).toContain('ar/g/goal')
})

test('nothing clipped at 1024×768 either, through a reveal and a receipt', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await seed(page, shopWith({ levels: { C: 3 } }))
  await openShop(page, '?seed=5')
  const order = await nextOrder(page, -1)
  await noHorizontalScroll(page)
  await nothingClipped(page)
  await serve(page, order, true)
  await expect(page.locator('.receipt')).toBeVisible()
  await nothingClipped(page)
})

test('fast taps: every tap one piece; a double ring, one hand-over', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 2 }, compete: true }))
  await openShop(page, '?seed=40')
  const order = await nextOrder(page, -1)
  for (let i = 0; i < order.b; i += 1) await page.locator(`[data-src="${order.good}"]`).click({ noWaitAfter: true })
  await expect(shop(page)).toHaveAttribute('data-packed', String(order.n))
  await page.locator('[data-bell]').dblclick()
  await nextOrder(page, order.customer)
  expect((await saved(page)).served).toBe(5)
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
  await page.locator('[data-box]').click()
  await rightAway(page, order)
  await nextOrder(page, order.customer)
})
