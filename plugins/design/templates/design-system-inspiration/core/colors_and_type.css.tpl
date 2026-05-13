/*
 * {{project_label}} — design tokens
 *
 * Authoritative token file. Every canvas in <designRoot>/ui/ links to this.
 * Production code should consume the same values (compiled to TS/JS or kept as CSS vars).
 *
 * Contract:
 * - OKLCH for accent + status colors (better gamut control than HSL/hex)
 * - One accent family only (no --accent2)
 * - Theme: {{theme_default}} (single-block) — duplicate for both-equal projects
 * - Motion durations + easings + reduced-motion guard
 * - 8-step type ladder, 4px-base spacing scale
 */

:root,
.{{root_class}}[data-theme="{{theme_default}}"] {
  /* ─── Surfaces (deepest → highest) ─────────────────────────────────── */
  --bg-0: {{bg_0_oklch}};   /* page bg                    */
  --bg-1: {{bg_1_oklch}};   /* card / panel bg            */
  --bg-2: {{bg_2_oklch}};   /* nested panel / popover     */
  --bg-3: {{bg_3_oklch}};   /* input bg / subtle row hover */
  --bg-4: {{bg_4_oklch}};   /* hover / pressed state      */

  /* ─── Borders ──────────────────────────────────────────────────────── */
  --border-subtle:  oklch(from var(--bg-1) calc(l + 0.04) c h);
  --border-default: oklch(from var(--bg-1) calc(l + 0.08) c h);
  --border-strong:  oklch(from var(--bg-1) calc(l + 0.14) c h);

  /* ─── Text ─────────────────────────────────────────────────────────── */
  --fg-0: {{fg_0_oklch}};   /* primary text                */
  --fg-1: {{fg_1_oklch}};   /* secondary text              */
  --fg-2: {{fg_2_oklch}};   /* tertiary / muted            */
  --fg-3: {{fg_3_oklch}};   /* disabled                    */

  /* ─── Accent (ONE family only) ─────────────────────────────────────── */
  --accent:        {{accent_oklch}};
  --accent-hover:  oklch(from var(--accent) calc(l - 0.04) c h);
  --accent-active: oklch(from var(--accent) calc(l - 0.08) c h);
  --accent-fg:     {{accent_fg_oklch}};

  /* ─── Status (only if "status" ∈ activeFamilies) ───────────────────── */
  --status-success: oklch(70% 0.18 145);
  --status-warn:    oklch(78% 0.16  85);
  --status-error:   oklch(64% 0.21  25);
  --status-info:    oklch(70% 0.13 230);

  /* ─── Presence (only if "presence" ∈ activeFamilies) ───────────────── */
  --presence-online:  var(--status-success);
  --presence-away:    var(--status-warn);
  --presence-offline: var(--fg-3);

  /* ─── Shadows / elevation ──────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.20);
  --shadow-md: 0 4px 12px oklch(0 0 0 / 0.25);
  --shadow-lg: 0 12px 32px oklch(0 0 0 / 0.30);

  /* ─── Radii ────────────────────────────────────────────────────────── */
  --radius-xs: {{radius_xs}};
  --radius-sm: {{radius_sm}};
  --radius-md: {{radius_md}};
  --radius-lg: {{radius_lg}};
  --radius-xl: {{radius_xl}};
  --radius-pill: 999px;

  /* ─── Spacing (4px base) ───────────────────────────────────────────── */
  --space-0:  0;
  --space-1:  4px;
  --space-2:  8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  /* ─── Typography ───────────────────────────────────────────────────── */
  --font-display: {{font_display}};
  --font-body:    {{font_body}};
  --font-mono:    {{font_mono}};

  /* 8-step type scale */
  --type-xs:   12px;  --lh-xs:   16px;
  --type-sm:   13px;  --lh-sm:   18px;
  --type-base: 14px;  --lh-base: 20px;
  --type-md:   16px;  --lh-md:   22px;
  --type-lg:   18px;  --lh-lg:   26px;
  --type-xl:   22px;  --lh-xl:   30px;
  --type-2xl:  28px;  --lh-2xl:  36px;
  --type-3xl:  36px;  --lh-3xl:  44px;

  /* ─── Motion ───────────────────────────────────────────────────────── */
  --dur-flip:  {{dur_flip}};
  --dur-panel: {{dur_panel}};
  --dur-route: {{dur_route}};
  --dur-soft:  {{dur_soft}};
  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* ─── Layout ───────────────────────────────────────────────────────── */
  --layout-max-w: 1200px;
  --layout-gutter: var(--space-4);
}

@media (prefers-reduced-motion: reduce) {
  :root, .{{root_class}}[data-theme="{{theme_default}}"] {
    --dur-flip:  1ms;
    --dur-panel: 1ms;
    --dur-route: 1ms;
    --dur-soft:  1ms;
  }
}
