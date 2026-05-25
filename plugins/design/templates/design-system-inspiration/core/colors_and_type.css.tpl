/*
 * {{project_label}} — design tokens
 *
 * Authoritative token file. Every canvas in <designRoot>/ui/ links to this.
 * Production code should consume the same values (compiled to TS/JS or kept as CSS vars).
 *
 * This file is the single source of truth for the project's visual language.
 * Every concrete value below is supplied by the discovery payload — there are
 * NO universal defaults baked into this template. Spacing, type, easing,
 * shadows, max-width, accent strategy, and color space are all project-flavored.
 *
 * Two invariants this template does enforce:
 *   1. `prefers-reduced-motion: reduce` collapses every duration to 1ms (a11y).
 *   2. Tokens used by canvases live under one of the documented family prefixes
 *      (--bg-*, --fg-*, --accent*, --border-*, --status-*, --space-*, --type-*,
 *      --lh-*, --radius-*, --shadow-*, --dur-*, --ease-*, --layout-*, --font-*).
 *
 * Everything else — palette structure, type ladder, motion personality — is
 * a project decision recorded during /design:setup-ds.
 */

:root,
.{{root_class}}[data-theme="{{theme_default}}"] {
  /* ─── Surfaces (deepest → highest) ─────────────────────────────────── */
  --bg-0: {{bg_0}};   /* page bg                    */
  --bg-1: {{bg_1}};   /* card / panel bg            */
  --bg-2: {{bg_2}};   /* nested panel / popover     */
  --bg-3: {{bg_3}};   /* input bg / subtle row hover */
  --bg-4: {{bg_4}};   /* hover / pressed state      */

  /* ─── Borders ──────────────────────────────────────────────────────── */
  --border-subtle:  {{border_subtle}};
  --border-default: {{border_default}};
  --border-strong:  {{border_strong}};

  /* ─── Text ─────────────────────────────────────────────────────────── */
  --fg-0: {{fg_0}};   /* primary text                */
  --fg-1: {{fg_1}};   /* secondary text              */
  --fg-2: {{fg_2}};   /* tertiary / muted            */
  --fg-3: {{fg_3}};   /* disabled                    */

  /* ─── Accent ({{accent_strategy_summary}}) ─────────────────────────── */
{{accent_block}}

  /* ─── Status (only if "status" ∈ activeFamilies) ───────────────────── */
  --status-success: {{status_success}};
  --status-warn:    {{status_warn}};
  --status-error:   {{status_error}};
  --status-info:    {{status_info}};

  /* ─── Presence (only if "presence" ∈ activeFamilies) ───────────────── */
  --presence-online:  {{presence_online}};
  --presence-away:    {{presence_away}};
  --presence-offline: {{presence_offline}};

  /* ─── Shadows / elevation ──────────────────────────────────────────── */
  --shadow-sm: {{shadow_sm}};
  --shadow-md: {{shadow_md}};
  --shadow-lg: {{shadow_lg}};

  /* ─── Radii ────────────────────────────────────────────────────────── */
  --radius-xs: {{radius_xs}};
  --radius-sm: {{radius_sm}};
  --radius-md: {{radius_md}};
  --radius-lg: {{radius_lg}};
  --radius-xl: {{radius_xl}};
  --radius-pill: {{radius_pill}};

  /* ─── Spacing ──────────────────────────────────────────────────────── */
  --space-0: {{space_0}};
  --space-1: {{space_1}};
  --space-2: {{space_2}};
  --space-3: {{space_3}};
  --space-4: {{space_4}};
  --space-5: {{space_5}};
  --space-6: {{space_6}};
  --space-7: {{space_7}};
  --space-8: {{space_8}};

  /* ─── Typography ───────────────────────────────────────────────────── */
  --font-display: {{font_display}};
  --font-body:    {{font_body}};
  --font-mono:    {{font_mono}};

  /* Type scale */
  --type-xs:   {{type_xs}};    --lh-xs:   {{lh_xs}};
  --type-sm:   {{type_sm}};    --lh-sm:   {{lh_sm}};
  --type-base: {{type_base}};  --lh-base: {{lh_base}};
  --type-md:   {{type_md}};    --lh-md:   {{lh_md}};
  --type-lg:   {{type_lg}};    --lh-lg:   {{lh_lg}};
  --type-xl:   {{type_xl}};    --lh-xl:   {{lh_xl}};
  --type-2xl:  {{type_2xl}};   --lh-2xl:  {{lh_2xl}};
  --type-3xl:  {{type_3xl}};   --lh-3xl:  {{lh_3xl}};

  /* ─── Motion ───────────────────────────────────────────────────────── */
  --dur-flip:  {{dur_flip}};
  --dur-panel: {{dur_panel}};
  --dur-route: {{dur_route}};
  --dur-soft:  {{dur_soft}};
  --ease-out:    {{ease_out_curve}};
  --ease-in-out: {{ease_in_out_curve}};

  /* ─── Layout ───────────────────────────────────────────────────────── */
  --layout-max-w:  {{layout_max_w}};
  --layout-gutter: {{layout_gutter}};
}

@media (prefers-reduced-motion: reduce) {
  :root, .{{root_class}}[data-theme="{{theme_default}}"] {
    --dur-flip:  1ms;
    --dur-panel: 1ms;
    --dur-route: 1ms;
    --dur-soft:  1ms;
  }
}
