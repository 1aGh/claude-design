'use client';

import { useEffect, useRef, useState } from 'react';

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel ?? 'Copy to clipboard'}
      data-copied={copied || undefined}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 1500);
          })
          .catch((err) => {
            console.error('[CopyButton] clipboard write failed', err);
          });
      }}
    >
      {copied ? 'COPIED' : children}
    </button>
  );
}
