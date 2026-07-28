#!/usr/bin/env bash
# Hub backup restore drill — Cloud Phase 2 Task 3 exit gate.
#
# Seeds a throwaway hub data dir with a document store, takes a real backup
# generation through the production code path (VACUUM INTO → gzip → target),
# then restores it into a fresh directory and verifies the RESTORED database.
#
# The point is the restore, not the backup. `maude hub restore-drill` exits
# non-zero when the restored store fails integrity_check, contains zero
# documents, or is missing the sentinel — so this script needs no assertions of
# its own beyond `set -e`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

DATA="$WORK/data"
DEST="$WORK/backups"
SENTINEL="ws/drill/main/sentinel-canvas"
mkdir -p "$DATA" "$DEST"

# Seed from apps/hub so better-sqlite3 resolves the same way the hub resolves it.
( cd "$REPO_ROOT/apps/hub" && node -e "
const Database = require('better-sqlite3');
const db = new Database(process.argv[1]);
db.exec('CREATE TABLE IF NOT EXISTS \"documents\" (name TEXT PRIMARY KEY, data BLOB)');
const insert = db.prepare('INSERT OR REPLACE INTO \"documents\" (name, data) VALUES (?, ?)');
// Non-UTF8 bytes on purpose: a JSON round trip would mangle them, and Yjs
// updates must survive a backup verbatim (the phase-9.2 anti-pattern).
insert.run(process.argv[2], Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80]));
insert.run('ui-screen', Buffer.from('canvas'));
db.close();
" "$DATA/hub.db" "$SENTINEL" )

echo "==> taking a backup generation"
node "$REPO_ROOT/cli/bin/maude.mjs" hub backup --data "$DATA" --target "file://$DEST"

echo "==> restoring it into a throwaway dir and verifying"
node "$REPO_ROOT/cli/bin/maude.mjs" hub restore-drill --target "file://$DEST" --sentinel "$SENTINEL"

echo "==> restore drill PASSED"
