// Token-file import (DDR-172). Pure-function coverage: the value-grammar
// allowlist (the load-bearing CSS-injection closure), the whole-value-only
// alias resolver, prototype-pollution/structural-depth guards on the JSON
// flattener, the bespoke CSS tokenizer/locator/patcher, and the two
// PERMANENT regression requirements the DDR names explicitly: (1) the
// alias-resolver module import-ban, (2) the theme-block-scoped patch tested
// against a real dual-theme fixture.

import { describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertValidDsName,
  flattenJsonTokens,
  ImportTokensError,
  importTokens,
  KNOWN_VARIABLES,
  locateThemeBlock,
  mapTokenNameToVariable,
  normalizeColorspace,
  parseTokenFile,
  patchDeclarationInBlock,
  readTokenFileCapped,
  TOKENS_MAX_BYTES,
  tokenizeCssCustomProperties,
  validateTokenValue,
} from '../bin/_import-tokens.mjs';
import { resolveAliases } from '../bin/_import-tokens-alias-resolver.mjs';

function assertBlock(block: { bodyStart: number; bodyEnd: number } | null) {
  if (!block) throw new Error('expected locateThemeBlock to return a block');
  return block;
}

function tmpDesignRoot() {
  const root = mkdtempSync(join(tmpdir(), 'maude-import-tokens-'));
  mkdirSync(join(root, '.design', 'system', 'maude', 'preview'), { recursive: true });
  mkdirSync(join(root, '.design', '_history'), { recursive: true });
  return root;
}

const DUAL_THEME_CSS = `/* header comment */
:root,
.maude[data-theme="dark"] {
  /* ─── Surfaces ─── */
  --bg-0: oklch(0.165 0.012 255);   /* canvas bg */
  --accent: oklch(0.680 0.180 268); /* brand accent */
  --space-3: 8px;
  --dur-flip: 140ms;
}

.maude[data-theme="light"] {
  --bg-0: oklch(0.975 0.004 255);
  --accent: oklch(0.520 0.195 268);
}

@media (prefers-reduced-motion: reduce) {
  :root,
  .maude[data-theme="dark"],
  .maude[data-theme="light"] {
    --dur-flip: 1ms;
  }
}
`;

function writeConfig(root, { colorSpace } = {}) {
  const config = {
    designRoot: '.design',
    rootClass: 'maude',
    defaultDesignSystem: 'maude',
    ...(colorSpace ? { colorSpace } : {}),
    designSystems: [
      {
        name: 'maude',
        path: 'system/maude',
        tokensCssRel: 'system/maude/colors_and_type.css',
        rootClass: 'maude',
        themeDefault: 'dark',
        themes: ['dark', 'light'],
      },
    ],
  };
  writeFileSync(join(root, '.design', 'config.json'), JSON.stringify(config, null, 2));
}

// ============================================================================
// Decision 4 — value-grammar allowlist (the load-bearing control)
// ============================================================================

