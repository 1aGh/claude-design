# DDR-212: Eliminating the agent from the image, and the session from the singleton

**Date:** 2026-08-04
**Status:** accepted
**Tags:** cloud/cell/build/session/runtime-state/assets/e2e/amends-ddr-209
**Supersedes:** —
**Extends:** [DDR-209](DDR-209-one-studio-three-shells-the-cell-serves-the-studio.md), [DDR-123](DDR-123-acp-chat-runs-on-users-claude-cli-subscription.md), [DDR-115](DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md)

## Context

Cloud Phase 27 shipped its centre — a browser tab showing the real studio — and
left five items open, each of which blocked a customer rather than the testing
environment. This records the four decisions that closing them required, and the
two bugs that closing them found.

## 1. Un-routing is not elimination, and `--define` cannot tell the difference

A cell refused the secret-bearing surfaces three times over: pruned from the
route table at boot, denied by the hub's manifest, 404 in production. That is
operational containment. **DDR-123's promise — "claude never runs on our
infrastructure" — is a claim about what is in the image**, and code that is
present is code a future route, a future import or a future mistake can reach.

The obvious mechanism does not work. `--define` plus dead-code elimination was
tried first, against a real artifact: Bun inlines a dynamically-imported module
and keeps the branch, so a minified, defined build still carried the sentinel
string. What works is substitution at build time — `Bun.build({ compile })`
accepts plugins, and a plugin that replaces a module's contents removes the
original from the compiled binary entirely.

**Decision: a `--cloud` build variant, with the stubs GENERATED from each
module's own export list.** A hand-written stub is a second copy of an
interface, and the day it falls behind is the day the cloud build fails to boot
for a reason nobody can see. The inert value is a self-returning proxy rather
than `null` or `() => {}`, because the callers are not alike — one hands a
factory's result to a route table, one calls a function for its side effect, one
reads a property off what another returned — and it is deliberately not
thenable, so an `await` resolves rather than hanging on a `then` that never
calls back.

**System git is NOT eliminated.** [DDR-211](DDR-211-two-git-engines-one-index-and-the-advisory-lock.md)
makes it the engine a cell runs on; its presence is deliberate, it carries no
credential, and it spawns nothing a tenant can name.

**The gate is a PAIR, not an absence.** `scripts/check-cloud-binary.sh` asserts
each sentinel present in a desktop binary and absent from a cloud one.
`api.github.com` was the first candidate and taught the rule: Bun's own runtime
carries `GITHUB_API_DOMAIN`, so it appears in every compiled binary whatever we
do — and a gate that cannot go red is one people learn to ignore.

The gate earned its keep before it was even wired up: stubbing
`github/endpoints.ts` left every GitHub API URL in the image through
`git/endpoints.ts`, which reaches `github/service.ts` for its
open-a-pull-request verb. Grepping the artifact found what trusting the list
would have missed.

## 2. A per-machine singleton needs a session, not a parameter

`_active.json` and `_canvas-state/<slug>.view.json` are per-MACHINE singletons
by design — DDR-115 made them runtime state precisely so they would never be
versioned or shared. A cell breaks that assumption without changing a line of
it: one process serves an owner and a viewer, so a colleague opening a canvas
switched your tab and their pan moved your camera. Silently, and it read as
flakiness rather than as two people sharing one file.

**Decision: an ambient per-request session scope (`AsyncLocalStorage`), not a
threaded parameter.** The alternative was a `session` argument through
`getCanvasMeta` → `readCanvasViewRaw` → `canvasViewPath` and a dozen siblings —
spreading a cloud concern across every signature in `api.ts`, where it would be
forgotten exactly once and reintroduce the bug. The scope is established at the
one place every request passes: **the route table AND the fall-through**, because
Bun matches `routes` first — the same asymmetry that 404'd a canvas-origin route
in Phase 23.

Two properties make it safe to adopt everywhere:

- **Without a session, every path resolves byte for byte as before.** That is
  the desktop, and it is the first thing the tests assert.
- **A key that is not proxy-shaped is REFUSED, not sanitized.** It becomes a
  path segment; a key we had to repair is not one whose intent we should be
  guessing, and falling back to the shared singleton is what a desktop already
  does.

The inspector became one instance per member, resolved through the socket's own
handshake-stamped key — the same reasoning `readOnly` already used, for the
other thing a cell has more than one of.

