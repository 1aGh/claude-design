var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// ../../../node_modules/.pnpm/y-protocols@1.0.7_yjs@13.6.30/node_modules/y-protocols/sync.js
var exports_sync = {};
__export(exports_sync, {
  writeUpdate: () => writeUpdate,
  writeSyncStep2: () => writeSyncStep2,
  writeSyncStep1: () => writeSyncStep1,
  readUpdate: () => readUpdate,
  readSyncStep2: () => readSyncStep2,
  readSyncStep1: () => readSyncStep1,
  readSyncMessage: () => readSyncMessage,
  messageYjsUpdate: () => messageYjsUpdate,
  messageYjsSyncStep2: () => messageYjsSyncStep2,
  messageYjsSyncStep1: () => messageYjsSyncStep1
});

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/math.js
var floor = Math.floor;
var min = (a, b) => a < b ? a : b;
var max = (a, b) => a > b ? a : b;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/binary.js
var BIT8 = 128;
var BIT18 = 1 << 17;
var BIT19 = 1 << 18;
var BIT20 = 1 << 19;
var BIT21 = 1 << 20;
var BIT22 = 1 << 21;
var BIT23 = 1 << 22;
var BIT24 = 1 << 23;
var BIT25 = 1 << 24;
var BIT26 = 1 << 25;
var BIT27 = 1 << 26;
var BIT28 = 1 << 27;
var BIT29 = 1 << 28;
var BIT30 = 1 << 29;
var BIT31 = 1 << 30;
var BIT32 = 1 << 31;
var BITS7 = 127;
var BITS17 = BIT18 - 1;
var BITS18 = BIT19 - 1;
var BITS19 = BIT20 - 1;
var BITS20 = BIT21 - 1;
var BITS21 = BIT22 - 1;
var BITS22 = BIT23 - 1;
var BITS23 = BIT24 - 1;
var BITS24 = BIT25 - 1;
var BITS25 = BIT26 - 1;
var BITS26 = BIT27 - 1;
var BITS27 = BIT28 - 1;
var BITS28 = BIT29 - 1;
var BITS29 = BIT30 - 1;
var BITS30 = BIT31 - 1;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/number.js
var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
var MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;
var LOWEST_INT32 = 1 << 31;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/string.js
var fromCharCode = String.fromCharCode;
var fromCodePoint = String.fromCodePoint;
var MAX_UTF16_CHARACTER = fromCharCode(65535);
var _encodeUtf8Polyfill = (str) => {
  const encodedString = unescape(encodeURIComponent(str));
  const len = encodedString.length;
  const buf = new Uint8Array(len);
  for (let i = 0;i < len; i++) {
    buf[i] = encodedString.codePointAt(i);
  }
  return buf;
};
var utf8TextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder : null;
var _encodeUtf8Native = (str) => utf8TextEncoder.encode(str);
var encodeUtf8 = utf8TextEncoder ? _encodeUtf8Native : _encodeUtf8Polyfill;
var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
if (utf8TextDecoder && utf8TextDecoder.decode(new Uint8Array).length === 1) {
  utf8TextDecoder = null;
}

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/encoding.js
var write = (encoder, num) => {
  const bufferLen = encoder.cbuf.length;
  if (encoder.cpos === bufferLen) {
    encoder.bufs.push(encoder.cbuf);
    encoder.cbuf = new Uint8Array(bufferLen * 2);
    encoder.cpos = 0;
  }
  encoder.cbuf[encoder.cpos++] = num;
};
var writeVarUint = (encoder, num) => {
  while (num > BITS7) {
    write(encoder, BIT8 | BITS7 & num);
    num = floor(num / 128);
  }
  write(encoder, BITS7 & num);
};
var _strBuffer = new Uint8Array(30000);
var _maxStrBSize = _strBuffer.length / 3;
var _writeVarStringNative = (encoder, str) => {
  if (str.length < _maxStrBSize) {
    const written = utf8TextEncoder.encodeInto(str, _strBuffer).written || 0;
    writeVarUint(encoder, written);
    for (let i = 0;i < written; i++) {
      write(encoder, _strBuffer[i]);
    }
  } else {
    writeVarUint8Array(encoder, encodeUtf8(str));
  }
};
var _writeVarStringPolyfill = (encoder, str) => {
  const encodedString = unescape(encodeURIComponent(str));
  const len = encodedString.length;
  writeVarUint(encoder, len);
  for (let i = 0;i < len; i++) {
    write(encoder, encodedString.codePointAt(i));
  }
};
var writeVarString = utf8TextEncoder && utf8TextEncoder.encodeInto ? _writeVarStringNative : _writeVarStringPolyfill;
var writeUint8Array = (encoder, uint8Array) => {
  const bufferLen = encoder.cbuf.length;
  const cpos = encoder.cpos;
  const leftCopyLen = min(bufferLen - cpos, uint8Array.length);
  const rightCopyLen = uint8Array.length - leftCopyLen;
  encoder.cbuf.set(uint8Array.subarray(0, leftCopyLen), cpos);
  encoder.cpos += leftCopyLen;
  if (rightCopyLen > 0) {
    encoder.bufs.push(encoder.cbuf);
    encoder.cbuf = new Uint8Array(max(bufferLen * 2, rightCopyLen));
    encoder.cbuf.set(uint8Array.subarray(leftCopyLen));
    encoder.cpos = rightCopyLen;
  }
};
var writeVarUint8Array = (encoder, uint8Array) => {
  writeVarUint(encoder, uint8Array.byteLength);
  writeUint8Array(encoder, uint8Array);
};
var floatTestBed = new DataView(new ArrayBuffer(4));

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/error.js
var create2 = (s) => new Error(s);

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/decoding.js
var errorUnexpectedEndOfArray = create2("Unexpected end of array");
var errorIntegerOutOfRange = create2("Integer out of Range");
var readUint8Array = (decoder, len) => {
  const view = new Uint8Array(decoder.arr.buffer, decoder.pos + decoder.arr.byteOffset, len);
  decoder.pos += len;
  return view;
};
var readVarUint8Array = (decoder) => readUint8Array(decoder, readVarUint(decoder));
var readVarUint = (decoder) => {
  let num = 0;
  let mult = 1;
  const len = decoder.arr.length;
  while (decoder.pos < len) {
    const r = decoder.arr[decoder.pos++];
    num = num + (r & BITS7) * mult;
    mult *= 128;
    if (r < BIT8) {
      return num;
    }
    if (num > MAX_SAFE_INTEGER) {
      throw errorIntegerOutOfRange;
    }
  }
  throw errorUnexpectedEndOfArray;
};

