/**
 * @canvas      components-terminal-pane — terminal pane — prompt + cursor + history. Phosphor heritage.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-terminal-pane / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-terminal-pane/
 * @handoff     bunx shadcn add file://./components-terminal-pane.registry.json
 */
import "./components-terminal-pane.css";

export default function ComponentsTerminalPane() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-terminal-pane</span><span className="crumbs"><span>maude</span><span>design system</span><span>dev</span><span>terminal</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Terminal pane</h1><p className="lede">A terminal-flavored block for showing CLI session history inside the dev-server or a marketplace install demo. The prompt is amber-rust; the cursor is a solid block, not a blinking line. Reduced-motion respects the catalog hard NO.</p></section>
            <dl className="specimen-meta"><div><dt>Prompt</dt><dd>--accent</dd></div><div><dt>Cursor</dt><dd>solid block, no blink</dd></div></dl>

            <h2 data-no="01">A short session</h2>
            <div className="term">
              <div className="th"><div className="dots"><span></span><span></span><span></span></div><span>~/git/claude-design</span><span>mdcc</span></div>
              <div className="body">
          <span className="pr">$</span> <span className="cmd">mdcc init</span>
          <span className="out">→ scaffolded .ai/workspace · written 14 files</span>
          <span className="out">→ wrote .ai/workflows.config.json</span>
          <span className="out">→ CLAUDE.md found. leaving as is</span>

          <span className="pr">$</span> <span className="cmd">mdcc design serve</span>
          <span className="out">→ resolved root: /Users/iagh/git/claude-design</span>
          <span className="out">→ listening on http://localhost:4399</span>
          <span className="out">→ wrote _server.json · pid=42118</span>

          <span className="pr">$</span> <span className="cmd">/design:setup-ds project "marketplace + dev-server canvas"</span>
          <span className="out">→ Round 0 research · 11 WebSearch queries · no fallback</span>
          <span className="out">→ Discovery · 12 questions answered</span>
          <span className="out">→ Batch A · 13 files written</span>
          <span className="out">→ Batch B+C · scaffold in progress...</span>

          <span className="pr">$</span> <span className="cur"></span>
              </div>
            </div>

            <h2 data-no="02">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't add a blinking cursor (<code>@keyframes blink</code>). The static block is the right answer here. Animations beyond hover are a critic blocker.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-terminal-pane</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