## 3. The hub mirrors a browser upload, because the studio deliberately cannot

The boot asset sweep rests on "assets arrive with a commit, and a cell wakes on
every migration". A browser upload arrives with neither: it lands on the tree
through `POST /_api/asset`, so the bytes lived only in `/repo` until the next
restart — serving fine from the checkout the whole time, and one teardown from
gone.

**Decision: the trigger belongs to the hub.** The studio has its own S3 mirror
and in a cell it is deliberately unconfigured — `childEnv()` is an allowlist and
the tenant's storage credentials are not on it. Handing them over to close this
gap would undo a boundary that exists for better reasons than this one. The hub
already holds the credentials and already sees the request, so a 2xx
`POST /_api/asset` through the proxy fires an incremental sweep that HEADs one
file rather than 793.

## 4. Parity is a spec that runs twice, not a person who looks once

"One studio, three shells" was checked by opening the site. **Decision: one spec
file, two targets** (`scenarios/shell-parity.e2e.ts`), with everything that
legitimately differs behind a name in `helpers/target.ts` rather than as a
branch inside the assertions — the native shell's `window.__TAURI__` and
sidecar, and the cell's always-cross-origin canvas iframe.

The cloud target runs against a local stand-in when no URL is given: the studio
in workspace mode behind a proxy that injects the two headers a real cell
vouches, driving a real browser as a VIEWER — the role with the most to lose
from a parity regression. **It is not a cell**, and the config says so: no
sign-in, no capability cookie, no segregated canvas origin, no supervised child.
The phase's own retro is why that paragraph exists.

## Consequences

**Two bugs found by doing this, both of a kind this phase had already paid for:**

- **C1 was not actually landed.** `viewerHiddenPanels` had stopped hiding
  Inspector and Layers, but TWO other gates were left behind — the ⌘⇧I shortcut
  refused a viewer, and `renderPanelBody` refused to mount the panels at all. So
  the View menu offered a panel that could never appear, and the acceptance line
  "a viewer can read, comment, download **and inspect**" was false in
  production. Found by writing the parity spec.
- **The C3 role banner never rendered.** Its `useState` initializer ran while
  `cfg.cloud` was still `undefined` — no role yet — and the "already dismissed"
  it decided then stuck forever. Found by opening it in a browser. No test in
  this repo would have said a word, which is the same sentence this phase wrote
  once already about `cfg is not defined`.

**And one caught by the linter rather than a test:** `let assetSweeper` declared
in `createHub()` and assigned in `runAsMain()` is not a closure write in an ES
module — it is a `ReferenceError` on every cell boot with storage configured.

**What is still not true:** desktop E2E has no CI job at all, so the parity spec
is a local lane like every other scenario — the acceptance line that wanted "CI
fails on a cloud/desktop testid divergence" is two-thirds met and says so.
Verifying a desktop attached to a real cloud project as a viewer remains
owner-gated.

## Correction, same day: the sibling was not covered by the matchers it claimed

Section 2 above says a `_active.<session>.json` SIBLING was chosen over a
subdirectory because "the gitignore, the runtime-state taxonomy (DDR-115) and
`isMaudeRuntimeState` all match by name, and a sibling with the same stem keeps
every one of those matchers correct without a fourth list to update."

**That was wrong, and it was checked only in prose.** All three match
`_active.json` by NAME — `.gitignore` has the literal path, the CLI's ignore
block has the literal path, and the studio's regex requires `\.json$` to follow
`active` immediately. None of them matched the sibling.

The consequence was not cosmetic. Every member's `_active.<key>.json` showed as
untracked to EVERYONE in the Changes panel, a "Save all" staged them, and a push
published one person's open tabs, active canvas, selection and comment context
into the tenant's remote — keyed by a hash of their email. All three matchers
now accept an optional `.<session>` segment, and a test asserts all three
together, because the failure was precisely that they disagreed while a comment
said they did not.

**A second gate had been left behind too.** The route manifest moved
`/_api/git/{checkout,pull}` to `edit`, but the studio's own
`READ_ONLY_ALLOWED_WRITES` still exempted them with the reasoning the manifest
had just refuted. That is not merely redundant defence: the hub-linked desktop
and self-host path consult this gate and never see the manifest at all, so a
viewer there could still rewrite the shared working tree. Removed.
