import { runPreflight } from '../lib/preflight.mjs';

// `maude preflight --plugin <design|flow> [--json|--shell-export|--warn-only|--quiet] [--cache PATH]`
// Thin command over cli/lib/preflight.mjs. Plugin bin scripts + hooks call this
// instead of shelling to a relative `$PKG_ROOT/cli/lib/preflight.mjs` — in a
// marketplace install the plugin is copied alone (no sibling cli/), so the
// only reachable entry is the on-PATH `maude` binary. See DDR-061.

export async function run({ args, pkgRoot }) {
  return runPreflight({ args, pkgRoot });
}
