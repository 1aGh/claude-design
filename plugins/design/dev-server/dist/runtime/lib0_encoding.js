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

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/encoding.js
var exports_encoding = {};
__export(exports_encoding, {
  writeVarUint8Array: () => writeVarUint8Array,
  writeVarUint: () => writeVarUint,
  writeVarString: () => writeVarString,
  writeVarInt: () => writeVarInt,
  writeUint8Array: () => writeUint8Array,
  writeUint8: () => writeUint8,
  writeUint32BigEndian: () => writeUint32BigEndian,
  writeUint32: () => writeUint32,
  writeUint16: () => writeUint16,
  writeTerminatedUint8Array: () => writeTerminatedUint8Array,
  writeTerminatedString: () => writeTerminatedString,
  writeOnDataView: () => writeOnDataView,
  writeFloat64: () => writeFloat64,
  writeFloat32: () => writeFloat32,
  writeBinaryEncoder: () => writeBinaryEncoder,
  writeBigUint64: () => writeBigUint64,
  writeBigInt64: () => writeBigInt64,
  writeAny: () => writeAny,
  write: () => write,
  verifyLen: () => verifyLen,
  toUint8Array: () => toUint8Array,
  setUint8: () => setUint8,
  setUint32: () => setUint32,
  setUint16: () => setUint16,
  set: () => set,
  length: () => length,
  hasContent: () => hasContent,
  encode: () => encode,
  createEncoder: () => createEncoder,
  _writeVarStringPolyfill: () => _writeVarStringPolyfill,
  _writeVarStringNative: () => _writeVarStringNative,
  UintOptRleEncoder: () => UintOptRleEncoder,
  StringEncoder: () => StringEncoder,
  RleIntDiffEncoder: () => RleIntDiffEncoder,
  RleEncoder: () => RleEncoder,
  IntDiffOptRleEncoder: () => IntDiffOptRleEncoder,
  IntDiffEncoder: () => IntDiffEncoder,
  IncUintOptRleEncoder: () => IncUintOptRleEncoder,
  Encoder: () => Encoder
});

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/math.js
var floor = Math.floor;
var abs = Math.abs;
var min = (a, b) => a < b ? a : b;
var max = (a, b) => a > b ? a : b;
var isNegativeZero = (n) => n !== 0 ? n < 0 : 1 / n < 0;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/binary.js
var BIT7 = 64;
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
var BITS6 = 63;
var BITS7 = 127;
var BITS8 = 255;
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
var BITS31 = 2147483647;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/number.js
var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
var MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;
var LOWEST_INT32 = 1 << 31;
var isInteger = Number.isInteger || ((num) => typeof num === "number" && isFinite(num) && floor(num) === num);

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/array.js
var isArray = Array.isArray;

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
class Encoder {
  constructor() {
    this.cpos = 0;
    this.cbuf = new Uint8Array(100);
    this.bufs = [];
  }
}
var createEncoder = () => new Encoder;
var encode = (f) => {
  const encoder = createEncoder();
  f(encoder);
  return toUint8Array(encoder);
};
var length = (encoder) => {
  let len = encoder.cpos;
  for (let i = 0;i < encoder.bufs.length; i++) {
    len += encoder.bufs[i].length;
  }
  return len;
};
var hasContent = (encoder) => encoder.cpos > 0 || encoder.bufs.length > 0;
var toUint8Array = (encoder) => {
  const uint8arr = new Uint8Array(length(encoder));
  let curPos = 0;
  for (let i = 0;i < encoder.bufs.length; i++) {
    const d = encoder.bufs[i];
    uint8arr.set(d, curPos);
    curPos += d.length;
  }
  uint8arr.set(new Uint8Array(encoder.cbuf.buffer, 0, encoder.cpos), curPos);
  return uint8arr;
};
var verifyLen = (encoder, len) => {
  const bufferLen = encoder.cbuf.length;
  if (bufferLen - encoder.cpos < len) {
    encoder.bufs.push(new Uint8Array(encoder.cbuf.buffer, 0, encoder.cpos));
    encoder.cbuf = new Uint8Array(max(bufferLen, len) * 2);
    encoder.cpos = 0;
  }
};
var write = (encoder, num) => {
  const bufferLen = encoder.cbuf.length;
  if (encoder.cpos === bufferLen) {
    encoder.bufs.push(encoder.cbuf);
    encoder.cbuf = new Uint8Array(bufferLen * 2);
    encoder.cpos = 0;
  }
  encoder.cbuf[encoder.cpos++] = num;
};
var set = (encoder, pos, num) => {
  let buffer = null;
  for (let i = 0;i < encoder.bufs.length && buffer === null; i++) {
    const b = encoder.bufs[i];
    if (pos < b.length) {
      buffer = b;
    } else {
      pos -= b.length;
    }
  }
  if (buffer === null) {
    buffer = encoder.cbuf;
  }
  buffer[pos] = num;
};
var writeUint8 = write;
var setUint8 = set;
var writeUint16 = (encoder, num) => {
  write(encoder, num & BITS8);
  write(encoder, num >>> 8 & BITS8);
};
var setUint16 = (encoder, pos, num) => {
  set(encoder, pos, num & BITS8);
  set(encoder, pos + 1, num >>> 8 & BITS8);
};
var writeUint32 = (encoder, num) => {
  for (let i = 0;i < 4; i++) {
    write(encoder, num & BITS8);
    num >>>= 8;
  }
};
var writeUint32BigEndian = (encoder, num) => {
  for (let i = 3;i >= 0; i--) {
    write(encoder, num >>> 8 * i & BITS8);
  }
};
var setUint32 = (encoder, pos, num) => {
  for (let i = 0;i < 4; i++) {
    set(encoder, pos + i, num & BITS8);
    num >>>= 8;
  }
};
var writeVarUint = (encoder, num) => {
  while (num > BITS7) {
    write(encoder, BIT8 | BITS7 & num);
    num = floor(num / 128);
  }
  write(encoder, BITS7 & num);
};
var writeVarInt = (encoder, num) => {
  const isNegative = isNegativeZero(num);
  if (isNegative) {
    num = -num;
  }
  write(encoder, (num > BITS6 ? BIT8 : 0) | (isNegative ? BIT7 : 0) | BITS6 & num);
  num = floor(num / 64);
  while (num > 0) {
    write(encoder, (num > BITS7 ? BIT8 : 0) | BITS7 & num);
    num = floor(num / 128);
  }
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
var writeTerminatedString = (encoder, str) => writeTerminatedUint8Array(encoder, encodeUtf8(str));
var writeTerminatedUint8Array = (encoder, buf) => {
  for (let i = 0;i < buf.length; i++) {
    const b = buf[i];
    if (b === 0 || b === 1) {
      write(encoder, 1);
    }
    write(encoder, buf[i]);
  }
  write(encoder, 0);
};
var writeBinaryEncoder = (encoder, append) => writeUint8Array(encoder, toUint8Array(append));
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
var writeOnDataView = (encoder, len) => {
  verifyLen(encoder, len);
  const dview = new DataView(encoder.cbuf.buffer, encoder.cpos, len);
  encoder.cpos += len;
  return dview;
};
var writeFloat32 = (encoder, num) => writeOnDataView(encoder, 4).setFloat32(0, num, false);
var writeFloat64 = (encoder, num) => writeOnDataView(encoder, 8).setFloat64(0, num, false);
var writeBigInt64 = (encoder, num) => writeOnDataView(encoder, 8).setBigInt64(0, num, false);
var writeBigUint64 = (encoder, num) => writeOnDataView(encoder, 8).setBigUint64(0, num, false);
var floatTestBed = new DataView(new ArrayBuffer(4));
var isFloat32 = (num) => {
  floatTestBed.setFloat32(0, num);
  return floatTestBed.getFloat32(0) === num;
};
var writeAny = (encoder, data) => {
  switch (typeof data) {
    case "string":
      write(encoder, 119);
      writeVarString(encoder, data);
      break;
    case "number":
      if (isInteger(data) && abs(data) <= BITS31) {
        write(encoder, 125);
        writeVarInt(encoder, data);
      } else if (isFloat32(data)) {
        write(encoder, 124);
        writeFloat32(encoder, data);
      } else {
        write(encoder, 123);
        writeFloat64(encoder, data);
      }
      break;
    case "bigint":
      write(encoder, 122);
      writeBigInt64(encoder, data);
      break;
    case "object":
      if (data === null) {
        write(encoder, 126);
      } else if (isArray(data)) {
        write(encoder, 117);
        writeVarUint(encoder, data.length);
        for (let i = 0;i < data.length; i++) {
          writeAny(encoder, data[i]);
        }
      } else if (data instanceof Uint8Array) {
        write(encoder, 116);
        writeVarUint8Array(encoder, data);
      } else {
        write(encoder, 118);
        const keys = Object.keys(data);
        writeVarUint(encoder, keys.length);
        for (let i = 0;i < keys.length; i++) {
          const key = keys[i];
          writeVarString(encoder, key);
          writeAny(encoder, data[key]);
        }
      }
      break;
    case "boolean":
      write(encoder, data ? 120 : 121);
      break;
    default:
      write(encoder, 127);
  }
};

class RleEncoder extends Encoder {
  constructor(writer) {
    super();
    this.w = writer;
    this.s = null;
    this.count = 0;
  }
  write(v) {
    if (this.s === v) {
      this.count++;
    } else {
      if (this.count > 0) {
        writeVarUint(this, this.count - 1);
      }
      this.count = 1;
      this.w(this, v);
      this.s = v;
    }
  }
}

class IntDiffEncoder extends Encoder {
  constructor(start) {
    super();
    this.s = start;
  }
  write(v) {
    writeVarInt(this, v - this.s);
    this.s = v;
  }
}

class RleIntDiffEncoder extends Encoder {
  constructor(start) {
    super();
    this.s = start;
    this.count = 0;
  }
  write(v) {
    if (this.s === v && this.count > 0) {
      this.count++;
    } else {
      if (this.count > 0) {
        writeVarUint(this, this.count - 1);
      }
      this.count = 1;
      writeVarInt(this, v - this.s);
      this.s = v;
    }
  }
}
var flushUintOptRleEncoder = (encoder) => {
  if (encoder.count > 0) {
    writeVarInt(encoder.encoder, encoder.count === 1 ? encoder.s : -encoder.s);
    if (encoder.count > 1) {
      writeVarUint(encoder.encoder, encoder.count - 2);
    }
  }
};

class UintOptRleEncoder {
  constructor() {
    this.encoder = new Encoder;
    this.s = 0;
    this.count = 0;
  }
  write(v) {
    if (this.s === v) {
      this.count++;
    } else {
      flushUintOptRleEncoder(this);
      this.count = 1;
      this.s = v;
    }
  }
  toUint8Array() {
    flushUintOptRleEncoder(this);
    return toUint8Array(this.encoder);
  }
}

class IncUintOptRleEncoder {
  constructor() {
    this.encoder = new Encoder;
    this.s = 0;
    this.count = 0;
  }
  write(v) {
    if (this.s + this.count === v) {
      this.count++;
    } else {
      flushUintOptRleEncoder(this);
      this.count = 1;
      this.s = v;
    }
  }
  toUint8Array() {
    flushUintOptRleEncoder(this);
    return toUint8Array(this.encoder);
  }
}
var flushIntDiffOptRleEncoder = (encoder) => {
  if (encoder.count > 0) {
    const encodedDiff = encoder.diff * 2 + (encoder.count === 1 ? 0 : 1);
    writeVarInt(encoder.encoder, encodedDiff);
    if (encoder.count > 1) {
      writeVarUint(encoder.encoder, encoder.count - 2);
    }
  }
};

class IntDiffOptRleEncoder {
  constructor() {
    this.encoder = new Encoder;
    this.s = 0;
    this.count = 0;
    this.diff = 0;
  }
  write(v) {
    if (this.diff === v - this.s) {
      this.s = v;
      this.count++;
    } else {
      flushIntDiffOptRleEncoder(this);
      this.count = 1;
      this.diff = v - this.s;
      this.s = v;
    }
  }
  toUint8Array() {
    flushIntDiffOptRleEncoder(this);
    return toUint8Array(this.encoder);
  }
}

class StringEncoder {
  constructor() {
    this.sarr = [];
    this.s = "";
    this.lensE = new UintOptRleEncoder;
  }
  write(string) {
    this.s += string;
    if (this.s.length > 19) {
      this.sarr.push(this.s);
      this.s = "";
    }
    this.lensE.write(string.length);
  }
  toUint8Array() {
    const encoder = new Encoder;
    this.sarr.push(this.s);
    this.s = "";
    writeVarString(encoder, this.sarr.join(""));
    writeUint8Array(encoder, this.lensE.toUint8Array());
    return toUint8Array(encoder);
  }
}

// synth:/Users/iagh/git/claude-design/plugins/design/dev-server/.runtime-bundle-lib0_encoding-entry.tsx
var {
  Encoder: Encoder2,
  IncUintOptRleEncoder: IncUintOptRleEncoder2,
  IntDiffEncoder: IntDiffEncoder2,
  IntDiffOptRleEncoder: IntDiffOptRleEncoder2,
  RleEncoder: RleEncoder2,
  RleIntDiffEncoder: RleIntDiffEncoder2,
  StringEncoder: StringEncoder2,
  UintOptRleEncoder: UintOptRleEncoder2,
  _writeVarStringNative: _writeVarStringNative2,
  _writeVarStringPolyfill: _writeVarStringPolyfill2,
  createEncoder: createEncoder2,
  encode: encode2,
  hasContent: hasContent2,
  length: length2,
  set: set2,
  setUint16: setUint162,
  setUint32: setUint322,
  setUint8: setUint82,
  toUint8Array: toUint8Array2,
  verifyLen: verifyLen2,
  write: write2,
  writeAny: writeAny2,
  writeBigInt64: writeBigInt642,
  writeBigUint64: writeBigUint642,
  writeBinaryEncoder: writeBinaryEncoder2,
  writeFloat32: writeFloat322,
  writeFloat64: writeFloat642,
  writeOnDataView: writeOnDataView2,
  writeTerminatedString: writeTerminatedString2,
  writeTerminatedUint8Array: writeTerminatedUint8Array2,
  writeUint16: writeUint162,
  writeUint32: writeUint322,
  writeUint32BigEndian: writeUint32BigEndian2,
  writeUint8: writeUint82,
  writeUint8Array: writeUint8Array2,
  writeVarInt: writeVarInt2,
  writeVarString: writeVarString2,
  writeVarUint: writeVarUint2,
  writeVarUint8Array: writeVarUint8Array2
} = exports_encoding;
var __runtime_bundle_lib0_encoding_entry_default = exports_encoding;
export {
  writeVarUint8Array2 as writeVarUint8Array,
  writeVarUint2 as writeVarUint,
  writeVarString2 as writeVarString,
  writeVarInt2 as writeVarInt,
  writeUint8Array2 as writeUint8Array,
  writeUint82 as writeUint8,
  writeUint32BigEndian2 as writeUint32BigEndian,
  writeUint322 as writeUint32,
  writeUint162 as writeUint16,
  writeTerminatedUint8Array2 as writeTerminatedUint8Array,
  writeTerminatedString2 as writeTerminatedString,
  writeOnDataView2 as writeOnDataView,
  writeFloat642 as writeFloat64,
  writeFloat322 as writeFloat32,
  writeBinaryEncoder2 as writeBinaryEncoder,
  writeBigUint642 as writeBigUint64,
  writeBigInt642 as writeBigInt64,
  writeAny2 as writeAny,
  write2 as write,
  verifyLen2 as verifyLen,
  toUint8Array2 as toUint8Array,
  setUint82 as setUint8,
  setUint322 as setUint32,
  setUint162 as setUint16,
  set2 as set,
  length2 as length,
  hasContent2 as hasContent,
  encode2 as encode,
  __runtime_bundle_lib0_encoding_entry_default as default,
  createEncoder2 as createEncoder,
  _writeVarStringPolyfill2 as _writeVarStringPolyfill,
  _writeVarStringNative2 as _writeVarStringNative,
  UintOptRleEncoder2 as UintOptRleEncoder,
  StringEncoder2 as StringEncoder,
  RleIntDiffEncoder2 as RleIntDiffEncoder,
  RleEncoder2 as RleEncoder,
  IntDiffOptRleEncoder2 as IntDiffOptRleEncoder,
  IntDiffEncoder2 as IntDiffEncoder,
  IncUintOptRleEncoder2 as IncUintOptRleEncoder,
  Encoder2 as Encoder
};
