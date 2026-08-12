#!/usr/bin/env node
// _perf-probe-safari.mjs — WebKit lane for `maude design perf` (`perf.sh --engine safari`).
//
// Why this exists: the Chromium lane (`_perf-probe.mjs`) measured a 128-artboard
// canvas at a warm 60fps while the user was reporting unusable pan/zoom. The
// pain lives on WebKit — the Tauri desktop shell is WKWebView — and Blink
// simply does not reproduce it. Optimising against the engine that is already
// fast is how a performance project ships a refactor that changes nothing.
//
// Safari is not WKWebView, but it is the same engine family (JavaScriptCore +
// WebKit compositing + WebKit's `will-change` / re-raster semantics), which is
// what the hypotheses under test are about. Treat it as the closest measurable
// proxy, not as the desktop shell itself.
//
// Drives Safari through safaridriver's W3C WebDriver server over plain HTTP —
// no client library, keeping the dev-server's zero-dependency posture. Requires
// a one-time `safaridriver --enable` (admin auth), done by the operator.
//
// Usage:
//   node _perf-probe-safari.mjs --url <canvas-shell-url> [--label <name>]
//        [--history <path>] [--variant <tag>] [--inject-css <css>]
//        [--pan N] [--zoom N] [--repeat N] [--timeout S] [--driver-port N] [--json]

import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  buildRow,
  harnessSource,
  medianOf,
  readHistory,
  renderReport,
  validateResult,
} from './_perf-shared.mjs';

