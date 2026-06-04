/**
 * @canvas      components-tables — dense data tables in the panel material.
 *              Tabular-mono numeric columns, hairline row separators, hover row,
 *              a sortable header, a selected row in accent-tint, and an aggregate
 *              footer row. The "canvases" list: node counts / last edited / status.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-tables — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-tables.css";

type Status = "live" | "draft" | "handoff" | "blocked";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  live:    { label: "Synced",  cls: "tbl-state--success" },
  draft:   { label: "Draft",   cls: "tbl-state--info" },
  handoff: { label: "Handoff", cls: "tbl-state--warn" },
  blocked: { label: "Blocked", cls: "tbl-state--error" },
};

type Row = {
  name: string;
  artboards: number;
  nodes: number;
  edited: string;     // relative when fresh, absolute when stale
  status: Status;
};

// Pre-sorted by Nodes, descending — the sortable column in this view.
const CANVASES: Row[] = [
  { name: "pricing · v3",        artboards: 4, nodes: 312, edited: "2m ago",  status: "live" },
  { name: "onboarding · flow",   artboards: 7, nodes: 286, edited: "18m ago", status: "handoff" },
  { name: "settings · panels",   artboards: 3, nodes: 174, edited: "1h ago",  status: "draft" },
  { name: "marketing · hero",    artboards: 2, nodes: 142, edited: "May 28",  status: "live" },
  { name: "mobile · nav",        artboards: 5, nodes: 98,  edited: "May 24",  status: "blocked" },
  { name: "empty states",        artboards: 6, nodes: 71,  edited: "May 19",  status: "draft" },
];

const SELECTED = "pricing · v3";

const fmt = (n: number) => n.toLocaleString("en-US");

export default function ComponentsTables() {
  const totalArtboards = CANVASES.reduce((s, r) => s + r.artboards, 0);
  const totalNodes = CANVASES.reduce((s, r) => s + r.nodes, 0);

  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-tables</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>tables</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Tables. Dense, tabular, calm.</h1>
          <p className="lede">
            A table is a layer tree laid flat — same hairline material, same mono
            numerics. Numbers right-align in tabular figures so columns scan as a
            ledger. Rows are <em>data</em>, not navigation: hover lifts to{" "}
            <code>--bg-3</code>, the selected row gets an <code>--accent-tint</code> wash
            and an inset bar — the accent never fills a whole row.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Material</dt><dd>panel · 1px hairline</dd></div>
          <div><dt>Numerics</dt><dd>mono · tabular-nums</dd></div>
          <div><dt>Hover</dt><dd>--bg-3</dd></div>
          <div><dt>Selected</dt><dd>--accent-tint</dd></div>
        </dl>

        <h2 data-no>Canvases <span className="h2-aside">sorted by nodes ↓</span></h2>
        <p>
          The current project's canvases. <strong>Nodes</strong> sorts descending — its
          header carries the active sort marker; the rest are sortable but idle.
        </p>
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col" className="tbl-check">
                  <input type="checkbox" aria-label="Select all canvases" />
                </th>
                <th scope="col" aria-sort="none">Canvas</th>
                <th scope="col" className="tbl-num" aria-sort="none">Artboards</th>
                <th scope="col" className="tbl-num" aria-sort="descending">Nodes</th>
                <th scope="col">Edited</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {CANVASES.map((r) => {
                const sel = r.name === SELECTED;
                const st = STATUS_META[r.status];
                return (
                  <tr key={r.name} aria-selected={sel || undefined}>
                    <td className="tbl-check">
                      <input
                        type="checkbox"
                        defaultChecked={sel}
                        aria-label={`Select ${r.name}`}
                      />
                    </td>
                    <td className="tbl-name">{r.name}</td>
                    <td className="tbl-num">{r.artboards}</td>
                    <td className="tbl-num">{fmt(r.nodes)}</td>
                    <td className="tbl-meta">{r.edited}</td>
                    <td>
                      <span className={`tbl-state ${st.cls}`}>
                        <span className="tbl-state-dot" aria-hidden="true" />
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Original move: an aggregate foot — totals in the same tabular column rhythm,
                so the table reads like a ledger that closes its own books. */}
            <tfoot>
              <tr>
                <td className="tbl-check" aria-hidden="true" />
                <td className="tbl-foot-label">{CANVASES.length} canvases</td>
                <td className="tbl-num">{fmt(totalArtboards)}</td>
                <td className="tbl-num">{fmt(totalNodes)}</td>
                <td className="tbl-meta" colSpan={2}>all in sync but one</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <h2 data-no>Anatomy <span className="h2-aside">three row states</span></h2>
        <p>
          One material, three states. Resting rows separate on the hairline alone;
          the surface only changes on intent (hover, selection).
        </p>
        <div className="panel tbl-wrap tbl-states-demo">
          <table className="tbl">
            <tbody>
              <tr><td className="tbl-name">Resting — hairline only</td><td className="tbl-num">240</td><td className="tbl-meta">--bg-1</td></tr>
              <tr className="tbl-force-hover"><td className="tbl-name">Hover — surface lifts</td><td className="tbl-num">198</td><td className="tbl-meta">--bg-3</td></tr>
              <tr aria-selected="true"><td className="tbl-name">Selected — tint + inset bar</td><td className="tbl-num">312</td><td className="tbl-meta">--accent-tint</td></tr>
            </tbody>
          </table>
        </div>

        <h2 data-no>Loading <span className="h2-aside">skeleton, never a spinner</span></h2>
        <div className="panel tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Canvas</th>
                <th scope="col" className="tbl-num">Nodes</th>
                <th scope="col">Edited</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i} className="tbl-skel-row">
                  <td><span className="tbl-skel" style={{ width: "58%" }} /></td>
                  <td className="tbl-num"><span className="tbl-skel" style={{ width: 40 }} /></td>
                  <td><span className="tbl-skel" style={{ width: "44%" }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-tables</span>
          <span>panel material · tabular-nums · rows are data, not navigation</span>
        </footer>
      </main>
    </>
  );
}
