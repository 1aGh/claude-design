/**
 * FileTree [MDCC-DGM/FT] — a pre-formatted ASCII folder tree in mono inside a hairline
 * frame; rows flagged `highlight` get a faint accent tint + left border, with a
 * right-aligned muted hint. Server component. Pass a `variant` key or explicit `rows`.
 */
import { FILE_TREES, type FileRow, type FileTreeVariant } from '@/lib/diagram-data';
import { DiagramFrame } from './_frame';

const CAPTIONS: Record<FileTreeVariant, string> = {
  '.ai/': 'The .ai/ skeleton maude init writes — one highlighted file is the one you touch',
  'cli-subcommands': 'The maude CLI surface — five subcommands',
};

export function FileTree({
  variant,
  rows,
  caption,
  sku = 'MDCC-DGM/FT',
}: {
  variant?: FileTreeVariant;
  rows?: FileRow[];
  caption?: string;
  sku?: string;
}) {
  const data = rows ?? (variant ? FILE_TREES[variant] : FILE_TREES['.ai/']);
  const resolvedCaption = caption ?? (variant ? CAPTIONS[variant] : 'A file tree');

  return (
    <DiagramFrame sku={sku} name="FileTree" caption={resolvedCaption}>
      <div className="mdcc-dgm-ft">
        {data.map((r) => (
          <div
            key={r.label}
            className={`mdcc-dgm-ft-row${r.highlight === 'add' ? ' is-add' : ''}${r.depth === 0 ? ' is-root' : ''}`}
            style={{ paddingLeft: `calc(var(--space-3) + ${r.depth} * var(--space-6))` }}
          >
            <span className="mdcc-dgm-ft-name">
              {r.glyph ? (
                <span className="mdcc-dgm-ft-glyph" aria-hidden="true">
                  {r.glyph}
                </span>
              ) : null}
              <span className="mdcc-dgm-ft-label">{r.label}</span>
            </span>
            {r.hint ? <span className="mdcc-dgm-ft-hint">{r.hint}</span> : null}
          </div>
        ))}
      </div>
    </DiagramFrame>
  );
}
