import { SkuLabel } from '@/components/mdcc/sku-label';

export type WhatsNewKind = 'feature' | 'improvement' | 'usage' | 'fix';

export type WhatsNewEntry = {
  id: string;
  version: string | null;
  date: string | null;
  kind: WhatsNewKind;
  title: string;
  summary: string;
  learnMore?: string;
  surface?: string;
};

const KIND_LABEL: Record<WhatsNewKind, string> = {
  feature: 'New',
  improvement: 'Better',
  usage: 'Tip',
  fix: 'Fix',
};

// Only render learnMore as a link when it's an http(s) URL (defense-in-depth
// against a javascript:/data: scheme reaching the href — security review).
function isSafeHref(url: string | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function parseVer(v: string | null): [number, number, number] | null {
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// Descending semver compare (newest first); unparseable sorts last.
function descVer(a: string, b: string): number {
  const pa = parseVer(a);
  const pb = parseVer(b);
  if (!pa) return 1;
  if (!pb) return -1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

type Group = { key: string; label: string; meta: string; entries: WhatsNewEntry[] };

function groupByVersion(entries: WhatsNewEntry[]): Group[] {
  const pending = entries.filter((e) => e.version == null);
  const byVersion = new Map<string, WhatsNewEntry[]>();
  for (const e of entries) {
    if (e.version == null) continue;
    const arr = byVersion.get(e.version) ?? [];
    arr.push(e);
    byVersion.set(e.version, arr);
  }
  const groups: Group[] = [];
  if (pending.length) {
    groups.push({ key: 'pending', label: 'Next release', meta: 'unreleased', entries: pending });
  }
  for (const version of [...byVersion.keys()].sort(descVer)) {
    const items = byVersion.get(version) ?? [];
    const date = items.find((e) => e.date)?.date ?? '';
    groups.push({ key: version, label: `v${version}`, meta: date, entries: items });
  }
  return groups;
}

export function WhatsNewFeed({
  generated,
  version,
  entries,
}: {
  generated: string;
  version: string;
  entries: WhatsNewEntry[];
}) {
  const groups = groupByVersion(entries);
  const generatedDate = generated.slice(0, 10);
  const featureCount = entries.filter((e) => e.kind === 'feature').length;

  return (
    <main className="mdcc-landing" id="main-content">
      <section className="mdcc-hero" aria-labelledby="wn-h1">
        <div className="mdcc-hero-copy">
          <div className="mdcc-hero-sku">
            <SkuLabel>MDCC-WN/00</SkuLabel>
            <span aria-hidden="true">·</span>
            <span>WHAT&rsquo;S NEW</span>
            <span aria-hidden="true">·</span>
            <span>
              {entries.length} update{entries.length === 1 ? '' : 's'}, {featureCount} feature
              {featureCount === 1 ? '' : 's'}
            </span>
          </div>
          <h1 id="wn-h1">
            What&rsquo;s new<span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <p className="mdcc-hero-punchline">
            Every user-facing update, surfaced right inside the canvas browser too. The same feed
            powers the in-app <code>&#10022; New</code> notice. Current line:{' '}
            <code>v{version}</code>.
          </p>
        </div>
      </section>

      <section className="mdcc-roadmap" aria-labelledby="wn-sec-h">
        <div className="mdcc-section-head">
          <h2 id="wn-sec-h">Release notes.</h2>
          <span className="mdcc-eyebrow">
            {entries.length} entries · regenerated {generatedDate}
          </span>
        </div>

        {groups.length === 0 ? (
          <p className="mdcc-roadmap-summary">Nothing here yet.</p>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="mdcc-roadmap-group" aria-labelledby={`wn-grp-${g.key}`}>
              <h3 className="mdcc-roadmap-group-head" id={`wn-grp-${g.key}`}>
                <span>{g.label}</span>
                {g.meta ? (
                  <span className="mdcc-roadmap-group-count" aria-hidden="true">
                    {g.meta}
                  </span>
                ) : null}
              </h3>
              <ol className="mdcc-roadmap-list">
                {g.entries.map((e) => {
                  const row = (
                    <>
                      <span className="mdcc-roadmap-sku">
                        <SkuLabel>{KIND_LABEL[e.kind]}</SkuLabel>
                      </span>
                      <span className="mdcc-roadmap-title">{e.title}</span>
                      <span className="mdcc-roadmap-meta" aria-hidden="true">
                        {e.version ? `v${e.version}` : 'next'}
                      </span>
                    </>
                  );
                  return (
                    <li key={e.id} className="mdcc-roadmap-item">
                      {isSafeHref(e.learnMore) ? (
                        <a
                          className="mdcc-roadmap-row"
                          href={e.learnMore}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row}
                        </a>
                      ) : (
                        <div className="mdcc-roadmap-row">{row}</div>
                      )}
                      {e.summary ? <p className="mdcc-roadmap-summary">{e.summary}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))
        )}
      </section>
    </main>
  );
}
