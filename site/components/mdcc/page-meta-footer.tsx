export function PageMetaFooter({
  editUrl,
  sku,
  updated,
}: {
  editUrl?: string;
  sku?: string;
  updated?: string;
}) {
  return (
    <footer className="mdcc-page-meta">
      <dl className="mdcc-page-meta-dl">
        <div>
          <dt>Edit</dt>
          <dd>
            {editUrl ? (
              <a href={editUrl} target="_blank" rel="noopener noreferrer">
                edit on github ↗
              </a>
            ) : (
              <span>--</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{updated ?? '--'}</dd>
        </div>
        <div>
          <dt>Page SKU</dt>
          <dd>{sku ?? '--'}</dd>
        </div>
      </dl>
    </footer>
  );
}
