import { defineConfig, devices } from '@playwright/test';
import * as dotenv from "dotenv";
dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  globalSetup: './fixtures/global-setup.ts',
  globalTeardown: './fixtures/global-teardown.ts',
  timeout: 60 * 1000,
  retries: 0,
  workers: 4,
  use: {
    baseURL: process.env.BASE_URL || "https://staging-api.example.com",
    extraHTTPHeaders: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
    },
  },
  projects: [
    {
      name: 'Chromium',
      testDir: './tests/ui',
      use: { browserName: 'chromium' },
    },
    // {
    //   name: 'Firefox',
    //   testDir: './tests/ui',
    //   use: { browserName: 'firefox' },
    // },
    // {
    //   name: 'WebKit',
    //   testDir: './tests/ui',
    //   use: { browserName: 'webkit' },
    // },

    // --- Mobile Emulation ---
    // {
    //   name: 'Mobile Safari',
    //   testDir: './tests/ui',
    //   use: { ...devices['iPhone 13'] },
    // },

    // // --- Branded Browsers ---
    // {
    //   name: 'Google Chrome',
    //   testDir: './tests/ui',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
    // {
    //   name: 'Microsoft Edge',
    //   testDir: './tests/ui',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // ================= API PROJECT =================
    {
      name: 'API',
      testDir: './tests/api',
      use: {
        browserName: 'chromium', // required internally but not used
        headless: true,
      },
    }
  ],
  reporter: [['list'], ['html', { outputFolder: 'reports' }],["json", { outputFile: "playwright-report/results.json" }],
    [
      "allure-playwright",
      {
        resultsDir: "allure-results",
      },
    ],
  ],
});
