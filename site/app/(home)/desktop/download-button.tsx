'use client';

import { useEffect, useState } from 'react';

// Platform-detected download button (Phase 32 / Task 3). Detects the visitor's OS
// and promotes the matching installer; the other platform stays available as a
// secondary link. The hrefs hit /desktop/download/<platform>, a tiny redirect that
// resolves the latest matching asset on the GitHub Release (falls back to the
// releases page). Rendered client-side because OS detection needs `navigator`.

type Platform = 'macos' | 'windows' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (/mac|iphone|ipad|ipod/.test(ua)) return 'macos';
  if (/win/.test(ua)) return 'windows';
  return 'unknown';
}

const LABEL: Record<'macos' | 'windows', string> = {
  macos: 'Download for macOS',
  windows: 'Download for Windows',
};
const FILE: Record<'macos' | 'windows', string> = {
  macos: '.dmg · Apple Silicon',
  windows: '.msi · 64-bit',
};

export function DownloadButton() {
  // Start as 'unknown' so SSR + first paint match (no hydration mismatch), then
  // resolve the real platform on the client.
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => setPlatform(detectPlatform()), []);

  const primary = platform === 'windows' ? 'windows' : 'macos';
  const secondary = primary === 'macos' ? 'windows' : 'macos';

  return (
    <div className="mdcc-dl">
      <a className="mdcc-dl-primary" href={`/desktop/download/${primary}`}>
        <span className="mdcc-dl-primary-label">{LABEL[primary]}</span>
        <span className="mdcc-dl-primary-file">{FILE[primary]}</span>
      </a>
      <div className="mdcc-dl-alt">
        <a href={`/desktop/download/${secondary}`}>{LABEL[secondary]}</a>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/1aGh/maude/releases/latest" target="_blank" rel="noreferrer">
          All downloads
        </a>
      </div>
    </div>
  );
}
