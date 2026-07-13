/**
 * @canvas      How to make video · seeded into every new project (scaffold-design.ts) · 7 artboards, one per video capability
 * @ds          maude
 * @platform    desktop
 * @opt_out     palette
 * @artboards   start-video-comp | timeline | ai-assistant-video | footage-to-cut | generate-video-audio | captions | export
 * @brief       A "how to make video" reference canvas seeded alongside How to use Maude.tsx on every new project. One artboard per capability cluster: what a video-comp is, the Timeline, the Assistant for video, turning raw footage into a cut, AI video/audio generation, automatic captions (whisper.cpp / cloud), export. Honest inline mini-mockups, no live screenshots.
 * @stack       React 19 · TSX · Bun.build · css_mode=inline (matches Welcome.tsx's seeded-canvas precedent)
 * @history     .design/_history/how-to-make-video/
 *
 * Genuinely self-contained (no DS import) — same reasoning as How to use
 * Maude.tsx: this is seeded into a brand-new project before any design
 * system exists, so it can't rely on `system/maude/` being present. Token
 * VALUES are copied from system/maude/colors_and_type.css's dark theme and
 * applied as inline custom properties on `Board`.
 */

import { DCArtboard, DCSection, DesignCanvas } from "@maude/canvas-lib";

// Copied from system/maude/colors_and_type.css (dark theme) — kept in sync
// by eye with How to use Maude.tsx's identical block (a fixed onboarding
// surface, not a living DS specimen).
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
  "--radius-sm": "5px",
  "--radius-md": "7px",
  "--radius-lg": "10px",
  "--space-2": "4px",
  "--space-3": "8px",
  "--space-4": "12px",
  "--space-5": "16px",
  "--space-6": "24px",
  "--space-7": "32px",
  "--font-display": '"Inter Tight", "Inter", system-ui, -apple-system, sans-serif',
  "--font-body": '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  "--font-mono": '"JetBrains Mono", "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
  "--type-xs": "11px",
  "--type-sm": "12px", "--lh-sm": "18px",
  "--type-base": "14px",
  "--type-md": "16px", "--lh-md": "24px",
  "--type-2xl": "28px",
  "--tracking-tight": "-0.014em",
  "--tracking-wide": "0.04em",
} as React.CSSProperties;

/* ── Icon set ── */
const ICONS: Record<string, React.ReactNode> = {
  play: <polygon points="5 3.5 12.5 8 5 12.5" fill="currentColor" stroke="none" />,
  pause: (<><rect x="4.5" y="3.5" width="2.2" height="9" rx="0.6" fill="currentColor" stroke="none" /><rect x="9.3" y="3.5" width="2.2" height="9" rx="0.6" fill="currentColor" stroke="none" /></>),
  film: (<><rect x="2.5" y="3" width="11" height="10" rx="1.4" /><line x1="5.5" y1="3" x2="5.5" y2="13" /><line x1="10.5" y1="3" x2="10.5" y2="13" /></>),
  scissors: (<><circle cx="4.2" cy="4.2" r="1.7" /><circle cx="4.2" cy="11.8" r="1.7" /><line x1="5.5" y1="5.3" x2="13" y2="13" /><line x1="5.5" y1="10.7" x2="13" y2="3" /></>),
  message: <path d="M2.5 4.2A1.7 1.7 0 0 1 4.2 2.5h7.6A1.7 1.7 0 0 1 13.5 4.2v4.6a1.7 1.7 0 0 1-1.7 1.7H6.2L3 13V4.2z" />,
  folder: <path d="M2 4.5h4l1.3 1.5H14V13H2z" />,
  eye: (<><path d="M1.5 8s2.3-4.5 6.5-4.5S14.5 8 14.5 8s-2.3 4.5-6.5 4.5S1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></>),
  sparkle: <path d="M8 1.8l1.4 4.8L14 8l-4.6 1.4L8 14.2l-1.4-4.8L2 8l4.6-1.4z" fill="currentColor" stroke="none" />,
  volume: (<><polygon points="3 6 5.5 6 8 3.5 8 12.5 5.5 10 3 10" fill="currentColor" stroke="none" /><path d="M10.5 6a3 3 0 0 1 0 4" /></>),
  waveform: (<><line x1="2" y1="8" x2="2" y2="8" /><line x1="4" y1="5" x2="4" y2="11" /><line x1="6" y1="3" x2="6" y2="13" /><line x1="8" y1="6" x2="8" y2="10" /><line x1="10" y1="2" x2="10" y2="14" /><line x1="12" y1="5" x2="12" y2="11" /><line x1="14" y1="7" x2="14" y2="9" /></>),
  captions: (<><rect x="2" y="4" width="12" height="8" rx="1.4" /><line x1="4.5" y1="7" x2="8" y2="7" /><line x1="4.5" y1="9.3" x2="10.5" y2="9.3" /></>),
  download: (<><line x1="8" y1="2.5" x2="8" y2="10" /><polyline points="4.5 7 8 10.5 11.5 7" /><polyline points="3 12.8 3 13.6 13 13.6 13 12.8" /></>),
  check: <polyline points="3 8.2 6.4 11.5 13 4.2" />,
  wand: (<><path d="M2.5 13.5 9 7" /><path d="M10 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor" stroke="none" /></>),
  drag: (<><circle cx="6" cy="4.5" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="4.5" r="1" fill="currentColor" stroke="none" /><circle cx="6" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="6" cy="11.5" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="11.5" r="1" fill="currentColor" stroke="none" /></>),
};
function Icon({ name, size = 16, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      {ICONS[name]}
    </svg>
  );
}

/* ── Shared chrome (same shapes as How to use Maude.tsx) ── */
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
function Chip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: "var(--radius-pill, 999px)", border: "1px solid var(--border-default)", background: "var(--bg-2)", color: "var(--fg-1)", fontSize: "var(--type-xs)", ...style }}>{children}</span>;
}
function PrimaryButton({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: "var(--radius-sm)", border: "1px solid transparent", background: "var(--accent)", color: "var(--bg-0)", fontSize: "var(--type-sm)", fontWeight: 600, cursor: "pointer", ...style }}>{children}</button>;
}

