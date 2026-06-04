/**
 * @canvas      type-scale — the Inter ladder: --type-xs..3xl × --lh-*, the tight
 *              ~1.2 ratio at base 14 (dense), display vs body roles, and where
 *              each step lands in the studio chrome. Tabular-figures note.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/type-scale — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./type-scale.css";

/* The ladder, top → bottom. `font` = which family the step is sized for;
 * `where` is the real place in the studio it lives. Every size is a --type-*
 * token (off-ladder px is a typography-critic hard-fail). */
const LADDER = [
  { tok: "3xl", px: 34, lh: 40, font: "display", weight: 600, where: "handoff splash · empty-state hero", sample: "Iterate with the agent" },
  { tok: "2xl", px: 28, lh: 34, font: "display", weight: 600, where: "specimen h1 · dialog title", sample: "Hand off to production" },
  { tok: "xl", px: 23, lh: 30, font: "display", weight: 600, where: "panel section heading", sample: "Inspector · Properties" },
  { tok: "lg", px: 19, lh: 26, font: "display", weight: 600, where: "specimen h2 · card title", sample: "Selected node" },
  { tok: "md", px: 16, lh: 24, font: "body", weight: 400, where: "lede · callout body", sample: "The chrome frames the canvas without competing with it." },
  { tok: "base", px: 14, lh: 20, font: "body", weight: 400, where: "body copy · tree rows (default)", sample: "Default reading size. Every flowing block of text starts here, at fourteen." },
  { tok: "sm", px: 12, lh: 18, font: "body", weight: 400, where: "secondary · dense table cells", sample: "Auto-saved 19:42 · 3 artboards · 1 collaborator" },
  { tok: "xs", px: 11, lh: 16, font: "body", weight: 400, where: "eyebrows · part-numbers · footnotes", sample: "MAUDE / TYPE-SCALE · LADDER" },
] as const;

export default function TypeScale() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/type-scale</span>
        <span className="crumbs"><span>maude</span><span>type</span><span>scale</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>The ladder. Inter, tight.</h1>
          <p className="lede">
            Eight steps on a tight ~1.2 ratio, anchored at <strong>14px</strong> — dense,
            because pros live in the chrome all day. <em>Inter&nbsp;Tight</em> carries the
            display steps (<code>--type-lg</code> and up); <em>Inter</em> carries body and
            below. Hierarchy is contrast, never decoration — never stack more than three
            steps in one region.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Display</dt><dd>Inter Tight</dd></div>
          <div><dt>Body</dt><dd>Inter</dd></div>
          <div><dt>Base</dt><dd>14 / 20</dd></div>
          <div><dt>Ratio</dt><dd>~1.2 · ≤600</dd></div>
        </dl>

        <h2 data-no>The eight steps <span className="h2-aside">size · leading · role</span></h2>
        <p>
          Each row sets the step from its <code>--type-*</code> / <code>--lh-*</code> token
          pair — read the mono gutter on the left to see the resolved px and which family
          the step is meant for.
        </p>
        <div className="ts-ladder">
          {LADDER.map((s) => (
            <div className="ts-step" key={s.tok}>
              <div className="ts-spec">
                <span className="ts-tok">--type-{s.tok}</span>
                <span className="ts-num">{s.px} / {s.lh}</span>
                <span className={`ts-fam ts-fam--${s.font}`}>{s.font}</span>
              </div>
              <div
                className="ts-sample"
                data-font={s.font}
                style={{
                  fontFamily: s.font === "display" ? "var(--font-display)" : "var(--font-body)",
                  fontSize: `var(--type-${s.tok})`,
                  lineHeight: `var(--lh-${s.tok})`,
                  fontWeight: s.weight,
                  letterSpacing: s.font === "display" ? "var(--tracking-tight)" : undefined,
                }}
              >
                {s.sample}
              </div>
              <div className="ts-where">{s.where}</div>
            </div>
          ))}
        </div>

        <h2 data-no>Display vs body <span className="h2-aside">two families, one voice</span></h2>
        <p>
          The two faces are siblings, not strangers. <em>Inter Tight</em> sets headings —
          tightened tracking, weight pinned at 600, never heavier (the restraint is the
          point). <em>Inter</em> sets everything that has to be read for more than a glance.
          Below the same size they're nearly indistinguishable; above it, the display face
          earns its tighter rhythm.
        </p>
        <div className="ts-pair">
          <figure className="ts-card">
            <span className="ts-card-tag">display · Inter Tight</span>
            <p className="ts-disp">Hand off the frame</p>
            <p className="ts-disp-meta">--font-display · --type-xl · 600 · tracking-tight</p>
          </figure>
          <figure className="ts-card">
            <span className="ts-card-tag">body · Inter</span>
            <p className="ts-body">
              A clean export bundles the selected artboards, their tokens, and a
              production-ready component sidecar — ready to drop into the codebase.
            </p>
            <p className="ts-disp-meta">--font-body · --type-base · 400 · normal</p>
          </figure>
        </div>

        <h2 data-no>Tabular figures <span className="h2-aside">numbers that hold their column</span></h2>
        <p>
          Inter ships proportional figures by default — fine in prose, wrong in a coordinate
          readout where digits must line up frame to frame. Numeric chrome (the inspector,
          coordinate HUDs, dense tables) opts into <code>tabular-nums</code>, set on
          <code>.mono</code> and every <code>.field</code> in the system.
        </p>
        <div className="ts-fig">
          <div className="ts-fig-col">
            <span className="ts-fig-label">proportional <span className="ts-fig-x">drifts</span></span>
            <span className="ts-fig-val ts-fig-prop">1,408.20</span>
            <span className="ts-fig-val ts-fig-prop">11,111.11</span>
            <span className="ts-fig-val ts-fig-prop">96,248.04</span>
          </div>
          <div className="ts-fig-col">
            <span className="ts-fig-label">tabular <span className="ts-fig-ok">aligns</span></span>
            <span className="ts-fig-val mono">1,408.20</span>
            <span className="ts-fig-val mono">11,111.11</span>
            <span className="ts-fig-val mono">96,248.04</span>
          </div>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/type-scale</span>
          <span>inter + inter tight · ~1.2 · base 14</span>
        </footer>
      </main>
    </>
  );
}
