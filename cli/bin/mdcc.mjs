#!/usr/bin/env node
// mdcc — legacy alias for `maude`. Prints deprecation warning, forwards args.
// Will be removed in v0.17.x. Use `maude` directly.
process.stderr.write(
  'mdcc: ⚠ `mdcc` is deprecated. Use `maude` instead. This alias will be removed in v0.17.x.\n'
);
await import('./maude.mjs');
