import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { holdParents, nextOrder, noHorizontalScroll, nothingClipped, openShop, packTo, seed, shopWith } from './helpers'

async function centerX(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox()
  return box!.x + box!.width / 2
}

test('the shop front and the shop fit the screen; the tray fills from the right; the board runs left to right', async ({ page }) => {
  await seed(page, { ...shopWith({ only: 'A' }), points: 30 })
  await page.goto('/?fast=1')
  await nothingClipped(page)
  await page.getByRole('button', { name: 'مسكر' }).click()
  const order = await nextOrder(page, -1)
  await noHorizontalScroll(page)
  await nothingClipped(page)
  await packTo(page, { ...order }, 2)
  const first = await page.locator('[data-cup="0"]').boundingBox()
  const second = await page.locator('[data-cup="1"]').boundingBox()
  const sixth = await page.locator('[data-cup="5"]').boundingBox()
  expect(first!.x).toBeGreaterThan(second!.x)
  expect(sixth!.y).toBeGreaterThan(first!.y)
  expect(await page.locator('.shop').innerText()).not.toMatch(/[0-9]/)
  // The board's track fills from the left, the bag at the far right end: 20 steps of 5 points.
  await expect(page.locator('[data-board] .pb-step')).toHaveCount(20)
  await expect(page.locator('[data-board] .pb-step.on')).toHaveCount(6)
  expect(await centerX(page, '[data-board] .pb-step:first-child')).toBeLessThan(await centerX(page, '[data-board] .pb-prize'))
  expect(await centerX(page, '[data-board] .pb-step.on >> nth=0')).toBeLessThan(await centerX(page, '[data-board] .pb-step:not(.on) >> nth=0'))
})

test('the ready box, its tray and the receipt read right to left; a reveal fits too', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 2 } }))
  await openShop(page, '?seed=5')
  const order = await nextOrder(page, -1)
  await nothingClipped(page)
  // The tray is to the left of the box, and fills from the box outward.
  expect(await centerX(page, '[data-box]')).toBeGreaterThan(await centerX(page, '.side-tray'))
  await packTo(page, order, Math.min(10, order.a + 2))
  expect(await centerX(page, '[data-side="0"]')).toBeGreaterThan(await centerX(page, '[data-side="1"]'))
  // A wrong bell: everything stays on screen.
  if (order.a + 2 !== order.n) {
    await page.locator('[data-bell]').click()
    await expect(page.locator('.shop')).toHaveAttribute('data-ready', '1')
    await nothingClipped(page)
  }
  expect(await page.locator('.shop').innerText()).not.toMatch(/[0-9]/)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(page.locator('.receipt')).toBeVisible()
  expect(await centerX(page, '.receipt [data-part="a"]')).toBeGreaterThan(await centerX(page, '.receipt [data-part="b"]'))
  expect(await centerX(page, '.receipt [data-part="b"]')).toBeGreaterThan(await centerX(page, '.receipt [data-part="sum"]'))
  await expect(page.locator('.receipt')).toHaveAttribute('aria-label', /زائد/)
})

test("the parents' page opens only after a 2-second hold", async ({ page }) => {
  await openShop(page)
  await nextOrder(page, -1)
  await holdParents(page, 500)
  await expect(page.locator('.parents')).toHaveCount(0)
  await holdParents(page, 2300)
  await expect(page.locator('.parents')).toBeVisible()
  await expect(page.locator('[data-parent-challenge]')).toContainText('ديما')
  await page.getByRole('button', { name: 'رجوع للبقالة' }).click()
  await expect(page.locator('.shop')).toBeVisible()
})

test('no serious accessibility problems', async ({ page }) => {
  const check = async (name: string) => {
    // The door and its sign are drawn scenery (aria-hidden); while she solves they fade on purpose
    // (§11.6), so their faded lettering is not held to the text-contrast rule.
    const results = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).exclude('.shop-door').analyze()
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious.map((v) => `${name}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  }
  await seed(page, shopWith({ points: 5 }))
  await page.goto('/?fast=1')
  await check('front')
  await page.getByRole('button', { name: 'مسكر' }).click()
  await nextOrder(page, -1)
  await check('shop')
  await holdParents(page, 2300)
  await check('parents')
})
