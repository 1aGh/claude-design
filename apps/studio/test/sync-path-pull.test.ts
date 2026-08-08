// Pulling a project into an EMPTY folder, through the real sync runtime.
//
// The unit tests around `canvas-path.ts` prove the rules; `apps/hub/test/`
// proves the two receivers. This proves the wiring between them on the desktop
// side — that the path is read from the DOCUMENT (not the listing, which cannot
// carry it), that the agent is built around the corrected path rather than the
// provisional one, that the canvas is written where the tree will find it, and
// that a folder with no `config.json` ends up with one describing what arrived.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import type { Context, DevServerConfig } from '../context.ts';
import { createBus } from '../context.ts';
import { createSyncRuntime, type SyncProvider } from '../sync/index.ts';

const URL_ = 'https://hub.example.com';
const NESTED_REL = 'ui/2026/social/summer-camp.tsx';
const NESTED_SLUG = 'ui-2026-social-summer-camp';
const BODY = 'export default () => <main>summer camp</main>;\n';

let dir: string;
let cfgPathEnv: string | undefined;
let realFetch: typeof fetch;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sync-path-pull-'));
  cfgPathEnv = process.env.HUBS_CONFIG_PATH;
  process.env.HUBS_CONFIG_PATH = join(dir, 'hubs.json');
  writeFileSync(
    process.env.HUBS_CONFIG_PATH,
    JSON.stringify({ hubs: { [URL_]: { token: 'mau_test', linkedAt: 1 } } })
  );
  chmodSync(process.env.HUBS_CONFIG_PATH, 0o600);
  realFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (cfgPathEnv === undefined) delete process.env.HUBS_CONFIG_PATH;
  else process.env.HUBS_CONFIG_PATH = cfgPathEnv;
  rmSync(dir, { recursive: true, force: true });
});

