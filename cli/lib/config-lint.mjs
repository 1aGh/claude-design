// Schema-validate a workflows.config.json against the flow plugin's
// JSON Schema (Draft 2020-12), with a Levenshtein-distance post-pass that
// turns "enum" errors into actionable suggestions.
//
// Pure: no I/O for output, no process.exit. The CLI (cli/commands/doctor.mjs)
// handles all formatting and termination. Two input shapes accepted:
//
//   lintConfig({ configPath, schemaPath })  // loads from disk
//   lintConfig({ config, schema })          // already-parsed objects
//
// Returns { ok, errors }, where each error is
//   { path: '/quality/lint', message: '...', value, allowed?, suggestion? }
//
// `additionalProperties: false` errors in the schema surface as "unknown
// property X" — actionable on its own.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020.js';

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function suggestEnum(value, allowed) {
  if (typeof value !== 'string') return null;
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of allowed) {
    if (typeof candidate !== 'string') continue;
    const d = levenshtein(value, candidate);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  if (bestDist <= 3) return best;
  return null;
}

function ajvErrorToReport(e) {
  // e.instancePath is JSON Pointer ('' = root). For additionalProperties
  // violations, Ajv puts the offending key in e.params.additionalProperty,
  // and instancePath points at the parent.
  const path = e.instancePath || '/';
  if (e.keyword === 'additionalProperties') {
    const sep = path === '/' || path === '' ? '' : path;
    return {
      path: `${sep}/${e.params.additionalProperty}`,
      message: `unknown property "${e.params.additionalProperty}" (additionalProperties: false)`,
      value: undefined,
    };
  }
  if (e.keyword === 'enum') {
    return {
      path,
      message: `must be one of: ${e.params.allowedValues.join(' | ')}`,
      value: e.data,
      allowed: e.params.allowedValues,
    };
  }
  if (e.keyword === 'required') {
    const sep = path === '/' || path === '' ? '' : path;
    return {
      path: `${sep}/${e.params.missingProperty}`,
      message: `missing required property "${e.params.missingProperty}"`,
      value: undefined,
    };
  }
  if (e.keyword === 'type') {
    return {
      path,
      message: `must be ${Array.isArray(e.params.type) ? e.params.type.join(' | ') : e.params.type}`,
      value: e.data,
    };
  }
  if (e.keyword === 'minLength') {
    return {
      path,
      message: `must have at least ${e.params.limit} character${e.params.limit === 1 ? '' : 's'}`,
      value: e.data,
    };
  }
  return {
    path,
    message: e.message || e.keyword,
    value: e.data,
  };
}

export async function lintConfig(input) {
  let config = input.config;
  let schema = input.schema;
  if (config === undefined) {
    if (!input.configPath) throw new Error('lintConfig: need `config` or `configPath`');
    config = JSON.parse(await readFile(resolve(input.configPath), 'utf8'));
  }
  if (schema === undefined) {
    if (!input.schemaPath) throw new Error('lintConfig: need `schema` or `schemaPath`');
    schema = JSON.parse(await readFile(resolve(input.schemaPath), 'utf8'));
  }

  // Ajv2020 is the Draft-2020-12 entry. Default `import Ajv from 'ajv'` is
  // Draft-07 and silently accepts schemas with $schema: 2020-12 while
  // skipping new keywords — that would mask bugs.
  const ajv = new Ajv2020({ allErrors: true, strict: false, verbose: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(config);
  if (ok) return { ok: true, errors: [] };

  const errors = (validate.errors || []).map((e) => {
    const report = ajvErrorToReport(e);
    if (report.allowed && typeof report.value === 'string') {
      const s = suggestEnum(report.value, report.allowed);
      if (s !== null) report.suggestion = s;
    }
    return report;
  });
  return { ok: false, errors };
}

// Exported for the test file.
export const _internals = { levenshtein, suggestEnum };
