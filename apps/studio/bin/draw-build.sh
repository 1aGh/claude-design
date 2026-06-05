#!/usr/bin/env bash
# draw-build.sh — run an agent-authored engine build script under Bun with the
# draw engine made importable via an injected env path. This is how the
# draw-agent "draws as code": it writes a tiny build script that constructs
# DrawPrimitives through the engine and emits the result (optimized SVG to a
# file, and/or the JSX string on stdout for inline embedding). Importing the
# engine by the injected absolute path is portable across every install layout
# (local dev tree, npm global, marketplace cache) — DDR-045 — without needing a
# bundler virtual specifier.
#
# Reached via `maude design draw-build` (DDR-062), never a raw bin path.
#
# Usage:
#   draw-build.sh --script <build.ts> [--out <asset.svg>]
#
# In the build script, import the engine via the injected env path and write
# output to the injected out path:
#   const E = await import(process.env.MAUDE_DRAW_ENGINE);
#   const prims = [ E.circle({ cx: 12, cy: 12, r: 10 }) ];
#   const svg = E.optimizeSvg(E.toSvg(prims, { viewBox: '0 0 24 24', a11y: { title: 'Mark' } }));
#   if (process.env.DRAW_OUT) await Bun.write(process.env.DRAW_OUT, svg);
#   console.log(E.toJsx(prims, { viewBox: '0 0 24 24' })); // inline form, if needed
#
# Stdout: the build script's stdout (e.g. the JSX form). Exit: the script's code.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT=""
OUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --script) SCRIPT="$2"; shift 2 ;;
    --out)    OUT="$2"; shift 2 ;;
    --help|-h) sed -n '2,20p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "draw-build.sh: unknown arg '$1' (try --help)" >&2; exit 2 ;;
  esac
done

[ -n "$SCRIPT" ] || { echo "draw-build.sh: --script <build.ts> required" >&2; exit 2; }
[ -f "$SCRIPT" ] || { echo "draw-build.sh: script not found: $SCRIPT" >&2; exit 1; }
command -v bun >/dev/null 2>&1 || { echo "draw-build.sh: bun is required (hard dependency)." >&2; exit 1; }

ENGINE="$SCRIPT_DIR/../draw/index.ts"
[ -f "$ENGINE" ] || { echo "draw-build.sh: engine not found at $ENGINE — reinstall maude." >&2; exit 1; }
ENGINE="$(cd "$(dirname "$ENGINE")" && pwd)/$(basename "$ENGINE")"

export MAUDE_DRAW_ENGINE="$ENGINE"
[ -n "$OUT" ] && export DRAW_OUT="$OUT"
exec bun run "$SCRIPT"
