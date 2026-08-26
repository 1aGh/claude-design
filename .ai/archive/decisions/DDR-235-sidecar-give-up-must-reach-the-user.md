# DDR-235: A restart budget counts a crash LOOP, and giving up is something the user is told

**Status:** Implemented. Found by symbolizing two `maude-server` cores on one machine in one afternoon (2026-08-26, 14:30:20 and 18:01:01).
**Relates:** [DDR-106](DDR-106-tauri-v2-native-shell-architecture.md) (the sidecar lifecycle this supervises), [DDR-128](DDR-128-first-open-readiness-check-detect-and-guide.md) + [DDR-234](DDR-234-linux-media-stack-crash-avoidance.md) (same principle from two other directions: never let the window go quiet with no reason).
**Instruments:** `apps/desktop/src-tauri/src/sidecar.rs`.

## Context

`maude-server` died twice with `SIGILL` / `ILL_ILLOPN` on one machine, hours apart, with **byte-identical** stacks. Symbolizing the second core placed the fault exactly:

```
mov  0x28(%rdi),%r8     ; divisor ← a struct field
or   %r8,%rdx
shr  $0x20,%rdx
je   …                  ; 32-bit fast path
xor  %edx,%edx
div  %r8                ; ← #DE when that field is 0
mov  %rdx,%rax          ; take the REMAINDER → modulo
sub  %rax,%rdx          ; rcx − (x % r8) → round to a multiple
```

An unsigned 64-bit divide on a zero stride in an alignment computation: `#DE` → `SIGFPE` → Bun's crash handler → `ud2` → `SIGILL`. Every frame is native `maude-server` code, so this is the **Bun runtime**, not our TypeScript (which runs in JSC and cannot emit a raw `div`). The shipped binary is Bun v1.3.3 (`274e01c7`); `.bun-version` pins 1.3.3 and the 1.3 line is at 1.3.14.

That crash is upstream and not ours. What the cores exposed about **our** supervisor is:

1. `MAX_RESTARTS` was documented as "crash-looped 3+ times" but implemented as a lifetime counter — `restarts` incremented on every death and reset **only** when the user deliberately switched away from the project and back. A single-project session (the normal case) that took three unrelated crashes across a day would retire the project permanently, even though every one of them had recovered fine. Two of the three had already happened.
2. Reaching the cap printed to **stderr and nothing else**. An app launched from Finder, the Dock, or `gtk-launch` has no terminal — the same fact `ServerLog` exists to work around a few lines above in the same file. The webview kept showing a page whose server had stopped answering: no error, no reason, and no way back short of quitting.

## Decision

**1. The budget measures a loop, not a lifetime.** `SidecarInstance` records `spawned_at`; a child that stayed up at least `HEALTHY_UPTIME` (60 s) before dying opens a fresh budget instead of spending the old one. Extracted as `next_restart_count(previous, uptime)` so the distinction is unit-testable without a running app — the same split `notify::transition_kind` uses.

**2. It resets to 1, not 0.** The server did just crash. Three more in quick succession from there must still reach the cap.

**3. Giving up is a modal, and the modal can recover.** The user is told which project stopped, that their files on disk are untouched, and is offered **Try again** — `spawn_for` re-inserts the pool entry with a fresh budget, so an isolated runtime crash is a recoverable blip rather than a relaunch. Only the project's own directory name appears in the text, never its content (notify.rs Decision D — the served project is untrusted per DDR-054 and a dialog is a surface the user cannot inspect).

## Alternatives rejected

- **Raise `MAX_RESTARTS`.** Treats the symptom. A lifetime counter with a bigger number still retires a long-lived session eventually, and still says nothing when it does.
- **Reset the counter on every successful spawn.** Then a true crash loop never reaches the cap at all — a server that dies during startup would respawn forever. Uptime is what separates the two, so uptime is what the rule reads.
- **A notification instead of a modal.** Notifications are best-effort, easy to miss, and absent on a machine with no daemon. The app is already non-functional for this project when this fires — there is no work in progress left for a modal to interrupt.
- **Auto-retry forever with backoff.** Hides a real fault and burns the user's battery on a server that cannot start. The cap plus an explicit, user-driven retry keeps the choice where the information is.
- **Bump `.bun-version` 1.3.3 → 1.3.14 as part of this change.** The runtime fault is genuinely upstream and the pin is 11 patch releases stale, so the bump is worth making — but it changes what CI compiles for every platform and every binary, and **the crash could not be reproduced on demand** (75 s standalone against the affected project, including a full 84-canvas cloud sync, stayed up), so nothing here could verify it. It belongs in its own change with its own build verification, not folded into a resilience fix as an unverifiable guess. 1.4.0 is deliberately not the target: it carries a documented breaking-change list.

## Consequences

- `MAX_RESTARTS` now means what its message always claimed. A crash loop still stops after three tries; isolated crashes no longer accumulate toward a silent retirement.
- One more modal exists on a failure path. It fires only after three failed respawns of a real dev-server, which the previous code already treated as "genuinely crash-looped".
- The Bun divide-by-zero is **not fixed** by any of this — it is made survivable and visible. Reproducing it needs the desktop client driving the server; a headless boot does not trigger it.
