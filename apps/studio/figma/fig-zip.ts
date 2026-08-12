/**
 * @file       figma/fig-zip.ts — the narrow ZIP reader behind the local `.fig` door.
 * @scope      apps/studio/figma/fig-zip.ts
 * @purpose    A `.fig`/`.jam` is a ZIP wrapping `canvas.fig` + `meta.json` +
 *             `images/` (DDR-221 § Context). This reads exactly that archive
 *             and REFUSES everything else.
 *
 * @invariant  DEPENDENCY-FREE. `node:zlib` only. `jszip` is already an
 *             apps/studio dep and is deliberately NOT used (DDR-221 D2): it is
 *             absent from the ROOT package.json, so reaching for it would make
 *             `--fig` desktop-app-only on npm exactly the way `oxc-parser`
 *             does for `--explode`.
 *
 * @invariant  NOT A GENERAL ZIP IMPLEMENTATION, on purpose. No zip64, no
 *             encryption, no data descriptors, no multi-disk, no
 *             central-directory recovery. One known producer writes these
 *             files; refusing every shape it does not emit is the fail-loud
 *             posture (DDR-221 D3), not a gap.
 *
 * @invariant  AN ENTRY NAME IS A LOOKUP KEY, NEVER A PATH (DDR-221 D6). No
 *             value from this module is ever passed to `path.join`. The
 *             traversal check below is defence in depth, not the reason
 *             zip-slip cannot bite.
 */

import { crc32, inflateRawSync } from 'node:zlib';

// ── Caps (DDR-221 D4) ───────────────────────────────────────────────────────
// Measured baseline: the committed fixtures are 49 858 B / 64 574 B with 4
// entries each, and a legitimate entry compresses ~2.5x.

/** The user picked this file; generous on purpose. */
export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
/** `images/` can be large. 4 observed. */
export const MAX_ARCHIVE_ENTRIES = 4096;
/** ~80x the measured 2.5x. */
export const MAX_ENTRY_RATIO = 200;
/** Refuse a single entry claiming more than this, before inflating a byte. */
export const MAX_ENTRY_BYTES = 128 * 1024 * 1024;

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;
const EOCD_MIN = 22;
/** ZIP's comment length field is 16-bit, so the EOCD starts within 64 KiB + 22. */
const EOCD_SEARCH = 0xffff + EOCD_MIN;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

const FLAG_ENCRYPTED = 0x0001;
const FLAG_STRONG_ENCRYPTION = 0x0040;
// Bit 3 (0x0008, "data descriptor") is deliberately absent: it is ALLOWED, and
// Figma sets it. See the note at the flag check below for why it is harmless.

/** The 32-bit sentinel that means "the real value is in a zip64 extra field". */
const ZIP64_SENTINEL = 0xffffffff;

export class FigZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FigZipError';
  }
}

export interface FigZipEntry {
  /**
   * UNTRUSTED. Attacker-chosen text from the archive. Never a path — callers
   * match it against a literal, and it is bounded before it reaches any report.
   */
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  method: number;
  crc: number;
  localHeaderOffset: number;
}

/** A parsed central directory. Entry BYTES are read lazily, per entry. */
export interface FigZip {
  entries: FigZipEntry[];
  get(name: string): Uint8Array | undefined;
  has(name: string): boolean;
}

function u16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}

function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

/**
 * Reject a name that could be read as a path by a future caller who forgets the
 * lookup-key rule. Also rejects the NUL that would truncate it in a C-string
 * context, and the control characters that would corrupt a report line.
 */
function isSafeEntryName(name: string): boolean {
  if (name.length === 0 || name.length > 512) return false;
  if (name.startsWith('/') || name.startsWith('\\')) return false;
  if (name.includes('\\')) return false;
  if (/(^|\/)\.\.(\/|$)/.test(name)) return false;
  if (/^[A-Za-z]:/.test(name)) return false;
  // Control characters would corrupt a report line; refuse rather than strip.
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return false;
  }
  return true;
}

/**
 * Find the End Of Central Directory record. Scans backwards over the comment
 * field. A truncated or comment-forged archive refuses rather than guessing.
 */
function findEocd(buf: Uint8Array): number {
  const start = Math.max(0, buf.length - EOCD_SEARCH);
  for (let i = buf.length - EOCD_MIN; i >= start; i--) {
    if (u32(buf, i) !== EOCD_SIG) continue;
    // Only accept it if the declared comment length actually reaches the end,
    // so a `PK\x05\x06` sequence inside compressed data cannot pose as the EOCD.
    if (i + EOCD_MIN + u16(buf, i + 20) === buf.length) return i;
  }
  throw new FigZipError('not a ZIP archive: no end-of-central-directory record');
}

/**
 * Parse the central directory of a `.fig`/`.jam`. Entry bytes are inflated on
 * demand by `get()`, so opening a large archive costs the directory only.
 */
