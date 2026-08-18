// Two modes, no hybrid — DDR-228.
//
// What is pinned here is mostly the SAFETY of the transitions rather than
// their mechanics: a mode switch runs against whatever state a person's tree
// happens to be in, so the properties that matter are "nothing on disk moved",
// "nothing unrelated got staged", and "the reverse puts it back".

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import {
  adoptToHub,
  applyOwnershipBlock,
  buildOwnershipBlock,
  detachToRepo,
  isGitRepo,
  isHubOwned,
  ownershipState,
  removeOwnershipBlock,
  stignoreLineFor,
  syncthingFolderRoot,
  trackedDesignPaths,
} from './design-ownership.mjs';

const made = [];
after(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const gitOk = gitAvailable();

/** A real repo with a committed `.design/` — the Mode-A starting point. */
function repoWithDesign() {
  const root = mkdtempSync(join(tmpdir(), 'ownership-'));
  made.push(root);
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 't@t.test');
  git('config', 'user.name', 'T');
  mkdirSync(join(root, '.design/system/ds'), { recursive: true });
  writeFileSync(join(root, '.design/config.json'), '{}');
  writeFileSync(join(root, '.design/system/ds/brand.css'), ':root{}');
  writeFileSync(join(root, 'README.md'), '# repo');
  git('add', '-A');
  git('commit', '-qm', 'seed');
  return root;
}

describe('the ignore block', () => {
  it('is one rule, and it is idempotent', () => {
    const first = applyOwnershipBlock('', '.design');
    assert.equal(first.action, 'added');
    assert.ok(isHubOwned(first.contents));
    assert.match(first.contents, /^\/\.design\/$/m);

    const second = applyOwnershipBlock(first.contents, '.design');
    assert.equal(second.action, 'updated');
    assert.equal(second.contents.match(/maude:hub-owned:begin/g).length, 1);
  });

  it('goes at the END — gitignore is last-match-wins', () => {
    const existing = 'node_modules/\n!.design/keep-me\n';
    const { contents } = applyOwnershipBlock(existing, '.design');
    assert.ok(
      contents.indexOf('/.design/') > contents.indexOf('!.design/keep-me'),
      'a rule that has to hold cannot sit above one that re-includes the path'
    );
  });

  it('removes cleanly, leaving the rest of the file alone', () => {
    const existing = 'node_modules/\ndist/\n';
    const { contents: withBlock } = applyOwnershipBlock(existing, '.design');
    const { contents: back, action } = removeOwnershipBlock(withBlock);
    assert.equal(action, 'removed');
    assert.ok(!isHubOwned(back));
    assert.match(back, /node_modules\//);
    assert.match(back, /dist\//);
  });

  it('removing when absent is not an error', () => {
    assert.equal(removeOwnershipBlock('node_modules/\n').action, 'absent');
  });

  it('honours a non-default design root', () => {
    assert.match(buildOwnershipBlock('design'), /^\/design\/$/m);
  });
});

describe('adopt — A to B', { skip: gitOk ? false : 'git not available' }, () => {
  it('untracks the folder and leaves every byte on disk', () => {
    const root = repoWithDesign();
    assert.equal(trackedDesignPaths(root).length, 2);

    const res = adoptToHub(root);
    assert.equal(res.untracked, 2);

    // THE safety property: `--cached` touches the index, never the tree.
    assert.equal(readFileSync(join(root, '.design/system/ds/brand.css'), 'utf8'), ':root{}');
    assert.equal(existsSync(join(root, '.design/config.json')), true);
    assert.equal(trackedDesignPaths(root).length, 0);
    assert.ok(isHubOwned(readFileSync(join(root, '.gitignore'), 'utf8')));
  });

  it('stages the removals and .gitignore — and nothing else', () => {
    const root = repoWithDesign();
    // An unrelated edit, dirty in the tree exactly as a real person's would be.
    writeFileSync(join(root, 'README.md'), '# repo, mid-edit');
    writeFileSync(join(root, 'notes.txt'), 'scratch');

    adoptToHub(root);

    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .sort();
    assert.deepEqual(staged, ['.design/config.json', '.design/system/ds/brand.css', '.gitignore']);
    // Their work is untouched, staged or otherwise.
    assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), '# repo, mid-edit');
    assert.equal(existsSync(join(root, 'notes.txt')), true);
  });

  it('is safe to run twice', () => {
    const root = repoWithDesign();
    adoptToHub(root);
    const again = adoptToHub(root);
    assert.equal(again.untracked, 0);
    assert.equal(
      readFileSync(join(root, '.gitignore'), 'utf8').match(/maude:hub-owned:begin/g).length,
      1
    );
  });

  it('--dry-run says what it would do and does none of it', () => {
    const root = repoWithDesign();
    const res = adoptToHub(root, { dryRun: true });
    assert.equal(res.untracked, 2);
    assert.equal(existsSync(join(root, '.gitignore')), false);
    assert.equal(trackedDesignPaths(root).length, 2);
  });
});

