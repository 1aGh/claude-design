/**
 * LoopDiagram [MDCC-DGM/LP] — a closed cycle: N nodes on a circle with arrowed arcs,
 * one node carrying the accent "active" outline. Responsive — node positions and the
 * SVG arcs share a 0–100 coordinate space, so the whole diagram scales with its square
 * container. Server component. Default = the design canvas loop.
 */
import { DESIGN_LOOP, FLOW_LOOP, type LoopNode } from '@/lib/diagram-data';
import { DiagramFrame } from './_frame';
import { Icon } from './_icons';

const VARIANTS = {
  design: {
    nodes: DESIGN_LOOP,
    caption: 'The design canvas loop — edit is where you live; everything else bookends it',
    hubTitle: 'canvas loop',
    hubSub: '/design:*',
  },
  flow: {
    nodes: FLOW_LOOP,
    caption: 'The flow feature lifecycle — execute is the inner loop; done ships it',
    hubTitle: 'flow loop',
    hubSub: '/flow:*',
  },
} as const;

export function LoopDiagram({
  variant = 'design',
  nodes,
  caption,
  hubTitle,
  hubSub,
  sku = 'MDCC-DGM/LP',
}: {
  /** Picks a node set + hub labels — keeps .mdx free of JS imports. */
  variant?: keyof typeof VARIANTS;
  nodes?: LoopNode[];
  caption?: string;
  hubTitle?: string;
  hubSub?: string;
  sku?: string;
}) {
  const preset = VARIANTS[variant];
  const resolvedNodes = nodes ?? preset.nodes;
  const resolvedCaption = caption ?? preset.caption;
  const resolvedHubTitle = hubTitle ?? preset.hubTitle;
  const resolvedHubSub = hubSub ?? preset.hubSub;
  const n = resolvedNodes.length;
  const cx = 50;
  const cy = 50;
  const R = 37;
  const pts = resolvedNodes.map((_, i) => {
    const theta = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + R * Math.cos(theta), y: cy + R * Math.sin(theta) };
  });
  // Arrowed arcs i → (i+1)%n. Endpoints pulled in by `gap` so the line clears each
  // node card; control point nudged toward centre for a gentle inward curve.
  const gap = 13;
  const arcs = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sx = p.x + ux * gap;
    const sy = p.y + uy * gap;
    const ex = q.x - ux * gap;
    const ey = q.y - uy * gap;
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const cmx = mx + (cx - mx) * 0.16;
    const cmy = my + (cy - my) * 0.16;
    const closing = i === n - 1;
    return {
      id: `${resolvedNodes[i].command}-${resolvedNodes[(i + 1) % n].command}`,
      d: `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cmx.toFixed(1)} ${cmy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
      closing,
    };
  });

  return (
    <DiagramFrame
      sku={sku}
      name="LoopDiagram"
      caption={resolvedCaption}
      bodyClassName="mdcc-dgm-loop-body"
    >
      <div className="mdcc-dgm-loop">
        <svg
          className="mdcc-dgm-loop-wires"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="dgm-lp-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="6"
              refY="4.5"
              orient="auto"
            >
              <path
                d="M1 1.5 6.5 4.5 1 7.5"
                fill="none"
                stroke="var(--fg-2)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
            <marker
              id="dgm-lp-arrow-accent"
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
          {arcs.map((a) => (
            <path
              key={a.id}
              className={`mdcc-dgm-loop-arc${a.closing ? ' is-closing' : ''}`}
              d={a.d}
              markerEnd={a.closing ? 'url(#dgm-lp-arrow-accent)' : 'url(#dgm-lp-arrow)'}
            />
          ))}
        </svg>

        <div className="mdcc-dgm-loop-hub">
          <Icon name="loop" size={16} className="mdcc-dgm-accent" />
          <span className="mdcc-dgm-loop-hub-title">{resolvedHubTitle}</span>
          <span className="mdcc-dgm-loop-hub-sub">{resolvedHubSub}</span>
        </div>

        {resolvedNodes.map((node, i) => (
          <div
            key={node.command}
            className={`mdcc-dgm-loop-node${node.active ? ' is-active' : ''}`}
            style={{ left: `${pts[i].x}%`, top: `${pts[i].y}%` }}
          >
            <span className="mdcc-dgm-loop-node-cmd">{node.command}</span>
            <span className="mdcc-dgm-loop-node-cap">{node.caption}</span>
            {node.active ? <span className="mdcc-dgm-loop-node-flag">active</span> : null}
          </div>
        ))}
      </div>
    </DiagramFrame>
  );
}
