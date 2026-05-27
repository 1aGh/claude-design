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

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/decoding.js
var exports_decoding = {};
__export(exports_decoding, {
  skip8: () => skip8,
  readVarUint8Array: () => readVarUint8Array,
  readVarUint: () => readVarUint,
  readVarString: () => readVarString,
  readVarInt: () => readVarInt,
  readUint8Array: () => readUint8Array,
  readUint8: () => readUint8,
  readUint32BigEndian: () => readUint32BigEndian,
  readUint32: () => readUint32,
  readUint16: () => readUint16,
  readTerminatedUint8Array: () => readTerminatedUint8Array,
  readTerminatedString: () => readTerminatedString,
  readTailAsUint8Array: () => readTailAsUint8Array,
  readFromDataView: () => readFromDataView,
  readFloat64: () => readFloat64,
  readFloat32: () => readFloat32,
  readBigUint64: () => readBigUint64,
  readBigInt64: () => readBigInt64,
  readAny: () => readAny,
  peekVarUint: () => peekVarUint,
  peekVarString: () => peekVarString,
  peekVarInt: () => peekVarInt,
  peekUint8: () => peekUint8,
  peekUint32: () => peekUint32,
  peekUint16: () => peekUint16,
  hasContent: () => hasContent,
  createDecoder: () => createDecoder,
  clone: () => clone,
  _readVarStringPolyfill: () => _readVarStringPolyfill,
  _readVarStringNative: () => _readVarStringNative,
  UintOptRleDecoder: () => UintOptRleDecoder,
  StringDecoder: () => StringDecoder,
  RleIntDiffDecoder: () => RleIntDiffDecoder,
  RleDecoder: () => RleDecoder,
  IntDiffOptRleDecoder: () => IntDiffOptRleDecoder,
  IntDiffDecoder: () => IntDiffDecoder,
  IncUintOptRleDecoder: () => IncUintOptRleDecoder,
  Decoder: () => Decoder
});

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

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/math.js
var floor = Math.floor;
var min = (a, b) => a < b ? a : b;
var max = (a, b) => a > b ? a : b;
var isNegativeZero = (n) => n !== 0 ? n < 0 : 1 / n < 0;

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
var _decodeUtf8Polyfill = (buf) => {
  let remainingLen = buf.length;
  let encodedString = "";
  let bufPos = 0;
  while (remainingLen > 0) {
    const nextLen = remainingLen < 1e4 ? remainingLen : 1e4;
    const bytes = buf.subarray(bufPos, bufPos + nextLen);
    bufPos += nextLen;
    encodedString += String.fromCodePoint.apply(null, bytes);
    remainingLen -= nextLen;
  }
  return decodeURIComponent(escape(encodedString));
};
var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
if (utf8TextDecoder && utf8TextDecoder.decode(new Uint8Array).length === 1) {
  utf8TextDecoder = null;
}
var _decodeUtf8Native = (buf) => utf8TextDecoder.decode(buf);
var decodeUtf8 = utf8TextDecoder ? _decodeUtf8Native : _decodeUtf8Polyfill;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/error.js
var create2 = (s) => new Error(s);

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/encoding.js
class Encoder {
  constructor() {
    this.cpos = 0;
    this.cbuf = new Uint8Array(100);
    this.bufs = [];
  }
}
var createEncoder = () => new Encoder;
var length = (encoder) => {
  let len = encoder.cpos;
  for (let i = 0;i < encoder.bufs.length; i++) {
    len += encoder.bufs[i].length;
  }
  return len;
};
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

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/decoding.js
var errorUnexpectedEndOfArray = create2("Unexpected end of array");
var errorIntegerOutOfRange = create2("Integer out of Range");

