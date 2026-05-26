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

// ../../../node_modules/.pnpm/react@19.2.6/node_modules/react/cjs/react-jsx-runtime.production.js
var exports_react_jsx_runtime_production = {};
__export(exports_react_jsx_runtime_production, {
  jsxs: () => $jsxs,
  jsx: () => $jsx,
  Fragment: () => $Fragment
});
function jsxProd(type, config, maybeKey) {
  var key = null;
  maybeKey !== undefined && (key = "" + maybeKey);
  config.key !== undefined && (key = "" + config.key);
  if ("key" in config) {
    maybeKey = {};
    for (var propName in config)
      propName !== "key" && (maybeKey[propName] = config[propName]);
  } else
    maybeKey = config;
  config = maybeKey.ref;
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref: config !== undefined ? config : null,
    props: maybeKey
  };
}
var REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE, $Fragment, $jsx, $jsxs;
var init_react_jsx_runtime_production = __esm(() => {
  REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
  REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
  $Fragment = REACT_FRAGMENT_TYPE;
  $jsx = jsxProd;
  $jsxs = jsxProd;
});

// ../../../node_modules/.pnpm/react@19.2.6/node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS((exports, module) => {
  init_react_jsx_runtime_production();
  if (true) {
    module.exports = exports_react_jsx_runtime_production;
  } else {}
});

// synth:/Volumes/D/git/claude-design/plugins/design/dev-server/.runtime-bundle-react_jsx-runtime-entry.tsx
var __mod__ = __toESM(require_jsx_runtime(), 1);
var {
  Fragment,
  jsx,
  jsxs
} = __mod__;
var __runtime_bundle_react_jsx_runtime_entry_default = __mod__;
export {
  jsxs,
  jsx,
  __runtime_bundle_react_jsx_runtime_entry_default as default,
  Fragment
};
