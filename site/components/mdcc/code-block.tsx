'use client';

import { type HTMLAttributes, useEffect, useRef, useState } from 'react';

type PreProps = HTMLAttributes<HTMLPreElement> & {
  // rehype-pretty-code conventions (optional — may not be present today)
  'data-filename'?: string;
  'data-language'?: string;
};

export function CodeBlock({
  children,
  className,
  'data-filename': filename,
  'data-language': language,
  ...rest
}: PreProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const label = filename ?? language ?? 'snippet';

  return (
    <figure className={['mdcc-code', className].filter(Boolean).join(' ')}>
      <div className="mdcc-code-head">
        <span className="mdcc-code-filename">{label}</span>
        <button
          type="button"
          className="mdcc-code-copy"
          aria-label={`Copy ${label}`}
          data-copied={copied || undefined}
          onClick={() => {
            const text = preRef.current?.textContent ?? '';
            if (!text) return;
            navigator.clipboard
              .writeText(text)
              .then(() => {
                setCopied(true);
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => setCopied(false), 1500);
              })
              .catch((err) => {
                console.error('[CodeBlock] clipboard write failed', err);
              });
          }}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre
        ref={preRef}
        className="mdcc-code-body"
        data-filename={filename}
        data-language={language}
        {...rest}
      >
        {children}
      </pre>
    </figure>
  );
}
