/**
 * @canvas      Studio Intro Video — v5.2 SHOWREEL storyboard · one beat per artboard + voiceover · maude DS, dark
 * @ds          maude
 * @platform    desktop
 * @opt_out     palette
 * @artboards   brief | s00 | s10 | s20 | s30 | s40 | s50 | s60 | s65 | s70 | s80 | s90 | s92 | s94 | s96 | s99
 * @brief       v5 pivot: a FEATURE SHOWREEL (not a tutorial). One artboard per beat, laid out as a filmstrip (pan left→right = the cut). Each artboard carries the shot mock + the ElevenLabs voiceover line + id/role/duration/source/signature/grounding. Reality-grounded — each beat traces to a real maude output. Full spec + VO script: scripts/video/v4/_showreel-script.md.
 * @stack       React 19 · TSX · Bun.build · sibling Studio Intro Video.css (every value a var(--*) token)
 * @history     .design/_history/studio-intro-video/
 *
 * Authored under the `maude` DS. Self-imports the maude tokens + shared component classes.
 */

import "../system/maude/colors_and_type.css";
import "../system/maude/preview/_components.css";
import "./Studio Intro Video.css";
import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";

/* ─────────────────────────────── icons ─────────────────────────────── */
const ICONS: Record<string, React.ReactNode> = {
  cursor: <path d="M3 2l9 4.4-4 1.1-1.1 4z" />,
  sparkle: <path d="M8 1.8l1.4 4.8L14 8l-4.6 1.4L8 14.2l-1.4-4.8L2 8l4.6-1.4z" fill="currentColor" stroke="none" />,
  check: <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />,
  message: <path d="M2.5 4.2A1.7 1.7 0 0 1 4.2 2.5h7.6A1.7 1.7 0 0 1 13.5 4.2v4.6a1.7 1.7 0 0 1-1.7 1.7H6.2L3 13V4.2z" />,
  pen: (<><path d="M10.5 2.8l2.7 2.7L6 12.7 3 13.5l.8-3z" /><line x1="9.2" y1="4.1" x2="11.9" y2="6.8" /></>),
  speaker: (<><polygon points="3 6 5.5 6 8 3.5 8 12.5 5.5 10 3 10" fill="currentColor" stroke="none" /><path d="M10.5 6a3 3 0 0 1 0 4" /><path d="M12.3 4.5a5.5 5.5 0 0 1 0 7" /></>),
  "arrow-right": (<><line x1="3" y1="8" x2="12.5" y2="8" /><polyline points="9 4.5 12.5 8 9 11.5" /></>),
  code: (<><polyline points="6 5 3 8 6 11" /><polyline points="10 5 13 8 10 11" /></>),
  download: (<><line x1="8" y1="2.5" x2="8" y2="10" /><polyline points="4.5 7 8 10.5 11.5 7" /><polyline points="3 12.8 3 13.6 13 13.6 13 12.8" /></>),
  play: <polygon points="5 3.5 12.5 8 5 12.5" fill="currentColor" stroke="none" />,
  git: (<><circle cx="4" cy="4" r="1.6" /><circle cx="4" cy="12" r="1.6" /><circle cx="12" cy="6" r="1.6" /><path d="M4 5.6v4.8M5.6 4H9a1.4 1.4 0 0 1 1.4 1.4v.6" /></>),
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
    <span className="sd-brand-mark" style={size ? { width: size, height: size, borderRadius: size * 0.27 } : undefined}>
      <svg viewBox="0 0 32 32" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" /></svg>
    </span>
  );
}
const Caret = () => <span className="sb-caret" aria-hidden="true" />;

/* mini chrome bits reused across frames */
function WinBar({ title }: { title: string }) {
  return (
    <div className="sb-wb"><i /><i /><i /><span className="sb-wb-t">{title}</span></div>
  );
}

/* ───────────────────────── per-beat frame renders (bigger, reality-grounded) ───────────────────────── */

