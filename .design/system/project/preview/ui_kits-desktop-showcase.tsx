/**
 * @canvas      ui_kits-desktop-showcase — SIGNATURE ★★ — the "DS in use" showcase. Full mdcc-design-server mock screen: top chrome + file-tree + tabbed iframe preview + inspector overlay + status bar. Theme + accent retint via data attributes
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01 / Maude · DS in use
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/ui-kits-desktop-showcase/
 * @handoff     bunx shadcn add file://./ui_kits-desktop-showcase.registry.json
 */
import "./ui_kits-desktop-showcase.css";

export default function UiKitsDesktopShowcase() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01 · SHOWCASE</span><span className="crumbs"><span>maude</span><span>design system</span><span>ds in use</span><span>desktop showcase</span></span><ThemeToggle /></header>

          <main className="stage">
            <div className="stage-hd">
              <div className="left">
                <span className="sku-big">MDCC-DSN/01</span>
                <span className="title">maude · the dev-server canvas in use</span>
              </div>
              <div className="accent-picker">
                <span>ACCENT</span>
                <button className="ac-rust" data-accent="rust" aria-pressed="true" title="rust"></button>
                <button className="ac-phosph" data-accent="phosph" aria-pressed="false" title="phosphor"></button>
                <button className="ac-cobalt" data-accent="cobalt" aria-pressed="false" title="cobalt"></button>
                <button className="ac-violet" data-accent="violet" aria-pressed="false" title="violet"></button>
              </div>
            </div>

            <div className="app">
              {/* titlebar */}
              <div className="app-titlebar">
                <div className="dots"><span></span><span></span><span></span></div>
                <div className="url">localhost:4399 / .design/system/project/preview/colors-accent.html</div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                  <span className="badge-pill">MDCC-DSN/01</span>
                  <span>v0.12.0</span>
                </div>
              </div>

              {/* main: tree | canvas | inspector */}
              <div className="app-main">
                <aside className="tree">
                  <div className="tree-hd"><span>FILES</span><span style={{ color: 'var(--fg-3)' }}>36/36</span></div>
                  <div className="tree-row dir"><span className="gly">▾</span>.design</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-7)' }}><span className="gly">·</span>README.md</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-7)' }}><span className="gly">·</span>config.json</div>
                  <div className="tree-row dir" style={{ paddingLeft: 'var(--space-7)' }}><span className="gly">▾</span>system/project</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-8)' }}><span className="gly">·</span>README.md</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-8)' }}><span className="gly">·</span>SKILL.md</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-8)' }}><span className="gly">·</span>colors_and_type.css</div>
                  <div className="tree-row dir" style={{ paddingLeft: 'var(--space-8)' }}><span className="gly">▾</span>preview</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>_layout.css</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>_components.css</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>colors-text</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>colors-surfaces</div>
                  <div className="tree-row sel" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">▸</span>colors-accent</div>
                  <div className="tree-row modified" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>type-scale</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>motion</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>components-buttons</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>components-tables</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>empty-state</div>
                  <div className="tree-row" style={{ paddingLeft: 'var(--space-9)' }}><span className="gly">·</span>logo</div>
                  <div className="tree-row dir" style={{ paddingLeft: 'var(--space-8)' }}><span className="gly">▸</span>assets</div>
                  <div className="tree-row dir" style={{ paddingLeft: 'var(--space-7)' }}><span className="gly">▸</span>ui</div>
                </aside>
                <div className="gutter" role="separator"></div>

                <div className="canvas-wrap">
                  <div className="tabs">
                    <div className="tab active"><span>colors-accent</span><span className="close">×</span></div>
                    <div className="tab"><span>components-buttons</span><span className="close">×</span></div>
                    <div className="tab"><span>logo</span><span className="close">×</span></div>
                    <div className="tab"><span>empty-state</span><span className="close">×</span></div>
                  </div>
                  <div className="iframe-stage">
                    <div className="iframe">
                      {/* Pins are absolutely positioned to specific anchors */}
                      <span className="pin pin-1" title=".sku · MDCC-DSN/01">1</span>
                      <span className="pin pin-2" title=".stamp-headline · h3 catalog stamp">2</span>
                      <span className="pin pin-3" title=".swatch .oklch annotation">3</span>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-sku)', textTransform: 'uppercase', color: 'var(--fg-2)' }}>
                        <span style={{ color: 'var(--fg-0)', fontWeight: '700' }}>MDCC-DSN/01.COLORS-ACCENT</span>
                        <span>SIGNATURE · ★</span>
                      </div>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--type-2xl)', margin: '0 0 var(--space-3)', color: 'var(--fg-0)', fontWeight: '700', letterSpacing: 'var(--tracking-tight)' }}>Accent. Amber-rust.</h2>
                      <p style={{ color: 'var(--fg-1)', margin: '0 0 var(--space-5)', maxWidth: '60ch' }}>One color. Five tokens. The accent never carries identity by itself. It joins the mono spine and the 1px hairlines to do the work.</p>

                      <div style={{ border: '4px solid var(--accent)', padding: 'var(--space-6)', background: 'var(--bg-0)', position: 'relative', margin: '0 0 var(--space-5)' }}>
                        <div style={{ position: 'absolute', inset: '4px', border: '1px solid var(--accent)', pointerEvents: 'none' }}></div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-sku)', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase' }}>MDCC-DSN/01 · PUBLISHED 2026-05-14</div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--type-xl)', margin: 'var(--space-3) 0', color: 'var(--fg-0)', fontWeight: '700' }}>maude design system</h3>
                        <p style={{ margin: '0', color: 'var(--fg-1)', maxWidth: '50ch' }}>A catalog-disciplined, mono-everywhere DS for the marketplace and the dev-server canvas. The accent is a stamp, not a fill.</p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0', border: '1px solid var(--border-default)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px', background: 'var(--bg-1)' }}>
                          <div style={{ height: '56px', background: 'var(--accent)' }}></div>
                          <div style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: 'var(--fg-0)' }}>--accent</strong><span style={{ color: 'var(--fg-3)', fontSize: '10px' }}>56/0.170/50</span></div>
                        </div>
                        <div style={{ border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px', background: 'var(--bg-1)' }}>
                          <div style={{ height: '56px', background: 'var(--accent-hover)' }}></div>
                          <div style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: 'var(--fg-0)' }}>--hover</strong><span style={{ color: 'var(--fg-3)', fontSize: '10px' }}>−4L</span></div>
                        </div>
                        <div style={{ border: '1px solid var(--border-default)', margin: '-1px 0 0 -1px', background: 'var(--bg-1)' }}>
                          <div style={{ height: '56px', background: 'var(--accent-tint)' }}></div>
                          <div style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: 'var(--fg-0)' }}>--tint</strong><span style={{ color: 'var(--fg-3)', fontSize: '10px' }}>wash</span></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <button style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--accent)', color: 'var(--accent-fg)', border: '2px solid var(--accent)', fontFamily: 'var(--font-body)', fontSize: 'var(--type-sm)', fontWeight: '500' }}>Install plugin</button>
                        <button style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--bg-1)', color: 'var(--fg-0)', border: '2px solid var(--fg-0)', fontFamily: 'var(--font-body)', fontSize: 'var(--type-sm)' }}>Inspect</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="gutter" role="separator"></div>

                <aside className="insp">
                  <h4>SELECTED</h4>
                  <dl className="kv">
                    <dt>file</dt><dd>colors-accent.html</dd>
                    <dt>element</dt><dd>.stamp-headline</dd>
                    <dt>path</dt><dd>main &gt; .iframe &gt; div &gt; h3</dd>
                  </dl>

                  <h4>TOKENS IN USE</h4>
                  <div className="tok-list">
          <span className="k">--font-display</span>: 'Berkeley Mono', ...;
          <span className="k">--type-xl</span>: 22px;
          <span className="k">--lh-xl</span>: 30px;
          <span className="k">--fg-0</span>: oklch(20% 0.020 50);
          <span className="k">--space-3</span>: 8px (margin);
          <span className="k">--tracking-tight</span>: -0.01em;
                  </div>

                  <h4>HARD NOs · FROM SKILL.md</h4>
                  <dl className="kv">
                    <dt>blur</dt><dd style={{ color: 'var(--status-success)' }}>none ✓</dd>
                    <dt>shadow</dt><dd style={{ color: 'var(--status-success)' }}>focus only ✓</dd>
                    <dt>radius</dt><dd style={{ color: 'var(--status-success)' }}>≤ 4px ✓</dd>
                    <dt>gradients</dt><dd style={{ color: 'var(--status-success)' }}>none ✓</dd>
                  </dl>

                  <h4>ACTIVE FAMILIES</h4>
                  <dl className="kv">
                    <dt>accent</dt><dd>· always</dd>
                    <dt>status</dt><dd>· always</dd>
                    <dt>mono</dt><dd>· dev tool</dd>
                  </dl>

                  <h4>NEXT MOVE</h4>
                  <p style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-body)', fontSize: 'var(--type-xs)', margin: '0' }}>/design:edit "make the stamp's hairline 2px"</p>
                </aside>
              </div>

              {/* status */}
              <div className="app-status">
                <span><span style={{ background: 'var(--status-success)', width: '8px', height: '8px', display: 'inline-block', verticalAlign: '1px', marginRight: '6px' }}></span>SERVER · 4399</span>
                <span>BRANCH · main</span>
                <span></span>
                <span className="ok">CRITIC · 4.1/5</span>
                <span>SNAPSHOTS · 28/30</span>
                <span className="warn">UNSAVED · type-scale</span>
              </div>
            </div>

            <div className="footrow">
              <div className="item">
                <div className="eyebrow">01 · THE TREE</div>
                <h4>File-tree pane</h4>
                <p>Unicode disclosure (<code>▾ ▸</code>) inline. Modified files carry an amber dot. Selected={true} row stamps in accent. Width 180-480px.</p>
              </div>
              <div className="item">
                <div className="eyebrow">02 · THE CANVAS</div>
                <h4>Tabbed iframe stage</h4>
                <p>Active tab gets the accent underline. Tabs scroll horizontally when overflowing. Each iframe renders the specimen at the actual breakpoint.</p>
              </div>
              <div className="item">
                <div className="eyebrow">03 · THE INSPECTOR</div>
                <h4>Right-side inspector</h4>
                <p>Cmd+Click in the iframe pins an element. Pin numbers anchor to real coordinates. Tokens-in-use + hard-NO checklist live here.</p>
              </div>
            </div>

            <footer className="specimen-ft" style={{ marginTop: 'var(--space-7)' }}>
              <div className="colo-block"><strong>MDCC-DSN/01</strong><span>· ui_kits-desktop-showcase · ★★ highest-leverage</span></div>
              <div className="colo-block"><span>Maude · v0.12.0</span></div>
            </footer>
          </main>
        </>
  );
}
