/**
 * FlowLoop — the /flow:* lifecycle infographic, embedded inline in
 * /docs/flow as Figure 1. Ported verbatim (pixels, not re-derived) from
 * .design/ui/Studio Docs.tsx → FlowLoopDiagram (board F), maude DS.
 *
 * Dependency-free server component: no canvas-lib, no client hooks. Icons are
 * inlined thin-stroke (1.4) line glyphs. Styling lives in global.css under
 * the .mdcc-fl-* / .mdcc-ai-band / .mdcc-fig namespace (mirrors the .sd-* spec).
 */

type Cmd = { name: string; daily?: boolean };
type Phase = { n: string; name: string; accent?: boolean; produces: string; cmds: Cmd[] };

const PHASES: Phase[] = [
  {
    n: '00',
    name: 'Setup',
    produces: '.ai/ workspace + PRD',
    cmds: [{ name: 'init' }, { name: 'setup-prd' }, { name: 'setup-context' }],
  },
  {
    n: '01',
    name: 'Plan',
    produces: 'plan-NNN.md',
    cmds: [
      { name: 'plan', daily: true },
      { name: 'status', daily: true },
    ],
  },
  {
    n: '02',
    name: 'Execute',
    accent: true,
    produces: 'working code',
    cmds: [{ name: 'execute', daily: true }, { name: 'quick', daily: true }, { name: 'bug-fix' }],
  },
  {
    n: '03',
    name: 'Validate',
    produces: 'green gates',
    cmds: [
      { name: 'validate', daily: true },
      { name: 'review-code' },
      { name: 'scenario', daily: true },
    ],
  },
  {
    n: '04',
    name: 'Done',
    produces: 'commit · PR · retro',
    cmds: [{ name: 'done', daily: true }, { name: 'record-ddr' }, { name: 'record-retro' }],
  },
  {
    n: '05',
    name: 'Release',
    produces: 'tagged vX.Y.Z',
    cmds: [
      { name: 'release', daily: true },
      { name: 'release-changelog' },
      { name: 'maintain-clean' },
    ],
  },
];

type IconName = 'arrow-right' | 'arrow-left' | 'loop' | 'workflow' | 'braces';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  'arrow-right': (
    <>
      <line x1="3" y1="8" x2="12.5" y2="8" />
      <polyline points="9 4.5 12.5 8 9 11.5" />
    </>
  ),
  'arrow-left': (
    <>
      <line x1="13" y1="8" x2="3.5" y2="8" />
      <polyline points="7 4.5 3.5 8 7 11.5" />
    </>
  ),
  loop: (
    <>
      <path d="M3 8a5 5 0 0 1 8.6-3.5L13 6" />
      <polyline points="13 2.5 13 6 9.5 6" />
      <path d="M13 8a5 5 0 0 1-8.6 3.5L3 10" />
      <polyline points="3 13.5 3 10 6.5 10" />
    </>
  ),
  workflow: (
    <>
      <rect x="2.5" y="2.5" width="4" height="4" rx="1" />
      <rect x="9.5" y="9.5" width="4" height="4" rx="1" />
      <path d="M6.5 4.5h3a2 2 0 0 1 2 2v3" />
    </>
  ),
  braces: (
    <>
      <path d="M6 2.5C4.5 2.5 4.5 5 4.5 6S3 8 3 8s1.5 1 1.5 2 0 3.5 1.5 3.5" />
      <path d="M10 2.5C11.5 2.5 11.5 5 11.5 6S13 8 13 8s-1.5 1-1.5 2 0 3.5-1.5 3.5" />
    </>
  ),
};

function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export function FlowLoop() {
  return (
    <figure className="mdcc-fig">
      <figcaption className="mdcc-fig-label">
        <Icon name="workflow" size={12} /> Figure 1 · the <code>/flow:*</code> lifecycle
      </figcaption>
      <div className="mdcc-fl-diagram">
        <div className="mdcc-fl">
          {PHASES.map((p, i) => (
            <div key={p.name} style={{ display: 'contents' }}>
              <div className={`mdcc-fl-phase${p.accent ? ' is-accent' : ''}`}>
                <div className="mdcc-fl-card">
                  <span className="mdcc-fl-num" aria-hidden="true">
                    {p.n}
                  </span>
                  <div className="mdcc-fl-name">{p.name}</div>
                  <div className="mdcc-fl-cmds">
                    {p.cmds.map((c) => (
                      <div key={c.name} className={`mdcc-fl-cmd${c.daily ? ' is-daily' : ''}`}>
                        <span className="mdcc-fl-dot" aria-hidden="true" />
                        <span>{c.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mdcc-fl-out">
                    <span className="mdcc-fl-out-arrow">
                      <Icon name="arrow-right" size={12} />
                    </span>
                    <span>{p.produces}</span>
                  </div>
                </div>
              </div>
              {i < PHASES.length - 1 ? (
                <span className="mdcc-fl-conn" aria-hidden="true">
                  <Icon name="arrow-right" size={15} />
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mdcc-fl-return" aria-hidden="true">
          <span className="mdcc-fl-return-rail" />
          <span className="mdcc-fl-return-cap is-left">
            <Icon name="arrow-left" size={14} />
          </span>
          <span className="mdcc-fl-return-label">
            <Icon name="loop" size={13} /> ship it → next feature · the loop repeats
          </span>
          <span className="mdcc-fl-return-cap is-right">
            <span className="mdcc-fl-return-node" />
          </span>
        </div>
        <div className="mdcc-ai-band">
          <div className="mdcc-ai-band-lead">
            <span className="mdcc-ai-band-title">
              <code>.ai/</code> workspace
            </span>
            <span className="mdcc-ai-band-sub">
              everything the loop writes — nothing lives in a chat scroll
            </span>
          </div>
          <div className="mdcc-ai-chips">
            <span className="mdcc-ai-chip">decisions/DDR-*.md</span>
            <span className="mdcc-ai-chip">plans/archive/</span>
            <span className="mdcc-ai-chip">state/STATE.md</span>
            <span className="mdcc-ai-chip">logs/retro</span>
          </div>
        </div>
        <div className="mdcc-fl-legend">
          <span className="mdcc-legend-item">
            <span className="mdcc-legend-dot is-daily" aria-hidden="true" /> 11 daily verbs ·
            one-word terse
          </span>
          <span className="mdcc-legend-item">
            <span className="mdcc-legend-dot is-grouped" aria-hidden="true" /> 19 grouped ·
            group-verb prefix
          </span>
          <span className="mdcc-legend-item">
            <Icon name="braces" size={12} /> 30 commands · CATEGORIES.md
          </span>
        </div>
      </div>
    </figure>
  );
}
