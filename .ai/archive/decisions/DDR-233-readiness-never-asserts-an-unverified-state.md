# DDR-233: A detect-and-guide row never asserts a state it could not verify, and never offers an action whose success signal is the probe that just failed

**Status:** Implemented — closes [#107](https://github.com/1aGh/maude/issues/107). Landed with three security-review rounds (defender + attacker, `.ai/logs/security-reviews/issue-107-auth-status-parse-{defender,attacker}.md`); round 1 was **NEEDS FIXES** from both seats.
**Extends:** [DDR-166](DDR-166-zero-terminal-acp-cold-start.md) — its "honest 3-state instead of presence-only" (not installed / installed-but-signed-out / signed-in) gains a fourth state, and its Decision 3 `resolvedPath` disclosure is repaired where this change had silently suppressed it.
**Relates:** [DDR-128](DDR-128-first-open-readiness-check-detect-and-guide.md) (the detect-and-guide posture this generalises), [DDR-123](DDR-123-acp-chat-runs-on-users-claude-cli-subscription.md) (the metered-billing disclosure that a forged `apiProvider` could suppress).
**Instruments:** `apps/studio/acp/probe.ts`, `apps/studio/readiness.ts`, `apps/studio/client/panels/ReadinessList.jsx`.

## Context

DDR-166 gave the `claude` readiness row three states and drove them from one probe: `getClaudeAuthStatus()`, which shells `claude auth status --json` and parses stdout. That probe returns `null` for four distinct conditions — no binary, spawn failure, timeout, unparseable output — and every caller collapsed `null` into `signedIn = false`.

Issue #107 is what that costs. A user's `~/.local/bin/claude` was a mise wrapper ending in `mise x claude -- claude "$@"`, which re-resolves `claude` **by name**. Inside a mise-activated shell that name hits the real binary; inside Maude Desktop's sidecar env (no mise shell integration) it resolves back to the wrapper — infinite recursion. Measured: **∞ invocations under the app's environment, 1 under the user's zsh.** The probe never returned, Maude's 5 s kill left empty stdout, and a signed-in Max user was told *"Installed, but not signed in."* — then handed a Sign-in button whose poll re-ran the same failing probe every 2 s until it printed *"Sign-in timed out."* The browser never opened, because `claude auth login` was recursing too.

The wrapper is not Maude's bug. Turning "I couldn't tell" into a confident accusation, and then routing the user to an action that could not possibly succeed, is.

## Decision

**1. `null` from a probe is "couldn't read", never "the negative answer".** When the CLI resolves but the auth probe yields nothing, the row is `status: 'unknown'` with copy that says so. `ready` is unaffected (it requires `present`), and the `unknown` glyph already existed.

**2. An action is withheld when its success signal is the probe that just failed.** `pollForSignin` polls this same probe, so a Sign-in button offered in the `unknown` state can only ever time out. The remediation text — which names the **actual resolved path** — is the actionable path in that state.

**3. The probe always resolves.** `await new Response(proc.stdout).text()` waits for pipe **EOF**, and `proc.kill()` signals only the direct child; a wrapper that leaves a descendant holding fd 1 — #107's exact shape — wedged the read forever, so `probeReadiness()` never resolved and `GET /_api/preflight` hung. `readBounded()` races each read against a deadline and bounds bytes during accumulation. The honest-unknown path must not be unreachable in its own headline scenario.

**4. The parser fails CLOSED, and scans from the answer end.** A `claude` on PATH is routinely fronted by a wrapper that writes to stdout, so the JSON **object** is extracted from the blob rather than the blob parsed whole. The scan runs **backwards** from the end, truncation keeps the **tail**, and a byte overflow evicts the **oldest** bytes — all three follow the one real invariant: *a wrapper's banner is written before it execs, so the payload is last.* Every giving-up path returns `null`. There is no "best object seen so far".

**5. Values that reach a status row are narrowed for display.** `loggedIn` is `=== true`, never truthy-coerced. `apiProvider`/`subscriptionType` pass `/^[A-Za-z0-9_-]{1,32}$/` or become the literal `unrecognized` — deliberately **not** `undefined`, which would read as "no provider" and silently suppress DDR-123's metered-billing warning.

## Alternatives rejected

- **Fix only the stdout-noise parse.** The first cut of this change did exactly that, and it did not unblock the reporter — the wrapper was recursing, not merely noisy. Kept as part of the fix; rejected as the whole of it.
- **Keep the forwards scan with a candidate budget.** Attacker F1: a 242-byte prefix (one forged object plus 99 bare `{}`) burned the budget and pushed the genuine payload out of range, turning a fail-**closed** `JSON.parse` throw into fail-**open**. Defender M1: the same cap demoted a genuinely signed-in user behind ≥100 NDJSON log lines. A budget spent on noise before the answer is the wrong end.
- **Fall back to "the last object that parsed at all".** Attacker F2: a plain NDJSON-logging wrapper's `{"level":"info",…}` became `loggedIn: !!undefined` → a confident false "signed out" with the dead-end button armed. An object with no `loggedIn` is not a status document.
- **Hard-bail at the byte cap.** Defender L6: it discarded a payload already in the buffer, so a signed-in user whose wrapper backgrounds *anything* still lost AI editing. Honest, but the answer was sitting there. Sliding tail window instead.
- **Coach `MAUDE_CLAUDE_BIN` in the remediation.** Attacker F4: Maude would be teaching and clipboard-loading an un-content-pinned PATH override to users already in a confusing state — borrowable by a phishing page as an officially-blessed incantation. The copy names the resolved path and ends at "Re-check".
- **Kill the process group instead of the child.** Correct in principle; not implemented, because process-group semantics need verification against the packaged sidecar rather than the dev tree. The bounded read means an orphan can no longer wedge the probe, which is what actually mattered.

## Consequences

- A fourth readiness state exists. Anything that renders a `ReadinessItem` must handle `unknown` — the glyph and `ready` computation already did.
- A wrapper emitting >1 MiB before its payload now has its head evicted rather than being read whole. Bounded memory; the payload still wins.
- `getClaudeAuthStatus()` no longer distinguishes "empty output" from "deadline with zero bytes" — both are `null` → `unknown`, which is the same user-visible answer.
- **Residual:** `proc.kill()` still orphans a recursive wrapper's descendants (7+ stray processes observed during the investigation). Bounded in blast radius, not eliminated.
- **Residual:** `pollForSignin` has no single-flight guard, so a slow CLI still compounds probe spawns while the panel is disconnected.
- The lesson generalises past this row: **a status surface that fails soft manufactures false facts.** Every one of the four review findings against the first cut was the same shape — a giving-up path that returned a guess instead of an admission.
