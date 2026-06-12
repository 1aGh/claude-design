/**
 * CommandFlow [MDCC-DGM/FLW] — a horizontal numbered step strip. Server component.
 * Default steps = INSTALL_STEPS (getting-started); pass `steps` for other flows.
 */
import { FLOW_STEPS, type FlowStep, type FlowStepVariant } from '@/lib/diagram-data';
import { DiagramFrame } from './_frame';
import { Icon } from './_icons';

export function CommandFlow({
  variant = 'install',
  steps,
  caption = 'Four steps from a fresh repo to the first feature cycle',
  sku = 'MDCC-DGM/FLW',
}: {
  /** Picks a step set from diagram-data — keeps .mdx free of JS imports. */
  variant?: FlowStepVariant;
  /** Explicit override (takes precedence over `variant`). */
  steps?: FlowStep[];
  caption?: string;
  sku?: string;
}) {
  const resolved = steps ?? FLOW_STEPS[variant];
  return (
    <DiagramFrame sku={sku} name="CommandFlow" caption={caption}>
      <div className="mdcc-dgm-flow">
        {resolved.map((s, i) => (
          <div key={s.command} style={{ display: 'contents' }}>
            <div className={`mdcc-dgm-flow-cell${i === resolved.length - 1 ? ' is-last' : ''}`}>
              <span className="mdcc-dgm-flow-num">{s.n}</span>
              <span className="mdcc-dgm-flow-cmd">{s.command}</span>
              <span className="mdcc-dgm-flow-cap">{s.caption}</span>
            </div>
            {i < resolved.length - 1 ? (
              <span className="mdcc-dgm-flow-conn" aria-hidden="true">
                <Icon name="arrow-right" size={15} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </DiagramFrame>
  );
}
