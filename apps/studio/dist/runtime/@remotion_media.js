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

// ../../node_modules/.pnpm/@remotion+media@4.0.484_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/@remotion/media/dist/esm/index.mjs
var exports_esm = {};
__export(exports_esm, {
  getTargetSampleRate: () => getTargetSampleRate,
  experimental_Video: () => experimental_Video,
  experimental_Audio: () => experimental_Audio,
  Video: () => Video,
  AudioForPreview: () => AudioForPreview,
  Audio: () => Audio
});
import { useMemo as useMemo3, useState as useState3 } from "react";
import {
  Internals as Internals17,
  Interactive,
  Sequence,
  useRemotionEnvironment as useRemotionEnvironment2,
  useVideoConfig as useVideoConfig2
} from "remotion";
import { Internals } from "remotion";
import { useContext as useContext2, useEffect, useMemo, useRef, useState } from "react";
import {
  Internals as Internals7,
  Audio as RemotionAudio,
  useBufferState,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import { Internals as Internals2 } from "remotion";

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
function assert(x) {
  if (!x) {
    throw new Error("Assertion failed.");
  }
}
var normalizeRotation = (rotation) => {
  const mappedRotation = (rotation % 360 + 360) % 360;
  if (mappedRotation === 0 || mappedRotation === 90 || mappedRotation === 180 || mappedRotation === 270) {
    return mappedRotation;
  } else {
    throw new Error(`Invalid rotation ${rotation}.`);
  }
};
var last = (arr) => {
  return arr && arr[arr.length - 1];
};
var readExpGolomb = (bitstream) => {
  let leadingZeroBits = 0;
  while (bitstream.readBits(1) === 0 && leadingZeroBits < 32) {
    leadingZeroBits++;
  }
  if (leadingZeroBits >= 32) {
    throw new Error("Invalid exponential-Golomb code.");
  }
  const result = (1 << leadingZeroBits) - 1 + bitstream.readBits(leadingZeroBits);
  return result;
};
var readSignedExpGolomb = (bitstream) => {
  const codeNum = readExpGolomb(bitstream);
  return (codeNum & 1) === 0 ? -(codeNum >> 1) : codeNum + 1 >> 1;
};
var toUint8Array = (source) => {
  if (source.constructor === Uint8Array) {
    return source;
  } else if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  } else {
    return new Uint8Array(source);
  }
};
var toDataView = (source) => {
  if (source.constructor === DataView) {
    return source;
  } else if (ArrayBuffer.isView(source)) {
    return new DataView(source.buffer, source.byteOffset, source.byteLength);
  } else {
    return new DataView(source);
  }
};
var textDecoder = /* @__PURE__ */ new TextDecoder;
var invertObject = (object) => {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [value, key]));
};
var COLOR_PRIMARIES_MAP = {
  bt709: 1,
  bt470bg: 5,
  smpte170m: 6,
  bt2020: 9,
  smpte432: 12
};
var COLOR_PRIMARIES_MAP_INVERSE = /* @__PURE__ */ invertObject(COLOR_PRIMARIES_MAP);
var TRANSFER_CHARACTERISTICS_MAP = {
  bt709: 1,
  smpte170m: 6,
  linear: 8,
  "iec61966-2-1": 13,
  pq: 16,
  hlg: 18
};
var TRANSFER_CHARACTERISTICS_MAP_INVERSE = /* @__PURE__ */ invertObject(TRANSFER_CHARACTERISTICS_MAP);
var MATRIX_COEFFICIENTS_MAP = {
  rgb: 0,
  bt709: 1,
  bt470bg: 5,
  smpte170m: 6,
  "bt2020-ncl": 9
};
var MATRIX_COEFFICIENTS_MAP_INVERSE = /* @__PURE__ */ invertObject(MATRIX_COEFFICIENTS_MAP);
var isAllowSharedBufferSource = (x) => {
  return x instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && x instanceof SharedArrayBuffer || ArrayBuffer.isView(x);
};

class AsyncMutex {
  constructor() {
    this.currentPromise = Promise.resolve();
    this.pending = 0;
  }
  async acquire() {
    let resolver;
    const nextPromise = new Promise((resolve) => {
      let resolved = false;
      resolver = () => {
        if (resolved) {
          return;
        }
        resolve();
        this.pending--;
        resolved = true;
      };
    });
    const currentPromiseAlias = this.currentPromise;
    this.currentPromise = nextPromise;
    this.pending++;
    await currentPromiseAlias;
    return resolver;
  }
}
var HEX_STRING_REGEX = /^[0-9a-fA-F]+$/;
var bytesToHexString = (bytes) => {
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
};
var hexStringToBytes = (hexString) => {
  assert(hexString.length % 2 === 0);
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0;i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.slice(i, i + 2), 16);
  }
  return bytes;
};
var reverseBitsU32 = (x) => {
  x = x >> 1 & 1431655765 | (x & 1431655765) << 1;
  x = x >> 2 & 858993459 | (x & 858993459) << 2;
  x = x >> 4 & 252645135 | (x & 252645135) << 4;
  x = x >> 8 & 16711935 | (x & 16711935) << 8;
  x = x >> 16 & 65535 | (x & 65535) << 16;
  return x >>> 0;
};
var binarySearchExact = (arr, key, valueGetter) => {
  let low = 0;
  let high = arr.length - 1;
  let ans = -1;
  while (low <= high) {
    const mid = low + high >> 1;
    const midVal = valueGetter(arr[mid]);
    if (midVal === key) {
      ans = mid;
      high = mid - 1;
    } else if (midVal < key) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ans;
};
var binarySearchLessOrEqual = (arr, key, valueGetter) => {
  let low = 0;
  let high = arr.length - 1;
  let ans = -1;
  while (low <= high) {
    const mid = low + (high - low + 1) / 2 | 0;
    const midVal = valueGetter(arr[mid]);
    if (midVal <= key) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ans;
};
var insertSorted = (arr, item, valueGetter) => {
  const insertionIndex = binarySearchLessOrEqual(arr, valueGetter(item), valueGetter);
  arr.splice(insertionIndex + 1, 0, item);
};
var promiseWithResolvers = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
var removeItem = (arr, item) => {
  const index = arr.indexOf(item);
  if (index !== -1) {
    arr.splice(index, 1);
  }
};
var findLast = (arr, predicate) => {
  for (let i = arr.length - 1;i >= 0; i--) {
    if (predicate(arr[i])) {
      return arr[i];
    }
  }
  return;
};
var findLastIndex = (arr, predicate) => {
  for (let i = arr.length - 1;i >= 0; i--) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  return -1;
};
var toAsyncIterator = async function* (source) {
  if (Symbol.iterator in source) {
    yield* source[Symbol.iterator]();
  } else {
    yield* source[Symbol.asyncIterator]();
  }
};
var validateAnyIterable = (iterable) => {
  if (!(Symbol.iterator in iterable) && !(Symbol.asyncIterator in iterable)) {
    throw new TypeError("Argument must be an iterable or async iterable.");
  }
};
var assertNever = (x) => {
  throw new Error(`Unexpected value: ${x}`);
};
var getUint24 = (view, byteOffset, littleEndian) => {
  const byte1 = view.getUint8(byteOffset);
  const byte2 = view.getUint8(byteOffset + 1);
  const byte3 = view.getUint8(byteOffset + 2);
  if (littleEndian) {
    return byte1 | byte2 << 8 | byte3 << 16;
  } else {
    return byte1 << 16 | byte2 << 8 | byte3;
  }
};
var getInt24 = (view, byteOffset, littleEndian) => {
  return getUint24(view, byteOffset, littleEndian) << 8 >> 8;
};
var setUint24 = (view, byteOffset, value, littleEndian) => {
  value = value >>> 0;
  value = value & 16777215;
  if (littleEndian) {
    view.setUint8(byteOffset, value & 255);
    view.setUint8(byteOffset + 1, value >>> 8 & 255);
    view.setUint8(byteOffset + 2, value >>> 16 & 255);
  } else {
    view.setUint8(byteOffset, value >>> 16 & 255);
    view.setUint8(byteOffset + 1, value >>> 8 & 255);
    view.setUint8(byteOffset + 2, value & 255);
  }
};
var mapAsyncGenerator = (generator, map) => {
  return {
    async next() {
      const result = await generator.next();
      if (result.done) {
        return { value: undefined, done: true };
      } else {
        return { value: map(result.value), done: false };
      }
    },
    return() {
      return generator.return();
    },
    throw(error) {
      return generator.throw(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
};
var clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};
var UNDETERMINED_LANGUAGE = "und";
var roundIfAlmostInteger = (value) => {
  const rounded = Math.round(value);
  if (Math.abs(value / rounded - 1) < 10 * Number.EPSILON) {
    return rounded;
  } else {
    return value;
  }
};
var roundToMultiple = (value, multiple) => {
  return Math.round(value / multiple) * multiple;
};
var roundToDivisor = (value, multiple) => {
  return Math.round(value * multiple) / multiple;
};
var floorToMultiple = (value, multiple) => {
  return Math.floor(value / multiple) * multiple;
};
var ilog = (x) => {
  let ret = 0;
  while (x) {
    ret++;
    x >>= 1;
  }
  return ret;
};
var ISO_639_2_REGEX = /^[a-z]{3}$/;
var isIso639Dash2LanguageCode = (x) => {
  return ISO_639_2_REGEX.test(x);
};
var SECOND_TO_MICROSECOND_FACTOR = 1e6 * (1 + Number.EPSILON);
var mergeRequestInit = (init1, init2) => {
  const merged = { ...init1, ...init2 };
  if (init1.headers || init2.headers) {
    const headers1 = init1.headers ? normalizeHeaders(init1.headers) : {};
    const headers2 = init2.headers ? normalizeHeaders(init2.headers) : {};
    const mergedHeaders = { ...headers1 };
    Object.entries(headers2).forEach(([key2, value2]) => {
      const existingKey = Object.keys(mergedHeaders).find((key1) => key1.toLowerCase() === key2.toLowerCase());
      if (existingKey) {
        delete mergedHeaders[existingKey];
      }
      mergedHeaders[key2] = value2;
    });
    merged.headers = mergedHeaders;
  }
  return merged;
};
var normalizeHeaders = (headers) => {
  if (headers instanceof Headers) {
    const result = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    const result = {};
    headers.forEach(([key, value]) => {
      result[key] = value;
    });
    return result;
  }
  return headers;
};
var retriedFetch = async (fetchFn, url, requestInit, getRetryDelay, shouldStop) => {
  let attempts = 0;
  while (true) {
    try {
      return await fetchFn(url, requestInit);
    } catch (error) {
      if (shouldStop()) {
        throw error;
      }
      attempts++;
      const retryDelayInSeconds = getRetryDelay(attempts, error, url);
      if (retryDelayInSeconds === null) {
        throw error;
      }
      console.error("Retrying failed fetch. Error:", error);
      if (!Number.isFinite(retryDelayInSeconds) || retryDelayInSeconds < 0) {
        throw new TypeError("Retry delay must be a non-negative finite number.");
      }
      if (retryDelayInSeconds > 0) {
        await wait(1000 * retryDelayInSeconds);
      }
      if (shouldStop()) {
        throw error;
      }
    }
  }
};
class CallSerializer {
  constructor() {
    this.currentPromise = Promise.resolve();
  }
  call(fn) {
    return this.currentPromise = this.currentPromise.then(fn);
  }
}
var isWebKitCache = null;
var isWebKit = () => {
  if (isWebKitCache !== null) {
    return isWebKitCache;
  }
  return isWebKitCache = !!(typeof navigator !== "undefined" && (navigator.vendor?.match(/apple/i) || /AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) || /\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent)));
};
var isFirefoxCache = null;
var isFirefox = () => {
  if (isFirefoxCache !== null) {
    return isFirefoxCache;
  }
  return isFirefoxCache = typeof navigator !== "undefined" && navigator.userAgent?.includes("Firefox");
};
var isChromiumCache = null;
var isChromium = () => {
  if (isChromiumCache !== null) {
    return isChromiumCache;
  }
  return isChromiumCache = !!(typeof navigator !== "undefined" && (navigator.vendor?.includes("Google Inc") || /Chrome/.test(navigator.userAgent)));
};
var chromiumVersionCache = null;
var getChromiumVersion = () => {
  if (chromiumVersionCache !== null) {
    return chromiumVersionCache;
  }
  if (typeof navigator === "undefined") {
    return null;
  }
  const match = /\bChrome\/(\d+)/.exec(navigator.userAgent);
  if (!match) {
    return null;
  }
  return chromiumVersionCache = Number(match[1]);
};
var coalesceIndex = (a, b) => {
  return a !== -1 ? a : b;
};
var closedIntervalsOverlap = (startA, endA, startB, endB) => {
  return startA <= endB && startB <= endA;
};
var base64ToBytes = (base64) => {
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0;i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
};
var uint8ArraysAreEqual = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0;i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};
var polyfillSymbolDispose = () => {
  Symbol.dispose ??= Symbol("Symbol.dispose");
};
var isNumber = (x) => {
  return typeof x === "number" && !Number.isNaN(x);
};
var joinPaths = (basePath, relativePath) => {
  if (relativePath.includes("://")) {
    return relativePath;
  }
  if (basePath.includes("://")) {
    const queryIndex = basePath.indexOf("?");
    if (queryIndex !== -1) {
      basePath = basePath.slice(0, queryIndex);
    }
  }
  let result;
  if (relativePath.startsWith("/")) {
    const protocolIndex2 = basePath.indexOf("://");
    if (protocolIndex2 === -1) {
      result = relativePath;
    } else {
      const pathStart = basePath.indexOf("/", protocolIndex2 + 3);
      if (pathStart === -1) {
        result = basePath + relativePath;
      } else {
        result = basePath.slice(0, pathStart) + relativePath;
      }
    }
  } else {
    const lastSlash = basePath.lastIndexOf("/");
    if (lastSlash === -1) {
      result = relativePath;
    } else {
      result = basePath.slice(0, lastSlash + 1) + relativePath;
    }
  }
  let prefix = "";
  const protocolIndex = result.indexOf("://");
  if (protocolIndex !== -1) {
    const pathStart = result.indexOf("/", protocolIndex + 3);
    if (pathStart !== -1) {
      prefix = result.slice(0, pathStart);
      result = result.slice(pathStart);
    }
  }
  const segments = result.split("/");
  const normalized = [];
  for (const segment of segments) {
    if (segment === "..") {
      normalized.pop();
    } else if (segment !== ".") {
      normalized.push(segment);
    }
  }
  return prefix + normalized.join("/");
};
var arrayCount = (array, predicate) => {
  let count = 0;
  for (let i = 0;i < array.length; i++) {
    if (predicate(array[i])) {
      count++;
    }
  }
  return count;
};
var arrayArgmin = (array, getValue) => {
  let minIndex = -1;
  let minValue = Infinity;
  for (let i = 0;i < array.length; i++) {
    const value = getValue(array[i]);
    if (value < minValue) {
      minValue = value;
      minIndex = i;
    }
  }
  return minIndex;
};
var simplifyRational = (rational) => {
  assert(Number.isInteger(rational.num));
  assert(Number.isInteger(rational.den));
  assert(rational.den !== 0);
  let a = Math.abs(rational.num);
  let b = Math.abs(rational.den);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  const gcd = a || 1;
  return {
    num: rational.num / gcd,
    den: rational.den / gcd
  };
};
var validateRectangle = (rect, propertyPath) => {
  if (typeof rect !== "object" || !rect) {
    throw new TypeError(`${propertyPath} must be an object.`);
  }
  if (!Number.isInteger(rect.left) || rect.left < 0) {
    throw new TypeError(`${propertyPath}.left must be a non-negative integer.`);
  }
  if (!Number.isInteger(rect.top) || rect.top < 0) {
    throw new TypeError(`${propertyPath}.top must be a non-negative integer.`);
  }
  if (!Number.isInteger(rect.width) || rect.width < 0) {
    throw new TypeError(`${propertyPath}.width must be a non-negative integer.`);
  }
  if (!Number.isInteger(rect.height) || rect.height < 0) {
    throw new TypeError(`${propertyPath}.height must be a non-negative integer.`);
  }
};
var unthrottledTimeoutCallbacks = new Map;
var unthrottledIntervalCallbacks = new Map;
var wait = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
class EventEmitter {
  constructor() {
    this._listeners = new Map;
  }
  on(event, listener, options) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set);
    }
    const entry = { fn: listener, once: options?.once ?? false };
    this._listeners.get(event).add(entry);
    return () => {
      this._listeners.get(event)?.delete(entry);
    };
  }
  _emit(...args) {
    const [event, data] = args;
    const listeners = this._listeners.get(event);
    if (!listeners) {
      return;
    }
    for (const entry of listeners) {
      try {
        entry.fn(data);
      } catch (error) {
        console.error(error);
      }
      if (entry.once) {
        listeners.delete(entry);
      }
    }
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/metadata.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class RichImageData {
  constructor(data, mimeType) {
    this.data = data;
    this.mimeType = mimeType;
    if (!(data instanceof Uint8Array)) {
      throw new TypeError("data must be a Uint8Array.");
    }
    if (typeof mimeType !== "string") {
      throw new TypeError("mimeType must be a string.");
    }
  }
}

class AttachedFile {
  constructor(data, mimeType, name, description) {
    this.data = data;
    this.mimeType = mimeType;
    this.name = name;
    this.description = description;
    if (!(data instanceof Uint8Array)) {
      throw new TypeError("data must be a Uint8Array.");
    }
    if (mimeType !== undefined && typeof mimeType !== "string") {
      throw new TypeError("mimeType, when provided, must be a string.");
    }
    if (name !== undefined && typeof name !== "string") {
      throw new TypeError("name, when provided, must be a string.");
    }
    if (description !== undefined && typeof description !== "string") {
      throw new TypeError("description, when provided, must be a string.");
    }
  }
}
var DEFAULT_TRACK_DISPOSITION = {
  default: true,
  primary: true,
  forced: false,
  original: false,
  commentary: false,
  hearingImpaired: false,
  visuallyImpaired: false
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/shared/bitstream.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class Bitstream {
  constructor(bytes) {
    this.bytes = bytes;
    this.pos = 0;
  }
  seekToByte(byteOffset) {
    this.pos = 8 * byteOffset;
  }
  readBit() {
    const byteIndex = Math.floor(this.pos / 8);
    const byte = this.bytes[byteIndex] ?? 0;
    const bitIndex = 7 - (this.pos & 7);
    const bit = (byte & 1 << bitIndex) >> bitIndex;
    this.pos++;
    return bit;
  }
  readBits(n) {
    if (n === 1) {
      return this.readBit();
    }
    let result = 0;
    for (let i = 0;i < n; i++) {
      result <<= 1;
      result |= this.readBit();
    }
    return result;
  }
  writeBits(n, value) {
    const end = this.pos + n;
    for (let i = this.pos;i < end; i++) {
      const byteIndex = Math.floor(i / 8);
      let byte = this.bytes[byteIndex];
      const bitIndex = 7 - (i & 7);
      byte &= ~(1 << bitIndex);
      byte |= (value & 1 << end - i - 1) >> end - i - 1 << bitIndex;
      this.bytes[byteIndex] = byte;
    }
    this.pos = end;
  }
  readAlignedByte() {
    if (this.pos % 8 !== 0) {
      throw new Error("Bitstream is not byte-aligned.");
    }
    const byteIndex = this.pos / 8;
    const byte = this.bytes[byteIndex] ?? 0;
    this.pos += 8;
    return byte;
  }
  skipBits(n) {
    this.pos += n;
  }
  getBitsLeft() {
    return this.bytes.length * 8 - this.pos;
  }
  clone() {
    const clone = new Bitstream(this.bytes);
    clone.pos = this.pos;
    return clone;
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/shared/aac-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var aacFrequencyTable = [
  96000,
  88200,
  64000,
  48000,
  44100,
  32000,
  24000,
  22050,
  16000,
  12000,
  11025,
  8000,
  7350
];
var aacChannelMap = [-1, 1, 2, 3, 4, 5, 6, 8];
var parseAacAudioSpecificConfig = (bytes) => {
  if (!bytes || bytes.byteLength < 2) {
    throw new TypeError("AAC description must be at least 2 bytes long.");
  }
  const bitstream = new Bitstream(bytes);
  let objectType = bitstream.readBits(5);
  if (objectType === 31) {
    objectType = 32 + bitstream.readBits(6);
  }
  const frequencyIndex = bitstream.readBits(4);
  let sampleRate = null;
  if (frequencyIndex === 15) {
    sampleRate = bitstream.readBits(24);
  } else {
    if (frequencyIndex < aacFrequencyTable.length) {
      sampleRate = aacFrequencyTable[frequencyIndex];
    }
  }
  const channelConfiguration = bitstream.readBits(4);
  let numberOfChannels = null;
  if (channelConfiguration >= 1 && channelConfiguration <= 7) {
    numberOfChannels = aacChannelMap[channelConfiguration];
  }
  return {
    objectType,
    frequencyIndex,
    sampleRate,
    channelConfiguration,
    numberOfChannels
  };
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/codec.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var VIDEO_CODECS = [
  "avc",
  "hevc",
  "vp9",
  "av1",
  "vp8"
];
var PCM_AUDIO_CODECS = [
  "pcm-s16",
  "pcm-s16be",
  "pcm-s24",
  "pcm-s24be",
  "pcm-s32",
  "pcm-s32be",
  "pcm-f32",
  "pcm-f32be",
  "pcm-f64",
  "pcm-f64be",
  "pcm-u8",
  "pcm-s8",
  "ulaw",
  "alaw"
];
var NON_PCM_AUDIO_CODECS = [
  "aac",
  "opus",
  "mp3",
  "vorbis",
  "flac",
  "ac3",
  "eac3"
];
var AUDIO_CODECS = [
  ...NON_PCM_AUDIO_CODECS,
  ...PCM_AUDIO_CODECS
];
var AVC_LEVEL_TABLE = [
  { maxMacroblocks: 99, maxBitrate: 64000, maxDpbMbs: 396, level: 10 },
  { maxMacroblocks: 396, maxBitrate: 192000, maxDpbMbs: 900, level: 11 },
  { maxMacroblocks: 396, maxBitrate: 384000, maxDpbMbs: 2376, level: 12 },
  { maxMacroblocks: 396, maxBitrate: 768000, maxDpbMbs: 2376, level: 13 },
  { maxMacroblocks: 396, maxBitrate: 2000000, maxDpbMbs: 2376, level: 20 },
  { maxMacroblocks: 792, maxBitrate: 4000000, maxDpbMbs: 4752, level: 21 },
  { maxMacroblocks: 1620, maxBitrate: 4000000, maxDpbMbs: 8100, level: 22 },
  { maxMacroblocks: 1620, maxBitrate: 1e7, maxDpbMbs: 8100, level: 30 },
  { maxMacroblocks: 3600, maxBitrate: 14000000, maxDpbMbs: 18000, level: 31 },
  { maxMacroblocks: 5120, maxBitrate: 20000000, maxDpbMbs: 20480, level: 32 },
  { maxMacroblocks: 8192, maxBitrate: 20000000, maxDpbMbs: 32768, level: 40 },
  { maxMacroblocks: 8192, maxBitrate: 50000000, maxDpbMbs: 32768, level: 41 },
  { maxMacroblocks: 8704, maxBitrate: 50000000, maxDpbMbs: 34816, level: 42 },
  { maxMacroblocks: 22080, maxBitrate: 135000000, maxDpbMbs: 110400, level: 50 },
  { maxMacroblocks: 36864, maxBitrate: 240000000, maxDpbMbs: 184320, level: 51 },
  { maxMacroblocks: 36864, maxBitrate: 240000000, maxDpbMbs: 184320, level: 52 },
  { maxMacroblocks: 139264, maxBitrate: 240000000, maxDpbMbs: 696320, level: 60 },
  { maxMacroblocks: 139264, maxBitrate: 480000000, maxDpbMbs: 696320, level: 61 },
  { maxMacroblocks: 139264, maxBitrate: 800000000, maxDpbMbs: 696320, level: 62 }
];
var VP9_LEVEL_TABLE = [
  { maxPictureSize: 36864, maxBitrate: 200000, level: 10 },
  { maxPictureSize: 73728, maxBitrate: 800000, level: 11 },
  { maxPictureSize: 122880, maxBitrate: 1800000, level: 20 },
  { maxPictureSize: 245760, maxBitrate: 3600000, level: 21 },
  { maxPictureSize: 552960, maxBitrate: 7200000, level: 30 },
  { maxPictureSize: 983040, maxBitrate: 12000000, level: 31 },
  { maxPictureSize: 2228224, maxBitrate: 18000000, level: 40 },
  { maxPictureSize: 2228224, maxBitrate: 30000000, level: 41 },
  { maxPictureSize: 8912896, maxBitrate: 60000000, level: 50 },
  { maxPictureSize: 8912896, maxBitrate: 120000000, level: 51 },
  { maxPictureSize: 8912896, maxBitrate: 180000000, level: 52 },
  { maxPictureSize: 35651584, maxBitrate: 180000000, level: 60 },
  { maxPictureSize: 35651584, maxBitrate: 240000000, level: 61 },
  { maxPictureSize: 35651584, maxBitrate: 480000000, level: 62 }
];
var VP9_DEFAULT_SUFFIX = ".01.01.01.01.00";
var AV1_DEFAULT_SUFFIX = ".0.110.01.01.01.0";
var extractVideoCodecString = (trackInfo) => {
  const { codec, codecDescription, colorSpace, avcCodecInfo, hevcCodecInfo, vp9CodecInfo, av1CodecInfo } = trackInfo;
  if (codec === "avc") {
    assert(trackInfo.avcType !== null);
    if (avcCodecInfo) {
      const bytes = new Uint8Array([
        avcCodecInfo.avcProfileIndication,
        avcCodecInfo.profileCompatibility,
        avcCodecInfo.avcLevelIndication
      ]);
      return `avc${trackInfo.avcType}.${bytesToHexString(bytes)}`;
    }
    if (!codecDescription || codecDescription.byteLength < 4) {
      throw new TypeError("AVC decoder description is not provided or is not at least 4 bytes long.");
    }
    return `avc${trackInfo.avcType}.${bytesToHexString(codecDescription.subarray(1, 4))}`;
  } else if (codec === "hevc") {
    let generalProfileSpace;
    let generalProfileIdc;
    let compatibilityFlags;
    let generalTierFlag;
    let generalLevelIdc;
    let constraintFlags;
    if (hevcCodecInfo) {
      generalProfileSpace = hevcCodecInfo.generalProfileSpace;
      generalProfileIdc = hevcCodecInfo.generalProfileIdc;
      compatibilityFlags = reverseBitsU32(hevcCodecInfo.generalProfileCompatibilityFlags);
      generalTierFlag = hevcCodecInfo.generalTierFlag;
      generalLevelIdc = hevcCodecInfo.generalLevelIdc;
      constraintFlags = [...hevcCodecInfo.generalConstraintIndicatorFlags];
    } else {
      if (!codecDescription || codecDescription.byteLength < 23) {
        throw new TypeError("HEVC decoder description is not provided or is not at least 23 bytes long.");
      }
      const view = toDataView(codecDescription);
      const profileByte = view.getUint8(1);
      generalProfileSpace = profileByte >> 6 & 3;
      generalProfileIdc = profileByte & 31;
      compatibilityFlags = reverseBitsU32(view.getUint32(2));
      generalTierFlag = profileByte >> 5 & 1;
      generalLevelIdc = view.getUint8(12);
      constraintFlags = [];
      for (let i = 0;i < 6; i++) {
        constraintFlags.push(view.getUint8(6 + i));
      }
    }
    let codecString = "hev1.";
    codecString += ["", "A", "B", "C"][generalProfileSpace] + generalProfileIdc;
    codecString += ".";
    codecString += compatibilityFlags.toString(16).toUpperCase();
    codecString += ".";
    codecString += generalTierFlag === 0 ? "L" : "H";
    codecString += generalLevelIdc;
    while (constraintFlags.length > 0 && constraintFlags[constraintFlags.length - 1] === 0) {
      constraintFlags.pop();
    }
    if (constraintFlags.length > 0) {
      codecString += ".";
      codecString += constraintFlags.map((x) => x.toString(16).toUpperCase()).join(".");
    }
    return codecString;
  } else if (codec === "vp8") {
    return "vp8";
  } else if (codec === "vp9") {
    if (!vp9CodecInfo) {
      const pictureSize = trackInfo.width * trackInfo.height;
      let level2 = last(VP9_LEVEL_TABLE).level;
      for (const entry of VP9_LEVEL_TABLE) {
        if (pictureSize <= entry.maxPictureSize) {
          level2 = entry.level;
          break;
        }
      }
      return `vp09.00.${level2.toString().padStart(2, "0")}.08`;
    }
    const profile = vp9CodecInfo.profile.toString().padStart(2, "0");
    const level = vp9CodecInfo.level.toString().padStart(2, "0");
    const bitDepth = vp9CodecInfo.bitDepth.toString().padStart(2, "0");
    const chromaSubsampling = vp9CodecInfo.chromaSubsampling.toString().padStart(2, "0");
    const colourPrimaries = vp9CodecInfo.colourPrimaries.toString().padStart(2, "0");
    const transferCharacteristics = vp9CodecInfo.transferCharacteristics.toString().padStart(2, "0");
    const matrixCoefficients = vp9CodecInfo.matrixCoefficients.toString().padStart(2, "0");
    const videoFullRangeFlag = vp9CodecInfo.videoFullRangeFlag.toString().padStart(2, "0");
    let string = `vp09.${profile}.${level}.${bitDepth}.${chromaSubsampling}`;
    string += `.${colourPrimaries}.${transferCharacteristics}.${matrixCoefficients}.${videoFullRangeFlag}`;
    if (string.endsWith(VP9_DEFAULT_SUFFIX)) {
      string = string.slice(0, -VP9_DEFAULT_SUFFIX.length);
    }
    return string;
  } else if (codec === "av1") {
    if (!av1CodecInfo) {
      const pictureSize = trackInfo.width * trackInfo.height;
      let level2 = last(VP9_LEVEL_TABLE).level;
      for (const entry of VP9_LEVEL_TABLE) {
        if (pictureSize <= entry.maxPictureSize) {
          level2 = entry.level;
          break;
        }
      }
      return `av01.0.${level2.toString().padStart(2, "0")}M.08`;
    }
    const profile = av1CodecInfo.profile;
    const level = av1CodecInfo.level.toString().padStart(2, "0");
    const tier = av1CodecInfo.tier ? "H" : "M";
    const bitDepth = av1CodecInfo.bitDepth.toString().padStart(2, "0");
    const monochrome = av1CodecInfo.monochrome ? "1" : "0";
    const chromaSubsampling = 100 * av1CodecInfo.chromaSubsamplingX + 10 * av1CodecInfo.chromaSubsamplingY + 1 * (av1CodecInfo.chromaSubsamplingX && av1CodecInfo.chromaSubsamplingY ? av1CodecInfo.chromaSamplePosition : 0);
    const colorPrimaries = colorSpace?.primaries ? COLOR_PRIMARIES_MAP[colorSpace.primaries] : 1;
    const transferCharacteristics = colorSpace?.transfer ? TRANSFER_CHARACTERISTICS_MAP[colorSpace.transfer] : 1;
    const matrixCoefficients = colorSpace?.matrix ? MATRIX_COEFFICIENTS_MAP[colorSpace.matrix] : 1;
    const videoFullRangeFlag = colorSpace?.fullRange ? 1 : 0;
    let string = `av01.${profile}.${level}${tier}.${bitDepth}`;
    string += `.${monochrome}.${chromaSubsampling.toString().padStart(3, "0")}`;
    string += `.${colorPrimaries.toString().padStart(2, "0")}`;
    string += `.${transferCharacteristics.toString().padStart(2, "0")}`;
    string += `.${matrixCoefficients.toString().padStart(2, "0")}`;
    string += `.${videoFullRangeFlag}`;
    if (string.endsWith(AV1_DEFAULT_SUFFIX)) {
      string = string.slice(0, -AV1_DEFAULT_SUFFIX.length);
    }
    return string;
  }
  throw new TypeError(`Unhandled codec '${codec}'.`);
};
var extractAudioCodecString = (trackInfo) => {
  const { codec, codecDescription, aacCodecInfo } = trackInfo;
  if (codec === "aac") {
    if (!aacCodecInfo) {
      throw new TypeError("AAC codec info must be provided.");
    }
    if (aacCodecInfo.isMpeg2) {
      return "mp4a.67";
    } else {
      let objectType;
      if (aacCodecInfo.objectType !== null) {
        objectType = aacCodecInfo.objectType;
      } else {
        const audioSpecificConfig = parseAacAudioSpecificConfig(codecDescription);
        objectType = audioSpecificConfig.objectType;
      }
      return `mp4a.40.${objectType}`;
    }
  } else if (codec === "mp3") {
    return "mp3";
  } else if (codec === "opus") {
    return "opus";
  } else if (codec === "vorbis") {
    return "vorbis";
  } else if (codec === "flac") {
    return "flac";
  } else if (codec === "ac3") {
    return "ac-3";
  } else if (codec === "eac3") {
    return "ec-3";
  } else if (codec && PCM_AUDIO_CODECS.includes(codec)) {
    return codec;
  }
  throw new TypeError(`Unhandled codec '${codec}'.`);
};
var OPUS_SAMPLE_RATE = 48000;
var PCM_CODEC_REGEX = /^pcm-([usf])(\d+)(be)?$/;
var parsePcmCodec = (codec) => {
  assert(PCM_AUDIO_CODECS.includes(codec));
  if (codec === "ulaw") {
    return { dataType: "ulaw", sampleSize: 1, littleEndian: true, silentValue: 255 };
  } else if (codec === "alaw") {
    return { dataType: "alaw", sampleSize: 1, littleEndian: true, silentValue: 213 };
  }
  const match = PCM_CODEC_REGEX.exec(codec);
  assert(match);
  let dataType;
  if (match[1] === "u") {
    dataType = "unsigned";
  } else if (match[1] === "s") {
    dataType = "signed";
  } else {
    dataType = "float";
  }
  const sampleSize = Number(match[2]) / 8;
  const littleEndian = match[3] !== "be";
  const silentValue = codec === "pcm-u8" ? 2 ** 7 : 0;
  return { dataType, sampleSize, littleEndian, silentValue };
};
var inferCodecFromCodecString = (codecString) => {
  if (codecString.startsWith("avc1") || codecString.startsWith("avc3")) {
    return "avc";
  } else if (codecString.startsWith("hev1") || codecString.startsWith("hvc1")) {
    return "hevc";
  } else if (codecString === "vp8") {
    return "vp8";
  } else if (codecString.startsWith("vp09")) {
    return "vp9";
  } else if (codecString.startsWith("av01")) {
    return "av1";
  }
  if (codecString === "mp3" || codecString === "mp4a.69" || codecString === "mp4a.6B" || codecString === "mp4a.6b" || codecString === "mp4a.40.34") {
    return "mp3";
  } else if (codecString.startsWith("mp4a.40.") || codecString === "mp4a.67") {
    return "aac";
  } else if (codecString === "opus") {
    return "opus";
  } else if (codecString === "vorbis") {
    return "vorbis";
  } else if (codecString === "flac") {
    return "flac";
  } else if (codecString === "ac-3" || codecString === "ac3") {
    return "ac3";
  } else if (codecString === "ec-3" || codecString === "eac3") {
    return "eac3";
  } else if (codecString === "ulaw") {
    return "ulaw";
  } else if (codecString === "alaw") {
    return "alaw";
  } else if (PCM_CODEC_REGEX.test(codecString)) {
    return codecString;
  }
  if (codecString === "webvtt") {
    return "webvtt";
  }
  return null;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/shared/mp3-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var MP3_FRAME_HEADER_SIZE = 4;
var SAMPLING_RATES = [44100, 48000, 32000];
var KILOBIT_RATES = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  32,
  40,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  160,
  192,
  224,
  256,
  320,
  -1,
  -1,
  32,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  160,
  192,
  224,
  256,
  320,
  384,
  -1,
  -1,
  32,
  64,
  96,
  128,
  160,
  192,
  224,
  256,
  288,
  320,
  352,
  384,
  416,
  448,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  8,
  16,
  24,
  32,
  40,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  144,
  160,
  -1,
  -1,
  8,
  16,
  24,
  32,
  40,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  144,
  160,
  -1,
  -1,
  32,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  144,
  160,
  176,
  192,
  224,
  256,
  -1
];
var XING = 1483304551;
var INFO = 1231971951;
var computeMp3FrameSize = (lowSamplingFrequency, layer, bitrate, sampleRate, padding) => {
  if (layer === 0) {
    return 0;
  } else if (layer === 1) {
    return Math.floor(144 * bitrate / (sampleRate << lowSamplingFrequency)) + padding;
  } else if (layer === 2) {
    return Math.floor(144 * bitrate / sampleRate) + padding;
  } else {
    return (Math.floor(12 * bitrate / sampleRate) + padding) * 4;
  }
};
var computeAverageMp3FrameSize = (lowSamplingFrequency, layer, bitrate, sampleRate) => {
  if (layer === 0) {
    return 0;
  } else if (layer === 1) {
    return 144 * bitrate / (sampleRate << lowSamplingFrequency);
  } else if (layer === 2) {
    return 144 * bitrate / sampleRate;
  } else {
    return 12 * bitrate / sampleRate * 4;
  }
};
var getXingOffset = (mpegVersionId, channel) => {
  return mpegVersionId === 3 ? channel === 3 ? 21 : 36 : channel === 3 ? 13 : 21;
};
var readMp3FrameHeader = (word, remainingBytes) => {
  const firstByte = word >>> 24;
  const secondByte = word >>> 16 & 255;
  const thirdByte = word >>> 8 & 255;
  const fourthByte = word & 255;
  if (firstByte !== 255 && secondByte !== 255 && thirdByte !== 255 && fourthByte !== 255) {
    return {
      header: null,
      bytesAdvanced: 4
    };
  }
  if (firstByte !== 255) {
    return { header: null, bytesAdvanced: 1 };
  }
  if ((secondByte & 224) !== 224) {
    return { header: null, bytesAdvanced: 1 };
  }
  let lowSamplingFrequency = 0;
  let mpeg25 = 0;
  if (secondByte & 1 << 4) {
    lowSamplingFrequency = secondByte & 1 << 3 ? 0 : 1;
  } else {
    lowSamplingFrequency = 1;
    mpeg25 = 1;
  }
  const mpegVersionId = secondByte >> 3 & 3;
  const layer = secondByte >> 1 & 3;
  const bitrateIndex = thirdByte >> 4 & 15;
  const frequencyIndex = (thirdByte >> 2 & 3) % 3;
  const padding = thirdByte >> 1 & 1;
  const channel = fourthByte >> 6 & 3;
  const modeExtension = fourthByte >> 4 & 3;
  const copyright = fourthByte >> 3 & 1;
  const original = fourthByte >> 2 & 1;
  const emphasis = fourthByte & 3;
  const kilobitRate = KILOBIT_RATES[lowSamplingFrequency * 16 * 4 + layer * 16 + bitrateIndex];
  if (kilobitRate === -1) {
    return { header: null, bytesAdvanced: 1 };
  }
  const bitrate = kilobitRate * 1000;
  const sampleRate = SAMPLING_RATES[frequencyIndex] >> lowSamplingFrequency + mpeg25;
  const frameLength = computeMp3FrameSize(lowSamplingFrequency, layer, bitrate, sampleRate, padding);
  if (remainingBytes !== null && remainingBytes < frameLength) {
    return { header: null, bytesAdvanced: 1 };
  }
  let audioSamplesInFrame;
  if (mpegVersionId === 3) {
    audioSamplesInFrame = layer === 3 ? 384 : 1152;
  } else {
    if (layer === 3) {
      audioSamplesInFrame = 384;
    } else if (layer === 2) {
      audioSamplesInFrame = 1152;
    } else {
      audioSamplesInFrame = 576;
    }
  }
  return {
    header: {
      totalSize: frameLength,
      mpegVersionId,
      lowSamplingFrequency,
      layer,
      bitrate,
      frequencyIndex,
      sampleRate,
      channel,
      modeExtension,
      copyright,
      original,
      emphasis,
      audioSamplesInFrame
    },
    bytesAdvanced: 1
  };
};
var decodeSynchsafe = (synchsafed) => {
  let mask = 2130706432;
  let unsynchsafed = 0;
  while (mask !== 0) {
    unsynchsafed >>= 1;
    unsynchsafed |= synchsafed & mask;
    mask >>= 8;
  }
  return unsynchsafed;
};
var XingFlags;
(function(XingFlags2) {
  XingFlags2[XingFlags2["FrameCount"] = 1] = "FrameCount";
  XingFlags2[XingFlags2["FileSize"] = 2] = "FileSize";
  XingFlags2[XingFlags2["Toc"] = 4] = "Toc";
})(XingFlags || (XingFlags = {}));
var getMp3ChannelCount = (channel) => {
  return channel === 3 ? 1 : 2;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/shared/ac3-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var AC3_SAMPLE_RATES = [48000, 44100, 32000];
var EAC3_REDUCED_SAMPLE_RATES = [24000, 22050, 16000];

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/codec-data.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var AvcNalUnitType;
(function(AvcNalUnitType2) {
  AvcNalUnitType2[AvcNalUnitType2["NON_IDR_SLICE"] = 1] = "NON_IDR_SLICE";
  AvcNalUnitType2[AvcNalUnitType2["SLICE_DPA"] = 2] = "SLICE_DPA";
  AvcNalUnitType2[AvcNalUnitType2["SLICE_DPB"] = 3] = "SLICE_DPB";
  AvcNalUnitType2[AvcNalUnitType2["SLICE_DPC"] = 4] = "SLICE_DPC";
  AvcNalUnitType2[AvcNalUnitType2["IDR"] = 5] = "IDR";
  AvcNalUnitType2[AvcNalUnitType2["SEI"] = 6] = "SEI";
  AvcNalUnitType2[AvcNalUnitType2["SPS"] = 7] = "SPS";
  AvcNalUnitType2[AvcNalUnitType2["PPS"] = 8] = "PPS";
  AvcNalUnitType2[AvcNalUnitType2["AUD"] = 9] = "AUD";
  AvcNalUnitType2[AvcNalUnitType2["SPS_EXT"] = 13] = "SPS_EXT";
})(AvcNalUnitType || (AvcNalUnitType = {}));
var HevcNalUnitType;
(function(HevcNalUnitType2) {
  HevcNalUnitType2[HevcNalUnitType2["RASL_N"] = 8] = "RASL_N";
  HevcNalUnitType2[HevcNalUnitType2["RASL_R"] = 9] = "RASL_R";
  HevcNalUnitType2[HevcNalUnitType2["BLA_W_LP"] = 16] = "BLA_W_LP";
  HevcNalUnitType2[HevcNalUnitType2["RSV_IRAP_VCL23"] = 23] = "RSV_IRAP_VCL23";
  HevcNalUnitType2[HevcNalUnitType2["VPS_NUT"] = 32] = "VPS_NUT";
  HevcNalUnitType2[HevcNalUnitType2["SPS_NUT"] = 33] = "SPS_NUT";
  HevcNalUnitType2[HevcNalUnitType2["PPS_NUT"] = 34] = "PPS_NUT";
  HevcNalUnitType2[HevcNalUnitType2["AUD_NUT"] = 35] = "AUD_NUT";
  HevcNalUnitType2[HevcNalUnitType2["PREFIX_SEI_NUT"] = 39] = "PREFIX_SEI_NUT";
  HevcNalUnitType2[HevcNalUnitType2["SUFFIX_SEI_NUT"] = 40] = "SUFFIX_SEI_NUT";
})(HevcNalUnitType || (HevcNalUnitType = {}));
var iterateNalUnitsInAnnexB = function* (packetData) {
  let i = 0;
  let nalStart = -1;
  while (i < packetData.length - 2) {
    const zeroIndex = packetData.indexOf(0, i);
    if (zeroIndex === -1 || zeroIndex >= packetData.length - 2) {
      break;
    }
    i = zeroIndex;
    let startCodeLength = 0;
    if (i + 3 < packetData.length && packetData[i + 1] === 0 && packetData[i + 2] === 0 && packetData[i + 3] === 1) {
      startCodeLength = 4;
    } else if (packetData[i + 1] === 0 && packetData[i + 2] === 1) {
      startCodeLength = 3;
    }
    if (startCodeLength === 0) {
      i++;
      continue;
    }
    if (nalStart !== -1 && i > nalStart) {
      yield {
        offset: nalStart,
        length: i - nalStart
      };
    }
    nalStart = i + startCodeLength;
    i = nalStart;
  }
  if (nalStart !== -1 && nalStart < packetData.length) {
    yield {
      offset: nalStart,
      length: packetData.length - nalStart
    };
  }
};
var iterateNalUnitsInLengthPrefixed = function* (packetData, lengthSize) {
  let offset = 0;
  const dataView = new DataView(packetData.buffer, packetData.byteOffset, packetData.byteLength);
  while (offset + lengthSize <= packetData.length) {
    let nalUnitLength;
    if (lengthSize === 1) {
      nalUnitLength = dataView.getUint8(offset);
    } else if (lengthSize === 2) {
      nalUnitLength = dataView.getUint16(offset, false);
    } else if (lengthSize === 3) {
      nalUnitLength = getUint24(dataView, offset, false);
    } else {
      assert(lengthSize === 4);
      nalUnitLength = dataView.getUint32(offset, false);
    }
    offset += lengthSize;
    yield {
      offset,
      length: nalUnitLength
    };
    offset += nalUnitLength;
  }
};
var iterateAvcNalUnits = (packetData, decoderConfig) => {
  if (decoderConfig.description) {
    const bytes = toUint8Array(decoderConfig.description);
    const lengthSizeMinusOne = bytes[4] & 3;
    const lengthSize = lengthSizeMinusOne + 1;
    return iterateNalUnitsInLengthPrefixed(packetData, lengthSize);
  } else {
    return iterateNalUnitsInAnnexB(packetData);
  }
};
var extractNalUnitTypeForAvc = (byte) => {
  return byte & 31;
};
var removeEmulationPreventionBytes = (data) => {
  const result = [];
  const len = data.length;
  for (let i = 0;i < len; i++) {
    if (i + 2 < len && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 3) {
      result.push(0, 0);
      i += 2;
    } else {
      result.push(data[i]);
    }
  }
  return new Uint8Array(result);
};
var ANNEX_B_START_CODE = new Uint8Array([0, 0, 0, 1]);
var concatNalUnitsInAnnexB = (nalUnits) => {
  const totalLength = nalUnits.reduce((a, b) => a + ANNEX_B_START_CODE.byteLength + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const nalUnit of nalUnits) {
    result.set(ANNEX_B_START_CODE, offset);
    offset += ANNEX_B_START_CODE.byteLength;
    result.set(nalUnit, offset);
    offset += nalUnit.byteLength;
  }
  return result;
};
var concatNalUnitsInLengthPrefixed = (nalUnits, lengthSize) => {
  const totalLength = nalUnits.reduce((a, b) => a + lengthSize + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const nalUnit of nalUnits) {
    const dataView = new DataView(result.buffer, result.byteOffset, result.byteLength);
    switch (lengthSize) {
      case 1:
        dataView.setUint8(offset, nalUnit.byteLength);
        break;
      case 2:
        dataView.setUint16(offset, nalUnit.byteLength, false);
        break;
      case 3:
        setUint24(dataView, offset, nalUnit.byteLength, false);
        break;
      case 4:
        dataView.setUint32(offset, nalUnit.byteLength, false);
        break;
    }
    offset += lengthSize;
    result.set(nalUnit, offset);
    offset += nalUnit.byteLength;
  }
  return result;
};
var concatAvcNalUnits = (nalUnits, decoderConfig) => {
  if (decoderConfig.description) {
    const bytes = toUint8Array(decoderConfig.description);
    const lengthSizeMinusOne = bytes[4] & 3;
    const lengthSize = lengthSizeMinusOne + 1;
    return concatNalUnitsInLengthPrefixed(nalUnits, lengthSize);
  } else {
    return concatNalUnitsInAnnexB(nalUnits);
  }
};
var extractAvcDecoderConfigurationRecord = (packetData) => {
  try {
    const spsUnits = [];
    const ppsUnits = [];
    const spsExtUnits = [];
    for (const loc of iterateNalUnitsInAnnexB(packetData)) {
      const nalUnit = packetData.subarray(loc.offset, loc.offset + loc.length);
      const type = extractNalUnitTypeForAvc(nalUnit[0]);
      if (type === AvcNalUnitType.SPS) {
        spsUnits.push(nalUnit);
      } else if (type === AvcNalUnitType.PPS) {
        ppsUnits.push(nalUnit);
      } else if (type === AvcNalUnitType.SPS_EXT) {
        spsExtUnits.push(nalUnit);
      }
    }
    if (spsUnits.length === 0) {
      return null;
    }
    if (ppsUnits.length === 0) {
      return null;
    }
    const spsData = spsUnits[0];
    const spsInfo = parseAvcSps(spsData);
    assert(spsInfo !== null);
    const hasExtendedData = spsInfo.profileIdc === 100 || spsInfo.profileIdc === 110 || spsInfo.profileIdc === 122 || spsInfo.profileIdc === 144;
    return {
      configurationVersion: 1,
      avcProfileIndication: spsInfo.profileIdc,
      profileCompatibility: spsInfo.constraintFlags,
      avcLevelIndication: spsInfo.levelIdc,
      lengthSizeMinusOne: 3,
      sequenceParameterSets: spsUnits,
      pictureParameterSets: ppsUnits,
      chromaFormat: hasExtendedData ? spsInfo.chromaFormatIdc : null,
      bitDepthLumaMinus8: hasExtendedData ? spsInfo.bitDepthLumaMinus8 : null,
      bitDepthChromaMinus8: hasExtendedData ? spsInfo.bitDepthChromaMinus8 : null,
      sequenceParameterSetExt: hasExtendedData ? spsExtUnits : null
    };
  } catch (error) {
    console.error("Error building AVC Decoder Configuration Record:", error);
    return null;
  }
};
var deserializeAvcDecoderConfigurationRecord = (data) => {
  try {
    const view = toDataView(data);
    let offset = 0;
    const configurationVersion = view.getUint8(offset++);
    const avcProfileIndication = view.getUint8(offset++);
    const profileCompatibility = view.getUint8(offset++);
    const avcLevelIndication = view.getUint8(offset++);
    const lengthSizeMinusOne = view.getUint8(offset++) & 3;
    const numOfSequenceParameterSets = view.getUint8(offset++) & 31;
    const sequenceParameterSets = [];
    for (let i = 0;i < numOfSequenceParameterSets; i++) {
      const length = view.getUint16(offset, false);
      offset += 2;
      sequenceParameterSets.push(data.subarray(offset, offset + length));
      offset += length;
    }
    const numOfPictureParameterSets = view.getUint8(offset++);
    const pictureParameterSets = [];
    for (let i = 0;i < numOfPictureParameterSets; i++) {
      const length = view.getUint16(offset, false);
      offset += 2;
      pictureParameterSets.push(data.subarray(offset, offset + length));
      offset += length;
    }
    const record = {
      configurationVersion,
      avcProfileIndication,
      profileCompatibility,
      avcLevelIndication,
      lengthSizeMinusOne,
      sequenceParameterSets,
      pictureParameterSets,
      chromaFormat: null,
      bitDepthLumaMinus8: null,
      bitDepthChromaMinus8: null,
      sequenceParameterSetExt: null
    };
    if ((avcProfileIndication === 100 || avcProfileIndication === 110 || avcProfileIndication === 122 || avcProfileIndication === 144) && offset + 4 <= data.length) {
      const chromaFormat = view.getUint8(offset++) & 3;
      const bitDepthLumaMinus8 = view.getUint8(offset++) & 7;
      const bitDepthChromaMinus8 = view.getUint8(offset++) & 7;
      const numOfSequenceParameterSetExt = view.getUint8(offset++);
      record.chromaFormat = chromaFormat;
      record.bitDepthLumaMinus8 = bitDepthLumaMinus8;
      record.bitDepthChromaMinus8 = bitDepthChromaMinus8;
      const sequenceParameterSetExt = [];
      for (let i = 0;i < numOfSequenceParameterSetExt; i++) {
        const length = view.getUint16(offset, false);
        offset += 2;
        sequenceParameterSetExt.push(data.subarray(offset, offset + length));
        offset += length;
      }
      record.sequenceParameterSetExt = sequenceParameterSetExt;
    }
    return record;
  } catch (error) {
    console.error("Error deserializing AVC Decoder Configuration Record:", error);
    return null;
  }
};
var AVC_HEVC_ASPECT_RATIO_IDC_TABLE = {
  1: { num: 1, den: 1 },
  2: { num: 12, den: 11 },
  3: { num: 10, den: 11 },
  4: { num: 16, den: 11 },
  5: { num: 40, den: 33 },
  6: { num: 24, den: 11 },
  7: { num: 20, den: 11 },
  8: { num: 32, den: 11 },
  9: { num: 80, den: 33 },
  10: { num: 18, den: 11 },
  11: { num: 15, den: 11 },
  12: { num: 64, den: 33 },
  13: { num: 160, den: 99 },
  14: { num: 4, den: 3 },
  15: { num: 3, den: 2 },
  16: { num: 2, den: 1 }
};
var parseAvcSps = (sps) => {
  try {
    const bitstream = new Bitstream(removeEmulationPreventionBytes(sps));
    bitstream.skipBits(1);
    bitstream.skipBits(2);
    const nalUnitType = bitstream.readBits(5);
    if (nalUnitType !== 7) {
      return null;
    }
    const profileIdc = bitstream.readAlignedByte();
    const constraintFlags = bitstream.readAlignedByte();
    const levelIdc = bitstream.readAlignedByte();
    readExpGolomb(bitstream);
    let chromaFormatIdc = 1;
    let bitDepthLumaMinus8 = 0;
    let bitDepthChromaMinus8 = 0;
    let separateColourPlaneFlag = 0;
    if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
      chromaFormatIdc = readExpGolomb(bitstream);
      if (chromaFormatIdc === 3) {
        separateColourPlaneFlag = bitstream.readBits(1);
      }
      bitDepthLumaMinus8 = readExpGolomb(bitstream);
      bitDepthChromaMinus8 = readExpGolomb(bitstream);
      bitstream.skipBits(1);
      const seqScalingMatrixPresentFlag = bitstream.readBits(1);
      if (seqScalingMatrixPresentFlag) {
        for (let i = 0;i < (chromaFormatIdc !== 3 ? 8 : 12); i++) {
          const seqScalingListPresentFlag = bitstream.readBits(1);
          if (seqScalingListPresentFlag) {
            const sizeOfScalingList = i < 6 ? 16 : 64;
            let lastScale = 8;
            let nextScale = 8;
            for (let j = 0;j < sizeOfScalingList; j++) {
              if (nextScale !== 0) {
                const deltaScale = readSignedExpGolomb(bitstream);
                nextScale = (lastScale + deltaScale + 256) % 256;
              }
              lastScale = nextScale === 0 ? lastScale : nextScale;
            }
          }
        }
      }
    }
    readExpGolomb(bitstream);
    const picOrderCntType = readExpGolomb(bitstream);
    if (picOrderCntType === 0) {
      readExpGolomb(bitstream);
    } else if (picOrderCntType === 1) {
      bitstream.skipBits(1);
      readSignedExpGolomb(bitstream);
      readSignedExpGolomb(bitstream);
      const numRefFramesInPicOrderCntCycle = readExpGolomb(bitstream);
      for (let i = 0;i < numRefFramesInPicOrderCntCycle; i++) {
        readSignedExpGolomb(bitstream);
      }
    }
    readExpGolomb(bitstream);
    bitstream.skipBits(1);
    const picWidthInMbsMinus1 = readExpGolomb(bitstream);
    const picHeightInMapUnitsMinus1 = readExpGolomb(bitstream);
    const codedWidth = 16 * (picWidthInMbsMinus1 + 1);
    const codedHeight = 16 * (picHeightInMapUnitsMinus1 + 1);
    let displayWidth = codedWidth;
    let displayHeight = codedHeight;
    const frameMbsOnlyFlag = bitstream.readBits(1);
    if (!frameMbsOnlyFlag) {
      bitstream.skipBits(1);
    }
    bitstream.skipBits(1);
    const frameCroppingFlag = bitstream.readBits(1);
    if (frameCroppingFlag) {
      const frameCropLeftOffset = readExpGolomb(bitstream);
      const frameCropRightOffset = readExpGolomb(bitstream);
      const frameCropTopOffset = readExpGolomb(bitstream);
      const frameCropBottomOffset = readExpGolomb(bitstream);
      let cropUnitX;
      let cropUnitY;
      const chromaArrayType = separateColourPlaneFlag === 0 ? chromaFormatIdc : 0;
      if (chromaArrayType === 0) {
        cropUnitX = 1;
        cropUnitY = 2 - frameMbsOnlyFlag;
      } else {
        const subWidthC = chromaFormatIdc === 3 ? 1 : 2;
        const subHeightC = chromaFormatIdc === 1 ? 2 : 1;
        cropUnitX = subWidthC;
        cropUnitY = subHeightC * (2 - frameMbsOnlyFlag);
      }
      displayWidth -= cropUnitX * (frameCropLeftOffset + frameCropRightOffset);
      displayHeight -= cropUnitY * (frameCropTopOffset + frameCropBottomOffset);
    }
    let colourPrimaries = 2;
    let transferCharacteristics = 2;
    let matrixCoefficients = 2;
    let fullRangeFlag = 0;
    let pixelAspectRatio = { num: 1, den: 1 };
    let numReorderFrames = null;
    let maxDecFrameBuffering = null;
    const vuiParametersPresentFlag = bitstream.readBits(1);
    if (vuiParametersPresentFlag) {
      const aspectRatioInfoPresentFlag = bitstream.readBits(1);
      if (aspectRatioInfoPresentFlag) {
        const aspectRatioIdc = bitstream.readBits(8);
        if (aspectRatioIdc === 255) {
          pixelAspectRatio = {
            num: bitstream.readBits(16),
            den: bitstream.readBits(16)
          };
        } else {
          const aspectRatio = AVC_HEVC_ASPECT_RATIO_IDC_TABLE[aspectRatioIdc];
          if (aspectRatio) {
            pixelAspectRatio = aspectRatio;
          }
        }
      }
      const overscanInfoPresentFlag = bitstream.readBits(1);
      if (overscanInfoPresentFlag) {
        bitstream.skipBits(1);
      }
      const videoSignalTypePresentFlag = bitstream.readBits(1);
      if (videoSignalTypePresentFlag) {
        bitstream.skipBits(3);
        fullRangeFlag = bitstream.readBits(1);
        const colourDescriptionPresentFlag = bitstream.readBits(1);
        if (colourDescriptionPresentFlag) {
          colourPrimaries = bitstream.readBits(8);
          transferCharacteristics = bitstream.readBits(8);
          matrixCoefficients = bitstream.readBits(8);
        }
      }
      const chromaLocInfoPresentFlag = bitstream.readBits(1);
      if (chromaLocInfoPresentFlag) {
        readExpGolomb(bitstream);
        readExpGolomb(bitstream);
      }
      const timingInfoPresentFlag = bitstream.readBits(1);
      if (timingInfoPresentFlag) {
        bitstream.skipBits(32);
        bitstream.skipBits(32);
        bitstream.skipBits(1);
      }
      const nalHrdParametersPresentFlag = bitstream.readBits(1);
      if (nalHrdParametersPresentFlag) {
        skipAvcHrdParameters(bitstream);
      }
      const vclHrdParametersPresentFlag = bitstream.readBits(1);
      if (vclHrdParametersPresentFlag) {
        skipAvcHrdParameters(bitstream);
      }
      if (nalHrdParametersPresentFlag || vclHrdParametersPresentFlag) {
        bitstream.skipBits(1);
      }
      bitstream.skipBits(1);
      const bitstreamRestrictionFlag = bitstream.readBits(1);
      if (bitstreamRestrictionFlag) {
        bitstream.skipBits(1);
        readExpGolomb(bitstream);
        readExpGolomb(bitstream);
        readExpGolomb(bitstream);
        readExpGolomb(bitstream);
        numReorderFrames = readExpGolomb(bitstream);
        maxDecFrameBuffering = readExpGolomb(bitstream);
      }
    }
    if (numReorderFrames === null) {
      assert(maxDecFrameBuffering === null);
      const constraintSet3Flag = constraintFlags & 16;
      if ((profileIdc === 44 || profileIdc === 86 || profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244) && constraintSet3Flag) {
        numReorderFrames = 0;
        maxDecFrameBuffering = 0;
      } else {
        const picWidthInMbs = picWidthInMbsMinus1 + 1;
        const picHeightInMapUnits = picHeightInMapUnitsMinus1 + 1;
        const frameHeightInMbs = (2 - frameMbsOnlyFlag) * picHeightInMapUnits;
        const levelInfo = AVC_LEVEL_TABLE.find((x) => x.level >= levelIdc) ?? last(AVC_LEVEL_TABLE);
        const maxDpbFrames = Math.min(Math.floor(levelInfo.maxDpbMbs / (picWidthInMbs * frameHeightInMbs)), 16);
        numReorderFrames = maxDpbFrames;
        maxDecFrameBuffering = maxDpbFrames;
      }
    }
    assert(maxDecFrameBuffering !== null);
    return {
      profileIdc,
      constraintFlags,
      levelIdc,
      frameMbsOnlyFlag,
      chromaFormatIdc,
      bitDepthLumaMinus8,
      bitDepthChromaMinus8,
      codedWidth,
      codedHeight,
      displayWidth,
      displayHeight,
      pixelAspectRatio,
      colourPrimaries,
      matrixCoefficients,
      transferCharacteristics,
      fullRangeFlag,
      numReorderFrames,
      maxDecFrameBuffering
    };
  } catch (error) {
    console.error("Error parsing AVC SPS:", error);
    return null;
  }
};
var skipAvcHrdParameters = (bitstream) => {
  const cpb_cnt_minus1 = readExpGolomb(bitstream);
  bitstream.skipBits(4);
  bitstream.skipBits(4);
  for (let i = 0;i <= cpb_cnt_minus1; i++) {
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    bitstream.skipBits(1);
  }
  bitstream.skipBits(5);
  bitstream.skipBits(5);
  bitstream.skipBits(5);
  bitstream.skipBits(5);
};
var concatHevcNalUnits = (nalUnits, decoderConfig) => {
  if (decoderConfig.description) {
    const bytes = toUint8Array(decoderConfig.description);
    const lengthSizeMinusOne = bytes[21] & 3;
    const lengthSize = lengthSizeMinusOne + 1;
    return concatNalUnitsInLengthPrefixed(nalUnits, lengthSize);
  } else {
    return concatNalUnitsInAnnexB(nalUnits);
  }
};
var iterateHevcNalUnits = (packetData, decoderConfig) => {
  if (decoderConfig.description) {
    const bytes = toUint8Array(decoderConfig.description);
    const lengthSizeMinusOne = bytes[21] & 3;
    const lengthSize = lengthSizeMinusOne + 1;
    return iterateNalUnitsInLengthPrefixed(packetData, lengthSize);
  } else {
    return iterateNalUnitsInAnnexB(packetData);
  }
};
var extractNalUnitTypeForHevc = (byte) => {
  return byte >> 1 & 63;
};
var parseHevcSps = (sps) => {
  try {
    const bitstream = new Bitstream(removeEmulationPreventionBytes(sps));
    bitstream.skipBits(16);
    bitstream.readBits(4);
    const spsMaxSubLayersMinus1 = bitstream.readBits(3);
    const spsTemporalIdNestingFlag = bitstream.readBits(1);
    const { general_profile_space, general_tier_flag, general_profile_idc, general_profile_compatibility_flags, general_constraint_indicator_flags, general_level_idc } = parseProfileTierLevel(bitstream, spsMaxSubLayersMinus1);
    readExpGolomb(bitstream);
    const chromaFormatIdc = readExpGolomb(bitstream);
    let separateColourPlaneFlag = 0;
    if (chromaFormatIdc === 3) {
      separateColourPlaneFlag = bitstream.readBits(1);
    }
    const picWidthInLumaSamples = readExpGolomb(bitstream);
    const picHeightInLumaSamples = readExpGolomb(bitstream);
    let displayWidth = picWidthInLumaSamples;
    let displayHeight = picHeightInLumaSamples;
    if (bitstream.readBits(1)) {
      const confWinLeftOffset = readExpGolomb(bitstream);
      const confWinRightOffset = readExpGolomb(bitstream);
      const confWinTopOffset = readExpGolomb(bitstream);
      const confWinBottomOffset = readExpGolomb(bitstream);
      let subWidthC = 1;
      let subHeightC = 1;
      const chromaArrayType = separateColourPlaneFlag === 0 ? chromaFormatIdc : 0;
      if (chromaArrayType === 1) {
        subWidthC = 2;
        subHeightC = 2;
      } else if (chromaArrayType === 2) {
        subWidthC = 2;
        subHeightC = 1;
      }
      displayWidth -= (confWinLeftOffset + confWinRightOffset) * subWidthC;
      displayHeight -= (confWinTopOffset + confWinBottomOffset) * subHeightC;
    }
    const bitDepthLumaMinus8 = readExpGolomb(bitstream);
    const bitDepthChromaMinus8 = readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    const spsSubLayerOrderingInfoPresentFlag = bitstream.readBits(1);
    const startI = spsSubLayerOrderingInfoPresentFlag ? 0 : spsMaxSubLayersMinus1;
    let spsMaxNumReorderPics = 0;
    for (let i = startI;i <= spsMaxSubLayersMinus1; i++) {
      readExpGolomb(bitstream);
      spsMaxNumReorderPics = readExpGolomb(bitstream);
      readExpGolomb(bitstream);
    }
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    if (bitstream.readBits(1)) {
      if (bitstream.readBits(1)) {
        skipScalingListData(bitstream);
      }
    }
    bitstream.skipBits(1);
    bitstream.skipBits(1);
    if (bitstream.readBits(1)) {
      bitstream.skipBits(4);
      bitstream.skipBits(4);
      readExpGolomb(bitstream);
      readExpGolomb(bitstream);
      bitstream.skipBits(1);
    }
    const numShortTermRefPicSets = readExpGolomb(bitstream);
    skipAllStRefPicSets(bitstream, numShortTermRefPicSets);
    if (bitstream.readBits(1)) {
      const numLongTermRefPicsSps = readExpGolomb(bitstream);
      for (let i = 0;i < numLongTermRefPicsSps; i++) {
        readExpGolomb(bitstream);
        bitstream.skipBits(1);
      }
    }
    bitstream.skipBits(1);
    bitstream.skipBits(1);
    let colourPrimaries = 2;
    let transferCharacteristics = 2;
    let matrixCoefficients = 2;
    let fullRangeFlag = 0;
    let minSpatialSegmentationIdc = 0;
    let pixelAspectRatio = { num: 1, den: 1 };
    if (bitstream.readBits(1)) {
      const vui = parseHevcVui(bitstream, spsMaxSubLayersMinus1);
      pixelAspectRatio = vui.pixelAspectRatio;
      colourPrimaries = vui.colourPrimaries;
      transferCharacteristics = vui.transferCharacteristics;
      matrixCoefficients = vui.matrixCoefficients;
      fullRangeFlag = vui.fullRangeFlag;
      minSpatialSegmentationIdc = vui.minSpatialSegmentationIdc;
    }
    return {
      displayWidth,
      displayHeight,
      pixelAspectRatio,
      colourPrimaries,
      transferCharacteristics,
      matrixCoefficients,
      fullRangeFlag,
      maxDecFrameBuffering: spsMaxNumReorderPics + 1,
      spsMaxSubLayersMinus1,
      spsTemporalIdNestingFlag,
      generalProfileSpace: general_profile_space,
      generalTierFlag: general_tier_flag,
      generalProfileIdc: general_profile_idc,
      generalProfileCompatibilityFlags: general_profile_compatibility_flags,
      generalConstraintIndicatorFlags: general_constraint_indicator_flags,
      generalLevelIdc: general_level_idc,
      chromaFormatIdc,
      bitDepthLumaMinus8,
      bitDepthChromaMinus8,
      minSpatialSegmentationIdc
    };
  } catch (error) {
    console.error("Error parsing HEVC SPS:", error);
    return null;
  }
};
var extractHevcDecoderConfigurationRecord = (packetData) => {
  try {
    const vpsUnits = [];
    const spsUnits = [];
    const ppsUnits = [];
    const seiUnits = [];
    for (const loc of iterateNalUnitsInAnnexB(packetData)) {
      const nalUnit = packetData.subarray(loc.offset, loc.offset + loc.length);
      const type = extractNalUnitTypeForHevc(nalUnit[0]);
      if (type === HevcNalUnitType.VPS_NUT) {
        vpsUnits.push(nalUnit);
      } else if (type === HevcNalUnitType.SPS_NUT) {
        spsUnits.push(nalUnit);
      } else if (type === HevcNalUnitType.PPS_NUT) {
        ppsUnits.push(nalUnit);
      } else if (type === HevcNalUnitType.PREFIX_SEI_NUT || type === HevcNalUnitType.SUFFIX_SEI_NUT) {
        seiUnits.push(nalUnit);
      }
    }
    if (spsUnits.length === 0 || ppsUnits.length === 0)
      return null;
    const spsInfo = parseHevcSps(spsUnits[0]);
    if (!spsInfo)
      return null;
    let parallelismType = 0;
    if (ppsUnits.length > 0) {
      const pps = ppsUnits[0];
      const ppsBitstream = new Bitstream(removeEmulationPreventionBytes(pps));
      ppsBitstream.skipBits(16);
      readExpGolomb(ppsBitstream);
      readExpGolomb(ppsBitstream);
      ppsBitstream.skipBits(1);
      ppsBitstream.skipBits(1);
      ppsBitstream.skipBits(3);
      ppsBitstream.skipBits(1);
      ppsBitstream.skipBits(1);
      readExpGolomb(ppsBitstream);
      readExpGolomb(ppsBitstream);
      readSignedExpGolomb(ppsBitstream);
      ppsBitstream.skipBits(1);
      ppsBitstream.skipBits(1);
      if (ppsBitstream.readBits(1)) {
        readExpGolomb(ppsBitstream);
      }
      readSignedExpGolomb(ppsBitstream);
      readSignedExpGolomb(ppsBitstream);
      ppsBitstream.skipBits(1);
      ppsBitstream.skipBits(1);
      ppsBitstream.skipBits(1);
      ppsBitstream.skipBits(1);
      const tiles_enabled_flag = ppsBitstream.readBits(1);
      const entropy_coding_sync_enabled_flag = ppsBitstream.readBits(1);
      if (!tiles_enabled_flag && !entropy_coding_sync_enabled_flag)
        parallelismType = 0;
      else if (tiles_enabled_flag && !entropy_coding_sync_enabled_flag)
        parallelismType = 2;
      else if (!tiles_enabled_flag && entropy_coding_sync_enabled_flag)
        parallelismType = 3;
      else
        parallelismType = 0;
    }
    const arrays = [
      ...vpsUnits.length ? [
        {
          arrayCompleteness: 1,
          nalUnitType: HevcNalUnitType.VPS_NUT,
          nalUnits: vpsUnits
        }
      ] : [],
      ...spsUnits.length ? [
        {
          arrayCompleteness: 1,
          nalUnitType: HevcNalUnitType.SPS_NUT,
          nalUnits: spsUnits
        }
      ] : [],
      ...ppsUnits.length ? [
        {
          arrayCompleteness: 1,
          nalUnitType: HevcNalUnitType.PPS_NUT,
          nalUnits: ppsUnits
        }
      ] : [],
      ...seiUnits.length ? [
        {
          arrayCompleteness: 1,
          nalUnitType: extractNalUnitTypeForHevc(seiUnits[0][0]),
          nalUnits: seiUnits
        }
      ] : []
    ];
    const record = {
      configurationVersion: 1,
      generalProfileSpace: spsInfo.generalProfileSpace,
      generalTierFlag: spsInfo.generalTierFlag,
      generalProfileIdc: spsInfo.generalProfileIdc,
      generalProfileCompatibilityFlags: spsInfo.generalProfileCompatibilityFlags,
      generalConstraintIndicatorFlags: spsInfo.generalConstraintIndicatorFlags,
      generalLevelIdc: spsInfo.generalLevelIdc,
      minSpatialSegmentationIdc: spsInfo.minSpatialSegmentationIdc,
      parallelismType,
      chromaFormatIdc: spsInfo.chromaFormatIdc,
      bitDepthLumaMinus8: spsInfo.bitDepthLumaMinus8,
      bitDepthChromaMinus8: spsInfo.bitDepthChromaMinus8,
      avgFrameRate: 0,
      constantFrameRate: 0,
      numTemporalLayers: spsInfo.spsMaxSubLayersMinus1 + 1,
      temporalIdNested: spsInfo.spsTemporalIdNestingFlag,
      lengthSizeMinusOne: 3,
      arrays
    };
    return record;
  } catch (error) {
    console.error("Error building HEVC Decoder Configuration Record:", error);
    return null;
  }
};
var parseProfileTierLevel = (bitstream, maxNumSubLayersMinus1) => {
  const general_profile_space = bitstream.readBits(2);
  const general_tier_flag = bitstream.readBits(1);
  const general_profile_idc = bitstream.readBits(5);
  let general_profile_compatibility_flags = 0;
  for (let i = 0;i < 32; i++) {
    general_profile_compatibility_flags = general_profile_compatibility_flags << 1 | bitstream.readBits(1);
  }
  const general_constraint_indicator_flags = new Uint8Array(6);
  for (let i = 0;i < 6; i++) {
    general_constraint_indicator_flags[i] = bitstream.readBits(8);
  }
  const general_level_idc = bitstream.readBits(8);
  const sub_layer_profile_present_flag = [];
  const sub_layer_level_present_flag = [];
  for (let i = 0;i < maxNumSubLayersMinus1; i++) {
    sub_layer_profile_present_flag.push(bitstream.readBits(1));
    sub_layer_level_present_flag.push(bitstream.readBits(1));
  }
  if (maxNumSubLayersMinus1 > 0) {
    for (let i = maxNumSubLayersMinus1;i < 8; i++) {
      bitstream.skipBits(2);
    }
  }
  for (let i = 0;i < maxNumSubLayersMinus1; i++) {
    if (sub_layer_profile_present_flag[i])
      bitstream.skipBits(88);
    if (sub_layer_level_present_flag[i])
      bitstream.skipBits(8);
  }
  return {
    general_profile_space,
    general_tier_flag,
    general_profile_idc,
    general_profile_compatibility_flags,
    general_constraint_indicator_flags,
    general_level_idc
  };
};
var skipScalingListData = (bitstream) => {
  for (let sizeId = 0;sizeId < 4; sizeId++) {
    for (let matrixId = 0;matrixId < (sizeId === 3 ? 2 : 6); matrixId++) {
      const scaling_list_pred_mode_flag = bitstream.readBits(1);
      if (!scaling_list_pred_mode_flag) {
        readExpGolomb(bitstream);
      } else {
        const coefNum = Math.min(64, 1 << 4 + (sizeId << 1));
        if (sizeId > 1) {
          readSignedExpGolomb(bitstream);
        }
        for (let i = 0;i < coefNum; i++) {
          readSignedExpGolomb(bitstream);
        }
      }
    }
  }
};
var skipAllStRefPicSets = (bitstream, num_short_term_ref_pic_sets) => {
  const NumDeltaPocs = [];
  for (let stRpsIdx = 0;stRpsIdx < num_short_term_ref_pic_sets; stRpsIdx++) {
    NumDeltaPocs[stRpsIdx] = skipStRefPicSet(bitstream, stRpsIdx, num_short_term_ref_pic_sets, NumDeltaPocs);
  }
};
var skipStRefPicSet = (bitstream, stRpsIdx, num_short_term_ref_pic_sets, NumDeltaPocs) => {
  let NumDeltaPocsThis = 0;
  let inter_ref_pic_set_prediction_flag = 0;
  let RefRpsIdx = 0;
  if (stRpsIdx !== 0) {
    inter_ref_pic_set_prediction_flag = bitstream.readBits(1);
  }
  if (inter_ref_pic_set_prediction_flag) {
    if (stRpsIdx === num_short_term_ref_pic_sets) {
      const delta_idx_minus1 = readExpGolomb(bitstream);
      RefRpsIdx = stRpsIdx - (delta_idx_minus1 + 1);
    } else {
      RefRpsIdx = stRpsIdx - 1;
    }
    bitstream.readBits(1);
    readExpGolomb(bitstream);
    const numDelta = NumDeltaPocs[RefRpsIdx] ?? 0;
    for (let j = 0;j <= numDelta; j++) {
      const used_by_curr_pic_flag = bitstream.readBits(1);
      if (!used_by_curr_pic_flag) {
        bitstream.readBits(1);
      }
    }
    NumDeltaPocsThis = NumDeltaPocs[RefRpsIdx];
  } else {
    const num_negative_pics = readExpGolomb(bitstream);
    const num_positive_pics = readExpGolomb(bitstream);
    for (let i = 0;i < num_negative_pics; i++) {
      readExpGolomb(bitstream);
      bitstream.readBits(1);
    }
    for (let i = 0;i < num_positive_pics; i++) {
      readExpGolomb(bitstream);
      bitstream.readBits(1);
    }
    NumDeltaPocsThis = num_negative_pics + num_positive_pics;
  }
  return NumDeltaPocsThis;
};
var parseHevcVui = (bitstream, sps_max_sub_layers_minus1) => {
  let colourPrimaries = 2;
  let transferCharacteristics = 2;
  let matrixCoefficients = 2;
  let fullRangeFlag = 0;
  let minSpatialSegmentationIdc = 0;
  let pixelAspectRatio = { num: 1, den: 1 };
  if (bitstream.readBits(1)) {
    const aspect_ratio_idc = bitstream.readBits(8);
    if (aspect_ratio_idc === 255) {
      pixelAspectRatio = {
        num: bitstream.readBits(16),
        den: bitstream.readBits(16)
      };
    } else {
      const aspectRatio = AVC_HEVC_ASPECT_RATIO_IDC_TABLE[aspect_ratio_idc];
      if (aspectRatio) {
        pixelAspectRatio = aspectRatio;
      }
    }
  }
  if (bitstream.readBits(1)) {
    bitstream.readBits(1);
  }
  if (bitstream.readBits(1)) {
    bitstream.readBits(3);
    fullRangeFlag = bitstream.readBits(1);
    if (bitstream.readBits(1)) {
      colourPrimaries = bitstream.readBits(8);
      transferCharacteristics = bitstream.readBits(8);
      matrixCoefficients = bitstream.readBits(8);
    }
  }
  if (bitstream.readBits(1)) {
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
  }
  bitstream.readBits(1);
  bitstream.readBits(1);
  bitstream.readBits(1);
  if (bitstream.readBits(1)) {
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
  }
  if (bitstream.readBits(1)) {
    bitstream.readBits(32);
    bitstream.readBits(32);
    if (bitstream.readBits(1)) {
      readExpGolomb(bitstream);
    }
    if (bitstream.readBits(1)) {
      skipHevcHrdParameters(bitstream, true, sps_max_sub_layers_minus1);
    }
  }
  if (bitstream.readBits(1)) {
    bitstream.readBits(1);
    bitstream.readBits(1);
    bitstream.readBits(1);
    minSpatialSegmentationIdc = readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
  }
  return {
    pixelAspectRatio,
    colourPrimaries,
    transferCharacteristics,
    matrixCoefficients,
    fullRangeFlag,
    minSpatialSegmentationIdc
  };
};
var skipHevcHrdParameters = (bitstream, commonInfPresentFlag, maxNumSubLayersMinus1) => {
  let nal_hrd_parameters_present_flag = false;
  let vcl_hrd_parameters_present_flag = false;
  let sub_pic_hrd_params_present_flag = false;
  if (commonInfPresentFlag) {
    nal_hrd_parameters_present_flag = bitstream.readBits(1) === 1;
    vcl_hrd_parameters_present_flag = bitstream.readBits(1) === 1;
    if (nal_hrd_parameters_present_flag || vcl_hrd_parameters_present_flag) {
      sub_pic_hrd_params_present_flag = bitstream.readBits(1) === 1;
      if (sub_pic_hrd_params_present_flag) {
        bitstream.readBits(8);
        bitstream.readBits(5);
        bitstream.readBits(1);
        bitstream.readBits(5);
      }
      bitstream.readBits(4);
      bitstream.readBits(4);
      if (sub_pic_hrd_params_present_flag) {
        bitstream.readBits(4);
      }
      bitstream.readBits(5);
      bitstream.readBits(5);
      bitstream.readBits(5);
    }
  }
  for (let i = 0;i <= maxNumSubLayersMinus1; i++) {
    const fixed_pic_rate_general_flag = bitstream.readBits(1) === 1;
    let fixed_pic_rate_within_cvs_flag = true;
    if (!fixed_pic_rate_general_flag) {
      fixed_pic_rate_within_cvs_flag = bitstream.readBits(1) === 1;
    }
    let low_delay_hrd_flag = false;
    if (fixed_pic_rate_within_cvs_flag) {
      readExpGolomb(bitstream);
    } else {
      low_delay_hrd_flag = bitstream.readBits(1) === 1;
    }
    let CpbCnt = 1;
    if (!low_delay_hrd_flag) {
      const cpb_cnt_minus1 = readExpGolomb(bitstream);
      CpbCnt = cpb_cnt_minus1 + 1;
    }
    if (nal_hrd_parameters_present_flag) {
      skipSubLayerHrdParameters(bitstream, CpbCnt, sub_pic_hrd_params_present_flag);
    }
    if (vcl_hrd_parameters_present_flag) {
      skipSubLayerHrdParameters(bitstream, CpbCnt, sub_pic_hrd_params_present_flag);
    }
  }
};
var skipSubLayerHrdParameters = (bitstream, CpbCnt, sub_pic_hrd_params_present_flag) => {
  for (let i = 0;i < CpbCnt; i++) {
    readExpGolomb(bitstream);
    readExpGolomb(bitstream);
    if (sub_pic_hrd_params_present_flag) {
      readExpGolomb(bitstream);
      readExpGolomb(bitstream);
    }
    bitstream.readBits(1);
  }
};
var HevcNaluOrderState;
(function(HevcNaluOrderState2) {
  HevcNaluOrderState2[HevcNaluOrderState2["audAllowed"] = 0] = "audAllowed";
  HevcNaluOrderState2[HevcNaluOrderState2["beforeFirstVcl"] = 1] = "beforeFirstVcl";
  HevcNaluOrderState2[HevcNaluOrderState2["afterFirstVcl"] = 2] = "afterFirstVcl";
  HevcNaluOrderState2[HevcNaluOrderState2["eoBitstreamAllowed"] = 3] = "eoBitstreamAllowed";
  HevcNaluOrderState2[HevcNaluOrderState2["noMoreDataAllowed"] = 4] = "noMoreDataAllowed";
})(HevcNaluOrderState || (HevcNaluOrderState = {}));
var sanitizeHevcPacketForChromium = (packetData, decoderConfig) => {
  const removedNalUnits = new Set;
  let orderState = HevcNaluOrderState.audAllowed;
  for (const loc of iterateHevcNalUnits(packetData, decoderConfig)) {
    if (orderState === HevcNaluOrderState.noMoreDataAllowed) {
      removedNalUnits.add(loc.offset);
      continue;
    }
    const type = extractNalUnitTypeForHevc(packetData[loc.offset]);
    if (orderState === HevcNaluOrderState.eoBitstreamAllowed && type !== 37) {
      removedNalUnits.add(loc.offset);
      continue;
    }
    let remove = false;
    if (type === 35) {
      if (orderState > HevcNaluOrderState.audAllowed) {
        remove = true;
      } else {
        orderState = HevcNaluOrderState.beforeFirstVcl;
      }
    } else if (type <= 31) {
      if (orderState > HevcNaluOrderState.afterFirstVcl) {
        remove = true;
      } else {
        orderState = HevcNaluOrderState.afterFirstVcl;
      }
    } else if (type === 36) {
      if (orderState !== HevcNaluOrderState.afterFirstVcl) {
        remove = true;
      } else {
        orderState = HevcNaluOrderState.eoBitstreamAllowed;
      }
    } else if (type === 37) {
      if (orderState < HevcNaluOrderState.afterFirstVcl) {
        remove = true;
      } else {
        orderState = HevcNaluOrderState.noMoreDataAllowed;
      }
    } else if (type === 32 || type === 33 || type === 34 || type === 39 || type >= 41 && type <= 44 || type >= 48 && type <= 55) {
      if (orderState > HevcNaluOrderState.beforeFirstVcl) {
        remove = true;
      } else {
        orderState = HevcNaluOrderState.beforeFirstVcl;
      }
    } else if (type === 38 || type === 40 || type >= 45 && type <= 47 || type >= 56 && type <= 63) {
      if (orderState < HevcNaluOrderState.afterFirstVcl) {
        remove = true;
      }
    }
    if (remove) {
      removedNalUnits.add(loc.offset);
    }
  }
  if (removedNalUnits.size === 0) {
    return null;
  }
  const filteredNalUnits = [];
  for (const loc of iterateHevcNalUnits(packetData, decoderConfig)) {
    if (!removedNalUnits.has(loc.offset)) {
      filteredNalUnits.push(packetData.subarray(loc.offset, loc.offset + loc.length));
    }
  }
  return concatHevcNalUnits(filteredNalUnits, decoderConfig);
};
var extractVp9CodecInfoFromPacket = (packet) => {
  const bitstream = new Bitstream(packet);
  const frameMarker = bitstream.readBits(2);
  if (frameMarker !== 2) {
    return null;
  }
  const profileLowBit = bitstream.readBits(1);
  const profileHighBit = bitstream.readBits(1);
  const profile = (profileHighBit << 1) + profileLowBit;
  if (profile === 3) {
    bitstream.skipBits(1);
  }
  const showExistingFrame = bitstream.readBits(1);
  if (showExistingFrame === 1) {
    return null;
  }
  const frameType = bitstream.readBits(1);
  if (frameType !== 0) {
    return null;
  }
  bitstream.skipBits(2);
  const syncCode = bitstream.readBits(24);
  if (syncCode !== 4817730) {
    return null;
  }
  let bitDepth = 8;
  if (profile >= 2) {
    const tenOrTwelveBit = bitstream.readBits(1);
    bitDepth = tenOrTwelveBit ? 12 : 10;
  }
  const colorSpace = bitstream.readBits(3);
  let chromaSubsampling = 0;
  let videoFullRangeFlag = 0;
  if (colorSpace !== 7) {
    const colorRange = bitstream.readBits(1);
    videoFullRangeFlag = colorRange;
    if (profile === 1 || profile === 3) {
      const subsamplingX = bitstream.readBits(1);
      const subsamplingY = bitstream.readBits(1);
      chromaSubsampling = !subsamplingX && !subsamplingY ? 3 : subsamplingX && !subsamplingY ? 2 : 1;
      bitstream.skipBits(1);
    } else {
      chromaSubsampling = 1;
    }
  } else {
    chromaSubsampling = 3;
    videoFullRangeFlag = 1;
  }
  const widthMinusOne = bitstream.readBits(16);
  const heightMinusOne = bitstream.readBits(16);
  const width = widthMinusOne + 1;
  const height = heightMinusOne + 1;
  const pictureSize = width * height;
  let level = last(VP9_LEVEL_TABLE).level;
  for (const entry of VP9_LEVEL_TABLE) {
    if (pictureSize <= entry.maxPictureSize) {
      level = entry.level;
      break;
    }
  }
  const matrixCoefficients = colorSpace === 7 ? 0 : colorSpace === 2 ? 1 : colorSpace === 1 ? 6 : 2;
  const colourPrimaries = colorSpace === 2 ? 1 : colorSpace === 1 ? 6 : 2;
  const transferCharacteristics = colorSpace === 2 ? 1 : colorSpace === 1 ? 6 : 2;
  return {
    profile,
    level,
    bitDepth,
    chromaSubsampling,
    videoFullRangeFlag,
    colourPrimaries,
    transferCharacteristics,
    matrixCoefficients
  };
};
var iterateAv1PacketObus = function* (packet) {
  const bitstream = new Bitstream(packet);
  const readLeb128 = () => {
    let value = 0;
    for (let i = 0;i < 8; i++) {
      const byte = bitstream.readAlignedByte();
      value |= (byte & 127) << i * 7;
      if (!(byte & 128)) {
        break;
      }
      if (i === 7 && byte & 128) {
        return null;
      }
    }
    if (value >= 2 ** 32 - 1) {
      return null;
    }
    return value;
  };
  while (bitstream.getBitsLeft() >= 8) {
    bitstream.skipBits(1);
    const obuType = bitstream.readBits(4);
    const obuExtension = bitstream.readBits(1);
    const obuHasSizeField = bitstream.readBits(1);
    bitstream.skipBits(1);
    if (obuExtension) {
      bitstream.skipBits(8);
    }
    let obuSize;
    if (obuHasSizeField) {
      const obuSizeValue = readLeb128();
      if (obuSizeValue === null)
        return;
      obuSize = obuSizeValue;
    } else {
      obuSize = Math.floor(bitstream.getBitsLeft() / 8);
    }
    assert(bitstream.pos % 8 === 0);
    yield {
      type: obuType,
      data: packet.subarray(bitstream.pos / 8, bitstream.pos / 8 + obuSize)
    };
    bitstream.skipBits(obuSize * 8);
  }
};
var extractAv1CodecInfoFromPacket = (packet) => {
  for (const { type, data } of iterateAv1PacketObus(packet)) {
    if (type !== 1) {
      continue;
    }
    const bitstream = new Bitstream(data);
    const seqProfile = bitstream.readBits(3);
    const stillPicture = bitstream.readBits(1);
    const reducedStillPictureHeader = bitstream.readBits(1);
    let seqLevel = 0;
    let seqTier = 0;
    let bufferDelayLengthMinus1 = 0;
    if (reducedStillPictureHeader) {
      seqLevel = bitstream.readBits(5);
    } else {
      const timingInfoPresentFlag = bitstream.readBits(1);
      if (timingInfoPresentFlag) {
        bitstream.skipBits(32);
        bitstream.skipBits(32);
        const equalPictureInterval = bitstream.readBits(1);
        if (equalPictureInterval) {
          return null;
        }
      }
      const decoderModelInfoPresentFlag = bitstream.readBits(1);
      if (decoderModelInfoPresentFlag) {
        bufferDelayLengthMinus1 = bitstream.readBits(5);
        bitstream.skipBits(32);
        bitstream.skipBits(5);
        bitstream.skipBits(5);
      }
      const operatingPointsCntMinus1 = bitstream.readBits(5);
      for (let i = 0;i <= operatingPointsCntMinus1; i++) {
        bitstream.skipBits(12);
        const seqLevelIdx = bitstream.readBits(5);
        if (i === 0) {
          seqLevel = seqLevelIdx;
        }
        if (seqLevelIdx > 7) {
          const seqTierTemp = bitstream.readBits(1);
          if (i === 0) {
            seqTier = seqTierTemp;
          }
        }
        if (decoderModelInfoPresentFlag) {
          const decoderModelPresentForThisOp = bitstream.readBits(1);
          if (decoderModelPresentForThisOp) {
            const n = bufferDelayLengthMinus1 + 1;
            bitstream.skipBits(n);
            bitstream.skipBits(n);
            bitstream.skipBits(1);
          }
        }
        const initialDisplayDelayPresentFlag = bitstream.readBits(1);
        if (initialDisplayDelayPresentFlag) {
          bitstream.skipBits(4);
        }
      }
    }
    const frameWidthBitsMinus1 = bitstream.readBits(4);
    const frameHeightBitsMinus1 = bitstream.readBits(4);
    const n1 = frameWidthBitsMinus1 + 1;
    bitstream.skipBits(n1);
    const n2 = frameHeightBitsMinus1 + 1;
    bitstream.skipBits(n2);
    let frameIdNumbersPresentFlag = 0;
    if (reducedStillPictureHeader) {
      frameIdNumbersPresentFlag = 0;
    } else {
      frameIdNumbersPresentFlag = bitstream.readBits(1);
    }
    if (frameIdNumbersPresentFlag) {
      bitstream.skipBits(4);
      bitstream.skipBits(3);
    }
    bitstream.skipBits(1);
    bitstream.skipBits(1);
    bitstream.skipBits(1);
    if (!reducedStillPictureHeader) {
      bitstream.skipBits(1);
      bitstream.skipBits(1);
      bitstream.skipBits(1);
      bitstream.skipBits(1);
      const enableOrderHint = bitstream.readBits(1);
      if (enableOrderHint) {
        bitstream.skipBits(1);
        bitstream.skipBits(1);
      }
      const seqChooseScreenContentTools = bitstream.readBits(1);
      let seqForceScreenContentTools = 0;
      if (seqChooseScreenContentTools) {
        seqForceScreenContentTools = 2;
      } else {
        seqForceScreenContentTools = bitstream.readBits(1);
      }
      if (seqForceScreenContentTools > 0) {
        const seqChooseIntegerMv = bitstream.readBits(1);
        if (!seqChooseIntegerMv) {
          bitstream.skipBits(1);
        }
      }
      if (enableOrderHint) {
        bitstream.skipBits(3);
      }
    }
    bitstream.skipBits(1);
    bitstream.skipBits(1);
    bitstream.skipBits(1);
    const highBitdepth = bitstream.readBits(1);
    let bitDepth = 8;
    if (seqProfile === 2 && highBitdepth) {
      const twelveBit = bitstream.readBits(1);
      bitDepth = twelveBit ? 12 : 10;
    } else if (seqProfile <= 2) {
      bitDepth = highBitdepth ? 10 : 8;
    }
    let monochrome = 0;
    if (seqProfile !== 1) {
      monochrome = bitstream.readBits(1);
    }
    let chromaSubsamplingX = 1;
    let chromaSubsamplingY = 1;
    let chromaSamplePosition = 0;
    if (!monochrome) {
      if (seqProfile === 0) {
        chromaSubsamplingX = 1;
        chromaSubsamplingY = 1;
      } else if (seqProfile === 1) {
        chromaSubsamplingX = 0;
        chromaSubsamplingY = 0;
      } else {
        if (bitDepth === 12) {
          chromaSubsamplingX = bitstream.readBits(1);
          if (chromaSubsamplingX) {
            chromaSubsamplingY = bitstream.readBits(1);
          }
        }
      }
      if (chromaSubsamplingX && chromaSubsamplingY) {
        chromaSamplePosition = bitstream.readBits(2);
      }
    }
    return {
      profile: seqProfile,
      level: seqLevel,
      tier: seqTier,
      bitDepth,
      monochrome,
      chromaSubsamplingX,
      chromaSubsamplingY,
      chromaSamplePosition
    };
  }
  return null;
};
var parseOpusIdentificationHeader = (bytes) => {
  const view = toDataView(bytes);
  const outputChannelCount = view.getUint8(9);
  const preSkip = view.getUint16(10, true);
  const inputSampleRate = view.getUint32(12, true);
  const outputGain = view.getInt16(16, true);
  const channelMappingFamily = view.getUint8(18);
  let channelMappingTable = null;
  if (channelMappingFamily) {
    channelMappingTable = bytes.subarray(19, 19 + 2 + outputChannelCount);
  }
  return {
    outputChannelCount,
    preSkip,
    inputSampleRate,
    outputGain,
    channelMappingFamily,
    channelMappingTable
  };
};
var OPUS_FRAME_DURATION_TABLE = [
  480,
  960,
  1920,
  2880,
  480,
  960,
  1920,
  2880,
  480,
  960,
  1920,
  2880,
  480,
  960,
  480,
  960,
  120,
  240,
  480,
  960,
  120,
  240,
  480,
  960,
  120,
  240,
  480,
  960,
  120,
  240,
  480,
  960
];
var parseOpusTocByte = (packet) => {
  const config = packet[0] >> 3;
  return {
    durationInSamples: OPUS_FRAME_DURATION_TABLE[config]
  };
};
var parseModesFromVorbisSetupPacket = (setupHeader) => {
  if (setupHeader.length < 7) {
    throw new Error("Setup header is too short.");
  }
  if (setupHeader[0] !== 5) {
    throw new Error("Wrong packet type in Setup header.");
  }
  const signature = String.fromCharCode(...setupHeader.slice(1, 7));
  if (signature !== "vorbis") {
    throw new Error("Invalid packet signature in Setup header.");
  }
  const bufSize = setupHeader.length;
  const revBuffer = new Uint8Array(bufSize);
  for (let i = 0;i < bufSize; i++) {
    revBuffer[i] = setupHeader[bufSize - 1 - i];
  }
  const bitstream = new Bitstream(revBuffer);
  let gotFramingBit = 0;
  while (bitstream.getBitsLeft() > 97) {
    if (bitstream.readBits(1) === 1) {
      gotFramingBit = bitstream.pos;
      break;
    }
  }
  if (gotFramingBit === 0) {
    throw new Error("Invalid Setup header: framing bit not found.");
  }
  let modeCount = 0;
  let gotModeHeader = false;
  let lastModeCount = 0;
  while (bitstream.getBitsLeft() >= 97) {
    const tempPos = bitstream.pos;
    const a = bitstream.readBits(8);
    const b = bitstream.readBits(16);
    const c = bitstream.readBits(16);
    if (a > 63 || b !== 0 || c !== 0) {
      bitstream.pos = tempPos;
      break;
    }
    bitstream.skipBits(1);
    modeCount++;
    if (modeCount > 64) {
      break;
    }
    const bsClone = bitstream.clone();
    const candidate = bsClone.readBits(6) + 1;
    if (candidate === modeCount) {
      gotModeHeader = true;
      lastModeCount = modeCount;
    }
  }
  if (!gotModeHeader) {
    throw new Error("Invalid Setup header: mode header not found.");
  }
  if (lastModeCount > 63) {
    throw new Error(`Unsupported mode count: ${lastModeCount}.`);
  }
  const finalModeCount = lastModeCount;
  bitstream.pos = 0;
  bitstream.skipBits(gotFramingBit);
  const modeBlockflags = Array(finalModeCount).fill(0);
  for (let i = finalModeCount - 1;i >= 0; i--) {
    bitstream.skipBits(40);
    modeBlockflags[i] = bitstream.readBits(1);
  }
  return { modeBlockflags };
};
var determineVideoPacketType = (codec, decoderConfig, packetData) => {
  switch (codec) {
    case "avc":
      {
        for (const loc of iterateAvcNalUnits(packetData, decoderConfig)) {
          const nalTypeByte = packetData[loc.offset];
          const type = extractNalUnitTypeForAvc(nalTypeByte);
          if (type >= AvcNalUnitType.NON_IDR_SLICE && type <= AvcNalUnitType.SLICE_DPC) {
            return "delta";
          }
          if (type === AvcNalUnitType.IDR) {
            return "key";
          }
          if (type === AvcNalUnitType.SEI && (!isChromium() || getChromiumVersion() >= 144)) {
            const nalUnit = packetData.subarray(loc.offset, loc.offset + loc.length);
            const bytes = removeEmulationPreventionBytes(nalUnit);
            let pos = 1;
            do {
              let payloadType = 0;
              while (true) {
                const nextByte = bytes[pos++];
                if (nextByte === undefined)
                  break;
                payloadType += nextByte;
                if (nextByte < 255) {
                  break;
                }
              }
              let payloadSize = 0;
              while (true) {
                const nextByte = bytes[pos++];
                if (nextByte === undefined)
                  break;
                payloadSize += nextByte;
                if (nextByte < 255) {
                  break;
                }
              }
              const PAYLOAD_TYPE_RECOVERY_POINT = 6;
              if (payloadType === PAYLOAD_TYPE_RECOVERY_POINT) {
                const bitstream = new Bitstream(bytes);
                bitstream.pos = 8 * pos;
                const recoveryFrameCount = readExpGolomb(bitstream);
                const exactMatchFlag = bitstream.readBits(1);
                if (recoveryFrameCount === 0 && exactMatchFlag === 1) {
                  return "key";
                }
              }
              pos += payloadSize;
            } while (pos < bytes.length - 1);
          }
        }
        return "delta";
      }
      ;
    case "hevc":
      {
        for (const loc of iterateHevcNalUnits(packetData, decoderConfig)) {
          const type = extractNalUnitTypeForHevc(packetData[loc.offset]);
          if (type < HevcNalUnitType.BLA_W_LP) {
            return "delta";
          }
          if (type <= HevcNalUnitType.RSV_IRAP_VCL23) {
            return "key";
          }
        }
        return "delta";
      }
      ;
    case "vp8":
      {
        const frameType = packetData[0] & 1;
        return frameType === 0 ? "key" : "delta";
      }
      ;
    case "vp9":
      {
        const bitstream = new Bitstream(packetData);
        if (bitstream.readBits(2) !== 2) {
          return null;
        }
        const profileLowBit = bitstream.readBits(1);
        const profileHighBit = bitstream.readBits(1);
        const profile = (profileHighBit << 1) + profileLowBit;
        if (profile === 3) {
          bitstream.skipBits(1);
        }
        const showExistingFrame = bitstream.readBits(1);
        if (showExistingFrame) {
          return null;
        }
        const frameType = bitstream.readBits(1);
        return frameType === 0 ? "key" : "delta";
      }
      ;
    case "av1":
      {
        let reducedStillPictureHeader = false;
        for (const { type, data } of iterateAv1PacketObus(packetData)) {
          if (type === 1) {
            const bitstream = new Bitstream(data);
            bitstream.skipBits(4);
            reducedStillPictureHeader = !!bitstream.readBits(1);
          } else if (type === 3 || type === 6 || type === 7) {
            if (reducedStillPictureHeader) {
              return "key";
            }
            const bitstream = new Bitstream(data);
            const showExistingFrame = bitstream.readBits(1);
            if (showExistingFrame) {
              return null;
            }
            const frameType = bitstream.readBits(2);
            return frameType === 0 ? "key" : "delta";
          }
        }
        return null;
      }
      ;
    default:
      {
        assertNever(codec);
        assert(false);
      }
      ;
  }
};
var FlacBlockType;
(function(FlacBlockType2) {
  FlacBlockType2[FlacBlockType2["STREAMINFO"] = 0] = "STREAMINFO";
  FlacBlockType2[FlacBlockType2["VORBIS_COMMENT"] = 4] = "VORBIS_COMMENT";
  FlacBlockType2[FlacBlockType2["PICTURE"] = 6] = "PICTURE";
})(FlacBlockType || (FlacBlockType = {}));
var readVorbisComments = (bytes, metadataTags) => {
  const commentView = toDataView(bytes);
  let commentPos = 0;
  const vendorStringLength = commentView.getUint32(commentPos, true);
  commentPos += 4;
  const vendorString = textDecoder.decode(bytes.subarray(commentPos, commentPos + vendorStringLength));
  commentPos += vendorStringLength;
  if (vendorStringLength > 0) {
    metadataTags.raw ??= {};
    metadataTags.raw["vendor"] ??= vendorString;
  }
  const listLength = commentView.getUint32(commentPos, true);
  commentPos += 4;
  for (let i = 0;i < listLength; i++) {
    const stringLength = commentView.getUint32(commentPos, true);
    commentPos += 4;
    const string = textDecoder.decode(bytes.subarray(commentPos, commentPos + stringLength));
    commentPos += stringLength;
    const separatorIndex = string.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = string.slice(0, separatorIndex).toUpperCase();
    const value = string.slice(separatorIndex + 1);
    metadataTags.raw ??= {};
    metadataTags.raw[key] ??= value;
    switch (key) {
      case "TITLE":
        {
          metadataTags.title ??= value;
        }
        ;
        break;
      case "DESCRIPTION":
        {
          metadataTags.description ??= value;
        }
        ;
        break;
      case "ARTIST":
        {
          metadataTags.artist ??= value;
        }
        ;
        break;
      case "ALBUM":
        {
          metadataTags.album ??= value;
        }
        ;
        break;
      case "ALBUMARTIST":
        {
          metadataTags.albumArtist ??= value;
        }
        ;
        break;
      case "COMMENT":
        {
          metadataTags.comment ??= value;
        }
        ;
        break;
      case "LYRICS":
        {
          metadataTags.lyrics ??= value;
        }
        ;
        break;
      case "TRACKNUMBER":
        {
          const parts = value.split("/");
          const trackNum = Number.parseInt(parts[0], 10);
          const tracksTotal = parts[1] && Number.parseInt(parts[1], 10);
          if (Number.isInteger(trackNum) && trackNum > 0) {
            metadataTags.trackNumber ??= trackNum;
          }
          if (tracksTotal && Number.isInteger(tracksTotal) && tracksTotal > 0) {
            metadataTags.tracksTotal ??= tracksTotal;
          }
        }
        ;
        break;
      case "TRACKTOTAL":
        {
          const tracksTotal = Number.parseInt(value, 10);
          if (Number.isInteger(tracksTotal) && tracksTotal > 0) {
            metadataTags.tracksTotal ??= tracksTotal;
          }
        }
        ;
        break;
      case "DISCNUMBER":
        {
          const parts = value.split("/");
          const discNum = Number.parseInt(parts[0], 10);
          const discsTotal = parts[1] && Number.parseInt(parts[1], 10);
          if (Number.isInteger(discNum) && discNum > 0) {
            metadataTags.discNumber ??= discNum;
          }
          if (discsTotal && Number.isInteger(discsTotal) && discsTotal > 0) {
            metadataTags.discsTotal ??= discsTotal;
          }
        }
        ;
        break;
      case "DISCTOTAL":
        {
          const discsTotal = Number.parseInt(value, 10);
          if (Number.isInteger(discsTotal) && discsTotal > 0) {
            metadataTags.discsTotal ??= discsTotal;
          }
        }
        ;
        break;
      case "DATE":
        {
          const date = new Date(value);
          if (!Number.isNaN(date.getTime())) {
            metadataTags.date ??= date;
          }
        }
        ;
        break;
      case "GENRE":
        {
          metadataTags.genre ??= value;
        }
        ;
        break;
      case "METADATA_BLOCK_PICTURE":
        {
          const decoded = base64ToBytes(value);
          const view = toDataView(decoded);
          const pictureType = view.getUint32(0, false);
          const mediaTypeLength = view.getUint32(4, false);
          const mediaType = String.fromCharCode(...decoded.subarray(8, 8 + mediaTypeLength));
          const descriptionLength = view.getUint32(8 + mediaTypeLength, false);
          const description = textDecoder.decode(decoded.subarray(12 + mediaTypeLength, 12 + mediaTypeLength + descriptionLength));
          const dataLength = view.getUint32(mediaTypeLength + descriptionLength + 28);
          const data = decoded.subarray(mediaTypeLength + descriptionLength + 32, mediaTypeLength + descriptionLength + 32 + dataLength);
          metadataTags.images ??= [];
          metadataTags.images.push({
            data,
            mimeType: mediaType,
            kind: pictureType === 3 ? "coverFront" : pictureType === 4 ? "coverBack" : "unknown",
            name: undefined,
            description: description || undefined
          });
        }
        ;
        break;
    }
  }
};
var AC3_ACMOD_CHANNEL_COUNTS = [2, 1, 2, 3, 3, 4, 4, 5];
var parseAc3SyncFrame = (data) => {
  if (data.length < 7) {
    return null;
  }
  if (data[0] !== 11 || data[1] !== 119) {
    return null;
  }
  const bitstream = new Bitstream(data);
  bitstream.skipBits(16);
  bitstream.skipBits(16);
  const fscod = bitstream.readBits(2);
  if (fscod === 3) {
    return null;
  }
  const frmsizecod = bitstream.readBits(6);
  const bsid = bitstream.readBits(5);
  if (bsid > 8) {
    return null;
  }
  const bsmod = bitstream.readBits(3);
  const acmod = bitstream.readBits(3);
  if ((acmod & 1) !== 0 && acmod !== 1) {
    bitstream.skipBits(2);
  }
  if ((acmod & 4) !== 0) {
    bitstream.skipBits(2);
  }
  if (acmod === 2) {
    bitstream.skipBits(2);
  }
  const lfeon = bitstream.readBits(1);
  const bitRateCode = Math.floor(frmsizecod / 2);
  return { fscod, bsid, bsmod, acmod, lfeon, bitRateCode };
};
var AC3_FRAME_SIZES = [
  64 * 2,
  69 * 2,
  96 * 2,
  64 * 2,
  70 * 2,
  96 * 2,
  80 * 2,
  87 * 2,
  120 * 2,
  80 * 2,
  88 * 2,
  120 * 2,
  96 * 2,
  104 * 2,
  144 * 2,
  96 * 2,
  105 * 2,
  144 * 2,
  112 * 2,
  121 * 2,
  168 * 2,
  112 * 2,
  122 * 2,
  168 * 2,
  128 * 2,
  139 * 2,
  192 * 2,
  128 * 2,
  140 * 2,
  192 * 2,
  160 * 2,
  174 * 2,
  240 * 2,
  160 * 2,
  175 * 2,
  240 * 2,
  192 * 2,
  208 * 2,
  288 * 2,
  192 * 2,
  209 * 2,
  288 * 2,
  224 * 2,
  243 * 2,
  336 * 2,
  224 * 2,
  244 * 2,
  336 * 2,
  256 * 2,
  278 * 2,
  384 * 2,
  256 * 2,
  279 * 2,
  384 * 2,
  320 * 2,
  348 * 2,
  480 * 2,
  320 * 2,
  349 * 2,
  480 * 2,
  384 * 2,
  417 * 2,
  576 * 2,
  384 * 2,
  418 * 2,
  576 * 2,
  448 * 2,
  487 * 2,
  672 * 2,
  448 * 2,
  488 * 2,
  672 * 2,
  512 * 2,
  557 * 2,
  768 * 2,
  512 * 2,
  558 * 2,
  768 * 2,
  640 * 2,
  696 * 2,
  960 * 2,
  640 * 2,
  697 * 2,
  960 * 2,
  768 * 2,
  835 * 2,
  1152 * 2,
  768 * 2,
  836 * 2,
  1152 * 2,
  896 * 2,
  975 * 2,
  1344 * 2,
  896 * 2,
  976 * 2,
  1344 * 2,
  1024 * 2,
  1114 * 2,
  1536 * 2,
  1024 * 2,
  1115 * 2,
  1536 * 2,
  1152 * 2,
  1253 * 2,
  1728 * 2,
  1152 * 2,
  1254 * 2,
  1728 * 2,
  1280 * 2,
  1393 * 2,
  1920 * 2,
  1280 * 2,
  1394 * 2,
  1920 * 2
];
var AC3_SAMPLES_PER_FRAME = 1536;
var AC3_REGISTRATION_DESCRIPTOR = new Uint8Array([5, 4, 65, 67, 45, 51]);
var EAC3_REGISTRATION_DESCRIPTOR = new Uint8Array([5, 4, 69, 65, 67, 51]);
var EAC3_NUMBLKS_TABLE = [1, 2, 3, 6];
var parseEac3SyncFrame = (data) => {
  if (data.length < 6) {
    return null;
  }
  if (data[0] !== 11 || data[1] !== 119) {
    return null;
  }
  const bitstream = new Bitstream(data);
  bitstream.skipBits(16);
  const strmtyp = bitstream.readBits(2);
  bitstream.skipBits(3);
  if (strmtyp !== 0 && strmtyp !== 2) {
    return null;
  }
  const frmsiz = bitstream.readBits(11);
  const fscod = bitstream.readBits(2);
  let fscod2 = 0;
  let numblkscod;
  if (fscod === 3) {
    fscod2 = bitstream.readBits(2);
    numblkscod = 3;
  } else {
    numblkscod = bitstream.readBits(2);
  }
  const acmod = bitstream.readBits(3);
  const lfeon = bitstream.readBits(1);
  const bsid = bitstream.readBits(5);
  if (bsid < 11 || bsid > 16) {
    return null;
  }
  const numblks = EAC3_NUMBLKS_TABLE[numblkscod];
  let fs;
  if (fscod < 3) {
    fs = AC3_SAMPLE_RATES[fscod] / 1000;
  } else {
    fs = EAC3_REDUCED_SAMPLE_RATES[fscod2] / 1000;
  }
  const dataRate = Math.round((frmsiz + 1) * fs / (numblks * 16));
  const bsmod = 0;
  const numDepSub = 0;
  const chanLoc = 0;
  const substream = {
    fscod,
    fscod2,
    bsid,
    bsmod,
    acmod,
    lfeon,
    numDepSub,
    chanLoc
  };
  return {
    dataRate,
    substreams: [substream]
  };
};
var parseEac3Config = (data) => {
  if (data.length < 2) {
    return null;
  }
  const bitstream = new Bitstream(data);
  const dataRate = bitstream.readBits(13);
  const numIndSub = bitstream.readBits(3);
  const substreams = [];
  for (let i = 0;i <= numIndSub; i++) {
    if (Math.ceil(bitstream.pos / 8) + 3 > data.length) {
      break;
    }
    const fscod = bitstream.readBits(2);
    const bsid = bitstream.readBits(5);
    bitstream.skipBits(1);
    bitstream.skipBits(1);
    const bsmod = bitstream.readBits(3);
    const acmod = bitstream.readBits(3);
    const lfeon = bitstream.readBits(1);
    bitstream.skipBits(3);
    const numDepSub = bitstream.readBits(4);
    let chanLoc = 0;
    if (numDepSub > 0) {
      chanLoc = bitstream.readBits(9);
    } else {
      bitstream.skipBits(1);
    }
    substreams.push({
      fscod,
      fscod2: null,
      bsid,
      bsmod,
      acmod,
      lfeon,
      numDepSub,
      chanLoc
    });
  }
  if (substreams.length === 0) {
    return null;
  }
  return { dataRate, substreams };
};
var getEac3SampleRate = (config) => {
  const sub = config.substreams[0];
  assert(sub);
  if (sub.fscod < 3) {
    return AC3_SAMPLE_RATES[sub.fscod];
  } else if (sub.fscod2 !== null && sub.fscod2 < 3) {
    return EAC3_REDUCED_SAMPLE_RATES[sub.fscod2];
  }
  return null;
};
var getEac3ChannelCount = (config) => {
  const sub = config.substreams[0];
  assert(sub);
  let channels = AC3_ACMOD_CHANNEL_COUNTS[sub.acmod] + sub.lfeon;
  if (sub.numDepSub > 0) {
    const CHAN_LOC_COUNTS = [2, 2, 1, 1, 2, 2, 2, 1, 1];
    for (let bit = 0;bit < 9; bit++) {
      if (sub.chanLoc & 1 << 8 - bit) {
        channels += CHAN_LOC_COUNTS[bit];
      }
    }
  }
  return channels;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class Demuxer {
  constructor(input) {
    this.input = input;
  }
  dispose() {}
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/packet.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var PLACEHOLDER_DATA = /* @__PURE__ */ new Uint8Array(0);

class EncodedPacket {
  constructor(data, type, timestamp, duration, sequenceNumber = -1, byteLength, sideData) {
    this.data = data;
    this.type = type;
    this.timestamp = timestamp;
    this.duration = duration;
    this.sequenceNumber = sequenceNumber;
    if (data === PLACEHOLDER_DATA && byteLength === undefined) {
      throw new Error("Internal error: byteLength must be explicitly provided when constructing metadata-only packets.");
    }
    if (byteLength === undefined) {
      byteLength = data.byteLength;
    }
    if (!(data instanceof Uint8Array)) {
      throw new TypeError("data must be a Uint8Array.");
    }
    if (type !== "key" && type !== "delta") {
      throw new TypeError('type must be either "key" or "delta".');
    }
    if (!Number.isFinite(timestamp)) {
      throw new TypeError("timestamp must be a number.");
    }
    if (!Number.isFinite(duration) || duration < 0) {
      throw new TypeError("duration must be a non-negative number.");
    }
    if (!Number.isFinite(sequenceNumber)) {
      throw new TypeError("sequenceNumber must be a number.");
    }
    if (!Number.isInteger(byteLength) || byteLength < 0) {
      throw new TypeError("byteLength must be a non-negative integer.");
    }
    if (sideData !== undefined && (typeof sideData !== "object" || !sideData)) {
      throw new TypeError("sideData, when provided, must be an object.");
    }
    if (sideData?.alpha !== undefined && !(sideData.alpha instanceof Uint8Array)) {
      throw new TypeError("sideData.alpha, when provided, must be a Uint8Array.");
    }
    if (sideData?.alphaByteLength !== undefined && (!Number.isInteger(sideData.alphaByteLength) || sideData.alphaByteLength < 0)) {
      throw new TypeError("sideData.alphaByteLength, when provided, must be a non-negative integer.");
    }
    this.byteLength = byteLength;
    this.sideData = sideData ?? {};
    if (this.sideData.alpha && this.sideData.alphaByteLength === undefined) {
      this.sideData.alphaByteLength = this.sideData.alpha.byteLength;
    }
  }
  get isMetadataOnly() {
    return this.data === PLACEHOLDER_DATA;
  }
  get microsecondTimestamp() {
    return Math.trunc(SECOND_TO_MICROSECOND_FACTOR * this.timestamp);
  }
  get microsecondDuration() {
    return Math.trunc(SECOND_TO_MICROSECOND_FACTOR * this.duration);
  }
  toEncodedVideoChunk() {
    if (this.isMetadataOnly) {
      throw new TypeError("Metadata-only packets cannot be converted to a video chunk.");
    }
    if (typeof EncodedVideoChunk === "undefined") {
      throw new Error("Your browser does not support EncodedVideoChunk.");
    }
    return new EncodedVideoChunk({
      data: this.data,
      type: this.type,
      timestamp: this.microsecondTimestamp,
      duration: this.microsecondDuration
    });
  }
  alphaToEncodedVideoChunk(type = this.type) {
    if (!this.sideData.alpha) {
      throw new TypeError("This packet does not contain alpha side data.");
    }
    if (this.isMetadataOnly) {
      throw new TypeError("Metadata-only packets cannot be converted to a video chunk.");
    }
    if (typeof EncodedVideoChunk === "undefined") {
      throw new Error("Your browser does not support EncodedVideoChunk.");
    }
    return new EncodedVideoChunk({
      data: this.sideData.alpha,
      type,
      timestamp: this.microsecondTimestamp,
      duration: this.microsecondDuration
    });
  }
  toEncodedAudioChunk() {
    if (this.isMetadataOnly) {
      throw new TypeError("Metadata-only packets cannot be converted to an audio chunk.");
    }
    if (typeof EncodedAudioChunk === "undefined") {
      throw new Error("Your browser does not support EncodedAudioChunk.");
    }
    return new EncodedAudioChunk({
      data: this.data,
      type: this.type,
      timestamp: this.microsecondTimestamp,
      duration: this.microsecondDuration
    });
  }
  static fromEncodedChunk(chunk, sideData) {
    if (!(chunk instanceof EncodedVideoChunk || chunk instanceof EncodedAudioChunk)) {
      throw new TypeError("chunk must be an EncodedVideoChunk or EncodedAudioChunk.");
    }
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    return new EncodedPacket(data, chunk.type, chunk.timestamp / 1e6, (chunk.duration ?? 0) / 1e6, undefined, undefined, sideData);
  }
  clone(options) {
    if (options !== undefined && (typeof options !== "object" || options === null)) {
      throw new TypeError("options, when provided, must be an object.");
    }
    if (options?.data !== undefined && !(options.data instanceof Uint8Array)) {
      throw new TypeError("options.data, when provided, must be a Uint8Array.");
    }
    if (options?.type !== undefined && options.type !== "key" && options.type !== "delta") {
      throw new TypeError('options.type, when provided, must be either "key" or "delta".');
    }
    if (options?.timestamp !== undefined && !Number.isFinite(options.timestamp)) {
      throw new TypeError("options.timestamp, when provided, must be a number.");
    }
    if (options?.duration !== undefined && !Number.isFinite(options.duration)) {
      throw new TypeError("options.duration, when provided, must be a number.");
    }
    if (options?.sequenceNumber !== undefined && !Number.isFinite(options.sequenceNumber)) {
      throw new TypeError("options.sequenceNumber, when provided, must be a number.");
    }
    if (options?.sideData !== undefined && (typeof options.sideData !== "object" || options.sideData === null)) {
      throw new TypeError("options.sideData, when provided, must be an object.");
    }
    return new EncodedPacket(options?.data ?? this.data, options?.type ?? this.type, options?.timestamp ?? this.timestamp, options?.duration ?? this.duration, options?.sequenceNumber ?? this.sequenceNumber, this.byteLength, options?.sideData ?? this.sideData);
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/isobmff/isobmff-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var buildIsobmffMimeType = (info) => {
  const base = info.hasVideo ? "video/" : info.hasAudio ? "audio/" : "application/";
  let string = base + (info.isQuickTime ? "quicktime" : "mp4");
  if (info.codecStrings.length > 0) {
    const uniqueCodecMimeTypes = [...new Set(info.codecStrings)];
    string += `; codecs="${uniqueCodecMimeTypes.join(", ")}"`;
  }
  return string;
};
var parsePsshBoxContents = (contents) => {
  const view = toDataView(contents);
  let pos = 0;
  const version = view.getUint8(pos);
  pos += 1;
  pos += 3;
  const systemId = bytesToHexString(contents.subarray(pos, pos + 16));
  pos += 16;
  let keyIds = null;
  if (version > 0) {
    const kidCount = view.getUint32(pos);
    pos += 4;
    if (kidCount > 0) {
      keyIds = [];
      for (let i = 0;i < kidCount; i++) {
        keyIds.push(bytesToHexString(contents.subarray(pos, pos + 16)));
        pos += 16;
      }
    }
  }
  const dataSize = view.getUint32(pos);
  pos += 4;
  return {
    systemId,
    keyIds,
    data: contents.slice(pos, pos + dataSize)
  };
};
var psshBoxesAreEqual = (a, b) => a.systemId === b.systemId && uint8ArraysAreEqual(a.data, b.data);

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/isobmff/isobmff-reader.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var MIN_BOX_HEADER_SIZE = 8;
var MAX_BOX_HEADER_SIZE = 16;
var readBoxHeader = (slice) => {
  let totalSize = readU32Be(slice);
  const name = readAscii(slice, 4);
  let headerSize = 8;
  const hasLargeSize = totalSize === 1;
  if (hasLargeSize) {
    totalSize = readU64Be(slice);
    headerSize = 16;
  }
  const contentSize = totalSize - headerSize;
  if (contentSize < 0) {
    return null;
  }
  return { name, totalSize, headerSize, contentSize };
};
var readFixed_16_16 = (slice) => {
  return readI32Be(slice) / 65536;
};
var readFixed_2_30 = (slice) => {
  return readI32Be(slice) / 1073741824;
};
var readIsomVariableInteger = (slice) => {
  let result = 0;
  for (let i = 0;i < 4; i++) {
    result <<= 7;
    const nextByte = readU8(slice);
    result |= nextByte & 127;
    if ((nextByte & 128) === 0) {
      break;
    }
  }
  return result;
};
var readMetadataStringShort = (slice) => {
  let stringLength = readU16Be(slice);
  slice.skip(2);
  stringLength = Math.min(stringLength, slice.remainingLength);
  return textDecoder.decode(readBytes(slice, stringLength));
};
var readDataBox = (slice) => {
  const header = readBoxHeader(slice);
  if (!header || header.name !== "data") {
    return null;
  }
  if (slice.remainingLength < 8) {
    return null;
  }
  const typeIndicator = readU32Be(slice);
  slice.skip(4);
  const data = readBytes(slice, header.contentSize - 8);
  switch (typeIndicator) {
    case 1:
      return textDecoder.decode(data);
    case 2:
      return new TextDecoder("utf-16be").decode(data);
    case 13:
      return new RichImageData(data, "image/jpeg");
    case 14:
      return new RichImageData(data, "image/png");
    case 27:
      return new RichImageData(data, "image/bmp");
    default:
      return data;
  }
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/aes.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var AES_128_BLOCK_SIZE = 16;
var Te4 = new Uint32Array(256);
var Td0 = new Uint32Array(256);
var Td1 = new Uint32Array(256);
var Td2 = new Uint32Array(256);
var Td3 = new Uint32Array(256);
var Td4 = new Uint32Array(256);
var rcon = new Uint32Array(10);
var tablesGenerated = false;
var generateAesTables = () => {
  const sbox = new Uint8Array(256);
  const log = new Uint8Array(256);
  const pow = new Uint8Array(256);
  for (let i = 0, p = 1;i < 256; i++) {
    pow[i] = p;
    log[p] = i;
    p = p ^ p << 1 ^ (p & 128 ? 283 : 0);
  }
  const mul = (a, b) => a && b ? pow[(log[a] + log[b]) % 255] : 0;
  sbox[0] = 99;
  for (let i = 1;i < 256; i++) {
    const x = pow[255 - log[i]];
    let s = x ^ x << 1 ^ x << 2 ^ x << 3 ^ x << 4;
    s = s >>> 8 ^ s & 255 ^ 99;
    sbox[i] = s;
  }
  for (let i = 0;i < 256; i++) {
    const s = sbox[i];
    const is = sbox.indexOf(i);
    Te4[i] = s << 24 | s << 16 | s << 8 | s;
    Td4[i] = is << 24 | is << 16 | is << 8 | is;
    const b0 = mul(is, 14);
    const b1 = mul(is, 9);
    const b2 = mul(is, 13);
    const b3 = mul(is, 11);
    const w = b0 << 24 | b1 << 16 | b2 << 8 | b3;
    Td0[i] = w;
    Td1[i] = w >>> 8 | w << 24;
    Td2[i] = w >>> 16 | w << 16;
    Td3[i] = w >>> 24 | w << 8;
  }
  let r = 1;
  for (let i = 0;i < 10; i++) {
    rcon[i] = r << 24;
    r = r << 1 ^ (r & 128 ? 283 : 0);
  }
  tablesGenerated = true;
};

class Aes128CbcContext {
  constructor() {
    this.roundkey = new Uint32Array(44);
    this.iv = new Uint32Array(AES_128_BLOCK_SIZE / Uint32Array.BYTES_PER_ELEMENT);
    this.in = new Uint8Array(AES_128_BLOCK_SIZE);
    this.out = new Uint8Array(AES_128_BLOCK_SIZE);
    this.inView = new DataView(this.in.buffer);
    this.outView = new DataView(this.out.buffer);
  }
  init({ key, iv }) {
    assert(key.byteLength === 16);
    assert(iv.byteLength === 16);
    if (!tablesGenerated) {
      generateAesTables();
    }
    const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
    const ivView = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
    this.roundkey[0] = keyView.getUint32(0, false);
    this.roundkey[1] = keyView.getUint32(4, false);
    this.roundkey[2] = keyView.getUint32(8, false);
    this.roundkey[3] = keyView.getUint32(12, false);
    this.iv[0] = ivView.getUint32(0, false);
    this.iv[1] = ivView.getUint32(4, false);
    this.iv[2] = ivView.getUint32(8, false);
    this.iv[3] = ivView.getUint32(12, false);
    for (let index = 4;index < 44; index += 4) {
      const temp = this.roundkey[index - 1];
      this.roundkey[index] = this.roundkey[index - 4] ^ Te4[temp >>> 16 & 255] & 4278190080 ^ Te4[temp >>> 8 & 255] & 16711680 ^ Te4[temp >>> 0 & 255] & 65280 ^ Te4[temp >>> 24 & 255] & 255 ^ rcon[index / 4 - 1];
      this.roundkey[index + 1] = this.roundkey[index - 3] ^ this.roundkey[index];
      this.roundkey[index + 2] = this.roundkey[index - 2] ^ this.roundkey[index + 1];
      this.roundkey[index + 3] = this.roundkey[index - 1] ^ this.roundkey[index + 2];
    }
    for (let i = 0, j = 40;i < j; i += 4, j -= 4) {
      for (let k = 0;k < 4; k++) {
        const temp = this.roundkey[i + k];
        this.roundkey[i + k] = this.roundkey[j + k];
        this.roundkey[j + k] = temp;
      }
    }
    for (let index = 4;index < 40; index += 4) {
      for (let k = 0;k < 4; k++) {
        const rk = this.roundkey[index + k];
        this.roundkey[index + k] = Td0[Te4[rk >>> 24 & 255] & 255] ^ Td1[Te4[rk >>> 16 & 255] & 255] ^ Td2[Te4[rk >>> 8 & 255] & 255] ^ Td3[Te4[rk >>> 0 & 255] & 255];
      }
    }
  }
  decrypt() {
    let s0 = this.inView.getUint32(0, false) ^ this.roundkey[0];
    let s1 = this.inView.getUint32(4, false) ^ this.roundkey[1];
    let s2 = this.inView.getUint32(8, false) ^ this.roundkey[2];
    let s3 = this.inView.getUint32(12, false) ^ this.roundkey[3];
    const temp0 = this.inView.getUint32(0, false);
    const temp1 = this.inView.getUint32(4, false);
    const temp2 = this.inView.getUint32(8, false);
    const temp3 = this.inView.getUint32(12, false);
    let t0, t1, t2, t3;
    for (let round = 1;round < 10; round++) {
      const offset = round * 4;
      t0 = Td0[s0 >>> 24] ^ Td1[s3 >>> 16 & 255] ^ Td2[s2 >>> 8 & 255] ^ Td3[s1 & 255] ^ this.roundkey[offset];
      t1 = Td0[s1 >>> 24] ^ Td1[s0 >>> 16 & 255] ^ Td2[s3 >>> 8 & 255] ^ Td3[s2 & 255] ^ this.roundkey[offset + 1];
      t2 = Td0[s2 >>> 24] ^ Td1[s1 >>> 16 & 255] ^ Td2[s0 >>> 8 & 255] ^ Td3[s3 & 255] ^ this.roundkey[offset + 2];
      t3 = Td0[s3 >>> 24] ^ Td1[s2 >>> 16 & 255] ^ Td2[s1 >>> 8 & 255] ^ Td3[s0 & 255] ^ this.roundkey[offset + 3];
      s0 = t0;
      s1 = t1;
      s2 = t2;
      s3 = t3;
    }
    const f0 = Td4[s0 >>> 24 & 255] & 4278190080 ^ Td4[s3 >>> 16 & 255] & 16711680 ^ Td4[s2 >>> 8 & 255] & 65280 ^ Td4[s1 >>> 0 & 255] & 255 ^ this.roundkey[40];
    const f1 = Td4[s1 >>> 24 & 255] & 4278190080 ^ Td4[s0 >>> 16 & 255] & 16711680 ^ Td4[s3 >>> 8 & 255] & 65280 ^ Td4[s2 >>> 0 & 255] & 255 ^ this.roundkey[41];
    const f2 = Td4[s2 >>> 24 & 255] & 4278190080 ^ Td4[s1 >>> 16 & 255] & 16711680 ^ Td4[s0 >>> 8 & 255] & 65280 ^ Td4[s3 >>> 0 & 255] & 255 ^ this.roundkey[42];
    const f3 = Td4[s3 >>> 24 & 255] & 4278190080 ^ Td4[s2 >>> 16 & 255] & 16711680 ^ Td4[s1 >>> 8 & 255] & 65280 ^ Td4[s0 >>> 0 & 255] & 255 ^ this.roundkey[43];
    this.outView.setUint32(0, f0 ^ this.iv[0], false);
    this.outView.setUint32(4, f1 ^ this.iv[1], false);
    this.outView.setUint32(8, f2 ^ this.iv[2], false);
    this.outView.setUint32(12, f3 ^ this.iv[3], false);
    this.iv[0] = temp0;
    this.iv[1] = temp1;
    this.iv[2] = temp2;
    this.iv[3] = temp3;
  }
}
var createAes128CbcDecryptStream = (reader, getInit, close) => {
  let initted = false;
  let pos = 0;
  const CHUNK_SIZE = 2 ** 16;
  const BLOCK_SIZE = 16;
  const aesContext = new Aes128CbcContext;
  return new ReadableStream({
    pull: async (controller) => {
      if (!initted) {
        aesContext.init(await getInit());
        initted = true;
      }
      const requestedLength = CHUNK_SIZE + BLOCK_SIZE;
      let nextSlice = reader.requestSliceRange(pos, 0, requestedLength);
      if (nextSlice instanceof Promise)
        nextSlice = await nextSlice;
      if (!nextSlice || nextSlice.length === 0) {
        throw new Error("Invalid ciphertext.");
      }
      const sliceLength = nextSlice.length;
      if (sliceLength % 16 !== 0) {
        throw new Error("Invalid ciphertext.");
      }
      const bytesToRead = sliceLength === requestedLength ? sliceLength - BLOCK_SIZE : sliceLength;
      const input = readBytes(nextSlice, bytesToRead);
      const output = new Uint8Array(bytesToRead);
      for (let i = 0;i < bytesToRead; i += 16) {
        aesContext.in.set(input.subarray(i, i + 16));
        aesContext.decrypt();
        output.set(aesContext.out, i);
      }
      if (bytesToRead < sliceLength) {
        controller.enqueue(output);
        pos += bytesToRead;
      } else {
        const paddingLength = output[bytesToRead - 1];
        if (paddingLength === 0 || paddingLength > 16) {
          throw new Error("Invalid PKCS#7 padding. Incorrect key or corrupted data.");
        }
        const trimmedOutput = output.subarray(0, bytesToRead - paddingLength);
        controller.enqueue(trimmedOutput);
        controller.close();
        close();
      }
    },
    cancel: () => {
      close();
    }
  });
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/isobmff/isobmff-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class IsobmffDemuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.moovSlice = null;
    this.currentTrack = null;
    this.tracks = [];
    this.metadataPromise = null;
    this.movieTimescale = -1;
    this.movieDurationInTimescale = -1;
    this.isQuickTime = false;
    this.metadataTags = {};
    this.currentMetadataKeys = null;
    this.isFragmented = false;
    this.fragmentTrackDefaults = [];
    this.psshBoxes = [];
    this.currentFragment = null;
    this.lastReadFragment = null;
    this.decryptionKeyCache = new Map;
    this.reader = input._reader;
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.tracks.map((track) => track.trackBacking);
  }
  async getMimeType() {
    await this.readMetadata();
    const backings = await this.getTrackBackings();
    const codecStrings = await Promise.all(backings.map((x) => x.getDecoderConfig().then((c) => c?.codec ?? null)));
    return buildIsobmffMimeType({
      isQuickTime: this.isQuickTime,
      hasVideo: this.tracks.some((x) => x.info?.type === "video"),
      hasAudio: this.tracks.some((x) => x.info?.type === "audio"),
      codecStrings: codecStrings.filter(Boolean)
    });
  }
  async getMetadataTags() {
    await this.readMetadata();
    return this.metadataTags;
  }
  readMetadata() {
    return this.metadataPromise ??= (async () => {
      let currentPos = 0;
      let lookForMfraBox = false;
      while (true) {
        let slice = this.reader.requestSliceRange(currentPos, MIN_BOX_HEADER_SIZE, MAX_BOX_HEADER_SIZE);
        if (slice instanceof Promise)
          slice = await slice;
        if (!slice)
          break;
        const startPos = currentPos;
        const boxInfo = readBoxHeader(slice);
        if (!boxInfo) {
          break;
        }
        if (boxInfo.name === "ftyp" || boxInfo.name === "styp") {
          const majorBrand = readAscii(slice, 4);
          this.isQuickTime = majorBrand === "qt  ";
        } else if (boxInfo.name === "moov") {
          let moovSlice = this.reader.requestSlice(slice.filePos, boxInfo.contentSize);
          if (moovSlice instanceof Promise)
            moovSlice = await moovSlice;
          if (!moovSlice)
            break;
          this.moovSlice = moovSlice;
          this.readContiguousBoxes(this.moovSlice);
          for (const track of this.tracks) {
            const previousSegmentDurationsInSeconds = track.editListPreviousSegmentDurations / this.movieTimescale;
            track.editListOffset -= Math.round(previousSegmentDurationsInSeconds * track.timescale);
          }
          lookForMfraBox = this.isFragmented && this.reader.fileSize !== null && this.reader.fileSize > startPos + boxInfo.totalSize;
          break;
        } else if (boxInfo.name === "moof") {
          if (!this.input._initInput) {
            throw new Error('"moof" box encountered with no "moov" box present; this file is likely a Segment as' + ' described in ISO/IEC 14496-12 Section 8.16. A separate init file that contains a "moov"' + " box is required to read this file, please provide it using InputOptions.initInput.");
          }
          const initDemuxer = await this.input._initInput._getDemuxer();
          if (initDemuxer.constructor !== IsobmffDemuxer) {
            throw new Error("Init input must match the input's format.");
          }
          await initDemuxer.readMetadata();
          this.movieTimescale = initDemuxer.movieTimescale;
          this.movieDurationInTimescale = initDemuxer.movieDurationInTimescale;
          this.metadataTags = initDemuxer.metadataTags;
          this.isFragmented = true;
          this.fragmentTrackDefaults = initDemuxer.fragmentTrackDefaults;
          this.psshBoxes = initDemuxer.psshBoxes;
          for (const foreignTrack of initDemuxer.tracks) {
            const track = {
              id: foreignTrack.id,
              demuxer: this,
              trackBacking: null,
              disposition: foreignTrack.disposition,
              timescale: foreignTrack.timescale,
              durationInMediaTimescale: foreignTrack.durationInMediaTimescale,
              durationInMovieTimescale: foreignTrack.durationInMovieTimescale,
              rotation: foreignTrack.rotation,
              internalCodecId: foreignTrack.internalCodecId,
              name: foreignTrack.name,
              languageCode: foreignTrack.languageCode,
              sampleTableByteOffset: null,
              sampleTable: null,
              fragmentLookupTable: [],
              currentFragmentState: null,
              fragmentPositionCache: [],
              editListPreviousSegmentDurations: foreignTrack.editListPreviousSegmentDurations,
              editListOffset: foreignTrack.editListOffset,
              encryptionInfo: foreignTrack.encryptionInfo,
              encryptionAuxInfo: null,
              frmaCodecString: null,
              info: foreignTrack.info
            };
            if (foreignTrack.trackBacking) {
              assert(track.info);
              if (track.info.type === "video" && track.info.width !== -1) {
                const videoTrack = track;
                track.trackBacking = new IsobmffVideoTrackBacking(videoTrack);
                this.tracks.push(track);
              } else if (track.info.type === "audio" && track.info.numberOfChannels !== -1) {
                const audioTrack = track;
                track.trackBacking = new IsobmffAudioTrackBacking(audioTrack);
                this.tracks.push(track);
              }
            } else {}
          }
          lookForMfraBox = false;
          break;
        }
        currentPos = startPos + boxInfo.totalSize;
      }
      if (lookForMfraBox) {
        assert(this.reader.fileSize !== null);
        let lastWordSlice = this.reader.requestSlice(this.reader.fileSize - 4, 4);
        if (lastWordSlice instanceof Promise)
          lastWordSlice = await lastWordSlice;
        assert(lastWordSlice);
        const lastWord = readU32Be(lastWordSlice);
        const potentialMfraPos = this.reader.fileSize - lastWord;
        if (potentialMfraPos >= 0 && potentialMfraPos <= this.reader.fileSize - MAX_BOX_HEADER_SIZE) {
          let mfraHeaderSlice = this.reader.requestSliceRange(potentialMfraPos, MIN_BOX_HEADER_SIZE, MAX_BOX_HEADER_SIZE);
          if (mfraHeaderSlice instanceof Promise)
            mfraHeaderSlice = await mfraHeaderSlice;
          if (mfraHeaderSlice) {
            const boxInfo = readBoxHeader(mfraHeaderSlice);
            if (boxInfo && boxInfo.name === "mfra") {
              let mfraSlice = this.reader.requestSlice(mfraHeaderSlice.filePos, boxInfo.contentSize);
              if (mfraSlice instanceof Promise)
                mfraSlice = await mfraSlice;
              if (mfraSlice) {
                this.readContiguousBoxes(mfraSlice);
              }
            }
          }
        }
      }
    })();
  }
  getSampleTableForTrack(internalTrack) {
    if (internalTrack.sampleTable) {
      return internalTrack.sampleTable;
    }
    const sampleTable = {
      sampleTimingEntries: [],
      sampleCompositionTimeOffsets: [],
      sampleSizes: [],
      keySampleIndices: null,
      chunkOffsets: [],
      sampleToChunk: [],
      presentationTimestamps: null,
      presentationTimestampIndexMap: null
    };
    internalTrack.sampleTable = sampleTable;
    if (internalTrack.sampleTableByteOffset === null) {
      return sampleTable;
    }
    assert(this.moovSlice);
    const stblContainerSlice = this.moovSlice.slice(internalTrack.sampleTableByteOffset);
    this.currentTrack = internalTrack;
    this.traverseBox(stblContainerSlice);
    this.currentTrack = null;
    const isPcmCodec = internalTrack.info?.type === "audio" && internalTrack.info.codec && PCM_AUDIO_CODECS.includes(internalTrack.info.codec);
    if (isPcmCodec && sampleTable.sampleCompositionTimeOffsets.length === 0) {
      assert(internalTrack.info?.type === "audio");
      const pcmInfo = parsePcmCodec(internalTrack.info.codec);
      const newSampleTimingEntries = [];
      const newSampleSizes = [];
      for (let i = 0;i < sampleTable.sampleToChunk.length; i++) {
        const chunkEntry = sampleTable.sampleToChunk[i];
        const nextEntry = sampleTable.sampleToChunk[i + 1];
        const chunkCount = (nextEntry ? nextEntry.startChunkIndex : sampleTable.chunkOffsets.length) - chunkEntry.startChunkIndex;
        for (let j = 0;j < chunkCount; j++) {
          const startSampleIndex = chunkEntry.startSampleIndex + j * chunkEntry.samplesPerChunk;
          const endSampleIndex = startSampleIndex + chunkEntry.samplesPerChunk;
          const startTimingEntryIndex = binarySearchLessOrEqual(sampleTable.sampleTimingEntries, startSampleIndex, (x) => x.startIndex);
          const startTimingEntry = sampleTable.sampleTimingEntries[startTimingEntryIndex];
          const endTimingEntryIndex = binarySearchLessOrEqual(sampleTable.sampleTimingEntries, endSampleIndex, (x) => x.startIndex);
          const endTimingEntry = sampleTable.sampleTimingEntries[endTimingEntryIndex];
          const firstSampleTimestamp = startTimingEntry.startDecodeTimestamp + (startSampleIndex - startTimingEntry.startIndex) * startTimingEntry.delta;
          const lastSampleTimestamp = endTimingEntry.startDecodeTimestamp + (endSampleIndex - endTimingEntry.startIndex) * endTimingEntry.delta;
          const delta = lastSampleTimestamp - firstSampleTimestamp;
          const lastSampleTimingEntry = last(newSampleTimingEntries);
          if (lastSampleTimingEntry && lastSampleTimingEntry.delta === delta) {
            lastSampleTimingEntry.count++;
          } else {
            newSampleTimingEntries.push({
              startIndex: chunkEntry.startChunkIndex + j,
              startDecodeTimestamp: firstSampleTimestamp,
              count: 1,
              delta
            });
          }
          const chunkSize = chunkEntry.samplesPerChunk * pcmInfo.sampleSize * internalTrack.info.numberOfChannels;
          newSampleSizes.push(chunkSize);
        }
        chunkEntry.startSampleIndex = chunkEntry.startChunkIndex;
        chunkEntry.samplesPerChunk = 1;
      }
      sampleTable.sampleTimingEntries = newSampleTimingEntries;
      sampleTable.sampleSizes = newSampleSizes;
    }
    if (sampleTable.sampleCompositionTimeOffsets.length > 0) {
      sampleTable.presentationTimestamps = [];
      for (const entry of sampleTable.sampleTimingEntries) {
        for (let i = 0;i < entry.count; i++) {
          sampleTable.presentationTimestamps.push({
            presentationTimestamp: entry.startDecodeTimestamp + i * entry.delta,
            sampleIndex: entry.startIndex + i
          });
        }
      }
      for (const entry of sampleTable.sampleCompositionTimeOffsets) {
        for (let i = 0;i < entry.count; i++) {
          const sampleIndex = entry.startIndex + i;
          const sample = sampleTable.presentationTimestamps[sampleIndex];
          if (!sample) {
            continue;
          }
          sample.presentationTimestamp += entry.offset;
        }
      }
      sampleTable.presentationTimestamps.sort((a, b) => a.presentationTimestamp - b.presentationTimestamp);
      sampleTable.presentationTimestampIndexMap = Array(sampleTable.presentationTimestamps.length).fill(-1);
      for (let i = 0;i < sampleTable.presentationTimestamps.length; i++) {
        sampleTable.presentationTimestampIndexMap[sampleTable.presentationTimestamps[i].sampleIndex] = i;
      }
    } else {}
    return sampleTable;
  }
  async readFragment(startPos) {
    if (this.lastReadFragment?.moofOffset === startPos) {
      return this.lastReadFragment;
    }
    let headerSlice = this.reader.requestSliceRange(startPos, MIN_BOX_HEADER_SIZE, MAX_BOX_HEADER_SIZE);
    if (headerSlice instanceof Promise)
      headerSlice = await headerSlice;
    assert(headerSlice);
    const moofBoxInfo = readBoxHeader(headerSlice);
    assert(moofBoxInfo?.name === "moof");
    let entireSlice = this.reader.requestSlice(startPos, moofBoxInfo.totalSize);
    if (entireSlice instanceof Promise)
      entireSlice = await entireSlice;
    assert(entireSlice);
    this.traverseBox(entireSlice);
    const fragment = this.lastReadFragment;
    assert(fragment && fragment.moofOffset === startPos);
    for (const [, trackData] of fragment.trackData) {
      const track = trackData.track;
      const { fragmentPositionCache } = track;
      if (!trackData.startTimestampIsFinal) {
        const lookupEntry = track.fragmentLookupTable.find((x) => x.moofOffset === fragment.moofOffset);
        if (lookupEntry) {
          offsetFragmentTrackDataByTimestamp(trackData, lookupEntry.timestamp);
        } else {
          const lastCacheIndex = binarySearchLessOrEqual(fragmentPositionCache, fragment.moofOffset - 1, (x) => x.moofOffset);
          if (lastCacheIndex !== -1) {
            const lastCache = fragmentPositionCache[lastCacheIndex];
            offsetFragmentTrackDataByTimestamp(trackData, lastCache.endTimestamp);
          } else {}
        }
        trackData.startTimestampIsFinal = true;
      }
      const insertionIndex = binarySearchLessOrEqual(fragmentPositionCache, trackData.startTimestamp, (x) => x.startTimestamp);
      if (insertionIndex === -1 || fragmentPositionCache[insertionIndex].moofOffset !== fragment.moofOffset) {
        fragmentPositionCache.splice(insertionIndex + 1, 0, {
          moofOffset: fragment.moofOffset,
          startTimestamp: trackData.startTimestamp,
          endTimestamp: trackData.endTimestamp
        });
      }
      if (trackData.encryptionAuxInfo && track.encryptionInfo) {
        const entries = await resolveEncryptionAuxInfo(this.reader, track.encryptionInfo, trackData.encryptionAuxInfo);
        for (let i = 0;i < Math.min(trackData.samples.length, entries.length); i++) {
          const entry = entries[i];
          trackData.samples[i].encryption = entry;
        }
      }
    }
    return fragment;
  }
  readContiguousBoxes(slice) {
    const startIndex = slice.filePos;
    while (slice.filePos - startIndex <= slice.length - MIN_BOX_HEADER_SIZE) {
      const foundBox = this.traverseBox(slice);
      if (!foundBox) {
        break;
      }
    }
  }
  *iterateContiguousBoxes(slice) {
    const startIndex = slice.filePos;
    while (slice.filePos - startIndex <= slice.length - MIN_BOX_HEADER_SIZE) {
      const startPos = slice.filePos;
      const boxInfo = readBoxHeader(slice);
      if (!boxInfo) {
        break;
      }
      yield { boxInfo, slice };
      slice.filePos = startPos + boxInfo.totalSize;
    }
  }
  traverseBox(slice) {
    const startPos = slice.filePos;
    const boxInfo = readBoxHeader(slice);
    if (!boxInfo) {
      return false;
    }
    const contentStartPos = slice.filePos;
    const boxEndPos = startPos + boxInfo.totalSize;
    switch (boxInfo.name) {
      case "mdia":
      case "minf":
      case "dinf":
      case "mfra":
      case "edts":
      case "sinf":
      case "schi":
        {
          this.readContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
        }
        ;
        break;
      case "mvhd":
        {
          const version = readU8(slice);
          slice.skip(3);
          if (version === 1) {
            slice.skip(8 + 8);
            this.movieTimescale = readU32Be(slice);
            this.movieDurationInTimescale = readU64Be(slice);
          } else {
            slice.skip(4 + 4);
            this.movieTimescale = readU32Be(slice);
            this.movieDurationInTimescale = readU32Be(slice);
          }
        }
        ;
        break;
      case "trak":
        {
          const track = {
            id: -1,
            demuxer: this,
            trackBacking: null,
            disposition: {
              ...DEFAULT_TRACK_DISPOSITION,
              primary: false
            },
            info: null,
            timescale: -1,
            durationInMovieTimescale: -1,
            durationInMediaTimescale: -1,
            rotation: 0,
            internalCodecId: null,
            name: null,
            languageCode: UNDETERMINED_LANGUAGE,
            sampleTableByteOffset: -1,
            sampleTable: null,
            fragmentLookupTable: [],
            currentFragmentState: null,
            fragmentPositionCache: [],
            editListPreviousSegmentDurations: 0,
            editListOffset: 0,
            encryptionInfo: null,
            encryptionAuxInfo: null,
            frmaCodecString: null
          };
          this.currentTrack = track;
          this.readContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
          if (track.id !== -1 && track.timescale !== -1 && track.info !== null) {
            if (track.info.type === "video" && track.info.width !== -1) {
              const videoTrack = track;
              track.trackBacking = new IsobmffVideoTrackBacking(videoTrack);
              this.tracks.push(track);
            } else if (track.info.type === "audio" && track.info.numberOfChannels !== -1) {
              const audioTrack = track;
              track.trackBacking = new IsobmffAudioTrackBacking(audioTrack);
              this.tracks.push(track);
            }
          }
          this.currentTrack = null;
        }
        ;
        break;
      case "tkhd":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          const version = readU8(slice);
          const flags = readU24Be(slice);
          const trackEnabled = !!(flags & 1);
          track.disposition.default = trackEnabled;
          if (version === 0) {
            slice.skip(8);
            track.id = readU32Be(slice);
            slice.skip(4);
            track.durationInMovieTimescale = readU32Be(slice);
          } else if (version === 1) {
            slice.skip(16);
            track.id = readU32Be(slice);
            slice.skip(4);
            track.durationInMovieTimescale = readU64Be(slice);
          } else {
            throw new Error(`Incorrect track header version ${version}.`);
          }
          slice.skip(2 * 4 + 2 + 2 + 2 + 2);
          const matrix = [
            readFixed_16_16(slice),
            readFixed_16_16(slice),
            readFixed_2_30(slice),
            readFixed_16_16(slice),
            readFixed_16_16(slice),
            readFixed_2_30(slice),
            readFixed_16_16(slice),
            readFixed_16_16(slice),
            readFixed_2_30(slice)
          ];
          const rotation = normalizeRotation(roundToMultiple(extractRotationFromMatrix(matrix), 90));
          assert(rotation === 0 || rotation === 90 || rotation === 180 || rotation === 270);
          track.rotation = rotation;
        }
        ;
        break;
      case "elst":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          const version = readU8(slice);
          slice.skip(3);
          let relevantEntryFound = false;
          let previousSegmentDurations = 0;
          const entryCount = readU32Be(slice);
          for (let i = 0;i < entryCount; i++) {
            const segmentDuration = version === 1 ? readU64Be(slice) : readU32Be(slice);
            const mediaTime = version === 1 ? readI64Be(slice) : readI32Be(slice);
            const mediaRate = readFixed_16_16(slice);
            if (segmentDuration === 0) {
              continue;
            }
            if (relevantEntryFound) {
              console.warn("Unsupported edit list: multiple edits are not currently supported. Only using first edit.");
              break;
            }
            if (mediaTime === -1) {
              previousSegmentDurations += segmentDuration;
              continue;
            }
            if (mediaRate !== 1) {
              console.warn("Unsupported edit list entry: media rate must be 1.");
              break;
            }
            track.editListPreviousSegmentDurations = previousSegmentDurations;
            track.editListOffset = mediaTime;
            relevantEntryFound = true;
          }
        }
        ;
        break;
      case "mdhd":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          const version = readU8(slice);
          slice.skip(3);
          if (version === 0) {
            slice.skip(8);
            track.timescale = readU32Be(slice);
            track.durationInMediaTimescale = readU32Be(slice);
          } else if (version === 1) {
            slice.skip(16);
            track.timescale = readU32Be(slice);
            track.durationInMediaTimescale = readU64Be(slice);
          }
          let language = readU16Be(slice);
          if (language > 0) {
            track.languageCode = "";
            for (let i = 0;i < 3; i++) {
              track.languageCode = String.fromCharCode(96 + (language & 31)) + track.languageCode;
              language >>= 5;
            }
            if (!isIso639Dash2LanguageCode(track.languageCode)) {
              track.languageCode = UNDETERMINED_LANGUAGE;
            }
          }
        }
        ;
        break;
      case "hdlr":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          slice.skip(8);
          const handlerType = readAscii(slice, 4);
          if (handlerType === "vide") {
            track.info = {
              type: "video",
              width: -1,
              height: -1,
              squarePixelWidth: -1,
              squarePixelHeight: -1,
              codec: null,
              codecDescription: null,
              colorSpace: null,
              avcType: null,
              avcCodecInfo: null,
              hevcCodecInfo: null,
              vp9CodecInfo: null,
              av1CodecInfo: null
            };
          } else if (handlerType === "soun") {
            track.info = {
              type: "audio",
              numberOfChannels: -1,
              sampleRate: -1,
              codec: null,
              codecDescription: null,
              aacCodecInfo: null,
              pcmLittleEndian: false,
              pcmSampleSize: null
            };
          }
        }
        ;
        break;
      case "stbl":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          track.sampleTableByteOffset = startPos;
          this.readContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
        }
        ;
        break;
      case "stsd":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (track.info === null || track.sampleTable) {
            break;
          }
          const stsdVersion = readU8(slice);
          slice.skip(3);
          const entries = readU32Be(slice);
          for (let i = 0;i < entries; i++) {
            const sampleBoxStartPos = slice.filePos;
            const sampleBoxInfo = readBoxHeader(slice);
            if (!sampleBoxInfo) {
              break;
            }
            track.internalCodecId = sampleBoxInfo.name;
            const lowercaseBoxName = sampleBoxInfo.name.toLowerCase();
            if (track.info.type === "video") {
              slice.skip(6 * 1 + 2 + 2 + 2 + 3 * 4);
              track.info.width = readU16Be(slice);
              track.info.height = readU16Be(slice);
              track.info.squarePixelWidth = track.info.width;
              track.info.squarePixelHeight = track.info.height;
              slice.skip(4 + 4 + 4 + 2 + 32 + 2 + 2);
              track.frmaCodecString = null;
              this.readContiguousBoxes(slice.slice(slice.filePos, sampleBoxStartPos + sampleBoxInfo.totalSize - slice.filePos));
              const codecName = lowercaseBoxName === "encv" ? track.frmaCodecString : lowercaseBoxName;
              track.frmaCodecString = null;
              if (codecName === "avc1" || codecName === "avc3") {
                track.info.codec = "avc";
                track.info.avcType = codecName === "avc1" ? 1 : 3;
              } else if (codecName === "hvc1" || codecName === "hev1") {
                track.info.codec = "hevc";
              } else if (codecName === "vp08") {
                track.info.codec = "vp8";
              } else if (codecName === "vp09") {
                track.info.codec = "vp9";
              } else if (codecName === "av01") {
                track.info.codec = "av1";
              } else if (codecName === null) {
                console.warn(`Unknown encrypted video codec due to missing frma box.`);
              } else {
                console.warn(`Unsupported video codec (sample entry type '${sampleBoxInfo.name}').`);
              }
            } else {
              slice.skip(6 * 1 + 2);
              const version = readU16Be(slice);
              slice.skip(3 * 2);
              let channelCount = readU16Be(slice);
              let sampleSize = readU16Be(slice);
              slice.skip(2 * 2);
              let sampleRate = readU32Be(slice) / 65536;
              let lpcmFlags = null;
              if (stsdVersion === 0 && version > 0) {
                if (version === 1) {
                  slice.skip(4);
                  sampleSize = 8 * readU32Be(slice);
                  slice.skip(2 * 4);
                } else if (version === 2) {
                  slice.skip(4);
                  sampleRate = readF64Be(slice);
                  channelCount = readU32Be(slice);
                  slice.skip(4);
                  sampleSize = readU32Be(slice);
                  lpcmFlags = readU32Be(slice);
                  slice.skip(2 * 4);
                }
              }
              track.info.numberOfChannels = channelCount;
              track.info.sampleRate = sampleRate;
              track.frmaCodecString = null;
              this.readContiguousBoxes(slice.slice(slice.filePos, sampleBoxStartPos + sampleBoxInfo.totalSize - slice.filePos));
              const codecName = lowercaseBoxName === "enca" ? track.frmaCodecString : lowercaseBoxName;
              track.frmaCodecString = null;
              if (codecName === "mp4a") {} else if (codecName === "opus") {
                track.info.codec = "opus";
                track.info.sampleRate = OPUS_SAMPLE_RATE;
              } else if (codecName === "flac") {
                track.info.codec = "flac";
              } else if (codecName === "ulaw") {
                track.info.codec = "ulaw";
              } else if (codecName === "alaw") {
                track.info.codec = "alaw";
              } else if (codecName === "ac-3") {
                track.info.codec = "ac3";
              } else if (codecName === "ec-3") {
                track.info.codec = "eac3";
              } else if (codecName === "twos") {
                if (sampleSize === 8) {
                  track.info.codec = "pcm-s8";
                } else if (sampleSize === 16) {
                  track.info.codec = track.info.pcmLittleEndian ? "pcm-s16" : "pcm-s16be";
                } else {
                  console.warn(`Unsupported sample size ${sampleSize} for codec 'twos'.`);
                  track.info.codec = null;
                }
              } else if (codecName === "sowt") {
                if (sampleSize === 8) {
                  track.info.codec = "pcm-s8";
                } else if (sampleSize === 16) {
                  track.info.codec = "pcm-s16";
                } else {
                  console.warn(`Unsupported sample size ${sampleSize} for codec 'sowt'.`);
                  track.info.codec = null;
                }
              } else if (codecName === "raw ") {
                track.info.codec = "pcm-u8";
              } else if (codecName === "in24") {
                track.info.codec = track.info.pcmLittleEndian ? "pcm-s24" : "pcm-s24be";
              } else if (codecName === "in32") {
                track.info.codec = track.info.pcmLittleEndian ? "pcm-s32" : "pcm-s32be";
              } else if (codecName === "fl32") {
                track.info.codec = track.info.pcmLittleEndian ? "pcm-f32" : "pcm-f32be";
              } else if (codecName === "fl64") {
                track.info.codec = track.info.pcmLittleEndian ? "pcm-f64" : "pcm-f64be";
              } else if (codecName === "ipcm") {
                const pcmSampleSize = track.info.pcmSampleSize;
                if (track.info.pcmLittleEndian) {
                  if (pcmSampleSize === 16) {
                    track.info.codec = "pcm-s16";
                  } else if (pcmSampleSize === 24) {
                    track.info.codec = "pcm-s24";
                  } else if (pcmSampleSize === 32) {
                    track.info.codec = "pcm-s32";
                  } else {
                    console.warn(`Invalid ipcm sample size ${pcmSampleSize}.`);
                    track.info.codec = null;
                  }
                } else {
                  if (pcmSampleSize === 16) {
                    track.info.codec = "pcm-s16be";
                  } else if (pcmSampleSize === 24) {
                    track.info.codec = "pcm-s24be";
                  } else if (pcmSampleSize === 32) {
                    track.info.codec = "pcm-s32be";
                  } else {
                    console.warn(`Invalid ipcm sample size ${pcmSampleSize}.`);
                    track.info.codec = null;
                  }
                }
              } else if (codecName === "fpcm") {
                const pcmSampleSize = track.info.pcmSampleSize;
                if (track.info.pcmLittleEndian) {
                  if (pcmSampleSize === 32) {
                    track.info.codec = "pcm-f32";
                  } else if (pcmSampleSize === 64) {
                    track.info.codec = "pcm-f64";
                  } else {
                    console.warn(`Invalid fpcm sample size ${pcmSampleSize}.`);
                    track.info.codec = null;
                  }
                } else {
                  if (pcmSampleSize === 32) {
                    track.info.codec = "pcm-f32be";
                  } else if (pcmSampleSize === 64) {
                    track.info.codec = "pcm-f64be";
                  } else {
                    console.warn(`Invalid fpcm sample size ${pcmSampleSize}.`);
                    track.info.codec = null;
                  }
                }
              } else if (codecName === "lpcm" && lpcmFlags !== null) {
                const bytesPerSample = sampleSize + 7 >> 3;
                const isFloat = Boolean(lpcmFlags & 1);
                const isBigEndian = Boolean(lpcmFlags & 2);
                const sFlags = lpcmFlags & 4 ? -1 : 0;
                if (sampleSize > 0 && sampleSize <= 64) {
                  if (isFloat) {
                    if (sampleSize === 32) {
                      track.info.codec = isBigEndian ? "pcm-f32be" : "pcm-f32";
                    }
                  } else {
                    if (sFlags & 1 << bytesPerSample - 1) {
                      if (bytesPerSample === 1) {
                        track.info.codec = "pcm-s8";
                      } else if (bytesPerSample === 2) {
                        track.info.codec = isBigEndian ? "pcm-s16be" : "pcm-s16";
                      } else if (bytesPerSample === 3) {
                        track.info.codec = isBigEndian ? "pcm-s24be" : "pcm-s24";
                      } else if (bytesPerSample === 4) {
                        track.info.codec = isBigEndian ? "pcm-s32be" : "pcm-s32";
                      }
                    } else {
                      if (bytesPerSample === 1) {
                        track.info.codec = "pcm-u8";
                      }
                    }
                  }
                }
                if (track.info.codec === null) {
                  console.warn("Unsupported PCM format.");
                }
              } else if (codecName === null) {
                console.warn(`Unknown encrypted audio codec due to missing frma box.`);
              } else {
                console.warn(`Unsupported audio codec (sample entry type '${sampleBoxInfo.name}').`);
              }
            }
            slice.filePos = sampleBoxStartPos + sampleBoxInfo.totalSize;
          }
        }
        ;
        break;
      case "frma":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          const format = readAscii(slice, 4);
          const lowercase = format.toLowerCase();
          track.frmaCodecString = lowercase;
        }
        ;
        break;
      case "schm":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          slice.skip(4);
          const schemeType = readAscii(slice, 4);
          if (schemeType === "cenc" || schemeType === "cens" || schemeType === "cbcs") {
            track.encryptionInfo = {
              scheme: schemeType,
              defaultKid: null,
              defaultIsProtected: null,
              defaultPerSampleIvSize: null,
              defaultConstantIv: null,
              defaultCryptByteBlock: null,
              defaultSkipByteBlock: null
            };
          } else {
            console.warn(`Unsupported encryption scheme '${schemeType}'.`);
          }
        }
        ;
        break;
      case "tenc":
        {
          const track = this.currentTrack;
          if (!track || !track.encryptionInfo) {
            break;
          }
          const version = readU8(slice);
          slice.skip(3);
          slice.skip(1);
          const patternByte = readU8(slice);
          if (version > 0) {
            track.encryptionInfo.defaultCryptByteBlock = patternByte >> 4;
            track.encryptionInfo.defaultSkipByteBlock = patternByte & 15;
          } else {
            track.encryptionInfo.defaultCryptByteBlock = 0;
            track.encryptionInfo.defaultSkipByteBlock = 0;
          }
          track.encryptionInfo.defaultIsProtected = readU8(slice) !== 0;
          track.encryptionInfo.defaultPerSampleIvSize = readU8(slice);
          track.encryptionInfo.defaultKid = bytesToHexString(readBytes(slice, 16));
          if (track.encryptionInfo.defaultIsProtected && track.encryptionInfo.defaultPerSampleIvSize === 0) {
            const constantIvSize = readU8(slice);
            const constantIv = new Uint8Array(16);
            constantIv.set(readBytes(slice, constantIvSize), 0);
            track.encryptionInfo.defaultConstantIv = constantIv;
          }
        }
        ;
        break;
      case "avcC":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info);
          track.info.codecDescription = readBytes(slice, boxInfo.contentSize);
        }
        ;
        break;
      case "hvcC":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info);
          track.info.codecDescription = readBytes(slice, boxInfo.contentSize);
        }
        ;
        break;
      case "vpcC":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "video");
          slice.skip(4);
          const profile = readU8(slice);
          const level = readU8(slice);
          const thirdByte = readU8(slice);
          const bitDepth = thirdByte >> 4;
          const chromaSubsampling = thirdByte >> 1 & 7;
          const videoFullRangeFlag = thirdByte & 1;
          const colourPrimaries = readU8(slice);
          const transferCharacteristics = readU8(slice);
          const matrixCoefficients = readU8(slice);
          track.info.vp9CodecInfo = {
            profile,
            level,
            bitDepth,
            chromaSubsampling,
            videoFullRangeFlag,
            colourPrimaries,
            transferCharacteristics,
            matrixCoefficients
          };
        }
        ;
        break;
      case "av1C":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "video");
          slice.skip(1);
          const secondByte = readU8(slice);
          const profile = secondByte >> 5;
          const level = secondByte & 31;
          const thirdByte = readU8(slice);
          const tier = thirdByte >> 7;
          const highBitDepth = thirdByte >> 6 & 1;
          const twelveBit = thirdByte >> 5 & 1;
          const monochrome = thirdByte >> 4 & 1;
          const chromaSubsamplingX = thirdByte >> 3 & 1;
          const chromaSubsamplingY = thirdByte >> 2 & 1;
          const chromaSamplePosition = thirdByte & 3;
          const bitDepth = profile === 2 && highBitDepth ? twelveBit ? 12 : 10 : highBitDepth ? 10 : 8;
          track.info.av1CodecInfo = {
            profile,
            level,
            tier,
            bitDepth,
            monochrome,
            chromaSubsamplingX,
            chromaSubsamplingY,
            chromaSamplePosition
          };
        }
        ;
        break;
      case "colr":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "video");
          const colourType = readAscii(slice, 4);
          if (colourType !== "nclx" && colourType !== "nclc") {
            break;
          }
          const colourPrimaries = readU16Be(slice);
          const transferCharacteristics = readU16Be(slice);
          const matrixCoefficients = readU16Be(slice);
          let fullRange = undefined;
          if (colourType === "nclx") {
            fullRange = Boolean(readU8(slice) & 128);
          }
          track.info.colorSpace = {
            primaries: COLOR_PRIMARIES_MAP_INVERSE[colourPrimaries],
            transfer: TRANSFER_CHARACTERISTICS_MAP_INVERSE[transferCharacteristics],
            matrix: MATRIX_COEFFICIENTS_MAP_INVERSE[matrixCoefficients],
            fullRange
          };
        }
        ;
        break;
      case "pasp":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "video");
          const num = readU32Be(slice);
          const den = readU32Be(slice);
          if (num > 0 && den > 0) {
            if (num > den) {
              track.info.squarePixelWidth = Math.round(track.info.width * num / den);
            } else {
              track.info.squarePixelHeight = Math.round(track.info.height * den / num);
            }
          }
        }
        ;
        break;
      case "wave":
        {
          this.readContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
        }
        ;
        break;
      case "esds":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "audio");
          slice.skip(4);
          const tag = readU8(slice);
          assert(tag === 3);
          readIsomVariableInteger(slice);
          slice.skip(2);
          const mixed = readU8(slice);
          const streamDependenceFlag = (mixed & 128) !== 0;
          const urlFlag = (mixed & 64) !== 0;
          const ocrStreamFlag = (mixed & 32) !== 0;
          if (streamDependenceFlag) {
            slice.skip(2);
          }
          if (urlFlag) {
            const urlLength = readU8(slice);
            slice.skip(urlLength);
          }
          if (ocrStreamFlag) {
            slice.skip(2);
          }
          const decoderConfigTag = readU8(slice);
          assert(decoderConfigTag === 4);
          const decoderConfigDescriptorLength = readIsomVariableInteger(slice);
          const payloadStart = slice.filePos;
          const objectTypeIndication = readU8(slice);
          if (objectTypeIndication === 64 || objectTypeIndication === 103) {
            track.info.codec = "aac";
            track.info.aacCodecInfo = {
              isMpeg2: objectTypeIndication === 103,
              objectType: null
            };
          } else if (objectTypeIndication === 105 || objectTypeIndication === 107) {
            track.info.codec = "mp3";
          } else if (objectTypeIndication === 221) {
            track.info.codec = "vorbis";
          } else {
            console.warn(`Unsupported audio codec (objectTypeIndication ${objectTypeIndication}) - discarding track.`);
          }
          slice.skip(1 + 3 + 4 + 4);
          if (decoderConfigDescriptorLength > slice.filePos - payloadStart) {
            const decoderSpecificInfoTag = readU8(slice);
            assert(decoderSpecificInfoTag === 5);
            const decoderSpecificInfoLength = readIsomVariableInteger(slice);
            track.info.codecDescription = readBytes(slice, decoderSpecificInfoLength);
            if (track.info.codec === "aac") {
              const audioSpecificConfig = parseAacAudioSpecificConfig(track.info.codecDescription);
              if (audioSpecificConfig.numberOfChannels !== null) {
                track.info.numberOfChannels = audioSpecificConfig.numberOfChannels;
              }
              if (audioSpecificConfig.sampleRate !== null) {
                track.info.sampleRate = audioSpecificConfig.sampleRate;
              }
            }
          }
        }
        ;
        break;
      case "enda":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "audio");
          track.info.pcmLittleEndian = !!(readU16Be(slice) & 255);
        }
        ;
        break;
      case "pcmC":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "audio");
          slice.skip(1 + 3);
          const formatFlags = readU8(slice);
          track.info.pcmLittleEndian = Boolean(formatFlags & 1);
          track.info.pcmSampleSize = readU8(slice);
        }
        ;
        break;
      case "dOps":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "audio");
          slice.skip(1);
          const outputChannelCount = readU8(slice);
          const preSkip = readU16Be(slice);
          const inputSampleRate = readU32Be(slice);
          const outputGain = readI16Be(slice);
          const channelMappingFamily = readU8(slice);
          let channelMappingTable;
          if (channelMappingFamily !== 0) {
            channelMappingTable = readBytes(slice, 2 + outputChannelCount);
          } else {
            channelMappingTable = new Uint8Array(0);
          }
          const description = new Uint8Array(8 + 1 + 1 + 2 + 4 + 2 + 1 + channelMappingTable.byteLength);
          const view = new DataView(description.buffer);
          view.setUint32(0, 1332770163, false);
          view.setUint32(4, 1214603620, false);
          view.setUint8(8, 1);
          view.setUint8(9, outputChannelCount);
          view.setUint16(10, preSkip, true);
          view.setUint32(12, inputSampleRate, true);
          view.setInt16(16, outputGain, true);
          view.setUint8(18, channelMappingFamily);
          description.set(channelMappingTable, 19);
          track.info.codecDescription = description;
          track.info.numberOfChannels = outputChannelCount;
        }
        ;
        break;
      case "dfLa":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "audio");
          slice.skip(4);
          const BLOCK_TYPE_MASK = 127;
          const LAST_METADATA_BLOCK_FLAG_MASK = 128;
          const startPos2 = slice.filePos;
          while (slice.filePos < boxEndPos) {
            const flagAndType = readU8(slice);
            const metadataBlockLength = readU24Be(slice);
            const type = flagAndType & BLOCK_TYPE_MASK;
            if (type === FlacBlockType.STREAMINFO) {
              slice.skip(10);
              const word = readU32Be(slice);
              const sampleRate = word >>> 12;
              const numberOfChannels = (word >> 9 & 7) + 1;
              track.info.sampleRate = sampleRate;
              track.info.numberOfChannels = numberOfChannels;
              slice.skip(20);
            } else {
              slice.skip(metadataBlockLength);
            }
            if (flagAndType & LAST_METADATA_BLOCK_FLAG_MASK) {
              break;
            }
          }
          const endPos = slice.filePos;
          slice.filePos = startPos2;
          const bytes = readBytes(slice, endPos - startPos2);
          const description = new Uint8Array(4 + bytes.byteLength);
          const view = new DataView(description.buffer);
          view.setUint32(0, 1716281667, false);
          description.set(bytes, 4);
          track.info.codecDescription = description;
        }
        ;
        break;
      case "dac3":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "audio");
          const bytes = readBytes(slice, 3);
          const bitstream = new Bitstream(bytes);
          const fscod = bitstream.readBits(2);
          bitstream.skipBits(5 + 3);
          const acmod = bitstream.readBits(3);
          const lfeon = bitstream.readBits(1);
          if (fscod < 3) {
            track.info.sampleRate = AC3_SAMPLE_RATES[fscod];
          }
          track.info.numberOfChannels = AC3_ACMOD_CHANNEL_COUNTS[acmod] + lfeon;
        }
        ;
        break;
      case "dec3":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.info?.type === "audio");
          const bytes = readBytes(slice, boxInfo.contentSize);
          const config = parseEac3Config(bytes);
          if (!config) {
            console.warn("Invalid dec3 box contents, ignoring.");
            break;
          }
          const sampleRate = getEac3SampleRate(config);
          if (sampleRate !== null) {
            track.info.sampleRate = sampleRate;
          }
          track.info.numberOfChannels = getEac3ChannelCount(config);
        }
        ;
        break;
      case "stts":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (!track.sampleTable) {
            break;
          }
          slice.skip(4);
          const entryCount = readU32Be(slice);
          let currentIndex = 0;
          let currentTimestamp = 0;
          for (let i = 0;i < entryCount; i++) {
            const sampleCount = readU32Be(slice);
            const sampleDelta = readU32Be(slice);
            track.sampleTable.sampleTimingEntries.push({
              startIndex: currentIndex,
              startDecodeTimestamp: currentTimestamp,
              count: sampleCount,
              delta: sampleDelta
            });
            currentIndex += sampleCount;
            currentTimestamp += sampleCount * sampleDelta;
          }
        }
        ;
        break;
      case "ctts":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (!track.sampleTable) {
            break;
          }
          slice.skip(1 + 3);
          const entryCount = readU32Be(slice);
          let sampleIndex = 0;
          for (let i = 0;i < entryCount; i++) {
            const sampleCount = readU32Be(slice);
            const sampleOffset = readI32Be(slice);
            track.sampleTable.sampleCompositionTimeOffsets.push({
              startIndex: sampleIndex,
              count: sampleCount,
              offset: sampleOffset
            });
            sampleIndex += sampleCount;
          }
        }
        ;
        break;
      case "stsz":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (!track.sampleTable) {
            break;
          }
          slice.skip(4);
          const sampleSize = readU32Be(slice);
          const sampleCount = readU32Be(slice);
          if (sampleSize === 0) {
            for (let i = 0;i < sampleCount; i++) {
              const sampleSize2 = readU32Be(slice);
              track.sampleTable.sampleSizes.push(sampleSize2);
            }
          } else {
            track.sampleTable.sampleSizes.push(sampleSize);
          }
        }
        ;
        break;
      case "stz2":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (!track.sampleTable) {
            break;
          }
          slice.skip(4);
          slice.skip(3);
          const fieldSize = readU8(slice);
          const sampleCount = readU32Be(slice);
          const bytes = readBytes(slice, Math.ceil(sampleCount * fieldSize / 8));
          const bitstream = new Bitstream(bytes);
          for (let i = 0;i < sampleCount; i++) {
            const sampleSize = bitstream.readBits(fieldSize);
            track.sampleTable.sampleSizes.push(sampleSize);
          }
        }
        ;
        break;
      case "stss":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (!track.sampleTable) {
            break;
          }
          slice.skip(4);
          track.sampleTable.keySampleIndices = [];
          const entryCount = readU32Be(slice);
          for (let i = 0;i < entryCount; i++) {
            const sampleIndex = readU32Be(slice) - 1;
            track.sampleTable.keySampleIndices.push(sampleIndex);
          }
          if (track.sampleTable.keySampleIndices[0] !== 0) {
            track.sampleTable.keySampleIndices.unshift(0);
          }
        }
        ;
        break;
      case "stsc":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (!track.sampleTable) {
            break;
          }
          slice.skip(4);
          const entryCount = readU32Be(slice);
          for (let i = 0;i < entryCount; i++) {
            const startChunkIndex = readU32Be(slice) - 1;
            const samplesPerChunk = readU32Be(slice);
            const sampleDescriptionIndex = readU32Be(slice);
            track.sampleTable.sampleToChunk.push({
              startSampleIndex: -1,
              startChunkIndex,
              samplesPerChunk,
              sampleDescriptionIndex
            });
          }
          let startSampleIndex = 0;
          for (let i = 0;i < track.sampleTable.sampleToChunk.length; i++) {
            track.sampleTable.sampleToChunk[i].startSampleIndex = startSampleIndex;
            if (i < track.sampleTable.sampleToChunk.length - 1) {
              const nextChunk = track.sampleTable.sampleToChunk[i + 1];
              const chunkCount = nextChunk.startChunkIndex - track.sampleTable.sampleToChunk[i].startChunkIndex;
              startSampleIndex += chunkCount * track.sampleTable.sampleToChunk[i].samplesPerChunk;
            }
          }
        }
        ;
        break;
      case "stco":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (!track.sampleTable) {
            break;
          }
          slice.skip(4);
          const entryCount = readU32Be(slice);
          for (let i = 0;i < entryCount; i++) {
            const chunkOffset = readU32Be(slice);
            track.sampleTable.chunkOffsets.push(chunkOffset);
          }
        }
        ;
        break;
      case "co64":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          if (!track.sampleTable) {
            break;
          }
          slice.skip(4);
          const entryCount = readU32Be(slice);
          for (let i = 0;i < entryCount; i++) {
            const chunkOffset = readU64Be(slice);
            track.sampleTable.chunkOffsets.push(chunkOffset);
          }
        }
        ;
        break;
      case "mvex":
        {
          this.isFragmented = true;
          this.readContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
        }
        ;
        break;
      case "mehd":
        {
          const version = readU8(slice);
          slice.skip(3);
          const fragmentDuration = version === 1 ? readU64Be(slice) : readU32Be(slice);
          this.movieDurationInTimescale = fragmentDuration;
        }
        ;
        break;
      case "trex":
        {
          slice.skip(4);
          const trackId = readU32Be(slice);
          const defaultSampleDescriptionIndex = readU32Be(slice);
          const defaultSampleDuration = readU32Be(slice);
          const defaultSampleSize = readU32Be(slice);
          const defaultSampleFlags = readU32Be(slice);
          this.fragmentTrackDefaults.push({
            trackId,
            defaultSampleDescriptionIndex,
            defaultSampleDuration,
            defaultSampleSize,
            defaultSampleFlags
          });
        }
        ;
        break;
      case "tfra":
        {
          const version = readU8(slice);
          slice.skip(3);
          const trackId = readU32Be(slice);
          const track = this.tracks.find((x) => x.id === trackId);
          if (!track) {
            break;
          }
          const word = readU32Be(slice);
          const lengthSizeOfTrafNum = (word & 48) >> 4;
          const lengthSizeOfTrunNum = (word & 12) >> 2;
          const lengthSizeOfSampleNum = word & 3;
          const functions = [readU8, readU16Be, readU24Be, readU32Be];
          const readTrafNum = functions[lengthSizeOfTrafNum];
          const readTrunNum = functions[lengthSizeOfTrunNum];
          const readSampleNum = functions[lengthSizeOfSampleNum];
          const numberOfEntries = readU32Be(slice);
          for (let i = 0;i < numberOfEntries; i++) {
            const time = version === 1 ? readU64Be(slice) : readU32Be(slice);
            const moofOffset = version === 1 ? readU64Be(slice) : readU32Be(slice);
            readTrafNum(slice);
            readTrunNum(slice);
            readSampleNum(slice);
            track.fragmentLookupTable.push({
              timestamp: time,
              moofOffset
            });
          }
          track.fragmentLookupTable.sort((a, b) => a.timestamp - b.timestamp);
          for (let i = 0;i < track.fragmentLookupTable.length - 1; i++) {
            const entry1 = track.fragmentLookupTable[i];
            const entry2 = track.fragmentLookupTable[i + 1];
            if (entry1.timestamp === entry2.timestamp) {
              track.fragmentLookupTable.splice(i + 1, 1);
              i--;
            }
          }
        }
        ;
        break;
      case "moof":
        {
          this.currentFragment = {
            moofOffset: startPos,
            moofSize: boxInfo.totalSize,
            implicitBaseDataOffset: startPos,
            trackData: new Map,
            psshBoxes: []
          };
          this.readContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
          this.lastReadFragment = this.currentFragment;
          this.currentFragment = null;
        }
        ;
        break;
      case "traf":
        {
          assert(this.currentFragment);
          this.readContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
          if (this.currentTrack) {
            const trackData = this.currentFragment.trackData.get(this.currentTrack.id);
            cond:
              if (trackData) {
                if (trackData.samples.length === 0) {
                  this.currentFragment.trackData.delete(this.currentTrack.id);
                  break cond;
                }
                trackData.presentationTimestamps = trackData.samples.map((x, i) => ({ presentationTimestamp: x.presentationTimestamp, sampleIndex: i })).sort((a, b) => a.presentationTimestamp - b.presentationTimestamp);
                for (let i = 0;i < trackData.presentationTimestamps.length; i++) {
                  const currentEntry = trackData.presentationTimestamps[i];
                  const currentSample = trackData.samples[currentEntry.sampleIndex];
                  if (trackData.firstKeyFrameTimestamp === null && currentSample.isKeyFrame) {
                    trackData.firstKeyFrameTimestamp = currentSample.presentationTimestamp;
                  }
                  if (i < trackData.presentationTimestamps.length - 1) {
                    const nextEntry = trackData.presentationTimestamps[i + 1];
                    const duration = nextEntry.presentationTimestamp - currentEntry.presentationTimestamp;
                    currentSample.duration = duration;
                  }
                }
                const firstSample = trackData.samples[trackData.presentationTimestamps[0].sampleIndex];
                const lastSample = trackData.samples[last(trackData.presentationTimestamps).sampleIndex];
                trackData.startTimestamp = firstSample.presentationTimestamp;
                trackData.endTimestamp = lastSample.presentationTimestamp + lastSample.duration;
                const { currentFragmentState } = this.currentTrack;
                assert(currentFragmentState);
                if (currentFragmentState.startTimestamp !== null) {
                  offsetFragmentTrackDataByTimestamp(trackData, currentFragmentState.startTimestamp);
                  trackData.startTimestampIsFinal = true;
                }
                if (currentFragmentState.encryptionAuxInfo && !trackData.samples[0].encryption) {
                  trackData.encryptionAuxInfo = currentFragmentState.encryptionAuxInfo;
                }
              }
            this.currentTrack.currentFragmentState = null;
            this.currentTrack = null;
          }
        }
        ;
        break;
      case "pssh":
        {
          if (this.input._formatOptions.isobmff?._suppressPsshParsing) {
            break;
          }
          const psshBox = parsePsshBoxContents(readBytes(slice, boxInfo.contentSize));
          if (this.currentFragment) {
            this.currentFragment.psshBoxes.push(psshBox);
          } else if (!this.currentTrack) {
            this.psshBoxes.push(psshBox);
          }
        }
        ;
        break;
      case "tfhd":
        {
          assert(this.currentFragment);
          slice.skip(1);
          const flags = readU24Be(slice);
          const baseDataOffsetPresent = Boolean(flags & 1);
          const sampleDescriptionIndexPresent = Boolean(flags & 2);
          const defaultSampleDurationPresent = Boolean(flags & 8);
          const defaultSampleSizePresent = Boolean(flags & 16);
          const defaultSampleFlagsPresent = Boolean(flags & 32);
          const durationIsEmpty = Boolean(flags & 65536);
          const defaultBaseIsMoof = Boolean(flags & 131072);
          const trackId = readU32Be(slice);
          const track = this.tracks.find((x) => x.id === trackId);
          if (!track) {
            break;
          }
          const defaults = this.fragmentTrackDefaults.find((x) => x.trackId === trackId);
          this.currentTrack = track;
          track.currentFragmentState = {
            baseDataOffset: this.currentFragment.implicitBaseDataOffset,
            sampleDescriptionIndex: defaults?.defaultSampleDescriptionIndex ?? null,
            defaultSampleDuration: defaults?.defaultSampleDuration ?? null,
            defaultSampleSize: defaults?.defaultSampleSize ?? null,
            defaultSampleFlags: defaults?.defaultSampleFlags ?? null,
            startTimestamp: null,
            encryptionAuxInfo: null
          };
          if (baseDataOffsetPresent) {
            track.currentFragmentState.baseDataOffset = readU64Be(slice);
          } else if (defaultBaseIsMoof) {
            track.currentFragmentState.baseDataOffset = this.currentFragment.moofOffset;
          }
          if (sampleDescriptionIndexPresent) {
            track.currentFragmentState.sampleDescriptionIndex = readU32Be(slice);
          }
          if (defaultSampleDurationPresent) {
            track.currentFragmentState.defaultSampleDuration = readU32Be(slice);
          }
          if (defaultSampleSizePresent) {
            track.currentFragmentState.defaultSampleSize = readU32Be(slice);
          }
          if (defaultSampleFlagsPresent) {
            track.currentFragmentState.defaultSampleFlags = readU32Be(slice);
          }
          if (durationIsEmpty) {
            track.currentFragmentState.defaultSampleDuration = 0;
          }
        }
        ;
        break;
      case "tfdt":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(track.currentFragmentState);
          const version = readU8(slice);
          slice.skip(3);
          const baseMediaDecodeTime = version === 0 ? readU32Be(slice) : readU64Be(slice);
          track.currentFragmentState.startTimestamp = baseMediaDecodeTime;
        }
        ;
        break;
      case "trun":
        {
          const track = this.currentTrack;
          if (!track) {
            break;
          }
          assert(this.currentFragment);
          assert(track.currentFragmentState);
          const version = readU8(slice);
          const flags = readU24Be(slice);
          const dataOffsetPresent = Boolean(flags & 1);
          const firstSampleFlagsPresent = Boolean(flags & 4);
          const sampleDurationPresent = Boolean(flags & 256);
          const sampleSizePresent = Boolean(flags & 512);
          const sampleFlagsPresent = Boolean(flags & 1024);
          const sampleCompositionTimeOffsetsPresent = Boolean(flags & 2048);
          const sampleCount = readU32Be(slice);
          let dataOffset = null;
          if (dataOffsetPresent) {
            dataOffset = readI32Be(slice);
          }
          let firstSampleFlags = null;
          if (firstSampleFlagsPresent) {
            firstSampleFlags = readU32Be(slice);
          }
          let trackData;
          if (this.currentFragment.trackData.has(track.id)) {
            trackData = this.currentFragment.trackData.get(track.id);
            if (dataOffset !== null) {
              trackData.currentOffset = track.currentFragmentState.baseDataOffset + dataOffset;
            } else {}
          } else {
            trackData = {
              track,
              currentTimestamp: 0,
              currentOffset: track.currentFragmentState.baseDataOffset + (dataOffset ?? 0),
              startTimestamp: 0,
              endTimestamp: 0,
              firstKeyFrameTimestamp: null,
              samples: [],
              presentationTimestamps: [],
              startTimestampIsFinal: false,
              encryptionAuxInfo: null
            };
            this.currentFragment.trackData.set(track.id, trackData);
          }
          for (let i = 0;i < sampleCount; i++) {
            let sampleDuration;
            if (sampleDurationPresent) {
              sampleDuration = readU32Be(slice);
            } else {
              assert(track.currentFragmentState.defaultSampleDuration !== null);
              sampleDuration = track.currentFragmentState.defaultSampleDuration;
            }
            let sampleSize;
            if (sampleSizePresent) {
              sampleSize = readU32Be(slice);
            } else {
              assert(track.currentFragmentState.defaultSampleSize !== null);
              sampleSize = track.currentFragmentState.defaultSampleSize;
            }
            let sampleFlags;
            if (sampleFlagsPresent) {
              sampleFlags = readU32Be(slice);
            } else {
              assert(track.currentFragmentState.defaultSampleFlags !== null);
              sampleFlags = track.currentFragmentState.defaultSampleFlags;
            }
            if (i === 0 && firstSampleFlags !== null) {
              sampleFlags = firstSampleFlags;
            }
            let sampleCompositionTimeOffset = 0;
            if (sampleCompositionTimeOffsetsPresent) {
              if (version === 0) {
                sampleCompositionTimeOffset = readU32Be(slice);
              } else {
                sampleCompositionTimeOffset = readI32Be(slice);
              }
            }
            const isKeyFrame = !(sampleFlags & 65536);
            trackData.samples.push({
              presentationTimestamp: trackData.currentTimestamp + sampleCompositionTimeOffset,
              duration: sampleDuration,
              byteOffset: trackData.currentOffset,
              byteSize: sampleSize,
              isKeyFrame,
              encryption: null
            });
            trackData.currentOffset += sampleSize;
            trackData.currentTimestamp += sampleDuration;
          }
          this.currentFragment.implicitBaseDataOffset = trackData.currentOffset;
        }
        ;
        break;
      case "saiz":
        {
          const track = this.currentTrack;
          if (!track || !track.encryptionInfo) {
            break;
          }
          slice.skip(1);
          const flags = readU24Be(slice);
          if (flags & 1) {
            const auxInfoType = readAscii(slice, 4);
            const auxInfoTypeParam = readU32Be(slice);
            if (auxInfoType !== track.encryptionInfo.scheme || auxInfoTypeParam !== 0) {
              break;
            }
          }
          const defaultSampleInfoSize = readU8(slice);
          const sampleCount = readU32Be(slice);
          let sampleSizes = null;
          if (defaultSampleInfoSize === 0 && sampleCount > 0) {
            sampleSizes = readBytes(slice, sampleCount);
          }
          const aux = getOrCreateEncryptionAuxInfo(track);
          aux.defaultSampleInfoSize = defaultSampleInfoSize;
          aux.sampleSizes = sampleSizes;
          aux.sampleCount = sampleCount;
        }
        ;
        break;
      case "saio":
        {
          const track = this.currentTrack;
          if (!track || !track.encryptionInfo) {
            break;
          }
          const version = readU8(slice);
          const flags = readU24Be(slice);
          if (flags & 1) {
            const auxInfoType = readAscii(slice, 4);
            const auxInfoTypeParam = readU32Be(slice);
            if (auxInfoType !== track.encryptionInfo.scheme || auxInfoTypeParam !== 0) {
              break;
            }
          }
          const entryCount = readU32Be(slice);
          if (entryCount === 0) {
            break;
          }
          if (entryCount > 1) {
            console.warn("Multiple saio entries are not supported; using the first offset only.");
          }
          let offset = version === 0 ? readU32Be(slice) : Number(readU64Be(slice));
          if (this.currentFragment) {
            offset += this.currentFragment.moofOffset;
          }
          const aux = getOrCreateEncryptionAuxInfo(track);
          aux.offset = offset;
        }
        ;
        break;
      case "senc":
        {
          const track = this.currentTrack;
          if (!track || !track.encryptionInfo) {
            break;
          }
          assert(this.currentFragment);
          const trackData = this.currentFragment.trackData.get(track.id);
          if (!trackData) {
            break;
          }
          slice.skip(1);
          const flags = readU24Be(slice);
          const useSubsamples = Boolean(flags & 2);
          const sampleCount = readU32Be(slice);
          const ivSize = track.encryptionInfo.defaultPerSampleIvSize;
          assert(ivSize !== null);
          for (let i = 0;i < Math.min(sampleCount, trackData.samples.length); i++) {
            const iv = new Uint8Array(16);
            if (ivSize > 0) {
              iv.set(readBytes(slice, ivSize), 0);
            } else {
              iv.set(track.encryptionInfo.defaultConstantIv, 0);
            }
            let subsamples = null;
            if (useSubsamples) {
              const subsampleCount = readU16Be(slice);
              subsamples = [];
              for (let j = 0;j < subsampleCount; j++) {
                const clearLen = readU16Be(slice);
                const protectedLen = readU32Be(slice);
                subsamples.push({ clearLen, protectedLen });
              }
            }
            const sample = trackData.samples[i];
            sample.encryption = { iv, subsamples };
          }
        }
        ;
        break;
      case "udta":
        {
          const iterator = this.iterateContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
          for (const { boxInfo: boxInfo2, slice: slice2 } of iterator) {
            if (boxInfo2.name !== "meta" && !this.currentTrack) {
              const startPos2 = slice2.filePos;
              this.metadataTags.raw ??= {};
              if (boxInfo2.name[0] === "©") {
                this.metadataTags.raw[boxInfo2.name] ??= readMetadataStringShort(slice2);
              } else {
                this.metadataTags.raw[boxInfo2.name] ??= readBytes(slice2, boxInfo2.contentSize);
              }
              slice2.filePos = startPos2;
            }
            switch (boxInfo2.name) {
              case "meta":
                {
                  slice2.skip(-boxInfo2.headerSize);
                  this.traverseBox(slice2);
                }
                ;
                break;
              case "©nam":
              case "name":
                {
                  if (this.currentTrack) {
                    this.currentTrack.name = textDecoder.decode(readBytes(slice2, boxInfo2.contentSize));
                  } else {
                    this.metadataTags.title ??= readMetadataStringShort(slice2);
                  }
                }
                ;
                break;
              case "©des":
                {
                  if (!this.currentTrack) {
                    this.metadataTags.description ??= readMetadataStringShort(slice2);
                  }
                }
                ;
                break;
              case "©ART":
                {
                  if (!this.currentTrack) {
                    this.metadataTags.artist ??= readMetadataStringShort(slice2);
                  }
                }
                ;
                break;
              case "©alb":
                {
                  if (!this.currentTrack) {
                    this.metadataTags.album ??= readMetadataStringShort(slice2);
                  }
                }
                ;
                break;
              case "albr":
                {
                  if (!this.currentTrack) {
                    this.metadataTags.albumArtist ??= readMetadataStringShort(slice2);
                  }
                }
                ;
                break;
              case "©gen":
                {
                  if (!this.currentTrack) {
                    this.metadataTags.genre ??= readMetadataStringShort(slice2);
                  }
                }
                ;
                break;
              case "©day":
                {
                  if (!this.currentTrack) {
                    const date = new Date(readMetadataStringShort(slice2));
                    if (!Number.isNaN(date.getTime())) {
                      this.metadataTags.date ??= date;
                    }
                  }
                }
                ;
                break;
              case "©cmt":
                {
                  if (!this.currentTrack) {
                    this.metadataTags.comment ??= readMetadataStringShort(slice2);
                  }
                }
                ;
                break;
              case "©lyr":
                {
                  if (!this.currentTrack) {
                    this.metadataTags.lyrics ??= readMetadataStringShort(slice2);
                  }
                }
                ;
                break;
            }
          }
        }
        ;
        break;
      case "meta":
        {
          if (this.currentTrack) {
            break;
          }
          const word = readU32Be(slice);
          const isQuickTime = word !== 0;
          this.currentMetadataKeys = new Map;
          if (isQuickTime) {
            this.readContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
          } else {
            this.readContiguousBoxes(slice.slice(contentStartPos + 4, boxInfo.contentSize - 4));
          }
          this.currentMetadataKeys = null;
        }
        ;
        break;
      case "keys":
        {
          if (!this.currentMetadataKeys) {
            break;
          }
          slice.skip(4);
          const entryCount = readU32Be(slice);
          for (let i = 0;i < entryCount; i++) {
            const keySize = readU32Be(slice);
            slice.skip(4);
            const keyName = textDecoder.decode(readBytes(slice, keySize - 8));
            this.currentMetadataKeys.set(i + 1, keyName);
          }
        }
        ;
        break;
      case "ilst":
        {
          if (!this.currentMetadataKeys) {
            break;
          }
          const iterator = this.iterateContiguousBoxes(slice.slice(contentStartPos, boxInfo.contentSize));
          for (const { boxInfo: boxInfo2, slice: slice2 } of iterator) {
            let metadataKey = boxInfo2.name;
            const nameAsNumber = (metadataKey.charCodeAt(0) << 24) + (metadataKey.charCodeAt(1) << 16) + (metadataKey.charCodeAt(2) << 8) + metadataKey.charCodeAt(3);
            if (this.currentMetadataKeys.has(nameAsNumber)) {
              metadataKey = this.currentMetadataKeys.get(nameAsNumber);
            }
            const data = readDataBox(slice2);
            this.metadataTags.raw ??= {};
            this.metadataTags.raw[metadataKey] ??= data;
            switch (metadataKey) {
              case "©nam":
              case "titl":
              case "com.apple.quicktime.title":
              case "title":
                {
                  if (typeof data === "string") {
                    this.metadataTags.title ??= data;
                  }
                }
                ;
                break;
              case "©des":
              case "desc":
              case "dscp":
              case "com.apple.quicktime.description":
              case "description":
                {
                  if (typeof data === "string") {
                    this.metadataTags.description ??= data;
                  }
                }
                ;
                break;
              case "©ART":
              case "com.apple.quicktime.artist":
              case "artist":
                {
                  if (typeof data === "string") {
                    this.metadataTags.artist ??= data;
                  }
                }
                ;
                break;
              case "©alb":
              case "albm":
              case "com.apple.quicktime.album":
              case "album":
                {
                  if (typeof data === "string") {
                    this.metadataTags.album ??= data;
                  }
                }
                ;
                break;
              case "aART":
              case "album_artist":
                {
                  if (typeof data === "string") {
                    this.metadataTags.albumArtist ??= data;
                  }
                }
                ;
                break;
              case "©cmt":
              case "com.apple.quicktime.comment":
              case "comment":
                {
                  if (typeof data === "string") {
                    this.metadataTags.comment ??= data;
                  }
                }
                ;
                break;
              case "©gen":
              case "gnre":
              case "com.apple.quicktime.genre":
              case "genre":
                {
                  if (typeof data === "string") {
                    this.metadataTags.genre ??= data;
                  }
                }
                ;
                break;
              case "©lyr":
              case "lyrics":
                {
                  if (typeof data === "string") {
                    this.metadataTags.lyrics ??= data;
                  }
                }
                ;
                break;
              case "©day":
              case "rldt":
              case "com.apple.quicktime.creationdate":
              case "date":
                {
                  if (typeof data === "string") {
                    const date = new Date(data);
                    if (!Number.isNaN(date.getTime())) {
                      this.metadataTags.date ??= date;
                    }
                  }
                }
                ;
                break;
              case "covr":
              case "com.apple.quicktime.artwork":
                {
                  if (data instanceof RichImageData) {
                    this.metadataTags.images ??= [];
                    this.metadataTags.images.push({
                      data: data.data,
                      kind: "coverFront",
                      mimeType: data.mimeType
                    });
                  } else if (data instanceof Uint8Array) {
                    this.metadataTags.images ??= [];
                    this.metadataTags.images.push({
                      data,
                      kind: "coverFront",
                      mimeType: "image/*"
                    });
                  }
                }
                ;
                break;
              case "track":
                {
                  if (typeof data === "string") {
                    const parts = data.split("/");
                    const trackNum = Number.parseInt(parts[0], 10);
                    const tracksTotal = parts[1] && Number.parseInt(parts[1], 10);
                    if (Number.isInteger(trackNum) && trackNum > 0) {
                      this.metadataTags.trackNumber ??= trackNum;
                    }
                    if (tracksTotal && Number.isInteger(tracksTotal) && tracksTotal > 0) {
                      this.metadataTags.tracksTotal ??= tracksTotal;
                    }
                  }
                }
                ;
                break;
              case "trkn":
                {
                  if (data instanceof Uint8Array && data.length >= 6) {
                    const view = toDataView(data);
                    const trackNumber = view.getUint16(2, false);
                    const tracksTotal = view.getUint16(4, false);
                    if (trackNumber > 0) {
                      this.metadataTags.trackNumber ??= trackNumber;
                    }
                    if (tracksTotal > 0) {
                      this.metadataTags.tracksTotal ??= tracksTotal;
                    }
                  }
                }
                ;
                break;
              case "disc":
              case "disk":
                {
                  if (data instanceof Uint8Array && data.length >= 6) {
                    const view = toDataView(data);
                    const discNumber = view.getUint16(2, false);
                    const discNumberMax = view.getUint16(4, false);
                    if (discNumber > 0) {
                      this.metadataTags.discNumber ??= discNumber;
                    }
                    if (discNumberMax > 0) {
                      this.metadataTags.discsTotal ??= discNumberMax;
                    }
                  }
                }
                ;
                break;
            }
          }
        }
        ;
        break;
    }
    slice.filePos = boxEndPos;
    return true;
  }
}

class IsobmffTrackBacking {
  constructor(internalTrack) {
    this.internalTrack = internalTrack;
    this.packetToSampleIndex = new WeakMap;
    this.packetToFragmentLocation = new WeakMap;
  }
  getId() {
    return this.internalTrack.id;
  }
  getNumber() {
    const demuxer = this.internalTrack.demuxer;
    const trackType = this.internalTrack.trackBacking.getType();
    let number = 0;
    for (const track of demuxer.tracks) {
      if (track.trackBacking.getType() === trackType) {
        number++;
      }
      if (track === this.internalTrack) {
        break;
      }
    }
    return number;
  }
  getCodec() {
    throw new Error("Not implemented on base class.");
  }
  getInternalCodecId() {
    return this.internalTrack.internalCodecId;
  }
  getName() {
    return this.internalTrack.name;
  }
  getLanguageCode() {
    return this.internalTrack.languageCode;
  }
  getTimeResolution() {
    return this.internalTrack.timescale;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getDisposition() {
    return this.internalTrack.disposition;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    const track = this.internalTrack;
    if (track.durationInMediaTimescale <= 0) {
      return null;
    }
    assert(track.trackBacking);
    const firstPacket = await track.trackBacking.getFirstPacket({ metadataOnly: true });
    return (firstPacket?.timestamp ?? 0) + track.durationInMediaTimescale / track.timescale;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  async getFirstPacket(options) {
    const regularPacket = await this.fetchPacketForSampleIndex(0, options);
    if (regularPacket || !this.internalTrack.demuxer.isFragmented) {
      return regularPacket;
    }
    return this.performFragmentedLookup(null, (fragment) => {
      const trackData = fragment.trackData.get(this.internalTrack.id);
      if (trackData) {
        return {
          sampleIndex: 0,
          correctSampleFound: true
        };
      }
      return {
        sampleIndex: -1,
        correctSampleFound: false
      };
    }, -Infinity, Infinity, options);
  }
  mapTimestampIntoTimescale(timestamp) {
    return roundIfAlmostInteger(timestamp * this.internalTrack.timescale) + this.internalTrack.editListOffset;
  }
  async getPacket(timestamp, options) {
    const timestampInTimescale = this.mapTimestampIntoTimescale(timestamp);
    const sampleTable = this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack);
    const sampleIndex = getSampleIndexForTimestamp(sampleTable, timestampInTimescale);
    const regularPacket = await this.fetchPacketForSampleIndex(sampleIndex, options);
    if (!sampleTableIsEmpty(sampleTable) || !this.internalTrack.demuxer.isFragmented) {
      return regularPacket;
    }
    return this.performFragmentedLookup(null, (fragment) => {
      const trackData = fragment.trackData.get(this.internalTrack.id);
      if (!trackData) {
        return { sampleIndex: -1, correctSampleFound: false };
      }
      const index = binarySearchLessOrEqual(trackData.presentationTimestamps, timestampInTimescale, (x) => x.presentationTimestamp);
      const sampleIndex2 = index !== -1 ? trackData.presentationTimestamps[index].sampleIndex : -1;
      const correctSampleFound = index !== -1 && timestampInTimescale < trackData.endTimestamp;
      return { sampleIndex: sampleIndex2, correctSampleFound };
    }, timestampInTimescale, timestampInTimescale, options);
  }
  async getNextPacket(packet, options) {
    const regularSampleIndex = this.packetToSampleIndex.get(packet);
    if (regularSampleIndex !== undefined) {
      return this.fetchPacketForSampleIndex(regularSampleIndex + 1, options);
    }
    const locationInFragment = this.packetToFragmentLocation.get(packet);
    if (locationInFragment === undefined) {
      throw new Error("Packet was not created from this track.");
    }
    return this.performFragmentedLookup(locationInFragment.fragment, (fragment) => {
      if (fragment === locationInFragment.fragment) {
        const trackData = fragment.trackData.get(this.internalTrack.id);
        if (locationInFragment.sampleIndex + 1 < trackData.samples.length) {
          return {
            sampleIndex: locationInFragment.sampleIndex + 1,
            correctSampleFound: true
          };
        }
      } else {
        const trackData = fragment.trackData.get(this.internalTrack.id);
        if (trackData) {
          return {
            sampleIndex: 0,
            correctSampleFound: true
          };
        }
      }
      return {
        sampleIndex: -1,
        correctSampleFound: false
      };
    }, -Infinity, Infinity, options);
  }
  async getKeyPacket(timestamp, options) {
    const timestampInTimescale = this.mapTimestampIntoTimescale(timestamp);
    const sampleTable = this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack);
    const sampleIndex = getKeyframeSampleIndexForTimestamp(sampleTable, timestampInTimescale);
    const regularPacket = await this.fetchPacketForSampleIndex(sampleIndex, options);
    if (!sampleTableIsEmpty(sampleTable) || !this.internalTrack.demuxer.isFragmented) {
      return regularPacket;
    }
    return this.performFragmentedLookup(null, (fragment) => {
      const trackData = fragment.trackData.get(this.internalTrack.id);
      if (!trackData) {
        return { sampleIndex: -1, correctSampleFound: false };
      }
      const index = findLastIndex(trackData.presentationTimestamps, (x) => {
        const sample = trackData.samples[x.sampleIndex];
        return sample.isKeyFrame && x.presentationTimestamp <= timestampInTimescale;
      });
      const sampleIndex2 = index !== -1 ? trackData.presentationTimestamps[index].sampleIndex : -1;
      const correctSampleFound = index !== -1 && timestampInTimescale < trackData.endTimestamp;
      return { sampleIndex: sampleIndex2, correctSampleFound };
    }, timestampInTimescale, timestampInTimescale, options);
  }
  async getNextKeyPacket(packet, options) {
    const regularSampleIndex = this.packetToSampleIndex.get(packet);
    if (regularSampleIndex !== undefined) {
      const sampleTable = this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack);
      const nextKeyFrameSampleIndex = getNextKeyframeIndexForSample(sampleTable, regularSampleIndex);
      return this.fetchPacketForSampleIndex(nextKeyFrameSampleIndex, options);
    }
    const locationInFragment = this.packetToFragmentLocation.get(packet);
    if (locationInFragment === undefined) {
      throw new Error("Packet was not created from this track.");
    }
    return this.performFragmentedLookup(locationInFragment.fragment, (fragment) => {
      if (fragment === locationInFragment.fragment) {
        const trackData = fragment.trackData.get(this.internalTrack.id);
        const nextKeyFrameIndex = trackData.samples.findIndex((x, i) => x.isKeyFrame && i > locationInFragment.sampleIndex);
        if (nextKeyFrameIndex !== -1) {
          return {
            sampleIndex: nextKeyFrameIndex,
            correctSampleFound: true
          };
        }
      } else {
        const trackData = fragment.trackData.get(this.internalTrack.id);
        if (trackData && trackData.firstKeyFrameTimestamp !== null) {
          const keyFrameIndex = trackData.samples.findIndex((x) => x.isKeyFrame);
          assert(keyFrameIndex !== -1);
          return {
            sampleIndex: keyFrameIndex,
            correctSampleFound: true
          };
        }
      }
      return {
        sampleIndex: -1,
        correctSampleFound: false
      };
    }, -Infinity, Infinity, options);
  }
  async fetchPacketForSampleIndex(sampleIndex, options) {
    if (sampleIndex === -1) {
      return null;
    }
    const sampleTable = this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack);
    const sampleInfo = getSampleInfo(sampleTable, sampleIndex);
    if (!sampleInfo) {
      return null;
    }
    let data;
    if (options.metadataOnly) {
      data = PLACEHOLDER_DATA;
    } else {
      let slice = this.internalTrack.demuxer.reader.requestSlice(sampleInfo.sampleOffset, sampleInfo.sampleSize);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice) {
        return null;
      }
      data = readBytes(slice, sampleInfo.sampleSize);
      if (this.internalTrack.encryptionAuxInfo) {
        assert(this.internalTrack.encryptionInfo);
        const entries = await resolveEncryptionAuxInfo(this.internalTrack.demuxer.reader, this.internalTrack.encryptionInfo, this.internalTrack.encryptionAuxInfo);
        if (sampleIndex < entries.length) {
          data = await decryptSample(this.internalTrack, entries[sampleIndex], data, null);
        }
      }
    }
    const timestamp = (sampleInfo.presentationTimestamp - this.internalTrack.editListOffset) / this.internalTrack.timescale;
    const duration = sampleInfo.duration / this.internalTrack.timescale;
    const packet = new EncodedPacket(data, sampleInfo.isKeyFrame ? "key" : "delta", timestamp, duration, sampleIndex, sampleInfo.sampleSize);
    this.packetToSampleIndex.set(packet, sampleIndex);
    return packet;
  }
  async fetchPacketInFragment(fragment, sampleIndex, options) {
    if (sampleIndex === -1) {
      return null;
    }
    const trackData = fragment.trackData.get(this.internalTrack.id);
    const fragmentSample = trackData.samples[sampleIndex];
    assert(fragmentSample);
    let data;
    if (options.metadataOnly) {
      data = PLACEHOLDER_DATA;
    } else {
      let slice = this.internalTrack.demuxer.reader.requestSlice(fragmentSample.byteOffset, fragmentSample.byteSize);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice) {
        return null;
      }
      data = readBytes(slice, fragmentSample.byteSize);
      if (fragmentSample.encryption) {
        data = await decryptSample(this.internalTrack, fragmentSample.encryption, data, fragment);
      }
    }
    const timestamp = (fragmentSample.presentationTimestamp - this.internalTrack.editListOffset) / this.internalTrack.timescale;
    const duration = fragmentSample.duration / this.internalTrack.timescale;
    const packet = new EncodedPacket(data, fragmentSample.isKeyFrame ? "key" : "delta", timestamp, duration, fragment.moofOffset + sampleIndex, fragmentSample.byteSize);
    this.packetToFragmentLocation.set(packet, { fragment, sampleIndex });
    return packet;
  }
  async performFragmentedLookup(startFragment, getMatchInFragment, searchTimestamp, latestTimestamp, options) {
    const demuxer = this.internalTrack.demuxer;
    let currentFragment = null;
    let bestFragment = null;
    let bestSampleIndex = -1;
    if (startFragment) {
      const { sampleIndex, correctSampleFound } = getMatchInFragment(startFragment);
      if (correctSampleFound) {
        return this.fetchPacketInFragment(startFragment, sampleIndex, options);
      }
      if (sampleIndex !== -1) {
        bestFragment = startFragment;
        bestSampleIndex = sampleIndex;
      }
    }
    const lookupEntryIndex = binarySearchLessOrEqual(this.internalTrack.fragmentLookupTable, searchTimestamp, (x) => x.timestamp);
    const lookupEntry = lookupEntryIndex !== -1 ? this.internalTrack.fragmentLookupTable[lookupEntryIndex] : null;
    const positionCacheIndex = binarySearchLessOrEqual(this.internalTrack.fragmentPositionCache, searchTimestamp, (x) => x.startTimestamp);
    const positionCacheEntry = positionCacheIndex !== -1 ? this.internalTrack.fragmentPositionCache[positionCacheIndex] : null;
    const lookupEntryPosition = Math.max(lookupEntry?.moofOffset ?? 0, positionCacheEntry?.moofOffset ?? 0) || null;
    let currentPos;
    if (!startFragment) {
      currentPos = lookupEntryPosition ?? 0;
    } else {
      if (lookupEntryPosition === null || startFragment.moofOffset >= lookupEntryPosition) {
        currentPos = startFragment.moofOffset + startFragment.moofSize;
        currentFragment = startFragment;
      } else {
        currentPos = lookupEntryPosition;
      }
    }
    while (true) {
      if (currentFragment) {
        const trackData = currentFragment.trackData.get(this.internalTrack.id);
        if (trackData && trackData.startTimestamp > latestTimestamp) {
          break;
        }
      }
      let slice = demuxer.reader.requestSliceRange(currentPos, MIN_BOX_HEADER_SIZE, MAX_BOX_HEADER_SIZE);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice)
        break;
      const boxStartPos = currentPos;
      const boxInfo = readBoxHeader(slice);
      if (!boxInfo) {
        break;
      }
      if (boxInfo.name === "moof") {
        currentFragment = await demuxer.readFragment(boxStartPos);
        const { sampleIndex, correctSampleFound } = getMatchInFragment(currentFragment);
        if (correctSampleFound) {
          return this.fetchPacketInFragment(currentFragment, sampleIndex, options);
        }
        if (sampleIndex !== -1) {
          bestFragment = currentFragment;
          bestSampleIndex = sampleIndex;
        }
      }
      currentPos = boxStartPos + boxInfo.totalSize;
    }
    if (lookupEntry && (!bestFragment || bestFragment.moofOffset < lookupEntry.moofOffset)) {
      const previousLookupEntry = this.internalTrack.fragmentLookupTable[lookupEntryIndex - 1];
      assert(!previousLookupEntry || previousLookupEntry.timestamp < lookupEntry.timestamp);
      const newSearchTimestamp = previousLookupEntry?.timestamp ?? -Infinity;
      return this.performFragmentedLookup(null, getMatchInFragment, newSearchTimestamp, latestTimestamp, options);
    }
    if (bestFragment) {
      return this.fetchPacketInFragment(bestFragment, bestSampleIndex, options);
    }
    return null;
  }
}

class IsobmffVideoTrackBacking extends IsobmffTrackBacking {
  constructor(internalTrack) {
    super(internalTrack);
    this.decoderConfigPromise = null;
    this.internalTrack = internalTrack;
  }
  getType() {
    return "video";
  }
  getCodec() {
    return this.internalTrack.info.codec;
  }
  getCodedWidth() {
    return this.internalTrack.info.width;
  }
  getCodedHeight() {
    return this.internalTrack.info.height;
  }
  getSquarePixelWidth() {
    return this.internalTrack.info.squarePixelWidth;
  }
  getSquarePixelHeight() {
    return this.internalTrack.info.squarePixelHeight;
  }
  getRotation() {
    return this.internalTrack.rotation;
  }
  async getColorSpace() {
    return {
      primaries: this.internalTrack.info.colorSpace?.primaries,
      transfer: this.internalTrack.info.colorSpace?.transfer,
      matrix: this.internalTrack.info.colorSpace?.matrix,
      fullRange: this.internalTrack.info.colorSpace?.fullRange
    };
  }
  async canBeTransparent() {
    return false;
  }
  async getDecoderConfig() {
    if (!this.internalTrack.info.codec) {
      return null;
    }
    return this.decoderConfigPromise ??= (async () => {
      if (this.internalTrack.info.codec === "vp9" && !this.internalTrack.info.vp9CodecInfo) {
        const firstPacket = await this.getFirstPacket({});
        this.internalTrack.info.vp9CodecInfo = firstPacket && extractVp9CodecInfoFromPacket(firstPacket.data);
      } else if (this.internalTrack.info.codec === "av1" && !this.internalTrack.info.av1CodecInfo) {
        const firstPacket = await this.getFirstPacket({});
        this.internalTrack.info.av1CodecInfo = firstPacket && extractAv1CodecInfoFromPacket(firstPacket.data);
      }
      const config = {
        codec: extractVideoCodecString(this.internalTrack.info),
        codedWidth: this.internalTrack.info.width,
        codedHeight: this.internalTrack.info.height,
        description: this.internalTrack.info.codecDescription ?? undefined,
        colorSpace: this.internalTrack.info.colorSpace ?? undefined
      };
      if (this.internalTrack.info.width !== this.internalTrack.info.squarePixelWidth || this.internalTrack.info.height !== this.internalTrack.info.squarePixelHeight) {
        config.displayAspectWidth = this.internalTrack.info.squarePixelWidth;
        config.displayAspectHeight = this.internalTrack.info.squarePixelHeight;
      }
      return config;
    })();
  }
}

class IsobmffAudioTrackBacking extends IsobmffTrackBacking {
  constructor(internalTrack) {
    super(internalTrack);
    this.decoderConfig = null;
    this.internalTrack = internalTrack;
  }
  getType() {
    return "audio";
  }
  getCodec() {
    return this.internalTrack.info.codec;
  }
  getNumberOfChannels() {
    return this.internalTrack.info.numberOfChannels;
  }
  getSampleRate() {
    return this.internalTrack.info.sampleRate;
  }
  async getDecoderConfig() {
    if (!this.internalTrack.info.codec) {
      return null;
    }
    return this.decoderConfig ??= {
      codec: extractAudioCodecString(this.internalTrack.info),
      numberOfChannels: this.internalTrack.info.numberOfChannels,
      sampleRate: this.internalTrack.info.sampleRate,
      description: this.internalTrack.info.codecDescription ?? undefined
    };
  }
}
var getSampleIndexForTimestamp = (sampleTable, timescaleUnits) => {
  if (sampleTable.presentationTimestamps) {
    const index = binarySearchLessOrEqual(sampleTable.presentationTimestamps, timescaleUnits, (x) => x.presentationTimestamp);
    if (index === -1) {
      return -1;
    }
    return sampleTable.presentationTimestamps[index].sampleIndex;
  } else {
    const index = binarySearchLessOrEqual(sampleTable.sampleTimingEntries, timescaleUnits, (x) => x.startDecodeTimestamp);
    if (index === -1) {
      return -1;
    }
    const entry = sampleTable.sampleTimingEntries[index];
    return entry.startIndex + Math.min(Math.floor((timescaleUnits - entry.startDecodeTimestamp) / entry.delta), entry.count - 1);
  }
};
var getKeyframeSampleIndexForTimestamp = (sampleTable, timescaleUnits) => {
  if (!sampleTable.keySampleIndices) {
    return getSampleIndexForTimestamp(sampleTable, timescaleUnits);
  }
  if (sampleTable.presentationTimestamps) {
    const index = binarySearchLessOrEqual(sampleTable.presentationTimestamps, timescaleUnits, (x) => x.presentationTimestamp);
    if (index === -1) {
      return -1;
    }
    for (let i = index;i >= 0; i--) {
      const sampleIndex = sampleTable.presentationTimestamps[i].sampleIndex;
      const isKeyFrame = binarySearchExact(sampleTable.keySampleIndices, sampleIndex, (x) => x) !== -1;
      if (isKeyFrame) {
        return sampleIndex;
      }
    }
    return -1;
  } else {
    const sampleIndex = getSampleIndexForTimestamp(sampleTable, timescaleUnits);
    const index = binarySearchLessOrEqual(sampleTable.keySampleIndices, sampleIndex, (x) => x);
    return sampleTable.keySampleIndices[index] ?? -1;
  }
};
var getSampleInfo = (sampleTable, sampleIndex) => {
  const timingEntryIndex = binarySearchLessOrEqual(sampleTable.sampleTimingEntries, sampleIndex, (x) => x.startIndex);
  const timingEntry = sampleTable.sampleTimingEntries[timingEntryIndex];
  if (!timingEntry || timingEntry.startIndex + timingEntry.count <= sampleIndex) {
    return null;
  }
  const decodeTimestamp = timingEntry.startDecodeTimestamp + (sampleIndex - timingEntry.startIndex) * timingEntry.delta;
  let presentationTimestamp = decodeTimestamp;
  const offsetEntryIndex = binarySearchLessOrEqual(sampleTable.sampleCompositionTimeOffsets, sampleIndex, (x) => x.startIndex);
  const offsetEntry = sampleTable.sampleCompositionTimeOffsets[offsetEntryIndex];
  if (offsetEntry && sampleIndex - offsetEntry.startIndex < offsetEntry.count) {
    presentationTimestamp += offsetEntry.offset;
  }
  const sampleSize = sampleTable.sampleSizes[Math.min(sampleIndex, sampleTable.sampleSizes.length - 1)];
  const chunkEntryIndex = binarySearchLessOrEqual(sampleTable.sampleToChunk, sampleIndex, (x) => x.startSampleIndex);
  const chunkEntry = sampleTable.sampleToChunk[chunkEntryIndex];
  assert(chunkEntry);
  const chunkIndex = chunkEntry.startChunkIndex + Math.floor((sampleIndex - chunkEntry.startSampleIndex) / chunkEntry.samplesPerChunk);
  const chunkOffset = sampleTable.chunkOffsets[chunkIndex];
  const startSampleIndexOfChunk = chunkEntry.startSampleIndex + (chunkIndex - chunkEntry.startChunkIndex) * chunkEntry.samplesPerChunk;
  let chunkSize = 0;
  let sampleOffset = chunkOffset;
  if (sampleTable.sampleSizes.length === 1) {
    sampleOffset += sampleSize * (sampleIndex - startSampleIndexOfChunk);
    chunkSize += sampleSize * chunkEntry.samplesPerChunk;
  } else {
    for (let i = startSampleIndexOfChunk;i < startSampleIndexOfChunk + chunkEntry.samplesPerChunk; i++) {
      const sampleSize2 = sampleTable.sampleSizes[i];
      if (i < sampleIndex) {
        sampleOffset += sampleSize2;
      }
      chunkSize += sampleSize2;
    }
  }
  let duration = timingEntry.delta;
  if (sampleTable.presentationTimestamps) {
    const presentationIndex = sampleTable.presentationTimestampIndexMap[sampleIndex];
    assert(presentationIndex !== undefined);
    if (presentationIndex < sampleTable.presentationTimestamps.length - 1) {
      const nextEntry = sampleTable.presentationTimestamps[presentationIndex + 1];
      const nextPresentationTimestamp = nextEntry.presentationTimestamp;
      duration = nextPresentationTimestamp - presentationTimestamp;
    }
  }
  return {
    presentationTimestamp,
    duration,
    sampleOffset,
    sampleSize,
    chunkOffset,
    chunkSize,
    isKeyFrame: sampleTable.keySampleIndices ? binarySearchExact(sampleTable.keySampleIndices, sampleIndex, (x) => x) !== -1 : true
  };
};
var getNextKeyframeIndexForSample = (sampleTable, sampleIndex) => {
  if (!sampleTable.keySampleIndices) {
    return sampleIndex + 1;
  }
  const index = binarySearchLessOrEqual(sampleTable.keySampleIndices, sampleIndex, (x) => x);
  return sampleTable.keySampleIndices[index + 1] ?? -1;
};
var offsetFragmentTrackDataByTimestamp = (trackData, timestamp) => {
  trackData.startTimestamp += timestamp;
  trackData.endTimestamp += timestamp;
  for (const sample of trackData.samples) {
    sample.presentationTimestamp += timestamp;
  }
  for (const entry of trackData.presentationTimestamps) {
    entry.presentationTimestamp += timestamp;
  }
};
var extractRotationFromMatrix = (matrix) => {
  const [a, b] = matrix;
  const radians = Math.atan2(b, a);
  if (!Number.isFinite(radians)) {
    return 0;
  }
  return radians * (180 / Math.PI);
};
var sampleTableIsEmpty = (sampleTable) => {
  return sampleTable.sampleSizes.length === 0;
};
var getOrCreateEncryptionAuxInfo = (track) => {
  if (track.currentFragmentState) {
    return track.currentFragmentState.encryptionAuxInfo ??= {
      defaultSampleInfoSize: 0,
      sampleSizes: null,
      sampleCount: 0,
      offset: null,
      resolved: null
    };
  } else {
    return track.encryptionAuxInfo ??= {
      defaultSampleInfoSize: 0,
      sampleSizes: null,
      sampleCount: 0,
      offset: null,
      resolved: null
    };
  }
};
var resolveEncryptionAuxInfo = async (reader, encryptionInfo, aux) => {
  if (aux.resolved) {
    return aux.resolved;
  }
  if (aux.offset === null || aux.sampleCount === 0) {
    throw new Error("Incomplete saiz/saio info; cannot resolve encryption data.");
  }
  let totalSize = 0;
  if (aux.defaultSampleInfoSize > 0) {
    totalSize = aux.defaultSampleInfoSize * aux.sampleCount;
  } else {
    assert(aux.sampleSizes);
    for (let i = 0;i < aux.sampleCount; i++) {
      totalSize += aux.sampleSizes[i];
    }
  }
  let slice = reader.requestSlice(aux.offset, totalSize);
  if (slice instanceof Promise)
    slice = await slice;
  if (!slice) {
    throw new Error("Failed to read auxiliary encryption info.");
  }
  const ivSize = encryptionInfo.defaultPerSampleIvSize;
  assert(ivSize !== null);
  const entries = [];
  for (let i = 0;i < aux.sampleCount; i++) {
    const entrySize = aux.defaultSampleInfoSize > 0 ? aux.defaultSampleInfoSize : aux.sampleSizes[i];
    const iv = new Uint8Array(16);
    if (ivSize > 0) {
      iv.set(readBytes(slice, ivSize), 0);
    } else {
      iv.set(encryptionInfo.defaultConstantIv, 0);
    }
    let subsamples = null;
    if (entrySize > ivSize) {
      const subsampleCount = readU16Be(slice);
      subsamples = [];
      for (let j = 0;j < subsampleCount; j++) {
        const clearLen = readU16Be(slice);
        const protectedLen = readU32Be(slice);
        subsamples.push({ clearLen, protectedLen });
      }
    }
    entries.push({ iv, subsamples });
  }
  aux.resolved = entries;
  return entries;
};
var decryptSample = async (track, sampleEncryption, data, fragment) => {
  assert(track.encryptionInfo);
  const encryptionInfo = track.encryptionInfo;
  assert(encryptionInfo.defaultKid !== null);
  const keyId = encryptionInfo.defaultKid;
  let keyBytes;
  const cacheEntry = track.demuxer.decryptionKeyCache.get(keyId);
  if (cacheEntry) {
    keyBytes = await cacheEntry;
  } else {
    if (!track.demuxer.input._formatOptions.isobmff?.resolveKeyId) {
      throw new Error("Encrypted media samples encountered. To decrypt them, please provide a callback for" + " InputOptions.formatOptions.isobmff.resolveKeyId.");
    }
    const promise = (async () => {
      let psshBoxes = track.demuxer.psshBoxes;
      if (fragment) {
        psshBoxes = [
          ...psshBoxes,
          ...fragment.psshBoxes
        ].filter((x) => x.keyIds === null || x.keyIds.includes(keyId));
        for (let i = 0;i < psshBoxes.length - 1; i++) {
          for (let j = i + 1;j < psshBoxes.length; j++) {
            if (psshBoxesAreEqual(psshBoxes[i], psshBoxes[j])) {
              psshBoxes.splice(j, 1);
              j--;
            }
          }
        }
      }
      const keyResult = await track.demuxer.input._formatOptions.isobmff.resolveKeyId({ keyId, psshBoxes });
      if (!(typeof keyResult === "string" && keyResult.length === 32 && HEX_STRING_REGEX.test(keyResult) || keyResult instanceof Uint8Array && keyResult.byteLength === 16)) {
        throw new TypeError("resolveKeyId must return a 32-character hex string or a 16-byte Uint8Array containing the" + " decryption key.");
      }
      return keyResult instanceof Uint8Array ? keyResult : hexStringToBytes(keyResult);
    })();
    track.demuxer.decryptionKeyCache.set(keyId, promise);
    keyBytes = await promise;
  }
  if (encryptionInfo.scheme === "cenc" || encryptionInfo.scheme === "cens") {
    return decryptCtr(keyBytes, encryptionInfo, sampleEncryption, data);
  } else {
    return decryptCbcs(keyBytes, encryptionInfo, sampleEncryption, data);
  }
};
var decryptCtr = async (key, encryptionInfo, sampleEncryption, data) => {
  const counter = new Uint8Array(16);
  counter.set(sampleEncryption.iv, 0);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CTR" }, false, ["decrypt"]);
  const cryptApply = async (input) => {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 64 }, cryptoKey, input);
    return new Uint8Array(plaintext);
  };
  if (!sampleEncryption.subsamples) {
    return cryptApply(data);
  }
  assert(encryptionInfo.defaultCryptByteBlock !== null && encryptionInfo.defaultSkipByteBlock !== null);
  const cryptRanges = collectCryptRanges(sampleEncryption.subsamples, encryptionInfo.defaultCryptByteBlock, encryptionInfo.defaultSkipByteBlock);
  let totalCryptLen = 0;
  for (const range of cryptRanges) {
    for (const seg of range.perSubsample) {
      totalCryptLen += seg.length;
    }
  }
  const cryptBuffer = new Uint8Array(totalCryptLen);
  let writePos = 0;
  for (const range of cryptRanges) {
    for (const seg of range.perSubsample) {
      cryptBuffer.set(data.subarray(seg.offset, seg.offset + seg.length), writePos);
      writePos += seg.length;
    }
  }
  const plain = await cryptApply(cryptBuffer);
  const output = new Uint8Array(data);
  let readPos = 0;
  for (const range of cryptRanges) {
    for (const seg of range.perSubsample) {
      output.set(plain.subarray(readPos, readPos + seg.length), seg.offset);
      readPos += seg.length;
    }
  }
  return output;
};
var decryptCbcs = (key, encryptionInfo, sampleEncryption, data) => {
  const ctx = new Aes128CbcContext;
  ctx.init({ key, iv: sampleEncryption.iv });
  const cryptByteBlock = encryptionInfo.defaultCryptByteBlock;
  const skipByteBlock = encryptionInfo.defaultSkipByteBlock;
  assert(cryptByteBlock !== null && skipByteBlock !== null);
  if (!sampleEncryption.subsamples) {
    const output2 = new Uint8Array(data);
    const numBlocks = Math.floor(data.length / 16);
    for (let b = 0;b < numBlocks; b++) {
      const off = b * 16;
      ctx.in.set(data.subarray(off, off + 16));
      ctx.decrypt();
      output2.set(ctx.out, off);
    }
    return output2;
  }
  if (cryptByteBlock === 0 && skipByteBlock === 0) {
    throw new Error("cbcs with subsamples requires pattern encryption.");
  }
  const output = new Uint8Array(data);
  const cryptRanges = collectCryptRanges(sampleEncryption.subsamples, cryptByteBlock, skipByteBlock);
  const ivView = new DataView(sampleEncryption.iv.buffer, sampleEncryption.iv.byteOffset, 16);
  for (const range of cryptRanges) {
    ctx.iv[0] = ivView.getUint32(0, false);
    ctx.iv[1] = ivView.getUint32(4, false);
    ctx.iv[2] = ivView.getUint32(8, false);
    ctx.iv[3] = ivView.getUint32(12, false);
    for (const seg of range.perSubsample) {
      const numBlocks = seg.length / 16;
      for (let b = 0;b < numBlocks; b++) {
        const offset = seg.offset + b * 16;
        ctx.in.set(data.subarray(offset, offset + 16));
        ctx.decrypt();
        output.set(ctx.out, offset);
      }
    }
  }
  return output;
};
var collectCryptRanges = (subsamples, cryptByteBlock, skipByteBlock) => {
  const ranges = [];
  const hasPattern = cryptByteBlock !== 0 || skipByteBlock !== 0;
  let cursor = 0;
  for (const subsample of subsamples) {
    cursor += subsample.clearLen;
    const perSubsample = [];
    if (!hasPattern) {
      if (subsample.protectedLen > 0) {
        perSubsample.push({ offset: cursor, length: subsample.protectedLen });
      }
      cursor += subsample.protectedLen;
    } else {
      let remaining = subsample.protectedLen;
      let pos = cursor;
      while (remaining > 0) {
        if (remaining < 16 * cryptByteBlock) {
          break;
        }
        const cryptBytes = 16 * cryptByteBlock;
        perSubsample.push({ offset: pos, length: cryptBytes });
        pos += cryptBytes;
        remaining -= cryptBytes;
        const skipBytes = Math.min(16 * skipByteBlock, remaining);
        pos += skipBytes;
        remaining -= skipBytes;
      }
      cursor += subsample.protectedLen;
    }
    ranges.push({ perSubsample });
  }
  return ranges;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/matroska/ebml.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var EBMLId;
(function(EBMLId2) {
  EBMLId2[EBMLId2["EBML"] = 440786851] = "EBML";
  EBMLId2[EBMLId2["EBMLVersion"] = 17030] = "EBMLVersion";
  EBMLId2[EBMLId2["EBMLReadVersion"] = 17143] = "EBMLReadVersion";
  EBMLId2[EBMLId2["EBMLMaxIDLength"] = 17138] = "EBMLMaxIDLength";
  EBMLId2[EBMLId2["EBMLMaxSizeLength"] = 17139] = "EBMLMaxSizeLength";
  EBMLId2[EBMLId2["DocType"] = 17026] = "DocType";
  EBMLId2[EBMLId2["DocTypeVersion"] = 17031] = "DocTypeVersion";
  EBMLId2[EBMLId2["DocTypeReadVersion"] = 17029] = "DocTypeReadVersion";
  EBMLId2[EBMLId2["Void"] = 236] = "Void";
  EBMLId2[EBMLId2["Segment"] = 408125543] = "Segment";
  EBMLId2[EBMLId2["SeekHead"] = 290298740] = "SeekHead";
  EBMLId2[EBMLId2["Seek"] = 19899] = "Seek";
  EBMLId2[EBMLId2["SeekID"] = 21419] = "SeekID";
  EBMLId2[EBMLId2["SeekPosition"] = 21420] = "SeekPosition";
  EBMLId2[EBMLId2["Duration"] = 17545] = "Duration";
  EBMLId2[EBMLId2["Info"] = 357149030] = "Info";
  EBMLId2[EBMLId2["TimestampScale"] = 2807729] = "TimestampScale";
  EBMLId2[EBMLId2["MuxingApp"] = 19840] = "MuxingApp";
  EBMLId2[EBMLId2["WritingApp"] = 22337] = "WritingApp";
  EBMLId2[EBMLId2["Tracks"] = 374648427] = "Tracks";
  EBMLId2[EBMLId2["TrackEntry"] = 174] = "TrackEntry";
  EBMLId2[EBMLId2["TrackNumber"] = 215] = "TrackNumber";
  EBMLId2[EBMLId2["TrackUID"] = 29637] = "TrackUID";
  EBMLId2[EBMLId2["TrackType"] = 131] = "TrackType";
  EBMLId2[EBMLId2["FlagEnabled"] = 185] = "FlagEnabled";
  EBMLId2[EBMLId2["FlagDefault"] = 136] = "FlagDefault";
  EBMLId2[EBMLId2["FlagForced"] = 21930] = "FlagForced";
  EBMLId2[EBMLId2["FlagOriginal"] = 21934] = "FlagOriginal";
  EBMLId2[EBMLId2["FlagHearingImpaired"] = 21931] = "FlagHearingImpaired";
  EBMLId2[EBMLId2["FlagVisualImpaired"] = 21932] = "FlagVisualImpaired";
  EBMLId2[EBMLId2["FlagCommentary"] = 21935] = "FlagCommentary";
  EBMLId2[EBMLId2["FlagLacing"] = 156] = "FlagLacing";
  EBMLId2[EBMLId2["Name"] = 21358] = "Name";
  EBMLId2[EBMLId2["Language"] = 2274716] = "Language";
  EBMLId2[EBMLId2["LanguageBCP47"] = 2274717] = "LanguageBCP47";
  EBMLId2[EBMLId2["CodecID"] = 134] = "CodecID";
  EBMLId2[EBMLId2["CodecPrivate"] = 25506] = "CodecPrivate";
  EBMLId2[EBMLId2["CodecDelay"] = 22186] = "CodecDelay";
  EBMLId2[EBMLId2["SeekPreRoll"] = 22203] = "SeekPreRoll";
  EBMLId2[EBMLId2["DefaultDuration"] = 2352003] = "DefaultDuration";
  EBMLId2[EBMLId2["Video"] = 224] = "Video";
  EBMLId2[EBMLId2["PixelWidth"] = 176] = "PixelWidth";
  EBMLId2[EBMLId2["PixelHeight"] = 186] = "PixelHeight";
  EBMLId2[EBMLId2["DisplayWidth"] = 21680] = "DisplayWidth";
  EBMLId2[EBMLId2["DisplayHeight"] = 21690] = "DisplayHeight";
  EBMLId2[EBMLId2["DisplayUnit"] = 21682] = "DisplayUnit";
  EBMLId2[EBMLId2["AlphaMode"] = 21440] = "AlphaMode";
  EBMLId2[EBMLId2["Audio"] = 225] = "Audio";
  EBMLId2[EBMLId2["SamplingFrequency"] = 181] = "SamplingFrequency";
  EBMLId2[EBMLId2["Channels"] = 159] = "Channels";
  EBMLId2[EBMLId2["BitDepth"] = 25188] = "BitDepth";
  EBMLId2[EBMLId2["SimpleBlock"] = 163] = "SimpleBlock";
  EBMLId2[EBMLId2["BlockGroup"] = 160] = "BlockGroup";
  EBMLId2[EBMLId2["Block"] = 161] = "Block";
  EBMLId2[EBMLId2["BlockAdditions"] = 30113] = "BlockAdditions";
  EBMLId2[EBMLId2["BlockMore"] = 166] = "BlockMore";
  EBMLId2[EBMLId2["BlockAdditional"] = 165] = "BlockAdditional";
  EBMLId2[EBMLId2["BlockAddID"] = 238] = "BlockAddID";
  EBMLId2[EBMLId2["BlockDuration"] = 155] = "BlockDuration";
  EBMLId2[EBMLId2["ReferenceBlock"] = 251] = "ReferenceBlock";
  EBMLId2[EBMLId2["Cluster"] = 524531317] = "Cluster";
  EBMLId2[EBMLId2["Timestamp"] = 231] = "Timestamp";
  EBMLId2[EBMLId2["Cues"] = 475249515] = "Cues";
  EBMLId2[EBMLId2["CuePoint"] = 187] = "CuePoint";
  EBMLId2[EBMLId2["CueTime"] = 179] = "CueTime";
  EBMLId2[EBMLId2["CueTrackPositions"] = 183] = "CueTrackPositions";
  EBMLId2[EBMLId2["CueTrack"] = 247] = "CueTrack";
  EBMLId2[EBMLId2["CueClusterPosition"] = 241] = "CueClusterPosition";
  EBMLId2[EBMLId2["Colour"] = 21936] = "Colour";
  EBMLId2[EBMLId2["MatrixCoefficients"] = 21937] = "MatrixCoefficients";
  EBMLId2[EBMLId2["TransferCharacteristics"] = 21946] = "TransferCharacteristics";
  EBMLId2[EBMLId2["Primaries"] = 21947] = "Primaries";
  EBMLId2[EBMLId2["Range"] = 21945] = "Range";
  EBMLId2[EBMLId2["Projection"] = 30320] = "Projection";
  EBMLId2[EBMLId2["ProjectionType"] = 30321] = "ProjectionType";
  EBMLId2[EBMLId2["ProjectionPoseRoll"] = 30325] = "ProjectionPoseRoll";
  EBMLId2[EBMLId2["Attachments"] = 423732329] = "Attachments";
  EBMLId2[EBMLId2["AttachedFile"] = 24999] = "AttachedFile";
  EBMLId2[EBMLId2["FileDescription"] = 18046] = "FileDescription";
  EBMLId2[EBMLId2["FileName"] = 18030] = "FileName";
  EBMLId2[EBMLId2["FileMediaType"] = 18016] = "FileMediaType";
  EBMLId2[EBMLId2["FileData"] = 18012] = "FileData";
  EBMLId2[EBMLId2["FileUID"] = 18094] = "FileUID";
  EBMLId2[EBMLId2["Chapters"] = 272869232] = "Chapters";
  EBMLId2[EBMLId2["Tags"] = 307544935] = "Tags";
  EBMLId2[EBMLId2["Tag"] = 29555] = "Tag";
  EBMLId2[EBMLId2["Targets"] = 25536] = "Targets";
  EBMLId2[EBMLId2["TargetTypeValue"] = 26826] = "TargetTypeValue";
  EBMLId2[EBMLId2["TargetType"] = 25546] = "TargetType";
  EBMLId2[EBMLId2["TagTrackUID"] = 25541] = "TagTrackUID";
  EBMLId2[EBMLId2["TagEditionUID"] = 25545] = "TagEditionUID";
  EBMLId2[EBMLId2["TagChapterUID"] = 25540] = "TagChapterUID";
  EBMLId2[EBMLId2["TagAttachmentUID"] = 25542] = "TagAttachmentUID";
  EBMLId2[EBMLId2["SimpleTag"] = 26568] = "SimpleTag";
  EBMLId2[EBMLId2["TagName"] = 17827] = "TagName";
  EBMLId2[EBMLId2["TagLanguage"] = 17530] = "TagLanguage";
  EBMLId2[EBMLId2["TagString"] = 17543] = "TagString";
  EBMLId2[EBMLId2["TagBinary"] = 17541] = "TagBinary";
  EBMLId2[EBMLId2["ContentEncodings"] = 28032] = "ContentEncodings";
  EBMLId2[EBMLId2["ContentEncoding"] = 25152] = "ContentEncoding";
  EBMLId2[EBMLId2["ContentEncodingOrder"] = 20529] = "ContentEncodingOrder";
  EBMLId2[EBMLId2["ContentEncodingScope"] = 20530] = "ContentEncodingScope";
  EBMLId2[EBMLId2["ContentCompression"] = 20532] = "ContentCompression";
  EBMLId2[EBMLId2["ContentCompAlgo"] = 16980] = "ContentCompAlgo";
  EBMLId2[EBMLId2["ContentCompSettings"] = 16981] = "ContentCompSettings";
  EBMLId2[EBMLId2["ContentEncryption"] = 20533] = "ContentEncryption";
})(EBMLId || (EBMLId = {}));
var LEVEL_0_EBML_IDS = [
  EBMLId.EBML,
  EBMLId.Segment
];
var LEVEL_1_EBML_IDS = [
  EBMLId.SeekHead,
  EBMLId.Info,
  EBMLId.Cluster,
  EBMLId.Tracks,
  EBMLId.Cues,
  EBMLId.Attachments,
  EBMLId.Chapters,
  EBMLId.Tags
];
var LEVEL_0_AND_1_EBML_IDS = [
  ...LEVEL_0_EBML_IDS,
  ...LEVEL_1_EBML_IDS
];
var MAX_VAR_INT_SIZE = 8;
var MIN_HEADER_SIZE = 2;
var MAX_HEADER_SIZE = 2 * MAX_VAR_INT_SIZE;
var readVarIntSize = (slice) => {
  if (slice.remainingLength < 1) {
    return null;
  }
  const firstByte = readU8(slice);
  slice.skip(-1);
  if (firstByte === 0) {
    return null;
  }
  let width = 1;
  let mask = 128;
  while ((firstByte & mask) === 0) {
    width++;
    mask >>= 1;
  }
  if (slice.remainingLength < width) {
    return null;
  }
  return width;
};
var readVarInt = (slice) => {
  if (slice.remainingLength < 1) {
    return null;
  }
  const firstByte = readU8(slice);
  if (firstByte === 0) {
    return null;
  }
  let width = 1;
  let mask = 1 << 7;
  while ((firstByte & mask) === 0) {
    width++;
    mask >>= 1;
  }
  if (slice.remainingLength < width - 1) {
    return null;
  }
  let value = firstByte & mask - 1;
  for (let i = 1;i < width; i++) {
    value *= 1 << 8;
    value += readU8(slice);
  }
  return value;
};
var readUnsignedInt = (slice, width) => {
  if (width < 1 || width > 8) {
    throw new Error("Bad unsigned int size " + width);
  }
  let value = 0;
  for (let i = 0;i < width; i++) {
    value *= 1 << 8;
    value += readU8(slice);
  }
  return value;
};
var readUnsignedBigInt = (slice, width) => {
  if (width < 1) {
    throw new Error("Bad unsigned int size " + width);
  }
  let value = 0n;
  for (let i = 0;i < width; i++) {
    value <<= 8n;
    value += BigInt(readU8(slice));
  }
  return value;
};
var readElementId = (slice) => {
  const size = readVarIntSize(slice);
  if (size === null) {
    return null;
  }
  if (slice.remainingLength < size) {
    return null;
  }
  const id = readUnsignedInt(slice, size);
  return id;
};
var readElementSize = (slice) => {
  if (slice.remainingLength < 1) {
    return null;
  }
  const firstByte = readU8(slice);
  if (firstByte === 255) {
    return;
  }
  slice.skip(-1);
  const size = readVarInt(slice);
  if (size === null) {
    return null;
  }
  if (size === 72057594037927940) {
    return;
  }
  return size;
};
var readElementHeader = (slice) => {
  assert(slice.remainingLength >= MIN_HEADER_SIZE);
  const id = readElementId(slice);
  if (id === null) {
    return null;
  }
  const size = readElementSize(slice);
  if (size === null) {
    return null;
  }
  return { id, size };
};
var readAsciiString = (slice, length) => {
  const bytes = readBytes(slice, length);
  let strLength = 0;
  while (strLength < length && bytes[strLength] !== 0) {
    strLength += 1;
  }
  return String.fromCharCode(...bytes.subarray(0, strLength));
};
var readUnicodeString = (slice, length) => {
  const bytes = readBytes(slice, length);
  let strLength = 0;
  while (strLength < length && bytes[strLength] !== 0) {
    strLength += 1;
  }
  return textDecoder.decode(bytes.subarray(0, strLength));
};
var readFloat = (slice, width) => {
  if (width === 0) {
    return 0;
  }
  if (width !== 4 && width !== 8) {
    throw new Error("Bad float size " + width);
  }
  return width === 4 ? readF32Be(slice) : readF64Be(slice);
};
var searchForNextElementId = async (reader, startPos, ids, until) => {
  const idsSet = new Set(ids);
  let currentPos = startPos;
  while (until === null || currentPos < until) {
    let slice = reader.requestSliceRange(currentPos, MIN_HEADER_SIZE, MAX_HEADER_SIZE);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      break;
    const elementHeader = readElementHeader(slice);
    if (!elementHeader) {
      break;
    }
    if (idsSet.has(elementHeader.id)) {
      return { pos: currentPos, found: true };
    }
    assertDefinedSize(elementHeader.size);
    currentPos = slice.filePos + elementHeader.size;
  }
  return { pos: until !== null && until > currentPos ? until : currentPos, found: false };
};
var resync = async (reader, startPos, ids, until) => {
  const CHUNK_SIZE = 2 ** 16;
  const idsSet = new Set(ids);
  let currentPos = startPos;
  while (currentPos < until) {
    let slice = reader.requestSliceRange(currentPos, 0, Math.min(CHUNK_SIZE, until - currentPos));
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      break;
    if (slice.length < MAX_VAR_INT_SIZE)
      break;
    for (let i = 0;i < slice.length - MAX_VAR_INT_SIZE; i++) {
      slice.filePos = currentPos;
      const elementId = readElementId(slice);
      if (elementId !== null && idsSet.has(elementId)) {
        return currentPos;
      }
      currentPos++;
    }
  }
  return null;
};
var CODEC_STRING_MAP = {
  avc: "V_MPEG4/ISO/AVC",
  hevc: "V_MPEGH/ISO/HEVC",
  vp8: "V_VP8",
  vp9: "V_VP9",
  av1: "V_AV1",
  aac: "A_AAC",
  mp3: "A_MPEG/L3",
  opus: "A_OPUS",
  vorbis: "A_VORBIS",
  flac: "A_FLAC",
  ac3: "A_AC3",
  eac3: "A_EAC3",
  "pcm-u8": "A_PCM/INT/LIT",
  "pcm-s16": "A_PCM/INT/LIT",
  "pcm-s16be": "A_PCM/INT/BIG",
  "pcm-s24": "A_PCM/INT/LIT",
  "pcm-s24be": "A_PCM/INT/BIG",
  "pcm-s32": "A_PCM/INT/LIT",
  "pcm-s32be": "A_PCM/INT/BIG",
  "pcm-f32": "A_PCM/FLOAT/IEEE",
  "pcm-f64": "A_PCM/FLOAT/IEEE",
  webvtt: "S_TEXT/WEBVTT"
};
function assertDefinedSize(size) {
  if (size === undefined) {
    throw new Error("Undefined element size is used in a place where it is not supported.");
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/matroska/matroska-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var buildMatroskaMimeType = (info) => {
  const base = info.hasVideo ? "video/" : info.hasAudio ? "audio/" : "application/";
  let string = base + (info.isWebM ? "webm" : "x-matroska");
  if (info.codecStrings.length > 0) {
    const uniqueCodecMimeTypes = [...new Set(info.codecStrings.filter(Boolean))];
    string += `; codecs="${uniqueCodecMimeTypes.join(", ")}"`;
  }
  return string;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/matroska/matroska-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var BlockLacing;
(function(BlockLacing2) {
  BlockLacing2[BlockLacing2["None"] = 0] = "None";
  BlockLacing2[BlockLacing2["Xiph"] = 1] = "Xiph";
  BlockLacing2[BlockLacing2["FixedSize"] = 2] = "FixedSize";
  BlockLacing2[BlockLacing2["Ebml"] = 3] = "Ebml";
})(BlockLacing || (BlockLacing = {}));
var ContentEncodingScope;
(function(ContentEncodingScope2) {
  ContentEncodingScope2[ContentEncodingScope2["Block"] = 1] = "Block";
  ContentEncodingScope2[ContentEncodingScope2["Private"] = 2] = "Private";
  ContentEncodingScope2[ContentEncodingScope2["Next"] = 4] = "Next";
})(ContentEncodingScope || (ContentEncodingScope = {}));
var ContentCompAlgo;
(function(ContentCompAlgo2) {
  ContentCompAlgo2[ContentCompAlgo2["Zlib"] = 0] = "Zlib";
  ContentCompAlgo2[ContentCompAlgo2["Bzlib"] = 1] = "Bzlib";
  ContentCompAlgo2[ContentCompAlgo2["lzo1x"] = 2] = "lzo1x";
  ContentCompAlgo2[ContentCompAlgo2["HeaderStripping"] = 3] = "HeaderStripping";
})(ContentCompAlgo || (ContentCompAlgo = {}));
var METADATA_ELEMENTS = [
  { id: EBMLId.SeekHead, flag: "seekHeadSeen" },
  { id: EBMLId.Info, flag: "infoSeen" },
  { id: EBMLId.Tracks, flag: "tracksSeen" },
  { id: EBMLId.Cues, flag: "cuesSeen" }
];
var MAX_RESYNC_LENGTH = 10 * 2 ** 20;

class MatroskaDemuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.readMetadataPromise = null;
    this.segments = [];
    this.currentSegment = null;
    this.currentTrack = null;
    this.currentCluster = null;
    this.currentBlock = null;
    this.currentBlockAdditional = null;
    this.currentCueTime = null;
    this.currentDecodingInstruction = null;
    this.currentTagTargetIsMovie = true;
    this.currentSimpleTagName = null;
    this.currentAttachedFile = null;
    this.isWebM = false;
    this.reader = input._reader;
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.segments.flatMap((segment) => segment.tracks.map((track) => track.trackBacking));
  }
  async getMimeType() {
    await this.readMetadata();
    const backings = await this.getTrackBackings();
    const codecStrings = await Promise.all(backings.map((x) => x.getDecoderConfig().then((c) => c?.codec ?? null)));
    return buildMatroskaMimeType({
      isWebM: this.isWebM,
      hasVideo: this.segments.some((segment) => segment.tracks.some((x) => x.info?.type === "video")),
      hasAudio: this.segments.some((segment) => segment.tracks.some((x) => x.info?.type === "audio")),
      codecStrings: codecStrings.filter(Boolean)
    });
  }
  async getMetadataTags() {
    await this.readMetadata();
    for (const segment of this.segments) {
      if (!segment.metadataTagsCollected) {
        if (this.reader.fileSize !== null) {
          await this.loadSegmentMetadata(segment);
        } else {}
        segment.metadataTagsCollected = true;
      }
    }
    let metadataTags = {};
    for (const segment of this.segments) {
      metadataTags = { ...metadataTags, ...segment.metadataTags };
    }
    return metadataTags;
  }
  readMetadata() {
    return this.readMetadataPromise ??= (async () => {
      let currentPos = 0;
      while (true) {
        let slice = this.reader.requestSliceRange(currentPos, MIN_HEADER_SIZE, MAX_HEADER_SIZE);
        if (slice instanceof Promise)
          slice = await slice;
        if (!slice)
          break;
        const header = readElementHeader(slice);
        if (!header) {
          break;
        }
        const id = header.id;
        let size = header.size;
        const dataStartPos = slice.filePos;
        if (id === EBMLId.EBML) {
          assertDefinedSize(size);
          let slice2 = this.reader.requestSlice(dataStartPos, size);
          if (slice2 instanceof Promise)
            slice2 = await slice2;
          if (!slice2)
            break;
          this.readContiguousElements(slice2);
        } else if (id === EBMLId.Segment) {
          await this.readSegment(dataStartPos, size);
          if (size === undefined) {
            break;
          }
          if (this.reader.fileSize === null) {
            break;
          }
        } else if (id === EBMLId.Cluster) {
          if (this.reader.fileSize === null) {
            break;
          }
          if (size === undefined) {
            const nextElementPos = await searchForNextElementId(this.reader, dataStartPos, LEVEL_0_AND_1_EBML_IDS, this.reader.fileSize);
            size = nextElementPos.pos - dataStartPos;
          }
          const lastSegment = last(this.segments);
          if (lastSegment) {
            lastSegment.elementEndPos = dataStartPos + size;
          }
        }
        assertDefinedSize(size);
        currentPos = dataStartPos + size;
      }
    })();
  }
  async readSegment(segmentDataStart, dataSize) {
    this.currentSegment = {
      seekHeadSeen: false,
      infoSeen: false,
      tracksSeen: false,
      cuesSeen: false,
      tagsSeen: false,
      attachmentsSeen: false,
      timestampScale: -1,
      timestampFactor: -1,
      duration: -1,
      seekEntries: [],
      tracks: [],
      cuePoints: [],
      dataStartPos: segmentDataStart,
      elementEndPos: dataSize === undefined ? null : segmentDataStart + dataSize,
      clusterSeekStartPos: segmentDataStart,
      lastReadCluster: null,
      metadataTags: {},
      metadataTagsCollected: false
    };
    this.segments.push(this.currentSegment);
    let currentPos = segmentDataStart;
    while (this.currentSegment.elementEndPos === null || currentPos < this.currentSegment.elementEndPos) {
      let slice = this.reader.requestSliceRange(currentPos, MIN_HEADER_SIZE, MAX_HEADER_SIZE);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice)
        break;
      const elementStartPos = currentPos;
      const header = readElementHeader(slice);
      if (!header || !LEVEL_1_EBML_IDS.includes(header.id) && header.id !== EBMLId.Void) {
        const nextPos = await resync(this.reader, elementStartPos, LEVEL_1_EBML_IDS, Math.min(this.currentSegment.elementEndPos ?? Infinity, elementStartPos + MAX_RESYNC_LENGTH));
        if (nextPos) {
          currentPos = nextPos;
          continue;
        } else {
          break;
        }
      }
      const { id, size } = header;
      const dataStartPos = slice.filePos;
      const metadataElementIndex = METADATA_ELEMENTS.findIndex((x) => x.id === id);
      if (metadataElementIndex !== -1) {
        const field = METADATA_ELEMENTS[metadataElementIndex].flag;
        this.currentSegment[field] = true;
        assertDefinedSize(size);
        let slice2 = this.reader.requestSlice(dataStartPos, size);
        if (slice2 instanceof Promise)
          slice2 = await slice2;
        if (slice2) {
          this.readContiguousElements(slice2);
        }
      } else if (id === EBMLId.Tags || id === EBMLId.Attachments) {
        if (id === EBMLId.Tags) {
          this.currentSegment.tagsSeen = true;
        } else {
          this.currentSegment.attachmentsSeen = true;
        }
        assertDefinedSize(size);
        let slice2 = this.reader.requestSlice(dataStartPos, size);
        if (slice2 instanceof Promise)
          slice2 = await slice2;
        if (slice2) {
          this.readContiguousElements(slice2);
        }
      } else if (id === EBMLId.Cluster) {
        this.currentSegment.clusterSeekStartPos = elementStartPos;
        break;
      }
      if (size === undefined) {
        break;
      } else {
        currentPos = dataStartPos + size;
      }
    }
    this.currentSegment.seekEntries.sort((a, b) => a.segmentPosition - b.segmentPosition);
    if (this.reader.fileSize !== null) {
      for (const seekEntry of this.currentSegment.seekEntries) {
        const target = METADATA_ELEMENTS.find((x) => x.id === seekEntry.id);
        if (!target) {
          continue;
        }
        if (this.currentSegment[target.flag])
          continue;
        let slice = this.reader.requestSliceRange(segmentDataStart + seekEntry.segmentPosition, MIN_HEADER_SIZE, MAX_HEADER_SIZE);
        if (slice instanceof Promise)
          slice = await slice;
        if (!slice)
          continue;
        const header = readElementHeader(slice);
        if (!header)
          continue;
        const { id, size } = header;
        if (id !== target.id)
          continue;
        assertDefinedSize(size);
        this.currentSegment[target.flag] = true;
        let dataSlice = this.reader.requestSlice(slice.filePos, size);
        if (dataSlice instanceof Promise)
          dataSlice = await dataSlice;
        if (!dataSlice)
          continue;
        this.readContiguousElements(dataSlice);
      }
    }
    if (this.currentSegment.timestampScale === -1) {
      this.currentSegment.timestampScale = 1e6;
      this.currentSegment.timestampFactor = 1e9 / 1e6;
    }
    for (const track of this.currentSegment.tracks) {
      if (track.defaultDurationNs !== null) {
        track.defaultDuration = this.currentSegment.timestampFactor * track.defaultDurationNs / 1e9;
      }
    }
    const idToTrack = new Map(this.currentSegment.tracks.map((x) => [x.id, x]));
    for (const cuePoint of this.currentSegment.cuePoints) {
      const track = idToTrack.get(cuePoint.trackId);
      if (track) {
        track.cuePoints.push(cuePoint);
      }
    }
    for (const track of this.currentSegment.tracks) {
      track.cuePoints.sort((a, b) => a.time - b.time);
      for (let i = 0;i < track.cuePoints.length - 1; i++) {
        const cuePoint1 = track.cuePoints[i];
        const cuePoint2 = track.cuePoints[i + 1];
        if (cuePoint1.time === cuePoint2.time) {
          track.cuePoints.splice(i + 1, 1);
          i--;
        }
      }
    }
    let trackWithMostCuePoints = null;
    let maxCuePointCount = -Infinity;
    for (const track of this.currentSegment.tracks) {
      if (track.cuePoints.length > maxCuePointCount) {
        maxCuePointCount = track.cuePoints.length;
        trackWithMostCuePoints = track;
      }
    }
    for (const track of this.currentSegment.tracks) {
      if (track.cuePoints.length === 0) {
        track.cuePoints = trackWithMostCuePoints.cuePoints;
      }
    }
    this.currentSegment = null;
  }
  async readCluster(startPos, segment) {
    if (segment.lastReadCluster?.elementStartPos === startPos) {
      return segment.lastReadCluster;
    }
    let headerSlice = this.reader.requestSliceRange(startPos, MIN_HEADER_SIZE, MAX_HEADER_SIZE);
    if (headerSlice instanceof Promise)
      headerSlice = await headerSlice;
    assert(headerSlice);
    const elementStartPos = startPos;
    const elementHeader = readElementHeader(headerSlice);
    assert(elementHeader);
    const id = elementHeader.id;
    assert(id === EBMLId.Cluster);
    let size = elementHeader.size;
    const dataStartPos = headerSlice.filePos;
    if (size === undefined) {
      const nextElementPos = await searchForNextElementId(this.reader, dataStartPos, LEVEL_0_AND_1_EBML_IDS, segment.elementEndPos);
      size = nextElementPos.pos - dataStartPos;
    }
    let dataSlice = this.reader.requestSlice(dataStartPos, size);
    if (dataSlice instanceof Promise)
      dataSlice = await dataSlice;
    const cluster = {
      segment,
      elementStartPos,
      elementEndPos: dataStartPos + size,
      dataStartPos,
      timestamp: -1,
      trackData: new Map
    };
    this.currentCluster = cluster;
    if (dataSlice) {
      const endPos = this.readContiguousElements(dataSlice, LEVEL_0_AND_1_EBML_IDS);
      cluster.elementEndPos = endPos;
    }
    for (const [, trackData] of cluster.trackData) {
      const track = trackData.track;
      assert(trackData.blocks.length > 0);
      let hasLacedBlocks = false;
      for (let i = 0;i < trackData.blocks.length; i++) {
        const block = trackData.blocks[i];
        block.timestamp += cluster.timestamp;
        hasLacedBlocks ||= block.lacing !== BlockLacing.None;
      }
      trackData.presentationTimestamps = trackData.blocks.map((block, i) => ({ timestamp: block.timestamp, blockIndex: i })).sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 0;i < trackData.presentationTimestamps.length; i++) {
        const currentEntry = trackData.presentationTimestamps[i];
        const currentBlock = trackData.blocks[currentEntry.blockIndex];
        if (trackData.firstKeyFrameTimestamp === null && currentBlock.isKeyFrame) {
          trackData.firstKeyFrameTimestamp = currentBlock.timestamp;
        }
        if (i < trackData.presentationTimestamps.length - 1) {
          const nextEntry = trackData.presentationTimestamps[i + 1];
          currentBlock.duration = nextEntry.timestamp - currentBlock.timestamp;
        } else if (currentBlock.duration === 0) {
          if (track.defaultDuration != null) {
            if (currentBlock.lacing === BlockLacing.None) {
              currentBlock.duration = track.defaultDuration;
            } else {}
          }
        }
      }
      if (hasLacedBlocks) {
        this.expandLacedBlocks(trackData.blocks, track);
        trackData.presentationTimestamps = trackData.blocks.map((block, i) => ({ timestamp: block.timestamp, blockIndex: i })).sort((a, b) => a.timestamp - b.timestamp);
      }
      const firstBlock = trackData.blocks[trackData.presentationTimestamps[0].blockIndex];
      const lastBlock = trackData.blocks[last(trackData.presentationTimestamps).blockIndex];
      trackData.startTimestamp = firstBlock.timestamp;
      trackData.endTimestamp = lastBlock.timestamp + lastBlock.duration;
      const insertionIndex = binarySearchLessOrEqual(track.clusterPositionCache, trackData.startTimestamp, (x) => x.startTimestamp);
      if (insertionIndex === -1 || track.clusterPositionCache[insertionIndex].elementStartPos !== elementStartPos) {
        track.clusterPositionCache.splice(insertionIndex + 1, 0, {
          elementStartPos: cluster.elementStartPos,
          startTimestamp: trackData.startTimestamp
        });
      }
    }
    segment.lastReadCluster = cluster;
    return cluster;
  }
  getTrackDataInCluster(cluster, trackNumber) {
    let trackData = cluster.trackData.get(trackNumber);
    if (!trackData) {
      const track = cluster.segment.tracks.find((x) => x.id === trackNumber);
      if (!track) {
        return null;
      }
      trackData = {
        track,
        startTimestamp: 0,
        endTimestamp: 0,
        firstKeyFrameTimestamp: null,
        blocks: [],
        presentationTimestamps: []
      };
      cluster.trackData.set(trackNumber, trackData);
    }
    return trackData;
  }
  expandLacedBlocks(blocks, track) {
    for (let blockIndex = 0;blockIndex < blocks.length; blockIndex++) {
      const originalBlock = blocks[blockIndex];
      if (originalBlock.lacing === BlockLacing.None) {
        continue;
      }
      if (!originalBlock.decoded) {
        originalBlock.data = this.decodeBlockData(track, originalBlock.data);
        originalBlock.decoded = true;
      }
      const slice = FileSlice.tempFromBytes(originalBlock.data);
      const frameSizes = [];
      const frameCount = readU8(slice) + 1;
      switch (originalBlock.lacing) {
        case BlockLacing.Xiph:
          {
            let totalUsedSize = 0;
            for (let i = 0;i < frameCount - 1; i++) {
              let frameSize = 0;
              while (slice.bufferPos < slice.length) {
                const value = readU8(slice);
                frameSize += value;
                if (value < 255) {
                  frameSizes.push(frameSize);
                  totalUsedSize += frameSize;
                  break;
                }
              }
            }
            frameSizes.push(slice.length - (slice.bufferPos + totalUsedSize));
          }
          ;
          break;
        case BlockLacing.FixedSize:
          {
            const totalDataSize = slice.length - 1;
            const frameSize = Math.floor(totalDataSize / frameCount);
            for (let i = 0;i < frameCount; i++) {
              frameSizes.push(frameSize);
            }
          }
          ;
          break;
        case BlockLacing.Ebml:
          {
            const firstResult = readVarInt(slice);
            assert(firstResult !== null);
            let currentSize = firstResult;
            frameSizes.push(currentSize);
            let totalUsedSize = currentSize;
            for (let i = 1;i < frameCount - 1; i++) {
              const startPos = slice.bufferPos;
              const diffResult = readVarInt(slice);
              assert(diffResult !== null);
              const unsignedDiff = diffResult;
              const width = slice.bufferPos - startPos;
              const bias = (1 << width * 7 - 1) - 1;
              const diff = unsignedDiff - bias;
              currentSize += diff;
              frameSizes.push(currentSize);
              totalUsedSize += currentSize;
            }
            frameSizes.push(slice.length - (slice.bufferPos + totalUsedSize));
          }
          ;
          break;
        default:
          assert(false);
      }
      assert(frameSizes.length === frameCount);
      blocks.splice(blockIndex, 1);
      const blockDuration = originalBlock.duration || frameCount * (track.defaultDuration ?? 0);
      for (let i = 0;i < frameCount; i++) {
        const frameSize = frameSizes[i];
        const frameData = readBytes(slice, frameSize);
        const frameTimestamp = originalBlock.timestamp + blockDuration * i / frameCount;
        const frameDuration = blockDuration / frameCount;
        blocks.splice(blockIndex + i, 0, {
          timestamp: frameTimestamp,
          duration: frameDuration,
          isKeyFrame: originalBlock.isKeyFrame,
          data: frameData,
          lacing: BlockLacing.None,
          decoded: true,
          mainAdditional: originalBlock.mainAdditional
        });
      }
      blockIndex += frameCount;
      blockIndex--;
    }
  }
  async loadSegmentMetadata(segment) {
    for (const seekEntry of segment.seekEntries) {
      if (seekEntry.id === EBMLId.Tags && !segment.tagsSeen) {} else if (seekEntry.id === EBMLId.Attachments && !segment.attachmentsSeen) {} else {
        continue;
      }
      let slice = this.reader.requestSliceRange(segment.dataStartPos + seekEntry.segmentPosition, MIN_HEADER_SIZE, MAX_HEADER_SIZE);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice)
        continue;
      const header = readElementHeader(slice);
      if (!header || header.id !== seekEntry.id)
        continue;
      const { size } = header;
      assertDefinedSize(size);
      assert(!this.currentSegment);
      this.currentSegment = segment;
      let dataSlice = this.reader.requestSlice(slice.filePos, size);
      if (dataSlice instanceof Promise)
        dataSlice = await dataSlice;
      if (dataSlice) {
        this.readContiguousElements(dataSlice);
      }
      this.currentSegment = null;
      if (seekEntry.id === EBMLId.Tags) {
        segment.tagsSeen = true;
      } else if (seekEntry.id === EBMLId.Attachments) {
        segment.attachmentsSeen = true;
      }
    }
  }
  readContiguousElements(slice, stopIds) {
    while (slice.remainingLength >= MIN_HEADER_SIZE) {
      const startPos = slice.filePos;
      const foundElement = this.traverseElement(slice, stopIds);
      if (!foundElement) {
        return startPos;
      }
    }
    return slice.filePos;
  }
  traverseElement(slice, stopIds) {
    const header = readElementHeader(slice);
    if (!header) {
      return false;
    }
    if (stopIds && stopIds.includes(header.id)) {
      return false;
    }
    const { id, size } = header;
    const dataStartPos = slice.filePos;
    assertDefinedSize(size);
    switch (id) {
      case EBMLId.DocType:
        {
          this.isWebM = readAsciiString(slice, size) === "webm";
        }
        ;
        break;
      case EBMLId.Seek:
        {
          if (!this.currentSegment)
            break;
          const seekEntry = { id: -1, segmentPosition: -1 };
          this.currentSegment.seekEntries.push(seekEntry);
          this.readContiguousElements(slice.slice(dataStartPos, size));
          if (seekEntry.id === -1 || seekEntry.segmentPosition === -1) {
            this.currentSegment.seekEntries.pop();
          }
        }
        ;
        break;
      case EBMLId.SeekID:
        {
          const lastSeekEntry = this.currentSegment?.seekEntries[this.currentSegment.seekEntries.length - 1];
          if (!lastSeekEntry)
            break;
          lastSeekEntry.id = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.SeekPosition:
        {
          const lastSeekEntry = this.currentSegment?.seekEntries[this.currentSegment.seekEntries.length - 1];
          if (!lastSeekEntry)
            break;
          lastSeekEntry.segmentPosition = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.TimestampScale:
        {
          if (!this.currentSegment)
            break;
          this.currentSegment.timestampScale = readUnsignedInt(slice, size);
          this.currentSegment.timestampFactor = 1e9 / this.currentSegment.timestampScale;
        }
        ;
        break;
      case EBMLId.Duration:
        {
          if (!this.currentSegment)
            break;
          this.currentSegment.duration = readFloat(slice, size);
        }
        ;
        break;
      case EBMLId.TrackEntry:
        {
          if (!this.currentSegment)
            break;
          this.currentTrack = {
            id: -1,
            segment: this.currentSegment,
            demuxer: this,
            clusterPositionCache: [],
            cuePoints: [],
            disposition: {
              ...DEFAULT_TRACK_DISPOSITION,
              primary: false
            },
            trackBacking: null,
            codecId: null,
            codecPrivate: null,
            defaultDuration: null,
            defaultDurationNs: null,
            name: null,
            languageCode: "eng",
            hasLanguageBcp47: false,
            decodingInstructions: [],
            info: null
          };
          this.readContiguousElements(slice.slice(dataStartPos, size));
          if (!this.currentTrack) {
            break;
          }
          if (this.currentTrack.decodingInstructions.some((instruction) => {
            return instruction.data?.type !== "decompress" || instruction.scope !== ContentEncodingScope.Block || instruction.data.algorithm !== ContentCompAlgo.HeaderStripping;
          })) {
            console.warn(`Track #${this.currentTrack.id} has an unsupported content encoding; dropping.`);
            this.currentTrack = null;
          }
          if (this.currentTrack && this.currentTrack.id !== -1 && this.currentTrack.codecId && this.currentTrack.info) {
            const slashIndex = this.currentTrack.codecId.indexOf("/");
            const codecIdWithoutSuffix = slashIndex === -1 ? this.currentTrack.codecId : this.currentTrack.codecId.slice(0, slashIndex);
            if (this.currentTrack.info.type === "video" && this.currentTrack.info.width !== -1 && this.currentTrack.info.height !== -1) {
              this.currentTrack.info.squarePixelWidth = this.currentTrack.info.width;
              this.currentTrack.info.squarePixelHeight = this.currentTrack.info.height;
              if (this.currentTrack.info.displayWidth !== null && this.currentTrack.info.displayHeight !== null) {
                const num = this.currentTrack.info.displayWidth * this.currentTrack.info.height;
                const den = this.currentTrack.info.displayHeight * this.currentTrack.info.width;
                if (num > 0 && den > 0) {
                  if (num > den) {
                    this.currentTrack.info.squarePixelWidth = Math.round(this.currentTrack.info.width * num / den);
                  } else {
                    this.currentTrack.info.squarePixelHeight = Math.round(this.currentTrack.info.height * den / num);
                  }
                }
              }
              if (this.currentTrack.codecId === CODEC_STRING_MAP.avc) {
                this.currentTrack.info.codec = "avc";
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (this.currentTrack.codecId === CODEC_STRING_MAP.hevc) {
                this.currentTrack.info.codec = "hevc";
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (codecIdWithoutSuffix === CODEC_STRING_MAP.vp8) {
                this.currentTrack.info.codec = "vp8";
              } else if (codecIdWithoutSuffix === CODEC_STRING_MAP.vp9) {
                this.currentTrack.info.codec = "vp9";
              } else if (codecIdWithoutSuffix === CODEC_STRING_MAP.av1) {
                this.currentTrack.info.codec = "av1";
              }
              const videoTrack = this.currentTrack;
              this.currentTrack.trackBacking = new MatroskaVideoTrackBacking(videoTrack);
              this.currentSegment.tracks.push(this.currentTrack);
            } else if (this.currentTrack.info.type === "audio") {
              if (codecIdWithoutSuffix === CODEC_STRING_MAP.aac) {
                this.currentTrack.info.codec = "aac";
                this.currentTrack.info.aacCodecInfo = {
                  isMpeg2: this.currentTrack.codecId.includes("MPEG2"),
                  objectType: null
                };
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (this.currentTrack.codecId === CODEC_STRING_MAP.mp3) {
                this.currentTrack.info.codec = "mp3";
              } else if (codecIdWithoutSuffix === CODEC_STRING_MAP.opus) {
                this.currentTrack.info.codec = "opus";
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
                this.currentTrack.info.sampleRate = OPUS_SAMPLE_RATE;
              } else if (codecIdWithoutSuffix === CODEC_STRING_MAP.vorbis) {
                this.currentTrack.info.codec = "vorbis";
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (codecIdWithoutSuffix === CODEC_STRING_MAP.flac) {
                this.currentTrack.info.codec = "flac";
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (codecIdWithoutSuffix === CODEC_STRING_MAP.ac3) {
                this.currentTrack.info.codec = "ac3";
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (codecIdWithoutSuffix === CODEC_STRING_MAP.eac3) {
                this.currentTrack.info.codec = "eac3";
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (this.currentTrack.codecId === "A_PCM/INT/LIT") {
                if (this.currentTrack.info.bitDepth === 8) {
                  this.currentTrack.info.codec = "pcm-u8";
                } else if (this.currentTrack.info.bitDepth === 16) {
                  this.currentTrack.info.codec = "pcm-s16";
                } else if (this.currentTrack.info.bitDepth === 24) {
                  this.currentTrack.info.codec = "pcm-s24";
                } else if (this.currentTrack.info.bitDepth === 32) {
                  this.currentTrack.info.codec = "pcm-s32";
                }
              } else if (this.currentTrack.codecId === "A_PCM/INT/BIG") {
                if (this.currentTrack.info.bitDepth === 8) {
                  this.currentTrack.info.codec = "pcm-u8";
                } else if (this.currentTrack.info.bitDepth === 16) {
                  this.currentTrack.info.codec = "pcm-s16be";
                } else if (this.currentTrack.info.bitDepth === 24) {
                  this.currentTrack.info.codec = "pcm-s24be";
                } else if (this.currentTrack.info.bitDepth === 32) {
                  this.currentTrack.info.codec = "pcm-s32be";
                }
              } else if (this.currentTrack.codecId === "A_PCM/FLOAT/IEEE") {
                if (this.currentTrack.info.bitDepth === 32) {
                  this.currentTrack.info.codec = "pcm-f32";
                } else if (this.currentTrack.info.bitDepth === 64) {
                  this.currentTrack.info.codec = "pcm-f64";
                }
              }
              const audioTrack = this.currentTrack;
              this.currentTrack.trackBacking = new MatroskaAudioTrackBacking(audioTrack);
              this.currentSegment.tracks.push(this.currentTrack);
            }
          }
          this.currentTrack = null;
        }
        ;
        break;
      case EBMLId.TrackNumber:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.id = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.TrackType:
        {
          if (!this.currentTrack)
            break;
          const type = readUnsignedInt(slice, size);
          if (type === 1) {
            this.currentTrack.info = {
              type: "video",
              width: -1,
              height: -1,
              displayWidth: null,
              displayHeight: null,
              displayUnit: null,
              squarePixelWidth: -1,
              squarePixelHeight: -1,
              rotation: 0,
              codec: null,
              codecDescription: null,
              colorSpace: null,
              alphaMode: false
            };
          } else if (type === 2) {
            this.currentTrack.info = {
              type: "audio",
              numberOfChannels: 1,
              sampleRate: 8000,
              bitDepth: -1,
              codec: null,
              codecDescription: null,
              aacCodecInfo: null
            };
          }
        }
        ;
        break;
      case EBMLId.FlagEnabled:
        {
          if (!this.currentTrack)
            break;
          const enabled = readUnsignedInt(slice, size);
          if (!enabled) {
            this.currentTrack = null;
          }
        }
        ;
        break;
      case EBMLId.FlagDefault:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.disposition.default = !!readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.FlagForced:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.disposition.forced = !!readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.FlagOriginal:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.disposition.original = !!readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.FlagHearingImpaired:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.disposition.hearingImpaired = !!readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.FlagVisualImpaired:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.disposition.visuallyImpaired = !!readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.FlagCommentary:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.disposition.commentary = !!readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.CodecID:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.codecId = readAsciiString(slice, size);
        }
        ;
        break;
      case EBMLId.CodecPrivate:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.codecPrivate = readBytes(slice, size);
        }
        ;
        break;
      case EBMLId.DefaultDuration:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.defaultDurationNs = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.Name:
        {
          if (!this.currentTrack)
            break;
          this.currentTrack.name = readUnicodeString(slice, size);
        }
        ;
        break;
      case EBMLId.Language:
        {
          if (!this.currentTrack)
            break;
          if (this.currentTrack.hasLanguageBcp47) {
            break;
          }
          this.currentTrack.languageCode = readAsciiString(slice, size);
          if (!isIso639Dash2LanguageCode(this.currentTrack.languageCode)) {
            this.currentTrack.languageCode = UNDETERMINED_LANGUAGE;
          }
        }
        ;
        break;
      case EBMLId.LanguageBCP47:
        {
          if (!this.currentTrack)
            break;
          const bcp47 = readAsciiString(slice, size);
          const languageSubtag = bcp47.split("-")[0];
          if (languageSubtag) {
            this.currentTrack.languageCode = languageSubtag;
          } else {
            this.currentTrack.languageCode = UNDETERMINED_LANGUAGE;
          }
          this.currentTrack.hasLanguageBcp47 = true;
        }
        ;
        break;
      case EBMLId.Video:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.PixelWidth:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.currentTrack.info.width = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.PixelHeight:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.currentTrack.info.height = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.DisplayWidth:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.currentTrack.info.displayWidth = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.DisplayHeight:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.currentTrack.info.displayHeight = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.DisplayUnit:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.currentTrack.info.displayUnit = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.AlphaMode:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.currentTrack.info.alphaMode = readUnsignedInt(slice, size) === 1;
        }
        ;
        break;
      case EBMLId.Colour:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.currentTrack.info.colorSpace = {};
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.MatrixCoefficients:
        {
          if (this.currentTrack?.info?.type !== "video" || !this.currentTrack.info.colorSpace)
            break;
          const matrixCoefficients = readUnsignedInt(slice, size);
          const mapped = MATRIX_COEFFICIENTS_MAP_INVERSE[matrixCoefficients] ?? null;
          this.currentTrack.info.colorSpace.matrix = mapped;
        }
        ;
        break;
      case EBMLId.Range:
        {
          if (this.currentTrack?.info?.type !== "video" || !this.currentTrack.info.colorSpace)
            break;
          this.currentTrack.info.colorSpace.fullRange = readUnsignedInt(slice, size) === 2;
        }
        ;
        break;
      case EBMLId.TransferCharacteristics:
        {
          if (this.currentTrack?.info?.type !== "video" || !this.currentTrack.info.colorSpace)
            break;
          const transferCharacteristics = readUnsignedInt(slice, size);
          const mapped = TRANSFER_CHARACTERISTICS_MAP_INVERSE[transferCharacteristics] ?? null;
          this.currentTrack.info.colorSpace.transfer = mapped;
        }
        ;
        break;
      case EBMLId.Primaries:
        {
          if (this.currentTrack?.info?.type !== "video" || !this.currentTrack.info.colorSpace)
            break;
          const primaries = readUnsignedInt(slice, size);
          const mapped = COLOR_PRIMARIES_MAP_INVERSE[primaries] ?? null;
          this.currentTrack.info.colorSpace.primaries = mapped;
        }
        ;
        break;
      case EBMLId.Projection:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.ProjectionPoseRoll:
        {
          if (this.currentTrack?.info?.type !== "video")
            break;
          const rotation = readFloat(slice, size);
          const flippedRotation = -rotation;
          try {
            this.currentTrack.info.rotation = normalizeRotation(flippedRotation);
          } catch {}
        }
        ;
        break;
      case EBMLId.Audio:
        {
          if (this.currentTrack?.info?.type !== "audio")
            break;
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.SamplingFrequency:
        {
          if (this.currentTrack?.info?.type !== "audio")
            break;
          this.currentTrack.info.sampleRate = readFloat(slice, size);
        }
        ;
        break;
      case EBMLId.Channels:
        {
          if (this.currentTrack?.info?.type !== "audio")
            break;
          this.currentTrack.info.numberOfChannels = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.BitDepth:
        {
          if (this.currentTrack?.info?.type !== "audio")
            break;
          this.currentTrack.info.bitDepth = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.CuePoint:
        {
          if (!this.currentSegment)
            break;
          this.readContiguousElements(slice.slice(dataStartPos, size));
          this.currentCueTime = null;
        }
        ;
        break;
      case EBMLId.CueTime:
        {
          this.currentCueTime = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.CueTrackPositions:
        {
          if (this.currentCueTime === null)
            break;
          assert(this.currentSegment);
          const cuePoint = { time: this.currentCueTime, trackId: -1, clusterPosition: -1 };
          this.currentSegment.cuePoints.push(cuePoint);
          this.readContiguousElements(slice.slice(dataStartPos, size));
          if (cuePoint.trackId === -1 || cuePoint.clusterPosition === -1) {
            this.currentSegment.cuePoints.pop();
          }
        }
        ;
        break;
      case EBMLId.CueTrack:
        {
          const lastCuePoint = this.currentSegment?.cuePoints[this.currentSegment.cuePoints.length - 1];
          if (!lastCuePoint)
            break;
          lastCuePoint.trackId = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.CueClusterPosition:
        {
          const lastCuePoint = this.currentSegment?.cuePoints[this.currentSegment.cuePoints.length - 1];
          if (!lastCuePoint)
            break;
          assert(this.currentSegment);
          lastCuePoint.clusterPosition = this.currentSegment.dataStartPos + readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.Timestamp:
        {
          if (!this.currentCluster)
            break;
          this.currentCluster.timestamp = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.SimpleBlock:
        {
          if (!this.currentCluster)
            break;
          const trackNumber = readVarInt(slice);
          if (trackNumber === null)
            break;
          const trackData = this.getTrackDataInCluster(this.currentCluster, trackNumber);
          if (!trackData)
            break;
          const relativeTimestamp = readI16Be(slice);
          const flags = readU8(slice);
          const lacing = flags >> 1 & 3;
          let isKeyFrame = !!(flags & 128);
          if (trackData.track.info?.type === "audio" && trackData.track.info.codec) {
            isKeyFrame = true;
          }
          const blockData = readBytes(slice, size - (slice.filePos - dataStartPos));
          const hasDecodingInstructions = trackData.track.decodingInstructions.length > 0;
          trackData.blocks.push({
            timestamp: relativeTimestamp,
            duration: 0,
            isKeyFrame,
            data: blockData,
            lacing,
            decoded: !hasDecodingInstructions,
            mainAdditional: null
          });
        }
        ;
        break;
      case EBMLId.BlockGroup:
        {
          if (!this.currentCluster)
            break;
          this.readContiguousElements(slice.slice(dataStartPos, size));
          this.currentBlock = null;
        }
        ;
        break;
      case EBMLId.Block:
        {
          if (!this.currentCluster)
            break;
          const trackNumber = readVarInt(slice);
          if (trackNumber === null)
            break;
          const trackData = this.getTrackDataInCluster(this.currentCluster, trackNumber);
          if (!trackData)
            break;
          const relativeTimestamp = readI16Be(slice);
          const flags = readU8(slice);
          const lacing = flags >> 1 & 3;
          const blockData = readBytes(slice, size - (slice.filePos - dataStartPos));
          const hasDecodingInstructions = trackData.track.decodingInstructions.length > 0;
          this.currentBlock = {
            timestamp: relativeTimestamp,
            duration: 0,
            isKeyFrame: true,
            data: blockData,
            lacing,
            decoded: !hasDecodingInstructions,
            mainAdditional: null
          };
          trackData.blocks.push(this.currentBlock);
        }
        ;
        break;
      case EBMLId.BlockAdditions:
        {
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.BlockMore:
        {
          if (!this.currentBlock)
            break;
          this.currentBlockAdditional = {
            addId: 1,
            data: null
          };
          this.readContiguousElements(slice.slice(dataStartPos, size));
          if (this.currentBlockAdditional.data && this.currentBlockAdditional.addId === 1) {
            this.currentBlock.mainAdditional = this.currentBlockAdditional.data;
          }
          this.currentBlockAdditional = null;
        }
        ;
        break;
      case EBMLId.BlockAdditional:
        {
          if (!this.currentBlockAdditional)
            break;
          this.currentBlockAdditional.data = readBytes(slice, size);
        }
        ;
        break;
      case EBMLId.BlockAddID:
        {
          if (!this.currentBlockAdditional)
            break;
          this.currentBlockAdditional.addId = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.BlockDuration:
        {
          if (!this.currentBlock)
            break;
          this.currentBlock.duration = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.ReferenceBlock:
        {
          if (!this.currentBlock)
            break;
          this.currentBlock.isKeyFrame = false;
        }
        ;
        break;
      case EBMLId.Tag:
        {
          this.currentTagTargetIsMovie = true;
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.Targets:
        {
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.TargetTypeValue:
        {
          const targetTypeValue = readUnsignedInt(slice, size);
          if (targetTypeValue !== 50) {
            this.currentTagTargetIsMovie = false;
          }
        }
        ;
        break;
      case EBMLId.TagTrackUID:
      case EBMLId.TagEditionUID:
      case EBMLId.TagChapterUID:
      case EBMLId.TagAttachmentUID:
        {
          this.currentTagTargetIsMovie = false;
        }
        ;
        break;
      case EBMLId.SimpleTag:
        {
          if (!this.currentTagTargetIsMovie)
            break;
          this.currentSimpleTagName = null;
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.TagName:
        {
          this.currentSimpleTagName = readUnicodeString(slice, size);
        }
        ;
        break;
      case EBMLId.TagString:
        {
          if (!this.currentSimpleTagName)
            break;
          const value = readUnicodeString(slice, size);
          this.processTagValue(this.currentSimpleTagName, value);
        }
        ;
        break;
      case EBMLId.TagBinary:
        {
          if (!this.currentSimpleTagName)
            break;
          const value = readBytes(slice, size);
          this.processTagValue(this.currentSimpleTagName, value);
        }
        ;
        break;
      case EBMLId.AttachedFile:
        {
          if (!this.currentSegment)
            break;
          this.currentAttachedFile = {
            fileUid: null,
            fileName: null,
            fileMediaType: null,
            fileData: null,
            fileDescription: null
          };
          this.readContiguousElements(slice.slice(dataStartPos, size));
          const tags = this.currentSegment.metadataTags;
          if (this.currentAttachedFile.fileUid && this.currentAttachedFile.fileData) {
            tags.raw ??= {};
            tags.raw[this.currentAttachedFile.fileUid.toString()] = new AttachedFile(this.currentAttachedFile.fileData, this.currentAttachedFile.fileMediaType ?? undefined, this.currentAttachedFile.fileName ?? undefined, this.currentAttachedFile.fileDescription ?? undefined);
          }
          if (this.currentAttachedFile.fileMediaType?.startsWith("image/") && this.currentAttachedFile.fileData) {
            const fileName = this.currentAttachedFile.fileName;
            let kind = "unknown";
            if (fileName) {
              const lowerName = fileName.toLowerCase();
              if (lowerName.startsWith("cover.")) {
                kind = "coverFront";
              } else if (lowerName.startsWith("back.")) {
                kind = "coverBack";
              }
            }
            tags.images ??= [];
            tags.images.push({
              data: this.currentAttachedFile.fileData,
              mimeType: this.currentAttachedFile.fileMediaType,
              kind,
              name: this.currentAttachedFile.fileName ?? undefined,
              description: this.currentAttachedFile.fileDescription ?? undefined
            });
          }
          this.currentAttachedFile = null;
        }
        ;
        break;
      case EBMLId.FileUID:
        {
          if (!this.currentAttachedFile)
            break;
          this.currentAttachedFile.fileUid = readUnsignedBigInt(slice, size);
        }
        ;
        break;
      case EBMLId.FileName:
        {
          if (!this.currentAttachedFile)
            break;
          this.currentAttachedFile.fileName = readUnicodeString(slice, size);
        }
        ;
        break;
      case EBMLId.FileMediaType:
        {
          if (!this.currentAttachedFile)
            break;
          this.currentAttachedFile.fileMediaType = readAsciiString(slice, size);
        }
        ;
        break;
      case EBMLId.FileData:
        {
          if (!this.currentAttachedFile)
            break;
          this.currentAttachedFile.fileData = readBytes(slice, size);
        }
        ;
        break;
      case EBMLId.FileDescription:
        {
          if (!this.currentAttachedFile)
            break;
          this.currentAttachedFile.fileDescription = readUnicodeString(slice, size);
        }
        ;
        break;
      case EBMLId.ContentEncodings:
        {
          if (!this.currentTrack)
            break;
          this.readContiguousElements(slice.slice(dataStartPos, size));
          this.currentTrack.decodingInstructions.sort((a, b) => b.order - a.order);
        }
        ;
        break;
      case EBMLId.ContentEncoding:
        {
          this.currentDecodingInstruction = {
            order: 0,
            scope: ContentEncodingScope.Block,
            data: null
          };
          this.readContiguousElements(slice.slice(dataStartPos, size));
          if (this.currentDecodingInstruction.data) {
            this.currentTrack.decodingInstructions.push(this.currentDecodingInstruction);
          }
          this.currentDecodingInstruction = null;
        }
        ;
        break;
      case EBMLId.ContentEncodingOrder:
        {
          if (!this.currentDecodingInstruction)
            break;
          this.currentDecodingInstruction.order = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.ContentEncodingScope:
        {
          if (!this.currentDecodingInstruction)
            break;
          this.currentDecodingInstruction.scope = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.ContentCompression:
        {
          if (!this.currentDecodingInstruction)
            break;
          this.currentDecodingInstruction.data = {
            type: "decompress",
            algorithm: ContentCompAlgo.Zlib,
            settings: null
          };
          this.readContiguousElements(slice.slice(dataStartPos, size));
        }
        ;
        break;
      case EBMLId.ContentCompAlgo:
        {
          if (this.currentDecodingInstruction?.data?.type !== "decompress")
            break;
          this.currentDecodingInstruction.data.algorithm = readUnsignedInt(slice, size);
        }
        ;
        break;
      case EBMLId.ContentCompSettings:
        {
          if (this.currentDecodingInstruction?.data?.type !== "decompress")
            break;
          this.currentDecodingInstruction.data.settings = readBytes(slice, size);
        }
        ;
        break;
      case EBMLId.ContentEncryption:
        {
          if (!this.currentDecodingInstruction)
            break;
          this.currentDecodingInstruction.data = {
            type: "decrypt"
          };
        }
        ;
        break;
    }
    slice.filePos = dataStartPos + size;
    return true;
  }
  decodeBlockData(track, rawData) {
    assert(track.decodingInstructions.length > 0);
    let currentData = rawData;
    for (const instruction of track.decodingInstructions) {
      assert(instruction.data);
      switch (instruction.data.type) {
        case "decompress":
          {
            switch (instruction.data.algorithm) {
              case ContentCompAlgo.HeaderStripping:
                {
                  if (instruction.data.settings && instruction.data.settings.length > 0) {
                    const prefix = instruction.data.settings;
                    const newData = new Uint8Array(prefix.length + currentData.length);
                    newData.set(prefix, 0);
                    newData.set(currentData, prefix.length);
                    currentData = newData;
                  }
                }
                ;
                break;
              default:
                {}
                ;
            }
          }
          ;
          break;
        default:
          {}
          ;
      }
    }
    return currentData;
  }
  processTagValue(name, value) {
    if (!this.currentSegment?.metadataTags)
      return;
    const metadataTags = this.currentSegment.metadataTags;
    metadataTags.raw ??= {};
    metadataTags.raw[name] ??= value;
    if (typeof value === "string") {
      switch (name.toLowerCase()) {
        case "title":
          {
            metadataTags.title ??= value;
          }
          ;
          break;
        case "description":
          {
            metadataTags.description ??= value;
          }
          ;
          break;
        case "artist":
          {
            metadataTags.artist ??= value;
          }
          ;
          break;
        case "album":
          {
            metadataTags.album ??= value;
          }
          ;
          break;
        case "album_artist":
          {
            metadataTags.albumArtist ??= value;
          }
          ;
          break;
        case "genre":
          {
            metadataTags.genre ??= value;
          }
          ;
          break;
        case "comment":
          {
            metadataTags.comment ??= value;
          }
          ;
          break;
        case "lyrics":
          {
            metadataTags.lyrics ??= value;
          }
          ;
          break;
        case "date":
          {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
              metadataTags.date ??= date;
            }
          }
          ;
          break;
        case "track_number":
        case "part_number":
          {
            const parts = value.split("/");
            const trackNum = Number.parseInt(parts[0], 10);
            const tracksTotal = parts[1] && Number.parseInt(parts[1], 10);
            if (Number.isInteger(trackNum) && trackNum > 0) {
              metadataTags.trackNumber ??= trackNum;
            }
            if (tracksTotal && Number.isInteger(tracksTotal) && tracksTotal > 0) {
              metadataTags.tracksTotal ??= tracksTotal;
            }
          }
          ;
          break;
        case "disc_number":
        case "disc":
          {
            const discParts = value.split("/");
            const discNum = Number.parseInt(discParts[0], 10);
            const discsTotal = discParts[1] && Number.parseInt(discParts[1], 10);
            if (Number.isInteger(discNum) && discNum > 0) {
              metadataTags.discNumber ??= discNum;
            }
            if (discsTotal && Number.isInteger(discsTotal) && discsTotal > 0) {
              metadataTags.discsTotal ??= discsTotal;
            }
          }
          ;
          break;
      }
    }
  }
}

class MatroskaTrackBacking {
  constructor(internalTrack) {
    this.internalTrack = internalTrack;
    this.packetToClusterLocation = new WeakMap;
  }
  getId() {
    return this.internalTrack.id;
  }
  getNumber() {
    const demuxer = this.internalTrack.demuxer;
    const trackType = this.internalTrack.trackBacking.getType();
    let number = 0;
    for (const segment of demuxer.segments) {
      for (const track of segment.tracks) {
        if (track.trackBacking.getType() === trackType) {
          number++;
        }
        if (track === this.internalTrack) {
          break;
        }
      }
    }
    return number;
  }
  getCodec() {
    throw new Error("Not implemented on base class.");
  }
  getInternalCodecId() {
    return this.internalTrack.codecId;
  }
  getName() {
    return this.internalTrack.name;
  }
  getLanguageCode() {
    return this.internalTrack.languageCode;
  }
  getTimeResolution() {
    return this.internalTrack.segment.timestampFactor;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getDisposition() {
    return this.internalTrack.disposition;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    const segment = this.internalTrack.segment;
    if (segment.duration <= 0) {
      return null;
    }
    let endTimestamp = segment.duration / segment.timestampFactor;
    const firstPacket = await this.getFirstPacket({ metadataOnly: true });
    endTimestamp += firstPacket?.timestamp ?? 0;
    return endTimestamp;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  async getFirstPacket(options) {
    return this.performClusterLookup(null, (cluster) => {
      const trackData = cluster.trackData.get(this.internalTrack.id);
      if (trackData) {
        return {
          blockIndex: 0,
          correctBlockFound: true
        };
      }
      return {
        blockIndex: -1,
        correctBlockFound: false
      };
    }, -Infinity, Infinity, options);
  }
  intoTimescale(timestamp) {
    return roundIfAlmostInteger(timestamp * this.internalTrack.segment.timestampFactor);
  }
  async getPacket(timestamp, options) {
    const timestampInTimescale = this.intoTimescale(timestamp);
    return this.performClusterLookup(null, (cluster) => {
      const trackData = cluster.trackData.get(this.internalTrack.id);
      if (!trackData) {
        return { blockIndex: -1, correctBlockFound: false };
      }
      const index = binarySearchLessOrEqual(trackData.presentationTimestamps, timestampInTimescale, (x) => x.timestamp);
      const blockIndex = index !== -1 ? trackData.presentationTimestamps[index].blockIndex : -1;
      const correctBlockFound = index !== -1 && timestampInTimescale < trackData.endTimestamp;
      return { blockIndex, correctBlockFound };
    }, timestampInTimescale, timestampInTimescale, options);
  }
  async getNextPacket(packet, options) {
    const locationInCluster = this.packetToClusterLocation.get(packet);
    if (locationInCluster === undefined) {
      throw new Error("Packet was not created from this track.");
    }
    return this.performClusterLookup(locationInCluster.cluster, (cluster) => {
      if (cluster === locationInCluster.cluster) {
        const trackData = cluster.trackData.get(this.internalTrack.id);
        if (locationInCluster.blockIndex + 1 < trackData.blocks.length) {
          return {
            blockIndex: locationInCluster.blockIndex + 1,
            correctBlockFound: true
          };
        }
      } else {
        const trackData = cluster.trackData.get(this.internalTrack.id);
        if (trackData) {
          return {
            blockIndex: 0,
            correctBlockFound: true
          };
        }
      }
      return {
        blockIndex: -1,
        correctBlockFound: false
      };
    }, -Infinity, Infinity, options);
  }
  async getKeyPacket(timestamp, options) {
    const timestampInTimescale = this.intoTimescale(timestamp);
    return this.performClusterLookup(null, (cluster) => {
      const trackData = cluster.trackData.get(this.internalTrack.id);
      if (!trackData) {
        return { blockIndex: -1, correctBlockFound: false };
      }
      const index = findLastIndex(trackData.presentationTimestamps, (x) => {
        const block = trackData.blocks[x.blockIndex];
        return block.isKeyFrame && x.timestamp <= timestampInTimescale;
      });
      const blockIndex = index !== -1 ? trackData.presentationTimestamps[index].blockIndex : -1;
      const correctBlockFound = index !== -1 && timestampInTimescale < trackData.endTimestamp;
      return { blockIndex, correctBlockFound };
    }, timestampInTimescale, timestampInTimescale, options);
  }
  async getNextKeyPacket(packet, options) {
    const locationInCluster = this.packetToClusterLocation.get(packet);
    if (locationInCluster === undefined) {
      throw new Error("Packet was not created from this track.");
    }
    return this.performClusterLookup(locationInCluster.cluster, (cluster) => {
      if (cluster === locationInCluster.cluster) {
        const trackData = cluster.trackData.get(this.internalTrack.id);
        const nextKeyFrameIndex = trackData.blocks.findIndex((x, i) => x.isKeyFrame && i > locationInCluster.blockIndex);
        if (nextKeyFrameIndex !== -1) {
          return {
            blockIndex: nextKeyFrameIndex,
            correctBlockFound: true
          };
        }
      } else {
        const trackData = cluster.trackData.get(this.internalTrack.id);
        if (trackData && trackData.firstKeyFrameTimestamp !== null) {
          const keyFrameIndex = trackData.blocks.findIndex((x) => x.isKeyFrame);
          assert(keyFrameIndex !== -1);
          return {
            blockIndex: keyFrameIndex,
            correctBlockFound: true
          };
        }
      }
      return {
        blockIndex: -1,
        correctBlockFound: false
      };
    }, -Infinity, Infinity, options);
  }
  async fetchPacketInCluster(cluster, blockIndex, options) {
    if (blockIndex === -1) {
      return null;
    }
    const trackData = cluster.trackData.get(this.internalTrack.id);
    const block = trackData.blocks[blockIndex];
    assert(block);
    if (!block.decoded) {
      block.data = this.internalTrack.demuxer.decodeBlockData(this.internalTrack, block.data);
      block.decoded = true;
    }
    const data = options.metadataOnly ? PLACEHOLDER_DATA : block.data;
    const timestamp = block.timestamp / this.internalTrack.segment.timestampFactor;
    const duration = block.duration / this.internalTrack.segment.timestampFactor;
    const sideData = {};
    if (block.mainAdditional && this.internalTrack.info?.type === "video" && this.internalTrack.info.alphaMode) {
      sideData.alpha = options.metadataOnly ? PLACEHOLDER_DATA : block.mainAdditional;
      sideData.alphaByteLength = block.mainAdditional.byteLength;
    }
    const packet = new EncodedPacket(data, block.isKeyFrame ? "key" : "delta", timestamp, duration, cluster.dataStartPos + blockIndex, block.data.byteLength, sideData);
    this.packetToClusterLocation.set(packet, { cluster, blockIndex });
    return packet;
  }
  async performClusterLookup(startCluster, getMatchInCluster, searchTimestamp, latestTimestamp, options) {
    const { demuxer, segment } = this.internalTrack;
    let currentCluster = null;
    let bestCluster = null;
    let bestBlockIndex = -1;
    if (startCluster) {
      const { blockIndex, correctBlockFound } = getMatchInCluster(startCluster);
      if (correctBlockFound) {
        return this.fetchPacketInCluster(startCluster, blockIndex, options);
      }
      if (blockIndex !== -1) {
        bestCluster = startCluster;
        bestBlockIndex = blockIndex;
      }
    }
    const cuePointIndex = binarySearchLessOrEqual(this.internalTrack.cuePoints, searchTimestamp, (x) => x.time);
    const cuePoint = cuePointIndex !== -1 ? this.internalTrack.cuePoints[cuePointIndex] : null;
    const positionCacheIndex = binarySearchLessOrEqual(this.internalTrack.clusterPositionCache, searchTimestamp, (x) => x.startTimestamp);
    const positionCacheEntry = positionCacheIndex !== -1 ? this.internalTrack.clusterPositionCache[positionCacheIndex] : null;
    const lookupEntryPosition = Math.max(cuePoint?.clusterPosition ?? 0, positionCacheEntry?.elementStartPos ?? 0) || null;
    let currentPos;
    if (!startCluster) {
      currentPos = lookupEntryPosition ?? segment.clusterSeekStartPos;
    } else {
      if (lookupEntryPosition === null || startCluster.elementStartPos >= lookupEntryPosition) {
        currentPos = startCluster.elementEndPos;
        currentCluster = startCluster;
      } else {
        currentPos = lookupEntryPosition;
      }
    }
    while (segment.elementEndPos === null || currentPos <= segment.elementEndPos - MIN_HEADER_SIZE) {
      if (currentCluster) {
        const trackData = currentCluster.trackData.get(this.internalTrack.id);
        if (trackData && trackData.startTimestamp > latestTimestamp) {
          break;
        }
      }
      let slice = demuxer.reader.requestSliceRange(currentPos, MIN_HEADER_SIZE, MAX_HEADER_SIZE);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice)
        break;
      const elementStartPos = currentPos;
      const elementHeader = readElementHeader(slice);
      if (!elementHeader || !LEVEL_1_EBML_IDS.includes(elementHeader.id) && elementHeader.id !== EBMLId.Void) {
        const nextPos = await resync(demuxer.reader, elementStartPos, LEVEL_1_EBML_IDS, Math.min(segment.elementEndPos ?? Infinity, elementStartPos + MAX_RESYNC_LENGTH));
        if (nextPos) {
          currentPos = nextPos;
          continue;
        } else {
          break;
        }
      }
      const id = elementHeader.id;
      let size = elementHeader.size;
      const dataStartPos = slice.filePos;
      if (id === EBMLId.Cluster) {
        currentCluster = await demuxer.readCluster(elementStartPos, segment);
        size = currentCluster.elementEndPos - dataStartPos;
        const { blockIndex, correctBlockFound } = getMatchInCluster(currentCluster);
        if (correctBlockFound) {
          return this.fetchPacketInCluster(currentCluster, blockIndex, options);
        }
        if (blockIndex !== -1) {
          bestCluster = currentCluster;
          bestBlockIndex = blockIndex;
        }
      }
      if (size === undefined) {
        assert(id !== EBMLId.Cluster);
        const nextElementPos = await searchForNextElementId(demuxer.reader, dataStartPos, LEVEL_0_AND_1_EBML_IDS, segment.elementEndPos);
        size = nextElementPos.pos - dataStartPos;
      }
      const endPos = dataStartPos + size;
      if (segment.elementEndPos === null) {
        let slice2 = demuxer.reader.requestSliceRange(endPos, MIN_HEADER_SIZE, MAX_HEADER_SIZE);
        if (slice2 instanceof Promise)
          slice2 = await slice2;
        if (!slice2)
          break;
        const elementId = readElementId(slice2);
        if (elementId === EBMLId.Segment) {
          segment.elementEndPos = endPos;
          break;
        }
      }
      currentPos = endPos;
    }
    if (cuePoint && (!bestCluster || bestCluster.elementStartPos < cuePoint.clusterPosition)) {
      const previousCuePoint = this.internalTrack.cuePoints[cuePointIndex - 1];
      assert(!previousCuePoint || previousCuePoint.time < cuePoint.time);
      const newSearchTimestamp = previousCuePoint?.time ?? -Infinity;
      return this.performClusterLookup(null, getMatchInCluster, newSearchTimestamp, latestTimestamp, options);
    }
    if (bestCluster) {
      return this.fetchPacketInCluster(bestCluster, bestBlockIndex, options);
    }
    return null;
  }
}

class MatroskaVideoTrackBacking extends MatroskaTrackBacking {
  constructor(internalTrack) {
    super(internalTrack);
    this.decoderConfigPromise = null;
    this.internalTrack = internalTrack;
  }
  getType() {
    return "video";
  }
  getCodec() {
    return this.internalTrack.info.codec;
  }
  getCodedWidth() {
    return this.internalTrack.info.width;
  }
  getCodedHeight() {
    return this.internalTrack.info.height;
  }
  getSquarePixelWidth() {
    return this.internalTrack.info.squarePixelWidth;
  }
  getSquarePixelHeight() {
    return this.internalTrack.info.squarePixelHeight;
  }
  getRotation() {
    return this.internalTrack.info.rotation;
  }
  async getColorSpace() {
    return {
      primaries: this.internalTrack.info.colorSpace?.primaries,
      transfer: this.internalTrack.info.colorSpace?.transfer,
      matrix: this.internalTrack.info.colorSpace?.matrix,
      fullRange: this.internalTrack.info.colorSpace?.fullRange
    };
  }
  async canBeTransparent() {
    return this.internalTrack.info.alphaMode;
  }
  async getDecoderConfig() {
    if (!this.internalTrack.info.codec) {
      return null;
    }
    return this.decoderConfigPromise ??= (async () => {
      let firstPacket = null;
      const needsPacketForAdditionalInfo = this.internalTrack.info.codec === "vp9" || this.internalTrack.info.codec === "av1" || this.internalTrack.info.codec === "avc" && !this.internalTrack.info.codecDescription || this.internalTrack.info.codec === "hevc" && !this.internalTrack.info.codecDescription;
      if (needsPacketForAdditionalInfo) {
        firstPacket = await this.getFirstPacket({});
      }
      const config = {
        codec: extractVideoCodecString({
          width: this.internalTrack.info.width,
          height: this.internalTrack.info.height,
          codec: this.internalTrack.info.codec,
          codecDescription: this.internalTrack.info.codecDescription,
          colorSpace: this.internalTrack.info.colorSpace,
          avcType: 1,
          avcCodecInfo: this.internalTrack.info.codec === "avc" && firstPacket ? extractAvcDecoderConfigurationRecord(firstPacket.data) : null,
          hevcCodecInfo: this.internalTrack.info.codec === "hevc" && firstPacket ? extractHevcDecoderConfigurationRecord(firstPacket.data) : null,
          vp9CodecInfo: this.internalTrack.info.codec === "vp9" && firstPacket ? extractVp9CodecInfoFromPacket(firstPacket.data) : null,
          av1CodecInfo: this.internalTrack.info.codec === "av1" && firstPacket ? extractAv1CodecInfoFromPacket(firstPacket.data) : null
        }),
        codedWidth: this.internalTrack.info.width,
        codedHeight: this.internalTrack.info.height,
        description: this.internalTrack.info.codecDescription ?? undefined,
        colorSpace: this.internalTrack.info.colorSpace ?? undefined
      };
      if (this.internalTrack.info.width !== this.internalTrack.info.squarePixelWidth || this.internalTrack.info.height !== this.internalTrack.info.squarePixelHeight) {
        config.displayAspectWidth = this.internalTrack.info.squarePixelWidth;
        config.displayAspectHeight = this.internalTrack.info.squarePixelHeight;
      }
      return config;
    })();
  }
}

class MatroskaAudioTrackBacking extends MatroskaTrackBacking {
  constructor(internalTrack) {
    super(internalTrack);
    this.decoderConfig = null;
    this.internalTrack = internalTrack;
  }
  getType() {
    return "audio";
  }
  getCodec() {
    return this.internalTrack.info.codec;
  }
  getNumberOfChannels() {
    return this.internalTrack.info.numberOfChannels;
  }
  getSampleRate() {
    return this.internalTrack.info.sampleRate;
  }
  async getDecoderConfig() {
    if (!this.internalTrack.info.codec) {
      return null;
    }
    return this.decoderConfig ??= {
      codec: extractAudioCodecString({
        codec: this.internalTrack.info.codec,
        codecDescription: this.internalTrack.info.codecDescription,
        aacCodecInfo: this.internalTrack.info.aacCodecInfo
      }),
      numberOfChannels: this.internalTrack.info.numberOfChannels,
      sampleRate: this.internalTrack.info.sampleRate,
      description: this.internalTrack.info.codecDescription ?? undefined
    };
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/mp3/mp3-reader.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var readNextMp3FrameHeader = async (reader, startPos, until, ref = null) => {
  const CHUNK_SIZE = 2 ** 16;
  let currentPos = startPos;
  while (until === null || currentPos < until) {
    const maxLength = until !== null ? Math.min(CHUNK_SIZE, until - currentPos) : CHUNK_SIZE;
    let slice = reader.requestSliceRange(currentPos, MP3_FRAME_HEADER_SIZE, maxLength);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice || slice.length < MP3_FRAME_HEADER_SIZE)
      break;
    while (slice.remainingLength >= MP3_FRAME_HEADER_SIZE) {
      const posBeforeRead = slice.filePos;
      const word = readU32Be(slice);
      const remainingBytes = reader.fileSize !== null ? reader.fileSize - currentPos : null;
      const result = readMp3FrameHeader(word, remainingBytes);
      if (result.header && (!ref || result.header.sampleRate === ref.sampleRate && result.header.mpegVersionId === ref.mpegVersionId && result.header.layer === ref.layer && getMp3ChannelCount(result.header.channel) === getMp3ChannelCount(ref.channel))) {
        return { header: result.header, startPos: currentPos };
      }
      slice.filePos = posBeforeRead + result.bytesAdvanced;
      currentPos = slice.filePos;
    }
  }
  return null;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/mp3/mp3-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class Mp3Demuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.metadataPromise = null;
    this.firstFrameHeader = null;
    this.firstFrameHeaderPos = null;
    this.loadedSamples = [];
    this.metadataTags = null;
    this.xingData = null;
    this.trackBackings = [];
    this.readingMutex = new AsyncMutex;
    this.lastSampleLoaded = false;
    this.lastLoadedPos = 0;
    this.nextTimestampInSamples = 0;
    this.reader = input._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      while (!this.firstFrameHeader && !this.lastSampleLoaded) {
        await this.advanceReader();
      }
      if (!this.firstFrameHeader) {
        throw new Error("No valid MP3 frame found.");
      }
      this.trackBackings = [new Mp3AudioTrackBacking(this)];
    })();
  }
  async advanceReader() {
    if (this.lastLoadedPos === 0) {
      while (true) {
        let slice2 = this.reader.requestSlice(this.lastLoadedPos, ID3_V2_HEADER_SIZE);
        if (slice2 instanceof Promise)
          slice2 = await slice2;
        if (!slice2) {
          this.lastSampleLoaded = true;
          return;
        }
        const id3V2Header = readId3V2Header(slice2);
        if (!id3V2Header) {
          break;
        }
        this.lastLoadedPos = slice2.filePos + id3V2Header.size;
      }
    }
    const result = await readNextMp3FrameHeader(this.reader, this.lastLoadedPos, this.reader.fileSize, this.firstFrameHeader);
    if (!result) {
      this.lastSampleLoaded = true;
      return;
    }
    const header = result.header;
    this.lastLoadedPos = result.startPos + header.totalSize - 1;
    const xingOffset = getXingOffset(header.mpegVersionId, header.channel);
    let slice = this.reader.requestSlice(result.startPos + xingOffset, 4);
    if (slice instanceof Promise)
      slice = await slice;
    if (slice) {
      const word = readU32Be(slice);
      const isXing = word === XING || word === INFO;
      if (isXing) {
        if (!this.xingData) {
          let xingDataSlice = this.reader.requestSlice(result.startPos + xingOffset + 4, 12);
          if (xingDataSlice instanceof Promise)
            xingDataSlice = await xingDataSlice;
          if (xingDataSlice) {
            const xingData = readBytes(xingDataSlice, 12);
            const view = toDataView(xingData);
            const flags = view.getUint32(0, false);
            this.xingData = {
              frameCount: flags & XingFlags.FrameCount ? view.getUint32(4, false) : null,
              fileSize: flags & XingFlags.FileSize ? view.getUint32(8, false) : null
            };
          }
        }
        return;
      }
    }
    if (!this.firstFrameHeader) {
      this.firstFrameHeader = header;
      this.firstFrameHeaderPos = result.startPos;
    }
    const sampleDuration = header.audioSamplesInFrame / this.firstFrameHeader.sampleRate;
    const sample = {
      timestamp: this.nextTimestampInSamples / this.firstFrameHeader.sampleRate,
      duration: sampleDuration,
      dataStart: result.startPos,
      dataSize: header.totalSize
    };
    this.loadedSamples.push(sample);
    this.nextTimestampInSamples += header.audioSamplesInFrame;
    return;
  }
  async getMimeType() {
    return "audio/mpeg";
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackings;
  }
  async getMetadataTags() {
    const release = await this.readingMutex.acquire();
    try {
      await this.readMetadata();
      if (this.metadataTags) {
        return this.metadataTags;
      }
      this.metadataTags = {};
      let currentPos = 0;
      let id3V2HeaderFound = false;
      while (true) {
        let headerSlice = this.reader.requestSlice(currentPos, ID3_V2_HEADER_SIZE);
        if (headerSlice instanceof Promise)
          headerSlice = await headerSlice;
        if (!headerSlice)
          break;
        const id3V2Header = readId3V2Header(headerSlice);
        if (!id3V2Header) {
          break;
        }
        id3V2HeaderFound = true;
        let contentSlice = this.reader.requestSlice(headerSlice.filePos, id3V2Header.size);
        if (contentSlice instanceof Promise)
          contentSlice = await contentSlice;
        if (!contentSlice)
          break;
        parseId3V2Tag(contentSlice, id3V2Header, this.metadataTags);
        currentPos = headerSlice.filePos + id3V2Header.size;
      }
      if (!id3V2HeaderFound && this.reader.fileSize !== null && this.reader.fileSize >= ID3_V1_TAG_SIZE) {
        let slice = this.reader.requestSlice(this.reader.fileSize - ID3_V1_TAG_SIZE, ID3_V1_TAG_SIZE);
        if (slice instanceof Promise)
          slice = await slice;
        assert(slice);
        const tag = readAscii(slice, 3);
        if (tag === "TAG") {
          parseId3V1Tag(slice, this.metadataTags);
        }
      }
      return this.metadataTags;
    } finally {
      release();
    }
  }
}

class Mp3AudioTrackBacking {
  constructor(demuxer) {
    this.demuxer = demuxer;
  }
  getType() {
    return "audio";
  }
  getId() {
    return 1;
  }
  getNumber() {
    return 1;
  }
  getTimeResolution() {
    assert(this.demuxer.firstFrameHeader);
    return this.demuxer.firstFrameHeader.sampleRate / this.demuxer.firstFrameHeader.audioSamplesInFrame;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    const demuxer = this.demuxer;
    assert(demuxer.firstFrameHeader !== null);
    assert(demuxer.firstFrameHeaderPos !== null);
    if (demuxer.xingData) {
      if (demuxer.xingData.frameCount !== null) {
        return demuxer.xingData.frameCount * demuxer.firstFrameHeader.audioSamplesInFrame / demuxer.firstFrameHeader.sampleRate;
      }
    } else {
      if (demuxer.reader.fileSize !== null) {
        const averageFrameSize = computeAverageMp3FrameSize(demuxer.firstFrameHeader.lowSamplingFrequency, demuxer.firstFrameHeader.layer, demuxer.firstFrameHeader.bitrate, demuxer.firstFrameHeader.sampleRate);
        const frameCount = (demuxer.reader.fileSize - demuxer.firstFrameHeaderPos) / averageFrameSize;
        return Math.round(frameCount) * demuxer.firstFrameHeader.audioSamplesInFrame / demuxer.firstFrameHeader.sampleRate;
      }
    }
    return null;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return UNDETERMINED_LANGUAGE;
  }
  getCodec() {
    return "mp3";
  }
  getInternalCodecId() {
    return null;
  }
  getNumberOfChannels() {
    assert(this.demuxer.firstFrameHeader);
    return getMp3ChannelCount(this.demuxer.firstFrameHeader.channel);
  }
  getSampleRate() {
    assert(this.demuxer.firstFrameHeader);
    return this.demuxer.firstFrameHeader.sampleRate;
  }
  getDisposition() {
    return {
      ...DEFAULT_TRACK_DISPOSITION
    };
  }
  async getDecoderConfig() {
    assert(this.demuxer.firstFrameHeader);
    return {
      codec: "mp3",
      numberOfChannels: getMp3ChannelCount(this.demuxer.firstFrameHeader.channel),
      sampleRate: this.demuxer.firstFrameHeader.sampleRate
    };
  }
  async getPacketAtIndex(sampleIndex, options) {
    if (sampleIndex === -1) {
      return null;
    }
    const rawSample = this.demuxer.loadedSamples[sampleIndex];
    if (!rawSample) {
      return null;
    }
    let data;
    if (options.metadataOnly) {
      data = PLACEHOLDER_DATA;
    } else {
      let slice = this.demuxer.reader.requestSlice(rawSample.dataStart, rawSample.dataSize);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice) {
        return null;
      }
      data = readBytes(slice, rawSample.dataSize);
    }
    return new EncodedPacket(data, "key", rawSample.timestamp, rawSample.duration, sampleIndex, rawSample.dataSize);
  }
  getFirstPacket(options) {
    return this.getPacketAtIndex(0, options);
  }
  async getNextPacket(packet, options) {
    const release = await this.demuxer.readingMutex.acquire();
    try {
      const sampleIndex = binarySearchExact(this.demuxer.loadedSamples, packet.timestamp, (x) => x.timestamp);
      if (sampleIndex === -1) {
        throw new Error("Packet was not created from this track.");
      }
      const nextIndex = sampleIndex + 1;
      while (nextIndex >= this.demuxer.loadedSamples.length && !this.demuxer.lastSampleLoaded) {
        await this.demuxer.advanceReader();
      }
      return this.getPacketAtIndex(nextIndex, options);
    } finally {
      release();
    }
  }
  async getPacket(timestamp, options) {
    const release = await this.demuxer.readingMutex.acquire();
    try {
      while (true) {
        const index = binarySearchLessOrEqual(this.demuxer.loadedSamples, timestamp, (x) => x.timestamp);
        if (index === -1 && this.demuxer.loadedSamples.length > 0) {
          return null;
        }
        if (this.demuxer.lastSampleLoaded) {
          return this.getPacketAtIndex(index, options);
        }
        if (index >= 0 && index + 1 < this.demuxer.loadedSamples.length) {
          return this.getPacketAtIndex(index, options);
        }
        await this.demuxer.advanceReader();
      }
    } finally {
      release();
    }
  }
  getKeyPacket(timestamp, options) {
    return this.getPacket(timestamp, options);
  }
  getNextKeyPacket(packet, options) {
    return this.getNextPacket(packet, options);
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/ogg/ogg-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var OGGS = 1399285583;
var OGG_CRC_POLYNOMIAL = 79764919;
var OGG_CRC_TABLE = new Uint32Array(256);
for (let n = 0;n < 256; n++) {
  let crc = n << 24;
  for (let k = 0;k < 8; k++) {
    crc = crc & 2147483648 ? crc << 1 ^ OGG_CRC_POLYNOMIAL : crc << 1;
  }
  OGG_CRC_TABLE[n] = crc >>> 0 & 4294967295;
}
var computeOggPageCrc = (bytes) => {
  const view = toDataView(bytes);
  const originalChecksum = view.getUint32(22, true);
  view.setUint32(22, 0, true);
  let crc = 0;
  for (let i = 0;i < bytes.length; i++) {
    const byte = bytes[i];
    crc = (crc << 8 ^ OGG_CRC_TABLE[crc >>> 24 ^ byte]) >>> 0;
  }
  view.setUint32(22, originalChecksum, true);
  return crc;
};
var extractSampleMetadata = (data, codecInfo, vorbisLastBlocksize) => {
  let durationInSamples = 0;
  let currentBlocksize = null;
  if (data.length > 0) {
    if (codecInfo.codec === "vorbis") {
      assert(codecInfo.vorbisInfo);
      const vorbisModeCount = codecInfo.vorbisInfo.modeBlockflags.length;
      const bitCount = ilog(vorbisModeCount - 1);
      const modeMask = (1 << bitCount) - 1 << 1;
      const modeNumber = (data[0] & modeMask) >> 1;
      if (modeNumber >= codecInfo.vorbisInfo.modeBlockflags.length) {
        throw new Error("Invalid mode number.");
      }
      let prevBlocksize = vorbisLastBlocksize;
      const blockflag = codecInfo.vorbisInfo.modeBlockflags[modeNumber];
      currentBlocksize = codecInfo.vorbisInfo.blocksizes[blockflag];
      if (blockflag === 1) {
        const prevMask = (modeMask | 1) + 1;
        const flag = data[0] & prevMask ? 1 : 0;
        prevBlocksize = codecInfo.vorbisInfo.blocksizes[flag];
      }
      durationInSamples = prevBlocksize !== null ? prevBlocksize + currentBlocksize >> 2 : 0;
    } else if (codecInfo.codec === "opus") {
      const toc = parseOpusTocByte(data);
      durationInSamples = toc.durationInSamples;
    }
  }
  return {
    durationInSamples,
    vorbisBlockSize: currentBlocksize
  };
};
var buildOggMimeType = (info) => {
  let string = "audio/ogg";
  if (info.codecStrings) {
    const uniqueCodecMimeTypes = [...new Set(info.codecStrings)];
    string += `; codecs="${uniqueCodecMimeTypes.join(", ")}"`;
  }
  return string;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/ogg/ogg-reader.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var MIN_PAGE_HEADER_SIZE = 27;
var MAX_PAGE_HEADER_SIZE = 27 + 255;
var MAX_PAGE_SIZE = MAX_PAGE_HEADER_SIZE + 255 * 255;
var readPageHeader = (slice) => {
  const startPos = slice.filePos;
  const capturePattern = readU32Le(slice);
  if (capturePattern !== OGGS) {
    return null;
  }
  slice.skip(1);
  const headerType = readU8(slice);
  const granulePosition = readI64Le(slice);
  const serialNumber = readU32Le(slice);
  const sequenceNumber = readU32Le(slice);
  const checksum = readU32Le(slice);
  const numberPageSegments = readU8(slice);
  const lacingValues = new Uint8Array(numberPageSegments);
  for (let i = 0;i < numberPageSegments; i++) {
    lacingValues[i] = readU8(slice);
  }
  const headerSize = 27 + numberPageSegments;
  const dataSize = lacingValues.reduce((a, b) => a + b, 0);
  const totalSize = headerSize + dataSize;
  return {
    headerStartPos: startPos,
    totalSize,
    dataStartPos: startPos + headerSize,
    dataSize,
    headerType,
    granulePosition,
    serialNumber,
    sequenceNumber,
    checksum,
    lacingValues
  };
};
var findNextPageHeader = (slice, until) => {
  while (slice.filePos < until - (4 - 1)) {
    const word = readU32Le(slice);
    const firstByte = word & 255;
    const secondByte = word >>> 8 & 255;
    const thirdByte = word >>> 16 & 255;
    const fourthByte = word >>> 24 & 255;
    const O = 79;
    if (firstByte !== O && secondByte !== O && thirdByte !== O && fourthByte !== O) {
      continue;
    }
    slice.skip(-4);
    if (word === OGGS) {
      return true;
    }
    slice.skip(1);
  }
  return false;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/ogg/ogg-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class OggDemuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.metadataPromise = null;
    this.bitstreams = [];
    this.trackBackings = [];
    this.metadataTags = {};
    this.reader = input._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      let currentPos = 0;
      while (true) {
        let slice = this.reader.requestSliceRange(currentPos, MIN_PAGE_HEADER_SIZE, MAX_PAGE_HEADER_SIZE);
        if (slice instanceof Promise)
          slice = await slice;
        if (!slice)
          break;
        const page = readPageHeader(slice);
        if (!page) {
          break;
        }
        const isBos = !!(page.headerType & 2);
        if (!isBos) {
          break;
        }
        this.bitstreams.push({
          serialNumber: page.serialNumber,
          bosPage: page,
          description: null,
          numberOfChannels: -1,
          sampleRate: -1,
          codecInfo: {
            codec: null,
            vorbisInfo: null,
            opusInfo: null
          },
          lastMetadataPacket: null
        });
        currentPos = page.headerStartPos + page.totalSize;
      }
      for (const bitstream of this.bitstreams) {
        const firstPacket = await this.readPacket(bitstream.bosPage, 0);
        if (!firstPacket) {
          continue;
        }
        if (firstPacket.data.byteLength >= 7 && firstPacket.data[0] === 1 && firstPacket.data[1] === 118 && firstPacket.data[2] === 111 && firstPacket.data[3] === 114 && firstPacket.data[4] === 98 && firstPacket.data[5] === 105 && firstPacket.data[6] === 115) {
          await this.readVorbisMetadata(firstPacket, bitstream);
        } else if (firstPacket.data.byteLength >= 8 && firstPacket.data[0] === 79 && firstPacket.data[1] === 112 && firstPacket.data[2] === 117 && firstPacket.data[3] === 115 && firstPacket.data[4] === 72 && firstPacket.data[5] === 101 && firstPacket.data[6] === 97 && firstPacket.data[7] === 100) {
          await this.readOpusMetadata(firstPacket, bitstream);
        }
        if (bitstream.codecInfo.codec !== null) {
          this.trackBackings.push(new OggAudioTrackBacking(bitstream, this));
        }
      }
    })();
  }
  async readVorbisMetadata(firstPacket, bitstream) {
    let nextPacketPosition = await this.findNextPacketStart(firstPacket);
    if (!nextPacketPosition) {
      return;
    }
    const secondPacket = await this.readPacket(nextPacketPosition.startPage, nextPacketPosition.startSegmentIndex);
    if (!secondPacket) {
      return;
    }
    nextPacketPosition = await this.findNextPacketStart(secondPacket);
    if (!nextPacketPosition) {
      return;
    }
    const thirdPacket = await this.readPacket(nextPacketPosition.startPage, nextPacketPosition.startSegmentIndex);
    if (!thirdPacket) {
      return;
    }
    if (secondPacket.data[0] !== 3 || thirdPacket.data[0] !== 5) {
      return;
    }
    const lacingValues = [];
    const addBytesToSegmentTable = (bytes) => {
      while (true) {
        lacingValues.push(Math.min(255, bytes));
        if (bytes < 255) {
          break;
        }
        bytes -= 255;
      }
    };
    addBytesToSegmentTable(firstPacket.data.length);
    addBytesToSegmentTable(secondPacket.data.length);
    const description = new Uint8Array(1 + lacingValues.length + firstPacket.data.length + secondPacket.data.length + thirdPacket.data.length);
    description[0] = 2;
    description.set(lacingValues, 1);
    description.set(firstPacket.data, 1 + lacingValues.length);
    description.set(secondPacket.data, 1 + lacingValues.length + firstPacket.data.length);
    description.set(thirdPacket.data, 1 + lacingValues.length + firstPacket.data.length + secondPacket.data.length);
    bitstream.codecInfo.codec = "vorbis";
    bitstream.description = description;
    bitstream.lastMetadataPacket = thirdPacket;
    const view = toDataView(firstPacket.data);
    bitstream.numberOfChannels = view.getUint8(11);
    bitstream.sampleRate = view.getUint32(12, true);
    const blockSizeByte = view.getUint8(28);
    bitstream.codecInfo.vorbisInfo = {
      blocksizes: [
        1 << (blockSizeByte & 15),
        1 << (blockSizeByte >> 4)
      ],
      modeBlockflags: parseModesFromVorbisSetupPacket(thirdPacket.data).modeBlockflags
    };
    readVorbisComments(secondPacket.data.subarray(7), this.metadataTags);
  }
  async readOpusMetadata(firstPacket, bitstream) {
    const nextPacketPosition = await this.findNextPacketStart(firstPacket);
    if (!nextPacketPosition) {
      return;
    }
    const secondPacket = await this.readPacket(nextPacketPosition.startPage, nextPacketPosition.startSegmentIndex);
    if (!secondPacket) {
      return;
    }
    bitstream.codecInfo.codec = "opus";
    bitstream.description = firstPacket.data;
    bitstream.lastMetadataPacket = secondPacket;
    const header = parseOpusIdentificationHeader(firstPacket.data);
    bitstream.numberOfChannels = header.outputChannelCount;
    bitstream.sampleRate = OPUS_SAMPLE_RATE;
    bitstream.codecInfo.opusInfo = {
      preSkip: header.preSkip
    };
    readVorbisComments(secondPacket.data.subarray(8), this.metadataTags);
  }
  async readPacket(startPage, startSegmentIndex) {
    assert(startSegmentIndex < startPage.lacingValues.length);
    let startDataOffset = 0;
    for (let i = 0;i < startSegmentIndex; i++) {
      startDataOffset += startPage.lacingValues[i];
    }
    let currentPage = startPage;
    let currentDataOffset = startDataOffset;
    let currentSegmentIndex = startSegmentIndex;
    const chunks = [];
    outer:
      while (true) {
        let pageSlice = this.reader.requestSlice(currentPage.dataStartPos, currentPage.dataSize);
        if (pageSlice instanceof Promise)
          pageSlice = await pageSlice;
        assert(pageSlice);
        const pageData = readBytes(pageSlice, currentPage.dataSize);
        while (true) {
          if (currentSegmentIndex === currentPage.lacingValues.length) {
            chunks.push(pageData.subarray(startDataOffset, currentDataOffset));
            break;
          }
          const lacingValue = currentPage.lacingValues[currentSegmentIndex];
          currentDataOffset += lacingValue;
          if (lacingValue < 255) {
            chunks.push(pageData.subarray(startDataOffset, currentDataOffset));
            break outer;
          }
          currentSegmentIndex++;
        }
        let currentPos = currentPage.headerStartPos + currentPage.totalSize;
        while (true) {
          let headerSlice = this.reader.requestSliceRange(currentPos, MIN_PAGE_HEADER_SIZE, MAX_PAGE_HEADER_SIZE);
          if (headerSlice instanceof Promise)
            headerSlice = await headerSlice;
          if (!headerSlice) {
            return null;
          }
          const nextPage = readPageHeader(headerSlice);
          if (!nextPage) {
            return null;
          }
          currentPage = nextPage;
          if (currentPage.serialNumber === startPage.serialNumber) {
            break;
          }
          currentPos = currentPage.headerStartPos + currentPage.totalSize;
        }
        startDataOffset = 0;
        currentDataOffset = 0;
        currentSegmentIndex = 0;
      }
    const totalPacketSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalPacketSize === 0) {
      return null;
    }
    const packetData = new Uint8Array(totalPacketSize);
    let offset = 0;
    for (let i = 0;i < chunks.length; i++) {
      const chunk = chunks[i];
      packetData.set(chunk, offset);
      offset += chunk.length;
    }
    return {
      data: packetData,
      endPage: currentPage,
      endSegmentIndex: currentSegmentIndex
    };
  }
  async findNextPacketStart(lastPacket) {
    if (lastPacket.endSegmentIndex < lastPacket.endPage.lacingValues.length - 1) {
      return { startPage: lastPacket.endPage, startSegmentIndex: lastPacket.endSegmentIndex + 1 };
    }
    const isEos = !!(lastPacket.endPage.headerType & 4);
    if (isEos) {
      return null;
    }
    let currentPos = lastPacket.endPage.headerStartPos + lastPacket.endPage.totalSize;
    while (true) {
      let slice = this.reader.requestSliceRange(currentPos, MIN_PAGE_HEADER_SIZE, MAX_PAGE_HEADER_SIZE);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice) {
        return null;
      }
      const nextPage = readPageHeader(slice);
      if (!nextPage) {
        return null;
      }
      if (nextPage.serialNumber === lastPacket.endPage.serialNumber) {
        return { startPage: nextPage, startSegmentIndex: 0 };
      }
      currentPos = nextPage.headerStartPos + nextPage.totalSize;
    }
  }
  async getMimeType() {
    await this.readMetadata();
    const codecStrings = await Promise.all(this.trackBackings.map((x) => x.getDecoderConfig().then((c) => c?.codec ?? null)));
    return buildOggMimeType({
      codecStrings: codecStrings.filter(Boolean)
    });
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackings;
  }
  async getMetadataTags() {
    await this.readMetadata();
    return this.metadataTags;
  }
}

class OggAudioTrackBacking {
  constructor(bitstream, demuxer) {
    this.bitstream = bitstream;
    this.demuxer = demuxer;
    this.encodedPacketToMetadata = new WeakMap;
    this.sequentialScanCache = [];
    this.sequentialScanMutex = new AsyncMutex;
    this.internalSampleRate = bitstream.codecInfo.codec === "opus" ? OPUS_SAMPLE_RATE : bitstream.sampleRate;
  }
  getType() {
    return "audio";
  }
  getId() {
    return this.bitstream.serialNumber;
  }
  getNumber() {
    const index = this.demuxer.trackBackings.findIndex((x) => x.bitstream === this.bitstream);
    assert(index !== -1);
    return index + 1;
  }
  getNumberOfChannels() {
    return this.bitstream.numberOfChannels;
  }
  getSampleRate() {
    return this.bitstream.sampleRate;
  }
  getTimeResolution() {
    return this.bitstream.sampleRate;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    return null;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getCodec() {
    return this.bitstream.codecInfo.codec;
  }
  getInternalCodecId() {
    return null;
  }
  async getDecoderConfig() {
    assert(this.bitstream.codecInfo.codec);
    return {
      codec: this.bitstream.codecInfo.codec,
      numberOfChannels: this.bitstream.numberOfChannels,
      sampleRate: this.bitstream.sampleRate,
      description: this.bitstream.description ?? undefined
    };
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return UNDETERMINED_LANGUAGE;
  }
  getDisposition() {
    return {
      ...DEFAULT_TRACK_DISPOSITION,
      primary: false
    };
  }
  granulePositionToTimestampInSamples(granulePosition) {
    if (this.bitstream.codecInfo.codec === "opus") {
      assert(this.bitstream.codecInfo.opusInfo);
      return granulePosition - this.bitstream.codecInfo.opusInfo.preSkip;
    }
    return granulePosition;
  }
  createEncodedPacketFromOggPacket(packet, additional, options) {
    if (!packet) {
      return null;
    }
    const { durationInSamples, vorbisBlockSize } = extractSampleMetadata(packet.data, this.bitstream.codecInfo, additional.vorbisLastBlocksize);
    const encodedPacket = new EncodedPacket(options.metadataOnly ? PLACEHOLDER_DATA : packet.data, "key", Math.max(0, additional.timestampInSamples) / this.internalSampleRate, durationInSamples / this.internalSampleRate, packet.endPage.headerStartPos + packet.endSegmentIndex, packet.data.byteLength);
    this.encodedPacketToMetadata.set(encodedPacket, {
      packet,
      timestampInSamples: additional.timestampInSamples,
      durationInSamples,
      vorbisLastBlockSize: additional.vorbisLastBlocksize,
      vorbisBlockSize
    });
    return encodedPacket;
  }
  async getFirstPacket(options) {
    assert(this.bitstream.lastMetadataPacket);
    const packetPosition = await this.demuxer.findNextPacketStart(this.bitstream.lastMetadataPacket);
    if (!packetPosition) {
      return null;
    }
    let timestampInSamples = 0;
    if (this.bitstream.codecInfo.codec === "opus") {
      assert(this.bitstream.codecInfo.opusInfo);
      timestampInSamples -= this.bitstream.codecInfo.opusInfo.preSkip;
    }
    const packet = await this.demuxer.readPacket(packetPosition.startPage, packetPosition.startSegmentIndex);
    return this.createEncodedPacketFromOggPacket(packet, {
      timestampInSamples,
      vorbisLastBlocksize: null
    }, options);
  }
  async getNextPacket(prevPacket, options) {
    const prevMetadata = this.encodedPacketToMetadata.get(prevPacket);
    if (!prevMetadata) {
      throw new Error("Packet was not created from this track.");
    }
    const packetPosition = await this.demuxer.findNextPacketStart(prevMetadata.packet);
    if (!packetPosition) {
      return null;
    }
    const timestampInSamples = prevMetadata.timestampInSamples + prevMetadata.durationInSamples;
    const packet = await this.demuxer.readPacket(packetPosition.startPage, packetPosition.startSegmentIndex);
    return this.createEncodedPacketFromOggPacket(packet, {
      timestampInSamples,
      vorbisLastBlocksize: prevMetadata.vorbisBlockSize
    }, options);
  }
  async getPacket(timestamp, options) {
    if (this.demuxer.reader.fileSize === null) {
      return this.getPacketSequential(timestamp, options);
    }
    const timestampInSamples = roundIfAlmostInteger(timestamp * this.internalSampleRate);
    if (timestampInSamples === 0) {
      return this.getFirstPacket(options);
    }
    if (timestampInSamples < 0) {
      return null;
    }
    assert(this.bitstream.lastMetadataPacket);
    const startPosition = await this.demuxer.findNextPacketStart(this.bitstream.lastMetadataPacket);
    if (!startPosition) {
      return null;
    }
    let lowPage = startPosition.startPage;
    let high = this.demuxer.reader.fileSize;
    const lowPages = [lowPage];
    outer:
      while (lowPage.headerStartPos + lowPage.totalSize < high) {
        const low = lowPage.headerStartPos;
        const mid = Math.floor((low + high) / 2);
        let searchStartPos = mid;
        while (true) {
          const until = Math.min(searchStartPos + MAX_PAGE_SIZE, high - MIN_PAGE_HEADER_SIZE);
          let searchSlice = this.demuxer.reader.requestSlice(searchStartPos, until - searchStartPos);
          if (searchSlice instanceof Promise)
            searchSlice = await searchSlice;
          assert(searchSlice);
          const found = findNextPageHeader(searchSlice, until);
          if (!found) {
            high = mid + MIN_PAGE_HEADER_SIZE;
            continue outer;
          }
          let headerSlice = this.demuxer.reader.requestSliceRange(searchSlice.filePos, MIN_PAGE_HEADER_SIZE, MAX_PAGE_HEADER_SIZE);
          if (headerSlice instanceof Promise)
            headerSlice = await headerSlice;
          assert(headerSlice);
          const page = readPageHeader(headerSlice);
          assert(page);
          let pageValid = false;
          if (page.serialNumber === this.bitstream.serialNumber) {
            pageValid = true;
          } else {
            let pageSlice = this.demuxer.reader.requestSlice(page.headerStartPos, page.totalSize);
            if (pageSlice instanceof Promise)
              pageSlice = await pageSlice;
            assert(pageSlice);
            const bytes = readBytes(pageSlice, page.totalSize);
            const crc = computeOggPageCrc(bytes);
            pageValid = crc === page.checksum;
          }
          if (!pageValid) {
            searchStartPos = page.headerStartPos + 4;
            continue;
          }
          if (pageValid && page.serialNumber !== this.bitstream.serialNumber) {
            searchStartPos = page.headerStartPos + page.totalSize;
            continue;
          }
          const isContinuationPage = page.granulePosition === -1;
          if (isContinuationPage) {
            searchStartPos = page.headerStartPos + page.totalSize;
            continue;
          }
          if (this.granulePositionToTimestampInSamples(page.granulePosition) > timestampInSamples) {
            high = page.headerStartPos;
          } else {
            lowPage = page;
            lowPages.push(page);
          }
          continue outer;
        }
      }
    let lowerPage = startPosition.startPage;
    for (const otherLowPage of lowPages) {
      if (otherLowPage.granulePosition === lowPage.granulePosition) {
        break;
      }
      if (!lowerPage || otherLowPage.headerStartPos > lowerPage.headerStartPos) {
        lowerPage = otherLowPage;
      }
    }
    let currentPage = lowerPage;
    const previousPages = [currentPage];
    while (true) {
      if (currentPage.serialNumber === this.bitstream.serialNumber && currentPage.granulePosition === lowPage.granulePosition) {
        break;
      }
      const nextPos = currentPage.headerStartPos + currentPage.totalSize;
      let slice = this.demuxer.reader.requestSliceRange(nextPos, MIN_PAGE_HEADER_SIZE, MAX_PAGE_HEADER_SIZE);
      if (slice instanceof Promise)
        slice = await slice;
      assert(slice);
      const nextPage = readPageHeader(slice);
      assert(nextPage);
      currentPage = nextPage;
      if (currentPage.serialNumber === this.bitstream.serialNumber) {
        previousPages.push(currentPage);
      }
    }
    assert(currentPage.granulePosition !== -1);
    let currentSegmentIndex = null;
    let currentTimestampInSamples;
    let currentTimestampIsCorrect;
    let endPage = currentPage;
    let endSegmentIndex = 0;
    if (currentPage.headerStartPos === startPosition.startPage.headerStartPos) {
      currentTimestampInSamples = this.granulePositionToTimestampInSamples(0);
      currentTimestampIsCorrect = true;
      currentSegmentIndex = 0;
    } else {
      currentTimestampInSamples = 0;
      currentTimestampIsCorrect = false;
      for (let i = currentPage.lacingValues.length - 1;i >= 0; i--) {
        const value = currentPage.lacingValues[i];
        if (value < 255) {
          currentSegmentIndex = i + 1;
          break;
        }
      }
      if (currentSegmentIndex === null) {
        throw new Error("Invalid page with granule position: no packets end on this page.");
      }
      endSegmentIndex = currentSegmentIndex - 1;
      const pseudopacket = {
        data: PLACEHOLDER_DATA,
        endPage,
        endSegmentIndex
      };
      const nextPosition = await this.demuxer.findNextPacketStart(pseudopacket);
      if (nextPosition) {
        const endPosition = findPreviousPacketEndPosition(previousPages, currentPage, currentSegmentIndex);
        assert(endPosition);
        const startPosition2 = findPacketStartPosition(previousPages, endPosition.page, endPosition.segmentIndex);
        if (startPosition2) {
          currentPage = startPosition2.page;
          currentSegmentIndex = startPosition2.segmentIndex;
        }
      } else {
        while (true) {
          const endPosition = findPreviousPacketEndPosition(previousPages, currentPage, currentSegmentIndex);
          if (!endPosition) {
            break;
          }
          const startPosition2 = findPacketStartPosition(previousPages, endPosition.page, endPosition.segmentIndex);
          if (!startPosition2) {
            break;
          }
          currentPage = startPosition2.page;
          currentSegmentIndex = startPosition2.segmentIndex;
          if (endPosition.page.headerStartPos !== endPage.headerStartPos) {
            endPage = endPosition.page;
            endSegmentIndex = endPosition.segmentIndex;
            break;
          }
        }
      }
    }
    let lastEncodedPacket = null;
    let lastEncodedPacketMetadata = null;
    while (currentPage !== null) {
      assert(currentSegmentIndex !== null);
      const packet = await this.demuxer.readPacket(currentPage, currentSegmentIndex);
      if (!packet) {
        break;
      }
      const skipPacket = currentPage.headerStartPos === startPosition.startPage.headerStartPos && currentSegmentIndex < startPosition.startSegmentIndex;
      if (!skipPacket) {
        let encodedPacket = this.createEncodedPacketFromOggPacket(packet, {
          timestampInSamples: currentTimestampInSamples,
          vorbisLastBlocksize: lastEncodedPacketMetadata?.vorbisBlockSize ?? null
        }, options);
        assert(encodedPacket);
        let encodedPacketMetadata = this.encodedPacketToMetadata.get(encodedPacket);
        assert(encodedPacketMetadata);
        if (!currentTimestampIsCorrect && packet.endPage.headerStartPos === endPage.headerStartPos && packet.endSegmentIndex === endSegmentIndex) {
          currentTimestampInSamples = this.granulePositionToTimestampInSamples(currentPage.granulePosition);
          currentTimestampIsCorrect = true;
          encodedPacket = this.createEncodedPacketFromOggPacket(packet, {
            timestampInSamples: currentTimestampInSamples - encodedPacketMetadata.durationInSamples,
            vorbisLastBlocksize: lastEncodedPacketMetadata?.vorbisBlockSize ?? null
          }, options);
          assert(encodedPacket);
          encodedPacketMetadata = this.encodedPacketToMetadata.get(encodedPacket);
          assert(encodedPacketMetadata);
        } else {
          currentTimestampInSamples += encodedPacketMetadata.durationInSamples;
        }
        lastEncodedPacket = encodedPacket;
        lastEncodedPacketMetadata = encodedPacketMetadata;
        if (currentTimestampIsCorrect && (Math.max(currentTimestampInSamples, 0) > timestampInSamples || Math.max(encodedPacketMetadata.timestampInSamples, 0) === timestampInSamples)) {
          break;
        }
      }
      const nextPosition = await this.demuxer.findNextPacketStart(packet);
      if (!nextPosition) {
        break;
      }
      currentPage = nextPosition.startPage;
      currentSegmentIndex = nextPosition.startSegmentIndex;
    }
    return lastEncodedPacket;
  }
  async getPacketSequential(timestamp, options) {
    const release = await this.sequentialScanMutex.acquire();
    try {
      const timestampInSamples = roundIfAlmostInteger(timestamp * this.internalSampleRate);
      timestamp = timestampInSamples / this.internalSampleRate;
      const index = binarySearchLessOrEqual(this.sequentialScanCache, timestampInSamples, (x) => x.timestampInSamples);
      let currentPacket;
      if (index !== -1) {
        const cacheEntry = this.sequentialScanCache[index];
        currentPacket = this.createEncodedPacketFromOggPacket(cacheEntry.packet, {
          timestampInSamples: cacheEntry.timestampInSamples,
          vorbisLastBlocksize: cacheEntry.vorbisLastBlockSize
        }, options);
      } else {
        currentPacket = await this.getFirstPacket(options);
      }
      let i = 0;
      while (currentPacket && currentPacket.timestamp < timestamp) {
        const nextPacket = await this.getNextPacket(currentPacket, options);
        if (!nextPacket || nextPacket.timestamp > timestamp) {
          break;
        }
        currentPacket = nextPacket;
        i++;
        if (i === 100) {
          i = 0;
          const metadata = this.encodedPacketToMetadata.get(currentPacket);
          assert(metadata);
          if (this.sequentialScanCache.length > 0) {
            assert(last(this.sequentialScanCache).timestampInSamples <= metadata.timestampInSamples);
          }
          this.sequentialScanCache.push(metadata);
        }
      }
      return currentPacket;
    } finally {
      release();
    }
  }
  getKeyPacket(timestamp, options) {
    return this.getPacket(timestamp, options);
  }
  getNextKeyPacket(packet, options) {
    return this.getNextPacket(packet, options);
  }
}
var findPacketStartPosition = (pageList, endPage, endSegmentIndex) => {
  let page = endPage;
  let segmentIndex = endSegmentIndex;
  outer:
    while (true) {
      segmentIndex--;
      for (segmentIndex;segmentIndex >= 0; segmentIndex--) {
        const lacingValue = page.lacingValues[segmentIndex];
        if (lacingValue < 255) {
          segmentIndex++;
          break outer;
        }
      }
      assert(segmentIndex === -1);
      const pageStartsWithFreshPacket = !(page.headerType & 1);
      if (pageStartsWithFreshPacket) {
        segmentIndex = 0;
        break;
      }
      const previousPage = findLast(pageList, (x) => x.headerStartPos < page.headerStartPos);
      if (!previousPage) {
        return null;
      }
      page = previousPage;
      segmentIndex = page.lacingValues.length;
    }
  assert(segmentIndex !== -1);
  if (segmentIndex === page.lacingValues.length) {
    const nextPage = pageList[pageList.indexOf(page) + 1];
    assert(nextPage);
    page = nextPage;
    segmentIndex = 0;
  }
  return { page, segmentIndex };
};
var findPreviousPacketEndPosition = (pageList, startPage, startSegmentIndex) => {
  if (startSegmentIndex > 0) {
    return { page: startPage, segmentIndex: startSegmentIndex - 1 };
  }
  const previousPage = findLast(pageList, (x) => x.headerStartPos < startPage.headerStartPos);
  if (!previousPage) {
    return null;
  }
  return { page: previousPage, segmentIndex: previousPage.lacingValues.length - 1 };
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/wave/wave-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var WaveFormat;
(function(WaveFormat2) {
  WaveFormat2[WaveFormat2["PCM"] = 1] = "PCM";
  WaveFormat2[WaveFormat2["IEEE_FLOAT"] = 3] = "IEEE_FLOAT";
  WaveFormat2[WaveFormat2["ALAW"] = 6] = "ALAW";
  WaveFormat2[WaveFormat2["MULAW"] = 7] = "MULAW";
  WaveFormat2[WaveFormat2["EXTENSIBLE"] = 65534] = "EXTENSIBLE";
})(WaveFormat || (WaveFormat = {}));

class WaveDemuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.metadataPromise = null;
    this.dataStart = -1;
    this.dataSize = -1;
    this.audioInfo = null;
    this.trackBackings = [];
    this.lastKnownPacketIndex = 0;
    this.metadataTags = {};
    this.reader = input._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      let slice = this.reader.requestSlice(0, 12);
      if (slice instanceof Promise)
        slice = await slice;
      assert(slice);
      const riffType = readAscii(slice, 4);
      const littleEndian = riffType !== "RIFX";
      const isRf64 = riffType === "RF64";
      const outerChunkSize = readU32(slice, littleEndian);
      let totalFileSize = isRf64 ? this.reader.fileSize : Math.min(outerChunkSize + 8, this.reader.fileSize ?? Infinity);
      const format = readAscii(slice, 4);
      if (format !== "WAVE") {
        throw new Error("Invalid WAVE file - wrong format");
      }
      let chunksRead = 0;
      let dataChunkSize = null;
      let currentPos = slice.filePos;
      while (totalFileSize === null || currentPos < totalFileSize) {
        let slice2 = this.reader.requestSlice(currentPos, 8);
        if (slice2 instanceof Promise)
          slice2 = await slice2;
        if (!slice2)
          break;
        const chunkId = readAscii(slice2, 4);
        const chunkSize = readU32(slice2, littleEndian);
        const startPos = slice2.filePos;
        if (isRf64 && chunksRead === 0 && chunkId !== "ds64") {
          throw new Error('Invalid RF64 file: First chunk must be "ds64".');
        }
        if (chunkId === "fmt ") {
          await this.parseFmtChunk(startPos, chunkSize, littleEndian);
        } else if (chunkId === "data") {
          dataChunkSize ??= chunkSize;
          this.dataStart = slice2.filePos;
          this.dataSize = Math.min(dataChunkSize, (totalFileSize ?? Infinity) - this.dataStart);
          if (this.reader.fileSize === null) {
            break;
          }
        } else if (chunkId === "ds64") {
          let ds64Slice = this.reader.requestSlice(startPos, chunkSize);
          if (ds64Slice instanceof Promise)
            ds64Slice = await ds64Slice;
          if (!ds64Slice)
            break;
          const riffChunkSize = readU64(ds64Slice, littleEndian);
          dataChunkSize = readU64(ds64Slice, littleEndian);
          totalFileSize = Math.min(riffChunkSize + 8, this.reader.fileSize ?? Infinity);
        } else if (chunkId === "LIST") {
          await this.parseListChunk(startPos, chunkSize, littleEndian);
        } else if (chunkId === "ID3 " || chunkId === "id3 ") {
          await this.parseId3Chunk(startPos, chunkSize);
        }
        currentPos = startPos + chunkSize + (chunkSize & 1);
        chunksRead++;
      }
      if (!this.audioInfo) {
        throw new Error('Invalid WAVE file - missing "fmt " chunk');
      }
      if (this.dataStart === -1) {
        throw new Error('Invalid WAVE file - missing "data" chunk');
      }
      const blockSize = this.audioInfo.blockSizeInBytes;
      this.dataSize = Math.floor(this.dataSize / blockSize) * blockSize;
      this.trackBackings.push(new WaveAudioTrackBacking(this));
    })();
  }
  async parseFmtChunk(startPos, size, littleEndian) {
    let slice = this.reader.requestSlice(startPos, size);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return;
    let formatTag = readU16(slice, littleEndian);
    const numChannels = readU16(slice, littleEndian);
    const sampleRate = readU32(slice, littleEndian);
    slice.skip(4);
    const blockAlign = readU16(slice, littleEndian);
    let bitsPerSample;
    if (size === 14) {
      bitsPerSample = 8;
    } else {
      bitsPerSample = readU16(slice, littleEndian);
    }
    if (size >= 18 && formatTag !== 357) {
      const cbSize = readU16(slice, littleEndian);
      const remainingSize = size - 18;
      const extensionSize = Math.min(remainingSize, cbSize);
      if (extensionSize >= 22 && formatTag === WaveFormat.EXTENSIBLE) {
        slice.skip(2 + 4);
        const subFormat = readBytes(slice, 16);
        formatTag = subFormat[0] | subFormat[1] << 8;
      }
    }
    if (formatTag === WaveFormat.MULAW || formatTag === WaveFormat.ALAW) {
      bitsPerSample = 8;
    }
    this.audioInfo = {
      format: formatTag,
      numberOfChannels: numChannels,
      sampleRate,
      sampleSizeInBytes: Math.ceil(bitsPerSample / 8),
      blockSizeInBytes: blockAlign
    };
  }
  async parseListChunk(startPos, size, littleEndian) {
    let slice = this.reader.requestSlice(startPos, size);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return;
    const infoType = readAscii(slice, 4);
    if (infoType !== "INFO" && infoType !== "INF0") {
      return;
    }
    let currentPos = slice.filePos;
    while (currentPos <= startPos + size - 8) {
      slice.filePos = currentPos;
      const chunkName = readAscii(slice, 4);
      const chunkSize = readU32(slice, littleEndian);
      const bytes = readBytes(slice, chunkSize);
      let stringLength = 0;
      for (let i = 0;i < bytes.length; i++) {
        if (bytes[i] === 0) {
          break;
        }
        stringLength++;
      }
      const value = String.fromCharCode(...bytes.subarray(0, stringLength));
      this.metadataTags.raw ??= {};
      this.metadataTags.raw[chunkName] = value;
      switch (chunkName) {
        case "INAM":
        case "TITL":
          {
            this.metadataTags.title ??= value;
          }
          ;
          break;
        case "TIT3":
          {
            this.metadataTags.description ??= value;
          }
          ;
          break;
        case "IART":
          {
            this.metadataTags.artist ??= value;
          }
          ;
          break;
        case "IPRD":
          {
            this.metadataTags.album ??= value;
          }
          ;
          break;
        case "IPRT":
        case "ITRK":
        case "TRCK":
          {
            const parts = value.split("/");
            const trackNum = Number.parseInt(parts[0], 10);
            const tracksTotal = parts[1] && Number.parseInt(parts[1], 10);
            if (Number.isInteger(trackNum) && trackNum > 0) {
              this.metadataTags.trackNumber ??= trackNum;
            }
            if (tracksTotal && Number.isInteger(tracksTotal) && tracksTotal > 0) {
              this.metadataTags.tracksTotal ??= tracksTotal;
            }
          }
          ;
          break;
        case "ICRD":
        case "IDIT":
          {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
              this.metadataTags.date ??= date;
            }
          }
          ;
          break;
        case "YEAR":
          {
            const year = Number.parseInt(value, 10);
            if (Number.isInteger(year) && year > 0) {
              this.metadataTags.date ??= new Date(year, 0, 1);
            }
          }
          ;
          break;
        case "IGNR":
        case "GENR":
          {
            this.metadataTags.genre ??= value;
          }
          ;
          break;
        case "ICMT":
        case "CMNT":
        case "COMM":
          {
            this.metadataTags.comment ??= value;
          }
          ;
          break;
      }
      currentPos += 8 + chunkSize + (chunkSize & 1);
    }
  }
  async parseId3Chunk(startPos, size) {
    let slice = this.reader.requestSlice(startPos, size);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return;
    const id3V2Header = readId3V2Header(slice);
    if (id3V2Header) {
      const availableSize = size - ID3_V2_HEADER_SIZE;
      id3V2Header.size = Math.min(id3V2Header.size, availableSize);
      if (id3V2Header.size > 0) {
        const contentSlice = slice.slice(startPos + ID3_V2_HEADER_SIZE, id3V2Header.size);
        parseId3V2Tag(contentSlice, id3V2Header, this.metadataTags);
      }
    }
  }
  getCodec() {
    assert(this.audioInfo);
    if (this.audioInfo.format === WaveFormat.MULAW) {
      return "ulaw";
    }
    if (this.audioInfo.format === WaveFormat.ALAW) {
      return "alaw";
    }
    if (this.audioInfo.format === WaveFormat.PCM) {
      if (this.audioInfo.sampleSizeInBytes === 1) {
        return "pcm-u8";
      } else if (this.audioInfo.sampleSizeInBytes === 2) {
        return "pcm-s16";
      } else if (this.audioInfo.sampleSizeInBytes === 3) {
        return "pcm-s24";
      } else if (this.audioInfo.sampleSizeInBytes === 4) {
        return "pcm-s32";
      }
    }
    if (this.audioInfo.format === WaveFormat.IEEE_FLOAT) {
      if (this.audioInfo.sampleSizeInBytes === 4) {
        return "pcm-f32";
      }
    }
    return null;
  }
  async getMimeType() {
    return "audio/wav";
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackings;
  }
  async getMetadataTags() {
    await this.readMetadata();
    return this.metadataTags;
  }
}
var PACKET_SIZE_IN_FRAMES = 2048;

class WaveAudioTrackBacking {
  constructor(demuxer) {
    this.demuxer = demuxer;
  }
  getType() {
    return "audio";
  }
  getId() {
    return 1;
  }
  getNumber() {
    return 1;
  }
  getCodec() {
    return this.demuxer.getCodec();
  }
  getInternalCodecId() {
    assert(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.format;
  }
  async getDecoderConfig() {
    const codec = this.demuxer.getCodec();
    if (!codec) {
      return null;
    }
    assert(this.demuxer.audioInfo);
    return {
      codec,
      numberOfChannels: this.demuxer.audioInfo.numberOfChannels,
      sampleRate: this.demuxer.audioInfo.sampleRate
    };
  }
  getNumberOfChannels() {
    assert(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.numberOfChannels;
  }
  getSampleRate() {
    assert(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.sampleRate;
  }
  getTimeResolution() {
    assert(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.sampleRate;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    assert(this.demuxer.dataSize !== -1);
    return this.demuxer.dataSize / this.demuxer.audioInfo.blockSizeInBytes / this.demuxer.audioInfo.sampleRate;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return UNDETERMINED_LANGUAGE;
  }
  getDisposition() {
    return {
      ...DEFAULT_TRACK_DISPOSITION
    };
  }
  async getPacketAtIndex(packetIndex, options) {
    assert(packetIndex >= 0);
    assert(this.demuxer.audioInfo);
    const startOffset = packetIndex * PACKET_SIZE_IN_FRAMES * this.demuxer.audioInfo.blockSizeInBytes;
    if (startOffset >= this.demuxer.dataSize) {
      return null;
    }
    const sizeInBytes = Math.min(PACKET_SIZE_IN_FRAMES * this.demuxer.audioInfo.blockSizeInBytes, this.demuxer.dataSize - startOffset);
    if (this.demuxer.reader.fileSize === null) {
      let slice = this.demuxer.reader.requestSlice(this.demuxer.dataStart + startOffset, sizeInBytes);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice) {
        return null;
      }
    }
    let data;
    if (options.metadataOnly) {
      data = PLACEHOLDER_DATA;
    } else {
      let slice = this.demuxer.reader.requestSlice(this.demuxer.dataStart + startOffset, sizeInBytes);
      if (slice instanceof Promise)
        slice = await slice;
      assert(slice);
      data = readBytes(slice, sizeInBytes);
    }
    const timestamp = packetIndex * PACKET_SIZE_IN_FRAMES / this.demuxer.audioInfo.sampleRate;
    const duration = sizeInBytes / this.demuxer.audioInfo.blockSizeInBytes / this.demuxer.audioInfo.sampleRate;
    this.demuxer.lastKnownPacketIndex = Math.max(packetIndex, this.demuxer.lastKnownPacketIndex);
    return new EncodedPacket(data, "key", timestamp, duration, packetIndex, sizeInBytes);
  }
  getFirstPacket(options) {
    return this.getPacketAtIndex(0, options);
  }
  async getPacket(timestamp, options) {
    assert(this.demuxer.audioInfo);
    const packetIndex = Math.floor(Math.min(timestamp * this.demuxer.audioInfo.sampleRate / PACKET_SIZE_IN_FRAMES, (this.demuxer.dataSize - 1) / (PACKET_SIZE_IN_FRAMES * this.demuxer.audioInfo.blockSizeInBytes)));
    if (packetIndex < 0) {
      return null;
    }
    const packet = await this.getPacketAtIndex(packetIndex, options);
    if (packet) {
      return packet;
    }
    if (packetIndex === 0) {
      return null;
    }
    assert(this.demuxer.reader.fileSize === null);
    let currentPacket = await this.getPacketAtIndex(this.demuxer.lastKnownPacketIndex, options);
    while (currentPacket) {
      const nextPacket = await this.getNextPacket(currentPacket, options);
      if (!nextPacket) {
        break;
      }
      currentPacket = nextPacket;
    }
    return currentPacket;
  }
  getNextPacket(packet, options) {
    assert(this.demuxer.audioInfo);
    const packetIndex = Math.round(packet.timestamp * this.demuxer.audioInfo.sampleRate / PACKET_SIZE_IN_FRAMES);
    return this.getPacketAtIndex(packetIndex + 1, options);
  }
  getKeyPacket(timestamp, options) {
    return this.getPacket(timestamp, options);
  }
  getNextKeyPacket(packet, options) {
    return this.getNextPacket(packet, options);
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/adts/adts-reader.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var MIN_ADTS_FRAME_HEADER_SIZE = 7;
var MAX_ADTS_FRAME_HEADER_SIZE = 9;
var readAdtsFrameHeader = (slice) => {
  const startPos = slice.filePos;
  const bytes = readBytes(slice, 9);
  const bitstream = new Bitstream(bytes);
  const syncword = bitstream.readBits(12);
  if (syncword !== 4095) {
    return null;
  }
  bitstream.skipBits(1);
  const layer = bitstream.readBits(2);
  if (layer !== 0) {
    return null;
  }
  const protectionAbsence = bitstream.readBits(1);
  const objectType = bitstream.readBits(2) + 1;
  const samplingFrequencyIndex = bitstream.readBits(4);
  if (samplingFrequencyIndex === 15) {
    return null;
  }
  bitstream.skipBits(1);
  const channelConfiguration = bitstream.readBits(3);
  if (channelConfiguration === 0) {
    throw new Error("ADTS frames with channel configuration 0 are not supported.");
  }
  bitstream.skipBits(1);
  bitstream.skipBits(1);
  bitstream.skipBits(1);
  bitstream.skipBits(1);
  const frameLength = bitstream.readBits(13);
  bitstream.skipBits(11);
  const numberOfAacFrames = bitstream.readBits(2) + 1;
  if (numberOfAacFrames !== 1) {
    throw new Error("ADTS frames with more than one AAC frame are not supported.");
  }
  let crcCheck = null;
  if (protectionAbsence === 1) {
    slice.filePos -= 2;
  } else {
    crcCheck = bitstream.readBits(16);
  }
  return {
    objectType,
    samplingFrequencyIndex,
    channelConfiguration,
    frameLength,
    numberOfAacFrames,
    crcCheck,
    startPos
  };
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/adts/adts-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var SAMPLES_PER_AAC_FRAME = 1024;

class AdtsDemuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.metadataPromise = null;
    this.firstFrameHeader = null;
    this.loadedSamples = [];
    this.metadataTags = null;
    this.trackBackings = [];
    this.readingMutex = new AsyncMutex;
    this.lastSampleLoaded = false;
    this.lastLoadedPos = 0;
    this.nextTimestampInSamples = 0;
    this.reader = input._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      while (!this.firstFrameHeader && !this.lastSampleLoaded) {
        await this.advanceReader();
      }
      assert(this.firstFrameHeader);
      this.trackBackings = [new AdtsAudioTrackBacking(this)];
    })();
  }
  async advanceReader() {
    if (this.lastLoadedPos === 0) {
      while (true) {
        let slice2 = this.reader.requestSlice(this.lastLoadedPos, ID3_V2_HEADER_SIZE);
        if (slice2 instanceof Promise)
          slice2 = await slice2;
        if (!slice2) {
          this.lastSampleLoaded = true;
          return;
        }
        const id3V2Header = readId3V2Header(slice2);
        if (!id3V2Header) {
          break;
        }
        this.lastLoadedPos = slice2.filePos + id3V2Header.size;
      }
    }
    let slice = this.reader.requestSliceRange(this.lastLoadedPos, MIN_ADTS_FRAME_HEADER_SIZE, MAX_ADTS_FRAME_HEADER_SIZE);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice) {
      this.lastSampleLoaded = true;
      return;
    }
    const header = readAdtsFrameHeader(slice);
    if (!header) {
      this.lastSampleLoaded = true;
      return;
    }
    if (this.reader.fileSize !== null && header.startPos + header.frameLength > this.reader.fileSize) {
      this.lastSampleLoaded = true;
      return;
    }
    if (!this.firstFrameHeader) {
      this.firstFrameHeader = header;
    }
    const sampleRate = aacFrequencyTable[header.samplingFrequencyIndex];
    assert(sampleRate !== undefined);
    const sampleDuration = SAMPLES_PER_AAC_FRAME / sampleRate;
    const sample = {
      timestamp: this.nextTimestampInSamples / sampleRate,
      duration: sampleDuration,
      dataStart: header.startPos,
      dataSize: header.frameLength
    };
    this.loadedSamples.push(sample);
    this.nextTimestampInSamples += SAMPLES_PER_AAC_FRAME;
    this.lastLoadedPos = header.startPos + header.frameLength;
  }
  async getMimeType() {
    return "audio/aac";
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackings;
  }
  async getMetadataTags() {
    const release = await this.readingMutex.acquire();
    try {
      await this.readMetadata();
      if (this.metadataTags) {
        return this.metadataTags;
      }
      this.metadataTags = {};
      let currentPos = 0;
      while (true) {
        let headerSlice = this.reader.requestSlice(currentPos, ID3_V2_HEADER_SIZE);
        if (headerSlice instanceof Promise)
          headerSlice = await headerSlice;
        if (!headerSlice)
          break;
        const id3V2Header = readId3V2Header(headerSlice);
        if (!id3V2Header) {
          break;
        }
        let contentSlice = this.reader.requestSlice(headerSlice.filePos, id3V2Header.size);
        if (contentSlice instanceof Promise)
          contentSlice = await contentSlice;
        if (!contentSlice)
          break;
        parseId3V2Tag(contentSlice, id3V2Header, this.metadataTags);
        currentPos = headerSlice.filePos + id3V2Header.size;
      }
      return this.metadataTags;
    } finally {
      release();
    }
  }
}

class AdtsAudioTrackBacking {
  constructor(demuxer) {
    this.demuxer = demuxer;
  }
  getType() {
    return "audio";
  }
  getId() {
    return 1;
  }
  getNumber() {
    return 1;
  }
  getTimeResolution() {
    const sampleRate = this.getSampleRate();
    return sampleRate / SAMPLES_PER_AAC_FRAME;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    return null;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return UNDETERMINED_LANGUAGE;
  }
  getCodec() {
    return "aac";
  }
  getInternalCodecId() {
    assert(this.demuxer.firstFrameHeader);
    return this.demuxer.firstFrameHeader.objectType;
  }
  getNumberOfChannels() {
    assert(this.demuxer.firstFrameHeader);
    const numberOfChannels = aacChannelMap[this.demuxer.firstFrameHeader.channelConfiguration];
    assert(numberOfChannels !== undefined);
    return numberOfChannels;
  }
  getSampleRate() {
    assert(this.demuxer.firstFrameHeader);
    const sampleRate = aacFrequencyTable[this.demuxer.firstFrameHeader.samplingFrequencyIndex];
    assert(sampleRate !== undefined);
    return sampleRate;
  }
  getDisposition() {
    return {
      ...DEFAULT_TRACK_DISPOSITION
    };
  }
  async getDecoderConfig() {
    assert(this.demuxer.firstFrameHeader);
    return {
      codec: `mp4a.40.${this.demuxer.firstFrameHeader.objectType}`,
      numberOfChannels: this.getNumberOfChannels(),
      sampleRate: this.getSampleRate()
    };
  }
  async getPacketAtIndex(sampleIndex, options) {
    if (sampleIndex === -1) {
      return null;
    }
    const rawSample = this.demuxer.loadedSamples[sampleIndex];
    if (!rawSample) {
      return null;
    }
    let data;
    if (options.metadataOnly) {
      data = PLACEHOLDER_DATA;
    } else {
      let slice = this.demuxer.reader.requestSlice(rawSample.dataStart, rawSample.dataSize);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice) {
        return null;
      }
      data = readBytes(slice, rawSample.dataSize);
    }
    return new EncodedPacket(data, "key", rawSample.timestamp, rawSample.duration, sampleIndex, rawSample.dataSize);
  }
  getFirstPacket(options) {
    return this.getPacketAtIndex(0, options);
  }
  async getNextPacket(packet, options) {
    const release = await this.demuxer.readingMutex.acquire();
    try {
      const sampleIndex = binarySearchExact(this.demuxer.loadedSamples, packet.timestamp, (x) => x.timestamp);
      if (sampleIndex === -1) {
        throw new Error("Packet was not created from this track.");
      }
      const nextIndex = sampleIndex + 1;
      while (nextIndex >= this.demuxer.loadedSamples.length && !this.demuxer.lastSampleLoaded) {
        await this.demuxer.advanceReader();
      }
      return this.getPacketAtIndex(nextIndex, options);
    } finally {
      release();
    }
  }
  async getPacket(timestamp, options) {
    const release = await this.demuxer.readingMutex.acquire();
    try {
      while (true) {
        const index = binarySearchLessOrEqual(this.demuxer.loadedSamples, timestamp, (x) => x.timestamp);
        if (index === -1 && this.demuxer.loadedSamples.length > 0) {
          return null;
        }
        if (this.demuxer.lastSampleLoaded) {
          return this.getPacketAtIndex(index, options);
        }
        if (index >= 0 && index + 1 < this.demuxer.loadedSamples.length) {
          return this.getPacketAtIndex(index, options);
        }
        await this.demuxer.advanceReader();
      }
    } finally {
      release();
    }
  }
  getKeyPacket(timestamp, options) {
    return this.getPacket(timestamp, options);
  }
  getNextKeyPacket(packet, options) {
    return this.getNextPacket(packet, options);
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/flac/flac-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var getBlockSizeOrUncommon = (bits) => {
  if (bits === 0) {
    return null;
  } else if (bits === 1) {
    return 192;
  } else if (bits >= 2 && bits <= 5) {
    return 144 * 2 ** bits;
  } else if (bits === 6) {
    return "uncommon-u8";
  } else if (bits === 7) {
    return "uncommon-u16";
  } else if (bits >= 8 && bits <= 15) {
    return 2 ** bits;
  } else {
    return null;
  }
};
var getSampleRateOrUncommon = (sampleRateBits, streamInfoSampleRate) => {
  switch (sampleRateBits) {
    case 0:
      return streamInfoSampleRate;
    case 1:
      return 88200;
    case 2:
      return 176400;
    case 3:
      return 192000;
    case 4:
      return 8000;
    case 5:
      return 16000;
    case 6:
      return 22050;
    case 7:
      return 24000;
    case 8:
      return 32000;
    case 9:
      return 44100;
    case 10:
      return 48000;
    case 11:
      return 96000;
    case 12:
      return "uncommon-u8";
    case 13:
      return "uncommon-u16";
    case 14:
      return "uncommon-u16-10";
    default:
      return null;
  }
};
var readCodedNumber = (fileSlice) => {
  let ones = 0;
  const bitstream1 = new Bitstream(readBytes(fileSlice, 1));
  while (bitstream1.readBits(1) === 1) {
    ones++;
  }
  if (ones === 0) {
    return bitstream1.readBits(7);
  }
  const bitArray = [];
  const extraBytes = ones - 1;
  const bitstream2 = new Bitstream(readBytes(fileSlice, extraBytes));
  const firstByteBits = 8 - ones - 1;
  for (let i = 0;i < firstByteBits; i++) {
    bitArray.unshift(bitstream1.readBits(1));
  }
  for (let i = 0;i < extraBytes; i++) {
    for (let j = 0;j < 8; j++) {
      const val = bitstream2.readBits(1);
      if (j < 2) {
        continue;
      }
      bitArray.unshift(val);
    }
  }
  const encoded = bitArray.reduce((acc, bit, index) => {
    return acc | bit << index;
  }, 0);
  return encoded;
};
var readBlockSize = (slice, blockSizeBits) => {
  if (blockSizeBits === "uncommon-u16") {
    return readU16Be(slice) + 1;
  } else if (blockSizeBits === "uncommon-u8") {
    return readU8(slice) + 1;
  } else if (typeof blockSizeBits === "number") {
    return blockSizeBits;
  } else {
    assertNever(blockSizeBits);
    assert(false);
  }
};
var readSampleRate = (slice, sampleRateOrUncommon) => {
  if (sampleRateOrUncommon === "uncommon-u16") {
    return readU16Be(slice);
  }
  if (sampleRateOrUncommon === "uncommon-u16-10") {
    return readU16Be(slice) * 10;
  }
  if (sampleRateOrUncommon === "uncommon-u8") {
    return readU8(slice);
  }
  if (typeof sampleRateOrUncommon === "number") {
    return sampleRateOrUncommon;
  }
  return null;
};
var calculateCrc8 = (data) => {
  const polynomial = 7;
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0;i < 8; i++) {
      if ((crc & 128) !== 0) {
        crc = crc << 1 ^ polynomial;
      } else {
        crc <<= 1;
      }
      crc &= 255;
    }
  }
  return crc;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/flac/flac-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class FlacDemuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.loadedSamples = [];
    this.metadataPromise = null;
    this.trackBacking = null;
    this.metadataTags = {};
    this.audioInfo = null;
    this.lastLoadedPos = null;
    this.blockingBit = null;
    this.readingMutex = new AsyncMutex;
    this.lastSampleLoaded = false;
    this.reader = input._reader;
  }
  async getMetadataTags() {
    await this.readMetadata();
    return this.metadataTags;
  }
  async getTrackBackings() {
    await this.readMetadata();
    assert(this.trackBacking);
    return [this.trackBacking];
  }
  async getMimeType() {
    return "audio/flac";
  }
  async readMetadata() {
    let currentPos = 4;
    return this.metadataPromise ??= (async () => {
      while (this.reader.fileSize === null || currentPos < this.reader.fileSize) {
        let sizeSlice = this.reader.requestSlice(currentPos, 4);
        if (sizeSlice instanceof Promise)
          sizeSlice = await sizeSlice;
        currentPos += 4;
        if (sizeSlice === null) {
          throw new Error(`Metadata block at position ${currentPos} is too small! Corrupted file.`);
        }
        assert(sizeSlice);
        const byte = readU8(sizeSlice);
        const size = readU24Be(sizeSlice);
        const isLastMetadata = (byte & 128) !== 0;
        const metaBlockType = byte & 127;
        switch (metaBlockType) {
          case FlacBlockType.STREAMINFO: {
            let streamInfoBlock = this.reader.requestSlice(currentPos, size);
            if (streamInfoBlock instanceof Promise)
              streamInfoBlock = await streamInfoBlock;
            assert(streamInfoBlock);
            if (streamInfoBlock === null) {
              throw new Error(`StreamInfo block at position ${currentPos} is too small! Corrupted file.`);
            }
            const streamInfoBytes = readBytes(streamInfoBlock, 34);
            const bitstream = new Bitstream(streamInfoBytes);
            const minimumBlockSize = bitstream.readBits(16);
            const maximumBlockSize = bitstream.readBits(16);
            const minimumFrameSize = bitstream.readBits(24);
            const maximumFrameSize = bitstream.readBits(24);
            const sampleRate = bitstream.readBits(20);
            const numberOfChannels = bitstream.readBits(3) + 1;
            bitstream.readBits(5);
            const totalSamples = bitstream.readBits(36);
            bitstream.skipBits(16 * 8);
            const description = new Uint8Array(42);
            description.set(new Uint8Array([102, 76, 97, 67]), 0);
            description.set(new Uint8Array([128, 0, 0, 34]), 4);
            description.set(streamInfoBytes, 8);
            this.audioInfo = {
              numberOfChannels,
              sampleRate,
              totalSamples,
              minimumBlockSize,
              maximumBlockSize,
              minimumFrameSize,
              maximumFrameSize,
              description
            };
            this.trackBacking = new FlacAudioTrackBacking(this);
            break;
          }
          case FlacBlockType.VORBIS_COMMENT: {
            let vorbisCommentBlock = this.reader.requestSlice(currentPos, size);
            if (vorbisCommentBlock instanceof Promise)
              vorbisCommentBlock = await vorbisCommentBlock;
            assert(vorbisCommentBlock);
            readVorbisComments(readBytes(vorbisCommentBlock, size), this.metadataTags);
            break;
          }
          case FlacBlockType.PICTURE: {
            let pictureBlock = this.reader.requestSlice(currentPos, size);
            if (pictureBlock instanceof Promise)
              pictureBlock = await pictureBlock;
            assert(pictureBlock);
            const pictureType = readU32Be(pictureBlock);
            const mediaTypeLength = readU32Be(pictureBlock);
            const mediaType = textDecoder.decode(readBytes(pictureBlock, mediaTypeLength));
            const descriptionLength = readU32Be(pictureBlock);
            const description = textDecoder.decode(readBytes(pictureBlock, descriptionLength));
            pictureBlock.skip(4 + 4 + 4 + 4);
            const dataLength = readU32Be(pictureBlock);
            const data = readBytes(pictureBlock, dataLength);
            this.metadataTags.images ??= [];
            this.metadataTags.images.push({
              data,
              mimeType: mediaType,
              kind: pictureType === 3 ? "coverFront" : pictureType === 4 ? "coverBack" : "unknown",
              description
            });
            break;
          }
          default:
            break;
        }
        currentPos += size;
        if (isLastMetadata) {
          this.lastLoadedPos = currentPos;
          break;
        }
      }
      if (!this.audioInfo) {
        throw new Error("Missing STREAMINFO metadata block! Corrupted FLAC file.");
      }
    })();
  }
  async readNextFlacFrame({ startPos, isFirstPacket }) {
    assert(this.audioInfo);
    const minimumHeaderLength = 6;
    const maximumHeaderLength = 16;
    const minimumFrameLength = 10;
    const maximumFrameLength = this.audioInfo.maximumBlockSize * this.audioInfo.numberOfChannels * 4 + maximumHeaderLength + 2;
    const effectiveMinFrameSize = this.audioInfo.minimumFrameSize || minimumFrameLength;
    const effectiveMaxFrameSize = this.audioInfo.maximumFrameSize || maximumFrameLength;
    const maximumSliceLength = effectiveMaxFrameSize + maximumHeaderLength;
    const slice = await this.reader.requestSliceRange(startPos, maximumHeaderLength, maximumSliceLength);
    if (!slice) {
      return null;
    }
    const frameHeader = this.readFlacFrameHeader({
      slice,
      isFirstPacket
    });
    if (!frameHeader) {
      return null;
    }
    slice.filePos = startPos + effectiveMinFrameSize;
    while (true) {
      if (slice.filePos > slice.end - minimumHeaderLength) {
        return {
          num: frameHeader.num,
          blockSize: frameHeader.blockSize,
          sampleRate: frameHeader.sampleRate,
          size: slice.end - startPos,
          isLastFrame: true
        };
      }
      const nextByte = readU8(slice);
      if (nextByte === 255) {
        const positionBeforeReading = slice.filePos;
        const byteAfterNextByte = readU8(slice);
        const expected = this.blockingBit === 1 ? 249 : 248;
        if (byteAfterNextByte !== expected) {
          slice.filePos = positionBeforeReading;
          continue;
        }
        slice.skip(-2);
        const lengthIfNextFlacFrameHeaderIsLegit = slice.filePos - startPos;
        const nextFrameHeader = this.readFlacFrameHeader({
          slice,
          isFirstPacket: false
        });
        if (!nextFrameHeader) {
          slice.filePos = positionBeforeReading;
          continue;
        }
        if (this.blockingBit === 0) {
          if (nextFrameHeader.num - frameHeader.num !== 1) {
            slice.filePos = positionBeforeReading;
            continue;
          }
        } else {
          if (nextFrameHeader.num - frameHeader.num !== frameHeader.blockSize) {
            slice.filePos = positionBeforeReading;
            continue;
          }
        }
        return {
          num: frameHeader.num,
          blockSize: frameHeader.blockSize,
          sampleRate: frameHeader.sampleRate,
          size: lengthIfNextFlacFrameHeaderIsLegit,
          isLastFrame: false
        };
      }
    }
  }
  readFlacFrameHeader({ slice, isFirstPacket }) {
    const startOffset = slice.filePos;
    const bytes = readBytes(slice, 4);
    const bitstream = new Bitstream(bytes);
    const bits = bitstream.readBits(15);
    if (bits !== 32764) {
      return null;
    }
    if (this.blockingBit === null) {
      assert(isFirstPacket);
      const newBlockingBit = bitstream.readBits(1);
      this.blockingBit = newBlockingBit;
    } else if (this.blockingBit === 1) {
      assert(!isFirstPacket);
      const newBlockingBit = bitstream.readBits(1);
      if (newBlockingBit !== 1) {
        return null;
      }
    } else if (this.blockingBit === 0) {
      assert(!isFirstPacket);
      const newBlockingBit = bitstream.readBits(1);
      if (newBlockingBit !== 0) {
        return null;
      }
    } else {
      throw new Error("Invalid blocking bit");
    }
    const blockSizeOrUncommon = getBlockSizeOrUncommon(bitstream.readBits(4));
    if (!blockSizeOrUncommon) {
      return null;
    }
    assert(this.audioInfo);
    const sampleRateOrUncommon = getSampleRateOrUncommon(bitstream.readBits(4), this.audioInfo.sampleRate);
    if (!sampleRateOrUncommon) {
      return null;
    }
    bitstream.readBits(4);
    bitstream.readBits(3);
    const reservedZero = bitstream.readBits(1);
    if (reservedZero !== 0) {
      return null;
    }
    const num = readCodedNumber(slice);
    const blockSize = readBlockSize(slice, blockSizeOrUncommon);
    const sampleRate = readSampleRate(slice, sampleRateOrUncommon);
    if (sampleRate === null) {
      return null;
    }
    if (sampleRate !== this.audioInfo.sampleRate) {
      return null;
    }
    const size = slice.filePos - startOffset;
    const crc = readU8(slice);
    slice.skip(-size);
    slice.skip(-1);
    const crcCalculated = calculateCrc8(readBytes(slice, size));
    if (crc !== crcCalculated) {
      return null;
    }
    return { num, blockSize, sampleRate };
  }
  async advanceReader() {
    await this.readMetadata();
    assert(this.lastLoadedPos !== null);
    assert(this.audioInfo);
    const startPos = this.lastLoadedPos;
    const frame = await this.readNextFlacFrame({
      startPos,
      isFirstPacket: this.loadedSamples.length === 0
    });
    if (!frame) {
      this.lastSampleLoaded = true;
      return;
    }
    const lastSample = this.loadedSamples[this.loadedSamples.length - 1];
    const blockOffset = lastSample ? lastSample.blockOffset + lastSample.blockSize : 0;
    const sample = {
      blockOffset,
      blockSize: frame.blockSize,
      byteOffset: startPos,
      byteSize: frame.size
    };
    this.lastLoadedPos = this.lastLoadedPos + frame.size;
    this.loadedSamples.push(sample);
    if (frame.isLastFrame) {
      this.lastSampleLoaded = true;
      return;
    }
  }
}

class FlacAudioTrackBacking {
  constructor(demuxer) {
    this.demuxer = demuxer;
  }
  getType() {
    return "audio";
  }
  getId() {
    return 1;
  }
  getNumber() {
    return 1;
  }
  getCodec() {
    return "flac";
  }
  getInternalCodecId() {
    return null;
  }
  getNumberOfChannels() {
    assert(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.numberOfChannels;
  }
  getSampleRate() {
    assert(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.sampleRate;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return UNDETERMINED_LANGUAGE;
  }
  getTimeResolution() {
    assert(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.sampleRate;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    assert(this.demuxer.audioInfo);
    if (this.demuxer.audioInfo.totalSamples === 0) {
      return null;
    }
    return this.demuxer.audioInfo.totalSamples / this.demuxer.audioInfo.sampleRate;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getDisposition() {
    return {
      ...DEFAULT_TRACK_DISPOSITION
    };
  }
  async getDecoderConfig() {
    assert(this.demuxer.audioInfo);
    return {
      codec: "flac",
      numberOfChannels: this.demuxer.audioInfo.numberOfChannels,
      sampleRate: this.demuxer.audioInfo.sampleRate,
      description: this.demuxer.audioInfo.description
    };
  }
  async getPacket(timestamp, options) {
    assert(this.demuxer.audioInfo);
    if (timestamp < 0) {
      return null;
    }
    const release = await this.demuxer.readingMutex.acquire();
    try {
      while (true) {
        const packetIndex = binarySearchLessOrEqual(this.demuxer.loadedSamples, timestamp, (x) => x.blockOffset / this.demuxer.audioInfo.sampleRate);
        if (packetIndex === -1) {
          await this.demuxer.advanceReader();
          continue;
        }
        const packet = this.demuxer.loadedSamples[packetIndex];
        const sampleTimestamp = packet.blockOffset / this.demuxer.audioInfo.sampleRate;
        const sampleDuration = packet.blockSize / this.demuxer.audioInfo.sampleRate;
        if (sampleTimestamp + sampleDuration <= timestamp) {
          if (this.demuxer.lastSampleLoaded) {
            return this.getPacketAtIndex(this.demuxer.loadedSamples.length - 1, options);
          }
          await this.demuxer.advanceReader();
          continue;
        }
        return this.getPacketAtIndex(packetIndex, options);
      }
    } finally {
      release();
    }
  }
  async getNextPacket(packet, options) {
    const release = await this.demuxer.readingMutex.acquire();
    try {
      const nextIndex = packet.sequenceNumber + 1;
      if (this.demuxer.lastSampleLoaded && nextIndex >= this.demuxer.loadedSamples.length) {
        return null;
      }
      while (nextIndex >= this.demuxer.loadedSamples.length && !this.demuxer.lastSampleLoaded) {
        await this.demuxer.advanceReader();
      }
      return this.getPacketAtIndex(nextIndex, options);
    } finally {
      release();
    }
  }
  getKeyPacket(timestamp, options) {
    return this.getPacket(timestamp, options);
  }
  getNextKeyPacket(packet, options) {
    return this.getNextPacket(packet, options);
  }
  async getPacketAtIndex(sampleIndex, options) {
    const rawSample = this.demuxer.loadedSamples[sampleIndex];
    if (!rawSample) {
      return null;
    }
    let data;
    if (options.metadataOnly) {
      data = PLACEHOLDER_DATA;
    } else {
      let slice = this.demuxer.reader.requestSlice(rawSample.byteOffset, rawSample.byteSize);
      if (slice instanceof Promise)
        slice = await slice;
      if (!slice) {
        return null;
      }
      data = readBytes(slice, rawSample.byteSize);
    }
    assert(this.demuxer.audioInfo);
    const timestamp = rawSample.blockOffset / this.demuxer.audioInfo.sampleRate;
    const duration = rawSample.blockSize / this.demuxer.audioInfo.sampleRate;
    return new EncodedPacket(data, "key", timestamp, duration, sampleIndex, rawSample.byteSize);
  }
  async getFirstPacket(options) {
    while (this.demuxer.loadedSamples.length === 0 && !this.demuxer.lastSampleLoaded) {
      await this.demuxer.advanceReader();
    }
    return this.getPacketAtIndex(0, options);
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/mpeg-ts/mpeg-ts-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var TIMESCALE = 90000;
var TS_PACKET_SIZE = 188;
var buildMpegTsMimeType = (codecStrings) => {
  let string = "video/MP2T";
  const uniqueCodecStrings = [...new Set(codecStrings.filter(Boolean))];
  if (uniqueCodecStrings.length > 0) {
    string += `; codecs="${uniqueCodecStrings.join(", ")}"`;
  }
  return string;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/mpeg-ts/mpeg-ts-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var MISSING_PTS_ERROR_MESSAGE = "PES packet is missing PTS where it was expected. PES packets without PTS are not" + " currently supported. If you think this file should be supported, please report it.";
var ignoredStreamTypes = new Set;

class MpegTsDemuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.metadataPromise = null;
    this.elementaryStreams = [];
    this.trackBackingEntries = [];
    this.packetOffset = 0;
    this.packetStride = -1;
    this.sectionEndPositions = [];
    this.seekChunkSize = 5 * 1024 * 1024;
    this.minReferencePointByteDistance = -1;
    this.reader = input._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      const lengthToCheck = TS_PACKET_SIZE + 16 + 1;
      let startingSlice = this.reader.requestSlice(0, lengthToCheck);
      if (startingSlice instanceof Promise)
        startingSlice = await startingSlice;
      assert(startingSlice);
      const startingBytes = readBytes(startingSlice, lengthToCheck);
      if (startingBytes[0] === 71 && startingBytes[TS_PACKET_SIZE] === 71) {
        this.packetOffset = 0;
        this.packetStride = TS_PACKET_SIZE;
      } else if (startingBytes[0] === 71 && startingBytes[TS_PACKET_SIZE + 16] === 71) {
        this.packetOffset = 0;
        this.packetStride = TS_PACKET_SIZE + 16;
      } else if (startingBytes[4] === 71 && startingBytes[4 + TS_PACKET_SIZE + 4] === 71) {
        this.packetOffset = 4;
        this.packetStride = TS_PACKET_SIZE + 4;
      } else {
        throw new Error("Unreachable.");
      }
      const MIN_REFERENCE_POINT_PACKET_DISTANCE = 256;
      this.minReferencePointByteDistance = MIN_REFERENCE_POINT_PACKET_DISTANCE * this.packetStride;
      let currentPos = this.packetOffset;
      let programMapPid = null;
      let hasProgramAssociationTable = false;
      let hasProgramMap = false;
      while (true) {
        const packetHeader = await this.readPacketHeader(currentPos);
        if (!packetHeader) {
          break;
        }
        if (packetHeader.payloadUnitStartIndicator === 0) {
          currentPos += this.packetStride;
          continue;
        }
        const section = await this.readSection(currentPos, true, !hasProgramMap);
        if (!section) {
          break;
        }
        const BYTES_BEFORE_SECTION_LENGTH = 3;
        const BITS_IN_CRC_32 = 32;
        let isProbablyProgramMap = false;
        if (!hasProgramMap && section.pid !== 0) {
          const isPesPacket = section.payload[0] === 0 && section.payload[1] === 0 && section.payload[2] === 1;
          if (!isPesPacket) {
            const bitstream = new Bitstream(section.payload);
            const pointerField = bitstream.readAlignedByte();
            bitstream.skipBits(8 * pointerField);
            const tableId = bitstream.readBits(8);
            isProbablyProgramMap = tableId === 2;
          }
        }
        if (section.pid === 0 && !hasProgramAssociationTable) {
          const bitstream = new Bitstream(section.payload);
          const pointerField = bitstream.readAlignedByte();
          bitstream.skipBits(8 * pointerField);
          bitstream.skipBits(14);
          const sectionLength = bitstream.readBits(10);
          bitstream.skipBits(40);
          while (8 * (sectionLength + BYTES_BEFORE_SECTION_LENGTH) - bitstream.pos > BITS_IN_CRC_32) {
            const programNumber = bitstream.readBits(16);
            bitstream.skipBits(3);
            const id = bitstream.readBits(13);
            if (programNumber !== 0) {
              if (programMapPid !== null) {
                throw new Error("Only files with a single program are supported.");
              } else {
                programMapPid = id;
              }
            }
          }
          if (programMapPid === null) {
            throw new Error("Program Association Table must link to a Program Map Table.");
          }
          hasProgramAssociationTable = true;
        } else if ((section.pid === programMapPid || isProbablyProgramMap) && !hasProgramMap) {
          const bitstream = new Bitstream(section.payload);
          const pointerField = bitstream.readAlignedByte();
          bitstream.skipBits(8 * pointerField);
          bitstream.skipBits(12);
          const sectionLength = bitstream.readBits(12);
          bitstream.skipBits(43);
          const pcrPid = bitstream.readBits(13);
          bitstream.skipBits(6);
          const programInfoLength = bitstream.readBits(10);
          bitstream.skipBits(8 * programInfoLength);
          while (8 * (sectionLength + BYTES_BEFORE_SECTION_LENGTH) - bitstream.pos > BITS_IN_CRC_32) {
            const streamType = bitstream.readBits(8);
            bitstream.skipBits(3);
            const elementaryPid = bitstream.readBits(13);
            bitstream.skipBits(6);
            const esInfoLength = bitstream.readBits(10);
            const esInfoEndPos = bitstream.pos + 8 * esInfoLength;
            let hasAc3Descriptor = false;
            let hasEac3Descriptor = false;
            while (bitstream.pos < esInfoEndPos) {
              const descriptorTag = bitstream.readBits(8);
              const descriptorLength = bitstream.readBits(8);
              if (descriptorTag === 106) {
                hasAc3Descriptor = true;
              } else if (descriptorTag === 122 || descriptorTag === 204) {
                hasEac3Descriptor = true;
              }
              bitstream.skipBits(8 * descriptorLength);
            }
            let info = null;
            switch (streamType) {
              case 27:
              case 36:
                {
                  const codec = streamType === 27 ? "avc" : "hevc";
                  info = {
                    type: "video",
                    codec,
                    decoderConfig: null,
                    avcCodecInfo: null,
                    hevcCodecInfo: null,
                    colorSpace: {
                      primaries: null,
                      transfer: null,
                      matrix: null,
                      fullRange: null
                    },
                    width: -1,
                    height: -1,
                    squarePixelWidth: -1,
                    squarePixelHeight: -1,
                    reorderSize: -1
                  };
                }
                ;
                break;
              case 3:
              case 4:
              case 15:
              case 129:
              case 135:
                {
                  let codec;
                  if (streamType === 3 || streamType === 4) {
                    codec = "mp3";
                  } else if (streamType === 15) {
                    codec = "aac";
                  } else if (streamType === 129) {
                    codec = "ac3";
                  } else if (streamType === 135) {
                    codec = "eac3";
                  } else {
                    throw new Error("Unreachable.");
                  }
                  info = {
                    type: "audio",
                    codec,
                    decoderConfig: null,
                    aacCodecInfo: null,
                    numberOfChannels: -1,
                    sampleRate: -1
                  };
                }
                ;
                break;
              case 6:
                {
                  if (hasEac3Descriptor) {
                    info = {
                      type: "audio",
                      codec: "eac3",
                      decoderConfig: null,
                      aacCodecInfo: null,
                      numberOfChannels: -1,
                      sampleRate: -1
                    };
                  } else if (hasAc3Descriptor) {
                    info = {
                      type: "audio",
                      codec: "ac3",
                      decoderConfig: null,
                      aacCodecInfo: null,
                      numberOfChannels: -1,
                      sampleRate: -1
                    };
                  }
                }
                ;
                break;
              default: {
                if (!ignoredStreamTypes.has(streamType)) {
                  console.warn(`Note: MPEG-TS streams with stream_type 0x${streamType.toString(16)} are not` + ` currently supported.`);
                  ignoredStreamTypes.add(streamType);
                }
              }
            }
            if (info) {
              this.elementaryStreams.push({
                demuxer: this,
                pid: elementaryPid,
                streamType,
                initialized: false,
                firstSection: null,
                canBeTrustedWithKeyPackets: false,
                info,
                referencePesPackets: []
              });
            }
          }
          hasProgramMap = true;
        } else {
          const elementaryStream = this.elementaryStreams.find((x) => x.pid === section.pid);
          outer:
            if (elementaryStream && !elementaryStream.initialized) {
              const pesPacket = readPesPacket(section, true);
              if (!pesPacket) {
                throw new Error(`Couldn't read first PES packet for Elementary Stream with PID ${elementaryStream.pid}`);
              }
              elementaryStream.firstSection = section;
              elementaryStream.canBeTrustedWithKeyPackets = section.randomAccessIndicator === 1;
              if (this.input._initInput) {
                const initDemuxer = await this.input._initInput._getDemuxer();
                const matchingStream = initDemuxer.elementaryStreams.find((x) => x.pid === section.pid && x.info.codec === elementaryStream.info.codec);
                if (matchingStream) {
                  elementaryStream.info = matchingStream.info;
                  elementaryStream.initialized = true;
                  break outer;
                }
              }
              const context = new PacketReadingContext(elementaryStream, pesPacket);
              if (elementaryStream.info.type === "video") {
                while (true) {
                  const contextAlias = context;
                  contextAlias.suppliedPacket = null;
                  await context.markNextPacket();
                  if (elementaryStream.info.codec === "avc") {
                    if (!context.suppliedPacket) {
                      throw new Error("Invalid AVC video stream; could not extract AVCDecoderConfigurationRecord" + " from any packet.");
                    }
                    elementaryStream.info.avcCodecInfo = extractAvcDecoderConfigurationRecord(context.suppliedPacket.data);
                    if (!elementaryStream.info.avcCodecInfo) {
                      continue;
                    }
                    const spsUnit = elementaryStream.info.avcCodecInfo.sequenceParameterSets[0];
                    assert(spsUnit);
                    const spsInfo = parseAvcSps(spsUnit);
                    elementaryStream.info.width = spsInfo.displayWidth;
                    elementaryStream.info.height = spsInfo.displayHeight;
                    const num = spsInfo.pixelAspectRatio.num;
                    const den = spsInfo.pixelAspectRatio.den;
                    if (num > 0 && den > 0) {
                      if (num > den) {
                        elementaryStream.info.squarePixelWidth = Math.round(elementaryStream.info.width * num / den);
                        elementaryStream.info.squarePixelHeight = elementaryStream.info.height;
                      } else {
                        elementaryStream.info.squarePixelWidth = elementaryStream.info.width;
                        elementaryStream.info.squarePixelHeight = Math.round(elementaryStream.info.height * den / num);
                      }
                    }
                    elementaryStream.info.colorSpace = {
                      primaries: COLOR_PRIMARIES_MAP_INVERSE[spsInfo.colourPrimaries],
                      transfer: TRANSFER_CHARACTERISTICS_MAP_INVERSE[spsInfo.transferCharacteristics],
                      matrix: MATRIX_COEFFICIENTS_MAP_INVERSE[spsInfo.matrixCoefficients],
                      fullRange: !!spsInfo.fullRangeFlag
                    };
                    elementaryStream.info.reorderSize = spsInfo.maxDecFrameBuffering;
                    break;
                  } else if (elementaryStream.info.codec === "hevc") {
                    if (!context.suppliedPacket) {
                      throw new Error("Invalid HEVC video stream; could not extract HVCDecoderConfigurationRecord" + " from first packet.");
                    }
                    elementaryStream.info.hevcCodecInfo = extractHevcDecoderConfigurationRecord(context.suppliedPacket.data);
                    if (!elementaryStream.info.hevcCodecInfo) {
                      continue;
                    }
                    const spsArray = elementaryStream.info.hevcCodecInfo.arrays.find((a) => a.nalUnitType === HevcNalUnitType.SPS_NUT);
                    const spsUnit = spsArray.nalUnits[0];
                    assert(spsUnit);
                    const spsInfo = parseHevcSps(spsUnit);
                    elementaryStream.info.width = spsInfo.displayWidth;
                    elementaryStream.info.height = spsInfo.displayHeight;
                    if (spsInfo.pixelAspectRatio.num > spsInfo.pixelAspectRatio.den) {
                      elementaryStream.info.squarePixelWidth = Math.round(elementaryStream.info.width * spsInfo.pixelAspectRatio.num / spsInfo.pixelAspectRatio.den);
                      elementaryStream.info.squarePixelHeight = elementaryStream.info.height;
                    } else {
                      elementaryStream.info.squarePixelWidth = elementaryStream.info.width;
                      elementaryStream.info.squarePixelHeight = Math.round(elementaryStream.info.height * spsInfo.pixelAspectRatio.den / spsInfo.pixelAspectRatio.num);
                    }
                    elementaryStream.info.colorSpace = {
                      primaries: COLOR_PRIMARIES_MAP_INVERSE[spsInfo.colourPrimaries],
                      transfer: TRANSFER_CHARACTERISTICS_MAP_INVERSE[spsInfo.transferCharacteristics],
                      matrix: MATRIX_COEFFICIENTS_MAP_INVERSE[spsInfo.matrixCoefficients],
                      fullRange: !!spsInfo.fullRangeFlag
                    };
                    elementaryStream.info.reorderSize = spsInfo.maxDecFrameBuffering;
                    break;
                  } else {
                    throw new Error("Unhandled.");
                  }
                }
                elementaryStream.info.decoderConfig = {
                  codec: extractVideoCodecString({
                    width: elementaryStream.info.width,
                    height: elementaryStream.info.height,
                    codec: elementaryStream.info.codec,
                    codecDescription: null,
                    colorSpace: elementaryStream.info.colorSpace,
                    avcType: 1,
                    avcCodecInfo: elementaryStream.info.avcCodecInfo,
                    hevcCodecInfo: elementaryStream.info.hevcCodecInfo,
                    vp9CodecInfo: null,
                    av1CodecInfo: null
                  }),
                  codedWidth: elementaryStream.info.width,
                  codedHeight: elementaryStream.info.height,
                  colorSpace: elementaryStream.info.colorSpace
                };
                if (elementaryStream.info.width !== elementaryStream.info.squarePixelWidth || elementaryStream.info.height !== elementaryStream.info.squarePixelHeight) {
                  elementaryStream.info.decoderConfig.displayAspectWidth = elementaryStream.info.squarePixelWidth;
                  elementaryStream.info.decoderConfig.displayAspectHeight = elementaryStream.info.squarePixelHeight;
                }
                elementaryStream.initialized = true;
              } else {
                await context.markNextPacket();
                if (!context.suppliedPacket) {
                  throw new Error(`Couldn't parse first media packet for Elementary Stream with` + ` PID ${elementaryStream.pid}`);
                }
                if (elementaryStream.info.codec === "aac") {
                  const slice = FileSlice.tempFromBytes(context.suppliedPacket.data);
                  const header = readAdtsFrameHeader(slice);
                  if (!header) {
                    throw new Error("Invalid AAC audio stream; could not read ADTS frame header from first packet.");
                  }
                  elementaryStream.info.aacCodecInfo = {
                    isMpeg2: false,
                    objectType: header.objectType
                  };
                  elementaryStream.info.numberOfChannels = aacChannelMap[header.channelConfiguration];
                  elementaryStream.info.sampleRate = aacFrequencyTable[header.samplingFrequencyIndex];
                } else if (elementaryStream.info.codec === "mp3") {
                  const word = readU32Be(FileSlice.tempFromBytes(context.suppliedPacket.data));
                  const result = readMp3FrameHeader(word, context.suppliedPacket.data.byteLength);
                  if (!result.header) {
                    throw new Error("Invalid MP3 audio stream; could not read frame header from first packet.");
                  }
                  elementaryStream.info.numberOfChannels = getMp3ChannelCount(result.header.channel);
                  elementaryStream.info.sampleRate = result.header.sampleRate;
                } else if (elementaryStream.info.codec === "ac3") {
                  const frameInfo = parseAc3SyncFrame(context.suppliedPacket.data);
                  if (!frameInfo) {
                    throw new Error("Invalid AC-3 audio stream; could not read sync frame from first packet.");
                  }
                  if (frameInfo.fscod === 3) {
                    throw new Error("Invalid AC-3 audio stream; reserved sample rate code found in first packet.");
                  }
                  elementaryStream.info.numberOfChannels = AC3_ACMOD_CHANNEL_COUNTS[frameInfo.acmod] + frameInfo.lfeon;
                  elementaryStream.info.sampleRate = AC3_SAMPLE_RATES[frameInfo.fscod];
                } else if (elementaryStream.info.codec === "eac3") {
                  const frameInfo = parseEac3SyncFrame(context.suppliedPacket.data);
                  if (!frameInfo) {
                    throw new Error("Invalid E-AC-3 audio stream; could not read sync frame from first packet.");
                  }
                  const sampleRate = getEac3SampleRate(frameInfo);
                  if (sampleRate === null) {
                    throw new Error("Invalid E-AC-3 audio stream; reserved sample rate code found in first packet.");
                  }
                  elementaryStream.info.numberOfChannels = getEac3ChannelCount(frameInfo);
                  elementaryStream.info.sampleRate = sampleRate;
                } else {
                  throw new Error("Unhandled.");
                }
                elementaryStream.info.decoderConfig = {
                  codec: extractAudioCodecString({
                    codec: elementaryStream.info.codec,
                    codecDescription: null,
                    aacCodecInfo: elementaryStream.info.aacCodecInfo
                  }),
                  numberOfChannels: elementaryStream.info.numberOfChannels,
                  sampleRate: elementaryStream.info.sampleRate
                };
                elementaryStream.initialized = true;
              }
            }
        }
        const isDone = hasProgramMap && this.elementaryStreams.every((x) => x.initialized);
        if (isDone) {
          break;
        }
        currentPos += this.packetStride;
      }
      if (!hasProgramMap) {
        if (!hasProgramAssociationTable) {
          throw new Error("No Program Association Table found in the file.");
        }
        throw new Error("No Program Map Table found in the file.");
      }
      for (const stream of this.elementaryStreams) {
        if (stream.info.type === "video") {
          this.trackBackingEntries.push(new MpegTsVideoTrackBacking(stream));
        } else {
          this.trackBackingEntries.push(new MpegTsAudioTrackBacking(stream));
        }
      }
    })();
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackingEntries;
  }
  async getMetadataTags() {
    return {};
  }
  async getMimeType() {
    await this.readMetadata();
    const codecStrings = await Promise.all(this.trackBackingEntries.map((x) => x.getDecoderConfig().then((c) => c?.codec ?? null)));
    return buildMpegTsMimeType(codecStrings);
  }
  async readSection(startPos, full, contiguous = false) {
    let endPos = startPos;
    let currentPos = startPos;
    const chunks = [];
    let chunksByteLength = 0;
    let firstPacket = null;
    let mustAddSectionEnd = true;
    let randomAccessIndicator = 0;
    while (true) {
      const packet = await this.readPacket(currentPos);
      currentPos += this.packetStride;
      if (!packet) {
        break;
      }
      if (!firstPacket) {
        if (packet.payloadUnitStartIndicator === 0) {
          break;
        }
        firstPacket = packet;
      } else {
        if (packet.pid !== firstPacket.pid) {
          if (contiguous) {
            break;
          } else {
            continue;
          }
        }
        if (packet.payloadUnitStartIndicator === 1) {
          break;
        }
      }
      const hasAdaptationField = !!(packet.adaptationFieldControl & 2);
      const hasPayload = !!(packet.adaptationFieldControl & 1);
      let adaptationFieldLength = 0;
      if (hasAdaptationField) {
        adaptationFieldLength = 1 + packet.body[0];
        if (packet === firstPacket && adaptationFieldLength > 1) {
          randomAccessIndicator = packet.body[1] >> 6 & 1;
        }
      }
      if (hasPayload) {
        if (adaptationFieldLength === 0) {
          chunks.push(packet.body);
          chunksByteLength += packet.body.byteLength;
        } else {
          chunks.push(packet.body.subarray(adaptationFieldLength));
          chunksByteLength += packet.body.byteLength - adaptationFieldLength;
        }
      }
      endPos = currentPos;
      if (!full && chunksByteLength >= 64) {
        mustAddSectionEnd = false;
        break;
      }
      const isKnownSectionEnd = binarySearchExact(this.sectionEndPositions, endPos, (x) => x) !== -1;
      if (isKnownSectionEnd) {
        mustAddSectionEnd = false;
        break;
      }
    }
    if (mustAddSectionEnd) {
      const index = binarySearchLessOrEqual(this.sectionEndPositions, endPos, (x) => x);
      this.sectionEndPositions.splice(index + 1, 0, endPos);
    }
    if (!firstPacket) {
      return null;
    }
    let merged;
    if (chunks.length === 1) {
      merged = chunks[0];
    } else {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
    }
    return {
      startPos,
      endPos: full ? endPos : null,
      pid: firstPacket.pid,
      payload: merged,
      randomAccessIndicator
    };
  }
  async readPacketHeader(pos) {
    let slice = this.reader.requestSlice(pos, 4);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice) {
      return null;
    }
    const syncByte = readU8(slice);
    if (syncByte !== 71) {
      throw new Error("Invalid TS packet sync byte. Likely an internal bug, please report this file.");
    }
    const nextTwoBytes = readU16Be(slice);
    const transportErrorIndicator = nextTwoBytes >> 15;
    const payloadUnitStartIndicator = nextTwoBytes >> 14 & 1;
    const transportPriority = nextTwoBytes >> 13 & 1;
    const pid = nextTwoBytes & 8191;
    const nextByte = readU8(slice);
    const transportScramblingControl = nextByte >> 6;
    const adaptationFieldControl = nextByte >> 4 & 3;
    const continuityCounter = nextByte & 15;
    return {
      payloadUnitStartIndicator,
      pid,
      adaptationFieldControl
    };
  }
  async readPacket(pos) {
    let slice = this.reader.requestSlice(pos, TS_PACKET_SIZE);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice) {
      return null;
    }
    const bytes = readBytes(slice, TS_PACKET_SIZE);
    const syncByte = bytes[0];
    if (syncByte !== 71) {
      throw new Error("Invalid TS packet sync byte. Likely an internal bug, please report this file.");
    }
    const nextTwoBytes = (bytes[1] << 8) + bytes[2];
    const transportErrorIndicator = nextTwoBytes >> 15;
    const payloadUnitStartIndicator = nextTwoBytes >> 14 & 1;
    const transportPriority = nextTwoBytes >> 13 & 1;
    const pid = nextTwoBytes & 8191;
    const nextByte = bytes[3];
    const transportScramblingControl = nextByte >> 6;
    const adaptationFieldControl = nextByte >> 4 & 3;
    const continuityCounter = nextByte & 15;
    return {
      payloadUnitStartIndicator,
      pid,
      adaptationFieldControl,
      body: bytes.subarray(4)
    };
  }
}
var readPesPacketHeader = (section, expectPts) => {
  if (section.payload.byteLength < 3) {
    return null;
  }
  const bitstream = new Bitstream(section.payload);
  const startCodePrefix = bitstream.readBits(24);
  if (startCodePrefix !== 1) {
    return null;
  }
  const streamId = bitstream.readBits(8);
  bitstream.skipBits(16);
  if (streamId === 188 || streamId === 190 || streamId === 191 || streamId === 240 || streamId === 241 || streamId === 255 || streamId === 242 || streamId === 248) {
    return null;
  }
  bitstream.skipBits(8);
  const ptsDtsFlags = bitstream.readBits(2);
  bitstream.skipBits(14);
  let pts = null;
  if (ptsDtsFlags === 2 || ptsDtsFlags === 3) {
    pts = 0;
    bitstream.skipBits(4);
    pts += bitstream.readBits(3) * (1 << 30);
    bitstream.skipBits(1);
    pts += bitstream.readBits(15) * (1 << 15);
    bitstream.skipBits(1);
    pts += bitstream.readBits(15);
  } else {
    if (expectPts) {
      throw new Error(MISSING_PTS_ERROR_MESSAGE);
    }
  }
  return {
    sectionStartPos: section.startPos,
    sectionEndPos: section.endPos,
    pts,
    randomAccessIndicator: section.randomAccessIndicator
  };
};
var readPesPacket = (section, expectPts) => {
  assert(section.endPos !== null);
  const header = readPesPacketHeader(section, expectPts);
  if (!header) {
    return null;
  }
  const bitstream = new Bitstream(section.payload);
  bitstream.skipBits(32);
  const pesPacketLength = bitstream.readBits(16);
  const BYTES_UNTIL_END_OF_PES_PACKET_LENGTH = 6;
  bitstream.skipBits(16);
  const pesHeaderDataLength = bitstream.readBits(8);
  const pesHeaderEndPos = bitstream.pos + 8 * pesHeaderDataLength;
  bitstream.pos = pesHeaderEndPos;
  const bytePos = pesHeaderEndPos / 8;
  assert(Number.isInteger(bytePos));
  const data = section.payload.subarray(bytePos, pesPacketLength > 0 ? BYTES_UNTIL_END_OF_PES_PACKET_LENGTH + pesPacketLength : section.payload.byteLength);
  return {
    ...header,
    data
  };
};

class MpegTsTrackBacking {
  constructor(elementaryStream) {
    this.elementaryStream = elementaryStream;
    this.packetBuffers = new WeakMap;
    this.packetSectionStarts = new WeakMap;
  }
  getId() {
    return this.elementaryStream.pid;
  }
  getNumber() {
    const demuxer = this.elementaryStream.demuxer;
    const trackType = this.elementaryStream.info.type;
    let number = 0;
    for (const backing of demuxer.trackBackingEntries) {
      if (backing.getType() === trackType) {
        number++;
      }
      assert(backing instanceof MpegTsTrackBacking);
      if (backing.elementaryStream === this.elementaryStream) {
        break;
      }
    }
    return number;
  }
  getCodec() {
    throw new Error("Not implemented on base class.");
  }
  getInternalCodecId() {
    return this.elementaryStream.streamType;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return UNDETERMINED_LANGUAGE;
  }
  getDisposition() {
    return {
      ...DEFAULT_TRACK_DISPOSITION,
      primary: false
    };
  }
  getTimeResolution() {
    return TIMESCALE;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    return null;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  createEncodedPacket(suppliedPacket, duration, options) {
    let packetType;
    if (this.allPacketsAreKeyPackets()) {
      packetType = "key";
    } else {
      packetType = suppliedPacket.randomAccessIndicator === 1 ? "key" : "delta";
    }
    return new EncodedPacket(options.metadataOnly ? PLACEHOLDER_DATA : suppliedPacket.data, packetType, suppliedPacket.pts / TIMESCALE, Math.max(duration / TIMESCALE, 0), suppliedPacket.sequenceNumber, suppliedPacket.data.byteLength);
  }
  async getFirstPacket(options) {
    const section = this.elementaryStream.firstSection;
    assert(section);
    const pesPacket = readPesPacket(section, true);
    assert(pesPacket);
    const context = new PacketReadingContext(this.elementaryStream, pesPacket);
    const buffer = new PacketBuffer(this, context);
    const result = await buffer.readNext();
    if (!result) {
      return null;
    }
    const packet = this.createEncodedPacket(result.packet, result.duration, options);
    this.packetBuffers.set(packet, buffer);
    this.packetSectionStarts.set(packet, result.packet.sectionStartPos);
    return packet;
  }
  async getNextPacket(packet, options) {
    let buffer = this.packetBuffers.get(packet);
    if (buffer) {
      const result = await buffer.readNext();
      if (!result) {
        return null;
      }
      this.packetBuffers.delete(packet);
      const newPacket = this.createEncodedPacket(result.packet, result.duration, options);
      this.packetBuffers.set(newPacket, buffer);
      this.packetSectionStarts.set(newPacket, result.packet.sectionStartPos);
      return newPacket;
    }
    const sectionStartPos = this.packetSectionStarts.get(packet);
    if (sectionStartPos === undefined) {
      throw new Error("Packet was not created from this track.");
    }
    const demuxer = this.elementaryStream.demuxer;
    const section = await demuxer.readSection(sectionStartPos, true);
    assert(section);
    const pesPacket = readPesPacket(section, true);
    assert(pesPacket);
    const context = new PacketReadingContext(this.elementaryStream, pesPacket);
    buffer = new PacketBuffer(this, context);
    const targetSequenceNumber = packet.sequenceNumber;
    while (true) {
      const result = await buffer.readNext();
      if (!result) {
        return null;
      }
      if (result.packet.sequenceNumber > targetSequenceNumber) {
        const newPacket = this.createEncodedPacket(result.packet, result.duration, options);
        this.packetBuffers.set(newPacket, buffer);
        this.packetSectionStarts.set(newPacket, result.packet.sectionStartPos);
        return newPacket;
      }
    }
  }
  async getNextKeyPacket(packet, options) {
    let currentPacket = packet;
    while (true) {
      currentPacket = await this.getNextPacket(currentPacket, options);
      if (!currentPacket) {
        return null;
      }
      if (currentPacket.type === "key") {
        return currentPacket;
      }
    }
  }
  getPacket(timestamp, options) {
    return this.doPacketLookup(timestamp, false, options);
  }
  getKeyPacket(timestamp, options) {
    return this.doPacketLookup(timestamp, true, options);
  }
  async doPacketLookup(timestamp, keyframesOnly, options) {
    const searchPts = roundIfAlmostInteger(timestamp * TIMESCALE);
    const demuxer = this.elementaryStream.demuxer;
    const { reader, seekChunkSize } = demuxer;
    const pid = this.elementaryStream.pid;
    const findFirstPesPacketHeaderInChunk = async (startPos, endPos, readSectionInFull) => {
      let currentPos = startPos;
      while (currentPos < endPos) {
        const packetHeader = await demuxer.readPacketHeader(currentPos);
        if (!packetHeader) {
          return null;
        }
        if (packetHeader.pid === pid && packetHeader.payloadUnitStartIndicator === 1) {
          const section = await demuxer.readSection(currentPos, readSectionInFull);
          if (!section) {
            return null;
          }
          const pesPacketHeader = readPesPacketHeader(section, false);
          if (pesPacketHeader && pesPacketHeader.pts !== null) {
            return {
              pesPacketHeader,
              section
            };
          }
        }
        currentPos += demuxer.packetStride;
      }
      return null;
    };
    const firstSection = this.elementaryStream.firstSection;
    assert(firstSection);
    const firstPesPacketHeader = readPesPacketHeader(firstSection, true);
    assert(firstPesPacketHeader);
    if (searchPts < firstPesPacketHeader.pts) {
      return null;
    }
    let scanStartPos;
    const referencePesPackets = this.elementaryStream.referencePesPackets;
    const referencePointIndex = binarySearchLessOrEqual(referencePesPackets, searchPts, (x) => x.pts);
    const referencePoint = referencePointIndex !== -1 ? referencePesPackets[referencePointIndex] : null;
    if (referencePoint && searchPts - referencePoint.pts < TIMESCALE / 2) {
      scanStartPos = referencePoint.sectionStartPos;
    } else {
      let startChunkIndex = 0;
      if (reader.fileSize !== null) {
        const numChunks = Math.ceil(reader.fileSize / seekChunkSize);
        if (numChunks > 1) {
          let low = 0;
          let high = numChunks - 1;
          startChunkIndex = low;
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const chunkStartPos = floorToMultiple(mid * seekChunkSize, demuxer.packetStride) + firstPesPacketHeader.sectionStartPos;
            const chunkEndPos = chunkStartPos + seekChunkSize;
            const result2 = await findFirstPesPacketHeaderInChunk(chunkStartPos, chunkEndPos, false);
            if (!result2) {
              high = mid - 1;
              continue;
            }
            if (result2.pesPacketHeader.pts <= searchPts) {
              startChunkIndex = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
        }
      }
      scanStartPos = floorToMultiple(startChunkIndex * seekChunkSize, demuxer.packetStride) + firstPesPacketHeader.sectionStartPos;
    }
    const result = await findFirstPesPacketHeaderInChunk(scanStartPos, reader.fileSize ?? Infinity, false);
    let currentPesHeader = result?.pesPacketHeader ?? null;
    if (!currentPesHeader) {
      currentPesHeader = firstPesPacketHeader;
    }
    const reorderSize = this.getReorderSize();
    const retrieveEncodedPacket = async (sectionStartPos, predicate) => {
      const section = await demuxer.readSection(sectionStartPos, true);
      assert(section);
      const pesPacket = readPesPacket(section, true);
      assert(pesPacket);
      const context = new PacketReadingContext(this.elementaryStream, pesPacket);
      const buffer = new PacketBuffer(this, context);
      while (true) {
        const topPts = last(buffer.presentationOrderPackets)?.pts ?? -Infinity;
        if (topPts >= searchPts) {
          break;
        }
        const didRead = await buffer.readNextPacket();
        if (!didRead) {
          break;
        }
      }
      const targetIndex = findLastIndex(buffer.presentationOrderPackets, predicate);
      if (targetIndex === -1) {
        return null;
      }
      const targetPacket = buffer.presentationOrderPackets[targetIndex];
      const lastDuration = targetIndex === 0 ? 0 : targetPacket.pts - buffer.presentationOrderPackets[targetIndex - 1].pts;
      while (buffer.decodeOrderPackets[0] !== targetPacket) {
        buffer.decodeOrderPackets.shift();
      }
      buffer.lastDuration = lastDuration;
      const result2 = await buffer.readNext();
      assert(result2);
      const packet = this.createEncodedPacket(result2.packet, result2.duration, options);
      this.packetBuffers.set(packet, buffer);
      this.packetSectionStarts.set(packet, result2.packet.sectionStartPos);
      return packet;
    };
    if (!keyframesOnly || this.allPacketsAreKeyPackets()) {
      outer:
        while (true) {
          let currentPos = currentPesHeader.sectionStartPos + demuxer.packetStride;
          while (true) {
            const packetHeader = await demuxer.readPacketHeader(currentPos);
            if (!packetHeader) {
              break outer;
            }
            if (packetHeader.pid === pid && packetHeader.payloadUnitStartIndicator === 1) {
              const section = await demuxer.readSection(currentPos, false);
              if (section) {
                const nextPesHeader = readPesPacketHeader(section, false);
                if (nextPesHeader && nextPesHeader.pts !== null) {
                  if (nextPesHeader.pts > searchPts) {
                    break outer;
                  }
                  currentPesHeader = nextPesHeader;
                  maybeInsertReferencePacket(this.elementaryStream, currentPesHeader);
                  break;
                }
              }
            }
            currentPos += demuxer.packetStride;
          }
        }
      outer:
        for (let i = 0;i < reorderSize + 1; i++) {
          let pos = currentPesHeader.sectionStartPos - demuxer.packetStride;
          while (pos >= demuxer.packetOffset) {
            const packetHeader = await demuxer.readPacketHeader(pos);
            if (!packetHeader) {
              break outer;
            }
            if (packetHeader.pid === pid && packetHeader.payloadUnitStartIndicator === 1) {
              const section = await demuxer.readSection(pos, false);
              if (section) {
                const header = readPesPacketHeader(section, false);
                if (header && header.pts !== null) {
                  currentPesHeader = header;
                  break;
                }
              }
            }
            pos -= demuxer.packetStride;
          }
        }
      return retrieveEncodedPacket(currentPesHeader.sectionStartPos, (p) => p.pts <= searchPts);
    } else {
      let currentChunkStartPos = scanStartPos;
      let nextChunkStartPos = null;
      const readSectionsInFull = !this.elementaryStream.canBeTrustedWithKeyPackets;
      while (true) {
        let bestKeyPesHeader = null;
        const isFirstChunk = currentChunkStartPos <= firstPesPacketHeader.sectionStartPos;
        let pesHeader;
        let pesHeaderSection = null;
        if (isFirstChunk) {
          pesHeader = firstPesPacketHeader;
          pesHeaderSection = firstSection;
        } else {
          const result2 = await findFirstPesPacketHeaderInChunk(currentChunkStartPos, reader.fileSize ?? Infinity, readSectionsInFull);
          pesHeader = result2?.pesPacketHeader ?? null;
          pesHeaderSection = result2?.section ?? null;
        }
        let passedSearchPts = false;
        let lookaheadCount = 0;
        outer:
          while (pesHeader) {
            if (nextChunkStartPos !== null && pesHeader.sectionStartPos >= nextChunkStartPos) {
              break;
            }
            if (pesHeader.pts <= searchPts) {
              let isKeyPacket;
              if (this.elementaryStream.canBeTrustedWithKeyPackets) {
                isKeyPacket = pesHeader.randomAccessIndicator === 1;
              } else {
                assert(pesHeaderSection);
                const pesPacket = readPesPacket(pesHeaderSection, true);
                assert(pesPacket);
                const context = new PacketReadingContext(this.elementaryStream, pesPacket);
                await context.markNextPacket();
                isKeyPacket = context.suppliedPacket?.randomAccessIndicator === 1;
              }
              if (isKeyPacket) {
                bestKeyPesHeader = pesHeader;
              }
            }
            if (pesHeader.pts > searchPts) {
              passedSearchPts = true;
            }
            if (passedSearchPts) {
              lookaheadCount++;
              if (lookaheadCount > reorderSize) {
                break;
              }
            }
            let currentPos = pesHeader.sectionStartPos + demuxer.packetStride;
            while (true) {
              const packetHeader = await demuxer.readPacketHeader(currentPos);
              if (!packetHeader) {
                break outer;
              }
              if (packetHeader.pid === pid && packetHeader.payloadUnitStartIndicator === 1) {
                const section = await demuxer.readSection(currentPos, readSectionsInFull);
                if (section) {
                  const nextPesHeader = readPesPacketHeader(section, false);
                  if (nextPesHeader && nextPesHeader.pts !== null) {
                    pesHeader = nextPesHeader;
                    pesHeaderSection = section;
                    maybeInsertReferencePacket(this.elementaryStream, pesHeader);
                    break;
                  }
                }
              }
              currentPos += demuxer.packetStride;
            }
          }
        if (bestKeyPesHeader) {
          let startPesHeader = bestKeyPesHeader;
          if (lookaheadCount === 0) {
            outer:
              for (let i = 0;i < reorderSize; i++) {
                let pos = startPesHeader.sectionStartPos - demuxer.packetStride;
                while (pos >= demuxer.packetOffset) {
                  const packetHeader = await demuxer.readPacketHeader(pos);
                  if (!packetHeader) {
                    break outer;
                  }
                  if (packetHeader.pid === pid && packetHeader.payloadUnitStartIndicator === 1) {
                    const section = await demuxer.readSection(pos, readSectionsInFull);
                    if (section) {
                      const header = readPesPacketHeader(section, false);
                      if (header && header.pts !== null) {
                        startPesHeader = header;
                        break;
                      }
                    }
                  }
                  pos -= demuxer.packetStride;
                }
              }
          }
          const encodedPacket = await retrieveEncodedPacket(startPesHeader.sectionStartPos, (p) => p.pts <= searchPts && p.randomAccessIndicator === 1);
          assert(encodedPacket);
          return encodedPacket;
        }
        if (isFirstChunk) {
          return null;
        }
        nextChunkStartPos = currentChunkStartPos;
        currentChunkStartPos = Math.max(floorToMultiple(currentChunkStartPos - firstPesPacketHeader.sectionStartPos - seekChunkSize, demuxer.packetStride) + firstPesPacketHeader.sectionStartPos, firstPesPacketHeader.sectionStartPos);
      }
    }
  }
}

class MpegTsVideoTrackBacking extends MpegTsTrackBacking {
  getType() {
    return "video";
  }
  getCodec() {
    return this.elementaryStream.info.codec;
  }
  getCodedWidth() {
    return this.elementaryStream.info.width;
  }
  getCodedHeight() {
    return this.elementaryStream.info.height;
  }
  getSquarePixelWidth() {
    return this.elementaryStream.info.squarePixelWidth;
  }
  getSquarePixelHeight() {
    return this.elementaryStream.info.squarePixelHeight;
  }
  getRotation() {
    return 0;
  }
  async getColorSpace() {
    return this.elementaryStream.info.colorSpace;
  }
  async canBeTransparent() {
    return false;
  }
  async getDecoderConfig() {
    assert(this.elementaryStream.info.decoderConfig);
    return this.elementaryStream.info.decoderConfig;
  }
  allPacketsAreKeyPackets() {
    return false;
  }
  getReorderSize() {
    return this.elementaryStream.info.reorderSize;
  }
}

class MpegTsAudioTrackBacking extends MpegTsTrackBacking {
  getType() {
    return "audio";
  }
  getCodec() {
    return this.elementaryStream.info.codec;
  }
  getNumberOfChannels() {
    return this.elementaryStream.info.numberOfChannels;
  }
  getSampleRate() {
    return this.elementaryStream.info.sampleRate;
  }
  async getDecoderConfig() {
    assert(this.elementaryStream.info.decoderConfig);
    return this.elementaryStream.info.decoderConfig;
  }
  allPacketsAreKeyPackets() {
    return true;
  }
  getReorderSize() {
    return 0;
  }
}
var maybeInsertReferencePacket = (elementaryStream, pesPacketHeader) => {
  const referencePesPackets = elementaryStream.referencePesPackets;
  const index = binarySearchLessOrEqual(referencePesPackets, pesPacketHeader.sectionStartPos, (x) => x.sectionStartPos);
  if (index >= 0) {
    const entry = referencePesPackets[index];
    if (pesPacketHeader.pts <= entry.pts) {
      return false;
    }
    const minByteDistance = elementaryStream.demuxer.minReferencePointByteDistance;
    if (pesPacketHeader.sectionStartPos - entry.sectionStartPos < minByteDistance) {
      return false;
    }
    if (index < referencePesPackets.length - 1) {
      const nextEntry = referencePesPackets[index + 1];
      if (nextEntry.pts < pesPacketHeader.pts) {
        return false;
      }
      if (nextEntry.sectionStartPos - pesPacketHeader.sectionStartPos < minByteDistance) {
        return false;
      }
    }
  }
  referencePesPackets.splice(index + 1, 0, pesPacketHeader);
  return true;
};

class PacketReadingContext {
  constructor(elementaryStream, startingPesPacket) {
    this.currentPos = 0;
    this.pesPackets = [];
    this.currentPesPacketIndex = 0;
    this.currentPesPacketPos = 0;
    this.endPos = 0;
    this.lastSuppliedPesPacket = null;
    this.nextPts = null;
    this.suppliedPacket = null;
    this.elementaryStream = elementaryStream;
    this.pid = elementaryStream.pid;
    this.demuxer = elementaryStream.demuxer;
    this.startingPesPacket = startingPesPacket;
  }
  ensureBuffered(length) {
    const remaining = this.endPos - this.currentPos;
    if (remaining >= length) {
      return length;
    }
    return this.bufferData(length - remaining).then(() => Math.min(this.endPos - this.currentPos, length));
  }
  getCurrentPesPacket() {
    const packet = this.pesPackets[this.currentPesPacketIndex];
    assert(packet);
    return packet;
  }
  async bufferData(length) {
    const targetEndPos = this.endPos + length;
    while (this.endPos < targetEndPos) {
      let pesPacket;
      if (this.pesPackets.length === 0) {
        pesPacket = this.startingPesPacket;
      } else {
        let currentPos = last(this.pesPackets).sectionEndPos;
        assert(currentPos !== null);
        while (true) {
          const packetHeader = await this.demuxer.readPacketHeader(currentPos);
          if (!packetHeader) {
            return;
          }
          if (packetHeader.pid === this.pid) {
            const nextSection = await this.demuxer.readSection(currentPos, true);
            if (!nextSection) {
              return;
            }
            const nextPesPacket = readPesPacket(nextSection, false);
            if (nextPesPacket) {
              pesPacket = nextPesPacket;
              break;
            }
          }
          currentPos += this.demuxer.packetStride;
        }
      }
      this.pesPackets.push(pesPacket);
      this.endPos += pesPacket.data.byteLength;
    }
  }
  readBytes(length) {
    const currentPesPacket = this.getCurrentPesPacket();
    const relativeStartOffset = this.currentPos - this.currentPesPacketPos;
    const relativeEndOffset = relativeStartOffset + length;
    this.currentPos += length;
    if (relativeEndOffset <= currentPesPacket.data.byteLength) {
      return currentPesPacket.data.subarray(relativeStartOffset, relativeEndOffset);
    }
    const result = new Uint8Array(length);
    result.set(currentPesPacket.data.subarray(relativeStartOffset));
    let offset = currentPesPacket.data.byteLength - relativeStartOffset;
    while (true) {
      this.advanceCurrentPacket();
      const currentPesPacket2 = this.getCurrentPesPacket();
      const relativeEndOffset2 = length - offset;
      if (relativeEndOffset2 <= currentPesPacket2.data.byteLength) {
        result.set(currentPesPacket2.data.subarray(0, relativeEndOffset2), offset);
        break;
      }
      result.set(currentPesPacket2.data, offset);
      offset += currentPesPacket2.data.byteLength;
    }
    return result;
  }
  readU8() {
    let currentPesPacket = this.getCurrentPesPacket();
    const relativeOffset = this.currentPos - this.currentPesPacketPos;
    this.currentPos++;
    if (relativeOffset < currentPesPacket.data.byteLength) {
      return currentPesPacket.data[relativeOffset];
    }
    this.advanceCurrentPacket();
    currentPesPacket = this.getCurrentPesPacket();
    return currentPesPacket.data[0];
  }
  seekTo(pos) {
    if (pos === this.currentPos) {
      return;
    }
    if (pos < this.currentPos) {
      while (pos < this.currentPesPacketPos) {
        this.currentPesPacketIndex--;
        const currentPacket = this.getCurrentPesPacket();
        this.currentPesPacketPos -= currentPacket.data.byteLength;
      }
    } else {
      while (true) {
        const currentPesPacket = this.getCurrentPesPacket();
        const currentEndPos = this.currentPesPacketPos + currentPesPacket.data.byteLength;
        if (pos < currentEndPos) {
          break;
        }
        this.currentPesPacketPos += currentPesPacket.data.byteLength;
        this.currentPesPacketIndex++;
      }
    }
    this.currentPos = pos;
  }
  skip(n) {
    this.seekTo(this.currentPos + n);
  }
  advanceCurrentPacket() {
    this.currentPesPacketPos += this.getCurrentPesPacket().data.byteLength;
    this.currentPesPacketIndex++;
  }
  async markNextPacket() {
    assert(!this.suppliedPacket);
    const elementaryStream = this.elementaryStream;
    if (elementaryStream.info.type === "video") {
      const codec = elementaryStream.info.codec;
      const CHUNK_SIZE = 1024;
      if (codec !== "avc" && codec !== "hevc") {
        throw new Error("Unhandled.");
      }
      let packetStartPos = null;
      while (true) {
        let remaining = this.ensureBuffered(CHUNK_SIZE);
        if (remaining instanceof Promise)
          remaining = await remaining;
        if (remaining === 0) {
          break;
        }
        const chunkStartPos = this.currentPos;
        const chunk = this.readBytes(remaining);
        const length = chunk.byteLength;
        let i = 0;
        while (i < length) {
          const zeroIndex = chunk.indexOf(0, i);
          if (zeroIndex === -1 || zeroIndex >= length) {
            break;
          }
          i = zeroIndex;
          const posBeforeZero = chunkStartPos + i;
          if (i + 4 >= length) {
            this.seekTo(posBeforeZero);
            break;
          }
          const b1 = chunk[i + 1];
          const b2 = chunk[i + 2];
          const b3 = chunk[i + 3];
          let startCodeLength = 0;
          let nalUnitTypeByte = null;
          if (b1 === 0 && b2 === 0 && b3 === 1) {
            startCodeLength = 4;
            nalUnitTypeByte = chunk[i + 4];
          } else if (b1 === 0 && b2 === 1) {
            startCodeLength = 3;
            nalUnitTypeByte = b3;
          }
          if (startCodeLength === 0) {
            i++;
            continue;
          }
          const startCodePos = posBeforeZero;
          if (packetStartPos === null) {
            packetStartPos = startCodePos;
            i += startCodeLength;
            continue;
          }
          if (nalUnitTypeByte !== null) {
            const nalUnitType = codec === "avc" ? extractNalUnitTypeForAvc(nalUnitTypeByte) : extractNalUnitTypeForHevc(nalUnitTypeByte);
            const isAud = codec === "avc" ? nalUnitType === AvcNalUnitType.AUD : nalUnitType === HevcNalUnitType.AUD_NUT;
            if (isAud) {
              const packetLength = startCodePos - packetStartPos;
              this.seekTo(packetStartPos);
              return this.supplyPacket(packetLength, 0);
            }
          }
          i += startCodeLength;
        }
        if (remaining < CHUNK_SIZE) {
          break;
        }
      }
      if (packetStartPos !== null) {
        const packetLength = this.endPos - packetStartPos;
        this.seekTo(packetStartPos);
        return this.supplyPacket(packetLength, 0);
      }
    } else {
      const codec = elementaryStream.info.codec;
      const CHUNK_SIZE = 128;
      while (true) {
        let remaining = this.ensureBuffered(CHUNK_SIZE);
        if (remaining instanceof Promise)
          remaining = await remaining;
        const startPos = this.currentPos;
        while (this.currentPos - startPos < remaining) {
          const byte = this.readU8();
          if (codec === "aac") {
            if (byte !== 255) {
              continue;
            }
            this.skip(-1);
            const possibleHeaderStartPos = this.currentPos;
            let remaining2 = this.ensureBuffered(MAX_ADTS_FRAME_HEADER_SIZE);
            if (remaining2 instanceof Promise)
              remaining2 = await remaining2;
            if (remaining2 < MAX_ADTS_FRAME_HEADER_SIZE) {
              return;
            }
            const headerBytes = this.readBytes(MAX_ADTS_FRAME_HEADER_SIZE);
            const header = readAdtsFrameHeader(FileSlice.tempFromBytes(headerBytes));
            if (header) {
              this.seekTo(possibleHeaderStartPos);
              let remaining3 = this.ensureBuffered(header.frameLength);
              if (remaining3 instanceof Promise)
                remaining3 = await remaining3;
              return this.supplyPacket(remaining3, Math.round(SAMPLES_PER_AAC_FRAME * TIMESCALE / elementaryStream.info.sampleRate));
            } else {
              this.seekTo(possibleHeaderStartPos + 1);
            }
          } else if (codec === "mp3") {
            if (byte !== 255) {
              continue;
            }
            this.skip(-1);
            const possibleHeaderStartPos = this.currentPos;
            let remaining2 = this.ensureBuffered(MP3_FRAME_HEADER_SIZE);
            if (remaining2 instanceof Promise)
              remaining2 = await remaining2;
            if (remaining2 < MP3_FRAME_HEADER_SIZE) {
              return;
            }
            const headerBytes = this.readBytes(MP3_FRAME_HEADER_SIZE);
            const word = toDataView(headerBytes).getUint32(0);
            const result = readMp3FrameHeader(word, null);
            if (result.header) {
              this.seekTo(possibleHeaderStartPos);
              let remaining3 = this.ensureBuffered(result.header.totalSize);
              if (remaining3 instanceof Promise)
                remaining3 = await remaining3;
              const duration = result.header.audioSamplesInFrame * TIMESCALE / elementaryStream.info.sampleRate;
              return this.supplyPacket(remaining3, Math.round(duration));
            } else {
              this.seekTo(possibleHeaderStartPos + 1);
            }
          } else if (codec === "ac3") {
            if (byte !== 11) {
              continue;
            }
            this.skip(-1);
            const possibleSyncPos = this.currentPos;
            let remaining2 = this.ensureBuffered(5);
            if (remaining2 instanceof Promise)
              remaining2 = await remaining2;
            if (remaining2 < 5) {
              return;
            }
            const headerBytes = this.readBytes(5);
            if (headerBytes[0] !== 11 || headerBytes[1] !== 119) {
              this.seekTo(possibleSyncPos + 1);
              continue;
            }
            const fscod = headerBytes[4] >> 6;
            const frmsizecod = headerBytes[4] & 63;
            if (fscod === 3 || frmsizecod > 37) {
              this.seekTo(possibleSyncPos + 1);
              continue;
            }
            const frameSize = AC3_FRAME_SIZES[3 * frmsizecod + fscod];
            assert(frameSize !== undefined);
            this.seekTo(possibleSyncPos);
            remaining2 = this.ensureBuffered(frameSize);
            if (remaining2 instanceof Promise)
              remaining2 = await remaining2;
            const duration = Math.round(AC3_SAMPLES_PER_FRAME * TIMESCALE / elementaryStream.info.sampleRate);
            return this.supplyPacket(remaining2, duration);
          } else if (codec === "eac3") {
            if (byte !== 11) {
              continue;
            }
            this.skip(-1);
            const possibleSyncPos = this.currentPos;
            let remaining2 = this.ensureBuffered(5);
            if (remaining2 instanceof Promise)
              remaining2 = await remaining2;
            if (remaining2 < 5) {
              return;
            }
            const headerBytes = this.readBytes(5);
            if (headerBytes[0] !== 11 || headerBytes[1] !== 119) {
              this.seekTo(possibleSyncPos + 1);
              continue;
            }
            const frmsiz = (headerBytes[2] & 7) << 8 | headerBytes[3];
            const frameSize = (frmsiz + 1) * 2;
            const fscod = headerBytes[4] >> 6;
            const numblkscod = fscod === 3 ? 3 : headerBytes[4] >> 4 & 3;
            const numblks = EAC3_NUMBLKS_TABLE[numblkscod];
            this.seekTo(possibleSyncPos);
            remaining2 = this.ensureBuffered(frameSize);
            if (remaining2 instanceof Promise)
              remaining2 = await remaining2;
            const samplesPerFrame = numblks * 256;
            const duration = Math.round(samplesPerFrame * TIMESCALE / elementaryStream.info.sampleRate);
            return this.supplyPacket(remaining2, duration);
          } else {
            throw new Error("Unhandled.");
          }
        }
        if (remaining < CHUNK_SIZE) {
          break;
        }
      }
    }
  }
  supplyPacket(packetLength, intrinsicDuration) {
    const currentPesPacket = this.getCurrentPesPacket();
    let pts;
    if (this.lastSuppliedPesPacket === currentPesPacket) {
      assert(this.nextPts !== null);
      pts = this.nextPts;
    } else {
      if (currentPesPacket.pts === null) {
        throw new Error(MISSING_PTS_ERROR_MESSAGE);
      }
      pts = currentPesPacket.pts;
      maybeInsertReferencePacket(this.elementaryStream, currentPesPacket);
    }
    this.lastSuppliedPesPacket = currentPesPacket;
    this.nextPts = pts + intrinsicDuration;
    const sectionStartPos = currentPesPacket.sectionStartPos;
    const sequenceNumber = sectionStartPos + (this.currentPos - this.currentPesPacketPos);
    const data = this.readBytes(packetLength);
    let randomAccessIndicator = currentPesPacket.randomAccessIndicator;
    if (randomAccessIndicator === 0 && !this.elementaryStream.canBeTrustedWithKeyPackets) {
      if (this.elementaryStream.info.type === "audio") {
        randomAccessIndicator = 1;
      } else {
        if (this.elementaryStream.info.decoderConfig) {
          const isKey = determineVideoPacketType(this.elementaryStream.info.codec, this.elementaryStream.info.decoderConfig, data) === "key";
          randomAccessIndicator = Number(isKey);
        } else {}
      }
    }
    this.suppliedPacket = {
      pts,
      data,
      sequenceNumber,
      sectionStartPos,
      randomAccessIndicator
    };
    this.pesPackets.splice(0, this.currentPesPacketIndex);
    this.currentPesPacketIndex = 0;
  }
}

class PacketBuffer {
  constructor(backing, context) {
    this.decodeOrderPackets = [];
    this.reorderBuffer = [];
    this.presentationOrderPackets = [];
    this.reachedEnd = false;
    this.lastDuration = 0;
    this.backing = backing;
    this.context = context;
    this.reorderSize = backing.getReorderSize();
    assert(this.reorderSize >= 0);
  }
  async readNext() {
    if (this.decodeOrderPackets.length === 0) {
      const didRead = await this.readNextPacket();
      if (!didRead) {
        return null;
      }
    }
    await this.ensureCurrentPacketHasNext();
    const packet = this.decodeOrderPackets[0];
    const presentationIndex = this.presentationOrderPackets.indexOf(packet);
    assert(presentationIndex !== -1);
    let duration;
    if (presentationIndex === this.presentationOrderPackets.length - 1) {
      duration = this.lastDuration;
    } else {
      const nextPacket = this.presentationOrderPackets[presentationIndex + 1];
      duration = nextPacket.pts - packet.pts;
      this.lastDuration = duration;
    }
    this.decodeOrderPackets.shift();
    while (this.presentationOrderPackets.length > 0) {
      const first = this.presentationOrderPackets[0];
      if (this.decodeOrderPackets.includes(first)) {
        break;
      }
      this.presentationOrderPackets.shift();
    }
    return { packet, duration };
  }
  async readNextPacket() {
    if (this.reachedEnd) {
      return false;
    }
    let suppliedPacket;
    if (this.context.suppliedPacket) {
      suppliedPacket = this.context.suppliedPacket;
    } else {
      await this.context.markNextPacket();
      suppliedPacket = this.context.suppliedPacket;
    }
    this.context.suppliedPacket = null;
    if (!suppliedPacket) {
      this.reachedEnd = true;
      this.flushReorderBuffer();
      return false;
    }
    this.decodeOrderPackets.push(suppliedPacket);
    this.processPacketThroughReorderBuffer(suppliedPacket);
    return true;
  }
  async ensureCurrentPacketHasNext() {
    const current = this.decodeOrderPackets[0];
    assert(current);
    while (true) {
      const presentationIndex = this.presentationOrderPackets.indexOf(current);
      if (presentationIndex !== -1 && presentationIndex <= this.presentationOrderPackets.length - 2) {
        break;
      }
      const didRead = await this.readNextPacket();
      if (!didRead) {
        break;
      }
    }
  }
  processPacketThroughReorderBuffer(packet) {
    this.reorderBuffer.push(packet);
    if (this.reorderBuffer.length > this.reorderSize) {
      let minIndex = 0;
      for (let i = 1;i < this.reorderBuffer.length; i++) {
        if (this.reorderBuffer[i].pts < this.reorderBuffer[minIndex].pts) {
          minIndex = i;
        }
      }
      const packet2 = this.reorderBuffer[minIndex];
      this.presentationOrderPackets.push(packet2);
      this.reorderBuffer.splice(minIndex, 1);
    }
  }
  flushReorderBuffer() {
    this.reorderBuffer.sort((a, b) => a.pts - b.pts);
    this.presentationOrderPackets.push(...this.reorderBuffer);
    this.reorderBuffer.length = 0;
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/hls/hls-misc.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var HLS_MIME_TYPE = "application/vnd.apple.mpegurl";
var TAG_STREAM_INF = "#EXT-X-STREAM-INF:";
var TAG_I_FRAME_STREAM_INF = "#EXT-X-I-FRAME-STREAM-INF:";
var TAG_MEDIA = "#EXT-X-MEDIA:";
var TAG_EXTINF = "#EXTINF:";
var TAG_MAP = "#EXT-X-MAP:";
var TAG_KEY = "#EXT-X-KEY:";
var TAG_MEDIA_SEQUENCE = "#EXT-X-MEDIA-SEQUENCE:";
var TAG_BYTERANGE = "#EXT-X-BYTERANGE:";
var TAG_PROGRAM_DATE_TIME = "#EXT-X-PROGRAM-DATE-TIME:";
var TAG_DISCONTINUITY = "#EXT-X-DISCONTINUITY";
var TAG_TARGETDURATION = "#EXT-X-TARGETDURATION:";
var TAG_ENDLIST = "#EXT-X-ENDLIST";
var TAG_PLAYLIST_TYPE = "#EXT-X-PLAYLIST-TYPE:";
var TAG_I_FRAMES_ONLY = "#EXT-X-I-FRAMES-ONLY";
var canIgnoreLine = (line) => line.length === 0 || line.startsWith("#") && !line.startsWith("#EXT");

class AttributeList {
  constructor(str) {
    this._attributes = {};
    let key = "";
    let value = "";
    let inValue = false;
    let inQuotes = false;
    for (let i = 0;i < str.length; i++) {
      const char = str[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "=" && !inValue && !inQuotes) {
        inValue = true;
      } else if (char === "," && !inQuotes) {
        if (key) {
          this._attributes[key.trim().toLowerCase()] = value;
        }
        key = "";
        value = "";
        inValue = false;
      } else if (inValue) {
        value += char;
      } else {
        key += char;
      }
    }
    if (key) {
      this._attributes[key.trim().toLowerCase()] = value;
    }
  }
  get(name) {
    return this._attributes[name.toLowerCase()] ?? null;
  }
  getAsNumber(name) {
    const value = this.get(name);
    if (value === null) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  merge(other) {
    Object.assign(this._attributes, other._attributes);
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/segmented-input.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class SegmentedInput {
  constructor(input, path, trackDeclarations) {
    this.nextInputCacheAge = 0;
    this.inputCache = [];
    this.trackBackingsPromise = null;
    this.firstSegment = null;
    this.firstSegmentFirstTimestamps = new WeakMap;
    this.firstTimestampCache = new WeakMap;
    this.input = input;
    this.path = path;
    this.trackDeclarations = trackDeclarations;
  }
  async getDurationFromMetadata(options) {
    const lastSegment = await this.getSegmentAt(Infinity, {
      skipLiveWait: options.skipLiveWait
    });
    if (!lastSegment) {
      return null;
    }
    return lastSegment.timestamp + lastSegment.duration;
  }
  async getTrackBackings() {
    return this.trackBackingsPromise ??= (async () => {
      const backings = [];
      if (this.trackDeclarations) {
        for (const decl of this.trackDeclarations) {
          if (decl.type === "video") {
            const number = arrayCount(backings, (x) => x.getType() === "video") + 1;
            backings.push(new SegmentedInputInputVideoTrackBacking(this, decl, number));
          } else if (decl.type === "audio") {
            const number = arrayCount(backings, (x) => x.getType() === "audio") + 1;
            backings.push(new SegmentedInputInputAudioTrackBacking(this, decl, number));
          }
        }
      } else {
        this.firstSegment = await this.getFirstSegment({});
        if (!this.firstSegment) {
          return [];
        }
        const input = this.getInputForSegment(this.firstSegment);
        const inputTracks = await input.getTracks();
        for (const track of inputTracks) {
          if (track.type === "video") {
            const number = arrayCount(backings, (x) => x.getType() === "video") + 1;
            backings.push(new SegmentedInputInputVideoTrackBacking(this, {
              id: backings.length + 1,
              type: "video"
            }, number));
          } else if (track.type === "audio") {
            const number = arrayCount(backings, (x) => x.getType() === "audio") + 1;
            backings.push(new SegmentedInputInputAudioTrackBacking(this, {
              id: backings.length + 1,
              type: "audio"
            }, number));
          }
        }
      }
      return backings;
    })();
  }
  async getFirstTimestampForInput(input) {
    const existing = this.firstTimestampCache.get(input);
    if (existing !== undefined) {
      return existing;
    }
    const firstTimestamp = await input.getFirstTimestamp();
    this.firstTimestampCache.set(input, firstTimestamp);
    return firstTimestamp;
  }
  async getMediaOffset(segment, input) {
    const firstSegment = segment.firstSegment ?? segment;
    let firstSegmentFirstTimestamp;
    if (this.firstSegmentFirstTimestamps.has(firstSegment)) {
      firstSegmentFirstTimestamp = this.firstSegmentFirstTimestamps.get(firstSegment);
    } else {
      const firstInput = this.getInputForSegment(firstSegment);
      firstSegmentFirstTimestamp = await this.getFirstTimestampForInput(firstInput);
      this.firstSegmentFirstTimestamps.set(firstSegment, firstSegmentFirstTimestamp);
    }
    if (firstSegment === segment) {
      return firstSegment.timestamp - firstSegmentFirstTimestamp;
    }
    const segmentFirstTimestamp = await this.getFirstTimestampForInput(input);
    const segmentElapsed = segment.timestamp - firstSegment.timestamp;
    const inputElapsed = segmentFirstTimestamp - firstSegmentFirstTimestamp;
    const difference = inputElapsed - segmentElapsed;
    if (Math.abs(difference) <= Math.min(0.25, segmentElapsed)) {
      return firstSegment.timestamp - firstSegmentFirstTimestamp;
    } else {
      return segment.timestamp - segmentFirstTimestamp;
    }
  }
  dispose() {
    for (const entry of this.inputCache) {
      entry.input.dispose();
    }
    this.inputCache.length = 0;
  }
}

class SegmentedInputInputTrackBacking {
  constructor(segmentedInput, decl, number) {
    this.packetInfos = new WeakMap;
    this.hydrationPromise = null;
    this.firstInputTrack = null;
    this.segmentedInput = segmentedInput;
    this.decl = decl;
    this.number = number;
  }
  hydrate() {
    return this.hydrationPromise ??= (async () => {
      this.segmentedInput.firstSegment ??= await this.segmentedInput.getFirstSegment({});
      if (!this.segmentedInput.firstSegment) {
        throw new Error("Missing first segment, can't retrieve track.");
      }
      const input = this.segmentedInput.getInputForSegment(this.segmentedInput.firstSegment);
      const inputTracks = await input.getTracks();
      const track = inputTracks.find((x) => x.type === this.decl.type && x.number === this.number);
      if (!track) {
        throw new Error("No matching track found in underlying media data.");
      }
      this.firstInputTrack = track;
    })();
  }
  getId() {
    return this.decl.id;
  }
  getType() {
    return this.decl.type;
  }
  getNumber() {
    return this.number;
  }
  delegate(fn) {
    if (this.firstInputTrack) {
      return fn();
    }
    return this.hydrate().then(fn);
  }
  async getDecoderConfig() {
    return this.delegate(() => this.firstInputTrack._backing.getDecoderConfig());
  }
  getHasOnlyKeyPackets() {
    return this.delegate(() => this.firstInputTrack._backing.getHasOnlyKeyPackets?.() ?? null);
  }
  getPairingMask() {
    return 1n;
  }
  getCodec() {
    return this.delegate(() => this.firstInputTrack._backing.getCodec());
  }
  getInternalCodecId() {
    return this.delegate(() => this.firstInputTrack._backing.getInternalCodecId());
  }
  getDisposition() {
    return this.delegate(() => this.firstInputTrack._backing.getDisposition());
  }
  getLanguageCode() {
    return this.delegate(() => this.firstInputTrack._backing.getLanguageCode());
  }
  getName() {
    return this.delegate(() => this.firstInputTrack._backing.getName());
  }
  getTimeResolution() {
    return this.delegate(() => this.firstInputTrack._backing.getTimeResolution());
  }
  async isRelativeToUnixEpoch() {
    await this.hydrate();
    assert(this.segmentedInput.firstSegment);
    return this.segmentedInput.firstSegment.relativeToUnixEpoch;
  }
  getBitrate() {
    return this.delegate(() => this.firstInputTrack._backing.getBitrate());
  }
  getAverageBitrate() {
    return this.delegate(() => this.firstInputTrack._backing.getAverageBitrate());
  }
  getDurationFromMetadata(options) {
    return this.segmentedInput.getDurationFromMetadata(options);
  }
  getLiveRefreshInterval() {
    return this.segmentedInput.getLiveRefreshInterval();
  }
  async createAdjustedPacket(packet, segment, track) {
    assert(packet.sequenceNumber >= 0);
    assert(this.segmentedInput.firstSegment);
    const mediaOffset = await this.segmentedInput.getMediaOffset(segment, track.input);
    const segmentTimestampRelativeToFirst = segment.timestamp - this.segmentedInput.firstSegment.timestamp;
    const modified = packet.clone({
      timestamp: roundToDivisor(packet.timestamp + mediaOffset, await track.getTimeResolution()),
      sequenceNumber: Math.floor(1e8 * segmentTimestampRelativeToFirst) + packet.sequenceNumber
    });
    this.packetInfos.set(modified, {
      segment,
      track,
      sourcePacket: packet
    });
    return modified;
  }
  async getFirstPacket(options) {
    await this.hydrate();
    assert(this.segmentedInput.firstSegment);
    assert(this.firstInputTrack);
    const packet = await this.firstInputTrack._backing.getFirstPacket(options);
    if (!packet) {
      return null;
    }
    return this.createAdjustedPacket(packet, this.segmentedInput.firstSegment, this.firstInputTrack);
  }
  getNextPacket(packet, options) {
    return this._getNextInternal(packet, options, false);
  }
  getNextKeyPacket(packet, options) {
    return this._getNextInternal(packet, options, true);
  }
  async _getNextInternal(packet, options, keyframesOnly) {
    const info = this.packetInfos.get(packet);
    if (!info) {
      throw new Error("Packet was not created from this track.");
    }
    const nextPacket = keyframesOnly ? await info.track._backing.getNextKeyPacket(info.sourcePacket, options) : await info.track._backing.getNextPacket(info.sourcePacket, options);
    if (nextPacket) {
      return this.createAdjustedPacket(nextPacket, info.segment, info.track);
    }
    let currentSegment = info.segment;
    while (true) {
      const nextSegment = await this.segmentedInput.getNextSegment(currentSegment, {
        skipLiveWait: options.skipLiveWait
      });
      if (!nextSegment) {
        return null;
      }
      const nextInput = this.segmentedInput.getInputForSegment(nextSegment);
      const nextTracks = await nextInput.getTracks();
      const nextTrack = nextTracks.find((t) => t.type === info.track.type && t.number === info.track.number);
      if (!nextTrack) {
        currentSegment = nextSegment;
        continue;
      }
      const firstPacket = await nextTrack._backing.getFirstPacket(options);
      if (!firstPacket) {
        return null;
      }
      return this.createAdjustedPacket(firstPacket, nextSegment, nextTrack);
    }
  }
  getPacket(timestamp, options) {
    return this._getPacketInternal(timestamp, options, false);
  }
  getKeyPacket(timestamp, options) {
    return this._getPacketInternal(timestamp, options, true);
  }
  async _getPacketInternal(timestamp, options, keyframesOnly) {
    let currentSegment = await this.segmentedInput.getSegmentAt(timestamp, {
      skipLiveWait: options.skipLiveWait
    });
    if (!currentSegment) {
      return null;
    }
    await this.hydrate();
    while (currentSegment) {
      const input = this.segmentedInput.getInputForSegment(currentSegment);
      const tracks = await input.getTracks();
      const track = tracks.find((t) => t.type === this.firstInputTrack.type && t.number === this.firstInputTrack.number);
      if (!track) {
        currentSegment = await this.segmentedInput.getPreviousSegment(currentSegment, {
          skipLiveWait: options.skipLiveWait
        });
        continue;
      }
      const mediaOffset = await this.segmentedInput.getMediaOffset(currentSegment, input);
      const offsetTimestamp = timestamp - mediaOffset;
      const packet = keyframesOnly ? await track._backing.getKeyPacket(offsetTimestamp, options) : await track._backing.getPacket(offsetTimestamp, options);
      if (!packet) {
        currentSegment = await this.segmentedInput.getPreviousSegment(currentSegment, {
          skipLiveWait: options.skipLiveWait
        });
        continue;
      }
      return this.createAdjustedPacket(packet, currentSegment, track);
    }
    return null;
  }
}

class SegmentedInputInputVideoTrackBacking extends SegmentedInputInputTrackBacking {
  getType() {
    return "video";
  }
  getCodec() {
    return this.delegate(() => this.firstInputTrack._backing.getCodec());
  }
  getCodedWidth() {
    return this.delegate(() => this.firstInputTrack._backing.getCodedWidth());
  }
  getCodedHeight() {
    return this.delegate(() => this.firstInputTrack._backing.getCodedHeight());
  }
  getSquarePixelWidth() {
    return this.delegate(() => this.firstInputTrack._backing.getSquarePixelWidth());
  }
  getSquarePixelHeight() {
    return this.delegate(() => this.firstInputTrack._backing.getSquarePixelHeight());
  }
  getRotation() {
    return this.delegate(() => this.firstInputTrack._backing.getRotation());
  }
  async getColorSpace() {
    return this.delegate(() => this.firstInputTrack._backing.getColorSpace());
  }
  async canBeTransparent() {
    return this.delegate(() => this.firstInputTrack._backing.canBeTransparent());
  }
  async getDecoderConfig() {
    return this.delegate(() => this.firstInputTrack._backing.getDecoderConfig());
  }
}

class SegmentedInputInputAudioTrackBacking extends SegmentedInputInputTrackBacking {
  getType() {
    return "audio";
  }
  getCodec() {
    return this.delegate(() => this.firstInputTrack._backing.getCodec());
  }
  getNumberOfChannels() {
    return this.delegate(() => this.firstInputTrack._backing.getNumberOfChannels());
  }
  getSampleRate() {
    return this.delegate(() => this.firstInputTrack._backing.getSampleRate());
  }
  async getDecoderConfig() {
    return this.delegate(() => this.firstInputTrack._backing.getDecoderConfig());
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/source.js
var nodeAlias = (() => ({}));
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
polyfillSymbolDispose();
var DEFAULT_MIN_READ_POSITION = 0;
var DEFAULT_MAX_READ_POSITION = Infinity;
var sourceFinalizationRegistry = null;
if (typeof FinalizationRegistry !== "undefined") {
  sourceFinalizationRegistry = new FinalizationRegistry((cleanup) => {
    cleanup();
  });
}

class Source extends EventEmitter {
  constructor() {
    super();
    this._disposed = false;
    this._refCount = 0;
    this._usedForHls = false;
    this._refFinalizationRegistry = null;
    this._sizePromise = null;
    this.onread = null;
    if (typeof FinalizationRegistry !== "undefined") {
      this._refFinalizationRegistry = new FinalizationRegistry((source) => {
        source._decrementRefCount();
      });
    }
  }
  async getSizeOrNull() {
    if (this._disposed) {
      throw new InputDisposedError;
    }
    return this._sizePromise ??= (async () => {
      let size = this._getFileSize();
      if (size !== undefined) {
        return size;
      }
      await this._read(0, 1, DEFAULT_MIN_READ_POSITION, DEFAULT_MAX_READ_POSITION);
      size = this._getFileSize();
      assert(size !== undefined);
      return size;
    })();
  }
  async getSize() {
    if (this._disposed) {
      throw new InputDisposedError;
    }
    const result = await this.getSizeOrNull();
    if (result === null) {
      throw new Error("Cannot determine the size of an unsized source.");
    }
    return result;
  }
  slice(offset, length) {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new TypeError("offset must be a non-negative integer.");
    }
    if (length !== undefined && (!Number.isInteger(length) || length < 0)) {
      throw new TypeError("length, when provided, must be a non-negative integer.");
    }
    return new RangedSource(this, offset, length);
  }
  _dispatchRead(start, end) {
    this.onread?.(start, end);
    this._emit("read", { start, end });
  }
  ref() {
    return new SourceRef(this);
  }
  _incrementRefCount() {
    this._refCount++;
  }
  _decrementRefCount() {
    this._refCount--;
    if (this._refCount === 0) {
      this._dispose();
      this._disposed = true;
    }
  }
}

class SourceRef {
  constructor(source) {
    this._freed = false;
    if (source._disposed) {
      throw new Error("Cannot ref a disposed source.");
    }
    source._incrementRefCount();
    source._refFinalizationRegistry?.register(this, source, this);
    this._source = source;
  }
  get source() {
    if (!this._source) {
      throw new Error("Can't get source; ref has already been freed.");
    }
    return this._source;
  }
  get freed() {
    return this._freed;
  }
  free() {
    if (this._freed) {
      throw new Error("Illegal operation: double free on SourceRef.");
    }
    const source = this.source;
    assert(source._refCount > 0);
    source._decrementRefCount();
    source._refFinalizationRegistry?.unregister(this);
    this._freed = true;
    this._source = null;
  }
  [Symbol.dispose]() {
    if (!this.freed) {
      this.free();
    }
  }
}

class PathedSource extends Source {
  constructor(rootPath, requestHandler) {
    if (typeof rootPath !== "string") {
      throw new TypeError("rootPath must be a string.");
    }
    if (typeof requestHandler !== "function") {
      throw new TypeError("requestHandler must be a function.");
    }
    super();
    this.rootPath = rootPath;
    this.requestHandler = requestHandler;
  }
  _resolveRequest(request) {
    const result = this.requestHandler(request);
    const handle = (result2) => {
      if (!(result2 instanceof Source || result2 instanceof SourceRef)) {
        throw new TypeError("requestHandler must return or resolve to a Source or SourceRef.");
      }
      const ref = result2 instanceof Source ? result2.ref() : result2;
      ref.source._usedForHls ||= this._usedForHls;
      return ref;
    };
    if (result instanceof Promise) {
      return result.then(handle);
    } else {
      return handle(result);
    }
  }
}
var sourceRequestsAreEqual = (a, b) => {
  return a.path === b.path;
};

class CustomPathedSource extends PathedSource {
  constructor() {
    super(...arguments);
    this._root = null;
    this._rootRequest = null;
  }
  _read(start, end, minReadPosition, maxReadPosition) {
    if (!this._root) {
      if (!this._rootRequest) {
        const result = this._resolveRequest({ path: this.rootPath, isRoot: true });
        const handle = (result2) => {
          const ref = result2 instanceof Source ? result2.ref() : result2;
          this._root = ref;
          this._rootRequest = null;
          return ref;
        };
        if (result instanceof Promise) {
          this._rootRequest = result.then(handle);
        } else {
          handle(result);
          assert(this._root);
        }
      }
      if (this._rootRequest) {
        return this._rootRequest.then((ref) => ref.source._read(start, end, minReadPosition, maxReadPosition));
      }
    }
    return this._root.source._read(start, end, minReadPosition, maxReadPosition);
  }
  _getFileSize() {
    if (this._root) {
      return this._root.source._getFileSize();
    }
    return;
  }
  _dispose() {
    if (this._root) {
      this._root.free();
    } else if (this._rootRequest) {
      this._rootRequest.then((ref) => ref.free());
    }
  }
}
var URL_SOURCE_MIN_LOAD_AMOUNT = 0.5 * 2 ** 20;
var DEFAULT_RETRY_DELAY = (previousAttempts, error, src) => {
  const couldBeCorsError = error instanceof Error && (error.message.includes("Failed to fetch") || error.message.includes("Load failed") || error.message.includes("NetworkError when attempting to fetch resource")) && typeof window !== "undefined";
  if (couldBeCorsError) {
    let originOfSrc = null;
    try {
      if (typeof window !== "undefined" && typeof window.location !== "undefined") {
        originOfSrc = new URL(src instanceof Request ? src.url : src, window.location.href).origin;
      }
    } catch {}
    const isOnline = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true;
    if (isOnline && originOfSrc !== null && originOfSrc !== window.location.origin) {
      console.warn(`Request will not be retried because a CORS error was suspected due to different origins. You can` + ` modify this behavior by providing your own function for the 'getRetryDelay' option.`);
      return null;
    }
  }
  return Math.min(2 ** (previousAttempts - 2), 16);
};
var warnedOrigins = new Set;

class UrlSource extends PathedSource {
  constructor(url, options = {}) {
    if (typeof url !== "string" && !(url instanceof URL) && !(typeof Request !== "undefined" && url instanceof Request)) {
      throw new TypeError("url must be a string, URL or Request.");
    }
    if (!options || typeof options !== "object") {
      throw new TypeError("options must be an object.");
    }
    if (options.requestInit !== undefined && (!options.requestInit || typeof options.requestInit !== "object")) {
      throw new TypeError("options.requestInit, when provided, must be an object.");
    }
    if (options.getRetryDelay !== undefined && typeof options.getRetryDelay !== "function") {
      throw new TypeError("options.getRetryDelay, when provided, must be a function.");
    }
    if (options.maxCacheSize !== undefined && (!isNumber(options.maxCacheSize) || options.maxCacheSize < 0)) {
      throw new TypeError("options.maxCacheSize, when provided, must be a non-negative number.");
    }
    if (options.parallelism !== undefined && (!Number.isInteger(options.parallelism) || options.parallelism < 1)) {
      throw new TypeError("options.parallelism, when provided, must be a positive number.");
    }
    if (options.fetchFn !== undefined && typeof options.fetchFn !== "function") {
      throw new TypeError("options.fetchFn, when provided, must be a function.");
    }
    const urlString = url instanceof Request ? url.url : url instanceof URL ? url.href : url;
    super(urlString, (request) => new UrlSource(request.path, this._options));
    this._offset = 0;
    this._length = null;
    this._fileSizeDetermined = false;
    this._url = url;
    this._options = options;
    this._getRetryDelay = options.getRetryDelay ?? DEFAULT_RETRY_DELAY;
    this._requestInit = { ...options.requestInit };
    let rangeHeaderValue = null;
    if (options.requestInit?.headers) {
      const headers = { ...normalizeHeaders(options.requestInit.headers) };
      const rangeKey = Object.keys(headers).find((key) => key.toLowerCase() === "range");
      if (rangeKey !== undefined) {
        rangeHeaderValue = headers[rangeKey];
        delete headers[rangeKey];
        this._requestInit.headers = headers;
      }
    }
    if (url instanceof Request) {
      const requestRange = url.headers.get("Range");
      if (requestRange !== null) {
        rangeHeaderValue ??= requestRange;
        const strippedRequest = new Request(url);
        strippedRequest.headers.delete("Range");
        this._url = strippedRequest;
      }
    }
    if (rangeHeaderValue !== null) {
      const parsed = parseByteRangeHeader(rangeHeaderValue);
      if (parsed) {
        this._offset = parsed.offset;
        this._length = parsed.length;
      }
    }
    const DEFAULT_PARALLELISM = 2;
    this._orchestrator = new ReadOrchestrator({
      maxCacheSize: options.maxCacheSize ?? 64 * 2 ** 20,
      maxWorkerCount: options.parallelism ?? DEFAULT_PARALLELISM,
      runWorker: this._runWorker.bind(this),
      prefetchProfile: PREFETCH_PROFILES.network
    });
  }
  _getFileSize() {
    if (!this._fileSizeDetermined) {
      return this._length !== null ? this._length : undefined;
    }
    const baseSize = this._orchestrator.fileSize;
    if (baseSize === null) {
      return this._length !== null ? this._length : null;
    }
    return clamp(baseSize - this._offset, 0, this._length ?? Infinity);
  }
  _read(start, end, minReadPosition, maxReadPosition) {
    if (this._length !== null && end > this._length) {
      return null;
    }
    const offset = this._offset;
    const result = this._orchestrator.read(offset + start, offset + end, Math.max(offset + minReadPosition, offset), offset + Math.min(maxReadPosition, this._length ?? Infinity));
    const processResult = (result2) => {
      if (!result2) {
        return null;
      }
      result2.offset -= this._offset;
      return result2;
    };
    if (result instanceof Promise) {
      return result.then(processResult);
    } else {
      return processResult(result);
    }
  }
  async _runWorker(worker) {
    while (true) {
      const abortController = new AbortController;
      const response = await retriedFetch(this._options.fetchFn ?? fetch, this._url, mergeRequestInit(this._requestInit, {
        headers: {
          Range: `bytes=${worker.currentPos}-`
        },
        signal: abortController.signal
      }), this._getRetryDelay, () => this._disposed);
      if (!response.ok) {
        throw new Error(`Error fetching ${String(this._url)}: ${response.status} ${response.statusText}`);
      }
      outer:
        if (this._orchestrator.fileSize === null) {
          const contentRange = response.headers.get("Content-Range");
          if (contentRange) {
            const match = /\/(\d+)/.exec(contentRange);
            if (match) {
              this._orchestrator.supplyFileSize(Number(match[1]));
              break outer;
            }
          }
          const contentLength = response.headers.get("Content-Length");
          if (contentLength) {
            this._orchestrator.supplyFileSize(worker.currentPos + Number(contentLength));
          }
        }
      this._fileSizeDetermined = true;
      if (response.status !== 206) {
        if (!this._usedForHls) {
          const url = new URL(this._url instanceof Request ? this._url.url : this._url, typeof window !== "undefined" ? window.location.href : undefined);
          if (url.origin !== "null" && !(url.pathname.endsWith(".m3u8") || url.pathname.endsWith(".m3u"))) {
            if (!warnedOrigins.has(url.origin)) {
              console.log(this._usedForHls, this._url, url.pathname);
              console.warn(`HTTP server (origin ${url.origin}) did not respond to a range request with 206 Partial` + " Content, meaning the entire resource will now be downloaded. To enable efficient" + " media file streaming across a network, please make sure your server supports" + " range requests.");
              warnedOrigins.add(url.origin);
            }
          }
        }
        worker.currentPos = 0;
        this._orchestrator.options.maxCacheSize = Infinity;
        if (this._orchestrator.fileSize !== null) {
          worker.targetPos = this._orchestrator.fileSize;
        } else {
          worker.targetPos = Infinity;
          worker.strictTarget = false;
        }
        this._orchestrator.consolidateEverythingIntoOneWorker(worker);
      }
      if (!response.body) {
        throw new Error("Missing HTTP response body stream. The used fetch function must provide the response body as a" + " ReadableStream.");
      }
      const reader = response.body.getReader();
      while (true) {
        if (worker.currentPos >= worker.targetPos || worker.aborted) {
          abortController.abort();
          this._orchestrator.signalWorkerStoppedRunning(worker);
          return;
        }
        let readResult;
        try {
          readResult = await reader.read();
        } catch (error) {
          if (this._disposed) {
            throw error;
          }
          const retryDelayInSeconds = this._getRetryDelay(1, error, this._url);
          if (retryDelayInSeconds !== null) {
            console.error("Error while reading response stream. Attempting to resume.", error);
            await wait(1000 * retryDelayInSeconds);
            break;
          } else {
            throw error;
          }
        }
        if (worker.aborted) {
          continue;
        }
        const { done, value } = readResult;
        if (done) {
          if (worker.currentPos >= worker.targetPos) {
            this._orchestrator.onWorkerFinished(worker);
            return;
          }
          if (worker.strictTarget) {
            break;
          } else {
            this._orchestrator.onWorkerFinished(worker);
            return;
          }
        }
        this._dispatchRead(worker.currentPos, worker.currentPos + value.length);
        this._orchestrator.supplyWorkerData(worker, value);
      }
    }
  }
  _dispose() {
    this._orchestrator.dispose();
  }
}
var BYTE_RANGE_REGEX = /^bytes=(\d+)-(\d*)$/;
var parseByteRangeHeader = (value) => {
  const match = BYTE_RANGE_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }
  const offset = Number(match[1]);
  const end = match[2] === "" ? null : Number(match[2]);
  if (end !== null && end < offset) {
    return null;
  }
  return {
    offset,
    length: end !== null ? end - offset + 1 : null
  };
};
class ReadableStreamSource extends Source {
  constructor(stream, options = {}) {
    if (!(stream instanceof ReadableStream)) {
      throw new TypeError("stream must be a ReadableStream.");
    }
    if (!options || typeof options !== "object") {
      throw new TypeError("options must be an object.");
    }
    if (options.maxCacheSize !== undefined && (!isNumber(options.maxCacheSize) || options.maxCacheSize < 0)) {
      throw new TypeError("options.maxCacheSize, when provided, must be a non-negative number.");
    }
    super();
    this._reader = null;
    this._cache = [];
    this._pendingSlices = [];
    this._currentIndex = 0;
    this._targetIndex = 0;
    this._maxRequestedIndex = 0;
    this._endIndex = null;
    this._pulling = false;
    this._stream = stream;
    this._maxCacheSize = options.maxCacheSize ?? 32 * 2 ** 20;
  }
  _getFileSize() {
    return this._endIndex;
  }
  _read(start, end) {
    if (this._endIndex !== null && end > this._endIndex) {
      return null;
    }
    this._maxRequestedIndex = Math.max(this._maxRequestedIndex, end);
    const cacheStartIndex = binarySearchLessOrEqual(this._cache, start, (x) => x.start);
    const cacheStartEntry = cacheStartIndex !== -1 ? this._cache[cacheStartIndex] : null;
    if (cacheStartEntry && cacheStartEntry.start <= start && end <= cacheStartEntry.end) {
      return {
        bytes: cacheStartEntry.bytes,
        view: cacheStartEntry.view,
        offset: cacheStartEntry.start
      };
    }
    let lastEnd = start;
    const bytes = new Uint8Array(end - start);
    if (cacheStartIndex !== -1) {
      for (let i = cacheStartIndex;i < this._cache.length; i++) {
        const cacheEntry = this._cache[i];
        if (cacheEntry.start >= end) {
          break;
        }
        const cappedStart = Math.max(start, cacheEntry.start);
        if (cappedStart > lastEnd) {
          this._throwDueToCacheMiss();
        }
        const cappedEnd = Math.min(end, cacheEntry.end);
        if (cappedStart < cappedEnd) {
          bytes.set(cacheEntry.bytes.subarray(cappedStart - cacheEntry.start, cappedEnd - cacheEntry.start), cappedStart - start);
          lastEnd = cappedEnd;
        }
      }
    }
    if (lastEnd === end) {
      return {
        bytes,
        view: toDataView(bytes),
        offset: start
      };
    }
    if (this._currentIndex > lastEnd) {
      this._throwDueToCacheMiss();
    }
    const { promise, resolve, reject } = promiseWithResolvers();
    this._pendingSlices.push({
      start,
      end,
      bytes,
      resolve,
      reject
    });
    this._targetIndex = Math.max(this._targetIndex, end);
    if (!this._pulling) {
      this._pulling = true;
      this._pull().catch((error) => {
        this._pulling = false;
        if (this._pendingSlices.length > 0) {
          this._pendingSlices.forEach((x) => x.reject(error));
          this._pendingSlices.length = 0;
        } else {
          throw error;
        }
      });
    }
    return promise;
  }
  _throwDueToCacheMiss() {
    throw new Error("Read is before the cached region. With ReadableStreamSource, you must access the data more" + " sequentially or increase the size of its cache.");
  }
  async _pull() {
    this._reader ??= this._stream.getReader();
    while (this._currentIndex < this._targetIndex && !this._disposed) {
      const { done, value } = await this._reader.read();
      if (done) {
        for (const pendingSlice of this._pendingSlices) {
          pendingSlice.resolve(null);
        }
        this._pendingSlices.length = 0;
        this._endIndex = this._currentIndex;
        break;
      }
      const startIndex = this._currentIndex;
      const endIndex = this._currentIndex + value.byteLength;
      this._dispatchRead(startIndex, endIndex);
      for (let i = 0;i < this._pendingSlices.length; i++) {
        const pendingSlice = this._pendingSlices[i];
        const cappedStart = Math.max(startIndex, pendingSlice.start);
        const cappedEnd = Math.min(endIndex, pendingSlice.end);
        if (cappedStart < cappedEnd) {
          pendingSlice.bytes.set(value.subarray(cappedStart - startIndex, cappedEnd - startIndex), cappedStart - pendingSlice.start);
          if (cappedEnd === pendingSlice.end) {
            pendingSlice.resolve({
              bytes: pendingSlice.bytes,
              view: toDataView(pendingSlice.bytes),
              offset: pendingSlice.start
            });
            this._pendingSlices.splice(i, 1);
            i--;
          }
        }
      }
      this._cache.push({
        start: startIndex,
        end: endIndex,
        bytes: value,
        view: toDataView(value),
        age: 0
      });
      while (this._cache.length > 0) {
        const firstEntry = this._cache[0];
        const distance = this._maxRequestedIndex - firstEntry.end;
        if (distance <= this._maxCacheSize) {
          break;
        }
        this._cache.shift();
      }
      this._currentIndex += value.byteLength;
    }
    this._pulling = false;
  }
  _dispose() {
    this._pendingSlices.length = 0;
    this._cache.length = 0;
    this._reader?.cancel();
  }
}
var PREFETCH_PROFILES = {
  none: (start, end) => ({ start, end }),
  fileSystem: (start, end) => {
    const padding = 2 ** 16;
    start = Math.floor((start - padding) / padding) * padding;
    end = Math.ceil((end + padding) / padding) * padding;
    return { start, end };
  },
  network: (start, end, workers) => {
    const paddingStart = 2 ** 16;
    start = Math.max(0, Math.floor((start - paddingStart) / paddingStart) * paddingStart);
    for (const worker of workers) {
      const maxExtensionAmount = 8 * 2 ** 20;
      const thresholdPoint = Math.max((worker.startPos + worker.targetPos) / 2, worker.targetPos - maxExtensionAmount);
      if (closedIntervalsOverlap(start, end, thresholdPoint, worker.targetPos)) {
        const size = worker.targetPos - worker.startPos;
        const a = Math.ceil((size + 1) / maxExtensionAmount) * maxExtensionAmount;
        const b = 2 ** Math.ceil(Math.log2(size + 1));
        const extent = Math.min(b, a);
        end = Math.max(end, worker.startPos + extent);
      }
    }
    end = Math.max(end, start + URL_SOURCE_MIN_LOAD_AMOUNT);
    return {
      start,
      end
    };
  }
};

class ReadOrchestrator {
  constructor(options) {
    this.options = options;
    this.fileSize = null;
    this.nextAge = 0;
    this.workers = [];
    this.cache = [];
    this.currentCacheSize = 0;
    this.disposed = false;
    this.queuedReads = [];
  }
  read(innerStart, innerEnd, minReadPosition, maxReadPosition) {
    assert(!this.disposed);
    const prefetchRange = this.options.prefetchProfile(innerStart, innerEnd, this.workers);
    const outerStart = Math.max(prefetchRange.start, minReadPosition);
    const outerEnd = Math.min(prefetchRange.end, this.fileSize ?? Infinity, maxReadPosition);
    assert(outerStart <= innerStart && innerEnd <= outerEnd);
    let result = null;
    const innerCacheStartIndex = binarySearchLessOrEqual(this.cache, innerStart, (x) => x.start);
    const innerStartEntry = innerCacheStartIndex !== -1 ? this.cache[innerCacheStartIndex] : null;
    if (innerStartEntry && innerStartEntry.start <= innerStart && innerEnd <= innerStartEntry.end) {
      innerStartEntry.age = this.nextAge++;
      result = {
        bytes: innerStartEntry.bytes,
        view: innerStartEntry.view,
        offset: innerStartEntry.start
      };
    }
    const outerCacheStartIndex = binarySearchLessOrEqual(this.cache, outerStart, (x) => x.start);
    const bytes = result ? null : new Uint8Array(innerEnd - innerStart);
    let contiguousBytesWriteEnd = 0;
    let lastEnd = outerStart;
    const outerHoles = [];
    if (outerCacheStartIndex !== -1) {
      for (let i = outerCacheStartIndex;i < this.cache.length; i++) {
        const entry = this.cache[i];
        if (entry.start >= outerEnd) {
          break;
        }
        if (entry.end <= outerStart) {
          continue;
        }
        const cappedOuterStart = Math.max(outerStart, entry.start);
        const cappedOuterEnd = Math.min(outerEnd, entry.end);
        assert(cappedOuterStart <= cappedOuterEnd);
        if (lastEnd < cappedOuterStart) {
          outerHoles.push({ start: lastEnd, end: cappedOuterStart });
        }
        lastEnd = cappedOuterEnd;
        if (bytes) {
          const cappedInnerStart = Math.max(innerStart, entry.start);
          const cappedInnerEnd = Math.min(innerEnd, entry.end);
          if (cappedInnerStart < cappedInnerEnd) {
            const relativeOffset = cappedInnerStart - innerStart;
            bytes.set(entry.bytes.subarray(cappedInnerStart - entry.start, cappedInnerEnd - entry.start), relativeOffset);
            if (relativeOffset === contiguousBytesWriteEnd) {
              contiguousBytesWriteEnd = cappedInnerEnd - innerStart;
            }
          }
        }
        entry.age = this.nextAge++;
      }
      if (lastEnd < outerEnd) {
        outerHoles.push({ start: lastEnd, end: outerEnd });
      }
    } else {
      outerHoles.push({ start: outerStart, end: outerEnd });
    }
    if (bytes && contiguousBytesWriteEnd >= bytes.length) {
      result = {
        bytes,
        view: toDataView(bytes),
        offset: innerStart
      };
    }
    if (outerHoles.length === 0) {
      assert(result);
      return result;
    }
    const { promise, resolve, reject } = promiseWithResolvers();
    const innerHoles = [];
    for (const outerHole of outerHoles) {
      const cappedStart = Math.max(innerStart, outerHole.start);
      const cappedEnd = Math.min(innerEnd, outerHole.end);
      if (cappedStart === outerHole.start && cappedEnd === outerHole.end) {
        innerHoles.push(outerHole);
      } else if (cappedStart < cappedEnd) {
        innerHoles.push({ start: cappedStart, end: cappedEnd });
      }
    }
    const pendingSlice = bytes && {
      start: innerStart,
      bytes,
      holes: innerHoles,
      resolve,
      reject
    };
    outer:
      for (const outerHole of outerHoles) {
        for (const worker of this.workers) {
          const addedToWorker = this.checkHoleAgainstWorker(worker, outerHole, pendingSlice ? [pendingSlice] : []);
          if (addedToWorker) {
            this.checkQueuedReadsAgainstWorker(worker);
            continue outer;
          }
        }
        const strictTarget = outerHole.end < outerEnd || this.fileSize !== null;
        const newWorker = this.createWorker(outerHole.start, outerHole.end, strictTarget);
        if (newWorker) {
          if (pendingSlice) {
            newWorker.pendingSlices = [pendingSlice];
          }
          this.runWorker(newWorker);
        } else {
          let index = binarySearchLessOrEqual(this.queuedReads, outerHole.start, (x) => x.hole.start);
          let entry = index !== -1 ? this.queuedReads[index] : null;
          if (entry && outerHole.start <= entry.hole.end) {
            entry.hole.end = Math.max(entry.hole.end, outerHole.end);
            entry.strictTarget &&= strictTarget;
            if (pendingSlice) {
              entry.pendingSlices.push(pendingSlice);
            }
          } else {
            index++;
            entry = {
              hole: {
                start: outerHole.start,
                end: outerHole.end
              },
              strictTarget,
              pendingSlices: pendingSlice ? [pendingSlice] : [],
              age: this.nextAge++
            };
            this.queuedReads.splice(index, 0, entry);
          }
          while (index + 1 < this.queuedReads.length) {
            const nextEntry = this.queuedReads[index + 1];
            if (nextEntry.hole.start > entry.hole.end) {
              break;
            }
            entry.hole.end = Math.max(entry.hole.end, nextEntry.hole.end);
            entry.pendingSlices.push(...nextEntry.pendingSlices);
            entry.strictTarget &&= nextEntry.strictTarget;
            entry.age = Math.min(entry.age, nextEntry.age);
            this.queuedReads.splice(index + 1, 1);
          }
        }
      }
    if (!result) {
      assert(bytes);
      result = promise.then((bytes2) => bytes2 && {
        bytes: bytes2,
        view: toDataView(bytes2),
        offset: innerStart
      });
    } else {}
    return result;
  }
  checkHoleAgainstWorker(worker, hole, pendingSlices) {
    const gapTolerance = 2 ** 17;
    if (closedIntervalsOverlap(hole.start - gapTolerance, hole.start, worker.currentPos, worker.targetPos)) {
      worker.targetPos = Math.max(worker.targetPos, hole.end);
      for (let i = 0;i < pendingSlices.length; i++) {
        const pendingSlice = pendingSlices[i];
        if (!worker.pendingSlices.includes(pendingSlice)) {
          worker.pendingSlices.push(pendingSlice);
        }
      }
      if (!worker.running) {
        this.runWorker(worker);
      }
      return true;
    }
    return false;
  }
  checkQueuedReadsAgainstWorker(worker) {
    let wasTrueOnce = false;
    for (let i = 0;i < this.queuedReads.length; i++) {
      const queuedRead = this.queuedReads[i];
      const result = this.checkHoleAgainstWorker(worker, queuedRead.hole, queuedRead.pendingSlices);
      if (result) {
        this.queuedReads.splice(i, 1);
        i--;
        wasTrueOnce = true;
      } else if (wasTrueOnce) {
        break;
      }
    }
  }
  createWorker(startPos, targetPos, strictTarget) {
    if (this.workers.length >= this.options.maxWorkerCount) {
      let oldestWorker = null;
      let oldestIndex = null;
      for (let i = 0;i < this.workers.length; i++) {
        const worker2 = this.workers[i];
        if (!worker2.running && worker2.pendingSlices.length === 0 && (!oldestWorker || worker2.age < oldestWorker.age)) {
          oldestIndex = i;
          oldestWorker = worker2;
        }
      }
      if (oldestWorker) {
        assert(oldestIndex !== null);
        assert(oldestWorker.pendingSlices.length === 0);
        this.workers.splice(oldestIndex, 1);
      } else {
        return null;
      }
    }
    const worker = {
      startPos,
      currentPos: startPos,
      targetPos,
      strictTarget,
      running: false,
      aborted: this.disposed,
      pendingSlices: [],
      age: this.nextAge++
    };
    this.workers.push(worker);
    return worker;
  }
  runWorker(worker) {
    assert(!worker.running);
    assert(worker.currentPos < worker.targetPos);
    worker.running = true;
    worker.age = this.nextAge++;
    this.options.runWorker(worker).catch((error) => {
      worker.running = false;
      if (worker.pendingSlices.length > 0) {
        worker.pendingSlices.forEach((x) => x.reject(error));
        worker.pendingSlices.length = 0;
      } else {
        throw error;
      }
    }).finally(() => {
      if (worker.running) {
        return;
      }
      if (this.queuedReads.length > 0) {
        let oldestIndex = 0;
        for (let i = 1;i < this.queuedReads.length; i++) {
          const queuedRead2 = this.queuedReads[i];
          if (queuedRead2.age < this.queuedReads[oldestIndex].age) {
            oldestIndex = i;
          }
        }
        const queuedRead = this.queuedReads[oldestIndex];
        this.queuedReads.splice(oldestIndex, 1);
        const newWorker = this.createWorker(queuedRead.hole.start, queuedRead.hole.end, queuedRead.strictTarget);
        assert(newWorker);
        newWorker.pendingSlices = queuedRead.pendingSlices;
        this.runWorker(newWorker);
      }
    });
  }
  consolidateEverythingIntoOneWorker(worker) {
    const uniqueSlices = new Set(worker.pendingSlices);
    for (let i = 0;i < this.workers.length; i++) {
      const otherWorker = this.workers[i];
      if (otherWorker === worker) {
        continue;
      }
      for (const slice of otherWorker.pendingSlices) {
        uniqueSlices.add(slice);
      }
      otherWorker.aborted = true;
      otherWorker.pendingSlices.length = 0;
      this.workers.splice(i, 1);
      i--;
    }
    for (let i = 0;i < this.queuedReads.length; i++) {
      const queuedRead = this.queuedReads[i];
      for (const slice of queuedRead.pendingSlices) {
        uniqueSlices.add(slice);
      }
    }
    worker.pendingSlices = [...uniqueSlices];
    this.queuedReads.length = 0;
  }
  supplyWorkerData(worker, bytes) {
    assert(!worker.aborted);
    const start = worker.currentPos;
    const end = start + bytes.length;
    this.insertIntoCache({
      start,
      end,
      bytes,
      view: toDataView(bytes),
      age: this.nextAge++
    });
    worker.currentPos += bytes.length;
    if (worker.currentPos > worker.targetPos) {
      worker.targetPos = worker.currentPos;
      this.checkQueuedReadsAgainstWorker(worker);
    }
    for (let i = 0;i < worker.pendingSlices.length; i++) {
      const pendingSlice = worker.pendingSlices[i];
      const clampedStart = Math.max(start, pendingSlice.start);
      const clampedEnd = Math.min(end, pendingSlice.start + pendingSlice.bytes.length);
      if (clampedStart < clampedEnd) {
        pendingSlice.bytes.set(bytes.subarray(clampedStart - start, clampedEnd - start), clampedStart - pendingSlice.start);
      }
      for (let j = 0;j < pendingSlice.holes.length; j++) {
        const hole = pendingSlice.holes[j];
        if (start <= hole.start && end > hole.start) {
          hole.start = end;
        }
        if (hole.end <= hole.start) {
          pendingSlice.holes.splice(j, 1);
          j--;
        }
      }
      if (pendingSlice.holes.length === 0) {
        pendingSlice.resolve(pendingSlice.bytes);
        worker.pendingSlices.splice(i, 1);
        i--;
      }
    }
    for (let i = 0;i < this.workers.length; i++) {
      const otherWorker = this.workers[i];
      if (worker === otherWorker || otherWorker.running) {
        continue;
      }
      if (closedIntervalsOverlap(start, end, otherWorker.currentPos, otherWorker.targetPos)) {
        this.workers.splice(i, 1);
        i--;
      }
    }
  }
  supplyFileSize(size) {
    assert(this.fileSize === null);
    this.fileSize = size;
    for (const worker of this.workers) {
      worker.targetPos = Math.min(worker.targetPos, size);
      worker.strictTarget = true;
      for (let i = 0;i < worker.pendingSlices.length; i++) {
        const pendingSlice = worker.pendingSlices[i];
        for (const hole of pendingSlice.holes) {
          if (hole.end > size) {
            pendingSlice.resolve(null);
            worker.pendingSlices.splice(i, 1);
            i--;
            break;
          }
        }
      }
    }
    for (let i = 0;i < this.queuedReads.length; i++) {
      const queuedRead = this.queuedReads[i];
      if (queuedRead.hole.start >= size) {
        for (const slice of queuedRead.pendingSlices)
          slice.resolve(null);
        this.queuedReads.splice(i, 1);
        i--;
      } else if (queuedRead.hole.end > size) {
        queuedRead.hole.end = size;
        queuedRead.strictTarget = true;
        for (let j = 0;j < queuedRead.pendingSlices.length; j++) {
          const slice = queuedRead.pendingSlices[j];
          if (slice.start >= size) {
            slice.resolve(null);
            queuedRead.pendingSlices.splice(j, 1);
            j--;
          }
        }
      }
    }
  }
  signalWorkerStoppedRunning(worker) {
    worker.running = false;
    worker.pendingSlices.length = 0;
  }
  onWorkerFinished(worker) {
    const index = this.workers.indexOf(worker);
    assert(index !== -1);
    worker.running = false;
    this.workers.splice(index, 1);
    if (this.fileSize === null) {
      this.supplyFileSize(worker.currentPos);
    }
    for (const pendingSlice of worker.pendingSlices) {
      pendingSlice.resolve(null);
    }
  }
  insertIntoCache(entry) {
    if (this.options.maxCacheSize === 0) {
      return;
    }
    let insertionIndex = binarySearchLessOrEqual(this.cache, entry.start, (x) => x.start) + 1;
    if (insertionIndex > 0) {
      const previous = this.cache[insertionIndex - 1];
      if (previous.end >= entry.end) {
        return;
      }
      if (previous.end > entry.start) {
        const joined = new Uint8Array(entry.end - previous.start);
        joined.set(previous.bytes, 0);
        joined.set(entry.bytes, entry.start - previous.start);
        this.currentCacheSize += entry.end - previous.end;
        previous.bytes = joined;
        previous.view = toDataView(joined);
        previous.end = entry.end;
        insertionIndex--;
        entry = previous;
      } else {
        this.cache.splice(insertionIndex, 0, entry);
        this.currentCacheSize += entry.bytes.length;
      }
    } else {
      this.cache.splice(insertionIndex, 0, entry);
      this.currentCacheSize += entry.bytes.length;
    }
    for (let i = insertionIndex + 1;i < this.cache.length; i++) {
      const next = this.cache[i];
      if (entry.end <= next.start) {
        break;
      }
      if (entry.end >= next.end) {
        this.cache.splice(i, 1);
        this.currentCacheSize -= next.bytes.length;
        i--;
        continue;
      }
      const joined = new Uint8Array(next.end - entry.start);
      joined.set(entry.bytes, 0);
      joined.set(next.bytes, next.start - entry.start);
      this.currentCacheSize -= entry.end - next.start;
      entry.bytes = joined;
      entry.view = toDataView(joined);
      entry.end = next.end;
      this.cache.splice(i, 1);
      break;
    }
    while (this.currentCacheSize > this.options.maxCacheSize) {
      let oldestIndex = 0;
      let oldestEntry = this.cache[0];
      for (let i = 1;i < this.cache.length; i++) {
        const entry2 = this.cache[i];
        if (entry2.age < oldestEntry.age) {
          oldestIndex = i;
          oldestEntry = entry2;
        }
      }
      if (this.currentCacheSize - oldestEntry.bytes.length <= this.options.maxCacheSize) {
        break;
      }
      this.cache.splice(oldestIndex, 1);
      this.currentCacheSize -= oldestEntry.bytes.length;
    }
  }
  dispose() {
    for (const worker of this.workers) {
      worker.aborted = true;
    }
    this.workers.length = 0;
    this.cache.length = 0;
    this.disposed = true;
  }
}
class RangedSource extends Source {
  constructor(baseSource, offset, length) {
    super();
    this._ref = null;
    if (baseSource._disposed) {
      throw new Error("Cannot create a slice of a disposed source.");
    }
    this._baseSource = baseSource;
    this._offset = offset;
    this._length = length ?? null;
  }
  _getFileSize() {
    const baseSize = this._baseSource._getFileSize();
    if (baseSize === undefined) {
      return this._length !== null ? this._length : undefined;
    }
    if (baseSize === null) {
      if (this._length !== null) {
        return this._length;
      } else {
        return null;
      }
    }
    return clamp(baseSize - this._offset, 0, this._length ?? Infinity);
  }
  _read(start, end, minReadPosition, maxReadPosition) {
    if (this._length !== null && end > this._length) {
      return null;
    }
    const result = this._baseSource._read(this._offset + start, this._offset + end, this._offset + minReadPosition, this._offset + maxReadPosition);
    const processResult = (result2) => {
      if (!result2) {
        return null;
      }
      result2.offset -= this._offset;
      return result2;
    };
    if (result instanceof Promise) {
      return result.then(processResult);
    } else {
      return processResult(result);
    }
  }
  _dispose() {
    this._ref?.free();
  }
  ref() {
    this._ref ??= this._baseSource.ref();
    return super.ref();
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/hls/hls-segmented-input.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var __addDisposableResource = function(env, value, async) {
  if (value !== null && value !== undefined) {
    if (typeof value !== "object" && typeof value !== "function")
      throw new TypeError("Object expected.");
    var dispose, inner;
    if (async) {
      if (!Symbol.asyncDispose)
        throw new TypeError("Symbol.asyncDispose is not defined.");
      dispose = value[Symbol.asyncDispose];
    }
    if (dispose === undefined) {
      if (!Symbol.dispose)
        throw new TypeError("Symbol.dispose is not defined.");
      dispose = value[Symbol.dispose];
      if (async)
        inner = dispose;
    }
    if (typeof dispose !== "function")
      throw new TypeError("Object not disposable.");
    if (inner)
      dispose = function() {
        try {
          inner.call(this);
        } catch (e) {
          return Promise.reject(e);
        }
      };
    env.stack.push({ value, dispose, async });
  } else if (async) {
    env.stack.push({ async: true });
  }
  return value;
};
var __disposeResources = function(SuppressedError2) {
  return function(env) {
    function fail(e) {
      env.error = env.hasError ? new SuppressedError2(e, env.error, "An error was suppressed during disposal.") : e;
      env.hasError = true;
    }
    var r, s = 0;
    function next() {
      while (r = env.stack.pop()) {
        try {
          if (!r.async && s === 1)
            return s = 0, env.stack.push(r), Promise.resolve().then(next);
          if (r.dispose) {
            var result = r.dispose.call(r.value);
            if (r.async)
              return s |= 2, Promise.resolve(result).then(next, function(e) {
                fail(e);
                return next();
              });
          } else
            s |= 1;
        } catch (e) {
          fail(e);
        }
      }
      if (s === 1)
        return env.hasError ? Promise.reject(env.error) : Promise.resolve();
      if (env.hasError)
        throw env.error;
    }
    return next();
  };
}(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
var IV_STRING_REGEX = /^0[xX][0-9a-fA-F]+$/;
var BASE64_DATA_URI_REGEX = /^data:.*;base64,/i;

class HlsSegmentedInput extends SegmentedInput {
  constructor(demuxer, path, trackDeclarations, lines) {
    super(demuxer.input, path, trackDeclarations);
    this.segments = [];
    this.nextLines = null;
    this.currentUpdateSegmentsPromise = null;
    this.streamHasEnded = false;
    this.lastSegmentUpdateTime = -Infinity;
    this.refreshInterval = 5;
    this.demuxer = demuxer;
    this.nextLines = lines;
  }
  runUpdateSegments() {
    return this.currentUpdateSegmentsPromise ??= (async () => {
      try {
        const remainingWaitTimeMs = this.getRemainingWaitTimeMs();
        if (remainingWaitTimeMs > 0) {
          await wait(remainingWaitTimeMs);
        }
        this.lastSegmentUpdateTime = performance.now();
        await this.updateSegments();
      } finally {
        this.currentUpdateSegmentsPromise = null;
      }
    })();
  }
  getRemainingWaitTimeMs() {
    const elapsed = performance.now() - this.lastSegmentUpdateTime;
    const result = Math.max(0, 1000 * this.refreshInterval - elapsed);
    if (result <= 50) {
      return 0;
    }
    return result;
  }
  async updateSegments() {
    let lines = this.nextLines;
    this.nextLines = null;
    if (!lines) {
      const env_1 = { stack: [], error: undefined, hasError: false };
      try {
        const ref = __addDisposableResource(env_1, await this.demuxer.input._getSourceUncached({ path: this.path, isRoot: false }), false);
        const reader = new Reader(ref.source);
        const slice = await reader.requestEntireFile();
        assert(slice);
        lines = readAllLines(slice, slice.length, { ignore: canIgnoreLine });
      } catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
      } finally {
        __disposeResources(env_1);
      }
    }
    let headerRead = false;
    let accumulatedTime = 0;
    let nextSegmentDuration = null;
    let currentKey = null;
    let nextSequenceNumber = 0;
    let currentFirstSegment = null;
    let currentInitSegment = null;
    let lastByteRangeEnd = null;
    let nextByteRange = null;
    let lastProgramDateTimeSeconds = null;
    let targetDuration = null;
    let segmentSeen = false;
    let prevLastSegment = last(this.segments) ?? null;
    const parseByteRange = (content) => {
      const atIndex = content.indexOf("@");
      const length = Number(atIndex === -1 ? content : content.slice(0, atIndex));
      if (!Number.isInteger(length) || length < 0) {
        throw new Error(`Invalid #EXT-X-BYTERANGE length '${content}'.`);
      }
      let offset = null;
      if (atIndex !== -1) {
        offset = Number(content.slice(atIndex + 1));
        if (!Number.isInteger(offset) || offset < 0) {
          throw new Error(`Invalid #EXT-X-BYTERANGE offset '${content}'.`);
        }
      }
      return { length, offset };
    };
    const setNextSequenceNumber = (number) => {
      nextSequenceNumber = number;
      if (prevLastSegment) {
        assert(prevLastSegment.sequenceNumber !== null);
        if (prevLastSegment.sequenceNumber < number) {
          accumulatedTime = prevLastSegment.timestamp + prevLastSegment.duration;
          currentFirstSegment = prevLastSegment.firstSegment;
          currentInitSegment = prevLastSegment.initSegment;
          lastProgramDateTimeSeconds = prevLastSegment.lastProgramDateTimeSeconds;
          prevLastSegment = null;
        }
      }
    };
    for (let i = 0;i < lines.length; i++) {
      const line = lines[i];
      if (!headerRead) {
        if (line !== "#EXTM3U") {
          throw new Error("Invalid M3U8 file; expected first line to be #EXTM3U.");
        }
        headerRead = true;
        continue;
      }
      if (!line.startsWith("#")) {
        if (!prevLastSegment) {
          if (nextSegmentDuration === null) {
            throw new Error("Invalid M3U8 file; a segment must be preceded by an #EXTINF tag.");
          }
          let key = currentKey;
          if (key && key.method === "AES-128" && !key.iv) {
            const iv = new Uint8Array(AES_128_BLOCK_SIZE);
            const view = toDataView(iv);
            view.setUint32(8, Math.floor(nextSequenceNumber / 2 ** 32));
            view.setUint32(12, nextSequenceNumber);
            key = { ...key, iv };
          }
          const fullPath = joinPaths(this.path, line);
          const location = {
            path: fullPath,
            offset: nextByteRange?.offset ?? 0,
            length: nextByteRange?.length ?? null
          };
          const segment = {
            timestamp: accumulatedTime,
            relativeToUnixEpoch: lastProgramDateTimeSeconds !== null,
            firstSegment: currentFirstSegment,
            sequenceNumber: nextSequenceNumber,
            location,
            duration: nextSegmentDuration,
            encryption: key,
            initSegment: currentInitSegment,
            lastProgramDateTimeSeconds
          };
          currentFirstSegment ??= segment;
          accumulatedTime += nextSegmentDuration;
          this.segments.push(segment);
        } else {}
        nextSegmentDuration = null;
        if (nextByteRange === null) {
          lastByteRangeEnd = null;
        } else {
          nextByteRange = null;
        }
        setNextSequenceNumber(nextSequenceNumber + 1);
      }
      if (line.startsWith(TAG_EXTINF)) {
        if (prevLastSegment) {
          segmentSeen = true;
          continue;
        }
        if (!segmentSeen) {
          if (lastProgramDateTimeSeconds === null && nextSequenceNumber > 0 && targetDuration !== null) {
            accumulatedTime = nextSequenceNumber * targetDuration;
          }
          segmentSeen = true;
        }
        const extinfContent = line.slice(TAG_EXTINF.length);
        const commaIndex = extinfContent.indexOf(",");
        const durationStr = commaIndex === -1 ? extinfContent : extinfContent.slice(0, commaIndex);
        const duration = Number(durationStr);
        if (!Number.isFinite(duration) || duration < 0) {
          throw new Error(`Invalid #EXTINF tag duration '${durationStr}'.`);
        }
        nextSegmentDuration = duration;
      } else if (line.startsWith(TAG_MAP)) {
        const attributes = new AttributeList(line.slice(TAG_MAP.length));
        const uri = attributes.get("uri");
        if (!uri) {
          throw new Error("Invalid #EXT-X-MAP tag; missing URI attribute.");
        }
        const byteRange = attributes.get("byterange");
        let parsedByteRange = null;
        if (byteRange !== null) {
          parsedByteRange = parseByteRange(byteRange);
        }
        if (parsedByteRange && parsedByteRange.offset === null) {
          throw new Error("Invalid #EXT-X-MAP tag; BYTERANGE attribute must have a specified offset.");
        }
        if (!prevLastSegment) {
          const fullPath = joinPaths(this.path, uri);
          const location = {
            path: fullPath,
            offset: parsedByteRange?.offset ?? 0,
            length: parsedByteRange?.length ?? null
          };
          if (currentKey?.method === "AES-128" && !currentKey.iv) {
            throw new Error("IV attribute must be set on #EXT-X-KEY tag preceding the #EXT-X-MAP tag.");
          }
          const segment = {
            timestamp: accumulatedTime,
            relativeToUnixEpoch: lastProgramDateTimeSeconds !== null,
            firstSegment: null,
            sequenceNumber: null,
            location,
            duration: 0,
            encryption: currentKey,
            initSegment: null,
            lastProgramDateTimeSeconds
          };
          currentInitSegment = segment;
        } else {}
        nextSegmentDuration = null;
        if (nextByteRange === null) {
          lastByteRangeEnd = null;
        } else {
          nextByteRange = null;
        }
      } else if (line.startsWith(TAG_KEY)) {
        const attributes = new AttributeList(line.slice(TAG_KEY.length));
        const method = attributes.get("method");
        if (method === "NONE") {
          currentKey = null;
        } else if (method === "AES-128") {
          const uri = attributes.get("uri");
          if (!uri) {
            throw new Error("Invalid #EXT-X-KEY: AES-128 requires a URI attribute.");
          }
          let iv = null;
          const ivString = attributes.get("iv");
          if (ivString) {
            if (!IV_STRING_REGEX.test(ivString)) {
              throw new Error(`Unsupported IV format '${ivString}'.`);
            }
            let hex = ivString.slice(2);
            hex = hex.padStart(AES_128_BLOCK_SIZE * 2, "0");
            iv = new Uint8Array(AES_128_BLOCK_SIZE);
            for (let i2 = 0;i2 < AES_128_BLOCK_SIZE; i2++) {
              const startIndex = -AES_128_BLOCK_SIZE * 2 + i2;
              iv[i2] = parseInt(hex.slice(startIndex, startIndex + 2), 16);
            }
          }
          const keyFormat = attributes.get("keyformat") ?? "identity";
          if (keyFormat !== "identity") {
            throw new Error("For AES-128 encryption, only the 'identity' KEYFORMAT is currently supported. If you" + " think other formats should be supported, please raise an issue.");
          }
          currentKey = {
            method: "AES-128",
            keyUri: joinPaths(this.path, uri),
            iv,
            keyFormat
          };
        } else if (method === "SAMPLE-AES" || method === "SAMPLE-AES-CTR") {
          const uri = attributes.get("uri");
          if (!uri) {
            throw new Error(`Invalid #EXT-X-KEY: ${method} requires a URI attribute.`);
          }
          const keyFormat = attributes.get("keyformat") ?? "identity";
          if (keyFormat === "identity") {
            throw new Error("For SAMPLE-AES and SAMPLE-AES-CTR encryption, the 'identity' KEYFORMAT is not" + " supported. If you think this format should be supported, please raise an issue.");
          }
          let psshBox = null;
          if (BASE64_DATA_URI_REGEX.test(uri)) {
            const commaIndex = uri.indexOf(",");
            const bytes = base64ToBytes(uri.slice(commaIndex + 1));
            if (bytes.length >= 8 && bytes[4] === 112 && bytes[5] === 115 && bytes[6] === 115 && bytes[7] === 104) {
              const size = toDataView(bytes).getUint32(0);
              psshBox = parsePsshBoxContents(bytes.subarray(8, Math.min(size, bytes.length)));
            }
          }
          currentKey = {
            method,
            psshBox
          };
        } else {
          throw new Error(`Unsupported encryption method '${method}'. If you think this method should be supported,` + ` please raise an issue.`);
        }
      } else if (line.startsWith(TAG_MEDIA_SEQUENCE)) {
        const value = line.slice(TAG_MEDIA_SEQUENCE.length);
        const number = Number(value);
        if (!Number.isInteger(number) || number < 0) {
          throw new Error(`Invalid EXT-X-MEDIA-SEQUENCE value '${value}'.`);
        }
        setNextSequenceNumber(number);
      } else if (line.startsWith(TAG_BYTERANGE)) {
        const parsed = parseByteRange(line.slice(TAG_BYTERANGE.length));
        if (parsed.offset === null) {
          if (lastByteRangeEnd === null) {
            throw new Error("Invalid M3U8 file; #EXT-X-BYTERANGE without offset requires a previous byte range.");
          }
          parsed.offset = lastByteRangeEnd;
        }
        nextByteRange = parsed;
        lastByteRangeEnd = parsed.offset + parsed.length;
      } else if (line.startsWith(TAG_PROGRAM_DATE_TIME)) {
        if (prevLastSegment) {
          continue;
        }
        const dateTime = line.slice(TAG_PROGRAM_DATE_TIME.length);
        const dateTimeMs = Date.parse(dateTime);
        if (!Number.isFinite(dateTimeMs)) {
          continue;
        }
        const dateTimeSeconds = dateTimeMs / 1000;
        if (lastProgramDateTimeSeconds === dateTimeSeconds) {
          continue;
        }
        if (lastProgramDateTimeSeconds === null && this.segments.length > 0) {
          const lastSegment = last(this.segments);
          const lastSegmentEnd = lastSegment.timestamp + lastSegment.duration;
          const offset = dateTimeSeconds - lastSegmentEnd;
          for (const segment of this.segments) {
            segment.timestamp += offset;
            segment.relativeToUnixEpoch = true;
          }
          accumulatedTime += offset;
        }
        lastProgramDateTimeSeconds = dateTimeSeconds;
        accumulatedTime = dateTimeSeconds;
      } else if (line === TAG_DISCONTINUITY) {
        currentFirstSegment = null;
      } else if (line.startsWith(TAG_TARGETDURATION)) {
        const value = line.slice(TAG_TARGETDURATION.length);
        const duration = Number(value);
        if (!Number.isFinite(duration) || duration < 0) {
          throw new Error(`Invalid EXT-X-TARGETDURATION value '${value}'.`);
        }
        this.refreshInterval = duration;
        targetDuration = duration;
      } else if (line === TAG_ENDLIST) {
        this.streamHasEnded = true;
        break;
      } else if (line.startsWith(TAG_PLAYLIST_TYPE)) {
        const type = line.slice(TAG_PLAYLIST_TYPE.length);
        if (type.toLowerCase() === "vod") {
          this.streamHasEnded = true;
        }
      }
    }
    if (!headerRead) {
      throw new Error("Invalid M3U8 file; no #EXTM3U header.");
    }
  }
  async getFirstSegment() {
    if (this.segments.length === 0) {
      await this.runUpdateSegments();
    }
    return this.segments[0] ?? null;
  }
  async getSegmentAt(timestamp, options) {
    if (this.segments.length === 0) {
      await this.runUpdateSegments();
    }
    let isLazy = !!options.skipLiveWait && this.getRemainingWaitTimeMs() > 0;
    while (true) {
      const index = binarySearchLessOrEqual(this.segments, timestamp, (x) => x.timestamp);
      if (index === -1) {
        return null;
      }
      if (index < this.segments.length - 1 || this.streamHasEnded || isLazy) {
        return this.segments[index];
      }
      const segment = this.segments[index];
      if (timestamp < segment.timestamp + segment.duration) {
        return segment;
      }
      await this.runUpdateSegments();
      if (options.skipLiveWait) {
        isLazy = true;
      }
    }
  }
  async getNextSegment(segment, options) {
    const index = this.segments.indexOf(segment);
    assert(index !== -1);
    const nextIndex = index + 1;
    let isLazy = !!options.skipLiveWait && this.getRemainingWaitTimeMs() > 0;
    while (true) {
      if (nextIndex < this.segments.length) {
        return this.segments[nextIndex];
      }
      if (this.streamHasEnded || isLazy) {
        return null;
      }
      await this.runUpdateSegments();
      if (options.skipLiveWait) {
        isLazy = true;
      }
    }
  }
  async getPreviousSegment(segment) {
    const index = this.segments.indexOf(segment);
    assert(index !== -1);
    return this.segments[index - 1] ?? null;
  }
  getInputForSegment(segment) {
    const hlsSegment = segment;
    const cacheEntry = this.inputCache.find((x) => x.segment === hlsSegment);
    if (cacheEntry) {
      cacheEntry.age = this.nextInputCacheAge++;
      return cacheEntry.input;
    }
    let initInput = null;
    if (hlsSegment.initSegment || hlsSegment.firstSegment) {
      initInput = this.getInputForSegment(hlsSegment.initSegment ?? hlsSegment.firstSegment);
    }
    const formatOptions = {
      ...this.input._formatOptions,
      isobmff: {
        ...this.input._formatOptions.isobmff,
        resolveKeyId: this.input._formatOptions.isobmff?.resolveKeyId && ((options) => {
          if (!hlsSegment.encryption || !(hlsSegment.encryption.method === "SAMPLE-AES" || hlsSegment.encryption.method === "SAMPLE-AES-CTR") || !hlsSegment.encryption.psshBox) {
            return this.input._formatOptions.isobmff.resolveKeyId(options);
          }
          let psshBoxes = options.psshBoxes;
          const { psshBox } = hlsSegment.encryption;
          if ((psshBox.keyIds === null || psshBox.keyIds.includes(options.keyId)) && !psshBoxes.some((x) => psshBoxesAreEqual(x, psshBox))) {
            psshBoxes = [...psshBoxes, psshBox];
          }
          return this.input._formatOptions.isobmff.resolveKeyId({ ...options, psshBoxes });
        })
      }
    };
    const input = new Input({
      source: new CustomPathedSource(hlsSegment.location.path, async (request) => {
        assert(request.isRoot);
        const proxiedRequest = {
          ...request,
          isRoot: false
        };
        let ref;
        const needsSlice = hlsSegment.location.offset > 0 || hlsSegment.location.length !== null;
        if (!hlsSegment.encryption || hlsSegment.encryption.method === "SAMPLE-AES" || hlsSegment.encryption.method === "SAMPLE-AES-CTR") {
          ref = await this.input._getSourceCached(proxiedRequest);
          if (needsSlice) {
            const slice = ref.source.slice(hlsSegment.location.offset, hlsSegment.location.length ?? undefined);
            const sliceRef = slice.ref();
            ref.free();
            ref = sliceRef;
          }
        } else if (hlsSegment.encryption.method === "AES-128") {
          const encryption = hlsSegment.encryption;
          assert(encryption.iv);
          let ciphertextRef = await this.input._getSourceCached(proxiedRequest);
          if (needsSlice) {
            const slice = ciphertextRef.source.slice(hlsSegment.location.offset, hlsSegment.location.length ?? undefined);
            const sliceRef = slice.ref();
            ciphertextRef.free();
            ciphertextRef = sliceRef;
          }
          const ciphertextReader = new Reader(ciphertextRef.source);
          const stream = createAes128CbcDecryptStream(ciphertextReader, async () => {
            const env_2 = { stack: [], error: undefined, hasError: false };
            try {
              const keyRef = __addDisposableResource(env_2, await this.input._getSourceCached({ path: encryption.keyUri, isRoot: false }, ENCRYPTION_KEY_CACHE_GROUP), false);
              const keyReader = new Reader(keyRef.source);
              const keySlice = await keyReader.requestSlice(0, AES_128_BLOCK_SIZE);
              if (!keySlice) {
                throw new Error("Invalid AES-128 key; expected at least 16 bytes of data.");
              }
              const key = readBytes(keySlice, AES_128_BLOCK_SIZE);
              return { key, iv: encryption.iv };
            } catch (e_2) {
              env_2.error = e_2;
              env_2.hasError = true;
            } finally {
              __disposeResources(env_2);
            }
          }, () => {
            ciphertextRef.free();
          });
          ref = new ReadableStreamSource(stream).ref();
        } else {
          assert(false);
        }
        return ref;
      }),
      formats: this.input._formats.filter((x) => !(x instanceof HlsInputFormat)),
      initInput: initInput ?? undefined,
      formatOptions
    });
    input._onFormatDetermined = (format) => {
      if ((hlsSegment.encryption?.method === "SAMPLE-AES" || hlsSegment.encryption?.method === "SAMPLE-AES-CTR") && !format._isIsobmff) {
        throw new Error("The SAMPLE-AES and SAMPLE-AES-CTR encryption methods are currently only supported for" + " ISOBMFF files.");
      }
    };
    this.inputCache.push({
      segment: hlsSegment,
      input,
      age: this.nextInputCacheAge++
    });
    const MAX_INPUT_CACHE_SIZE = 4;
    if (this.inputCache.length > MAX_INPUT_CACHE_SIZE) {
      const minAgeIndex = arrayArgmin(this.inputCache, (x) => x.age);
      assert(minAgeIndex !== -1);
      this.inputCache.splice(minAgeIndex, 1);
    }
    return input;
  }
  async getLiveRefreshInterval() {
    if (this.getRemainingWaitTimeMs() === 0) {
      await this.runUpdateSegments();
    }
    return this.streamHasEnded ? null : this.refreshInterval;
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/hls/hls-demuxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class HlsDemuxer extends Demuxer {
  constructor(input) {
    super(input);
    this.metadataPromise = null;
    this.trackBackings = null;
    this.internalTracks = null;
    this.segmentedInputs = [];
    this.hasMasterPlaylist = true;
  }
  readMetadata() {
    return this.metadataPromise ??= (async () => {
      assert(this.input._rootSource instanceof PathedSource);
      const { rootPath } = this.input._rootSource;
      const slice = await this.input._reader.requestEntireFile();
      assert(slice);
      const lines = readAllLines(slice, slice.length, { ignore: canIgnoreLine });
      const variantStreams = [];
      const mediaTags = [];
      for (let i = 1;i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith(TAG_STREAM_INF)) {
          const streamInfLineNumber = i;
          const playlistPath = lines[++i];
          if (playlistPath === undefined) {
            throw new Error("Incorrect M3U8 file; a line must follow the #EXT-X-STREAM-INF tag.");
          }
          const fullPath = joinPaths(rootPath, playlistPath);
          const attributes = new AttributeList(line.slice(TAG_STREAM_INF.length));
          const bandwidth = attributes.getAsNumber("bandwidth");
          if (bandwidth === null) {
            throw new Error("Invalid M3U8 file; #EXT-X-STREAM-INF tag requires a BANDWIDTH attribute with a valid" + " numerical value.");
          }
          variantStreams.push({
            fullPath,
            attributes,
            lineNumber: streamInfLineNumber,
            hasOnlyKeyPackets: false
          });
        } else if (line.startsWith(TAG_I_FRAME_STREAM_INF)) {
          const attributes = new AttributeList(line.slice(TAG_I_FRAME_STREAM_INF.length));
          const playlistPath = attributes.get("uri");
          if (playlistPath === null) {
            throw new Error("Invalid M3U8 file; #EXT-X-I-FRAME-STREAM-INF tag requires a URI attribute.");
          }
          const bandwidth = attributes.getAsNumber("bandwidth");
          if (bandwidth === null) {
            throw new Error("Invalid M3U8 file; #EXT-X-I-FRAME-STREAM-INF tag requires a BANDWIDTH attribute with a" + " valid numerical value.");
          }
          const fullPath = joinPaths(rootPath, playlistPath);
          variantStreams.push({
            fullPath,
            attributes,
            lineNumber: i,
            hasOnlyKeyPackets: true
          });
        } else if (line.startsWith(TAG_MEDIA)) {
          const attributes = new AttributeList(line.slice(TAG_MEDIA.length));
          const type = attributes.get("type");
          if (type === null) {
            throw new Error("Invalid M3U8 file; #EXT-X-MEDIA tag requires a TYPE attribute.");
          }
          const groupId = attributes.get("group-id");
          if (groupId === null) {
            throw new Error("Invalid M3U8 file; #EXT-X-MEDIA tag requires a GROUP-ID attribute.");
          }
          let fullPath = null;
          const uri = attributes.get("uri");
          if (uri !== null) {
            fullPath = joinPaths(rootPath, uri);
          }
          mediaTags.push({ fullPath, attributes, lineNumber: i });
        } else if (line === TAG_I_FRAMES_ONLY) {} else if (line.startsWith(TAG_EXTINF)) {
          const segmentedInput = new HlsSegmentedInput(this, rootPath, null, lines);
          this.segmentedInputs = [segmentedInput];
          this.hasMasterPlaylist = false;
          this.trackBackings = await segmentedInput.getTrackBackings();
          return;
        }
      }
      const videoGroupIds = [
        ...new Set(mediaTags.filter((tag) => tag.attributes.get("type").toLowerCase() === "video").map((tag) => tag.attributes.get("group-id")))
      ];
      const audioGroupIds = [
        ...new Set(mediaTags.filter((tag) => tag.attributes.get("type").toLowerCase() === "audio").map((tag) => tag.attributes.get("group-id")))
      ];
      const internalTracksByVariant = await Promise.all(variantStreams.map(async (variantStream, i) => {
        const result = [];
        const codecsList = variantStream.attributes.get("codecs");
        let codecStrings;
        if (codecsList) {
          codecStrings = codecsList.split(",").map((x) => x.trim());
        } else {
          const segmentedInput = this.getSegmentedInputForPath(variantStream.fullPath);
          const trackBackings = await segmentedInput.getTrackBackings();
          const tracksWithCodec = await Promise.all(trackBackings.map(async (t) => ({ track: t, codec: await t.getCodec() })));
          codecStrings = await Promise.all(tracksWithCodec.filter((x) => x.codec !== null).map((x) => x.track.getDecoderConfig().then((x2) => x2.codec)));
        }
        const videoGroupId = variantStream.attributes.get("video");
        const audioGroupId = variantStream.attributes.get("audio");
        const containsVideoCodecs = codecStrings.some((x) => VIDEO_CODECS.includes(inferCodecFromCodecString(x)));
        const containsAudioCodecs = codecStrings.some((x) => AUDIO_CODECS.includes(inferCodecFromCodecString(x)));
        if (videoGroupId !== null && !containsVideoCodecs) {
          if (!videoGroupIds.includes(videoGroupId)) {
            throw new Error(`Invalid M3U8 file; variant stream references video group "${videoGroupId}" which` + ` is not defined in any #EXT-X-MEDIA tags.`);
          }
          const matchingVideoMediaTag = mediaTags.find((mediaTag) => {
            const groupId = mediaTag.attributes.get("group-id");
            const type = mediaTag.attributes.get("type");
            return groupId === videoGroupId && type.toLowerCase() === "video";
          });
          outer:
            if (matchingVideoMediaTag) {
              const uri = matchingVideoMediaTag.attributes.get("uri");
              if (uri === null) {
                break outer;
              }
              const fullPath = joinPaths(rootPath, uri);
              const segmentedInput = this.getSegmentedInputForPath(fullPath);
              const trackBackings = await segmentedInput.getTrackBackings();
              const videoTrack = trackBackings.find((x) => x.getType() === "video");
              if (!videoTrack || await videoTrack.getCodec() === null) {
                break outer;
              }
              const additionalCodecString = await videoTrack.getDecoderConfig().then((x) => x?.codec ?? null);
              assert(additionalCodecString !== null);
              codecStrings.push(additionalCodecString);
            }
        }
        if (audioGroupId !== null && !containsAudioCodecs) {
          if (!audioGroupIds.includes(audioGroupId)) {
            throw new Error(`Invalid M3U8 file; variant stream references audio group "${audioGroupId}" which` + ` is not defined in any #EXT-X-MEDIA tags.`);
          }
          const matchingAudioMediaTag = mediaTags.find((tag) => {
            const groupId = tag.attributes.get("group-id");
            const type = tag.attributes.get("type");
            return groupId === audioGroupId && type.toLowerCase() === "audio";
          });
          outer:
            if (matchingAudioMediaTag) {
              const uri = matchingAudioMediaTag.attributes.get("uri");
              if (uri === null) {
                break outer;
              }
              const fullPath = joinPaths(rootPath, uri);
              const segmentedInput = this.getSegmentedInputForPath(fullPath);
              const trackBackings = await segmentedInput.getTrackBackings();
              const audioTrack = trackBackings.find((x) => x.getType() === "audio");
              if (!audioTrack || await audioTrack.getCodec() === null) {
                break outer;
              }
              const additionalCodecString = await audioTrack.getDecoderConfig().then((x) => x?.codec ?? null);
              assert(additionalCodecString !== null);
              codecStrings.push(additionalCodecString);
            }
        }
        codecStrings = [...new Set(codecStrings)];
        let videoCodecString = null;
        let audioCodecString = null;
        const bandwidth = variantStream.attributes.getAsNumber("bandwidth");
        assert(bandwidth !== null);
        const averageBandwidth = variantStream.attributes.getAsNumber("average-bandwidth");
        const name = variantStream.attributes.get("name");
        for (const codecString of codecStrings) {
          const inferredCodec = inferCodecFromCodecString(codecString);
          if (inferredCodec === null) {
            continue;
          }
          if (VIDEO_CODECS.includes(inferredCodec)) {
            if (videoCodecString !== null) {
              throw new Error("Unsupported M3U8 file; multiple video codecs found in the CODECS attribute of a" + " variant stream.");
            }
            videoCodecString = codecString;
            const videoGroupId2 = variantStream.attributes.get("video");
            if (videoGroupId2 === null) {
              const resolution = variantStream.attributes.get("resolution");
              let width = null;
              let height = null;
              if (resolution) {
                const match = resolution.match(/^(\d+)x(\d+)$/);
                if (match) {
                  width = Number(match[1]);
                  height = Number(match[2]);
                }
              }
              result.push({
                id: -1,
                demuxer: this,
                backingTrack: null,
                default: true,
                autoselect: true,
                languageCode: UNDETERMINED_LANGUAGE,
                lineNumber: variantStream.lineNumber,
                fullPath: variantStream.fullPath,
                fullCodecString: videoCodecString,
                pairingMask: 1n << BigInt(i),
                peakBitrate: bandwidth,
                averageBitrate: averageBandwidth,
                name,
                hasOnlyKeyPackets: variantStream.hasOnlyKeyPackets,
                info: {
                  type: "video",
                  width,
                  height
                }
              });
            } else {
              if (!videoGroupIds.includes(videoGroupId2)) {
                throw new Error(`Invalid M3U8 file; variant stream references video group "${videoGroupId2}"` + ` which is not defined in any #EXT-X-MEDIA tags.`);
              }
              for (const mediaTag of mediaTags) {
                const groupId = mediaTag.attributes.get("group-id");
                const type = mediaTag.attributes.get("type");
                if (groupId !== videoGroupId2 || type.toLowerCase() !== "video") {
                  continue;
                }
                const resolution = mediaTag.attributes.get("resolution") ?? variantStream.attributes.get("resolution");
                let width = null;
                let height = null;
                if (resolution) {
                  const match = resolution.match(/^(\d+)x(\d+)$/);
                  if (match) {
                    width = Number(match[1]);
                    height = Number(match[2]);
                  }
                }
                result.push({
                  id: -1,
                  demuxer: this,
                  backingTrack: null,
                  default: getMediaTagDefault(mediaTag.attributes),
                  autoselect: getMediaTagDefault(mediaTag.attributes) || getMediaTagAutoselect(mediaTag.attributes),
                  languageCode: preprocessLanguageCode(mediaTag.attributes.get("language")),
                  lineNumber: mediaTag.lineNumber,
                  fullPath: mediaTag.fullPath ?? variantStream.fullPath,
                  fullCodecString: videoCodecString,
                  pairingMask: 1n << BigInt(i),
                  peakBitrate: null,
                  averageBitrate: null,
                  name: mediaTag.attributes.get("name"),
                  hasOnlyKeyPackets: variantStream.hasOnlyKeyPackets,
                  info: {
                    type: "video",
                    width,
                    height
                  }
                });
              }
            }
          } else if (AUDIO_CODECS.includes(inferredCodec)) {
            if (audioCodecString !== null) {
              throw new Error("Unsupported M3U8 file; multiple audio codecs found in the CODECS attribute of a" + " variant stream.");
            }
            audioCodecString = codecString;
            const audioGroupId2 = variantStream.attributes.get("audio");
            if (audioGroupId2 === null) {
              const channels = variantStream.attributes.get("channels");
              const parsedChannels = channels !== null ? Number(channels.split("/")[0]) : null;
              result.push({
                id: -1,
                demuxer: this,
                backingTrack: null,
                default: true,
                autoselect: true,
                languageCode: UNDETERMINED_LANGUAGE,
                lineNumber: variantStream.lineNumber,
                fullPath: variantStream.fullPath,
                fullCodecString: audioCodecString,
                pairingMask: 1n << BigInt(i),
                peakBitrate: bandwidth,
                averageBitrate: averageBandwidth,
                name,
                hasOnlyKeyPackets: variantStream.hasOnlyKeyPackets,
                info: {
                  type: "audio",
                  numberOfChannels: parsedChannels !== null && Number.isInteger(parsedChannels) && parsedChannels > 0 ? parsedChannels : null
                }
              });
            } else {
              if (!audioGroupIds.includes(audioGroupId2)) {
                throw new Error(`Invalid M3U8 file; variant stream references audio group "${audioGroupId2}"` + ` which is not defined in any #EXT-X-MEDIA tags.`);
              }
              for (const mediaTag of mediaTags) {
                const groupId = mediaTag.attributes.get("group-id");
                const type = mediaTag.attributes.get("type");
                if (groupId !== audioGroupId2 || type.toLowerCase() !== "audio") {
                  continue;
                }
                const channels = mediaTag.attributes.get("channels") ?? variantStream.attributes.get("channels");
                const parsedChannels = channels !== null ? Number(channels.split("/")[0]) : null;
                result.push({
                  id: -1,
                  demuxer: this,
                  backingTrack: null,
                  default: getMediaTagDefault(mediaTag.attributes),
                  autoselect: getMediaTagDefault(mediaTag.attributes) || getMediaTagAutoselect(mediaTag.attributes),
                  languageCode: preprocessLanguageCode(mediaTag.attributes.get("language")),
                  lineNumber: mediaTag.lineNumber,
                  fullPath: mediaTag.fullPath ?? variantStream.fullPath,
                  fullCodecString: audioCodecString,
                  pairingMask: 1n << BigInt(i),
                  peakBitrate: null,
                  averageBitrate: null,
                  name: mediaTag.attributes.get("name"),
                  hasOnlyKeyPackets: variantStream.hasOnlyKeyPackets,
                  info: {
                    type: "audio",
                    numberOfChannels: parsedChannels !== null && Number.isInteger(parsedChannels) && parsedChannels > 0 ? parsedChannels : null
                  }
                });
              }
            }
          }
        }
        return result;
      }));
      const internalTracks = [];
      const addInternalTrack = (track) => {
        const existingTrack = internalTracks.find((x) => x.fullPath === track.fullPath && x.info.type === track.info.type);
        if (existingTrack) {
          existingTrack.pairingMask |= track.pairingMask;
          existingTrack.default ||= track.default;
          existingTrack.autoselect ||= track.autoselect;
          existingTrack.lineNumber = Math.min(existingTrack.lineNumber, track.lineNumber);
          if (track.peakBitrate !== null) {
            existingTrack.peakBitrate = Math.max(existingTrack.peakBitrate ?? -Infinity, track.peakBitrate);
          }
          if (track.averageBitrate !== null) {
            existingTrack.averageBitrate = Math.max(existingTrack.averageBitrate ?? -Infinity, track.averageBitrate);
          }
          if (existingTrack.languageCode === UNDETERMINED_LANGUAGE) {
            existingTrack.languageCode = track.languageCode;
          }
        } else {
          track.id = internalTracks.length + 1;
          internalTracks.push(track);
        }
      };
      for (const variantInternalTracks of internalTracksByVariant) {
        for (const trackEntry of variantInternalTracks) {
          addInternalTrack(trackEntry);
        }
      }
      internalTracks.sort((a, b) => a.lineNumber - b.lineNumber);
      this.trackBackings = [];
      for (const internalTrack of internalTracks) {
        if (internalTrack.info.type === "video") {
          this.trackBackings.push(new HlsInputVideoTrackBacking(internalTrack));
        } else {
          this.trackBackings.push(new HlsInputAudioTrackBacking(internalTrack));
        }
      }
      this.internalTracks = internalTracks;
    })();
  }
  async getTrackBackings() {
    await this.readMetadata();
    assert(this.trackBackings);
    return this.trackBackings;
  }
  getSegmentedInputForPath(path) {
    let segmentedInput = this.segmentedInputs.find((x) => x.path === path);
    if (segmentedInput) {
      return segmentedInput;
    }
    let decls = null;
    if (this.internalTracks) {
      const tracks = this.internalTracks.filter((x) => x.fullPath === path);
      decls = tracks.map((x) => ({
        id: x.id,
        type: x.info.type
      }));
    }
    segmentedInput = new HlsSegmentedInput(this, path, decls, null);
    this.segmentedInputs.push(segmentedInput);
    return segmentedInput;
  }
  async getMetadataTags() {
    return {};
  }
  async getMimeType() {
    return HLS_MIME_TYPE;
  }
  dispose() {
    if (this.segmentedInputs) {
      for (const segInput of this.segmentedInputs) {
        segInput.dispose();
      }
      this.segmentedInputs.length = 0;
    }
  }
}

class HlsInputTrackBacking {
  constructor(internalTrack) {
    this.internalTrack = internalTrack;
    this.hydrationPromise = null;
  }
  hydrate() {
    return this.hydrationPromise ??= (async () => {
      const segmentedInput = this.internalTrack.demuxer.getSegmentedInputForPath(this.internalTrack.fullPath);
      let trackBacking = null;
      const trackBackings = await segmentedInput.getTrackBackings();
      const matchingType = trackBackings.filter((x) => x.getType() === this.getType());
      if (matchingType.length === 1) {
        trackBacking = matchingType[0];
      } else {
        if (this instanceof HlsInputVideoTrackBacking) {
          for (const backing of matchingType) {
            if (await backing.getCodec() === this.getCodec()) {
              trackBacking = backing;
              break;
            }
          }
        } else {
          assert(this instanceof HlsInputAudioTrackBacking);
          for (const backing of matchingType) {
            if (await backing.getCodec() === this.getCodec()) {
              trackBacking = backing;
              break;
            }
          }
        }
      }
      if (!trackBacking) {
        throw new Error("Could not find matching track in underlying media data.");
      }
      this.internalTrack.backingTrack = trackBacking;
    })();
  }
  delegate(fn) {
    if (this.internalTrack.backingTrack) {
      return fn();
    }
    return this.hydrate().then(fn);
  }
  getCodec() {
    throw new Error("Not implemented on base class.");
  }
  getDisposition() {
    return {
      ...DEFAULT_TRACK_DISPOSITION,
      default: this.internalTrack.autoselect,
      primary: this.internalTrack.default
    };
  }
  getId() {
    return this.internalTrack.id;
  }
  getPairingMask() {
    return this.internalTrack.pairingMask;
  }
  getInternalCodecId() {
    return null;
  }
  getLanguageCode() {
    return this.internalTrack.languageCode;
  }
  getName() {
    return this.internalTrack.name;
  }
  getNumber() {
    assert(this.internalTrack.demuxer.internalTracks);
    const trackType = this.internalTrack.info.type;
    let number = 0;
    for (const track of this.internalTrack.demuxer.internalTracks) {
      if (track.info.type === trackType) {
        number++;
      }
      if (track === this.internalTrack) {
        break;
      }
    }
    return number;
  }
  getTimeResolution() {
    return this.delegate(() => this.internalTrack.backingTrack.getTimeResolution());
  }
  isRelativeToUnixEpoch() {
    return this.delegate(() => this.internalTrack.backingTrack.isRelativeToUnixEpoch());
  }
  getBitrate() {
    return this.internalTrack.peakBitrate;
  }
  getAverageBitrate() {
    return this.internalTrack.averageBitrate;
  }
  async getDurationFromMetadata(options) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getDurationFromMetadata(options);
  }
  async getLiveRefreshInterval() {
    await this.hydrate();
    return this.internalTrack.backingTrack.getLiveRefreshInterval();
  }
  getHasOnlyKeyPackets() {
    return this.internalTrack.hasOnlyKeyPackets || null;
  }
  async getFirstPacket(options) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getFirstPacket(options);
  }
  async getPacket(timestamp, options) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getPacket(timestamp, options);
  }
  async getKeyPacket(timestamp, options) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getKeyPacket(timestamp, options);
  }
  async getNextPacket(packet, options) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getNextPacket(packet, options);
  }
  async getNextKeyPacket(packet, options) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getNextKeyPacket(packet, options);
  }
}

class HlsInputVideoTrackBacking extends HlsInputTrackBacking {
  constructor(internalTrack) {
    super(internalTrack);
  }
  get backingVideoTrack() {
    return this.internalTrack.backingTrack;
  }
  getType() {
    return "video";
  }
  getCodec() {
    const inferredCodec = inferCodecFromCodecString(this.internalTrack.fullCodecString);
    return inferredCodec;
  }
  getCodedWidth() {
    return this.delegate(() => this.backingVideoTrack.getCodedWidth());
  }
  getCodedHeight() {
    return this.delegate(() => this.backingVideoTrack.getCodedHeight());
  }
  getSquarePixelWidth() {
    return this.delegate(() => this.backingVideoTrack.getSquarePixelWidth());
  }
  getSquarePixelHeight() {
    return this.delegate(() => this.backingVideoTrack.getSquarePixelHeight());
  }
  getMetadataDisplayWidth() {
    if (this.backingVideoTrack) {
      return null;
    }
    return this.internalTrack.info.width;
  }
  getMetadataDisplayHeight() {
    if (this.backingVideoTrack) {
      return null;
    }
    return this.internalTrack.info.height;
  }
  getRotation() {
    return this.delegate(() => this.backingVideoTrack.getRotation());
  }
  async getColorSpace() {
    await this.hydrate();
    return this.backingVideoTrack.getColorSpace();
  }
  async canBeTransparent() {
    await this.hydrate();
    return this.backingVideoTrack.canBeTransparent();
  }
  getMetadataCodecParameterString() {
    if (this.backingVideoTrack) {
      return null;
    }
    return this.internalTrack.fullCodecString;
  }
  async getDecoderConfig() {
    await this.hydrate();
    return this.backingVideoTrack.getDecoderConfig();
  }
}

class HlsInputAudioTrackBacking extends HlsInputTrackBacking {
  constructor(internalTrack) {
    super(internalTrack);
  }
  get backingAudioTrack() {
    return this.internalTrack.backingTrack;
  }
  getType() {
    return "audio";
  }
  getCodec() {
    const inferredCodec = inferCodecFromCodecString(this.internalTrack.fullCodecString);
    return inferredCodec;
  }
  getNumberOfChannels() {
    if (this.internalTrack.info.numberOfChannels !== null) {
      return this.internalTrack.info.numberOfChannels;
    }
    return this.delegate(() => this.backingAudioTrack.getNumberOfChannels());
  }
  getSampleRate() {
    return this.delegate(() => this.backingAudioTrack.getSampleRate());
  }
  getMetadataCodecParameterString() {
    if (this.backingAudioTrack) {
      return null;
    }
    return this.internalTrack.fullCodecString;
  }
  async getDecoderConfig() {
    await this.hydrate();
    return this.backingAudioTrack.getDecoderConfig();
  }
}
var getMediaTagDefault = (attributes) => {
  const value = attributes.get("default");
  if (value === null) {
    return false;
  }
  const normalized = value.toUpperCase();
  if (normalized === "YES") {
    return true;
  }
  if (normalized === "NO") {
    return false;
  }
  throw new Error(`Invalid M3U8 file; #EXT-X-MEDIA DEFAULT attribute must be YES or NO, got "${value}".`);
};
var getMediaTagAutoselect = (attributes) => {
  const value = attributes.get("autoselect");
  if (value === null) {
    return false;
  }
  const normalized = value.toUpperCase();
  if (normalized === "YES") {
    return true;
  }
  if (normalized === "NO") {
    return false;
  }
  throw new Error(`Invalid M3U8 file; #EXT-X-MEDIA AUTOSELECT attribute must be YES or NO, got "${value}".`);
};
var preprocessLanguageCode = (code) => {
  if (code === null) {
    return UNDETERMINED_LANGUAGE;
  }
  const languageSubtag = code.split("-")[0];
  if (!languageSubtag) {
    return UNDETERMINED_LANGUAGE;
  }
  return languageSubtag;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/input-format.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class InputFormat {
  constructor() {
    this._isIsobmff = false;
  }
}

class IsobmffInputFormat extends InputFormat {
  constructor() {
    super(...arguments);
    this._isIsobmff = true;
  }
  async _getMajorBrand(input) {
    let slice = input._reader.requestSlice(0, 12);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return null;
    slice.skip(4);
    const fourCc = readAscii(slice, 4);
    if (fourCc !== "ftyp" && fourCc !== "styp") {
      return null;
    }
    return readAscii(slice, 4);
  }
  _createDemuxer(input) {
    return new IsobmffDemuxer(input);
  }
}

class Mp4InputFormat extends IsobmffInputFormat {
  async _canReadInput(input) {
    const majorBrand = await this._getMajorBrand(input);
    if (majorBrand !== null) {
      return majorBrand !== "qt  ";
    }
    let slice = input._reader.requestSlice(4, 4);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    const fourCc = readAscii(slice, 4);
    return fourCc === "moof" || fourCc === "sidx";
  }
  get name() {
    return "MP4";
  }
  get mimeType() {
    return "video/mp4";
  }
}

class QuickTimeInputFormat extends IsobmffInputFormat {
  async _canReadInput(input) {
    const majorBrand = await this._getMajorBrand(input);
    return majorBrand === "qt  ";
  }
  get name() {
    return "QuickTime File Format";
  }
  get mimeType() {
    return "video/quicktime";
  }
}

class MatroskaInputFormat extends InputFormat {
  async isSupportedEBMLOfDocType(input, desiredDocType) {
    let headerSlice = input._reader.requestSlice(0, MAX_HEADER_SIZE);
    if (headerSlice instanceof Promise)
      headerSlice = await headerSlice;
    if (!headerSlice)
      return false;
    const varIntSize = readVarIntSize(headerSlice);
    if (varIntSize === null) {
      return false;
    }
    if (varIntSize < 1 || varIntSize > 8) {
      return false;
    }
    const id = readUnsignedInt(headerSlice, varIntSize);
    if (id !== EBMLId.EBML) {
      return false;
    }
    const dataSize = readElementSize(headerSlice);
    if (typeof dataSize !== "number") {
      return false;
    }
    let dataSlice = input._reader.requestSlice(headerSlice.filePos, dataSize);
    if (dataSlice instanceof Promise)
      dataSlice = await dataSlice;
    if (!dataSlice)
      return false;
    const startPos = headerSlice.filePos;
    while (dataSlice.filePos <= startPos + dataSize - MIN_HEADER_SIZE) {
      const header = readElementHeader(dataSlice);
      if (!header)
        break;
      const { id: id2, size } = header;
      const dataStartPos = dataSlice.filePos;
      if (size === undefined)
        return false;
      switch (id2) {
        case EBMLId.EBMLVersion:
          {
            const ebmlVersion = readUnsignedInt(dataSlice, size);
            if (ebmlVersion !== 1) {
              return false;
            }
          }
          ;
          break;
        case EBMLId.EBMLReadVersion:
          {
            const ebmlReadVersion = readUnsignedInt(dataSlice, size);
            if (ebmlReadVersion !== 1) {
              return false;
            }
          }
          ;
          break;
        case EBMLId.DocType:
          {
            const docType = readAsciiString(dataSlice, size);
            if (docType !== desiredDocType) {
              return false;
            }
          }
          ;
          break;
        case EBMLId.DocTypeVersion:
          {
            const docTypeVersion = readUnsignedInt(dataSlice, size);
            if (docTypeVersion > 4) {
              return false;
            }
          }
          ;
          break;
      }
      dataSlice.filePos = dataStartPos + size;
    }
    return true;
  }
  _canReadInput(input) {
    return this.isSupportedEBMLOfDocType(input, "matroska");
  }
  _createDemuxer(input) {
    return new MatroskaDemuxer(input);
  }
  get name() {
    return "Matroska";
  }
  get mimeType() {
    return "video/x-matroska";
  }
}

class WebMInputFormat extends MatroskaInputFormat {
  _canReadInput(input) {
    return this.isSupportedEBMLOfDocType(input, "webm");
  }
  get name() {
    return "WebM";
  }
  get mimeType() {
    return "video/webm";
  }
}

class Mp3InputFormat extends InputFormat {
  async _canReadInput(input) {
    let currentPos = 0;
    while (true) {
      let slice2 = input._reader.requestSlice(currentPos, ID3_V2_HEADER_SIZE);
      if (slice2 instanceof Promise)
        slice2 = await slice2;
      if (!slice2)
        break;
      const id3V2Header = readId3V2Header(slice2);
      if (!id3V2Header) {
        break;
      }
      currentPos = slice2.filePos + id3V2Header.size;
    }
    const firstResult = await readNextMp3FrameHeader(input._reader, currentPos, currentPos + 4096);
    if (!firstResult) {
      return false;
    }
    const firstHeader = firstResult.header;
    const xingOffset = getXingOffset(firstHeader.mpegVersionId, firstHeader.channel);
    let slice = input._reader.requestSlice(firstResult.startPos + xingOffset, 4);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    const word = readU32Be(slice);
    const isXing = word === XING || word === INFO;
    if (isXing) {
      return true;
    }
    currentPos = firstResult.startPos + firstResult.header.totalSize;
    const secondResult = await readNextMp3FrameHeader(input._reader, currentPos, currentPos + MP3_FRAME_HEADER_SIZE);
    if (!secondResult) {
      return false;
    }
    const secondHeader = secondResult.header;
    if (firstHeader.channel !== secondHeader.channel || firstHeader.sampleRate !== secondHeader.sampleRate) {
      return false;
    }
    return true;
  }
  _createDemuxer(input) {
    return new Mp3Demuxer(input);
  }
  get name() {
    return "MP3";
  }
  get mimeType() {
    return "audio/mpeg";
  }
}

class WaveInputFormat extends InputFormat {
  async _canReadInput(input) {
    let slice = input._reader.requestSlice(0, 12);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    const riffType = readAscii(slice, 4);
    if (riffType !== "RIFF" && riffType !== "RIFX" && riffType !== "RF64") {
      return false;
    }
    slice.skip(4);
    const format = readAscii(slice, 4);
    return format === "WAVE";
  }
  _createDemuxer(input) {
    return new WaveDemuxer(input);
  }
  get name() {
    return "WAVE";
  }
  get mimeType() {
    return "audio/wav";
  }
}

class OggInputFormat extends InputFormat {
  async _canReadInput(input) {
    let slice = input._reader.requestSlice(0, 4);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    return readAscii(slice, 4) === "OggS";
  }
  _createDemuxer(input) {
    return new OggDemuxer(input);
  }
  get name() {
    return "Ogg";
  }
  get mimeType() {
    return "application/ogg";
  }
}

class FlacInputFormat extends InputFormat {
  async _canReadInput(input) {
    let slice = input._reader.requestSlice(0, 4);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    return readAscii(slice, 4) === "fLaC";
  }
  get name() {
    return "FLAC";
  }
  get mimeType() {
    return "audio/flac";
  }
  _createDemuxer(input) {
    return new FlacDemuxer(input);
  }
}

class AdtsInputFormat extends InputFormat {
  async _canReadInput(input) {
    let currentPos = 0;
    while (true) {
      let slice2 = input._reader.requestSlice(currentPos, ID3_V2_HEADER_SIZE);
      if (slice2 instanceof Promise)
        slice2 = await slice2;
      if (!slice2)
        break;
      const id3V2Header = readId3V2Header(slice2);
      if (!id3V2Header) {
        break;
      }
      currentPos = slice2.filePos + id3V2Header.size;
    }
    let slice = input._reader.requestSliceRange(currentPos, MIN_ADTS_FRAME_HEADER_SIZE, MAX_ADTS_FRAME_HEADER_SIZE);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    const firstHeader = readAdtsFrameHeader(slice);
    if (!firstHeader) {
      return false;
    }
    currentPos += firstHeader.frameLength;
    slice = input._reader.requestSliceRange(currentPos, MIN_ADTS_FRAME_HEADER_SIZE, MAX_ADTS_FRAME_HEADER_SIZE);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    const secondHeader = readAdtsFrameHeader(slice);
    if (!secondHeader) {
      return false;
    }
    return firstHeader.objectType === secondHeader.objectType && firstHeader.samplingFrequencyIndex === secondHeader.samplingFrequencyIndex && firstHeader.channelConfiguration === secondHeader.channelConfiguration;
  }
  _createDemuxer(input) {
    return new AdtsDemuxer(input);
  }
  get name() {
    return "ADTS";
  }
  get mimeType() {
    return "audio/aac";
  }
}

class MpegTsInputFormat extends InputFormat {
  async _canReadInput(input) {
    const lengthToCheck = TS_PACKET_SIZE + 16 + 1;
    let slice = input._reader.requestSlice(0, lengthToCheck);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    const bytes = readBytes(slice, lengthToCheck);
    if (bytes[0] === 71 && bytes[TS_PACKET_SIZE] === 71) {
      return true;
    } else if (bytes[0] === 71 && bytes[TS_PACKET_SIZE + 16] === 71) {
      return true;
    } else if (bytes[4] === 71 && bytes[4 + TS_PACKET_SIZE + 4] === 71) {
      return true;
    }
    return false;
  }
  _createDemuxer(input) {
    return new MpegTsDemuxer(input);
  }
  get name() {
    return "MPEG Transport Stream";
  }
  get mimeType() {
    return "video/MP2T";
  }
}

class HlsInputFormat extends InputFormat {
  async _canReadInput(input) {
    let slice = input._reader.requestSlice(0, 7);
    if (slice instanceof Promise)
      slice = await slice;
    if (!slice)
      return false;
    const isM3u8 = readAscii(slice, 7) === "#EXTM3U";
    if (!isM3u8) {
      return false;
    }
    if (!(input._rootSource instanceof PathedSource)) {
      throw new TypeError("HLS inputs require `InputOptions.source` to be a PathedSource or a ref to one.");
    }
    input._rootSource._usedForHls = true;
    return true;
  }
  _createDemuxer(input) {
    return new HlsDemuxer(input);
  }
  get name() {
    return "HTTP Live Streaming (HLS)";
  }
  get mimeType() {
    return HLS_MIME_TYPE;
  }
}
var MP4 = /* @__PURE__ */ new Mp4InputFormat;
var QTFF = /* @__PURE__ */ new QuickTimeInputFormat;
var MATROSKA = /* @__PURE__ */ new MatroskaInputFormat;
var WEBM = /* @__PURE__ */ new WebMInputFormat;
var MP3 = /* @__PURE__ */ new Mp3InputFormat;
var WAVE = /* @__PURE__ */ new WaveInputFormat;
var OGG = /* @__PURE__ */ new OggInputFormat;
var ADTS = /* @__PURE__ */ new AdtsInputFormat;
var FLAC = /* @__PURE__ */ new FlacInputFormat;
var MPEG_TS = /* @__PURE__ */ new MpegTsInputFormat;
var HLS = /* @__PURE__ */ new HlsInputFormat;
var ALL_FORMATS = [HLS, MP4, QTFF, MATROSKA, WEBM, WAVE, OGG, FLAC, MP3, ADTS, MPEG_TS];
var validateInputFormatOptions = (options, prefix) => {
  if (!options || typeof options !== "object") {
    throw new TypeError(`${prefix}, when provided, must be an object.`);
  }
  if (options.isobmff !== undefined) {
    if (!options.isobmff || typeof options.isobmff !== "object") {
      throw new TypeError(`${prefix}.isobmff, when provided, must be an object.`);
    }
    if (options.isobmff.resolveKeyId !== undefined && typeof options.isobmff.resolveKeyId !== "function") {
      throw new TypeError(`${prefix}.isobmff.resolveKeyId, when provided, must be a function.`);
    }
  }
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/decode.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var canDecodeVideoMemo = new Map;
var canDecodeAudioMemo = new Map;

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/sample.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var __addDisposableResource2 = function(env, value, async) {
  if (value !== null && value !== undefined) {
    if (typeof value !== "object" && typeof value !== "function")
      throw new TypeError("Object expected.");
    var dispose, inner;
    if (async) {
      if (!Symbol.asyncDispose)
        throw new TypeError("Symbol.asyncDispose is not defined.");
      dispose = value[Symbol.asyncDispose];
    }
    if (dispose === undefined) {
      if (!Symbol.dispose)
        throw new TypeError("Symbol.dispose is not defined.");
      dispose = value[Symbol.dispose];
      if (async)
        inner = dispose;
    }
    if (typeof dispose !== "function")
      throw new TypeError("Object not disposable.");
    if (inner)
      dispose = function() {
        try {
          inner.call(this);
        } catch (e) {
          return Promise.reject(e);
        }
      };
    env.stack.push({ value, dispose, async });
  } else if (async) {
    env.stack.push({ async: true });
  }
  return value;
};
var __disposeResources2 = function(SuppressedError2) {
  return function(env) {
    function fail(e) {
      env.error = env.hasError ? new SuppressedError2(e, env.error, "An error was suppressed during disposal.") : e;
      env.hasError = true;
    }
    var r, s = 0;
    function next() {
      while (r = env.stack.pop()) {
        try {
          if (!r.async && s === 1)
            return s = 0, env.stack.push(r), Promise.resolve().then(next);
          if (r.dispose) {
            var result = r.dispose.call(r.value);
            if (r.async)
              return s |= 2, Promise.resolve(result).then(next, function(e) {
                fail(e);
                return next();
              });
          } else
            s |= 1;
        } catch (e) {
          fail(e);
        }
      }
      if (s === 1)
        return env.hasError ? Promise.reject(env.error) : Promise.resolve();
      if (env.hasError)
        throw env.error;
    }
    return next();
  };
}(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
polyfillSymbolDispose();
var lastVideoGcErrorLog = -Infinity;
var lastAudioGcErrorLog = -Infinity;
var finalizationRegistry = null;
if (typeof FinalizationRegistry !== "undefined") {
  finalizationRegistry = new FinalizationRegistry((value) => {
    const now = performance.now();
    if (value.type === "video") {
      if (now - lastVideoGcErrorLog >= 1000) {
        console.error(`A VideoSample was garbage collected without first being closed. For proper resource management,` + ` make sure to call close() on all your VideoSamples as soon as you're done using them.`);
        lastVideoGcErrorLog = now;
      }
      if (typeof VideoFrame !== "undefined" && value.data instanceof VideoFrame) {
        value.data.close();
      }
    } else {
      if (now - lastAudioGcErrorLog >= 1000) {
        console.error(`An AudioSample was garbage collected without first being closed. For proper resource management,` + ` make sure to call close() on all your AudioSamples as soon as you're done using them.`);
        lastAudioGcErrorLog = now;
      }
      if (typeof AudioData !== "undefined" && value.data instanceof AudioData) {
        value.data.close();
      }
    }
  });
}

class VideoSampleResource {
  constructor() {
    this._referenceCount = 0;
    this._lastAllocationBuffer = null;
  }
}
var VIDEO_SAMPLE_PIXEL_FORMATS = [
  "I420",
  "I420P10",
  "I420P12",
  "I420A",
  "I420AP10",
  "I420AP12",
  "I422",
  "I422P10",
  "I422P12",
  "I422A",
  "I422AP10",
  "I422AP12",
  "I444",
  "I444P10",
  "I444P12",
  "I444A",
  "I444AP10",
  "I444AP12",
  "NV12",
  "RGBA",
  "RGBX",
  "BGRA",
  "BGRX"
];
var VIDEO_SAMPLE_PIXEL_FORMATS_SET = new Set(VIDEO_SAMPLE_PIXEL_FORMATS);

class VideoSample {
  get codedWidth() {
    return this.visibleRect.width;
  }
  get codedHeight() {
    return this.visibleRect.height;
  }
  get displayWidth() {
    return this.rotation % 180 === 0 ? this.squarePixelWidth : this.squarePixelHeight;
  }
  get displayHeight() {
    return this.rotation % 180 === 0 ? this.squarePixelHeight : this.squarePixelWidth;
  }
  get microsecondTimestamp() {
    return Math.trunc(SECOND_TO_MICROSECOND_FACTOR * this.timestamp);
  }
  get microsecondDuration() {
    return Math.trunc(SECOND_TO_MICROSECOND_FACTOR * this.duration);
  }
  get hasAlpha() {
    return this.format && this.format.includes("A");
  }
  constructor(data, init) {
    this._closed = false;
    if (data instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && data instanceof SharedArrayBuffer || ArrayBuffer.isView(data)) {
      if (!init || typeof init !== "object") {
        throw new TypeError("init must be an object.");
      }
      if (init.format === undefined || !VIDEO_SAMPLE_PIXEL_FORMATS_SET.has(init.format)) {
        throw new TypeError("init.format must be one of: " + VIDEO_SAMPLE_PIXEL_FORMATS.join(", "));
      }
      if (!Number.isInteger(init.codedWidth) || init.codedWidth <= 0) {
        throw new TypeError("init.codedWidth must be a positive integer.");
      }
      if (!Number.isInteger(init.codedHeight) || init.codedHeight <= 0) {
        throw new TypeError("init.codedHeight must be a positive integer.");
      }
      if (init.rotation !== undefined && ![0, 90, 180, 270].includes(init.rotation)) {
        throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");
      }
      if (!Number.isFinite(init.timestamp)) {
        throw new TypeError("init.timestamp must be a number.");
      }
      if (init.duration !== undefined && (!Number.isFinite(init.duration) || init.duration < 0)) {
        throw new TypeError("init.duration, when provided, must be a non-negative number.");
      }
      if (init.layout !== undefined) {
        if (!Array.isArray(init.layout)) {
          throw new TypeError("init.layout, when provided, must be an array.");
        }
        for (const plane of init.layout) {
          if (!plane || typeof plane !== "object" || Array.isArray(plane)) {
            throw new TypeError("Each entry in init.layout must be an object.");
          }
          if (!Number.isInteger(plane.offset) || plane.offset < 0) {
            throw new TypeError("plane.offset must be a non-negative integer.");
          }
          if (!Number.isInteger(plane.stride) || plane.stride < 0) {
            throw new TypeError("plane.stride must be a non-negative integer.");
          }
        }
      }
      if (init.visibleRect !== undefined) {
        validateRectangle(init.visibleRect, "init.visibleRect");
      }
      if (init.displayWidth !== undefined && (!Number.isInteger(init.displayWidth) || init.displayWidth <= 0)) {
        throw new TypeError("init.displayWidth, when provided, must be a positive integer.");
      }
      if (init.displayHeight !== undefined && (!Number.isInteger(init.displayHeight) || init.displayHeight <= 0)) {
        throw new TypeError("init.displayHeight, when provided, must be a positive integer.");
      }
      if (init.displayWidth !== undefined !== (init.displayHeight !== undefined)) {
        throw new TypeError("init.displayWidth and init.displayHeight must be either both provided or both omitted.");
      }
      this._data = init._doNotCopy ? toUint8Array(data) : toUint8Array(data).slice();
      this._layout = init.layout ?? createDefaultPlaneLayout(init.format, init.codedWidth, init.codedHeight);
      this.format = init.format;
      this.rotation = init.rotation ?? 0;
      this.timestamp = init.timestamp;
      this.duration = init.duration ?? 0;
      let colorSpaceInit = init.colorSpace ?? null;
      if (colorSpaceInit === null) {
        if (this.format === "RGBA" || this.format === "RGBX" || this.format === "BGRA" || this.format === "BGRX") {
          colorSpaceInit = {
            primaries: "bt709",
            transfer: "iec61966-2-1",
            matrix: "rgb",
            fullRange: true
          };
        } else {
          colorSpaceInit = {
            primaries: "bt709",
            transfer: "bt709",
            matrix: "bt709",
            fullRange: false
          };
        }
      }
      this.colorSpace = new VideoSampleColorSpace(colorSpaceInit);
      this.visibleRect = {
        left: init.visibleRect?.left ?? 0,
        top: init.visibleRect?.top ?? 0,
        width: init.visibleRect?.width ?? init.codedWidth,
        height: init.visibleRect?.height ?? init.codedHeight
      };
      if (init.displayWidth !== undefined) {
        this.squarePixelWidth = this.rotation % 180 === 0 ? init.displayWidth : init.displayHeight;
        this.squarePixelHeight = this.rotation % 180 === 0 ? init.displayHeight : init.displayWidth;
      } else {
        this.squarePixelWidth = this.visibleRect.width;
        this.squarePixelHeight = this.visibleRect.height;
      }
    } else if (typeof VideoFrame !== "undefined" && data instanceof VideoFrame) {
      if (init?.rotation !== undefined && ![0, 90, 180, 270].includes(init.rotation)) {
        throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");
      }
      if (init?.timestamp !== undefined && !Number.isFinite(init?.timestamp)) {
        throw new TypeError("init.timestamp, when provided, must be a number.");
      }
      if (init?.duration !== undefined && (!Number.isFinite(init.duration) || init.duration < 0)) {
        throw new TypeError("init.duration, when provided, must be a non-negative number.");
      }
      if (init?.visibleRect !== undefined) {
        validateRectangle(init.visibleRect, "init.visibleRect");
      }
      this._data = data;
      this._layout = null;
      this.format = data.format;
      this.visibleRect = {
        left: data.visibleRect?.x ?? 0,
        top: data.visibleRect?.y ?? 0,
        width: data.visibleRect?.width ?? data.codedWidth,
        height: data.visibleRect?.height ?? data.codedHeight
      };
      this.rotation = init?.rotation ?? 0;
      this.squarePixelWidth = data.displayWidth;
      this.squarePixelHeight = data.displayHeight;
      this.timestamp = init?.timestamp ?? data.timestamp / 1e6;
      this.duration = init?.duration ?? (data.duration ?? 0) / 1e6;
      this.colorSpace = new VideoSampleColorSpace(data.colorSpace);
    } else if (typeof HTMLImageElement !== "undefined" && data instanceof HTMLImageElement || typeof SVGImageElement !== "undefined" && data instanceof SVGImageElement || typeof ImageBitmap !== "undefined" && data instanceof ImageBitmap || typeof HTMLVideoElement !== "undefined" && data instanceof HTMLVideoElement || typeof HTMLCanvasElement !== "undefined" && data instanceof HTMLCanvasElement || typeof OffscreenCanvas !== "undefined" && data instanceof OffscreenCanvas) {
      if (!init || typeof init !== "object") {
        throw new TypeError("init must be an object.");
      }
      if (init.rotation !== undefined && ![0, 90, 180, 270].includes(init.rotation)) {
        throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");
      }
      if (!Number.isFinite(init.timestamp)) {
        throw new TypeError("init.timestamp must be a number.");
      }
      if (init.duration !== undefined && (!Number.isFinite(init.duration) || init.duration < 0)) {
        throw new TypeError("init.duration, when provided, must be a non-negative number.");
      }
      if (typeof VideoFrame !== "undefined") {
        return new VideoSample(new VideoFrame(data, {
          timestamp: Math.trunc(init.timestamp * SECOND_TO_MICROSECOND_FACTOR),
          duration: Math.trunc((init.duration ?? 0) * SECOND_TO_MICROSECOND_FACTOR) || undefined
        }), init);
      }
      let width = 0;
      let height = 0;
      if ("naturalWidth" in data) {
        width = data.naturalWidth;
        height = data.naturalHeight;
      } else if ("videoWidth" in data) {
        width = data.videoWidth;
        height = data.videoHeight;
      } else if ("width" in data) {
        width = Number(data.width);
        height = Number(data.height);
      }
      if (!width || !height) {
        throw new TypeError("Could not determine dimensions.");
      }
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d", {
        alpha: isFirefox(),
        willReadFrequently: true
      });
      if (!context) {
        throw new Error("OffscreenCanvas must have support for the '2d' context in order to create a VideoSample from" + " this data.");
      }
      context.drawImage(data, 0, 0);
      this._data = canvas;
      this._layout = null;
      this.format = "RGBX";
      this.visibleRect = { left: 0, top: 0, width, height };
      this.squarePixelWidth = width;
      this.squarePixelHeight = height;
      this.rotation = init.rotation ?? 0;
      this.timestamp = init.timestamp;
      this.duration = init.duration ?? 0;
      this.colorSpace = new VideoSampleColorSpace({
        matrix: "rgb",
        primaries: "bt709",
        transfer: "iec61966-2-1",
        fullRange: true
      });
    } else if (data instanceof VideoSampleResource) {
      if (!init || typeof init !== "object") {
        throw new TypeError("init must be an object.");
      }
      if (init.rotation !== undefined && ![0, 90, 180, 270].includes(init.rotation)) {
        throw new TypeError("init.rotation, when provided, must be 0, 90, 180, or 270.");
      }
      if (!Number.isFinite(init.timestamp)) {
        throw new TypeError("init.timestamp must be a number.");
      }
      if (init.duration !== undefined && (!Number.isFinite(init.duration) || init.duration < 0)) {
        throw new TypeError("init.duration, when provided, must be a non-negative number.");
      }
      this._data = data;
      data._referenceCount++;
      this.format = data.getFormat();
      if (this.format !== null && !VIDEO_SAMPLE_PIXEL_FORMATS.includes(this.format)) {
        throw new TypeError("getFormat() must return a VideoSamplePixelFormat or null.");
      }
      this.visibleRect = {
        left: 0,
        top: 0,
        width: data.getCodedWidth(),
        height: data.getCodedHeight()
      };
      if (!Number.isInteger(this.visibleRect.width) || this.visibleRect.width <= 0) {
        throw new TypeError("getCodedWidth() must return a positive integer.");
      }
      if (!Number.isInteger(this.visibleRect.height) || this.visibleRect.height <= 0) {
        throw new TypeError("getCodedHeight() must return a positive integer.");
      }
      this.squarePixelWidth = data.getSquarePixelWidth();
      if (!Number.isInteger(this.squarePixelWidth) || this.squarePixelWidth <= 0) {
        throw new TypeError("getSquarePixelWidth() must return a positive integer.");
      }
      this.squarePixelHeight = data.getSquarePixelHeight();
      if (!Number.isInteger(this.squarePixelHeight) || this.squarePixelHeight <= 0) {
        throw new TypeError("getSquarePixelHeight() must return a positive integer.");
      }
      this.rotation = init.rotation ?? 0;
      this.timestamp = init.timestamp;
      this.duration = init.duration ?? 0;
      this.colorSpace = data.getColorSpace();
    } else {
      throw new TypeError("Invalid data type: Must be a BufferSource, CanvasImageSource, or VideoSampleResource.");
    }
    this.encodeOptions = init?.encodeOptions ?? {};
    this.pixelAspectRatio = simplifyRational({
      num: this.squarePixelWidth * this.codedHeight,
      den: this.squarePixelHeight * this.codedWidth
    });
    finalizationRegistry?.register(this, { type: "video", data: this._data }, this);
  }
  clone() {
    if (this._closed) {
      throw new Error("VideoSample is closed.");
    }
    assert(this._data !== null);
    if (this._data instanceof VideoSampleResource) {
      return new VideoSample(this._data, {
        timestamp: this.timestamp,
        duration: this.duration,
        rotation: this.rotation,
        encodeOptions: this.encodeOptions
      });
    } else if (isVideoFrame(this._data)) {
      return new VideoSample(this._data.clone(), {
        timestamp: this.timestamp,
        duration: this.duration,
        rotation: this.rotation,
        encodeOptions: this.encodeOptions
      });
    } else if (this._data instanceof Uint8Array) {
      assert(this._layout);
      return new VideoSample(this._data, {
        format: this.format,
        layout: this._layout,
        codedWidth: this.codedWidth,
        codedHeight: this.codedHeight,
        timestamp: this.timestamp,
        duration: this.duration,
        colorSpace: this.colorSpace,
        rotation: this.rotation,
        visibleRect: this.visibleRect,
        displayWidth: this.displayWidth,
        displayHeight: this.displayHeight,
        encodeOptions: this.encodeOptions,
        _doNotCopy: true
      });
    } else {
      return new VideoSample(this._data, {
        format: this.format,
        codedWidth: this.codedWidth,
        codedHeight: this.codedHeight,
        timestamp: this.timestamp,
        duration: this.duration,
        colorSpace: this.colorSpace,
        rotation: this.rotation,
        visibleRect: this.visibleRect,
        displayWidth: this.displayWidth,
        displayHeight: this.displayHeight,
        encodeOptions: this.encodeOptions
      });
    }
  }
  close() {
    if (this._closed) {
      return;
    }
    finalizationRegistry?.unregister(this);
    if (this._data instanceof VideoSampleResource) {
      this._data._referenceCount--;
      if (this._data._referenceCount === 0) {
        this._data.close();
      }
    } else if (isVideoFrame(this._data)) {
      this._data.close();
    } else {
      this._data = null;
    }
    this._closed = true;
  }
  allocationSize(options = {}) {
    validateVideoFrameCopyToOptions(options);
    if (this._closed) {
      throw new Error("VideoSample is closed.");
    }
    if ((options.format ?? this.format) == null) {
      throw new Error("Cannot get allocation size when format is null.");
    }
    if (isVideoFrame(this._data)) {
      return this._data.allocationSize(options);
    }
    const combinedLayout = ParseVideoFrameCopyToOptions(this, options);
    return combinedLayout.allocationSize;
  }
  async copyTo(destination, options = {}) {
    if (!isAllowSharedBufferSource(destination)) {
      throw new TypeError("destination must be an ArrayBuffer or an ArrayBuffer view.");
    }
    validateVideoFrameCopyToOptions(options);
    if (this._closed) {
      throw new Error("VideoSample is closed.");
    }
    if ((options.format ?? this.format) == null) {
      throw new Error("Cannot copy video sample data when format is null.");
    }
    assert(this._data !== null);
    if (isVideoFrame(this._data)) {
      return this._data.copyTo(destination, options);
    }
    if (options.format && !["RGBA", "RGBX", "BGRA", "BGRX"].includes(this.format) && ["RGBA", "RGBX", "BGRA", "BGRX"].includes(options.format)) {
      if (this._data instanceof VideoSampleResource) {
        const env_1 = { stack: [], error: undefined, hasError: false };
        try {
          const rgbSample = __addDisposableResource2(env_1, await this._data.toRgbSample({
            timestamp: this.timestamp,
            duration: this.duration,
            rotation: this.rotation
          }, options.colorSpace ?? "srgb"), false);
          if (!(rgbSample instanceof VideoSample)) {
            throw new TypeError("toRgbSample() must return a VideoSample.");
          }
          if (!["RGBA", "RGBX", "BGRA", "BGRX"].includes(rgbSample.format)) {
            throw new Error(`Sample returned by toRgbSample was expected to have an RGB format, got` + ` '${rgbSample.format}' instead.`);
          }
          return await rgbSample.copyTo(destination, options);
        } catch (e_1) {
          env_1.error = e_1;
          env_1.hasError = true;
        } finally {
          __disposeResources2(env_1);
        }
      } else {
        if (typeof VideoFrame === "undefined") {
          throw new Error("For this sample, converting from a non-RGB to an RGB format requires VideoFrame to" + " be defined.");
        }
        const tempFrame = this.toVideoFrame();
        const result = await tempFrame.copyTo(destination, options);
        tempFrame.close();
        return result;
      }
    }
    const combinedLayout = ParseVideoFrameCopyToOptions(this, options);
    assert(this.format);
    const destBytes = toUint8Array(destination);
    if (destBytes.byteLength < combinedLayout.allocationSize) {
      throw new TypeError(`Destination buffer too small. Required: ${combinedLayout.allocationSize},` + ` Available: ${destBytes.byteLength}`);
    }
    const planeConfigs = getPlaneConfigs(this.format);
    let dataPlanes;
    if (this._data instanceof VideoSampleResource) {
      let result = this._data.getDataPlanes();
      if (result instanceof Promise)
        result = await result;
      if (!Array.isArray(result) || result.some((x) => !(x.data instanceof Uint8Array) || !Number.isInteger(x.stride) || x.stride < 0)) {
        throw new TypeError('getDataPlanes() must return an array of objects with a Uint8Array "data" property and a' + ' non-negative integer "stride" property.');
      }
      dataPlanes = result;
    } else if (this._data instanceof Uint8Array) {
      assert(this._layout);
      assert(this._layout.length === planeConfigs.length);
      dataPlanes = this._layout.map((planeLayout, i) => {
        const height = Math.ceil(this.codedHeight / planeConfigs[i].heightDivisor);
        return {
          data: this._data.subarray(planeLayout.offset, planeLayout.offset + planeLayout.stride * height),
          stride: planeLayout.stride
        };
      });
    } else {
      const canvas = this._data;
      const context = canvas.getContext("2d");
      assert(context);
      const imageData = context.getImageData(0, 0, this.codedWidth, this.codedHeight);
      dataPlanes = [{
        data: toUint8Array(imageData.data),
        stride: 4 * this.codedWidth
      }];
    }
    const planeLayouts = [];
    const numPlanes = planeConfigs.length;
    for (let planeIndex = 0;planeIndex < numPlanes; planeIndex++) {
      const computedLayout = combinedLayout.computedLayouts[planeIndex];
      const sourceStride = dataPlanes[planeIndex].stride;
      const sourceData = dataPlanes[planeIndex].data;
      let sourceOffset = computedLayout.sourceTop * sourceStride;
      sourceOffset += computedLayout.sourceLeftBytes;
      let destinationOffset = computedLayout.destinationOffset;
      const rowBytes = computedLayout.sourceWidthBytes;
      const layout = {
        offset: destinationOffset,
        stride: computedLayout.destinationStride
      };
      for (let row = 0;row < computedLayout.sourceHeight; row++) {
        if (sourceOffset + rowBytes > sourceData.byteLength) {
          throw new Error(`Source buffer OOB read.`);
        }
        if (destinationOffset + rowBytes > destBytes.byteLength) {
          throw new Error(`Destination buffer OOB write.`);
        }
        const srcSub = sourceData.subarray(sourceOffset, sourceOffset + rowBytes);
        destBytes.set(srcSub, destinationOffset);
        sourceOffset += sourceStride;
        destinationOffset += computedLayout.destinationStride;
      }
      planeLayouts.push(layout);
    }
    if (options.format !== undefined) {
      const needsRgbConversion = this.format.startsWith("RGB") !== options.format.startsWith("RGB");
      const needsAlphaConversion = this.format.includes("X") && options.format.includes("A");
      if (needsRgbConversion || needsAlphaConversion) {
        for (let i = 0;i < combinedLayout.allocationSize; i += 4) {
          if (needsRgbConversion) {
            const r = destBytes[i];
            const b = destBytes[i + 2];
            destBytes[i] = b;
            destBytes[i + 2] = r;
          }
          if (needsAlphaConversion) {
            destBytes[i + 3] = 255;
          }
        }
      }
    }
    return planeLayouts;
  }
  toVideoFrame() {
    if (this._closed) {
      throw new Error("VideoSample is closed.");
    }
    assert(this._data !== null);
    if (this._data instanceof VideoSampleResource) {
      if (this.format === null) {
        throw new Error("Cannot convert a VideoSampleResource-backed VideoSample to VideoFrame if format is null.");
      }
      const planes = this._data.getDataPlanes();
      if (planes instanceof Promise) {
        throw new Error("Cannot convert a VideoSampleResource-backed VideoSample to VideoFrame if getDataPlanes() returns" + " a promise.");
      }
      const size = planes.reduce((a, b) => a + b.data.byteLength, 0);
      const buffer = new Uint8Array(size);
      let offset = 0;
      const offsets = [];
      for (const plane of planes) {
        buffer.set(plane.data, offset);
        offsets.push(offset);
        offset += plane.data.byteLength;
      }
      return new VideoFrame(buffer, {
        format: this.format,
        layout: planes.map((x, i) => ({
          offset: offsets[i],
          stride: x.stride
        })),
        codedWidth: this.codedWidth,
        codedHeight: this.codedHeight,
        timestamp: this.microsecondTimestamp,
        duration: this.microsecondDuration,
        colorSpace: this.colorSpace,
        displayWidth: this.squarePixelWidth,
        displayHeight: this.squarePixelHeight
      });
    } else if (isVideoFrame(this._data)) {
      return new VideoFrame(this._data, {
        timestamp: this.microsecondTimestamp,
        duration: this.microsecondDuration || undefined
      });
    } else if (this._data instanceof Uint8Array) {
      return new VideoFrame(this._data, {
        format: this.format,
        codedWidth: this.codedWidth,
        codedHeight: this.codedHeight,
        timestamp: this.microsecondTimestamp,
        duration: this.microsecondDuration || undefined,
        colorSpace: this.colorSpace,
        displayWidth: this.squarePixelWidth,
        displayHeight: this.squarePixelHeight
      });
    } else {
      return new VideoFrame(this._data, {
        timestamp: this.microsecondTimestamp,
        duration: this.microsecondDuration || undefined
      });
    }
  }
  draw(context, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
    let sx = 0;
    let sy = 0;
    let sWidth = this.displayWidth;
    let sHeight = this.displayHeight;
    let dx = 0;
    let dy = 0;
    let dWidth = this.displayWidth;
    let dHeight = this.displayHeight;
    if (arg5 !== undefined) {
      sx = arg1;
      sy = arg2;
      sWidth = arg3;
      sHeight = arg4;
      dx = arg5;
      dy = arg6;
      if (arg7 !== undefined) {
        dWidth = arg7;
        dHeight = arg8;
      } else {
        dWidth = sWidth;
        dHeight = sHeight;
      }
    } else {
      dx = arg1;
      dy = arg2;
      if (arg3 !== undefined) {
        dWidth = arg3;
        dHeight = arg4;
      }
    }
    if (!(typeof CanvasRenderingContext2D !== "undefined" && context instanceof CanvasRenderingContext2D || typeof OffscreenCanvasRenderingContext2D !== "undefined" && context instanceof OffscreenCanvasRenderingContext2D)) {
      throw new TypeError("context must be a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.");
    }
    if (!Number.isFinite(sx)) {
      throw new TypeError("sx must be a number.");
    }
    if (!Number.isFinite(sy)) {
      throw new TypeError("sy must be a number.");
    }
    if (!Number.isFinite(sWidth) || sWidth < 0) {
      throw new TypeError("sWidth must be a non-negative number.");
    }
    if (!Number.isFinite(sHeight) || sHeight < 0) {
      throw new TypeError("sHeight must be a non-negative number.");
    }
    if (!Number.isFinite(dx)) {
      throw new TypeError("dx must be a number.");
    }
    if (!Number.isFinite(dy)) {
      throw new TypeError("dy must be a number.");
    }
    if (!Number.isFinite(dWidth) || dWidth < 0) {
      throw new TypeError("dWidth must be a non-negative number.");
    }
    if (!Number.isFinite(dHeight) || dHeight < 0) {
      throw new TypeError("dHeight must be a non-negative number.");
    }
    if (this._closed) {
      throw new Error("VideoSample is closed.");
    }
    ({ sx, sy, sWidth, sHeight } = this._rotateSourceRegion(sx, sy, sWidth, sHeight, this.rotation));
    const source = this.toCanvasImageSource();
    context.save();
    const centerX = dx + dWidth / 2;
    const centerY = dy + dHeight / 2;
    context.translate(centerX, centerY);
    context.rotate(this.rotation * Math.PI / 180);
    const aspectRatioChange = this.rotation % 180 === 0 ? 1 : dWidth / dHeight;
    context.scale(1 / aspectRatioChange, aspectRatioChange);
    context.drawImage(source, sx, sy, sWidth, sHeight, -dWidth / 2, -dHeight / 2, dWidth, dHeight);
    context.restore();
  }
  drawWithFit(context, options) {
    if (!(typeof CanvasRenderingContext2D !== "undefined" && context instanceof CanvasRenderingContext2D || typeof OffscreenCanvasRenderingContext2D !== "undefined" && context instanceof OffscreenCanvasRenderingContext2D)) {
      throw new TypeError("context must be a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.");
    }
    if (!options || typeof options !== "object") {
      throw new TypeError("options must be an object.");
    }
    if (!["fill", "contain", "cover"].includes(options.fit)) {
      throw new TypeError("options.fit must be 'fill', 'contain', or 'cover'.");
    }
    if (options.rotation !== undefined && ![0, 90, 180, 270].includes(options.rotation)) {
      throw new TypeError("options.rotation, when provided, must be 0, 90, 180, or 270.");
    }
    if (options.crop !== undefined) {
      validateCropRectangle(options.crop, "options.");
    }
    const canvasWidth = context.canvas.width;
    const canvasHeight = context.canvas.height;
    const rotation = options.rotation ?? this.rotation;
    const [rotatedWidth, rotatedHeight] = rotation % 180 === 0 ? [this.squarePixelWidth, this.squarePixelHeight] : [this.squarePixelHeight, this.squarePixelWidth];
    let finalCrop = options.crop;
    if (finalCrop) {
      finalCrop = clampCropRectangle(finalCrop, rotatedWidth, rotatedHeight);
    }
    let dx;
    let dy;
    let newWidth;
    let newHeight;
    const { sx, sy, sWidth, sHeight } = this._rotateSourceRegion(options.crop?.left ?? 0, options.crop?.top ?? 0, options.crop?.width ?? rotatedWidth, options.crop?.height ?? rotatedHeight, rotation);
    if (options.fit === "fill") {
      dx = 0;
      dy = 0;
      newWidth = canvasWidth;
      newHeight = canvasHeight;
    } else {
      const [sampleWidth, sampleHeight] = options.crop ? [options.crop.width, options.crop.height] : [rotatedWidth, rotatedHeight];
      const scale = options.fit === "contain" ? Math.min(canvasWidth / sampleWidth, canvasHeight / sampleHeight) : Math.max(canvasWidth / sampleWidth, canvasHeight / sampleHeight);
      newWidth = sampleWidth * scale;
      newHeight = sampleHeight * scale;
      dx = (canvasWidth - newWidth) / 2;
      dy = (canvasHeight - newHeight) / 2;
    }
    context.save();
    const aspectRatioChange = rotation % 180 === 0 ? 1 : newWidth / newHeight;
    context.translate(canvasWidth / 2, canvasHeight / 2);
    context.rotate(rotation * Math.PI / 180);
    context.scale(1 / aspectRatioChange, aspectRatioChange);
    context.translate(-canvasWidth / 2, -canvasHeight / 2);
    context.drawImage(this.toCanvasImageSource(), sx, sy, sWidth, sHeight, dx, dy, newWidth, newHeight);
    context.restore();
  }
  _rotateSourceRegion(sx, sy, sWidth, sHeight, rotation) {
    if (rotation === 90) {
      [sx, sy, sWidth, sHeight] = [
        sy,
        this.squarePixelHeight - sx - sWidth,
        sHeight,
        sWidth
      ];
    } else if (rotation === 180) {
      [sx, sy] = [
        this.squarePixelWidth - sx - sWidth,
        this.squarePixelHeight - sy - sHeight
      ];
    } else if (rotation === 270) {
      [sx, sy, sWidth, sHeight] = [
        this.squarePixelWidth - sy - sHeight,
        sx,
        sHeight,
        sWidth
      ];
    }
    return { sx, sy, sWidth, sHeight };
  }
  toCanvasImageSource() {
    if (this._closed) {
      throw new Error("VideoSample is closed.");
    }
    assert(this._data !== null);
    if (this._data instanceof VideoSampleResource || this._data instanceof Uint8Array) {
      const videoFrame = this.toVideoFrame();
      queueMicrotask(() => videoFrame.close());
      return videoFrame;
    } else {
      return this._data;
    }
  }
  async transform(options) {
    if (!options || typeof options !== "object") {
      throw new TypeError("options must be an object.");
    }
    if (options.width !== undefined && (!Number.isInteger(options.width) || options.width <= 0)) {
      throw new TypeError("options.width, when provided, must be a positive integer.");
    }
    if (options.height !== undefined && (!Number.isInteger(options.height) || options.height <= 0)) {
      throw new TypeError("options.height, when provided, must be a positive integer.");
    }
    if (options.roundDimensionsTo !== undefined && (!Number.isInteger(options.roundDimensionsTo) || options.roundDimensionsTo <= 0)) {
      throw new TypeError("options.roundDimensionsTo, when provided, must be a positive integer.");
    }
    if (options.fit !== undefined && !["fill", "contain", "cover"].includes(options.fit)) {
      throw new TypeError('options.fit, when provided, must be one of "fill", "contain", or "cover".');
    }
    if (options.width !== undefined && options.height !== undefined && options.fit === undefined) {
      throw new TypeError("When both options.width and options.height are provided, options.fit must also be provided.");
    }
    if (options.rotate !== undefined && ![0, 90, 180, 270].includes(options.rotate)) {
      throw new TypeError("options.rotate, when provided, must be 0, 90, 180 or 270.");
    }
    if (options.crop !== undefined) {
      validateCropRectangle(options.crop, "options.");
    }
    if (options.alpha !== undefined && !["keep", "discard"].includes(options.alpha)) {
      throw new TypeError("options.alpha, when provided, must be 'keep' or 'discard'.");
    }
    const rotation = normalizeRotation(this.rotation + (options.rotate ?? 0));
    const [rotatedWidth, rotatedHeight] = rotation % 180 === 0 ? [this.squarePixelWidth, this.squarePixelHeight] : [this.squarePixelHeight, this.squarePixelWidth];
    let finalCrop = options.crop;
    if (finalCrop) {
      finalCrop = clampCropRectangle(finalCrop, rotatedWidth, rotatedHeight);
    }
    const cropWidth = finalCrop ? finalCrop.width : rotatedWidth;
    const cropHeight = finalCrop ? finalCrop.height : rotatedHeight;
    const originalAspectRatio = cropWidth / cropHeight;
    let targetWidth;
    let targetHeight;
    if (options.width !== undefined && options.height === undefined) {
      targetWidth = options.width;
      targetHeight = targetWidth / originalAspectRatio;
    } else if (options.width === undefined && options.height !== undefined) {
      targetHeight = options.height;
      targetWidth = targetHeight * originalAspectRatio;
    } else if (options.width !== undefined && options.height !== undefined) {
      targetWidth = options.width;
      targetHeight = options.height;
    } else {
      targetWidth = cropWidth;
      targetHeight = cropHeight;
    }
    targetWidth = roundToMultiple(targetWidth, options.roundDimensionsTo ?? 1);
    targetHeight = roundToMultiple(targetHeight, options.roundDimensionsTo ?? 1);
    const description = {
      width: targetWidth,
      height: targetHeight,
      fit: options.fit ?? "fill",
      rotation,
      crop: finalCrop ?? {
        left: 0,
        top: 0,
        width: rotatedWidth,
        height: rotatedHeight
      },
      alpha: options.alpha ?? "keep"
    };
    for (const transformer of registeredVideoSampleTransformers) {
      let result = transformer(this, description);
      if (result instanceof Promise)
        result = await result;
      if (result !== null) {
        return result;
      }
    }
    let canvas = null;
    let canvasIsNew = false;
    for (const entry of transformationCanvasCache) {
      if (entry.canvas.width === description.width && entry.canvas.height === description.height) {
        canvas = entry.canvas;
        entry.age = transformationCanvasCacheNextAge++;
        break;
      }
    }
    if (canvas === null) {
      if (typeof OffscreenCanvas !== "undefined") {
        canvas = new OffscreenCanvas(description.width, description.height);
      } else {
        if (typeof window === "undefined" || typeof document === "undefined") {
          throw new Error("Cannot transform VideoSamples in this environment. Either run in an environment with" + " OffscreenCanvas or HTMLCanvasElement, or supply a custom VideoSample transformer using" + " registerVideoSampleTransformer().");
        }
        canvas = document.createElement("canvas");
        canvas.width = description.width;
        canvas.height = description.height;
      }
      canvasIsNew = true;
      if (transformationCanvasCache.length >= TRANSFORMATION_CANVAS_CACHE_MAX_SIZE) {
        transformationCanvasCache.splice(arrayArgmin(transformationCanvasCache, (x) => x.age), 1);
      }
      transformationCanvasCache.push({
        canvas,
        age: transformationCanvasCacheNextAge++
      });
    }
    const context = canvas.getContext("2d", {
      alpha: true
    });
    if (!context) {
      throw new Error("The '2d' canvas context is required to transform VideoSamples. Register a custom transformer using" + " registerVideoSampleTransformer to work around this limitation.");
    }
    if (description.alpha === "discard") {
      context.fillStyle = "black";
      context.fillRect(0, 0, description.width, description.height);
    } else if (!canvasIsNew) {
      context.clearRect(0, 0, description.width, description.height);
    }
    this.drawWithFit(context, {
      fit: description.fit,
      rotation: description.rotation,
      crop: description.crop
    });
    return new VideoSample(canvas, {
      timestamp: this.timestamp,
      duration: this.duration,
      rotation: 0
    });
  }
  setRotation(newRotation) {
    if (![0, 90, 180, 270].includes(newRotation)) {
      throw new TypeError("newRotation must be 0, 90, 180, or 270.");
    }
    this.rotation = newRotation;
  }
  setTimestamp(newTimestamp) {
    if (!Number.isFinite(newTimestamp)) {
      throw new TypeError("newTimestamp must be a number.");
    }
    this.timestamp = newTimestamp;
  }
  setDuration(newDuration) {
    if (!Number.isFinite(newDuration) || newDuration < 0) {
      throw new TypeError("newDuration must be a non-negative number.");
    }
    this.duration = newDuration;
  }
  setEncodeOptions(newEncodeOptions) {
    if (!newEncodeOptions || typeof newEncodeOptions !== "object") {
      throw new TypeError("newEncodeOptions must be an object.");
    }
    this.encodeOptions = newEncodeOptions;
  }
  [Symbol.dispose]() {
    this.close();
  }
}
var registeredVideoSampleTransformers = [];
var TRANSFORMATION_CANVAS_CACHE_MAX_SIZE = 3;
var transformationCanvasCache = [];
var transformationCanvasCacheNextAge = 0;

class VideoSampleColorSpace {
  constructor(init) {
    if (init !== undefined) {
      if (!init || typeof init !== "object") {
        throw new TypeError("init.colorSpace, when provided, must be an object.");
      }
      const primariesValues = Object.keys(COLOR_PRIMARIES_MAP);
      if (init.primaries != null && !primariesValues.includes(init.primaries)) {
        throw new TypeError(`init.colorSpace.primaries, when provided, must be one of ${primariesValues.join(", ")}.`);
      }
      const transferValues = Object.keys(TRANSFER_CHARACTERISTICS_MAP);
      if (init.transfer != null && !transferValues.includes(init.transfer)) {
        throw new TypeError(`init.colorSpace.transfer, when provided, must be one of ${transferValues.join(", ")}.`);
      }
      const matrixValues = Object.keys(MATRIX_COEFFICIENTS_MAP);
      if (init.matrix != null && !matrixValues.includes(init.matrix)) {
        throw new TypeError(`init.colorSpace.matrix, when provided, must be one of ${matrixValues.join(", ")}.`);
      }
      if (init.fullRange != null && typeof init.fullRange !== "boolean") {
        throw new TypeError("init.colorSpace.fullRange, when provided, must be a boolean.");
      }
    }
    this.primaries = init?.primaries ?? null;
    this.transfer = init?.transfer ?? null;
    this.matrix = init?.matrix ?? null;
    this.fullRange = init?.fullRange ?? null;
  }
  toJSON() {
    return {
      primaries: this.primaries,
      transfer: this.transfer,
      matrix: this.matrix,
      fullRange: this.fullRange
    };
  }
}
var isVideoFrame = (x) => {
  return typeof VideoFrame !== "undefined" && x instanceof VideoFrame;
};
var clampCropRectangle = (crop, outerWidth, outerHeight) => {
  const left = Math.min(crop.left, outerWidth);
  const top = Math.min(crop.top, outerHeight);
  const width = Math.min(crop.width, outerWidth - left);
  const height = Math.min(crop.height, outerHeight - top);
  assert(width >= 0);
  assert(height >= 0);
  return { left, top, width, height };
};
var validateCropRectangle = (crop, prefix) => {
  if (!crop || typeof crop !== "object") {
    throw new TypeError(prefix + "crop, when provided, must be an object.");
  }
  if (!Number.isInteger(crop.left) || crop.left < 0) {
    throw new TypeError(prefix + "crop.left must be a non-negative integer.");
  }
  if (!Number.isInteger(crop.top) || crop.top < 0) {
    throw new TypeError(prefix + "crop.top must be a non-negative integer.");
  }
  if (!Number.isInteger(crop.width) || crop.width < 0) {
    throw new TypeError(prefix + "crop.width must be a non-negative integer.");
  }
  if (!Number.isInteger(crop.height) || crop.height < 0) {
    throw new TypeError(prefix + "crop.height must be a non-negative integer.");
  }
};
var validateVideoFrameCopyToOptions = (options) => {
  if (!options || typeof options !== "object") {
    throw new TypeError("options must be an object.");
  }
  if (options.colorSpace !== undefined && !["display-p3", "srgb"].includes(options.colorSpace)) {
    throw new TypeError("options.colorSpace, when provided, must be 'display-p3' or 'srgb'.");
  }
  if (options.format !== undefined && typeof options.format !== "string") {
    throw new TypeError("options.format, when provided, must be a string.");
  }
  if (options.layout !== undefined) {
    if (!Array.isArray(options.layout)) {
      throw new TypeError("options.layout, when provided, must be an array.");
    }
    for (const plane of options.layout) {
      if (!plane || typeof plane !== "object") {
        throw new TypeError("Each entry in options.layout must be an object.");
      }
      if (!Number.isInteger(plane.offset) || plane.offset < 0) {
        throw new TypeError("plane.offset must be a non-negative integer.");
      }
      if (!Number.isInteger(plane.stride) || plane.stride < 0) {
        throw new TypeError("plane.stride must be a non-negative integer.");
      }
    }
  }
  if (options.rect !== undefined) {
    if (!options.rect || typeof options.rect !== "object") {
      throw new TypeError("options.rect, when provided, must be an object.");
    }
    if (options.rect.x !== undefined && (!Number.isInteger(options.rect.x) || options.rect.x < 0)) {
      throw new TypeError("options.rect.x, when provided, must be a non-negative integer.");
    }
    if (options.rect.y !== undefined && (!Number.isInteger(options.rect.y) || options.rect.y < 0)) {
      throw new TypeError("options.rect.y, when provided, must be a non-negative integer.");
    }
    if (options.rect.width !== undefined && (!Number.isInteger(options.rect.width) || options.rect.width < 0)) {
      throw new TypeError("options.rect.width, when provided, must be a non-negative integer.");
    }
    if (options.rect.height !== undefined && (!Number.isInteger(options.rect.height) || options.rect.height < 0)) {
      throw new TypeError("options.rect.height, when provided, must be a non-negative integer.");
    }
  }
};
var createDefaultPlaneLayout = (format, codedWidth, codedHeight) => {
  const planes = getPlaneConfigs(format);
  const layouts = [];
  let currentOffset = 0;
  for (const plane of planes) {
    const planeWidth = Math.ceil(codedWidth / plane.widthDivisor);
    const planeHeight = Math.ceil(codedHeight / plane.heightDivisor);
    const stride = planeWidth * plane.sampleBytes;
    const planeSize = stride * planeHeight;
    layouts.push({
      offset: currentOffset,
      stride
    });
    currentOffset += planeSize;
  }
  return layouts;
};
var getPlaneConfigs = (format) => {
  const yuv = (yBytes, uvBytes, subX, subY, hasAlpha) => {
    const configs = [
      { sampleBytes: yBytes, widthDivisor: 1, heightDivisor: 1 },
      { sampleBytes: uvBytes, widthDivisor: subX, heightDivisor: subY },
      { sampleBytes: uvBytes, widthDivisor: subX, heightDivisor: subY }
    ];
    if (hasAlpha) {
      configs.push({ sampleBytes: yBytes, widthDivisor: 1, heightDivisor: 1 });
    }
    return configs;
  };
  switch (format) {
    case "I420":
      return yuv(1, 1, 2, 2, false);
    case "I420P10":
    case "I420P12":
      return yuv(2, 2, 2, 2, false);
    case "I420A":
      return yuv(1, 1, 2, 2, true);
    case "I420AP10":
    case "I420AP12":
      return yuv(2, 2, 2, 2, true);
    case "I422":
      return yuv(1, 1, 2, 1, false);
    case "I422P10":
    case "I422P12":
      return yuv(2, 2, 2, 1, false);
    case "I422A":
      return yuv(1, 1, 2, 1, true);
    case "I422AP10":
    case "I422AP12":
      return yuv(2, 2, 2, 1, true);
    case "I444":
      return yuv(1, 1, 1, 1, false);
    case "I444P10":
    case "I444P12":
      return yuv(2, 2, 1, 1, false);
    case "I444A":
      return yuv(1, 1, 1, 1, true);
    case "I444AP10":
    case "I444AP12":
      return yuv(2, 2, 1, 1, true);
    case "NV12":
      return [
        { sampleBytes: 1, widthDivisor: 1, heightDivisor: 1 },
        { sampleBytes: 2, widthDivisor: 2, heightDivisor: 2 }
      ];
    case "RGBA":
    case "RGBX":
    case "BGRA":
    case "BGRX":
      return [
        { sampleBytes: 4, widthDivisor: 1, heightDivisor: 1 }
      ];
    default:
      assertNever(format);
      assert(false);
  }
};
var ParseVideoFrameCopyToOptions = (sample, options) => {
  const defaultRect = {
    left: 0,
    top: 0,
    width: sample.codedWidth,
    height: sample.codedHeight
  };
  const overrideRect = options.rect;
  const parsedRect = ParseVisibleRect(defaultRect, overrideRect, sample.codedWidth, sample.codedHeight, sample.format);
  const optLayout = options.layout;
  let format;
  if (!options.format || options.format === sample.format) {
    format = sample.format;
  } else if (["RGBA", "RGBX", "BGRA", "BGRX"].includes(options.format)) {
    format = options.format;
  } else {
    throw new Error("NotSupportedError: Invalid destination format.");
  }
  return ComputeLayoutAndAllocationSize(parsedRect, format, optLayout);
};
var ParseVisibleRect = (defaultRect, overrideRect, codedWidth, codedHeight, format) => {
  const sourceRect = { ...defaultRect };
  if (overrideRect !== undefined) {
    if (overrideRect.width === 0 || overrideRect.height === 0) {
      throw new TypeError("visibleRect dimensions cannot be zero.");
    }
    if ((overrideRect.x || 0) + (overrideRect.width || 0) > codedWidth) {
      throw new TypeError("visibleRect exceeds codedWidth.");
    }
    if ((overrideRect.y || 0) + (overrideRect.height || 0) > codedHeight) {
      throw new TypeError("visibleRect exceeds codedHeight.");
    }
    sourceRect.x = overrideRect.x || 0;
    sourceRect.y = overrideRect.y || 0;
    sourceRect.width = overrideRect.width || 0;
    sourceRect.height = overrideRect.height || 0;
  }
  const validAlignment = VerifyRectOffsetAlignment(format, sourceRect);
  if (!validAlignment) {
    throw new TypeError("visibleRect alignment is invalid for the format.");
  }
  return sourceRect;
};
var VerifyRectOffsetAlignment = (format, rect) => {
  if (format === null)
    return true;
  const planes = getPlaneConfigs(format);
  for (let planeIndex = 0;planeIndex < planes.length; planeIndex++) {
    const plane = planes[planeIndex];
    const sampleWidth = plane.widthDivisor;
    const sampleHeight = plane.heightDivisor;
    if ((rect.x || 0) % sampleWidth !== 0)
      return false;
    if ((rect.y || 0) % sampleHeight !== 0)
      return false;
  }
  return true;
};
var ComputeLayoutAndAllocationSize = (parsedRect, format, layout) => {
  const planes = getPlaneConfigs(format);
  const numPlanes = planes.length;
  if (layout !== undefined && layout.length !== numPlanes) {
    throw new TypeError(`Layout must have ${numPlanes} planes.`);
  }
  let minAllocationSize = 0;
  const computedLayouts = [];
  const endOffsets = [];
  for (let planeIndex = 0;planeIndex < numPlanes; planeIndex++) {
    const plane = planes[planeIndex];
    const sampleBytes = plane.sampleBytes;
    const sampleWidth = plane.widthDivisor;
    const sampleHeight = plane.heightDivisor;
    const computedLayout = {
      destinationOffset: 0,
      destinationStride: 0,
      sourceTop: 0,
      sourceHeight: 0,
      sourceLeftBytes: 0,
      sourceWidthBytes: 0
    };
    computedLayout.sourceTop = Math.ceil(Math.trunc(parsedRect.y || 0) / sampleHeight);
    computedLayout.sourceHeight = Math.ceil(Math.trunc(parsedRect.height || 0) / sampleHeight);
    computedLayout.sourceLeftBytes = Math.floor(Math.trunc(parsedRect.x || 0) / sampleWidth) * sampleBytes;
    computedLayout.sourceWidthBytes = Math.floor(Math.trunc(parsedRect.width || 0) / sampleWidth) * sampleBytes;
    if (layout !== undefined) {
      const planeLayout = layout[planeIndex];
      if (planeLayout.stride < computedLayout.sourceWidthBytes) {
        throw new TypeError(`Stride for plane ${planeIndex} is too small.`);
      }
      computedLayout.destinationOffset = planeLayout.offset;
      computedLayout.destinationStride = planeLayout.stride;
    } else {
      computedLayout.destinationOffset = minAllocationSize;
      computedLayout.destinationStride = computedLayout.sourceWidthBytes;
    }
    const planeSize = computedLayout.destinationStride * computedLayout.sourceHeight;
    const planeEnd = planeSize + computedLayout.destinationOffset;
    if (planeEnd > 4294967295) {
      throw new TypeError("Allocation size exceeds limit.");
    }
    endOffsets.push(planeEnd);
    minAllocationSize = Math.max(minAllocationSize, planeEnd);
    for (let earlierPlaneIndex = 0;earlierPlaneIndex < planeIndex; earlierPlaneIndex++) {
      const earlierLayout = computedLayouts[earlierPlaneIndex];
      if (endOffsets[planeIndex] <= earlierLayout.destinationOffset || endOffsets[earlierPlaneIndex] <= computedLayout.destinationOffset) {
        continue;
      }
      throw new TypeError("Planes overlap.");
    }
    computedLayouts.push(computedLayout);
  }
  return {
    allocationSize: minAllocationSize,
    computedLayouts
  };
};
var AUDIO_SAMPLE_FORMATS = new Set(["f32", "f32-planar", "s16", "s16-planar", "s32", "s32-planar", "u8", "u8-planar"]);

class AudioSampleResource {
  constructor() {
    this._referenceCount = 0;
  }
}

class AudioSample {
  get microsecondTimestamp() {
    return Math.trunc(SECOND_TO_MICROSECOND_FACTOR * this.timestamp);
  }
  get microsecondDuration() {
    return Math.trunc(SECOND_TO_MICROSECOND_FACTOR * this.duration);
  }
  constructor(init) {
    this._closed = false;
    if (isAudioData(init)) {
      if (init.format === null) {
        throw new TypeError("AudioData with null format is not supported.");
      }
      this._data = init;
      this.format = init.format;
      this.sampleRate = init.sampleRate;
      this.numberOfFrames = init.numberOfFrames;
      this.numberOfChannels = init.numberOfChannels;
      this.timestamp = init.timestamp / 1e6;
      this.duration = init.numberOfFrames / init.sampleRate;
    } else if (init instanceof AudioSampleResource) {
      this._data = init;
      init._referenceCount++;
      this.format = init.getFormat();
      if (!AUDIO_SAMPLE_FORMATS.has(this.format)) {
        throw new TypeError("getFormat() must return an AudioSampleFormat.");
      }
      this.sampleRate = init.getSampleRate();
      if (!Number.isInteger(this.sampleRate) || this.sampleRate <= 0) {
        throw new TypeError("getSampleRate() must return a positive integer.");
      }
      this.numberOfFrames = init.getNumberOfFrames();
      if (!Number.isInteger(this.numberOfFrames) || this.numberOfFrames < 0) {
        throw new TypeError("getNumberOfFrames() must return a non-negative integer.");
      }
      this.numberOfChannels = init.getNumberOfChannels();
      if (!Number.isInteger(this.numberOfChannels) || this.numberOfChannels <= 0) {
        throw new TypeError("getNumberOfChannels() must return a positive integer.");
      }
      this.timestamp = init.getTimestamp();
      if (!Number.isFinite(this.timestamp)) {
        throw new TypeError("getTimestamp() must return a finite number.");
      }
      this.duration = this.numberOfFrames / this.sampleRate;
    } else {
      if (!init || typeof init !== "object") {
        throw new TypeError("Invalid AudioDataInit: must be an object.");
      }
      if (!AUDIO_SAMPLE_FORMATS.has(init.format)) {
        throw new TypeError("Invalid AudioDataInit: invalid format.");
      }
      if (!Number.isFinite(init.sampleRate) || init.sampleRate <= 0) {
        throw new TypeError("Invalid AudioDataInit: sampleRate must be > 0.");
      }
      if (!Number.isInteger(init.numberOfChannels) || init.numberOfChannels === 0) {
        throw new TypeError("Invalid AudioDataInit: numberOfChannels must be an integer > 0.");
      }
      if (!Number.isFinite(init?.timestamp)) {
        throw new TypeError("init.timestamp must be a number.");
      }
      const numberOfFrames = init.data.byteLength / (getBytesPerSample(init.format) * init.numberOfChannels);
      if (!Number.isInteger(numberOfFrames)) {
        throw new TypeError("Invalid AudioDataInit: data size is not a multiple of frame size.");
      }
      this.format = init.format;
      this.sampleRate = init.sampleRate;
      this.numberOfFrames = numberOfFrames;
      this.numberOfChannels = init.numberOfChannels;
      this.timestamp = init.timestamp;
      this.duration = numberOfFrames / init.sampleRate;
      let dataBuffer;
      if (init.data instanceof ArrayBuffer) {
        dataBuffer = new Uint8Array(init.data);
      } else if (ArrayBuffer.isView(init.data)) {
        dataBuffer = new Uint8Array(init.data.buffer, init.data.byteOffset, init.data.byteLength);
      } else {
        throw new TypeError("Invalid AudioDataInit: data is not a BufferSource.");
      }
      const expectedSize = this.numberOfFrames * this.numberOfChannels * getBytesPerSample(this.format);
      if (dataBuffer.byteLength < expectedSize) {
        throw new TypeError("Invalid AudioDataInit: insufficient data size.");
      }
      this._data = dataBuffer;
    }
    finalizationRegistry?.register(this, { type: "audio", data: this._data }, this);
  }
  allocationSize(options) {
    if (!options || typeof options !== "object") {
      throw new TypeError("options must be an object.");
    }
    if (!Number.isInteger(options.planeIndex) || options.planeIndex < 0) {
      throw new TypeError("planeIndex must be a non-negative integer.");
    }
    if (options.format !== undefined && !AUDIO_SAMPLE_FORMATS.has(options.format)) {
      throw new TypeError("Invalid format.");
    }
    if (options.frameOffset !== undefined && (!Number.isInteger(options.frameOffset) || options.frameOffset < 0)) {
      throw new TypeError("frameOffset must be a non-negative integer.");
    }
    if (options.frameCount !== undefined && (!Number.isInteger(options.frameCount) || options.frameCount < 0)) {
      throw new TypeError("frameCount must be a non-negative integer.");
    }
    if (this._closed) {
      throw new Error("AudioSample is closed.");
    }
    const destFormat = options.format ?? this.format;
    const frameOffset = options.frameOffset ?? 0;
    if (frameOffset >= this.numberOfFrames) {
      throw new RangeError("frameOffset out of range");
    }
    const copyFrameCount = options.frameCount !== undefined ? options.frameCount : this.numberOfFrames - frameOffset;
    if (copyFrameCount > this.numberOfFrames - frameOffset) {
      throw new RangeError("frameCount out of range");
    }
    const bytesPerSample = getBytesPerSample(destFormat);
    const isPlanar = formatIsPlanar(destFormat);
    if (isPlanar && options.planeIndex >= this.numberOfChannels) {
      throw new RangeError("planeIndex out of range");
    }
    if (!isPlanar && options.planeIndex !== 0) {
      throw new RangeError("planeIndex out of range");
    }
    const elementCount = isPlanar ? copyFrameCount : copyFrameCount * this.numberOfChannels;
    return elementCount * bytesPerSample;
  }
  copyTo(destination, options) {
    if (!isAllowSharedBufferSource(destination)) {
      throw new TypeError("destination must be an ArrayBuffer or an ArrayBuffer view.");
    }
    if (!options || typeof options !== "object") {
      throw new TypeError("options must be an object.");
    }
    if (!Number.isInteger(options.planeIndex) || options.planeIndex < 0) {
      throw new TypeError("planeIndex must be a non-negative integer.");
    }
    if (options.format !== undefined && !AUDIO_SAMPLE_FORMATS.has(options.format)) {
      throw new TypeError("Invalid format.");
    }
    if (options.frameOffset !== undefined && (!Number.isInteger(options.frameOffset) || options.frameOffset < 0)) {
      throw new TypeError("frameOffset must be a non-negative integer.");
    }
    if (options.frameCount !== undefined && (!Number.isInteger(options.frameCount) || options.frameCount < 0)) {
      throw new TypeError("frameCount must be a non-negative integer.");
    }
    if (this._closed) {
      throw new Error("AudioSample is closed.");
    }
    const { format, frameCount: optFrameCount, frameOffset: optFrameOffset } = options;
    let { planeIndex } = options;
    const srcFormat = this.format;
    const destFormat = format ?? this.format;
    if (!destFormat)
      throw new Error("Destination format not determined");
    const numFrames = this.numberOfFrames;
    const numChannels = this.numberOfChannels;
    const frameOffset = optFrameOffset ?? 0;
    if (frameOffset >= numFrames) {
      throw new RangeError("frameOffset out of range");
    }
    const copyFrameCount = optFrameCount !== undefined ? optFrameCount : numFrames - frameOffset;
    if (copyFrameCount > numFrames - frameOffset) {
      throw new RangeError("frameCount out of range");
    }
    const destBytesPerSample = getBytesPerSample(destFormat);
    const destIsPlanar = formatIsPlanar(destFormat);
    if (destIsPlanar && planeIndex >= numChannels) {
      throw new RangeError("planeIndex out of range");
    }
    if (!destIsPlanar && planeIndex !== 0) {
      throw new RangeError("planeIndex out of range");
    }
    const destElementCount = destIsPlanar ? copyFrameCount : copyFrameCount * numChannels;
    const requiredSize = destElementCount * destBytesPerSample;
    if (destination.byteLength < requiredSize) {
      throw new RangeError("Destination buffer is too small");
    }
    const destView = toDataView(destination);
    const writeFn = getWriteFunction(destFormat);
    if (isAudioData(this._data)) {
      if (isWebKit() && numChannels > 2 && destFormat !== srcFormat) {
        doAudioDataCopyToWebKitWorkaround(this._data, destView, srcFormat, destFormat, numChannels, planeIndex, frameOffset, copyFrameCount);
      } else {
        this._data.copyTo(destination, {
          planeIndex,
          frameOffset,
          frameCount: copyFrameCount,
          format: destFormat
        });
      }
    } else {
      const readFn = getReadFunction(srcFormat);
      const srcBytesPerSample = getBytesPerSample(srcFormat);
      const srcIsPlanar = formatIsPlanar(srcFormat);
      let uint8Data;
      if (this._data instanceof AudioSampleResource) {
        const getDataPlaneValidated = (index) => {
          const result = this._data.getDataPlane(index);
          if (!(result instanceof Uint8Array)) {
            throw new TypeError("getDataPlane() must return a Uint8Array.");
          }
          const expectedSize = numFrames * srcBytesPerSample * (srcIsPlanar ? 1 : numChannels);
          if (result.byteLength !== expectedSize) {
            throw new TypeError(`Data plane ${index} has invalid size. Expected exactly ${expectedSize} bytes, got` + ` ${result.byteLength} bytes.`);
          }
          return result;
        };
        if (srcIsPlanar) {
          if (destIsPlanar) {
            uint8Data = getDataPlaneValidated(planeIndex);
            planeIndex = 0;
          } else {
            uint8Data = new Uint8Array(numFrames * srcBytesPerSample * numChannels);
            for (let ch = 0;ch < numChannels; ch++) {
              const planeData = getDataPlaneValidated(ch);
              uint8Data.set(planeData, ch * numFrames * srcBytesPerSample);
            }
          }
        } else {
          uint8Data = getDataPlaneValidated(0);
        }
      } else {
        uint8Data = this._data;
      }
      const srcView = toDataView(uint8Data);
      for (let i = 0;i < copyFrameCount; i++) {
        if (destIsPlanar) {
          const destOffset = i * destBytesPerSample;
          let srcOffset;
          if (srcIsPlanar) {
            srcOffset = (planeIndex * numFrames + (i + frameOffset)) * srcBytesPerSample;
          } else {
            srcOffset = ((i + frameOffset) * numChannels + planeIndex) * srcBytesPerSample;
          }
          const normalized = readFn(srcView, srcOffset);
          writeFn(destView, destOffset, normalized);
        } else {
          for (let ch = 0;ch < numChannels; ch++) {
            const destIndex = i * numChannels + ch;
            const destOffset = destIndex * destBytesPerSample;
            let srcOffset;
            if (srcIsPlanar) {
              srcOffset = (ch * numFrames + (i + frameOffset)) * srcBytesPerSample;
            } else {
              srcOffset = ((i + frameOffset) * numChannels + ch) * srcBytesPerSample;
            }
            const normalized = readFn(srcView, srcOffset);
            writeFn(destView, destOffset, normalized);
          }
        }
      }
    }
  }
  clone() {
    if (this._closed) {
      throw new Error("AudioSample is closed.");
    }
    if (this._data instanceof AudioSampleResource) {
      const sample = new AudioSample(this._data);
      sample.setTimestamp(this.timestamp);
      return sample;
    } else if (isAudioData(this._data)) {
      const sample = new AudioSample(this._data.clone());
      sample.setTimestamp(this.timestamp);
      return sample;
    } else {
      return new AudioSample({
        format: this.format,
        sampleRate: this.sampleRate,
        numberOfFrames: this.numberOfFrames,
        numberOfChannels: this.numberOfChannels,
        timestamp: this.timestamp,
        data: this._data
      });
    }
  }
  trim(startSample, endSample = this.numberOfFrames) {
    if (!Number.isInteger(startSample) || startSample < 0) {
      throw new TypeError("startSample must be a non-negative integer.");
    }
    if (!Number.isInteger(endSample) || endSample < 0) {
      throw new TypeError("endSample must be a non-negative integer.");
    }
    if (startSample > this.numberOfFrames) {
      throw new RangeError("startSample out of range.");
    }
    if (endSample > this.numberOfFrames) {
      throw new RangeError("endSample out of range.");
    }
    if (endSample < startSample) {
      throw new RangeError("endSample must not be less than startSample.");
    }
    if (this._closed) {
      throw new Error("AudioSample is closed.");
    }
    const frameCount = endSample - startSample;
    const bytesPerSample = getBytesPerSample(this.format);
    let data;
    if (formatIsPlanar(this.format)) {
      const planeSize = frameCount * bytesPerSample;
      data = new Uint8Array(planeSize * this.numberOfChannels);
      if (frameCount > 0) {
        for (let i = 0;i < this.numberOfChannels; i++) {
          this.copyTo(data.subarray(i * planeSize, (i + 1) * planeSize), {
            planeIndex: i,
            format: this.format,
            frameOffset: startSample,
            frameCount
          });
        }
      }
    } else {
      data = new Uint8Array(frameCount * this.numberOfChannels * bytesPerSample);
      if (frameCount > 0) {
        this.copyTo(data, {
          planeIndex: 0,
          format: this.format,
          frameOffset: startSample,
          frameCount
        });
      }
    }
    return new AudioSample({
      data,
      format: this.format,
      sampleRate: this.sampleRate,
      numberOfChannels: this.numberOfChannels,
      timestamp: this.timestamp + startSample / this.sampleRate
    });
  }
  close() {
    if (this._closed) {
      return;
    }
    finalizationRegistry?.unregister(this);
    if (this._data instanceof AudioSampleResource) {
      this._data._referenceCount--;
      if (this._data._referenceCount === 0) {
        this._data.close();
      }
    } else if (isAudioData(this._data)) {
      this._data.close();
    } else {
      this._data = new Uint8Array(0);
    }
    this._closed = true;
  }
  toAudioData() {
    if (this._closed) {
      throw new Error("AudioSample is closed.");
    }
    if (this._data instanceof AudioSampleResource) {
      return this._createAudioDataFromData();
    } else if (isAudioData(this._data)) {
      if (this._data.timestamp === this.microsecondTimestamp) {
        return this._data.clone();
      } else {
        return this._createAudioDataFromData();
      }
    } else {
      return new AudioData({
        format: this.format,
        sampleRate: this.sampleRate,
        numberOfFrames: this.numberOfFrames,
        numberOfChannels: this.numberOfChannels,
        timestamp: this.microsecondTimestamp,
        data: this._data.buffer instanceof ArrayBuffer ? this._data.buffer : this._data.slice()
      });
    }
  }
  _createAudioDataFromData() {
    if (formatIsPlanar(this.format)) {
      const size = this.allocationSize({ planeIndex: 0, format: this.format });
      const data = new ArrayBuffer(size * this.numberOfChannels);
      for (let i = 0;i < this.numberOfChannels; i++) {
        this.copyTo(new Uint8Array(data, i * size, size), { planeIndex: i, format: this.format });
      }
      return new AudioData({
        format: this.format,
        sampleRate: this.sampleRate,
        numberOfFrames: this.numberOfFrames,
        numberOfChannels: this.numberOfChannels,
        timestamp: this.microsecondTimestamp,
        data
      });
    } else {
      const data = new ArrayBuffer(this.allocationSize({ planeIndex: 0, format: this.format }));
      this.copyTo(data, { planeIndex: 0, format: this.format });
      return new AudioData({
        format: this.format,
        sampleRate: this.sampleRate,
        numberOfFrames: this.numberOfFrames,
        numberOfChannels: this.numberOfChannels,
        timestamp: this.microsecondTimestamp,
        data
      });
    }
  }
  toAudioBuffer() {
    if (this._closed) {
      throw new Error("AudioSample is closed.");
    }
    const audioBuffer = new AudioBuffer({
      numberOfChannels: this.numberOfChannels,
      length: this.numberOfFrames,
      sampleRate: this.sampleRate
    });
    const dataBytes = new Float32Array(this.allocationSize({ planeIndex: 0, format: "f32-planar" }) / 4);
    for (let i = 0;i < this.numberOfChannels; i++) {
      this.copyTo(dataBytes, { planeIndex: i, format: "f32-planar" });
      audioBuffer.copyToChannel(dataBytes, i);
    }
    return audioBuffer;
  }
  setTimestamp(newTimestamp) {
    if (!Number.isFinite(newTimestamp)) {
      throw new TypeError("newTimestamp must be a number.");
    }
    this.timestamp = newTimestamp;
  }
  [Symbol.dispose]() {
    this.close();
  }
  static *_fromAudioBuffer(audioBuffer, timestamp) {
    if (!(audioBuffer instanceof AudioBuffer)) {
      throw new TypeError("audioBuffer must be an AudioBuffer.");
    }
    const MAX_FLOAT_COUNT = 48000 * 5;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const totalFrames = audioBuffer.length;
    const maxFramesPerChunk = Math.floor(MAX_FLOAT_COUNT / numberOfChannels);
    let currentRelativeFrame = 0;
    let remainingFrames = totalFrames;
    while (remainingFrames > 0) {
      const framesToCopy = Math.min(maxFramesPerChunk, remainingFrames);
      const chunkData = new Float32Array(numberOfChannels * framesToCopy);
      for (let channel = 0;channel < numberOfChannels; channel++) {
        audioBuffer.copyFromChannel(chunkData.subarray(channel * framesToCopy, (channel + 1) * framesToCopy), channel, currentRelativeFrame);
      }
      yield new AudioSample({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: framesToCopy,
        numberOfChannels,
        timestamp: timestamp + currentRelativeFrame / sampleRate,
        data: chunkData
      });
      currentRelativeFrame += framesToCopy;
      remainingFrames -= framesToCopy;
    }
  }
  static fromAudioBuffer(audioBuffer, timestamp) {
    if (!(audioBuffer instanceof AudioBuffer)) {
      throw new TypeError("audioBuffer must be an AudioBuffer.");
    }
    const MAX_FLOAT_COUNT = 48000 * 5;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const totalFrames = audioBuffer.length;
    const maxFramesPerChunk = Math.floor(MAX_FLOAT_COUNT / numberOfChannels);
    let currentRelativeFrame = 0;
    let remainingFrames = totalFrames;
    const result = [];
    while (remainingFrames > 0) {
      const framesToCopy = Math.min(maxFramesPerChunk, remainingFrames);
      const chunkData = new Float32Array(numberOfChannels * framesToCopy);
      for (let channel = 0;channel < numberOfChannels; channel++) {
        audioBuffer.copyFromChannel(chunkData.subarray(channel * framesToCopy, (channel + 1) * framesToCopy), channel, currentRelativeFrame);
      }
      const audioSample = new AudioSample({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: framesToCopy,
        numberOfChannels,
        timestamp: timestamp + currentRelativeFrame / sampleRate,
        data: chunkData
      });
      result.push(audioSample);
      currentRelativeFrame += framesToCopy;
      remainingFrames -= framesToCopy;
    }
    return result;
  }
}
var getBytesPerSample = (format) => {
  switch (format) {
    case "u8":
    case "u8-planar":
      return 1;
    case "s16":
    case "s16-planar":
      return 2;
    case "s32":
    case "s32-planar":
      return 4;
    case "f32":
    case "f32-planar":
      return 4;
    default:
      throw new Error("Unknown AudioSampleFormat");
  }
};
var formatIsPlanar = (format) => {
  switch (format) {
    case "u8-planar":
    case "s16-planar":
    case "s32-planar":
    case "f32-planar":
      return true;
    default:
      return false;
  }
};
var getReadFunction = (format) => {
  switch (format) {
    case "u8":
    case "u8-planar":
      return (view, offset) => (view.getUint8(offset) - 128) / 128;
    case "s16":
    case "s16-planar":
      return (view, offset) => view.getInt16(offset, true) / 32768;
    case "s32":
    case "s32-planar":
      return (view, offset) => view.getInt32(offset, true) / 2147483648;
    case "f32":
    case "f32-planar":
      return (view, offset) => view.getFloat32(offset, true);
  }
};
var getWriteFunction = (format) => {
  switch (format) {
    case "u8":
    case "u8-planar":
      return (view, offset, value) => view.setUint8(offset, clamp((value + 1) * 127.5, 0, 255));
    case "s16":
    case "s16-planar":
      return (view, offset, value) => view.setInt16(offset, clamp(Math.round(value * 32767), -32768, 32767), true);
    case "s32":
    case "s32-planar":
      return (view, offset, value) => view.setInt32(offset, clamp(Math.round(value * 2147483647), -2147483648, 2147483647), true);
    case "f32":
    case "f32-planar":
      return (view, offset, value) => view.setFloat32(offset, value, true);
  }
};
var isAudioData = (x) => {
  return typeof AudioData !== "undefined" && x instanceof AudioData;
};
var doAudioDataCopyToWebKitWorkaround = (audioData, destView, srcFormat, destFormat, numChannels, planeIndex, frameOffset, copyFrameCount) => {
  const readFn = getReadFunction(srcFormat);
  const writeFn = getWriteFunction(destFormat);
  const srcBytesPerSample = getBytesPerSample(srcFormat);
  const destBytesPerSample = getBytesPerSample(destFormat);
  const srcIsPlanar = formatIsPlanar(srcFormat);
  const destIsPlanar = formatIsPlanar(destFormat);
  if (destIsPlanar) {
    if (srcIsPlanar) {
      const data = new ArrayBuffer(copyFrameCount * srcBytesPerSample);
      const dataView = toDataView(data);
      audioData.copyTo(data, {
        planeIndex,
        frameOffset,
        frameCount: copyFrameCount,
        format: srcFormat
      });
      for (let i = 0;i < copyFrameCount; i++) {
        const srcOffset = i * srcBytesPerSample;
        const destOffset = i * destBytesPerSample;
        const sample = readFn(dataView, srcOffset);
        writeFn(destView, destOffset, sample);
      }
    } else {
      const data = new ArrayBuffer(copyFrameCount * numChannels * srcBytesPerSample);
      const dataView = toDataView(data);
      audioData.copyTo(data, {
        planeIndex: 0,
        frameOffset,
        frameCount: copyFrameCount,
        format: srcFormat
      });
      for (let i = 0;i < copyFrameCount; i++) {
        const srcOffset = (i * numChannels + planeIndex) * srcBytesPerSample;
        const destOffset = i * destBytesPerSample;
        const sample = readFn(dataView, srcOffset);
        writeFn(destView, destOffset, sample);
      }
    }
  } else {
    if (srcIsPlanar) {
      const planeSize = copyFrameCount * srcBytesPerSample;
      const data = new ArrayBuffer(planeSize);
      const dataView = toDataView(data);
      for (let ch = 0;ch < numChannels; ch++) {
        audioData.copyTo(data, {
          planeIndex: ch,
          frameOffset,
          frameCount: copyFrameCount,
          format: srcFormat
        });
        for (let i = 0;i < copyFrameCount; i++) {
          const srcOffset = i * srcBytesPerSample;
          const destOffset = (i * numChannels + ch) * destBytesPerSample;
          const sample = readFn(dataView, srcOffset);
          writeFn(destView, destOffset, sample);
        }
      }
    } else {
      const data = new ArrayBuffer(copyFrameCount * numChannels * srcBytesPerSample);
      const dataView = toDataView(data);
      audioData.copyTo(data, {
        planeIndex: 0,
        frameOffset,
        frameCount: copyFrameCount,
        format: srcFormat
      });
      for (let i = 0;i < copyFrameCount; i++) {
        for (let ch = 0;ch < numChannels; ch++) {
          const idx = i * numChannels + ch;
          const srcOffset = idx * srcBytesPerSample;
          const destOffset = idx * destBytesPerSample;
          const sample = readFn(dataView, srcOffset);
          writeFn(destView, destOffset, sample);
        }
      }
    }
  }
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/encode.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var canEncodeVideoMemo = new Map;
var canEncodeAudioMemo = new Map;

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/custom-coder.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var customVideoDecoders = [];
var customAudioDecoders = [];

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/pcm.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var fromUlaw = (u8) => {
  const MULAW_BIAS = 33;
  let sign = 0;
  let position = 0;
  let number = ~u8;
  if (number & 128) {
    number &= ~(1 << 7);
    sign = -1;
  }
  position = ((number & 240) >> 4) + 5;
  const decoded = (1 << position | (number & 15) << position - 4 | 1 << position - 5) - MULAW_BIAS;
  return sign === 0 ? decoded : -decoded;
};
var fromAlaw = (u8) => {
  let sign = 0;
  let position = 0;
  let number = u8 ^ 85;
  if (number & 128) {
    number &= ~(1 << 7);
    sign = -1;
  }
  position = ((number & 240) >> 4) + 4;
  let decoded = 0;
  if (position !== 4) {
    decoded = 1 << position | (number & 15) << position - 4 | 1 << position - 5;
  } else {
    decoded = number << 1 | 1;
  }
  return sign === 0 ? decoded : -decoded;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/media-sink.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var validatePacketRetrievalOptions = (options) => {
  if (!options || typeof options !== "object") {
    throw new TypeError("options must be an object.");
  }
  if (options.metadataOnly !== undefined && typeof options.metadataOnly !== "boolean") {
    throw new TypeError("options.metadataOnly, when defined, must be a boolean.");
  }
  if (options.verifyKeyPackets !== undefined && typeof options.verifyKeyPackets !== "boolean") {
    throw new TypeError("options.verifyKeyPackets, when defined, must be a boolean.");
  }
  if (options.verifyKeyPackets && options.metadataOnly) {
    throw new TypeError("options.verifyKeyPackets and options.metadataOnly cannot be enabled together.");
  }
  if (options.skipLiveWait !== undefined && typeof options.skipLiveWait !== "boolean") {
    throw new TypeError("options.skipLiveWait, when defined, must be a boolean.");
  }
};
var validateTimestamp = (timestamp) => {
  if (!isNumber(timestamp)) {
    throw new TypeError("timestamp must be a number.");
  }
};
var maybeFixPacketType = (track, promise, options) => {
  if (options.verifyKeyPackets) {
    return promise.then(async (packet) => {
      if (!packet || packet.type === "delta") {
        return packet;
      }
      const determinedType = await track.determinePacketType(packet);
      if (determinedType) {
        packet.type = determinedType;
      }
      return packet;
    });
  } else {
    return promise;
  }
};

class EncodedPacketSink {
  constructor(track) {
    if (!(track instanceof InputTrack)) {
      throw new TypeError("track must be an InputTrack.");
    }
    this._track = track;
  }
  async getFirstPacket(options = {}) {
    validatePacketRetrievalOptions(options);
    if (this._track.input._disposed) {
      throw new InputDisposedError;
    }
    return maybeFixPacketType(this._track, this._track._backing.getFirstPacket(options), options);
  }
  async getFirstKeyPacket(options = {}) {
    validatePacketRetrievalOptions(options);
    const firstPacket = await this.getFirstPacket(options);
    if (!firstPacket) {
      return null;
    }
    if (firstPacket.type === "key") {
      return firstPacket;
    }
    return this.getNextKeyPacket(firstPacket, options);
  }
  async getPacket(timestamp, options = {}) {
    validateTimestamp(timestamp);
    validatePacketRetrievalOptions(options);
    if (this._track.input._disposed) {
      throw new InputDisposedError;
    }
    return maybeFixPacketType(this._track, this._track._backing.getPacket(timestamp, options), options);
  }
  async getNextPacket(packet, options = {}) {
    if (!(packet instanceof EncodedPacket)) {
      throw new TypeError("packet must be an EncodedPacket.");
    }
    validatePacketRetrievalOptions(options);
    if (this._track.input._disposed) {
      throw new InputDisposedError;
    }
    return maybeFixPacketType(this._track, this._track._backing.getNextPacket(packet, options), options);
  }
  async getKeyPacket(timestamp, options = {}) {
    validateTimestamp(timestamp);
    validatePacketRetrievalOptions(options);
    if (this._track.input._disposed) {
      throw new InputDisposedError;
    }
    if (!options.verifyKeyPackets) {
      return this._track._backing.getKeyPacket(timestamp, options);
    }
    const packet = await this._track._backing.getKeyPacket(timestamp, options);
    if (!packet) {
      return packet;
    }
    assert(packet.type === "key");
    const determinedType = await this._track.determinePacketType(packet);
    if (determinedType === "delta") {
      return this.getKeyPacket(packet.timestamp - 1 / await this._track.getTimeResolution(), options);
    }
    return packet;
  }
  async getNextKeyPacket(packet, options = {}) {
    if (!(packet instanceof EncodedPacket)) {
      throw new TypeError("packet must be an EncodedPacket.");
    }
    validatePacketRetrievalOptions(options);
    if (this._track.input._disposed) {
      throw new InputDisposedError;
    }
    if (!options.verifyKeyPackets) {
      return this._track._backing.getNextKeyPacket(packet, options);
    }
    const nextPacket = await this._track._backing.getNextKeyPacket(packet, options);
    if (!nextPacket) {
      return nextPacket;
    }
    assert(nextPacket.type === "key");
    const determinedType = await this._track.determinePacketType(nextPacket);
    if (determinedType === "delta") {
      return this.getNextKeyPacket(nextPacket, options);
    }
    return nextPacket;
  }
  packets(startPacket, endPacket, options = {}) {
    if (startPacket !== undefined && !(startPacket instanceof EncodedPacket)) {
      throw new TypeError("startPacket must be an EncodedPacket.");
    }
    if (startPacket !== undefined && startPacket.isMetadataOnly && !options?.metadataOnly) {
      throw new TypeError("startPacket can only be metadata-only if options.metadataOnly is enabled.");
    }
    if (endPacket !== undefined && !(endPacket instanceof EncodedPacket)) {
      throw new TypeError("endPacket must be an EncodedPacket.");
    }
    validatePacketRetrievalOptions(options);
    if (this._track.input._disposed) {
      throw new InputDisposedError;
    }
    const packetQueue = [];
    let { promise: queueNotEmpty, resolve: onQueueNotEmpty } = promiseWithResolvers();
    let { promise: queueDequeue, resolve: onQueueDequeue } = promiseWithResolvers();
    let ended = false;
    let terminated = false;
    let outOfBandError = null;
    const timestamps = [];
    const maxQueueSize = () => Math.max(2, timestamps.length);
    (async () => {
      let packet = startPacket ?? await this.getFirstPacket(options);
      while (packet && !terminated && !this._track.input._disposed) {
        if (endPacket && packet.sequenceNumber >= endPacket?.sequenceNumber) {
          break;
        }
        if (packetQueue.length > maxQueueSize()) {
          ({ promise: queueDequeue, resolve: onQueueDequeue } = promiseWithResolvers());
          await queueDequeue;
          continue;
        }
        packetQueue.push(packet);
        onQueueNotEmpty();
        ({ promise: queueNotEmpty, resolve: onQueueNotEmpty } = promiseWithResolvers());
        packet = await this.getNextPacket(packet, options);
      }
      ended = true;
      onQueueNotEmpty();
    })().catch((error) => {
      if (!outOfBandError) {
        outOfBandError = error;
        onQueueNotEmpty();
      }
    });
    const track = this._track;
    return {
      async next() {
        while (true) {
          if (track.input._disposed) {
            throw new InputDisposedError;
          } else if (terminated) {
            return { value: undefined, done: true };
          } else if (outOfBandError) {
            throw outOfBandError;
          } else if (packetQueue.length > 0) {
            const value = packetQueue.shift();
            const now = performance.now();
            timestamps.push(now);
            while (timestamps.length > 0 && now - timestamps[0] >= 1000) {
              timestamps.shift();
            }
            onQueueDequeue();
            return { value, done: false };
          } else if (ended) {
            return { value: undefined, done: true };
          } else {
            await queueNotEmpty;
          }
        }
      },
      async return() {
        terminated = true;
        onQueueDequeue();
        onQueueNotEmpty();
        return { value: undefined, done: true };
      },
      async throw(error) {
        throw error;
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
}

class DecoderWrapper {
  constructor(onSample, onError) {
    this.onSample = onSample;
    this.onError = onError;
  }
}

class BaseMediaSampleSink {
  mediaSamplesInRange(startTimestamp = -Infinity, endTimestamp = Infinity, options) {
    validateTimestamp(startTimestamp);
    validateTimestamp(endTimestamp);
    const sampleQueue = [];
    let firstSampleQueued = false;
    let lastSample = null;
    let { promise: queueNotEmpty, resolve: onQueueNotEmpty } = promiseWithResolvers();
    let { promise: queueDequeue, resolve: onQueueDequeue } = promiseWithResolvers();
    let decoderIsFlushed = false;
    let ended = false;
    let terminated = false;
    let outOfBandError = null;
    const packetRetrievalOptions = {
      ...options,
      verifyKeyPackets: true,
      metadataOnly: false
    };
    (async () => {
      const decoder = await this._createDecoder((sample) => {
        onQueueDequeue();
        if (sample.timestamp >= endTimestamp) {
          ended = true;
        }
        if (ended) {
          sample.close();
          return;
        }
        if (lastSample) {
          if (sample.timestamp > startTimestamp) {
            sampleQueue.push(lastSample);
            firstSampleQueued = true;
          } else {
            lastSample.close();
          }
        }
        if (sample.timestamp >= startTimestamp) {
          sampleQueue.push(sample);
          firstSampleQueued = true;
        }
        lastSample = firstSampleQueued ? null : sample;
        if (sampleQueue.length > 0) {
          onQueueNotEmpty();
          ({ promise: queueNotEmpty, resolve: onQueueNotEmpty } = promiseWithResolvers());
        }
      }, (error) => {
        if (!outOfBandError) {
          outOfBandError = error;
          onQueueNotEmpty();
        }
      });
      const packetSink = this._createPacketSink();
      const keyPacket = await packetSink.getKeyPacket(startTimestamp, packetRetrievalOptions) ?? await packetSink.getFirstKeyPacket(packetRetrievalOptions);
      let currentPacket = keyPacket;
      const endPacket = undefined;
      const packets = packetSink.packets(keyPacket ?? undefined, endPacket, packetRetrievalOptions);
      await packets.next();
      while (currentPacket && !ended && !this._track.input._disposed) {
        const maxQueueSize = computeMaxQueueSize(sampleQueue.length);
        if (sampleQueue.length + decoder.getDecodeQueueSize() > maxQueueSize) {
          ({ promise: queueDequeue, resolve: onQueueDequeue } = promiseWithResolvers());
          await queueDequeue;
          continue;
        }
        decoder.decode(currentPacket);
        const packetResult = await packets.next();
        if (packetResult.done) {
          break;
        }
        currentPacket = packetResult.value;
      }
      await packets.return();
      if (!terminated && !this._track.input._disposed) {
        await decoder.flush();
      }
      decoder.close();
      if (!firstSampleQueued && lastSample) {
        sampleQueue.push(lastSample);
      }
      decoderIsFlushed = true;
      onQueueNotEmpty();
    })().catch((error) => {
      if (!outOfBandError) {
        outOfBandError = error;
        onQueueNotEmpty();
      }
    });
    const track = this._track;
    const closeSamples = () => {
      lastSample?.close();
      for (const sample of sampleQueue) {
        sample.close();
      }
    };
    return {
      async next() {
        while (true) {
          if (track.input._disposed) {
            closeSamples();
            throw new InputDisposedError;
          } else if (terminated) {
            return { value: undefined, done: true };
          } else if (outOfBandError) {
            closeSamples();
            throw outOfBandError;
          } else if (sampleQueue.length > 0) {
            const value = sampleQueue.shift();
            onQueueDequeue();
            return { value, done: false };
          } else if (!decoderIsFlushed) {
            await queueNotEmpty;
          } else {
            return { value: undefined, done: true };
          }
        }
      },
      async return() {
        terminated = true;
        ended = true;
        onQueueDequeue();
        onQueueNotEmpty();
        closeSamples();
        return { value: undefined, done: true };
      },
      async throw(error) {
        throw error;
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
  mediaSamplesAtTimestamps(timestamps, options) {
    validateAnyIterable(timestamps);
    const timestampIterator = toAsyncIterator(timestamps);
    const timestampsOfInterest = [];
    const sampleQueue = [];
    let { promise: queueNotEmpty, resolve: onQueueNotEmpty } = promiseWithResolvers();
    let { promise: queueDequeue, resolve: onQueueDequeue } = promiseWithResolvers();
    let decoderIsFlushed = false;
    let terminated = false;
    let outOfBandError = null;
    const pushToQueue = (sample) => {
      sampleQueue.push(sample);
      onQueueNotEmpty();
      ({ promise: queueNotEmpty, resolve: onQueueNotEmpty } = promiseWithResolvers());
    };
    const retrievalOptions = {
      ...options,
      verifyKeyPackets: true,
      metadataOnly: false
    };
    (async () => {
      const decoder = await this._createDecoder((sample) => {
        onQueueDequeue();
        if (terminated) {
          sample.close();
          return;
        }
        let sampleUses = 0;
        while (timestampsOfInterest.length > 0 && sample.timestamp - timestampsOfInterest[0] > -0.0000000001) {
          sampleUses++;
          timestampsOfInterest.shift();
        }
        if (sampleUses > 0) {
          for (let i = 0;i < sampleUses; i++) {
            pushToQueue(i < sampleUses - 1 ? sample.clone() : sample);
          }
        } else {
          sample.close();
        }
      }, (error) => {
        if (!outOfBandError) {
          outOfBandError = error;
          onQueueNotEmpty();
        }
      });
      const packetSink = this._createPacketSink();
      let lastPacket = null;
      let lastKeyPacket = null;
      let maxSequenceNumber = -1;
      const decodePackets = async () => {
        assert(lastKeyPacket);
        let currentPacket = lastKeyPacket;
        decoder.decode(currentPacket);
        while (currentPacket.sequenceNumber < maxSequenceNumber) {
          const maxQueueSize = computeMaxQueueSize(sampleQueue.length);
          while (sampleQueue.length + decoder.getDecodeQueueSize() > maxQueueSize && !terminated) {
            ({ promise: queueDequeue, resolve: onQueueDequeue } = promiseWithResolvers());
            await queueDequeue;
          }
          if (terminated) {
            break;
          }
          const nextPacket = await packetSink.getNextPacket(currentPacket, retrievalOptions);
          assert(nextPacket);
          decoder.decode(nextPacket);
          currentPacket = nextPacket;
        }
        maxSequenceNumber = -1;
      };
      const flushDecoder = async () => {
        await decoder.flush();
        for (let i = 0;i < timestampsOfInterest.length; i++) {
          pushToQueue(null);
        }
        timestampsOfInterest.length = 0;
      };
      for await (const timestamp of timestampIterator) {
        validateTimestamp(timestamp);
        if (terminated || this._track.input._disposed) {
          break;
        }
        const targetPacket = await packetSink.getPacket(timestamp, retrievalOptions);
        const keyPacket = targetPacket && await packetSink.getKeyPacket(timestamp, retrievalOptions);
        if (!keyPacket) {
          if (maxSequenceNumber !== -1) {
            await decodePackets();
            await flushDecoder();
          }
          pushToQueue(null);
          lastPacket = null;
          continue;
        }
        if (lastPacket && (keyPacket.sequenceNumber !== lastKeyPacket.sequenceNumber || targetPacket.timestamp < lastPacket.timestamp)) {
          await decodePackets();
          await flushDecoder();
        }
        timestampsOfInterest.push(targetPacket.timestamp);
        maxSequenceNumber = Math.max(targetPacket.sequenceNumber, maxSequenceNumber);
        lastPacket = targetPacket;
        lastKeyPacket = keyPacket;
      }
      if (!terminated && !this._track.input._disposed) {
        if (maxSequenceNumber !== -1) {
          await decodePackets();
        }
        await flushDecoder();
      }
      decoder.close();
      decoderIsFlushed = true;
      onQueueNotEmpty();
    })().catch((error) => {
      if (!outOfBandError) {
        outOfBandError = error;
        onQueueNotEmpty();
      }
    });
    const track = this._track;
    const closeSamples = () => {
      for (const sample of sampleQueue) {
        sample?.close();
      }
    };
    return {
      async next() {
        while (true) {
          if (track.input._disposed) {
            closeSamples();
            throw new InputDisposedError;
          } else if (terminated) {
            return { value: undefined, done: true };
          } else if (outOfBandError) {
            closeSamples();
            throw outOfBandError;
          } else if (sampleQueue.length > 0) {
            const value = sampleQueue.shift();
            assert(value !== undefined);
            onQueueDequeue();
            return { value, done: false };
          } else if (!decoderIsFlushed) {
            await queueNotEmpty;
          } else {
            return { value: undefined, done: true };
          }
        }
      },
      async return() {
        terminated = true;
        onQueueDequeue();
        onQueueNotEmpty();
        closeSamples();
        return { value: undefined, done: true };
      },
      async throw(error) {
        throw error;
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
}
var computeMaxQueueSize = (decodedSampleQueueSize) => {
  return decodedSampleQueueSize === 0 ? 40 : 8;
};

class VideoDecoderWrapper extends DecoderWrapper {
  constructor(onSample, onError, codec, decoderConfig, rotation, timeResolution) {
    super(onSample, onError);
    this.codec = codec;
    this.decoderConfig = decoderConfig;
    this.rotation = rotation;
    this.timeResolution = timeResolution;
    this.decoder = null;
    this.customDecoder = null;
    this.customDecoderCallSerializer = new CallSerializer;
    this.customDecoderQueueSize = 0;
    this.inputTimestamps = [];
    this.sampleQueue = [];
    this.currentPacketIndex = 0;
    this.raslSkipped = false;
    this.alphaDecoder = null;
    this.alphaHadKeyframe = false;
    this.colorQueue = [];
    this.alphaQueue = [];
    this.merger = null;
    this.decodedAlphaChunkCount = 0;
    this.alphaDecoderQueueSize = 0;
    this.nullAlphaFrameQueue = [];
    this.currentAlphaPacketIndex = 0;
    this.alphaRaslSkipped = false;
    this.frameHandlerSerializer = new CallSerializer;
    const MatchingCustomDecoder = customVideoDecoders.find((x) => x.supports(codec, decoderConfig));
    if (MatchingCustomDecoder) {
      this.customDecoder = new MatchingCustomDecoder;
      this.customDecoder.codec = codec;
      this.customDecoder.config = decoderConfig;
      this.customDecoder.onSample = (sample) => {
        if (!(sample instanceof VideoSample)) {
          throw new TypeError("The argument passed to onSample must be a VideoSample.");
        }
        this.finalizeAndEmitSample(sample);
      };
      this.customDecoderCallSerializer.call(() => this.customDecoder.init());
    } else {
      const colorHandler = (frame) => {
        this.frameHandlerSerializer.call(async () => {
          if (this.alphaQueue.length > 0) {
            const alphaFrame = this.alphaQueue.shift();
            assert(alphaFrame !== undefined);
            await this.mergeAlpha(frame, alphaFrame);
          } else {
            this.colorQueue.push(frame);
          }
        }).catch((error) => this.onError(error));
      };
      if (codec === "avc" && this.decoderConfig.description && isChromium()) {
        const record = deserializeAvcDecoderConfigurationRecord(toUint8Array(this.decoderConfig.description));
        if (record && record.sequenceParameterSets.length > 0) {
          const sps = parseAvcSps(record.sequenceParameterSets[0]);
          if (sps && sps.frameMbsOnlyFlag === 0) {
            this.decoderConfig = {
              ...this.decoderConfig,
              hardwareAcceleration: "prefer-software"
            };
          }
        }
      }
      const stack = new Error("Decoding error").stack;
      this.decoder = new VideoDecoder({
        output: (frame) => {
          try {
            colorHandler(frame);
          } catch (error) {
            this.onError(error);
          }
        },
        error: (error) => {
          error.stack = stack;
          this.onError(error);
        }
      });
      this.decoder.configure(this.decoderConfig);
    }
  }
  getDecodeQueueSize() {
    if (this.customDecoder) {
      return this.customDecoderQueueSize;
    } else {
      assert(this.decoder);
      return Math.max(this.decoder.decodeQueueSize, this.alphaDecoder?.decodeQueueSize ?? 0);
    }
  }
  decode(packet) {
    if (this.codec === "hevc" && this.currentPacketIndex > 0 && !this.raslSkipped) {
      if (this.hasHevcRaslPicture(packet.data)) {
        return;
      }
      this.raslSkipped = true;
    }
    if (this.customDecoder) {
      this.customDecoderQueueSize++;
      this.customDecoderCallSerializer.call(() => this.customDecoder.decode(packet)).then(() => this.customDecoderQueueSize--);
    } else {
      assert(this.decoder);
      if (!isWebKit()) {
        insertSorted(this.inputTimestamps, packet.timestamp, (x) => x);
      }
      if (isChromium() && this.currentPacketIndex === 0) {
        if (this.codec === "avc") {
          const filteredNalUnits = [];
          for (const loc of iterateAvcNalUnits(packet.data, this.decoderConfig)) {
            const type = extractNalUnitTypeForAvc(packet.data[loc.offset]);
            if (type === AvcNalUnitType.AUD) {
              filteredNalUnits.length = 0;
            }
            if (!(type >= 20 && type <= 31)) {
              filteredNalUnits.push(packet.data.subarray(loc.offset, loc.offset + loc.length));
            }
          }
          const newData = concatAvcNalUnits(filteredNalUnits, this.decoderConfig);
          packet = new EncodedPacket(newData, packet.type, packet.timestamp, packet.duration);
        } else if (this.codec === "hevc") {
          const sanitizedData = sanitizeHevcPacketForChromium(packet.data, this.decoderConfig);
          if (sanitizedData) {
            packet = new EncodedPacket(sanitizedData, packet.type, packet.timestamp, packet.duration);
          }
        }
      }
      this.decoder.decode(packet.toEncodedVideoChunk());
      this.decodeAlphaData(packet);
    }
    this.currentPacketIndex++;
  }
  decodeAlphaData(packet) {
    if (!packet.sideData.alpha) {
      this.pushNullAlphaFrame();
      return;
    }
    if (!this.merger) {
      this.merger = new ColorAlphaMerger;
    }
    if (!this.alphaDecoder) {
      const alphaHandler = (frame) => {
        this.frameHandlerSerializer.call(async () => {
          if (this.colorQueue.length > 0) {
            const colorFrame = this.colorQueue.shift();
            assert(colorFrame !== undefined);
            await this.mergeAlpha(colorFrame, frame);
          } else {
            this.alphaQueue.push(frame);
          }
          this.decodedAlphaChunkCount++;
          while (this.nullAlphaFrameQueue.length > 0 && this.nullAlphaFrameQueue[0] === this.decodedAlphaChunkCount) {
            this.nullAlphaFrameQueue.shift();
            if (this.colorQueue.length > 0) {
              const colorFrame = this.colorQueue.shift();
              assert(colorFrame !== undefined);
              await this.mergeAlpha(colorFrame, null);
            } else {
              this.alphaQueue.push(null);
            }
          }
          this.alphaDecoderQueueSize--;
        }).catch((error) => this.onError(error));
      };
      const stack = new Error("Decoding error").stack;
      this.alphaDecoder = new VideoDecoder({
        output: (frame) => {
          try {
            alphaHandler(frame);
          } catch (error) {
            this.onError(error);
          }
        },
        error: (error) => {
          error.stack = stack;
          this.onError(error);
        }
      });
      this.alphaDecoder.configure(this.decoderConfig);
    }
    const type = determineVideoPacketType(this.codec, this.decoderConfig, packet.sideData.alpha);
    if (!this.alphaHadKeyframe) {
      this.alphaHadKeyframe = type === "key";
    }
    if (this.alphaHadKeyframe) {
      if (this.codec === "hevc" && this.currentAlphaPacketIndex > 0 && !this.alphaRaslSkipped) {
        if (this.hasHevcRaslPicture(packet.sideData.alpha)) {
          this.pushNullAlphaFrame();
          return;
        }
        this.alphaRaslSkipped = true;
      }
      this.currentAlphaPacketIndex++;
      this.alphaDecoder.decode(packet.alphaToEncodedVideoChunk(type ?? packet.type));
      this.alphaDecoderQueueSize++;
    } else {
      this.pushNullAlphaFrame();
    }
  }
  pushNullAlphaFrame() {
    if (this.alphaDecoderQueueSize === 0) {
      this.alphaQueue.push(null);
    } else {
      this.nullAlphaFrameQueue.push(this.decodedAlphaChunkCount + this.alphaDecoderQueueSize);
    }
  }
  hasHevcRaslPicture(packetData) {
    for (const loc of iterateHevcNalUnits(packetData, this.decoderConfig)) {
      const type = extractNalUnitTypeForHevc(packetData[loc.offset]);
      if (type === HevcNalUnitType.RASL_N || type === HevcNalUnitType.RASL_R) {
        return true;
      }
    }
    return false;
  }
  sampleHandler(sample) {
    if (isWebKit()) {
      if (this.sampleQueue.length > 0 && sample.timestamp >= last(this.sampleQueue).timestamp) {
        for (const sample2 of this.sampleQueue) {
          this.finalizeAndEmitSample(sample2);
        }
        this.sampleQueue.length = 0;
      }
      insertSorted(this.sampleQueue, sample, (x) => x.timestamp);
    } else {
      const timestamp = this.inputTimestamps.shift();
      assert(timestamp !== undefined);
      sample.setTimestamp(timestamp);
      this.finalizeAndEmitSample(sample);
    }
  }
  finalizeAndEmitSample(sample) {
    sample.setTimestamp(Math.round(sample.timestamp * this.timeResolution) / this.timeResolution);
    sample.setDuration(Math.round(sample.duration * this.timeResolution) / this.timeResolution);
    sample.setRotation(this.rotation);
    this.onSample(sample);
  }
  async mergeAlpha(color, alpha) {
    if (!alpha) {
      const finalSample2 = new VideoSample(color);
      this.sampleHandler(finalSample2);
      return;
    }
    assert(this.merger);
    const finalFrame = await this.merger.update(color, alpha);
    const finalSample = new VideoSample(finalFrame);
    this.sampleHandler(finalSample);
  }
  async flush() {
    if (this.customDecoder) {
      await this.customDecoderCallSerializer.call(() => this.customDecoder.flush());
    } else {
      assert(this.decoder);
      await Promise.all([
        this.decoder.flush(),
        this.alphaDecoder?.flush()
      ]);
      await this.frameHandlerSerializer.currentPromise;
      this.colorQueue.forEach((x) => x.close());
      this.colorQueue.length = 0;
      this.alphaQueue.forEach((x) => x?.close());
      this.alphaQueue.length = 0;
      this.alphaHadKeyframe = false;
      this.decodedAlphaChunkCount = 0;
      this.alphaDecoderQueueSize = 0;
      this.nullAlphaFrameQueue.length = 0;
      this.currentAlphaPacketIndex = 0;
      this.alphaRaslSkipped = false;
    }
    if (isWebKit()) {
      for (const sample of this.sampleQueue) {
        this.finalizeAndEmitSample(sample);
      }
      this.sampleQueue.length = 0;
    }
    this.currentPacketIndex = 0;
    this.raslSkipped = false;
  }
  close() {
    if (this.customDecoder) {
      this.customDecoderCallSerializer.call(() => this.customDecoder.close());
    } else {
      assert(this.decoder);
      this.decoder.close();
      this.alphaDecoder?.close();
      this.colorQueue.forEach((x) => x.close());
      this.colorQueue.length = 0;
      this.alphaQueue.forEach((x) => x?.close());
      this.alphaQueue.length = 0;
      this.merger?.close();
    }
    for (const sample of this.sampleQueue) {
      sample.close();
    }
    this.sampleQueue.length = 0;
  }
}
var mergerGpuUnavailable = false;

class ColorAlphaMerger {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.vao = null;
    this.colorTexture = null;
    this.alphaTexture = null;
    this.worker = null;
    this.pendingRequests = new Map;
    this.nextRequestId = 0;
    const canMakeCanvas = typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined" && typeof document.createElement === "function";
    if (!ColorAlphaMerger.forceCpu && canMakeCanvas && !mergerGpuUnavailable) {
      try {
        if (typeof OffscreenCanvas !== "undefined") {
          this.canvas = new OffscreenCanvas(300, 150);
        } else {
          this.canvas = document.createElement("canvas");
        }
        const gl = this.canvas.getContext("webgl2", {
          premultipliedAlpha: false
        });
        if (!gl) {
          throw new Error("Couldn't acquire WebGL 2 context.");
        }
        this.gl = gl;
        this.program = this.createProgram();
        this.vao = this.createVAO();
        this.colorTexture = this.createTexture();
        this.alphaTexture = this.createTexture();
        this.gl.useProgram(this.program);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, "u_colorTexture"), 0);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, "u_alphaTexture"), 1);
      } catch (error) {
        this.gl = null;
        this.canvas = null;
        mergerGpuUnavailable = true;
        console.warn("Falling back to CPU for color/alpha merging.", error);
      }
    }
  }
  async update(color, alpha) {
    if (this.gl) {
      return this.updateGpu(color, alpha);
    } else {
      return this.updateCpu(color, alpha);
    }
  }
  createProgram() {
    assert(this.gl);
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, `#version 300 es
			in vec2 a_position;
			in vec2 a_texCoord;
			out vec2 v_texCoord;
			
			void main() {
				gl_Position = vec4(a_position, 0.0, 1.0);
				v_texCoord = a_texCoord;
			}
		`);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `#version 300 es
			precision highp float;
			
			uniform sampler2D u_colorTexture;
			uniform sampler2D u_alphaTexture;
			in vec2 v_texCoord;
			out vec4 fragColor;
			
			void main() {
				vec3 color = texture(u_colorTexture, v_texCoord).rgb;
				float alpha = texture(u_alphaTexture, v_texCoord).r;
				fragColor = vec4(color, alpha);
			}
		`);
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    return program;
  }
  createShader(type, source) {
    assert(this.gl);
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    return shader;
  }
  createVAO() {
    assert(this.gl);
    assert(this.program);
    const vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(vao);
    const vertices = new Float32Array([
      -1,
      -1,
      0,
      1,
      1,
      -1,
      1,
      1,
      -1,
      1,
      0,
      0,
      1,
      1,
      1,
      0
    ]);
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    const positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    const texCoordLocation = this.gl.getAttribLocation(this.program, "a_texCoord");
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 16, 8);
    return vao;
  }
  createTexture() {
    assert(this.gl);
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    return texture;
  }
  updateGpu(color, alpha) {
    assert(this.gl);
    assert(this.canvas);
    if (color.displayWidth !== this.canvas.width || color.displayHeight !== this.canvas.height) {
      this.canvas.width = color.displayWidth;
      this.canvas.height = color.displayHeight;
    }
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.colorTexture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, color);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.alphaTexture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, alpha);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    const finalFrame = new VideoFrame(this.canvas, {
      timestamp: color.timestamp,
      duration: color.duration ?? undefined
    });
    color.close();
    alpha.close();
    return finalFrame;
  }
  updateCpu(color, alpha) {
    if (!this.worker) {
      const blob = new Blob([`(${colorAlphaMergerWorkerCode.toString()})()`], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);
      URL.revokeObjectURL(url);
      this.worker.addEventListener("message", (event) => {
        const data = event.data;
        const pending2 = this.pendingRequests.get(data.id);
        if (!pending2) {
          return;
        }
        this.pendingRequests.delete(data.id);
        if ("error" in data) {
          pending2.reject(new Error(data.error));
        } else {
          pending2.resolve(data.frame);
        }
      });
      this.worker.addEventListener("error", (event) => {
        const error = new Error(event.message || "Color/alpha merge worker error.");
        for (const pending2 of this.pendingRequests.values()) {
          pending2.reject(error);
        }
        this.pendingRequests.clear();
      });
    }
    const id = this.nextRequestId++;
    const pending = promiseWithResolvers();
    this.pendingRequests.set(id, pending);
    this.worker.postMessage({ id, color, alpha }, { transfer: [color, alpha] });
    return pending.promise;
  }
  close() {
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    this.canvas = null;
    this.worker?.terminate();
    this.worker = null;
    const error = new Error("Color/alpha merger closed.");
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
ColorAlphaMerger.forceCpu = true;
var colorAlphaMergerWorkerCode = () => {
  let cpuAlphaBuffer = null;
  let cpuColorBuffer = null;
  let chain = Promise.resolve();
  self.addEventListener("message", (event) => {
    const { id, color, alpha } = event.data;
    chain = chain.then(async () => {
      try {
        const frame = await merge(color, alpha);
        self.postMessage({ id, frame }, { transfer: [frame] });
      } catch (error) {
        self.postMessage({ id, error: error.message });
      } finally {
        color.close();
        alpha.close();
      }
    });
  });
  const merge = async (color, alpha) => {
    const format = color.format;
    const alphaFormat = alpha.format;
    if (!format || !alphaFormat) {
      throw new Error("CPU color/alpha merging requires a known VideoFrame format.");
    }
    const colorIs10 = format.includes("P10");
    const colorIs12 = format.includes("P12");
    const alphaIs10 = alphaFormat.includes("P10");
    const alphaIs12 = alphaFormat.includes("P12");
    if (alphaIs10 !== colorIs10 || alphaIs12 !== colorIs12) {
      throw new Error(`CPU color/alpha merging requires the alpha frame to have the same bit depth as the color frame` + ` (color: '${format}', alpha: '${alphaFormat}').`);
    }
    const width = color.codedWidth;
    const height = color.codedHeight;
    if (format === "RGBX" || format === "RGBA" || format === "BGRX" || format === "BGRA") {
      return await mergeInterleavedRgba(color, alpha, width, height, format);
    } else if (format === "I420" || format === "I420P10" || format === "I420P12" || format === "I422" || format === "I422P10" || format === "I422P12" || format === "I444" || format === "I444P10" || format === "I444P12") {
      return await mergePlanarYuv(color, alpha, width, height, format);
    } else if (format === "NV12") {
      return await mergeNv12(color, alpha, width, height);
    }
    throw new Error(`CPU color/alpha merging does not support format '${format}'.`);
  };
  const mergeInterleavedRgba = async (color, alpha, width, height, format) => {
    const pixelCount = width * height;
    const output = new Uint8Array(pixelCount * 4);
    await color.copyTo(output);
    const alphaY = await readAlpha(alpha, width, height, 1);
    for (let i = 0, j = 3;i < pixelCount; i++, j += 4) {
      output[j] = alphaY[i];
    }
    const outputFormat = format === "RGBX" || format === "RGBA" ? "RGBA" : "BGRA";
    const init = {
      format: outputFormat,
      codedWidth: width,
      codedHeight: height,
      timestamp: color.timestamp,
      duration: color.duration ?? undefined,
      transfer: [output.buffer]
    };
    return new VideoFrame(output, init);
  };
  const mergePlanarYuv = async (color, alpha, width, height, format) => {
    const is10 = format.includes("P10");
    const is12 = format.includes("P12");
    const bytesPerSample = is10 || is12 ? 2 : 1;
    let chromaW;
    let chromaH;
    if (format.startsWith("I420")) {
      chromaW = Math.ceil(width / 2);
      chromaH = Math.ceil(height / 2);
    } else if (format.startsWith("I422")) {
      chromaW = Math.ceil(width / 2);
      chromaH = height;
    } else {
      chromaW = width;
      chromaH = height;
    }
    const ySamples = width * height;
    const uvSamples = chromaW * chromaH;
    const yBytes = ySamples * bytesPerSample;
    const uvBytes = uvSamples * bytesPerSample;
    const aBytes = ySamples * bytesPerSample;
    const outputBytes = yBytes + 2 * uvBytes + aBytes;
    const output = new Uint8Array(outputBytes);
    await color.copyTo(output);
    const alphaY = await readAlpha(alpha, width, height, bytesPerSample);
    const aOffset = yBytes + 2 * uvBytes;
    output.set(alphaY, aOffset);
    const outputFormat = format.slice(0, 4) + "A" + format.slice(4);
    const init = {
      format: outputFormat,
      codedWidth: width,
      codedHeight: height,
      timestamp: color.timestamp,
      duration: color.duration ?? undefined,
      transfer: [output.buffer]
    };
    return new VideoFrame(output, init);
  };
  const mergeNv12 = async (color, alpha, width, height) => {
    const ySize = width * height;
    const chromaW = Math.ceil(width / 2);
    const chromaH = Math.ceil(height / 2);
    const uvSize = chromaW * chromaH;
    const sourceSize = color.allocationSize();
    if (!cpuColorBuffer || cpuColorBuffer.byteLength !== sourceSize) {
      cpuColorBuffer = new Uint8Array(sourceSize);
    }
    await color.copyTo(cpuColorBuffer);
    const output = new Uint8Array(ySize + 2 * uvSize + ySize);
    output.set(cpuColorBuffer.subarray(0, ySize), 0);
    const uOffset = ySize;
    const vOffset = ySize + uvSize;
    const uvStart = ySize;
    for (let i = 0;i < uvSize; i++) {
      output[uOffset + i] = cpuColorBuffer[uvStart + i * 2];
      output[vOffset + i] = cpuColorBuffer[uvStart + i * 2 + 1];
    }
    const alphaY = await readAlpha(alpha, width, height, 1);
    output.set(alphaY, ySize + 2 * uvSize);
    const init = {
      format: "I420A",
      codedWidth: width,
      codedHeight: height,
      timestamp: color.timestamp,
      duration: color.duration ?? undefined,
      transfer: [output.buffer]
    };
    return new VideoFrame(output, init);
  };
  const readAlpha = async (alpha, width, height, bytesPerSample) => {
    const size = alpha.allocationSize();
    if (!cpuAlphaBuffer || cpuAlphaBuffer.byteLength !== size) {
      cpuAlphaBuffer = new Uint8Array(size);
    }
    await alpha.copyTo(cpuAlphaBuffer);
    const format = alpha.format;
    if (format === "RGBA" || format === "BGRA" || format === "RGBX" || format === "BGRX") {
      const rOffset = format === "RGBA" || format === "RGBX" ? 0 : 2;
      const pixelCount = width * height;
      for (let i = 0;i < pixelCount; i++) {
        cpuAlphaBuffer[i] = cpuAlphaBuffer[i * 4 + rOffset];
      }
      return cpuAlphaBuffer.subarray(0, pixelCount);
    } else {
      return cpuAlphaBuffer.subarray(0, width * height * bytesPerSample);
    }
  };
};

class VideoSampleSink extends BaseMediaSampleSink {
  constructor(videoTrack) {
    if (!(videoTrack instanceof InputVideoTrack)) {
      throw new TypeError("videoTrack must be an InputVideoTrack.");
    }
    super();
    this._track = videoTrack;
  }
  async _createDecoder(onSample, onError) {
    if (!await this._track.canDecode()) {
      throw new Error("This video track cannot be decoded by this browser. Make sure to check decodability before using" + " a track.");
    }
    const codec = await this._track.getCodec();
    const rotation = await this._track.getRotation();
    const decoderConfig = await this._track.getDecoderConfig();
    const timeResolution = await this._track.getTimeResolution();
    assert(codec && decoderConfig);
    return new VideoDecoderWrapper(onSample, onError, codec, decoderConfig, rotation, timeResolution);
  }
  _createPacketSink() {
    return new EncodedPacketSink(this._track);
  }
  async getSample(timestamp, options = {}) {
    validateTimestamp(timestamp);
    for await (const sample of this.mediaSamplesAtTimestamps([timestamp], options)) {
      return sample;
    }
    throw new Error("Internal error: Iterator returned nothing.");
  }
  samples(startTimestamp, endTimestamp, options = {}) {
    return this.mediaSamplesInRange(startTimestamp, endTimestamp, options);
  }
  samplesAtTimestamps(timestamps, options = {}) {
    return this.mediaSamplesAtTimestamps(timestamps, options);
  }
}

class CanvasSink {
  constructor(videoTrack, options = {}) {
    this._rotation = 0;
    this._initPromise = null;
    this._nextCanvasIndex = 0;
    if (!(videoTrack instanceof InputVideoTrack)) {
      throw new TypeError("videoTrack must be an InputVideoTrack.");
    }
    if (options && typeof options !== "object") {
      throw new TypeError("options must be an object.");
    }
    if (options.alpha !== undefined && typeof options.alpha !== "boolean") {
      throw new TypeError("options.alpha, when provided, must be a boolean.");
    }
    if (options.width !== undefined && (!Number.isInteger(options.width) || options.width <= 0)) {
      throw new TypeError("options.width, when defined, must be a positive integer.");
    }
    if (options.height !== undefined && (!Number.isInteger(options.height) || options.height <= 0)) {
      throw new TypeError("options.height, when defined, must be a positive integer.");
    }
    if (options.fit !== undefined && !["fill", "contain", "cover"].includes(options.fit)) {
      throw new TypeError('options.fit, when provided, must be one of "fill", "contain", or "cover".');
    }
    if (options.width !== undefined && options.height !== undefined && options.fit === undefined) {
      throw new TypeError("When both options.width and options.height are provided, options.fit must also be provided.");
    }
    if (options.rotation !== undefined && ![0, 90, 180, 270].includes(options.rotation)) {
      throw new TypeError("options.rotation, when provided, must be 0, 90, 180 or 270.");
    }
    if (options.crop !== undefined) {
      validateCropRectangle(options.crop, "options.");
    }
    if (options.poolSize !== undefined && (typeof options.poolSize !== "number" || !Number.isInteger(options.poolSize) || options.poolSize < 0)) {
      throw new TypeError("poolSize must be a non-negative integer.");
    }
    this._videoTrack = videoTrack;
    this._alpha = options.alpha ?? false;
    this._options = options;
    this._fit = options.fit ?? "fill";
    this._videoSampleSink = new VideoSampleSink(videoTrack);
    this._canvasPool = Array.from({ length: options.poolSize ?? 0 }, () => null);
  }
  _ensureInit() {
    return this._initPromise ??= (async () => {
      const options = this._options;
      const videoTrack = this._videoTrack;
      const rotation = options.rotation ?? await videoTrack.getRotation();
      const squarePixelWidth = await videoTrack.getSquarePixelWidth();
      const squarePixelHeight = await videoTrack.getSquarePixelHeight();
      const [rotatedWidth, rotatedHeight] = rotation % 180 === 0 ? [squarePixelWidth, squarePixelHeight] : [squarePixelHeight, squarePixelWidth];
      let crop = options.crop;
      if (crop) {
        crop = clampCropRectangle(crop, rotatedWidth, rotatedHeight);
      }
      let [width, height] = crop ? [crop.width, crop.height] : [rotatedWidth, rotatedHeight];
      const originalAspectRatio = width / height;
      if (options.width !== undefined && options.height === undefined) {
        width = options.width;
        height = Math.round(width / originalAspectRatio);
      } else if (options.width === undefined && options.height !== undefined) {
        height = options.height;
        width = Math.round(height * originalAspectRatio);
      } else if (options.width !== undefined && options.height !== undefined) {
        width = options.width;
        height = options.height;
      }
      this._width = width;
      this._height = height;
      this._rotation = rotation;
      this._crop = crop;
    })();
  }
  _videoSampleToWrappedCanvas(sample) {
    const width = this._width;
    const height = this._height;
    let canvas = this._canvasPool[this._nextCanvasIndex];
    let canvasIsNew = false;
    if (!canvas) {
      if (typeof document !== "undefined") {
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
      } else {
        canvas = new OffscreenCanvas(width, height);
      }
      if (this._canvasPool.length > 0) {
        this._canvasPool[this._nextCanvasIndex] = canvas;
      }
      canvasIsNew = true;
    }
    if (this._canvasPool.length > 0) {
      this._nextCanvasIndex = (this._nextCanvasIndex + 1) % this._canvasPool.length;
    }
    const context = canvas.getContext("2d", {
      alpha: this._alpha || isFirefox()
    });
    assert(context);
    context.resetTransform();
    if (!canvasIsNew) {
      if (!this._alpha && isFirefox()) {
        context.fillStyle = "black";
        context.fillRect(0, 0, width, height);
      } else {
        context.clearRect(0, 0, width, height);
      }
    }
    sample.drawWithFit(context, {
      fit: this._fit,
      rotation: this._rotation,
      crop: this._crop
    });
    const result = {
      canvas,
      timestamp: sample.timestamp,
      duration: sample.duration
    };
    sample.close();
    return result;
  }
  async getCanvas(timestamp, options) {
    validateTimestamp(timestamp);
    await this._ensureInit();
    const sample = await this._videoSampleSink.getSample(timestamp, options);
    return sample && this._videoSampleToWrappedCanvas(sample);
  }
  async* canvases(startTimestamp, endTimestamp, options) {
    await this._ensureInit();
    yield* mapAsyncGenerator(this._videoSampleSink.samples(startTimestamp, endTimestamp, options), (sample) => this._videoSampleToWrappedCanvas(sample));
  }
  async* canvasesAtTimestamps(timestamps, options) {
    await this._ensureInit();
    yield* mapAsyncGenerator(this._videoSampleSink.samplesAtTimestamps(timestamps, options), (sample) => sample && this._videoSampleToWrappedCanvas(sample));
  }
}

class AudioDecoderWrapper extends DecoderWrapper {
  constructor(onSample, onError, codec, decoderConfig) {
    super(onSample, onError);
    this.decoder = null;
    this.customDecoder = null;
    this.customDecoderCallSerializer = new CallSerializer;
    this.customDecoderQueueSize = 0;
    this.currentTimestamp = null;
    this.expectedFirstTimestamp = null;
    this.timestampOffset = 0;
    const sampleHandler = (sample) => {
      let sampleTimestamp = sample.timestamp;
      if (this.expectedFirstTimestamp && this.currentTimestamp === null) {
        this.timestampOffset = this.expectedFirstTimestamp - sampleTimestamp;
      }
      sampleTimestamp += this.timestampOffset;
      if (this.currentTimestamp === null || Math.abs(sampleTimestamp - this.currentTimestamp) >= sample.duration) {
        this.currentTimestamp = sampleTimestamp;
      }
      const preciseTimestamp = this.currentTimestamp;
      this.currentTimestamp += sample.duration;
      if (sample.numberOfFrames === 0) {
        sample.close();
        return;
      }
      const sampleRate = decoderConfig.sampleRate;
      sample.setTimestamp(Math.round(preciseTimestamp * sampleRate) / sampleRate);
      onSample(sample);
    };
    const MatchingCustomDecoder = customAudioDecoders.find((x) => x.supports(codec, decoderConfig));
    if (MatchingCustomDecoder) {
      this.customDecoder = new MatchingCustomDecoder;
      this.customDecoder.codec = codec;
      this.customDecoder.config = decoderConfig;
      this.customDecoder.onSample = (sample) => {
        if (!(sample instanceof AudioSample)) {
          throw new TypeError("The argument passed to onSample must be an AudioSample.");
        }
        sampleHandler(sample);
      };
      this.customDecoderCallSerializer.call(() => this.customDecoder.init());
    } else {
      const stack = new Error("Decoding error").stack;
      this.decoder = new AudioDecoder({
        output: (data) => {
          try {
            sampleHandler(new AudioSample(data));
          } catch (error) {
            this.onError(error);
          }
        },
        error: (error) => {
          error.stack = stack;
          this.onError(error);
        }
      });
      this.decoder.configure(decoderConfig);
    }
  }
  getDecodeQueueSize() {
    if (this.customDecoder) {
      return this.customDecoderQueueSize;
    } else {
      assert(this.decoder);
      return this.decoder.decodeQueueSize;
    }
  }
  decode(packet) {
    if (this.customDecoder) {
      this.customDecoderQueueSize++;
      this.customDecoderCallSerializer.call(() => this.customDecoder.decode(packet)).then(() => this.customDecoderQueueSize--);
    } else {
      assert(this.decoder);
      this.expectedFirstTimestamp ??= packet.timestamp;
      this.decoder.decode(packet.toEncodedAudioChunk());
    }
  }
  async flush() {
    if (this.customDecoder) {
      await this.customDecoderCallSerializer.call(() => this.customDecoder.flush());
    } else {
      assert(this.decoder);
      await this.decoder.flush();
    }
    this.currentTimestamp = null;
    this.expectedFirstTimestamp = null;
    this.timestampOffset = 0;
  }
  close() {
    if (this.customDecoder) {
      this.customDecoderCallSerializer.call(() => this.customDecoder.close());
    } else {
      assert(this.decoder);
      this.decoder.close();
    }
  }
}

class PcmAudioDecoderWrapper extends DecoderWrapper {
  constructor(onSample, onError, decoderConfig) {
    super(onSample, onError);
    this.decoderConfig = decoderConfig;
    this.currentTimestamp = null;
    assert(PCM_AUDIO_CODECS.includes(decoderConfig.codec));
    this.codec = decoderConfig.codec;
    const { dataType, sampleSize, littleEndian } = parsePcmCodec(this.codec);
    this.inputSampleSize = sampleSize;
    switch (sampleSize) {
      case 1:
        {
          if (dataType === "unsigned") {
            this.readInputValue = (view, byteOffset) => view.getUint8(byteOffset) - 2 ** 7;
          } else if (dataType === "signed") {
            this.readInputValue = (view, byteOffset) => view.getInt8(byteOffset);
          } else if (dataType === "ulaw") {
            this.readInputValue = (view, byteOffset) => fromUlaw(view.getUint8(byteOffset));
          } else if (dataType === "alaw") {
            this.readInputValue = (view, byteOffset) => fromAlaw(view.getUint8(byteOffset));
          } else {
            assert(false);
          }
        }
        ;
        break;
      case 2:
        {
          if (dataType === "unsigned") {
            this.readInputValue = (view, byteOffset) => view.getUint16(byteOffset, littleEndian) - 2 ** 15;
          } else if (dataType === "signed") {
            this.readInputValue = (view, byteOffset) => view.getInt16(byteOffset, littleEndian);
          } else {
            assert(false);
          }
        }
        ;
        break;
      case 3:
        {
          if (dataType === "unsigned") {
            this.readInputValue = (view, byteOffset) => getUint24(view, byteOffset, littleEndian) - 2 ** 23;
          } else if (dataType === "signed") {
            this.readInputValue = (view, byteOffset) => getInt24(view, byteOffset, littleEndian);
          } else {
            assert(false);
          }
        }
        ;
        break;
      case 4:
        {
          if (dataType === "unsigned") {
            this.readInputValue = (view, byteOffset) => view.getUint32(byteOffset, littleEndian) - 2 ** 31;
          } else if (dataType === "signed") {
            this.readInputValue = (view, byteOffset) => view.getInt32(byteOffset, littleEndian);
          } else if (dataType === "float") {
            this.readInputValue = (view, byteOffset) => view.getFloat32(byteOffset, littleEndian);
          } else {
            assert(false);
          }
        }
        ;
        break;
      case 8:
        {
          if (dataType === "float") {
            this.readInputValue = (view, byteOffset) => view.getFloat64(byteOffset, littleEndian);
          } else {
            assert(false);
          }
        }
        ;
        break;
      default:
        {
          assertNever(sampleSize);
          assert(false);
        }
        ;
    }
    switch (sampleSize) {
      case 1:
        {
          if (dataType === "ulaw" || dataType === "alaw") {
            this.outputSampleSize = 2;
            this.outputFormat = "s16";
            this.writeOutputValue = (view, byteOffset, value) => view.setInt16(byteOffset, value, true);
          } else {
            this.outputSampleSize = 1;
            this.outputFormat = "u8";
            this.writeOutputValue = (view, byteOffset, value) => view.setUint8(byteOffset, value + 2 ** 7);
          }
        }
        ;
        break;
      case 2:
        {
          this.outputSampleSize = 2;
          this.outputFormat = "s16";
          this.writeOutputValue = (view, byteOffset, value) => view.setInt16(byteOffset, value, true);
        }
        ;
        break;
      case 3:
        {
          this.outputSampleSize = 4;
          this.outputFormat = "s32";
          this.writeOutputValue = (view, byteOffset, value) => view.setInt32(byteOffset, value << 8, true);
        }
        ;
        break;
      case 4:
        {
          this.outputSampleSize = 4;
          if (dataType === "float") {
            this.outputFormat = "f32";
            this.writeOutputValue = (view, byteOffset, value) => view.setFloat32(byteOffset, value, true);
          } else {
            this.outputFormat = "s32";
            this.writeOutputValue = (view, byteOffset, value) => view.setInt32(byteOffset, value, true);
          }
        }
        ;
        break;
      case 8:
        {
          this.outputSampleSize = 4;
          this.outputFormat = "f32";
          this.writeOutputValue = (view, byteOffset, value) => view.setFloat32(byteOffset, value, true);
        }
        ;
        break;
      default:
        {
          assertNever(sampleSize);
          assert(false);
        }
        ;
    }
  }
  getDecodeQueueSize() {
    return 0;
  }
  decode(packet) {
    const inputView = toDataView(packet.data);
    const numberOfFrames = packet.byteLength / this.decoderConfig.numberOfChannels / this.inputSampleSize;
    const outputBufferSize = numberOfFrames * this.decoderConfig.numberOfChannels * this.outputSampleSize;
    const outputBuffer = new ArrayBuffer(outputBufferSize);
    const outputView = new DataView(outputBuffer);
    for (let i = 0;i < numberOfFrames * this.decoderConfig.numberOfChannels; i++) {
      const inputIndex = i * this.inputSampleSize;
      const outputIndex = i * this.outputSampleSize;
      const value = this.readInputValue(inputView, inputIndex);
      this.writeOutputValue(outputView, outputIndex, value);
    }
    const preciseDuration = numberOfFrames / this.decoderConfig.sampleRate;
    if (this.currentTimestamp === null || Math.abs(packet.timestamp - this.currentTimestamp) >= preciseDuration) {
      this.currentTimestamp = packet.timestamp;
    }
    const preciseTimestamp = this.currentTimestamp;
    this.currentTimestamp += preciseDuration;
    const audioSample = new AudioSample({
      format: this.outputFormat,
      data: outputBuffer,
      numberOfChannels: this.decoderConfig.numberOfChannels,
      sampleRate: this.decoderConfig.sampleRate,
      numberOfFrames,
      timestamp: preciseTimestamp
    });
    this.onSample(audioSample);
  }
  async flush() {}
  close() {}
}

class AudioSampleSink extends BaseMediaSampleSink {
  constructor(audioTrack) {
    if (!(audioTrack instanceof InputAudioTrack)) {
      throw new TypeError("audioTrack must be an InputAudioTrack.");
    }
    super();
    this._track = audioTrack;
  }
  async _createDecoder(onSample, onError) {
    if (!await this._track.canDecode()) {
      throw new Error("This audio track cannot be decoded by this browser. Make sure to check decodability before using" + " a track.");
    }
    const codec = await this._track.getCodec();
    const decoderConfig = await this._track.getDecoderConfig();
    assert(codec && decoderConfig);
    if (PCM_AUDIO_CODECS.includes(decoderConfig.codec)) {
      return new PcmAudioDecoderWrapper(onSample, onError, decoderConfig);
    } else {
      return new AudioDecoderWrapper(onSample, onError, codec, decoderConfig);
    }
  }
  _createPacketSink() {
    return new EncodedPacketSink(this._track);
  }
  async getSample(timestamp, options = {}) {
    validateTimestamp(timestamp);
    for await (const sample of this.mediaSamplesAtTimestamps([timestamp], options)) {
      return sample;
    }
    throw new Error("Internal error: Iterator returned nothing.");
  }
  samples(startTimestamp, endTimestamp, options = {}) {
    return this.mediaSamplesInRange(startTimestamp, endTimestamp, options);
  }
  samplesAtTimestamps(timestamps, options = {}) {
    return this.mediaSamplesAtTimestamps(timestamps, options);
  }
}

class AudioBufferSink {
  constructor(audioTrack) {
    if (!(audioTrack instanceof InputAudioTrack)) {
      throw new TypeError("audioTrack must be an InputAudioTrack.");
    }
    this._audioSampleSink = new AudioSampleSink(audioTrack);
  }
  _audioSampleToWrappedArrayBuffer(sample) {
    const result = {
      buffer: sample.toAudioBuffer(),
      timestamp: sample.timestamp,
      duration: sample.duration
    };
    sample.close();
    return result;
  }
  async getBuffer(timestamp, options) {
    validateTimestamp(timestamp);
    const data = await this._audioSampleSink.getSample(timestamp, options);
    return data && this._audioSampleToWrappedArrayBuffer(data);
  }
  buffers(startTimestamp, endTimestamp, options) {
    return mapAsyncGenerator(this._audioSampleSink.samples(startTimestamp, endTimestamp, options), (data) => this._audioSampleToWrappedArrayBuffer(data));
  }
  buffersAtTimestamps(timestamps, options) {
    return mapAsyncGenerator(this._audioSampleSink.samplesAtTimestamps(timestamps, options), (data) => data && this._audioSampleToWrappedArrayBuffer(data));
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/input-track.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class InputTrack {
  constructor(input, backing) {
    this.input = input;
    this._backing = backing;
  }
  isVideoTrack() {
    return this instanceof InputVideoTrack;
  }
  isAudioTrack() {
    return this instanceof InputAudioTrack;
  }
  get id() {
    return this._backing.getId();
  }
  get number() {
    return this._backing.getNumber();
  }
  async getInternalCodecId() {
    return this._backing.getInternalCodecId();
  }
  get internalCodecId() {
    return requireSync(this._backing.getInternalCodecId(), "internalCodecId", "getInternalCodecId");
  }
  async getLanguageCode() {
    return this._backing.getLanguageCode();
  }
  get languageCode() {
    return requireSync(this._backing.getLanguageCode(), "languageCode", "getLanguageCode");
  }
  async getName() {
    return this._backing.getName();
  }
  get name() {
    return requireSync(this._backing.getName(), "name", "getName");
  }
  async getTimeResolution() {
    return this._backing.getTimeResolution();
  }
  get timeResolution() {
    return requireSync(this._backing.getTimeResolution(), "timeResolution", "getTimeResolution");
  }
  async isRelativeToUnixEpoch() {
    return this._backing.isRelativeToUnixEpoch();
  }
  async getDisposition() {
    return this._backing.getDisposition();
  }
  get disposition() {
    return requireSync(this._backing.getDisposition(), "disposition", "getDisposition");
  }
  async getBitrate() {
    return this._backing.getBitrate();
  }
  async getAverageBitrate() {
    return this._backing.getAverageBitrate();
  }
  async getFirstTimestamp() {
    const firstPacket = await this._backing.getFirstPacket({ metadataOnly: true });
    return firstPacket?.timestamp ?? 0;
  }
  async computeDuration(options) {
    const lastPacket = await this._backing.getPacket(Infinity, { metadataOnly: true, ...options });
    const result = (lastPacket?.timestamp ?? 0) + (lastPacket?.duration ?? 0);
    return roundToDivisor(result, await this.getTimeResolution());
  }
  async getDurationFromMetadata(options = {}) {
    return this._backing.getDurationFromMetadata(options);
  }
  async computePacketStats(targetPacketCount = Infinity, options) {
    const sink = new EncodedPacketSink(this);
    let startTimestamp = Infinity;
    let endTimestamp = -Infinity;
    let packetCount = 0;
    let totalPacketBytes = 0;
    for await (const packet of sink.packets(undefined, undefined, { metadataOnly: true, ...options })) {
      if (packetCount >= targetPacketCount && packet.timestamp >= endTimestamp) {
        break;
      }
      startTimestamp = Math.min(startTimestamp, packet.timestamp);
      endTimestamp = Math.max(endTimestamp, packet.timestamp + packet.duration);
      packetCount++;
      totalPacketBytes += packet.byteLength;
    }
    return {
      packetCount,
      averagePacketRate: packetCount ? Number((packetCount / (endTimestamp - startTimestamp)).toPrecision(16)) : 0,
      averageBitrate: packetCount ? Number((8 * totalPacketBytes / (endTimestamp - startTimestamp)).toPrecision(16)) : 0
    };
  }
  async isLive() {
    return await this._backing.getLiveRefreshInterval() !== null;
  }
  async getLiveRefreshInterval() {
    return this._backing.getLiveRefreshInterval();
  }
  canBePairedWith(other) {
    if (!(other instanceof InputTrack)) {
      throw new TypeError("other must be an InputTrack.");
    }
    if (this.input !== other.input || this === other) {
      return false;
    }
    return (this._backing.getPairingMask() & other._backing.getPairingMask()) !== 0n;
  }
  async getPairableTracks(query) {
    return this.input.getTracks(mergeInputTrackQueries({
      filter: (t) => t.canBePairedWith(this)
    }, query));
  }
  async getPairableVideoTracks(query) {
    return this.input.getVideoTracks(mergeInputTrackQueries({
      filter: (t) => t.canBePairedWith(this)
    }, query));
  }
  async getPairableAudioTracks(query) {
    return this.input.getAudioTracks(mergeInputTrackQueries({
      filter: (t) => t.canBePairedWith(this)
    }, query));
  }
  async getPrimaryPairableVideoTrack(query) {
    return this.input.getPrimaryVideoTrack(mergeInputTrackQueries({
      filter: (t) => t.canBePairedWith(this)
    }, query));
  }
  async getPrimaryPairableAudioTrack(query) {
    return this.input.getPrimaryAudioTrack(mergeInputTrackQueries({
      filter: (t) => t.canBePairedWith(this)
    }, query));
  }
  async hasPairableTrack(predicate) {
    predicate &&= toValidatedPredicate(predicate);
    const tracks = await this.input.getTracks();
    for (const track of tracks) {
      if (!this.canBePairedWith(track)) {
        continue;
      }
      if (!predicate || await predicate(track)) {
        return true;
      }
    }
    return false;
  }
  hasPairableVideoTrack(predicate) {
    predicate &&= toValidatedPredicate(predicate);
    return this.hasPairableTrack(async (x) => x.isVideoTrack() && (!predicate || await predicate(x)));
  }
  hasPairableAudioTrack(predicate) {
    predicate &&= toValidatedPredicate(predicate);
    return this.hasPairableTrack(async (x) => x.isAudioTrack() && (!predicate || await predicate(x)));
  }
}
var requireSync = (value, getterName, asyncName) => {
  if (value instanceof Promise) {
    throw new Error(`'${getterName}' is deprecated and not available synchronously for this track. Use the preferred` + ` '${asyncName}()' instead.`);
  }
  return value;
};
var toValidatedPredicate = (predicate) => {
  if (predicate !== undefined && typeof predicate !== "function") {
    throw new TypeError("predicate, when provided, must be a function.");
  }
  return predicate ? (track) => {
    const handle = (result2) => {
      if (typeof result2 !== "boolean") {
        throw new TypeError("predicate must return or resolve to a boolean value.");
      }
      return result2;
    };
    const result = predicate(track);
    if (result instanceof Promise) {
      return result.then(handle);
    }
    return handle(result);
  } : undefined;
};

class InputVideoTrack extends InputTrack {
  constructor(input, backing) {
    super(input, backing);
    this._pixelAspectRatioCache = null;
    this._backing = backing;
  }
  get type() {
    return "video";
  }
  async getCodec() {
    return this._backing.getCodec();
  }
  get codec() {
    return requireSync(this._backing.getCodec(), "codec", "getCodec");
  }
  async hasOnlyKeyPackets() {
    return await this._backing.getHasOnlyKeyPackets?.() ?? false;
  }
  async getCodedWidth() {
    return this._backing.getCodedWidth();
  }
  get codedWidth() {
    return requireSync(this._backing.getCodedWidth(), "codedWidth", "getCodedWidth");
  }
  async getCodedHeight() {
    return this._backing.getCodedHeight();
  }
  get codedHeight() {
    return requireSync(this._backing.getCodedHeight(), "codedHeight", "getCodedHeight");
  }
  async getRotation() {
    return this._backing.getRotation();
  }
  get rotation() {
    return requireSync(this._backing.getRotation(), "rotation", "getRotation");
  }
  async getSquarePixelWidth() {
    return this._backing.getSquarePixelWidth();
  }
  get squarePixelWidth() {
    return requireSync(this._backing.getSquarePixelWidth(), "squarePixelWidth", "getSquarePixelWidth");
  }
  async getSquarePixelHeight() {
    return this._backing.getSquarePixelHeight();
  }
  get squarePixelHeight() {
    return requireSync(this._backing.getSquarePixelHeight(), "squarePixelHeight", "getSquarePixelHeight");
  }
  async getPixelAspectRatio() {
    return this._pixelAspectRatioCache ??= simplifyRational({
      num: await this.getSquarePixelWidth() * await this.getCodedHeight(),
      den: await this.getSquarePixelHeight() * await this.getCodedWidth()
    });
  }
  get pixelAspectRatio() {
    return this._pixelAspectRatioCache ??= simplifyRational({
      num: requireSync(this._backing.getSquarePixelWidth(), "pixelAspectRatio", "getPixelAspectRatio") * requireSync(this._backing.getCodedHeight(), "pixelAspectRatio", "getPixelAspectRatio"),
      den: requireSync(this._backing.getSquarePixelHeight(), "pixelAspectRatio", "getPixelAspectRatio") * requireSync(this._backing.getCodedWidth(), "pixelAspectRatio", "getPixelAspectRatio")
    });
  }
  async getDisplayWidth() {
    const metadata = await this._backing.getMetadataDisplayWidth?.();
    if (metadata != null) {
      return metadata;
    }
    const rotation = await this.getRotation();
    return rotation % 180 === 0 ? this.getSquarePixelWidth() : this.getSquarePixelHeight();
  }
  get displayWidth() {
    const metadataRaw = this._backing.getMetadataDisplayWidth?.();
    if (metadataRaw !== undefined) {
      const metadata = requireSync(metadataRaw, "displayWidth", "getDisplayWidth");
      if (metadata !== null) {
        return metadata;
      }
    }
    const rotation = requireSync(this._backing.getRotation(), "displayWidth", "getDisplayWidth");
    const value = rotation % 180 === 0 ? this._backing.getSquarePixelWidth() : this._backing.getSquarePixelHeight();
    return requireSync(value, "displayWidth", "getDisplayWidth");
  }
  async getDisplayHeight() {
    const metadata = await this._backing.getMetadataDisplayHeight?.();
    if (metadata != null) {
      return metadata;
    }
    const rotation = await this.getRotation();
    return rotation % 180 === 0 ? this.getSquarePixelHeight() : this.getSquarePixelWidth();
  }
  get displayHeight() {
    const metadataRaw = this._backing.getMetadataDisplayHeight?.();
    if (metadataRaw !== undefined) {
      const metadata = requireSync(metadataRaw, "displayHeight", "getDisplayHeight");
      if (metadata !== null) {
        return metadata;
      }
    }
    const rotation = requireSync(this._backing.getRotation(), "displayHeight", "getDisplayHeight");
    const value = rotation % 180 === 0 ? this._backing.getSquarePixelHeight() : this._backing.getSquarePixelWidth();
    return requireSync(value, "displayHeight", "getDisplayHeight");
  }
  async getColorSpace() {
    return this._backing.getColorSpace();
  }
  async hasHighDynamicRange() {
    const colorSpace = await this._backing.getColorSpace();
    return colorSpace.primaries === "bt2020" || colorSpace.primaries === "smpte432" || colorSpace.transfer === "pq" || colorSpace.transfer === "hlg" || colorSpace.matrix === "bt2020-ncl";
  }
  async canBeTransparent() {
    return this._backing.canBeTransparent();
  }
  async getDecoderConfig() {
    return this._backing.getDecoderConfig();
  }
  async getCodecParameterString() {
    const fromMetadata = await this._backing.getMetadataCodecParameterString?.();
    if (fromMetadata != null) {
      return fromMetadata;
    }
    const decoderConfig = await this._backing.getDecoderConfig();
    return decoderConfig?.codec ?? null;
  }
  async canDecode() {
    try {
      const decoderConfig = await this._backing.getDecoderConfig();
      if (!decoderConfig) {
        return false;
      }
      const codec = await this._backing.getCodec();
      assert(codec !== null);
      if (customVideoDecoders.some((x) => x.supports(codec, decoderConfig))) {
        return true;
      }
      if (typeof VideoDecoder === "undefined") {
        return false;
      }
      const support = await VideoDecoder.isConfigSupported(decoderConfig);
      return support.supported === true;
    } catch (error) {
      console.error("Error during decodability check:", error);
      return false;
    }
  }
  async determinePacketType(packet) {
    if (!(packet instanceof EncodedPacket)) {
      throw new TypeError("packet must be an EncodedPacket.");
    }
    if (packet.isMetadataOnly) {
      throw new TypeError("packet must not be metadata-only to determine its type.");
    }
    const codec = await this.getCodec();
    if (codec === null) {
      return null;
    }
    const decoderConfig = await this.getDecoderConfig();
    assert(decoderConfig);
    return determineVideoPacketType(codec, decoderConfig, packet.data);
  }
}

class InputAudioTrack extends InputTrack {
  constructor(input, backing) {
    super(input, backing);
    this._backing = backing;
  }
  get type() {
    return "audio";
  }
  async getCodec() {
    return this._backing.getCodec();
  }
  get codec() {
    return requireSync(this._backing.getCodec(), "codec", "getCodec");
  }
  async hasOnlyKeyPackets() {
    return await this._backing.getHasOnlyKeyPackets?.() ?? true;
  }
  async getNumberOfChannels() {
    return this._backing.getNumberOfChannels();
  }
  get numberOfChannels() {
    return requireSync(this._backing.getNumberOfChannels(), "numberOfChannels", "getNumberOfChannels");
  }
  async getSampleRate() {
    return this._backing.getSampleRate();
  }
  get sampleRate() {
    return requireSync(this._backing.getSampleRate(), "sampleRate", "getSampleRate");
  }
  async getDecoderConfig() {
    return this._backing.getDecoderConfig();
  }
  async getCodecParameterString() {
    const fromMetadata = await this._backing.getMetadataCodecParameterString?.();
    if (fromMetadata != null) {
      return fromMetadata;
    }
    const decoderConfig = await this._backing.getDecoderConfig();
    return decoderConfig?.codec ?? null;
  }
  async canDecode() {
    try {
      const decoderConfig = await this._backing.getDecoderConfig();
      if (!decoderConfig) {
        return false;
      }
      const codec = await this._backing.getCodec();
      assert(codec !== null);
      if (customAudioDecoders.some((x) => x.supports(codec, decoderConfig))) {
        return true;
      }
      if (decoderConfig.codec.startsWith("pcm-")) {
        return true;
      } else {
        if (typeof AudioDecoder === "undefined") {
          return false;
        }
        const support = await AudioDecoder.isConfigSupported(decoderConfig);
        return support.supported === true;
      }
    } catch (error) {
      console.error("Error during decodability check:", error);
      return false;
    }
  }
  async determinePacketType(packet) {
    if (!(packet instanceof EncodedPacket)) {
      throw new TypeError("packet must be an EncodedPacket.");
    }
    if (await this.getCodec() === null) {
      return null;
    }
    return "key";
  }
}
var desc = (value) => {
  return -(value ?? -Infinity);
};
var prefer = (value) => {
  return -value;
};
var toValidatedInputTrackQuery = (query) => {
  if (typeof query !== "object" || !query) {
    throw new TypeError("query must be an object.");
  }
  if (query.filter !== undefined && typeof query.filter !== "function") {
    throw new TypeError("query.filter, when provided, must be a function.");
  }
  if (query.sortBy !== undefined && typeof query.sortBy !== "function") {
    throw new TypeError("query.sortBy, when provided, must be a function.");
  }
  return {
    filter: query.filter ? (track) => {
      const handle = (bool) => {
        if (typeof bool !== "boolean") {
          throw new TypeError("query.filter must return or resolve to a boolean.");
        }
        return bool;
      };
      const result = query.filter(track);
      if (result instanceof Promise) {
        return result.then(handle);
      } else {
        return handle(result);
      }
    } : undefined,
    sortBy: query.sortBy ? (track) => {
      const handle = (value) => {
        if (typeof value !== "number" && (!Array.isArray(value) || !value.every((x) => typeof x === "number"))) {
          throw new TypeError("query.sortBy must return or resolve to a number or an array of numbers.");
        }
        return value;
      };
      const result = query.sortBy(track);
      if (result instanceof Promise) {
        return result.then(handle);
      } else {
        return handle(result);
      }
    } : undefined
  };
};
var mergeInputTrackQueries = (queryA, queryB) => {
  return {
    filter: queryA?.filter || queryB?.filter ? (track) => {
      const resultA = queryA?.filter?.(track) ?? true;
      const handleResultA = (resultA2) => {
        if (resultA2 === false) {
          return false;
        }
        return queryB?.filter?.(track) ?? true;
      };
      if (resultA instanceof Promise) {
        return resultA.then(handleResultA);
      } else {
        return handleResultA(resultA);
      }
    } : undefined,
    sortBy: queryA?.sortBy || queryB?.sortBy ? (track) => {
      const resultA = queryA?.sortBy?.(track) ?? [];
      const resultB = queryB?.sortBy?.(track) ?? [];
      const join = (resultA2, resultB2) => {
        return [
          ...Array.isArray(resultA2) ? resultA2 : [resultA2],
          ...Array.isArray(resultB2) ? resultB2 : [resultB2]
        ];
      };
      if (resultA instanceof Promise || resultB instanceof Promise) {
        return Promise.all([resultA, resultB]).then(([resultA2, resultB2]) => {
          return join(resultA2, resultB2);
        });
      } else {
        return join(resultA, resultB);
      }
    } : undefined
  };
};
var queryInputTracks = async (tracks, query) => {
  let matched = tracks;
  if (query?.filter) {
    const filterMatches = tracks.map((t) => query.filter(t));
    const hasAsyncFilter = filterMatches.some((x) => x instanceof Promise);
    if (hasAsyncFilter) {
      const resolvedFilterMatches = await Promise.all(filterMatches);
      matched = tracks.filter((_, i) => resolvedFilterMatches[i]);
    } else {
      matched = tracks.filter((_, i) => filterMatches[i]);
    }
  }
  if (!query?.sortBy) {
    return matched;
  }
  const sortValues = matched.map((t) => query.sortBy(t));
  const hasAsyncSort = sortValues.some((x) => x instanceof Promise);
  const resolvedSortValues = hasAsyncSort ? await Promise.all(sortValues) : sortValues;
  return matched.map((track, i) => ({ track, sortValue: resolvedSortValues[i] })).sort((a, b) => {
    const aValues = Array.isArray(a.sortValue) ? a.sortValue : [a.sortValue];
    const bValues = Array.isArray(b.sortValue) ? b.sortValue : [b.sortValue];
    const maxLength = Math.max(aValues.length, bValues.length);
    for (let i = 0;i < maxLength; i++) {
      const aValue = aValues[i] ?? 0;
      const bValue = bValues[i] ?? 0;
      if (aValue === bValue) {
        continue;
      }
      return aValue - bValue;
    }
    return 0;
  }).map((x) => x.track);
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/input.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
polyfillSymbolDispose();
var DEFAULT_SOURCE_CACHE_GROUP = 1;
var ENCRYPTION_KEY_CACHE_GROUP = 2;

class Input extends EventEmitter {
  get disposed() {
    return this._disposed;
  }
  constructor(options) {
    super();
    this._demuxerPromise = null;
    this._format = null;
    this._trackBackingsCache = null;
    this._backingToTrack = new Map;
    this._disposed = false;
    this._nextSourceCacheAge = 0;
    this._sourceRefs = [];
    this._sourceCache = [];
    this._sourceCachePromises = [];
    this._onFormatDetermined = null;
    if (!options || typeof options !== "object") {
      throw new TypeError("options must be an object.");
    }
    if (!Array.isArray(options.formats) || options.formats.some((x) => !(x instanceof InputFormat))) {
      throw new TypeError("options.formats must be an array of InputFormat.");
    }
    if (!(options.source instanceof Source || options.source instanceof SourceRef)) {
      throw new TypeError("options.source must be a Source or SourceRef.");
    }
    if (options.source instanceof Source && options.source._disposed) {
      throw new TypeError("options.source must not be a disposed Source.");
    }
    if (options.initInput !== undefined && !(options.initInput instanceof Input)) {
      throw new TypeError("options.initInput, when provided, must be an Input.");
    }
    if (options.formatOptions !== undefined) {
      validateInputFormatOptions(options.formatOptions, "formatOptions");
    }
    this._formats = options.formats;
    this._initInput = options.initInput ?? null;
    this._formatOptions = options.formatOptions ?? {};
    if (options.source instanceof Source) {
      this._rootRef = options.source.ref();
    } else {
      this._rootRef = options.source;
    }
    this._sourceRefs.push(this._rootRef);
  }
  get _rootSource() {
    return this._rootRef.source;
  }
  async _getSourceUncached(request) {
    assert(this._rootSource instanceof PathedSource);
    const ref = await this._rootSource._resolveRequest(request);
    this._emit("source", { source: ref.source, request, isRoot: request.isRoot });
    return ref;
  }
  _getSourceCached(request, cacheGroup = DEFAULT_SOURCE_CACHE_GROUP) {
    const cachedEntry = this._sourceCache.find((x) => x.cacheGroup === cacheGroup && sourceRequestsAreEqual(x.request, request));
    if (cachedEntry) {
      cachedEntry.age++;
      return Promise.resolve(cachedEntry.sourceRef.source.ref());
    }
    const cachedPromiseEntry = this._sourceCachePromises.find((x) => x.cacheGroup === cacheGroup && sourceRequestsAreEqual(x.request, request));
    if (cachedPromiseEntry) {
      return cachedPromiseEntry.promise.then((x) => x.sourceRef.source.ref());
    }
    const promise = (async () => {
      const sourceRef = await this._getSourceUncached(request);
      const MAX_SOURCE_CACHE_SIZE = 4;
      const count = arrayCount(this._sourceCache, (x) => x.cacheGroup === cacheGroup && x.sourceRef.source._refCount === 1);
      if (count >= MAX_SOURCE_CACHE_SIZE) {
        const minAgeIndex = arrayArgmin(this._sourceCache, (x) => x.cacheGroup === cacheGroup && x.sourceRef.source._refCount === 1 ? x.age : Infinity);
        assert(minAgeIndex !== -1);
        const entry = this._sourceCache[minAgeIndex];
        this._sourceCache.splice(minAgeIndex, 1);
        entry.sourceRef.free();
        removeItem(this._sourceRefs, entry.sourceRef);
      }
      this._sourceRefs.push(sourceRef);
      const promiseIndex = this._sourceCachePromises.findIndex((x) => x.request === request);
      assert(promiseIndex !== -1);
      this._sourceCachePromises.splice(promiseIndex, 1);
      const cacheEntry = {
        request,
        sourceRef,
        age: this._nextSourceCacheAge++,
        cacheGroup
      };
      return cacheEntry;
    })();
    this._sourceCachePromises.push({
      request,
      cacheGroup,
      promise
    });
    return promise.then((entry) => {
      const ref = entry.sourceRef.source.ref();
      this._sourceCache.push(entry);
      return ref;
    });
  }
  _getDemuxer() {
    return this._demuxerPromise ??= (async () => {
      this._reader = new Reader(this._rootSource);
      this._emit("source", { source: this._rootSource, request: null, isRoot: true });
      for (const format of this._formats) {
        const canRead = await format._canReadInput(this);
        if (canRead) {
          this._format = format;
          this._onFormatDetermined?.(format);
          return format._createDemuxer(this);
        }
      }
      throw new UnsupportedInputFormatError;
    })();
  }
  get source() {
    return this._rootSource;
  }
  async getFormat() {
    await this._getDemuxer();
    assert(this._format);
    return this._format;
  }
  async canRead() {
    try {
      await this._getDemuxer();
      return true;
    } catch (error) {
      if (error instanceof UnsupportedInputFormatError) {
        return false;
      }
      throw error;
    }
  }
  async getFirstTimestamp(tracks) {
    tracks ??= await this.getTracks();
    const filtered = tracks.filter((x) => x !== null);
    if (filtered.length === 0) {
      return 0;
    }
    const firstTimestamps = await Promise.all(filtered.map((x) => x.getFirstTimestamp()));
    return Math.min(...firstTimestamps);
  }
  async computeDuration(tracks, options) {
    tracks ??= await this.getTracks();
    const filtered = tracks.filter((x) => x !== null);
    if (filtered.length === 0) {
      return 0;
    }
    const tracksDurations = await Promise.all(filtered.map((x) => x.computeDuration(options)));
    return Math.max(...tracksDurations);
  }
  async getDurationFromMetadata(tracks, options) {
    tracks ??= await this.getTracks();
    const filtered = tracks.filter((x) => x !== null);
    const tracksDurations = await Promise.all(filtered.map((x) => x.getDurationFromMetadata(options)));
    const nonNullDurations = tracksDurations.filter((x) => x !== null);
    if (nonNullDurations.length === 0) {
      return null;
    }
    return Math.max(...nonNullDurations);
  }
  async getTracks(query) {
    query &&= toValidatedInputTrackQuery(query);
    const backings = await this._getTrackBackings();
    const tracks = backings.map((backing) => this._wrapBackingAsTrack(backing));
    return queryInputTracks(tracks, query);
  }
  async getVideoTracks(query) {
    query &&= toValidatedInputTrackQuery(query);
    const tracks = await this.getTracks();
    const videoTracks = tracks.filter((x) => x.isVideoTrack());
    return queryInputTracks(videoTracks, query);
  }
  async getAudioTracks(query) {
    query &&= toValidatedInputTrackQuery(query);
    const tracks = await this.getTracks();
    const audioTracks = tracks.filter((x) => x.isAudioTrack());
    return queryInputTracks(audioTracks, query);
  }
  async getPrimaryVideoTrack(query) {
    query &&= toValidatedInputTrackQuery(query);
    const merged = mergeInputTrackQueries(query, {
      sortBy: async (t) => [
        prefer((await t.getDisposition()).default),
        prefer(await t.hasPairableAudioTrack()),
        prefer(!await t.hasOnlyKeyPackets()),
        desc(await t.getBitrate())
      ]
    });
    const sorted = await this.getVideoTracks(merged);
    return sorted[0] ?? null;
  }
  async getPrimaryAudioTrack(query) {
    query &&= toValidatedInputTrackQuery(query);
    const primaryVideoTrack = await this.getPrimaryVideoTrack();
    const merged = mergeInputTrackQueries(query, {
      sortBy: async (t) => [
        prefer(!primaryVideoTrack || t.canBePairedWith(primaryVideoTrack)),
        prefer((await t.getDisposition()).default),
        desc(await t.getBitrate())
      ]
    });
    const sorted = await this.getAudioTracks(merged);
    return sorted[0] ?? null;
  }
  async _getTrackBackings() {
    const demuxer = await this._getDemuxer();
    return this._trackBackingsCache ??= await demuxer.getTrackBackings();
  }
  _wrapBackingAsTrack(backing) {
    const existing = this._backingToTrack.get(backing);
    if (existing) {
      return existing;
    }
    const type = backing.getType();
    const track = type === "video" ? new InputVideoTrack(this, backing) : new InputAudioTrack(this, backing);
    this._backingToTrack.set(backing, track);
    return track;
  }
  async getMimeType() {
    const demuxer = await this._getDemuxer();
    return demuxer.getMimeType();
  }
  async getMetadataTags() {
    const demuxer = await this._getDemuxer();
    return demuxer.getMetadataTags();
  }
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    for (const ref of this._sourceRefs) {
      ref.free();
    }
    this._sourceRefs.length = 0;
    if (this._demuxerPromise) {
      this._demuxerPromise.then((demuxer) => demuxer.dispose()).catch(() => {});
    }
  }
  [Symbol.dispose]() {
    this.dispose();
  }
}

class UnsupportedInputFormatError extends Error {
  constructor(message = "Input has an unsupported or unrecognizable format.") {
    super(message);
    this.name = "UnsupportedInputFormatError";
  }
}

class InputDisposedError extends Error {
  constructor(message = "Input has been disposed.") {
    super(message);
    this.name = "InputDisposedError";
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/reader.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

class Reader {
  constructor(source) {
    this.source = source;
  }
  get fileSize() {
    const size = this.source._getFileSize();
    if (size === undefined) {
      throw new Error("Reading file size too early; read required first.");
    }
    return size;
  }
  get fileSizeNonStrict() {
    return this.source._getFileSize() ?? null;
  }
  requestSlice(start, length) {
    if (this.source._disposed) {
      throw new InputDisposedError;
    }
    if (start < 0) {
      return null;
    }
    if (this.fileSizeNonStrict !== null && start + length > this.fileSizeNonStrict) {
      return null;
    }
    if (length === 0) {
      const buffer = new Uint8Array(0);
      return new FileSlice(buffer, toDataView(buffer), 0, start, start);
    }
    const end = start + length;
    const result = this.source._read(start, end, DEFAULT_MIN_READ_POSITION, DEFAULT_MAX_READ_POSITION);
    if (result instanceof Promise) {
      return result.then((x) => {
        if (!x) {
          return null;
        }
        return new FileSlice(x.bytes, x.view, x.offset, start, end);
      });
    } else {
      if (!result) {
        return null;
      }
      return new FileSlice(result.bytes, result.view, result.offset, start, end);
    }
  }
  requestSliceRange(start, minLength, maxLength) {
    if (this.source._disposed) {
      throw new InputDisposedError;
    }
    if (start < 0) {
      return null;
    }
    if (this.fileSizeNonStrict !== null) {
      return this.requestSlice(start, clamp(this.fileSizeNonStrict - start, minLength, maxLength));
    } else {
      const promisedAttempt = this.requestSlice(start, maxLength);
      const handleAttempt = (attempt) => {
        if (attempt) {
          return attempt;
        }
        assert(this.fileSizeNonStrict !== null);
        return this.requestSlice(start, clamp(this.fileSizeNonStrict - start, minLength, maxLength));
      };
      if (promisedAttempt instanceof Promise) {
        return promisedAttempt.then(handleAttempt);
      } else {
        return handleAttempt(promisedAttempt);
      }
    }
  }
  requestEntireFile() {
    if (this.fileSizeNonStrict !== null) {
      return this.requestSlice(0, this.fileSizeNonStrict);
    }
    const CHUNK_SIZE = 1024;
    return (async () => {
      const chunks = [];
      let currentSize = 0;
      while (true) {
        if (chunks.length === 1 && this.fileSizeNonStrict !== null) {
          return this.requestSlice(0, this.fileSizeNonStrict);
        }
        let slice = this.requestSliceRange(currentSize, 0, CHUNK_SIZE);
        if (slice instanceof Promise)
          slice = await slice;
        if (!slice || slice.length === 0) {
          break;
        }
        const chunk = readBytes(slice, slice.length);
        chunks.push(chunk);
        currentSize += slice.length;
      }
      const joined = new Uint8Array(currentSize);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.length;
      }
      return new FileSlice(joined, toDataView(joined), 0, 0, currentSize);
    })();
  }
}

class FileSlice {
  constructor(bytes, view, offset, start, end) {
    this.bytes = bytes;
    this.view = view;
    this.offset = offset;
    this.start = start;
    this.end = end;
    this.bufferPos = start - offset;
  }
  static tempFromBytes(bytes) {
    return new FileSlice(bytes, toDataView(bytes), 0, 0, bytes.length);
  }
  get length() {
    return this.end - this.start;
  }
  get filePos() {
    return this.offset + this.bufferPos;
  }
  set filePos(value) {
    this.bufferPos = value - this.offset;
  }
  get remainingLength() {
    return Math.max(this.end - this.filePos, 0);
  }
  skip(byteCount) {
    this.bufferPos += byteCount;
  }
  slice(filePos, length = this.end - filePos) {
    if (filePos < this.start || filePos + length > this.end) {
      throw new RangeError("Slicing outside of original slice.");
    }
    return new FileSlice(this.bytes, this.view, this.offset, filePos, filePos + length);
  }
}
var checkIsInRange = (slice, bytesToRead) => {
  if (slice.filePos < slice.start || slice.filePos + bytesToRead > slice.end) {
    throw new RangeError(`Tried reading [${slice.filePos}, ${slice.filePos + bytesToRead}), but slice is` + ` [${slice.start}, ${slice.end}). This is likely an internal error, please report it alongside the file` + ` that caused it.`);
  }
};
var readBytes = (slice, length) => {
  checkIsInRange(slice, length);
  const bytes = slice.bytes.subarray(slice.bufferPos, slice.bufferPos + length);
  slice.bufferPos += length;
  return bytes;
};
var readU8 = (slice) => {
  checkIsInRange(slice, 1);
  return slice.view.getUint8(slice.bufferPos++);
};
var readU16 = (slice, littleEndian) => {
  checkIsInRange(slice, 2);
  const value = slice.view.getUint16(slice.bufferPos, littleEndian);
  slice.bufferPos += 2;
  return value;
};
var readU16Be = (slice) => {
  checkIsInRange(slice, 2);
  const value = slice.view.getUint16(slice.bufferPos, false);
  slice.bufferPos += 2;
  return value;
};
var readU24Be = (slice) => {
  checkIsInRange(slice, 3);
  const value = getUint24(slice.view, slice.bufferPos, false);
  slice.bufferPos += 3;
  return value;
};
var readI16Be = (slice) => {
  checkIsInRange(slice, 2);
  const value = slice.view.getInt16(slice.bufferPos, false);
  slice.bufferPos += 2;
  return value;
};
var readU32 = (slice, littleEndian) => {
  checkIsInRange(slice, 4);
  const value = slice.view.getUint32(slice.bufferPos, littleEndian);
  slice.bufferPos += 4;
  return value;
};
var readU32Be = (slice) => {
  checkIsInRange(slice, 4);
  const value = slice.view.getUint32(slice.bufferPos, false);
  slice.bufferPos += 4;
  return value;
};
var readU32Le = (slice) => {
  checkIsInRange(slice, 4);
  const value = slice.view.getUint32(slice.bufferPos, true);
  slice.bufferPos += 4;
  return value;
};
var readI32Be = (slice) => {
  checkIsInRange(slice, 4);
  const value = slice.view.getInt32(slice.bufferPos, false);
  slice.bufferPos += 4;
  return value;
};
var readI32Le = (slice) => {
  checkIsInRange(slice, 4);
  const value = slice.view.getInt32(slice.bufferPos, true);
  slice.bufferPos += 4;
  return value;
};
var readU64 = (slice, littleEndian) => {
  let low;
  let high;
  if (littleEndian) {
    low = readU32(slice, true);
    high = readU32(slice, true);
  } else {
    high = readU32(slice, false);
    low = readU32(slice, false);
  }
  return high * 4294967296 + low;
};
var readU64Be = (slice) => {
  const high = readU32Be(slice);
  const low = readU32Be(slice);
  return high * 4294967296 + low;
};
var readI64Be = (slice) => {
  const high = readI32Be(slice);
  const low = readU32Be(slice);
  return high * 4294967296 + low;
};
var readI64Le = (slice) => {
  const low = readU32Le(slice);
  const high = readI32Le(slice);
  return high * 4294967296 + low;
};
var readF32Be = (slice) => {
  checkIsInRange(slice, 4);
  const value = slice.view.getFloat32(slice.bufferPos, false);
  slice.bufferPos += 4;
  return value;
};
var readF64Be = (slice) => {
  checkIsInRange(slice, 8);
  const value = slice.view.getFloat64(slice.bufferPos, false);
  slice.bufferPos += 8;
  return value;
};
var readAscii = (slice, length) => {
  checkIsInRange(slice, length);
  let str = "";
  for (let i = 0;i < length; i++) {
    str += String.fromCharCode(slice.bytes[slice.bufferPos++]);
  }
  return str;
};
var readAllLines = (slice, length, options) => {
  const text = textDecoder.decode(readBytes(slice, length));
  const lines = text.split(`
`).map((x) => x.trim()).filter((x) => x.length > 0 && !options?.ignore?.(x));
  return lines;
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/id3.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var Id3V2HeaderFlags;
(function(Id3V2HeaderFlags2) {
  Id3V2HeaderFlags2[Id3V2HeaderFlags2["Unsynchronisation"] = 128] = "Unsynchronisation";
  Id3V2HeaderFlags2[Id3V2HeaderFlags2["ExtendedHeader"] = 64] = "ExtendedHeader";
  Id3V2HeaderFlags2[Id3V2HeaderFlags2["ExperimentalIndicator"] = 32] = "ExperimentalIndicator";
  Id3V2HeaderFlags2[Id3V2HeaderFlags2["Footer"] = 16] = "Footer";
})(Id3V2HeaderFlags || (Id3V2HeaderFlags = {}));
var Id3V2TextEncoding;
(function(Id3V2TextEncoding2) {
  Id3V2TextEncoding2[Id3V2TextEncoding2["ISO_8859_1"] = 0] = "ISO_8859_1";
  Id3V2TextEncoding2[Id3V2TextEncoding2["UTF_16_WITH_BOM"] = 1] = "UTF_16_WITH_BOM";
  Id3V2TextEncoding2[Id3V2TextEncoding2["UTF_16_BE_NO_BOM"] = 2] = "UTF_16_BE_NO_BOM";
  Id3V2TextEncoding2[Id3V2TextEncoding2["UTF_8"] = 3] = "UTF_8";
})(Id3V2TextEncoding || (Id3V2TextEncoding = {}));
var ID3_V1_TAG_SIZE = 128;
var ID3_V2_HEADER_SIZE = 10;
var ID3_V1_GENRES = [
  "Blues",
  "Classic rock",
  "Country",
  "Dance",
  "Disco",
  "Funk",
  "Grunge",
  "Hip-hop",
  "Jazz",
  "Metal",
  "New age",
  "Oldies",
  "Other",
  "Pop",
  "Rhythm and blues",
  "Rap",
  "Reggae",
  "Rock",
  "Techno",
  "Industrial",
  "Alternative",
  "Ska",
  "Death metal",
  "Pranks",
  "Soundtrack",
  "Euro-techno",
  "Ambient",
  "Trip-hop",
  "Vocal",
  "Jazz & funk",
  "Fusion",
  "Trance",
  "Classical",
  "Instrumental",
  "Acid",
  "House",
  "Game",
  "Sound clip",
  "Gospel",
  "Noise",
  "Alternative rock",
  "Bass",
  "Soul",
  "Punk",
  "Space",
  "Meditative",
  "Instrumental pop",
  "Instrumental rock",
  "Ethnic",
  "Gothic",
  "Darkwave",
  "Techno-industrial",
  "Electronic",
  "Pop-folk",
  "Eurodance",
  "Dream",
  "Southern rock",
  "Comedy",
  "Cult",
  "Gangsta",
  "Top 40",
  "Christian rap",
  "Pop/funk",
  "Jungle music",
  "Native US",
  "Cabaret",
  "New wave",
  "Psychedelic",
  "Rave",
  "Showtunes",
  "Trailer",
  "Lo-fi",
  "Tribal",
  "Acid punk",
  "Acid jazz",
  "Polka",
  "Retro",
  "Musical",
  "Rock 'n' roll",
  "Hard rock",
  "Folk",
  "Folk rock",
  "National folk",
  "Swing",
  "Fast fusion",
  "Bebop",
  "Latin",
  "Revival",
  "Celtic",
  "Bluegrass",
  "Avantgarde",
  "Gothic rock",
  "Progressive rock",
  "Psychedelic rock",
  "Symphonic rock",
  "Slow rock",
  "Big band",
  "Chorus",
  "Easy listening",
  "Acoustic",
  "Humour",
  "Speech",
  "Chanson",
  "Opera",
  "Chamber music",
  "Sonata",
  "Symphony",
  "Booty bass",
  "Primus",
  "Porn groove",
  "Satire",
  "Slow jam",
  "Club",
  "Tango",
  "Samba",
  "Folklore",
  "Ballad",
  "Power ballad",
  "Rhythmic Soul",
  "Freestyle",
  "Duet",
  "Punk rock",
  "Drum solo",
  "A cappella",
  "Euro-house",
  "Dance hall",
  "Goa music",
  "Drum & bass",
  "Club-house",
  "Hardcore techno",
  "Terror",
  "Indie",
  "Britpop",
  "Negerpunk",
  "Polsk punk",
  "Beat",
  "Christian gangsta rap",
  "Heavy metal",
  "Black metal",
  "Crossover",
  "Contemporary Christian",
  "Christian rock",
  "Merengue",
  "Salsa",
  "Thrash metal",
  "Anime",
  "Jpop",
  "Synthpop",
  "Christmas",
  "Art rock",
  "Baroque",
  "Bhangra",
  "Big beat",
  "Breakbeat",
  "Chillout",
  "Downtempo",
  "Dub",
  "EBM",
  "Eclectic",
  "Electro",
  "Electroclash",
  "Emo",
  "Experimental",
  "Garage",
  "Global",
  "IDM",
  "Illbient",
  "Industro-Goth",
  "Jam Band",
  "Krautrock",
  "Leftfield",
  "Lounge",
  "Math rock",
  "New romantic",
  "Nu-breakz",
  "Post-punk",
  "Post-rock",
  "Psytrance",
  "Shoegaze",
  "Space rock",
  "Trop rock",
  "World music",
  "Neoclassical",
  "Audiobook",
  "Audio theatre",
  "Neue Deutsche Welle",
  "Podcast",
  "Indie rock",
  "G-Funk",
  "Dubstep",
  "Garage rock",
  "Psybient"
];
var parseId3V1Tag = (slice, tags) => {
  const startPos = slice.filePos;
  tags.raw ??= {};
  tags.raw["TAG"] ??= readBytes(slice, ID3_V1_TAG_SIZE - 3);
  slice.filePos = startPos;
  const title = readId3V1String(slice, 30);
  if (title)
    tags.title ??= title;
  const artist = readId3V1String(slice, 30);
  if (artist)
    tags.artist ??= artist;
  const album = readId3V1String(slice, 30);
  if (album)
    tags.album ??= album;
  const yearText = readId3V1String(slice, 4);
  const year = Number.parseInt(yearText, 10);
  if (Number.isInteger(year) && year > 0) {
    tags.date ??= new Date(String(year));
  }
  const commentBytes = readBytes(slice, 30);
  let comment;
  if (commentBytes[28] === 0 && commentBytes[29] !== 0) {
    const trackNum = commentBytes[29];
    if (trackNum > 0) {
      tags.trackNumber ??= trackNum;
    }
    slice.skip(-30);
    comment = readId3V1String(slice, 28);
    slice.skip(2);
  } else {
    slice.skip(-30);
    comment = readId3V1String(slice, 30);
  }
  if (comment)
    tags.comment ??= comment;
  const genreIndex = readU8(slice);
  if (genreIndex < ID3_V1_GENRES.length) {
    tags.genre ??= ID3_V1_GENRES[genreIndex];
  }
};
var readId3V1String = (slice, length) => {
  const bytes = readBytes(slice, length);
  const endIndex = coalesceIndex(bytes.indexOf(0), bytes.length);
  const relevantBytes = bytes.subarray(0, endIndex);
  let str = "";
  for (let i = 0;i < relevantBytes.length; i++) {
    str += String.fromCharCode(relevantBytes[i]);
  }
  return str.trimEnd();
};
var readId3V2Header = (slice) => {
  const startPos = slice.filePos;
  const tag = readAscii(slice, 3);
  const majorVersion = readU8(slice);
  const revision = readU8(slice);
  const flags = readU8(slice);
  const sizeRaw = readU32Be(slice);
  if (tag !== "ID3" || majorVersion === 255 || revision === 255 || (sizeRaw & 2155905152) !== 0) {
    slice.filePos = startPos;
    return null;
  }
  const size = decodeSynchsafe(sizeRaw);
  return { majorVersion, revision, flags, size };
};
var parseId3V2Tag = (slice, header, tags) => {
  if (![2, 3, 4].includes(header.majorVersion)) {
    console.warn(`Unsupported ID3v2 major version: ${header.majorVersion}`);
    return;
  }
  const bytes = readBytes(slice, header.size);
  const reader = new Id3V2Reader(header, bytes);
  if (header.flags & Id3V2HeaderFlags.Footer) {
    reader.removeFooter();
  }
  if (header.flags & Id3V2HeaderFlags.Unsynchronisation && header.majorVersion === 3) {
    reader.ununsynchronizeAll();
  }
  if (header.flags & Id3V2HeaderFlags.ExtendedHeader) {
    const extendedHeaderSize = reader.readU32();
    if (header.majorVersion === 3) {
      reader.pos += extendedHeaderSize;
    } else {
      reader.pos += extendedHeaderSize - 4;
    }
  }
  while (reader.pos <= reader.bytes.length - reader.frameHeaderSize()) {
    const frame = reader.readId3V2Frame();
    if (!frame) {
      break;
    }
    const frameStartPos = reader.pos;
    const frameEndPos = reader.pos + frame.size;
    let frameEncrypted = false;
    let frameCompressed = false;
    let frameUnsynchronized = false;
    if (header.majorVersion === 3) {
      frameEncrypted = !!(frame.flags & 1 << 6);
      frameCompressed = !!(frame.flags & 1 << 7);
    } else if (header.majorVersion === 4) {
      frameEncrypted = !!(frame.flags & 1 << 2);
      frameCompressed = !!(frame.flags & 1 << 3);
      frameUnsynchronized = !!(frame.flags & 1 << 1) || !!(header.flags & Id3V2HeaderFlags.Unsynchronisation);
    }
    if (frameEncrypted) {
      console.warn(`Skipping encrypted ID3v2 frame ${frame.id}`);
      reader.pos = frameEndPos;
      continue;
    }
    if (frameCompressed) {
      console.warn(`Skipping compressed ID3v2 frame ${frame.id}`);
      reader.pos = frameEndPos;
      continue;
    }
    if (frameUnsynchronized) {
      reader.ununsynchronizeRegion(reader.pos, frameEndPos);
    }
    tags.raw ??= {};
    if (frame.id === "TXXX") {
      const txxx = tags.raw["TXXX"] ??= {};
      const encoding = reader.readId3V2TextEncoding();
      const description = reader.readId3V2Text(encoding, frameEndPos);
      const value = reader.readId3V2Text(encoding, frameEndPos);
      txxx[description] ??= value;
    } else if (frame.id[0] === "T") {
      tags.raw[frame.id] ??= reader.readId3V2EncodingAndText(frameEndPos);
    } else {
      tags.raw[frame.id] ??= reader.readBytes(frame.size);
    }
    reader.pos = frameStartPos;
    switch (frame.id) {
      case "TIT2":
      case "TT2":
        {
          tags.title ??= reader.readId3V2EncodingAndText(frameEndPos);
        }
        ;
        break;
      case "TIT3":
      case "TT3":
        {
          tags.description ??= reader.readId3V2EncodingAndText(frameEndPos);
        }
        ;
        break;
      case "TPE1":
      case "TP1":
        {
          tags.artist ??= reader.readId3V2EncodingAndText(frameEndPos);
        }
        ;
        break;
      case "TALB":
      case "TAL":
        {
          tags.album ??= reader.readId3V2EncodingAndText(frameEndPos);
        }
        ;
        break;
      case "TPE2":
      case "TP2":
        {
          tags.albumArtist ??= reader.readId3V2EncodingAndText(frameEndPos);
        }
        ;
        break;
      case "TRCK":
      case "TRK":
        {
          const trackText = reader.readId3V2EncodingAndText(frameEndPos);
          const parts = trackText.split("/");
          const trackNum = Number.parseInt(parts[0], 10);
          const tracksTotal = parts[1] && Number.parseInt(parts[1], 10);
          if (Number.isInteger(trackNum) && trackNum > 0) {
            tags.trackNumber ??= trackNum;
          }
          if (tracksTotal && Number.isInteger(tracksTotal) && tracksTotal > 0) {
            tags.tracksTotal ??= tracksTotal;
          }
        }
        ;
        break;
      case "TPOS":
      case "TPA":
        {
          const discText = reader.readId3V2EncodingAndText(frameEndPos);
          const parts = discText.split("/");
          const discNum = Number.parseInt(parts[0], 10);
          const discsTotal = parts[1] && Number.parseInt(parts[1], 10);
          if (Number.isInteger(discNum) && discNum > 0) {
            tags.discNumber ??= discNum;
          }
          if (discsTotal && Number.isInteger(discsTotal) && discsTotal > 0) {
            tags.discsTotal ??= discsTotal;
          }
        }
        ;
        break;
      case "TCON":
      case "TCO":
        {
          const genreText = reader.readId3V2EncodingAndText(frameEndPos);
          let match = /^\((\d+)\)/.exec(genreText);
          if (match) {
            const genreNumber = Number.parseInt(match[1]);
            if (ID3_V1_GENRES[genreNumber] !== undefined) {
              tags.genre ??= ID3_V1_GENRES[genreNumber];
              break;
            }
          }
          match = /^\d+$/.exec(genreText);
          if (match) {
            const genreNumber = Number.parseInt(match[0]);
            if (ID3_V1_GENRES[genreNumber] !== undefined) {
              tags.genre ??= ID3_V1_GENRES[genreNumber];
              break;
            }
          }
          tags.genre ??= genreText;
        }
        ;
        break;
      case "TDRC":
      case "TDAT":
        {
          const dateText = reader.readId3V2EncodingAndText(frameEndPos);
          const date = new Date(dateText);
          if (!Number.isNaN(date.getTime())) {
            tags.date ??= date;
          }
        }
        ;
        break;
      case "TYER":
      case "TYE":
        {
          const yearText = reader.readId3V2EncodingAndText(frameEndPos);
          const year = Number.parseInt(yearText, 10);
          if (Number.isInteger(year)) {
            tags.date ??= new Date(String(year));
          }
        }
        ;
        break;
      case "USLT":
      case "ULT":
        {
          const encoding = reader.readU8();
          reader.pos += 3;
          reader.readId3V2Text(encoding, frameEndPos);
          tags.lyrics ??= reader.readId3V2Text(encoding, frameEndPos);
        }
        ;
        break;
      case "COMM":
      case "COM":
        {
          const encoding = reader.readU8();
          reader.pos += 3;
          reader.readId3V2Text(encoding, frameEndPos);
          tags.comment ??= reader.readId3V2Text(encoding, frameEndPos);
        }
        ;
        break;
      case "APIC":
      case "PIC":
        {
          const encoding = reader.readId3V2TextEncoding();
          let mimeType;
          if (header.majorVersion === 2) {
            const imageFormat = reader.readAscii(3);
            mimeType = imageFormat === "PNG" ? "image/png" : imageFormat === "JPG" ? "image/jpeg" : "image/*";
          } else {
            mimeType = reader.readId3V2Text(encoding, frameEndPos);
          }
          const pictureType = reader.readU8();
          const description = reader.readId3V2Text(encoding, frameEndPos).trimEnd();
          const imageDataSize = frameEndPos - reader.pos;
          if (imageDataSize >= 0) {
            const imageData = reader.readBytes(imageDataSize);
            if (!tags.images)
              tags.images = [];
            tags.images.push({
              data: imageData,
              mimeType,
              kind: pictureType === 3 ? "coverFront" : pictureType === 4 ? "coverBack" : "unknown",
              description
            });
          }
        }
        ;
        break;
      default:
        {
          reader.pos += frame.size;
        }
        ;
        break;
    }
    reader.pos = frameEndPos;
  }
};

class Id3V2Reader {
  constructor(header, bytes) {
    this.header = header;
    this.bytes = bytes;
    this.pos = 0;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  frameHeaderSize() {
    return this.header.majorVersion === 2 ? 6 : 10;
  }
  ununsynchronizeAll() {
    const newBytes = [];
    for (let i = 0;i < this.bytes.length; i++) {
      const value1 = this.bytes[i];
      newBytes.push(value1);
      if (value1 === 255 && i !== this.bytes.length - 1) {
        const value2 = this.bytes[i];
        if (value2 === 0) {
          i++;
        }
      }
    }
    this.bytes = new Uint8Array(newBytes);
    this.view = new DataView(this.bytes.buffer);
  }
  ununsynchronizeRegion(start, end) {
    const newBytes = [];
    for (let i = start;i < end; i++) {
      const value1 = this.bytes[i];
      newBytes.push(value1);
      if (value1 === 255 && i !== end - 1) {
        const value2 = this.bytes[i + 1];
        if (value2 === 0) {
          i++;
        }
      }
    }
    const before = this.bytes.subarray(0, start);
    const after = this.bytes.subarray(end);
    this.bytes = new Uint8Array(before.length + newBytes.length + after.length);
    this.bytes.set(before, 0);
    this.bytes.set(newBytes, before.length);
    this.bytes.set(after, before.length + newBytes.length);
    this.view = new DataView(this.bytes.buffer);
  }
  removeFooter() {
    this.bytes = this.bytes.subarray(0, this.bytes.length - ID3_V2_HEADER_SIZE);
    this.view = new DataView(this.bytes.buffer);
  }
  readBytes(length) {
    const slice = this.bytes.subarray(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }
  readU8() {
    const value = this.view.getUint8(this.pos);
    this.pos += 1;
    return value;
  }
  readU16() {
    const value = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return value;
  }
  readU24() {
    const high = this.view.getUint16(this.pos, false);
    const low = this.view.getUint8(this.pos + 2);
    this.pos += 3;
    return high * 256 + low;
  }
  readU32() {
    const value = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return value;
  }
  readAscii(length) {
    let str = "";
    for (let i = 0;i < length; i++) {
      str += String.fromCharCode(this.view.getUint8(this.pos + i));
    }
    this.pos += length;
    return str;
  }
  readId3V2Frame() {
    if (this.header.majorVersion === 2) {
      const id = this.readAscii(3);
      if (id === "\x00\x00\x00") {
        return null;
      }
      const size = this.readU24();
      return { id, size, flags: 0 };
    } else {
      const id = this.readAscii(4);
      if (id === "\x00\x00\x00\x00") {
        return null;
      }
      const sizeRaw = this.readU32();
      let size = this.header.majorVersion === 4 ? decodeSynchsafe(sizeRaw) : sizeRaw;
      const flags = this.readU16();
      const headerEndPos = this.pos;
      const isSizeValid = (size2) => {
        const nextPos = this.pos + size2;
        if (nextPos > this.bytes.length) {
          return false;
        }
        if (nextPos <= this.bytes.length - this.frameHeaderSize()) {
          this.pos += size2;
          const nextId = this.readAscii(4);
          if (nextId !== "\x00\x00\x00\x00" && !/[0-9A-Z]{4}/.test(nextId)) {
            return false;
          }
        }
        return true;
      };
      if (!isSizeValid(size)) {
        const otherSize = this.header.majorVersion === 4 ? sizeRaw : decodeSynchsafe(sizeRaw);
        if (isSizeValid(otherSize)) {
          size = otherSize;
        }
      }
      this.pos = headerEndPos;
      return { id, size, flags };
    }
  }
  readId3V2TextEncoding() {
    const number = this.readU8();
    if (number > 3) {
      throw new Error(`Unsupported text encoding: ${number}`);
    }
    return number;
  }
  readId3V2Text(encoding, until) {
    const startPos = this.pos;
    const data = this.readBytes(until - this.pos);
    switch (encoding) {
      case Id3V2TextEncoding.ISO_8859_1: {
        let str = "";
        for (let i = 0;i < data.length; i++) {
          const value = data[i];
          if (value === 0) {
            this.pos = startPos + i + 1;
            break;
          }
          str += String.fromCharCode(value);
        }
        return str;
      }
      case Id3V2TextEncoding.UTF_16_WITH_BOM: {
        if (data[0] === 255 && data[1] === 254) {
          const decoder = new TextDecoder("utf-16le");
          const endIndex = coalesceIndex(data.findIndex((x, i) => x === 0 && data[i + 1] === 0 && i % 2 === 0), data.length);
          this.pos = startPos + Math.min(endIndex + 2, data.length);
          return decoder.decode(data.subarray(2, endIndex));
        } else if (data[0] === 254 && data[1] === 255) {
          const decoder = new TextDecoder("utf-16be");
          const endIndex = coalesceIndex(data.findIndex((x, i) => x === 0 && data[i + 1] === 0 && i % 2 === 0), data.length);
          this.pos = startPos + Math.min(endIndex + 2, data.length);
          return decoder.decode(data.subarray(2, endIndex));
        } else {
          const endIndex = coalesceIndex(data.findIndex((x) => x === 0), data.length);
          this.pos = startPos + Math.min(endIndex + 1, data.length);
          return textDecoder.decode(data.subarray(0, endIndex));
        }
      }
      case Id3V2TextEncoding.UTF_16_BE_NO_BOM: {
        const decoder = new TextDecoder("utf-16be");
        const endIndex = coalesceIndex(data.findIndex((x, i) => x === 0 && data[i + 1] === 0 && i % 2 === 0), data.length);
        this.pos = startPos + Math.min(endIndex + 2, data.length);
        return decoder.decode(data.subarray(0, endIndex));
      }
      case Id3V2TextEncoding.UTF_8: {
        const endIndex = coalesceIndex(data.findIndex((x) => x === 0), data.length);
        this.pos = startPos + Math.min(endIndex + 1, data.length);
        return textDecoder.decode(data.subarray(0, endIndex));
      }
    }
  }
  readId3V2EncodingAndText(until) {
    if (this.pos >= until) {
      return "";
    }
    const encoding = this.readId3V2TextEncoding();
    return this.readId3V2Text(encoding, until);
  }
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/adts/adts-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/flac/flac-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/subtitles.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/isobmff/isobmff-boxes.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var bytes = /* @__PURE__ */ new Uint8Array(8);
var view = /* @__PURE__ */ new DataView(bytes.buffer);

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/writer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/target.js
var nodeAlias2 = (() => ({}));
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var ARRAY_BUFFER_INITIAL_SIZE = 2 ** 16;
var ARRAY_BUFFER_MAX_SIZE = 2 ** 32;
var DEFAULT_CHUNK_SIZE = 2 ** 24;

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/isobmff/isobmff-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/matroska/matroska-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var MIN_CLUSTER_TIMESTAMP_MS = -(2 ** 15);
var MAX_CLUSTER_TIMESTAMP_MS = 2 ** 15 - 1;

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/mp3/mp3-writer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/mp3/mp3-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/ogg/ogg-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/mpeg-ts/mpeg-ts-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var PMT_PID = 4096;
var AVC_AUD_NAL = new Uint8Array([9, 240]);
var HEVC_AUD_NAL = new Uint8Array([70, 1]);
var MPEG_TS_CRC_POLYNOMIAL = 79764919;
var MPEG_TS_CRC_TABLE = new Uint32Array(256);
for (let n = 0;n < 256; n++) {
  let crc = n << 24;
  for (let k = 0;k < 8; k++) {
    crc = crc & 2147483648 ? crc << 1 ^ MPEG_TS_CRC_POLYNOMIAL : crc << 1;
  }
  MPEG_TS_CRC_TABLE[n] = crc >>> 0 & 4294967295;
}
var computeMpegTsCrc32 = (data) => {
  let crc = 4294967295;
  for (let i = 0;i < data.length; i++) {
    const byte = data[i];
    crc = (crc << 8 ^ MPEG_TS_CRC_TABLE[crc >>> 24 ^ byte]) >>> 0;
  }
  return crc;
};
var PAT_SECTION = new Uint8Array(16);
{
  const view2 = toDataView(PAT_SECTION);
  PAT_SECTION[0] = 0;
  view2.setUint16(1, 45069, false);
  view2.setUint16(3, 1, false);
  PAT_SECTION[5] = 193;
  PAT_SECTION[6] = 0;
  PAT_SECTION[7] = 0;
  view2.setUint16(8, 1, false);
  view2.setUint16(10, 57344 | PMT_PID & 8191, false);
  view2.setUint32(12, computeMpegTsCrc32(PAT_SECTION.subarray(0, 12)), false);
}

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/wave/riff-writer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/wave/wave-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/resample.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/media-source.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var splitterGpuUnavailable = false;

class ColorAlphaSplitter {
  constructor(initialWidth, initialHeight) {
    this.canvas = null;
    this.gl = null;
    this.colorProgram = null;
    this.alphaProgram = null;
    this.vao = null;
    this.sourceTexture = null;
    this.alphaResolutionLocation = null;
    this.worker = null;
    this.pendingRequests = new Map;
    this.nextRequestId = 0;
    const canMakeCanvas = typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined" && typeof document.createElement === "function";
    if (!ColorAlphaSplitter.forceCpu && canMakeCanvas && !splitterGpuUnavailable) {
      try {
        if (typeof OffscreenCanvas !== "undefined") {
          this.canvas = new OffscreenCanvas(initialWidth, initialHeight);
        } else {
          this.canvas = document.createElement("canvas");
          this.canvas.width = initialWidth;
          this.canvas.height = initialHeight;
        }
        const gl = this.canvas.getContext("webgl2", {
          alpha: true
        });
        if (!gl) {
          throw new Error("Couldn't acquire WebGL 2 context.");
        }
        this.gl = gl;
        this.colorProgram = this.createColorProgram();
        this.alphaProgram = this.createAlphaProgram();
        this.vao = this.createVAO();
        this.sourceTexture = this.createTexture();
        this.alphaResolutionLocation = this.gl.getUniformLocation(this.alphaProgram, "u_resolution");
        this.gl.useProgram(this.colorProgram);
        this.gl.uniform1i(this.gl.getUniformLocation(this.colorProgram, "u_sourceTexture"), 0);
        this.gl.useProgram(this.alphaProgram);
        this.gl.uniform1i(this.gl.getUniformLocation(this.alphaProgram, "u_sourceTexture"), 0);
      } catch (error) {
        this.gl = null;
        this.canvas = null;
        splitterGpuUnavailable = true;
        console.warn("Falling back to CPU for color/alpha splitting.", error);
      }
    }
  }
  async update(sourceFrame) {
    if (this.gl) {
      return this.updateGpu(sourceFrame);
    } else {
      return this.updateCpu(sourceFrame);
    }
  }
  updateGpu(sourceFrame) {
    assert(this.gl);
    assert(this.canvas);
    if (sourceFrame.displayWidth !== this.canvas.width || sourceFrame.displayHeight !== this.canvas.height) {
      this.canvas.width = sourceFrame.displayWidth;
      this.canvas.height = sourceFrame.displayHeight;
    }
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceFrame);
    const colorFrame = this.runColorProgram(sourceFrame);
    const alphaFrame = this.runAlphaProgram(sourceFrame);
    sourceFrame.close();
    return { colorFrame, alphaFrame };
  }
  createVertexShader() {
    assert(this.gl);
    return this.createShader(this.gl.VERTEX_SHADER, `#version 300 es
			in vec2 a_position;
			in vec2 a_texCoord;
			out vec2 v_texCoord;
			
			void main() {
				gl_Position = vec4(a_position, 0.0, 1.0);
				v_texCoord = a_texCoord;
			}
		`);
  }
  createColorProgram() {
    assert(this.gl);
    const vertexShader = this.createVertexShader();
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `#version 300 es
			precision highp float;
			
			uniform sampler2D u_sourceTexture;
			in vec2 v_texCoord;
			out vec4 fragColor;
			
			void main() {
				vec4 source = texture(u_sourceTexture, v_texCoord);
				fragColor = vec4(source.rgb, 1.0);
			}
		`);
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    return program;
  }
  createAlphaProgram() {
    assert(this.gl);
    const vertexShader = this.createVertexShader();
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `#version 300 es
			precision highp float;
			
			uniform sampler2D u_sourceTexture;
			uniform vec2 u_resolution; // The width and height of the canvas
			in vec2 v_texCoord;
			out vec4 fragColor;

			// This function determines the value for a single byte in the YUV stream
			float getByteValue(float byteOffset) {
				float width = u_resolution.x;
				float height = u_resolution.y;

				float yPlaneSize = width * height;

				if (byteOffset < yPlaneSize) {
					// This byte is in the luma plane. Find the corresponding pixel coordinates to sample from
					float y = floor(byteOffset / width);
					float x = mod(byteOffset, width);
					
					// Add 0.5 to sample the center of the texel
					vec2 sampleCoord = (vec2(x, y) + 0.5) / u_resolution;
					
					// The luma value is the alpha from the source texture
					return texture(u_sourceTexture, sampleCoord).a;
				} else {
					// Write a fixed value for chroma and beyond
					return 128.0 / 255.0;
				}
			}
			
			void main() {
				// Each fragment writes 4 bytes (R, G, B, A)
				float pixelIndex = floor(gl_FragCoord.y) * u_resolution.x + floor(gl_FragCoord.x);
				float baseByteOffset = pixelIndex * 4.0;

				vec4 result;
				for (int i = 0; i < 4; i++) {
					float currentByteOffset = baseByteOffset + float(i);
					result[i] = getByteValue(currentByteOffset);
				}
				
				fragColor = result;
			}
		`);
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    return program;
  }
  createShader(type, source) {
    assert(this.gl);
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", this.gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  createVAO() {
    assert(this.gl);
    assert(this.colorProgram);
    const vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(vao);
    const vertices = new Float32Array([
      -1,
      -1,
      0,
      1,
      1,
      -1,
      1,
      1,
      -1,
      1,
      0,
      0,
      1,
      1,
      1,
      0
    ]);
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    const positionLocation = this.gl.getAttribLocation(this.colorProgram, "a_position");
    const texCoordLocation = this.gl.getAttribLocation(this.colorProgram, "a_texCoord");
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 16, 8);
    return vao;
  }
  createTexture() {
    assert(this.gl);
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    return texture;
  }
  runColorProgram(sourceFrame) {
    assert(this.gl);
    assert(this.canvas);
    this.gl.useProgram(this.colorProgram);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    return new VideoFrame(this.canvas, {
      timestamp: sourceFrame.timestamp,
      duration: sourceFrame.duration ?? undefined,
      alpha: "discard"
    });
  }
  runAlphaProgram(sourceFrame) {
    assert(this.gl);
    assert(this.canvas);
    this.gl.useProgram(this.alphaProgram);
    this.gl.uniform2f(this.alphaResolutionLocation, this.canvas.width, this.canvas.height);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    const { width, height } = this.canvas;
    const chromaSamples = Math.ceil(width / 2) * Math.ceil(height / 2);
    const yuvSize = width * height + chromaSamples * 2;
    const requiredHeight = Math.ceil(yuvSize / (width * 4));
    let yuv = new Uint8Array(4 * width * requiredHeight);
    this.gl.readPixels(0, 0, width, requiredHeight, this.gl.RGBA, this.gl.UNSIGNED_BYTE, yuv);
    yuv = yuv.subarray(0, yuvSize);
    assert(yuv[width * height] === 128);
    assert(yuv[yuv.length - 1] === 128);
    const init = {
      format: "I420",
      codedWidth: width,
      codedHeight: height,
      timestamp: sourceFrame.timestamp,
      duration: sourceFrame.duration ?? undefined,
      transfer: [yuv.buffer]
    };
    return new VideoFrame(yuv, init);
  }
  updateCpu(sourceFrame) {
    if (!this.worker) {
      const blob = new Blob([`(${colorAlphaSplitterWorkerCode.toString()})()`], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);
      URL.revokeObjectURL(url);
      this.worker.addEventListener("message", (event) => {
        const data = event.data;
        const pending2 = this.pendingRequests.get(data.id);
        if (!pending2) {
          return;
        }
        this.pendingRequests.delete(data.id);
        if ("error" in data) {
          pending2.reject(new Error(data.error));
        } else {
          pending2.resolve({ colorFrame: data.colorFrame, alphaFrame: data.alphaFrame });
        }
      });
      this.worker.addEventListener("error", (event) => {
        const error = new Error(event.message || "Color/alpha splitter worker error.");
        for (const pending2 of this.pendingRequests.values()) {
          pending2.reject(error);
        }
        this.pendingRequests.clear();
      });
    }
    const id = this.nextRequestId++;
    const pending = promiseWithResolvers();
    this.pendingRequests.set(id, pending);
    this.worker.postMessage({ id, sourceFrame }, { transfer: [sourceFrame] });
    return pending.promise;
  }
  close() {
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    this.canvas = null;
    this.worker?.terminate();
    this.worker = null;
    const error = new Error("Color/alpha splitter closed.");
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
ColorAlphaSplitter.forceCpu = true;
var colorAlphaSplitterWorkerCode = () => {
  let cpuSourceBuffer = null;
  let chain = Promise.resolve();
  self.addEventListener("message", (event) => {
    const { id, sourceFrame } = event.data;
    chain = chain.then(async () => {
      try {
        const { colorFrame, alphaFrame } = await split(sourceFrame);
        self.postMessage({ id, colorFrame, alphaFrame }, { transfer: [colorFrame, alphaFrame] });
      } catch (error) {
        self.postMessage({ id, error: error.message });
      } finally {
        sourceFrame.close();
      }
    });
  });
  const split = async (sourceFrame) => {
    const format = sourceFrame.format;
    if (!format) {
      throw new Error("CPU color/alpha splitting requires a known VideoFrame format.");
    }
    const width = sourceFrame.codedWidth;
    const height = sourceFrame.codedHeight;
    const sourceSize = sourceFrame.allocationSize();
    if (!cpuSourceBuffer || cpuSourceBuffer.byteLength !== sourceSize) {
      cpuSourceBuffer = new Uint8Array(sourceSize);
    }
    await sourceFrame.copyTo(cpuSourceBuffer);
    if (format === "RGBA" || format === "BGRA") {
      return splitInterleavedRgba(cpuSourceBuffer, width, height, format, sourceFrame);
    } else if (format === "I420A" || format === "I420AP10" || format === "I420AP12" || format === "I422A" || format === "I422AP10" || format === "I422AP12" || format === "I444A" || format === "I444AP10" || format === "I444AP12") {
      return splitPlanarYuvA(cpuSourceBuffer, width, height, format, sourceFrame);
    }
    throw new Error(`CPU color/alpha splitting does not support format '${format}'.`);
  };
  const splitInterleavedRgba = (source, width, height, format, sourceFrame) => {
    const pixelCount = width * height;
    const chromaW = Math.ceil(width / 2);
    const chromaH = Math.ceil(height / 2);
    const alphaSize = pixelCount + chromaW * chromaH * 2;
    const alphaBuffer = new Uint8Array(alphaSize);
    for (let i = 0, j = 3;i < pixelCount; i++, j += 4) {
      alphaBuffer[i] = source[j];
    }
    alphaBuffer.fill(128, pixelCount);
    const colorFrame = new VideoFrame(source, {
      format: format === "RGBA" ? "RGBX" : "BGRX",
      codedWidth: width,
      codedHeight: height,
      timestamp: sourceFrame.timestamp,
      duration: sourceFrame.duration ?? undefined
    });
    const alphaInit = {
      format: "I420",
      codedWidth: width,
      codedHeight: height,
      timestamp: sourceFrame.timestamp,
      duration: sourceFrame.duration ?? undefined,
      transfer: [alphaBuffer.buffer]
    };
    const alphaFrame = new VideoFrame(alphaBuffer, alphaInit);
    return { colorFrame, alphaFrame };
  };
  const splitPlanarYuvA = (source, width, height, format, sourceFrame) => {
    const is10 = format.includes("P10");
    const is12 = format.includes("P12");
    const bytesPerSample = is10 || is12 ? 2 : 1;
    let chromaW;
    let chromaH;
    if (format.startsWith("I420")) {
      chromaW = Math.ceil(width / 2);
      chromaH = Math.ceil(height / 2);
    } else if (format.startsWith("I422")) {
      chromaW = Math.ceil(width / 2);
      chromaH = height;
    } else {
      chromaW = width;
      chromaH = height;
    }
    const ySamples = width * height;
    const uvSamples = chromaW * chromaH;
    const yBytes = ySamples * bytesPerSample;
    const uvBytes = uvSamples * bytesPerSample;
    const aBytes = ySamples * bytesPerSample;
    const colorBytes = yBytes + uvBytes * 2;
    const colorFormat = format.replace("A", "");
    const alphaChromaW = Math.ceil(width / 2);
    const alphaChromaH = Math.ceil(height / 2);
    const alphaUvSamples = alphaChromaW * alphaChromaH;
    const alphaUvBytes = alphaUvSamples * bytesPerSample;
    const alphaSize = aBytes + 2 * alphaUvBytes;
    const alphaBuffer = new Uint8Array(alphaSize);
    const aPlaneStart = colorBytes;
    alphaBuffer.set(source.subarray(aPlaneStart, aPlaneStart + aBytes), 0);
    const uvOffset = aBytes;
    const neutralChroma = is10 ? 512 : is12 ? 2048 : 128;
    if (bytesPerSample === 1) {
      alphaBuffer.fill(neutralChroma, uvOffset);
    } else {
      const uvView = new Uint16Array(alphaBuffer.buffer, uvOffset, 2 * alphaUvSamples);
      uvView.fill(neutralChroma);
    }
    const alphaFormat = is10 ? "I420P10" : is12 ? "I420P12" : "I420";
    const colorFrame = new VideoFrame(source.subarray(0, colorBytes), {
      format: colorFormat,
      codedWidth: width,
      codedHeight: height,
      timestamp: sourceFrame.timestamp,
      duration: sourceFrame.duration ?? undefined
    });
    const alphaInit = {
      format: alphaFormat,
      codedWidth: width,
      codedHeight: height,
      timestamp: sourceFrame.timestamp,
      duration: sourceFrame.duration ?? undefined,
      transfer: [alphaBuffer.buffer]
    };
    const alphaFrame = new VideoFrame(alphaBuffer, alphaInit);
    return { colorFrame, alphaFrame };
  };
};

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/hls/hls-muxer.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/output-format.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/output.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/conversion.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// ../../node_modules/.pnpm/mediabunny@1.47.0/node_modules/mediabunny/dist/modules/src/index.js
/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
var MEDIABUNNY_LOADED_SYMBOL = Symbol.for("mediabunny loaded");
if (globalThis[MEDIABUNNY_LOADED_SYMBOL]) {
  console.error(`[WARNING]
Mediabunny was loaded twice.` + " This will likely cause Mediabunny not to work correctly." + " Check if multiple dependencies are importing different versions of Mediabunny," + " or if something is being bundled incorrectly.");
}
globalThis[MEDIABUNNY_LOADED_SYMBOL] = true;

// ../../node_modules/.pnpm/@remotion+media@4.0.484_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/@remotion/media/dist/esm/index.mjs
import { Internals as Internals5 } from "remotion";
import { Internals as Internals3 } from "remotion";
import { Internals as Internals4 } from "remotion";
import { useContext, useLayoutEffect } from "react";
import { Internals as Internals6 } from "remotion";
import { jsx } from "react/jsx-runtime";
import { useContext as useContext3, useLayoutEffect as useLayoutEffect2, useMemo as useMemo2, useState as useState2 } from "react";
import {
  cancelRender as cancelRender2,
  Html5Audio,
  Internals as Internals16,
  random,
  useCurrentFrame as useCurrentFrame2,
  useDelayRender,
  useRemotionEnvironment
} from "remotion";
import React2 from "react";
import { cancelRender, Internals as Internals12 } from "remotion";
import { Internals as Internals9 } from "remotion";
import { Internals as Internals8 } from "remotion";
import { Internals as Internals11 } from "remotion";
import { Internals as Internals10 } from "remotion";
import { Internals as Internals14 } from "remotion";
import { Internals as Internals13 } from "remotion";
import { Internals as Internals15 } from "remotion";
import { jsx as jsx2 } from "react/jsx-runtime";
import { jsx as jsx3 } from "react/jsx-runtime";
import React6, { useMemo as useMemo6, useState as useState6 } from "react";
import {
  Internals as Internals21,
  Interactive as Interactive2,
  Sequence as Sequence2,
  useRemotionEnvironment as useRemotionEnvironment4,
  useVideoConfig as useVideoConfig5
} from "remotion";
import {
  useCallback,
  useContext as useContext4,
  useEffect as useEffect2,
  useLayoutEffect as useLayoutEffect3,
  useMemo as useMemo4,
  useRef as useRef2,
  useState as useState4
} from "react";
import {
  Html5Video,
  Internals as Internals19,
  useBufferState as useBufferState2,
  useCurrentFrame as useCurrentFrame3,
  useVideoConfig as useVideoConfig3
} from "remotion";
import { Internals as Internals18 } from "remotion";
import { jsx as jsx4 } from "react/jsx-runtime";
import {
  useContext as useContext5,
  useLayoutEffect as useLayoutEffect4,
  useMemo as useMemo5,
  useRef as useRef3,
  useState as useState5
} from "react";
import {
  Internals as Internals20,
  Loop,
  random as random2,
  useCurrentFrame as useCurrentFrame4,
  useDelayRender as useDelayRender2,
  useRemotionEnvironment as useRemotionEnvironment3,
  useVideoConfig as useVideoConfig4
} from "remotion";
import { jsx as jsx5 } from "react/jsx-runtime";
import { jsx as jsx6 } from "react/jsx-runtime";
var __dispose = Symbol.dispose || /* @__PURE__ */ Symbol.for("Symbol.dispose");
var __asyncDispose = Symbol.asyncDispose || /* @__PURE__ */ Symbol.for("Symbol.asyncDispose");
var __using = (stack, value, async) => {
  if (value != null) {
    if (typeof value !== "object" && typeof value !== "function")
      throw TypeError('Object expected to be assigned to "using" declaration');
    var dispose;
    if (async)
      dispose = value[__asyncDispose];
    if (dispose === undefined)
      dispose = value[__dispose];
    if (typeof dispose !== "function")
      throw TypeError("Object not disposable");
    stack.push([async, dispose, value]);
  } else if (async) {
    stack.push([async]);
  }
  return value;
};
var __callDispose = (stack, error, hasError) => {
  var E = typeof SuppressedError === "function" ? SuppressedError : function(e, s, m, _) {
    return _ = Error(m), _.name = "SuppressedError", _.error = e, _.suppressed = s, _;
  }, fail = (e) => error = hasError ? new E(e, error, "An error was suppressed during disposal") : (hasError = true, e), next = (it) => {
    while (it = stack.pop()) {
      try {
        var result = it[1] && it[1].call(it[2]);
        if (it[0])
          return Promise.resolve(result).then(next, (e) => (fail(e), next()));
      } catch (e) {
        fail(e);
      }
    }
    if (hasError)
      throw error;
  };
  return next();
};
var getLoopDisplay = ({
  loop,
  mediaDurationInSeconds,
  playbackRate,
  trimAfter,
  trimBefore,
  sequenceDurationInFrames,
  compFps
}) => {
  if (!loop || !mediaDurationInSeconds) {
    return;
  }
  const durationInFrames = Internals.calculateMediaDuration({
    mediaDurationInFrames: mediaDurationInSeconds * compFps,
    playbackRate,
    trimAfter,
    trimBefore
  });
  const maxTimes = sequenceDurationInFrames / durationInFrames;
  return {
    numberOfTimes: maxTimes,
    startOffset: 0,
    durationInFrames
  };
};
var getTimeInSeconds = ({
  loop,
  mediaDurationInSeconds,
  unloopedTimeInSeconds,
  src,
  trimAfter,
  trimBefore,
  fps,
  playbackRate,
  ifNoMediaDuration
}) => {
  if (mediaDurationInSeconds === null && loop && ifNoMediaDuration === "fail") {
    throw new Error(`Could not determine duration of ${src}, but "loop" was set.`);
  }
  const loopDuration = loop ? Internals2.calculateMediaDuration({
    trimAfter,
    mediaDurationInFrames: mediaDurationInSeconds ? mediaDurationInSeconds * fps : Infinity,
    playbackRate: 1,
    trimBefore
  }) / fps : Infinity;
  const timeInSeconds = unloopedTimeInSeconds * playbackRate % loopDuration;
  if ((trimAfter ?? null) !== null && !loop) {
    const time = (trimAfter - (trimBefore ?? 0)) / fps;
    if (timeInSeconds >= time) {
      return null;
    }
  }
  return timeInSeconds + (trimBefore ?? 0) / fps;
};
var calculateEndTime = ({
  mediaDurationInSeconds,
  ifNoMediaDuration,
  src,
  trimAfter,
  trimBefore,
  fps
}) => {
  if (mediaDurationInSeconds === null && ifNoMediaDuration === "fail") {
    throw new Error(`Could not determine duration of ${src}, but "loop" was set.`);
  }
  const mediaDuration = Internals2.calculateMediaDuration({
    trimAfter,
    mediaDurationInFrames: mediaDurationInSeconds ? mediaDurationInSeconds * fps : Infinity,
    playbackRate: 1,
    trimBefore
  }) / fps;
  return mediaDuration + (trimBefore ?? 0) / fps;
};
var AUDIO_PRIMING_SECONDS = 0.5;
async function* makeIteratorWithPrimingInner(audioSink, timeToSeek, maximumTimestamp) {
  const primingStart = Math.max(0, timeToSeek - AUDIO_PRIMING_SECONDS);
  const iterator = audioSink.buffers(primingStart, maximumTimestamp);
  for await (const buffer of iterator) {
    if (buffer.timestamp + buffer.duration <= timeToSeek) {
      continue;
    }
    yield {
      buffer,
      timestamp: buffer.timestamp
    };
  }
}
async function* makeLoopingIterator({
  audioSink,
  segmentStartInSeconds,
  segmentEndInSeconds,
  playbackRate,
  sequenceDurationInSeconds
}) {
  const duration = segmentEndInSeconds - segmentStartInSeconds;
  let iteration = 0;
  let broken = false;
  while (true) {
    for await (const item of makeIteratorWithPrimingInner(audioSink, segmentStartInSeconds, segmentEndInSeconds)) {
      const timestamp = item.timestamp + iteration * duration;
      const endTimestamp = duration * iteration + (item.timestamp - segmentStartInSeconds + item.buffer.duration);
      if (endTimestamp > sequenceDurationInSeconds * playbackRate) {
        broken = true;
        break;
      }
      yield {
        buffer: item.buffer,
        timestamp
      };
    }
    if (broken) {
      break;
    }
    iteration++;
  }
}
var makeIteratorWithPriming = ({
  audioSink,
  timeToSeek,
  maximumTimestamp,
  loop,
  playbackRate,
  sequenceDurationInSeconds
}) => {
  if (loop) {
    return makeLoopingIterator({
      audioSink,
      segmentStartInSeconds: timeToSeek,
      segmentEndInSeconds: maximumTimestamp,
      playbackRate,
      sequenceDurationInSeconds
    });
  }
  return makeIteratorWithPrimingInner(audioSink, timeToSeek, maximumTimestamp);
};
var ALLOWED_GLOBAL_TIME_ANCHOR_SHIFT = 0.1;
var makeAudioIterator = ({
  startFromSecond,
  maximumTimestamp,
  audioSink,
  loop,
  playbackRate,
  sequenceDurationInSeconds,
  unscheduleAudioNode
}) => {
  let destroyed = false;
  const iterator = makeIteratorWithPriming({
    audioSink,
    timeToSeek: startFromSecond,
    maximumTimestamp,
    loop,
    playbackRate,
    sequenceDurationInSeconds
  });
  const queuedAudioNodes = [];
  let mostRecentTimestamp = -Infinity;
  const cleanupAudioQueue = () => {
    for (const node of queuedAudioNodes) {
      unscheduleAudioNode(node.node);
      try {
        node.node.stop();
      } catch {}
    }
    queuedAudioNodes.length = 0;
  };
  const getNextFn = async () => {
    const next = await iterator.next();
    if (next.value) {
      mostRecentTimestamp = Math.max(mostRecentTimestamp, next.value.timestamp + next.value.buffer.duration);
    }
    return next;
  };
  return {
    destroy: () => {
      cleanupAudioQueue();
      destroyed = true;
      iterator.return().catch(() => {
        return;
      });
    },
    getNextFn,
    isDestroyed: () => {
      return destroyed;
    },
    addQueuedAudioNode: ({
      node,
      timestamp,
      buffer,
      scheduledTime,
      scheduledAtAnchor
    }) => {
      queuedAudioNodes.push({
        node,
        timestamp,
        buffer,
        scheduledTime,
        playbackRate,
        scheduledAtAnchor
      });
    },
    guessNextTimestamp: () => {
      return !Number.isFinite(mostRecentTimestamp) ? startFromSecond : mostRecentTimestamp;
    },
    getQueuedPeriod: () => {
      let until = -Infinity;
      let from = Infinity;
      for (const node of queuedAudioNodes) {
        until = Math.max(until, node.timestamp + node.buffer.duration);
        from = Math.min(from, node.timestamp);
      }
      if (!Number.isFinite(from) || !Number.isFinite(until)) {
        return null;
      }
      return {
        from,
        until
      };
    }
  };
};
var isAlreadyQueued = (time, queuedPeriod) => {
  if (!queuedPeriod) {
    return false;
  }
  return time >= queuedPeriod.from && time < queuedPeriod.until;
};
var getScheduledTime = ({
  mediaTimestamp,
  targetTime,
  currentTime,
  sequenceStartTime
}) => {
  const needsTrimStart = mediaTimestamp < sequenceStartTime;
  const offsetBecauseOfTrim = needsTrimStart ? sequenceStartTime - mediaTimestamp : 0;
  const offsetBecauseOfTooLate = targetTime < 0 ? -targetTime : 0;
  const offset = offsetBecauseOfTrim + offsetBecauseOfTooLate;
  const scheduledTime = targetTime + currentTime + offset;
  return scheduledTime;
};
var getDurationOfNode = ({
  bufferDuration,
  loopSegmentMediaEndTimestamp,
  offset,
  originalUnloopedMediaTimestamp
}) => {
  const originalUnloopedMediaEndTime = originalUnloopedMediaTimestamp + bufferDuration;
  const needsTrimEnd = originalUnloopedMediaEndTime > loopSegmentMediaEndTimestamp;
  const durationMinusOffset = bufferDuration - offset;
  const duration = needsTrimEnd ? durationMinusOffset - Math.max(0, originalUnloopedMediaEndTime - loopSegmentMediaEndTimestamp) : durationMinusOffset;
  return duration;
};
var getTrimStartForAudioNode = ({
  mediaTimestamp,
  targetTime,
  sequenceStartTime,
  combinedPlaybackRate
}) => {
  const needsTrimStart = mediaTimestamp < sequenceStartTime;
  const offsetBecauseOfTrim = needsTrimStart ? sequenceStartTime - mediaTimestamp : 0;
  const offsetBecauseOfTooLate = targetTime < 0 ? -targetTime * combinedPlaybackRate : 0;
  return offsetBecauseOfTrim + offsetBecauseOfTooLate;
};

class StaleWaiterError extends Error {
  constructor() {
    super("Waiter became stale before it got its turn");
    this.name = "StaleWaiterError";
  }
}
var CONCURRENCY = 1;
var waiters = [];
var running = 0;
var runningEntry = null;
var processNext = () => {
  if (running >= CONCURRENCY) {
    if (runningEntry?.waiter.getPriority() === null) {
      runningEntry.cancel();
    } else {
      return;
    }
  }
  const staleWaiters = [];
  for (let i = waiters.length - 1;i >= 0; i--) {
    if (waiters[i].getPriority() === null) {
      const [stale] = waiters.splice(i, 1);
      staleWaiters.push(stale);
    }
  }
  for (const stale of staleWaiters) {
    stale.onError(new StaleWaiterError);
  }
  if (waiters.length === 0) {
    return;
  }
  let bestIndex = 0;
  let bestPriority = waiters[0].getPriority();
  if (bestPriority === null) {
    throw new Error("Stale waiter should have been removed");
  }
  for (let i = 1;i < waiters.length; i++) {
    const priority = waiters[i].getPriority();
    if (priority === null) {
      throw new Error("Stale waiter should have been removed");
    }
    if (priority < bestPriority) {
      bestPriority = priority;
      bestIndex = i;
    }
  }
  if (bestPriority > 2) {
    return;
  }
  const [next] = waiters.splice(bestIndex, 1);
  running++;
  let settled = false;
  let cancelled = false;
  const entry = {
    waiter: next,
    cancel: () => {
      cancelled = true;
      entry.settle();
    },
    settle: () => {
      if (settled) {
        return;
      }
      settled = true;
      running--;
      if (runningEntry === entry) {
        runningEntry = null;
      }
    }
  };
  runningEntry = entry;
  next.fn().then((value) => {
    entry.settle();
    if (cancelled) {
      return;
    }
    next.onDone(value, processNext);
  }, (err) => {
    entry.settle();
    if (cancelled) {
      return;
    }
    next.onError(err);
  });
};
var waitForTurn = ({
  getPriority,
  fn,
  onDone,
  onError
}) => {
  waiters.push({
    getPriority,
    fn,
    onDone,
    onError
  });
  processNext();
};
var audioIteratorManager = ({
  audioTrack,
  delayPlaybackHandleIfNotPremounting,
  sharedAudioContext,
  getSequenceEndTimestamp,
  getSequenceDurationInSeconds,
  getMediaEndTimestamp,
  getStartTime,
  initialMuted,
  drawDebugOverlay,
  initialPlaybackRate,
  initialTrimBefore,
  initialTrimAfter,
  initialSequenceOffset,
  initialSequenceDurationInFrames,
  initialLoop,
  initialFps
}) => {
  let muted = initialMuted;
  let currentVolume = 1;
  let currentSeek = {
    time: -1,
    playbackRate: initialPlaybackRate,
    trimBefore: initialTrimBefore,
    trimAfter: initialTrimAfter,
    sequenceOffset: initialSequenceOffset,
    sequenceDurationInFrames: initialSequenceDurationInFrames,
    loop: initialLoop,
    fps: initialFps
  };
  const gainNode = sharedAudioContext.audioContext.createGain();
  gainNode.connect(sharedAudioContext.gainNode);
  const audioSink = new AudioBufferSink(audioTrack);
  let audioBufferIterator = null;
  let audioIteratorsCreated = 0;
  let totalAudioScheduledInSeconds = 0;
  let currentDelayHandle = null;
  const unblockCurrentDelayHandle = () => {
    if (currentDelayHandle) {
      currentDelayHandle.unblock();
      currentDelayHandle = null;
    }
  };
  const pendingScheduleWaiters = [];
  const notifyNodeScheduled = () => {
    for (let i = pendingScheduleWaiters.length - 1;i >= 0; i--) {
      const waiter = pendingScheduleWaiters[i];
      waiter.remaining--;
      if (waiter.remaining <= 0) {
        waiter.resolve();
        pendingScheduleWaiters.splice(i, 1);
      }
    }
  };
  const waitForNScheduledNodes = (n) => {
    if (n <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      pendingScheduleWaiters.push({ remaining: n, resolve });
    });
  };
  const scheduleAudioChunk = ({
    buffer,
    mediaTimestamp,
    originalUnloopedMediaTimestamp,
    playbackRate,
    scheduleAudioNode,
    logLevel
  }) => {
    if (!audioBufferIterator) {
      throw new Error("Audio buffer iterator not found");
    }
    if (muted) {
      return;
    }
    const node = sharedAudioContext.audioContext.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = playbackRate;
    node.connect(gainNode);
    const started = scheduleAudioNode(node, mediaTimestamp, originalUnloopedMediaTimestamp);
    if (started.type === "not-started") {
      Internals3.Log.verbose({ logLevel, tag: "audio-scheduling" }, "not started, disconnected: %s %s", mediaTimestamp.toFixed(3), buffer.duration.toFixed(3));
      node.disconnect();
      return;
    }
    audioBufferIterator.addQueuedAudioNode({
      node,
      timestamp: mediaTimestamp,
      buffer,
      scheduledTime: started.scheduledTime,
      scheduledAtAnchor: sharedAudioContext.audioSyncAnchor.value
    });
  };
  const onAudioChunk = ({
    buffer,
    playbackRate,
    scheduleAudioNode,
    logLevel
  }) => {
    if (muted) {
      return;
    }
    const startTime = getStartTime();
    const sequenceEndTime = getSequenceEndTimestamp();
    if (buffer.timestamp + buffer.buffer.duration <= startTime) {
      return;
    }
    if (buffer.timestamp >= sequenceEndTime) {
      return;
    }
    const scheduledStart = Math.max(buffer.timestamp, startTime);
    const scheduledEnd = Math.min(buffer.timestamp + buffer.buffer.duration, sequenceEndTime);
    totalAudioScheduledInSeconds += Math.max(0, scheduledEnd - scheduledStart);
    scheduleAudioChunk({
      buffer: buffer.buffer.buffer,
      mediaTimestamp: buffer.timestamp,
      playbackRate,
      scheduleAudioNode,
      logLevel,
      originalUnloopedMediaTimestamp: buffer.buffer.timestamp
    });
    drawDebugOverlay();
  };
  const proceedScheduling = ({
    iterator,
    nonce,
    getTargetTime,
    playbackRate,
    scheduleAudioNode,
    onScheduled,
    onDestroyed,
    onDone,
    logLevel,
    currentTime,
    getAudioContextCurrentTimeMockedInTest
  }) => {
    waitForTurn({
      getPriority: () => {
        if (iterator.isDestroyed()) {
          onDestroyed();
          return null;
        }
        const guessedNextTimestamp = iterator.guessNextTimestamp();
        const targetTime = getTargetTime(guessedNextTimestamp, currentTime);
        if (targetTime === null) {
          return null;
        }
        const scheduledTime = getScheduledTime({
          mediaTimestamp: guessedNextTimestamp,
          targetTime,
          currentTime,
          sequenceStartTime: getStartTime()
        });
        return scheduledTime - getAudioContextCurrentTimeMockedInTest();
      },
      fn: () => iterator.getNextFn(),
      onDone: (result, next) => {
        if (iterator.isDestroyed()) {
          next();
          onDestroyed();
          return;
        }
        if (!result.value) {
          next();
          onDone();
          return;
        }
        onScheduled(result.value.timestamp);
        notifyNodeScheduled();
        onAudioChunk({
          buffer: result.value,
          playbackRate,
          scheduleAudioNode,
          logLevel
        });
        proceedScheduling({
          iterator,
          nonce,
          getTargetTime,
          playbackRate,
          scheduleAudioNode,
          onScheduled,
          onDestroyed,
          onDone,
          logLevel,
          currentTime,
          getAudioContextCurrentTimeMockedInTest
        });
        next();
      },
      onError: (e) => {
        if (e instanceof InputDisposedError) {
          onDestroyed();
          return;
        }
        if (e instanceof StaleWaiterError) {
          onDestroyed();
          return;
        }
        throw e;
      }
    });
  };
  const startAudioIterator = ({
    nonce,
    playbackRate,
    startFromSecond,
    scheduleAudioNode,
    getTargetTime,
    logLevel,
    loop,
    unscheduleAudioNode,
    getAudioContextCurrentTimeMockedInTest
  }) => {
    if (muted) {
      return;
    }
    const maximumTimestamp = getMediaEndTimestamp();
    if (startFromSecond >= maximumTimestamp) {
      return;
    }
    audioBufferIterator?.destroy();
    unblockCurrentDelayHandle();
    const delayHandle = delayPlaybackHandleIfNotPremounting();
    currentDelayHandle = delayHandle;
    const iterator = makeAudioIterator({
      startFromSecond,
      maximumTimestamp,
      audioSink,
      logLevel,
      loop,
      playbackRate,
      sequenceDurationInSeconds: getSequenceDurationInSeconds(),
      unscheduleAudioNode
    });
    audioIteratorsCreated++;
    audioBufferIterator = iterator;
    let chunksScheduled = 0;
    proceedScheduling({
      iterator,
      nonce,
      getTargetTime,
      playbackRate,
      scheduleAudioNode,
      onScheduled: () => {
        chunksScheduled++;
        if (chunksScheduled === 6) {
          delayHandle.unblock();
        }
      },
      onDestroyed: () => {
        delayHandle.unblock();
      },
      onDone: () => {
        delayHandle.unblock();
      },
      logLevel,
      currentTime: sharedAudioContext.audioContext.currentTime,
      getAudioContextCurrentTimeMockedInTest
    });
  };
  const seek = ({
    newTime,
    nonce,
    playbackRate,
    scheduleAudioNode,
    getTargetTime,
    logLevel,
    loop,
    trimBefore,
    trimAfter,
    sequenceOffset,
    sequenceDurationInFrames,
    fps,
    getAudioContextCurrentTimeMockedInTest
  }) => {
    if (nonce.isStale()) {
      return;
    }
    if (currentSeek.time === newTime && currentSeek.playbackRate === playbackRate && currentSeek.trimBefore === trimBefore && currentSeek.trimAfter === trimAfter && currentSeek.sequenceOffset === sequenceOffset && currentSeek.sequenceDurationInFrames === sequenceDurationInFrames && currentSeek.loop === loop && currentSeek.fps === fps) {
      return;
    }
    currentSeek = {
      time: newTime,
      playbackRate,
      trimBefore,
      trimAfter,
      sequenceOffset,
      sequenceDurationInFrames,
      loop,
      fps
    };
    if (muted) {
      return;
    }
    if (audioBufferIterator && !audioBufferIterator.isDestroyed()) {
      const queuedPeriod = audioBufferIterator.getQueuedPeriod();
      const queuedPeriodMinusLatency = queuedPeriod ? {
        from: queuedPeriod.from - ALLOWED_GLOBAL_TIME_ANCHOR_SHIFT - sharedAudioContext.audioContext.baseLatency - sharedAudioContext.audioContext.outputLatency,
        until: queuedPeriod.until
      } : null;
      const currentTimeIsAlreadyQueued = isAlreadyQueued(newTime, queuedPeriodMinusLatency);
      if (currentTimeIsAlreadyQueued) {
        processNext();
        return;
      }
      const currentIteratorTimestamp = audioBufferIterator.guessNextTimestamp();
      if (currentIteratorTimestamp < newTime && Math.abs(currentIteratorTimestamp - newTime) < 1) {
        processNext();
        return;
      }
    }
    startAudioIterator({
      nonce,
      playbackRate,
      startFromSecond: newTime,
      scheduleAudioNode,
      getTargetTime,
      logLevel,
      loop,
      unscheduleAudioNode: sharedAudioContext.unscheduleAudioNode,
      getAudioContextCurrentTimeMockedInTest
    });
  };
  return {
    startAudioIterator,
    getAudioBufferIterator: () => audioBufferIterator,
    destroyIterator: () => {
      audioBufferIterator?.destroy();
      audioBufferIterator = null;
      unblockCurrentDelayHandle();
    },
    seek,
    getAudioIteratorsCreated: () => audioIteratorsCreated,
    getTotalAudioScheduledInSeconds: () => totalAudioScheduledInSeconds,
    setMuted: (newMuted) => {
      muted = newMuted;
      gainNode.gain.value = muted ? 0 : currentVolume;
    },
    setVolume: (volume) => {
      currentVolume = Math.max(0, volume);
      gainNode.gain.value = muted ? 0 : currentVolume;
    },
    scheduleAudioChunk,
    waitForNScheduledNodes
  };
};
var drawPreviewOverlay = ({
  context,
  audioTime,
  audioContextState,
  audioSyncAnchor,
  playing,
  audioIteratorManager: audioIteratorManager2,
  videoIteratorManager,
  playbackRate
}) => {
  const anchorValue = audioSyncAnchor?.value ?? 0;
  const lines = [
    "Debug overlay",
    `Video iterators created: ${videoIteratorManager?.getVideoIteratorsCreated()}`,
    `Audio iterators created: ${audioIteratorManager2?.getAudioIteratorsCreated()}`,
    `Audio scheduled: ${(audioIteratorManager2?.getTotalAudioScheduledInSeconds() ?? 0).toFixed(3)}s`,
    `Frames rendered: ${videoIteratorManager?.getFramesRendered()}`,
    `Audio context state: ${audioContextState}`,
    audioTime ? `Audio time: ${((audioTime - anchorValue) * playbackRate).toFixed(3)}s` : null
  ].filter(Boolean);
  if (audioIteratorManager2) {
    const queuedPeriod = audioIteratorManager2.getAudioBufferIterator()?.getQueuedPeriod();
    if (queuedPeriod) {
      const aheadText = audioTime ? ` (${(queuedPeriod.until - (audioTime - anchorValue) * playbackRate).toFixed(3)}s ahead)` : "";
      lines.push(`Audio queued until ${queuedPeriod.until.toFixed(3)}s${aheadText}`);
    }
    lines.push(`Playing: ${playing}`);
  }
  const lineHeight = 30;
  const boxPaddingX = 10;
  const boxPaddingY = 10;
  const boxLeft = 20;
  const boxTop = 20;
  const boxWidth = 600;
  const boxHeight = lines.length * lineHeight + 2 * boxPaddingY;
  context.fillStyle = "rgba(0, 0, 0, 1)";
  context.fillRect(boxLeft, boxTop, boxWidth, boxHeight);
  context.fillStyle = "white";
  context.font = "24px sans-serif";
  context.textBaseline = "top";
  for (let i = 0;i < lines.length; i++) {
    context.fillText(lines[i], boxLeft + boxPaddingX, boxTop + boxPaddingY + i * lineHeight);
  }
};
var getDurationOrCompute = async (input) => {
  return await input.getDurationFromMetadata(undefined, {
    skipLiveWait: true
  }) ?? input.computeDuration(undefined, { skipLiveWait: true });
};
var resolveAudioTrack = async ({
  videoTrack,
  audioTracks,
  audioStreamIndex
}) => {
  if (audioStreamIndex !== null) {
    return audioTracks[audioStreamIndex] ?? null;
  }
  if (videoTrack) {
    return await videoTrack.getPrimaryPairableAudioTrack() ?? null;
  }
  return audioTracks[0] ?? null;
};
function isNetworkError(error) {
  if (error.message.includes("Failed to fetch") || error.message.includes("Load failed") || error.message.includes("NetworkError when attempting to fetch resource")) {
    return true;
  }
  return false;
}
function isUnsupportedConfigurationError(error) {
  return error.message.includes("Unsupported configuration");
}
var makeNonceManager = () => {
  let nonce = 0;
  const createAsyncOperation = () => {
    nonce++;
    const currentNonce = nonce;
    return {
      isStale: () => nonce !== currentNonce
    };
  };
  return {
    createAsyncOperation
  };
};

class PremountAwareDelayPlayback {
  isPremounting;
  isPostmounting;
  activeHandles = new Set;
  delayPlayback;
  constructor({
    bufferState,
    isPremounting,
    isPostmounting
  }) {
    this.delayPlayback = bufferState.delayPlayback;
    this.isPremounting = isPremounting;
    this.isPostmounting = isPostmounting;
  }
  shouldDelayPlayback() {
    return !this.isPremounting && !this.isPostmounting;
  }
  syncHandles() {
    for (const handle of this.activeHandles) {
      if (this.shouldDelayPlayback()) {
        handle.arm();
      } else {
        handle.disarm();
      }
    }
  }
  setIsPremounting(isPremounting) {
    this.isPremounting = isPremounting;
    this.syncHandles();
  }
  setIsPostmounting(isPostmounting) {
    this.isPostmounting = isPostmounting;
    this.syncHandles();
  }
  createHandle() {
    let armed = false;
    let unblock = null;
    let disposed = false;
    const arm = () => {
      if (armed || disposed) {
        return;
      }
      unblock = this.delayPlayback().unblock;
      armed = true;
    };
    const disarm = () => {
      if (!armed) {
        return;
      }
      unblock?.();
      unblock = null;
      armed = false;
    };
    const entry = {
      arm,
      disarm,
      dispose: () => {}
    };
    entry.dispose = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      disarm();
      this.activeHandles.delete(entry);
    };
    this.activeHandles.add(entry);
    if (this.shouldDelayPlayback()) {
      arm();
    }
    return {
      unblock: entry.dispose,
      [Symbol.dispose]: entry.dispose
    };
  }
}
var normalizeMediaHeaders = (headers) => {
  if (!headers) {
    return;
  }
  const entries = [];
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      entries.push([key.toLowerCase(), value]);
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      entries.push([key.toLowerCase(), value]);
    }
  } else {
    for (const [key, value] of Object.entries(headers)) {
      entries.push([key.toLowerCase(), value]);
    }
  }
  entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return entries;
};
var normalizeMediaRequestInit = (requestInit) => {
  if (!requestInit) {
    return;
  }
  const headers = normalizeMediaHeaders(requestInit.headers);
  const normalized = {
    ...requestInit.cache === undefined ? null : { cache: requestInit.cache },
    ...requestInit.credentials === undefined ? null : { credentials: requestInit.credentials },
    ...headers === undefined ? null : { headers },
    ...requestInit.integrity === undefined ? null : { integrity: requestInit.integrity },
    ...requestInit.mode === undefined ? null : { mode: requestInit.mode },
    ...requestInit.redirect === undefined ? null : { redirect: requestInit.redirect },
    ...requestInit.referrer === undefined ? null : { referrer: requestInit.referrer },
    ...requestInit.referrerPolicy === undefined ? null : { referrerPolicy: requestInit.referrerPolicy }
  };
  return Object.keys(normalized).length === 0 ? undefined : normalized;
};
var getMediaRequestInitFingerprint = (requestInit) => {
  const normalized = normalizeMediaRequestInit(requestInit);
  if (!normalized) {
    return null;
  }
  return [
    normalized.cache ?? null,
    normalized.credentials ?? null,
    normalized.integrity ?? null,
    normalized.mode ?? null,
    normalized.redirect ?? null,
    normalized.referrer ?? null,
    normalized.referrerPolicy ?? null,
    normalized.headers ?? null
  ];
};
var resolveRequestInit = ({
  credentials,
  requestInit
}) => {
  if (credentials === undefined) {
    return normalizeMediaRequestInit(requestInit);
  }
  return normalizeMediaRequestInit({
    credentials,
    ...requestInit
  });
};
var roundTo4Digits = (timestamp) => {
  return Math.round(timestamp * 1000) / 1000;
};
var BUFFER_SIZE = 3;
var canvasesAheadOfTime = (videoSink, startTimestamp) => {
  const iterator = videoSink.canvases(startTimestamp);
  const buffer = [];
  let chaining = false;
  let reachedEnd = false;
  let closed = false;
  let inFlight = null;
  const closeFrame = (frame) => {
    frame.close?.();
  };
  const fillNext = () => {
    if (chaining || reachedEnd || closed)
      return;
    if (buffer.length >= BUFFER_SIZE)
      return;
    chaining = true;
    const slot = { promise: iterator.next(), resolved: null };
    buffer.push(slot);
    inFlight = slot.promise.then((result) => {
      slot.resolved = result;
      chaining = false;
      inFlight = null;
      if (result.done) {
        reachedEnd = true;
        return;
      }
      if (closed) {
        closeFrame(result.value);
        return;
      }
      fillNext();
    }, () => {
      chaining = false;
      inFlight = null;
    });
  };
  fillNext();
  const next = () => {
    const slot = buffer.shift();
    fillNext();
    if (!slot) {
      if (reachedEnd || closed) {
        return { type: "ready", frame: null };
      }
      const chain = inFlight;
      return {
        type: "pending",
        wait: async () => {
          await chain;
          const next2 = buffer.shift();
          fillNext();
          if (!next2)
            return null;
          if (next2.resolved) {
            return next2.resolved.done ? null : next2.resolved.value;
          }
          const result = await next2.promise;
          return result.done ? null : result.value;
        }
      };
    }
    if (slot.resolved) {
      if (slot.resolved.done) {
        return { type: "ready", frame: null };
      }
      return { type: "ready", frame: slot.resolved.value };
    }
    return {
      type: "pending",
      wait: async () => {
        const result = await slot.promise;
        return result.done ? null : result.value;
      }
    };
  };
  const closeIterator = async () => {
    closed = true;
    for (const slot of buffer) {
      if (slot.resolved && !slot.resolved.done) {
        closeFrame(slot.resolved.value);
      }
    }
    buffer.length = 0;
    await iterator.return();
  };
  return { next, closeIterator };
};
var makePrewarmedVideoIteratorCache = (videoSink) => {
  const prewarmedVideoIterators = new Map;
  const prewarmIteratorForLooping = ({ timeToSeek }) => {
    if (!prewarmedVideoIterators.has(timeToSeek)) {
      prewarmedVideoIterators.set(timeToSeek, canvasesAheadOfTime(videoSink, timeToSeek));
    }
  };
  const makeIteratorOrUsePrewarmed = (timeToSeek) => {
    const prewarmedIterator = prewarmedVideoIterators.get(timeToSeek);
    if (prewarmedIterator) {
      prewarmedVideoIterators.delete(timeToSeek);
      return prewarmedIterator;
    }
    return canvasesAheadOfTime(videoSink, timeToSeek);
  };
  const destroy = () => {
    for (const iterator of prewarmedVideoIterators.values()) {
      iterator.closeIterator();
    }
    prewarmedVideoIterators.clear();
  };
  return {
    prewarmIteratorForLooping,
    makeIteratorOrUsePrewarmed,
    destroy
  };
};
var createVideoIterator = async (timeToSeek, cache) => {
  let destroyed = false;
  const iterator = cache.makeIteratorOrUsePrewarmed(timeToSeek);
  let iteratorEnded = false;
  const firstAwait = iterator.next();
  const initialFrame = firstAwait && firstAwait.type === "ready" ? firstAwait.frame : await firstAwait.wait();
  let lastReturnedFrame = initialFrame;
  let peekedFrame = null;
  const peek = async () => {
    if (peekedFrame) {
      return peekedFrame;
    }
    const next = iterator.next();
    if (next.type === "ready") {
      peekedFrame = next.frame;
    } else {
      peekedFrame = await next.wait();
    }
    return peekedFrame;
  };
  const getNextOrNullIfNotAvailable = () => {
    if (peekedFrame) {
      const frame = peekedFrame;
      lastReturnedFrame = frame;
      const retValue = {
        type: "got-frame-or-end",
        frame
      };
      peekedFrame = null;
      return retValue;
    }
    const next = iterator.next();
    if (next.type === "pending") {
      return {
        type: "need-to-wait-for-it",
        waitPromise: async () => {
          const res = await next.wait();
          if (res) {
            lastReturnedFrame = res;
          } else {
            iteratorEnded = true;
          }
          return res;
        }
      };
    }
    if (next.frame) {
      lastReturnedFrame = next.frame;
    } else {
      iteratorEnded = true;
    }
    return {
      type: "got-frame-or-end",
      frame: next.frame ?? null
    };
  };
  const destroy = () => {
    destroyed = true;
    lastReturnedFrame = null;
    iterator.closeIterator().catch(() => {
      return;
    });
  };
  const tryToSatisfySeek = async (time) => {
    if (lastReturnedFrame) {
      const frameTimestamp = roundTo4Digits(lastReturnedFrame.timestamp);
      if (roundTo4Digits(time) < frameTimestamp) {
        const lastFrameWasInitialFrame = lastReturnedFrame === initialFrame;
        const firstFrameDoesSatisfy = lastFrameWasInitialFrame && roundTo4Digits(time) >= roundTo4Digits(timeToSeek);
        if (firstFrameDoesSatisfy) {
          return {
            type: "satisfied",
            frame: lastReturnedFrame
          };
        }
        return {
          type: "not-satisfied",
          reason: `iterator is too far, most recently returned ${frameTimestamp}`
        };
      }
      let lastFrameDuration = lastReturnedFrame.duration;
      if (lastFrameDuration === 0) {
        const peeked = await peek();
        if (peeked) {
          lastFrameDuration = peeked.timestamp - lastReturnedFrame.timestamp;
        }
      }
      const frameEndTimestamp = roundTo4Digits(lastReturnedFrame.timestamp + lastFrameDuration);
      const timestamp = roundTo4Digits(time);
      if (frameTimestamp <= timestamp && frameEndTimestamp > timestamp) {
        return {
          type: "satisfied",
          frame: lastReturnedFrame
        };
      }
    }
    if (iteratorEnded) {
      if (lastReturnedFrame) {
        return {
          type: "satisfied",
          frame: lastReturnedFrame
        };
      }
      return {
        type: "not-satisfied",
        reason: "iterator ended"
      };
    }
    while (true) {
      const frame = getNextOrNullIfNotAvailable();
      if (frame.type === "need-to-wait-for-it") {
        return {
          type: "not-satisfied",
          reason: "iterator did not have frame ready"
        };
      }
      if (frame.type === "got-frame-or-end") {
        if (frame.frame === null) {
          iteratorEnded = true;
          if (lastReturnedFrame) {
            return {
              type: "satisfied",
              frame: lastReturnedFrame
            };
          }
          return {
            type: "not-satisfied",
            reason: "iterator ended and did not have frame ready"
          };
        }
        const frameTimestamp = roundTo4Digits(frame.frame.timestamp);
        const frameEndTimestamp = roundTo4Digits(frame.frame.timestamp + frame.frame.duration);
        const timestamp = roundTo4Digits(time);
        if (frameTimestamp <= timestamp && frameEndTimestamp > timestamp) {
          return {
            type: "satisfied",
            frame: frame.frame
          };
        }
        continue;
      }
      throw new Error("Unreachable");
    }
  };
  return {
    destroy,
    initialFrame,
    isDestroyed: () => {
      return destroyed;
    },
    tryToSatisfySeek
  };
};
var { runEffectChain } = Internals4;
var videoIteratorManager = async ({
  delayPlaybackHandleIfNotPremounting,
  canvas,
  context,
  drawDebugOverlay,
  logLevel,
  getOnVideoFrameCallback,
  videoTrack,
  getLoopSegmentMediaEndTimestamp,
  getStartTime,
  getIsLooping,
  getEffects,
  getEffectChainState
}) => {
  let videoIteratorsCreated = 0;
  let videoFrameIterator = null;
  let framesRendered = 0;
  let currentDelayHandle = null;
  let lastDrawnFrame = null;
  let currentSeek = null;
  const clearLastDrawnFrame = () => {
    lastDrawnFrame = null;
  };
  if (canvas) {
    const displayWidth = await videoTrack.getDisplayWidth();
    const displayHeight = await videoTrack.getDisplayHeight();
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
  }
  const canvasSink = new CanvasSink(videoTrack, {
    poolSize: 2,
    fit: "contain",
    alpha: true
  });
  const prewarmedVideoIteratorCache = makePrewarmedVideoIteratorCache(canvasSink);
  const paintFrame = async (frame) => {
    if (context && canvas) {
      const effects = getEffects();
      const chainState = getEffectChainState(canvas.width, canvas.height);
      if (effects.length > 0 && chainState && canvas instanceof HTMLCanvasElement) {
        await runEffectChain({
          state: chainState,
          source: frame.canvas,
          effects,
          output: canvas,
          width: canvas.width,
          height: canvas.height
        });
      } else {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(frame.canvas, 0, 0);
      }
    }
  };
  const drawFrame = async (frame) => {
    await paintFrame(frame);
    lastDrawnFrame = frame;
    framesRendered++;
    drawDebugOverlay();
    const callback = getOnVideoFrameCallback();
    if (callback) {
      callback(frame.canvas);
    }
    Internals4.Log.trace({ logLevel, tag: "@remotion/media" }, `[MediaPlayer] Drew frame ${frame.timestamp.toFixed(3)}s`);
  };
  const redrawCurrentFrame = async () => {
    if (!lastDrawnFrame) {
      return;
    }
    await paintFrame(lastDrawnFrame);
    drawDebugOverlay();
    const callback = getOnVideoFrameCallback();
    if (callback) {
      callback(lastDrawnFrame.canvas);
    }
    Internals4.Log.trace({ logLevel, tag: "@remotion/media" }, `[MediaPlayer] Redrew frame ${lastDrawnFrame.timestamp.toFixed(3)}s with updated effects`);
  };
  const startVideoIterator = async (timeToSeek, nonce) => {
    let __stack = [];
    try {
      clearLastDrawnFrame();
      videoFrameIterator?.destroy();
      const delayHandle = __using(__stack, delayPlaybackHandleIfNotPremounting(), 0);
      currentDelayHandle = delayHandle;
      currentSeek = timeToSeek;
      const iterator = await createVideoIterator(timeToSeek, prewarmedVideoIteratorCache);
      videoIteratorsCreated++;
      videoFrameIterator = iterator;
      if (iterator.isDestroyed()) {
        return;
      }
      if (nonce.isStale()) {
        return;
      }
      if (videoFrameIterator.isDestroyed()) {
        return;
      }
      if (!iterator.initialFrame) {
        return;
      }
      await drawFrame(iterator.initialFrame);
    } catch (_catch) {
      var _err = _catch, _hasErr = 1;
    } finally {
      __callDispose(__stack, _err, _hasErr);
    }
  };
  const seek = async ({ newTime, nonce }) => {
    if (!videoFrameIterator) {
      return;
    }
    if (currentSeek !== null && roundTo4Digits(currentSeek) === roundTo4Digits(newTime)) {
      return;
    }
    currentSeek = newTime;
    if (getIsLooping()) {
      if (getLoopSegmentMediaEndTimestamp() - newTime < 1) {
        prewarmedVideoIteratorCache.prewarmIteratorForLooping({
          timeToSeek: getStartTime()
        });
      }
    }
    const videoSatisfyResult = await videoFrameIterator.tryToSatisfySeek(newTime);
    if (videoSatisfyResult.type === "satisfied") {
      await drawFrame(videoSatisfyResult.frame);
      return;
    }
    if (nonce.isStale()) {
      return;
    }
    await startVideoIterator(newTime, nonce);
  };
  return {
    startVideoIterator,
    getVideoIteratorsCreated: () => videoIteratorsCreated,
    seek,
    destroy: () => {
      clearLastDrawnFrame();
      prewarmedVideoIteratorCache.destroy();
      videoFrameIterator?.destroy();
      if (context && canvas) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (currentDelayHandle) {
        currentDelayHandle.unblock();
        currentDelayHandle = null;
      }
      videoFrameIterator = null;
    },
    getVideoFrameIterator: () => videoFrameIterator,
    drawFrame,
    redrawCurrentFrame,
    getFramesRendered: () => framesRendered
  };
};

class MediaPlayer {
  tagType;
  canvas;
  context;
  src;
  logLevel;
  playbackRate;
  globalPlaybackRate;
  audioStreamIndex;
  sharedAudioContext;
  audioIteratorManager = null;
  videoIteratorManager = null;
  playing = false;
  loop = false;
  fps;
  trimBefore;
  trimAfter;
  sequenceDurationInFrames;
  sequenceOffset;
  totalDuration;
  debugOverlay = false;
  nonceManager;
  onVideoFrameCallback = null;
  getEffects;
  getEffectChainState;
  initializationPromise = null;
  premountAwareDelayPlayback;
  seekPromiseChain = Promise.resolve();
  constructor({
    canvas,
    src,
    logLevel,
    sharedAudioContext,
    loop,
    trimBefore,
    trimAfter,
    playbackRate,
    globalPlaybackRate,
    audioStreamIndex,
    fps,
    debugOverlay,
    bufferState,
    isPremounting,
    isPostmounting,
    durationInFrames,
    onVideoFrameCallback,
    playing,
    sequenceOffset,
    credentials,
    requestInit,
    tagType,
    getEffects,
    getEffectChainState
  }) {
    this.canvas = canvas ?? null;
    this.src = src;
    this.logLevel = logLevel;
    this.sharedAudioContext = sharedAudioContext;
    this.playbackRate = playbackRate;
    this.globalPlaybackRate = globalPlaybackRate;
    this.loop = loop;
    this.trimBefore = trimBefore;
    this.trimAfter = trimAfter;
    this.audioStreamIndex = audioStreamIndex;
    this.fps = fps;
    this.debugOverlay = debugOverlay;
    this.premountAwareDelayPlayback = new PremountAwareDelayPlayback({
      bufferState,
      isPremounting,
      isPostmounting
    });
    this.sequenceDurationInFrames = durationInFrames;
    this.nonceManager = makeNonceManager();
    this.onVideoFrameCallback = onVideoFrameCallback;
    this.playing = playing;
    this.sequenceOffset = sequenceOffset;
    const resolvedRequestInit = resolveRequestInit({ credentials, requestInit });
    this.input = new Input({
      source: new UrlSource(this.src, resolvedRequestInit ? {
        requestInit: resolvedRequestInit
      } : undefined),
      formats: ALL_FORMATS
    });
    this.tagType = tagType;
    this.getEffects = getEffects;
    this.getEffectChainState = getEffectChainState;
    if (canvas) {
      const context = canvas.getContext("2d", {
        alpha: true,
        desynchronized: true
      });
      if (!context) {
        throw new Error("Could not get 2D context from canvas");
      }
      this.context = context;
    } else {
      this.context = null;
    }
  }
  input;
  isDisposalError() {
    return this.input.disposed === true;
  }
  initialize(startTimeUnresolved, initialMuted) {
    const promise = this._initialize(startTimeUnresolved, initialMuted);
    this.initializationPromise = promise;
    this.seekPromiseChain = promise;
    return promise;
  }
  getStartTime() {
    return (this.trimBefore ?? 0) / this.fps;
  }
  getSequenceEndTimestamp() {
    return this.sequenceDurationInFrames / this.fps * this.playbackRate + this.getStartTime();
  }
  getSequenceDurationInSeconds() {
    return this.sequenceDurationInFrames / this.fps;
  }
  getMediaEndTimestamp() {
    return calculateEndTime({
      mediaDurationInSeconds: this.totalDuration,
      ifNoMediaDuration: "fail",
      src: this.src,
      trimAfter: this.trimAfter,
      trimBefore: this.trimBefore,
      fps: this.fps
    });
  }
  getLoopSegmentMediaEndTimestamp() {
    return Math.min(this.getMediaEndTimestamp(), this.getSequenceEndTimestamp());
  }
  async _initialize(startTimeUnresolved, initialMuted) {
    let __stack = [];
    try {
      const _ = __using(__stack, this.delayPlaybackHandleIfNotPremounting(), 0);
      try {
        if (this.input.disposed) {
          return { type: "disposed" };
        }
        try {
          await this.input.getFormat();
        } catch (error) {
          if (this.isDisposalError()) {
            return { type: "disposed" };
          }
          const err = error;
          if (isNetworkError(err)) {
            throw error;
          }
          Internals5.Log.error({ logLevel: this.logLevel, tag: "@remotion/media" }, `[MediaPlayer] Failed to recognize format for ${this.src}`, error);
          return { type: "unknown-container-format" };
        }
        const [durationInSeconds, videoTrack, audioTracks] = await Promise.all([
          getDurationOrCompute(this.input),
          this.input.getPrimaryVideoTrack(),
          this.input.getAudioTracks()
        ]);
        if (this.input.disposed) {
          return { type: "disposed" };
        }
        this.totalDuration = durationInSeconds;
        const audioTrack = await resolveAudioTrack({
          videoTrack,
          audioTracks,
          audioStreamIndex: this.audioStreamIndex
        });
        if (!videoTrack && !audioTrack) {
          return { type: "no-tracks" };
        }
        if (videoTrack && this.tagType === "video") {
          if (await videoTrack.isLive()) {
            throw new Error("Live streams are not currently supported by Remotion. Sorry! Source: " + this.src);
          }
          if (await videoTrack.isRelativeToUnixEpoch()) {
            throw new Error("Streams with UNIX timestamps are not currently supported by Remotion. Sorry! Source: " + this.src);
          }
          const canDecode2 = await videoTrack.canDecode();
          if (!canDecode2) {
            return { type: "cannot-decode" };
          }
          if (this.input.disposed) {
            return { type: "disposed" };
          }
          this.videoIteratorManager = await videoIteratorManager({
            videoTrack,
            delayPlaybackHandleIfNotPremounting: this.delayPlaybackHandleIfNotPremounting,
            context: this.context,
            canvas: this.canvas,
            getOnVideoFrameCallback: () => this.onVideoFrameCallback,
            logLevel: this.logLevel,
            drawDebugOverlay: this.drawDebugOverlay,
            getLoopSegmentMediaEndTimestamp: () => this.getLoopSegmentMediaEndTimestamp(),
            getStartTime: () => this.getStartTime(),
            getIsLooping: () => this.loop,
            getEffects: this.getEffects,
            getEffectChainState: this.getEffectChainState
          });
        }
        const startTime = this.getTrimmedTime(startTimeUnresolved);
        if (startTime === null) {
          throw new Error(`should have asserted that the time is not null`);
        }
        if (audioTrack && this.sharedAudioContext) {
          if (await audioTrack.isLive()) {
            throw new Error("Live streams are not currently supported by Remotion. Sorry! Source: " + this.src);
          }
          if (await audioTrack.isRelativeToUnixEpoch()) {
            throw new Error("Streams with UNIX timestamps are not currently supported by Remotion. Sorry! Source: " + this.src);
          }
          const canDecode2 = await audioTrack.canDecode();
          if (!canDecode2) {
            return { type: "cannot-decode" };
          }
          if (this.input.disposed) {
            return { type: "disposed" };
          }
          this.audioIteratorManager = audioIteratorManager({
            audioTrack,
            delayPlaybackHandleIfNotPremounting: this.delayPlaybackHandleIfNotPremounting,
            sharedAudioContext: this.sharedAudioContext,
            getMediaEndTimestamp: () => this.getMediaEndTimestamp(),
            getSequenceEndTimestamp: () => this.getSequenceEndTimestamp(),
            getStartTime: () => this.getStartTime(),
            initialMuted,
            drawDebugOverlay: this.drawDebugOverlay,
            initialPlaybackRate: this.playbackRate * this.globalPlaybackRate,
            getSequenceDurationInSeconds: () => this.getSequenceDurationInSeconds(),
            initialTrimBefore: this.trimBefore,
            initialTrimAfter: this.trimAfter,
            initialSequenceOffset: this.sequenceOffset,
            initialSequenceDurationInFrames: this.sequenceDurationInFrames,
            initialLoop: this.loop,
            initialFps: this.fps
          });
        }
        const nonce = this.nonceManager.createAsyncOperation();
        try {
          await Promise.all([
            this.audioIteratorManager ? this.audioIteratorManager.startAudioIterator({
              nonce,
              playbackRate: this.playbackRate * this.globalPlaybackRate,
              startFromSecond: startTime,
              scheduleAudioNode: this.scheduleAudioNode,
              getTargetTime: this.getTargetTime,
              logLevel: this.logLevel,
              loop: this.loop,
              unscheduleAudioNode: this.sharedAudioContext.unscheduleAudioNode,
              getAudioContextCurrentTimeMockedInTest: () => this.sharedAudioContext.audioContext.currentTime
            }) : Promise.resolve(),
            this.videoIteratorManager ? this.videoIteratorManager.startVideoIterator(startTime, nonce) : Promise.resolve()
          ]);
        } catch (error) {
          if (this.isDisposalError()) {
            return { type: "disposed" };
          }
          Internals5.Log.error({ logLevel: this.logLevel, tag: "@remotion/media" }, "[MediaPlayer] Failed to start audio and video iterators", error);
        }
        return { type: "success", durationInSeconds };
      } catch (error) {
        const err = error;
        if (isNetworkError(err)) {
          Internals5.Log.error({ logLevel: this.logLevel, tag: "@remotion/media" }, `[MediaPlayer] Network/CORS error for ${this.src}`, err);
          return { type: "network-error" };
        }
        Internals5.Log.error({ logLevel: this.logLevel, tag: "@remotion/media" }, "[MediaPlayer] Failed to initialize", error);
        throw error;
      }
    } catch (_catch) {
      var _err = _catch, _hasErr = 1;
    } finally {
      __callDispose(__stack, _err, _hasErr);
    }
  }
  seekToWithQueue = async (newTime) => {
    const nonce = this.nonceManager.createAsyncOperation();
    await this.seekPromiseChain;
    this.seekPromiseChain = this.seekToDoNotCallDirectly(newTime, nonce);
    await this.seekPromiseChain;
  };
  async seekTo(time) {
    const newTime = this.getTrimmedTime(time);
    if (newTime === null) {
      throw new Error(`should have asserted that the time is not null`);
    }
    await this.seekToWithQueue(newTime);
  }
  async seekToDoNotCallDirectly(newTime, nonce) {
    if (nonce.isStale()) {
      return;
    }
    try {
      await Promise.all([
        this.videoIteratorManager?.seek({
          newTime,
          nonce
        }),
        this.audioIteratorManager?.seek({
          newTime,
          nonce,
          playbackRate: this.playbackRate * this.globalPlaybackRate,
          getTargetTime: this.getTargetTime,
          logLevel: this.logLevel,
          loop: this.loop,
          trimBefore: this.trimBefore,
          trimAfter: this.trimAfter,
          sequenceOffset: this.sequenceOffset,
          sequenceDurationInFrames: this.sequenceDurationInFrames,
          fps: this.fps,
          scheduleAudioNode: this.scheduleAudioNode,
          getAudioContextCurrentTimeMockedInTest: () => this.sharedAudioContext.audioContext.currentTime
        })
      ]);
    } catch (error) {
      if (this.isDisposalError()) {
        return;
      }
      throw error;
    }
  }
  play() {
    if (this.playing) {
      return;
    }
    this.playing = true;
    this.drawDebugOverlay();
  }
  delayPlaybackHandleIfNotPremounting = () => {
    return this.premountAwareDelayPlayback.createHandle();
  };
  pause() {
    if (!this.playing) {
      return;
    }
    this.playing = false;
    this.drawDebugOverlay();
  }
  setMuted(muted) {
    this.audioIteratorManager?.setMuted(muted);
  }
  setVolume(volume) {
    if (!this.audioIteratorManager) {
      return;
    }
    this.audioIteratorManager.setVolume(volume);
  }
  getTrimmedTime(unloopedTimeInSeconds) {
    return getTimeInSeconds({
      unloopedTimeInSeconds,
      playbackRate: this.playbackRate,
      loop: this.loop,
      trimBefore: this.trimBefore,
      trimAfter: this.trimAfter,
      mediaDurationInSeconds: this.totalDuration ?? null,
      fps: this.fps,
      ifNoMediaDuration: "infinity",
      src: this.src
    });
  }
  async setTrimBefore(trimBefore, unloopedTimeInSeconds) {
    if (this.trimBefore !== trimBefore) {
      this.trimBefore = trimBefore;
      this.audioIteratorManager?.destroyIterator();
      await this.seekTo(unloopedTimeInSeconds);
    }
  }
  async setTrimAfter(trimAfter, unloopedTimeInSeconds) {
    if (this.trimAfter !== trimAfter) {
      this.trimAfter = trimAfter;
      this.audioIteratorManager?.destroyIterator();
      await this.seekTo(unloopedTimeInSeconds);
    }
  }
  setDebugOverlay(debugOverlay) {
    this.debugOverlay = debugOverlay;
  }
  async setPlaybackRate(rate, unloopedTimeInSeconds) {
    const previousRate = this.playbackRate;
    if (previousRate !== rate) {
      this.playbackRate = rate;
      this.audioIteratorManager?.destroyIterator();
      await this.seekTo(unloopedTimeInSeconds);
    }
  }
  async setGlobalPlaybackRate(rate, unloopedTimeInSeconds) {
    const previousRate = this.globalPlaybackRate;
    if (previousRate !== rate) {
      this.globalPlaybackRate = rate;
      this.audioIteratorManager?.destroyIterator();
      await this.seekTo(unloopedTimeInSeconds);
    }
  }
  async setFps(fps, unloopedTimeInSeconds) {
    const previousFps = this.fps;
    if (previousFps !== fps) {
      this.fps = fps;
      this.audioIteratorManager?.destroyIterator();
      await this.seekTo(unloopedTimeInSeconds);
    }
  }
  setIsPremounting(isPremounting) {
    this.premountAwareDelayPlayback.setIsPremounting(isPremounting);
  }
  setIsPostmounting(isPostmounting) {
    this.premountAwareDelayPlayback.setIsPostmounting(isPostmounting);
  }
  async setLoop(loop, unloopedTimeInSeconds) {
    const previousLoop = this.loop;
    if (previousLoop !== loop) {
      this.loop = loop;
      this.audioIteratorManager?.destroyIterator();
      await this.seekTo(unloopedTimeInSeconds);
    }
  }
  async setSequenceOffset(offset, unloopedTimeInSeconds) {
    const previousOffset = this.sequenceOffset;
    if (previousOffset !== offset) {
      this.sequenceOffset = offset;
      this.audioIteratorManager?.destroyIterator();
      await this.seekTo(unloopedTimeInSeconds);
    }
  }
  async setSequenceDurationInFrames(sequenceDurationInFrames, unloopedTimeInSeconds) {
    const previousDuration = this.sequenceDurationInFrames;
    if (previousDuration !== sequenceDurationInFrames) {
      this.sequenceDurationInFrames = sequenceDurationInFrames;
      await this.seekTo(unloopedTimeInSeconds);
    }
  }
  async dispose() {
    if (this.initializationPromise) {
      try {
        await this.initializationPromise;
      } catch {}
    }
    this.nonceManager.createAsyncOperation();
    this.videoIteratorManager?.destroy();
    this.audioIteratorManager?.destroyIterator();
    this.input.dispose();
  }
  getTargetTime = (mediaTimestamp, currentTime) => {
    if (!this.sharedAudioContext) {
      throw new Error("Shared audio context not found");
    }
    const globalTime = (currentTime - this.sharedAudioContext.audioSyncAnchor.value) * this.globalPlaybackRate;
    const timeInSeconds = globalTime - this.sequenceOffset;
    const localTime = this.getTrimmedTime(timeInSeconds);
    if (localTime === null) {
      return null;
    }
    const targetTime = (mediaTimestamp - localTime) / (this.playbackRate * this.globalPlaybackRate);
    return targetTime;
  };
  scheduleAudioNode = (node, mediaTimestamp, originalUnloopedMediaTimestamp) => {
    if (!this.sharedAudioContext) {
      throw new Error("Shared audio context not found");
    }
    const targetTime = this.getTargetTime(mediaTimestamp, this.sharedAudioContext.audioContext.currentTime);
    const combinedPlaybackRate = this.playbackRate * this.globalPlaybackRate;
    if (targetTime === null) {
      return {
        type: "not-started",
        reason: "no target for" + mediaTimestamp.toFixed(3) + "," + this.sharedAudioContext.audioContext.currentTime.toFixed(3)
      };
    }
    const sequenceStartTime = this.getStartTime();
    const loopSegmentMediaEndTimestamp = this.getLoopSegmentMediaEndTimestamp();
    const offset = getTrimStartForAudioNode({
      mediaTimestamp,
      targetTime,
      sequenceStartTime,
      combinedPlaybackRate
    });
    const duration = getDurationOfNode({
      bufferDuration: node.buffer?.duration ?? 0,
      loopSegmentMediaEndTimestamp,
      offset,
      originalUnloopedMediaTimestamp
    });
    const scheduledTime = getScheduledTime({
      mediaTimestamp,
      targetTime,
      sequenceStartTime,
      currentTime: this.sharedAudioContext.audioContext.currentTime
    });
    return this.sharedAudioContext.scheduleAudioNode({
      node,
      mediaTimestamp,
      scheduledTime,
      duration,
      offset,
      originalUnloopedMediaTimestamp
    });
  };
  setVideoFrameCallback(callback) {
    this.onVideoFrameCallback = callback;
  }
  async redrawVideoEffects() {
    await this.videoIteratorManager?.redrawCurrentFrame();
  }
  drawDebugOverlay = () => {
    if (!this.debugOverlay)
      return;
    if (this.context && this.canvas) {
      drawPreviewOverlay({
        context: this.context,
        audioTime: this.sharedAudioContext?.audioContext.currentTime ?? null,
        audioContextState: this.sharedAudioContext?.audioContext.state ?? null,
        audioSyncAnchor: this.sharedAudioContext?.audioSyncAnchor ?? null,
        audioIteratorManager: this.audioIteratorManager,
        playing: this.playing,
        videoIteratorManager: this.videoIteratorManager,
        playbackRate: this.playbackRate * this.globalPlaybackRate
      });
    }
  };
  audioSyncAnchorChanged = () => {
    if (!this.audioIteratorManager) {
      return;
    }
    this.audioIteratorManager.destroyIterator();
  };
}
var callOnErrorAndResolve = ({
  onError,
  error,
  disallowFallback,
  isClientSideRendering,
  clientSideError
}) => {
  const result = onError?.(error);
  if (isClientSideRendering) {
    return ["fail", clientSideError];
  }
  if (result) {
    return [result, error];
  }
  if (disallowFallback) {
    return ["fail", error];
  }
  return ["fallback", error];
};
var useCommonEffects = ({
  mediaPlayerRef,
  mediaPlayerReady,
  currentTimeRef,
  playing,
  isPlayerBuffering,
  frame,
  trimBefore,
  trimAfter,
  effectiveMuted,
  userPreferredVolume,
  playbackRate,
  globalPlaybackRate,
  fps,
  sequenceOffset,
  loop,
  durationInFrames,
  isPremounting,
  isPostmounting,
  currentTime,
  logLevel,
  label
}) => {
  const sharedAudioContext = useContext(Internals6.SharedAudioContext);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer)
      return;
    if (playing && !isPlayerBuffering) {
      mediaPlayer.play();
    } else {
      mediaPlayer.pause();
    }
  }, [
    isPlayerBuffering,
    playing,
    logLevel,
    mediaPlayerReady,
    frame,
    mediaPlayerRef
  ]);
  useLayoutEffect(() => {
    if (!sharedAudioContext)
      return;
    const { remove } = sharedAudioContext.audioSyncAnchorEmitter.subscribe((event) => {
      if (event === "changed") {
        mediaPlayerRef.current?.audioSyncAnchorChanged();
      }
    });
    return () => {
      remove();
    };
  }, [sharedAudioContext, mediaPlayerRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setTrimBefore(trimBefore, currentTimeRef.current);
  }, [trimBefore, mediaPlayerReady, mediaPlayerRef, currentTimeRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setTrimAfter(trimAfter, currentTimeRef.current);
  }, [trimAfter, mediaPlayerReady, mediaPlayerRef, currentTimeRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady)
      return;
    mediaPlayer.setMuted(effectiveMuted);
  }, [effectiveMuted, mediaPlayerReady, mediaPlayerRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setVolume(userPreferredVolume);
  }, [userPreferredVolume, mediaPlayerReady, mediaPlayerRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setPlaybackRate(playbackRate, currentTimeRef.current);
  }, [playbackRate, mediaPlayerReady, mediaPlayerRef, currentTimeRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setGlobalPlaybackRate(globalPlaybackRate, currentTimeRef.current);
  }, [globalPlaybackRate, mediaPlayerReady, mediaPlayerRef, currentTimeRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setLoop(loop, currentTimeRef.current);
  }, [loop, mediaPlayerReady, mediaPlayerRef, currentTimeRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setSequenceDurationInFrames(durationInFrames, currentTimeRef.current);
  }, [durationInFrames, mediaPlayerReady, mediaPlayerRef, currentTimeRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer) {
      return;
    }
    mediaPlayer.setIsPremounting(isPremounting);
  }, [isPremounting, mediaPlayerReady, mediaPlayerRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer) {
      return;
    }
    mediaPlayer.setIsPostmounting(isPostmounting);
  }, [isPostmounting, mediaPlayerReady, mediaPlayerRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setFps(fps, currentTimeRef.current);
  }, [fps, mediaPlayerReady, mediaPlayerRef, currentTimeRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setSequenceOffset(sequenceOffset, currentTimeRef.current);
  }, [sequenceOffset, mediaPlayerReady, mediaPlayerRef, currentTimeRef]);
  useLayoutEffect(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady)
      return;
    mediaPlayer.seekTo(currentTime).catch(() => {});
    Internals6.Log.trace({ logLevel, tag: "@remotion/media" }, `[${label}] Updating target time to ${currentTime.toFixed(3)}s`);
  }, [currentTime, logLevel, mediaPlayerReady, label, mediaPlayerRef]);
};
var {
  useUnsafeVideoConfig,
  Timeline,
  SharedAudioContext,
  usePlayerMutedState,
  useMediaVolumeState,
  useFrameForVolumeProp,
  evaluateVolume,
  warnAboutTooHighVolume,
  usePreload,
  SequenceContext
} = Internals7;
var AudioForPreviewAssertedShowing = ({
  src,
  playbackRate,
  logLevel,
  muted,
  volume,
  loopVolumeCurveBehavior,
  loop,
  trimAfter,
  trimBefore,
  name,
  showInTimeline,
  stack,
  disallowFallbackToHtml5Audio,
  toneFrequency,
  audioStreamIndex,
  fallbackHtml5AudioProps,
  onError,
  credentials,
  requestInit,
  setMediaDurationInSeconds
}) => {
  const videoConfig = useUnsafeVideoConfig();
  const frame = useCurrentFrame();
  const mediaPlayerRef = useRef(null);
  const initialTrimBeforeRef = useRef(trimBefore);
  const initialTrimAfterRef = useRef(trimAfter);
  const [initialRequestInit] = useState(requestInit);
  const [mediaPlayerReady, setMediaPlayerReady] = useState(false);
  const [shouldFallbackToNativeAudio, setShouldFallbackToNativeAudio] = useState(false);
  const [playing] = Timeline.usePlayingState();
  const { playbackRate: globalPlaybackRate } = Internals7.usePlaybackRate();
  const sharedAudioContext = useContext2(SharedAudioContext);
  const buffer = useBufferState();
  const [playerMuted] = usePlayerMutedState();
  const [mediaVolume] = useMediaVolumeState();
  const volumePropFrame = useFrameForVolumeProp(loopVolumeCurveBehavior ?? "repeat");
  const userPreferredVolume = evaluateVolume({
    frame: volumePropFrame,
    volume,
    mediaVolume
  });
  warnAboutTooHighVolume(userPreferredVolume);
  if (!videoConfig) {
    throw new Error("No video config found");
  }
  if (!src) {
    throw new TypeError("No `src` was passed to <NewAudioForPreview>.");
  }
  const currentTime = frame / videoConfig.fps;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const preloadedSrc = usePreload(src);
  const parentSequence = useContext2(SequenceContext);
  const isPremounting = Boolean(parentSequence?.premounting);
  const isPostmounting = Boolean(parentSequence?.postmounting);
  const sequenceOffset = (parentSequence?.absoluteFrom ?? 0) / videoConfig.fps;
  const bufferingContext = useContext2(Internals7.BufferingContextReact);
  if (!bufferingContext) {
    throw new Error("useMediaPlayback must be used inside a <BufferingContext>");
  }
  const effectiveMuted = muted || playerMuted || userPreferredVolume <= 0;
  const isPlayerBuffering = Internals7.useIsPlayerBuffering(bufferingContext);
  const initialPlaying = useRef(playing && !isPlayerBuffering);
  const initialIsPremounting = useRef(isPremounting);
  const initialIsPostmounting = useRef(isPostmounting);
  const initialGlobalPlaybackRate = useRef(globalPlaybackRate);
  const initialPlaybackRate = useRef(playbackRate);
  const initialMuted = useRef(effectiveMuted);
  const initialDurationInFrames = useRef(videoConfig.durationInFrames);
  const initialSequenceOffset = useRef(sequenceOffset);
  useCommonEffects({
    mediaPlayerRef,
    mediaPlayerReady,
    currentTimeRef,
    playing,
    isPlayerBuffering,
    frame,
    trimBefore,
    trimAfter,
    effectiveMuted,
    userPreferredVolume,
    playbackRate,
    globalPlaybackRate,
    fps: videoConfig.fps,
    sequenceOffset,
    loop,
    durationInFrames: videoConfig.durationInFrames,
    isPremounting,
    isPostmounting,
    currentTime,
    logLevel,
    label: "AudioForPreview"
  });
  useEffect(() => {
    if (!sharedAudioContext)
      return;
    if (!sharedAudioContext.audioContext)
      return;
    const {
      audioContext,
      gainNode,
      audioSyncAnchor,
      scheduleAudioNode,
      unscheduleAudioNode
    } = sharedAudioContext;
    if (!gainNode) {
      return;
    }
    try {
      const player = new MediaPlayer({
        src: preloadedSrc,
        logLevel,
        sharedAudioContext: {
          audioContext,
          gainNode,
          audioSyncAnchor,
          scheduleAudioNode,
          unscheduleAudioNode
        },
        loop,
        trimAfter: initialTrimAfterRef.current,
        trimBefore: initialTrimBeforeRef.current,
        fps: videoConfig.fps,
        canvas: null,
        playbackRate: initialPlaybackRate.current,
        audioStreamIndex: audioStreamIndex ?? null,
        debugOverlay: false,
        bufferState: buffer,
        isPostmounting: initialIsPostmounting.current,
        isPremounting: initialIsPremounting.current,
        globalPlaybackRate: initialGlobalPlaybackRate.current,
        durationInFrames: initialDurationInFrames.current,
        onVideoFrameCallback: null,
        playing: initialPlaying.current,
        sequenceOffset: initialSequenceOffset.current,
        credentials,
        requestInit: initialRequestInit,
        tagType: "audio",
        getEffects: () => [],
        getEffectChainState: () => null
      });
      mediaPlayerRef.current = player;
      player.initialize(currentTimeRef.current, initialMuted.current).then((result) => {
        if (result.type === "disposed") {
          return;
        }
        const handleError = (error, fallbackMessage) => {
          const [action, errorToUse] = callOnErrorAndResolve({
            onError,
            error,
            disallowFallback: disallowFallbackToHtml5Audio,
            isClientSideRendering: false,
            clientSideError: error
          });
          if (action === "fail") {
            throw errorToUse;
          } else {
            Internals7.Log.warn({ logLevel, tag: "@remotion/media" }, fallbackMessage);
            setShouldFallbackToNativeAudio(true);
          }
        };
        if (result.type === "unknown-container-format") {
          handleError(new Error(`Unknown container format ${preloadedSrc}.`), `Unknown container format for ${preloadedSrc} (Supported formats: https://www.remotion.dev/docs/mediabunny/formats), falling back to <Html5Audio>`);
          return;
        }
        if (result.type === "network-error") {
          handleError(new Error(`Network error fetching ${preloadedSrc}.`), `Network error fetching ${preloadedSrc}, falling back to <Html5Audio>`);
          return;
        }
        if (result.type === "cannot-decode") {
          handleError(new Error(`Cannot decode ${preloadedSrc}.`), `Cannot decode ${preloadedSrc}, falling back to <Html5Audio>`);
          return;
        }
        if (result.type === "no-tracks") {
          handleError(new Error(`No video or audio tracks found for ${preloadedSrc}.`), `No video or audio tracks found for ${preloadedSrc}, falling back to <Html5Audio>`);
          return;
        }
        if (result.type === "success") {
          setMediaPlayerReady(true);
          setMediaDurationInSeconds(result.durationInSeconds);
          Internals7.Log.trace({ logLevel, tag: "@remotion/media" }, `[AudioForPreview] MediaPlayer initialized successfully`);
        }
      }).catch((error) => {
        const [action, errorToUse] = callOnErrorAndResolve({
          onError,
          error,
          disallowFallback: disallowFallbackToHtml5Audio,
          isClientSideRendering: false,
          clientSideError: error
        });
        if (action === "fail") {
          throw errorToUse;
        } else {
          Internals7.Log.error({ logLevel, tag: "@remotion/media" }, "[AudioForPreview] Failed to initialize MediaPlayer", error);
          setShouldFallbackToNativeAudio(true);
        }
      });
    } catch (error) {
      const [action, errorToUse] = callOnErrorAndResolve({
        error,
        onError,
        disallowFallback: disallowFallbackToHtml5Audio,
        isClientSideRendering: false,
        clientSideError: error
      });
      if (action === "fail") {
        throw errorToUse;
      }
      Internals7.Log.error({ logLevel, tag: "@remotion/media" }, "[AudioForPreview] MediaPlayer initialization failed", errorToUse);
      setShouldFallbackToNativeAudio(true);
    }
    return () => {
      if (mediaPlayerRef.current) {
        Internals7.Log.trace({ logLevel, tag: "@remotion/media" }, `[AudioForPreview] Disposing MediaPlayer`);
        mediaPlayerRef.current.dispose();
        mediaPlayerRef.current = null;
      }
      setMediaPlayerReady(false);
      setShouldFallbackToNativeAudio(false);
    };
  }, [
    preloadedSrc,
    logLevel,
    sharedAudioContext,
    loop,
    videoConfig.fps,
    audioStreamIndex,
    disallowFallbackToHtml5Audio,
    buffer,
    onError,
    credentials,
    initialRequestInit,
    setMediaDurationInSeconds
  ]);
  if (shouldFallbackToNativeAudio && !disallowFallbackToHtml5Audio) {
    return /* @__PURE__ */ jsx(RemotionAudio, {
      src,
      muted,
      volume,
      startFrom: trimBefore,
      endAt: trimAfter,
      playbackRate,
      loopVolumeCurveBehavior,
      name,
      loop,
      showInTimeline,
      stack: stack ?? undefined,
      toneFrequency,
      audioStreamIndex,
      pauseWhenBuffering: fallbackHtml5AudioProps?.pauseWhenBuffering,
      crossOrigin: fallbackHtml5AudioProps?.crossOrigin,
      ...fallbackHtml5AudioProps
    });
  }
  return null;
};
var AudioForPreview = ({
  loop = false,
  src,
  logLevel,
  muted,
  name,
  volume,
  loopVolumeCurveBehavior,
  playbackRate = 1,
  trimAfter,
  trimBefore,
  showInTimeline,
  stack,
  disallowFallbackToHtml5Audio,
  toneFrequency,
  audioStreamIndex,
  fallbackHtml5AudioProps,
  onError,
  credentials,
  requestInit,
  setMediaDurationInSeconds
}) => {
  const preloadedSrc = usePreload(src);
  const defaultLogLevel = Internals7.useLogLevel();
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const currentTime = frame / videoConfig.fps;
  const showShow = useMemo(() => {
    return getTimeInSeconds({
      unloopedTimeInSeconds: currentTime,
      playbackRate,
      loop,
      trimBefore,
      trimAfter,
      mediaDurationInSeconds: Infinity,
      fps: videoConfig.fps,
      ifNoMediaDuration: "infinity",
      src
    }) !== null;
  }, [
    currentTime,
    playbackRate,
    src,
    trimAfter,
    trimBefore,
    videoConfig.fps,
    loop
  ]);
  if (!showShow) {
    return null;
  }
  if (!setMediaDurationInSeconds) {
    throw new Error("setMediaDurationInSeconds is required");
  }
  return /* @__PURE__ */ jsx(AudioForPreviewAssertedShowing, {
    audioStreamIndex,
    src: preloadedSrc,
    playbackRate,
    logLevel: logLevel ?? defaultLogLevel,
    muted: muted ?? false,
    volume: volume ?? 1,
    loopVolumeCurveBehavior: loopVolumeCurveBehavior ?? "repeat",
    loop,
    trimAfter,
    trimBefore,
    name,
    showInTimeline: showInTimeline ?? true,
    stack,
    disallowFallbackToHtml5Audio: disallowFallbackToHtml5Audio ?? false,
    toneFrequency,
    onError,
    credentials,
    requestInit,
    fallbackHtml5AudioProps,
    setMediaDurationInSeconds
  });
};
var makeAudioCache = () => {
  const timestamps = [];
  const samples = {};
  const addFrame = (sample) => {
    timestamps.push(sample.timestamp);
    samples[sample.timestamp] = sample;
  };
  const clearBeforeThreshold = (threshold) => {
    for (const timestamp of timestamps.slice()) {
      const endTimestamp = timestamp + samples[timestamp].duration;
      if (endTimestamp < threshold) {
        const isLast = timestamp === timestamps[timestamps.length - 1];
        if (isLast) {
          continue;
        }
        samples[timestamp].close();
        delete samples[timestamp];
        timestamps.splice(timestamps.indexOf(timestamp), 1);
      }
    }
  };
  const deleteAll = () => {
    for (const timestamp of timestamps) {
      samples[timestamp].close();
      delete samples[timestamp];
    }
    timestamps.length = 0;
  };
  const getSamples = (timestamp, durationInSeconds) => {
    const selected = [];
    for (let i = 0;i < timestamps.length; i++) {
      const sampleTimestamp = timestamps[i];
      const sample = samples[sampleTimestamp];
      if (sample.timestamp + sample.duration - 0.0000000001 <= timestamp) {
        continue;
      }
      if (sample.timestamp >= timestamp + durationInSeconds - 0.0000000001) {
        break;
      }
      selected.push(sample);
    }
    return selected;
  };
  const getOpenTimestamps = () => {
    return timestamps;
  };
  const getOldestTimestamp = () => {
    return timestamps[0];
  };
  const getNewestTimestamp = () => {
    if (timestamps.length === 0) {
      return null;
    }
    const sample = samples[timestamps[timestamps.length - 1]];
    return sample.timestamp + sample.duration;
  };
  return {
    addFrame,
    clearBeforeThreshold,
    deleteAll,
    getSamples,
    getOldestTimestamp,
    getNewestTimestamp,
    getOpenTimestamps
  };
};
var EXTRA_THRESHOLD_IN_SECONDS = 1.5;
var safetyOutOfOrderThreshold = 0.2;
var warned = {};
var warnAboutMatroskaOnce = (src, logLevel) => {
  if (warned[src]) {
    return;
  }
  warned[src] = true;
  Internals8.Log.warn({ logLevel, tag: "@remotion/media" }, `Audio from ${src} will need to be read from the beginning. https://www.remotion.dev/docs/media/support#matroska-limitation`);
};
var makeAudioIterator2 = ({
  audioSampleSink,
  isMatroska,
  startTimestamp,
  src,
  actualMatroskaTimestamps,
  logLevel
}) => {
  const sampleIterator = audioSampleSink.samples(isMatroska ? 0 : Math.max(0, startTimestamp - EXTRA_THRESHOLD_IN_SECONDS));
  if (isMatroska) {
    warnAboutMatroskaOnce(src, logLevel);
  }
  let fullDuration = null;
  const cache = makeAudioCache();
  let lastUsed = Date.now();
  const getNextSample = async () => {
    lastUsed = Date.now();
    const { value: sample, done } = await sampleIterator.next();
    if (done) {
      fullDuration = cache.getNewestTimestamp();
      return null;
    }
    const realTimestamp = actualMatroskaTimestamps.getRealTimestamp(sample.timestamp);
    if (realTimestamp !== null && realTimestamp !== sample.timestamp) {
      sample.setTimestamp(realTimestamp);
    }
    actualMatroskaTimestamps.observeTimestamp(sample.timestamp);
    actualMatroskaTimestamps.observeTimestamp(sample.timestamp + sample.duration);
    cache.addFrame(sample);
    return sample;
  };
  const getSamples = async (timestamp, durationInSeconds) => {
    lastUsed = Date.now();
    if (fullDuration !== null && timestamp > fullDuration) {
      cache.clearBeforeThreshold(fullDuration - safetyOutOfOrderThreshold);
      return [];
    }
    const samples = cache.getSamples(timestamp, durationInSeconds);
    const newestTimestamp = cache.getNewestTimestamp();
    if (newestTimestamp !== null) {
      if (newestTimestamp >= timestamp + durationInSeconds - 0.0000000001) {
        return samples;
      }
    }
    while (true) {
      const sample = await getNextSample();
      const deleteBefore = fullDuration === null ? timestamp : Math.min(timestamp, fullDuration);
      cache.clearBeforeThreshold(deleteBefore - safetyOutOfOrderThreshold);
      if (sample === null) {
        break;
      }
      if (sample.timestamp + sample.duration - 0.0000000001 <= timestamp) {
        continue;
      }
      if (sample.timestamp >= timestamp + durationInSeconds - 0.0000000001) {
        break;
      }
      samples.push(sample);
    }
    return samples;
  };
  const logOpenFrames = () => {
    const openTimestamps = cache.getOpenTimestamps();
    if (openTimestamps.length > 0) {
      const first = openTimestamps[0];
      const last2 = openTimestamps[openTimestamps.length - 1];
      Internals8.Log.verbose({ logLevel, tag: "@remotion/media" }, "Open audio samples for src", src, `${first.toFixed(3)}...${last2.toFixed(3)}`);
    }
  };
  const getCacheStats = () => {
    return {
      count: cache.getOpenTimestamps().length,
      size: cache.getOpenTimestamps().reduce((acc, t) => acc + t, 0)
    };
  };
  const canSatisfyRequestedTime = (timestamp) => {
    const oldestTimestamp = cache.getOldestTimestamp() ?? startTimestamp;
    if (fullDuration !== null && timestamp > fullDuration) {
      return true;
    }
    return oldestTimestamp < timestamp && Math.abs(oldestTimestamp - timestamp) < 10;
  };
  const prepareForDeletion = () => {
    cache.deleteAll();
    sampleIterator.return().then((value) => {
      if (value.value) {
        value.value.close();
      }
    });
    fullDuration = null;
  };
  let op = Promise.resolve([]);
  return {
    src,
    getSamples: (ts, dur) => {
      op = op.then(() => getSamples(ts, dur));
      return op;
    },
    waitForCompletion: async () => {
      await op;
      return true;
    },
    canSatisfyRequestedTime,
    logOpenFrames,
    getCacheStats,
    getLastUsed: () => lastUsed,
    prepareForDeletion,
    startTimestamp,
    clearBeforeThreshold: cache.clearBeforeThreshold,
    getOldestTimestamp: cache.getOldestTimestamp,
    getNewestTimestamp: cache.getNewestTimestamp
  };
};
var makeAudioManager = () => {
  const iterators = [];
  const makeIterator = ({
    timeInSeconds,
    src,
    audioSampleSink,
    isMatroska,
    actualMatroskaTimestamps,
    logLevel
  }) => {
    const iterator = makeAudioIterator2({
      audioSampleSink,
      isMatroska,
      startTimestamp: timeInSeconds,
      src,
      actualMatroskaTimestamps,
      logLevel
    });
    iterators.push(iterator);
    return iterator;
  };
  const getIteratorMostInThePast = () => {
    let mostInThePast = null;
    let mostInThePastIterator = null;
    for (const iterator of iterators) {
      const lastUsed = iterator.getLastUsed();
      if (mostInThePast === null || lastUsed < mostInThePast) {
        mostInThePast = lastUsed;
        mostInThePastIterator = iterator;
      }
    }
    return mostInThePastIterator;
  };
  const deleteOldestIterator = () => {
    const iterator = getIteratorMostInThePast();
    if (iterator) {
      iterator.prepareForDeletion();
      iterators.splice(iterators.indexOf(iterator), 1);
    }
  };
  const deleteDuplicateIterators = (logLevel) => {
    const seenKeys = new Set;
    for (let i = 0;i < iterators.length; i++) {
      const iterator = iterators[i];
      const key = `${iterator.src}-${iterator.getOldestTimestamp()}-${iterator.getNewestTimestamp()}`;
      if (seenKeys.has(key)) {
        iterator.prepareForDeletion();
        iterators.splice(iterators.indexOf(iterator), 1);
        Internals9.Log.verbose({ logLevel, tag: "@remotion/media" }, `Deleted duplicate iterator for ${iterator.src}`);
      }
      seenKeys.add(key);
    }
  };
  const getIterator = async ({
    src,
    timeInSeconds,
    audioSampleSink,
    isMatroska,
    actualMatroskaTimestamps,
    logLevel,
    maxCacheSize
  }) => {
    let attempts = 0;
    const maxAttempts = 3;
    while ((await getTotalCacheStats()).totalSize > maxCacheSize && attempts < maxAttempts) {
      deleteOldestIterator();
      attempts++;
    }
    if ((await getTotalCacheStats()).totalSize > maxCacheSize && attempts >= maxAttempts) {
      Internals9.Log.warn({ logLevel, tag: "@remotion/media" }, `Audio cache: Exceeded max cache size after ${maxAttempts} attempts. Still ${(await getTotalCacheStats()).totalSize} bytes used, target was ${maxCacheSize} bytes.`);
    }
    for (const iterator of iterators) {
      if (iterator.src === src && await iterator.waitForCompletion() && iterator.canSatisfyRequestedTime(timeInSeconds)) {
        return iterator;
      }
    }
    for (let i = 0;i < iterators.length; i++) {
      const iterator = iterators[i];
      if (iterator.src === src && iterator.startTimestamp === timeInSeconds) {
        iterator.prepareForDeletion();
        iterators.splice(iterators.indexOf(iterator), 1);
      }
    }
    deleteDuplicateIterators(logLevel);
    return makeIterator({
      src,
      timeInSeconds,
      audioSampleSink,
      isMatroska,
      actualMatroskaTimestamps,
      logLevel
    });
  };
  const getCacheStats = () => {
    let totalCount = 0;
    let totalSize = 0;
    for (const iterator of iterators) {
      const { count, size } = iterator.getCacheStats();
      totalCount += count;
      totalSize += size;
    }
    return { count: totalCount, totalSize };
  };
  const logOpenFrames = () => {
    for (const iterator of iterators) {
      iterator.logOpenFrames();
    }
  };
  let queue = Promise.resolve(undefined);
  return {
    getIterator: ({
      src,
      timeInSeconds,
      audioSampleSink,
      isMatroska,
      actualMatroskaTimestamps,
      logLevel,
      maxCacheSize
    }) => {
      queue = queue.then(() => getIterator({
        src,
        timeInSeconds,
        audioSampleSink,
        isMatroska,
        actualMatroskaTimestamps,
        logLevel,
        maxCacheSize
      }));
      return queue;
    },
    getCacheStats,
    getIteratorMostInThePast,
    logOpenFrames,
    deleteDuplicateIterators
  };
};
var renderTimestampRange = (timestamps) => {
  if (timestamps.length === 0) {
    return "(none)";
  }
  if (timestamps.length === 1) {
    return timestamps[0].toFixed(3);
  }
  return `${timestamps[0].toFixed(3)}...${timestamps[timestamps.length - 1].toFixed(3)}`;
};
var getAllocationSize = (sample) => {
  if (sample.format === null) {
    return sample.codedHeight * sample.codedWidth * 4;
  }
  return sample.allocationSize();
};
var BIGGEST_ALLOWED_JUMP_FORWARD_SECONDS = 3;
var makeKeyframeBank = async ({
  logLevel: parentLogLevel,
  src,
  videoSampleSink,
  initialTimestampRequest
}) => {
  const sampleIterator = videoSampleSink.samples(roundTo4Digits(initialTimestampRequest));
  const frames = {};
  const frameTimestamps = [];
  let hasReachedEndOfVideo = false;
  let lastUsed = Date.now();
  let allocationSize = 0;
  const getDurationOfFrame = (timestamp) => {
    const index = frameTimestamps.indexOf(timestamp);
    if (index === -1) {
      throw new Error(`Frame ${timestamp} not found`);
    }
    const nextTimestamp = frameTimestamps[index + 1];
    if (!nextTimestamp) {
      return null;
    }
    return nextTimestamp - timestamp;
  };
  const deleteFrameAtTimestamp = (timestamp) => {
    allocationSize -= getAllocationSize(frames[timestamp]);
    frameTimestamps.splice(frameTimestamps.indexOf(timestamp), 1);
    frames[timestamp].close();
    delete frames[timestamp];
  };
  const deleteFramesBeforeTimestamp = ({
    logLevel,
    timestampInSeconds
  }) => {
    const deletedTimestamps = [];
    for (const frameTimestamp of frameTimestamps.slice()) {
      if (hasReachedEndOfVideo) {
        const isLast = frameTimestamp === frameTimestamps[frameTimestamps.length - 1];
        if (isLast) {
          continue;
        }
      }
      if (!frames[frameTimestamp]) {
        continue;
      }
      const duration = getDurationOfFrame(frameTimestamp) ?? frames[frameTimestamp].duration;
      if (frameTimestamp + duration < timestampInSeconds) {
        deleteFrameAtTimestamp(frameTimestamp);
        deletedTimestamps.push(frameTimestamp);
      }
    }
    if (deletedTimestamps.length > 0) {
      Internals10.Log.verbose({ logLevel, tag: "@remotion/media" }, `Deleted ${deletedTimestamps.length} frame${deletedTimestamps.length === 1 ? "" : "s"} ${renderTimestampRange(deletedTimestamps)} for src ${src} because it is lower than ${timestampInSeconds}. Remaining: ${renderTimestampRange(frameTimestamps)}`);
    }
  };
  const hasDecodedEnoughForTimestamp = (timestamp) => {
    const lastFrameTimestamp = frameTimestamps[frameTimestamps.length - 1];
    if (!lastFrameTimestamp) {
      return false;
    }
    const lastFrame = frames[lastFrameTimestamp];
    if (!lastFrame) {
      return true;
    }
    const duration = getDurationOfFrame(lastFrameTimestamp) ?? lastFrame.duration;
    return roundTo4Digits(lastFrameTimestamp + duration) > roundTo4Digits(timestamp);
  };
  const addFrame = (frame, logLevel) => {
    if (frames[frame.timestamp]) {
      deleteFrameAtTimestamp(frame.timestamp);
    }
    frames[frame.timestamp] = frame;
    frameTimestamps.push(frame.timestamp);
    allocationSize += getAllocationSize(frame);
    lastUsed = Date.now();
    Internals10.Log.trace({ logLevel, tag: "@remotion/media" }, `Added frame at ${frame.timestamp}sec to bank`);
  };
  const ensureEnoughFramesForTimestamp = async (timestampInSeconds, logLevel, fps) => {
    while (!hasDecodedEnoughForTimestamp(timestampInSeconds)) {
      const sample = await sampleIterator.next();
      if (sample.value) {
        addFrame(sample.value, logLevel);
      }
      if (sample.done) {
        hasReachedEndOfVideo = true;
        break;
      }
      deleteFramesBeforeTimestamp({
        logLevel: parentLogLevel,
        timestampInSeconds: timestampInSeconds - getSafeWindowOfMonotonicity(fps)
      });
    }
    lastUsed = Date.now();
  };
  const getFrameFromTimestamp = async (timestampInSeconds, fps) => {
    lastUsed = Date.now();
    let adjustedTimestamp = timestampInSeconds;
    if (hasReachedEndOfVideo && roundTo4Digits(adjustedTimestamp) > roundTo4Digits(frameTimestamps[frameTimestamps.length - 1])) {
      adjustedTimestamp = frameTimestamps[frameTimestamps.length - 1];
    }
    await ensureEnoughFramesForTimestamp(adjustedTimestamp, parentLogLevel, fps);
    for (let i = frameTimestamps.length - 1;i >= 0; i--) {
      const sample = frames[frameTimestamps[i]];
      if (!sample) {
        return null;
      }
      if (roundTo4Digits(sample.timestamp) <= roundTo4Digits(adjustedTimestamp) || Math.abs(sample.timestamp - adjustedTimestamp) <= 0.001) {
        return sample;
      }
    }
    return frames[frameTimestamps[0]] ?? null;
  };
  const hasTimestampInSecond = async (timestamp, fps) => {
    return await getFrameFromTimestamp(timestamp, fps) !== null;
  };
  const getOpenFrameCount = () => {
    return {
      size: allocationSize,
      timestamps: frameTimestamps
    };
  };
  const getLastUsed = () => {
    return lastUsed;
  };
  let queue = Promise.resolve(undefined);
  const firstFrame = await sampleIterator.next();
  if (!firstFrame.value) {
    throw new Error("No first frame found");
  }
  const startTimestampInSeconds = firstFrame.value.timestamp;
  Internals10.Log.verbose({ logLevel: parentLogLevel, tag: "@remotion/media" }, `Creating keyframe bank from ${startTimestampInSeconds}sec`);
  addFrame(firstFrame.value, parentLogLevel);
  const getRangeOfTimestamps = () => {
    if (frameTimestamps.length === 0) {
      return null;
    }
    const firstTimestamp = frameTimestamps[0];
    const lastTimestamp = frameTimestamps[frameTimestamps.length - 1];
    const lastFrame = frames[lastTimestamp];
    const lastFrameDuration = getDurationOfFrame(lastTimestamp) ?? lastFrame.duration ?? 0;
    return {
      firstTimestamp,
      lastTimestamp: lastTimestamp + lastFrameDuration
    };
  };
  const prepareForDeletion = (logLevel, reason) => {
    const range = getRangeOfTimestamps();
    if (range) {
      Internals10.Log.verbose({ logLevel, tag: "@remotion/media" }, `Preparing for deletion (${reason}) of keyframe bank from ${range?.firstTimestamp}sec to ${range?.lastTimestamp}sec`);
    }
    let framesDeleted = 0;
    for (const frameTimestamp of frameTimestamps.slice()) {
      if (!frames[frameTimestamp]) {
        continue;
      }
      deleteFrameAtTimestamp(frameTimestamp);
      framesDeleted++;
    }
    sampleIterator.return();
    frameTimestamps.length = 0;
    return { framesDeleted };
  };
  const canSatisfyTimestamp = (timestamp) => {
    if (frameTimestamps.length === 0) {
      return false;
    }
    const roundedTimestamp = roundTo4Digits(timestamp);
    const firstFrameTimestamp = roundTo4Digits(frameTimestamps[0]);
    const range = getRangeOfTimestamps();
    if (!range) {
      return false;
    }
    const lastFrameTimestamp = roundTo4Digits(frameTimestamps[frameTimestamps.length - 1]);
    const lastFrameEndTimestamp = roundTo4Digits(range.lastTimestamp);
    if (hasReachedEndOfVideo && roundedTimestamp > lastFrameTimestamp) {
      return true;
    }
    if (roundedTimestamp < firstFrameTimestamp) {
      const firstFrameIsInitialFrame = firstFrameTimestamp === startTimestampInSeconds;
      const firstFrameDoesSatisfy = firstFrameIsInitialFrame && roundedTimestamp >= initialTimestampRequest;
      return firstFrameDoesSatisfy;
    }
    if (roundedTimestamp - BIGGEST_ALLOWED_JUMP_FORWARD_SECONDS > lastFrameEndTimestamp) {
      return false;
    }
    return true;
  };
  const keyframeBank = {
    getFrameFromTimestamp: (timestamp, fps) => {
      queue = queue.then(() => getFrameFromTimestamp(timestamp, fps));
      return queue;
    },
    prepareForDeletion,
    hasTimestampInSecond: (timestamp, fps) => {
      queue = queue.then(() => hasTimestampInSecond(timestamp, fps));
      return queue;
    },
    addFrame,
    deleteFramesBeforeTimestamp,
    src,
    getOpenFrameCount,
    getLastUsed,
    canSatisfyTimestamp,
    getRangeOfTimestamps
  };
  return keyframeBank;
};
var makeKeyframeManager = () => {
  let sources = {};
  const addKeyframeBank = ({ src, bank }) => {
    sources[src] = sources[src] ?? [];
    sources[src].push(bank);
  };
  const logCacheStats = (logLevel) => {
    let count = 0;
    let totalSize = 0;
    for (const src in sources) {
      for (const bank of sources[src]) {
        const { size, timestamps } = bank.getOpenFrameCount();
        count += timestamps.length;
        totalSize += size;
        if (size === 0) {
          continue;
        }
        Internals11.Log.verbose({ logLevel, tag: "@remotion/media" }, `Open frames for src ${src}: ${renderTimestampRange(timestamps)}`);
      }
    }
    Internals11.Log.verbose({ logLevel, tag: "@remotion/media" }, `Video cache stats: ${count} open frames, ${totalSize} bytes`);
  };
  const getCacheStats = () => {
    let count = 0;
    let totalSize = 0;
    for (const src in sources) {
      for (const bank of sources[src]) {
        const { timestamps, size } = bank.getOpenFrameCount();
        count += timestamps.length;
        totalSize += size;
        if (size === 0) {
          continue;
        }
      }
    }
    return { count, totalSize };
  };
  const getTheKeyframeBankMostInThePast = () => {
    let mostInThePast = null;
    let mostInThePastBank = null;
    let numberOfBanks = 0;
    for (const src in sources) {
      for (const bank of sources[src]) {
        const index = sources[src].indexOf(bank);
        const lastUsed = bank.getLastUsed();
        if (mostInThePast === null || lastUsed < mostInThePast) {
          mostInThePast = lastUsed;
          mostInThePastBank = { src, bank, index };
        }
        numberOfBanks++;
      }
    }
    if (!mostInThePastBank) {
      throw new Error("No keyframe bank found");
    }
    return { mostInThePastBank, numberOfBanks };
  };
  const deleteOldestKeyframeBank = (logLevel) => {
    const {
      mostInThePastBank: {
        bank: mostInThePastBank,
        src: mostInThePastSrc,
        index: mostInThePastIndex
      },
      numberOfBanks
    } = getTheKeyframeBankMostInThePast();
    if (numberOfBanks < 2) {
      return { finish: true };
    }
    if (mostInThePastBank) {
      const range = mostInThePastBank.getRangeOfTimestamps();
      const { framesDeleted } = mostInThePastBank.prepareForDeletion(logLevel, "deleted oldest keyframe bank to stay under max cache size");
      sources[mostInThePastSrc].splice(mostInThePastIndex, 1);
      if (range) {
        Internals11.Log.verbose({ logLevel, tag: "@remotion/media" }, `Deleted ${framesDeleted} frames for src ${mostInThePastSrc} from ${range?.firstTimestamp}sec to ${range?.lastTimestamp}sec to free up memory.`);
      }
    }
    return { finish: false };
  };
  const ensureToStayUnderMaxCacheSize = (logLevel, maxCacheSize) => {
    let cacheStats = getTotalCacheStats();
    let attempts = 0;
    const maxAttempts = 3;
    while (cacheStats.totalSize > maxCacheSize && attempts < maxAttempts) {
      const { finish } = deleteOldestKeyframeBank(logLevel);
      if (finish) {
        break;
      }
      Internals11.Log.verbose({ logLevel, tag: "@remotion/media" }, "Deleted oldest keyframe bank to stay under max cache size", (cacheStats.totalSize / 1024 / 1024).toFixed(1), "out of", (maxCacheSize / 1024 / 1024).toFixed(1));
      cacheStats = getTotalCacheStats();
      attempts++;
    }
    if (cacheStats.totalSize > maxCacheSize && attempts >= maxAttempts) {
      Internals11.Log.warn({ logLevel, tag: "@remotion/media" }, `Exceeded max cache size after ${maxAttempts} attempts. Remaining cache size: ${(cacheStats.totalSize / 1024 / 1024).toFixed(1)} MB, target was ${(maxCacheSize / 1024 / 1024).toFixed(1)} MB.`);
    }
  };
  const clearKeyframeBanksBeforeTime = ({
    timestampInSeconds,
    src,
    logLevel,
    fps
  }) => {
    const threshold = timestampInSeconds - getSafeWindowOfMonotonicity(fps);
    if (!sources[src]) {
      return;
    }
    const banks = sources[src];
    for (const bank of banks) {
      const range = bank.getRangeOfTimestamps();
      if (!range) {
        continue;
      }
      if (range.lastTimestamp < threshold) {
        bank.prepareForDeletion(logLevel, "cleared before threshold " + threshold);
        Internals11.Log.verbose({ logLevel, tag: "@remotion/media" }, `[Video] Cleared frames for src ${src} from ${range.firstTimestamp}sec to ${range.lastTimestamp}sec`);
        const bankIndex = banks.indexOf(bank);
        delete sources[src][bankIndex];
      } else {
        bank.deleteFramesBeforeTimestamp({
          timestampInSeconds: threshold,
          logLevel
        });
      }
    }
    sources[src] = sources[src].filter((bank) => bank !== undefined);
    logCacheStats(logLevel);
  };
  const getKeyframeBankOrRefetch = async ({
    timestamp,
    videoSampleSink,
    src,
    logLevel
  }) => {
    const existingBanks = sources[src] ?? [];
    const existingBank = existingBanks?.find((bank) => bank.canSatisfyTimestamp(timestamp));
    if (!existingBank) {
      Internals11.Log.trace({ logLevel, tag: "@remotion/media" }, `Creating new keyframe bank for src ${src} at timestamp ${timestamp}`);
      const newKeyframeBank = await makeKeyframeBank({
        videoSampleSink,
        logLevel,
        src,
        initialTimestampRequest: timestamp
      });
      addKeyframeBank({ src, bank: newKeyframeBank });
      return newKeyframeBank;
    }
    if (existingBank.canSatisfyTimestamp(timestamp)) {
      Internals11.Log.trace({ logLevel, tag: "@remotion/media" }, `Keyframe bank exists and satisfies timestamp ${timestamp}`);
      return existingBank;
    }
    Internals11.Log.verbose({ logLevel, tag: "@remotion/media" }, `Keyframe bank exists but frame at time ${timestamp} does not exist anymore.`);
    existingBank.prepareForDeletion(logLevel, "already existed but evicted");
    sources[src] = sources[src].filter((bank) => bank !== existingBank);
    const replacementKeybank = await makeKeyframeBank({
      videoSampleSink,
      initialTimestampRequest: timestamp,
      logLevel,
      src
    });
    addKeyframeBank({ src, bank: replacementKeybank });
    return replacementKeybank;
  };
  const requestKeyframeBank = async ({
    timestamp,
    videoSampleSink,
    src,
    logLevel,
    maxCacheSize,
    fps
  }) => {
    ensureToStayUnderMaxCacheSize(logLevel, maxCacheSize);
    clearKeyframeBanksBeforeTime({
      timestampInSeconds: timestamp,
      src,
      logLevel,
      fps
    });
    const keyframeBank = await getKeyframeBankOrRefetch({
      timestamp,
      videoSampleSink,
      src,
      logLevel
    });
    return keyframeBank;
  };
  const clearAll = (logLevel) => {
    const srcs = Object.keys(sources);
    for (const src of srcs) {
      const banks = sources[src];
      for (const bank of banks) {
        bank.prepareForDeletion(logLevel, "clearAll");
      }
      sources[src] = [];
    }
    sources = {};
  };
  let queue = Promise.resolve(undefined);
  return {
    requestKeyframeBank: ({
      timestamp,
      videoSampleSink,
      src,
      logLevel,
      maxCacheSize,
      fps
    }) => {
      queue = queue.then(() => requestKeyframeBank({
        timestamp,
        videoSampleSink,
        src,
        logLevel,
        maxCacheSize,
        fps
      }));
      return queue;
    },
    getCacheStats,
    clearAll
  };
};
var getSafeWindowOfMonotonicity = (fps) => 0.2 * 30 / fps;
var keyframeManager = makeKeyframeManager();
var audioManager = makeAudioManager();
var getTotalCacheStats = () => {
  const keyframeManagerCacheStats = keyframeManager.getCacheStats();
  const audioManagerCacheStats = audioManager.getCacheStats();
  return {
    count: keyframeManagerCacheStats.count + audioManagerCacheStats.count,
    totalSize: keyframeManagerCacheStats.totalSize + audioManagerCacheStats.totalSize
  };
};
var getUncachedMaxCacheSize = (logLevel) => {
  if (typeof window !== "undefined" && window.remotion_mediaCacheSizeInBytes !== undefined && window.remotion_mediaCacheSizeInBytes !== null) {
    if (window.remotion_mediaCacheSizeInBytes < 240 * 1024 * 1024) {
      cancelRender(new Error(`The minimum value for the "mediaCacheSizeInBytes" prop is 240MB (${240 * 1024 * 1024}), got: ${window.remotion_mediaCacheSizeInBytes}`));
    }
    if (window.remotion_mediaCacheSizeInBytes > 20000 * 1024 * 1024) {
      cancelRender(new Error(`The maximum value for the "mediaCacheSizeInBytes" prop is 20GB (${20000 * 1024 * 1024}), got: ${window.remotion_mediaCacheSizeInBytes}`));
    }
    Internals12.Log.verbose({ logLevel, tag: "@remotion/media" }, `Using cache size set using "mediaCacheSizeInBytes": ${(window.remotion_mediaCacheSizeInBytes / 1024 / 1024).toFixed(1)} MB`);
    return window.remotion_mediaCacheSizeInBytes;
  }
  if (typeof window !== "undefined" && window.remotion_initialMemoryAvailable !== undefined && window.remotion_initialMemoryAvailable !== null) {
    const value = window.remotion_initialMemoryAvailable / 2;
    if (value < 500 * 1024 * 1024) {
      Internals12.Log.verbose({ logLevel, tag: "@remotion/media" }, `Using cache size set based on minimum value of 500MB (which is more than half of the available system memory!)`);
      return 500 * 1024 * 1024;
    }
    if (value > 20000 * 1024 * 1024) {
      Internals12.Log.verbose({ logLevel, tag: "@remotion/media" }, `Using cache size set based on maximum value of 20GB (which is less than half of the available system memory)`);
      return 20000 * 1024 * 1024;
    }
    Internals12.Log.verbose({ logLevel, tag: "@remotion/media" }, `Using cache size set based on available memory (50% of available memory): ${(value / 1024 / 1024).toFixed(1)} MB`);
    return value;
  }
  return 1000 * 1000 * 1000;
};
var cachedMaxCacheSize = null;
var getMaxVideoCacheSize = (logLevel) => {
  if (cachedMaxCacheSize !== null) {
    return cachedMaxCacheSize;
  }
  cachedMaxCacheSize = getUncachedMaxCacheSize(logLevel);
  return cachedMaxCacheSize;
};
var useMaxMediaCacheSize = (logLevel) => {
  const context = React2.useContext(Internals12.MaxMediaCacheSizeContext);
  if (context === null) {
    return getMaxVideoCacheSize(logLevel);
  }
  return context;
};
var applyVolume = (array, volume) => {
  if (volume === 1) {
    return;
  }
  for (let i = 0;i < array.length; i++) {
    const newValue = array[i] * volume;
    if (newValue < -32768) {
      array[i] = -32768;
    } else if (newValue > 32767) {
      array[i] = 32767;
    } else {
      array[i] = newValue;
    }
  }
};
var TARGET_NUMBER_OF_CHANNELS = 2;
var getTargetSampleRate = () => {
  if (typeof window !== "undefined" && window.remotion_sampleRate) {
    return window.remotion_sampleRate;
  }
  return 48000;
};
var fixFloatingPoint = (value) => {
  if (value % 1 < 0.0000001) {
    return Math.floor(value);
  }
  if (value % 1 > 0.9999999) {
    return Math.ceil(value);
  }
  return value;
};
var resampleAudioData = ({
  srcNumberOfChannels,
  sourceChannels,
  destination,
  targetFrames,
  chunkSize
}) => {
  const getSourceValues = (startUnfixed, endUnfixed, channelIndex) => {
    const start = fixFloatingPoint(startUnfixed);
    const end = fixFloatingPoint(endUnfixed);
    const startFloor = Math.floor(start);
    const startCeil = Math.ceil(start);
    const startFraction = start - startFloor;
    const endFraction = end - Math.floor(end);
    const endFloor = Math.floor(end);
    let weightedSum = 0;
    let totalWeight = 0;
    if (startFraction > 0) {
      const firstSample = sourceChannels[startFloor * srcNumberOfChannels + channelIndex];
      weightedSum += firstSample * (1 - startFraction);
      totalWeight += 1 - startFraction;
    }
    for (let k = startCeil;k < endFloor; k++) {
      const num = sourceChannels[k * srcNumberOfChannels + channelIndex];
      weightedSum += num;
      totalWeight += 1;
    }
    if (endFraction > 0) {
      const lastSample = sourceChannels[endFloor * srcNumberOfChannels + channelIndex];
      weightedSum += lastSample * endFraction;
      totalWeight += endFraction;
    }
    const average = weightedSum / totalWeight;
    return average;
  };
  for (let newFrameIndex = 0;newFrameIndex < targetFrames; newFrameIndex++) {
    const start = newFrameIndex * chunkSize;
    const end = start + chunkSize;
    if (TARGET_NUMBER_OF_CHANNELS === srcNumberOfChannels) {
      for (let i = 0;i < srcNumberOfChannels; i++) {
        destination[newFrameIndex * srcNumberOfChannels + i] = getSourceValues(start, end, i);
      }
    }
    if (srcNumberOfChannels === 1) {
      const m = getSourceValues(start, end, 0);
      destination[newFrameIndex * 2 + 0] = m;
      destination[newFrameIndex * 2 + 1] = m;
    } else if (srcNumberOfChannels === 4) {
      const l = getSourceValues(start, end, 0);
      const r = getSourceValues(start, end, 1);
      const sl = getSourceValues(start, end, 2);
      const sr = getSourceValues(start, end, 3);
      const l2 = 0.5 * (l + sl);
      const r2 = 0.5 * (r + sr);
      destination[newFrameIndex * 2 + 0] = l2;
      destination[newFrameIndex * 2 + 1] = r2;
    } else if (srcNumberOfChannels === 6) {
      const l = getSourceValues(start, end, 0);
      const r = getSourceValues(start, end, 1);
      const c = getSourceValues(start, end, 2);
      const sl = getSourceValues(start, end, 3);
      const sr = getSourceValues(start, end, 4);
      const sq = Math.sqrt(1 / 2);
      const l2 = l + sq * (c + sl);
      const r2 = r + sq * (c + sr);
      destination[newFrameIndex * 2 + 0] = l2;
      destination[newFrameIndex * 2 + 1] = r2;
    } else {
      for (let i = 0;i < srcNumberOfChannels; i++) {
        destination[newFrameIndex * TARGET_NUMBER_OF_CHANNELS + i] = getSourceValues(start, end, i);
      }
    }
  }
};
var frameForVolumeProp = ({
  behavior,
  loop,
  assetDurationInSeconds,
  fps,
  frame,
  startsAt
}) => {
  if (!loop) {
    return frame + startsAt;
  }
  if (behavior === "extend") {
    return frame + startsAt;
  }
  const assetDurationInFrames = Math.floor(assetDurationInSeconds * fps) - startsAt;
  return frame % assetDurationInFrames + startsAt;
};
var FORMAT = "s16";
var fixFloatingPoint2 = (value) => {
  const decimal = Math.abs(value % 1);
  if (decimal < 0.0000001) {
    return value < 0 ? Math.ceil(value) : Math.floor(value);
  }
  if (decimal > 0.9999999) {
    return value < 0 ? Math.floor(value) : Math.ceil(value);
  }
  return value;
};
var ceilButNotIfFloatingPointIssue = (value) => {
  const fixed = fixFloatingPoint2(value);
  return Math.ceil(fixed);
};
var convertAudioData = ({
  audioData,
  trimStartInSeconds,
  trimEndInSeconds,
  playbackRate,
  audioDataTimestamp,
  isLast
}) => {
  const {
    numberOfChannels: srcNumberOfChannels,
    sampleRate: currentSampleRate,
    numberOfFrames
  } = audioData;
  const ratio = currentSampleRate / getTargetSampleRate();
  const frameOffset = Math.floor(fixFloatingPoint2(trimStartInSeconds * audioData.sampleRate));
  const unroundedFrameCount = numberOfFrames - trimEndInSeconds * audioData.sampleRate - frameOffset;
  const frameCount = isLast ? ceilButNotIfFloatingPointIssue(unroundedFrameCount) : Math.round(unroundedFrameCount);
  const newNumberOfFrames = isLast ? ceilButNotIfFloatingPointIssue(unroundedFrameCount / ratio / playbackRate) : Math.round(unroundedFrameCount / ratio / playbackRate);
  if (newNumberOfFrames === 0) {
    throw new Error("Cannot resample - the given sample rate would result in less than 1 sample");
  }
  const srcChannels = new Int16Array(srcNumberOfChannels * frameCount);
  const isF32 = audioData.format === "f32" || audioData.format === "f32-planar";
  if (isF32) {
    const bytesPerPlane = frameCount * 4;
    const f32Buffer = new ArrayBuffer(srcNumberOfChannels * bytesPerPlane);
    for (let ch = 0;ch < srcNumberOfChannels; ch++) {
      audioData.copyTo(new Float32Array(f32Buffer, ch * bytesPerPlane, frameCount), { planeIndex: ch, frameOffset, frameCount, format: "f32-planar" });
    }
    const f32AudioData = new AudioData({
      format: "f32-planar",
      sampleRate: currentSampleRate,
      numberOfFrames: frameCount,
      numberOfChannels: srcNumberOfChannels,
      timestamp: audioData.timestamp,
      data: f32Buffer
    });
    f32AudioData.copyTo(srcChannels, {
      planeIndex: 0,
      format: FORMAT,
      frameOffset: 0,
      frameCount
    });
    f32AudioData.close();
  } else {
    audioData.copyTo(srcChannels, {
      planeIndex: 0,
      format: FORMAT,
      frameOffset,
      frameCount
    });
  }
  const data = new Int16Array(newNumberOfFrames * TARGET_NUMBER_OF_CHANNELS);
  const chunkSize = frameCount / newNumberOfFrames;
  const timestampOffsetMicroseconds = frameOffset / audioData.sampleRate * 1e6;
  if (newNumberOfFrames === frameCount && TARGET_NUMBER_OF_CHANNELS === srcNumberOfChannels && playbackRate === 1) {
    return {
      data: srcChannels,
      numberOfFrames: newNumberOfFrames,
      timestamp: audioDataTimestamp * 1e6 + fixFloatingPoint2(timestampOffsetMicroseconds),
      durationInMicroSeconds: fixFloatingPoint2(newNumberOfFrames / getTargetSampleRate() * 1e6)
    };
  }
  resampleAudioData({
    srcNumberOfChannels,
    sourceChannels: srcChannels,
    destination: data,
    targetFrames: newNumberOfFrames,
    chunkSize
  });
  const newAudioData = {
    data,
    numberOfFrames: newNumberOfFrames,
    timestamp: audioDataTimestamp * 1e6 + fixFloatingPoint2(timestampOffsetMicroseconds),
    durationInMicroSeconds: fixFloatingPoint2(newNumberOfFrames / getTargetSampleRate() * 1e6)
  };
  return newAudioData;
};
var combineAudioDataAndClosePrevious = (audioDataArray) => {
  let numberOfFrames = 0;
  let durationInMicroSeconds = 0;
  const { timestamp } = audioDataArray[0];
  for (const audioData of audioDataArray) {
    numberOfFrames += audioData.numberOfFrames;
    durationInMicroSeconds += audioData.durationInMicroSeconds;
  }
  const arr = new Int16Array(numberOfFrames * TARGET_NUMBER_OF_CHANNELS);
  let offset = 0;
  for (const audioData of audioDataArray) {
    arr.set(audioData.data, offset);
    offset += audioData.data.length;
  }
  return {
    data: arr,
    numberOfFrames,
    timestamp: fixFloatingPoint2(timestamp),
    durationInMicroSeconds: fixFloatingPoint2(durationInMicroSeconds)
  };
};
var browserCanUseWebGl2 = null;
var browserCanUseWebGl2Uncached = () => {
  const canvas = new OffscreenCanvas(1, 1);
  const context = canvas.getContext("webgl2");
  return context !== null;
};
var canBrowserUseWebGl2 = () => {
  if (browserCanUseWebGl2 !== null) {
    return browserCanUseWebGl2;
  }
  browserCanUseWebGl2 = browserCanUseWebGl2Uncached();
  return browserCanUseWebGl2;
};
var rememberActualMatroskaTimestamps = (isMatroska) => {
  const observations = [];
  const observeTimestamp = (startTime) => {
    if (!isMatroska) {
      return;
    }
    observations.push(startTime);
  };
  const getRealTimestamp = (observedTimestamp) => {
    if (!isMatroska) {
      return observedTimestamp;
    }
    return observations.find((observation) => Math.abs(observedTimestamp - observation) < 0.001) ?? null;
  };
  return {
    observeTimestamp,
    getRealTimestamp
  };
};
var getRetryDelay = () => {
  return null;
};
var getFormatOrNullOrNetworkError = async (input) => {
  try {
    return await input.getFormat();
  } catch (err) {
    if (isNetworkError(err)) {
      return "network-error";
    }
    return null;
  }
};
var getSinks = async (src, logLevel, credentials, requestInit) => {
  const resolvedRequestInit = resolveRequestInit({ credentials, requestInit });
  const input = new Input({
    formats: ALL_FORMATS,
    source: new UrlSource(src, {
      getRetryDelay,
      ...resolvedRequestInit ? { requestInit: resolvedRequestInit } : undefined
    })
  });
  const format = await getFormatOrNullOrNetworkError(input);
  const isMatroska = format === MATROSKA || format === WEBM;
  const getVideoSinks = async () => {
    if (format === "network-error") {
      return "network-error";
    }
    if (format === null) {
      return "unknown-container-format";
    }
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      return "no-video-track";
    }
    if (await videoTrack.isLive()) {
      throw new Error("Live streams are not currently supported by Remotion. Sorry! Source: " + src);
    }
    if (await videoTrack.isRelativeToUnixEpoch()) {
      throw new Error("Streams with UNIX timestamps are not currently supported by Remotion. Sorry! Source: " + src);
    }
    const canDecode2 = await videoTrack.canDecode();
    if (!canDecode2) {
      return "cannot-decode";
    }
    const sampleSink = new VideoSampleSink(videoTrack);
    const packetSink = new EncodedPacketSink(videoTrack);
    const startPacket = await packetSink.getFirstPacket({
      verifyKeyPackets: true
    });
    const hasAlpha = startPacket?.sideData.alpha;
    if (hasAlpha && !canBrowserUseWebGl2()) {
      Internals13.Log.warn({ logLevel, tag: "@remotion/media" }, `WebGL2 is not available, using the non-fast CPU path to decode alpha for ${src}.`);
    }
    return {
      sampleSink
    };
  };
  let videoSinksPromise = null;
  const getVideoSinksPromise = () => {
    if (videoSinksPromise) {
      return videoSinksPromise;
    }
    videoSinksPromise = getVideoSinks();
    return videoSinksPromise;
  };
  const audioSinksPromise = {};
  const getAudioSinks = async (index) => {
    if (format === null) {
      return "unknown-container-format";
    }
    if (format === "network-error") {
      return "network-error";
    }
    const [videoTrack, audioTracks] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getAudioTracks()
    ]);
    const audioTrack = await resolveAudioTrack({
      videoTrack,
      audioTracks,
      audioStreamIndex: index
    });
    if (!audioTrack) {
      return "no-audio-track";
    }
    const canDecode2 = await audioTrack.canDecode();
    if (!canDecode2) {
      return "cannot-decode-audio";
    }
    return {
      sampleSink: new AudioSampleSink(audioTrack)
    };
  };
  const getAudioSinksPromise = (index) => {
    const keyIndex = index === null ? -1 : index;
    if (audioSinksPromise[keyIndex]) {
      return audioSinksPromise[keyIndex];
    }
    audioSinksPromise[keyIndex] = getAudioSinks(index);
    return audioSinksPromise[keyIndex];
  };
  return {
    getVideo: () => getVideoSinksPromise(),
    getAudio: (index) => getAudioSinksPromise(index),
    actualMatroskaTimestamps: rememberActualMatroskaTimestamps(isMatroska),
    isMatroska,
    getDuration: () => {
      return getDurationOrCompute(input);
    }
  };
};
var sinkPromises = {};
var getSinkCacheKey = ({
  src,
  credentials,
  requestInit
}) => JSON.stringify([
  src,
  credentials,
  getMediaRequestInitFingerprint(requestInit)
]);
var getSink = (src, logLevel, credentials, requestInit) => {
  const normalizedRequestInit = normalizeMediaRequestInit(requestInit);
  const cacheKey = getSinkCacheKey({
    src,
    credentials,
    requestInit: normalizedRequestInit
  });
  let promise = sinkPromises[cacheKey];
  if (!promise) {
    Internals14.Log.verbose({
      logLevel,
      tag: "@remotion/media"
    }, `Sink for ${src} was not found, creating new sink`);
    promise = getSinks(src, logLevel, credentials, normalizedRequestInit);
    sinkPromises[cacheKey] = promise;
  }
  return promise;
};
var extractAudioInternal = async ({
  src,
  timeInSeconds: unloopedTimeInSeconds,
  durationInSeconds: durationNotYetApplyingPlaybackRate,
  logLevel,
  loop,
  playbackRate,
  audioStreamIndex,
  trimBefore,
  trimAfter,
  fps,
  maxCacheSize,
  credentials,
  requestInit
}) => {
  const { getAudio, actualMatroskaTimestamps, isMatroska, getDuration } = await getSink(src, logLevel, credentials, requestInit);
  let mediaDurationInSeconds = null;
  if (loop) {
    mediaDurationInSeconds = await getDuration();
  }
  const audio = await getAudio(audioStreamIndex);
  if (audio === "network-error") {
    return "network-error";
  }
  if (audio === "no-audio-track") {
    return { data: null, durationInSeconds: null };
  }
  if (audio === "cannot-decode-audio") {
    return "cannot-decode";
  }
  if (audio === "unknown-container-format") {
    return "unknown-container-format";
  }
  const timeInSeconds = getTimeInSeconds({
    loop,
    mediaDurationInSeconds,
    unloopedTimeInSeconds,
    src,
    trimAfter,
    playbackRate,
    trimBefore,
    fps,
    ifNoMediaDuration: "fail"
  });
  if (timeInSeconds === null) {
    return { data: null, durationInSeconds: mediaDurationInSeconds };
  }
  try {
    const sampleIterator = await audioManager.getIterator({
      src,
      timeInSeconds,
      audioSampleSink: audio.sampleSink,
      isMatroska,
      actualMatroskaTimestamps,
      logLevel,
      maxCacheSize
    });
    const durationInSeconds = durationNotYetApplyingPlaybackRate * playbackRate;
    const samples = await sampleIterator.getSamples(timeInSeconds, durationInSeconds);
    audioManager.logOpenFrames();
    const audioDataArray = [];
    for (let i = 0;i < samples.length; i++) {
      const sample = samples[i];
      if (Math.abs(sample.timestamp - (timeInSeconds + durationInSeconds)) * sample.sampleRate < 1) {
        continue;
      }
      if (sample.timestamp + sample.duration <= timeInSeconds) {
        continue;
      }
      const isFirstSample = i === 0;
      const isLastSample = i === samples.length - 1;
      const audioDataRaw = sample.toAudioData();
      let trimStartInSeconds = 0;
      let trimEndInSeconds = 0;
      let leadingSilence = null;
      if (isFirstSample) {
        trimStartInSeconds = fixFloatingPoint2(timeInSeconds - sample.timestamp);
        if (trimStartInSeconds < 0) {
          const silenceFrames = Math.ceil(fixFloatingPoint2(-trimStartInSeconds * getTargetSampleRate()));
          leadingSilence = {
            data: new Int16Array(silenceFrames * TARGET_NUMBER_OF_CHANNELS),
            numberOfFrames: silenceFrames,
            timestamp: timeInSeconds * 1e6,
            durationInMicroSeconds: silenceFrames / getTargetSampleRate() * 1e6
          };
          trimStartInSeconds = 0;
        }
      }
      if (isLastSample) {
        trimEndInSeconds = Math.max(0, sample.timestamp + sample.duration - (timeInSeconds + durationInSeconds));
      }
      const audioData = convertAudioData({
        audioData: audioDataRaw,
        trimStartInSeconds,
        trimEndInSeconds,
        playbackRate,
        audioDataTimestamp: sample.timestamp,
        isLast: isLastSample
      });
      audioDataRaw.close();
      if (audioData.numberOfFrames === 0) {
        continue;
      }
      if (leadingSilence) {
        audioDataArray.push(leadingSilence);
      }
      audioDataArray.push(audioData);
    }
    if (audioDataArray.length === 0) {
      return { data: null, durationInSeconds: mediaDurationInSeconds };
    }
    const combined = combineAudioDataAndClosePrevious(audioDataArray);
    return { data: combined, durationInSeconds: mediaDurationInSeconds };
  } catch (err) {
    const error = err;
    if (isNetworkError(error)) {
      return "network-error";
    }
    if (isUnsupportedConfigurationError(error)) {
      return "cannot-decode";
    }
    throw err;
  }
};
var queue = Promise.resolve(undefined);
var extractAudio = (params) => {
  queue = queue.then(() => extractAudioInternal(params));
  return queue;
};
var extractFrameInternal = async ({
  src,
  timeInSeconds: unloopedTimeInSeconds,
  logLevel,
  loop,
  trimAfter,
  trimBefore,
  playbackRate,
  fps,
  maxCacheSize,
  credentials,
  requestInit
}) => {
  const sink = await getSink(src, logLevel, credentials, requestInit);
  const [video, mediaDurationInSecondsRaw] = await Promise.all([
    sink.getVideo(),
    loop ? sink.getDuration() : Promise.resolve(null)
  ]);
  const mediaDurationInSeconds = loop ? mediaDurationInSecondsRaw : null;
  if (video === "no-video-track") {
    throw new Error(`No video track found for ${src}`);
  }
  if (video === "cannot-decode") {
    return { type: "cannot-decode", durationInSeconds: mediaDurationInSeconds };
  }
  if (video === "unknown-container-format") {
    return { type: "unknown-container-format" };
  }
  if (video === "network-error") {
    return { type: "network-error" };
  }
  if (video === "cannot-decode-alpha") {
    return {
      type: "cannot-decode-alpha",
      durationInSeconds: mediaDurationInSeconds
    };
  }
  const timeInSeconds = getTimeInSeconds({
    loop,
    mediaDurationInSeconds,
    unloopedTimeInSeconds,
    src,
    trimAfter,
    playbackRate,
    trimBefore,
    fps,
    ifNoMediaDuration: "fail"
  });
  if (timeInSeconds === null) {
    return {
      type: "success",
      frame: null,
      rotation: 0,
      durationInSeconds: await sink.getDuration()
    };
  }
  try {
    const keyframeBank = await keyframeManager.requestKeyframeBank({
      videoSampleSink: video.sampleSink,
      timestamp: timeInSeconds,
      src,
      logLevel,
      maxCacheSize,
      fps
    });
    if (!keyframeBank) {
      return {
        type: "success",
        frame: null,
        rotation: 0,
        durationInSeconds: await sink.getDuration()
      };
    }
    const frame = await keyframeBank.getFrameFromTimestamp(timeInSeconds, fps);
    const rotation = frame?.rotation ?? 0;
    return {
      type: "success",
      frame: frame?.toVideoFrame() ?? null,
      rotation,
      durationInSeconds: await sink.getDuration()
    };
  } catch (err) {
    Internals15.Log.info({ logLevel, tag: "@remotion/media" }, `Error decoding ${src} at time ${timeInSeconds}: ${err}`, err);
    return { type: "cannot-decode", durationInSeconds: mediaDurationInSeconds };
  }
};
var queue2 = Promise.resolve(undefined);
var extractFrame = (params) => {
  queue2 = queue2.then(() => extractFrameInternal(params));
  return queue2;
};
var rotateFrame = async ({
  frame,
  rotation
}) => {
  if (rotation === 0) {
    const directBitmap = await createImageBitmap(frame);
    frame.close();
    return directBitmap;
  }
  const width = rotation === 90 || rotation === 270 ? frame.displayHeight : frame.displayWidth;
  const height = rotation === 90 || rotation === 270 ? frame.displayWidth : frame.displayHeight;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get 2d context");
  }
  canvas.width = width;
  canvas.height = height;
  if (rotation === 90) {
    ctx.translate(width, 0);
  } else if (rotation === 180) {
    ctx.translate(width, height);
  } else if (rotation === 270) {
    ctx.translate(0, height);
  }
  ctx.rotate(rotation * (Math.PI / 180));
  ctx.drawImage(frame, 0, 0);
  const bitmap = await createImageBitmap(canvas);
  frame.close();
  return bitmap;
};
var extractFrameAndAudio = async ({
  src,
  timeInSeconds,
  logLevel,
  durationInSeconds,
  playbackRate,
  includeAudio,
  includeVideo,
  loop,
  audioStreamIndex,
  trimAfter,
  trimBefore,
  fps,
  maxCacheSize,
  credentials,
  requestInit
}) => {
  try {
    const [video, audio] = await Promise.all([
      includeVideo ? extractFrame({
        src,
        timeInSeconds,
        logLevel,
        loop,
        trimAfter,
        playbackRate,
        trimBefore,
        fps,
        maxCacheSize,
        credentials,
        requestInit
      }) : null,
      includeAudio ? extractAudio({
        src,
        timeInSeconds,
        durationInSeconds,
        logLevel,
        loop,
        playbackRate,
        audioStreamIndex,
        trimAfter,
        fps,
        trimBefore,
        maxCacheSize,
        credentials,
        requestInit
      }) : null
    ]);
    if (video?.type === "cannot-decode") {
      return {
        type: "cannot-decode",
        durationInSeconds: video.durationInSeconds
      };
    }
    if (video?.type === "unknown-container-format") {
      return { type: "unknown-container-format" };
    }
    if (video?.type === "cannot-decode-alpha") {
      return {
        type: "cannot-decode-alpha",
        durationInSeconds: video.durationInSeconds
      };
    }
    if (video?.type === "network-error") {
      return { type: "network-error" };
    }
    if (audio === "unknown-container-format") {
      return { type: "unknown-container-format" };
    }
    if (audio === "network-error") {
      return { type: "network-error" };
    }
    if (audio === "cannot-decode") {
      return {
        type: "cannot-decode",
        durationInSeconds: video?.type === "success" ? video.durationInSeconds : null
      };
    }
    return {
      type: "success",
      frame: video?.frame ? await rotateFrame({
        frame: video.frame,
        rotation: video.rotation
      }) : null,
      audio: audio?.data ?? null,
      durationInSeconds: audio?.durationInSeconds ?? null
    };
  } catch (err) {
    const error = err;
    if (isNetworkError(error)) {
      return { type: "network-error" };
    }
    throw err;
  }
};
var emitReadiness = (channel) => {
  channel.postMessage({
    type: "main-tab-ready"
  });
  setInterval(() => {
    channel.postMessage({
      type: "main-tab-ready"
    });
  }, 300);
};
var addBroadcastChannelListener = () => {
  if (!(typeof window !== "undefined" && window.remotion_broadcastChannel && window.remotion_isMainTab)) {
    return;
  }
  window.remotion_broadcastChannel.addEventListener("message", async (event) => {
    const data = event.data;
    if (data.type === "request") {
      try {
        const result = await extractFrameAndAudio({
          src: data.src,
          timeInSeconds: data.timeInSeconds,
          logLevel: data.logLevel,
          durationInSeconds: data.durationInSeconds,
          playbackRate: data.playbackRate,
          includeAudio: data.includeAudio,
          includeVideo: data.includeVideo,
          loop: data.loop,
          audioStreamIndex: data.audioStreamIndex,
          trimAfter: data.trimAfter,
          trimBefore: data.trimBefore,
          fps: data.fps,
          maxCacheSize: data.maxCacheSize,
          credentials: data.credentials,
          requestInit: data.requestInit
        });
        if (result.type === "cannot-decode") {
          const cannotDecodeResponse = {
            type: "response-cannot-decode",
            id: data.id,
            durationInSeconds: result.durationInSeconds
          };
          window.remotion_broadcastChannel.postMessage(cannotDecodeResponse);
          return;
        }
        if (result.type === "cannot-decode-alpha") {
          const cannotDecodeAlphaResponse = {
            type: "response-cannot-decode-alpha",
            id: data.id,
            durationInSeconds: result.durationInSeconds
          };
          window.remotion_broadcastChannel.postMessage(cannotDecodeAlphaResponse);
          return;
        }
        if (result.type === "network-error") {
          const networkErrorResponse = {
            type: "response-network-error",
            id: data.id
          };
          window.remotion_broadcastChannel.postMessage(networkErrorResponse);
          return;
        }
        if (result.type === "unknown-container-format") {
          const unknownContainerFormatResponse = {
            type: "response-unknown-container-format",
            id: data.id
          };
          window.remotion_broadcastChannel.postMessage(unknownContainerFormatResponse);
          return;
        }
        const { frame, audio, durationInSeconds } = result;
        const imageBitmap = frame ? await createImageBitmap(frame) : null;
        if (frame) {
          frame.close();
        }
        const response = {
          type: "response-success",
          id: data.id,
          frame: imageBitmap,
          audio,
          durationInSeconds: durationInSeconds ?? null
        };
        window.remotion_broadcastChannel.postMessage(response);
      } catch (error) {
        const response = {
          type: "response-error",
          id: data.id,
          errorStack: error.stack ?? "No stack trace"
        };
        window.remotion_broadcastChannel.postMessage(response);
      }
    } else if (data.type === "main-tab-ready") {} else {
      throw new Error("Invalid message: " + JSON.stringify(data));
    }
  });
  emitReadiness(window.remotion_broadcastChannel);
};
var mainTabIsReadyProm = null;
var waitForMainTabToBeReady = (channel) => {
  if (mainTabIsReadyProm) {
    return mainTabIsReadyProm;
  }
  mainTabIsReadyProm = new Promise((resolve) => {
    const onMessage = (event) => {
      const data = event.data;
      if (data.type === "main-tab-ready") {
        resolve();
        channel.removeEventListener("message", onMessage);
      }
    };
    channel.addEventListener("message", onMessage);
  });
  return mainTabIsReadyProm;
};
addBroadcastChannelListener();
var extractFrameViaBroadcastChannel = async ({
  src,
  timeInSeconds,
  logLevel,
  durationInSeconds,
  playbackRate,
  includeAudio,
  includeVideo,
  isClientSideRendering,
  loop,
  audioStreamIndex,
  trimAfter,
  trimBefore,
  fps,
  maxCacheSize,
  credentials,
  requestInit
}) => {
  if (isClientSideRendering || window.remotion_isMainTab) {
    return extractFrameAndAudio({
      logLevel,
      src,
      timeInSeconds,
      durationInSeconds,
      playbackRate,
      includeAudio,
      includeVideo,
      loop,
      audioStreamIndex,
      trimAfter,
      trimBefore,
      fps,
      maxCacheSize,
      credentials,
      requestInit
    });
  }
  await waitForMainTabToBeReady(window.remotion_broadcastChannel);
  const requestId = crypto.randomUUID();
  const resolvePromise = new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const data = event.data;
      if (!data) {
        return;
      }
      if (data.type === "main-tab-ready") {
        return;
      }
      if (data.id !== requestId) {
        return;
      }
      if (data.type === "response-success") {
        resolve({
          type: "success",
          frame: data.frame ? data.frame : null,
          audio: data.audio ? data.audio : null,
          durationInSeconds: data.durationInSeconds ? data.durationInSeconds : null
        });
        window.remotion_broadcastChannel.removeEventListener("message", onMessage);
        return;
      }
      if (data.type === "response-error") {
        reject(data.errorStack);
        window.remotion_broadcastChannel.removeEventListener("message", onMessage);
        return;
      }
      if (data.type === "response-cannot-decode") {
        resolve({
          type: "cannot-decode",
          durationInSeconds: data.durationInSeconds
        });
        window.remotion_broadcastChannel.removeEventListener("message", onMessage);
        return;
      }
      if (data.type === "response-network-error") {
        resolve({ type: "network-error" });
        window.remotion_broadcastChannel.removeEventListener("message", onMessage);
        return;
      }
      if (data.type === "response-unknown-container-format") {
        resolve({ type: "unknown-container-format" });
        window.remotion_broadcastChannel.removeEventListener("message", onMessage);
        return;
      }
      if (data.type === "response-cannot-decode-alpha") {
        resolve({
          type: "cannot-decode-alpha",
          durationInSeconds: data.durationInSeconds
        });
        window.remotion_broadcastChannel.removeEventListener("message", onMessage);
        return;
      }
      throw new Error(`Invalid message: ${JSON.stringify(data)}`);
    };
    window.remotion_broadcastChannel.addEventListener("message", onMessage);
  });
  const request = {
    type: "request",
    src,
    timeInSeconds,
    id: requestId,
    logLevel,
    durationInSeconds,
    playbackRate,
    includeAudio,
    includeVideo,
    loop,
    audioStreamIndex,
    trimAfter,
    trimBefore,
    fps,
    maxCacheSize,
    credentials,
    requestInit: normalizeMediaRequestInit(requestInit)
  };
  window.remotion_broadcastChannel.postMessage(request);
  let timeoutId;
  return Promise.race([
    resolvePromise.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Timeout while extracting frame at time ${timeInSeconds}sec from ${src}`));
      }, Math.max(3000, window.remotion_puppeteerTimeout - 5000));
    })
  ]);
};
var AudioForRendering = ({
  volume: volumeProp,
  playbackRate,
  src,
  muted,
  loopVolumeCurveBehavior,
  delayRenderRetries,
  delayRenderTimeoutInMilliseconds,
  logLevel: overriddenLogLevel,
  loop,
  fallbackHtml5AudioProps,
  audioStreamIndex,
  showInTimeline,
  style,
  name,
  disallowFallbackToHtml5Audio,
  toneFrequency,
  trimAfter,
  trimBefore,
  onError,
  credentials,
  requestInit
}) => {
  const defaultLogLevel = Internals16.useLogLevel();
  const logLevel = overriddenLogLevel ?? defaultLogLevel;
  const frame = useCurrentFrame2();
  const absoluteFrame = Internals16.useTimelinePosition();
  const videoConfig = Internals16.useUnsafeVideoConfig();
  const { registerRenderAsset, unregisterRenderAsset } = useContext3(Internals16.RenderAssetManager);
  const startsAt = Internals16.useMediaStartsAt();
  const environment = useRemotionEnvironment();
  if (!videoConfig) {
    throw new Error("No video config found");
  }
  if (!src) {
    throw new TypeError("No `src` was passed to <Audio>.");
  }
  const { fps } = videoConfig;
  const { delayRender, continueRender } = useDelayRender();
  const [replaceWithHtml5Audio, setReplaceWithHtml5Audio] = useState2(false);
  const [initialRequestInit] = useState2(requestInit);
  const sequenceContext = useContext3(Internals16.SequenceContext);
  const id = useMemo2(() => `media-audio-${random(src)}-${sequenceContext?.cumulatedFrom}-${sequenceContext?.relativeFrom}-${sequenceContext?.durationInFrames}`, [
    src,
    sequenceContext?.cumulatedFrom,
    sequenceContext?.relativeFrom,
    sequenceContext?.durationInFrames
  ]);
  const maxCacheSize = useMaxMediaCacheSize(logLevel);
  const audioEnabled = Internals16.useAudioEnabled();
  useLayoutEffect2(() => {
    const timestamp = frame / fps;
    const durationInSeconds = 1 / fps;
    const shouldRenderAudio = (() => {
      if (!audioEnabled) {
        return false;
      }
      if (muted) {
        return false;
      }
      return true;
    })();
    if (!shouldRenderAudio) {
      return;
    }
    if (replaceWithHtml5Audio) {
      return;
    }
    const newHandle = delayRender(`Extracting audio for frame ${frame}`, {
      retries: delayRenderRetries ?? undefined,
      timeoutInMilliseconds: delayRenderTimeoutInMilliseconds ?? undefined
    });
    extractFrameViaBroadcastChannel({
      src,
      timeInSeconds: timestamp,
      durationInSeconds,
      playbackRate: playbackRate ?? 1,
      logLevel,
      includeAudio: shouldRenderAudio,
      includeVideo: false,
      isClientSideRendering: environment.isClientSideRendering,
      loop: loop ?? false,
      audioStreamIndex: audioStreamIndex ?? null,
      trimAfter,
      trimBefore,
      fps,
      maxCacheSize,
      credentials,
      requestInit: initialRequestInit
    }).then((result) => {
      const handleError = (error, clientSideError, fallbackMessage) => {
        const [action, errorToUse] = callOnErrorAndResolve({
          onError,
          error,
          disallowFallback: disallowFallbackToHtml5Audio ?? false,
          isClientSideRendering: environment.isClientSideRendering,
          clientSideError
        });
        if (action === "fail") {
          cancelRender2(errorToUse);
        }
        Internals16.Log.warn({ logLevel, tag: "@remotion/media" }, fallbackMessage);
        setReplaceWithHtml5Audio(true);
      };
      if (result.type === "unknown-container-format") {
        handleError(new Error(`Unknown container format ${src}.`), new Error(`Cannot render audio "${src}": Unknown container format. See supported formats: https://www.remotion.dev/docs/mediabunny/formats`), `Unknown container format for ${src} (Supported formats: https://www.remotion.dev/docs/mediabunny/formats), falling back to <Html5Audio>`);
        return;
      }
      if (result.type === "cannot-decode") {
        handleError(new Error(`Cannot decode ${src}.`), new Error(`Cannot render audio "${src}": The audio could not be decoded by the browser.`), `Cannot decode ${src}, falling back to <Html5Audio>`);
        return;
      }
      if (result.type === "cannot-decode-alpha") {
        throw new Error(`Cannot decode alpha component for ${src}, and 'disallowFallbackToHtml5Audio' was set. But this should never happen, since you used the <Audio> tag. Please report this as a bug.`);
      }
      if (result.type === "network-error") {
        handleError(new Error(`Network error fetching ${src}.`), new Error(`Cannot render audio "${src}": Network error while fetching the audio (possibly CORS).`), `Network error fetching ${src}, falling back to <Html5Audio>`);
        return;
      }
      const { audio, durationInSeconds: assetDurationInSeconds } = result;
      const volumePropsFrame = frameForVolumeProp({
        behavior: loopVolumeCurveBehavior ?? "repeat",
        loop: loop ?? false,
        assetDurationInSeconds: assetDurationInSeconds ?? 0,
        fps,
        frame,
        startsAt
      });
      const volume = Internals16.evaluateVolume({
        volume: volumeProp,
        frame: volumePropsFrame,
        mediaVolume: 1
      });
      Internals16.warnAboutTooHighVolume(volume);
      if (audio && volume > 0) {
        applyVolume(audio.data, volume);
        registerRenderAsset({
          type: "inline-audio",
          id,
          audio: environment.isClientSideRendering ? audio.data : Array.from(audio.data),
          frame: absoluteFrame,
          timestamp: audio.timestamp,
          duration: audio.numberOfFrames / getTargetSampleRate() * 1e6,
          toneFrequency: toneFrequency ?? 1
        });
      }
      continueRender(newHandle);
    }).catch((error) => {
      cancelRender2(error);
    });
    return () => {
      continueRender(newHandle);
      unregisterRenderAsset(id);
    };
  }, [
    absoluteFrame,
    continueRender,
    delayRender,
    delayRenderRetries,
    delayRenderTimeoutInMilliseconds,
    disallowFallbackToHtml5Audio,
    environment.isClientSideRendering,
    fps,
    frame,
    id,
    logLevel,
    loop,
    loopVolumeCurveBehavior,
    muted,
    playbackRate,
    registerRenderAsset,
    src,
    startsAt,
    unregisterRenderAsset,
    volumeProp,
    audioStreamIndex,
    toneFrequency,
    trimAfter,
    trimBefore,
    replaceWithHtml5Audio,
    maxCacheSize,
    audioEnabled,
    onError,
    credentials,
    initialRequestInit
  ]);
  if (replaceWithHtml5Audio) {
    return /* @__PURE__ */ jsx2(Html5Audio, {
      src,
      playbackRate,
      muted,
      loop,
      volume: volumeProp,
      delayRenderRetries,
      delayRenderTimeoutInMilliseconds,
      style,
      loopVolumeCurveBehavior,
      audioStreamIndex,
      useWebAudioApi: fallbackHtml5AudioProps?.useWebAudioApi,
      onError: fallbackHtml5AudioProps?.onError,
      toneFrequency,
      acceptableTimeShiftInSeconds: fallbackHtml5AudioProps?.acceptableTimeShiftInSeconds,
      preservePitch: fallbackHtml5AudioProps?.preservePitch ?? true,
      name,
      showInTimeline
    });
  }
  return null;
};
var { validateMediaProps } = Internals17;
var audioSchema = {
  ...Internals17.baseSchema,
  volume: {
    type: "number",
    min: 0,
    max: 20,
    step: 0.01,
    default: 1,
    description: "Volume",
    hiddenFromList: false
  },
  playbackRate: {
    type: "number",
    min: 0.1,
    step: 0.01,
    default: 1,
    description: "Playback rate",
    hiddenFromList: false,
    keyframable: false
  },
  loop: { type: "boolean", default: false, description: "Loop" }
};
var AudioInner = (props) => {
  const {
    name,
    stack,
    showInTimeline,
    controls,
    from,
    durationInFrames,
    freeze,
    hidden,
    ...otherProps
  } = props;
  const environment = useRemotionEnvironment2();
  const [mediaVolume] = Internals17.useMediaVolumeState();
  const mediaStartsAt = Internals17.useMediaStartsAt();
  const videoConfig = useVideoConfig2();
  const sequenceDurationInFrames = Math.min(durationInFrames ?? Infinity, Math.max(0, videoConfig.durationInFrames - (from ?? 0)));
  const basicInfo = Internals17.useBasicMediaInTimeline({
    src: props.src,
    volume: props.volume,
    playbackRate: props.playbackRate ?? 1,
    trimBefore: props.trimBefore,
    trimAfter: props.trimAfter,
    sequenceDurationInFrames,
    mediaType: "audio",
    displayName: name ?? "<Audio>",
    mediaVolume,
    mediaStartsAt,
    loop: props.loop ?? false
  });
  const [mediaDurationInSeconds, setMediaDurationInSeconds] = useState3(null);
  const loopDisplay = useMemo3(() => getLoopDisplay({
    loop: props.loop ?? false,
    mediaDurationInSeconds,
    playbackRate: props.playbackRate ?? 1,
    trimAfter: props.trimAfter,
    trimBefore: props.trimBefore,
    sequenceDurationInFrames,
    compFps: videoConfig.fps
  }), [
    props.loop,
    mediaDurationInSeconds,
    props.playbackRate,
    props.trimAfter,
    props.trimBefore,
    sequenceDurationInFrames,
    videoConfig.fps
  ]);
  const isMedia = useMemo3(() => ({
    type: "audio",
    data: basicInfo
  }), [basicInfo]);
  if (typeof props.src !== "string") {
    throw new TypeError(`The \`<Audio>\` tag requires a string for \`src\`, but got ${JSON.stringify(props.src)} instead.`);
  }
  validateMediaProps({ playbackRate: props.playbackRate, volume: props.volume }, "Audio");
  if (sequenceDurationInFrames === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx3(Sequence, {
    layout: "none",
    from: from ?? 0,
    durationInFrames: basicInfo.duration,
    freeze,
    _remotionInternalStack: stack,
    _remotionInternalIsMedia: isMedia,
    name: name ?? "<Audio>",
    _remotionInternalDocumentationLink: name === undefined ? "https://www.remotion.dev/docs/media/audio" : undefined,
    controls,
    _remotionInternalLoopDisplay: loopDisplay,
    showInTimeline: showInTimeline ?? true,
    hidden,
    children: environment.isRendering ? /* @__PURE__ */ jsx3(AudioForRendering, {
      ...otherProps
    }) : /* @__PURE__ */ jsx3(AudioForPreview, {
      name,
      ...otherProps,
      stack: stack ?? null,
      setMediaDurationInSeconds
    })
  });
};
var Audio = Interactive.withSchema({
  Component: AudioInner,
  componentName: "<Audio>",
  componentIdentity: "dev.remotion.media.Audio",
  schema: audioSchema,
  supportsEffects: false
});
Internals17.addSequenceStackTraces(Audio);
var cache = new Map;
var cacheVideoFrame = (src, sourceCanvas) => {
  const { width, height } = sourceCanvas;
  if (width === 0 || height === 0) {
    return;
  }
  let cached = cache.get(src);
  if (!cached || cached.width !== width || cached.height !== height) {
    cached = new OffscreenCanvas(width, height);
    cache.set(src, cached);
  }
  const ctx = cached.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(sourceCanvas, 0, 0);
};
var getCachedVideoFrame = (src) => {
  return cache.get(src) ?? null;
};
var OBJECT_FIT_CLASS_PATTERN = /\bobject-(contain|cover|fill|none|scale-down)\b/;
var warnedStyle = false;
var warnedClassName = false;
var warnAboutObjectFitInStyleOrClassName = ({
  style,
  className,
  logLevel
}) => {
  if (!warnedStyle && style?.objectFit) {
    warnedStyle = true;
    Internals18.Log.warn({ logLevel, tag: "@remotion/media" }, "Use the `objectFit` prop instead of the `style` prop.");
  }
  if (!warnedClassName && className && OBJECT_FIT_CLASS_PATTERN.test(className)) {
    warnedClassName = true;
    Internals18.Log.warn({ logLevel, tag: "@remotion/media" }, "Use the `objectFit` prop instead of `object-*` CSS class names.");
  }
};
var {
  useUnsafeVideoConfig: useUnsafeVideoConfig2,
  Timeline: Timeline2,
  SharedAudioContext: SharedAudioContext2,
  usePlayerMutedState: usePlayerMutedState2,
  useMediaVolumeState: useMediaVolumeState2,
  useFrameForVolumeProp: useFrameForVolumeProp2,
  evaluateVolume: evaluateVolume2,
  warnAboutTooHighVolume: warnAboutTooHighVolume2,
  usePreload: usePreload2,
  SequenceContext: SequenceContext2,
  useEffectChainState
} = Internals19;
var VideoForPreviewAssertedShowing = ({
  src: unpreloadedSrc,
  style,
  playbackRate,
  logLevel,
  className,
  muted,
  volume,
  loopVolumeCurveBehavior,
  onVideoFrame,
  showInTimeline,
  loop,
  trimAfter,
  trimBefore,
  stack,
  disallowFallbackToOffthreadVideo,
  fallbackOffthreadVideoProps,
  audioStreamIndex,
  debugOverlay,
  headless,
  onError,
  credentials,
  requestInit,
  objectFit: objectFitProp,
  _experimentalInitiallyDrawCachedFrame,
  effects,
  setMediaDurationInSeconds,
  refForOutline,
  ...props
}) => {
  const src = usePreload2(unpreloadedSrc);
  const canvasRef = useRef2(null);
  const videoConfig = useUnsafeVideoConfig2();
  const frame = useCurrentFrame3();
  const mediaPlayerRef = useRef2(null);
  const initialTrimBeforeRef = useRef2(trimBefore);
  const initialTrimAfterRef = useRef2(trimAfter);
  const initialOnVideoFrameRef = useRef2(onVideoFrame);
  const [initialRequestInit] = useState4(requestInit);
  const [mediaPlayerReady, setMediaPlayerReady] = useState4(false);
  const [shouldFallbackToNativeVideo, setShouldFallbackToNativeVideo] = useState4(false);
  const [playing] = Timeline2.usePlayingState();
  const { playbackRate: globalPlaybackRate } = Internals19.usePlaybackRate();
  const sharedAudioContext = useContext4(SharedAudioContext2);
  const buffer = useBufferState2();
  const canvasRefCallback = useCallback((canvas) => {
    canvasRef.current = canvas;
    refForOutline.current = canvas;
  }, [refForOutline]);
  const fallbackVideoRef = useCallback((video) => {
    refForOutline.current = video;
  }, [refForOutline]);
  const [playerMuted] = usePlayerMutedState2();
  const [mediaVolume] = useMediaVolumeState2();
  const volumePropFrame = useFrameForVolumeProp2(loopVolumeCurveBehavior);
  const userPreferredVolume = evaluateVolume2({
    frame: volumePropFrame,
    volume,
    mediaVolume
  });
  if (!videoConfig) {
    throw new Error("No video config found");
  }
  warnAboutTooHighVolume2(userPreferredVolume);
  const effectChainState = useEffectChainState();
  const effectsRef = useRef2(effects);
  effectsRef.current = effects;
  const effectChainStateRef = useRef2(effectChainState);
  effectChainStateRef.current = effectChainState;
  const parentSequence = useContext4(SequenceContext2);
  const isPremounting = Boolean(parentSequence?.premounting);
  const isPostmounting = Boolean(parentSequence?.postmounting);
  const sequenceOffset = (parentSequence?.absoluteFrom ?? 0) / videoConfig.fps;
  const currentTime = frame / videoConfig.fps;
  const currentTimeRef = useRef2(currentTime);
  currentTimeRef.current = currentTime;
  const preloadedSrc = usePreload2(src);
  const buffering = useContext4(Internals19.BufferingContextReact);
  if (!buffering) {
    throw new Error("useMediaPlayback must be used inside a <BufferingContext>");
  }
  const effectiveMuted = muted || playerMuted || userPreferredVolume <= 0;
  const isPlayerBuffering = Internals19.useIsPlayerBuffering(buffering);
  const initialPlaying = useRef2(playing && !isPlayerBuffering);
  const initialIsPremounting = useRef2(isPremounting);
  const initialIsPostmounting = useRef2(isPostmounting);
  const initialGlobalPlaybackRate = useRef2(globalPlaybackRate);
  const initialPlaybackRate = useRef2(playbackRate);
  const initialMuted = useRef2(effectiveMuted);
  const initialSequenceDuration = useRef2(videoConfig.durationInFrames);
  const initialSequenceOffset = useRef2(sequenceOffset);
  const hasDrawnRealFrameRef = useRef2(false);
  const isPremountingRef = useRef2(isPremounting);
  isPremountingRef.current = isPremounting;
  useLayoutEffect3(() => {
    if (!_experimentalInitiallyDrawCachedFrame) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const cached = getCachedVideoFrame(src);
    if (!cached) {
      return;
    }
    canvas.width = cached.width;
    canvas.height = cached.height;
    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true
    });
    if (!ctx) {
      return;
    }
    ctx.drawImage(cached, 0, 0);
  }, [_experimentalInitiallyDrawCachedFrame, src]);
  useLayoutEffect3(() => {
    if (!_experimentalInitiallyDrawCachedFrame) {
      return;
    }
    return () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawnRealFrameRef.current || isPremountingRef.current) {
        return;
      }
      cacheVideoFrame(src, canvas);
    };
  }, [_experimentalInitiallyDrawCachedFrame, src]);
  useEffect2(() => {
    const sharedAudioContextForMediaPlayer = sharedAudioContext?.audioContext && sharedAudioContext.gainNode ? {
      audioContext: sharedAudioContext.audioContext,
      gainNode: sharedAudioContext.gainNode,
      audioSyncAnchor: sharedAudioContext.audioSyncAnchor,
      scheduleAudioNode: sharedAudioContext.scheduleAudioNode,
      unscheduleAudioNode: sharedAudioContext.unscheduleAudioNode
    } : null;
    try {
      const player = new MediaPlayer({
        canvas: canvasRef.current,
        src: preloadedSrc,
        logLevel,
        sharedAudioContext: sharedAudioContextForMediaPlayer,
        loop,
        trimAfter: initialTrimAfterRef.current,
        trimBefore: initialTrimBeforeRef.current,
        fps: videoConfig.fps,
        playbackRate: initialPlaybackRate.current,
        audioStreamIndex,
        debugOverlay,
        bufferState: buffer,
        isPremounting: initialIsPremounting.current,
        isPostmounting: initialIsPostmounting.current,
        globalPlaybackRate: initialGlobalPlaybackRate.current,
        durationInFrames: initialSequenceDuration.current,
        onVideoFrameCallback: initialOnVideoFrameRef.current ?? null,
        playing: initialPlaying.current,
        sequenceOffset: initialSequenceOffset.current,
        credentials,
        requestInit: initialRequestInit,
        tagType: "video",
        getEffects: () => effectsRef.current,
        getEffectChainState: (width, height) => effectChainStateRef.current?.get(width, height)
      });
      mediaPlayerRef.current = player;
      player.initialize(currentTimeRef.current, initialMuted.current).then((result) => {
        if (result.type === "disposed") {
          return;
        }
        const handleError = (error, fallbackMessage) => {
          const [action, errorToUse] = callOnErrorAndResolve({
            onError,
            error,
            disallowFallback: disallowFallbackToOffthreadVideo,
            isClientSideRendering: false,
            clientSideError: error
          });
          if (action === "fail") {
            throw errorToUse;
          }
          Internals19.Log.warn({ logLevel, tag: "@remotion/media" }, fallbackMessage);
          setShouldFallbackToNativeVideo(true);
        };
        if (result.type === "unknown-container-format") {
          handleError(new Error(`Unknown container format ${preloadedSrc}.`), `Unknown container format for ${preloadedSrc} (Supported formats: https://www.remotion.dev/docs/mediabunny/formats), falling back to <OffthreadVideo>`);
          return;
        }
        if (result.type === "network-error") {
          handleError(new Error(`Network error fetching ${preloadedSrc}.`), `Network error fetching ${preloadedSrc}, falling back to <OffthreadVideo>`);
          return;
        }
        if (result.type === "cannot-decode") {
          handleError(new Error(`Cannot decode ${preloadedSrc}.`), `Cannot decode ${preloadedSrc}, falling back to <OffthreadVideo>`);
          return;
        }
        if (result.type === "no-tracks") {
          handleError(new Error(`No video or audio tracks found for ${preloadedSrc}.`), `No video or audio tracks found for ${preloadedSrc}, falling back to <OffthreadVideo>`);
          return;
        }
        if (result.type === "success") {
          setMediaPlayerReady(true);
          setMediaDurationInSeconds(result.durationInSeconds);
          hasDrawnRealFrameRef.current = true;
        }
      }).catch((error) => {
        const [action, errorToUse] = callOnErrorAndResolve({
          onError,
          error,
          disallowFallback: disallowFallbackToOffthreadVideo,
          isClientSideRendering: false,
          clientSideError: error
        });
        if (action === "fail") {
          throw errorToUse;
        }
        Internals19.Log.error({ logLevel, tag: "@remotion/media" }, "[VideoForPreview] Failed to initialize MediaPlayer", errorToUse);
        setShouldFallbackToNativeVideo(true);
      });
    } catch (error) {
      const [action, errorToUse] = callOnErrorAndResolve({
        error,
        onError,
        disallowFallback: disallowFallbackToOffthreadVideo,
        isClientSideRendering: false,
        clientSideError: error
      });
      if (action === "fail") {
        throw errorToUse;
      }
      Internals19.Log.error({ logLevel, tag: "@remotion/media" }, "[VideoForPreview] MediaPlayer initialization failed", errorToUse);
      setShouldFallbackToNativeVideo(true);
    }
    return () => {
      if (mediaPlayerRef.current) {
        Internals19.Log.trace({ logLevel, tag: "@remotion/media" }, `[VideoForPreview] Disposing MediaPlayer`);
        mediaPlayerRef.current.dispose();
        mediaPlayerRef.current = null;
      }
      setMediaPlayerReady(false);
      setShouldFallbackToNativeVideo(false);
      hasDrawnRealFrameRef.current = false;
    };
  }, [
    audioStreamIndex,
    buffer,
    debugOverlay,
    disallowFallbackToOffthreadVideo,
    logLevel,
    loop,
    preloadedSrc,
    sharedAudioContext,
    videoConfig.fps,
    onError,
    credentials,
    initialRequestInit,
    setMediaDurationInSeconds
  ]);
  warnAboutObjectFitInStyleOrClassName({ style, className, logLevel });
  const classNameValue = useMemo4(() => {
    return [Internals19.OBJECTFIT_CONTAIN_CLASS_NAME, className].filter(Internals19.truthy).join(" ");
  }, [className]);
  useCommonEffects({
    mediaPlayerRef,
    mediaPlayerReady,
    currentTimeRef,
    playing,
    isPlayerBuffering,
    frame,
    trimBefore,
    trimAfter,
    effectiveMuted,
    userPreferredVolume,
    playbackRate,
    globalPlaybackRate,
    fps: videoConfig.fps,
    sequenceOffset,
    loop,
    durationInFrames: videoConfig.durationInFrames,
    isPremounting,
    isPostmounting,
    currentTime,
    logLevel,
    label: "VideoForPreview"
  });
  useLayoutEffect3(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setDebugOverlay(debugOverlay);
  }, [debugOverlay, mediaPlayerReady]);
  useLayoutEffect3(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.setVideoFrameCallback(onVideoFrame ?? null);
  }, [onVideoFrame, mediaPlayerReady]);
  useLayoutEffect3(() => {
    const mediaPlayer = mediaPlayerRef.current;
    if (!mediaPlayer || !mediaPlayerReady) {
      return;
    }
    mediaPlayer.redrawVideoEffects().catch(() => {});
  }, [effects, mediaPlayerReady, mediaPlayerRef]);
  const actualStyle = useMemo4(() => {
    return {
      ...style,
      objectFit: objectFitProp
    };
  }, [objectFitProp, style]);
  if (shouldFallbackToNativeVideo && !disallowFallbackToOffthreadVideo) {
    return /* @__PURE__ */ jsx4(Html5Video, {
      ...props,
      ref: fallbackVideoRef,
      src,
      style: actualStyle,
      className,
      muted,
      volume,
      trimAfter,
      trimBefore,
      playbackRate,
      loopVolumeCurveBehavior,
      name: "<Html5Video> (fallback)",
      loop,
      showInTimeline,
      stack: stack ?? undefined,
      ...fallbackOffthreadVideoProps
    });
  }
  if (headless) {
    return null;
  }
  return /* @__PURE__ */ jsx4("canvas", {
    ...props,
    ref: canvasRefCallback,
    style: actualStyle,
    className: classNameValue
  });
};
var VideoForPreview = (props) => {
  const frame = useCurrentFrame3();
  const videoConfig = useVideoConfig3();
  const currentTime = frame / videoConfig.fps;
  const showShow = useMemo4(() => {
    return getTimeInSeconds({
      unloopedTimeInSeconds: currentTime,
      playbackRate: props.playbackRate,
      loop: props.loop,
      trimBefore: props.trimBefore,
      trimAfter: props.trimAfter,
      mediaDurationInSeconds: Infinity,
      fps: videoConfig.fps,
      ifNoMediaDuration: "infinity",
      src: props.src
    }) !== null;
  }, [
    currentTime,
    props.loop,
    props.playbackRate,
    props.src,
    videoConfig.fps,
    props.trimBefore,
    props.trimAfter
  ]);
  if (!showShow) {
    return null;
  }
  return /* @__PURE__ */ jsx4(VideoForPreviewAssertedShowing, {
    ...props
  });
};
var VideoForRendering = ({
  volume: volumeProp,
  playbackRate,
  src,
  muted,
  loopVolumeCurveBehavior,
  delayRenderRetries,
  delayRenderTimeoutInMilliseconds,
  onVideoFrame,
  logLevel,
  loop,
  style,
  className,
  fallbackOffthreadVideoProps,
  audioStreamIndex,
  disallowFallbackToOffthreadVideo,
  stack,
  toneFrequency,
  trimAfterValue,
  trimBeforeValue,
  headless,
  onError,
  credentials,
  requestInit,
  objectFit: objectFitProp,
  effects,
  ...props
}) => {
  if (!src) {
    throw new TypeError("No `src` was passed to <Video>.");
  }
  const frame = useCurrentFrame4();
  const absoluteFrame = Internals20.useTimelinePosition();
  const { fps } = useVideoConfig4();
  const { registerRenderAsset, unregisterRenderAsset } = useContext5(Internals20.RenderAssetManager);
  const startsAt = Internals20.useMediaStartsAt();
  const sequenceContext = useContext5(Internals20.SequenceContext);
  const id = useMemo5(() => `media-video-${random2(src)}-${sequenceContext?.cumulatedFrom}-${sequenceContext?.relativeFrom}-${sequenceContext?.durationInFrames}`, [
    src,
    sequenceContext?.cumulatedFrom,
    sequenceContext?.relativeFrom,
    sequenceContext?.durationInFrames
  ]);
  const environment = useRemotionEnvironment3();
  const { delayRender, continueRender, cancelRender: cancelRender3 } = useDelayRender2();
  const canvasRef = useRef3(null);
  const [replaceWithOffthreadVideo, setReplaceWithOffthreadVideo] = useState5(false);
  const [initialRequestInit] = useState5(requestInit);
  const audioEnabled = Internals20.useAudioEnabled();
  const videoEnabled = Internals20.useVideoEnabled();
  const maxCacheSize = useMaxMediaCacheSize(logLevel);
  const effectChainState = Internals20.useEffectChainState();
  const [error, setError] = useState5(null);
  if (error) {
    throw error;
  }
  useLayoutEffect4(() => {
    if (!canvasRef.current && !headless) {
      return;
    }
    if (replaceWithOffthreadVideo) {
      return;
    }
    if (!canvasRef.current?.getContext && !headless) {
      return setError(new Error("Canvas does not have .getContext() method available. This could be because <Video> was mounted inside an <svg> tag."));
    }
    const timestamp = frame / fps;
    const durationInSeconds = 1 / fps;
    const newHandle = delayRender(`Extracting frame at time ${timestamp} from ${src}`, {
      retries: delayRenderRetries ?? undefined,
      timeoutInMilliseconds: delayRenderTimeoutInMilliseconds ?? undefined
    });
    const shouldRenderAudio = (() => {
      if (!audioEnabled) {
        return false;
      }
      if (muted) {
        return false;
      }
      return true;
    })();
    extractFrameViaBroadcastChannel({
      src,
      timeInSeconds: timestamp,
      durationInSeconds,
      playbackRate,
      logLevel,
      includeAudio: shouldRenderAudio,
      includeVideo: videoEnabled,
      isClientSideRendering: environment.isClientSideRendering,
      loop,
      audioStreamIndex,
      trimAfter: trimAfterValue,
      trimBefore: trimBeforeValue,
      fps,
      maxCacheSize,
      credentials,
      requestInit: initialRequestInit
    }).then(async (result) => {
      const handleError = (err, clientSideError, fallbackMessage, mediaDurationInSeconds) => {
        if (environment.isClientSideRendering) {
          cancelRender3(clientSideError);
          return;
        }
        const [action, errorToUse] = callOnErrorAndResolve({
          onError,
          error: err,
          disallowFallback: disallowFallbackToOffthreadVideo,
          isClientSideRendering: environment.isClientSideRendering,
          clientSideError: err
        });
        if (action === "fail") {
          cancelRender3(errorToUse);
          return;
        }
        if (window.remotion_isMainTab) {
          Internals20.Log.warn({ logLevel, tag: "@remotion/media" }, fallbackMessage);
        }
        setReplaceWithOffthreadVideo({
          durationInSeconds: mediaDurationInSeconds
        });
      };
      if (result.type === "unknown-container-format") {
        handleError(new Error(`Unknown container format ${src}.`), new Error(`Cannot render video "${src}": Unknown container format. See supported formats: https://www.remotion.dev/docs/mediabunny/formats`), `Unknown container format for ${src} (Supported formats: https://www.remotion.dev/docs/mediabunny/formats), falling back to <OffthreadVideo>`, null);
        return;
      }
      if (result.type === "cannot-decode") {
        handleError(new Error(`Cannot decode ${src}.`), new Error(`Cannot render video "${src}": The video could not be decoded by the browser.`), `Cannot decode ${src}, falling back to <OffthreadVideo>`, result.durationInSeconds);
        return;
      }
      if (result.type === "cannot-decode-alpha") {
        handleError(new Error(`Cannot decode alpha component for ${src}.`), new Error(`Cannot render video "${src}": The alpha channel could not be decoded by the browser.`), `Cannot decode alpha component for ${src}, falling back to <OffthreadVideo>`, result.durationInSeconds);
        return;
      }
      if (result.type === "network-error") {
        handleError(new Error(`Network error fetching ${src}.`), new Error(`Cannot render video "${src}": Network error while fetching the video (possibly CORS).`), `Network error fetching ${src} (no CORS?), falling back to <OffthreadVideo>`, null);
        return;
      }
      const {
        frame: imageBitmap,
        audio,
        durationInSeconds: assetDurationInSeconds
      } = result;
      if (imageBitmap) {
        onVideoFrame?.(imageBitmap);
        const context = canvasRef.current?.getContext("2d", {
          alpha: true
        });
        if (context) {
          context.canvas.width = imageBitmap.width;
          context.canvas.height = imageBitmap.height;
          context.canvas.style.aspectRatio = `${context.canvas.width} / ${context.canvas.height}`;
          context.drawImage(imageBitmap, 0, 0);
          if (effects.length > 0) {
            const completed = await Internals20.runEffectChain({
              state: effectChainState.get(imageBitmap.width, imageBitmap.height),
              source: context.canvas,
              effects,
              output: context.canvas,
              width: imageBitmap.width,
              height: imageBitmap.height
            });
            if (!completed) {
              imageBitmap.close();
              return;
            }
          }
        }
        imageBitmap.close();
      } else if (videoEnabled) {
        const context = canvasRef.current?.getContext("2d", {
          alpha: true
        });
        if (context) {
          context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
      }
      const volumePropsFrame = frameForVolumeProp({
        behavior: loopVolumeCurveBehavior,
        loop,
        assetDurationInSeconds: assetDurationInSeconds ?? 0,
        fps,
        frame,
        startsAt
      });
      const volume = Internals20.evaluateVolume({
        volume: volumeProp,
        frame: volumePropsFrame,
        mediaVolume: 1
      });
      Internals20.warnAboutTooHighVolume(volume);
      if (audio && volume > 0) {
        applyVolume(audio.data, volume);
        registerRenderAsset({
          type: "inline-audio",
          id,
          audio: environment.isClientSideRendering ? audio.data : Array.from(audio.data),
          frame: absoluteFrame,
          timestamp: audio.timestamp,
          duration: audio.numberOfFrames / getTargetSampleRate() * 1e6,
          toneFrequency
        });
      }
      continueRender(newHandle);
    }).catch((err) => {
      cancelRender3(err);
    });
    return () => {
      continueRender(newHandle);
      unregisterRenderAsset(id);
    };
  }, [
    absoluteFrame,
    continueRender,
    delayRender,
    delayRenderRetries,
    delayRenderTimeoutInMilliseconds,
    environment.isClientSideRendering,
    fps,
    frame,
    id,
    logLevel,
    loop,
    loopVolumeCurveBehavior,
    muted,
    onVideoFrame,
    playbackRate,
    registerRenderAsset,
    src,
    startsAt,
    unregisterRenderAsset,
    volumeProp,
    replaceWithOffthreadVideo,
    audioStreamIndex,
    disallowFallbackToOffthreadVideo,
    toneFrequency,
    trimAfterValue,
    trimBeforeValue,
    audioEnabled,
    videoEnabled,
    maxCacheSize,
    cancelRender3,
    headless,
    onError,
    credentials,
    effectChainState,
    effects,
    initialRequestInit
  ]);
  warnAboutObjectFitInStyleOrClassName({ style, className, logLevel });
  const classNameValue = useMemo5(() => {
    return [Internals20.OBJECTFIT_CONTAIN_CLASS_NAME, className].filter(Internals20.truthy).join(" ");
  }, [className]);
  const styleWithObjectFit = useMemo5(() => {
    return {
      ...style,
      objectFit: objectFitProp
    };
  }, [objectFitProp, style]);
  if (replaceWithOffthreadVideo) {
    const fallback = /* @__PURE__ */ jsx5(Internals20.InnerOffthreadVideo, {
      ...props,
      src,
      playbackRate: playbackRate ?? 1,
      muted: muted ?? false,
      acceptableTimeShiftInSeconds: fallbackOffthreadVideoProps?.acceptableTimeShiftInSeconds,
      loopVolumeCurveBehavior: loopVolumeCurveBehavior ?? "repeat",
      delayRenderRetries: delayRenderRetries ?? undefined,
      delayRenderTimeoutInMilliseconds: delayRenderTimeoutInMilliseconds ?? undefined,
      name: "Fallback to <OffthreadVideo>",
      style: styleWithObjectFit,
      allowAmplificationDuringRender: true,
      transparent: fallbackOffthreadVideoProps?.transparent ?? true,
      toneMapped: fallbackOffthreadVideoProps?.toneMapped ?? true,
      audioStreamIndex: audioStreamIndex ?? 0,
      className,
      onVideoFrame,
      volume: volumeProp,
      id,
      onError: fallbackOffthreadVideoProps?.onError,
      toneFrequency,
      showInTimeline: false,
      crossOrigin: fallbackOffthreadVideoProps?.crossOrigin,
      onAutoPlayError: fallbackOffthreadVideoProps?.onAutoPlayError ?? null,
      pauseWhenBuffering: fallbackOffthreadVideoProps?.pauseWhenBuffering ?? false,
      trimAfter: trimAfterValue,
      trimBefore: trimBeforeValue,
      useWebAudioApi: fallbackOffthreadVideoProps?.useWebAudioApi ?? false,
      preservePitch: fallbackOffthreadVideoProps?.preservePitch ?? true,
      startFrom: undefined,
      endAt: undefined,
      stack,
      _remotionInternalNativeLoopPassed: false
    });
    if (loop) {
      if (!replaceWithOffthreadVideo.durationInSeconds) {
        const err = new Error(`Cannot render video ${src}: @remotion/media was unable to render, and fell back to <OffthreadVideo>. Also, "loop" was set, but <OffthreadVideo> does not support looping and @remotion/media could also not determine the duration of the video.`);
        cancelRender3(err);
        throw err;
      }
      return /* @__PURE__ */ jsx5(Loop, {
        layout: "none",
        durationInFrames: Internals20.calculateMediaDuration({
          trimAfter: trimAfterValue,
          mediaDurationInFrames: replaceWithOffthreadVideo.durationInSeconds * fps,
          playbackRate,
          trimBefore: trimBeforeValue
        }),
        children: fallback
      });
    }
    return fallback;
  }
  if (headless) {
    return null;
  }
  return /* @__PURE__ */ jsx5("canvas", {
    ...props,
    ref: canvasRef,
    style: styleWithObjectFit,
    className: classNameValue
  });
};
var { validateMediaTrimProps, resolveTrimProps, validateMediaProps: validateMediaProps2 } = Internals21;
var videoSchema = {
  ...Internals21.baseSchema,
  volume: {
    type: "number",
    min: 0,
    max: 20,
    step: 0.01,
    default: 1,
    description: "Volume",
    hiddenFromList: false
  },
  playbackRate: {
    type: "number",
    min: 0.1,
    step: 0.01,
    default: 1,
    description: "Playback rate",
    hiddenFromList: false,
    keyframable: false
  },
  loop: { type: "boolean", default: false, description: "Loop" },
  ...Internals21.transformSchema
};
var InnerVideo = ({
  src,
  audioStreamIndex,
  className,
  delayRenderRetries,
  delayRenderTimeoutInMilliseconds,
  disallowFallbackToOffthreadVideo,
  fallbackOffthreadVideoProps,
  logLevel,
  loop,
  loopVolumeCurveBehavior,
  muted,
  onVideoFrame,
  playbackRate,
  style,
  trimAfter,
  trimBefore,
  volume,
  stack,
  toneFrequency,
  showInTimeline,
  debugOverlay,
  headless,
  onError,
  credentials,
  requestInit,
  controls,
  objectFit,
  _experimentalInitiallyDrawCachedFrame,
  effects,
  setMediaDurationInSeconds,
  refForOutline,
  ...props
}) => {
  const environment = useRemotionEnvironment4();
  if (typeof src !== "string") {
    throw new TypeError(`The \`<Video>\` tag requires a string for \`src\`, but got ${JSON.stringify(src)} instead.`);
  }
  validateMediaTrimProps({
    startFrom: undefined,
    endAt: undefined,
    trimBefore,
    trimAfter
  });
  const { trimBeforeValue, trimAfterValue } = resolveTrimProps({
    startFrom: undefined,
    endAt: undefined,
    trimBefore,
    trimAfter
  });
  validateMediaProps2({ playbackRate, volume }, "Video");
  if (environment.isRendering) {
    return /* @__PURE__ */ jsx6(VideoForRendering, {
      ...props,
      audioStreamIndex: audioStreamIndex ?? 0,
      className,
      delayRenderRetries: delayRenderRetries ?? null,
      delayRenderTimeoutInMilliseconds: delayRenderTimeoutInMilliseconds ?? null,
      disallowFallbackToOffthreadVideo: disallowFallbackToOffthreadVideo ?? false,
      fallbackOffthreadVideoProps,
      logLevel,
      loop,
      loopVolumeCurveBehavior,
      muted,
      onVideoFrame,
      playbackRate,
      src,
      stack,
      style,
      volume,
      toneFrequency,
      trimAfterValue,
      trimBeforeValue,
      headless,
      onError,
      credentials,
      requestInit,
      objectFit,
      effects
    });
  }
  return /* @__PURE__ */ jsx6(VideoForPreview, {
    ...props,
    setMediaDurationInSeconds,
    audioStreamIndex: audioStreamIndex ?? 0,
    className,
    logLevel,
    loop,
    loopVolumeCurveBehavior,
    muted,
    onVideoFrame,
    playbackRate,
    src,
    style,
    volume,
    showInTimeline,
    trimAfter: trimAfterValue,
    trimBefore: trimBeforeValue,
    stack: stack ?? null,
    disallowFallbackToOffthreadVideo,
    fallbackOffthreadVideoProps,
    debugOverlay: debugOverlay ?? false,
    headless: headless ?? false,
    onError,
    credentials,
    requestInit,
    controls,
    objectFit,
    effects,
    _experimentalInitiallyDrawCachedFrame,
    refForOutline
  });
};
var VideoInner = ({
  src,
  audioStreamIndex,
  className,
  delayRenderRetries,
  delayRenderTimeoutInMilliseconds,
  disallowFallbackToOffthreadVideo,
  fallbackOffthreadVideoProps,
  logLevel,
  loop,
  loopVolumeCurveBehavior,
  muted,
  name,
  onVideoFrame,
  playbackRate,
  showInTimeline,
  style,
  trimAfter,
  trimBefore,
  volume,
  stack,
  toneFrequency,
  debugOverlay,
  headless,
  onError,
  credentials,
  requestInit,
  controls,
  objectFit,
  _experimentalInitiallyDrawCachedFrame,
  effects,
  durationInFrames,
  from,
  freeze,
  hidden,
  ...props
}) => {
  const fallbackLogLevel = Internals21.useLogLevel();
  const [mediaVolume] = Internals21.useMediaVolumeState();
  const mediaStartsAt = Internals21.useMediaStartsAt();
  const videoConfig = useVideoConfig5();
  const sequenceDurationInFrames = Math.min(durationInFrames ?? Infinity, Math.max(0, videoConfig.durationInFrames - (from ?? 0)));
  const basicInfo = Internals21.useBasicMediaInTimeline({
    src,
    volume,
    playbackRate: playbackRate ?? 1,
    trimBefore,
    trimAfter,
    sequenceDurationInFrames,
    mediaType: "video",
    displayName: name ?? "<Video>",
    mediaVolume,
    mediaStartsAt,
    loop: loop ?? false
  });
  const [mediaDurationInSeconds, setMediaDurationInSeconds] = useState6(null);
  const loopDisplay = useMemo6(() => getLoopDisplay({
    loop: loop ?? false,
    mediaDurationInSeconds,
    playbackRate: playbackRate ?? 1,
    trimAfter,
    trimBefore,
    sequenceDurationInFrames,
    compFps: videoConfig.fps
  }), [
    loop,
    mediaDurationInSeconds,
    playbackRate,
    trimAfter,
    trimBefore,
    sequenceDurationInFrames,
    videoConfig.fps
  ]);
  const isMedia = useMemo6(() => ({
    type: "video",
    data: basicInfo
  }), [basicInfo]);
  const memoizedEffects = Internals21.useMemoizedEffects({
    effects: effects ?? [],
    overrideId: controls?.overrideId ?? null
  });
  const memoizedEffectDefinitions = Internals21.useMemoizedEffectDefinitions(effects ?? []);
  const refForOutline = React6.useRef(null);
  if (sequenceDurationInFrames === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx6(Sequence2, {
    layout: "none",
    from: from ?? 0,
    durationInFrames: basicInfo.duration,
    freeze,
    _remotionInternalStack: stack,
    _remotionInternalIsMedia: isMedia,
    name: name ?? "<Video>",
    _remotionInternalDocumentationLink: name === undefined ? "https://www.remotion.dev/docs/media/video" : undefined,
    controls,
    _remotionInternalLoopDisplay: loopDisplay,
    _remotionInternalEffects: memoizedEffectDefinitions,
    outlineRef: refForOutline,
    showInTimeline: showInTimeline ?? true,
    hidden,
    children: /* @__PURE__ */ jsx6(InnerVideo, {
      ...props,
      audioStreamIndex: audioStreamIndex ?? 0,
      className,
      delayRenderRetries: delayRenderRetries ?? null,
      delayRenderTimeoutInMilliseconds: delayRenderTimeoutInMilliseconds ?? null,
      disallowFallbackToOffthreadVideo: disallowFallbackToOffthreadVideo ?? false,
      fallbackOffthreadVideoProps: fallbackOffthreadVideoProps ?? {},
      logLevel: logLevel ?? fallbackLogLevel,
      loop: loop ?? false,
      loopVolumeCurveBehavior: loopVolumeCurveBehavior ?? "repeat",
      muted: muted ?? false,
      onVideoFrame,
      playbackRate: playbackRate ?? 1,
      showInTimeline: showInTimeline ?? true,
      src,
      style: style ?? {},
      trimAfter,
      trimBefore,
      volume: volume ?? 1,
      toneFrequency: toneFrequency ?? 1,
      stack,
      debugOverlay: debugOverlay ?? false,
      headless: headless ?? false,
      onError,
      credentials,
      requestInit,
      controls,
      objectFit: objectFit ?? "contain",
      _experimentalInitiallyDrawCachedFrame: _experimentalInitiallyDrawCachedFrame ?? false,
      effects: memoizedEffects,
      setMediaDurationInSeconds,
      refForOutline
    })
  });
};
var Video = Interactive2.withSchema({
  Component: VideoInner,
  componentName: "<Video>",
  componentIdentity: "dev.remotion.media.Video",
  schema: videoSchema,
  supportsEffects: true
});
Internals21.addSequenceStackTraces(Video);
var experimental_Audio = Audio;
var experimental_Video = Video;

// synth:/Users/iagh/git/claude-design/apps/studio/.runtime-bundle-@remotion_media-entry.tsx
var {
  Audio: Audio2,
  AudioForPreview: AudioForPreview2,
  Video: Video2,
  experimental_Audio: experimental_Audio2,
  experimental_Video: experimental_Video2,
  getTargetSampleRate: getTargetSampleRate2
} = exports_esm;
var __runtime_bundle_remotion_media_entry_default = exports_esm;
export {
  getTargetSampleRate2 as getTargetSampleRate,
  experimental_Video2 as experimental_Video,
  experimental_Audio2 as experimental_Audio,
  __runtime_bundle_remotion_media_entry_default as default,
  Video2 as Video,
  AudioForPreview2 as AudioForPreview,
  Audio2 as Audio
};
