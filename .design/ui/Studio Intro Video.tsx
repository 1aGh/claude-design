/**
 * @canvas      Studio Intro Video — v4 full storyboard for the Maude landing film · brief + 12-scene storyboard + landing placement · maude DS, dark
 * @ds          maude
 * @platform    desktop
 * @opt_out     palette
 * @artboards   brief | storyboard | landing
 * @brief       v4 rebuild (phase-16). Full visual storyboard depicting the whole real loop (v2.1 spine: install → setup-ds → /design:new split → canvas → cmd+click → /design:edit split → comments → handoff → end card), rendered in the maude dark-studio product chrome. Each scene carries its OWN signature treatment (no repeating motif), a voice-aligned caption, and a per-scene intent line. Length flexible — rhythm decides. This canvas is the Phase A concrete artifact the user reacts to before any Remotion authoring.
 * @stack       React 19 · TSX · Bun.build · sibling Studio Intro Video.css (every value a var(--*) token)
 * @history     .design/_history/studio-intro-video/
 *
 * Authored under the `maude` DS. Self-imports the maude tokens + shared component
 * classes so it renders in maude regardless of host injection.
 */

import "../system/maude/colors_and_type.css";
import "../system/maude/preview/_components.css";
import "./Studio Intro Video.css";
import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";

