// _import-asset-pdf-worker.mjs — isolated worker for pdf-lib page-count
// discovery (DDR-167 Decision 2, step 2).
//
// A bare `Promise.race` timeout cannot interrupt a synchronous, CPU-bound,
// single-threaded call — the event loop is blocked by the hang itself, so a
// timer callback never gets a turn to fire. `pdf-lib`'s hand-rolled tokenizer
// can in principle hang on pathological malformed input, so this parse runs
// in its OWN worker thread, which the caller can `.terminate()` from outside
// regardless of what this thread's own event loop is doing.
//
// Never executes embedded JavaScript or resolves embedded remote references —
// `PDFDocument.load` is a structural PDF-object parser, not a renderer. The
// isolation here is about hang-safety, not content-safety.

import { parentPort, workerData } from 'node:worker_threads';
import { PDFDocument } from 'pdf-lib';

async function main() {
  try {
    const bytes = new Uint8Array(workerData.buffer);
    const doc = await PDFDocument.load(bytes, {
      // Never attempt to resolve/repair encrypted or malformed structure —
      // fail loud rather than silently coping with adversarial input.
      ignoreEncryption: false,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
    parentPort.postMessage({ ok: true, pageCount: doc.getPageCount() });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: String(err?.message ?? err) });
  }
}

main();
