/**
 * @canvas      components-code-block — code block with header bar, copy button, line numbers, syntax tints.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-code-block / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-code-block/
 * @handoff     bunx shadcn add file://./components-code-block.registry.json
 */
import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
import "./components-code-block.css";

export default function ComponentsCodeBlock() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-code-block</span><span className="crumbs"><span>maude</span><span>design system</span><span>dev</span><span>code-block</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Code blocks</h1><p className="lede">Header bar with language + filename + copy action. Line numbers as a left rail. Syntax tints use the status family. Keywords in <code>--accent</code>, strings in success-green, comments in <code>--fg-3</code>. No rainbow theme.</p></section>
            <dl className="specimen-meta"><div><dt>Anatomy</dt><dd>header · line-rail · content</dd></div><div><dt>Syntax</dt><dd>3 tints (kw/str/com)</dd></div></dl>

            <h2 data-no="01">JavaScript</h2>
            <div className="code-block">
              <div className="cb-hd"><span><span className="lang">JS</span> · plugins/design/dev-server/server.mjs</span><button className="btn btn--sm btn--quiet">copy</button></div>
              <div className="cb-body">
                <div className="cb-ln">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9</div>
          <div className="cb-content"><span className="tok-com">// resolve target repo root in priority order</span>
          <span className="tok-key">const</span> root = args.root
            ?? process.env.<span className="tok-key">CLAUDE_PROJECT_DIR</span>
            ?? process.<span className="tok-fn">cwd</span>();

          <span className="tok-key">if</span> (!fs.<span className="tok-fn">existsSync</span>(path.<span className="tok-fn">join</span>(root, <span className="tok-str">'.design'</span>))) {'{'}
            <span className="tok-key">throw new</span> Error(<span className="tok-str">'no .design/ in target. refusing to start'</span>);
          {'}'}</div>
              </div>
            </div>

            <h2 data-no="02">CSS. Token authority.</h2>
            <div className="code-block">
              <div className="cb-hd"><span><span className="lang">CSS</span> · .design/system/project/colors_and_type.css</span><button className="btn btn--sm btn--quiet">copy</button></div>
              <div className="cb-body">
                <div className="cb-ln">1<br />2<br />3<br />4<br />5</div>
          <div className="cb-content"><span className="tok-key">:root</span>,
          .<span className="tok-fn">mdcc</span>[<span className="tok-key">data-theme</span>=<span className="tok-str">"light"</span>] {'{'}
            <span className="tok-key">--accent</span>: <span className="tok-fn">oklch</span>(56% 0.170 50);   <span className="tok-com">/* catalog-stamp red */</span>
            <span className="tok-key">--font-body</span>: <span className="tok-str">'Berkeley Mono'</span>, ui-monospace;
          {'}'}</div>
              </div>
            </div>

            <h2 data-no="03">Shell <span className="h2-aside">terminal mode</span></h2>
            <div className="code-block">
              <div className="cb-hd"><span className="lang">SH</span><button className="btn btn--sm btn--quiet">copy</button></div>
              <div className="cb-body">
                <div className="cb-ln">$</div>
          <div className="cb-content"><span className="tok-fn">mdcc</span> design serve --port 4399
          &gt; <span className="tok-com">canvas browser at</span> <span className="tok-str">http://localhost:4399</span>
          &gt; <span className="tok-com">watching</span> .design/system/project/preview/</div>
              </div>
            </div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-code-block</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
