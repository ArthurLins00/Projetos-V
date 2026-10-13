import { defineConfig } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: API_URL,
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  webServer: {
    command: 'npm run dev --prefix backend',
    url: `${API_URL}/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
