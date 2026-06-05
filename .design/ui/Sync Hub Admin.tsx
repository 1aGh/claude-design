/**
 * @canvas      sync-hub-admin · The in-hub admin UI for maude sync (Phase 9) dressed in MDCC-DSN/01 — claim the hub, issue one-time invite tokens, watch connected peers, rotate the kill-switch. Five artboards: sign-in, first-run claim, dashboard, issued-credential modal, edge states.
 * @ds          project
 * @platform    desktop
 * @opt_out     palette
 * @artboards   sign-in | first-run | dashboard | invite-modal | states
 * @brief       Návrh admin hub stránky pro maude sync — source of truth: .ai/plans/archive/phase-9-self-hosted-hub-file-sync.md Task 2.5 + apps/hub/src/admin/index.html. Design mockup of the hub operator console.
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     .design/_history/sync-hub-admin/
 * @handoff     bunx shadcn add file://./Sync Hub Admin.registry.json
 */

// The segregated canvas origin 403s `_`-prefixed files, so the DS
// `_components.css` <link> the shell injects never paints. Importing it here
// makes the build inline it into the canvas bundle (same path the sibling CSS
// takes) — the DS component anatomy renders standalone + survives handoff.
import "../system/project/preview/_components.css";
import "./Sync Hub Admin.css";
import { DCArtboard, DCSection, DesignCanvas } from "@maude/canvas-lib";

const VER = "v0.18.0";
const HUB_URL = "maude-hub-foo.fly.dev";
const TOKEN = "mau_a3f9c8b2d1e4f6079b5c8e2a1d4f7c0b";

/* ───────────────────────────────────────────────────────────────────── *
 *  sync-hub-admin / HUB-ADM                                              *
 *                                                                       *
 *  Static design mock. The hub operator console: bootstrap-key claim,   *
 *  one-time token issuance, peer awareness, rotate-as-kill-switch.      *
 *  Lifts: AbHd strip (Commands Overview), .tile/.card/.btn/.badge/      *
 *  .input/.field/.sku from DS _components.css. Peer swatches use status *
 *  tokens (awareness color is data, not chrome → stays token-pure).     *
 * ───────────────────────────────────────────────────────────────────── */

// Catalog header strip — lifted shape from Commands Overview's AbHd.
function AbHd({ sku, label, sub }: { sku: string; label: string; sub?: string }) {
  return (
    <div className="ab-hd" role="presentation">
      <span className="lead">
        <b>{sku}</b> · {label}
      </span>
      <span className="right">
        {sub ? <span>{sub}</span> : null}
        <span className="ok" aria-label="theme phosphor-dark">
          <span className="glyph" aria-hidden="true">●</span> DARK
        </span>
        <span>{VER}</span>
      </span>
    </div>
  );
}

// App header — the M mark + auth state. `authed` flips the right-hand chip.
function HubHeader({ authed }: { authed: boolean }) {
  return (
    <header className="hub-hd">
      <span className="hub-brand">
        <span className="hub-mark" aria-hidden="true">M</span>
        <span className="hub-title">
          Maude Hub<small>HUB-ADM/01</small>
        </span>
      </span>
      {authed ? (
        <span className="hub-auth">
          <span className="dot dot--success" aria-hidden="true" /> authenticated
          <button type="button" className="btn btn--quiet btn--sm">forget on this device</button>
        </span>
      ) : (
        <span className="hub-auth">
          <span className="dot dot--warn" aria-hidden="true" /> not authenticated
        </span>
      )}
    </header>
  );
}

// One peer row — awareness color rendered via a status token swatch.
function PeerRow({ doc, user, color, ago }: { doc: string; user: string; color: string; ago: string }) {
  return (
    <tr>
      <td className="doc">{doc}</td>
      <td>
        <span className="user">
          <span className="swatch" style={{ background: color }} aria-hidden="true" />
          {user}
        </span>
      </td>
      <td className="ago num">{ago}</td>
    </tr>
  );
}

function TokenRow({ label, created, used }: { label: string; created: string; used: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="ago">{created}</td>
      <td className="ago">{used}</td>
      <td className="act">
        <button type="button" className="btn btn--ghost btn--sm">Rotate</button>
      </td>
    </tr>
  );
}

