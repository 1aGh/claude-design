// canvas-create.ts — Phase 22 UI add-on. Pure helpers behind POST /_api/canvas
// (api.ts createCanvas), which lets the browser file-tree create a blank brief
// board directly — no slash command, no model cost. Generation (ingesting a
// board's notes into artboards) stays with Claude via `/design:new`; this only
// stamps out the empty annotation surface.
//
// SINGLE SOURCE — the board envelope is the SAME `brief-board.tsx.template`
// `/design:new --blank` substitutes. We text-import it so Bun.build inlines the
// content into the `bun --compile` standalone binary (verified: works at dev
// runtime AND embeds at build time), sidestepping DDR-045 — no runtime disk read
// of a file that lives outside `apps/studio/`. The template stayed under the
// design plugin (plugins/design/templates) when the studio moved (DDR-095).

import briefBoardTemplate from '../../plugins/design/templates/brief-board.tsx.template' with {
  type: 'text',
};

export const BRIEF_BOARD_TEMPLATE: string = briefBoardTemplate;

/**
 * The ONE security boundary for the create endpoint. A canvas name is the only
 * user-controlled value, and it is interpolated into BOTH a real nested
 * filesystem path (`<group>/<name>.tsx`) AND the generated `.tsx` (JSX text) +
 * `.meta.json` (JSON string). This strict allowlist does triple duty:
 *   • path safety   — no `/`, `\`, `..`, or leading dot ⇒ no traversal;
 *   • template safety — no `<`, `>`, `{`, `}` ⇒ can't break out of JSX text;
 *   • JSON safety    — no `"` or `\` ⇒ can't break out of a meta string.
 * Unicode letters/numbers are allowed (so "Onboarding Brief" / accented names
 * work); the first char must be a letter/number (excludes leading space/dash/dot).
 */
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,59}$/u;

export interface NameValidation {
  ok: boolean;
  name?: string;
  componentName?: string;
  error?: string;
}

export function validateCanvasName(raw: unknown): NameValidation {
  if (typeof raw !== 'string') return { ok: false, error: 'name must be a string' };
  // NFC-normalize so a decomposed (NFD) name and its composed sibling can't hash
  // to two JS strings that collide to ONE on-disk path on a normalizing filesystem
  // (APFS/HFS+) — which would let the 409 existence guard be bypassed and an
  // existing board silently overwritten (Phase 22 security review, low). Collapse
  // runs of SPACES (the one allowed whitespace) to a single space so the JS slug
  // (`/\s+/→_`) and slug.sh (`tr ' ' '_'`) can't diverge on a double-spaced name
  // (review #4); tabs/newlines stay un-collapsed and are rejected by NAME_RE.
  const name = raw.normalize('NFC').trim().replace(/ +/g, ' ');
  if (!name) return { ok: false, error: 'name is required' };
  if (name.length > 60) return { ok: false, error: 'name must be 60 characters or fewer' };
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      error: 'name may contain only letters, numbers, spaces, hyphens and underscores',
    };
  }
  // Defense in depth — the regex already forbids these, but assert no path bits
  // survive (a regex edit must never silently re-open traversal).
  if (name.includes('..') || name.includes('/') || name.includes('\\') || name.startsWith('.')) {
    return { ok: false, error: 'name may not contain path separators or leading dots' };
  }
  return { ok: true, name, componentName: componentNameFrom(name) };
}

/** PascalCase a name into a valid JS identifier for the component default export.
 *  Non-identifier characters split words; an empty / digit-leading result gets a
 *  `Board` prefix so the emitted `export default function <id>()` always parses. */
export function componentNameFrom(name: string): string {
  // Split on NON-(letter|number) so Unicode letters survive (the validator
  // accepts them) — `Přihlášení` → `Přihlášení`, a valid JS identifier (verified
  // it parses), not the ASCII-mangled `PIhlEn` (review #1). Empty (all-symbol) →
  // `BriefBoard`; a digit-leading result (incl. Unicode digits) → `Board…` so the
  // emitted `export default function <id>()` always parses.
  const pascal = name
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
  if (!pascal) return 'BriefBoard';
  if (/^\p{Nd}/u.test(pascal)) return `Board${pascal}`;
  return pascal;
}

export interface BriefBoardOpts {
  name: string;
  componentName: string;
  dsName: string;
  platform: string;
  seedHint: string;
  historyDir: string;
}

/** Substitute the brief-board template placeholders. Safe because `name`
 *  (the only user value reaching here) is validated by `validateCanvasName`,
 *  and every other field is server-derived (config / fixed strings). */
export function renderBriefBoard(opts: BriefBoardOpts): string {
  return BRIEF_BOARD_TEMPLATE.replaceAll('{{NAME}}', opts.name)
    .replaceAll('{{COMPONENT_NAME}}', opts.componentName)
    .replaceAll('{{DS_NAME}}', opts.dsName)
    .replaceAll('{{PLATFORM}}', opts.platform)
    .replaceAll('{{SEED_HINT}}', opts.seedHint)
    .replaceAll('{{HISTORY_DIR}}', opts.historyDir);
}
