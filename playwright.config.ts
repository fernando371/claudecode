import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de navegador do painel.
 *
 * Rodam contra o sistema de verdade (API + painel), com dados fictícios e
 * sem nenhuma credencial. São separados dos testes rápidos: use
 * `npm run test:e2e`.
 *
 * O Chromium usado é o que já estiver instalado na máquina. Se houver um
 * navegador em CHROMIUM_EXECUTABLE_PATH (ou nos caminhos conhecidos), ele é
 * reaproveitado; caso contrário, o Playwright usa o que ele mesmo instalou.
 */

/** Procura um Chromium já presente na máquina, para não baixar nada. */
function chromiumLocal(): string | undefined {
  const candidatos = [
    process.env.CHROMIUM_EXECUTABLE_PATH,
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter((c): c is string => Boolean(c));
  return candidatos.find((c) => existsSync(c));
}

const executavel = chromiumLocal();

const PORTA_API = 3399;
const PORTA_ADMIN = 3399 + 1;

const ambiente = {
  APP_ENV: 'teste',
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  DATABASE_FILE: './data/runtime/e2e.db',
  API_PORT: String(PORTA_API),
  ADMIN_PORT: String(PORTA_ADMIN),
  CORS_ORIGINS: `http://localhost:${PORTA_ADMIN}`,
  NEXT_PUBLIC_API_URL: `http://localhost:${PORTA_API}`,
  ADMIN_AUTH_ENABLED: 'false',
  WHATSAPP_LIVE_ENABLED: 'false',
  OUTBOUND_CAMPAIGNS_ENABLED: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORTA_ADMIN}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    ...(executavel ? { launchOptions: { executablePath: executavel } } : {}),
  },
  webServer: [
    {
      command: 'npx tsx --no-warnings=ExperimentalWarning apps/api/src/server.ts',
      url: `http://localhost:${PORTA_API}/saude`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: ambiente,
    },
    {
      command: `npx next dev -p ${PORTA_ADMIN}`,
      cwd: 'apps/admin',
      url: `http://localhost:${PORTA_ADMIN}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: ambiente,
    },
  ],
});
