// An empty REPLICA is not an empty HUB — the cell-side half of the F1
// concurrent cold-seed collision.
//
// WHAT WENT WRONG IN THE FIELD. A cell runs two writers over one checkout: the
// hub's workspace agent projects every document onto disk, and the supervised
// studio child scans that same disk. So a canvas created on the DESKTOP landed
// in the cell's checkout as a file the child had no descriptor for — a
// brand-new local canvas, as far as it could tell. It connected, found its own
// replica still empty (the hub's state was in flight), and adopted: a
// clear-and-rebuild from the file. The desktop had already done exactly that on
// its own replica, and two rebuilds from two clientIDs do not dedupe — Yjs
// CONCATENATES them. Every peer ended up with the body twice (two
// `export default`, `0 ARTBOARDS`), on essentially every desktop-created canvas.
//
// The listing is the only enumeration a peer has, so it is the only thing that
// can tell "the hub has never heard of this canvas" from "the hub's copy has
// not arrived yet". These pin both directions of that answer.

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Y from 'yjs';

import { htmlFromDoc } from '../sync/codec.ts';
import { migrateSeed } from '../sync/migrate-seed.ts';

const BODY = [
  'import { DesignCanvas } from "@maude/canvas-lib";',
  'export default function Screen() {',
  '  return <DesignCanvas><h1>Hello</h1></DesignCanvas>;',
  '}',
  '',
].join('\n');

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'seed-defer-'));
  const html = join(dir, 'screen.tsx');
  writeFileSync(html, BODY);
  return {
    slug: 'ui-screen',
    doc: new Y.Doc(),
    paths: {
      html,
      comments: join(dir, '_comments', 'screen.json'),
      annotations: join(dir, 'ui-screen.annotations.svg'),
    },
  };
}

describe('migrateSeed — an empty replica against a hub that already has the document', () => {
  test('does NOT seed when the hub listing says the document holds bytes', async () => {
    const f = fixture();
    const result = await migrateSeed({ ...f, hubHasState: () => true });
    expect(result).toBe('defer-hub-state');
    // Nothing written into the doc — the hub's state arrives on its own, and a
    // second rebuild here is the concatenation this guard exists to prevent.
    expect(htmlFromDoc(f.doc)).toBe('');
  });

  test('still adopts when the hub has never heard of the slug', async () => {
    const f = fixture();
    const result = await migrateSeed({ ...f, hubHasState: () => false });
    expect(result).toBe('local-adopt');
    expect(htmlFromDoc(f.doc)).toBe(BODY);
  });

  test('still adopts when no listing is available at all (older hub)', async () => {
    const f = fixture();
    const result = await migrateSeed(f);
    expect(result).toBe('local-adopt');
    expect(htmlFromDoc(f.doc)).toBe(BODY);
  });

  test('a hub row with zero bytes is not state — that canvas still adopts', async () => {
    const f = fixture();
    // The row exists (the document was created) but carries nothing. Deferring
    // here would leave a canvas that never syncs in either direction.
    const result = await migrateSeed({ ...f, hubHasState: (slug) => slug === 'other' });
    expect(result).toBe('local-adopt');
    expect(htmlFromDoc(f.doc)).toBe(BODY);
  });
});
