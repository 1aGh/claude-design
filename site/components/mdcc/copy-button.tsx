'use client';

import { useState } from 'react';

export function CopyButton({
  text,
  className = 'mdcc-install-copy',
  children = 'COPY',
  ariaLabel,
}: {
  text: string;
  className?: string;
  children?: React.ReactNode;
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel ?? 'Copy to clipboard'}
      data-copied={copied || undefined}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? 'COPIED' : children}
    </button>
  );
}
