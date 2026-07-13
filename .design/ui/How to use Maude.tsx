/**
 * @canvas      How to use Maude · seeded into every new project (scaffold-design.ts) · 10 artboards, one per capability
 * @ds          maude
 * @platform    desktop
 * @opt_out     palette
 * @artboards   start-here | design-system | edit-canvas | ai-assistant | point-comment-draw | generate-images | photo-editing | media-and-templates | save-share-collab | draw-as-code
 * @brief       A "how to use Maude" reference canvas seeded alongside Welcome.tsx on every new project. One artboard per capability cluster (start here, design system, editing, AI assistant, annotation-driven iteration, AI image generation, photo editing, media/templates, git+collab, draw-as-code). Real domain nouns, no Lorem, honest mini-mockups instead of live screenshots (the seeded copy has to work with zero server state).
 * @stack       React 19 · TSX · Bun.build · css_mode=inline (matches Welcome.tsx's seeded-canvas precedent — no sibling CSS to keep in sync across the scaffold template)
 * @history     .design/_history/how-to-use-maude/
 *
 * Genuinely self-contained (no DS import): this canvas is SEEDED into a
 * brand-new project by scaffoldDesign() before any design system exists, so
 * unlike Studio Docs.tsx it can't rely on `system/maude/` being present. The
 * token VALUES below are copied from system/maude/colors_and_type.css's dark
 * theme (kept in sync by eye — this is a fixed onboarding surface, not a
 * living DS specimen) and applied as inline custom properties on `Board`, so
 * every `var(--token)` below still resolves without an external stylesheet.
 */

import { DCArtboard, DCSection, DesignCanvas } from "@maude/canvas-lib";

// Copied from system/maude/colors_and_type.css (dark theme) — see the note above.
const TOKENS: React.CSSProperties = {
  "--bg-0": "oklch(0.165 0.012 255)",
  "--bg-1": "oklch(0.198 0.012 255)",
  "--bg-2": "oklch(0.232 0.013 255)",
  "--bg-3": "oklch(0.270 0.013 252)",
  "--border-subtle": "oklch(0.290 0.012 255)",
  "--border-default": "oklch(0.360 0.013 252)",
  "--fg-0": "oklch(0.955 0.005 250)",
  "--fg-1": "oklch(0.790 0.008 250)",
  "--fg-2": "oklch(0.660 0.010 250)",
  "--fg-3": "oklch(0.500 0.010 250)",
  "--accent": "oklch(0.680 0.180 268)",
  "--accent-muted": "oklch(0.460 0.110 268)",
  "--accent-tint": "color-mix(in oklab, oklch(0.680 0.180 268) 16%, transparent)",
  "--status-success": "oklch(0.760 0.150 162)",
  "--presence-agent": "oklch(0.700 0.190 322)",
  "--radius-sm": "5px",
  "--radius-md": "7px",
  "--radius-lg": "10px",
  "--radius-pill": "999px",
  "--space-2": "4px",
  "--space-3": "8px",
  "--space-4": "12px",
  "--space-5": "16px",
  "--space-6": "24px",
  "--space-7": "32px",
  "--font-display": '"Inter Tight", "Inter", system-ui, -apple-system, sans-serif',
  "--font-body": '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  "--font-mono": '"JetBrains Mono", "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
  "--type-xs": "11px", "--lh-xs": "16px",
  "--type-sm": "12px", "--lh-sm": "18px",
  "--type-base": "14px",
  "--type-md": "16px", "--lh-md": "24px",
  "--type-2xl": "28px",
  "--tracking-tight": "-0.014em",
  "--tracking-wide": "0.04em",
} as React.CSSProperties;

