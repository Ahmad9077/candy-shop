// `npm run shots`: the ready box in its three steps of help, the fade while she solves, a wrong bell
// answered by the pieces (too few and too many), the board, a milestone, the coupon and the parents'
// page, at the three sizes (shots/, not tracked). Real speed, so what is said is caught on screen.
import { expect, test, type Page } from '@playwright/test'
import { holdParents, nextOrder, openShop, packTo, seed, shop, shopWith, type OrderInfo } from '../e2e/helpers'

const shot = (page: Page, name: string) => page.screenshot({ path: `shots/${test.info().project.name}/${name}.png` })
/** The fade takes 400 ms. */
const settle = (page: Page) => page.waitForTimeout(700)
const tap = async (page: Page, order: OrderInfo, times: number) => {
  for (let i = 0; i < times; i += 1) {
    await page.locator(`[data-src="${order.good}"]`).click()
    await page.waitForTimeout(250)
  }
}

test('training: the box pulsing, then two pieces on the tray with their numbers', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 2 }, points: 36 }))
  await openShop(page, '?seed=11')
  const order = await nextOrder(page, -1)
  await settle(page)
  await shot(page, 'C-help-1-box')
  await tap(page, order, Math.min(2, order.b))
  await expect(page.locator('.side-tray .piece-tag')).toHaveCount(Math.min(2, order.b))
  await settle(page)
  await shot(page, 'C-help-2-tags')
})

test('the bridge: the box said its number, the pieces carry none', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 2 }, modes: { C: 'bridge' }, points: 36 }))
  await openShop(page, '?seed=12')
  const order = await nextOrder(page, -1)
  await tap(page, order, Math.min(2, order.b))
  await settle(page)
  await shot(page, 'C-bridge')
})

test('competition, and the fade: a solving frame, then the hand-over in full colour', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 2 }, compete: true, points: 36 }))
  await openShop(page, '?seed=13')
  const order = await nextOrder(page, -1)
  await expect(shop(page)).toHaveClass(/is-solving/)
  await tap(page, order, 1)
  await settle(page)
  await shot(page, 'C-compete-fade-1-solving')
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(page.locator('.receipt')).toBeVisible({ timeout: 10_000 })
  await expect(shop(page)).not.toHaveClass(/is-solving/)
  await settle(page)
  await shot(page, 'C-compete-fade-2-handover')
})

test('a wrong bell with too few: the box counted on, ghost cups with their numbers', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 3 }, compete: true, points: 36 }))
  await openShop(page, '?seed=14')
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.a + Math.max(0, order.b - 2))
  await page.locator('[data-bell]').click()
  // During the count: the box open, its pieces framed under their number.
  await expect(page.locator('.ready-box.is-framed')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(400)
  await shot(page, 'C-wrong-1-counting')
  await expect(shop(page)).toHaveAttribute('data-ready', '1', { timeout: 20_000 })
  await settle(page)
  await shot(page, 'C-wrong-2-ghosts')
})

test('a wrong bell with too many: the extra pieces fade', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 1 }, compete: true, points: 36 }))
  await openShop(page, '?seed=15')
  const order = await nextOrder(page, -1)
  await packTo(page, order, Math.min(10, order.n + 2))
  await page.locator('[data-bell]').click()
  await expect(page.locator('[data-extra]').first()).toBeVisible({ timeout: 20_000 })
  await expect(shop(page)).toHaveAttribute('data-ready', '1', { timeout: 20_000 })
  await settle(page)
  await shot(page, 'C-wrong-3-extra')
})

test('the board at the scale of 100', async ({ page }) => {
  await seed(page, shopWith({ points: 36 }))
  await openShop(page, '?seed=15')
  await nextOrder(page, -1)
  await page.locator('[data-board]').click()
  await expect(page.locator('.board-overlay')).toBeVisible()
  await page.waitForTimeout(900)
  await shot(page, 'board')
})

test('a milestone: the big board opens by itself at 25', async ({ page }) => {
  await seed(page, shopWith({ compete: true, points: 24 }))
  await openShop(page, '?seed=16')
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(page.locator('.board-overlay')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(900)
  await shot(page, 'milestone-25')
})

test('the coupon at 100', async ({ page }) => {
  await seed(page, shopWith({ compete: true, points: 98 }))
  await openShop(page, '?seed=17')
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(page.locator('.coupon-overlay')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(900)
  await shot(page, 'coupon')
})

test("the parents' page", async ({ page }) => {
  await seed(page, shopWith({ modes: { C: 'bridge' }, points: 48 }))
  await openShop(page, '?fast=1&seed=11')
  await nextOrder(page, -1)
  await holdParents(page)
  await expect(page.locator('[data-parent-rule]')).toBeVisible()
  await page.screenshot({ path: `shots/${test.info().project.name}/parents.png`, fullPage: true })
})
