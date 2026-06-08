'use client';

/**
 * ChangelogTimeline — the combined Changelog & Roadmap, one spine timeline
 * (board G of .design/ui/Studio Docs.tsx, maude DS). Merges three data kinds:
 *   · now     ← roadmap.json phases with status "in-progress" (+ current phase)
 *   · shipped ← whats-new.json entries (curated release notes)
 *   · next    ← roadmap.json phases with status "planned"
 * The page maps the raw JSON into TLGroup[] (server) and passes it here; this
 * component owns only the segmented filter (All / Now / Shipped / Next).
 */

import { useState } from 'react';

export type TLKind = 'now' | 'shipped' | 'next';

export type TLItem = {
  id: string;
  tag: string;
  title: string;
  date: string;
  bullets: string[];
  href?: string;
};

export type TLGroup = { kind: TLKind; label: string; items: TLItem[] };

type Filter = 'all' | TLKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'now', label: 'Now' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'next', label: 'Next' },
];

const DOT_LEGEND: { kind: TLKind; label: string }[] = [
  { kind: 'now', label: 'in progress' },
  { kind: 'shipped', label: 'shipped' },
  { kind: 'next', label: 'planned' },
];

export function ChangelogTimeline({
  groups,
  generated,
  counts,
}: {
  groups: TLGroup[];
  generated: string;
  counts: { now: number; shipped: number; next: number };
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = groups.filter((g) => filter === 'all' || g.kind === filter);
  const generatedDate = generated.slice(0, 10);

  return (
    <main className="mdcc-landing" id="main-content">
      <div className="mdcc-cr-inner">
        <header className="mdcc-cr-head">
          <div className="mdcc-cr-eyebrow">CHANGELOG · ROADMAP</div>
          <h1 className="mdcc-cr-h1">
            What shipped, what&apos;s next<span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <p className="mdcc-cr-sub">
            One timeline — releases, work in progress, and the plan. Generated from{' '}
            <code>.ai/plans/</code> + <code>whats-new.json</code>, never hand-kept.
          </p>

          <div className="mdcc-cr-controls">
            <div className="mdcc-seg" role="tablist" aria-label="Filter timeline">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className="mdcc-seg-btn"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mdcc-cr-dotlegend">
              {DOT_LEGEND.map((d) => (
                <span key={d.kind} className="mdcc-legend-item">
                  <span className={`mdcc-cr-dot is-${d.kind}`} aria-hidden="true" /> {d.label}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="mdcc-tl">
          {visible.map((g) => (
            <section key={g.kind} aria-label={g.label}>
              <h2 className="mdcc-tl-group">
                {g.label}
                <span className="mdcc-tl-group-count" aria-hidden="true">
                  {g.items.length}
                </span>
              </h2>
              {g.items.length === 0 ? (
                <p className="mdcc-tl-empty">Nothing here right now.</p>
              ) : (
                g.items.map((it) => {
                  const Card = it.href ? 'a' : 'div';
                  const linkProps = it.href
                    ? { href: it.href, target: '_blank', rel: 'noopener noreferrer' }
                    : {};
                  return (
                    <div key={it.id} className="mdcc-tl-item">
                      <span className={`mdcc-tl-dot is-${g.kind}`} aria-hidden="true" />
                      <Card className="mdcc-tl-card" {...linkProps}>
                        <div className="mdcc-tl-cardhd">
                          <span className={`mdcc-tl-tag${g.kind === 'now' ? ' is-accent' : ''}`}>
                            {it.tag}
                          </span>
                          <span className="mdcc-tl-title">{it.title}</span>
                          <span className="mdcc-tl-date">{it.date}</span>
                        </div>
                        {it.bullets.length ? (
                          <ul className="mdcc-tl-bullets">
                            {it.bullets.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        ) : null}
                      </Card>
                    </div>
                  );
                })
              )}
            </section>
          ))}

          <p className="mdcc-tl-foot">
            {counts.shipped} shipped · {counts.now} in flight · {counts.next} planned · regenerated{' '}
            {generatedDate} · <a href="/roadmap">full phase archive →</a>
          </p>
        </div>
      </div>
    </main>
  );
}
