---
name: flow:video-new-scene
category: setup
type: command
description: "Scaffold a new Remotion scene under scripts/video/final/src/scenes/ — composition + storyboard row + Root.tsx registration"
keywords: [video, remotion, scene, scaffold, marketing, demo]
argument-hint: "<scene-id> <duration-seconds> \"<caption>\""
---

# Scaffold a new video scene

Generate a Remotion scene under `scripts/video/final/src/scenes/<scene-id>/`,
register the `<Composition>` in `Root.tsx`, and append a row to
`scripts/video/storyboard.md` (creating it if missing).

## Arguments

```
/flow:video-new-scene <scene-id> <duration-seconds> "<caption>" [--force]
```

| Arg | Required | Shape | Example |
| --- | -------- | ----- | ------- |
| `<scene-id>` | yes | `<NN>-<kebab-slug>` | `03-setup-ds-flow` |
| `<duration-seconds>` | yes | number, `0.5` step | `6.0` |
| `<caption>` | yes | ASCII, no em/en dash, no curly quotes | `"Vision -> research -> refinement"` |
| `--force` | no | flag; overwrite an existing scene | — |

Idempotent: refuses to overwrite an existing `<scene-id>` directory unless
`--force` is passed.

## Output files

1. **`scripts/video/final/src/scenes/<scene-id>/index.tsx`** — Scene component
   from the template at the bottom of this command. Exports
   `<SceneName>Scene` where `SceneName` is the PascalCase form of the
   kebab slug (e.g. `03-setup-ds-flow` -> `SetupDsFlowScene`).
2. **`scripts/video/final/src/Root.tsx`** — Append a `<Composition>` element
   in numeric-prefix order between the existing siblings.
3. **`scripts/video/storyboard.md`** — Append a row to the Cut A table.
   If the file does not exist, create it with a minimal frontmatter + the
   table header + the new row.

## Pre-flight

- Confirm `scripts/video/final/` exists. If not, abort with hint:
  *"Run phase 15.1 first — scripts/video/final/ workspace not scaffolded."*
- Confirm `<scene-id>` matches the `^\d{2}-[a-z0-9-]+$` pattern.
- Confirm `<duration-seconds>` is a positive number.
- Confirm `<caption>` contains no banned characters: `—` `–` `'` `'` `"` `"` `…`.
  If any are present, fail with the offending character + position.

## Procedure

1. **Parse args.** Read `<scene-id>`, `<duration-seconds>`, `<caption>`, `--force`.
2. **Idempotency check.** If `scripts/video/final/src/scenes/<scene-id>/`
   exists and `--force` is not passed, abort with the existing path and the
   `--force` hint.
3. **Compute identifiers.**
   - `componentName` = PascalCase of the slug part after the numeric prefix,
     suffixed with `Scene`. E.g. `setup-ds-flow` -> `SetupDsFlowScene`.
   - `durationInFrames` = `Math.round(<duration-seconds> * 30)` (30 fps fixed).
4. **Write the scene file** from the template below, substituting:
   - `__COMPONENT_NAME__` with `componentName`
   - `__CAPTION__` with the caption (already ASCII-validated)
   - `__SCENE_ID__` with `<scene-id>`
5. **Patch Root.tsx.** Read `scripts/video/final/src/Root.tsx`.
   - Add the import: `import { <componentName> } from './scenes/<scene-id>';`
     in alphabetical order with existing scene imports.
   - Add the `<Composition>` element in numeric-prefix order. If no existing
     scene shares the same numeric prefix, insert immediately before the
     next-higher prefix.
6. **Patch storyboard.md.** If the file does not exist, create:
   ```md
   # Marketing demo storyboard

   ## Cut A — primary

   | # | Scene | Slot | Source | Caption |
   |---|-------|------|--------|---------|
   ```
   Then append: `| <scene-id> | <componentName> | <duration>s | <scene-id>/index.tsx | <caption> |`.
7. **Print next-step hint:**
   ```
   Created scene <scene-id> (<componentName>).
   Preview: cd scripts/video/final && pnpm run studio   (then open scene-<scene-id>)
   Render:  cd scripts/video/final && pnpm run render scene-<scene-id> out/<scene-id>.mp4 --mute
   ```

## Scene template

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { tokens } from '../../lib/tokens';

/**
 * Scene __SCENE_ID__.
 * Caption: __CAPTION__
 *
 * Replace this stub with the real scene content. The default layout is a
 * dark background + centered mono text — match the storyboard intent.
 */
export const __COMPONENT_NAME__ = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.dark.bg0,
        color: tokens.dark.ink,
        fontFamily: tokens.font.mono,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
      }}
    >
      <div style={{ fontSize: 48, letterSpacing: '0.01em' }}>
        __CAPTION__
      </div>
    </AbsoluteFill>
  );
};
```

## Notes

- The 30 fps assumption is hardcoded here because the whole pipeline runs at
  30 fps (matches `remotion.config.ts`). If a future scene needs 60 fps,
  override at the `<Composition>` level rather than via this scaffolder.
- The scaffolded scene uses dark theme tokens by default. Switch to
  `tokens.light` if the storyboard slot expects a light-mode beat.
- The scaffolder does NOT touch `compositions/Final.tsx` or `Final30.tsx` —
  those are wired by the final-assembly step of phase 15.5 (and live as
  separate manual edits to lock the scene order).
