// `npm run shots`: every order type, in training and in competition, at the three sizes (shots/,
// not tracked). Real speed, so the receipt and the street are caught while they are on screen.
import { expect, test, type Page } from '@playwright/test'
import { nextOrder, openShop, packTo, seed, shopWith } from '../e2e/helpers'

type T = 'A' | 'B' | 'C' | 'D' | 'E'
const shot = (page: Page, name: string) => page.screenshot({ path: `shots/${test.info().project.name}/${name}.png` })

for (const type of ['A', 'C', 'B', 'D', 'E'] as T[]) {
  for (const mode of ['help', 'compete'] as const) {
    test(`order ${type} in ${mode}`, async ({ page }) => {
      await seed(page, shopWith({ only: type, levels: { [type]: 2 }, modes: { [type]: mode }, points: 36 }))
      await openShop(page, '?seed=11')
      const order = await nextOrder(page, -1)
      await page.waitForTimeout(600)
      await shot(page, `${type}-${mode}-1-order`)
      if (type === 'D') {
        if (mode === 'help') for (let i = 0; i < Math.min(2, order.b); i += 1) await page.locator('[data-scooter]').click()
        await shot(page, `${type}-${mode}-2-mid`)
        if (mode === 'help') for (let i = 2; i < order.b; i += 1) await page.locator('[data-scooter]').click()
        if (mode === 'help') await expect(page.locator('.street')).toHaveAttribute('data-pos', String(order.n))
        await page.locator(`[data-door="${order.n}"]`).click()
        await expect(page.locator('.street .resident')).toBeVisible()
        await shot(page, `${type}-${mode}-3-done`)
        return
      }
      if (type === 'E') {
        if (mode === 'help') await page.locator('[data-loose]').first().click()
        await shot(page, `${type}-${mode}-2-mid`)
        await page.locator(`[data-sticker-n="${order.n}"]`).click()
      } else {
        await packTo(page, order, type === 'C' ? order.a + Math.ceil(order.b / 2) : Math.ceil(order.n / 2))
        await shot(page, `${type}-${mode}-2-mid`)
        await packTo(page, order, order.n)
        await page.locator('[data-bell]').click()
      }
      if (type !== 'A') await expect(page.locator('.receipt:not(.is-card)')).toBeVisible()
      await page.waitForTimeout(500)
      await shot(page, `${type}-${mode}-3-${type === 'A' ? 'served' : 'receipt'}`)
    })
  }
}

test('closing: today\'s change on the big board', async ({ page }) => {
  await seed(page, { ...shopWith({ only: 'A', compete: true, points: 36 }), today: { plan: ['A'], customers: ['cat'], served: 0, firstBells: 0, start: 30, arrived: null } })
  await openShop(page, '?fast=1&seed=11')
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(page.getByRole('button', { name: 'يوم جديد' })).toBeVisible()
  await shot(page, 'closing')
})

test("the parents' page", async ({ page }) => {
  await seed(page, shopWith({ arrived: ['A', 'C', 'B', 'D', 'E'], modes: { A: 'compete', C: 'compete' }, points: 48 }))
  await page.goto('/?fast=1&seed=11#parents')
  await page.getByRole('button', { name: 'مسكر' }).click()
  const box = (await page.locator('.hold-button').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(2300)
  await page.mouse.up()
  await expect(page.locator('[data-parent-rule]')).toBeVisible()
  await page.screenshot({ path: `shots/${test.info().project.name}/parents.png`, fullPage: true })
})
