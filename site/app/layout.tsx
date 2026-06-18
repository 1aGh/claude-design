import { Analytics } from '@vercel/analytics/next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import './global.css';

// maude type system — Inter (body/UI), Inter Tight (display headings),
// JetBrains Mono (code + numerics). Wired to --font-body / --font-display /
// --font-mono in global.css. See DDR-09X token retarget.
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mdcc-mono',
  weight: ['400', '500', '700'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  weight: ['500', '600', '700'],
  display: 'swap',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'maude, how it works mostly',
    template: '%s | maude',
  },
  description:
    'Vibe-design & vibe-code workflows for Claude Code. Two plugins, one CLI, some vibes. design iterates canvases. flow runs the agentic loop. maude is the plumbing.',
  openGraph: {
    title: 'maude',
    description:
      'Vibe-design & vibe-code workflows for Claude Code. Two plugins, one CLI, some vibes. Plan, design, ship, all from inside Claude.',
    type: 'website',
    siteName: 'maude',
  },
  twitter: { card: 'summary_large_image' },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${jetbrains.variable} ${inter.variable} ${interTight.variable} mdcc`}
      data-theme="light"
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <a className="mdcc-skip-link" href="#main-content">
          Skip to main
        </a>
        <RootProvider>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
