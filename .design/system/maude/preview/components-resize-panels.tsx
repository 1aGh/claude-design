/**
 * SPECIMEN: components-resize-panels
 * DEMONSTRATES: draggable split-pane resizers between layers / canvas / inspector,
 *   the resize-handle affordance (1px visible seam + wide hit area, cursor col-resize),
 *   min/max width clamps, double-click snap-to-default, a LIVE useState splitter that
 *   drags the inspector width — and the proof that the ONE shared chrome material
 *   (--bg-1 panels, --border-default hairlines, --radius-md) holds across every resize.
 * COMPOSITION: a working studio shell (layers | dotted canvas | inspector) with two
 *   live grips, a live width readout in mono, then a constraints table + handle anatomy.
 * COPY VOICE: terse domain nouns — layers, canvas, inspector, node, properties.
 * WHEN SCAFFOLDED: platform-desktop. The splitter is the desktop-native affordance the
 *   studio leans on; the material-cohesion claim is what this specimen proves under stress.
 * NOTES: drag is pointer-driven and compositor-safe — we only mutate a CSS custom
 *   property (--insp-w) on a grid column, never animate width per-frame. The grip's
 *   accent flash is a color transition (compositor-safe), reduced-motion collapses --dur-flip.
 *   No @keyframes; the only motion is the user's own pointer. Coordinates stay in mono.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import "./components-resize-panels.css";

/* 1px-stroke geometric glyphs — terminal/IDE heritage, never emoji. */
const Glyph = {
  layers: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5 14 5.5 8 8.5 2 5.5 8 2.5Z" /><path d="M2.5 8.5 8 11.2 13.5 8.5" />
    </svg>
  ),
  canvas: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" /><path d="M5.5 3.5v9M2.5 7h11" />
    </svg>
  ),
  inspector: (
    <svg className="g" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" /><path d="M9.5 3.5v9M5 7h2M5 9.5h2" />
    </svg>
  ),
  grip: (
    <svg className="g grip-g" viewBox="0 0 6 18" aria-hidden="true">
      <circle cx="3" cy="5" r="0.8" /><circle cx="3" cy="9" r="0.8" /><circle cx="3" cy="13" r="0.8" />
    </svg>
  ),
};

/* Width clamps for the two live grips. Layout dims are px (the only allowed hardcode). */
const LAYERS = { min: 168, max: 280, def: 208 };
const INSP = { min: 200, max: 360, def: 256 };

type Side = "layers" | "inspector";

