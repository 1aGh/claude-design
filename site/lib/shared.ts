export const appName = 'maude';

// Canonical production origin — used for metadataBase, sitemap.xml, and JSON-LD
// absolute URLs. Prefer the per-deploy env override; fall back to the real
// production domain so canonical / OG URLs stay correct even when the env var
// is unset (previously this fell back to localhost / the *.vercel.app URL,
// which would have leaked preview origins into canonical tags).
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maude.sh';

export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: '1aGh',
  repo: 'maude',
  branch: 'main',
};
