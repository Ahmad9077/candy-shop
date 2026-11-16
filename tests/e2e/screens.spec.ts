import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { nextOrder, noHorizontalScroll, nothingClipped, openShop, packTo, seed, shopWith } from './helpers'

async function centerX(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox()
  return box!.x + box!.width / 2
}

async function holdParents(page: Page, ms: number) {
  const box = (await page.locator('.hold-button').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
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
  // The board's track fills from the left, the bag at the far right end.
  await expect(page.locator('[data-board] .pb-step.on')).toHaveCount(3)
  expect(await centerX(page, '[data-board] .pb-step:first-child')).toBeLessThan(await centerX(page, '[data-board] .pb-prize'))
  expect(await centerX(page, '[data-board] .pb-step.on >> nth=0')).toBeLessThan(await centerX(page, '[data-board] .pb-step:not(.on) >> nth=0'))
})

test('the ready box, the side tray and the receipt read right to left', async ({ page }) => {
  await seed(page, shopWith({ only: 'C' }))
  await openShop(page, '?seed=5')
  const order = await nextOrder(page, -1)
  await nothingClipped(page)
  // The strawberry candies wait to the left of the box.
  expect(await centerX(page, '[data-box]')).toBeGreaterThan(await centerX(page, '.side-tray'))
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
    const results = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).analyze()
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious.map((v) => `${name}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  }
  await seed(page, shopWith({ only: 'C', points: 5 }))
  await page.goto('/?fast=1')
  await check('front')
  await page.getByRole('button', { name: 'مسكر' }).click()
  await nextOrder(page, -1)
  await check('shop')
  await holdParents(page, 2300)
  await check('parents')
})