function FrameColdOpen() {
  return (
    <div className="sb-fr sb-fr--cold">
      <span className="sb-cold-mark">maude<Caret /></span>
      <span className="sb-cold-cur"><Icon name="cursor" size={22} /></span>
    </div>
  );
}

/* 10 — questionary built on best designers + moodboard direction */
function FrameQuestionMood() {
  return (
    <div className="sb-fr sb-fr--qm">
      <div className="sb-qm-tui">
        <WinBar title="claude · scratch" />
        <div className="sb-qm-cmd"><span className="sb-tui-pr">&gt;</span> /design:setup-ds <span className="sb-tui-arg">project "…"</span></div>
        <div className="sb-qm-stage">STAGE 1 · 1 / 4</div>
        <div className="sb-qm-q">What feeling should the very first screen give someone?</div>
        <div className="sb-qm-sub">discovery built on how the best designers work</div>
      </div>
      <div className="sb-qm-arrow"><Icon name="arrow-right" size={20} /></div>
      <div className="sb-qm-board">
        <span className="sb-qm-label">MOODBOARD · direction</span>
        <div className="sb-pin-card" style={{ left: "4%", top: "20%", width: "46%", transform: "rotate(-3deg)" }}><div className="sb-pin-aa">Aa Gg</div><div className="sb-pin-row"><span style={{ background: "var(--accent)" }} /><span style={{ background: "oklch(0.62 0.20 28)" }} /><span style={{ background: "var(--fg-0)" }} /></div></div>
        <div className="sb-pin-card sb-pin-card--img" style={{ left: "54%", top: "14%", width: "38%", height: "40%", transform: "rotate(3deg)", background: "var(--bg-3)" }} />
        <div className="sb-pin-card sb-pin-card--img" style={{ left: "10%", top: "58%", width: "40%", height: "32%", transform: "rotate(2deg)", background: "var(--bg-4)" }} />
        <div className="sb-pin-card" style={{ left: "56%", top: "60%", width: "36%", transform: "rotate(-2deg)", background: "var(--accent)", color: "var(--accent-fg)" }}><div className="sb-pin-note">dense · calm · one accent</div></div>
      </div>
    </div>
  );
}

/* 20 — robust design system (editorial specimen + family) */
function FrameRobustDS() {
  return (
    <div className="sb-fr sb-fr--edi">
      <div className="sb-edi-h">Accent. <span style={{ color: "var(--accent)" }}>One indigo.</span></div>
      <div className="sb-edi-oklch">accent · oklch(0.68 0.18 268) · 6.4:1 on bg-0</div>
      <div className="sb-edi-fam">
        <span style={{ background: "var(--accent)" }} /><span style={{ background: "var(--accent-hover)" }} /><span style={{ background: "var(--accent-muted)" }} /><span style={{ background: "var(--accent-tint)" }} />
      </div>
      <div className="sb-edi-grid">
        <span className="sb-edi-spec">type scale</span><span className="sb-edi-spec">spacing</span><span className="sb-edi-spec">elevation</span>
        <span className="sb-edi-spec">motion</span><span className="sb-edi-spec">components</span><span className="sb-edi-spec">status</span>
      </div>
      <div className="sb-edi-ctx"><span className="sb-edi-btn">Primary</span><span className="sb-edi-ghost">Ghost</span><span className="sb-edi-cap">a system — not a palette</span></div>
    </div>
  );
}

/* 30 — infinite multi-artboard canvas */
function FrameCanvasPan() {
  const ab = (op: number, accent: boolean, w: string) => (
    <div className="sb-ab sb-ab--xs" style={{ opacity: op }}>
      <div className="sb-ab-bar"><i /><i /></div>
      <div className={"sb-sk" + (accent ? " sb-sk--accent" : "")} style={{ width: w }} />
      <div className="sb-sk" style={{ width: "70%" }} />
    </div>
  );
  return (
    <div className="sb-fr sb-fr--dots sb-fr--pan">
      <div className="sb-pan-row">{ab(0.5, false, "60%")}{ab(1, true, "44%")}{ab(1, false, "80%")}{ab(0.5, false, "55%")}</div>
      <span className="sb-zoom-pill">46%</span>
      <span className="sb-mm">WORLD · 6/6</span>
    </div>
  );
}