/* ─────────────────────── 01 · Start a video comp ──────────────────────── */
function ArtStartVideoComp() {
  return (
    <Board>
      <ArtHeader n={1} total={7} eyebrow="Video" title="Start a video comp" />
      <Body>
        <Lede>A video comp is a canvas artboard whose body is a real Remotion composition — you author it in TSX like any other canvas, but every animated value is a function of a frame number, so it plays back, scrubs, and exports frame-perfect.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 260, height: 150, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <MiniPanelHd label="VIDEO COMP" right={<span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="film" size={12} /> 0:04</span>} />
            <div style={{ flex: 1, margin: "var(--space-3)", borderRadius: "var(--radius-md)", background: "#000", display: "grid", placeItems: "center" }}>
              <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-tint)", display: "grid", placeItems: "center" }}><Icon name="play" size={16} style={{ color: "var(--accent)" }} /></span>
            </div>
          </Panel>
          <CardRow>
            <FeatureCard icon="film" title="Ask for it in words" body="&ldquo;Cut these three clips together with a crossfade and a title card&rdquo; — the Assistant writes the comp." />
            <FeatureCard icon="play" title="Free scrub & preview" body="A real embedded player, right in the canvas — no separate render just to check a frame." />
            <FeatureCard icon="download" title="Export MP4 or GIF" body="⌘E, or /design:export mp4 — through Maude's own capture spine. No renderer install, no native binaries." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ────────────────────────── 02 · Edit on the Timeline ─────────────────── */
function ArtTimeline() {
  const clips = [
    { w: 90, label: "intro" },
    { w: 140, label: "clip-a" },
    { w: 110, label: "clip-b" },
    { w: 70, label: "outro" },
  ];
  return (
    <Board>
      <ArtHeader n={2} total={7} eyebrow="Video" title="Edit on the Timeline" />
      <Body>
        <Lede>Open the Timeline panel to hand-edit a comp: drag a clip to retime it, right-click to trim, reorder, replace, or remove — every change lands back in real, readable TSX source.</Lede>
        <Panel style={{ padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: "var(--space-3)" }}>
            <Icon name="play" size={13} />
            <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: "var(--type-xs)", color: "var(--fg-3)" }}>00:00 / 00:12</span>
          </div>
          <div style={{ display: "flex", height: 44, borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-default)" }}>
            {clips.map((c, i) => (
              <div key={c.label} style={{ width: c.w, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: i % 2 === 0 ? "var(--bg-2)" : "var(--bg-3)", borderRight: i < clips.length - 1 ? "1px solid var(--border-subtle)" : "none", fontSize: "var(--type-xs)", fontFamily: "var(--font-mono)", color: "var(--fg-1)" }}>
                <Icon name="drag" size={11} style={{ color: "var(--fg-3)" }} /> {c.label}
              </div>
            ))}
          </div>
        </Panel>
        <CardRow>
          <FeatureCard icon="drag" title="Drag to retime" body="Move, trim, or resize a clip directly on the track — the underlying frame math updates with it." />
          <FeatureCard icon="scissors" title="Split, reorder, replace" body="Right-click for the full clip menu — the same vocabulary as a real NLE, scoped to what a comp needs." />
          <FeatureCard icon="eye" title="Inspect any clip" body="Select a clip to see its layer decomposition — video track, caption track, effects — each independently editable." />
        </CardRow>
      </Body>
    </Board>
  );
}

