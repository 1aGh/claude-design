import { CopyButton } from '@/components/mdcc/copy-button';
import { SkuLabel } from '@/components/mdcc/sku-label';
import Link from 'next/link';

const INSTALL_SNIPPET = `# 1 — add the marketplace
/plugin marketplace add 1aGh/md-claude

# 2 — install plugins
/plugin install design@md-claude
/plugin install flow@md-claude

# optional — scaffold a project from CLI
npm i -g @1agh/md-claude
mdcc init --name my-app`;

const CATALOG = [
  {
    sku: 'MDCC-DSN/01',
    slug: 'design',
    version: 'v0.12.0',
    title: 'Canvas iteration',
    description:
      'Canvas-first iteration on HTML/JSX mocks. Includes a zero-dep dev server with element inspector overlay (Cmd+Click → selection lands on disk for the next /design:edit).',
    tags: ['commands · 12', 'skills · 4', 'critics · 9'],
    install: '/plugin install design@md-claude',
    docs: '/docs/design',
  },
  {
    sku: 'MDCC-FLW/02',
    slug: 'flow',
    version: 'v0.12.0',
    title: 'Agentic loop',
    description:
      'Generic agentic workflow loop with a second-brain .ai/ workspace. Project-agnostic via per-repo workflows.config.json. Plan → execute → done → validate.',
    tags: ['commands · 28', 'skills · 14', 'agents · 4'],
    install: '/plugin install flow@md-claude',
    docs: '/docs/flow',
  },
  {
    sku: 'MDCC-CLI/03',
    slug: 'mdcc',
    version: 'v0.12.0',
    title: 'The CLI',
    description:
      'Scaffolds the .ai/ workspace, edits workflows.config.json, and boots the design dev server. Ships mdcc and the back-compat alias claude-design-server.',
    tags: ['subcommands · 3', 'node ≥ 20', 'zero deps'],
    install: 'npm i -g @1agh/md-claude',
    docs: '/docs/cli',
  },
];

export default function HomePage() {
  return (
    <main className="mdcc-landing" id="plugins">
      <section className="mdcc-hero" aria-labelledby="land-h1">
        <div className="mdcc-hero-copy">
          <div className="mdcc-hero-sku">
            <SkuLabel>MDCC-MKT/00</SkuLabel>
            <span aria-hidden="true">·</span>
            <span>THE CATALOG</span>
            <span aria-hidden="true">·</span>
            <span>v0.12.0</span>
            <span aria-hidden="true">·</span>
            <span>PUBLISHED 2026-05-09</span>
          </div>
          <h1 id="land-h1">A Claude Code marketplace.</h1>
          <p>
            Two plugins — <code>design</code> (canvas iteration) and <code>flow</code> (agentic
            workflow loop). Plus the <code>mdcc</code> CLI for scaffolding. Browse the catalog or
            read the docs.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link href="/docs" className="mdcc-cta-primary">
              Read the docs →
            </Link>
            <Link href="#plugins" className="mdcc-cta-ghost">
              Browse plugins
            </Link>
          </div>
        </div>

        <section className="mdcc-install" aria-label="Install snippet">
          <div className="mdcc-install-head">
            <span>
              <strong>install.sh</strong> · inside Claude Code
            </span>
            <CopyButton
              text={INSTALL_SNIPPET}
              className="mdcc-install-copy"
              ariaLabel="Copy install snippet"
            >
              COPY
            </CopyButton>
          </div>
          <pre>{INSTALL_SNIPPET}</pre>
        </section>
      </section>

      <section aria-labelledby="cat-h">
        <div className="mdcc-section-head">
          <h2 id="cat-h">The catalog.</h2>
          <span className="mdcc-eyebrow">03 shipping units · all · v0.12.0</span>
        </div>
        <div className="mdcc-cat-grid">
          {CATALOG.map((item) => (
            <Link key={item.sku} href={item.docs} className="mdcc-cat-card">
              <div className="mdcc-cat-card-head">
                <SkuLabel>
                  {item.sku} · {item.slug}
                </SkuLabel>
                <span className="text-xs" style={{ color: 'var(--fg-2)' }}>
                  {item.version}
                </span>
              </div>
              <h3>
                <code>{item.slug}</code> — {item.title}
              </h3>
              <p>{item.description}</p>
              <div
                className="flex flex-wrap gap-2"
                style={{ fontSize: 'var(--type-xs)', color: 'var(--fg-2)' }}
              >
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="mdcc-cat-card-foot">
                <span>read docs →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer>
        <dl className="mdcc-meta-footer">
          <div>
            <dt>Published</dt>
            <dd>2026-05-09</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              <a href="https://github.com/1aGh/md-claude">github.com/1aGh/md-claude</a>
            </dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>MIT</dd>
          </div>
          <div>
            <dt>Contributors</dt>
            <dd>4 · build green</dd>
          </div>
        </dl>
      </footer>
    </main>
  );
}
