// generation/captions.ts — word-timestamp JSON → SRT / VTT, with a re-flow pass
// (DDR-164, Phase 2). SHARED by every speech-to-text provider: ElevenLabs Scribe
// (adapters/elevenlabs.ts) and local whisper.cpp (bin/_transcribe.mjs) both emit
// word-level timings; this is the single place they become subtitle cues, so the
// two never drift on line-length / timing rules.
//
// Dependency-free (mirrors photo/schema.ts, footage/schema.ts, generation/
// types.ts). Pure functions over plain data — no node:*, no provider SDK.

/** One word with second-based start/end timings (the STT-normalized shape). */
export interface CaptionWord {
  text: string;
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
}

/** One rendered subtitle cue (a line or two of grouped words). */
export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export interface ReflowOptions {
  /** Max characters per cue before a new cue starts (subtitle legibility). */
  maxChars?: number;
  /** Max seconds a single cue may span. */
  maxDuration?: number;
  /** A silence gap (seconds) between words that forces a cue break. */
  gapBreak?: number;
}

const DEFAULT_REFLOW: Required<ReflowOptions> = {
  maxChars: 42, // one comfortable subtitle line
  maxDuration: 6,
  gapBreak: 0.8,
};

/**
 * Group word-level timings into readable cues — breaking on a max line length, a
 * max duration, a silence gap, or sentence-ending punctuation. Deterministic and
 * allocation-light so both STT paths produce identical output for identical input.
 */
export function reflowWords(words: CaptionWord[], opts: ReflowOptions = {}): CaptionCue[] {
  const o = { ...DEFAULT_REFLOW, ...opts };
  const cues: CaptionCue[] = [];
  let cur: CaptionWord[] = [];

  const flush = (): void => {
    if (cur.length === 0) return;
    cues.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur
        .map((w) => w.text)
        .join(' ')
        .replace(/\s+([,.!?;:])/g, '$1') // no space before punctuation
        .trim(),
    });
    cur = [];
  };

  for (const w of words) {
    if (!w || typeof w.text !== 'string') continue;
    const text = w.text.trim();
    if (!text) continue;
    const start = Number.isFinite(w.start) ? w.start : cur.length ? cur[cur.length - 1].end : 0;
    const end = Number.isFinite(w.end) ? w.end : start;
    const word: CaptionWord = { text, start, end };

    if (cur.length > 0) {
      const prev = cur[cur.length - 1];
      const projected = cur.map((x) => x.text).join(' ').length + 1 + text.length;
      const gap = start - prev.end;
      const span = end - cur[0].start;
      if (projected > o.maxChars || span > o.maxDuration || gap >= o.gapBreak) {
        flush();
      }
    }
    cur.push(word);
    // Break AFTER sentence-ending punctuation so a cue ends on a natural clause.
    if (/[.!?]$/.test(text)) flush();
  }
  flush();
  return cues;
}

/** SRT timestamp — `HH:MM:SS,mmm`. */
function srtTime(sec: number): string {
  return formatTime(sec, ',');
}
/** VTT timestamp — `HH:MM:SS.mmm`. */
function vttTime(sec: number): string {
  return formatTime(sec, '.');
}
function formatTime(sec: number, msSep: ',' | '.'): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(ss)}${msSep}${pad(ms, 3)}`;
}

/** Render cues as an SRT document. */
export function cuesToSrt(cues: CaptionCue[]): string {
  const body = cues
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}`)
    .join('\n\n');
  return `${body}\n`;
}

/** Render cues as a WebVTT document. */
export function cuesToVtt(cues: CaptionCue[]): string {
  return (
    'WEBVTT\n\n' +
    cues.map((c) => `${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}`).join('\n\n') +
    '\n'
  );
}

/** Word timings → SRT in one call (reflow + render). */
export function wordsToSrt(words: CaptionWord[], opts?: ReflowOptions): string {
  return cuesToSrt(reflowWords(words, opts));
}

/** Word timings → VTT in one call (reflow + render). */
export function wordsToVtt(words: CaptionWord[], opts?: ReflowOptions): string {
  return cuesToVtt(reflowWords(words, opts));
}
