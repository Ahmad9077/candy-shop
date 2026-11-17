// The three steps of help of the ready box (DESIGN.md §12.1), a wrong bell answered by the pieces
// (§12.2) and the fade while she solves (§11.6).
import { expect, test, type Page } from '@playwright/test'
import { ar } from '../../src/domain/digits'
import { ALL_SEEN, holdParents, nextOrder, openShop, packTo, saved, seed, shop, shopWith, spoken, type OrderInfo } from './helpers'

const numbers = (said: string[]) => said.filter((c) => c.startsWith('ar/n/'))
const since = async (page: Page, from: number) => (await spoken(page)).slice(from)
const board = (page: Page) => page.locator('[data-board] .pb-num')
const source = (page: Page, order: OrderInfo) => page.locator(`[data-src="${order.good}"]`)
const tags = (page: Page) => page.locator('.side-tray .piece-tag')
/** From the box's number on to the order: «a», «a+1» … «n». */
const countedOn = (order: OrderInfo) => Array.from({ length: order.b + 1 }, (_, k) => `ar/n/${order.a + k}`)

test('training: the box pulses; the first tap says its number, then the voice counts on and every piece carries its number', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 2 }, points: 30 }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  expect(order.mode).toBe('help')
  await expect(page.locator('.helper .bear')).toHaveClass(/bear-lean/)
  await expect(page.locator('[data-stake]')).toHaveCount(0)
  await expect(page.locator('[data-box]')).toHaveClass(/guide/)
  await expect(shop(page)).toHaveAttribute('data-held', '0')
  const before = (await spoken(page)).length
  for (let k = 1; k <= order.b; k += 1) {
    await source(page, order).click()
    await expect(tags(page)).toHaveCount(k)
  }
  await expect(shop(page)).toHaveAttribute('data-held', '1')
  await expect(page.locator('[data-box]')).not.toHaveClass(/guide/)
  await expect(tags(page)).toHaveText(Array.from({ length: order.b }, (_, k) => ar(order.a + k + 1)))
  await expect.poll(async () => numbers(await since(page, before))).toEqual(countedOn(order))
  // The box never opens for a peek.
  await expect(page.locator('[data-in-box]')).toHaveCount(0)
  // The tray matches the order: the bell pulses.
  await expect(page.locator('[data-bell]')).toHaveClass(/guide/)
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(30)
})

test('training: a tap on the box says its number (closed), then how to go on, the good pulsing', async ({ page }) => {
  await seed(page, shopWith({ seen: ALL_SEEN.filter((id) => id !== 'g/count-on') }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  const before = (await spoken(page)).length
  await page.locator('[data-box]').click()
  await expect(shop(page)).toHaveAttribute('data-held', '1')
  await expect(page.locator('[data-in-box]')).toHaveCount(0)
  await expect.poll(() => since(page, before)).toEqual([`ar/n/${order.a}`, 'ar/g/count-on'])
  await expect(source(page, order)).toHaveClass(/guide/)
  // A second tap says it again; the first piece then counts on without saying the box again.
  await page.locator('[data-box]').click()
  await source(page, order).click()
  await expect.poll(async () => numbers(await since(page, before))).toEqual([`ar/n/${order.a}`, `ar/n/${order.a}`, `ar/n/${order.a + 1}`])
})

test('the bridge: the first tap says the box\'s number; then the pieces only plip, no numbers on them', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 2 }, modes: { C: 'bridge' } }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  expect(order.mode).toBe('bridge')
  await expect(page.locator('.helper .bear')).toHaveClass(/bear-lean/)
  await expect(page.locator('[data-box]')).toHaveClass(/guide/)
  const before = (await spoken(page)).length
  await packTo(page, order, order.n)
  await expect(tags(page)).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(numbers(await since(page, before))).toEqual([`ar/n/${order.a}`])
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(0)
})

test('competition: the stake, Dabdoob hushed, the box only bumps, nothing said, no numbers, +2', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 2 }, compete: true, points: 10 }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  expect(order.mode).toBe('compete')
  await expect(page.locator('[data-stake] .coin')).toHaveCount(2)
  await expect(page.locator('.helper .bear')).toHaveClass(/bear-hush/)
  await expect(page.locator('[data-box]')).not.toHaveClass(/guide/)
  const before = (await spoken(page)).length
  await page.locator('[data-box]').click()
  await expect(page.locator('[data-in-box]')).toHaveCount(0)
  await packTo(page, order, order.n)
  await expect(tags(page)).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(numbers(await since(page, before))).toEqual([])
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
  await expect(board(page)).toHaveAttribute('data-points', '12')
})