/* ── Icon set — thin-stroke (1.4) geometric glyphs, no emoji (DS rule) ── */
const ICONS: Record<string, React.ReactNode> = {
  cursor: <path d="M3 2l9 4.4-4 1.1-1.1 4z" />,
  folder: <path d="M2 4.5h4l1.3 1.5H14V13H2z" />,
  palette: (<><circle cx="8" cy="8" r="5.5" /><circle cx="6" cy="6" r="0.9" fill="currentColor" stroke="none" /><circle cx="10" cy="6.2" r="0.9" fill="currentColor" stroke="none" /><circle cx="10.6" cy="9.4" r="0.9" fill="currentColor" stroke="none" /></>),
  layers: (<><polygon points="8 2.2 13.8 5.5 8 8.8 2.2 5.5" /><polyline points="2.2 9 8 12.3 13.8 9" /></>),
  sliders: (<><line x1="3" y1="5" x2="13" y2="5" /><circle cx="6" cy="5" r="1.7" fill="currentColor" /><line x1="3" y1="11" x2="13" y2="11" /><circle cx="10" cy="11" r="1.7" fill="currentColor" /></>),
  message: <path d="M2.5 4.2A1.7 1.7 0 0 1 4.2 2.5h7.6A1.7 1.7 0 0 1 13.5 4.2v4.6a1.7 1.7 0 0 1-1.7 1.7H6.2L3 13V4.2z" />,
  sparkle: <path d="M8 1.8l1.4 4.8L14 8l-4.6 1.4L8 14.2l-1.4-4.8L2 8l4.6-1.4z" fill="currentColor" stroke="none" />,
  pen: (<><path d="M10.5 2.8l2.7 2.7L6 12.7 3 13.5l.8-3z" /><line x1="9.2" y1="4.1" x2="11.9" y2="6.8" /></>),
  pin: (<><path d="M8 1.8c-2.2 0-4 1.7-4 4 0 2.9 4 8.4 4 8.4s4-5.5 4-8.4c0-2.3-1.8-4-4-4z" /><circle cx="8" cy="5.8" r="1.4" /></>),
  highlighter: <path d="M3 13h4L13.5 6.5a1.6 1.6 0 0 0 0-2.3l-1.7-1.7a1.6 1.6 0 0 0-2.3 0L3 9v4z" />,
  image: (<><rect x="2.5" y="3" width="11" height="10" rx="1.4" /><circle cx="6" cy="6.5" r="1.2" /><path d="M3 11.5l3.2-3.2a1 1 0 0 1 1.4 0L13 13" /></>),
  wand: (<><path d="M2.5 13.5 9 7" /><path d="M10 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor" stroke="none" /><path d="M13 2l.3.8.8.3-.8.3-.3.8-.3-.8-.8-.3.8-.3z" fill="currentColor" stroke="none" /></>),
  scissors: (<><circle cx="4.2" cy="4.2" r="1.7" /><circle cx="4.2" cy="11.8" r="1.7" /><line x1="5.5" y1="5.3" x2="13" y2="13" /><line x1="5.5" y1="10.7" x2="13" y2="3" /></>),
  drop: <path d="M8 2c2.4 3 4.2 5.7 4.2 8a4.2 4.2 0 1 1-8.4 0C3.8 7.7 5.6 5 8 2z" />,
  grid: (<><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.8" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="0.8" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="0.8" /><rect x="9" y="9" width="4.5" height="4.5" rx="0.8" /></>),
  git: (<><circle cx="4" cy="4" r="1.6" /><circle cx="4" cy="12" r="1.6" /><circle cx="12" cy="6" r="1.6" /><path d="M4 5.6v4.8M5.6 4H9a1.4 1.4 0 0 1 1.4 1.4v.6" /></>),
  users: (<><circle cx="6" cy="6" r="2.3" /><path d="M2 13.5c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8" /><circle cx="12.2" cy="5.5" r="1.9" /><path d="M10.8 9.8c1.7.3 2.9 1.7 2.9 3.5" /></>),
  play: <polygon points="5 3.5 12.5 8 5 12.5" fill="currentColor" stroke="none" />,
  code: (<><polyline points="6 5 3 8 6 11" /><polyline points="10 5 13 8 10 11" /></>),
  check: <polyline points="3 8.2 6.4 11.5 13 4.2" />,
  "arrow-right": (<><line x1="3" y1="8" x2="12.5" y2="8" /><polyline points="9 4.5 12.5 8 9 11.5" /></>),
  "chevron-right": <polyline points="6 3.5 10.5 8 6 12.5" />,
  terminal: (<><polyline points="3.5 5.5 6 8 3.5 10.5" /><line x1="8" y1="11" x2="12" y2="11" /></>),
};
function Icon({ name, size = 16, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      {ICONS[name]}
    </svg>
  );
}

/* ── Shared frame chrome ── */
function Board({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...TOKENS, position: "absolute", inset: 0, overflow: "hidden", background: "var(--bg-0)", color: "var(--fg-0)", fontFamily: "var(--font-body)" }}>
      {children}
    </div>
  );
}
function ArtHeader({ n, total, eyebrow, title }: { n: number; total: number; eyebrow: string; title: string }) {
  return (
    <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "var(--space-6) var(--space-7) var(--space-5)", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--type-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--accent)" }}>{eyebrow}</span>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--type-2xl)", fontWeight: 650, letterSpacing: "var(--tracking-tight)" }}>{title}</h1>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--type-xs)", color: "var(--fg-3)" }}>{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
    </header>
  );
}
function Body({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "var(--space-6) var(--space-7)", display: "flex", flexDirection: "column", gap: "var(--space-6)", height: "calc(100% - 84px)", boxSizing: "border-box", overflow: "hidden" }}>{children}</div>;
}
function Lede({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, maxWidth: 640, fontSize: "var(--type-md)", lineHeight: "var(--lh-md)", color: "var(--fg-1)" }}>{children}</p>;
}
function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-5)", background: "var(--bg-1)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
      <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: "var(--radius-md)", background: "var(--accent-tint)", color: "var(--accent)" }}><Icon name={icon} size={15} /></span>
      <div style={{ fontSize: "var(--type-base)", fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: "var(--type-sm)", lineHeight: "var(--lh-sm)", color: "var(--fg-2)" }}>{body}</div>
    </div>
  );
}
function CardRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>{children}</div>;
}
function StepRow({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: "var(--radius-pill)", background: "var(--bg-2)", border: "1px solid var(--border-default)", fontFamily: "var(--font-mono)", fontSize: "var(--type-xs)", color: "var(--accent)" }}>{n}</span>
      <div>
        <div style={{ fontSize: "var(--type-base)", fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: "var(--type-sm)", lineHeight: "var(--lh-sm)", color: "var(--fg-2)" }}>{body}</div>
      </div>
    </div>
  );
}
function MiniPanelHd({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-2) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-2)", fontSize: "var(--type-xs)", color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
      <span>{label}</span>
      {right}
    </div>
  );
}
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "var(--bg-1)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden", ...style }}>{children}</div>;
}

