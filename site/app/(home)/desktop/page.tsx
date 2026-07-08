import type { Metadata } from 'next';
import Link from 'next/link';
import { SkuLabel } from '@/components/mdcc/sku-label';
import stats from '@/lib/stats.json';
import { DownloadButton } from './download-button';

export const metadata: Metadata = {
  alternates: { canonical: '/desktop' },
  title: 'Download Maude for desktop',
  description:
    'Install the Maude desktop app for macOS and Windows. Canvas browser, git versioning, GitHub sign-in, and live collaboration — no terminal required. It keeps itself up to date.',
};

// What's included — the value-prop trio (lifts the Studio Hub artboard A skeleton,
// rewritten for the native app: the app IS the studio, not the self-hosted hub).
const INCLUDED = [
  {
    title: 'Canvas browser',
    body: 'Open a project and browse every screen as a live, multi-artboard canvas. Cmd+Click any element to edit its CSS against your real design tokens.',
  },
  {
    title: 'Git versioning, no git',
    body: 'See what you changed, Save a version, Publish, and Get latest — plain words for branches, commits, and pull. History and visual before/after built in.',
  },
  {
    title: 'Sign in with GitHub',
    body: 'One sign-in (device flow → your OS keychain). Start a private project, share by username, and collaborate. No new account, no SaaS tier.',
  },
  {
    title: 'Live collaboration',
    body: 'On the same branch, cursors, comments, and edits sync in real time across machines through your own self-hosted hub. No cloud middleman.',
  },
];

const FAQ = [
  {
    q: 'Does it require a terminal?',
    a: 'No. Download, install, sign in with GitHub, and start designing. The desktop app does everything the CLI does, in the UI.',
  },
  {
    q: 'Is it free?',
    a: 'Yes — open source under MIT. No telemetry, no signup, no “book a demo” button.',
  },
  {
    q: 'What about the AI editing?',
    a: 'AI editing drives a paired Claude Code on your own Pro/Max subscription — never API billing. The chat panel talks to the `claude` you already have installed.',
  },
  {
    q: 'Does it update itself?',
    a: 'Yes. Maude downloads new versions in the background and shows “Maude updated · restart to apply.” No npm, no terminal.',
  },
];

export default function DesktopPage() {
  return (
    <main className="mdcc-landing" id="main-content">
      <section className="mdcc-hero" aria-labelledby="desktop-h1">
        <div className="mdcc-hero-copy">
          <div className="mdcc-hero-sku">
            <SkuLabel>MDCC-APP/06</SkuLabel>
            <span aria-hidden="true">·</span>
            <span>DESKTOP</span>
            <span aria-hidden="true">·</span>
            <span>{stats.version}</span>
            <span aria-hidden="true">·</span>
            <span>macOS + WINDOWS</span>
          </div>
          <h1 id="desktop-h1">
            Install <span style={{ color: 'var(--accent)' }}>Maude</span>.
          </h1>
          <p className="mdcc-hero-punchline">
            The canvas browser, git versioning, and live collaboration — as a native app. No
            terminal, ever. It keeps itself up to date.
          </p>
          <DownloadButton />
          <p className="mdcc-hero-fineprint">
            Free and open source. Requires <strong>macOS 13+</strong> (Intel or Apple Silicon) or{' '}
            <strong>Windows 10+</strong> (64-bit). The AI editing pairs with your own{' '}
            <Link href="/docs/design">Claude Code</Link>.
          </p>
        </div>

        <aside className="mdcc-dl-preview" aria-hidden="true">
          <div className="mdcc-dl-preview-bar">
            <span className="mdcc-dl-dot" />
            <span className="mdcc-dl-dot" />
            <span className="mdcc-dl-dot" />
            <span className="mdcc-dl-preview-title">maude</span>
          </div>
          <div className="mdcc-dl-preview-body">
            <div className="mdcc-dl-preview-tree">
              <span>● ui / Studio.tsx</span>
              <span>○ ui / GitPanel.tsx</span>
              <span>○ system / tokens</span>
            </div>
            <div className="mdcc-dl-preview-stage">
              <div className="mdcc-dl-preview-ab" />
              <div className="mdcc-dl-preview-ab" />
            </div>
          </div>
        </aside>
      </section>

      <section aria-labelledby="incl-h">
        <div className="mdcc-section-head">
          <h2 id="incl-h">What&apos;s included.</h2>
          <span className="mdcc-eyebrow">one app · zero terminal · {stats.version}</span>
        </div>
        <div className="mdcc-cat-grid">
          {INCLUDED.map((item) => (
            <div key={item.title} className="mdcc-cat-card" style={{ cursor: 'default' }}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="req-h">
        <div className="mdcc-section-head">
          <h2 id="req-h">System requirements.</h2>
        </div>
        <dl className="mdcc-about-meta">
          <div>
            <dt>macOS</dt>
            <dd>13 Ventura or newer · Intel or Apple Silicon · .dmg</dd>
          </div>
          <div>
            <dt>Windows</dt>
            <dd>10 or newer · 64-bit · .msi</dd>
          </div>
          <div>
            <dt>Disk</dt>
            <dd>~250 MB</dd>
          </div>
          <div>
            <dt>AI editing</dt>
            <dd>
              optional — a paired <Link href="/docs/design">Claude Code</Link>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="faq-h">
        <div className="mdcc-section-head">
          <h2 id="faq-h">FAQ.</h2>
        </div>
        <dl className="mdcc-desktop-faq">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mdcc-hero-fineprint">
          Running a team? The desktop app connects to a hub from the onboarding wizard — see{' '}
          <Link href="/docs/hub">self-hosting the hub</Link>.
        </p>
      </section>
    </main>
  );
}
