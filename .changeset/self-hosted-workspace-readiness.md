---
'@1agh/maude': minor
---

Self-hosting grows up: a workspace you can operate, with your own identity provider.

A self-hosted hub is the whole product for anyone not on Maude Cloud, and it
gained the parts that were missing between "the container is up" and "a team
uses this." People are managed in the admin console now — accounts, roles,
invite-by-link (the hub still sends no mail; it hands you the link) — over APIs
that already existed but had no UI. And a hub can accept sign-in from your own
identity provider: one OIDC adapter covers Auth0, Google, or anything else that
speaks it, verified with `jose`, with the rule that authenticating grants
nothing until an admin links the identity to an account.

Underneath, a live data-loss bug is closed: two hubs sharing one object-storage
bucket used to prune each other's backup history away on a healthy day. A
generation now names its owner, a hub refuses to write into a keyspace it does
not own and shows that state in the console, and losing a `/repo` volume makes
the hub stop and ask rather than quietly re-seed over the loss. `maude hub
workspace-up` is walked by a new `/design:hub-workspace` interview, and the
docs cover AWS, durability, people and identity — with a test that fails the
build if a doc names an environment variable no code reads.
