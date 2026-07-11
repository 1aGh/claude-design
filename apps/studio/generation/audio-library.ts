// generation/audio-library.ts — reuse-before-you-pay for AUDIO (Task 2.5,
// DDR-164). Music + SFX (and re-usable voiceover) are expensive to regenerate,
// so before an audio `submit` Maude searches two libraries and prefers an
// existing suitable track over spending provider credits:
//
//   1. The project's OWN generated audio — `assets/<sha8>.audio.json` intent
//      sidecars (written by the generate route on every audio job). Byte-content
//      addressing already dedups identical outputs; this adds SEMANTIC "do we
//      already have a warm lo-fi loop?" lookup by what the audio was FOR.
//   2. ElevenLabs History — the user's own past generations, re-downloadable for
//      NO credit (already paid). The adapter fetches those; this module ranks
//      them with the same scorer so local + history results are comparable.
//
// This file is PURE (dependency-free, like types.ts / captions.ts): the scorer +
// the intent shape, with no fs / no fetch. The api layer reads the sidecars and
// the adapter fetches History; both feed their candidates through `rankMatches`
// so the ranking rule is single-sourced and unit-testable.

/** The intent recorded next to a generated audio asset (the durable local index). */
export interface AudioIntent {
  /** `assets/<sha8>.<ext>` — the produced audio this intent describes. */
  asset: string;
  /** `music` | `sfx` | `tts` (the ElevenLabs verb that made it). */
  kind?: string;
  /** The generation prompt (music/sfx) or spoken text (tts). */
  prompt?: string;
  provider?: string;
  model?: string;
  /** ISO timestamp the asset was produced. */
  at?: string;
}

/** A ranked reuse candidate — either a local asset or a re-downloadable History item. */
export interface AudioMatch {
  source: 'local' | 'history';
  /** For a local hit: the `assets/<sha8>.<ext>` path. For history: the item id. */
  ref: string;
  /** 0..1 relevance against the query (exact/keyword overlap). */
  score: number;
  kind?: string;
  prompt?: string;
  provider?: string;
  at?: string;
}

/** A comparable candidate the scorer accepts (local intent or a history item). */
export interface Candidate {
  source: 'local' | 'history';
  ref: string;
  text?: string;
  kind?: string;
  provider?: string;
  at?: string;
}

// Trivial stop-words so "a warm lo-fi loop" scores on the content words, not the
// glue. Deliberately tiny — this is keyword overlap, not NLP (the plan scopes
// fuzzy/embedding similarity to a later nicety).
const STOP = new Set([
  'a',
  'an',
  'the',
  'of',
  'for',
  'and',
  'or',
  'to',
  'in',
  'on',
  'with',
  'at',
  'by',
]);

/**
 * Neutralize a reuse candidate's stored prompt/text before it is echoed anywhere
 * an agent might read it as prose (F3, ethical-hacker). An intent sidecar is
 * peer-synced → UNTRUSTED (DDR-054); its `prompt` could be crafted injection
 * ("SYSTEM: ignore prior instructions…"). Strip control chars + newlines (so it
 * can't fabricate multi-line instructions), collapse whitespace, and hard-cap
 * the length — it stays a short one-line data string, never a prose block.
 */
export function sanitizeReuseText(text: unknown, max = 160): string {
  if (typeof text !== 'string') return '';
  return text
    .split('')
    .map((ch) => {
      const c = ch.charCodeAt(0);
      // Map C0/C1 control chars (incl. newlines/tabs) to a space so a crafted
      // prompt can't fabricate multi-line instructions AND adjacent words don't
      // merge (F3, ethical-hacker).
      return (c >= 0x00 && c <= 0x1f) || (c >= 0x7f && c <= 0x9f) ? ' ' : ch;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Lowercase → alphanumeric tokens, stop-words dropped, de-duplicated. */
export function tokenize(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (text ?? '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

/**
 * Score a candidate against the query — the fraction of the QUERY's content
 * tokens that appear in the candidate text (so a longer candidate isn't
 * penalized, and matching all query words → 1.0). An exact (normalized) string
 * match pins to 1. Returns 0 for no overlap.
 */
export function scoreAudioMatch(query: string, text: string): number {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const normQ = query.trim().toLowerCase();
  const normT = (text ?? '').trim().toLowerCase();
  if (normQ && normQ === normT) return 1;
  const cand = new Set(tokenize(text));
  if (cand.size === 0) return 0;
  let hit = 0;
  for (const t of q) if (cand.has(t)) hit += 1;
  return hit / q.length;
}

/**
 * Rank candidates for a query, keeping only those above `minScore` (default any
 * overlap), best first, tie-broken by recency. `limit` caps the returned set.
 */
export function rankMatches(
  query: string,
  candidates: Candidate[],
  opts: { minScore?: number; limit?: number } = {}
): AudioMatch[] {
  const minScore = opts.minScore ?? 0.01;
  const limit = opts.limit ?? 10;
  return candidates
    .map((c) => ({
      source: c.source,
      ref: c.ref,
      score: scoreAudioMatch(query, c.text ?? ''),
      kind: c.kind,
      prompt: c.text,
      provider: c.provider,
      at: c.at,
    }))
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score || (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, limit);
}
