// The mount harness the CELL serves — Cloud Phase 25 A4/B3.
//
// A deliberately separate, much smaller relative of the desktop's
// `plugins/design/templates/_shell.html`. It is not a copy: the desktop shell
// carries a decade of editor chrome (export capture modes, hide-chrome CSS,
// devtools bridges) that a browser viewer has no route to. What IS shared is
// the contract — the importmap vocabulary, `window.__canvas_meta__`, and the
// default-export mount — because the canvas module on both sides is the same
// artifact and must find the same world.
//
// It runs in the SEGREGATED CANVAS ORIGIN. Everything it fetches carries the
// render capability (A4) and every one of those routes is a read.

/** HTML-escape for attribute + text interpolation. */
function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * @param {object} o
 * @param {string} o.canvasRel     design-root-relative canvas path
 * @param {string} o.token         render capability
 * @param {string} o.base          absolute base for canvas-origin routes
 * @param {object} o.meta          the canvas's `.meta.json`
 * @param {{tokens: string|null, components: string|null, layout: string|null}} o.css
 * @param {boolean} o.readOnly     viewer session (Phase 25 C3)
 */
export function renderCanvasShell({ canvasRel, token, base, meta, css, readOnly }) {
  const q = (path, extra = '') => `${base}${path}?t=${encodeURIComponent(token)}${extra}`;
  const assetUrl = (rel) => q('/_canvas/asset', `&path=${encodeURIComponent(rel)}`);
  const moduleUrl = q(
    '/_canvas/module',
    `&canvas=${encodeURIComponent(canvasRel)}${readOnly ? '&ro=1' : ''}`
  );
  const runtime = (slug) => `${base}/_canvas/runtime/${slug}.js?t=${encodeURIComponent(token)}`;

  const links = [css.tokens, css.layout, css.components]
    .filter(Boolean)
    .map((rel) => `<link rel="stylesheet" href="${esc(assetUrl(rel))}">`)
    .join('\n    ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${esc(canvasRel)}</title>
    <script>
      // Same posture as the desktop shell: deny the naive WebRTC exfil path
      // before any tenant module loads. Not bulletproof (a nested about:blank
      // frame can re-acquire them) and documented as a residual.
      for (var __k of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel']) {
        try { Object.defineProperty(window, __k, { value: undefined, configurable: false, writable: false }); } catch (_) {}
      }
      window.__canvas_meta__ = ${JSON.stringify(meta ?? {})};
      window.__canvas_meta_file__ = ${JSON.stringify(canvasRel)};
      window.__maude_read_only__ = ${readOnly ? 'true' : 'false'};
    </script>
    <style>
      :root { color-scheme: light dark; }
      html, body, #canvas-root { height: 100%; margin: 0; }
      body { background: var(--u-bg-0, #fff); }
      #canvas-mount-error {
        font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
        padding: 16px 20px; color: #b91c1c; background: #fff5f5; white-space: pre-wrap;
      }
      #canvas-mount-error:empty { display: none; }
    </style>
    ${links}
    <script type="importmap">
    {
      "imports": {
        "react": "${runtime('react')}",
        "react-dom": "${runtime('react-dom')}",
        "react-dom/client": "${runtime('react-dom_client')}",
        "react/jsx-runtime": "${runtime('react_jsx-runtime')}",
        "react/jsx-dev-runtime": "${runtime('react_jsx-dev-runtime')}",
        "motion": "${runtime('motion')}",
        "motion/react": "${runtime('motion_react')}",
        "yjs": "${runtime('yjs')}",
        "y-protocols/awareness": "${runtime('y-protocols_awareness')}",
        "y-protocols/sync": "${runtime('y-protocols_sync')}",
        "lib0/encoding": "${runtime('lib0_encoding')}",
        "lib0/decoding": "${runtime('lib0_decoding')}",
        "remotion": "${runtime('remotion')}",
        "@remotion/player": "${runtime('@remotion_player')}",
        "@remotion/media": "${runtime('@remotion_media')}",
        "@remotion/transitions": "${runtime('@remotion_transitions')}",
        "@remotion/transitions/fade": "${runtime('@remotion_transitions_fade')}",
        "@remotion/transitions/slide": "${runtime('@remotion_transitions_slide')}",
        "@remotion/transitions/wipe": "${runtime('@remotion_transitions_wipe')}",
        "@remotion/transitions/flip": "${runtime('@remotion_transitions_flip')}",
        "@remotion/transitions/clock-wipe": "${runtime('@remotion_transitions_clock-wipe')}",
        "@remotion/transitions/none": "${runtime('@remotion_transitions_none')}",
        "pixi.js": "${runtime('pixi-js')}",
        "@imgly/background-removal": "${runtime('@imgly_background-removal')}"
      }
    }
    </script>
  </head>
  <body>
    <div id="canvas-root"></div>
    <pre id="canvas-mount-error"></pre>
    <script type="module">
      import { createRoot } from 'react-dom/client';
      import { createElement } from 'react';

      const errorBox = document.getElementById('canvas-mount-error');
      function fail(message) {
        // A build refusal is a MESSAGE, not a stack trace: the allowlist and
        // the ceilings both speak plain sentences, and this is where the
        // person reads them.
        errorBox.textContent = message;
        try { parent.postMessage({ dgn: 'canvas-error', canvas: ${JSON.stringify(canvasRel)}, message }, '*'); } catch (_) {}
      }

      try {
        const res = await fetch(${JSON.stringify(moduleUrl)});
        if (!res.ok) {
          const body = await res.text();
          fail(body || ('This canvas could not be built (HTTP ' + res.status + ').'));
        } else {
          const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/javascript' }));
          const mod = await import(url);
          const Component = mod.default;
          if (typeof Component !== 'function') {
            fail('This canvas has no default export, so there is nothing to render.');
          } else {
            createRoot(document.getElementById('canvas-root')).render(createElement(Component));
            try { parent.postMessage({ dgn: 'loaded', canvas: ${JSON.stringify(canvasRel)} }, '*'); } catch (_) {}
          }
        }
      } catch (err) {
        fail(String(err && err.message ? err.message : err));
      }
    </script>
  </body>
</html>`;
}
