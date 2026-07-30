// The credential registry — validate 2026-07-30.
//
// The point of these is not that six regexes work. It is that the registry
// stays COMPLETE: the last test walks the source tree for prefixes the code
// actually mints and fails when one of them has no grammar. A seventh
// credential shape cannot reach a diagnostic bundle unnoticed.

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CREDENTIAL_GRAMMARS, redactMaudeCredentials } from '../credential-grammar.ts';
import { scrub } from '../debug-bundle.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('every Maude-minted credential is redacted', () => {
  const samples: Array<[string, string]> = [
    ['peer-token', 'mau_0123456789abcdef0123456789abcdef'],
    ['personal-token', `mpt_${'a'.repeat(48)}`],
    ['handoff-code', `mhc_${'b'.repeat(64)}`],
    ['device-code', `mdc_${'c'.repeat(48)}`],
    // The one the JWT rule structurally cannot see: TWO parts, not three,
    // because the project token deliberately is not a JWT (DDR-204).
    ['project-token', 'eyJlbWFpbCI6ImFAYi5jbyJ9.c2lnbmF0dXJlLXRoYXQtaXMtbG9uZy1lbm91Z2g'],
    ['derived-cell-secret', 'f'.repeat(64)],
  ];

  for (const [id, sample] of samples) {
    test(`${id} never survives a scrub`, () => {
      const line = `[sync] presenting ${sample} to the workspace`;
      expect(redactMaudeCredentials(line)).not.toContain(sample);
      // And through the real front door the bug report uses.
      expect(scrub(line)).not.toContain(sample);
    });
  }

  test('a two-part project token is caught even though the JWT rule needs three', () => {
    const twoPart = 'eyJlbWFpbCI6ImFAYi5jbyJ9.c2lnbmF0dXJlLXRoYXQtaXMtbG9uZy1lbm91Z2g';
    expect(twoPart.split('.').length).toBe(2);
    expect(scrub(`token=${twoPart}`)).not.toContain(twoPart);
  });

  test('an underscore-joined secret env name is redacted (\\b cannot match inside HUB_SECRET)', () => {
    const out = scrub('HUB_SECRET=s3cr3t-value-here CELL_SECRET_MASTER=another-one');
    expect(out).not.toContain('s3cr3t-value-here');
    expect(out).not.toContain('another-one');
    expect(out).toContain('HUB_SECRET');
  });

  test('ordinary text is left alone', () => {
    const plain = 'opened .design/ui/home.tsx and rendered 42 artboards in 1.2s';
    expect(scrub(plain)).toContain('home.tsx');
    expect(scrub(plain)).not.toContain('[redacted]');
  });
});

describe('the registry stays complete', () => {
  /** Every `<prefix>_` literal the codebase mints a credential with. */
  function mintedPrefixes(): Set<string> {
    const found = new Set<string>();
    const walk = (dir: string, depth = 0) => {
      if (depth > 4) return;
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const p = join(dir, entry);
        let st: ReturnType<typeof statSync>;
        try {
          st = statSync(p);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          walk(p, depth + 1);
          continue;
        }
        if (!/\.(mjs|ts)$/.test(entry) || /\.test\./.test(entry)) continue;
        const src = readFileSync(p, 'utf8');
        // A mint always builds the value from a literal prefix plus randomness,
        // e.g. `` `mpt_${b64hex(crypto.getRandomValues(...))}` ``.
        for (const m of src.matchAll(/`(m[a-z]{2})_\$\{/g)) found.add(m[1]);
      }
    };
    for (const app of ['apps/cloud', 'apps/hub', 'apps/cells', 'cli']) {
      try {
        walk(join(REPO, app));
      } catch {
        /* an absent app is not a failure */
      }
    }
    return found;
  }

  test('every prefix the code mints has a grammar', () => {
    const registered = new Set(
      CREDENTIAL_GRAMMARS.flatMap((g) => {
        const m = /\\b(m[a-z]{2})_/.exec(g.pattern.source);
        return m ? [m[1]] : [];
      })
    );
    const minted = mintedPrefixes();
    expect(minted.size).toBeGreaterThan(0); // the walk must actually find things
    const missing = [...minted].filter((p) => !registered.has(p));
    expect(missing).toEqual([]);
  });
});