/* ─────────────────────────── 01 · Start here ─────────────────────────── */
function ArtStartHere() {
  return (
    <Board>
      <ArtHeader n={1} total={10} eyebrow="Orientation" title="Start here" />
      <Body>
        <Lede>Everything you design lives on a canvas. Canvases are grouped in the file tree on the left — a fresh project starts with two groups: <b>Design system</b> (your tokens and components) and <b>UI kit</b> (the screens you build).</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 230, flexShrink: 0 }}>
            <MiniPanelHd label="FILES" right={<Icon name="grid" size={13} />} />
            <div style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--type-sm)" }}>
              <div style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: "var(--type-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", marginTop: 2 }}>Design system</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-2)" }}><Icon name="folder" size={13} /> (empty until set up)</div>
              <div style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: "var(--type-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", marginTop: 8 }}>UI kit</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", borderRadius: "var(--radius-sm)", background: "var(--accent-tint)", color: "var(--accent)" }}>Welcome.tsx</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-1)" }}>How to use Maude.tsx</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-1)" }}>How to make video.tsx</div>
            </div>
          </Panel>
          <CardRow>
            <FeatureCard icon="cursor" title="Click to open" body="Opening a file replaces the active canvas. Nothing is destructive — your work saves on its own as you go." />
            <FeatureCard icon="grid" title="One infinite canvas" body="Every artboard on a canvas lives on the same pannable, zoomable surface — pan and zoom like a whiteboard." />
            <FeatureCard icon="terminal" title="No terminal needed" body="Everything here — browsing, editing, saving, sharing — works from the app. The Assistant is the only thing that pairs with a Claude Code you install once." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ────────────────────── 02 · Build a design system ───────────────────── */
