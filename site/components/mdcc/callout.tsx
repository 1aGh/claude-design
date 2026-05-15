import type { ReactNode } from 'react';

export type CalloutType = 'note' | 'warn' | 'danger' | 'tip';

const GLYPH: Record<CalloutType, string> = {
  note: '?',
  warn: '!',
  danger: '▲',
  tip: '★',
};

const LABEL: Record<CalloutType, string> = {
  note: 'Note',
  warn: 'Warning',
  danger: 'Danger',
  tip: 'Tip',
};

export function Callout({
  type = 'note',
  children,
  title,
}: {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="mdcc-callout" data-type={type} role="note" aria-label={LABEL[type]}>
      <span className="mdcc-callout-glyph" aria-hidden="true">
        {GLYPH[type]}
      </span>
      <div className="mdcc-callout-body">
        {title ? <strong className="block mb-1">{title}</strong> : null}
        {children}
      </div>
    </aside>
  );
}
