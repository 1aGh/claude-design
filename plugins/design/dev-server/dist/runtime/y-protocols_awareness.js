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

// ../../../node_modules/.pnpm/y-protocols@1.0.7_yjs@13.6.30/node_modules/y-protocols/awareness.js
var exports_awareness = {};
__export(exports_awareness, {
  removeAwarenessStates: () => removeAwarenessStates,
  outdatedTimeout: () => outdatedTimeout,
  modifyAwarenessUpdate: () => modifyAwarenessUpdate,
  encodeAwarenessUpdate: () => encodeAwarenessUpdate,
  applyAwarenessUpdate: () => applyAwarenessUpdate,
  Awareness: () => Awareness
});
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/math.js
var floor = Math.floor;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/time.js
var getUnixTime = Date.now;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/map.js
var create = () => new Map;
var setIfUndefined = (map, key, createT) => {
  let set = map.get(key);
  if (set === undefined) {
    map.set(key, set = createT());
  }
  return set;
};

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/set.js
var create2 = () => new Set;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/array.js
var from2 = Array.from;

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/observable.js
class Observable {
  constructor() {
    this._observers = create();
  }
  on(name, f) {
    setIfUndefined(this._observers, name, create2).add(f);
  }
  once(name, f) {
    const _f = (...args) => {
      this.off(name, _f);
      f(...args);
    };
    this.on(name, _f);
  }
  off(name, f) {
    const observers = this._observers.get(name);
    if (observers !== undefined) {
      observers.delete(f);
      if (observers.size === 0) {
        this._observers.delete(name);
      }
    }
  }
  emit(name, args) {
    return from2((this._observers.get(name) || create()).values()).forEach((f) => f(...args));
  }
  destroy() {
    this._observers = create();
  }
}

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/trait/equality.js
var EqualityTraitSymbol = Symbol("Equality");

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/object.js
var keys = Object.keys;
var size = (obj) => keys(obj).length;
var hasProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// ../../../node_modules/.pnpm/lib0@0.2.117/node_modules/lib0/function.js
var equalityDeep = (a, b) => {
  if (a === b) {
    return true;
  }
  if (a == null || b == null || a.constructor !== b.constructor && (a.constructor || Object) !== (b.constructor || Object)) {
    return false;
  }
  if (a[EqualityTraitSymbol] != null) {
    return a[EqualityTraitSymbol](b);
  }
  switch (a.constructor) {
    case ArrayBuffer:
      a = new Uint8Array(a);
      b = new Uint8Array(b);
    case Uint8Array: {
      if (a.byteLength !== b.byteLength) {
        return false;
      }
      for (let i = 0;i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      break;
    }
    case Set: {
      if (a.size !== b.size) {
        return false;
      }
      for (const value of a) {
        if (!b.has(value)) {
          return false;
        }
      }
      break;
    }
    case Map: {
      if (a.size !== b.size) {
        return false;
      }
      for (const key of a.keys()) {
        if (!b.has(key) || !equalityDeep(a.get(key), b.get(key))) {
          return false;
        }
      }
      break;
    }
    case undefined:
    case Object:
      if (size(a) !== size(b)) {
        return false;
      }
      for (const key in a) {
        if (!hasProperty(a, key) || !equalityDeep(a[key], b[key])) {
          return false;
        }
      }
      break;
    case Array:
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0;i < a.length; i++) {
        if (!equalityDeep(a[i], b[i])) {
          return false;
        }
      }
      break;
    default:
      return false;
  }
  return true;
};

// ../../../node_modules/.pnpm/y-protocols@1.0.7_yjs@13.6.30/node_modules/y-protocols/awareness.js
import * as Y from "yjs";
var outdatedTimeout = 30000;

