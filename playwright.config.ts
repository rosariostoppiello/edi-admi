import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

/**
 * Tests e2e contra una base aparte (DATABASE_URL_TEST), que el globalSetup
 * migra y llena con el seed ficticio antes de cada corrida.
 */
const PUERTO = 3100;
const URL_BASE = `http://localhost:${PUERTO}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: URL_BASE,
    locale: "es-UY",
    timezoneId: "America/Montevideo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx next start -p ${PUERTO}`,
    url: `${URL_BASE}/ingresar`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
      BETTER_AUTH_URL: URL_BASE,
      MAIL_DRIVER: "archivo",
      MAIL_DIR: "storage/mails-e2e",
      AUTH_MAX_INTENTOS_LOGIN: "200",
      AUTH_MAX_PEDIDOS_RESET: "50",
    },
  },
});
