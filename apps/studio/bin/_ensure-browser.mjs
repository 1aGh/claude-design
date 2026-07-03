// _ensure-browser.mjs — resolve (and if needed download) a headless Chromium for
// screenshots. Prints the resolved browser executable path to stdout.
//
// Screenshots (agent-browser preferred, playwright fallback) need a Chrome-family
// engine. On a fresh desktop machine there's no globally-installed browser, so we
// provision `chrome-headless-shell` — the ~94 MB headless-ONLY Chrome-for-Testing
// build (vs ~172 MB full Chrome) — on first need into a machine-global Maude
// cache, and screenshot.sh points `AGENT_BROWSER_EXECUTABLE_PATH` at it. Verified
// end-to-end: agent-browser + a headless-shell renders a Maude canvas faithfully.
//
// Resolution priority (first hit wins):
//   1. MAUDE_BROWSER_EXECUTABLE / AGENT_BROWSER_EXECUTABLE_PATH override (if valid)
//   2. a Maude-cached chrome-headless-shell (previous provision)
//   3. a Playwright chromium-headless-shell already on disk (~/.cache/ms-playwright)
//   4. system Google Chrome / Chromium
//   5. download chrome-headless-shell → cache  (skipped under --no-download)
//
// Flags: --no-download (resolve only — for readiness probes, never triggers a
// 94 MB fetch) · --json · --quiet.

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const NO_DOWNLOAD = args.includes('--no-download');
const JSON_OUT = args.includes('--json');
const QUIET = args.includes('--quiet') || JSON_OUT;

const log = (m) => {
  if (!QUIET) process.stderr.write(`${m}\n`);
};

const CDN_VERSIONS =
  'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';

// The download URL comes from a remote manifest and its bytes are chmod +x'd and
// executed — pin the scheme + host so a tampered/redirecting manifest can't point
// us at http:// or a foreign host (defender F2). Chrome-for-Testing artifacts live
// on storage.googleapis.com; the manifest on googlechromelabs.github.io.
export const CDN_HOSTS = new Set(['storage.googleapis.com', 'googlechromelabs.github.io']);
// The CfT version string flows into cache paths and (on Windows) a PowerShell
// `-Command` string, so validate it before ANY use (defender F3).
export const CFT_VERSION_RE = /^[0-9]+(?:\.[0-9]+)*$/;

/** True when a resolved download URL is https + an allowlisted CDN host (defender F2). */
export function isTrustedDownloadUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && CDN_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/** Machine-global cache (shared across projects) — NOT the per-project .ai/cache. */
function browsersDir() {
  return process.env.MAUDE_BROWSERS_DIR || join(homedir(), '.maude', 'browsers');
}

/** node/bun platform → Chrome-for-Testing platform slug (null = no CfT build). */
function cftPlatform() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin') return a === 'arm64' ? 'mac-arm64' : 'mac-x64';
  if (p === 'win32') return a === 'arm64' ? null : 'win64';
  if (p === 'linux') return a === 'arm64' ? null : 'linux64'; // CfT ships no linux-arm64
  return null;
}

/** The headless-shell executable's basename for this platform. */
function shellExeName() {
  return process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
}

function isRunnable(p) {
  try {
    return !!p && existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Recursively find the first `chrome-headless-shell[.exe]` under dir. */
function findShell(dir) {
  if (!existsSync(dir)) return null;
  const want = shellExeName();
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name === want && isRunnable(full)) return full;
    }
  }
  return null;
}

/** (2) A previously-provisioned headless-shell in the Maude cache. */
function cachedShell() {
  return findShell(browsersDir());
}

/** (3) A Playwright chromium-headless-shell already installed. */
function playwrightShell() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), 'Library', 'Caches', 'ms-playwright'), // macOS
    join(homedir(), '.cache', 'ms-playwright'), // linux
    join(process.env.LOCALAPPDATA || '', 'ms-playwright'), // windows
  ].filter(Boolean);
  for (const r of roots) {
    const hit = findShell(r);
    if (hit) return hit;
  }
  return null;
}

/** (4) System Chrome / Chromium — a full browser is fine for headless capture. */
function systemChrome() {
  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        ]
      : process.platform === 'win32'
        ? [
            join(
              process.env.PROGRAMFILES || 'C:/Program Files',
              'Google/Chrome/Application/chrome.exe'
            ),
            join(
              process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)',
              'Google/Chrome/Application/chrome.exe'
            ),
          ]
        : [];
  for (const c of candidates) if (isRunnable(c)) return c;
  // PATH lookup (linux `google-chrome` / `chromium`, or any platform).
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      const p = execFileSync(process.platform === 'win32' ? 'where' : 'command', ['-v', bin], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\n')[0]
        .trim();
      if (isRunnable(p)) return p;
    } catch {
      /* not on PATH */
    }
  }
  return null;
}

function unzip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  // Prefer `unzip` (macOS/Linux); fall back to bsdtar (`tar -xf` handles zip on
  // macOS + Windows 10+), then PowerShell on Windows.
  const attempts =
    process.platform === 'win32'
      ? [
          ['tar', ['-xf', zipPath, '-C', destDir]],
          [
            'powershell',
            [
              '-NoProfile',
              '-Command',
              `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'`,
            ],
          ],
        ]
      : [
          ['unzip', ['-q', '-o', zipPath, '-d', destDir]],
          ['tar', ['-xf', zipPath, '-C', destDir]],
        ];
  let lastErr;
  for (const [cmd, a] of attempts) {
    try {
      execFileSync(cmd, a, { stdio: 'ignore' });
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`unzip failed (${lastErr?.message ?? 'no extractor'})`);
}