/** The hub's `GET /api/documents` — names and byte counts, never a path. */
function hubListing(documents: Array<{ name: string; bytes: number }>): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/api/documents')) {
      return new Response(JSON.stringify({ documents }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
}

function makeCtx(canvasGroups?: DevServerConfig['canvasGroups']): Context {
  const designRoot = join(dir, 'design');
  mkdirSync(join(designRoot, '_comments'), { recursive: true });
  return {
    canvasOrigin: 'http://canvas.localhost:1234',
    cfg: {
      name: 'test',
      projectLabel: null,
      designRoot: 'design',
      canvasGroups: canvasGroups ?? [
        { label: 'Design system', path: 'system' },
        { label: 'Canvases', path: 'ui' },
      ],
      rootClass: 'app',
      themeDefault: 'dark',
      tokensCssRel: 'system/colors.css',
      teamAccentDefault: null,
      handoffTargets: [],
      newCanvasDir: 'ui',
      newComponentDir: 'ui/components',
      linkedHub: { url: URL_, linkedAt: 1 },
      _source: 'defaults',
    },
    projectLabel: 'test',
    paths: {
      repoRoot: dir,
      designRel: 'design',
      designRoot,
      serverInfoFile: join(designRoot, '_server.json'),
      activeFile: join(designRoot, '_active.json'),
      commentsDir: join(designRoot, '_comments'),
      canvasStateDir: join(designRoot, '_canvas-state'),
      historyDir: join(designRoot, '_history'),
      tokensUrlRel: 'design/system/colors.css',
      systemDirRel: 'system',
    },
    bus: createBus(),
  } as unknown as Context;
}

/**
 * A provider whose document ALREADY holds what the hub holds — the body plus
 * whatever `syncMeta.path` the peer that authored it stamped. That is the shape
 * a real pull sees at `onceSynced`, and the reason the target cannot be decided
 * from the listing.
 */
function hubDocProviderFactory(
  seed: Record<string, { body: string; path?: string; css?: string }>,
  docs?: Map<string, Y.Doc>
) {
  return (args: { documentName: string; document?: Y.Doc }): SyncProvider => {
    const doc = args.document ?? new Y.Doc();
    const slug = args.documentName.split('/').pop() as string;
    const entry = seed[slug];
    if (entry) {
      doc.transact(() => {
        doc.getText('html').insert(0, entry.body);
        if (entry.path) doc.getMap('syncMeta').set('path', entry.path);
        if (entry.css) doc.getText('css').insert(0, entry.css);
      }, 'hub');
    }
    docs?.set(slug, doc);
    return {
      document: doc,
      awareness: new Awareness(doc),
      async onceSynced() {},
      destroy() {},
    };
  };
}

describe('a peer with an empty design root pulls the project down whole', () => {
  test('the canvas lands at the path its author gave it', async () => {
    hubListing([{ name: `ws/acme/main/${NESTED_SLUG}`, bytes: BODY.length }]);
    const ctx = makeCtx();
    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        [NESTED_SLUG]: { body: BODY, path: NESTED_REL },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    const wanted = join(ctx.paths.designRoot, NESTED_REL);
    expect(existsSync(wanted)).toBe(true);
    expect(readFileSync(wanted, 'utf8')).toBe(BODY);
    // And NOT flat at the design root, where nothing would list it.
    expect(existsSync(join(ctx.paths.designRoot, `${NESTED_SLUG}.tsx`))).toBe(false);
  });

  test('a document with NO path still arrives, inside a canvas group', async () => {
    hubListing([{ name: 'ws/acme/main/ui-legacy', bytes: 10 }]);
    const ctx = makeCtx();
    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        'ui-legacy': { body: 'export default () => null;\n' },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    // `ui/legacy.tsx`, not `ui/ui-legacy.tsx` — the latter would be visible and
    // would slug to a DIFFERENT document.
    expect(existsSync(join(ctx.paths.designRoot, 'ui', 'legacy.tsx'))).toBe(true);
  });

  test('a hostile path is refused and the canvas still arrives', async () => {
    hubListing([{ name: 'ws/acme/main/ui-legacy', bytes: 10 }]);
    const ctx = makeCtx();
    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        'ui-legacy': { body: 'x\n', path: '../../../../tmp/pwned.tsx' },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    expect(existsSync(join(ctx.paths.designRoot, 'ui', 'legacy.tsx'))).toBe(true);
    expect(existsSync(join(dir, '..', 'tmp', 'pwned.tsx'))).toBe(false);
  });

  test('a fresh link accepts the author’s OWN group, and writes it down', async () => {
    // `config.json` is not part of the sync lane, so a bare folder runs on the
    // DEFAULT groups. Without the fresh-link relaxation a project whose author
    // calls their group `screens` would have every path refused and arrive
    // invisible — the empty-folder case, in the shape it actually takes.
    hubListing([{ name: 'ws/acme/main/screens-home', bytes: 10 }]);
    const ctx = makeCtx();
    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        'screens-home': { body: 'x\n', path: 'screens/home.tsx' },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    expect(existsSync(join(ctx.paths.designRoot, 'screens', 'home.tsx'))).toBe(true);
    // …and the project now declares itself, so the next boot needs no relaxation.
    const cfg = JSON.parse(readFileSync(join(ctx.paths.designRoot, 'config.json'), 'utf8'));
    expect(cfg.canvasGroups.map((g: { path: string }) => g.path)).toContain('screens');
  });

  test('a project that already declared itself is NEVER overwritten', async () => {
    const ctx = makeCtx();
    mkdirSync(join(ctx.paths.designRoot, 'ui'), { recursive: true });
    const cfgFile = join(ctx.paths.designRoot, 'config.json');
    const mine = `${JSON.stringify({ name: 'mine', canvasGroups: [{ label: 'UI', path: 'ui' }] })}\n`;
    writeFileSync(cfgFile, mine);
    hubListing([{ name: 'ws/acme/main/screens-home', bytes: 10 }]);

    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        'screens-home': { body: 'x\n', path: 'screens/home.tsx' },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    expect(readFileSync(cfgFile, 'utf8')).toBe(mine);
    // The undeclared group is refused, so the canvas falls back — still arriving.
    expect(existsSync(join(ctx.paths.designRoot, 'screens', 'home.tsx'))).toBe(false);
    expect(existsSync(join(ctx.paths.designRoot, 'screens-home.tsx'))).toBe(true);
  });
});

describe("rule 7 governs a path's IDENTITY, not what already lives there", () => {
  test('a pulled canvas never lands on a file that already exists locally', async () => {
    // `scanCanvases` omits a canvas whose `.meta.json` says `syncable: false` —
    // a security opt-out a hub must not be able to flip. Omitted means absent
    // from `localCanvases`, which means the hub's document for that slug is
    // classified hub-ONLY and pulled. Before the path lane that was benign: the
    // body landed flat at the design root, loaded by nothing. Honouring a remote
    // path would land it on the real file.
    const ctx = makeCtx();
    mkdirSync(join(ctx.paths.designRoot, 'ui'), { recursive: true });
    const guarded = join(ctx.paths.designRoot, 'ui', 'Card.tsx');
    writeFileSync(guarded, 'export default () => <b>MINE</b>;\n');
    writeFileSync(
      join(ctx.paths.designRoot, 'ui', 'Card.meta.json'),
      JSON.stringify({ syncable: false })
    );
    hubListing([{ name: 'ws/acme/main/ui-card', bytes: 10 }]);

    const docs = new Map<string, Y.Doc>();
    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory(
        { 'ui-card': { body: 'export default () => <b>HUB</b>;\n', path: 'ui/Card.tsx' } },
        docs
      ),
    });
    await runtime?.start();

    // The boot moment is not the whole story — the provider now OWNS a path, so
    // every later hub edit flows to it. Push one, the way a hub actually would.
    const doc = docs.get('ui-card');
    if (doc) {
      const text = doc.getText('html');
      doc.transact(() => {
        text.delete(0, text.length);
        text.insert(0, 'export default () => <b>PWNED</b>;\n');
      }, 'hub');
    }
    await new Promise((r) => setTimeout(r, 250));
    await runtime?.stop();

    expect(readFileSync(guarded, 'utf8')).toContain('MINE');
  });

  test('a pulled canvas cannot overwrite the served token stylesheet', async () => {
    // `system` is a DEFAULT canvas group and the `.css` sibling is derived from
    // the body path, so `system/colors_and_type.tsx` satisfies every rule and
    // writes its css lane exactly where `tokensCssRel` is served from.
    const ctx = makeCtx();
    mkdirSync(join(ctx.paths.designRoot, 'system'), { recursive: true });
    const tokens = join(ctx.paths.designRoot, 'system', 'colors.css');
    writeFileSync(tokens, ':root{--bg-0:#fff}\n');
    hubListing([{ name: 'ws/acme/main/system-colors', bytes: 10 }]);

    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        'system-colors': {
          body: 'x\n',
          path: 'system/colors.tsx',
          // The lane that does the damage — it is written to the body path's
          // `.css` sibling, which here IS the served `tokensCssRel`.
          css: ':root{--bg-0:url("https://evil.example/?x")}\n',
        },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    expect(readFileSync(tokens, 'utf8')).toBe(':root{--bg-0:#fff}\n');
  });

  test('containment is checked THROUGH symlinks, which resolve() cannot see', async () => {
    const ctx = makeCtx();
    const outside = mkdtempSync(join(tmpdir(), 'sync-path-outside-'));
    mkdirSync(join(ctx.paths.designRoot, 'ui'), { recursive: true });
    symlinkSync(outside, join(ctx.paths.designRoot, 'ui', 'escape'), 'dir');
    hubListing([{ name: 'ws/acme/main/ui-escape-pwned', bytes: 10 }]);

    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        'ui-escape-pwned': { body: 'x\n', path: 'ui/escape/pwned.tsx' },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    expect(existsSync(join(outside, 'pwned.tsx'))).toBe(false);
    rmSync(outside, { recursive: true, force: true });
  });
});

