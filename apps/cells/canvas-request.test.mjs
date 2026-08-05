// The canvas-lane Request rebuild — the v0.55.0 write-loss lesson, pinned.
//
// `new Request(url, { ...request })` copies NOTHING from a Request: `method`,
// `body` and the rest are prototype getters, invisible to object spread. The
// rebuild at the canvas branch had exactly that shape, so every canvas-origin
// write (annotation strokes, artboard layout, media) crossed the Worker as a
// bodyless GET, the studio answered from its GET branches with a 200, and the
// client read "saved" while nothing persisted — straight through the hub-side
// door fix that was supposed to end this class of bug. These tests hold the
// property the whole write path depends on: the rebuild preserves method and
// body, byte for byte.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CANVAS_ORIGIN_HEADER,
  canvasInnerRequest,
  stripCanvasOriginMarker,
} from './cell-config.mjs';

const CANVAS_URL = 'https://canvas-alligators.cloud.maude.sh/_api/annotations?file=ui/x.tsx';

test('a canvas-lane PUT crosses the rebuild as a PUT, body intact', async () => {
  const body = JSON.stringify({ file: 'ui/x.tsx', svg: '<svg/>' });
  const request = new Request(CANVAS_URL, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const url = new URL(request.url);
  const inner = canvasInnerRequest(request, url, '/_api/annotations');

  assert.equal(inner.method, 'PUT');
  assert.equal(await inner.text(), body);
  assert.equal(inner.headers.get('content-type'), 'application/json');
  assert.equal(new URL(inner.url).pathname, '/_api/annotations');
  assert.equal(new URL(inner.url).search, '?file=ui/x.tsx');
});

test('the rebuild asserts the canvas-origin marker itself — an outside value never rides through', () => {
  const request = new Request(CANVAS_URL, {
    method: 'POST',
    headers: { [CANVAS_ORIGIN_HEADER]: 'forged' },
    body: '{}',
  });
  const inner = canvasInnerRequest(request, new URL(request.url), '/_api/annotations');
  assert.equal(inner.headers.get(CANVAS_ORIGIN_HEADER), '1');
  assert.equal(inner.method, 'POST');
});

test('a GET stays a GET — the rebuild invents nothing', () => {
  const request = new Request(CANVAS_URL);
  const inner = canvasInnerRequest(request, new URL(request.url), '/_api/annotations');
  assert.equal(inner.method, 'GET');
  assert.equal(inner.body, null);
});

test('the tenant-lane marker strip keeps method and body too', async () => {
  const request = new Request('https://alligators.cloud.maude.sh/_api/annotations', {
    method: 'PUT',
    headers: { [CANVAS_ORIGIN_HEADER]: 'forged', 'content-type': 'application/json' },
    body: '{"file":"ui/x.tsx","svg":"<svg/>"}',
  });
  const inbound = stripCanvasOriginMarker(request);

  assert.equal(inbound.headers.has(CANVAS_ORIGIN_HEADER), false);
  assert.equal(inbound.method, 'PUT');
  assert.equal(await inbound.text(), '{"file":"ui/x.tsx","svg":"<svg/>"}');
});

test('a request without the marker passes through untouched — same object, no copy', () => {
  const request = new Request('https://alligators.cloud.maude.sh/health');
  assert.equal(stripCanvasOriginMarker(request), request);
});
