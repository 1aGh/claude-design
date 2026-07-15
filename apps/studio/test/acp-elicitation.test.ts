// Pure unit tests for client/panels/acp-elicitation.js — the schema parser +
// content builder ElicitationPrompt.jsx renders from. Fixture shapes mirror
// the EXACT wire output of `@agentclientprotocol/claude-agent-acp`'s
// `askUserQuestionsToCreateRequest` (confirmed on disk — see the file's own
// header comment), not a guessed/simplified schema.

import { describe, expect, test } from 'bun:test';

import {
  buildElicitationContent,
  looksLikeSecretRequest,
  parseElicitationSchema,
} from '../client/panels/acp-elicitation.js';

// A real single-question AskUserQuestion-shaped schema (single() branch of
// askUserQuestionsToCreateRequest — message carries the question, the field
// itself has no description).
const SINGLE_SELECT_SCHEMA = {
  type: 'object',
  properties: {
    question_0: {
      type: 'string',
      title: 'Which color?',
      oneOf: [
        { const: 'Red', title: 'Red', description: 'Warm' },
        { const: 'Blue', title: 'Blue' },
      ],
    },
    question_0_custom: {
      type: 'string',
      title: 'Other',
      description: 'Type your own answer instead of choosing an option above (optional).',
    },
  },
};

// A real multi-question schema — index 1 is multi-select (array + items.anyOf).
const MULTI_QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    question_0: {
      type: 'string',
      description: 'Pick one',
      oneOf: [
        { const: 'A', title: 'A' },
        { const: 'B', title: 'B' },
      ],
    },
    question_0_custom: { type: 'string', title: 'Other' },
    question_1: {
      type: 'array',
      description: 'Pick many',
      items: {
        anyOf: [
          { const: 'X', title: 'X' },
          { const: 'Y', title: 'Y' },
        ],
      },
    },
    question_1_custom: { type: 'string', title: 'Other' },
  },
};

describe('parseElicitationSchema', () => {
  test('single-select (oneOf): one question, custom field paired not top-level', () => {
    const qs = parseElicitationSchema(SINGLE_SELECT_SCHEMA);
    expect(qs.length).toBe(1);
    expect(qs[0]).toMatchObject({
      id: 'question_0',
      kind: 'single',
      customFieldId: 'question_0_custom',
      required: false,
    });
    expect(qs[0].options).toEqual([
      { value: 'Red', label: 'Red', description: 'Warm', preview: null },
      { value: 'Blue', label: 'Blue', description: null, preview: null },
    ]);
  });

  test('multi-select (array+items.anyOf) alongside a single-select sibling', () => {
    const qs = parseElicitationSchema(MULTI_QUESTION_SCHEMA);
    expect(qs.map((q) => q.id)).toEqual(['question_0', 'question_1']);
    expect(qs[0].kind).toBe('single');
    expect(qs[1].kind).toBe('multi');
    expect(qs[1].options).toEqual([
      { value: 'X', label: 'X', description: null, preview: null },
      { value: 'Y', label: 'Y', description: null, preview: null },
    ]);
    expect(qs[1].customFieldId).toBe('question_1_custom');
  });

  test('a bare enum (untitled strings) renders with value===label', () => {
    const qs = parseElicitationSchema({
      type: 'object',
      properties: { color: { type: 'string', enum: ['red', 'blue'] } },
    });
    expect(qs[0].options).toEqual([
      { value: 'red', label: 'red', description: null, preview: null },
      { value: 'blue', label: 'blue', description: null, preview: null },
    ]);
  });

  test('an enum option carrying the AskUserQuestion preview _meta convention surfaces it as `preview`', () => {
    const qs = parseElicitationSchema({
      type: 'object',
      properties: {
        question_0: {
          type: 'string',
          oneOf: [
            {
              const: 'Option A',
              title: 'Option A',
              _meta: { '_claude/askUserQuestionOption': { preview: 'const x = 1' } },
            },
            { const: 'Option B', title: 'Option B' },
          ],
        },
      },
    });
    expect(qs[0].options[0].preview).toBe('const x = 1');
    expect(qs[0].options[1].preview).toBeNull();
  });

  test('a plain string/number/boolean property with no enum falls back to a text question', () => {
    const qs = parseElicitationSchema({
      type: 'object',
      properties: { note: { type: 'string', title: 'Note' }, age: { type: 'number' } },
    });
    expect(qs.map((q) => q.kind)).toEqual(['text', 'text']);
  });

  test('schema.required marks a question required', () => {
    const qs = parseElicitationSchema({
      type: 'object',
      properties: { note: { type: 'string' } },
      required: ['note'],
    });
    expect(qs[0].required).toBe(true);
  });

  test('a "_custom"-suffixed field with NO base sibling renders as its own question', () => {
    const qs = parseElicitationSchema({
      type: 'object',
      properties: { foo_custom: { type: 'string' } },
    });
    expect(qs.map((q) => q.id)).toEqual(['foo_custom']);
  });

  test('malformed/missing schema tolerance — never throws, returns []', () => {
    expect(parseElicitationSchema(null)).toEqual([]);
    expect(parseElicitationSchema(undefined)).toEqual([]);
    expect(parseElicitationSchema({})).toEqual([]);
    expect(parseElicitationSchema({ properties: null })).toEqual([]);
    expect(parseElicitationSchema({ properties: 'not-an-object' })).toEqual([]);
  });
});

