#!/usr/bin/env node
// write-sticker-manifests.mjs — one-shot: emit manifest.json for each pack
// under apps/studio/stickers/<pack-slug>/ (run AFTER build-stickers.mjs).
//
// Keywords for `life-style` and `opposing-thoughts` are derived straight from
// their (already-descriptive) source filenames. `figjam-doodle` (slice1..24)
// and `project-status` (Group NNN) shipped with non-descriptive filenames —
// their keywords below were assigned by visually reviewing a contact sheet of
// every rendered sticker (see scripts/build-stickers.mjs --contact-sheets).

import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../apps/studio/stickers', import.meta.url));

function titleCaseFromSlug(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Keywords straight from the filename slug (already descriptive packs). */
function keywordsFromSlug(slug) {
  const words = slug.split('-').filter(Boolean);
  return [...new Set([slug, ...words])];
}

// slice<N>.png — FigJam Doodle Stickers (CJ Xue). Visually reviewed.
const FIGJAM_DOODLE = {
  'slice1.png': ['yes', 'agree', 'happy'],
  'slice2.png': ['no', 'disagree', 'refuse'],
  'slice3.png': ['fair', 'ok', 'neutral'],
  'slice4.png': ['love', 'crush', 'admire', 'hearts'],
  'slice5.png': ['good-call', 'nice-one', 'agree'],
  'slice6.png': ['music', 'listening', 'headphones', 'focus'],
  'slice7.png': ['research', 'investigate'],
  'slice8.png': ['error', 'bug', 'broken', 'robot'],
  'slice9.png': ['better', 'improved'],
  'slice10.png': ['bad', 'thumbs-down'],
  'slice11.png': ['lovely', 'sweet'],
  'slice12.png': ['good', 'thumbs-up'],
  'slice13.png': ['deadline', 'due-date', 'urgent'],
  'slice14.png': ['confused', 'thinking', 'hmm'],
  'slice15.png': ['love', 'crush', 'admire'],
  'slice16.png': ['no-idea', 'stuck', 'blank'],
  'slice17.png': ['discuss', 'talk', 'meeting'],
  'slice18.png': ['group', 'team', 'together'],
  'slice19.png': ['hi-fi', 'high-fidelity', 'mockup'],
  'slice20.png': ['wireframe', 'lo-fi', 'sketch'],
  'slice21.png': ['questions', 'ask', 'confused'],
  'slice22.png': ['merge', 'combine'],
  'slice23.png': ['new', 'baby', 'fresh-start'],
  'slice24.png': ['old', 'legacy'],
};

// Group <N>.svg — Project status stickers (Iconfinder). Visually reviewed;
// many concepts repeat 2-3× across the pack in different burst/badge styles
// (kept as separate stickers — variety of look, not a data error).
const PROJECT_STATUS = {
  'group-41.png': ['lol', 'funny', 'laugh'],
  'group-42.png': ['sparkle', 'shiny', 'star'],
  'group-43.png': ['good-idea', 'idea', 'lightbulb'],
  'group-44.png': ['thanks', 'thank-you'],
  'group-45.png': ['ok', 'okay'],
  'group-46.png': ['done', 'finished', 'complete'],
  'group-47.png': ['flagged', 'flag', 'important'],
  'group-48.png': ['awesome', 'great'],
  'group-49.png': ['dead', 'skull', 'killed-it'],
  'group-50.png': ['hot', 'fire', 'trending'],
  'group-51.png': ['done', 'thumbs-up', 'approved'],
  'group-52.png': ['meh', 'unimpressed', 'neutral'],
  'group-53.png': ['feedback', 'question'],
  'group-54.png': ['work-busy', 'busy', 'clock'],
  'group-55.png': ['chill', 'relax', 'cool'],
  'group-56.png': ['almost-done', 'nearly-finished', 'hourglass'],
  'group-57.png': ['no', 'reject'],
  'group-58.png': ['nope', 'no', 'reject'],
  'group-59.png': ['star', 'favorite'],
  'group-60.png': ['peace', 'peace-sign'],
  'group-61.png': ['hmm', 'thinking', 'question'],
  'group-62.png': ['thumbs-up', 'awesome', 'approve'],
  'group-63.png': ['ok', 'okay-hand'],
  'group-64.png': ['love-it', 'heart', 'like'],
  'group-65.png': ['fresh', 'new'],
  'group-66.png': ['off', 'launch', 'rocket'],
  'group-67.png': ['hate-it', 'dislike', 'broken-heart'],
  'group-68.png': ['wow', 'heart', 'surprised'],
  'group-69.png': ['yes', 'agree'],
  'group-70.png': ['plus-one', '+1', 'agree'],
  'group-71.png': ['party-time', 'celebrate', 'party'],
  'group-72.png': ['omg', 'surprised', 'shocked'],
  'group-73.png': ['hot', 'fire', 'skull'],
  'group-74.png': ['sleepy', 'zzz', 'tired'],
  'group-75.png': ['wow', 'surprised'],
  'group-76.png': ['yeah', 'rock-on', 'excited'],
  'group-77.png': ['high-alert', 'warning', 'urgent'],
  'group-78.png': ['thumbs-down', 'dislike'],
  'group-79.png': ['great-idea', 'idea', 'lightbulb'],
  'group-80.png': ['super-star', 'star', 'cool'],
  'group-81.png': ['wow', 'heart', 'surprised'],
  'group-82.png': ['done', 'thumbs-up', 'approved'],
  'group-83.png': ['wow', 'surprised'],
  'group-84.png': ['work-busy', 'busy', 'clock'],
  'group-85.png': ['thumbs-down', 'dislike'],
  'group-86.png': ['thanks', 'thank-you'],
  'group-87.png': ['flagged', 'flag', 'important'],
  'group-88.png': ['dead', 'skull'],
  'group-89.png': ['high-alert', 'warning', 'urgent'],
  'group-90.png': ['good-idea', 'idea', 'lightbulb'],
  'group-91.png': ['lol', 'funny', 'laugh'],
  'group-92.png': ['awesome', 'great'],
  'group-93.png': ['hot', 'fire'],
  'group-94.png': ['chill', 'relax', 'cool'],
  'group-96.png': ['done', 'finished', 'complete'],
  'group-97.png': ['feedback', 'question'],
  'group-98.png': ['yes', 'agree'],
  'group-99.png': ['almost-done', 'nearly-finished', 'hourglass'],
  'group-100.png': ['thumbs-up', 'awesome', 'approve'],
  'group-101.png': ['super-star', 'star', 'cool'],
  'group-102.png': ['off', 'launch', 'rocket'],
  'group-103.png': ['star', 'sparkle', 'favorite'],
  'group-104.png': ['hot', 'fire', 'skull'],
  'group-105.png': ['yeah', 'rock-on', 'excited'],
  'group-106.png': ['plus-one', '+1', 'agree'],
  'group-107.png': ['no', 'reject'],
  'group-108.png': ['hate-it', 'dislike', 'broken-heart'],
  'group-109.png': ['fresh', 'new'],
  'group-110.png': ['sleepy', 'zzz', 'tired'],
  'group-111.png': ['meh', 'unimpressed', 'neutral'],
  'group-112.png': ['ok', 'thumbs-up'],
  'group-113.png': ['nope', 'no', 'reject'],
  'group-114.png': ['star', 'sparkle', 'favorite'],
  'group-115.png': ['party-time', 'celebrate', 'party'],
  'group-117.png': ['peace', 'peace-sign'],
  'group-118.png': ['omg', 'surprised', 'shocked'],
  'group-119.png': ['love-it', 'heart', 'like'],
  'group-120.png': ['ok', 'okay-hand'],
  'group-121.png': ['great-idea', 'idea', 'lightbulb'],
  'group-122.png': ['hmm', 'thinking', 'question'],
};

const PACKS = [
  {
    slug: 'project-status',
    name: 'Project status stickers',
    author: 'Iconfinder',
    attributionUrl: 'https://www.figma.com/community/file/1128224635870836270',
    license: 'Figma Community (see attributionUrl for terms)',
    keywordsFor: (file) => PROJECT_STATUS[file] ?? [],
  },
  {
    slug: 'life-style',
    name: 'Life Style Stickers',
    author: 'Pelin ŞENOĞLU',
    attributionUrl: 'https://www.figma.com/community/file/1228731654126072640',
    license: 'Figma Community (see attributionUrl for terms)',
    keywordsFor: (file) => keywordsFromSlug(file.replace(/\.png$/, '')),
  },
  {
    slug: 'figjam-doodle',
    name: 'FigJam Doodle Stickers',
    author: 'CJ Xue',
    attributionUrl: 'https://www.figma.com/community/file/1301623299668462371',
    license: 'Figma Community (see attributionUrl for terms)',
    keywordsFor: (file) => FIGJAM_DOODLE[file] ?? [],
  },
  {
    slug: 'opposing-thoughts',
    name: 'Opposing Thoughts Stickers',
    author: 'Erik Leib',
    attributionUrl: 'https://www.figma.com/community/file/1130195021486928915',
    license: 'Figma Community (see attributionUrl for terms)',
    keywordsFor: (file) => keywordsFromSlug(file.replace(/\.png$/, '')),
  },
];

for (const pack of PACKS) {
  const dir = join(OUT_DIR, pack.slug);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort();
  const stickers = files.map((file) => ({
    file,
    keywords: pack.keywordsFor(file).length
      ? pack.keywordsFor(file)
      : [titleCaseFromSlug(file.replace(/\.png$/, '')).toLowerCase()],
  }));
  const manifest = {
    name: pack.name,
    author: pack.author,
    attributionUrl: pack.attributionUrl,
    license: pack.license,
    stickers,
  };
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${pack.slug}: wrote manifest.json (${stickers.length} stickers)`);
}
