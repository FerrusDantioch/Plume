// Configuration des tests automatiques (Playwright).
// Lancer les tests : dans le dossier tests, taper « npm test ».

import { defineConfig, devices } from '@playwright/test';

const PORT = 8123;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  outputDir: './resultats',
  use: {
    baseURL: `http://localhost:${PORT}/plume/`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  webServer: {
    command: `node ../outils/serveur.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/plume/`,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'ordinateur',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      testIgnore: /telephone\.spec\.js/,
    },
    {
      name: 'telephone',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      testMatch: /telephone\.spec\.js/,
    },
  ],
});
