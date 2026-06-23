// Stable per-platform download redirect (Phase 32 / Task 3).
//
//   GET /desktop/download/macos    → 302 to the latest .dmg on the GitHub Release
//   GET /desktop/download/windows  → 302 to the latest .msi
//
// Asset filenames carry the version (Maude_0.30.0_x64_en-US.msi), so there's no
// version-less URL to link directly. This resolves the newest matching asset at
// request time and 302s to it; on any failure it falls back to the releases page,
// so the button never dead-ends. CDN-cached 5 min.

import { gitConfig } from '@/lib/shared';

const REPO = `${gitConfig.user}/${gitConfig.repo}`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

// Installer extension per platform — the user-facing download (NOT the updater
// artifact: no .app.tar.gz / .sig here).
const PLATFORM_EXT: Record<string, string[]> = {
  macos: ['.dmg'],
  windows: ['.msi'],
};

interface GhAsset {
  name: string;
  browser_download_url: string;
}

function ghHeaders(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'maude-download-redirect',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export async function GET(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const exts = PLATFORM_EXT[platform];
  if (!exts) return Response.redirect(RELEASES_PAGE, 302);

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: ghHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) return Response.redirect(RELEASES_PAGE, 302);
    const release = (await res.json()) as { assets: GhAsset[] };
    const asset = release.assets?.find((a) => exts.some((e) => a.name.endsWith(e)));
    return Response.redirect(asset?.browser_download_url ?? RELEASES_PAGE, 302);
  } catch {
    return Response.redirect(RELEASES_PAGE, 302);
  }
}