/* ─────────────────────────────── icons ─────────────────────────────── */
const ICONS: Record<string, React.ReactNode> = {
  play: <polygon points="5 3.5 12.5 8 5 12.5" fill="currentColor" stroke="none" />,
  volume: (<><polygon points="3 6 5.5 6 8 3.5 8 12.5 5.5 10 3 10" fill="currentColor" stroke="none" /><path d="M10.5 6a3 3 0 0 1 0 4" /></>),
  expand: (<><polyline points="3 6 3 3 6 3" /><polyline points="10 3 13 3 13 6" /><polyline points="13 10 13 13 10 13" /><polyline points="6 13 3 13 3 10" /></>),
  cc: (<><rect x="2.5" y="3.5" width="11" height="9" rx="1.5" /><path d="M6.5 7a1.4 1.4 0 0 0-2 1.2 1.4 1.4 0 0 0 2 1.2" /><path d="M11 7a1.4 1.4 0 0 0-2 1.2 1.4 1.4 0 0 0 2 1.2" /></>),
  cursor: <path d="M3 2l9 4.4-4 1.1-1.1 4z" />,
  sparkle: <path d="M8 1.8l1.4 4.8L14 8l-4.6 1.4L8 14.2l-1.4-4.8L2 8l4.6-1.4z" fill="currentColor" stroke="none" />,
  download: (<><line x1="8" y1="2.5" x2="8" y2="10" /><polyline points="4.5 7 8 10.5 11.5 7" /><polyline points="3 12.8 3 13.6 13 13.6 13 12.8" /></>),
  code: (<><polyline points="6 5 3 8 6 11" /><polyline points="10 5 13 8 10 11" /></>),
  "arrow-right": (<><line x1="3" y1="8" x2="12.5" y2="8" /><polyline points="9 4.5 12.5 8 9 11.5" /></>),
  terminal: (<><rect x="2.2" y="3" width="11.6" height="10" rx="1.5" /><polyline points="5 6.5 7 8 5 9.5" /><line x1="8.5" y1="10" x2="11" y2="10" /></>),
  check: <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />,
  message: <path d="M2.5 4.2A1.7 1.7 0 0 1 4.2 2.5h7.6A1.7 1.7 0 0 1 13.5 4.2v4.6a1.7 1.7 0 0 1-1.7 1.7H6.2L3 13V4.2z" />,
  pen: (<><path d="M10.5 2.8l2.7 2.7L6 12.7 3 13.5l.8-3z" /><line x1="9.2" y1="4.1" x2="11.9" y2="6.8" /></>),
  layers: (<><polygon points="8 2.2 14 5.2 8 8.2 2 5.2" /><polyline points="2 8 8 11 14 8" /></>),
  grab: (<><path d="M5.5 7V4.2a1 1 0 0 1 2 0V7" /><path d="M7.5 6.6V3.8a1 1 0 0 1 2 0V7" /><path d="M9.5 4.2a1 1 0 0 1 2 0V9a3.4 3.4 0 0 1-3.4 3.4H7A3 3 0 0 1 4.3 10l-.8-1.6a1 1 0 0 1 1.7-1l.8 1" /></>),
};
function Icon({ name, size = 16, className, style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
function BrandMark({ size }: { size?: number }) {
  return (
    <span className="sd-brand-mark" style={size ? { width: size, height: size } : undefined}>
      <svg viewBox="0 0 32 32" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" /></svg>
    </span>
  );
}

/* ───────────────────────── landing player (kept) ───────────────────────── */
function Player({ fixed = false }: { fixed?: boolean }) {
  return (
    <div className={"sd-player" + (fixed ? " sd-player--fixed" : "")}>
      <div className="sd-player-stage">
        <button type="button" className="sd-play" aria-label="Play intro video"><Icon name="play" size={30} /></button>
      </div>
      <div className="sd-player-title">See Maude think<small>v4 · the whole loop · captions on</small></div>
      <span className="sd-player-badge">intro · v4</span>
      <div className="sd-player-cap">“The repo is the source of truth.”</div>
      <div className="sd-scrub">
        <button type="button" className="sd-scrub-ic" aria-label="Play"><Icon name="play" size={14} /></button>
        <button type="button" className="sd-scrub-ic" aria-label="Mute"><Icon name="volume" size={14} /></button>
        <div className="sd-scrub-track" aria-hidden="true">
          <div className="sd-scrub-fill" />
          <span className="sd-scrub-chap" style={{ left: "18%" }} />
          <span className="sd-scrub-chap" style={{ left: "44%" }} />
          <span className="sd-scrub-chap" style={{ left: "72%" }} />
          <span className="sd-scrub-chap" style={{ left: "90%" }} />
        </div>
        <span className="sd-scrub-time">0:21 / ≈1:15</span>
        <button type="button" className="sd-scrub-ic" aria-label="Captions"><Icon name="cc" size={14} /></button>
        <button type="button" className="sd-scrub-ic" aria-label="Fullscreen"><Icon name="expand" size={14} /></button>
      </div>
    </div>
  );
}

function LandingPlacement() {
  return (
    <div className="sd-shell">
      <div className="sd-bar">
        <div className="sd-brand"><BrandMark /><span className="sd-brand-name">maude</span><span className="sd-brand-sku">docs</span></div>
        <nav className="sd-bar-nav" aria-label="primary">
          <a className="sd-bar-link is-active" href="#">Home</a>
          <a className="sd-bar-link" href="#">Docs</a>
          <a className="sd-bar-link" href="#">Roadmap</a>
          <a className="sd-bar-link" href="#">What's New</a>
        </nav>
        <span className="sd-bar-right">v0.29.0 · MIT</span>
      </div>
      <div className="sd-stage sd-canvas">
        <div className="sd-hero-eyebrow"><Icon name="play" size={12} /> WATCH · THE WHOLE LOOP</div>
        <h1 className="sd-hero-h1">See Maude <span className="sd-accent">think</span>.</h1>
        <p className="sd-hero-sub">The whole loop in one take — describe a screen, watch the agent fill the canvas, the critics score it, and the result hand off straight into the repo. No narration fluff, no demo account.</p>
        <div className="sd-hero-cta">
          <button type="button" className="btn btn--primary"><Icon name="play" size={14} /> Play intro</button>
          <button type="button" className="btn btn--ghost">Skip to docs <Icon name="arrow-right" size={14} /></button>
        </div>
        <Player />
      </div>
    </div>
  );
}

/* ──────────────────────── per-scene frame renders ──────────────────────── */
/* Each frame is a compact, legible mock of what THAT scene shows on screen.
   The signature treatment is what makes each frame distinct from the others. */

function Caret() { return <span className="sb-caret" aria-hidden="true" />; }

function FrameColdOpen() {
  return (
    <div className="sb-fr sb-fr--cold">
      <span className="sb-cold-mark">maude<Caret /></span>
      <span className="sb-cold-cur"><Icon name="cursor" size={15} /></span>
    </div>
  );
}

function FrameInstall() {
  return (
    <div className="sb-fr sb-fr--term">
      <div className="sb-term">
        <div className="sb-term-line"><span className="sb-term-pr">$</span> npm i -g @1agh/maude</div>
        <div className="sb-term-line sb-term-ok">added @1agh/maude 0.29.0</div>
        <div className="sb-term-line"><span className="sb-term-pr">$</span> maude init</div>
        <div className="sb-term-line sb-term-ok">✓ .ai/ scaffolded<Caret /></div>
      </div>
    </div>
  );
}

function FrameSetupDs() {
  return (
    <div className="sb-fr sb-fr--tui">
      <div className="sb-tui">
        <div className="sb-tui-hd"><span className="sb-tui-dot" /> claude</div>
        <div className="sb-tui-cmd"><span className="sb-tui-pr">&gt;</span> /design:setup-ds <span className="sb-tui-arg">project "industrial catalogue, paper &amp; ink…"</span></div>
        <div className="sb-tui-q">
          <span className="sb-tui-stage">STAGE 1 · 1 / 4</span>
          What feeling should the very first screen give someone?
        </div>
      </div>
    </div>
  );
}

function FrameMoodboard() {
  // Faithful to .design/_moodboard/* — a real "1am pinboard": scattered rotated
  // cards (type specimen, swatch strip, mood thumbs, a paper note, an accent
  // callout, a pin).
  return (
    <div className="sb-fr sb-fr--pin">
      <div className="sb-pin-card" style={{ left: "6%", top: "12%", width: "34%", transform: "rotate(-2deg)" }}>
        <div className="sb-pin-aa">Aa Gg</div>
        <div className="sb-pin-row"><span style={{ background: "oklch(0.68 0.18 268)" }} /><span style={{ background: "oklch(0.62 0.20 28)" }} /><span style={{ background: "oklch(0.72 0.15 160)" }} /><span style={{ background: "var(--fg-0)" }} /></div>
      </div>
      <div className="sb-pin-card sb-pin-card--img" style={{ left: "46%", top: "8%", width: "24%", height: "34%", transform: "rotate(2deg)", background: "var(--bg-3)" }} />
      <div className="sb-pin-card" style={{ left: "72%", top: "14%", width: "22%", transform: "rotate(-3deg)", background: "var(--accent)", color: "var(--accent-fg)" }}>
        <div className="sb-pin-note">one accent · hue 268</div>
      </div>
      <div className="sb-pin-card sb-pin-card--img" style={{ left: "10%", top: "54%", width: "26%", height: "32%", transform: "rotate(1.5deg)", background: "var(--bg-4)" }} />
      <div className="sb-pin-card" style={{ left: "42%", top: "52%", width: "30%", transform: "rotate(-1deg)" }}>
        <div className="sb-pin-note" style={{ color: "var(--fg-1)" }}>“design → production, one canvas”</div>
      </div>
      <span className="sb-pin-dot" style={{ left: "70%", top: "56%" }} />
      <span className="sb-pin-stamp">pro studio.</span>
    </div>
  );
}

function FrameDsReveal() {
  // Faithful to the real DS specimen (colors-accent "Accent. One indigo.") —
  // editorial: a headline + oklch line + accent family + a button-in-context.
  return (
    <div className="sb-fr sb-fr--edi">
      <div className="sb-edi-h">Accent. <span style={{ color: "var(--accent)" }}>One indigo.</span></div>
      <div className="sb-edi-oklch">accent · oklch(0.68 0.18 268) · 6.4:1 on bg-0</div>
      <div className="sb-edi-fam">
        <span style={{ background: "var(--accent)" }} /><span style={{ background: "var(--accent-hover)" }} /><span style={{ background: "var(--accent-muted)" }} /><span style={{ background: "var(--accent-tint)" }} />
      </div>
      <div className="sb-edi-ctx">
        <span className="sb-edi-btn">Primary</span>
        <span className="sb-edi-ghost">Ghost</span>
        <span className="sb-edi-cap">one job, never decoration</span>
      </div>
    </div>
  );
}

function FrameNewSplit() {
  return (
    <div className="sb-fr sb-fr--split">
      <div className="sb-split-l">
        <div className="sb-tui-mini"><span className="sb-tui-pr">&gt;</span> /design:new</div>
        <div className="sb-stream"><span style={{ width: "82%" }} /><span style={{ width: "64%" }} /><span style={{ width: "73%" }} /><span style={{ width: "40%" }} className="sb-stream-live" /></div>
      </div>
      <div className="sb-split-r sb-dots">
        <div className="sb-ab">
          <div className="sb-ab-bar"><i /><i /><i /></div>
          <div className="sb-sk" style={{ width: "60%" }} />
          <div className="sb-sk sb-sk--accent" style={{ width: "32%" }} />
          <div className="sb-sk" style={{ width: "78%" }} />
          <span className="sb-cur-agent"><Icon name="cursor" size={13} /></span>
        </div>
      </div>
    </div>
  );
}

function FrameCritics() {
  return (
    <div className="sb-fr sb-fr--dots sb-center">
      <div className="sb-verdict">
        <div className="sb-verdict-hd">CRITIC PANEL</div>
        <div className="sb-vrow"><span>signature</span><b className="sb-vok">4.6</b></div>
        <div className="sb-vrow"><span>a11y</span><b className="sb-vok">pass</b></div>
        <div className="sb-vrow"><span>restraint</span><b className="sb-vok">ok</b></div>
        <div className="sb-fix"><Icon name="check" size={11} /> auto-fix · 2 applied</div>
      </div>
    </div>
  );
}

function FrameCanvasPan() {
  return (
    <div className="sb-fr sb-fr--dots sb-fr--pan">
      <div className="sb-pan-row">
        <div className="sb-ab sb-ab--xs" style={{ opacity: 0.5 }}><div className="sb-ab-bar"><i /><i /></div><div className="sb-sk" style={{ width: "70%" }} /></div>
        <div className="sb-ab sb-ab--xs"><div className="sb-ab-bar"><i /><i /></div><div className="sb-sk sb-sk--accent" style={{ width: "44%" }} /><div className="sb-sk" style={{ width: "80%" }} /></div>
        <div className="sb-ab sb-ab--xs" style={{ opacity: 0.5 }}><div className="sb-ab-bar"><i /><i /></div><div className="sb-sk" style={{ width: "60%" }} /></div>
      </div>
      <span className="sb-zoom-pill">1:1</span>
      <span className="sb-grab"><Icon name="grab" size={14} /></span>
    </div>
  );
}

function FrameInspector() {
  return (
    <div className="sb-fr sb-fr--dots sb-center">
      <div className="sb-ab sb-ab--insp">
        <div className="sb-ab-bar"><i /><i /><i /></div>
        <div className="sb-sk" style={{ width: "70%" }} />
        <div className="sb-halo"><div className="sb-sk sb-sk--accent" style={{ width: "100%" }} /></div>
        <div className="sb-sk" style={{ width: "54%" }} />
        <span className="sb-cur-cmd"><Icon name="cursor" size={13} /><b>⌘</b></span>
        <span className="sb-path">Hero.tsx · L42</span>
      </div>
    </div>
  );
}

function FrameEditSplit() {
  return (
    <div className="sb-fr sb-fr--split">
      <div className="sb-split-l">
        <div className="sb-tui-mini"><span className="sb-tui-pr">&gt;</span> /design:edit</div>
        <div className="sb-diff sb-diff--del">− tighten the hero</div>
        <div className="sb-diff sb-diff--del">− drop one metadata row</div>
        <div className="sb-diff sb-diff--add">+ applied · reload</div>
      </div>
      <div className="sb-split-r sb-dots">
        <div className="sb-ab">
          <div className="sb-ab-bar"><i /><i /><i /></div>
          <div className="sb-sk sb-sk--accent" style={{ width: "46%" }} />
          <div className="sb-sk" style={{ width: "82%" }} />
          <span className="sb-reload"><Icon name="check" size={11} /> reloaded</span>
        </div>
      </div>
    </div>
  );
}

function FrameComments() {
  return (
    <div className="sb-fr sb-fr--dots sb-center">
      <div className="sb-ab sb-ab--insp">
        <div className="sb-ab-bar"><i /><i /><i /></div>
        <div className="sb-sk" style={{ width: "66%" }} />
        <div className="sb-sk" style={{ width: "84%" }} />
        <svg className="sb-penmark" viewBox="0 0 60 40" aria-hidden="true"><path d="M6 30 C 20 8, 38 8, 52 18" /><polyline points="46 14 53 18 49 25" /></svg>
        <span className="sb-annot-label"><Icon name="pen" size={10} /> tighten</span>
        <span className="sb-pin">1</span>
        <span className="sb-thread"><Icon name="message" size={11} /> looks tight</span>
      </div>
    </div>
  );
}

function FrameHandoff() {
  return (
    <div className="sb-fr sb-fr--dots sb-center">
      <div className="sb-handoff">
        <div className="sb-ho-tile"><Icon name="download" size={14} /><span>shadcn</span></div>
        <div className="sb-ho-tile"><Icon name="play" size={12} style={{ visibility: "hidden" }} /><span>PNG</span></div>
        <div className="sb-ho-tile"><Icon name="code" size={14} /><span>code</span></div>
        <span className="sb-ho-arrow"><Icon name="arrow-right" size={14} /> repo</span>
      </div>
    </div>
  );
}

function FrameEndCard() {
  return (
    <div className="sb-fr sb-fr--end sb-center">
      <div className="sb-end">
        <div className="sb-end-lockup"><BrandMark size={34} /><span className="sb-end-mark">maude</span></div>
        <div className="sb-end-install">npm i -g @1agh/maude</div>
        <div className="sb-end-foot">MIT · no telemetry · no signup</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── scene table ───────────────────────────── */
type Role = "hook" | "proof" | "payoff" | "closer";
type Src = "real" | "faithful" | "illustrate";
type Scene = { id: string; role: Role; src: Src; dur: string; title: string; sig: string; cap: string; ref: string; Frame: () => React.ReactElement };

// v4.1 — reality-grounded rebuild. `src`: real = composited real capture ·
// faithful = hi-fi recreation matched to a real capture · illustrate = stylised.
// `ref` = the real maude output each scene is grounded in.
const SCENES: Scene[] = [
  { id: "00", role: "hook", src: "faithful", dur: "≈3s", title: "Cold open", sig: "Caret pulses alone on the empty dotted void → wordmark types in", cap: "“you start with nothing — a dotted canvas and an idea.”", ref: "maude wordmark + dotted canvas", Frame: FrameColdOpen },
  { id: "05", role: "hook", src: "real", dur: "≈6s", title: "Install", sig: "REAL terminal capture (asciinema) in a cinematic window + push-in", cap: "“two plugins, one CLI.”", ref: "real `maude --version` / `init --dry-run` / `design help`", Frame: FrameInstall },
  { id: "10", role: "proof", src: "faithful", dur: "≈6s", title: "Onboarding", sig: "Claude TUI questionary — a prose question, not a form", cap: "“onboarding is a slash command.”", ref: "real `/design:setup-ds` Stage-1 flow", Frame: FrameSetupDs },
  { id: "12", role: "proof", src: "faithful", dur: "≈6s", title: "Moodboard", sig: "A real 1am pinboard assembles — type specimen, swatches, mood + reference cards, annotations", cap: "“research first — a real moodboard.”", ref: ".design/_moodboard/maude-v2-variant-B", Frame: FrameMoodboard },
  { id: "15", role: "proof", src: "faithful", dur: "≈6s", title: "DS reveal", sig: "The editorial specimen — “Accent. One indigo.” headline + oklch + family + in-context", cap: "“a design system from a paragraph.”", ref: "real specimen system/maude/preview/colors-accent", Frame: FrameDsReveal },
  { id: "20", role: "proof", src: "faithful", dur: "≈10s", title: "/design:new", sig: "Real Studio chrome — FILES tree + dotted canvas fills live as the TUI streams", cap: "“one slash. real canvas, real code.”", ref: "real Studio.tsx + canvas fill", Frame: FrameNewSplit },
  { id: "25", role: "proof", src: "illustrate", dur: "≈7s", title: "Critics", sig: "Verdict score card resolves + auto-fix loop ticks (illustrated)", cap: "“critics score it. then it fixes itself.”", ref: "illustrated — critic PANEL.md shape", Frame: FrameCritics },
  { id: "30", role: "proof", src: "faithful", dur: "≈6s", title: "Canvas reveal", sig: "Camera pans the real infinite canvas — artboards bleed off-frame, WORLD minimap", cap: "“multi-artboard. pan, zoom, ship.”", ref: "real Canvas Viewport.tsx", Frame: FrameCanvasPan },
  { id: "35", role: "proof", src: "faithful", dur: "≈6s", title: "Cmd+Click", sig: "Real inspector — halo on an element + ⌘ cursor + the exact file-path chip", cap: "“cmd+click. the exact file Claude needs.”", ref: "real Studio inspector panel", Frame: FrameInspector },
  { id: "40", role: "proof", src: "faithful", dur: "≈9s", title: "/design:edit", sig: "Edit diff in the TUI, the same real canvas reloads in place", cap: "“edit. reload. same canvas.”", ref: "real Studio canvas + edit diff", Frame: FrameEditSplit },
  { id: "45", role: "proof", src: "faithful", dur: "≈7s", title: "Comments + annotations", sig: "Real Studio comment pin + thread + a hand-drawn pen annotation", cap: "“comment on pixels. draw on them. no exports.”", ref: "real Studio comment pin/thread", Frame: FrameComments },
  { id: "50", role: "payoff", src: "faithful", dur: "≈6s", title: "Handoff", sig: "Export tiles fan out — shadcn / PNG / code → into the repo", cap: "“then hand off — straight into the repo.”", ref: "real export dialog formats", Frame: FrameHandoff },
  { id: "55", role: "closer", src: "faithful", dur: "≈4s", title: "End card", sig: "Real brand lockup + install line, loop-safe back to the void", cap: "“your repo. yours forever.”", ref: "real logo.tsx mark", Frame: FrameEndCard },
];

const ROLE_LABEL: Record<Role, string> = { hook: "HOOK", proof: "PROOF", payoff: "PAYOFF", closer: "CLOSER" };
const SRC_LABEL: Record<Src, string> = { real: "● REAL CAPTURE", faithful: "◆ FAITHFUL", illustrate: "○ ILLUSTRATED" };

function SceneTile({ s }: { s: Scene }) {
  const { Frame } = s;
  return (
    <article className="sb-tile">
      <div className="sb-tile-frame">
        <span className="sb-tile-id">{s.id}</span>
        <span className={"sb-tile-role sb-role--" + s.role}>{ROLE_LABEL[s.role]}</span>
        <Frame />
        <span className="sb-tile-dur">{s.dur}</span>
      </div>
      <div className="sb-tile-meta">
        <div className="sb-tile-titlerow">
          <span className="sb-tile-title">{s.title}</span>
          <span className={"sb-tile-src sb-src--" + s.src}>{SRC_LABEL[s.src]}</span>
        </div>
        <div className="sb-tile-sig"><span className="sb-tile-sig-key">◆ signature</span> {s.sig}</div>
        <div className="sb-tile-cap">{s.cap}</div>
        <div className="sb-tile-intent"><span className="sb-tile-intent-key">grounded in</span> {s.ref}</div>
      </div>
    </article>
  );
}

/* ─────────────────────────────── artboards ─────────────────────────────── */

function BriefCard() {
  return (
    <div className="sd-shell">
      <div className="sd-stage sb-brief sd-canvas">
        <div className="sb-brief-eyebrow"><BrandMark /> <span>MAUDE / INTRO FILM</span> <span className="sb-brief-ver">v4.1 · reality-grounded</span></div>
        <h1 className="sb-brief-h1">See Maude <span className="sd-accent">think</span> — the whole loop, in one take.</h1>
        <p className="sb-brief-lede">Reality-grounded rebuild. The first cut read corporate because the scenes were mocks. Now every scene is grounded in a REAL maude output — captured via terminal + agent-browser — then animated. Each scene's <span className="sb-mono">source</span> chip says how: real capture · faithful recreation · illustrated.</p>

        <div className="sb-brief-grid">
          <div className="sb-brief-card">
            <div className="sb-brief-key">NARRATIVE</div>
            <div className="sb-brief-val">Full real loop — install → onboarding → moodboard → <span className="sb-mono">/design:new</span> → canvas → <span className="sb-mono">/design:edit</span> → comments → handoff → end card.</div>
          </div>
          <div className="sb-brief-card">
            <div className="sb-brief-key">LOOK</div>
            <div className="sb-brief-val">Maude product chrome — dark cool-neutral studio (hue 255), dotted infinite canvas, ONE indigo accent, mono for part-numbers. It’s the real UI, not a fake.</div>
          </div>
          <div className="sb-brief-card">
            <div className="sb-brief-key">VOICE</div>
            <div className="sb-brief-val">Voice-aligned captions — short, dry, catalog-spine tone. Echoes the site: “Two plugins, one CLI.” · “No telemetry. No signup.”</div>
          </div>
          <div className="sb-brief-card">
            <div className="sb-brief-key">RHYTHM</div>
            <div className="sb-brief-val">Length decided by rhythm, not a clock — ≈80s draft across 13 scenes. Hooks fast, proof varied, payoff lands. No uniform 5s blocks.</div>
          </div>
        </div>

        <div className="sb-brief-rules">
          <div className="sb-brief-rule sb-brief-rule--do"><span className="sb-brief-rule-k">GROUNDED IN REAL</span> every scene traces to a real maude output (terminal / Studio / specimen / moodboard / canvas) — captured, then animated. No fabricated mocks.</div>
          <div className="sb-brief-rule sb-brief-rule--no"><span className="sb-brief-rule-k">HARD-NO</span> invented UI · corporate-deck pacing · uniform 5s blocks · documentation-walkthrough feel.</div>
        </div>

        <div className="sb-brief-strip">
          {SCENES.map((s) => (
            <span key={s.id} className={"sb-brief-chip sb-role--" + s.role}><b>{s.id}</b> {s.title}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Storyboard() {
  return (
    <div className="sd-shell">
      <div className="sd-stage sd-canvas">
        <div className="sd-info-hd">
          <div className="sd-info-brand"><BrandMark /><span className="sd-wordmark">maude</span><span className="sd-brand-sku">intro</span></div>
          <span className="sd-info-badge">v4.1 · 13 scenes · reality-grounded</span>
          <span className="sd-info-title">Storyboard — scene order</span>
          <span className="sd-info-sub">Read left→right, top→bottom = the cut. Each tile: the shot + signature + caption + the real maude output it's grounded in + how (real / faithful / illustrated).</span>
        </div>

        <div className="sb-grid">
          {SCENES.map((s) => <SceneTile key={s.id} s={s} />)}
        </div>

        <div className="sb-foot">
          <span className="sb-foot-item">1920×1080 · 30fps</span>
          <span className="sb-foot-item">captions on · voice-aligned</span>
          <span className="sb-foot-item">≈80s draft · rhythm decides</span>
          <span className="sb-foot-item">≤16MB post-loudnorm</span>
          <span className="sb-foot-item">loop-safe end card</span>
          <span className="sb-foot-spacer" />
          <span className="sb-foot-note">v4.1 rebuild map · scene 05 already rebuilt with real footage · rest faithful-rebuild next.</span>
        </div>
      </div>
    </div>
  );
}

export default function StudioIntroVideo() {
  return (
    <DesignCanvas>
      <DCSection id="intro" title="Studio Intro Video — v4" subtitle="MAUDE/INTRO · 3 artboards · brief + full storyboard + landing placement">
        <DCArtboard id="brief" label="A · brief / visual direction" width={1280} height={900}><BriefCard /></DCArtboard>
        <DCArtboard id="storyboard" label="B · full storyboard — 12 scenes" width={1280} height={1640}><Storyboard /></DCArtboard>
        <DCArtboard id="landing" label="C · main-page placement" width={1280} height={860}><LandingPlacement /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
