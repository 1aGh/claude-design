#!/usr/bin/env node
// A local stand-in for the data plane — Cloud Phase 27.
//
// WHY THIS EXISTS. Phase 27's canvas bugs were all of one kind: a URL that is
// right at the origin root and wrong when the project lives in the PATH. None of
// them could be reproduced by running the cell directly, because running it
// directly IS the origin-root case. So every one was found in production, at
// roughly twenty minutes a round.
//
// This reproduces the two things `worker.mjs` does that change what the cell
// sees, and nothing else:
//
//   1. `canvas.<zone>/<project>/…` is rewritten to `…` — the cell must never
//      strip the segment itself, and the browser must never stop sending it.
//   2. the canvas-origin marker is SET on that route and STRIPPED everywhere
//      else, which is how a cell knows which door a request came through.
//
// Two listeners rather than two hostnames, because a browser needs a real
// origin boundary and `localhost:A` / `localhost:B` are genuinely different
// origins — the same property the fleet gets from `canvas.<zone>`.
//
//   node apps/cells/dev-edge.mjs --cell 1234 --shell 18500 --canvas 18501 --tenant alligators
//
// Development only. It authenticates nothing; the cell behind it does.
//
// WHAT IT DOES NOT EMULATE, and what that costs you. Like the real data plane
// it drops the browser's `Host` — so the cell behind it must be told its public
// identity the same way a real cell is (D4), or it will not recognise its own
// front door. Boot it with `HUB_PUBLIC_URL=http://localhost:18500` and
// `MAUDE_PUBLIC_CANVAS_ORIGIN=http://localhost:18501`; without the first, the
// shell's live socket is refused by the CSWSH Origin gate in `studio-proxy.mjs`
// and the status bar sits on "reconnecting" — which is what this harness's own
// missing upgrade handler used to look like, and is not the same bug.

import { createServer, request as httpRequest } from 'node:http';

import { CANVAS_ORIGIN_HEADER } from './cell-config.mjs';

// The real data plane is a Worker, and a Worker forwards a WebSocket upgrade
// as a matter of course. `http.request` does not — it pipes bodies, and a 101
// arrives as a response nobody hijacks. Without the upgrade handler below, the
// studio's live socket never completes here and the status bar sits on
// "reconnecting" forever: a harness artefact that reads exactly like a product
// bug, on the one surface this harness exists to tell the truth about.

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const CELL = Number(arg('cell', 1234));
const SHELL_PORT = Number(arg('shell', 18500));
const CANVAS_PORT = Number(arg('canvas', 18501));
const TENANT = arg('tenant', 'alligators');

function pipeToCell(req, res, { path, canvasOrigin }) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.toLowerCase() === CANVAS_ORIGIN_HEADER) continue; // never forgeable
    if (k.toLowerCase() === 'host') continue;
    headers[k] = v;
  }
  if (canvasOrigin) headers[CANVAS_ORIGIN_HEADER] = '1';
  const up = httpRequest(
    { host: '127.0.0.1', port: CELL, method: req.method, path, headers },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    }
  );
  up.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`edge: cell unreachable — ${e.message}\n`);
  });
  req.pipe(up);
}

/** Forward a WebSocket upgrade by hand: same headers, then two raw pipes. */
function upgradeToCell(req, socket, head, { canvasOrigin }) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.toLowerCase() === CANVAS_ORIGIN_HEADER) continue;
    if (k.toLowerCase() === 'host') continue;
    headers[k] = v;
  }
  if (canvasOrigin) headers[CANVAS_ORIGIN_HEADER] = '1';
  const up = httpRequest({
    host: '127.0.0.1',
    port: CELL,
    method: req.method,
    path: req.url,
    headers,
  });
  up.on('upgrade', (upRes, upSocket, upHead) => {
    const status = `HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}\r\n`;
    const lines = Object.entries(upRes.headers).map(([k, v]) => `${k}: ${v}\r\n`);
    socket.write(`${status}${lines.join('')}\r\n`);
    if (upHead?.length) socket.write(upHead);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
    for (const s of [socket, upSocket]) s.on('error', () => s.destroy());
  });
  up.on('response', (upRes) => {
    // A refusal (401/404) comes back as an ordinary response — pass the status
    // through so the browser reports it rather than a bare disconnect.
    socket.write(`HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}\r\n\r\n`);
    socket.destroy();
  });
  up.on('error', () => socket.destroy());
  if (head?.length) up.write(head);
  up.end();
}

const shell = createServer((req, res) =>
  pipeToCell(req, res, { path: req.url, canvasOrigin: false })
);
shell.on('upgrade', (req, socket, head) =>
  upgradeToCell(req, socket, head, { canvasOrigin: false })
);
shell.listen(SHELL_PORT, () =>
  console.log(`[edge] shell  origin → http://localhost:${SHELL_PORT}`)
);

// The per-project canvas origin (Cloud Phase 27): the origin root IS the
// project, so the path is passed through untouched. That is the whole reason
// this shape exists — canvas code holds ABSOLUTE asset URLs, and an absolute
// URL resolves against the origin.
const canvas = createServer((req, res) =>
  pipeToCell(req, res, { path: req.url, canvasOrigin: true })
);
canvas.on('upgrade', (req, socket, head) =>
  upgradeToCell(req, socket, head, { canvasOrigin: true })
);
canvas.listen(CANVAS_PORT, () =>
  console.log(`[edge] canvas origin (project ${TENANT}) → http://localhost:${CANVAS_PORT}`)
);
