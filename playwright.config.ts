import { defineConfig } from '@playwright/test';

// Testes E2E das jornadas do usuário contra o backend real (banco PostgreSQL com seed).
// O app é mobile nativo (sem web), por isso o Playwright exercita a API que o app consome;
// os fluxos de tela ficam no Maestro (mobile/e2e).
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // As jornadas criam dados próprios (usuário com e-mail único), então rodam em paralelo com segurança
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: API_URL,
    extraHTTPHeaders: { Accept: 'application/json' },
  },
  // Sobe o backend se ele ainda não estiver rodando (reaproveita o que já estiver no ar)
  webServer: {
    command: 'npm run dev --prefix backend',
    url: `${API_URL}/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