describe('the untrusted markers name the path the body actually lands at', () => {
  test('a nested pulled canvas is marked at its REAL path, not the provisional one', async () => {
    // The markers are computed from the descriptor set BEFORE any document has
    // synced — so every pulled entry is still the fallback — and the descriptors
    // are then mutated in place by `relocatePulled`. Marking once left
    // `_untrusted/INDEX.json` and the `.claudeignore` block naming a file that
    // is never created, while the genuinely hub-pushed body sat elsewhere,
    // listed nowhere. That is the DDR-054 §3 F3 control pointing at a phantom.
    hubListing([{ name: `ws/acme/main/${NESTED_SLUG}`, bytes: BODY.length }]);
    const ctx = makeCtx();
    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        [NESTED_SLUG]: { body: BODY, path: NESTED_REL },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    const index = readFileSync(join(ctx.paths.designRoot, '_untrusted', 'INDEX.json'), 'utf8');
    expect(index).toContain('ui/2026/social/summer-camp.tsx');
    // The provisional fallback was never created, so naming it is naming nothing.
    expect(index).not.toContain('ui/2026-social-summer-camp.tsx');
  });
});

describe('the fresh-link relaxation closes behind itself', () => {
  test('only ONE undeclared group is ever learned', async () => {
    // `freshLink` was a const, so after the first config was written every
    // FURTHER undeclared group was accepted and appended — the relaxation
    // perpetuating itself, and a hub free to plant directories all session.
    hubListing([
      { name: 'ws/acme/main/screens-a', bytes: 10 },
      { name: 'ws/acme/main/vendor-b', bytes: 10 },
    ]);
    const ctx = makeCtx();
    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        'screens-a': { body: 'x\n', path: 'screens/a.tsx' },
        'vendor-b': { body: 'x\n', path: 'vendor/b.tsx' },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    const cfg = JSON.parse(readFileSync(join(ctx.paths.designRoot, 'config.json'), 'utf8'));
    const learned = cfg.canvasGroups
      .map((g: { path: string }) => g.path)
      .filter((p: string) => p !== 'system' && p !== 'ui');
    expect(learned.length).toBe(1);
  });

  test('a design root with work in it is NOT a fresh link', async () => {
    // `localCanvases.length === 0` is a fact about the SCAN, which walks only
    // declared groups and applies the syncable + sandbox gates — so a project
    // with real work scans to zero for several innocent reasons, and a hub must
    // not get to author a config.json into it.
    const ctx = makeCtx();
    mkdirSync(join(ctx.paths.designRoot, 'ui'), { recursive: true });
    writeFileSync(join(ctx.paths.designRoot, 'ui', 'Existing.tsx'), 'x\n');
    writeFileSync(
      join(ctx.paths.designRoot, 'ui', 'Existing.meta.json'),
      JSON.stringify({ syncable: false })
    );
    hubListing([{ name: 'ws/acme/main/screens-a', bytes: 10 }]);

    const runtime = createSyncRuntime(ctx, {
      providerFactory: hubDocProviderFactory({
        'screens-a': { body: 'x\n', path: 'screens/a.tsx' },
      }),
    });
    await runtime?.start();
    await runtime?.stop();

    expect(existsSync(join(ctx.paths.designRoot, 'config.json'))).toBe(false);
    expect(existsSync(join(ctx.paths.designRoot, 'screens', 'a.tsx'))).toBe(false);
  });
});
