// clip-addressing.test.ts — DDR-150 P2. The single AST clip tokenizer that
// replaces document-order indexing. The headline guard: on a MULTI-COMP canvas,
// enumerateClips scoped to one artboard returns THAT comp's clips only — so the
// UI (which addresses ops by stableId) can never mis-hit a clip in another comp
// (the defect that made destructive ops corrupt the wrong clip). Plus: comments
// are skipped (AST, not regex), TransitionSeries semantics are gated, and the
// content-hash fingerprint refuses a stale/raced target.

import { describe, expect, test } from 'bun:test';

import {
  applyEditArrayElementString,
  applyInsertClip,
  applyRemoveClip,
  applyReorderClip,
  applyRetimeSequenceByClip,
  applyToggleClipHidden,
  assembleCompSource,
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

describe('applyRetimeSequenceByClip — refuses a no-op `from` on series clips (dogfood fix)', () => {
  const src = [
    'const Comp = () => (<TransitionSeries>',
    '  <TransitionSeries.Sequence durationInFrames={30}><A /></TransitionSeries.Sequence>',
    '  <TransitionSeries.Transition timing={t} />',
    '  <TransitionSeries.Sequence durationInFrames={40}><B /></TransitionSeries.Sequence>',
    '</TransitionSeries>);',
    'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={70} fps={30} /></DCArtboard>; }',
  ].join('\n');

  test('from-move on a TransitionSeries.Sequence throws (Remotion ignores the prop)', () => {
    const seqs = enumerateClips(CANVAS, src, 'x').clips.filter((c) => c.kind === 'sequence');
    expect(() =>
      applyRetimeSequenceByClip(CANVAS, src, 'x', seqs[0]!.stableId, undefined, { from: 20 })
    ).toThrow(/series computes its position/);
  });

  test('trim (durationInFrames) on a TransitionSeries.Sequence still works', () => {
    const seqs = enumerateClips(CANVAS, src, 'x').clips.filter((c) => c.kind === 'sequence');
    const out = applyRetimeSequenceByClip(CANVAS, src, 'x', seqs[1]!.stableId, undefined, {
      durationInFrames: 25,
    });
    expect(out.source).toContain('durationInFrames={25}');
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

  test('inserts a new <Sequence> with media after the last clip (P4 Task 11)', () => {
    const src = [
      'const Comp = () => (',
      '  <>',
      '    <Sequence durationInFrames={50}><Video src="assets/a.mp4" /></Sequence>',
      '  </>',
      ');',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={50} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const out = applyInsertClip(CANVAS, src, 'x', {
      from: 50,
      durationInFrames: 40,
      mediaTag: 'Video',
      src: 'assets/new.mp4',
    });
    expect(out.source).toContain('<Sequence from={50} durationInFrames={40}>');
    expect(out.source).toContain('<Video src="assets/new.mp4" />');
    expect(out.stableId).toBe('Comp#1'); // new clip is the 2nd
    // both clips enumerate cleanly
    expect(enumerateClips(CANVAS, out.source, 'x').clips.length).toBe(2);
  });

  test('refuses insert with a traversal src', () => {
    const src = [
      'const Comp = () => <Sequence durationInFrames={30}><Video src="assets/a.mp4" /></Sequence>;',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={30} fps={30} /></DCArtboard>; }',
    ].join('\n');
    expect(() =>
      applyInsertClip(CANVAS, src, 'x', {
        from: 0,
        durationInFrames: 30,
        mediaTag: 'Video',
        src: '../../etc/passwd',
      })
    ).toThrow(CanvasEditError);
  });

  test('refuses appending into a single-sequence <TransitionSeries> (no transition to clone)', () => {
    const src = [
      'const Comp = () => (<TransitionSeries>',
      '  <TransitionSeries.Sequence durationInFrames={30}><A /></TransitionSeries.Sequence>',
      '</TransitionSeries>);',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={30} fps={30} /></DCArtboard>; }',
    ].join('\n');
    expect(() => applyInsertClip(CANVAS, src, 'x', { from: 30, durationInFrames: 30 })).toThrow(
      CanvasEditError
    );
  });

  test('appends a transition + sequence into a <TransitionSeries> (dogfood — cloned transition)', () => {
    const src = [
      'const Comp = () => (<TransitionSeries>',
      '  <TransitionSeries.Sequence durationInFrames={30}><A /></TransitionSeries.Sequence>',
      '  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 8 })} />',
      '  <TransitionSeries.Sequence durationInFrames={40}><B /></TransitionSeries.Sequence>',
      '</TransitionSeries>);',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={70} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const out = applyInsertClip(CANVAS, src, 'x', {
      from: 0,
      durationInFrames: 50,
      mediaTag: 'Video',
      src: 'assets/new.mp4',
    });
    // A new sequence with the media + a cloned transition; alternation intact.
    expect(out.source).toContain('<Video src="assets/new.mp4" />');
    expect((out.source.match(/<\/TransitionSeries\.Sequence>/g) || []).length).toBe(3); // 3 sequences
    expect((out.source.match(/TransitionSeries\.Transition/g) || []).length).toBe(2);
    expect(() => assertCompSemantics(CANVAS, out.source)).not.toThrow();
    const seqs = enumerateClips(CANVAS, out.source, 'x').clips.filter((c) => c.kind === 'sequence');
    expect(seqs.length).toBe(3);
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

describe('applyReorderClip — z-order reorder (DDR-150 P5)', () => {
  // Three standalone <Sequence> siblings whose stacking order (document order)
  // is the render z-order — footage under a lower-third under a logo.
  const stack = () =>
    [
      'const Reel = () => (',
      '  <>',
      '    <Sequence durationInFrames={90}><Video src="footage.mp4" /></Sequence>',
      '    <Sequence durationInFrames={90}><Img src="lower-third.png" /></Sequence>',
      '    <Sequence durationInFrames={90}><Img src="logo.png" /></Sequence>',
      '  </>',
      ');',
      'function Canvas() { return <DCArtboard id="reel"><VideoComp component={Reel} durationInFrames={90} fps={30} /></DCArtboard>; }',
    ].join('\n');

  test('moves a clip after a sibling — stacking order changes, content preserved', () => {
    const src = stack();
    const clips = enumerateClips(CANVAS, src, 'reel').clips;
    const footage = clips[0]!; // Reel#0
    const logo = clips[2]!; // Reel#2
    // Bring footage to the top: move it AFTER the logo.
    const out = applyReorderClip(
      CANVAS,
      src,
      'reel',
      footage.stableId,
      footage.contentHash,
      logo.stableId,
      logo.contentHash,
      'after'
    );
    // New document order: lower-third, logo, footage (footage now paints last).
    const after = enumerateClips(CANVAS, out.source, 'reel').clips;
    expect(after.map((c) => c.mediaSrc)).toEqual(['lower-third.png', 'logo.png', 'footage.mp4']);
    // All three clips survive; nothing was dropped or duplicated.
    expect(after.length).toBe(3);
    // The moved clip is re-addressed by its (unchanged) content hash.
    expect(out.stableId).toBe(after[2]!.stableId);
  });

  test('refuses a stale content-hash on either clip', () => {
    const src = stack();
    const clips = enumerateClips(CANVAS, src, 'reel').clips;
    expect(() =>
      applyReorderClip(
        CANVAS,
        src,
        'reel',
        clips[0]!.stableId,
        'deadbeef',
        clips[2]!.stableId,
        clips[2]!.contentHash,
        'after'
      )
    ).toThrow(CanvasEditError);
  });

  test('refuses a self-move', () => {
    const src = stack();
    const c0 = enumerateClips(CANVAS, src, 'reel').clips[0]!;
    expect(() =>
      applyReorderClip(
        CANVAS,
        src,
        'reel',
        c0.stableId,
        c0.contentHash,
        c0.stableId,
        c0.contentHash,
        'after'
      )
    ).toThrow(CanvasEditError);
  });

  test('reorders TransitionSeries beats by SWAPPING sequences (dogfood — transitions stay put)', () => {
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
    const seqs = enumerateClips(CANVAS, src, 'x').clips.filter((c) => c.kind === 'sequence');
    // Move A (clip 0) later — swap with B (clip 1).
    const out = applyReorderClip(
      CANVAS,
      src,
      'x',
      seqs[0]!.stableId,
      seqs[0]!.contentHash,
      seqs[1]!.stableId,
      seqs[1]!.contentHash,
      'after'
    );
    // B now plays first (with its 40f), A second (30f) — alternation intact.
    const order = (out.source.match(/<([ABC]) \//g) || []).map((m) => m[1]);
    expect(order).toEqual(['B', 'A', 'C']);
    expect(() => assertCompSemantics(CANVAS, out.source)).not.toThrow();
    expect((out.source.match(/TransitionSeries\.Transition/g) || []).length).toBe(2); // both kept
  });

  test('still refuses reordering a series clip against a STANDALONE one (mixed kinds)', () => {
    const src = [
      'const Comp = () => (<><TransitionSeries>',
      '  <TransitionSeries.Sequence durationInFrames={30}><A /></TransitionSeries.Sequence>',
      '  <TransitionSeries.Transition timing={t} />',
      '  <TransitionSeries.Sequence durationInFrames={40}><B /></TransitionSeries.Sequence>',
      '</TransitionSeries>',
      '<Sequence durationInFrames={20}><D /></Sequence></>);',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={90} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const seqs = enumerateClips(CANVAS, src, 'x').clips.filter((c) => c.kind === 'sequence');
    const seriesClip = seqs.find((c) => c.tag === 'TransitionSeries.Sequence')!;
    const standalone = seqs.find((c) => c.tag === 'Sequence')!;
    expect(() =>
      applyReorderClip(
        CANVAS,
        src,
        'x',
        seriesClip.stableId,
        seriesClip.contentHash,
        standalone.stableId,
        standalone.contentHash,
        'after'
      )
    ).toThrow(CanvasEditError);
  });
});

describe('applyToggleClipHidden — hide/show a clip (dogfood)', () => {
  const src = [
    'const Comp = () => (<TransitionSeries>',
    '  <TransitionSeries.Sequence durationInFrames={40}><A /></TransitionSeries.Sequence>',
    '  <TransitionSeries.Transition timing={t} />',
    '  <TransitionSeries.Sequence durationInFrames={50}><B /></TransitionSeries.Sequence>',
    '</TransitionSeries>);',
    'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={90} fps={30} /></DCArtboard>; }',
  ].join('\n');

  test('hide gates the body behind {false && (…)} keeping the tag + alternation, then shows reversibly', () => {
    const s0 = enumerateClips(CANVAS, src, 'x').clips.filter((c) => c.kind === 'sequence');
    expect(s0.every((c) => c.hidden === false)).toBe(true);
    const hid = applyToggleClipHidden(CANVAS, src, 'x', s0[0]!.stableId, s0[0]!.contentHash);
    expect(hid.hidden).toBe(true);
    expect(hid.source).toContain('{false && (<A />)}');
    expect(() => assertCompSemantics(CANVAS, hid.source)).not.toThrow(); // alternation intact
    const s1 = enumerateClips(CANVAS, hid.source, 'x').clips.filter((c) => c.kind === 'sequence');
    expect(s1[0]!.hidden).toBe(true);
    const shown = applyToggleClipHidden(
      CANVAS,
      hid.source,
      'x',
      s1[0]!.stableId,
      s1[0]!.contentHash
    );
    expect(shown.hidden).toBe(false);
    expect(shown.source).toBe(src); // fully reversible
  });
});

describe('enumerateClips — clip layer decomposition (dogfood — mp4 background + title)', () => {
  const src = [
    "const CLIPS = [{ src: 'assets/a.mp4', label: 'Aerial' }];",
    'const LowerThird = ({ label }) => <AbsoluteFill><div>{label}</div></AbsoluteFill>;',
    'const ClipShot = ({ clip }) => (',
    '  <AbsoluteFill>',
    '    <AbsoluteFill><Video src={clip.src} /></AbsoluteFill>',
    '    <AbsoluteFill style={{ background: "grad" }} />',
    '    <LowerThird label={clip.label} />',
    '  </AbsoluteFill>',
    ');',
    'const TitleCard = () => <AbsoluteFill>hi</AbsoluteFill>;',
    'const Reel = () => (<TransitionSeries>',
    '  <TransitionSeries.Sequence durationInFrames={60}><TitleCard /></TransitionSeries.Sequence>',
    '  <TransitionSeries.Transition timing={t} />',
    '  <TransitionSeries.Sequence durationInFrames={60}><ClipShot clip={CLIPS[0]} /></TransitionSeries.Sequence>',
    '</TransitionSeries>);',
    'function Canvas() { return <DCArtboard id="reel"><VideoComp component={Reel} durationInFrames={120} fps={30} /></DCArtboard>; }',
  ].join('\n');

  test('a ClipShot decomposes into a video layer (array-fed, replaceable) + its title component', () => {
    const seqs = enumerateClips(CANVAS, src, 'reel').clips.filter((c) => c.kind === 'sequence');
    expect(seqs[0]!.layers).toEqual([]); // pure TitleCard → no layers
    const layers = seqs[1]!.layers;
    expect(layers.map((l) => l.kind)).toEqual(['video', 'component']);
    expect(layers[0]!.mediaTag).toBe('Video');
    expect(layers[0]!.mediaArrayRef).toEqual({ arrayName: 'CLIPS', index: 0, field: 'src' });
    expect(layers[1]!.label).toBe('LowerThird');
  });
});

describe('enumerateClips — nested/wrapper-component media (showreel granularity + replace)', () => {
  const showreel = [
    'const CLIPS = [',
    "  { src: 'assets/a.mp4', label: 'Aerial' },",
    "  { src: 'assets/b.mp4', label: 'Nature' },",
    '];',
    'const ClipShot = ({ clip }) => <AbsoluteFill><Video src={clip.src} /></AbsoluteFill>;',
    'const TitleCard = () => <AbsoluteFill>hi</AbsoluteFill>;',
    'const Comp = () => (<><TransitionSeries>',
    '  <TransitionSeries.Sequence durationInFrames={60}><TitleCard /></TransitionSeries.Sequence>',
    '  <TransitionSeries.Transition timing={t} />',
    '  <TransitionSeries.Sequence durationInFrames={60}><ClipShot clip={CLIPS[0]} /></TransitionSeries.Sequence>',
    '  <TransitionSeries.Transition timing={t} />',
    '  <TransitionSeries.Sequence durationInFrames={60}><ClipShot clip={CLIPS[1]} /></TransitionSeries.Sequence>',
    '</TransitionSeries><Audio src="assets/music.mp3" /></>);',
    'function Canvas() { return <DCArtboard id="reel"><VideoComp component={Comp} durationInFrames={180} fps={30} /></DCArtboard>; }',
  ].join('\n');

  test('resolves media through a wrapper component fed by an array element', () => {
    const seqs = enumerateClips(CANVAS, showreel, 'reel').clips.filter(
      (c) => c.kind === 'sequence'
    );
    // TitleCard = pure function, no media.
    expect(seqs[0]!.mediaTag).toBeNull();
    // ClipShot clips → Video, src resolved through CLIPS[i].src, array-ref for replace.
    expect(seqs[1]!.mediaTag).toBe('Video');
    expect(seqs[1]!.mediaSrc).toBe('assets/a.mp4');
    expect(seqs[1]!.mediaArrayRef).toEqual({ arrayName: 'CLIPS', index: 0, field: 'src' });
    expect(seqs[2]!.mediaArrayRef).toEqual({ arrayName: 'CLIPS', index: 1, field: 'src' });
  });

  test('the loose <Audio> is NOT mis-attributed to the last sequence', () => {
    const { clips, media } = enumerateClips(CANVAS, showreel, 'reel');
    const seqs = clips.filter((c) => c.kind === 'sequence');
    expect(seqs.every((s) => s.mediaTag !== 'Audio')).toBe(true);
    expect(media.length).toBe(1);
    expect(media[0]!.tag).toBe('Audio');
  });
});

describe('applyEditArrayElementString — array-fed src replace (showreel)', () => {
  const src = [
    'const CLIPS = [',
    "  { src: 'assets/a.mp4', label: 'Aerial' },",
    "  { src: 'assets/b.mp4', label: 'Nature' },",
    '];',
  ].join('\n');

  test('rewrites the indexed element string', () => {
    const out = applyEditArrayElementString(CANVAS, src, 'CLIPS', 1, 'src', 'assets/new.mp4');
    expect(out.source).toContain('"assets/new.mp4"');
    expect(out.source).toContain("'assets/a.mp4'"); // sibling untouched
  });

  test('rejects a traversal / scheme value', () => {
    expect(() => applyEditArrayElementString(CANVAS, src, 'CLIPS', 0, 'src', '../x')).toThrow(
      CanvasEditError
    );
  });

  test('throws on a missing array / element / field', () => {
    expect(() =>
      applyEditArrayElementString(CANVAS, src, 'NOPE', 0, 'src', 'assets/x.mp4')
    ).toThrow(CanvasEditError);
    expect(() =>
      applyEditArrayElementString(CANVAS, src, 'CLIPS', 9, 'src', 'assets/x.mp4')
    ).toThrow(CanvasEditError);
  });
});

describe('enumerateClips — loose media beds (DDR-150 dogfood #5, audio replace)', () => {
  test('an <Audio> bed OUTSIDE clips is listed in media[] with a cd-id; one inside a clip is not', () => {
    const src = [
      'const Comp = () => (',
      '  <>',
      '    <Sequence durationInFrames={60}><Video src="assets/a.mp4" /></Sequence>',
      '    <Sequence durationInFrames={30}><Audio src="assets/voice.mp3" /></Sequence>',
      '    <Audio src="assets/music.mp3" volume={0.6} />',
      '  </>',
      ');',
      'function Canvas() { return <DCArtboard id="x"><VideoComp component={Comp} durationInFrames={60} fps={30} /></DCArtboard>; }',
    ].join('\n');
    const { clips, media } = enumerateClips(CANVAS, src, 'x');
    expect(clips.length).toBe(2);
    // ONLY the loose bed — the in-clip <Audio>/<Video> stay clip-scoped media.
    expect(media.length).toBe(1);
    expect(media[0]!.tag).toBe('Audio');
    expect(media[0]!.src).toBe('assets/music.mp3');
    expect(typeof media[0]!.cdId === 'string' || media[0]!.cdId === null).toBe(true);
  });
});

describe('assembleCompSource — refs → comp (DDR-150 P4 Task 12)', () => {
  test('lays video clips back-to-back as named sequences + parses + enumerates', () => {
    const tsx = assembleCompSource(
      'MyReel',
      [
        { src: 'assets/a.mp4', mediaKind: 'video', durationInFrames: 60 },
        { src: 'assets/b.mp4', mediaKind: 'video', durationInFrames: 40 },
      ],
      { fps: 30 }
    );
    // Generated source is parseable + the enumerator sees exactly two clips…
    const { clips, compName, durationInFrames } = enumerateClips('/abs/MyReel.tsx', tsx, 'reel');
    expect(compName).toBe('Comp');
    expect(clips.map((c) => c.mediaSrc)).toEqual(['assets/a.mp4', 'assets/b.mp4']);
    // …laid back-to-back (cursor advances by each duration)…
    expect(clips[0]!.from).toBe(0);
    expect(clips[1]!.from).toBe(60);
    expect(clips[1]!.durationInFrames).toBe(40);
    // …with durable <Sequence name> identity so hand-edits land right.
    expect(clips.map((c) => c.stableId)).toEqual(['name:clip-1', 'name:clip-2']);
    // total duration = sum of clip durations.
    expect(durationInFrames).toBe(100);
    // and it passes the semantic gate.
    expect(() => assertCompSemantics('/abs/MyReel.tsx', tsx)).not.toThrow();
  });

  test('audio clips become <Audio> beds under the reel (not sequenced)', () => {
    const tsx = assembleCompSource('R', [
      { src: 'assets/v.mp4', mediaKind: 'video', durationInFrames: 90 },
      { src: 'assets/music.mp3', mediaKind: 'audio' },
    ]);
    expect(tsx).toContain('<Audio src="assets/music.mp3" />');
    expect(tsx).toContain(
      `import { AbsoluteFill, Sequence, OffthreadVideo, Audio } from 'remotion';`
    );
    // total driven by the video clip's duration (audio doesn't extend it).
    expect(enumerateClips('/abs/R.tsx', tsx, 'reel').durationInFrames).toBe(90);
  });

  test('defaults an unknown duration to fps*3', () => {
    const tsx = assembleCompSource('R', [{ src: 'assets/v.mp4', mediaKind: 'video' }], { fps: 24 });
    expect(enumerateClips('/abs/R.tsx', tsx, 'reel').clips[0]!.durationInFrames).toBe(72);
  });

  test('rejects a traversal / scheme src', () => {
    expect(() =>
      assembleCompSource('R', [{ src: '../../etc/passwd', mediaKind: 'video' }])
    ).toThrow(CanvasEditError);
    expect(() =>
      assembleCompSource('R', [{ src: 'https://evil.example/x.mp4', mediaKind: 'video' }])
    ).toThrow(CanvasEditError);
  });

  test('refuses an empty clip set', () => {
    expect(() => assembleCompSource('R', [])).toThrow(CanvasEditError);
  });
});
