// The traversal corpus, and the rule that makes the whole thing safe.
//
// `syncMeta.path` is hub-supplied input that chooses a DIRECTORY. Every case
// below is a way a path could try to be something other than "a canvas in this
// project", plus the one rule that closes the class rather than the instance:
// the path must slug back to the document carrying it.

import { describe, expect, it } from 'bun:test';

import { canvasSlugFromRel } from '../canvas-slug.ts';
import {
  fallbackCanvasPath,
  MAX_CANVAS_PATH_LEN,
  resolveCanvasBodyRel,
  validateCanvasPath,
} from '../sync/canvas-path.ts';

const GROUPS = [{ path: 'system' }, { path: 'ui' }];

/** Validate a path AGAINST THE SLUG IT WOULD REALLY CARRY, so a rejection is
 *  attributable to the rule under test and not to rule 7 firing first. */
function check(path: unknown, slug: string) {
  return validateCanvasPath({ path, slug, designRel: '.design', canvasGroups: GROUPS });
}

describe('validateCanvasPath — what it accepts', () => {
  it('accepts a genuinely nested canvas', () => {
    const v = check('ui/2026/social/summer-camp.tsx', 'ui-2026-social-summer-camp');
    expect(v).toEqual({ ok: true, rel: 'ui/2026/social/summer-camp.tsx' });
  });

  it('accepts a canvas directly in a group', () => {
    expect(check('ui/Card.tsx', 'ui-card').ok).toBe(true);
  });

  it('accepts the design-system group', () => {
    expect(check('system/preview/logo.tsx', 'system-preview-logo').ok).toBe(true);
  });

  it('accepts a filename with a space — they exist and they sync today', () => {
    // The slug transform maps whitespace to `_`, so `Kanban App.tsx` is a real
    // canvas with a real document. Refusing it here would silently relocate a
    // file that works today.
    expect(check('ui/Kanban App.tsx', 'ui-kanban_app').ok).toBe(true);
  });

  it('is case-insensitive about the slug, like the slug transform', () => {
    expect(check('ui/Card.tsx', 'UI-CARD').ok).toBe(true);
  });
});

describe('validateCanvasPath — the traversal corpus', () => {
  const corpus: Array<[string, unknown, string]> = [
    ['parent traversal', '../../etc/passwd.tsx', 'anything'],
    ['traversal inside a group', 'ui/../../../tmp/x.tsx', 'anything'],
    ['a bare dot component', 'ui/./Card.tsx', 'ui-card'],
    ['absolute posix', '/etc/cron.d/x.tsx', 'anything'],
    ['windows drive', 'C:\\Windows\\x.tsx', 'anything'],
    ['UNC share', '\\\\host\\share\\x.tsx', 'anything'],
    ['a backslash smuggling a separator', 'ui\\..\\..\\x.tsx', 'anything'],
    ['an empty component', 'ui//Card.tsx', 'ui-card'],
    ['a trailing slash', 'ui/Card.tsx/', 'ui-card'],
    ['a NUL byte', 'ui/Card.tsx\u0000.png', 'ui-card'],
    ['a newline', 'ui/Ca\nrd.tsx', 'ui-card'],
    ['percent-encoded traversal', 'ui/%2e%2e/%2e%2e/x.tsx', 'anything'],
    ['a unicode dot lookalike as a component', 'ui/\u2024\u2024/x.tsx', 'anything'],
    ['a bidi override in a component', 'ui/Ca\u202erd.tsx', 'ui-card'],
    ['not a .tsx', 'ui/Card.html', 'ui-card'],
    ['no extension at all', 'ui/Card', 'ui-card'],
    ['an extra extension', 'ui/Card.tsx.png', 'ui-card'],
    ['a dotfile', 'ui/.env.tsx', 'anything'],
    ['at the design root, in no group', 'ui-card.tsx', 'ui-card'],
    ['outside every declared group', 'assets/Card.tsx', 'assets-card'],
    ['not a string', 42, 'anything'],
    ['an object', { toString: () => 'ui/Card.tsx' }, 'ui-card'],
    ['the empty string', '', 'anything'],
  ];

  for (const [label, path, slug] of corpus) {
    it(`refuses ${label}`, () => {
      const v = validateCanvasPath({ path, slug, designRel: '.design', canvasGroups: GROUPS });
      expect(v.ok).toBe(false);
    });
  }

  it('refuses a path longer than the cap', () => {
    const long = `ui/${'a'.repeat(MAX_CANVAS_PATH_LEN)}.tsx`;
    expect(validateCanvasPath({ path: long, slug: 'x', canvasGroups: GROUPS }).ok).toBe(false);
  });
});

