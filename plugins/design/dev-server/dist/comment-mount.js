// canvas-comment-mount.tsx
import {
  createElement,
  useEffect as useEffect6,
  useMemo as useMemo5,
  useRef as useRef4,
  useState as useState5
} from "react";
import { createRoot } from "react-dom/client";

// comments-overlay.tsx
import { useCallback as useCallback3, useEffect as useEffect3, useMemo as useMemo3, useRef as useRef3, useState as useState3 } from "react";

// use-collab.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import { readSyncMessage, writeSyncStep1, writeUpdate } from "y-protocols/sync";
import * as Y from "yjs";
import { jsx } from "react/jsx-runtime";
var CollabContext = createContext(null);
function useCollab() {
  return useContext(CollabContext);
}

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
function deriveFile() {
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
function screenRectFor(selector) {
  if (!selector)
    return null;
  let el = null;
  try {
    el = document.querySelector(selector);
  } catch {
    return null;
  }
  if (!el || !el.isConnected)
    return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0)
    return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
function CommentsOverlay() {
  ensureOverlayStyles();
  const selSet = useSelectionSetOptional();
  const [comments, setComments] = useState3([]);
  const [focusedId, setFocusedId] = useState3(null);
  const [composer, setComposer] = useState3(null);
  const file = useMemo3(() => deriveFile(), []);
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
    if (!comment || !comment.selector) {
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
      if (!detail || !detail.selection)
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
    all.forEach((c, i) => m.set(c.id, i + 1));
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
          onClick: handlePinClick
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
function CommentPin({
  comment,
  sequence,
  focused,
  onClick
}) {
  const ref = useRef3(null);
  const rafRef = useRef3(null);
  useEffect3(() => {
    const tick = () => {
      rafRef.current = null;
      const pin = ref.current;
      if (!pin)
        return;
      let pos = screenRectFor(comment.selector);
      if (!pos && comment.bounds) {
        pos = {
          x: comment.bounds.x,
          y: comment.bounds.y,
          w: comment.bounds.w,
          h: comment.bounds.h
        };
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
  }, [comment.selector, comment.bounds]);
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
      node.style.left = `${Math.round(anchor.x)}px`;
      node.style.top = `${Math.round(anchor.y)}px`;
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
      node.style.left = `${Math.round(anchor.x)}px`;
      node.style.top = `${Math.round(anchor.y)}px`;
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
  const rect = comment.selector ? screenRectFor(comment.selector) : null;
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
    const rect = screenRectFor(state.selection.selector);
    if (rect) {
      return { x: rect.x, y: rect.y + rect.h + 8 };
    }
  }
  return { x: 16, y: 16 };
}

// dom-selection.ts
function deriveFile2() {
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
function hoverTargetToSelection(target, file) {
  const el = target.el;
  const rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  const cdId = target.cdId;
  const selector = cdId ? `[data-cd-id="${cdId}"]` : !cdId && target.artboardId ? `[data-dc-screen="${target.artboardId}"]` : cssPath(el);
  return {
    file: file ?? deriveFile2(),
    id: cdId ?? undefined,
    selector,
    artboardId: target.artboardId,
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
    html: el ? (el.outerHTML ?? "").slice(0, 4000) : ""
  };
}

// input-router.tsx
import { useEffect as useEffect4 } from "react";
var ANNOTATION_TOOLS = new Set(["pen", "rect", "ellipse", "arrow", "eraser"]);
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
    if (k === "r")
      return { kind: "tool", tool: "rect" };
    if (k === "o")
      return { kind: "tool", tool: "ellipse" };
    if (k === "a")
      return { kind: "tool", tool: "arrow" };
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
  return false;
}
function isOverlayTarget(t) {
  if (!t || !t.closest)
    return false;
  return !!t.closest(".cm-composer, .cm-thread, .cm-mention-popup, .cm-pin");
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

// use-tool-mode.tsx
import {
  createContext as createContext3,
  useCallback as useCallback4,
  useContext as useContext3,
  useEffect as useEffect5,
  useMemo as useMemo4,
  useState as useState4
} from "react";
import { jsx as jsx4, Fragment as Fragment2 } from "react/jsx-runtime";
var DEFAULT_TOOLS = Object.freeze([
  { id: "move", label: "Move", shortcut: "V", cursor: "default" },
  { id: "hand", label: "Hand", shortcut: "H", cursor: "grab" },
  { id: "comment", label: "Comment", shortcut: "C", cursor: "crosshair" },
  { id: "pen", label: "Pen", shortcut: "B", cursor: "crosshair" },
  { id: "rect", label: "Rect", shortcut: "R", cursor: "crosshair" },
  { id: "ellipse", label: "Ellipse", shortcut: "O", cursor: "crosshair" },
  { id: "arrow", label: "Arrow", shortcut: "A", cursor: "crosshair" },
  { id: "eraser", label: "Eraser", shortcut: "E", cursor: "cell" }
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
  useEffect5(() => {
    if (typeof document === "undefined")
      return;
    const desc = tools.find((t) => t.id === tool);
    if (!desc)
      return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = desc.cursor;
    return () => {
      document.body.style.cursor = prev;
    };
  }, [tool, tools]);
  const value = useMemo4(() => ({ tool, setTool, tools, sticky, toggleSticky, clearSticky }), [tool, setTool, tools, sticky, toggleSticky, clearSticky]);
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

// canvas-comment-mount.tsx
import { jsx as jsx5, jsxs as jsxs2 } from "react/jsx-runtime";
var MC_CURSOR_CSS = `
[data-mc-host][data-active-tool="comment"] *,
body[data-active-tool="comment"] * {
  cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><path d='M3 3 L14 3 L14 11 L8 11 L4 14 L4 11 L3 11 Z' fill='white' stroke='%23111' stroke-width='1' stroke-linejoin='round'/></svg>") 4 4, crosshair !important;
}
`.trim();
function ensureMountCursorStyles() {
  if (typeof document === "undefined")
    return;
  if (document.getElementById("mc-cursor-css"))
    return;
  const s = document.createElement("style");
  s.id = "mc-cursor-css";
  s.textContent = MC_CURSOR_CSS;
  document.head.appendChild(s);
}
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
  if (hit.closest(".cm-composer, .cm-thread, .cm-mention-popup, .cm-pin, [data-mc-hover-halo]")) {
    return null;
  }
  const tag = hit.tagName;
  if (tag === "HTML" || tag === "BODY")
    return null;
  return hit;
}
function CommentHost({ children, file }) {
  ensureMountCursorStyles();
  const { tool, setTool } = useToolMode();
  const selSet = useSelectionSet();
  const hostRef = useRef4(null);
  const [hoverEl, setHoverEl] = useState5(null);
  const toolRef = useRef4(tool);
  toolRef.current = tool;
  const getActiveTool = useMemo5(() => () => toolRef.current, []);
  useEffect6(() => {
    if (tool !== "comment")
      setHoverEl(null);
  }, [tool]);
  useEffect6(() => {
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
  useEffect6(() => {
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
      hoverEl ? /* @__PURE__ */ jsx5(MountHoverHalo, {
        el: hoverEl
      }) : null,
      /* @__PURE__ */ jsx5(CommentsOverlay, {})
    ]
  });
}
function MountHoverHalo({ el }) {
  const ref = useRef4(null);
  const targetRef = useRef4(el);
  targetRef.current = el;
  const rafRef = useRef4(null);
  useEffect6(() => {
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
  return /* @__PURE__ */ jsx5("div", {
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
function mountCanvas(Canvas, opts) {
  const root = createRoot(opts.rootEl);
  if (!opts.commentsEnabled) {
    root.render(createElement(Canvas));
    return;
  }
  const file = opts.file ?? deriveFile2();
  root.render(createElement(MaybeToolProvider, null, createElement(MaybeSelectionSetProvider, null, createElement(CommentHost, { file }, createElement(Canvas)))));
}
export {
  mountCanvas
};

//# debugId=2B62ACB5DD8A35A164756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vY2FudmFzLWNvbW1lbnQtbW91bnQudHN4IiwgIi4uL2NvbW1lbnRzLW92ZXJsYXkudHN4IiwgIi4uL3VzZS1jb2xsYWIudHN4IiwgIi4uL3VzZS1zZWxlY3Rpb24tc2V0LnRzeCIsICIuLi9kb20tc2VsZWN0aW9uLnRzIiwgIi4uL2lucHV0LXJvdXRlci50c3giLCAiLi4vdXNlLXRvb2wtbW9kZS50c3giXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiLyoqXG4gKiBAZmlsZSAgICAgICBjYW52YXMtY29tbWVudC1tb3VudC50c3gg4oCUIHNoZWxsLW93bmVkIGNvbW1lbnQgbGF5ZXIgKyBtb3VudENhbnZhc1xuICogQHNjb3BlICAgICAgcGx1Z2lucy9kZXNpZ24vZGV2LXNlcnZlci9jYW52YXMtY29tbWVudC1tb3VudC50c3hcbiAqIEBwdXJwb3NlICAgIFRoZSBjYW52YXMgbW91bnQgaGFybmVzcyAoYF9zaGVsbC5odG1sYCkgY2FsbHMgYG1vdW50Q2FudmFzYFxuICogICAgICAgICAgICAgaW5zdGVhZCBvZiByZW5kZXJpbmcgdGhlIGNhbnZhcyBkZWZhdWx0LWV4cG9ydCByYXcuIG1vdW50Q2FudmFzXG4gKiAgICAgICAgICAgICB3cmFwcyBBTlkgZGVmYXVsdCBleHBvcnQg4oCUIGEgYERlc2lnbkNhbnZhc2AgVUkgY2FudmFzIE9SIGEgYmFyZVxuICogICAgICAgICAgICAgRFMgc3BlY2ltZW4g4oCUIGluIGEgTElURSBjb21tZW50IHByb3ZpZGVyIHRyZWUgc28gdGhlIGluLXBsYWNlXG4gKiAgICAgICAgICAgICBjb21tZW50IHRvb2wgd29ya3Mgb24gZXZlcnkgbW91bnRlZCBzdXJmYWNlLlxuICpcbiAqIFdoeSBhIHNpbmdsZSBzaGVsbC1vd25lZCBsYXllciAoRERSIOKAlCBzZWUgcGxhbiDCp1wiS2V5IGRlY2lzaW9uXCIpOlxuICogICAtIENvbW1lbnRzIHVzZWQgdG8gYmUgbW91bnRlZCBvbmx5IGJ5IGBEZXNpZ25DYW52YXNgIChUb29sUHJvdmlkZXIgK1xuICogICAgIFNlbGVjdGlvblNldFByb3ZpZGVyICsgQ29tbWVudHNPdmVybGF5ICsgdGhlIG9uRHJvcENvbW1lbnQgcm91dGVyXG4gKiAgICAgYnJhbmNoKS4gQmFyZSBzcGVjaW1lbnMgKGBzeXN0ZW0vPGRzPi9wcmV2aWV3LyoudHN4YCkgbmV2ZXIgcmVuZGVyXG4gKiAgICAgRGVzaWduQ2FudmFzLCBzbyB0aGV5IGhhZCBubyBjb21tZW50IHRvb2wgYXQgYWxsLlxuICogICAtIEhvaXN0aW5nIHRoZSBjb21tZW50IHN1YnN5c3RlbSBoZXJlIG1ha2VzIGl0IHVuaXZlcnNhbC4gYERlc2lnbkNhbnZhc2BcbiAqICAgICBiZWNvbWVzIGEgQ09OU1VNRVIgb2YgdGhlIHNoZWxsLXByb3ZpZGVkIFRvb2xQcm92aWRlciAvIFNlbGVjdGlvblNldCAvXG4gKiAgICAgQ29tbWVudHNPdmVybGF5ICh2aWEgTWF5YmVUb29sUHJvdmlkZXIgLyBNYXliZVNlbGVjdGlvblNldFByb3ZpZGVyIGFuZFxuICogICAgIGJ5IGRyb3BwaW5nIGl0cyBvd24gPENvbW1lbnRzT3ZlcmxheS8+KS5cbiAqXG4gKiBDb2V4aXN0ZW5jZSB3aXRoIHRoZSBVSS1jYW52YXMgcm91dGVyOiB0aGlzIGxheWVyJ3MgaW5wdXQgcm91dGVyIGlzIGFuXG4gKiBBTkNFU1RPUiBjYXB0dXJlLWxpc3RlbmVyIG92ZXIgdGhlIGNhbnZhcy4gT24gYSBVSSBjYW52YXMsIGBDYW52YXNTaGVsbGBcbiAqIHN0aWxsIHJ1bnMgaXRzIE9XTiByb3V0ZXIgKGhvdmVyIC8gc2VsZWN0IC8gY29udGV4dC1tZW51IC8gdW5kbykuIFRvIGF2b2lkXG4gKiBzd2FsbG93aW5nIHRob3NlIGdlc3R1cmVzLCB0aGlzIHJvdXRlciBwYXNzZXMgYSBuYXJyb3cgYGNsYWltYWJsZUFjdGlvbnNgXG4gKiBhbGxvd2xpc3Qg4oCUIGBkcm9wLWNvbW1lbnRgIC8gYHRvb2xgIC8gYGVzY2FwZWAgLyBgaG92ZXJgLiBgaG92ZXJgIG5ldmVyXG4gKiBwcmV2ZW50RGVmYXVsdHMgc28gdGhlIGlubmVyIHJvdXRlcidzIGhhbG8gaXMgdW5hZmZlY3RlZDsgZXZlcnl0aGluZyBlbHNlXG4gKiAoc2VsZWN0IC8gY29udGV4dC1tZW51IC8gdW5kbykgcHJvcGFnYXRlcyB1bnRvdWNoZWQgdG8gdGhlIGlubmVyIHJvdXRlci5cbiAqL1xuXG5pbXBvcnQge1xuICB0eXBlIENvbXBvbmVudFR5cGUsXG4gIHR5cGUgUmVhY3ROb2RlLFxuICBjcmVhdGVFbGVtZW50LFxuICB1c2VFZmZlY3QsXG4gIHVzZU1lbW8sXG4gIHVzZVJlZixcbiAgdXNlU3RhdGUsXG59IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IGNyZWF0ZVJvb3QgfSBmcm9tICdyZWFjdC1kb20vY2xpZW50JztcblxuaW1wb3J0IHsgQ29tbWVudHNPdmVybGF5IH0gZnJvbSAnLi9jb21tZW50cy1vdmVybGF5LnRzeCc7XG5pbXBvcnQgeyBkZXJpdmVGaWxlLCBob3ZlclRhcmdldFRvU2VsZWN0aW9uIH0gZnJvbSAnLi9kb20tc2VsZWN0aW9uLnRzJztcbmltcG9ydCB7IHR5cGUgUm91dGVyQWN0aW9uLCByZXNvbHZlSG92ZXJUYXJnZXQsIHVzZUlucHV0Um91dGVyIH0gZnJvbSAnLi9pbnB1dC1yb3V0ZXIudHN4JztcbmltcG9ydCB7XG4gIE1heWJlU2VsZWN0aW9uU2V0UHJvdmlkZXIsXG4gIHR5cGUgU2VsZWN0aW9uLFxuICB1c2VTZWxlY3Rpb25TZXQsXG59IGZyb20gJy4vdXNlLXNlbGVjdGlvbi1zZXQudHN4JztcbmltcG9ydCB7IE1heWJlVG9vbFByb3ZpZGVyLCB1c2VUb29sTW9kZSB9IGZyb20gJy4vdXNlLXRvb2wtbW9kZS50c3gnO1xuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEN1cnNvciBDU1MgZm9yIHRoZSBnZW5lcmljIG1vdW50IGhvc3QuIGNhbnZhcy1saWIncyBIQUxPX0NTUyBrZXlzIGNvbW1lbnQtXG4vLyBtb2RlIGN1cnNvcnMgb24gYC5kYy1jYW52YXNbZGF0YS1hY3RpdmUtdG9vbF1gLCB3aGljaCBpcyBhYnNlbnQgaW4gYSBiYXJlXG4vLyBzcGVjaW1lbi4gV2UgbWlycm9yIHRoZSBjb21tZW50LXRvb2wgY3Vyc29yIGtleWVkIG9uIHRoZSBtb3VudCBob3N0J3Ncbi8vIGBkYXRhLWFjdGl2ZS10b29sYCBhdHRyaWJ1dGUgc28gdGhlIGFmZm9yZGFuY2Ugc2hpcHMgZXZlbiB3aXRoIG5vIGNhbnZhcy1saWJcbi8vIENTUyBwcmVzZW50LiBUaGUgaG9zdCBpcyBgZGlzcGxheTogY29udGVudHNgIChzbyBzcGVjaW1lbiBsYXlvdXQgaXMgYnl0ZS1cbi8vIGlkZW50aWNhbCkg4oCUIGEgYGRpc3BsYXk6Y29udGVudHNgIGJveCBjYW4ndCBwYWludCBhIGN1cnNvciwgc28gdGhlIHJ1bGVcbi8vIHRhcmdldHMgZGVzY2VuZGFudHMgb2YgdGhlIGhvc3QsIG5vdCB0aGUgaG9zdCBib3ggaXRzZWxmLlxuXG5jb25zdCBNQ19DVVJTT1JfQ1NTID0gYFxuW2RhdGEtbWMtaG9zdF1bZGF0YS1hY3RpdmUtdG9vbD1cImNvbW1lbnRcIl0gKixcbmJvZHlbZGF0YS1hY3RpdmUtdG9vbD1cImNvbW1lbnRcIl0gKiB7XG4gIGN1cnNvcjogdXJsKFwiZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsPHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxNicgdmlld0JveD0nMCAwIDE2IDE2Jz48cGF0aCBkPSdNMyAzIEwxNCAzIEwxNCAxMSBMOCAxMSBMNCAxNCBMNCAxMSBMMyAxMSBaJyBmaWxsPSd3aGl0ZScgc3Ryb2tlPSclMjMxMTEnIHN0cm9rZS13aWR0aD0nMScgc3Ryb2tlLWxpbmVqb2luPSdyb3VuZCcvPjwvc3ZnPlwiKSA0IDQsIGNyb3NzaGFpciAhaW1wb3J0YW50O1xufVxuYC50cmltKCk7XG5cbmZ1bmN0aW9uIGVuc3VyZU1vdW50Q3Vyc29yU3R5bGVzKCk6IHZvaWQge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21jLWN1cnNvci1jc3MnKSkgcmV0dXJuO1xuICBjb25zdCBzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgcy5pZCA9ICdtYy1jdXJzb3ItY3NzJztcbiAgcy50ZXh0Q29udGVudCA9IE1DX0NVUlNPUl9DU1M7XG4gIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQocyk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29tbWVudEhvc3Qg4oCUIG93bnMgdGhlIGxpdGUgY29tbWVudCBzdWJzeXN0ZW06IHRoZSBpbnB1dCByb3V0ZXIgKGNvbW1lbnQtXG4vLyBzY29wZWQpLCB0aGUgc2luZ2xlIENvbW1lbnRzT3ZlcmxheSwgdGhlIGNvbW1lbnQtbW9kZSBjdXJzb3IgYXR0cmlidXRlLCBhbmRcbi8vIHRoZSBwYXJlbnQgYGRnbjondG9vbC1zZXQnYCBsaXN0ZW5lciAoc28gdGhlIG91dGVyIG1lbnViYXIgY29tbWVudCB0b2dnbGVcbi8vIHJlYWNoZXMgdGhlIGlmcmFtZSkuXG5cbi8vIE9ubHkgdGhlc2UgYWN0aW9uIGtpbmRzIGFyZSBjbGFpbWVkIGJ5IHRoZSBtb3VudC1sYXllciByb3V0ZXI7IHRoZSByZXN0XG4vLyBwcm9wYWdhdGUgdG8gYSBVSSBjYW52YXMncyBvd24gcm91dGVyLiBgdG9vbGAgKyBgZXNjYXBlYCBhcmUgYWxzbyBoYW5kbGVkIGJ5XG4vLyB0aGUgaW5uZXIgcm91dGVyIG9uIFVJIGNhbnZhc2VzIOKAlCBpZGVtcG90ZW50IChzYW1lIHNoYXJlZCBwcm92aWRlcikuIGBob3ZlcmBcbi8vIGlzIGRpc3BhdGNoZWQgdG9vIChpdCBuZXZlciBwcmV2ZW50RGVmYXVsdHMsIHNvIHRoZSBpbm5lciByb3V0ZXIncyBvd24gaG92ZXJcbi8vIGhhbG8gb24gYSBVSSBjYW52YXMgaXMgdW5hZmZlY3RlZCkg4oCUIHdlIG9ubHkgUEFJTlQgdGhlIG1vdW50LWxheWVyIHByZXZpZXdcbi8vIGhhbG8gb24gYSBiYXJlIHNwZWNpbWVuLCB3aGVyZSB0aGVyZSBpcyBubyBpbm5lciBDYW52YXNTaGVsbCBoYWxvLlxuY29uc3QgQ09NTUVOVF9DTEFJTVM6IFJlYWRvbmx5U2V0PFJvdXRlckFjdGlvblsna2luZCddPiA9IG5ldyBTZXQ8Um91dGVyQWN0aW9uWydraW5kJ10+KFtcbiAgJ2Ryb3AtY29tbWVudCcsXG4gICd0b29sJyxcbiAgJ2VzY2FwZScsXG4gICdob3ZlcicsXG5dKTtcblxuLy8gVHJ1ZSB3aGVuIG5vIERlc2lnbkNhbnZhcy9DYW52YXNTaGVsbCBpcyBtb3VudGVkIG9uIHRoaXMgc3VyZmFjZSDigJQgaS5lLiBhXG4vLyBiYXJlIERTIHNwZWNpbWVuLiBPbiBhIFVJIGNhbnZhcyAoYC5kYy1jYW52YXNgIHByZXNlbnQpIHRoZSBpbm5lciBzaGVsbCBvd25zXG4vLyBob3Zlci1oYWxvIHBhaW50aW5nICsgYHJlc29sdmVIb3ZlclRhcmdldGAgZWxlbWVudCBhbmNob3JpbmcsIHNvIHRoZSBsaXRlXG4vLyBsYXllciBkZWZlcnMgdG8gaXQuXG5mdW5jdGlvbiBpc0JhcmVTcGVjaW1lbigpOiBib29sZWFuIHtcbiAgcmV0dXJuIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5kYy1jYW52YXMnKTtcbn1cblxuLy8gRGVlcGVzdCBub24tY2hyb21lIGVsZW1lbnQgdW5kZXIgYSBwb2ludCDigJQgdGhlIGNvbW1lbnQgYW5jaG9yIGZvciBhIGJhcmVcbi8vIHNwZWNpbWVuIChzcGVjaW1lbnMgYXJlbid0IHN0YW1wZWQgd2l0aCBgZGF0YS1jZC1pZGAgYW5kIGhhdmUgbm9cbi8vIGAuZGMtYXJ0Ym9hcmQtYm9keWAsIHNvIGByZXNvbHZlSG92ZXJUYXJnZXRgIHJldHVybnMgbnVsbCBmb3IgdGhlbSkuXG5mdW5jdGlvbiBwaWNrU3BlY2ltZW5FbChjbGllbnRYOiBudW1iZXIsIGNsaWVudFk6IG51bWJlcik6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgaGl0ID0gZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludChjbGllbnRYLCBjbGllbnRZKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghaGl0KSByZXR1cm4gbnVsbDtcbiAgLy8gTmV2ZXIgYW5jaG9yIHRvIGNvbW1lbnQgY2hyb21lIG9yIHRoZSBkb2N1bWVudCByb290LlxuICBpZiAoaGl0LmNsb3Nlc3QoJy5jbS1jb21wb3NlciwgLmNtLXRocmVhZCwgLmNtLW1lbnRpb24tcG9wdXAsIC5jbS1waW4sIFtkYXRhLW1jLWhvdmVyLWhhbG9dJykpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBjb25zdCB0YWcgPSBoaXQudGFnTmFtZTtcbiAgaWYgKHRhZyA9PT0gJ0hUTUwnIHx8IHRhZyA9PT0gJ0JPRFknKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIGhpdDtcbn1cblxuZnVuY3Rpb24gQ29tbWVudEhvc3QoeyBjaGlsZHJlbiwgZmlsZSB9OiB7IGNoaWxkcmVuOiBSZWFjdE5vZGU7IGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZCB9KSB7XG4gIGVuc3VyZU1vdW50Q3Vyc29yU3R5bGVzKCk7XG4gIGNvbnN0IHsgdG9vbCwgc2V0VG9vbCB9ID0gdXNlVG9vbE1vZGUoKTtcbiAgY29uc3Qgc2VsU2V0ID0gdXNlU2VsZWN0aW9uU2V0KCk7XG4gIGNvbnN0IGhvc3RSZWYgPSB1c2VSZWY8SFRNTERpdkVsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgLy8gSG92ZXItcHJldmlldyBoYWxvIHRhcmdldCAoYmFyZSBzcGVjaW1lbnMgb25seSDigJQgc2VlIGlzQmFyZVNwZWNpbWVuKS5cbiAgY29uc3QgW2hvdmVyRWwsIHNldEhvdmVyRWxdID0gdXNlU3RhdGU8SFRNTEVsZW1lbnQgfCBudWxsPihudWxsKTtcblxuICAvLyBMYXRlc3QgdG9vbCBmb3IgdGhlIHJvdXRlciAocmVhZCBhdCBldmVudCB0aW1lLCBub3QgY2FwdHVyZWQpLlxuICBjb25zdCB0b29sUmVmID0gdXNlUmVmKHRvb2wpO1xuICB0b29sUmVmLmN1cnJlbnQgPSB0b29sO1xuICBjb25zdCBnZXRBY3RpdmVUb29sID0gdXNlTWVtbygoKSA9PiAoKSA9PiB0b29sUmVmLmN1cnJlbnQsIFtdKTtcblxuICAvLyBEcm9wIHRoZSBwcmV2aWV3IGhhbG8gd2hlbmV2ZXIgd2UgbGVhdmUgY29tbWVudCBtb2RlLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh0b29sICE9PSAnY29tbWVudCcpIHNldEhvdmVyRWwobnVsbCk7XG4gIH0sIFt0b29sXSk7XG5cbiAgLy8gUmVmbGVjdCB0aGUgYWN0aXZlIHRvb2wgb250byB0aGUgaG9zdCAoYW5kIGJvZHksIHNpbmNlIHRoZSBob3N0IGlzXG4gIC8vIGRpc3BsYXk6Y29udGVudHMgYW5kIGNhbid0IGNhcnJ5IGEgcGFpbnRhYmxlIGN1cnNvcikuIENvbW1lbnQtbW9kZSBDU1NcbiAgLy8ga2V5cyBvZmYgYFtkYXRhLWFjdGl2ZS10b29sPVwiY29tbWVudFwiXWAuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaG9zdCA9IGhvc3RSZWYuY3VycmVudDtcbiAgICBpZiAoaG9zdCkgaG9zdC5zZXRBdHRyaWJ1dGUoJ2RhdGEtYWN0aXZlLXRvb2wnLCB0b29sKTtcbiAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudC5ib2R5KSB7XG4gICAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnZGF0YS1hY3RpdmUtdG9vbCcsIHRvb2wpO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaG9zdD8ucmVtb3ZlQXR0cmlidXRlKCdkYXRhLWFjdGl2ZS10b29sJyk7XG4gICAgfTtcbiAgfSwgW3Rvb2xdKTtcblxuICAvLyBQYXJlbnQgYGRnbjondG9vbC1zZXQnYCDigJQgdGhlIG91dGVyIGRldi1zZXJ2ZXIgbWVudWJhciBwb3N0cyB0aGlzIHdoZW4gdGhlXG4gIC8vIHVzZXIgdG9nZ2xlcyB0aGUgY29tbWVudCB0b29sLiBNaXJyb3JzIGNhbnZhcy1zaGVsbCdzIGxpc3RlbmVyIHNvIHRoZVxuICAvLyB0b2dnbGUgcmVhY2hlcyBiYXJlIHNwZWNpbWVucyB0b28gKHdoaWNoIGhhdmUgbm8gaW5uZXIgc2hlbGwgbGlzdGVuZXIpLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICAgIGNvbnN0IG9uTWVzc2FnZSA9IChlOiBNZXNzYWdlRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IG0gPSBlLmRhdGEgYXMgeyBkZ24/OiBzdHJpbmc7IHRvb2w/OiBzdHJpbmcgfSB8IG51bGw7XG4gICAgICBpZiAoIW0gfHwgdHlwZW9mIG0gIT09ICdvYmplY3QnIHx8IG0uZGduICE9PSAndG9vbC1zZXQnKSByZXR1cm47XG4gICAgICBpZiAodHlwZW9mIG0udG9vbCA9PT0gJ3N0cmluZycpIHNldFRvb2wobS50b29sIGFzIG5ldmVyKTtcbiAgICB9O1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25NZXNzYWdlKTtcbiAgICByZXR1cm4gKCkgPT4gd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBvbk1lc3NhZ2UpO1xuICB9LCBbc2V0VG9vbF0pO1xuXG4gIHVzZUlucHV0Um91dGVyKHtcbiAgICBob3N0UmVmLFxuICAgIGdldEFjdGl2ZVRvb2wsXG4gICAgY2xhaW1hYmxlQWN0aW9uczogQ09NTUVOVF9DTEFJTVMsXG4gICAgY2FsbGJhY2tzOiB7XG4gICAgICBvbkhvdmVyOiAoeyBjbGllbnRYLCBjbGllbnRZIH0pID0+IHtcbiAgICAgICAgLy8gUGFpbnQgYSBwcmV2aWV3IGhhbG8gb25seSBvbiBiYXJlIHNwZWNpbWVuczsgYSBVSSBjYW52YXMncyBvd25cbiAgICAgICAgLy8gQ2FudmFzU2hlbGwgSG92ZXJIYWxvIG93bnMgdGhlIGNvbW1lbnQtbW9kZSBwcmV2aWV3IHRoZXJlLlxuICAgICAgICBpZiAodG9vbFJlZi5jdXJyZW50ICE9PSAnY29tbWVudCcgfHwgIWlzQmFyZVNwZWNpbWVuKCkpIHtcbiAgICAgICAgICBzZXRIb3ZlckVsKG51bGwpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBlbCA9IHBpY2tTcGVjaW1lbkVsKGNsaWVudFgsIGNsaWVudFkpO1xuICAgICAgICBzZXRIb3ZlckVsKChwcmV2KSA9PiAocHJldiA9PT0gZWwgPyBwcmV2IDogZWwpKTtcbiAgICAgIH0sXG4gICAgICBvblRvb2w6ICh7IHRvb2w6IHQgfSkgPT4gc2V0VG9vbCh0KSxcbiAgICAgIG9uRXNjYXBlOiAoKSA9PiB7XG4gICAgICAgIGlmICh0b29sUmVmLmN1cnJlbnQgIT09ICdtb3ZlJykgc2V0VG9vbCgnbW92ZScpO1xuICAgICAgICBzZXRIb3ZlckVsKG51bGwpO1xuICAgICAgICBzZWxTZXQuY2xlYXIoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyBkZ246ICdmb3JjZS1jbGVhcicgfSwgJyonKTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8qIHBhcmVudCBkZXRhY2hlZCAqL1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIG9uRHJvcENvbW1lbnQ6ICh7IGNsaWVudFgsIGNsaWVudFkgfSkgPT4gZHJvcENvbW1lbnQoY2xpZW50WCwgY2xpZW50WSwgc2VsU2V0LCBmaWxlKSxcbiAgICB9LFxuICB9KTtcblxuICAvLyBgZGlzcGxheTogY29udGVudHNgIGtlZXBzIHRoZSBzcGVjaW1lbidzIG93biBmbGV4L2dyaWQgbGF5b3V0IGJ5dGUtXG4gIC8vIGlkZW50aWNhbCDigJQgdGhlIGhvc3QgYm94IGNvbnRyaWJ1dGVzIG5vdGhpbmcgdG8gbGF5b3V0LiBUaGUgZml4ZWQtcG9zaXRpb25cbiAgLy8gQ29tbWVudHNPdmVybGF5IHJlbmRlcnMgZmluZSBhcyBhIGNoaWxkIHJlZ2FyZGxlc3MuXG4gIHJldHVybiAoXG4gICAgPGRpdiBkYXRhLW1jLWhvc3QgcmVmPXtob3N0UmVmfSBzdHlsZT17eyBkaXNwbGF5OiAnY29udGVudHMnIH19PlxuICAgICAge2NoaWxkcmVufVxuICAgICAge2hvdmVyRWwgPyA8TW91bnRIb3ZlckhhbG8gZWw9e2hvdmVyRWx9IC8+IDogbnVsbH1cbiAgICAgIDxDb21tZW50c092ZXJsYXkgLz5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBNb3VudEhvdmVySGFsbyDigJQgZml4ZWQtcG9zaXRpb24gb3V0bGluZSB0cmFja2luZyB0aGUgaG92ZXJlZCBlbGVtZW50J3Mgc2NyZWVuXG4vLyBib3VuZHMgdmlhIHJBRi4gSW5saW5lLXN0eWxlZCAobm8gZGVwZW5kZW5jeSBvbiBjYW52YXMtbGliJ3MgSEFMT19DU1MsIHdoaWNoXG4vLyBhIGJhcmUgc3BlY2ltZW4gZG9lc24ndCBsb2FkKS4gTWlycm9ycyBjYW52YXMtc2hlbGwncyBIb3ZlckhhbG8gdmlzdWFsbHkuXG5cbmZ1bmN0aW9uIE1vdW50SG92ZXJIYWxvKHsgZWwgfTogeyBlbDogSFRNTEVsZW1lbnQgfSkge1xuICBjb25zdCByZWYgPSB1c2VSZWY8SFRNTERpdkVsZW1lbnQgfCBudWxsPihudWxsKTtcbiAgY29uc3QgdGFyZ2V0UmVmID0gdXNlUmVmPEhUTUxFbGVtZW50PihlbCk7XG4gIHRhcmdldFJlZi5jdXJyZW50ID0gZWw7XG4gIGNvbnN0IHJhZlJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHRpY2sgPSAoKSA9PiB7XG4gICAgICByYWZSZWYuY3VycmVudCA9IG51bGw7XG4gICAgICBjb25zdCBkaXYgPSByZWYuY3VycmVudDtcbiAgICAgIGNvbnN0IHQgPSB0YXJnZXRSZWYuY3VycmVudDtcbiAgICAgIGlmIChkaXYgJiYgdD8uaXNDb25uZWN0ZWQpIHtcbiAgICAgICAgY29uc3QgciA9IHQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGlmIChyLndpZHRoID09PSAwICYmIHIuaGVpZ2h0ID09PSAwKSB7XG4gICAgICAgICAgZGl2LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGl2LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgIGRpdi5zdHlsZS5sZWZ0ID0gYCR7TWF0aC5yb3VuZChyLmxlZnQpfXB4YDtcbiAgICAgICAgICBkaXYuc3R5bGUudG9wID0gYCR7TWF0aC5yb3VuZChyLnRvcCl9cHhgO1xuICAgICAgICAgIGRpdi5zdHlsZS53aWR0aCA9IGAke01hdGgucm91bmQoci53aWR0aCl9cHhgO1xuICAgICAgICAgIGRpdi5zdHlsZS5oZWlnaHQgPSBgJHtNYXRoLnJvdW5kKHIuaGVpZ2h0KX1weGA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZGl2KSB7XG4gICAgICAgIGRpdi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgfVxuICAgICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgfTtcbiAgICByYWZSZWYuY3VycmVudCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKHJhZlJlZi5jdXJyZW50ICE9IG51bGwpIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHJhZlJlZi5jdXJyZW50KTtcbiAgICB9O1xuICB9LCBbXSk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICByZWY9e3JlZn1cbiAgICAgIGFyaWEtaGlkZGVuPVwidHJ1ZVwiXG4gICAgICBkYXRhLW1jLWhvdmVyLWhhbG89XCJcIlxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgIGRpc3BsYXk6ICdub25lJyxcbiAgICAgICAgcG9pbnRlckV2ZW50czogJ25vbmUnLFxuICAgICAgICB6SW5kZXg6IDIxNDc0ODM2NDYsXG4gICAgICAgIGJvcmRlcjogJzJweCBzb2xpZCB2YXIoLS1tYXVkZS1odWQtYWNjZW50LCAjZDYzYjFmKScsXG4gICAgICAgIGJvcmRlclJhZGl1czogJzNweCcsXG4gICAgICAgIGJveFNpemluZzogJ2JvcmRlci1ib3gnLFxuICAgICAgfX1cbiAgICAvPlxuICApO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIENvbW1lbnQgZHJvcCDigJQgZ2VuZXJpYyBwYXRoIGxpZnRlZCBmcm9tIGNhbnZhcy1zaGVsbCdzIG9uRHJvcENvbW1lbnQuIFdvcmtzXG4vLyB3aXRoIG9yIHdpdGhvdXQgYXJ0Ym9hcmRzOiBkZWVwL3NoYWxsb3cgcmVzb2x2ZUhvdmVyVGFyZ2V0IOKGkiBlbGVtZW50c0Zyb21Qb2ludFxuLy8gZGF0YS1jZC1pZCBjbGltYiDihpIgZmxvYXRpbmcgZmFsbGJhY2suIERpc3BhdGNoZXMgYGNtOm9wZW4tY29tcG9zZXJgIGZvciB0aGVcbi8vIGluLWlmcmFtZSBvdmVybGF5ICsgcG9zdHMgYGNvbW1lbnQtY29tcG9zZWAgdG8gdGhlIHBhcmVudCBmb3IgbGVnYWN5IG1vY2tzLlxuXG5mdW5jdGlvbiBkcm9wQ29tbWVudChcbiAgY2xpZW50WDogbnVtYmVyLFxuICBjbGllbnRZOiBudW1iZXIsXG4gIHNlbFNldDogeyByZXBsYWNlOiAoczogU2VsZWN0aW9uKSA9PiB2b2lkIH0sXG4gIGZpbGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGxldCB0YXJnZXQgPSByZXNvbHZlSG92ZXJUYXJnZXQoZG9jdW1lbnQsIGNsaWVudFgsIGNsaWVudFksIHsgZGVlcDogdHJ1ZSB9KTtcbiAgaWYgKCF0YXJnZXQpIHRhcmdldCA9IHJlc29sdmVIb3ZlclRhcmdldChkb2N1bWVudCwgY2xpZW50WCwgY2xpZW50WSwgeyBkZWVwOiBmYWxzZSB9KTtcbiAgLy8gVUktY2FudmFzIHJlY292ZXJ5IOKAlCB3aGVuIGJvdGggcGFzc2VzIGJhaWwgb24gYSBgcG9pbnRlci1ldmVudHM6IG5vbmVgXG4gIC8vIGRlY29yYXRpb24sIGVudW1lcmF0ZSB0aGUgc3RhY2sgYW5kIGNsaW1iIHRoZSBmaXJzdCBgZGF0YS1jZC1pZGAgYW5jZXN0b3JcbiAgLy8gaW5zaWRlIGFuIGFydGJvYXJkIGJvZHkuIFNraXBwZWQgb24gYmFyZSBzcGVjaW1lbnMsIHdoaWNoIGluc3RlYWQgYW5jaG9yIHRvXG4gIC8vIHRoZSBleGFjdCBob3ZlcmVkIGVsZW1lbnQgYmVsb3cgKHNvIHRoZSBwaW4gbWF0Y2hlcyB0aGUgaG92ZXIgcHJldmlldyBoYWxvKS5cbiAgaWYgKCF0YXJnZXQgJiYgIWlzQmFyZVNwZWNpbWVuKCkgJiYgdHlwZW9mIGRvY3VtZW50LmVsZW1lbnRzRnJvbVBvaW50ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3Qgc3RhY2sgPSBkb2N1bWVudC5lbGVtZW50c0Zyb21Qb2ludChjbGllbnRYLCBjbGllbnRZKTtcbiAgICBmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBzdGFjaykge1xuICAgICAgY29uc3Qgc3RhbXBlZCA9IChjYW5kaWRhdGUgYXMgRWxlbWVudCkuY2xvc2VzdD8uKCdbZGF0YS1jZC1pZF0nKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICBpZiAoIXN0YW1wZWQpIGNvbnRpbnVlO1xuICAgICAgaWYgKCFzdGFtcGVkLmNsb3Nlc3QoJy5kYy1hcnRib2FyZC1ib2R5JykpIGNvbnRpbnVlO1xuICAgICAgY29uc3QgYXJ0Ym9hcmRFbCA9IHN0YW1wZWQuY2xvc2VzdCgnW2RhdGEtZGMtc2NyZWVuXScpO1xuICAgICAgdGFyZ2V0ID0ge1xuICAgICAgICBlbDogc3RhbXBlZCxcbiAgICAgICAgY2RJZDogc3RhbXBlZC5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2QtaWQnKSxcbiAgICAgICAgYXJ0Ym9hcmRJZDogYXJ0Ym9hcmRFbD8uZ2V0QXR0cmlidXRlKCdkYXRhLWRjLXNjcmVlbicpID8/IG51bGwsXG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gQmFyZS1zcGVjaW1lbiBhbmNob3Ig4oCUIHNwZWNpbWVucyBoYXZlIG5vIGAuZGMtYXJ0Ym9hcmQtYm9keWAsIHNvXG4gIC8vIHJlc29sdmVIb3ZlclRhcmdldCBiYWlscy4gQW5jaG9yIHRvIHRoZSBFWEFDVCBlbGVtZW50IHVuZGVyIHRoZSBjdXJzb3IgKHRoZVxuICAvLyBzYW1lIG9uZSBwaWNrU3BlY2ltZW5FbCBoaWdobGlnaHRzIGZvciB0aGUgaG92ZXIgcHJldmlldyksIHZpYSBpdHMgb3duXG4gIC8vIGRhdGEtY2QtaWQgd2hlbiBzdGFtcGVkLCBlbHNlIGEgY3NzUGF0aCBzZWxlY3RvciDigJQgc28gdGhlIGRyb3BwZWQgcGluIGxhbmRzXG4gIC8vIG9uIHRoZSBwcmV2aWV3ZWQgZWxlbWVudCBpbnN0ZWFkIG9mIGZsb2F0aW5nLlxuICBpZiAoIXRhcmdldCAmJiBpc0JhcmVTcGVjaW1lbigpKSB7XG4gICAgY29uc3QgZWwgPSBwaWNrU3BlY2ltZW5FbChjbGllbnRYLCBjbGllbnRZKTtcbiAgICBpZiAoZWwpIHRhcmdldCA9IHsgZWwsIGNkSWQ6IGVsLmdldEF0dHJpYnV0ZSgnZGF0YS1jZC1pZCcpLCBhcnRib2FyZElkOiBudWxsIH07XG4gIH1cblxuICBpZiAoIXRhcmdldCkge1xuICAgIC8vIEZsb2F0aW5nIGNvbW1lbnQg4oCUIG5vIGVsZW1lbnQgYW5jaG9yLCBqdXN0IHRoZSBjbGljayBwb2ludCAoZS5nLiBhIGNsaWNrXG4gICAgLy8gb24gZW1wdHkgY2FudmFzL3NwZWNpbWVuIGRlYWQgc3BhY2UpLiBUaGUgb3ZlcmxheSByZW5kZXJzIGEgcGluIGF0IHRoZVxuICAgIC8vIHN0b3JlZCBib3VuZHMuXG4gICAgY29uc3QgZmxvYXRpbmdTZWw6IFNlbGVjdGlvbiA9IHtcbiAgICAgIGZpbGUsXG4gICAgICBpZDogdW5kZWZpbmVkLFxuICAgICAgc2VsZWN0b3I6ICcnLFxuICAgICAgYXJ0Ym9hcmRJZDogbnVsbCxcbiAgICAgIHRhZzogJycsXG4gICAgICBjbGFzc2VzOiAnJyxcbiAgICAgIHRleHQ6ICcnLFxuICAgICAgZG9tX3BhdGg6IFtdLFxuICAgICAgYm91bmRzOiB7IHg6IGNsaWVudFggLSAxMiwgeTogY2xpZW50WSAtIDEyLCB3OiAyNCwgaDogMjQgfSxcbiAgICAgIGh0bWw6ICcnLFxuICAgIH07XG4gICAgb3BlbkNvbXBvc2VyKGZsb2F0aW5nU2VsLCBjbGllbnRYLCBjbGllbnRZKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBzZWwgPSBob3ZlclRhcmdldFRvU2VsZWN0aW9uKHRhcmdldCwgZmlsZSk7XG4gIHNlbFNldC5yZXBsYWNlKHNlbCk7XG4gIG9wZW5Db21wb3NlcihzZWwsIGNsaWVudFgsIGNsaWVudFkpO1xufVxuXG5mdW5jdGlvbiBvcGVuQ29tcG9zZXIoc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGNsaWVudFg6IG51bWJlciwgY2xpZW50WTogbnVtYmVyKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoXG4gICAgICAgIG5ldyBDdXN0b21FdmVudCgnY206b3Blbi1jb21wb3NlcicsIHsgZGV0YWlsOiB7IHNlbGVjdGlvbiwgY2xpZW50WCwgY2xpZW50WSB9IH0pXG4gICAgICApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLyogQ3VzdG9tRXZlbnQgYWJzZW50IOKAlCBmYWxsIHRocm91Z2ggdG8gcGFyZW50IHBhdGggKi9cbiAgICB9XG4gIH1cbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdHJ5IHtcbiAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyBkZ246ICdjb21tZW50LWNvbXBvc2UnLCBzZWxlY3Rpb24gfSwgJyonKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIHBhcmVudCBkZXRhY2hlZCAqL1xuICAgIH1cbiAgfVxufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIG1vdW50Q2FudmFzIOKAlCB0aGUgc2hlbGwgaGFybmVzcyBlbnRyeS4gUmVuZGVycyB0aGUgY2FudmFzIHdyYXBwZWQgaW4gdGhlIGxpdGVcbi8vIGNvbW1lbnQgdHJlZSwgb3IgYmFyZSB3aGVuIGNvbW1lbnRzIGFyZSBkaXNhYmxlZCAoZ2FsbGVyeSB0aHVtYm5haWxzIHBhc3Ncbi8vIGBjb21tZW50c0VuYWJsZWQ6IGZhbHNlYCB2aWEgYD9jb21tZW50cz0wYCkuXG5cbmV4cG9ydCBpbnRlcmZhY2UgTW91bnRDYW52YXNPcHRpb25zIHtcbiAgcm9vdEVsOiBIVE1MRWxlbWVudDtcbiAgLyoqIENhbnZhcyBmaWxlIGtleSAoZGVzaWduUmVsLXByZWZpeGVkKS4gRGVmYXVsdHMgdG8gYGRlcml2ZUZpbGUoKWAuICovXG4gIGZpbGU/OiBzdHJpbmc7XG4gIC8qKiBXaGVuIGZhbHNlLCB0aGUgY29tbWVudCBsYXllciBpcyBza2lwcGVkIOKAlCB0aGUgY2FudmFzIHJlbmRlcnMgcmF3LiAqL1xuICBjb21tZW50c0VuYWJsZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtb3VudENhbnZhcyhDYW52YXM6IENvbXBvbmVudFR5cGUsIG9wdHM6IE1vdW50Q2FudmFzT3B0aW9ucyk6IHZvaWQge1xuICBjb25zdCByb290ID0gY3JlYXRlUm9vdChvcHRzLnJvb3RFbCk7XG4gIGlmICghb3B0cy5jb21tZW50c0VuYWJsZWQpIHtcbiAgICByb290LnJlbmRlcihjcmVhdGVFbGVtZW50KENhbnZhcykpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBmaWxlID0gb3B0cy5maWxlID8/IGRlcml2ZUZpbGUoKTtcbiAgcm9vdC5yZW5kZXIoXG4gICAgY3JlYXRlRWxlbWVudChcbiAgICAgIE1heWJlVG9vbFByb3ZpZGVyLFxuICAgICAgbnVsbCxcbiAgICAgIGNyZWF0ZUVsZW1lbnQoXG4gICAgICAgIE1heWJlU2VsZWN0aW9uU2V0UHJvdmlkZXIsXG4gICAgICAgIG51bGwsXG4gICAgICAgIGNyZWF0ZUVsZW1lbnQoQ29tbWVudEhvc3QsIHsgZmlsZSB9LCBjcmVhdGVFbGVtZW50KENhbnZhcykpXG4gICAgICApXG4gICAgKVxuICApO1xufVxuIiwKICAgICIvKipcbiAqIEBmaWxlICAgICAgIGNvbW1lbnRzLW92ZXJsYXkudHN4IOKAlCBGaWdKYW0tc3R5bGUgaW4tcGxhY2UgY29tbWVudHMgb3ZlcmxheVxuICogQHNjb3BlICAgICAgcGx1Z2lucy9kZXNpZ24vZGV2LXNlcnZlci9jb21tZW50cy1vdmVybGF5LnRzeFxuICogQHB1cnBvc2UgICAgUmVuZGVycyBEUy1zdHlsZWQgY29tbWVudCBwaW5zIChQaGFzZSA2IFRhc2sgMiksIHRoZSBpbi1wbGFjZVxuICogICAgICAgICAgICAgY29tcG9zZXIgYnViYmxlIChUYXNrIDMpLCBhbmQgdGhlIHRocmVhZCBwb3BvdmVyIChUYXNrIDQpXG4gKiAgICAgICAgICAgICBpbnNpZGUgdGhlIGNhbnZhcyBpZnJhbWUuIFNpYmxpbmcgdG8gYGFubm90YXRpb25zLWxheWVyYCDigJRcbiAqICAgICAgICAgICAgIHBvcnRhbHMgaW50byBgLmRjLXdvcmxkYCBzbyBDU1Mgem9vbSArIHRyYW5zbGF0ZSBvbiB0aGUgd29ybGRcbiAqICAgICAgICAgICAgIHBsYW5lIHNjYWxlIGV2ZXJ5IHBpbi9wb3BvdmVyIHVuaWZvcm1seSB3aXRoIHRoZSBhcnRib2FyZHMuXG4gKlxuICogRGF0YSBmbG93IChQaGFzZSA2IFRhc2sgMiDigJQgcGlucyBvbmx5OyBjb21wb3NlciArIHRocmVhZCBsYW5kIGluIFRhc2sgMy80KTpcbiAqICAgMS4gU2hlbGwgKGBjbGllbnQvYXBwLmpzeGApIHB1c2hlcyBgeyBkZ246ICdjb21tZW50cy1zZXQnLCBjb21tZW50cyB9YFxuICogICAgICBpbnRvIHRoZSBpZnJhbWUgd2hlbmV2ZXIgaXRzIGBjb21tZW50c0J5RmlsZVthY3RpdmVQYXRoXWAgY2hhbmdlcy5cbiAqICAgMi4gT3ZlcmxheSBhbHNvIGZldGNoZXMgYC9fY29tbWVudHM/ZmlsZT0uLi5gIG9uIG1vdW50IGFzIGEgc2VsZi1oZWFsIOKAlFxuICogICAgICBsZXRzIHRoZSBvdmVybGF5IHJlbmRlciBldmVuIGlmIHRoZSBzaGVsbCBoYXNuJ3QgYnJvYWRjYXN0IHlldFxuICogICAgICAocmFjZSBvbiBmaXJzdCBpZnJhbWUgbG9hZCkuXG4gKiAgIDMuIFNoZWxsIHB1c2hlcyBgeyBkZ246ICdjb21tZW50LWZvY3VzJywgaWQgfWAgd2hlbiB0aGUgdXNlciBjbGlja3MgYSByb3dcbiAqICAgICAgaW4gdGhlIGNvbW1lbnRzIHBhbmVsIOKAlCBvdmVybGF5IGhpZ2hsaWdodHMgdGhlIG1hdGNoaW5nIHBpbi5cbiAqICAgNC4gT3ZlcmxheSBwb3N0cyBgeyBkZ246ICdjb21tZW50LWNsaWNrJywgaWQgfWAgYmFjayB0byB0aGUgc2hlbGwgd2hlblxuICogICAgICB0aGUgdXNlciBjbGlja3MgYSBwaW4g4oCUIHNhbWUgY2hhbm5lbCB0aGUgbGVnYWN5IGBkZ24tcGluYCBvdmVybGF5XG4gKiAgICAgIHVzZWQ7IHRoZSBzaGVsbCBhbHJlYWR5IHJvdXRlcyBpdCB0byBgc2V0Rm9jdXNlZENvbW1lbnRJZGAuXG4gKlxuICogRmlsdGVyIHJlc3BlY3Qg4oCUIFBoYXNlIDYgVGFzayAyIGRlZmF1bHQgaXMgXCJoaWRlIHJlc29sdmVkXCIuIFRoZSBzaGVsbCB3aWxsXG4gKiBnYWluIGEgYGNvbW1lbnRzLWZpbHRlcmAgY2hhbm5lbCBpbiBUYXNrIDY7IHVudGlsIHRoZW4gdGhlIG92ZXJsYXkgYWx3YXlzXG4gKiBoaWRlcyByZXNvbHZlZCBwaW5zLiBQbGFuLWFsaWduZWQuXG4gKlxuICogUGluIHBvc2l0aW9uIG1hdGgg4oCUIHNlZSBgb2Zmc2V0V2l0aGluV29ybGRgIGJlbG93LiBXZSB3YWxrIG9mZnNldFBhcmVudCB1cFxuICogdG8gYC5kYy13b3JsZGAgdG8gZ2V0IHByZS16b29tIHdvcmxkIGNvb3JkcyBkaXJlY3RseTsgQ1NTIHpvb20gb24gdGhlIHdvcmxkXG4gKiBwbGFuZSB0aGVuIHJlbmRlcnMgdGhlIHBpbiBhdCB0aGUgcmlnaHQgc2NhbGUgd2l0aG91dCB1cyBkb2luZyB6b29tIG1hdGguXG4gKlxuICogVGhlIGxlZ2FjeSB2YW5pbGxhLUpTIGAjZGduLXBpbi1sYXllcmAgaW5qZWN0ZWQgYnkgYGluc3BlY3QudHNgIGlzIGhpZGRlblxuICogb24gbW91bnQgdG8gYXZvaWQgZG91YmxlLXBpbnMgaW5zaWRlIFRTWCBjYW52YXNlcy4gVGhlIGxlZ2FjeSBsYXllciBzdGlsbFxuICogcmVuZGVycyBmb3IgYC5odG1sYCBtb2NrcyB3aGVyZSB0aGlzIFJlYWN0IG92ZXJsYXkgbmV2ZXIgbW91bnRzLlxuICovXG5cbmltcG9ydCB7IHVzZUNhbGxiYWNrLCB1c2VFZmZlY3QsIHVzZU1lbW8sIHVzZVJlZiwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCc7XG5cbmltcG9ydCB7IHVzZUNvbGxhYiB9IGZyb20gJy4vdXNlLWNvbGxhYi50c3gnO1xuaW1wb3J0IHsgdXNlU2VsZWN0aW9uU2V0T3B0aW9uYWwgfSBmcm9tICcuL3VzZS1zZWxlY3Rpb24tc2V0LnRzeCc7XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVHlwZXMg4oCUIGtlcHQgaW4gc3luYyB3aXRoIGBDb21tZW50YCBpbiBgYXBpLnRzYC4gV2UgbWlycm9yIHRoZSBzaGFwZSByYXRoZXJcbi8vIHRoYW4gaW1wb3J0IHRvIGF2b2lkIHB1bGxpbmcgc2VydmVyIHR5cGVzIGludG8gdGhlIGNhbnZhcyBydW50aW1lIGJ1bmRsZS5cblxuaW50ZXJmYWNlIE92ZXJsYXlCb3VuZHMge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdzogbnVtYmVyO1xuICBoOiBudW1iZXI7XG59XG5cbi8vIFNlbGVjdGlvbiBwYXlsb2FkIHBvc3RlZCBieSBjYW52YXMtc2hlbGwncyBgb25Ecm9wQ29tbWVudGAuIE1pcnJvcnMgdGhlXG4vLyBzaGFwZSBgaG92ZXJUYXJnZXRUb1NlbGVjdGlvbmAgcmV0dXJuczsgd2Uga2VlcCBpdCBsb29zZSBzbyB0aGUgb3ZlcmxheVxuLy8gZG9lc24ndCBkZXBlbmQgb24gY2FudmFzLXNoZWxsIHR5cGVzLlxuaW50ZXJmYWNlIENvbXBvc2VTZWxlY3Rpb24ge1xuICBmaWxlPzogc3RyaW5nO1xuICBpZD86IHN0cmluZztcbiAgc2VsZWN0b3I6IHN0cmluZztcbiAgYXJ0Ym9hcmRJZD86IHN0cmluZyB8IG51bGw7XG4gIHRhZzogc3RyaW5nO1xuICBjbGFzc2VzOiBzdHJpbmc7XG4gIHRleHQ6IHN0cmluZztcbiAgZG9tX3BhdGg6IHN0cmluZ1tdO1xuICBib3VuZHM6IE92ZXJsYXlCb3VuZHMgfCBudWxsO1xuICBodG1sOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBDb21wb3NlclN0YXRlIHtcbiAgc2VsZWN0aW9uOiBDb21wb3NlU2VsZWN0aW9uO1xuICBjbGllbnRYOiBudW1iZXI7XG4gIGNsaWVudFk6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIE92ZXJsYXlSZXBseSB7XG4gIGlkOiBzdHJpbmc7XG4gIGF1dGhvcjogc3RyaW5nO1xuICBib2R5OiBzdHJpbmc7XG4gIGNyZWF0ZWQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPdmVybGF5Q29tbWVudCB7XG4gIGlkOiBzdHJpbmc7XG4gIGZpbGU6IHN0cmluZztcbiAgc2VsZWN0b3I6IHN0cmluZztcbiAgYm91bmRzOiBPdmVybGF5Qm91bmRzIHwgbnVsbDtcbiAgdGV4dDogc3RyaW5nO1xuICBzdGF0dXM6ICdvcGVuJyB8ICdyZXNvbHZlZCc7XG4gIGNyZWF0ZWQ6IHN0cmluZztcbiAgcmVzb2x2ZWRfYXQ6IHN0cmluZyB8IG51bGw7XG4gIGF1dGhvcj86IHN0cmluZztcbiAgdGhyZWFkPzogT3ZlcmxheVJlcGx5W107XG4gIG1lbnRpb25zPzogc3RyaW5nW107XG4gIC8vIGRvbV9wYXRoIC8gdGFnIC8gY2xhc3NlcyAvIGh0bWxfZXhjZXJwdCB1bnVzZWQgYXQgb3ZlcmxheSBsYXllcjsga2VwdCBvZmZcbiAgLy8gdGhlIHR5cGUgdG8ga2VlcCB0aGUgc3VyZmFjZSB0aWdodC5cbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBDU1MgbG9hZCDigJQgc2libGluZyBzdHlsZXNoZWV0LCBmZXRjaGVkIG9uY2UgcGVyIHNlc3Npb24gdmlhIGEgPGxpbms+IHRhZy5cbi8vIElubGluaW5nIHRoZSBmaWxlIGF0IGJ1aWxkIHRpbWUgd291bGQgY29zdCBhbiBleHRyYSBidW5kbGVyIGNvbmZpZzsgdGhlXG4vLyBvdmVybGF5IGlzIGludGVybmFsLW9ubHkgc28gYSBydW50aW1lIDxsaW5rPiBpcyBmaW5lLlxuXG5jb25zdCBDU1NfSFJFRiA9ICcvX2NsaWVudC9jb21tZW50cy1vdmVybGF5LmNzcyc7XG5cbmZ1bmN0aW9uIGVuc3VyZU92ZXJsYXlTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY20tb3ZlcmxheS1jc3MnKSkgcmV0dXJuO1xuICBjb25zdCBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpO1xuICBsaW5rLmlkID0gJ2NtLW92ZXJsYXktY3NzJztcbiAgbGluay5yZWwgPSAnc3R5bGVzaGVldCc7XG4gIGxpbmsuaHJlZiA9IENTU19IUkVGO1xuICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGxpbmspO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEZpbGUgZGVyaXZhdGlvbiDigJQgc2FtZSBsb2dpYyBhcyBjYW52YXMtc2hlbGwudHN4OjpkZXJpdmVGaWxlKCkuIER1cGxpY2F0ZWRcbi8vIGhlcmUgc28gdGhlIG92ZXJsYXkgY2FuIGZldGNoIGl0cyBvd24gY29tbWVudHMgb24gbW91bnQgd2l0aG91dCBpbXBvcnRpbmdcbi8vIGZyb20gY2FudmFzLXNoZWxsICh3aGljaCB3b3VsZCBjcmVhdGUgYSBjeWNsZSkuXG5cbmZ1bmN0aW9uIGRlcml2ZUZpbGUoKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIG51bGw7XG4gIHRyeSB7XG4gICAgY29uc3QgcCA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZTtcbiAgICBpZiAocCA9PT0gJy9fY2FudmFzLXNoZWxsLmh0bWwnIHx8IHAgPT09ICcvX2NhbnZhcy1zaGVsbCcpIHtcbiAgICAgIGNvbnN0IHFzID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbiAgICAgIGNvbnN0IGNhbnZhcyA9IHFzLmdldCgnY2FudmFzJykgPz8gJyc7XG4gICAgICBjb25zdCBkZXNpZ25SZWwgPSAocXMuZ2V0KCdkZXNpZ25SZWwnKSA/PyAnLmRlc2lnbicpLnJlcGxhY2UoL15cXC8rfFxcLyskL2csICcnKTtcbiAgICAgIHJldHVybiBjYW52YXMgPyBgJHtkZXNpZ25SZWx9LyR7Y2FudmFzfWAgOiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHApLnJlcGxhY2UoL15cXC8vLCAnJyk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUG9zaXRpb24gcmVzb2x2ZXJzIOKAlCBzY3JlZW4gY29vcmRzIHZpYSBnZXRCb3VuZGluZ0NsaWVudFJlY3QuIE1pcnJvcnMgdGhlXG4vLyBgU2VsZWN0aW9uSGFsb3NgIC8gYEhvdmVySGFsb2AgcGF0dGVybiBpbiBjYW52YXMtc2hlbGwudHN4IHNvIHRoZSBjb21tZW50c1xuLy8gbGF5ZXIgY2FuIHJlbmRlciBhcyBhIGZpeGVkLXBvc2l0aW9uIHNpYmxpbmcgb2YgYC5kYy1jYW52YXNgIChhYm92ZSB0aGVcbi8vIGhhbG8gY2hyb21lIGF0IHotaW5kZXggNSkgaW5zdGVhZCBvZiBiZWluZyBwb3J0YWxlZCBpbnRvIGAuZGMtd29ybGRgIHdoZXJlXG4vLyBpdCB3b3VsZCBsb3NlIHRoZSBzdGFja2luZyBiYXR0bGUuXG5cbmZ1bmN0aW9uIHNjcmVlblJlY3RGb3Ioc2VsZWN0b3I6IHN0cmluZyk6IHtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHc6IG51bWJlcjtcbiAgaDogbnVtYmVyO1xufSB8IG51bGwge1xuICBpZiAoIXNlbGVjdG9yKSByZXR1cm4gbnVsbDtcbiAgbGV0IGVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICB0cnkge1xuICAgIGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3RvcikgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBpZiAoIWVsIHx8ICFlbC5pc0Nvbm5lY3RlZCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHIgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgaWYgKHIud2lkdGggPT09IDAgJiYgci5oZWlnaHQgPT09IDApIHJldHVybiBudWxsO1xuICByZXR1cm4geyB4OiByLmxlZnQsIHk6IHIudG9wLCB3OiByLndpZHRoLCBoOiByLmhlaWdodCB9O1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFB1YmxpYyBjb21wb25lbnQg4oCUIG1vdW50ZWQgZnJvbSBjYW52YXMtc2hlbGwudHN4IGFsb25nc2lkZSBUb29sUGFsZXR0ZSAvXG4vLyBBbm5vdGF0aW9uc0xheWVyIC8gU25hcEd1aWRlT3ZlcmxheS5cblxuZXhwb3J0IGZ1bmN0aW9uIENvbW1lbnRzT3ZlcmxheSgpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBlbnN1cmVPdmVybGF5U3R5bGVzKCk7XG5cbiAgLy8gT3B0aW9uYWwg4oCUIENvbW1lbnRzT3ZlcmxheSBpcyBtb3VudGVkIGluc2lkZSBTZWxlY3Rpb25TZXRQcm92aWRlciBpbiB0aGVcbiAgLy8gc3RhbmRhcmQgQ2FudmFzU2hlbGwgdHJlZSwgYnV0IHN0YXlzIHVzYWJsZSBpZiBhIGhvc3QgZXZlciBlbWJlZHMgaXRcbiAgLy8gb3V0c2lkZSB0aGF0IHByb3ZpZGVyIChyZXR1cm5zIG51bGwgaW5zdGVhZCBvZiB0aHJvd2luZykuXG4gIGNvbnN0IHNlbFNldCA9IHVzZVNlbGVjdGlvblNldE9wdGlvbmFsKCk7XG4gIGNvbnN0IFtjb21tZW50cywgc2V0Q29tbWVudHNdID0gdXNlU3RhdGU8T3ZlcmxheUNvbW1lbnRbXT4oW10pO1xuICBjb25zdCBbZm9jdXNlZElkLCBzZXRGb2N1c2VkSWRdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtjb21wb3Nlciwgc2V0Q29tcG9zZXJdID0gdXNlU3RhdGU8Q29tcG9zZXJTdGF0ZSB8IG51bGw+KG51bGwpO1xuICBjb25zdCBmaWxlID0gdXNlTWVtbygoKSA9PiBkZXJpdmVGaWxlKCksIFtdKTtcblxuICAvLyBEcm9wIHRoZSBsZWdhY3kgYCNkZ24tcGluLWxheWVyYCBzbyB3ZSBkb24ndCByZW5kZXIgZHVwbGljYXRlIHBpbnMgaW5zaWRlXG4gIC8vIFRTWCBjYW52YXNlcy4gVGhlIGxheWVyIHNoaXBzIGluIGV2ZXJ5IHNlcnZlZCBIVE1MIHBhZ2UgdmlhIGluc3BlY3QudHM7XG4gIC8vIGZvciBgLmh0bWxgIG1vY2tzIChubyBjYW52YXMtc2hlbGwgbW91bnQpIGl0IHN0aWxsIGRvZXMgaXRzIGpvYi5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICAgIGNvbnN0IGxlZ2FjeSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZ24tcGluLWxheWVyJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgIGlmICghbGVnYWN5KSByZXR1cm47XG4gICAgY29uc3QgcHJldiA9IGxlZ2FjeS5zdHlsZS5kaXNwbGF5O1xuICAgIGxlZ2FjeS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBsZWdhY3kuc3R5bGUuZGlzcGxheSA9IHByZXY7XG4gICAgfTtcbiAgfSwgW10pO1xuXG4gIC8vIE1pcnJvciBhIGNvbW1lbnQgaW50byB0aGUgY2FudmFzIHNlbGVjdGlvbiBzZXQgc28gU2VsZWN0aW9uSGFsb3MgcGFpbnRzXG4gIC8vIHRoZSBzYW1lIGhhbG8gQ21kLWNsaWNrIHdvdWxkLiBDYWxsZWQgZnJvbSBib3RoIHRoZSBpbi1pZnJhbWUgcGluIGNsaWNrXG4gIC8vIEFORCB0aGUgaW5ib3VuZCBgY29tbWVudC1mb2N1c2AgcG9zdE1lc3NhZ2Ugc28ganVtcGluZyBmcm9tIHRoZSBzaGVsbCdzXG4gIC8vIENvbW1lbnRzIHBhbmVsIHByb2R1Y2VzIHRoZSBzYW1lIHZpc3VhbCBmZWVkYmFjayBhcyBjbGlja2luZyB0aGUgcGluLlxuICBjb25zdCBtaXJyb3JTZWxlY3Rpb24gPSB1c2VDYWxsYmFjayhcbiAgICAoY29tbWVudDogT3ZlcmxheUNvbW1lbnQgfCB1bmRlZmluZWQpID0+IHtcbiAgICAgIGlmICghc2VsU2V0KSByZXR1cm47XG4gICAgICBpZiAoIWNvbW1lbnQgfHwgIWNvbW1lbnQuc2VsZWN0b3IpIHtcbiAgICAgICAgc2VsU2V0LmNsZWFyKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNkTWF0Y2ggPSBjb21tZW50LnNlbGVjdG9yLm1hdGNoKC9kYXRhLWNkLWlkPVwiKFteXCJdKylcIi8pO1xuICAgICAgY29uc3QgY2RJZCA9IGNkTWF0Y2ggPyBjZE1hdGNoWzFdIDogdW5kZWZpbmVkO1xuICAgICAgbGV0IHRhZzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgbGV0IGNsYXNzZXM6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcihjb21tZW50LnNlbGVjdG9yKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICAgIGlmIChlbCkge1xuICAgICAgICAgIHRhZyA9IGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICBjbGFzc2VzID0gKGVsLmdldEF0dHJpYnV0ZSgnY2xhc3MnKSA/PyAnJylcbiAgICAgICAgICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgICAgICAgICAuZmlsdGVyKChjbHMpID0+IGNscyAmJiAhY2xzLnN0YXJ0c1dpdGgoJ2Rnbi0nKSAmJiAhY2xzLnN0YXJ0c1dpdGgoJ2RjLWN2LScpKVxuICAgICAgICAgICAgLmpvaW4oJyAnKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIHVucmVzb2x2YWJsZSBzZWxlY3RvciDigJQgZmFsbCB0aHJvdWdoIHdpdGggbm8gZnJlc2ggbWV0YWRhdGEgKi9cbiAgICAgIH1cbiAgICAgIHNlbFNldC5yZXBsYWNlKHtcbiAgICAgICAgZmlsZTogZmlsZSA/PyB1bmRlZmluZWQsXG4gICAgICAgIGlkOiBjZElkLFxuICAgICAgICBzZWxlY3RvcjogY29tbWVudC5zZWxlY3RvcixcbiAgICAgICAgdGFnLFxuICAgICAgICBjbGFzc2VzLFxuICAgICAgICBib3VuZHM6IGNvbW1lbnQuYm91bmRzID8/IHVuZGVmaW5lZCxcbiAgICAgIH0pO1xuICAgIH0sXG4gICAgW3NlbFNldCwgZmlsZV1cbiAgKTtcblxuICAvLyBLZWVwIHRoZSBsYXRlc3QgY29tbWVudHMgbGlzdCByZWFjaGFibGUgZnJvbSB0aGUgbWVzc2FnZSBoYW5kbGVyIHdpdGhvdXRcbiAgLy8gcmUtYXR0YWNoaW5nIHRoZSBsaXN0ZW5lciBvbiBldmVyeSBjb21tZW50cyBtdXRhdGlvbi5cbiAgY29uc3QgY29tbWVudHNSZWYgPSB1c2VSZWY8T3ZlcmxheUNvbW1lbnRbXT4oY29tbWVudHMpO1xuICBjb21tZW50c1JlZi5jdXJyZW50ID0gY29tbWVudHM7XG5cbiAgLy8gUGhhc2UgOCBUYXNrIDMg4oCUIHdoZW4gYSBjb2xsYWIgcm9vbSBpcyBjb25uZWN0ZWQsIHRoZSBZLkFycmF5IG9mIGNvbW1lbnRzXG4gIC8vIGlzIHRoZSBsaXZlIHNvdXJjZSBvZiB0cnV0aC4gb2JzZXJ2ZSgpIGZpcmVzIG9uIGV2ZXJ5IHJlbW90ZSBtdXRhdGlvblxuICAvLyAoYWRkZWQgcGlucyBmcm9tIGFub3RoZXIgdGFiLCByZXNvbHZlZC1mcm9tLWluc3BlY3RvciB2aWEgdGhlIHJlZ2lzdHJ5XG4gIC8vIGJyaWRnZSwgZXRjLikgYW5kIG9uIHRoZSBsb2NhbCBzZWVkLiBCb3RoIHBhdGhzIGNvbnZlcmdlIG9uIHRoZSBzYW1lXG4gIC8vIEpTT04gcHJvamVjdGlvbiDigJQgbGFzdC13cml0ZS13aW5zIGJldHdlZW4gWS5BcnJheSBhbmQgcG9zdE1lc3NhZ2UgaXNcbiAgLy8gc2FmZSBiZWNhdXNlIHRoZXkgY2FycnkgaWRlbnRpY2FsIGNvbnRlbnQ7IHRoZSBZLkFycmF5IHBhdGgganVzdFxuICAvLyByZWFjaGVzIHVzIGZpcnN0IChubyA4MDAgbXMgZGVib3VuY2UgZGVsYXkpLlxuICBjb25zdCBjb2xsYWIgPSB1c2VDb2xsYWIoKTtcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWNvbGxhYikgcmV0dXJuO1xuICAgIGNvbnN0IGFyciA9IGNvbGxhYi5kb2MuZ2V0QXJyYXk8T3ZlcmxheUNvbW1lbnQ+KCdjb21tZW50cycpO1xuICAgIGNvbnN0IHN5bmMgPSAoKSA9PiB7XG4gICAgICAvLyB0b0FycmF5KCkgc25hcHNob3QgdGhlIGN1cnJlbnQgWS5BcnJheSBpbnRvIGEgcGxhaW4gSlMgbGlzdC5cbiAgICAgIHNldENvbW1lbnRzKGFyci50b0FycmF5KCkgYXMgT3ZlcmxheUNvbW1lbnRbXSk7XG4gICAgfTtcbiAgICAvLyBJbml0aWFsIGZpbGwg4oCUIGNvdmVycyB0aGUgY2FzZSB3aGVyZSBZLkRvYyB3YXMgYWxyZWFkeSBzZWVkZWQgYnkgdGhlXG4gICAgLy8gdGltZSB0aGlzIG92ZXJsYXkgbW91bnRlZC5cbiAgICBpZiAoYXJyLmxlbmd0aCA+IDApIHN5bmMoKTtcbiAgICBhcnIub2JzZXJ2ZShzeW5jKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXJyLnVub2JzZXJ2ZShzeW5jKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvKiBkb2MgZGVzdHJveWVkIGJlZm9yZSB1bm1vdW50IOKAlCBvYnNlcnZlciBhbHJlYWR5IGdvbmUgKi9cbiAgICAgIH1cbiAgICB9O1xuICB9LCBbY29sbGFiXSk7XG5cbiAgLy8gTGlzdGVuIGZvciB0aGUgc2hlbGwncyBicm9hZGNhc3QgY2hhbm5lbHMuIFNjaGVtYSBtYXRjaGVzIHRoZSBsZWdhY3lcbiAgLy8gb3ZlcmxheSBzbyB0aGUgc2hlbGwtc2lkZSBnbHVlIGluIGNsaWVudC9hcHAuanN4ICh+bGluZSAxNjcyKSBrZWVwc1xuICAvLyB3b3JraW5nIHdpdGhvdXQgbW9kaWZpY2F0aW9uLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICAgIGNvbnN0IG9uTWVzc2FnZSA9IChlOiBNZXNzYWdlRXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IG0gPSBlLmRhdGEgYXMgeyBkZ24/OiBzdHJpbmc7IGNvbW1lbnRzPzogdW5rbm93bjsgaWQ/OiBzdHJpbmcgfSB8IG51bGw7XG4gICAgICBpZiAoIW0gfHwgdHlwZW9mIG0gIT09ICdvYmplY3QnIHx8ICFtLmRnbikgcmV0dXJuO1xuICAgICAgaWYgKG0uZGduID09PSAnY29tbWVudHMtc2V0JyAmJiBBcnJheS5pc0FycmF5KG0uY29tbWVudHMpKSB7XG4gICAgICAgIHNldENvbW1lbnRzKG0uY29tbWVudHMgYXMgT3ZlcmxheUNvbW1lbnRbXSk7XG4gICAgICB9IGVsc2UgaWYgKG0uZGduID09PSAnY29tbWVudC1mb2N1cycpIHtcbiAgICAgICAgY29uc3QgaWQgPSB0eXBlb2YgbS5pZCA9PT0gJ3N0cmluZycgPyBtLmlkIDogbnVsbDtcbiAgICAgICAgc2V0Rm9jdXNlZElkKGlkKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gaWQgPyBjb21tZW50c1JlZi5jdXJyZW50LmZpbmQoKGMpID0+IGMuaWQgPT09IGlkKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgbWlycm9yU2VsZWN0aW9uKHRhcmdldCk7XG4gICAgICB9XG4gICAgfTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIG9uTWVzc2FnZSk7XG4gICAgcmV0dXJuICgpID0+IHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgb25NZXNzYWdlKTtcbiAgfSwgW21pcnJvclNlbGVjdGlvbl0pO1xuXG4gIC8vIGNhbnZhcy1zaGVsbCdzIGBvbkRyb3BDb21tZW50YCBkaXNwYXRjaGVzIGBjbTpvcGVuLWNvbXBvc2VyYCBvbiB0aGUgaWZyYW1lXG4gIC8vIGRvY3VtZW50LiBPcGVuIHRoZSBjb21wb3NlciBwaW5uZWQgdG8gdGhhdCBjbGljayBwb2ludC5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICAgIGNvbnN0IG9uT3BlbiA9IChlOiBFdmVudCkgPT4ge1xuICAgICAgY29uc3QgZGV0YWlsID0gKFxuICAgICAgICBlIGFzIEN1c3RvbUV2ZW50PHsgc2VsZWN0aW9uPzogQ29tcG9zZVNlbGVjdGlvbjsgY2xpZW50WD86IG51bWJlcjsgY2xpZW50WT86IG51bWJlciB9PlxuICAgICAgKS5kZXRhaWw7XG4gICAgICBpZiAoIWRldGFpbCB8fCAhZGV0YWlsLnNlbGVjdGlvbikgcmV0dXJuO1xuICAgICAgc2V0Q29tcG9zZXIoe1xuICAgICAgICBzZWxlY3Rpb246IGRldGFpbC5zZWxlY3Rpb24sXG4gICAgICAgIGNsaWVudFg6IHR5cGVvZiBkZXRhaWwuY2xpZW50WCA9PT0gJ251bWJlcicgPyBkZXRhaWwuY2xpZW50WCA6IDAsXG4gICAgICAgIGNsaWVudFk6IHR5cGVvZiBkZXRhaWwuY2xpZW50WSA9PT0gJ251bWJlcicgPyBkZXRhaWwuY2xpZW50WSA6IDAsXG4gICAgICB9KTtcbiAgICB9O1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NtOm9wZW4tY29tcG9zZXInLCBvbk9wZW4pO1xuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbTpvcGVuLWNvbXBvc2VyJywgb25PcGVuKTtcbiAgfSwgW10pO1xuXG4gIGNvbnN0IGNsb3NlQ29tcG9zZXIgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgc2V0Q29tcG9zZXIobnVsbCk7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyBkZ246ICdmb3JjZS1jbGVhcicgfSwgJyonKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIHBhcmVudCBkZXRhY2hlZCAqL1xuICAgIH1cbiAgfSwgW10pO1xuXG4gIGNvbnN0IHN1Ym1pdENvbXBvc2VyID0gdXNlQ2FsbGJhY2soXG4gICAgKHRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgaWYgKCFjb21wb3NlcikgcmV0dXJuO1xuICAgICAgY29uc3Qgc2VsID0gY29tcG9zZXIuc2VsZWN0aW9uO1xuICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgZmlsZTogc2VsLmZpbGUsXG4gICAgICAgIHNlbGVjdG9yOiBzZWwuc2VsZWN0b3IsXG4gICAgICAgIGRvbV9wYXRoOiBzZWwuZG9tX3BhdGgsXG4gICAgICAgIHRhZzogc2VsLnRhZyxcbiAgICAgICAgY2xhc3Nlczogc2VsLmNsYXNzZXMsXG4gICAgICAgIGJvdW5kczogc2VsLmJvdW5kcyxcbiAgICAgICAgaHRtbF9leGNlcnB0OiBzZWwuaHRtbCxcbiAgICAgICAgdGV4dCxcbiAgICAgIH07XG4gICAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICAgIC8vIFNoZWxsIHJlbGF5cyBpbnRvIHRoZSBXUyBgY29tbWVudHMtYWRkYCBjaGFubmVsIGFuZCBwZXJzaXN0cy5cbiAgICAgIHRyeSB7XG4gICAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyBkZ246ICdjb21tZW50LXN1Ym1pdCcsIHBheWxvYWQgfSwgJyonKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvKiBwYXJlbnQgZGV0YWNoZWQgKi9cbiAgICAgIH1cbiAgICAgIGNsb3NlQ29tcG9zZXIoKTtcbiAgICB9LFxuICAgIFtjb21wb3NlciwgY2xvc2VDb21wb3Nlcl1cbiAgKTtcblxuICAvLyBTZWxmLWhlYWwgZmV0Y2gg4oCUIGNvdmVycyB0aGUgcmFjZSB3aGVyZSB0aGUgaWZyYW1lIGxvYWRzIGJlZm9yZSB0aGUgc2hlbGxcbiAgLy8gcHVzaGVzIGBjb21tZW50cy1zZXRgIChlLmcuIGZpcnN0IGh5ZHJhdGlvbiBvbiBjb2xkIG9wZW4pLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghZmlsZSkgcmV0dXJuO1xuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcbiAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgciA9IGF3YWl0IGZldGNoKGAvX2NvbW1lbnRzP2ZpbGU9JHtlbmNvZGVVUklDb21wb25lbnQoZmlsZSl9YCk7XG4gICAgICAgIGlmICghci5vaykgcmV0dXJuO1xuICAgICAgICBjb25zdCBkYXRhID0gKGF3YWl0IHIuanNvbigpKSBhcyB7IGNvbW1lbnRzPzogT3ZlcmxheUNvbW1lbnRbXSB9O1xuICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm47XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEuY29tbWVudHMpKSB7XG4gICAgICAgICAgLy8gT25seSBzZXQgd2hlbiB3ZSBoYXZlbid0IHJlY2VpdmVkIGEgc2hlbGwgYnJvYWRjYXN0IHlldDsgdGhlXG4gICAgICAgICAgLy8gc2hlbGwgaXMgYXV0aG9yaXRhdGl2ZSBvbmNlIGl0IGtpY2tzIGluLlxuICAgICAgICAgIHNldENvbW1lbnRzKChwcmV2KSA9PiAocHJldi5sZW5ndGggPT09IDAgPyAoZGF0YS5jb21tZW50cyA/PyBbXSkgOiBwcmV2KSk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvKiBvZmZsaW5lIC8gZGV2LXNlcnZlciByZXN0YXJ0IOKAlCBzaWxlbnRseSBuby1vcCAqL1xuICAgICAgfVxuICAgIH0pKCk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNhbmNlbGxlZCA9IHRydWU7XG4gICAgfTtcbiAgfSwgW2ZpbGVdKTtcblxuICAvLyBTb3J0ZWQgYnkgYGNyZWF0ZWRgIGFzYyBzbyBzZXF1ZW5jZSBudW1iZXJzIGFyZSBzdGFibGUgcGVyIGNhbnZhcyBhY3Jvc3NcbiAgLy8gcmVsb2Fkcy4gUmVzb2x2ZWQgY29tbWVudHMgYXJlIGhpZGRlbiBieSBkZWZhdWx0IChUYXNrIDIgc3BlYykuXG4gIGNvbnN0IHZpc2libGUgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBsaXN0ID0gY29tbWVudHMuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiBhLmNyZWF0ZWQubG9jYWxlQ29tcGFyZShiLmNyZWF0ZWQpKTtcbiAgICByZXR1cm4gbGlzdC5maWx0ZXIoKGMpID0+IGMuc3RhdHVzICE9PSAncmVzb2x2ZWQnKTtcbiAgfSwgW2NvbW1lbnRzXSk7XG5cbiAgLy8gU2VxdWVuY2UgaW5kZXggbG9va3VwIOKAlCBidWlsdCBvZmYgdGhlIEZVTEwgc29ydGVkIGxpc3Qgc28gYSByZXNvbHZlZC10aGVuLVxuICAvLyByZW9wZW5lZCBwaW4ga2VlcHMgaXRzIG9yaWdpbmFsIG51bWJlci5cbiAgY29uc3QgaW5kZXhCeUlkID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgbSA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgY29uc3QgYWxsID0gY29tbWVudHMuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiBhLmNyZWF0ZWQubG9jYWxlQ29tcGFyZShiLmNyZWF0ZWQpKTtcbiAgICBhbGwuZm9yRWFjaCgoYywgaSkgPT4gbS5zZXQoYy5pZCwgaSArIDEpKTtcbiAgICByZXR1cm4gbTtcbiAgfSwgW2NvbW1lbnRzXSk7XG5cbiAgY29uc3QgaGFuZGxlUGluQ2xpY2sgPSB1c2VDYWxsYmFjayhcbiAgICAoaWQ6IHN0cmluZykgPT4ge1xuICAgICAgc2V0Rm9jdXNlZElkKGlkKTtcbiAgICAgIG1pcnJvclNlbGVjdGlvbihjb21tZW50cy5maW5kKChjKSA9PiBjLmlkID09PSBpZCkpO1xuICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgICB0cnkge1xuICAgICAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKHsgZGduOiAnY29tbWVudC1jbGljaycsIGlkIH0sICcqJyk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyogcGFyZW50IGRldGFjaGVkICovXG4gICAgICB9XG4gICAgfSxcbiAgICBbY29tbWVudHMsIG1pcnJvclNlbGVjdGlvbl1cbiAgKTtcblxuICBjb25zdCBoYW5kbGVQYXRjaCA9IHVzZUNhbGxiYWNrKChpZDogc3RyaW5nLCBwYXRjaDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pID0+IHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7IGRnbjogJ2NvbW1lbnQtcGF0Y2gnLCBpZCwgcGF0Y2ggfSwgJyonKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIHBhcmVudCBkZXRhY2hlZCAqL1xuICAgIH1cbiAgfSwgW10pO1xuXG4gIGNvbnN0IGhhbmRsZURlbGV0ZSA9IHVzZUNhbGxiYWNrKChpZDogc3RyaW5nKSA9PiB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIHdpbmRvdy5wYXJlbnQucG9zdE1lc3NhZ2UoeyBkZ246ICdjb21tZW50LWRlbGV0ZScsIGlkIH0sICcqJyk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiBwYXJlbnQgZGV0YWNoZWQgKi9cbiAgICB9XG4gICAgc2V0Rm9jdXNlZElkKChwcmV2KSA9PiAocHJldiA9PT0gaWQgPyBudWxsIDogcHJldikpO1xuICB9LCBbXSk7XG5cbiAgY29uc3QgaGFuZGxlUmVwbHkgPSB1c2VDYWxsYmFjayhhc3luYyAoaWQ6IHN0cmluZywgYm9keTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gICAgaWYgKHR5cGVvZiBmZXRjaCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgciA9IGF3YWl0IGZldGNoKGAvX2FwaS9jb21tZW50cy8ke2VuY29kZVVSSUNvbXBvbmVudChpZCl9L3JlcGx5YCwge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgYm9keSB9KSxcbiAgICAgIH0pO1xuICAgICAgaWYgKCFyLm9rKSByZXR1cm4gZmFsc2U7XG4gICAgICBjb25zdCB1cGRhdGVkID0gKGF3YWl0IHIuanNvbigpKSBhcyBPdmVybGF5Q29tbWVudDtcbiAgICAgIC8vIE9wdGltaXN0aWMgbG9jYWwgbWVyZ2Ug4oCUIHRoZSBzaGVsbCB3aWxsIGJyb2FkY2FzdCBgY29tbWVudHMtc2V0YFxuICAgICAgLy8gc2hvcnRseSBhZnRlciBhcyB0aGUgV1MgZmFucyBvdXQgdGhlIGNoYW5nZSwgYnV0IGFwcGx5aW5nIGl0IG5vd1xuICAgICAgLy8gYXZvaWRzIHRoZSBwb3BvdmVyIGZsaWNrZXJpbmcgZW1wdHkgYmV0d2VlbiBzdWJtaXQgKyBicm9hZGNhc3QuXG4gICAgICBzZXRDb21tZW50cygocHJldikgPT4gcHJldi5tYXAoKGMpID0+IChjLmlkID09PSB1cGRhdGVkLmlkID8gdXBkYXRlZCA6IGMpKSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH0sIFtdKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tbGF5ZXJcIiBhcmlhLWhpZGRlbj17ZmFsc2V9PlxuICAgICAge3Zpc2libGUubWFwKChjKSA9PiB7XG4gICAgICAgIGNvbnN0IG4gPSBpbmRleEJ5SWQuZ2V0KGMuaWQpID8/IDA7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPENvbW1lbnRQaW5cbiAgICAgICAgICAgIGtleT17Yy5pZH1cbiAgICAgICAgICAgIGNvbW1lbnQ9e2N9XG4gICAgICAgICAgICBzZXF1ZW5jZT17bn1cbiAgICAgICAgICAgIGZvY3VzZWQ9e2ZvY3VzZWRJZCA9PT0gYy5pZH1cbiAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZVBpbkNsaWNrfVxuICAgICAgICAgIC8+XG4gICAgICAgICk7XG4gICAgICB9KX1cbiAgICAgIHtjb21wb3NlciA/IChcbiAgICAgICAgPENvbW1lbnRDb21wb3NlciBzdGF0ZT17Y29tcG9zZXJ9IG9uU3VibWl0PXtzdWJtaXRDb21wb3Nlcn0gb25DYW5jZWw9e2Nsb3NlQ29tcG9zZXJ9IC8+XG4gICAgICApIDogbnVsbH1cbiAgICAgIHsoKCkgPT4ge1xuICAgICAgICBpZiAoIWZvY3VzZWRJZCkgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IGZvY3VzZWQgPSB2aXNpYmxlLmZpbmQoKGMpID0+IGMuaWQgPT09IGZvY3VzZWRJZCk7XG4gICAgICAgIGlmICghZm9jdXNlZCkgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPENvbW1lbnRUaHJlYWRcbiAgICAgICAgICAgIGNvbW1lbnQ9e2ZvY3VzZWR9XG4gICAgICAgICAgICBvbkNsb3NlPXsoKSA9PiB7XG4gICAgICAgICAgICAgIHNldEZvY3VzZWRJZChudWxsKTtcbiAgICAgICAgICAgICAgLy8gRHJvcCB0aGUgY2FudmFzIGhhbG8gd2hlbiB0aGUgdGhyZWFkIGNsb3NlcyDigJQgc3ltbWV0cmljIHdpdGhcbiAgICAgICAgICAgICAgLy8gYGhhbmRsZVBpbkNsaWNrYCB3aGljaCBwYWludHMgaXQgb24gb3Blbi5cbiAgICAgICAgICAgICAgc2VsU2V0Py5jbGVhcigpO1xuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIG9uUGF0Y2g9eyhwYXRjaCkgPT4gaGFuZGxlUGF0Y2goZm9jdXNlZC5pZCwgcGF0Y2gpfVxuICAgICAgICAgICAgb25EZWxldGU9eygpID0+IGhhbmRsZURlbGV0ZShmb2N1c2VkLmlkKX1cbiAgICAgICAgICAgIG9uUmVwbHk9eyhib2R5KSA9PiBoYW5kbGVSZXBseShmb2N1c2VkLmlkLCBib2R5KX1cbiAgICAgICAgICAvPlxuICAgICAgICApO1xuICAgICAgfSkoKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBNZW50aW9uQXdhcmVUZXh0YXJlYSArIHBvcHVwIOKAlCBUYXNrIDVcbi8vXG4vLyBXcmFwcyBhIHRleHRhcmVhIGFuZCBzdXJmYWNlcyBhbiBhdXRvY29tcGxldGUgcG9wdXAgd2hlbiB0aGUgY2FyZXQgc2l0c1xuLy8gaW5zaWRlIGFuIGBAPHF1ZXJ5PmAgdG9rZW4gKG5vIHdoaXRlc3BhY2UgYmV0d2VlbiBgQGAgYW5kIGN1cnNvcikuIFRoZVxuLy8gY29tbWl0dGVyIGxpc3QgaXMgZmV0Y2hlZCBvbmNlIG9uIGZpcnN0IGZvY3VzIGFuZCBjYWNoZWQgZm9yIHRoZSBzZXNzaW9uLlxuLy8gS2V5Ym9hcmQ6IOKGkeKGkyBtb3ZlLCDihrUvVGFiIGluc2VydCAoYEBmaXJzdG5hbWUgYCksIEVzYyBkaXNtaXNzLlxuXG5pbnRlcmZhY2UgQ29tbWl0dGVyUm93IHtcbiAgbmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBjb21taXRzOiBudW1iZXI7XG59XG5cbmxldCBjb21taXR0ZXJDYWNoZTogUHJvbWlzZTxDb21taXR0ZXJSb3dbXT4gfCBudWxsID0gbnVsbDtcbmFzeW5jIGZ1bmN0aW9uIGxvYWRDb21taXR0ZXJzKCk6IFByb21pc2U8Q29tbWl0dGVyUm93W10+IHtcbiAgaWYgKCFjb21taXR0ZXJDYWNoZSkge1xuICAgIGNvbW1pdHRlckNhY2hlID0gKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHIgPSBhd2FpdCBmZXRjaCgnL19hcGkvZ2l0LWNvbW1pdHRlcnMnKTtcbiAgICAgICAgaWYgKCFyLm9rKSByZXR1cm4gW107XG4gICAgICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgci5qc29uKCkpIGFzIHsgY29tbWl0dGVycz86IENvbW1pdHRlclJvd1tdIH07XG4gICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KGRhdGEuY29tbWl0dGVycykgPyBkYXRhLmNvbW1pdHRlcnMgOiBbXTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG4gICAgfSkoKTtcbiAgfVxuICByZXR1cm4gY29tbWl0dGVyQ2FjaGU7XG59XG5cbmZ1bmN0aW9uIGZpcnN0TmFtZVNsdWcobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gYEBmaXJzdG5hbWVgIGlzIHdoYXQgd2UgaW5zZXJ0IG9uIGFjY2VwdC4gU3RyaXAgc3VybmFtZXMgKyBwdW5jdHVhdGlvbi5cbiAgY29uc3QgZmlyc3QgPSBuYW1lLnRyaW0oKS5zcGxpdCgvXFxzKy8pWzBdID8/ICcnO1xuICAvLyBLZWVwIGFscGhhbnVtICsgYC5gIGAtYCBgX2AgKG1hdGNoZXMgdGhlIHBhcnNlTWVudGlvbnMgcmVnZXggb24gdGhlIHNlcnZlcikuXG4gIHJldHVybiBmaXJzdC5yZXBsYWNlKC9bXlxcdy4tXS9nLCAnJykudG9Mb3dlckNhc2UoKTtcbn1cblxuaW50ZXJmYWNlIE1lbnRpb25Ub2tlbiB7XG4gIHN0YXJ0OiBudW1iZXI7IC8vIGluZGV4IG9mIGBAYFxuICBlbmQ6IG51bWJlcjsgLy8gZXhjbHVzaXZlIOKAlCBjdXJyZW50IGNhcmV0XG4gIHF1ZXJ5OiBzdHJpbmc7IC8vIGNoYXJzIGJldHdlZW4gYEBgIGFuZCBjYXJldCAoZXhjbHVkaW5nIGBAYClcbn1cblxuZnVuY3Rpb24gZGV0ZWN0TWVudGlvblRva2VuKHRleHQ6IHN0cmluZywgY2FyZXQ6IG51bWJlcik6IE1lbnRpb25Ub2tlbiB8IG51bGwge1xuICBpZiAoY2FyZXQgPD0gMCB8fCBjYXJldCA+IHRleHQubGVuZ3RoKSByZXR1cm4gbnVsbDtcbiAgLy8gV2FsayBiYWNrd2FyZHMgZnJvbSBjYXJldDsgdGhlIHRva2VuIHN0YXJ0cyBhdCBgQGAgYW5kIGVuZHMgYXQgdGhlIGNhcmV0LlxuICAvLyBBYm9ydHMgb24gd2hpdGVzcGFjZSwgbmV3bGluZSwgb3IgYW55IG5vbi1tZW50aW9uIGNoYXIgc28gYSBzdHJheSBgQGAgaW5cbiAgLy8gYW4gZW1haWwgaXMgaWdub3JlZC5cbiAgbGV0IGkgPSBjYXJldCAtIDE7XG4gIHdoaWxlIChpID49IDApIHtcbiAgICBjb25zdCBjaCA9IHRleHRbaV0gPz8gJyc7XG4gICAgaWYgKGNoID09PSAnQCcpIHtcbiAgICAgIC8vIFRva2VuIG11c3QgYmUgd29yZC1sZWFkaW5nOiBwcmV2aW91cyBjaGFyIGlzIHN0YXJ0LW9mLXN0cmluZyBvciB3aGl0ZXNwYWNlLlxuICAgICAgY29uc3QgcHJldiA9IGkgPiAwID8gdGV4dFtpIC0gMV0gOiAnJztcbiAgICAgIGlmIChpID09PSAwIHx8IC9cXHMvLnRlc3QocHJldiA/PyAnJykpIHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSB0ZXh0LnNsaWNlKGkgKyAxLCBjYXJldCk7XG4gICAgICAgIHJldHVybiB7IHN0YXJ0OiBpLCBlbmQ6IGNhcmV0LCBxdWVyeSB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICghL1tcXHcuLV0vLnRlc3QoY2gpKSByZXR1cm4gbnVsbDtcbiAgICBpIC09IDE7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIE1lbnRpb25Bd2FyZVRleHRhcmVhKHtcbiAgY2xhc3NOYW1lLFxuICB2YWx1ZSxcbiAgb25DaGFuZ2UsXG4gIG9uS2V5RG93bixcbiAgcGxhY2Vob2xkZXIsXG4gIHJvd3MsXG4gIGRpc2FibGVkLFxuICB0ZXh0YXJlYVJlZixcbiAgYXJpYUxhYmVsLFxufToge1xuICBjbGFzc05hbWU6IHN0cmluZztcbiAgdmFsdWU6IHN0cmluZztcbiAgb25DaGFuZ2U6IChuZXh0OiBzdHJpbmcpID0+IHZvaWQ7XG4gIG9uS2V5RG93bj86IChlOiBSZWFjdC5LZXlib2FyZEV2ZW50PEhUTUxUZXh0QXJlYUVsZW1lbnQ+KSA9PiB2b2lkO1xuICBwbGFjZWhvbGRlcj86IHN0cmluZztcbiAgcm93cz86IG51bWJlcjtcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xuICB0ZXh0YXJlYVJlZj86IFJlYWN0Lk11dGFibGVSZWZPYmplY3Q8SFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw+O1xuICBhcmlhTGFiZWw/OiBzdHJpbmc7XG59KTogUmVhY3QuUmVhY3RFbGVtZW50IHtcbiAgY29uc3QgaW50ZXJuYWxSZWYgPSB1c2VSZWY8SFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBzZXRSZWYgPSB1c2VDYWxsYmFjayhcbiAgICAoZWw6IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsKSA9PiB7XG4gICAgICBpbnRlcm5hbFJlZi5jdXJyZW50ID0gZWw7XG4gICAgICBpZiAodGV4dGFyZWFSZWYpIHRleHRhcmVhUmVmLmN1cnJlbnQgPSBlbDtcbiAgICB9LFxuICAgIFt0ZXh0YXJlYVJlZl1cbiAgKTtcblxuICBjb25zdCBbY29tbWl0dGVycywgc2V0Q29tbWl0dGVyc10gPSB1c2VTdGF0ZTxDb21taXR0ZXJSb3dbXT4oW10pO1xuICBjb25zdCBbdG9rZW4sIHNldFRva2VuXSA9IHVzZVN0YXRlPE1lbnRpb25Ub2tlbiB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbaGlnaGxpZ2h0LCBzZXRIaWdobGlnaHRdID0gdXNlU3RhdGUoMCk7XG5cbiAgLy8gTGF6eS1sb2FkIGNvbW1pdHRlcnMgb24gZmlyc3QgZm9jdXMuXG4gIGNvbnN0IG9uRm9jdXMgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgaWYgKGNvbW1pdHRlcnMubGVuZ3RoID4gMCkgcmV0dXJuO1xuICAgIHZvaWQgbG9hZENvbW1pdHRlcnMoKS50aGVuKChsaXN0KSA9PiBzZXRDb21taXR0ZXJzKGxpc3QpKTtcbiAgfSwgW2NvbW1pdHRlcnMubGVuZ3RoXSk7XG5cbiAgY29uc3QgZmlsdGVyZWQgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gW10gYXMgQ29tbWl0dGVyUm93W107XG4gICAgY29uc3QgcSA9IHRva2VuLnF1ZXJ5LnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgbGlzdCA9ICFxXG4gICAgICA/IGNvbW1pdHRlcnNcbiAgICAgIDogY29tbWl0dGVycy5maWx0ZXIoXG4gICAgICAgICAgKGMpID0+IGMubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8IGMuZW1haWwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKVxuICAgICAgICApO1xuICAgIHJldHVybiBsaXN0LnNsaWNlKDAsIDgpO1xuICB9LCBbdG9rZW4sIGNvbW1pdHRlcnNdKTtcblxuICBjb25zdCByZWZyZXNoVG9rZW4gPSB1c2VDYWxsYmFjaygodGV4dGFyZWE6IEhUTUxUZXh0QXJlYUVsZW1lbnQpID0+IHtcbiAgICBjb25zdCBjYXJldCA9IHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ID8/IHRleHRhcmVhLnZhbHVlLmxlbmd0aDtcbiAgICBjb25zdCB0ID0gZGV0ZWN0TWVudGlvblRva2VuKHRleHRhcmVhLnZhbHVlLCBjYXJldCk7XG4gICAgc2V0VG9rZW4odCk7XG4gICAgc2V0SGlnaGxpZ2h0KDApO1xuICB9LCBbXSk7XG5cbiAgY29uc3QgaGFuZGxlQ2hhbmdlID0gdXNlQ2FsbGJhY2soXG4gICAgKGU6IFJlYWN0LkNoYW5nZUV2ZW50PEhUTUxUZXh0QXJlYUVsZW1lbnQ+KSA9PiB7XG4gICAgICBvbkNoYW5nZShlLnRhcmdldC52YWx1ZSk7XG4gICAgICByZWZyZXNoVG9rZW4oZS50YXJnZXQpO1xuICAgIH0sXG4gICAgW29uQ2hhbmdlLCByZWZyZXNoVG9rZW5dXG4gICk7XG5cbiAgY29uc3QgaW5zZXJ0TWVudGlvbiA9IHVzZUNhbGxiYWNrKFxuICAgIChjb21taXR0ZXI6IENvbW1pdHRlclJvdykgPT4ge1xuICAgICAgaWYgKCF0b2tlbikgcmV0dXJuO1xuICAgICAgY29uc3QgdGEgPSBpbnRlcm5hbFJlZi5jdXJyZW50O1xuICAgICAgaWYgKCF0YSkgcmV0dXJuO1xuICAgICAgY29uc3QgdGFnID0gYEAke2ZpcnN0TmFtZVNsdWcoY29tbWl0dGVyLm5hbWUpfWA7XG4gICAgICBjb25zdCBuZXh0ID0gYCR7dmFsdWUuc2xpY2UoMCwgdG9rZW4uc3RhcnQpfSR7dGFnfSAke3ZhbHVlLnNsaWNlKHRva2VuLmVuZCl9YDtcbiAgICAgIG9uQ2hhbmdlKG5leHQpO1xuICAgICAgc2V0VG9rZW4obnVsbCk7XG4gICAgICAvLyBSZXN0b3JlIGNhcmV0IGp1c3QgcGFzdCB0aGUgaW5zZXJ0ZWQgdG9rZW4gKyB0cmFpbGluZyBzcGFjZS5cbiAgICAgIGNvbnN0IG5ld0NhcmV0ID0gdG9rZW4uc3RhcnQgKyB0YWcubGVuZ3RoICsgMTtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICAgIHRhLmZvY3VzKCk7XG4gICAgICAgIHRhLnNldFNlbGVjdGlvblJhbmdlKG5ld0NhcmV0LCBuZXdDYXJldCk7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIFt0b2tlbiwgdmFsdWUsIG9uQ2hhbmdlXVxuICApO1xuXG4gIGNvbnN0IGhhbmRsZUtleURvd24gPSB1c2VDYWxsYmFjayhcbiAgICAoZTogUmVhY3QuS2V5Ym9hcmRFdmVudDxIVE1MVGV4dEFyZWFFbGVtZW50PikgPT4ge1xuICAgICAgaWYgKHRva2VuICYmIGZpbHRlcmVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaWYgKGUua2V5ID09PSAnQXJyb3dEb3duJykge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBzZXRIaWdobGlnaHQoKGgpID0+IChoICsgMSkgJSBmaWx0ZXJlZC5sZW5ndGgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT09ICdBcnJvd1VwJykge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBzZXRIaWdobGlnaHQoKGgpID0+IChoIC0gMSArIGZpbHRlcmVkLmxlbmd0aCkgJSBmaWx0ZXJlZC5sZW5ndGgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicgfHwgZS5rZXkgPT09ICdUYWInKSB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIGNvbnN0IHBpY2sgPSBmaWx0ZXJlZFtoaWdobGlnaHRdID8/IGZpbHRlcmVkWzBdO1xuICAgICAgICAgIGlmIChwaWNrKSBpbnNlcnRNZW50aW9uKHBpY2spO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIHNldFRva2VuKG51bGwpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgb25LZXlEb3duPy4oZSk7XG4gICAgfSxcbiAgICBbdG9rZW4sIGZpbHRlcmVkLCBoaWdobGlnaHQsIGluc2VydE1lbnRpb24sIG9uS2V5RG93bl1cbiAgKTtcblxuICBjb25zdCBoYW5kbGVTZWxlY3QgPSB1c2VDYWxsYmFjayhcbiAgICAoZTogUmVhY3QuU3ludGhldGljRXZlbnQ8SFRNTFRleHRBcmVhRWxlbWVudD4pID0+IHtcbiAgICAgIHJlZnJlc2hUb2tlbihlLmN1cnJlbnRUYXJnZXQpO1xuICAgIH0sXG4gICAgW3JlZnJlc2hUb2tlbl1cbiAgKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgc3R5bGU9e3sgcG9zaXRpb246ICdyZWxhdGl2ZScgfX0+XG4gICAgICA8dGV4dGFyZWFcbiAgICAgICAgcmVmPXtzZXRSZWZ9XG4gICAgICAgIGNsYXNzTmFtZT17Y2xhc3NOYW1lfVxuICAgICAgICB2YWx1ZT17dmFsdWV9XG4gICAgICAgIHBsYWNlaG9sZGVyPXtwbGFjZWhvbGRlcn1cbiAgICAgICAgcm93cz17cm93c31cbiAgICAgICAgZGlzYWJsZWQ9e2Rpc2FibGVkfVxuICAgICAgICBhcmlhLWxhYmVsPXthcmlhTGFiZWx9XG4gICAgICAgIG9uQ2hhbmdlPXtoYW5kbGVDaGFuZ2V9XG4gICAgICAgIG9uS2V5RG93bj17aGFuZGxlS2V5RG93bn1cbiAgICAgICAgb25Gb2N1cz17b25Gb2N1c31cbiAgICAgICAgb25TZWxlY3Q9e2hhbmRsZVNlbGVjdH1cbiAgICAgICAgb25DbGljaz17aGFuZGxlU2VsZWN0fVxuICAgICAgLz5cbiAgICAgIHsvKiBDb21ib2JveCBwYXR0ZXJuIOKAlCBgcm9sZT1cImxpc3Rib3hcImAgKyBgcm9sZT1cIm9wdGlvblwiYCBpcyB0aGUgY2Fub25pY2FsXG4gICAgICAgKiBBUklBIHNoYXBlIGZvciBhIHNpbmdsZS1zZWxlY3QgYXV0b2NvbXBsZXRlLiBLZXlib2FyZCBuYXZpZ2F0aW9uXG4gICAgICAgKiAo4oaRIOKGkyBFbnRlciBFc2MpIGxpdmVzIG9uIHRoZSBwYXJlbnQgdGV4dGFyZWEgcGVyIHRoZSBjb21ib2JveCBzcGVjLFxuICAgICAgICogc28gdGhlIHBvcHVwIGl0c2VsZiBzdGF5cyBpbmVydC4gU2FtZSBwYXR0ZXJuIGFwcGxpZXMgdG8gdGhlIGNvbXBvc2VyXG4gICAgICAgKiArIHRocmVhZCBwb3BvdmVycyBiZWxvdyAoYHJvbGU9XCJkaWFsb2dcImAgb24gYSBwb3NpdGlvbmVkIDxkaXY+KS5cbiAgICAgICAqIEJpb21lJ3MgYTExeSBydWxlcyB3YW50IHNlbWFudGljIEhUTUwgcHJpbWl0aXZlcywgYnV0IG5vbmUgbWF0Y2hcbiAgICAgICAqIFwibm9uLWZvY3VzYWJsZSBsaXN0Ym94IHVuZGVyIGEgdGV4dGFyZWFcIiBvciBcImFuY2hvcmVkIG5vbi1tb2RhbCBwb3BvdmVyXCIuXG4gICAgICAgKiBUaGUgZm91ciBhZmZlY3RlZCBydWxlcyBhcmUgc2NvcGVkIG9mZiBmb3IgdGhpcyBmaWxlIGluIGJpb21lLmpzb24uICovfVxuICAgICAge3Rva2VuICYmIGZpbHRlcmVkLmxlbmd0aCA+IDAgPyAoXG4gICAgICAgIDx1bFxuICAgICAgICAgIGNsYXNzTmFtZT1cImNtLW1lbnRpb24tcG9wdXBcIlxuICAgICAgICAgIHJvbGU9XCJsaXN0Ym94XCJcbiAgICAgICAgICBhcmlhLWxhYmVsPVwiTWVudGlvbiBzdWdnZXN0aW9uc1wiXG4gICAgICAgICAgc3R5bGU9e3sgbGVmdDogMCwgdG9wOiAnMTAwJScgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHtmaWx0ZXJlZC5tYXAoKGMsIGkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkID0gaSA9PT0gaGlnaGxpZ2h0O1xuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPGxpXG4gICAgICAgICAgICAgICAga2V5PXtgJHtjLm5hbWV9LSR7Yy5lbWFpbH1gfVxuICAgICAgICAgICAgICAgIHJvbGU9XCJvcHRpb25cIlxuICAgICAgICAgICAgICAgIGFyaWEtc2VsZWN0ZWQ9e3NlbGVjdGVkfVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImNtLW1lbnRpb24tcG9wdXBfX2l0ZW1cIlxuICAgICAgICAgICAgICAgIG9uTW91c2VFbnRlcj17KCkgPT4gc2V0SGlnaGxpZ2h0KGkpfVxuICAgICAgICAgICAgICAgIC8vIFVzZSBtb3VzZWRvd24gc28gdGhlIHRleHRhcmVhIGRvZXNuJ3QgYmx1ciBiZWZvcmUgdGhlXG4gICAgICAgICAgICAgICAgLy8gc2VsZWN0aW9uIHJlZ2lzdGVycy5cbiAgICAgICAgICAgICAgICBvbk1vdXNlRG93bj17KGV2KSA9PiB7XG4gICAgICAgICAgICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgaW5zZXJ0TWVudGlvbihjKTtcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiY20tbWVudGlvbi1wb3B1cF9fbmFtZVwiPkB7Zmlyc3ROYW1lU2x1ZyhjLm5hbWUpfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjbS1tZW50aW9uLXBvcHVwX19lbWFpbFwiPntjLmVtYWlsfTwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSl9XG4gICAgICAgIDwvdWw+XG4gICAgICApIDogbnVsbH1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBDb21tZW50UGluIOKAlCBzaW5nbGUgMjTDlzI0IGJhZGdlIGFuY2hvcmVkIHRvIHRvcC1yaWdodCBvZiBpdHMgdGFyZ2V0IGVsZW1lbnQuXG4vLyBSZXNvbHZlcyB0YXJnZXQgb24gZXZlcnkgYW5pbWF0aW9uIGZyYW1lIHRvIHRyYWNrIGxheW91dCBzaGlmdHMgKGRyYWcsXG4vLyByZWZsb3csIGZvbnQgbG9hZCkuIEZhbGxzIGJhY2sgdG8gdGhlIHN0b3JlZCBgYm91bmRzYCB3aGVuIHRoZSB0YXJnZXQgaXNcbi8vIGdvbmUgZnJvbSB0aGUgRE9NLlxuXG5mdW5jdGlvbiBDb21tZW50UGluKHtcbiAgY29tbWVudCxcbiAgc2VxdWVuY2UsXG4gIGZvY3VzZWQsXG4gIG9uQ2xpY2ssXG59OiB7XG4gIGNvbW1lbnQ6IE92ZXJsYXlDb21tZW50O1xuICBzZXF1ZW5jZTogbnVtYmVyO1xuICBmb2N1c2VkOiBib29sZWFuO1xuICBvbkNsaWNrOiAoaWQ6IHN0cmluZykgPT4gdm9pZDtcbn0pIHtcbiAgY29uc3QgcmVmID0gdXNlUmVmPEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHJhZlJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHRpY2sgPSAoKSA9PiB7XG4gICAgICByYWZSZWYuY3VycmVudCA9IG51bGw7XG4gICAgICBjb25zdCBwaW4gPSByZWYuY3VycmVudDtcbiAgICAgIGlmICghcGluKSByZXR1cm47XG5cbiAgICAgIC8vIExpdmUgc2NyZWVuLWNvb3JkIGxvb2t1cCBtaXJyb3JzIFNlbGVjdGlvbkhhbG9zIGluIGNhbnZhcy1zaGVsbC50c3guXG4gICAgICAvLyBGYWxscyBiYWNrIHRvIHN0b3JlZCBib3VuZHMgKGEgc2NyZWVuLWNvb3JkIGNhcHR1cmUgYXQgY3JlYXRlIHRpbWUpXG4gICAgICAvLyB3aGVuIHRoZSB0YXJnZXQgZWxlbWVudCBpcyBnb25lIOKAlCBiZXR0ZXIgdGhhbiB2YW5pc2hpbmcgZW50aXJlbHkuXG4gICAgICBsZXQgcG9zID0gc2NyZWVuUmVjdEZvcihjb21tZW50LnNlbGVjdG9yKTtcbiAgICAgIGlmICghcG9zICYmIGNvbW1lbnQuYm91bmRzKSB7XG4gICAgICAgIHBvcyA9IHtcbiAgICAgICAgICB4OiBjb21tZW50LmJvdW5kcy54LFxuICAgICAgICAgIHk6IGNvbW1lbnQuYm91bmRzLnksXG4gICAgICAgICAgdzogY29tbWVudC5ib3VuZHMudyxcbiAgICAgICAgICBoOiBjb21tZW50LmJvdW5kcy5oLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgaWYgKCFwb3MpIHtcbiAgICAgICAgcGluLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBwaW4uc3R5bGUuZGlzcGxheSA9ICdncmlkJztcbiAgICAgIC8vIFBvc2l0aW9uIHRoZSBwaW4ncyBjZW50ZXIgYXQgKHJpZ2h0IC0gMTIsIHRvcCAtIDEyKSDigJQgdGhlIEZpZ0phbVxuICAgICAgLy8gY29udmVudGlvbi4gMTIgPSBoYWxmIG9mIDI0ICh0aGUgcGluJ3Mgb3duIHNpemUpLlxuICAgICAgY29uc3QgbGVmdCA9IE1hdGgucm91bmQocG9zLnggKyBwb3MudyAtIDEyKTtcbiAgICAgIGNvbnN0IHRvcCA9IE1hdGgucm91bmQocG9zLnkgLSAxMik7XG4gICAgICBwaW4uc3R5bGUubGVmdCA9IGAke2xlZnR9cHhgO1xuICAgICAgcGluLnN0eWxlLnRvcCA9IGAke3RvcH1weGA7XG4gICAgICByYWZSZWYuY3VycmVudCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICB9O1xuICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpZiAocmFmUmVmLmN1cnJlbnQgIT0gbnVsbCkgY2FuY2VsQW5pbWF0aW9uRnJhbWUocmFmUmVmLmN1cnJlbnQpO1xuICAgIH07XG4gIH0sIFtjb21tZW50LnNlbGVjdG9yLCBjb21tZW50LmJvdW5kc10pO1xuXG4gIGNvbnN0IGF1dGhvciA9IGNvbW1lbnQuYXV0aG9yPy50cmltKCkgfHwgJ3Vua25vd24nO1xuICBjb25zdCBsYWJlbCA9IGBDb21tZW50ICR7c2VxdWVuY2V9IGJ5ICR7YXV0aG9yfWA7XG5cbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICByZWY9e3JlZn1cbiAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgY2xhc3NOYW1lPVwiY20tcGluXCJcbiAgICAgIGRhdGEtcmVzb2x2ZWQ9e2NvbW1lbnQuc3RhdHVzID09PSAncmVzb2x2ZWQnID8gJ3RydWUnIDogJ2ZhbHNlJ31cbiAgICAgIGRhdGEtZm9jdXNlZD17Zm9jdXNlZCA/ICd0cnVlJyA6ICdmYWxzZSd9XG4gICAgICBkYXRhLWNvbW1lbnQtcGluPXtjb21tZW50LmlkfVxuICAgICAgYXJpYS1sYWJlbD17bGFiZWx9XG4gICAgICBhcmlhLWV4cGFuZGVkPXtmb2N1c2VkfVxuICAgICAgdGl0bGU9e2NvbW1lbnQudGV4dC5zbGljZSgwLCAyMDApfVxuICAgICAgb25DbGljaz17KGUpID0+IHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBvbkNsaWNrKGNvbW1lbnQuaWQpO1xuICAgICAgfX1cbiAgICA+XG4gICAgICB7c2VxdWVuY2V9XG4gICAgPC9idXR0b24+XG4gICk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29tbWVudENvbXBvc2VyIOKAlCBEUy1zdHlsZWQgY2FyZCBhbmNob3JlZCBqdXN0IHVuZGVyIHRoZSBjbGlja2VkIGVsZW1lbnRcbi8vIChvciBhdCB0aGUgY2xpY2sgcG9pbnQgaWYgdGhlIGNsaWNrIGhpdCBlbXB0eSBjYW52YXMpLiBFZGdlLWNsYW1wIGlzIHRoZVxuLy8gcHJhZ21hdGljIGtpbmQ6IHBvc2l0aW9uIGlzIGNvbXB1dGVkIG9uY2Ugb24gb3BlbiBhZ2FpbnN0IHRoZSB3b3JsZCBsYXlvdXQsXG4vLyBub3QgY2hhc2VkIG9uIHBhbi96b29tIOKAlCB0aGUgdXNlciBpcyBhY3RpdmVseSB0eXBpbmcuXG5cbmZ1bmN0aW9uIENvbW1lbnRDb21wb3Nlcih7XG4gIHN0YXRlLFxuICBvblN1Ym1pdCxcbiAgb25DYW5jZWwsXG59OiB7XG4gIHN0YXRlOiBDb21wb3NlclN0YXRlO1xuICBvblN1Ym1pdDogKHRleHQ6IHN0cmluZykgPT4gdm9pZDtcbiAgb25DYW5jZWw6ICgpID0+IHZvaWQ7XG59KSB7XG4gIGNvbnN0IFt0ZXh0LCBzZXRUZXh0XSA9IHVzZVN0YXRlKCcnKTtcbiAgY29uc3QgdGV4dGFyZWFSZWYgPSB1c2VSZWY8SFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCBjYXJkUmVmID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHJhZlJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKTtcblxuICAvLyBMaXZlIGFuY2hvciDigJQgY29tcG9zZXIgdHJhY2tzIHRoZSB0YXJnZXQgZWxlbWVudCB2aWEgckFGIHNvIHBhbi96b29tXG4gIC8vIHdoaWxlIHR5cGluZyBrZWVwcyB0aGUgY2FyZCBnbHVlZCB0byBpdHMgYW5jaG9yLiBXcml0ZXMgZGlyZWN0bHkgdG8gdGhlXG4gIC8vIERPTSBzbyB3ZSBkb24ndCByZS1yZW5kZXIgZXZlcnkgZnJhbWUuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgdGljayA9ICgpID0+IHtcbiAgICAgIHJhZlJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgIGNvbnN0IG5vZGUgPSBjYXJkUmVmLmN1cnJlbnQ7XG4gICAgICBpZiAoIW5vZGUpIHJldHVybjtcbiAgICAgIGNvbnN0IGFuY2hvciA9IGNvbXB1dGVBbmNob3Ioc3RhdGUpO1xuICAgICAgbm9kZS5zdHlsZS5sZWZ0ID0gYCR7TWF0aC5yb3VuZChhbmNob3IueCl9cHhgO1xuICAgICAgbm9kZS5zdHlsZS50b3AgPSBgJHtNYXRoLnJvdW5kKGFuY2hvci55KX1weGA7XG4gICAgICByYWZSZWYuY3VycmVudCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICB9O1xuICAgIHJhZlJlZi5jdXJyZW50ID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpZiAocmFmUmVmLmN1cnJlbnQgIT0gbnVsbCkgY2FuY2VsQW5pbWF0aW9uRnJhbWUocmFmUmVmLmN1cnJlbnQpO1xuICAgIH07XG4gIH0sIFtzdGF0ZV0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgdGV4dGFyZWFSZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgfSwgW10pO1xuXG4gIGNvbnN0IHRyeVN1Ym1pdCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBjb25zdCB2ID0gdGV4dC50cmltKCk7XG4gICAgaWYgKCF2KSByZXR1cm47XG4gICAgb25TdWJtaXQodik7XG4gIH0sIFt0ZXh0LCBvblN1Ym1pdF0pO1xuXG4gIGNvbnN0IG9uS2V5RG93biA9IHVzZUNhbGxiYWNrKFxuICAgIChlOiBSZWFjdC5LZXlib2FyZEV2ZW50PEhUTUxUZXh0QXJlYUVsZW1lbnQ+KSA9PiB7XG4gICAgICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgb25DYW5jZWwoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKChlLm1ldGFLZXkgfHwgZS5jdHJsS2V5KSAmJiBlLmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHRyeVN1Ym1pdCgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgW29uQ2FuY2VsLCB0cnlTdWJtaXRdXG4gICk7XG5cbiAgLy8gQ29tcGFjdCBzZWxlY3RvciBoaW50IOKAlCBzdHJpcCBub2lzeSBzdHJ1Y3R1cmFsIGJpdHMgc28gdGhlIGhlYWQgc3RheXNcbiAgLy8gdGlnaHQgaW5zaWRlIHRoZSAzMDBweCBjYXJkLlxuICBjb25zdCBzZWxlY3RvckNoaXAgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBzID0gc3RhdGUuc2VsZWN0aW9uLnNlbGVjdG9yIHx8ICcnO1xuICAgIGlmICghcykgcmV0dXJuIHN0YXRlLnNlbGVjdGlvbi50YWcgfHwgJ2NhbnZhcyc7XG4gICAgLy8gW2RhdGEtY2QtaWQ9XCLigKZcIl0g4oaSIGNkOjxpZD4gwrcga2VlcHMgdGhlIGNoaXAgcmVhZGFibGUgd2hlbiBzdGFibGUgaWRzXG4gICAgLy8gYXJlIHByZXNlbnQuXG4gICAgY29uc3QgY2QgPSBzLm1hdGNoKC9kYXRhLWNkLWlkPVwiKFteXCJdKylcIi8pO1xuICAgIGlmIChjZCkgcmV0dXJuIGBjZDoke2NkWzFdfWA7XG4gICAgcmV0dXJuIHMubGVuZ3RoID4gMzYgPyBgJHtzLnNsaWNlKDAsIDMzKX3igKZgIDogcztcbiAgfSwgW3N0YXRlLnNlbGVjdGlvbl0pO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgcmVmPXtjYXJkUmVmfVxuICAgICAgY2xhc3NOYW1lPVwiY20tY29tcG9zZXJcIlxuICAgICAgcm9sZT1cImRpYWxvZ1wiXG4gICAgICBhcmlhLWxhYmVsPVwiTmV3IGNvbW1lbnRcIlxuICAgICAgb25DbGljaz17KGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9XG4gICAgICBvblBvaW50ZXJEb3duPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNtLWNvbXBvc2VyX19oZWFkXCI+XG4gICAgICAgIDxzcGFuPk5ldyBjb21tZW50PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjbS1jb21wb3Nlcl9fc2VsZWN0b3JcIj57c2VsZWN0b3JDaGlwfTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPE1lbnRpb25Bd2FyZVRleHRhcmVhXG4gICAgICAgIHRleHRhcmVhUmVmPXt0ZXh0YXJlYVJlZn1cbiAgICAgICAgY2xhc3NOYW1lPVwiY20tY29tcG9zZXJfX3RleHRhcmVhXCJcbiAgICAgICAgdmFsdWU9e3RleHR9XG4gICAgICAgIHBsYWNlaG9sZGVyPVwiVHlwZSBhIGNvbW1lbnQuIOKMmOKGtSB0byBzYXZlIMK3IEVzYyB0byBjYW5jZWwgwrcgQG5hbWUgdG8gdGFnXCJcbiAgICAgICAgb25DaGFuZ2U9e3NldFRleHR9XG4gICAgICAgIG9uS2V5RG93bj17b25LZXlEb3dufVxuICAgICAgICByb3dzPXszfVxuICAgICAgICBhcmlhTGFiZWw9XCJDb21tZW50IGJvZHlcIlxuICAgICAgLz5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tY29tcG9zZXJfX2FjdGlvbnNcIj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3NOYW1lPVwiY20tYnRuXCIgb25DbGljaz17b25DYW5jZWx9PlxuICAgICAgICAgIENhbmNlbFxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvblxuICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgIGNsYXNzTmFtZT1cImNtLWJ0biBjbS1idG4tLXByaW1hcnlcIlxuICAgICAgICAgIGRpc2FibGVkPXshdGV4dC50cmltKCl9XG4gICAgICAgICAgb25DbGljaz17dHJ5U3VibWl0fVxuICAgICAgICA+XG4gICAgICAgICAgU2F2ZVxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIENvbW1lbnRUaHJlYWQg4oCUIHBvcG92ZXIgYW5jaG9yZWQgdG8gdGhlIGZvY3VzZWQgcGluLiBTaG93cyBhdXRob3IgKyByZWxhdGl2ZVxuLy8gdGltZSArIHNlbGVjdG9yIGNoaXAsIHRoZSBvcmlnaW5hbCBib2R5IHdpdGggQG1lbnRpb25zIGJvbGRlZCwgcmVwbGllcywgYVxuLy8gcmVwbHkgdGV4dGFyZWEsIGFuZCByZXNvbHZlL3Jlb3Blbi9kZWxldGUgYWN0aW9ucy4gUGF0Y2hlcyArIGRlbGV0ZXMgcm91dGVcbi8vIHRocm91Z2ggdGhlIHNoZWxsJ3MgZXhpc3RpbmcgV1MgY2hhbm5lbCB2aWEgcG9zdE1lc3NhZ2U7IHJlcGxpZXMgUE9TVFxuLy8gZGlyZWN0bHkgdG8gYC9fYXBpL2NvbW1lbnRzLzxpZD4vcmVwbHlgIGJlY2F1c2UgdGhhdCBlbmRwb2ludCBleGlzdHMgb25seSBvblxuLy8gQnVuIHJ1bnRpbWUgYW5kIGxpdmVzIGluIGBodHRwLnRzYC5cblxuZnVuY3Rpb24gQ29tbWVudFRocmVhZCh7XG4gIGNvbW1lbnQsXG4gIG9uQ2xvc2UsXG4gIG9uUGF0Y2gsXG4gIG9uRGVsZXRlLFxuICBvblJlcGx5LFxufToge1xuICBjb21tZW50OiBPdmVybGF5Q29tbWVudDtcbiAgb25DbG9zZTogKCkgPT4gdm9pZDtcbiAgb25QYXRjaDogKHBhdGNoOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gdm9pZDtcbiAgb25EZWxldGU6ICgpID0+IHZvaWQ7XG4gIG9uUmVwbHk6IChib2R5OiBzdHJpbmcpID0+IFByb21pc2U8Ym9vbGVhbj47XG59KSB7XG4gIGNvbnN0IGRpYWxvZ1JlZiA9IHVzZVJlZjxIVE1MRGl2RWxlbWVudCB8IG51bGw+KG51bGwpO1xuICBjb25zdCByZXBseVJlZiA9IHVzZVJlZjxIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHJhZlJlZiA9IHVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3JlcGx5LCBzZXRSZXBseV0gPSB1c2VTdGF0ZSgnJyk7XG4gIGNvbnN0IFtzZW5kaW5nLCBzZXRTZW5kaW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcblxuICAvLyBMaXZlIGFuY2hvciDigJQgcG9wb3ZlciB0cmFja3MgdGhlIHBpbiB2aWEgckFGIHNvIGl0IHN0YXlzIGdsdWVkIHRvIGl0c1xuICAvLyB0YXJnZXQgdGhyb3VnaCBwYW4gLyB6b29tIChGaWdKYW0gcGFyaXR5KS4gV3JpdGluZyB0byB0aGUgZGlhbG9nIHN0eWxlXG4gIC8vIGRpcmVjdGx5IGF2b2lkcyByZS1yZW5kZXJpbmcgZXZlcnkgZnJhbWUuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgdGljayA9ICgpID0+IHtcbiAgICAgIHJhZlJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgIGNvbnN0IG5vZGUgPSBkaWFsb2dSZWYuY3VycmVudDtcbiAgICAgIGlmICghbm9kZSkgcmV0dXJuO1xuICAgICAgY29uc3QgYW5jaG9yID0gY29tcHV0ZVRocmVhZEFuY2hvcihjb21tZW50KTtcbiAgICAgIG5vZGUuc3R5bGUubGVmdCA9IGAke01hdGgucm91bmQoYW5jaG9yLngpfXB4YDtcbiAgICAgIG5vZGUuc3R5bGUudG9wID0gYCR7TWF0aC5yb3VuZChhbmNob3IueSl9cHhgO1xuICAgICAgcmFmUmVmLmN1cnJlbnQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGljayk7XG4gICAgfTtcbiAgICByYWZSZWYuY3VycmVudCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aWNrKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaWYgKHJhZlJlZi5jdXJyZW50ICE9IG51bGwpIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHJhZlJlZi5jdXJyZW50KTtcbiAgICB9O1xuICB9LCBbY29tbWVudF0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gTW92ZSBmb2N1cyBpbnRvIHRoZSBkaWFsb2cgb24gb3Blbi4gUGVyIFdDQUcgMi4xIHRoZSBkaWFsb2cgc2hvdWxkIG93blxuICAgIC8vIGluaXRpYWwgZm9jdXM7IHdlIHB1dCBpdCBvbiB0aGUgZGlhbG9nIHJvb3QgKGZvY3VzYWJsZSB2aWEgdGFiaW5kZXgpXG4gICAgLy8gc28gc2NyZWVuIHJlYWRlcnMgYW5ub3VuY2UgdGhlIGhlYWRlciBiZWZvcmUgdGhlIGJvZHkuIE9uIGNsb3NlLFxuICAgIC8vIHJldHVybiBmb2N1cyB0byB0aGUgcGluIHNvIGtleWJvYXJkIHVzZXJzIGxhbmQgd2hlcmUgdGhleSBzdGFydGVkLlxuICAgIGRpYWxvZ1JlZi5jdXJyZW50Py5mb2N1cygpO1xuICAgIGNvbnN0IHBpbklkID0gY29tbWVudC5pZDtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY29uc3QgcGluID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MQnV0dG9uRWxlbWVudD4oYFtkYXRhLWNvbW1lbnQtcGluPVwiJHtwaW5JZH1cIl1gKTtcbiAgICAgIHBpbj8uZm9jdXMoKTtcbiAgICB9O1xuICB9LCBbY29tbWVudC5pZF0pO1xuXG4gIC8vIEVzYy10by1jbG9zZSB3aGlsZSBmb2N1cyBpcyBhbnl3aGVyZSBpbnNpZGUgdGhlIHBvcG92ZXIuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICBjb25zdCBvbktleSA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgICBpZiAoZS5rZXkgIT09ICdFc2NhcGUnKSByZXR1cm47XG4gICAgICBjb25zdCByb290ID0gZGlhbG9nUmVmLmN1cnJlbnQ7XG4gICAgICBpZiAoIXJvb3QpIHJldHVybjtcbiAgICAgIGlmIChyb290LmNvbnRhaW5zKGUudGFyZ2V0IGFzIE5vZGUpIHx8IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IHJvb3QpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBvbkNsb3NlKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25LZXkpO1xuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25LZXkpO1xuICB9LCBbb25DbG9zZV0pO1xuXG4gIGNvbnN0IHRyeVNlbmRSZXBseSA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB2ID0gcmVwbHkudHJpbSgpO1xuICAgIGlmICghdiB8fCBzZW5kaW5nKSByZXR1cm47XG4gICAgc2V0U2VuZGluZyh0cnVlKTtcbiAgICBjb25zdCBvayA9IGF3YWl0IG9uUmVwbHkodik7XG4gICAgc2V0U2VuZGluZyhmYWxzZSk7XG4gICAgaWYgKG9rKSB7XG4gICAgICBzZXRSZXBseSgnJyk7XG4gICAgICByZXBseVJlZi5jdXJyZW50Py5mb2N1cygpO1xuICAgIH1cbiAgfSwgW3JlcGx5LCBzZW5kaW5nLCBvblJlcGx5XSk7XG5cbiAgY29uc3Qgb25SZXBseUtleURvd24gPSB1c2VDYWxsYmFjayhcbiAgICAoZTogUmVhY3QuS2V5Ym9hcmRFdmVudDxIVE1MVGV4dEFyZWFFbGVtZW50PikgPT4ge1xuICAgICAgaWYgKChlLm1ldGFLZXkgfHwgZS5jdHJsS2V5KSAmJiBlLmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHZvaWQgdHJ5U2VuZFJlcGx5KCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBbdHJ5U2VuZFJlcGx5XVxuICApO1xuXG4gIGNvbnN0IGhlYWRJZCA9IGBjbS10aHJlYWQtaGVhZC0ke2NvbW1lbnQuaWR9YDtcbiAgY29uc3Qgc2VsZWN0b3JDaGlwID0gZm9ybWF0U2VsZWN0b3JDaGlwKGNvbW1lbnQuc2VsZWN0b3IsICcnKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIHJlZj17ZGlhbG9nUmVmfVxuICAgICAgY2xhc3NOYW1lPVwiY20tdGhyZWFkXCJcbiAgICAgIHJvbGU9XCJkaWFsb2dcIlxuICAgICAgYXJpYS1sYWJlbGxlZGJ5PXtoZWFkSWR9XG4gICAgICB0YWJJbmRleD17LTF9XG4gICAgICBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICAgIG9uUG9pbnRlckRvd249eyhlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfVxuICAgID5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19oZWFkXCIgaWQ9e2hlYWRJZH0+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19oZWFkLXJvd1wiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImNtLXRocmVhZF9fYXV0aG9yXCI+e2NvbW1lbnQuYXV0aG9yPy50cmltKCkgfHwgJ3Vua25vd24nfTwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX3RpbWVcIj57Zm9ybWF0UmVsYXRpdmVUaW1lKGNvbW1lbnQuY3JlYXRlZCl9PC9zcGFuPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19jbG9zZVwiXG4gICAgICAgICAgICBhcmlhLWxhYmVsPVwiQ2xvc2UgdGhyZWFkXCJcbiAgICAgICAgICAgIHRpdGxlPVwiQ2xvc2UgwrcgRXNjXCJcbiAgICAgICAgICAgIG9uQ2xpY2s9e29uQ2xvc2V9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgw5dcbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIHtzZWxlY3RvckNoaXAgPyA8Y29kZSBjbGFzc05hbWU9XCJjbS10aHJlYWRfX3NlbGVjdG9yXCI+e3NlbGVjdG9yQ2hpcH08L2NvZGU+IDogbnVsbH1cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNtLXRocmVhZF9fYm9keVwiPntyZW5kZXJCb2R5V2l0aE1lbnRpb25zKGNvbW1lbnQudGV4dCl9PC9kaXY+XG5cbiAgICAgIHsoY29tbWVudC50aHJlYWQgPz8gW10pLm1hcCgocikgPT4gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNtLXRocmVhZF9fcmVwbHlcIiBrZXk9e3IuaWR9PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19yZXBseS1oZWFkXCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX3JlcGx5LWF1dGhvclwiPntyLmF1dGhvcj8udHJpbSgpIHx8ICd1bmtub3duJ308L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX3JlcGx5LXRpbWVcIj57Zm9ybWF0UmVsYXRpdmVUaW1lKHIuY3JlYXRlZCl9PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19yZXBseS1ib2R5XCI+e3JlbmRlckJvZHlXaXRoTWVudGlvbnMoci5ib2R5KX08L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICApKX1cblxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX3JlcGx5LWZvcm1cIj5cbiAgICAgICAgPE1lbnRpb25Bd2FyZVRleHRhcmVhXG4gICAgICAgICAgdGV4dGFyZWFSZWY9e3JlcGx5UmVmfVxuICAgICAgICAgIGNsYXNzTmFtZT1cImNtLXRocmVhZF9fcmVwbHktdGV4dGFyZWFcIlxuICAgICAgICAgIHZhbHVlPXtyZXBseX1cbiAgICAgICAgICBwbGFjZWhvbGRlcj1cIlJlcGx54oCmIOKMmOKGtSB0byBzZW5kIMK3IEBuYW1lIHRvIHRhZ1wiXG4gICAgICAgICAgb25DaGFuZ2U9e3NldFJlcGx5fVxuICAgICAgICAgIG9uS2V5RG93bj17b25SZXBseUtleURvd259XG4gICAgICAgICAgcm93cz17Mn1cbiAgICAgICAgICBhcmlhTGFiZWw9XCJSZXBseVwiXG4gICAgICAgICAgZGlzYWJsZWQ9e3NlbmRpbmd9XG4gICAgICAgIC8+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY20tdGhyZWFkX19yZXBseS1hY3Rpb25zXCI+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJjbS1idG4gY20tYnRuLS1wcmltYXJ5XCJcbiAgICAgICAgICAgIGRpc2FibGVkPXshcmVwbHkudHJpbSgpIHx8IHNlbmRpbmd9XG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB2b2lkIHRyeVNlbmRSZXBseSgpfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIFNlbmRcbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjbS10aHJlYWRfX2FjdGlvbnNcIj5cbiAgICAgICAge2NvbW1lbnQuc3RhdHVzID09PSAncmVzb2x2ZWQnID8gKFxuICAgICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzTmFtZT1cImNtLWJ0blwiIG9uQ2xpY2s9eygpID0+IG9uUGF0Y2goeyBzdGF0dXM6ICdvcGVuJyB9KX0+XG4gICAgICAgICAgICDihrogUmVvcGVuXG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJjbS1idG4gY20tYnRuLS1wcmltYXJ5XCJcbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgb25QYXRjaCh7IHN0YXR1czogJ3Jlc29sdmVkJyB9KTtcbiAgICAgICAgICAgICAgb25DbG9zZSgpO1xuICAgICAgICAgICAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICDinJMgUmVzb2x2ZVxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICApfVxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgY2xhc3NOYW1lPVwiY20tYnRuIGNtLWJ0bi0tZGFuZ2VyXCJcbiAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICBvbkRlbGV0ZSgpO1xuICAgICAgICAgICAgb25DbG9zZSgpO1xuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICBEZWxldGVcbiAgICAgICAgPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBCb2R5IHJlbmRlcmVyIOKAlCBzcGxpdHMgdGV4dCBvbiBALWhhbmRsZXMsIHdyYXBzIGVhY2ggaW4gPHN0cm9uZz4uIEFueXRoaW5nXG4vLyBub3QgbWF0Y2hpbmcgdGhlIG1lbnRpb24gcmVnZXggc3RheXMgcGxhaW4gdGV4dCAobmV3bGluZXMgcHJlc2VydmVkIGJ5IENTU1xuLy8gYHdoaXRlLXNwYWNlOiBwcmUtd3JhcGApLlxuXG5mdW5jdGlvbiByZW5kZXJCb2R5V2l0aE1lbnRpb25zKHRleHQ6IHN0cmluZyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGlmICghdGV4dCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHJlID0gLyhAW1xcd11bXFx3Li1dKikvZztcbiAgY29uc3QgcGFydHMgPSB0ZXh0LnNwbGl0KHJlKTtcbiAgcmV0dXJuIHBhcnRzLm1hcCgocGFydCwgaSkgPT4ge1xuICAgIC8vIFRoZSBzcGxpdCBwb3NpdGlvbnMgQVJFIHRoZSBpZGVudGl0eSBoZXJlIOKAlCBmb3IgdGhlIHNhbWUgYHRleHRgIGlucHV0LFxuICAgIC8vIGluZGV4IGBpYCBhbHdheXMgbWFwcyB0byB0aGUgc2FtZSBmcmFnbWVudC4gQ29tcG9zZSBrZXkgZnJvbSBpbmRleCArXG4gICAgLy8gY29udGVudCBzbyBiaW9tZSdzIGFycmF5LWluZGV4LWtleSBoZXVyaXN0aWMgaXMgc2F0aXNmaWVkIEFORCByZW9yZGVyXG4gICAgLy8gcmVzaXN0YW5jZSBpcyBpbnRhY3QgaWYgYHRleHRgIG11dGF0ZXMgbWlkLXJlbmRlci5cbiAgICBjb25zdCBrZXkgPSBgJHtpfToke3BhcnR9YDtcbiAgICBpZiAoaSAlIDIgPT09IDEpIHtcbiAgICAgIC8vIE9kZCBwYXJ0cyBhcmUgdGhlIGNhcHR1cmVkIEBoYW5kbGVzIHRoYW5rcyB0byB0aGUgcGFyZW50aGVzaXplZCBzcGxpdC5cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxzdHJvbmcga2V5PXtrZXl9IGRhdGEtbWVudGlvbj1cInRydWVcIj5cbiAgICAgICAgICB7cGFydH1cbiAgICAgICAgPC9zdHJvbmc+XG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gPHNwYW4ga2V5PXtrZXl9PntwYXJ0fTwvc3Bhbj47XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRSZWxhdGl2ZVRpbWUoaXNvOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIWlzbykgcmV0dXJuICcnO1xuICBjb25zdCB0ID0gRGF0ZS5wYXJzZShpc28pO1xuICBpZiAoIU51bWJlci5pc0Zpbml0ZSh0KSkgcmV0dXJuICcnO1xuICBjb25zdCBkaWZmU2VjID0gTWF0aC5yb3VuZCgoRGF0ZS5ub3coKSAtIHQpIC8gMTAwMCk7XG4gIGlmIChkaWZmU2VjIDwgNjApIHJldHVybiBgJHtNYXRoLm1heChkaWZmU2VjLCAwKX1zIGFnb2A7XG4gIGlmIChkaWZmU2VjIDwgMzYwMCkgcmV0dXJuIGAke01hdGgucm91bmQoZGlmZlNlYyAvIDYwKX1tIGFnb2A7XG4gIGlmIChkaWZmU2VjIDwgODZfNDAwKSByZXR1cm4gYCR7TWF0aC5yb3VuZChkaWZmU2VjIC8gMzYwMCl9aCBhZ29gO1xuICByZXR1cm4gYCR7TWF0aC5yb3VuZChkaWZmU2VjIC8gODZfNDAwKX1kIGFnb2A7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFNlbGVjdG9yQ2hpcChzZWxlY3Rvcjogc3RyaW5nLCBmYWxsYmFjazogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCFzZWxlY3RvcikgcmV0dXJuIGZhbGxiYWNrO1xuICBjb25zdCBjZCA9IHNlbGVjdG9yLm1hdGNoKC9kYXRhLWNkLWlkPVwiKFteXCJdKylcIi8pO1xuICBpZiAoY2QpIHJldHVybiBgY2Q6JHtjZFsxXX1gO1xuICByZXR1cm4gc2VsZWN0b3IubGVuZ3RoID4gMzYgPyBgJHtzZWxlY3Rvci5zbGljZSgwLCAzMyl94oCmYCA6IHNlbGVjdG9yO1xufVxuXG5mdW5jdGlvbiBjb21wdXRlVGhyZWFkQW5jaG9yKGNvbW1lbnQ6IE92ZXJsYXlDb21tZW50KTogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9IHtcbiAgLy8gUmVzb2x2ZSB0YXJnZXQncyBsaXZlIHNjcmVlbiByZWN0OyBwb3BvdmVyIGRyb3BzIGJlbG93IHRoZSBwaW4gd2l0aCBzbWFsbFxuICAvLyBicmVhdGhpbmcgcm9vbS4gU3RvcmVkIGJvdW5kcyAoY2FwdHVyZS10aW1lIHNjcmVlbiBjb29yZHMpIGFyZSB0aGVcbiAgLy8gbGFzdC1yZXNvcnQgZmFsbGJhY2sgZm9yIG9ycGhhbmVkIHBpbnMuXG4gIGNvbnN0IHJlY3QgPSBjb21tZW50LnNlbGVjdG9yID8gc2NyZWVuUmVjdEZvcihjb21tZW50LnNlbGVjdG9yKSA6IG51bGw7XG4gIGlmIChyZWN0KSB7XG4gICAgLy8gUGluIHNpdHMgYXQgKHJlY3QucmlnaHQgLSAxMiwgcmVjdC50b3AgLSAxMikuIFBsYWNlIHBvcG92ZXIgYXQgdGhlIHNhbWVcbiAgICAvLyB4IGZvciB2aXN1YWwgY29udGludWl0eSwgMTZweCBiZWxvdyB0aGUgdG9wIHNvIGl0IGNsZWFycyB0aGUgcGluLlxuICAgIHJldHVybiB7IHg6IHJlY3QueCArIHJlY3QudyAtIDEyLCB5OiByZWN0LnkgKyAxNiB9O1xuICB9XG4gIGlmIChjb21tZW50LmJvdW5kcykge1xuICAgIHJldHVybiB7IHg6IGNvbW1lbnQuYm91bmRzLnggKyBjb21tZW50LmJvdW5kcy53IC0gMTIsIHk6IGNvbW1lbnQuYm91bmRzLnkgKyAxNiB9O1xuICB9XG4gIHJldHVybiB7IHg6IDE2LCB5OiAxNiB9O1xufVxuXG5mdW5jdGlvbiBjb21wdXRlQW5jaG9yKHN0YXRlOiBDb21wb3NlclN0YXRlKTogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9IHtcbiAgLy8gRzQg4oCUIGFuY2hvciB0byB0aGUgY3Vyc29yIGNsaWNrIHBvaW50IGZpcnN0LiBFYXJsaWVyIHZlcnNpb25zIGFuY2hvcmVkIHRvXG4gIC8vIHRoZSBzZWxlY3RlZCBlbGVtZW50J3MgYm90dG9tLWxlZnQsIHdoaWNoIGxhbmRlZCB0aGUgY29tcG9zZXIgZmx1c2ggaW5cbiAgLy8gdGhlIGNvcm5lciByZWdhcmRsZXNzIG9mIHdoZXJlIHRoZSB1c2VyIGNsaWNrZWQg4oCUIHN1cnByaXNpbmcgZm9yIHRoZVxuICAvLyBjb21tb24gY2FzZSBvZiBcIkkgY2xpY2tlZCB0aGUgbWlkZGxlIG9mIGFuIGVsZW1lbnQsIGV4cGVjdGluZyB0aGVcbiAgLy8gY29tcG9zZXIgdG8gYXBwZWFyIG5lYXIgbXkgY3Vyc29yXCIuIFRoZSBlbGVtZW50LXJlY3QgcGF0aCByZW1haW5zIGFzIGFcbiAgLy8gZmFsbGJhY2sgZm9yIGVudHJ5IHBvaW50cyB0aGF0IGRvbid0IGNhcnJ5IGEgY3Vyc29yIChlLmcuIG9wZW5pbmcgdGhlXG4gIC8vIGNvbXBvc2VyIGZyb20gYSBjb250ZXh0dWFsIHRvb2xiYXIgYnV0dG9uIOKAlCB0aG9zZSBzaG91bGQgc2V0IGNsaWVudFgvWVxuICAvLyB0byBhIHNlbnNpYmxlIGFuY2hvciBiZWZvcmUgZGlzcGF0Y2hpbmcpLlxuICBpZiAoc3RhdGUuY2xpZW50WCB8fCBzdGF0ZS5jbGllbnRZKSB7XG4gICAgcmV0dXJuIHsgeDogc3RhdGUuY2xpZW50WCwgeTogc3RhdGUuY2xpZW50WSArIDggfTtcbiAgfVxuICBpZiAoc3RhdGUuc2VsZWN0aW9uLnNlbGVjdG9yKSB7XG4gICAgY29uc3QgcmVjdCA9IHNjcmVlblJlY3RGb3Ioc3RhdGUuc2VsZWN0aW9uLnNlbGVjdG9yKTtcbiAgICBpZiAocmVjdCkge1xuICAgICAgcmV0dXJuIHsgeDogcmVjdC54LCB5OiByZWN0LnkgKyByZWN0LmggKyA4IH07XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHg6IDE2LCB5OiAxNiB9O1xufVxuIiwKICAgICIvKipcbiAqIEBmaWxlICAgICAgIHVzZS1jb2xsYWIudHN4IOKAlCBjbGllbnQtc2lkZSBZanMgY29sbGFiIHByb3ZpZGVyIGZvciBjYW52YXMgaWZyYW1lc1xuICogQHNjb3BlICAgICAgcGx1Z2lucy9kZXNpZ24vZGV2LXNlcnZlci91c2UtY29sbGFiLnRzeFxuICogQHB1cnBvc2UgICAgTW91bnRzIGEgc2luZ2xlIFkuRG9jICsgQXdhcmVuZXNzIHBlciBjYW52YXMgaWZyYW1lLiBPcGVucyBhXG4gKiAgICAgICAgICAgICBXZWJTb2NrZXQgdG8gYC9fd3MvY29sbGFiLzpzbHVnYCwgc3BlYWtzIHRoZSB5LXdlYnNvY2tldCBiaW5hcnlcbiAqICAgICAgICAgICAgIHByb3RvY29sLCBleHBvc2VzIGhvb2tzIGZvciB0aGUgY3Vyc29yIG92ZXJsYXkgKyBUYXNrIDMgY29tbWVudHNcbiAqICAgICAgICAgICAgIGJpbmRpbmcuXG4gKlxuICogQm91bmRhcnk6XG4gKiAgIC0gU2VydmVyLXNpZGUgZXF1aXZhbGVudCBpcyBgY29sbGFiL3Byb3RvY29sLnRzYCArIGBjb2xsYWIvcm9vbS50c2AuXG4gKiAgIC0gVGhpcyBmaWxlIG1pcnJvcnMgdGhlIG1lc3NhZ2UgZnJhbWluZyAodmFyaW50LXByZWZpeGVkIHN5bmMgKyBhd2FyZW5lc3NcbiAqICAgICBmcmFtZXMpIHNvIHRoZSB0d28gc2lkZXMgY29udmVyZ2Ugb3ZlciBhIGJpbmFyeSBXUyB3aXRob3V0IGludGVybWVkaWF0ZVxuICogICAgIEpTT04uXG4gKiAgIC0gSW1wb3J0cyBgeWpzYCArIGB5LXByb3RvY29scy97c3luYyxhd2FyZW5lc3N9YCB2aWEgdGhlIGNhbnZhcy1zaGVsbFxuICogICAgIGltcG9ydG1hcCAoUlVOVElNRV9QQUNLQUdFUyBhZGRpdGlvbnMpLiBDYW52YXMgYnVuZGxlcyB0aGF0IGRvbid0IG1vdW50XG4gKiAgICAgPENvbGxhYlByb3ZpZGVyPiBuZXZlciByZXNvbHZlIHRoZXNlIHNwZWNpZmllcnMgYW5kIHBheSB6ZXJvIGJ1bmRsZSBjb3N0LlxuICovXG5cbmltcG9ydCB7XG4gIHR5cGUgUmVhY3ROb2RlLFxuICBjcmVhdGVDb250ZXh0LFxuICB1c2VDYWxsYmFjayxcbiAgdXNlQ29udGV4dCxcbiAgdXNlRWZmZWN0LFxuICB1c2VNZW1vLFxuICB1c2VSZWYsXG4gIHVzZVN0YXRlLFxufSBmcm9tICdyZWFjdCc7XG5cbmltcG9ydCAqIGFzIGRlY29kaW5nIGZyb20gJ2xpYjAvZGVjb2RpbmcnO1xuaW1wb3J0ICogYXMgZW5jb2RpbmcgZnJvbSAnbGliMC9lbmNvZGluZyc7XG5pbXBvcnQgeyBBd2FyZW5lc3MsIGFwcGx5QXdhcmVuZXNzVXBkYXRlLCBlbmNvZGVBd2FyZW5lc3NVcGRhdGUgfSBmcm9tICd5LXByb3RvY29scy9hd2FyZW5lc3MnO1xuaW1wb3J0IHsgcmVhZFN5bmNNZXNzYWdlLCB3cml0ZVN5bmNTdGVwMSwgd3JpdGVVcGRhdGUgfSBmcm9tICd5LXByb3RvY29scy9zeW5jJztcbmltcG9ydCAqIGFzIFkgZnJvbSAneWpzJztcblxuY29uc3QgTUVTU0FHRV9TWU5DID0gMDtcbmNvbnN0IE1FU1NBR0VfQVdBUkVORVNTID0gMTtcblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBDb2xvciBoYXNoIOKAlCBzdGFibGUgcGVyIHBlZXIgaWRlbnRpdHkuXG5cbi8qKlxuICogZGpiMiBzdHJpbmcgaGFzaCDihpIgMHhSUkdHQkIgY29sb3IgaW4gYSBjdXJhdGVkIHBhbGV0dGUuIERldGVybWluaXNtIHBlclxuICogaW5wdXQgbmFtZSBpcyB0aGUgbG9hZC1iZWFyaW5nIHByb3BlcnR5OiBldmVyeSBwZWVyIGhhc2hpbmcgXCJBbGljZVwiIG11c3RcbiAqIGxhbmQgb24gdGhlIFNBTUUgY29sb3IuIDEyIGh1ZXMgc3ByZWFkIGV2ZW5seSBhcm91bmQgdGhlIHdoZWVsOyBzYXR1cmF0aW9uXG4gKiArIGxpZ2h0bmVzcyBmaXhlZCBzbyBhbGwgY29sb3JzIHN0YXkgcmVhZGFibGUgb24gbGlnaHQgKyBkYXJrIHN1cmZhY2VzLlxuICovXG5jb25zdCBDT0xPUl9QQUxFVFRFID0gW1xuICAnI2U5MWU2MycsIC8vIHBpbmtcbiAgJyNmNDQzMzYnLCAvLyByZWRcbiAgJyNmZjk4MDAnLCAvLyBvcmFuZ2VcbiAgJyNmZmMxMDcnLCAvLyBhbWJlclxuICAnI2NkZGMzOScsIC8vIGxpbWVcbiAgJyM0Y2FmNTAnLCAvLyBncmVlblxuICAnIzAwOTY4OCcsIC8vIHRlYWxcbiAgJyMwMGJjZDQnLCAvLyBjeWFuXG4gICcjMDNhOWY0JywgLy8gbGlnaHQgYmx1ZVxuICAnIzNmNTFiNScsIC8vIGluZGlnb1xuICAnIzY3M2FiNycsIC8vIGRlZXAgcHVycGxlXG4gICcjOWMyN2IwJywgLy8gcHVycGxlXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgZnVuY3Rpb24gY29sb3JGb3JOYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIENPTE9SX1BBTEVUVEUgaXMgYSBub24tZW1wdHkgY29uc3QgdHVwbGU7IHRoZSBleHBsaWNpdCBgPz8gJyMwMDAnYFxuICAvLyBmYWxsYmFjayBpcyB1bnJlYWNoYWJsZSBidXQgc2F0aXNmaWVzIGBub1VuY2hlY2tlZEluZGV4ZWRBY2Nlc3NgLlxuICBjb25zdCBGQUxMQkFDSyA9ICcjMDAwMDAwJztcbiAgaWYgKCFuYW1lKSByZXR1cm4gQ09MT1JfUEFMRVRURVswXSA/PyBGQUxMQkFDSztcbiAgbGV0IGhhc2ggPSA1MzgxO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG5hbWUubGVuZ3RoOyBpKyspIHtcbiAgICBoYXNoID0gKChoYXNoIDw8IDUpICsgaGFzaCArIG5hbWUuY2hhckNvZGVBdChpKSkgfCAwO1xuICB9XG4gIGNvbnN0IGlkeCA9ICgoaGFzaCAlIENPTE9SX1BBTEVUVEUubGVuZ3RoKSArIENPTE9SX1BBTEVUVEUubGVuZ3RoKSAlIENPTE9SX1BBTEVUVEUubGVuZ3RoO1xuICByZXR1cm4gQ09MT1JfUEFMRVRURVtpZHhdID8/IEZBTExCQUNLO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEF3YXJlbmVzcyBzdGF0ZSBzaGFwZS5cblxuZXhwb3J0IGludGVyZmFjZSBDb2xsYWJBd2FyZW5lc3NTdGF0ZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgY29sb3I6IHN0cmluZztcbiAgLyoqXG4gICAqIEN1cnNvciBwb3NpdGlvbiBpbiAqKndvcmxkIGNvb3JkcyoqIChjYW52YXMtbGliIHZpZXdwb3J0IHNwYWNlKSBzbyBmb3JlaWduXG4gICAqIHBlZXJzIHNlZSB0aGUgc2FtZSBjb25jZXB0dWFsIHBvaW50IGV2ZW4gd2hlbiB0aGVpciBsb2NhbCB2aWV3cG9ydCBpc1xuICAgKiBwYW5uZWQvem9vbWVkIGRpZmZlcmVudGx5LiBOdWxsID0gcGVlciBpcyBub3Qgb3ZlciB0aGUgY2FudmFzIHN1cmZhY2UuXG4gICAqL1xuICBjdXJzb3I6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB8IG51bGw7XG4gIC8qKlxuICAgKiBNb3N0LXJlY2VudGx5IHNlbGVjdGVkIGVsZW1lbnQuIGBjc3NQYXRoYCBpcyB0aGUgbG9jYXRvciBpZCBjaGFpbiB0aGVcbiAgICogY2FudmFzLXNoZWxsIGFscmVhZHkgdXNlczsgYGJvdW5kc2AgYXJlIHNjcmVlbi1weCByZWN0IGF0IHRoZSBtb21lbnQgb2ZcbiAgICogcHVibGlzaCAoc28gaXQncyBhIGhpbnQsIG5vdCBhIGxpdmUgcmVmKS4gTnVsbCB3aGVuIG5vdGhpbmcgc2VsZWN0ZWQuXG4gICAqL1xuICBzZWxlY3Rpb246IHsgY3NzUGF0aDogc3RyaW5nOyBib3VuZHM6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHc6IG51bWJlcjsgaDogbnVtYmVyIH0gfSB8IG51bGw7XG4gIC8qKlxuICAgKiBDdXJyZW50bHktc2VsZWN0ZWQgYW5ub3RhdGlvbiBzdHJva2UgSURzIChQaGFzZSA1KS4gU3Ryb2tlcyBhcmUgYWRkcmVzc2VkXG4gICAqIGJ5IHRoZWlyIHN0YWJsZSBgZGF0YS1pZGAgYXR0cmlidXRlLCBzbyBwZWVycyBjYW4gcmVzb2x2ZSBoYWxvcyB2aWFcbiAgICogYGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWlkPVwiPGlkPlwiXScpYC4gRW1wdHkgd2hlbiBub3RoaW5nXG4gICAqIGFubm90YXRpb24tc2hhcGVkIGlzIHNlbGVjdGVkLlxuICAgKi9cbiAgYW5ub3RhdGlvblNlbGVjdGlvbjogc3RyaW5nW107XG4gIHZpZXdwb3J0OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB6b29tOiBudW1iZXIgfTtcbiAgLyoqXG4gICAqIFNlcnZlci1zaWRlIGBkaXNjb25uZWN0YCBtYXRjaGVzIGF3YXJlbmVzcyBzdGF0ZXMgdG8gb3V0Z29pbmcgcGVlcnMgYnlcbiAgICogdGhpcyB0b2tlbiAobXVzdCBlcXVhbCB0aGUgd3MuZGF0YS5pZCB0aGUgc2VydmVyIGFzc2lnbnMgYXQgdXBncmFkZSkuXG4gICAqIFVudGlsIHRoZSBzZXJ2ZXIgcHVzaGVzIHRoZSBhc3NpZ25lZCBpZCBiYWNrIHRvIHRoZSBjbGllbnQsIHdlIHVzZSBhXG4gICAqIGNsaWVudC1nZW5lcmF0ZWQgVVVJRCDigJQgY29sbGlzaW9ucyBhcmUgbmVnbGlnaWJsZSBhbmQgZGlzY29ubmVjdCBjbGVhbnVwXG4gICAqIHRvbGVyYXRlcyBhIHN0YWxlIHN0YXRlICh0aGUgbmV4dCBhd2FyZW5lc3MgR0MgcGFzcyBkcm9wcyBpdCkuXG4gICAqL1xuICBfX2Nvbm5JZDogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBGb3JlaWduQXdhcmVuZXNzID0gT21pdDxDb2xsYWJBd2FyZW5lc3NTdGF0ZSwgJ19fY29ubklkJz4gJiB7IGNsaWVudElEOiBudW1iZXIgfTtcblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBVbnRydXN0ZWQtaW5wdXQgc2FuaXRpemF0aW9uIGF0IHRoZSBhd2FyZW5lc3MgdHJ1c3QgYm91bmRhcnkuXG4vL1xuLy8gUGhhc2UgOCBhd2FyZW5lc3Mgd2FzIGxvb3BiYWNrLW9ubHkg4oCUIGV2ZXJ5IHN0YXRlIGNhbWUgZnJvbSBhIHRydXN0ZWQgbG9jYWxcbi8vIHRhYi4gUGhhc2UgOSAoVGFzayA1KSBicmlkZ2VzIGF3YXJlbmVzcyB0aHJvdWdoIGEgU0VNSS1UUlVTVEVEIGh1YiAoRERSLTA1NCksXG4vLyBzbyBmb3JlaWduIHN0YXRlcyBhcmUgbm93IGF0dGFja2VyLWluZmx1ZW5jZWFibGUuIGB1c2VGb3JlaWduQXdhcmVuZXNzYCBpc1xuLy8gdGhlIHNpbmdsZSBjaG9rZXBvaW50IHdoZXJlIHJlbW90ZSBzdGF0ZSBpcyByZWFkIGJlZm9yZSBpdCByZWFjaGVzIHRoZVxuLy8gY3Vyc29yIC8gcGFydGljaXBhbnQgcmVuZGVyIHNpbmtzLCBzbyBhbGwgdmFsaWRhdGlvbiBsaXZlcyBoZXJlLiBGaWVsZHMgYXJlXG4vLyB2YWxpZGF0ZWQgZm9yIFZBTFVFLCBub3QganVzdCB0eXBlOlxuLy8gICAtIGNvbG9yOiByZS1kZXJpdmVkIGxvY2FsbHkgZnJvbSB0aGUgKHNhbml0aXplZCkgbmFtZSBhbmQgdGhlIHdpcmUgdmFsdWVcbi8vICAgICBpcyBESVNDQVJERUQg4oCUIGEgaHViLWNob3NlbiBgY29sb3JgIHN0cmluZyB3b3VsZCBvdGhlcndpc2UgZmxvdyBpbnRvIGFuXG4vLyAgICAgaW5saW5lIGBzdHlsZWAgYW5kIGEgYHVybCguLi4pYCB2YWx1ZSBiZWFjb25zIGV2ZXJ5IHZpZXdlcidzIGJyb3dzZXIuXG4vLyAgICAgVGhlIHBhbGV0dGUgaXMgZGV0ZXJtaW5pc3RpYywgc28gcmUtZGVyaXZhdGlvbiBpcyB2aXN1YWxseSBpZGVudGljYWwuXG4vLyAgIC0gbmFtZTogY29udHJvbCAvIGJpZGkgLyB6ZXJvLXdpZHRoIGNoYXJzIHN0cmlwcGVkLCBsZW5ndGgtY2FwcGVkIOKAlCBibG9ja3Ncbi8vICAgICBpZGVudGl0eSBzcG9vZmluZyArIHJlbmRlciBibG9hdC5cbi8vICAgLSBjdXJzb3IgLyB2aWV3cG9ydDogZmluaXRlLW51bWJlciBnYXRlZCDigJQgYSBOYU4vSW5maW5pdHkgd291bGQgcG9pc29uIHRoZVxuLy8gICAgIENTUyB0cmFuc2Zvcm0gLyB0aGUgbG9jYWwgdmlld3BvcnQgY29udHJvbGxlciBkdXJpbmcgRm9sbG93IG1vZGUuXG4vLyAgIC0gc2VsZWN0aW9uLmNzc1BhdGg6IGNoYXJzZXQgKyBsZW5ndGggYWxsb3dsaXN0IGJlZm9yZSBpdCByZWFjaGVzXG4vLyAgICAgYHF1ZXJ5U2VsZWN0b3JgIOKAlCBibG9ja3Mgc2VsZWN0b3ItY29tcGxleGl0eSBEb1MgKyBhcmJpdHJhcnkgRE9NIHByb2JpbmcuXG4vLyAgIC0gYW5ub3RhdGlvblNlbGVjdGlvbjogcGVyLWlkIHRva2VuICsgYXJyYXktbGVuZ3RoIGNhcHBlZCDigJQgYmxvY2tzIGFcbi8vICAgICBxdWVyeVNlbGVjdG9yIHJlbmRlci1zdG9ybS5cbi8vICAgLSBwZWVyIGNvdW50IGNhcHBlZCDigJQgYmxvY2tzIGFuIHVuYm91bmRlZC1jbGllbnRzIG1lbW9yeS9yZW5kZXIgRG9TLlxuXG5jb25zdCBNQVhfRk9SRUlHTl9QRUVSUyA9IDY0O1xuY29uc3QgTUFYX05BTUVfTEVOID0gNjQ7XG5jb25zdCBNQVhfQ1NTUEFUSF9MRU4gPSA1MTI7XG5jb25zdCBNQVhfQU5OT1RBVElPTl9JRFMgPSAyNTY7XG5jb25zdCBNQVhfQU5OT1RBVElPTl9JRF9MRU4gPSAxMjg7XG5cbi8vIENoYXJzZXQgb2YgZXZlcnkgc2VsZWN0b3IgdGhlIGNhbnZhcy1zaGVsbCBgY3NzUGF0aCgpYCBlbWl0c1xuLy8gKGBbZGF0YS0qPVwiLi4uXCJdYCwgYCNpZGAsIGB0YWcuY2xzOm50aC1jaGlsZChOKWAsIGAgPiBgIGNvbWJpbmF0b3JzKS5cbmNvbnN0IENTU1BBVEhfQUxMT1dFRCA9IC9eW0EtWmEtejAtOSAuXyM+OltcXF09XCInKCktXSskLztcbi8vIGBjc3NQYXRoKClgIG9ubHkgZXZlciBlbWl0cyBgOm50aC1jaGlsZChOKWAgYXMgYSBwYXJlbnRoZXNpc2VkIGNvbnN0cnVjdC5cbi8vIEZ1bmN0aW9uYWwgcHNldWRvLWNsYXNzZXMgKGA6aGFzKClgLCBgOmlzKClgLCBgOndoZXJlKClgLCBgOm5vdCgpYCkgdHJpZ2dlclxuLy8gcGVyLXJlbmRlciBzdWJ0cmVlIHdhbGtzIOKGkiBhIG1hbGljaW91cyBodWIgcGVlciBjb3VsZCBwdWJsaXNoIGEgZGVlcGx5XG4vLyBuZXN0ZWQgYDpoYXMoKWAgc2VsZWN0b3IgYW5kIHBpbiBldmVyeSB2aWV3ZXIncyBtYWluIHRocmVhZCAocXVlcnlTZWxlY3RvclxuLy8gcmUtcnVucyBlYWNoIHJlbmRlcikuIFNvIGFmdGVyIHN0cmlwcGluZyB0aGUgbGVnaXQgYDpudGgtY2hpbGQvb2YtdHlwZShOKWBcbi8vIGZvcm1zLCBhbnkgcmVzaWR1YWwgcGFyZW4gbWVhbnMgYSBmdW5jdGlvbmFsIHBzZXVkbyDigJQgcmVqZWN0LiBUaGUgY2hhcnNldFxuLy8gYWxsb3dsaXN0IGFsb25lIHdhcyB3aWRlciB0aGFuIHRoZSBnZW5lcmF0b3IgKHRoZSBvcmlnaW5hbCBEb1MgaG9sZSkuXG5jb25zdCBDU1NQQVRIX05USCA9IC86bnRoLShjaGlsZHxvZi10eXBlKVxcKFxcZHsxLDR9XFwpL2c7XG5jb25zdCBBTk5PVEFUSU9OX0lEX0FMTE9XRUQgPSAvXltBLVphLXowLTkuXzotXSskLztcblxuZnVuY3Rpb24gaXNTYWZlQ3NzUGF0aChwOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgaWYgKHAubGVuZ3RoID4gTUFYX0NTU1BBVEhfTEVOIHx8ICFDU1NQQVRIX0FMTE9XRUQudGVzdChwKSkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBzdHJpcHBlZCA9IHAucmVwbGFjZShDU1NQQVRIX05USCwgJycpO1xuICByZXR1cm4gIXN0cmlwcGVkLmluY2x1ZGVzKCcoJykgJiYgIXN0cmlwcGVkLmluY2x1ZGVzKCcpJyk7XG59XG5cbmZ1bmN0aW9uIGlzRmluaXRlTnVtKHY6IHVua25vd24pOiB2IGlzIG51bWJlciB7XG4gIHJldHVybiB0eXBlb2YgdiA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHYpO1xufVxuXG4vLyBDb250cm9sIChDMC9DMSksIHplcm8td2lkdGgsIGFuZCBiaWRpLW92ZXJyaWRlIGNvZGUgcG9pbnRzIGdldCBzdHJpcHBlZCBmcm9tXG4vLyBkaXNwbGF5ZWQgc3RyaW5ncyBzbyBhIHJlbW90ZSBwZWVyIGNhbid0IHNwb29mIGFub3RoZXIncyBpZGVudGl0eSBvciBoaWRlXG4vLyBwYXlsb2FkcyBpbiBsYWJlbHMuIEEgY2hhckNvZGUgc2NhbiAobm90IGEgcmVnZXggbGl0ZXJhbCB3aXRoIHJhdyBjb250cm9sXG4vLyBjaGFycykgc2lkZXN0ZXBzIGJpb21lJ3Mgbm9Db250cm9sQ2hhcmFjdGVyc0luUmVnZXggd2hpbGUga2VlcGluZyB0aGUgc2FtZVxuLy8gc2VtYW50aWNzIOKAlCBzYW1lIGFwcHJvYWNoIGFzIHRoZSBodWIncyBzYW5pdGl6ZUZvckxvZyAoRERSLTA1MykuXG5mdW5jdGlvbiBpc1Vuc2FmZUNvZGVQb2ludChjcDogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgY3AgPD0gMHgxZiB8fFxuICAgIChjcCA+PSAweDdmICYmIGNwIDw9IDB4OWYpIHx8XG4gICAgKGNwID49IDB4MjAwYiAmJiBjcCA8PSAweDIwMGYpIHx8XG4gICAgKGNwID49IDB4MjAyYSAmJiBjcCA8PSAweDIwMmUpIHx8XG4gICAgKGNwID49IDB4MjA2NiAmJiBjcCA8PSAweDIwNjkpIHx8XG4gICAgY3AgPT09IDB4ZmVmZlxuICApO1xufVxuXG5mdW5jdGlvbiBzYW5pdGl6ZU5hbWUocmF3OiB1bmtub3duKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiByYXcgIT09ICdzdHJpbmcnKSByZXR1cm4gJ2Fub255bW91cyc7XG4gIGxldCBjbGVhbmVkID0gJyc7XG4gIGZvciAoY29uc3QgY2ggb2YgcmF3KSB7XG4gICAgaWYgKCFpc1Vuc2FmZUNvZGVQb2ludChjaC5jb2RlUG9pbnRBdCgwKSA/PyAwKSkgY2xlYW5lZCArPSBjaDtcbiAgfVxuICBjbGVhbmVkID0gY2xlYW5lZC50cmltKCkuc2xpY2UoMCwgTUFYX05BTUVfTEVOKTtcbiAgcmV0dXJuIGNsZWFuZWQgfHwgJ2Fub255bW91cyc7XG59XG5cbmZ1bmN0aW9uIHNhbml0aXplQ3Vyc29yKHJhdzogdW5rbm93bik6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB8IG51bGwge1xuICBpZiAoIXJhdyB8fCB0eXBlb2YgcmF3ICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGMgPSByYXcgYXMgeyB4PzogdW5rbm93bjsgeT86IHVua25vd24gfTtcbiAgcmV0dXJuIGlzRmluaXRlTnVtKGMueCkgJiYgaXNGaW5pdGVOdW0oYy55KSA/IHsgeDogYy54LCB5OiBjLnkgfSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIHNhbml0aXplVmlld3BvcnQocmF3OiB1bmtub3duKTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgem9vbTogbnVtYmVyIH0ge1xuICBjb25zdCBmYWxsYmFjayA9IHsgeDogMCwgeTogMCwgem9vbTogMSB9O1xuICBpZiAoIXJhdyB8fCB0eXBlb2YgcmF3ICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbGxiYWNrO1xuICBjb25zdCB2ID0gcmF3IGFzIHsgeD86IHVua25vd247IHk/OiB1bmtub3duOyB6b29tPzogdW5rbm93biB9O1xuICBpZiAoIWlzRmluaXRlTnVtKHYueCkgfHwgIWlzRmluaXRlTnVtKHYueSkgfHwgIWlzRmluaXRlTnVtKHYuem9vbSkgfHwgdi56b29tIDw9IDApXG4gICAgcmV0dXJuIGZhbGxiYWNrO1xuICByZXR1cm4geyB4OiB2LngsIHk6IHYueSwgem9vbTogdi56b29tIH07XG59XG5cbmZ1bmN0aW9uIHNhbml0aXplU2VsZWN0aW9uKHJhdzogdW5rbm93bik6IENvbGxhYkF3YXJlbmVzc1N0YXRlWydzZWxlY3Rpb24nXSB7XG4gIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcyA9IHJhdyBhcyB7IGNzc1BhdGg/OiB1bmtub3duOyBib3VuZHM/OiB1bmtub3duIH07XG4gIGNvbnN0IGIgPSBzLmJvdW5kcyBhcyB7IHg/OiB1bmtub3duOyB5PzogdW5rbm93bjsgdz86IHVua25vd247IGg/OiB1bmtub3duIH0gfCB1bmRlZmluZWQ7XG4gIGNvbnN0IGJvdW5kcyA9XG4gICAgYiAmJiBpc0Zpbml0ZU51bShiLngpICYmIGlzRmluaXRlTnVtKGIueSkgJiYgaXNGaW5pdGVOdW0oYi53KSAmJiBpc0Zpbml0ZU51bShiLmgpXG4gICAgICA/IHsgeDogYi54LCB5OiBiLnksIHc6IGIudywgaDogYi5oIH1cbiAgICAgIDogbnVsbDtcbiAgLy8gT25seSBrZWVwIGNzc1BhdGggaWYgaXQgbWF0Y2hlcyB0aGUgbG9jYXRvciBncmFtbWFyIOKAlCBvdGhlcndpc2UgZHJvcCBpdCBhbmRcbiAgLy8gbGV0IHRoZSByZW5kZXJlciBmYWxsIGJhY2sgdG8gdGhlICh2YWxpZGF0ZWQpIGJvdW5kcy5cbiAgY29uc3QgY3NzUGF0aCA9IHR5cGVvZiBzLmNzc1BhdGggPT09ICdzdHJpbmcnICYmIGlzU2FmZUNzc1BhdGgocy5jc3NQYXRoKSA/IHMuY3NzUGF0aCA6ICcnO1xuICBpZiAoIWNzc1BhdGggJiYgIWJvdW5kcykgcmV0dXJuIG51bGw7XG4gIHJldHVybiB7IGNzc1BhdGgsIGJvdW5kczogYm91bmRzID8/IHsgeDogMCwgeTogMCwgdzogMCwgaDogMCB9IH07XG59XG5cbmZ1bmN0aW9uIHNhbml0aXplQW5ub3RhdGlvblNlbGVjdGlvbihyYXc6IHVua25vd24pOiBzdHJpbmdbXSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShyYXcpKSByZXR1cm4gW107XG4gIGNvbnN0IG91dDogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBpZCBvZiByYXcpIHtcbiAgICBpZiAob3V0Lmxlbmd0aCA+PSBNQVhfQU5OT1RBVElPTl9JRFMpIGJyZWFrO1xuICAgIGlmIChcbiAgICAgIHR5cGVvZiBpZCA9PT0gJ3N0cmluZycgJiZcbiAgICAgIGlkLmxlbmd0aCA8PSBNQVhfQU5OT1RBVElPTl9JRF9MRU4gJiZcbiAgICAgIEFOTk9UQVRJT05fSURfQUxMT1dFRC50ZXN0KGlkKVxuICAgIClcbiAgICAgIG91dC5wdXNoKGlkKTtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG4vKipcbiAqIFZhbGlkYXRlICsgbm9ybWFsaXplIG9uZSBmb3JlaWduIGF3YXJlbmVzcyBzdGF0ZSBhdCB0aGUgdHJ1c3QgYm91bmRhcnkuXG4gKiBSZXR1cm5zIG51bGwgZm9yIHN0YXRlcyB0aGF0IGNhbid0IGJlIGEgcGVlciAobm8gdXNhYmxlIG5hbWUpLiBgY29sb3JgIGlzXG4gKiBhbHdheXMgcmUtZGVyaXZlZCBsb2NhbGx5IGZyb20gdGhlIHNhbml0aXplZCBuYW1lIOKAlCB0aGUgd2lyZSB2YWx1ZSBpcyBuZXZlclxuICogdHJ1c3RlZCwgd2hpY2ggaXMgd2hhdCBjbG9zZXMgdGhlIGh1YiBDU1MtYHVybCgpYCBleGZpbCBjaGFubmVsLiBFeHBvcnRlZCBzb1xuICogdGhlIGhvc3RpbGUtaW5wdXQgbWF0cml4IGNhbiBleGVyY2lzZSBpdCB3aXRob3V0IGEgUmVhY3QgaGFybmVzcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNhbml0aXplRm9yZWlnblN0YXRlKGNsaWVudElEOiBudW1iZXIsIHN0YXRlOiB1bmtub3duKTogRm9yZWlnbkF3YXJlbmVzcyB8IG51bGwge1xuICBpZiAoIXN0YXRlIHx8IHR5cGVvZiBzdGF0ZSAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICBjb25zdCBzID0gc3RhdGUgYXMgUGFydGlhbDxDb2xsYWJBd2FyZW5lc3NTdGF0ZT47XG4gIGlmICh0eXBlb2Ygcy5uYW1lICE9PSAnc3RyaW5nJykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IG5hbWUgPSBzYW5pdGl6ZU5hbWUocy5uYW1lKTtcbiAgcmV0dXJuIHtcbiAgICBjbGllbnRJRCxcbiAgICBuYW1lLFxuICAgIGNvbG9yOiBjb2xvckZvck5hbWUobmFtZSksXG4gICAgY3Vyc29yOiBzYW5pdGl6ZUN1cnNvcihzLmN1cnNvciksXG4gICAgc2VsZWN0aW9uOiBzYW5pdGl6ZVNlbGVjdGlvbihzLnNlbGVjdGlvbiksXG4gICAgYW5ub3RhdGlvblNlbGVjdGlvbjogc2FuaXRpemVBbm5vdGF0aW9uU2VsZWN0aW9uKHMuYW5ub3RhdGlvblNlbGVjdGlvbiksXG4gICAgdmlld3BvcnQ6IHNhbml0aXplVmlld3BvcnQocy52aWV3cG9ydCksXG4gIH07XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29udGV4dC5cblxuaW50ZXJmYWNlIENvbGxhYlZhbHVlIHtcbiAgZG9jOiBZLkRvYztcbiAgLyoqXG4gICAqIFNFQ1VSSVRZIElOVkFSSUFOVDogaW4gbGlua2VkIG1vZGUgdGhpcyBBd2FyZW5lc3MgY2FycmllcyBzdGF0ZXMgcmVsYXllZFxuICAgKiBmcm9tIGEgU0VNSS1UUlVTVEVEIGh1YiAoRERSLTA1NCkuIEZvcmVpZ24gc3RhdGVzIGFyZSB1bnRydXN0ZWQgaW5wdXQg4oCUXG4gICAqIHJlYWQgdGhlbSBPTkxZIHRocm91Z2ggYHVzZUZvcmVpZ25Bd2FyZW5lc3NgLCB3aGljaCBzYW5pdGl6ZXMgZXZlcnkgZmllbGRcbiAgICogYXQgdGhlIHRydXN0IGJvdW5kYXJ5IChgc2FuaXRpemVGb3JlaWduU3RhdGVgKS4gRG8gTk9UIGNhbGxcbiAgICogYGF3YXJlbmVzcy5nZXRTdGF0ZXMoKWAgZGlyZWN0bHkgaW4gcmVuZGVyIGNvZGU7IHRoYXQgYnlwYXNzZXMgdGhlIGdhdGUuXG4gICAqL1xuICBhd2FyZW5lc3M6IEF3YXJlbmVzcztcbiAgLyoqIExvY2FsIHBlZXIncyBzZXNzaW9uLXN0YWJsZSBjb2xvciAoZGVyaXZlZCBmcm9tIGdpdCB1c2VyLm5hbWUpLiAqL1xuICBteUNvbG9yOiBzdHJpbmc7XG4gIC8qKiBMb2NhbCBwZWVyJ3MgZGlzcGxheSBuYW1lIChnaXQgdXNlci5uYW1lIG9yIGFub255bW91cyBmYWxsYmFjaykuICovXG4gIG15TmFtZTogc3RyaW5nO1xuICAvKiogTG9jYWwgcGVlcidzIGNvbm5lY3Rpb24gaWQgKG1hdGNoZXMgc2VydmVyLXNpZGUgd3MuZGF0YS5pZCBwYXR0ZXJuKS4gKi9cbiAgbXlDb25uSWQ6IHN0cmluZztcbiAgLyoqIFRydWUgd2hlbiB0aGUgV1MgaXMgT1BFTi4gQ3Vyc29yIG92ZXJsYXkgY2FuIHVzZSB0aGlzIHRvIGdhdGUgcmVuZGVyaW5nLiAqL1xuICBjb25uZWN0ZWQ6IGJvb2xlYW47XG4gIC8qKiBQdWJsaXNoIChkZWJvdW5jZS1jb2FsZXNjZWQpIGFuIHVwZGF0ZWQgbG9jYWwgYXdhcmVuZXNzIHN0YXRlLiAqL1xuICBwdWJsaXNoQXdhcmVuZXNzOiAocGF0Y2g6IFBhcnRpYWw8T21pdDxDb2xsYWJBd2FyZW5lc3NTdGF0ZSwgJ19fY29ubklkJz4+KSA9PiB2b2lkO1xufVxuXG5jb25zdCBDb2xsYWJDb250ZXh0ID0gY3JlYXRlQ29udGV4dDxDb2xsYWJWYWx1ZSB8IG51bGw+KG51bGwpO1xuXG5leHBvcnQgZnVuY3Rpb24gdXNlQ29sbGFiKCk6IENvbGxhYlZhbHVlIHwgbnVsbCB7XG4gIHJldHVybiB1c2VDb250ZXh0KENvbGxhYkNvbnRleHQpO1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEhvb2s6IGZvcmVpZ24gYXdhcmVuZXNzIHBlZXJzICh0aGUgY3Vyc29yIG92ZXJsYXkgc3Vic2NyaWJlcyB0byB0aGlzKS5cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBjdXJyZW50IHNldCBvZiBmb3JlaWduIHBlZXJzIChleGNsdWRlcyB0aGUgbG9jYWwgY2xpZW50KS4gVGhlXG4gKiByZXR1cm5lZCBhcnJheSBpcyBzdGFibGUtcmVmZXJlbmNlIGJldHdlZW4gYXdhcmVuZXNzIHVwZGF0ZXMg4oCUIHVzZWZ1bCBmb3JcbiAqIGRvd25zdHJlYW0gUmVhY3QubWVtbyBjdXJzb3IgY29tcG9uZW50cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVzZUZvcmVpZ25Bd2FyZW5lc3MoKTogRm9yZWlnbkF3YXJlbmVzc1tdIHtcbiAgY29uc3QgY29sbGFiID0gdXNlQ29sbGFiKCk7XG4gIGNvbnN0IFtwZWVycywgc2V0UGVlcnNdID0gdXNlU3RhdGU8Rm9yZWlnbkF3YXJlbmVzc1tdPihbXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWNvbGxhYikge1xuICAgICAgc2V0UGVlcnMoW10pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCB7IGF3YXJlbmVzcyB9ID0gY29sbGFiO1xuICAgIGZ1bmN0aW9uIGNvbXB1dGUoKTogRm9yZWlnbkF3YXJlbmVzc1tdIHtcbiAgICAgIGNvbnN0IG91dDogRm9yZWlnbkF3YXJlbmVzc1tdID0gW107XG4gICAgICBjb25zdCBteUlkID0gYXdhcmVuZXNzLmNsaWVudElEO1xuICAgICAgZm9yIChjb25zdCBbY2xpZW50SUQsIHN0YXRlXSBvZiBhd2FyZW5lc3MuZ2V0U3RhdGVzKCkgYXMgTWFwPG51bWJlciwgdW5rbm93bj4pIHtcbiAgICAgICAgaWYgKGNsaWVudElEID09PSBteUlkKSBjb250aW51ZTtcbiAgICAgICAgaWYgKG91dC5sZW5ndGggPj0gTUFYX0ZPUkVJR05fUEVFUlMpIGJyZWFrOyAvLyBib3VuZCBEb1MgdmlhIHVuYm91bmRlZCBwZWVyc1xuICAgICAgICAvLyBTYW5pdGl6ZSBldmVyeSBub3ctcmVtb3RlIGZpZWxkIGF0IHRoaXMgdHJ1c3QgYm91bmRhcnkgKFRhc2sgNSkuXG4gICAgICAgIGNvbnN0IHBlZXIgPSBzYW5pdGl6ZUZvcmVpZ25TdGF0ZShjbGllbnRJRCwgc3RhdGUpO1xuICAgICAgICBpZiAocGVlcikgb3V0LnB1c2gocGVlcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gb3V0O1xuICAgIH1cbiAgICBzZXRQZWVycyhjb21wdXRlKCkpO1xuICAgIGNvbnN0IG9uQ2hhbmdlID0gKCkgPT4gc2V0UGVlcnMoY29tcHV0ZSgpKTtcbiAgICBhd2FyZW5lc3Mub24oJ2NoYW5nZScsIG9uQ2hhbmdlKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgYXdhcmVuZXNzLm9mZignY2hhbmdlJywgb25DaGFuZ2UpO1xuICAgIH07XG4gIH0sIFtjb2xsYWJdKTtcblxuICByZXR1cm4gcGVlcnM7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gU2x1ZyBkZXJpdmF0aW9uIOKAlCBtdXN0IG1hdGNoIGBhcGkuZmlsZVNsdWdgIHNlcnZlci1zaWRlLlxuXG4vKipcbiAqIE1pcnJvciBvZiBzZXJ2ZXItc2lkZSBgYXBpLmZpbGVTbHVnYC4gVGhlIGlucHV0IGlzIHRoZSBjYW52YXMgcGF0aCBhcyB0aGVcbiAqIHNoZWxsIHN0b3JlZCBpdCBvbiBgd2luZG93Ll9fY2FudmFzX21ldGFfZmlsZV9fYCAoZS5nLiBgLmRlc2lnbi91aS9Gb28udHN4YCkuXG4gKiBTdHJpcCB0aGUgZGVzaWduUmVsIHByZWZpeCAocmVhZCBmcm9tIGB3aW5kb3cuX19jYW52YXNfZGVzaWduX3JlbF9fYCwgc2V0XG4gKiBieSBfc2hlbGwuaHRtbCkgc28gYm90aCBzaWRlcyBsYW5kIG9uIHRoZSBzYW1lIHNsdWcg4oCUIHdpdGhvdXQgdGhpcyBib3RoXG4gKiB0YWJzIG9wZW4gYSBgZGVzaWduLXVpLWZvb2Agcm9vbSB3aGlsZSB0aGUgc2VydmVyJ3MgaW5zcGVjdG9yIGJyaWRnZVxuICogcHVzaGVzIGludG8gYHVpLWZvb2AsIGFuZCB0aGUgcm9vbXMgbmV2ZXIgY29udmVyZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYW52YXNTbHVnRnJvbVBhdGgoY2FudmFzUmVsOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICghY2FudmFzUmVsKSByZXR1cm4gbnVsbDtcbiAgbGV0IHAgPSBjYW52YXNSZWwucmVwbGFjZSgvXlxcLyt8XFwvKyQvZywgJycpO1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjb25zdCB3ID0gd2luZG93IGFzIHVua25vd24gYXMgeyBfX2NhbnZhc19kZXNpZ25fcmVsX18/OiBzdHJpbmcgfTtcbiAgICBjb25zdCBkZXNpZ25SZWwgPSAody5fX2NhbnZhc19kZXNpZ25fcmVsX18gPz8gJycpLnJlcGxhY2UoL15cXC8rfFxcLyskL2csICcnKTtcbiAgICBpZiAoZGVzaWduUmVsICYmIHAuc3RhcnRzV2l0aChgJHtkZXNpZ25SZWx9L2ApKSBwID0gcC5zbGljZShkZXNpZ25SZWwubGVuZ3RoICsgMSk7XG4gIH1cbiAgY29uc3Qgc2x1ZyA9IHBcbiAgICAucmVwbGFjZSgvXFwvL2csICctJylcbiAgICAucmVwbGFjZSgvXFxzKy9nLCAnXycpXG4gICAgLnJlcGxhY2UoL1xcLih0c3h8aHRtbCkkL2ksICcnKVxuICAgIC5yZXBsYWNlKC9eXFwuKy8sICcnKVxuICAgIC50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gL15bYS16MC05Xy1dKyQvLnRlc3Qoc2x1ZykgPyBzbHVnIDogbnVsbDtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBQcm92aWRlciDigJQgb3BlbnMgV1MsIG93bnMgWS5Eb2MgKyBBd2FyZW5lc3MgbGlmZWN5Y2xlLlxuXG5pbnRlcmZhY2UgQ29sbGFiUHJvdmlkZXJQcm9wcyB7XG4gIC8qKiBDYW52YXMgc2x1ZyDigJQgbXVzdCBtYXRjaCBzZXJ2ZXItc2lkZSBgcGFyc2VDb2xsYWJTbHVnYC4gKi9cbiAgc2x1Zzogc3RyaW5nO1xuICBjaGlsZHJlbjogUmVhY3ROb2RlO1xufVxuXG5jb25zdCBBV0FSRU5FU1NfVEhST1RUTEVfTVMgPSAzMzsgLy8gfjMwIEh6XG5cbmV4cG9ydCBmdW5jdGlvbiBDb2xsYWJQcm92aWRlcih7IHNsdWcsIGNoaWxkcmVuIH06IENvbGxhYlByb3ZpZGVyUHJvcHMpOiBKU1guRWxlbWVudCB7XG4gIC8vIFkuRG9jICsgQXdhcmVuZXNzIGFyZSByZWNyZWF0ZWQgd2hlbmV2ZXIgdGhlIHNsdWcgY2hhbmdlcyAoc3dpdGNoaW5nXG4gIC8vIGNhbnZhc2VzIHRlYXJzIGRvd24gdGhlIHByaW9yIHNlc3Npb24gY2xlYW5seSkuIFRoZSB1c2VNZW1vIGZhY3RvcnlcbiAgLy8gYm9kaWVzIGRvbid0IHJlYWQgYHNsdWdgIOKAlCBzbHVnIElTIHRoZSBjYWNoZSBrZXksIGludGVudGlvbmFsbHkuXG4gIC8vIGJpb21lLWlnbm9yZSBsaW50L2NvcnJlY3RuZXNzL3VzZUV4aGF1c3RpdmVEZXBlbmRlbmNpZXM6IHNsdWcgaXMgdGhlIGNhY2hlIGtleVxuICBjb25zdCBkb2MgPSB1c2VNZW1vKCgpID0+IG5ldyBZLkRvYygpLCBbc2x1Z10pO1xuICBjb25zdCBhd2FyZW5lc3MgPSB1c2VNZW1vKCgpID0+IG5ldyBBd2FyZW5lc3MoZG9jKSwgW2RvY10pO1xuICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VFeGhhdXN0aXZlRGVwZW5kZW5jaWVzOiBzbHVnIGlzIHRoZSBjYWNoZSBrZXlcbiAgY29uc3QgbXlDb25uSWQgPSB1c2VNZW1vKCgpID0+IGNyeXB0by5yYW5kb21VVUlEKCksIFtzbHVnXSk7XG5cbiAgY29uc3QgW215TmFtZSwgc2V0TXlOYW1lXSA9IHVzZVN0YXRlKCdhbm9ueW1vdXMnKTtcbiAgY29uc3QgW215Q29sb3IsIHNldE15Q29sb3JdID0gdXNlU3RhdGUoY29sb3JGb3JOYW1lKCdhbm9ueW1vdXMnKSk7XG4gIGNvbnN0IFtjb25uZWN0ZWQsIHNldENvbm5lY3RlZF0gPSB1c2VTdGF0ZShmYWxzZSk7XG5cbiAgLy8gRmV0Y2ggZ2l0IHVzZXIubmFtZSBvbmNlIHBlciBzbHVnOyBmYWxscyBiYWNrIHRvIGFub255bW91cy08c2hvcnQgaWQ+LlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcbiAgICBmZXRjaCgnL19hcGkvZ2l0LXVzZXInKVxuICAgICAgLnRoZW4oKHIpID0+IHIuanNvbigpKVxuICAgICAgLnRoZW4oKGopID0+IHtcbiAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBuID0gdHlwZW9mIGo/Lm5hbWUgPT09ICdzdHJpbmcnICYmIGoubmFtZS50cmltKCkgPyBqLm5hbWUudHJpbSgpIDogbnVsbDtcbiAgICAgICAgY29uc3QgZmluYWxOYW1lID0gbiA/PyBgYW5vbnltb3VzLSR7bXlDb25uSWQuc2xpY2UoMCwgNil9YDtcbiAgICAgICAgc2V0TXlOYW1lKGZpbmFsTmFtZSk7XG4gICAgICAgIHNldE15Q29sb3IoY29sb3JGb3JOYW1lKGZpbmFsTmFtZSkpO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVybjtcbiAgICAgICAgY29uc3QgZmFsbGJhY2sgPSBgYW5vbnltb3VzLSR7bXlDb25uSWQuc2xpY2UoMCwgNil9YDtcbiAgICAgICAgc2V0TXlOYW1lKGZhbGxiYWNrKTtcbiAgICAgICAgc2V0TXlDb2xvcihjb2xvckZvck5hbWUoZmFsbGJhY2spKTtcbiAgICAgIH0pO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjYW5jZWxsZWQgPSB0cnVlO1xuICAgIH07XG4gIH0sIFtteUNvbm5JZF0pO1xuXG4gIC8vIFNlZWQgbG9jYWwgYXdhcmVuZXNzIHN0YXRlIGltbWVkaWF0ZWx5IHNvIGZvcmVpZ24gcGVlcnMgc2VlIG91ciBuYW1lIGV2ZW5cbiAgLy8gYmVmb3JlIHRoZSBjdXJzb3IgbW92ZXMuIFVwZGF0ZSB3aGVuIG15TmFtZS9teUNvbG9yIHNldHRsZXMgZnJvbSB0aGUgZmV0Y2guXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXdhcmVuZXNzLnNldExvY2FsU3RhdGUoe1xuICAgICAgbmFtZTogbXlOYW1lLFxuICAgICAgY29sb3I6IG15Q29sb3IsXG4gICAgICBjdXJzb3I6IG51bGwsXG4gICAgICBzZWxlY3Rpb246IG51bGwsXG4gICAgICBhbm5vdGF0aW9uU2VsZWN0aW9uOiBbXSxcbiAgICAgIHZpZXdwb3J0OiB7IHg6IDAsIHk6IDAsIHpvb206IDEgfSxcbiAgICAgIF9fY29ubklkOiBteUNvbm5JZCxcbiAgICB9IHNhdGlzZmllcyBDb2xsYWJBd2FyZW5lc3NTdGF0ZSk7XG4gIH0sIFthd2FyZW5lc3MsIG15TmFtZSwgbXlDb2xvciwgbXlDb25uSWRdKTtcblxuICAvLyDilIDilIAgV2ViU29ja2V0IGxpZmVjeWNsZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAgY29uc3Qgd3NSZWYgPSB1c2VSZWY8V2ViU29ja2V0IHwgbnVsbD4obnVsbCk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2U7XG4gICAgbGV0IHJlY29ubmVjdFRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGwgPSBudWxsO1xuXG4gICAgZnVuY3Rpb24gc2VuZEZyYW1lKHdzOiBXZWJTb2NrZXQsIHBheWxvYWQ6IFVpbnQ4QXJyYXkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHdzLnNlbmQocGF5bG9hZCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyogZGVhZCBzb2NrZXQg4oCUIGNsb3NlIGhhbmRsZXIgd2lsbCByZWNvbm5lY3QgKi9cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBicm9hZGNhc3RBd2FyZW5lc3Mod3M6IFdlYlNvY2tldCwgY2hhbmdlZDogbnVtYmVyW10pIHtcbiAgICAgIGlmIChjaGFuZ2VkLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgY29uc3QgZW5jb2RlciA9IGVuY29kaW5nLmNyZWF0ZUVuY29kZXIoKTtcbiAgICAgIGVuY29kaW5nLndyaXRlVmFyVWludChlbmNvZGVyLCBNRVNTQUdFX0FXQVJFTkVTUyk7XG4gICAgICBlbmNvZGluZy53cml0ZVZhclVpbnQ4QXJyYXkoZW5jb2RlciwgZW5jb2RlQXdhcmVuZXNzVXBkYXRlKGF3YXJlbmVzcywgY2hhbmdlZCkpO1xuICAgICAgc2VuZEZyYW1lKHdzLCBlbmNvZGluZy50b1VpbnQ4QXJyYXkoZW5jb2RlcikpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJyb2FkY2FzdFN5bmNVcGRhdGUod3M6IFdlYlNvY2tldCwgdXBkYXRlOiBVaW50OEFycmF5KSB7XG4gICAgICBjb25zdCBlbmNvZGVyID0gZW5jb2RpbmcuY3JlYXRlRW5jb2RlcigpO1xuICAgICAgZW5jb2Rpbmcud3JpdGVWYXJVaW50KGVuY29kZXIsIE1FU1NBR0VfU1lOQyk7XG4gICAgICB3cml0ZVVwZGF0ZShlbmNvZGVyLCB1cGRhdGUpO1xuICAgICAgc2VuZEZyYW1lKHdzLCBlbmNvZGluZy50b1VpbnQ4QXJyYXkoZW5jb2RlcikpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbm5lY3QoKSB7XG4gICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm47XG4gICAgICBjb25zdCBwcm90byA9IGxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JyA/ICd3c3M6JyA6ICd3czonO1xuICAgICAgY29uc3Qgd3MgPSBuZXcgV2ViU29ja2V0KGAke3Byb3RvfS8vJHtsb2NhdGlvbi5ob3N0fS9fd3MvY29sbGFiLyR7c2x1Z31gKTtcbiAgICAgIHdzLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgICAgd3NSZWYuY3VycmVudCA9IHdzO1xuXG4gICAgICB3cy5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgKCkgPT4ge1xuICAgICAgICBzZXRDb25uZWN0ZWQodHJ1ZSk7XG4gICAgICAgIC8vIFN5bmMgc3RlcCAxIOKAlCBhbm5vdW5jZSBvdXIgc3RhdGUgdmVjdG9yIHNvIHRoZSBzZXJ2ZXIgY2FuIHNlbmQgdGhlXG4gICAgICAgIC8vIG1pc3NpbmcgcGllY2VzIChtYXRjaGVzIHRoZSBlbmNvZGVIYW5kc2hha2Ugc2VydmVyIHBhdGgpLlxuICAgICAgICBjb25zdCBlbmNvZGVyID0gZW5jb2RpbmcuY3JlYXRlRW5jb2RlcigpO1xuICAgICAgICBlbmNvZGluZy53cml0ZVZhclVpbnQoZW5jb2RlciwgTUVTU0FHRV9TWU5DKTtcbiAgICAgICAgd3JpdGVTeW5jU3RlcDEoZW5jb2RlciwgZG9jKTtcbiAgICAgICAgc2VuZEZyYW1lKHdzLCBlbmNvZGluZy50b1VpbnQ4QXJyYXkoZW5jb2RlcikpO1xuICAgICAgICAvLyBBd2FyZW5lc3MgaW5pdGlhbCBzdGF0ZSDigJQgZmlyZSBvdXIgbG9jYWwgc3RhdGUgdG8gdGhlIHJvb20uXG4gICAgICAgIGJyb2FkY2FzdEF3YXJlbmVzcyh3cywgW2F3YXJlbmVzcy5jbGllbnRJRF0pO1xuICAgICAgfSk7XG5cbiAgICAgIHdzLmFkZEV2ZW50TGlzdGVuZXIoJ2Nsb3NlJywgKCkgPT4ge1xuICAgICAgICBzZXRDb25uZWN0ZWQoZmFsc2UpO1xuICAgICAgICB3c1JlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuO1xuICAgICAgICByZWNvbm5lY3RUaW1lciA9IHNldFRpbWVvdXQoY29ubmVjdCwgMTAwMCk7XG4gICAgICB9KTtcblxuICAgICAgd3MuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCAoKSA9PiB7XG4gICAgICAgIC8vIExldCBjbG9zZSBoYW5kbGVyIGRvIHRoZSByZWNvbm5lY3Q7IGVycm9yIGV2ZW50cyB3aXRob3V0IGEgY2xvc2VcbiAgICAgICAgLy8gd291bGQganVzdCByZXRyeS1zcGFtLlxuICAgICAgfSk7XG5cbiAgICAgIHdzLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAoZXZ0KSA9PiB7XG4gICAgICAgIGNvbnN0IHBheWxvYWQgPVxuICAgICAgICAgIGV2dC5kYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXJcbiAgICAgICAgICAgID8gbmV3IFVpbnQ4QXJyYXkoZXZ0LmRhdGEpXG4gICAgICAgICAgICA6IGV2dC5kYXRhIGluc3RhbmNlb2YgVWludDhBcnJheVxuICAgICAgICAgICAgICA/IGV2dC5kYXRhXG4gICAgICAgICAgICAgIDogbnVsbDtcbiAgICAgICAgaWYgKCFwYXlsb2FkKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGRlY29kZXIgPSBkZWNvZGluZy5jcmVhdGVEZWNvZGVyKHBheWxvYWQpO1xuICAgICAgICBjb25zdCBtZXNzYWdlVHlwZSA9IGRlY29kaW5nLnJlYWRWYXJVaW50KGRlY29kZXIpO1xuICAgICAgICBzd2l0Y2ggKG1lc3NhZ2VUeXBlKSB7XG4gICAgICAgICAgY2FzZSBNRVNTQUdFX1NZTkM6IHtcbiAgICAgICAgICAgIGNvbnN0IGVuY29kZXIgPSBlbmNvZGluZy5jcmVhdGVFbmNvZGVyKCk7XG4gICAgICAgICAgICBlbmNvZGluZy53cml0ZVZhclVpbnQoZW5jb2RlciwgTUVTU0FHRV9TWU5DKTtcbiAgICAgICAgICAgIHJlYWRTeW5jTWVzc2FnZShkZWNvZGVyLCBlbmNvZGVyLCBkb2MsIHdzKTtcbiAgICAgICAgICAgIGlmIChlbmNvZGluZy5sZW5ndGgoZW5jb2RlcikgPiAxKSBzZW5kRnJhbWUod3MsIGVuY29kaW5nLnRvVWludDhBcnJheShlbmNvZGVyKSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgY2FzZSBNRVNTQUdFX0FXQVJFTkVTUzoge1xuICAgICAgICAgICAgYXBwbHlBd2FyZW5lc3NVcGRhdGUoYXdhcmVuZXNzLCBkZWNvZGluZy5yZWFkVmFyVWludDhBcnJheShkZWNvZGVyKSwgd3MpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gV2lyZSBkb2MgdXBkYXRlcyDihpIgYnJvYWRjYXN0IHRvIHNlcnZlci4gT3JpZ2luIHRhZ2dlZCB3aXRoIHRoZSB3cyByZWYgc29cbiAgICAvLyBzZXJ2ZXItc2lkZSB1cGRhdGVzIHdlIHJlY2VpdmUgZG9uJ3QgZWNobyBiYWNrLlxuICAgIGNvbnN0IG9uRG9jVXBkYXRlID0gKHVwZGF0ZTogVWludDhBcnJheSwgb3JpZ2luOiB1bmtub3duKSA9PiB7XG4gICAgICBjb25zdCB3cyA9IHdzUmVmLmN1cnJlbnQ7XG4gICAgICBpZiAoIXdzIHx8IHdzLnJlYWR5U3RhdGUgIT09IFdlYlNvY2tldC5PUEVOKSByZXR1cm47XG4gICAgICBpZiAob3JpZ2luID09PSB3cykgcmV0dXJuOyAvLyBjYW1lIGZyb20gc2VydmVyLCBkb24ndCBlY2hvXG4gICAgICBicm9hZGNhc3RTeW5jVXBkYXRlKHdzLCB1cGRhdGUpO1xuICAgIH07XG4gICAgZG9jLm9uKCd1cGRhdGUnLCBvbkRvY1VwZGF0ZSk7XG5cbiAgICAvLyBXaXJlIGF3YXJlbmVzcyBjaGFuZ2VzIOKGkiBicm9hZGNhc3QuIFNhbWUgb3JpZ2luIGd1YXJkLlxuICAgIGNvbnN0IG9uQXdhcmVuZXNzVXBkYXRlID0gKFxuICAgICAgeyBhZGRlZCwgdXBkYXRlZCwgcmVtb3ZlZCB9OiB7IGFkZGVkOiBudW1iZXJbXTsgdXBkYXRlZDogbnVtYmVyW107IHJlbW92ZWQ6IG51bWJlcltdIH0sXG4gICAgICBvcmlnaW46IHVua25vd25cbiAgICApID0+IHtcbiAgICAgIGNvbnN0IHdzID0gd3NSZWYuY3VycmVudDtcbiAgICAgIGlmICghd3MgfHwgd3MucmVhZHlTdGF0ZSAhPT0gV2ViU29ja2V0Lk9QRU4pIHJldHVybjtcbiAgICAgIGlmIChvcmlnaW4gPT09IHdzKSByZXR1cm47XG4gICAgICBjb25zdCBjaGFuZ2VkID0gYWRkZWQuY29uY2F0KHVwZGF0ZWQsIHJlbW92ZWQpO1xuICAgICAgYnJvYWRjYXN0QXdhcmVuZXNzKHdzLCBjaGFuZ2VkKTtcbiAgICB9O1xuICAgIGF3YXJlbmVzcy5vbigndXBkYXRlJywgb25Bd2FyZW5lc3NVcGRhdGUpO1xuXG4gICAgY29ubmVjdCgpO1xuXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNhbmNlbGxlZCA9IHRydWU7XG4gICAgICBpZiAocmVjb25uZWN0VGltZXIpIGNsZWFyVGltZW91dChyZWNvbm5lY3RUaW1lcik7XG4gICAgICBkb2Mub2ZmKCd1cGRhdGUnLCBvbkRvY1VwZGF0ZSk7XG4gICAgICBhd2FyZW5lc3Mub2ZmKCd1cGRhdGUnLCBvbkF3YXJlbmVzc1VwZGF0ZSk7XG4gICAgICBjb25zdCB3cyA9IHdzUmVmLmN1cnJlbnQ7XG4gICAgICBpZiAod3MgJiYgd3MucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3cy5jbG9zZSgpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvKiBpZ25vcmUgKi9cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gRG9uJ3QgZGVzdHJveSBkb2MvYXdhcmVuZXNzIGhlcmUg4oCUIHRoZSB1c2VNZW1vLXRpZWQgbGlmZXRpbWUgaGFuZGxlc1xuICAgICAgLy8gdGhhdCB3aGVuIHRoZSBzbHVnIGNoYW5nZXMuXG4gICAgfTtcbiAgfSwgW3NsdWcsIGRvYywgYXdhcmVuZXNzXSk7XG5cbiAgLy8gUGVyLXNsdWcgY2xlYW51cCBvZiBkb2MvYXdhcmVuZXNzIHdoZW4gc2x1ZyBjaGFuZ2VzIChvciBwcm92aWRlciB1bm1vdW50cykuXG4gIHVzZUVmZmVjdChcbiAgICAoKSA9PiAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FyZW5lc3MuZGVzdHJveSgpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgZG9jLmRlc3Ryb3koKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvKiBpZ25vcmUgKi9cbiAgICAgIH1cbiAgICB9LFxuICAgIFtkb2MsIGF3YXJlbmVzc11cbiAgKTtcblxuICAvLyDilIDilIAgVGhyb3R0bGVkIGF3YXJlbmVzcyBwdWJsaXNoIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICBjb25zdCBwZW5kaW5nUmVmID0gdXNlUmVmPFBhcnRpYWw8T21pdDxDb2xsYWJBd2FyZW5lc3NTdGF0ZSwgJ19fY29ubklkJz4+IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IHRocm90dGxlVGltZXJSZWYgPSB1c2VSZWY8UmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsPihudWxsKTtcblxuICBjb25zdCBwdWJsaXNoQXdhcmVuZXNzID0gdXNlQ2FsbGJhY2soXG4gICAgKHBhdGNoOiBQYXJ0aWFsPE9taXQ8Q29sbGFiQXdhcmVuZXNzU3RhdGUsICdfX2Nvbm5JZCc+PikgPT4ge1xuICAgICAgcGVuZGluZ1JlZi5jdXJyZW50ID0geyAuLi4ocGVuZGluZ1JlZi5jdXJyZW50ID8/IHt9KSwgLi4ucGF0Y2ggfTtcbiAgICAgIGlmICh0aHJvdHRsZVRpbWVyUmVmLmN1cnJlbnQpIHJldHVybjtcbiAgICAgIHRocm90dGxlVGltZXJSZWYuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aHJvdHRsZVRpbWVyUmVmLmN1cnJlbnQgPSBudWxsO1xuICAgICAgICBjb25zdCBuZXh0ID0gcGVuZGluZ1JlZi5jdXJyZW50O1xuICAgICAgICBwZW5kaW5nUmVmLmN1cnJlbnQgPSBudWxsO1xuICAgICAgICBpZiAoIW5leHQpIHJldHVybjtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IChhd2FyZW5lc3MuZ2V0TG9jYWxTdGF0ZSgpID8/IHt9KSBhcyBQYXJ0aWFsPENvbGxhYkF3YXJlbmVzc1N0YXRlPjtcbiAgICAgICAgYXdhcmVuZXNzLnNldExvY2FsU3RhdGUoe1xuICAgICAgICAgIG5hbWU6IGN1cnJlbnQubmFtZSA/PyBteU5hbWUsXG4gICAgICAgICAgY29sb3I6IGN1cnJlbnQuY29sb3IgPz8gbXlDb2xvcixcbiAgICAgICAgICBjdXJzb3I6IGN1cnJlbnQuY3Vyc29yID8/IG51bGwsXG4gICAgICAgICAgc2VsZWN0aW9uOiBjdXJyZW50LnNlbGVjdGlvbiA/PyBudWxsLFxuICAgICAgICAgIGFubm90YXRpb25TZWxlY3Rpb246IGN1cnJlbnQuYW5ub3RhdGlvblNlbGVjdGlvbiA/PyBbXSxcbiAgICAgICAgICB2aWV3cG9ydDogY3VycmVudC52aWV3cG9ydCA/PyB7IHg6IDAsIHk6IDAsIHpvb206IDEgfSxcbiAgICAgICAgICBfX2Nvbm5JZDogbXlDb25uSWQsXG4gICAgICAgICAgLi4ubmV4dCxcbiAgICAgICAgfSBzYXRpc2ZpZXMgQ29sbGFiQXdhcmVuZXNzU3RhdGUpO1xuICAgICAgfSwgQVdBUkVORVNTX1RIUk9UVExFX01TKTtcbiAgICB9LFxuICAgIFthd2FyZW5lc3MsIG15TmFtZSwgbXlDb2xvciwgbXlDb25uSWRdXG4gICk7XG5cbiAgLy8g4pSA4pSAIENsZWFudXAgdGhyb3R0bGUgdGltZXIgb24gdW5tb3VudCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAgdXNlRWZmZWN0KFxuICAgICgpID0+ICgpID0+IHtcbiAgICAgIGlmICh0aHJvdHRsZVRpbWVyUmVmLmN1cnJlbnQpIGNsZWFyVGltZW91dCh0aHJvdHRsZVRpbWVyUmVmLmN1cnJlbnQpO1xuICAgIH0sXG4gICAgW11cbiAgKTtcblxuICBjb25zdCB2YWx1ZSA9IHVzZU1lbW88Q29sbGFiVmFsdWU+KFxuICAgICgpID0+ICh7XG4gICAgICBkb2MsXG4gICAgICBhd2FyZW5lc3MsXG4gICAgICBteUNvbG9yLFxuICAgICAgbXlOYW1lLFxuICAgICAgbXlDb25uSWQsXG4gICAgICBjb25uZWN0ZWQsXG4gICAgICBwdWJsaXNoQXdhcmVuZXNzLFxuICAgIH0pLFxuICAgIFtkb2MsIGF3YXJlbmVzcywgbXlDb2xvciwgbXlOYW1lLCBteUNvbm5JZCwgY29ubmVjdGVkLCBwdWJsaXNoQXdhcmVuZXNzXVxuICApO1xuXG4gIHJldHVybiA8Q29sbGFiQ29udGV4dC5Qcm92aWRlciB2YWx1ZT17dmFsdWV9PntjaGlsZHJlbn08L0NvbGxhYkNvbnRleHQuUHJvdmlkZXI+O1xufVxuIiwKICAgICIvKipcbiAqIEBmaWxlICAgICAgIHVzZS1zZWxlY3Rpb24tc2V0LnRzeCDigJQgUGhhc2UgNC4xIG11bHRpLXNlbGVjdGlvbiBzdG9yZVxuICogQHNjb3BlICAgICAgcGx1Z2lucy9kZXNpZ24vZGV2LXNlcnZlci91c2Utc2VsZWN0aW9uLXNldC50c3hcbiAqIEBwdXJwb3NlICAgIE11bHRpLWVsZW1lbnQgc2VsZWN0aW9uIHN0YXRlIGZvciBjYW52YXMtc2hlbGwuIFRoZSBjYW52YXNcbiAqICAgICAgICAgICAgIGlucHV0IHJvdXRlciBjYWxscyBgcmVwbGFjZSgpYCAvIGBhZGQoKWAgLyBgY2xlYXIoKWA7XG4gKiAgICAgICAgICAgICB0aGUgcHJvdmlkZXIgZGVib3VuY2VzIGFuZCBwb3N0cyB1cCB0byB0aGUgZGV2LXNlcnZlciBzaGVsbFxuICogICAgICAgICAgICAgdGhyb3VnaCB0aGUgZXhpc3RpbmcgYF9fZGVzaWduX3NlbGVjdGVkYCB3aW5kb3cucGFyZW50IGNoYW5uZWxcbiAqICAgICAgICAgICAgIHNvIGBfYWN0aXZlLmpzb25gIHJlZmxlY3RzIHRoZSBjdXJyZW50IHNlbGVjdGlvbiBzZXQuXG4gKlxuICogU2NoZW1hIG1pZ3JhdGlvbi4gYF9hY3RpdmUuanNvbiNzZWxlY3RlZGAgaGlzdG9yaWNhbGx5IGhvbGRzXG4gKiAgICAgc2VsZWN0ZWQ6IFNlbGVjdGVkRWxlbWVudCB8IG51bGxcbiAqIFBoYXNlIDQuMSB3aWRlbnMgdG9cbiAqICAgICBzZWxlY3RlZDogU2VsZWN0ZWRFbGVtZW50IHwgU2VsZWN0ZWRFbGVtZW50W10gfCBudWxsXG4gKiBXcml0ZXI6IGVtaXRzIGEgc2luZ2xlIG9iamVjdCB3aGVuIE4gPT09IDEgKGJhY2stY29tcGF0IHdpdGggZG93bnN0cmVhbVxuICogdG9vbHMgdGhhdCBzdGlsbCByZWFkIHRoZSBsZWdhY3kgc2hhcGUg4oCUIGAvZGVzaWduOmVkaXRgLCBoYW5kb2ZmKS4gRW1pdHMgYW5cbiAqIGFycmF5IHdoZW4gTiA+IDEuIFJlYWRlciAodGhpcyBob29rIG9uIHJlaHlkcmF0ZSkgYWNjZXB0cyBhbGwgdGhyZWUuXG4gKi9cblxuaW1wb3J0IHtcbiAgdHlwZSBSZWFjdE5vZGUsXG4gIGNyZWF0ZUNvbnRleHQsXG4gIHVzZUNhbGxiYWNrLFxuICB1c2VDb250ZXh0LFxuICB1c2VFZmZlY3QsXG4gIHVzZU1lbW8sXG4gIHVzZVJlZixcbiAgdXNlU3RhdGUsXG59IGZyb20gJ3JlYWN0JztcblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUeXBlc1xuXG4vKipcbiAqIE1pbmltYWwgU2VsZWN0aW9uIHNoYXBlIHRoYXQgdHJhdmVscyB0aHJvdWdoIHRoZSBwYXJlbnQgcG9zdE1lc3NhZ2UgY2hhbm5lbC5cbiAqIE1pcnJvcnMgYFNlbGVjdGVkRWxlbWVudGAgZnJvbSBpbnNwZWN0LnRzIGJ1dCB0aGUgY2FudmFzIHJvdXRlciBjb21wdXRlcyBpdFxuICogY2xpZW50LXNpZGUgYW5kIHRoZSBpbnNwZWN0b3Igb3ZlcmxheSdzIGVucmljaG1lbnQgZmllbGRzIChodG1sIGV4Y2VycHQsXG4gKiBkb21fcGF0aCwgY2xhc3Nlcy4uLikgYXJlIGZpbGxlZCBpbiBieSB0aGUgcm91dGVyIHJpZ2h0IGJlZm9yZSB0aGUgbWVzc2FnZVxuICogaXMgcG9zdGVkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNlbGVjdGlvbiB7XG4gIC8qKiBDYW52YXMgZmlsZSBwYXRoIOKAlCBkZXNpZ25SZWwtcHJlZml4ZWQgKGUuZy4gYC5kZXNpZ24vdWkvRm9vLnRzeGApLiAqL1xuICBmaWxlPzogc3RyaW5nO1xuICAvKiogU3RhYmxlIGBkYXRhLWNkLWlkYCBhbmNob3Igd2hlbiBwcmVzZW50LiB2Mi1ncmFkZSBvbmx5LiAqL1xuICBpZD86IHN0cmluZztcbiAgLyoqIENTUy1zZWxlY3RvciBmYWxsYmFjayBwYXRoIChhbHdheXMgcHJlc2VudCkuICovXG4gIHNlbGVjdG9yOiBzdHJpbmc7XG4gIC8qKiBBcnRib2FyZCBob3N0IChgZGF0YS1kYy1zY3JlZW5gKSDigJQgZm9yIHNjb3BpbmcgbXVsdGktZWRpdHMgaW4gZnV0dXJlLiAqL1xuICBhcnRib2FyZElkPzogc3RyaW5nIHwgbnVsbDtcbiAgLyoqIFNuYXBzaG90IGZpZWxkcyBmaWxsZWQgYnkgdGhlIHJvdXRlciBmcm9tIGByZXNvbHZlSG92ZXJUYXJnZXRgLiAqL1xuICB0YWc/OiBzdHJpbmc7XG4gIGNsYXNzZXM/OiBzdHJpbmc7XG4gIHRleHQ/OiBzdHJpbmc7XG4gIGRvbV9wYXRoPzogc3RyaW5nW107XG4gIGJvdW5kcz86IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHc6IG51bWJlcjsgaDogbnVtYmVyIH0gfCBudWxsO1xuICBodG1sPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU2VsZWN0aW9uU2V0VmFsdWUge1xuICBzZWxlY3RlZDogU2VsZWN0aW9uW107XG4gIHJlcGxhY2U6IChzOiBTZWxlY3Rpb24gfCBTZWxlY3Rpb25bXSkgPT4gdm9pZDtcbiAgYWRkOiAoczogU2VsZWN0aW9uIHwgU2VsZWN0aW9uW10pID0+IHZvaWQ7XG4gIHJlbW92ZTogKHM6IFNlbGVjdGlvbikgPT4gdm9pZDtcbiAgdG9nZ2xlOiAoczogU2VsZWN0aW9uKSA9PiB2b2lkO1xuICBjbGVhcjogKCkgPT4gdm9pZDtcbn1cblxuY29uc3QgU2VsZWN0aW9uU2V0Q29udGV4dCA9IGNyZWF0ZUNvbnRleHQ8U2VsZWN0aW9uU2V0VmFsdWUgfCBudWxsPihudWxsKTtcblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBJZGVudGl0eS4gUHJlZmVyIGBpZGAgKGRhdGEtY2QtaWQgc3RhYmxlIGFuY2hvcik7IGZhbGwgYmFjayB0byBzZWxlY3Rvci5cblxuZnVuY3Rpb24gc2VsZWN0aW9uS2V5KHM6IFNlbGVjdGlvbik6IHN0cmluZyB7XG4gIHJldHVybiBzLmlkID8gYGlkOiR7cy5pZH1gIDogYHNlbDoke3Muc2VsZWN0b3J9YDtcbn1cblxuZnVuY3Rpb24gZGVkdXBlKGxpc3Q6IFNlbGVjdGlvbltdKTogU2VsZWN0aW9uW10ge1xuICBjb25zdCBvdXQ6IFNlbGVjdGlvbltdID0gW107XG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgZm9yIChjb25zdCBzIG9mIGxpc3QpIHtcbiAgICBjb25zdCBrID0gc2VsZWN0aW9uS2V5KHMpO1xuICAgIGlmIChzZWVuLmhhcyhrKSkgY29udGludWU7XG4gICAgc2Vlbi5hZGQoayk7XG4gICAgb3V0LnB1c2gocyk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBQcm92aWRlclxuXG5jb25zdCBQT1NUX0RFQk9VTkNFX01TID0gNTA7IC8vIG1pcnJvcnMgY2FudmFzLWxpYidzIFNFVFRMRS9QVUJMSVNIIGNhZGVuY2VcblxuZXhwb3J0IGZ1bmN0aW9uIFNlbGVjdGlvblNldFByb3ZpZGVyKHtcbiAgY2hpbGRyZW4sXG4gIC8qKiBPdmVycmlkZSB0aGUgcG9zdE1lc3NhZ2UgZGVzdGluYXRpb24gKHVzZWQgaW4gdGVzdHMpLiAqL1xuICBwb3N0VGFyZ2V0LFxufToge1xuICBjaGlsZHJlbjogUmVhY3ROb2RlO1xuICBwb3N0VGFyZ2V0PzogeyBwb3N0TWVzc2FnZTogKG1zZzogdW5rbm93biwgdGFyZ2V0T3JpZ2luOiBzdHJpbmcpID0+IHZvaWQgfSB8IG51bGw7XG59KSB7XG4gIGNvbnN0IFtzZWxlY3RlZCwgc2V0U2VsZWN0ZWRdID0gdXNlU3RhdGU8U2VsZWN0aW9uW10+KFtdKTtcbiAgY29uc3QgdGltZXJSZWYgPSB1c2VSZWY8UmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsPihudWxsKTtcblxuICBjb25zdCBwb3N0ID0gdXNlQ2FsbGJhY2soXG4gICAgKG5leHQ6IFNlbGVjdGlvbltdKSA9PiB7XG4gICAgICBpZiAodGltZXJSZWYuY3VycmVudCkgY2xlYXJUaW1lb3V0KHRpbWVyUmVmLmN1cnJlbnQpO1xuICAgICAgdGltZXJSZWYuY3VycmVudCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aW1lclJlZi5jdXJyZW50ID0gbnVsbDtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gcG9zdFRhcmdldCA/PyAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cucGFyZW50IDogbnVsbCk7XG4gICAgICAgIGlmICghdGFyZ2V0KSByZXR1cm47XG4gICAgICAgIC8vIFdpcmUgc2hhcGU6IHNpbmdsZSBvYmplY3QgZm9yIE49MSAoYmFjay1jb21wYXQpLCBhcnJheSBmb3IgTj4xLCBudWxsIGZvciBlbXB0eS5cbiAgICAgICAgY29uc3QgcGF5bG9hZDogU2VsZWN0aW9uIHwgU2VsZWN0aW9uW10gfCBudWxsID1cbiAgICAgICAgICBuZXh0Lmxlbmd0aCA9PT0gMCA/IG51bGwgOiBuZXh0Lmxlbmd0aCA9PT0gMSA/IChuZXh0WzBdID8/IG51bGwpIDogbmV4dDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0YXJnZXQucG9zdE1lc3NhZ2UoeyBkZ246ICdzZWxlY3Qtc2V0Jywgc2VsZWN0aW9uOiBwYXlsb2FkIH0sICcqJyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8qIGlmcmFtZSBsaWtlbHkgY3Jvc3Mtb3JpZ2luIG9yIGRldGFjaGVkICovXG4gICAgICAgIH1cbiAgICAgIH0sIFBPU1RfREVCT1VOQ0VfTVMpO1xuICAgIH0sXG4gICAgW3Bvc3RUYXJnZXRdXG4gICk7XG5cbiAgLy8gQ2xlYW51cCB0aGUgZGVib3VuY2UgdGltZXIgb24gdW5tb3VudC5cbiAgdXNlRWZmZWN0KFxuICAgICgpID0+ICgpID0+IHtcbiAgICAgIGlmICh0aW1lclJlZi5jdXJyZW50KSBjbGVhclRpbWVvdXQodGltZXJSZWYuY3VycmVudCk7XG4gICAgfSxcbiAgICBbXVxuICApO1xuXG4gIGNvbnN0IHJlcGxhY2UgPSB1c2VDYWxsYmFjayhcbiAgICAoczogU2VsZWN0aW9uIHwgU2VsZWN0aW9uW10pID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBkZWR1cGUoQXJyYXkuaXNBcnJheShzKSA/IHMgOiBbc10pO1xuICAgICAgc2V0U2VsZWN0ZWQobmV4dCk7XG4gICAgICBwb3N0KG5leHQpO1xuICAgIH0sXG4gICAgW3Bvc3RdXG4gICk7XG5cbiAgY29uc3QgYWRkID0gdXNlQ2FsbGJhY2soXG4gICAgKHM6IFNlbGVjdGlvbiB8IFNlbGVjdGlvbltdKSA9PiB7XG4gICAgICBjb25zdCBpbmNvbWluZyA9IEFycmF5LmlzQXJyYXkocykgPyBzIDogW3NdO1xuICAgICAgc2V0U2VsZWN0ZWQoKHByZXYpID0+IHtcbiAgICAgICAgY29uc3QgbmV4dCA9IGRlZHVwZShbLi4ucHJldiwgLi4uaW5jb21pbmddKTtcbiAgICAgICAgcG9zdChuZXh0KTtcbiAgICAgICAgcmV0dXJuIG5leHQ7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIFtwb3N0XVxuICApO1xuXG4gIGNvbnN0IHJlbW92ZSA9IHVzZUNhbGxiYWNrKFxuICAgIChzOiBTZWxlY3Rpb24pID0+IHtcbiAgICAgIGNvbnN0IGsgPSBzZWxlY3Rpb25LZXkocyk7XG4gICAgICBzZXRTZWxlY3RlZCgocHJldikgPT4ge1xuICAgICAgICBjb25zdCBuZXh0ID0gcHJldi5maWx0ZXIoKHgpID0+IHNlbGVjdGlvbktleSh4KSAhPT0gayk7XG4gICAgICAgIHBvc3QobmV4dCk7XG4gICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBbcG9zdF1cbiAgKTtcblxuICBjb25zdCB0b2dnbGUgPSB1c2VDYWxsYmFjayhcbiAgICAoczogU2VsZWN0aW9uKSA9PiB7XG4gICAgICBjb25zdCBrID0gc2VsZWN0aW9uS2V5KHMpO1xuICAgICAgc2V0U2VsZWN0ZWQoKHByZXYpID0+IHtcbiAgICAgICAgY29uc3QgbmV4dCA9IHByZXYuc29tZSgoeCkgPT4gc2VsZWN0aW9uS2V5KHgpID09PSBrKVxuICAgICAgICAgID8gcHJldi5maWx0ZXIoKHgpID0+IHNlbGVjdGlvbktleSh4KSAhPT0gaylcbiAgICAgICAgICA6IFsuLi5wcmV2LCBzXTtcbiAgICAgICAgcG9zdChuZXh0KTtcbiAgICAgICAgcmV0dXJuIG5leHQ7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIFtwb3N0XVxuICApO1xuXG4gIGNvbnN0IGNsZWFyID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldFNlbGVjdGVkKFtdKTtcbiAgICBwb3N0KFtdKTtcbiAgfSwgW3Bvc3RdKTtcblxuICBjb25zdCB2YWx1ZSA9IHVzZU1lbW88U2VsZWN0aW9uU2V0VmFsdWU+KFxuICAgICgpID0+ICh7IHNlbGVjdGVkLCByZXBsYWNlLCBhZGQsIHJlbW92ZSwgdG9nZ2xlLCBjbGVhciB9KSxcbiAgICBbc2VsZWN0ZWQsIHJlcGxhY2UsIGFkZCwgcmVtb3ZlLCB0b2dnbGUsIGNsZWFyXVxuICApO1xuXG4gIHJldHVybiA8U2VsZWN0aW9uU2V0Q29udGV4dC5Qcm92aWRlciB2YWx1ZT17dmFsdWV9PntjaGlsZHJlbn08L1NlbGVjdGlvblNldENvbnRleHQuUHJvdmlkZXI+O1xufVxuXG4vKipcbiAqIE1vdW50IGEgYFNlbGVjdGlvblNldFByb3ZpZGVyYCBvbmx5IHdoZW4gbm9uZSBleGlzdHMgYWJvdmUgdXMuIFRoZSBzaGVsbC1cbiAqIG93bmVkIGNvbW1lbnQgbW91bnQgbGF5ZXIgcHJvdmlkZXMgb25lIHNvIGJvdGggdGhlIGxpdGUgY29tbWVudCByb3V0ZXIgYW5kXG4gKiBgQ2FudmFzU2hlbGxgIHNoYXJlIGEgc2luZ2xlIHNlbGVjdGlvbiBzZXQuIEhvb2sgY2FsbGVkIHVuY29uZGl0aW9uYWxseTtcbiAqIG9ubHkgdGhlIHJldHVybmVkIHRyZWUgYnJhbmNoZXMgKGhvb2sgcnVsZXMpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gTWF5YmVTZWxlY3Rpb25TZXRQcm92aWRlcih7IGNoaWxkcmVuIH06IHsgY2hpbGRyZW46IFJlYWN0Tm9kZSB9KSB7XG4gIGNvbnN0IG91dGVyID0gdXNlQ29udGV4dChTZWxlY3Rpb25TZXRDb250ZXh0KTtcbiAgaWYgKG91dGVyKSByZXR1cm4gPD57Y2hpbGRyZW59PC8+O1xuICByZXR1cm4gPFNlbGVjdGlvblNldFByb3ZpZGVyPntjaGlsZHJlbn08L1NlbGVjdGlvblNldFByb3ZpZGVyPjtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBIb29rc1xuXG5leHBvcnQgZnVuY3Rpb24gdXNlU2VsZWN0aW9uU2V0KCk6IFNlbGVjdGlvblNldFZhbHVlIHtcbiAgY29uc3QgY3R4ID0gdXNlQ29udGV4dChTZWxlY3Rpb25TZXRDb250ZXh0KTtcbiAgaWYgKCFjdHgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VzZVNlbGVjdGlvblNldCBtdXN0IGJlIHVzZWQgaW5zaWRlIDxTZWxlY3Rpb25TZXRQcm92aWRlcj4nKTtcbiAgfVxuICByZXR1cm4gY3R4O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlU2VsZWN0aW9uU2V0T3B0aW9uYWwoKTogU2VsZWN0aW9uU2V0VmFsdWUgfCBudWxsIHtcbiAgcmV0dXJuIHVzZUNvbnRleHQoU2VsZWN0aW9uU2V0Q29udGV4dCk7XG59XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gV2lyZS1zaGFwZSBoZWxwZXJzIOKAlCBleHBvcnRlZCBmb3IgdGVzdHMgYW5kIGluc3BlY3QudHMgYmFjay1jb21wYXQgcmVhZGVyLlxuXG4vKiogQ29udmVydCBhbnkgaW5ib3VuZCBzaGFwZSB0byBhbiBhcnJheS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVTZWxlY3RlZFJlYWQoXG4gIHJhdzogU2VsZWN0aW9uIHwgU2VsZWN0aW9uW10gfCBudWxsIHwgdW5kZWZpbmVkXG4pOiBTZWxlY3Rpb25bXSB7XG4gIGlmIChyYXcgPT0gbnVsbCkgcmV0dXJuIFtdO1xuICBpZiAoQXJyYXkuaXNBcnJheShyYXcpKSByZXR1cm4gZGVkdXBlKHJhdyk7XG4gIHJldHVybiBbcmF3XTtcbn1cblxuLyoqIENvbnZlcnQgaW50ZXJuYWwgYXJyYXkgYmFjayB0byB0aGUgd2lyZSBzaGFwZSAod3JpdGVyKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZW5vcm1hbGl6ZVNlbGVjdGVkV3JpdGUobGlzdDogU2VsZWN0aW9uW10pOiBTZWxlY3Rpb24gfCBTZWxlY3Rpb25bXSB8IG51bGwge1xuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHJldHVybiBsaXN0WzBdID8/IG51bGw7XG4gIHJldHVybiBsaXN0O1xufVxuIiwKICAgICIvKipcbiAqIEBmaWxlICAgICAgIGRvbS1zZWxlY3Rpb24udHMg4oCUIHNlbGVjdGlvbi1mcm9tLURPTSBoZWxwZXJzIChsZWFmIG1vZHVsZSlcbiAqIEBzY29wZSAgICAgIHBsdWdpbnMvZGVzaWduL2Rldi1zZXJ2ZXIvZG9tLXNlbGVjdGlvbi50c1xuICogQHB1cnBvc2UgICAgUHVyZSBET00g4oaSIFNlbGVjdGlvbiBidWlsZGVycyBzaGFyZWQgYnkgdGhlIGNhbnZhcyBjaHJvbWVcbiAqICAgICAgICAgICAgIChjYW52YXMtc2hlbGwudHN4KSBhbmQgdGhlIHNoZWxsLW93bmVkIGNvbW1lbnQgbW91bnQgbGF5ZXJcbiAqICAgICAgICAgICAgIChjYW52YXMtY29tbWVudC1tb3VudC50c3gpLiBMaXZlcyBpbiBpdHMgb3duIGxlYWYgbW9kdWxlIOKAlCBub1xuICogICAgICAgICAgICAgUmVhY3QsIG5vIGNhbnZhcy1saWIgaW1wb3J0IOKAlCBzbyBib3RoIGNvbnN1bWVycyBjYW4gbGlmdCB0aGVcbiAqICAgICAgICAgICAgIHNhbWUgYGhvdmVyVGFyZ2V0VG9TZWxlY3Rpb25gIC8gYGRlcml2ZUZpbGVgIGxvZ2ljIHdpdGhvdXQgYVxuICogICAgICAgICAgICAgY3ljbGUgYW5kIHdpdGhvdXQgYnVuZGxpbmcgdGhlIGhlYXZ5IERlc2lnbkNhbnZhcyB0cmVlIGludG8gdGhlXG4gKiAgICAgICAgICAgICBsaXRlIGNvbW1lbnQgbW91bnQuXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBIb3ZlclRhcmdldCB9IGZyb20gJy4vaW5wdXQtcm91dGVyLnRzeCc7XG5pbXBvcnQgdHlwZSB7IFNlbGVjdGlvbiB9IGZyb20gJy4vdXNlLXNlbGVjdGlvbi1zZXQudHN4JztcblxuLyoqXG4gKiBDYW52YXMgZmlsZSBwYXRoIGZvciB0aGUgY3VycmVudCBwYWdlLiBVbmRlciB0aGUgbW91bnQgaGFybmVzcyB0aGUgcGFnZSBpc1xuICogYC9fY2FudmFzLXNoZWxsLmh0bWw/Y2FudmFzPTxyZWw+JmRlc2lnblJlbD08cm9vdD5gOyBmb3IgbGVnYWN5IGAuaHRtbGBcbiAqIG1vY2tzIGl0J3MgdGhlIHNlcnZlZCBmaWxlIHBhdGggaXRzZWxmLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVyaXZlRmlsZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiB1bmRlZmluZWQ7XG4gIHRyeSB7XG4gICAgY29uc3QgcCA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZTtcbiAgICBpZiAocCA9PT0gJy9fY2FudmFzLXNoZWxsLmh0bWwnIHx8IHAgPT09ICcvX2NhbnZhcy1zaGVsbCcpIHtcbiAgICAgIGNvbnN0IHFzID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTtcbiAgICAgIGNvbnN0IGNhbnZhcyA9IHFzLmdldCgnY2FudmFzJykgPz8gJyc7XG4gICAgICBjb25zdCBkZXNpZ25SZWwgPSAocXMuZ2V0KCdkZXNpZ25SZWwnKSA/PyAnLmRlc2lnbicpLnJlcGxhY2UoL15cXC8rfFxcLyskL2csICcnKTtcbiAgICAgIHJldHVybiBjYW52YXMgPyBgJHtkZXNpZ25SZWx9LyR7Y2FudmFzfWAgOiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocCkucmVwbGFjZSgvXlxcLy8sICcnKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhbENsYXNzZXMoZWw6IEVsZW1lbnQgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKCFlbCkgcmV0dXJuICcnO1xuICByZXR1cm4gKGVsLmdldEF0dHJpYnV0ZSgnY2xhc3MnKSA/PyAnJylcbiAgICAudHJpbSgpXG4gICAgLnNwbGl0KC9cXHMrLylcbiAgICAuZmlsdGVyKChjKSA9PiBjICYmICFjLnN0YXJ0c1dpdGgoJ2Rnbi0nKSAmJiAhYy5zdGFydHNXaXRoKCdkYy1jdi0nKSlcbiAgICAuam9pbignICcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvcnRUZXh0KGVsOiBFbGVtZW50IHwgbnVsbCwgbWF4OiBudW1iZXIpOiBzdHJpbmcge1xuICBpZiAoIWVsKSByZXR1cm4gJyc7XG4gIGNvbnN0IHQgPSAoKGVsIGFzIEhUTUxFbGVtZW50KS5pbm5lclRleHQgfHwgZWwudGV4dENvbnRlbnQgfHwgJycpLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCk7XG4gIHJldHVybiB0Lmxlbmd0aCA+IG1heCA/IGAke3Quc2xpY2UoMCwgbWF4IC0gMSl94oCmYCA6IHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjc3NQYXRoKGVsOiBFbGVtZW50IHwgbnVsbCk6IHN0cmluZyB7XG4gIGlmICghZWwpIHJldHVybiAnJztcbiAgY29uc3QgcGF0aDogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGN1cjogRWxlbWVudCB8IG51bGwgPSBlbDtcbiAgd2hpbGUgKGN1ciAmJiBjdXIubm9kZVR5cGUgPT09IDEgJiYgcGF0aC5sZW5ndGggPCA4KSB7XG4gICAgY29uc3QgZHNjRWwgPSBjdXIuZ2V0QXR0cmlidXRlPy4oJ2RhdGEtZGMtZWxlbWVudCcpO1xuICAgIGlmIChkc2NFbCkge1xuICAgICAgcGF0aC51bnNoaWZ0KGBbZGF0YS1kYy1lbGVtZW50PVwiJHtkc2NFbH1cIl1gKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjb25zdCBkc2NTYyA9IGN1ci5nZXRBdHRyaWJ1dGU/LignZGF0YS1kYy1zY3JlZW4nKTtcbiAgICBpZiAoZHNjU2MpIHtcbiAgICAgIHBhdGgudW5zaGlmdChgW2RhdGEtZGMtc2NyZWVuPVwiJHtkc2NTY31cIl1gKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBsZXQgc2VsID0gY3VyLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGN1ci5pZCkge1xuICAgICAgc2VsID0gYCMke2N1ci5pZH1gO1xuICAgICAgcGF0aC51bnNoaWZ0KHNlbCk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3QgY2xzID0gcmVhbENsYXNzZXMoY3VyKS5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKS5zbGljZSgwLCAyKTtcbiAgICBpZiAoY2xzLmxlbmd0aCkgc2VsICs9IGAuJHtjbHMuam9pbignLicpfWA7XG4gICAgbGV0IHNpYiA9IDE7XG4gICAgbGV0IG46IEVsZW1lbnQgfCBudWxsID0gY3VyLnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XG4gICAgd2hpbGUgKG4pIHtcbiAgICAgIHNpYisrO1xuICAgICAgbiA9IG4ucHJldmlvdXNFbGVtZW50U2libGluZztcbiAgICB9XG4gICAgc2VsICs9IGA6bnRoLWNoaWxkKCR7c2lifSlgO1xuICAgIHBhdGgudW5zaGlmdChzZWwpO1xuICAgIGN1ciA9IGN1ci5wYXJlbnRFbGVtZW50O1xuICB9XG4gIHJldHVybiBwYXRoLmpvaW4oJyA+ICcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZG9tUGF0aChlbDogRWxlbWVudCB8IG51bGwpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGhvcHM6IHN0cmluZ1tdID0gW107XG4gIGxldCBjdXIgPSBlbDtcbiAgd2hpbGUgKGN1ciAmJiBjdXIubm9kZVR5cGUgPT09IDEgJiYgaG9wcy5sZW5ndGggPCA4KSB7XG4gICAgbGV0IGxhYmVsID0gY3VyLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgZEVsID0gY3VyLmdldEF0dHJpYnV0ZT8uKCdkYXRhLWRjLWVsZW1lbnQnKTtcbiAgICBjb25zdCBkU2MgPSBjdXIuZ2V0QXR0cmlidXRlPy4oJ2RhdGEtZGMtc2NyZWVuJyk7XG4gICAgaWYgKGRFbCkgbGFiZWwgKz0gYFtkYXRhLWRjLWVsZW1lbnQ9XCIke2RFbH1cIl1gO1xuICAgIGVsc2UgaWYgKGRTYykgbGFiZWwgKz0gYFtkYXRhLWRjLXNjcmVlbj1cIiR7ZFNjfVwiXWA7XG4gICAgZWxzZSBpZiAoY3VyLmlkKSBsYWJlbCArPSBgIyR7Y3VyLmlkfWA7XG4gICAgY29uc3QgY2xzID0gcmVhbENsYXNzZXMoY3VyKS5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKS5zbGljZSgwLCAyKTtcbiAgICBpZiAoY2xzLmxlbmd0aCAmJiAhZEVsICYmICFkU2MpIGxhYmVsICs9IGAuJHtjbHMuam9pbignLicpfWA7XG4gICAgaG9wcy51bnNoaWZ0KGxhYmVsKTtcbiAgICBjdXIgPSBjdXIucGFyZW50RWxlbWVudDtcbiAgfVxuICByZXR1cm4gaG9wcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNzc0VzY2FwZShzOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBNaW5pbWFsIENTUy5lc2NhcGUgcG9seWZpbGwg4oCUIG9ubHkgaGFuZGxlcyBjaGFycyBhY3R1YWxseSBwcmVzZW50IGluXG4gIC8vIHBpcGVsaW5lLXN0YW1wZWQgSURzIChhbHBoYW51bWVyaWNzICsgYC1gICsgYF9gKS5cbiAgcmV0dXJuIHMucmVwbGFjZSgvW15hLXpBLVowLTlfLV0vZywgKGMpID0+IGBcXFxcJHtjfWApO1xufVxuXG4vKipcbiAqIEJ1aWxkIHRoZSB3aXJlLXNoYXBlIGBTZWxlY3Rpb25gIGZvciBhIHJlc29sdmVkIGhvdmVyIHRhcmdldC4gYGZpbGVgXG4gKiBkZWZhdWx0cyB0byBgZGVyaXZlRmlsZSgpYDsgdGhlIGNvbW1lbnQgbW91bnQgbGF5ZXIgcGFzc2VzIGl0IGV4cGxpY2l0bHlcbiAqIHNvIGFsbCB0aHJlZSBjb25zdW1lcnMgKHJvdXRlciwgb3ZlcmxheSwgbW91bnQpIGFncmVlIG9uIHRoZSBzYW1lIGtleS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhvdmVyVGFyZ2V0VG9TZWxlY3Rpb24odGFyZ2V0OiBIb3ZlclRhcmdldCwgZmlsZT86IHN0cmluZyk6IFNlbGVjdGlvbiB7XG4gIGNvbnN0IGVsID0gdGFyZ2V0LmVsO1xuICBjb25zdCByZWN0ID1cbiAgICBlbCAmJiAoZWwgYXMgSFRNTEVsZW1lbnQpLmdldEJvdW5kaW5nQ2xpZW50UmVjdFxuICAgICAgPyAoZWwgYXMgSFRNTEVsZW1lbnQpLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG4gICAgICA6IG51bGw7XG4gIC8vIGBjZElkYCBpcyB0aGUgaGl0IGVsZW1lbnQncyBPV04gZGF0YS1jZC1pZCAoZGVlcCBtb2RlKTsgcmVzb2x2ZXIgbmV2ZXJcbiAgLy8gY2xpbWJzIHRvIGFuIGFuY2VzdG9yLiBGYWxscyBiYWNrIHRvIGNzc1BhdGggb2YgdGhlIGhpdCB3aGVuIG5vIHN0YWJsZVxuICAvLyBhbmNob3IgZXhpc3RzLlxuICBjb25zdCBjZElkID0gdGFyZ2V0LmNkSWQ7XG4gIC8vIFNlbGVjdG9yIHJlc29sdXRpb24gb3JkZXI6XG4gIC8vICAgMS4gZGF0YS1jZC1pZCBhbmNob3Ig4oCUIHN0YWJsZSBwaXBlbGluZS1zdGFtcGVkIGlkIChwcmVmZXJyZWQpLlxuICAvLyAgIDIuIGRhdGEtZGMtc2NyZWVuIOKAlCBjaHJvbWUgY2xpY2sgcHJvbW90ZWQgdG8gd2hvbGUtYXJ0Ym9hcmQgc2VsZWN0XG4gIC8vICAgICAgKFQyNC41IEc4IG11bHRpLWFydGJvYXJkIGdlc3R1cmUpLlxuICAvLyAgIDMuIGNzc1BhdGggb2YgdGhlIGhpdCDigJQgbGFzdC1yZXNvcnQgcGF0aCBzdHJpbmcuXG4gIGNvbnN0IHNlbGVjdG9yID0gY2RJZFxuICAgID8gYFtkYXRhLWNkLWlkPVwiJHtjZElkfVwiXWBcbiAgICA6ICFjZElkICYmIHRhcmdldC5hcnRib2FyZElkXG4gICAgICA/IGBbZGF0YS1kYy1zY3JlZW49XCIke3RhcmdldC5hcnRib2FyZElkfVwiXWBcbiAgICAgIDogY3NzUGF0aChlbCk7XG4gIHJldHVybiB7XG4gICAgZmlsZTogZmlsZSA/PyBkZXJpdmVGaWxlKCksXG4gICAgaWQ6IGNkSWQgPz8gdW5kZWZpbmVkLFxuICAgIHNlbGVjdG9yLFxuICAgIGFydGJvYXJkSWQ6IHRhcmdldC5hcnRib2FyZElkLFxuICAgIHRhZzogZWw/LnRhZ05hbWUudG9Mb3dlckNhc2UoKSA/PyAnJyxcbiAgICBjbGFzc2VzOiByZWFsQ2xhc3NlcyhlbCksXG4gICAgdGV4dDogc2hvcnRUZXh0KGVsLCAyNDApLFxuICAgIGRvbV9wYXRoOiBkb21QYXRoKGVsKSxcbiAgICBib3VuZHM6IHJlY3RcbiAgICAgID8ge1xuICAgICAgICAgIHg6IE1hdGgucm91bmQocmVjdC5sZWZ0KSxcbiAgICAgICAgICB5OiBNYXRoLnJvdW5kKHJlY3QudG9wKSxcbiAgICAgICAgICB3OiBNYXRoLnJvdW5kKHJlY3Qud2lkdGgpLFxuICAgICAgICAgIGg6IE1hdGgucm91bmQocmVjdC5oZWlnaHQpLFxuICAgICAgICB9XG4gICAgICA6IG51bGwsXG4gICAgaHRtbDogZWwgPyAoZWwub3V0ZXJIVE1MID8/ICcnKS5zbGljZSgwLCA0MDAwKSA6ICcnLFxuICB9O1xufVxuIiwKICAgICIvKipcbiAqIEBmaWxlICAgICAgIGlucHV0LXJvdXRlci50c3gg4oCUIGNhbnZhcyBwb2ludGVyL2tleWJvYXJkIGNsYXNzaWZpZXIgKyBob29rXG4gKiBAc2NvcGUgICAgICBwbHVnaW5zL2Rlc2lnbi9kZXYtc2VydmVyL2lucHV0LXJvdXRlci50c3hcbiAqIEBwdXJwb3NlICAgIE93bmVkIGJ5IGNhbnZhcy1saWIncyBEZXNpZ25DYW52YXMuIENsYXNzaWZpZXMgdGhlIE5PTi1XSEVFTFxuICogICAgICAgICAgICAgc3Vic2V0IG9mIHBvaW50ZXIgKyBrZXkgZXZlbnRzIGludG8gZGlzY3JldGUgcm91dGVyIGFjdGlvbnMuXG4gKiAgICAgICAgICAgICBgdXNlVmlld3BvcnRDb250cm9sbGVyYCBrZWVwcyBvd25pbmcgd2hlZWwgKyBtaWRkbGUtbW91c2UgK1xuICogICAgICAgICAgICAgc3BhY2UtcGFuICsgQ21kKzAvMS8rLy0g4oCUIHRoZSB0d28gc3RhY2tzIGNvZXhpc3Qgd2l0aG91dCBhXG4gKiAgICAgICAgICAgICBsaXN0ZW5lciByYWNlIChERFItMDI2KS5cbiAqXG4gKiBFdmVudCBvd25lcnNoaXAgKHJlYWQgdGhpcyBiZWZvcmUgYWRkaW5nIGhhbmRsZXJzKTpcbiAqXG4gKiAgIOKUjOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUrOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUkFxuICogICDilIIgRXZlbnQgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pSCIE93bmVyICAgICAgICAgICAgICAgICAgICDilIJcbiAqICAg4pSc4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pS84pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSkXG4gKiAgIOKUgiB3aGVlbCAvIHNoaWZ0LXdoZWVsIC8gY21kLXdoZWVsICDilIIgdXNlVmlld3BvcnRDb250cm9sbGVyICAgIOKUglxuICogICDilIIgcG9pbnRlcmRvd24gYnRuPTEgLyBzcGFjZS1oZWxkICAg4pSCIHVzZVZpZXdwb3J0Q29udHJvbGxlciAgICDilIJcbiAqICAg4pSCIGtleWRvd24gU3BhY2UgLyBDbWQrMC8xLysvLSAgICAgIOKUgiB1c2VWaWV3cG9ydENvbnRyb2xsZXIgICAg4pSCXG4gKiAgIOKUgiBwb2ludGVybW92ZSAoaG92ZXIpICAgICAgICAgICAgICDilIIgaW5wdXQtcm91dGVyICAgICAgICAgICAgIOKUglxuICogICDilIIgcG9pbnRlcmRvd24gYnRuPTAgKHNlbGVjdCkgICAgICAg4pSCIGlucHV0LXJvdXRlciAgICAgICAgICAgICDilIJcbiAqICAg4pSCIHBvaW50ZXJkb3duIGJ0bj0yIChyaWdodC1jbGljaykgIOKUgiBpbnB1dC1yb3V0ZXIgICAgICAgICAgICAg4pSCXG4gKiAgIOKUgiBrZXlkb3duIFYgLyBIIC8gQyAvIEVzYyAgICAgICAgICDilIIgaW5wdXQtcm91dGVyICAgICAgICAgICAgIOKUglxuICogICDilJTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJhcbiAqXG4gKiBUaGUgcm91dGVyIGRvZXMgbm8gRE9NIHdvcmsgaXRzZWxmIOKAlCBgY2xhc3NpZnkoKWAgaXMgcHVyZSAodGVzdGFibGUgd2l0aG91dFxuICogYSBET00pIGFuZCBgdXNlSW5wdXRSb3V0ZXIoKWAgYXR0YWNoZXMgbGlzdGVuZXJzIHRoYXQgZGlzcGF0Y2ggdGhyb3VnaCB0aGVcbiAqIGNhbGxlci1zdXBwbGllZCBjYWxsYmFja3MuIEhvdmVyLXRhcmdldCByZXNvbHV0aW9uICsgc2VsZWN0aW9uIHBlcnNpc3RlbmNlXG4gKiBsaXZlIGluIHRoZSBjb25zdW1lciAoRGVzaWduQ2FudmFzKS5cbiAqL1xuXG5pbXBvcnQgeyB0eXBlIFJlZk9iamVjdCwgdXNlRWZmZWN0IH0gZnJvbSAncmVhY3QnO1xuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIERyYWctdnMtY2xpY2sgdGhyZXNob2xkIChUMjUpXG4vL1xuLy8gNCBweCBzY3JlZW4tcGl4ZWwgaHlwb3Qgc2VwYXJhdGVzIFwiY2xpY2tcIiBmcm9tIFwiZHJhZ1wiIOKAlCBNaWNyb3NvZnQgV2luMzJcbi8vIGNhbm9uaWNhbCAoYFNNX0NYRFJBR2AvYFNNX0NZRFJBR2AgZGVmYXVsdCksIGFsc28gZDMtZHJhZyBhbmQgdGxkcmF3IGRlZmF1bHQuXG4vLyBPd25lZCBoZXJlIHNvIGFydGJvYXJkLWRyYWcsIGFydGJvYXJkLW1hcnF1ZWUsIGVsZW1lbnQtbWFycXVlZSwgYW5ub3RhdGlvbi1cbi8vIGRyYWctdnMtdGFwLCBhbmQgYW55IGZ1dHVyZSBkcmFnLWNsYXNzIGdlc3R1cmUgYWxsIHJlYWQgdGhlIHNhbWUgY29uc3RhbnQuXG4vLyBXaGVlbCArIHBpbmNoLXpvb20gYXJlIEVYRU1QVCDigJQgdGhyZXNob2xkIGlzIGZvciBgcG9pbnRlcmRvd24g4oaSIHBvaW50ZXJtb3ZlYFxuLy8gZHJhZyBjbGFzc2lmaWNhdGlvbiBvbmx5LlxuXG5leHBvcnQgY29uc3QgRFJBR19USFJFU0hPTERfUFggPSA0O1xuXG4vKiogVHJ1ZSBvbmNlIHRoZSBwb2ludGVyIGhhcyBtb3ZlZCDiiaUgRFJBR19USFJFU0hPTERfUFggZnJvbSBpdHMgc3RhcnQuICovXG5leHBvcnQgZnVuY3Rpb24gY3Jvc3NlZERyYWdUaHJlc2hvbGQoXG4gIHN0YXJ0WDogbnVtYmVyLFxuICBzdGFydFk6IG51bWJlcixcbiAgY3VyWDogbnVtYmVyLFxuICBjdXJZOiBudW1iZXJcbik6IGJvb2xlYW4ge1xuICBjb25zdCBkeCA9IGN1clggLSBzdGFydFg7XG4gIGNvbnN0IGR5ID0gY3VyWSAtIHN0YXJ0WTtcbiAgcmV0dXJuIE1hdGguaHlwb3QoZHgsIGR5KSA+PSBEUkFHX1RIUkVTSE9MRF9QWDtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUeXBlc1xuXG4vKipcbiAqIFRvb2wgdW5pb24uIFBoYXNlIDQuMSBzaGlwcGVkIFYvSC9DOyBQaGFzZSA1IGFkZHMgdGhlIGRyYXcgc2V0XG4gKiAocGVuIC8gcmVjdCAvIGFycm93IC8gZXJhc2VyKS4gRHJhdy10b29sIHBvaW50ZXIgZXZlbnRzIGFyZSBvd25lZCBieVxuICogYEFubm90YXRpb25zTGF5ZXJgIOKAlCB0aGUgcm91dGVyIGNsYXNzaWZpZXMgdGhlaXIgbGV0dGVyIHNob3J0Y3V0cyBidXRcbiAqIHJldHVybnMgYG5vLW9wYCBmb3IgdGhlIGNvcnJlc3BvbmRpbmcgcG9pbnRlciBldmVudHMgc28gdGhlIFNWRyBvdmVybGF5XG4gKiBjYW4gZ3JhYiB0aGVtIG5hdGl2ZWx5LlxuICovXG5leHBvcnQgdHlwZSBUb29sID0gJ21vdmUnIHwgJ2hhbmQnIHwgJ2NvbW1lbnQnIHwgJ3BlbicgfCAncmVjdCcgfCAnZWxsaXBzZScgfCAnYXJyb3cnIHwgJ2VyYXNlcic7XG5cbmNvbnN0IEFOTk9UQVRJT05fVE9PTFMgPSBuZXcgU2V0PFRvb2w+KFsncGVuJywgJ3JlY3QnLCAnZWxsaXBzZScsICdhcnJvdycsICdlcmFzZXInXSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0Fubm90YXRpb25Ub29sKHQ6IFRvb2wpOiBib29sZWFuIHtcbiAgcmV0dXJuIEFOTk9UQVRJT05fVE9PTFMuaGFzKHQpO1xufVxuXG5leHBvcnQgdHlwZSBSb3V0ZXJBY3Rpb24gPVxuICB8IHsga2luZDogJ25vLW9wJyB9XG4gIHwgeyBraW5kOiAnaG92ZXInOyBkZWVwOiBib29sZWFuOyBjbGllbnRYOiBudW1iZXI7IGNsaWVudFk6IG51bWJlciB9XG4gIHwge1xuICAgICAga2luZDogJ3NlbGVjdCc7XG4gICAgICAvKiogYHJlcGxhY2VgIHN3YXBzIHRoZSBzZWxlY3Rpb24gc2V0LCBgYWRkYCBtZXJnZXMgaW50byBpdC4gKi9cbiAgICAgIG1vZGU6ICdyZXBsYWNlJyB8ICdhZGQnO1xuICAgICAgLyoqXG4gICAgICAgKiBgdHJ1ZWAgcmVzb2x2ZXMgdG8gdGhlIGRlZXBlc3QgZGVzY2VuZGFudCB1bmRlciB0aGUgY3Vyc29yIChDbWQtaGVsZFxuICAgICAgICogbW9kZSkuIGBmYWxzZWAgcmVzb2x2ZXMgdG8gdGhlIHRvcG1vc3QgaW50ZXJlc3RpbmcgYW5jZXN0b3IgKHRvcCBtb2RlKS5cbiAgICAgICAqIFBoYXNlIDQuMSBNb3ZlLXRvb2wgc2VsZWN0aW9uIGFsd2F5cyB1c2VzIGRlZXA9dHJ1ZSDigJQgYmFyZSBjbGlja3NcbiAgICAgICAqIGFyZSBwYXNzdGhyb3VnaCAobm8gc2VsZWN0KSwgYW5kIHRoZSBvbmx5IGVudHJ5IHBvaW50cyBhcmUgQ21kXG4gICAgICAgKiAocmVwbGFjZSBkZWVwKSBhbmQgQ21kK1NoaWZ0IChhZGQgZGVlcCkuXG4gICAgICAgKi9cbiAgICAgIGRlZXA6IGJvb2xlYW47XG4gICAgICBjbGllbnRYOiBudW1iZXI7XG4gICAgICBjbGllbnRZOiBudW1iZXI7XG4gICAgfVxuICB8IHsga2luZDogJ2Ryb3AtY29tbWVudCc7IGNsaWVudFg6IG51bWJlcjsgY2xpZW50WTogbnVtYmVyIH1cbiAgfCB7IGtpbmQ6ICdjb250ZXh0LW1lbnUnOyBjbGllbnRYOiBudW1iZXI7IGNsaWVudFk6IG51bWJlciB9XG4gIHwgeyBraW5kOiAndG9vbCc7IHRvb2w6IFRvb2wgfVxuICB8IHsga2luZDogJ2VzY2FwZScgfVxuICB8IHsga2luZDogJ3VuZG8nIH1cbiAgfCB7IGtpbmQ6ICdyZWRvJyB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIENsYXNzaWZ5SW5wdXQge1xuICB0eXBlOiAncG9pbnRlcm1vdmUnIHwgJ3BvaW50ZXJkb3duJyB8ICdjb250ZXh0bWVudScgfCAna2V5ZG93bic7XG4gIC8qKiBQb2ludGVyRXZlbnQuYnV0dG9uOiAwID0gbGVmdCwgMSA9IG1pZGRsZSwgMiA9IHJpZ2h0LiAqL1xuICBidXR0b24/OiBudW1iZXI7XG4gIG1ldGFLZXk/OiBib29sZWFuO1xuICBjdHJsS2V5PzogYm9vbGVhbjtcbiAgc2hpZnRLZXk/OiBib29sZWFuO1xuICBhbHRLZXk/OiBib29sZWFuO1xuICBrZXk/OiBzdHJpbmc7XG4gIGNsaWVudFg/OiBudW1iZXI7XG4gIGNsaWVudFk/OiBudW1iZXI7XG4gIC8qKiBTcGFjZWJhciBoZWxkIOKAlCBzaGFyZWQgc2lnbmFsIHdpdGggYHVzZVZpZXdwb3J0Q29udHJvbGxlcmAncyBwYW4tZHJhZy4gKi9cbiAgc3BhY2VIZWxkPzogYm9vbGVhbjtcbiAgLyoqIEV2ZW50IHRhcmdldCBpcyBlZGl0YWJsZSAoaW5wdXQvdGV4dGFyZWEvY29udGVudEVkaXRhYmxlKSDigJQgY2FsbGVyIGNvbXB1dGVzLiAqL1xuICBpc0VkaXRhYmxlPzogYm9vbGVhbjtcbiAgYWN0aXZlVG9vbDogVG9vbDtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBjbGFzc2lmeSDigJQgcHVyZSBmdW5jdGlvbi4gQWxsIGJyYW5jaGluZyBsaXZlcyBoZXJlIHNvIHVuaXQgdGVzdHMgY292ZXIgZXZlcnlcbi8vIHJvdyBvZiB0aGUgZGlzcGF0Y2ggdGFibGUgd2l0aG91dCBzcGlubmluZyB1cCBhIERPTS5cblxuY29uc3QgbWV0YU9yQ3RybCA9IChpOiBDbGFzc2lmeUlucHV0KTogYm9vbGVhbiA9PiAhIShpLm1ldGFLZXkgfHwgaS5jdHJsS2V5KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNsYXNzaWZ5KGlucHV0OiBDbGFzc2lmeUlucHV0KTogUm91dGVyQWN0aW9uIHtcbiAgaWYgKGlucHV0LnR5cGUgPT09ICdrZXlkb3duJykge1xuICAgIGlmIChpbnB1dC5pc0VkaXRhYmxlKSByZXR1cm4geyBraW5kOiAnbm8tb3AnIH07XG4gICAgLy8gVG9vbCBsZXR0ZXJzIGFyZSBiYXJlIGtleXMg4oCUIENtZC9DdHJsL0FsdCtsZXR0ZXIgYmVsb25ncyB0byBzaGVsbCAvIGJyb3dzZXIuXG4gICAgaWYgKGlucHV0Lm1ldGFLZXkgfHwgaW5wdXQuY3RybEtleSB8fCBpbnB1dC5hbHRLZXkpIHtcbiAgICAgIC8vIEVzYyB3aXRoIG1vZGlmaWVycyBzdGlsbCBkaXNtaXNzZXMuXG4gICAgICBpZiAoaW5wdXQua2V5ID09PSAnRXNjYXBlJykgcmV0dXJuIHsga2luZDogJ2VzY2FwZScgfTtcbiAgICAgIC8vIFVuZG8gLyByZWRvIChQaGFzZSAyMCkuIEFsdCBpcyByZXNlcnZlZCDigJQgQ21kK09wdCtaIGlzIGEgYnJvd3NlclxuICAgICAgLy8gdGV4dC1pbnB1dCBnZXN0dXJlIHdlIGRvbid0IGNsYWltLiBgbWV0YUtleSB8fCBjdHJsS2V5YCBjb3ZlcnMgYm90aFxuICAgICAgLy8gbWFjIGFuZCBXaW5kb3dzIC8gTGludXggd2l0aG91dCBhIHBsYXRmb3JtIHNuaWZmLlxuICAgICAgY29uc3QgayA9IChpbnB1dC5rZXkgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIWlucHV0LmFsdEtleSAmJiAoaW5wdXQubWV0YUtleSB8fCBpbnB1dC5jdHJsS2V5KSkge1xuICAgICAgICBpZiAoayA9PT0gJ3onICYmIGlucHV0LnNoaWZ0S2V5KSByZXR1cm4geyBraW5kOiAncmVkbycgfTtcbiAgICAgICAgaWYgKGsgPT09ICd6JykgcmV0dXJuIHsga2luZDogJ3VuZG8nIH07XG4gICAgICAgIGlmIChrID09PSAneScgJiYgIWlucHV0LnNoaWZ0S2V5KSByZXR1cm4geyBraW5kOiAncmVkbycgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcbiAgICB9XG4gICAgY29uc3QgayA9IChpbnB1dC5rZXkgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKGsgPT09ICd2JykgcmV0dXJuIHsga2luZDogJ3Rvb2wnLCB0b29sOiAnbW92ZScgfTtcbiAgICBpZiAoayA9PT0gJ2gnKSByZXR1cm4geyBraW5kOiAndG9vbCcsIHRvb2w6ICdoYW5kJyB9O1xuICAgIGlmIChrID09PSAnYycpIHJldHVybiB7IGtpbmQ6ICd0b29sJywgdG9vbDogJ2NvbW1lbnQnIH07XG4gICAgaWYgKGsgPT09ICdiJykgcmV0dXJuIHsga2luZDogJ3Rvb2wnLCB0b29sOiAncGVuJyB9O1xuICAgIGlmIChrID09PSAncicpIHJldHVybiB7IGtpbmQ6ICd0b29sJywgdG9vbDogJ3JlY3QnIH07XG4gICAgaWYgKGsgPT09ICdvJykgcmV0dXJuIHsga2luZDogJ3Rvb2wnLCB0b29sOiAnZWxsaXBzZScgfTtcbiAgICBpZiAoayA9PT0gJ2EnKSByZXR1cm4geyBraW5kOiAndG9vbCcsIHRvb2w6ICdhcnJvdycgfTtcbiAgICBpZiAoayA9PT0gJ2UnKSByZXR1cm4geyBraW5kOiAndG9vbCcsIHRvb2w6ICdlcmFzZXInIH07XG4gICAgaWYgKGlucHV0LmtleSA9PT0gJ0VzY2FwZScpIHJldHVybiB7IGtpbmQ6ICdlc2NhcGUnIH07XG4gICAgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xuICB9XG5cbiAgaWYgKGlucHV0LnR5cGUgPT09ICdjb250ZXh0bWVudScpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ2NvbnRleHQtbWVudScsXG4gICAgICBjbGllbnRYOiBpbnB1dC5jbGllbnRYID8/IDAsXG4gICAgICBjbGllbnRZOiBpbnB1dC5jbGllbnRZID8/IDAsXG4gICAgfTtcbiAgfVxuXG4gIGlmIChpbnB1dC50eXBlID09PSAncG9pbnRlcm1vdmUnKSB7XG4gICAgLy8gUGhhc2UgNSBkcmF3IHRvb2xzOiBwZW4gLyByZWN0IC8gYXJyb3cgLyBlcmFzZXIgb3duIGFsbCB0aGVpciBwb2ludGVyXG4gICAgLy8gZXZlbnRzIHRocm91Z2ggYEFubm90YXRpb25zTGF5ZXJgLiBUaGUgcm91dGVyIG5ldmVyIHBhaW50cyBhIGhvdmVyIGhhbG9cbiAgICAvLyB3aGlsZSBkcmF3aW5nIOKAlCB0aGF0IGFmZm9yZGFuY2UgaXMgcmVzZXJ2ZWQgZm9yIHNlbGVjdCAvIGNvbW1lbnQuXG4gICAgaWYgKGlzQW5ub3RhdGlvblRvb2woaW5wdXQuYWN0aXZlVG9vbCkpIHJldHVybiB7IGtpbmQ6ICduby1vcCcgfTtcbiAgICAvLyBIYW5kIHRvb2w6IGRyYWcgcGFuIGlzIG93bmVkIGJ5IHVzZVZpZXdwb3J0Q29udHJvbGxlcjsgbm8gaG92ZXIgcGFpbnQuXG4gICAgaWYgKGlucHV0LmFjdGl2ZVRvb2wgPT09ICdoYW5kJykgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xuICAgIC8vIENvbW1lbnQgdG9vbDogYWx3YXlzIHBhaW50IGEgcHJldmlldyBoYWxvIG9uIHRoZSBkZWVwZXN0IGVsZW1lbnQgdW5kZXJcbiAgICAvLyBjdXJzb3Ig4oCUIHRoYXQncyB0aGUgZWxlbWVudCB0aGUgdXNlciBpcyBhYm91dCB0byBjb21tZW50IG9uLiBDb21tZW50XG4gICAgLy8gcGluIGF0dGFjaG1lbnQgaXMgdG8gdGhlIHNhbWUgZWxlbWVudCB0aGV5IHdlcmUgaG92ZXJpbmcuXG4gICAgaWYgKGlucHV0LmFjdGl2ZVRvb2wgPT09ICdjb21tZW50Jykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAga2luZDogJ2hvdmVyJyxcbiAgICAgICAgZGVlcDogdHJ1ZSxcbiAgICAgICAgY2xpZW50WDogaW5wdXQuY2xpZW50WCA/PyAwLFxuICAgICAgICBjbGllbnRZOiBpbnB1dC5jbGllbnRZID8/IDAsXG4gICAgICB9O1xuICAgIH1cbiAgICAvLyBNb3ZlIHRvb2w6IGJhcmUgaG92ZXIgZG9lcyBub3RoaW5nIChuYXRpdmUgaW50ZXJhY3Rpb25zIHBhc3MgdGhyb3VnaCk7XG4gICAgLy8gQ21kLWhlbGQgaG92ZXIgcGFpbnRzIGEgaGFsbyBvbiB0aGUgZGVlcGVzdCBlbGVtZW50IChwcmV2aWV3KS5cbiAgICBpZiAoIW1ldGFPckN0cmwoaW5wdXQpKSByZXR1cm4geyBraW5kOiAnbm8tb3AnIH07XG4gICAgcmV0dXJuIHtcbiAgICAgIGtpbmQ6ICdob3ZlcicsXG4gICAgICBkZWVwOiB0cnVlLFxuICAgICAgY2xpZW50WDogaW5wdXQuY2xpZW50WCA/PyAwLFxuICAgICAgY2xpZW50WTogaW5wdXQuY2xpZW50WSA/PyAwLFxuICAgIH07XG4gIH1cblxuICBpZiAoaW5wdXQudHlwZSA9PT0gJ3BvaW50ZXJkb3duJykge1xuICAgIGlmIChpbnB1dC5idXR0b24gPT09IDIpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGtpbmQ6ICdjb250ZXh0LW1lbnUnLFxuICAgICAgICBjbGllbnRYOiBpbnB1dC5jbGllbnRYID8/IDAsXG4gICAgICAgIGNsaWVudFk6IGlucHV0LmNsaWVudFkgPz8gMCxcbiAgICAgIH07XG4gICAgfVxuICAgIGlmIChpbnB1dC5idXR0b24gPT09IDEgfHwgaW5wdXQuc3BhY2VIZWxkKSByZXR1cm4geyBraW5kOiAnbm8tb3AnIH07XG4gICAgaWYgKGlucHV0LmJ1dHRvbiAhPT0gMCkgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xuXG4gICAgLy8gUGhhc2UgNSBkcmF3IHRvb2xzIG93biBiYXJlIGxlZnQtY2xpY2tzOyB0aGUgcm91dGVyIHJldHVybnMgbm8tb3Agc29cbiAgICAvLyB0aGUgU1ZHIGxheWVyJ3Mgb3duIGxpc3RlbmVycyAobm8gcHJldmVudERlZmF1bHQpIGZpcmUgbm9ybWFsbHkuIENtZC1cbiAgICAvLyBtb2RpZmllZCBjbGlja3Mgc3RpbGwgZmxvdyBpbnRvIHRoZSBtb3ZlLXRvb2wgc2VsZWN0IHBhdGggYmVsb3cg4oCUIHRoYXRcbiAgICAvLyBzdGF5cyBhdmFpbGFibGUgYXMgYW4gZXNjYXBlIGhhdGNoIGV2ZW4gd2hpbGUgYSBkcmF3IHRvb2wgaXMgYWN0aXZlLlxuICAgIGlmIChpc0Fubm90YXRpb25Ub29sKGlucHV0LmFjdGl2ZVRvb2wpICYmICFtZXRhT3JDdHJsKGlucHV0KSkge1xuICAgICAgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xuICAgIH1cblxuICAgIGlmIChpbnB1dC5hY3RpdmVUb29sID09PSAnY29tbWVudCcpIHtcbiAgICAgIC8vIENvbW1lbnQgdG9vbDogYmFyZSBjbGljayBkcm9wcyBhIHBpbi4gQ21kIC8gU2hpZnQgbW9kaWZpZXJzIHJlc2VydmVkXG4gICAgICAvLyBmb3IgZnV0dXJlIFwic2NvcGUgY29tbWVudCB0byBkZWVwZXN0XCIgdmFyaWFudHMg4oCUIGZvciBub3cgdGhleSBmYWxsXG4gICAgICAvLyB0aHJvdWdoIHRvIHRoZSBzYW1lIGRyb3AuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBraW5kOiAnZHJvcC1jb21tZW50JyxcbiAgICAgICAgY2xpZW50WDogaW5wdXQuY2xpZW50WCA/PyAwLFxuICAgICAgICBjbGllbnRZOiBpbnB1dC5jbGllbnRZID8/IDAsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEhhbmQgdG9vbDogcGFuIGlzIG93bmVkIGJ5IHVzZVZpZXdwb3J0Q29udHJvbGxlciB2aWEgYGlzUGFuRHJhZ0FjdGl2ZWAuXG4gICAgLy8gUm91dGVyIHJldHVybnMgbm8tb3Agc28gaXQgZG9lc24ndCBwcmV2ZW50RGVmYXVsdCBvciBzdG9wUHJvcGFnYXRpb24g4oCUXG4gICAgLy8gdGhlIGNvbnRyb2xsZXIncyBwb2ludGVyZG93biBsaXN0ZW5lciBvbiB0aGUgc2FtZSBob3N0IGNsYWltcyB0aGUgZHJhZy5cbiAgICBpZiAoaW5wdXQuYWN0aXZlVG9vbCA9PT0gJ2hhbmQnKSByZXR1cm4geyBraW5kOiAnbm8tb3AnIH07XG5cbiAgICAvLyBNb3ZlIHRvb2wuIFNlbGVjdGlvbiBPTkxZIGZpcmVzIHdpdGggQ21kIC8gQ21kK1NoaWZ0LiBCYXJlIGNsaWNrcyBhbmRcbiAgICAvLyBTaGlmdC13aXRob3V0LUNtZCBwYXNzIHRocm91Z2ggc28gbmF0aXZlIGNhbnZhcyBpbnRlcmFjdGlvbnMgKGJ1dHRvblxuICAgIC8vIHByZXNzZXMsIGxpbmsgY2xpY2tzLCBpbnB1dCBmb2N1cykgc3RpbGwgd29yayDigJQgZXhhY3RseSB0aGUgc2FtZSBhc1xuICAgIC8vIHByZS1QaGFzZS00LjEgYmVoYXZpb3IgZm9yIGV2ZXJ5dGhpbmcgZXhjZXB0IENtZC1tb2RpZmllZCBnZXN0dXJlcy5cbiAgICBjb25zdCBjbWQgPSBtZXRhT3JDdHJsKGlucHV0KTtcbiAgICBpZiAoIWNtZCkgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xuICAgIGNvbnN0IHNoaWZ0ID0gISFpbnB1dC5zaGlmdEtleTtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ3NlbGVjdCcsXG4gICAgICBtb2RlOiBzaGlmdCA/ICdhZGQnIDogJ3JlcGxhY2UnLFxuICAgICAgZGVlcDogdHJ1ZSxcbiAgICAgIGNsaWVudFg6IGlucHV0LmNsaWVudFggPz8gMCxcbiAgICAgIGNsaWVudFk6IGlucHV0LmNsaWVudFkgPz8gMCxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHsga2luZDogJ25vLW9wJyB9O1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIHVzZUlucHV0Um91dGVyIOKAlCBhdHRhY2ggbGlzdGVuZXJzIHNjb3BlZCB0byBgaG9zdFJlZi5jdXJyZW50YC4gRGlzcGF0Y2hlc1xuLy8gdGhyb3VnaCBgY2FsbGJhY2tzYC4gUmV0dXJucyBub3RoaW5nOyBjbGVhbnMgdXAgb24gdW5tb3VudC5cblxuZXhwb3J0IGludGVyZmFjZSBSb3V0ZXJDYWxsYmFja3Mge1xuICBvbkhvdmVyPzogKGE6IEV4dHJhY3Q8Um91dGVyQWN0aW9uLCB7IGtpbmQ6ICdob3ZlcicgfT4pID0+IHZvaWQ7XG4gIG9uU2VsZWN0PzogKGE6IEV4dHJhY3Q8Um91dGVyQWN0aW9uLCB7IGtpbmQ6ICdzZWxlY3QnIH0+KSA9PiB2b2lkO1xuICBvbkRyb3BDb21tZW50PzogKGE6IEV4dHJhY3Q8Um91dGVyQWN0aW9uLCB7IGtpbmQ6ICdkcm9wLWNvbW1lbnQnIH0+KSA9PiB2b2lkO1xuICBvbkNvbnRleHRNZW51PzogKGE6IEV4dHJhY3Q8Um91dGVyQWN0aW9uLCB7IGtpbmQ6ICdjb250ZXh0LW1lbnUnIH0+KSA9PiB2b2lkO1xuICBvblRvb2w/OiAoYTogRXh0cmFjdDxSb3V0ZXJBY3Rpb24sIHsga2luZDogJ3Rvb2wnIH0+KSA9PiB2b2lkO1xuICBvbkVzY2FwZT86ICgpID0+IHZvaWQ7XG4gIC8qKiBQaGFzZSAyMCDigJQgQ21kK1ogLyBDdHJsK1ouICovXG4gIG9uVW5kbz86ICgpID0+IHZvaWQ7XG4gIC8qKiBQaGFzZSAyMCDigJQgQ21kK1NoaWZ0K1ogLyBDdHJsK1kgLyBDbWQrWS4gKi9cbiAgb25SZWRvPzogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBVc2VJbnB1dFJvdXRlck9wdGlvbnMge1xuICBob3N0UmVmOiBSZWZPYmplY3Q8SFRNTEVsZW1lbnQgfCBudWxsPjtcbiAgLyoqIExhdGVzdCBhY3RpdmUgdG9vbCDigJQgcmVhZCBhdCBldmVudCB0aW1lLCBub3QgY2FwdHVyZWQuICovXG4gIGdldEFjdGl2ZVRvb2w6ICgpID0+IFRvb2w7XG4gIC8qKiBPcHRpb25hbCBzcGFjZWJhci1oZWxkIHNpZ25hbCBzaGFyZWQgd2l0aCB1c2VWaWV3cG9ydENvbnRyb2xsZXIuICovXG4gIGlzU3BhY2VIZWxkPzogKCkgPT4gYm9vbGVhbjtcbiAgY2FsbGJhY2tzOiBSb3V0ZXJDYWxsYmFja3M7XG4gIC8qKiBXaGVuIGZhbHNlLCBsaXN0ZW5lcnMgYXJlIG5vdCBhdHRhY2hlZC4gRGVmYXVsdHMgdG8gdHJ1ZS4gKi9cbiAgZW5hYmxlZD86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBBbGxvd2xpc3Qgb2YgYWN0aW9uIGtpbmRzIHRoaXMgcm91dGVyIGlzIHBlcm1pdHRlZCB0byBDTEFJTSAocHJldmVudERlZmF1bHRcbiAgICogKyBzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24gKyBkaXNwYXRjaCkuIEFueSBjbGFzc2lmaWVkIGFjdGlvbiBvdXRzaWRlIHRoZVxuICAgKiBzZXQgaXMgZG93bmdyYWRlZCB0byBgbm8tb3BgIHNvIGl0IHByb3BhZ2F0ZXMgdW50b3VjaGVkIHRvIG90aGVyIGxpc3RlbmVycy5cbiAgICogT21pdCB0byBjbGFpbSBldmVyeXRoaW5nICh0aGUgZGVmYXVsdCDigJQgdXNlZCBieSB0aGUgZnVsbCBEZXNpZ25DYW52YXNcbiAgICogcm91dGVyKS4gVGhlIHNoZWxsLW93bmVkIGNvbW1lbnQgbW91bnQgbGF5ZXIgcGFzc2VzIGEgbmFycm93IHNldCBzbyBpdCBjYW5cbiAgICogY29leGlzdCBhcyBhbiBBTkNFU1RPUiBjYXB0dXJlLWxpc3RlbmVyIG92ZXIgYSBVSSBjYW52YXMncyBvd24gcm91dGVyXG4gICAqIHdpdGhvdXQgc3dhbGxvd2luZyBzZWxlY3QgLyBjb250ZXh0LW1lbnUgLyB1bmRvIGdlc3R1cmVzIGl0IGRvZXNuJ3Qgb3duLlxuICAgKi9cbiAgY2xhaW1hYmxlQWN0aW9ucz86IFJlYWRvbmx5U2V0PFJvdXRlckFjdGlvblsna2luZCddPjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRWRpdGFibGVUYXJnZXQodDogRXZlbnRUYXJnZXQgfCBudWxsKTogYm9vbGVhbiB7XG4gIGlmICghdCB8fCAhKHQgYXMgSFRNTEVsZW1lbnQpLnRhZ05hbWUpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgZWwgPSB0IGFzIEhUTUxFbGVtZW50O1xuICBjb25zdCB0YWcgPSBlbC50YWdOYW1lO1xuICBpZiAodGFnID09PSAnSU5QVVQnIHx8IHRhZyA9PT0gJ1RFWFRBUkVBJyB8fCB0YWcgPT09ICdTRUxFQ1QnKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGVsLmlzQ29udGVudEVkaXRhYmxlKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIFBoYXNlIDYg4oCUIHRoZSBjb21tZW50cyBvdmVybGF5IChwaW5zIC8gY29tcG9zZXIgLyB0aHJlYWQgcG9wb3ZlciAvIG1lbnRpb25cbiAqIHBvcHVwKSBsaXZlcyBJTlNJREUgdGhlIGNhbnZhcyB3b3JsZCwgd2hpY2ggbWVhbnMgaXRzIERPTSBub2RlcyBhcmUgaW5zaWRlXG4gKiB0aGUgaW5wdXQtcm91dGVyJ3MgY2FwdHVyZSBob3N0LiBXaXRob3V0IGFuIGV4cGxpY2l0IGJhaWwtb3V0IHRoZSByb3V0ZXJcbiAqIHdvdWxkIGBwcmV2ZW50RGVmYXVsdCArIHN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbmAgZXZlcnkgY2xpY2sgb24gYVxuICogY29tcG9zZXIgYnV0dG9uIHdoaWxlIGNvbW1lbnQgbW9kZSBpcyBhY3RpdmUsIGJsb2NraW5nIFNhdmUgLyBDYW5jZWwuXG4gKlxuICogV2UgdHJlYXQgdGhlIG92ZXJsYXkgbm9kZXMgbGlrZSBlZGl0YWJsZSBmb3JtIHdpZGdldHMg4oCUIHRoZSByb3V0ZXIgeWllbGRzLFxuICogdGhlIFJlYWN0IGV2ZW50IGhhbmRsZXIgcnVucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzT3ZlcmxheVRhcmdldCh0OiBFdmVudFRhcmdldCB8IG51bGwpOiBib29sZWFuIHtcbiAgaWYgKCF0IHx8ICEodCBhcyBFbGVtZW50KS5jbG9zZXN0KSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiAhISh0IGFzIEVsZW1lbnQpLmNsb3Nlc3QoJy5jbS1jb21wb3NlciwgLmNtLXRocmVhZCwgLmNtLW1lbnRpb24tcG9wdXAsIC5jbS1waW4nKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUlucHV0Um91dGVyKG9wdHM6IFVzZUlucHV0Um91dGVyT3B0aW9ucyk6IHZvaWQge1xuICBjb25zdCB7IGhvc3RSZWYsIGdldEFjdGl2ZVRvb2wsIGlzU3BhY2VIZWxkLCBjYWxsYmFja3MsIGVuYWJsZWQgPSB0cnVlLCBjbGFpbWFibGVBY3Rpb25zIH0gPSBvcHRzO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFlbmFibGVkKSByZXR1cm47XG4gICAgY29uc3QgaG9zdCA9IGhvc3RSZWYuY3VycmVudDtcbiAgICBpZiAoIWhvc3QpIHJldHVybjtcblxuICAgIC8vIERvd25ncmFkZSBhbnkgYWN0aW9uIHRoaXMgcm91dGVyIGlzbid0IHBlcm1pdHRlZCB0byBjbGFpbSB0byBuby1vcCBzbyBpdFxuICAgIC8vIHByb3BhZ2F0ZXMgdW50b3VjaGVkIChubyBwcmV2ZW50RGVmYXVsdCAvIG5vIGRpc3BhdGNoKS4gSWRlbnRpdHkgcGFzcy1cbiAgICAvLyB0aHJvdWdoIHdoZW4gbm8gYWxsb3dsaXN0IGlzIGNvbmZpZ3VyZWQuXG4gICAgY29uc3QgY2xhaW0gPSAoYWN0aW9uOiBSb3V0ZXJBY3Rpb24pOiBSb3V0ZXJBY3Rpb24gPT5cbiAgICAgIGNsYWltYWJsZUFjdGlvbnMgJiYgYWN0aW9uLmtpbmQgIT09ICduby1vcCcgJiYgIWNsYWltYWJsZUFjdGlvbnMuaGFzKGFjdGlvbi5raW5kKVxuICAgICAgICA/IHsga2luZDogJ25vLW9wJyB9XG4gICAgICAgIDogYWN0aW9uO1xuXG4gICAgY29uc3QgZGlzcGF0Y2ggPSAoYWN0aW9uOiBSb3V0ZXJBY3Rpb24pOiB2b2lkID0+IHtcbiAgICAgIHN3aXRjaCAoYWN0aW9uLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnaG92ZXInOlxuICAgICAgICAgIGNhbGxiYWNrcy5vbkhvdmVyPy4oYWN0aW9uKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc2VsZWN0JzpcbiAgICAgICAgICBjYWxsYmFja3Mub25TZWxlY3Q/LihhY3Rpb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkcm9wLWNvbW1lbnQnOlxuICAgICAgICAgIGNhbGxiYWNrcy5vbkRyb3BDb21tZW50Py4oYWN0aW9uKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnY29udGV4dC1tZW51JzpcbiAgICAgICAgICBjYWxsYmFja3Mub25Db250ZXh0TWVudT8uKGFjdGlvbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3Rvb2wnOlxuICAgICAgICAgIGNhbGxiYWNrcy5vblRvb2w/LihhY3Rpb24pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdlc2NhcGUnOlxuICAgICAgICAgIGNhbGxiYWNrcy5vbkVzY2FwZT8uKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3VuZG8nOlxuICAgICAgICAgIGNhbGxiYWNrcy5vblVuZG8/LigpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdyZWRvJzpcbiAgICAgICAgICBjYWxsYmFja3Mub25SZWRvPy4oKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbm8tb3AnOlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBvblBvaW50ZXJNb3ZlID0gKGU6IFBvaW50ZXJFdmVudCk6IHZvaWQgPT4ge1xuICAgICAgY29uc3QgYWN0aW9uID0gY2xhaW0oXG4gICAgICAgIGNsYXNzaWZ5KHtcbiAgICAgICAgICB0eXBlOiAncG9pbnRlcm1vdmUnLFxuICAgICAgICAgIGJ1dHRvbjogZS5idXR0b24sXG4gICAgICAgICAgbWV0YUtleTogZS5tZXRhS2V5LFxuICAgICAgICAgIGN0cmxLZXk6IGUuY3RybEtleSxcbiAgICAgICAgICBzaGlmdEtleTogZS5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGUuYWx0S2V5LFxuICAgICAgICAgIGNsaWVudFg6IGUuY2xpZW50WCxcbiAgICAgICAgICBjbGllbnRZOiBlLmNsaWVudFksXG4gICAgICAgICAgc3BhY2VIZWxkOiBpc1NwYWNlSGVsZD8uKCkgPz8gZmFsc2UsXG4gICAgICAgICAgYWN0aXZlVG9vbDogZ2V0QWN0aXZlVG9vbCgpLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIGRpc3BhdGNoKGFjdGlvbik7XG4gICAgfTtcblxuICAgIGNvbnN0IG9uUG9pbnRlckRvd24gPSAoZTogUG9pbnRlckV2ZW50KTogdm9pZCA9PiB7XG4gICAgICAvLyBQaGFzZSA2IOKAlCBvdmVybGF5IHN1cmZhY2VzIChjb21wb3NlciAvIHRocmVhZCAvIG1lbnRpb24gcG9wdXApIG93blxuICAgICAgLy8gdGhlaXIgb3duIGNsaWNrcy4gVGhlIHJvdXRlciBpcyBpbiBjYXB0dXJlIHBoYXNlLCBzbyB3ZSBoYXZlIHRvXG4gICAgICAvLyBiYWlsIEhFUkUgYmVmb3JlIGNsYXNzaWZ5IGNhbiBjbGFpbSB0aGUgZXZlbnQuXG4gICAgICBpZiAoaXNPdmVybGF5VGFyZ2V0KGUudGFyZ2V0KSkgcmV0dXJuO1xuICAgICAgY29uc3QgYWN0aW9uID0gY2xhaW0oXG4gICAgICAgIGNsYXNzaWZ5KHtcbiAgICAgICAgICB0eXBlOiAncG9pbnRlcmRvd24nLFxuICAgICAgICAgIGJ1dHRvbjogZS5idXR0b24sXG4gICAgICAgICAgbWV0YUtleTogZS5tZXRhS2V5LFxuICAgICAgICAgIGN0cmxLZXk6IGUuY3RybEtleSxcbiAgICAgICAgICBzaGlmdEtleTogZS5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGUuYWx0S2V5LFxuICAgICAgICAgIGNsaWVudFg6IGUuY2xpZW50WCxcbiAgICAgICAgICBjbGllbnRZOiBlLmNsaWVudFksXG4gICAgICAgICAgc3BhY2VIZWxkOiBpc1NwYWNlSGVsZD8uKCkgPz8gZmFsc2UsXG4gICAgICAgICAgYWN0aXZlVG9vbDogZ2V0QWN0aXZlVG9vbCgpLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIGlmIChhY3Rpb24ua2luZCAhPT0gJ25vLW9wJykge1xuICAgICAgICAvLyBTdXBwcmVzcyBuYXRpdmUgYmVoYXZpb3Igb24gZXZlcnkgZXZlbnQgdGhlIHJvdXRlciBjbGFpbXMg4oCUXG4gICAgICAgIC8vIGJ1dHRvbiBwcmVzc2VzIGRvbid0IGZpcmUsIGlucHV0cyBkb24ndCBmb2N1cywgdGhlIGNhbnZhc1xuICAgICAgICAvLyBjb250ZW50J3Mgb3duIGNsaWNrIGhhbmRsZXJzIGRvbid0IHJ1bi4gVGhlIHJvdXRlciBsaXZlcyBpblxuICAgICAgICAvLyBjYXB0dXJlIHBoYXNlIHNvIHRoaXMgZmlyZXMgYmVmb3JlIGRlc2NlbmRhbnRzLlxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICB9XG4gICAgICBkaXNwYXRjaChhY3Rpb24pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBQYWlyZWQgbW91c2Vkb3duIGxpc3RlbmVyIOKAlCBwcmV2ZW50RGVmYXVsdCBvbiBwb2ludGVyZG93biBkb2VzIE5PVFxuICAgICAqIHN1cHByZXNzIHRoZSBtb3VzZWRvd24gZXZlbnQgdGhhdCBicm93c2VycyBmaXJlIGFsb25nc2lkZSwgYW5kXG4gICAgICogYDxpbnB1dD5gIC8gYDxidXR0b24+YCBmb2N1cyBpcyBkcml2ZW4gYnkgbW91c2Vkb3duJ3MgZGVmYXVsdCBiZWhhdmlvci5cbiAgICAgKiBXZSBtaXJyb3IgdGhlIHNhbWUgZ2F0ZSBhcyBwb2ludGVyZG93biBzbyBzdXBwcmVzc2VkIHBvaW50ZXJkb3ducyBhbHNvXG4gICAgICogc3RvcCB0aGVpciB0d2luIG1vdXNlZG93bi5cbiAgICAgKi9cbiAgICBjb25zdCBvbk1vdXNlRG93biA9IChlOiBNb3VzZUV2ZW50KTogdm9pZCA9PiB7XG4gICAgICBpZiAoaXNPdmVybGF5VGFyZ2V0KGUudGFyZ2V0KSkgcmV0dXJuO1xuICAgICAgY29uc3QgYWN0aW9uID0gY2xhaW0oXG4gICAgICAgIGNsYXNzaWZ5KHtcbiAgICAgICAgICB0eXBlOiAncG9pbnRlcmRvd24nLFxuICAgICAgICAgIGJ1dHRvbjogZS5idXR0b24sXG4gICAgICAgICAgbWV0YUtleTogZS5tZXRhS2V5LFxuICAgICAgICAgIGN0cmxLZXk6IGUuY3RybEtleSxcbiAgICAgICAgICBzaGlmdEtleTogZS5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGUuYWx0S2V5LFxuICAgICAgICAgIGNsaWVudFg6IGUuY2xpZW50WCxcbiAgICAgICAgICBjbGllbnRZOiBlLmNsaWVudFksXG4gICAgICAgICAgc3BhY2VIZWxkOiBpc1NwYWNlSGVsZD8uKCkgPz8gZmFsc2UsXG4gICAgICAgICAgYWN0aXZlVG9vbDogZ2V0QWN0aXZlVG9vbCgpLFxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIGlmIChhY3Rpb24ua2luZCAhPT0gJ25vLW9wJykge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENsaWNrIGxpc3RlbmVyIOKAlCBmaXJlcyBBRlRFUiBwb2ludGVyZG93bitwb2ludGVydXAuIEV2ZW4gd2l0aFxuICAgICAqIHByZXZlbnREZWZhdWx0IG9uIG1vdXNlZG93biwgdGhlIGNsaWNrIGV2ZW50IHN0aWxsIHN5bnRoZXNpemVzIGZvclxuICAgICAqIG5vbi1mb3JtIGVsZW1lbnRzLiBXZSBzdXBwcmVzcyBpdCB3aGVuZXZlciB0aGUgcm91dGVyIGNsYWltZWQgdGhlXG4gICAgICogbWF0Y2hpbmcgcG9pbnRlcmRvd24gKHJlLWNsYXNzaWZ5IHdpdGggdGhlIHNhbWUgbW9kaWZpZXJzKS5cbiAgICAgKi9cbiAgICBjb25zdCBvbkNsaWNrID0gKGU6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgIGlmIChpc092ZXJsYXlUYXJnZXQoZS50YXJnZXQpKSByZXR1cm47XG4gICAgICBjb25zdCB0b29sID0gZ2V0QWN0aXZlVG9vbCgpO1xuICAgICAgY29uc3QgbW9kID0gZS5tZXRhS2V5IHx8IGUuY3RybEtleTtcbiAgICAgIC8vIE1hcCB0aGUgY2xpY2sgdG8gdGhlIGFjdGlvbiBraW5kIHRoZSBtYXRjaGluZyBwb2ludGVyZG93biB3b3VsZCBoYXZlXG4gICAgICAvLyBwcm9kdWNlZCwgdGhlbiBob25vciB0aGUgY2xhaW0gYWxsb3dsaXN0IHNvIGEgc2NvcGVkIHJvdXRlciAodGhlXG4gICAgICAvLyBjb21tZW50IG1vdW50IGxheWVyKSBkb2Vzbid0IHN1cHByZXNzIGNsaWNrcyBpdCBuZXZlciBjbGFpbWVkLlxuICAgICAgY29uc3Qgd291bGRSb3V0ZUtpbmQ6IFJvdXRlckFjdGlvblsna2luZCddIHwgbnVsbCA9XG4gICAgICAgIHRvb2wgPT09ICdjb21tZW50J1xuICAgICAgICAgID8gJ2Ryb3AtY29tbWVudCdcbiAgICAgICAgICA6IHRvb2wgPT09ICdtb3ZlJyAmJiBtb2QgJiYgZS5idXR0b24gPT09IDBcbiAgICAgICAgICAgID8gJ3NlbGVjdCdcbiAgICAgICAgICAgIDogZS5idXR0b24gPT09IDJcbiAgICAgICAgICAgICAgPyAnY29udGV4dC1tZW51J1xuICAgICAgICAgICAgICA6IG51bGw7XG4gICAgICBpZiAod291bGRSb3V0ZUtpbmQgJiYgKCFjbGFpbWFibGVBY3Rpb25zIHx8IGNsYWltYWJsZUFjdGlvbnMuaGFzKHdvdWxkUm91dGVLaW5kKSkpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBvbkNvbnRleHRNZW51ID0gKGU6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgIGNvbnN0IGFjdGlvbiA9IGNsYWltKFxuICAgICAgICBjbGFzc2lmeSh7XG4gICAgICAgICAgdHlwZTogJ2NvbnRleHRtZW51JyxcbiAgICAgICAgICBjbGllbnRYOiBlLmNsaWVudFgsXG4gICAgICAgICAgY2xpZW50WTogZS5jbGllbnRZLFxuICAgICAgICAgIG1ldGFLZXk6IGUubWV0YUtleSxcbiAgICAgICAgICBjdHJsS2V5OiBlLmN0cmxLZXksXG4gICAgICAgICAgc2hpZnRLZXk6IGUuc2hpZnRLZXksXG4gICAgICAgICAgYWx0S2V5OiBlLmFsdEtleSxcbiAgICAgICAgICBhY3RpdmVUb29sOiBnZXRBY3RpdmVUb29sKCksXG4gICAgICAgIH0pXG4gICAgICApO1xuICAgICAgaWYgKGFjdGlvbi5raW5kID09PSAnbm8tb3AnKSByZXR1cm47IC8vIG5vdCBvdXJzIHRvIGNsYWltIOKAlCBsZXQgaXQgYnViYmxlXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgZGlzcGF0Y2goYWN0aW9uKTtcbiAgICB9O1xuXG4gICAgY29uc3Qgb25LZXlEb3duID0gKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgIGNvbnN0IGFjdGlvbiA9IGNsYWltKFxuICAgICAgICBjbGFzc2lmeSh7XG4gICAgICAgICAgdHlwZTogJ2tleWRvd24nLFxuICAgICAgICAgIGtleTogZS5rZXksXG4gICAgICAgICAgbWV0YUtleTogZS5tZXRhS2V5LFxuICAgICAgICAgIGN0cmxLZXk6IGUuY3RybEtleSxcbiAgICAgICAgICBzaGlmdEtleTogZS5zaGlmdEtleSxcbiAgICAgICAgICBhbHRLZXk6IGUuYWx0S2V5LFxuICAgICAgICAgIGlzRWRpdGFibGU6IGlzRWRpdGFibGVUYXJnZXQoZS50YXJnZXQpLFxuICAgICAgICAgIGFjdGl2ZVRvb2w6IGdldEFjdGl2ZVRvb2woKSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgICBpZiAoXG4gICAgICAgIGFjdGlvbi5raW5kID09PSAndG9vbCcgfHxcbiAgICAgICAgYWN0aW9uLmtpbmQgPT09ICdlc2NhcGUnIHx8XG4gICAgICAgIGFjdGlvbi5raW5kID09PSAndW5kbycgfHxcbiAgICAgICAgYWN0aW9uLmtpbmQgPT09ICdyZWRvJ1xuICAgICAgKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIH1cbiAgICAgIGRpc3BhdGNoKGFjdGlvbik7XG4gICAgfTtcblxuICAgIC8vIENhcHR1cmUgcGhhc2UgZm9yIHBvaW50ZXIvbW91c2UvY2xpY2sgZXZlbnRzIOKAlCByb3V0ZXIgcnVucyBCRUZPUkVcbiAgICAvLyBkZXNjZW5kYW50cyAoYnV0dG9ucywgaW5wdXRzLCBjYW52YXMgY29udGVudCBsaXN0ZW5lcnMpLiBGb3IgZXZlbnRzIHRoZVxuICAgIC8vIGNsYXNzaWZpZXIgY2xhaW1zLCB3ZSBwcmV2ZW50RGVmYXVsdCArIHN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiBzbyB0aGVcbiAgICAvLyBkZXNjZW5kYW50cyBuZXZlciBzZWUgdGhlbS5cbiAgICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgb25Qb2ludGVyTW92ZSwgeyBwYXNzaXZlOiB0cnVlIH0pO1xuICAgIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCBvblBvaW50ZXJEb3duLCB7IGNhcHR1cmU6IHRydWUgfSk7XG4gICAgaG9zdC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBvbk1vdXNlRG93biwgeyBjYXB0dXJlOiB0cnVlIH0pO1xuICAgIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvbkNsaWNrLCB7IGNhcHR1cmU6IHRydWUgfSk7XG4gICAgaG9zdC5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIG9uQ29udGV4dE1lbnUsIHsgY2FwdHVyZTogdHJ1ZSB9KTtcbiAgICAvLyBLZXkgZXZlbnRzOiBhdHRhY2ggb24gZG9jdW1lbnQgc28gZm9jdXMgaW5zaWRlIGFueSBkZXNjZW5kYW50IGlzIE9LO1xuICAgIC8vIHRoZSBlZGl0YWJsZS10YXJnZXQgZ2F0ZSBoYW5kbGVzIHRoZSBcInVzZXIgaXMgdHlwaW5nXCIgY2FzZS5cbiAgICBjb25zdCBkb2MgPSBob3N0Lm93bmVyRG9jdW1lbnQgPz8gZG9jdW1lbnQ7XG4gICAgZG9jLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbktleURvd24sIHRydWUpO1xuXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCBvblBvaW50ZXJNb3ZlKTtcbiAgICAgIGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCBvblBvaW50ZXJEb3duLCB7XG4gICAgICAgIGNhcHR1cmU6IHRydWUsXG4gICAgICB9IGFzIEV2ZW50TGlzdGVuZXJPcHRpb25zKTtcbiAgICAgIGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgb25Nb3VzZURvd24sIHsgY2FwdHVyZTogdHJ1ZSB9IGFzIEV2ZW50TGlzdGVuZXJPcHRpb25zKTtcbiAgICAgIGhvc3QucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvbkNsaWNrLCB7IGNhcHR1cmU6IHRydWUgfSBhcyBFdmVudExpc3RlbmVyT3B0aW9ucyk7XG4gICAgICBob3N0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51Jywgb25Db250ZXh0TWVudSwge1xuICAgICAgICBjYXB0dXJlOiB0cnVlLFxuICAgICAgfSBhcyBFdmVudExpc3RlbmVyT3B0aW9ucyk7XG4gICAgICBkb2MucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIG9uS2V5RG93biwgdHJ1ZSk7XG4gICAgfTtcbiAgfSwgW2VuYWJsZWQsIGhvc3RSZWYsIGdldEFjdGl2ZVRvb2wsIGlzU3BhY2VIZWxkLCBjYWxsYmFja3MsIGNsYWltYWJsZUFjdGlvbnNdKTtcbn1cblxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyByZXNvbHZlSG92ZXJUYXJnZXQg4oCUIHdhbGtzIGZyb20gYSBjbGllbnRYL2NsaWVudFkgcGFpciB0byB0aGUgY2FudmFzIGVsZW1lbnRcbi8vIG9mIGludGVyZXN0LiBEZWZhdWx0ID0gdG9wbW9zdCBgW2RhdGEtY2QtaWRdYCBhbmNlc3RvciAodGhlIHN0YWJsZVxuLy8gcGlwZWxpbmUtc3RhbXBlZCBhbmNob3IpLiBgZGVlcCA9IHRydWVgIHJldHVybnMgdGhlIGRlZXBlc3QgZGVzY2VuZGFudFxuLy8gKENtZC1ob3ZlciBiZWhhdmlvcikuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSG92ZXJUYXJnZXQge1xuICBlbDogRWxlbWVudDtcbiAgY2RJZDogc3RyaW5nIHwgbnVsbDtcbiAgYXJ0Ym9hcmRJZDogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVIb3ZlclRhcmdldChcbiAgZG9jOiBEb2N1bWVudCxcbiAgY2xpZW50WDogbnVtYmVyLFxuICBjbGllbnRZOiBudW1iZXIsXG4gIG9wdHM6IHsgZGVlcDogYm9vbGVhbiB9XG4pOiBIb3ZlclRhcmdldCB8IG51bGwge1xuICBjb25zdCBoaXQgPSBkb2MuZWxlbWVudEZyb21Qb2ludChjbGllbnRYLCBjbGllbnRZKTtcbiAgaWYgKCFoaXQpIHJldHVybiBudWxsO1xuICAvLyBTa2lwIHRoZSBmbG9hdGluZyBjaHJvbWUgKE1pbmlNYXAgLyBab29tVG9vbGJhciAvIFRvb2xQYWxldHRlIC8gQ29udGV4dE1lbnUpXG4gIC8vIEFORCB0aGUgY2FudmFzL3dvcmxkIGZyYW1lIGl0c2VsZiDigJQgdGhlIHVzZXIgaXMgbmV2ZXIgYXNraW5nIHRvIFwic2VsZWN0XG4gIC8vIHRoZSBlbnRpcmUgY2FudmFzIHZpZXdwb3J0LFwiIHRoYXQncyBhIFVJIGFjY2lkZW50IGZyb20gY2xpbWJpbmcgdG9vIGhpZ2guXG4gIGlmIChoaXQuY2xvc2VzdD8uKCcuZGMtbW0sIC5kYy16b29tLXRiLCAuZGMtdG9vbC1wYWxldHRlLCAuZGMtY29udGV4dC1tZW51LCAuZGMtY3YtZ3JvdXAtYmJveCcpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBhcnRib2FyZEVsID0gaGl0LmNsb3Nlc3Q/LignW2RhdGEtZGMtc2NyZWVuXScpID8/IG51bGw7XG4gIGNvbnN0IGFydGJvYXJkSWQgPSBhcnRib2FyZEVsPy5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGMtc2NyZWVuJykgPz8gbnVsbDtcblxuICAvLyBIb3Zlci10YXJnZXQgaGFyZCBjZWlsaW5nID0gYC5kYy1hcnRib2FyZC1ib2R5YC4gSW5uZXIgRE9NIGNvbnRlbnQgbGl2ZXNcbiAgLy8gdGhlcmU7IGNocm9tZSBsaXZlcyBvdXRzaWRlIChsYWJlbCwgaGVhZGVyLCBhcnRpY2xlIHJvb3QpLiBUaGUgdHdvIHBhdGhzXG4gIC8vIGRpdmVyZ2UgZnJvbSBoZXJlOlxuICAvLyAgICogaGl0IOKIiCBib2R5IOKGkiByZXNvbHZlIHRvIHRoZSBkZWVwZXN0IHN0YW1wZWQgZWxlbWVudCAoZXhpc3RpbmdcbiAgLy8gICAgIGRlZXAvdG9wIGxvZ2ljIGJlbG93KS5cbiAgLy8gICAqIGhpdCDiiIggY2hyb21lIChsYWJlbC9oZWFkZXIvYXJ0aWNsZS1yb290KSDihpIgdGhlIHVzZXIgd2FudHMgdG8gc2VsZWN0XG4gIC8vICAgICB0aGUgV0hPTEUgYXJ0Ym9hcmQuIFJldHVybiB0aGUgYXJ0aWNsZSBlbGVtZW50IGl0c2VsZiB3aXRoIG5vIGNkSWQ7XG4gIC8vICAgICBjb25zdW1lcnMgKGhvdmVyVGFyZ2V0VG9TZWxlY3Rpb24pIGZhbGwgYmFjayB0byBhXG4gIC8vICAgICBgW2RhdGEtZGMtc2NyZWVuPVwi4oCmXCJdYCBzZWxlY3RvciB0aGF0IHdyYXBzIHRoZSB3aG9sZSBmcmFtZS4gVGhpcyBpc1xuICAvLyAgICAgd2hhdCBlbmFibGVzIENtZCtTaGlmdCtDbGljayBtdWx0aS1zZWxlY3Qgb2YgYXJ0Ym9hcmRzIChUMjQgLyBHOCkuXG4gIGNvbnN0IGJvZHlFbCA9IGhpdC5jbG9zZXN0Py4oJy5kYy1hcnRib2FyZC1ib2R5JykgPz8gbnVsbDtcbiAgaWYgKCFib2R5RWwpIHtcbiAgICBpZiAoYXJ0Ym9hcmRFbCAmJiBhcnRib2FyZElkKSB7XG4gICAgICByZXR1cm4geyBlbDogYXJ0Ym9hcmRFbCwgY2RJZDogbnVsbCwgYXJ0Ym9hcmRJZCB9O1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBpZiAoaGl0ID09PSBib2R5RWwpIHtcbiAgICAvLyBDbGlja2VkIHRoZSBib2R5IHdyYXBwZXIgaXRzZWxmIChlbXB0eSBwYWRkaW5nIGluc2lkZSBhbiBhcnRib2FyZCwgbm9cbiAgICAvLyB1c2VyIGNvbnRlbnQgdW5kZXIgdGhlIGN1cnNvcikuIFByb21vdGUgdG8gXCJzZWxlY3Qgd2hvbGUgYXJ0Ym9hcmRcIiBzb1xuICAgIC8vIHRoZSBnZXN0dXJlIHN0YXlzIGNvbnNpc3RlbnQgd2l0aCBjaHJvbWUgY2xpY2tzIGFib3ZlLlxuICAgIGlmIChhcnRib2FyZEVsICYmIGFydGJvYXJkSWQpIHtcbiAgICAgIHJldHVybiB7IGVsOiBhcnRib2FyZEVsLCBjZElkOiBudWxsLCBhcnRib2FyZElkIH07XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgaWYgKG9wdHMuZGVlcCkge1xuICAgIC8vIERlZXBlc3QgbW9kZSDigJQgdGhlIGhpdCBlbGVtZW50IElTIHRoZSB0YXJnZXQuIFVzZSBpdHMgT1dOIGRhdGEtY2QtaWRcbiAgICAvLyB3aGVuIHByZXNlbnQ7IG5ldmVyIGNsaW1iIHRvIGFuIGFuY2VzdG9yJ3MgaWQgKGNsaW1iaW5nIHdhcyB0aGUgY2F1c2VcbiAgICAvLyBvZiBcIkNtZC1jbGljayBvbiBhIGRlZXAgc3BhbiBzZWxlY3RzIHRoZSB3aG9sZSBhcnRib2FyZCByb290XCIpLiBXaGVuXG4gICAgLy8gdGhlIGhpdCBsYWNrcyBhIHN0YW1wZWQgaWQsIGNvbnN1bWVycyBmYWxsIGJhY2sgdG8gYSBDU1MtcGF0aCBzZWxlY3Rvci5cbiAgICBjb25zdCBjZElkID0gaGl0LmdldEF0dHJpYnV0ZT8uKCdkYXRhLWNkLWlkJykgPz8gbnVsbDtcbiAgICByZXR1cm4geyBlbDogaGl0LCBjZElkLCBhcnRib2FyZElkIH07XG4gIH1cblxuICAvLyBUb3AgbW9kZSDigJQgY2xpbWIgdG8gdGhlIHRvcG1vc3QgZGVzY2VuZGFudCBvZiB0aGUgYXJ0Ym9hcmQgYm9keSB0aGF0XG4gIC8vIHN0aWxsIGNhcnJpZXMgYSBkYXRhLWNkLWlkLiBIYXJkIGNlaWxpbmcgaXMgYm9keUVsIGl0c2VsZiAobmV2ZXIgc2VsZWN0XG4gIC8vIHRoZSBib2R5IHdyYXBwZXIgb3IgaGlnaGVyKS5cbiAgbGV0IGN1cjogRWxlbWVudCB8IG51bGwgPSBoaXQ7XG4gIGxldCB0b3BDZEVsOiBFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHdoaWxlIChjdXIgJiYgY3VyICE9PSBib2R5RWwpIHtcbiAgICBpZiAoY3VyLmhhc0F0dHJpYnV0ZT8uKCdkYXRhLWNkLWlkJykpIHRvcENkRWwgPSBjdXI7XG4gICAgY3VyID0gY3VyLnBhcmVudEVsZW1lbnQ7XG4gIH1cbiAgY29uc3QgZWwgPSB0b3BDZEVsID8/IGhpdDtcbiAgY29uc3QgY2RJZCA9IGVsLmdldEF0dHJpYnV0ZT8uKCdkYXRhLWNkLWlkJykgPz8gbnVsbDtcbiAgcmV0dXJuIHsgZWwsIGNkSWQsIGFydGJvYXJkSWQgfTtcbn1cbiIsCiAgICAiLyoqXG4gKiBAZmlsZSAgICAgICB1c2UtdG9vbC1tb2RlLnRzeCDigJQgUGhhc2UgNC4xIHRvb2wtbW9kZSBzdG9yZVxuICogQHNjb3BlICAgICAgcGx1Z2lucy9kZXNpZ24vZGV2LXNlcnZlci91c2UtdG9vbC1tb2RlLnRzeFxuICogQHB1cnBvc2UgICAgQ29udGV4dCArIGhvb2sgZm9yIHRoZSBhY3RpdmUgY2FudmFzIHRvb2wuIFdpcmVkIGludG9cbiAqICAgICAgICAgICAgIERlc2lnbkNhbnZhcy4gUGhhc2UgNSB3aWxsXG4gKiAgICAgICAgICAgICByZWdpc3RlciBhZGRpdGlvbmFsIHRvb2xzIChwZW4sIGNpcmNsZSwgYXJyb3csIGVyYXNlcikgdmlhXG4gKiAgICAgICAgICAgICB0aGUgc2FtZSBwcm92aWRlciDigJQgdGhlIEFQSSBpcyBpbnRlbnRpb25hbGx5IG9wZW4uXG4gKlxuICogVGhlIHJvdXRlcidzIGBvblRvb2xgIGNhbGxiYWNrIChpbnB1dC1yb3V0ZXIudHN4KSB3cml0ZXMgaW50byB0aGlzIHN0b3JlLlxuICogVGhlIFRvb2xQYWxldHRlICsgY3Vyc29yIHN5bmMgcmVhZCBmcm9tIGl0LiBTZWxlY3RpbmcgYSB0b29sIGFsc28gbXV0YXRlc1xuICogYGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yYCBzbyB0aGUgYWZmb3JkYW5jZSBtYXRjaGVzIGFjcm9zcyB0aGUgaWZyYW1lLlxuICovXG5cbmltcG9ydCB7XG4gIHR5cGUgUmVhY3ROb2RlLFxuICBjcmVhdGVDb250ZXh0LFxuICB1c2VDYWxsYmFjayxcbiAgdXNlQ29udGV4dCxcbiAgdXNlRWZmZWN0LFxuICB1c2VNZW1vLFxuICB1c2VTdGF0ZSxcbn0gZnJvbSAncmVhY3QnO1xuXG5pbXBvcnQgdHlwZSB7IFRvb2wgfSBmcm9tICcuL2lucHV0LXJvdXRlci50c3gnO1xuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFR5cGVzXG5cbmV4cG9ydCBpbnRlcmZhY2UgVG9vbERlc2NyaXB0b3Ige1xuICBpZDogVG9vbDtcbiAgbGFiZWw6IHN0cmluZztcbiAgLyoqIExldHRlci1rZXkgc2hvcnRjdXQgc2hvd24gaW4gdGhlIHBhbGV0dGUgdG9vbHRpcC4gKi9cbiAgc2hvcnRjdXQ6IHN0cmluZztcbiAgLyoqIENTUyBjdXJzb3IgdmFsdWUgYXBwbGllZCB0byA8Ym9keT4gd2hlbiB0aGlzIHRvb2wgaXMgYWN0aXZlLiAqL1xuICBjdXJzb3I6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfVE9PTFM6IHJlYWRvbmx5IFRvb2xEZXNjcmlwdG9yW10gPSBPYmplY3QuZnJlZXplKFtcbiAgeyBpZDogJ21vdmUnLCBsYWJlbDogJ01vdmUnLCBzaG9ydGN1dDogJ1YnLCBjdXJzb3I6ICdkZWZhdWx0JyB9LFxuICB7IGlkOiAnaGFuZCcsIGxhYmVsOiAnSGFuZCcsIHNob3J0Y3V0OiAnSCcsIGN1cnNvcjogJ2dyYWInIH0sXG4gIHsgaWQ6ICdjb21tZW50JywgbGFiZWw6ICdDb21tZW50Jywgc2hvcnRjdXQ6ICdDJywgY3Vyc29yOiAnY3Jvc3NoYWlyJyB9LFxuICAvLyBQaGFzZSA1IOKAlCBkcmF3IC8gYW5ub3RhdGlvbiB0b29scy4gQ3Vyc29ycyBzdGF5IGFzIGBjcm9zc2hhaXJgIGZvciBwZW4gL1xuICAvLyByZWN0IC8gYXJyb3cgKHRoZSBwZW4tdGlwIGdseXBoIGlzIHJlc2VydmVkIGZvciB0aGUgc3lzdGVtIHRleHQgY2FyZXQpLlxuICAvLyBFcmFzZXIgdXNlcyBgY2VsbGAgYXMgdGhlIGNsb3Nlc3QgY3Jvc3MtYnJvd3NlciBzdWJzdGl0dXRlIGZvciBhIHJ1YmJlclxuICAvLyBhZmZvcmRhbmNlIChubyBuYXRpdmUgcnViYmVyIGN1cnNvciBleGlzdHMpLlxuICB7IGlkOiAncGVuJywgbGFiZWw6ICdQZW4nLCBzaG9ydGN1dDogJ0InLCBjdXJzb3I6ICdjcm9zc2hhaXInIH0sXG4gIHsgaWQ6ICdyZWN0JywgbGFiZWw6ICdSZWN0Jywgc2hvcnRjdXQ6ICdSJywgY3Vyc29yOiAnY3Jvc3NoYWlyJyB9LFxuICB7IGlkOiAnZWxsaXBzZScsIGxhYmVsOiAnRWxsaXBzZScsIHNob3J0Y3V0OiAnTycsIGN1cnNvcjogJ2Nyb3NzaGFpcicgfSxcbiAgeyBpZDogJ2Fycm93JywgbGFiZWw6ICdBcnJvdycsIHNob3J0Y3V0OiAnQScsIGN1cnNvcjogJ2Nyb3NzaGFpcicgfSxcbiAgeyBpZDogJ2VyYXNlcicsIGxhYmVsOiAnRXJhc2VyJywgc2hvcnRjdXQ6ICdFJywgY3Vyc29yOiAnY2VsbCcgfSxcbl0pO1xuXG5pbnRlcmZhY2UgVG9vbENvbnRleHRWYWx1ZSB7XG4gIHRvb2w6IFRvb2w7XG4gIHNldFRvb2w6ICh0OiBUb29sKSA9PiB2b2lkO1xuICB0b29sczogcmVhZG9ubHkgVG9vbERlc2NyaXB0b3JbXTtcbiAgLyoqIFQxOSDigJQgc3RpY2t5LXRvb2wgZG91YmxlLWNsaWNrIGxvY2suIFdoZW4gYHN0aWNreS5sb2NrZWQgPT09IHRydWVgIEFORFxuICAgKiAgYHN0aWNreS50b29sID09PSB0b29sYCwgZHJhdyB0b29scyBzdGF5IGFybWVkIGFmdGVyIGVhY2ggc2hhcGUgY29tbWl0XG4gICAqICAoVDE4IGF1dG8tZmxpcCBpcyBzdXBwcmVzc2VkKS4gU2luZ2xlLWNsaWNrIG9uIGFueSBvdGhlciB0b29sIGNsZWFyc1xuICAgKiAgc3RpY2t5OyBFc2MgY2xlYXJzICsgZmxpcHMgdG8gTW92ZS4gKi9cbiAgc3RpY2t5OiB7IHRvb2w6IFRvb2wgfCBudWxsOyBsb2NrZWQ6IGJvb2xlYW4gfTtcbiAgdG9nZ2xlU3RpY2t5OiAodDogVG9vbCkgPT4gdm9pZDtcbiAgY2xlYXJTdGlja3k6ICgpID0+IHZvaWQ7XG59XG5cbmNvbnN0IFRvb2xDb250ZXh0ID0gY3JlYXRlQ29udGV4dDxUb29sQ29udGV4dFZhbHVlIHwgbnVsbD4obnVsbCk7XG5cbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUHJvdmlkZXJcblxuZXhwb3J0IGZ1bmN0aW9uIFRvb2xQcm92aWRlcih7XG4gIGNoaWxkcmVuLFxuICB0b29scyA9IERFRkFVTFRfVE9PTFMsXG4gIGluaXRpYWwgPSAnbW92ZScsXG59OiB7XG4gIGNoaWxkcmVuOiBSZWFjdE5vZGU7XG4gIHRvb2xzPzogcmVhZG9ubHkgVG9vbERlc2NyaXB0b3JbXTtcbiAgaW5pdGlhbD86IFRvb2w7XG59KSB7XG4gIGNvbnN0IFt0b29sLCBzZXRUb29sU3RhdGVdID0gdXNlU3RhdGU8VG9vbD4oaW5pdGlhbCk7XG4gIGNvbnN0IFtzdGlja3ksIHNldFN0aWNreV0gPSB1c2VTdGF0ZTx7IHRvb2w6IFRvb2wgfCBudWxsOyBsb2NrZWQ6IGJvb2xlYW4gfT4oKCkgPT4gKHtcbiAgICB0b29sOiBudWxsLFxuICAgIGxvY2tlZDogZmFsc2UsXG4gIH0pKTtcbiAgY29uc3Qgc2V0VG9vbCA9IHVzZUNhbGxiYWNrKCh0OiBUb29sKSA9PiB7XG4gICAgc2V0VG9vbFN0YXRlKHQpO1xuICAgIC8vIFNpbmdsZS1jbGljayBvbiBhIGRpZmZlcmVudCB0b29sIGNsZWFycyBhbnkgc3RpY2t5IGxvY2sg4oCUIHN0aWNreSBpc1xuICAgIC8vIGEgcGVyLXRvb2wgZmxhZywgbm90IGdsb2JhbC5cbiAgICBzZXRTdGlja3koKHByZXYpID0+IChwcmV2LmxvY2tlZCAmJiBwcmV2LnRvb2wgPT09IHQgPyBwcmV2IDogeyB0b29sOiBudWxsLCBsb2NrZWQ6IGZhbHNlIH0pKTtcbiAgfSwgW10pO1xuICBjb25zdCB0b2dnbGVTdGlja3kgPSB1c2VDYWxsYmFjaygodDogVG9vbCkgPT4ge1xuICAgIHNldFN0aWNreSgocHJldikgPT4ge1xuICAgICAgaWYgKHByZXYubG9ja2VkICYmIHByZXYudG9vbCA9PT0gdCkgcmV0dXJuIHsgdG9vbDogbnVsbCwgbG9ja2VkOiBmYWxzZSB9O1xuICAgICAgcmV0dXJuIHsgdG9vbDogdCwgbG9ja2VkOiB0cnVlIH07XG4gICAgfSk7XG4gICAgc2V0VG9vbFN0YXRlKHQpO1xuICB9LCBbXSk7XG4gIGNvbnN0IGNsZWFyU3RpY2t5ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldFN0aWNreSh7IHRvb2w6IG51bGwsIGxvY2tlZDogZmFsc2UgfSk7XG4gIH0sIFtdKTtcblxuICAvLyBCb2R5IGN1cnNvciBzeW5jIOKAlCBhcHBsaWVkIHRvIHRoZSBjYW52YXMgaWZyYW1lJ3MgYm9keSAodGhpcyBob29rIHJ1bnNcbiAgLy8gaW5zaWRlIHRoZSBpZnJhbWUgY29udGV4dCkuIFRoZSB2aWV3cG9ydC1jb250cm9sbGVyIHN0aWxsIG93bnMgdGhlXG4gIC8vIGdyYWJiaW5nL2dyYWIgY3Vyc29yIHN3YXAgZHVyaW5nIHNwYWNlLXBhbjsgdGhpcyBvbmx5IHNldHMgdGhlIHJlc3RpbmdcbiAgLy8gY3Vyc29yIGZvciB0aGUgYWN0aXZlIHRvb2wuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgICBjb25zdCBkZXNjID0gdG9vbHMuZmluZCgodCkgPT4gdC5pZCA9PT0gdG9vbCk7XG4gICAgaWYgKCFkZXNjKSByZXR1cm47XG4gICAgY29uc3QgcHJldiA9IGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gZGVzYy5jdXJzb3I7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gcHJldjtcbiAgICB9O1xuICB9LCBbdG9vbCwgdG9vbHNdKTtcblxuICBjb25zdCB2YWx1ZSA9IHVzZU1lbW88VG9vbENvbnRleHRWYWx1ZT4oXG4gICAgKCkgPT4gKHsgdG9vbCwgc2V0VG9vbCwgdG9vbHMsIHN0aWNreSwgdG9nZ2xlU3RpY2t5LCBjbGVhclN0aWNreSB9KSxcbiAgICBbdG9vbCwgc2V0VG9vbCwgdG9vbHMsIHN0aWNreSwgdG9nZ2xlU3RpY2t5LCBjbGVhclN0aWNreV1cbiAgKTtcblxuICByZXR1cm4gPFRvb2xDb250ZXh0LlByb3ZpZGVyIHZhbHVlPXt2YWx1ZX0+e2NoaWxkcmVufTwvVG9vbENvbnRleHQuUHJvdmlkZXI+O1xufVxuXG4vKipcbiAqIE1vdW50IGEgYFRvb2xQcm92aWRlcmAgb25seSB3aGVuIG5vbmUgZXhpc3RzIGFib3ZlIHVzLiBXaGVuIHRoZSBzaGVsbC1vd25lZFxuICogY29tbWVudCBtb3VudCBsYXllciAoY2FudmFzLWNvbW1lbnQtbW91bnQudHN4KSBhbHJlYWR5IHByb3ZpZGVzIG9uZSxcbiAqIGBEZXNpZ25DYW52YXNgIGNvbnN1bWVzIHRoYXQgaW5zdGFuY2UgaW5zdGVhZCBvZiBkb3VibGUtbW91bnRpbmcuIFRoZSBob29rXG4gKiBpcyBjYWxsZWQgdW5jb25kaXRpb25hbGx5OyBvbmx5IHRoZSByZXR1cm5lZCB0cmVlIGJyYW5jaGVzIChob29rIHJ1bGVzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIE1heWJlVG9vbFByb3ZpZGVyKHsgY2hpbGRyZW4gfTogeyBjaGlsZHJlbjogUmVhY3ROb2RlIH0pIHtcbiAgY29uc3Qgb3V0ZXIgPSB1c2VDb250ZXh0KFRvb2xDb250ZXh0KTtcbiAgaWYgKG91dGVyKSByZXR1cm4gPD57Y2hpbGRyZW59PC8+O1xuICByZXR1cm4gPFRvb2xQcm92aWRlcj57Y2hpbGRyZW59PC9Ub29sUHJvdmlkZXI+O1xufVxuXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEhvb2tcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZVRvb2xNb2RlKCk6IFRvb2xDb250ZXh0VmFsdWUge1xuICBjb25zdCBjdHggPSB1c2VDb250ZXh0KFRvb2xDb250ZXh0KTtcbiAgaWYgKCFjdHgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VzZVRvb2xNb2RlIG11c3QgYmUgdXNlZCBpbnNpZGUgPFRvb2xQcm92aWRlcj4nKTtcbiAgfVxuICByZXR1cm4gY3R4O1xufVxuXG4vKipcbiAqIFJlYWQtb25seSB2YXJpYW50IOKAlCByZXR1cm5zIGBudWxsYCB3aGVuIG5vIHByb3ZpZGVyIG1vdW50ZWQuIFVzZWQgYnlcbiAqIGNvbXBvbmVudHMgdGhhdCBjYW4gcmVuZGVyIG91dHNpZGUgYSBUb29sUHJvdmlkZXIgdHJlZSAodGhlIGlucHV0XG4gKiByb3V0ZXIncyBvcHRpb25hbCBwYXRoKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVzZVRvb2xNb2RlT3B0aW9uYWwoKTogVG9vbENvbnRleHRWYWx1ZSB8IG51bGwge1xuICByZXR1cm4gdXNlQ29udGV4dChUb29sQ29udGV4dCk7XG59XG4iCiAgXSwKICAibWFwcGluZ3MiOiAiO0FBNEJBO0FBQUE7QUFBQSxlQUlFO0FBQUEsYUFDQTtBQUFBLFlBQ0E7QUFBQSxjQUNBO0FBQUE7QUFFRjs7O0FDSEEsd0JBQVMsMkJBQWEsdUJBQVcsb0JBQVMscUJBQVE7OztBQ2hCbEQ7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUFBO0FBMlBBLElBQU0sZ0JBQWdCLGNBQWtDLElBQUk7QUFFckQsU0FBUyxT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QUNqQyxJQUFJO0FBQUEsTUFDRixPQUFPLE9BQU8sWUFBWSxFQUFFLEtBQUssbUJBQW1CLFVBQVUsR0FBRyxHQUFHO0FBQUEsTUFDcEUsTUFBTTtBQUFBLEVBR1Y7QUFBQTtBQWdCSyxTQUFTLFdBQVcsQ0FBQyxRQUF1QixNQUFnQztBQUFBLEVBQ2pGLE1BQU0sT0FBTyxXQUFXLEtBQUssTUFBTTtBQUFBLEVBQ25DLElBQUksQ0FBQyxLQUFLLGlCQUFpQjtBQUFBLElBQ3pCLEtBQUssT0FBTyxjQUFjLE1BQU0sQ0FBQztBQUFBLElBQ2pDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTSxPQUFPLEtBQUssUUFBUSxZQUFXO0FBQUEsRUFDckMsS0FBSyxPQUNILGNBQ0UsbUJBQ0EsTUFDQSxjQUNFLDJCQUNBLE1BQ0EsY0FBYyxhQUFhLEVBQUUsS0FBSyxHQUFHLGNBQWMsTUFBTSxDQUFDLENBQzVELENBQ0YsQ0FDRjtBQUFBOyIsCiAgImRlYnVnSWQiOiAiMkI2MkFDQjVERDhBMzVBMTY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
