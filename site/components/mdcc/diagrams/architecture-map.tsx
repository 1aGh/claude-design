/**
 * ArchitectureMap [MDCC-DGM/MAP] — the maude system map: the Claude Code host shell
 * containing /plugin design + /plugin flow, the maude CLI badge, and the .ai/ + .design/
 * workspace cards, with accent ownership arrows. Server component.
 */
import { DiagramFrame } from './_frame';
import { Icon } from './_icons';

const AI_FILES = [
  { glyph: '├─', label: 'state/STATE.md' },
  { glyph: '├─', label: 'plans/' },
  { glyph: '├─', label: 'decisions/' },
  { glyph: '└─', label: 'workflows.config.json' },
];
const DESIGN_FILES = [
  { glyph: '├─', label: 'config.json' },
  { glyph: '├─', label: 'ui/' },
  { glyph: '├─', label: 'system/' },
  { glyph: '└─', label: '_history/' },
];

export function ArchitectureMap({
  caption = 'Claude Code · two plugins · the maude CLI · the .ai/ and .design/ workspaces',
  sku = 'MDCC-DGM/MAP',
}: {
  caption?: string;
  sku?: string;
}) {
  return (
    <DiagramFrame sku={sku} name="ArchitectureMap" caption={caption}>
      <div className="mdcc-dgm-am">
        {/* SVG arrow layer — stretches with the container (preserveAspectRatio=none).
            Endpoints approximate the flex-laid boxes; hidden on mobile (stacked). */}
        <svg
          className="mdcc-dgm-am-wires"
          viewBox="0 0 856 456"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="dgm-am-accent"
              markerWidth="9"
              markerHeight="9"
              refX="6"
              refY="4.5"
              orient="auto"
            >
              <path
                d="M1 1.5 6.5 4.5 1 7.5"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          </defs>
          <path
            className="mdcc-dgm-am-arc"
            d="M150 150 C 150 250 706 250 706 312"
            markerEnd="url(#dgm-am-accent)"
          />
          <path
            className="mdcc-dgm-am-arc"
            d="M414 150 C 414 250 150 250 150 312"
            markerEnd="url(#dgm-am-accent)"
          />
        </svg>

        <div className="mdcc-dgm-am-shell">
          <div className="mdcc-dgm-am-shell-hd">
            <Icon name="sparkle" size={13} className="mdcc-dgm-am-shell-glyph" />
            <span className="mdcc-dgm-am-shell-name">Claude Code</span>
            <span className="mdcc-dgm-am-shell-sub">host shell · plugin marketplace</span>
          </div>
          <div className="mdcc-dgm-am-tiles">
            <div className="mdcc-dgm-am-tile">
              <div className="mdcc-dgm-am-tile-hd">
                <Icon name="cube" size={13} />
                <span>/plugin design</span>
              </div>
              <div className="mdcc-dgm-am-tile-sku">MAUDE/PLG·DSN</div>
              <div className="mdcc-dgm-am-tile-note">canvas-first TSX mocks</div>
            </div>
            <div className="mdcc-dgm-am-tile">
              <div className="mdcc-dgm-am-tile-hd">
                <Icon name="workflow" size={13} />
                <span>/plugin flow</span>
              </div>
              <div className="mdcc-dgm-am-tile-sku">MAUDE/PLG·FLW</div>
              <div className="mdcc-dgm-am-tile-note">agentic .ai/ workspace loop</div>
            </div>
            <div className="mdcc-dgm-am-cli">
              <Icon name="terminal" size={14} className="mdcc-dgm-am-cli-glyph" />
              <span className="mdcc-dgm-am-cli-name">maude</span>
              <span className="mdcc-dgm-am-cli-sub">CLI · @1agh/maude</span>
            </div>
          </div>
        </div>

        <div className="mdcc-dgm-am-cards">
          <div className="mdcc-dgm-am-card" data-owner="flow">
            <div className="mdcc-dgm-am-card-hd">
              <Icon name="folder" size={13} />
              <span className="mdcc-dgm-mono">.ai/</span>
              <span className="mdcc-dgm-am-card-owner">owned by flow</span>
            </div>
            <ul className="mdcc-dgm-am-tree">
              {AI_FILES.map((f) => (
                <li key={f.label}>
                  <span className="mdcc-dgm-am-glyph">{f.glyph}</span>
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mdcc-dgm-am-card" data-owner="design">
            <div className="mdcc-dgm-am-card-hd">
              <Icon name="folder" size={13} />
              <span className="mdcc-dgm-mono">.design/</span>
              <span className="mdcc-dgm-am-card-owner">owned by design</span>
            </div>
            <ul className="mdcc-dgm-am-tree">
              {DESIGN_FILES.map((f) => (
                <li key={f.label}>
                  <span className="mdcc-dgm-am-glyph">{f.glyph}</span>
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}
