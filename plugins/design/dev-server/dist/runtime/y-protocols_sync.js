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
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as Y from "yjs";
var messageYjsSyncStep1 = 0;
var messageYjsSyncStep2 = 1;
var messageYjsUpdate = 2;
var writeSyncStep1 = (encoder, doc) => {
  encoding.writeVarUint(encoder, messageYjsSyncStep1);
  const sv = Y.encodeStateVector(doc);
  encoding.writeVarUint8Array(encoder, sv);
};
var writeSyncStep2 = (encoder, doc, encodedStateVector) => {
  encoding.writeVarUint(encoder, messageYjsSyncStep2);
  encoding.writeVarUint8Array(encoder, Y.encodeStateAsUpdate(doc, encodedStateVector));
};
var readSyncStep1 = (decoder, encoder, doc) => writeSyncStep2(encoder, doc, decoding.readVarUint8Array(decoder));
var readSyncStep2 = (decoder, doc, transactionOrigin, errorHandler) => {
  try {
    Y.applyUpdate(doc, decoding.readVarUint8Array(decoder), transactionOrigin);
  } catch (error) {
    if (errorHandler != null)
      errorHandler(error);
    console.error("Caught error while handling a Yjs update", error);
  }
};
var writeUpdate = (encoder, update) => {
  encoding.writeVarUint(encoder, messageYjsUpdate);
  encoding.writeVarUint8Array(encoder, update);
};
var readUpdate = readSyncStep2;
var readSyncMessage = (decoder, encoder, doc, transactionOrigin, errorHandler) => {
  const messageType = decoding.readVarUint(decoder);
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

// synth:/Users/iagh/git/claude-design/plugins/design/dev-server/.runtime-bundle-y-protocols_sync-entry.tsx
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
