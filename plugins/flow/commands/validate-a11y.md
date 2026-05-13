---
name: validate-a11y
category: validate
type: command
description: Run accessibility audit on project components
keywords: [accessibility, a11y, wcag, aria, audit, screen-reader]
---

# Accessibility Validation

Run a targeted WCAG 2.1 AA accessibility audit.

## Package Manager Auto-Detection

> This command uses `<pm>` as a placeholder for your package manager. Detect it:
>
> - `pnpm-lock.yaml` → `pnpm`
> - `yarn.lock` → `yarn`
> - `package-lock.json` → `npm run`

## Scope

Audit accessibility of recently changed or specified components.

## Automated Checks

### 1. ESLint jsx-a11y (if available)

```bash
<pm> lint
```

Look for `jsx-a11y/*` rule violations in the output.

### 2. Review Changed Components

For each recently changed UI component:

#### HTML Semantics

- [ ] Correct heading hierarchy (h1 → h2 → h3, no skips)
- [ ] Semantic HTML elements (`<nav>`, `<main>`, `<article>`, `<section>`)
- [ ] Lists (`<ul>`, `<ol>`) for list content
- [ ] `<button>` for actions, `<a>` for navigation

#### ARIA

- [ ] `aria-label` or `aria-labelledby` on interactive elements without visible text
- [ ] `aria-expanded` on toggleable controls
- [ ] `aria-describedby` for supplementary descriptions
- [ ] `role` only when native semantics insufficient
- [ ] No redundant ARIA (e.g., `role="button"` on `<button>`)

#### Keyboard

- [ ] All interactive elements focusable
- [ ] Logical tab order
- [ ] Focus visible on all interactive elements
- [ ] Escape key closes modals/popovers
- [ ] No keyboard traps

#### Color & Contrast

- [ ] Text contrast ≥ 4.5:1 (normal) or 3:1 (large)
- [ ] Information not conveyed by color alone
- [ ] Focus indicators visible

#### Images & Media

- [ ] `alt` text on meaningful images
- [ ] `alt=""` on decorative images
- [ ] `aria-hidden="true"` on decorative icons

#### Forms

- [ ] Labels associated with inputs
- [ ] Error messages descriptive and associated
- [ ] Required fields marked

## Output

Save to `.ai/logs/a11y/<date>-audit.md`:

```markdown
# Accessibility Audit — <date>

## Components Reviewed

- [component path] — [status]

## Findings

### 🔴 CRITICAL (blocks ship)

- [finding]

### 🟡 IMPORTANT (fix soon)

- [finding]

### 🟢 SUGGESTION

- [finding]

## Summary

- Components audited: X
- Critical issues: X
- Important issues: X
- Suggestions: X
```

## Post-Audit

If issues found, ask:

> **Found X accessibility issues. Should I fix them?**