function ArtDesignSystem() {
  const swatches = ["oklch(0.68 0.18 268)", "oklch(0.76 0.15 162)", "oklch(0.80 0.13 78)", "oklch(0.66 0.19 25)"];
  return (
    <Board>
      <ArtHeader n={2} total={10} eyebrow="Foundations" title="Build a design system" />
      <Body>
        <Lede>Ask the Assistant to run <b>/design:setup-ds</b> and it interviews you — a handful of sharp questions about your product, mood, and brand — then generates a real, tokenized system: color, type, space, motion, and components. No blank Figma file, no picking a font at random.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ flex: 1, padding: "var(--space-5)" }}>
            <div style={{ fontSize: "var(--type-xs)", fontFamily: "var(--font-mono)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: "var(--space-3)" }}>Colors</div>
            <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
              {swatches.map((c) => <span key={c} style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: c, border: "1px solid var(--border-subtle)" }} />)}
            </div>
            <div style={{ fontSize: "var(--type-xs)", fontFamily: "var(--font-mono)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: "var(--space-3)" }}>Type</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Display heading</div>
            <div style={{ fontSize: "var(--type-sm)", color: "var(--fg-2)" }}>Body copy at a readable measure.</div>
          </Panel>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <StepRow n={1} title="A dozen sharp questions" body="Product, audience, mood references, a hard-NO list — real research grounds every option, not vibes." />
            <StepRow n={2} title="Pick a direction" body="A small set of moodboard variants, seeded from your answers — pick one and refine it." />
            <StepRow n={3} title="A complete, tokenized system" body="Colors, type ladder, spacing, motion, and a component library — every value a token, nothing hardcoded." />
          </div>
        </div>
      </Body>
    </Board>
  );
}

/* ────────────────────────── 03 · Edit a canvas ────────────────────────── */
function ArtEditCanvas() {
  return (
    <Board>
      <ArtHeader n={3} total={10} eyebrow="Editing" title="Edit a canvas" />
      <Body>
        <Lede>Click any text to edit it inline. Hold <b>⌘</b> and hover to preview an element, click to select it — the Inspector opens with everything about it: its properties, its layer position, and its live CSS.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 280, flexShrink: 0 }}>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)" }}>
              {["Inspect", "Layers", "CSS"].map((t, i) => (
                <span key={t} style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--type-sm)", borderBottom: i === 0 ? "2px solid var(--accent)" : "2px solid transparent", color: i === 0 ? "var(--fg-0)" : "var(--fg-2)" }}>{t}</span>
              ))}
            </div>
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {[["Type", "Button"], ["Text", "Get started"], ["Fill", "var(--accent)"], ["Radius", "var(--radius-md)"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderRadius: "var(--radius-sm)", fontSize: "var(--type-sm)" }}>
                  <span style={{ color: "var(--fg-2)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-0)" }}>{v}</span>
                </div>
              ))}
            </div>
          </Panel>
          <CardRow>
            <FeatureCard icon="pen" title="Inline text edit" body="Click any text on the canvas and type — no dialog, no round-trip." />
            <FeatureCard icon="sliders" title="Bind to a token" body="Drag a color or spacing value onto a design token to bind it — change the token, every use updates." />
            <FeatureCard icon="layers" title="Drag to reorder" body="Reorder elements right on the canvas or in the Layers tab, Figma-style." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ───────────────────────── 04 · The AI Assistant ──────────────────────── */
