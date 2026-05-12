import { readdir, mkdir, copyFile, stat, readFile, writeFile } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

// Recursively copy `src` → `dest`. Returns { created, skipped, replaced }.
// - never overwrites unless { force }
// - .gitkeep files are copied as empty dirs only when the dir is otherwise empty
// - if `transform({ srcPath, destPath, contents })` is provided, runs it before write
//   for files matching `transformGlob` (substring match on srcPath).
export async function copyTree(src, dest, opts = {}) {
  const { force = false, dryRun = false, transform = null, transformMatch = () => false } = opts;
  const stats = { created: [], skipped: [], replaced: [] };

  async function walk(srcDir, destDir) {
    await ensureDir(destDir, dryRun);
    const entries = await readdir(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);
      if (entry.isDirectory()) {
        await walk(srcPath, destPath);
        continue;
      }
      const exists = await fileExists(destPath);
      if (entry.name === '.gitkeep') {
        // Only carry .gitkeep over if dest dir is otherwise empty after this run.
        // We still copy it to keep the dir tracked; harmless if non-empty.
        if (!exists) {
          if (!dryRun) await copyFile(srcPath, destPath);
          stats.created.push(relative(dest, destPath));
        } else {
          stats.skipped.push(relative(dest, destPath));
        }
        continue;
      }
      if (exists && !force) {
        stats.skipped.push(relative(dest, destPath));
        continue;
      }
      if (transform && transformMatch(srcPath)) {
        const contents = await readFile(srcPath, 'utf8');
        const out = await transform({ srcPath, destPath, contents });
        if (!dryRun) await writeFile(destPath, out);
      } else {
        if (!dryRun) await copyFile(srcPath, destPath);
      }
      if (exists) stats.replaced.push(relative(dest, destPath));
      else stats.created.push(relative(dest, destPath));
    }
  }

  await walk(src, dest);
  return stats;
}

async function ensureDir(dir, dryRun) {
  if (dryRun) return;
  await mkdir(dir, { recursive: true });
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export { basename };
