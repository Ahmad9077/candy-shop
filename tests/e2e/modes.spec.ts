// Training and competition (DESIGN.md §10.2): the counting help and the points never come together.
import { expect, test, type Page } from '@playwright/test'
import { STORAGE_KEY, nextOrder, openShop, packTo, seed, shopWith } from './helpers'

const saved = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? [])
const board = (page: Page) => page.locator('[data-board] .pb-num')

test('training: Dabdoob leans in and counts, tags and dots help, the board never moves', async ({ page }) => {
  await seed(page, shopWith({ only: 'A', levels: { A: 2 }, points: 30 }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  expect(order.mode).toBe('help')
  await expect(page.locator('.helper .bear')).toHaveClass(/bear-lean/)
  await expect(page.locator('[data-stake]')).toHaveCount(0)
  await expect(page.locator('.order-bubble [data-dots]')).toBeVisible()
  const before = (await spoken(page)).length
  await page.locator(`[data-src="${order.good}"]`).click()
  await page.locator(`[data-src="${order.good}"]`).click()
  await expect(page.locator('.box-count')).toHaveText('٢')
  expect((await spoken(page)).slice(before)).toEqual(['ar/n/1', 'ar/n/2'])
  // A wrong bell: the customer counts with her; nothing leaves the board.
  await page.locator('[data-bell]').click()
  await expect(page.locator('.shop')).toHaveAttribute('data-phase', 'packing')
  await expect(board(page)).toHaveAttribute('data-points', '30')
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(30)
  await expect(board(page)).toHaveAttribute('data-points', '30')
})

test('competition: the stake by the bell, Dabdoob hushed, no tag, no dots, no count said', async ({ page }) => {
  await seed(page, shopWith({ only: 'A', levels: { A: 2 }, compete: true }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  expect(order.mode).toBe('compete')
  await expect(page.locator('[data-stake] .coin')).toHaveCount(2)
  await expect(page.locator('.helper .bear')).toHaveClass(/bear-hush/)
  await expect(page.locator('.order-bubble')).toBeVisible()
  await expect(page.locator('.order-bubble [data-dots]')).toHaveCount(0)
  const before = (await spoken(page)).length
  for (let i = 0; i < 3; i += 1) await page.locator(`[data-src="${order.good}"]`).click()
  await expect(page.locator('.shop')).toHaveAttribute('data-packed', '3')
  await expect(page.locator('.box-count')).toHaveCount(0)
  await expect(page.locator('.piece-tag')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect((await spoken(page)).slice(before).filter((c) => c.startsWith('ar/n/'))).toEqual([])
})

test('competition in the ready box: no tags over the added pieces, the closed box only wobbles', async ({ page }) => {
  await seed(page, shopWith({ only: 'C', compete: true }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  const before = (await spoken(page)).length
  await page.locator('[data-box]').click()
  await expect(page.locator('[data-in-box]')).toHaveCount(0)
  await page.locator(`[data-src="${order.good}"]`).click()
  await expect(page.locator('.side-tray [data-side-piece]')).toHaveCount(1)
  await expect(page.locator('.piece-tag')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect((await spoken(page)).slice(before).filter((c) => c.startsWith('ar/n/'))).toEqual([])
  // The box still shows its label: that is the order itself.
  await expect(page.locator('[data-box]')).toHaveAccessibleName(/العلبة/)
})

test('competition: −2 off the board at a wrong bell, nothing more at the fix, +2 for a right one', async ({ page }) => {
  await seed(page, shopWith({ only: 'A', levels: { A: 2 }, compete: true, points: 10, seen: ['g/goal', 'g/open', 'g/train', 'g/tap-jar', 'g/take-out', 'g/ring-bell', 'g/compete'] }))
  await openShop(page)
  const first = await nextOrder(page, -1)
  await packTo(page, first, first.n - 1)
  await page.locator('[data-bell]').click()
  await expect(board(page)).toHaveAttribute('data-points', '8')
  await expect(page.locator('.board-drop .coin')).toHaveCount(2)
  await expect(page.locator('.shop')).toHaveAttribute('data-phase', 'packing')
  await packTo(page, first, first.n)
  await page.locator('[data-bell]').click()
  const second = await nextOrder(page, first.customer)
  expect((await saved(page)).points).toBe(8)
  await packTo(page, second, second.n)
  await page.locator('[data-bell]').click()
  await nextOrder(page, second.customer)
  await expect(board(page)).toHaveAttribute('data-points', '10')
  expect((await saved(page)).points).toBe(10)
  const said = await spoken(page)
  expect(said.indexOf('ar/g/points-no')).toBeGreaterThanOrEqual(0)
  expect(said.indexOf('ar/g/points-no')).toBeLessThan(said.indexOf('ar/g/points-yes'))
})

test('never below zero', async ({ page }) => {
  await seed(page, shopWith({ only: 'A', compete: true, points: 1 }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.n + 1 > 10 ? order.n - 1 : order.n + 1)
  await page.locator('[data-bell]').click()
  await expect(board(page)).toHaveAttribute('data-points', '0')
  expect((await saved(page)).points).toBe(0)
})

test('dropping back to training after a poor run in competition', async ({ page }) => {
  const shop = shopWith({ only: 'A', compete: true, points: 20 })
  shop.types.A = { ...shop.types.A, modeHistory: [false, false, true, false] }
  await seed(page, shop)
  await openShop(page)
  const first = await nextOrder(page, -1)
  await packTo(page, first, first.n === 10 ? 9 : first.n + 1)
  await page.locator('[data-bell]').click()
  await expect(page.locator('.shop')).toHaveAttribute('data-phase', 'packing')
  await packTo(page, first, first.n)
  await page.locator('[data-bell]').click()
  const next = await nextOrder(page, first.customer)
  expect(next.mode).toBe('help')
  const progress = await saved(page)
  expect(progress.types.A).toMatchObject({ mode: 'help', modeHistory: [] })
  expect(progress.points).toBe(18)
  expect(await spoken(page)).toContain('ar/g/back-to-train')
  await expect(page.locator('[data-stake]')).toHaveCount(0)
  await expect(page.locator('.helper .bear')).toHaveClass(/bear-lean/)
})

const intoCompetition = (seen: string[]) => {
  const shop = shopWith({ arrived: ['A', 'C'], seen: ['g/goal', 'g/open', 'g/train', 'g/tap-jar', 'g/take-out', 'g/ring-bell', ...seen] })
  shop.types.A = { ...shop.types.A, modeHistory: [true, true, true] }
  return { ...shop, disabled: ['C'] }
}

test('the first type into competition: the board lights up, «g/compete» once', async ({ page }) => {
  await seed(page, intoCompetition([]))
  // Real speed: the board stays lit for a moment.
  await openShop(page, '?seed=7')
  const order = await nextOrder(page, -1)
  expect(order.mode).toBe('help')
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(page.locator('[data-board] .prize-board')).toHaveClass(/is-lit/)
  const next = await nextOrder(page, order.customer)
  expect(next.mode).toBe('compete')
  expect((await saved(page)).seen).toContain('g/compete')
})

test('a later type into competition: «g/compete-more», not «g/compete» again', async ({ page }) => {
  await seed(page, intoCompetition(['g/compete']))
  await openShop(page)
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  const next = await nextOrder(page, order.customer)
  expect(next.mode).toBe('compete')
  const said = await spoken(page)
  expect(said).toContain('ar/g/compete-more')
  expect(said).not.toContain('ar/g/compete')
})

test("the parents' switch moves a type into competition by hand", async ({ page }) => {
  await seed(page, shopWith({ only: 'A' }))
  await openShop(page)
  await nextOrder(page, -1)
  const box = (await page.locator('.hold-button').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(2300)
  await page.mouse.up()
  await expect(page.locator('[data-parent-order="A"]')).toContainText('تدريب')
  await page.locator('[data-mode-switch="A"]').click()
  expect((await saved(page)).types.A.mode).toBe('compete')
  await page.getByRole('button', { name: 'رجوع للبقالة' }).click()
  // The next customer's order is a competition order.
  const order = await nextOrder(page, -2)
  expect(order.mode).toBe('compete')
  await expect(page.locator('[data-stake] .coin')).toHaveCount(2)
})