function ArtAiAssistant() {
  return (
    <Board>
      <ArtHeader n={4} total={10} eyebrow="Assistant" title="The AI Assistant" />
      <Body>
        <Lede>The chat panel runs on your own Claude subscription — never a separate key, never metered billing. It sees whatever's open and selected, so short requests work: "make this bigger," not a paragraph of context.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 320, flexShrink: 0 }}>
            <MiniPanelHd label="ASSISTANT" right={<span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--status-success)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--status-success)" }} />Ready</span>} />
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--accent-tint)", color: "var(--fg-0)", fontSize: "var(--type-sm)" }}>Make the hero title bigger and tighten the tracking</div>
              <div style={{ maxWidth: "85%", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--bg-2)", fontSize: "var(--type-sm)", color: "var(--fg-1)" }}>Bumped it to <code>var(--type-3xl)</code> and tightened tracking. Want it bolder too?</div>
            </div>
          </Panel>
          <CardRow>
            <FeatureCard icon="terminal" title="Slash commands" body="Type / for autocomplete — /design:new, /design:edit, /design:critic and more, right in the composer." />
            <FeatureCard icon="message" title="It remembers" body="Conversations survive a restart — close the laptop, come back tomorrow, keep going mid-thought." />
            <FeatureCard icon="sparkle" title="Runs on your subscription" body="Install Claude Code once, sign in, and the Assistant just works — no separate API key, ever." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ──────────────────── 05 · Point, comment, draw → it acts ────────────── */
function ArtPointCommentDraw() {
  return (
    <Board>
      <ArtHeader n={5} total={10} eyebrow="✦ The signature move" title="Point, comment, draw → it acts" />
      <Body>
        <Lede>You don't have to describe a change in words. ⌘-click an element to select it, drop a comment pin on a pixel, or draw right on the canvas with the annotation tools — the Assistant reads all of it as context for the next request.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 340, flexShrink: 0, position: "relative", minHeight: 180 }}>
            <div style={{ position: "absolute", left: 40, top: 40, width: 160, height: 90, borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--accent)" }} />
            <span style={{ position: "absolute", left: 210, top: 50, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--border-default)", fontSize: "var(--type-sm)" }}><Icon name="pin" size={13} style={{ color: "var(--accent)" }} /> tighten this spacing</span>
            <Icon name="cursor" size={20} style={{ position: "absolute", left: 90, top: 60, color: "var(--accent)" }} />
            <svg style={{ position: "absolute", left: 60, top: 150, width: 140, height: 50 }} viewBox="0 0 140 50"><path d="M5 45 C 40 5, 90 5, 130 25" stroke="var(--presence-agent)" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </Panel>
          <CardRow>
            <FeatureCard icon="cursor" title="⌘-click to select" body="Hover for a preview, click to select — ⌘⇧+click adds more than one to the selection." />
            <FeatureCard icon="pin" title="Comment on a pixel" body="Pin a note to an exact spot, not a vague description — the Assistant reads it as scoped context." />
            <FeatureCard icon="highlighter" title="Draw & annotate" body="Highlighter, sticky notes, shapes and freehand marks — a real whiteboard layer over the canvas." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ──────────────── 06 · Generate images with your own AI key ───────────── */
function ArtGenerateImages() {
  return (
    <Board>
      <ArtHeader n={6} total={10} eyebrow="AI media" title="Generate images with your own AI key" />
      <Body>
        <Lede>Bring your own Google (Nano Banana) key and generate an image right onto the canvas — via <b>⌘K → "Generate with AI"</b>, or just ask in the chat ("generate a hero image of a mountain lake"). The result lands as a normal asset you can place, edit, and re-generate.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 260, height: 150, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <MiniPanelHd label="GENERATE" right={<Icon name="sparkle" size={13} style={{ color: "var(--accent)" }} />} />
            <div style={{ flex: 1, margin: "var(--space-3)", borderRadius: "var(--radius-md)", background: "linear-gradient(135deg, var(--bg-3), var(--bg-2))", display: "grid", placeItems: "center", color: "var(--fg-3)" }}>
              <Icon name="image" size={26} />
            </div>
          </Panel>
          <CardRow>
            <FeatureCard icon="wand" title="Prompt, or seed from a still" body="A plain-text prompt, or start from an image you already generated so a new shot matches its look." />
            <FeatureCard icon="pen" title="Ask to edit it again" body="&ldquo;Make the sky purple&rdquo; produces a fresh AI-edited version — iterate the same way you'd iterate on any canvas element." />
            <FeatureCard icon="sliders" title="Stays on your machine" body="Add your key under File → Settings — AI generation. It's sent straight to the provider, never touches git history." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ─────────────────────────── 07 · Photo editing ───────────────────────── */
function ArtPhotoEditing() {
  return (
    <Board>
      <ArtHeader n={7} total={10} eyebrow="AI media" title="Photo editing, right on the canvas" />
      <Body>
        <Lede>Select any photo and open the <b>Photo</b> tab in the Inspector — adjustments, duotone, grain, masking, and one-click background removal. Every edit is non-destructive: the original stays untouched.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 280, flexShrink: 0 }}>
            <MiniPanelHd label="PHOTO" />
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {["Brightness", "Contrast", "Saturation"].map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ width: 80, fontSize: "var(--type-xs)", color: "var(--fg-2)" }}>{k}</span>
                  <div style={{ flex: 1, height: 3, borderRadius: "var(--radius-pill)", background: "var(--bg-3)", position: "relative" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "60%", borderRadius: "var(--radius-pill)", background: "var(--accent)" }} />
                  </div>
                </div>
              ))}
              <button type="button" style={{ marginTop: 4, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-default)", background: "var(--bg-2)", color: "var(--fg-0)", fontSize: "var(--type-sm)", cursor: "pointer" }}><Icon name="scissors" size={13} /> Remove background</button>
            </div>
          </Panel>
          <CardRow>
            <FeatureCard icon="scissors" title="One-click background removal" body="Runs locally — no upload, no per-image cost." />
            <FeatureCard icon="drop" title="Duotone, grain, masking" body="Real photo-editing tools, not a filter preset list — every value is a canvas-native property." />
            <FeatureCard icon="check" title="Non-destructive" body="Adjustments live as metadata next to the asset — revert anytime, the source file never changes." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ────────────────────── 08 · Drop in media & templates ────────────────── */
function ArtMediaTemplates() {
  return (
    <Board>
      <ArtHeader n={8} total={10} eyebrow="Assets" title="Drop in media & templates" />
      <Body>
        <Lede>Drag images, video, or audio straight from Finder onto the canvas — one file or a whole batch. Paste a link to unfurl it. Create or delete a canvas from the file tree without ever touching the filesystem yourself.</Lede>
        <CardRow>
          <FeatureCard icon="image" title="Drag & drop, one or many" body="Drop a single photo or select a batch — every file lands, even in a large drop. Video and audio go on the canvas as annotations; photos can drop straight into an artboard." />
          <FeatureCard icon="arrow-right" title="Paste a link" body="Paste a URL onto the canvas and it unfurls — no manual screenshotting." />
          <FeatureCard icon="grid" title="Create & delete canvases" body="Right-click the file tree — new canvas, new folder, rename, delete — all without a terminal." />
        </CardRow>
      </Body>
    </Board>
  );
}

/* ────────────────── 09 · Save, share, collaborate ──────────────────────── */
function ArtSaveShareCollab() {
  return (
    <Board>
      <ArtHeader n={9} total={10} eyebrow="Version & team" title="Save, share, collaborate" />
      <Body>
        <Lede>Version control lives in plain words: <b>Save version</b> keeps a checkpoint just for you, <b>Publish</b> shares it with your team, <b>Get latest</b> pulls in everyone else's work. No terminal, no git vocabulary required.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <CardRow>
            <FeatureCard icon="git" title="No-terminal git layer" body="Save version · Publish · Get latest — the same underlying git history, described in plain words." />
            <FeatureCard icon="users" title="Live multiplayer" body="See your team's cursors moving in real time, on the same branch — changes sync as they happen." />
            <FeatureCard icon="play" title="Present Mode" body="Strip the chrome down to just your artboards for a clean walkthrough or a client call." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ───────────────────────────── 10 · Draw as code ───────────────────────── */
function ArtDrawAsCode() {
  return (
    <Board>
      <ArtHeader n={10} total={10} eyebrow="Vector & motion" title="Draw as code" />
      <Body>
        <Lede>Ask for a logo, icon, or diagram and it's built by a deterministic geometry engine — real computed vectors, never a guessed path. Animate the result once and ship one file that plays identically on web and native.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 180, height: 150, flexShrink: 0, display: "grid", placeItems: "center" }}>
            <svg width={72} height={72} viewBox="0 0 32 32" style={{ color: "var(--accent)" }} aria-hidden>
              <rect width="16" height="16" x="8" y="8" fill="none" stroke="currentColor" strokeWidth="2.4" rx="4" />
              <g fill="currentColor"><rect width="5.6" height="5.6" x="23" y="3" rx="1.6" /><rect width="5.6" height="5.6" x="3" y="23" rx="1.6" /><rect width="5.6" height="5.6" x="23" y="23" rx="1.6" /></g>
            </svg>
          </Panel>
          <CardRow>
            <FeatureCard icon="code" title="Computed, not guessed" body="Splines, connectors, and layout math produce the SVG — deterministic and consistent, every time." />
            <FeatureCard icon="play" title="Animate once" body="Turn a mark into motion and export a single .lottie — frame for frame, web and native in sync." />
            <FeatureCard icon="check" title="WCAG + grid-checked" body="Every mark clears a legibility, contrast, and grid-alignment gate before it's considered done." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

export default function Canvas() {
  return (
    <DesignCanvas>
      <DCSection id="how-to-use-maude" title="How to use Maude" subtitle="REFERENCE · 10 artboards, one per capability">
        <DCArtboard id="start-here" label="01 · Start here" width={1040} height={640}><ArtStartHere /></DCArtboard>
        <DCArtboard id="design-system" label="02 · Design system" width={1040} height={640}><ArtDesignSystem /></DCArtboard>
        <DCArtboard id="edit-canvas" label="03 · Edit a canvas" width={1040} height={640}><ArtEditCanvas /></DCArtboard>
        <DCArtboard id="ai-assistant" label="04 · AI Assistant" width={1040} height={640}><ArtAiAssistant /></DCArtboard>
        <DCArtboard id="point-comment-draw" label="05 · Point, comment, draw" width={1040} height={640}><ArtPointCommentDraw /></DCArtboard>
        <DCArtboard id="generate-images" label="06 · Generate images" width={1040} height={640}><ArtGenerateImages /></DCArtboard>
        <DCArtboard id="photo-editing" label="07 · Photo editing" width={1040} height={640}><ArtPhotoEditing /></DCArtboard>
        <DCArtboard id="media-and-templates" label="08 · Media & templates" width={1040} height={640}><ArtMediaTemplates /></DCArtboard>
        <DCArtboard id="save-share-collab" label="09 · Save, share, collaborate" width={1040} height={640}><ArtSaveShareCollab /></DCArtboard>
        <DCArtboard id="draw-as-code" label="10 · Draw as code" width={1040} height={640}><ArtDrawAsCode /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
