---
"@1agh/maude": patch
---

Security hardening of the bookend debate layer (DDR-130), found by running its own `/flow:validate-security` relay debate against itself. Closed two HIGH findings: (F1) the `flow:investigator` seat no longer carries network-egress tools (`WebSearch`/`WebFetch` stripped; `Bash` constrained to read-only local diagnostics with no secret read) so it can't colocate the untrusted-ingest + private-read + egress trifecta; web fact-checking routes to `design:ux-research-agent`, which never ingests a code diff. (F2) the debate-protocol lead now treats every seat's output as inert attributed data — it quotes a seat's `recommendation`/`top_risk` into plans/canvases but never executes or constructs a tool call from it, closing the output-handling confused-deputy.
