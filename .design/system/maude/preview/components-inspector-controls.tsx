/**
 * SPECIMEN: components-inspector-controls
 * DEMONSTRATES: the shared inspector control library (apps/studio/client/
 *   inspector-controls.jsx) AND the surrounding CssKnobs behaviours — the full
 *   control vocabulary the CSS + Photo panels draw on, using the SAME principles
 *   as the real inspector: provenance status dots (token-bound · raw override ·
 *   inherited), the token popover (Custom + Variables tabs), the box-model
 *   multi-side scrub grammar (Alt = opposite side · Alt+Shift = all four), and
 *   the composite Border + Typography rows. Controls: NumberField (icon/grip
 *   handle · steppers · unit), Slider / SliderField, IconButtonGroup + icon
 *   toggles, the 9-point AlignPad, SpacingBox, CornerQuad, PairedField (aspect
 *   lock), AngleDial, SizingMode, TokenColour, FillRow, Segmented, Select,
 *   Toggle / checkbox / radio.
 * FULLY INTERACTIVE: this canvas re-implements the interaction model INLINE (a
 *   standalone specimen can't import the client .jsx), so drag-to-scrub,
 *   Alt / Alt+Shift multi-side scrub, keyboard stepping (↑↓ ±step · Shift ×10 ·
 *   Home/End · Page), select-all-on-focus, the sliders, the token popover, and
 *   the angle dial all actually work — grab a handle, or focus a field and press
 *   the arrows.
 * ICONS: ./_inspector-icons (lucide geometry, vendored local — an npm import
 * cannot resolve in a browser-rendered canvas; Cloud Phase 25 A1).
 * COPY VOICE: real studio labels — Font size, Opacity, Corner radius, Border
 *   style, Fill, Line height, Rotation — never "Enter text" / "Label".
 * WHEN SCAFFOLDED: platform-desktop. This is the Inspector's own control map.
 * NOTES: the drag surface is the leading icon/grip, NEVER the input body — a
 *   click still focuses + select-alls instead of racing a scrub (the defect this
 *   library exists to fix). Kept visually 1:1 with the shipped `.st-cp-*` classes.
 */
import "../colors_and_type.css";
import "./_layout.css";
import { ThemeToggle } from "./_specimen-controls";
import "./components-inspector-controls.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ALargeSmall, AlignCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart, AlignHorizontalSpaceBetween, AlignJustify, AlignLeft,
  AlignRight, Baseline, Bold, Braces, Check, ChevronDown, Columns3, Diamond, Eye, EyeOff,
  Italic, Link, MoveHorizontal, Pipette, RotateCcw, RotateCw, Rows3, Scissors,
  ScrollText, Search, Spline, Square, SquareDashed, Underline, Unlink, Wand2, WrapText, X,
} from "./_inspector-icons";

/* ══════════════════════════════════════════════════════════════════════════
 * Interaction core — ported from apps/studio/client/inspector-controls.jsx so
 * this standalone canvas behaves EXACTLY like the shipped panel.
 * ════════════════════════════════════════════════════════════════════════ */

const clampTo = (n: number, min?: number, max?: number) => {
  let v = n;
  if (min != null && v < min) v = min;
  if (max != null && v > max) v = max;
  return v;
};
const precisionOf = (step: number) => {
  if (!(step > 0)) return 2;
  if (step >= 1) return 0;
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
};
const snap = (n: number, step: number) => Number(n.toFixed(precisionOf(step)));

