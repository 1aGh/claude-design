# Remotion license notice (ships alongside the pre-bundled Remotion runtime)

Maude's **video-comp** canvas kind bundles the Remotion runtime
(`remotion`, `@remotion/player`, `@remotion/transitions`) into the pre-built
`/_canvas-runtime/*.js` bundles in this directory. See
[DDR-148](../../../.ai/decisions/DDR-148-video-comp-remotion-authoring-capture-export.md).

**Remotion is source-available software — it is NOT MIT-licensed.** It is
free for individuals and for companies of up to 3 people (unlimited commercial
use). For-profit organizations of **4 or more people** need their own Remotion
Company License. That obligation attaches to **you** — the party that owns or
controls the Remotion code (the compositions live in *your* project), not to
Maude.

- License: <https://www.remotion.dev/docs/license>
- Company licensing / terms: <https://www.remotion.pro/license> ·
  <https://www.remotion.pro/terms>
- FAQ (AI-generation carve-out, "what is an automation"):
  <https://www.remotion.pro/faq>

Remotion explicitly permits AI-generated Remotion code and lets end-users edit
code a service initially generated — which is exactly how Maude authors
video-comps. Maude never ships `@remotion/renderer` or `@remotion/web-renderer`;
export runs through Maude's own capture spine (no renderer binaries, no
telemetry, no license key). See DDR-148 for the full posture.

© Remotion. This notice is a good-faith attribution + disclosure. The
authoritative license text lives at the URLs above.
