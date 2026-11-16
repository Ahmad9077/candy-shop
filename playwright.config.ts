import { defineConfig, devices } from '@playwright/test'

const previewURL = 'http://127.0.0.1:4195/'

// iPad landscape and portrait, and an iPhone, each in WebKit (Safari's engine) and Chromium.
const sizes = {
  'ipad-landscape': { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 },
  'ipad-portrait': { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 },
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
} as const

const touch = { hasTouch: true, isMobile: true }

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 90_000,
  // Long enough for a spoken sentence at real speed (the robust tests run without ?fast).
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: previewURL,
    trace: 'retain-on-failure',
  },
  projects: [
    ...Object.entries(sizes).map(([name, size]) => ({
      name: `webkit-${name}`,
      use: { ...devices['iPad (gen 7)'], ...touch, ...size, browserName: 'webkit' as const },
    })),
    ...Object.entries(sizes).map(([name, size]) => ({
      name: `chromium-${name}`,
      use: { ...devices['Desktop Chrome'], ...touch, ...size, browserName: 'chromium' as const },
    })),
  ],
  webServer: [
    {
      command: 'npx vite --mode preview --host 127.0.0.1 --port 4195 --strictPort',
      url: previewURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npx vite --mode production-hub --host 127.0.0.1 --port 4196 --strictPort',
      url: 'http://127.0.0.1:4196/candy-shop/',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
