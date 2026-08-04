// Cloud Phase 27 D1 — the stub generator, and the reason it is generated.
//
// The compiled-artifact assertion lives in `scripts/check-cloud-binary.sh`
// (two compiles, ~1 min — release-job work). These are the unit-level halves:
// that a stub covers every runtime export of the module it replaces, and that
// the value it substitutes cannot crash a boot on a shape nobody remembered.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLOUD_ELIMINATED,
  CLOUD_FORBIDDEN_STRINGS,
  exportedNames,
  stubSource,
} from '../cloud-build.ts';

const STUDIO = join(import.meta.dir, '..');

describe('cloud elimination', () => {
  test('every listed module exists — a typo eliminates nothing, silently', () => {
    for (const rel of CLOUD_ELIMINATED) {
      expect(() => readFileSync(join(STUDIO, rel), 'utf8')).not.toThrow();
    }
  });

  test('the stub covers every runtime export of the real module', () => {
    // A missing export is a boot-time crash in the cloud binary and nowhere
    // else — the worst place for it to surface. Generating from the real file
    // is what keeps this true when a module grows a function.
    for (const rel of CLOUD_ELIMINATED) {
      const source = readFileSync(join(STUDIO, rel), 'utf8');
      const stub = stubSource(source);
      for (const name of exportedNames(source)) {
        expect(stub).toContain(`export const ${name} = inert;`);
      }
    }
  });

  test('it reads the forms this codebase actually uses', () => {
    const names = exportedNames(`
      export function alpha() {}
      export async function beta() {}
      export const gamma = 1;
      export let delta = 2;
      export class Epsilon {}
      export { zeta, eta as theta };
      export interface NotThis {}
      export type NorThis = string;
      const notExported = 3;
    `);
    expect(names.sort()).toEqual(['Epsilon', 'alpha', 'beta', 'delta', 'gamma', 'theta', 'zeta']);
    // Types are erased before any of this matters; listing them would emit a
    // `const` where a type was and break the build for no reason.
    expect(names).not.toContain('NotThis');
    expect(names).not.toContain('NorThis');
    expect(names).not.toContain('notExported');
  });

  test('the inert value survives every shape a caller might use', async () => {
    // The callers are not alike: one calls `createExportJobQueue(...)` and
    // hands the result to a route table, one calls `installLogRing()` for a
    // side effect, one reads a property off what `createAcp` returned. Anything
    // that answers all of them cannot crash a boot.
    const mod = await import(
      `data:text/javascript;base64,${btoa(stubSource('export function makeThing() {}'))}`
    );
    const { makeThing } = mod;
    expect(() => makeThing()).not.toThrow();
    expect(() => makeThing().someMethod()).not.toThrow();
    expect(() => new makeThing()).not.toThrow();
    expect(() => makeThing().a.b.c()).not.toThrow();
    // NOT thenable — an `await` on it must resolve, not hang forever waiting
    // for a `then` that never calls back.
    const awaited = await makeThing();
    expect(awaited).toBeDefined();
    // Destructuring and iteration are both survivable.
    const { anything } = makeThing();
    expect(anything).toBeDefined();
    expect([...makeThing()]).toEqual([]);
  });

  test('a sentinel is a string only our own code can produce', () => {
    // `api.github.com` was the first candidate and is useless: Bun's own
    // runtime carries GITHUB_API_DOMAIN, so it appears in every compiled binary
    // whatever we do, and a gate that cannot go red is one people learn to
    // ignore. Each sentinel must therefore be specific enough to be OURS.
    expect(CLOUD_FORBIDDEN_STRINGS.length).toBeGreaterThan(0);
    for (const s of CLOUD_FORBIDDEN_STRINGS) {
      expect(s).not.toBe('api.github.com');
      expect(s.length).toBeGreaterThan(3);
    }
  });
});
