/**
 * @canvas      components-toast-menu — transient chrome: toasts (agent finished /
 *              saved / error-with-undo) + a right-click context menu on a canvas
 *              node + a dropdown menu off a toolbar button. All share the panel
 *              material; reveals are bounded compositor-only soft fades (opacity +
 *              small transform, ≤ the panel's own box). Menu items carry mono .kbd
 *              hints in the trailing column so power users learn the binding while
 *              they reach for the mouse. No emoji — 1px-stroke geometric glyphs.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/components-toast-menu — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 *
 * SPECIMEN (from audience-pro-toast-menu): bottom-anchored toasts, contextual
 * menu, action chain on toast. RESTRUCTURED for the studio — the toasts report
 * studio events (the AGENT finished a draft, autosave, a failed handoff), the
 * context menu acts on a canvas NODE, and a third surface (a dropdown) is added.
 * Emoji status icons in the reference are replaced with inline 1px SVG glyphs
 * (brand hard-NO: no emoji in chrome).
 */
import type { ReactNode } from "react";
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-toast-menu.css";

/* ── 1px-stroke status glyphs (no emoji — terminal/IDE heritage) ─────────── */
function StatusGlyph({ kind }: { kind: "ok" | "agent" | "error" | "sync" }) {
  const common = {
    width: 16, height: 16, viewBox: "0 0 20 20", fill: "none",
    stroke: "currentColor", strokeWidth: 1.4,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "ok") return <svg {...common}><path d="M4 10.5l3.5 3.5L16 6" /></svg>;
  if (kind === "error") return <svg {...common}><path d="M10 5v6 M10 14h.01" /><circle cx="10" cy="10" r="7" strokeWidth={1.1} /></svg>;
  if (kind === "sync") return <svg {...common}><path d="M15 7a6 6 0 1 0 1 4 M15 3v4h-4" /></svg>;
  // agent — a small diamond cursor + spark, matching the agent presence language
  return <svg {...common}><path d="M10 3l4 7-4 7-4-7z M10 1v2 M10 17v2" /></svg>;
}

/* a small node glyph for the context-menu target preview */
function NodeChip() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h12v12H4z M4 8h12 M8 4v12" />
    </svg>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

type MenuItem =
  | { sep: true }
  | { label: string; keys: ReactNode[]; destructive?: boolean; glyph?: boolean; checked?: boolean };

const NODE_MENU: MenuItem[] = [
  { label: "Edit node", keys: [<Kbd key="e">⏎</Kbd>], glyph: true },
  { label: "Hand off to agent", keys: [<Kbd key="a">⌥</Kbd>, <Kbd key="h">H</Kbd>] },
  { label: "Send to inspector", keys: [<Kbd key="i">I</Kbd>] },
  { sep: true },
  { label: "Lock node", keys: [<Kbd key="l">⌘</Kbd>, <Kbd key="l2">L</Kbd>], checked: true },
  { label: "Copy as frame", keys: [<Kbd key="c">⌘</Kbd>, <Kbd key="c2">C</Kbd>] },
  { label: "Duplicate", keys: [<Kbd key="d">⌘</Kbd>, <Kbd key="d2">D</Kbd>] },
  { sep: true },
  { label: "Delete node", keys: [<Kbd key="x">⌫</Kbd>], destructive: true },
];

const EXPORT_MENU: MenuItem[] = [
  { label: "Export canvas…", keys: [<Kbd key="e">⌘</Kbd>, <Kbd key="e2">E</Kbd>], glyph: true },
  { label: "Copy frame as SVG", keys: [] },
  { label: "Copy as React", keys: [] },
  { sep: true },
  { label: "Hand off bundle…", keys: [<Kbd key="h">⇧</Kbd>, <Kbd key="h2">⌘</Kbd>, <Kbd key="h3">E</Kbd>] },
];