export function readFigZip(buf: Uint8Array): FigZip {
  if (buf.length > MAX_ARCHIVE_BYTES) {
    throw new FigZipError(
      `archive is ${buf.length} bytes, over the ${MAX_ARCHIVE_BYTES}-byte limit`
    );
  }
  if (buf.length < EOCD_MIN) throw new FigZipError('not a ZIP archive: too short');

  const eocd = findEocd(buf);
  const diskNum = u16(buf, eocd + 4);
  const cdDisk = u16(buf, eocd + 6);
  const count = u16(buf, eocd + 10);
  const cdSize = u32(buf, eocd + 12);
  const cdOffset = u32(buf, eocd + 16);

  if (diskNum !== 0 || cdDisk !== 0) {
    throw new FigZipError('multi-disk ZIP archives are not supported');
  }
  if (count === ZIP64_SENTINEL || cdSize === ZIP64_SENTINEL || cdOffset === ZIP64_SENTINEL) {
    throw new FigZipError('zip64 archives are not supported');
  }
  if (count > MAX_ARCHIVE_ENTRIES) {
    throw new FigZipError(
      `archive declares ${count} entries, over the ${MAX_ARCHIVE_ENTRIES} limit`
    );
  }
  if (cdOffset + cdSize > buf.length) {
    throw new FigZipError('central directory extends past the end of the archive');
  }

  const entries: FigZipEntry[] = [];
  let o = cdOffset;
  for (let i = 0; i < count; i++) {
    if (o + 46 > buf.length || u32(buf, o) !== CD_SIG) {
      throw new FigZipError(`central directory entry ${i} is malformed`);
    }
    const flags = u16(buf, o + 8);
    const method = u16(buf, o + 10);
    const crc = u32(buf, o + 16);
    const compressedSize = u32(buf, o + 20);
    const uncompressedSize = u32(buf, o + 24);
    const nameLen = u16(buf, o + 28);
    const extraLen = u16(buf, o + 30);
    const commentLen = u16(buf, o + 32);
    const localHeaderOffset = u32(buf, o + 42);

    if (flags & (FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION)) {
      throw new FigZipError('encrypted ZIP entries are not supported');
    }
    // FLAG_DATA_DESCRIPTOR is ALLOWED, and Figma's exporter does set it
    // (measured on both committed fixtures — DDR-221 D3's first draft refused
    // it from documentation and would have rejected every real file). It only
    // means the LOCAL header's crc/sizes are zeroed and the real values trail
    // the data. Harmless here: sizes and CRC are read from the central
    // directory below, and the local header is consulted ONLY for its
    // name/extra lengths to locate the data offset.
    if (compressedSize === ZIP64_SENTINEL || uncompressedSize === ZIP64_SENTINEL) {
      throw new FigZipError('zip64 entry sizes are not supported');
    }
    if (method !== METHOD_STORE && method !== METHOD_DEFLATE) {
      throw new FigZipError(`unsupported ZIP compression method ${method}`);
    }
    if (o + 46 + nameLen > buf.length) throw new FigZipError('entry name runs past the archive');

    const name = new TextDecoder('utf-8', { fatal: false }).decode(
      buf.subarray(o + 46, o + 46 + nameLen)
    );
    if (!isSafeEntryName(name)) {
      // Deliberately not echoed — it is attacker-chosen text (DDR-221 A8/F1).
      throw new FigZipError(`archive entry ${i} has an unsafe name`);
    }

    // The declared size is a CLAIM. Refuse the claim before inflating anything;
    // `get()` then verifies the delivery against it (DDR-221 D4).
    if (uncompressedSize > MAX_ENTRY_BYTES) {
      throw new FigZipError(
        `entry "${name}" declares ${uncompressedSize} bytes, over the ${MAX_ENTRY_BYTES}-byte limit`
      );
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_ENTRY_RATIO) {
      throw new FigZipError(
        `entry "${name}" declares a ${Math.round(uncompressedSize / compressedSize)}:1 compression ratio, over the ${MAX_ENTRY_RATIO}:1 limit`
      );
    }

    entries.push({ name, compressedSize, uncompressedSize, method, crc, localHeaderOffset });
    o += 46 + nameLen + extraLen + commentLen;
  }

  const byName = new Map(entries.map((e) => [e.name, e]));

  function get(name: string): Uint8Array | undefined {
    const e = byName.get(name);
    if (!e) return undefined;

    const lfh = e.localHeaderOffset;
    if (lfh + 30 > buf.length || u32(buf, lfh) !== LFH_SIG) {
      throw new FigZipError(`entry "${e.name}" has a malformed local header`);
    }
    // The local header's own name/extra lengths, NOT the central directory's:
    // they are allowed to differ, and trusting the wrong one misreads the data
    // offset.
    const start = lfh + 30 + u16(buf, lfh + 26) + u16(buf, lfh + 28);
    const end = start + e.compressedSize;
    if (end > buf.length)
      throw new FigZipError(`entry "${e.name}" runs past the end of the archive`);

    const raw = buf.subarray(start, end);
    let out: Uint8Array;
    if (e.method === METHOD_STORE) {
      out = raw;
    } else {
      // maxOutputLength is enforced BY the decompressor, so a bomb never
      // allocates (DDR-221 D4, measured). +1 makes an over-long output trip
      // the codec rather than pass a size check by exactly matching.
      try {
        out = inflateRawSync(raw, { maxOutputLength: e.uncompressedSize + 1 });
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'ERR_BUFFER_TOO_LARGE') {
          throw new FigZipError(`entry "${e.name}" inflates past its declared size`);
        }
        throw new FigZipError(`entry "${e.name}" is not valid deflate data`);
      }
    }

    if (out.length !== e.uncompressedSize) {
      throw new FigZipError(
        `entry "${e.name}" inflated to ${out.length} bytes, not the declared ${e.uncompressedSize}`
      );
    }
    if (crc32(out) !== e.crc) {
      throw new FigZipError(`entry "${e.name}" failed its CRC32 check`);
    }
    return out;
  }

  return { entries, get, has: (name: string) => byName.has(name) };
}
