/**
 * @canvas      ui_kits-desktop-index — the maude catalog / launcher. Links every
 *              specimen in the system, grouped by layer. Written last; links to peers.
 * @ds          maude
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MAUDE/ui_kits-desktop-index — Unified Pro Studio
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./ui_kits-desktop-index.css";

type Entry = { slug: string; title: string; note: string; sig?: boolean };
type Group = { id: string; label: string; entries: Entry[] };

const GROUPS: Group[] = [
  {
    id: "color",
    label: "Color & theme",
    entries: [
      { slug: "colors-accent", title: "Accent", note: "the one indigo, one job per surface", sig: true },
      { slug: "colors-surfaces", title: "Surfaces", note: "the dark elevation ladder · bg-0..4" },
      { slug: "colors-text", title: "Text", note: "fg-0..3 on panel + canvas" },
      { slug: "colors-status", title: "Status", note: "success / warn / error / info" },
      { slug: "colors-presence", title: "Presence", note: "collaborators + the agent's hue" },
      { slug: "colors-themes-side-by-side", title: "Themes", note: "dark + light, equal status" },
    ],
  },
  {
    id: "type",
    label: "Type & space",
    entries: [
      { slug: "type-scale", title: "Type scale", note: "Inter · the ~1.2 ladder" },
      { slug: "type-mono", title: "Mono", note: "coordinates, fields, tabular numerics" },
      { slug: "spacing-scale", title: "Spacing", note: "the 4px dense ladder" },
    ],
  },
  {
    id: "foundations",
    label: "Foundations",
    entries: [
      { slug: "grid", title: "Grid", note: "the dotted infinite canvas" },
      { slug: "borders", title: "Borders", note: "hairlines carry separation" },
      { slug: "radii", title: "Radii", note: "mild, crisp" },
      { slug: "elevation", title: "Elevation", note: "subtle on dark" },
      { slug: "focus", title: "Focus", note: "accent ring + tint halo" },
      { slug: "selection", title: "Selection", note: "accent-tint, never a fill" },
      { slug: "opacity", title: "Opacity", note: "tints, scrims, disabled" },
      { slug: "iconography", title: "Iconography", note: "1px stroke, IDE heritage" },
      { slug: "skeletons", title: "Skeletons", note: "calm loading in the material" },
      { slug: "motion", title: "Motion", note: "8 roles · crisp & snappy" },
    ],
  },
  {
    id: "components",
    label: "Components",
    entries: [
      { slug: "components-buttons", title: "Buttons", note: "variants · accent on primary only" },
      { slug: "components-inputs", title: "Inputs", note: "fields + focus ring" },
      { slug: "components-cards", title: "Cards", note: "the panel material" },
      { slug: "components-toggles", title: "Toggles", note: "switch · seg · checkbox" },
      { slug: "components-dialogs", title: "Dialogs", note: "modal · confirm · side panel" },
      { slug: "components-tooltips", title: "Tooltips", note: "anchored, with kbd hints" },
      { slug: "components-tables", title: "Tables", note: "dense, mono tabular columns" },
      { slug: "components-callout", title: "Callout", note: "info / success / warn / error" },
      { slug: "components-status", title: "Status", note: "badges · pipeline strip" },
    ],
  },
  {
    id: "pro",
    label: "Pro tool",
    entries: [
      { slug: "components-command-palette", title: "Command palette", note: "⌘K · frames · agent" },
      { slug: "components-shortcuts-overlay", title: "Shortcuts", note: "the cheat sheet" },
      { slug: "components-keyboard", title: "Keyboard", note: "keycaps · the map" },
      { slug: "components-list", title: "Lists", note: "layers tree · selection" },
      { slug: "components-toast-menu", title: "Toasts & menus", note: "context + dropdown" },
      { slug: "components-resize-panels", title: "Resize panels", note: "draggable splitters" },
    ],
  },
  {
    id: "brand",
    label: "Brand & voice",
    entries: [
      { slug: "logo", title: "Logo", note: "the selection-handle mark", sig: true },
      { slug: "empty-state", title: "Empty states", note: "calm prompts · voice keep/kill" },
    ],
  },
  {
    id: "use",
    label: "The DS in use",
    entries: [
      { slug: "ui_kits-desktop-showcase", title: "Studio showcase", note: "the whole instrument, assembled", sig: true },
    ],
  },
];

const href = (slug: string) => `/_canvas-shell.html?canvas=system/maude/preview/${slug}.tsx`;
const count = GROUPS.reduce((n, g) => n + g.entries.length, 0);

export default function UiKitsDesktopIndex() {
  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/index</span>
        <span className="crumbs"><span>maude</span><span>ui kit</span><span>catalog</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>maude — the studio, by part.</h1>
          <p className="lede">
            Every specimen in the Unified Pro Studio, one click away. Start at the
            <strong> Studio showcase</strong> to see the whole instrument assembled, or
            open <strong>Accent</strong> to understand the one rule the system runs on.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Specimens</dt><dd>{count}</dd></div>
          <div><dt>Accent</dt><dd>indigo · single</dd></div>
          <div><dt>Theme</dt><dd>dark default · light</dd></div>
          <div><dt>Signature</dt><dd>dotted canvas · one material</dd></div>
        </dl>

        {GROUPS.map((g) => (
          <section key={g.id}>
            <h2 data-no>{g.label} <span className="h2-aside">{g.entries.length}</span></h2>
            <div className="idx-grid">
              {g.entries.map((e) => (
                <a key={e.slug} className={`idx-card${e.sig ? " idx-card--sig" : ""}`} href={href(e.slug)}>
                  <span className="idx-card-title">{e.title}{e.sig && <span className="idx-sig">signature</span>}</span>
                  <span className="idx-card-note">{e.note}</span>
                  <span className="idx-card-slug">MAUDE/{e.slug}</span>
                </a>
              ))}
            </div>
          </section>
        ))}

        <footer className="specimen-ft">
          <span>MAUDE/index</span>
          <span>{count} specimens · dark default</span>
        </footer>
      </main>
    </>
  );
}
