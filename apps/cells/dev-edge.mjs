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

import { createServer, request as httpRequest } from 'node:http';

import { CANVAS_ORIGIN_HEADER } from './cell-config.mjs';

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

createServer((req, res) => pipeToCell(req, res, { path: req.url, canvasOrigin: false })).listen(
  SHELL_PORT,
  () => console.log(`[edge] shell  origin → http://localhost:${SHELL_PORT}`)
);

// The per-project canvas origin (Cloud Phase 27): the origin root IS the
// project, so the path is passed through untouched. That is the whole reason
// this shape exists — canvas code holds ABSOLUTE asset URLs, and an absolute
// URL resolves against the origin.
createServer((req, res) => pipeToCell(req, res, { path: req.url, canvasOrigin: true })).listen(
  CANVAS_PORT,
  () => console.log(`[edge] canvas origin (project ${TENANT}) → http://localhost:${CANVAS_PORT}`)
);
