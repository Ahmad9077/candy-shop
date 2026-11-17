import fs from 'node:fs'
import { expect, test } from '@playwright/test'

// The single-file preview (npm run build:artifact) plays inside a sandboxed iframe with no network.
const FILE = 'preview/candy-shop.html'

test('the single-file preview plays in a sandboxed iframe with no network', async ({ page }, info) => {
  test.skip(!info.project.name.includes('ipad-landscape'), 'one size is enough')
  test.skip(!fs.existsSync(FILE), 'run npm run build:artifact first')
  const html = fs.readFileSync(FILE, 'utf8')
  const blocked: string[] = []
  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (url === 'http://sandbox.test/frame.html') return route.fulfill({ contentType: 'text/html', body: html })
    if (url === 'http://sandbox.test/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>host</title><body style="margin:0"><iframe sandbox="allow-scripts" src="http://sandbox.test/frame.html" style="border:0;width:100vw;height:100vh"></iframe></body>' })
    blocked.push(url)
    return route.abort()
  })
  await page.goto('http://sandbox.test/')
  const frame = page.frameLocator('iframe')
  await frame.getByRole('button', { name: 'مسكر' }).click()
  // The first opening shows the challenge, then the first customer.
  const shop = frame.locator('.shop[data-ready="1"][data-customer="0"]')
  await expect(shop).toBeVisible({ timeout: 20_000 })
  const n = Number(await shop.getAttribute('data-n'))
  // The ready box in training: the box, then the good tapped until the tray matches, then the bell.
  const a = Number(await shop.getAttribute('data-a'))
  const good = await shop.getAttribute('data-good')
  await frame.locator('[data-box]').click()
  for (let k = a; k < n; k += 1) await frame.locator(`[data-src="${good}"]`).click()
  await expect(shop).toHaveAttribute('data-packed', String(n))
  await frame.locator('[data-bell]').click()
  await expect(frame.locator('.shop[data-ready="1"][data-customer="1"]')).toBeVisible({ timeout: 20_000 })
  // The bag photo is inlined, the font is the bundled one.
  expect(await frame.locator('[data-src="takis"] img').getAttribute('src')).toMatch(/^data:image\/webp;base64,/)
  const font = await frame.locator('.gift-label').first().evaluate((el) => getComputedStyle(el).fontFamily)
  expect(font).toContain('Baloo Bhaijaan 2')
  expect(blocked.filter((url) => !url.startsWith('data:'))).toEqual([])
})