// ../../../node_modules/.pnpm/y-protocols@1.0.7_yjs@13.6.30/node_modules/y-protocols/sync.js
import * as Y from "yjs";
var messageYjsSyncStep1 = 0;
var messageYjsSyncStep2 = 1;
var messageYjsUpdate = 2;
var writeSyncStep1 = (encoder, doc) => {
  writeVarUint(encoder, messageYjsSyncStep1);
  const sv = Y.encodeStateVector(doc);
  writeVarUint8Array(encoder, sv);
};
var writeSyncStep2 = (encoder, doc, encodedStateVector) => {
  writeVarUint(encoder, messageYjsSyncStep2);
  writeVarUint8Array(encoder, Y.encodeStateAsUpdate(doc, encodedStateVector));
};
var readSyncStep1 = (decoder, encoder, doc) => writeSyncStep2(encoder, doc, readVarUint8Array(decoder));
var readSyncStep2 = (decoder, doc, transactionOrigin, errorHandler) => {
  try {
    Y.applyUpdate(doc, readVarUint8Array(decoder), transactionOrigin);
  } catch (error) {
    if (errorHandler != null)
      errorHandler(error);
    console.error("Caught error while handling a Yjs update", error);
  }
};
var writeUpdate = (encoder, update) => {
  writeVarUint(encoder, messageYjsUpdate);
  writeVarUint8Array(encoder, update);
};
var readUpdate = readSyncStep2;
var readSyncMessage = (decoder, encoder, doc, transactionOrigin, errorHandler) => {
  const messageType = readVarUint(decoder);
  switch (messageType) {
    case messageYjsSyncStep1:
      readSyncStep1(decoder, encoder, doc);
      break;
    case messageYjsSyncStep2:
      readSyncStep2(decoder, doc, transactionOrigin, errorHandler);
      break;
    case messageYjsUpdate:
      readUpdate(decoder, doc, transactionOrigin, errorHandler);
      break;
    default:
      throw new Error("Unknown message type");
  }
  return messageType;
};

// synth:/Volumes/D/git/claude-design/plugins/design/dev-server/.runtime-bundle-y-protocols_sync-entry.tsx
var {
  messageYjsSyncStep1: messageYjsSyncStep12,
  messageYjsSyncStep2: messageYjsSyncStep22,
  messageYjsUpdate: messageYjsUpdate2,
  readSyncMessage: readSyncMessage2,
  readSyncStep1: readSyncStep12,
  readSyncStep2: readSyncStep22,
  readUpdate: readUpdate2,
  writeSyncStep1: writeSyncStep12,
  writeSyncStep2: writeSyncStep22,
  writeUpdate: writeUpdate2
} = exports_sync;
var __runtime_bundle_y_protocols_sync_entry_default = exports_sync;
export {
  writeUpdate2 as writeUpdate,
  writeSyncStep22 as writeSyncStep2,
  writeSyncStep12 as writeSyncStep1,
  readUpdate2 as readUpdate,
  readSyncStep22 as readSyncStep2,
  readSyncStep12 as readSyncStep1,
  readSyncMessage2 as readSyncMessage,
  messageYjsUpdate2 as messageYjsUpdate,
  messageYjsSyncStep22 as messageYjsSyncStep2,
  messageYjsSyncStep12 as messageYjsSyncStep1,
  __runtime_bundle_y_protocols_sync_entry_default as default
};
