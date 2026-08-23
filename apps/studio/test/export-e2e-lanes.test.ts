// export-e2e-lanes.test.ts — DDR-231 Phase 2 T7.
//
// The end-to-end export test the first live cloud run needed and did not have.
//
// Every export gate before this one tested a LAYER: `capture-core` against a
// synthetic fixture, lane resolution as pure data, the render service's body
// validation over curl. All of them were green while a real member's PNG came
// out carrying the artboard's title bar and with every photo missing — because
// nothing drove the actual Export dialog against an actual canvas and looked
// at the actual file.
//
// So this boots a REAL workspace-shaped studio, opens the REAL dialog in
// Chromium, clicks Export, catches the download, and asserts the bytes:
//
//   * no editor chrome in the artifact (the `.dc-artboard-label` leak)
//   * no remote resource refs, and the artboard's image actually embedded
//     (the dom-to-svg inlining defect — see capture-core.inlineCaptureResources)
//   * the export is visible afterwards: a status line, and a ledger row
//     (the "modal closes and I see nothing" report)
//
// Lane note: `MAUDE_WORKSPACE_MODE=1` with NO `MAUDE_RENDER_URL` resolves to
// lane `none`, which is precisely the browser lane with its jobs-lane fallback
// removed. That makes this test both fast and honest — nothing can silently
// pass because the render service quietly did the work instead.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

/** 8×8 solid-green PNG — big enough that a dropped image is unmistakable. */
const PNG_8PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR42mNkYPhfz0BFwDiq' +
    'YVTDsNAAAOKcA/3fzWvKAAAAAElFTkSuQmCC',
  'base64'
);

const CANVAS_TSX = `import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";

export default function ExportE2E() {
  return (
    <DesignCanvas>
      <DCSection id="s" title="Export E2E">
        <DCArtboard id="board-a" label="Board A · export fixture" width={400} height={260}>
          <div style={{ padding: 24, background: "#132038", color: "#f2efe6", height: "100%" }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>Summer Camp</h1>
            <img src="assets/pic.png" width={96} height={96} alt="fixture" />
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
`;

/** Build a sandbox whose canvas has BOTH defect surfaces: editor chrome (the
 * artboard label is rendered by canvas-lib itself) and a real image asset. */
function makeExportSandbox() {
  const box = makeSandbox();
  mkdirSync(join(box.designRoot, 'assets'), { recursive: true });
  writeFileSync(join(box.designRoot, 'assets', 'pic.png'), PNG_8PX);
  writeFileSync(join(box.designRoot, 'ui', 'e2e-export.tsx'), CANVAS_TSX);
  return box;
}

interface PwPage {
  goto(url: string, o?: unknown): Promise<unknown>;
  keyboard: { press(k: string): Promise<void> };
  click(sel: string, o?: unknown): Promise<void>;
  waitForSelector(sel: string, o?: unknown): Promise<unknown>;
  selectOption(sel: string, v: string): Promise<unknown>;
  textContent(sel: string): Promise<string | null>;
  waitForEvent(e: string, o?: unknown): Promise<PwDownload>;
  evaluate<T>(fn: (...a: never[]) => T, arg?: unknown): Promise<T>;
  waitForFunction(fn: (...a: never[]) => unknown, arg?: unknown, o?: unknown): Promise<unknown>;
  on(e: string, fn: (x: unknown) => void): void;
  frames(): Array<{ url(): string; waitForSelector(s: string, o?: unknown): Promise<unknown> }>;
}
interface PwDownload {
  suggestedFilename(): string;
  path(): Promise<string>;
}

/**
 * Open the studio, open a canvas, and open the Export dialog.
 * Returns the page plus a `download(format)` driver.
 */