/* ── colour math (ported verbatim from app.jsx's ColorPicker) ───────────────*/
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
type RGB = { r: number; g: number; b: number };
type HSV = { h: number; s: number; v: number };
function hexToRgb(hex: string): RGB { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return { r: 0, g: 0, b: 0 }; const n = Number.parseInt(m[1], 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function rgbToHex({ r, g, b }: RGB) { return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`; }
function rgbToHsv({ r, g, b }: RGB): HSV { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0; if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s: max ? d / max : 0, v: max }; }
function hsvToRgb({ h, s, v }: HSV): RGB { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }; }
let _colorCtx: CanvasRenderingContext2D | null = null;
function cssColorToHex(c: string): string {
  if (!c) return "";
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  try {
    if (!_colorCtx) _colorCtx = document.createElement("canvas").getContext("2d");
    if (!_colorCtx) return "";
    _colorCtx.fillStyle = "#000000"; _colorCtx.fillStyle = c;
    const v = _colorCtx.fillStyle;
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  } catch { /* canvas unavailable */ }
  return "";
}

// Inline HSV picker — SV pad + hue bar + RGB fields + eyedropper (mirrors the
// real ColorPicker so the Custom tab needs no second click into a native input).
function ColorPicker({ seed, onApply }: { seed: string; onApply: (hex: string) => void }) {
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(hexToRgb(seed || "#000000")));
  const hsvRef = useRef(hsv); hsvRef.current = hsv;
  const svRef = useRef<HTMLButtonElement>(null);
  const hueRef = useRef<HTMLButtonElement>(null);
  const hex = rgbToHex(hsvToRgb(hsv));
  const rgb = hsvToRgb(hsv);
  const dragSV = (e: React.PointerEvent) => {
    e.preventDefault(); const r = svRef.current?.getBoundingClientRect(); if (!r) return; const h = hsvRef.current.h;
    const move = (ev: PointerEvent) => setHsv({ h, s: clamp01((ev.clientX - r.left) / r.width), v: clamp01(1 - (ev.clientY - r.top) / r.height) });
    move(e.nativeEvent);
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); onApply(rgbToHex(hsvToRgb(hsvRef.current))); };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  };
  const dragHue = (e: React.PointerEvent) => {
    e.preventDefault(); const r = hueRef.current?.getBoundingClientRect(); if (!r) return; const { s, v } = hsvRef.current;
    const move = (ev: PointerEvent) => setHsv({ h: clamp01((ev.clientX - r.left) / r.width) * 360, s, v });
    move(e.nativeEvent);
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); onApply(rgbToHex(hsvToRgb(hsvRef.current))); };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  };
  const setRgb = (patch: Partial<RGB>) => { const next = { ...hsvToRgb(hsvRef.current), ...patch }; const h = rgbToHsv({ r: clamp01(next.r / 255) * 255, g: clamp01(next.g / 255) * 255, b: clamp01(next.b / 255) * 255 }); setHsv(h); onApply(rgbToHex(hsvToRgb(h))); };
  const eyedrop = async () => {
    try { const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper; if (!ED) return; const res = await new ED().open(); if (res?.sRGBHex) { setHsv(rgbToHsv(hexToRgb(res.sRGBHex))); onApply(res.sRGBHex); } } catch { /* cancelled */ }
  };
  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;
  return (
    <div className="icp-cpick">
      <div className="icp-cpick-hexrow">
        <span className="icp-cpick-hexsw" style={{ background: hex }} />
        <input className="icp-cpick-hex" aria-label="hex" value={hex} onChange={(e) => { const v = e.target.value; if (/^#?[0-9a-f]{6}$/i.test(v)) { setHsv(rgbToHsv(hexToRgb(v))); onApply(v.startsWith("#") ? v : `#${v}`); } }} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <button type="button" ref={svRef} className="icp-cpick-sv" aria-label="saturation and value" style={{ background: `hsl(${hsv.h} 100% 50%)` }} onPointerDown={dragSV}>
        <span className="icp-cpick-svwhite" /><span className="icp-cpick-svblack" />
        <span className="icp-cpick-knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </button>
      <div className="icp-cpick-controls">
        {hasEyeDropper ? <button type="button" className="icp-cpick-eye" aria-label="pick from screen" title="eyedropper" onClick={eyedrop}><Ic as={Pipette} size={14} /></button> : null}
        <span className="icp-cpick-preview" style={{ background: hex }} />
        <button type="button" ref={hueRef} className="icp-cpick-hue" aria-label="hue" onPointerDown={dragHue}><span className="icp-cpick-huethumb" style={{ left: `${(hsv.h / 360) * 100}%` }} /></button>
      </div>
      <div className="icp-cpick-rgb">
        {(["r", "g", "b"] as const).map((k) => (
          <label key={k} className="icp-cpick-rgbf">
            <input aria-label={k.toUpperCase()} value={Math.round(rgb[k])} onChange={(e) => setRgb({ [k]: clamp01((Number.parseFloat(e.target.value) || 0) / 255) * 255 } as Partial<RGB>)} onFocus={(e) => e.currentTarget.select()} />
            <span>{k.toUpperCase()}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// icon wrapper — hairline stroke to match the maude icon weight
type LC = typeof Bold;
const Ic = ({ as: C, size = 14 }: { as: LC; size?: number }) => <C className="icp-i" size={size} strokeWidth={1.75} />;

function useScrub({ getBase, min, max, step = 1, dial, onInput, onCommit }: { getBase: () => number; min?: number; max?: number; step?: number; dial?: boolean; onInput?: (n: number) => void; onCommit?: (n: number) => void }) {
  return useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const startX = e.clientX;
      const base = getBase();
      let scrubbing = false;
      let last = base;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        if (!scrubbing && Math.abs(dx) < 3) return;
        if (!scrubbing) { scrubbing = true; document.body.classList.add("icp-scrubbing"); if (dial) document.body.classList.add("icp-scrubbing--dial"); }
        ev.preventDefault();
        const mod = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
        last = snap(clampTo(base + dx * step * mod, min, max), step);
        onInput?.(last);
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (!scrubbing) return;
        document.body.classList.remove("icp-scrubbing", "icp-scrubbing--dial");
        onCommit?.(last);
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    },
    [getBase, min, max, step, dial, onInput, onCommit],
  );
}

type NumProps = { value: number; min?: number; max?: number; step?: number; lead?: React.ReactNode; scrub?: boolean; steppers?: boolean; disabled?: boolean; unitSlot?: React.ReactNode; ariaLabel: string; className?: string; onChange: (n: number) => void };
function NumberField({ value, min, max, step = 1, lead, scrub = true, steppers = true, disabled, unitSlot, ariaLabel, className = "", onChange }: NumProps) {
  const ref = useRef<HTMLInputElement>(null);
  const fmt = (n: number) => String(snap(Number(n) || 0, step));
  useEffect(() => { if (ref.current && document.activeElement !== ref.current) ref.current.value = fmt(value); }, [value]);
  const commit = (n: number) => { const v = snap(clampTo(n, min, max), step); if (ref.current) ref.current.value = fmt(v); onChange(v); };
  const onScrub = useScrub({ getBase: () => Number.parseFloat(ref.current?.value ?? "") || value, min, max, step, onInput: commit, onCommit: commit });
  const bump = (dir: number, mult: number) => commit((Number.parseFloat(ref.current?.value ?? "") || value) + dir * step * mult);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const mult = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowUp") { e.preventDefault(); bump(1, mult); }
    else if (e.key === "ArrowDown") { e.preventDefault(); bump(-1, mult); }
    else if (e.key === "PageUp") { e.preventDefault(); bump(1, 10); }
    else if (e.key === "PageDown") { e.preventDefault(); bump(-1, 10); }
    else if (e.key === "Home" && min != null) { e.preventDefault(); commit(min); }
    else if (e.key === "End" && max != null) { e.preventDefault(); commit(max); }
    else if (e.key === "Enter") e.currentTarget.blur();
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { const el = e.currentTarget; requestAnimationFrame(() => { if (document.activeElement === el) el.select(); }); };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => { const raw = e.currentTarget.value.trim(); if (raw === "") { e.currentTarget.value = fmt(value); return; } const n = Number.parseFloat(raw); if (Number.isNaN(n)) { e.currentTarget.value = fmt(value); return; } commit(n); };
  return (
    <div className={`icp-num ${className}${disabled ? " is-disabled" : ""}`.trim()}>
      {scrub ? (
        <span className="icp-num-lead" role="presentation" aria-hidden="true" title="Drag to change · Shift ×10 · Alt fine" onPointerDown={disabled ? undefined : onScrub}>{lead ?? <span className="icp-num-grip" />}</span>
      ) : lead ? (<span className="icp-num-lead" aria-hidden="true">{lead}</span>) : null}
      <input ref={ref} className="icp-num-in" role="spinbutton" aria-label={ariaLabel} aria-valuenow={Number(value) || 0} aria-valuemin={min} aria-valuemax={max} defaultValue={fmt(value)} inputMode="decimal" disabled={disabled} onFocus={onFocus} onKeyDown={onKeyDown} onBlur={onBlur} />
      {steppers ? (
        <span className="icp-num-step">
          <button type="button" className="icp-num-stepb" tabIndex={-1} aria-label={`increase ${ariaLabel}`} onClick={() => bump(1, 1)} style={{ transform: "rotate(180deg)" }}><Ic as={ChevronDown} size={11} /></button>
          <button type="button" className="icp-num-stepb" tabIndex={-1} aria-label={`decrease ${ariaLabel}`} onClick={() => bump(-1, 1)}><Ic as={ChevronDown} size={11} /></button>
        </span>
      ) : null}
      {unitSlot ?? null}
    </div>
  );
}

function Slider({ value, min = 0, max = 1, step = 0.01, ariaLabel, onChange }: { value: number; min?: number; max?: number; step?: number; ariaLabel: string; onChange: (n: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const v = clampTo(value, min, max);
  const span = max - min || 1;
  const frac = (v - min) / span;
  const zeroFrac = min < 0 && max > 0 ? (0 - min) / span : 0;
  const fillLeft = Math.min(frac, zeroFrac);
  const fillWidth = Math.abs(frac - zeroFrac);
  const valueAtX = (clientX: number) => { const r = trackRef.current?.getBoundingClientRect(); if (!r || r.width === 0) return v; const f = clampTo((clientX - r.left) / r.width, 0, 1); return snap(min + f * span, step); };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); trackRef.current?.focus(); onChange(valueAtX(e.clientX));
    const move = (ev: PointerEvent) => onChange(valueAtX(ev.clientX));
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const big = e.shiftKey ? 10 : 1; let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = v + step * big;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = v - step * big;
    else if (e.key === "PageUp") next = v + step * 10; else if (e.key === "PageDown") next = v - step * 10;
    else if (e.key === "Home") next = min; else if (e.key === "End") next = max;
    if (next != null) { e.preventDefault(); onChange(snap(clampTo(next, min, max), step)); }
  };
  return (
    <div className="icp-slider">
      <div ref={trackRef} className="icp-track" role="slider" tabIndex={0} aria-label={ariaLabel} aria-valuemin={min} aria-valuemax={max} aria-valuenow={v} onPointerDown={onPointerDown} onKeyDown={onKeyDown}>
        {min < 0 && max > 0 ? <span className="icp-zero" style={{ left: `${zeroFrac * 100}%` }} /> : null}
        <span className="icp-fill" style={{ left: `${fillLeft * 100}%`, width: `${fillWidth * 100}%` }} />
        <span className="icp-thumb" style={{ left: `${frac * 100}%` }} />
      </div>
    </div>
  );
}
function SliderField({ value, min = 0, max = 1, step = 0.01, unit = "", ariaLabel, onChange }: { value: number; min?: number; max?: number; step?: number; unit?: string; ariaLabel: string; onChange: (n: number) => void }) {
  return (
    <div className="icp-sfield">
      <Slider value={value} min={min} max={max} step={step} ariaLabel={ariaLabel} onChange={onChange} />
      <NumberField className="icp-num--compact" value={value} min={min} max={max} step={step} scrub={false} steppers={false} ariaLabel={ariaLabel} unitSlot={unit ? <span className="icp-num-suffix" aria-hidden="true">{unit}</span> : null} onChange={onChange} />
    </div>
  );
}

/* ── Provenance dot + inspector row (real .st-cp-prov / .st-cp-row anatomy) ──*/
type Prov = "bound" | "raw" | "inherit";
const PROV_LABEL: Record<Prov, string> = { bound: "token-bound", raw: "raw override", inherit: "inherited" };
function ProvDot({ kind, onReset }: { kind: Prov; onReset?: () => void }) {
  const reset = kind !== "inherit" && onReset;
  return <button type="button" className={`icp-prov icp-prov--${kind}${reset ? " is-resettable" : ""}`} aria-label={reset ? `${PROV_LABEL[kind]} · double-click to reset` : PROV_LABEL[kind]} title={reset ? `${PROV_LABEL[kind]} · double-click to reset` : PROV_LABEL[kind]} tabIndex={reset ? 0 : -1} onDoubleClick={reset ? onReset : undefined} />;
}
function InRow({ prov, label, children, onReset }: { prov: Prov; label: string; children: React.ReactNode; onReset?: () => void }) {
  return (
    <div className={`icp-inrow${prov === "inherit" ? " is-unset" : ""}`}>
      <ProvDot kind={prov} onReset={onReset} />
      <span className="icp-inrow-label" title={label}>{label}</span>
      <span className="icp-inrow-ctl">{children}</span>
    </div>
  );
}

/* ── Collapsable panel section (caret toggle + section reset) — real sec() ──*/
function PanelSection({ title, defaultOpen = true, onReset, children }: { title: string; defaultOpen?: boolean; onReset?: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="icp-panel-sec">
      <div className="icp-sechd-row">
        <button type="button" className="icp-sechd" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="icp-caret" aria-hidden="true"><Ic as={ChevronDown} size={12} /></span>{title}
        </button>
        {onReset ? <button type="button" className="icp-secreset" aria-label={`reset ${title} section`} title={`reset ${title}`} onClick={onReset}><Ic as={RotateCcw} size={12} /></button> : null}
      </div>
      {/* grid-rows 0fr→1fr animates the collapse while keeping the DOM mounted */}
      <div className={`icp-sec-anim${open ? " is-open" : ""}`}><div className="icp-sec-inner">{children}</div></div>
    </div>
  );
}

/* ── Field wrapper (gallery cell) ───────────────────────────────────────────*/
function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (<label className="icp-fld"><span className="icp-fld-label">{label}</span>{children}{help ? <span className="icp-fld-help">{help}</span> : null}</label>);
}

/* ── Icon button group + icon toggles ───────────────────────────────────────*/
type IconOpt = { value: string; node: React.ReactNode; label: string };
function IconButtonGroup({ value, options, ariaLabel, onChange }: { value: string; options: IconOpt[]; ariaLabel: string; onChange: (v: string) => void }) {
  return <div className="icp-iconseg" role="radiogroup" aria-label={ariaLabel}>{options.map((o) => (<button key={o.value} type="button" role="radio" aria-checked={value === o.value} aria-label={o.label} title={o.label} className={value === o.value ? "is-active" : ""} onClick={() => onChange(o.value)}>{o.node}</button>))}</div>;
}
function IconToggleGroup({ value, options, ariaLabel, onToggle }: { value: Record<string, boolean>; options: IconOpt[]; ariaLabel: string; onToggle: (v: string) => void }) {
  return <div className="icp-iconseg" role="group" aria-label={ariaLabel}>{options.map((o) => (<button key={o.value} type="button" aria-pressed={!!value[o.value]} aria-label={o.label} title={o.label} onClick={() => onToggle(o.value)}>{o.node}</button>))}</div>;
}

/* ── Select — compact native select, single caret, 26px (mirrors .st-cp-nsel) ─*/
function Select({ value, options, ariaLabel, minWidth = 120, onChange }: { value: string; options: string[]; ariaLabel: string; minWidth?: number; onChange: (v: string) => void }) {
  return (
    <span className="icp-selwrap" style={{ minWidth: minWidth || undefined, flex: minWidth ? undefined : "1 1 auto" }}>
      <select className="icp-nsel" aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      <span className="icp-selcaret" aria-hidden="true"><Ic as={ChevronDown} size={13} /></span>
    </span>
  );
}

/* ── Checkbox — custom box + check, in the DS accent language ────────────────*/
function Checkbox({ checked, label, onChange }: { checked: boolean; label: React.ReactNode; onChange: (v: boolean) => void }) {
  return (
    <label className="icp-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="icp-check-box"><Ic as={Check} size={11} /></span>
      {label}
    </label>
  );
}

/* ── 9-point alignment pad ──────────────────────────────────────────────────*/
const ALIGN_CELLS = ["tl", "tc", "tr", "cl", "cc", "cr", "bl", "bc", "br"];
function AlignPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <div className="icp-alignpad" role="radiogroup" aria-label="auto-layout alignment">{ALIGN_CELLS.map((c) => <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={`align ${c}`} className={value === c ? "is-active" : ""} onClick={() => onChange(c)} />)}</div>;
}

/* ── angle dial ─────────────────────────────────────────────────────────────*/
function AngleDial({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const angleAt = (cx: number, cy: number) => { const r = ref.current?.getBoundingClientRect(); if (!r) return value; let deg = Math.round((Math.atan2(cy - (r.top + r.height / 2), cx - (r.left + r.width / 2)) * 180) / Math.PI); if (deg < 0) deg += 360; return deg; };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); document.body.classList.add("icp-scrubbing", "icp-scrubbing--dial"); onChange(angleAt(e.clientX, e.clientY));
    const move = (ev: PointerEvent) => onChange(angleAt(ev.clientX, ev.clientY));
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.body.classList.remove("icp-scrubbing", "icp-scrubbing--dial"); };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const big = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + big;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - big;
    else if (e.key === "PageUp") next = value + 15;
    else if (e.key === "PageDown") next = value - 15;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 360;
    if (next != null) { e.preventDefault(); onChange(Math.max(0, Math.min(360, next))); }
  };
  return <button ref={ref} type="button" className="icp-dial" role="slider" aria-label="rotation dial" aria-valuemin={0} aria-valuemax={360} aria-valuenow={value} aria-valuetext={`${value}°`} title="drag to rotate · arrows to nudge" onPointerDown={onPointerDown} onKeyDown={onKeyDown}><span className="icp-dial-needle" style={{ ["--angle" as string]: `${value}deg` }} /></button>;
}

