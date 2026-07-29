// The share view's HTML — Cloud Phase 18.
//
// Server-rendered, no script. That is not minimalism for its own sake: the
// containment claim this whole surface rests on is "the vendor never executes
// tenant-authored anything", and a page that ships JavaScript is a page where
// that has to be argued rather than seen. `script-src 'none'` in the CSP and
// no <script> in the markup is an argument anyone can check in ten seconds.
//
// Plain language throughout. The reader is somebody's teammate on a phone, not
// an operator: no "tenant", no "cell", no "R2", no "snapshot pipeline".

import { SHARE_HEADERS } from './share.mjs';

const CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1.25rem 4rem;
    font: 16px/1.55 ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #fbfbfa; color: #16150f; -webkit-font-smoothing: antialiased;
  }
  main { max-width: 60rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; letter-spacing: -0.015em; }
  .sub { color: #6b6a62; margin: 0 0 2rem; font-size: .95rem; }
  .grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); }
  figure { margin: 0; }
  figure img {
    width: 100%; height: auto; display: block; border-radius: .6rem;
    border: 1px solid #e4e3dd; background: #fff;
  }
  figcaption { margin-top: .55rem; font-size: .9rem; }
  figcaption b { font-weight: 600; display: block; }
  figcaption span { color: #6b6a62; font-size: .82rem; }
  .empty { border: 1px dashed #d6d5cd; border-radius: .8rem; padding: 2.5rem 1.5rem; text-align: center; color: #6b6a62; }
  .empty b { display: block; color: #16150f; margin-bottom: .4rem; }
  a { color: inherit; }
  footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid #e4e3dd; color: #6b6a62; font-size: .82rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #131311; color: #f2f1ea; }
    figure img { border-color: #2c2b26; background: #1b1a17; }
    .sub, figcaption span, footer, .empty { color: #98968c; }
    .empty { border-color: #2c2b26; }
    .empty b { color: #f2f1ea; }
    footer { border-top-color: #2c2b26; }
  }
`;

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function shell(title, body) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Never indexed. A shared link is shared with people, not with the web. -->
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head><body><main>${body}</main></body></html>`;
}

export function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...SHARE_HEADERS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** The gallery. */
export function renderGallery(gallery, projectName) {
  const name = projectName || gallery.tenant;
  const figures = gallery.items
    .map(
      (i) => `<figure>
      <img src="/s/${esc(i.name)}" alt="${esc(i.title)}" loading="lazy">
      <figcaption><b>${esc(i.title)}</b><span>Shared ${esc(i.age)}</span></figcaption>
    </figure>`
    )
    .join('\n');

  const body =
    gallery.count === 0
      ? `<h1>${esc(name)}</h1>
      <p class="sub">A shared view of this design project.</p>
      <div class="empty">
        <b>Nothing has been shared yet.</b>
        Someone on the team publishes a view from their own computer.
        When they do, it appears here.
      </div>`
      : `<h1>${esc(name)}</h1>
      <p class="sub">${gallery.count} view${gallery.count === 1 ? '' : 's'} of this design project.
        Most recent ${esc(gallery.asOf ?? 'at an unknown time')}.</p>
      <div class="grid">${figures}</div>`;

  // The honesty line, on every page, whether or not anything looks stale.
  // A warning that appears only sometimes teaches people that its absence
  // means "current", which is the belief this is here to prevent.
  const footer = `<footer>
    These are pictures, not the live project — each was published from a
    teammate's computer at the time shown. Ask them for the current state.
  </footer>`;

  return shell(`${name} — shared`, body + footer);
}

/** Sharing is off. Not an error, and not a hint that the project exists. */
export function renderNotShared() {
  return shell(
    'Not shared',
    `<h1>Nothing to see here</h1>
     <p class="sub">This link does not point to anything that is being shared.</p>
     <div class="empty">
       If you were expecting a design project, ask the person who sent you the
       link — sharing is off unless someone turns it on.
     </div>`
  );
}