// The full populated dashboard — reused dimmed behind the invite modal.
function Dashboard({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`hub-grid${dim ? " dim" : ""}`} aria-hidden={dim || undefined}>
      {/* ── Generate invite ── */}
      <article className="tile">
        <div className="tile-hd">
          <span>Generate invite</span>
          <span className="sku">HUB-ADM/03·INVITE</span>
        </div>
        <div className="tile-bd">
          <h3 className="card-title">Issue a one-time link</h3>
          <div className="field">
            <label className="field-label" htmlFor="lbl">Label this invite</label>
            <input id="lbl" className="input input--mono" type="text" defaultValue="carol" />
          </div>
          <div className="hub-actions">
            <button type="button" className="btn btn--primary">
              Generate token<span className="kbd" aria-hidden="true">⏎</span>
            </button>
          </div>
          <p className="field-help">One-time token, shown once. The command below goes into the peer's terminal.</p>
        </div>
      </article>

      {/* ── Connected peers ── */}
      <article className="tile">
        <div className="tile-hd">
          <span className="live"><span className="dot dot--success" aria-hidden="true" /> Connected peers</span>
          <span className="sku">HUB-ADM/04·PEERS</span>
        </div>
        <div className="tile-bd">
          <table className="tbl">
            <caption className="sr-only">Connected peers</caption>
            <thead>
              <tr><th scope="col">Document</th><th scope="col">User</th><th scope="col" className="num">Connected</th></tr>
            </thead>
            <tbody>
              <PeerRow doc="canvas-viewport" user="alice" color="var(--status-info)" ago="4m" />
              <PeerRow doc="docs-site" user="bob" color="var(--status-warn)" ago="12m" />
            </tbody>
          </table>
        </div>
      </article>

      {/* ── Hub status ── */}
      <article className="tile">
        <div className="tile-hd">
          <span>Hub status</span>
          <span className="sku">HUB-ADM/05·STATUS</span>
        </div>
        <div className="tile-bd">
          <dl className="kv">
            <dt>uptime</dt><dd>6d 14h 22m</dd>
            <dt>version</dt><dd>{VER}</dd>
            <dt>port</dt><dd>1234</dd>
            <dt>data dir</dt><dd>/data <span className="unit">· 4.2 MB</span></dd>
            <dt>canvases</dt><dd>7</dd>
            <dt>tokens</dt><dd>3</dd>
            <dt>peers</dt><dd>2</dd>
          </dl>
        </div>
      </article>

      {/* ── Active tokens ── */}
      <article className="tile">
        <div className="tile-hd">
          <span>Active tokens</span>
          <span className="sku">HUB-ADM/06·TOKENS</span>
        </div>
        <div className="tile-bd">
          <table className="tbl">
            <caption className="sr-only">Active tokens</caption>
            <thead>
              <tr>
                <th scope="col">Label</th><th scope="col">Created</th><th scope="col">Last used</th>
                <th scope="col" className="act"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <TokenRow label="alice" created="May 24" used="4m ago" />
              <TokenRow label="bob" created="May 24" used="12m ago" />
              <TokenRow label="ci-bot" created="May 20" used="never" />
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

export default function SyncHubAdmin() {
  return (
    <DesignCanvas>
      <DCSection id="hub-admin" title="Sync Hub Admin · MDCC-DSN/01" subtitle="HUB-ADM">

        {/* ── A · SIGN IN ─────────────────────────────────────────────── */}
        <DCArtboard id="sign-in" label="HUB-ADM/01 · SIGN IN" width={960} height={720}>
          <div className="mdcc hub-frame" data-theme="dark">
            <AbHd sku="HUB-ADM/01" label="sign in · returning operator" sub="claimed hub" />
            <HubHeader authed={false} />
            <main className="hub-main">
              <div className="hub-center">
                <div className="hub-hero">
                  <span className="hub-hero-mark" aria-hidden="true">M</span>
                  <span className="hub-hero-wm">Maude Hub<small>self-hosted sync</small></span>
                </div>
                <p className="eyebrow hub-eyebrow">SESSION</p>
                <h2>Sign in</h2>
                <p className="hub-lede">This hub is already claimed. Paste your <code>HUB_SECRET</code> to manage tokens and watch peers.</p>
                <div className="field">
                  <label className="field-label" htmlFor="secret">HUB_SECRET</label>
                  <input id="secret" className="input input--mono input--pw" type="password" defaultValue="••••••••••••••••••••••••" aria-label="HUB_SECRET" />
                </div>
                <div className="hub-actions">
                  <button type="button" className="btn btn--primary">
                    Sign in<span className="kbd" aria-hidden="true">⏎</span>
                  </button>
                  <span className="sku sku--ghost">BEARER · /admin/api</span>
                </div>
                <p className="hub-hint">Stored in this browser's <code>localStorage</code> only — clear it to sign out everywhere. No cookie, no server session.</p>
              </div>
            </main>
          </div>
        </DCArtboard>

        {/* ── B · FIRST-RUN CLAIM ─────────────────────────────────────── */}
        <DCArtboard id="first-run" label="HUB-ADM/02 · FIRST-RUN CLAIM" width={960} height={760}>
          <div className="mdcc hub-frame" data-theme="dark">
            <AbHd sku="HUB-ADM/02" label="first-run · one-time bootstrap link" sub="single-use" />
            <HubHeader authed={false} />
            <main className="hub-main">
              <div className="hub-center">
                <div className="hub-hero">
                  <span className="hub-hero-mark" aria-hidden="true">M</span>
                  <span className="hub-hero-wm">Maude Hub<small>self-hosted sync</small></span>
                </div>
                <p className="eyebrow hub-eyebrow">ONE-TIME BOOTSTRAP LINK</p>
                <h2>Welcome</h2>
                <p className="hub-lede">This hub has no admin yet. Confirm to claim it — the link is consumed and can't be reused. Verify the fingerprint matches your server logs before you trust it.</p>

                <div className="fp">
                  <div className="fp-row">
                    <span className="fp-k">Claiming</span>
                    <span className="fp-v">https://{HUB_URL}</span>
                  </div>
                  <div className="fp-row">
                    <span className="fp-k">Fingerprint</span>
                    <span className="fp-v">
                      <span className="grp">a3f9</span> c8b2 <span className="grp">d1e4</span> f607
                    </span>
                  </div>
                  <div className="fp-row">
                    <span className="fp-k">Version</span>
                    <span className="fp-v">{VER}</span>
                  </div>
                </div>

                <div className="hub-actions">
                  <button type="button" className="btn btn--primary btn--lg">Claim hub</button>
                  <span className="badge badge--warn">EXPIRES 24H</span>
                </div>
                <p className="hub-hint">Single-use. After you claim, <code>/admin</code> requires <code>HUB_SECRET</code> — there is no second bootstrap link.</p>
              </div>
            </main>
          </div>
        </DCArtboard>

        {/* ── C · DASHBOARD ───────────────────────────────────────────── */}
        <DCArtboard id="dashboard" label="HUB-ADM/03 · DASHBOARD" width={1320} height={860}>
          <div className="mdcc hub-frame" data-theme="dark">
            <AbHd sku="HUB-ADM/03" label="dashboard · operator console" sub="authenticated" />
            <HubHeader authed={true} />
            <main className="hub-main">
              <Dashboard />
            </main>
          </div>
        </DCArtboard>

        {/* ── D · INVITE ISSUED (modal — signature moment) ────────────── */}
        <DCArtboard id="invite-modal" label="HUB-ADM/04 · INVITE ISSUED" width={1320} height={860}>
          <div className="mdcc hub-frame" data-theme="dark" style={{ position: "relative" }}>
            <AbHd sku="HUB-ADM/04" label="invite issued · single-use credential" sub="shown once" />
            {/* Everything behind the modal is inert — out of tab order + a11y tree
                while the dialog is open. On handoff the live build also traps Tab
                inside .issued, focuses Done on open, restores focus + binds ESC. */}
            <div className="hub-behind" inert>
              <HubHeader authed={true} />
              <main className="hub-main">
                <Dashboard dim />
              </main>
            </div>

            {/* scrim + issued-credential dialog */}
            <div className="scrim" role="presentation">
              <div className="issued" role="dialog" aria-modal="true" aria-labelledby="issued-title">
                <div className="issued-hd">
                  <span className="sku sku--accent">INVITE ISSUED</span>
                  <span className="stamp">2026-05-29 14:32Z</span>
                </div>
                <div className="issued-bd">
                  <h2 id="issued-title">Invite ready — for "carol"</h2>
                  <p>Copy the command into the peer's terminal. The token is shown <b>once</b>; close this and it's gone.</p>

                  <pre className="cmd">{`maude design link https://${HUB_URL} `}<span className="cont">\\</span>{`\n  `}<span className="flag">--token=</span>{TOKEN}</pre>

                  <div className="hub-actions" style={{ marginTop: 0 }}>
                    <button type="button" className="btn btn--primary copied">✓ Command copied</button>
                    <span className="sku sku--ghost">⌘C · CLIPBOARD</span>
                  </div>

                  <hr className="tear" />

                  <div className="stub">
                    <span className="lbl">Raw token</span>
                    <code>{TOKEN}</code>
                  </div>
                  <div className="issued-meta">
                    <span>SINGLE USE</span>
                    <span>NON-REISSUABLE</span>
                    <span>SCOPE · carol</span>
                  </div>
                </div>
                <div className="issued-ft">
                  <button type="button" className="btn btn--ghost">Done</button>
                </div>
              </div>
            </div>
          </div>
        </DCArtboard>

        {/* ── E · EDGE STATES ─────────────────────────────────────────── */}
        <DCArtboard id="states" label="HUB-ADM/05 · EDGE STATES" width={880} height={940}>
          <div className="mdcc hub-frame" data-theme="dark">
            <AbHd sku="HUB-ADM/05" label="edge states · empty · confirm · errors" />
            <HubHeader authed={true} />
            <main className="hub-main">
              <div className="states">

                <div className="state-blk">
                  <h3>Empty — no peers / no tokens<span className="sku">HUB-ADM/04·06</span></h3>
                  <article className="card card--inset">
                    <table className="tbl">
                      <caption className="sr-only">Connected peers (empty)</caption>
                      <thead><tr><th scope="col">Document</th><th scope="col">User</th><th scope="col" className="num">Connected</th></tr></thead>
                      <tbody><tr className="empty"><td colSpan={3}>No peers connected.</td></tr></tbody>
                    </table>
                  </article>
                </div>

                <div className="state-blk">
                  <h3>Rotate confirm — the kill switch</h3>
                  <div className="confirm">
                    <p>Rotate <b>alice</b>? Live sessions using this token are kicked within <b>5s</b>. There's no undo — and no revoke. Rotation <b>is</b> the kill switch.</p>
                    <span className="confirm-act">
                      <button type="button" className="btn btn--ghost btn--sm">Cancel</button>
                      <button type="button" className="btn btn--sm" style={{ borderColor: "var(--status-error)", color: "var(--status-error)" }}>Rotate</button>
                    </span>
                  </div>
                </div>

                <div className="state-blk">
                  <h3>Auth expired — your token was rotated</h3>
                  <div className="callout callout--info">
                    <span className="glyph" aria-hidden="true">i</span>
                    <span className="body">Your link was rotated by the hub admin. Re-link to continue: <code>maude design link https://{HUB_URL} --token=mau_…</code></span>
                  </div>
                </div>

                <div className="state-blk">
                  <h3>Rate limited — too many attempts</h3>
                  <div className="callout callout--error">
                    <span className="glyph" aria-hidden="true">!</span>
                    <span className="body"><b>429 · Too many attempts.</b> The bootstrap + 401 paths cap at 5 requests / 60s per IP. Try again in <b>60s</b>, or set <code>HUB_ADMIN_RATE_LIMIT=off</code> for local dev.</span>
                  </div>
                </div>

              </div>
            </main>
          </div>
        </DCArtboard>

      </DCSection>
    </DesignCanvas>
  );
}
