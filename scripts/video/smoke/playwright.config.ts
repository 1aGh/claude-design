import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Resolve outputDir as an absolute path so it's independent of cwd. Playwright
// resolves a relative outputDir against the config file directory (NOT against
// cwd), which produces a doubly-nested location like
// scripts/video/smoke/scripts/video/.work/...
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'scripts/video/.work/smoke/playwright');

export default defineConfig({
  testDir: '.',
  testMatch: 'browser.spec.ts',
  outputDir: OUTPUT_DIR,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