/* ── box-model spacing box with the FULL scrub grammar ─────────────────────
 * Alt = the opposite side too · Alt+Shift = all four (the real CssKnobs
 * side()/inset() modifiers, evaluated live per pointer-move). ───────────────*/
type Sides = { t: number; r: number; b: number; l: number };
function SpacingBox({ margin, padding, size, onMargin, onPadding }: { margin: Sides; padding: Sides; size: { w: number; h: number }; onMargin: (s: Sides) => void; onPadding: (s: Sides) => void }) {
  const mRef = useRef(margin); mRef.current = margin;
  const pRef = useRef(padding); pRef.current = padding;
  const sidesFor = (edge: keyof Sides, ev: { altKey: boolean; shiftKey: boolean }): (keyof Sides)[] => {
    if (ev.altKey && ev.shiftKey) return ["t", "r", "b", "l"];
    if (ev.altKey) return edge === "t" || edge === "b" ? ["t", "b"] : ["l", "r"];
    return [edge];
  };
  const cell = (group: "m" | "p", edge: keyof Sides) => {
    const get = () => (group === "m" ? mRef.current : pRef.current);
    const set = (fn: (s: Sides) => Sides) => (group === "m" ? onMargin(fn(mRef.current)) : onPadding(fn(pRef.current)));
    const apply = (val: number, sides: (keyof Sides)[]) => set((s) => { const n = { ...s }; for (const k of sides) n[k] = val; return n; });
    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const startX = e.clientX; const base = get()[edge]; let scrubbing = false;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        if (!scrubbing && Math.abs(dx) < 3) return;
        if (!scrubbing) { scrubbing = true; document.body.classList.add("icp-scrubbing"); }
        ev.preventDefault();
        apply(Math.max(0, Math.round(base + dx)), sidesFor(edge, ev));
      };
      const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.body.classList.remove("icp-scrubbing"); };
      document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
    };
    const cur = get()[edge];
    return (
      <input className={`icp-box-v icp-box-v--${edge}${cur === 0 ? " is-zero" : ""}`} aria-label={`${group === "m" ? "margin" : "padding"}-${edge}`} value={String(cur)} title="drag to scrub · Alt = opposite side · Alt+Shift = all four · ↑↓ to step"
        onPointerDown={onPointerDown}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => apply(Math.max(0, Number.parseFloat(e.target.value) || 0), [edge])}
        onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); apply(Math.max(0, (Number.parseFloat(e.currentTarget.value) || 0) + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1)), [edge]); } else if (e.key === "Enter") e.currentTarget.blur(); }} />
    );
  };
  return (
    <div className="icp-box" aria-label="margin and padding">
      <span className="icp-box-tag">margin</span>
      {cell("m", "t")}{cell("m", "r")}{cell("m", "b")}{cell("m", "l")}
      <div className="icp-box-inner">
        <span className="icp-box-tag">padding</span>
        {cell("p", "t")}{cell("p", "r")}{cell("p", "b")}{cell("p", "l")}
        <div className="icp-box-core">{size.w} × {size.h}</div>
      </div>
    </div>
  );
}

/* ── Position inset box — top/right/bottom/left, auto default, negative OK ──
 * Same whole-cell scrub as the box-model cells; center shows the position kind.*/
