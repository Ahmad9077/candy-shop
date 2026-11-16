import { expect, test } from '@playwright/test'
import { openShop, playDay } from './helpers'

const HUB = 'https://ahmad9077.github.io/quizzes-hub/**'
const PROD = 'http://127.0.0.1:4196/candy-shop/'

test('preview never calls the Hub or Supabase', async ({ page }) => {
  const external: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:')) external.push(url)
  })
  await openShop(page)
  await playDay(page)
  expect(external).toEqual([])
})

test('the Hub build loads the access guard for candy-shop first and reports the day', async ({ page }) => {
  const requested: string[] = []
  await page.route(HUB, async (route) => {
    const url = route.request().url()
    requested.push(url)
    if (url.includes('config.js')) return route.fulfill({ contentType: 'text/javascript', body: 'window.QUIZZES_HUB_CONFIG = {}' })
    if (url.includes('access-guard.js')) {
      return route.fulfill({
        contentType: 'text/javascript',
        body: `window.__guardQuizId = document.currentScript.dataset.quizId;
               window.QuizzesHubSupabaseClient = { auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'child-a' } } } }) } };
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
  await page.goto(`${PROD}?fast=1&seed=2`)
  await page.getByRole('button', { name: 'مسكر' }).click()
  expect(await page.evaluate(() => (window as unknown as { __guardQuizId: string }).__guardQuizId)).toBe('candy-shop')
  expect(requested[0]).toContain('/config.js?v=4')
  expect(requested[1]).toContain('/access-guard.js?v=3')
  expect(requested.some((url) => url.includes('adaptive'))).toBe(false)
  await expect(page.locator('.preview-badge')).toHaveCount(0)
  await playDay(page, [0])
  await expect.poll(() => page.evaluate(() => (window as unknown as { __records: unknown[] }).__records.length)).toBe(1)
  const records = await page.evaluate(() => (window as unknown as { __records: unknown[] }).__records)
  expect(records).toEqual([{ quizId: 'candy-shop', score: 4, total: 5, level: 'A', details: { day: 1, orders: ['A', 'A', 'A', 'A', 'A'] } }])
  // Her shop is saved under her own account, not under a key every account on this iPad shares.
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('candy-shop')))
  expect(keys).toEqual(['candy-shop:v3:child-a'])
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