describe('validateTokenValue', () => {
  test('accepts valid hex/oklch/rgb/hsl colors', () => {
    expect(validateTokenValue('--bg-0', '#fff').ok).toBe(true);
    expect(validateTokenValue('--bg-0', '#ffffff').ok).toBe(true);
    expect(validateTokenValue('--accent', 'oklch(0.680 0.180 268)').ok).toBe(true);
    expect(validateTokenValue('--accent', 'rgba(0, 0, 0, 0.5)').ok).toBe(true);
    expect(validateTokenValue('--accent', 'hsl(268 50% 40%)').ok).toBe(true);
  });

  test('rejects malformed/invalid-length hex', () => {
    expect(validateTokenValue('--bg-0', '#ff').ok).toBe(false);
    expect(validateTokenValue('--bg-0', '#fffff').ok).toBe(false); // 5 digits — invalid CSS hex length
    expect(validateTokenValue('--bg-0', '#gggggg').ok).toBe(false);
  });

  test('accepts valid dimensions within magnitude bounds', () => {
    expect(validateTokenValue('--space-3', '8px').ok).toBe(true);
    expect(validateTokenValue('--space-3', '0').ok).toBe(true);
    expect(validateTokenValue('--radius-md', '7px').ok).toBe(true);
    expect(validateTokenValue('--type-base', '1rem').ok).toBe(true);
  });

  test('rejects a grammar-valid-SHAPED but pathological magnitude (Round-1 W3)', () => {
    expect(validateTokenValue('--space-3', '99999999px').ok).toBe(false);
    expect(validateTokenValue('--type-base', '99999rem').ok).toBe(false);
  });

  test('rejects the shadow-grammar unbalanced-paren bypass PoC (Round-1 B1/F1)', () => {
    const poc = '0px 0px rgba(0,0,0,0), 0px 0px rgba(0(0';
    expect(validateTokenValue('--shadow-md', poc).ok).toBe(false);
  });

  test('accepts a real multi-layer shadow value', () => {
    expect(validateTokenValue('--shadow-lg', '0 14px 38px rgba(0, 0, 0, 0.56)').ok).toBe(true);
    expect(
      validateTokenValue('--shadow-md', '1px 1px 1px rgba(0,0,0,0.4), 2px 2px 4px rgba(0,0,0,0.2)')
        .ok
    ).toBe(true);
  });

  test('rejects a value containing a newline before grammar matching (Round-1 F2 chain)', () => {
    expect(validateTokenValue('--bg-0', '#fff\n};@import url(//evil)').ok).toBe(false);
    expect(validateTokenValue('--bg-0', '#fff };@import url(//evil)').ok).toBe(false);
  });

  test('rejects non-ASCII values outright (printable-ASCII-only pre-filter)', () => {
    expect(validateTokenValue('--font-body', '"Inter "').ok).toBe(false);
  });

  test('duration and easing grammars', () => {
    expect(validateTokenValue('--dur-flip', '140ms').ok).toBe(true);
    expect(validateTokenValue('--dur-flip', '999999ms').ok).toBe(false); // > 60000 bound
    expect(validateTokenValue('--ease-out', 'cubic-bezier(0.2, 0, 0, 1)').ok).toBe(true);
    expect(validateTokenValue('--ease-out', 'ease-in-out').ok).toBe(true);
    expect(validateTokenValue('--ease-out', 'javascript:alert(1)').ok).toBe(false);
  });

  test('font-stack grammar rejects unquoted names and CSS-special characters', () => {
    expect(validateTokenValue('--font-body', '"Inter Tight"').ok).toBe(true);
    expect(validateTokenValue('--font-body', 'sans-serif').ok).toBe(true);
    expect(validateTokenValue('--font-body', 'Arial, Helvetica').ok).toBe(false); // intentional — unquoted rejected
    expect(validateTokenValue('--font-body', '"a\\"; } body { background: url(x) "').ok).toBe(
      false
    );
  });

  test('an ungoverned family is a hard reject, not a silent pass-through', () => {
    expect(validateTokenValue('--totally-unknown-family', '#fff').ok).toBe(false);
  });
});

// ============================================================================
// Decision 5 — heuristic mapping
// ============================================================================

describe('mapTokenNameToVariable', () => {
  test('maps common surface/text/accent/status naming patterns', () => {
    expect(mapTokenNameToVariable('color.background.primary', 'color')).toBe('--bg-0');
    expect(mapTokenNameToVariable('color.background.card', 'color')).toBe('--bg-1');
    expect(mapTokenNameToVariable('color.text.secondary', 'color')).toBe('--fg-1');
    expect(mapTokenNameToVariable('color.brand', 'color')).toBe('--accent');
    expect(mapTokenNameToVariable('color.brand.hover', 'color')).toBe('--accent-hover');
    expect(mapTokenNameToVariable('color.status.error', 'color')).toBe('--status-error');
    expect(mapTokenNameToVariable('spacing.3', 'dimension')).toBe('--space-3');
    expect(mapTokenNameToVariable('border-radius.pill', null)).toBe('--radius-pill');
  });

  test('returns null (unmapped) for an unrecognized path — never guesses', () => {
    expect(mapTokenNameToVariable('acme.proprietary.widget.zorp', null)).toBeNull();
  });

  test('every mapped result is a KNOWN_VARIABLES member', () => {
    const candidates = [
      'color.bg.0',
      'color.fg.primary',
      'color.accent',
      'spacing.4',
      'radius.lg',
      'font.display',
    ];
    for (const c of candidates) {
      const v = mapTokenNameToVariable(c, null);
      if (v) expect(KNOWN_VARIABLES.has(v)).toBe(true);
    }
  });
});

