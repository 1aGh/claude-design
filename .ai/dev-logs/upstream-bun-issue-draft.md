# Upstream Bun issue draft

> Target: https://github.com/oven-sh/bun/issues
>
> Submit this draft as-is (or close to it). Keep the title under 70 chars.
> Once filed, link the issue URL into DDR-042 under the "References" section.

---

**Title:** `bun build --compile` no longer embeds NAPI-RS bindings (regression in 1.3.4)

**Body:**

## What

`bun build --compile` produced binaries on Bun 1.3.3 that correctly embedded NAPI native bindings (specifically the `optionalDependencies` platform sub-packages used by every NAPI-RS-generated loader). Starting with Bun 1.3.4 the same source builds — using the same dependency tree — produce binaries that crash on startup with `Cannot find native binding`.

Confirmed unchanged on 1.3.7, 1.3.10, 1.3.12, and 1.3.14.

## Reproducer

Three lines:

```ts
// repro.ts
import { parseSync } from 'oxc-parser';
const r = parseSync('test.tsx', `const x = <div/>;`, { sourceType: 'module' });
console.log({ errors: r.errors.length, hasProgram: !!r.program });
```

```sh
# package.json deps: oxc-parser@0.131.0 only (its optionalDependencies pull in the bindings)
bun install
bun build --compile --target=bun-darwin-arm64 --outfile=./repro repro.ts
./repro
```

### Expected (and what 1.3.3 produces)

```
{ errors: 0, hasProgram: true }
```

### Actual on 1.3.4+

```
error: Cannot find native binding. npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828). Please try `npm i` again after removing both package-lock.json and node_modules directory.
    at /$bunfs/root/repro:<line>:<col>
```

The error originates inside the bundled `oxc-parser/src-js/bindings.js` (NAPI-RS auto-generated loader). At runtime its platform-detection `switch (`${process.platform}-${process.arch}`)` walks every candidate `require('./parser.<slug>.node')` and `require('@oxc-parser/binding-<slug>')` — none resolve because the binding sub-package and its `.node` asset are not present in the compiled binary's embedded module graph.

## Bisect

| Version | Status |
|---------|:------:|
| 1.3.3   | ✅ works |
| 1.3.4   | ❌ regressed |
| 1.3.7   | ❌ |
| 1.3.10  | ❌ |
| 1.3.12  | ❌ |
| 1.3.14  | ❌ (current `latest`) |

I haven't bisected commits within 1.3.4 — happy to if it helps.

## Scope

Likely affects every NAPI-RS-published package consumed in `--compile` builds, not just `oxc-parser`. The NAPI-RS loader pattern (top-level dynamic `require` of optional platform sub-packages) is the standard generator output.

## Workaround in use

For projects that can't wait for an upstream fix, the workaround is to set `NAPI_RS_NATIVE_LIBRARY_PATH` from a `with { type: 'file' }` asset import in a leaf module imported BEFORE the NAPI consumer:

```ts
// init-oxc.ts  (separate file — ESM hoisting matters)
import bindingPath from '@oxc-parser/binding-darwin-arm64/parser.darwin-arm64.node' with { type: 'file' };
process.env.NAPI_RS_NATIVE_LIBRARY_PATH = bindingPath;

// entry.ts
import './init-oxc.ts';
import './your-real-entry.ts';
```

The platform binding package must be a direct devDependency (not just oxc-parser's optionalDependency) for Bun's bundler to resolve the import specifier.

Verified end-to-end on Bun 1.3.14 — the env-var-based loader bypass is honored by NAPI-RS's `bindings.js`, the asset import correctly embeds the `.node` file as a virtual `/$bunfs/root/*.node` path, and `process.dlopen` succeeds against it.

Reference implementation: <https://github.com/1aGh/maude/blob/main/plugins/design/dev-server/build.ts> — `writeCompileEntry`. The workaround generates one stub per `--target`.

## Why this matters

Single-binary distribution via `bun --compile` is one of Bun's flagship features for CLI shipping. NAPI-RS-published parsers / transformers / database drivers are common in this surface (oxc, swc, sharp, prisma, sqlite, …). The regression silently breaks production binaries; the error surface is in user-space code (`bindings.js`) so it's hard to attribute to Bun without bisecting.

Happy to PR a test case once a fix lands so the regression doesn't recur.

## Env

- Host: macOS Sequoia, Apple Silicon (arm64). Reproduced cross-compile to `bun-linux-x64` and `bun-windows-x64` as well — binaries built but crash with the same error class on their target platforms.
- Package manager: pnpm 11.0.4 (also tried bun's own install — same result).
- NAPI-RS source: oxc-parser 0.131.0 (`@napi-rs/cli@2.x`-generated loader).
