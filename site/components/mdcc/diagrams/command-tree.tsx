/**
 * CommandTree [MDCC-DGM/TR] — a stylized ASCII command tree grouped by category, every
 * leaf a link to its command-reference page. Renders straight from COMMAND_CATALOG via
 * groupByCategory — the SAME source build-command-reference.mjs uses for the sidebar, so
 * the tree can never drift from the generated pages (phase-17 Risk #1). Server component.
 */
import { COMMAND_CATALOG, groupByCategory, type PluginSlug } from '@/lib/diagram-data';
import { DiagramFrame } from './_frame';
import { Icon } from './_icons';

export function CommandTree({
  plugin,
  caption,
  sku = 'MDCC-DGM/TR',
}: {
  plugin: PluginSlug;
  caption?: string;
  sku?: string;
}) {
  const entry = COMMAND_CATALOG.find((p) => p.slug === plugin);
  if (!entry) return null;
  const groups = groupByCategory(entry);
  const total = entry.commands.length;
  const resolvedCaption = caption ?? `The ${entry.prefix} catalog — ${total} commands by group`;

  return (
    <DiagramFrame sku={sku} name="CommandTree" caption={resolvedCaption}>
      <div className="mdcc-dgm-tree">
        <div className="mdcc-dgm-tree-root">
          <Icon name="braces" size={13} className="mdcc-dgm-accent" />
          <span className="mdcc-dgm-mono">{entry.prefix}</span>
        </div>
        <div className="mdcc-dgm-tree-list">
          {groups.map((group) => (
            <div key={group.category} style={{ display: 'contents' }}>
              <div className="mdcc-dgm-tree-group">
                <span className="mdcc-dgm-tree-group-label">{group.label}.</span>
                {group.note ? <span className="mdcc-dgm-tree-group-note">{group.note}</span> : null}
              </div>
              {group.commands.map((name, i) => (
                <a
                  key={name}
                  className="mdcc-dgm-tree-leaf"
                  href={`/docs/commands-${plugin}/${name}`}
                >
                  <span className="mdcc-dgm-tree-glyph" aria-hidden="true">
                    {i === group.commands.length - 1 ? '└─' : '├─'}
                  </span>
                  <span>{name}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="mdcc-dgm-tree-foot">
          <span className="mdcc-dgm-mono">{total}</span> commands · grouped in{' '}
          <span className="mdcc-dgm-mono">CATEGORIES.md</span>
        </div>
      </div>
    </DiagramFrame>
  );
}