describe('detach — B back to A', { skip: gitOk ? false : 'git not available' }, () => {
  it('un-ignores the folder and leaves committing to the person', () => {
    const root = repoWithDesign();
    adoptToHub(root);
    execFileSync('git', ['commit', '-qm', 'adopt'], { cwd: root, stdio: 'ignore' });

    const res = detachToRepo(root);
    assert.equal(res.action, 'removed');
    assert.ok(!isHubOwned(readFileSync(join(root, '.gitignore'), 'utf8')));

    // Not committed, and not even staged — theirs to decide. But git can SEE
    // them again, which is the whole point of the transition.
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.match(untracked, /\.design\/system\/ds\/brand\.css/);
  });

  it('round-trips: adopt then detach restores what git can see', () => {
    const root = repoWithDesign();
    const before = trackedDesignPaths(root).sort();
    adoptToHub(root);
    execFileSync('git', ['commit', '-qm', 'adopt'], { cwd: root, stdio: 'ignore' });
    detachToRepo(root);
    execFileSync('git', ['add', '--', '.design'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['commit', '-qm', 'detach'], { cwd: root, stdio: 'ignore' });
    assert.deepEqual(trackedDesignPaths(root).sort(), before);
  });
});

describe('the hybrid is a NAMED state, not an accident', { skip: gitOk ? false : 'no git' }, () => {
  it('linked + still tracked reads as hybrid', () => {
    const root = repoWithDesign();
    const st = ownershipState(root, { linked: true });
    assert.equal(st.mode, 'hybrid');
    assert.equal(st.ignored, false);
    assert.equal(st.trackedCount, 2);
  });

  it('linked + ignored + untracked reads as hub-owned', () => {
    const root = repoWithDesign();
    adoptToHub(root);
    assert.equal(ownershipState(root, { linked: true }).mode, 'hub-owned');
  });

  it('unlinked is repo-owned whatever the gitignore says', () => {
    const root = repoWithDesign();
    assert.equal(ownershipState(root, { linked: false }).mode, 'repo-owned');
  });
});

describe('Syncthing rides a lane gitignore cannot close', () => {
  it('finds the managed folder root from a nested repo', () => {
    const st = mkdtempSync(join(tmpdir(), 'stfolder-'));
    made.push(st);
    mkdirSync(join(st, '.stfolder'), { recursive: true });
    mkdirSync(join(st, 'personal/maude'), { recursive: true });
    assert.equal(syncthingFolderRoot(join(st, 'personal/maude')), st);
  });

  it('is null outside one', () => {
    const plain = mkdtempSync(join(tmpdir(), 'plain-'));
    made.push(plain);
    assert.equal(syncthingFolderRoot(plain), null);
  });

  it('names the .stignore line relative to the managed root', () => {
    assert.equal(
      stignoreLineFor('/tree/personal/maude', '.design', '/tree'),
      '/personal/maude/.design'
    );
  });
});

describe('no git repo — the question does not arise', () => {
  it('reads as hub-owned when linked, and every transition is a no-op', () => {
    const plain = mkdtempSync(join(tmpdir(), 'nogit-'));
    made.push(plain);
    mkdirSync(join(plain, '.design'), { recursive: true });
    writeFileSync(join(plain, '.design/config.json'), '{}');

    assert.equal(isGitRepo(plain), false);
    assert.equal(ownershipState(plain, { linked: true }).mode, 'hub-owned');
    assert.equal(adoptToHub(plain).action, 'no-git');
    assert.equal(detachToRepo(plain).action, 'no-git');
    // And nothing was written — Maude does not require git, so it does not
    // start leaving gitignores in projects that have no repo.
    assert.equal(existsSync(join(plain, '.gitignore')), false);
  });
});
