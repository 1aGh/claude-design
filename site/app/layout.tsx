import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './global.css';

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mdcc-mono',
  weight: ['400', '500', '700'],
  display: 'swap',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'md-claude, how it works mostly',
    template: '%s | md-claude',
  },
  description:
    'A Claude Code marketplace. Two plugins, one CLI, some vibes. design iterates canvases. flow runs the agentic loop. mdcc is the plumbing.',
  openGraph: {
    title: 'md-claude',
    description:
      'A Claude Code marketplace. Two plugins, one CLI, some vibes. Plan, design, ship, all from inside Claude.',
    type: 'website',
    siteName: 'md-claude',
  },
  twitter: { card: 'summary_large_image' },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${jetbrains.variable} mdcc`}
      data-theme="light"
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <a className="mdcc-skip-link" href="#main-content">
          Skip to main
        </a>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