class Decoder {
  constructor(uint8Array) {
    this.arr = uint8Array;
    this.pos = 0;
  }
}
var createDecoder = (uint8Array) => new Decoder(uint8Array);
var hasContent = (decoder) => decoder.pos !== decoder.arr.length;
var clone = (decoder, newPos = decoder.pos) => {
  const _decoder = createDecoder(decoder.arr);
  _decoder.pos = newPos;
  return _decoder;
};
var readUint8Array = (decoder, len) => {
  const view = new Uint8Array(decoder.arr.buffer, decoder.pos + decoder.arr.byteOffset, len);
  decoder.pos += len;
  return view;
};
var readVarUint8Array = (decoder) => readUint8Array(decoder, readVarUint(decoder));
var readTailAsUint8Array = (decoder) => readUint8Array(decoder, decoder.arr.length - decoder.pos);
var skip8 = (decoder) => decoder.pos++;
var readUint8 = (decoder) => decoder.arr[decoder.pos++];
var readUint16 = (decoder) => {
  const uint = decoder.arr[decoder.pos] + (decoder.arr[decoder.pos + 1] << 8);
  decoder.pos += 2;
  return uint;
};
var readUint32 = (decoder) => {
  const uint = decoder.arr[decoder.pos] + (decoder.arr[decoder.pos + 1] << 8) + (decoder.arr[decoder.pos + 2] << 16) + (decoder.arr[decoder.pos + 3] << 24) >>> 0;
  decoder.pos += 4;
  return uint;
};
var readUint32BigEndian = (decoder) => {
  const uint = decoder.arr[decoder.pos + 3] + (decoder.arr[decoder.pos + 2] << 8) + (decoder.arr[decoder.pos + 1] << 16) + (decoder.arr[decoder.pos] << 24) >>> 0;
  decoder.pos += 4;
  return uint;
};
var peekUint8 = (decoder) => decoder.arr[decoder.pos];
var peekUint16 = (decoder) => decoder.arr[decoder.pos] + (decoder.arr[decoder.pos + 1] << 8);
var peekUint32 = (decoder) => decoder.arr[decoder.pos] + (decoder.arr[decoder.pos + 1] << 8) + (decoder.arr[decoder.pos + 2] << 16) + (decoder.arr[decoder.pos + 3] << 24) >>> 0;
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
var readVarInt = (decoder) => {
  let r = decoder.arr[decoder.pos++];
  let num = r & BITS6;
  let mult = 64;
  const sign = (r & BIT7) > 0 ? -1 : 1;
  if ((r & BIT8) === 0) {
    return sign * num;
  }
  const len = decoder.arr.length;
  while (decoder.pos < len) {
    r = decoder.arr[decoder.pos++];
    num = num + (r & BITS7) * mult;
    mult *= 128;
    if (r < BIT8) {
      return sign * num;
    }
    if (num > MAX_SAFE_INTEGER) {
      throw errorIntegerOutOfRange;
    }
  }
  throw errorUnexpectedEndOfArray;
};
var peekVarUint = (decoder) => {
  const pos = decoder.pos;
  const s = readVarUint(decoder);
  decoder.pos = pos;
  return s;
};
var peekVarInt = (decoder) => {
  const pos = decoder.pos;
  const s = readVarInt(decoder);
  decoder.pos = pos;
  return s;
};
var _readVarStringPolyfill = (decoder) => {
  let remainingLen = readVarUint(decoder);
  if (remainingLen === 0) {
    return "";
  } else {
    let encodedString = String.fromCodePoint(readUint8(decoder));
    if (--remainingLen < 100) {
      while (remainingLen--) {
        encodedString += String.fromCodePoint(readUint8(decoder));
      }
    } else {
      while (remainingLen > 0) {
        const nextLen = remainingLen < 1e4 ? remainingLen : 1e4;
        const bytes = decoder.arr.subarray(decoder.pos, decoder.pos + nextLen);
        decoder.pos += nextLen;
        encodedString += String.fromCodePoint.apply(null, bytes);
        remainingLen -= nextLen;
      }
    }
    return decodeURIComponent(escape(encodedString));
  }
};
var _readVarStringNative = (decoder) => utf8TextDecoder.decode(readVarUint8Array(decoder));
var readVarString = utf8TextDecoder ? _readVarStringNative : _readVarStringPolyfill;
var readTerminatedUint8Array = (decoder) => {
  const encoder = createEncoder();
  let b;
  while (true) {
    b = readUint8(decoder);
    if (b === 0) {
      return toUint8Array(encoder);
    }
    if (b === 1) {
      b = readUint8(decoder);
    }
    write(encoder, b);
  }
};
var readTerminatedString = (decoder) => decodeUtf8(readTerminatedUint8Array(decoder));
var peekVarString = (decoder) => {
  const pos = decoder.pos;
  const s = readVarString(decoder);
  decoder.pos = pos;
  return s;
};
var readFromDataView = (decoder, len) => {
  const dv = new DataView(decoder.arr.buffer, decoder.arr.byteOffset + decoder.pos, len);
  decoder.pos += len;
  return dv;
};
var readFloat32 = (decoder) => readFromDataView(decoder, 4).getFloat32(0, false);
var readFloat64 = (decoder) => readFromDataView(decoder, 8).getFloat64(0, false);
var readBigInt64 = (decoder) => readFromDataView(decoder, 8).getBigInt64(0, false);
var readBigUint64 = (decoder) => readFromDataView(decoder, 8).getBigUint64(0, false);
var readAnyLookupTable = [
  (decoder) => {
    return;
  },
  (decoder) => null,
  readVarInt,
  readFloat32,
  readFloat64,
  readBigInt64,
  (decoder) => false,
  (decoder) => true,
  readVarString,
  (decoder) => {
    const len = readVarUint(decoder);
    const obj = {};
    for (let i = 0;i < len; i++) {
      const key = readVarString(decoder);
      obj[key] = readAny(decoder);
    }
    return obj;
  },
  (decoder) => {
    const len = readVarUint(decoder);
    const arr = [];
    for (let i = 0;i < len; i++) {
      arr.push(readAny(decoder));
    }
    return arr;
  },
  readVarUint8Array
];
var readAny = (decoder) => readAnyLookupTable[127 - readUint8(decoder)](decoder);

