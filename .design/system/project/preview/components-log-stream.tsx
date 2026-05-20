/**
 * @canvas      components-log-stream — log stream — timestamps + level tag + body, mono everywhere.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-log-stream / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-log-stream/
 * @handoff     bunx shadcn add file://./components-log-stream.registry.json
 */
import "./components-log-stream.css";

export default function ComponentsLogStream() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-log-stream</span><span className="crumbs"><span>maude</span><span>design system</span><span>dev</span><span>log-stream</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Log stream</h1><p className="lede">Timestamp + level + message. Three columns, mono everything. Level is a 4-letter caps tag in the status family color. No icon, no emoji.</p></section>
            <dl className="specimen-meta"><div><dt>Levels</dt><dd>info · ok · warn · err · debug</dd></div><div><dt>Cols</dt><dd>120 / 60 / 1fr</dd></div></dl>

            <h2 data-no="01">Dev-server tail</h2>
            <div className="log">
              <div className="lh"><span>$ mdcc design serve --port 4399</span><span><span className="dot dot--success"></span> live · 247 entries</span></div>
              <div className="line"><span className="t">2026-05-14 09:42:11</span><span className="lv lv-info">INFO</span><span className="msg">resolved root: <span className="tag">/Users/iagh/git/claude-design</span></span></div>
              <div className="line"><span className="t">2026-05-14 09:42:11</span><span className="lv lv-info">INFO</span><span className="msg">listening on <span className="tag">http://localhost:4399</span></span></div>
              <div className="line"><span className="t">2026-05-14 09:42:11</span><span className="lv lv-ok">OK</span><span className="msg">wrote <span className="tag">_server.json</span> · pid=42118</span></div>
              <div className="line"><span className="t">2026-05-14 09:42:14</span><span className="lv lv-debug">DBG</span><span className="msg">GET /system/project/preview/colors-accent.html · 200 · 7.2ms</span></div>
              <div className="line"><span className="t">2026-05-14 09:42:14</span><span className="lv lv-info">INFO</span><span className="msg">active tab: <span className="tag">colors-accent.html</span></span></div>
              <div className="line"><span className="t">2026-05-14 09:42:18</span><span className="lv lv-info">INFO</span><span className="msg">inspector selection: <span className="tag">.stamp .stamp-headline</span></span></div>
              <div className="line"><span className="t">2026-05-14 09:42:22</span><span className="lv lv-warn">WARN</span><span className="msg">snapshot stack at 28/30. consider <code>/design:setup-docs</code> to prune</span></div>
              <div className="line"><span className="t">2026-05-14 09:42:30</span><span className="lv lv-err">ERR</span><span className="msg">file not found: <span className="tag">ui/sandbox.html</span> · refusing to serve missing canvas</span></div>
              <div className="line"><span className="t">2026-05-14 09:42:31</span><span className="lv lv-info">INFO</span><span className="msg">active tab cleared</span></div>
            </div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-log-stream</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
