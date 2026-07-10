// canvas-comment-mount.tsx
import {
  Component,
  createElement,
  Fragment as Fragment3,
  useCallback as useCallback6,
  useEffect as useEffect7,
  useMemo as useMemo5,
  useRef as useRef5,
  useState as useState5
} from "react";
import { createRoot } from "react-dom/client";

// comments-overlay.tsx
import { useCallback as useCallback3, useEffect as useEffect3, useMemo as useMemo3, useRef as useRef3, useState as useState3 } from "react";

// dom-selection.ts
function deriveFile() {
  if (typeof window === "undefined")
    return;
  try {
    const p = window.location.pathname;
    if (p === "/_canvas-shell.html" || p === "/_canvas-shell") {
      const qs = new URLSearchParams(window.location.search);
      const canvas = qs.get("canvas") ?? "";
      const designRel = (qs.get("designRel") ?? ".design").replace(/^\/+|\/+$/g, "");
      return canvas ? `${designRel}/${canvas}` : undefined;
    }
    return decodeURIComponent(p).replace(/^\//, "");
  } catch {
    return;
  }
}
function realClasses(el) {
  if (!el)
    return "";
  return (el.getAttribute("class") ?? "").trim().split(/\s+/).filter((c) => c && !c.startsWith("dgn-") && !c.startsWith("dc-cv-")).join(" ");
}
function shortText(el, max) {
  if (!el)
    return "";
  const t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
function cssPath(el) {
  if (!el)
    return "";
  const path = [];
  let cur = el;
  while (cur && cur.nodeType === 1 && path.length < 8) {
    const dscEl = cur.getAttribute?.("data-dc-element");
    if (dscEl) {
      path.unshift(`[data-dc-element="${dscEl}"]`);
      break;
    }
    const dscSc = cur.getAttribute?.("data-dc-screen");
    if (dscSc) {
      path.unshift(`[data-dc-screen="${dscSc}"]`);
      break;
    }
    let sel = cur.nodeName.toLowerCase();
    if (cur.id) {
      sel = `#${cur.id}`;
      path.unshift(sel);
      break;
    }
    const cls = realClasses(cur).split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length)
      sel += `.${cls.join(".")}`;
    let sib = 1;
    let n = cur.previousElementSibling;
    while (n) {
      sib++;
      n = n.previousElementSibling;
    }
    sel += `:nth-child(${sib})`;
    path.unshift(sel);
    cur = cur.parentElement;
  }
  return path.join(" > ");
}
function domPath(el) {
  const hops = [];
  let cur = el;
  while (cur && cur.nodeType === 1 && hops.length < 8) {
    let label = cur.nodeName.toLowerCase();
    const dEl = cur.getAttribute?.("data-dc-element");
    const dSc = cur.getAttribute?.("data-dc-screen");
    if (dEl)
      label += `[data-dc-element="${dEl}"]`;
    else if (dSc)
      label += `[data-dc-screen="${dSc}"]`;
    else if (cur.id)
      label += `#${cur.id}`;
    const cls = realClasses(cur).split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length && !dEl && !dSc)
      label += `.${cls.join(".")}`;
    hops.unshift(label);
    cur = cur.parentElement;
  }
  return hops;
}
function cssEscape(s) {
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
function scopedCdSelector(cdId, artboardId) {
  return artboardId ? `[data-dc-screen="${artboardId}"] [data-cd-id="${cdId}"]` : `[data-cd-id="${cdId}"]`;
}
function selectorIndex(doc, selector, el) {
  if (!el)
    return 0;
  try {
    const all = doc.querySelectorAll(selector);
    for (let i = 0;i < all.length; i++) {
      if (all[i] === el)
        return i;
    }
  } catch {}
  return 0;
}
function globalCdOccurrence(doc, cdId, el) {
  if (!cdId || !el)
    return 0;
  return selectorIndex(doc, `[data-cd-id="${cssEscape(cdId)}"]`, el);
}
function resolveSelectionEl(doc, sel) {
  const at = (selector) => {
    try {
      const all = doc.querySelectorAll(selector);
      if (!all.length)
        return null;
      const i = sel.index && sel.index > 0 && sel.index < all.length ? sel.index : 0;
      return all[i] ?? all[0];
    } catch {
      return null;
    }
  };
  if (sel.id) {
    const el = at(scopedCdSelector(sel.id, sel.artboardId));
    if (el)
      return el;
  }
  if (sel.selector)
    return at(sel.selector);
  return null;
}
function matchingSuffixLength(a, b) {
  let n = 0;
  const max = Math.min(a.length, b.length);
  for (let i = 1;i <= max; i++) {
    if (a[a.length - i] !== b[b.length - i])
      break;
    n++;
  }
  return n;
}
function resolveByDomPath(doc, opts) {
  const storedPath = opts.dom_path;
  const wantTag = (opts.tag || "").toLowerCase();
  if (!storedPath || storedPath.length === 0 || !wantTag)
    return null;
  let scope = doc;
  if (opts.artboardId) {
    const artboard = doc.querySelector(`[data-dc-screen="${opts.artboardId}"]`);
    if (artboard)
      scope = artboard;
  }
  const wantClasses = (opts.classes || "").split(/\s+/).filter(Boolean);
  let best = null;
  let bestScore = 0;
  for (const el of Array.from(scope.querySelectorAll("[data-cd-id]"))) {
    if (el.tagName.toLowerCase() !== wantTag)
      continue;
    const suffix = matchingSuffixLength(domPath(el), storedPath);
    if (suffix === 0)
      continue;
    const liveClasses = realClasses(el).split(/\s+/).filter(Boolean);
    const overlap = wantClasses.filter((c) => liveClasses.includes(c)).length;
    const score = suffix * 10 + overlap;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}
var KNOB_PROPS = [
  "display",
  "flex-direction",
  "flex-wrap",
  "align-items",
  "justify-content",
  "gap",
  "flex",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-self",
  "font-family",
  "color",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "background-color",
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-width",
  "border-style",
  "border-color",
  "box-shadow",
  "opacity",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "transform",
  "transform-origin",
  "font-style",
  "text-transform",
  "text-decoration",
  "white-space",
  "overflow",
  "object-fit",
  "aspect-ratio",
  "object-position"
];
var ATTR_SKIP = /^(style|class|data-cd-id|data-dc-|data-dcid$)/;
function styleMapsFor(el) {
  if (!el || typeof window === "undefined" || !window.getComputedStyle) {
    return { authored: {}, computed: {}, customStyles: {}, attrs: {} };
  }
  try {
    const inline = el.style;
    const cs = window.getComputedStyle(el);
    const authored = {};
    const computed = {};
    const knob = new Set(KNOB_PROPS);
    for (const p of KNOB_PROPS) {
      const a = inline.getPropertyValue(p);
      if (a)
        authored[p] = a.trim();
      const c = cs.getPropertyValue(p);
      if (c)
        computed[p] = c.trim();
    }
    const MANAGED_FAMILY = /^(margin|padding|border)(-|$)/;
    const customStyles = {};
    for (let i = 0;i < inline.length; i++) {
      const p = inline.item(i);
      if (!p || knob.has(p) || MANAGED_FAMILY.test(p))
        continue;
      const v = inline.getPropertyValue(p);
      if (v)
        customStyles[p] = v.trim();
    }
    const attrs = {};
    for (const a of Array.from(el.attributes)) {
      if (ATTR_SKIP.test(a.name))
        continue;
      attrs[a.name] = a.value;
    }
    const parent = el.parentElement;
    const parentDisplay = parent ? window.getComputedStyle(parent).display : "";
    const parentFlexDirection = parent && (parentDisplay === "flex" || parentDisplay === "inline-flex") ? window.getComputedStyle(parent).flexDirection : "";
    return { authored, computed, customStyles, attrs, parentDisplay, parentFlexDirection };
  } catch {
    return { authored: {}, computed: {}, customStyles: {}, attrs: {} };
  }
}
function hoverTargetToSelection(target, file) {
  const el = target.el;
  const rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  const cdId = target.cdId;
  const selector = cdId ? scopedCdSelector(cdId, target.artboardId) : target.artboardId ? `[data-dc-screen="${target.artboardId}"]` : cssPath(el);
  const index = cdId && typeof document !== "undefined" ? selectorIndex(document, selector, el) : 0;
  return {
    file: file ?? deriveFile(),
    id: cdId ?? undefined,
    selector,
    artboardId: target.artboardId,
    index,
    tag: el?.tagName.toLowerCase() ?? "",
    classes: realClasses(el),
    text: shortText(el, 240),
    dom_path: domPath(el),
    bounds: rect ? {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height)
    } : null,
    worldW: el instanceof HTMLElement ? Math.round(el.offsetWidth) : undefined,
    worldH: el instanceof HTMLElement ? Math.round(el.offsetHeight) : undefined,
    html: el ? (el.outerHTML ?? "").slice(0, 4000) : "",
    ...(() => {
      if (el?.tagName?.toLowerCase() !== "img")
        return {};
      const assetRe = /assets\/[0-9a-f]{8}\.[a-z0-9]+/i;
      const tagged = el.getAttribute?.("data-photo-asset");
      if (tagged && assetRe.test(tagged))
        return { photoKind: "artboard-img", photoAsset: tagged };
      const src = el.getAttribute?.("src") || "";
      const m = assetRe.exec(src);
      return m ? { photoKind: "artboard-img", photoAsset: m[0] } : {};
    })(),
    ...styleMapsFor(el)
  };
}

// use-collab.tsx
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState
} from "react";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import { readSyncMessage, writeSyncStep1, writeUpdate } from "y-protocols/sync";
import * as Y from "yjs";
import { jsx } from "react/jsx-runtime";
var CollabContext = createContext(null);
function useCollab() {
  return useContext(CollabContext);
}
var SESSIONS_KEY = Symbol.for("maude.collab.sessions.v1");

// use-selection-set.tsx
import {
  createContext as createContext2,
  useCallback as useCallback2,
  useContext as useContext2,
  useEffect as useEffect2,
  useMemo as useMemo2,
  useRef as useRef2,
  useState as useState2
} from "react";
import { jsx as jsx2, Fragment } from "react/jsx-runtime";
var SelectionSetContext = createContext2(null);
function selectionKey(s) {
  return s.id ? `id:${s.id}` : `sel:${s.selector}`;
}
function dedupe(list) {
  const out = [];
  const seen = new Set;
  for (const s of list) {
    const k = selectionKey(s);
    if (seen.has(k))
      continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}
var POST_DEBOUNCE_MS = 50;
function SelectionSetProvider({
  children,
  postTarget
}) {
  const [selected, setSelected] = useState2([]);
  const timerRef = useRef2(null);
  const post = useCallback2((next) => {
    if (timerRef.current)
      clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const target = postTarget ?? (typeof window !== "undefined" ? window.parent : null);
      if (!target)
        return;
      const payload = next.length === 0 ? null : next.length === 1 ? next[0] ?? null : next;
      try {
        target.postMessage({ dgn: "select-set", selection: payload }, "*");
      } catch {}
    }, POST_DEBOUNCE_MS);
  }, [postTarget]);
  useEffect2(() => () => {
    if (timerRef.current)
      clearTimeout(timerRef.current);
  }, []);
  const replace = useCallback2((s) => {
    const next = dedupe(Array.isArray(s) ? s : [s]);
    setSelected(next);
    post(next);
  }, [post]);
  const add = useCallback2((s) => {
    const incoming = Array.isArray(s) ? s : [s];
    setSelected((prev) => {
      const next = dedupe([...prev, ...incoming]);
      post(next);
      return next;
    });
  }, [post]);
  const remove = useCallback2((s) => {
    const k = selectionKey(s);
    setSelected((prev) => {
      const next = prev.filter((x) => selectionKey(x) !== k);
      post(next);
      return next;
    });
  }, [post]);
  const toggle = useCallback2((s) => {
    const k = selectionKey(s);
    setSelected((prev) => {
      const next = prev.some((x) => selectionKey(x) === k) ? prev.filter((x) => selectionKey(x) !== k) : [...prev, s];
      post(next);
      return next;
    });
  }, [post]);
  const clear = useCallback2(() => {
    setSelected([]);
    post([]);
  }, [post]);
  const value = useMemo2(() => ({ selected, replace, add, remove, toggle, clear }), [selected, replace, add, remove, toggle, clear]);
  return /* @__PURE__ */ jsx2(SelectionSetContext.Provider, {
    value,
    children
  });
}
function MaybeSelectionSetProvider({ children }) {
  const outer = useContext2(SelectionSetContext);
  if (outer)
    return /* @__PURE__ */ jsx2(Fragment, {
      children
    });
  return /* @__PURE__ */ jsx2(SelectionSetProvider, {
    children
  });
}
function useSelectionSet() {
  const ctx = useContext2(SelectionSetContext);
  if (!ctx) {
    throw new Error("useSelectionSet must be used inside <SelectionSetProvider>");
  }
  return ctx;
}
function useSelectionSetOptional() {
  return useContext2(SelectionSetContext);
}

// comments-overlay.tsx
import { jsx as jsx3, jsxs } from "react/jsx-runtime";
var CSS_HREF = "/_client/comments-overlay.css";
function ensureOverlayStyles() {
  if (typeof document === "undefined")
    return;
  if (document.getElementById("cm-overlay-css"))
    return;
  const link = document.createElement("link");
  link.id = "cm-overlay-css";
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  document.head.appendChild(link);
}
function deriveFile2() {
  if (typeof window === "undefined")
    return null;
  try {
    const p = window.location.pathname;
    if (p === "/_canvas-shell.html" || p === "/_canvas-shell") {
      const qs = new URLSearchParams(window.location.search);
      const canvas = qs.get("canvas") ?? "";
      const designRel = (qs.get("designRel") ?? ".design").replace(/^\/+|\/+$/g, "");
      return canvas ? `${designRel}/${canvas}` : null;
    }
    return decodeURIComponent(p).replace(/^\//, "");
  } catch {
    return null;
  }
}
function resolveCommentTarget(target) {
  if (!target.selector)
    return null;
  let el = null;
  try {
    const all = document.querySelectorAll(target.selector);
    const i = target.index && target.index > 0 && target.index < all.length ? target.index : 0;
    el = all[i] ?? all[0] ?? null;
  } catch {
    el = null;
  }
  if (el && target.tag && el.tagName.toLowerCase() !== target.tag.toLowerCase()) {
    el = null;
  }
  if (!el && target.dom_path?.length) {
    const artboardId = target.selector.match(/data-dc-screen="([^"]+)"/)?.[1];
    el = resolveByDomPath(document, {
      artboardId,
      tag: target.tag,
      classes: target.classes,
      dom_path: target.dom_path
    });
  }
  return el;
}
function screenRectFor(target) {
  const el = resolveCommentTarget(target);
  if (!el?.isConnected)
    return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0)
    return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
function placeNearPoint(point, size) {
  const margin = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : point.x + size.w;
  const vh = typeof window !== "undefined" ? window.innerHeight : point.y + size.h;
  let x = point.x;
  if (x + size.w + margin > vw) {
    const flipped = point.x - size.w;
    x = flipped >= margin ? flipped : Math.max(margin, vw - size.w - margin);
  }
  let y = point.y;
  if (y + size.h + margin > vh) {
    const flipped = point.y - size.h;
    y = flipped >= margin ? flipped : Math.max(margin, vh - size.h - margin);
  }
  return { x, y };
}
function CommentsOverlay() {
  ensureOverlayStyles();
  const selSet = useSelectionSetOptional();
  const [comments, setComments] = useState3([]);
  const [focusedId, setFocusedId] = useState3(null);
  const [composer, setComposer] = useState3(null);
  const file = useMemo3(() => deriveFile2(), []);
  useEffect3(() => {
    if (typeof document === "undefined")
      return;
    const legacy = document.getElementById("dgn-pin-layer");
    if (!legacy)
      return;
    const prev = legacy.style.display;
    legacy.style.display = "none";
    return () => {
      legacy.style.display = prev;
    };
  }, []);
  const mirrorSelection = useCallback3((comment) => {
    if (!selSet)
      return;
    if (!comment?.selector) {
      selSet.clear();
      return;
    }
    const cdMatch = comment.selector.match(/data-cd-id="([^"]+)"/);
    const cdId = cdMatch ? cdMatch[1] : undefined;
    let tag;
    let classes;
    try {
      const el = document.querySelector(comment.selector);
      if (el) {
        tag = el.tagName.toLowerCase();
        classes = (el.getAttribute("class") ?? "").split(/\s+/).filter((cls) => cls && !cls.startsWith("dgn-") && !cls.startsWith("dc-cv-")).join(" ");
      }
    } catch {}
    selSet.replace({
      file: file ?? undefined,
      id: cdId,
      selector: comment.selector,
      tag,
      classes,
      bounds: comment.bounds ?? undefined
    });
  }, [selSet, file]);
  const commentsRef = useRef3(comments);
  commentsRef.current = comments;
  const collab = useCollab();
  useEffect3(() => {
    if (!collab)
      return;
    const arr = collab.doc.getArray("comments");
    const sync = () => {
      setComments(arr.toArray());
    };
    if (arr.length > 0)
      sync();
    arr.observe(sync);
    return () => {
      try {
        arr.unobserve(sync);
      } catch {}
    };
  }, [collab]);
  useEffect3(() => {
    if (typeof window === "undefined")
      return;
    const onMessage = (e) => {
      const m = e.data;
      if (!m || typeof m !== "object" || !m.dgn)
        return;
      if (m.dgn === "comments-set" && Array.isArray(m.comments)) {
        setComments(m.comments);
      } else if (m.dgn === "comment-focus") {
        const id = typeof m.id === "string" ? m.id : null;
        setFocusedId(id);
        const target = id ? commentsRef.current.find((c) => c.id === id) : undefined;
        mirrorSelection(target);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mirrorSelection]);
  useEffect3(() => {
    if (typeof document === "undefined")
      return;
    const onOpen = (e) => {
      const detail = e.detail;
      if (!detail?.selection)
        return;
      setComposer({
        selection: detail.selection,
        clientX: typeof detail.clientX === "number" ? detail.clientX : 0,
        clientY: typeof detail.clientY === "number" ? detail.clientY : 0
      });
    };
    document.addEventListener("cm:open-composer", onOpen);
    return () => document.removeEventListener("cm:open-composer", onOpen);
  }, []);
  const closeComposer = useCallback3(() => {
    setComposer(null);
    if (typeof window === "undefined")
      return;
    try {
      window.parent.postMessage({ dgn: "force-clear" }, "*");
    } catch {}
  }, []);
  const submitComposer = useCallback3((text) => {
    if (!composer)
      return;
    const sel = composer.selection;
    const payload = {
      file: sel.file,
      selector: sel.selector,
      index: sel.index,
      dom_path: sel.dom_path,
      tag: sel.tag,
      classes: sel.classes,
      bounds: sel.bounds,
      html_excerpt: sel.html,
      text
    };
    if (typeof window === "undefined")
      return;
    try {
      window.parent.postMessage({ dgn: "comment-submit", payload }, "*");
    } catch {}
    closeComposer();
  }, [composer, closeComposer]);
  useEffect3(() => {
    if (!file)
      return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/_comments?file=${encodeURIComponent(file)}`);
        if (!r.ok)
          return;
        const data = await r.json();
        if (cancelled)
          return;
        if (Array.isArray(data.comments)) {
          setComments((prev) => prev.length === 0 ? data.comments ?? [] : prev);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);
  const visible = useMemo3(() => {
    const list = comments.slice().sort((a, b) => a.created.localeCompare(b.created));
    return list.filter((c) => c.status !== "resolved");
  }, [comments]);
  const indexById = useMemo3(() => {
    const m = new Map;
    const all = comments.slice().sort((a, b) => a.created.localeCompare(b.created));
    all.forEach((c, i) => {
      m.set(c.id, i + 1);
    });
    return m;
  }, [comments]);
  const handlePinClick = useCallback3((id) => {
    setFocusedId(id);
    mirrorSelection(comments.find((c) => c.id === id));
    if (typeof window === "undefined")
      return;
    try {
      window.parent.postMessage({ dgn: "comment-click", id }, "*");
    } catch {}
  }, [comments, mirrorSelection]);
  const handlePatch = useCallback3((id, patch) => {
    if (typeof window === "undefined")
      return;
    try {
      window.parent.postMessage({ dgn: "comment-patch", id, patch }, "*");
    } catch {}
  }, []);
  const handleDelete = useCallback3((id) => {
    if (typeof window === "undefined")
      return;
    try {
      window.parent.postMessage({ dgn: "comment-delete", id }, "*");
    } catch {}
    setFocusedId((prev) => prev === id ? null : prev);
  }, []);
  const handleReply = useCallback3(async (id, body) => {
    if (typeof fetch === "undefined")
      return false;
    try {
      const r = await fetch(`/_api/comments/${encodeURIComponent(id)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      if (!r.ok)
        return false;
      const updated = await r.json();
      setComments((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      return true;
    } catch {
      return false;
    }
  }, []);
  return /* @__PURE__ */ jsxs("div", {
    className: "cm-layer",
    "aria-hidden": false,
    children: [
      visible.map((c) => {
        const n = indexById.get(c.id) ?? 0;
        return /* @__PURE__ */ jsx3(CommentPin, {
          comment: c,
          sequence: n,
          focused: focusedId === c.id,
          onClick: handlePinClick,
          onOrphaned: handleDelete
        }, c.id);
      }),
      composer ? /* @__PURE__ */ jsx3(CommentComposer, {
        state: composer,
        onSubmit: submitComposer,
        onCancel: closeComposer
      }) : null,
      (() => {
        if (!focusedId)
          return null;
        const focused = visible.find((c) => c.id === focusedId);
        if (!focused)
          return null;
        return /* @__PURE__ */ jsx3(CommentThread, {
          comment: focused,
          sequence: indexById.get(focused.id) ?? 0,
          onClose: () => {
            setFocusedId(null);
            selSet?.clear();
          },
          onPatch: (patch) => handlePatch(focused.id, patch),
          onDelete: () => handleDelete(focused.id),
          onReply: (body) => handleReply(focused.id, body)
        });
      })()
    ]
  });
}
var committerCache = null;
async function loadCommitters() {
  if (!committerCache) {
    committerCache = (async () => {
      try {
        const r = await fetch("/_api/git-committers");
        if (!r.ok)
          return [];
        const data = await r.json();
        return Array.isArray(data.committers) ? data.committers : [];
      } catch {
        return [];
      }
    })();
  }
  return committerCache;
}
function firstNameSlug(name) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.replace(/[^\w.-]/g, "").toLowerCase();
}
function detectMentionToken(text, caret) {
  if (caret <= 0 || caret > text.length)
    return null;
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i] ?? "";
    if (ch === "@") {
      const prev = i > 0 ? text[i - 1] : "";
      if (i === 0 || /\s/.test(prev ?? "")) {
        const query = text.slice(i + 1, caret);
        return { start: i, end: caret, query };
      }
      return null;
    }
    if (!/[\w.-]/.test(ch))
      return null;
    i -= 1;
  }
  return null;
}
function MentionAwareTextarea({
  className,
  value,
  onChange,
  onKeyDown,
  placeholder,
  rows,
  disabled,
  textareaRef,
  ariaLabel
}) {
  const internalRef = useRef3(null);
  const setRef = useCallback3((el) => {
    internalRef.current = el;
    if (textareaRef)
      textareaRef.current = el;
  }, [textareaRef]);
  const [committers, setCommitters] = useState3([]);
  const [token, setToken] = useState3(null);
  const [highlight, setHighlight] = useState3(0);
  const onFocus = useCallback3(() => {
    if (committers.length > 0)
      return;
    loadCommitters().then((list) => setCommitters(list));
  }, [committers.length]);
  const filtered = useMemo3(() => {
    if (!token)
      return [];
    const q = token.query.toLowerCase();
    const list = !q ? committers : committers.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [token, committers]);
  const refreshToken = useCallback3((textarea) => {
    const caret = textarea.selectionStart ?? textarea.value.length;
    const t = detectMentionToken(textarea.value, caret);
    setToken(t);
    setHighlight(0);
  }, []);
  const handleChange = useCallback3((e) => {
    onChange(e.target.value);
    refreshToken(e.target);
  }, [onChange, refreshToken]);
  const insertMention = useCallback3((committer) => {
    if (!token)
      return;
    const ta = internalRef.current;
    if (!ta)
      return;
    const tag = `@${firstNameSlug(committer.name)}`;
    const next = `${value.slice(0, token.start)}${tag} ${value.slice(token.end)}`;
    onChange(next);
    setToken(null);
    const newCaret = token.start + tag.length + 1;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
  }, [token, value, onChange]);
  const handleKeyDown = useCallback3((e) => {
    if (token && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = filtered[highlight] ?? filtered[0];
        if (pick)
          insertMention(pick);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setToken(null);
        return;
      }
    }
    onKeyDown?.(e);
  }, [token, filtered, highlight, insertMention, onKeyDown]);
  const handleSelect = useCallback3((e) => {
    refreshToken(e.currentTarget);
  }, [refreshToken]);
  return /* @__PURE__ */ jsxs("div", {
    style: { position: "relative" },
    children: [
      /* @__PURE__ */ jsx3("textarea", {
        ref: setRef,
        className,
        value,
        placeholder,
        rows,
        disabled,
        "aria-label": ariaLabel,
        onChange: handleChange,
        onKeyDown: handleKeyDown,
        onFocus,
        onSelect: handleSelect,
        onClick: handleSelect
      }),
      token && filtered.length > 0 ? /* @__PURE__ */ jsx3("ul", {
        className: "cm-mention-popup",
        role: "listbox",
        "aria-label": "Mention suggestions",
        style: { left: 0, top: "100%" },
        children: filtered.map((c, i) => {
          const selected = i === highlight;
          return /* @__PURE__ */ jsxs("li", {
            role: "option",
            "aria-selected": selected,
            className: "cm-mention-popup__item",
            onMouseEnter: () => setHighlight(i),
            onMouseDown: (ev) => {
              ev.preventDefault();
              insertMention(c);
            },
            children: [
              /* @__PURE__ */ jsxs("span", {
                className: "cm-mention-popup__name",
                children: [
                  "@",
                  firstNameSlug(c.name)
                ]
              }),
              /* @__PURE__ */ jsx3("span", {
                className: "cm-mention-popup__email",
                children: c.email
              })
            ]
          }, `${c.name}-${c.email}`);
        })
      }) : null
    ]
  });
}
var ORPHAN_GRACE_MS = 3000;
function CommentPin({
  comment,
  sequence,
  focused,
  onClick,
  onOrphaned
}) {
  const ref = useRef3(null);
  const rafRef = useRef3(null);
  const unresolvedSinceRef = useRef3(null);
  useEffect3(() => {
    const tick = () => {
      rafRef.current = null;
      const pin = ref.current;
      if (!pin)
        return;
      let pos = screenRectFor(comment);
      if (pos) {
        unresolvedSinceRef.current = null;
      } else {
        if (unresolvedSinceRef.current == null) {
          unresolvedSinceRef.current = Date.now();
        } else if (Date.now() - unresolvedSinceRef.current > ORPHAN_GRACE_MS) {
          onOrphaned(comment.id);
        }
        if (comment.bounds) {
          pos = {
            x: comment.bounds.x,
            y: comment.bounds.y,
            w: comment.bounds.w,
            h: comment.bounds.h
          };
        }
      }
      if (!pos) {
        pin.style.display = "none";
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      pin.style.display = "grid";
      const left = Math.round(pos.x + pos.w - 12);
      const top = Math.round(pos.y - 12);
      pin.style.left = `${left}px`;
      pin.style.top = `${top}px`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null)
        cancelAnimationFrame(rafRef.current);
    };
  }, [comment, onOrphaned]);
  const author = comment.author?.trim() || "unknown";
  const label = `Comment ${sequence} by ${author}`;
  return /* @__PURE__ */ jsx3("button", {
    ref,
    type: "button",
    className: "cm-pin",
    "data-resolved": comment.status === "resolved" ? "true" : "false",
    "data-focused": focused ? "true" : "false",
    "data-comment-pin": comment.id,
    "aria-label": label,
    "aria-expanded": focused,
    title: comment.text.slice(0, 200),
    onClick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(comment.id);
    },
    children: sequence
  });
}
function CommentComposer({
  state,
  onSubmit,
  onCancel
}) {
  const [text, setText] = useState3("");
  const textareaRef = useRef3(null);
  const cardRef = useRef3(null);
  const rafRef = useRef3(null);
  useEffect3(() => {
    const tick = () => {
      rafRef.current = null;
      const node = cardRef.current;
      if (!node)
        return;
      const anchor = computeAnchor(state);
      const placed = placeNearPoint(anchor, { w: node.offsetWidth, h: node.offsetHeight });
      node.style.left = `${Math.round(placed.x)}px`;
      node.style.top = `${Math.round(placed.y)}px`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null)
        cancelAnimationFrame(rafRef.current);
    };
  }, [state]);
  useEffect3(() => {
    textareaRef.current?.focus();
  }, []);
  const trySubmit = useCallback3(() => {
    const v = text.trim();
    if (!v)
      return;
    onSubmit(v);
  }, [text, onSubmit]);
  const onKeyDown = useCallback3((e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      trySubmit();
    }
  }, [onCancel, trySubmit]);
  const selectorChip = useMemo3(() => {
    const s = state.selection.selector || "";
    if (!s)
      return state.selection.tag || "canvas";
    const cd = s.match(/data-cd-id="([^"]+)"/);
    if (cd)
      return `cd:${cd[1]}`;
    return s.length > 36 ? `${s.slice(0, 33)}…` : s;
  }, [state.selection]);
  return /* @__PURE__ */ jsxs("div", {
    ref: cardRef,
    className: "cm-composer",
    role: "dialog",
    "aria-label": "New comment",
    onClick: (e) => e.stopPropagation(),
    onPointerDown: (e) => e.stopPropagation(),
    children: [
      /* @__PURE__ */ jsxs("div", {
        className: "cm-composer__head",
        children: [
          /* @__PURE__ */ jsx3("span", {
            children: "New comment"
          }),
          /* @__PURE__ */ jsx3("span", {
            className: "cm-composer__selector",
            children: selectorChip
          })
        ]
      }),
      /* @__PURE__ */ jsx3(MentionAwareTextarea, {
        textareaRef,
        className: "cm-composer__textarea",
        value: text,
        placeholder: "Type a comment. ⌘↵ to save · Esc to cancel · @name to tag",
        onChange: setText,
        onKeyDown,
        rows: 3,
        ariaLabel: "Comment body"
      }),
      /* @__PURE__ */ jsxs("div", {
        className: "cm-composer__actions",
        children: [
          /* @__PURE__ */ jsx3("button", {
            type: "button",
            className: "cm-btn",
            onClick: onCancel,
            children: "Cancel"
          }),
          /* @__PURE__ */ jsx3("button", {
            type: "button",
            className: "cm-btn cm-btn--primary",
            disabled: !text.trim(),
            onClick: trySubmit,
            children: "Save"
          })
        ]
      })
    ]
  });
}
function CommentThread({
  comment,
  sequence,
  onClose,
  onPatch,
  onDelete,
  onReply
}) {
  const dialogRef = useRef3(null);
  const replyRef = useRef3(null);
  const rafRef = useRef3(null);
  const [reply, setReply] = useState3("");
  const [sending, setSending] = useState3(false);
  useEffect3(() => {
    const tick = () => {
      rafRef.current = null;
      const node = dialogRef.current;
      if (!node)
        return;
      const anchor = computeThreadAnchor(comment);
      const placed = placeNearPoint(anchor, { w: node.offsetWidth, h: node.offsetHeight });
      node.style.left = `${Math.round(placed.x)}px`;
      node.style.top = `${Math.round(placed.y)}px`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null)
        cancelAnimationFrame(rafRef.current);
    };
  }, [comment]);
  useEffect3(() => {
    dialogRef.current?.focus();
    const pinId = comment.id;
    return () => {
      const pin = document.querySelector(`[data-comment-pin="${pinId}"]`);
      pin?.focus();
    };
  }, [comment.id]);
  useEffect3(() => {
    if (typeof document === "undefined")
      return;
    const onKey = (e) => {
      if (e.key !== "Escape")
        return;
      const root = dialogRef.current;
      if (!root)
        return;
      if (root.contains(e.target) || document.activeElement === root) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const trySendReply = useCallback3(async () => {
    const v = reply.trim();
    if (!v || sending)
      return;
    setSending(true);
    const ok = await onReply(v);
    setSending(false);
    if (ok) {
      setReply("");
      replyRef.current?.focus();
    }
  }, [reply, sending, onReply]);
  const onReplyKeyDown = useCallback3((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      trySendReply();
    }
  }, [trySendReply]);
  const headId = `cm-thread-head-${comment.id}`;
  const selectorChip = formatSelectorChip(comment.selector, "");
  return /* @__PURE__ */ jsxs("div", {
    ref: dialogRef,
    className: "cm-thread",
    role: "dialog",
    "aria-labelledby": headId,
    tabIndex: -1,
    onClick: (e) => e.stopPropagation(),
    onPointerDown: (e) => e.stopPropagation(),
    children: [
      /* @__PURE__ */ jsxs("div", {
        className: "cm-thread__head",
        id: headId,
        children: [
          /* @__PURE__ */ jsxs("div", {
            className: "cm-thread__head-row",
            children: [
              /* @__PURE__ */ jsx3("span", {
                className: "cm-thread__seq",
                "aria-hidden": "true",
                children: sequence
              }),
              /* @__PURE__ */ jsx3("span", {
                className: "cm-thread__author",
                children: comment.author?.trim() || "unknown"
              }),
              /* @__PURE__ */ jsx3("span", {
                className: "cm-thread__time",
                children: formatRelativeTime(comment.created)
              }),
              /* @__PURE__ */ jsx3("button", {
                type: "button",
                className: "cm-thread__close",
                "aria-label": "Close thread",
                title: "Close · Esc",
                onClick: onClose,
                children: "×"
              })
            ]
          }),
          selectorChip ? /* @__PURE__ */ jsx3("code", {
            className: "cm-thread__selector",
            children: selectorChip
          }) : null
        ]
      }),
      /* @__PURE__ */ jsx3("div", {
        className: "cm-thread__body",
        children: renderBodyWithMentions(comment.text)
      }),
      (comment.thread ?? []).map((r) => /* @__PURE__ */ jsxs("div", {
        className: "cm-thread__reply",
        children: [
          /* @__PURE__ */ jsxs("div", {
            className: "cm-thread__reply-head",
            children: [
              /* @__PURE__ */ jsx3("span", {
                className: "cm-thread__reply-author",
                children: r.author?.trim() || "unknown"
              }),
              /* @__PURE__ */ jsx3("span", {
                className: "cm-thread__reply-time",
                children: formatRelativeTime(r.created)
              })
            ]
          }),
          /* @__PURE__ */ jsx3("div", {
            className: "cm-thread__reply-body",
            children: renderBodyWithMentions(r.body)
          })
        ]
      }, r.id)),
      /* @__PURE__ */ jsxs("div", {
        className: "cm-thread__reply-form",
        children: [
          /* @__PURE__ */ jsx3(MentionAwareTextarea, {
            textareaRef: replyRef,
            className: "cm-thread__reply-textarea",
            value: reply,
            placeholder: "Reply… ⌘↵ to send · @name to tag",
            onChange: setReply,
            onKeyDown: onReplyKeyDown,
            rows: 2,
            ariaLabel: "Reply",
            disabled: sending
          }),
          /* @__PURE__ */ jsx3("div", {
            className: "cm-thread__reply-actions",
            children: /* @__PURE__ */ jsx3("button", {
              type: "button",
              className: "cm-btn cm-btn--primary",
              disabled: !reply.trim() || sending,
              onClick: () => void trySendReply(),
              children: "Send"
            })
          })
        ]
      }),
      /* @__PURE__ */ jsxs("div", {
        className: "cm-thread__actions",
        children: [
          comment.status === "resolved" ? /* @__PURE__ */ jsx3("button", {
            type: "button",
            className: "cm-btn",
            onClick: () => onPatch({ status: "open" }),
            children: "↺ Reopen"
          }) : /* @__PURE__ */ jsx3("button", {
            type: "button",
            className: "cm-btn cm-btn--primary",
            onClick: () => {
              onPatch({ status: "resolved" });
              onClose();
            },
            children: "✓ Resolve"
          }),
          /* @__PURE__ */ jsx3("button", {
            type: "button",
            className: "cm-btn cm-btn--danger",
            onClick: () => {
              onDelete();
              onClose();
            },
            children: "Delete"
          })
        ]
      })
    ]
  });
}
function renderBodyWithMentions(text) {
  if (!text)
    return null;
  const re = /(@[\w][\w.-]*)/g;
  const parts = text.split(re);
  return parts.map((part, i) => {
    const key = `${i}:${part}`;
    if (i % 2 === 1) {
      return /* @__PURE__ */ jsx3("strong", {
        "data-mention": "true",
        children: part
      }, key);
    }
    return /* @__PURE__ */ jsx3("span", {
      children: part
    }, key);
  });
}
function formatRelativeTime(iso) {
  if (!iso)
    return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t))
    return "";
  const diffSec = Math.round((Date.now() - t) / 1000);
  if (diffSec < 60)
    return `${Math.max(diffSec, 0)}s ago`;
  if (diffSec < 3600)
    return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400)
    return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}
function formatSelectorChip(selector, fallback) {
  if (!selector)
    return fallback;
  const cd = selector.match(/data-cd-id="([^"]+)"/);
  if (cd)
    return `cd:${cd[1]}`;
  return selector.length > 36 ? `${selector.slice(0, 33)}…` : selector;
}
function computeThreadAnchor(comment) {
  const rect = comment.selector ? screenRectFor(comment) : null;
  if (rect) {
    return { x: rect.x + rect.w - 12, y: rect.y + 16 };
  }
  if (comment.bounds) {
    return { x: comment.bounds.x + comment.bounds.w - 12, y: comment.bounds.y + 16 };
  }
  return { x: 16, y: 16 };
}
function computeAnchor(state) {
  if (state.clientX || state.clientY) {
    return { x: state.clientX, y: state.clientY + 8 };
  }
  if (state.selection.selector) {
    const rect = screenRectFor(state.selection);
    if (rect) {
      return { x: rect.x, y: rect.y + rect.h + 8 };
    }
  }
  return { x: 16, y: 16 };
}

// input-router.tsx
import { useEffect as useEffect4 } from "react";
var ANNOTATION_TOOLS = new Set([
  "pen",
  "highlighter",
  "shape",
  "rect",
  "ellipse",
  "arrow",
  "sticky",
  "text",
  "section",
  "eraser"
]);
function isAnnotationTool(t) {
  return ANNOTATION_TOOLS.has(t);
}
var metaOrCtrl = (i) => !!(i.metaKey || i.ctrlKey);
function classify(input) {
  if (input.type === "keydown") {
    if (input.isEditable)
      return { kind: "no-op" };
    if (input.metaKey || input.ctrlKey || input.altKey) {
      if (input.key === "Escape")
        return { kind: "escape" };
      const k2 = (input.key || "").toLowerCase();
      if (!input.altKey && (input.metaKey || input.ctrlKey)) {
        if (k2 === "z" && input.shiftKey)
          return { kind: "redo" };
        if (k2 === "z")
          return { kind: "undo" };
        if (k2 === "y" && !input.shiftKey)
          return { kind: "redo" };
      }
      return { kind: "no-op" };
    }
    const k = (input.key || "").toLowerCase();
    if (k === "v")
      return { kind: "tool", tool: "move" };
    if (k === "h")
      return { kind: "tool", tool: "hand" };
    if (k === "c")
      return { kind: "tool", tool: "comment" };
    if (k === "b")
      return { kind: "tool", tool: "pen" };
    if (k === "i")
      return { kind: "tool", tool: "highlighter" };
    if (k === "r" || k === "o")
      return { kind: "tool", tool: "shape" };
    if (k === "a")
      return { kind: "tool", tool: "arrow" };
    if (k === "n")
      return { kind: "tool", tool: "sticky" };
    if (k === "t")
      return { kind: "tool", tool: "text" };
    if (k === "s" && input.shiftKey)
      return { kind: "tool", tool: "section" };
    if (k === "e")
      return { kind: "tool", tool: "eraser" };
    if (input.key === "Escape")
      return { kind: "escape" };
    return { kind: "no-op" };
  }
  if (input.type === "contextmenu") {
    return {
      kind: "context-menu",
      clientX: input.clientX ?? 0,
      clientY: input.clientY ?? 0
    };
  }
  if (input.type === "pointermove") {
    if (isAnnotationTool(input.activeTool))
      return { kind: "no-op" };
    if (input.activeTool === "hand")
      return { kind: "no-op" };
    if (input.activeTool === "comment") {
      return {
        kind: "hover",
        deep: true,
        clientX: input.clientX ?? 0,
        clientY: input.clientY ?? 0
      };
    }
    if (!metaOrCtrl(input))
      return { kind: "no-op" };
    return {
      kind: "hover",
      deep: true,
      clientX: input.clientX ?? 0,
      clientY: input.clientY ?? 0
    };
  }
  if (input.type === "pointerdown") {
    if (input.button === 2) {
      return {
        kind: "context-menu",
        clientX: input.clientX ?? 0,
        clientY: input.clientY ?? 0
      };
    }
    if (input.button === 1 || input.spaceHeld)
      return { kind: "no-op" };
    if (input.button !== 0)
      return { kind: "no-op" };
    if (isAnnotationTool(input.activeTool) && !metaOrCtrl(input)) {
      return { kind: "no-op" };
    }
    if (input.activeTool === "comment") {
      return {
        kind: "drop-comment",
        clientX: input.clientX ?? 0,
        clientY: input.clientY ?? 0
      };
    }
    if (input.activeTool === "hand")
      return { kind: "no-op" };
    const cmd = metaOrCtrl(input);
    if (!cmd)
      return { kind: "no-op" };
    const shift = !!input.shiftKey;
    return {
      kind: "select",
      mode: shift ? "add" : "replace",
      deep: true,
      clientX: input.clientX ?? 0,
      clientY: input.clientY ?? 0
    };
  }
  return { kind: "no-op" };
}
function isEditableTarget(t) {
  if (!t || !t.tagName)
    return false;
  const el = t;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
    return true;
  if (el.isContentEditable)
    return true;
  const raw = el.getAttribute?.("contenteditable");
  if (raw === "true" || raw === "plaintext-only" || raw === "")
    return true;
  return false;
}
function isOverlayTarget(t) {
  if (!t || !t.closest)
    return false;
  return !!t.closest(".cm-composer, .cm-thread, .cm-mention-popup, .cm-pin, [data-mediaref-player]");
}
function useInputRouter(opts) {
  const { hostRef, getActiveTool, isSpaceHeld, callbacks, enabled = true, claimableActions } = opts;
  useEffect4(() => {
    if (!enabled)
      return;
    const host = hostRef.current;
    if (!host)
      return;
    const claim = (action) => claimableActions && action.kind !== "no-op" && !claimableActions.has(action.kind) ? { kind: "no-op" } : action;
    const dispatch = (action) => {
      switch (action.kind) {
        case "hover":
          callbacks.onHover?.(action);
          break;
        case "select":
          callbacks.onSelect?.(action);
          break;
        case "drop-comment":
          callbacks.onDropComment?.(action);
          break;
        case "context-menu":
          callbacks.onContextMenu?.(action);
          break;
        case "tool":
          callbacks.onTool?.(action);
          break;
        case "escape":
          callbacks.onEscape?.();
          break;
        case "undo":
          callbacks.onUndo?.();
          break;
        case "redo":
          callbacks.onRedo?.();
          break;
        case "no-op":
          break;
      }
    };
    const onPointerMove = (e) => {
      const action = claim(classify({
        type: "pointermove",
        button: e.button,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        clientX: e.clientX,
        clientY: e.clientY,
        spaceHeld: isSpaceHeld?.() ?? false,
        activeTool: getActiveTool()
      }));
      dispatch(action);
    };
    const onPointerDown = (e) => {
      if (isOverlayTarget(e.target))
        return;
      const action = claim(classify({
        type: "pointerdown",
        button: e.button,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        clientX: e.clientX,
        clientY: e.clientY,
        spaceHeld: isSpaceHeld?.() ?? false,
        activeTool: getActiveTool()
      }));
      if (action.kind !== "no-op") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      dispatch(action);
    };
    const onMouseDown = (e) => {
      if (isOverlayTarget(e.target))
        return;
      const action = claim(classify({
        type: "pointerdown",
        button: e.button,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        clientX: e.clientX,
        clientY: e.clientY,
        spaceHeld: isSpaceHeld?.() ?? false,
        activeTool: getActiveTool()
      }));
      if (action.kind !== "no-op") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (action.kind === "select") {
          try {
            window.focus();
          } catch {}
        }
      }
    };
    const onClick = (e) => {
      if (isOverlayTarget(e.target))
        return;
      const tool = getActiveTool();
      const mod = e.metaKey || e.ctrlKey;
      const wouldRouteKind = tool === "comment" ? "drop-comment" : tool === "move" && mod && e.button === 0 ? "select" : e.button === 2 ? "context-menu" : null;
      if (wouldRouteKind && (!claimableActions || claimableActions.has(wouldRouteKind))) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const onContextMenu = (e) => {
      const action = claim(classify({
        type: "contextmenu",
        clientX: e.clientX,
        clientY: e.clientY,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        activeTool: getActiveTool()
      }));
      if (action.kind === "no-op")
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dispatch(action);
    };
    const onKeyDown = (e) => {
      const action = claim(classify({
        type: "keydown",
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        isEditable: isEditableTarget(e.target),
        activeTool: getActiveTool()
      }));
      if (action.kind === "tool" || action.kind === "escape" || action.kind === "undo" || action.kind === "redo") {
        e.preventDefault();
      }
      dispatch(action);
    };
    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerdown", onPointerDown, { capture: true });
    host.addEventListener("mousedown", onMouseDown, { capture: true });
    host.addEventListener("click", onClick, { capture: true });
    host.addEventListener("contextmenu", onContextMenu, { capture: true });
    const doc = host.ownerDocument ?? document;
    doc.addEventListener("keydown", onKeyDown, true);
    return () => {
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerdown", onPointerDown, {
        capture: true
      });
      host.removeEventListener("mousedown", onMouseDown, { capture: true });
      host.removeEventListener("click", onClick, { capture: true });
      host.removeEventListener("contextmenu", onContextMenu, {
        capture: true
      });
      doc.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled, hostRef, getActiveTool, isSpaceHeld, callbacks, claimableActions]);
}
function resolveHoverTarget(doc, clientX, clientY, opts) {
  const hit = doc.elementFromPoint(clientX, clientY);
  if (!hit)
    return null;
  if (hit.closest?.(".dc-mm, .dc-zoom-tb, .dc-tool-palette, .dc-context-menu, .dc-cv-group-bbox")) {
    return null;
  }
  const artboardEl = hit.closest?.("[data-dc-screen]") ?? null;
  const artboardId = artboardEl?.getAttribute("data-dc-screen") ?? null;
  const bodyEl = hit.closest?.(".dc-artboard-body") ?? null;
  if (!bodyEl) {
    if (artboardEl && artboardId) {
      return { el: artboardEl, cdId: null, artboardId };
    }
    return null;
  }
  if (hit === bodyEl) {
    if (artboardEl && artboardId) {
      return { el: artboardEl, cdId: null, artboardId };
    }
    return null;
  }
  if (opts.deep) {
    const cdId2 = hit.getAttribute?.("data-cd-id") ?? null;
    return { el: hit, cdId: cdId2, artboardId };
  }
  let cur = hit;
  let topCdEl = null;
  while (cur && cur !== bodyEl) {
    if (cur.hasAttribute?.("data-cd-id"))
      topCdEl = cur;
    cur = cur.parentElement;
  }
  const el = topCdEl ?? hit;
  const cdId = el.getAttribute?.("data-cd-id") ?? null;
  return { el, cdId, artboardId };
}

// use-element-resize.tsx
import { useCallback as useCallback5, useEffect as useEffect6, useRef as useRef4 } from "react";

// drag-state.ts
var active = false;
function isElementDragActive() {
  return active;
}

// use-tool-mode.tsx
import {
  createContext as createContext3,
  useCallback as useCallback4,
  useContext as useContext3,
  useEffect as useEffect5,
  useMemo as useMemo4,
  useState as useState4
} from "react";

// canvas-cursors.ts
function svgCursor(svg, hx, hy, fallback) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}") ${hx} ${hy}, ${fallback}`;
}
var W = `width='24' height='24' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'`;
var INK = "#1f1f1f";
var HALO = "stroke='#ffffff' stroke-linejoin='round' stroke-linecap='round'";
function kenney(b, w, transform) {
  const open = transform ? `<g transform='${transform}'>` : "";
  const close = transform ? "</g>" : "";
  return `<svg ${W}>${open}<path fill='#ffffff' d='${b}'/><path fill='${INK}' d='${w}'/>${close}</svg>`;
}
var FLIP_V = "translate(0,32) scale(1,-1)";
var MOVE = svgCursor(kenney("M10.25 8.25 L10.05 8.65 10 9 10 23.1 10.05 23.4 10.25 23.75 10.8 24 11.45 23.85 11.6 23.7 11.75 23.45 14.65 19.8 14.85 19.65 14.95 19.5 15.4 19.2 15.95 19.1 21.05 19.1 21.2 19.1 21.35 19.05 21.65 18.9 21.9 18.6 22 18.3 22 17.9 21.9 17.65 21.75 17.35 21.65 17.3 21.55 17.15 11.5 8.25 11.25 8.05 10.95 8 10.6 8.05 10.25 8.25 M9.15 6.6 L9.7 6.25 10 6.15 10.95 6 11.9 6.15 13 6.9 22.9 15.65 23 15.8 23.2 15.95 23.75 16.75 24 17.9 24 18.3 23.9 18.95 23.8 19.25 23.6 19.7 23.1 20.35 22.75 20.6 22.1 20.9 22.05 20.95 22 20.95 21.2 21.1 21.05 21.1 16.2 21.1 16.1 21.25 16.05 21.25 13.4 24.6 13.05 25.15 12.9 25.3 12.55 25.55 Q11.6 26.15 10.55 26 L10.5 26 Q9.65 25.85 9 25.3 L8.45 24.65 8.4 24.5 8.15 24.05 8 23.1 8 9 Q8 8.45 8.15 8.05 L8.25 7.75 8.45 7.35 9.15 6.6", "M10.25 8.25 L10.6 8.05 10.95 8 11.25 8.05 11.5 8.25 21.55 17.15 21.65 17.3 21.75 17.35 21.9 17.65 22 17.9 22 18.3 21.9 18.6 21.65 18.9 21.35 19.05 21.2 19.1 21.05 19.1 15.95 19.1 15.4 19.2 14.95 19.5 14.85 19.65 14.65 19.8 11.75 23.45 11.6 23.7 11.45 23.85 10.8 24 10.25 23.75 10.05 23.4 10 23.1 10 9 10.05 8.65 10.25 8.25"), 8, 5, "default");
var HAND = svgCursor(kenney("M28.55 17.8 Q29.4 20.3 28.75 22.8 L28.7 23 28.15 24.55 28.05 24.75 Q26.4 28.2 22.75 29.4 L22.45 29.5 18 29.9 17.75 29.85 Q15.8 29.25 13.8 28.1 L13.45 27.95 Q12 27.05 10.35 26.8 L10.25 26.75 7.9 26.7 7.8 26.7 Q6.1 26.9 4.8 25.8 L4.75 25.8 4.65 25.7 4.6 25.65 Q3.25 24.5 3.05 22.85 L3 22.75 Q2.8 20.95 4 19.5 5.05 18.15 6.75 17.95 L8.4 17.9 7.5 15.55 7.3 15.2 7.2 15 5 10.95 Q3.9 9.15 4.3 7.75 L4.4 7.5 Q4.75 6.15 6.45 5.2 9 3.65 11 5 11.05 4.1 11.5 3.45 12.15 2.1 14.2 1.6 L14.35 1.6 Q18.05 0.6 19.6 4.4 L19.65 4.55 Q20.75 3.65 22.7 3.75 L22.75 3.75 Q26.75 4 27 8.15 L27 8.25 27 8.35 27 8.45 Q26.9 10.75 27.1 12.6 27.15 14.65 28.2 16.75 L28.55 17.8 M26.65 18.4 L26.1 16.8 26.1 16.85 Q24.8 13.7 25 8.35 L25 8.25 Q24.85 5.9 22.6 5.75 20.7 5.65 20.4 7.35 L20.1 7.95 19.5 8.2 18.85 8.05 18.45 7.5 17.75 5.15 Q16.85 2.95 14.7 3.55 L14.65 3.55 Q12.55 4.05 13.15 6.15 L13.85 8.75 13.75 9.45 13.25 9.95 12.55 9.95 12 9.55 10.9 7.7 Q9.5 5.7 7.45 6.9 6.5 7.45 6.25 8.15 6.1 8.9 6.7 9.85 9.2 13.9 10.8 18.65 L10.8 19.3 10.4 19.8 9.75 19.95 Q8.35 19.8 6.95 19.95 6.1 20.05 5.55 20.75 4.9 21.55 5 22.55 5.15 23.55 6 24.2 L6.05 24.25 Q6.75 24.85 7.65 24.7 L7.7 24.7 10.65 24.8 Q12.7 25.15 14.45 26.2 L14.5 26.2 Q16.4 27.35 18.3 27.9 L22.05 27.5 22.1 27.5 Q24.95 26.55 26.25 23.85 L26.8 22.3 Q27.3 20.35 26.65 18.4", "M26.65 18.4 Q27.3 20.35 26.8 22.3 L26.25 23.85 Q24.95 26.55 22.1 27.5 L22.05 27.5 18.3 27.9 Q16.4 27.35 14.5 26.2 L14.45 26.2 Q12.7 25.15 10.65 24.8 L7.7 24.7 7.65 24.7 Q6.75 24.85 6.05 24.25 L6 24.2 Q5.15 23.55 5 22.55 4.9 21.55 5.55 20.75 6.1 20.05 6.95 19.95 8.35 19.8 9.75 19.95 L10.4 19.8 10.8 19.3 10.8 18.65 Q9.2 13.9 6.7 9.85 6.1 8.9 6.25 8.15 6.5 7.45 7.45 6.9 9.5 5.7 10.9 7.7 L12 9.55 12.55 9.95 13.25 9.95 13.75 9.45 13.85 8.75 13.15 6.15 Q12.55 4.05 14.65 3.55 L14.7 3.55 Q16.85 2.95 17.75 5.15 L18.45 7.5 18.85 8.05 19.5 8.2 20.1 7.95 20.4 7.35 Q20.7 5.65 22.6 5.75 24.85 5.9 25 8.25 L25 8.35 Q24.8 13.7 26.1 16.85 L26.1 16.8 26.65 18.4"), 12, 12, "grab");
var COMMENT = svgCursor(kenney("M28 14 Q28 9.85 24.45 6.9 20.95 4 16 4 11.05 4 7.5 6.9 L7.45 7 Q4 9.9 4 14 4 18.15 7.55 21.05 L7.5 21.05 Q9.2 22.45 11.2 23.2 L15.3 27.3 16 27.6 16.7 27.3 20.85 23.2 Q22.7 22.45 24.3 21.15 L24.45 21.05 Q28 18.15 28 14 M25.75 5.35 Q30.05 8.95 30 14 30.05 19.05 25.75 22.6 L25.4 22.85 Q23.8 24.1 22 24.9 L18.1 28.75 18.15 28.75 Q17.2 29.6 16 29.6 14.8 29.6 13.85 28.75 L13.9 28.75 10 24.9 6.6 22.85 6.25 22.6 Q1.95 19.05 2 14 1.95 8.95 6.25 5.35 10.3 2 16 2 21.7 2 25.75 5.35", "M28 14 Q28 18.15 24.45 21.05 L24.3 21.15 Q22.7 22.45 20.85 23.2 L16.7 27.3 16 27.6 15.3 27.3 11.2 23.2 Q9.2 22.45 7.5 21.05 L7.55 21.05 Q4 18.15 4 14 4 9.9 7.45 7 L7.5 6.9 Q11.05 4 16 4 20.95 4 24.45 6.9 28 9.85 28 14"), 12, 21, "crosshair");
var PEN = svgCursor(kenney("M4 13.1 L4 6 Q4 5.15 4.6 4.6 5.15 4 6 4 L13.1 4 Q13.95 4 14.55 4.6 L28.65 18.75 Q29.8 19.9 29.75 21.45 L29.75 21.6 29.75 21.7 Q29.75 23.2 28.7 24.35 L24.45 28.65 24.35 28.75 Q23.15 29.85 21.65 29.8 L21.55 29.8 21.4 29.8 Q20.2 29.8 19.25 29.15 L18 29.35 Q16.6 29.4 15.25 28 L15.2 27.95 8.2 20.95 Q7.6 20.35 7.6 19.55 7.6 18.7 8.2 18.1 L4.6 14.5 Q4 13.9 4 13.1 M19.5 26.65 L20.1 27.25 Q20.7 27.85 21.5 27.8 22.35 27.85 23 27.25 L27.25 22.95 Q27.8 22.35 27.75 21.55 27.8 20.75 27.2 20.15 L13.1 6 6 6 6 13.1 12.35 19.45 9.6 19.5 16.65 26.55 Q18.05 28.05 19.5 26.65 M8.05 12.3 L8 8 12.25 8.05 13.8 9.6 9.6 13.85 8.05 12.3 M15.25 11.05 L23 18.8 18.8 23.05 11.05 15.3 15.25 11.05", "M15.25 11.05 L11.05 15.3 18.8 23.05 23 18.8 15.25 11.05 M12.35 19.45 L6 13.1 6 6 13.1 6 27.2 20.15 Q27.8 20.75 27.75 21.55 27.8 22.35 27.25 22.95 L23 27.25 Q22.35 27.85 21.5 27.8 20.7 27.85 20.1 27.25 L19.5 26.65 12.35 19.45 M8.05 12.3 L9.6 13.85 13.8 9.6 12.25 8.05 8 8 8.05 12.3", FLIP_V), 6, 18, "crosshair");
var HIGHLIGHTER = svgCursor(kenney("M5.15 10.85 Q4 9.65 4 8.1 L4 7.95 4 7.85 Q3.95 6.2 5.1 5.15 6.25 4 7.85 4 L7.95 4 8.1 4 Q9.65 4 10.85 5.15 L11 5.3 14.3 5.25 Q15.15 5.25 15.75 5.85 L29.9 20 Q31 21.15 31 22.75 L31 22.85 31 23 Q31.05 24.5 29.9 25.7 L29.55 25.95 25.65 29.9 25.65 29.95 Q24.45 31.1 22.75 31.1 21.2 31.15 20 29.95 L5.85 15.8 Q5.25 15.2 5.25 14.35 L5.25 10.95 5.15 10.85 M19.95 24.2 L18.55 22.8 22.8 18.55 24.2 19.95 19.95 24.2 M28.45 21.4 L14.3 7.25 10.15 7.3 9.4 6.55 Q8.8 5.95 7.95 6 7.1 5.95 6.5 6.55 5.95 7.1 6 7.95 5.95 8.8 6.55 9.4 L7.25 10.1 7.25 14.35 21.4 28.5 Q22 29.1 22.75 29.1 23.6 29.1 24.2 28.5 L28.45 24.25 Q29.05 23.65 29 22.85 29.05 22 28.45 21.4 M9.25 13.5 L9.25 9.3 13.5 9.25 14.3 10.05 10.05 14.3 9.25 13.5 M17.15 21.4 L11.5 15.75 15.75 11.5 21.4 17.15 17.15 21.4", "M17.15 21.4 L21.4 17.15 15.75 11.5 11.5 15.75 17.15 21.4 M28.45 21.4 Q29.05 22 29 22.85 29.05 23.65 28.45 24.25 L24.2 28.5 Q23.6 29.1 22.75 29.1 22 29.1 21.4 28.5 L7.25 14.35 7.25 10.1 6.55 9.4 Q5.95 8.8 6 7.95 5.95 7.1 6.5 6.55 7.1 5.95 7.95 6 8.8 5.95 9.4 6.55 L10.15 7.3 14.3 7.25 28.45 21.4 M19.95 24.2 L24.2 19.95 22.8 18.55 18.55 22.8 19.95 24.2 M9.25 13.5 L10.05 14.3 14.3 10.05 13.5 9.25 9.25 9.3 9.25 13.5", FLIP_V), 6, 18, "crosshair");
var CROSSHAIR = svgCursor(kenney("M17 2 Q18.2 2 19.15 2.9 20 3.8 20 5 L20 12 27 12 Q28.2 12 29.15 12.9 30 13.8 30 15 L30 17 Q30 18.2 29.15 19.15 28.2 20 27 20 L20 20 20 27 Q20 28.2 19.15 29.15 18.2 30 17 30 L15 30 Q13.8 30 12.9 29.15 12 28.2 12 27 L12 20 5 20 Q3.8 20 2.9 19.15 2 18.2 2 17 L2 15 Q2 13.8 2.9 12.9 3.8 12 5 12 L12 12 12 5 Q12 3.8 12.9 2.9 13.8 2 15 2 L17 2 M14 27 L14.3 27.7 Q14.6 28 15 28 L17 28 17.7 27.7 18 27 18 18.05 18.05 18 27 18 Q27.4 18 27.7 17.7 L28 17 28 15 27.7 14.3 Q27.4 14 27 14 L18 14 18 5 17.7 4.3 17 4 15 4 Q14.6 4 14.3 4.3 14 4.6 14 5 L14 14 5 14 Q4.6 14 4.3 14.3 4 14.6 4 15 L4 17 Q4 17.4 4.3 17.7 4.6 18 5 18 L14 18 14 27", "M14 27 L14 18 5 18 Q4.6 18 4.3 17.7 4 17.4 4 17 L4 15 Q4 14.6 4.3 14.3 4.6 14 5 14 L14 14 14 5 Q14 4.6 14.3 4.3 14.6 4 15 4 L17 4 17.7 4.3 18 5 18 14 27 14 Q27.4 14 27.7 14.3 L28 15 28 17 27.7 17.7 Q27.4 18 27 18 L18.05 18 18 18.05 18 27 17.7 27.7 17 28 15 28 Q14.6 28 14.3 27.7 L14 27"), 12, 12, "crosshair");
var ERASER = svgCursor(kenney("M3.9 11.35 Q2.3 12.5 3.7 13.9 L16.4 26.65 Q17.85 28.05 19.45 26.9 L27.65 21.15 Q29.3 20 27.85 18.6 L15.15 5.85 Q13.75 4.45 12.1 5.6 L3.9 11.35 M1.05 12.4 Q1 10.95 2.75 9.75 L10.95 4 10.95 3.95 Q14 1.85 16.6 4.45 L29.3 17.2 Q30.8 18.65 30.55 20.1 30.55 21.55 28.8 22.8 L20.6 28.55 20.65 28.55 Q17.7 30.65 15 28.1 L15 28.05 2.3 15.3 2.3 15.35 Q0.8 13.85 1.05 12.4 M13.5 7 L19.85 13.35 11.65 19.15 5.3 12.75 13.5 7", "M13.5 7 L5.3 12.75 11.65 19.15 19.85 13.35 13.5 7 M3.9 11.35 L12.1 5.6 Q13.75 4.45 15.15 5.85 L27.85 18.6 Q29.3 20 27.65 21.15 L19.45 26.9 Q17.85 28.05 16.4 26.65 L3.7 13.9 Q2.3 12.5 3.9 11.35"), 6, 14, "cell");
var TEXT = svgCursor(`<svg ${W}><path d='M16 4V28M11 4H21M11 28H21' fill='none' ${HALO} stroke-width='5'/><path d='M16 4V28M11 4H21M11 28H21' fill='none' stroke='${INK}' stroke-width='2.25' stroke-linecap='round'/></svg>`, 12, 12, "text");
var STICKY = svgCursor(`<svg ${W}><path d='M6 5H21L26 10V27H6Z' fill='${INK}' ${HALO} stroke-width='2.5'/><path d='M21 5V11H26' fill='none' ${HALO} stroke-width='2.25'/></svg>`, 5, 5, "crosshair");
var TOOL_CURSORS = Object.freeze({
  move: MOVE,
  hand: HAND,
  comment: COMMENT,
  pen: PEN,
  section: CROSSHAIR,
  highlighter: HIGHLIGHTER,
  shape: CROSSHAIR,
  rect: CROSSHAIR,
  ellipse: CROSSHAIR,
  sticky: STICKY,
  arrow: CROSSHAIR,
  text: TEXT,
  eraser: ERASER
});

// use-tool-mode.tsx
import { jsx as jsx4, Fragment as Fragment2 } from "react/jsx-runtime";
var DEFAULT_TOOLS = Object.freeze([
  { id: "move", label: "Move", shortcut: "V", cursor: TOOL_CURSORS.move },
  { id: "hand", label: "Hand", shortcut: "H", cursor: TOOL_CURSORS.hand },
  { id: "comment", label: "Comment", shortcut: "C", cursor: TOOL_CURSORS.comment },
  { id: "pen", label: "Pen", shortcut: "B", cursor: TOOL_CURSORS.pen },
  { id: "highlighter", label: "Highlighter", shortcut: "I", cursor: TOOL_CURSORS.highlighter },
  { id: "shape", label: "Shape", shortcut: "R", cursor: TOOL_CURSORS.shape },
  { id: "sticky", label: "Sticky", shortcut: "N", cursor: TOOL_CURSORS.sticky },
  { id: "section", label: "Section", shortcut: "⇧S", cursor: TOOL_CURSORS.shape },
  { id: "arrow", label: "Arrow", shortcut: "A", cursor: TOOL_CURSORS.arrow },
  { id: "text", label: "Text", shortcut: "T", cursor: TOOL_CURSORS.text },
  { id: "eraser", label: "Eraser", shortcut: "E", cursor: TOOL_CURSORS.eraser }
]);
var ToolContext = createContext3(null);
function ToolProvider({
  children,
  tools = DEFAULT_TOOLS,
  initial = "move"
}) {
  const [tool, setToolState] = useState4(initial);
  const [sticky, setSticky] = useState4(() => ({
    tool: null,
    locked: false
  }));
  const setTool = useCallback4((t) => {
    setToolState(t);
    setSticky((prev) => prev.locked && prev.tool === t ? prev : { tool: null, locked: false });
  }, []);
  const toggleSticky = useCallback4((t) => {
    setSticky((prev) => {
      if (prev.locked && prev.tool === t)
        return { tool: null, locked: false };
      return { tool: t, locked: true };
    });
    setToolState(t);
  }, []);
  const clearSticky = useCallback4(() => {
    setSticky({ tool: null, locked: false });
  }, []);
  const [shapeKind, setShapeKind] = useState4("rounded");
  useEffect5(() => {
    if (typeof document === "undefined")
      return;
    const desc = tools.find((t) => t.id === tool);
    if (!desc)
      return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = desc.cursor;
    let styleEl = document.getElementById("dc-tool-cursor");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dc-tool-cursor";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `* { cursor: ${desc.cursor} !important; }`;
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ dgn: "tool-cursor", tool }, "*");
      } catch {}
    }
    return () => {
      document.body.style.cursor = prev;
      const el = document.getElementById("dc-tool-cursor");
      if (el)
        el.textContent = "";
    };
  }, [tool, tools]);
  const value = useMemo4(() => ({ tool, setTool, tools, sticky, toggleSticky, clearSticky, shapeKind, setShapeKind }), [tool, setTool, tools, sticky, toggleSticky, clearSticky, shapeKind]);
  return /* @__PURE__ */ jsx4(ToolContext.Provider, {
    value,
    children
  });
}
function MaybeToolProvider({ children }) {
  const outer = useContext3(ToolContext);
  if (outer)
    return /* @__PURE__ */ jsx4(Fragment2, {
      children
    });
  return /* @__PURE__ */ jsx4(ToolProvider, {
    children
  });
}
function useToolMode() {
  const ctx = useContext3(ToolContext);
  if (!ctx) {
    throw new Error("useToolMode must be used inside <ToolProvider>");
  }
  return ctx;
}

// use-element-resize.tsx
import { jsx as jsx5 } from "react/jsx-runtime";
var EL_RESIZE_CSS = `
.dc-el-resize-handle {
  position: fixed;
  width: 8px;
  height: 8px;
  background: var(--maude-hud-accent, oklch(0.680 0.180 268));
  border: 1px solid var(--maude-hud-accent-fg, oklch(0.180 0.030 268));
  border-radius: 3px;
  z-index: 6;
  pointer-events: auto;
  touch-action: none;
  opacity: 0;
  transition: opacity 120ms cubic-bezier(0.4, 0, 0.2, 1);
}
.dc-el-resize-handle[data-corner="nw"], .dc-el-resize-handle[data-corner="se"] { cursor: nwse-resize !important; }
.dc-el-resize-handle[data-corner="ne"], .dc-el-resize-handle[data-corner="sw"] { cursor: nesw-resize !important; }
.dc-el-resize-handle[data-corner="n"], .dc-el-resize-handle[data-corner="s"] { cursor: ns-resize !important; width: 14px; height: 6px; }
.dc-el-resize-handle[data-corner="e"], .dc-el-resize-handle[data-corner="w"] { cursor: ew-resize !important; width: 6px; height: 14px; }
/* Rotation lives in INVISIBLE zones just outside each CORNER (FigJam / mirrors
   the annotation .dc-annot-rotate-zone) — the cursor flips to a rotate glyph and
   dragging turns the element. z-index BELOW the corner squares so the resize
   square wins on the inner overlap; the surrounding ring rotates. */
.dc-el-resize-handle[data-corner^="rot-"] {
  width: 20px; height: 20px;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  z-index: 5;
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cg fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath stroke='white' stroke-width='4' d='M4.8 13 A6 6 0 1 1 15.2 13 M2.2 10.8 L4.8 13 L7.4 10.9 M12.6 10.9 L15.2 13 L17.8 10.8'/%3E%3Cpath stroke='black' stroke-width='1.8' d='M4.8 13 A6 6 0 1 1 15.2 13 M2.2 10.8 L4.8 13 L7.4 10.9 M12.6 10.9 L15.2 13 L17.8 10.8'/%3E%3C/g%3E%3C/svg%3E") 10 10, alias !important;
}
/* Task L7 — live W×H (+ X,Y for an out-of-flow edge drag) readout pill, shown
   only WHILE a resize is in flight (see the tick() gate below). */
.dc-el-resize-readout {
  position: fixed;
  transform: translate(-50%, 12px);
  font-family: var(--maude-chrome-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 11px;
  padding: 3px 7px;
  background: var(--maude-hud-accent, oklch(0.680 0.180 268));
  color: var(--maude-hud-accent-fg, oklch(0.180 0.030 268));
  border-radius: 4px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  z-index: 6;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms cubic-bezier(0.4, 0, 0.2, 1);
}
/* INV-2 — reveal/settle collapses to 1ms, same idiom as every other overlay
   stylesheet in this codebase (equal-spacing-handles.tsx, etc). This overlay
   is mounted inside the canvas iframe's OWN document, which never loads the
   shell's 1-tokens-maude.css — the prefers-reduced-motion guard has to be
   re-declared per injected stylesheet, it doesn't cascade in from the shell.
   Comment stays backtick-free — it lives inside the template literal. */
@media (prefers-reduced-motion: reduce) {
  .dc-el-resize-handle, .dc-el-resize-readout { transition-duration: 1ms; }
}
`.trim();
function ensureElementResizeStyles() {
  if (typeof document === "undefined")
    return;
  if (document.getElementById("dc-el-resize-css"))
    return;
  const s = document.createElement("style");
  s.id = "dc-el-resize-css";
  s.textContent = EL_RESIZE_CSS;
  document.head.appendChild(s);
}
var EL_RESIZE_CORNERS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
function edgeFlags(corner) {
  return {
    movesLeft: corner === "nw" || corner === "w" || corner === "sw",
    movesRight: corner === "ne" || corner === "e" || corner === "se",
    movesTop: corner === "nw" || corner === "n" || corner === "ne",
    movesBottom: corner === "sw" || corner === "s" || corner === "se"
  };
}
var round = (n) => Math.round(n * 100) / 100;
var MIN_SIZE = 1;
function computeElementResize(corner, start, dxW, dyW, mods, flags) {
  const { movesLeft, movesRight, movesTop, movesBottom } = edgeFlags(corner);
  const center = mods.center;
  let width = start.w;
  let height = start.h;
  if (movesRight)
    width = start.w + (center ? 2 * dxW : dxW);
  else if (movesLeft)
    width = start.w - (center ? 2 * dxW : dxW);
  if (movesBottom)
    height = start.h + (center ? 2 * dyW : dyW);
  else if (movesTop)
    height = start.h - (center ? 2 * dyW : dyW);
  if (mods.aspect && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    const isCorner = (movesLeft || movesRight) && (movesTop || movesBottom);
    if (isCorner) {
      const relW = Math.abs(width - start.w) / start.w;
      const relH = Math.abs(height - start.h) / start.h;
      if (relW >= relH)
        height = width / ratio;
      else
        width = height * ratio;
    } else if (movesLeft || movesRight) {
      height = width / ratio;
    } else if (movesTop || movesBottom) {
      width = height * ratio;
    }
  }
  if (width < MIN_SIZE)
    width = MIN_SIZE;
  if (height < MIN_SIZE)
    height = MIN_SIZE;
  const result = { width: round(width), height: round(height) };
  if (center) {
    if (flags.canMoveLeft && (movesLeft || movesRight))
      result.left = round(start.left + (start.w - width) / 2);
    if (flags.canMoveTop && (movesTop || movesBottom))
      result.top = round(start.top + (start.h - height) / 2);
  } else {
    if (flags.canMoveLeft && movesLeft)
      result.left = round(start.left + start.w - width);
    if (flags.canMoveTop && movesTop)
      result.top = round(start.top + start.h - height);
  }
  return result;
}
function rotationDegFromMatrix(transform) {
  if (!transform || transform === "none")
    return 0;
  const m = /matrix\(([^)]+)\)/.exec(transform);
  if (!m)
    return 0;
  const parts = m[1].split(",").map(Number);
  const a = parts[0] ?? 1;
  const b = parts[1] ?? 0;
  return Math.round(Math.atan2(b, a) * (180 / Math.PI) * 100) / 100;
}
function scaleFromMatrix(transform) {
  if (!transform || transform === "none")
    return 1;
  const m = /matrix\(([^)]+)\)/.exec(transform);
  if (!m)
    return 1;
  const parts = m[1].split(",").map(Number);
  const a = parts[0] ?? 1;
  const b = parts[1] ?? 0;
  const s = Math.hypot(a, b);
  return s > 0 ? s : 1;
}
function rotatePointDeg(dx, dy, deg) {
  const r = deg * Math.PI / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [dx * cos - dy * sin, dx * sin + dy * cos];
}
function pointerAngleRad(cx, cy, px, py) {
  return Math.atan2(py - cy, px - cx);
}
function rotateDeltaDeg(startElementDeg, startPointerRad, curPointerRad, snap) {
  let deg = startElementDeg + (curPointerRad - startPointerRad) * (180 / Math.PI);
  while (deg > 180)
    deg -= 360;
  while (deg <= -180)
    deg += 360;
  if (snap)
    deg = Math.round(deg / 15) * 15;
  return Math.round(deg * 100) / 100;
}
function postResizeRequest(drag, r) {
  const patch = {
    width: `${r.width}px`,
    height: `${r.height}px`
  };
  if (typeof r.left === "number")
    patch.left = `${r.left}px`;
  if (typeof r.top === "number")
    patch.top = `${r.top}px`;
  try {
    window.parent.postMessage({ dgn: "resize-request", id: drag.cdId, patch, before: drag.before, idIndex: drag.idIndex }, "*");
  } catch {}
}
function postResizeArtboardRequest(drag, r) {
  if (!drag.artboardId)
    return;
  try {
    window.parent.postMessage({
      dgn: "resize-artboard-request",
      artboardId: drag.artboardId,
      width: r.width,
      height: r.height
    }, "*");
  } catch {}
}
function postRotateRequest(drag, transform) {
  try {
    window.parent.postMessage({
      dgn: "resize-request",
      id: drag.cdId,
      patch: { transform },
      before: drag.before,
      idIndex: drag.idIndex
    }, "*");
  } catch {}
}
function ElementResizeOverlay() {
  ensureElementResizeStyles();
  const { selected } = useSelectionSet();
  const { tool } = useToolMode();
  const containerRef = useRef4(null);
  const rafRef = useRef4(null);
  const dragRef = useRef4(null);
  const lastCommitRef = useRef4(null);
  const one = selected.length === 1 ? selected[0] : null;
  const cdId = one && typeof one.id === "string" ? one.id : null;
  const artboardOnly = one && !cdId && typeof one.artboardId === "string" ? one.artboardId : null;
  const active2 = tool === "move" && (!!cdId || !!artboardOnly);
  useEffect6(() => {
    const c = containerRef.current;
    if (!c)
      return;
    const hideAll = () => {
      for (const child of Array.from(c.children)) {
        const h = child;
        h.style.opacity = "0";
        h.style.pointerEvents = "none";
      }
    };
    if (!active2 || !one) {
      hideAll();
      return;
    }
    const tick = () => {
      rafRef.current = null;
      if (isElementDragActive()) {
        hideAll();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const el = resolveSelectionEl(document, one);
      if (!el) {
        hideAll();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) {
        hideAll();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const resizeCorners = artboardOnly ? ["e", "s", "se"] : EL_RESIZE_CORNERS;
      const rotateZones = artboardOnly ? [] : ["rot-nw", "rot-ne", "rot-sw", "rot-se"];
      const TOTAL = resizeCorners.length + rotateZones.length + 1;
      while (c.children.length < TOTAL)
        c.appendChild(document.createElement("div"));
      while (c.children.length > TOTAL)
        c.lastChild && c.removeChild(c.lastChild);
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const deg = rotationDegFromMatrix(getComputedStyle(el).transform);
      const world = el.closest(".dc-world");
      const zoom = world ? scaleFromMatrix(getComputedStyle(world).transform) : 1;
      const hw = el.offsetWidth * zoom / 2;
      const hh = el.offsetHeight * zoom / 2;
      const localOffset = {
        nw: [-hw, -hh],
        n: [0, -hh],
        ne: [hw, -hh],
        e: [hw, 0],
        se: [hw, hh],
        s: [0, hh],
        sw: [-hw, hh],
        w: [-hw, 0],
        "rot-nw": [-hw, -hh],
        "rot-ne": [hw, -hh],
        "rot-sw": [-hw, hh],
        "rot-se": [hw, hh]
      };
      const handles = [...rotateZones, ...resizeCorners];
      for (let i = 0;i < handles.length; i++) {
        const corner = handles[i];
        const handle = c.children[i];
        const [ox, oy] = localOffset[corner] ?? [0, 0];
        const [rx, ry] = rotatePointDeg(ox, oy, deg);
        const ax = cx + rx;
        const ay = cy + ry;
        const isRot = corner.startsWith("rot-");
        const ns = corner === "n" || corner === "s";
        const ew = corner === "e" || corner === "w";
        const halfW = isRot ? 10 : ns ? 7 : ew ? 3 : 4;
        const halfH = isRot ? 10 : ns ? 3 : ew ? 7 : 4;
        handle.className = "dc-el-resize-handle";
        handle.dataset.corner = corner;
        handle.style.opacity = "1";
        handle.style.pointerEvents = "auto";
        handle.style.left = `${Math.round(ax - halfW)}px`;
        handle.style.top = `${Math.round(ay - halfH)}px`;
        handle.style.transform = isRot ? "" : `rotate(${deg}deg)`;
      }
      const readout = c.children[handles.length];
      const drag = dragRef.current;
      if (drag && drag.el === el && !drag.corner.startsWith("rot-")) {
        const w = drag.lastResult?.width ?? el.offsetWidth;
        const h = drag.lastResult?.height ?? el.offsetHeight;
        let label = `${Math.round(w)} × ${Math.round(h)}`;
        const lx = drag.lastResult?.left;
        const ly = drag.lastResult?.top;
        if (typeof lx === "number" || typeof ly === "number") {
          label += `  ·  ${Math.round(lx ?? drag.start.left)}, ${Math.round(ly ?? drag.start.top)}`;
        }
        readout.className = "dc-el-resize-readout";
        readout.textContent = label;
        readout.style.opacity = "1";
        readout.style.left = `${Math.round(cx)}px`;
        readout.style.top = `${Math.round(cy + hh)}px`;
      } else {
        readout.style.opacity = "0";
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null)
        cancelAnimationFrame(rafRef.current);
    };
  }, [active2, one, artboardOnly]);
  const applyPreview = useCallback5((d, r) => {
    d.el.style.width = `${r.width}px`;
    d.el.style.height = `${r.height}px`;
    if (typeof r.left === "number")
      d.el.style.left = `${r.left}px`;
    if (typeof r.top === "number")
      d.el.style.top = `${r.top}px`;
    d.lastResult = r;
  }, []);
  useEffect6(() => {
    const c = containerRef.current;
    if (!c)
      return;
    const computeFromEvent = (d, ev) => {
      const [ldx, ldy] = rotatePointDeg(ev.clientX - d.startClientX, ev.clientY - d.startClientY, -d.angle);
      return computeElementResize(d.corner, d.start, ldx / d.elZoom, ldy / d.elZoom, { aspect: !!ev.shiftKey, center: !d.artboardId && !!ev.altKey }, d.flags);
    };
    const onDown = (e) => {
      const t = e.target;
      if (!t?.classList.contains("dc-el-resize-handle"))
        return;
      const corner = t.dataset.corner;
      if (!corner || !one)
        return;
      const elCdId = typeof one.id === "string" ? one.id : null;
      const elArtboardId = !elCdId && typeof one.artboardId === "string" ? one.artboardId : null;
      if (!elCdId && !elArtboardId)
        return;
      const el = resolveSelectionEl(document, one);
      if (!el)
        return;
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const elZoom = el.offsetWidth ? rect.width / el.offsetWidth : 1;
      const cs = getComputedStyle(el);
      const outOfFlow = !elArtboardId && (cs.position === "absolute" || cs.position === "fixed");
      const startLeft = elArtboardId ? Number.NaN : Number.parseFloat(el.style.left);
      const startTop = elArtboardId ? Number.NaN : Number.parseFloat(el.style.top);
      const angle = elArtboardId ? 0 : rotationDegFromMatrix(cs.transform);
      const z = elZoom > 0 ? elZoom : 1;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const drag = {
        pointerId: e.pointerId,
        corner,
        el,
        cdId: elCdId ?? "",
        artboardId: elArtboardId,
        idIndex: elCdId ? globalCdOccurrence(document, elCdId, el) : 0,
        startClientX: e.clientX,
        startClientY: e.clientY,
        elZoom: z,
        angle,
        cx,
        cy,
        rotStartPointer: pointerAngleRad(cx, cy, e.clientX, e.clientY),
        start: {
          w: (angle ? el.offsetWidth : rect.width / z) || rect.width / z,
          h: (angle ? el.offsetHeight : rect.height / z) || rect.height / z,
          left: startLeft,
          top: startTop
        },
        flags: {
          canMoveLeft: outOfFlow && Number.isFinite(startLeft),
          canMoveTop: outOfFlow && Number.isFinite(startTop)
        },
        before: {
          width: el.style.width || null,
          height: el.style.height || null,
          left: el.style.left || null,
          top: el.style.top || null,
          transform: el.style.transform || null
        },
        lastResult: null,
        lastTransform: null
      };
      dragRef.current = drag;
      try {
        t.setPointerCapture(e.pointerId);
      } catch {}
    };
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId)
        return;
      e.preventDefault();
      if (d.corner.startsWith("rot-")) {
        const deg = rotateDeltaDeg(d.angle, d.rotStartPointer, pointerAngleRad(d.cx, d.cy, e.clientX, e.clientY), !!e.shiftKey);
        const tf = `rotate(${deg}deg)`;
        d.el.style.transform = tf;
        d.lastTransform = tf;
        return;
      }
      applyPreview(d, computeFromEvent(d, e));
    };
    const onUp = (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId)
        return;
      dragRef.current = null;
      if (d.corner.startsWith("rot-")) {
        const tf = d.lastTransform;
        if (!tf || tf === d.before.transform)
          return;
        lastCommitRef.current = { el: d.el, before: d.before };
        postRotateRequest(d, tf);
        return;
      }
      const r = d.lastResult ?? computeFromEvent(d, e);
      const changed = `${r.width}px` !== d.before.width || `${r.height}px` !== d.before.height || typeof r.left === "number" && `${r.left}px` !== d.before.left || typeof r.top === "number" && `${r.top}px` !== d.before.top;
      if (!changed)
        return;
      lastCommitRef.current = { el: d.el, before: d.before };
      if (d.artboardId)
        postResizeArtboardRequest(d, r);
      else
        postResizeRequest(d, r);
    };
    const onFail = (e) => {
      const m = e.data;
      if (m?.dgn !== "resize-failed" && m?.dgn !== "resize-artboard-failed")
        return;
      if (e.source !== window.parent)
        return;
      const last = lastCommitRef.current;
      if (!last)
        return;
      last.el.style.width = last.before.width ?? "";
      last.el.style.height = last.before.height ?? "";
      if (last.before.left !== null || last.el.style.left)
        last.el.style.left = last.before.left ?? "";
      if (last.before.top !== null || last.el.style.top)
        last.el.style.top = last.before.top ?? "";
      if (last.before.transform !== null || last.el.style.transform)
        last.el.style.transform = last.before.transform ?? "";
      lastCommitRef.current = null;
    };
    c.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("message", onFail);
    return () => {
      c.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("message", onFail);
    };
  }, [one, applyPreview]);
  return /* @__PURE__ */ jsx5("div", {
    ref: containerRef,
    "aria-hidden": "true"
  });
}

// canvas-comment-mount.tsx
import { jsx as jsx6, jsxs as jsxs2 } from "react/jsx-runtime";
var COMMENT_CLAIMS = new Set([
  "drop-comment",
  "tool",
  "escape",
  "hover"
]);
function isBareSpecimen() {
  return typeof document !== "undefined" && !document.querySelector(".dc-canvas");
}
function pickSpecimenEl(clientX, clientY) {
  if (typeof document === "undefined")
    return null;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit)
    return null;
  if (hit.closest(".cm-composer, .cm-thread, .cm-mention-popup, .cm-pin, [data-mc-hover-halo], [data-mc-selection-halo], .dc-el-resize-handle")) {
    return null;
  }
  const tag = hit.tagName;
  if (tag === "HTML" || tag === "BODY")
    return null;
  return hit;
}
function pickSpecimenSelectEl(clientX, clientY) {
  const hit = pickSpecimenEl(clientX, clientY);
  if (!hit)
    return null;
  const stamped = hit.closest("[data-cd-id]");
  return stamped ?? hit;
}
function CommentHost({ children, file }) {
  const { tool, setTool } = useToolMode();
  const selSet = useSelectionSet();
  const hostRef = useRef5(null);
  const [hoverEl, setHoverEl] = useState5(null);
  const toolRef = useRef5(tool);
  toolRef.current = tool;
  const getActiveTool = useMemo5(() => () => toolRef.current, []);
  useEffect7(() => {
    if (tool !== "comment")
      setHoverEl(null);
  }, [tool]);
  const [selectedEl, setSelectedEl] = useState5(null);
  const [isSpecimen, setIsSpecimen] = useState5(false);
  useEffect7(() => {
    const check = () => setIsSpecimen(isBareSpecimen());
    check();
    const raf = requestAnimationFrame(check);
    const t = setTimeout(check, 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);
  useEffect7(() => {
    if (typeof document === "undefined")
      return;
    const onDown = (e) => {
      if (e.button !== 0 || !(e.metaKey || e.ctrlKey))
        return;
      if (!isBareSpecimen())
        return;
      if (isOverlayTarget(e.target))
        return;
      const el = pickSpecimenSelectEl(e.clientX, e.clientY);
      if (!el)
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const cdId = el.getAttribute("data-cd-id");
      const sel = hoverTargetToSelection({ el, cdId, artboardId: null });
      if (e.shiftKey)
        selSet.add(sel);
      else
        selSet.replace(sel);
      setSelectedEl(el);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [selSet]);
  useEffect7(() => {
    if (selSet.selected.length === 0)
      setSelectedEl(null);
  }, [selSet.selected]);
  useEffect7(() => {
    const host = hostRef.current;
    if (host)
      host.setAttribute("data-active-tool", tool);
    if (typeof document !== "undefined" && document.body) {
      document.body.setAttribute("data-active-tool", tool);
    }
    return () => {
      host?.removeAttribute("data-active-tool");
    };
  }, [tool]);
  useEffect7(() => {
    if (typeof window === "undefined")
      return;
    const onMessage = (e) => {
      const m = e.data;
      if (!m || typeof m !== "object" || m.dgn !== "tool-set")
        return;
      if (typeof m.tool === "string")
        setTool(m.tool);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setTool]);
  useInputRouter({
    hostRef,
    getActiveTool,
    claimableActions: COMMENT_CLAIMS,
    callbacks: {
      onHover: ({ clientX, clientY }) => {
        if (toolRef.current !== "comment" || !isBareSpecimen()) {
          setHoverEl(null);
          return;
        }
        const el = pickSpecimenEl(clientX, clientY);
        setHoverEl((prev) => prev === el ? prev : el);
      },
      onTool: ({ tool: t }) => setTool(t),
      onEscape: () => {
        if (toolRef.current !== "move")
          setTool("move");
        setHoverEl(null);
        selSet.clear();
        if (typeof window !== "undefined") {
          try {
            window.parent.postMessage({ dgn: "force-clear" }, "*");
          } catch {}
        }
      },
      onDropComment: ({ clientX, clientY }) => dropComment(clientX, clientY, selSet, file)
    }
  });
  return /* @__PURE__ */ jsxs2("div", {
    "data-mc-host": true,
    ref: hostRef,
    style: { display: "contents" },
    children: [
      children,
      hoverEl ? /* @__PURE__ */ jsx6(MountHoverHalo, {
        el: hoverEl
      }) : null,
      selectedEl ? /* @__PURE__ */ jsx6(MountSelectionHalo, {
        el: selectedEl
      }) : null,
      isSpecimen ? /* @__PURE__ */ jsx6(ElementResizeOverlay, {}) : null,
      /* @__PURE__ */ jsx6(CommentsOverlay, {})
    ]
  });
}
function MountSelectionHalo({ el }) {
  const ref = useRef5(null);
  const targetRef = useRef5(el);
  targetRef.current = el;
  const rafRef = useRef5(null);
  useEffect7(() => {
    const tick = () => {
      rafRef.current = null;
      const div = ref.current;
      const t = targetRef.current;
      if (div && t?.isConnected) {
        const r = t.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          div.style.display = "none";
        } else {
          div.style.display = "block";
          div.style.left = `${Math.round(r.left)}px`;
          div.style.top = `${Math.round(r.top)}px`;
          div.style.width = `${Math.round(r.width)}px`;
          div.style.height = `${Math.round(r.height)}px`;
        }
      } else if (div) {
        div.style.display = "none";
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null)
        cancelAnimationFrame(rafRef.current);
    };
  }, []);
  return /* @__PURE__ */ jsx6("div", {
    ref,
    "aria-hidden": "true",
    "data-mc-selection-halo": "",
    style: {
      position: "fixed",
      display: "none",
      pointerEvents: "none",
      zIndex: 2147483645,
      border: "1.5px solid var(--maude-hud-accent, oklch(0.680 0.180 268))",
      borderRadius: "3px",
      boxSizing: "border-box"
    }
  });
}
function MountHoverHalo({ el }) {
  const ref = useRef5(null);
  const targetRef = useRef5(el);
  targetRef.current = el;
  const rafRef = useRef5(null);
  useEffect7(() => {
    const tick = () => {
      rafRef.current = null;
      const div = ref.current;
      const t = targetRef.current;
      if (div && t?.isConnected) {
        const r = t.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          div.style.display = "none";
        } else {
          div.style.display = "block";
          div.style.left = `${Math.round(r.left)}px`;
          div.style.top = `${Math.round(r.top)}px`;
          div.style.width = `${Math.round(r.width)}px`;
          div.style.height = `${Math.round(r.height)}px`;
        }
      } else if (div) {
        div.style.display = "none";
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null)
        cancelAnimationFrame(rafRef.current);
    };
  }, []);
  return /* @__PURE__ */ jsx6("div", {
    ref,
    "aria-hidden": "true",
    "data-mc-hover-halo": "",
    style: {
      position: "fixed",
      display: "none",
      pointerEvents: "none",
      zIndex: 2147483646,
      border: "2px solid var(--maude-hud-accent, #d63b1f)",
      borderRadius: "3px",
      boxSizing: "border-box"
    }
  });
}
function dropComment(clientX, clientY, selSet, file) {
  if (typeof document === "undefined")
    return;
  let target = resolveHoverTarget(document, clientX, clientY, { deep: true });
  if (!target)
    target = resolveHoverTarget(document, clientX, clientY, { deep: false });
  if (!target && !isBareSpecimen() && typeof document.elementsFromPoint === "function") {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const candidate of stack) {
      const stamped = candidate.closest?.("[data-cd-id]");
      if (!stamped)
        continue;
      if (!stamped.closest(".dc-artboard-body"))
        continue;
      const artboardEl = stamped.closest("[data-dc-screen]");
      target = {
        el: stamped,
        cdId: stamped.getAttribute("data-cd-id"),
        artboardId: artboardEl?.getAttribute("data-dc-screen") ?? null
      };
      break;
    }
  }
  if (!target && isBareSpecimen()) {
    const el = pickSpecimenEl(clientX, clientY);
    if (el)
      target = { el, cdId: el.getAttribute("data-cd-id"), artboardId: null };
  }
  if (!target) {
    const floatingSel = {
      file,
      id: undefined,
      selector: "",
      artboardId: null,
      tag: "",
      classes: "",
      text: "",
      dom_path: [],
      bounds: { x: clientX - 12, y: clientY - 12, w: 24, h: 24 },
      html: ""
    };
    openComposer(floatingSel, clientX, clientY);
    return;
  }
  const sel = hoverTargetToSelection(target, file);
  selSet.replace(sel);
  openComposer(sel, clientX, clientY);
}
function openComposer(selection, clientX, clientY) {
  if (typeof document !== "undefined") {
    try {
      document.dispatchEvent(new CustomEvent("cm:open-composer", { detail: { selection, clientX, clientY } }));
    } catch {}
  }
  if (typeof window !== "undefined") {
    try {
      window.parent.postMessage({ dgn: "comment-compose", selection }, "*");
    } catch {}
  }
}
function buildCanvasTree(Canvas, file) {
  return createElement(MaybeToolProvider, null, createElement(MaybeSelectionSetProvider, null, createElement(CommentHost, { file }, createElement(Canvas))));
}
function mountCanvas(Canvas, opts) {
  const root = createRoot(opts.rootEl);
  if (!opts.commentsEnabled) {
    root.render(createElement(Canvas));
    return;
  }
  const file = opts.file ?? deriveFile();
  root.render(createElement(CanvasHmrRuntime, { initialCanvas: Canvas, file }));
}
var RUNTIME_KEY = "__maudeCanvasRuntime";
function OkSignal({
  Canvas,
  file,
  onOk
}) {
  useEffect7(() => {
    onOk();
  }, []);
  return buildCanvasTree(Canvas, file);
}

class CanvasErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  componentDidUpdate(prev) {
    if (prev.attempt !== this.props.attempt && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError)
      return this.props.fallback();
    return this.props.children;
  }
}
function HmrHoldingToast({ message }) {
  return createElement("div", {
    className: "dc-hmr-holding",
    role: "status",
    "aria-live": "polite",
    title: message ? `Holding last working render — ${message}` : "Holding last working render"
  }, "⏸ build error — držím poslední funkční verzi");
}
function CanvasHmrRuntime({
  initialCanvas,
  file
}) {
  const [{ canvas, attempt }, setCanvasState] = useState5({ canvas: initialCanvas, attempt: 0 });
  const [holding, setHoldingState] = useState5({ on: false });
  const lastGood = useRef5(null);
  const canvasRef = useRef5(canvas);
  canvasRef.current = canvas;
  useEffect7(() => {
    const api = {
      remount: (next) => setCanvasState((s) => ({ canvas: next, attempt: s.attempt + 1 })),
      setHolding: (on, message) => setHoldingState(on ? { on: true, message } : { on: false })
    };
    window[RUNTIME_KEY] = api;
    return () => {
      window[RUNTIME_KEY] = undefined;
    };
  }, []);
  const handleOk = useCallback6(() => {
    lastGood.current = canvasRef.current;
    setHoldingState((h) => h.on ? { on: false } : h);
  }, []);
  const handleError = useCallback6(() => {
    setHoldingState({ on: true, message: "render error" });
  }, []);
  const fallback = useCallback6(() => {
    const LG = lastGood.current;
    return LG ? buildCanvasTree(LG, file) : null;
  }, [file]);
  return createElement(Fragment3, null, createElement(CanvasErrorBoundary, { attempt, onError: handleError, fallback }, createElement(OkSignal, { key: attempt, Canvas: canvas, file, onOk: handleOk })), holding.on ? createElement(HmrHoldingToast, { message: holding.message }) : null);
}
export {
  pickSpecimenSelectEl,
  mountCanvas,
  isBareSpecimen,
  CanvasErrorBoundary
};

//# debugId=D941FABCEC5A4F4864756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vY2FudmFzLWNvbW1lbnQtbW91bnQudHN4IiwgIi4uL2NvbW1lbnRzLW92ZXJsYXkudHN4IiwgIi4uL2RvbS1zZWxlY3Rpb24udHMiLCAiLi4vdXNlLWNvbGxhYi50c3giLCAiLi4vdXNlLXNlbGVjdGlvbi1zZXQudHN4IiwgIi4uL2lucHV0LXJvdXRlci50c3giLCAiLi4vdXNlLWVsZW1lbnQtcmVzaXplLnRzeCIsICIuLi9kcmFnLXN0YXRlLnRzIiwgIi4uL3VzZS10b29sLW1vZGUudHN4IiwgIi4uL2NhbnZhcy1jdXJzb3JzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgIi8qKlxuICogQGZpbGUgICAgICAgY2FudmFzLWNvbW1lbnQtbW91bnQudHN4IOKAlCBzaGVsbC1vd25lZCBjb21tZW50IGxheWVyICsgbW91bnRDYW52YXNcbiAqIEBzY29wZSAgICAgIGFwcHMvc3R1ZGlvL2NhbnZhcy1jb21tZW50LW1vdW50LnRzeFxuICogQHB1cnBvc2UgICAgVGhlIGNhbnZhcyBtb3VudCBoYXJuZXNzIChgX3NoZWxsLmh0bWxgKSBjYWxscyBgbW91bnRDYW52YXNgXG4gKiAgICAgICAgICAgICBpbnN0ZWFkIG9mIHJlbmRlcmluZyB0aGUgY2FudmFzIGRlZmF1bHQtZXhwb3J0IHJhdy4gbW91bnRDYW52YXNcbiAqICAgICAgICAgICAgIHdyYXBzIEFOWSBkZWZhdWx0IGV4cG9ydCDigJQgYSBgRGVzaWduQ2FudmFzYCBVSSBjYW52YXMgT1IgYSBiYXJlXG4gKiAgICAgICAgICAgICBEUyBzcGVjaW1lbiDigJQgaW4gYSBMSVRFIGNvbW1lbnQgcHJvdmlkZXIgdHJlZSBzbyB0aGUgaW4tcGxhY2VcbiAqICAgICAgICAgICAgIGNvbW1lbnQgdG9vbCB3b3JrcyBvbiBldmVyeSBtb3VudGVkIHN1cmZhY2UuXG4gKlxuICogV2h5IGEgc2luZ2xlIHNoZWxsLW93bmVkIGxheWVyIChERFIg4oCUIHNlZSBwbGFuIMKnXCJLZXkgZGVjaXNpb25cIik6XG4gKiAgIC0gQ29tbWVudHMgdXNlZCB0byBiZSBtb3VudGVkIG9ubHkgYnkgYERlc2lnbkNhbnZhc2AgKFRvb2xQcm92aWRlciArXG4gKiAgICAgU2VsZWN0aW9uU2V0UHJvdmlkZXIgKyBDb21tZW50c092ZXJsYXkgKyB0aGUgb25Ecm9wQ29tbWVudCByb3V0ZXJcbiAqICAgICBicmFuY2gpLiBCYXJlIHNwZWNpbWVucyAoYHN5c3RlbS88ZHM+L3ByZXZpZXcvKi50c3hgKSBuZXZlciByZW5kZXJcbiAqICAgICBEZXNpZ25DYW52YXMsIHNvIHRoZXkgaGFkIG5vIGNvbW1lbnQgdG9vbCBhdCBhbGwuXG4gKiAgIC0gSG9pc3RpbmcgdGhlIGNvbW1lbnQgc3Vic3lzdGVtIGhlcmUgbWFrZXMgaXQgdW5pdmVyc2FsLiBgRGVzaWduQ2FudmFzYFxuICogICAgIGJlY29tZXMgYSBDT05TVU1FUiBvZiB0aGUgc2hlbGwtcHJvdmlkZWQgVG9vbFByb3ZpZGVyIC8gU2VsZWN0aW9uU2V0IC9cbiAqICAgICBDb21tZW50c092ZXJsYXkgKHZpYSBNYXliZVRvb2xQcm92aWRlciAvIE1heWJlU2VsZWN0aW9uU2V0UHJvdmlkZXIgYW5kXG4gKiAgICAgYnkgZHJvcHBpbmcgaXRzIG93biA8Q29tbWVudHNPdmVybGF5Lz4pLlxuICpcbiAqIENvZXhpc3RlbmNlIHdpdGggdGhlIFVJLWNhbnZhcyByb3V0ZXI6IHRoaXMgbGF5ZXIncyBpbnB1dCByb3V0ZXIgaXMgYW5cbiAqIEFOQ0VTVE9SIGNhcHR1cmUtbGlzdGVuZXIgb3ZlciB0aGUgY2FudmFzLiBPbiBhIFVJIGNhbnZhcywgYENhbnZhc1NoZWxsYFxuICogc3RpbGwgcnVucyBpdHMgT1dOIHJvdXRlciAoaG92ZXIgLyBzZWxlY3QgLyBjb250ZXh0LW1lbnUgLyB1bmRvKS4gVG8gYXZvaWRcbiAqIHN3YWxsb3dpbmcgdGhvc2UgZ2VzdHVyZXMsIHRoaXMgcm91dGVyIHBhc3NlcyBhIG5hcnJvdyBgY2xhaW1hYmxlQWN0aW9uc2BcbiAqIGFsbG93bGlzdCDigJQgYGRyb3AtY29tbWVudGAgLyBgdG9vbGAgLyBgZXNjYXBlYCAvIGBob3ZlcmAuIGBob3ZlcmAgbmV2ZXJcbiAqIHByZXZlbnREZWZhdWx0cyBzbyB0aGUgaW5uZXIgcm91dGVyJ3MgaGFsbyBpcyB1bmFmZmVjdGVkOyBldmVyeXRoaW5nIGVsc2VcbiAqIChzZWxlY3QgLyBjb250ZXh0LW1lbnUgLyB1bmRvKSBwcm9wYWdhdGVzIHVudG91Y2hlZCB0byB0aGUgaW5uZXIgcm91dGVyLlxuICovXG5cbmltcG9ydCB7XG4gIENvbXBvbmVudCxcbiAgdHlwZSBDb21wb25lbnRUeXBlLFxuICBjcmVhdGVFbGVtZW50LFxuICBGcmFnbWVudCxcbiAgdHlwZSBSZWFjdE5vZGUsXG4gIHVzZUNhbGxiYWNrLFxuICB1c2VFZmZlY3QsXG4gIHVzZU1lbW8sXG4gIHVzZVJlZixcbiAgdXNlU3RhdGUsXG59IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IGNyZWF0ZVJvb3QgfSBmcm9tICdyZWFjdC1kb20vY2xpZW50JztcblxuaW1wb3J0IHsgQ29tbWVudHNPdmVybGF5IH0gZnJvbSAnLi9jb21tZW50cy1vdmVybGF5LnRzeCc7XG5pbXBvcnQgeyBkZXJpdmVGaWxlLCBob3ZlclRhcmdldFRvU2VsZWN0aW9uIH0gZnJvbSAnLi9kb20tc2VsZWN0aW9uLnRzJztcbmltcG9ydCB7XG4gIHR5cGUgSG92ZXJUYXJnZXQsXG4gIGlzT3ZlcmxheVRhcmdldCxcbiAgdHlwZSBSb3V0ZXJBY3Rpb24sXG4gIHJlc29sdmVIb3ZlclRhcmdldCxcbiAgdXNlSW5wdXRSb3V0ZXIsXG59IGZyb20gJy4vaW5wdXQtcm91dGVyLnRzeCc7XG5pbXBvcnQgeyBFbGVtZW50UmVzaXplT3ZlcmxheSB9IGZyb20gJy4vdXNlLWVsZW1lbnQtcmVzaXplLnRzeCc7XG5pbXBvcnQge1xuICBNYXliZVNlbGVjdGlvblNldFByb3ZpZGVyLFxuICB0eXBlIFNlbGVjdGlvbixcbiAgdXNlU2VsZWN0aW9uU2V0LFxufSBmcm9tICcuL3VzZS1zZWxlY3Rpb24tc2V0LnRzeCc7XG5pbXBvcnQgeyBNYXliZVRvb2xQcm92aWRlciwgdXNlVG9vbE1vZGUgfSBmcm9tICcuL3VzZS10b29sLW1vZGUudHN4JztcblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBQaGFzZSAyNCDigJQgdGhlIGNvbW1lbnQtbW9kZSBjdXJzb3IgKGFuZCBldmVyeSBvdGhlciB0b29sIGN1cnNvcikgaXMgb3duZWRcbi8vIFNPTEVMWSBieSB1c2UtdG9vbC1tb2RlLnRzeCwgd2hvc2UgYCogeyBjdXJzb3I6IDxLZW5uZXkgZ2x5cGg+ICFpbXBvcnRhbnQgfWBcbi8vIHJ1bGUgaXMgaW5qZWN0ZWQgYnkgdGhlIFRvb2xQcm92aWRlciB0aGlzIGxheWVyIG1vdW50cyAoTWF5YmVUb29sUHJvdmlkZXIpIOKAlFxuLy8gc28gaXQgY292ZXJzIGJhcmUgRFMgc3BlY2ltZW5zIHRvby4gVGhlIG9sZCBgW2RhdGEtbWMtaG9zdF3igKZgL2Bib2R5W+KApl1gXG4vLyBjb21tZW50LWN1cnNvciBydWxlIHVzZWQgdG8gbGl2ZSBoZXJlLCBidXQgaXRzIGhpZ2hlciBzcGVjaWZpY2l0eSBzaGFkb3dlZFxuLy8gdGhlIHVuaWZpZWQgS2VubmV5IGN1cnNvciBvbiBVSSBjYW52YXNlcyAoY29tbWVudC1tb3VudCBzdGFtcHNcbi8vIGBkYXRhLWFjdGl2ZS10b29sYCBvbiA8Ym9keT4sIHNvIGBib2R5W2RhdGEtYWN0aXZlLXRvb2w9XCJjb21tZW50XCJdICpgIG1hdGNoZWRcbi8vIHRoZXJlIGFzIHdlbGwpLiBSZW1vdmVkIHNvIHRoZSBzaW5nbGUgc291cmNlIG9mIHRydXRoIHdpbnMuIFNlZSBERFItMDY3LlxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIENvbW1lbnRIb3N0IOKAlCBvd25zIHRoZSBsaXRlIGNvbW1lbnQgc3Vic3lzdGVtOiB0aGUgaW5wdXQgcm91dGVyIChjb21tZW50LVxuLy8gc2NvcGVkKSwgdGhlIHNpbmdsZSBDb21tZW50c092ZXJsYXksIHRoZSBjb21tZW50LW1vZGUgY3Vyc29yIGF0dHJpYnV0ZSwgYW5kXG4vLyB0aGUgcGFyZW50IGBkZ246J3Rvb2wtc2V0J2AgbGlzdGVuZXIgKHNvIHRoZSBvdXRlciBtZW51YmFyIGNvbW1lbnQgdG9nZ2xlXG4vLyByZWFjaGVzIHRoZSBpZnJhbWUpLlxuXG4vLyBPbmx5IHRoZXNlIGFjdGlvbiBraW5kcyBhcmUgY2xhaW1lZCBieSB0aGUgbW91bnQtbGF5ZXIgcm91dGVyOyB0aGUgcmVzdFxuLy8gcHJvcGFnYXRlIHRvIGEgVUkgY2FudmFzJ3Mgb3duIHJvdXRlci4gYHRvb2xgICsgYGVzY2FwZWAgYXJlIGFsc28gaGFuZGxlZCBieVxuLy8gdGhlIGlubmVyIHJvdXRlciBvbiBVSSBjYW52YXNlcyDigJQgaWRlbXBvdGVudCAoc2FtZSBzaGFyZWQgcHJvdmlkZXIpLiBgaG92ZXJgXG4vLyBpcyBkaXNwYXRjaGVkIHRvbyAoaXQgbmV2ZXIgcHJldmVudERlZmF1bHRzLCBzbyB0aGUgaW5uZXIgcm91dGVyJ3Mgb3duIGhvdmVyXG4vLyBoYWxvIG9uIGEgVUkgY2FudmFzIGlzIHVuYWZmZWN0ZWQpIOKAlCB3ZSBvbmx5IFBBSU5UIHRoZSBtb3VudC1sYXllciBwcmV2aWV3XG4vLyBoYWxvIG9uIGEgYmFyZSBzcGVjaW1lbiwgd2hlcmUgdGhlcmUgaXMgbm8gaW5uZXIgQ2FudmFzU2hlbGwgaGFsby5cbmNvbnN0IENPTU1FTlRfQ0xBSU1TOiBSZWFkb25seVNldDxSb3V0ZXJBY3Rpb25bJ2tpbmQnXT4gPSBuZXcgU2V0PFJvdXRlckFjdGlvblsna2luZCddPihbXG4gICdkcm9wLWNvbW1lbnQnLFxuICAndG9vbCcsXG4gICdlc2NhcGUnLFxuICAnaG92ZXInLFxuXSk7XG5cbi8vIFRydWUgd2hlbiBubyBEZXNpZ25DYW52YXMvQ2FudmFzU2hlbGwgaXMgbW91bnRlZCBvbiB0aGlzIHN1cmZhY2Ug4oCUIGkuZS4gYVxuLy8gYmFyZSBEUyBzcGVjaW1lbi4gT24gYSBVSSBjYW52YXMgKGAuZGMtY2FudmFzYCBwcmVzZW50KSB0aGUgaW5uZXIgc2hlbGwgb3duc1xuLy8gaG92ZXItaGFsbyBwYWludGluZyArIGByZXNvbHZlSG92ZXJUYXJnZXRgIGVsZW1lbnQgYW5jaG9yaW5nLCBzbyB0aGUgbGl0ZVxuLy8gbGF5ZXIgZGVmZXJzIHRvIGl0LlxuZXhwb3J0IGZ1bmN0aW9uIGlzQmFyZVNwZWNpbWVuKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiAhZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmRjLWNhbnZhcycpO1xufVxuXG4vLyBEZWVwZXN0IG5vbi1jaHJvbWUgZWxlbWVudCB1bmRlciBhIHBvaW50IOKAlCB0aGUgY29tbWVudCBhbmNob3IgZm9yIGEgYmFyZVxuLy8gc3BlY2ltZW4gKHNwZWNpbWVucyBhcmVuJ3Qgc3RhbXBlZCB3aXRoIGBkYXRhLWNkLWlkYCBhbmQgaGF2ZSBub1xuLy8gYC5kYy1hcnRib2FyZC1ib2R5YCwgc28gYHJlc29sdmVIb3ZlclRhcmdldGAgcmV0dXJucyBudWxsIGZvciB0aGVtKS5cbmZ1bmN0aW9uIHBpY2tTcGVjaW1lbkVsKGNsaWVudFg6IG51bWJlciwgY2xpZW50WTogbnVtYmVyKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBudWxsO1xuICBjb25zdCBoaXQgPSBkb2N1bWVudC5lbGVtZW50RnJvbVBvaW50KGNsaWVudFgsIGNsaWVudFkpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFoaXQpIHJldHVybiBudWxsO1xuICAvLyBOZXZlciBhbmNob3IgdG8gY29tbWVudCBjaHJvbWUsIHRoZSBzZWxlY3Rpb24vcmVzaXplIG92ZXJsYXksIG9yIHRoZSByb290LlxuICBpZiAoXG4gICAgaGl0LmNsb3Nlc3QoXG4gICAgICAnLmNtLWNvbXBvc2VyLCAuY20tdGhyZWFkLCAuY20tbWVudGlvbi1wb3B1cCwgLmNtLXBpbiwgW2RhdGEtbWMtaG92ZXItaGFsb10sIFtkYXRhLW1jLXNlbGVjdGlvbi1oYWxvXSwgLmRjLWVsLXJlc2l6ZS1oYW5kbGUnXG4gICAgKVxuICApIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCB0YWcgPSBoaXQudGFnTmFtZTtcbiAgaWYgKHRhZyA9PT0gJ0hUTUwnIHx8IHRhZyA9PT0gJ0JPRFknKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGhpdDtcbn1cblxuLy8gZmVhdHVyZS1lbGVtZW50LWVkaXRpbmctcm9idXN0bmVzcyBTdGFnZSBFIOKAlCB0aGUgU0VMRUNUIGFuY2hvciBmb3IgYSBiYXJlXG4vLyBzcGVjaW1lbi4gR2VuZXJhbGl6ZXMgYHBpY2tTcGVjaW1lbkVsYCAodGhlIGNvbW1lbnQgYW5jaG9yKSBieSBjbGltYmluZyB0byB0aGVcbi8vIGhpdCBlbGVtZW50J3Mgb3duIGBkYXRhLWNkLWlkYCwgZWxzZSBpdHMgbmVhcmVzdCBzdGFtcGVkIGFuY2VzdG9yIOKAlCBldmVyeSBKU1hcbi8vIGVsZW1lbnQgdGhlIHBpcGVsaW5lIHN0YW1wcyB1bmNvbmRpdGlvbmFsbHkgKGNhbnZhcy1waXBlbGluZS50cyksIHNvIGFcbi8vIHNwZWNpbWVuIGVsZW1lbnQgYWx3YXlzIHJlc29sdmVzIHRvIGEgY2QtaWQgdGhlIEluc3BlY3RvcidzIGBlZGl0LWNzc2AvXG4vLyBgZWRpdC1hdHRyYCBjYW4gdGFyZ2V0LiBGYWxscyBiYWNrIHRvIHRoZSBiYXJlIGhpdCB3aGVuIChkZWZlbnNpdmVseSkgbm90aGluZ1xuLy8gaXMgc3RhbXBlZCwgaW4gd2hpY2ggY2FzZSB0aGUgc2VsZWN0aW9uIGRlZ3JhZGVzIHRvIGEgYGNzc1BhdGhgIHNlbGVjdG9yLlxuZXhwb3J0IGZ1bmN0aW9uIHBpY2tTcGVjaW1lblNlbGVjdEVsKGNsaWVudFg6IG51bWJlciwgY2xpZW50WTogbnVtYmVyKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgY29uc3QgaGl0ID0gcGlja1NwZWNpbWVuRWwoY2xpZW50WCwgY2xpZW50WSk7XG4gIGlmICghaGl0KSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgc3RhbXBlZCA9IGhpdC5jbG9zZXN0KCdbZGF0YS1jZC1pZF0nKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIHJldHVybiBzdGFtcGVkID8/IGhpdDtcbn1cblxuZnVuY3Rpb24gQ29tbWVudEhvc3QoeyBjaGlsZHJlbiwgZmlsZSB9OiB7IGNoaWxkcmVuOiBSZWFjdE5vZGU7IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZCB9KSB7XG4gIGNvbnN0IHsgdG9vbCwgc2V0VG9vbCB9ID0gdXNlVG9vbE1vZGUoKTtcbiAgY29uc3Qgc2VsU2V0ID0gdXNlU2VsZWN0aW9uU2V0KCk7XG4gIGNvbnN0IGhvc3RSZWYgPSB1c2VSZWY8SFRNTERpdkVsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgLy8gSG92ZXItcHJldmlldyBoYWxvIHRhcmdldCAoYmFyZSBzcGVjaW1lbnMgb25seSDigJQgc2VlIGlzQmFyZVNwZWNpbWVuKS5cbiAgY29uc3QgW2hvdmVyRWwsIHNldEhvdmVyRWxdID0gdXNlU3RhdGU8SFRNTEVsZW1lbnQgfCBudWxsPihudWxsKTtcblxuICAvLyBMYXRlc3QgdG9vbCBmb3IgdGhlIHJvdXRlciAocmVhZCBhdCBldmVudCB0aW1lLCBub3QgY2FwdHVyZWQpLlxuICBjb25zdCB0b29sUmVmID0gdXNlUmVmKHRvb2wpO1xuICB0b29sUmVmLmN1cnJlbnQgPSB0b29sO1xuICBjb25zdCBnZXRBY3RpdmVUb29sID0gdXNlTWVtbygoKSA9PiAoKSA9PiB0b29sUmVmLmN1cnJlbnQsIFtdKTtcblxuICAvLyBEcm9wIHRoZSBwcmV2aWV3IGhhbG8gd2hlbmV2ZXIgd2UgbGVhdmUgY29tbWVudCBtb2RlLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh0b29sICE9PSAnY29tbWVudCcpIHNldEhvdmVyRWwobnVsbCk7XG4gIH0sIFt0b29sXSk7XG5cbiAgLy8gZmVhdHVyZS1lbGVtZW50LWVkaXRpbmctcm9idXN0bmVzcyBTdGFnZSBFIOKAlCBlbGVtZW50IFNFTEVDVCBvbiBhIGJhcmVcbiAgLy8gc3BlY2ltZW4uIGBzZWxlY3RlZEVsYCBkcml2ZXMgdGhlIHNlbGVjdGlvbiBoYWxvOyBgaXNTcGVjaW1lbmAgZ2F0ZXMgdGhlXG4gIC8vIHJlc2l6ZSBvdmVybGF5IHNvIGl0IG1vdW50cyBvbiBzcGVjaW1lbnMgT05MWSAoYSBVSSBjYW52YXMgYWxyZWFkeSBtb3VudHNcbiAgLy8gaXRzIG93biBpbnNpZGUgQ2FudmFzU2hlbGwg4oCUIG1vdW50aW5nIGEgc2Vjb25kIGhlcmUgd291bGQgZG91YmxlIHRoZSBoYW5kbGVzKS5cbiAgY29uc3QgW3NlbGVjdGVkRWwsIHNldFNlbGVjdGVkRWxdID0gdXNlU3RhdGU8SFRNTEVsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2lzU3BlY2ltZW4sIHNldElzU3BlY2ltZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIC8vIFRoZSBpbm5lciBEZXNpZ25DYW52YXMgKGAuZGMtY2FudmFzYCkgbW91bnRzIGEgYmVhdCBhZnRlciB0aGlzIGxheWVyLCBzb1xuICAgIC8vIHJlLWNoZWNrIG9uIHRoZSBuZXh0IGZyYW1lICsgYSBzaG9ydCB0aW1lb3V0IGJlZm9yZSBkZWNpZGluZy5cbiAgICBjb25zdCBjaGVjayA9ICgpID0+IHNldElzU3BlY2ltZW4oaXNCYXJlU3BlY2ltZW4oKSk7XG4gICAgY2hlY2soKTtcbiAgICBjb25zdCByYWYgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2hlY2spO1xuICAgIGNvbnN0IHQgPSBzZXRUaW1lb3V0KGNoZWNrLCAxMjApO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjYW5jZWxBbmltYXRpb25GcmFtZShyYWYpO1xuICAgICAgY2xlYXJUaW1lb3V0KHQpO1xuICAgIH07XG4gIH0sIFtdKTtcblxuICAvLyBTcGVjaW1lbiBzZWxlY3Qg4oCUIGEgY2FwdHVyZS1waGFzZSBDbWQvQ3RybC1jbGljay4gU2VsZi1nYXRlZCBvblxuICAvLyBgaXNCYXJlU3BlY2ltZW4oKWAgYXQgZXZlbnQgdGltZTogYSBVSSBjYW52YXMgaGFzIGl0cyBvd24gQ2FudmFzU2hlbGwgc2VsZWN0XG4gIC8vIHJvdXRlciAoc3BlY2ltZW5zIGhhdmUgbm9uZSksIHNvIHRoaXMgaXMgdGhlIE9OTFkgc2VsZWN0IGhhbmRsZXIgb24gYVxuICAvLyBzcGVjaW1lbiBhbmQgYSBwdXJlIG5vLW9wIG9uIGEgVUkgY2FudmFzIOKAlCBubyBkb3VibGUtaGFuZGxpbmcsIG5vIG5lZWQgdG9cbiAgLy8gdG91Y2ggdGhlIHNoYXJlZCBDT01NRU5UX0NMQUlNUyAod2hpY2ggd291bGQgcHJldmVudERlZmF1bHQgYSBVSSBjYW52YXMnc1xuICAvLyBvd24gc2VsZWN0KS4gYHNlbFNldC5yZXBsYWNlYCBwb3N0cyBgZGduOidzZWxlY3Qtc2V0J2AgdG8gdGhlIHBhcmVudCBzaGVsbCxcbiAgLy8gc28gdGhlIEluc3BlY3RvciBvcGVucyAoU3RhZ2UgQykgKyBlZGl0cyBwZXJzaXN0IHZpYSBgZWRpdC1jc3NgIChTdGFnZSBFMykuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICBjb25zdCBvbkRvd24gPSAoZTogUG9pbnRlckV2ZW50KSA9PiB7XG4gICAgICBpZiAoZS5idXR0b24gIT09IDAgfHwgIShlLm1ldGFLZXkgfHwgZS5jdHJsS2V5KSkgcmV0dXJuOyAvLyBzZWxlY3QgZ2VzdHVyZSBvbmx5XG4gICAgICBpZiAoIWlzQmFyZVNwZWNpbWVuKCkpIHJldHVybjsgLy8gVUkgY2FudmFzIOKGkiBDYW52YXNTaGVsbCBvd25zIHNlbGVjdFxuICAgICAgaWYgKGlzT3ZlcmxheVRhcmdldChlLnRhcmdldCkpIHJldHVybjsgLy8gY29tbWVudCBjaHJvbWUgb3ducyBpdHMgY2xpY2tzXG4gICAgICBjb25zdCBlbCA9IHBpY2tTcGVjaW1lblNlbGVjdEVsKGUuY2xpZW50WCwgZS5jbGllbnRZKTtcbiAgICAgIGlmICghZWwpIHJldHVybjtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCBjZElkID0gZWwuZ2V0QXR0cmlidXRlKCdkYXRhLWNkLWlkJyk7XG4gICAgICBjb25zdCBzZWwgPSBob3ZlclRhcmdldFRvU2VsZWN0aW9uKHsgZWwsIGNkSWQsIGFydGJvYXJkSWQ6IG51bGwgfSBhcyBIb3ZlclRhcmdldCk7XG4gICAgICBpZiAoZS5zaGlmdEtleSkgc2VsU2V0LmFkZChzZWwpO1xuICAgICAgZWxzZSBzZWxTZXQucmVwbGFjZShzZWwpO1xuICAgICAgc2V0U2VsZWN0ZWRFbChlbCk7XG4gICAgfTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIG9uRG93biwgdHJ1ZSk7XG4gICAgcmV0dXJuICgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgb25Eb3duLCB0cnVlKTtcbiAgfSwgW3NlbFNldF0pO1xuXG4gIC8vIERyb3AgdGhlIHNlbGVjdGlvbiBoYWxvIHdoZW4gdGhlIHNlbGVjdGlvbiBjbGVhcnMgKEVzYyAvIHBhcmVudCBmb3JjZS1jbGVhcikuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHNlbFNldC5zZWxlY3RlZC5sZW5ndGggPT09IDApIHNldFNlbGVjdGVkRWwobnVsbCk7XG4gIH0sIFtzZWxTZXQuc2VsZWN0ZWRdKTtcblxuICAvLyBSZWZsZWN0IHRoZSBhY3RpdmUgdG9vbCBvbnRvIHRoZSBob3N0IChhbmQgYm9keSwgc2luY2UgdGhlIGhvc3QgaXNcbiAgLy8gZGlzcGxheTpjb250ZW50cyBhbmQgY2FuJ3QgY2FycnkgYSBwYWludGFibGUgY3Vyc29yKS4gQ29tbWVudC1tb2RlIENTU1xuICAvLyBrZXlzIG9mZiBgW2RhdGEtYWN0aXZlLXRvb2w9XCJjb21tZW50XCJdYC5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBob3N0ID0gaG9zdFJlZi5jdXJyZW50O1xuICAgIGlmIChob3N0KSBob3N0LnNldEF0dHJpYnV0ZSgnZGF0YS1hY3RpdmUtdG9vbCcsIHRvb2wpO1xuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmJvZHkpIHtcbiAgICAgIGRvY3VtZW50LmJvZHkuc2V0QXR0cmlidXRlKCdkYXRhLWFjdGl2ZS10b29sJywgdG9vbCk7XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBob3N0Py5yZW1vdmVBdHRyaWJ1dGUoJ2RhdGEtYWN0aXZlLXRvb2wnKTtcbiAgICB9O1xuICB9LCBbdG9vbF0pO1xuXG4gIC8vIFBhcmVudCBgZGduOid0b29sLXNldCdgIOKAlCB0aGUgb3V0ZXIgZGV2LXNlcnZlciBtZW51YmFyIHBvc3RzIHRoaXMgd2hlbiB0aGVcbiAgLy8gdXNlciB0b2dnbGVzIHRoZSBjb21tZW50IHRvb2wuIE1pcnJvcnMgY2FudmFzLXNoZWxsJ3MgbGlzdGVuZXIgc28gdGhlXG4gIC8vIHRvZ2dsZSByZWFjaGVzIGJhcmUgc3BlY2ltZW5zIHRvbyAod2hpY2ggaGF2ZSBubyBpbm5lciBzaGVsbCBsaXN0ZW5lcikuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgY29uc3Qgb25NZXNzYWdlID0gKGU6IE1lc3NhZ2VFdmVudCkgPT4ge1xuICAgICAgY29uc3QgbSA9IGUuZGF0YSBhcyB7IGRnbj86IHN0cmluZzsgdG9vbD86IHN0cmluZyB9IHwgbnVsbDtcbiAgICAgIGlmICghbSB8fCB0eXBlb2YgbSAhPT0gJ29iamVjdCcgfHwgbS5kZ24gIT09ICd0b29sLXNldCcpIHJldHVybjtcbiAgICAgIGlmICh0eXBlb2YgbS50b29sID09PSAnc3RyaW5nJykgc2V0VG9vbChtLnRvb2wgYXMgbmV2ZXIpO1xuICAgIH07XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbk1lc3NhZ2UpO1xuICAgIHJldHVybiAoKSA9PiB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG9uTWVzc2FnZSk7XG4gIH0sIFtzZXRUb29sXSk7XG5cbiAgdXNlSW5wdXRSb3V0ZXIoe1xuICAgIGhvc3RSZWYsXG4gICAgZ2V0QWN0aXZlVG9vbCxcbiAgICBjbGFpbWFibGVBY3Rpb25zOiBDT01NRU5UX0NMQUlNUyxcbiAgICBjYWxsYmFja3M6IHtcbiAgICAgIG9uSG92ZXI6ICh7IGNsaWVudFgsIGNsaWVudFkgfSkgPT4ge1xuICAgICAgICAvLyBQYWludCBhIHByZXZpZXcgaGFsbyBvbmx5IG9uIGJhcmUgc3BlY2ltZW5zOyBhIFVJIGNhbnZhcydzIG93blxuICAgICAgICAvLyBDYW52YXNTaGVsbCBIb3ZlckhhbG8gb3ducyB0aGUgY29tbWVudC1tb2RlIHByZXZpZXcgdGhlcmUuXG4gICAgICAgIGlmICh0b29sUmVmLmN1cnJlbnQgIT09ICdjb21tZW50JyB8fCAhaXNCYXJlU3BlY2ltZW4oKSkge1xuICAgICAgICAgIHNldEhvdmVyRWwobnVsbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVsID0gcGlja1NwZWNpbWVuRWwoY2xpZW50WCwgY2xpZW50WSk7XG4gICAgICAgIHNldEhvdmVyRWwoKHByZXYpID0+IChwcmV2ID09PSBlbCA/IHByZXYgOiBlbCkpO1xuICAgICAgfSxcbiAgICAgIG9uVG9vbDogKHsgdG9vbDogdCB9KSA9PiBzZXRUb29sKHQpLFxuICAgICAgb25Fc2NhcGU6ICgpID0+IHtcbiAgICAgICAgaWYgKHRvb2xSZWYuY3VycmVudCAhPT0gJ21vdmUnKSBzZXRUb29sKCdtb3ZlJyk7XG4gICAgICAgIHNldEhvdmVyRWwobnVsbCk7XG4gICAgICAgIHNlbFNldC5jbGVhcigpO1xuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7IGRnbjogJ2ZvcmNlLWNsZWFyJyB9LCAnKicpO1xuICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLyogcGFyZW50IGRldGFjaGVkICovXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgb25Ecm9wQ29tbWVudDogKHsgY2xpZW50WCwgY2xpZW50WSB9KSA9PiBkcm9wQ29tbWVudChjbGllbnRYLCBjbGllbnRZLCBzZWxTZXQsIGZpbGUpLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIGBkaXNwbGF5OiBjb250ZW50c2Aga2VlcHMgdGhlIHNwZWNpbWVuJ3Mgb3duIGZsZXgvZ3JpZCBsYXlvdXQgYnl0ZS1cbiAgLy8gaWRlbnRpY2FsIOKAlCB0aGUgaG9zdCBib3ggY29udHJpYnV0ZXMgbm90aGluZyB0byBsYXlvdXQuIFRoZSBmaXhlZC1wb3NpdGlvblxuICAvLyBDb21tZW50c092ZXJsYXkgcmVuZGVycyBmaW5lIGFzIGEgY2hpbGQgcmVnYXJkbGVzcy5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGRhdGEtbWMtaG9zdCByZWY9e2hvc3RSZWZ9IHN0eWxlPXt7IGRpc3BsYXk6ICdjb250ZW50cycgfX0+XG4gICAgICB7Y2hpbGRyZW59XG4gICAgICB7aG92ZXJFbCA/IDxNb3VudEhvdmVySGFsbyBlbD17aG92ZXJFbH0gLz4gOiBudWxsfVxuICAgICAge3NlbGVjdGVkRWwgPyA8TW91bnRTZWxlY3Rpb25IYWxvIGVsPXtzZWxlY3RlZEVsfSAvPiA6IG51bGx9XG4gICAgICB7aXNTcGVjaW1lbiA/IDxFbGVtZW50UmVzaXplT3ZlcmxheSAvPiA6IG51bGx9XG4gICAgICA8Q29tbWVudHNPdmVybGF5IC8+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTW91bnRTZWxlY3Rpb25IYWxvIOKAlCBTdGFnZSBFLiBBIHN0ZWFkaWVyIGFjY2VudCBvdXRsaW5lIGFyb3VuZCB0aGUgU0VMRUNURURcbi8vIHNwZWNpbWVuIGVsZW1lbnQgKHZzIHRoZSBsaWdodGVyIGhvdmVyIGhhbG8pLiByQUYtZm9sbG93cyB0aGUgZWxlbWVudCdzIHNjcmVlblxuLy8gYm94OyBpbmxpbmUtc3R5bGVkIChhIGJhcmUgc3BlY2ltZW4gZG9lc24ndCBsb2FkIGNhbnZhcy1saWIncyBIQUxPX0NTUykuXG5cbmZ1bmN0aW9uIE1vdW50U2VsZWN0aW9uSGFsbyh7IGVsIH06IHsgZWw6IEhUTUxFbGVtZW50IH0pIHtcbiAgY29uc3QgcmVmID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHRhcmdldFJlZiA9IHVzZVJlZjxIVE1MRWxlbWVudD4oZWwpO1xuICB0YXJnZXRSZWYuY3VycmVudCA9IGVsO1xuICBjb25zdCByYWZSZWYgPSB1c2VSZWY8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCB0aWNrID0gKCkgPT4ge1xuICAgICAgcmFmUmVmLmN1cnJlbnQgPSBudWxsO1xuICAgICAgY29uc3QgZGl2ID0gcmVmLmN1cnJlbnQ7XG4gICAgICBjb25zdCB0ID0gdGFyZ2V0UmVmLmN1cnJlbnQ7XG4gICAgICBpZiAoZGl2ICYmIHQ/LmlzQ29ubmVjdGVkKSB7XG4gICAgICAgIGNvbnN0IHIgPSB0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBpZiAoci53aWR0aCA9PT0gMCAmJiByLmhlaWdodCA9PT0gMCkge1xuICAgICAgICAgIGRpdi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRpdi5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICBkaXYuc3R5bGUubGVmdCA9IGAke01hdGgucm91bmQoci5sZWZ0KX1weGA7XG4gICAgICAgICAgZGl2LnN0eWxlLnRvcCA9IGAke01hdGgucm91bmQoci50b3ApfXB4YDtcbiAgICAgICAgICBkaXYuc3R5bGUud2lkdGggPSBgJHtNYXRoLnJvdW5kKHIud2lkdGgpfXB4YDtcbiAgICAgICAgICBkaXYuc3R5bGUuaGVpZ2h0ID0gYCR7TWF0aC5yb3VuZChyLmhlaWdodCl9cHhgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGRpdikge1xuICAgICAgICBkaXYuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIH1cbiAgICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgIH07XG4gICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmIChyYWZSZWYuY3VycmVudCAhPSBudWxsKSBjYW5jZWxBbmltYXRpb25GcmFtZShyYWZSZWYuY3VycmVudCk7XG4gICAgfTtcbiAgfSwgW10pO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgcmVmPXtyZWZ9XG4gICAgICBhcmlhLWhpZGRlbj1cInRydWVcIlxuICAgICAgZGF0YS1tYy1zZWxlY3Rpb24taGFsbz1cIlwiXG4gICAgICBzdHlsZT17e1xuICAgICAgICBwb3NpdGlvbjogJ2ZpeGVkJyxcbiAgICAgICAgZGlzcGxheTogJ25vbmUnLFxuICAgICAgICBwb2ludGVyRXZlbnRzOiAnbm9uZScsXG4gICAgICAgIHpJbmRleDogMjE0NzQ4MzY0NSxcbiAgICAgICAgYm9yZGVyOiAnMS41cHggc29saWQgdmFyKC0tbWF1ZGUtaHVkLWFjY2VudCwgb2tsY2goMC42ODAgMC4xODAgMjY4KSknLFxuICAgICAgICBib3JkZXJSYWRpdXM6ICczcHgnLFxuICAgICAgICBib3hTaXppbmc6ICdib3JkZXItYm94JyxcbiAgICAgIH19XG4gICAgLz5cbiAgKTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBNb3VudEhvdmVySGFsbyDigJQgZml4ZWQtcG9zaXRpb24gb3V0bGluZSB0cmFja2luZyB0aGUgaG92ZXJlZCBlbGVtZW50J3Mgc2NyZWVuXG4vLyBib3VuZHMgdmlhIHJBRi4gSW5saW5lLXN0eWxlZCAobm8gZGVwZW5kZW5jeSBvbiBjYW52YXMtbGliJ3MgSEFMT19DU1MsIHdoaWNoXG4vLyBhIGJhcmUgc3BlY2ltZW4gZG9lc24ndCBsb2FkKS4gTWlycm9ycyBjYW52YXMtc2hlbGwncyBIb3ZlckhhbG8gdmlzdWFsbHkuXG5cbmZ1bmN0aW9uIE1vdW50SG92ZXJIYWxvKHsgZWwgfTogeyBlbDogSFRNTEVsZW1lbnQgfSkge1xuICBjb25zdCByZWYgPSB1c2VSZWY8SFRNTERpdkVsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgdGFyZ2V0UmVmID0gdXNlUmVmPEhUTUxFbGVtZW50PihlbCk7XG4gIHRhcmdldFJlZi5jdXJyZW50ID0gZWw7XG4gIGNvbnN0IHJhZlJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHRpY2sgPSAoKSA9PiB7XG4gICAgICByYWZSZWYuY3VycmVudCA9IG51bGw7XG4gICAgICBjb25zdCBkaXYgPSByZWYuY3VycmVudDtcbiAgICAgIGNvbnN0IHQgPSB0YXJnZXRSZWYuY3VycmVudDtcbiAgICAgIGlmIChkaXYgJiYgdD8uaXNDb25uZWN0ZWQpIHtcbiAgICAgICAgY29uc3QgciA9IHQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGlmIChyLndpZHRoID09PSAwICYmIHIuaGVpZ2h0ID09PSAwKSB7XG4gICAgICAgICAgZGl2LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGl2LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgIGRpdi5zdHlsZS5sZWZ0ID0gYCR7TWF0aC5yb3VuZChyLmxlZnQpfXB4YDtcbiAgICAgICAgICBkaXYuc3R5bGUudG9wID0gYCR7TWF0aC5yb3VuZChyLnRvcCl9cHhgO1xuICAgICAgICAgIGRpdi5zdHlsZS53aWR0aCA9IGAke01hdGgucm91bmQoci53aWR0aCl9cHhgO1xuICAgICAgICAgIGRpdi5zdHlsZS5oZWlnaHQgPSBgJHtNYXRoLnJvdW5kKHIuaGVpZ2h0KX1weGA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZGl2KSB7XG4gICAgICAgIGRpdi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgfVxuICAgICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgfTtcbiAgICByYWZSZWYuY3VycmVudCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKHJhZlJlZi5jdXJyZW50ICE9IG51bGwpIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHJhZlJlZi5jdXJyZW50KTtcbiAgICB9O1xuICB9LCBbXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e3JlZn1cbiAgICAgIGFyaWEtaGlkZGVuPVwidHJ1ZVwiXG4gICAgICBkYXRhLW1jLWhvdmVyLWhhbG89XCJcIlxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgIGRpc3BsYXk6ICdub25lJyxcbiAgICAgICAgcG9pbnRlckV2ZW50czogJ25vbmUnLFxuICAgICAgICB6SW5kZXg6IDIxNDc0ODM2NDYsXG4gICAgICAgIGJvcmRlcjogJzJweCBzb2xpZCB2YXIoLS1tYXVkZS1odWQtYWNjZW50LCAjZDYzYjFmKScsXG4gICAgICAgIGJvcmRlclJhZGl1czogJzNweCcsXG4gICAgICAgIGJveFNpemluZzogJ2JvcmRlci1ib3gnLFxuICAgICAgfX1cbiAgICAvPlxuICApO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIENvbW1lbnQgZHJvcCDigJQgZ2VuZXJpYyBwYXRoIGxpZnRlZCBmcm9tIGNhbnZhcy1zaGVsbCdzIG9uRHJvcENvbW1lbnQuIFdvcmtzXG4vLyB3aXRoIG9yIHdpdGhvdXQgYXJ0Ym9hcmRzOiBkZWVwL3NoYWxsb3cgcmVzb2x2ZUhvdmVyVGFyZ2V0IOKGkiBlbGVtZW50c0Zyb21Qb2ludFxuLy8gZGF0YS1jZC1pZCBjbGltYiDihpIgZmxvYXRpbmcgZmFsbGJhY2suIERpc3BhdGNoZXMgYGNtOm9wZW4tY29tcG9zZXJgIGZvciB0aGVcbi8vIGluLWlmcmFtZSBvdmVybGF5ICsgcG9zdHMgYGNvbW1lbnQtY29tcG9zZWAgdG8gdGhlIHBhcmVudCBmb3IgbGVnYWN5IG1vY2tzLlxuXG5mdW5jdGlvbiBkcm9wQ29tbWVudChcbiAgY2xpZW50WDogbnVtYmVyLFxuICBjbGllbnRZOiBudW1iZXIsXG4gIHNlbFNldDogeyByZXBsYWNlOiAoczogU2VsZWN0aW9uKSA9PiB2b2lkIH0sXG4gIGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGxldCB0YXJnZXQgPSByZXNvbHZlSG92ZXJUYXJnZXQoZG9jdW1lbnQsIGNsaWVudFgsIGNsaWVudFksIHsgZGVlcDogdHJ1ZSB9KTtcbiAgaWYgKCF0YXJnZXQpIHRhcmdldCA9IHJlc29sdmVIb3ZlclRhcmdldChkb2N1bWVudCwgY2xpZW50WCwgY2xpZW50WSwgeyBkZWVwOiBmYWxzZSB9KTtcbiAgLy8gVUktY2FudmFzIHJlY292ZXJ5IOKAlCB3aGVuIGJvdGggcGFzc2VzIGJhaWwgb24gYSBgcG9pbnRlci1ldmVudHM6IG5vbmVgXG4gIC8vIGRlY29yYXRpb24sIGVudW1lcmF0ZSB0aGUgc3RhY2sgYW5kIGNsaW1iIHRoZSBmaXJzdCBgZGF0YS1jZC1pZGAgYW5jZXN0b3JcbiAgLy8gaW5zaWRlIGFuIGFydGJvYXJkIGJvZHkuIFNraXBwZWQgb24gYmFyZSBzcGVjaW1lbnMsIHdoaWNoIGluc3RlYWQgYW5jaG9yIHRvXG4gIC8vIHRoZSBleGFjdCBob3ZlcmVkIGVsZW1lbnQgYmVsb3cgKHNvIHRoZSBwaW4gbWF0Y2hlcyB0aGUgaG92ZXIgcHJldmlldyBoYWxvKS5cbiAgaWYgKCF0YXJnZXQgJiYgIWlzQmFyZVNwZWNpbWVuKCkgJiYgdHlwZW9mIGRvY3VtZW50LmVsZW1lbnRzRnJvbVBvaW50ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3Qgc3RhY2sgPSBkb2N1bWVudC5lbGVtZW50c0Zyb21Qb2ludChjbGllbnRYLCBjbGllbnRZKTtcbiAgICBmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBzdGFjaykge1xuICAgICAgY29uc3Qgc3RhbXBlZCA9IChjYW5kaWRhdGUgYXMgRWxlbWVudCkuY2xvc2VzdD8uKCdbZGF0YS1jZC1pZF0nKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICBpZiAoIXN0YW1wZWQpIGNvbnRpbnVlO1xuICAgICAgaWYgKCFzdGFtcGVkLmNsb3Nlc3QoJy5kYy1hcnRib2FyZC1ib2R5JykpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgYXJ0Ym9hcmRFbCA9IHN0YW1wZWQuY2xvc2VzdCgnW2RhdGEtZGMtc2NyZWVuXScpO1xuICAgICAgdGFyZ2V0ID0ge1xuICAgICAgICBlbDogc3RhbXBlZCxcbiAgICAgICAgY2RJZDogc3RhbXBlZC5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2QtaWQnKSxcbiAgICAgICAgYXJ0Ym9hcmRJZDogYXJ0Ym9hcmRFbD8uZ2V0QXR0cmlidXRlKCdkYXRhLWRjLXNjcmVlbicpID8/IG51bGwsXG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gQmFyZS1zcGVjaW1lbiBhbmNob3Ig4oCUIHNwZWNpbWVucyBoYXZlIG5vIGAuZGMtYXJ0Ym9hcmQtYm9keWAsIHNvXG4gIC8vIHJlc29sdmVIb3ZlclRhcmdldCBiYWlscy4gQW5jaG9yIHRvIHRoZSBFWEFDVCBlbGVtZW50IHVuZGVyIHRoZSBjdXJzb3IgKHRoZVxuICAvLyBzYW1lIG9uZSBwaWNrU3BlY2ltZW5FbCBoaWdobGlnaHRzIGZvciB0aGUgaG92ZXIgcHJldmlldyksIHZpYSBpdHMgb3duXG4gIC8vIGRhdGEtY2QtaWQgd2hlbiBzdGFtcGVkLCBlbHNlIGEgY3NzUGF0aCBzZWxlY3RvciDigJQgc28gdGhlIGRyb3BwZWQgcGluIGxhbmRzXG4gIC8vIG9uIHRoZSBwcmV2aWV3ZWQgZWxlbWVudCBpbnN0ZWFkIG9mIGZsb2F0aW5nLlxuICBpZiAoIXRhcmdldCAmJiBpc0JhcmVTcGVjaW1lbigpKSB7XG4gICAgY29uc3QgZWwgPSBwaWNrU3BlY2ltZW5FbChjbGllbnRYLCBjbGllbnRZKTtcbiAgICBpZiAoZWwpIHRhcmdldCA9IHsgZWwsIGNkSWQ6IGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1jZC1pZCcpLCBhcnRib2FyZElkOiBudWxsIH07XG4gIH1cblxuICBpZiAoIXRhcmdldCkge1xuICAgIC8vIEZsb2F0aW5nIGNvbW1lbnQg4oCUIG5vIGVsZW1lbnQgYW5jaG9yLCBqdXN0IHRoZSBjbGljayBwb2ludCAoZS5nLiBhIGNsaWNrXG4gICAgLy8gb24gZW1wdHkgY2FudmFzL3NwZWNpbWVuIGRlYWQgc3BhY2UpLiBUaGUgb3ZlcmxheSByZW5kZXJzIGEgcGluIGF0IHRoZVxuICAgIC8vIHN0b3JlZCBib3VuZHMuXG4gICAgY29uc3QgZmxvYXRpbmdTZWw6IFNlbGVjdGlvbiA9IHtcbiAgICAgIGZpbGUsXG4gICAgICBpZDogdW5kZWZpbmVkLFxuICAgICAgc2VsZWN0b3I6ICcnLFxuICAgICAgYXJ0Ym9hcmRJZDogbnVsbCxcbiAgICAgIHRhZzogJycsXG4gICAgICBjbGFzc2VzOiAnJyxcbiAgICAgIHRleHQ6ICcnLFxuICAgICAgZG9tX3BhdGg6IFtdLFxuICAgICAgYm91bmRzOiB7IHg6IGNsaWVudFggLSAxMiwgeTogY2xpZW50WSAtIDEyLCB3OiAyNCwgaDogMjQgfSxcbiAgICAgIGh0bWw6ICcnLFxuICAgIH07XG4gICAgb3BlbkNvbXBvc2VyKGZsb2F0aW5nU2VsLCBjbGllbnRYLCBjbGllbnRZKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBzZWwgPSBob3ZlclRhcmdldFRvU2VsZWN0aW9uKHRhcmdldCwgZmlsZSk7XG4gIHNlbFNldC5yZXBsYWNlKHNlbCk7XG4gIG9wZW5Db21wb3NlcihzZWwsIGNsaWVudFgsIGNsaWVudFkpO1xufVxuXG5mdW5jdGlvbiBvcGVuQ29tcG9zZXIoc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGNsaWVudFg6IG51bWJlciwgY2xpZW50WTogbnVtYmVyKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoXG4gICAgICAgIG5ldyBDdXN0b21FdmVudCgnY206b3Blbi1jb21wb3NlcicsIHsgZGV0YWlsOiB7IHNlbGVjdGlvbiwgY2xpZW50WCwgY2xpZW50WSB9IH0pXG4gICAgICApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLyogQ3VzdG9tRXZlbnQgYWJzZW50IOKAlCBmYWxsIHRocm91Z2ggdG8gcGFyZW50IHBhdGggKi9cbiAgICB9XG4gIH1cbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyBkZ246ICdjb21tZW50LWNvbXBvc2UnLCBzZWxlY3Rpb24gfSwgJyonKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIHBhcmVudCBkZXRhY2hlZCAqL1xuICAgIH1cbiAgfVxufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIG1vdW50Q2FudmFzIOKAlCB0aGUgc2hlbGwgaGFybmVzcyBlbnRyeS4gUmVuZGVycyB0aGUgY2FudmFzIHdyYXBwZWQgaW4gdGhlIGxpdGVcbi8vIGNvbW1lbnQgdHJlZSwgb3IgYmFyZSB3aGVuIGNvbW1lbnRzIGFyZSBkaXNhYmxlZCAoZ2FsbGVyeSB0aHVtYm5haWxzIHBhc3Ncbi8vIGBjb21tZW50c0VuYWJsZWQ6IGZhbHNlYCB2aWEgYD9jb21tZW50cz0wYCkuXG5cbmV4cG9ydCBpbnRlcmZhY2UgTW91bnRDYW52YXNPcHRpb25zIHtcbiAgcm9vdEVsOiBIVE1MRWxlbWVudDtcbiAgLyoqIENhbnZhcyBmaWxlIGtleSAoZGVzaWduUmVsLXByZWZpeGVkKS4gRGVmYXVsdHMgdG8gYGRlcml2ZUZpbGUoKWAuICovXG4gIGZpbGU/OiBzdHJpbmc7XG4gIC8qKiBXaGVuIGZhbHNlLCB0aGUgY29tbWVudCBsYXllciBpcyBza2lwcGVkIOKAlCB0aGUgY2FudmFzIHJlbmRlcnMgcmF3LiAqL1xuICBjb21tZW50c0VuYWJsZWQ6IGJvb2xlYW47XG59XG5cbi8vIFRoZSBsaXRlIHByb3ZpZGVyIHRyZWUgd3JhcHBpbmcgYSBjYW52YXMgY29tcG9uZW50ICh0b29sICsgc2VsZWN0aW9uICtcbi8vIGNvbW1lbnQgbGF5ZXIpLiBQdWxsZWQgb3V0IHNvIGJvdGggdGhlIGxpdmUgcmVuZGVyIGFuZCB0aGUgZXJyb3ItZmFsbGJhY2tcbi8vIHJlbmRlciBidWlsZCB0aGUgaWRlbnRpY2FsIGVudmVsb3BlLlxuLy9cbi8vIE5COiB0aGUgQ2FudmFzQWN0aXZpdHlQcm92aWRlciAoUGhhc2UgMTMgLyBERFItMDI5KSBpcyBOT1QgbW91bnRlZCBoZXJlIOKAlCBpdFxuLy8gbGl2ZXMgaW5zaWRlIGBEZXNpZ25DYW52YXNgIChjYW52YXMtbGliKS4gY29tbWVudC1tb3VudC5qcyBhbmQgY2FudmFzLWxpYiBhcmVcbi8vIFNFUEFSQVRFIGJ1bmRsZXMsIHNvIGEgY29udGV4dCBwcm92aWRlZCBoZXJlIHdvdWxkIGJlIGEgZGlmZmVyZW50IGluc3RhbmNlXG4vLyBmcm9tIHRoZSBvbmUgRENBcnRib2FyZCAoY2FudmFzLWxpYikgY29uc3VtZXMuIFNhbWUgcmVhc29uaW5nIHRoZSByZWFsXG4vLyBUb29sUHJvdmlkZXIgbGl2ZXMgaW4gRGVzaWduQ2FudmFzLCBub3QgaW4gdGhpcyBsYXllcidzIE1heWJlVG9vbFByb3ZpZGVyLlxuZnVuY3Rpb24gYnVpbGRDYW52YXNUcmVlKENhbnZhczogQ29tcG9uZW50VHlwZSwgZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogUmVhY3ROb2RlIHtcbiAgcmV0dXJuIGNyZWF0ZUVsZW1lbnQoXG4gICAgTWF5YmVUb29sUHJvdmlkZXIsXG4gICAgbnVsbCxcbiAgICBjcmVhdGVFbGVtZW50KFxuICAgICAgTWF5YmVTZWxlY3Rpb25TZXRQcm92aWRlcixcbiAgICAgIG51bGwsXG4gICAgICBjcmVhdGVFbGVtZW50KENvbW1lbnRIb3N0LCB7IGZpbGUgfSwgY3JlYXRlRWxlbWVudChDYW52YXMpKVxuICAgIClcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vdW50Q2FudmFzKENhbnZhczogQ29tcG9uZW50VHlwZSwgb3B0czogTW91bnRDYW52YXNPcHRpb25zKTogdm9pZCB7XG4gIGNvbnN0IHJvb3QgPSBjcmVhdGVSb290KG9wdHMucm9vdEVsKTtcbiAgaWYgKCFvcHRzLmNvbW1lbnRzRW5hYmxlZCkge1xuICAgIHJvb3QucmVuZGVyKGNyZWF0ZUVsZW1lbnQoQ2FudmFzKSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGZpbGUgPSBvcHRzLmZpbGUgPz8gZGVyaXZlRmlsZSgpO1xuICByb290LnJlbmRlcihjcmVhdGVFbGVtZW50KENhbnZhc0htclJ1bnRpbWUsIHsgaW5pdGlhbENhbnZhczogQ2FudmFzLCBmaWxlIH0pKTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBQaGFzZSAxMy4xIC8gRERSLTA3NyDigJQgSE1SIGVycm9yIHJlc2lsaWVuY2UgZHVyaW5nIGFnZW50IGVkaXRpbmcuXG4vL1xuLy8gV2hlbiBhbiBhZ2VudCAoYC9kZXNpZ246ZWRpdGAgLyBgL2Rlc2lnbjpuZXdgKSBsaXZlLWVkaXRzIGEgY2FudmFzLCBhXG4vLyBoYWxmLXNhdmVkIGZpbGUgKG1pc3NpbmcgaW1wb3J0LCB1bmRlZmluZWQgc3ltYm9sLCB0cmFuc3BpbGUgZXJyb3IpIHVzZWQgdG9cbi8vIGJsYW5rIHRoZSBjYW52YXMgdG8gd2hpdGU6IHRoZSBzaGVsbCBkaWQgYGxvY2F0aW9uLnJlbG9hZCgpYCBzdHJhaWdodCBpbnRvIHRoZVxuLy8gYnJva2VuIG1vZHVsZS4gVGhlIHNoZWxsIG5vdyBzb2Z0LXJlbG9hZHMgKGltcG9ydC1iZWZvcmUtc3dhcCwgc2VlXG4vLyBgdGVtcGxhdGVzL19zaGVsbC5odG1sYCkgc28gYSBidWlsZC9pbXBvcnQgZXJyb3IgbmV2ZXIgdGVhcnMgZG93biB0aGUgZ29vZFxuLy8gcmVuZGVyLiBUaGlzIHJ1bnRpbWUgY2xvc2VzIHRoZSByZW1haW5pbmcgZ2FwIOKAlCBhICpyZW5kZXItdGltZSogdGhyb3cg4oCUIGJ5XG4vLyBrZWVwaW5nIHRoZSBsYXN0IGdvb2QgY2FudmFzIG1vdW50ZWQgdmlhIGFuIGVycm9yIGJvdW5kYXJ5IGFuZCBzdXJmYWNpbmcgYVxuLy8gXCJob2xkaW5nIGxhc3QgZ29vZFwiIHRvYXN0IGluc3RlYWQgb2YgYSB3aGl0ZSBzY3JlZW4uIFN0cmljdGx5IGdhdGVkIGJ5IHRoZVxuLy8gc2hlbGwgb24gYWdlbnQtYWN0aXZlOyBtYW51YWwgZWRpdHMga2VlcCB0aGUgcGxhaW4gcmVsb2FkIChzbyB0aGlzIGlzIGluZXJ0XG4vLyBmb3Igc29sbyBoYW5kLWVkaXRpbmcpLiBUaGUgcnVudGltZSBleHBvc2VzIGl0cyBzd2FwL2hvbGQgQVBJIG9uXG4vLyBgd2luZG93Ll9fbWF1ZGVDYW52YXNSdW50aW1lYCAodGhlIHNhbWUgd2luZG93LWhhbmRzaGFrZSBzdHlsZSB0aGUgc2hlbGxcbi8vIGFscmVhZHkgdXNlcyBmb3IgYF9fY2FudmFzX3JlbF9fYCBldGMuKS5cblxuZXhwb3J0IGludGVyZmFjZSBDYW52YXNSdW50aW1lQXBpIHtcbiAgLyoqIFN3YXAgaW4gYSBmcmVzaGx5LWltcG9ydGVkIGNhbnZhcyBtb2R1bGUncyBkZWZhdWx0IGV4cG9ydCAoc3VjY2VzcyBwYXRoKS4gKi9cbiAgcmVtb3VudDogKG5leHQ6IENvbXBvbmVudFR5cGUpID0+IHZvaWQ7XG4gIC8qKiBTaG93L2hpZGUgdGhlIFwiaG9sZGluZyBsYXN0IGdvb2RcIiB0b2FzdCAoYnVpbGQtZXJyb3IgcGF0aCBmcm9tIHRoZSBzaGVsbCkuICovXG4gIHNldEhvbGRpbmc6IChvbjogYm9vbGVhbiwgbWVzc2FnZT86IHN0cmluZykgPT4gdm9pZDtcbn1cblxuY29uc3QgUlVOVElNRV9LRVkgPSAnX19tYXVkZUNhbnZhc1J1bnRpbWUnO1xuXG4vKipcbiAqIEZpcmVzIGBvbk9rYCBvbmx5IHdoZW4gaXRzIHN1YnRyZWUgQ09NTUlUUyDigJQgaS5lLiByZW5kZXJzIHdpdGhvdXQgdGhyb3dpbmcuIEFcbiAqIHJlbmRlci10aW1lIHRocm93IGluIHRoZSBjYW52YXMgdW53aW5kcyB0byB0aGUgYm91bmRhcnkgYmVmb3JlIHRoaXMgY29tbWl0cyxcbiAqIHNvIGBvbk9rYCBuZXZlciBydW5zIGFuZCBgbGFzdEdvb2RgIGlzIG5vdCBhZHZhbmNlZCB0byBhIGJyb2tlbiBtb2R1bGUuXG4gKi9cbmZ1bmN0aW9uIE9rU2lnbmFsKHtcbiAgQ2FudmFzLFxuICBmaWxlLFxuICBvbk9rLFxufToge1xuICBDYW52YXM6IENvbXBvbmVudFR5cGU7XG4gIGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgb25PazogKCkgPT4gdm9pZDtcbn0pIHtcbiAgLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlRXhoYXVzdGl2ZURlcGVuZGVuY2llczogZmlyZSBvbmNlIHBlciBtb3VudCAoa2V5PWF0dGVtcHQgcmVtb3VudHMgdGhpcykuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgb25PaygpO1xuICB9LCBbXSk7XG4gIHJldHVybiBidWlsZENhbnZhc1RyZWUoQ2FudmFzLCBmaWxlKTtcbn1cblxuZXhwb3J0IGNsYXNzIENhbnZhc0Vycm9yQm91bmRhcnkgZXh0ZW5kcyBDb21wb25lbnQ8XG4gIHtcbiAgICBhdHRlbXB0OiBudW1iZXI7XG4gICAgb25FcnJvcjogKCkgPT4gdm9pZDtcbiAgICBmYWxsYmFjazogKCkgPT4gUmVhY3ROb2RlO1xuICAgIGNoaWxkcmVuOiBSZWFjdE5vZGU7XG4gIH0sXG4gIHsgaGFzRXJyb3I6IGJvb2xlYW4gfVxuPiB7XG4gIHN0YXRlID0geyBoYXNFcnJvcjogZmFsc2UgfTtcbiAgc3RhdGljIGdldERlcml2ZWRTdGF0ZUZyb21FcnJvcigpOiB7IGhhc0Vycm9yOiBib29sZWFuIH0ge1xuICAgIHJldHVybiB7IGhhc0Vycm9yOiB0cnVlIH07XG4gIH1cbiAgY29tcG9uZW50RGlkQ2F0Y2goKTogdm9pZCB7XG4gICAgdGhpcy5wcm9wcy5vbkVycm9yKCk7XG4gIH1cbiAgY29tcG9uZW50RGlkVXBkYXRlKHByZXY6IHsgYXR0ZW1wdDogbnVtYmVyIH0pOiB2b2lkIHtcbiAgICAvLyBBIG5ldyBjYW52YXMgKG5ldyBhdHRlbXB0KSBhcnJpdmVkIOKGkiBjbGVhciB0aGUgZXJyb3IgYW5kIHRyeSByZW5kZXJpbmcgaXQuXG4gICAgaWYgKHByZXYuYXR0ZW1wdCAhPT0gdGhpcy5wcm9wcy5hdHRlbXB0ICYmIHRoaXMuc3RhdGUuaGFzRXJyb3IpIHtcbiAgICAgIHRoaXMuc2V0U3RhdGUoeyBoYXNFcnJvcjogZmFsc2UgfSk7XG4gICAgfVxuICB9XG4gIHJlbmRlcigpOiBSZWFjdE5vZGUge1xuICAgIGlmICh0aGlzLnN0YXRlLmhhc0Vycm9yKSByZXR1cm4gdGhpcy5wcm9wcy5mYWxsYmFjaygpO1xuICAgIHJldHVybiB0aGlzLnByb3BzLmNoaWxkcmVuO1xuICB9XG59XG5cbmZ1bmN0aW9uIEhtckhvbGRpbmdUb2FzdCh7IG1lc3NhZ2UgfTogeyBtZXNzYWdlPzogc3RyaW5nIH0pOiBSZWFjdE5vZGUge1xuICByZXR1cm4gY3JlYXRlRWxlbWVudChcbiAgICAnZGl2JyxcbiAgICB7XG4gICAgICBjbGFzc05hbWU6ICdkYy1obXItaG9sZGluZycsXG4gICAgICByb2xlOiAnc3RhdHVzJyxcbiAgICAgICdhcmlhLWxpdmUnOiAncG9saXRlJyxcbiAgICAgIHRpdGxlOiBtZXNzYWdlID8gYEhvbGRpbmcgbGFzdCB3b3JraW5nIHJlbmRlciDigJQgJHttZXNzYWdlfWAgOiAnSG9sZGluZyBsYXN0IHdvcmtpbmcgcmVuZGVyJyxcbiAgICB9LFxuICAgICfij7ggYnVpbGQgZXJyb3Ig4oCUIGRyxb7DrW0gcG9zbGVkbsOtIGZ1bmvEjW7DrSB2ZXJ6aSdcbiAgKTtcbn1cblxuZnVuY3Rpb24gQ2FudmFzSG1yUnVudGltZSh7XG4gIGluaXRpYWxDYW52YXMsXG4gIGZpbGUsXG59OiB7XG4gIGluaXRpYWxDYW52YXM6IENvbXBvbmVudFR5cGU7XG4gIGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn0pOiBSZWFjdE5vZGUge1xuICBjb25zdCBbeyBjYW52YXMsIGF0dGVtcHQgfSwgc2V0Q2FudmFzU3RhdGVdID0gdXNlU3RhdGUoeyBjYW52YXM6IGluaXRpYWxDYW52YXMsIGF0dGVtcHQ6IDAgfSk7XG4gIGNvbnN0IFtob2xkaW5nLCBzZXRIb2xkaW5nU3RhdGVdID0gdXNlU3RhdGU8eyBvbjogYm9vbGVhbjsgbWVzc2FnZT86IHN0cmluZyB9Pih7IG9uOiBmYWxzZSB9KTtcbiAgY29uc3QgbGFzdEdvb2QgPSB1c2VSZWY8Q29tcG9uZW50VHlwZSB8IG51bGw+KG51bGwpO1xuICBjb25zdCBjYW52YXNSZWYgPSB1c2VSZWYoY2FudmFzKTtcbiAgY2FudmFzUmVmLmN1cnJlbnQgPSBjYW52YXM7XG5cbiAgLy8gUHVibGlzaCB0aGUgcnVudGltZSBBUEkgZm9yIHRoZSBzaGVsbCBITVIgY2xpZW50LlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGFwaTogQ2FudmFzUnVudGltZUFwaSA9IHtcbiAgICAgIHJlbW91bnQ6IChuZXh0KSA9PiBzZXRDYW52YXNTdGF0ZSgocykgPT4gKHsgY2FudmFzOiBuZXh0LCBhdHRlbXB0OiBzLmF0dGVtcHQgKyAxIH0pKSxcbiAgICAgIHNldEhvbGRpbmc6IChvbiwgbWVzc2FnZSkgPT4gc2V0SG9sZGluZ1N0YXRlKG9uID8geyBvbjogdHJ1ZSwgbWVzc2FnZSB9IDogeyBvbjogZmFsc2UgfSksXG4gICAgfTtcbiAgICAod2luZG93IGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pW1JVTlRJTUVfS0VZXSA9IGFwaTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgKHdpbmRvdyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtSVU5USU1FX0tFWV0gPSB1bmRlZmluZWQ7XG4gICAgfTtcbiAgfSwgW10pO1xuXG4gIGNvbnN0IGhhbmRsZU9rID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGxhc3RHb29kLmN1cnJlbnQgPSBjYW52YXNSZWYuY3VycmVudDtcbiAgICAvLyBUaGUgbmV3IGNhbnZhcyByZW5kZXJlZCBjbGVhbiDihpIgZHJvcCBhbnkgaG9sZGluZyBzdGF0ZS5cbiAgICBzZXRIb2xkaW5nU3RhdGUoKGgpID0+IChoLm9uID8geyBvbjogZmFsc2UgfSA6IGgpKTtcbiAgfSwgW10pO1xuXG4gIGNvbnN0IGhhbmRsZUVycm9yID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldEhvbGRpbmdTdGF0ZSh7IG9uOiB0cnVlLCBtZXNzYWdlOiAncmVuZGVyIGVycm9yJyB9KTtcbiAgfSwgW10pO1xuXG4gIGNvbnN0IGZhbGxiYWNrID0gdXNlQ2FsbGJhY2soKCk6IFJlYWN0Tm9kZSA9PiB7XG4gICAgY29uc3QgTEcgPSBsYXN0R29vZC5jdXJyZW50O1xuICAgIHJldHVybiBMRyA/IGJ1aWxkQ2FudmFzVHJlZShMRywgZmlsZSkgOiBudWxsO1xuICB9LCBbZmlsZV0pO1xuXG4gIHJldHVybiBjcmVhdGVFbGVtZW50KFxuICAgIEZyYWdtZW50LFxuICAgIG51bGwsXG4gICAgY3JlYXRlRWxlbWVudChcbiAgICAgIENhbnZhc0Vycm9yQm91bmRhcnksXG4gICAgICB7IGF0dGVtcHQsIG9uRXJyb3I6IGhhbmRsZUVycm9yLCBmYWxsYmFjayB9LFxuICAgICAgLy8ga2V5PWF0dGVtcHQg4oaSIGVhY2ggc29mdC1yZWxvYWQgcmVtb3VudHMgYSBmcmVzaCBzdWJ0cmVlIChhbmQgcmVzZXRzIHRoZVxuICAgICAgLy8gYm91bmRhcnkncyBjaGlsZCksIG1hdGNoaW5nIHRoZSBjbGVhbi1zbGF0ZSBzZW1hbnRpY3Mgb2YgYSBmdWxsIHJlbG9hZC5cbiAgICAgIGNyZWF0ZUVsZW1lbnQoT2tTaWduYWwsIHsga2V5OiBhdHRlbXB0LCBDYW52YXM6IGNhbnZhcywgZmlsZSwgb25PazogaGFuZGxlT2sgfSlcbiAgICApLFxuICAgIGhvbGRpbmcub24gPyBjcmVhdGVFbGVtZW50KEhtckhvbGRpbmdUb2FzdCwgeyBtZXNzYWdlOiBob2xkaW5nLm1lc3NhZ2UgfSkgOiBudWxsXG4gICk7XG59XG4iLAogICAgIi8qKlxuICogQGZpbGUgICAgICAgY29tbWVudHMtb3ZlcmxheS50c3gg4oCUIEZpZ0phbS1zdHlsZSBpbi1wbGFjZSBjb21tZW50cyBvdmVybGF5XG4gKiBAc2NvcGUgICAgICBhcHBzL3N0dWRpby9jb21tZW50cy1vdmVybGF5LnRzeFxuICogQHB1cnBvc2UgICAgUmVuZGVycyBEUy1zdHlsZWQgY29tbWVudCBwaW5zIChQaGFzZSA2IFRhc2sgMiksIHRoZSBpbi1wbGFjZVxuICogICAgICAgICAgICAgY29tcG9zZXIgYnViYmxlIChUYXNrIDMpLCBhbmQgdGhlIHRocmVhZCBwb3BvdmVyIChUYXNrIDQpXG4gKiAgICAgICAgICAgICBpbnNpZGUgdGhlIGNhbnZhcyBpZnJhbWUuIFNpYmxpbmcgdG8gYGFubm90YXRpb25zLWxheWVyYCwgYnV0XG4gKiAgICAgICAgICAgICBOT1QgcG9ydGFsZWQgaW50byBgLmRjLXdvcmxkYCDigJQgcmVuZGVycyBhcyBhIHNjcmVlbi1jb29yZFxuICogICAgICAgICAgICAgYHBvc2l0aW9uOiBmaXhlZGAgbGF5ZXIgaW5zdGVhZCAoRERSLTAzNDsgc2VlIFwiUGluIHBvc2l0aW9uXG4gKiAgICAgICAgICAgICBtYXRoXCIgYmVsb3cpLlxuICpcbiAqIERhdGEgZmxvdyAoUGhhc2UgNiBUYXNrIDIg4oCUIHBpbnMgb25seTsgY29tcG9zZXIgKyB0aHJlYWQgbGFuZCBpbiBUYXNrIDMvNCk6XG4gKiAgIDEuIFNoZWxsIChgY2xpZW50L2FwcC5qc3hgKSBwdXNoZXMgYHsgZGduOiAnY29tbWVudHMtc2V0JywgY29tbWVudHMgfWBcbiAqICAgICAgaW50byB0aGUgaWZyYW1lIHdoZW5ldmVyIGl0cyBgY29tbWVudHNCeUZpbGVbYWN0aXZlUGF0aF1gIGNoYW5nZXMuXG4gKiAgIDIuIE92ZXJsYXkgYWxzbyBmZXRjaGVzIGAvX2NvbW1lbnRzP2ZpbGU9Li4uYCBvbiBtb3VudCBhcyBhIHNlbGYtaGVhbCDigJRcbiAqICAgICAgbGV0cyB0aGUgb3ZlcmxheSByZW5kZXIgZXZlbiBpZiB0aGUgc2hlbGwgaGFzbid0IGJyb2FkY2FzdCB5ZXRcbiAqICAgICAgKHJhY2Ugb24gZmlyc3QgaWZyYW1lIGxvYWQpLlxuICogICAzLiBTaGVsbCBwdXNoZXMgYHsgZGduOiAnY29tbWVudC1mb2N1cycsIGlkIH1gIHdoZW4gdGhlIHVzZXIgY2xpY2tzIGEgcm93XG4gKiAgICAgIGluIHRoZSBjb21tZW50cyBwYW5lbCDigJQgb3ZlcmxheSBoaWdobGlnaHRzIHRoZSBtYXRjaGluZyBwaW4uXG4gKiAgIDQuIE92ZXJsYXkgcG9zdHMgYHsgZGduOiAnY29tbWVudC1jbGljaycsIGlkIH1gIGJhY2sgdG8gdGhlIHNoZWxsIHdoZW5cbiAqICAgICAgdGhlIHVzZXIgY2xpY2tzIGEgcGluIOKAlCBzYW1lIGNoYW5uZWwgdGhlIGxlZ2FjeSBgZGduLXBpbmAgb3ZlcmxheVxuICogICAgICB1c2VkOyB0aGUgc2hlbGwgYWxyZWFkeSByb3V0ZXMgaXQgdG8gYHNldEZvY3VzZWRDb21tZW50SWRgLlxuICpcbiAqIEZpbHRlciByZXNwZWN0IOKAlCBQaGFzZSA2IFRhc2sgMiBkZWZhdWx0IGlzIFwiaGlkZSByZXNvbHZlZFwiLiBUaGUgc2hlbGwgd2lsbFxuICogZ2FpbiBhIGBjb21tZW50cy1maWx0ZXJgIGNoYW5uZWwgaW4gVGFzayA2OyB1bnRpbCB0aGVuIHRoZSBvdmVybGF5IGFsd2F5c1xuICogaGlkZXMgcmVzb2x2ZWQgcGlucy4gUGxhbi1hbGlnbmVkLlxuICpcbiAqIFBpbiBwb3NpdGlvbiBtYXRoIOKAlCBzZWUgYHJlc29sdmVDb21tZW50VGFyZ2V0YCBiZWxvdy4gU2NyZWVuIGNvb3JkcyBjb21lXG4gKiBzdHJhaWdodCBmcm9tIGBnZXRCb3VuZGluZ0NsaWVudFJlY3QoKWAgb24gdGhlIGxpdmUgdGFyZ2V0OyBDU1Mgem9vbSBvbiB0aGVcbiAqIHdvcmxkIHBsYW5lIGlzIGFscmVhZHkgYmFrZWQgaW50byB0aGF0IHJlY3QsIHNvIG5vIHpvb20gbWF0aCBpcyBuZWVkZWQgaGVyZS5cbiAqXG4gKiBUYXJnZXQgcmVzb2x1dGlvbiArIG9ycGhhbiBjbGVhbnVwIOKAlCBhIGNhbnZhcyByZXdyaXRlIChgL2Rlc2lnbjplZGl0YFxuICogcmVnZW5lcmF0aW5nIEpTWCkgcmVudW1iZXJzIGBkYXRhLWNkLWlkYCAoRERSLTAxOSdzIGRvY3VtZW50ZWQgQVNULXBvc2l0aW9uXG4gKiB0cmFkZS1vZmYpLCB3aGljaCBjYW4gc2lsZW50bHkgcmVhbmNob3IgYSBjb21tZW50IHRvIHRoZSB3cm9uZyBlbGVtZW50IG9yIHRvXG4gKiBub3RoaW5nLiBgcmVzb2x2ZUNvbW1lbnRUYXJnZXRgIHRyaWVzIHRoZSBzdG9yZWQgc2VsZWN0b3IgZmlyc3QsIGZhbGxzIGJhY2tcbiAqIHRvIGEgc3RydWN0dXJhbCBtYXRjaCB2aWEgYHJlc29sdmVCeURvbVBhdGhgIChkb20tc2VsZWN0aW9uLnRzKSB3aGVuIHRoZVxuICogZGlyZWN0IGhpdCBpcyBtaXNzaW5nIG9yIGxvb2tzIGxpa2UgdGhlIHdyb25nIGVsZW1lbnQgKHRhZyBtaXNtYXRjaCksIGFuZCDigJRcbiAqIHBlciBERFItMDM0J3MgZGVmZXJyZWQgZnV0dXJlLXdvcmsgaXRlbSDigJQgYENvbW1lbnRQaW5gIGF1dG8tZGVsZXRlcyBhXG4gKiBjb21tZW50IHdob3NlIHRhcmdldCBzdGF5cyB1bnJlc29sdmFibGUgcGFzdCBhIHNob3J0IGdyYWNlIHdpbmRvdy5cbiAqXG4gKiBQb3B1cCBwbGFjZW1lbnQg4oCUIGBDb21tZW50Q29tcG9zZXJgIC8gYENvbW1lbnRUaHJlYWRgIHBpY2sgYSBzaWRlXG4gKiAobGVmdC9yaWdodCwgYWJvdmUvYmVsb3cgdGhlIGFuY2hvcikgdGhhdCBhY3R1YWxseSBmaXRzIHRoZSB2aWV3cG9ydCB2aWFcbiAqIGBwbGFjZU5lYXJQb2ludGAsIGluc3RlYWQgb2YgYWx3YXlzIGdyb3dpbmcgZG93bi1yaWdodCAod2hpY2ggdXNlZCB0byBjbGlwXG4gKiBvZmYtc2NyZWVuIG5lYXIgdGhlIGNhbnZhcyBlZGdlKS5cbiAqXG4gKiBUaGUgbGVnYWN5IHZhbmlsbGEtSlMgYCNkZ24tcGluLWxheWVyYCBpbmplY3RlZCBieSBgaW5zcGVjdC50c2AgaXMgaGlkZGVuXG4gKiBvbiBtb3VudCB0byBhdm9pZCBkb3VibGUtcGlucyBpbnNpZGUgVFNYIGNhbnZhc2VzLiBUaGUgbGVnYWN5IGxheWVyIHN0aWxsXG4gKiByZW5kZXJzIGZvciBgLmh0bWxgIG1vY2tzIHdoZXJlIHRoaXMgUmVhY3Qgb3ZlcmxheSBuZXZlciBtb3VudHMuXG4gKi9cblxuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0JztcblxuaW1wb3J0IHsgcmVzb2x2ZUJ5RG9tUGF0aCB9IGZyb20gJy4vZG9tLXNlbGVjdGlvbi50cyc7XG5pbXBvcnQgeyB1c2VDb2xsYWIgfSBmcm9tICcuL3VzZS1jb2xsYWIudHN4JztcbmltcG9ydCB7IHVzZVNlbGVjdGlvblNldE9wdGlvbmFsIH0gZnJvbSAnLi91c2Utc2VsZWN0aW9uLXNldC50c3gnO1xuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFR5cGVzIOKAlCBrZXB0IGluIHN5bmMgd2l0aCBgQ29tbWVudGAgaW4gYGFwaS50c2AuIFdlIG1pcnJvciB0aGUgc2hhcGUgcmF0aGVyXG4vLyB0aGFuIGltcG9ydCB0byBhdm9pZCBwdWxsaW5nIHNlcnZlciB0eXBlcyBpbnRvIHRoZSBjYW52YXMgcnVudGltZSBidW5kbGUuXG5cbmludGVyZmFjZSBPdmVybGF5Qm91bmRzIHtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHc6IG51bWJlcjtcbiAgaDogbnVtYmVyO1xufVxuXG4vLyBTZWxlY3Rpb24gcGF5bG9hZCBwb3N0ZWQgYnkgY2FudmFzLXNoZWxsJ3MgYG9uRHJvcENvbW1lbnRgLiBNaXJyb3JzIHRoZVxuLy8gc2hhcGUgYGhvdmVyVGFyZ2V0VG9TZWxlY3Rpb25gIHJldHVybnM7IHdlIGtlZXAgaXQgbG9vc2Ugc28gdGhlIG92ZXJsYXlcbi8vIGRvZXNuJ3QgZGVwZW5kIG9uIGNhbnZhcy1zaGVsbCB0eXBlcy5cbmludGVyZmFjZSBDb21wb3NlU2VsZWN0aW9uIHtcbiAgZmlsZT86IHN0cmluZztcbiAgaWQ/OiBzdHJpbmc7XG4gIHNlbGVjdG9yOiBzdHJpbmc7XG4gIGFydGJvYXJkSWQ/OiBzdHJpbmcgfCBudWxsO1xuICB0YWc6IHN0cmluZztcbiAgY2xhc3Nlczogc3RyaW5nO1xuICB0ZXh0OiBzdHJpbmc7XG4gIGRvbV9wYXRoOiBzdHJpbmdbXTtcbiAgYm91bmRzOiBPdmVybGF5Qm91bmRzIHwgbnVsbDtcbiAgaHRtbDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgQ29tcG9zZXJTdGF0ZSB7XG4gIHNlbGVjdGlvbjogQ29tcG9zZVNlbGVjdGlvbjtcbiAgY2xpZW50WDogbnVtYmVyO1xuICBjbGllbnRZOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBPdmVybGF5UmVwbHkge1xuICBpZDogc3RyaW5nO1xuICBhdXRob3I6IHN0cmluZztcbiAgYm9keTogc3RyaW5nO1xuICBjcmVhdGVkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3ZlcmxheUNvbW1lbnQge1xuICBpZDogc3RyaW5nO1xuICBmaWxlOiBzdHJpbmc7XG4gIHNlbGVjdG9yOiBzdHJpbmc7XG4gIC8qKiBPY2N1cnJlbmNlIGluZGV4IGFtb25nIGBxdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKWAg4oCUIGRpc2FtYmlndWF0ZXMgYVxuICAgKiBjb21wb25lbnQgcmVwZWF0ZWQgd2l0aGluIG9uZSBhcnRib2FyZC4gQWJzZW50IChvbGQgY29tbWVudHMpIOKGkiBmaXJzdC4gKi9cbiAgaW5kZXg/OiBudW1iZXI7XG4gIGJvdW5kczogT3ZlcmxheUJvdW5kcyB8IG51bGw7XG4gIHRleHQ6IHN0cmluZztcbiAgc3RhdHVzOiAnb3BlbicgfCAncmVzb2x2ZWQnO1xuICBjcmVhdGVkOiBzdHJpbmc7XG4gIHJlc29sdmVkX2F0OiBzdHJpbmcgfCBudWxsO1xuICBhdXRob3I/OiBzdHJpbmc7XG4gIHRocmVhZD86IE92ZXJsYXlSZXBseVtdO1xuICBtZW50aW9ucz86IHN0cmluZ1tdO1xuICAvKiogVGFyZ2V0J3MgdGFnL2NsYXNzZXMvYW5jZXN0b3ItcGF0aCBhdCBjcmVhdGlvbiB0aW1lIOKAlCB1bnVzZWQgZm9yXG4gICAqIHJlbmRlcmluZywgYnV0IHRoZSBzdHJ1Y3R1cmFsLWZhbGxiYWNrIGluZ3JlZGllbnRzIGByZXNvbHZlQ29tbWVudFRhcmdldGBcbiAgICogcmVhY2hlcyBmb3Igd2hlbiB0aGUgc3RvcmVkIGBzZWxlY3RvcmAgbm8gbG9uZ2VyIGlkZW50aWZpZXMgdGhlIHJpZ2h0XG4gICAqIGVsZW1lbnQgKHNlZSBmaWxlIGhlYWRlcikuIEFic2VudCBvbiBsZWdhY3kgY29tbWVudHMuICovXG4gIHRhZz86IHN0cmluZztcbiAgY2xhc3Nlcz86IHN0cmluZztcbiAgZG9tX3BhdGg/OiBzdHJpbmdbXTtcbiAgLy8gaHRtbF9leGNlcnB0IHVudXNlZCBhdCBvdmVybGF5IGxheWVyOyBrZXB0IG9mZiB0aGUgdHlwZSB0byBrZWVwIHRoZVxuICAvLyBzdXJmYWNlIHRpZ2h0LlxufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIENTUyBsb2FkIOKAlCBzaWJsaW5nIHN0eWxlc2hlZXQsIGZldGNoZWQgb25jZSBwZXIgc2Vzc2lvbiB2aWEgYSA8bGluaz4gdGFnLlxuLy8gSW5saW5pbmcgdGhlIGZpbGUgYXQgYnVpbGQgdGltZSB3b3VsZCBjb3N0IGFuIGV4dHJhIGJ1bmRsZXIgY29uZmlnOyB0aGVcbi8vIG92ZXJsYXkgaXMgaW50ZXJuYWwtb25seSBzbyBhIHJ1bnRpbWUgPGxpbms+IGlzIGZpbmUuXG5cbmNvbnN0IENTU19IUkVGID0gJy9fY2xpZW50L2NvbW1lbnRzLW92ZXJsYXkuY3NzJztcblxuZnVuY3Rpb24gZW5zdXJlT3ZlcmxheVN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbS1vdmVybGF5LWNzcycpKSByZXR1cm47XG4gIGNvbnN0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XG4gIGxpbmsuaWQgPSAnY20tb3ZlcmxheS1jc3MnO1xuICBsaW5rLnJlbCA9ICdzdHlsZXNoZWV0JztcbiAgbGluay5ocmVmID0gQ1NTX0hSRUY7XG4gIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQobGluayk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gRmlsZSBkZXJpdmF0aW9uIOKAlCBzYW1lIGxvZ2ljIGFzIGNhbnZhcy1zaGVsbC50c3g6OmRlcml2ZUZpbGUoKS4gRHVwbGljYXRlZFxuLy8gaGVyZSBzbyB0aGUgb3ZlcmxheSBjYW4gZmV0Y2ggaXRzIG93biBjb21tZW50cyBvbiBtb3VudCB3aXRob3V0IGltcG9ydGluZ1xuLy8gZnJvbSBjYW52YXMtc2hlbGwgKHdoaWNoIHdvdWxkIGNyZWF0ZSBhIGN5Y2xlKS5cblxuZnVuY3Rpb24gZGVyaXZlRmlsZSgpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lO1xuICAgIGlmIChwID09PSAnL19jYW52YXMtc2hlbGwuaHRtbCcgfHwgcCA9PT0gJy9fY2FudmFzLXNoZWxsJykge1xuICAgICAgY29uc3QgcXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuICAgICAgY29uc3QgY2FudmFzID0gcXMuZ2V0KCdjYW52YXMnKSA/PyAnJztcbiAgICAgIGNvbnN0IGRlc2lnblJlbCA9IChxcy5nZXQoJ2Rlc2lnblJlbCcpID8/ICcuZGVzaWduJykucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgJycpO1xuICAgICAgcmV0dXJuIGNhbnZhcyA/IGAke2Rlc2lnblJlbH0vJHtjYW52YXN9YCA6IG51bGw7XG4gICAgfVxuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocCkucmVwbGFjZSgvXlxcLy8sICcnKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBQb3NpdGlvbiByZXNvbHZlcnMg4oCUIHNjcmVlbiBjb29yZHMgdmlhIGdldEJvdW5kaW5nQ2xpZW50UmVjdC4gTWlycm9ycyB0aGVcbi8vIGBTZWxlY3Rpb25IYWxvc2AgLyBgSG92ZXJIYWxvYCBwYXR0ZXJuIGluIGNhbnZhcy1zaGVsbC50c3ggc28gdGhlIGNvbW1lbnRzXG4vLyBsYXllciBjYW4gcmVuZGVyIGFzIGEgZml4ZWQtcG9zaXRpb24gc2libGluZyBvZiBgLmRjLWNhbnZhc2AgKGFib3ZlIHRoZVxuLy8gaGFsbyBjaHJvbWUgYXQgei1pbmRleCA1KSBpbnN0ZWFkIG9mIGJlaW5nIHBvcnRhbGVkIGludG8gYC5kYy13b3JsZGAgd2hlcmVcbi8vIGl0IHdvdWxkIGxvc2UgdGhlIHN0YWNraW5nIGJhdHRsZS5cblxuZXhwb3J0IGludGVyZmFjZSBUYXJnZXRSZWYge1xuICBzZWxlY3Rvcjogc3RyaW5nO1xuICBpbmRleD86IG51bWJlcjtcbiAgdGFnPzogc3RyaW5nO1xuICBjbGFzc2VzPzogc3RyaW5nO1xuICBkb21fcGF0aD86IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIFJlc29sdmUgYSBjb21tZW50IChvciBpbi1wcm9ncmVzcyBzZWxlY3Rpb24pJ3MgbGl2ZSB0YXJnZXQgZWxlbWVudC4gVHJpZXNcbiAqIHRoZSBzdG9yZWQgYGRhdGEtY2QtaWRgIHNlbGVjdG9yIGZpcnN0IOKAlCBjaGVhcCwgY29ycmVjdCBpbiB0aGUgY29tbW9uIGNhc2UuXG4gKiBBIHRhZyBtaXNtYXRjaCBhZ2FpbnN0IHdoYXQgd2FzIGNhcHR1cmVkIGF0IGNyZWF0aW9uIHRpbWUgaXMgdGhlIHRlbGwgdGhhdFxuICogYGRhdGEtY2QtaWRgIHJlbnVtYmVyZWQgb250byBhbiB1bnJlbGF0ZWQgZWxlbWVudCAoRERSLTAxOSk7IHdoZW4gdGhhdFxuICogaGFwcGVucywgb3IgdGhlIHNlbGVjdG9yIG1hdGNoZXMgbm90aGluZyBhdCBhbGwsIGZhbGwgYmFjayB0byBhIHN0cnVjdHVyYWxcbiAqIG1hdGNoIHZpYSBgcmVzb2x2ZUJ5RG9tUGF0aGAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQ29tbWVudFRhcmdldCh0YXJnZXQ6IFRhcmdldFJlZik6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGlmICghdGFyZ2V0LnNlbGVjdG9yKSByZXR1cm4gbnVsbDtcbiAgbGV0IGVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICB0cnkge1xuICAgIC8vIGluZGV4IGRpc2FtYmlndWF0ZXMgYSBjb21wb25lbnQgcmVwZWF0ZWQgd2l0aGluIG9uZSBhcnRib2FyZCAocXVlcnlTZWxlY3RvclxuICAgIC8vIGFsb25lIHdvdWxkIGFsd2F5cyBncmFiIHRoZSBmaXJzdCBtYXRjaCkuIEFic2VudC8wIOKGkiBmaXJzdC5cbiAgICBjb25zdCBhbGwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHRhcmdldC5zZWxlY3Rvcik7XG4gICAgY29uc3QgaSA9IHRhcmdldC5pbmRleCAmJiB0YXJnZXQuaW5kZXggPiAwICYmIHRhcmdldC5pbmRleCA8IGFsbC5sZW5ndGggPyB0YXJnZXQuaW5kZXggOiAwO1xuICAgIGVsID0gKGFsbFtpXSA/PyBhbGxbMF0gPz8gbnVsbCkgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICB9IGNhdGNoIHtcbiAgICBlbCA9IG51bGw7XG4gIH1cbiAgaWYgKGVsICYmIHRhcmdldC50YWcgJiYgZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpICE9PSB0YXJnZXQudGFnLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBlbCA9IG51bGw7XG4gIH1cbiAgaWYgKCFlbCAmJiB0YXJnZXQuZG9tX3BhdGg/Lmxlbmd0aCkge1xuICAgIGNvbnN0IGFydGJvYXJkSWQgPSB0YXJnZXQuc2VsZWN0b3IubWF0Y2goL2RhdGEtZGMtc2NyZWVuPVwiKFteXCJdKylcIi8pPy5bMV07XG4gICAgZWwgPSByZXNvbHZlQnlEb21QYXRoKGRvY3VtZW50LCB7XG4gICAgICBhcnRib2FyZElkLFxuICAgICAgdGFnOiB0YXJnZXQudGFnLFxuICAgICAgY2xhc3NlczogdGFyZ2V0LmNsYXNzZXMsXG4gICAgICBkb21fcGF0aDogdGFyZ2V0LmRvbV9wYXRoLFxuICAgIH0pIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHNjcmVlblJlY3RGb3IodGFyZ2V0OiBUYXJnZXRSZWYpOiB7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB3OiBudW1iZXI7XG4gIGg6IG51bWJlcjtcbn0gfCBudWxsIHtcbiAgY29uc3QgZWwgPSByZXNvbHZlQ29tbWVudFRhcmdldCh0YXJnZXQpO1xuICBpZiAoIWVsPy5pc0Nvbm5lY3RlZCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHIgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgaWYgKHIud2lkdGggPT09IDAgJiYgci5oZWlnaHQgPT09IDApIHJldHVybiBudWxsO1xuICByZXR1cm4geyB4OiByLmxlZnQsIHk6IHIudG9wLCB3OiByLndpZHRoLCBoOiByLmhlaWdodCB9O1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEVkZ2UtYXdhcmUgcG9wdXAgcGxhY2VtZW50IOKAlCBwaWNrcyBhIHNpZGUgKGxlZnQvcmlnaHQsIGFib3ZlL2JlbG93IHRoZVxuLy8gYW5jaG9yIHBvaW50KSB0aGF0IGFjdHVhbGx5IGZpdHMgdGhlIHZpZXdwb3J0LCBmYWxsaW5nIGJhY2sgdG8gYW4gaW53YXJkXG4vLyBjbGFtcCBmb3IgdGhlIHJhcmUgY2FzZSB3aGVyZSBubyBzaWRlIGZ1bGx5IGZpdHMgKHRpbnkgdmlld3BvcnQpLiBNaXJyb3JzXG4vLyB0aGUgcGF0dGVybiBjb250ZXh0LW1lbnUudHN4IGFscmVhZHkgdXNlcyBmb3IgdGhlIHNhbWUgcHJvYmxlbSwgYnV0IGZsaXBzXG4vLyBheGVzIGluc3RlYWQgb2Ygb25seSBjbGFtcGluZywgcGVyIHRoZSBleHBsaWNpdCBhc2s6IGFsd2F5cyBvcGVuIHRvd2FyZFxuLy8gd2hpY2hldmVyIHNpZGUgaGFzIHJvb20sIG5vdCBqdXN0IFwic2hpZnRlZCBiYWNrIGludG8gdmlld1wiLlxuZXhwb3J0IGZ1bmN0aW9uIHBsYWNlTmVhclBvaW50KFxuICBwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LFxuICBzaXplOiB7IHc6IG51bWJlcjsgaDogbnVtYmVyIH1cbik6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XG4gIGNvbnN0IG1hcmdpbiA9IDg7XG4gIGNvbnN0IHZ3ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cuaW5uZXJXaWR0aCA6IHBvaW50LnggKyBzaXplLnc7XG4gIGNvbnN0IHZoID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cuaW5uZXJIZWlnaHQgOiBwb2ludC55ICsgc2l6ZS5oO1xuXG4gIGxldCB4ID0gcG9pbnQueDtcbiAgaWYgKHggKyBzaXplLncgKyBtYXJnaW4gPiB2dykge1xuICAgIGNvbnN0IGZsaXBwZWQgPSBwb2ludC54IC0gc2l6ZS53O1xuICAgIHggPSBmbGlwcGVkID49IG1hcmdpbiA/IGZsaXBwZWQgOiBNYXRoLm1heChtYXJnaW4sIHZ3IC0gc2l6ZS53IC0gbWFyZ2luKTtcbiAgfVxuXG4gIGxldCB5ID0gcG9pbnQueTtcbiAgaWYgKHkgKyBzaXplLmggKyBtYXJnaW4gPiB2aCkge1xuICAgIGNvbnN0IGZsaXBwZWQgPSBwb2ludC55IC0gc2l6ZS5oO1xuICAgIHkgPSBmbGlwcGVkID49IG1hcmdpbiA/IGZsaXBwZWQgOiBNYXRoLm1heChtYXJnaW4sIHZoIC0gc2l6ZS5oIC0gbWFyZ2luKTtcbiAgfVxuXG4gIHJldHVybiB7IHgsIHkgfTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBQdWJsaWMgY29tcG9uZW50IOKAlCBtb3VudGVkIGZyb20gY2FudmFzLXNoZWxsLnRzeCBhbG9uZ3NpZGUgVG9vbFBhbGV0dGUgL1xuLy8gQW5ub3RhdGlvbnNMYXllciAvIFNuYXBHdWlkZU92ZXJsYXkuXG5cbmV4cG9ydCBmdW5jdGlvbiBDb21tZW50c092ZXJsYXkoKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgZW5zdXJlT3ZlcmxheVN0eWxlcygpO1xuXG4gIC8vIE9wdGlvbmFsIOKAlCBDb21tZW50c092ZXJsYXkgaXMgbW91bnRlZCBpbnNpZGUgU2VsZWN0aW9uU2V0UHJvdmlkZXIgaW4gdGhlXG4gIC8vIHN0YW5kYXJkIENhbnZhc1NoZWxsIHRyZWUsIGJ1dCBzdGF5cyB1c2FibGUgaWYgYSBob3N0IGV2ZXIgZW1iZWRzIGl0XG4gIC8vIG91dHNpZGUgdGhhdCBwcm92aWRlciAocmV0dXJucyBudWxsIGluc3RlYWQgb2YgdGhyb3dpbmcpLlxuICBjb25zdCBzZWxTZXQgPSB1c2VTZWxlY3Rpb25TZXRPcHRpb25hbCgpO1xuICBjb25zdCBbY29tbWVudHMsIHNldENvbW1lbnRzXSA9IHVzZVN0YXRlPE92ZXJsYXlDb21tZW50W10+KFtdKTtcbiAgY29uc3QgW2ZvY3VzZWRJZCwgc2V0Rm9jdXNlZElkXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbY29tcG9zZXIsIHNldENvbXBvc2VyXSA9IHVzZVN0YXRlPENvbXBvc2VyU3RhdGUgfCBudWxsPihudWxsKTtcbiAgY29uc3QgZmlsZSA9IHVzZU1lbW8oKCkgPT4gZGVyaXZlRmlsZSgpLCBbXSk7XG5cbiAgLy8gRHJvcCB0aGUgbGVnYWN5IGAjZGduLXBpbi1sYXllcmAgc28gd2UgZG9uJ3QgcmVuZGVyIGR1cGxpY2F0ZSBwaW5zIGluc2lkZVxuICAvLyBUU1ggY2FudmFzZXMuIFRoZSBsYXllciBzaGlwcyBpbiBldmVyeSBzZXJ2ZWQgSFRNTCBwYWdlIHZpYSBpbnNwZWN0LnRzO1xuICAvLyBmb3IgYC5odG1sYCBtb2NrcyAobm8gY2FudmFzLXNoZWxsIG1vdW50KSBpdCBzdGlsbCBkb2VzIGl0cyBqb2IuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICBjb25zdCBsZWdhY3kgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGduLXBpbi1sYXllcicpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICBpZiAoIWxlZ2FjeSkgcmV0dXJuO1xuICAgIGNvbnN0IHByZXYgPSBsZWdhY3kuc3R5bGUuZGlzcGxheTtcbiAgICBsZWdhY3kuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgbGVnYWN5LnN0eWxlLmRpc3BsYXkgPSBwcmV2O1xuICAgIH07XG4gIH0sIFtdKTtcblxuICAvLyBNaXJyb3IgYSBjb21tZW50IGludG8gdGhlIGNhbnZhcyBzZWxlY3Rpb24gc2V0IHNvIFNlbGVjdGlvbkhhbG9zIHBhaW50c1xuICAvLyB0aGUgc2FtZSBoYWxvIENtZC1jbGljayB3b3VsZC4gQ2FsbGVkIGZyb20gYm90aCB0aGUgaW4taWZyYW1lIHBpbiBjbGlja1xuICAvLyBBTkQgdGhlIGluYm91bmQgYGNvbW1lbnQtZm9jdXNgIHBvc3RNZXNzYWdlIHNvIGp1bXBpbmcgZnJvbSB0aGUgc2hlbGwnc1xuICAvLyBDb21tZW50cyBwYW5lbCBwcm9kdWNlcyB0aGUgc2FtZSB2aXN1YWwgZmVlZGJhY2sgYXMgY2xpY2tpbmcgdGhlIHBpbi5cbiAgY29uc3QgbWlycm9yU2VsZWN0aW9uID0gdXNlQ2FsbGJhY2soXG4gICAgKGNvbW1lbnQ6IE92ZXJsYXlDb21tZW50IHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgICBpZiAoIXNlbFNldCkgcmV0dXJuO1xuICAgICAgaWYgKCFjb21tZW50Py5zZWxlY3Rvcikge1xuICAgICAgICBzZWxTZXQuY2xlYXIoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgY2RNYXRjaCA9IGNvbW1lbnQuc2VsZWN0b3IubWF0Y2goL2RhdGEtY2QtaWQ9XCIoW15cIl0rKVwiLyk7XG4gICAgICBjb25zdCBjZElkID0gY2RNYXRjaCA/IGNkTWF0Y2hbMV0gOiB1bmRlZmluZWQ7XG4gICAgICBsZXQgdGFnOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgY2xhc3Nlczogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGNvbW1lbnQuc2VsZWN0b3IpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgICAgaWYgKGVsKSB7XG4gICAgICAgICAgdGFnID0gZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgIGNsYXNzZXMgPSAoZWwuZ2V0QXR0cmlidXRlKCdjbGFzcycpID8/ICcnKVxuICAgICAgICAgICAgLnNwbGl0KC9cXHMrLylcbiAgICAgICAgICAgIC5maWx0ZXIoKGNscykgPT4gY2xzICYmICFjbHMuc3RhcnRzV2l0aCgnZGduLScpICYmICFjbHMuc3RhcnRzV2l0aCgnZGMtY3YtJykpXG4gICAgICAgICAgICAuam9pbignICcpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyogdW5yZXNvbHZhYmxlIHNlbGVjdG9yIOKAlCBmYWxsIHRocm91Z2ggd2l0aCBubyBmcmVzaCBtZXRhZGF0YSAqL1xuICAgICAgfVxuICAgICAgc2VsU2V0LnJlcGxhY2Uoe1xuICAgICAgICBmaWxlOiBmaWxlID8/IHVuZGVmaW5lZCxcbiAgICAgICAgaWQ6IGNkSWQsXG4gICAgICAgIHNlbGVjdG9yOiBjb21tZW50LnNlbGVjdG9yLFxuICAgICAgICB0YWcsXG4gICAgICAgIGNsYXNzZXMsXG4gICAgICAgIGJvdW5kczogY29tbWVudC5ib3VuZHMgPz8gdW5kZWZpbmVkLFxuICAgICAgfSk7XG4gICAgfSxcbiAgICBbc2VsU2V0LCBmaWxlXVxuICApO1xuXG4gIC8vIEtlZXAgdGhlIGxhdGVzdCBjb21tZW50cyBsaXN0IHJlYWNoYWJsZSBmcm9tIHRoZSBtZXNzYWdlIGhhbmRsZXIgd2l0aG91dFxuICAvLyByZS1hdHRhY2hpbmcgdGhlIGxpc3RlbmVyIG9uIGV2ZXJ5IGNvbW1lbnRzIG11dGF0aW9uLlxuICBjb25zdCBjb21tZW50c1JlZiA9IHVzZVJlZjxPdmVybGF5Q29tbWVudFtdPihjb21tZW50cyk7XG4gIGNvbW1lbnRzUmVmLmN1cnJlbnQgPSBjb21tZW50cztcblxuICAvLyBQaGFzZSA4IFRhc2sgMyDigJQgd2hlbiBhIGNvbGxhYiByb29tIGlzIGNvbm5lY3RlZCwgdGhlIFkuQXJyYXkgb2YgY29tbWVudHNcbiAgLy8gaXMgdGhlIGxpdmUgc291cmNlIG9mIHRydXRoLiBvYnNlcnZlKCkgZmlyZXMgb24gZXZlcnkgcmVtb3RlIG11dGF0aW9uXG4gIC8vIChhZGRlZCBwaW5zIGZyb20gYW5vdGhlciB0YWIsIHJlc29sdmVkLWZyb20taW5zcGVjdG9yIHZpYSB0aGUgcmVnaXN0cnlcbiAgLy8gYnJpZGdlLCBldGMuKSBhbmQgb24gdGhlIGxvY2FsIHNlZWQuIEJvdGggcGF0aHMgY29udmVyZ2Ugb24gdGhlIHNhbWVcbiAgLy8gSlNPTiBwcm9qZWN0aW9uIOKAlCBsYXN0LXdyaXRlLXdpbnMgYmV0d2VlbiBZLkFycmF5IGFuZCBwb3N0TWVzc2FnZSBpc1xuICAvLyBzYWZlIGJlY2F1c2UgdGhleSBjYXJyeSBpZGVudGljYWwgY29udGVudDsgdGhlIFkuQXJyYXkgcGF0aCBqdXN0XG4gIC8vIHJlYWNoZXMgdXMgZmlyc3QgKG5vIDgwMCBtcyBkZWJvdW5jZSBkZWxheSkuXG4gIGNvbnN0IGNvbGxhYiA9IHVzZUNvbGxhYigpO1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghY29sbGFiKSByZXR1cm47XG4gICAgY29uc3QgYXJyID0gY29sbGFiLmRvYy5nZXRBcnJheTxPdmVybGF5Q29tbWVudD4oJ2NvbW1lbnRzJyk7XG4gICAgY29uc3Qgc3luYyA9ICgpID0+IHtcbiAgICAgIC8vIHRvQXJyYXkoKSBzbmFwc2hvdCB0aGUgY3VycmVudCBZLkFycmF5IGludG8gYSBwbGFpbiBKUyBsaXN0LlxuICAgICAgc2V0Q29tbWVudHMoYXJyLnRvQXJyYXkoKSBhcyBPdmVybGF5Q29tbWVudFtdKTtcbiAgICB9O1xuICAgIC8vIEluaXRpYWwgZmlsbCDigJQgY292ZXJzIHRoZSBjYXNlIHdoZXJlIFkuRG9jIHdhcyBhbHJlYWR5IHNlZWRlZCBieSB0aGVcbiAgICAvLyB0aW1lIHRoaXMgb3ZlcmxheSBtb3VudGVkLlxuICAgIGlmIChhcnIubGVuZ3RoID4gMCkgc3luYygpO1xuICAgIGFyci5vYnNlcnZlKHN5bmMpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBhcnIudW5vYnNlcnZlKHN5bmMpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIGRvYyBkZXN0cm95ZWQgYmVmb3JlIHVubW91bnQg4oCUIG9ic2VydmVyIGFscmVhZHkgZ29uZSAqL1xuICAgICAgfVxuICAgIH07XG4gIH0sIFtjb2xsYWJdKTtcblxuICAvLyBMaXN0ZW4gZm9yIHRoZSBzaGVsbCdzIGJyb2FkY2FzdCBjaGFubmVscy4gU2NoZW1hIG1hdGNoZXMgdGhlIGxlZ2FjeVxuICAvLyBvdmVybGF5IHNvIHRoZSBzaGVsbC1zaWRlIGdsdWUgaW4gY2xpZW50L2FwcC5qc3ggKH5saW5lIDE2NzIpIGtlZXBzXG4gIC8vIHdvcmtpbmcgd2l0aG91dCBtb2RpZmljYXRpb24uXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgY29uc3Qgb25NZXNzYWdlID0gKGU6IE1lc3NhZ2VFdmVudCkgPT4ge1xuICAgICAgY29uc3QgbSA9IGUuZGF0YSBhcyB7IGRnbj86IHN0cmluZzsgY29tbWVudHM/OiB1bmtub3duOyBpZD86IHN0cmluZyB9IHwgbnVsbDtcbiAgICAgIGlmICghbSB8fCB0eXBlb2YgbSAhPT0gJ29iamVjdCcgfHwgIW0uZGduKSByZXR1cm47XG4gICAgICBpZiAobS5kZ24gPT09ICdjb21tZW50cy1zZXQnICYmIEFycmF5LmlzQXJyYXkobS5jb21tZW50cykpIHtcbiAgICAgICAgc2V0Q29tbWVudHMobS5jb21tZW50cyBhcyBPdmVybGF5Q29tbWVudFtdKTtcbiAgICAgIH0gZWxzZSBpZiAobS5kZ24gPT09ICdjb21tZW50LWZvY3VzJykge1xuICAgICAgICBjb25zdCBpZCA9IHR5cGVvZiBtLmlkID09PSAnc3RyaW5nJyA/IG0uaWQgOiBudWxsO1xuICAgICAgICBzZXRGb2N1c2VkSWQoaWQpO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBpZCA/IGNvbW1lbnRzUmVmLmN1cnJlbnQuZmluZCgoYykgPT4gYy5pZCA9PT0gaWQpIDogdW5kZWZpbmVkO1xuICAgICAgICBtaXJyb3JTZWxlY3Rpb24odGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25NZXNzYWdlKTtcbiAgICByZXR1cm4gKCkgPT4gd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbk1lc3NhZ2UpO1xuICB9LCBbbWlycm9yU2VsZWN0aW9uXSk7XG5cbiAgLy8gY2FudmFzLXNoZWxsJ3MgYG9uRHJvcENvbW1lbnRgIGRpc3BhdGNoZXMgYGNtOm9wZW4tY29tcG9zZXJgIG9uIHRoZSBpZnJhbWVcbiAgLy8gZG9jdW1lbnQuIE9wZW4gdGhlIGNvbXBvc2VyIHBpbm5lZCB0byB0aGF0IGNsaWNrIHBvaW50LlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgY29uc3Qgb25PcGVuID0gKGU6IEV2ZW50KSA9PiB7XG4gICAgICBjb25zdCBkZXRhaWwgPSAoXG4gICAgICAgIGUgYXMgQ3VzdG9tRXZlbnQ8eyBzZWxlY3Rpb24/OiBDb21wb3NlU2VsZWN0aW9uOyBjbGllbnRYPzogbnVtYmVyOyBjbGllbnRZPzogbnVtYmVyIH0+XG4gICAgICApLmRldGFpbDtcbiAgICAgIGlmICghZGV0YWlsPy5zZWxlY3Rpb24pIHJldHVybjtcbiAgICAgIHNldENvbXBvc2VyKHtcbiAgICAgICAgc2VsZWN0aW9uOiBkZXRhaWwuc2VsZWN0aW9uLFxuICAgICAgICBjbGllbnRYOiB0eXBlb2YgZGV0YWlsLmNsaWVudFggPT09ICdudW1iZXInID8gZGV0YWlsLmNsaWVudFggOiAwLFxuICAgICAgICBjbGllbnRZOiB0eXBlb2YgZGV0YWlsLmNsaWVudFkgPT09ICdudW1iZXInID8gZGV0YWlsLmNsaWVudFkgOiAwLFxuICAgICAgfSk7XG4gICAgfTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbTpvcGVuLWNvbXBvc2VyJywgb25PcGVuKTtcbiAgICByZXR1cm4gKCkgPT4gZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY206b3Blbi1jb21wb3NlcicsIG9uT3Blbik7XG4gIH0sIFtdKTtcblxuICBjb25zdCBjbG9zZUNvbXBvc2VyID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldENvbXBvc2VyKG51bGwpO1xuICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICAgIHRyeSB7XG4gICAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHsgZGduOiAnZm9yY2UtY2xlYXInIH0sICcqJyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiBwYXJlbnQgZGV0YWNoZWQgKi9cbiAgICB9XG4gIH0sIFtdKTtcblxuICBjb25zdCBzdWJtaXRDb21wb3NlciA9IHVzZUNhbGxiYWNrKFxuICAgICh0ZXh0OiBzdHJpbmcpID0+IHtcbiAgICAgIGlmICghY29tcG9zZXIpIHJldHVybjtcbiAgICAgIGNvbnN0IHNlbCA9IGNvbXBvc2VyLnNlbGVjdGlvbjtcbiAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgIGZpbGU6IHNlbC5maWxlLFxuICAgICAgICBzZWxlY3Rvcjogc2VsLnNlbGVjdG9yLFxuICAgICAgICBpbmRleDogc2VsLmluZGV4LFxuICAgICAgICBkb21fcGF0aDogc2VsLmRvbV9wYXRoLFxuICAgICAgICB0YWc6IHNlbC50YWcsXG4gICAgICAgIGNsYXNzZXM6IHNlbC5jbGFzc2VzLFxuICAgICAgICBib3VuZHM6IHNlbC5ib3VuZHMsXG4gICAgICAgIGh0bWxfZXhjZXJwdDogc2VsLmh0bWwsXG4gICAgICAgIHRleHQsXG4gICAgICB9O1xuICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgICAvLyBTaGVsbCByZWxheXMgaW50byB0aGUgV1MgYGNvbW1lbnRzLWFkZGAgY2hhbm5lbCBhbmQgcGVyc2lzdHMuXG4gICAgICB0cnkge1xuICAgICAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHsgZGduOiAnY29tbWVudC1zdWJtaXQnLCBwYXlsb2FkIH0sICcqJyk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyogcGFyZW50IGRldGFjaGVkICovXG4gICAgICB9XG4gICAgICBjbG9zZUNvbXBvc2VyKCk7XG4gICAgfSxcbiAgICBbY29tcG9zZXIsIGNsb3NlQ29tcG9zZXJdXG4gICk7XG5cbiAgLy8gU2VsZi1oZWFsIGZldGNoIOKAlCBjb3ZlcnMgdGhlIHJhY2Ugd2hlcmUgdGhlIGlmcmFtZSBsb2FkcyBiZWZvcmUgdGhlIHNoZWxsXG4gIC8vIHB1c2hlcyBgY29tbWVudHMtc2V0YCAoZS5nLiBmaXJzdCBoeWRyYXRpb24gb24gY29sZCBvcGVuKS5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWZpbGUpIHJldHVybjtcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHIgPSBhd2FpdCBmZXRjaChgL19jb21tZW50cz9maWxlPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGZpbGUpfWApO1xuICAgICAgICBpZiAoIXIub2spIHJldHVybjtcbiAgICAgICAgY29uc3QgZGF0YSA9IChhd2FpdCByLmpzb24oKSkgYXMgeyBjb21tZW50cz86IE92ZXJsYXlDb21tZW50W10gfTtcbiAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhLmNvbW1lbnRzKSkge1xuICAgICAgICAgIC8vIE9ubHkgc2V0IHdoZW4gd2UgaGF2ZW4ndCByZWNlaXZlZCBhIHNoZWxsIGJyb2FkY2FzdCB5ZXQ7IHRoZVxuICAgICAgICAgIC8vIHNoZWxsIGlzIGF1dGhvcml0YXRpdmUgb25jZSBpdCBraWNrcyBpbi5cbiAgICAgICAgICBzZXRDb21tZW50cygocHJldikgPT4gKHByZXYubGVuZ3RoID09PSAwID8gKGRhdGEuY29tbWVudHMgPz8gW10pIDogcHJldikpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyogb2ZmbGluZSAvIGRldi1zZXJ2ZXIgcmVzdGFydCDigJQgc2lsZW50bHkgbm8tb3AgKi9cbiAgICAgIH1cbiAgICB9KSgpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjYW5jZWxsZWQgPSB0cnVlO1xuICAgIH07XG4gIH0sIFtmaWxlXSk7XG5cbiAgLy8gU29ydGVkIGJ5IGBjcmVhdGVkYCBhc2Mgc28gc2VxdWVuY2UgbnVtYmVycyBhcmUgc3RhYmxlIHBlciBjYW52YXMgYWNyb3NzXG4gIC8vIHJlbG9hZHMuIFJlc29sdmVkIGNvbW1lbnRzIGFyZSBoaWRkZW4gYnkgZGVmYXVsdCAoVGFzayAyIHNwZWMpLlxuICBjb25zdCB2aXNpYmxlID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgbGlzdCA9IGNvbW1lbnRzLnNsaWNlKCkuc29ydCgoYSwgYikgPT4gYS5jcmVhdGVkLmxvY2FsZUNvbXBhcmUoYi5jcmVhdGVkKSk7XG4gICAgcmV0dXJuIGxpc3QuZmlsdGVyKChjKSA9PiBjLnN0YXR1cyAhPT0gJ3Jlc29sdmVkJyk7XG4gIH0sIFtjb21tZW50c10pO1xuXG4gIC8vIFNlcXVlbmNlIGluZGV4IGxvb2t1cCDigJQgYnVpbHQgb2ZmIHRoZSBGVUxMIHNvcnRlZCBsaXN0IHNvIGEgcmVzb2x2ZWQtdGhlbi1cbiAgLy8gcmVvcGVuZWQgcGluIGtlZXBzIGl0cyBvcmlnaW5hbCBudW1iZXIuXG4gIGNvbnN0IGluZGV4QnlJZCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IG0gPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgIGNvbnN0IGFsbCA9IGNvbW1lbnRzLnNsaWNlKCkuc29ydCgoYSwgYikgPT4gYS5jcmVhdGVkLmxvY2FsZUNvbXBhcmUoYi5jcmVhdGVkKSk7XG4gICAgYWxsLmZvckVhY2goKGMsIGkpID0+IHtcbiAgICAgIG0uc2V0KGMuaWQsIGkgKyAxKTtcbiAgICB9KTtcbiAgICByZXR1cm4gbTtcbiAgfSwgW2NvbW1lbnRzXSk7XG5cbiAgY29uc3QgaGFuZGxlUGluQ2xpY2sgPSB1c2VDYWxsYmFjayhcbiAgICAoaWQ6IHN0cmluZykgPT4ge1xuICAgICAgc2V0Rm9jdXNlZElkKGlkKTtcbiAgICAgIG1pcnJvclNlbGVjdGlvbihjb21tZW50cy5maW5kKChjKSA9PiBjLmlkID09PSBpZCkpO1xuICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgICB0cnkge1xuICAgICAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHsgZGduOiAnY29tbWVudC1jbGljaycsIGlkIH0sICcqJyk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyogcGFyZW50IGRldGFjaGVkICovXG4gICAgICB9XG4gICAgfSxcbiAgICBbY29tbWVudHMsIG1pcnJvclNlbGVjdGlvbl1cbiAgKTtcblxuICBjb25zdCBoYW5kbGVQYXRjaCA9IHVzZUNhbGxiYWNrKChpZDogc3RyaW5nLCBwYXRjaDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7IGRnbjogJ2NvbW1lbnQtcGF0Y2gnLCBpZCwgcGF0Y2ggfSwgJyonKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIHBhcmVudCBkZXRhY2hlZCAqL1xuICAgIH1cbiAgfSwgW10pO1xuXG4gIGNvbnN0IGhhbmRsZURlbGV0ZSA9IHVzZUNhbGxiYWNrKChpZDogc3RyaW5nKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyBkZ246ICdjb21tZW50LWRlbGV0ZScsIGlkIH0sICcqJyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiBwYXJlbnQgZGV0YWNoZWQgKi9cbiAgICB9XG4gICAgc2V0Rm9jdXNlZElkKChwcmV2KSA9PiAocHJldiA9PT0gaWQgPyBudWxsIDogcHJldikpO1xuICB9LCBbXSk7XG5cbiAgY29uc3QgaGFuZGxlUmVwbHkgPSB1c2VDYWxsYmFjayhhc3luYyAoaWQ6IHN0cmluZywgYm9keTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gICAgaWYgKHR5cGVvZiBmZXRjaCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgciA9IGF3YWl0IGZldGNoKGAvX2FwaS9jb21tZW50cy8ke2VuY29kZVVSSUNvbXBvbmVudChpZCl9L3JlcGx5YCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgYm9keSB9KSxcbiAgICAgIH0pO1xuICAgICAgaWYgKCFyLm9rKSByZXR1cm4gZmFsc2U7XG4gICAgICBjb25zdCB1cGRhdGVkID0gKGF3YWl0IHIuanNvbigpKSBhcyBPdmVybGF5Q29tbWVudDtcbiAgICAgIC8vIE9wdGltaXN0aWMgbG9jYWwgbWVyZ2Ug4oCUIHRoZSBzaGVsbCB3aWxsIGJyb2FkY2FzdCBgY29tbWVudHMtc2V0YFxuICAgICAgLy8gc2hvcnRseSBhZnRlciBhcyB0aGUgV1MgZmFucyBvdXQgdGhlIGNoYW5nZSwgYnV0IGFwcGx5aW5nIGl0IG5vd1xuICAgICAgLy8gYXZvaWRzIHRoZSBwb3BvdmVyIGZsaWNrZXJpbmcgZW1wdHkgYmV0d2VlbiBzdWJtaXQgKyBicm9hZGNhc3QuXG4gICAgICBzZXRDb21tZW50cygocHJldikgPT4gcHJldi5tYXAoKGMpID0+IChjLmlkID09PSB1cGRhdGVkLmlkID8gdXBkYXRlZCA6IGMpKSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0sIFtdKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tbGF5ZXJcIiBhcmlhLWhpZGRlbj17ZmFsc2V9PlxuICAgICAge3Zpc2libGUubWFwKChjKSA9PiB7XG4gICAgICAgIGNvbnN0IG4gPSBpbmRleEJ5SWQuZ2V0KGMuaWQpID8/IDA7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPENvbW1lbnRQaW5cbiAgICAgICAgICAgIGtleT17Yy5pZH1cbiAgICAgICAgICAgIGNvbW1lbnQ9e2N9XG4gICAgICAgICAgICBzZXF1ZW5jZT17bn1cbiAgICAgICAgICAgIGZvY3VzZWQ9e2ZvY3VzZWRJZCA9PT0gYy5pZH1cbiAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZVBpbkNsaWNrfVxuICAgICAgICAgICAgb25PcnBoYW5lZD17aGFuZGxlRGVsZXRlfVxuICAgICAgICAgIC8+XG4gICAgICAgICk7XG4gICAgICB9KX1cbiAgICAgIHtjb21wb3NlciA/IChcbiAgICAgICAgPENvbW1lbnRDb21wb3NlciBzdGF0ZT17Y29tcG9zZXJ9IG9uU3VibWl0PXtzdWJtaXRDb21wb3Nlcn0gb25DYW5jZWw9e2Nsb3NlQ29tcG9zZXJ9IC8+XG4gICAgICApIDogbnVsbH1cbiAgICAgIHsoKCkgPT4ge1xuICAgICAgICBpZiAoIWZvY3VzZWRJZCkgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IGZvY3VzZWQgPSB2aXNpYmxlLmZpbmQoKGMpID0+IGMuaWQgPT09IGZvY3VzZWRJZCk7XG4gICAgICAgIGlmICghZm9jdXNlZCkgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPENvbW1lbnRUaHJlYWRcbiAgICAgICAgICAgIGNvbW1lbnQ9e2ZvY3VzZWR9XG4gICAgICAgICAgICBzZXF1ZW5jZT17aW5kZXhCeUlkLmdldChmb2N1c2VkLmlkKSA/PyAwfVxuICAgICAgICAgICAgb25DbG9zZT17KCkgPT4ge1xuICAgICAgICAgICAgICBzZXRGb2N1c2VkSWQobnVsbCk7XG4gICAgICAgICAgICAgIC8vIERyb3AgdGhlIGNhbnZhcyBoYWxvIHdoZW4gdGhlIHRocmVhZCBjbG9zZXMg4oCUIHN5bW1ldHJpYyB3aXRoXG4gICAgICAgICAgICAgIC8vIGBoYW5kbGVQaW5DbGlja2Agd2hpY2ggcGFpbnRzIGl0IG9uIG9wZW4uXG4gICAgICAgICAgICAgIHNlbFNldD8uY2xlYXIoKTtcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgICBvblBhdGNoPXsocGF0Y2gpID0+IGhhbmRsZVBhdGNoKGZvY3VzZWQuaWQsIHBhdGNoKX1cbiAgICAgICAgICAgIG9uRGVsZXRlPXsoKSA9PiBoYW5kbGVEZWxldGUoZm9jdXNlZC5pZCl9XG4gICAgICAgICAgICBvblJlcGx5PXsoYm9keSkgPT4gaGFuZGxlUmVwbHkoZm9jdXNlZC5pZCwgYm9keSl9XG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcbiAgICAgIH0pKCl9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTWVudGlvbkF3YXJlVGV4dGFyZWEgKyBwb3B1cCDigJQgVGFzayA1XG4vL1xuLy8gV3JhcHMgYSB0ZXh0YXJlYSBhbmQgc3VyZmFjZXMgYW4gYXV0b2NvbXBsZXRlIHBvcHVwIHdoZW4gdGhlIGNhcmV0IHNpdHNcbi8vIGluc2lkZSBhbiBgQDxxdWVyeT5gIHRva2VuIChubyB3aGl0ZXNwYWNlIGJldHdlZW4gYEBgIGFuZCBjdXJzb3IpLiBUaGVcbi8vIGNvbW1pdHRlciBsaXN0IGlzIGZldGNoZWQgb25jZSBvbiBmaXJzdCBmb2N1cyBhbmQgY2FjaGVkIGZvciB0aGUgc2Vzc2lvbi5cbi8vIEtleWJvYXJkOiDihpHihpMgbW92ZSwg4oa1L1RhYiBpbnNlcnQgKGBAZmlyc3RuYW1lIGApLCBFc2MgZGlzbWlzcy5cblxuaW50ZXJmYWNlIENvbW1pdHRlclJvdyB7XG4gIG5hbWU6IHN0cmluZztcbiAgZW1haWw6IHN0cmluZztcbiAgY29tbWl0czogbnVtYmVyO1xufVxuXG5sZXQgY29tbWl0dGVyQ2FjaGU6IFByb21pc2U8Q29tbWl0dGVyUm93W10+IHwgbnVsbCA9IG51bGw7XG5hc3luYyBmdW5jdGlvbiBsb2FkQ29tbWl0dGVycygpOiBQcm9taXNlPENvbW1pdHRlclJvd1tdPiB7XG4gIGlmICghY29tbWl0dGVyQ2FjaGUpIHtcbiAgICBjb21taXR0ZXJDYWNoZSA9IChhc3luYyAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByID0gYXdhaXQgZmV0Y2goJy9fYXBpL2dpdC1jb21taXR0ZXJzJyk7XG4gICAgICAgIGlmICghci5vaykgcmV0dXJuIFtdO1xuICAgICAgICBjb25zdCBkYXRhID0gKGF3YWl0IHIuanNvbigpKSBhcyB7IGNvbW1pdHRlcnM/OiBDb21taXR0ZXJSb3dbXSB9O1xuICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShkYXRhLmNvbW1pdHRlcnMpID8gZGF0YS5jb21taXR0ZXJzIDogW107XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfVxuICAgIH0pKCk7XG4gIH1cbiAgcmV0dXJuIGNvbW1pdHRlckNhY2hlO1xufVxuXG5mdW5jdGlvbiBmaXJzdE5hbWVTbHVnKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIGBAZmlyc3RuYW1lYCBpcyB3aGF0IHdlIGluc2VydCBvbiBhY2NlcHQuIFN0cmlwIHN1cm5hbWVzICsgcHVuY3R1YXRpb24uXG4gIGNvbnN0IGZpcnN0ID0gbmFtZS50cmltKCkuc3BsaXQoL1xccysvKVswXSA/PyAnJztcbiAgLy8gS2VlcCBhbHBoYW51bSArIGAuYCBgLWAgYF9gIChtYXRjaGVzIHRoZSBwYXJzZU1lbnRpb25zIHJlZ2V4IG9uIHRoZSBzZXJ2ZXIpLlxuICByZXR1cm4gZmlyc3QucmVwbGFjZSgvW15cXHcuLV0vZywgJycpLnRvTG93ZXJDYXNlKCk7XG59XG5cbmludGVyZmFjZSBNZW50aW9uVG9rZW4ge1xuICBzdGFydDogbnVtYmVyOyAvLyBpbmRleCBvZiBgQGBcbiAgZW5kOiBudW1iZXI7IC8vIGV4Y2x1c2l2ZSDigJQgY3VycmVudCBjYXJldFxuICBxdWVyeTogc3RyaW5nOyAvLyBjaGFycyBiZXR3ZWVuIGBAYCBhbmQgY2FyZXQgKGV4Y2x1ZGluZyBgQGApXG59XG5cbmZ1bmN0aW9uIGRldGVjdE1lbnRpb25Ub2tlbih0ZXh0OiBzdHJpbmcsIGNhcmV0OiBudW1iZXIpOiBNZW50aW9uVG9rZW4gfCBudWxsIHtcbiAgaWYgKGNhcmV0IDw9IDAgfHwgY2FyZXQgPiB0ZXh0Lmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gIC8vIFdhbGsgYmFja3dhcmRzIGZyb20gY2FyZXQ7IHRoZSB0b2tlbiBzdGFydHMgYXQgYEBgIGFuZCBlbmRzIGF0IHRoZSBjYXJldC5cbiAgLy8gQWJvcnRzIG9uIHdoaXRlc3BhY2UsIG5ld2xpbmUsIG9yIGFueSBub24tbWVudGlvbiBjaGFyIHNvIGEgc3RyYXkgYEBgIGluXG4gIC8vIGFuIGVtYWlsIGlzIGlnbm9yZWQuXG4gIGxldCBpID0gY2FyZXQgLSAxO1xuICB3aGlsZSAoaSA+PSAwKSB7XG4gICAgY29uc3QgY2ggPSB0ZXh0W2ldID8/ICcnO1xuICAgIGlmIChjaCA9PT0gJ0AnKSB7XG4gICAgICAvLyBUb2tlbiBtdXN0IGJlIHdvcmQtbGVhZGluZzogcHJldmlvdXMgY2hhciBpcyBzdGFydC1vZi1zdHJpbmcgb3Igd2hpdGVzcGFjZS5cbiAgICAgIGNvbnN0IHByZXYgPSBpID4gMCA/IHRleHRbaSAtIDFdIDogJyc7XG4gICAgICBpZiAoaSA9PT0gMCB8fCAvXFxzLy50ZXN0KHByZXYgPz8gJycpKSB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gdGV4dC5zbGljZShpICsgMSwgY2FyZXQpO1xuICAgICAgICByZXR1cm4geyBzdGFydDogaSwgZW5kOiBjYXJldCwgcXVlcnkgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAoIS9bXFx3Li1dLy50ZXN0KGNoKSkgcmV0dXJuIG51bGw7XG4gICAgaSAtPSAxO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBNZW50aW9uQXdhcmVUZXh0YXJlYSh7XG4gIGNsYXNzTmFtZSxcbiAgdmFsdWUsXG4gIG9uQ2hhbmdlLFxuICBvbktleURvd24sXG4gIHBsYWNlaG9sZGVyLFxuICByb3dzLFxuICBkaXNhYmxlZCxcbiAgdGV4dGFyZWFSZWYsXG4gIGFyaWFMYWJlbCxcbn06IHtcbiAgY2xhc3NOYW1lOiBzdHJpbmc7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIG9uQ2hhbmdlOiAobmV4dDogc3RyaW5nKSA9PiB2b2lkO1xuICBvbktleURvd24/OiAoZTogUmVhY3QuS2V5Ym9hcmRFdmVudDxIVE1MVGV4dEFyZWFFbGVtZW50PikgPT4gdm9pZDtcbiAgcGxhY2Vob2xkZXI/OiBzdHJpbmc7XG4gIHJvd3M/OiBudW1iZXI7XG4gIGRpc2FibGVkPzogYm9vbGVhbjtcbiAgdGV4dGFyZWFSZWY/OiBSZWFjdC5NdXRhYmxlUmVmT2JqZWN0PEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsPjtcbiAgYXJpYUxhYmVsPzogc3RyaW5nO1xufSk6IFJlYWN0LlJlYWN0RWxlbWVudCB7XG4gIGNvbnN0IGludGVybmFsUmVmID0gdXNlUmVmPEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3Qgc2V0UmVmID0gdXNlQ2FsbGJhY2soXG4gICAgKGVsOiBIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbCkgPT4ge1xuICAgICAgaW50ZXJuYWxSZWYuY3VycmVudCA9IGVsO1xuICAgICAgaWYgKHRleHRhcmVhUmVmKSB0ZXh0YXJlYVJlZi5jdXJyZW50ID0gZWw7XG4gICAgfSxcbiAgICBbdGV4dGFyZWFSZWZdXG4gICk7XG5cbiAgY29uc3QgW2NvbW1pdHRlcnMsIHNldENvbW1pdHRlcnNdID0gdXNlU3RhdGU8Q29tbWl0dGVyUm93W10+KFtdKTtcbiAgY29uc3QgW3Rva2VuLCBzZXRUb2tlbl0gPSB1c2VTdGF0ZTxNZW50aW9uVG9rZW4gfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2hpZ2hsaWdodCwgc2V0SGlnaGxpZ2h0XSA9IHVzZVN0YXRlKDApO1xuXG4gIC8vIExhenktbG9hZCBjb21taXR0ZXJzIG9uIGZpcnN0IGZvY3VzLlxuICBjb25zdCBvbkZvY3VzID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChjb21taXR0ZXJzLmxlbmd0aCA+IDApIHJldHVybjtcbiAgICB2b2lkIGxvYWRDb21taXR0ZXJzKCkudGhlbigobGlzdCkgPT4gc2V0Q29tbWl0dGVycyhsaXN0KSk7XG4gIH0sIFtjb21taXR0ZXJzLmxlbmd0aF0pO1xuXG4gIGNvbnN0IGZpbHRlcmVkID0gdXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCF0b2tlbikgcmV0dXJuIFtdIGFzIENvbW1pdHRlclJvd1tdO1xuICAgIGNvbnN0IHEgPSB0b2tlbi5xdWVyeS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGxpc3QgPSAhcVxuICAgICAgPyBjb21taXR0ZXJzXG4gICAgICA6IGNvbW1pdHRlcnMuZmlsdGVyKFxuICAgICAgICAgIChjKSA9PiBjLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fCBjLmVtYWlsLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcbiAgICAgICAgKTtcbiAgICByZXR1cm4gbGlzdC5zbGljZSgwLCA4KTtcbiAgfSwgW3Rva2VuLCBjb21taXR0ZXJzXSk7XG5cbiAgY29uc3QgcmVmcmVzaFRva2VuID0gdXNlQ2FsbGJhY2soKHRleHRhcmVhOiBIVE1MVGV4dEFyZWFFbGVtZW50KSA9PiB7XG4gICAgY29uc3QgY2FyZXQgPSB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA/PyB0ZXh0YXJlYS52YWx1ZS5sZW5ndGg7XG4gICAgY29uc3QgdCA9IGRldGVjdE1lbnRpb25Ub2tlbih0ZXh0YXJlYS52YWx1ZSwgY2FyZXQpO1xuICAgIHNldFRva2VuKHQpO1xuICAgIHNldEhpZ2hsaWdodCgwKTtcbiAgfSwgW10pO1xuXG4gIGNvbnN0IGhhbmRsZUNoYW5nZSA9IHVzZUNhbGxiYWNrKFxuICAgIChlOiBSZWFjdC5DaGFuZ2VFdmVudDxIVE1MVGV4dEFyZWFFbGVtZW50PikgPT4ge1xuICAgICAgb25DaGFuZ2UoZS50YXJnZXQudmFsdWUpO1xuICAgICAgcmVmcmVzaFRva2VuKGUudGFyZ2V0KTtcbiAgICB9LFxuICAgIFtvbkNoYW5nZSwgcmVmcmVzaFRva2VuXVxuICApO1xuXG4gIGNvbnN0IGluc2VydE1lbnRpb24gPSB1c2VDYWxsYmFjayhcbiAgICAoY29tbWl0dGVyOiBDb21taXR0ZXJSb3cpID0+IHtcbiAgICAgIGlmICghdG9rZW4pIHJldHVybjtcbiAgICAgIGNvbnN0IHRhID0gaW50ZXJuYWxSZWYuY3VycmVudDtcbiAgICAgIGlmICghdGEpIHJldHVybjtcbiAgICAgIGNvbnN0IHRhZyA9IGBAJHtmaXJzdE5hbWVTbHVnKGNvbW1pdHRlci5uYW1lKX1gO1xuICAgICAgY29uc3QgbmV4dCA9IGAke3ZhbHVlLnNsaWNlKDAsIHRva2VuLnN0YXJ0KX0ke3RhZ30gJHt2YWx1ZS5zbGljZSh0b2tlbi5lbmQpfWA7XG4gICAgICBvbkNoYW5nZShuZXh0KTtcbiAgICAgIHNldFRva2VuKG51bGwpO1xuICAgICAgLy8gUmVzdG9yZSBjYXJldCBqdXN0IHBhc3QgdGhlIGluc2VydGVkIHRva2VuICsgdHJhaWxpbmcgc3BhY2UuXG4gICAgICBjb25zdCBuZXdDYXJldCA9IHRva2VuLnN0YXJ0ICsgdGFnLmxlbmd0aCArIDE7XG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0YS5mb2N1cygpO1xuICAgICAgICB0YS5zZXRTZWxlY3Rpb25SYW5nZShuZXdDYXJldCwgbmV3Q2FyZXQpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBbdG9rZW4sIHZhbHVlLCBvbkNoYW5nZV1cbiAgKTtcblxuICBjb25zdCBoYW5kbGVLZXlEb3duID0gdXNlQ2FsbGJhY2soXG4gICAgKGU6IFJlYWN0LktleWJvYXJkRXZlbnQ8SFRNTFRleHRBcmVhRWxlbWVudD4pID0+IHtcbiAgICAgIGlmICh0b2tlbiAmJiBmaWx0ZXJlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGlmIChlLmtleSA9PT0gJ0Fycm93RG93bicpIHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgc2V0SGlnaGxpZ2h0KChoKSA9PiAoaCArIDEpICUgZmlsdGVyZWQubGVuZ3RoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09PSAnQXJyb3dVcCcpIHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgc2V0SGlnaGxpZ2h0KChoKSA9PiAoaCAtIDEgKyBmaWx0ZXJlZC5sZW5ndGgpICUgZmlsdGVyZWQubGVuZ3RoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnVGFiJykge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBjb25zdCBwaWNrID0gZmlsdGVyZWRbaGlnaGxpZ2h0XSA/PyBmaWx0ZXJlZFswXTtcbiAgICAgICAgICBpZiAocGljaykgaW5zZXJ0TWVudGlvbihwaWNrKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBzZXRUb2tlbihudWxsKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG9uS2V5RG93bj8uKGUpO1xuICAgIH0sXG4gICAgW3Rva2VuLCBmaWx0ZXJlZCwgaGlnaGxpZ2h0LCBpbnNlcnRNZW50aW9uLCBvbktleURvd25dXG4gICk7XG5cbiAgY29uc3QgaGFuZGxlU2VsZWN0ID0gdXNlQ2FsbGJhY2soXG4gICAgKGU6IFJlYWN0LlN5bnRoZXRpY0V2ZW50PEhUTUxUZXh0QXJlYUVsZW1lbnQ+KSA9PiB7XG4gICAgICByZWZyZXNoVG9rZW4oZS5jdXJyZW50VGFyZ2V0KTtcbiAgICB9LFxuICAgIFtyZWZyZXNoVG9rZW5dXG4gICk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IHN0eWxlPXt7IHBvc2l0aW9uOiAncmVsYXRpdmUnIH19PlxuICAgICAgPHRleHRhcmVhXG4gICAgICAgIHJlZj17c2V0UmVmfVxuICAgICAgICBjbGFzc05hbWU9e2NsYXNzTmFtZX1cbiAgICAgICAgdmFsdWU9e3ZhbHVlfVxuICAgICAgICBwbGFjZWhvbGRlcj17cGxhY2Vob2xkZXJ9XG4gICAgICAgIHJvd3M9e3Jvd3N9XG4gICAgICAgIGRpc2FibGVkPXtkaXNhYmxlZH1cbiAgICAgICAgYXJpYS1sYWJlbD17YXJpYUxhYmVsfVxuICAgICAgICBvbkNoYW5nZT17aGFuZGxlQ2hhbmdlfVxuICAgICAgICBvbktleURvd249e2hhbmRsZUtleURvd259XG4gICAgICAgIG9uRm9jdXM9e29uRm9jdXN9XG4gICAgICAgIG9uU2VsZWN0PXtoYW5kbGVTZWxlY3R9XG4gICAgICAgIG9uQ2xpY2s9e2hhbmRsZVNlbGVjdH1cbiAgICAgIC8+XG4gICAgICB7LyogQ29tYm9ib3ggcGF0dGVybiDigJQgYHJvbGU9XCJsaXN0Ym94XCJgICsgYHJvbGU9XCJvcHRpb25cImAgaXMgdGhlIGNhbm9uaWNhbFxuICAgICAgICogQVJJQSBzaGFwZSBmb3IgYSBzaW5nbGUtc2VsZWN0IGF1dG9jb21wbGV0ZS4gS2V5Ym9hcmQgbmF2aWdhdGlvblxuICAgICAgICogKOKGkSDihpMgRW50ZXIgRXNjKSBsaXZlcyBvbiB0aGUgcGFyZW50IHRleHRhcmVhIHBlciB0aGUgY29tYm9ib3ggc3BlYyxcbiAgICAgICAqIHNvIHRoZSBwb3B1cCBpdHNlbGYgc3RheXMgaW5lcnQuIFNhbWUgcGF0dGVybiBhcHBsaWVzIHRvIHRoZSBjb21wb3NlclxuICAgICAgICogKyB0aHJlYWQgcG9wb3ZlcnMgYmVsb3cgKGByb2xlPVwiZGlhbG9nXCJgIG9uIGEgcG9zaXRpb25lZCA8ZGl2PikuXG4gICAgICAgKiBCaW9tZSdzIGExMXkgcnVsZXMgd2FudCBzZW1hbnRpYyBIVE1MIHByaW1pdGl2ZXMsIGJ1dCBub25lIG1hdGNoXG4gICAgICAgKiBcIm5vbi1mb2N1c2FibGUgbGlzdGJveCB1bmRlciBhIHRleHRhcmVhXCIgb3IgXCJhbmNob3JlZCBub24tbW9kYWwgcG9wb3ZlclwiLlxuICAgICAgICogVGhlIGZvdXIgYWZmZWN0ZWQgcnVsZXMgYXJlIHNjb3BlZCBvZmYgZm9yIHRoaXMgZmlsZSBpbiBiaW9tZS5qc29uLiAqL31cbiAgICAgIHt0b2tlbiAmJiBmaWx0ZXJlZC5sZW5ndGggPiAwID8gKFxuICAgICAgICA8dWxcbiAgICAgICAgICBjbGFzc05hbWU9XCJjbS1tZW50aW9uLXBvcHVwXCJcbiAgICAgICAgICByb2xlPVwibGlzdGJveFwiXG4gICAgICAgICAgYXJpYS1sYWJlbD1cIk1lbnRpb24gc3VnZ2VzdGlvbnNcIlxuICAgICAgICAgIHN0eWxlPXt7IGxlZnQ6IDAsIHRvcDogJzEwMCUnIH19XG4gICAgICAgID5cbiAgICAgICAgICB7ZmlsdGVyZWQubWFwKChjLCBpKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZCA9IGkgPT09IGhpZ2hsaWdodDtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxsaVxuICAgICAgICAgICAgICAgIGtleT17YCR7Yy5uYW1lfS0ke2MuZW1haWx9YH1cbiAgICAgICAgICAgICAgICByb2xlPVwib3B0aW9uXCJcbiAgICAgICAgICAgICAgICBhcmlhLXNlbGVjdGVkPXtzZWxlY3RlZH1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJjbS1tZW50aW9uLXBvcHVwX19pdGVtXCJcbiAgICAgICAgICAgICAgICBvbk1vdXNlRW50ZXI9eygpID0+IHNldEhpZ2hsaWdodChpKX1cbiAgICAgICAgICAgICAgICAvLyBVc2UgbW91c2Vkb3duIHNvIHRoZSB0ZXh0YXJlYSBkb2Vzbid0IGJsdXIgYmVmb3JlIHRoZVxuICAgICAgICAgICAgICAgIC8vIHNlbGVjdGlvbiByZWdpc3RlcnMuXG4gICAgICAgICAgICAgICAgb25Nb3VzZURvd249eyhldikgPT4ge1xuICAgICAgICAgICAgICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgIGluc2VydE1lbnRpb24oYyk7XG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImNtLW1lbnRpb24tcG9wdXBfX25hbWVcIj5Ae2ZpcnN0TmFtZVNsdWcoYy5uYW1lKX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiY20tbWVudGlvbi1wb3B1cF9fZW1haWxcIj57Yy5lbWFpbH08L3NwYW4+XG4gICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pfVxuICAgICAgICA8L3VsPlxuICAgICAgKSA6IG51bGx9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29tbWVudFBpbiDigJQgc2luZ2xlIDI0w5cyNCBiYWRnZSBhbmNob3JlZCB0byB0b3AtcmlnaHQgb2YgaXRzIHRhcmdldCBlbGVtZW50LlxuLy8gUmVzb2x2ZXMgdGFyZ2V0IG9uIGV2ZXJ5IGFuaW1hdGlvbiBmcmFtZSB0byB0cmFjayBsYXlvdXQgc2hpZnRzIChkcmFnLFxuLy8gcmVmbG93LCBmb250IGxvYWQpLiBGYWxscyBiYWNrIHRvIHRoZSBzdG9yZWQgYGJvdW5kc2Agd2hlbiB0aGUgdGFyZ2V0IGlzXG4vLyBnb25lIGZyb20gdGhlIERPTS5cblxuLy8gSG93IGxvbmcgYSBwaW4gaXMgYWxsb3dlZCB0byBzdGF5IHVucmVzb2x2YWJsZSAobm8gbGl2ZSB0YXJnZXQgQU5EIG5vXG4vLyBzdHJ1Y3R1cmFsLWZhbGxiYWNrIG1hdGNoKSBiZWZvcmUgaXRzIGNvbW1lbnQgaXMgcHJlc3VtZWQgb3JwaGFuZWQgYW5kXG4vLyBhdXRvLWRlbGV0ZWQuIExvbmcgZW5vdWdoIHRvIHJpZGUgb3V0IGEgY2FudmFzIEhNUiByZW1vdW50OyBzaG9ydCBlbm91Z2hcbi8vIHRoYXQgYSBnZW51aW5lbHkgZGVsZXRlZCBlbGVtZW50J3MgY29tbWVudCBkb2Vzbid0IGxpbmdlci5cbmNvbnN0IE9SUEhBTl9HUkFDRV9NUyA9IDMwMDA7XG5cbmZ1bmN0aW9uIENvbW1lbnRQaW4oe1xuICBjb21tZW50LFxuICBzZXF1ZW5jZSxcbiAgZm9jdXNlZCxcbiAgb25DbGljayxcbiAgb25PcnBoYW5lZCxcbn06IHtcbiAgY29tbWVudDogT3ZlcmxheUNvbW1lbnQ7XG4gIHNlcXVlbmNlOiBudW1iZXI7XG4gIGZvY3VzZWQ6IGJvb2xlYW47XG4gIG9uQ2xpY2s6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xuICBvbk9ycGhhbmVkOiAoaWQ6IHN0cmluZykgPT4gdm9pZDtcbn0pIHtcbiAgY29uc3QgcmVmID0gdXNlUmVmPEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHJhZlJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgdW5yZXNvbHZlZFNpbmNlUmVmID0gdXNlUmVmPG51bWJlciB8IG51bGw+KG51bGwpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgdGljayA9ICgpID0+IHtcbiAgICAgIHJhZlJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgIGNvbnN0IHBpbiA9IHJlZi5jdXJyZW50O1xuICAgICAgaWYgKCFwaW4pIHJldHVybjtcblxuICAgICAgLy8gTGl2ZSBzY3JlZW4tY29vcmQgbG9va3VwIG1pcnJvcnMgU2VsZWN0aW9uSGFsb3MgaW4gY2FudmFzLXNoZWxsLnRzeFxuICAgICAgLy8gKHJlc29sdmVDb21tZW50VGFyZ2V0IHRyaWVzIHRoZSBzdG9yZWQgc2VsZWN0b3IsIHRoZW4gYSBzdHJ1Y3R1cmFsXG4gICAgICAvLyBmYWxsYmFjaykuIEZhbGxzIGJhY2sgdG8gc3RvcmVkIGJvdW5kcyAoYSBzY3JlZW4tY29vcmQgY2FwdHVyZSBhdFxuICAgICAgLy8gY3JlYXRlIHRpbWUpIHdoZW4gbmVpdGhlciByZXNvbHZlcyDigJQgYmV0dGVyIHRoYW4gdmFuaXNoaW5nIGVudGlyZWx5LlxuICAgICAgbGV0IHBvcyA9IHNjcmVlblJlY3RGb3IoY29tbWVudCk7XG4gICAgICBpZiAocG9zKSB7XG4gICAgICAgIHVucmVzb2x2ZWRTaW5jZVJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh1bnJlc29sdmVkU2luY2VSZWYuY3VycmVudCA9PSBudWxsKSB7XG4gICAgICAgICAgdW5yZXNvbHZlZFNpbmNlUmVmLmN1cnJlbnQgPSBEYXRlLm5vdygpO1xuICAgICAgICB9IGVsc2UgaWYgKERhdGUubm93KCkgLSB1bnJlc29sdmVkU2luY2VSZWYuY3VycmVudCA+IE9SUEhBTl9HUkFDRV9NUykge1xuICAgICAgICAgIG9uT3JwaGFuZWQoY29tbWVudC5pZCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbW1lbnQuYm91bmRzKSB7XG4gICAgICAgICAgcG9zID0ge1xuICAgICAgICAgICAgeDogY29tbWVudC5ib3VuZHMueCxcbiAgICAgICAgICAgIHk6IGNvbW1lbnQuYm91bmRzLnksXG4gICAgICAgICAgICB3OiBjb21tZW50LmJvdW5kcy53LFxuICAgICAgICAgICAgaDogY29tbWVudC5ib3VuZHMuaCxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIXBvcykge1xuICAgICAgICBwaW4uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHBpbi5zdHlsZS5kaXNwbGF5ID0gJ2dyaWQnO1xuICAgICAgLy8gUG9zaXRpb24gdGhlIHBpbidzIGNlbnRlciBhdCAocmlnaHQgLSAxMiwgdG9wIC0gMTIpIOKAlCB0aGUgRmlnSmFtXG4gICAgICAvLyBjb252ZW50aW9uLiAxMiA9IGhhbGYgb2YgMjQgKHRoZSBwaW4ncyBvd24gc2l6ZSkuXG4gICAgICBjb25zdCBsZWZ0ID0gTWF0aC5yb3VuZChwb3MueCArIHBvcy53IC0gMTIpO1xuICAgICAgY29uc3QgdG9wID0gTWF0aC5yb3VuZChwb3MueSAtIDEyKTtcbiAgICAgIHBpbi5zdHlsZS5sZWZ0ID0gYCR7bGVmdH1weGA7XG4gICAgICBwaW4uc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcbiAgICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgIH07XG4gICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmIChyYWZSZWYuY3VycmVudCAhPSBudWxsKSBjYW5jZWxBbmltYXRpb25GcmFtZShyYWZSZWYuY3VycmVudCk7XG4gICAgfTtcbiAgfSwgW2NvbW1lbnQsIG9uT3JwaGFuZWRdKTtcblxuICBjb25zdCBhdXRob3IgPSBjb21tZW50LmF1dGhvcj8udHJpbSgpIHx8ICd1bmtub3duJztcbiAgY29uc3QgbGFiZWwgPSBgQ29tbWVudCAke3NlcXVlbmNlfSBieSAke2F1dGhvcn1gO1xuXG4gIHJldHVybiAoXG4gICAgPGJ1dHRvblxuICAgICAgcmVmPXtyZWZ9XG4gICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgIGNsYXNzTmFtZT1cImNtLXBpblwiXG4gICAgICBkYXRhLXJlc29sdmVkPXtjb21tZW50LnN0YXR1cyA9PT0gJ3Jlc29sdmVkJyA/ICd0cnVlJyA6ICdmYWxzZSd9XG4gICAgICBkYXRhLWZvY3VzZWQ9e2ZvY3VzZWQgPyAndHJ1ZScgOiAnZmFsc2UnfVxuICAgICAgZGF0YS1jb21tZW50LXBpbj17Y29tbWVudC5pZH1cbiAgICAgIGFyaWEtbGFiZWw9e2xhYmVsfVxuICAgICAgYXJpYS1leHBhbmRlZD17Zm9jdXNlZH1cbiAgICAgIHRpdGxlPXtjb21tZW50LnRleHQuc2xpY2UoMCwgMjAwKX1cbiAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgb25DbGljayhjb21tZW50LmlkKTtcbiAgICAgIH19XG4gICAgPlxuICAgICAge3NlcXVlbmNlfVxuICAgIDwvYnV0dG9uPlxuICApO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIENvbW1lbnRDb21wb3NlciDigJQgRFMtc3R5bGVkIGNhcmQgYW5jaG9yZWQganVzdCB1bmRlciB0aGUgY2xpY2tlZCBlbGVtZW50XG4vLyAob3IgYXQgdGhlIGNsaWNrIHBvaW50IGlmIHRoZSBjbGljayBoaXQgZW1wdHkgY2FudmFzKS4gRWRnZS1jbGFtcCBpcyB0aGVcbi8vIHByYWdtYXRpYyBraW5kOiBwb3NpdGlvbiBpcyBjb21wdXRlZCBvbmNlIG9uIG9wZW4gYWdhaW5zdCB0aGUgd29ybGQgbGF5b3V0LFxuLy8gbm90IGNoYXNlZCBvbiBwYW4vem9vbSDigJQgdGhlIHVzZXIgaXMgYWN0aXZlbHkgdHlwaW5nLlxuXG5mdW5jdGlvbiBDb21tZW50Q29tcG9zZXIoe1xuICBzdGF0ZSxcbiAgb25TdWJtaXQsXG4gIG9uQ2FuY2VsLFxufToge1xuICBzdGF0ZTogQ29tcG9zZXJTdGF0ZTtcbiAgb25TdWJtaXQ6ICh0ZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG4gIG9uQ2FuY2VsOiAoKSA9PiB2b2lkO1xufSkge1xuICBjb25zdCBbdGV4dCwgc2V0VGV4dF0gPSB1c2VTdGF0ZSgnJyk7XG4gIGNvbnN0IHRleHRhcmVhUmVmID0gdXNlUmVmPEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgY2FyZFJlZiA9IHVzZVJlZjxIVE1MRGl2RWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCByYWZSZWYgPSB1c2VSZWY8bnVtYmVyIHwgbnVsbD4obnVsbCk7XG5cbiAgLy8gTGl2ZSBhbmNob3Ig4oCUIGNvbXBvc2VyIHRyYWNrcyB0aGUgdGFyZ2V0IGVsZW1lbnQgdmlhIHJBRiBzbyBwYW4vem9vbVxuICAvLyB3aGlsZSB0eXBpbmcga2VlcHMgdGhlIGNhcmQgZ2x1ZWQgdG8gaXRzIGFuY2hvci4gV3JpdGVzIGRpcmVjdGx5IHRvIHRoZVxuICAvLyBET00gc28gd2UgZG9uJ3QgcmUtcmVuZGVyIGV2ZXJ5IGZyYW1lLiBgcGxhY2VOZWFyUG9pbnRgIHBpY2tzIHdoaWNoZXZlclxuICAvLyBzaWRlIGFjdHVhbGx5IGZpdHMgdGhlIHZpZXdwb3J0IGluc3RlYWQgb2YgYWx3YXlzIGdyb3dpbmcgZG93bi1yaWdodC5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCB0aWNrID0gKCkgPT4ge1xuICAgICAgcmFmUmVmLmN1cnJlbnQgPSBudWxsO1xuICAgICAgY29uc3Qgbm9kZSA9IGNhcmRSZWYuY3VycmVudDtcbiAgICAgIGlmICghbm9kZSkgcmV0dXJuO1xuICAgICAgY29uc3QgYW5jaG9yID0gY29tcHV0ZUFuY2hvcihzdGF0ZSk7XG4gICAgICBjb25zdCBwbGFjZWQgPSBwbGFjZU5lYXJQb2ludChhbmNob3IsIHsgdzogbm9kZS5vZmZzZXRXaWR0aCwgaDogbm9kZS5vZmZzZXRIZWlnaHQgfSk7XG4gICAgICBub2RlLnN0eWxlLmxlZnQgPSBgJHtNYXRoLnJvdW5kKHBsYWNlZC54KX1weGA7XG4gICAgICBub2RlLnN0eWxlLnRvcCA9IGAke01hdGgucm91bmQocGxhY2VkLnkpfXB4YDtcbiAgICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgIH07XG4gICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmIChyYWZSZWYuY3VycmVudCAhPSBudWxsKSBjYW5jZWxBbmltYXRpb25GcmFtZShyYWZSZWYuY3VycmVudCk7XG4gICAgfTtcbiAgfSwgW3N0YXRlXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICB0ZXh0YXJlYVJlZi5jdXJyZW50Py5mb2N1cygpO1xuICB9LCBbXSk7XG5cbiAgY29uc3QgdHJ5U3VibWl0ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGNvbnN0IHYgPSB0ZXh0LnRyaW0oKTtcbiAgICBpZiAoIXYpIHJldHVybjtcbiAgICBvblN1Ym1pdCh2KTtcbiAgfSwgW3RleHQsIG9uU3VibWl0XSk7XG5cbiAgY29uc3Qgb25LZXlEb3duID0gdXNlQ2FsbGJhY2soXG4gICAgKGU6IFJlYWN0LktleWJvYXJkRXZlbnQ8SFRNTFRleHRBcmVhRWxlbWVudD4pID0+IHtcbiAgICAgIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBvbkNhbmNlbCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoKGUubWV0YUtleSB8fCBlLmN0cmxLZXkpICYmIGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdHJ5U3VibWl0KCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBbb25DYW5jZWwsIHRyeVN1Ym1pdF1cbiAgKTtcblxuICAvLyBDb21wYWN0IHNlbGVjdG9yIGhpbnQg4oCUIHN0cmlwIG5vaXN5IHN0cnVjdHVyYWwgYml0cyBzbyB0aGUgaGVhZCBzdGF5c1xuICAvLyB0aWdodCBpbnNpZGUgdGhlIDMwMHB4IGNhcmQuXG4gIGNvbnN0IHNlbGVjdG9yQ2hpcCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHMgPSBzdGF0ZS5zZWxlY3Rpb24uc2VsZWN0b3IgfHwgJyc7XG4gICAgaWYgKCFzKSByZXR1cm4gc3RhdGUuc2VsZWN0aW9uLnRhZyB8fCAnY2FudmFzJztcbiAgICAvLyBbZGF0YS1jZC1pZD1cIuKAplwiXSDihpIgY2Q6PGlkPiDCtyBrZWVwcyB0aGUgY2hpcCByZWFkYWJsZSB3aGVuIHN0YWJsZSBpZHNcbiAgICAvLyBhcmUgcHJlc2VudC5cbiAgICBjb25zdCBjZCA9IHMubWF0Y2goL2RhdGEtY2QtaWQ9XCIoW15cIl0rKVwiLyk7XG4gICAgaWYgKGNkKSByZXR1cm4gYGNkOiR7Y2RbMV19YDtcbiAgICByZXR1cm4gcy5sZW5ndGggPiAzNiA/IGAke3Muc2xpY2UoMCwgMzMpfeKApmAgOiBzO1xuICB9LCBbc3RhdGUuc2VsZWN0aW9uXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e2NhcmRSZWZ9XG4gICAgICBjbGFzc05hbWU9XCJjbS1jb21wb3NlclwiXG4gICAgICByb2xlPVwiZGlhbG9nXCJcbiAgICAgIGFyaWEtbGFiZWw9XCJOZXcgY29tbWVudFwiXG4gICAgICBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICAgIG9uUG9pbnRlckRvd249eyhlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tY29tcG9zZXJfX2hlYWRcIj5cbiAgICAgICAgPHNwYW4+TmV3IGNvbW1lbnQ8L3NwYW4+XG4gICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImNtLWNvbXBvc2VyX19zZWxlY3RvclwiPntzZWxlY3RvckNoaXB9PC9zcGFuPlxuICAgICAgPC9kaXY+XG4gICAgICA8TWVudGlvbkF3YXJlVGV4dGFyZWFcbiAgICAgICAgdGV4dGFyZWFSZWY9e3RleHRhcmVhUmVmfVxuICAgICAgICBjbGFzc05hbWU9XCJjbS1jb21wb3Nlcl9fdGV4dGFyZWFcIlxuICAgICAgICB2YWx1ZT17dGV4dH1cbiAgICAgICAgcGxhY2Vob2xkZXI9XCJUeXBlIGEgY29tbWVudC4g4oyY4oa1IHRvIHNhdmUgwrcgRXNjIHRvIGNhbmNlbCDCtyBAbmFtZSB0byB0YWdcIlxuICAgICAgICBvbkNoYW5nZT17c2V0VGV4dH1cbiAgICAgICAgb25LZXlEb3duPXtvbktleURvd259XG4gICAgICAgIHJvd3M9ezN9XG4gICAgICAgIGFyaWFMYWJlbD1cIkNvbW1lbnQgYm9keVwiXG4gICAgICAvPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjbS1jb21wb3Nlcl9fYWN0aW9uc1wiPlxuICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJjbS1idG5cIiBvbkNsaWNrPXtvbkNhbmNlbH0+XG4gICAgICAgICAgQ2FuY2VsXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgY2xhc3NOYW1lPVwiY20tYnRuIGNtLWJ0bi0tcHJpbWFyeVwiXG4gICAgICAgICAgZGlzYWJsZWQ9eyF0ZXh0LnRyaW0oKX1cbiAgICAgICAgICBvbkNsaWNrPXt0cnlTdWJtaXR9XG4gICAgICAgID5cbiAgICAgICAgICBTYXZlXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29tbWVudFRocmVhZCDigJQgcG9wb3ZlciBhbmNob3JlZCB0byB0aGUgZm9jdXNlZCBwaW4uIFNob3dzIGF1dGhvciArIHJlbGF0aXZlXG4vLyB0aW1lICsgc2VsZWN0b3IgY2hpcCwgdGhlIG9yaWdpbmFsIGJvZHkgd2l0aCBAbWVudGlvbnMgYm9sZGVkLCByZXBsaWVzLCBhXG4vLyByZXBseSB0ZXh0YXJlYSwgYW5kIHJlc29sdmUvcmVvcGVuL2RlbGV0ZSBhY3Rpb25zLiBQYXRjaGVzICsgZGVsZXRlcyByb3V0ZVxuLy8gdGhyb3VnaCB0aGUgc2hlbGwncyBleGlzdGluZyBXUyBjaGFubmVsIHZpYSBwb3N0TWVzc2FnZTsgcmVwbGllcyBQT1NUXG4vLyBkaXJlY3RseSB0byBgL19hcGkvY29tbWVudHMvPGlkPi9yZXBseWAgYmVjYXVzZSB0aGF0IGVuZHBvaW50IGV4aXN0cyBvbmx5IG9uXG4vLyBCdW4gcnVudGltZSBhbmQgbGl2ZXMgaW4gYGh0dHAudHNgLlxuXG5mdW5jdGlvbiBDb21tZW50VGhyZWFkKHtcbiAgY29tbWVudCxcbiAgc2VxdWVuY2UsXG4gIG9uQ2xvc2UsXG4gIG9uUGF0Y2gsXG4gIG9uRGVsZXRlLFxuICBvblJlcGx5LFxufToge1xuICBjb21tZW50OiBPdmVybGF5Q29tbWVudDtcbiAgc2VxdWVuY2U6IG51bWJlcjtcbiAgb25DbG9zZTogKCkgPT4gdm9pZDtcbiAgb25QYXRjaDogKHBhdGNoOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZDtcbiAgb25EZWxldGU6ICgpID0+IHZvaWQ7XG4gIG9uUmVwbHk6IChib2R5OiBzdHJpbmcpID0+IFByb21pc2U8Ym9vbGVhbj47XG59KSB7XG4gIGNvbnN0IGRpYWxvZ1JlZiA9IHVzZVJlZjxIVE1MRGl2RWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCByZXBseVJlZiA9IHVzZVJlZjxIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHJhZlJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3JlcGx5LCBzZXRSZXBseV0gPSB1c2VTdGF0ZSgnJyk7XG4gIGNvbnN0IFtzZW5kaW5nLCBzZXRTZW5kaW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcblxuICAvLyBMaXZlIGFuY2hvciDigJQgcG9wb3ZlciB0cmFja3MgdGhlIHBpbiB2aWEgckFGIHNvIGl0IHN0YXlzIGdsdWVkIHRvIGl0c1xuICAvLyB0YXJnZXQgdGhyb3VnaCBwYW4gLyB6b29tIChGaWdKYW0gcGFyaXR5KS4gV3JpdGluZyB0byB0aGUgZGlhbG9nIHN0eWxlXG4gIC8vIGRpcmVjdGx5IGF2b2lkcyByZS1yZW5kZXJpbmcgZXZlcnkgZnJhbWUuIGBwbGFjZU5lYXJQb2ludGAgcGlja3Mgd2hpY2hldmVyXG4gIC8vIHNpZGUgYWN0dWFsbHkgZml0cyB0aGUgdmlld3BvcnQgaW5zdGVhZCBvZiBhbHdheXMgZ3Jvd2luZyBkb3duLXJpZ2h0LlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHRpY2sgPSAoKSA9PiB7XG4gICAgICByYWZSZWYuY3VycmVudCA9IG51bGw7XG4gICAgICBjb25zdCBub2RlID0gZGlhbG9nUmVmLmN1cnJlbnQ7XG4gICAgICBpZiAoIW5vZGUpIHJldHVybjtcbiAgICAgIGNvbnN0IGFuY2hvciA9IGNvbXB1dGVUaHJlYWRBbmNob3IoY29tbWVudCk7XG4gICAgICBjb25zdCBwbGFjZWQgPSBwbGFjZU5lYXJQb2ludChhbmNob3IsIHsgdzogbm9kZS5vZmZzZXRXaWR0aCwgaDogbm9kZS5vZmZzZXRIZWlnaHQgfSk7XG4gICAgICBub2RlLnN0eWxlLmxlZnQgPSBgJHtNYXRoLnJvdW5kKHBsYWNlZC54KX1weGA7XG4gICAgICBub2RlLnN0eWxlLnRvcCA9IGAke01hdGgucm91bmQocGxhY2VkLnkpfXB4YDtcbiAgICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgIH07XG4gICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGlmIChyYWZSZWYuY3VycmVudCAhPSBudWxsKSBjYW5jZWxBbmltYXRpb25GcmFtZShyYWZSZWYuY3VycmVudCk7XG4gICAgfTtcbiAgfSwgW2NvbW1lbnRdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIC8vIE1vdmUgZm9jdXMgaW50byB0aGUgZGlhbG9nIG9uIG9wZW4uIFBlciBXQ0FHIDIuMSB0aGUgZGlhbG9nIHNob3VsZCBvd25cbiAgICAvLyBpbml0aWFsIGZvY3VzOyB3ZSBwdXQgaXQgb24gdGhlIGRpYWxvZyByb290IChmb2N1c2FibGUgdmlhIHRhYmluZGV4KVxuICAgIC8vIHNvIHNjcmVlbiByZWFkZXJzIGFubm91bmNlIHRoZSBoZWFkZXIgYmVmb3JlIHRoZSBib2R5LiBPbiBjbG9zZSxcbiAgICAvLyByZXR1cm4gZm9jdXMgdG8gdGhlIHBpbiBzbyBrZXlib2FyZCB1c2VycyBsYW5kIHdoZXJlIHRoZXkgc3RhcnRlZC5cbiAgICBkaWFsb2dSZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICBjb25zdCBwaW5JZCA9IGNvbW1lbnQuaWQ7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNvbnN0IHBpbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEJ1dHRvbkVsZW1lbnQ+KGBbZGF0YS1jb21tZW50LXBpbj1cIiR7cGluSWR9XCJdYCk7XG4gICAgICBwaW4/LmZvY3VzKCk7XG4gICAgfTtcbiAgfSwgW2NvbW1lbnQuaWRdKTtcblxuICAvLyBFc2MtdG8tY2xvc2Ugd2hpbGUgZm9jdXMgaXMgYW55d2hlcmUgaW5zaWRlIHRoZSBwb3BvdmVyLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgY29uc3Qgb25LZXkgPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGUua2V5ICE9PSAnRXNjYXBlJykgcmV0dXJuO1xuICAgICAgY29uc3Qgcm9vdCA9IGRpYWxvZ1JlZi5jdXJyZW50O1xuICAgICAgaWYgKCFyb290KSByZXR1cm47XG4gICAgICBpZiAocm9vdC5jb250YWlucyhlLnRhcmdldCBhcyBOb2RlKSB8fCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSByb290KSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgb25DbG9zZSgpO1xuICAgICAgfVxuICAgIH07XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5KTtcbiAgICByZXR1cm4gKCkgPT4gZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5KTtcbiAgfSwgW29uQ2xvc2VdKTtcblxuICBjb25zdCB0cnlTZW5kUmVwbHkgPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgdiA9IHJlcGx5LnRyaW0oKTtcbiAgICBpZiAoIXYgfHwgc2VuZGluZykgcmV0dXJuO1xuICAgIHNldFNlbmRpbmcodHJ1ZSk7XG4gICAgY29uc3Qgb2sgPSBhd2FpdCBvblJlcGx5KHYpO1xuICAgIHNldFNlbmRpbmcoZmFsc2UpO1xuICAgIGlmIChvaykge1xuICAgICAgc2V0UmVwbHkoJycpO1xuICAgICAgcmVwbHlSZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICB9XG4gIH0sIFtyZXBseSwgc2VuZGluZywgb25SZXBseV0pO1xuXG4gIGNvbnN0IG9uUmVwbHlLZXlEb3duID0gdXNlQ2FsbGJhY2soXG4gICAgKGU6IFJlYWN0LktleWJvYXJkRXZlbnQ8SFRNTFRleHRBcmVhRWxlbWVudD4pID0+IHtcbiAgICAgIGlmICgoZS5tZXRhS2V5IHx8IGUuY3RybEtleSkgJiYgZS5rZXkgPT09ICdFbnRlcicpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB2b2lkIHRyeVNlbmRSZXBseSgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgW3RyeVNlbmRSZXBseV1cbiAgKTtcblxuICBjb25zdCBoZWFkSWQgPSBgY20tdGhyZWFkLWhlYWQtJHtjb21tZW50LmlkfWA7XG4gIGNvbnN0IHNlbGVjdG9yQ2hpcCA9IGZvcm1hdFNlbGVjdG9yQ2hpcChjb21tZW50LnNlbGVjdG9yLCAnJyk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e2RpYWxvZ1JlZn1cbiAgICAgIGNsYXNzTmFtZT1cImNtLXRocmVhZFwiXG4gICAgICByb2xlPVwiZGlhbG9nXCJcbiAgICAgIGFyaWEtbGFiZWxsZWRieT17aGVhZElkfVxuICAgICAgdGFiSW5kZXg9ey0xfVxuICAgICAgb25DbGljaz17KGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9XG4gICAgICBvblBvaW50ZXJEb3duPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNtLXRocmVhZF9faGVhZFwiIGlkPXtoZWFkSWR9PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNtLXRocmVhZF9faGVhZC1yb3dcIj5cbiAgICAgICAgICB7LyogUGxhbiBDIFAxOCDigJQgcGluL3NlcXVlbmNlIGJhZGdlIGluIHRoZSBwb3BvdmVyIGhlYWRlciAocGFyaXR5IHdpdGhcbiAgICAgICAgICAgICAgYC5kZXNpZ24vdWkvU3R1ZGlvLnRzeGAgdGhyZWFkIHBvcG92ZXIpLiAqL31cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX3NlcVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPlxuICAgICAgICAgICAge3NlcXVlbmNlfVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX2F1dGhvclwiPntjb21tZW50LmF1dGhvcj8udHJpbSgpIHx8ICd1bmtub3duJ308L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiY20tdGhyZWFkX190aW1lXCI+e2Zvcm1hdFJlbGF0aXZlVGltZShjb21tZW50LmNyZWF0ZWQpfTwvc3Bhbj5cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cImNtLXRocmVhZF9fY2xvc2VcIlxuICAgICAgICAgICAgYXJpYS1sYWJlbD1cIkNsb3NlIHRocmVhZFwiXG4gICAgICAgICAgICB0aXRsZT1cIkNsb3NlIMK3IEVzY1wiXG4gICAgICAgICAgICBvbkNsaWNrPXtvbkNsb3NlfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIMOXXG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICB7c2VsZWN0b3JDaGlwID8gPGNvZGUgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19zZWxlY3RvclwiPntzZWxlY3RvckNoaXB9PC9jb2RlPiA6IG51bGx9XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX2JvZHlcIj57cmVuZGVyQm9keVdpdGhNZW50aW9ucyhjb21tZW50LnRleHQpfTwvZGl2PlxuXG4gICAgICB7KGNvbW1lbnQudGhyZWFkID8/IFtdKS5tYXAoKHIpID0+IChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX3JlcGx5XCIga2V5PXtyLmlkfT5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNtLXRocmVhZF9fcmVwbHktaGVhZFwiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiY20tdGhyZWFkX19yZXBseS1hdXRob3JcIj57ci5hdXRob3I/LnRyaW0oKSB8fCAndW5rbm93bid9PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiY20tdGhyZWFkX19yZXBseS10aW1lXCI+e2Zvcm1hdFJlbGF0aXZlVGltZShyLmNyZWF0ZWQpfTwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNtLXRocmVhZF9fcmVwbHktYm9keVwiPntyZW5kZXJCb2R5V2l0aE1lbnRpb25zKHIuYm9keSl9PC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKSl9XG5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19yZXBseS1mb3JtXCI+XG4gICAgICAgIDxNZW50aW9uQXdhcmVUZXh0YXJlYVxuICAgICAgICAgIHRleHRhcmVhUmVmPXtyZXBseVJlZn1cbiAgICAgICAgICBjbGFzc05hbWU9XCJjbS10aHJlYWRfX3JlcGx5LXRleHRhcmVhXCJcbiAgICAgICAgICB2YWx1ZT17cmVwbHl9XG4gICAgICAgICAgcGxhY2Vob2xkZXI9XCJSZXBseeKApiDijJjihrUgdG8gc2VuZCDCtyBAbmFtZSB0byB0YWdcIlxuICAgICAgICAgIG9uQ2hhbmdlPXtzZXRSZXBseX1cbiAgICAgICAgICBvbktleURvd249e29uUmVwbHlLZXlEb3dufVxuICAgICAgICAgIHJvd3M9ezJ9XG4gICAgICAgICAgYXJpYUxhYmVsPVwiUmVwbHlcIlxuICAgICAgICAgIGRpc2FibGVkPXtzZW5kaW5nfVxuICAgICAgICAvPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNtLXRocmVhZF9fcmVwbHktYWN0aW9uc1wiPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiY20tYnRuIGNtLWJ0bi0tcHJpbWFyeVwiXG4gICAgICAgICAgICBkaXNhYmxlZD17IXJlcGx5LnRyaW0oKSB8fCBzZW5kaW5nfVxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gdm9pZCB0cnlTZW5kUmVwbHkoKX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBTZW5kXG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19hY3Rpb25zXCI+XG4gICAgICAgIHtjb21tZW50LnN0YXR1cyA9PT0gJ3Jlc29sdmVkJyA/IChcbiAgICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzc05hbWU9XCJjbS1idG5cIiBvbkNsaWNrPXsoKSA9PiBvblBhdGNoKHsgc3RhdHVzOiAnb3BlbicgfSl9PlxuICAgICAgICAgICAg4oa6IFJlb3BlblxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiY20tYnRuIGNtLWJ0bi0tcHJpbWFyeVwiXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgIG9uUGF0Y2goeyBzdGF0dXM6ICdyZXNvbHZlZCcgfSk7XG4gICAgICAgICAgICAgIG9uQ2xvc2UoKTtcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAg4pyTIFJlc29sdmVcbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgKX1cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgIGNsYXNzTmFtZT1cImNtLWJ0biBjbS1idG4tLWRhbmdlclwiXG4gICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgb25EZWxldGUoKTtcbiAgICAgICAgICAgIG9uQ2xvc2UoKTtcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgRGVsZXRlXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQm9keSByZW5kZXJlciDigJQgc3BsaXRzIHRleHQgb24gQC1oYW5kbGVzLCB3cmFwcyBlYWNoIGluIDxzdHJvbmc+LiBBbnl0aGluZ1xuLy8gbm90IG1hdGNoaW5nIHRoZSBtZW50aW9uIHJlZ2V4IHN0YXlzIHBsYWluIHRleHQgKG5ld2xpbmVzIHByZXNlcnZlZCBieSBDU1Ncbi8vIGB3aGl0ZS1zcGFjZTogcHJlLXdyYXBgKS5cblxuZnVuY3Rpb24gcmVuZGVyQm9keVdpdGhNZW50aW9ucyh0ZXh0OiBzdHJpbmcpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBpZiAoIXRleHQpIHJldHVybiBudWxsO1xuICBjb25zdCByZSA9IC8oQFtcXHddW1xcdy4tXSopL2c7XG4gIGNvbnN0IHBhcnRzID0gdGV4dC5zcGxpdChyZSk7XG4gIHJldHVybiBwYXJ0cy5tYXAoKHBhcnQsIGkpID0+IHtcbiAgICAvLyBUaGUgc3BsaXQgcG9zaXRpb25zIEFSRSB0aGUgaWRlbnRpdHkgaGVyZSDigJQgZm9yIHRoZSBzYW1lIGB0ZXh0YCBpbnB1dCxcbiAgICAvLyBpbmRleCBgaWAgYWx3YXlzIG1hcHMgdG8gdGhlIHNhbWUgZnJhZ21lbnQuIENvbXBvc2Uga2V5IGZyb20gaW5kZXggK1xuICAgIC8vIGNvbnRlbnQgc28gYmlvbWUncyBhcnJheS1pbmRleC1rZXkgaGV1cmlzdGljIGlzIHNhdGlzZmllZCBBTkQgcmVvcmRlclxuICAgIC8vIHJlc2lzdGFuY2UgaXMgaW50YWN0IGlmIGB0ZXh0YCBtdXRhdGVzIG1pZC1yZW5kZXIuXG4gICAgY29uc3Qga2V5ID0gYCR7aX06JHtwYXJ0fWA7XG4gICAgaWYgKGkgJSAyID09PSAxKSB7XG4gICAgICAvLyBPZGQgcGFydHMgYXJlIHRoZSBjYXB0dXJlZCBAaGFuZGxlcyB0aGFua3MgdG8gdGhlIHBhcmVudGhlc2l6ZWQgc3BsaXQuXG4gICAgICByZXR1cm4gKFxuICAgICAgICA8c3Ryb25nIGtleT17a2V5fSBkYXRhLW1lbnRpb249XCJ0cnVlXCI+XG4gICAgICAgICAge3BhcnR9XG4gICAgICAgIDwvc3Ryb25nPlxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIDxzcGFuIGtleT17a2V5fT57cGFydH08L3NwYW4+O1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0UmVsYXRpdmVUaW1lKGlzbzogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCFpc28pIHJldHVybiAnJztcbiAgY29uc3QgdCA9IERhdGUucGFyc2UoaXNvKTtcbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUodCkpIHJldHVybiAnJztcbiAgY29uc3QgZGlmZlNlYyA9IE1hdGgucm91bmQoKERhdGUubm93KCkgLSB0KSAvIDEwMDApO1xuICBpZiAoZGlmZlNlYyA8IDYwKSByZXR1cm4gYCR7TWF0aC5tYXgoZGlmZlNlYywgMCl9cyBhZ29gO1xuICBpZiAoZGlmZlNlYyA8IDM2MDApIHJldHVybiBgJHtNYXRoLnJvdW5kKGRpZmZTZWMgLyA2MCl9bSBhZ29gO1xuICBpZiAoZGlmZlNlYyA8IDg2XzQwMCkgcmV0dXJuIGAke01hdGgucm91bmQoZGlmZlNlYyAvIDM2MDApfWggYWdvYDtcbiAgcmV0dXJuIGAke01hdGgucm91bmQoZGlmZlNlYyAvIDg2XzQwMCl9ZCBhZ29gO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRTZWxlY3RvckNoaXAoc2VsZWN0b3I6IHN0cmluZywgZmFsbGJhY2s6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghc2VsZWN0b3IpIHJldHVybiBmYWxsYmFjaztcbiAgY29uc3QgY2QgPSBzZWxlY3Rvci5tYXRjaCgvZGF0YS1jZC1pZD1cIihbXlwiXSspXCIvKTtcbiAgaWYgKGNkKSByZXR1cm4gYGNkOiR7Y2RbMV19YDtcbiAgcmV0dXJuIHNlbGVjdG9yLmxlbmd0aCA+IDM2ID8gYCR7c2VsZWN0b3Iuc2xpY2UoMCwgMzMpfeKApmAgOiBzZWxlY3Rvcjtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZVRocmVhZEFuY2hvcihjb21tZW50OiBPdmVybGF5Q29tbWVudCk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XG4gIC8vIFJlc29sdmUgdGFyZ2V0J3MgbGl2ZSBzY3JlZW4gcmVjdDsgcG9wb3ZlciBkcm9wcyBiZWxvdyB0aGUgcGluIHdpdGggc21hbGxcbiAgLy8gYnJlYXRoaW5nIHJvb20uIFN0b3JlZCBib3VuZHMgKGNhcHR1cmUtdGltZSBzY3JlZW4gY29vcmRzKSBhcmUgdGhlXG4gIC8vIGxhc3QtcmVzb3J0IGZhbGxiYWNrIGZvciBvcnBoYW5lZCBwaW5zLlxuICBjb25zdCByZWN0ID0gY29tbWVudC5zZWxlY3RvciA/IHNjcmVlblJlY3RGb3IoY29tbWVudCkgOiBudWxsO1xuICBpZiAocmVjdCkge1xuICAgIC8vIFBpbiBzaXRzIGF0IChyZWN0LnJpZ2h0IC0gMTIsIHJlY3QudG9wIC0gMTIpLiBQbGFjZSBwb3BvdmVyIGF0IHRoZSBzYW1lXG4gICAgLy8geCBmb3IgdmlzdWFsIGNvbnRpbnVpdHksIDE2cHggYmVsb3cgdGhlIHRvcCBzbyBpdCBjbGVhcnMgdGhlIHBpbi5cbiAgICByZXR1cm4geyB4OiByZWN0LnggKyByZWN0LncgLSAxMiwgeTogcmVjdC55ICsgMTYgfTtcbiAgfVxuICBpZiAoY29tbWVudC5ib3VuZHMpIHtcbiAgICByZXR1cm4geyB4OiBjb21tZW50LmJvdW5kcy54ICsgY29tbWVudC5ib3VuZHMudyAtIDEyLCB5OiBjb21tZW50LmJvdW5kcy55ICsgMTYgfTtcbiAgfVxuICByZXR1cm4geyB4OiAxNiwgeTogMTYgfTtcbn1cblxuZnVuY3Rpb24gY29tcHV0ZUFuY2hvcihzdGF0ZTogQ29tcG9zZXJTdGF0ZSk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XG4gIC8vIEc0IOKAlCBhbmNob3IgdG8gdGhlIGN1cnNvciBjbGljayBwb2ludCBmaXJzdC4gRWFybGllciB2ZXJzaW9ucyBhbmNob3JlZCB0b1xuICAvLyB0aGUgc2VsZWN0ZWQgZWxlbWVudCdzIGJvdHRvbS1sZWZ0LCB3aGljaCBsYW5kZWQgdGhlIGNvbXBvc2VyIGZsdXNoIGluXG4gIC8vIHRoZSBjb3JuZXIgcmVnYXJkbGVzcyBvZiB3aGVyZSB0aGUgdXNlciBjbGlja2VkIOKAlCBzdXJwcmlzaW5nIGZvciB0aGVcbiAgLy8gY29tbW9uIGNhc2Ugb2YgXCJJIGNsaWNrZWQgdGhlIG1pZGRsZSBvZiBhbiBlbGVtZW50LCBleHBlY3RpbmcgdGhlXG4gIC8vIGNvbXBvc2VyIHRvIGFwcGVhciBuZWFyIG15IGN1cnNvclwiLiBUaGUgZWxlbWVudC1yZWN0IHBhdGggcmVtYWlucyBhcyBhXG4gIC8vIGZhbGxiYWNrIGZvciBlbnRyeSBwb2ludHMgdGhhdCBkb24ndCBjYXJyeSBhIGN1cnNvciAoZS5nLiBvcGVuaW5nIHRoZVxuICAvLyBjb21wb3NlciBmcm9tIGEgY29udGV4dHVhbCB0b29sYmFyIGJ1dHRvbiDigJQgdGhvc2Ugc2hvdWxkIHNldCBjbGllbnRYL1lcbiAgLy8gdG8gYSBzZW5zaWJsZSBhbmNob3IgYmVmb3JlIGRpc3BhdGNoaW5nKS5cbiAgaWYgKHN0YXRlLmNsaWVudFggfHwgc3RhdGUuY2xpZW50WSkge1xuICAgIHJldHVybiB7IHg6IHN0YXRlLmNsaWVudFgsIHk6IHN0YXRlLmNsaWVudFkgKyA4IH07XG4gIH1cbiAgaWYgKHN0YXRlLnNlbGVjdGlvbi5zZWxlY3Rvcikge1xuICAgIGNvbnN0IHJlY3QgPSBzY3JlZW5SZWN0Rm9yKHN0YXRlLnNlbGVjdGlvbik7XG4gICAgaWYgKHJlY3QpIHtcbiAgICAgIHJldHVybiB7IHg6IHJlY3QueCwgeTogcmVjdC55ICsgcmVjdC5oICsgOCB9O1xuICAgIH1cbiAgfVxuICByZXR1cm4geyB4OiAxNiwgeTogMTYgfTtcbn1cbiIsCiAgICAiLyoqXG4gKiBAZmlsZSAgICAgICBkb20tc2VsZWN0aW9uLnRzIOKAlCBzZWxlY3Rpb24tZnJvbS1ET00gaGVscGVycyAobGVhZiBtb2R1bGUpXG4gKiBAc2NvcGUgICAgICBhcHBzL3N0dWRpby9kb20tc2VsZWN0aW9uLnRzXG4gKiBAcHVycG9zZSAgICBQdXJlIERPTSDihpIgU2VsZWN0aW9uIGJ1aWxkZXJzIHNoYXJlZCBieSB0aGUgY2FudmFzIGNocm9tZVxuICogICAgICAgICAgICAgKGNhbnZhcy1zaGVsbC50c3gpIGFuZCB0aGUgc2hlbGwtb3duZWQgY29tbWVudCBtb3VudCBsYXllclxuICogICAgICAgICAgICAgKGNhbnZhcy1jb21tZW50LW1vdW50LnRzeCkuIExpdmVzIGluIGl0cyBvd24gbGVhZiBtb2R1bGUg4oCUIG5vXG4gKiAgICAgICAgICAgICBSZWFjdCwgbm8gY2FudmFzLWxpYiBpbXBvcnQg4oCUIHNvIGJvdGggY29uc3VtZXJzIGNhbiBsaWZ0IHRoZVxuICogICAgICAgICAgICAgc2FtZSBgaG92ZXJUYXJnZXRUb1NlbGVjdGlvbmAgLyBgZGVyaXZlRmlsZWAgbG9naWMgd2l0aG91dCBhXG4gKiAgICAgICAgICAgICBjeWNsZSBhbmQgd2l0aG91dCBidW5kbGluZyB0aGUgaGVhdnkgRGVzaWduQ2FudmFzIHRyZWUgaW50byB0aGVcbiAqICAgICAgICAgICAgIGxpdGUgY29tbWVudCBtb3VudC5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IEhvdmVyVGFyZ2V0IH0gZnJvbSAnLi9pbnB1dC1yb3V0ZXIudHN4JztcbmltcG9ydCB0eXBlIHsgU2VsZWN0aW9uIH0gZnJvbSAnLi91c2Utc2VsZWN0aW9uLXNldC50c3gnO1xuXG4vKipcbiAqIENhbnZhcyBmaWxlIHBhdGggZm9yIHRoZSBjdXJyZW50IHBhZ2UuIFVuZGVyIHRoZSBtb3VudCBoYXJuZXNzIHRoZSBwYWdlIGlzXG4gKiBgL19jYW52YXMtc2hlbGwuaHRtbD9jYW52YXM9PHJlbD4mZGVzaWduUmVsPTxyb290PmA7IGZvciBsZWdhY3kgYC5odG1sYFxuICogbW9ja3MgaXQncyB0aGUgc2VydmVkIGZpbGUgcGF0aCBpdHNlbGYuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXJpdmVGaWxlKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIHVuZGVmaW5lZDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lO1xuICAgIGlmIChwID09PSAnL19jYW52YXMtc2hlbGwuaHRtbCcgfHwgcCA9PT0gJy9fY2FudmFzLXNoZWxsJykge1xuICAgICAgY29uc3QgcXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuICAgICAgY29uc3QgY2FudmFzID0gcXMuZ2V0KCdjYW52YXMnKSA/PyAnJztcbiAgICAgIGNvbnN0IGRlc2lnblJlbCA9IChxcy5nZXQoJ2Rlc2lnblJlbCcpID8/ICcuZGVzaWduJykucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgJycpO1xuICAgICAgcmV0dXJuIGNhbnZhcyA/IGAke2Rlc2lnblJlbH0vJHtjYW52YXN9YCA6IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChwKS5yZXBsYWNlKC9eXFwvLywgJycpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFsQ2xhc3NlcyhlbDogRWxlbWVudCB8IG51bGwpOiBzdHJpbmcge1xuICBpZiAoIWVsKSByZXR1cm4gJyc7XG4gIHJldHVybiAoZWwuZ2V0QXR0cmlidXRlKCdjbGFzcycpID8/ICcnKVxuICAgIC50cmltKClcbiAgICAuc3BsaXQoL1xccysvKVxuICAgIC5maWx0ZXIoKGMpID0+IGMgJiYgIWMuc3RhcnRzV2l0aCgnZGduLScpICYmICFjLnN0YXJ0c1dpdGgoJ2RjLWN2LScpKVxuICAgIC5qb2luKCcgJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG9ydFRleHQoZWw6IEVsZW1lbnQgfCBudWxsLCBtYXg6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmICghZWwpIHJldHVybiAnJztcbiAgY29uc3QgdCA9ICgoZWwgYXMgSFRNTEVsZW1lbnQpLmlubmVyVGV4dCB8fCBlbC50ZXh0Q29udGVudCB8fCAnJykucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKTtcbiAgcmV0dXJuIHQubGVuZ3RoID4gbWF4ID8gYCR7dC5zbGljZSgwLCBtYXggLSAxKX3igKZgIDogdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNzc1BhdGgoZWw6IEVsZW1lbnQgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKCFlbCkgcmV0dXJuICcnO1xuICBjb25zdCBwYXRoOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgY3VyOiBFbGVtZW50IHwgbnVsbCA9IGVsO1xuICB3aGlsZSAoY3VyICYmIGN1ci5ub2RlVHlwZSA9PT0gMSAmJiBwYXRoLmxlbmd0aCA8IDgpIHtcbiAgICBjb25zdCBkc2NFbCA9IGN1ci5nZXRBdHRyaWJ1dGU/LignZGF0YS1kYy1lbGVtZW50Jyk7XG4gICAgaWYgKGRzY0VsKSB7XG4gICAgICBwYXRoLnVuc2hpZnQoYFtkYXRhLWRjLWVsZW1lbnQ9XCIke2RzY0VsfVwiXWApO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNvbnN0IGRzY1NjID0gY3VyLmdldEF0dHJpYnV0ZT8uKCdkYXRhLWRjLXNjcmVlbicpO1xuICAgIGlmIChkc2NTYykge1xuICAgICAgcGF0aC51bnNoaWZ0KGBbZGF0YS1kYy1zY3JlZW49XCIke2RzY1NjfVwiXWApO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGxldCBzZWwgPSBjdXIubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoY3VyLmlkKSB7XG4gICAgICBzZWwgPSBgIyR7Y3VyLmlkfWA7XG4gICAgICBwYXRoLnVuc2hpZnQoc2VsKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBjbHMgPSByZWFsQ2xhc3NlcyhjdXIpLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJvb2xlYW4pLnNsaWNlKDAsIDIpO1xuICAgIGlmIChjbHMubGVuZ3RoKSBzZWwgKz0gYC4ke2Nscy5qb2luKCcuJyl9YDtcbiAgICBsZXQgc2liID0gMTtcbiAgICBsZXQgbjogRWxlbWVudCB8IG51bGwgPSBjdXIucHJldmlvdXNFbGVtZW50U2libGluZztcbiAgICB3aGlsZSAobikge1xuICAgICAgc2liKys7XG4gICAgICBuID0gbi5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICAgIH1cbiAgICBzZWwgKz0gYDpudGgtY2hpbGQoJHtzaWJ9KWA7XG4gICAgcGF0aC51bnNoaWZ0KHNlbCk7XG4gICAgY3VyID0gY3VyLnBhcmVudEVsZW1lbnQ7XG4gIH1cbiAgcmV0dXJuIHBhdGguam9pbignID4gJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkb21QYXRoKGVsOiBFbGVtZW50IHwgbnVsbCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgaG9wczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGN1ciA9IGVsO1xuICB3aGlsZSAoY3VyICYmIGN1ci5ub2RlVHlwZSA9PT0gMSAmJiBob3BzLmxlbmd0aCA8IDgpIHtcbiAgICBsZXQgbGFiZWwgPSBjdXIubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBkRWwgPSBjdXIuZ2V0QXR0cmlidXRlPy4oJ2RhdGEtZGMtZWxlbWVudCcpO1xuICAgIGNvbnN0IGRTYyA9IGN1ci5nZXRBdHRyaWJ1dGU/LignZGF0YS1kYy1zY3JlZW4nKTtcbiAgICBpZiAoZEVsKSBsYWJlbCArPSBgW2RhdGEtZGMtZWxlbWVudD1cIiR7ZEVsfVwiXWA7XG4gICAgZWxzZSBpZiAoZFNjKSBsYWJlbCArPSBgW2RhdGEtZGMtc2NyZWVuPVwiJHtkU2N9XCJdYDtcbiAgICBlbHNlIGlmIChjdXIuaWQpIGxhYmVsICs9IGAjJHtjdXIuaWR9YDtcbiAgICBjb25zdCBjbHMgPSByZWFsQ2xhc3NlcyhjdXIpLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJvb2xlYW4pLnNsaWNlKDAsIDIpO1xuICAgIGlmIChjbHMubGVuZ3RoICYmICFkRWwgJiYgIWRTYykgbGFiZWwgKz0gYC4ke2Nscy5qb2luKCcuJyl9YDtcbiAgICBob3BzLnVuc2hpZnQobGFiZWwpO1xuICAgIGN1ciA9IGN1ci5wYXJlbnRFbGVtZW50O1xuICB9XG4gIHJldHVybiBob3BzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3NzRXNjYXBlKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIE1pbmltYWwgQ1NTLmVzY2FwZSBwb2x5ZmlsbCDigJQgb25seSBoYW5kbGVzIGNoYXJzIGFjdHVhbGx5IHByZXNlbnQgaW5cbiAgLy8gcGlwZWxpbmUtc3RhbXBlZCBJRHMgKGFscGhhbnVtZXJpY3MgKyBgLWAgKyBgX2ApLlxuICByZXR1cm4gcy5yZXBsYWNlKC9bXmEtekEtWjAtOV8tXS9nLCAoYykgPT4gYFxcXFwke2N9YCk7XG59XG5cbi8qKlxuICogQnVpbGQgdGhlIHdpcmUtc2hhcGUgYFNlbGVjdGlvbmAgZm9yIGEgcmVzb2x2ZWQgaG92ZXIgdGFyZ2V0LiBgZmlsZWBcbiAqIGRlZmF1bHRzIHRvIGBkZXJpdmVGaWxlKClgOyB0aGUgY29tbWVudCBtb3VudCBsYXllciBwYXNzZXMgaXQgZXhwbGljaXRseVxuICogc28gYWxsIHRocmVlIGNvbnN1bWVycyAocm91dGVyLCBvdmVybGF5LCBtb3VudCkgYWdyZWUgb24gdGhlIHNhbWUga2V5LlxuICovXG4vKipcbiAqIFRoZSBhcnRib2FyZC1zY29wZWQgZGF0YS1jZC1pZCBzZWxlY3Rvci4gQSBjb21wb25lbnQgc2hhcmVkIGFjcm9zcyBhcnRib2FyZHNcbiAqIGNhcnJpZXMgdGhlIFNBTUUgZGF0YS1jZC1pZCBpbiBlYWNoLCBzbyBhIGJhcmUgYFtkYXRhLWNkLWlkPVwi4oCmXCJdYCByZXNvbHZlc1xuICogKHZpYSBxdWVyeVNlbGVjdG9yKSB0byB0aGUgRklSU1QgYXJ0Ym9hcmQuIFByZWZpeGluZyB0aGUgaGl0J3MgYXJ0Ym9hcmQgbWFrZXNcbiAqIHRoZSBhbmNob3IgcGVyLWluc3RhbmNlLiBTaGFyZWQgYnkgRVZFUlkgc2VsZWN0b3IgYnVpbGRlciArIHJlc29sdmVyIHNvIHRoZXlcbiAqIGNhbid0IGRyaWZ0ICh0aGUgb3JpZ2luYWwgZml4IG9ubHkgcGF0Y2hlZCBvbmUgb2Ygfjggc2l0ZXMpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2NvcGVkQ2RTZWxlY3RvcihjZElkOiBzdHJpbmcsIGFydGJvYXJkSWQ/OiBzdHJpbmcgfCBudWxsKTogc3RyaW5nIHtcbiAgcmV0dXJuIGFydGJvYXJkSWRcbiAgICA/IGBbZGF0YS1kYy1zY3JlZW49XCIke2FydGJvYXJkSWR9XCJdIFtkYXRhLWNkLWlkPVwiJHtjZElkfVwiXWBcbiAgICA6IGBbZGF0YS1jZC1pZD1cIiR7Y2RJZH1cIl1gO1xufVxuXG4vKipcbiAqIE9jY3VycmVuY2UgaW5kZXggb2YgYGVsYCBhbW9uZyBgZG9jLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpYC4gRXZlbiB3aXRoIGFuXG4gKiBhcnRib2FyZC1zY29wZWQgZGF0YS1jZC1pZCBzZWxlY3RvciwgYSBjb21wb25lbnQgcmVwZWF0ZWQgV0lUSElOIG9uZSBhcnRib2FyZFxuICogKGEgbGlzdCByb3csIG9yIGEgcmV1c2FibGUgdXNlZCB0d2ljZSkgcHJvZHVjZXMgc2V2ZXJhbCBtYXRjaGVzIOKAlCB0aGUgaW5kZXhcbiAqIGlzIHRoZSBvbmx5IHRoaW5nIHRoYXQgbWFrZXMgdGhlIGFuY2hvciB0cnVseSB1bmlxdWUgcGVyIERPTSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlbGVjdG9ySW5kZXgoZG9jOiBEb2N1bWVudCwgc2VsZWN0b3I6IHN0cmluZywgZWw6IEVsZW1lbnQgfCBudWxsKTogbnVtYmVyIHtcbiAgaWYgKCFlbCkgcmV0dXJuIDA7XG4gIHRyeSB7XG4gICAgY29uc3QgYWxsID0gZG9jLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYWxsW2ldID09PSBlbCkgcmV0dXJuIGk7XG4gICAgfVxuICB9IGNhdGNoIHtcbiAgICAvKiBtYWxmb3JtZWQgc2VsZWN0b3IgKi9cbiAgfVxuICByZXR1cm4gMDtcbn1cblxuLyoqXG4gKiBHTE9CQUwgb2NjdXJyZW5jZSBpbmRleCBvZiBgZWxgIGFtb25nIEVWRVJZIG5vZGUgaW4gdGhlIGRvY3VtZW50IHRoYXQgc2hhcmVzXG4gKiBpdHMgYGRhdGEtY2QtaWRgIOKAlCB0aGUgRE9NIGluc3RhbmNlIGluZGV4IHRoZSBzZXJ2ZXItc2lkZSByZXVzZWQtY29tcG9uZW50XG4gKiB1c2FnZSByZXNvbHZlciAoYHJlc29sdmVVc2FnZUlkYCkgZXhwZWN0cywgaW4gc291cmNlIG9yZGVyLiBEaXN0aW5jdCBmcm9tIGFcbiAqIGBTZWxlY3Rpb24uaW5kZXhgICh3aGljaCBjb3VudHMgd2l0aGluIGFuIGFydGJvYXJkLVNDT1BFRCBzZWxlY3RvcikuIFVzZWQgdG9cbiAqIHJvdXRlIGEgd2hvbGUtaW5zdGFuY2UgbW92ZS9yZXNpemUgcGVyLW9jY3VycmVuY2UgKFN0YWdlIEgzKSBzbyBpdCBzdGF5cyBsb2NhbFxuICogdG8gdGhlIGRyYWdnZWQgaW5zdGFuY2UuIE1hdGNoZXMgdGhlIHJlb3JkZXIgZHJhZydzIG93biBzbmFwc2hvdCBvY2N1cnJlbmNlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2xvYmFsQ2RPY2N1cnJlbmNlKGRvYzogRG9jdW1lbnQsIGNkSWQ6IHN0cmluZywgZWw6IEVsZW1lbnQgfCBudWxsKTogbnVtYmVyIHtcbiAgaWYgKCFjZElkIHx8ICFlbCkgcmV0dXJuIDA7XG4gIHJldHVybiBzZWxlY3RvckluZGV4KGRvYywgYFtkYXRhLWNkLWlkPVwiJHtjc3NFc2NhcGUoY2RJZCl9XCJdYCwgZWwpO1xufVxuXG4vKipcbiAqIFJlc29sdmUgYSBzdG9yZWQgU2VsZWN0aW9uIHRvIGl0cyBsaXZlIGVsZW1lbnQsIGFydGJvYXJkLXNjb3BlZC4gUHJlZmVycyB0aGVcbiAqIGlkK2FydGJvYXJkSWQgc2NvcGVkIHNlbGVjdG9yICh0aGUgcm9idXN0IHBhdGgpLCB0aGVuIHRoZSBzdG9yZWQgYHNlbGVjdG9yYFxuICogKGFscmVhZHkgc2NvcGVkIGZvciByZWNlbnQgc2VsZWN0aW9uczsgYSBsZWdhY3kgZmFsbGJhY2sgZm9yIG9sZCBjb21tZW50cykuXG4gKiBFdmVyeSBoYWxvIC8gcGluIC8gdG9vbGJhciAvIHNwYWNpbmctaGFuZGxlIHJlc29sdmVyIHJvdXRlcyB0aHJvdWdoIHRoaXMgc28gYVxuICogc2hhcmVkIGNvbXBvbmVudCBhbmNob3JzIHRvIHRoZSBpbnN0YW5jZSB0aGUgdXNlciBhY3R1YWxseSBjbGlja2VkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVNlbGVjdGlvbkVsKFxuICBkb2M6IERvY3VtZW50LFxuICBzZWw6IHsgaWQ/OiBzdHJpbmcgfCBudWxsOyBzZWxlY3Rvcj86IHN0cmluZyB8IG51bGw7IGFydGJvYXJkSWQ/OiBzdHJpbmcgfCBudWxsOyBpbmRleD86IG51bWJlciB9XG4pOiBFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IGF0ID0gKHNlbGVjdG9yOiBzdHJpbmcpOiBFbGVtZW50IHwgbnVsbCA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGFsbCA9IGRvYy5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICAgIGlmICghYWxsLmxlbmd0aCkgcmV0dXJuIG51bGw7XG4gICAgICBjb25zdCBpID0gc2VsLmluZGV4ICYmIHNlbC5pbmRleCA+IDAgJiYgc2VsLmluZGV4IDwgYWxsLmxlbmd0aCA/IHNlbC5pbmRleCA6IDA7XG4gICAgICByZXR1cm4gYWxsW2ldID8/IGFsbFswXTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfTtcbiAgaWYgKHNlbC5pZCkge1xuICAgIGNvbnN0IGVsID0gYXQoc2NvcGVkQ2RTZWxlY3RvcihzZWwuaWQsIHNlbC5hcnRib2FyZElkKSk7XG4gICAgaWYgKGVsKSByZXR1cm4gZWw7XG4gIH1cbiAgaWYgKHNlbC5zZWxlY3RvcikgcmV0dXJuIGF0KHNlbC5zZWxlY3Rvcik7XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIExlbmd0aCBvZiB0aGUgdHJhaWxpbmcgcnVuIGBhYCBhbmQgYGJgIHNoYXJlLCB3YWxrZWQgZnJvbSB0aGUgZW5kLiBgZG9tUGF0aCgpYFxuICogaG9wcyBjYXJyeSBubyBwb3NpdGlvbmFsIChudGgtY2hpbGQpIGluZm8sIHNvIGEgc2hhcmVkIHN1ZmZpeCBzdXJ2aXZlcyBhXG4gKiBzaWJsaW5nIGluc2VydGlvbi9yZW1vdmFsIGFueXdoZXJlIGVhcmxpZXIgaW4gdGhlIHRyZWUg4oCUIGV4YWN0bHkgdGhlIEREUi0wMTlcbiAqIGBkYXRhLWNkLWlkYCByZW51bWJlcmluZyBjYXNlIHRoaXMgZmFsbGJhY2sgZXhpc3RzIGZvci5cbiAqL1xuZnVuY3Rpb24gbWF0Y2hpbmdTdWZmaXhMZW5ndGgoYTogc3RyaW5nW10sIGI6IHN0cmluZ1tdKTogbnVtYmVyIHtcbiAgbGV0IG4gPSAwO1xuICBjb25zdCBtYXggPSBNYXRoLm1pbihhLmxlbmd0aCwgYi5sZW5ndGgpO1xuICBmb3IgKGxldCBpID0gMTsgaSA8PSBtYXg7IGkrKykge1xuICAgIGlmIChhW2EubGVuZ3RoIC0gaV0gIT09IGJbYi5sZW5ndGggLSBpXSkgYnJlYWs7XG4gICAgbisrO1xuICB9XG4gIHJldHVybiBuO1xufVxuXG4vKipcbiAqIEJlc3QtZWZmb3J0IHN0cnVjdHVyYWwgZmFsbGJhY2sgZm9yIHdoZW4gYSBzdG9yZWQgYGRhdGEtY2QtaWRgIHNlbGVjdG9yIG5vXG4gKiBsb25nZXIgaWRlbnRpZmllcyB0aGUgaW50ZW5kZWQgZWxlbWVudC4gQSBjYW52YXMgcmV3cml0ZSAoYC9kZXNpZ246ZWRpdGBcbiAqIHJlZ2VuZXJhdGluZyBKU1gpIHJlbnVtYmVycyBgZGF0YS1jZC1pZGAg4oCUIGl0J3MgYW4gQVNULXBvc2l0aW9uIGZpbmdlcnByaW50LFxuICogbm90IGEgc3RhYmxlIGlkZW50aXR5IChERFItMDE5KSDigJQgc28gdGhlIGlkIGNhbiBlbmQgdXAgb24gYW4gdW5yZWxhdGVkXG4gKiBlbGVtZW50LCBvciBvbiBub25lIGF0IGFsbC4gVGhpcyBzY29yZXMgZXZlcnkgc3RhbXBlZCBlbGVtZW50IGluIHRoZVxuICogYXJ0Ym9hcmQgYnkgaG93IG11Y2ggb2YgaXRzIGxpdmUgYGRvbVBhdGgoKWAgbWF0Y2hlcyB0aGUgU1RPUkVEIHBhdGhcbiAqIChhcyBhIHRyYWlsaW5nIHJ1bikgcGx1cyBhdXRob3JlZC1jbGFzcyBvdmVybGFwLCBhbmQgcmVxdWlyZXMgdGhlIGxlYWYgdGFnXG4gKiB0byBtYXRjaC4gUmV0dXJucyBudWxsIHdoZW4gbm90aGluZyBzY29yZXMgYWJvdmUgemVybyAobm8gcGxhdXNpYmxlIG1hdGNoIOKAlFxuICogdGhlIGNhbGxlciBzaG91bGQgdHJlYXQgdGhlIHRhcmdldCBhcyBnb25lKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVCeURvbVBhdGgoXG4gIGRvYzogRG9jdW1lbnQsXG4gIG9wdHM6IHsgYXJ0Ym9hcmRJZD86IHN0cmluZyB8IG51bGw7IHRhZz86IHN0cmluZzsgY2xhc3Nlcz86IHN0cmluZzsgZG9tX3BhdGg/OiBzdHJpbmdbXSB9XG4pOiBFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHN0b3JlZFBhdGggPSBvcHRzLmRvbV9wYXRoO1xuICBjb25zdCB3YW50VGFnID0gKG9wdHMudGFnIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoIXN0b3JlZFBhdGggfHwgc3RvcmVkUGF0aC5sZW5ndGggPT09IDAgfHwgIXdhbnRUYWcpIHJldHVybiBudWxsO1xuICBsZXQgc2NvcGU6IFBhcmVudE5vZGUgPSBkb2M7XG4gIGlmIChvcHRzLmFydGJvYXJkSWQpIHtcbiAgICBjb25zdCBhcnRib2FyZCA9IGRvYy5xdWVyeVNlbGVjdG9yKGBbZGF0YS1kYy1zY3JlZW49XCIke29wdHMuYXJ0Ym9hcmRJZH1cIl1gKTtcbiAgICBpZiAoYXJ0Ym9hcmQpIHNjb3BlID0gYXJ0Ym9hcmQ7XG4gIH1cbiAgY29uc3Qgd2FudENsYXNzZXMgPSAob3B0cy5jbGFzc2VzIHx8ICcnKS5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKTtcbiAgbGV0IGJlc3Q6IEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGJlc3RTY29yZSA9IDA7XG4gIGZvciAoY29uc3QgZWwgb2YgQXJyYXkuZnJvbShzY29wZS5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1jZC1pZF0nKSkpIHtcbiAgICBpZiAoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpICE9PSB3YW50VGFnKSBjb250aW51ZTtcbiAgICBjb25zdCBzdWZmaXggPSBtYXRjaGluZ1N1ZmZpeExlbmd0aChkb21QYXRoKGVsKSwgc3RvcmVkUGF0aCk7XG4gICAgaWYgKHN1ZmZpeCA9PT0gMCkgY29udGludWU7XG4gICAgY29uc3QgbGl2ZUNsYXNzZXMgPSByZWFsQ2xhc3NlcyhlbCkuc3BsaXQoL1xccysvKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgY29uc3Qgb3ZlcmxhcCA9IHdhbnRDbGFzc2VzLmZpbHRlcigoYykgPT4gbGl2ZUNsYXNzZXMuaW5jbHVkZXMoYykpLmxlbmd0aDtcbiAgICBjb25zdCBzY29yZSA9IHN1ZmZpeCAqIDEwICsgb3ZlcmxhcDtcbiAgICBpZiAoc2NvcmUgPiBiZXN0U2NvcmUpIHtcbiAgICAgIGJlc3RTY29yZSA9IHNjb3JlO1xuICAgICAgYmVzdCA9IGVsO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYmVzdDtcbn1cblxuLyoqXG4gKiBQaGFzZSAxMi4yIOKAlCBzdHlsZSBtYXBzIGZvciB0aGUgQ1NTLWtub2IgcHJvcGVydGllcy4gYGF1dGhvcmVkYCBpcyB3aGF0IHRoZVxuICogZWxlbWVudCBzZXRzIElOTElORSAoUmVhY3QgcmVuZGVycyBgc3R5bGU9e3twYWRkaW5nOjh9fWAg4oaSIGBzdHlsZT1cInBhZGRpbmc6OHB4XCJgKSxcbiAqIHNvIHRoZSBrbm9iIHByZS1maWxscyB0aGUgRURJVEFCTEUgc291cmNlIHZhbHVlIGFuZCBpcyBibGFuayB3aGVuIHVuc2V0IOKAlCBub3RcbiAqIHRoZSBub2lzeSByZXNvbHZlZCBkZWZhdWx0IChgNjU2LjAwM3B4YCwgYHJnYigwLDAsMClgKS4gYGNvbXB1dGVkYCBpcyB0aGVcbiAqIHJlc29sdmVkIHZhbHVlLCBzaG93biBvbmx5IGFzIGEgZmFpbnQgcGxhY2Vob2xkZXIgaGludC4gRW1wdHkgZm9yIGEgZGV0YWNoZWRcbiAqIG5vZGUgLyBTU1IuXG4gKi9cbi8vIFBoYXNlIDEyLjMgKFcyLjIgZml4KSDigJQgRVZFUlkgcHJvcGVydHkgdGhlIENTUyBwYW5lbCBoYXMgYSBjb250cm9sIGZvciwgc28gZWFjaFxuLy8gcmVhZHMgYmFjayBpbnRvIGBhdXRob3JlZGAgKHByZS1maWxscyB0aGUgcmlnaHQgY29udHJvbCkgYW5kIGlzIGV4Y2x1ZGVkIGZyb21cbi8vIGBjdXN0b21TdHlsZXNgLiBUaGUgZWFybGllciBzaG9ydCBsaXN0IG9taXR0ZWQgdGhlIGJveC1tb2RlbCBMT05HSEFORFNcbi8vIChgcGFkZGluZy10b3BgLCBgbWFyZ2luLWxlZnRgLCDigKYpICsgdGhlIExheW91dC9ib3JkZXIgbG9uZ2hhbmRzLCBzbyBhIHZhbHVlIHRoZVxuLy8gcGFuZWwgd3JvdGUgKGUuZy4gYW4gYWx0LXNjcnViIGBwYWRkaW5nLXRvcGApIGZlbGwgdGhyb3VnaCB0byBjdXN0b21TdHlsZXMgYW5kXG4vLyB0aGUgYm94LW1vZGVsIHdpZGdldCBzaG93ZWQgaXQgYXMgYSBcImN1c3RvbSBDU1MgcHJvcGVydHlcIiBpbnN0ZWFkIG9mIGluIHRoZSBib3guXG5jb25zdCBLTk9CX1BST1BTID0gW1xuICAvLyBMYXlvdXRcbiAgJ2Rpc3BsYXknLFxuICAnZmxleC1kaXJlY3Rpb24nLFxuICAnZmxleC13cmFwJyxcbiAgJ2FsaWduLWl0ZW1zJyxcbiAgJ2p1c3RpZnktY29udGVudCcsXG4gICdnYXAnLFxuICAvLyBTdGFnZSBNIOKAlCBmbGV4LUNISUxEIHByb3BzIChzaXppbmcgbW9kZSBGaWxsICsgdGhlIEF1dG8tbGF5b3V0IGNoaWxkIHJvd3MpLlxuICAvLyBTaG93biBvbmx5IHdoZW4gdGhlIFBBUkVOVCBpcyBmbGV4IChTZWxlY3Rpb24ucGFyZW50RGlzcGxheSk7IGNhcHR1cmVkIGhlcmUgc29cbiAgLy8gdGhleSByb3VuZC10cmlwLiBgZmxleGAgc2hvcnRoYW5kIGlzIGxpc3RlZCBmb3IgY3VzdG9tU3R5bGVzLWV4Y2x1c2lvbiBvbmx5LlxuICAnZmxleCcsXG4gICdmbGV4LWdyb3cnLFxuICAnZmxleC1zaHJpbmsnLFxuICAnZmxleC1iYXNpcycsXG4gICdhbGlnbi1zZWxmJyxcbiAgLy8gVHlwb2dyYXBoeVxuICAnZm9udC1mYW1pbHknLFxuICAnY29sb3InLFxuICAnZm9udC1zaXplJyxcbiAgJ2ZvbnQtd2VpZ2h0JyxcbiAgJ2xpbmUtaGVpZ2h0JyxcbiAgJ2xldHRlci1zcGFjaW5nJyxcbiAgJ3RleHQtYWxpZ24nLFxuICAvLyBTcGFjaW5nIOKAlCBzaG9ydGhhbmQgKGZvciBjdXN0b21TdHlsZXMgZXhjbHVzaW9uICsgd2hvbGUtc2lkZSBhdXRob3JpbmcpIEFORFxuICAvLyB0aGUgOCBsb25naGFuZHMgdGhlIGJveC1tb2RlbCB3aWRnZXQgYWN0dWFsbHkgcmVhZHMvd3JpdGVzLlxuICAnbWFyZ2luJyxcbiAgJ21hcmdpbi10b3AnLFxuICAnbWFyZ2luLXJpZ2h0JyxcbiAgJ21hcmdpbi1ib3R0b20nLFxuICAnbWFyZ2luLWxlZnQnLFxuICAncGFkZGluZycsXG4gICdwYWRkaW5nLXRvcCcsXG4gICdwYWRkaW5nLXJpZ2h0JyxcbiAgJ3BhZGRpbmctYm90dG9tJyxcbiAgJ3BhZGRpbmctbGVmdCcsXG4gIC8vIFNpemVcbiAgJ3dpZHRoJyxcbiAgJ2hlaWdodCcsXG4gICdtaW4td2lkdGgnLFxuICAnbWluLWhlaWdodCcsXG4gICdtYXgtd2lkdGgnLFxuICAnbWF4LWhlaWdodCcsXG4gIC8vIEFwcGVhcmFuY2VcbiAgJ2JhY2tncm91bmQtY29sb3InLFxuICAnYm9yZGVyLXJhZGl1cycsXG4gICdib3JkZXItdG9wLWxlZnQtcmFkaXVzJyxcbiAgJ2JvcmRlci10b3AtcmlnaHQtcmFkaXVzJyxcbiAgJ2JvcmRlci1ib3R0b20tbGVmdC1yYWRpdXMnLFxuICAnYm9yZGVyLWJvdHRvbS1yaWdodC1yYWRpdXMnLFxuICAnYm9yZGVyLXdpZHRoJyxcbiAgJ2JvcmRlci1zdHlsZScsXG4gICdib3JkZXItY29sb3InLFxuICAnYm94LXNoYWRvdycsXG4gICdvcGFjaXR5JyxcbiAgLy8gZmVhdHVyZS1lbGVtZW50LWVkaXRpbmctcm9idXN0bmVzcyBTdGFnZSBCIOKAlCBwcm9tb3RlcyBERFItMTA0IMKnMydzIE9VVC1saXN0XG4gIC8vIGludG8gY3VyYXRlZCByb3dzIChzdXBlcnNlZGVkIGJ5IHRoZSBTdGFnZS1HIEREUikuIEFkZGluZyB0aGVtIGhlcmUgY2FwdHVyZXNcbiAgLy8gdGhlaXIgYXV0aG9yZWQvY29tcHV0ZWQgdmFsdWVzIGZvciB0aGUgbmV3IHBhbmVsIGNvbnRyb2xzIEFORCBtb3ZlcyB0aGVtIG91dFxuICAvLyBvZiB0aGUgQWR2YW5jZWQgXCJjdXN0b21TdHlsZXNcIiBoYXRjaCAoYSBjYW52YXMgdGhhdCBjYXJyaWVkIG9uZSBhcyBhIHJhd1xuICAvLyBjdXN0b20gcHJvcCBub3cgc3VyZmFjZXMgaXQgaW4gaXRzIGN1cmF0ZWQgcm93IGluc3RlYWQpLlxuICAvLyBQb3NpdGlvbiArIHN0YWNraW5nXG4gICdwb3NpdGlvbicsXG4gICd0b3AnLFxuICAncmlnaHQnLFxuICAnYm90dG9tJyxcbiAgJ2xlZnQnLFxuICAnei1pbmRleCcsXG4gIC8vIFRyYW5zZm9ybVxuICAndHJhbnNmb3JtJyxcbiAgJ3RyYW5zZm9ybS1vcmlnaW4nLFxuICAvLyBUeXBvZ3JhcGh5IChleHRyYSlcbiAgJ2ZvbnQtc3R5bGUnLFxuICAndGV4dC10cmFuc2Zvcm0nLFxuICAndGV4dC1kZWNvcmF0aW9uJyxcbiAgJ3doaXRlLXNwYWNlJyxcbiAgLy8gT3ZlcmZsb3dcbiAgJ292ZXJmbG93JyxcbiAgLy8gTWVkaWEgZnJhbWluZ1xuICAnb2JqZWN0LWZpdCcsXG4gICdhc3BlY3QtcmF0aW8nLFxuICAnb2JqZWN0LXBvc2l0aW9uJyxcbl0gYXMgY29uc3Q7XG5cbi8vIFBoYXNlIDEyLjMg4oCUIEhUTUwgYXR0cmlidXRlcyB0aGUgY3VzdG9tLWF0dHJpYnV0ZSBoYXRjaCBtYXkgaGF2ZSB3cml0dGVuLCBzbyBhXG4vLyBqdXN0LWFkZGVkIGBkYXRhLSpgL2BhcmlhLSpgL2Byb2xlYC9gdGl0bGVgIHJvdW5kLXRyaXBzIGJhY2sgaW50byBhIHBhbmVsIHJvdy5cbi8vIEV4Y2x1ZGVzIHRoZSBzdHJ1Y3R1cmFsIG9uZXMgdGhlIHBhbmVsIG1hbmFnZXMgZWxzZXdoZXJlIChzdHlsZSwgY2xhc3MsXG4vLyBkYXRhLWNkLWlkIHBpcGVsaW5lIGFuY2hvciwgdGhlIGRhdGEtZGMtKiBjYW52YXMgY2hyb21lIG1hcmtlcnMpLlxuY29uc3QgQVRUUl9TS0lQID0gL14oc3R5bGV8Y2xhc3N8ZGF0YS1jZC1pZHxkYXRhLWRjLXxkYXRhLWRjaWQkKS87XG5cbmZ1bmN0aW9uIHN0eWxlTWFwc0ZvcihlbDogRWxlbWVudCB8IG51bGwpOiB7XG4gIGF1dGhvcmVkOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBjb21wdXRlZDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgY3VzdG9tU3R5bGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBhdHRyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgcGFyZW50RGlzcGxheT86IHN0cmluZztcbiAgcGFyZW50RmxleERpcmVjdGlvbj86IHN0cmluZztcbn0ge1xuICBpZiAoIWVsIHx8IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnIHx8ICF3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSkge1xuICAgIHJldHVybiB7IGF1dGhvcmVkOiB7fSwgY29tcHV0ZWQ6IHt9LCBjdXN0b21TdHlsZXM6IHt9LCBhdHRyczoge30gfTtcbiAgfVxuICB0cnkge1xuICAgIGNvbnN0IGlubGluZSA9IChlbCBhcyBIVE1MRWxlbWVudCkuc3R5bGU7XG4gICAgY29uc3QgY3MgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCBhcyBIVE1MRWxlbWVudCk7XG4gICAgY29uc3QgYXV0aG9yZWQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICBjb25zdCBjb21wdXRlZDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGNvbnN0IGtub2IgPSBuZXcgU2V0PHN0cmluZz4oS05PQl9QUk9QUyBhcyByZWFkb25seSBzdHJpbmdbXSk7XG4gICAgLy8gQ3VyYXRlZCBrbm9iIHByb3BzOiBhdXRob3JlZCB2YWx1ZSAoa25vYiBwcmUtZmlsbCkgKyBjb21wdXRlZCAocGxhY2Vob2xkZXIpLlxuICAgIGZvciAoY29uc3QgcCBvZiBLTk9CX1BST1BTKSB7XG4gICAgICBjb25zdCBhID0gaW5saW5lLmdldFByb3BlcnR5VmFsdWUocCk7XG4gICAgICBpZiAoYSkgYXV0aG9yZWRbcF0gPSBhLnRyaW0oKTtcbiAgICAgIGNvbnN0IGMgPSBjcy5nZXRQcm9wZXJ0eVZhbHVlKHApO1xuICAgICAgaWYgKGMpIGNvbXB1dGVkW3BdID0gYy50cmltKCk7XG4gICAgfVxuICAgIC8vIEV2ZXJ5IE9USEVSIGF1dGhvcmVkIGlubGluZSBwcm9wZXJ0eSDihpIgY3VzdG9tU3R5bGVzLCBzbyB0aGUgcGFuZWwgY2FuIHNob3dcbiAgICAvLyBhIGN1c3RvbSBDU1MgcHJvcGVydHkgdGhlIHVzZXIgYWRkZWQgdGhhdCBubyBjdXJhdGVkIHJvdyBjb3ZlcnMuIEVYQ0xVREVcbiAgICAvLyB0aGUgcGFuZWwtbWFuYWdlZCBGQU1JTElFUyB3aG9sZXNhbGU6IHNldHRpbmcgYGJvcmRlcmAvYGJvcmRlci1yYWRpdXNgIChvclxuICAgIC8vIHRoZWlyIDMtd2F5IHNob3J0aGFuZHMpIG1ha2VzIHRoZSBDU1NPTSBleHBhbmQgdGhlbSB0byB0aGUgcGVyLXNpZGVcbiAgICAvLyBsb25naGFuZHMg4oCUIGBib3JkZXItdG9wLXdpZHRoYCwgYGJvcmRlci1sZWZ0LWNvbG9yYCwg4oCmIOKAlCB3aGljaCB0aGUgcGFuZWxcbiAgICAvLyBjb250cm9scyBidXQgY2FuJ3QgZW51bWVyYXRlIGluIHRoZSBrbm9iIHNldC4gV2l0aG91dCB0aGUgZmFtaWx5IGd1YXJkIHRoZXlcbiAgICAvLyBsZWFrIGludG8gXCJjdXN0b20gQ1NTIHByb3BlcnRpZXNcIiAodGhlIHNhbWUgY2xhc3Mgb2YgYnVnIGZpeGVkIGZvciBzcGFjaW5nKS5cbiAgICBjb25zdCBNQU5BR0VEX0ZBTUlMWSA9IC9eKG1hcmdpbnxwYWRkaW5nfGJvcmRlcikoLXwkKS87XG4gICAgY29uc3QgY3VzdG9tU3R5bGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbmxpbmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHAgPSBpbmxpbmUuaXRlbShpKTtcbiAgICAgIGlmICghcCB8fCBrbm9iLmhhcyhwKSB8fCBNQU5BR0VEX0ZBTUlMWS50ZXN0KHApKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHYgPSBpbmxpbmUuZ2V0UHJvcGVydHlWYWx1ZShwKTtcbiAgICAgIGlmICh2KSBjdXN0b21TdHlsZXNbcF0gPSB2LnRyaW0oKTtcbiAgICB9XG4gICAgLy8gQ3VzdG9tIEhUTUwgYXR0cmlidXRlcyAodGhlIGVzY2FwZS1oYXRjaCBzdXJmYWNlKS5cbiAgICBjb25zdCBhdHRyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGZvciAoY29uc3QgYSBvZiBBcnJheS5mcm9tKChlbCBhcyBIVE1MRWxlbWVudCkuYXR0cmlidXRlcykpIHtcbiAgICAgIGlmIChBVFRSX1NLSVAudGVzdChhLm5hbWUpKSBjb250aW51ZTtcbiAgICAgIGF0dHJzW2EubmFtZV0gPSBhLnZhbHVlO1xuICAgIH1cbiAgICAvLyBTdGFnZSBNIOKAlCBwYXJlbnQncyBsYXlvdXQgY29udGV4dCAoZm9yIHRoZSBGaXhlZC9IdWcvRmlsbCBzaXppbmcgY29udHJvbCArXG4gICAgLy8gZmxleC1jaGlsZCByb3cgZ2F0aW5nKS4gUmVhZCBoZXJlIGJlY2F1c2UgdGhlIHNoZWxsIGNhbid0IHJlYWNoIHRoZVxuICAgIC8vIGNyb3NzLW9yaWdpbiBpZnJhbWUgdG8gY29tcHV0ZSBpdCBhZnRlciBzZWxlY3Rpb24uXG4gICAgY29uc3QgcGFyZW50ID0gKGVsIGFzIEhUTUxFbGVtZW50KS5wYXJlbnRFbGVtZW50O1xuICAgIGNvbnN0IHBhcmVudERpc3BsYXkgPSBwYXJlbnQgPyB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShwYXJlbnQpLmRpc3BsYXkgOiAnJztcbiAgICBjb25zdCBwYXJlbnRGbGV4RGlyZWN0aW9uID1cbiAgICAgIHBhcmVudCAmJiAocGFyZW50RGlzcGxheSA9PT0gJ2ZsZXgnIHx8IHBhcmVudERpc3BsYXkgPT09ICdpbmxpbmUtZmxleCcpXG4gICAgICAgID8gd2luZG93LmdldENvbXB1dGVkU3R5bGUocGFyZW50KS5mbGV4RGlyZWN0aW9uXG4gICAgICAgIDogJyc7XG4gICAgcmV0dXJuIHsgYXV0aG9yZWQsIGNvbXB1dGVkLCBjdXN0b21TdHlsZXMsIGF0dHJzLCBwYXJlbnREaXNwbGF5LCBwYXJlbnRGbGV4RGlyZWN0aW9uIH07XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiB7IGF1dGhvcmVkOiB7fSwgY29tcHV0ZWQ6IHt9LCBjdXN0b21TdHlsZXM6IHt9LCBhdHRyczoge30gfTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaG92ZXJUYXJnZXRUb1NlbGVjdGlvbih0YXJnZXQ6IEhvdmVyVGFyZ2V0LCBmaWxlPzogc3RyaW5nKTogU2VsZWN0aW9uIHtcbiAgY29uc3QgZWwgPSB0YXJnZXQuZWw7XG4gIGNvbnN0IHJlY3QgPVxuICAgIGVsICYmIChlbCBhcyBIVE1MRWxlbWVudCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0XG4gICAgICA/IChlbCBhcyBIVE1MRWxlbWVudCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgICAgIDogbnVsbDtcbiAgLy8gYGNkSWRgIGlzIHRoZSBoaXQgZWxlbWVudCdzIE9XTiBkYXRhLWNkLWlkIChkZWVwIG1vZGUpOyByZXNvbHZlciBuZXZlclxuICAvLyBjbGltYnMgdG8gYW4gYW5jZXN0b3IuIEZhbGxzIGJhY2sgdG8gY3NzUGF0aCBvZiB0aGUgaGl0IHdoZW4gbm8gc3RhYmxlXG4gIC8vIGFuY2hvciBleGlzdHMuXG4gIGNvbnN0IGNkSWQgPSB0YXJnZXQuY2RJZDtcbiAgLy8gU2VsZWN0b3IgcmVzb2x1dGlvbiBvcmRlcjpcbiAgLy8gICAxLiBkYXRhLWNkLWlkIGFuY2hvciDigJQgc3RhYmxlIHBpcGVsaW5lLXN0YW1wZWQgaWQgKHByZWZlcnJlZCkuIFNDT1BFRCBieVxuICAvLyAgICAgIHRoZSBoaXQncyBhcnRib2FyZCAoYFtkYXRhLWRjLXNjcmVlbj3igKZdIFtkYXRhLWNkLWlkPeKApl1gKSDigJQgYSBjb21wb25lbnRcbiAgLy8gICAgICBzaGFyZWQgYWNyb3NzIGFydGJvYXJkcyBjYXJyaWVzIHRoZSBTQU1FIGRhdGEtY2QtaWQgaW4gZWFjaCwgc28gYW5cbiAgLy8gICAgICB1bnNjb3BlZCBgW2RhdGEtY2QtaWRdYCBzZWxlY3RvciByZXNvbHZlcyAodmlhIHF1ZXJ5U2VsZWN0b3IpIHRvIHRoZVxuICAvLyAgICAgIEZJUlNUIGFydGJvYXJkJ3MgaW5zdGFuY2UgYW5kIHRoZSBwaW4vc2VsZWN0IGxhbmRzIG9uIHRoZSB3cm9uZyBib2FyZC5cbiAgLy8gICAgICBQcmVmaXhpbmcgdGhlIGFydGJvYXJkIG1ha2VzIHRoZSBhbmNob3IgcGVyLWluc3RhbmNlLlxuICAvLyAgIDIuIGRhdGEtZGMtc2NyZWVuIOKAlCBjaHJvbWUgY2xpY2sgcHJvbW90ZWQgdG8gd2hvbGUtYXJ0Ym9hcmQgc2VsZWN0XG4gIC8vICAgICAgKFQyNC41IEc4IG11bHRpLWFydGJvYXJkIGdlc3R1cmUpLlxuICAvLyAgIDMuIGNzc1BhdGggb2YgdGhlIGhpdCDigJQgbGFzdC1yZXNvcnQgcGF0aCBzdHJpbmcuXG4gIGNvbnN0IHNlbGVjdG9yID0gY2RJZFxuICAgID8gc2NvcGVkQ2RTZWxlY3RvcihjZElkLCB0YXJnZXQuYXJ0Ym9hcmRJZClcbiAgICA6IHRhcmdldC5hcnRib2FyZElkXG4gICAgICA/IGBbZGF0YS1kYy1zY3JlZW49XCIke3RhcmdldC5hcnRib2FyZElkfVwiXWBcbiAgICAgIDogY3NzUGF0aChlbCk7XG4gIC8vIERpc2FtYmlndWF0ZSByZXBlYXRlZCBpbnN0YW5jZXMgd2l0aGluIHRoZSBzYW1lIGFydGJvYXJkIChsaXN0IHJvd3MsIGFcbiAgLy8gcmV1c2FibGUgdXNlZCB0d2ljZSkg4oCUIHRoZSBpbmRleCBpcyB3aGljaCBgcXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcilgXG4gIC8vIG1hdGNoIHRoaXMgZWxlbWVudCBpcy4gY3NzUGF0aCBpcyBhbHJlYWR5IHVuaXF1ZSwgc28gMCB0aGVyZS5cbiAgY29uc3QgaW5kZXggPSBjZElkICYmIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgPyBzZWxlY3RvckluZGV4KGRvY3VtZW50LCBzZWxlY3RvciwgZWwpIDogMDtcbiAgcmV0dXJuIHtcbiAgICBmaWxlOiBmaWxlID8/IGRlcml2ZUZpbGUoKSxcbiAgICBpZDogY2RJZCA/PyB1bmRlZmluZWQsXG4gICAgc2VsZWN0b3IsXG4gICAgYXJ0Ym9hcmRJZDogdGFyZ2V0LmFydGJvYXJkSWQsXG4gICAgaW5kZXgsXG4gICAgdGFnOiBlbD8udGFnTmFtZS50b0xvd2VyQ2FzZSgpID8/ICcnLFxuICAgIGNsYXNzZXM6IHJlYWxDbGFzc2VzKGVsKSxcbiAgICB0ZXh0OiBzaG9ydFRleHQoZWwsIDI0MCksXG4gICAgZG9tX3BhdGg6IGRvbVBhdGgoZWwpLFxuICAgIGJvdW5kczogcmVjdFxuICAgICAgPyB7XG4gICAgICAgICAgeDogTWF0aC5yb3VuZChyZWN0LmxlZnQpLFxuICAgICAgICAgIHk6IE1hdGgucm91bmQocmVjdC50b3ApLFxuICAgICAgICAgIHc6IE1hdGgucm91bmQocmVjdC53aWR0aCksXG4gICAgICAgICAgaDogTWF0aC5yb3VuZChyZWN0LmhlaWdodCksXG4gICAgICAgIH1cbiAgICAgIDogbnVsbCxcbiAgICAvLyBXT1JMRC11bml0IHNpemUg4oCUIGBvZmZzZXRXaWR0aGAvYG9mZnNldEhlaWdodGAgYXJlIHRoZSBlbGVtZW50J3Mgb3duIGxvY2FsXG4gICAgLy8gcGl4ZWwgYm94LCB1bmFmZmVjdGVkIGJ5IGFuIGFuY2VzdG9yJ3MgYC5kYy13b3JsZGAgem9vbSB0cmFuc2Zvcm0gKHVubGlrZVxuICAgIC8vIGBib3VuZHNgLCB3aGljaCBpcyB0aGUgU0NSRUVOIHJlY3QgYW5kIGxpZXMgYXQgYW55IHpvb20gb3RoZXIgdGhhbiAxMDAlKS5cbiAgICAvLyBUaGUgSW5zcGVjdG9yJ3MgYXJ0Ym9hcmQtcmVzaXplIGZpZWxkcyAoU3RhZ2UgRDQgdGFpbCkgbmVlZCB0aGUgdHJ1ZVxuICAgIC8vIEpTWC1hdXRob3JlZCB3aWR0aC9oZWlnaHQgdG8gcHJlLWZpbGwgY29ycmVjdGx5IHJlZ2FyZGxlc3Mgb2Ygem9vbS5cbiAgICB3b3JsZFc6IGVsIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgPyBNYXRoLnJvdW5kKGVsLm9mZnNldFdpZHRoKSA6IHVuZGVmaW5lZCxcbiAgICB3b3JsZEg6IGVsIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgPyBNYXRoLnJvdW5kKGVsLm9mZnNldEhlaWdodCkgOiB1bmRlZmluZWQsXG4gICAgaHRtbDogZWwgPyAoZWwub3V0ZXJIVE1MID8/ICcnKS5zbGljZSgwLCA0MDAwKSA6ICcnLFxuICAgIC8vIGZlYXR1cmUtcGhvdG8tZWRpdG9yIChUYXNrIDE0KSDigJQgZmxhZyBhIGNvbnRlbnQtYWRkcmVzc2VkIGFydGJvYXJkIGA8aW1nPmBcbiAgICAvLyBzbyB0aGUgSW5zcGVjdG9yIGNhbiBvZmZlciB0aGUgUGhvdG8gdGFiLiBPbmx5IGEgcmVhbCBgYXNzZXRzLzxzaGE4Pi48ZXh0PmBcbiAgICAvLyBzcmMgcXVhbGlmaWVzIChhbiBleHRlcm5hbCBVUkwgLyBTVkcgaWNvbiAvIGRhdGE6IFVSSSBoYXMgbm8gc2lkZWNhcikuXG4gICAgLy8gYGRhdGEtcGhvdG8tYXNzZXRgIChzdGFtcGVkIGJ5IGNhbnZhcy1saWIncyBQaG90b1ByZXZpZXdCcmlkZ2UgdGhlIGZpcnN0XG4gICAgLy8gdGltZSBpdCBiYWtlcyBhbiBlZGl0IGludG8gdGhpcyBlbGVtZW50KSBpcyBjaGVja2VkIEZJUlNUIOKAlCBvbmNlIGFuIGVkaXRcbiAgICAvLyBpcyBhcHBsaWVkLCB0aGUgbGl2ZSBgc3JjYCBpcyBhIGBkYXRhOmAgVVJMICh0aGUgYmFrZWQgY29tcG9zaXRlKSwgd2hpY2hcbiAgICAvLyBubyBsb25nZXIgbWF0Y2hlcyB0aGUgYXNzZXQgcmVnZXguIFdpdGhvdXQgdGhpcywgYW4gYWxyZWFkeS1lZGl0ZWQgcGhvdG9cbiAgICAvLyB3b3VsZCBsb3NlIGl0cyBQaG90byB0YWIgdGhlIG1vbWVudCB5b3Ugc2VsZWN0IGl0ICh0aGUgZXhhY3QgcmVncmVzc2lvblxuICAgIC8vIHRoaXMgZml4ZXMg4oCUIHRoZSBicmlkZ2UncyBvd24gZGlyZWN0LXNyYy1zd2FwIG1hZGUgdGhlIGVsZW1lbnQncyBgc3JjYFxuICAgIC8vIHN0b3AgYmVpbmcgYSByZWxpYWJsZSBhc3NldCBrZXkpLlxuICAgIC4uLigoKSA9PiB7XG4gICAgICBpZiAoZWw/LnRhZ05hbWU/LnRvTG93ZXJDYXNlKCkgIT09ICdpbWcnKSByZXR1cm4ge307XG4gICAgICAvLyBUaGUgY2FudmFzIGlmcmFtZSBpcyB1bnRydXN0ZWQgY29udGVudCAoRERSLTA1NCkg4oCUIGFuIGF1dGhvcmVkIGA8aW1nXG4gICAgICAvLyBkYXRhLXBob3RvLWFzc2V0PVwiLi4uXCI+YCBpcyBhdHRhY2tlci1jb250cm9sbGFibGUsIHNvIHRoZSB0YWcgaXMgb25seVxuICAgICAgLy8gdHJ1c3RlZCB3aGVuIGl0IGFjdHVhbGx5IGhhcyB0aGUgYGFzc2V0cy88c2hhOD4uPGV4dD5gIHNoYXBlIChzZWN1cml0eVxuICAgICAgLy8gcmV2aWV3IGZpbmRpbmc6IGFuIHVuc2hhcGVkIHZhbHVlIHdvdWxkIHJpZGUgdW5ib3VuZGVkIGludG9cbiAgICAgIC8vIGBfYWN0aXZlLmpzb25gL3RoZSBXUyBicm9hZGNhc3QgdmlhIGluc3BlY3QudHMncyBgZW5yaWNoKClgKS5cbiAgICAgIGNvbnN0IGFzc2V0UmUgPSAvYXNzZXRzXFwvWzAtOWEtZl17OH1cXC5bYS16MC05XSsvaTtcbiAgICAgIGNvbnN0IHRhZ2dlZCA9IChlbCBhcyBIVE1MRWxlbWVudCkuZ2V0QXR0cmlidXRlPy4oJ2RhdGEtcGhvdG8tYXNzZXQnKTtcbiAgICAgIGlmICh0YWdnZWQgJiYgYXNzZXRSZS50ZXN0KHRhZ2dlZCkpXG4gICAgICAgIHJldHVybiB7IHBob3RvS2luZDogJ2FydGJvYXJkLWltZycgYXMgY29uc3QsIHBob3RvQXNzZXQ6IHRhZ2dlZCB9O1xuICAgICAgY29uc3Qgc3JjID0gKGVsIGFzIEhUTUxJbWFnZUVsZW1lbnQpLmdldEF0dHJpYnV0ZT8uKCdzcmMnKSB8fCAnJztcbiAgICAgIGNvbnN0IG0gPSBhc3NldFJlLmV4ZWMoc3JjKTtcbiAgICAgIHJldHVybiBtID8geyBwaG90b0tpbmQ6ICdhcnRib2FyZC1pbWcnIGFzIGNvbnN0LCBwaG90b0Fzc2V0OiBtWzBdIH0gOiB7fTtcbiAgICB9KSgpLFxuICAgIC4uLnN0eWxlTWFwc0ZvcihlbCksXG4gIH07XG59XG4iLAogICAgIi8qKlxuICogQGZpbGUgICAgICAgdXNlLWNvbGxhYi50c3gg4oCUIGNsaWVudC1zaWRlIFlqcyBjb2xsYWIgcHJvdmlkZXIgZm9yIGNhbnZhcyBpZnJhbWVzXG4gKiBAc2NvcGUgICAgICBhcHBzL3N0dWRpby91c2UtY29sbGFiLnRzeFxuICogQHB1cnBvc2UgICAgTW91bnRzIGEgc2luZ2xlIFkuRG9jICsgQXdhcmVuZXNzIHBlciBjYW52YXMgaWZyYW1lLiBPcGVucyBhXG4gKiAgICAgICAgICAgICBXZWJTb2NrZXQgdG8gYC9fd3MvY29sbGFiLzpzbHVnYCwgc3BlYWtzIHRoZSB5LXdlYnNvY2tldCBiaW5hcnlcbiAqICAgICAgICAgICAgIHByb3RvY29sLCBleHBvc2VzIGhvb2tzIGZvciB0aGUgY3Vyc29yIG92ZXJsYXkgKyBUYXNrIDMgY29tbWVudHNcbiAqICAgICAgICAgICAgIGJpbmRpbmcuXG4gKlxuICogQm91bmRhcnk6XG4gKiAgIC0gU2VydmVyLXNpZGUgZXF1aXZhbGVudCBpcyBgY29sbGFiL3Byb3RvY29sLnRzYCArIGBjb2xsYWIvcm9vbS50c2AuXG4gKiAgIC0gVGhpcyBmaWxlIG1pcnJvcnMgdGhlIG1lc3NhZ2UgZnJhbWluZyAodmFyaW50LXByZWZpeGVkIHN5bmMgKyBhd2FyZW5lc3NcbiAqICAgICBmcmFtZXMpIHNvIHRoZSB0d28gc2lkZXMgY29udmVyZ2Ugb3ZlciBhIGJpbmFyeSBXUyB3aXRob3V0IGludGVybWVkaWF0ZVxuICogICAgIEpTT04uXG4gKiAgIC0gSW1wb3J0cyBgeWpzYCArIGB5LXByb3RvY29scy97c3luYyxhd2FyZW5lc3N9YCB2aWEgdGhlIGNhbnZhcy1zaGVsbFxuICogICAgIGltcG9ydG1hcCAoUlVOVElNRV9QQUNLQUdFUyBhZGRpdGlvbnMpLiBDYW52YXMgYnVuZGxlcyB0aGF0IGRvbid0IG1vdW50XG4gKiAgICAgPENvbGxhYlByb3ZpZGVyPiBuZXZlciByZXNvbHZlIHRoZXNlIHNwZWNpZmllcnMgYW5kIHBheSB6ZXJvIGJ1bmRsZSBjb3N0LlxuICovXG5cbmltcG9ydCAqIGFzIGRlY29kaW5nIGZyb20gJ2xpYjAvZGVjb2RpbmcnO1xuaW1wb3J0ICogYXMgZW5jb2RpbmcgZnJvbSAnbGliMC9lbmNvZGluZyc7XG5pbXBvcnQge1xuICBjcmVhdGVDb250ZXh0LFxuICB0eXBlIFJlYWN0Tm9kZSxcbiAgdXNlQ2FsbGJhY2ssXG4gIHVzZUNvbnRleHQsXG4gIHVzZUVmZmVjdCxcbiAgdXNlTWVtbyxcbiAgdXNlUmVkdWNlcixcbiAgdXNlUmVmLFxuICB1c2VTdGF0ZSxcbn0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgQXdhcmVuZXNzLCBhcHBseUF3YXJlbmVzc1VwZGF0ZSwgZW5jb2RlQXdhcmVuZXNzVXBkYXRlIH0gZnJvbSAneS1wcm90b2NvbHMvYXdhcmVuZXNzJztcbmltcG9ydCB7IHJlYWRTeW5jTWVzc2FnZSwgd3JpdGVTeW5jU3RlcDEsIHdyaXRlVXBkYXRlIH0gZnJvbSAneS1wcm90b2NvbHMvc3luYyc7XG5pbXBvcnQgKiBhcyBZIGZyb20gJ3lqcyc7XG5cbmNvbnN0IE1FU1NBR0VfU1lOQyA9IDA7XG5jb25zdCBNRVNTQUdFX0FXQVJFTkVTUyA9IDE7XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29sb3IgaGFzaCDigJQgc3RhYmxlIHBlciBwZWVyIGlkZW50aXR5LlxuXG4vKipcbiAqIGRqYjIgc3RyaW5nIGhhc2gg4oaSIE9LTENIIGNvbG9yIGluIGEgY3VyYXRlZCBwYWxldHRlLiBEZXRlcm1pbmlzbSBwZXJcbiAqIGlucHV0IG5hbWUgaXMgdGhlIGxvYWQtYmVhcmluZyBwcm9wZXJ0eTogZXZlcnkgcGVlciBoYXNoaW5nIFwiQWxpY2VcIiBtdXN0XG4gKiBsYW5kIG9uIHRoZSBTQU1FIGNvbG9yLlxuICpcbiAqIERTIGNvbnRyYWN0IChjb2xvcnMtcHJlc2VuY2Ugc3BlY2ltZW4pOiB0aGUgQUkgYWdlbnQgcmlkZXNcbiAqIGAtLXByZXNlbmNlLWFnZW50YCAodmlvbGV0LW1hZ2VudGEsIGh1ZSAzMjIpIOKAlCBcImEgaHVlIG5vIGh1bWFuIHN0YXRlIHVzZXMsXG4gKiBzbyBhdHRyaWJ1dGlvbiBvbiBhIHNoYXJlZCBjYW52YXMgaXMgdW5hbWJpZ3VvdXNcIi4gSHVtYW4gaHVlcyB0aGVyZWZvcmVcbiAqIEVYQ0xVREUgdGhlIGFnZW50IGJhbmQgKH4yOTLigJMzNTIpIEFORCB0aGUgYWNjZW50IGluZGlnbyBiYW5kICh+MjQ14oCTMjkwLFxuICogcmVzZXJ2ZWQgZm9yIHNlbGVjdGlvbi9hY3RpdmUpLiBML0MgbWF0Y2ggdGhlIERTIHByZXNlbmNlIHRva2Vuc1xuICogKG9rbGNoIOKJiDAuNzQgMC4xNikgc28gZXZlcnkgY3Vyc29yIHJlYWRzIGF0IHRoZSBzYW1lIHdlaWdodCBvbiBib3RoIHRoZW1lcy5cbiAqL1xuY29uc3QgQ09MT1JfUEFMRVRURSA9IFtcbiAgJ29rbGNoKDAuNzAgMC4xNyAxMiknLCAvLyByb3NlXG4gICdva2xjaCgwLjcyIDAuMTYgNDApJywgLy8gY29yYWxcbiAgJ29rbGNoKDAuNzggMC4xNSA3OCknLCAvLyBhbWJlciAgKHByZXNlbmNlLWF3YXkgaHVlKVxuICAnb2tsY2goMC43NiAwLjE2IDEwOCknLCAvLyBsaW1lXG4gICdva2xjaCgwLjc0IDAuMTYgMTQ1KScsIC8vIGdyZWVuICAocHJlc2VuY2Utb25saW5lIGh1ZSlcbiAgJ29rbGNoKDAuNzUgMC4xNCAxNzIpJywgLy8gdGVhbFxuICAnb2tsY2goMC43MyAwLjEzIDIwMCknLCAvLyBjeWFuXG4gICdva2xjaCgwLjcyIDAuMTMgMjM4KScsIC8vIGJsdWUgICAoc3RhdHVzLWluZm8gaHVlKVxuXSBhcyBjb25zdDtcblxuLyoqIFRoZSBBSSBhZ2VudCdzIGV4Y2x1c2l2ZSBjdXJzb3IvYXZhdGFyIGh1ZSDigJQgYC0tcHJlc2VuY2UtYWdlbnRgLiAqL1xuZXhwb3J0IGNvbnN0IEFHRU5UX0NPTE9SID0gJ29rbGNoKDAuNzAwIDAuMTkwIDMyMiknO1xuXG5leHBvcnQgZnVuY3Rpb24gY29sb3JGb3JOYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIENPTE9SX1BBTEVUVEUgaXMgYSBub24tZW1wdHkgY29uc3QgdHVwbGU7IHRoZSBleHBsaWNpdCBgPz8gJyMwMDAnYFxuICAvLyBmYWxsYmFjayBpcyB1bnJlYWNoYWJsZSBidXQgc2F0aXNmaWVzIGBub1VuY2hlY2tlZEluZGV4ZWRBY2Nlc3NgLlxuICBjb25zdCBGQUxMQkFDSyA9ICcjMDAwMDAwJztcbiAgaWYgKCFuYW1lKSByZXR1cm4gQ09MT1JfUEFMRVRURVswXSA/PyBGQUxMQkFDSztcbiAgbGV0IGhhc2ggPSA1MzgxO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5hbWUubGVuZ3RoOyBpKyspIHtcbiAgICBoYXNoID0gKChoYXNoIDw8IDUpICsgaGFzaCArIG5hbWUuY2hhckNvZGVBdChpKSkgfCAwO1xuICB9XG4gIGNvbnN0IGlkeCA9ICgoaGFzaCAlIENPTE9SX1BBTEVUVEUubGVuZ3RoKSArIENPTE9SX1BBTEVUVEUubGVuZ3RoKSAlIENPTE9SX1BBTEVUVEUubGVuZ3RoO1xuICByZXR1cm4gQ09MT1JfUEFMRVRURVtpZHhdID8/IEZBTExCQUNLO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEF3YXJlbmVzcyBzdGF0ZSBzaGFwZS5cblxuZXhwb3J0IGludGVyZmFjZSBDb2xsYWJBd2FyZW5lc3NTdGF0ZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgY29sb3I6IHN0cmluZztcbiAgLyoqXG4gICAqIEN1cnNvciBwb3NpdGlvbiBpbiAqKndvcmxkIGNvb3JkcyoqIChjYW52YXMtbGliIHZpZXdwb3J0IHNwYWNlKSBzbyBmb3JlaWduXG4gICAqIHBlZXJzIHNlZSB0aGUgc2FtZSBjb25jZXB0dWFsIHBvaW50IGV2ZW4gd2hlbiB0aGVpciBsb2NhbCB2aWV3cG9ydCBpc1xuICAgKiBwYW5uZWQvem9vbWVkIGRpZmZlcmVudGx5LiBOdWxsID0gcGVlciBpcyBub3Qgb3ZlciB0aGUgY2FudmFzIHN1cmZhY2UuXG4gICAqL1xuICBjdXJzb3I6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB8IG51bGw7XG4gIC8qKlxuICAgKiBNb3N0LXJlY2VudGx5IHNlbGVjdGVkIGVsZW1lbnQuIGBjc3NQYXRoYCBpcyB0aGUgbG9jYXRvciBpZCBjaGFpbiB0aGVcbiAgICogY2FudmFzLXNoZWxsIGFscmVhZHkgdXNlczsgYGJvdW5kc2AgYXJlIHNjcmVlbi1weCByZWN0IGF0IHRoZSBtb21lbnQgb2ZcbiAgICogcHVibGlzaCAoc28gaXQncyBhIGhpbnQsIG5vdCBhIGxpdmUgcmVmKS4gTnVsbCB3aGVuIG5vdGhpbmcgc2VsZWN0ZWQuXG4gICAqL1xuICBzZWxlY3Rpb246IHsgY3NzUGF0aDogc3RyaW5nOyBib3VuZHM6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHc6IG51bWJlcjsgaDogbnVtYmVyIH0gfSB8IG51bGw7XG4gIC8qKlxuICAgKiBDdXJyZW50bHktc2VsZWN0ZWQgYW5ub3RhdGlvbiBzdHJva2UgSURzIChQaGFzZSA1KS4gU3Ryb2tlcyBhcmUgYWRkcmVzc2VkXG4gICAqIGJ5IHRoZWlyIHN0YWJsZSBgZGF0YS1pZGAgYXR0cmlidXRlLCBzbyBwZWVycyBjYW4gcmVzb2x2ZSBoYWxvcyB2aWFcbiAgICogYGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWlkPVwiPGlkPlwiXScpYC4gRW1wdHkgd2hlbiBub3RoaW5nXG4gICAqIGFubm90YXRpb24tc2hhcGVkIGlzIHNlbGVjdGVkLlxuICAgKi9cbiAgYW5ub3RhdGlvblNlbGVjdGlvbjogc3RyaW5nW107XG4gIHZpZXdwb3J0OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB6b29tOiBudW1iZXIgfTtcbiAgLyoqXG4gICAqIFNvZnQgZWRpdGluZy1wcmVzZW5jZSAoUGhhc2UgMzApLiBTZXQgd2hpbGUgVEhJUyBwZWVyIChhIGh1bWFuIGVkaXRpbmcgdmlhXG4gICAqIHRoZSBDU1MtaW5zcGVjdG9yIC8gYSBgL2Rlc2lnbjplZGl0YC1kcml2ZW4gd3JpdGUsIG9yIGEgYnJpZGdlZCBhZ2VudCkgaXNcbiAgICogYWN0aXZlbHkgZWRpdGluZyB0aGUgY2FudmFzIGJvZHk7IGBzaW5jZWAgaXMgdGhlIGVwb2NoLW1zIHRoZSBlZGl0IHNlc3Npb25cbiAgICogYmVnYW4uIE51bGwvYWJzZW50ID0gbm90IGVkaXRpbmcuIFRoaXMgaXMgYSBTT0ZULCBhdHRyaWJ1dGVkIGhlYWRzLXVwIHRoYXRcbiAgICogcmlkZXMgdGhlIHNhbWUgaHViLWJyaWRnZWQgYXdhcmVuZXNzIGNoYW5uZWwgYXMgY3Vyc29ycyDigJQgaXQgaXMgTk9UIGEgbG9ja1xuICAgKiAobm8gbGVhc2UsIG5vIHRha2VvdmVyLCBuZXZlciBibG9ja3MgYW5vdGhlciBwZWVyKS4gQ2xlYXJlZCBvbiBpZGxlICsgb25cbiAgICogZGlzY29ubmVjdCAoYXdhcmVuZXNzIEdDKS4gVGhlIHZpc3VhbCBjb25mbGljdCBwaWNrZXIgKEREUi0xMTYpIHJlbWFpbnMgdGhlXG4gICAqIHNhZmV0eSBuZXQgZm9yIGRpdmVyZ2VudCBzYXZlcy5cbiAgICovXG4gIGVkaXRpbmc/OiB7IHNpbmNlOiBudW1iZXIgfSB8IG51bGw7XG4gIC8qKlxuICAgKiBTZXJ2ZXItc2lkZSBgZGlzY29ubmVjdGAgbWF0Y2hlcyBhd2FyZW5lc3Mgc3RhdGVzIHRvIG91dGdvaW5nIHBlZXJzIGJ5XG4gICAqIHRoaXMgdG9rZW4gKG11c3QgZXF1YWwgdGhlIHdzLmRhdGEuaWQgdGhlIHNlcnZlciBhc3NpZ25zIGF0IHVwZ3JhZGUpLlxuICAgKiBVbnRpbCB0aGUgc2VydmVyIHB1c2hlcyB0aGUgYXNzaWduZWQgaWQgYmFjayB0byB0aGUgY2xpZW50LCB3ZSB1c2UgYVxuICAgKiBjbGllbnQtZ2VuZXJhdGVkIFVVSUQg4oCUIGNvbGxpc2lvbnMgYXJlIG5lZ2xpZ2libGUgYW5kIGRpc2Nvbm5lY3QgY2xlYW51cFxuICAgKiB0b2xlcmF0ZXMgYSBzdGFsZSBzdGF0ZSAodGhlIG5leHQgYXdhcmVuZXNzIEdDIHBhc3MgZHJvcHMgaXQpLlxuICAgKi9cbiAgX19jb25uSWQ6IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgRm9yZWlnbkF3YXJlbmVzcyA9IE9taXQ8Q29sbGFiQXdhcmVuZXNzU3RhdGUsICdfX2Nvbm5JZCc+ICYgeyBjbGllbnRJRDogbnVtYmVyIH07XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVW50cnVzdGVkLWlucHV0IHNhbml0aXphdGlvbiBhdCB0aGUgYXdhcmVuZXNzIHRydXN0IGJvdW5kYXJ5LlxuLy9cbi8vIFBoYXNlIDggYXdhcmVuZXNzIHdhcyBsb29wYmFjay1vbmx5IOKAlCBldmVyeSBzdGF0ZSBjYW1lIGZyb20gYSB0cnVzdGVkIGxvY2FsXG4vLyB0YWIuIFBoYXNlIDkgKFRhc2sgNSkgYnJpZGdlcyBhd2FyZW5lc3MgdGhyb3VnaCBhIFNFTUktVFJVU1RFRCBodWIgKEREUi0wNTQpLFxuLy8gc28gZm9yZWlnbiBzdGF0ZXMgYXJlIG5vdyBhdHRhY2tlci1pbmZsdWVuY2VhYmxlLiBgdXNlRm9yZWlnbkF3YXJlbmVzc2AgaXNcbi8vIHRoZSBzaW5nbGUgY2hva2Vwb2ludCB3aGVyZSByZW1vdGUgc3RhdGUgaXMgcmVhZCBiZWZvcmUgaXQgcmVhY2hlcyB0aGVcbi8vIGN1cnNvciAvIHBhcnRpY2lwYW50IHJlbmRlciBzaW5rcywgc28gYWxsIHZhbGlkYXRpb24gbGl2ZXMgaGVyZS4gRmllbGRzIGFyZVxuLy8gdmFsaWRhdGVkIGZvciBWQUxVRSwgbm90IGp1c3QgdHlwZTpcbi8vICAgLSBjb2xvcjogcmUtZGVyaXZlZCBsb2NhbGx5IGZyb20gdGhlIChzYW5pdGl6ZWQpIG5hbWUgYW5kIHRoZSB3aXJlIHZhbHVlXG4vLyAgICAgaXMgRElTQ0FSREVEIOKAlCBhIGh1Yi1jaG9zZW4gYGNvbG9yYCBzdHJpbmcgd291bGQgb3RoZXJ3aXNlIGZsb3cgaW50byBhblxuLy8gICAgIGlubGluZSBgc3R5bGVgIGFuZCBhIGB1cmwoLi4uKWAgdmFsdWUgYmVhY29ucyBldmVyeSB2aWV3ZXIncyBicm93c2VyLlxuLy8gICAgIFRoZSBwYWxldHRlIGlzIGRldGVybWluaXN0aWMsIHNvIHJlLWRlcml2YXRpb24gaXMgdmlzdWFsbHkgaWRlbnRpY2FsLlxuLy8gICAtIG5hbWU6IGNvbnRyb2wgLyBiaWRpIC8gemVyby13aWR0aCBjaGFycyBzdHJpcHBlZCwgbGVuZ3RoLWNhcHBlZCDigJQgYmxvY2tzXG4vLyAgICAgaWRlbnRpdHkgc3Bvb2ZpbmcgKyByZW5kZXIgYmxvYXQuXG4vLyAgIC0gY3Vyc29yIC8gdmlld3BvcnQ6IGZpbml0ZS1udW1iZXIgZ2F0ZWQg4oCUIGEgTmFOL0luZmluaXR5IHdvdWxkIHBvaXNvbiB0aGVcbi8vICAgICBDU1MgdHJhbnNmb3JtIC8gdGhlIGxvY2FsIHZpZXdwb3J0IGNvbnRyb2xsZXIgZHVyaW5nIEZvbGxvdyBtb2RlLlxuLy8gICAtIHNlbGVjdGlvbi5jc3NQYXRoOiBjaGFyc2V0ICsgbGVuZ3RoIGFsbG93bGlzdCBiZWZvcmUgaXQgcmVhY2hlc1xuLy8gICAgIGBxdWVyeVNlbGVjdG9yYCDigJQgYmxvY2tzIHNlbGVjdG9yLWNvbXBsZXhpdHkgRG9TICsgYXJiaXRyYXJ5IERPTSBwcm9iaW5nLlxuLy8gICAtIGFubm90YXRpb25TZWxlY3Rpb246IHBlci1pZCB0b2tlbiArIGFycmF5LWxlbmd0aCBjYXBwZWQg4oCUIGJsb2NrcyBhXG4vLyAgICAgcXVlcnlTZWxlY3RvciByZW5kZXItc3Rvcm0uXG4vLyAgIC0gcGVlciBjb3VudCBjYXBwZWQg4oCUIGJsb2NrcyBhbiB1bmJvdW5kZWQtY2xpZW50cyBtZW1vcnkvcmVuZGVyIERvUy5cblxuY29uc3QgTUFYX0ZPUkVJR05fUEVFUlMgPSA2NDtcbmNvbnN0IE1BWF9OQU1FX0xFTiA9IDY0O1xuY29uc3QgTUFYX0NTU1BBVEhfTEVOID0gNTEyO1xuY29uc3QgTUFYX0FOTk9UQVRJT05fSURTID0gMjU2O1xuY29uc3QgTUFYX0FOTk9UQVRJT05fSURfTEVOID0gMTI4O1xuXG4vLyBDaGFyc2V0IG9mIGV2ZXJ5IHNlbGVjdG9yIHRoZSBjYW52YXMtc2hlbGwgYGNzc1BhdGgoKWAgZW1pdHNcbi8vIChgW2RhdGEtKj1cIi4uLlwiXWAsIGAjaWRgLCBgdGFnLmNsczpudGgtY2hpbGQoTilgLCBgID4gYCBjb21iaW5hdG9ycykuXG5jb25zdCBDU1NQQVRIX0FMTE9XRUQgPSAvXltBLVphLXowLTkgLl8jPjpbXFxdPVwiJygpLV0rJC87XG4vLyBgY3NzUGF0aCgpYCBvbmx5IGV2ZXIgZW1pdHMgYDpudGgtY2hpbGQoTilgIGFzIGEgcGFyZW50aGVzaXNlZCBjb25zdHJ1Y3QuXG4vLyBGdW5jdGlvbmFsIHBzZXVkby1jbGFzc2VzIChgOmhhcygpYCwgYDppcygpYCwgYDp3aGVyZSgpYCwgYDpub3QoKWApIHRyaWdnZXJcbi8vIHBlci1yZW5kZXIgc3VidHJlZSB3YWxrcyDihpIgYSBtYWxpY2lvdXMgaHViIHBlZXIgY291bGQgcHVibGlzaCBhIGRlZXBseVxuLy8gbmVzdGVkIGA6aGFzKClgIHNlbGVjdG9yIGFuZCBwaW4gZXZlcnkgdmlld2VyJ3MgbWFpbiB0aHJlYWQgKHF1ZXJ5U2VsZWN0b3Jcbi8vIHJlLXJ1bnMgZWFjaCByZW5kZXIpLiBTbyBhZnRlciBzdHJpcHBpbmcgdGhlIGxlZ2l0IGA6bnRoLWNoaWxkL29mLXR5cGUoTilgXG4vLyBmb3JtcywgYW55IHJlc2lkdWFsIHBhcmVuIG1lYW5zIGEgZnVuY3Rpb25hbCBwc2V1ZG8g4oCUIHJlamVjdC4gVGhlIGNoYXJzZXRcbi8vIGFsbG93bGlzdCBhbG9uZSB3YXMgd2lkZXIgdGhhbiB0aGUgZ2VuZXJhdG9yICh0aGUgb3JpZ2luYWwgRG9TIGhvbGUpLlxuY29uc3QgQ1NTUEFUSF9OVEggPSAvOm50aC0oY2hpbGR8b2YtdHlwZSlcXChcXGR7MSw0fVxcKS9nO1xuY29uc3QgQU5OT1RBVElPTl9JRF9BTExPV0VEID0gL15bQS1aYS16MC05Ll86LV0rJC87XG5cbmZ1bmN0aW9uIGlzU2FmZUNzc1BhdGgocDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGlmIChwLmxlbmd0aCA+IE1BWF9DU1NQQVRIX0xFTiB8fCAhQ1NTUEFUSF9BTExPV0VELnRlc3QocCkpIHJldHVybiBmYWxzZTtcbiAgY29uc3Qgc3RyaXBwZWQgPSBwLnJlcGxhY2UoQ1NTUEFUSF9OVEgsICcnKTtcbiAgcmV0dXJuICFzdHJpcHBlZC5pbmNsdWRlcygnKCcpICYmICFzdHJpcHBlZC5pbmNsdWRlcygnKScpO1xufVxuXG5mdW5jdGlvbiBpc0Zpbml0ZU51bSh2OiB1bmtub3duKTogdiBpcyBudW1iZXIge1xuICByZXR1cm4gdHlwZW9mIHYgPT09ICdudW1iZXInICYmIE51bWJlci5pc0Zpbml0ZSh2KTtcbn1cblxuLy8gQ29udHJvbCAoQzAvQzEpLCB6ZXJvLXdpZHRoLCBhbmQgYmlkaS1vdmVycmlkZSBjb2RlIHBvaW50cyBnZXQgc3RyaXBwZWQgZnJvbVxuLy8gZGlzcGxheWVkIHN0cmluZ3Mgc28gYSByZW1vdGUgcGVlciBjYW4ndCBzcG9vZiBhbm90aGVyJ3MgaWRlbnRpdHkgb3IgaGlkZVxuLy8gcGF5bG9hZHMgaW4gbGFiZWxzLiBBIGNoYXJDb2RlIHNjYW4gKG5vdCBhIHJlZ2V4IGxpdGVyYWwgd2l0aCByYXcgY29udHJvbFxuLy8gY2hhcnMpIHNpZGVzdGVwcyBiaW9tZSdzIG5vQ29udHJvbENoYXJhY3RlcnNJblJlZ2V4IHdoaWxlIGtlZXBpbmcgdGhlIHNhbWVcbi8vIHNlbWFudGljcyDigJQgc2FtZSBhcHByb2FjaCBhcyB0aGUgaHViJ3Mgc2FuaXRpemVGb3JMb2cgKEREUi0wNTMpLlxuZnVuY3Rpb24gaXNVbnNhZmVDb2RlUG9pbnQoY3A6IG51bWJlcik6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIGNwIDw9IDB4MWYgfHxcbiAgICAoY3AgPj0gMHg3ZiAmJiBjcCA8PSAweDlmKSB8fFxuICAgIChjcCA+PSAweDIwMGIgJiYgY3AgPD0gMHgyMDBmKSB8fFxuICAgIChjcCA+PSAweDIwMmEgJiYgY3AgPD0gMHgyMDJlKSB8fFxuICAgIChjcCA+PSAweDIwNjYgJiYgY3AgPD0gMHgyMDY5KSB8fFxuICAgIGNwID09PSAweGZlZmZcbiAgKTtcbn1cblxuZnVuY3Rpb24gc2FuaXRpemVOYW1lKHJhdzogdW5rbm93bik6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgcmF3ICE9PSAnc3RyaW5nJykgcmV0dXJuICdhbm9ueW1vdXMnO1xuICBsZXQgY2xlYW5lZCA9ICcnO1xuICBmb3IgKGNvbnN0IGNoIG9mIHJhdykge1xuICAgIGlmICghaXNVbnNhZmVDb2RlUG9pbnQoY2guY29kZVBvaW50QXQoMCkgPz8gMCkpIGNsZWFuZWQgKz0gY2g7XG4gIH1cbiAgY2xlYW5lZCA9IGNsZWFuZWQudHJpbSgpLnNsaWNlKDAsIE1BWF9OQU1FX0xFTik7XG4gIHJldHVybiBjbGVhbmVkIHx8ICdhbm9ueW1vdXMnO1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZUN1cnNvcihyYXc6IHVua25vd24pOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0gfCBudWxsIHtcbiAgaWYgKCFyYXcgfHwgdHlwZW9mIHJhdyAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICBjb25zdCBjID0gcmF3IGFzIHsgeD86IHVua25vd247IHk/OiB1bmtub3duIH07XG4gIHJldHVybiBpc0Zpbml0ZU51bShjLngpICYmIGlzRmluaXRlTnVtKGMueSkgPyB7IHg6IGMueCwgeTogYy55IH0gOiBudWxsO1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZVZpZXdwb3J0KHJhdzogdW5rbm93bik6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHpvb206IG51bWJlciB9IHtcbiAgY29uc3QgZmFsbGJhY2sgPSB7IHg6IDAsIHk6IDAsIHpvb206IDEgfTtcbiAgaWYgKCFyYXcgfHwgdHlwZW9mIHJhdyAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxsYmFjaztcbiAgY29uc3QgdiA9IHJhdyBhcyB7IHg/OiB1bmtub3duOyB5PzogdW5rbm93bjsgem9vbT86IHVua25vd24gfTtcbiAgaWYgKCFpc0Zpbml0ZU51bSh2LngpIHx8ICFpc0Zpbml0ZU51bSh2LnkpIHx8ICFpc0Zpbml0ZU51bSh2Lnpvb20pIHx8IHYuem9vbSA8PSAwKVxuICAgIHJldHVybiBmYWxsYmFjaztcbiAgcmV0dXJuIHsgeDogdi54LCB5OiB2LnksIHpvb206IHYuem9vbSB9O1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZVNlbGVjdGlvbihyYXc6IHVua25vd24pOiBDb2xsYWJBd2FyZW5lc3NTdGF0ZVsnc2VsZWN0aW9uJ10ge1xuICBpZiAoIXJhdyB8fCB0eXBlb2YgcmF3ICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHMgPSByYXcgYXMgeyBjc3NQYXRoPzogdW5rbm93bjsgYm91bmRzPzogdW5rbm93biB9O1xuICBjb25zdCBiID0gcy5ib3VuZHMgYXMgeyB4PzogdW5rbm93bjsgeT86IHVua25vd247IHc/OiB1bmtub3duOyBoPzogdW5rbm93biB9IHwgdW5kZWZpbmVkO1xuICBjb25zdCBib3VuZHMgPVxuICAgIGIgJiYgaXNGaW5pdGVOdW0oYi54KSAmJiBpc0Zpbml0ZU51bShiLnkpICYmIGlzRmluaXRlTnVtKGIudykgJiYgaXNGaW5pdGVOdW0oYi5oKVxuICAgICAgPyB7IHg6IGIueCwgeTogYi55LCB3OiBiLncsIGg6IGIuaCB9XG4gICAgICA6IG51bGw7XG4gIC8vIE9ubHkga2VlcCBjc3NQYXRoIGlmIGl0IG1hdGNoZXMgdGhlIGxvY2F0b3IgZ3JhbW1hciDigJQgb3RoZXJ3aXNlIGRyb3AgaXQgYW5kXG4gIC8vIGxldCB0aGUgcmVuZGVyZXIgZmFsbCBiYWNrIHRvIHRoZSAodmFsaWRhdGVkKSBib3VuZHMuXG4gIGNvbnN0IGNzc1BhdGggPSB0eXBlb2Ygcy5jc3NQYXRoID09PSAnc3RyaW5nJyAmJiBpc1NhZmVDc3NQYXRoKHMuY3NzUGF0aCkgPyBzLmNzc1BhdGggOiAnJztcbiAgaWYgKCFjc3NQYXRoICYmICFib3VuZHMpIHJldHVybiBudWxsO1xuICByZXR1cm4geyBjc3NQYXRoLCBib3VuZHM6IGJvdW5kcyA/PyB7IHg6IDAsIHk6IDAsIHc6IDAsIGg6IDAgfSB9O1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZUFubm90YXRpb25TZWxlY3Rpb24ocmF3OiB1bmtub3duKTogc3RyaW5nW10ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIFtdO1xuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgaWQgb2YgcmF3KSB7XG4gICAgaWYgKG91dC5sZW5ndGggPj0gTUFYX0FOTk9UQVRJT05fSURTKSBicmVhaztcbiAgICBpZiAoXG4gICAgICB0eXBlb2YgaWQgPT09ICdzdHJpbmcnICYmXG4gICAgICBpZC5sZW5ndGggPD0gTUFYX0FOTk9UQVRJT05fSURfTEVOICYmXG4gICAgICBBTk5PVEFUSU9OX0lEX0FMTE9XRUQudGVzdChpZClcbiAgICApXG4gICAgICBvdXQucHVzaChpZCk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuLy8gU29mdCBlZGl0aW5nLXByZXNlbmNlIChQaGFzZSAzMCkuIGBzaW5jZWAgbXVzdCBiZSBhIGZpbml0ZSBQT1NJVElWRSBlcG9jaC1tc1xuLy8gdGhhdCBpcyBub3QgaW4gdGhlIGZ1dHVyZSAoYWxsb3cgwrE1IHMgY2xvY2sgc2tldykuIEEgZnV0dXJlIC8gTmFOIC8gSW5maW5pdHkgL1xuLy8gbm9uLXBvc2l0aXZlIHZhbHVlIGlzIHJlamVjdGVkIOKGkiBgbnVsbGAgKHRyZWF0ZWQgYXMgbm90LWVkaXRpbmcpLCBzbyBhIGhvc3RpbGVcbi8vIGh1YiBwZWVyIGNhbid0IHBpbiBhIHBlcm1hbmVudCBcImVkaXRpbmdcIiBiYWRnZSB3aXRoIGEgZmFyLWZ1dHVyZSB0aW1lc3RhbXAgb3Jcbi8vIHBvaXNvbiBhIGBEYXRlLm5vdygpIC0gc2luY2VgIGFnZSBjb21wdXRhdGlvbiB3aXRoIGEgTmFOLlxuZnVuY3Rpb24gc2FuaXRpemVFZGl0aW5nU3RhdGUocmF3OiB1bmtub3duKTogeyBzaW5jZTogbnVtYmVyIH0gfCBudWxsIHtcbiAgaWYgKCFyYXcgfHwgdHlwZW9mIHJhdyAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICBjb25zdCBlID0gcmF3IGFzIHsgc2luY2U/OiB1bmtub3duIH07XG4gIGlmICghaXNGaW5pdGVOdW0oZS5zaW5jZSkgfHwgZS5zaW5jZSA8PSAwIHx8IGUuc2luY2UgPiBEYXRlLm5vdygpICsgNTAwMCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiB7IHNpbmNlOiBlLnNpbmNlIH07XG59XG5cbi8qKlxuICogVmFsaWRhdGUgKyBub3JtYWxpemUgb25lIGZvcmVpZ24gYXdhcmVuZXNzIHN0YXRlIGF0IHRoZSB0cnVzdCBib3VuZGFyeS5cbiAqIFJldHVybnMgbnVsbCBmb3Igc3RhdGVzIHRoYXQgY2FuJ3QgYmUgYSBwZWVyIChubyB1c2FibGUgbmFtZSkuIGBjb2xvcmAgaXNcbiAqIGFsd2F5cyByZS1kZXJpdmVkIGxvY2FsbHkgZnJvbSB0aGUgc2FuaXRpemVkIG5hbWUg4oCUIHRoZSB3aXJlIHZhbHVlIGlzIG5ldmVyXG4gKiB0cnVzdGVkLCB3aGljaCBpcyB3aGF0IGNsb3NlcyB0aGUgaHViIENTUy1gdXJsKClgIGV4ZmlsIGNoYW5uZWwuIEV4cG9ydGVkIHNvXG4gKiB0aGUgaG9zdGlsZS1pbnB1dCBtYXRyaXggY2FuIGV4ZXJjaXNlIGl0IHdpdGhvdXQgYSBSZWFjdCBoYXJuZXNzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2FuaXRpemVGb3JlaWduU3RhdGUoY2xpZW50SUQ6IG51bWJlciwgc3RhdGU6IHVua25vd24pOiBGb3JlaWduQXdhcmVuZXNzIHwgbnVsbCB7XG4gIGlmICghc3RhdGUgfHwgdHlwZW9mIHN0YXRlICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHMgPSBzdGF0ZSBhcyBQYXJ0aWFsPENvbGxhYkF3YXJlbmVzc1N0YXRlPjtcbiAgaWYgKHR5cGVvZiBzLm5hbWUgIT09ICdzdHJpbmcnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbmFtZSA9IHNhbml0aXplTmFtZShzLm5hbWUpO1xuICByZXR1cm4ge1xuICAgIGNsaWVudElELFxuICAgIG5hbWUsXG4gICAgY29sb3I6IGNvbG9yRm9yTmFtZShuYW1lKSxcbiAgICBjdXJzb3I6IHNhbml0aXplQ3Vyc29yKHMuY3Vyc29yKSxcbiAgICBzZWxlY3Rpb246IHNhbml0aXplU2VsZWN0aW9uKHMuc2VsZWN0aW9uKSxcbiAgICBhbm5vdGF0aW9uU2VsZWN0aW9uOiBzYW5pdGl6ZUFubm90YXRpb25TZWxlY3Rpb24ocy5hbm5vdGF0aW9uU2VsZWN0aW9uKSxcbiAgICB2aWV3cG9ydDogc2FuaXRpemVWaWV3cG9ydChzLnZpZXdwb3J0KSxcbiAgICBlZGl0aW5nOiBzYW5pdGl6ZUVkaXRpbmdTdGF0ZShzLmVkaXRpbmcpLFxuICB9O1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIENvbnRleHQuXG5cbmludGVyZmFjZSBDb2xsYWJWYWx1ZSB7XG4gIGRvYzogWS5Eb2M7XG4gIC8qKlxuICAgKiBTRUNVUklUWSBJTlZBUklBTlQ6IGluIGxpbmtlZCBtb2RlIHRoaXMgQXdhcmVuZXNzIGNhcnJpZXMgc3RhdGVzIHJlbGF5ZWRcbiAgICogZnJvbSBhIFNFTUktVFJVU1RFRCBodWIgKEREUi0wNTQpLiBGb3JlaWduIHN0YXRlcyBhcmUgdW50cnVzdGVkIGlucHV0IOKAlFxuICAgKiByZWFkIHRoZW0gT05MWSB0aHJvdWdoIGB1c2VGb3JlaWduQXdhcmVuZXNzYCwgd2hpY2ggc2FuaXRpemVzIGV2ZXJ5IGZpZWxkXG4gICAqIGF0IHRoZSB0cnVzdCBib3VuZGFyeSAoYHNhbml0aXplRm9yZWlnblN0YXRlYCkuIERvIE5PVCBjYWxsXG4gICAqIGBhd2FyZW5lc3MuZ2V0U3RhdGVzKClgIGRpcmVjdGx5IGluIHJlbmRlciBjb2RlOyB0aGF0IGJ5cGFzc2VzIHRoZSBnYXRlLlxuICAgKi9cbiAgYXdhcmVuZXNzOiBBd2FyZW5lc3M7XG4gIC8qKiBMb2NhbCBwZWVyJ3Mgc2Vzc2lvbi1zdGFibGUgY29sb3IgKGRlcml2ZWQgZnJvbSBnaXQgdXNlci5uYW1lKS4gKi9cbiAgbXlDb2xvcjogc3RyaW5nO1xuICAvKiogTG9jYWwgcGVlcidzIGRpc3BsYXkgbmFtZSAoZ2l0IHVzZXIubmFtZSBvciBhbm9ueW1vdXMgZmFsbGJhY2spLiAqL1xuICBteU5hbWU6IHN0cmluZztcbiAgLyoqIExvY2FsIHBlZXIncyBjb25uZWN0aW9uIGlkIChtYXRjaGVzIHNlcnZlci1zaWRlIHdzLmRhdGEuaWQgcGF0dGVybikuICovXG4gIG15Q29ubklkOiBzdHJpbmc7XG4gIC8qKiBUcnVlIHdoZW4gdGhlIFdTIGlzIE9QRU4uIEN1cnNvciBvdmVybGF5IGNhbiB1c2UgdGhpcyB0byBnYXRlIHJlbmRlcmluZy4gKi9cbiAgY29ubmVjdGVkOiBib29sZWFuO1xuICAvKiogUHVibGlzaCAoZGVib3VuY2UtY29hbGVzY2VkKSBhbiB1cGRhdGVkIGxvY2FsIGF3YXJlbmVzcyBzdGF0ZS4gKi9cbiAgcHVibGlzaEF3YXJlbmVzczogKHBhdGNoOiBQYXJ0aWFsPE9taXQ8Q29sbGFiQXdhcmVuZXNzU3RhdGUsICdfX2Nvbm5JZCc+PikgPT4gdm9pZDtcbn1cblxuY29uc3QgQ29sbGFiQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8Q29sbGFiVmFsdWUgfCBudWxsPihudWxsKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUNvbGxhYigpOiBDb2xsYWJWYWx1ZSB8IG51bGwge1xuICByZXR1cm4gdXNlQ29udGV4dChDb2xsYWJDb250ZXh0KTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBIb29rOiBmb3JlaWduIGF3YXJlbmVzcyBwZWVycyAodGhlIGN1cnNvciBvdmVybGF5IHN1YnNjcmliZXMgdG8gdGhpcykuXG5cbi8qKlxuICogUmV0dXJucyB0aGUgY3VycmVudCBzZXQgb2YgZm9yZWlnbiBwZWVycyAoZXhjbHVkZXMgdGhlIGxvY2FsIGNsaWVudCkuIFRoZVxuICogcmV0dXJuZWQgYXJyYXkgaXMgc3RhYmxlLXJlZmVyZW5jZSBiZXR3ZWVuIGF3YXJlbmVzcyB1cGRhdGVzIOKAlCB1c2VmdWwgZm9yXG4gKiBkb3duc3RyZWFtIFJlYWN0Lm1lbW8gY3Vyc29yIGNvbXBvbmVudHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VGb3JlaWduQXdhcmVuZXNzKCk6IEZvcmVpZ25Bd2FyZW5lc3NbXSB7XG4gIGNvbnN0IGNvbGxhYiA9IHVzZUNvbGxhYigpO1xuICBjb25zdCBbcGVlcnMsIHNldFBlZXJzXSA9IHVzZVN0YXRlPEZvcmVpZ25Bd2FyZW5lc3NbXT4oW10pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFjb2xsYWIpIHtcbiAgICAgIHNldFBlZXJzKFtdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgeyBhd2FyZW5lc3MgfSA9IGNvbGxhYjtcbiAgICBmdW5jdGlvbiBjb21wdXRlKCk6IEZvcmVpZ25Bd2FyZW5lc3NbXSB7XG4gICAgICBjb25zdCBvdXQ6IEZvcmVpZ25Bd2FyZW5lc3NbXSA9IFtdO1xuICAgICAgY29uc3QgbXlJZCA9IGF3YXJlbmVzcy5jbGllbnRJRDtcbiAgICAgIGZvciAoY29uc3QgW2NsaWVudElELCBzdGF0ZV0gb2YgYXdhcmVuZXNzLmdldFN0YXRlcygpIGFzIE1hcDxudW1iZXIsIHVua25vd24+KSB7XG4gICAgICAgIGlmIChjbGllbnRJRCA9PT0gbXlJZCkgY29udGludWU7XG4gICAgICAgIGlmIChvdXQubGVuZ3RoID49IE1BWF9GT1JFSUdOX1BFRVJTKSBicmVhazsgLy8gYm91bmQgRG9TIHZpYSB1bmJvdW5kZWQgcGVlcnNcbiAgICAgICAgLy8gU2FuaXRpemUgZXZlcnkgbm93LXJlbW90ZSBmaWVsZCBhdCB0aGlzIHRydXN0IGJvdW5kYXJ5IChUYXNrIDUpLlxuICAgICAgICBjb25zdCBwZWVyID0gc2FuaXRpemVGb3JlaWduU3RhdGUoY2xpZW50SUQsIHN0YXRlKTtcbiAgICAgICAgaWYgKHBlZXIpIG91dC5wdXNoKHBlZXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG91dDtcbiAgICB9XG4gICAgc2V0UGVlcnMoY29tcHV0ZSgpKTtcbiAgICBjb25zdCBvbkNoYW5nZSA9ICgpID0+IHNldFBlZXJzKGNvbXB1dGUoKSk7XG4gICAgYXdhcmVuZXNzLm9uKCdjaGFuZ2UnLCBvbkNoYW5nZSk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGF3YXJlbmVzcy5vZmYoJ2NoYW5nZScsIG9uQ2hhbmdlKTtcbiAgICB9O1xuICB9LCBbY29sbGFiXSk7XG5cbiAgcmV0dXJuIHBlZXJzO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEhvb2s6IHNvZnQgZWRpdGluZy1wcmVzZW5jZSAoUGhhc2UgMzApLlxuLy9cbi8vIEEgU09GVCwgYXR0cmlidXRlZCBcIkknbSBlZGl0aW5nIHRoaXMgY2FudmFzXCIgaGVhZHMtdXAg4oCUIE5PVCBhIGxvY2suIEl0IHJpZGVzXG4vLyB0aGUgc2FtZSBwZXItY2FudmFzIGF3YXJlbmVzcyBjaGFubmVsIGFzIGN1cnNvcnMgKHNvIGl0IGNyb3NzZXMgdGhlIGh1YiBmb3Jcbi8vIGZyZWUgdmlhIHRoZSBhd2FyZW5lc3MgYnJpZGdlKSBhbmQgaXMgc3VyZmFjZWQgYnkgdGhlIHBlZXIgb3ZlcmxheSBzbyB0d29cbi8vIHBlb3BsZSAob3IgYSBwZXJzb24gKyBhbiBhZ2VudCkgZG9uJ3QgdW5rbm93aW5nbHkgZWRpdCB0aGUgc2FtZSBjYW52YXMgYXQgdGhlXG4vLyBzYW1lIG1vbWVudC4gSXQgbmV2ZXIgYmxvY2tzIGFueW9uZTsgdGhlIHZpc3VhbCBjb25mbGljdCBwaWNrZXIgKEREUi0xMTYpXG4vLyByZW1haW5zIHRoZSBzYWZldHkgbmV0IGZvciBkaXZlcmdlbnQgc2F2ZXMuXG5cbmNvbnN0IEVESVRJTkdfSURMRV9NUyA9IDUwMDA7XG5cbi8qKlxuICogUmV0dXJucyBgc2V0RWRpdGluZygpYCAvIGBjbGVhckVkaXRpbmcoKWAuIENhbGwgYHNldEVkaXRpbmcoKWAgb24gZWFjaCBlZGl0XG4gKiB0aGUgbG9jYWwgdXNlciBtYWtlcyAoQ1NTLWluc3BlY3RvciB0d2VhaywgYC9kZXNpZ246ZWRpdGAtZHJpdmVuIHdyaXRlKTsgaXRcbiAqIHB1Ymxpc2hlcyBgZWRpdGluZzogeyBzaW5jZSB9YCBvbmNlIGFuZCBhdXRvLWV4dGVuZHMsIHRoZW4gYXV0by1jbGVhcnMgYWZ0ZXJcbiAqIGBFRElUSU5HX0lETEVfTVNgIG9mIG5vIGNhbGxzIChhbmQgb24gdW5tb3VudCkuIEEgbm8tb3Agb3V0c2lkZSBhXG4gKiBgQ29sbGFiUHJvdmlkZXJgIChyZXR1cm5zIGNhbGxiYWNrcyB0aGF0IGRvIG5vdGhpbmcpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdXNlRWRpdGluZ1ByZXNlbmNlKCk6IHsgc2V0RWRpdGluZzogKCkgPT4gdm9pZDsgY2xlYXJFZGl0aW5nOiAoKSA9PiB2b2lkIH0ge1xuICBjb25zdCBjb2xsYWIgPSB1c2VDb2xsYWIoKTtcbiAgY29uc3QgaWRsZVRpbWVyUmVmID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHNpbmNlUmVmID0gdXNlUmVmPG51bWJlciB8IG51bGw+KG51bGwpO1xuXG4gIGNvbnN0IGNsZWFyRWRpdGluZyA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAoaWRsZVRpbWVyUmVmLmN1cnJlbnQpIHtcbiAgICAgIGNsZWFyVGltZW91dChpZGxlVGltZXJSZWYuY3VycmVudCk7XG4gICAgICBpZGxlVGltZXJSZWYuY3VycmVudCA9IG51bGw7XG4gICAgfVxuICAgIGlmIChzaW5jZVJlZi5jdXJyZW50ICE9PSBudWxsKSB7XG4gICAgICBzaW5jZVJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgIGNvbGxhYj8ucHVibGlzaEF3YXJlbmVzcyh7IGVkaXRpbmc6IG51bGwgfSk7XG4gICAgfVxuICB9LCBbY29sbGFiXSk7XG5cbiAgY29uc3Qgc2V0RWRpdGluZyA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAoIWNvbGxhYikgcmV0dXJuO1xuICAgIGlmIChzaW5jZVJlZi5jdXJyZW50ID09PSBudWxsKSB7XG4gICAgICBzaW5jZVJlZi5jdXJyZW50ID0gRGF0ZS5ub3coKTtcbiAgICAgIGNvbGxhYi5wdWJsaXNoQXdhcmVuZXNzKHsgZWRpdGluZzogeyBzaW5jZTogc2luY2VSZWYuY3VycmVudCB9IH0pO1xuICAgIH1cbiAgICBpZiAoaWRsZVRpbWVyUmVmLmN1cnJlbnQpIGNsZWFyVGltZW91dChpZGxlVGltZXJSZWYuY3VycmVudCk7XG4gICAgaWRsZVRpbWVyUmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KGNsZWFyRWRpdGluZywgRURJVElOR19JRExFX01TKTtcbiAgfSwgW2NvbGxhYiwgY2xlYXJFZGl0aW5nXSk7XG5cbiAgLy8gQ2xlYXIgbG9jYWwgZWRpdGluZy1wcmVzZW5jZSBvbiB1bm1vdW50LlxuICB1c2VFZmZlY3QoKCkgPT4gKCkgPT4gY2xlYXJFZGl0aW5nKCksIFtjbGVhckVkaXRpbmddKTtcblxuICByZXR1cm4geyBzZXRFZGl0aW5nLCBjbGVhckVkaXRpbmcgfTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBTbHVnIGRlcml2YXRpb24g4oCUIG11c3QgbWF0Y2ggYGFwaS5maWxlU2x1Z2Agc2VydmVyLXNpZGUuXG5cbi8qKlxuICogTWlycm9yIG9mIHNlcnZlci1zaWRlIGBhcGkuZmlsZVNsdWdgLiBUaGUgaW5wdXQgaXMgdGhlIGNhbnZhcyBwYXRoIGFzIHRoZVxuICogc2hlbGwgc3RvcmVkIGl0IG9uIGB3aW5kb3cuX19jYW52YXNfbWV0YV9maWxlX19gIChlLmcuIGAuZGVzaWduL3VpL0Zvby50c3hgKS5cbiAqIFN0cmlwIHRoZSBkZXNpZ25SZWwgcHJlZml4IChyZWFkIGZyb20gYHdpbmRvdy5fX2NhbnZhc19kZXNpZ25fcmVsX19gLCBzZXRcbiAqIGJ5IF9zaGVsbC5odG1sKSBzbyBib3RoIHNpZGVzIGxhbmQgb24gdGhlIHNhbWUgc2x1ZyDigJQgd2l0aG91dCB0aGlzIGJvdGhcbiAqIHRhYnMgb3BlbiBhIGBkZXNpZ24tdWktZm9vYCByb29tIHdoaWxlIHRoZSBzZXJ2ZXIncyBpbnNwZWN0b3IgYnJpZGdlXG4gKiBwdXNoZXMgaW50byBgdWktZm9vYCwgYW5kIHRoZSByb29tcyBuZXZlciBjb252ZXJnZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbnZhc1NsdWdGcm9tUGF0aChjYW52YXNSZWw6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKCFjYW52YXNSZWwpIHJldHVybiBudWxsO1xuICBsZXQgcCA9IGNhbnZhc1JlbC5yZXBsYWNlKC9eXFwvK3xcXC8rJC9nLCAnJyk7XG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGNvbnN0IHcgPSB3aW5kb3cgYXMgdW5rbm93biBhcyB7IF9fY2FudmFzX2Rlc2lnbl9yZWxfXz86IHN0cmluZyB9O1xuICAgIGNvbnN0IGRlc2lnblJlbCA9ICh3Ll9fY2FudmFzX2Rlc2lnbl9yZWxfXyA/PyAnJykucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgJycpO1xuICAgIGlmIChkZXNpZ25SZWwgJiYgcC5zdGFydHNXaXRoKGAke2Rlc2lnblJlbH0vYCkpIHAgPSBwLnNsaWNlKGRlc2lnblJlbC5sZW5ndGggKyAxKTtcbiAgfVxuICBjb25zdCBzbHVnID0gcFxuICAgIC5yZXBsYWNlKC9cXC8vZywgJy0nKVxuICAgIC5yZXBsYWNlKC9cXHMrL2csICdfJylcbiAgICAucmVwbGFjZSgvXFwuKHRzeHxodG1sKSQvaSwgJycpXG4gICAgLnJlcGxhY2UoL15cXC4rLywgJycpXG4gICAgLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiAvXlthLXowLTlfLV0rJC8udGVzdChzbHVnKSA/IHNsdWcgOiBudWxsO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIE1vZHVsZS1sZXZlbCwgcmVmY291bnRlZCBjb2xsYWIgc2Vzc2lvbiAoRjQg4oCUIHByZXNlbmNlIHN1cnZpdmVzIGEgaG90LXN3YXApLlxuLy9cbi8vIEEgY3Jvc3MtcGVlciBzeW5jZWQgZWRpdCAob3IgYW4gYWdlbnQgZWRpdCkgaG90LXN3YXBzIHRoZSBjYW52YXMgbW9kdWxlIGluXG4vLyBwbGFjZSwgd2hpY2ggUkVNT1VOVFMgdGhlIHdob2xlIGNhbnZhcyBzdWJ0cmVlIOKAlCBpbmNsdWRpbmcgPENvbGxhYlByb3ZpZGVyPi5cbi8vIElmIHRoZSBZLkRvYyArIEF3YXJlbmVzcyArIFdlYlNvY2tldCB3ZXJlIG93bmVkIGJ5IHRoZSBjb21wb25lbnQgKHVzZU1lbW8gL1xuLy8gdXNlRWZmZWN0KSwgdGhhdCByZW1vdW50IHdvdWxkIENMT1NFIHRoZSBhd2FyZW5lc3Mgc29ja2V0IGFuZCByZS1oYW5kc2hha2UsIHNvXG4vLyBldmVyeSBwZWVyJ3MgY3Vyc29yICsgYXZhdGFyIGJsaW5rcyBvdXQgYW5kIGJhY2sgb24gZXZlcnkgc3luY2VkIGNoYW5nZSAodGhlXG4vLyBGNCBidWcpLiBJbnN0ZWFkIHRoZSBsaXZlIHNlc3Npb24gbGl2ZXMgSEVSRSwga2V5ZWQgYnkgc2x1ZyArIHJlZmNvdW50ZWQ6IGFcbi8vIHNhbWUtc2x1ZyByZW1vdW50IHJlLWFjcXVpcmVzIHRoZSBTQU1FIGRvYy9hd2FyZW5lc3Mvc29ja2V0IHdpdGhpbiBhIHNob3J0XG4vLyBncmFjZSB3aW5kb3csIHNvIHRoZSBhd2FyZW5lc3MgY29ubmVjdGlvbiBuZXZlciBkcm9wcyBhbmQgcHJlc2VuY2UgaXMgc3RhYmxlLlxuLy9cbi8vIE9uZSBjYW52YXMgaWZyYW1lIGlzIG9uZSByZWFsbSBhbmQgb25seSBldmVyIGhvbGRzIG9uZSBzbHVnIChzd2l0Y2hpbmdcbi8vIGNhbnZhc2VzIG5hdmlnYXRlcyB0aGUgaWZyYW1lIOKGkiBmcmVzaCByZWFsbSDihpIgZnJlc2ggbW9kdWxlIHN0YXRlKSwgc28gdGhlIG1hcFxuLy8gaG9sZHMgYXQgbW9zdCBvbmUgbGl2ZSBlbnRyeSBwbHVzLCBicmllZmx5LCBvbmUgZHJhaW5pbmcgb25lLlxuXG5jb25zdCBBV0FSRU5FU1NfVEhST1RUTEVfTVMgPSAzMzsgLy8gfjMwIEh6XG5cbmludGVyZmFjZSBDb2xsYWJTZXNzaW9uIHtcbiAgc2x1Zzogc3RyaW5nO1xuICBkb2M6IFkuRG9jO1xuICBhd2FyZW5lc3M6IEF3YXJlbmVzcztcbiAgY29ubklkOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgY29sb3I6IHN0cmluZztcbiAgY29ubmVjdGVkOiBib29sZWFuO1xuICByZWZDb3VudDogbnVtYmVyO1xuICBkZXN0cm95VGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbDtcbiAgLyoqIFJlYWN0IGNvbnN1bWVycyBzdWJzY3JpYmUgc28gbmFtZS9jb2xvci9jb25uZWN0ZWQgY2hhbmdlcyByZS1yZW5kZXIuICovXG4gIGxpc3RlbmVyczogU2V0PCgpID0+IHZvaWQ+O1xuICAvKiogVGVhciBkb3duIHRoZSBzb2NrZXQgKyBsaXN0ZW5lcnMgKyBkZXN0cm95IGRvYy9hd2FyZW5lc3MuICovXG4gIHN0b3A6ICgpID0+IHZvaWQ7XG59XG5cbi8vIFRoZSBzZXNzaW9uIHJlZ2lzdHJ5IE1VU1QgbGl2ZSBvbiBgd2luZG93YCwgbm90IGluIG1vZHVsZSBzY29wZSwgYW5kIGJlXG4vLyByZXNvbHZlZCBMQVpJTFkgKHBlciBhY2Nlc3MsIG5vdCBvbmNlIGF0IG1vZHVsZSBsb2FkKS4gQSBob3Qtc3dhcCAoRjQpXG4vLyByZS1pbXBvcnRzIHRoZSBjYW52YXMgYnVuZGxlIHdpdGggYSBjYWNoZS1idXN0aW5nIGA/dj1gIHF1ZXJ5LCBhbmQgdXNlLWNvbGxhYlxuLy8gaXMgSU5MSU5FRCBpbnRvIHRoYXQgcGVyLWNhbnZhcyBidW5kbGUg4oCUIHNvIGVhY2ggaG90LXN3YXAgcmUtZXZhbHVhdGVzIGEgRlJFU0hcbi8vIG1vZHVsZSB3aXRoIGEgZnJlc2ggbW9kdWxlLWxldmVsIGJpbmRpbmcuIEEgcGxhaW4gYGNvbnN0IFNFU1NJT05TID0gbmV3IE1hcCgpYFxuLy8gd291bGQgdGhlcmVmb3JlIGJlIGVtcHR5IG9uIGV2ZXJ5IGhvdC1zd2FwIGFuZCB3ZSdkIHNwaW4gYSBuZXcgWS5Eb2MgK1xuLy8gQXdhcmVuZXNzICsgc29ja2V0IChuZXcgY2xpZW50SUQpIGVhY2ggdGltZSwgbGVhdmluZyB0aGUgcHJpb3IgY2xpZW50SUQnc1xuLy8gYXdhcmVuZXNzIHRvIGxpbmdlciBvbiB0aGUgaHViIOKGkiBwaGFudG9tIFwic2VsZlwiIGF2YXRhcnMgcGlsZSB1cCB1bnRpbCB0aGVcbi8vIGF3YXJlbmVzcyB0aW1lb3V0LiBBbmNob3JpbmcgdGhlIG1hcCBvbiB0aGUgaWZyYW1lJ3MgYHdpbmRvd2AgKHdoaWNoIHN1cnZpdmVzXG4vLyBtb2R1bGUgcmUtZXZhbHVhdGlvbikgaXMgd2hhdCBtYWtlcyB0aGUgc2Vzc2lvbiDigJQgYW5kIHRodXMgcHJlc2VuY2Ug4oCUIHN1cnZpdmVcbi8vIHRoZSBzd2FwLiBMYXp5IHJlc29sdXRpb24gYWxzbyB0b2xlcmF0ZXMgYSBgd2luZG93YCB0aGF0IGJlY29tZXMgYXZhaWxhYmxlXG4vLyBhZnRlciB0aGlzIG1vZHVsZSBmaXJzdCBldmFsdWF0ZXMgKHRlc3QgaGFybmVzczogaW1wb3J0cyBhcmUgaG9pc3RlZCBhYm92ZVxuLy8gaGFwcHktZG9tIHJlZ2lzdHJhdGlvbikuXG4vL1xuLy8gU0VDVVJJVFkgKEREUi0wNTQpOiB0aGUgY2FudmFzIGlmcmFtZSBpcyB1bnRydXN0ZWQgYW5kIHNoYXJlcyB0aGlzIHJlYWxtLCBzb1xuLy8gdGhlIHJlZ2lzdHJ5IGhvbGRzIGxpdmUgbmV0d29yayBoYW5kbGVzIGluIHJlYWNoIG9mIGNhbnZhcyBzY3JpcHQuIFdlIGtleSBpdFxuLy8gYnkgYSBOT04tRU5VTUVSQUJMRSBnbG9iYWwgU3ltYm9sIChub3QgYW4gZW51bWVyYWJsZSBzdHJpbmcgcHJvcGVydHkpIHNvIGl0XG4vLyBjYW4ndCBiZSBoYXJ2ZXN0ZWQgYnkgYW4gb3Bwb3J0dW5pc3RpYyBgZm9y4oCmaW5gIC8gYE9iamVjdC5rZXlzKHdpbmRvdylgIHN3ZWVwXG4vLyDigJQgZGVmZW5zZSBpbiBkZXB0aCwgTk9UIGEgdHJ1c3QgYm91bmRhcnk6IHNhbWUtcmVhbG0gY2FudmFzIGNvZGUgY2FuIGFscmVhZHlcbi8vIHJlYWNoIGNvbGxhYiBzdGF0ZSB0aHJvdWdoIGB1c2VDb2xsYWIoKWAsIGFuZCBgU3ltYm9sLmZvcmAgaXMgcmVjb3ZlcmFibGUgYnkgYVxuLy8gZGV0ZXJtaW5lZCBhdHRhY2tlci4gQ2xvc2luZyB0aGUgdW5kZXJseWluZyBcInVudHJ1c3RlZCBjYW52YXMgY2FuIG11dGF0ZSB0aGVcbi8vIHNoYXJlZCBkb2NcIiBzdXJmYWNlIGlzIGEgc2VwYXJhdGUsIHByZS1leGlzdGluZyBjb25jZXJuICh0cmFja2VkIGFzIGFcbi8vIGZvbGxvdy11cCk7IHRoaXMga2VlcHMgdGhlIGhvdC1zd2FwIGZpeCBmcm9tIFdJREVOSU5HIGRpc2NvdmVyeS4gQSBnbG9iYWxcbi8vIFN5bWJvbCAoc2hhcmVkIHJlZ2lzdHJ5KSBpcyByZXF1aXJlZCBzbyB0aGUgcmUtaW1wb3J0ZWQgbW9kdWxlIHJlc29sdmVzIHRoZVxuLy8gU0FNRSBrZXkg4oCUIGEgcGVyLW1vZHVsZSBgU3ltYm9sKClgIHdvdWxkIGRlZmVhdCB0aGUgY3Jvc3MtcmUtaW1wb3J0IHN1cnZpdmFsLlxuY29uc3QgU0VTU0lPTlNfS0VZID0gU3ltYm9sLmZvcignbWF1ZGUuY29sbGFiLnNlc3Npb25zLnYxJyk7XG5sZXQgbW9kdWxlRmFsbGJhY2tTZXNzaW9uczogTWFwPHN0cmluZywgQ29sbGFiU2Vzc2lvbj4gfCBudWxsID0gbnVsbDtcbmZ1bmN0aW9uIGdldFNlc3Npb25zKCk6IE1hcDxzdHJpbmcsIENvbGxhYlNlc3Npb24+IHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKCFtb2R1bGVGYWxsYmFja1Nlc3Npb25zKSBtb2R1bGVGYWxsYmFja1Nlc3Npb25zID0gbmV3IE1hcDxzdHJpbmcsIENvbGxhYlNlc3Npb24+KCk7XG4gICAgcmV0dXJuIG1vZHVsZUZhbGxiYWNrU2Vzc2lvbnM7XG4gIH1cbiAgY29uc3QgdyA9IHdpbmRvdyBhcyB1bmtub3duIGFzIFJlY29yZDxzeW1ib2wsIE1hcDxzdHJpbmcsIENvbGxhYlNlc3Npb24+IHwgdW5kZWZpbmVkPjtcbiAgbGV0IG1hcCA9IHdbU0VTU0lPTlNfS0VZXTtcbiAgaWYgKCFtYXApIHtcbiAgICBtYXAgPSBuZXcgTWFwPHN0cmluZywgQ29sbGFiU2Vzc2lvbj4oKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodywgU0VTU0lPTlNfS0VZLCB7XG4gICAgICB2YWx1ZTogbWFwLFxuICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgIH0pO1xuICB9XG4gIHJldHVybiBtYXA7XG59XG5cbi8vIEtlZXAgYSByZWZjb3VudC0wIHNlc3Npb24gYWxpdmUgYnJpZWZseSBzbyBhIGhvdC1zd2FwIHJlbW91bnQgKHdoaWNoIHVubW91bnRzXG4vLyB0aGVuIGltbWVkaWF0ZWx5IHJlbW91bnRzIHRoZSBwcm92aWRlciBpbiB0aGUgc2FtZSBjb21taXQpIHJldXNlcyB0aGUgbGl2ZVxuLy8gc29ja2V0IGluc3RlYWQgb2YgcmVjb25uZWN0aW5nLiBBIGdlbnVpbmUgY2xvc2UgKG5vIHJlLWFjcXVpcmUgd2l0aGluIHRoZVxuLy8gd2luZG93KSB0ZWFycyBkb3duIHNvIHRoZSBwZWVyIGxlYXZlcyB0aGUgcm9vbSBjbGVhbmx5LlxuY29uc3QgU0VTU0lPTl9HUkFDRV9NUyA9IDQwMDA7XG5cbmZ1bmN0aW9uIG5vdGlmeVNlc3Npb24oczogQ29sbGFiU2Vzc2lvbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IGwgb2Ygcy5saXN0ZW5lcnMpIGwoKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2Vzc2lvbihzbHVnOiBzdHJpbmcpOiBDb2xsYWJTZXNzaW9uIHtcbiAgY29uc3QgZG9jID0gbmV3IFkuRG9jKCk7XG4gIGNvbnN0IGF3YXJlbmVzcyA9IG5ldyBBd2FyZW5lc3MoZG9jKTtcbiAgY29uc3QgY29ubklkID0gY3J5cHRvLnJhbmRvbVVVSUQoKTtcblxuICBjb25zdCBzZXNzaW9uOiBDb2xsYWJTZXNzaW9uID0ge1xuICAgIHNsdWcsXG4gICAgZG9jLFxuICAgIGF3YXJlbmVzcyxcbiAgICBjb25uSWQsXG4gICAgbmFtZTogJ2Fub255bW91cycsXG4gICAgY29sb3I6IGNvbG9yRm9yTmFtZSgnYW5vbnltb3VzJyksXG4gICAgY29ubmVjdGVkOiBmYWxzZSxcbiAgICByZWZDb3VudDogMCxcbiAgICBkZXN0cm95VGltZXI6IG51bGwsXG4gICAgbGlzdGVuZXJzOiBuZXcgU2V0KCksXG4gICAgc3RvcDogKCkgPT4ge30sXG4gIH07XG5cbiAgLy8gU2VlZCBsb2NhbCBhd2FyZW5lc3MgaW1tZWRpYXRlbHkgc28gZm9yZWlnbiBwZWVycyBzZWUgb3VyIG5hbWUgZXZlbiBiZWZvcmVcbiAgLy8gdGhlIGZpcnN0IGN1cnNvciBtb3ZlOyBwcmVzZXJ2ZXMgYW55IGN1cnNvci9zZWxlY3Rpb24gYWxyZWFkeSBwdWJsaXNoZWQuXG4gIGNvbnN0IHNlZWRMb2NhbEF3YXJlbmVzcyA9IChuYW1lOiBzdHJpbmcsIGNvbG9yOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjdXIgPSAoYXdhcmVuZXNzLmdldExvY2FsU3RhdGUoKSA/PyB7fSkgYXMgUGFydGlhbDxDb2xsYWJBd2FyZW5lc3NTdGF0ZT47XG4gICAgYXdhcmVuZXNzLnNldExvY2FsU3RhdGUoe1xuICAgICAgbmFtZSxcbiAgICAgIGNvbG9yLFxuICAgICAgY3Vyc29yOiBjdXIuY3Vyc29yID8/IG51bGwsXG4gICAgICBzZWxlY3Rpb246IGN1ci5zZWxlY3Rpb24gPz8gbnVsbCxcbiAgICAgIGFubm90YXRpb25TZWxlY3Rpb246IGN1ci5hbm5vdGF0aW9uU2VsZWN0aW9uID8/IFtdLFxuICAgICAgdmlld3BvcnQ6IGN1ci52aWV3cG9ydCA/PyB7IHg6IDAsIHk6IDAsIHpvb206IDEgfSxcbiAgICAgIGVkaXRpbmc6IGN1ci5lZGl0aW5nID8/IG51bGwsXG4gICAgICBfX2Nvbm5JZDogY29ubklkLFxuICAgIH0gc2F0aXNmaWVzIENvbGxhYkF3YXJlbmVzc1N0YXRlKTtcbiAgfTtcbiAgc2VlZExvY2FsQXdhcmVuZXNzKHNlc3Npb24ubmFtZSwgc2Vzc2lvbi5jb2xvcik7XG5cbiAgLy8gUmVzb2x2ZSBpZGVudGl0eSBmcm9tIGdpdCB1c2VyLm5hbWUgb25jZSBwZXIgU0VTU0lPTiAobm90IHBlciBtb3VudCkgc28gYVxuICAvLyBob3Qtc3dhcCByZW1vdW50IGRvZXNuJ3QgcmUtZmV0Y2ggKyByZS1wdWJsaXNoICh3aGljaCB3b3VsZCBjaHVybiBhd2FyZW5lc3MpLlxuICBsZXQgaWRlbnRpdHlDYW5jZWxsZWQgPSBmYWxzZTtcbiAgZmV0Y2goJy9fYXBpL2dpdC11c2VyJylcbiAgICAudGhlbigocikgPT4gci5qc29uKCkpXG4gICAgLnRoZW4oKGopID0+IHtcbiAgICAgIGlmIChpZGVudGl0eUNhbmNlbGxlZCkgcmV0dXJuO1xuICAgICAgY29uc3QgbiA9IHR5cGVvZiBqPy5uYW1lID09PSAnc3RyaW5nJyAmJiBqLm5hbWUudHJpbSgpID8gai5uYW1lLnRyaW0oKSA6IG51bGw7XG4gICAgICBjb25zdCBmaW5hbE5hbWUgPSBuID8/IGBhbm9ueW1vdXMtJHtjb25uSWQuc2xpY2UoMCwgNil9YDtcbiAgICAgIHNlc3Npb24ubmFtZSA9IGZpbmFsTmFtZTtcbiAgICAgIHNlc3Npb24uY29sb3IgPSBjb2xvckZvck5hbWUoZmluYWxOYW1lKTtcbiAgICAgIHNlZWRMb2NhbEF3YXJlbmVzcyhmaW5hbE5hbWUsIHNlc3Npb24uY29sb3IpO1xuICAgICAgbm90aWZ5U2Vzc2lvbihzZXNzaW9uKTtcbiAgICB9KVxuICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICBpZiAoaWRlbnRpdHlDYW5jZWxsZWQpIHJldHVybjtcbiAgICAgIGNvbnN0IGZhbGxiYWNrID0gYGFub255bW91cy0ke2Nvbm5JZC5zbGljZSgwLCA2KX1gO1xuICAgICAgc2Vzc2lvbi5uYW1lID0gZmFsbGJhY2s7XG4gICAgICBzZXNzaW9uLmNvbG9yID0gY29sb3JGb3JOYW1lKGZhbGxiYWNrKTtcbiAgICAgIHNlZWRMb2NhbEF3YXJlbmVzcyhmYWxsYmFjaywgc2Vzc2lvbi5jb2xvcik7XG4gICAgICBub3RpZnlTZXNzaW9uKHNlc3Npb24pO1xuICAgIH0pO1xuXG4gIC8vIOKUgOKUgCBXZWJTb2NrZXQgbGlmZWN5Y2xlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XG4gIGxldCByZWNvbm5lY3RUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsID0gbnVsbDtcbiAgbGV0IHdzUmVmOiBXZWJTb2NrZXQgfCBudWxsID0gbnVsbDtcblxuICBmdW5jdGlvbiBzZW5kRnJhbWUod3M6IFdlYlNvY2tldCwgcGF5bG9hZDogVWludDhBcnJheSkge1xuICAgIHRyeSB7XG4gICAgICB3cy5zZW5kKHBheWxvYWQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLyogZGVhZCBzb2NrZXQg4oCUIGNsb3NlIGhhbmRsZXIgd2lsbCByZWNvbm5lY3QgKi9cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBicm9hZGNhc3RBd2FyZW5lc3Mod3M6IFdlYlNvY2tldCwgY2hhbmdlZDogbnVtYmVyW10pIHtcbiAgICBpZiAoY2hhbmdlZC5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICBjb25zdCBlbmNvZGVyID0gZW5jb2RpbmcuY3JlYXRlRW5jb2RlcigpO1xuICAgIGVuY29kaW5nLndyaXRlVmFyVWludChlbmNvZGVyLCBNRVNTQUdFX0FXQVJFTkVTUyk7XG4gICAgZW5jb2Rpbmcud3JpdGVWYXJVaW50OEFycmF5KGVuY29kZXIsIGVuY29kZUF3YXJlbmVzc1VwZGF0ZShhd2FyZW5lc3MsIGNoYW5nZWQpKTtcbiAgICBzZW5kRnJhbWUod3MsIGVuY29kaW5nLnRvVWludDhBcnJheShlbmNvZGVyKSk7XG4gIH1cblxuICBmdW5jdGlvbiBicm9hZGNhc3RTeW5jVXBkYXRlKHdzOiBXZWJTb2NrZXQsIHVwZGF0ZTogVWludDhBcnJheSkge1xuICAgIGNvbnN0IGVuY29kZXIgPSBlbmNvZGluZy5jcmVhdGVFbmNvZGVyKCk7XG4gICAgZW5jb2Rpbmcud3JpdGVWYXJVaW50KGVuY29kZXIsIE1FU1NBR0VfU1lOQyk7XG4gICAgd3JpdGVVcGRhdGUoZW5jb2RlciwgdXBkYXRlKTtcbiAgICBzZW5kRnJhbWUod3MsIGVuY29kaW5nLnRvVWludDhBcnJheShlbmNvZGVyKSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb25uZWN0KCkge1xuICAgIGlmIChjYW5jZWxsZWQpIHJldHVybjtcbiAgICBjb25zdCBwcm90byA9IGxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JyA/ICd3c3M6JyA6ICd3czonO1xuICAgIGNvbnN0IHdzID0gbmV3IFdlYlNvY2tldChgJHtwcm90b30vLyR7bG9jYXRpb24uaG9zdH0vX3dzL2NvbGxhYi8ke3NsdWd9YCk7XG4gICAgd3MuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgd3NSZWYgPSB3cztcblxuICAgIHdzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCAoKSA9PiB7XG4gICAgICBzZXNzaW9uLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgICBub3RpZnlTZXNzaW9uKHNlc3Npb24pO1xuICAgICAgLy8gU3luYyBzdGVwIDEg4oCUIGFubm91bmNlIG91ciBzdGF0ZSB2ZWN0b3Igc28gdGhlIHNlcnZlciBjYW4gc2VuZCB0aGVcbiAgICAgIC8vIG1pc3NpbmcgcGllY2VzIChtYXRjaGVzIHRoZSBlbmNvZGVIYW5kc2hha2Ugc2VydmVyIHBhdGgpLlxuICAgICAgY29uc3QgZW5jb2RlciA9IGVuY29kaW5nLmNyZWF0ZUVuY29kZXIoKTtcbiAgICAgIGVuY29kaW5nLndyaXRlVmFyVWludChlbmNvZGVyLCBNRVNTQUdFX1NZTkMpO1xuICAgICAgd3JpdGVTeW5jU3RlcDEoZW5jb2RlciwgZG9jKTtcbiAgICAgIHNlbmRGcmFtZSh3cywgZW5jb2RpbmcudG9VaW50OEFycmF5KGVuY29kZXIpKTtcbiAgICAgIC8vIEF3YXJlbmVzcyBpbml0aWFsIHN0YXRlIOKAlCBmaXJlIG91ciBsb2NhbCBzdGF0ZSB0byB0aGUgcm9vbS5cbiAgICAgIGJyb2FkY2FzdEF3YXJlbmVzcyh3cywgW2F3YXJlbmVzcy5jbGllbnRJRF0pO1xuICAgIH0pO1xuXG4gICAgd3MuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCAoKSA9PiB7XG4gICAgICBzZXNzaW9uLmNvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgbm90aWZ5U2Vzc2lvbihzZXNzaW9uKTtcbiAgICAgIHdzUmVmID0gbnVsbDtcbiAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVybjtcbiAgICAgIHJlY29ubmVjdFRpbWVyID0gc2V0VGltZW91dChjb25uZWN0LCAxMDAwKTtcbiAgICB9KTtcblxuICAgIHdzLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgKCkgPT4ge1xuICAgICAgLy8gTGV0IGNsb3NlIGhhbmRsZXIgZG8gdGhlIHJlY29ubmVjdDsgZXJyb3IgZXZlbnRzIHdpdGhvdXQgYSBjbG9zZVxuICAgICAgLy8gd291bGQganVzdCByZXRyeS1zcGFtLlxuICAgIH0pO1xuXG4gICAgd3MuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIChldnQpID0+IHtcbiAgICAgIGNvbnN0IHBheWxvYWQgPVxuICAgICAgICBldnQuZGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyXG4gICAgICAgICAgPyBuZXcgVWludDhBcnJheShldnQuZGF0YSlcbiAgICAgICAgICA6IGV2dC5kYXRhIGluc3RhbmNlb2YgVWludDhBcnJheVxuICAgICAgICAgICAgPyBldnQuZGF0YVxuICAgICAgICAgICAgOiBudWxsO1xuICAgICAgaWYgKCFwYXlsb2FkKSByZXR1cm47XG4gICAgICBjb25zdCBkZWNvZGVyID0gZGVjb2RpbmcuY3JlYXRlRGVjb2RlcihwYXlsb2FkKTtcbiAgICAgIGNvbnN0IG1lc3NhZ2VUeXBlID0gZGVjb2RpbmcucmVhZFZhclVpbnQoZGVjb2Rlcik7XG4gICAgICBzd2l0Y2ggKG1lc3NhZ2VUeXBlKSB7XG4gICAgICAgIGNhc2UgTUVTU0FHRV9TWU5DOiB7XG4gICAgICAgICAgY29uc3QgZW5jb2RlciA9IGVuY29kaW5nLmNyZWF0ZUVuY29kZXIoKTtcbiAgICAgICAgICBlbmNvZGluZy53cml0ZVZhclVpbnQoZW5jb2RlciwgTUVTU0FHRV9TWU5DKTtcbiAgICAgICAgICByZWFkU3luY01lc3NhZ2UoZGVjb2RlciwgZW5jb2RlciwgZG9jLCB3cyk7XG4gICAgICAgICAgaWYgKGVuY29kaW5nLmxlbmd0aChlbmNvZGVyKSA+IDEpIHNlbmRGcmFtZSh3cywgZW5jb2RpbmcudG9VaW50OEFycmF5KGVuY29kZXIpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlIE1FU1NBR0VfQVdBUkVORVNTOiB7XG4gICAgICAgICAgYXBwbHlBd2FyZW5lc3NVcGRhdGUoYXdhcmVuZXNzLCBkZWNvZGluZy5yZWFkVmFyVWludDhBcnJheShkZWNvZGVyKSwgd3MpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBXaXJlIGRvYyB1cGRhdGVzIOKGkiBicm9hZGNhc3QgdG8gc2VydmVyLiBPcmlnaW4gdGFnZ2VkIHdpdGggdGhlIHdzIHNvXG4gIC8vIHNlcnZlci1zaWRlIHVwZGF0ZXMgd2UgcmVjZWl2ZSBkb24ndCBlY2hvIGJhY2suXG4gIGNvbnN0IG9uRG9jVXBkYXRlID0gKHVwZGF0ZTogVWludDhBcnJheSwgb3JpZ2luOiB1bmtub3duKSA9PiB7XG4gICAgY29uc3Qgd3MgPSB3c1JlZjtcbiAgICBpZiAoIXdzIHx8IHdzLnJlYWR5U3RhdGUgIT09IFdlYlNvY2tldC5PUEVOKSByZXR1cm47XG4gICAgaWYgKG9yaWdpbiA9PT0gd3MpIHJldHVybjsgLy8gY2FtZSBmcm9tIHNlcnZlciwgZG9uJ3QgZWNob1xuICAgIGJyb2FkY2FzdFN5bmNVcGRhdGUod3MsIHVwZGF0ZSk7XG4gIH07XG4gIGRvYy5vbigndXBkYXRlJywgb25Eb2NVcGRhdGUpO1xuXG4gIC8vIFdpcmUgYXdhcmVuZXNzIGNoYW5nZXMg4oaSIGJyb2FkY2FzdC4gU2FtZSBvcmlnaW4gZ3VhcmQuXG4gIGNvbnN0IG9uQXdhcmVuZXNzVXBkYXRlID0gKFxuICAgIHsgYWRkZWQsIHVwZGF0ZWQsIHJlbW92ZWQgfTogeyBhZGRlZDogbnVtYmVyW107IHVwZGF0ZWQ6IG51bWJlcltdOyByZW1vdmVkOiBudW1iZXJbXSB9LFxuICAgIG9yaWdpbjogdW5rbm93blxuICApID0+IHtcbiAgICBjb25zdCB3cyA9IHdzUmVmO1xuICAgIGlmICghd3MgfHwgd3MucmVhZHlTdGF0ZSAhPT0gV2ViU29ja2V0Lk9QRU4pIHJldHVybjtcbiAgICBpZiAob3JpZ2luID09PSB3cykgcmV0dXJuO1xuICAgIGNvbnN0IGNoYW5nZWQgPSBhZGRlZC5jb25jYXQodXBkYXRlZCwgcmVtb3ZlZCk7XG4gICAgYnJvYWRjYXN0QXdhcmVuZXNzKHdzLCBjaGFuZ2VkKTtcbiAgfTtcbiAgYXdhcmVuZXNzLm9uKCd1cGRhdGUnLCBvbkF3YXJlbmVzc1VwZGF0ZSk7XG5cbiAgc2Vzc2lvbi5zdG9wID0gKCkgPT4ge1xuICAgIGlkZW50aXR5Q2FuY2VsbGVkID0gdHJ1ZTtcbiAgICBjYW5jZWxsZWQgPSB0cnVlO1xuICAgIGlmIChyZWNvbm5lY3RUaW1lcikgY2xlYXJUaW1lb3V0KHJlY29ubmVjdFRpbWVyKTtcbiAgICBkb2Mub2ZmKCd1cGRhdGUnLCBvbkRvY1VwZGF0ZSk7XG4gICAgYXdhcmVuZXNzLm9mZigndXBkYXRlJywgb25Bd2FyZW5lc3NVcGRhdGUpO1xuICAgIGNvbnN0IHdzID0gd3NSZWY7XG4gICAgaWYgKHdzICYmIHdzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5PUEVOKSB7XG4gICAgICB0cnkge1xuICAgICAgICB3cy5jbG9zZSgpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgfVxuICAgIH1cbiAgICB0cnkge1xuICAgICAgYXdhcmVuZXNzLmRlc3Ryb3koKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIGlnbm9yZSAqL1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgZG9jLmRlc3Ryb3koKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIGlnbm9yZSAqL1xuICAgIH1cbiAgfTtcblxuICBjb25uZWN0KCk7XG4gIHJldHVybiBzZXNzaW9uO1xufVxuXG5mdW5jdGlvbiBzY2hlZHVsZVNlc3Npb25EZXN0cm95KHM6IENvbGxhYlNlc3Npb24pOiB2b2lkIHtcbiAgaWYgKHMuZGVzdHJveVRpbWVyKSByZXR1cm47XG4gIHMuZGVzdHJveVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgZ2V0U2Vzc2lvbnMoKS5kZWxldGUocy5zbHVnKTtcbiAgICBzLnN0b3AoKTtcbiAgfSwgU0VTU0lPTl9HUkFDRV9NUyk7XG59XG5cbi8qKiBJZGVtcG90ZW50IGdldC1vci1jcmVhdGUgKGNhbGxlZCBpbiByZW5kZXIgc28gY2hpbGRyZW4gZ2V0IGEgbGl2ZSBkb2Mgb25cbiAqICBmaXJzdCByZW5kZXIpLiBBIGZyZXNobHkgY3JlYXRlZCBzZXNzaW9uIHNlbGYtZGVzdHJ1Y3RzIGFmdGVyIHRoZSBncmFjZVxuICogIHdpbmRvdyB1bmxlc3MgYSBtb3VudCBlZmZlY3QgcmV0YWlucyBpdCDigJQgc28gYSB0aHJvd24tYXdheSByZW5kZXIgY2FuJ3QgbGVha1xuICogIGEgc29ja2V0LiAqL1xuZnVuY3Rpb24gcGVla09yQ3JlYXRlU2Vzc2lvbihzbHVnOiBzdHJpbmcpOiBDb2xsYWJTZXNzaW9uIHtcbiAgY29uc3Qgc2Vzc2lvbnMgPSBnZXRTZXNzaW9ucygpO1xuICBsZXQgcyA9IHNlc3Npb25zLmdldChzbHVnKTtcbiAgaWYgKCFzKSB7XG4gICAgcyA9IGNyZWF0ZVNlc3Npb24oc2x1Zyk7XG4gICAgc2Vzc2lvbnMuc2V0KHNsdWcsIHMpO1xuICAgIHNjaGVkdWxlU2Vzc2lvbkRlc3Ryb3kocyk7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG5cbmZ1bmN0aW9uIHJldGFpblNlc3Npb24oc2x1Zzogc3RyaW5nKTogQ29sbGFiU2Vzc2lvbiB7XG4gIGNvbnN0IHMgPSBwZWVrT3JDcmVhdGVTZXNzaW9uKHNsdWcpO1xuICBpZiAocy5kZXN0cm95VGltZXIpIHtcbiAgICBjbGVhclRpbWVvdXQocy5kZXN0cm95VGltZXIpO1xuICAgIHMuZGVzdHJveVRpbWVyID0gbnVsbDtcbiAgfVxuICBzLnJlZkNvdW50Kys7XG4gIHJldHVybiBzO1xufVxuXG5mdW5jdGlvbiByZWxlYXNlU2Vzc2lvbihzbHVnOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgcyA9IGdldFNlc3Npb25zKCkuZ2V0KHNsdWcpO1xuICBpZiAoIXMpIHJldHVybjtcbiAgcy5yZWZDb3VudCA9IE1hdGgubWF4KDAsIHMucmVmQ291bnQgLSAxKTtcbiAgaWYgKHMucmVmQ291bnQgPT09IDApIHNjaGVkdWxlU2Vzc2lvbkRlc3Ryb3kocyk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUHJvdmlkZXIg4oCUIHRoaW4gY29uc3VtZXIgb2YgdGhlIHNoYXJlZCBzZXNzaW9uIChsaWZldGltZSBvd25lZCBhYm92ZSkuXG5cbmludGVyZmFjZSBDb2xsYWJQcm92aWRlclByb3BzIHtcbiAgLyoqIENhbnZhcyBzbHVnIOKAlCBtdXN0IG1hdGNoIHNlcnZlci1zaWRlIGBwYXJzZUNvbGxhYlNsdWdgLiAqL1xuICBzbHVnOiBzdHJpbmc7XG4gIGNoaWxkcmVuOiBSZWFjdE5vZGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBDb2xsYWJQcm92aWRlcih7IHNsdWcsIGNoaWxkcmVuIH06IENvbGxhYlByb3ZpZGVyUHJvcHMpOiBKU1guRWxlbWVudCB7XG4gIC8vIEFjcXVpcmUgKGdldC1vci1jcmVhdGUpIGZvciByZW5kZXIgc28gY2hpbGRyZW4gc2VlIGEgbGl2ZSBkb2MgaW1tZWRpYXRlbHk7XG4gIC8vIHRoZSByZWZjb3VudCArIHRlYXJkb3duIGxpZmV0aW1lIGlzIG1hbmFnZWQgaW4gdGhlIGVmZmVjdCBiZWxvdyBzbyBhXG4gIC8vIGhvdC1zd2FwIHJlbW91bnQgcmV1c2VzIHRoZSBTQU1FIHNvY2tldCAobm8gcHJlc2VuY2UgYmxpbmsg4oCUIEY0KS5cbiAgY29uc3Qgc2Vzc2lvbiA9IHBlZWtPckNyZWF0ZVNlc3Npb24oc2x1Zyk7XG4gIGNvbnN0IFssIGZvcmNlUmVuZGVyXSA9IHVzZVJlZHVjZXIoKGM6IG51bWJlcikgPT4gYyArIDEsIDApO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgcyA9IHJldGFpblNlc3Npb24oc2x1Zyk7XG4gICAgY29uc3QgbGlzdGVuZXIgPSAoKSA9PiBmb3JjZVJlbmRlcigpO1xuICAgIHMubGlzdGVuZXJzLmFkZChsaXN0ZW5lcik7XG4gICAgLy8gSWRlbnRpdHkgLyBjb25uZWN0aW9uIG1heSBoYXZlIHJlc29sdmVkIGJldHdlZW4gcmVuZGVyIGFuZCB0aGlzIGVmZmVjdC5cbiAgICBmb3JjZVJlbmRlcigpO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBzLmxpc3RlbmVycy5kZWxldGUobGlzdGVuZXIpO1xuICAgICAgcmVsZWFzZVNlc3Npb24oc2x1Zyk7XG4gICAgfTtcbiAgfSwgW3NsdWddKTtcblxuICBjb25zdCB7IGRvYywgYXdhcmVuZXNzLCBjb25uSWQ6IG15Q29ubklkLCBuYW1lOiBteU5hbWUsIGNvbG9yOiBteUNvbG9yLCBjb25uZWN0ZWQgfSA9IHNlc3Npb247XG5cbiAgLy8g4pSA4pSAIFRocm90dGxlZCBhd2FyZW5lc3MgcHVibGlzaCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAgY29uc3QgcGVuZGluZ1JlZiA9IHVzZVJlZjxQYXJ0aWFsPE9taXQ8Q29sbGFiQXdhcmVuZXNzU3RhdGUsICdfX2Nvbm5JZCc+PiB8IG51bGw+KG51bGwpO1xuICBjb25zdCB0aHJvdHRsZVRpbWVyUmVmID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG5cbiAgY29uc3QgcHVibGlzaEF3YXJlbmVzcyA9IHVzZUNhbGxiYWNrKFxuICAgIChwYXRjaDogUGFydGlhbDxPbWl0PENvbGxhYkF3YXJlbmVzc1N0YXRlLCAnX19jb25uSWQnPj4pID0+IHtcbiAgICAgIHBlbmRpbmdSZWYuY3VycmVudCA9IHsgLi4uKHBlbmRpbmdSZWYuY3VycmVudCA/PyB7fSksIC4uLnBhdGNoIH07XG4gICAgICBpZiAodGhyb3R0bGVUaW1lclJlZi5jdXJyZW50KSByZXR1cm47XG4gICAgICB0aHJvdHRsZVRpbWVyUmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhyb3R0bGVUaW1lclJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgICAgY29uc3QgbmV4dCA9IHBlbmRpbmdSZWYuY3VycmVudDtcbiAgICAgICAgcGVuZGluZ1JlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgICAgaWYgKCFuZXh0KSByZXR1cm47XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSAoYXdhcmVuZXNzLmdldExvY2FsU3RhdGUoKSA/PyB7fSkgYXMgUGFydGlhbDxDb2xsYWJBd2FyZW5lc3NTdGF0ZT47XG4gICAgICAgIGF3YXJlbmVzcy5zZXRMb2NhbFN0YXRlKHtcbiAgICAgICAgICBuYW1lOiBjdXJyZW50Lm5hbWUgPz8gc2Vzc2lvbi5uYW1lLFxuICAgICAgICAgIGNvbG9yOiBjdXJyZW50LmNvbG9yID8/IHNlc3Npb24uY29sb3IsXG4gICAgICAgICAgY3Vyc29yOiBjdXJyZW50LmN1cnNvciA/PyBudWxsLFxuICAgICAgICAgIHNlbGVjdGlvbjogY3VycmVudC5zZWxlY3Rpb24gPz8gbnVsbCxcbiAgICAgICAgICBhbm5vdGF0aW9uU2VsZWN0aW9uOiBjdXJyZW50LmFubm90YXRpb25TZWxlY3Rpb24gPz8gW10sXG4gICAgICAgICAgdmlld3BvcnQ6IGN1cnJlbnQudmlld3BvcnQgPz8geyB4OiAwLCB5OiAwLCB6b29tOiAxIH0sXG4gICAgICAgICAgZWRpdGluZzogY3VycmVudC5lZGl0aW5nID8/IG51bGwsXG4gICAgICAgICAgX19jb25uSWQ6IG15Q29ubklkLFxuICAgICAgICAgIC4uLm5leHQsXG4gICAgICAgIH0gc2F0aXNmaWVzIENvbGxhYkF3YXJlbmVzc1N0YXRlKTtcbiAgICAgIH0sIEFXQVJFTkVTU19USFJPVFRMRV9NUyk7XG4gICAgfSxcbiAgICBbYXdhcmVuZXNzLCBzZXNzaW9uLCBteUNvbm5JZF1cbiAgKTtcblxuICAvLyDilIDilIAgQ2xlYW51cCB0aHJvdHRsZSB0aW1lciBvbiB1bm1vdW50IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICB1c2VFZmZlY3QoXG4gICAgKCkgPT4gKCkgPT4ge1xuICAgICAgaWYgKHRocm90dGxlVGltZXJSZWYuY3VycmVudCkgY2xlYXJUaW1lb3V0KHRocm90dGxlVGltZXJSZWYuY3VycmVudCk7XG4gICAgfSxcbiAgICBbXVxuICApO1xuXG4gIGNvbnN0IHZhbHVlID0gdXNlTWVtbzxDb2xsYWJWYWx1ZT4oXG4gICAgKCkgPT4gKHtcbiAgICAgIGRvYyxcbiAgICAgIGF3YXJlbmVzcyxcbiAgICAgIG15Q29sb3IsXG4gICAgICBteU5hbWUsXG4gICAgICBteUNvbm5JZCxcbiAgICAgIGNvbm5lY3RlZCxcbiAgICAgIHB1Ymxpc2hBd2FyZW5lc3MsXG4gICAgfSksXG4gICAgW2RvYywgYXdhcmVuZXNzLCBteUNvbG9yLCBteU5hbWUsIG15Q29ubklkLCBjb25uZWN0ZWQsIHB1Ymxpc2hBd2FyZW5lc3NdXG4gICk7XG5cbiAgcmV0dXJuIDxDb2xsYWJDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXt2YWx1ZX0+e2NoaWxkcmVufTwvQ29sbGFiQ29udGV4dC5Qcm92aWRlcj47XG59XG4iLAogICAgIi8qKlxuICogQGZpbGUgICAgICAgdXNlLXNlbGVjdGlvbi1zZXQudHN4IOKAlCBQaGFzZSA0LjEgbXVsdGktc2VsZWN0aW9uIHN0b3JlXG4gKiBAc2NvcGUgICAgICBhcHBzL3N0dWRpby91c2Utc2VsZWN0aW9uLXNldC50c3hcbiAqIEBwdXJwb3NlICAgIE11bHRpLWVsZW1lbnQgc2VsZWN0aW9uIHN0YXRlIGZvciBjYW52YXMtc2hlbGwuIFRoZSBjYW52YXNcbiAqICAgICAgICAgICAgIGlucHV0IHJvdXRlciBjYWxscyBgcmVwbGFjZSgpYCAvIGBhZGQoKWAgLyBgY2xlYXIoKWA7XG4gKiAgICAgICAgICAgICB0aGUgcHJvdmlkZXIgZGVib3VuY2VzIGFuZCBwb3N0cyB1cCB0byB0aGUgZGV2LXNlcnZlciBzaGVsbFxuICogICAgICAgICAgICAgdGhyb3VnaCB0aGUgZXhpc3RpbmcgYF9fZGVzaWduX3NlbGVjdGVkYCB3aW5kb3cucGFyZW50IGNoYW5uZWxcbiAqICAgICAgICAgICAgIHNvIGBfYWN0aXZlLmpzb25gIHJlZmxlY3RzIHRoZSBjdXJyZW50IHNlbGVjdGlvbiBzZXQuXG4gKlxuICogU2NoZW1hIG1pZ3JhdGlvbi4gYF9hY3RpdmUuanNvbiNzZWxlY3RlZGAgaGlzdG9yaWNhbGx5IGhvbGRzXG4gKiAgICAgc2VsZWN0ZWQ6IFNlbGVjdGVkRWxlbWVudCB8IG51bGxcbiAqIFBoYXNlIDQuMSB3aWRlbnMgdG9cbiAqICAgICBzZWxlY3RlZDogU2VsZWN0ZWRFbGVtZW50IHwgU2VsZWN0ZWRFbGVtZW50W10gfCBudWxsXG4gKiBXcml0ZXI6IGVtaXRzIGEgc2luZ2xlIG9iamVjdCB3aGVuIE4gPT09IDEgKGJhY2stY29tcGF0IHdpdGggZG93bnN0cmVhbVxuICogdG9vbHMgdGhhdCBzdGlsbCByZWFkIHRoZSBsZWdhY3kgc2hhcGUg4oCUIGAvZGVzaWduOmVkaXRgLCBoYW5kb2ZmKS4gRW1pdHMgYW5cbiAqIGFycmF5IHdoZW4gTiA+IDEuIFJlYWRlciAodGhpcyBob29rIG9uIHJlaHlkcmF0ZSkgYWNjZXB0cyBhbGwgdGhyZWUuXG4gKi9cblxuaW1wb3J0IHtcbiAgY3JlYXRlQ29udGV4dCxcbiAgdHlwZSBSZWFjdE5vZGUsXG4gIHVzZUNhbGxiYWNrLFxuICB1c2VDb250ZXh0LFxuICB1c2VFZmZlY3QsXG4gIHVzZU1lbW8sXG4gIHVzZVJlZixcbiAgdXNlU3RhdGUsXG59IGZyb20gJ3JlYWN0JztcblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUeXBlc1xuXG4vKipcbiAqIE1pbmltYWwgU2VsZWN0aW9uIHNoYXBlIHRoYXQgdHJhdmVscyB0aHJvdWdoIHRoZSBwYXJlbnQgcG9zdE1lc3NhZ2UgY2hhbm5lbC5cbiAqIE1pcnJvcnMgYFNlbGVjdGVkRWxlbWVudGAgZnJvbSBpbnNwZWN0LnRzIGJ1dCB0aGUgY2FudmFzIHJvdXRlciBjb21wdXRlcyBpdFxuICogY2xpZW50LXNpZGUgYW5kIHRoZSBpbnNwZWN0b3Igb3ZlcmxheSdzIGVucmljaG1lbnQgZmllbGRzIChodG1sIGV4Y2VycHQsXG4gKiBkb21fcGF0aCwgY2xhc3Nlcy4uLikgYXJlIGZpbGxlZCBpbiBieSB0aGUgcm91dGVyIHJpZ2h0IGJlZm9yZSB0aGUgbWVzc2FnZVxuICogaXMgcG9zdGVkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNlbGVjdGlvbiB7XG4gIC8qKiBDYW52YXMgZmlsZSBwYXRoIOKAlCBkZXNpZ25SZWwtcHJlZml4ZWQgKGUuZy4gYC5kZXNpZ24vdWkvRm9vLnRzeGApLiAqL1xuICBmaWxlPzogc3RyaW5nO1xuICAvKiogU3RhYmxlIGBkYXRhLWNkLWlkYCBhbmNob3Igd2hlbiBwcmVzZW50LiB2Mi1ncmFkZSBvbmx5LiAqL1xuICBpZD86IHN0cmluZztcbiAgLyoqIENTUy1zZWxlY3RvciBmYWxsYmFjayBwYXRoIChhbHdheXMgcHJlc2VudCkuICovXG4gIHNlbGVjdG9yOiBzdHJpbmc7XG4gIC8qKiBBcnRib2FyZCBob3N0IChgZGF0YS1kYy1zY3JlZW5gKSDigJQgZm9yIHNjb3BpbmcgbXVsdGktZWRpdHMgaW4gZnV0dXJlLiAqL1xuICBhcnRib2FyZElkPzogc3RyaW5nIHwgbnVsbDtcbiAgLyoqXG4gICAqIE9jY3VycmVuY2UgaW5kZXggb2YgdGhpcyBlbGVtZW50IGFtb25nIGBxdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKWAuXG4gICAqIGRhdGEtY2QtaWQgaXMgc3RhbXBlZCBwZXIgU09VUkNFIGVsZW1lbnQsIHNvIGEgY29tcG9uZW50IHJlbmRlcmVkIE4gdGltZXNcbiAgICogKGEgbGlzdCByb3csIG9yIGEgcmV1c2FibGUgdXNlZCB0d2ljZSkgeWllbGRzIE4gRE9NIG5vZGVzIHdpdGggdGhlIFNBTUVcbiAgICogaWQrYXJ0Ym9hcmQgc2VsZWN0b3IuIFRoZSBpbmRleCBkaXNhbWJpZ3VhdGVzIHdoaWNoIGluc3RhbmNlIOKAlCByZXNvbHZlcnNcbiAgICogdXNlIGBxdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKVtpbmRleF1gLiBBYnNlbnQvMCDihpIgZmlyc3QgbWF0Y2guXG4gICAqL1xuICBpbmRleD86IG51bWJlcjtcbiAgLyoqIFNuYXBzaG90IGZpZWxkcyBmaWxsZWQgYnkgdGhlIHJvdXRlciBmcm9tIGByZXNvbHZlSG92ZXJUYXJnZXRgLiAqL1xuICB0YWc/OiBzdHJpbmc7XG4gIGNsYXNzZXM/OiBzdHJpbmc7XG4gIHRleHQ/OiBzdHJpbmc7XG4gIGRvbV9wYXRoPzogc3RyaW5nW107XG4gIGJvdW5kcz86IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHc6IG51bWJlcjsgaDogbnVtYmVyIH0gfCBudWxsO1xuICAvKiogU3RhZ2UgRDQgdGFpbCDigJQgV09STEQtdW5pdCBzaXplIChgb2Zmc2V0V2lkdGhgL2BvZmZzZXRIZWlnaHRgLCB1bmFmZmVjdGVkIGJ5XG4gICAqICB0aGUgYC5kYy13b3JsZGAgem9vbSB0cmFuc2Zvcm0sIHVubGlrZSBgYm91bmRzYCB3aGljaCBpcyB0aGUgU0NSRUVOIHJlY3QpLlxuICAgKiAgVGhlIEluc3BlY3RvcidzIGFydGJvYXJkLXJlc2l6ZSBmaWVsZHMgbmVlZCB0aGUgdHJ1ZSBKU1gtYXV0aG9yZWQgc2l6ZSB0b1xuICAgKiAgcHJlLWZpbGwgY29ycmVjdGx5IHJlZ2FyZGxlc3Mgb2Ygem9vbS4gKi9cbiAgd29ybGRXPzogbnVtYmVyO1xuICB3b3JsZEg/OiBudW1iZXI7XG4gIGh0bWw/OiBzdHJpbmc7XG4gIC8qKiBQaGFzZSAxMi4yIOKAlCBhdXRob3JlZCBpbmxpbmUtc3R5bGUgdmFsdWVzIChrbm9iIHByZS1maWxsKSArIHJlc29sdmVkIGNvbXB1dGVkIChwbGFjZWhvbGRlciBoaW50KS4gKi9cbiAgYXV0aG9yZWQ/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBjb21wdXRlZD86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIC8qKiBQaGFzZSAxMi4zIOKAlCBhdXRob3JlZCBpbmxpbmUtc3R5bGUgcHJvcHMgT1VUU0lERSB0aGUgY3VyYXRlZCBrbm9iIHNldCwgc28gdGhlXG4gICAqICBwYW5lbCBjYW4gc3VyZmFjZSBhIGN1c3RvbSBDU1MgcHJvcGVydHkgdGhlIHVzZXIgYWRkZWQgKGUuZy4gYGxldHRlci1zcGFjaW5nYCkuICovXG4gIGN1c3RvbVN0eWxlcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIC8qKiBQaGFzZSAxMi4zIOKAlCBjdXN0b20gSFRNTCBhdHRyaWJ1dGVzIG9uIHRoZSBlbGVtZW50IChkYXRhLSwgYXJpYS0sIHJvbGUsIHRpdGxl4oCmKSxcbiAgICogIHNvIHRoZSBwYW5lbCByZWZsZWN0cyBhIGN1c3RvbSBhdHRyaWJ1dGUgdGhlIHVzZXIgYWRkZWQgdmlhIHRoZSBlc2NhcGUgaGF0Y2guICovXG4gIGF0dHJzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgLyoqIFN0YWdlIE0g4oCUIHRoZSBQQVJFTlQgZWxlbWVudCdzIHJlc29sdmVkIGBkaXNwbGF5YCArIGBmbGV4LWRpcmVjdGlvbmAsIGNhcHR1cmVkXG4gICAqICBhdCBzZWxlY3Rpb24gdGltZSAodGhlIHNoZWxsIGNhbid0IHJlYWNoIHRoZSBjcm9zcy1vcmlnaW4gaWZyYW1lIHRvIHJlYWQgdGhlbVxuICAgKiAgbGF0ZXIpLiBEcml2ZXMgdGhlIEZpeGVkL0h1Zy9GaWxsIHNpemluZyBjb250cm9sOiBcIkZpbGxcIiBpcyBgZmxleC1ncm93OjFgIG9uIGFcbiAgICogIGZsZXggY2hpbGQncyBNQUlOIGF4aXMsIGBhbGlnbi1zZWxmOnN0cmV0Y2hgIG9uIGl0cyBjcm9zcyBheGlzLCBlbHNlIGAxMDAlYC4gQWxzb1xuICAgKiAgZ2F0ZXMgdGhlIGZsZXgtY2hpbGQgKGFsaWduLXNlbGYgLyBmbGV4LWdyb3figKYpIHJvd3Mgc28gdGhleSBkb24ndCBzaG93IG9uIGFcbiAgICogIGJsb2NrIGNoaWxkLiBBYnNlbnQgZm9yIGEgZGV0YWNoZWQgbm9kZSAvIG5vIHBhcmVudC4gKi9cbiAgcGFyZW50RGlzcGxheT86IHN0cmluZztcbiAgcGFyZW50RmxleERpcmVjdGlvbj86IHN0cmluZztcbiAgLyoqIGZlYXR1cmUtcGhvdG8tZWRpdG9yIChUYXNrIDE0KSDigJQgc2V0IGF0IHNlbGVjdGlvbiByZXNvbHV0aW9uIHdoZW4gdGhlIGhpdCBpc1xuICAgKiAgYSBjb250ZW50LWFkZHJlc3NlZCBwaG90by4gYGFydGJvYXJkLWltZ2AgPSBhbiBgPGltZyBzcmM9XCJhc3NldHMvPHNoYTg+LjxleHQ+XCI+YFxuICAgKiAgYXV0aG9yZWQgaW4gYXJ0Ym9hcmQgVFNYOyBgYW5ub3RhdGlvbi1pbWFnZWAgaXMgdGhyZWFkZWQgc2VwYXJhdGVseSAodGhlXG4gICAqICBhbm5vdGF0aW9uIG1vZGVsIGhhcyBubyBkYXRhLWNkLWlkLCBzbyBpdCBuZXZlciByaWRlcyB0aGlzIERPTS1zZWxlY3Rpb25cbiAgICogIHBhdGgg4oCUIHNlZSBhcHAuanN4J3MgYGVkaXQtYW5ub3RhdGlvbi1waG90by1yZXF1ZXN0YCBoYW5kbGVyKS4gQWJzZW50IGZvciBhXG4gICAqICBub24tcGhvdG8gZWxlbWVudCBvciBhbiBgPGltZz5gIHdob3NlIHNyYyBpc24ndCBjb250ZW50LWFkZHJlc3NlZC4gKi9cbiAgcGhvdG9LaW5kPzogJ2FydGJvYXJkLWltZycgfCAnYW5ub3RhdGlvbi1pbWFnZSc7XG4gIC8qKiBUaGUgcmVzb2x2ZWQgYGFzc2V0cy88c2hhOD4uPGV4dD5gIHNvdXJjZSwgd2hlbiBgcGhvdG9LaW5kYCBpcyBzZXQg4oCUIHRoZSBrZXlcbiAgICogIHRoZSBQaG90byB0YWIgcGFzc2VzIHRvIGAvX2FwaS9waG90by1lZGl0YC4gKi9cbiAgcGhvdG9Bc3NldD86IHN0cmluZztcbn1cblxuLyoqIGZlYXR1cmUtcGhvdG8tZWRpdG9yIOKAlCBwdWxsIHRoZSBjb250ZW50LWFkZHJlc3NlZCBgYXNzZXRzLzxzaGE4Pi48ZXh0PmAgb3V0IG9mXG4gKiAgYW4gaW1hZ2Ugc3JjIChyZWxhdGl2ZSwgYWJzb2x1dGUsIG9yIGVtYmVkZGVkIGluIGFuIG91dGVySFRNTCBleGNlcnB0KS4gUmV0dXJuc1xuICogIG51bGwgZm9yIGEgbm9uLWNvbnRlbnQtYWRkcmVzc2VkIHNyYyAoZXh0ZXJuYWwgVVJMLCBTVkcgaWNvbiwgZGF0YTogVVJJKSDigJQgdGhvc2VcbiAqICBhcmVuJ3QgZWRpdGFibGUgYnkgdGhlIHNpZGVjYXIta2V5ZWQgcGhvdG8gcGlwZWxpbmUuIEV4cG9ydGVkIHNvIGJvdGggdGhlXG4gKiAgc2VsZWN0aW9uIHJlc29sdmVyIGFuZCB0aGUgSW5zcGVjdG9yJ3MgZmFsbGJhY2sgZGVyaXZhdGlvbiBzaGFyZSBvbmUgcmVnZXguICovXG5leHBvcnQgZnVuY3Rpb24gcGhvdG9Bc3NldEZyb21TdHJpbmcoczogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IG51bGwge1xuICBpZiAoIXMpIHJldHVybiBudWxsO1xuICBjb25zdCBtID0gL2Fzc2V0c1xcL1swLTlhLWZdezh9XFwuW2EtejAtOV0rL2kuZXhlYyhzKTtcbiAgcmV0dXJuIG0gPyBtWzBdIDogbnVsbDtcbn1cblxuaW50ZXJmYWNlIFNlbGVjdGlvblNldFZhbHVlIHtcbiAgc2VsZWN0ZWQ6IFNlbGVjdGlvbltdO1xuICByZXBsYWNlOiAoczogU2VsZWN0aW9uIHwgU2VsZWN0aW9uW10pID0+IHZvaWQ7XG4gIGFkZDogKHM6IFNlbGVjdGlvbiB8IFNlbGVjdGlvbltdKSA9PiB2b2lkO1xuICByZW1vdmU6IChzOiBTZWxlY3Rpb24pID0+IHZvaWQ7XG4gIHRvZ2dsZTogKHM6IFNlbGVjdGlvbikgPT4gdm9pZDtcbiAgY2xlYXI6ICgpID0+IHZvaWQ7XG59XG5cbmNvbnN0IFNlbGVjdGlvblNldENvbnRleHQgPSBjcmVhdGVDb250ZXh0PFNlbGVjdGlvblNldFZhbHVlIHwgbnVsbD4obnVsbCk7XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gSWRlbnRpdHkuIFByZWZlciBgaWRgIChkYXRhLWNkLWlkIHN0YWJsZSBhbmNob3IpOyBmYWxsIGJhY2sgdG8gc2VsZWN0b3IuXG5cbmZ1bmN0aW9uIHNlbGVjdGlvbktleShzOiBTZWxlY3Rpb24pOiBzdHJpbmcge1xuICByZXR1cm4gcy5pZCA/IGBpZDoke3MuaWR9YCA6IGBzZWw6JHtzLnNlbGVjdG9yfWA7XG59XG5cbmZ1bmN0aW9uIGRlZHVwZShsaXN0OiBTZWxlY3Rpb25bXSk6IFNlbGVjdGlvbltdIHtcbiAgY29uc3Qgb3V0OiBTZWxlY3Rpb25bXSA9IFtdO1xuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgcyBvZiBsaXN0KSB7XG4gICAgY29uc3QgayA9IHNlbGVjdGlvbktleShzKTtcbiAgICBpZiAoc2Vlbi5oYXMoaykpIGNvbnRpbnVlO1xuICAgIHNlZW4uYWRkKGspO1xuICAgIG91dC5wdXNoKHMpO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUHJvdmlkZXJcblxuY29uc3QgUE9TVF9ERUJPVU5DRV9NUyA9IDUwOyAvLyBtaXJyb3JzIGNhbnZhcy1saWIncyBTRVRUTEUvUFVCTElTSCBjYWRlbmNlXG5cbmV4cG9ydCBmdW5jdGlvbiBTZWxlY3Rpb25TZXRQcm92aWRlcih7XG4gIGNoaWxkcmVuLFxuICAvKiogT3ZlcnJpZGUgdGhlIHBvc3RNZXNzYWdlIGRlc3RpbmF0aW9uICh1c2VkIGluIHRlc3RzKS4gKi9cbiAgcG9zdFRhcmdldCxcbn06IHtcbiAgY2hpbGRyZW46IFJlYWN0Tm9kZTtcbiAgcG9zdFRhcmdldD86IHsgcG9zdE1lc3NhZ2U6IChtc2c6IHVua25vd24sIHRhcmdldE9yaWdpbjogc3RyaW5nKSA9PiB2b2lkIH0gfCBudWxsO1xufSkge1xuICBjb25zdCBbc2VsZWN0ZWQsIHNldFNlbGVjdGVkXSA9IHVzZVN0YXRlPFNlbGVjdGlvbltdPihbXSk7XG4gIGNvbnN0IHRpbWVyUmVmID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbD4obnVsbCk7XG5cbiAgY29uc3QgcG9zdCA9IHVzZUNhbGxiYWNrKFxuICAgIChuZXh0OiBTZWxlY3Rpb25bXSkgPT4ge1xuICAgICAgaWYgKHRpbWVyUmVmLmN1cnJlbnQpIGNsZWFyVGltZW91dCh0aW1lclJlZi5jdXJyZW50KTtcbiAgICAgIHRpbWVyUmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGltZXJSZWYuY3VycmVudCA9IG51bGw7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHBvc3RUYXJnZXQgPz8gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93LnBhcmVudCA6IG51bGwpO1xuICAgICAgICBpZiAoIXRhcmdldCkgcmV0dXJuO1xuICAgICAgICAvLyBXaXJlIHNoYXBlOiBzaW5nbGUgb2JqZWN0IGZvciBOPTEgKGJhY2stY29tcGF0KSwgYXJyYXkgZm9yIE4+MSwgbnVsbCBmb3IgZW1wdHkuXG4gICAgICAgIGNvbnN0IHBheWxvYWQ6IFNlbGVjdGlvbiB8IFNlbGVjdGlvbltdIHwgbnVsbCA9XG4gICAgICAgICAgbmV4dC5sZW5ndGggPT09IDAgPyBudWxsIDogbmV4dC5sZW5ndGggPT09IDEgPyAobmV4dFswXSA/PyBudWxsKSA6IG5leHQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGFyZ2V0LnBvc3RNZXNzYWdlKHsgZGduOiAnc2VsZWN0LXNldCcsIHNlbGVjdGlvbjogcGF5bG9hZCB9LCAnKicpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvKiBpZnJhbWUgbGlrZWx5IGNyb3NzLW9yaWdpbiBvciBkZXRhY2hlZCAqL1xuICAgICAgICB9XG4gICAgICB9LCBQT1NUX0RFQk9VTkNFX01TKTtcbiAgICB9LFxuICAgIFtwb3N0VGFyZ2V0XVxuICApO1xuXG4gIC8vIENsZWFudXAgdGhlIGRlYm91bmNlIHRpbWVyIG9uIHVubW91bnQuXG4gIHVzZUVmZmVjdChcbiAgICAoKSA9PiAoKSA9PiB7XG4gICAgICBpZiAodGltZXJSZWYuY3VycmVudCkgY2xlYXJUaW1lb3V0KHRpbWVyUmVmLmN1cnJlbnQpO1xuICAgIH0sXG4gICAgW11cbiAgKTtcblxuICBjb25zdCByZXBsYWNlID0gdXNlQ2FsbGJhY2soXG4gICAgKHM6IFNlbGVjdGlvbiB8IFNlbGVjdGlvbltdKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gZGVkdXBlKEFycmF5LmlzQXJyYXkocykgPyBzIDogW3NdKTtcbiAgICAgIHNldFNlbGVjdGVkKG5leHQpO1xuICAgICAgcG9zdChuZXh0KTtcbiAgICB9LFxuICAgIFtwb3N0XVxuICApO1xuXG4gIGNvbnN0IGFkZCA9IHVzZUNhbGxiYWNrKFxuICAgIChzOiBTZWxlY3Rpb24gfCBTZWxlY3Rpb25bXSkgPT4ge1xuICAgICAgY29uc3QgaW5jb21pbmcgPSBBcnJheS5pc0FycmF5KHMpID8gcyA6IFtzXTtcbiAgICAgIHNldFNlbGVjdGVkKChwcmV2KSA9PiB7XG4gICAgICAgIGNvbnN0IG5leHQgPSBkZWR1cGUoWy4uLnByZXYsIC4uLmluY29taW5nXSk7XG4gICAgICAgIHBvc3QobmV4dCk7XG4gICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBbcG9zdF1cbiAgKTtcblxuICBjb25zdCByZW1vdmUgPSB1c2VDYWxsYmFjayhcbiAgICAoczogU2VsZWN0aW9uKSA9PiB7XG4gICAgICBjb25zdCBrID0gc2VsZWN0aW9uS2V5KHMpO1xuICAgICAgc2V0U2VsZWN0ZWQoKHByZXYpID0+IHtcbiAgICAgICAgY29uc3QgbmV4dCA9IHByZXYuZmlsdGVyKCh4KSA9PiBzZWxlY3Rpb25LZXkoeCkgIT09IGspO1xuICAgICAgICBwb3N0KG5leHQpO1xuICAgICAgICByZXR1cm4gbmV4dDtcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgW3Bvc3RdXG4gICk7XG5cbiAgY29uc3QgdG9nZ2xlID0gdXNlQ2FsbGJhY2soXG4gICAgKHM6IFNlbGVjdGlvbikgPT4ge1xuICAgICAgY29uc3QgayA9IHNlbGVjdGlvbktleShzKTtcbiAgICAgIHNldFNlbGVjdGVkKChwcmV2KSA9PiB7XG4gICAgICAgIGNvbnN0IG5leHQgPSBwcmV2LnNvbWUoKHgpID0+IHNlbGVjdGlvbktleSh4KSA9PT0gaylcbiAgICAgICAgICA/IHByZXYuZmlsdGVyKCh4KSA9PiBzZWxlY3Rpb25LZXkoeCkgIT09IGspXG4gICAgICAgICAgOiBbLi4ucHJldiwgc107XG4gICAgICAgIHBvc3QobmV4dCk7XG4gICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBbcG9zdF1cbiAgKTtcblxuICBjb25zdCBjbGVhciA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRTZWxlY3RlZChbXSk7XG4gICAgcG9zdChbXSk7XG4gIH0sIFtwb3N0XSk7XG5cbiAgY29uc3QgdmFsdWUgPSB1c2VNZW1vPFNlbGVjdGlvblNldFZhbHVlPihcbiAgICAoKSA9PiAoeyBzZWxlY3RlZCwgcmVwbGFjZSwgYWRkLCByZW1vdmUsIHRvZ2dsZSwgY2xlYXIgfSksXG4gICAgW3NlbGVjdGVkLCByZXBsYWNlLCBhZGQsIHJlbW92ZSwgdG9nZ2xlLCBjbGVhcl1cbiAgKTtcblxuICByZXR1cm4gPFNlbGVjdGlvblNldENvbnRleHQuUHJvdmlkZXIgdmFsdWU9e3ZhbHVlfT57Y2hpbGRyZW59PC9TZWxlY3Rpb25TZXRDb250ZXh0LlByb3ZpZGVyPjtcbn1cblxuLyoqXG4gKiBNb3VudCBhIGBTZWxlY3Rpb25TZXRQcm92aWRlcmAgb25seSB3aGVuIG5vbmUgZXhpc3RzIGFib3ZlIHVzLiBUaGUgc2hlbGwtXG4gKiBvd25lZCBjb21tZW50IG1vdW50IGxheWVyIHByb3ZpZGVzIG9uZSBzbyBib3RoIHRoZSBsaXRlIGNvbW1lbnQgcm91dGVyIGFuZFxuICogYENhbnZhc1NoZWxsYCBzaGFyZSBhIHNpbmdsZSBzZWxlY3Rpb24gc2V0LiBIb29rIGNhbGxlZCB1bmNvbmRpdGlvbmFsbHk7XG4gKiBvbmx5IHRoZSByZXR1cm5lZCB0cmVlIGJyYW5jaGVzIChob29rIHJ1bGVzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIE1heWJlU2VsZWN0aW9uU2V0UHJvdmlkZXIoeyBjaGlsZHJlbiB9OiB7IGNoaWxkcmVuOiBSZWFjdE5vZGUgfSkge1xuICBjb25zdCBvdXRlciA9IHVzZUNvbnRleHQoU2VsZWN0aW9uU2V0Q29udGV4dCk7XG4gIGlmIChvdXRlcikgcmV0dXJuIDw+e2NoaWxkcmVufTwvPjtcbiAgcmV0dXJuIDxTZWxlY3Rpb25TZXRQcm92aWRlcj57Y2hpbGRyZW59PC9TZWxlY3Rpb25TZXRQcm92aWRlcj47XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gSG9va3NcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZVNlbGVjdGlvblNldCgpOiBTZWxlY3Rpb25TZXRWYWx1ZSB7XG4gIGNvbnN0IGN0eCA9IHVzZUNvbnRleHQoU2VsZWN0aW9uU2V0Q29udGV4dCk7XG4gIGlmICghY3R4KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1c2VTZWxlY3Rpb25TZXQgbXVzdCBiZSB1c2VkIGluc2lkZSA8U2VsZWN0aW9uU2V0UHJvdmlkZXI+Jyk7XG4gIH1cbiAgcmV0dXJuIGN0eDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZVNlbGVjdGlvblNldE9wdGlvbmFsKCk6IFNlbGVjdGlvblNldFZhbHVlIHwgbnVsbCB7XG4gIHJldHVybiB1c2VDb250ZXh0KFNlbGVjdGlvblNldENvbnRleHQpO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFdpcmUtc2hhcGUgaGVscGVycyDigJQgZXhwb3J0ZWQgZm9yIHRlc3RzIGFuZCBpbnNwZWN0LnRzIGJhY2stY29tcGF0IHJlYWRlci5cblxuLyoqIENvbnZlcnQgYW55IGluYm91bmQgc2hhcGUgdG8gYW4gYXJyYXkuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplU2VsZWN0ZWRSZWFkKFxuICByYXc6IFNlbGVjdGlvbiB8IFNlbGVjdGlvbltdIHwgbnVsbCB8IHVuZGVmaW5lZFxuKTogU2VsZWN0aW9uW10ge1xuICBpZiAocmF3ID09IG51bGwpIHJldHVybiBbXTtcbiAgaWYgKEFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIGRlZHVwZShyYXcpO1xuICByZXR1cm4gW3Jhd107XG59XG5cbi8qKiBDb252ZXJ0IGludGVybmFsIGFycmF5IGJhY2sgdG8gdGhlIHdpcmUgc2hhcGUgKHdyaXRlcikuICovXG5leHBvcnQgZnVuY3Rpb24gZGVub3JtYWxpemVTZWxlY3RlZFdyaXRlKGxpc3Q6IFNlbGVjdGlvbltdKTogU2VsZWN0aW9uIHwgU2VsZWN0aW9uW10gfCBudWxsIHtcbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSByZXR1cm4gbGlzdFswXSA/PyBudWxsO1xuICByZXR1cm4gbGlzdDtcbn1cbiIsCiAgICAiLyoqXG4gKiBAZmlsZSAgICAgICBpbnB1dC1yb3V0ZXIudHN4IOKAlCBjYW52YXMgcG9pbnRlci9rZXlib2FyZCBjbGFzc2lmaWVyICsgaG9va1xuICogQHNjb3BlICAgICAgYXBwcy9zdHVkaW8vaW5wdXQtcm91dGVyLnRzeFxuICogQHB1cnBvc2UgICAgT3duZWQgYnkgY2FudmFzLWxpYidzIERlc2lnbkNhbnZhcy4gQ2xhc3NpZmllcyB0aGUgTk9OLVdIRUVMXG4gKiAgICAgICAgICAgICBzdWJzZXQgb2YgcG9pbnRlciArIGtleSBldmVudHMgaW50byBkaXNjcmV0ZSByb3V0ZXIgYWN0aW9ucy5cbiAqICAgICAgICAgICAgIGB1c2VWaWV3cG9ydENvbnRyb2xsZXJgIGtlZXBzIG93bmluZyB3aGVlbCArIG1pZGRsZS1tb3VzZSArXG4gKiAgICAgICAgICAgICBzcGFjZS1wYW4gKyBDbWQrMC8xLysvLSDigJQgdGhlIHR3byBzdGFja3MgY29leGlzdCB3aXRob3V0IGFcbiAqICAgICAgICAgICAgIGxpc3RlbmVyIHJhY2UgKEREUi0wMjYpLlxuICpcbiAqIEV2ZW50IG93bmVyc2hpcCAocmVhZCB0aGlzIGJlZm9yZSBhZGRpbmcgaGFuZGxlcnMpOlxuICpcbiAqICAg4pSM4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSQXG4gKiAgIOKUgiBFdmVudCAgICAgICAgICAgICAgICAgICAgICAgICAgICDilIIgT3duZXIgICAgICAgICAgICAgICAgICAgIOKUglxuICogICDilJzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilKRcbiAqICAg4pSCIHdoZWVsIC8gc2hpZnQtd2hlZWwgLyBjbWQtd2hlZWwgIOKUgiB1c2VWaWV3cG9ydENvbnRyb2xsZXIgICAg4pSCXG4gKiAgIOKUgiBwb2ludGVyZG93biBidG49MSAvIHNwYWNlLWhlbGQgICDilIIgdXNlVmlld3BvcnRDb250cm9sbGVyICAgIOKUglxuICogICDilIIga2V5ZG93biBTcGFjZSAvIENtZCswLzEvKy8tICAgICAg4pSCIHVzZVZpZXdwb3J0Q29udHJvbGxlciAgICDilIJcbiAqICAg4pSCIHBvaW50ZXJtb3ZlIChob3ZlcikgICAgICAgICAgICAgIOKUgiBpbnB1dC1yb3V0ZXIgICAgICAgICAgICAg4pSCXG4gKiAgIOKUgiBwb2ludGVyZG93biBidG49MCAoc2VsZWN0KSAgICAgICDilIIgaW5wdXQtcm91dGVyICAgICAgICAgICAgIOKUglxuICogICDilIIgcG9pbnRlcmRvd24gYnRuPTIgKHJpZ2h0LWNsaWNrKSAg4pSCIGlucHV0LXJvdXRlciAgICAgICAgICAgICDilIJcbiAqICAg4pSCIGtleWRvd24gViAvIEggLyBDIC8gRXNjICAgICAgICAgIOKUgiBpbnB1dC1yb3V0ZXIgICAgICAgICAgICAg4pSCXG4gKiAgIOKUlOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUmFxuICpcbiAqIFRoZSByb3V0ZXIgZG9lcyBubyBET00gd29yayBpdHNlbGYg4oCUIGBjbGFzc2lmeSgpYCBpcyBwdXJlICh0ZXN0YWJsZSB3aXRob3V0XG4gKiBhIERPTSkgYW5kIGB1c2VJbnB1dFJvdXRlcigpYCBhdHRhY2hlcyBsaXN0ZW5lcnMgdGhhdCBkaXNwYXRjaCB0aHJvdWdoIHRoZVxuICogY2FsbGVyLXN1cHBsaWVkIGNhbGxiYWNrcy4gSG92ZXItdGFyZ2V0IHJlc29sdXRpb24gKyBzZWxlY3Rpb24gcGVyc2lzdGVuY2VcbiAqIGxpdmUgaW4gdGhlIGNvbnN1bWVyIChEZXNpZ25DYW52YXMpLlxuICovXG5cbmltcG9ydCB7IHR5cGUgUmVmT2JqZWN0LCB1c2VFZmZlY3QgfSBmcm9tICdyZWFjdCc7XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gRHJhZy12cy1jbGljayB0aHJlc2hvbGQgKFQyNSlcbi8vXG4vLyA0IHB4IHNjcmVlbi1waXhlbCBoeXBvdCBzZXBhcmF0ZXMgXCJjbGlja1wiIGZyb20gXCJkcmFnXCIg4oCUIE1pY3Jvc29mdCBXaW4zMlxuLy8gY2Fub25pY2FsIChgU01fQ1hEUkFHYC9gU01fQ1lEUkFHYCBkZWZhdWx0KSwgYWxzbyBkMy1kcmFnIGFuZCB0bGRyYXcgZGVmYXVsdC5cbi8vIE93bmVkIGhlcmUgc28gYXJ0Ym9hcmQtZHJhZywgYXJ0Ym9hcmQtbWFycXVlZSwgZWxlbWVudC1tYXJxdWVlLCBhbm5vdGF0aW9uLVxuLy8gZHJhZy12cy10YXAsIGFuZCBhbnkgZnV0dXJlIGRyYWctY2xhc3MgZ2VzdHVyZSBhbGwgcmVhZCB0aGUgc2FtZSBjb25zdGFudC5cbi8vIFdoZWVsICsgcGluY2gtem9vbSBhcmUgRVhFTVBUIOKAlCB0aHJlc2hvbGQgaXMgZm9yIGBwb2ludGVyZG93biDihpIgcG9pbnRlcm1vdmVgXG4vLyBkcmFnIGNsYXNzaWZpY2F0aW9uIG9ubHkuXG5cbmV4cG9ydCBjb25zdCBEUkFHX1RIUkVTSE9MRF9QWCA9IDQ7XG5cbi8qKiBUcnVlIG9uY2UgdGhlIHBvaW50ZXIgaGFzIG1vdmVkIOKJpSBEUkFHX1RIUkVTSE9MRF9QWCBmcm9tIGl0cyBzdGFydC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcm9zc2VkRHJhZ1RocmVzaG9sZChcbiAgc3RhcnRYOiBudW1iZXIsXG4gIHN0YXJ0WTogbnVtYmVyLFxuICBjdXJYOiBudW1iZXIsXG4gIGN1clk6IG51bWJlclxuKTogYm9vbGVhbiB7XG4gIGNvbnN0IGR4ID0gY3VyWCAtIHN0YXJ0WDtcbiAgY29uc3QgZHkgPSBjdXJZIC0gc3RhcnRZO1xuICByZXR1cm4gTWF0aC5oeXBvdChkeCwgZHkpID49IERSQUdfVEhSRVNIT0xEX1BYO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFR5cGVzXG5cbi8qKlxuICogVG9vbCB1bmlvbi4gUGhhc2UgNC4xIHNoaXBwZWQgVi9IL0M7IFBoYXNlIDUgYWRkcyB0aGUgZHJhdyBzZXRcbiAqIChwZW4gLyByZWN0IC8gYXJyb3cgLyBlcmFzZXIpLiBEcmF3LXRvb2wgcG9pbnRlciBldmVudHMgYXJlIG93bmVkIGJ5XG4gKiBgQW5ub3RhdGlvbnNMYXllcmAg4oCUIHRoZSByb3V0ZXIgY2xhc3NpZmllcyB0aGVpciBsZXR0ZXIgc2hvcnRjdXRzIGJ1dFxuICogcmV0dXJucyBgbm8tb3BgIGZvciB0aGUgY29ycmVzcG9uZGluZyBwb2ludGVyIGV2ZW50cyBzbyB0aGUgU1ZHIG92ZXJsYXlcbiAqIGNhbiBncmFiIHRoZW0gbmF0aXZlbHkuXG4gKi9cbmV4cG9ydCB0eXBlIFRvb2wgPVxuICB8ICdtb3ZlJ1xuICB8ICdoYW5kJ1xuICB8ICdjb21tZW50J1xuICB8ICdwZW4nXG4gIC8vIEFubm90YXRpb24gcG9saXNoIChpdGVtIDgpIOKAlCBGaWdKYW0tc3R5bGUgaGlnaGxpZ2h0ZXIuIEEgYHBlbmAtc2hhcGVkIHRvb2xcbiAgLy8gdGhhdCBwcm9kdWNlcyBhIHRyYW5zbHVjZW50IHdpZGUgbXVsdGlwbHkgc3Ryb2tlIChhIFBlblN0cm9rZSB3aXRoXG4gIC8vIGBoaWdobGlnaHRlcjp0cnVlYCksIG5vdCBhIG5ldyBzdHJva2UgdHlwZS5cbiAgfCAnaGlnaGxpZ2h0ZXInXG4gIC8vIFBoYXNlIDI0IOKAlCBgc2hhcGVgIGlzIHRoZSBzaW5nbGUgYWN0aXZlIGRyYXcgdG9vbCB0aGF0IHByb2R1Y2VzIHJlY3QgL1xuICAvLyBlbGxpcHNlIC8gcG9seWdvbiBzdHJva2VzICh0aGUga2luZCBpcyBjaG9zZW4gdmlhIHRoZSBwYWxldHRlIHBvcG92ZXIpLlxuICAvLyBgcmVjdGAgLyBgZWxsaXBzZWAgc3RheSBpbiB0aGUgdW5pb24gYXMgdGhlIHN0cm9rZSBkaXNjcmltaW5hbnRzIHRoZXlcbiAgLy8gYWx3YXlzIHdlcmUsIGJ1dCBhcmUgbm8gbG9uZ2VyIGRpcmVjdGx5IHNlbGVjdGFibGUgYWN0aXZlIHRvb2xzLlxuICB8ICdzaGFwZSdcbiAgfCAncmVjdCdcbiAgfCAnZWxsaXBzZSdcbiAgfCAnYXJyb3cnXG4gIHwgJ3N0aWNreSdcbiAgfCAndGV4dCdcbiAgLy8gRmlnSmFtIHYzIOKAlCBsYWJlbGxlZCBvcmdhbml6aW5nIGNvbnRhaW5lciAoU2hpZnQrUykuXG4gIHwgJ3NlY3Rpb24nXG4gIHwgJ2VyYXNlcic7XG5cbmNvbnN0IEFOTk9UQVRJT05fVE9PTFMgPSBuZXcgU2V0PFRvb2w+KFtcbiAgJ3BlbicsXG4gICdoaWdobGlnaHRlcicsXG4gICdzaGFwZScsXG4gICdyZWN0JyxcbiAgJ2VsbGlwc2UnLFxuICAnYXJyb3cnLFxuICAnc3RpY2t5JyxcbiAgJ3RleHQnLFxuICAnc2VjdGlvbicsXG4gICdlcmFzZXInLFxuXSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0Fubm90YXRpb25Ub29sKHQ6IFRvb2wpOiBib29sZWFuIHtcbiAgcmV0dXJuIEFOTk9UQVRJT05fVE9PTFMuaGFzKHQpO1xufVxuXG5leHBvcnQgdHlwZSBSb3V0ZXJBY3Rpb24gPVxuICB8IHsga2luZDogJ25vLW9wJyB9XG4gIHwgeyBraW5kOiAnaG92ZXInOyBkZWVwOiBib29sZWFuOyBjbGllbnRYOiBudW1iZXI7IGNsaWVudFk6IG51bWJlciB9XG4gIHwge1xuICAgICAga2luZDogJ3NlbGVjdCc7XG4gICAgICAvKiogYHJlcGxhY2VgIHN3YXBzIHRoZSBzZWxlY3Rpb24gc2V0LCBgYWRkYCBtZXJnZXMgaW50byBpdC4gKi9cbiAgICAgIG1vZGU6ICdyZXBsYWNlJyB8ICdhZGQnO1xuICAgICAgLyoqXG4gICAgICAgKiBgdHJ1ZWAgcmVzb2x2ZXMgdG8gdGhlIGRlZXBlc3QgZGVzY2VuZGFudCB1bmRlciB0aGUgY3Vyc29yIChDbWQtaGVsZFxuICAgICAgICogbW9kZSkuIGBmYWxzZWAgcmVzb2x2ZXMgdG8gdGhlIHRvcG1vc3QgaW50ZXJlc3RpbmcgYW5jZXN0b3IgKHRvcCBtb2RlKS5cbiAgICAgICAqIFBoYXNlIDQuMSBNb3ZlLXRvb2wgc2VsZWN0aW9uIGFsd2F5cyB1c2VzIGRlZXA9dHJ1ZSDigJQgYmFyZSBjbGlja3NcbiAgICAgICAqIGFyZSBwYXNzdGhyb3VnaCAobm8gc2VsZWN0KSwgYW5kIHRoZSBvbmx5IGVudHJ5IHBvaW50cyBhcmUgQ21kXG4gICAgICAgKiAocmVwbGFjZSBkZWVwKSBhbmQgQ21kK1NoaWZ0IChhZGQgZGVlcCkuXG4gICAgICAgKi9cbiAgICAgIGRlZXA6IGJvb2xlYW47XG4gICAgICBjbGllbnRYOiBudW1iZXI7XG4gICAgICBjbGllbnRZOiBudW1iZXI7XG4gICAgfVxuICB8IHsga2luZDogJ2Ryb3AtY29tbWVudCc7IGNsaWVudFg6IG51bWJlcjsgY2xpZW50WTogbnVtYmVyIH1cbiAgfCB7IGtpbmQ6ICdjb250ZXh0LW1lbnUnOyBjbGllbnRYOiBudW1iZXI7IGNsaWVudFk6IG51bWJlciB9XG4gIHwgeyBraW5kOiAndG9vbCc7IHRvb2w6IFRvb2wgfVxuICB8IHsga2luZDogJ2VzY2FwZScgfVxuICB8IHsga2luZDogJ3VuZG8nIH1cbiAgfCB7IGtpbmQ6ICdyZWRvJyB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIENsYXNzaWZ5SW5wdXQge1xuICB0eXBlOiAncG9pbnRlcm1vdmUnIHwgJ3BvaW50ZXJkb3duJyB8ICdjb250ZXh0bWVudScgfCAna2V5ZG93bic7XG4gIC8qKiBQb2ludGVyRXZlbnQuYnV0dG9uOiAwID0gbGVmdCwgMSA9IG1pZGRsZSwgMiA9IHJpZ2h0LiAqL1xuICBidXR0b24/OiBudW1iZXI7XG4gIG1ldGFLZXk/OiBib29sZWFuO1xuICBjdHJsS2V5PzogYm9vbGVhbjtcbiAgc2hpZnRLZXk/OiBib29sZWFuO1xuICBhbHRLZXk/OiBib29sZWFuO1xuICBrZXk/OiBzdHJpbmc7XG4gIGNsaWVudFg/OiBudW1iZXI7XG4gIGNsaWVudFk/OiBudW1iZXI7XG4gIC8qKiBTcGFjZWJhciBoZWxkIOKAlCBzaGFyZWQgc2lnbmFsIHdpdGggYHVzZVZpZXdwb3J0Q29udHJvbGxlcmAncyBwYW4tZHJhZy4gKi9cbiAgc3BhY2VIZWxkPzogYm9vbGVhbjtcbiAgLyoqIEV2ZW50IHRhcmdldCBpcyBlZGl0YWJsZSAoaW5wdXQvdGV4dGFyZWEvY29udGVudEVkaXRhYmxlKSDigJQgY2FsbGVyIGNvbXB1dGVzLiAqL1xuICBpc0VkaXRhYmxlPzogYm9vbGVhbjtcbiAgYWN0aXZlVG9vbDogVG9vbDtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBjbGFzc2lmeSDigJQgcHVyZSBmdW5jdGlvbi4gQWxsIGJyYW5jaGluZyBsaXZlcyBoZXJlIHNvIHVuaXQgdGVzdHMgY292ZXIgZXZlcnlcbi8vIHJvdyBvZiB0aGUgZGlzcGF0Y2ggdGFibGUgd2l0aG91dCBzcGlubmluZyB1cCBhIERPTS5cblxuY29uc3QgbWV0YU9yQ3RybCA9IChpOiBDbGFzc2lmeUlucHV0KTogYm9vbGVhbiA9PiAhIShpLm1ldGFLZXkgfHwgaS5jdHJsS2V5KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzaWZ5KGlucHV0OiBDbGFzc2lmeUlucHV0KTogUm91dGVyQWN0aW9uIHtcbiAgaWYgKGlucHV0LnR5cGUgPT09ICdrZXlkb3duJykge1xuICAgIGlmIChpbnB1dC5pc0VkaXRhYmxlKSByZXR1cm4geyBraW5kOiAnbm8tb3AnIH07XG4gICAgLy8gVG9vbCBsZXR0ZXJzIGFyZSBiYXJlIGtleXMg4oCUIENtZC9DdHJsL0FsdCtsZXR0ZXIgYmVsb25ncyB0byBzaGVsbCAvIGJyb3dzZXIuXG4gICAgaWYgKGlucHV0Lm1ldGFLZXkgfHwgaW5wdXQuY3RybEtleSB8fCBpbnB1dC5hbHRLZXkpIHtcbiAgICAgIC8vIEVzYyB3aXRoIG1vZGlmaWVycyBzdGlsbCBkaXNtaXNzZXMuXG4gICAgICBpZiAoaW5wdXQua2V5ID09PSAnRXNjYXBlJykgcmV0dXJuIHsga2luZDogJ2VzY2FwZScgfTtcbiAgICAgIC8vIFVuZG8gLyByZWRvIChQaGFzZSAyMCkuIEFsdCBpcyByZXNlcnZlZCDigJQgQ21kK09wdCtaIGlzIGEgYnJvd3NlclxuICAgICAgLy8gdGV4dC1pbnB1dCBnZXN0dXJlIHdlIGRvbid0IGNsYWltLiBgbWV0YUtleSB8fCBjdHJsS2V5YCBjb3ZlcnMgYm90aFxuICAgICAgLy8gbWFjIGFuZCBXaW5kb3dzIC8gTGludXggd2l0aG91dCBhIHBsYXRmb3JtIHNuaWZmLlxuICAgICAgY29uc3QgayA9IChpbnB1dC5rZXkgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIWlucHV0LmFsdEtleSAmJiAoaW5wdXQubWV0YUtleSB8fCBpbnB1dC5jdHJsS2V5KSkge1xuICAgICAgICBpZiAoayA9PT0gJ3onICYmIGlucHV0LnNoaWZ0S2V5KSByZXR1cm4geyBraW5kOiAncmVkbycgfTtcbiAgICAgICAgaWYgKGsgPT09ICd6JykgcmV0dXJuIHsga2luZDogJ3VuZG8nIH07XG4gICAgICAgIGlmIChrID09PSAneScgJiYgIWlucHV0LnNoaWZ0S2V5KSByZXR1cm4geyBraW5kOiAncmVkbycgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcbiAgICB9XG4gICAgY29uc3QgayA9IChpbnB1dC5rZXkgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGsgPT09ICd2JykgcmV0dXJuIHsga2luZDogJ3Rvb2wnLCB0b29sOiAnbW92ZScgfTtcbiAgICBpZiAoayA9PT0gJ2gnKSByZXR1cm4geyBraW5kOiAndG9vbCcsIHRvb2w6ICdoYW5kJyB9O1xuICAgIGlmIChrID09PSAnYycpIHJldHVybiB7IGtpbmQ6ICd0b29sJywgdG9vbDogJ2NvbW1lbnQnIH07XG4gICAgaWYgKGsgPT09ICdiJykgcmV0dXJuIHsga2luZDogJ3Rvb2wnLCB0b29sOiAncGVuJyB9O1xuICAgIC8vIEkgPSBoSWdobGlnaHRlciAoYSBmcmVlIGJhcmUgbGV0dGVyOyAnSCcgaXMgdGFrZW4gYnkgSGFuZCkuXG4gICAgaWYgKGsgPT09ICdpJykgcmV0dXJuIHsga2luZDogJ3Rvb2wnLCB0b29sOiAnaGlnaGxpZ2h0ZXInIH07XG4gICAgLy8gUGhhc2UgMjQg4oCUIFIgKGFuZCBsZWdhY3kgTykgYm90aCBhcm0gdGhlIHNpbmdsZSBTaGFwZSB0b29sOyB0aGUgc3BlY2lmaWNcbiAgICAvLyBwcmltaXRpdmUgaXMgcGlja2VkIGZyb20gdGhlIHBhbGV0dGUncyBzaGFwZS1raW5kIHBvcG92ZXIuXG4gICAgaWYgKGsgPT09ICdyJyB8fCBrID09PSAnbycpIHJldHVybiB7IGtpbmQ6ICd0b29sJywgdG9vbDogJ3NoYXBlJyB9O1xuICAgIGlmIChrID09PSAnYScpIHJldHVybiB7IGtpbmQ6ICd0b29sJywgdG9vbDogJ2Fycm93JyB9O1xuICAgIC8vIFBoYXNlIDIxIOKAlCBOID0gc3RpY2t5IE5vdGUgKCdTJyBpcyB0YWtlbiBieSB0aGUgc2hlbGwgRGVzaWduLXN5c3RlbSB2aWV3XG4gICAgLy8gKyBTaGlmdC1tYXJxdWVlKTsgVCA9IHN0YW5kYWxvbmUgVGV4dC4gQm90aCBhcmUgYmFyZSBsZXR0ZXJzIHRoZSBzaGVsbFxuICAgIC8vIHlpZWxkcyB3aGVuIGZvY3VzIGlzIGluc2lkZSB0aGUgY2FudmFzIGlmcmFtZSAoYXBwLmpzeCBvbktleSBiYWlsKS5cbiAgICBpZiAoayA9PT0gJ24nKSByZXR1cm4geyBraW5kOiAndG9vbCcsIHRvb2w6ICdzdGlja3knIH07XG4gICAgaWYgKGsgPT09ICd0JykgcmV0dXJuIHsga2luZDogJ3Rvb2wnLCB0b29sOiAndGV4dCcgfTtcbiAgICAvLyBGaWdKYW0gdjMg4oCUIFNoaWZ0K1MgYXJtcyB0aGUgU2VjdGlvbiB0b29sIChGaWdKYW0ncyBvd24gYmluZGluZzsgYmFyZSBTXG4gICAgLy8gc3RheXMgd2l0aCB0aGUgc2hlbGwncyBEZXNpZ24tc3lzdGVtIHZpZXcpLiBDaGVja2VkIGhlcmUgYmVjYXVzZSB0aGVcbiAgICAvLyBtb2RpZmllciBndWFyZCBhYm92ZSBvbmx5IGZpbHRlcnMgQ21kL0N0cmwvQWx0LlxuICAgIGlmIChrID09PSAncycgJiYgaW5wdXQuc2hpZnRLZXkpIHJldHVybiB7IGtpbmQ6ICd0b29sJywgdG9vbDogJ3NlY3Rpb24nIH07XG4gICAgaWYgKGsgPT09ICdlJykgcmV0dXJuIHsga2luZDogJ3Rvb2wnLCB0b29sOiAnZXJhc2VyJyB9O1xuICAgIGlmIChpbnB1dC5rZXkgPT09ICdFc2NhcGUnKSByZXR1cm4geyBraW5kOiAnZXNjYXBlJyB9O1xuICAgIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcbiAgfVxuXG4gIGlmIChpbnB1dC50eXBlID09PSAnY29udGV4dG1lbnUnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6ICdjb250ZXh0LW1lbnUnLFxuICAgICAgY2xpZW50WDogaW5wdXQuY2xpZW50WCA/PyAwLFxuICAgICAgY2xpZW50WTogaW5wdXQuY2xpZW50WSA/PyAwLFxuICAgIH07XG4gIH1cblxuICBpZiAoaW5wdXQudHlwZSA9PT0gJ3BvaW50ZXJtb3ZlJykge1xuICAgIC8vIFBoYXNlIDUgZHJhdyB0b29sczogcGVuIC8gcmVjdCAvIGFycm93IC8gZXJhc2VyIG93biBhbGwgdGhlaXIgcG9pbnRlclxuICAgIC8vIGV2ZW50cyB0aHJvdWdoIGBBbm5vdGF0aW9uc0xheWVyYC4gVGhlIHJvdXRlciBuZXZlciBwYWludHMgYSBob3ZlciBoYWxvXG4gICAgLy8gd2hpbGUgZHJhd2luZyDigJQgdGhhdCBhZmZvcmRhbmNlIGlzIHJlc2VydmVkIGZvciBzZWxlY3QgLyBjb21tZW50LlxuICAgIGlmIChpc0Fubm90YXRpb25Ub29sKGlucHV0LmFjdGl2ZVRvb2wpKSByZXR1cm4geyBraW5kOiAnbm8tb3AnIH07XG4gICAgLy8gSGFuZCB0b29sOiBkcmFnIHBhbiBpcyBvd25lZCBieSB1c2VWaWV3cG9ydENvbnRyb2xsZXI7IG5vIGhvdmVyIHBhaW50LlxuICAgIGlmIChpbnB1dC5hY3RpdmVUb29sID09PSAnaGFuZCcpIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcbiAgICAvLyBDb21tZW50IHRvb2w6IGFsd2F5cyBwYWludCBhIHByZXZpZXcgaGFsbyBvbiB0aGUgZGVlcGVzdCBlbGVtZW50IHVuZGVyXG4gICAgLy8gY3Vyc29yIOKAlCB0aGF0J3MgdGhlIGVsZW1lbnQgdGhlIHVzZXIgaXMgYWJvdXQgdG8gY29tbWVudCBvbi4gQ29tbWVudFxuICAgIC8vIHBpbiBhdHRhY2htZW50IGlzIHRvIHRoZSBzYW1lIGVsZW1lbnQgdGhleSB3ZXJlIGhvdmVyaW5nLlxuICAgIGlmIChpbnB1dC5hY3RpdmVUb29sID09PSAnY29tbWVudCcpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGtpbmQ6ICdob3ZlcicsXG4gICAgICAgIGRlZXA6IHRydWUsXG4gICAgICAgIGNsaWVudFg6IGlucHV0LmNsaWVudFggPz8gMCxcbiAgICAgICAgY2xpZW50WTogaW5wdXQuY2xpZW50WSA/PyAwLFxuICAgICAgfTtcbiAgICB9XG4gICAgLy8gTW92ZSB0b29sOiBiYXJlIGhvdmVyIGRvZXMgbm90aGluZyAobmF0aXZlIGludGVyYWN0aW9ucyBwYXNzIHRocm91Z2gpO1xuICAgIC8vIENtZC1oZWxkIGhvdmVyIHBhaW50cyBhIGhhbG8gb24gdGhlIGRlZXBlc3QgZWxlbWVudCAocHJldmlldykuXG4gICAgaWYgKCFtZXRhT3JDdHJsKGlucHV0KSkgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xuICAgIHJldHVybiB7XG4gICAgICBraW5kOiAnaG92ZXInLFxuICAgICAgZGVlcDogdHJ1ZSxcbiAgICAgIGNsaWVudFg6IGlucHV0LmNsaWVudFggPz8gMCxcbiAgICAgIGNsaWVudFk6IGlucHV0LmNsaWVudFkgPz8gMCxcbiAgICB9O1xuICB9XG5cbiAgaWYgKGlucHV0LnR5cGUgPT09ICdwb2ludGVyZG93bicpIHtcbiAgICBpZiAoaW5wdXQuYnV0dG9uID09PSAyKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiAnY29udGV4dC1tZW51JyxcbiAgICAgICAgY2xpZW50WDogaW5wdXQuY2xpZW50WCA/PyAwLFxuICAgICAgICBjbGllbnRZOiBpbnB1dC5jbGllbnRZID8/IDAsXG4gICAgICB9O1xuICAgIH1cbiAgICBpZiAoaW5wdXQuYnV0dG9uID09PSAxIHx8IGlucHV0LnNwYWNlSGVsZCkgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xuICAgIGlmIChpbnB1dC5idXR0b24gIT09IDApIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcblxuICAgIC8vIFBoYXNlIDUgZHJhdyB0b29scyBvd24gYmFyZSBsZWZ0LWNsaWNrczsgdGhlIHJvdXRlciByZXR1cm5zIG5vLW9wIHNvXG4gICAgLy8gdGhlIFNWRyBsYXllcidzIG93biBsaXN0ZW5lcnMgKG5vIHByZXZlbnREZWZhdWx0KSBmaXJlIG5vcm1hbGx5LiBDbWQtXG4gICAgLy8gbW9kaWZpZWQgY2xpY2tzIHN0aWxsIGZsb3cgaW50byB0aGUgbW92ZS10b29sIHNlbGVjdCBwYXRoIGJlbG93IOKAlCB0aGF0XG4gICAgLy8gc3RheXMgYXZhaWxhYmxlIGFzIGFuIGVzY2FwZSBoYXRjaCBldmVuIHdoaWxlIGEgZHJhdyB0b29sIGlzIGFjdGl2ZS5cbiAgICBpZiAoaXNBbm5vdGF0aW9uVG9vbChpbnB1dC5hY3RpdmVUb29sKSAmJiAhbWV0YU9yQ3RybChpbnB1dCkpIHtcbiAgICAgIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcbiAgICB9XG5cbiAgICBpZiAoaW5wdXQuYWN0aXZlVG9vbCA9PT0gJ2NvbW1lbnQnKSB7XG4gICAgICAvLyBDb21tZW50IHRvb2w6IGJhcmUgY2xpY2sgZHJvcHMgYSBwaW4uIENtZCAvIFNoaWZ0IG1vZGlmaWVycyByZXNlcnZlZFxuICAgICAgLy8gZm9yIGZ1dHVyZSBcInNjb3BlIGNvbW1lbnQgdG8gZGVlcGVzdFwiIHZhcmlhbnRzIOKAlCBmb3Igbm93IHRoZXkgZmFsbFxuICAgICAgLy8gdGhyb3VnaCB0byB0aGUgc2FtZSBkcm9wLlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogJ2Ryb3AtY29tbWVudCcsXG4gICAgICAgIGNsaWVudFg6IGlucHV0LmNsaWVudFggPz8gMCxcbiAgICAgICAgY2xpZW50WTogaW5wdXQuY2xpZW50WSA/PyAwLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBIYW5kIHRvb2w6IHBhbiBpcyBvd25lZCBieSB1c2VWaWV3cG9ydENvbnRyb2xsZXIgdmlhIGBpc1BhbkRyYWdBY3RpdmVgLlxuICAgIC8vIFJvdXRlciByZXR1cm5zIG5vLW9wIHNvIGl0IGRvZXNuJ3QgcHJldmVudERlZmF1bHQgb3Igc3RvcFByb3BhZ2F0aW9uIOKAlFxuICAgIC8vIHRoZSBjb250cm9sbGVyJ3MgcG9pbnRlcmRvd24gbGlzdGVuZXIgb24gdGhlIHNhbWUgaG9zdCBjbGFpbXMgdGhlIGRyYWcuXG4gICAgaWYgKGlucHV0LmFjdGl2ZVRvb2wgPT09ICdoYW5kJykgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xuXG4gICAgLy8gTW92ZSB0b29sLiBTZWxlY3Rpb24gT05MWSBmaXJlcyB3aXRoIENtZCAvIENtZCtTaGlmdC4gQmFyZSBjbGlja3MgYW5kXG4gICAgLy8gU2hpZnQtd2l0aG91dC1DbWQgcGFzcyB0aHJvdWdoIHNvIG5hdGl2ZSBjYW52YXMgaW50ZXJhY3Rpb25zIChidXR0b25cbiAgICAvLyBwcmVzc2VzLCBsaW5rIGNsaWNrcywgaW5wdXQgZm9jdXMpIHN0aWxsIHdvcmsg4oCUIGV4YWN0bHkgdGhlIHNhbWUgYXNcbiAgICAvLyBwcmUtUGhhc2UtNC4xIGJlaGF2aW9yIGZvciBldmVyeXRoaW5nIGV4Y2VwdCBDbWQtbW9kaWZpZWQgZ2VzdHVyZXMuXG4gICAgY29uc3QgY21kID0gbWV0YU9yQ3RybChpbnB1dCk7XG4gICAgaWYgKCFjbWQpIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcbiAgICBjb25zdCBzaGlmdCA9ICEhaW5wdXQuc2hpZnRLZXk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6ICdzZWxlY3QnLFxuICAgICAgbW9kZTogc2hpZnQgPyAnYWRkJyA6ICdyZXBsYWNlJyxcbiAgICAgIGRlZXA6IHRydWUsXG4gICAgICBjbGllbnRYOiBpbnB1dC5jbGllbnRYID8/IDAsXG4gICAgICBjbGllbnRZOiBpbnB1dC5jbGllbnRZID8/IDAsXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyB1c2VJbnB1dFJvdXRlciDigJQgYXR0YWNoIGxpc3RlbmVycyBzY29wZWQgdG8gYGhvc3RSZWYuY3VycmVudGAuIERpc3BhdGNoZXNcbi8vIHRocm91Z2ggYGNhbGxiYWNrc2AuIFJldHVybnMgbm90aGluZzsgY2xlYW5zIHVwIG9uIHVubW91bnQuXG5cbmV4cG9ydCBpbnRlcmZhY2UgUm91dGVyQ2FsbGJhY2tzIHtcbiAgb25Ib3Zlcj86IChhOiBFeHRyYWN0PFJvdXRlckFjdGlvbiwgeyBraW5kOiAnaG92ZXInIH0+KSA9PiB2b2lkO1xuICBvblNlbGVjdD86IChhOiBFeHRyYWN0PFJvdXRlckFjdGlvbiwgeyBraW5kOiAnc2VsZWN0JyB9PikgPT4gdm9pZDtcbiAgb25Ecm9wQ29tbWVudD86IChhOiBFeHRyYWN0PFJvdXRlckFjdGlvbiwgeyBraW5kOiAnZHJvcC1jb21tZW50JyB9PikgPT4gdm9pZDtcbiAgb25Db250ZXh0TWVudT86IChhOiBFeHRyYWN0PFJvdXRlckFjdGlvbiwgeyBraW5kOiAnY29udGV4dC1tZW51JyB9PikgPT4gdm9pZDtcbiAgb25Ub29sPzogKGE6IEV4dHJhY3Q8Um91dGVyQWN0aW9uLCB7IGtpbmQ6ICd0b29sJyB9PikgPT4gdm9pZDtcbiAgb25Fc2NhcGU/OiAoKSA9PiB2b2lkO1xuICAvKiogUGhhc2UgMjAg4oCUIENtZCtaIC8gQ3RybCtaLiAqL1xuICBvblVuZG8/OiAoKSA9PiB2b2lkO1xuICAvKiogUGhhc2UgMjAg4oCUIENtZCtTaGlmdCtaIC8gQ3RybCtZIC8gQ21kK1kuICovXG4gIG9uUmVkbz86ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVXNlSW5wdXRSb3V0ZXJPcHRpb25zIHtcbiAgaG9zdFJlZjogUmVmT2JqZWN0PEhUTUxFbGVtZW50IHwgbnVsbD47XG4gIC8qKiBMYXRlc3QgYWN0aXZlIHRvb2wg4oCUIHJlYWQgYXQgZXZlbnQgdGltZSwgbm90IGNhcHR1cmVkLiAqL1xuICBnZXRBY3RpdmVUb29sOiAoKSA9PiBUb29sO1xuICAvKiogT3B0aW9uYWwgc3BhY2ViYXItaGVsZCBzaWduYWwgc2hhcmVkIHdpdGggdXNlVmlld3BvcnRDb250cm9sbGVyLiAqL1xuICBpc1NwYWNlSGVsZD86ICgpID0+IGJvb2xlYW47XG4gIGNhbGxiYWNrczogUm91dGVyQ2FsbGJhY2tzO1xuICAvKiogV2hlbiBmYWxzZSwgbGlzdGVuZXJzIGFyZSBub3QgYXR0YWNoZWQuIERlZmF1bHRzIHRvIHRydWUuICovXG4gIGVuYWJsZWQ/OiBib29sZWFuO1xuICAvKipcbiAgICogQWxsb3dsaXN0IG9mIGFjdGlvbiBraW5kcyB0aGlzIHJvdXRlciBpcyBwZXJtaXR0ZWQgdG8gQ0xBSU0gKHByZXZlbnREZWZhdWx0XG4gICAqICsgc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uICsgZGlzcGF0Y2gpLiBBbnkgY2xhc3NpZmllZCBhY3Rpb24gb3V0c2lkZSB0aGVcbiAgICogc2V0IGlzIGRvd25ncmFkZWQgdG8gYG5vLW9wYCBzbyBpdCBwcm9wYWdhdGVzIHVudG91Y2hlZCB0byBvdGhlciBsaXN0ZW5lcnMuXG4gICAqIE9taXQgdG8gY2xhaW0gZXZlcnl0aGluZyAodGhlIGRlZmF1bHQg4oCUIHVzZWQgYnkgdGhlIGZ1bGwgRGVzaWduQ2FudmFzXG4gICAqIHJvdXRlcikuIFRoZSBzaGVsbC1vd25lZCBjb21tZW50IG1vdW50IGxheWVyIHBhc3NlcyBhIG5hcnJvdyBzZXQgc28gaXQgY2FuXG4gICAqIGNvZXhpc3QgYXMgYW4gQU5DRVNUT1IgY2FwdHVyZS1saXN0ZW5lciBvdmVyIGEgVUkgY2FudmFzJ3Mgb3duIHJvdXRlclxuICAgKiB3aXRob3V0IHN3YWxsb3dpbmcgc2VsZWN0IC8gY29udGV4dC1tZW51IC8gdW5kbyBnZXN0dXJlcyBpdCBkb2Vzbid0IG93bi5cbiAgICovXG4gIGNsYWltYWJsZUFjdGlvbnM/OiBSZWFkb25seVNldDxSb3V0ZXJBY3Rpb25bJ2tpbmQnXT47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VkaXRhYmxlVGFyZ2V0KHQ6IEV2ZW50VGFyZ2V0IHwgbnVsbCk6IGJvb2xlYW4ge1xuICBpZiAoIXQgfHwgISh0IGFzIEhUTUxFbGVtZW50KS50YWdOYW1lKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGVsID0gdCBhcyBIVE1MRWxlbWVudDtcbiAgY29uc3QgdGFnID0gZWwudGFnTmFtZTtcbiAgaWYgKHRhZyA9PT0gJ0lOUFVUJyB8fCB0YWcgPT09ICdURVhUQVJFQScgfHwgdGFnID09PSAnU0VMRUNUJykgcmV0dXJuIHRydWU7XG4gIGlmIChlbC5pc0NvbnRlbnRFZGl0YWJsZSkgcmV0dXJuIHRydWU7XG4gIC8vIERvZ2Zvb2QgZml4IOKAlCBgLmlzQ29udGVudEVkaXRhYmxlYCBpcyBhIGNvbXB1dGVkL2luaGVyaXRlZCBwcm9wZXJ0eSB3aG9zZVxuICAvLyBoYW5kbGluZyBvZiB0aGUgYGNvbnRlbnRlZGl0YWJsZT1cInBsYWludGV4dC1vbmx5XCJgIHRva2VuICh0aGUgdmFsdWUgdGhlXG4gIC8vIGVsZW1lbnQtdGV4dC1lZGl0IHN5c3RlbSB1c2VzLCBjYW52YXMtc2hlbGwudHN4KSBoYXMgaGFkIGNyb3NzLWVuZ2luZS9cbiAgLy8gdmVyc2lvbiBpbmNvbnNpc3RlbmNpZXMuIENoZWNrIHRoZSByYXcgYXR0cmlidXRlIHRvbyBzbyBhIHRvb2wtbGV0dGVyXG4gIC8vIHNob3J0Y3V0IChSLCBULCBOLCDigKYpIGNhbiBuZXZlciBmaXJlIHdoaWxlIHRoYXQgZWRpdG9yIGhhcyBmb2N1cyxcbiAgLy8gcmVnYXJkbGVzcyBvZiB3aGV0aGVyIGlzQ29udGVudEVkaXRhYmxlIGNvcnJlY3RseSByZWZsZWN0cyBpdCBpbiBhIGdpdmVuXG4gIC8vIHJ1bnRpbWUg4oCUIHRoaXMgd2FzIHRoZSByZXBvcnRlZCBidWcgKHR5cGluZyBcIlJcIiB3aGlsZSBlZGl0aW5nIGluLWNhbnZhc1xuICAvLyB0ZXh0IHN3aXRjaGVkIHRvIHRoZSBSZWN0YW5nbGUgdG9vbCkuXG4gIGNvbnN0IHJhdyA9IGVsLmdldEF0dHJpYnV0ZT8uKCdjb250ZW50ZWRpdGFibGUnKTtcbiAgaWYgKHJhdyA9PT0gJ3RydWUnIHx8IHJhdyA9PT0gJ3BsYWludGV4dC1vbmx5JyB8fCByYXcgPT09ICcnKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIFBoYXNlIDYg4oCUIHRoZSBjb21tZW50cyBvdmVybGF5IChwaW5zIC8gY29tcG9zZXIgLyB0aHJlYWQgcG9wb3ZlciAvIG1lbnRpb25cbiAqIHBvcHVwKSBsaXZlcyBJTlNJREUgdGhlIGNhbnZhcyB3b3JsZCwgd2hpY2ggbWVhbnMgaXRzIERPTSBub2RlcyBhcmUgaW5zaWRlXG4gKiB0aGUgaW5wdXQtcm91dGVyJ3MgY2FwdHVyZSBob3N0LiBXaXRob3V0IGFuIGV4cGxpY2l0IGJhaWwtb3V0IHRoZSByb3V0ZXJcbiAqIHdvdWxkIGBwcmV2ZW50RGVmYXVsdCArIHN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbmAgZXZlcnkgY2xpY2sgb24gYVxuICogY29tcG9zZXIgYnV0dG9uIHdoaWxlIGNvbW1lbnQgbW9kZSBpcyBhY3RpdmUsIGJsb2NraW5nIFNhdmUgLyBDYW5jZWwuXG4gKlxuICogV2UgdHJlYXQgdGhlIG92ZXJsYXkgbm9kZXMgbGlrZSBlZGl0YWJsZSBmb3JtIHdpZGdldHMg4oCUIHRoZSByb3V0ZXIgeWllbGRzLFxuICogdGhlIFJlYWN0IGV2ZW50IGhhbmRsZXIgcnVucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzT3ZlcmxheVRhcmdldCh0OiBFdmVudFRhcmdldCB8IG51bGwpOiBib29sZWFuIHtcbiAgaWYgKCF0IHx8ICEodCBhcyBFbGVtZW50KS5jbG9zZXN0KSByZXR1cm4gZmFsc2U7XG4gIC8vIFtkYXRhLW1lZGlhcmVmLXBsYXllcl0g4oCUIHRoZSBpbmxpbmUgPHZpZGVvPi88YXVkaW8gY29udHJvbHM+IG9uIGEgbWVkaWFcbiAgLy8gcmVmZXJlbmNlIGNoaXAgKEREUi0xNTAgZG9nZm9vZCAjOCkuIFRoZSByb3V0ZXIgbXVzdCBuZXZlciBjbGFpbSAoYW5kXG4gIC8vIHByZXZlbnREZWZhdWx0KSBwb2ludGVyZG93bnMgb3ZlciB0aGUgcGxheWVyLCBvciBpdHMgbmF0aXZlIGNvbnRyb2xzXG4gIC8vIChwbGF5IGJ1dHRvbiwgc2NydWJiZXIgZHJhZywgdm9sdW1lKSBkaWUgdW5kZXIgdGhlIG1vdmUgdG9vbC5cbiAgcmV0dXJuICEhKHQgYXMgRWxlbWVudCkuY2xvc2VzdChcbiAgICAnLmNtLWNvbXBvc2VyLCAuY20tdGhyZWFkLCAuY20tbWVudGlvbi1wb3B1cCwgLmNtLXBpbiwgW2RhdGEtbWVkaWFyZWYtcGxheWVyXSdcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUlucHV0Um91dGVyKG9wdHM6IFVzZUlucHV0Um91dGVyT3B0aW9ucyk6IHZvaWQge1xuICBjb25zdCB7IGhvc3RSZWYsIGdldEFjdGl2ZVRvb2wsIGlzU3BhY2VIZWxkLCBjYWxsYmFja3MsIGVuYWJsZWQgPSB0cnVlLCBjbGFpbWFibGVBY3Rpb25zIH0gPSBvcHRzO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFlbmFibGVkKSByZXR1cm47XG4gICAgY29uc3QgaG9zdCA9IGhvc3RSZWYuY3VycmVudDtcbiAgICBpZiAoIWhvc3QpIHJldHVybjtcblxuICAgIC8vIERvd25ncmFkZSBhbnkgYWN0aW9uIHRoaXMgcm91dGVyIGlzbid0IHBlcm1pdHRlZCB0byBjbGFpbSB0byBuby1vcCBzbyBpdFxuICAgIC8vIHByb3BhZ2F0ZXMgdW50b3VjaGVkIChubyBwcmV2ZW50RGVmYXVsdCAvIG5vIGRpc3BhdGNoKS4gSWRlbnRpdHkgcGFzcy1cbiAgICAvLyB0aHJvdWdoIHdoZW4gbm8gYWxsb3dsaXN0IGlzIGNvbmZpZ3VyZWQuXG4gICAgY29uc3QgY2xhaW0gPSAoYWN0aW9uOiBSb3V0ZXJBY3Rpb24pOiBSb3V0ZXJBY3Rpb24gPT5cbiAgICAgIGNsYWltYWJsZUFjdGlvbnMgJiYgYWN0aW9uLmtpbmQgIT09ICduby1vcCcgJiYgIWNsYWltYWJsZUFjdGlvbnMuaGFzKGFjdGlvbi5raW5kKVxuICAgICAgICA/IHsga2luZDogJ25vLW9wJyB9XG4gICAgICAgIDogYWN0aW9uO1xuXG4gICAgY29uc3QgZGlzcGF0Y2ggPSAoYWN0aW9uOiBSb3V0ZXJBY3Rpb24pOiB2b2lkID0+IHtcbiAgICAgIHN3aXRjaCAoYWN0aW9uLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnaG92ZXInOlxuICAgICAgICAgIGNhbGxiYWNrcy5vbkhvdmVyPy4oYWN0aW9uKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc2VsZWN0JzpcbiAgICAgICAgICBjYWxsYmFja3Mub25TZWxlY3Q/LihhY3Rpb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkcm9wLWNvbW1lbnQnOlxuICAgICAgICAgIGNhbGxiYWNrcy5vbkRyb3BDb21tZW50Py4oYWN0aW9uKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnY29udGV4dC1tZW51JzpcbiAgICAgICAgICBjYWxsYmFja3Mub25Db250ZXh0TWVudT8uKGFjdGlvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3Rvb2wnOlxuICAgICAgICAgIGNhbGxiYWNrcy5vblRvb2w/LihhY3Rpb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlc2NhcGUnOlxuICAgICAgICAgIGNhbGxiYWNrcy5vbkVzY2FwZT8uKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3VuZG8nOlxuICAgICAgICAgIGNhbGxiYWNrcy5vblVuZG8/LigpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdyZWRvJzpcbiAgICAgICAgICBjYWxsYmFja3Mub25SZWRvPy4oKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbm8tb3AnOlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBvblBvaW50ZXJNb3ZlID0gKGU6IFBvaW50ZXJFdmVudCk6IHZvaWQgPT4ge1xuICAgICAgY29uc3QgYWN0aW9uID0gY2xhaW0oXG4gICAgICAgIGNsYXNzaWZ5KHtcbiAgICAgICAgICB0eXBlOiAncG9pbnRlcm1vdmUnLFxuICAgICAgICAgIGJ1dHRvbjogZS5idXR0b24sXG4gICAgICAgICAgbWV0YUtleTogZS5tZXRhS2V5LFxuICAgICAgICAgIGN0cmxLZXk6IGUuY3RybEtleSxcbiAgICAgICAgICBzaGlmdEtleTogZS5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGUuYWx0S2V5LFxuICAgICAgICAgIGNsaWVudFg6IGUuY2xpZW50WCxcbiAgICAgICAgICBjbGllbnRZOiBlLmNsaWVudFksXG4gICAgICAgICAgc3BhY2VIZWxkOiBpc1NwYWNlSGVsZD8uKCkgPz8gZmFsc2UsXG4gICAgICAgICAgYWN0aXZlVG9vbDogZ2V0QWN0aXZlVG9vbCgpLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIGRpc3BhdGNoKGFjdGlvbik7XG4gICAgfTtcblxuICAgIGNvbnN0IG9uUG9pbnRlckRvd24gPSAoZTogUG9pbnRlckV2ZW50KTogdm9pZCA9PiB7XG4gICAgICAvLyBQaGFzZSA2IOKAlCBvdmVybGF5IHN1cmZhY2VzIChjb21wb3NlciAvIHRocmVhZCAvIG1lbnRpb24gcG9wdXApIG93blxuICAgICAgLy8gdGhlaXIgb3duIGNsaWNrcy4gVGhlIHJvdXRlciBpcyBpbiBjYXB0dXJlIHBoYXNlLCBzbyB3ZSBoYXZlIHRvXG4gICAgICAvLyBiYWlsIEhFUkUgYmVmb3JlIGNsYXNzaWZ5IGNhbiBjbGFpbSB0aGUgZXZlbnQuXG4gICAgICBpZiAoaXNPdmVybGF5VGFyZ2V0KGUudGFyZ2V0KSkgcmV0dXJuO1xuICAgICAgY29uc3QgYWN0aW9uID0gY2xhaW0oXG4gICAgICAgIGNsYXNzaWZ5KHtcbiAgICAgICAgICB0eXBlOiAncG9pbnRlcmRvd24nLFxuICAgICAgICAgIGJ1dHRvbjogZS5idXR0b24sXG4gICAgICAgICAgbWV0YUtleTogZS5tZXRhS2V5LFxuICAgICAgICAgIGN0cmxLZXk6IGUuY3RybEtleSxcbiAgICAgICAgICBzaGlmdEtleTogZS5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGUuYWx0S2V5LFxuICAgICAgICAgIGNsaWVudFg6IGUuY2xpZW50WCxcbiAgICAgICAgICBjbGllbnRZOiBlLmNsaWVudFksXG4gICAgICAgICAgc3BhY2VIZWxkOiBpc1NwYWNlSGVsZD8uKCkgPz8gZmFsc2UsXG4gICAgICAgICAgYWN0aXZlVG9vbDogZ2V0QWN0aXZlVG9vbCgpLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIGlmIChhY3Rpb24ua2luZCAhPT0gJ25vLW9wJykge1xuICAgICAgICAvLyBTdXBwcmVzcyBuYXRpdmUgYmVoYXZpb3Igb24gZXZlcnkgZXZlbnQgdGhlIHJvdXRlciBjbGFpbXMg4oCUXG4gICAgICAgIC8vIGJ1dHRvbiBwcmVzc2VzIGRvbid0IGZpcmUsIGlucHV0cyBkb24ndCBmb2N1cywgdGhlIGNhbnZhc1xuICAgICAgICAvLyBjb250ZW50J3Mgb3duIGNsaWNrIGhhbmRsZXJzIGRvbid0IHJ1bi4gVGhlIHJvdXRlciBsaXZlcyBpblxuICAgICAgICAvLyBjYXB0dXJlIHBoYXNlIHNvIHRoaXMgZmlyZXMgYmVmb3JlIGRlc2NlbmRhbnRzLlxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICB9XG4gICAgICBkaXNwYXRjaChhY3Rpb24pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBQYWlyZWQgbW91c2Vkb3duIGxpc3RlbmVyIOKAlCBwcmV2ZW50RGVmYXVsdCBvbiBwb2ludGVyZG93biBkb2VzIE5PVFxuICAgICAqIHN1cHByZXNzIHRoZSBtb3VzZWRvd24gZXZlbnQgdGhhdCBicm93c2VycyBmaXJlIGFsb25nc2lkZSwgYW5kXG4gICAgICogYDxpbnB1dD5gIC8gYDxidXR0b24+YCBmb2N1cyBpcyBkcml2ZW4gYnkgbW91c2Vkb3duJ3MgZGVmYXVsdCBiZWhhdmlvci5cbiAgICAgKiBXZSBtaXJyb3IgdGhlIHNhbWUgZ2F0ZSBhcyBwb2ludGVyZG93biBzbyBzdXBwcmVzc2VkIHBvaW50ZXJkb3ducyBhbHNvXG4gICAgICogc3RvcCB0aGVpciB0d2luIG1vdXNlZG93bi5cbiAgICAgKi9cbiAgICBjb25zdCBvbk1vdXNlRG93biA9IChlOiBNb3VzZUV2ZW50KTogdm9pZCA9PiB7XG4gICAgICBpZiAoaXNPdmVybGF5VGFyZ2V0KGUudGFyZ2V0KSkgcmV0dXJuO1xuICAgICAgY29uc3QgYWN0aW9uID0gY2xhaW0oXG4gICAgICAgIGNsYXNzaWZ5KHtcbiAgICAgICAgICB0eXBlOiAncG9pbnRlcmRvd24nLFxuICAgICAgICAgIGJ1dHRvbjogZS5idXR0b24sXG4gICAgICAgICAgbWV0YUtleTogZS5tZXRhS2V5LFxuICAgICAgICAgIGN0cmxLZXk6IGUuY3RybEtleSxcbiAgICAgICAgICBzaGlmdEtleTogZS5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGUuYWx0S2V5LFxuICAgICAgICAgIGNsaWVudFg6IGUuY2xpZW50WCxcbiAgICAgICAgICBjbGllbnRZOiBlLmNsaWVudFksXG4gICAgICAgICAgc3BhY2VIZWxkOiBpc1NwYWNlSGVsZD8uKCkgPz8gZmFsc2UsXG4gICAgICAgICAgYWN0aXZlVG9vbDogZ2V0QWN0aXZlVG9vbCgpLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIGlmIChhY3Rpb24ua2luZCAhPT0gJ25vLW9wJykge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICAgIC8vIHByZXZlbnREZWZhdWx0IGFib3ZlIHN0b3BzIG1vdXNlZG93bidzIGRlZmF1bHQgRk9DVVMsIHNvIGEgQ21kLWNsaWNrXG4gICAgICAgIC8vIHNlbGVjdCB3b3VsZCBsZWF2ZSB0aGUgaWZyYW1lIHVuZm9jdXNlZCBhbmQgZXZlcnkgaW4tY2FudmFzIGtleWJvYXJkXG4gICAgICAgIC8vIHNob3J0Y3V0IChhcnJvdy1udWRnZSwgQ21kK0QsIGNvcHkvcGFzdGUtc3R5bGUsIERlbGV0ZSkgZGVhZCB1bnRpbCBhXG4gICAgICAgIC8vIGRyYWcgaGFwcGVuZWQgdG8gZm9jdXMgaXQgKGRvZ2Zvb2Q6IFwiZnVuZ3VqZSBqZW4ga2R5xb4gaG51IG15xaHDrVwiKS5cbiAgICAgICAgLy8gUmVzdG9yZSBjYW52YXMgZm9jdXMgZXhwbGljaXRseSBzbyB0aGUga2V5ZG93biBsaXN0ZW5lcnMgZmlyZS5cbiAgICAgICAgaWYgKGFjdGlvbi5raW5kID09PSAnc2VsZWN0Jykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB3aW5kb3cuZm9jdXMoKTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8qIGZvY3VzIG1heSBiZSByZWplY3RlZCBvdXRzaWRlIGEgdXNlciBnZXN0dXJlICovXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENsaWNrIGxpc3RlbmVyIOKAlCBmaXJlcyBBRlRFUiBwb2ludGVyZG93bitwb2ludGVydXAuIEV2ZW4gd2l0aFxuICAgICAqIHByZXZlbnREZWZhdWx0IG9uIG1vdXNlZG93biwgdGhlIGNsaWNrIGV2ZW50IHN0aWxsIHN5bnRoZXNpemVzIGZvclxuICAgICAqIG5vbi1mb3JtIGVsZW1lbnRzLiBXZSBzdXBwcmVzcyBpdCB3aGVuZXZlciB0aGUgcm91dGVyIGNsYWltZWQgdGhlXG4gICAgICogbWF0Y2hpbmcgcG9pbnRlcmRvd24gKHJlLWNsYXNzaWZ5IHdpdGggdGhlIHNhbWUgbW9kaWZpZXJzKS5cbiAgICAgKi9cbiAgICBjb25zdCBvbkNsaWNrID0gKGU6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgIGlmIChpc092ZXJsYXlUYXJnZXQoZS50YXJnZXQpKSByZXR1cm47XG4gICAgICBjb25zdCB0b29sID0gZ2V0QWN0aXZlVG9vbCgpO1xuICAgICAgY29uc3QgbW9kID0gZS5tZXRhS2V5IHx8IGUuY3RybEtleTtcbiAgICAgIC8vIE1hcCB0aGUgY2xpY2sgdG8gdGhlIGFjdGlvbiBraW5kIHRoZSBtYXRjaGluZyBwb2ludGVyZG93biB3b3VsZCBoYXZlXG4gICAgICAvLyBwcm9kdWNlZCwgdGhlbiBob25vciB0aGUgY2xhaW0gYWxsb3dsaXN0IHNvIGEgc2NvcGVkIHJvdXRlciAodGhlXG4gICAgICAvLyBjb21tZW50IG1vdW50IGxheWVyKSBkb2Vzbid0IHN1cHByZXNzIGNsaWNrcyBpdCBuZXZlciBjbGFpbWVkLlxuICAgICAgY29uc3Qgd291bGRSb3V0ZUtpbmQ6IFJvdXRlckFjdGlvblsna2luZCddIHwgbnVsbCA9XG4gICAgICAgIHRvb2wgPT09ICdjb21tZW50J1xuICAgICAgICAgID8gJ2Ryb3AtY29tbWVudCdcbiAgICAgICAgICA6IHRvb2wgPT09ICdtb3ZlJyAmJiBtb2QgJiYgZS5idXR0b24gPT09IDBcbiAgICAgICAgICAgID8gJ3NlbGVjdCdcbiAgICAgICAgICAgIDogZS5idXR0b24gPT09IDJcbiAgICAgICAgICAgICAgPyAnY29udGV4dC1tZW51J1xuICAgICAgICAgICAgICA6IG51bGw7XG4gICAgICBpZiAod291bGRSb3V0ZUtpbmQgJiYgKCFjbGFpbWFibGVBY3Rpb25zIHx8IGNsYWltYWJsZUFjdGlvbnMuaGFzKHdvdWxkUm91dGVLaW5kKSkpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBvbkNvbnRleHRNZW51ID0gKGU6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgIGNvbnN0IGFjdGlvbiA9IGNsYWltKFxuICAgICAgICBjbGFzc2lmeSh7XG4gICAgICAgICAgdHlwZTogJ2NvbnRleHRtZW51JyxcbiAgICAgICAgICBjbGllbnRYOiBlLmNsaWVudFgsXG4gICAgICAgICAgY2xpZW50WTogZS5jbGllbnRZLFxuICAgICAgICAgIG1ldGFLZXk6IGUubWV0YUtleSxcbiAgICAgICAgICBjdHJsS2V5OiBlLmN0cmxLZXksXG4gICAgICAgICAgc2hpZnRLZXk6IGUuc2hpZnRLZXksXG4gICAgICAgICAgYWx0S2V5OiBlLmFsdEtleSxcbiAgICAgICAgICBhY3RpdmVUb29sOiBnZXRBY3RpdmVUb29sKCksXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgICAgaWYgKGFjdGlvbi5raW5kID09PSAnbm8tb3AnKSByZXR1cm47IC8vIG5vdCBvdXJzIHRvIGNsYWltIOKAlCBsZXQgaXQgYnViYmxlXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgZGlzcGF0Y2goYWN0aW9uKTtcbiAgICB9O1xuXG4gICAgY29uc3Qgb25LZXlEb3duID0gKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgIGNvbnN0IGFjdGlvbiA9IGNsYWltKFxuICAgICAgICBjbGFzc2lmeSh7XG4gICAgICAgICAgdHlwZTogJ2tleWRvd24nLFxuICAgICAgICAgIGtleTogZS5rZXksXG4gICAgICAgICAgbWV0YUtleTogZS5tZXRhS2V5LFxuICAgICAgICAgIGN0cmxLZXk6IGUuY3RybEtleSxcbiAgICAgICAgICBzaGlmdEtleTogZS5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGUuYWx0S2V5LFxuICAgICAgICAgIGlzRWRpdGFibGU6IGlzRWRpdGFibGVUYXJnZXQoZS50YXJnZXQpLFxuICAgICAgICAgIGFjdGl2ZVRvb2w6IGdldEFjdGl2ZVRvb2woKSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgICBpZiAoXG4gICAgICAgIGFjdGlvbi5raW5kID09PSAndG9vbCcgfHxcbiAgICAgICAgYWN0aW9uLmtpbmQgPT09ICdlc2NhcGUnIHx8XG4gICAgICAgIGFjdGlvbi5raW5kID09PSAndW5kbycgfHxcbiAgICAgICAgYWN0aW9uLmtpbmQgPT09ICdyZWRvJ1xuICAgICAgKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH1cbiAgICAgIGRpc3BhdGNoKGFjdGlvbik7XG4gICAgfTtcblxuICAgIC8vIENhcHR1cmUgcGhhc2UgZm9yIHBvaW50ZXIvbW91c2UvY2xpY2sgZXZlbnRzIOKAlCByb3V0ZXIgcnVucyBCRUZPUkVcbiAgICAvLyBkZXNjZW5kYW50cyAoYnV0dG9ucywgaW5wdXRzLCBjYW52YXMgY29udGVudCBsaXN0ZW5lcnMpLiBGb3IgZXZlbnRzIHRoZVxuICAgIC8vIGNsYXNzaWZpZXIgY2xhaW1zLCB3ZSBwcmV2ZW50RGVmYXVsdCArIHN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiBzbyB0aGVcbiAgICAvLyBkZXNjZW5kYW50cyBuZXZlciBzZWUgdGhlbS5cbiAgICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgb25Qb2ludGVyTW92ZSwgeyBwYXNzaXZlOiB0cnVlIH0pO1xuICAgIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCBvblBvaW50ZXJEb3duLCB7IGNhcHR1cmU6IHRydWUgfSk7XG4gICAgaG9zdC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBvbk1vdXNlRG93biwgeyBjYXB0dXJlOiB0cnVlIH0pO1xuICAgIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvbkNsaWNrLCB7IGNhcHR1cmU6IHRydWUgfSk7XG4gICAgaG9zdC5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIG9uQ29udGV4dE1lbnUsIHsgY2FwdHVyZTogdHJ1ZSB9KTtcbiAgICAvLyBLZXkgZXZlbnRzOiBhdHRhY2ggb24gZG9jdW1lbnQgc28gZm9jdXMgaW5zaWRlIGFueSBkZXNjZW5kYW50IGlzIE9LO1xuICAgIC8vIHRoZSBlZGl0YWJsZS10YXJnZXQgZ2F0ZSBoYW5kbGVzIHRoZSBcInVzZXIgaXMgdHlwaW5nXCIgY2FzZS5cbiAgICBjb25zdCBkb2MgPSBob3N0Lm93bmVyRG9jdW1lbnQgPz8gZG9jdW1lbnQ7XG4gICAgZG9jLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbktleURvd24sIHRydWUpO1xuXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCBvblBvaW50ZXJNb3ZlKTtcbiAgICAgIGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCBvblBvaW50ZXJEb3duLCB7XG4gICAgICAgIGNhcHR1cmU6IHRydWUsXG4gICAgICB9IGFzIEV2ZW50TGlzdGVuZXJPcHRpb25zKTtcbiAgICAgIGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgb25Nb3VzZURvd24sIHsgY2FwdHVyZTogdHJ1ZSB9IGFzIEV2ZW50TGlzdGVuZXJPcHRpb25zKTtcbiAgICAgIGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvbkNsaWNrLCB7IGNhcHR1cmU6IHRydWUgfSBhcyBFdmVudExpc3RlbmVyT3B0aW9ucyk7XG4gICAgICBob3N0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51Jywgb25Db250ZXh0TWVudSwge1xuICAgICAgICBjYXB0dXJlOiB0cnVlLFxuICAgICAgfSBhcyBFdmVudExpc3RlbmVyT3B0aW9ucyk7XG4gICAgICBkb2MucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5RG93biwgdHJ1ZSk7XG4gICAgfTtcbiAgfSwgW2VuYWJsZWQsIGhvc3RSZWYsIGdldEFjdGl2ZVRvb2wsIGlzU3BhY2VIZWxkLCBjYWxsYmFja3MsIGNsYWltYWJsZUFjdGlvbnNdKTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyByZXNvbHZlSG92ZXJUYXJnZXQg4oCUIHdhbGtzIGZyb20gYSBjbGllbnRYL2NsaWVudFkgcGFpciB0byB0aGUgY2FudmFzIGVsZW1lbnRcbi8vIG9mIGludGVyZXN0LiBEZWZhdWx0ID0gdG9wbW9zdCBgW2RhdGEtY2QtaWRdYCBhbmNlc3RvciAodGhlIHN0YWJsZVxuLy8gcGlwZWxpbmUtc3RhbXBlZCBhbmNob3IpLiBgZGVlcCA9IHRydWVgIHJldHVybnMgdGhlIGRlZXBlc3QgZGVzY2VuZGFudFxuLy8gKENtZC1ob3ZlciBiZWhhdmlvcikuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSG92ZXJUYXJnZXQge1xuICBlbDogRWxlbWVudDtcbiAgY2RJZDogc3RyaW5nIHwgbnVsbDtcbiAgYXJ0Ym9hcmRJZDogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVIb3ZlclRhcmdldChcbiAgZG9jOiBEb2N1bWVudCxcbiAgY2xpZW50WDogbnVtYmVyLFxuICBjbGllbnRZOiBudW1iZXIsXG4gIG9wdHM6IHsgZGVlcDogYm9vbGVhbiB9XG4pOiBIb3ZlclRhcmdldCB8IG51bGwge1xuICBjb25zdCBoaXQgPSBkb2MuZWxlbWVudEZyb21Qb2ludChjbGllbnRYLCBjbGllbnRZKTtcbiAgaWYgKCFoaXQpIHJldHVybiBudWxsO1xuICAvLyBTa2lwIHRoZSBmbG9hdGluZyBjaHJvbWUgKE1pbmlNYXAgLyBab29tVG9vbGJhciAvIFRvb2xQYWxldHRlIC8gQ29udGV4dE1lbnUpXG4gIC8vIEFORCB0aGUgY2FudmFzL3dvcmxkIGZyYW1lIGl0c2VsZiDigJQgdGhlIHVzZXIgaXMgbmV2ZXIgYXNraW5nIHRvIFwic2VsZWN0XG4gIC8vIHRoZSBlbnRpcmUgY2FudmFzIHZpZXdwb3J0LFwiIHRoYXQncyBhIFVJIGFjY2lkZW50IGZyb20gY2xpbWJpbmcgdG9vIGhpZ2guXG4gIGlmIChoaXQuY2xvc2VzdD8uKCcuZGMtbW0sIC5kYy16b29tLXRiLCAuZGMtdG9vbC1wYWxldHRlLCAuZGMtY29udGV4dC1tZW51LCAuZGMtY3YtZ3JvdXAtYmJveCcpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBhcnRib2FyZEVsID0gaGl0LmNsb3Nlc3Q/LignW2RhdGEtZGMtc2NyZWVuXScpID8/IG51bGw7XG4gIGNvbnN0IGFydGJvYXJkSWQgPSBhcnRib2FyZEVsPy5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGMtc2NyZWVuJykgPz8gbnVsbDtcblxuICAvLyBIb3Zlci10YXJnZXQgaGFyZCBjZWlsaW5nID0gYC5kYy1hcnRib2FyZC1ib2R5YC4gSW5uZXIgRE9NIGNvbnRlbnQgbGl2ZXNcbiAgLy8gdGhlcmU7IGNocm9tZSBsaXZlcyBvdXRzaWRlIChsYWJlbCwgaGVhZGVyLCBhcnRpY2xlIHJvb3QpLiBUaGUgdHdvIHBhdGhzXG4gIC8vIGRpdmVyZ2UgZnJvbSBoZXJlOlxuICAvLyAgICogaGl0IOKIiCBib2R5IOKGkiByZXNvbHZlIHRvIHRoZSBkZWVwZXN0IHN0YW1wZWQgZWxlbWVudCAoZXhpc3RpbmdcbiAgLy8gICAgIGRlZXAvdG9wIGxvZ2ljIGJlbG93KS5cbiAgLy8gICAqIGhpdCDiiIggY2hyb21lIChsYWJlbC9oZWFkZXIvYXJ0aWNsZS1yb290KSDihpIgdGhlIHVzZXIgd2FudHMgdG8gc2VsZWN0XG4gIC8vICAgICB0aGUgV0hPTEUgYXJ0Ym9hcmQuIFJldHVybiB0aGUgYXJ0aWNsZSBlbGVtZW50IGl0c2VsZiB3aXRoIG5vIGNkSWQ7XG4gIC8vICAgICBjb25zdW1lcnMgKGhvdmVyVGFyZ2V0VG9TZWxlY3Rpb24pIGZhbGwgYmFjayB0byBhXG4gIC8vICAgICBgW2RhdGEtZGMtc2NyZWVuPVwi4oCmXCJdYCBzZWxlY3RvciB0aGF0IHdyYXBzIHRoZSB3aG9sZSBmcmFtZS4gVGhpcyBpc1xuICAvLyAgICAgd2hhdCBlbmFibGVzIENtZCtTaGlmdCtDbGljayBtdWx0aS1zZWxlY3Qgb2YgYXJ0Ym9hcmRzIChUMjQgLyBHOCkuXG4gIGNvbnN0IGJvZHlFbCA9IGhpdC5jbG9zZXN0Py4oJy5kYy1hcnRib2FyZC1ib2R5JykgPz8gbnVsbDtcbiAgaWYgKCFib2R5RWwpIHtcbiAgICBpZiAoYXJ0Ym9hcmRFbCAmJiBhcnRib2FyZElkKSB7XG4gICAgICByZXR1cm4geyBlbDogYXJ0Ym9hcmRFbCwgY2RJZDogbnVsbCwgYXJ0Ym9hcmRJZCB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBpZiAoaGl0ID09PSBib2R5RWwpIHtcbiAgICAvLyBDbGlja2VkIHRoZSBib2R5IHdyYXBwZXIgaXRzZWxmIChlbXB0eSBwYWRkaW5nIGluc2lkZSBhbiBhcnRib2FyZCwgbm9cbiAgICAvLyB1c2VyIGNvbnRlbnQgdW5kZXIgdGhlIGN1cnNvcikuIFByb21vdGUgdG8gXCJzZWxlY3Qgd2hvbGUgYXJ0Ym9hcmRcIiBzb1xuICAgIC8vIHRoZSBnZXN0dXJlIHN0YXlzIGNvbnNpc3RlbnQgd2l0aCBjaHJvbWUgY2xpY2tzIGFib3ZlLlxuICAgIGlmIChhcnRib2FyZEVsICYmIGFydGJvYXJkSWQpIHtcbiAgICAgIHJldHVybiB7IGVsOiBhcnRib2FyZEVsLCBjZElkOiBudWxsLCBhcnRib2FyZElkIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgaWYgKG9wdHMuZGVlcCkge1xuICAgIC8vIERlZXBlc3QgbW9kZSDigJQgdGhlIGhpdCBlbGVtZW50IElTIHRoZSB0YXJnZXQuIFVzZSBpdHMgT1dOIGRhdGEtY2QtaWRcbiAgICAvLyB3aGVuIHByZXNlbnQ7IG5ldmVyIGNsaW1iIHRvIGFuIGFuY2VzdG9yJ3MgaWQgKGNsaW1iaW5nIHdhcyB0aGUgY2F1c2VcbiAgICAvLyBvZiBcIkNtZC1jbGljayBvbiBhIGRlZXAgc3BhbiBzZWxlY3RzIHRoZSB3aG9sZSBhcnRib2FyZCByb290XCIpLiBXaGVuXG4gICAgLy8gdGhlIGhpdCBsYWNrcyBhIHN0YW1wZWQgaWQsIGNvbnN1bWVycyBmYWxsIGJhY2sgdG8gYSBDU1MtcGF0aCBzZWxlY3Rvci5cbiAgICBjb25zdCBjZElkID0gaGl0LmdldEF0dHJpYnV0ZT8uKCdkYXRhLWNkLWlkJykgPz8gbnVsbDtcbiAgICByZXR1cm4geyBlbDogaGl0LCBjZElkLCBhcnRib2FyZElkIH07XG4gIH1cblxuICAvLyBUb3AgbW9kZSDigJQgY2xpbWIgdG8gdGhlIHRvcG1vc3QgZGVzY2VuZGFudCBvZiB0aGUgYXJ0Ym9hcmQgYm9keSB0aGF0XG4gIC8vIHN0aWxsIGNhcnJpZXMgYSBkYXRhLWNkLWlkLiBIYXJkIGNlaWxpbmcgaXMgYm9keUVsIGl0c2VsZiAobmV2ZXIgc2VsZWN0XG4gIC8vIHRoZSBib2R5IHdyYXBwZXIgb3IgaGlnaGVyKS5cbiAgbGV0IGN1cjogRWxlbWVudCB8IG51bGwgPSBoaXQ7XG4gIGxldCB0b3BDZEVsOiBFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHdoaWxlIChjdXIgJiYgY3VyICE9PSBib2R5RWwpIHtcbiAgICBpZiAoY3VyLmhhc0F0dHJpYnV0ZT8uKCdkYXRhLWNkLWlkJykpIHRvcENkRWwgPSBjdXI7XG4gICAgY3VyID0gY3VyLnBhcmVudEVsZW1lbnQ7XG4gIH1cbiAgY29uc3QgZWwgPSB0b3BDZEVsID8/IGhpdDtcbiAgY29uc3QgY2RJZCA9IGVsLmdldEF0dHJpYnV0ZT8uKCdkYXRhLWNkLWlkJykgPz8gbnVsbDtcbiAgcmV0dXJuIHsgZWwsIGNkSWQsIGFydGJvYXJkSWQgfTtcbn1cbiIsCiAgICAiLyoqXG4gKiBAZmlsZSAgICAgICB1c2UtZWxlbWVudC1yZXNpemUudHN4IOKAlCBmZWF0dXJlLWVsZW1lbnQtZWRpdGluZy1yb2J1c3RuZXNzIFN0YWdlIERcbiAqIEBzY29wZSAgICAgIGFwcHMvc3R1ZGlvL3VzZS1lbGVtZW50LXJlc2l6ZS50c3hcbiAqIEBwdXJwb3NlICAgIE9uLWNhbnZhcyBkcmFnLXJlc2l6ZSBmb3IgdGhlIHNpbmdsZSBzZWxlY3RlZCBDQU5WQVMgRUxFTUVOVFxuICogICAgICAgICAgICAgKGFuIGBbZGF0YS1jZC1pZF1gIG5vZGUgaW4gYW4gYXJ0Ym9hcmQpLCB0aGUgRE9NIGNvdW50ZXJwYXJ0IG9mXG4gKiAgICAgICAgICAgICBgdXNlLWFubm90YXRpb24tcmVzaXplLnRzeGAgKHdoaWNoIHRhcmdldHMgdGhlIFNWRyBhbm5vdGF0aW9uXG4gKiAgICAgICAgICAgICBtb2RlbCkuIFJlbmRlcnMgOCBzY3JlZW4tc3BhY2UgaGFuZGxlcyAoNCBjb3JuZXIgKyA0IGVkZ2UpIHRoYXRcbiAqICAgICAgICAgICAgIHN0YXkgYSBjb25zdGFudCA4IHB4IGF0IGFueSB6b29tLCB3aXRoIEZpZ0phbSBtb2RpZmllciBncmFtbWFyOlxuICogICAgICAgICAgICAgU2hpZnQgPSBsb2NrIGFzcGVjdCByYXRpbywgQWx0ID0gcmVzaXplIGZyb20gY2VudGVyLiBPbiByZWxlYXNlIGl0XG4gKiAgICAgICAgICAgICBjb21taXRzIGB3aWR0aGAvYGhlaWdodGAgKCsgYGxlZnRgL2B0b3BgIGZvciBhIHRvcC9sZWZ0LWVkZ2UgZHJhZ1xuICogICAgICAgICAgICAgb24gYW4gb3V0LW9mLWZsb3cgZWxlbWVudCkgdGhyb3VnaCB0aGUgU0FNRSBgcmVwb3NpdGlvbi1yZXF1ZXN0YC1cbiAqICAgICAgICAgICAgIHN0eWxlIGxhbmUgdGhlIGNvb3JkaW5hdGUgZHJhZyB1c2VzICh1bnRydXN0ZWQgY2FudmFzIFJFUVVFU1RTLFxuICogICAgICAgICAgICAgbWFpbi1vcmlnaW4gc2hlbGwgV1JJVEVTIHZpYSBgL19hcGkvZWRpdC1jc3NgIOKAlCBERFItMDU0KS5cbiAqXG4gKiAgICAgICAgICAgICBDb21wb3NpdGlvbiB3aXRoIFJlb3JkZXJEcmFnOiB0aGUgaGFuZGxlcyBhcmUgYHBvc2l0aW9uOmZpeGVkYFxuICogICAgICAgICAgICAgb3ZlcmxheSBkaXZzIE9VVFNJREUgdGhlIGFydGJvYXJkLCBzbyBSZW9yZGVyRHJhZydzIGBlbC5jb250YWluc1xuICogICAgICAgICAgICAgKHRhcmdldClgIGdhdGUgKGNhbnZhcy1zaGVsbCkgbmV2ZXIgZmlyZXMgZm9yIGEgaGFuZGxlIHBvaW50ZXJkb3duXG4gKiAgICAgICAgICAgICDigJQgYSBib2R5IGRyYWcgc3RpbGwgbW92ZXMgdmlhIHJlb3JkZXIvcmVwb3NpdGlvbiwgYSBoYW5kbGUgZHJhZ1xuICogICAgICAgICAgICAgcmVzaXplcy5cbiAqXG4gKiAgICAgICAgICAgICBJbi1mbG93IGVsZW1lbnRzIHJlc2l6ZSBieSB3cml0aW5nIGV4cGxpY2l0IGB3aWR0aGAvYGhlaWdodGAgb25seVxuICogICAgICAgICAgICAgKE5FVkVSIGNvbnZlcnQtdG8tYWJzb2x1dGUg4oCUIG91dCBvZiBzY29wZSk7IGFuIG91dC1vZi1mbG93XG4gKiAgICAgICAgICAgICAoYWJzb2x1dGUvZml4ZWQpIGVsZW1lbnQgYWRkaXRpb25hbGx5IG1vdmVzIGBsZWZ0YC9gdG9wYCB3aGVuIHRoZVxuICogICAgICAgICAgICAgdG9wL2xlZnQgZWRnZSBpcyBkcmFnZ2VkLCBzbyB0aGUgcmVzaXplIGZlZWxzIG9yaWdpbi1jb3JyZWN0LlxuICovXG5cbmltcG9ydCB7IHR5cGUgUmVhY3ROb2RlLCB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VSZWYgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyBnbG9iYWxDZE9jY3VycmVuY2UsIHJlc29sdmVTZWxlY3Rpb25FbCB9IGZyb20gJy4vZG9tLXNlbGVjdGlvbi50cyc7XG5pbXBvcnQgeyBpc0VsZW1lbnREcmFnQWN0aXZlIH0gZnJvbSAnLi9kcmFnLXN0YXRlLnRzJztcbmltcG9ydCB7IHVzZVNlbGVjdGlvblNldCB9IGZyb20gJy4vdXNlLXNlbGVjdGlvbi1zZXQudHN4JztcbmltcG9ydCB7IHVzZVRvb2xNb2RlIH0gZnJvbSAnLi91c2UtdG9vbC1tb2RlLnRzeCc7XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gSGFuZGxlIENTUyDigJQgbWlycm9ycyB0aGUgYC5kYy1hbm5vdC1yZXNpemUtaGFuZGxlYCByZWNpcGUgKERTIGAuc2VsLWhhbmRsZWA6XG4vLyBhY2NlbnQgc3F1YXJlLCBhY2NlbnQtZmcgaGFpcmxpbmUgYm9yZGVyLCByYWRpdXMteHMpLiBLZXB0IGFzIGl0cyBvd24gY2xhc3Mgc29cbi8vIGl0IGRvZXNuJ3QgZGVwZW5kIG9uIHRoZSBhbm5vdGF0aW9uIG92ZXJsYXkgYmVpbmcgbW91bnRlZC4gQ29tbWVudCBtdXN0IHN0YXlcbi8vIGJhY2t0aWNrLWZyZWUg4oCUIGl0IGxpdmVzIGluc2lkZSB0aGUgdGVtcGxhdGUgbGl0ZXJhbC5cblxuY29uc3QgRUxfUkVTSVpFX0NTUyA9IGBcbi5kYy1lbC1yZXNpemUtaGFuZGxlIHtcbiAgcG9zaXRpb246IGZpeGVkO1xuICB3aWR0aDogOHB4O1xuICBoZWlnaHQ6IDhweDtcbiAgYmFja2dyb3VuZDogdmFyKC0tbWF1ZGUtaHVkLWFjY2VudCwgb2tsY2goMC42ODAgMC4xODAgMjY4KSk7XG4gIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLW1hdWRlLWh1ZC1hY2NlbnQtZmcsIG9rbGNoKDAuMTgwIDAuMDMwIDI2OCkpO1xuICBib3JkZXItcmFkaXVzOiAzcHg7XG4gIHotaW5kZXg6IDY7XG4gIHBvaW50ZXItZXZlbnRzOiBhdXRvO1xuICB0b3VjaC1hY3Rpb246IG5vbmU7XG4gIG9wYWNpdHk6IDA7XG4gIHRyYW5zaXRpb246IG9wYWNpdHkgMTIwbXMgY3ViaWMtYmV6aWVyKDAuNCwgMCwgMC4yLCAxKTtcbn1cbi5kYy1lbC1yZXNpemUtaGFuZGxlW2RhdGEtY29ybmVyPVwibndcIl0sIC5kYy1lbC1yZXNpemUtaGFuZGxlW2RhdGEtY29ybmVyPVwic2VcIl0geyBjdXJzb3I6IG53c2UtcmVzaXplICFpbXBvcnRhbnQ7IH1cbi5kYy1lbC1yZXNpemUtaGFuZGxlW2RhdGEtY29ybmVyPVwibmVcIl0sIC5kYy1lbC1yZXNpemUtaGFuZGxlW2RhdGEtY29ybmVyPVwic3dcIl0geyBjdXJzb3I6IG5lc3ctcmVzaXplICFpbXBvcnRhbnQ7IH1cbi5kYy1lbC1yZXNpemUtaGFuZGxlW2RhdGEtY29ybmVyPVwiblwiXSwgLmRjLWVsLXJlc2l6ZS1oYW5kbGVbZGF0YS1jb3JuZXI9XCJzXCJdIHsgY3Vyc29yOiBucy1yZXNpemUgIWltcG9ydGFudDsgd2lkdGg6IDE0cHg7IGhlaWdodDogNnB4OyB9XG4uZGMtZWwtcmVzaXplLWhhbmRsZVtkYXRhLWNvcm5lcj1cImVcIl0sIC5kYy1lbC1yZXNpemUtaGFuZGxlW2RhdGEtY29ybmVyPVwid1wiXSB7IGN1cnNvcjogZXctcmVzaXplICFpbXBvcnRhbnQ7IHdpZHRoOiA2cHg7IGhlaWdodDogMTRweDsgfVxuLyogUm90YXRpb24gbGl2ZXMgaW4gSU5WSVNJQkxFIHpvbmVzIGp1c3Qgb3V0c2lkZSBlYWNoIENPUk5FUiAoRmlnSmFtIC8gbWlycm9yc1xuICAgdGhlIGFubm90YXRpb24gLmRjLWFubm90LXJvdGF0ZS16b25lKSDigJQgdGhlIGN1cnNvciBmbGlwcyB0byBhIHJvdGF0ZSBnbHlwaCBhbmRcbiAgIGRyYWdnaW5nIHR1cm5zIHRoZSBlbGVtZW50LiB6LWluZGV4IEJFTE9XIHRoZSBjb3JuZXIgc3F1YXJlcyBzbyB0aGUgcmVzaXplXG4gICBzcXVhcmUgd2lucyBvbiB0aGUgaW5uZXIgb3ZlcmxhcDsgdGhlIHN1cnJvdW5kaW5nIHJpbmcgcm90YXRlcy4gKi9cbi5kYy1lbC1yZXNpemUtaGFuZGxlW2RhdGEtY29ybmVyXj1cInJvdC1cIl0ge1xuICB3aWR0aDogMjBweDsgaGVpZ2h0OiAyMHB4O1xuICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50O1xuICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDtcbiAgYm9yZGVyLXJhZGl1czogMCAhaW1wb3J0YW50O1xuICB6LWluZGV4OiA1O1xuICBjdXJzb3I6IHVybChcImRhdGE6aW1hZ2Uvc3ZnK3htbCwlM0NzdmcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB3aWR0aD0nMjAnIGhlaWdodD0nMjAnIHZpZXdCb3g9JzAgMCAyMCAyMCclM0UlM0NnIGZpbGw9J25vbmUnIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcgc3Ryb2tlLWxpbmVqb2luPSdyb3VuZCclM0UlM0NwYXRoIHN0cm9rZT0nd2hpdGUnIHN0cm9rZS13aWR0aD0nNCcgZD0nTTQuOCAxMyBBNiA2IDAgMSAxIDE1LjIgMTMgTTIuMiAxMC44IEw0LjggMTMgTDcuNCAxMC45IE0xMi42IDEwLjkgTDE1LjIgMTMgTDE3LjggMTAuOCcvJTNFJTNDcGF0aCBzdHJva2U9J2JsYWNrJyBzdHJva2Utd2lkdGg9JzEuOCcgZD0nTTQuOCAxMyBBNiA2IDAgMSAxIDE1LjIgMTMgTTIuMiAxMC44IEw0LjggMTMgTDcuNCAxMC45IE0xMi42IDEwLjkgTDE1LjIgMTMgTDE3LjggMTAuOCcvJTNFJTNDL2clM0UlM0Mvc3ZnJTNFXCIpIDEwIDEwLCBhbGlhcyAhaW1wb3J0YW50O1xufVxuLyogVGFzayBMNyDigJQgbGl2ZSBXw5dIICgrIFgsWSBmb3IgYW4gb3V0LW9mLWZsb3cgZWRnZSBkcmFnKSByZWFkb3V0IHBpbGwsIHNob3duXG4gICBvbmx5IFdISUxFIGEgcmVzaXplIGlzIGluIGZsaWdodCAoc2VlIHRoZSB0aWNrKCkgZ2F0ZSBiZWxvdykuICovXG4uZGMtZWwtcmVzaXplLXJlYWRvdXQge1xuICBwb3NpdGlvbjogZml4ZWQ7XG4gIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIDEycHgpO1xuICBmb250LWZhbWlseTogdmFyKC0tbWF1ZGUtY2hyb21lLWZvbnQtbW9ubywgdWktbW9ub3NwYWNlLCBTRk1vbm8tUmVndWxhciwgbW9ub3NwYWNlKTtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBwYWRkaW5nOiAzcHggN3B4O1xuICBiYWNrZ3JvdW5kOiB2YXIoLS1tYXVkZS1odWQtYWNjZW50LCBva2xjaCgwLjY4MCAwLjE4MCAyNjgpKTtcbiAgY29sb3I6IHZhcigtLW1hdWRlLWh1ZC1hY2NlbnQtZmcsIG9rbGNoKDAuMTgwIDAuMDMwIDI2OCkpO1xuICBib3JkZXItcmFkaXVzOiA0cHg7XG4gIGxldHRlci1zcGFjaW5nOiAwLjAyZW07XG4gIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gIGZvbnQtdmFyaWFudC1udW1lcmljOiB0YWJ1bGFyLW51bXM7XG4gIHotaW5kZXg6IDY7XG4gIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICBvcGFjaXR5OiAwO1xuICB0cmFuc2l0aW9uOiBvcGFjaXR5IDEyMG1zIGN1YmljLWJlemllcigwLjQsIDAsIDAuMiwgMSk7XG59XG4vKiBJTlYtMiDigJQgcmV2ZWFsL3NldHRsZSBjb2xsYXBzZXMgdG8gMW1zLCBzYW1lIGlkaW9tIGFzIGV2ZXJ5IG90aGVyIG92ZXJsYXlcbiAgIHN0eWxlc2hlZXQgaW4gdGhpcyBjb2RlYmFzZSAoZXF1YWwtc3BhY2luZy1oYW5kbGVzLnRzeCwgZXRjKS4gVGhpcyBvdmVybGF5XG4gICBpcyBtb3VudGVkIGluc2lkZSB0aGUgY2FudmFzIGlmcmFtZSdzIE9XTiBkb2N1bWVudCwgd2hpY2ggbmV2ZXIgbG9hZHMgdGhlXG4gICBzaGVsbCdzIDEtdG9rZW5zLW1hdWRlLmNzcyDigJQgdGhlIHByZWZlcnMtcmVkdWNlZC1tb3Rpb24gZ3VhcmQgaGFzIHRvIGJlXG4gICByZS1kZWNsYXJlZCBwZXIgaW5qZWN0ZWQgc3R5bGVzaGVldCwgaXQgZG9lc24ndCBjYXNjYWRlIGluIGZyb20gdGhlIHNoZWxsLlxuICAgQ29tbWVudCBzdGF5cyBiYWNrdGljay1mcmVlIOKAlCBpdCBsaXZlcyBpbnNpZGUgdGhlIHRlbXBsYXRlIGxpdGVyYWwuICovXG5AbWVkaWEgKHByZWZlcnMtcmVkdWNlZC1tb3Rpb246IHJlZHVjZSkge1xuICAuZGMtZWwtcmVzaXplLWhhbmRsZSwgLmRjLWVsLXJlc2l6ZS1yZWFkb3V0IHsgdHJhbnNpdGlvbi1kdXJhdGlvbjogMW1zOyB9XG59XG5gLnRyaW0oKTtcblxuZnVuY3Rpb24gZW5zdXJlRWxlbWVudFJlc2l6ZVN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkYy1lbC1yZXNpemUtY3NzJykpIHJldHVybjtcbiAgY29uc3QgcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHMuaWQgPSAnZGMtZWwtcmVzaXplLWNzcyc7XG4gIHMudGV4dENvbnRlbnQgPSBFTF9SRVNJWkVfQ1NTO1xuICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHMpO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFB1cmUgcmVzaXplIG1hdGgg4oCUIHVuaXQtdGVzdGVkIHdpdGhvdXQgYSBET00uXG5cbmV4cG9ydCB0eXBlIEVsUmVzaXplQ29ybmVyID0gJ253JyB8ICduJyB8ICduZScgfCAnZScgfCAnc2UnIHwgJ3MnIHwgJ3N3JyB8ICd3JztcblxuLyoqIFRoZSA4IGhhbmRsZXMgaW4gYSBzdGFibGUgcmVuZGVyIG9yZGVyLiAqL1xuZXhwb3J0IGNvbnN0IEVMX1JFU0laRV9DT1JORVJTOiBFbFJlc2l6ZUNvcm5lcltdID0gWydudycsICduJywgJ25lJywgJ2UnLCAnc2UnLCAncycsICdzdycsICd3J107XG5cbmV4cG9ydCBpbnRlcmZhY2UgRWxSZXNpemVTdGFydCB7XG4gIC8qKiBXb3JsZC1weCBib3JkZXItYm94IGRpbWVuc2lvbnMgYXQgZHJhZyBzdGFydC4gKi9cbiAgdzogbnVtYmVyO1xuICBoOiBudW1iZXI7XG4gIC8qKiBBdXRob3JlZCBpbmxpbmUgYGxlZnRgL2B0b3BgICh3b3JsZCBweCksIG9yIE5hTiB3aGVuIG5vdCBwcmVzZW50LiAqL1xuICBsZWZ0OiBudW1iZXI7XG4gIHRvcDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVsUmVzaXplTW9kcyB7XG4gIGFzcGVjdDogYm9vbGVhbjsgLy8gU2hpZnQg4oaSIGxvY2sgc3RhcnQgcmF0aW9cbiAgY2VudGVyOiBib29sZWFuOyAvLyBBbHQg4oaSIHJlc2l6ZSBmcm9tIGNlbnRlclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVsUmVzaXplRmxhZ3Mge1xuICAvKiogVHJ1ZSBvbmx5IGZvciBhbiBvdXQtb2YtZmxvdyBlbGVtZW50IHdpdGggYW4gaW5saW5lIGBsZWZ0YCDigJQgc28gYSB3ZXN0LWVkZ2VcbiAgICogIGRyYWcgbWF5IG1vdmUgdGhlIG9yaWdpbi4gSW4tZmxvdyBlbGVtZW50cyByZXNpemUgZnJvbSB0aGVpciBsYXlvdXQgb3JpZ2luXG4gICAqICAod2lkdGgvaGVpZ2h0IG9ubHkpLCBuZXZlciBtb3ZpbmcgbGVmdC90b3AuICovXG4gIGNhbk1vdmVMZWZ0OiBib29sZWFuO1xuICBjYW5Nb3ZlVG9wOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVsUmVzaXplUmVzdWx0IHtcbiAgd2lkdGg6IG51bWJlcjtcbiAgaGVpZ2h0OiBudW1iZXI7XG4gIGxlZnQ/OiBudW1iZXI7XG4gIHRvcD86IG51bWJlcjtcbn1cblxuZnVuY3Rpb24gZWRnZUZsYWdzKGNvcm5lcjogRWxSZXNpemVDb3JuZXIpIHtcbiAgcmV0dXJuIHtcbiAgICBtb3Zlc0xlZnQ6IGNvcm5lciA9PT0gJ253JyB8fCBjb3JuZXIgPT09ICd3JyB8fCBjb3JuZXIgPT09ICdzdycsXG4gICAgbW92ZXNSaWdodDogY29ybmVyID09PSAnbmUnIHx8IGNvcm5lciA9PT0gJ2UnIHx8IGNvcm5lciA9PT0gJ3NlJyxcbiAgICBtb3Zlc1RvcDogY29ybmVyID09PSAnbncnIHx8IGNvcm5lciA9PT0gJ24nIHx8IGNvcm5lciA9PT0gJ25lJyxcbiAgICBtb3Zlc0JvdHRvbTogY29ybmVyID09PSAnc3cnIHx8IGNvcm5lciA9PT0gJ3MnIHx8IGNvcm5lciA9PT0gJ3NlJyxcbiAgfTtcbn1cblxuY29uc3Qgcm91bmQgPSAobjogbnVtYmVyKSA9PiBNYXRoLnJvdW5kKG4gKiAxMDApIC8gMTAwO1xuY29uc3QgTUlOX1NJWkUgPSAxO1xuXG4vKipcbiAqIENvbXB1dGUgdGhlIHRhcmdldCBib3ggZm9yIGEgcmVzaXplIGRyYWcuIGBkeFdgL2BkeVdgIGFyZSB0aGUgY3Vyc29yIGRlbHRhcyBpblxuICogV09STEQgdW5pdHMgKHNjcmVlbiBkZWx0YSDDtyB0aGUgZWxlbWVudCdzIG93biByZW5kZXIgem9vbSkuIFRoZSByZXN1bHQgY2Fycmllc1xuICogYGxlZnRgL2B0b3BgIE9OTFkgd2hlbiB0aGUgY29ycmVzcG9uZGluZyBlZGdlIG1vdmVkIEFORCB0aGUgZmxhZyBwZXJtaXRzIGl0XG4gKiAob3V0LW9mLWZsb3cgd2l0aCBhbiBpbmxpbmUgdmFsdWUpIOKAlCBzbyBhbiBpbi1mbG93IGVsZW1lbnQgbmV2ZXIgZ2V0cyBhIGxlZnQvXG4gKiB0b3Agd3JpdGUuIExlZnQvdG9wIGFyZSBkZXJpdmVkIGJ5IGhvbGRpbmcgdGhlIE9QUE9TSVRFIGVkZ2UgZml4ZWQgKEZpZ21hXG4gKiBncmFtbWFyKSwgd2hpY2ggaXMgZXhhY3QgZm9yIGJvdGggcGxhaW4gYW5kIGFzcGVjdC1sb2NrZWQgcmVzaXplcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVFbGVtZW50UmVzaXplKFxuICBjb3JuZXI6IEVsUmVzaXplQ29ybmVyLFxuICBzdGFydDogRWxSZXNpemVTdGFydCxcbiAgZHhXOiBudW1iZXIsXG4gIGR5VzogbnVtYmVyLFxuICBtb2RzOiBFbFJlc2l6ZU1vZHMsXG4gIGZsYWdzOiBFbFJlc2l6ZUZsYWdzXG4pOiBFbFJlc2l6ZVJlc3VsdCB7XG4gIGNvbnN0IHsgbW92ZXNMZWZ0LCBtb3Zlc1JpZ2h0LCBtb3Zlc1RvcCwgbW92ZXNCb3R0b20gfSA9IGVkZ2VGbGFncyhjb3JuZXIpO1xuICBjb25zdCBjZW50ZXIgPSBtb2RzLmNlbnRlcjtcblxuICBsZXQgd2lkdGggPSBzdGFydC53O1xuICBsZXQgaGVpZ2h0ID0gc3RhcnQuaDtcbiAgaWYgKG1vdmVzUmlnaHQpIHdpZHRoID0gc3RhcnQudyArIChjZW50ZXIgPyAyICogZHhXIDogZHhXKTtcbiAgZWxzZSBpZiAobW92ZXNMZWZ0KSB3aWR0aCA9IHN0YXJ0LncgLSAoY2VudGVyID8gMiAqIGR4VyA6IGR4Vyk7XG4gIGlmIChtb3Zlc0JvdHRvbSkgaGVpZ2h0ID0gc3RhcnQuaCArIChjZW50ZXIgPyAyICogZHlXIDogZHlXKTtcbiAgZWxzZSBpZiAobW92ZXNUb3ApIGhlaWdodCA9IHN0YXJ0LmggLSAoY2VudGVyID8gMiAqIGR5VyA6IGR5Vyk7XG5cbiAgLy8gQXNwZWN0IGxvY2sgKFNoaWZ0KToga2VlcCB0aGUgc3RhcnQgcmF0aW8uIENvcm5lciDihpIgZHJpdmUgYnkgdGhlIGF4aXMgd2l0aFxuICAvLyB0aGUgbGFyZ2VyIHJlbGF0aXZlIGNoYW5nZTsgc2luZ2xlIGVkZ2Ug4oaSIHNjYWxlIHRoZSBvdGhlciBkaW1lbnNpb24uXG4gIGlmIChtb2RzLmFzcGVjdCAmJiBzdGFydC53ID4gMCAmJiBzdGFydC5oID4gMCkge1xuICAgIGNvbnN0IHJhdGlvID0gc3RhcnQudyAvIHN0YXJ0Lmg7XG4gICAgY29uc3QgaXNDb3JuZXIgPSAobW92ZXNMZWZ0IHx8IG1vdmVzUmlnaHQpICYmIChtb3Zlc1RvcCB8fCBtb3Zlc0JvdHRvbSk7XG4gICAgaWYgKGlzQ29ybmVyKSB7XG4gICAgICBjb25zdCByZWxXID0gTWF0aC5hYnMod2lkdGggLSBzdGFydC53KSAvIHN0YXJ0Lnc7XG4gICAgICBjb25zdCByZWxIID0gTWF0aC5hYnMoaGVpZ2h0IC0gc3RhcnQuaCkgLyBzdGFydC5oO1xuICAgICAgaWYgKHJlbFcgPj0gcmVsSCkgaGVpZ2h0ID0gd2lkdGggLyByYXRpbztcbiAgICAgIGVsc2Ugd2lkdGggPSBoZWlnaHQgKiByYXRpbztcbiAgICB9IGVsc2UgaWYgKG1vdmVzTGVmdCB8fCBtb3Zlc1JpZ2h0KSB7XG4gICAgICBoZWlnaHQgPSB3aWR0aCAvIHJhdGlvO1xuICAgIH0gZWxzZSBpZiAobW92ZXNUb3AgfHwgbW92ZXNCb3R0b20pIHtcbiAgICAgIHdpZHRoID0gaGVpZ2h0ICogcmF0aW87XG4gICAgfVxuICB9XG5cbiAgaWYgKHdpZHRoIDwgTUlOX1NJWkUpIHdpZHRoID0gTUlOX1NJWkU7XG4gIGlmIChoZWlnaHQgPCBNSU5fU0laRSkgaGVpZ2h0ID0gTUlOX1NJWkU7XG5cbiAgY29uc3QgcmVzdWx0OiBFbFJlc2l6ZVJlc3VsdCA9IHsgd2lkdGg6IHJvdW5kKHdpZHRoKSwgaGVpZ2h0OiByb3VuZChoZWlnaHQpIH07XG4gIC8vIERlcml2ZSBsZWZ0L3RvcCBmcm9tIHRoZSBGSU5BTCBzaXplIGJ5IGhvbGRpbmcgdGhlIG9wcG9zaXRlIGVkZ2UgZml4ZWQuXG4gIGlmIChjZW50ZXIpIHtcbiAgICBpZiAoZmxhZ3MuY2FuTW92ZUxlZnQgJiYgKG1vdmVzTGVmdCB8fCBtb3Zlc1JpZ2h0KSlcbiAgICAgIHJlc3VsdC5sZWZ0ID0gcm91bmQoc3RhcnQubGVmdCArIChzdGFydC53IC0gd2lkdGgpIC8gMik7XG4gICAgaWYgKGZsYWdzLmNhbk1vdmVUb3AgJiYgKG1vdmVzVG9wIHx8IG1vdmVzQm90dG9tKSlcbiAgICAgIHJlc3VsdC50b3AgPSByb3VuZChzdGFydC50b3AgKyAoc3RhcnQuaCAtIGhlaWdodCkgLyAyKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoZmxhZ3MuY2FuTW92ZUxlZnQgJiYgbW92ZXNMZWZ0KSByZXN1bHQubGVmdCA9IHJvdW5kKHN0YXJ0LmxlZnQgKyBzdGFydC53IC0gd2lkdGgpO1xuICAgIGlmIChmbGFncy5jYW5Nb3ZlVG9wICYmIG1vdmVzVG9wKSByZXN1bHQudG9wID0gcm91bmQoc3RhcnQudG9wICsgc3RhcnQuaCAtIGhlaWdodCk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBSb3RhdGlvbiBtYXRoIChUYXNrIEw4KSDigJQgZnJlZS1oYW5kIHJvdGF0ZSBoYW5kbGUuIEFsbCBwdXJlLCB1bml0LXRlc3RlZC5cblxuLyoqIFJvdGF0aW9uIGFuZ2xlIChkZWcpIGZyb20gYSBDU1MgYHRyYW5zZm9ybWAgbWF0cml4IChgbm9uZWAvYG1hdHJpeCguLi4pYCkuICovXG5leHBvcnQgZnVuY3Rpb24gcm90YXRpb25EZWdGcm9tTWF0cml4KHRyYW5zZm9ybTogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IG51bWJlciB7XG4gIGlmICghdHJhbnNmb3JtIHx8IHRyYW5zZm9ybSA9PT0gJ25vbmUnKSByZXR1cm4gMDtcbiAgY29uc3QgbSA9IC9tYXRyaXhcXCgoW14pXSspXFwpLy5leGVjKHRyYW5zZm9ybSk7XG4gIGlmICghbSkgcmV0dXJuIDA7XG4gIGNvbnN0IHBhcnRzID0gbVsxXS5zcGxpdCgnLCcpLm1hcChOdW1iZXIpO1xuICBjb25zdCBhID0gcGFydHNbMF0gPz8gMTtcbiAgY29uc3QgYiA9IHBhcnRzWzFdID8/IDA7XG4gIHJldHVybiBNYXRoLnJvdW5kKE1hdGguYXRhbjIoYiwgYSkgKiAoMTgwIC8gTWF0aC5QSSkgKiAxMDApIC8gMTAwO1xufVxuXG4vKiogVW5pZm9ybSBzY2FsZSBmcm9tIGEgQ1NTIGB0cmFuc2Zvcm1gIG1hdHJpeCAodGhlIGAuZGMtd29ybGRgIHpvb20pLiAxIHdoZW4gbm9uZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzY2FsZUZyb21NYXRyaXgodHJhbnNmb3JtOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogbnVtYmVyIHtcbiAgaWYgKCF0cmFuc2Zvcm0gfHwgdHJhbnNmb3JtID09PSAnbm9uZScpIHJldHVybiAxO1xuICBjb25zdCBtID0gL21hdHJpeFxcKChbXildKylcXCkvLmV4ZWModHJhbnNmb3JtKTtcbiAgaWYgKCFtKSByZXR1cm4gMTtcbiAgY29uc3QgcGFydHMgPSBtWzFdLnNwbGl0KCcsJykubWFwKE51bWJlcik7XG4gIGNvbnN0IGEgPSBwYXJ0c1swXSA/PyAxO1xuICBjb25zdCBiID0gcGFydHNbMV0gPz8gMDtcbiAgY29uc3QgcyA9IE1hdGguaHlwb3QoYSwgYik7XG4gIHJldHVybiBzID4gMCA/IHMgOiAxO1xufVxuXG4vKiogUm90YXRlIGEgbG9jYWwgb2Zmc2V0IChkeCxkeSkgYnkgYGRlZ2Ag4oCUIHNjcmVlbiB5IGlzIGRvd24sIHBvc2l0aXZlID0gQ1cuICovXG5leHBvcnQgZnVuY3Rpb24gcm90YXRlUG9pbnREZWcoZHg6IG51bWJlciwgZHk6IG51bWJlciwgZGVnOiBudW1iZXIpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgY29uc3QgciA9IChkZWcgKiBNYXRoLlBJKSAvIDE4MDtcbiAgY29uc3QgY29zID0gTWF0aC5jb3Mocik7XG4gIGNvbnN0IHNpbiA9IE1hdGguc2luKHIpO1xuICByZXR1cm4gW2R4ICogY29zIC0gZHkgKiBzaW4sIGR4ICogc2luICsgZHkgKiBjb3NdO1xufVxuXG4vKiogU2NyZWVuIGFuZ2xlIChyYWRpYW5zKSBmcm9tIHRoZSBlbGVtZW50IGNlbnRlciB0byBhIHBvaW50LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvaW50ZXJBbmdsZVJhZChjeDogbnVtYmVyLCBjeTogbnVtYmVyLCBweDogbnVtYmVyLCBweTogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIE1hdGguYXRhbjIocHkgLSBjeSwgcHggLSBjeCk7XG59XG5cbi8qKlxuICogUkVMQVRJVkUgcm90YXRlIChGaWdKYW0gY29ybmVyLXpvbmUgbW9kZWwpOiB0aGUgZWxlbWVudCdzIG5ldyBhbmdsZSBhZnRlclxuICogZHJhZ2dpbmcgZnJvbSBgc3RhcnRQb2ludGVyUmFkYCB0byBgY3VyUG9pbnRlclJhZGAsIHN0YXJ0aW5nIGZyb21cbiAqIGBzdGFydEVsZW1lbnREZWdgLiBHcmFiIGFueSBjb3JuZXIgem9uZSBhbmQgdHVybiDigJQgdGhlIGRlbHRhIGlzIHRoZSBjaGFuZ2UgaW5cbiAqIHRoZSBjZW50ZXLihpJwb2ludGVyIGFuZ2xlLCBzbyB0aGUgY29ybmVyIHRyYWNrcyB0aGUgY3Vyc29yLiBTbmFwcyB0byAxNcKwIHdoaWxlXG4gKiBTaGlmdCBpcyBoZWxkLiBOb3JtYWxpemVkIHRvICgtMTgwLCAxODBdLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcm90YXRlRGVsdGFEZWcoXG4gIHN0YXJ0RWxlbWVudERlZzogbnVtYmVyLFxuICBzdGFydFBvaW50ZXJSYWQ6IG51bWJlcixcbiAgY3VyUG9pbnRlclJhZDogbnVtYmVyLFxuICBzbmFwOiBib29sZWFuXG4pOiBudW1iZXIge1xuICBsZXQgZGVnID0gc3RhcnRFbGVtZW50RGVnICsgKGN1clBvaW50ZXJSYWQgLSBzdGFydFBvaW50ZXJSYWQpICogKDE4MCAvIE1hdGguUEkpO1xuICB3aGlsZSAoZGVnID4gMTgwKSBkZWcgLT0gMzYwO1xuICB3aGlsZSAoZGVnIDw9IC0xODApIGRlZyArPSAzNjA7XG4gIGlmIChzbmFwKSBkZWcgPSBNYXRoLnJvdW5kKGRlZyAvIDE1KSAqIDE1O1xuICByZXR1cm4gTWF0aC5yb3VuZChkZWcgKiAxMDApIC8gMTAwO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIE92ZXJsYXkgY29tcG9uZW50IOKAlCBtb3VudGVkIG9uY2UgaW4gQ2FudmFzU2hlbGwgYWxvbmdzaWRlIFNlbGVjdGlvbkhhbG9zLlxuXG50eXBlIFJvdENvcm5lciA9ICdyb3QtbncnIHwgJ3JvdC1uZScgfCAncm90LXN3JyB8ICdyb3Qtc2UnO1xuXG5pbnRlcmZhY2UgRWxSZXNpemVEcmFnIHtcbiAgcG9pbnRlcklkOiBudW1iZXI7XG4gIGNvcm5lcjogRWxSZXNpemVDb3JuZXIgfCBSb3RDb3JuZXI7XG4gIGVsOiBIVE1MRWxlbWVudDtcbiAgY2RJZDogc3RyaW5nO1xuICAvKiogR0xPQkFMIERPTS1vY2N1cnJlbmNlIGluZGV4IG9mIGBlbGAgYW1vbmcgc2FtZS1jZC1pZCBub2RlcyAoU3RhZ2UgSDMpLiBGb3IgYVxuICAgKiAgcmV1c2VkIGNvbXBvbmVudCB0aGUgc2VydmVyIG1hcHMgaXQgdG8gdGhlIGRyYWdnZWQgaW5zdGFuY2UncyBgPENvbXBvbmVudC8+YFxuICAgKiAgdXNhZ2Ugc28gcmVzaXppbmcgb25lIGluc3RhbmNlIHN0YXlzIGxvY2FsOyAwIGZvciBhIG5vcm1hbCBlbGVtZW50LiAqL1xuICBpZEluZGV4OiBudW1iZXI7XG4gIC8qKiBTdGFnZSBENCDigJQgc2V0IHdoZW4gdGhpcyBkcmFnIHRhcmdldHMgYSB3aG9sZSBBUlRCT0FSRCBmcmFtZSAoYFtkYXRhLWRjLVxuICAgKiAgc2NyZWVuXWAsIG5vIGRhdGEtY2QtaWQpIGluc3RlYWQgb2YgYSBjYW52YXMgZWxlbWVudC4gQ29tbWl0cyB2aWFcbiAgICogIGByZXNpemUtYXJ0Ym9hcmQtcmVxdWVzdGAgKG51bWVyaWMgd2lkdGgvaGVpZ2h0IFBST1BTLCBERFItMDI3KSBpbnN0ZWFkIG9mXG4gICAqICBgcmVzaXplLXJlcXVlc3RgLiBOdWxsIGZvciBhbiBvcmRpbmFyeSBlbGVtZW50IGRyYWcuICovXG4gIGFydGJvYXJkSWQ6IHN0cmluZyB8IG51bGw7XG4gIHN0YXJ0Q2xpZW50WDogbnVtYmVyO1xuICBzdGFydENsaWVudFk6IG51bWJlcjtcbiAgZWxab29tOiBudW1iZXI7IC8vIHJlY3Qud2lkdGggLyBvZmZzZXRXaWR0aCDigJQgdGhlIGVsZW1lbnQncyBvd24gcmVuZGVyIHNjYWxlXG4gIC8qKiBFbGVtZW50IHJvdGF0aW9uIChkZWcpIGF0IGRyYWcgc3RhcnQg4oCUIHJlc2l6ZSBkZWx0YXMgYXJlIHVuLXJvdGF0ZWQgYnkgaXQsXG4gICAqICBhbmQgaXQncyB0aGUgYmFzZSBhbmdsZSBhIHJvdGF0ZSBkcmFnIHR1cm5zIEZST00uICovXG4gIGFuZ2xlOiBudW1iZXI7XG4gIC8qKiBTY3JlZW4gY2VudGVyIG9mIHRoZSBlbGVtZW50IOKAlCB0aGUgcGl2b3QgZm9yIGEgcm90YXRlIGRyYWcuICovXG4gIGN4OiBudW1iZXI7XG4gIGN5OiBudW1iZXI7XG4gIC8qKiBjZW50ZXLihpJwb2ludGVyIGFuZ2xlIChyYWQpIGF0IHJvdGF0ZS1kcmFnIHN0YXJ0IChyZWxhdGl2ZSByb3RhdGlvbiBiYXNlKS4gKi9cbiAgcm90U3RhcnRQb2ludGVyOiBudW1iZXI7XG4gIHN0YXJ0OiBFbFJlc2l6ZVN0YXJ0O1xuICBmbGFnczogRWxSZXNpemVGbGFncztcbiAgLyoqIElubGluZSBzdHlsZSB2YWx1ZXMgQkVGT1JFIHRoZSBkcmFnIOKAlCB0aGUgdW5kbyBgYmVmb3JlYCArIGZhaWx1cmUgcmVzdG9yZS4gKi9cbiAgYmVmb3JlOiB7XG4gICAgd2lkdGg6IHN0cmluZyB8IG51bGw7XG4gICAgaGVpZ2h0OiBzdHJpbmcgfCBudWxsO1xuICAgIGxlZnQ6IHN0cmluZyB8IG51bGw7XG4gICAgdG9wOiBzdHJpbmcgfCBudWxsO1xuICAgIHRyYW5zZm9ybTogc3RyaW5nIHwgbnVsbDtcbiAgfTtcbiAgbGFzdFJlc3VsdDogRWxSZXNpemVSZXN1bHQgfCBudWxsO1xuICAvKiogTGFzdCBwcmV2aWV3ZWQgYHRyYW5zZm9ybWAgKHJvdGF0ZSBkcmFnKSDigJQgdGhlIGNvbW1pdCB2YWx1ZS4gKi9cbiAgbGFzdFRyYW5zZm9ybTogc3RyaW5nIHwgbnVsbDtcbn1cblxuLyoqIFBvc3QgdGhlIGNvbW1pdHRlZCByZXNpemUgdG8gdGhlIG1haW4tb3JpZ2luIHNoZWxsLiBTcGxpdCBvdXQgc28gdGhlIG1lc3NhZ2VcbiAqICBzaGFwZSBzdGF5cyBpbiBvbmUgcGxhY2UuIGBudWxsYCBiZWZvcmUgPSB0aGUgcHJvcCB3YXMgdW5zZXQgKHJlc2V0IG9uIHVuZG8pLiAqL1xuZnVuY3Rpb24gcG9zdFJlc2l6ZVJlcXVlc3QoZHJhZzogRWxSZXNpemVEcmFnLCByOiBFbFJlc2l6ZVJlc3VsdCk6IHZvaWQge1xuICBjb25zdCBwYXRjaDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICB3aWR0aDogYCR7ci53aWR0aH1weGAsXG4gICAgaGVpZ2h0OiBgJHtyLmhlaWdodH1weGAsXG4gIH07XG4gIGlmICh0eXBlb2Ygci5sZWZ0ID09PSAnbnVtYmVyJykgcGF0Y2gubGVmdCA9IGAke3IubGVmdH1weGA7XG4gIGlmICh0eXBlb2Ygci50b3AgPT09ICdudW1iZXInKSBwYXRjaC50b3AgPSBgJHtyLnRvcH1weGA7XG4gIHRyeSB7XG4gICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZShcbiAgICAgIHsgZGduOiAncmVzaXplLXJlcXVlc3QnLCBpZDogZHJhZy5jZElkLCBwYXRjaCwgYmVmb3JlOiBkcmFnLmJlZm9yZSwgaWRJbmRleDogZHJhZy5pZEluZGV4IH0sXG4gICAgICAnKidcbiAgICApO1xuICB9IGNhdGNoIHtcbiAgICAvKiBkZXRhY2hlZCAvIGNyb3NzLW9yaWdpbiB0ZWFyZG93biAqL1xuICB9XG59XG5cbi8qKiBTdGFnZSBENCDigJQgcG9zdCBhIGNvbW1pdHRlZCBBUlRCT0FSRCByZXNpemUuIGB3aWR0aGAvYGhlaWdodGAgYXJlIHBsYWluXG4gKiAgTlVNQkVSUyAod29ybGQgcHgsIG5vdCBweCBzdHJpbmdzKSDigJQgdGhlIHNoZWxsIHdyaXRlcyB0aGVtIGFzIG51bWVyaWMgSlNYXG4gKiAgYXR0cnMgdmlhIGAvX2FwaS9yZXNpemUtYXJ0Ym9hcmRgIChERFItMDI3OiBhcnRib2FyZCBzaXplIGlzIEpTWC1hdXRob3JpdGF0aXZlLFxuICogIG5vdCBpbmxpbmUgc3R5bGUpLiBOZXZlciBjYXJyaWVzIGxlZnQvdG9wIOKAlCBzZWUgdGhlIGBhcnRib2FyZElkYCBkb2MgYWJvdmUuICovXG5mdW5jdGlvbiBwb3N0UmVzaXplQXJ0Ym9hcmRSZXF1ZXN0KGRyYWc6IEVsUmVzaXplRHJhZywgcjogRWxSZXNpemVSZXN1bHQpOiB2b2lkIHtcbiAgaWYgKCFkcmFnLmFydGJvYXJkSWQpIHJldHVybjtcbiAgdHJ5IHtcbiAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICBkZ246ICdyZXNpemUtYXJ0Ym9hcmQtcmVxdWVzdCcsXG4gICAgICAgIGFydGJvYXJkSWQ6IGRyYWcuYXJ0Ym9hcmRJZCxcbiAgICAgICAgd2lkdGg6IHIud2lkdGgsXG4gICAgICAgIGhlaWdodDogci5oZWlnaHQsXG4gICAgICB9LFxuICAgICAgJyonXG4gICAgKTtcbiAgfSBjYXRjaCB7XG4gICAgLyogZGV0YWNoZWQgLyBjcm9zcy1vcmlnaW4gdGVhcmRvd24gKi9cbiAgfVxufVxuXG4vKiogUG9zdCBhIGNvbW1pdHRlZCByb3RhdGUgKFRhc2sgTDgpIOKAlCBhIGB0cmFuc2Zvcm1gIHBhdGNoIG9uIHRoZSBzYW1lIGxhbmUuICovXG5mdW5jdGlvbiBwb3N0Um90YXRlUmVxdWVzdChkcmFnOiBFbFJlc2l6ZURyYWcsIHRyYW5zZm9ybTogc3RyaW5nKTogdm9pZCB7XG4gIHRyeSB7XG4gICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgZGduOiAncmVzaXplLXJlcXVlc3QnLFxuICAgICAgICBpZDogZHJhZy5jZElkLFxuICAgICAgICBwYXRjaDogeyB0cmFuc2Zvcm0gfSxcbiAgICAgICAgYmVmb3JlOiBkcmFnLmJlZm9yZSxcbiAgICAgICAgaWRJbmRleDogZHJhZy5pZEluZGV4LFxuICAgICAgfSxcbiAgICAgICcqJ1xuICAgICk7XG4gIH0gY2F0Y2gge1xuICAgIC8qIGRldGFjaGVkIC8gY3Jvc3Mtb3JpZ2luIHRlYXJkb3duICovXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIEVsZW1lbnRSZXNpemVPdmVybGF5KCk6IFJlYWN0Tm9kZSB7XG4gIGVuc3VyZUVsZW1lbnRSZXNpemVTdHlsZXMoKTtcbiAgY29uc3QgeyBzZWxlY3RlZCB9ID0gdXNlU2VsZWN0aW9uU2V0KCk7XG4gIGNvbnN0IHsgdG9vbCB9ID0gdXNlVG9vbE1vZGUoKTtcbiAgY29uc3QgY29udGFpbmVyUmVmID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHJhZlJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgZHJhZ1JlZiA9IHVzZVJlZjxFbFJlc2l6ZURyYWcgfCBudWxsPihudWxsKTtcbiAgLy8gTGFzdCBjb21taXR0ZWQgeyBlbCwgYmVmb3JlIH0g4oCUIHJlc3RvcmVkIGlmIHRoZSBzaGVsbCByZXBvcnRzIHRoZSB3cml0ZVxuICAvLyBmYWlsZWQgKGRnbjoncmVzaXplLWZhaWxlZCcpLCBzbyBhIHJlamVjdGVkIHJlc2l6ZSBkb2Vzbid0IGxlYXZlIGEgcGhhbnRvbVxuICAvLyBpbmxpbmUgYm94IHRoYXQgdGhlIChzdXBwcmVzc2VkIC8gYWJzZW50KSBITVIgcmVsb2FkIG5ldmVyIGNvcnJlY3RzLlxuICBjb25zdCBsYXN0Q29tbWl0UmVmID0gdXNlUmVmPHsgZWw6IEhUTUxFbGVtZW50OyBiZWZvcmU6IEVsUmVzaXplRHJhZ1snYmVmb3JlJ10gfSB8IG51bGw+KG51bGwpO1xuXG4gIGNvbnN0IG9uZSA9IHNlbGVjdGVkLmxlbmd0aCA9PT0gMSA/IHNlbGVjdGVkWzBdIDogbnVsbDtcbiAgY29uc3QgY2RJZCA9IG9uZSAmJiB0eXBlb2Ygb25lLmlkID09PSAnc3RyaW5nJyA/IG9uZS5pZCA6IG51bGw7XG4gIC8vIFN0YWdlIEQ0IOKAlCBhIHdob2xlLUFSVEJPQVJEIHNlbGVjdGlvbiAoY2hyb21lIGNsaWNrOiBubyBkYXRhLWNkLWlkLCBqdXN0IHRoZVxuICAvLyBgZGF0YS1kYy1zY3JlZW5gIGhvc3QpIGFsc28gZ2V0cyBoYW5kbGVzLCByZXN0cmljdGVkIHRvIEUvUy9TRSAoZ3Jvd3RoLW9ubHkg4oCUXG4gIC8vIHNlZSB0aGUgYGFydGJvYXJkSWRgIGRvYyBvbiBFbFJlc2l6ZURyYWcgZm9yIHdoeSBsZWZ0L3RvcCBuZXZlciBtb3ZlKS5cbiAgY29uc3QgYXJ0Ym9hcmRPbmx5ID0gb25lICYmICFjZElkICYmIHR5cGVvZiBvbmUuYXJ0Ym9hcmRJZCA9PT0gJ3N0cmluZycgPyBvbmUuYXJ0Ym9hcmRJZCA6IG51bGw7XG4gIC8vIEEgcmVhbCBlbGVtZW50IE9SIGFydGJvYXJkIHNlbGVjdGlvbiB3aXRoIHRoZSBtb3ZlIHRvb2wgYWN0aXZlIGdldHMgaGFuZGxlcy5cbiAgY29uc3QgYWN0aXZlID0gdG9vbCA9PT0gJ21vdmUnICYmICghIWNkSWQgfHwgISFhcnRib2FyZE9ubHkpO1xuXG4gIC8vIHJBRiBsb29wIOKAlCBmb2xsb3cgdGhlIHNlbGVjdGVkIGVsZW1lbnQncyBzY3JlZW4gYm94IChwYW4vem9vbSArIGxheW91dCkuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgYyA9IGNvbnRhaW5lclJlZi5jdXJyZW50O1xuICAgIGlmICghYykgcmV0dXJuO1xuICAgIC8vIElOVi0yIOKAlCBvcGFjaXR5K3BvaW50ZXItZXZlbnRzLCBub3QgZGlzcGxheTpub25lLCBzbyBhIGZyZXNoIHNlbGVjdGlvbidzXG4gICAgLy8gaGFuZGxlcy9yZWFkb3V0IEZBREUgaW4gcmF0aGVyIHRoYW4gcG9wICh0aGUgYHRyYW5zaXRpb25gIG9uIGJvdGhcbiAgICAvLyBjbGFzc2VzIGFib3ZlKS4gSW50ZXJhY3Rpdml0eSAocG9pbnRlci1ldmVudHMpIGZsaXBzIGluc3RhbnRseSDigJQgYVxuICAgIC8vIGhhbmRsZSBpcyBncmFiYmFibGUgdGhlIG1vbWVudCBpdCdzIHNlbGVjdGVkLCBldmVuIG1pZC1mYWRlLlxuICAgIGNvbnN0IGhpZGVBbGwgPSAoKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIEFycmF5LmZyb20oYy5jaGlsZHJlbikpIHtcbiAgICAgICAgY29uc3QgaCA9IGNoaWxkIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICBoLnN0eWxlLm9wYWNpdHkgPSAnMCc7XG4gICAgICAgIGguc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmICghYWN0aXZlIHx8ICFvbmUpIHtcbiAgICAgIGhpZGVBbGwoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGljayA9ICgpID0+IHtcbiAgICAgIHJhZlJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgIC8vIERvZ2Zvb2QgMjAyNi0wNy0wNyDigJQgYSBsaXZlIFJlb3JkZXJEcmFnIGlzIHRoZSBjYW52YXMncyBtb3N0IERPTS1jaHVybi1cbiAgICAgIC8vIGhlYXZ5IGdlc3R1cmUgKG5ldmVyIHRydWUgZm9yIE9VUiBvd24gcmVzaXplIGRyYWcg4oCUIGEgaGFuZGxlIGdyYWJcbiAgICAgIC8vIHN0b3BQcm9wYWdhdGlvbigpcyBiZWZvcmUgUmVvcmRlckRyYWcncyBvd24gcG9pbnRlcmRvd24gbGlzdGVuZXIgc2Vlc1xuICAgICAgLy8gaXQpOyBza2lwIHRoaXMgb3ZlcmxheSdzIHBlci1mcmFtZSB3b3JrIHdoaWxlIG9uZSBpcyBpbiBmbGlnaHQgc28gaXRcbiAgICAgIC8vIGRvZXNuJ3QgY29tcG91bmQgdGhlIGphbmsgKFwiaHJvem7EmyB6YXZhxaHDrSB0ZW4gdG9vbGJhclwiKS5cbiAgICAgIGlmIChpc0VsZW1lbnREcmFnQWN0aXZlKCkpIHtcbiAgICAgICAgaGlkZUFsbCgpO1xuICAgICAgICByYWZSZWYuY3VycmVudCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgZWwgPSByZXNvbHZlU2VsZWN0aW9uRWwoZG9jdW1lbnQsIG9uZSkgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgLy8gU2tpcCBpbmxpbmUgdGV4dCBydW5zIHdoZXJlIHdpZHRoL2hlaWdodCBhcmUgbWVhbmluZ2xlc3MgKG5vIGV4cGxpY2l0IGJveCkuXG4gICAgICBpZiAoIWVsKSB7XG4gICAgICAgIGhpZGVBbGwoKTtcbiAgICAgICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHIgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmIChyLndpZHRoIDw9IDAgJiYgci5oZWlnaHQgPD0gMCkge1xuICAgICAgICBoaWRlQWxsKCk7XG4gICAgICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBTdGFnZSBENCDigJQgYW4gYXJ0Ym9hcmQgZ2V0cyBncm93dGgtb25seSBoYW5kbGVzIChFL1MvU0UpIGFuZCBOTyByb3RhdGVcbiAgICAgIC8vIHpvbmVzIChhcnRib2FyZHMgZG9uJ3Qgcm90YXRlKTsgYW4gZWxlbWVudCBnZXRzIHRoZSBmdWxsIDggKyA0IHJvdGF0ZSBzZXQuXG4gICAgICBjb25zdCByZXNpemVDb3JuZXJzOiBFbFJlc2l6ZUNvcm5lcltdID0gYXJ0Ym9hcmRPbmx5ID8gWydlJywgJ3MnLCAnc2UnXSA6IEVMX1JFU0laRV9DT1JORVJTO1xuICAgICAgY29uc3Qgcm90YXRlWm9uZXM6IFJvdENvcm5lcltdID0gYXJ0Ym9hcmRPbmx5ID8gW10gOiBbJ3JvdC1udycsICdyb3QtbmUnLCAncm90LXN3JywgJ3JvdC1zZSddO1xuICAgICAgLy8gKzEgcGVyc2lzdGVudCBzbG90IChMQVNUIGNoaWxkKSBmb3IgdGhlIFRhc2sgTDcgcmVhZG91dCBwaWxsIOKAlCBhbHdheXNcbiAgICAgIC8vIHByZXNlbnQsIGhpZGRlbiB2aWEgb3BhY2l0eSBvdXRzaWRlIGFuIGFjdGl2ZSBkcmFnLlxuICAgICAgY29uc3QgVE9UQUwgPSByZXNpemVDb3JuZXJzLmxlbmd0aCArIHJvdGF0ZVpvbmVzLmxlbmd0aCArIDE7XG4gICAgICB3aGlsZSAoYy5jaGlsZHJlbi5sZW5ndGggPCBUT1RBTCkgYy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSk7XG4gICAgICB3aGlsZSAoYy5jaGlsZHJlbi5sZW5ndGggPiBUT1RBTCkgYy5sYXN0Q2hpbGQgJiYgYy5yZW1vdmVDaGlsZChjLmxhc3RDaGlsZCk7XG5cbiAgICAgIC8vIFJvdGF0aW9uLWF3YXJlIHBsYWNlbWVudCAoVGFzayBMOCk6IHRoZSBlbGVtZW50J3MgQUFCQiBjZW50ZXIgaXMgaXRzIHRydWVcbiAgICAgIC8vIGNlbnRlciAoZGVmYXVsdCB0cmFuc2Zvcm0tb3JpZ2luKSwgc28gaGFuZGxlcyByaWRlIHRoZSBST1RBVEVEIGJveC4gUmVhZFxuICAgICAgLy8gdGhlIGVsZW1lbnQncyBvd24gcm90YXRpb24gKyB0aGUgLmRjLXdvcmxkIHpvb20gZnJvbSBjb21wdXRlZCBzdHlsZSAoRE9NXG4gICAgICAvLyByZWFkcyDigJQgdGhlIG92ZXJsYXkgc3RheXMgY2FtZXJhLWFnbm9zdGljLCBubyB2aWV3cG9ydCBjb250cm9sbGVyKS5cbiAgICAgIGNvbnN0IGN4ID0gci5sZWZ0ICsgci53aWR0aCAvIDI7XG4gICAgICBjb25zdCBjeSA9IHIudG9wICsgci5oZWlnaHQgLyAyO1xuICAgICAgY29uc3QgZGVnID0gcm90YXRpb25EZWdGcm9tTWF0cml4KGdldENvbXB1dGVkU3R5bGUoZWwpLnRyYW5zZm9ybSk7XG4gICAgICBjb25zdCB3b3JsZCA9IGVsLmNsb3Nlc3QoJy5kYy13b3JsZCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgIGNvbnN0IHpvb20gPSB3b3JsZCA/IHNjYWxlRnJvbU1hdHJpeChnZXRDb21wdXRlZFN0eWxlKHdvcmxkKS50cmFuc2Zvcm0pIDogMTtcbiAgICAgIGNvbnN0IGh3ID0gKGVsLm9mZnNldFdpZHRoICogem9vbSkgLyAyO1xuICAgICAgY29uc3QgaGggPSAoZWwub2Zmc2V0SGVpZ2h0ICogem9vbSkgLyAyO1xuICAgICAgLy8gUm90YXRlIHpvbmVzIHNpdCBPTiBlYWNoIGNvcm5lciAoc2FtZSBvZmZzZXQpLCAyMMOXMjAsIHotaW5kZXggYmVsb3cgdGhlXG4gICAgICAvLyA4w5c4IGNvcm5lciBzcXVhcmUg4oCUIHNvIHRoZSBzcXVhcmUgd2lucyB0aGUgY2VudGVyICsgdGhlIHJpbmcgcm90YXRlcy5cbiAgICAgIGNvbnN0IGxvY2FsT2Zmc2V0OiBSZWNvcmQ8c3RyaW5nLCBbbnVtYmVyLCBudW1iZXJdPiA9IHtcbiAgICAgICAgbnc6IFstaHcsIC1oaF0sXG4gICAgICAgIG46IFswLCAtaGhdLFxuICAgICAgICBuZTogW2h3LCAtaGhdLFxuICAgICAgICBlOiBbaHcsIDBdLFxuICAgICAgICBzZTogW2h3LCBoaF0sXG4gICAgICAgIHM6IFswLCBoaF0sXG4gICAgICAgIHN3OiBbLWh3LCBoaF0sXG4gICAgICAgIHc6IFstaHcsIDBdLFxuICAgICAgICAncm90LW53JzogWy1odywgLWhoXSxcbiAgICAgICAgJ3JvdC1uZSc6IFtodywgLWhoXSxcbiAgICAgICAgJ3JvdC1zdyc6IFstaHcsIGhoXSxcbiAgICAgICAgJ3JvdC1zZSc6IFtodywgaGhdLFxuICAgICAgfTtcbiAgICAgIC8vIFJvdGF0ZSB6b25lcyBGSVJTVCAobG93ZXIgaW4gdGhlIERPTSAvIHotaW5kZXggNSksIGNvcm5lcnMgTEFTVCBzbyB0aGVcbiAgICAgIC8vIDjDlzggc3F1YXJlcyBwYWludCBvbiB0b3AgaW4gdGhlIG92ZXJsYXAuXG4gICAgICBjb25zdCBoYW5kbGVzID0gWy4uLnJvdGF0ZVpvbmVzLCAuLi5yZXNpemVDb3JuZXJzXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaGFuZGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb3JuZXIgPSBoYW5kbGVzW2ldO1xuICAgICAgICBjb25zdCBoYW5kbGUgPSBjLmNoaWxkcmVuW2ldIGFzIEhUTUxFbGVtZW50O1xuICAgICAgICBjb25zdCBbb3gsIG95XSA9IGxvY2FsT2Zmc2V0W2Nvcm5lcl0gPz8gWzAsIDBdO1xuICAgICAgICBjb25zdCBbcngsIHJ5XSA9IHJvdGF0ZVBvaW50RGVnKG94LCBveSwgZGVnKTtcbiAgICAgICAgY29uc3QgYXggPSBjeCArIHJ4O1xuICAgICAgICBjb25zdCBheSA9IGN5ICsgcnk7XG4gICAgICAgIGNvbnN0IGlzUm90ID0gY29ybmVyLnN0YXJ0c1dpdGgoJ3JvdC0nKTtcbiAgICAgICAgY29uc3QgbnMgPSBjb3JuZXIgPT09ICduJyB8fCBjb3JuZXIgPT09ICdzJztcbiAgICAgICAgY29uc3QgZXcgPSBjb3JuZXIgPT09ICdlJyB8fCBjb3JuZXIgPT09ICd3JztcbiAgICAgICAgY29uc3QgaGFsZlcgPSBpc1JvdCA/IDEwIDogbnMgPyA3IDogZXcgPyAzIDogNDtcbiAgICAgICAgY29uc3QgaGFsZkggPSBpc1JvdCA/IDEwIDogbnMgPyAzIDogZXcgPyA3IDogNDtcbiAgICAgICAgaGFuZGxlLmNsYXNzTmFtZSA9ICdkYy1lbC1yZXNpemUtaGFuZGxlJztcbiAgICAgICAgaGFuZGxlLmRhdGFzZXQuY29ybmVyID0gY29ybmVyO1xuICAgICAgICBoYW5kbGUuc3R5bGUub3BhY2l0eSA9ICcxJztcbiAgICAgICAgaGFuZGxlLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnYXV0byc7XG4gICAgICAgIGhhbmRsZS5zdHlsZS5sZWZ0ID0gYCR7TWF0aC5yb3VuZChheCAtIGhhbGZXKX1weGA7XG4gICAgICAgIGhhbmRsZS5zdHlsZS50b3AgPSBgJHtNYXRoLnJvdW5kKGF5IC0gaGFsZkgpfXB4YDtcbiAgICAgICAgLy8gT3JpZW50IHRoZSBlZGdlIHBpbGxzIHdpdGggdGhlIGVsZW1lbnQ7IHJvdGF0ZSB6b25lcyBzdGF5IHVucm90YXRlZC5cbiAgICAgICAgaGFuZGxlLnN0eWxlLnRyYW5zZm9ybSA9IGlzUm90ID8gJycgOiBgcm90YXRlKCR7ZGVnfWRlZylgO1xuICAgICAgfVxuXG4gICAgICAvLyBUYXNrIEw3IOKAlCBsaXZlIFfDl0ggKCtYLFkgd2hlbiBhbiBlZGdlIGRyYWcgbW92ZXMgdGhlIG9yaWdpbikgcmVhZG91dCxcbiAgICAgIC8vIHNob3duIG9ubHkgd2hpbGUgVEhJUyBlbGVtZW50J3MgcmVzaXplIGhhbmRsZSBpcyBhY3R1YWxseSBiZWluZ1xuICAgICAgLy8gZHJhZ2dlZCAoZHJhZ1JlZiBpcyBzZXQgYnkgdGhlIHBvaW50ZXJkb3duIGhhbmRsZXIgYmVsb3cpLiBXb3JsZFxuICAgICAgLy8gdW5pdHMg4oCUIG9mZnNldFdpZHRoL0hlaWdodCArIHRoZSBkcmFnJ3Mgb3duIGxlZnQvdG9wLCB1bmFmZmVjdGVkIGJ5XG4gICAgICAvLyB0aGUgLmRjLXdvcmxkIHpvb20gdHJhbnNmb3JtIChzYW1lIGludmFyaWFudCBTdGFnZSBBJ3MgY2FtZXJhIGZpeFxuICAgICAgLy8gcmVsaWVzIG9uKSwgc28gdGhlIG51bWJlciByZWFkcyBjb3JyZWN0bHkgYXQgYW55IHpvb20uXG4gICAgICBjb25zdCByZWFkb3V0ID0gYy5jaGlsZHJlbltoYW5kbGVzLmxlbmd0aF0gYXMgSFRNTEVsZW1lbnQ7XG4gICAgICBjb25zdCBkcmFnID0gZHJhZ1JlZi5jdXJyZW50O1xuICAgICAgaWYgKGRyYWcgJiYgZHJhZy5lbCA9PT0gZWwgJiYgIWRyYWcuY29ybmVyLnN0YXJ0c1dpdGgoJ3JvdC0nKSkge1xuICAgICAgICBjb25zdCB3ID0gZHJhZy5sYXN0UmVzdWx0Py53aWR0aCA/PyBlbC5vZmZzZXRXaWR0aDtcbiAgICAgICAgY29uc3QgaCA9IGRyYWcubGFzdFJlc3VsdD8uaGVpZ2h0ID8/IGVsLm9mZnNldEhlaWdodDtcbiAgICAgICAgbGV0IGxhYmVsID0gYCR7TWF0aC5yb3VuZCh3KX0gw5cgJHtNYXRoLnJvdW5kKGgpfWA7XG4gICAgICAgIGNvbnN0IGx4ID0gZHJhZy5sYXN0UmVzdWx0Py5sZWZ0O1xuICAgICAgICBjb25zdCBseSA9IGRyYWcubGFzdFJlc3VsdD8udG9wO1xuICAgICAgICBpZiAodHlwZW9mIGx4ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgbHkgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgbGFiZWwgKz0gYCAgwrcgICR7TWF0aC5yb3VuZChseCA/PyBkcmFnLnN0YXJ0LmxlZnQpfSwgJHtNYXRoLnJvdW5kKGx5ID8/IGRyYWcuc3RhcnQudG9wKX1gO1xuICAgICAgICB9XG4gICAgICAgIHJlYWRvdXQuY2xhc3NOYW1lID0gJ2RjLWVsLXJlc2l6ZS1yZWFkb3V0JztcbiAgICAgICAgcmVhZG91dC50ZXh0Q29udGVudCA9IGxhYmVsO1xuICAgICAgICByZWFkb3V0LnN0eWxlLm9wYWNpdHkgPSAnMSc7XG4gICAgICAgIHJlYWRvdXQuc3R5bGUubGVmdCA9IGAke01hdGgucm91bmQoY3gpfXB4YDtcbiAgICAgICAgcmVhZG91dC5zdHlsZS50b3AgPSBgJHtNYXRoLnJvdW5kKGN5ICsgaGgpfXB4YDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlYWRvdXQuc3R5bGUub3BhY2l0eSA9ICcwJztcbiAgICAgIH1cblxuICAgICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgfTtcbiAgICByYWZSZWYuY3VycmVudCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKHJhZlJlZi5jdXJyZW50ICE9IG51bGwpIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHJhZlJlZi5jdXJyZW50KTtcbiAgICB9O1xuICB9LCBbYWN0aXZlLCBvbmUsIGFydGJvYXJkT25seV0pO1xuXG4gIC8vIExpdmUtYXBwbHkgYSByZXNpemUgcmVzdWx0IHRvIHRoZSBlbGVtZW50J3MgaW5saW5lIHN0eWxlIChpbnN0YW50IHByZXZpZXcsXG4gIC8vIG5vIHNvdXJjZSB3cml0ZSkuIENvbW1pdCBvbiByZWxlYXNlLlxuICBjb25zdCBhcHBseVByZXZpZXcgPSB1c2VDYWxsYmFjaygoZDogRWxSZXNpemVEcmFnLCByOiBFbFJlc2l6ZVJlc3VsdCkgPT4ge1xuICAgIGQuZWwuc3R5bGUud2lkdGggPSBgJHtyLndpZHRofXB4YDtcbiAgICBkLmVsLnN0eWxlLmhlaWdodCA9IGAke3IuaGVpZ2h0fXB4YDtcbiAgICBpZiAodHlwZW9mIHIubGVmdCA9PT0gJ251bWJlcicpIGQuZWwuc3R5bGUubGVmdCA9IGAke3IubGVmdH1weGA7XG4gICAgaWYgKHR5cGVvZiByLnRvcCA9PT0gJ251bWJlcicpIGQuZWwuc3R5bGUudG9wID0gYCR7ci50b3B9cHhgO1xuICAgIGQubGFzdFJlc3VsdCA9IHI7XG4gIH0sIFtdKTtcblxuICAvLyBQb2ludGVyIGhhbmRsaW5nIOKAlCBwb2ludGVyZG93biBvbiBhIGhhbmRsZSBzdGFydHMgdGhlIGRyYWcuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgYyA9IGNvbnRhaW5lclJlZi5jdXJyZW50O1xuICAgIGlmICghYykgcmV0dXJuO1xuXG4gICAgY29uc3QgY29tcHV0ZUZyb21FdmVudCA9IChkOiBFbFJlc2l6ZURyYWcsIGV2OiBQb2ludGVyRXZlbnQpOiBFbFJlc2l6ZVJlc3VsdCA9PiB7XG4gICAgICAvLyBVbi1yb3RhdGUgdGhlIHNjcmVlbiBkZWx0YSBpbnRvIHRoZSBlbGVtZW50J3MgTE9DQUwgZnJhbWUgKHNvIGRyYWdnaW5nIGFcbiAgICAgIC8vIGhhbmRsZSByZXNpemVzIGFsb25nIHRoZSBlbGVtZW50J3Mgb3duIGF4ZXMgb24gYSByb3RhdGVkIGVsZW1lbnQpLCB0aGVuXG4gICAgICAvLyDDtyByZW5kZXIgem9vbSDihpIgd29ybGQgdW5pdHMuXG4gICAgICBjb25zdCBbbGR4LCBsZHldID0gcm90YXRlUG9pbnREZWcoXG4gICAgICAgIGV2LmNsaWVudFggLSBkLnN0YXJ0Q2xpZW50WCxcbiAgICAgICAgZXYuY2xpZW50WSAtIGQuc3RhcnRDbGllbnRZLFxuICAgICAgICAtZC5hbmdsZVxuICAgICAgKTtcbiAgICAgIHJldHVybiBjb21wdXRlRWxlbWVudFJlc2l6ZShcbiAgICAgICAgZC5jb3JuZXIgYXMgRWxSZXNpemVDb3JuZXIsXG4gICAgICAgIGQuc3RhcnQsXG4gICAgICAgIGxkeCAvIGQuZWxab29tLFxuICAgICAgICBsZHkgLyBkLmVsWm9vbSxcbiAgICAgICAgLy8gU3RhZ2UgRDQg4oCUIEFsdC9jZW50ZXIgaXMgaWdub3JlZCBmb3IgYW4gYXJ0Ym9hcmQ6IHdpdGhvdXQgYSBsZWZ0L3RvcFxuICAgICAgICAvLyB3cml0ZSwgXCJjZW50ZXJcIiB3b3VsZCBqdXN0IGRvdWJsZSB0aGUgZ3Jvd3RoIHNwZWVkIHdpdGggbm8gdmlzdWFsXG4gICAgICAgIC8vIHJlY2VudGVyaW5nIChjb25mdXNpbmcpLiBBc3BlY3QtbG9jayAoU2hpZnQpIHN0aWxsIGFwcGxpZXMgdG8gYm90aC5cbiAgICAgICAgeyBhc3BlY3Q6ICEhZXYuc2hpZnRLZXksIGNlbnRlcjogIWQuYXJ0Ym9hcmRJZCAmJiAhIWV2LmFsdEtleSB9LFxuICAgICAgICBkLmZsYWdzXG4gICAgICApO1xuICAgIH07XG5cbiAgICBjb25zdCBvbkRvd24gPSAoZTogUG9pbnRlckV2ZW50KSA9PiB7XG4gICAgICBjb25zdCB0ID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgaWYgKCF0Py5jbGFzc0xpc3QuY29udGFpbnMoJ2RjLWVsLXJlc2l6ZS1oYW5kbGUnKSkgcmV0dXJuO1xuICAgICAgY29uc3QgY29ybmVyID0gdC5kYXRhc2V0LmNvcm5lciBhcyBFbFJlc2l6ZUNvcm5lciB8IFJvdENvcm5lciB8IHVuZGVmaW5lZDtcbiAgICAgIGlmICghY29ybmVyIHx8ICFvbmUpIHJldHVybjtcbiAgICAgIGNvbnN0IGVsQ2RJZCA9IHR5cGVvZiBvbmUuaWQgPT09ICdzdHJpbmcnID8gb25lLmlkIDogbnVsbDtcbiAgICAgIGNvbnN0IGVsQXJ0Ym9hcmRJZCA9ICFlbENkSWQgJiYgdHlwZW9mIG9uZS5hcnRib2FyZElkID09PSAnc3RyaW5nJyA/IG9uZS5hcnRib2FyZElkIDogbnVsbDtcbiAgICAgIGlmICghZWxDZElkICYmICFlbEFydGJvYXJkSWQpIHJldHVybjtcbiAgICAgIGNvbnN0IGVsID0gcmVzb2x2ZVNlbGVjdGlvbkVsKGRvY3VtZW50LCBvbmUpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgIGlmICghZWwpIHJldHVybjtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBjb25zdCByZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBjb25zdCBlbFpvb20gPSBlbC5vZmZzZXRXaWR0aCA/IHJlY3Qud2lkdGggLyBlbC5vZmZzZXRXaWR0aCA6IDE7XG4gICAgICBjb25zdCBjcyA9IGdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgICAgLy8gU3RhZ2UgRDQg4oCUIGFuIGFydGJvYXJkIE5FVkVSIGRlcml2ZXMgbGVmdC90b3AgZnJvbSBhIHJlc2l6ZSBkcmFnICh0aGVcbiAgICAgIC8vIHJvdXRlIG9ubHkgd3JpdGVzIHdpZHRoL2hlaWdodCBQUk9QUzsgbGF5b3V0LmFydGJvYXJkc1tdIHgveSBzdGF5c1xuICAgICAgLy8gdW50b3VjaGVkIOKAlCBzZWUgdGhlIHBsYW4ncyBUYXNrIEQ0IGdvdGNoYSkuIEZvcmNpbmcgb3V0T2ZGbG93PWZhbHNlIGhlcmVcbiAgICAgIC8vIChldmVuIHRob3VnaCBhbiBhcnRib2FyZCBJUyBwb3NpdGlvbjphYnNvbHV0ZSBpbiB0aGUgRE9NKSBpcyB3aGF0IG1ha2VzXG4gICAgICAvLyBgZmxhZ3MuY2FuTW92ZUxlZnQvVG9wYCBmYWxzZSBiZWxvdzsgdGhlIGdyb3d0aC1vbmx5IEUvUy9TRSBoYW5kbGUgc2V0XG4gICAgICAvLyByZW5kZXJlZCBhYm92ZSBpcyB0aGUgdmlzdWFsIGhhbGYgb2YgdGhlIHNhbWUgZ3VhcmFudGVlLlxuICAgICAgY29uc3Qgb3V0T2ZGbG93ID0gIWVsQXJ0Ym9hcmRJZCAmJiAoY3MucG9zaXRpb24gPT09ICdhYnNvbHV0ZScgfHwgY3MucG9zaXRpb24gPT09ICdmaXhlZCcpO1xuICAgICAgY29uc3Qgc3RhcnRMZWZ0ID0gZWxBcnRib2FyZElkID8gTnVtYmVyLk5hTiA6IE51bWJlci5wYXJzZUZsb2F0KGVsLnN0eWxlLmxlZnQpO1xuICAgICAgY29uc3Qgc3RhcnRUb3AgPSBlbEFydGJvYXJkSWQgPyBOdW1iZXIuTmFOIDogTnVtYmVyLnBhcnNlRmxvYXQoZWwuc3R5bGUudG9wKTtcbiAgICAgIGNvbnN0IGFuZ2xlID0gZWxBcnRib2FyZElkID8gMCA6IHJvdGF0aW9uRGVnRnJvbU1hdHJpeChjcy50cmFuc2Zvcm0pO1xuICAgICAgY29uc3QgeiA9IGVsWm9vbSA+IDAgPyBlbFpvb20gOiAxO1xuICAgICAgY29uc3QgY3ggPSByZWN0LmxlZnQgKyByZWN0LndpZHRoIC8gMjtcbiAgICAgIGNvbnN0IGN5ID0gcmVjdC50b3AgKyByZWN0LmhlaWdodCAvIDI7XG4gICAgICBjb25zdCBkcmFnOiBFbFJlc2l6ZURyYWcgPSB7XG4gICAgICAgIHBvaW50ZXJJZDogZS5wb2ludGVySWQsXG4gICAgICAgIGNvcm5lcixcbiAgICAgICAgZWwsXG4gICAgICAgIGNkSWQ6IGVsQ2RJZCA/PyAnJyxcbiAgICAgICAgYXJ0Ym9hcmRJZDogZWxBcnRib2FyZElkLFxuICAgICAgICAvLyBTdGFnZSBIMyDigJQgd2hpY2ggaW5zdGFuY2UgKGdsb2JhbCBzYW1lLWNkLWlkIERPTSBvY2N1cnJlbmNlKSBzbyBhXG4gICAgICAgIC8vIHJldXNlZC1jb21wb25lbnQgcmVzaXplIHJvdXRlcyB0byBpdHMgb3duIGA8Q29tcG9uZW50Lz5gIHVzYWdlIChsb2NhbCkuXG4gICAgICAgIC8vIE4vQSAoMCkgZm9yIGFuIGFydGJvYXJkIGRyYWcuXG4gICAgICAgIGlkSW5kZXg6IGVsQ2RJZCA/IGdsb2JhbENkT2NjdXJyZW5jZShkb2N1bWVudCwgZWxDZElkLCBlbCkgOiAwLFxuICAgICAgICBzdGFydENsaWVudFg6IGUuY2xpZW50WCxcbiAgICAgICAgc3RhcnRDbGllbnRZOiBlLmNsaWVudFksXG4gICAgICAgIGVsWm9vbTogeixcbiAgICAgICAgYW5nbGUsXG4gICAgICAgIGN4LFxuICAgICAgICBjeSxcbiAgICAgICAgcm90U3RhcnRQb2ludGVyOiBwb2ludGVyQW5nbGVSYWQoY3gsIGN5LCBlLmNsaWVudFgsIGUuY2xpZW50WSksXG4gICAgICAgIHN0YXJ0OiB7XG4gICAgICAgICAgLy8gV29ybGQtcHggYm9yZGVyIGJveC4gcmVjdCBpcyB0aGUgQUFCQjsgZm9yIGEgcm90YXRlZCBlbGVtZW50IHRoYXRcbiAgICAgICAgICAvLyBvdmVyLXN0YXRlcyB3L2gsIHNvIGRlcml2ZSBmcm9tIG9mZnNldCBkaW1zIHdoZW4gcm90YXRlZC5cbiAgICAgICAgICB3OiAoYW5nbGUgPyBlbC5vZmZzZXRXaWR0aCA6IHJlY3Qud2lkdGggLyB6KSB8fCByZWN0LndpZHRoIC8geixcbiAgICAgICAgICBoOiAoYW5nbGUgPyBlbC5vZmZzZXRIZWlnaHQgOiByZWN0LmhlaWdodCAvIHopIHx8IHJlY3QuaGVpZ2h0IC8geixcbiAgICAgICAgICBsZWZ0OiBzdGFydExlZnQsXG4gICAgICAgICAgdG9wOiBzdGFydFRvcCxcbiAgICAgICAgfSxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBjYW5Nb3ZlTGVmdDogb3V0T2ZGbG93ICYmIE51bWJlci5pc0Zpbml0ZShzdGFydExlZnQpLFxuICAgICAgICAgIGNhbk1vdmVUb3A6IG91dE9mRmxvdyAmJiBOdW1iZXIuaXNGaW5pdGUoc3RhcnRUb3ApLFxuICAgICAgICB9LFxuICAgICAgICBiZWZvcmU6IHtcbiAgICAgICAgICB3aWR0aDogZWwuc3R5bGUud2lkdGggfHwgbnVsbCxcbiAgICAgICAgICBoZWlnaHQ6IGVsLnN0eWxlLmhlaWdodCB8fCBudWxsLFxuICAgICAgICAgIGxlZnQ6IGVsLnN0eWxlLmxlZnQgfHwgbnVsbCxcbiAgICAgICAgICB0b3A6IGVsLnN0eWxlLnRvcCB8fCBudWxsLFxuICAgICAgICAgIHRyYW5zZm9ybTogZWwuc3R5bGUudHJhbnNmb3JtIHx8IG51bGwsXG4gICAgICAgIH0sXG4gICAgICAgIGxhc3RSZXN1bHQ6IG51bGwsXG4gICAgICAgIGxhc3RUcmFuc2Zvcm06IG51bGwsXG4gICAgICB9O1xuICAgICAgZHJhZ1JlZi5jdXJyZW50ID0gZHJhZztcbiAgICAgIHRyeSB7XG4gICAgICAgIHQuc2V0UG9pbnRlckNhcHR1cmUoZS5wb2ludGVySWQpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIHN5bnRoZXRpYyBldmVudHMgbWF5IHJlamVjdCBjYXB0dXJlICovXG4gICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IG9uTW92ZSA9IChlOiBQb2ludGVyRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IGQgPSBkcmFnUmVmLmN1cnJlbnQ7XG4gICAgICBpZiAoIWQgfHwgZS5wb2ludGVySWQgIT09IGQucG9pbnRlcklkKSByZXR1cm47XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBpZiAoZC5jb3JuZXIuc3RhcnRzV2l0aCgncm90LScpKSB7XG4gICAgICAgIC8vIFJvdGF0ZSBSRUxBVElWRSB0byB0aGUgZ3JhYmJlZCBjb3JuZXI6IHR1cm4gYnkgdGhlIGNoYW5nZSBpbiB0aGVcbiAgICAgICAgLy8gY2VudGVy4oaScG9pbnRlciBhbmdsZSBmcm9tIHdoZXJlIHRoZSBkcmFnIHN0YXJ0ZWQuIFNoaWZ0IHNuYXBzIHRvIDE1wrAuXG4gICAgICAgIGNvbnN0IGRlZyA9IHJvdGF0ZURlbHRhRGVnKFxuICAgICAgICAgIGQuYW5nbGUsXG4gICAgICAgICAgZC5yb3RTdGFydFBvaW50ZXIsXG4gICAgICAgICAgcG9pbnRlckFuZ2xlUmFkKGQuY3gsIGQuY3ksIGUuY2xpZW50WCwgZS5jbGllbnRZKSxcbiAgICAgICAgICAhIWUuc2hpZnRLZXlcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgdGYgPSBgcm90YXRlKCR7ZGVnfWRlZylgO1xuICAgICAgICBkLmVsLnN0eWxlLnRyYW5zZm9ybSA9IHRmO1xuICAgICAgICBkLmxhc3RUcmFuc2Zvcm0gPSB0ZjtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgYXBwbHlQcmV2aWV3KGQsIGNvbXB1dGVGcm9tRXZlbnQoZCwgZSkpO1xuICAgIH07XG5cbiAgICBjb25zdCBvblVwID0gKGU6IFBvaW50ZXJFdmVudCkgPT4ge1xuICAgICAgY29uc3QgZCA9IGRyYWdSZWYuY3VycmVudDtcbiAgICAgIGlmICghZCB8fCBlLnBvaW50ZXJJZCAhPT0gZC5wb2ludGVySWQpIHJldHVybjtcbiAgICAgIGRyYWdSZWYuY3VycmVudCA9IG51bGw7XG4gICAgICBpZiAoZC5jb3JuZXIuc3RhcnRzV2l0aCgncm90LScpKSB7XG4gICAgICAgIGNvbnN0IHRmID0gZC5sYXN0VHJhbnNmb3JtO1xuICAgICAgICBpZiAoIXRmIHx8IHRmID09PSBkLmJlZm9yZS50cmFuc2Zvcm0pIHJldHVybjsgLy8gbm8tb3BcbiAgICAgICAgbGFzdENvbW1pdFJlZi5jdXJyZW50ID0geyBlbDogZC5lbCwgYmVmb3JlOiBkLmJlZm9yZSB9O1xuICAgICAgICBwb3N0Um90YXRlUmVxdWVzdChkLCB0Zik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHIgPSBkLmxhc3RSZXN1bHQgPz8gY29tcHV0ZUZyb21FdmVudChkLCBlKTtcbiAgICAgIC8vIE5vLW9wIGd1YXJkOiBub3RoaW5nIGNoYW5nZWQg4oaSIGRvbid0IGNodXJuIGEgc291cmNlIHdyaXRlIC8gdW5kbyBlbnRyeS5cbiAgICAgIGNvbnN0IGNoYW5nZWQgPVxuICAgICAgICBgJHtyLndpZHRofXB4YCAhPT0gZC5iZWZvcmUud2lkdGggfHxcbiAgICAgICAgYCR7ci5oZWlnaHR9cHhgICE9PSBkLmJlZm9yZS5oZWlnaHQgfHxcbiAgICAgICAgKHR5cGVvZiByLmxlZnQgPT09ICdudW1iZXInICYmIGAke3IubGVmdH1weGAgIT09IGQuYmVmb3JlLmxlZnQpIHx8XG4gICAgICAgICh0eXBlb2Ygci50b3AgPT09ICdudW1iZXInICYmIGAke3IudG9wfXB4YCAhPT0gZC5iZWZvcmUudG9wKTtcbiAgICAgIGlmICghY2hhbmdlZCkgcmV0dXJuO1xuICAgICAgbGFzdENvbW1pdFJlZi5jdXJyZW50ID0geyBlbDogZC5lbCwgYmVmb3JlOiBkLmJlZm9yZSB9O1xuICAgICAgaWYgKGQuYXJ0Ym9hcmRJZCkgcG9zdFJlc2l6ZUFydGJvYXJkUmVxdWVzdChkLCByKTtcbiAgICAgIGVsc2UgcG9zdFJlc2l6ZVJlcXVlc3QoZCwgcik7XG4gICAgfTtcblxuICAgIC8vIFJlc3RvcmUgdGhlIHByZS1kcmFnIGlubGluZSBib3ggaWYgdGhlIHNoZWxsIHJlcG9ydHMgdGhlIHdyaXRlIGZhaWxlZC5cbiAgICAvLyBgcmVzaXplLWFydGJvYXJkLWZhaWxlZGAgKFN0YWdlIEQ0KSBzaGFyZXMgdGhlIHNhbWUgcmVzdG9yZSBzaGFwZSDigJQgYW5cbiAgICAvLyBhcnRib2FyZCBkcmFnJ3MgYGJlZm9yZWAgbmV2ZXIgY2FycmllcyBsZWZ0L3RvcCAoY2FuTW92ZUxlZnQvVG9wIGZvcmNlZFxuICAgIC8vIGZhbHNlKSwgc28gdGhlIHdpZHRoL2hlaWdodC1vbmx5IGJyYW5jaCBiZWxvdyBpcyBhbHJlYWR5IGNvcnJlY3QgZm9yIGl0LlxuICAgIGNvbnN0IG9uRmFpbCA9IChlOiBNZXNzYWdlRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IG0gPSBlLmRhdGEgYXMgeyBkZ24/OiBzdHJpbmcgfSB8IG51bGw7XG4gICAgICBpZiAobT8uZGduICE9PSAncmVzaXplLWZhaWxlZCcgJiYgbT8uZGduICE9PSAncmVzaXplLWFydGJvYXJkLWZhaWxlZCcpIHJldHVybjtcbiAgICAgIGlmIChlLnNvdXJjZSAhPT0gd2luZG93LnBhcmVudCkgcmV0dXJuOyAvLyBvbmx5IHRoZSBwYXJlbnQgc2hlbGwgKEREUi0wNTQpXG4gICAgICBjb25zdCBsYXN0ID0gbGFzdENvbW1pdFJlZi5jdXJyZW50O1xuICAgICAgaWYgKCFsYXN0KSByZXR1cm47XG4gICAgICBsYXN0LmVsLnN0eWxlLndpZHRoID0gbGFzdC5iZWZvcmUud2lkdGggPz8gJyc7XG4gICAgICBsYXN0LmVsLnN0eWxlLmhlaWdodCA9IGxhc3QuYmVmb3JlLmhlaWdodCA/PyAnJztcbiAgICAgIGlmIChsYXN0LmJlZm9yZS5sZWZ0ICE9PSBudWxsIHx8IGxhc3QuZWwuc3R5bGUubGVmdClcbiAgICAgICAgbGFzdC5lbC5zdHlsZS5sZWZ0ID0gbGFzdC5iZWZvcmUubGVmdCA/PyAnJztcbiAgICAgIGlmIChsYXN0LmJlZm9yZS50b3AgIT09IG51bGwgfHwgbGFzdC5lbC5zdHlsZS50b3ApIGxhc3QuZWwuc3R5bGUudG9wID0gbGFzdC5iZWZvcmUudG9wID8/ICcnO1xuICAgICAgaWYgKGxhc3QuYmVmb3JlLnRyYW5zZm9ybSAhPT0gbnVsbCB8fCBsYXN0LmVsLnN0eWxlLnRyYW5zZm9ybSlcbiAgICAgICAgbGFzdC5lbC5zdHlsZS50cmFuc2Zvcm0gPSBsYXN0LmJlZm9yZS50cmFuc2Zvcm0gPz8gJyc7XG4gICAgICBsYXN0Q29tbWl0UmVmLmN1cnJlbnQgPSBudWxsO1xuICAgIH07XG5cbiAgICBjLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgb25Eb3duKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCBvbk1vdmUpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCBvblVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIG9uVXApO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25GYWlsKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgYy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIG9uRG93bik7XG4gICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCBvbk1vdmUpO1xuICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIG9uVXApO1xuICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJjYW5jZWwnLCBvblVwKTtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25GYWlsKTtcbiAgICB9O1xuICB9LCBbb25lLCBhcHBseVByZXZpZXddKTtcblxuICByZXR1cm4gPGRpdiByZWY9e2NvbnRhaW5lclJlZn0gYXJpYS1oaWRkZW49XCJ0cnVlXCIgLz47XG59XG4iLAogICAgIi8qKlxuICogQGZpbGUgICAgICAgZHJhZy1zdGF0ZS50c1xuICogQHB1cnBvc2UgICAgVGlueSBzaGFyZWQgbW9kdWxlLXNjb3BlIGZsYWc6IGlzIGFuIGluLWNhbnZhcyBFTEVNRU5UIGRyYWdcbiAqICAgICAgICAgICAgIChgUmVvcmRlckRyYWdgIOKAlCByZW9yZGVyIG9yIG91dC1vZi1mbG93IHJlcG9zaXRpb24pIGN1cnJlbnRseVxuICogICAgICAgICAgICAgYWN0aXZlPyBDb25zdWx0ZWQgYnkgcGVyLWZyYW1lIHJBRiBvdmVybGF5cyAoYEVsZW1lbnRSZXNpemVPdmVybGF5YCxcbiAqICAgICAgICAgICAgIGBTcGFjaW5nSGFuZGxlc092ZXJsYXlgKSBzbyB0aGV5IGNhbiBza2lwIHRoZWlyIG93blxuICogICAgICAgICAgICAgZ2V0Qm91bmRpbmdDbGllbnRSZWN0L2dldENvbXB1dGVkU3R5bGUgd29yayB3aGlsZSB0aGUgZHJhZydzIE9XTlxuICogICAgICAgICAgICAgbGl2ZS1wcmV2aWV3IGNocm9tZSBpcyB3aGF0IG1hdHRlcnMg4oCUIGF2b2lkcyBjb21wb3VuZGluZyByQUYgY29zdFxuICogICAgICAgICAgICAgZHVyaW5nIHRoZSBzaW5nbGUgbW9zdCBET00tY2h1cm4taGVhdnkgZ2VzdHVyZSB0aGUgY2FudmFzIGhhc1xuICogICAgICAgICAgICAgKGRvZ2Zvb2QgMjAyNi0wNy0wNzogXCJocm96bsSbIHphdmHFocOtIHRlbiB0b29sYmFyXCIgZHVyaW5nIHJlb3JkZXIpLlxuICogICAgICAgICAgICAgQSBzdGFuZGFsb25lIG1vZHVsZSAobm90IGV4cG9ydGVkIGZyb20gY2FudmFzLXNoZWxsLnRzeCkgc28gdGhlXG4gKiAgICAgICAgICAgICBvdmVybGF5IGZpbGVzIGNhbiBpbXBvcnQgaXQgd2l0aG91dCBhIGNpcmN1bGFyIGltcG9ydCBiYWNrIGludG9cbiAqICAgICAgICAgICAgIGNhbnZhcy1zaGVsbC50c3ggKHdoaWNoIGltcG9ydHMgVEhFTSkuXG4gKi9cblxubGV0IGFjdGl2ZSA9IGZhbHNlO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0RWxlbWVudERyYWdBY3RpdmUodjogYm9vbGVhbik6IHZvaWQge1xuICBhY3RpdmUgPSB2O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFbGVtZW50RHJhZ0FjdGl2ZSgpOiBib29sZWFuIHtcbiAgcmV0dXJuIGFjdGl2ZTtcbn1cbiIsCiAgICAiLyoqXG4gKiBAZmlsZSAgICAgICB1c2UtdG9vbC1tb2RlLnRzeCDigJQgUGhhc2UgNC4xIHRvb2wtbW9kZSBzdG9yZVxuICogQHNjb3BlICAgICAgYXBwcy9zdHVkaW8vdXNlLXRvb2wtbW9kZS50c3hcbiAqIEBwdXJwb3NlICAgIENvbnRleHQgKyBob29rIGZvciB0aGUgYWN0aXZlIGNhbnZhcyB0b29sLiBXaXJlZCBpbnRvXG4gKiAgICAgICAgICAgICBEZXNpZ25DYW52YXMuIFBoYXNlIDUgd2lsbFxuICogICAgICAgICAgICAgcmVnaXN0ZXIgYWRkaXRpb25hbCB0b29scyAocGVuLCBjaXJjbGUsIGFycm93LCBlcmFzZXIpIHZpYVxuICogICAgICAgICAgICAgdGhlIHNhbWUgcHJvdmlkZXIg4oCUIHRoZSBBUEkgaXMgaW50ZW50aW9uYWxseSBvcGVuLlxuICpcbiAqIFRoZSByb3V0ZXIncyBgb25Ub29sYCBjYWxsYmFjayAoaW5wdXQtcm91dGVyLnRzeCkgd3JpdGVzIGludG8gdGhpcyBzdG9yZS5cbiAqIFRoZSBUb29sUGFsZXR0ZSArIGN1cnNvciBzeW5jIHJlYWQgZnJvbSBpdC4gU2VsZWN0aW5nIGEgdG9vbCBhbHNvIG11dGF0ZXNcbiAqIGBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvcmAgc28gdGhlIGFmZm9yZGFuY2UgbWF0Y2hlcyBhY3Jvc3MgdGhlIGlmcmFtZS5cbiAqL1xuXG5pbXBvcnQge1xuICBjcmVhdGVDb250ZXh0LFxuICB0eXBlIFJlYWN0Tm9kZSxcbiAgdXNlQ2FsbGJhY2ssXG4gIHVzZUNvbnRleHQsXG4gIHVzZUVmZmVjdCxcbiAgdXNlTWVtbyxcbiAgdXNlU3RhdGUsXG59IGZyb20gJ3JlYWN0JztcblxuaW1wb3J0IHsgVE9PTF9DVVJTT1JTIH0gZnJvbSAnLi9jYW52YXMtY3Vyc29ycy50cyc7XG5pbXBvcnQgdHlwZSB7IFRvb2wgfSBmcm9tICcuL2lucHV0LXJvdXRlci50c3gnO1xuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFR5cGVzXG5cbmV4cG9ydCBpbnRlcmZhY2UgVG9vbERlc2NyaXB0b3Ige1xuICBpZDogVG9vbDtcbiAgbGFiZWw6IHN0cmluZztcbiAgLyoqIExldHRlci1rZXkgc2hvcnRjdXQgc2hvd24gaW4gdGhlIHBhbGV0dGUgdG9vbHRpcC4gKi9cbiAgc2hvcnRjdXQ6IHN0cmluZztcbiAgLyoqIENTUyBjdXJzb3IgdmFsdWUgYXBwbGllZCB0byA8Ym9keT4gd2hlbiB0aGlzIHRvb2wgaXMgYWN0aXZlLiAqL1xuICBjdXJzb3I6IHN0cmluZztcbn1cblxuLyoqXG4gKiBQaGFzZSAyNCDigJQgdGhlIHNpeCBwcmltaXRpdmVzIHRoZSBzaW5nbGUgU2hhcGUgdG9vbCBjYW4gZHJhdy4gTWFwcyBvbnRvIHRoZVxuICogc3Ryb2tlIG1vZGVsOiBzcXVhcmUvcm91bmRlZCDihpIgYHJlY3RgIChjb3JuZXJSYWRpdXMgMCAvIDgpOyBjaXJjbGUg4oaSXG4gKiBgZWxsaXBzZWA7IGRpYW1vbmQvdHJpYW5nbGUvdHJpYW5nbGUtZG93biDihpIgYHBvbHlnb25gLlxuICovXG5leHBvcnQgdHlwZSBTaGFwZUtpbmQgPSAnc3F1YXJlJyB8ICdyb3VuZGVkJyB8ICdjaXJjbGUnIHwgJ2RpYW1vbmQnIHwgJ3RyaWFuZ2xlJyB8ICd0cmlhbmdsZS1kb3duJztcblxuLy8gUGhhc2UgMjEg4oCUIGV2ZXJ5IHRvb2wgc2hpcHMgYSBjdXN0b20gMzLDlzMyIFNWRyBjdXJzb3IgKGNhbnZhcy1jdXJzb3JzLnRzKVxuLy8gd2l0aCBhIHdoaXRlIG91dGxpbmUgaGFsbyBzbyB0aGUgZ2x5cGggcmVhZHMgb24gYW55IGJhY2tncm91bmQuIFRoZSBuYXRpdmVcbi8vIGNyb3NzaGFpci90ZXh0L2NlbGwgd2VyZSB0aGluICsgdGlueSAoXCJwZW4gYWxtb3N0IGludmlzaWJsZVwiKTsgdGhlc2UgbWlycm9yXG4vLyB0aGUgdG9vbC1wYWxldHRlIGljb25zLiBgbW92ZWAga2VlcHMgdGhlIHN5c3RlbSBhcnJvdyBvbiBwdXJwb3NlLlxuZXhwb3J0IGNvbnN0IERFRkFVTFRfVE9PTFM6IHJlYWRvbmx5IFRvb2xEZXNjcmlwdG9yW10gPSBPYmplY3QuZnJlZXplKFtcbiAgeyBpZDogJ21vdmUnLCBsYWJlbDogJ01vdmUnLCBzaG9ydGN1dDogJ1YnLCBjdXJzb3I6IFRPT0xfQ1VSU09SUy5tb3ZlIH0sXG4gIHsgaWQ6ICdoYW5kJywgbGFiZWw6ICdIYW5kJywgc2hvcnRjdXQ6ICdIJywgY3Vyc29yOiBUT09MX0NVUlNPUlMuaGFuZCB9LFxuICB7IGlkOiAnY29tbWVudCcsIGxhYmVsOiAnQ29tbWVudCcsIHNob3J0Y3V0OiAnQycsIGN1cnNvcjogVE9PTF9DVVJTT1JTLmNvbW1lbnQgfSxcbiAgeyBpZDogJ3BlbicsIGxhYmVsOiAnUGVuJywgc2hvcnRjdXQ6ICdCJywgY3Vyc29yOiBUT09MX0NVUlNPUlMucGVuIH0sXG4gIC8vIEFubm90YXRpb24gcG9saXNoIChpdGVtIDgpIOKAlCBoaWdobGlnaHRlciBzaXRzIG5leHQgdG8gdGhlIHBlbi5cbiAgeyBpZDogJ2hpZ2hsaWdodGVyJywgbGFiZWw6ICdIaWdobGlnaHRlcicsIHNob3J0Y3V0OiAnSScsIGN1cnNvcjogVE9PTF9DVVJTT1JTLmhpZ2hsaWdodGVyIH0sXG4gIC8vIFBoYXNlIDI0IOKAlCBvbmUgU2hhcGUgdG9vbCByZXBsYWNlcyB0aGUgc2VwYXJhdGUgUmVjdCAoUikgKyBFbGxpcHNlIChPKVxuICAvLyBidXR0b25zOyB0aGUgcHJpbWl0aXZlIGlzIGNob3NlbiBmcm9tIHRoZSBwYWxldHRlIHBvcG92ZXIuXG4gIHsgaWQ6ICdzaGFwZScsIGxhYmVsOiAnU2hhcGUnLCBzaG9ydGN1dDogJ1InLCBjdXJzb3I6IFRPT0xfQ1VSU09SUy5zaGFwZSB9LFxuICB7IGlkOiAnc3RpY2t5JywgbGFiZWw6ICdTdGlja3knLCBzaG9ydGN1dDogJ04nLCBjdXJzb3I6IFRPT0xfQ1VSU09SUy5zdGlja3kgfSxcbiAgLy8gRmlnSmFtIHYzIOKAlCBsYWJlbGxlZCBvcmdhbml6aW5nIGNvbnRhaW5lci5cbiAgeyBpZDogJ3NlY3Rpb24nLCBsYWJlbDogJ1NlY3Rpb24nLCBzaG9ydGN1dDogJ+KHp1MnLCBjdXJzb3I6IFRPT0xfQ1VSU09SUy5zaGFwZSB9LFxuICB7IGlkOiAnYXJyb3cnLCBsYWJlbDogJ0Fycm93Jywgc2hvcnRjdXQ6ICdBJywgY3Vyc29yOiBUT09MX0NVUlNPUlMuYXJyb3cgfSxcbiAgeyBpZDogJ3RleHQnLCBsYWJlbDogJ1RleHQnLCBzaG9ydGN1dDogJ1QnLCBjdXJzb3I6IFRPT0xfQ1VSU09SUy50ZXh0IH0sXG4gIHsgaWQ6ICdlcmFzZXInLCBsYWJlbDogJ0VyYXNlcicsIHNob3J0Y3V0OiAnRScsIGN1cnNvcjogVE9PTF9DVVJTT1JTLmVyYXNlciB9LFxuXSk7XG5cbmludGVyZmFjZSBUb29sQ29udGV4dFZhbHVlIHtcbiAgdG9vbDogVG9vbDtcbiAgc2V0VG9vbDogKHQ6IFRvb2wpID0+IHZvaWQ7XG4gIHRvb2xzOiByZWFkb25seSBUb29sRGVzY3JpcHRvcltdO1xuICAvKiogVDE5IOKAlCBzdGlja3ktdG9vbCBkb3VibGUtY2xpY2sgbG9jay4gV2hlbiBgc3RpY2t5LmxvY2tlZCA9PT0gdHJ1ZWAgQU5EXG4gICAqICBgc3RpY2t5LnRvb2wgPT09IHRvb2xgLCBkcmF3IHRvb2xzIHN0YXkgYXJtZWQgYWZ0ZXIgZWFjaCBzaGFwZSBjb21taXRcbiAgICogIChUMTggYXV0by1mbGlwIGlzIHN1cHByZXNzZWQpLiBTaW5nbGUtY2xpY2sgb24gYW55IG90aGVyIHRvb2wgY2xlYXJzXG4gICAqICBzdGlja3k7IEVzYyBjbGVhcnMgKyBmbGlwcyB0byBNb3ZlLiAqL1xuICBzdGlja3k6IHsgdG9vbDogVG9vbCB8IG51bGw7IGxvY2tlZDogYm9vbGVhbiB9O1xuICB0b2dnbGVTdGlja3k6ICh0OiBUb29sKSA9PiB2b2lkO1xuICBjbGVhclN0aWNreTogKCkgPT4gdm9pZDtcbiAgLyoqIFBoYXNlIDI0IOKAlCB0aGUgcHJpbWl0aXZlIHRoZSBTaGFwZSB0b29sIHdpbGwgZHJhdyBuZXh0LiAqL1xuICBzaGFwZUtpbmQ6IFNoYXBlS2luZDtcbiAgc2V0U2hhcGVLaW5kOiAoazogU2hhcGVLaW5kKSA9PiB2b2lkO1xufVxuXG5jb25zdCBUb29sQ29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8VG9vbENvbnRleHRWYWx1ZSB8IG51bGw+KG51bGwpO1xuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFByb3ZpZGVyXG5cbmV4cG9ydCBmdW5jdGlvbiBUb29sUHJvdmlkZXIoe1xuICBjaGlsZHJlbixcbiAgdG9vbHMgPSBERUZBVUxUX1RPT0xTLFxuICBpbml0aWFsID0gJ21vdmUnLFxufToge1xuICBjaGlsZHJlbjogUmVhY3ROb2RlO1xuICB0b29scz86IHJlYWRvbmx5IFRvb2xEZXNjcmlwdG9yW107XG4gIGluaXRpYWw/OiBUb29sO1xufSkge1xuICBjb25zdCBbdG9vbCwgc2V0VG9vbFN0YXRlXSA9IHVzZVN0YXRlPFRvb2w+KGluaXRpYWwpO1xuICBjb25zdCBbc3RpY2t5LCBzZXRTdGlja3ldID0gdXNlU3RhdGU8eyB0b29sOiBUb29sIHwgbnVsbDsgbG9ja2VkOiBib29sZWFuIH0+KCgpID0+ICh7XG4gICAgdG9vbDogbnVsbCxcbiAgICBsb2NrZWQ6IGZhbHNlLFxuICB9KSk7XG4gIGNvbnN0IHNldFRvb2wgPSB1c2VDYWxsYmFjaygodDogVG9vbCkgPT4ge1xuICAgIHNldFRvb2xTdGF0ZSh0KTtcbiAgICAvLyBTaW5nbGUtY2xpY2sgb24gYSBkaWZmZXJlbnQgdG9vbCBjbGVhcnMgYW55IHN0aWNreSBsb2NrIOKAlCBzdGlja3kgaXNcbiAgICAvLyBhIHBlci10b29sIGZsYWcsIG5vdCBnbG9iYWwuXG4gICAgc2V0U3RpY2t5KChwcmV2KSA9PiAocHJldi5sb2NrZWQgJiYgcHJldi50b29sID09PSB0ID8gcHJldiA6IHsgdG9vbDogbnVsbCwgbG9ja2VkOiBmYWxzZSB9KSk7XG4gIH0sIFtdKTtcbiAgY29uc3QgdG9nZ2xlU3RpY2t5ID0gdXNlQ2FsbGJhY2soKHQ6IFRvb2wpID0+IHtcbiAgICBzZXRTdGlja3koKHByZXYpID0+IHtcbiAgICAgIGlmIChwcmV2LmxvY2tlZCAmJiBwcmV2LnRvb2wgPT09IHQpIHJldHVybiB7IHRvb2w6IG51bGwsIGxvY2tlZDogZmFsc2UgfTtcbiAgICAgIHJldHVybiB7IHRvb2w6IHQsIGxvY2tlZDogdHJ1ZSB9O1xuICAgIH0pO1xuICAgIHNldFRvb2xTdGF0ZSh0KTtcbiAgfSwgW10pO1xuICBjb25zdCBjbGVhclN0aWNreSA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRTdGlja3koeyB0b29sOiBudWxsLCBsb2NrZWQ6IGZhbHNlIH0pO1xuICB9LCBbXSk7XG4gIC8vIEZpZ0phbSB2MyDigJQgc29mdCBkZWZhdWx0OiBhIGZyZXNoIFNoYXBlIHRvb2wgZHJhd3MgUk9VTkRFRCBzcXVhcmVzICh0aGVcbiAgLy8gRmlnSmFtIGxvb2spOyBzaGFycCBzcXVhcmVzIHN0YXkgb25lIHBvcG92ZXIgY2xpY2sgYXdheS5cbiAgY29uc3QgW3NoYXBlS2luZCwgc2V0U2hhcGVLaW5kXSA9IHVzZVN0YXRlPFNoYXBlS2luZD4oJ3JvdW5kZWQnKTtcblxuICAvLyBDdXJzb3Igc3luYyDigJQgYXBwbGllZCBpbnNpZGUgdGhlIGNhbnZhcyAodGhpcyBob29rIHJ1bnMgaW4gdGhlIGNhbnZhc1xuICAvLyBjb250ZXh0KS4gVGhlIGFjdGl2ZSB0b29sJ3MgY3Vyc29yIGlzIHNldCBvbiA8Ym9keT4gQU5EIGZvcmNlZCBhY3Jvc3MgdGhlXG4gIC8vIHdob2xlIGNhbnZhcyB3b3JraW5nIGFyZWEgdmlhIGFuIGAhaW1wb3J0YW50YCBydWxlLCBzbyB0aGUgY3VzdG9tIGN1cnNvclxuICAvLyBzaG93cyBFVkVSWVdIRVJFIOKAlCBpbmNsdWRpbmcgb3ZlciBhcnRib2FyZCBDT05URU5ULCB3aG9zZSBvd24gYGN1cnNvcjpcbiAgLy8gcG9pbnRlcmAvYHRleHRgL+KApiB3b3VsZCBvdGhlcndpc2Ugd2luIChQaGFzZSAyNCwgdGhlIFwiY3VzdG9tIGN1cnNvcnMgaW4gdGhlXG4gIC8vIHdob2xlIGFwcFwiIHJlcXVpcmVtZW50OyBGaWdKYW0gYmVoYXZpb3VyKS4gQ2hyb21lIHRoYXQgbGl2ZXMgT1VUU0lERVxuICAvLyBgLmRjLXdvcmxkYCAodG9vbCBwYWxldHRlLCBjb250ZXh0IHRvb2xiYXIsIHJlc2l6ZSBoYW5kbGVzKSBpcyBpbnRlbnRpb25hbGx5XG4gIC8vIE5PVCBtYXRjaGVkLCBzbyBpdHMgYnV0dG9ucy9oYW5kbGVzIGtlZXAgdGhlaXIgYWZmb3JkYW5jZSBjdXJzb3JzLiBUaGVcbiAgLy8gdmlld3BvcnQtY29udHJvbGxlciBzdGlsbCBvd25zIHRoZSBncmFiL2dyYWJiaW5nIHN3YXAgZHVyaW5nIHNwYWNlLXBhbi5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICAgIGNvbnN0IGRlc2MgPSB0b29scy5maW5kKCh0KSA9PiB0LmlkID09PSB0b29sKTtcbiAgICBpZiAoIWRlc2MpIHJldHVybjtcbiAgICBjb25zdCBwcmV2ID0gZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3I7XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSBkZXNjLmN1cnNvcjtcbiAgICBsZXQgc3R5bGVFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkYy10b29sLWN1cnNvcicpIGFzIEhUTUxTdHlsZUVsZW1lbnQgfCBudWxsO1xuICAgIGlmICghc3R5bGVFbCkge1xuICAgICAgc3R5bGVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgICBzdHlsZUVsLmlkID0gJ2RjLXRvb2wtY3Vyc29yJztcbiAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGVFbCk7XG4gICAgfVxuICAgIC8vIFRydWx5IEdMT0JBTCBpbnNpZGUgdGhlIGNhbnZhcyBkb2N1bWVudCDigJQgYCpgIHNvIGl0IGNvdmVycyB0aGUgZW1wdHkgZ3JpZFxuICAgIC8vIGhvc3QsIGAuZGMtd29ybGRgLCBldmVyeSBhcnRib2FyZCArIGl0cyBjb250ZW50LCBBTkQgdGhlIGZsb2F0aW5nIGNocm9tZVxuICAgIC8vIChtaW5pbWFwLCB0b29sYmFyKS4gVGhlIGVhcmxpZXIgYC5kYy13b3JsZGAtc2NvcGVkIHJ1bGUgbGVmdCB0aGUgZW1wdHlcbiAgICAvLyBjYW52YXMgLyBtaW5pbWFwIG9uIHRoZWlyIG93biBjdXJzb3JzOyB0aGUgYnJpZWYgaXMgXCJwcm9zdMSbIHbFoXVkZVwiLiAoTWlycm9yc1xuICAgIC8vIHRoZSBvdXRlci1zaGVsbCBgKmAgcnVsZSBzbyBib3RoIGRvY3VtZW50cyBhcmUgdW5pZm9ybWx5IGNvdmVyZWQuKVxuICAgIHN0eWxlRWwudGV4dENvbnRlbnQgPSBgKiB7IGN1cnNvcjogJHtkZXNjLmN1cnNvcn0gIWltcG9ydGFudDsgfWA7XG4gICAgLy8gUGhhc2UgMjQg4oCUIGJyb2FkY2FzdCB0aGUgYWN0aXZlIHRvb2wgVE9LRU4gdG8gdGhlIE9VVEVSIGFwcCBzaGVsbCAodGhpc1xuICAgIC8vIGhvb2sgcnVucyBpbiB0aGUgY2FudmFzIGlmcmFtZSkgc28gdGhlIHNoZWxsIHNob3dzIHRoZSBzYW1lIGN1c3RvbSBjdXJzb3JcbiAgICAvLyBhY3Jvc3MgdGhlIHdob2xlIG1hdWRlIFVJIChzaWRlYmFyIC8gdG9wIGJhcikuIFdlIHNlbmQgdGhlIHRvb2wgKmlkKiwgTk9UXG4gICAgLy8gdGhlIGN1cnNvciBzdHJpbmc6IHRoZSBzaGVsbCByZXNvbHZlcyBpdCBhZ2FpbnN0IGl0cyBvd24gdHJ1c3RlZFxuICAgIC8vIFRPT0xfQ1VSU09SUyBjb3B5IChyZXNvbHZlVG9vbEN1cnNvciksIHNvIGFuIHVudHJ1c3RlZCBzeW5jZWQgY2FudmFzXG4gICAgLy8gKEREUi0wNTQpIGNhbiBvbmx5IHBpY2sgYSBrbm93biwgYWx3YXlzLXZpc2libGUgZ2x5cGgg4oCUIGl0IGNhbid0IGluamVjdCBhblxuICAgIC8vIGludmlzaWJsZS9kaXNwbGFjZWQgY3Vyc29yIGFzIGEgY2xpY2tqYWNraW5nIGFpZCAocGhhc2UtMjQgZXRoaWNhbC1oYWNrZXJcbiAgICAvLyBGaW5kaW5nIDI7IEREUi0wNjcpLlxuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cucGFyZW50ICYmIHdpbmRvdy5wYXJlbnQgIT09IHdpbmRvdykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7IGRnbjogJ3Rvb2wtY3Vyc29yJywgdG9vbCB9LCAnKicpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIGNyb3NzLW9yaWdpbiBwYXJlbnQgcmVqZWN0ZWQg4oCUIHNoZWxsIGtlZXBzIGl0cyBkZWZhdWx0IGN1cnNvciAqL1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSBwcmV2O1xuICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGMtdG9vbC1jdXJzb3InKTtcbiAgICAgIGlmIChlbCkgZWwudGV4dENvbnRlbnQgPSAnJztcbiAgICB9O1xuICB9LCBbdG9vbCwgdG9vbHNdKTtcblxuICBjb25zdCB2YWx1ZSA9IHVzZU1lbW88VG9vbENvbnRleHRWYWx1ZT4oXG4gICAgKCkgPT4gKHsgdG9vbCwgc2V0VG9vbCwgdG9vbHMsIHN0aWNreSwgdG9nZ2xlU3RpY2t5LCBjbGVhclN0aWNreSwgc2hhcGVLaW5kLCBzZXRTaGFwZUtpbmQgfSksXG4gICAgW3Rvb2wsIHNldFRvb2wsIHRvb2xzLCBzdGlja3ksIHRvZ2dsZVN0aWNreSwgY2xlYXJTdGlja3ksIHNoYXBlS2luZF1cbiAgKTtcblxuICByZXR1cm4gPFRvb2xDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXt2YWx1ZX0+e2NoaWxkcmVufTwvVG9vbENvbnRleHQuUHJvdmlkZXI+O1xufVxuXG4vKipcbiAqIE1vdW50IGEgYFRvb2xQcm92aWRlcmAgb25seSB3aGVuIG5vbmUgZXhpc3RzIGFib3ZlIHVzLiBXaGVuIHRoZSBzaGVsbC1vd25lZFxuICogY29tbWVudCBtb3VudCBsYXllciAoY2FudmFzLWNvbW1lbnQtbW91bnQudHN4KSBhbHJlYWR5IHByb3ZpZGVzIG9uZSxcbiAqIGBEZXNpZ25DYW52YXNgIGNvbnN1bWVzIHRoYXQgaW5zdGFuY2UgaW5zdGVhZCBvZiBkb3VibGUtbW91bnRpbmcuIFRoZSBob29rXG4gKiBpcyBjYWxsZWQgdW5jb25kaXRpb25hbGx5OyBvbmx5IHRoZSByZXR1cm5lZCB0cmVlIGJyYW5jaGVzIChob29rIHJ1bGVzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIE1heWJlVG9vbFByb3ZpZGVyKHsgY2hpbGRyZW4gfTogeyBjaGlsZHJlbjogUmVhY3ROb2RlIH0pIHtcbiAgY29uc3Qgb3V0ZXIgPSB1c2VDb250ZXh0KFRvb2xDb250ZXh0KTtcbiAgaWYgKG91dGVyKSByZXR1cm4gPD57Y2hpbGRyZW59PC8+O1xuICByZXR1cm4gPFRvb2xQcm92aWRlcj57Y2hpbGRyZW59PC9Ub29sUHJvdmlkZXI+O1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEhvb2tcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZVRvb2xNb2RlKCk6IFRvb2xDb250ZXh0VmFsdWUge1xuICBjb25zdCBjdHggPSB1c2VDb250ZXh0KFRvb2xDb250ZXh0KTtcbiAgaWYgKCFjdHgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VzZVRvb2xNb2RlIG11c3QgYmUgdXNlZCBpbnNpZGUgPFRvb2xQcm92aWRlcj4nKTtcbiAgfVxuICByZXR1cm4gY3R4O1xufVxuXG4vKipcbiAqIFJlYWQtb25seSB2YXJpYW50IOKAlCByZXR1cm5zIGBudWxsYCB3aGVuIG5vIHByb3ZpZGVyIG1vdW50ZWQuIFVzZWQgYnlcbiAqIGNvbXBvbmVudHMgdGhhdCBjYW4gcmVuZGVyIG91dHNpZGUgYSBUb29sUHJvdmlkZXIgdHJlZSAodGhlIGlucHV0XG4gKiByb3V0ZXIncyBvcHRpb25hbCBwYXRoKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVzZVRvb2xNb2RlT3B0aW9uYWwoKTogVG9vbENvbnRleHRWYWx1ZSB8IG51bGwge1xuICByZXR1cm4gdXNlQ29udGV4dChUb29sQ29udGV4dCk7XG59XG4iLAogICAgIi8qKlxuICogQGZpbGUgICAgICAgY2FudmFzLWN1cnNvcnMudHMg4oCUIFBoYXNlIDI0IGN1c3RvbSB0b29sIGN1cnNvcnMgKEtlbm5leSBDQzApXG4gKiBAc2NvcGUgICAgICBhcHBzL3N0dWRpby9jYW52YXMtY3Vyc29ycy50c1xuICogQHB1cnBvc2UgICAgRmlnSmFtL0ZpZ21hLXN0eWxlIGN1c3RvbSBjdXJzb3JzIGZvciBFVkVSWSBjYW52YXMgdG9vbC4gVGhlXG4gKiAgICAgICAgICAgICBuYXRpdmUgY3Jvc3NoYWlyIC8gdGV4dCAvIGFycm93IGN1cnNvcnMgYXJlIHRpbnkgKyB0aGluIGFuZFxuICogICAgICAgICAgICAgdmFuaXNoIG9uIGJ1c3kgY2FudmFzZXM7IHRoZXNlIGFyZSAzMsOXMzIgU1ZHIGN1cnNvcnMgdGhhdCByZWFkIG9uXG4gKiAgICAgICAgICAgICBhbnkgYmFja2dyb3VuZC5cbiAqXG4gKiAgICAgICAgICAgICBQaGFzZSAyNCDigJQgQUxMIHRvb2xzIGRyYXcgZnJvbSBPTkUgbGlicmFyeSwgdGhlICoqS2VubmV5IEN1cnNvclxuICogICAgICAgICAgICAgUGFjayAoMS4xKSoqIFwiT3V0bGluZVwiIHNldCwgd2hpY2ggaXMgKipDQzAgLyBwdWJsaWMgZG9tYWluKipcbiAqICAgICAgICAgICAgIChodHRwczovL2tlbm5leS5ubC9hc3NldHMvY3Vyc29yLXBhY2sg4oCUIG5vIGF0dHJpYnV0aW9uIHJlcXVpcmVkLFxuICogICAgICAgICAgICAgcmVkaXN0cmlidXRhYmxlIGluc2lkZSB0aGlzIE1JVCBwYWNrYWdlICsgbWFya2V0cGxhY2UgY2xvbmUpLiBTZWVcbiAqICAgICAgICAgICAgIEREUi0wNjcgZm9yIHRoZSBsaWNlbmNlIGdhdGUgKEJpYmF0YSBHUEwtMy4wIHdhcyByZWplY3RlZCBhc1xuICogICAgICAgICAgICAgY29weWxlZnQpLiBPbmUgbGlicmFyeSA9IG9uZSB2aXN1YWwgaWRlbnRpdHkgYWNyb3NzIG1vdmUgLyBoYW5kIC9cbiAqICAgICAgICAgICAgIGNvbW1lbnQgLyBwZW4gLyBzaGFwZSAvIHN0aWNreSAvIHRleHQgLyBlcmFzZXIuIFRoZSBnbHlwaCBwYXRoc1xuICogICAgICAgICAgICAgYXJlIEtlbm5leSdzOyB3ZSBSRUNPTE9VUiB0aGVtIChzZWUgYGtlbm5leSgpYCkgdG8gYSBkYXJrLWdseXBoICtcbiAqICAgICAgICAgICAgIHdoaXRlLWhhbG8gdHJlYXRtZW50IHNvIHRoZXkgcmVhZCBjcmlzcGx5IG9uIGxpZ2h0IEFORCBkYXJrXG4gKiAgICAgICAgICAgICBjYW52YXNlcy4gUGVyLXRvb2wgZ2x5cGggbWFwOlxuICogICAgICAgICAgICAgICBtb3Zl4oaScG9pbnRlcl9hIMK3IGhhbmTihpJoYW5kX29wZW4gwrcgY29tbWVudOKGkm1lc3NhZ2VfZG90c19zcXVhcmUgwrdcbiAqICAgICAgICAgICAgICAgcGVu4oaSZHJhd2luZ19wZW5jaWwgwrcgc2hhcGXihpJsaW5lX2Nyb3NzIMK3IGVyYXNlcuKGkmRyYXdpbmdfZXJhc2VyLlxuICogICAgICAgICAgICAgdGV4dCAoSS1iZWFtKSArIHN0aWNreSAoZm9sZGVkLWNvcm5lciBub3RlKSBoYXZlIG5vIGNsZWFuIEtlbm5leVxuICogICAgICAgICAgICAgZXF1aXZhbGVudCwgc28gdGhleSBhcmUgQVVUSE9SRUQgaW4gdGhlIGlkZW50aWNhbCBkYXJrLWdseXBoICtcbiAqICAgICAgICAgICAgIHdoaXRlLWhhbG8gdHJlYXRtZW50IHRvIGtlZXAgb25lIHZpc3VhbCBpZGVudGl0eS5cbiAqXG4gKiAgICAgICAgICAgICBEZWxpdmVyZWQgYXMgQ1NTIGBjdXJzb3I6IHVybChcImRhdGE6aW1hZ2Uvc3ZnK3htbCzigKZcIikgaHggaHksIGZiYFxuICogICAgICAgICAgICAg4oCUIG5vIHJ1bnRpbWUgZGVwZW5kZW5jeSwgbm8gYXNzZXQgZmlsZXMuIDMyw5czMiBpcyB0aGVcbiAqICAgICAgICAgICAgIGNyb3NzLWJyb3dzZXItc2FmZSBjZWlsaW5nOyAoaHgsIGh5KSBpcyB0aGUgY2xpY2sgaG90c3BvdC5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFRvb2wgfSBmcm9tICcuL2lucHV0LXJvdXRlci50c3gnO1xuXG4vKiogQnVpbGQgYSBDU1MgY3Vyc29yIHZhbHVlIGZyb20gYW4gaW5saW5lIFNWRyArIGhvdHNwb3QgKyBuYXRpdmUgZmFsbGJhY2suICovXG5mdW5jdGlvbiBzdmdDdXJzb3Ioc3ZnOiBzdHJpbmcsIGh4OiBudW1iZXIsIGh5OiBudW1iZXIsIGZhbGxiYWNrOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBlbmNvZGVVUklDb21wb25lbnQgaXMgdGhlIHNhZmVzdCBlc2NhcGluZyBmb3IgYSBkYXRhOiBVUkkgaW5zaWRlIHVybChcIuKAplwiKS5cbiAgcmV0dXJuIGB1cmwoXCJkYXRhOmltYWdlL3N2Zyt4bWwsJHtlbmNvZGVVUklDb21wb25lbnQoc3ZnLnRyaW0oKSl9XCIpICR7aHh9ICR7aHl9LCAke2ZhbGxiYWNrfWA7XG59XG5cbi8vIFBoYXNlIDI0IOKAlCAyNHB4IHJlbmRlcmVkIGJveCAoZG93biBmcm9tIDMyKSBzbyBjdXJzb3JzIGFyZW4ndCBvdmVyc2l6ZWQ7IHRoZVxuLy8gZ2x5cGggY29vcmRzIHN0YXkgaW4gdGhlIDMyLXVuaXQgdmlld0JveCBhbmQgc2NhbGUgaW50byAyNHB4LiBIb3RzcG90cyBhcmVcbi8vIHNjYWxlZCB0byBtYXRjaCAoc2VlIHRoZSBnZW5lcmF0b3IpLlxuY29uc3QgVyA9IGB3aWR0aD0nMjQnIGhlaWdodD0nMjQnIHZpZXdCb3g9JzAgMCAzMiAzMicgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJ2A7XG5jb25zdCBJTksgPSAnIzFmMWYxZic7XG5jb25zdCBIQUxPID0gXCJzdHJva2U9JyNmZmZmZmYnIHN0cm9rZS1saW5lam9pbj0ncm91bmQnIHN0cm9rZS1saW5lY2FwPSdyb3VuZCdcIjtcblxuLy8gS2VubmV5IENDMCBnbHlwaCwgcmVjb2xvdXJlZCB0byBhIEZpZ0phbS1zdHlsZSAqKmRhcmsgZ2x5cGggKyB3aGl0ZSBoYWxvKio6XG4vLyBLZW5uZXkncyBvdXRsaW5lIGJhbmQgKGBiYCkgaXMgcGFpbnRlZCBXSElURSAodGhlIGhhbG8pIGFuZCBpdHMgaW5uZXIgZmlsbFxuLy8gKGB3YCkgaXMgcGFpbnRlZCBkYXJrIElOSy4gUmVhZHMgY3Jpc3BseSBvbiBhIExJR0hUIGNhbnZhcyAoc29saWQgZGFyayBnbHlwaClcbi8vIEFORCBhIGRhcmsgb25lICh3aGl0ZSBoYWxvIGVkZ2UpLlxuZnVuY3Rpb24ga2VubmV5KGI6IHN0cmluZywgdzogc3RyaW5nLCB0cmFuc2Zvcm0/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBPcHRpb25hbCBgPGcgdHJhbnNmb3JtPmAgZm9yIHRoZSBkcmF3aW5nIHRvb2xzIHdob3NlIEtlbm5leSBnbHlwaCBuZWVkc1xuICAvLyByZS1vcmllbnRpbmcgc28gdGhlIHdyaXRpbmcgdGlwIGxhbmRzIGF0IHRoZSBob3RzcG90ICh1c2VyIHN0ZWVyXG4gIC8vIDIwMjYtMDYtMDQ6IHBlbiAvIGhpZ2hsaWdodGVyIFwia3Jlc2zDrSBwb2Qga29uY2VtLCBuZSBuYSDFoXBpxI1jZVwiIOKGkiBmbGlwcGVkIHNvXG4gIC8vIHRoZSBuaWIgcG9pbnRzIGRvd24tTEVGVCwgdG9wLXJpZ2h04oaSYm90dG9tLWxlZnQpLlxuICBjb25zdCBvcGVuID0gdHJhbnNmb3JtID8gYDxnIHRyYW5zZm9ybT0nJHt0cmFuc2Zvcm19Jz5gIDogJyc7XG4gIGNvbnN0IGNsb3NlID0gdHJhbnNmb3JtID8gJzwvZz4nIDogJyc7XG4gIHJldHVybiBgPHN2ZyAke1d9PiR7b3Blbn08cGF0aCBmaWxsPScjZmZmZmZmJyBkPScke2J9Jy8+PHBhdGggZmlsbD0nJHtJTkt9JyBkPScke3d9Jy8+JHtjbG9zZX08L3N2Zz5gO1xufVxuXG4vLyBWZXJ0aWNhbCBtaXJyb3IgYWJvdXQgdGhlIDMyLXZpZXdCb3ggaG9yaXpvbnRhbCBjZW50cmU6ICh4LHkpIOKGkiAoeCwgMzLiiJJ5KS5cbi8vIEFwcGxpZWQgdG8gcGVuL2hpZ2hsaWdodGVyIHNvIHRoZSBnbHlwaCBsaWVzIGFsb25nIHRoZSB0b3AtcmlnaHTihpJib3R0b20tbGVmdFxuLy8gZGlhZ29uYWwgd2l0aCB0aGUgbmliIGF0IGJvdHRvbS1sZWZ0LlxuY29uc3QgRkxJUF9WID0gJ3RyYW5zbGF0ZSgwLDMyKSBzY2FsZSgxLC0xKSc7XG5cbi8vIG1vdmUg4oaSIEtlbm5leSBgcG9pbnRlcl9iYCAodXNlciBzdGVlciAyMDI2LTA2LTA0IOKAlCB0aGUgcGxhaW4gdmFyaWFudCwgbm90IHRoZVxuLy8gc2hhZGVkIG9uZSkuIEhvdHNwb3QgYXQgdGhlIGFycm93IHRpcCAodG9wKS5cbmNvbnN0IE1PVkUgPSBzdmdDdXJzb3IoXG4gIGtlbm5leShcbiAgICAnTTEwLjI1IDguMjUgTDEwLjA1IDguNjUgMTAgOSAxMCAyMy4xIDEwLjA1IDIzLjQgMTAuMjUgMjMuNzUgMTAuOCAyNCAxMS40NSAyMy44NSAxMS42IDIzLjcgMTEuNzUgMjMuNDUgMTQuNjUgMTkuOCAxNC44NSAxOS42NSAxNC45NSAxOS41IDE1LjQgMTkuMiAxNS45NSAxOS4xIDIxLjA1IDE5LjEgMjEuMiAxOS4xIDIxLjM1IDE5LjA1IDIxLjY1IDE4LjkgMjEuOSAxOC42IDIyIDE4LjMgMjIgMTcuOSAyMS45IDE3LjY1IDIxLjc1IDE3LjM1IDIxLjY1IDE3LjMgMjEuNTUgMTcuMTUgMTEuNSA4LjI1IDExLjI1IDguMDUgMTAuOTUgOCAxMC42IDguMDUgMTAuMjUgOC4yNSBNOS4xNSA2LjYgTDkuNyA2LjI1IDEwIDYuMTUgMTAuOTUgNiAxMS45IDYuMTUgMTMgNi45IDIyLjkgMTUuNjUgMjMgMTUuOCAyMy4yIDE1Ljk1IDIzLjc1IDE2Ljc1IDI0IDE3LjkgMjQgMTguMyAyMy45IDE4Ljk1IDIzLjggMTkuMjUgMjMuNiAxOS43IDIzLjEgMjAuMzUgMjIuNzUgMjAuNiAyMi4xIDIwLjkgMjIuMDUgMjAuOTUgMjIgMjAuOTUgMjEuMiAyMS4xIDIxLjA1IDIxLjEgMTYuMiAyMS4xIDE2LjEgMjEuMjUgMTYuMDUgMjEuMjUgMTMuNCAyNC42IDEzLjA1IDI1LjE1IDEyLjkgMjUuMyAxMi41NSAyNS41NSBRMTEuNiAyNi4xNSAxMC41NSAyNiBMMTAuNSAyNiBROS42NSAyNS44NSA5IDI1LjMgTDguNDUgMjQuNjUgOC40IDI0LjUgOC4xNSAyNC4wNSA4IDIzLjEgOCA5IFE4IDguNDUgOC4xNSA4LjA1IEw4LjI1IDcuNzUgOC40NSA3LjM1IDkuMTUgNi42JyxcbiAgICAnTTEwLjI1IDguMjUgTDEwLjYgOC4wNSAxMC45NSA4IDExLjI1IDguMDUgMTEuNSA4LjI1IDIxLjU1IDE3LjE1IDIxLjY1IDE3LjMgMjEuNzUgMTcuMzUgMjEuOSAxNy42NSAyMiAxNy45IDIyIDE4LjMgMjEuOSAxOC42IDIxLjY1IDE4LjkgMjEuMzUgMTkuMDUgMjEuMiAxOS4xIDIxLjA1IDE5LjEgMTUuOTUgMTkuMSAxNS40IDE5LjIgMTQuOTUgMTkuNSAxNC44NSAxOS42NSAxNC42NSAxOS44IDExLjc1IDIzLjQ1IDExLjYgMjMuNyAxMS40NSAyMy44NSAxMC44IDI0IDEwLjI1IDIzLjc1IDEwLjA1IDIzLjQgMTAgMjMuMSAxMCA5IDEwLjA1IDguNjUgMTAuMjUgOC4yNSdcbiAgKSxcbiAgOCxcbiAgNSxcbiAgJ2RlZmF1bHQnXG4pO1xuY29uc3QgSEFORCA9IHN2Z0N1cnNvcihcbiAga2VubmV5KFxuICAgICdNMjguNTUgMTcuOCBRMjkuNCAyMC4zIDI4Ljc1IDIyLjggTDI4LjcgMjMgMjguMTUgMjQuNTUgMjguMDUgMjQuNzUgUTI2LjQgMjguMiAyMi43NSAyOS40IEwyMi40NSAyOS41IDE4IDI5LjkgMTcuNzUgMjkuODUgUTE1LjggMjkuMjUgMTMuOCAyOC4xIEwxMy40NSAyNy45NSBRMTIgMjcuMDUgMTAuMzUgMjYuOCBMMTAuMjUgMjYuNzUgNy45IDI2LjcgNy44IDI2LjcgUTYuMSAyNi45IDQuOCAyNS44IEw0Ljc1IDI1LjggNC42NSAyNS43IDQuNiAyNS42NSBRMy4yNSAyNC41IDMuMDUgMjIuODUgTDMgMjIuNzUgUTIuOCAyMC45NSA0IDE5LjUgNS4wNSAxOC4xNSA2Ljc1IDE3Ljk1IEw4LjQgMTcuOSA3LjUgMTUuNTUgNy4zIDE1LjIgNy4yIDE1IDUgMTAuOTUgUTMuOSA5LjE1IDQuMyA3Ljc1IEw0LjQgNy41IFE0Ljc1IDYuMTUgNi40NSA1LjIgOSAzLjY1IDExIDUgMTEuMDUgNC4xIDExLjUgMy40NSAxMi4xNSAyLjEgMTQuMiAxLjYgTDE0LjM1IDEuNiBRMTguMDUgMC42IDE5LjYgNC40IEwxOS42NSA0LjU1IFEyMC43NSAzLjY1IDIyLjcgMy43NSBMMjIuNzUgMy43NSBRMjYuNzUgNCAyNyA4LjE1IEwyNyA4LjI1IDI3IDguMzUgMjcgOC40NSBRMjYuOSAxMC43NSAyNy4xIDEyLjYgMjcuMTUgMTQuNjUgMjguMiAxNi43NSBMMjguNTUgMTcuOCBNMjYuNjUgMTguNCBMMjYuMSAxNi44IDI2LjEgMTYuODUgUTI0LjggMTMuNyAyNSA4LjM1IEwyNSA4LjI1IFEyNC44NSA1LjkgMjIuNiA1Ljc1IDIwLjcgNS42NSAyMC40IDcuMzUgTDIwLjEgNy45NSAxOS41IDguMiAxOC44NSA4LjA1IDE4LjQ1IDcuNSAxNy43NSA1LjE1IFExNi44NSAyLjk1IDE0LjcgMy41NSBMMTQuNjUgMy41NSBRMTIuNTUgNC4wNSAxMy4xNSA2LjE1IEwxMy44NSA4Ljc1IDEzLjc1IDkuNDUgMTMuMjUgOS45NSAxMi41NSA5Ljk1IDEyIDkuNTUgMTAuOSA3LjcgUTkuNSA1LjcgNy40NSA2LjkgNi41IDcuNDUgNi4yNSA4LjE1IDYuMSA4LjkgNi43IDkuODUgOS4yIDEzLjkgMTAuOCAxOC42NSBMMTAuOCAxOS4zIDEwLjQgMTkuOCA5Ljc1IDE5Ljk1IFE4LjM1IDE5LjggNi45NSAxOS45NSA2LjEgMjAuMDUgNS41NSAyMC43NSA0LjkgMjEuNTUgNSAyMi41NSA1LjE1IDIzLjU1IDYgMjQuMiBMNi4wNSAyNC4yNSBRNi43NSAyNC44NSA3LjY1IDI0LjcgTDcuNyAyNC43IDEwLjY1IDI0LjggUTEyLjcgMjUuMTUgMTQuNDUgMjYuMiBMMTQuNSAyNi4yIFExNi40IDI3LjM1IDE4LjMgMjcuOSBMMjIuMDUgMjcuNSAyMi4xIDI3LjUgUTI0Ljk1IDI2LjU1IDI2LjI1IDIzLjg1IEwyNi44IDIyLjMgUTI3LjMgMjAuMzUgMjYuNjUgMTguNCcsXG4gICAgJ00yNi42NSAxOC40IFEyNy4zIDIwLjM1IDI2LjggMjIuMyBMMjYuMjUgMjMuODUgUTI0Ljk1IDI2LjU1IDIyLjEgMjcuNSBMMjIuMDUgMjcuNSAxOC4zIDI3LjkgUTE2LjQgMjcuMzUgMTQuNSAyNi4yIEwxNC40NSAyNi4yIFExMi43IDI1LjE1IDEwLjY1IDI0LjggTDcuNyAyNC43IDcuNjUgMjQuNyBRNi43NSAyNC44NSA2LjA1IDI0LjI1IEw2IDI0LjIgUTUuMTUgMjMuNTUgNSAyMi41NSA0LjkgMjEuNTUgNS41NSAyMC43NSA2LjEgMjAuMDUgNi45NSAxOS45NSA4LjM1IDE5LjggOS43NSAxOS45NSBMMTAuNCAxOS44IDEwLjggMTkuMyAxMC44IDE4LjY1IFE5LjIgMTMuOSA2LjcgOS44NSA2LjEgOC45IDYuMjUgOC4xNSA2LjUgNy40NSA3LjQ1IDYuOSA5LjUgNS43IDEwLjkgNy43IEwxMiA5LjU1IDEyLjU1IDkuOTUgMTMuMjUgOS45NSAxMy43NSA5LjQ1IDEzLjg1IDguNzUgMTMuMTUgNi4xNSBRMTIuNTUgNC4wNSAxNC42NSAzLjU1IEwxNC43IDMuNTUgUTE2Ljg1IDIuOTUgMTcuNzUgNS4xNSBMMTguNDUgNy41IDE4Ljg1IDguMDUgMTkuNSA4LjIgMjAuMSA3Ljk1IDIwLjQgNy4zNSBRMjAuNyA1LjY1IDIyLjYgNS43NSAyNC44NSA1LjkgMjUgOC4yNSBMMjUgOC4zNSBRMjQuOCAxMy43IDI2LjEgMTYuODUgTDI2LjEgMTYuOCAyNi42NSAxOC40J1xuICApLFxuICAxMixcbiAgMTIsXG4gICdncmFiJ1xuKTtcbi8vIGNvbW1lbnQg4oaSIEtlbm5leSBgbWVzc2FnZV9yb3VuZGAgKHVzZXIgc3RlZXIgMjAyNi0wNi0wNCkuIEhvdHNwb3QgYXQgdGhlXG4vLyB0YWlsIHRpcCAoYm90dG9tLWNlbnRyZSksIHdoZXJlIHRoZSBjb21tZW50IHBpbiBpcyBkcm9wcGVkLlxuY29uc3QgQ09NTUVOVCA9IHN2Z0N1cnNvcihcbiAga2VubmV5KFxuICAgICdNMjggMTQgUTI4IDkuODUgMjQuNDUgNi45IDIwLjk1IDQgMTYgNCAxMS4wNSA0IDcuNSA2LjkgTDcuNDUgNyBRNCA5LjkgNCAxNCA0IDE4LjE1IDcuNTUgMjEuMDUgTDcuNSAyMS4wNSBROS4yIDIyLjQ1IDExLjIgMjMuMiBMMTUuMyAyNy4zIDE2IDI3LjYgMTYuNyAyNy4zIDIwLjg1IDIzLjIgUTIyLjcgMjIuNDUgMjQuMyAyMS4xNSBMMjQuNDUgMjEuMDUgUTI4IDE4LjE1IDI4IDE0IE0yNS43NSA1LjM1IFEzMC4wNSA4Ljk1IDMwIDE0IDMwLjA1IDE5LjA1IDI1Ljc1IDIyLjYgTDI1LjQgMjIuODUgUTIzLjggMjQuMSAyMiAyNC45IEwxOC4xIDI4Ljc1IDE4LjE1IDI4Ljc1IFExNy4yIDI5LjYgMTYgMjkuNiAxNC44IDI5LjYgMTMuODUgMjguNzUgTDEzLjkgMjguNzUgMTAgMjQuOSA2LjYgMjIuODUgNi4yNSAyMi42IFExLjk1IDE5LjA1IDIgMTQgMS45NSA4Ljk1IDYuMjUgNS4zNSAxMC4zIDIgMTYgMiAyMS43IDIgMjUuNzUgNS4zNScsXG4gICAgJ00yOCAxNCBRMjggMTguMTUgMjQuNDUgMjEuMDUgTDI0LjMgMjEuMTUgUTIyLjcgMjIuNDUgMjAuODUgMjMuMiBMMTYuNyAyNy4zIDE2IDI3LjYgMTUuMyAyNy4zIDExLjIgMjMuMiBROS4yIDIyLjQ1IDcuNSAyMS4wNSBMNy41NSAyMS4wNSBRNCAxOC4xNSA0IDE0IDQgOS45IDcuNDUgNyBMNy41IDYuOSBRMTEuMDUgNCAxNiA0IDIwLjk1IDQgMjQuNDUgNi45IDI4IDkuODUgMjggMTQnXG4gICksXG4gIDEyLFxuICAyMSxcbiAgJ2Nyb3NzaGFpcidcbik7XG4vLyBwZW4g4oaSIEtlbm5leSBgZHJhd2luZ19wZW5gLCBtaXJyb3JlZCB2ZXJ0aWNhbGx5IChGTElQX1YpIHNvIHRoZSBuaWIgcG9pbnRzXG4vLyBkb3duLUxFRlQgKHRvcC1yaWdodOKGkmJvdHRvbS1sZWZ0IGRpYWdvbmFsKS4gU291cmNlIGdyYWRpZW50LXNoYWRlIHBhdGggZHJvcHBlZC5cbi8vIEhvdHNwb3QgYXQgdGhlIG5pYiwgYm90dG9tLWxlZnQuXG5jb25zdCBQRU4gPSBzdmdDdXJzb3IoXG4gIGtlbm5leShcbiAgICAnTTQgMTMuMSBMNCA2IFE0IDUuMTUgNC42IDQuNiA1LjE1IDQgNiA0IEwxMy4xIDQgUTEzLjk1IDQgMTQuNTUgNC42IEwyOC42NSAxOC43NSBRMjkuOCAxOS45IDI5Ljc1IDIxLjQ1IEwyOS43NSAyMS42IDI5Ljc1IDIxLjcgUTI5Ljc1IDIzLjIgMjguNyAyNC4zNSBMMjQuNDUgMjguNjUgMjQuMzUgMjguNzUgUTIzLjE1IDI5Ljg1IDIxLjY1IDI5LjggTDIxLjU1IDI5LjggMjEuNCAyOS44IFEyMC4yIDI5LjggMTkuMjUgMjkuMTUgTDE4IDI5LjM1IFExNi42IDI5LjQgMTUuMjUgMjggTDE1LjIgMjcuOTUgOC4yIDIwLjk1IFE3LjYgMjAuMzUgNy42IDE5LjU1IDcuNiAxOC43IDguMiAxOC4xIEw0LjYgMTQuNSBRNCAxMy45IDQgMTMuMSBNMTkuNSAyNi42NSBMMjAuMSAyNy4yNSBRMjAuNyAyNy44NSAyMS41IDI3LjggMjIuMzUgMjcuODUgMjMgMjcuMjUgTDI3LjI1IDIyLjk1IFEyNy44IDIyLjM1IDI3Ljc1IDIxLjU1IDI3LjggMjAuNzUgMjcuMiAyMC4xNSBMMTMuMSA2IDYgNiA2IDEzLjEgMTIuMzUgMTkuNDUgOS42IDE5LjUgMTYuNjUgMjYuNTUgUTE4LjA1IDI4LjA1IDE5LjUgMjYuNjUgTTguMDUgMTIuMyBMOCA4IDEyLjI1IDguMDUgMTMuOCA5LjYgOS42IDEzLjg1IDguMDUgMTIuMyBNMTUuMjUgMTEuMDUgTDIzIDE4LjggMTguOCAyMy4wNSAxMS4wNSAxNS4zIDE1LjI1IDExLjA1JyxcbiAgICAnTTE1LjI1IDExLjA1IEwxMS4wNSAxNS4zIDE4LjggMjMuMDUgMjMgMTguOCAxNS4yNSAxMS4wNSBNMTIuMzUgMTkuNDUgTDYgMTMuMSA2IDYgMTMuMSA2IDI3LjIgMjAuMTUgUTI3LjggMjAuNzUgMjcuNzUgMjEuNTUgMjcuOCAyMi4zNSAyNy4yNSAyMi45NSBMMjMgMjcuMjUgUTIyLjM1IDI3Ljg1IDIxLjUgMjcuOCAyMC43IDI3Ljg1IDIwLjEgMjcuMjUgTDE5LjUgMjYuNjUgMTIuMzUgMTkuNDUgTTguMDUgMTIuMyBMOS42IDEzLjg1IDEzLjggOS42IDEyLjI1IDguMDUgOCA4IDguMDUgMTIuMycsXG4gICAgRkxJUF9WXG4gICksXG4gIDYsXG4gIDE4LFxuICAnY3Jvc3NoYWlyJ1xuKTtcbi8vIGhpZ2hsaWdodGVyIOKGkiBLZW5uZXkgYGRyYXdpbmdfcGVuY2lsYCwgYWxzbyBtaXJyb3JlZCB2ZXJ0aWNhbGx5IChkaXN0aW5jdCBmcm9tXG4vLyB0aGUgcGVuIGdseXBoKS4gSG90c3BvdCBhdCB0aGUgbGVhZCB0aXAsIGJvdHRvbS1sZWZ0LlxuY29uc3QgSElHSExJR0hURVIgPSBzdmdDdXJzb3IoXG4gIGtlbm5leShcbiAgICAnTTUuMTUgMTAuODUgUTQgOS42NSA0IDguMSBMNCA3Ljk1IDQgNy44NSBRMy45NSA2LjIgNS4xIDUuMTUgNi4yNSA0IDcuODUgNCBMNy45NSA0IDguMSA0IFE5LjY1IDQgMTAuODUgNS4xNSBMMTEgNS4zIDE0LjMgNS4yNSBRMTUuMTUgNS4yNSAxNS43NSA1Ljg1IEwyOS45IDIwIFEzMSAyMS4xNSAzMSAyMi43NSBMMzEgMjIuODUgMzEgMjMgUTMxLjA1IDI0LjUgMjkuOSAyNS43IEwyOS41NSAyNS45NSAyNS42NSAyOS45IDI1LjY1IDI5Ljk1IFEyNC40NSAzMS4xIDIyLjc1IDMxLjEgMjEuMiAzMS4xNSAyMCAyOS45NSBMNS44NSAxNS44IFE1LjI1IDE1LjIgNS4yNSAxNC4zNSBMNS4yNSAxMC45NSA1LjE1IDEwLjg1IE0xOS45NSAyNC4yIEwxOC41NSAyMi44IDIyLjggMTguNTUgMjQuMiAxOS45NSAxOS45NSAyNC4yIE0yOC40NSAyMS40IEwxNC4zIDcuMjUgMTAuMTUgNy4zIDkuNCA2LjU1IFE4LjggNS45NSA3Ljk1IDYgNy4xIDUuOTUgNi41IDYuNTUgNS45NSA3LjEgNiA3Ljk1IDUuOTUgOC44IDYuNTUgOS40IEw3LjI1IDEwLjEgNy4yNSAxNC4zNSAyMS40IDI4LjUgUTIyIDI5LjEgMjIuNzUgMjkuMSAyMy42IDI5LjEgMjQuMiAyOC41IEwyOC40NSAyNC4yNSBRMjkuMDUgMjMuNjUgMjkgMjIuODUgMjkuMDUgMjIgMjguNDUgMjEuNCBNOS4yNSAxMy41IEw5LjI1IDkuMyAxMy41IDkuMjUgMTQuMyAxMC4wNSAxMC4wNSAxNC4zIDkuMjUgMTMuNSBNMTcuMTUgMjEuNCBMMTEuNSAxNS43NSAxNS43NSAxMS41IDIxLjQgMTcuMTUgMTcuMTUgMjEuNCcsXG4gICAgJ00xNy4xNSAyMS40IEwyMS40IDE3LjE1IDE1Ljc1IDExLjUgMTEuNSAxNS43NSAxNy4xNSAyMS40IE0yOC40NSAyMS40IFEyOS4wNSAyMiAyOSAyMi44NSAyOS4wNSAyMy42NSAyOC40NSAyNC4yNSBMMjQuMiAyOC41IFEyMy42IDI5LjEgMjIuNzUgMjkuMSAyMiAyOS4xIDIxLjQgMjguNSBMNy4yNSAxNC4zNSA3LjI1IDEwLjEgNi41NSA5LjQgUTUuOTUgOC44IDYgNy45NSA1Ljk1IDcuMSA2LjUgNi41NSA3LjEgNS45NSA3Ljk1IDYgOC44IDUuOTUgOS40IDYuNTUgTDEwLjE1IDcuMyAxNC4zIDcuMjUgMjguNDUgMjEuNCBNMTkuOTUgMjQuMiBMMjQuMiAxOS45NSAyMi44IDE4LjU1IDE4LjU1IDIyLjggMTkuOTUgMjQuMiBNOS4yNSAxMy41IEwxMC4wNSAxNC4zIDE0LjMgMTAuMDUgMTMuNSA5LjI1IDkuMjUgOS4zIDkuMjUgMTMuNScsXG4gICAgRkxJUF9WXG4gICksXG4gIDYsXG4gIDE4LFxuICAnY3Jvc3NoYWlyJ1xuKTtcbmNvbnN0IENST1NTSEFJUiA9IHN2Z0N1cnNvcihcbiAga2VubmV5KFxuICAgICdNMTcgMiBRMTguMiAyIDE5LjE1IDIuOSAyMCAzLjggMjAgNSBMMjAgMTIgMjcgMTIgUTI4LjIgMTIgMjkuMTUgMTIuOSAzMCAxMy44IDMwIDE1IEwzMCAxNyBRMzAgMTguMiAyOS4xNSAxOS4xNSAyOC4yIDIwIDI3IDIwIEwyMCAyMCAyMCAyNyBRMjAgMjguMiAxOS4xNSAyOS4xNSAxOC4yIDMwIDE3IDMwIEwxNSAzMCBRMTMuOCAzMCAxMi45IDI5LjE1IDEyIDI4LjIgMTIgMjcgTDEyIDIwIDUgMjAgUTMuOCAyMCAyLjkgMTkuMTUgMiAxOC4yIDIgMTcgTDIgMTUgUTIgMTMuOCAyLjkgMTIuOSAzLjggMTIgNSAxMiBMMTIgMTIgMTIgNSBRMTIgMy44IDEyLjkgMi45IDEzLjggMiAxNSAyIEwxNyAyIE0xNCAyNyBMMTQuMyAyNy43IFExNC42IDI4IDE1IDI4IEwxNyAyOCAxNy43IDI3LjcgMTggMjcgMTggMTguMDUgMTguMDUgMTggMjcgMTggUTI3LjQgMTggMjcuNyAxNy43IEwyOCAxNyAyOCAxNSAyNy43IDE0LjMgUTI3LjQgMTQgMjcgMTQgTDE4IDE0IDE4IDUgMTcuNyA0LjMgMTcgNCAxNSA0IFExNC42IDQgMTQuMyA0LjMgMTQgNC42IDE0IDUgTDE0IDE0IDUgMTQgUTQuNiAxNCA0LjMgMTQuMyA0IDE0LjYgNCAxNSBMNCAxNyBRNCAxNy40IDQuMyAxNy43IDQuNiAxOCA1IDE4IEwxNCAxOCAxNCAyNycsXG4gICAgJ00xNCAyNyBMMTQgMTggNSAxOCBRNC42IDE4IDQuMyAxNy43IDQgMTcuNCA0IDE3IEw0IDE1IFE0IDE0LjYgNC4zIDE0LjMgNC42IDE0IDUgMTQgTDE0IDE0IDE0IDUgUTE0IDQuNiAxNC4zIDQuMyAxNC42IDQgMTUgNCBMMTcgNCAxNy43IDQuMyAxOCA1IDE4IDE0IDI3IDE0IFEyNy40IDE0IDI3LjcgMTQuMyBMMjggMTUgMjggMTcgMjcuNyAxNy43IFEyNy40IDE4IDI3IDE4IEwxOC4wNSAxOCAxOCAxOC4wNSAxOCAyNyAxNy43IDI3LjcgMTcgMjggMTUgMjggUTE0LjYgMjggMTQuMyAyNy43IEwxNCAyNydcbiAgKSxcbiAgMTIsXG4gIDEyLFxuICAnY3Jvc3NoYWlyJ1xuKTtcbmNvbnN0IEVSQVNFUiA9IHN2Z0N1cnNvcihcbiAga2VubmV5KFxuICAgICdNMy45IDExLjM1IFEyLjMgMTIuNSAzLjcgMTMuOSBMMTYuNCAyNi42NSBRMTcuODUgMjguMDUgMTkuNDUgMjYuOSBMMjcuNjUgMjEuMTUgUTI5LjMgMjAgMjcuODUgMTguNiBMMTUuMTUgNS44NSBRMTMuNzUgNC40NSAxMi4xIDUuNiBMMy45IDExLjM1IE0xLjA1IDEyLjQgUTEgMTAuOTUgMi43NSA5Ljc1IEwxMC45NSA0IDEwLjk1IDMuOTUgUTE0IDEuODUgMTYuNiA0LjQ1IEwyOS4zIDE3LjIgUTMwLjggMTguNjUgMzAuNTUgMjAuMSAzMC41NSAyMS41NSAyOC44IDIyLjggTDIwLjYgMjguNTUgMjAuNjUgMjguNTUgUTE3LjcgMzAuNjUgMTUgMjguMSBMMTUgMjguMDUgMi4zIDE1LjMgMi4zIDE1LjM1IFEwLjggMTMuODUgMS4wNSAxMi40IE0xMy41IDcgTDE5Ljg1IDEzLjM1IDExLjY1IDE5LjE1IDUuMyAxMi43NSAxMy41IDcnLFxuICAgICdNMTMuNSA3IEw1LjMgMTIuNzUgMTEuNjUgMTkuMTUgMTkuODUgMTMuMzUgMTMuNSA3IE0zLjkgMTEuMzUgTDEyLjEgNS42IFExMy43NSA0LjQ1IDE1LjE1IDUuODUgTDI3Ljg1IDE4LjYgUTI5LjMgMjAgMjcuNjUgMjEuMTUgTDE5LjQ1IDI2LjkgUTE3Ljg1IDI4LjA1IDE2LjQgMjYuNjUgTDMuNyAxMy45IFEyLjMgMTIuNSAzLjkgMTEuMzUnXG4gICksXG4gIDYsXG4gIDE0LFxuICAnY2VsbCdcbik7XG5cbi8vIFRleHQg4oCUIGEgY2xhc3NpYyBJLWJlYW0gKHZlcnRpY2FsIHN0ZW0gKyB0b3AvYm90dG9tIHNlcmlmcykuIEF1dGhvcmVkIGluIHRoZVxuLy8gc2FtZSBkYXJrLUlOSyBnbHlwaCArIHdoaXRlLUhBTE8gdHJlYXRtZW50IGFzIHRoZSBLZW5uZXkgZ2x5cGhzIChLZW5uZXknc1xuLy8gcG9pbnRlcl9pIHJlYWRzIGFzIGEgc21hbGwgYnJhY2tldCwgbm90IGFuIEktYmVhbSkuIEhvdHNwb3QgZGVhZC1jZW50cmUuXG5jb25zdCBURVhUID0gc3ZnQ3Vyc29yKFxuICBgPHN2ZyAke1d9PjxwYXRoIGQ9J00xNiA0VjI4TTExIDRIMjFNMTEgMjhIMjEnIGZpbGw9J25vbmUnICR7SEFMT30gc3Ryb2tlLXdpZHRoPSc1Jy8+PHBhdGggZD0nTTE2IDRWMjhNMTEgNEgyMU0xMSAyOEgyMScgZmlsbD0nbm9uZScgc3Ryb2tlPScke0lOS30nIHN0cm9rZS13aWR0aD0nMi4yNScgc3Ryb2tlLWxpbmVjYXA9J3JvdW5kJy8+PC9zdmc+YCxcbiAgMTIsXG4gIDEyLFxuICAndGV4dCdcbik7XG5cbi8vIFN0aWNreSDigJQgYSBub3RlIHdpdGggYSBwZWVsZWQvZm9sZGVkIHRvcC1yaWdodCBjb3JuZXIgKHRoZSB1bml2ZXJzYWwgc3RpY2t5XG4vLyBnbHlwaCkuIEF1dGhvcmVkIGluIHRoZSBzYW1lIHRyZWF0bWVudCAoS2VubmV5IGhhcyBubyBzdGlja3ktbm90ZSkuIEhvdHNwb3Rcbi8vIGF0IHRoZSBub3RlJ3MgdG9wLWxlZnQsIHdoZXJlIHRoZSBub3RlIGlzIGRyb3BwZWQuXG5jb25zdCBTVElDS1kgPSBzdmdDdXJzb3IoXG4gIGA8c3ZnICR7V30+PHBhdGggZD0nTTYgNUgyMUwyNiAxMFYyN0g2WicgZmlsbD0nJHtJTkt9JyAke0hBTE99IHN0cm9rZS13aWR0aD0nMi41Jy8+PHBhdGggZD0nTTIxIDVWMTFIMjYnIGZpbGw9J25vbmUnICR7SEFMT30gc3Ryb2tlLXdpZHRoPScyLjI1Jy8+PC9zdmc+YCxcbiAgNSxcbiAgNSxcbiAgJ2Nyb3NzaGFpcidcbik7XG5cbi8qKlxuICogVG9vbCDihpIgQ1NTIGN1cnNvciB2YWx1ZS4gUGhhc2UgMjQg4oCUIGV2ZXJ5IHRvb2wgc2hpcHMgYSBLZW5uZXkgZ2x5cGggKG5vXG4gKiBzeXN0ZW0gZmFsbGJhY2sgZm9yIGBtb3ZlYCBhbnltb3JlOyB0aGUgYnJpZWYgaXMgT05FIHVuaWZpZWQgbGlicmFyeSkuIFRoZVxuICogc2luZ2xlIFNoYXBlIHRvb2wgdXNlcyB0aGUgY3Jvc3NoYWlyOyBgcmVjdGAvYGVsbGlwc2VgIHN0YXkga2V5ZWQgKHN0aWxsIGluXG4gKiB0aGUgVG9vbCB1bmlvbikgYnV0IGFyZSBubyBsb25nZXIgZGlyZWN0bHkgc2VsZWN0YWJsZS5cbiAqL1xuLy8gRnJvemVuIHNvIHRoZSBkb2NzdHJpbmcncyBcImZyb3plbiBtYXBcIiBndWFyYW50ZWUgaXMgcmVhbDogYHJlc29sdmVUb29sQ3Vyc29yYFxuLy8gaXMgYSBwdXJlIGxvb2t1cCBpbnRvIHRoaXMgb2JqZWN0LCBhbmQgZnJlZXppbmcgZm9yZWNsb3NlcyBhbnkgc2FtZS1yZWFsbVxuLy8gc2hlbGwtc2lkZSBjb2RlIGV2ZXIgbXV0YXRpbmcgYW4gZW50cnkgb3V0IGZyb20gdW5kZXIgdGhlIGxvb2t1cCAodGhlIGNhbnZhc1xuLy8gcnVucyBjcm9zcy1vcmlnaW4gYW5kIGNhbid0IHJlYWNoIGl0IHJlZ2FyZGxlc3Mg4oCUIHRoaXMgaXMgYmVsdC1hbmQtYnJhY2VzKS5cbmV4cG9ydCBjb25zdCBUT09MX0NVUlNPUlM6IFJlY29yZDxUb29sLCBzdHJpbmc+ID0gT2JqZWN0LmZyZWV6ZSh7XG4gIG1vdmU6IE1PVkUsXG4gIGhhbmQ6IEhBTkQsXG4gIGNvbW1lbnQ6IENPTU1FTlQsXG4gIHBlbjogUEVOLFxuICAvLyBGaWdKYW0gdjMg4oCUIHRoZSBzZWN0aW9uIGNvbnRhaW5lciBkcmF3cyBsaWtlIGEgc2hhcGUgKGNyb3NzaGFpciBnbHlwaCkuXG4gIHNlY3Rpb246IENST1NTSEFJUixcbiAgLy8gSGlnaGxpZ2h0ZXIgPSBLZW5uZXkgYGRyYXdpbmdfcGVuY2lsYCByb3QxODA7IHBlbiA9IGBkcmF3aW5nX3BlbmAgcm90MTgwIOKAlFxuICAvLyBkaXN0aW5jdCBnbHlwaHMsIGJvdGggZnJvbSB0aGUgS2VubmV5IHBhY2sgKHVzZXIgc3RlZXIgMjAyNi0wNi0wNCkuXG4gIGhpZ2hsaWdodGVyOiBISUdITElHSFRFUixcbiAgc2hhcGU6IENST1NTSEFJUixcbiAgcmVjdDogQ1JPU1NIQUlSLFxuICBlbGxpcHNlOiBDUk9TU0hBSVIsXG4gIHN0aWNreTogU1RJQ0tZLFxuICBhcnJvdzogQ1JPU1NIQUlSLFxuICB0ZXh0OiBURVhULFxuICBlcmFzZXI6IEVSQVNFUixcbn0pO1xuXG4vKipcbiAqIFJlc29sdmUgYSB0b29sIHRva2VuIOKAlCByZWNlaXZlZCBvdmVyIHRoZSAqKnVudHJ1c3RlZCoqIGNhbnZhc+KGknNoZWxsXG4gKiBgdG9vbC1jdXJzb3JgIHBvc3RNZXNzYWdlIGJyaWRnZSDigJQgdG8gYSBUUlVTVEVEIGN1cnNvciBzdHJpbmcgZnJvbVxuICoge0BsaW5rIFRPT0xfQ1VSU09SU30sIG9yIGBudWxsYCB3aGVuIHRoZSB0b2tlbiBpcyBub3QgYSBrbm93biB0b29sLlxuICpcbiAqIFRoZSBhcHAgc2hlbGwgYXBwbGllcyB0aGUgdmFsdWUgdGhpcyBSRVRVUk5TLCBuZXZlciB0aGUgcmF3IG1lc3NhZ2UuIFRoYXQgaXNcbiAqIHRoZSBzZWN1cml0eSBib3VuZGFyeTogYSBtYWxpY2lvdXMgKnN5bmNlZCogY2FudmFzIChERFItMDU0IOKAlCBjYW52YXMgY29udGVudFxuICogaXMgdW50cnVzdGVkIGFuZCBtYXkgYmUgaHViLXB1c2hlZCkgY2FuIGNhbGxcbiAqIGB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHsgZGduOiAndG9vbC1jdXJzb3InLCB0b29sOiDigKYgfSwgJyonKWAgZGlyZWN0bHksXG4gKiBieXBhc3NpbmcgdGhlIGhvbmVzdCBgVG9vbFByb3ZpZGVyYCBzZW5kZXIuIEJ5IGVjaG9pbmcgb25seSBhIHRva2VuIGFuZFxuICogbG9va2luZyB0aGUgY3Vyc29yIHVwIGhlcmUsIHRoZSB3b3JzdCB0aGF0IGNhbnZhcyBjYW4gZG8gaXMgcGljayAqd2hpY2gqXG4gKiBrbm93biwgYWx3YXlzLXZpc2libGUgZ2x5cGggdGhlIHNoZWxsIHNob3dzIOKAlCBpdCBjYW4gbm8gbG9uZ2VyIHNtdWdnbGUgYW5cbiAqIGludmlzaWJsZSAvIGRpc3BsYWNlZCAvIHplcm8tY29udGVudCBTVkcgY3Vyc29yIHRoYXQgd291bGQgYWN0IGFzIGFcbiAqIGNsaWNramFja2luZyBhaWQgb3ZlciB0aGUgdW4tQ1NQJ2Qgc2hlbGwgKHBoYXNlLTI0IGV0aGljYWwtaGFja2VyIEZpbmRpbmcgMjtcbiAqIHNlZSBERFItMDY3KS4gYGhhc093blByb3BlcnR5YCAobm90IGBpbmApIGtlZXBzIGBjb25zdHJ1Y3RvcmAvYF9fcHJvdG9fX2BcbiAqIG9mZiB0aGUgYWxsb3dsaXN0LCBhbmQgdGhlIGBbYS16LV1gIHNoYXBlIGdhdGUgYmFycyBhbnl0aGluZyBidXQgYSB0b29sIGlkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVRvb2xDdXJzb3IodG9rZW46IHVua25vd24pOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiB0b2tlbiAhPT0gJ3N0cmluZycgfHwgIS9eW2Etei1dKyQvLnRlc3QodG9rZW4pKSByZXR1cm4gbnVsbDtcbiAgaWYgKCFPYmplY3QuaGFzT3duKFRPT0xfQ1VSU09SUywgdG9rZW4pKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIFRPT0xfQ1VSU09SU1t0b2tlbiBhcyBUb29sXTtcbn1cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUE0QkE7QUFBQTtBQUFBO0FBQUEsY0FJRTtBQUFBLGlCQUVBO0FBQUEsZUFDQTtBQUFB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Q0FBZ0MsWUFBWTtBQUFBLEVBQy9ELEdBQ0EsOENBQ0Y7QUFBQTtBQUdGLFNBQVMsZ0JBQWdCO0FBQUEsRUFDdkI7QUFBQSxFQUNBO0FBQUEsR0FJWTtBQUFBLEVBQ1osU0FBUyxRQUFRLFdBQVcsa0JBQWtCLFVBQVMsRUFBRSxRQUFRLGVBQWUsU0FBUyxFQUFFLENBQUM7QUFBQSxFQUM1RixPQUFPLFNBQVMsbUJBQW1CLFVBQTRDLEVBQUUsSUFBSSxNQUFNLENBQUM7QUFBQSxFQUM1RixNQUFNLFdBQVcsUUFBNkIsSUFBSTtBQUFBLEVBQ2xELE1BQU0sWUFBWSxRQUFPLE1BQU07QUFBQSxFQUMvQixVQUFVLFVBQVU7QUFBQSxFQUdwQixXQUFVLE1BQU07QUFBQSxJQUNkLE1BQU0sTUFBd0I7QUFBQSxNQUM1QixTQUFTLENBQUMsU0FBUyxlQUFlLENBQUMsT0FBTyxFQUFFLFFBQVEsTUFBTSxTQUFTLEVBQUUsVUFBVSxFQUFFLEVBQUU7QUFBQSxNQUNuRixZQUFZLENBQUMsSUFBSSxZQUFZLGdCQUFnQixLQUFLLEVBQUUsSUFBSSxNQUFNLFFBQVEsSUFBSSxFQUFFLElBQUksTUFBTSxDQUFDO0FBQUEsSUFDekY7QUFBQSxJQUNDLE9BQThDLGVBQWU7QUFBQSxJQUM5RCxPQUFPLE1BQU07QUFBQSxNQUNWLE9BQThDLGVBQWU7QUFBQTtBQUFBLEtBRS9ELENBQUMsQ0FBQztBQUFBLEVBRUwsTUFBTSxXQUFXLGFBQVksTUFBTTtBQUFBLElBQ2pDLFNBQVMsVUFBVSxVQUFVO0FBQUEsSUFFN0IsZ0JBQWdCLENBQUMsTUFBTyxFQUFFLEtBQUssRUFBRSxJQUFJLE1BQU0sSUFBSSxDQUFFO0FBQUEsS0FDaEQsQ0FBQyxDQUFDO0FBQUEsRUFFTCxNQUFNLGNBQWMsYUFBWSxNQUFNO0FBQUEsSUFDcEMsZ0JBQWdCLEVBQUUsSUFBSSxNQUFNLFNBQVMsZUFBZSxDQUFDO0FBQUEsS0FDcEQsQ0FBQyxDQUFDO0FBQUEsRUFFTCxNQUFNLFdBQVcsYUFBWSxNQUFpQjtBQUFBLElBQzVDLE1BQU0sS0FBSyxTQUFTO0FBQUEsSUFDcEIsT0FBTyxLQUFLLGdCQUFnQixJQUFJLElBQUksSUFBSTtBQUFBLEtBQ3ZDLENBQUMsSUFBSSxDQUFDO0FBQUEsRUFFVCxPQUFPLGNBQ0wsV0FDQSxNQUNBLGNBQ0UscUJBQ0EsRUFBRSxTQUFTLFNBQVMsYUFBYSxTQUFTLEdBRzFDLGNBQWMsVUFBVSxFQUFFLEtBQUssU0FBUyxRQUFRLFFBQVEsTUFBTSxNQUFNLFNBQVMsQ0FBQyxDQUNoRixHQUNBLFFBQVEsS0FBSyxjQUFjLGlCQUFpQixFQUFFLFNBQVMsUUFBUSxRQUFRLENBQUMsSUFBSSxJQUM5RTtBQUFBOyIsCiAgImRlYnVnSWQiOiAiRDk0MUZBQkNFQzVBNEY0ODY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
