import { expect, test, type Page } from '@playwright/test'
import { STORAGE_KEY, nextOrder, nothingClipped, openShop, packTo, playDay, seed, shopWith } from './helpers'

const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? [])

for (const level of [1, 2, 3] as const) {
  test(`a day of «كيسين» at level ${level}: one good in two bags, the number house stamps its rows, a mismatch fixed`, async ({ page }) => {
    await seed(page, shopWith({ only: 'B', levels: { B: level } }))
    await openShop(page, `?fast=1&seed=${50 + level}`)
    const orders = await playDay(page, [0])
    const ns = level === 1 ? [4, 5] : level === 2 ? [6, 7, 8] : [9, 10]
    for (const o of orders) {
      expect(o.type).toBe('B')
      expect(ns).toContain(o.n)
      expect(['choc', 'candy', 'takis']).toContain(o.good)
    }
    const progress = await saved(page)
    // Training: the houses fill, the board does not move.
    expect(progress.points).toBe(0)
    const stamped = Object.values(progress.houses as Record<string, { found: number[] }>).reduce((sum, h) => sum + h.found.length, 0)
    expect(stamped).toBeGreaterThanOrEqual(1)
    const all = (await spoken(page)).join(' ')
    expect(all).toContain(`ar/c/want ar/n/${orders[1]!.n} ar/c/p-${orders[1]!.good} ar/c/two-bags`)
    expect(all).not.toContain('mix')
  })
}

test('«كيسين»: each piece drops into the bag tapped last; the house and the receipt keep the right bag on the right', async ({ page }) => {
  await seed(page, shopWith({ only: 'B', levels: { B: 2 }, seen: ['g/goal', 'g/open', 'g/train', 'g/ring-bell'] }))
  await openShop(page, '?fast=1&seed=4')
  const order = await nextOrder(page, -1)
  await expect(page.locator('[data-bag="right"]')).toHaveClass(/is-picked/)
  // The right bag stands on the right.
  const right = (await page.locator('[data-bag="right"]').boundingBox())!
  const left = (await page.locator('[data-bag="left"]').boundingBox())!
  expect(right.x).toBeGreaterThan(left.x)
  await packTo(page, order, order.n, 1)
  await expect(page.locator('[data-bag="right"] [data-bag-piece]')).toHaveCount(1)
  await expect(page.locator('[data-bag="left"] [data-bag-piece]')).toHaveCount(order.n - 1)
  // A tap on a piece takes it back.
  await page.locator('[data-bag="left"] [data-bag-piece]').first().click()
  await expect(page.locator('.shop')).toHaveAttribute('data-packed', String(order.n - 1))
  await page.locator(`[data-src="${order.good}"]`).click()
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
  const progress = await saved(page)
  expect(progress.houses[String(order.n)].found).toEqual([1])
  expect(await spoken(page)).toEqual(expect.arrayContaining(['ar/g/two-bags', 'ar/g/two-bags-new']))
})

test('a full number house in competition: the roof turns gold and pays five more points', async ({ page }) => {
  await seed(page, shopWith({ only: 'B', levels: { B: 1 }, compete: true, houses: { 4: { found: [0, 1, 3, 4] }, 5: { found: [0, 1, 2, 4, 5] } } }))
  await openShop(page, '?fast=1&seed=3')
  const order = await nextOrder(page, -1)
  expect(order.mode).toBe('compete')
  // Pack the one missing split: 2 + 2 for four, 3 + 2 for five (the right bag first).
  await packTo(page, order, order.n, order.n === 4 ? 2 : 3)
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
  const progress = await saved(page)
  expect(progress.houses[String(order.n)].full).toBe(true)
  expect(progress.points).toBe(2 + 1 + 5)
  expect(await spoken(page)).toContain('ar/g/house-done')
})

for (const level of [1, 2, 3] as const) {
  test(`a day of «توصيل» at level ${level}: houses left to right, rides, a wrong door counted with her`, async ({ page }) => {
    await seed(page, shopWith({ only: 'D', levels: { D: level } }))
    await openShop(page, `?fast=1&seed=${60 + level}`)
    const first = await nextOrder(page, -1)
    expect(first.type).toBe('D')
    // The street runs left to right, ٠ on the left; no arc before she rides.
    const zero = (await page.locator('[data-door="0"]').boundingBox())!
    const ten = (await page.locator('[data-door="10"]').boundingBox())!
    expect(zero.x).toBeLessThan(ten.x)
    await expect(page.locator('.street .arc')).toHaveCount(0)
    await expect(page.locator('.street')).toHaveAttribute('data-pos', String(first.a))
    await nothingClipped(page)
    const orders = await playDay(page, [0])
    for (const o of orders) {
      expect(o.type).toBe('D')
      expect(o.n).toBeLessThanOrEqual(level === 1 ? 7 : 10)
    }
    const said = await spoken(page)
    expect(said.some((c) => c.startsWith('ar/c/not-my-house-'))).toBe(true)
    expect(said.filter((c) => c === 'ar/c/delivered')).toHaveLength(5)
    // Training: the trail and the house numbers, and the board stays.
    expect((await saved(page)).points).toBe(0)
  })
}