/* 40 — it draws itself (split: TUI stream / canvas fills) */
function FrameDraws() {
  return (
    <div className="sb-fr sb-fr--split">
      <div className="sb-split-l">
        <div className="sb-tui-mini"><span className="sb-tui-pr">&gt;</span> /design:new "Recipe Recap"</div>
        <div className="sb-stream"><span style={{ width: "82%" }} /><span style={{ width: "64%" }} /><span style={{ width: "73%" }} /><span className="sb-stream-live" style={{ width: "40%" }} /></div>
      </div>
      <div className="sb-split-r sb-dots">
        <div className="sb-ab">
          <div className="sb-ab-bar"><i /><i /><i /></div>
          <div className="sb-sk" style={{ width: "60%", height: 12 }} />
          <div className="sb-sk sb-sk--accent" style={{ width: "32%" }} />
          <div className="sb-sk" style={{ width: "78%" }} />
          <span className="sb-cur-agent"><Icon name="cursor" size={16} /></span>
        </div>
      </div>
    </div>
  );
}

/* 50 — it critiques itself */
function FrameCritics() {
  return (
    <div className="sb-fr sb-fr--dots sb-center">
      <div className="sb-verdict">
        <div className="sb-verdict-hd">CRITIC PANEL · 5 reviewers</div>
        <div className="sb-vrow"><span>signature</span><b>4.6</b></div>
        <div className="sb-vrow"><span>a11y</span><b className="sb-vok">pass</b></div>
        <div className="sb-vrow"><span>typography</span><b>4.4</b></div>
        <div className="sb-vrow"><span>restraint</span><b>4.8</b></div>
        <div className="sb-fix"><Icon name="check" size={13} /> auto-fix · 2 applied</div>
      </div>
    </div>
  );
}

/* 60 — THE AHA: talk to the AI through the canvas (point + comment + draw) */
function FrameTalkCanvas() {
  return (
    <div className="sb-fr sb-fr--dots sb-center">
      <div className="sb-ab sb-ab--talk">
        <div className="sb-ab-bar"><i /><i /><i /><span className="sb-ab-file">Hero.tsx</span></div>
        <div className="sb-sk" style={{ width: "64%", height: 14 }} />
        <div className="sb-halo"><div className="sb-sk sb-sk--accent" style={{ width: "100%" }} /></div>
        <svg className="sb-penmark" viewBox="0 0 60 40" aria-hidden><path d="M6 30 C 20 8, 38 8, 52 18" /><polyline points="46 14 53 18 49 25" /></svg>
        <span className="sb-annot-label"><Icon name="pen" size={11} /> make this bigger</span>
        <span className="sb-path">button.btn--primary · Hero.tsx : 42</span>
        <span className="sb-pin">1</span>
        <span className="sb-thread"><Icon name="message" size={12} /> tighten this</span>
        <span className="sb-cur-cmd"><Icon name="cursor" size={16} /><b>⌘</b></span>
      </div>
    </div>
  );
}

