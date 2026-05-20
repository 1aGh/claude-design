/**
 * @canvas      Docs Site — marketplace landing + standalone docs · re-skinned fumadocs (site/) under MDCC-DSN/01
 * @ds          project
 * @platform    desktop
 * @opt_out     palette
 * @artboards   landing | docs-index | docs-article | cmd-k | about
 * @brief       udelej navrh docs site. Vychazej z fumadocs co tam je ted ale priprav landing page a pak samostatny docs
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/docs-site/
 * @handoff     bunx shadcn add file://./Docs Site.registry.json
 */

import "./Docs Site.css";
import { DCArtboard, DCSection, DesignCanvas } from "@maude/canvas-lib";

/* ───────────────────────────────────────────────────────────────────── *
 *  Docs Site / MDCC-DSN/01                                              *
 *                                                                       *
 *  4 artboards composing the redesign of the Maude marketplace +    *
 *  standalone fumadocs site. Shared TopNav across all four; landing     *
 *  carries brand exuberance (within DS rules), docs are sparse-visual   *
 *  / interaction-dense.                                                 *
 * ───────────────────────────────────────────────────────────────────── */

// ─── Shared chrome ───────────────────────────────────────────────────
function TopNav({ active = "docs" }) {
  return (
    <header className="nav">
      <div className="nav-brand">
        <a href="/" className="wm">maude</a>
        <span className="sku">MDCC-MKT/00 · v0.12.0</span>
      </div>
      <nav className="nav-links" aria-label="Primary">
        <a href="/docs"     className={active === "docs"    ? "active" : ""}>Docs</a>
        <a href="/plugins"  className={active === "plugins" ? "active" : ""}>Plugins</a>
        <a href="https://github.com/1aGh/maude">Source <span aria-hidden="true">↗</span></a>
        <a href="/changelog">Changelog</a>
      </nav>
      <div className="nav-tools">
        <button type="button" className="nav-search" aria-label="Open command palette (Command K)" aria-keyshortcuts="Meta+K">
          <span className="glyph" aria-hidden="true">⌕</span>
          <span>Search anything. /commands work too.</span>
          <span className="kbd" aria-hidden="true">⌘K</span>
        </button>
        <div className="nav-theme" role="radiogroup" aria-label="Color theme">
          <button type="button" className="active" role="radio" aria-checked="true">
            Light<span className="sr"> theme</span>
          </button>
          <button type="button" role="radio" aria-checked="false">
            Dark<span className="sr"> theme</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Per-artboard SKU strip (catalog header inside the frame) ────────
function AbSku({ id, label, theme = "light", file }) {
  return (
    <div className="ab-sku" role="presentation">
      <span><b>{id}</b> · {label}</span>
      <span className="right">
        {file && <span>{file}</span>}
        <span className="ok" aria-hidden="true">● {theme.toUpperCase()}</span>
        <span>v0.12.0</span>
      </span>
    </div>
  );
}

// ─── Shared sidebar (docs surface only) ──────────────────────────────
function DocSidebar({ activeSlug }) {
  const is = (s) => activeSlug === s ? "active" : "";
  return (
    <aside className="doc-side" aria-label="Documentation tree">
      <div className="ver">
        <b>MDCC v0.12.0</b>
        <span className="arr">▾</span>
      </div>

      <section>
        <h4><span>GETTING STARTED</span><span className="sku">MDCC-DOC/00</span></h4>
        <ul>
          <li className={is("intro")}><a href="/docs">Introduction</a></li>
          <li className={is("install")}><a href="/docs/getting-started">Install · 3 steps</a></li>
          <li className={is("first-canvas")}><a href="/docs/getting-started#first-canvas">First canvas</a></li>
        </ul>
      </section>

      <section>
        <h4><span>CLI · MDCC</span><span className="sku">MDCC-CLI/03</span></h4>
        <ul>
          <li className={is("cli-init")}><a href="/docs/cli#init"><code>maude init</code></a></li>
          <li className={is("cli-config")}><a href="/docs/cli#config"><code>maude config</code></a></li>
          <li className={is("cli-design")}><a href="/docs/cli#design"><code>maude design serve</code></a></li>
          <li className={is("config")}><a href="/docs/config">workflows.config.json</a></li>
        </ul>
      </section>

      <section>
        <h4><span>DESIGN PLUGIN</span><span className="sku">MDCC-DSN/01</span></h4>
        <ul>
          <li className={is("design-overview")}><a href="/docs/design">Overview</a></li>
          <li className={is("design-init")}><a href="/docs/design/commands/init">/design:init</a></li>
          <li className={is("design-setup-ds")}><a href="/docs/design/commands/setup-ds">/design:setup-ds</a></li>
          <li className={is("canvas-new")}><a href="/docs/design/commands/new">/design:new</a></li>
          <li className="nested"><a href="#perfect-mode">→ --perfect mode</a></li>
          <li className="nested"><a href="#opt-out-scope">→ opt-out scopes</a></li>
          <li className={is("design-edit")}><a href="/docs/design/commands/edit">/design:edit</a></li>
          <li className={is("design-critic")}><a href="/docs/design/commands/critic">/design:critic</a></li>
          <li className={is("design-handoff")}><a href="/docs/design/commands/handoff">/design:handoff</a></li>
        </ul>
      </section>

      <section>
        <h4><span>FLOW PLUGIN</span><span className="sku">MDCC-FLW/02</span></h4>
        <ul>
          <li className={is("flow-overview")}><a href="/docs/flow">Overview</a></li>
          <li className={is("flow-plan")}><a href="/docs/flow/commands/plan">/flow:plan</a></li>
          <li className={is("flow-execute")}><a href="/docs/flow/commands/execute">/flow:execute</a></li>
          <li className={is("flow-done")}><a href="/docs/flow/commands/done">/flow:done</a></li>
          <li className={is("flow-validate")}><a href="/docs/flow/commands/validate">/flow:validate</a></li>
        </ul>
      </section>

      <section>
        <h4><span>RECIPES</span><span className="sku">MDCC-DOC/04</span></h4>
        <ul>
          <li><a href="/docs/recipes/first-plugin">Author your first plugin</a></li>
          <li><a href="/docs/recipes/release-flow">Release flow · npm + tag</a></li>
        </ul>
      </section>

      <section>
        <h4><span>REFERENCE</span><span className="sku">MDCC-DOC/05</span></h4>
        <ul>
          <li><a href="/docs/reference/config-schema">workflows.config.json schema</a></li>
          <li><a href="/docs/reference/plugin-manifest">plugin.json manifest</a></li>
          <li><a href="/docs/reference/marketplace">marketplace.json</a></li>
        </ul>
      </section>

      <section>
        <h4><span>MAKER</span><span className="sku">MDCC-MKR/01</span></h4>
        <ul>
          <li className={is("about")}><a href="/docs/about">About the maker</a></li>
        </ul>
      </section>
    </aside>
  );
}

// ─── Right-rail TOC ──────────────────────────────────────────────────
function DocTOC({ items, activeIdx = 0 }) {
  return (
    <aside className="doc-toc" aria-label="On this page">
      <h5>ON THIS PAGE</h5>
      <ol>
        {items.map((it, i) => (
          <li key={it.id} className={[it.level === 3 ? "h3" : "", i === activeIdx ? "active" : ""].join(" ").trim()}>
            <a href={`#${it.id}`}>{it.label}</a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 1 · LANDING — marketplace catalog cover
// ═════════════════════════════════════════════════════════════════════
function ArtboardLanding() {
  return (
    <div className="ab">
      <a href="#land-h1" className="skip">Skip to content</a>
      <AbSku id="DS-01" label="MARKETPLACE LANDING" file="maude.iagh.cz/" />
      <TopNav active="plugins" />
      <div className="land">

        <section className="land-hero" aria-labelledby="land-h1">
          <div>
            <div className="land-hero-eyebrow">
              <span className="stamp">MDCC-MKT/00</span>
              <span aria-hidden="true">·</span>
              <span>THE CATALOG</span>
              <span aria-hidden="true">·</span>
              <span>v0.12.0</span>
              <span aria-hidden="true">·</span>
              <span>PUBLISHED 2026-05-09</span>
            </div>
            <h1 id="land-h1">Plugins & Vibes<span style={{color:"var(--accent)"}}>.</span></h1>
            <p className="punchline">A Claude&nbsp;Code marketplace. Two plugins, one CLI, some <span className="acc">vibes</span>.</p>
            <p>
              Two plugins, one CLI, zero feelings about your CSS framework.
              <code>design</code> iterates on HTML mocks until they stop being embarrassing.
              <code>flow</code> runs the agentic loop until the feature actually ships.
              <code>maude</code> scaffolds the second-brain <code>.ai/</code> workspace they both pretend they could live without.
            </p>
            <p style={{color:"var(--fg-2)", fontSize:"var(--type-sm)", maxWidth:"60ch"}}>
              Open-source. Catalog-graded. No telemetry, no signup, no <em style={{fontStyle:"normal", textDecoration:"line-through", textDecorationColor:"var(--accent)"}}>book a demo</em> button. If it crashes, you <code style={{background:"transparent",border:0,padding:0,color:"var(--accent)"}}>git pull</code> and try again. That's the entire support contract.
            </p>
            <div className="cta-row">
              <a href="/docs" className="btn accent">Read the docs <span aria-hidden="true">→</span></a>
              <a href="/plugins" className="btn ghost">Browse plugins</a>
              <a
                href="https://buymeacoffee.com/"
                className="btn bmac"
                aria-label="Tip the maintainer on Buy Me A Coffee"
              >
                <span className="stamp">TIP</span>
                Buy me a coffee <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <div className="land-snippet" role="region" aria-label="Install snippet">
            <div className="hd">
              <span><b>install.sh</b> · inside Claude Code</span>
              <button type="button" className="copy" aria-label="Copy snippet">COPY</button>
            </div>
            <pre>
<span className="cmt"># 1. add the marketplace</span>{"\n"}
<span className="prompt">$</span> <span className="acc">/plugin</span> marketplace add 1aGh/maude{"\n"}
{"\n"}
<span className="cmt"># 2. install plugins</span>{"\n"}
<span className="prompt">$</span> <span className="acc">/plugin</span> install design@maude{"\n"}
<span className="prompt">$</span> <span className="acc">/plugin</span> install flow@maude{"\n"}
{"\n"}
<span className="cmt"># optional. scaffold a project from CLI</span>{"\n"}
<span className="prompt">$</span> npm i -g @1agh/maude{"\n"}
<span className="prompt">$</span> <span className="acc">maude</span> init --name my-app
            </pre>
          </div>
        </section>

        <section className="land-catalog" aria-labelledby="cat-h">
          <div className="land-catalog-hd">
            <h2 id="cat-h">The catalog<span style={{color:"var(--accent)"}}>.</span></h2>
            <span className="num">03 SHIPPING UNITS · ALL · v0.12.0</span>
          </div>
          <div className="grid">

            <article className="pcard">
              <div className="row1"><span className="sku">MDCC-DSN/01 · design</span><span className="ver">v0.12.0</span></div>
              <h3><code>design</code> Iterates canvases until they stop being embarrassing.</h3>
              <p>Canvas-first iteration on HTML/JSX mocks. Includes a zero-dep dev server with element inspector overlay (Cmd+Click → selection lands on disk for the next /design:edit).</p>
              <div className="tags"><span>commands · 12</span><span>skills · 4</span><span>critics · 9</span></div>
              <div className="install">
                <code>/plugin install design@maude</code>
                <button type="button" className="copy" aria-label="Copy install command for design plugin">COPY</button>
              </div>
              <div className="foot"><span>last update · 2 days ago</span><a href="/docs/design">DOCS <span aria-hidden="true">→</span></a></div>
            </article>

            <article className="pcard">
              <div className="row1"><span className="sku">MDCC-FLW/02 · flow</span><span className="ver">v0.12.0</span></div>
              <h3><code>flow</code> The agentic loop that ships things eventually.</h3>
              <p>Generic agentic workflow loop with a second-brain <code className="acc">.ai/</code> workspace. Project-agnostic via per-repo <code className="acc">workflows.config.json</code>. Plan → execute → done → validate.</p>
              <div className="tags"><span>commands · 28</span><span>skills · 14</span><span>agents · 4</span></div>
              <div className="install">
                <code>/plugin install flow@maude</code>
                <button type="button" className="copy" aria-label="Copy install command for flow plugin">COPY</button>
              </div>
              <div className="foot"><span>last update · 2 days ago</span><a href="/docs/flow">DOCS <span aria-hidden="true">→</span></a></div>
            </article>

            <article className="pcard">
              <div className="row1"><span className="sku">MDCC-CLI/03 · maude</span><span className="ver">v0.12.0</span></div>
              <h3><code>maude</code> The plumbing the other two pretend not to need.</h3>
              <p>Scaffolds the <code className="acc">.ai/</code> workspace, edits <code className="acc">workflows.config.json</code>, and boots the design dev server. Ships <code className="acc">maude</code> and the back-compat alias <code className="acc">claude-design-server</code>.</p>
              <div className="tags"><span>subcommands · 3</span><span>node ≥ 20</span><span>zero deps</span></div>
              <div className="install">
                <code>npm i -g @1agh/maude</code>
                <button type="button" className="copy" aria-label="Copy install command for maude CLI">COPY</button>
              </div>
              <div className="foot"><span>last update · 5 days ago</span><a href="/docs/cli">DOCS <span aria-hidden="true">→</span></a></div>
            </article>

          </div>
        </section>

        <footer className="land-foot">
          <div className="meta" style={{gridColumn:"1 / -1", paddingBottom:"var(--space-3)", borderBottom:"1px solid var(--border-default)", marginBottom:"var(--space-3)", justifyContent:"space-between"}}>
            <span style={{color:"var(--accent)", border:"1px solid var(--accent)", background:"var(--accent-tint)", padding:"1px 6px", fontWeight:700}}>MDCC-MKR/01 · MICHAL</span>
            <span style={{color:"var(--fg-1)", textTransform:"none", letterSpacing:"normal", fontWeight:500}}>Hi I'm Michal, I made this. Open issues if it breaks.</span>
          </div>
          <div className="meta">
            <span>PUBLISHED <b>2026-05-09</b></span>
            <span>·</span>
            <span>LICENSE <b>MIT</b></span>
            <span>·</span>
            <span>CONTRIBUTORS <b>4</b></span>
            <span>·</span>
            <span className="ok">● BUILD GREEN</span>
          </div>
          <div className="meta" style={{justifyContent:"flex-end"}}>
            <a href="https://github.com/1aGh/maude">GITHUB <span aria-hidden="true">↗</span></a>
            <span aria-hidden="true">·</span>
            <a href="/changelog">CHANGELOG</a>
            <span aria-hidden="true">·</span>
            <a href="/rss.xml">RSS</a>
            <span aria-hidden="true">·</span>
            <span>BUILT WITH <b>FUMADOCS</b></span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 2 · DOCS · INDEX — /docs root with tile grid
// ═════════════════════════════════════════════════════════════════════
function ArtboardDocsIndex() {
  const toc = [
    { id: "what-it-is", label: "What Maude is", level: 2 },
    { id: "sections",   label: "Documentation sections", level: 2 },
    { id: "getting-started", label: "Three commands and you're in. (Maybe four. Depends on your shell.)", level: 3 },
    { id: "support",    label: "Support & contributing", level: 2 },
  ];
  return (
    <div className="ab">
      <a href="#docs-index-main" className="skip">Skip to content</a>
      <AbSku id="DS-02" label="DOCS · INDEX" file="/docs" />
      <TopNav active="docs" />
      <div className="docs">
        <DocSidebar activeSlug="intro" />

        <main className="doc-main" id="docs-index-main">
          <nav className="doc-crumb" aria-label="Breadcrumb">
            <a href="/docs">Docs</a>
            <span className="sep" aria-hidden="true">/</span>
            <span className="cur" aria-current="page">Introduction</span>
            <span className="sku-tail">MDCC-DOC/00 · index</span>
          </nav>

          <h1 className="doc-h1">maude, how it works mostly</h1>
          <p className="doc-lede">
            Two plugins, one CLI, and the <code>.ai/</code> workspace they both pretend not to need.
            You're probably here for <code>design</code> or <code>flow</code>. <code>maude</code> is
            the plumbing. <code>⌘K</code> skips ahead.
          </p>

          <h2 id="what-it-is" className="doc-h2"><span className="num">01</span><span>What it is</span></h2>
          <p className="doc-p">
            <code>maude</code> is a single repo that publishes (a) a Claude Code plugin marketplace defined by
            <code>.claude-plugin/marketplace.json</code> and (b) an npm package
            (<code>@1agh/maude</code>) that ships the <code>maude</code> CLI plus the dev-server runtime helpers.
            The marketplace surfaces the <code>design</code> and <code>flow</code> plugins; <code>maude init</code>
            scaffolds a project against either one.
          </p>
          <p className="doc-p">
            All three artifacts (npm package + both plugins) share <a href="/docs/reference/version-parity">one version
            number</a>. CI enforces parity on every PR that touches <code>package.json</code> or a plugin manifest.
          </p>

          <h2 id="sections" className="doc-h2"><span className="num">02</span><span>Documentation sections</span></h2>
          <div className="doc-tiles">
            <a href="/docs/getting-started" className="doc-tile">
              <span className="sku">MDCC-DOC/00 · entry</span>
              <h4>Getting started</h4>
              <p>Install the marketplace, install <code>design</code> + <code>flow</code>, scaffold a project, open your first canvas.</p>
              <span className="pages"><b>3</b> PAGES · 5 MIN</span>
            </a>
            <a href="/docs/cli" className="doc-tile">
              <span className="sku">MDCC-CLI/03 · cli</span>
              <h4>The maude CLI</h4>
              <p>Three subcommands: <code>init</code>, <code>config</code>, <code>design serve</code>. Plus the back-compat <code>claude-design-server</code> alias.</p>
              <span className="pages"><b>4</b> PAGES · 8 MIN</span>
            </a>
            <a href="/docs/design" className="doc-tile">
              <span className="sku">MDCC-DSN/01 · design</span>
              <h4>Design plugin</h4>
              <p>Canvas-first iteration on HTML/JSX mocks. <code>/design:new</code>, <code>/design:edit</code>, the critic panel, handoff to production code.</p>
              <span className="pages"><b>12</b> COMMANDS · 4 SKILLS</span>
            </a>
            <a href="/docs/flow" className="doc-tile">
              <span className="sku">MDCC-FLW/02 · flow</span>
              <h4>Flow plugin</h4>
              <p>The agentic loop: plan → execute → done → validate. Plus the <code>.ai/</code> workspace and the recall layer.</p>
              <span className="pages"><b>28</b> COMMANDS · 14 SKILLS</span>
            </a>
            <a href="/docs/recipes" className="doc-tile">
              <span className="sku">MDCC-DOC/04 · recipes</span>
              <h4>Recipes</h4>
              <p>End-to-end walkthroughs. Author your first plugin · publish to npm · ship a release with the standard tag flow.</p>
              <span className="pages"><b>6</b> RECIPES</span>
            </a>
            <a href="/docs/reference" className="doc-tile">
              <span className="sku">MDCC-DOC/05 · ref</span>
              <h4>Reference</h4>
              <p><code>plugin.json</code> manifest schema · <code>workflows.config.json</code> schema · marketplace contract · release flow.</p>
              <span className="pages"><b>9</b> REFERENCE PAGES</span>
            </a>
          </div>

          <h3 id="getting-started" className="doc-h3">Three commands and you're in. (Maybe four. Depends on your shell.)</h3>
          <p className="doc-p">
            From a brand-new Claude Code session, run the three commands below. After
            <code>maude init</code>, the <code>.ai/</code> directory exists and you can start with
            <code>/flow:plan "first feature"</code> or open a canvas with <code>/design:new</code>.
          </p>

          <div className="cblock">
            <div className="cblock-hd">
              <div className="cblock-tabs">
                <button type="button" className="cblock-tab active">CLAUDE&nbsp;CODE</button>
                <button type="button" className="cblock-tab">SHELL</button>
              </div>
              <div className="cblock-tools">
                <span className="lang">BASH</span>
                <button type="button" className="copy">COPY</button>
              </div>
            </div>
            <pre>
<span className="prompt">›</span> <span className="acc">/plugin</span> marketplace add 1aGh/maude{"\n"}
<span className="prompt">›</span> <span className="acc">/plugin</span> install design@maude{"\n"}
<span className="prompt">›</span> <span className="acc">/plugin</span> install flow@maude{"\n"}
{"\n"}
<span className="cmt"># optional. scaffold .ai/ + workflows.config.json</span>{"\n"}
<span className="prompt">$</span> <span className="acc">maude</span> init --name my-app
            </pre>
          </div>

          <h2 id="support" className="doc-h2"><span className="num">03</span><span>Support &amp; contributing</span></h2>
          <p className="doc-p">
            File issues at <a href="https://github.com/1aGh/maude/issues">github.com/1aGh/maude/issues</a>.
            PRs welcome. Start with <a href="/docs/recipes/first-plugin">"Author your first plugin"</a> for the contributing
            walkthrough. The repo dogfoods <code>flow</code> on itself, so the <code>.ai/decisions/</code> directory is
            the authoritative log of why things are the way they are.
          </p>

          <div className="doc-pagefoot">
            <a href="https://github.com/1aGh/maude/edit/main/site/content/docs/index.mdx">EDIT THIS PAGE ON GITHUB</a>
            <span>LAST UPDATED <b style={{color:"var(--fg-0)"}}>2026-05-12</b></span>
            <span className="slug">DOCS/INDEX · MDCC-DOC/00</span>
          </div>
        </main>

        <DocTOC items={toc} activeIdx={1} />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 3 · DOCS · ARTICLE — /docs/design/commands/new spec sheet
// ═════════════════════════════════════════════════════════════════════
function ArtboardDocsArticle() {
  const toc = [
    { id: "what-it-does", label: "What it does", level: 2 },
    { id: "usage", label: "Usage", level: 2 },
    { id: "perfect-mode", label: "--perfect mode", level: 3 },
    { id: "opt-out-scope", label: "Opt-out scopes", level: 3 },
    { id: "options", label: "Options", level: 2 },
    { id: "examples", label: "Examples", level: 2 },
    { id: "related", label: "Related commands", level: 2 },
  ];
  return (
    <div className="ab">
      <a href="#docs-article-main" className="skip">Skip to content</a>
      <AbSku id="DS-03" label="DOCS · ARTICLE · /design:new" file="/docs/design/commands/new" />
      <TopNav active="docs" />
      <div className="docs">
        <DocSidebar activeSlug="canvas-new" />

        <main className="doc-main" id="docs-article-main">
          <nav className="doc-crumb" aria-label="Breadcrumb">
            <a href="/docs">Docs</a><span className="sep" aria-hidden="true">/</span>
            <a href="/docs/design">design</a><span className="sep" aria-hidden="true">/</span>
            <a href="/docs/design/commands">commands</a><span className="sep" aria-hidden="true">/</span>
            <span className="cur">new</span>
            <span className="sku-tail">MDCC-DSN/01.canvas-new</span>
          </nav>

          <h1 className="doc-h1">/design:new</h1>
          <p className="doc-lede">
            Scaffold a new multi-artboard canvas file in <code>&lt;designRoot&gt;/&lt;newCanvasDir&gt;/&lt;Name&gt;.html</code>.
            Default mode is <code>--perfect</code>. Full critic panel, up to 8 fix iterations, target 4.5/5
            aspiration score. Opt out with <code>--quick</code> or <code>--no-critic</code>.
          </p>

          <h2 id="what-it-does" className="doc-h2"><span className="hash">#</span><span className="num">01</span><span>What it does</span></h2>
          <p className="doc-p">
            <code>/design:new</code> is the entry-point for a new canvas project. A canvas project is one
            <code>DesignCanvas</code> wrapper containing one or more <code>DCSection</code>, each holding one or
            more <code>DCArtboard</code>. Single-page HTML wrappers are an anti-pattern; a new screen should be
            added as another <code>DCArtboard</code> to an existing canvas via
            <code>/design:edit "&lt;add new artboard for X&gt;"</code>, not via this command.
          </p>
          <p className="doc-p">
            The command is delegated to the <code>frontend-design</code> skill when available. See
            <a href="/docs/design/skills/frontend-design">skills/frontend-design</a> for the generation envelope contract.
            On generation failure the orchestrator falls back to direct generation and surfaces the fact in the
            final print (no silent downgrade).
          </p>

          <h2 id="usage" className="doc-h2"><span className="hash">#</span><span className="num">02</span><span>Usage</span></h2>

          <div className="cblock">
            <div className="cblock-hd">
              <div className="cblock-tabs">
                <button type="button" className="cblock-tab active">SIGNATURE</button>
              </div>
              <div className="cblock-tools">
                <span className="lang">BASH</span>
                <button type="button" className="copy">COPY</button>
              </div>
            </div>
            <pre>
<span className="acc">/design:new</span> <span className="str">"&lt;Name&gt;"</span> <span className="str">"&lt;brief&gt;"</span> <span className="cmt">\</span>{"\n"}
  [<span className="key">--component</span>] [<span className="key">--mobile</span>] <span className="cmt">\</span>{"\n"}
  [<span className="key">--quick</span> | <span className="key">--no-critic</span>] [<span className="key">--perfect-iter</span> N] <span className="cmt">\</span>{"\n"}
  [<span className="key">--ds</span>=&lt;name&gt;] [<span className="key">--opt-out</span>=palette|aesthetic|full]
            </pre>
          </div>

          <h3 id="perfect-mode" className="doc-h3">--perfect mode (default)</h3>
          <p className="doc-p">
            Initial scaffold sets the canvas trajectory for every future <code>/design:edit</code>; cheap to leave
            unpolished, expensive to refactor backwards. So the critic panel is always-on, always-full, always
            targeting portfolio-grade output.
          </p>

          <div className="callout warn">
            <div className="ico">!</div>
            <div className="body">
              <span className="label">TOKEN COST · 150-300K</span>
              <code>--perfect</code> spawns up to 8 critic iterations across a minimum 4-agent panel,
              roughly <b style={{color:"var(--fg-0)"}}>40+ subagent calls</b> per invocation, totalling
              <b style={{color:"var(--fg-0)"}}>~150-300k tokens</b> and 5-15 min wall time. If your session context is already
              60%+ full the orchestrator surfaces a confirmation question before starting the loop, never silently
              downgrades. Opt out explicitly with <code>--quick</code> (single critic, 2 iterations) or
              <code>--no-critic</code> (skip the loop entirely).
            </div>
          </div>

          <h3 id="opt-out-scope" className="doc-h3">Opt-out scopes</h3>
          <p className="doc-p">
            <code>--opt-out=palette</code> (default) keeps the tokens link + <code>rootClass</code> envelope but
            allows a local namespaced palette override. <code>aesthetic</code> additionally permits gradients,
            off-ladder radii, alt type pairings, and decorative SVGs.
            <code>full</code> treats the design system as advisory. Accessibility is enforced at every scope
            regardless. WCAG AA never downgrades.
          </p>

          <h2 id="options" className="doc-h2"><span className="hash">#</span><span className="num">03</span><span>Options</span></h2>
          <p className="doc-p">
            All flags can be combined. <code>--component</code> writes a JSX component to <code>newComponentDir</code> instead
            of an HTML canvas to <code>newCanvasDir</code>. <code>--mobile</code> hints mobile chrome to the generation
            envelope; auto-detected when <code>&lt;Name&gt;</code> contains "Mobile", "iOS", or "Android".
          </p>

          <div className="callout tip">
            <div className="ico">i</div>
            <div className="body">
              <span className="label">RECOMMENDED</span>
              For exploration where you only want to see if a layout pencils out, pass <code>--quick</code>. For
              dialed-in production designs leave <code>--perfect</code> default-on. The cost is real, but so is the
              quality delta. Mid-range work (4-6 fix iterations) is what <code>--perfect-iter</code> exists for.
            </div>
          </div>

          <h2 id="examples" className="doc-h2"><span className="hash">#</span><span className="num">04</span><span>Examples</span></h2>

          <div className="cblock">
            <div className="cblock-hd">
              <div className="cblock-file"><b>terminal</b> · inside Claude Code</div>
              <div className="cblock-tools">
                <span className="lang">BASH</span>
                <button type="button" className="copy ok">✓ COPIED</button>
              </div>
            </div>
            <pre>
<span className="cmt"># default. full --perfect loop, 4 artboards, desktop</span>{"\n"}
<span className="prompt">›</span> <span className="acc">/design:new</span> <span className="str">"Match Recap"</span> \{"\n"}
    <span className="str">"3 artboards: hero stat card, key moments timeline, share/embed"</span>{"\n"}
{"\n"}
<span className="cmt"># quick. exploration, 1 critic, max 2 fix iter</span>{"\n"}
<span className="prompt">›</span> <span className="acc">/design:new</span> <span className="str">"Scout Radar"</span> <span className="str">"radar sweep finder"</span> <span className="key">--quick</span>{"\n"}
{"\n"}
<span className="cmt"># mobile + scoped opt-out for off-system exploration</span>{"\n"}
<span className="prompt">›</span> <span className="acc">/design:new</span> <span className="str">"iOS Signup"</span> <span className="str">"5-step flow"</span> <span className="key">--mobile</span> <span className="key">--opt-out=aesthetic</span>{"\n"}
{"\n"}
<span className="cmt"># component instead of full canvas, lands in newComponentDir</span>{"\n"}
<span className="prompt">›</span> <span className="acc">/design:new</span> MatchRecap <span className="str">"stat-card React component"</span> <span className="key">--component</span>
            </pre>
          </div>

          <h2 id="related" className="doc-h2"><span className="hash">#</span><span className="num">05</span><span>Related commands</span></h2>
          <p className="doc-p">
            <a href="/docs/design/commands/edit">/design:edit</a> iterates on the active canvas in place.
            <a href="/docs/design/commands/critic">/design:critic</a> runs the panel manually.
            <a href="/docs/design/commands/screenshot">/design:screenshot</a> captures the active canvas for review.
            <a href="/docs/design/commands/rollback">/design:rollback</a> restores a snapshot from <code>_history/</code>.
          </p>

          <nav className="pager" aria-label="Page navigation">
            <a href="/docs/design/commands/setup-ds">
              <span className="arr"><b>←</b> PREVIOUS · MDCC-DSN/01</span>
              <span className="title">/design:setup-ds</span>
            </a>
            <a href="/docs/design/commands/edit" className="next">
              <span className="arr">NEXT · MDCC-DSN/01 <b>→</b></span>
              <span className="title">/design:edit</span>
            </a>
          </nav>

          <div className="doc-pagefoot">
            <a href="https://github.com/1aGh/maude/edit/main/plugins/design/commands/new.md">EDIT THIS PAGE ON GITHUB</a>
            <span>LAST UPDATED <b style={{color:"var(--fg-0)"}}>2026-05-14</b></span>
            <span className="slug">design / commands / new · MDCC-DSN/01.canvas-new</span>
          </div>
        </main>

        <DocTOC items={toc} activeIdx={2} />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 4 · CMD-K · GLOBAL PALETTE (modal over docs)
// ═════════════════════════════════════════════════════════════════════
function ArtboardCmdK() {
  return (
    <div className="ab">
      <AbSku id="DS-04" label="CMD-K · GLOBAL PALETTE" file="modal · over /docs/design/commands/new" />
      <TopNav active="docs" />
      {/* Underlying docs page — fully inert, hidden from AT + tab order */}
      <div className="docs" aria-hidden="true" inert="" style={{opacity:0.55, filter:"saturate(0.4)"}}>
        <DocSidebar activeSlug="canvas-new" />
        <main className="doc-main">
          <div className="doc-crumb">
            <span>Docs</span><span className="sep" aria-hidden="true">/</span>
            <span>design</span><span className="sep" aria-hidden="true">/</span>
            <span className="cur">new</span>
            <span className="sku-tail">MDCC-DSN/01.canvas-new</span>
          </div>
          <p className="doc-h1" style={{margin:0}}>/design:new</p>
          <p className="doc-lede">Scaffold a new multi-artboard canvas file in
            <code>&lt;designRoot&gt;/&lt;newCanvasDir&gt;/&lt;Name&gt;.html</code>...</p>
          <p className="doc-p">Entry-point for a new canvas project. A canvas project is one
            <code>DesignCanvas</code> wrapper containing one or more <code>DCSection</code>...</p>
        </main>
        <DocTOC items={[
          { id: "x", label: "What it does", level: 2 },
          { id: "y", label: "Usage", level: 2 },
          { id: "z", label: "Options", level: 2 },
        ]} activeIdx={0} />
      </div>

      <div className="cmdk-backdrop" role="presentation">
        <div className="cmdk" role="dialog" aria-labelledby="cmdk-title" aria-modal="true">
          <h2 id="cmdk-title" className="sr">Search docs, plugins, commands and skills</h2>
          <div className="cmdk-hd">
            <span className="prompt" aria-hidden="true">⌕</span>
            <label htmlFor="cmdk-input" className="sr">Search query</label>
            <input
              id="cmdk-input"
              type="search"
              defaultValue="design new"
              placeholder="Search anything. /commands work too."
              aria-describedby="cmdk-hint"
            />
            <span className="esc" aria-hidden="true">ESC</span>
          </div>
          <div className="cmdk-body">

            <div className="cmdk-group">
              <h6><span>COMMANDS · 4</span><span>MDCC-DSN/01 · MDCC-FLW/02</span></h6>
              <div className="cmdk-row active">
                <span className="glyph">▸</span>
                <span className="label">/<b>design</b>:<b>new</b> <span style={{color:"var(--fg-2)"}}>"&lt;Name&gt;" "&lt;brief&gt;" [flags]</span></span>
                <span className="crumb">DESIGN · COMMANDS</span>
              </div>
              <div className="cmdk-row">
                <span className="glyph">▸</span>
                <span className="label">/<b>design</b>:<b>edit</b> <span style={{color:"var(--fg-2)"}}>"&lt;feedback&gt;" [--perfect N]</span></span>
                <span className="crumb">DESIGN · COMMANDS</span>
              </div>
              <div className="cmdk-row">
                <span className="glyph">▸</span>
                <span className="label">/<b>design</b>:setup-<b>ds</b> <span style={{color:"var(--fg-2)"}}>&lt;name&gt; "&lt;brief&gt;"</span></span>
                <span className="crumb">DESIGN · COMMANDS</span>
              </div>
              <div className="cmdk-row">
                <span className="glyph">▸</span>
                <span className="label">/<b>flow</b>:plan <span style={{color:"var(--fg-2)"}}>"&lt;feature title&gt;"</span></span>
                <span className="crumb">FLOW · COMMANDS</span>
              </div>
            </div>

            <div className="cmdk-group">
              <h6><span>PLUGINS · 2</span><span>v0.12.0</span></h6>
              <div className="cmdk-row">
                <span className="glyph">●</span>
                <span className="label"><b>design</b> · MDCC-DSN/01 <span style={{color:"var(--fg-2)"}}>· canvas-first iteration</span></span>
                <span className="crumb">PLUGINS</span>
              </div>
              <div className="cmdk-row">
                <span className="glyph">●</span>
                <span className="label"><b>flow</b> · MDCC-FLW/02 <span style={{color:"var(--fg-2)"}}>· agentic workflow loop</span></span>
                <span className="crumb">PLUGINS</span>
              </div>
            </div>

            <div className="cmdk-group">
              <h6><span>SKILLS · 3</span><span>AUTO-LOADED</span></h6>
              <div className="cmdk-row">
                <span className="glyph">○</span>
                <span className="label"><b>design</b>-system <span style={{color:"var(--fg-2)"}}>· read DS context or bootstrap a new one</span></span>
                <span className="crumb">DESIGN · SKILLS</span>
              </div>
              <div className="cmdk-row">
                <span className="glyph">○</span>
                <span className="label">frontend-<b>design</b> <span style={{color:"var(--fg-2)"}}>· generate distinctive frontend code</span></span>
                <span className="crumb">EXTERNAL · SKILLS</span>
              </div>
              <div className="cmdk-row">
                <span className="glyph">○</span>
                <span className="label"><b>design</b>:ui-kit <span style={{color:"var(--fg-2)"}}>· reference prototypes for surfaces</span></span>
                <span className="crumb">DESIGN · SKILLS</span>
              </div>
            </div>

            <div className="cmdk-group">
              <h6><span>PAGES · 2</span><span>FUZZY MATCH "design new"</span></h6>
              <div className="cmdk-row">
                <span className="glyph">¶</span>
                <span className="label"><b>/design</b>:<b>new</b> · What it does</span>
                <span className="crumb">DOCS / DESIGN / COMMANDS / NEW · 01</span>
              </div>
              <div className="cmdk-row">
                <span className="glyph">¶</span>
                <span className="label"><b>--perfect</b> mode <span style={{color:"var(--fg-2)"}}>· token cost 150-300k</span></span>
                <span className="crumb">DOCS / DESIGN / COMMANDS / NEW · 02</span>
              </div>
            </div>

          </div>
          {/* No-results template (canonical empty-state copy, hidden in this specimen since the query "design new" hits) */}
          <div className="cmdk-empty" hidden aria-hidden="true">
            <p>No results for "<b>design new</b>". Try a shorter word, or hit /commands directly.</p>
          </div>
          <div className="cmdk-foot" id="cmdk-hint">
            <span><kbd aria-label="Arrow up and arrow down">↑↓</kbd>NAVIGATE</span>
            <span><kbd aria-label="Enter">↵</kbd>OPEN</span>
            <span><kbd aria-label="Command Enter">⌘↵</kbd>OPEN IN NEW TAB</span>
            <span style={{marginLeft:"auto"}}>POWERED BY <b>ORAMA</b> · INDEX 2026-05-14</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 5 · DOCS · ABOUT · /docs/about page, the Michal layer
// ═════════════════════════════════════════════════════════════════════
function ArtboardAbout() {
  return (
    <div className="ab">
      <a href="#docs-about-main" className="skip">Skip to content</a>
      <AbSku id="DS-05" label="DOCS · ABOUT" file="/docs/about" />
      <TopNav active="docs" />
      <div className="docs">
        <DocSidebar activeSlug="about" />

        <main className="doc-main" id="docs-about-main">
          <nav className="doc-crumb" aria-label="Breadcrumb">
            <a href="/docs">Docs</a>
            <span className="sep" aria-hidden="true">/</span>
            <span className="cur" aria-current="page">About</span>
            <span className="sku-tail">MDCC-MKR/01 · about</span>
          </nav>

          <h1 className="doc-h1">About the maker<span style={{color:"var(--accent)"}}>.</span></h1>
          <p className="doc-p">Hi I'm Michal and I build things.</p>
          <p className="doc-p">maude is a small Claude Code marketplace. Two plugins, one CLI, some opinions about HTML mocks. I built it, mostly at night, because I kept needing it.</p>
          <p className="doc-p">I don't fully understand why it works, but it works.</p>
          <p className="doc-p">I like nerdy jokes and tools without analytics. Based in Prague. Reachable by email, ideally not Slack.</p>
          <p className="doc-p">If it breaks it's almost certainly my fault. Open an issue. I read them.</p>

          <div className="doc-pagefoot">
            <a href="https://github.com/1aGh/maude/edit/main/site/content/docs/about.mdx">EDIT THIS PAGE ON GITHUB</a>
            <span>LAST UPDATED <b style={{color:"var(--fg-0)"}}>2026-05-15</b></span>
            <span className="slug">DOCS/ABOUT · MDCC-MKR/01</span>
          </div>
        </main>

        <aside className="doc-toc" aria-label="Maker metadata">
          <h5>MAKER</h5>
          <ol style={{display:"flex", flexDirection:"column", gap:"var(--space-3)"}}>
            <li style={{padding:0, fontSize:"10px", letterSpacing:"var(--tracking-sku)", textTransform:"uppercase"}}>
              <span style={{color:"var(--accent)", border:"1px solid var(--accent)", background:"var(--accent-tint)", padding:"2px 6px", fontWeight:700, display:"inline-block"}}>MDCC-MKR/01 · MICHAL</span>
            </li>
            <li style={{padding:0, fontSize:"10px", letterSpacing:"var(--tracking-sku)", textTransform:"uppercase", color:"var(--fg-1)", fontWeight:600}}>
              MAINTAINER SINCE <b style={{color:"var(--fg-0)"}}>2025-12</b>
            </li>
            <li style={{padding:0, fontSize:"10px", letterSpacing:"var(--tracking-sku)", textTransform:"uppercase", color:"var(--fg-1)", fontWeight:600}}>
              LOCATION <b style={{color:"var(--fg-0)"}}>PRAGUE</b>
            </li>
            <li style={{padding:0, fontSize:"10px", letterSpacing:"var(--tracking-sku)", textTransform:"uppercase", color:"var(--fg-1)", fontWeight:600}}>
              REACHABLE BY <b style={{color:"var(--fg-0)"}}>EMAIL</b>
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// App · DesignCanvas wrapper with one section, 5 artboards
// ═════════════════════════════════════════════════════════════════════
function App() {
  return (
    <DesignCanvas>
      <DCSection
        id="docs-site"
        title="Docs site · MDCC redesign"
        subtitle="marketplace landing + standalone docs · re-skinned fumadocs (site/) under MDCC-DSN/01"
      >
        <DCArtboard id="landing"      label="DS-01 · MARKETPLACE LANDING"   width={1440} height={900}><ArtboardLanding /></DCArtboard>
        <DCArtboard id="docs-index"   label="DS-02 · DOCS · INDEX"          width={1440} height={900}><ArtboardDocsIndex /></DCArtboard>
        <DCArtboard id="docs-article" label="DS-03 · DOCS · ARTICLE"        width={1440} height={900}><ArtboardDocsArticle /></DCArtboard>
        <DCArtboard id="cmd-k"        label="DS-04 · CMD-K · GLOBAL PALETTE" width={1440} height={900}><ArtboardCmdK /></DCArtboard>
        <DCArtboard id="about"        label="DS-05 · /docs/about"           width={1440} height={900}><ArtboardAbout /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
export default App;