class RleDecoder extends Decoder {
  constructor(uint8Array, reader) {
    super(uint8Array);
    this.reader = reader;
    this.s = null;
    this.count = 0;
  }
  read() {
    if (this.count === 0) {
      this.s = this.reader(this);
      if (hasContent(this)) {
        this.count = readVarUint(this) + 1;
      } else {
        this.count = -1;
      }
    }
    this.count--;
    return this.s;
  }
}

class IntDiffDecoder extends Decoder {
  constructor(uint8Array, start) {
    super(uint8Array);
    this.s = start;
  }
  read() {
    this.s += readVarInt(this);
    return this.s;
  }
}

class RleIntDiffDecoder extends Decoder {
  constructor(uint8Array, start) {
    super(uint8Array);
    this.s = start;
    this.count = 0;
  }
  read() {
    if (this.count === 0) {
      this.s += readVarInt(this);
      if (hasContent(this)) {
        this.count = readVarUint(this) + 1;
      } else {
        this.count = -1;
      }
    }
    this.count--;
    return this.s;
  }
}

class UintOptRleDecoder extends Decoder {
  constructor(uint8Array) {
    super(uint8Array);
    this.s = 0;
    this.count = 0;
  }
  read() {
    if (this.count === 0) {
      this.s = readVarInt(this);
      const isNegative = isNegativeZero(this.s);
      this.count = 1;
      if (isNegative) {
        this.s = -this.s;
        this.count = readVarUint(this) + 2;
      }
    }
    this.count--;
    return this.s;
  }
}

class IncUintOptRleDecoder extends Decoder {
  constructor(uint8Array) {
    super(uint8Array);
    this.s = 0;
    this.count = 0;
  }
  read() {
    if (this.count === 0) {
      this.s = readVarInt(this);
      const isNegative = isNegativeZero(this.s);
      this.count = 1;
      if (isNegative) {
        this.s = -this.s;
        this.count = readVarUint(this) + 2;
      }
    }
    this.count--;
    return this.s++;
  }
}

class IntDiffOptRleDecoder extends Decoder {
  constructor(uint8Array) {
    super(uint8Array);
    this.s = 0;
    this.count = 0;
    this.diff = 0;
  }
  read() {
    if (this.count === 0) {
      const diff = readVarInt(this);
      const hasCount = diff & 1;
      this.diff = floor(diff / 2);
      this.count = 1;
      if (hasCount) {
        this.count = readVarUint(this) + 2;
      }
    }
    this.s += this.diff;
    this.count--;
    return this.s;
  }
}

