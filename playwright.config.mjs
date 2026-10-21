import { defineConfig } from '@playwright/test';
const origin = process.env.BIOVITAI_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
if (
  !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin) ||
  Number(new URL(origin).port) > 65535
)
  throw new Error('Browser acceptance requires a loopback origin');
export default defineConfig({
  testDir: './tests/web',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    actionTimeout: 15_000,
    baseURL: origin,
    browserName: 'chromium',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