export default function ComponentsToastMenu() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-toast-menu</span>
        <span className="crumbs"><span>maude</span><span>component</span><span>toast · menu</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>Transient chrome. Toasts and menus.</h1>
          <p className="lede">
            The studio speaks in short bursts: the <strong>agent finished a draft</strong>,
            the canvas <strong>autosaved</strong>, a <strong>handoff failed</strong> — undo is
            right there. Menus act on whatever you right-clicked and carry the keyboard
            binding in the trailing column, so the mouse teaches your hands the shortcut.
            Reveals are bounded soft fades; reduced-motion collapses them to a cut.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Material</dt><dd>panel · shadow-md</dd></div>
          <div><dt>Reveal</dt><dd>opacity + 4px lift</dd></div>
          <div><dt>Success</dt><dd>auto-dismiss 4s</dd></div>
          <div><dt>Error</dt><dd>sticky · until acted</dd></div>
        </dl>

        <h2 data-no>Toasts <span className="h2-aside">terse · actionable · token-tinted</span></h2>
        <p>
          One line of what happened, one of detail, the action on the right. Success
          carries an Undo and clears itself; an error stays until you retry. The agent
          toast borrows the agent presence hue so you read <em>who</em> at a glance.
        </p>
        <div className="toast-stack">
          <div className="toast toast--agent motion-soft-once">
            <span className="toast-ic"><StatusGlyph kind="agent" /></span>
            <div className="toast-bd">
              <strong>Agent finished the Pricing draft.</strong>
              <span className="toast-sub">3 frames added · ready to review on the canvas.</span>
            </div>
            <div className="toast-act">
              <button className="btn btn--ghost btn--sm">Dismiss</button>
              <button className="btn btn--primary btn--sm">Review →</button>
            </div>
          </div>

          <div className="toast toast--ok motion-soft-once">
            <span className="toast-ic"><StatusGlyph kind="ok" /></span>
            <div className="toast-bd">
              <strong>Canvas saved.</strong>
              <span className="toast-sub">Snapshot at 14:02 · all collaborators in sync.</span>
            </div>
            <div className="toast-act">
              <button className="btn btn--ghost btn--sm">Undo</button>
            </div>
          </div>

          <div className="toast toast--sync motion-soft-once">
            <span className="toast-ic toast-ic--spin"><StatusGlyph kind="sync" /></span>
            <div className="toast-bd">
              <strong>Syncing inspector edits…</strong>
              <span className="toast-sub">7 of 12 nodes · keep working.</span>
            </div>
          </div>

          <div className="toast toast--error motion-soft-once">
            <span className="toast-ic"><StatusGlyph kind="error" /></span>
            <div className="toast-bd">
              <strong>Hand off failed.</strong>
              <span className="toast-sub">Registry unreachable — your edits are safe locally.</span>
            </div>
            <div className="toast-act">
              <button className="btn btn--ghost btn--sm">Details</button>
              <button className="btn btn--sm">Retry now</button>
            </div>
          </div>
        </div>

        <h2 data-no>Right-click on a node <span className="h2-aside">context menu · acts on selection</span></h2>
        <p>
          The menu names its target and offers node-scoped verbs. Checked rows show a
          tick; destructive rows lift to the error tint on hover. Bindings ride the
          trailing column.
        </p>
        <div className="menu-demo">
          <div className="menu-canvas" aria-hidden="true">
            <div className="md-node md-node--sel">
              <NodeChip /> Card · Pro
              <span className="md-handle tl" /><span className="md-handle br" />
            </div>
            <div className="md-caret" />
          </div>

          <div className="menu motion-soft-once" role="menu" aria-label="Node">
            <div className="menu-target">
              <NodeChip /> <span className="mt-name">Card · Pro</span>
              <span className="mt-meta mono">168×116</span>
            </div>
            {NODE_MENU.map((it, i) =>
              "sep" in it ? (
                <div className="menu-sep" key={"s" + i} role="separator" />
              ) : (
                <div
                  key={it.label}
                  className={"menu-item" + (it.destructive ? " is-destructive" : "")}
                  role="menuitem"
                >
                  <span className="mi-label">
                    {it.glyph && <span className="mi-glyph"><NodeChip /></span>}
                    {it.checked && (
                      <svg className="mi-check" width="13" height="13" viewBox="0 0 20 20" fill="none"
                        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 10.5l3.5 3.5L16 6" />
                      </svg>
                    )}
                    {it.label}
                  </span>
                  <span className="mi-keys">{it.keys}</span>
                </div>
              ),
            )}
          </div>
        </div>

        <h2 data-no>Dropdown off the toolbar <span className="h2-aside">same anatomy · button-triggered</span></h2>
        <p>
          A button-anchored menu is the identical material — only the trigger and the
          anchor edge differ. Export and handoff verbs, with their bindings.
        </p>
        <div className="dropdown-demo">
          <button className="btn dd-trigger" aria-expanded="true">
            Export
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
              strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </button>
          <div className="menu dd-menu motion-soft-once" role="menu" aria-label="Export">
            {EXPORT_MENU.map((it, i) =>
              "sep" in it ? (
                <div className="menu-sep" key={"s" + i} role="separator" />
              ) : (
                <div key={it.label} className="menu-item" role="menuitem">
                  <span className="mi-label">
                    {it.glyph && (
                      <svg className="mi-glyph" width="14" height="14" viewBox="0 0 20 20" fill="none"
                        stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 3v9 M6.5 8.5L10 12l3.5-3.5 M4 15h12" />
                      </svg>
                    )}
                    {it.label}
                  </span>
                  <span className="mi-keys">{it.keys}</span>
                </div>
              ),
            )}
          </div>
        </div>

        <footer className="specimen-ft">
          <span>MAUDE/components-toast-menu</span>
          <span>panel material · bounded soft reveal · mono kbd hints</span>
        </footer>
      </main>
    </>
  );
}
