// clip-addressing.test.ts — DDR-150 P2. The single AST clip tokenizer that
// replaces document-order indexing. The headline guard: on a MULTI-COMP canvas,
// enumerateClips scoped to one artboard returns THAT comp's clips only — so the
// UI (which addresses ops by stableId) can never mis-hit a clip in another comp
// (the defect that made destructive ops corrupt the wrong clip). Plus: comments
// are skipped (AST, not regex), TransitionSeries semantics are gated, and the
// content-hash fingerprint refuses a stale/raced target.

import { describe, expect, test } from 'bun:test';

import {
  applyRemoveClip,
  applyRetimeSequenceByClip,
  assertCompSemantics,
  CanvasEditError,
  enumerateClips,
  resolveClip,
} from '../canvas-edit.ts';

const CANVAS = '/abs/Canvas.tsx';

describe('enumerateClips — multi-comp scoping (the headline defect)', () => {
  const SRC = [
    'const A = 40;',
    'const B = 50;',
    'const Intro = () => (',
    '  <Sequence durationInFrames={A}><Video src="intro.mp4" /></Sequence>',
    ');',
    'const Outro = () => (',
    '  <>',
    '    <Sequence durationInFrames={B}><Video src="a.mp4" /></Sequence>',
    '    <Sequence from={10} durationInFrames={60}><Video src="b.mp4" /></Sequence>',
    '  </>',
    ');',
    'function Canvas() {',
    '  return (',
    '    <DesignCanvas>',
    '      <DCArtboard id="intro"><VideoComp component={Intro} durationInFrames={A} fps={30} /></DCArtboard>',
    '      <DCArtboard id="outro"><VideoComp component={Outro} durationInFrames={B} fps={30} /></DCArtboard>',
    '    </DesignCanvas>',
    '  );',
    '}',
  ].join('\n');

  test('scopes to the selected artboard’s comp — not the whole file', () => {
    const intro = enumerateClips(CANVAS, SRC, 'intro');
    expect(intro.compName).toBe('Intro');
    expect(intro.clips.map((c) => c.stableId)).toEqual(['Intro#0']);
    expect(intro.clips[0]?.mediaSrc).toBe('intro.mp4');
    expect(intro.clips[0]?.durationInFrames).toBe(40);

    const outro = enumerateClips(CANVAS, SRC, 'outro');
    expect(outro.compName).toBe('Outro');
    // TWO clips, comp-scoped ids — NOT file-wide indices 1 & 2.
    expect(outro.clips.map((c) => c.stableId)).toEqual(['Outro#0', 'Outro#1']);
    // The headline assertion: outro clip 0 is the OUTRO clip (a.mp4), never the
    // intro clip. A whole-file document-order index would have mis-hit here.
    expect(outro.clips[0]?.mediaSrc).toBe('a.mp4');
    expect(outro.clips[1]?.mediaSrc).toBe('b.mp4');
    expect(outro.clips[1]?.from).toBe(10);
    expect(outro.clips[1]?.durationInFrames).toBe(60);
  });

  test('the same stableId means the same clip across UI/engine (distinct comp-scoped ids)', () => {
    const intro = enumerateClips(CANVAS, SRC, 'intro');
    const outro = enumerateClips(CANVAS, SRC, 'outro');
    const ids = [...intro.clips, ...outro.clips].map((c) => c.stableId);
    expect(new Set(ids).size).toBe(ids.length); // no collisions across comps
  });
});

