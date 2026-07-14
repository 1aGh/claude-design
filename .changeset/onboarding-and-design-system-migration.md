---
"@1agh/maude": minor
---

Onboarding and design-system migration: get to your first AI edit and your first real design system faster, whether you're starting fresh or bringing in an existing brand.

- **Zero-terminal AI editing setup.** The native app's Assistant panel can now install `claude` for you, sign you into your own Claude subscription via a browser, and reconnect automatically — no terminal, no restart. The `maude` CLI and the design/flow plugins are bundled with the app, so `/design:*` commands work out of the box.
- **Guided quick setup.** A new "Quick setup" tour and checklist walk a new project from empty → design system → first AI edit, with a persistent "Bring my existing brand" entry point.
- **Bring your existing brand in.** Upload a logo (SVG) from the Quick setup checklist and Maude pulls out its color palette and recognizable font names to seed a new design system — nothing is applied automatically, every choice is confirmed during setup.
- **Import design tokens.** `maude design import-tokens` reads a `tokens.json` (W3C design-tokens / Style-Dictionary) or a raw CSS custom-properties file and patches or scaffolds a design system's tokens from it.
- **Reconstruct a canvas from an image (experimental).** `/design:import --reconstruct <image>` turns a Figma-frame export into a real, editable, token-styled canvas via an AI vision pass plus a reality-check loop against the source. Labeled experimental — review it like a first draft, not a finished import.
- Every new project is seeded with two "how to use Maude" reference canvases covering the app's own capabilities, so there's something real to look at from the very first launch.