test('«توصيل» in competition: no trail, no house numbers said, a wrong door costs two points', async ({ page }) => {
  await seed(page, shopWith({ only: 'D', levels: { D: 2 }, compete: true, points: 10, seen: ['g/goal', 'g/open', 'g/delivery', 'g/door'] }))
  await openShop(page, '?fast=1&seed=7')
  const order = await nextOrder(page, -1)
  await expect(page.locator('.street')).toHaveAttribute('data-mode', 'compete')
  await expect(page.locator('.street .trail-candy')).toHaveCount(0)
  await expect(page.locator('.street [data-stake] .coin')).toHaveCount(2)
  const before = (await spoken(page)).length
  await page.locator('[data-scooter]').click()
  await expect(page.locator('.street')).toHaveAttribute('data-pos', String(order.a + 1))
  expect((await spoken(page)).slice(before).filter((c) => c.startsWith('ar/n/'))).toEqual([])
  // A wrong door: −2 at once; then the ride back, house by house, aloud.
  const wrong = order.n < 10 ? order.n + 1 : order.n - 1
  await page.locator(`[data-door="${wrong}"]`).click()
  await expect(page.locator('[data-board] .pb-num')).toHaveAttribute('data-points', '8')
  await expect(page.locator(`[data-door="${order.n}"]`)).toHaveClass(/guide/)
  await page.locator(`[data-door="${order.n}"]`).click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(8)
  expect(await spoken(page)).toContain('ar/g/points-no')
})

for (const level of [1, 2, 3] as const) {
  test(`a day of «كيس واحد» at level ${level}: the sticker roll, a wrong sticker peels off`, async ({ page }) => {
    await seed(page, shopWith({ only: 'E', levels: { E: level } }))
    await openShop(page, `?fast=1&seed=${70 + level}`)
    const first = await nextOrder(page, -1)
    expect(first.type).toBe('E')
    // The roll runs left to right like the number line.
    const s0 = (await page.locator('[data-sticker-n="0"]').boundingBox())!
    const s10 = (await page.locator('[data-sticker-n="10"]').boundingBox())!
    expect(s0.x).toBeLessThan(s10.x)
    await nothingClipped(page)
    const orders = await playDay(page, [0])
    for (const o of orders) {
      expect(o.type).toBe('E')
      expect(o.a + o.b).toBe(o.n)
    }
    expect((await saved(page)).points).toBe(0)
    expect((await spoken(page)).join(' ')).toContain(`ar/c/may-i ar/n/${orders[1]!.a} ar/ui/plus ar/n/${orders[1]!.b}`)
  })
}

test('«كيس واحد» in training: loose pieces count on from the box, the box opens when tapped', async ({ page }) => {
  await seed(page, shopWith({ only: 'E', levels: { E: 2 }, points: 20 }))
  await openShop(page, '?fast=1&seed=5')
  const order = await nextOrder(page, -1)
  await expect(page.locator('[data-second-bag]')).toHaveCount(0)
  await page.locator('[data-loose]').first().click()
  // The box holds the first number on the card; the first loose piece is one more.
  expect((await spoken(page)).at(-1)).toBe(`ar/n/${order.a + 1}`)
  await page.locator(`[data-sticker-n="${order.n}"]`).click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(20)
})

test('«كيس واحد» in competition: a second closed bag that only wobbles, the box only wobbles, +2', async ({ page }) => {
  await seed(page, shopWith({ only: 'E', levels: { E: 3 }, compete: true }))
  await openShop(page, '?fast=1&seed=5')
  const order = await nextOrder(page, -1)
  await expect(page.locator('[data-loose]')).toHaveCount(0)
  const before = (await spoken(page)).length
  await page.locator('[data-second-bag]').click()
  await page.locator('[data-box]').click()
  await expect(page.locator('[data-loose]')).toHaveCount(0)
  await expect(page.locator('[data-in-box]')).toHaveCount(0)
  expect((await spoken(page)).slice(before)).toEqual([])
  await page.locator(`[data-sticker-n="${order.n}"]`).click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(2)
})

test('arrivals: two bags come after a good day; a new customer is announced', async ({ page }) => {
  await seed(page, shopWith({ arrived: ['A', 'C'], served: 4, day: 3, seen: ['g/goal', 'g/open', 'g/train', 'g/tap-jar', 'g/take-out', 'g/ring-bell', 'g/ready-box', 'g/tap-box', 'g/new-day'] }))
  await openShop(page)
  await playDay(page)
  const progress = await saved(page)
  expect(progress.pendingArrival).toBe('B')
  await page.getByRole('button', { name: 'يوم جديد' }).click()
  const first = await nextOrder(page, -1)
  expect(first.type).toBe('B')
  // Five customers served: the hedgehog knows the shop now, and is announced when it comes.
  let previous = first
  const { serve } = await import('./helpers')
  await serve(page, first)
  for (let i = 0; i < 2; i += 1) {
    previous = await nextOrder(page, previous.customer)
    await serve(page, previous)
  }
  const said = await spoken(page)
  expect(said).toContain('ar/g/two-bags')
  expect(said).toContain('ar/g/new-customer')
  expect((await saved(page)).met).toContain('hedgehog')
})

test("the parents' page: every order type with its mode and level, switches for each", async ({ page }) => {
  await seed(page, shopWith({ arrived: ['A', 'C', 'B', 'D', 'E'] }))
  await openShop(page)
  await nextOrder(page, -1)
  const box = (await page.locator('.hold-button').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(2300)
  await page.mouse.up()
  for (const t of ['A', 'B', 'C', 'D', 'E']) await expect(page.locator(`[data-parent-order="${t}"]`)).toContainText('تدريب · المستوى')
  await expect(page.locator('[data-parent-rule]')).toContainText('ينقص')
  // Moving a type to competition by hand, and back.
  await page.locator('[data-mode-switch="D"]').click()
  expect((await saved(page)).types.D.mode).toBe('compete')
  await expect(page.locator('[data-parent-order="D"]')).toContainText('منافسة')
  await page.locator('[data-mode-switch="D"]').click()
  expect((await saved(page)).types.D.mode).toBe('help')
  await page.locator('[data-type-switch="A"]').click()
  expect((await saved(page)).disabled).toContain('A')
  await page.locator('[data-type-switch="A"]').click()
  expect((await saved(page)).disabled).not.toContain('A')
})
