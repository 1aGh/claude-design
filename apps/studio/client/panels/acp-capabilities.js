// Pure helpers for the ACP session-capabilities channel (feature-acp-panel-
// dynamic-claude-code-capabilities). Every model/mode/effort list rendered by
// the panel is parsed from these — NEVER a hardcoded array. The session's
// `configOptions[]` is a generic, agent-defined menu (models/effort/fast-mode/
// agent persona/…, keyed by opaque ids); `modes` is the separate, protocol-
// typed permission-mode roster. See CapabilityBar.jsx for the render side.

const KNOWN_CONFIG_IDS = { model: 'model', effort: 'effort', fast: 'fast', mode: 'mode' };

/**
 * `configOptions[]` → the three well-known controls (identified by `id` —
 * `category` is only a UX hint and may be absent, e.g. the "Agent persona"
 * option) plus every OTHER advertised select option, generic. The "mode"
 * entry mirrors `modes`/`SessionModeState` (the adapter keeps both in sync)
 * so it's excluded here — the dedicated mode picker renders from `parseModes`
 * instead, never from this list, or it would show twice.
 */
export function parseConfigOptions(configOptions) {
  const list = Array.isArray(configOptions) ? configOptions : [];
  let model = null;
  let effort = null;
  let fast = null;
  const others = [];
  for (const opt of list) {
    if (!opt || typeof opt !== 'object' || opt.id === KNOWN_CONFIG_IDS.mode) continue;
    if (opt.id === KNOWN_CONFIG_IDS.model) model = opt;
    else if (opt.id === KNOWN_CONFIG_IDS.effort) effort = opt;
    else if (opt.id === KNOWN_CONFIG_IDS.fast) fast = opt;
    else others.push(opt);
  }
  return { model, effort, fast, others };
}

/**
 * `SessionModeState` → `{ current, available }` (empty when the agent doesn't
 * advertise modes at all). `available` legitimately varies turn to turn — the
 * adapter clamps the roster to what the CURRENT model supports (e.g. "Auto"
 * only when `supportsAutoMode`) — never assume a fixed set.
 */
export function parseModes(modes) {
  if (!modes || !Array.isArray(modes.availableModes)) return { current: null, available: [] };
  return { current: modes.currentModeId ?? null, available: modes.availableModes };
}

/**
 * Flatten a `SessionConfigSelect.options` — a flat option array OR grouped
 * (`SessionConfigSelectGroup[]`, each `{group,name,options}`) — into one list
 * of selectable leaves (`{value,name,description}`).
 */
export function flattenSelectOptions(options) {
  const list = Array.isArray(options) ? options : [];
  const out = [];
  for (const o of list) {
    if (o && Array.isArray(o.options)) out.push(...o.options);
    else if (o) out.push(o);
  }
  return out;
}

/**
 * Resolve which value a picker should show: the user's last explicit pick
 * (localStorage, `savedValue`) if it's still offered among `availableValues`
 * (a plain array of value/id strings — the caller flattens+maps first), else
 * `defaultValue` (the session's own current value — a fresh session/model can
 * default to something the last chat didn't use).
 */
export function resolvePersistedPick(availableValues, savedValue, defaultValue) {
  const set = new Set(Array.isArray(availableValues) ? availableValues : []);
  if (savedValue != null && set.has(savedValue)) return savedValue;
  return defaultValue ?? null;
}
