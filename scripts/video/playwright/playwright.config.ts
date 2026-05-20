import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Phase 15.5-style browser captures at 1920×1080.
// Outputs to scripts/video/.work/playwright/ (separate from smoke).
// outputDir absolute (Playwright resolves relative paths against config dir,
// not cwd — known gotcha from phase 15 retro).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'scripts/video/.work/playwright');

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: OUTPUT_DIR,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    // 1280×720 matches the dev-server UI's natural max-width container;
    // capturing at 1920×1080 leaves ~33% empty grey baked into the source.
    // Remotion <OffthreadVideo> upscales it cleanly inside the mock browser
    // chrome via objectFit:cover.
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
