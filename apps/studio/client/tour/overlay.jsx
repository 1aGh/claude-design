// overlay.jsx — hand-rolled guided-tour engine (zero runtime dep, DDR-B).
//
// One <TourOverlay steps={[…]} open onClose onComplete/> drives both the
// per-feature spotlight tours (a What's New entry's `tour[]`) and the evergreen
// usage tour. A step = { target (CSS selector / [data-tour] anchor), title,
// body, placement? }. A step whose target can't be resolved still shows, just
// centered with no spotlight — the tour never dead-ends on a missing element.
//
// A11y: role="dialog" + aria-modal, focus moves to the primary button on each
// step and is trapped within the card, focus is restored on close, Esc skips,
// ←/→ navigate. prefers-reduced-motion disables the spotlight transition.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

function getRect(target) {
  if (typeof document === 'undefined' || !target) return null;
  try {
    const el = document.querySelector(target);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return r;
  } catch {
    return null;
  }
}

const CARD_W = 320;
const CARD_H_EST = 168;

function computeCardStyle(rect) {
  if (typeof window === 'undefined' || !rect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: CARD_W };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const roomBelow = vh - rect.bottom;
  const top =
    roomBelow > CARD_H_EST + 24 ? rect.bottom + 12 : Math.max(12, rect.top - CARD_H_EST - 12);
  const left = Math.min(Math.max(12, rect.left), vw - CARD_W - 12);
  return { top, left, width: CARD_W };
}

export function TourOverlay({ steps, open, onClose, onComplete }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);
  const prevFocus = useRef(null);

  const measure = useCallback(() => {
    const step = steps[i];
    setRect(step ? getRect(step.target) : null);
  }, [steps, i]);

  // Reset to the first step whenever a tour (re)opens.
  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  // Keep the spotlight glued to its target through scroll/resize; restore focus.
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    const onMove = () => measure();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      try {
        prevFocus.current?.focus?.();
      } catch {}
    };
  }, [open, measure]);

  const last = i >= steps.length - 1;
  const next = useCallback(() => {
    if (last) {
      onComplete?.();
      onClose?.();
    } else {
      setI((n) => Math.min(n + 1, steps.length - 1));
    }
  }, [last, onComplete, onClose, steps.length]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // Keyboard: Esc skips, ←/→ navigate, Tab is trapped within the card buttons.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      } else if (e.key === 'Tab') {
        const card = cardRef.current;
        if (!card) return;
        const f = card.querySelectorAll('button');
        if (!f.length) return;
        const first = f[0];
        const lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, next, back, onClose]);

  // Move focus to the primary action on each step (accessible dialog behavior).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const primary = cardRef.current?.querySelector('[data-tour-primary]');
      try {
        primary?.focus();
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [open, i]);

  if (!open || !steps.length) return null;
  const step = steps[i];
  const pad = 6;
  const spot = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  return (
    <div className="mdcc-tour" role="presentation">
      {spot ? (
        <div className="mdcc-tour__spot" style={spot} aria-hidden="true" />
      ) : (
        <div className="mdcc-tour__scrim" aria-hidden="true" />
      )}
      <div
        className="mdcc-tour__card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mdcc-tour-title"
        aria-describedby="mdcc-tour-body"
        style={computeCardStyle(rect)}
      >
        <div className="mdcc-tour__step">
          {i + 1} / {steps.length}
        </div>
        <div className="mdcc-tour__title" id="mdcc-tour-title">
          {step.title}
        </div>
        <div className="mdcc-tour__body" id="mdcc-tour-body">
          {step.body}
        </div>
        <div className="mdcc-tour__actions">
          <button type="button" className="mdcc-tour__skip" onClick={onClose}>
            Skip
          </button>
          <div className="mdcc-tour__nav">
            {i > 0 && (
              <button type="button" className="mdcc-tour__back" onClick={back}>
                Back
              </button>
            )}
            <button type="button" className="mdcc-tour__next" data-tour-primary onClick={next}>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
