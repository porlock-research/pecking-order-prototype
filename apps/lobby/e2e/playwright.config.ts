import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const AUTH_DIR = path.join(__dirname, '.auth');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // Sequential — create-game must complete before join reads output
  retries: 0,
  reporter: [['html', { open: 'never', outputFolder: './playwright-report' }]],
  outputDir: './test-results',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npx turbo run dev --filter=game-server',
      cwd: '../../..',
      port: 8787,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npx turbo run dev --filter=lobby-service',
      cwd: '../../..',
      port: 3000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(AUTH_DIR, 'player1.json'),
      },
      dependencies: ['setup'],
    },
  ],
});
