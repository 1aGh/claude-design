/**
 * @canvas      logo — SIGNATURE — the maude mark + wordmark, their construction
 *              rules and placements. The mark IS a selected canvas node: an ink
 *              rounded-square frame with FOUR indigo corner grips, where the
 *              top-left grip is a spark — the AI agent. Two-colour (ink frame +
 *              accent corners), bolder; engine-derived via /design:draw. This
 *              specimen inlines both brand assets, explains the selection-node
 *              motif, the lockup + mark-alone, clear-space + min-size, the
 *              on-dark / on-light / on-accent / on-canvas placements, and misuse.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/logo — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./logo.css";

/* ── The mark — engine-derived (/design:draw), inlined from assets/logos/mark.svg.
 * A selected canvas node: an ink rounded-square frame (the node) under FOUR corner
 * grips (the selection). Three grips are square; the TOP-LEFT is a 4-point spark —
 * the AI agent. Two colours: the frame is the surface ink (currentColor); the four
 * corners are the one indigo accent (gripColor). On the accent surface, pass
 * gripColor=accent-fg so the corners don't vanish into the field. */
function Mark({ size = 32, gripColor = "var(--accent)" }: { size?: number; gripColor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="maude mark">
      <rect x="7" y="7" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2.8" />
      <g fill={gripColor}>
        <rect x="20.7" y="2.7" width="8.6" height="8.6" rx="2.4" />
        <rect x="2.7" y="20.7" width="8.6" height="8.6" rx="2.4" />
        <rect x="20.7" y="20.7" width="8.6" height="8.6" rx="2.4" />
        <path d="M8 -1 C8.6 5.36 10.64 7.4 17 8 C10.64 8.6 8.6 10.64 8 17 C7.4 10.64 5.36 8.6 -1 8 C5.36 7.4 7.4 5.36 8 -1 Z" />
      </g>
    </svg>
  );
}

/* ── The full lockup — mark + "maude" in Inter Tight 600. Ink frame + ink wordmark,
 * indigo corner grips. */
function Lockup({ height = 32, gripColor = "var(--accent)" }: { height?: number; gripColor?: string }) {
  return (
    <svg height={height} viewBox="0 0 116 32" fill="none" role="img" aria-label="maude" style={{ display: "block" }}>
      <svg x="0" y="2" width="28" height="28" viewBox="0 0 32 32">
        <rect x="7" y="7" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2.8" />
        <g fill={gripColor}>
          <rect x="20.7" y="2.7" width="8.6" height="8.6" rx="2.4" />
          <rect x="2.7" y="20.7" width="8.6" height="8.6" rx="2.4" />
          <rect x="20.7" y="20.7" width="8.6" height="8.6" rx="2.4" />
          <path d="M8 -1 C8.6 5.36 10.64 7.4 17 8 C10.64 8.6 8.6 10.64 8 17 C7.4 10.64 5.36 8.6 -1 8 C5.36 7.4 7.4 5.36 8 -1 Z" />
        </g>
      </svg>
      <text x="36" y="22" fontFamily="Inter Tight, Inter, system-ui, sans-serif" fontSize="20" fontWeight="600" letterSpacing="-0.6" fill="currentColor">maude</text>
    </svg>
  );
}