class StringDecoder {
  constructor(uint8Array) {
    this.decoder = new UintOptRleDecoder(uint8Array);
    this.str = readVarString(this.decoder);
    this.spos = 0;
  }
  read() {
    const end = this.spos + this.decoder.read();
    const res = this.str.slice(this.spos, end);
    this.spos = end;
    return res;
  }
}

// synth:/Users/iagh/git/claude-design/plugins/design/dev-server/.runtime-bundle-lib0_decoding-entry.tsx
var {
  Decoder: Decoder2,
  IncUintOptRleDecoder: IncUintOptRleDecoder2,
  IntDiffDecoder: IntDiffDecoder2,
  IntDiffOptRleDecoder: IntDiffOptRleDecoder2,
  RleDecoder: RleDecoder2,
  RleIntDiffDecoder: RleIntDiffDecoder2,
  StringDecoder: StringDecoder2,
  UintOptRleDecoder: UintOptRleDecoder2,
  _readVarStringNative: _readVarStringNative2,
  _readVarStringPolyfill: _readVarStringPolyfill2,
  clone: clone2,
  createDecoder: createDecoder2,
  hasContent: hasContent2,
  peekUint16: peekUint162,
  peekUint32: peekUint322,
  peekUint8: peekUint82,
  peekVarInt: peekVarInt2,
  peekVarString: peekVarString2,
  peekVarUint: peekVarUint2,
  readAny: readAny2,
  readBigInt64: readBigInt642,
  readBigUint64: readBigUint642,
  readFloat32: readFloat322,
  readFloat64: readFloat642,
  readFromDataView: readFromDataView2,
  readTailAsUint8Array: readTailAsUint8Array2,
  readTerminatedString: readTerminatedString2,
  readTerminatedUint8Array: readTerminatedUint8Array2,
  readUint16: readUint162,
  readUint32: readUint322,
  readUint32BigEndian: readUint32BigEndian2,
  readUint8: readUint82,
  readUint8Array: readUint8Array2,
  readVarInt: readVarInt2,
  readVarString: readVarString2,
  readVarUint: readVarUint2,
  readVarUint8Array: readVarUint8Array2,
  skip8: skip82
} = exports_decoding;
var __runtime_bundle_lib0_decoding_entry_default = exports_decoding;
export {
  skip82 as skip8,
  readVarUint8Array2 as readVarUint8Array,
  readVarUint2 as readVarUint,
  readVarString2 as readVarString,
  readVarInt2 as readVarInt,
  readUint8Array2 as readUint8Array,
  readUint82 as readUint8,
  readUint32BigEndian2 as readUint32BigEndian,
  readUint322 as readUint32,
  readUint162 as readUint16,
  readTerminatedUint8Array2 as readTerminatedUint8Array,
  readTerminatedString2 as readTerminatedString,
  readTailAsUint8Array2 as readTailAsUint8Array,
  readFromDataView2 as readFromDataView,
  readFloat642 as readFloat64,
  readFloat322 as readFloat32,
  readBigUint642 as readBigUint64,
  readBigInt642 as readBigInt64,
  readAny2 as readAny,
  peekVarUint2 as peekVarUint,
  peekVarString2 as peekVarString,
  peekVarInt2 as peekVarInt,
  peekUint82 as peekUint8,
  peekUint322 as peekUint32,
  peekUint162 as peekUint16,
  hasContent2 as hasContent,
  __runtime_bundle_lib0_decoding_entry_default as default,
  createDecoder2 as createDecoder,
  clone2 as clone,
  _readVarStringPolyfill2 as _readVarStringPolyfill,
  _readVarStringNative2 as _readVarStringNative,
  UintOptRleDecoder2 as UintOptRleDecoder,
  StringDecoder2 as StringDecoder,
  RleIntDiffDecoder2 as RleIntDiffDecoder,
  RleDecoder2 as RleDecoder,
  IntDiffOptRleDecoder2 as IntDiffOptRleDecoder,
  IntDiffDecoder2 as IntDiffDecoder,
  IncUintOptRleDecoder2 as IncUintOptRleDecoder,
  Decoder2 as Decoder
};
