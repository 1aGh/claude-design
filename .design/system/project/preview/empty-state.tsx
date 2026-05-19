/**
 * @canvas      empty-state — SIGNATURE — voice + brand moment. Multiple empty-state variants + Voice "keep or kill" comparison panel showing htmx-grain vs corporate.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.empty-state / md-claude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/empty-state/
 * @handoff     bunx shadcn add file://./empty-state.registry.json
 */
import "./empty-state.css";

export default function EmptyState() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.empty-state</span><span className="crumbs"><span>md-claude</span><span>design system</span><span>universal</span><span>empty-state</span></span><span className="theme-toggle" role="tablist" aria-label="Theme"><button data-theme="light">LIGHT</button><button data-theme="dark">DARK</button></span></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Empty states</h1><p className="lede">An empty state in this DS is a voice exam. If the copy says "Get Started" or "No items yet", you failed. If it tells the reader exactly what they're looking at and how to make it not-empty in two sentences, you passed.</p></section>
            <dl className="specimen-meta"><div><dt>Family</dt><dd>universal</dd></div><div><dt>Voice</dt><dd>htmx-grain direct fragments</dd></div></dl>

            <h2 data-no="01">The canonical empty state</h2>
            <div className="empty">
              <div className="eyebrow">MARKETPLACE · NO INSTALLED PLUGINS</div>
              <h3>Nothing installed yet. Which is fine, you just got here.</h3>
              <p><code>mdcc install MDCC-DSN/01</code> grabs the design plugin. <code>MDCC-FLW/02</code> grabs flow. Pick one. Type the command. Come back here in five seconds.</p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                <button className="btn btn--primary">Browse catalog</button>
                <a href="#" style={{ fontSize: 'var(--type-sm)', color: 'var(--fg-1)', alignSelf: 'center', textDecoration: 'underline', textDecorationColor: 'var(--accent)', textUnderlineOffset: '4px' }}>or read the docs first</a>
              </div>
            </div>

            <h2 data-no="02">Voice. Keep or kill</h2>
            <p>Two empty-state messages for the same screen. One earns its place. The other is what a Series-A pitch deck would write. Read both. Notice which one tells you anything.</p>
            <div className="voice-cmp">
              <div className="keep">
                <div className="head">✓ KEEP</div>
                <blockquote>No snapshots yet. /design:edit "&lt;feedback&gt;" makes one automatically. /design:rollback brings the last one back.</blockquote>
              </div>
              <div className="kill">
                <div className="head">✗ KILL</div>
                <blockquote>Get started by creating your first beautiful snapshot. Our intuitive workflow makes it effortless to preserve your design moments. Try it now!</blockquote>
              </div>
            </div>
            <p style={{ color: 'var(--fg-2)', fontSize: 'var(--type-sm)', marginTop: 'var(--space-3)' }}>If you can replace "snapshots" with "items" / "documents" / "users" without changing meaning, you wrote the kill version. Specific nouns. Direct verbs. Real commands. No exclamation marks.</p>

            <h2 data-no="03">Variants <span className="h2-aside">six common cases</span></h2>
            <div className="variants">
              <div className="empty">
                <div className="eyebrow">NO MATCH</div>
                <h3>No plugins match "&lt;query&gt;"</h3>
                <p>The catalog has 5 plugins. Drop the filter, expand the search, or submit a PR with the one you wish existed.</p>
              </div>
              <div className="empty">
                <div className="eyebrow">NO ACCESS</div>
                <h3>That canvas is private. Or deleted. Or the snapshot id doesn't match.</h3>
                <p>Try <code>mdcc design --list</code> to see what's actually available.</p>
              </div>
              <div className="empty">
                <div className="eyebrow">FIRST RUN</div>
                <h3>No canvases under .design/ui/</h3>
                <p><code>/design:new "&lt;Name&gt;" "&lt;brief&gt;"</code> scaffolds one. It writes an HTML file using these tokens. The dev-server picks it up automatically.</p>
              </div>
              <div className="empty">
                <div className="eyebrow">OFFLINE</div>
                <h3>Dev-server isn't running</h3>
                <p>Start it with <code>mdcc design serve</code>. Or run <code>/design:browse</code> from inside Claude Code. Same thing.</p>
              </div>
              <div className="empty">
                <div className="eyebrow">DELETED</div>
                <h3>Snapshot purged</h3>
                <p>Older than 30 days and unreferenced. <code>_history/&lt;slug&gt;/</code> is auto-pruned. Bring it back from git or accept the loss.</p>
              </div>
              <div className="empty">
                <div className="eyebrow">PERMISSION</div>
                <h3>Can't write to .design/</h3>
                <p>The working directory isn't writable. Check ownership. Or run from a directory you own. The dev-server fails loud rather than guess.</p>
              </div>
            </div>

            <h2 data-no="04">When NOT to use</h2>
            <div className="anti"><p style={{ margin: '0' }}>Don't add a hero illustration ("a friendly sketch of someone holding a clipboard"). The catalog aesthetic doesn't render personality through pictures. The copy does.</p></div>
            <div className="pro"><p style={{ margin: '0' }}>Do use the eyebrow + h3 + body + 1-2 actions pattern. Eyebrow = state label (in accent). h3 = the answer. Body = one short paragraph. Action = a real command, ideally callable from where the user is.</p></div>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· empty-state · ★ signature</span></div><div className="colo-block"><span>md-claude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