export default function Logo() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/logo</span>
        <span className="crumbs"><span>maude</span><span>brand</span><span>logo</span></span>
        <ThemeToggle />
      </header>

      <main className="specimen">
        <section className="specimen-title">
          <h1>The mark is a selected node.</h1>
          <p className="lede">
            maude is the tool where you select something on an infinite canvas, then iterate on
            it with an agent. So the mark <em>is</em> that: a node framed by its four selection grips
            &mdash; the corners are the one indigo accent, and the top-left grip is a
            <strong> spark</strong>, the agent. The frame is the surface ink; the corners carry the
            colour. Bold enough to hold a 16px favicon, and the whole thing is still just a frame
            and four corners.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Mark</dt><dd>node · 4 accent grips</dd></div>
          <div><dt>Colour</dt><dd>ink frame · indigo corners</dd></div>
          <div><dt>Min size</dt><dd>16px mark</dd></div>
          <div><dt>Clear space</dt><dd>= 1 grip</dd></div>
        </dl>

        <h2 data-no>The lockup <span className="h2-aside">mark + wordmark</span></h2>
        <p>
          The default presentation: the mark and the wordmark set tight in Inter Tight 600. Frame and
          name share the surface ink; the four corner grips are the indigo. Use the lockup wherever
          there&rsquo;s room for the name &mdash; the menubar, the about screen, a handoff cover.
        </p>
        <div className="logo-hero">
          <div className="logo-hero-stage"><Lockup height={42} /></div>
          <div className="logo-hero-meta">
            <span className="mono">maude — Inter Tight 600 · −0.6 tracking</span>
            <span className="mono">mark — 2.8px ink frame · indigo grips · agent spark</span>
          </div>
        </div>

        <h2 data-no>The mark alone <span className="h2-aside">for tight spaces · the favicon · the app icon</span></h2>
        <p>
          Where the name doesn&rsquo;t fit &mdash; a 16px tab favicon, a dock tile, a dense toolbar &mdash; the
          mark stands on its own. It stays legible because it&rsquo;s one bold frame and four indigo
          corners, never a fine illustration. (The dedicated favicon thickens the frame a touch and
          drops to one ink for the smallest sizes.)
        </p>
        <div className="logo-mark-row">
          {[256, 96, 48, 32, 24, 16].map((s) => (
            <figure className="logo-mark-cell" key={s}>
              <span className="logo-mark-frame" style={{ width: s < 32 ? 48 : s + 24, height: s < 32 ? 48 : s + 24 }}>
                <Mark size={s} />
              </span>
              <figcaption className="mono">{s}px</figcaption>
            </figure>
          ))}
        </div>

        <h2 data-no>The selection motif <span className="h2-aside">why this shape IS maude</span></h2>
        <p>
          Read the mark and you read the product. A frame is a node on the canvas. The corner grips
          are what every pro tool draws the instant you select something &mdash; except one of maude&rsquo;s
          corners is a spark. That&rsquo;s the half-second the whole tool is about: you select the node,
          and the agent is right there in the corner, ready to act on it.
        </p>
        <div className="logo-motif">
          <div className="logo-motif-stage">
            <div className="logo-motif-node">
              <span className="logo-motif-tag mono">node</span>
              <Mark size={132} />
            </div>
            <span className="logo-motif-call logo-motif-call--frame mono">frame · the surface ink</span>
            <span className="logo-motif-call logo-motif-call--handle mono">grips · the indigo · TL = the agent spark</span>
          </div>
          <ol className="logo-motif-steps">
            <li><span className="logo-motif-n mono">1</span> A <strong>frame</strong> &mdash; the node on the canvas. Inherits the surface ink, legible anywhere.</li>
            <li><span className="logo-motif-n mono">2</span> Four <strong>corner grips</strong> in the accent &mdash; the selection. Three square; the top-left is a <strong>spark</strong> &mdash; the agent.</li>
            <li><span className="logo-motif-n mono">3</span> Together: <strong>&ldquo;selected, now iterate <em>with</em> the agent&rdquo;</strong> &mdash; the half-second the whole tool is about.</li>
          </ol>
        </div>

        <h2 data-no>Clear space &amp; minimum size <span className="h2-aside">give it room, never shrink it blind</span></h2>
        <p>
          Keep clear space equal to one grip on every side &mdash; nothing crowds the corners. Below a
          16px mark the spark stops reading as distinct from the square grips (the framed-node gestalt
          still holds); 16px is the floor &mdash; reach for the wordmark instead of shrinking past it.
        </p>
        <div className="logo-rules">
          <figure className="logo-rule">
            <div className="logo-clearspace">
              <span className="logo-cs-pad logo-cs-pad--t" /><span className="logo-cs-pad logo-cs-pad--b" />
              <span className="logo-cs-pad logo-cs-pad--l" /><span className="logo-cs-pad logo-cs-pad--r" />
              <Mark size={64} />
            </div>
            <figcaption className="mono">clear space = 1 grip (x)</figcaption>
          </figure>
          <figure className="logo-rule">
            <div className="logo-minsize">
              <span className="logo-minsize-row"><Mark size={16} /><span className="mono logo-minsize-lbl">16px — floor</span></span>
              <span className="logo-minsize-row"><Mark size={12} /><span className="mono logo-minsize-lbl logo-minsize-lbl--no">12px — grips fuse, don&rsquo;t</span></span>
            </div>
            <figcaption className="mono">minimum mark size</figcaption>
          </figure>
        </div>

        <h2 data-no>Placements <span className="h2-aside">dark · light · accent · canvas</span></h2>
        <p>
          The frame and wordmark inherit <code>currentColor</code>, so they retint to whatever surface
          the lockup sits on; the four grips stay the indigo. On the accent the grips go mono dark navy
          (<code>--accent-fg</code>) so they don&rsquo;t vanish into the field; on the dotted canvas it
          reads like any other selected node.
        </p>
        <div className="logo-placements">
          <figure className="logo-place logo-place--dark">
            <Lockup height={28} />
            <figcaption className="mono">on dark · default</figcaption>
          </figure>
          <figure className="logo-place logo-place--light">
            <Lockup height={28} />
            <figcaption className="mono">on light</figcaption>
          </figure>
          <figure className="logo-place logo-place--accent">
            <Lockup height={28} gripColor="var(--accent-fg)" />
            <figcaption className="mono">on accent · mono navy</figcaption>
          </figure>
          <figure className="logo-place logo-place--canvas">
            <Lockup height={28} />
            <figcaption className="mono">on canvas</figcaption>
          </figure>
        </div>

        <h2 data-no>Misuse <span className="h2-aside">do · don&rsquo;t</span></h2>
        <p>
          The mark holds up because it stays the mark. Keep the frame one ink and the grips the indigo,
          don&rsquo;t recolour the corners to a random hue, don&rsquo;t squash the lockup, don&rsquo;t drop it on a
          busy field where the grips disappear.
        </p>
        <div className="logo-misuse">
          <figure className="logo-mis logo-mis--ok">
            <div className="logo-mis-stage"><Lockup height={26} /></div>
            <figcaption>✓ ink frame · indigo grips · clear field</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage"><Lockup height={26} gripColor="var(--status-error)" /></div>
            <figcaption>✕ recoloured grips &mdash; the corners are the indigo, nothing else</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage"><span className="logo-mis-squash"><Lockup height={26} /></span></div>
            <figcaption>✕ stretched &mdash; proportions are locked</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage logo-mis-stage--noisy"><Lockup height={26} /></div>
            <figcaption>✕ busy field &mdash; grips vanish, give it room</figcaption>
          </figure>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/logo</span>
          <span>mark = selected node · indigo corners · one is the agent</span>
        </footer>
      </main>
    </>
  );
}
