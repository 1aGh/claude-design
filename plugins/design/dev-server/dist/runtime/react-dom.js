var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// ../../../node_modules/.pnpm/react-dom@19.2.6_react@19.2.6/node_modules/react-dom/cjs/react-dom.production.js
var exports_react_dom_production = {};
__export(exports_react_dom_production, {
  version: () => $version,
  useFormStatus: () => $useFormStatus,
  useFormState: () => $useFormState,
  unstable_batchedUpdates: () => $unstable_batchedUpdates,
  requestFormReset: () => $requestFormReset,
  preloadModule: () => $preloadModule,
  preload: () => $preload,
  preinitModule: () => $preinitModule,
  preinit: () => $preinit,
  prefetchDNS: () => $prefetchDNS,
  preconnect: () => $preconnect,
  flushSync: () => $flushSync,
  createPortal: () => $createPortal,
  __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: () => $__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
});
import * as React from "react";
function formatProdErrorMessage(code) {
  var url = "https://react.dev/errors/" + code;
  if (1 < arguments.length) {
    url += "?args[]=" + encodeURIComponent(arguments[1]);
    for (var i = 2;i < arguments.length; i++)
      url += "&args[]=" + encodeURIComponent(arguments[i]);
  }
  return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
function noop() {}
function createPortal$1(children, containerInfo, implementation) {
  var key = 3 < arguments.length && arguments[3] !== undefined ? arguments[3] : null;
  return {
    $$typeof: REACT_PORTAL_TYPE,
    key: key == null ? null : "" + key,
    children,
    containerInfo,
    implementation
  };
}
function getCrossOriginStringAs(as, input) {
  if (as === "font")
    return "";
  if (typeof input === "string")
    return input === "use-credentials" ? input : "";
}
var Internals, REACT_PORTAL_TYPE, ReactSharedInternals, $__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, $createPortal = function(children, container) {
  var key = 2 < arguments.length && arguments[2] !== undefined ? arguments[2] : null;
  if (!container || container.nodeType !== 1 && container.nodeType !== 9 && container.nodeType !== 11)
    throw Error(formatProdErrorMessage(299));
  return createPortal$1(children, container, null, key);
}, $flushSync = function(fn) {
  var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
  try {
    if (ReactSharedInternals.T = null, Internals.p = 2, fn)
      return fn();
  } finally {
    ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f();
  }
}, $preconnect = function(href, options) {
  typeof href === "string" && (options ? (options = options.crossOrigin, options = typeof options === "string" ? options === "use-credentials" ? options : "" : undefined) : options = null, Internals.d.C(href, options));
}, $prefetchDNS = function(href) {
  typeof href === "string" && Internals.d.D(href);
}, $preinit = function(href, options) {
  if (typeof href === "string" && options && typeof options.as === "string") {
    var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = typeof options.integrity === "string" ? options.integrity : undefined, fetchPriority = typeof options.fetchPriority === "string" ? options.fetchPriority : undefined;
    as === "style" ? Internals.d.S(href, typeof options.precedence === "string" ? options.precedence : undefined, {
      crossOrigin,
      integrity,
      fetchPriority
    }) : as === "script" && Internals.d.X(href, {
      crossOrigin,
      integrity,
      fetchPriority,
      nonce: typeof options.nonce === "string" ? options.nonce : undefined
    });
  }
}, $preinitModule = function(href, options) {
  if (typeof href === "string")
    if (typeof options === "object" && options !== null) {
      if (options.as == null || options.as === "script") {
        var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
        Internals.d.M(href, {
          crossOrigin,
          integrity: typeof options.integrity === "string" ? options.integrity : undefined,
          nonce: typeof options.nonce === "string" ? options.nonce : undefined
        });
      }
    } else
      options == null && Internals.d.M(href);
}, $preload = function(href, options) {
  if (typeof href === "string" && typeof options === "object" && options !== null && typeof options.as === "string") {
    var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
    Internals.d.L(href, as, {
      crossOrigin,
      integrity: typeof options.integrity === "string" ? options.integrity : undefined,
      nonce: typeof options.nonce === "string" ? options.nonce : undefined,
      type: typeof options.type === "string" ? options.type : undefined,
      fetchPriority: typeof options.fetchPriority === "string" ? options.fetchPriority : undefined,
      referrerPolicy: typeof options.referrerPolicy === "string" ? options.referrerPolicy : undefined,
      imageSrcSet: typeof options.imageSrcSet === "string" ? options.imageSrcSet : undefined,
      imageSizes: typeof options.imageSizes === "string" ? options.imageSizes : undefined,
      media: typeof options.media === "string" ? options.media : undefined
    });
  }
}, $preloadModule = function(href, options) {
  if (typeof href === "string")
    if (options) {
      var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
      Internals.d.m(href, {
        as: typeof options.as === "string" && options.as !== "script" ? options.as : undefined,
        crossOrigin,
        integrity: typeof options.integrity === "string" ? options.integrity : undefined
      });
    } else
      Internals.d.m(href);
}, $requestFormReset = function(form) {
  Internals.d.r(form);
}, $unstable_batchedUpdates = function(fn, a) {
  return fn(a);
}, $useFormState = function(action, initialState, permalink) {
  return ReactSharedInternals.H.useFormState(action, initialState, permalink);
}, $useFormStatus = function() {
  return ReactSharedInternals.H.useHostTransitionStatus();
}, $version = "19.2.6";
var init_react_dom_production = __esm(() => {
  Internals = {
    d: {
      f: noop,
      r: function() {
        throw Error(formatProdErrorMessage(522));
      },
      D: noop,
      C: noop,
      L: noop,
      m: noop,
      X: noop,
      S: noop,
      M: noop
    },
    p: 0,
    findDOMNode: null
  };
  REACT_PORTAL_TYPE = Symbol.for("react.portal");
  ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  $__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
});

// ../../../node_modules/.pnpm/react-dom@19.2.6_react@19.2.6/node_modules/react-dom/index.js
var require_react_dom = __commonJS((exports, module) => {
  init_react_dom_production();
  function checkDCE() {
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
      return;
    }
    if (false) {}
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
    } catch (err) {
      console.error(err);
    }
  }
  if (true) {
    checkDCE();
    module.exports = exports_react_dom_production;
  } else {}
});

// synth:/Volumes/D/git/claude-design/plugins/design/dev-server/.runtime-bundle-react-dom-entry.tsx
var __mod__ = __toESM(require_react_dom(), 1);
var {
  __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  createPortal,
  flushSync,
  preconnect,
  prefetchDNS,
  preinit,
  preinitModule,
  preload,
  preloadModule,
  requestFormReset,
  unstable_batchedUpdates,
  useFormState,
  useFormStatus,
  version
} = __mod__;
var __runtime_bundle_react_dom_entry_default = __mod__;
export {
  version,
  useFormStatus,
  useFormState,
  unstable_batchedUpdates,
  requestFormReset,
  preloadModule,
  preload,
  preinitModule,
  preinit,
  prefetchDNS,
  preconnect,
  flushSync,
  __runtime_bundle_react_dom_entry_default as default,
  createPortal,
  __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
};