/* 65 — multiplayer, peer-to-peer via your hub */
function FrameMultiplayer() {
  return (
    <div className="sb-fr sb-fr--dots sb-center">
      <div className="sb-ab sb-ab--talk">
        <div className="sb-ab-bar"><i /><i /><i />
          <span className="sb-avatars"><span style={{ background: "var(--presence-agent)" }} /><span style={{ background: "var(--status-info)" }} /><span style={{ background: "var(--status-success)" }} /></span>
        </div>
        <div className="sb-sk" style={{ width: "58%" }} />
        <div className="sb-sk sb-sk--accent" style={{ width: "38%" }} />
        <div className="sb-sk" style={{ width: "72%" }} />
        <span className="sb-mp-cur" style={{ left: "20%", top: "46%", color: "var(--presence-agent)" }}><Icon name="cursor" size={16} /><b style={{ background: "var(--presence-agent)" }}>maya</b></span>
        <span className="sb-mp-cur" style={{ left: "62%", top: "60%", color: "var(--status-info)" }}><Icon name="cursor" size={16} /><b style={{ background: "var(--status-info)" }}>you</b></span>
        <span className="sb-hub-chip"><Icon name="git" size={12} /> 3 peers · your hub · no SaaS</span>
      </div>
    </div>
  );
}

/* 70 — draw as code (geometry engine) */
function FrameDrawCode() {
  return (
    <div className="sb-fr sb-fr--draw sb-center">
      <div className="sb-draw-stage">
        <span className="sb-draw-mark"><BrandMark size={92} /></span>
        {/* geometry overlay */}
        <span className="sb-draw-node" style={{ left: "50%", top: "8%" }} />
        <span className="sb-draw-node" style={{ left: "86%", top: "50%" }} />
        <span className="sb-draw-node" style={{ left: "50%", top: "92%" }} />
        <span className="sb-draw-node" style={{ left: "14%", top: "50%" }} />
      </div>
      <div className="sb-draw-meta">
        <span className="sb-draw-chip">geometry → .svg</span>
        <span className="sb-draw-chip">→ .jsx</span>
        <span className="sb-draw-chip sb-draw-chip--ok">never guessed</span>
      </div>
    </div>
  );
}

/* 80 — animate once → one .lottie, web + native */
function FrameAnimate() {
  return (
    <div className="sb-fr sb-fr--anim">
      <div className="sb-anim-src">
        <BrandMark size={56} />
        <span className="sb-anim-pulse" />
        <span className="sb-lottie-chip">one .lottie</span>
      </div>
      <div className="sb-anim-arrow"><Icon name="arrow-right" size={20} /></div>
      <div className="sb-anim-targets">
        <div className="sb-anim-dev sb-anim-dev--web"><WinBar title="web" /><span className="sb-anim-dot" /></div>
        <div className="sb-anim-dev sb-anim-dev--phone"><span className="sb-anim-dot" /><span className="sb-anim-notch" /></div>
        <span className="sb-anim-11">1:1</span>
      </div>
    </div>
  );
}

/* 90 — handoff to ANY production code */
function FrameHandoff() {
  return (
    <div className="sb-fr sb-fr--dots sb-center">
      <div className="sb-handoff">
        <div className="sb-ho-tiles">
          <div className="sb-ho-tile sb-ho-tile--accent"><Icon name="download" size={16} /><span>shadcn</span></div>
          <div className="sb-ho-tile"><Icon name="code" size={16} /><span>raw .tsx</span></div>
        </div>
        <span className="sb-ho-arrow"><Icon name="arrow-right" size={18} /></span>
        <div className="sb-ho-repo">
          <span className="sb-ho-repo-h">ANY CODEBASE · Next · Vite · Bun</span>
          <span className="sb-ho-add">+ components/recipe-recap.tsx</span>
          <span className="sb-ho-add">+ wired to your tokens</span>
        </div>
      </div>
    </div>
  );
}

/* 92 — second brain · it remembers (plan + DDR + continuity) */
function FrameMemory() {
  return (
    <div className="sb-fr sb-fr--brain">
      <div className="sb-brain-card">
        <div className="sb-brain-h">PLAN · grounded in PRD</div>
        <div className="sb-brain-li"><Icon name="check" size={11} /> tasks · scope · risks</div>
        <div className="sb-brain-li"><Icon name="check" size={11} /> acceptance criteria</div>
      </div>
      <div className="sb-brain-card sb-brain-card--ddr">
        <div className="sb-brain-h">DDR-070 · decision</div>
        <div className="sb-brain-sub">what · why · revisit-when</div>
        <div className="sb-brain-tag">institutional memory</div>
      </div>
      <div className="sb-brain-cont">pause today · resume tomorrow →</div>
    </div>
  );
}

