// A and D stay in the game, off unless a parent switches them on (DESIGN.md §12.1). A wrong answer
// is shown with numbers only (§11.3), and nothing leaves the board.
import { expect, test } from '@playwright/test'
import { holdParents, nextOrder, nothingClipped, openShop, packTo, playStream, saved, seed, shop, shopWith, spoken } from './helpers'

test('«طلب» when switched on: packed across the goods; a wrong bell counts the tray from one with tags, no sentence', async ({ page }) => {
  await seed(page, shopWith({ only: 'A', levels: { A: 2 }, points: 10, compete: true }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  expect(order.type).toBe('A')
  await packTo(page, order, order.n - 1)
  const before = (await spoken(page)).length
  await page.locator('[data-bell]').click()
  await expect(shop(page)).toHaveAttribute('data-phase', 'packing')
  const said = (await spoken(page)).slice(before)
  expect(said.filter((c) => c.startsWith('ar/n/'))).toEqual(Array.from({ length: order.n - 1 }, (_, i) => `ar/n/${i + 1}`))
  expect(said.some((c) => c.startsWith('ar/c/'))).toBe(false)
  await expect(page.locator('[data-board] .pb-num')).toHaveAttribute('data-points', '10')
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(10)
  const more = await playStream(page, 3)
  for (const o of more) expect(o.type).toBe('A')
})

test('the delivery when switched on: a wrong door costs nothing; the ride back is said house by house', async ({ page }) => {
  await seed(page, shopWith({ only: 'D', levels: { D: 2 }, compete: true, points: 10 }))
  await openShop(page, '?fast=1&seed=7')
  const order = await nextOrder(page, -1)
  expect(order.type).toBe('D')
  await expect(page.locator('.street')).toHaveAttribute('data-mode', 'compete')
  await expect(page.locator('.street .trail-candy')).toHaveCount(0)
  await nothingClipped(page)
  const wrong = order.n < 10 ? order.n + 1 : order.n - 1
  await page.locator(`[data-door="${wrong}"]`).click()
  await expect(page.locator(`[data-door="${order.n}"]`)).toHaveClass(/guide/)
  await expect(page.locator('[data-board] .pb-num')).toHaveAttribute('data-points', '10')
  await page.locator(`[data-door="${order.n}"]`).click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(10)
  const said = await spoken(page)
  expect(said.some((c) => c.startsWith('ar/c/not-my-house-'))).toBe(true)
  expect(said).not.toContain('ar/g/points-no')
})

test('several types on: a mixed stream, never three of a kind in a row, at most one delivery in five', async ({ page }) => {
  await seed(page, shopWith({ on: ['C', 'A', 'D'] }))
  await openShop(page, '?fast=1&seed=31')
  const orders = await playStream(page, 8)
  const types = orders.map((o) => o.type)
  expect(new Set(types).size).toBeGreaterThanOrEqual(2)
  for (let i = 2; i < types.length; i += 1) expect(types[i] === types[i - 1] && types[i] === types[i - 2]).toBe(false)
  for (let i = 0; i + 5 <= types.length; i += 1) expect(types.slice(i, i + 5).filter((t) => t === 'D').length).toBeLessThanOrEqual(1)
})

test("the parents' switches open and close each type; a new shop has only the ready box", async ({ page }) => {
  await openShop(page)
  await nextOrder(page, -1)
  await holdParents(page)
  for (const t of ['A', 'D']) await expect(page.locator(`[data-type-switch="${t}"] input`)).not.toBeChecked()
  await expect(page.locator('[data-type-switch="C"] input')).toBeChecked()
  await expect(page.locator('[data-type-switch="B"], [data-type-switch="E"]')).toHaveCount(0)
  await page.locator('[data-type-switch="A"]').click()
  expect((await saved(page)).disabled).toEqual(['D'])
  await page.locator('[data-type-switch="A"]').click()
  expect((await saved(page)).disabled).toEqual(['D', 'A'])
  await expect(page.getByText('كل الطلبات مفتوحة')).toHaveCount(0)
})