describe('enumerateClips — stable identity precedence', () => {
  test('<Sequence name> wins; sentinel next; else comp#index', () => {
    const src = [
      'const Comp = () => (',
      '  <>',
      '    <Sequence name="hero" durationInFrames={30}><A /></Sequence>',
      '    {/* @mclip lower-third */}',
      '    <Sequence durationInFrames={20}><B /></Sequence>',
      '    <Sequence durationInFrames={20}><C /></Sequence>',
      '  </>',
      ');',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={70} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const { clips } = enumerateClips(CANVAS, src, 'x');
    expect(clips.map((c) => c.stableId)).toEqual(['name:hero', 'mclip:lower-third', 'Comp#2']);
  });
});

describe('enumerateClips — AST skips commented + tolerates .map', () => {
  test('a commented-out <Sequence> is NOT enumerated (regex would have counted it)', () => {
    const src = [
      'const Comp = () => (',
      '  <>',
      '    <Sequence durationInFrames={30}><A /></Sequence>',
      '    {/* <Sequence durationInFrames={99}><Ghost /></Sequence> */}',
      '    <Sequence durationInFrames={20}><B /></Sequence>',
      '  </>',
      ');',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={50} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const { clips } = enumerateClips(CANVAS, src, 'x');
    expect(clips.length).toBe(2);
    expect(clips.map((c) => c.stableId)).toEqual(['Comp#0', 'Comp#1']);
  });

  test('a .map() renders one addressable template clip', () => {
    const src = [
      'const Comp = ({ shots }) => (',
      '  <>{shots.map((s) => <Sequence key={s.id} from={s.from} durationInFrames={s.dur}><Video src={s.src} /></Sequence>)}</>',
      ');',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={90} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const { clips } = enumerateClips(CANVAS, src, 'x');
    expect(clips.length).toBe(1);
    expect(clips[0]?.stableId).toBe('Comp#0');
    expect(clips[0]?.mediaTag).toBe('Video'); // media detected even though src is dynamic
  });
});

describe('resolveClip — content-hash fingerprint (optimistic concurrency)', () => {
  const src = [
    'const Comp = () => <Sequence durationInFrames={30}><Video src="a.mp4" /></Sequence>;',
    'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={30} fps={30} /></DCArtboard>; }',
  ].join('\n');

  test('resolves a clip by stableId + matching hash', () => {
    const { clips } = enumerateClips(CANVAS, src, 'x');
    const c = clips[0] as { stableId: string; contentHash: string };
    const r = resolveClip(CANVAS, src, 'x', c.stableId, c.contentHash);
    expect(r.stableId).toBe(c.stableId);
  });

  test('refuses when the clip content changed since it was read', () => {
    const { clips } = enumerateClips(CANVAS, src, 'x');
    const c = clips[0] as { stableId: string };
    expect(() => resolveClip(CANVAS, src, 'x', c.stableId, 'deadbeef')).toThrow(CanvasEditError);
  });

  test('throws on an unknown stableId', () => {
    expect(() => resolveClip(CANVAS, src, 'x', 'Comp#99')).toThrow(CanvasEditError);
  });
});

describe('assertCompSemantics — TransitionSeries alternation (parse-clean ≠ correct)', () => {
  const wrap = (inner: string) =>
    `const Comp = () => (<TransitionSeries>${inner}</TransitionSeries>);`;
  const SEQ = '<TransitionSeries.Sequence durationInFrames={30}><A /></TransitionSeries.Sequence>';
  const TR = '<TransitionSeries.Transition timing={t} />';

  test('accepts a valid alternating series', () => {
    expect(assertCompSemantics(CANVAS, wrap(`${SEQ}${TR}${SEQ}`)).ok).toBe(true);
    expect(assertCompSemantics(CANVAS, wrap(SEQ)).ok).toBe(true);
  });

  test('rejects a leading transition', () => {
    expect(() => assertCompSemantics(CANVAS, wrap(`${TR}${SEQ}`))).toThrow(CanvasEditError);
  });

  test('rejects a trailing transition (the orphaned-transition after a remove)', () => {
    expect(() => assertCompSemantics(CANVAS, wrap(`${SEQ}${TR}`))).toThrow(CanvasEditError);
  });

  test('rejects a doubled transition', () => {
    expect(() => assertCompSemantics(CANVAS, wrap(`${SEQ}${TR}${TR}${SEQ}`))).toThrow(
      CanvasEditError
    );
  });
});

describe('applyRetimeSequenceByClip — stableId retime (multi-comp safe)', () => {
  const SRC = [
    'const Intro = () => <Sequence durationInFrames={40}><Video src="intro.mp4" /></Sequence>;',
    'const Outro = () => (',
    '  <>',
    '    <Sequence durationInFrames={50}><Video src="a.mp4" /></Sequence>',
    '    <Sequence from={10} durationInFrames={60}><Video src="b.mp4" /></Sequence>',
    '  </>',
    ');',
    'function Canvas() {',
    '  return (<DesignCanvas>',
    '    <DCArtboard id="intro"><VideoComp component={Intro} durationInFrames={40} fps={30} /></DCArtboard>',
    '    <DCArtboard id="outro"><VideoComp component={Outro} durationInFrames={110} fps={30} /></DCArtboard>',
    '  </DesignCanvas>);',
    '}',
  ].join('\n');

  test('retimes the addressed clip in comp B without touching comp A', () => {
    const out = applyRetimeSequenceByClip(CANVAS, SRC, 'outro', 'Outro#1', undefined, {
      durationInFrames: 90,
    });
    // Outro#1 (the b.mp4 clip, from={10}) is retimed to 90…
    expect(out.source).toContain('from={10} durationInFrames={90}');
    // …and the Intro clip (a whole-file index of 0) is untouched.
    expect(out.source).toContain('const Intro = () => <Sequence durationInFrames={40}>');
    // …as is Outro#0.
    expect(out.source).toContain('<Sequence durationInFrames={50}><Video src="a.mp4"');
  });

  test('refuses a stale content-hash (concurrent edit)', () => {
    expect(() =>
      applyRetimeSequenceByClip(CANVAS, SRC, 'outro', 'Outro#1', 'deadbeef', {
        durationInFrames: 90,
      })
    ).toThrow(CanvasEditError);
  });

  test('inserts `from` when moving a cursor-implicit clip (P3 Task 6)', () => {
    const src = [
      'const Comp = () => <Sequence durationInFrames={40}><A /></Sequence>;',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={40} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const out = applyRetimeSequenceByClip(CANVAS, src, 'x', 'Comp#0', undefined, { from: 25 });
    expect(out.source).toContain('<Sequence from={25} durationInFrames={40}>');
  });
});

describe('applyRemoveClip — clip removal (DDR-150 P3)', () => {
  const outro = () =>
    [
      `const Intro = () => <Sequence durationInFrames={40}><Video src="i.mp4" /></Sequence>;`,
      `const Outro = () => (`,
      `  <>`,
      `    <Sequence durationInFrames={50}><Video src="a.mp4" /></Sequence>`,
      `    <Sequence from={10} durationInFrames={60}><Video src="b.mp4" /></Sequence>`,
      `  </>`,
      `);`,
      `function Canvas() {`,
      `  return (<DesignCanvas>`,
      `    <DCArtboard id="intro"><VideoComp component={Intro} durationInFrames={40} fps={30} /></DCArtboard>`,
      `    <DCArtboard id="outro"><VideoComp component={Outro} durationInFrames={110} fps={30} /></DCArtboard>`,
      `  </DesignCanvas>);`,
      `}`,
    ].join('\n');

  test('removes a standalone clip in comp B, leaving comp A + the sibling clip', () => {
    const src = outro();
    const out = applyRemoveClip(CANVAS, src, 'outro', 'Outro#0', undefined);
    // Outro#0 (a.mp4) gone; Outro#1 (b.mp4) + Intro (i.mp4) intact.
    expect(out.source).not.toContain('a.mp4');
    expect(out.source).toContain('b.mp4');
    expect(out.source).toContain('i.mp4');
  });

  test('refuses removing the only clip in a comp', () => {
    const src = [
      'const Comp = () => <Sequence durationInFrames={30}><A /></Sequence>;',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={30} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const only = enumerateClips(CANVAS, src, 'x').clips[0] as { stableId: string };
    expect(() => applyRemoveClip(CANVAS, src, 'x', only.stableId, undefined)).toThrow(
      CanvasEditError
    );
  });

  test('refuses a stale content-hash', () => {
    const src = outro();
    expect(() => applyRemoveClip(CANVAS, src, 'outro', 'Outro#0', 'deadbeef')).toThrow(
      CanvasEditError
    );
  });

  test('drops one adjacent transition when removing a TransitionSeries clip (series stays valid)', () => {
    const src = [
      'const Comp = () => (<TransitionSeries>',
      '  <TransitionSeries.Sequence durationInFrames={30}><A /></TransitionSeries.Sequence>',
      '  <TransitionSeries.Transition timing={t} />',
      '  <TransitionSeries.Sequence durationInFrames={40}><B /></TransitionSeries.Sequence>',
      '  <TransitionSeries.Transition timing={t} />',
      '  <TransitionSeries.Sequence durationInFrames={50}><C /></TransitionSeries.Sequence>',
      '</TransitionSeries>);',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={120} fps={30} /></DCArtboard>; }',
    ].join('\n');
    // Remove the middle sequence (Comp#2 in flat order: S,T,S,T,S → index 2).
    const clips = enumerateClips(CANVAS, src, 'x').clips;
    const mid = clips.filter((c) => c.kind === 'sequence')[1] as { stableId: string };
    const out = applyRemoveClip(CANVAS, src, 'x', mid.stableId, undefined);
    // <B/> gone; the result still parses AND passes the alternation gate.
    expect(out.source).not.toContain('<B />');
    expect(() => assertCompSemantics(CANVAS, out.source)).not.toThrow();
    // exactly one transition left (was 2, one dropped with the removed sequence).
    expect((out.source.match(/TransitionSeries\.Transition/g) || []).length).toBe(1);
  });
});
