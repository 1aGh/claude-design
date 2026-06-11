/**
 * StatPanel [MDCC-DGM/STT] — a horizontal stat strip with hairline dividers. Big mono
 * number + label + optional hint per cell. Data-agnostic; defaults to CATALOG_STATS
 * (commands number-driven from build-stats). Server component.
 */
import { CATALOG_STATS, type StatCell } from '@/lib/diagram-data';
import { DiagramFrame } from './_frame';

export function StatPanel({
  cells = CATALOG_STATS,
  caption = 'The catalog at a glance — number-driven from build-stats',
  sku = 'MDCC-DGM/STT',
}: {
  cells?: StatCell[];
  caption?: string;
  sku?: string;
}) {
  return (
    <DiagramFrame
      sku={sku}
      name="StatPanel"
      caption={caption}
      dense
      bodyClassName="mdcc-dgm-stat-body"
    >
      <div
        className="mdcc-dgm-stat"
        style={{ ['--mdcc-dgm-stat-cols' as string]: String(cells.length) }}
      >
        {cells.map((c) => (
          <div key={c.label} className="mdcc-dgm-stat-cell">
            <span className="mdcc-dgm-stat-val">{c.value}</span>
            <span className="mdcc-dgm-stat-label">{c.label}</span>
            {c.hint ? <span className="mdcc-dgm-stat-hint">{c.hint}</span> : null}
          </div>
        ))}
      </div>
    </DiagramFrame>
  );
}