for (const mode of ['help', 'compete'] as const) {
  test(`one too many in ${mode}: the box counts on to the order, the extra piece fades, she takes it back; nothing lost`, async ({ page }) => {
    await seed(page, shopWith({ levels: { C: 3 }, modes: { C: mode }, points: 20 }))
    await openShop(page)
    const order = await nextOrder(page, -1)
    await packTo(page, order, order.n === 10 ? 10 : order.n + 1)
    test.skip(order.n === 10, 'no room for one too many')
    const before = (await spoken(page)).length
    await page.locator('[data-bell]').click()
    await expect(shop(page)).toHaveClass(/is-solving/)
    await expect(shop(page)).toHaveAttribute('data-phase', 'packing')
    await expect(shop(page)).toHaveAttribute('data-ready', '1')
    // Counted on from the box's one number to the order, never from one, no sentence.
    const said = await since(page, before)
    expect(numbers(said)).toEqual(countedOn(order))
    expect(said.some((c) => c.startsWith('ar/c/') || c.startsWith('ar/g/'))).toBe(false)
    await expect(tags(page)).toHaveText(Array.from({ length: order.b }, (_, k) => ar(order.a + k + 1)))
    await expect(page.locator('[data-extra]')).toHaveCount(1)
    expect((await saved(page)).points).toBe(20)
    await expect(board(page)).toHaveAttribute('data-points', '20')
    // She sends the extra one back: the bell pulses, she rings, the customer is served.
    await page.locator('[data-extra]').click()
    await expect(page.locator('[data-extra]')).toHaveCount(0)
    await expect(page.locator('[data-bell]')).toHaveClass(/guide/)
    await page.locator('[data-bell]').click()
    await nextOrder(page, order.customer)
    expect((await saved(page)).points).toBe(20)
    expect((await saved(page)).missed[`${order.a}+${order.b}`]).toBe(1)
  })
}

test('too few: ghost cups with their numbers show what is missing, counted on to the order; she fills them', async ({ page }) => {
  await seed(page, shopWith({ levels: { C: 3 }, compete: true }))
  await openShop(page)
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.a)
  const before = (await spoken(page)).length
  await page.locator('[data-bell]').click()
  await expect(shop(page)).toHaveAttribute('data-phase', 'packing')
  await expect(shop(page)).toHaveAttribute('data-ready', '1')
  expect(numbers(await since(page, before))).toEqual(countedOn(order))
  const ghosts = page.locator('[data-ghost]')
  await expect(ghosts).toHaveCount(order.b)
  for (let k = 1; k <= order.b; k += 1) await expect(page.locator(`[data-ghost="${order.a + k}"] .piece-tag`)).toHaveText(ar(order.a + k))
  // The box closed again; its number stays on it.
  await expect(page.locator('[data-in-box]')).toHaveCount(0)
  for (let k = 1; k <= order.b; k += 1) {
    await source(page, order).click()
    await expect(ghosts).toHaveCount(order.b - k)
  }
  await expect(tags(page)).toHaveCount(order.b)
  await page.locator('[data-bell]').click()
  await nextOrder(page, order.customer)
  expect((await saved(page)).points).toBe(0)
})

test('the fade: while she solves everything but the task fades; the colour comes back with the answer', async ({ page }) => {
  await seed(page, shopWith({ compete: true }))
  // Real speed: the receipt (in full colour) stays while it is read.
  await openShop(page, '?seed=7')
  const order = await nextOrder(page, -1)
  await expect(shop(page)).toHaveClass(/is-solving/)
  const other = ['takis', 'candy', 'choc'].find((g) => g !== order.good)!
  for (const faded of ['.backroom', '.customer-button', '.helper', `[data-src="${other}"]`]) await expect(page.locator(faded).first(), faded).toHaveCSS('opacity', '0.35')
  for (const bright of ['[data-box]', '[data-side-tray]', `[data-src="${order.good}"]`, '.bell-spot', '.order-bubble']) await expect(page.locator(bright).first(), bright).toHaveCSS('opacity', '1')
  await expect(page.locator('.backroom')).toHaveCSS('filter', /saturate\(0\.3\)/)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(shop(page)).not.toHaveClass(/is-solving/)
  await expect(page.locator('.backroom')).toHaveCSS('opacity', '1')
  await expect(page.locator('.receipt')).toBeVisible()
})

