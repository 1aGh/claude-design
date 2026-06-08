/**
 * @canvas      logo — SIGNATURE — the maude mark + wordmark, their construction
 *              rules and placements. The mark IS the spark: a four-point star on
 *              a rounded indigo tile whose bottom-right corner is squared off, so
 *              it reads as a message bubble — maude is a conversation with the
 *              agent. In-app the tile sits in a soft accent halo. Same mark maude
 *              ships as its app favicon. This specimen inlines both brand assets,
 *              explains the spark + bubble motif, the lockup + mark-alone, clear-
 *              space + min-size, the on-dark / on-light / on-accent / on-canvas
 *              placements, and misuse.
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

/* ── The spark — a filled four-point star, the maude mark's one shape. Draws in
 * currentColor so the tile (or the surface, when knockout) decides its colour. */
function Spark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="currentColor" />
    </svg>
  );
}

/* ── The mark — the spark on its bubble tile (the shipped app favicon).
 * The bottom-right corner is squared; the star takes --accent-fg so it holds
 * ≥6:1 against the indigo at every size.
 *
 * `halo` — the soft accent-tint ring the mark wears in-app (menubar, lockups).
 * `bare` — drop the tile; draw the star alone in the surface ink (the knockout
 *          form for accent surfaces and tight inline ink contexts).
 * `tile` — override the field colour (misuse demos only). */
function Mark({
  size = 32,
  halo = false,
  bare = false,
  tile,
}: { size?: number; halo?: boolean; bare?: boolean; tile?: string }) {
  const cls = "lg-mark" + (halo ? " lg-mark--halo" : "") + (bare ? " lg-mark--bare" : "");
  const style: React.CSSProperties = { width: size, height: size };
  if (tile && !bare) style.background = tile;
  return (
    <span className={cls} style={style} role="img" aria-label="maude mark">
      <Spark />
    </span>
  );
}

/* ── The full lockup — mark + "maude" in Inter Tight 600. The wordmark inherits
 * the surface ink (currentColor); the spark tile carries the indigo + halo.
 * Proportions: the tile sits at ~the wordmark's cap height so the name stays the
 * dominant, even, minimal element — never a big badge beside small text.
 * `height` scales the whole lockup. */