/** (5) Download chrome-headless-shell for this platform into the Maude cache. */
async function downloadShell() {
  const plat = cftPlatform();
  if (!plat) {
    log(`ensure-browser: no Chrome-for-Testing build for ${process.platform}/${process.arch}`);
    return null;
  }
  log('ensure-browser: no browser found — downloading chrome-headless-shell (~94 MB, one-time)…');
  const versions = await fetch(CDN_VERSIONS).then((r) => r.json());
  const stable = versions.channels?.Stable;
  const version = stable?.version;
  // F3 — reject a suspicious version before it reaches a path or a shell string.
  if (typeof version !== 'string' || !CFT_VERSION_RE.test(version)) {
    log(`ensure-browser: refusing malformed Chrome-for-Testing version ${JSON.stringify(version)}`);
    return null;
  }
  const url = (stable?.downloads?.['chrome-headless-shell'] || []).find(
    (d) => d.platform === plat
  )?.url;
  if (!url) {
    log(`ensure-browser: CDN has no chrome-headless-shell for ${plat}`);
    return null;
  }
  // F2 — the resolved URL is remote-controlled + its bytes get executed. Pin
  // https + an allowlisted host so a tampered manifest/redirect can't land a
  // foreign or plaintext-fetched binary. (CDN-of-record compromise is the
  // accepted residual — same trust anchor Playwright/Puppeteer rely on.)
  if (!isTrustedDownloadUrl(url)) {
    log(`ensure-browser: refusing non-allowlisted download URL ${url}`);
    return null;
  }
  // F3 — the cache is exec-forever, so keep it 0700 (only this user can plant a
  // binary that later runs as the screenshot engine). Created before the download.
  mkdirSync(browsersDir(), { recursive: true, mode: 0o700 });
  try {
    chmodSync(browsersDir(), 0o700);
  } catch {
    /* pre-existing dir owned by another mode — best-effort */
  }
  const dest = join(browsersDir(), `chrome-headless-shell-${version}-${plat}`);
  if (findShell(dest)) return findShell(dest); // concurrent provision won the race
  const tmp = join(tmpdir(), `maude-hshell-${version}-${plat}.zip`);
  // F1 — do NOT follow redirects: the host allowlist above validated THIS url, but
  // a 3xx would bounce us to an unvalidated host. The CfT CDN serves the artifact
  // directly (200), so redirect:'error' fails safe instead of chasing a redirect.
  const buf = Buffer.from(await fetch(url, { redirect: 'error' }).then((r) => r.arrayBuffer()));
  const { writeFileSync } = await import('node:fs');
  writeFileSync(tmp, buf);
  // Extract to a sibling temp dir, then atomically rename into place.
  const staging = `${dest}.staging-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  unzip(tmp, staging);
  rmSync(tmp, { force: true });
  rmSync(dest, { recursive: true, force: true });
  renameSync(staging, dest);
  const exe = findShell(dest);
  if (exe && process.platform !== 'win32') chmodSync(exe, 0o755);
  log(`ensure-browser: installed → ${exe}`);
  return exe;
}

/**
 * Resolve a screenshot browser executable. `download:false` resolves an EXISTING
 * browser only (for readiness probes — never fetches ~94 MB). Exported so the
 * dev-server readiness probe can resolve in-process without spawning.
 */
export async function resolveBrowser({ download = true } = {}) {
  // (1) explicit override
  const override =
    process.env.MAUDE_BROWSER_EXECUTABLE || process.env.AGENT_BROWSER_EXECUTABLE_PATH;
  if (isRunnable(override)) return { path: override, source: 'override' };
  // (2) Maude cache
  const cached = cachedShell();
  if (cached) return { path: cached, source: 'cache' };
  // (3) Playwright headless-shell
  const pw = playwrightShell();
  if (pw) return { path: pw, source: 'playwright' };
  // (4) system Chrome
  const sys = systemChrome();
  if (sys) return { path: sys, source: 'system' };
  // (5) download (unless probing)
  if (!download) return { path: null, source: 'none' };
  const dl = await downloadShell();
  return { path: dl, source: dl ? 'downloaded' : 'none' };
}

// CLI entry — only when invoked directly (not when imported by readiness.ts).
// `import.meta.main` is the reliable "am I the entry module?" flag under `bun
// --compile`: the argv/url string compare below FALSELY matched inside the
// standalone binary (embedded modules resolve to /$bunfs/root while argv[1] is
// the binary path), so this block fired on plain import and killed the server
// with a stray browser-path print + process.exit before Bun.serve ever ran —
// the v0.38.0 "Starting…" hang (DDR-045-class compiled-path divergence). Bun
// sets import.meta.main=false for imported modules; Node <24 leaves it
// undefined, so fall back to the argv compare for the `node`-fallback CLI path
// in ensure-browser.sh (a non-compiled process where that compare is correct).
const runDirectly =
  import.meta.main ?? (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
if (runDirectly) {
  const result = await resolveBrowser({ download: !NO_DOWNLOAD });
  if (JSON_OUT) {
    process.stdout.write(
      `${JSON.stringify({ ...result, name: result.path ? basename(result.path) : null })}\n`
    );
  } else if (result.path) {
    process.stdout.write(`${result.path}\n`);
  }
  process.exit(result.path ? 0 : 1);
}
