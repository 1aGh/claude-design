<!--
SPECIMEN: empty-state
DEMONSTRATES: --bg-1, --fg-0..2, --accent, --accent-fg, --radius-md, --space-4/5
COMPOSITION: generic empty state — icon, title, supporting sentence, primary action
COPY VOICE: title is the situation ("No matches yet"), supporting sentence is what to do next ("Log your first match"), action verb on the CTA ("Log a match", never "Get Started")
WHEN SCAFFOLDED: universal (default-on)
NOTES: Replace {{empty_subject}} with the actual project subject during scaffold. Empty states should feel earned, not generic — name the actual thing that's missing.
-->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Empty state — {{project_label}}</title>
  <link rel="stylesheet" href="../core/colors_and_type.css" />
  <link rel="stylesheet" href="../core/preview/_layout.css" />
</head>
<body class="app" data-theme="{{theme_default}}">
  <main class="specimen">
    <h1>Empty state</h1>
    <p class="lede">Empty states are an opportunity. Don't waste them on "Nothing here yet" — name the thing that's missing, then offer the next step.</p>

    <div style="background: var(--bg-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 48px; text-align: center; max-width: 480px;">
      <div style="font-size: 48px; line-height: 1; color: var(--fg-2); margin-bottom: 16px;" aria-hidden="true">∅</div>
      <p style="margin: 0 0 4px; font-family: var(--font-display); font-size: var(--type-lg); font-weight: 600; color: var(--fg-0);">No {{empty_subject}} yet</p>
      <p style="margin: 0 0 24px; color: var(--fg-1); font-size: var(--type-sm); max-width: 36ch; margin-left: auto; margin-right: auto;">{{empty_supporting}}</p>
      <button style="background: var(--accent); color: var(--accent-fg); border: 0; padding: 8px 16px; border-radius: var(--radius-md); font: inherit; cursor: pointer;">{{empty_cta}}</button>
    </div>

    <footer class="legend">
      <p>Empty-state copy survives years. Spend the time to write a real sentence: "Log your first match" beats "Get started" every time.</p>
    </footer>
  </main>
</body>
</html>
