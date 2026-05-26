// Unit: helpers exported by ws.ts that gate the Phase 8 collab endpoint.
// Pure functions — no Bun.serve / no fixtures needed. The full integration
// (host-header rejection at the upgrade layer) is covered by the manual
// curl smoke in the Task 1 validate row.

import { describe, expect, test } from 'bun:test';

import { isLoopbackHost, parseCollabSlug } from '../ws.ts';

describe('parseCollabSlug', () => {
  test('extracts slug from /_ws/collab/<slug>', () => {
    expect(parseCollabSlug('/_ws/collab/foo')).toBe('foo');
    expect(parseCollabSlug('/_ws/collab/ui-home_screen')).toBe('ui-home_screen');
    expect(parseCollabSlug('/_ws/collab/A1B2c3')).toBe('A1B2c3');
  });

  test('rejects non-collab paths', () => {
    expect(parseCollabSlug('/_ws')).toBeNull();
    expect(parseCollabSlug('/_ws/inspector')).toBeNull();
    expect(parseCollabSlug('/_ws/collab')).toBeNull();
    expect(parseCollabSlug('/_ws/collab/')).toBeNull();
    expect(parseCollabSlug('/api/comments')).toBeNull();
  });

  test('rejects slugs with disallowed chars (URL-encoded, slashes, dots)', () => {
    expect(parseCollabSlug('/_ws/collab/foo/bar')).toBeNull();
    expect(parseCollabSlug('/_ws/collab/foo.bar')).toBeNull();
    expect(parseCollabSlug('/_ws/collab/foo%20bar')).toBeNull();
  });
});

describe('isLoopbackHost', () => {
  test('accepts loopback aliases with or without port', () => {
    expect(isLoopbackHost('127.0.0.1:4399')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('localhost:4399')).toBe(true);
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('[::1]:4399')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
  });

  test('case-insensitive', () => {
    expect(isLoopbackHost('LOCALHOST:4399')).toBe(true);
    expect(isLoopbackHost('LocalHost')).toBe(true);
  });

  test('rejects non-loopback hosts', () => {
    expect(isLoopbackHost('example.com')).toBe(false);
    expect(isLoopbackHost('example.com:4399')).toBe(false);
    expect(isLoopbackHost('10.0.0.1:4399')).toBe(false);
    expect(isLoopbackHost('192.168.1.1')).toBe(false);
    expect(isLoopbackHost('host.docker.internal')).toBe(false);
    // Common attacker patterns — host header smuggling tries.
    expect(isLoopbackHost('127.0.0.1.attacker.com')).toBe(false);
    expect(isLoopbackHost('localhost.attacker.com')).toBe(false);
  });

  test('handles missing / empty host gracefully', () => {
    expect(isLoopbackHost(null)).toBe(false);
    expect(isLoopbackHost('')).toBe(false);
    expect(isLoopbackHost('   ')).toBe(false);
  });
});