class Awareness extends Observable {
  constructor(doc) {
    super();
    this.doc = doc;
    this.clientID = doc.clientID;
    this.states = new Map;
    this.meta = new Map;
    this._checkInterval = setInterval(() => {
      const now = getUnixTime();
      if (this.getLocalState() !== null && outdatedTimeout / 2 <= now - this.meta.get(this.clientID).lastUpdated) {
        this.setLocalState(this.getLocalState());
      }
      const remove = [];
      this.meta.forEach((meta, clientid) => {
        if (clientid !== this.clientID && outdatedTimeout <= now - meta.lastUpdated && this.states.has(clientid)) {
          remove.push(clientid);
        }
      });
      if (remove.length > 0) {
        removeAwarenessStates(this, remove, "timeout");
      }
    }, floor(outdatedTimeout / 10));
    doc.on("destroy", () => {
      this.destroy();
    });
    this.setLocalState({});
  }
  destroy() {
    this.emit("destroy", [this]);
    this.setLocalState(null);
    super.destroy();
    clearInterval(this._checkInterval);
  }
  getLocalState() {
    return this.states.get(this.clientID) || null;
  }
  setLocalState(state) {
    const clientID = this.clientID;
    const currLocalMeta = this.meta.get(clientID);
    const clock = currLocalMeta === undefined ? 0 : currLocalMeta.clock + 1;
    const prevState = this.states.get(clientID);
    if (state === null) {
      this.states.delete(clientID);
    } else {
      this.states.set(clientID, state);
    }
    this.meta.set(clientID, {
      clock,
      lastUpdated: getUnixTime()
    });
    const added = [];
    const updated = [];
    const filteredUpdated = [];
    const removed = [];
    if (state === null) {
      removed.push(clientID);
    } else if (prevState == null) {
      if (state != null) {
        added.push(clientID);
      }
    } else {
      updated.push(clientID);
      if (!equalityDeep(prevState, state)) {
        filteredUpdated.push(clientID);
      }
    }
    if (added.length > 0 || filteredUpdated.length > 0 || removed.length > 0) {
      this.emit("change", [{ added, updated: filteredUpdated, removed }, "local"]);
    }
    this.emit("update", [{ added, updated, removed }, "local"]);
  }
  setLocalStateField(field, value) {
    const state = this.getLocalState();
    if (state !== null) {
      this.setLocalState({
        ...state,
        [field]: value
      });
    }
  }
  getStates() {
    return this.states;
  }
}
var removeAwarenessStates = (awareness, clients, origin) => {
  const removed = [];
  for (let i = 0;i < clients.length; i++) {
    const clientID = clients[i];
    if (awareness.states.has(clientID)) {
      awareness.states.delete(clientID);
      if (clientID === awareness.clientID) {
        const curMeta = awareness.meta.get(clientID);
        awareness.meta.set(clientID, {
          clock: curMeta.clock + 1,
          lastUpdated: getUnixTime()
        });
      }
      removed.push(clientID);
    }
  }
  if (removed.length > 0) {
    awareness.emit("change", [{ added: [], updated: [], removed }, origin]);
    awareness.emit("update", [{ added: [], updated: [], removed }, origin]);
  }
};
var encodeAwarenessUpdate = (awareness, clients, states = awareness.states) => {
  const len = clients.length;
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, len);
  for (let i = 0;i < len; i++) {
    const clientID = clients[i];
    const state = states.get(clientID) || null;
    const clock = awareness.meta.get(clientID).clock;
    encoding.writeVarUint(encoder, clientID);
    encoding.writeVarUint(encoder, clock);
    encoding.writeVarString(encoder, JSON.stringify(state));
  }
  return encoding.toUint8Array(encoder);
};
var modifyAwarenessUpdate = (update, modify) => {
  const decoder = decoding.createDecoder(update);
  const encoder = encoding.createEncoder();
  const len = decoding.readVarUint(decoder);
  encoding.writeVarUint(encoder, len);
  for (let i = 0;i < len; i++) {
    const clientID = decoding.readVarUint(decoder);
    const clock = decoding.readVarUint(decoder);
    const state = JSON.parse(decoding.readVarString(decoder));
    const modifiedState = modify(state);
    encoding.writeVarUint(encoder, clientID);
    encoding.writeVarUint(encoder, clock);
    encoding.writeVarString(encoder, JSON.stringify(modifiedState));
  }
  return encoding.toUint8Array(encoder);
};
var applyAwarenessUpdate = (awareness, update, origin) => {
  const decoder = decoding.createDecoder(update);
  const timestamp = getUnixTime();
  const added = [];
  const updated = [];
  const filteredUpdated = [];
  const removed = [];
  const len = decoding.readVarUint(decoder);
  for (let i = 0;i < len; i++) {
    const clientID = decoding.readVarUint(decoder);
    let clock = decoding.readVarUint(decoder);
    const state = JSON.parse(decoding.readVarString(decoder));
    const clientMeta = awareness.meta.get(clientID);
    const prevState = awareness.states.get(clientID);
    const currClock = clientMeta === undefined ? 0 : clientMeta.clock;
    if (currClock < clock || currClock === clock && state === null && awareness.states.has(clientID)) {
      if (state === null) {
        if (clientID === awareness.clientID && awareness.getLocalState() != null) {
          clock++;
        } else {
          awareness.states.delete(clientID);
        }
      } else {
        awareness.states.set(clientID, state);
      }
      awareness.meta.set(clientID, {
        clock,
        lastUpdated: timestamp
      });
      if (clientMeta === undefined && state !== null) {
        added.push(clientID);
      } else if (clientMeta !== undefined && state === null) {
        removed.push(clientID);
      } else if (state !== null) {
        if (!equalityDeep(state, prevState)) {
          filteredUpdated.push(clientID);
        }
        updated.push(clientID);
      }
    }
  }
  if (added.length > 0 || filteredUpdated.length > 0 || removed.length > 0) {
    awareness.emit("change", [{
      added,
      updated: filteredUpdated,
      removed
    }, origin]);
  }
  if (added.length > 0 || updated.length > 0 || removed.length > 0) {
    awareness.emit("update", [{
      added,
      updated,
      removed
    }, origin]);
  }
};

// synth:/Users/iagh/git/claude-design/plugins/design/dev-server/.runtime-bundle-y-protocols_awareness-entry.tsx
var {
  Awareness: Awareness2,
  applyAwarenessUpdate: applyAwarenessUpdate2,
  encodeAwarenessUpdate: encodeAwarenessUpdate2,
  modifyAwarenessUpdate: modifyAwarenessUpdate2,
  outdatedTimeout: outdatedTimeout2,
  removeAwarenessStates: removeAwarenessStates2
} = exports_awareness;
var __runtime_bundle_y_protocols_awareness_entry_default = exports_awareness;
export {
  removeAwarenessStates2 as removeAwarenessStates,
  outdatedTimeout2 as outdatedTimeout,
  modifyAwarenessUpdate2 as modifyAwarenessUpdate,
  encodeAwarenessUpdate2 as encodeAwarenessUpdate,
  __runtime_bundle_y_protocols_awareness_entry_default as default,
  applyAwarenessUpdate2 as applyAwarenessUpdate,
  Awareness2 as Awareness
};
