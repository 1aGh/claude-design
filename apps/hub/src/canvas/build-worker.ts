// The cell's canvas build, in its own process — Cloud Phase 25 A1.
//
// WHY A SEPARATE PROCESS, AND WHY BUN.
//
// A0 decided the cell BUILDS a tenant's canvas and the viewer's browser
// EVALUATES it. "Build is not evaluation" is only true if the build cannot be
// made to do anything else, so the build runs where it can be bounded:
//
//   - its own process, spawned with an EMPTY environment — the derived cell
//     secret, the project token key and the tenant's storage credentials are
//     all env vars in the server, and none of them exist here;
//   - a wall-clock deadline and an RSS ceiling enforced by the parent, so a
//     pathological import graph costs one killed process, not the cell;
//   - an import allowlist (canvas-build.ts `restrictImportsTo`), so a tenant's
//     source can reach the runtime packages, `@maude/canvas-lib`, and its own
//     files — and nothing else on this disk.
//
// It runs under BUN rather than the hub's Node so the output is the SAME
// artifact the desktop produces: same `Bun.hash`-derived `data-cd-id`s (so a
// comment anchored in the browser resolves in the desktop and back), and the
// same `Bun.build` bundle. The alternative — esbuild — was measured at 0.6%
// median drift in the Phase 21 spike; identical beats measured-close, and it
// removes a whole class of "renders differently in the browser" bug reports.
//
// Protocol: argv gives the design root and the canvas path; stdout carries one
// JSON object. Nothing else is printed on the happy path, so the parent parses
// stdout wholesale.

import { buildCanvasModule } from '../../../studio/canvas-build.ts';

const [, , designRoot, canvasAbs] = process.argv;

async function main() {
  if (!designRoot || !canvasAbs) {
    process.stdout.write(JSON.stringify({ ok: false, error: 'usage: <designRoot> <canvasAbs>' }));
    process.exit(2);
  }
  const source = await Bun.file(canvasAbs).text();
  const built = await buildCanvasModule(canvasAbs, source, {
    designRoot,
    restrictImportsTo: designRoot,
  });
  process.stdout.write(
    JSON.stringify({ ok: true, js: built.js, locator: built.locator, etag: built.etag })
  );
}

main().catch((err) => {
  // The message is the product surface: a rejected import, a syntax error or a
  // missing sibling all arrive here, and the person who wrote the canvas is
  // the one who has to act on it. Bun collapses plugin throws into the build
  // log, so the allowlist's own wording survives in `err.message`.
  process.stdout.write(
    JSON.stringify({ ok: false, error: String(err?.message ?? err).slice(0, 4000) })
  );
  process.exit(1);
});