/* ───────────────────── 03 · AI Assistant for video ─────────────────────── */
function ArtAiAssistantVideo() {
  return (
    <Board>
      <ArtHeader n={3} total={7} eyebrow="Video" title="AI Assistant for video" />
      <Body>
        <Lede>Ask for beats, transitions, and motion graphics in plain language — the Assistant writes real Remotion, frame-driven and deterministic, never a CSS animation that would tear on export.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 320, flexShrink: 0 }}>
            <MiniPanelHd label="ASSISTANT" />
            <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ alignSelf: "flex-end", maxWidth: "85%", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--accent-tint)", fontSize: "var(--type-sm)" }}>Add a kinetic-type title card, then crossfade into the first clip</div>
              <div style={{ maxWidth: "90%", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--bg-2)", fontSize: "var(--type-sm)", color: "var(--fg-1)" }}>Added a per-letter spring-in title, 18-frame crossfade into clip-a. Want a chromatic-split flourish on the title too?</div>
            </div>
          </Panel>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ fontSize: "var(--type-xs)", fontFamily: "var(--font-mono)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--fg-3)" }}>Prompt ideas</div>
            {["Crossfade these three clips with a music bed", "Add a lower-third caption to every clip", "Cinematic grade — teal/orange, subtle grain", "Ken-Burns push on the hero shot", "Kinetic-type title, per-letter spring-in"].map((p) => (
              <div key={p} style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "var(--bg-1)", border: "1px solid var(--border-subtle)", fontSize: "var(--type-sm)", color: "var(--fg-1)" }}>"{p}"</div>
            ))}
          </div>
        </div>
      </Body>
    </Board>
  );
}

/* ───────────────────── 04 · Turn footage into a cut ────────────────────── */
function ArtFootageToCut() {
  return (
    <Board>
      <ArtHeader n={4} total={7} eyebrow="Video" title="Turn a folder of clips into a cut" />
      <Body>
        <Lede>Drop a folder of raw footage on the canvas and ask for a reel. An analyst watches every clip first — good moments, subject, motion, quality — then a director assembles an edit decision list before a single frame of comp code is written.</Lede>
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
          {[["folder", "Raw clips"], ["eye", "Analyst watches"], ["wand", "Director cuts"], ["film", "Comp generated"]].map(([icon, label], i, arr) => (
            <div key={label as string} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", width: 100 }}>
                <span style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: "var(--radius-md)", background: "var(--bg-1)", border: "1px solid var(--border-default)", color: "var(--accent)" }}><Icon name={icon as string} size={18} /></span>
                <span style={{ fontSize: "var(--type-xs)", textAlign: "center", color: "var(--fg-2)" }}>{label}</span>
              </div>
              {i < arr.length - 1 ? <span style={{ color: "var(--fg-3)" }}>→</span> : null}
            </div>
          ))}
        </div>
        <CardRow>
          <FeatureCard icon="eye" title="It watches before it cuts" body="Every clip gets characterized — good-moment ranges, mood, quality score — before any editing decision is made." />
          <FeatureCard icon="wand" title="A real edit decision list" body="Beats, transitions, and an optional music bed — a story, not just clips concatenated in folder order." />
          <FeatureCard icon="film" title="Then it becomes a comp" body="The EDL turns into real, hand-editable TSX on the Timeline — pull a different shot, retime a beat, it's all still yours." />
        </CardRow>
      </Body>
    </Board>
  );
}

/* ─────────────────── 05 · Generate video & audio ────────────────────────── */
function ArtGenerateVideoAudio() {
  return (
    <Board>
      <ArtHeader n={5} total={7} eyebrow="AI media" title="Generate video & audio with your own key" />
      <Body>
        <Lede>Bring your own key and fill a gap without hand-sourcing it — a generated clip drops into your assets like real footage, and Maude checks what you've already made before spending a new generation.</Lede>
        <CardRow>
          <FeatureCard icon="film" title="Video — text or seeded" body="A prompt, or seed a clip from a still you already generated so it matches your hero's look. Runs in the background." />
          <FeatureCard icon="waveform" title="Music, SFX & voiceover" body="One key covers music beds, sound effects, and text-to-speech — the track lands ready to drop under a reel." />
          <FeatureCard icon="check" title="Reuse before you pay" body="Before spending credits, Maude searches audio you've already generated (and your provider history) for a match." />
        </CardRow>
      </Body>
    </Board>
  );
}