async function openExportDialog(port: number) {
  const { launchChromium } = (await import('../bin/_pw-launch.mjs')) as {
    launchChromium: () => Promise<{
      newContext: (o: unknown) => Promise<{ newPage: () => Promise<PwPage> }>;
      close: () => Promise<void>;
    }>;
  };
  const browser = await launchChromium();
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
  // Open the canvas from the tree — the artboard must be MOUNTED for the
  // browser lane to have anything to capture.
  await page.waitForSelector('[data-testid="canvas-list"]', { timeout: 30_000 });
  await page.click('[data-testid="canvas-row-ui-e2e-export"]', { timeout: 30_000 });
  await page.waitForSelector('[data-testid="canvas-frame"]', { timeout: 30_000 });
  // The capture reaches INTO the canvas iframe, which the shell's own DOM
  // cannot see through — the canvas runs on its own origin (DDR-054), so
  // `contentDocument` is null from page scripts (memory
  // `maude-canvas-iframe-unreachable-by-dom`). Playwright is not bound by the
  // same-origin policy, so drive the FRAME directly.
  const deadline = Date.now() + 60_000;
  for (;;) {
    const frame = page
      .frames()
      .find((f) => f.url().includes('_canvas-shell') || f.url().includes('canvas='));
    if (frame) {
      try {
        await frame.waitForSelector('[data-dc-screen]', { timeout: 5_000 });
        break;
      } catch {
        /* still building — the first load transpiles the canvas */
      }
    }
    if (Date.now() > deadline) throw new Error('artboard never mounted in the canvas iframe');
    await Bun.sleep(250);
  }
  // ⌘⇧E opens the dialog. Dispatch it on the SHELL window rather than through
  // `keyboard.press`: once the canvas iframe has mounted it holds focus, and a
  // synthetic keypress would be delivered to the iframe's document instead of
  // the shell's (the shortcut handler is a shell `window` listener). Focus
  // routing is not what this test is about — the dialog, the lane and the
  // artifact are.
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'E', metaKey: true, shiftKey: true, bubbles: true })
    );
  });
  await page.waitForSelector('[data-testid="export-submit"]', { timeout: 15_000 });
  return { browser, page };
}

/**
 * Click Export and return the download — but surface an ERROR STATUS as a
 * failure instead of blocking on a download that will never arrive. Without
 * this a refused export (the viewer-role 403 on `/_api/export-assemble`, found
 * exactly this way) reads as a test timeout with no cause attached.
 */
async function exportAndDownload(page: PwPage, timeoutMs = 180_000): Promise<PwDownload> {
  const failed = page
    .waitForSelector('[data-testid="export-status"][data-ok="0"]', { timeout: timeoutMs })
    .then(async () => {
      throw new Error(`export failed: ${await page.textContent('[data-testid="export-status"]')}`);
    });
  const [download] = await Promise.all([
    Promise.race([page.waitForEvent('download', { timeout: timeoutMs }), failed]),
    page.click('[data-testid="export-submit"]'),
  ]);
  return download as PwDownload;
}

/**
 * Wait for the dialog to report the export finished.
 *
 * `waitForEvent('download')` resolves when the download STARTS, but the dialog
 * sets its "Saved …" line only after the ledger write it awaits — so reading
 * the status straight after the download raced it, and the test failed roughly
 * one run in four while claiming the export was broken. Wait for the state
 * instead of assuming it has landed.
 */
async function waitForSavedStatus(page: PwPage): Promise<void> {
  await page.waitForFunction(
    () => !!document.querySelector('[data-testid="export-status"]')?.textContent?.includes('Saved'),
    undefined,
    { timeout: 30_000 }
  );
}