export default function ComponentsResizePanels() {
  const [layersW, setLayersW] = useState(LAYERS.def);
  const [inspW, setInspW] = useState(INSP.def);
  const [dragging, setDragging] = useState<Side | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const beginDrag = useCallback((side: Side) => (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(side);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (dragging === "layers") {
        setLayersW(clamp(e.clientX - rect.left, LAYERS.min, LAYERS.max));
      } else {
        setInspW(clamp(rect.right - e.clientX, INSP.min, INSP.max));
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  // Keyboard parity — focus a grip, arrow to nudge (the affordance must be operable
  // without a pointer). 8px per press; Home / End jump to min / max.
  const nudge = (side: Side) => (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 24 : 8;
    const set = side === "layers" ? setLayersW : setInspW;
    const range = side === "layers" ? LAYERS : INSP;
    const grow = side === "layers" ? 1 : -1; // inspector grows when the seam moves left
    if (e.key === "ArrowRight") { e.preventDefault(); set((w) => clamp(w + step * grow, range.min, range.max)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); set((w) => clamp(w - step * grow, range.min, range.max)); }
    else if (e.key === "Home") { e.preventDefault(); set(range.min); }
    else if (e.key === "End") { e.preventDefault(); set(range.max); }
  };

  const reset = (side: Side) => () => (side === "layers" ? setLayersW(LAYERS.def) : setInspW(INSP.def));

  const pct = (w: number, r: typeof LAYERS) => Math.round(((w - r.min) / (r.max - r.min)) * 100);

  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-resize-panels</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>resize</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Resizable panels.</h1>
          <p className="lede">
            Three regions frame the canvas — layers, the dotted canvas, the inspector — and
            you set their balance. Each seam is a 1px hairline with a wide, invisible hit
            area; grab it and drag, double-click to snap back. The point isn&rsquo;t the
            handle. The point is that the <em>material never breaks</em>: same hairlines,
            same radii, same elevation, at every width.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Live</dt><dd>useState splitter</dd></div>
          <div><dt>Layers</dt><dd>168 – 280 px</dd></div>
          <div><dt>Inspector</dt><dd>200 – 360 px</dd></div>
          <div><dt>Snap</dt><dd>double-click</dd></div>
        </dl>

        <h2 data-no>Drag a seam <span className="h2-aside">live · pointer + keyboard</span></h2>
        <p>
          Grab either grip and drag, or focus it and use <code>←</code> / <code>→</code>
          (<code>⇧</code> for a bigger step, <code>Home</code> / <code>End</code> for min / max).
          The readouts update live — and the chrome holds its shape the whole way.
        </p>

        <div
          ref={shellRef}
          className={`rp-shell${dragging ? " is-dragging" : ""}`}
          style={{ "--layers-w": `${layersW}px`, "--insp-w": `${inspW}px` } as CSSProperties}
          aria-label="Resizable studio shell"
        >
          {/* LEFT — layers tree */}
          <nav className="rp-pane rp-layers" aria-label="Layers">
            <div className="rp-pane-hd">{Glyph.layers}<span>Layers</span><span className="rp-w">{layersW}px</span></div>
            <div className="rp-tree">
              <div className="tree-row">{Glyph.canvas}<span>Frame · Home</span></div>
              <div className="tree-row" aria-selected="true">{Glyph.inspector}<span>Card · Pricing</span></div>
              <div className="tree-row" style={{ paddingLeft: "var(--space-6)" }}>Text · Plan name</div>
              <div className="tree-row" style={{ paddingLeft: "var(--space-6)" }}>Text · $24/mo</div>
              <div className="tree-row">Group · Footer</div>
            </div>
          </nav>

          {/* GRIP 1 — between layers and canvas */}
          <div
            className={`rp-grip${dragging === "layers" ? " is-active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize layers panel"
            aria-valuemin={LAYERS.min}
            aria-valuemax={LAYERS.max}
            aria-valuenow={layersW}
            tabIndex={0}
            onPointerDown={beginDrag("layers")}
            onKeyDown={nudge("layers")}
            onDoubleClick={reset("layers")}
            title="Drag to resize · double-click to reset"
          >
            {Glyph.grip}
          </div>

          {/* CENTER — the dotted canvas */}
          <div className="rp-canvas" aria-label="Canvas">
            <div className="rp-readout">w {layersW} · {inspW}</div>
            <div className="rp-node">
              Card · Pricing
              <span className="rp-handle tl" /><span className="rp-handle tr" />
              <span className="rp-handle bl" /><span className="rp-handle br" />
            </div>
            <div className="rp-hint">
              {dragging ? `resizing ${dragging}…` : "material holds at every width"}
            </div>
          </div>

          {/* GRIP 2 — between canvas and inspector */}
          <div
            className={`rp-grip${dragging === "inspector" ? " is-active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector panel"
            aria-valuemin={INSP.min}
            aria-valuemax={INSP.max}
            aria-valuenow={inspW}
            tabIndex={0}
            onPointerDown={beginDrag("inspector")}
            onKeyDown={nudge("inspector")}
            onDoubleClick={reset("inspector")}
            title="Drag to resize · double-click to reset"
          >
            {Glyph.grip}
          </div>

          {/* RIGHT — inspector */}
          <aside className="rp-pane rp-insp" aria-label="Inspector">
            <div className="rp-pane-hd">{Glyph.inspector}<span>Properties</span><span className="rp-w">{inspW}px</span></div>
            <div className="rp-insp-bd">
              <div className="insp-row"><span className="insp-label">X</span><span className="insp-fields"><span className="field">248</span><span className="field">96</span></span></div>
              <div className="insp-row"><span className="insp-label">Size</span><span className="insp-fields"><span className="field">168</span><span className="field">116</span></span></div>
              <div className="insp-row"><span className="insp-label">Radius</span><span className="insp-fields"><span className="field">7</span></span></div>
              <div className="insp-row"><span className="insp-label">Fill</span><span className="tag tag--accent">accent</span></div>
            </div>
          </aside>
        </div>

        <div className="rp-meters" aria-hidden="true">
          <div className="rp-meter">
            <span className="rp-meter-lbl">layers</span>
            <span className="rp-track"><span className="rp-fill" style={{ width: `${pct(layersW, LAYERS)}%` }} /></span>
            <span className="rp-meter-val">{pct(layersW, LAYERS)}%</span>
          </div>
          <div className="rp-meter">
            <span className="rp-meter-lbl">inspector</span>
            <span className="rp-track"><span className="rp-fill" style={{ width: `${pct(inspW, INSP)}%` }} /></span>
            <span className="rp-meter-val">{pct(inspW, INSP)}%</span>
          </div>
        </div>

        <h2 data-no>Handle anatomy <span className="h2-aside">1px seam · 8px hit area</span></h2>
        <p>
          The visible seam is a single hairline so it reads as part of the material, not a
          control bolted on. The hit area is 8px wide and centered on it — generous enough to
          grab without aiming. The grip dots and the <code>col-resize</code> cursor only
          appear on hover and focus, so a panel at rest stays calm.
        </p>
        <div className="rp-anatomy">
          <figure>
            <div className="rp-anatomy-vis">
              <span className="rp-anatomy-hit" />
              <span className="rp-anatomy-seam" />
            </div>
            <figcaption>rest — 1px seam, no cursor, no dots</figcaption>
          </figure>
          <figure>
            <div className="rp-anatomy-vis is-hover">
              <span className="rp-anatomy-hit" />
              <span className="rp-anatomy-seam" />
              <span className="rp-anatomy-dots">{Glyph.grip}</span>
            </div>
            <figcaption>hover / focus — accent seam, grip dots, col-resize</figcaption>
          </figure>
        </div>

        <h2 data-no>Constraints <span className="h2-aside">why min &amp; max exist</span></h2>
        <table className="rp-table">
          <thead>
            <tr><th>Region</th><th>Min</th><th>Default</th><th>Max</th><th>Behavior</th></tr>
          </thead>
          <tbody>
            <tr><td>Layers</td><td className="mono">168</td><td className="mono">208</td><td className="mono">280</td><td>tree never collapses past a readable row label</td></tr>
            <tr><td>Canvas</td><td className="mono">flex</td><td className="mono">flex</td><td className="mono">—</td><td>takes all the slack; the work always wins the room</td></tr>
            <tr><td>Inspector</td><td className="mono">200</td><td className="mono">256</td><td className="mono">360</td><td>holds two tabular fields side by side without wrap</td></tr>
          </tbody>
        </table>
        <div className="callout callout--info rp-callout">
          <svg className="g" viewBox="0 0 16 16" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}>
            <circle cx="8" cy="8" r="6" /><path d="M8 7.5v3.5M8 5h.01" />
          </svg>
          <span>
            Widths persist to <code>localStorage</code> and restore on reload — last layout
            back, no re-tax. Min widths beat collapse-to-zero: a panel you can&rsquo;t see is
            a panel you have to fight to get back.
          </span>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-resize-panels</span>
          <span>one material · every width</span>
        </footer>
      </main>
    </>
  );
}
