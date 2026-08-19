// Ambient React augmentations for markup this codebase genuinely emits but
// @types/react does not model.
//
// `xmlns` on an HTML element. Inside `<foreignObject>` the child div MUST carry
// the XHTML namespace, or the serialized `.annotations.svg` (the VERSIONED
// artifact, per DDR-115) is not valid SVG and a standalone viewer drops the
// sticky body. React passes the attribute straight through to the DOM; only the
// type is missing. Declared once here rather than cast at each call site, so a
// third foreignObject child does not re-invent the workaround.

import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    xmlns?: string;
  }
}
