#!/usr/bin/env bun
// _svg-optimize.mjs — internal shim behind `maude design svg-optimize` (DDR-062).
// Runs under Bun so it can import the `.ts` engine module directly. Reads an SVG
// from a file argument or stdin, runs it through draw/optimize.ts (SVGO multipass
// + the parse/validity gate), and writes the optimized SVG to stdout. Exits 1
// when the input is not valid SVG — the gate doubling as a lint.
//
// Internal (underscore-prefixed, CI/agent-only) — not on the DDR-062 whitelist;
// reached only via the `svg-optimize.sh` wrapper, which IS dispatched by
// `maude design svg-optimize`.

import { optimizeSvg } from '../draw/optimize.ts';

const args = process.argv.slice(2);
let precision = 2;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--precision') {
    precision = Number(args[i + 1]);
    i += 1;
  } else {
    files.push(args[i]);
  }
}

const fromFile = files.length > 0 && files[0] !== '-';
const input = fromFile ? await Bun.file(files[0]).text() : await Bun.stdin.text();

try {
  const out = optimizeSvg(input, { floatPrecision: precision });
  process.stdout.write(`${out}\n`);
} catch (err) {
  process.stderr.write(`svg-optimize: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
