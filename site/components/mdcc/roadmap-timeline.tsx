import { SkuLabel } from '@/components/mdcc/sku-label';

export type Status = 'done' | 'in-progress' | 'planned' | 'icebox';

export type Phase = {
  id: string;
  title: string;
  status: Status;
  shipTarget: string | null;
  date: string | null;
  summary: string;
  planPath: string;
  archived: boolean;
  phaseKey: string | null;
};

export type CurrentPhase = {
  id: string;
  title: string;
  branch: string | null;
  status: string | null;
} | null;

const GITHUB_BLOB = 'https://github.com/1aGh/maude/blob/main';

const STATUS_GLYPH: Record<Status, string> = {
  done: '[x]',
  'in-progress': '[~]',
  planned: '[ ]',
  icebox: '[*]',
};

const STATUS_ARIA: Record<Status, string> = {
  done: 'done',
  'in-progress': 'in progress',
  planned: 'planned',
  icebox: 'icebox',
};

const STATUS_RANK: Record<Status, number> = {
  done: 0,
  'in-progress': 1,
  planned: 2,
  icebox: 3,
};

function skuFor(phase: Phase): string {
  const key = phase.phaseKey ?? phase.id.replace(/[^a-z0-9]+/gi, '-').slice(0, 12);
  return `MDCC-RDM/${key}`;
}

function rightMeta(phase: Phase): string {
  if (phase.status === 'done') return phase.date ?? '';
  if (phase.status === 'in-progress') return 'now';
  if (phase.status === 'icebox') return phase.shipTarget ?? 'icebox';
  return phase.shipTarget ?? 'planned';
}

function groupedPhases(phases: Phase[]) {
  const groups: Record<Status, Phase[]> = {
    done: [],
    'in-progress': [],
    planned: [],
    icebox: [],
  };
  for (const p of phases) groups[p.status].push(p);
  return groups;
}

const GROUP_LABELS: Array<[Status, string]> = [
  ['done', 'Shipped'],
  ['in-progress', 'In progress'],
  ['planned', 'Planned'],
  ['icebox', 'Icebox'],
];

export function RoadmapTimeline({
  phases,
  currentPhase,
  generated,
}: {
  phases: Phase[];
  currentPhase: CurrentPhase;
  generated: string;
}) {
  const sorted = [...phases].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  const groups = groupedPhases(sorted);
  const generatedDate = generated.slice(0, 10);
  const counts = sorted.reduce<Record<Status, number>>(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    { done: 0, 'in-progress': 0, planned: 0, icebox: 0 }
  );

  return (
    <main className="mdcc-landing" id="main-content">
      <section className="mdcc-hero" aria-labelledby="rdm-h1">
        <div className="mdcc-hero-copy">
          <div className="mdcc-hero-sku">
            <SkuLabel>MDCC-RDM/00</SkuLabel>
            <span aria-hidden="true">·</span>
            <span>THE ROADMAP</span>
            <span aria-hidden="true">·</span>
            <span>
              {counts.done} shipped, {counts['in-progress']} in flight, {counts.planned} queued
            </span>
          </div>
          <h1 id="rdm-h1">
            Roadmap<span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <p className="mdcc-hero-punchline">
            Every phase, past and planned. Source of truth lives in <code>.ai/plans/</code> and{' '}
            <code>.ai/state/STATE.md</code>. This page regenerates on every build.
          </p>
          {currentPhase ? (
            <p className="mdcc-hero-fineprint">
              Currently shipping <code>{currentPhase.id}</code>
              {currentPhase.branch ? (
                <>
                  {' '}
                  on <code>{currentPhase.branch}</code>
                </>
              ) : null}
              .
            </p>
          ) : null}
        </div>

        <aside className="mdcc-roadmap-legend" aria-label="Status legend">
          <ul>
            {(['done', 'in-progress', 'planned', 'icebox'] as Status[]).map((s) => (
              <li key={s}>
                <span className="mdcc-roadmap-glyph" aria-hidden="true">
                  {STATUS_GLYPH[s]}
                </span>
                <span className="mdcc-roadmap-legend-label">{STATUS_ARIA[s]}</span>
                <span className="mdcc-roadmap-legend-count">{counts[s]}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="mdcc-roadmap" aria-labelledby="rdm-sec-h">
        <div className="mdcc-section-head">
          <h2 id="rdm-sec-h">All phases.</h2>
          <span className="mdcc-eyebrow">
            {sorted.length} units · regenerated {generatedDate}
          </span>
        </div>

        {GROUP_LABELS.map(([status, label]) => {
          const items = groups[status];
          if (!items.length) return null;
          return (
            <section
              key={status}
              className="mdcc-roadmap-group"
              aria-labelledby={`rdm-grp-${status}`}
            >
              <h3 className="mdcc-roadmap-group-head" id={`rdm-grp-${status}`}>
                <span className="mdcc-roadmap-glyph" aria-hidden="true">
                  {STATUS_GLYPH[status]}
                </span>
                <span>{label}</span>
                <span className="mdcc-roadmap-group-count" aria-hidden="true">
                  {items.length}
                </span>
              </h3>
              <ol className="mdcc-roadmap-list">
                {items.map((p) => {
                  const href = `${GITHUB_BLOB}/${p.planPath}`;
                  return (
                    <li key={p.id} className="mdcc-roadmap-item">
                      <a
                        className="mdcc-roadmap-row"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span
                          className="mdcc-roadmap-glyph"
                          role="img"
                          aria-label={STATUS_ARIA[p.status]}
                        >
                          {STATUS_GLYPH[p.status]}
                        </span>
                        <span className="mdcc-roadmap-sku">
                          <SkuLabel>{skuFor(p)}</SkuLabel>
                        </span>
                        <span className="mdcc-roadmap-title">{p.title}</span>
                        <span className="mdcc-roadmap-meta" aria-hidden="true">
                          {rightMeta(p)}
                        </span>
                      </a>
                      {p.summary ? <p className="mdcc-roadmap-summary">{p.summary}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </section>
    </main>
  );
}