type Inset = { t: string; r: string; b: string; l: string };
function InsetBox({ position, inset, onInset }: { position: string; inset: Inset; onInset: (s: Inset) => void }) {
  const ref = useRef(inset); ref.current = inset;
  const cell = (edge: keyof Inset) => {
    const cur = ref.current[edge];
    const isAuto = cur === "auto" || cur === "";
    const set = (v: string) => onInset({ ...ref.current, [edge]: v });
    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const startX = e.clientX; const base = Number.parseFloat(ref.current[edge]) || 0; let scrubbing = false;
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        if (!scrubbing && Math.abs(dx) < 3) return;
        if (!scrubbing) { scrubbing = true; document.body.classList.add("icp-scrubbing"); }
        ev.preventDefault(); set(String(Math.round(base + dx)));
      };
      const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.body.classList.remove("icp-scrubbing"); };
      document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
    };
    return (
      <input className={`icp-inset-v icp-inset-v--${edge}${isAuto ? " is-auto" : ""}`} aria-label={{ t: "top", r: "right", b: "bottom", l: "left" }[edge]} value={cur} title="drag to scrub · type a number or 'auto' · negative allowed"
        onPointerDown={onPointerDown}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); set(String((Number.parseFloat(e.currentTarget.value) || 0) + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1))); } else if (e.key === "Enter") e.currentTarget.blur(); }} />
    );
  };
  return (
    <div className="icp-insetbox" aria-label="position inset (top / right / bottom / left)">
      <span className="icp-box-tag" style={{ color: "var(--accent)" }}>inset</span>
      {cell("t")}{cell("r")}{cell("b")}{cell("l")}
      <div className="icp-insetbox-core">{position}</div>
    </div>
  );
}

/* ── Token colour trigger + popover (Custom + Variables tabs) ───────────────*/
const COLOR_TOKENS = ["--accent", "--accent-hover", "--accent-muted", "--bg-1", "--bg-2", "--bg-3", "--bg-4", "--fg-0", "--fg-1", "--fg-2", "--status-success", "--status-warn", "--status-error", "--status-info", "--presence-agent"];
function useColorTokens() {
  const [toks, setToks] = useState<{ name: string; value: string }[]>([]);
  useEffect(() => { const cs = getComputedStyle(document.documentElement); setToks(COLOR_TOKENS.map((n) => ({ name: n, value: cs.getPropertyValue(n).trim() })).filter((t) => t.value)); }, []);
  return toks;
}
const pretty = (n: string) => n.replace(/^--/, "").replace(/-/g, " ");
function TokenColor({ value, tokens, label, swatchClassName = "icp-swatch2", onChange }: { value: string; tokens: { name: string; value: string }[]; label: string; swatchClassName?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"custom" | "vars">("custom");
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bound = value.startsWith("var(");
  const tokenName = bound ? value.replace(/^var\(\s*|\s*\)$/g, "") : "";
  const resolved = bound ? (tokens.find((t) => t.name === tokenName)?.value ?? "transparent") : value;
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [open]);
  const list = q ? tokens.filter((t) => pretty(t.name).includes(q) || t.value.toLowerCase().includes(q)) : tokens;
  return (
    <span className="icp-tokwrap" ref={wrapRef}>
      <button type="button" className={`${swatchClassName}${bound && swatchClassName === "icp-swatch2" ? " is-bound" : ""}`} style={{ background: resolved }} aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={bound ? tokenName : value} onClick={() => setOpen((o) => !o)} />
      {open ? (
        <div className="icp-pop" role="dialog" aria-label={label}>
          <div className="icp-poptabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "custom"} className={`icp-poptab${tab === "custom" ? " is-active" : ""}`} onClick={() => setTab("custom")}>Custom</button>
            <button type="button" role="tab" aria-selected={tab === "vars"} className={`icp-poptab${tab === "vars" ? " is-active" : ""}`} onClick={() => setTab("vars")}>Variables</button>
          </div>
          {tab === "custom" ? (
            <ColorPicker seed={cssColorToHex(resolved) || "#000000"} onApply={onChange} />
          ) : (
            <>
              <div className="icp-pop-search"><Ic as={Search} size={12} /><input value={q} onChange={(e) => setQ(e.target.value.toLowerCase())} placeholder="Search variables" aria-label="search variables" /></div>
              {list.length ? list.map((t) => (
                <button key={t.name} type="button" className={`icp-pop-row${tokenName === t.name ? " is-on" : ""}`} onClick={() => { onChange(`var(${t.name})`); setOpen(false); }}>
                  <span className="icp-pop-cswatch" style={{ background: t.value }} />
                  <span className="icp-pop-name">{pretty(t.name)}</span>
                  <span className="icp-pop-val">{t.value.length > 14 ? `${t.value.slice(0, 13)}…` : t.value}</span>
                </button>
              )) : <div style={{ padding: 8, fontSize: "var(--type-xs)", color: "var(--fg-3)" }}>No match</div>}
            </>
          )}
        </div>
      ) : null}
    </span>
  );
}
// The ONE compact colour field — swatch as a flush prefix segment (divider, no
// gap) + the value. `alpha`/`onVisible` opt into the richer fill (alpha % + eye).
// Every colour control uses this, so the swatch is consistently a flush prefix.
function ColorField({ value, tokens, label, alpha, visible, onChange, onAlpha, onVisible }: { value: string; tokens: { name: string; value: string }[]; label: string; alpha?: number; visible?: boolean; onChange: (v: string) => void; onAlpha?: (n: number) => void; onVisible?: (v: boolean) => void }) {
  const bound = value.startsWith("var(");
  const display = bound ? pretty(value.replace(/^var\(\s*|\s*\)$/g, "")) : value.replace("#", "");
  return (
    <span className="icp-cf">
      <TokenColor value={value} tokens={tokens} label={label} swatchClassName="icp-cf-sw" onChange={onChange} />
      <input className={`icp-cf-in${bound ? " is-bound" : ""}`} aria-label={`${label} value`} value={display} onChange={(e) => onChange(bound ? e.target.value : "#" + e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))} onFocus={(e) => e.currentTarget.select()} />
      {onAlpha ? <input className="icp-cf-alpha" aria-label={`${label} alpha`} value={`${alpha}`} onChange={(e) => onAlpha(clampTo(Number.parseFloat(e.target.value) || 0, 0, 100))} onFocus={(e) => e.currentTarget.select()} /> : null}
      {onVisible ? <button type="button" className={`icp-cf-eye${visible ? "" : " is-off"}`} aria-pressed={visible} aria-label={`${label} visibility`} onClick={() => onVisible(!visible)}>{visible ? <Ic as={Eye} /> : <Ic as={EyeOff} />}</button> : null}
    </span>
  );
}
// plain colour row = ColorField with no alpha/eye
function ColorRow(props: { value: string; tokens: { name: string; value: string }[]; label: string; onChange: (v: string) => void }) {
  return <ColorField {...props} />;
}

/* ── Corner-radius control — uniform field + ▢ detach → 2×2 quad (Figma) ─────
 * Research-confirmed pattern (help.figma.com / university.webflow.com): one
 * unified field + a detach toggle; individual corner fields appear below, each
 * with a per-corner glyph. ──────────────────────────────────────────────────*/
function RadiusControl({ corners, onCorners }: { corners: Record<"tl" | "tr" | "bl" | "br", number>; onCorners: (c: Record<"tl" | "tr" | "bl" | "br", number>) => void }) {
  const [split, setSplit] = useState(false);
  const setAll = (v: number) => onCorners({ tl: v, tr: v, bl: v, br: v });
  const cell = (k: "tl" | "tr" | "bl" | "br") => (
    <label className="icp-corner"><span className={`icp-cnr icp-cnr--${k}`} aria-hidden="true" /><input aria-label={`${k} radius`} value={corners[k]} onChange={(e) => onCorners({ ...corners, [k]: Number.parseFloat(e.target.value) || 0 })} onFocus={(e) => e.currentTarget.select()} /></label>
  );
  return (
    <div className="icp-radius">
      <div className="icp-pair">
        <NumberField value={corners.tl} min={0} max={200} ariaLabel="border-radius" lead={<Ic as={Spline} />} steppers={false} unitSlot={<span className="icp-num-suffix" aria-hidden="true">px</span>} onChange={(v) => (split ? onCorners({ ...corners, tl: v }) : setAll(v))} />
        <button type="button" className={`icp-splitbtn${split ? " is-on" : ""}`} aria-pressed={split} aria-label="detach corners" title="detach corners — edit each independently" onClick={() => setSplit((s) => !s)}><Ic as={SquareDashed} size={14} /></button>
      </div>
      {split ? <div className="icp-corners">{cell("tl")}{cell("tr")}{cell("bl")}{cell("br")}</div> : null}
    </div>
  );
}

/* ── Value-token binding (◇) — bind a NumberField to a space or radius var
 * (mirrors the real CssKnobs tok() quick-pick). Value is number | "var(--x)". ─*/