test('the fade leaves a guide pulse bright, and faded things still answer taps', async ({ page }) => {
  await seed(page, shopWith({ points: 30 }))
  await openShop(page)
  await nextOrder(page, -1)
  await expect(page.locator('[data-box]')).toHaveClass(/guide/)
  await expect(page.locator('[data-box]')).toHaveCSS('opacity', '1')
  // The faded board still answers: the challenge is said again.
  await page.locator('[data-board]').click()
  await expect.poll(() => spoken(page)).toContain('ar/g/goal')
})

const moving = (mode: 'help' | 'bridge' | 'compete', history: boolean[], seen = ALL_SEEN) => shopWith({ modes: { C: mode }, modeHistory: { C: history }, seen })

test('help → bridge after 4 of 5 right: «g/bridge», then the next order is in the bridge', async ({ page }) => {
  await seed(page, moving('help', [true, true, true], ALL_SEEN.filter((id) => id !== 'g/bridge')))
  await openShop(page)
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  const next = await nextOrder(page, order.customer)
  expect(next.mode).toBe('bridge')
  expect(await spoken(page)).toContain('ar/g/bridge')
  expect((await saved(page)).types.C).toMatchObject({ mode: 'bridge', modeHistory: [] })
})

test('bridge → competition: the board lights up, «g/compete» once', async ({ page }) => {
  await seed(page, moving('bridge', [true, true, true], ALL_SEEN.filter((id) => id !== 'g/compete')))
  await openShop(page, '?seed=7')
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  await expect(page.locator('[data-board] .prize-board')).toHaveClass(/is-lit/)
  const next = await nextOrder(page, order.customer)
  expect(next.mode).toBe('compete')
  expect((await saved(page)).seen).toContain('g/compete')
})

test('competition → bridge after two wrong first tries in a row: «g/back-to-train»; the number level stays', async ({ page }) => {
  const s = moving('compete', [true, false])
  s.types.C.level = 2
  await seed(page, s)
  await openShop(page)
  const order = await nextOrder(page, -1)
  await packTo(page, order, order.a)
  await page.locator('[data-bell]').click()
  await expect(shop(page)).toHaveAttribute('data-ready', '1')
  await packTo(page, order, order.n)
  await page.locator('[data-bell]').click()
  const next = await nextOrder(page, order.customer)
  expect(next.mode).toBe('bridge')
  expect(await spoken(page)).toContain('ar/g/back-to-train')
  expect((await saved(page)).types.C).toMatchObject({ mode: 'bridge', level: 2 })
  await expect(page.locator('[data-stake]')).toHaveCount(0)
})

test('the parents set the step by hand: three for the ready box, two for the others', async ({ page }) => {
  await seed(page, shopWith())
  await openShop(page)
  await nextOrder(page, -1)
  await holdParents(page)
  await expect(page.locator('[data-mode-switch="C"] [data-mode-choice]')).toHaveCount(3)
  for (const t of ['A', 'D']) await expect(page.locator(`[data-mode-switch="${t}"] [data-mode-choice]`)).toHaveCount(2)
  await expect(page.locator('[data-mode-switch="E"]')).toHaveCount(0)
  await expect(page.locator('[data-parent-order="C"]')).toContainText('تدريب · المستوى')
  await page.locator('[data-mode-switch="C"] [data-mode-choice="bridge"]').click()
  expect((await saved(page)).types.C.mode).toBe('bridge')
  await expect(page.locator('[data-parent-order="C"]')).toContainText('تدريب خفيف')
  await page.locator('[data-mode-switch="C"] [data-mode-choice="compete"]').click()
  expect((await saved(page)).types.C.mode).toBe('compete')
  await page.getByRole('button', { name: 'رجوع للبقالة' }).click()
  const order = await nextOrder(page, -2)
  expect(order.mode).toBe('compete')
  await expect(page.locator('[data-stake] .coin')).toHaveCount(2)
})
