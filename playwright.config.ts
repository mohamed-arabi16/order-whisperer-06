import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  webServer: {
    // Use the development server for testing to enable mocking.
    command: 'bun run dev --port 8080',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // Set the environment to development to match the dev server.
      NODE_ENV: 'development',
    },
  },

  use: {
    // Update the baseURL to match the dev server port.
    baseURL: 'http://localhost:8080',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
});