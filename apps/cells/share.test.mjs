// Cloud Phase 18 — the read-only browser surface.
//
// The claim this surface rests on is that the vendor never executes anything
// the tenant authored. These tests are what makes that checkable rather than
// asserted, so they are deliberately blunt about the failure they prevent.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderGallery, renderNotShared } from './share-pages.mjs';
import {
  buildGallery,
  describeAge,
  prettyTitle,
  SHARE_CSP,
  snapshotContentType,
  snapshotObjectKey,
  viewTenantFromHostname,
} from './share.mjs';

describe('containment: only inert bytes are shareable', () => {
  it('SVG is NOT shareable, whatever else is', () => {
    // The sharpest line in this feature. An SVG is a document — it can carry
    // <script> and <foreignObject> — so serving one on the share origin hands
    // tenant-authored markup a same-origin execution context. Every other
    // format on the list is inert.
    assert.equal(snapshotContentType('logo.svg'), null);
    assert.equal(snapshotObjectKey('acme', 'logo.svg'), null);
    for (const bad of ['x.html', 'x.js', 'x.mjs', 'x.tsx', 'x.json', 'x.pdf', 'x.xml']) {
      assert.equal(snapshotContentType(bad), null, bad);
    }
    for (const ok of ['a.png', 'a.jpg', 'a.jpeg', 'a.webp', 'a.avif']) {
      assert.ok(snapshotContentType(ok), ok);
    }
  });

  it('the CSP forbids script outright', () => {
    // Not "restricts" — forbids. The surface exists BECAUSE it does not
    // execute tenant content, and a CSP admitting script would quietly make
    // that untrue while every test still passed.
    assert.match(SHARE_CSP, /default-src 'none'/);
    assert.ok(!/script-src/.test(SHARE_CSP) || /script-src 'none'/.test(SHARE_CSP));
    assert.match(SHARE_CSP, /frame-ancestors 'none'/);
    assert.match(SHARE_CSP, /img-src 'self' data:/);
  });

  it('the rendered page ships no script tag at all', () => {
    const html = renderGallery(
      buildGallery([{ key: 'tenants/acme/snapshots/a.png', size: 1, lastModified: new Date().toISOString() }], 'acme', Date.now()),
      'Acme'
    );
    assert.ok(!/<script/i.test(html), 'a script tag here would undo the whole claim');
    // Anchored to an attribute boundary: an unanchored /on[a-z]+=/ matches
    // inside `content=`, which fails on a page that is perfectly fine.
    assert.ok(!/\son[a-z]+\s*=/i.test(html), 'no inline event handlers either');
    assert.ok(!/javascript:/i.test(html), 'and no javascript: URLs');
  });

  it('a snapshot name cannot address anything but a snapshot', () => {
    for (const bad of [
      '../hub.db',
      'a/../../backups/g/hub.db.gz',
      '/abs.png',
      'a//b.png',
      '.hidden.png',
      'a/b/c/d/e.png',
      'has space.png',
    ]) {
      assert.equal(snapshotObjectKey('acme', bad), null, bad);
    }
    assert.equal(snapshotObjectKey('acme', 'ui/home.png'), 'tenants/acme/snapshots/ui/home.png');
  });
});

describe('the share origin is separate from the workspace origin', () => {
  it('only `view-` hostnames are the share view', () => {
    assert.equal(viewTenantFromHostname('view-acme.cloud.maude.sh', 'cloud.maude.sh'), 'acme');
    assert.equal(viewTenantFromHostname('acme.cloud.maude.sh', 'cloud.maude.sh'), null);
    assert.equal(viewTenantFromHostname('view-acme.evil.com', 'cloud.maude.sh'), null);
    assert.equal(viewTenantFromHostname('view-.cloud.maude.sh', 'cloud.maude.sh'), null);
    assert.equal(viewTenantFromHostname('view-AC ME.cloud.maude.sh', 'cloud.maude.sh'), null);
  });
});

describe('the view never implies liveness', () => {
  it('an empty gallery says nobody has shared, not that the project is empty', () => {
    const html = renderGallery(buildGallery([], 'acme', Date.now()), 'Acme');
    assert.match(html, /Nothing has been shared yet/);
    assert.ok(!/0 views/.test(html), 'an empty project and an unshared one are different things');
  });

  it('every page carries the as-of stamp, fresh or not', () => {
    // A warning that appears only when stale teaches people that its absence
    // means current — which is exactly the belief this prevents.
    const fresh = renderGallery(
      buildGallery([{ key: 'tenants/acme/snapshots/a.png', size: 1, lastModified: new Date().toISOString() }], 'acme', Date.now()),
      'Acme'
    );
    assert.match(fresh, /pictures, not the live project/);
    assert.match(fresh, /Shared just now/);
  });

  it('age is plain language, never a raw timestamp', () => {
    assert.equal(describeAge(0), 'just now');
    assert.equal(describeAge(60_000), '1 minute ago');
    assert.equal(describeAge(3 * 3600_000), '3 hours ago');
    assert.equal(describeAge(4 * 86400_000), '4 days ago');
    assert.equal(describeAge(70 * 86400_000), '2 months ago');
  });

  it('a gallery only ever contains this project', () => {
    const g = buildGallery(
      [
        { key: 'tenants/acme/snapshots/a.png', size: 1 },
        { key: 'tenants/other/snapshots/b.png', size: 1 },
        { key: 'tenants/acme/assets/c.png', size: 1 },
      ],
      'acme',
      0
    );
    assert.deepEqual(g.items.map((i) => i.name), ['a.png']);
  });
});

describe('the not-shared page tells a stranger nothing', () => {
  it('does not reveal whether the project exists', () => {
    const html = renderNotShared();
    assert.ok(!/acme/i.test(html));
    assert.match(html, /sharing is off unless someone turns it on/);
  });
});

describe('titles read like design work, not like filenames', () => {
  it('turns a snapshot key into something a person recognises', () => {
    assert.equal(prettyTitle('ui/alligators-moodboard-v3.png'), 'ui / alligators moodboard v3');
    assert.equal(prettyTitle('Home.png'), 'Home');
  });
});