const SPACE_TOKENS = ["--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-7", "--space-8"];
const RADIUS_TOKENS = ["--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-pill"];
function useValueTokens(names: string[]) {
  const [toks, setToks] = useState<{ name: string; value: string }[]>([]);
  useEffect(() => { const cs = getComputedStyle(document.documentElement); setToks(names.map((n) => ({ name: n, value: cs.getPropertyValue(n).trim() })).filter((t) => t.value)); }, [names]);
  return toks;
}
function ValueTokenField({ value, tokens, ariaLabel, lead, unit, min = 0, max, step = 1, onChange }: { value: number | string; tokens: { name: string; value: string }[]; ariaLabel: string; lead?: React.ReactNode; unit?: string; min?: number; max?: number; step?: number; onChange: (v: number | string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bound = typeof value === "string" && value.startsWith("var(");
  const tokenName = bound ? (value as string).replace(/^var\(\s*|\s*\)$/g, "") : "";
  const resolved = bound ? (tokens.find((t) => t.name === tokenName)?.value ?? "") : "";
  useEffect(() => {
    if (!open) { setQ(""); return; }
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [open]);
  const list = q ? tokens.filter((t) => pretty(t.name).includes(q) || t.value.toLowerCase().includes(q)) : tokens;
  return (
    <div className="icp-tokfield">
      {bound ? (
        <div className="icp-boundchip" title={`${tokenName} = ${resolved}`}>
          {lead ? <span className="icp-boundchip-lead" aria-hidden="true">{lead}</span> : null}
          <span className="icp-boundchip-name">{pretty(tokenName)}</span>
          <button type="button" className="icp-boundchip-x" aria-label="detach token" title="detach — back to a raw value" onClick={() => onChange(Number.parseFloat(resolved) || 0)}><Ic as={X} size={12} /></button>
        </div>
      ) : (
        <NumberField value={typeof value === "number" ? value : 0} min={min} max={max} step={step} ariaLabel={ariaLabel} lead={lead} steppers={false} unitSlot={unit ? <span className="icp-num-suffix" aria-hidden="true">{unit}</span> : null} onChange={(n) => onChange(n)} />
      )}
      <span ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
        <button type="button" className={`icp-tokbtn${bound ? " is-bound" : ""}`} aria-haspopup="dialog" aria-expanded={open} aria-label={`${ariaLabel} — bind a design token`} title="bind a design token" onClick={() => setOpen((o) => !o)}><Ic as={Diamond} size={13} /></button>
        {open ? (
          <div className="icp-pop" role="dialog" aria-label="design tokens" style={{ left: "auto", right: 0 }}>
            <div className="icp-poptabs"><span className="icp-poptab is-active">Variables</span></div>
            <div className="icp-pop-search"><Ic as={Search} size={12} /><input value={q} onChange={(e) => setQ(e.target.value.toLowerCase())} placeholder="Search variables" aria-label="search variables" /></div>
            {list.length ? list.map((t) => (
              <button key={t.name} type="button" className={`icp-pop-row${tokenName === t.name ? " is-on" : ""}`} onClick={() => { onChange(`var(${t.name})`); setOpen(false); }}>
                <span className="icp-pop-name">{pretty(t.name)}</span><span className="icp-pop-val">{t.value}</span>
              </button>
            )) : <div style={{ padding: 8, fontSize: "var(--type-xs)", color: "var(--fg-3)" }}>No match</div>}
          </div>
        ) : null}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function ComponentsInspectorControls() {
  const tokens = useColorTokens();
  // number / slider
  const [fontSize, setFontSize] = useState(16);
  const [fontUnit, setFontUnit] = useState("px");
  const [gap, setGap] = useState(12);
  const [zIndex, setZIndex] = useState(0);
  const [brightness, setBrightness] = useState(0.15);
  const [contrast, setContrast] = useState(-0.2);
  const [grain, setGrain] = useState(0.4);
  const [opacity, setOpacity] = useState(100);
  // icon groups
  const [dir, setDir] = useState("row");
  const [justify, setJustify] = useState("start");
  const [textStyle, setTextStyle] = useState<Record<string, boolean>>({ b: true, i: false, u: false });
  const [textAlign, setTextAlign] = useState("left");
  const [padAlign, setPadAlign] = useState("cc");
  const [sizingMode, setSizingMode] = useState("fixed");
  const [rotation, setRotation] = useState(135);
  // box-model
  const [margin, setMargin] = useState<Sides>({ t: 0, r: 16, b: 24, l: 16 });
  const [padding, setPadding] = useState<Sides>({ t: 12, r: 20, b: 12, l: 20 });
  const [size, setSize] = useState({ w: 320, h: 180 });
  const [aspectLock, setAspectLock] = useState(true);
  // corners
  const [corners, setCorners] = useState({ tl: 7, tr: 7, bl: 7, br: 7 });
  // design-token binding demos (value tokens — space / radius)
  const radiusTokens = useValueTokens(RADIUS_TOKENS);
  const spaceTokens = useValueTokens(SPACE_TOKENS);
  const [radiusVal, setRadiusVal] = useState<number | string>("var(--radius-md)");
  const [gapTok, setGapTok] = useState<number | string>("var(--space-4)");
  // position + inset
  const [position, setPosition] = useState("relative");
  const [inset, setInset] = useState<Inset>({ t: "12", r: "auto", b: "auto", l: "24" });
  // border (complex)
  const [borderW, setBorderW] = useState(1);
  const [borderStyle, setBorderStyle] = useState("solid");
  const [borderColor, setBorderColor] = useState("var(--border-default)");
  const [bg, setBg] = useState("var(--bg-2)");
  // typography (complex)
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontWeight, setFontWeight] = useState("500");
  const [textColor, setTextColor] = useState("var(--fg-0)");
  const [lineHeight, setLineHeight] = useState(1.5);
  const [letterSpacing, setLetterSpacing] = useState(0);
  // fill / booleans
  const [fill, setFill] = useState({ hex: "#6C5CE7", alpha: 100, visible: true });
  const [blend, setBlend] = useState("normal");
  const [snapOn, setSnapOn] = useState(true);
  const [clip, setClip] = useState(false);
  const [overflow, setOverflow] = useState("hidden");
  // DDR-171 — Designer-mode vocabulary toggle demo. Deliberately reuses `dir` /
  // `gap` / `sizingMode` / `padAlign` / `padding` from the galleries above (same
  // convention this file already uses for `corners` / `radiusVal` / `fill`
  // across sections) so flipping the toggle visibly proves "two doors, one
  // state" — the value set in one vocabulary reads back correctly in the other.
  const [demoMode, setDemoMode] = useState<"advanced" | "designer">("designer");

  const resetRadius = () => setCorners({ tl: 0, tr: 0, bl: 0, br: 0 });
  const setW = (w: number) => setSize((s) => (aspectLock ? { w, h: Math.round((w * s.h) / s.w) || s.h } : { ...s, w }));
  const setH = (h: number) => setSize((s) => (aspectLock ? { w: Math.round((h * s.w) / s.h) || s.w, h } : { ...s, h }));

  const DIR_OPTS: IconOpt[] = [{ value: "row", node: <Ic as={Columns3} />, label: "Row" }, { value: "column", node: <Ic as={Rows3} />, label: "Column" }, { value: "wrap", node: <Ic as={WrapText} />, label: "Wrap" }];

  return (
    <>
      <header className="specimen-hd">
        <span className="sku">MAUDE/components-inspector-controls</span>
        <span className="crumbs"><span>maude</span><span>components</span><span>inspector controls</span></span>
        <ThemeToggle />
      </header>
      <main className="specimen">
        <section className="specimen-title">
          <h1>The whole control set — same principles as the panel.</h1>
          <p className="lede">
            One control library, two consumers — the CSS panel and the Photo panel.
            Every control here is live and follows the real inspector&apos;s rules: the
            scrub handle is the leading icon, box-model cells take Alt / Alt+Shift
            multi-side drags, each row carries a provenance dot, and colours open a
            token popover with a Variables tab. Icons are the vendored lucide geometry.
          </p>
        </section>

        <dl className="specimen-meta">
          <div><dt>Controls</dt><dd>Number · Slider · IconGroup · AlignPad · SpacingBox · Border · Typography · TokenColour</dd></div>
          <div><dt>Scrub</dt><dd>handle · 3px dead-zone · Alt = opposite · Alt+Shift = all four</dd></div>
          <div><dt>Provenance</dt><dd>token-bound · raw override · inherited</dd></div>
          <div><dt>Keyboard</dt><dd>↑↓ ±step · Shift ×10 · Home/End</dd></div>
        </dl>

        <h2 data-no>Provenance <span className="h2-aside">every row says where its value came from</span></h2>
        <p style={{ fontSize: "14px" }}>
          The leading dot on each inspector row is load-bearing, exactly like the panel:
          it tells you whether a property is bound to a token, a raw override, or just
          inherited — and a resettable dot double-clicks back to the inherited value.
        </p>
        <div className="icp-legend">
          <span className="icp-legend-item"><span className="icp-prov icp-prov--bound" /> token-bound — <code>var(--accent)</code></span>
          <span className="icp-legend-item"><span className="icp-prov icp-prov--raw" /> raw override — <code>18px</code></span>
          <span className="icp-legend-item"><span className="icp-prov icp-prov--inherit" /> inherited — from the class/cascade</span>
        </div>

        <h2 data-no>Design tokens &amp; variables <span className="h2-aside">bind any field to a DS token</span></h2>
        <p>
          The whole point of the provenance dot is what you can DO about it: click the
          <span style={{ display: "inline-grid", placeItems: "center", width: 18, height: 18, verticalAlign: "middle", margin: "0 2px", color: "var(--accent)" }}><Ic as={Diamond} size={12} /></span>
          on a number field to bind it to a spacing/radius <strong>variable</strong>, or open a
          colour swatch&apos;s <strong>Variables</strong> tab to bind a colour token. Bound
          fields turn accent and show the token name; the ✕ detaches back to a raw value.
        </p>
        <div className="icp-fld-grid">
          <Field label="Radius → variable" help="Click ◇ → pick a radius token. Bound now.">
            <ValueTokenField value={radiusVal} tokens={radiusTokens} ariaLabel="radius" lead={<Ic as={Spline} />} unit="px" max={200} onChange={setRadiusVal} />
          </Field>
          <Field label="Gap → variable" help="Space tokens (--space-*).">
            <ValueTokenField value={gapTok} tokens={spaceTokens} ariaLabel="gap" lead={<Ic as={AlignHorizontalSpaceBetween} />} unit="px" max={200} onChange={setGapTok} />
          </Field>
          <Field label="Colour → variable" help="Swatch → Variables tab binds var(--token).">
            <ColorRow value={textColor} tokens={tokens} label="text colour" onChange={setTextColor} />
          </Field>
        </div>

        <h2 data-no>Number fields <span className="h2-aside">grip / icon handle · steppers · unit · disabled</span></h2>
        <p>
          The handle carries the drag affordance — a glyph where one reads cleanly, a
          plain grip otherwise. Drag it to scrub; the input stays a normal text field
          (click to focus + select-all, arrows to step, Shift ×10).
        </p>
        <div className="icp-states">
          <Field label="Font size" help="Icon handle + unit select. Drag the glyph.">
            <NumberField value={fontSize} min={0} max={200} ariaLabel="font-size" lead={<Ic as={ALargeSmall} />} unitSlot={<select className="icp-num-unit" aria-label="unit" value={fontUnit} onChange={(e) => setFontUnit(e.target.value)}><option>px</option><option>rem</option><option>em</option><option>%</option></select>} onChange={setFontSize} />
          </Field>
          <Field label="Gap" help="Focus me and hold ↑ — Shift ×10.">
            <NumberField value={gap} min={0} max={200} ariaLabel="gap" lead={<Ic as={AlignHorizontalSpaceBetween} />} unitSlot={<span className="icp-num-suffix" aria-hidden="true">px</span>} onChange={setGap} />
          </Field>
          <Field label="Z-index" help="Plain grip handle, no unit.">
            <NumberField value={zIndex} min={-10} max={999} ariaLabel="z-index" onChange={setZIndex} />
          </Field>
          <Field label="Locked" help="Disabled — no stable element id.">
            <NumberField value={0} ariaLabel="disabled example" disabled onChange={() => {}} />
          </Field>
        </div>

        <h2 data-no>Sliders <span className="h2-aside">bipolar · unipolar · linked numeric</span></h2>
        <p>
          Bounded params get a real track — never a bare numeric pretending to be a
          slider. A bipolar range (brightness, contrast) fills from its zero-point tick;
          the linked numeric stays in sync as you drag either one.
        </p>
        <div className="icp-fld-grid">
          <Field label="Brightness" help="Bipolar −1…1 — fill grows from the center tick."><SliderField value={brightness} min={-1} max={1} step={0.01} ariaLabel="brightness" onChange={setBrightness} /></Field>
          <Field label="Contrast" help="Bipolar. Type in the box or drag the track."><SliderField value={contrast} min={-1} max={1} step={0.01} ariaLabel="contrast" onChange={setContrast} /></Field>
          <Field label="Grain amount" help="Unipolar 0…1."><SliderField value={grain} min={0} max={1} step={0.01} ariaLabel="grain amount" onChange={setGrain} /></Field>
          <Field label="Opacity" help="0…100 %, integer step."><SliderField value={opacity} min={0} max={100} step={1} unit="%" ariaLabel="opacity" onChange={setOpacity} /></Field>
        </div>

        <h2 data-no>Icon button groups <span className="h2-aside">≤5 options, icon cells</span></h2>
        <p>
          When the options have an obvious glyph (direction, distribution, text style),
          an icon segmented reads faster than a dropdown and keeps every choice visible.
          Single-choice groups use radio semantics; text styling is a multi-select.
        </p>
        <div className="icp-row">
          <Field label="Direction"><IconButtonGroup value={dir} ariaLabel="flex direction" onChange={setDir} options={DIR_OPTS} /></Field>
          <Field label="Distribute"><IconButtonGroup value={justify} ariaLabel="justify content" onChange={setJustify} options={[{ value: "start", node: <Ic as={AlignHorizontalJustifyStart} />, label: "Start" }, { value: "center", node: <Ic as={AlignHorizontalJustifyCenter} />, label: "Center" }, { value: "end", node: <Ic as={AlignHorizontalJustifyEnd} />, label: "End" }, { value: "between", node: <Ic as={AlignHorizontalSpaceBetween} />, label: "Space between" }]} /></Field>
          <Field label="Text style"><IconToggleGroup value={textStyle} ariaLabel="text style" onToggle={(k) => setTextStyle((s) => ({ ...s, [k]: !s[k] }))} options={[{ value: "b", node: <Ic as={Bold} />, label: "Bold" }, { value: "i", node: <Ic as={Italic} />, label: "Italic" }, { value: "u", node: <Ic as={Underline} />, label: "Underline" }]} /></Field>
          <Field label="Text align"><IconButtonGroup value={textAlign} ariaLabel="text align" onChange={setTextAlign} options={[{ value: "left", node: <Ic as={AlignLeft} />, label: "Left" }, { value: "center", node: <Ic as={AlignCenter} />, label: "Center" }, { value: "right", node: <Ic as={AlignRight} />, label: "Right" }, { value: "justify", node: <Ic as={AlignJustify} />, label: "Justify" }]} /></Field>
        </div>

        <h2 data-no>Alignment pad · sizing · rotation <span className="h2-aside">9-point auto-layout · Fixed/Hug/Fill · dial</span></h2>
        <p>Auto-layout alignment is a 3×3 pad — one click sets both axes at once. Per-axis sizing is a segmented Fixed / Hug / Fill, and rotation pairs a draggable dial with the exact numeric.</p>
        <div className="icp-row">
          <Field label="Align content" help={`current: ${padAlign}`}><AlignPad value={padAlign} onChange={setPadAlign} /></Field>
          <Field label="Width sizing"><div className="seg" role="radiogroup" aria-label="width sizing mode">{["fixed", "hug", "fill"].map((m) => <button key={m} type="button" role="radio" aria-checked={sizingMode === m} onClick={() => setSizingMode(m)}>{m}</button>)}</div></Field>
          <Field label="Rotation" help="Drag the dial or scrub the field."><div className="icp-pair"><AngleDial value={rotation} onChange={setRotation} /><NumberField value={rotation} min={0} max={360} ariaLabel="rotation" lead={<Ic as={RotateCw} />} steppers={false} unitSlot={<span className="icp-num-suffix" aria-hidden="true">°</span>} onChange={(n) => setRotation(((n % 360) + 360) % 360)} /></div></Field>
        </div>

        <h2 data-no>Box model — spacing <span className="h2-aside">Alt = opposite side · Alt+Shift = all four</span></h2>
        <p>
          The margin/padding diagram is the densest control in the panel: eight scrub
          cells around a nested box. It carries the real modifier grammar — plain drag
          moves one side, <strong>Alt</strong> moves the opposite side with it,
          <strong> Alt+Shift</strong> moves all four at once.
        </p>
        <div className="icp-row">
          <SpacingBox margin={margin} padding={padding} size={size} onMargin={setMargin} onPadding={setPadding} />
          <Field label="Size" help="Aspect lock keeps the ratio when you edit W or H.">
            <div className="icp-pair">
              <NumberField value={size.w} min={0} max={4096} ariaLabel="width" lead="W" steppers={false} onChange={setW} />
              <button type="button" className={`icp-link${aspectLock ? " is-on" : ""}`} aria-pressed={aspectLock} aria-label="lock aspect ratio" title="lock aspect ratio" onClick={() => setAspectLock((v) => !v)}>{aspectLock ? <Ic as={Link} /> : <Ic as={Unlink} />}</button>
              <NumberField value={size.h} min={0} max={4096} ariaLabel="height" lead="H" steppers={false} onChange={setH} />
            </div>
          </Field>
        </div>

        <h2 data-no>Position <span className="h2-aside">position kind + the inset box (top/right/bottom/left)</span></h2>
        <p>
          Position mirrors the spacing box: the four inset cells scrub just like margin
          and padding, but they accept <strong>negative</strong> values and <strong>auto</strong>,
          and the center shows the current position kind. They only take effect once the
          position isn&apos;t <code>static</code>.
        </p>
        <div className="icp-row">
          <Field label="Position"><Select value={position} options={["static", "relative", "absolute", "fixed", "sticky"]} ariaLabel="position" minWidth={132} onChange={setPosition} /></Field>
          <div style={{ flex: "1 1 260px", minWidth: 0, maxWidth: 300 }}>
            <InsetBox position={position} inset={inset} onInset={setInset} />
            {position === "static" ? <p className="icp-note">top / right / bottom / left apply once position is relative, absolute, fixed, or sticky</p> : null}
          </div>
        </div>

        <h2 data-no>Corner radius <span className="h2-aside">uniform · ▢ detaches into an independent quad</span></h2>
        <p>
          One radius by default; the <span style={{ display: "inline-grid", placeItems: "center", width: 18, height: 18, verticalAlign: "middle", margin: "0 2px" }}><Ic as={Square} size={12} /></span>
          button <strong>detaches</strong> the corners — the independent quad appears below, and now
          each corner edits on its own. Uniform, one field drives all four.
        </p>
        <div className="icp-row">
          <Field label="Radius" help="▢ detaches — the 4 corner fields appear below.">
            <RadiusControl corners={corners} onCorners={setCorners} />
          </Field>
        </div>

        <h2 data-no>Border <span className="h2-aside">a complex section — composite row + token colours</span></h2>
        <p>
          A real panel section: background and border-colour open the token popover
          (try the <strong>Variables</strong> tab), and border packs width + style +
          colour into one priority-shrink row that wraps rather than overflows.
        </p>
        <div className="panel icp-panel">
          <div className="panel-hd">Appearance<span className="hd-meta">Frame · Pricing</span></div>
          <div className="panel-bd" style={{ padding: 0 }}>
            <PanelSection title="Fill & Border" onReset={() => { setBg("var(--bg-2)"); setBorderColor("var(--border-default)"); setBorderW(1); setBorderStyle("solid"); }}>
              <InRow prov={bg.startsWith("var(") ? "bound" : "raw"} label="background" onReset={() => setBg("var(--bg-2)")}><ColorRow value={bg} tokens={tokens} label="background colour" onChange={setBg} /></InRow>
              <InRow prov={borderColor.startsWith("var(") ? "bound" : "raw"} label="border" onReset={() => setBorderColor("var(--border-default)")}>
                <div className="icp-border">
                  <NumberField value={borderW} min={0} max={20} ariaLabel="border-width" scrub steppers={false} onChange={setBorderW} />
                  <Select value={borderStyle} options={["solid", "dashed", "dotted", "double", "none"]} ariaLabel="border-style" minWidth={0} onChange={setBorderStyle} />
                  <TokenColor value={borderColor} tokens={tokens} label="border colour" onChange={setBorderColor} />
                </div>
              </InRow>
              <InRow prov="raw" label="radius" onReset={resetRadius}><RadiusControl corners={corners} onCorners={setCorners} /></InRow>
              <InRow prov="inherit" label="box-shadow"><Select value="none" options={["none", "sm", "md", "lg"]} ariaLabel="box-shadow" minWidth={0} onChange={() => {}} /></InRow>
            </PanelSection>
          </div>
        </div>

        <h2 data-no>Typography <span className="h2-aside">a complex section — the full text row stack</span></h2>
        <p style={{ fontWeight: "400" , color: "var(--fg-0)" }}>
          The typography stack shows the provenance dots doing real work: colour is
          token-bound (accent dot), size is a raw override, line-height is inherited
          (dimmed row). Text align is an icon group; style is a multi-toggle.
        </p>
        <div className="panel icp-panel">
          <div className="panel-hd">Text<span className="hd-meta">Frame · Pricing</span></div>
          <div className="panel-bd" style={{ padding: 0 }}>
            <PanelSection title="Type" onReset={() => { setFontWeight("400"); setTextColor("var(--fg-0)"); setFontSize(16); setLetterSpacing(0); setTextAlign("left"); }}>
              <InRow prov="inherit" label="font-family"><Select value={fontFamily} options={["Inter", "Inter Tight", "JetBrains Mono", "system-ui", "Georgia"]} ariaLabel="font-family" minWidth={0} onChange={setFontFamily} /></InRow>
              <InRow prov="raw" label="weight" onReset={() => setFontWeight("400")}><Select value={fontWeight} options={["300", "400", "500", "600", "700"]} ariaLabel="font-weight" minWidth={0} onChange={setFontWeight} /></InRow>
              <InRow prov={textColor.startsWith("var(") ? "bound" : "raw"} label="color" onReset={() => setTextColor("var(--fg-0)")}><ColorRow value={textColor} tokens={tokens} label="text colour" onChange={setTextColor} /></InRow>
              <InRow prov="raw" label="font-size" onReset={() => setFontSize(16)}><NumberField value={fontSize} min={0} max={200} ariaLabel="text font-size" lead={<Ic as={ALargeSmall} />} unitSlot={<span className="icp-num-suffix" aria-hidden="true">px</span>} onChange={setFontSize} /></InRow>
              <InRow prov="inherit" label="line-height"><NumberField value={lineHeight} min={0} max={3} step={0.1} ariaLabel="line-height" lead={<Ic as={Baseline} />} steppers onChange={setLineHeight} /></InRow>
              <InRow prov="raw" label="letter-spacing" onReset={() => setLetterSpacing(0)}><NumberField value={letterSpacing} min={-5} max={20} step={0.1} ariaLabel="letter-spacing" lead={<Ic as={MoveHorizontal} />} unitSlot={<span className="icp-num-suffix" aria-hidden="true">px</span>} onChange={setLetterSpacing} /></InRow>
              <InRow prov="raw" label="align" onReset={() => setTextAlign("left")}><IconButtonGroup value={textAlign} ariaLabel="text-align" onChange={setTextAlign} options={[{ value: "left", node: <Ic as={AlignLeft} />, label: "Left" }, { value: "center", node: <Ic as={AlignCenter} />, label: "Center" }, { value: "right", node: <Ic as={AlignRight} />, label: "Right" }, { value: "justify", node: <Ic as={AlignJustify} />, label: "Justify" }]} /></InRow>
              <InRow prov="raw" label="style"><IconToggleGroup value={textStyle} ariaLabel="font-style" onToggle={(k) => setTextStyle((s) => ({ ...s, [k]: !s[k] }))} options={[{ value: "b", node: <Ic as={Bold} />, label: "Bold" }, { value: "i", node: <Ic as={Italic} />, label: "Italic" }, { value: "u", node: <Ic as={Underline} />, label: "Underline" }]} /></InRow>
            </PanelSection>
          </div>
        </div>

        <h2 data-no>Colour, enums &amp; booleans <span className="h2-aside">fill row · select · toggle · checkbox · overflow group</span></h2>
        <p>
          Colour is a composite: swatch chip → token popover, hex, an alpha %, and a
          visibility eye. Immediate-effect booleans get a toggle; a batch choice a
          checkbox; a small exclusive enum like overflow reads best as a button group.
        </p>
        <div className="icp-row">
          <Field label="Fill" help="Swatch → popover · hex · alpha · visibility.">
            <ColorField value={fill.hex} tokens={tokens} label="fill colour" alpha={fill.alpha} visible={fill.visible} onChange={(v) => setFill((f) => ({ ...f, hex: v }))} onAlpha={(a) => setFill((f) => ({ ...f, alpha: a }))} onVisible={(v) => setFill((f) => ({ ...f, visible: v }))} />
          </Field>
          <Field label="Blend mode"><Select value={blend} options={["normal", "multiply", "screen", "overlay", "soft-light"]} ariaLabel="blend mode" minWidth={128} onChange={setBlend} /></Field>
        </div>
        <div className="icp-row">
          <Field label="Snap to grid" help="Immediate effect → switch."><span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}><input className="switch" type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} aria-label="snap to grid" /><span style={{ fontSize: "var(--type-xs)", color: "var(--fg-2)" }}>{snapOn ? "on" : "off"}</span></span></Field>
          <Field label="Clip content" help="Batch/form choice → checkbox."><Checkbox checked={clip} label={<span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--type-xs)", color: "var(--fg-1)" }}>overflow: hidden</span>} onChange={setClip} /></Field>
          <Field label="Overflow" help="Exclusive small set → button group.">
            <IconButtonGroup value={overflow} ariaLabel="overflow" onChange={setOverflow} options={[{ value: "visible", node: <Ic as={Eye} />, label: "Visible" }, { value: "hidden", node: <Ic as={Scissors} />, label: "Hidden" }, { value: "scroll", node: <Ic as={ScrollText} />, label: "Scroll" }]} />
          </Field>
        </div>

        <h2 data-no>The panel, assembled <span className="h2-aside">the same primitives, in place</span></h2>
        <p>This is the real anatomy — provenance dots, a label column, a control column, sliders paired with numerics, and a fill row that fits the panel width. Everything is live and reads the same state as the galleries above.</p>
        <div className="panel icp-panel">
          <div className="panel-hd">Frame<span className="hd-meta">Pricing · v3</span></div>
          <div className="panel-bd" style={{ padding: 0 }}>
            <PanelSection title="Layout" onReset={() => { setDir("row"); setGap(0); }}>
              <InRow prov="raw" label="direction"><IconButtonGroup value={dir} ariaLabel="frame direction" onChange={setDir} options={DIR_OPTS} /></InRow>
              <InRow prov="raw" label="gap" onReset={() => setGap(0)}><NumberField value={gap} min={0} max={200} ariaLabel="frame gap" lead={<Ic as={AlignHorizontalSpaceBetween} />} unitSlot={<span className="icp-num-suffix" aria-hidden="true">px</span>} onChange={setGap} /></InRow>
            </PanelSection>
            <PanelSection title="Appearance" onReset={() => { setOpacity(100); setRadiusVal("var(--radius-md)"); setFill((f) => ({ ...f, hex: "#6C5CE7" })); }}>
              <InRow prov="raw" label="opacity" onReset={() => setOpacity(100)}><SliderField value={opacity} min={0} max={100} step={1} unit="%" ariaLabel="frame opacity" onChange={setOpacity} /></InRow>
              <InRow prov={typeof radiusVal === "string" ? "bound" : "raw"} label="radius" onReset={() => setRadiusVal(7)}><ValueTokenField value={radiusVal} tokens={radiusTokens} ariaLabel="frame radius" lead={<Ic as={Spline} />} unit="px" max={200} onChange={setRadiusVal} /></InRow>
              <InRow prov={fill.hex.startsWith("var(") ? "bound" : "raw"} label="fill" onReset={() => setFill((f) => ({ ...f, hex: "#6C5CE7" }))}>
                <ColorField value={fill.hex} tokens={tokens} label="frame fill" alpha={fill.alpha} onChange={(v) => setFill((f) => ({ ...f, hex: v }))} onAlpha={(a) => setFill((f) => ({ ...f, alpha: a }))} />
              </InRow>
            </PanelSection>
          </div>
        </div>

        <h2 data-no>Designer mode <span className="h2-aside">DDR-171 — a second vocabulary, same state, same write path</span></h2>
        <p>
          Advanced keeps the honest CSS property names DDR-104 chose; Designer regroups
          the same controls into Figma-familiar clusters (Auto layout pulls from Layout
          + Size) and relabels the rows — same <code>row()</code> / <code>commit()</code>{" "}
          closures underneath, so a value set in one mode reads back correctly in the
          other. The toggle lives in the panel&apos;s own corner (not a full-width row —
          that read as too heavy) — try it, the state doesn&apos;t reset.
        </p>
        <div className={"panel icp-panel" + (demoMode === "designer" ? " is-designer" : "")}>
          <div className="panel-hd">
            Frame
            <span className="hd-meta">{demoMode === "advanced" ? "CSS property names" : "Figma vocabulary"}</span>
            <span className="icp-idmode">
              <IconButtonGroup
                value={demoMode}
                ariaLabel="panel vocabulary mode"
                onChange={(v) => setDemoMode(v as "advanced" | "designer")}
                options={[
                  { value: "advanced", node: <Ic as={Braces} size={12} />, label: "Advanced — raw CSS" },
                  { value: "designer", node: <Ic as={Wand2} size={12} />, label: "Designer — Figma vocabulary" },
                ]}
              />
            </span>
          </div>
          <div className="panel-bd" style={{ padding: 0 }}>
            {/* Same underlying state + the SAME provenance per row across both
                vocabularies — only `gap` is a real override here (the rest
                inherit). Advanced shows every dot (the "punch-card" rail);
                Designer hides the inherited ones (`.icp-prov--inherit` →
                visibility:hidden under `.is-designer`), so only the genuinely-
                customized row keeps a marker — Figma-clean, but still honest. */}
            <PanelSection title={demoMode === "advanced" ? "Layout" : "Auto layout"} onReset={() => { setDir("row"); setGap(0); setPadAlign("cc"); }}>
              {demoMode === "advanced" ? (
                <>
                  <InRow prov="inherit" label="display"><Select value="flex" options={["block", "flex", "grid"]} ariaLabel="display" minWidth={0} onChange={() => {}} /></InRow>
                  <InRow prov="inherit" label="flex-direction"><IconButtonGroup value={dir} ariaLabel="flex-direction" onChange={setDir} options={DIR_OPTS.slice(0, 2)} /></InRow>
                  <InRow prov="inherit" label="align-items / justify-content"><AlignPad value={padAlign} onChange={setPadAlign} /></InRow>
                  <InRow prov="raw" label="gap" onReset={() => setGap(0)}><NumberField value={gap} min={0} max={200} ariaLabel="gap" lead={<Ic as={AlignHorizontalSpaceBetween} />} unitSlot={<span className="icp-num-suffix" aria-hidden="true">px</span>} onChange={setGap} /></InRow>
                </>
              ) : (
                <>
                  <InRow prov="inherit" label="Direction"><IconButtonGroup value={dir} ariaLabel="Direction" onChange={setDir} options={DIR_OPTS.slice(0, 2)} /></InRow>
                  <InRow prov="inherit" label="Alignment"><AlignPad value={padAlign} onChange={setPadAlign} /></InRow>
                  <InRow prov="raw" label="Gap" onReset={() => setGap(0)}><NumberField value={gap} min={0} max={200} ariaLabel="Gap" lead={<Ic as={AlignHorizontalSpaceBetween} />} unitSlot={<span className="icp-num-suffix" aria-hidden="true">px</span>} onChange={setGap} /></InRow>
                  <InRow prov="inherit" label="Sizing mode"><div className="seg" role="radiogroup" aria-label="width sizing mode">{["fixed", "hug", "fill"].map((m) => <button key={m} type="button" role="radio" aria-checked={sizingMode === m} onClick={() => setSizingMode(m)}>{m}</button>)}</div></InRow>
                  <InRow prov="inherit" label="Padding"><NumberField value={padding.t} min={0} max={200} ariaLabel="Padding" lead="P" steppers={false} unitSlot={<span className="icp-num-suffix" aria-hidden="true">px</span>} onChange={(n) => setPadding((s) => ({ ...s, t: n, r: n, b: n, l: n }))} /></InRow>
                </>
              )}
            </PanelSection>
          </div>
        </div>
        <p className="icp-note">
          Same underlying <code>dir</code> / <code>padAlign</code> / <code>gap</code> state, same
          per-row provenance — only <code>gap</code> is a real override. <strong>Advanced</strong>{" "}
          shows a status dot on every row (the developer surface — provenance is the point);{" "}
          <strong>Designer</strong> hides the inherited dots and keeps only the customized one, drops
          the mono uppercase headers for quiet title-case, and softens the labels — the same
          Figma-clean regroup the real panel applies under <code>.st-cp--designer</code>.
        </p>

        <h2 data-no>Why the handle, not the body <span className="h2-aside">the interaction-model rule</span></h2>
        <p>
          Attaching scrub to the input itself (the pre-redesign bug) means the browser
          can&apos;t tell a click-to-edit from a 1px drag — the field gets <code>cursor:
          ew-resize</code> and click-to-type quietly breaks. Moving the drag surface to
          the handle, with a 3px dead-zone before it engages, means the input stays a
          normal text field: click focuses and select-alls, drag-from-the-handle scrubs.
          Try it — click any number to retype, drag its grip to scrub.
        </p>

        <footer className="specimen-ft">
          <span>MAUDE/components-inspector-controls</span>
          <span>handle scrubs · provenance dots · token popover · every control live</span>
        </footer>
      </main>
    </>
  );
}
