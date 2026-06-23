// Tauri auto-update feed (Phase 32 / Task 1).
//
// The desktop app's updater (apps/desktop/src-tauri/tauri.conf.json →
// plugins.updater.endpoints) requests:
//
//   GET https://maude.sh/releases/{{target}}/{{arch}}/{{current_version}}
//
// where `target` ∈ darwin | windows | linux, `arch` ∈ x86_64 | aarch64 | …, and
// `current_version` is the running build's version. This route reads the GitHub
// "latest" release, finds the matching Tauri updater artifact + its detached
// signature, and returns the JSON the updater expects — or 204 No Content when the
// caller is already current. The artifact is signed in CI with the ed25519 key
// whose public half is pinned in tauri.conf.json, so a tampered feed can't push a
// rogue build (the client verifies the signature before installing).
//
// Set GITHUB_TOKEN in the Vercel project to lift the 60-req/h unauthenticated
// GitHub API limit; the response is CDN-cached for 5 min so real traffic rarely
// hits the API.

import { gitConfig } from '@/lib/shared';

const REPO = `${gitConfig.user}/${gitConfig.repo}`;

interface GhAsset {
  name: string;
  browser_download_url: string;
}
interface GhRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: GhAsset[];
}

// Tauri updater artifact extension per platform (createUpdaterArtifacts:true):
//   macOS   → <productName>.app.tar.gz
//   Windows → <productName>_<ver>_<arch>_<lang>.msi   (also .nsis .exe)
//   Linux   → <productName>_<ver>_<arch>.AppImage
const PLATFORM_EXT: Record<string, string[]> = {
  darwin: ['.app.tar.gz'],
  windows: ['.msi', '.nsis.zip', '.exe'],
  linux: ['.AppImage.tar.gz', '.AppImage'],
};

// arch tokens that may appear in an asset filename (so a multi-arch release picks
// the right one). Maps the Tauri `arch` param to the tokens we accept.
const ARCH_TOKENS: Record<string, string[]> = {
  x86_64: ['x86_64', 'x64', 'amd64'],
  aarch64: ['aarch64', 'arm64'],
  i686: ['i686', 'x86', 'ia32'],
  armv7: ['armv7', 'armhf'],
};

/** Numeric semver-ish compare; returns >0 if a is newer than b. Ignores build/pre. */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('-')[0].split('.').map(Number);
  const pb = b.replace(/^v/, '').split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function ghHeaders(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'maude-updater-feed',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ target: string; arch: string; current_version: string }> }
) {
  const { target, arch, current_version } = await params;

  const exts = PLATFORM_EXT[target];
  if (!exts) {
    // Static message — never reflect the raw `target` param back in the response.
    return Response.json({ error: 'unsupported target' }, { status: 400 });
  }

  let release: GhRelease;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: ghHeaders(),
      // Let Vercel's data cache hold the API result for 5 min.
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return Response.json({ error: `github api ${res.status}` }, { status: 502 });
    }
    release = (await res.json()) as GhRelease;
  } catch {
    return Response.json({ error: 'github api unreachable' }, { status: 502 });
  }

  const latest = release.tag_name?.replace(/^v/, '');
  if (!latest) return new Response(null, { status: 204 });

  // Already current (or ahead) → nothing to offer.
  if (compareVersions(latest, current_version) <= 0) {
    return new Response(null, { status: 204, headers: cacheHeaders() });
  }

  // Find the platform artifact, preferring one whose name carries the requested arch.
  const tokens = ARCH_TOKENS[arch] ?? [arch];
  const candidates = release.assets.filter((a) => exts.some((e) => a.name.endsWith(e)));
  const asset =
    candidates.find((a) => tokens.some((t) => a.name.toLowerCase().includes(t.toLowerCase()))) ??
    candidates[0];

  if (!asset) {
    // Release exists but has no artifact for this platform yet (e.g. Linux not built).
    return new Response(null, { status: 204, headers: cacheHeaders() });
  }

  // The detached signature ships as a sibling `<asset>.sig` release asset.
  const sigAsset = release.assets.find((a) => a.name === `${asset.name}.sig`);
  if (!sigAsset) {
    return Response.json({ error: 'signature asset missing' }, { status: 502 });
  }

  let signature: string;
  try {
    const sigRes = await fetch(sigAsset.browser_download_url, {
      headers: { 'User-Agent': 'maude-updater-feed' },
      next: { revalidate: 300 },
    });
    if (!sigRes.ok) return Response.json({ error: 'signature fetch failed' }, { status: 502 });
    signature = (await sigRes.text()).trim();
  } catch {
    return Response.json({ error: 'signature unreachable' }, { status: 502 });
  }

  return Response.json(
    {
      version: latest,
      notes: release.body || release.name || `Maude ${latest}`,
      pub_date: release.published_at,
      url: asset.browser_download_url,
      signature,
    },
    { headers: cacheHeaders() }
  );
}

function cacheHeaders(): HeadersInit {
  return { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };
}