function Lockup({
  height = 32,
  halo = false,
  bare = false,
  tile,
}: { height?: number; halo?: boolean; bare?: boolean; tile?: string }) {
  const mark = Math.round(height * 0.6);   // tile — subordinate to the name
  const word = Math.round(height * 0.8);   // wordmark — the dominant element
  return (
    <span className="lg-lockup" style={{ fontSize: word, gap: Math.round(height * 0.2) }}>
      <Mark size={mark} halo={halo} bare={bare} tile={tile} />
      <span className="lg-word">maude</span>
    </span>
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
          <h1>The mark is the spark.</h1>
          <p className="lede">
            maude is the half-second where you point at something and an agent acts on it. So the mark
            <em> is</em> that moment: a single <strong>four-point spark</strong> on the one indigo accent
            &mdash; the same mark that sits in the browser tab as the favicon. Its <strong>bottom-right
            corner is squared off</strong> while the others stay round, so the tile reads as a
            <strong> message bubble</strong> &mdash; because maude is a conversation with the agent. In-app
            it wears a soft accent <strong>halo</strong>, like a node that just lit up.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Mark</dt><dd>four-point spark</dd></div>
          <div><dt>Shape</dt><dd>bubble · bottom-right squared</dd></div>
          <div><dt>Colour</dt><dd>indigo tile · accent-fg star</dd></div>
          <div><dt>In-app</dt><dd>accent-tint halo</dd></div>
        </dl>

        <h2 data-no>The lockup <span className="h2-aside">mark + wordmark</span></h2>
        <p>
          The default presentation: the spark bubble and the wordmark set tight in Inter Tight 600. The
          name takes the surface ink; the tile stays the indigo and wears its accent halo. Use the lockup
          wherever there&rsquo;s room for the name &mdash; the menubar, the about screen, a handoff cover.
        </p>
        <div className="logo-hero">
          <div className="logo-hero-stage"><Lockup height={42} halo /></div>
          <div className="logo-hero-meta">
            <span className="mono">maude — Inter Tight 600 · −0.6 tracking</span>
            <span className="mono">mark — spark · bubble corner · accent halo</span>
          </div>
        </div>

        <h2 data-no>The mark alone <span className="h2-aside">for tight spaces · the favicon · the app icon</span></h2>
        <p>
          Where the name doesn&rsquo;t fit &mdash; a 16px tab favicon, a dock tile, a dense toolbar &mdash; the
          spark bubble stands on its own. It stays legible because it&rsquo;s one bold star on one indigo
          field, never a fine illustration. (This <em>is</em> the favicon; the browser chip uses a white
          star at the smallest sizes, the halo is an in-app touch and drops away here.)
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

        <h2 data-no>The spark + bubble motif <span className="h2-aside">why this shape IS maude</span></h2>
        <p>
          Read the mark and you read the product. A spark is the instant something happens &mdash; the agent
          acting on what you selected. The squared bottom-right corner turns the tile into a message
          bubble &mdash; the conversation you have with that agent. One indigo accent, because there is only
          ever one accent in maude: one confident colour, one decisive moment.
        </p>
        <div className="logo-motif">
          <div className="logo-motif-stage">
            <div className="logo-motif-node">
              <span className="logo-motif-tag mono">spark · bubble</span>
              <Mark size={132} halo />
            </div>
            <span className="logo-motif-call logo-motif-call--frame mono">bubble · the conversation</span>
            <span className="logo-motif-call logo-motif-call--handle mono">star · the agent&rsquo;s half-second</span>
          </div>
          <ol className="logo-motif-steps">
            <li><span className="logo-motif-n mono">1</span> A <strong>four-point star</strong> &mdash; the spark: the instant the agent acts. One bold shape, legible at any size.</li>
            <li><span className="logo-motif-n mono">2</span> A <strong>squared bottom-right corner</strong> &mdash; the tile becomes a message bubble, the conversation with the agent.</li>
            <li><span className="logo-motif-n mono">3</span> On the <strong>one indigo</strong>, in a soft <strong>halo</strong> &mdash; a node that just lit up. &ldquo;Point, and it happens.&rdquo;</li>
          </ol>
        </div>

        <h2 data-no>Clear space &amp; minimum size <span className="h2-aside">give it room, never shrink it blind</span></h2>
        <p>
          Keep clear space equal to a quarter of the mark on every side &mdash; nothing crowds the spark.
          Below a 16px mark the star&rsquo;s points start to thicken and lose their bite; 16px is the floor
          &mdash; reach for the wordmark instead of shrinking past it.
        </p>
        <div className="logo-rules">
          <figure className="logo-rule">
            <div className="logo-clearspace">
              <span className="logo-cs-pad logo-cs-pad--t" /><span className="logo-cs-pad logo-cs-pad--b" />
              <span className="logo-cs-pad logo-cs-pad--l" /><span className="logo-cs-pad logo-cs-pad--r" />
              <Mark size={64} />
            </div>
            <figcaption className="mono">clear space = ¼ mark (x)</figcaption>
          </figure>
          <figure className="logo-rule">
            <div className="logo-minsize">
              <span className="logo-minsize-row"><Mark size={16} /><span className="mono logo-minsize-lbl">16px — floor</span></span>
              <span className="logo-minsize-row"><Mark size={12} /><span className="mono logo-minsize-lbl logo-minsize-lbl--no">12px — points thicken, don&rsquo;t</span></span>
            </div>
            <figcaption className="mono">minimum mark size</figcaption>
          </figure>
        </div>

        <h2 data-no>Placements <span className="h2-aside">dark · light · accent · canvas</span></h2>
        <p>
          The wordmark inherits <code>currentColor</code>, so it retints to whatever surface the lockup
          sits on; the spark bubble stays the indigo and keeps its halo. On the accent itself the tile and
          halo would vanish into the field, so drop them &mdash; the star goes knockout in the surface ink
          (<code>--accent-fg</code>). On the dotted canvas it reads like a fresh node lighting up.
        </p>
        <div className="logo-placements">
          <figure className="logo-place logo-place--dark">
            <Lockup height={28} halo />
            <figcaption className="mono">on dark · default</figcaption>
          </figure>
          <figure className="logo-place logo-place--light">
            <Lockup height={28} halo />
            <figcaption className="mono">on light</figcaption>
          </figure>
          <figure className="logo-place logo-place--accent">
            <Lockup height={28} bare />
            <figcaption className="mono">on accent · knockout</figcaption>
          </figure>
          <figure className="logo-place logo-place--canvas">
            <Lockup height={28} halo />
            <figcaption className="mono">on canvas</figcaption>
          </figure>
        </div>

        <h2 data-no>Misuse <span className="h2-aside">do · don&rsquo;t</span></h2>
        <p>
          The mark holds up because it stays the mark. Keep the tile the one indigo and the wordmark the
          surface ink, keep the bubble corner where it is, don&rsquo;t recolour the tile to a random hue,
          don&rsquo;t squash the lockup, don&rsquo;t drop the tile form on a busy field where the spark disappears.
        </p>
        <div className="logo-misuse">
          <figure className="logo-mis logo-mis--ok">
            <div className="logo-mis-stage"><Lockup height={26} halo /></div>
            <figcaption>✓ indigo bubble · halo · ink wordmark</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage"><Lockup height={26} tile="var(--status-error)" /></div>
            <figcaption>✕ recoloured tile &mdash; the field is the indigo, nothing else</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage"><span className="logo-mis-squash"><Lockup height={26} /></span></div>
            <figcaption>✕ stretched &mdash; proportions are locked</figcaption>
          </figure>
          <figure className="logo-mis logo-mis--no">
            <div className="logo-mis-stage logo-mis-stage--noisy"><Lockup height={26} /></div>
            <figcaption>✕ busy field &mdash; spark vanishes, give it room</figcaption>
          </figure>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/logo</span>
          <span>mark = the spark · a message bubble on the one indigo · the agent&rsquo;s half-second</span>
        </footer>
      </main>
    </>
  );
}
