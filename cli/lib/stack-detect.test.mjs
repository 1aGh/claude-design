import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { detectQualityGates, detectStack } from './stack-detect.mjs';

function fresh() {
  return mkdtempSync(join(tmpdir(), 'stackdetect-'));
}
function file(root, rel, content = '') {
  const path = join(root, rel);
  const parts = rel.split('/');
  if (parts.length > 1) mkdirSync(join(root, parts.slice(0, -1).join('/')), { recursive: true });
  writeFileSync(path, content);
}

test('empty repo — all unknown, quality null', async () => {
  const root = fresh();
  const stack = await detectStack(root);
  assert.equal(stack.language, 'unknown');
  assert.equal(stack.framework, 'unknown');
  assert.equal(stack.packageManager, 'unknown');
  assert.equal(stack.monorepo, false);
  assert.equal(await detectQualityGates(root), null);
});

test('Next.js + biome + tsconfig — language=ts, framework=next.js, router=next-app, quality has lint/format/typecheck', async () => {
  const root = fresh();
  file(root, 'package.json', JSON.stringify({ name: 'x', scripts: { build: 'next build' } }));
  file(root, 'pnpm-lock.yaml');
  file(root, 'tsconfig.json', '{}');
  file(root, 'next.config.mjs');
  file(root, 'biome.json', '{}');
  file(root, 'app/page.tsx');

  const stack = await detectStack(root);
  assert.equal(stack.language, 'typescript');
  assert.equal(stack.framework, 'next.js');
  assert.equal(stack.router, 'next-app');
  assert.equal(stack.packageManager, 'pnpm');

  const q = await detectQualityGates(root);
  assert.equal(q.lint, 'pnpm biome check .');
  assert.equal(q.format, 'pnpm biome format --write .');
  assert.equal(q.typecheck, 'pnpm exec tsc --noEmit');
  assert.equal(q.build, 'pnpm build');
  assert.equal(q.tests, undefined);
});

test('Expo + prettier — framework=expo, router=expo-router, format=prettier', async () => {
  const root = fresh();
  file(
    root,
    'package.json',
    JSON.stringify({ name: 'x', scripts: { test: 'jest' }, devDependencies: { jest: '*' } })
  );
  file(root, 'yarn.lock');
  file(root, 'app.json', '{}');
  file(root, '.prettierrc', '{}');

  const stack = await detectStack(root);
  assert.equal(stack.framework, 'expo');
  assert.equal(stack.router, 'expo-router');
  assert.equal(stack.packageManager, 'yarn');
  assert.equal(stack.tests, 'jest');

  const q = await detectQualityGates(root);
  assert.equal(q.format, 'yarn prettier --write .');
  assert.equal(q.tests, 'yarn test');
});

test('pnpm monorepo with workspace-only tsconfig — TS detected via deep scan', async () => {
  const root = fresh();
  file(root, 'package.json', JSON.stringify({ name: 'monorepo' }));
  file(root, 'pnpm-workspace.yaml', '');
  file(root, 'pnpm-lock.yaml');
  file(root, 'packages/web/package.json', '{}');
  file(root, 'packages/web/tsconfig.json', '{}');

  const stack = await detectStack(root);
  assert.equal(stack.language, 'typescript');
  assert.equal(stack.monorepo, true);
});

test('package.json with only scripts.format — single quality gate emitted', async () => {
  const root = fresh();
  file(root, 'package.json', JSON.stringify({ name: 'x', scripts: { format: 'biome format .' } }));

  const q = await detectQualityGates(root);
  assert.deepEqual(q, { format: 'npm run format' });
});

test('npm (no lockfile signals) — pmPrefix falls back to `npm run` for scripts, `npx` for tool fallbacks', async () => {
  const root = fresh();
  file(root, 'package.json', JSON.stringify({ name: 'x' }));
  file(root, 'tsconfig.json', '{}');

  const q = await detectQualityGates(root);
  // No scripts → tsconfig fallback should use npx tsc.
  assert.equal(q.typecheck, 'npx tsc --noEmit');
});

test('vitest in devDependencies — tests=vitest via substring match', async () => {
  const root = fresh();
  file(root, 'package.json', JSON.stringify({ name: 'x', devDependencies: { vitest: '^2' } }));
  file(root, 'package-lock.json');

  const stack = await detectStack(root);
  assert.equal(stack.tests, 'vitest');
  assert.equal(stack.packageManager, 'npm');
});

test('CI detection — .github/workflows wins', async () => {
  const root = fresh();
  file(root, 'package.json', JSON.stringify({ name: 'x' }));
  mkdirSync(join(root, '.github/workflows'), { recursive: true });

  const stack = await detectStack(root);
  assert.equal(stack.ci, 'github-actions');
});
