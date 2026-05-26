/**
 * @canvas      components-status — status pills / dots / inline indicators with semantic colors.
 * @ds          project
 * @platform    desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       MDCC-DSN/01.components-status / Maude
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/components-status/
 * @handoff     bunx shadcn add file://./components-status.registry.json
 */

import "../colors_and_type.css";
import "./_layout.css";

import { ThemeToggle } from "./_specimen-controls";
export default function ComponentsStatus() {
  return (
    <>
          <header className="specimen-hd"><span className="sku">MDCC-DSN/01.components-status</span><span className="crumbs"><span>maude</span><span>design system</span><span>status</span><span>components</span></span><ThemeToggle /></header>
          <main className="specimen">
            <section className="specimen-title"><h1>Status indicators</h1><p className="lede">Badges (outline + solid), dots, inline label-value pairs. All squared corners. The semantic color does the talking; no decorative iconography.</p></section>
            <dl className="specimen-meta"><div><dt>Variants</dt><dd>badge · badge--solid · dot · inline-state</dd></div></dl>

            <h2 data-no="01">Outline badges</h2>
            <div className="row">
              <span className="badge badge--success">live</span>
              <span className="badge badge--warn">beta</span>
              <span className="badge badge--error">failed</span>
              <span className="badge badge--info">tip</span>
              <span className="badge badge--accent">featured</span>
            </div>

            <h2 data-no="02">Solid badges</h2>
            <div className="row">
              <span className="badge badge--success badge--solid" style={{ color: 'var(--bg-0)', background: 'var(--status-success)', borderColor: 'var(--status-success)' }}>v0.12.0</span>
              <span className="badge badge--warn badge--solid" style={{ color: 'var(--bg-0)', background: 'var(--status-warn)', borderColor: 'var(--status-warn)' }}>beta</span>
              <span className="badge badge--error badge--solid" style={{ color: 'var(--bg-0)', background: 'var(--status-error)', borderColor: 'var(--status-error)' }}>install failed</span>
              <span className="badge badge--accent badge--solid">FEATURED</span>
            </div>

            <h2 data-no="03">Dots <span className="h2-aside">inline 8px chip</span></h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--type-sm)' }}>
              <div><span className="dot dot--success"></span> <code>MDCC-DSN/01</code> installed · v0.12.0</div>
              <div><span className="dot dot--warn"></span> <code>MDCC-FLW/02</code> update available · v0.11.0 → v0.12.0</div>
              <div><span className="dot dot--error"></span> <code>MDCC-CLI/03</code> install failed · permission denied</div>
              <div><span className="dot dot--info"></span> <code>MDCC-DOC/04</code> pinned · won't auto-update</div>
            </div>

            <h2 data-no="04">Status with timestamp</h2>
            <table className="cat" style={{ marginTop: 'var(--space-4)', width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-default)' }}>
              <thead><tr><th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border-strong)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-sku)', textTransform: 'uppercase', color: 'var(--fg-2)' }}>Step</th><th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border-strong)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-sku)', textTransform: 'uppercase', color: 'var(--fg-2)' }}>State</th><th style={{ textAlign: 'left', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border-strong)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-xs)', letterSpacing: 'var(--tracking-sku)', textTransform: 'uppercase', color: 'var(--fg-2)' }}>At</th></tr></thead>
              <tbody>
                <tr><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>/design:setup-ds project</td><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}><span className="badge badge--success">ok</span></td><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)' }}>2026-05-14 09:24</td></tr>
                <tr><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>Round 0 research</td><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}><span className="badge badge--success">ok</span></td><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)' }}>2026-05-14 09:27</td></tr>
                <tr><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>Batch A scaffold</td><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}><span className="badge badge--success">ok</span></td><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)' }}>2026-05-14 09:42</td></tr>
                <tr><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>Batch B+C fan-out</td><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}><span className="badge badge--warn">slow</span></td><td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)' }}>2026-05-14 09:55</td></tr>
                <tr><td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)', color: 'var(--fg-1)' }}>Aesthetic critic panel</td><td style={{ padding: 'var(--space-3) var(--space-4)' }}><span className="badge">pending</span></td><td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--type-sm)' }}>pending</td></tr>
              </tbody>
            </table>

            <footer className="specimen-ft"><div className="colo-block"><strong>MDCC-DSN/01</strong><span>· components-status</span></div><div className="colo-block"><span>Maude · v0.12.0</span></div></footer>
          </main>
        </>
  );
}
