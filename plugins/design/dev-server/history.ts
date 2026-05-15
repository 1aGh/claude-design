// _history/<slug>/ snapshot stack — consumed by /design:rollback.
// Snapshots are written as opaque artifacts (full file content + meta.json).
// The orchestrator (slash commands) used to write these via Bash; we now expose
// a server-side API so the same logic lives in one place and is callable both
// from the WS layer and from a future server-driven auto-snapshot hook.

import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Context } from './context.ts';

export interface Snapshot {
  slug: string;
  ts: string; // ISO
  reason: string; // free-form: "pre-edit", "post-edit", "manual", etc.
  contentPath: string; // absolute path to the snapshot blob inside _history/
  metaPath: string;
  size: number;
}

export interface History {
  snapshotPath(slug: string, ts: string, ext?: string): string;
  metaPath(slug: string, ts: string): string;
  writeSnapshot(file: string, contentBytes: Uint8Array | string, reason: string): Promise<Snapshot>;
  listSnapshots(file: string): Promise<Snapshot[]>;
  readSnapshot(file: string, ts: string): Promise<{ content: Uint8Array; meta: Snapshot } | null>;
  rollback(file: string, ts: string): Promise<{ content: Uint8Array; meta: Snapshot } | null>;
}

function fileSlug(file: string, designRel: string): string {
  let p = file.replace(/^\/+|\/+$/g, '');
  try {
    p = decodeURIComponent(p);
  } catch {
    /* ignore */
  }
  const prefix = designRel.replace(/^\/+|\/+$/g, '') + '/';
  if (p.startsWith(prefix)) p = p.slice(prefix.length);
  return p
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.html$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}

function tsForFilename(ts: string): string {
  return ts.replace(/[:.]/g, '-');
}

export function createHistory(ctx: Context): History {
  function snapshotPath(slug: string, ts: string, ext = '.html'): string {
    return path.join(ctx.paths.historyDir, slug, `${tsForFilename(ts)}${ext}`);
  }

  function metaPath(slug: string, ts: string): string {
    return path.join(ctx.paths.historyDir, slug, `${tsForFilename(ts)}.json`);
  }

  async function writeSnapshot(file: string, contentBytes: Uint8Array | string, reason: string) {
    const slug = fileSlug(file, ctx.paths.designRel);
    const ts = new Date().toISOString();
    const contentPath = snapshotPath(slug, ts);
    const meta: Snapshot = {
      slug,
      ts,
      reason,
      contentPath,
      metaPath: metaPath(slug, ts),
      size:
        typeof contentBytes === 'string'
          ? Buffer.byteLength(contentBytes, 'utf8')
          : contentBytes.byteLength,
    };
    await Bun.write(contentPath, contentBytes);
    await Bun.write(meta.metaPath, JSON.stringify({ ...meta, file }, null, 2));
    return meta;
  }

  async function listSnapshots(file: string): Promise<Snapshot[]> {
    const slug = fileSlug(file, ctx.paths.designRel);
    const dir = path.join(ctx.paths.historyDir, slug);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const out: Snapshot[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.json')) continue;
      try {
        const meta = JSON.parse(await Bun.file(path.join(dir, e.name)).text()) as Snapshot;
        if (meta?.ts && meta.contentPath) out.push(meta);
      } catch {
        /* ignore corrupt sidecar */
      }
    }
    return out.sort((a, b) => a.ts.localeCompare(b.ts));
  }

  async function readSnapshot(file: string, ts: string) {
    const slug = fileSlug(file, ctx.paths.designRel);
    const m = metaPath(slug, ts);
    const c = snapshotPath(slug, ts);
    try {
      const meta = JSON.parse(await Bun.file(m).text()) as Snapshot;
      const content = new Uint8Array(await Bun.file(c).arrayBuffer());
      return { content, meta };
    } catch {
      return null;
    }
  }

  async function rollback(file: string, ts: string) {
    const r = await readSnapshot(file, ts);
    if (!r) return null;
    const target = path.join(ctx.paths.repoRoot, file);
    await Bun.write(target, r.content);
    return r;
  }

  return { snapshotPath, metaPath, writeSnapshot, listSnapshots, readSnapshot, rollback };
}
