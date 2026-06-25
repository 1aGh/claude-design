import { generate as DefaultImage } from 'fumadocs-ui/og';
import { ImageResponse } from 'next/og';
import { appName } from '@/lib/shared';

// Default social-share card for every non-docs route (homepage, /about,
// /changelog, /roadmap, /desktop). Docs pages override this with their own
// per-page card via `generateMetadata().openGraph.images` (see app/og/docs).
// Next auto-fills `twitter:image` from this when no twitter-image is present.
export const revalidate = false;
export const alt = 'maude — vibe-design & vibe-code workflows for Claude Code';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <DefaultImage
      title="maude"
      description="Vibe-design & vibe-code workflows for Claude Code. Two plugins, one CLI, some vibes."
      site={appName}
    />,
    { ...size }
  );
}
