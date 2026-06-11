/**
 * InspectorDiagram [MDCC-DGM/INS] — a stylized canvas iframe (browser chrome + dotted
 * stage + three mock artboards), one child element wearing an accent two-stroke halo,
 * with leader-line annotations explaining the Cmd+Click → _active.json → /design:edit
 * loop. The halo is two concentric strokes, never a box-shadow (DS rule). Server component.
 */
import { DiagramFrame } from './_frame';
import { Icon } from './_icons';

export function InspectorDiagram({
  caption = 'Cmd+Click an element → it persists to _active.json → the next /design:edit reads it',
  sku = 'MDCC-DGM/INS',
}: {
  caption?: string;
  sku?: string;
}) {
  return (
    <DiagramFrame sku={sku} name="InspectorDiagram" caption={caption}>
      <div className="mdcc-dgm-ins">
        <div className="mdcc-dgm-ins-browser">
          <div className="mdcc-dgm-ins-chrome">
            <span className="mdcc-dgm-ins-dot" />
            <span className="mdcc-dgm-ins-dot" />
            <span className="mdcc-dgm-ins-dot" />
            <span className="mdcc-dgm-ins-url">
              <Icon name="server" size={11} /> localhost:4711
            </span>
          </div>
          <div className="mdcc-dgm-ins-stage">
            <div className="mdcc-dgm-ins-art">
              A · hero
              <div className="mdcc-dgm-ins-skel" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="mdcc-dgm-ins-art is-target">
              B · pricing
              <span className="mdcc-dgm-ins-el">
                <span className="mdcc-dgm-ins-halo" aria-hidden="true" />
                <span className="mdcc-dgm-ins-halo-ring" aria-hidden="true" />
                plan card
              </span>
            </div>
            <div className="mdcc-dgm-ins-art">
              C · footer
              <div className="mdcc-dgm-ins-skel" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
        <ul className="mdcc-dgm-ins-notes">
          <li>
            <span className="mdcc-dgm-ins-tick" aria-hidden="true" />
            <Icon name="pointer" size={12} className="mdcc-dgm-accent" />{' '}
            <span className="mdcc-dgm-mono">Cmd+Click</span> the element
          </li>
          <li>
            <span className="mdcc-dgm-ins-tick" aria-hidden="true" />
            <Icon name="push" size={12} /> selection persists to{' '}
            <span className="mdcc-dgm-mono">_active.json</span>
          </li>
          <li>
            <span className="mdcc-dgm-ins-tick" aria-hidden="true" />
            <Icon name="terminal" size={12} /> <span className="mdcc-dgm-mono">/design:edit</span>{' '}
            reads from here
          </li>
        </ul>
      </div>
    </DiagramFrame>
  );
}
