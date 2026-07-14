// Browser-driven piece of DDR-173's brand-logo hardening — the raster
// fallback for a logo whose wordmark was live `<text>` (Decision 6). Spawns
// a real agent-browser session, so this is slower than import-brand.test.ts
// and is skipped (not failed) when agent-browser can't be resolved,
// mirroring import-asset-browser.test.ts's treatment of browser-dependent
// verification as a real-environment concern rather than a hard CI
// requirement.

import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { importBrand } from '../bin/_import-brand.mjs';

function agentBrowserAvailable(): boolean {
  try {
    execFileSync(process.env.MAUDE_AGENT_BROWSER_BIN || 'agent-browser', ['--version'], {
      stdio: 'ignore',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

const HAS_AGENT_BROWSER = agentBrowserAvailable();
const d = HAS_AGENT_BROWSER ? describe : describe.skip;

function tmpDesignRoot() {
  const root = mkdtempSync(join(tmpdir(), 'maude-import-brand-'));
  return root;
}

d('importBrand — end-to-end orchestration (Decision 6 raster fallback)', () => {
  test('a logo with a live wordmark: extracts palette, writes a hardened vector asset, and rasterizes a PNG fallback', async () => {
    const root = tmpDesignRoot();
    const svgPath = join(root, 'logo.svg');
    writeFileSync(
      svgPath,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 96">
        <rect width="240" height="96" fill="#0d0d0f"/>
        <circle cx="40" cy="48" r="20" fill="#6b6bf0"/>
        <text x="70" y="56" font-family="Inter, sans-serif" font-size="24" fill="#ffffff">Acme</text>
      </svg>`
    );

    const result = await importBrand({ sanitizedSvgPath: svgPath, root, designRootRel: '.design' });

    expect(result.hadWordmarkText).toBe(true);
    expect(result.palette).toContain('#0d0d0f');
    expect(result.palette).toContain('#6b6bf0');
    expect(result.logoRasterRef).not.toBeNull();
    const logoRasterRef = result.logoRasterRef;
    if (!logoRasterRef) throw new Error('expected logoRasterRef to be set');

    const vectorPath = join(root, '.design', result.logoRef);
    expect(existsSync(vectorPath)).toBe(true);
    const vectorText = readFileSync(vectorPath, 'utf8');
    expect(vectorText).not.toContain('Acme'); // wordmark text stripped from the vector

    const rasterPath = join(root, '.design', logoRasterRef);
    expect(existsSync(rasterPath)).toBe(true);
    const rasterBytes = readFileSync(rasterPath);
    // Real PNG magic bytes — confirms the sandboxed-render screenshot actually produced an image.
    expect(rasterBytes[0]).toBe(0x89);
    expect(rasterBytes[1]).toBe(0x50);
    expect(rasterBytes[2]).toBe(0x4e);
    expect(rasterBytes[3]).toBe(0x47);
  }, 45_000);

  test('a logo with NO live text: no raster fallback is produced (nothing lost by the strip)', async () => {
    const root = tmpDesignRoot();
    const svgPath = join(root, 'icon.svg');
    writeFileSync(
      svgPath,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="#4f46e5"/></svg>`
    );

    const result = await importBrand({ sanitizedSvgPath: svgPath, root, designRootRel: '.design' });

    expect(result.hadWordmarkText).toBe(false);
    expect(result.logoRasterRef).toBeNull();
    expect(result.palette).toEqual(['#4f46e5']);
  }, 30_000);
});