// ============================================================================
// Decision 2 — whole-value-only alias resolution (pure module)
// ============================================================================

describe('resolveAliases', () => {
  test('resolves a simple whole-value alias chain', () => {
    const { resolved } = resolveAliases({ a: '{b}', b: '{c}', c: '#fff' });
    expect(resolved.a).toBe('#fff');
    expect(resolved.b).toBe('#fff');
  });

  test('does NOT resolve a partial-string multi-reference value (structural DoS closure)', () => {
    const { resolved, statuses } = resolveAliases({ a: '{b} solid', b: '#fff' });
    expect(resolved.a).toBe('{b} solid'); // passed through as literal, unresolved
    expect(statuses.a).toBeUndefined();
  });

  test('detects a direct cycle', () => {
    const { statuses } = resolveAliases({ a: '{b}', b: '{a}' });
    expect(statuses.a).toBe('circular-alias');
    expect(statuses.b).toBe('circular-alias');
  });

  test('detects a self-reference', () => {
    const { statuses } = resolveAliases({ a: '{a}' });
    expect(statuses.a).toBe('circular-alias');
  });

  test('rejects an unresolved alias target rather than crashing', () => {
    const { statuses } = resolveAliases({ a: '{nonexistent.path}' });
    expect(statuses.a).toBe('unresolved-alias');
  });

  test('rejects a chain deeper than maxDepth', () => {
    const tokens = {};
    for (let i = 0; i < 20; i++) tokens[`t${i}`] = `{t${i + 1}}`;
    tokens.t20 = '#fff';
    const { statuses } = resolveAliases(tokens, { maxDepth: 16 });
    expect(statuses.t0).toBe('alias-chain-too-deep');
  });

  test('does not attempt to open a file/network location for an unresolved alias (module purity — see the import-ban test below)', () => {
    const { statuses } = resolveAliases({ a: '{../../../etc/passwd}' });
    expect(statuses.a).toBe('unresolved-alias');
  });
});

// ============================================================================
// PERMANENT test (DDR-172 Decision 2, ethical-hacker F4 / DDR-167's own
// lesson): the alias-resolver module must import NONE of fs/net/http(s)/
// dns/child_process — with AND without the `node:` prefix — and must not
// reference the global fetch/XMLHttpRequest. Enforced by grepping the
// module's own source, not by trusting the doc comment.
// ============================================================================

