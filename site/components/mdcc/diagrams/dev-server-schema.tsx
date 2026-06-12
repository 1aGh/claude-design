/**
 * DevServerSchema [MDCC-DGM/SRV] — three side-by-side panels (_server.json · _active.json
 * · _history/<slug>/) listing real keys, plus a producer→consumer flow row. Replaces the
 * markdown table on design/index.mdx, so it carries a visually-hidden <table> with the
 * identical key/role structure for screen readers (phase-17 Task 10 a11y mandate). Server
 * component.
 */
import { DiagramFrame } from './_frame';
import type { DiagramIconName } from './_icons';
import { Icon } from './_icons';

type SchemaKey = { key: string; type: string };
type SchemaPanel = { file: string; icon: DiagramIconName; role: string; keys: SchemaKey[] };

const SCHEMA: SchemaPanel[] = [
  {
    file: '_server.json',
    icon: 'server',
    role: 'Written by the dev-server; read by the orchestrator to detect a live instance.',
    keys: [
      { key: 'pid', type: 'number' },
      { key: 'port', type: 'number' },
      { key: 'url', type: 'string' },
      { key: 'started', type: 'iso-8601' },
    ],
  },
  {
    file: '_active.json',
    icon: 'pointer',
    role: 'Pushed by the injected inspector; read by /design:edit to scope the next edit.',
    keys: [
      { key: 'active', type: 'path' },
      { key: 'open_tabs', type: 'path[]' },
      { key: 'selected', type: 'element | null' },
      { key: 'last_change', type: 'iso-8601' },
    ],
  },
  {
    file: '_history/<slug>/',
    icon: 'layers',
    role: 'Auto-snapshot stack per canvas; read by /design:rollback.',
    keys: [
      { key: '000-envelope.md', type: 'brief' },
      { key: 'NNN-screen-*.png', type: 'snapshot' },
      { key: 'chat.md', type: 'transcript' },
    ],
  },
];

const FLOW: { label: string; icon: DiagramIconName }[] = [
  { label: 'server writes', icon: 'server' },
  { label: 'inspector pushes', icon: 'push' },
  { label: 'rollback reads', icon: 'rewind' },
];

export function DevServerSchema({
  caption = 'Three files, one contract — the dev-server writes them, slash commands read them',
  sku = 'MDCC-DGM/SRV',
}: {
  caption?: string;
  sku?: string;
}) {
  return (
    <DiagramFrame sku={sku} name="DevServerSchema" caption={caption}>
      <div className="mdcc-dgm-schema">
        <div className="mdcc-dgm-schema-panels">
          {SCHEMA.map((p) => (
            <div key={p.file} className="mdcc-dgm-schema-panel">
              <div className="mdcc-dgm-schema-hd">
                <Icon name={p.icon} size={12} />
                <span className="mdcc-dgm-mono">{p.file}</span>
              </div>
              <div className="mdcc-dgm-schema-rows">
                {p.keys.map((k) => (
                  <div key={k.key} className="mdcc-dgm-schema-row">
                    <span className="mdcc-dgm-schema-key">{k.key}</span>
                    <span className="mdcc-dgm-schema-type">{k.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mdcc-dgm-schema-flow" aria-hidden="true">
          {FLOW.map((f, i) => (
            <div key={f.label} style={{ display: 'contents' }}>
              <span className="mdcc-dgm-schema-flow-step">
                <Icon name={f.icon} size={12} className={i === 0 ? 'mdcc-dgm-accent' : undefined} />
                {f.label}
              </span>
              {i < FLOW.length - 1 ? (
                <Icon name="arrow-right" size={13} className="mdcc-dgm-schema-flow-arrow" />
              ) : null}
            </div>
          ))}
        </div>

        {/* a11y: the table this diagram replaces, kept in the accessibility tree. */}
        <table className="mdcc-dgm-sr">
          <caption>Dev-server runtime files — keys and roles</caption>
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Keys</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            {SCHEMA.map((p) => (
              <tr key={p.file}>
                <th scope="row">{p.file}</th>
                <td>{p.keys.map((k) => `${k.key} (${k.type})`).join(', ')}</td>
                <td>{p.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DiagramFrame>
  );
}
