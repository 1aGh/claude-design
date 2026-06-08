import type { Metadata } from 'next';
import { ChangelogTimeline, type TLGroup, type TLItem } from '@/components/mdcc/changelog-timeline';
import type { CurrentPhase, Phase } from '@/components/mdcc/roadmap-timeline';
import type { WhatsNewEntry } from '@/components/mdcc/whats-new-feed';
import roadmapJson from '@/lib/roadmap.json';
import whatsNewJson from '@/lib/whats-new.json';

export const metadata: Metadata = {
  title: 'Changelog & Roadmap · Maude',
  description: 'One timeline — what shipped, what is in progress, and what is planned.',
};

// Both JSONs are regenerated at build time (build-roadmap.mjs / build-whats-new.mjs)
// from .ai/ + the dev-server feed. TS widens the imported literals; re-narrow here.
const roadmap = roadmapJson as unknown as {
  generated: string;
  currentPhase: CurrentPhase;
  phases: Phase[];
};
const feed = whatsNewJson as unknown as {
  generated: string;
  version: string;
  entries: WhatsNewEntry[];
};

const GITHUB_BLOB = 'https://github.com/1aGh/maude/blob/main';

function parseDate(d: string | null): number {
  if (!d) return 0;
  const t = Date.parse(d);
  return Number.isNaN(t) ? 0 : t;
}

function phaseToItem(p: Phase, kind: 'now' | 'next'): TLItem {
  return {
    id: p.id,
    tag: p.phaseKey ?? (kind === 'now' ? 'phase' : 'planned'),
    title: p.title.replace(/^Feature:\s*/i, ''),
    date: kind === 'now' ? 'now' : (p.shipTarget ?? 'planned'),
    bullets: p.summary ? [p.summary] : [],
    href: p.planPath ? `${GITHUB_BLOB}/${p.planPath}` : undefined,
  };
}

function entryToItem(e: WhatsNewEntry): TLItem {
  return {
    id: e.id,
    tag: e.version ? `v${e.version}` : 'next release',
    title: e.title,
    date: e.date ?? 'unreleased',
    bullets: e.summary ? [e.summary] : [],
  };
}

export default function ChangelogPage() {
  // Now ← in-progress phases (+ the live current phase if STATE flagged one).
  const nowItems: TLItem[] = roadmap.phases
    .filter((p) => p.status === 'in-progress')
    .map((p) => phaseToItem(p, 'now'));
  if (roadmap.currentPhase) {
    const cp = roadmap.currentPhase;
    if (!nowItems.some((i) => i.id === cp.id)) {
      nowItems.unshift({
        id: cp.id,
        tag: 'now',
        title: cp.title,
        date: cp.branch ?? 'in flight',
        bullets: [],
      });
    }
  }

  // Shipped ← whats-new entries, newest first.
  const shippedItems: TLItem[] = [...feed.entries]
    .sort((a, b) => parseDate(b.date) - parseDate(a.date))
    .map(entryToItem);

  // Next ← planned phases.
  const nextItems: TLItem[] = roadmap.phases
    .filter((p) => p.status === 'planned')
    .map((p) => phaseToItem(p, 'next'));

  const groups: TLGroup[] = [
    { kind: 'now', label: 'Now — in progress', items: nowItems },
    { kind: 'shipped', label: 'Shipped', items: shippedItems },
    { kind: 'next', label: 'Next — planned', items: nextItems },
  ];

  return (
    <ChangelogTimeline
      groups={groups}
      generated={roadmap.generated}
      counts={{ now: nowItems.length, shipped: shippedItems.length, next: nextItems.length }}
    />
  );
}