function parseArgs(argv) {
  const out = {
    url: '',
    label: '',
    history: '',
    variant: '',
    injectCss: '',
    pan: 60,
    zoom: 40,
    repeat: 3,
    timeout: 60,
    driverPort: 4488,
    fitAll: false,
    setFlags: [],
    studio: '',
    parentCss: '',
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--label') out.label = argv[++i];
    else if (a === '--history') out.history = argv[++i];
    else if (a === '--variant') out.variant = argv[++i];
    else if (a === '--inject-css') out.injectCss = argv[++i];
    else if (a === '--pan') out.pan = Number(argv[++i]);
    else if (a === '--zoom') out.zoom = Number(argv[++i]);
    else if (a === '--repeat') out.repeat = Number(argv[++i]);
    else if (a === '--timeout') out.timeout = Number(argv[++i]);
    else if (a === '--driver-port') out.driverPort = Number(argv[++i]);
    else if (a === '--fit-all') out.fitAll = true;
    else if (a === '--set-flag') out.setFlags.push(argv[++i]);
    else if (a === '--studio') out.studio = argv[++i];
    else if (a === '--parent-css') out.parentCss = argv[++i];
    else if (a === '--json') out.json = true;
    else {
      console.error(`_perf-probe-safari.mjs: unknown arg '${a}'`);
      process.exit(2);
    }
  }
  if (!out.url) {
    console.error('_perf-probe-safari.mjs: --url is required');
    process.exit(2);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wd(port, method, path, body) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (json?.value?.error) {
    throw new Error(`${json.value.error}: ${json.value.message}`);
  }
  return json.value;
}

/**
 * Is a real W3C WebDriver answering on this port?
 *
 * "Something responded" is not the same question. A same-UID process squatting
 * the port would receive the harness, the URLs under test and any --parent-css,
 * and could answer with whatever it likes — and this probe trusts driver
 * responses. So check that the body has the W3C `value.ready` shape before
 * adopting a listener we did not start.
 */
async function statusLooksLikeWebDriver(port) {
  try {
    const res = await fetch(`http://localhost:${port}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    const json = await res.json();
    return !!json && typeof json === 'object' && typeof json.value?.ready === 'boolean';
  } catch {
    return false;
  }
}

/**
 * Start safaridriver unless a real one is already listening. Returns the child
 * we spawned (so the caller can kill it) or null when we adopted an existing
 * driver — leaving a browser-automation server running after every benchmark
 * would be its own small hazard.
 */
async function ensureDriver(port) {
  if (await statusLooksLikeWebDriver(port)) return null;
  const child = spawn('safaridriver', ['-p', String(port)], { stdio: 'ignore' });
  for (let i = 0; i < 15; i++) {
    await sleep(500);
    if (await statusLooksLikeWebDriver(port)) return child;
  }
  child.kill();
  throw new Error(
    `nothing that looks like a W3C driver answered on :${port}. ` +
      'Run `safaridriver --enable` once (needs admin auth), and check nothing else holds the port.'
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!Number.isInteger(opts.driverPort) || opts.driverPort < 1024 || opts.driverPort > 65535) {
    console.error('_perf-probe-safari.mjs: --driver-port must be an integer in [1024, 65535]');
    process.exit(2);
  }
  const driverChild = await ensureDriver(opts.driverPort);

  let sessionId = null;
  try {
    const created = await wd(opts.driverPort, 'POST', '/session', {
      capabilities: { alwaysMatch: { browserName: 'safari' } },
    });
    sessionId = created.sessionId;
  } catch (err) {
    console.error(
      `_perf-probe-safari.mjs: could not create a Safari session — ${err.message}\n` +
        'If it says "already paired", quit Safari (or `pkill -x safaridriver`) and retry.'
    );
    // This exit bypasses the `finally` below, so the driver has to be cleaned up
    // here: session-refused ("already paired") is exactly the path a retry loop
    // hits, and each attempt would otherwise leave another driver behind.
    if (driverChild) driverChild.kill();
    process.exit(1);
  }

  const base = `/session/${sessionId}`;
  const exec = (script, args = []) =>
    wd(opts.driverPort, 'POST', `${base}/execute/sync`, { script, args });

  try {
    // A real, visible window — WebKit throttles rAF in occluded/background
    // windows, and a throttled measurement would read as catastrophic jank
    // that no user is experiencing.
    await wd(opts.driverPort, 'POST', `${base}/window/rect`, {
      x: 0,
      y: 0,
      width: 1600,
      height: 1000,
    });
    await wd(opts.driverPort, 'POST', `${base}/url`, { url: opts.url });

    // Studio mode measures the canvas AS THE USER RUNS IT: inside the studio
    // shell's iframe, not as a bare `_canvas-shell.html` page. That difference
    // is not cosmetic — the canvas postMessages `active-artboard` to the parent
    // on every viewport publish, and the parent answers with a setState in the
    // 15k-line studio component (app.jsx, the 'active-artboard' branch). A
    // shell-only probe never pays that cost, so it can report a comfortable
    // 60fps for a canvas the user finds unusable.
    if (opts.studio) {
      const rowSel = `[data-testid="canvas-row-${opts.studio}"]`;
      let clicked = false;
      for (let i = 0; i < 20; i++) {
        const ok = await exec(
          `const el = document.querySelector(${JSON.stringify(rowSel)}); if (el) { el.click(); return true; } return false;`
        );
        if (ok) {
          clicked = true;
          break;
        }
        await sleep(1000);
      }
      if (!clicked) {
        console.error(
          `_perf-probe-safari.mjs: no ${rowSel} in the studio file tree — check the slug`
        );
        process.exit(1);
      }
      // Wait for the frame, then switch WebDriver's context into it. The canvas
      // runs on its own origin (DDR-054), so script cannot reach it from the
      // parent — WebDriver frame switching is the only way in.
      let frameFound = false;
      for (let i = 0; i < 30; i++) {
        await sleep(1000);
        const n = await exec(
          'return document.querySelectorAll(\'[data-testid="canvas-frame"]\').length;'
        );
        if (Number(n) > 0) {
          frameFound = true;
          break;
        }
      }
      if (!frameFound) {
        console.error('_perf-probe-safari.mjs: canvas-frame iframe never appeared');
        process.exit(1);
      }
      // Parent-side CSS lever. The canvas lives on its own origin, so the
      // in-frame --inject-css cannot reach the studio chrome that wraps it —
      // and the studio wrapper is exactly what this mode exists to interrogate.
      if (opts.parentCss) {
        await exec(
          `const st = document.createElement('style'); st.id = 'maude-perf-parent'; st.textContent = arguments[0]; document.head.appendChild(st);`,
          [opts.parentCss]
        );
        await sleep(500);
      }

      const frameEl = await wd(opts.driverPort, 'POST', `${base}/element`, {
        using: 'css selector',
        value: '[data-testid="canvas-frame"]',
      });
      await wd(opts.driverPort, 'POST', `${base}/frame`, { id: frameEl });
    }

    let ready = false;
    for (let i = 0; i < opts.timeout; i++) {
      await sleep(1000);
      const n = await exec("return document.querySelectorAll('[data-dc-screen]').length;");
      if (Number(n) > 0) {
        ready = true;
        break;
      }
    }
    if (!ready) {
      console.error(
        `_perf-probe-safari.mjs: no [data-dc-screen] after ${opts.timeout}s — wrong URL, or the canvas failed to mount`
      );
      process.exit(1);
    }

    const passes = [];
    const total = Math.max(1, opts.repeat);
    for (let i = 0; i < total; i++) {
      const started = await exec(
        `return ${harnessSource({ pan: opts.pan, zoom: opts.zoom, injectCss: opts.injectCss, fitAll: opts.fitAll, setFlags: opts.setFlags })};`
      );
      if (started === 'NO_HOST') {
        console.error('_perf-probe-safari.mjs: no .dc-canvas host on the page');
        process.exit(1);
      }
      let r = null;
      for (let t = 0; t < opts.timeout; t++) {
        await sleep(1000);
        const raw = await exec('return JSON.stringify(window.__maudePerfResult);');
        if (raw && raw !== 'null') {
          r = validateResult(JSON.parse(raw));
          if (!r) {
            console.error(
              '_perf-probe-safari.mjs: the page returned a malformed result — refusing to print or ' +
                'record it. window.__maudePerfResult lives in the untrusted canvas origin (DDR-054).'
            );
            process.exit(1);
          }
          break;
        }
      }
      if (!r) {
        console.error(`_perf-probe-safari.mjs: gesture never completed within ${opts.timeout}s`);
        process.exit(1);
      }
      if (!r.panApplied || !r.zoomApplied) {
        console.error(
          `_perf-probe-safari.mjs: gesture did not reach the canvas on pass ${i + 1} ` +
            `(pan: ${r.panApplied}, zoom: ${r.zoomApplied}) — refusing to record a meaningless row.`
        );
        process.exit(1);
      }
      if (i > 0 || total === 1) passes.push(r);
      process.stderr.write(
        `→ pass ${i + 1}/${total}: gesture p95 ${r.gesture.p95}ms` +
          `${i === 0 && total > 1 ? ' (warm-up, discarded)' : ''}\n`
      );
    }

    const result = medianOf(passes);
    const label = (opts.label || opts.url) + (opts.variant ? ` [${opts.variant}]` : '');
    const engineTag = 'webkit-safari';
    const prev = readHistory(opts.history, label, engineTag);
    const row = buildRow({ result, label, engineTag, opts });

    if (opts.history) {
      mkdirSync(dirname(opts.history), { recursive: true });
      appendFileSync(opts.history, `${JSON.stringify(row)}\n`, 'utf8');
    }
    if (opts.json) {
      console.log(JSON.stringify({ current: row, previous: prev }, null, 2));
    } else {
      console.log(renderReport({ row, prev, opts, label, engineTag }));
    }
  } finally {
    if (sessionId) {
      await wd(opts.driverPort, 'DELETE', base).catch(() => {});
    }
    // Only kill a driver this run started; an adopted one belongs to whoever
    // started it.
    if (driverChild) driverChild.kill();
  }
}

main().catch((err) => {
  console.error(`_perf-probe-safari.mjs: ${err.message}`);
  process.exit(1);
});