/* ──────────────────────────── 06 · Captions ──────────────────────────────── */
function ArtCaptions() {
  return (
    <Board>
      <ArtHeader n={6} total={7} eyebrow="Video" title="Automatic captions" />
      <Body>
        <Lede>Subtitles are free and need no key — whisper.cpp runs locally (one-click model download) and writes word-timed captions on any clip. Prefer a cloud engine? Pick ElevenLabs Scribe or Groq in Settings — Maude never silently switches you to a paid engine.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 300, flexShrink: 0 }}>
            <div style={{ height: 90, background: "#000", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "var(--space-3)" }}>
              <span style={{ padding: "4px 10px", borderRadius: "var(--radius-sm)", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "var(--type-sm)" }}>the canvas fills in <b>live</b></span>
            </div>
            <div style={{ padding: "var(--space-3)", display: "flex", gap: "var(--space-2)" }}>
              <Chip>local · whisper.cpp</Chip>
              <Chip>cloud · Scribe</Chip>
            </div>
          </Panel>
          <CardRow>
            <FeatureCard icon="captions" title="Word-timed & editable" body="Captions land as an editable JSON sidecar — whisper mishears jargon sometimes, so patch it by hand and re-render, no re-transcribing." />
            <FeatureCard icon="check" title="Auto-converts your file" body="Any video container works — Maude handles the audio extraction, no ffmpeg wrangling." />
            <FeatureCard icon="sparkle" title="You choose the engine" body="Local, Scribe, or Groq — an explicit setting, never a silent default to a paid cloud engine." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

/* ────────────────────────────── 07 · Export ────────────────────────────── */
function ArtExport() {
  return (
    <Board>
      <ArtHeader n={7} total={7} eyebrow="Ship it" title="Export" />
      <Body>
        <Lede>⌘E opens the export dialog — MP4 (H.264) or palette-quantized GIF, resolved from the comp's own frame rate and duration. Everything renders through Maude's own capture spine: no renderer binaries, no install step for whoever opens the project next.</Lede>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Panel style={{ width: 260, padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Chip style={{ background: "var(--accent-tint)", color: "var(--accent)", borderColor: "var(--accent-muted)" }}>MP4</Chip>
              <Chip>GIF</Chip>
            </div>
            <PrimaryButton style={{ alignSelf: "flex-start" }}><Icon name="download" size={13} /> Export ⌘E</PrimaryButton>
          </Panel>
          <CardRow>
            <FeatureCard icon="download" title="No install, ever" body="Rendering happens through the same headless capture Maude already uses for screenshots — nothing new to set up." />
            <FeatureCard icon="film" title="Frame-accurate" body="fps and duration come straight from the comp's own meta — what you scrub in the Player is exactly what exports." />
            <FeatureCard icon="check" title="Same command, from the CLI" body="/design:export mp4 --scope artboard works headlessly too — useful once a cut is part of a repeatable pipeline." />
          </CardRow>
        </div>
      </Body>
    </Board>
  );
}

export default function Canvas() {
  return (
    <DesignCanvas>
      <DCSection id="how-to-make-video" title="How to make video" subtitle="REFERENCE · 7 artboards, one per video capability">
        <DCArtboard id="start-video-comp" label="01 · Start a video comp" width={1040} height={640}><ArtStartVideoComp /></DCArtboard>
        <DCArtboard id="timeline" label="02 · Edit on the Timeline" width={1040} height={640}><ArtTimeline /></DCArtboard>
        <DCArtboard id="ai-assistant-video" label="03 · AI Assistant for video" width={1040} height={640}><ArtAiAssistantVideo /></DCArtboard>
        <DCArtboard id="footage-to-cut" label="04 · Footage into a cut" width={1040} height={640}><ArtFootageToCut /></DCArtboard>
        <DCArtboard id="generate-video-audio" label="05 · Generate video & audio" width={1040} height={640}><ArtGenerateVideoAudio /></DCArtboard>
        <DCArtboard id="captions" label="06 · Automatic captions" width={1040} height={640}><ArtCaptions /></DCArtboard>
        <DCArtboard id="export" label="07 · Export" width={1040} height={640}><ArtExport /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