/* 94 — the daily loop: plan → execute → done */
function FrameDailyLoop() {
  return (
    <div className="sb-fr sb-fr--loop sb-center">
      <div className="sb-loop-row">
        <span className="sb-loop-pill">/flow:plan</span>
        <Icon name="arrow-right" size={18} />
        <span className="sb-loop-pill">/flow:execute</span>
        <Icon name="arrow-right" size={18} />
        <span className="sb-loop-pill sb-loop-pill--accent">/flow:done</span>
      </div>
      <span className="sb-loop-sub">the everyday rhythm · day after day</span>
    </div>
  );
}

/* 96 — nothing slips: the full gate → PR */
function FrameGate() {
  const rows = ["security review · defender + attacker", "code review", "validation · lint · type · tests · build", "smoke tests", "5-platform scenarios"];
  return (
    <div className="sb-fr sb-fr--gate">
      <div className="sb-gate-h">EVERY SHIP RUNS THE FULL GATE</div>
      {rows.map((r) => (
        <div key={r} className="sb-gate-li"><span className="sb-gate-tick"><Icon name="check" size={11} /></span> {r}</div>
      ))}
      <div className="sb-gate-pr"><Icon name="git" size={13} /> pull request opened</div>
    </div>
  );
}

/* 99 — end card */
function FrameEndCard() {
  return (
    <div className="sb-fr sb-fr--end sb-center">
      <div className="sb-end">
        <div className="sb-end-lockup"><BrandMark size={44} /><span className="sb-end-mark">maude</span></div>
        <div className="sb-end-install">npm i -g @1agh/maude</div>
        <div className="sb-end-foot">MIT · no telemetry · no signup · the repo is the source of truth</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── scene table (15 showreel beats) ───────────────────────────── */
type Role = "hook" | "make" | "smart" | "aha" | "collab" | "range" | "ship" | "brain" | "closer";
type Src = "real" | "faithful" | "illustrate";
type Scene = { id: string; role: Role; src: Src; dur: string; title: string; sig: string; vo: string; ref: string; Frame: () => React.ReactElement };

const SCENES: Scene[] = [
  { id: "00", role: "hook", src: "faithful", dur: "≈4s", title: "Cold open", sig: "Caret pulses alone on the void → wordmark types in", vo: "Every design tool wants you to leave your code… this one doesn't.", ref: "wordmark + dotted canvas", Frame: FrameColdOpen },
  { id: "10", role: "make", src: "faithful", dur: "≈8s", title: "Questionary + moodboard", sig: "Designer-grade discovery → a moodboard shows the direction", vo: "It starts the way the best designers do — with the right questions. It researches. Then it shows you a moodboard: here's the direction.", ref: "/design:setup-ds + .design/_moodboard", Frame: FrameQuestionMood },
  { id: "20", role: "make", src: "faithful", dur: "≈7s", title: "Robust design system", sig: "Editorial specimens — a full tokenized system, not a palette", vo: "Then it builds the whole system. Color, type, space, motion, components. Tokenized, consistent — yours.", ref: "system/maude/preview/* specimens", Frame: FrameRobustDS },
  { id: "30", role: "make", src: "faithful", dur: "≈5s", title: "The canvas", sig: "Camera flies the real infinite multi-artboard canvas", vo: "On an infinite canvas. Your whole product, every screen — inside Claude Code.", ref: "real Canvas Viewport / Studio", Frame: FrameCanvasPan },
  { id: "40", role: "make", src: "faithful", dur: "≈7s", title: "It draws itself", sig: "TUI streams left, the canvas fills live right", vo: "Describe a screen. Watch it build itself. Real components, real tokens, real code.", ref: "real Studio chrome + canvas fill", Frame: FrameDraws },
  { id: "50", role: "smart", src: "illustrate", dur: "≈6s", title: "It critiques itself", sig: "Verdict scores resolve + auto-fix loop ticks", vo: "Then critics score it — accessibility, type, restraint — and it fixes what it finds.", ref: "critic PANEL.md shape", Frame: FrameCritics },
  { id: "60", role: "aha", src: "faithful", dur: "≈9s", title: "✦ Talk through the canvas", sig: "Point (⌘+click) · comment on a pixel · draw → it acts", vo: "And here's what changes everything. You don't write prompts. You point at the design. Drop a note on a pixel. Draw on it. And it just… gets it.", ref: "real Studio inspector + comments + annotations", Frame: FrameTalkCanvas },
  { id: "65", role: "collab", src: "faithful", dur: "≈7s", title: "Multiplayer", sig: "Live presence cursors · peer-to-peer · your own hub", vo: "And you're not alone on it. Live cursors, real-time — shared peer to peer, through a hub you host. No SaaS. No signup.", ref: "maude hub serve + bidirectional sync", Frame: FrameMultiplayer },
  { id: "70", role: "range", src: "faithful", dur: "≈6s", title: "Draw as code", sig: "Geometry engine — vectors computed, never guessed", vo: "Logos, icons, diagrams — drawn by a geometry engine. Never guessed.", ref: "real /design:draw engine (DDR-070)", Frame: FrameDrawCode },
  { id: "80", role: "range", src: "faithful", dur: "≈6s", title: "Animate once", sig: "One .lottie — web + native, pixel for pixel", vo: "Animate once. Ship one file — web and native, pixel for pixel.", ref: "real /design:to-lottie (DDR-094)", Frame: FrameAnimate },
  { id: "90", role: "ship", src: "faithful", dur: "≈5s", title: "Handoff to any code", sig: "A component lands in any codebase, wired to your tokens", vo: "Then hand it off — into any production codebase. Next, Vite, Bun, or raw code — wired to your tokens.", ref: "real handoff / export (registry + raw)", Frame: FrameHandoff },
  { id: "92", role: "brain", src: "faithful", dur: "≈6s", title: "Second brain · remembers", sig: "PRD plan + DDR decisions + pause/resume", vo: "And it remembers. Plans grounded in your spec. Every decision written down. Stop today, pick it up tomorrow — right where you left off.", ref: "/flow:plan + .ai/decisions + pause/resume", Frame: FrameMemory },
  { id: "94", role: "brain", src: "faithful", dur: "≈5s", title: "The daily loop", sig: "plan → execute → done, day after day", vo: "Then it's just the rhythm. Plan. Execute. Done. Day after day.", ref: "flow daily verbs", Frame: FrameDailyLoop },
  { id: "96", role: "brain", src: "faithful", dur: "≈7s", title: "Nothing slips through", sig: "security · review · validation · smoke · scenarios → PR", vo: "And nothing slips. Security review, code review, validation, smoke tests, five-platform scenarios — every time. Then the pull request opens.", ref: "/flow:done gate + scenario-runner + security agents", Frame: FrameGate },
  { id: "99", role: "closer", src: "faithful", dur: "≈4s", title: "End card", sig: "Brand lockup + install + trust line, loop-safe", vo: "maude. No telemetry. No signup. The repo is the source of truth.", ref: "real logo.tsx mark", Frame: FrameEndCard },
];

const ROLE_LABEL: Record<Role, string> = { hook: "HOOK", make: "MAKE", smart: "SMART", aha: "✦ AHA", collab: "COLLAB", range: "RANGE", ship: "SHIP", brain: "SECOND BRAIN", closer: "CLOSER" };
const SRC_LABEL: Record<Src, string> = { real: "● REAL CAPTURE", faithful: "◆ FAITHFUL", illustrate: "○ ILLUSTRATED" };

/* one full artboard per beat: header + big frame + voiceover bar */
function StoryArt({ s, n, total }: { s: Scene; n: number; total: number }) {
  const { Frame } = s;
  return (
    <div className="sd-shell sb-art">
      <div className="sb-art-hd">
        <span className="sb-art-id">{s.id}</span>
        <span className="sb-art-title">{s.title}</span>
        <span className={"sb-art-role sb-role--" + s.role}>{ROLE_LABEL[s.role]}</span>
        <span className="sb-art-spacer" />
        <span className={"sb-tile-src sb-src--" + s.src}>{SRC_LABEL[s.src]}</span>
        <span className="sb-art-dur">{s.dur}</span>
        <span className="sb-art-seq">{n} / {total}</span>
      </div>

      <div className="sb-art-stage"><Frame /></div>

      <div className="sb-art-sig"><span className="sb-art-sig-k">◆ signature</span> {s.sig} <span className="sb-art-ref">· grounded in {s.ref}</span></div>

      <div className="sb-art-vo">
        <span className="sb-art-vo-icon"><Icon name="speaker" size={18} /></span>
        <span className="sb-art-vo-k">VO</span>
        <span className="sb-art-vo-line">“{s.vo}”</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────── cover ─────────────────────────────── */
function BriefCard() {
  return (
    <div className="sd-shell">
      <div className="sd-stage sb-brief sd-canvas">
        <div className="sb-brief-eyebrow"><BrandMark /> <span>MAUDE / INTRO FILM</span> <span className="sb-brief-ver">v5.2 · showreel</span></div>
        <h1 className="sb-brief-h1">The top features, in one cinematic take.</h1>
        <p className="sb-brief-lede">A showreel, not a tutorial. 15 beats — pan left→right to watch the cut. Each artboard is the shot + the ElevenLabs voiceover line + what real maude output it's grounded in. Full script: <span className="sb-mono">scripts/video/v4/_showreel-script.md</span>.</p>

        <div className="sb-brief-grid">
          <div className="sb-brief-card"><div className="sb-brief-key">SHAPE</div><div className="sb-brief-val">15 beats · ≈90 s · hard cuts · maude dark studio. Pan the filmstrip = the sequence.</div></div>
          <div className="sb-brief-card"><div className="sb-brief-key">ARC</div><div className="sb-brief-val">design system from a conversation → canvas → it builds → ✦ you direct it through the canvas → multiplayer → vector + motion → ships → a second brain.</div></div>
          <div className="sb-brief-card"><div className="sb-brief-key">VOICE</div><div className="sb-brief-val">ElevenLabs — dry, confident, anti-corporate. ~195 words ≈ 80 s. EN + CZ in the script.</div></div>
          <div className="sb-brief-card"><div className="sb-brief-key">GROUNDED</div><div className="sb-brief-val">Every beat traces to a real maude output (captured terminal / Studio / specimen / moodboard). No fabricated mocks.</div></div>
        </div>

        <div className="sb-brief-strip">
          {SCENES.map((s) => (<span key={s.id} className={"sb-brief-chip sb-role--" + s.role}><b>{s.id}</b> {s.title}</span>))}
        </div>
      </div>
    </div>
  );
}

export default function StudioIntroVideo() {
  return (
    <DesignCanvas>
      <DCSection id="showreel" title="Studio Intro Video — v5.2 showreel" subtitle="MAUDE/INTRO · cover + 15 beats · one artboard per beat · voiceover inline">
        <DCArtboard id="brief" label="Cover · brief" width={1280} height={860}><BriefCard /></DCArtboard>
        {SCENES.map((s, i) => (
          <DCArtboard key={s.id} id={"s" + s.id} label={`${s.id} · ${s.title}`} width={1280} height={860}>
            <StoryArt s={s} n={i + 1} total={SCENES.length} />
          </DCArtboard>
        ))}
      </DCSection>
    </DesignCanvas>
  );
}
