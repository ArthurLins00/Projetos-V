import { defineConfig } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Sem nova tentativa automática, nem no CI: falha na primeira execução reprova o job e vira issue
  // (docs/tas.md, seção 5.4). Instabilidade se detecta pelo re-run no mesmo commit, não pelo retry.
  retries: 0,
  // No CI também anota as falhas no PR (github) e grava o JUnit lido pelo sumário do job, fora de
  // e2e-report porque o reporter html limpa essa pasta
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e-report' }],
    ...(process.env.CI ? ([['github'], ['junit', { outputFile: 'e2e-junit.xml' }]] as const) : []),
  ],
  use: {
    baseURL: API_URL,
    extraHTTPHeaders: { Accept: 'application/json' },
    // Teste que falhou deixa um trace.zip em test-results/ com cada request e resposta;
    // abre em https://trace.playwright.dev ou com `npx playwright show-trace`
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev --prefix backend',
    url: `${API_URL}/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
