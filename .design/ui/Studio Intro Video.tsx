/**
 * @canvas      Studio Intro Video — the v3 intro film for the Maude landing · player placement + storyboard/shot list · maude DS, dark
 * @ds          maude
 * @platform    desktop
 * @opt_out     palette
 * @artboards   landing | storyboard
 * @brief       Extracted from Studio Docs — the intro video lives on the main page (landing); this canvas is the player placement + the v3 storyboard / shot list / script.
 * @stack       React 19 · TSX · Bun.build · sibling Studio Intro Video.css (every value a var(--*) token)
 * @history     .design/_history/studio-intro-video/
 *
 * Authored under the `maude` DS. Self-imports the maude tokens + shared component
 * classes so it renders in maude regardless of host injection (the Studio.tsx prior).
 */

import "../system/maude/colors_and_type.css";
import "../system/maude/preview/_components.css";
import "./Studio Intro Video.css";
import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";

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
};
function Icon({ name, size = 16, className, style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
function BrandMark() {
  return (
    <span className="sd-brand-mark">
      <svg viewBox="0 0 32 32" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" /></svg>
    </span>
  );
}

function Player({ fixed = false }: { fixed?: boolean }) {
  return (
    <div className={"sd-player" + (fixed ? " sd-player--fixed" : "")}>
      <div className="sd-player-stage">
        <button type="button" className="sd-play" aria-label="Play intro video"><Icon name="play" size={30} /></button>
      </div>
      <div className="sd-player-title">Maude in 38 seconds<small>v3 · re-cut · captions on</small></div>
      <span className="sd-player-badge">intro · v3</span>
      <div className="sd-player-cap">“The repo is the source of truth.”</div>
      <div className="sd-scrub">
        <button type="button" className="sd-scrub-ic" aria-label="Play"><Icon name="play" size={14} /></button>
        <button type="button" className="sd-scrub-ic" aria-label="Mute"><Icon name="volume" size={14} /></button>
        <div className="sd-scrub-track" aria-hidden="true">
          <div className="sd-scrub-fill" />
          <span className="sd-scrub-chap" style={{ left: "24%" }} />
          <span className="sd-scrub-chap" style={{ left: "58%" }} />
          <span className="sd-scrub-chap" style={{ left: "82%" }} />
        </div>
        <span className="sd-scrub-time">0:14 / 0:38</span>
        <button type="button" className="sd-scrub-ic" aria-label="Captions"><Icon name="cc" size={14} /></button>
        <button type="button" className="sd-scrub-ic" aria-label="Fullscreen"><Icon name="expand" size={14} /></button>
      </div>
    </div>
  );
}

/* ── A · main-page placement ── */
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
        <span className="sd-bar-right">v0.28.1 · MIT</span>
      </div>
      <div className="sd-stage sd-canvas">
        <div className="sd-hero-eyebrow"><Icon name="play" size={12} /> WATCH · 38 SECONDS</div>
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

/* ── B · storyboard / shot list / script ── */
function MiniArtboard({ filled = 0, cursor = false }: { filled?: number; cursor?: boolean }) {
  return (
    <div className="sd-mini-ab">
      <div className="sd-mini-bar"><span className="sd-mini-dot" /><span className="sd-mini-dot" /><span className="sd-mini-dot" /></div>
      {filled >= 1 ? <div className="sd-mini-sk" style={{ width: "58%" }} /> : null}
      {filled >= 2 ? <div className="sd-mini-sk sd-mini-sk--accent" style={{ width: "34%", height: 8 }} /> : null}
      {filled >= 2 ? <div className="sd-mini-sk" style={{ width: "82%" }} /> : null}
      {filled >= 3 ? <div className="sd-mini-sk" style={{ width: "70%" }} /> : null}
      {cursor ? <span className="sd-mini-cursor" style={{ right: 14, bottom: 16 }}><Icon name="cursor" size={14} /></span> : null}
    </div>
  );
}

const SHOTS = [
  { t: "00:00", title: "The blank canvas", vo: "“You start with nothing. A dotted canvas and an idea.”", frame: <div className="sd-mini-ab" style={{ alignItems: "center", justifyContent: "center", borderStyle: "dashed", background: "transparent" }}><Icon name="sparkle" size={20} style={{ color: "var(--fg-2)" }} /></div> },
  { t: "00:09", title: "The agent draws", vo: "“Describe it. The agent fills the canvas while you watch — presence cursor and all.”", frame: <MiniArtboard filled={2} cursor /> },
  { t: "00:22", title: "Critics score it", vo: "“A panel of critics scores it — signature, a11y, restraint. It fixes itself.”", frame: (
    <div className="sd-mini-verdict">
      <div className="sd-mini-vrow"><span>signature</span><span className="sd-mini-vok">4.6 / 5</span></div>
      <div className="sd-mini-vrow"><span>a11y</span><span className="sd-mini-vok">pass</span></div>
      <div className="sd-mini-vrow"><span>restraint</span><span className="sd-mini-vok">ok</span></div>
      <div className="sd-mini-vrow" style={{ color: "var(--accent)" }}><span>verdict</span><span>solid</span></div>
    </div>
  ) },
  { t: "00:31", title: "Hand it off", vo: "“Then hand off — shadcn registry, PNG, code. Straight into the repo.”", frame: (
    <div className="sd-mini-ab" style={{ alignItems: "center", justifyContent: "center", gap: 6 }}>
      <span className="tag" style={{ fontSize: "var(--type-xs)" }}><Icon name="download" size={11} /> shadcn</span>
      <span className="tag" style={{ fontSize: "var(--type-xs)" }}><Icon name="code" size={11} /> code</span>
    </div>
  ) },
];

const CHAPTERS = [
  { t: "0:00", name: "Cold open — the blank canvas", vo: "Dotted canvas, one cursor. No UI chrome yet." },
  { t: "0:09", name: "The agent draws", vo: "Prompt lands, frames fill, presence cursor moves." },
  { t: "0:22", name: "Critics score it", vo: "Verdict card animates in; auto-fix loop ticks." },
  { t: "0:31", name: "Hand off", vo: "Export sheet → shadcn registry → code in repo." },
  { t: "0:38", name: "End card", vo: "Wordmark + “npm i -g @1agh/maude”." },
];

function Storyboard() {
  return (
    <div className="sd-shell">
      <div className="sd-stage sd-canvas">
        <div className="sd-info-hd">
          <div className="sd-info-brand"><BrandMark /><span className="sd-wordmark">maude</span><span className="sd-brand-sku">intro</span></div>
          <span className="sd-info-badge">v3 · storyboard</span>
          <span className="sd-info-title">Shot list &amp; script</span>
          <span className="sd-info-sub">A 38-second cold-open-to-handoff cut for the landing hero.</span>
        </div>

        <div className="sd-board-body">
          <div>
            <div className="sd-sb-label">Storyboard — 4 keyframes <span className="sd-rule" /></div>
            <div className="sd-storyboard">
              {SHOTS.map((s) => (
                <div key={s.t} className="sd-shot">
                  <div className="sd-shot-frame"><span className="sd-shot-num">{s.t}</span>{s.frame}</div>
                  <div className="sd-shot-body">
                    <div className="sd-shot-title">{s.title}</div>
                    <div className="sd-shot-vo">{s.vo}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sd-sb-label" style={{ marginTop: "var(--space-6)" }}>Player — landing placement <span className="sd-rule" /></div>
            <Player fixed />
          </div>

          <div className="sd-script">
            <div className="sd-script-hd">Chapters &amp; voiceover</div>
            {CHAPTERS.map((c) => (
              <div key={c.t} className="sd-chapter">
                <span className="sd-chapter-t">{c.t}</span>
                <div className="sd-chapter-b">
                  <span className="sd-chapter-name">{c.name}</span>
                  <span className="sd-chapter-vo">{c.vo}</span>
                </div>
              </div>
            ))}
            <div className="sd-specs">
              <span className="sd-spec">1080p · 38s</span>
              <span className="sd-spec">captions on</span>
              <span className="sd-spec">no voiceover music bed</span>
              <span className="sd-spec">loop-safe end card</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudioIntroVideo() {
  return (
    <DesignCanvas>
      <DCSection id="intro" title="Studio Intro Video — v3" subtitle="MAUDE/INTRO · 2 artboards · landing placement + storyboard">
        <DCArtboard id="landing" label="A · main-page placement" width={1280} height={860}><LandingPlacement /></DCArtboard>
        <DCArtboard id="storyboard" label="B · storyboard & script" width={1280} height={860}><Storyboard /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
