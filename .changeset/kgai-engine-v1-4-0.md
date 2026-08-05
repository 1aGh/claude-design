---
'@1agh/maude': patch
---

**The bundled knowledge-graph engine (kgai) is upgraded to v1.4.0**, from v1.0.0. If you've turned on the knowledge-graph memory backend (`knowledgeGraph.mode`), you pick up several fixes on top of four months of engine work: `kg context --paths` now matches nested files correctly, `kg as-of <date>` means the end of that day instead of silently excluding anything recorded today, and a bug that could mint a false conflict when re-touching an existing decision element is gone.

Session-start sync now uses the engine's own fire-and-forget `--auto` mode — it honors a cooldown and never blocks on a store lock, so it can no longer pile up across rapid session restarts. Closing a session (`/flow:done`, `/flow:pause`) still pushes with a deliberate, uncooled sync.

If you installed the `kg` CLI by hand for the shared company graph, the old install had no self-update — `kg status` now shows the exact version so you can confirm which engine you're actually running before assuming a pin bump reached you.
