import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function run({ pkgRoot }) {
  const pkg = JSON.parse(await readFile(resolve(pkgRoot, 'package.json'), 'utf8'));
  process.stdout.write(`maude ${pkg.version} (${pkg.name})\n`);
}
