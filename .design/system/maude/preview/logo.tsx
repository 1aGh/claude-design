/**
 * @canvas      logo — SIGNATURE — the maude mark + wordmark, their construction
 *              rules and their placements. The mark IS a selected canvas node:
 *              a rounded square with four indigo corner handles. This specimen
 *              inlines both brand assets from disk (no <img src>), explains the
 *              selection-handle motif, lays out the lockup + mark-alone, the
 *              clear-space + min-size rules, the on-dark / on-light / on-accent /
 *              on-canvas placements, and the DO / DON'T misuse rules.
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

/* ── The mark — inlined from assets/logos/mark.svg, retokenized. ───────────
 * A selected canvas node: a rounded-square frame (the node) wrapped by four
 * indigo corner handles (the selection). The frame stroke inherits currentColor
 * so it flips per surface; the handles are always the accent. This is the whole
 * brand idea in one glyph: maude is the tool where you select, then iterate. */
function Mark({ size = 32, handleColor }: { size?: number; handleColor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="maude mark">
      <rect x="7" y="7" width="18" height="18" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <g fill={handleColor ?? "var(--accent)"}>
        <rect x="4" y="4" width="5" height="5" rx="1.2" />
        <rect x="23" y="4" width="5" height="5" rx="1.2" />
        <rect x="4" y="23" width="5" height="5" rx="1.2" />
        <rect x="23" y="23" width="5" height="5" rx="1.2" />
      </g>
    </svg>
  );
}

/* ── The full lockup — inlined from assets/logos/wordmark.svg, retokenized.
 * Mark + "maude" set in Inter Tight 600. The wordmark text and mark stroke
 * inherit currentColor; the four corner handles are the one accent. */