describe('alias-resolver module purity (permanent regression test)', () => {
  const BANNED_SPECIFIERS = ['fs', 'net', 'http', 'https', 'dns', 'child_process'];

  // A real "banned call shape" grep must check CODE, not prose — the
  // module's own doc comment legitimately documents what's banned, using
  // the exact banned words, and that documentation must not trip the check
  // that verifies the ban itself. Mirrors the shape of what a lint-rule-based
  // check would see (comments stripped) more closely than a naive full-text
  // grep would.
  function codeWithoutComments(src: string) {
    return src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  }

  test('imports none of the banned I/O modules, prefixed or not', () => {
    const src = codeWithoutComments(
      readFileSync(join(import.meta.dir, '..', 'bin', '_import-tokens-alias-resolver.mjs'), 'utf8')
    );
    for (const spec of BANNED_SPECIFIERS) {
      const patterns = [
        new RegExp(`from\\s+['"]node:${spec}['"]`),
        new RegExp(`from\\s+['"]${spec}['"]`),
        new RegExp(`require\\(\\s*['"]node:${spec}['"]\\s*\\)`),
        new RegExp(`require\\(\\s*['"]${spec}['"]\\s*\\)`),
      ];
      for (const re of patterns) {
        expect(re.test(src)).toBe(false);
      }
    }
  });

  test('does not reference fetch or XMLHttpRequest', () => {
    const src = codeWithoutComments(
      readFileSync(join(import.meta.dir, '..', 'bin', '_import-tokens-alias-resolver.mjs'), 'utf8')
    );
    expect(/\bfetch\s*\(/.test(src)).toBe(false);
    expect(/XMLHttpRequest/.test(src)).toBe(false);
  });
});

// ============================================================================
// Decision 3 — prototype-pollution + structural depth guards
// ============================================================================

describe('flattenJsonTokens', () => {
  test('flattens W3C design-tokens ($value/$type, group $type inheritance)', () => {
    const { tokens, types } = flattenJsonTokens({
      color: { $type: 'color', brand: { $value: '#6b6bf0' } },
    });
    expect(tokens['color.brand']).toBe('#6b6bf0');
    expect(types['color.brand']).toBe('color');
  });

  test('flattens Style-Dictionary (value/type)', () => {
    const { tokens, types } = flattenJsonTokens({
      color: { brand: { value: '#6b6bf0', type: 'color' } },
    });
    expect(tokens['color.brand']).toBe('#6b6bf0');
    expect(types['color.brand']).toBe('color');
  });

  test('never lets __proto__/constructor/prototype keys pollute the flattened map', () => {
    const evil = JSON.parse(
      '{"__proto__": {"polluted": true}, "color": {"$type":"color","$value":"#fff"}}'
    );
    const { tokens } = flattenJsonTokens(evil);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(tokens)).not.toContain('__proto__');
  });

  test('$description and other $-prefixed metadata is never captured (Decision 8 sink elimination)', () => {
    const { tokens } = flattenJsonTokens({
      color: { $description: 'attacker text', brand: { $value: '#fff' } },
    });
    expect(
      Object.values(tokens).some((v) => typeof v === 'string' && v.includes('attacker text'))
    ).toBe(false);
  });

  test('rejects structure nested deeper than the 32-level cap', () => {
    const deep: unknown[] = [];
    let cur = deep;
    for (let i = 0; i < 40; i++) {
      const next: unknown[] = [];
      cur.push(next);
      cur = next;
    }
    expect(() => flattenJsonTokens(deep)).toThrow(/structure-too-deep/);
  });

  test('a non-string $value (composite token) is left unflattened, not guessed', () => {
    const { tokens } = flattenJsonTokens({
      shadow: { $type: 'shadow', $value: { offsetX: '1px', offsetY: '1px' } },
    });
    expect(tokens.shadow).toBeUndefined();
  });
});

// ============================================================================
// Decision 1 — bespoke CSS tokenizer (raw-CSS input format)
// ============================================================================

describe('tokenizeCssCustomProperties', () => {
  test('extracts simple declarations', () => {
    const { tokens } = tokenizeCssCustomProperties(':root { --bg-0: #fff; --fg-0: #111; }');
    expect(tokens['--bg-0']).toBe('#fff');
    expect(tokens['--fg-0']).toBe('#111');
  });

  test('a `;` or `}` inside a quoted string is not mistaken for a declaration terminator', () => {
    const { tokens } = tokenizeCssCustomProperties(':root { --font-body: "a;b}c"; --fg-0: #111; }');
    expect(tokens['--font-body']).toBe('"a;b}c"');
    expect(tokens['--fg-0']).toBe('#111');
  });

  test('a `;` or `}` inside a comment is not mistaken for a declaration terminator', () => {
    const { tokens } = tokenizeCssCustomProperties(
      ':root { /* has a ; and a } inside */ --bg-0: #fff; }'
    );
    expect(tokens['--bg-0']).toBe('#fff');
  });

  test('tolerates a trailing per-declaration comment (the real maude DS file shape)', () => {
    const { tokens } = tokenizeCssCustomProperties(
      ':root { --bg-0: #fff;   /* page bg */\n  --bg-1: #eee;   /* card bg */\n }'
    );
    expect(tokens['--bg-0']).toBe('#fff');
    expect(tokens['--bg-1']).toBe('#eee');
  });

  test('an escaped quote inside a string does not prematurely end the string', () => {
    const { tokens } = tokenizeCssCustomProperties(
      String.raw`:root { --font-body: "a\"b;c"; --fg-0: #111; }`
    );
    expect(tokens['--fg-0']).toBe('#111');
  });
});

// ============================================================================
// Decision 7 — theme-block-scoped locate + patch (PERMANENT dual-theme fixture)
// ============================================================================

