---
name: validate/visual
type: command
description: Visual regression check with screenshots
keywords: [visual, screenshot, regression, ui, compare, snapshot]
---

# Visual Validation

Capture screenshots and compare against expected appearance.

## Scope

Visually verify recently changed UI components or pages.

## Process

### 1. Identify Visual Targets

List all pages, components, or states that were visually changed.

### 2. Start Dev Server

Start the development server for the app being validated. Wait for it to be ready.

### 3. Capture Screenshots

For each visual target:

- Navigate to the page/component
- Capture screenshot at standard viewports:
  - Mobile: 375×812
  - Tablet: 768×1024
  - Desktop: 1440×900
- Save to `/tmp/ai-workflow-visual/` (NOT project root)

### 4. Visual Review

For each screenshot, verify:

- [ ] Layout renders correctly at all viewports
- [ ] Text is readable and properly sized
- [ ] Colors match design tokens
- [ ] Spacing is consistent
- [ ] Interactive states visible (hover, focus, active)
- [ ] No visual artifacts or overflow
- [ ] Icons render correctly
- [ ] Animations/transitions smooth (if applicable)

### 5. Dark Mode Check (if applicable)

If the project supports dark mode:

- Toggle to dark mode
- Re-capture key screenshots
- Verify contrast and readability

## Output

Save to `.ai/logs/visual/<date>-visual.md`:

```markdown
# Visual Validation — <date>

## Pages/Components Checked

- [page/component] — [status: pass/fail]

## Viewport Results

| Target | Mobile | Tablet | Desktop |
| ------ | ------ | ------ | ------- |
| [name] | ✅/❌  | ✅/❌  | ✅/❌   |

## Issues Found

- [description with screenshot reference]

## Verdict

PASS / NEEDS FIXES
```

## Post-Validation

If issues found:

> **Found X visual issues. Should I fix them?**