function Lockup({ height = 32, handleColor }: { height?: number; handleColor?: string }) {
  return (
    <svg
      height={height}
      viewBox="0 0 152 32"
      fill="none"
      role="img"
      aria-label="maude"
      style={{ display: "block" }}
    >
      <rect x="3.5" y="6.5" width="19" height="19" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <g fill={handleColor ?? "var(--accent)"}>
        <rect x="1" y="4" width="5" height="5" rx="1.2" />
        <rect x="20" y="4" width="5" height="5" rx="1.2" />
        <rect x="1" y="23" width="5" height="5" rx="1.2" />
        <rect x="20" y="23" width="5" height="5" rx="1.2" />
      </g>
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
            it with an agent. So the mark <em>is</em> that: a rounded-square node wrapped by four
            indigo corner handles &mdash; the universal &ldquo;this is selected, now act on it&rdquo; signal,
            frozen into a logo. The frame inherits the surface color and flips per placement; the
            handles are always the one accent. Nothing decorative, nothing to explain twice.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Mark</dt><dd>node + 4 handles</dd></div>
          <div><dt>Wordmark</dt><dd>Inter Tight 600</dd></div>
          <div><dt>Min size</dt><dd>16px mark</dd></div>
          <div><dt>Clear space</dt><dd>= 1 handle</dd></div>
        </dl>

        <h2 data-no>The lockup <span className="h2-aside">mark + wordmark</span></h2>
        <p>
          The default presentation: the mark and the wordmark set tight in Inter Tight 600. Use the
          lockup wherever there&rsquo;s room for the name &mdash; the menubar, the about screen, a
          handoff cover.
        </p>
        <div className="logo-hero">
          <div className="logo-hero-stage"><Lockup height={40} /></div>
          <div className="logo-hero-meta">
            <span className="mono">maude — Inter Tight 600 · −0.6 tracking</span>
            <span className="mono">mark — 1.5px frame · accent handles</span>
          </div>
        </div>

        <h2 data-no>The mark alone <span className="h2-aside">for tight spaces · the favicon · the app icon</span></h2>
        <p>
          Where the name doesn&rsquo;t fit &mdash; a 16px tab favicon, a dock tile, a dense toolbar &mdash; the
          mark stands on its own. It stays legible because it&rsquo;s one shape and four dots, never a
          fine illustration.
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
          Read the mark left to right and you read the product. A frame is a node on the canvas.
          The four corner handles are what every pro tool draws the instant you select something.
          maude lives in the half-second after the selection &mdash; the moment you ask the agent to
          do something to the thing you just picked. The handles aren&rsquo;t decoration; they&rsquo;re the verb.
        </p>
        <div className="logo-motif">
          <div className="logo-motif-stage">
            <div className="logo-motif-node">
              <span className="logo-motif-tag mono">node</span>
              <Mark size={120} />
            </div>
            <span className="logo-motif-call logo-motif-call--frame mono">frame · currentColor</span>
            <span className="logo-motif-call logo-motif-call--handle mono">handle · always accent</span>
          </div>
          <ol className="logo-motif-steps">
            <li><span className="logo-motif-n mono">1</span> A <strong>frame</strong> &mdash; the node on the canvas. Inherits the surface so it&rsquo;s legible anywhere.</li>
            <li><span className="logo-motif-n mono">2</span> Four <strong>handles</strong> &mdash; the selection. The single indigo accent, every time.</li>
            <li><span className="logo-motif-n mono">3</span> Together: <strong>&ldquo;selected, now iterate&rdquo;</strong> &mdash; the half-second the whole tool is about.</li>
          </ol>
        </div>

        <h2 data-no>Clear space &amp; minimum size <span className="h2-aside">give it room, never shrink it blind</span></h2>
        <p>
          Keep clear space equal to one handle (the small accent square) on every side &mdash; nothing
          crowds the handles. Below a 16px mark the handles fuse with the frame, so 16px is the
          floor; reach for the wordmark instead of shrinking past it.
        </p>
        <div className="logo-rules">
          <figure className="logo-rule">
            <div className="logo-clearspace">
              <span className="logo-cs-pad logo-cs-pad--t" /><span className="logo-cs-pad logo-cs-pad--b" />
              <span className="logo-cs-pad logo-cs-pad--l" /><span className="logo-cs-pad logo-cs-pad--r" />
              <Mark size={64} />
            </div>
            <figcaption className="mono">clear space = 1 handle (x)</figcaption>
          </figure>
          <figure className="logo-rule">
            <div className="logo-minsize">
              <span className="logo-minsize-row"><Mark size={16} /><span className="mono logo-minsize-lbl">16px — floor</span></span>
              <span className="logo-minsize-row"><Mark size={12} /><span className="mono logo-minsize-lbl logo-minsize-lbl--no">12px — handles fuse, don&rsquo;t</span></span>
            </div>
            <figcaption className="mono">minimum mark size</figcaption>
          </figure>
        </div>

        <h2 data-no>Placements <span className="h2-aside">dark · light · accent · canvas</span></h2>
        <p>
          The frame and wordmark inherit <code>currentColor</code>, so the lockup retints to whatever
          surface it sits on. On the accent the handles go mono dark navy (<code>--accent-fg</code>) &mdash; white
          would only reach ~3:1 on this indigo, navy clears AA &mdash; so they never out-shout a field that&rsquo;s
          already the accent. On the dotted canvas it reads like any other node.
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
            <Lockup height={28} handleColor="var(--accent-fg)" />
            <figcaption className="mono">on accent · mono navy</figcaption>
          </figure>
          <figure className="logo-place logo-place--canvas">
            <Lockup height={28} />
            <figcaption className="mono">on canvas</figcaption>
          </figure>
        </div>

        <h2 data-no>Misuse <span className="h2-aside">do · don&rsquo;t</span></h2>
        <p>
          The mark holds up because it stays the mark. Don&rsquo;t recolor the handles, don&rsquo;t add a
          gradient (there are none in this system), don&rsquo;t squash the lockup, don&rsquo;t drop it on a
          busy field where the handles disappear.
        </p>
        <div className="logo-misuse">
          <figure className="logo-mis logo-mis--ok">
            <div className="logo-mis-stage"><Lockup height={26} /></div>
            <figcaption>✓ one accent · clear field · true proportions</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage"><Lockup height={26} handleColor="var(--status-error)" /></div>
            <figcaption>✕ recolored handles &mdash; the accent has one job</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage"><span className="logo-mis-squash"><Lockup height={26} /></span></div>
            <figcaption>✕ stretched &mdash; proportions are locked</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage logo-mis-stage--noisy"><Lockup height={26} /></div>
            <figcaption>✕ busy field &mdash; handles vanish, give it room</figcaption>
          </figure>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/logo</span>
          <span>mark = selected node · handles = the one accent</span>
        </footer>
      </main>
    </>
  );
}