describe('locateThemeBlock (Decision 7 — dual-theme + @media-duplication PERMANENT fixture)', () => {
  test('locates the grouped :root + [data-theme="dark"] top-level block', () => {
    const block = locateThemeBlock(DUAL_THEME_CSS, {
      rootClass: 'maude',
      theme: 'dark',
      singleTheme: false,
    });
    expect(block).not.toBeNull();
    const body = DUAL_THEME_CSS.slice(assertBlock(block).bodyStart, assertBlock(block).bodyEnd);
    expect(body).toContain('--accent: oklch(0.680 0.180 268)');
    expect(body).not.toContain('0.520 0.195 268'); // the LIGHT theme's accent value
  });

  test('locates the standalone [data-theme="light"] block, not the dark one', () => {
    const block = locateThemeBlock(DUAL_THEME_CSS, {
      rootClass: 'maude',
      theme: 'light',
      singleTheme: false,
    });
    const body = DUAL_THEME_CSS.slice(assertBlock(block).bodyStart, assertBlock(block).bodyEnd);
    expect(body).toContain('0.520 0.195 268');
    expect(body).not.toContain('0.680 0.180 268');
  });

  test('excludes the @media-nested duplicate selector (ethical-hacker Round-2 finding)', () => {
    const block = locateThemeBlock(DUAL_THEME_CSS, {
      rootClass: 'maude',
      theme: 'dark',
      singleTheme: false,
    });
    const body = DUAL_THEME_CSS.slice(assertBlock(block).bodyStart, assertBlock(block).bodyEnd);
    // The small top-level block, not the large span including @media's body.
    expect(body.length).toBeLessThan(300);
    expect(body).not.toContain('prefers-reduced-motion');
  });

  test('single-theme DS falls back to the bare :root block', () => {
    const css = ':root { --bg-0: #fff; }';
    const block = locateThemeBlock(css, { rootClass: 'maude', theme: 'dark', singleTheme: true });
    expect(block).not.toBeNull();
  });

  test('HARD REJECTS (returns null) when the target theme has no matching block — no fallback', () => {
    const block = locateThemeBlock(DUAL_THEME_CSS, {
      rootClass: 'maude',
      theme: 'midnight',
      singleTheme: false,
    });
    expect(block).toBeNull();
  });

  test('does not fall back to :root when a multi-theme DS names an unmatched theme', () => {
    // singleTheme=false + no match — even though :root exists in the grouped
    // selector, it must NOT be treated as a fallback target here.
    const block = locateThemeBlock(DUAL_THEME_CSS, {
      rootClass: 'maude',
      theme: 'sepia',
      singleTheme: false,
    });
    expect(block).toBeNull();
  });
});

describe('patchDeclarationInBlock', () => {
  test('replaces ONLY the value, preserving name/colon-spacing/comment/semicolon', () => {
    const css = ':root { --accent: oklch(0.680 0.180 268); /* keep me */ }';
    const block = { bodyStart: css.indexOf('{') + 1, bodyEnd: css.lastIndexOf('}') };
    const { css: patched } = patchDeclarationInBlock(
      css,
      block,
      '--accent',
      'oklch(0.500 0.100 100)'
    );
    expect(patched).toBe(':root { --accent: oklch(0.500 0.100 100); /* keep me */ }');
  });

  test("force-insert anchors immediately before the block's own closing brace", () => {
    const css = ':root { --bg-0: #fff; }';
    const block = { bodyStart: css.indexOf('{') + 1, bodyEnd: css.lastIndexOf('}') };
    const { css: patched, patched: didPatch } = patchDeclarationInBlock(
      css,
      block,
      '--accent',
      '#123456',
      {
        forceInsert: true,
      }
    );
    expect(didPatch).toBe(true);
    expect(patched).toContain('--accent: #123456;');
    expect(patched.indexOf('--accent')).toBeLessThan(patched.lastIndexOf('}'));
  });

  test('without --force-insert, a missing declaration is reported as not-patched, never invented', () => {
    const css = ':root { --bg-0: #fff; }';
    const block = { bodyStart: css.indexOf('{') + 1, bodyEnd: css.lastIndexOf('}') };
    const { patched } = patchDeclarationInBlock(css, block, '--accent', '#123456');
    expect(patched).toBe(false);
  });

  test('sequential patches in the same block use the returned (shifted) span, not a stale one', () => {
    const css = ':root { --bg-0: #fff; --accent: #000000; }';
    let block = { bodyStart: css.indexOf('{') + 1, bodyEnd: css.lastIndexOf('}') };
    let text = css;
    const r1 = patchDeclarationInBlock(text, block, '--bg-0', '#f0f0f0f0'); // longer value shifts offsets
    text = r1.css;
    block = r1.block;
    const r2 = patchDeclarationInBlock(text, block, '--accent', '#111111');
    expect(r2.patched).toBe(true);
    expect(r2.css).toContain('--bg-0: #f0f0f0f0;');
    expect(r2.css).toContain('--accent: #111111;');
  });
});