describe('buildElicitationContent', () => {
  test('a selected single-select option folds into content[id]', () => {
    const qs = parseElicitationSchema(SINGLE_SELECT_SCHEMA);
    const content = buildElicitationContent(qs, { question_0: 'Red' });
    expect(content).toEqual({ question_0: 'Red' });
  });

  test('a non-empty custom answer overrides the selection (matches applyAskElicitationResponse read order)', () => {
    const qs = parseElicitationSchema(SINGLE_SELECT_SCHEMA);
    const content = buildElicitationContent(qs, {
      question_0: 'Red',
      question_0_custom: '  Something else  ',
    });
    expect(content).toEqual({ question_0_custom: 'Something else' });
  });

  test('a blank/whitespace-only custom answer does NOT override the selection', () => {
    const qs = parseElicitationSchema(SINGLE_SELECT_SCHEMA);
    const content = buildElicitationContent(qs, { question_0: 'Blue', question_0_custom: '   ' });
    expect(content).toEqual({ question_0: 'Blue' });
  });

  test('multi-select folds a non-empty array; an empty selection is omitted', () => {
    const qs = parseElicitationSchema(MULTI_QUESTION_SCHEMA);
    const content = buildElicitationContent(qs, { question_1: ['X', 'Y'] });
    expect(content).toEqual({ question_1: ['X', 'Y'] });
  });

  test('multi-select: a custom answer is ADDED to the picks (via the base field), not routed through customFieldId', () => {
    const qs = parseElicitationSchema(MULTI_QUESTION_SCHEMA);
    const content = buildElicitationContent(qs, {
      question_1: ['X', 'Y'],
      question_1_custom: '  Z  ',
    });
    // Combined into the BASE field's array — applyAskElicitationResponse only
    // overrides when content[customFieldId] itself is non-empty, so leaving
    // that key absent and appending to content[question_1] instead means the
    // adapter's own join() sees the pick AND the custom text.
    expect(content).toEqual({ question_1: ['X', 'Y', 'Z'] });
    expect(content.question_1_custom).toBeUndefined();
  });

  test('multi-select: a custom answer with NO picks still sends as a single-entry array', () => {
    const qs = parseElicitationSchema(MULTI_QUESTION_SCHEMA);
    const content = buildElicitationContent(qs, { question_1_custom: 'Just this' });
    expect(content).toEqual({ question_1: ['Just this'] });
  });

  test('an unanswered, non-required question is omitted entirely — never fabricates a value', () => {
    const qs = parseElicitationSchema(SINGLE_SELECT_SCHEMA);
    expect(buildElicitationContent(qs, {})).toEqual({});
    expect(buildElicitationContent([], { anything: 'x' })).toEqual({});
  });

  test('tolerates a missing/malformed answers object', () => {
    const qs = parseElicitationSchema(SINGLE_SELECT_SCHEMA);
    expect(buildElicitationContent(qs, null)).toEqual({});
    expect(buildElicitationContent(qs, undefined)).toEqual({});
  });
});

describe('looksLikeSecretRequest', () => {
  test('matches common credential-shaped phrasing, case-insensitively', () => {
    expect(looksLikeSecretRequest('Enter your API key')).toBe(true);
    expect(looksLikeSecretRequest('what is your PASSWORD')).toBe(true);
    expect(looksLikeSecretRequest('Paste your auth token here')).toBe(true);
    expect(looksLikeSecretRequest('Provide your OAuth token')).toBe(true);
  });

  test('checks all provided texts, not just the first', () => {
    expect(looksLikeSecretRequest('Which color do you like?', 'a secret preference')).toBe(true);
    expect(looksLikeSecretRequest(null, 'Enter your secret key', undefined)).toBe(true);
  });

  test('an ordinary question does not trip the heuristic', () => {
    expect(looksLikeSecretRequest('Which color do you like?')).toBe(false);
    expect(looksLikeSecretRequest('What layout do you prefer?')).toBe(false);
  });

  test('tolerates no/malformed input', () => {
    expect(looksLikeSecretRequest()).toBe(false);
    expect(looksLikeSecretRequest(null, undefined, 42)).toBe(false);
  });

  test("parseElicitationSchema tags each question's own secretShaped flag from its title/description", () => {
    const qs = parseElicitationSchema({
      type: 'object',
      properties: {
        question_0: { type: 'string', description: 'Enter your password to continue' },
      },
    });
    expect(qs[0].secretShaped).toBe(true);
  });
});
