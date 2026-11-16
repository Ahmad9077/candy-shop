import { defineConfig } from '@playwright/test'

// `npm run shots`: screenshots of every order type, training and competition, at the three sizes (shots/).
export default defineConfig({
  testDir: './tests/shots',
  fullyParallel: true,
  workers: 3,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4195/', hasTouch: true },
  projects: [
    { name: 'ipad-landscape', use: { browserName: 'webkit', viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, isMobile: true } },
    { name: 'ipad-portrait', use: { browserName: 'webkit', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true } },
    { name: 'iphone', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true } },
  ],
  webServer: {
    command: 'npx vite --mode preview --host 127.0.0.1 --port 4195 --strictPort',
    url: 'http://127.0.0.1:4195/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
