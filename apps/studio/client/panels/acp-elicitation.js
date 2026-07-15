// Pure helpers for ACP form elicitation (feature-acp-ask-user-question) —
// parses a `requestedSchema` (ElicitationSchema, confirmed on disk against
// `@agentclientprotocol/sdk`'s schema/types.gen.d.ts) into renderable question
// descriptors, and folds the UI's answer state back into the `content` map a
// `CreateElicitationResponse` expects. No DOM — `ElicitationPrompt.jsx` is the
// only consumer that touches rendering.
//
// The exact field-naming convention this is written against — `question_<n>`
// paired with a sibling `question_<n>_custom` free-text field, enum options
// carrying `{const, title, description?}` — is confirmed by reading
// `@agentclientprotocol/claude-agent-acp/dist/elicitation.js`'s
// `askUserQuestionsToCreateRequest`/`applyAskElicitationResponse` directly (the
// installed source, not the docs — this whole feature rides an UNSTABLE
// protocol surface). The parser is written generically against the pairing
// PATTERN (`<key>` + `<key>_custom` both present in `properties`), not
// hardcoded to the `question_` prefix, so a well-formed non-AskUserQuestion MCP
// form that happens to follow the same convention renders correctly too.

// SECURITY (ethical-hacker finding) — Maude's bridge only ever declares the
// `form` elicitation capability, never `url` (see DDR-180's Open decisions +
// `acp/bridge.ts`'s structural rejection of any other mode). The MCP spec's
// OWN guidance is that url-mode exists specifically so a real credential
// request never has to pass through the LLM/client at all. By not supporting
// it, Maude makes the free-text box on THIS card the only channel any
// connected MCP server — benign or hostile — can ever use to ask for a
// secret. This heuristic doesn't change accept/decline routing or try to
// block the request; it only asks the free-text input to behave like a
// password field (masked, with a visible warning) when the question's own
// text reads as a credential ask, so a user who WOULD stop and think twice
// before typing a real secret into a password-styled field gets that same
// pause here. A false positive just means an unrelated question shows a
// masked box — harmless; a false negative leaves today's behavior unchanged.
const SECRET_SHAPED_PATTERN =
  /\b(password|passphrase|secret|api[\s_-]?key|access[\s_-]?key|private[\s_-]?key|auth(?:entication)?[\s_-]?token|credential|oauth[\s_-]?token)\b/i;

/** Does this question's own text read as a request for a credential/secret?
 *  Checked against title + description (or a top-level card `message`) — text
 *  the requester chose, never the user's own typed answer. */
export function looksLikeSecretRequest(...texts) {
  const joined = texts.filter((t) => typeof t === 'string').join(' ');
  return SECRET_SHAPED_PATTERN.test(joined);
}

/** `_meta` key under which `askUserQuestionsToCreateRequest` bridges an
 *  AskUserQuestion option's `preview` (mockup/code-snippet/comparison) — ACP's
 *  `EnumOption` has no first-class slot for it (confirmed on disk against the
 *  installed `claude-agent-acp/dist/elicitation.js`). */
const OPTION_PREVIEW_META_KEY = '_claude/askUserQuestionOption';

/** Titled or bare enum options → a uniform `{value, label, description, preview}`
 *  list. `oneOf`/array-items `anyOf` carry `{const, title, description?, _meta?}`;
 *  a bare `enum` is just an array of strings with no separate label/preview. */
function normalizeOptions(schema) {
  if (Array.isArray(schema?.oneOf)) {
    return schema.oneOf.map((o) => ({
      value: o?.const,
      label: o?.title ?? String(o?.const ?? ''),
      description: o?.description ?? null,
      preview: o?._meta?.[OPTION_PREVIEW_META_KEY]?.preview ?? null,
    }));
  }
  if (Array.isArray(schema?.enum)) {
    return schema.enum.map((v) => ({
      value: v,
      label: String(v),
      description: null,
      preview: null,
    }));
  }
  return [];
}

