// Where this cell's design project lives on disk.
//
// The last surviving function of `canvas/project.mjs`, which DDR-209 A′3
// deleted along with the rest of the hub's studio reimplementation. It is kept
// because it is NOT a reimplementation of anything the studio owns: the hub
// needs the design root for its OWN lanes — the asset sweep, the autosave
// projection, the git checkpoint, the "is there a project here yet" probe. The
// studio resolves its own paths independently, from its own config, and the two
// answering the same question about the same disk is a coincidence of layout,
// not a duplicated implementation.

import { join } from 'node:path';

export function designRootFor(env = process.env) {
  const repoDir = env.MAUDE_REPO_DIR;
  if (!repoDir) return null;
  return join(repoDir, env.MAUDE_DESIGN_ROOT ?? '.design');
}