// ============================================================================
// Decision 1 — input read (realpath/symlink/size discipline)
// ============================================================================

describe('readTokenFileCapped', () => {
  test('reads a real file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-tokens-read-'));
    const file = join(dir, 'tokens.json');
    writeFileSync(file, '{"a":1}');
    expect(readTokenFileCapped(file)).toBe('{"a":1}');
  });

  test('rejects an oversized file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-tokens-read-'));
    const file = join(dir, 'big.json');
    writeFileSync(file, 'x'.repeat(TOKENS_MAX_BYTES + 1));
    expect(() => readTokenFileCapped(file)).toThrow(/cap/);
  });

  test('rejects a nonexistent path', () => {
    expect(() => readTokenFileCapped('/nonexistent/path/tokens.json')).toThrow();
  });

  test('rejects a path containing a symlink component', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-tokens-read-'));
    const real = join(dir, 'real.json');
    writeFileSync(real, '{}');
    const link = join(dir, 'link.json');
    symlinkSync(real, link);
    expect(() => readTokenFileCapped(link)).toThrow(/symlink/);
  });
});

// ============================================================================
// Decision 8 — new-DS name charset
// ============================================================================

describe('assertValidDsName', () => {
  test('accepts a valid kebab-case name', () => {
    expect(() => assertValidDsName('my-brand-01')).not.toThrow();
  });

  test('rejects a name with control characters / path traversal shapes', () => {
    expect(() => assertValidDsName('evil\n../../x')).toThrow(/invalid-ds-name/);
  });

  test('rejects uppercase, spaces, and special characters', () => {
    expect(() => assertValidDsName('My Brand!')).toThrow();
  });
});

// ============================================================================
// Decision 6 — colorspace normalization
// ============================================================================