/** Classify one ElicitationPropertySchema into a renderable `kind` + its options. */
function classifyProperty(prop) {
  if (!prop || typeof prop !== 'object') return null;
  if (prop.type === 'string' && (Array.isArray(prop.oneOf) || Array.isArray(prop.enum))) {
    return { kind: 'single', options: normalizeOptions(prop) };
  }
  if (prop.type === 'array') {
    const items = prop.items;
    const options = Array.isArray(items?.anyOf)
      ? normalizeOptions({ oneOf: items.anyOf })
      : normalizeOptions(items);
    if (options.length) return { kind: 'multi', options };
    return { kind: 'text', options: [] }; // array without an item enum — no renderer for it; fall back to text
  }
  // string/number/integer/boolean with no enum, or anything unrecognized —
  // render as a plain free-text field rather than dropping the question.
  return { kind: 'text', options: [] };
}

/**
 * Walk `requestedSchema.properties` in object-key order into an ordered list
 * of renderable question descriptors:
 *   { id, title, description, kind: 'single'|'multi'|'text', options, required, customFieldId }
 * Tolerates a missing/malformed schema (returns `[]`) — never throws, since a
 * malformed elicitation must still let the user Skip/Cancel rather than crash
 * the panel.
 */
export function parseElicitationSchema(requestedSchema) {
  const properties = requestedSchema?.properties;
  if (!properties || typeof properties !== 'object') return [];
  const keys = Object.keys(properties);
  const required = new Set(Array.isArray(requestedSchema.required) ? requestedSchema.required : []);
  // A key is a "custom" sibling (and must NOT render as its own top-level
  // question) when `<base>_custom` names it AND `<base>` is also a property.
  const customKeys = new Set();
  for (const k of keys) {
    if (!k.endsWith('_custom')) continue;
    const base = k.slice(0, -'_custom'.length);
    if (base && Object.hasOwn(properties, base)) customKeys.add(k);
  }

  const questions = [];
  for (const id of keys) {
    if (customKeys.has(id)) continue;
    const prop = properties[id];
    const classified = classifyProperty(prop);
    if (!classified) continue;
    const customFieldId = customKeys.has(`${id}_custom`) ? `${id}_custom` : null;
    questions.push({
      id,
      title: prop.title ?? null,
      description: prop.description ?? null,
      kind: classified.kind,
      options: classified.options,
      required: required.has(id),
      customFieldId,
      secretShaped: looksLikeSecretRequest(prop.title, prop.description),
    });
  }
  return questions;
}

/**
 * Fold the UI's answer state into the `content` map a `CreateElicitationResponse`
 * `accept` action carries. `answers` is keyed by question id (string for
 * single/text, string[] for multi) AND by `customFieldId` (string) where the
 * user typed a free-text override.
 *
 * A non-empty, trimmed custom answer wins over a selection — mirrors
 * `applyAskElicitationResponse`'s documented read order exactly (it checks the
 * `_custom` field first and only falls back to the base field when empty), so
 * an AskUserQuestion form folds identically however the adapter reads it back.
 * An unanswered, non-required question is simply omitted from `content`
 * (Skip/leave-blank must never fabricate a value).
 */
export function buildElicitationContent(questions, answers) {
  // `Object.create(null)` — a question/custom-field id of `__proto__` (an
  // agent-supplied schema key, technically attacker-influenceable) would
  // otherwise hit the Object.prototype accessor on a plain `{}` literal
  // instead of creating an own key, silently dropping that answer
  // (security-auditor finding; not exploitable across the wire since
  // JSON.stringify never serializes it either way, but a null-prototype
  // object closes it outright rather than relying on that side effect).
  const content = Object.create(null);
  const src = answers && typeof answers === 'object' ? answers : {};
  for (const q of questions ?? []) {
    const custom = q.customFieldId ? src[q.customFieldId] : undefined;
    if (typeof custom === 'string' && custom.trim() !== '') {
      content[q.customFieldId] = custom.trim();
      continue;
    }
    const value = src[q.id];
    if (q.kind === 'multi') {
      if (Array.isArray(value) && value.length) content[q.id] = value;
    } else if (typeof value === 'string' && value !== '') {
      content[q.id] = value;
    }
  }
  return content;
}