describe('rule 7 — a path that points elsewhere no longer addresses this document', () => {
  it('refuses a well-formed path belonging to a DIFFERENT canvas', () => {
    // The one that matters. Every rule above refuses a MALFORMED path; this
    // refuses a perfectly legal one that simply is not this document's. Without
    // it, any peer could overwrite any other canvas in the project by pushing a
    // body under its own document name and someone else's path.
    const v = check('ui/secrets/credentials.tsx', 'ui-card');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('slugs to');
  });

  it('refuses a path that only differs in a folder boundary', () => {
    // `ui/a-b.tsx` and `ui/a/b.tsx` slug identically (`ui-a-b`) — so this pair
    // is ACCEPTED by rule 7 on purpose: the collision is the slug's, it predates
    // this feature, and `admitCanvases` already refuses to sync both files.
    expect(check('ui/a/b.tsx', 'ui-a-b').ok).toBe(true);
    expect(check('ui/a-b.tsx', 'ui-a-b').ok).toBe(true);
    // What is NOT accepted is a path whose slug simply differs.
    expect(check('ui/a/c.tsx', 'ui-a-b').ok).toBe(false);
  });
});

describe('fallbackCanvasPath — visible, and still the same document', () => {
  it('places an un-pathed canvas inside the group its slug came from', () => {
    expect(fallbackCanvasPath('ui-legacy', GROUPS)).toBe('ui/legacy.tsx');
  });

  it('the result slugs BACK to the document — a fallback must not fork it', () => {
    // The property, not the string. `ui/ui-legacy.tsx` would be visible and
    // would slug to `ui-ui-legacy`: a second document syncing the same bytes,
    // with the original orphaned on the hub.
    for (const slug of ['ui-legacy', 'ui-2026-social-summer-camp', 'system-preview-logo']) {
      expect(canvasSlugFromRel(fallbackCanvasPath(slug, GROUPS), '.design')).toBe(slug);
    }
  });

  it('picks the group the slug actually came from, not the first one', () => {
    const groups = [{ path: 'ui' }, { path: 'screens' }];
    expect(fallbackCanvasPath('screens-x', groups)).toBe('screens/x.tsx');
  });

  it('prefers the LONGEST matching group over declaration order', () => {
    const groups = [{ path: 'ui' }, { path: 'ui/social' }];
    expect(fallbackCanvasPath('ui-social-x', groups)).toBe('ui/social/x.tsx');
  });

  it('keeps the design root when no declared group matches the slug', () => {
    // Today's behaviour, deliberately: it is invisible, but it is the SAME
    // document. A canvas that was outside every group at its author cannot be
    // placed inside one without renaming it — which is what a path is for.
    expect(fallbackCanvasPath('welcome', GROUPS)).toBe('welcome.tsx');
    expect(fallbackCanvasPath('x', [])).toBe('x.tsx');
  });

  it('drops a group path that escapes the design root', () => {
    expect(fallbackCanvasPath('etc-x', [{ path: '../../etc' }])).toBe('etc-x.tsx');
  });

  it('never produces a separator, a dotfile or a `..` from the slug', () => {
    // The slug is charset-constrained upstream (`slugFromDocName`), so this is
    // the second line rather than the first — but it is the line that stands
    // between a bad slug and a directory of the sender's choosing.
    for (const hostile of ['../../evil', '/etc/passwd', '..', '.', 'a\\b', '']) {
      const rel = fallbackCanvasPath(hostile, GROUPS);
      expect(rel).not.toContain('/');
      expect(rel).not.toContain('\\');
      expect(rel).not.toContain('..');
      expect(rel.startsWith('.')).toBe(false);
      expect(rel.endsWith('.tsx')).toBe(true);
    }
  });
});

describe('resolveCanvasBodyRel — one answer for "what does a refused path do"', () => {
  it('uses the path when it validates', () => {
    expect(
      resolveCanvasBodyRel({
        path: 'ui/2026/social/summer-camp.tsx',
        slug: 'ui-2026-social-summer-camp',
        designRel: '.design',
        canvasGroups: GROUPS,
      })
    ).toEqual({ rel: 'ui/2026/social/summer-camp.tsx', fromPath: true });
  });

  it('falls back — never throws the canvas away — and says why', () => {
    const reasons: string[] = [];
    const out = resolveCanvasBodyRel({
      path: '../../etc/passwd.tsx',
      slug: 'ui-card',
      canvasGroups: GROUPS,
      onRefused: (r) => reasons.push(r),
    });
    expect(out).toEqual({ rel: 'ui/card.tsx', fromPath: false });
    expect(reasons.length).toBe(1);
  });

  it('an ABSENT path is not a refusal — an older peer omits it', () => {
    const reasons: string[] = [];
    const out = resolveCanvasBodyRel({
      path: undefined,
      slug: 'ui-card',
      canvasGroups: GROUPS,
      onRefused: (r) => reasons.push(r),
    });
    expect(out).toEqual({ rel: 'ui/card.tsx', fromPath: false });
    expect(reasons).toEqual([]);
  });
});
