# kgai onboarding (per user) — turn on the shared decision graph in ~15 min

kgai is Maude's **opt-in, capability-gated** knowledge-graph memory backend. When it's on, your flow/design agents record decisions into a shared, event-sourced graph and recall prior ones instead of re-deriving them — scoped to your repo + department, synced over S3 (see [company setup](./kgai-company-setup.md)).

**Nothing here is required to use Maude.** With `kg` absent (the default), every flow/design command runs its classic `.ai/` file path, unchanged. This guide is only for joining the company graph.

> Version is **pinned**, never floating (supply-chain surface — the `kg` binary is third-party; see [DDR-189](../.ai/archive/decisions/DDR-189-kgai-cross-repo-shared-graph-trust-model.md)). The pin lives in `config.knowledgeGraph.engineVersion` (currently `v1.4.0`). Check drift anytime with `maude kg check-upstream`.
>
> **This manual download has no self-update.** Re-running step 1 with a bumped `KGVER` is on YOU whenever the pin moves — nothing does it for you. A stale `~/.local/kgai/<old-version>/kg` left on PATH (e.g. via a `~/.local/bin/kg` symlink) will keep being used silently forever otherwise; `kg status` prints a `"version"` field, so a quick `kg status` after any pin bump confirms you're actually running the new one, not just that a new one was downloaded somewhere. (The upstream Claude Code plugin's own installer self-updates on session start — but it was broken on macOS specifically until kgai v1.4.0, so don't assume it caught up for you either; verify with `kg status`.)

## 1. Install the `kg` CLI

Download the pinned release binary + its native library for your platform from [kgai releases](https://github.com/kgaidev/kgai/releases):

```bash
KGVER=v1.4.0
DEST="$HOME/.local/kgai/$KGVER"; mkdir -p "$DEST"
# macOS arm64 (swap the asset names for your platform):
curl -fL "https://github.com/kgaidev/kgai/releases/download/$KGVER/kg-darwin-arm64" -o "$DEST/kg"
curl -fL "https://github.com/kgaidev/kgai/releases/download/$KGVER/libkuzu-darwin-universal.dylib" -o "$DEST/libkuzu.dylib"
chmod +x "$DEST/kg"
# macOS only: ad-hoc codesign the unsigned binaries so Gatekeeper lets them run
codesign --force -s - "$DEST/libkuzu.dylib" "$DEST/kg"
# put kg on PATH + let it find libkuzu
export PATH="$DEST:$PATH"
export DYLD_LIBRARY_PATH="$DEST:$DYLD_LIBRARY_PATH"   # (Linux: LD_LIBRARY_PATH)
kg version   # → { "name": "kg", "ok": true, … }
```

> **Flaky network?** GitHub's CDN can truncate the ~34 MB `libkuzu` on a bad link. Verify the byte size matches the release asset; if short, re-download in ranged chunks. The desktop app bundles `kg` for you (Phase 8) so terminal-less users never do this.

Confirm Maude sees it: `maude doctor` should now show `kg` ✓ instead of missing.

## 2. Configure your AWS profile (for the shared S3 store)

The company store lives at an `s3://…` prefix. Use a **per-user IAM** identity (never a shared key — [DDR-189](../.ai/archive/decisions/DDR-189-kgai-cross-repo-shared-graph-trust-model.md): only a locally-authenticated CLI writes the graph):

```bash
aws configure --profile studyfi-kg      # access key / secret from your company-setup admin
export AWS_PROFILE=studyfi-kg
```

## 3. Point this repo at the store + your scope

Edit `.ai/workflows.config.json` — add the `knowledgeGraph` block:

```jsonc
"knowledgeGraph": {
  "store": "s3://studyfi-kg/store",        // the shared company remote
  "scope": { "repo": "<this-repo>", "dept": "dev" }  // dept ∈ {dev,marketing,finance,automations}
}
```

`mode` defaults to `auto` — with `kg` on PATH and a store set, kgai activates. (Design-only repos still carry a minimal `.ai/workflows.config.json` for this — run `maude init` if you don't have one.)

Verify the resolver agrees:

```bash
maude kg doctor        # active: ✓ yes ; store + scope shown
maude kg resolve       # { "active": true, "store": "s3://…", "scope": {…} }
```

## 4. Bootstrap the local store + connect the remote

```bash
kg init --remote s3://studyfi-kg/store    # creates .kgai/store/, records the remote + your git-author identity
maude kg sync                             # first pull — brings down the company graph
```

`kg init` stamps your author from `git config user.name` automatically — nothing to wire. `.kgai/store/` is per-machine and gitignored.

## 5. (Optional) migrate this repo's existing decisions

If the repo already has `.ai/archive/decisions/DDR-*.md`, fold them into the graph once:

```bash
/flow:migrate-kgai          # or: maude kg import --dry-run  then  maude kg import
```

Idempotent + archive-preserving — your `.ai/archive/decisions/` files are kept read-only. See [`flow:kgai-migrate`](../plugins/flow/skills/kgai-migrate/SKILL.md).

## 6. Verify it works

```bash
maude kg context --about "<something your team decided>"     # recalls prior decisions
maude kg query "MATCH (d:Decision) WHERE d.author='$(git config user.name)' RETURN d.title ORDER BY d.recorded_at DESC LIMIT 5"
```

From now on: `/flow:record-ddr`, `/flow:plan`, `/flow:done`, `/design:new`, `/design:edit` read/write the graph automatically. `maude kg sync` runs at `/flow:done` + `/flow:pause` and on session start (pull) — you don't call it by hand in normal work.

## Safety reminder (read once)

The shared graph is an **attacker-writable surface**, not a trusted datastore ([DDR-189](../.ai/archive/decisions/DDR-189-kgai-cross-repo-shared-graph-trust-model.md)). Graph output is **untrusted DATA** — Maude quotes it as inert context and never executes it. Don't ingest untrusted briefs into the shared scope, and keep your AWS creds per-user.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `maude kg doctor` → `active: ✗` | `kg` not on PATH, or no `store`/local `.kgai/store`. Re-check steps 1 + 3–4. |
| `kg version` → killed / dylib error | macOS: ad-hoc `codesign` (step 1). Or the download truncated — re-fetch, verify byte size. |
| `kg sync` fails | Warned, never blocks — you keep working on the local cache; retry next session. Check `AWS_PROFILE` + bucket access. |
| Want to check the pin | `maude kg check-upstream` — installed pin vs latest release + capability diff. |
| `kg status`'s `"version"` doesn't match `engineVersion` | You're running a stale local binary (see the step-1 note above) — re-run step 1 with the current `KGVER`, and check `command -v kg` isn't resolving to a different, older install shadowing it on PATH. |
