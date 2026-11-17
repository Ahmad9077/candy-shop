import { expect, test, type Page } from '@playwright/test'
import { STORAGE_KEY, holdParents, nextOrder, openShop, playStream, serve, shopWith } from './helpers'

const HUB = 'https://ahmad9077.github.io/quizzes-hub/**'
const PROD = 'http://127.0.0.1:4196/candy-shop/'
const KEY = `${STORAGE_KEY}:child-a`

type Win = { __records: unknown[]; __rpc: { name: string; params: Record<string, number | string> }[]; __server: { points: number; epoch: number } }

/**
 * The Hub, mocked: the access guard with a signed-in child, the progress client, and
 * `game_balance_sync` keeping the server's rule (the same epoch keeps the larger points; a larger
 * epoch wins outright). `rpc: 'fail'` makes every call fail.
 */
async function mockHub(page: Page, options: { server?: { points: number; epoch: number }; rpc?: 'ok' | 'fail' } = {}) {
  const requested: string[] = []
  const server = JSON.stringify(options.server ?? { points: 0, epoch: 0 })
  const rpc =
    options.rpc === 'fail'
      ? `rpc: () => Promise.reject(new Error('offline'))`
      : `rpc: (name, params) => {
           window.__rpc.push({ name, params });
           const s = window.__server;
           if (params.p_epoch > s.epoch) { s.epoch = params.p_epoch; s.points = params.p_points }
           else if (params.p_epoch === s.epoch) s.points = Math.max(s.points, params.p_points);
           return Promise.resolve({ data: [{ points: s.points, epoch: s.epoch }], error: null });
         }`
  await page.route(HUB, async (route) => {
    const url = route.request().url()
    requested.push(url)
    if (url.includes('config.js')) return route.fulfill({ contentType: 'text/javascript', body: 'window.QUIZZES_HUB_CONFIG = {}' })
    if (url.includes('access-guard.js')) {
      return route.fulfill({
        contentType: 'text/javascript',
        body: `window.__guardQuizId = document.currentScript.dataset.quizId;
               window.__rpc = []; window.__server = window.__server || ${server};
               window.QuizzesHubSupabaseClient = { auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'child-a' } } } }) }, ${rpc} };
               window.QuizzesHubAccessReady = Promise.resolve({ ok: true, quizId: 'candy-shop' });`,
      })
    }
    if (url.includes('progress-client.js')) {
      return route.fulfill({
        contentType: 'text/javascript',
        body: `window.__records = []; window.QuizzesHubProgress = { record: (p) => { window.__records.push(p); return Promise.resolve({ ok: true }) } };`,
      })
    }
    return route.fulfill({ contentType: 'text/javascript', body: '' })
  })
  return requested
}

const win = <K extends keyof Win>(page: Page, key: K) => page.evaluate((k) => (window as unknown as Win)[k], key)
const savedHub = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY)
async function seedHub(page: Page, progress: Record<string, unknown>) {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, value)
        sessionStorage.setItem('seeded', '1')
      }
    },
    [KEY, JSON.stringify(progress)] as const,
  )
}

test('preview never calls the Hub or Supabase', async ({ page }) => {
  const external: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:')) external.push(url)
  })
  await openShop(page)
  await playStream(page, 5)
  expect(external).toEqual([])
})

test('the Hub build loads the access guard for candy-shop first and reports every five orders', async ({ page }) => {
  const requested = await mockHub(page)
  await page.goto(`${PROD}?fast=1&seed=2`)
  await page.getByRole('button', { name: 'مسكر' }).click()
  expect(await page.evaluate(() => (window as unknown as { __guardQuizId: string }).__guardQuizId)).toBe('candy-shop')
  expect(requested[0]).toContain('/config.js?v=4')
  expect(requested[1]).toContain('/access-guard.js?v=3')
  expect(requested.some((url) => url.includes('adaptive'))).toBe(false)
  await expect(page.locator('.preview-badge')).toHaveCount(0)
  await playStream(page, 5, [0])
  await expect.poll(() => win(page, '__records').then((r) => r.length)).toBe(1)
  expect(await win(page, '__records')).toEqual([
    { quizId: 'candy-shop', score: 4, total: 5, level: 'تدريب خفيف', details: { points: 0, served: 5, wrongCount: 1, orders: ['C', 'C', 'C', 'C', 'C'], step: 'bridge', numbers: 1 } },
  ])
  // Her shop is saved under her own account, not under a key every account on this iPad shares.
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('candy-shop')))
  expect(keys).toEqual([KEY])
})