describe('export E2E — browser lane, real dialog, real artifact', () => {
  test(
    'PNG and SVG export with no editor chrome and every asset embedded',
    async () => {
      const box = makeExportSandbox();
      const port = nextPort();
      const proc = await bootServer(box.root, port, {
        MAUDE_WORKSPACE_MODE: '1',
        // The dev checkout carries playwright as a devDependency; the cell
        // image never does (scripts/check-containment.sh is the real gate).
        MAUDE_WORKSPACE_ALLOW_DEV_MODULES: '1',
      });
      let browser: { close(): Promise<void> } | null = null;
      try {
        const opened = await openExportDialog(port);
        browser = opened.browser;
        const { page } = opened;

        for (const format of ['png', 'svg'] as const) {
          await page.click(`[data-testid="export-format-${format}"]`);
          await page.selectOption('[data-testid="export-scope"]', 'artboard');
          const download = await exportAndDownload(page, 120_000);
          const file = await download.path();
          const bytes = await Bun.file(file).arrayBuffer();
          expect(bytes.byteLength).toBeGreaterThan(200);

          if (format === 'svg') {
            const svg = new TextDecoder().decode(bytes);
            // The two live defects, asserted on the delivered file.
            expect(svg).not.toContain('dc-artboard-label');
            expect(svg).not.toContain('Board A');
            expect(svg.match(/(?:xlink:)?href="https?:\/\/[^"]+"/g) ?? []).toEqual([]);
            expect(svg).toContain('data:image/png');
          } else {
            // PNG magic — a real raster, not an error page or an empty blob.
            const head = new Uint8Array(bytes.slice(0, 8));
            expect(Array.from(head)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
          }

          // The export must be VISIBLE when it finishes: the dialog says so…
          await waitForSavedStatus(page);
        }

        // The DECK: every artboard captured here, composed in-cell. The
        // reported symptom was a silent modal close with nothing to show for
        // it, so assert the artifact AND the finished status.
        await page.click('[data-testid="export-format-pptx"]');
        const deck = await exportAndDownload(page);
        const deckBytes = new Uint8Array(await Bun.file(await deck.path()).arrayBuffer());
        // PPTX is a zip — PK\x03\x04.
        expect(Array.from(deckBytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
        expect(deckBytes.byteLength).toBeGreaterThan(1000);
        await waitForSavedStatus(page);

        // …and it left a row in the ledger the Recent tab and the notification
        // center read (the Phase-1 gap: a browser-lane export wrote nothing).
        const history = (await (
          await fetch(`http://localhost:${port}/_api/export-history`)
        ).json()) as { history: Array<{ format: string; deliveredInBrowser?: boolean }> };
        const browserRows = history.history.filter((h) => h.deliveredInBrowser);
        expect(browserRows.map((h) => h.format).sort()).toEqual(['png', 'pptx', 'svg']);
      } finally {
        await browser?.close().catch(() => {});
        killProc(proc);
      }
    },
    { timeout: 300_000 }
  );

  test(
    'a format the chosen scope cannot render is refused before any job is created',
    async () => {
      // The reproduced production failure, driven through the HTTP surface the
      // dialog uses. Kept next to the UI test because the UI can no longer
      // PRODUCE this pair — the guarantee is that the server refuses it anyway.
      const box = makeExportSandbox();
      const port = nextPort();
      const proc = await bootServer(box.root, port, {
        MAUDE_WORKSPACE_MODE: '1',
        MAUDE_WORKSPACE_ALLOW_DEV_MODULES: '1',
        MAUDE_RENDER_URL: 'http://127.0.0.1:1',
      });
      try {
        for (const format of ['pdf', 'html']) {
          const r = await fetch(`http://localhost:${port}/_api/export-jobs`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: `http://localhost:${port}` },
            body: JSON.stringify({ format, scope: 'project-raw', options: {} }),
          });
          expect(r.status).toBe(400);
          const text = await r.text();
          expect(text).toContain('project-raw');
          // Names the way out, rather than the render service's old opaque
          // "invalid render job".
          expect(text).toContain('artboard');
        }
      } finally {
        killProc(proc);
      }
    },
    { timeout: 120_000 }
  );
});

/**
 * Spawn a real `maude-render` next to the studio.
 *
 * Its env is built from scratch rather than inherited: the service refuses to
 * boot if the environment carries ANY credential-shaped variable but its own
 * ingress bearer (DDR-230 §1, enforced at boot), and a developer shell
 * routinely carries several.
 */
async function bootRenderService(port: number, canvasOrigin: string, secret: string) {
  const { spawn } = await import('bun');
  const proc = spawn({
    cmd: ['bun', 'run', join(import.meta.dir, '..', '..', 'render', 'server.ts')],
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      PORT: String(port),
      MAUDE_RENDER_SECRET: secret,
      MAUDE_RENDER_CANVAS_ORIGINS: canvasOrigin,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/_health`, {
        signal: AbortSignal.timeout(300),
      });
      if (r.ok) return proc;
    } catch {
      /* not up yet */
    }
    await Bun.sleep(100);
  }
  proc.kill();
  throw new Error('render service did not start');
}

/** Poll the job ledger until this format's job finishes, then return it. */
async function waitForJob(port: number, format: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { history } = (await (
      await fetch(`http://localhost:${port}/_api/export-history`)
    ).json()) as {
      history: Array<{ id: string; format: string; status: string; error?: string }>;
    };
    const job = history.find((h) => h.format === format);
    if (job) return job;
    await Bun.sleep(500);
  }
  throw new Error(`no ${format} job finished within ${timeoutMs}ms`);
}

describe('export E2E — worker lane, real render service, real artifact', () => {
  test(
    'PDF and HTML render on maude-render and come back as real files',
    async () => {
      const box = makeExportSandbox();
      const studioPort = nextPort();
      const renderPort = nextPort();
      const secret = 'e2e-render-secret';
      const proc = await bootServer(box.root, studioPort, {
        MAUDE_WORKSPACE_MODE: '1',
        MAUDE_WORKSPACE_ALLOW_DEV_MODULES: '1',
        MAUDE_RENDER_URL: `http://127.0.0.1:${renderPort}`,
        MAUDE_RENDER_SECRET: secret,
      });
      let render: { kill(): void } | null = null;
      let browser: { close(): Promise<void> } | null = null;
      try {
        // The render worker fetches the canvas the way a member's browser
        // does — through the canvas origin, which only exists once the server
        // has bound both listeners.
        let canvasOrigin = '';
        const originDeadline = Date.now() + 20_000;
        while (Date.now() < originDeadline) {
          try {
            const cfg = (await (await fetch(`http://localhost:${studioPort}/_config`)).json()) as {
              canvasOrigin?: string;
            };
            if (cfg.canvasOrigin) {
              canvasOrigin = cfg.canvasOrigin;
              break;
            }
          } catch {
            /* not ready */
          }
          await Bun.sleep(200);
        }
        expect(canvasOrigin).not.toBe('');
        render = await bootRenderService(renderPort, canvasOrigin, secret);

        const opened = await openExportDialog(studioPort);
        browser = opened.browser;
        const { page } = opened;

        // These enqueue a background JOB rather than downloading in-page (the
        // notification center owns completion), so drive the real dialog to
        // submit and then assert the artifact the job produced.
        for (const format of ['pdf', 'html'] as const) {
          await page.click(`[data-testid="export-format-${format}"]`);
          await page.selectOption('[data-testid="export-scope"]', 'artboard');
          await page.click('[data-testid="export-submit"]');
          const job = await waitForJob(studioPort, format, 240_000);
          expect(`${format}: ${job.status} ${job.error ?? ''}`).toBe(`${format}: done `);
          const bytes = new Uint8Array(
            await (
              await fetch(`http://localhost:${studioPort}/_api/export-jobs/download?id=${job.id}`)
            ).arrayBuffer()
          );
          if (format === 'pdf') {
            expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
          } else {
            // html exports as a zip of pages — PK\x03\x04.
            expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
          }
          expect(bytes.byteLength).toBeGreaterThan(500);
          // Re-open the dialog for the next format (submitting closes it).
          await page.evaluate(() => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'E',
                metaKey: true,
                shiftKey: true,
                bubbles: true,
              })
            );
          });
          await page.waitForSelector('[data-testid="export-submit"]', { timeout: 15_000 });
        }
      } finally {
        await browser?.close().catch(() => {});
        render?.kill();
        killProc(proc);
      }
    },
    { timeout: 600_000 }
  );
});