describe('normalizeColorspace', () => {
  test('converts hex to oklch', () => {
    const { value } = normalizeColorspace('#6b6bf0', 'oklch');
    expect(value).toMatch(/^oklch\(/);
  });

  test('passes oklch through unchanged when target is oklch', () => {
    const { value } = normalizeColorspace('oklch(0.680 0.180 268)', 'oklch');
    expect(value).toBe('oklch(0.680 0.180 268)');
  });

  test('reports an unsupported conversion rather than silently passing through (hsl->oklch, Decision 6 named gap)', () => {
    const result = normalizeColorspace('hsl(268 50% 40%)', 'oklch');
    expect(result.skip).toMatch(/unsupported-colorspace-conversion/);
  });
});

// ============================================================================
// End-to-end: importTokens() orchestration against a real dual-theme fixture
// ============================================================================

describe('importTokens (end-to-end, patch mode)', () => {
  test('maps, converts colorspace, patches only the target theme, reports the other theme as skipped', async () => {
    const root = tmpDesignRoot();
    writeConfig(root);
    writeFileSync(join(root, '.design', 'system', 'maude', 'colors_and_type.css'), DUAL_THEME_CSS);
    const tokensFile = join(root, 'tokens.json');
    writeFileSync(
      tokensFile,
      JSON.stringify({
        color: { brand: { $type: 'color', $value: '#123456' } },
        space: { '3': { $type: 'dimension', $value: '12px' } },
      })
    );

    const result = await importTokens({ inputPath: tokensFile, root, designRootRel: '.design' });
    expect(result.mappedCount).toBe(2);

    const finalCss = readFileSync(
      join(root, '.design', 'system', 'maude', 'colors_and_type.css'),
      'utf8'
    );
    expect(finalCss).toContain('--space-3: 12px;');
    // Light theme's accent must be untouched.
    expect(finalCss).toContain('--accent: oklch(0.520 0.195 268)');

    const otherThemeSkips = result.tokens.filter((t: { reason?: string }) =>
      String(t.reason ?? '').includes('themed-token-not-patched')
    );
    expect(otherThemeSkips.length).toBeGreaterThan(0);
  });

  test('HARD REJECTS with no write when the target theme block cannot be located', async () => {
    const root = tmpDesignRoot();
    writeConfig(root);
    writeFileSync(join(root, '.design', 'system', 'maude', 'colors_and_type.css'), DUAL_THEME_CSS);
    const tokensFile = join(root, 'tokens.json');
    writeFileSync(
      tokensFile,
      JSON.stringify({ color: { brand: { $type: 'color', $value: '#123456' } } })
    );

    const before = readFileSync(
      join(root, '.design', 'system', 'maude', 'colors_and_type.css'),
      'utf8'
    );
    await expect(
      importTokens({ inputPath: tokensFile, root, designRootRel: '.design', theme: 'midnight' })
    ).rejects.toThrow(ImportTokensError);
    const after = readFileSync(
      join(root, '.design', 'system', 'maude', 'colors_and_type.css'),
      'utf8'
    );
    expect(after).toBe(before); // no write occurred
  });

  test('a malformed input file is a clean rejection, not a crash', async () => {
    const root = tmpDesignRoot();
    writeConfig(root);
    writeFileSync(join(root, '.design', 'system', 'maude', 'colors_and_type.css'), DUAL_THEME_CSS);
    const tokensFile = join(root, 'bad.json');
    writeFileSync(tokensFile, '{not valid json');
    await expect(
      importTokens({ inputPath: tokensFile, root, designRootRel: '.design' })
    ).rejects.toThrow(ImportTokensError);
  });
});

describe('importTokens (end-to-end, --new-ds scaffold mode)', () => {
  test('scaffolds a minimal DS, patches it, and writes a charset-validated config.json entry', async () => {
    const root = tmpDesignRoot();
    writeConfig(root);
    const tokensFile = join(root, 'tokens.json');
    writeFileSync(
      tokensFile,
      JSON.stringify({ color: { brand: { $type: 'color', $value: '#123456' } } })
    );

    const result = await importTokens({
      inputPath: tokensFile,
      root,
      designRootRel: '.design',
      newDs: 'my-new-brand',
    });
    expect(result.mappedCount).toBe(1);
    expect(existsSync(join(root, '.design', 'system', 'my-new-brand', 'colors_and_type.css'))).toBe(
      true
    );

    const config = JSON.parse(readFileSync(join(root, '.design', 'config.json'), 'utf8'));
    const entry = config.designSystems.find((d: { name: string }) => d.name === 'my-new-brand');
    expect(entry).toBeDefined();
    // No token-file-derived free text in the description (Decision 8 sink elimination).
    expect(entry.description).not.toContain('123456');
    expect(entry.description).toMatch(/Imported via maude design import-tokens/);
  });

  test('rejects an invalid --new-ds name before touching the filesystem', async () => {
    const root = tmpDesignRoot();
    writeConfig(root);
    const tokensFile = join(root, 'tokens.json');
    writeFileSync(
      tokensFile,
      JSON.stringify({ color: { brand: { $type: 'color', $value: '#fff' } } })
    );
    await expect(
      importTokens({ inputPath: tokensFile, root, designRootRel: '.design', newDs: 'Evil Name!' })
    ).rejects.toThrow(/invalid-ds-name/);
    expect(existsSync(join(root, '.design', 'system', 'Evil Name!'))).toBe(false);
  });
});

// ============================================================================
// parseTokenFile — format detection, error messages never echo input content
// ============================================================================

describe('parseTokenFile', () => {
  test('detects JSON vs raw CSS by content', () => {
    expect(parseTokenFile('{"a": {"$value": "#fff", "$type": "color"}}').format).toBe('json');
    expect(parseTokenFile(':root { --bg-0: #fff; }').format).toBe('css');
  });

  test('a parse-error message never echoes the raw input content back', () => {
    const secret = 'TOP_SECRET_MARKER_XYZ';
    try {
      parseTokenFile(`{"a": ${secret} this is not valid json`);
      throw new Error('expected parseTokenFile to throw');
    } catch (err) {
      expect(String((err as Error).message)).not.toContain(secret);
    }
  });
});