test('the Hub build stops when the Hub denies access', async ({ page }) => {
  await page.route(HUB, (route) => {
    const url = route.request().url()
    if (url.includes('access-guard.js')) return route.fulfill({ contentType: 'text/javascript', body: 'window.QuizzesHubAccessReady = Promise.reject(new Error("denied"));' })
    return route.fulfill({ contentType: 'text/javascript', body: '' })
  })
  await page.goto(PROD)
  await expect(page.locator('.bootstrap-error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'مسكر' })).toHaveCount(0)
})

test('the balance: an Admin reset is adopted at start, before the shop opens', async ({ page }) => {
  await mockHub(page, { server: { points: 0, epoch: 1 } })
  await seedHub(page, shopWith({ compete: true, points: 40 }))
  await page.goto(`${PROD}?fast=1&seed=2`)
  await page.getByRole('button', { name: 'مسكر' }).click()
  await nextOrder(page, -1)
  await expect(page.locator('[data-board] .pb-num')).toHaveAttribute('data-points', '0')
  expect(await savedHub(page)).toMatchObject({ points: 0, epoch: 1 })
  expect((await win(page, '__rpc'))[0]).toEqual({ name: 'game_balance_sync', params: { p_game_id: 'candy-shop', p_points: 40, p_epoch: 0 } })
})

test('the balance: points are pushed after they change; a reset while she plays comes on visibilitychange, between orders', async ({ page }) => {
  await mockHub(page, { server: { points: 10, epoch: 0 } })
  await seedHub(page, shopWith({ compete: true, points: 10 }))
  await page.goto(`${PROD}?fast=1&seed=2`)
  await page.getByRole('button', { name: 'مسكر' }).click()
  const [first] = await playStream(page, 1)
  const second = await nextOrder(page, first!.customer)
  // Pushed about 1.5 s after the +2.
  await expect.poll(() => win(page, '__server'), { timeout: 6000 }).toEqual({ points: 12, epoch: 0 })
  // The Admin resets her balance; the page is seen again.
  await page.evaluate(() => {
    ;(window as unknown as Win).__server = { points: 0, epoch: 1 }
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => win(page, '__rpc').then((r) => r.length)).toBeGreaterThanOrEqual(3)
  // Not in the middle of her order: the board still shows 12 until the next customer.
  await expect(page.locator('[data-board] .pb-num')).toHaveAttribute('data-points', '12')
  await serve(page, second, true)
  await nextOrder(page, second.customer)
  await expect(page.locator('[data-board] .pb-num')).toHaveAttribute('data-points', '0')
  expect(await savedHub(page)).toMatchObject({ points: 0, epoch: 1, won: false })
})

test('the balance: the in-game reset bumps the epoch and is sent at once', async ({ page }) => {
  await mockHub(page, { server: { points: 30, epoch: 0 } })
  await seedHub(page, shopWith({ points: 30 }))
  await page.goto(`${PROD}?fast=1&seed=2`)
  await page.getByRole('button', { name: 'مسكر' }).click()
  await nextOrder(page, -1)
  await holdParents(page)
  await page.getByRole('button', { name: 'تصفير الرصيد' }).click()
  await page.getByRole('button', { name: 'نعم، نصفر الرصيد' }).click()
  await expect.poll(() => win(page, '__server')).toEqual({ points: 0, epoch: 1 })
  expect(await savedHub(page)).toMatchObject({ points: 0, epoch: 1 })
  await expect(page.locator('[data-parent-points]')).toHaveAttribute('data-parent-points', '0')
})

test('the balance: a failing Hub is harmless', async ({ page }) => {
  await mockHub(page, { rpc: 'fail' })
  await seedHub(page, shopWith({ compete: true, points: 20 }))
  await page.goto(`${PROD}?fast=1&seed=2`)
  await page.getByRole('button', { name: 'مسكر' }).click()
  await playStream(page, 2)
  await nextOrder(page, 1)
  expect((await savedHub(page)).points).toBe(24)
})
