import { defineConfig, devices } from '@playwright/test';

const PORT = 8799;

/** Runs the production build (API + screens on one origin) against a fresh embedded database. */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { viewport: { width: 1366, height: 900 } } },
  ],
  webServer: {
    command: `rm -rf .data/e2e && vite build && tsx src/server/main.ts`,
    url: `http://localhost:${PORT}/v1/meta`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: 'production',
      PORT: String(PORT),
      DATA_DIR: '.data/e2e',
      DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      SESSION_SECRET: 'e2e-session-secret',
      MENTOR_ACCESS_CODE: 'mentor-e2e',
      ADMIN_ACCESS_CODE: 'admin-e2e',
      COURSE_PLATFORM_KEY: 'platform-e2e',
    },
  },
});
