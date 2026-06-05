import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";

/**
 * maude-v2 · Variant A — "Swiss Precision / Zen Instrument"
 * A 1am pinboard. Generated blind (no maude-new reference).
 *
 * Palette (OKLCH, self-contained — no DS tokens):
 *   paper-0  oklch(0.962 0.008 78)   warm kraft base
 *   paper-1  oklch(0.918 0.012 78)   raised card
 *   ink-0    oklch(0.205 0.012 70)   near-black graphite ink
 *   ink-1    oklch(0.405 0.010 75)   secondary ink
 *   ink-2    oklch(0.585 0.008 78)   tertiary / hairline
 *   accent   oklch(0.628 0.196 41)   calibrated instrument signal (orange-red, hue 41°)
 *
 * One accent only. Hue 41° = a calibrated-instrument warm — the "fader at unity",
 * the OP-1 encoder cap, the printer's registration mark. Deliberately NOT SaaS blue.
 */

// ── shared raw values (string literals, no token indirection) ──────────────
const PAPER0 = "oklch(0.962 0.008 78)";
const PAPER1 = "oklch(0.918 0.012 78)";
const PAPER_HI = "oklch(0.985 0.006 80)";
const INK0 = "oklch(0.205 0.012 70)";
const INK1 = "oklch(0.405 0.010 75)";
const INK2 = "oklch(0.585 0.008 78)";
const HAIR = "oklch(0.585 0.008 78 / 0.45)";
const ACCENT = "oklch(0.628 0.196 41)";
const ACCENT_DIM = "oklch(0.628 0.196 41 / 0.18)";

const SANS = '"Helvetica Neue", "Inter", system-ui, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

// paper grain — feTurbulence baked to a data-URI, sits behind everything at .04
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// ── tiny scrap helpers ─────────────────────────────────────────────────────
type Scrap = React.CSSProperties;

function Pin({ color = ACCENT, x = "50%", y = -7 }: { color?: string; x?: string | number; y?: number }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translateX(-50%)",
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 32%, #fff, ${color} 58%, ${INK0})`,
        boxShadow: "1px 2px 3px rgba(0,0,0,.45), inset -1px -1px 2px rgba(0,0,0,.3)",
        zIndex: 30,
      }}
    />
  );
}

function Washi({
  rot = -8,
  color = "210 180 120",
  w = 74,
  left = "50%",
  top = -11,
}: {
  rot?: number;
  color?: string;
  w?: number;
  left?: string | number;
  top?: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left,
        top,
        transform: `translateX(-50%) rotate(${rot}deg)`,
        width: w,
        height: 26,
        background: `rgba(${color},.55)`,
        boxShadow: "0 1px 2px rgba(0,0,0,.15)",
        // frayed ends
        clipPath:
          "polygon(0 8%, 6% 0, 14% 9%, 22% 1%, 100% 4%, 96% 96%, 88% 88%, 78% 99%, 60% 91%, 40% 100%, 20% 90%, 4% 99%)",
        zIndex: 28,
      }}
    />
  );
}

export default function MaudeV2VariantA() {
  return (
    <DesignCanvas>
      <DCSection id="moodboard" title="maude-v2 · Variant A — Swiss Precision / Zen Instrument">
        <DCArtboard
          id="board"
          label="A · Swiss Precision / Zen Instrument"
          width={1480}
          height={1180}
        >
          {/* ===================== COLLAGE PARENT ===================== */}
          <div
            style={{
              position: "relative",
              width: 1480,
              height: 1180,
              overflow: "hidden",
              background: `radial-gradient(120% 90% at 30% 10%, ${PAPER_HI}, ${PAPER0} 55%, ${PAPER1} 100%)`,
              fontFamily: SANS,
              color: INK0,
            }}
          >
            {/* paper grain layer (behind everything, very low contrast) */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: GRAIN,
                backgroundSize: "180px 180px",
                opacity: 0.045,
                mixBlendMode: "multiply",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
            {/* soft inner vignette */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                boxShadow: "inset 0 0 120px rgba(0,0,0,.15)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
            {/* faint baseline rule ghost in the deep background (the "grid is always there") */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 23px, ${INK2} 23px, ${INK2} 24px)`,
                opacity: 0.05,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            {/* ============================================================
                1. SIGNATURE-TREATMENT HERO — the tool panel / artboard frame
                   big focal scrap, taped down, top-left-of-center
               ============================================================ */}
            <figure
              style={{
                position: "absolute",
                top: 96,
                left: 472,
                width: 560,
                margin: 0,
                transform: "rotate(-1.4deg)",
                background: PAPER_HI,
                border: `1px solid ${HAIR}`,
                boxShadow: "3px 10px 24px rgba(0,0,0,.22)",
                zIndex: 12,
              }}
            >
              <Washi rot={6} color="190 90 60" w={120} left="22%" top={-12} />
              <Washi rot={-7} color="190 90 60" w={120} left="80%" top={-12} />

              {/* instrument title bar — recessive chrome */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 14px",
                  borderBottom: `1px solid ${HAIR}`,
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: INK1,
                }}
              >
                <span style={{ display: "flex", gap: 7, alignItems: "center" }}>
                  <span
                    style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 0 3px ${ACCENT_DIM}` }}
                  />
                  artboard · checkout-flow
                </span>
                <span style={{ color: INK2 }}>1480 × 1180</span>
              </div>

              {/* the canvas frame — chrome recedes, canvas is the hero */}
              <div style={{ position: "relative", padding: 22, background: PAPER0 }}>
                {/* visible baseline grid INSIDE the frame */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 22,
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 15px, ${HAIR} 15px 16px), repeating-linear-gradient(to right, transparent 0 47px, ${HAIR} 47px 48px)`,
                    opacity: 0.5,
                  }}
                />
                {/* corner crop marks (instrument craft) */}
                {[
                  [10, 10, "0deg"],
                  [10, "calc(100% - 10px)", "90deg"],
                  ["calc(100% - 10px)", 10, "270deg"],
                  ["calc(100% - 10px)", "calc(100% - 10px)", "180deg"],
                ].map(([t, l, r], i) => (
                  <svg
                    key={i}
                    width="16"
                    height="16"
                    style={{ position: "absolute", top: t as number, left: l as number, transform: `rotate(${r})` }}
                  >
                    <path d="M0 0 H10 M0 0 V10" stroke={ACCENT} strokeWidth="1.5" fill="none" />
                  </svg>
                ))}

                {/* mock UI living on the canvas — quiet, structural */}
                <div style={{ position: "relative", padding: "4px 6px" }}>
                  <div style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-.02em", lineHeight: "30px" }}>
                    Dokončit objednávku
                  </div>
                  <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 10, color: INK2, letterSpacing: ".1em" }}>
                    FIELD ·   PAYMENT METHOD
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      height: 38,
                      border: `1px solid ${INK2}`,
                      borderRadius: 4,
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      paddingInline: 12,
                      fontSize: 14,
                      color: INK1,
                    }}
                  >
                    •••• •••• •••• 4291
                  </div>
                  {/* accent-in-context primary button (the one place colour earns its keep) */}
                  <button
                    style={{
                      marginTop: 16,
                      height: 40,
                      paddingInline: 20,
                      border: "none",
                      borderRadius: 4,
                      background: ACCENT,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: ".01em",
                      boxShadow: `0 1px 0 ${INK0}, 0 6px 14px ${ACCENT_DIM}`,
                      cursor: "pointer",
                    }}
                  >
                    Zaplatit 1 248 Kč
                  </button>
                </div>
                {/* live coordinate readout — the "instrument" tell */}
                <div
                  style={{
                    position: "absolute",
                    right: 28,
                    bottom: 26,
                    fontFamily: MONO,
                    fontSize: 10,
                    color: ACCENT,
                    letterSpacing: ".08em",
                  }}
                >
                  x 248&nbsp;&nbsp;y 96&nbsp;&nbsp;w 312
                </div>
              </div>
              <figcaption
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: INK2,
                  padding: "7px 14px 9px",
                  borderTop: `1px solid ${HAIR}`,
                }}
              >
                signature · baseline-grid + hairline + instrument readout · chrome recedes
              </figcaption>
            </figure>

            {/* ============================================================
                2. TYPE SPECIMEN — ripped fragment, taped, left column
               ============================================================ */}
            <div
              style={{
                position: "absolute",
                top: 138,
                left: 58,
                width: 372,
                background: PAPER_HI,
                padding: "26px 24px 30px",
                transform: "rotate(2.6deg)",
                boxShadow: "2px 7px 16px rgba(0,0,0,.2)",
                clipPath:
                  "polygon(0 2%, 18% 0, 41% 3%, 63% 0, 84% 2%, 100% 0, 100% 96%, 79% 100%, 55% 97%, 33% 100%, 11% 97%, 0 100%)",
                zIndex: 9,
              }}
            >
              <Pin x="50%" y={-6} />
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", color: INK2, marginBottom: 14 }}>
                TYPE · NEUE HAAS GROTESK / SÖHNE
              </div>
              <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-.03em", lineHeight: "0.96" }}>
                Aa Gg Řž
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-.015em", marginTop: 12, lineHeight: 1.05 }}>
                Klid je funkce, ne dekorace.
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: INK1, marginTop: 12, marginBottom: 0 }}>
                Neo-groteskní rytmus drží sazbu na baseline mřížce. Tělo textu čte tiše, displej
                řeže ostře — žádný šum, jen struktura.
              </p>
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: `1px solid ${HAIR}`,
                  fontFamily: MONO,
                  fontSize: 12,
                  color: INK0,
                  letterSpacing: ".02em",
                }}
              >
                mono · Söhne Mono / Berkeley Mono
                <br />
                <span style={{ color: ACCENT }}>x 248</span>&nbsp; y 96&nbsp; Δ 1.5px&nbsp; 100%
              </div>
            </div>

            {/* ============================================================
                4. VOICE SAMPLE — index card, taped, lower-left
               ============================================================ */}
            <div
              style={{
                position: "absolute",
                top: 712,
                left: 96,
                width: 348,
                background: "#fffdf6",
                padding: "20px 22px 22px",
                transform: "rotate(-3.4deg)",
                boxShadow: "2px 8px 18px rgba(0,0,0,.22)",
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 27px, ${HAIR} 27px 28px)`,
                zIndex: 11,
              }}
            >
              <Washi rot={9} color="190 90 60" w={108} left="34%" top={-12} />
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", color: INK2, marginBottom: 8 }}>
                VOICE · ZEN / INSTRUMENT
              </div>
              <p style={{ fontSize: 16, lineHeight: "28px", margin: 0, color: INK0, letterSpacing: "-.005em" }}>
                „Plátno je hrdina. Mřížka drží každý artboard, agent navrhuje, ty rozhoduješ.
                Iterace je tichá — handoff přesný na pixel.“
              </p>
              <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, marginTop: 12 }}>
                — canvas · artboard · mockup · iterace · agent · handoff
              </div>
            </div>

            {/* ============================================================
                5a. REFERENCE — Müller-Brockmann (big-ish, image w/ fallback)
               ============================================================ */}
            <RefScrap
              top={86}
              left={1086}
              w={304}
              rot={-3.2}
              z={8}
              img="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Beethoven_Poster_M%C3%BCller-Brockmann.jpg/320px-Beethoven_Poster_M%C3%BCller-Brockmann.jpg"
              tape={{ rot: 7, color: "210 180 120" }}
              name="Josef Müller-Brockmann"
              why="Swiss grid as moral position — rhythm, not ornament. The mřížka under every artboard."
              url="moelsandco.com/.../josef-muller-brockmann"
              query="josef müller-brockmann grid systems poster"
              swatch={INK0}
              fallbackKind="grid"
            />

            {/* ============================================================
                5b. REFERENCE — Teenage Engineering OP-1 (focal-ish ref, polaroid)
               ============================================================ */}
            <RefScrap
              top={486}
              left={1064}
              w={326}
              rot={3.4}
              z={14}
              polaroid
              img="https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/The_OP-1_by_Teenage_Engineering.jpg/360px-The_OP-1_by_Teenage_Engineering.jpg"
              pin={{ color: ACCENT }}
              name="Teenage Engineering · OP-1"
              why="Precision-instrument feel. Few controls, each calibrated. The warm signal cap = our accent."
              url="teenage.engineering/products/op-1"
              query="teenage engineering OP-1 industrial design"
              swatch={ACCENT}
              fallbackKind="encoder"
            />

            {/* ============================================================
                5c. REFERENCE — Dieter Rams / Braun (medium, taped)
               ============================================================ */}
            <RefScrap
              top={862}
              left={1058}
              w={306}
              rot={-4.6}
              z={10}
              img="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Braun_T3_Pocket_Radio.jpg/300px-Braun_T3_Pocket_Radio.jpg"
              tape={{ rot: -9, color: "190 90 60" }}
              name="Dieter Rams · Braun"
              why="„Weniger, aber besser.“ As little design as possible — chrome must not outshout the work."
              url="designmuseum.org/.../ten-principles"
              query="dieter rams braun ten principles good design"
              swatch={INK1}
              fallbackKind="rams"
            />

            {/* ============================================================
                5d. REFERENCE — iA Writer (small, pin)
               ============================================================ */}
            <RefScrap
              top={508}
              left={58}
              w={252}
              rot={4.1}
              z={7}
              img="https://ia.net/wp-content/uploads/2020/01/writer-hero.png"
              pin={{ color: INK0 }}
              name="iA Writer"
              why="Zen focus. The interface disappears so the content is the only thing in the room."
              url="ia.net/writer"
              query="iA Writer zen focus typography"
              swatch={INK2}
              fallbackKind="focus"
            />

            {/* ============================================================
                5e. REFERENCE — Vercel Geist (small tag, taped)
               ============================================================ */}
            <RefScrap
              top={742}
              left={486}
              w={236}
              rot={-2.2}
              z={6}
              img="https://assets.vercel.com/image/upload/v1689795055/front/design/geist-og.png"
              tape={{ rot: 8, color: "210 180 120" }}
              name="Vercel · Geist"
              why="Aggressive reduction. Few decisions, each absolute. Mono for technical labels."
              url="vercel.com/geist"
              query="vercel geist design system hairline"
              swatch={INK0}
              fallbackKind="mono"
            />

            {/* ============================================================
                5f. REFERENCE — Linear (tiny tag scrap, no image, pure CSS)
               ============================================================ */}
            <div
              style={{
                position: "absolute",
                top: 980,
                left: 470,
                width: 226,
                background: PAPER_HI,
                padding: "12px 14px 14px",
                transform: "rotate(3.8deg)",
                boxShadow: "1px 5px 12px rgba(0,0,0,.2)",
                border: `1px solid ${HAIR}`,
                zIndex: 7,
              }}
            >
              <Pin color={ACCENT} x="84%" y={-6} />
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: INK2 }}>REF · UI CRAFT</div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.01em", marginTop: 4 }}>Linear</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.4, color: INK1, marginTop: 4 }}>
                Keyboard-first, hairline density. Tool for pros — earns calm by being fast.
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: INK2, marginTop: 7 }}>q: linear app interface craft</div>
            </div>

            {/* ============================================================
                5g. REFERENCE — Things 3 (tiny tag, no image)
               ============================================================ */}
            <div
              style={{
                position: "absolute",
                top: 372,
                left: 372,
                width: 198,
                background: "#fffdf6",
                padding: "11px 13px 13px",
                transform: "rotate(-5.3deg)",
                boxShadow: "1px 4px 11px rgba(0,0,0,.18)",
                clipPath: "polygon(0 0, 100% 3%, 98% 100%, 2% 96%)",
                zIndex: 13,
              }}
            >
              <Washi rot={11} color="210 180 120" w={84} left="60%" top={-10} />
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", color: INK2 }}>REF · CALM CRAFT</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>Things 3</div>
              <div style={{ fontSize: 11, lineHeight: 1.38, color: INK1, marginTop: 3 }}>
                Generous whitespace, quiet typography — restraint as a feature.
              </div>
            </div>

            {/* ============================================================
                5h. REFERENCE — Karl Gerstner (tiny torn type frag)
               ============================================================ */}
            <div
              style={{
                position: "absolute",
                top: 632,
                left: 706,
                width: 214,
                background: PAPER_HI,
                padding: "12px 14px",
                transform: "rotate(2.9deg)",
                boxShadow: "1px 5px 12px rgba(0,0,0,.19)",
                clipPath: "polygon(3% 0, 100% 0, 97% 100%, 0 94%, 5% 50%)",
                zIndex: 9,
              }}
            >
              <Pin color={INK0} x="20%" y={-6} />
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", color: INK2 }}>REF · SYSTEM</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 3 }}>Karl Gerstner</div>
              <div style={{ fontSize: 11, lineHeight: 1.4, color: INK1, marginTop: 3 }}>
                „Designing programmes.“ The grid as a generative system, not a cage.
              </div>
            </div>

            {/* ============================================================
                1b. PALETTE — hardware-store fan-deck (stacked swatches)
                    lower-center, overlapping the voice card slightly
               ============================================================ */}
            <div
              style={{
                position: "absolute",
                top: 838,
                left: 690,
                width: 196,
                transform: "rotate(-2.1deg)",
                zIndex: 16,
              }}
            >
              <Pin color={ACCENT} x="50%" y={-7} />
              {/* punch hole at top of the deck */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: PAPER0,
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)",
                  zIndex: 5,
                }}
              />
              {[
                ["oklch(0.962 0.008 78)", "paper-0", INK0],
                ["oklch(0.918 0.012 78)", "paper-1", INK0],
                ["oklch(0.585 0.008 78)", "ink-2", "#fff"],
                ["oklch(0.405 0.010 75)", "ink-1", "#fff"],
                ["oklch(0.205 0.012 70)", "ink-0", "#fff"],
              ].map(([c, label, fg], i) => (
                <div
                  key={i}
                  style={{
                    height: 44,
                    marginTop: i === 0 ? 26 : -2,
                    background: c as string,
                    border: `1px solid ${HAIR}`,
                    boxShadow: `2px ${4 + i}px ${10 + i * 2}px rgba(0,0,0,.${18 + i})`,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    padding: "0 9px 5px",
                    transform: `rotate(${[0.6, -0.8, 0.4, -0.5, 0.7][i]}deg)`,
                    position: "relative",
                    zIndex: 5 - i,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 9, color: fg as string, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 7.5, color: fg as string, opacity: 0.78 }}>
                    {(c as string).replace("oklch(", "").replace(")", "")}
                  </span>
                </div>
              ))}
            </div>

            {/* 1c. ACCENT chip — the one signal colour, big, its own torn chip */}
            <div
              style={{
                position: "absolute",
                top: 940,
                left: 880,
                width: 176,
                transform: "rotate(3.3deg)",
                zIndex: 17,
              }}
            >
              <Washi rot={-10} color="190 90 60" w={92} left="40%" top={-11} />
              <div
                style={{
                  height: 112,
                  background: ACCENT,
                  boxShadow: "3px 9px 20px rgba(0,0,0,.28)",
                  clipPath: "polygon(0 4%, 96% 0, 100% 92%, 4% 100%, 2% 48%)",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "0 12px 12px",
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: "#fff", letterSpacing: ".1em", opacity: 0.9 }}>
                  ACCENT · jediný signál
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: "#fff", fontWeight: 700, marginTop: 2 }}>
                  oklch(.628 .196 41)
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: "#fff", opacity: 0.85, marginTop: 2 }}>
                  calibrated instrument warm · hue 41°
                </div>
              </div>
            </div>

            {/* ============================================================
                MOOD WORDS — scraps, not headings
               ============================================================ */}
            <MoodWord text="klid" top={58} left={300} rot={-6} size={40} tape={{ rot: 8 }} />
            <MoodWord text="preciznost" top={1058} left={150} rot={3.5} size={30} pin />
            <MoodWord text="řemeslo" top={36} left={780} rot={5.2} size={36} tape={{ rot: -7 }} accent />
            <MoodWord text="zen" top={448} left={742} rot={-4.4} size={34} pin />
            <MoodWord text="originalita" top={1086} left={760} rot={-2.8} size={24} tape={{ rot: 6 }} />
            <MoodWord text="ticho" top={560} left={930} rot={4.6} size={26} pin accent />

            {/* ANTI-REFERENCE — circled "NE: rušivý chrome →" */}
            <div
              style={{
                position: "absolute",
                top: 1018,
                left: 1066,
                width: 300,
                transform: "rotate(-3.6deg)",
                zIndex: 19,
              }}
            >
              <svg width="300" height="92" style={{ overflow: "visible" }}>
                {/* wobbly non-closed circle */}
                <path
                  d="M14 50 C 8 18, 90 8, 168 14 C 250 20, 292 34, 282 56 C 274 80, 170 88, 96 84 C 40 81, 16 74, 18 52"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* arrow tail pointing toward OP-1 / clean refs */}
                <path
                  d="M286 50 C 316 44, 330 30, 352 26"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path d="M345 18 L356 26 L344 32" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
                <text
                  x="42"
                  y="46"
                  fontFamily={SANS}
                  fontSize="19"
                  fontWeight={700}
                  fill={INK0}
                  letterSpacing="-.01em"
                >
                  NE: rušivý chrome
                </text>
                <text x="64" y="68" fontFamily={MONO} fontSize="10.5" fill={INK1} letterSpacing=".04em">
                  generic SaaS dev-tool look
                </text>
              </svg>
            </div>

            {/* hand-drawn marker: underline under the title scrap */}
            <svg
              style={{ position: "absolute", top: 690, left: 488, zIndex: 18, overflow: "visible" }}
              width="220"
              height="20"
            >
              <path
                d="M2 9 C 50 3, 120 15, 215 6"
                fill="none"
                stroke={ACCENT}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.9"
              />
            </svg>

            {/* hand-drawn arrow: type specimen -> hero (cross-scrap) */}
            <svg
              style={{ position: "absolute", top: 250, left: 420, zIndex: 20, overflow: "visible" }}
              width="120"
              height="120"
            >
              <path
                d="M6 14 C 44 36, 70 58, 96 92"
                fill="none"
                stroke={INK1}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="1 7"
              />
              <path d="M88 78 L100 96 L80 98" fill="none" stroke={INK1} strokeWidth="2" strokeLinecap="round" />
            </svg>

            {/* margin scribble — measurement ticks (instrument craft) bottom edge */}
            <svg
              style={{ position: "absolute", top: 1146, left: 60, zIndex: 4, overflow: "visible", opacity: 0.6 }}
              width="380"
              height="22"
            >
              {Array.from({ length: 20 }).map((_, i) => (
                <line
                  key={i}
                  x1={i * 20}
                  y1={0}
                  x2={i * 20}
                  y2={i % 5 === 0 ? 14 : 7}
                  stroke={INK2}
                  strokeWidth="1"
                />
              ))}
              <text x="0" y="22" fontFamily={MONO} fontSize="8" fill={INK2}>
                0
              </text>
              <text x="186" y="22" fontFamily={MONO} fontSize="8" fill={INK2}>
                px 200
              </text>
              <text x="370" y="22" fontFamily={MONO} fontSize="8" fill={INK2} textAnchor="end">
                400
              </text>
            </svg>

            {/* a clean machine-cut hairline corner card (the "one clean edge" tell) */}
            <div
              style={{
                position: "absolute",
                top: 980,
                left: 60,
                width: 76,
                height: 76,
                background: PAPER_HI,
                border: `1px solid ${HAIR}`,
                transform: "rotate(1.1deg)",
                boxShadow: "1px 4px 10px rgba(0,0,0,.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 8,
              }}
            >
              <svg width="48" height="48">
                <rect x="2" y="2" width="44" height="44" fill="none" stroke={INK2} strokeWidth="1" />
                <line x1="2" y1="24" x2="46" y2="24" stroke={HAIR} strokeWidth="1" />
                <line x1="24" y1="2" x2="24" y2="46" stroke={HAIR} strokeWidth="1" />
                <circle cx="24" cy="24" r="3" fill={ACCENT} />
              </svg>
            </div>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   RefScrap — a pinned reference. Tries an <img>; onError swaps a labelled
   CSS scrap into the SAME slot (torn frame + tape/pin + swatch/treatment
   block + name + why) so a blocked image never leaves a gap.
   ──────────────────────────────────────────────────────────────────────── */
function RefScrap(props: {
  top: number;
  left: number;
  w: number;
  rot: number;
  z: number;
  img: string;
  name: string;
  why: string;
  url: string;
  query: string;
  swatch: string;
  fallbackKind: "grid" | "encoder" | "rams" | "focus" | "mono";
  polaroid?: boolean;
  tape?: { rot: number; color: string };
  pin?: { color: string };
}) {
  const { top, left, w, rot, z, img, name, why, url, query, swatch, fallbackKind, polaroid, tape, pin } = props;
  const PAPER_HI = "oklch(0.985 0.006 80)";
  const INK0 = "oklch(0.205 0.012 70)";
  const INK1 = "oklch(0.405 0.010 75)";
  const INK2 = "oklch(0.585 0.008 78)";
  const HAIR = "oklch(0.585 0.008 78 / 0.45)";
  const ACCENT = "oklch(0.628 0.196 41)";
  const SANS = '"Helvetica Neue", "Inter", system-ui, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
  const imgH = Math.round(w * 0.66);

  // the fallback "mini treatment" rendered if the image fails
  const fallbackSwatch =
    fallbackKind === "grid" ? (
      <div
        style={{
          width: "100%",
          height: imgH,
          background: "#0e0d0c",
          backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${Math.round(w / 8)}px, ${ACCENT} ${Math.round(
            w / 8,
          )}px ${Math.round(w / 8) + 1}px)`,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", left: "16%", top: "20%", width: "28%", height: "55%", background: ACCENT }} />
        <div style={{ position: "absolute", left: "52%", top: "40%", width: "34%", height: "40%", background: "#fff" }} />
      </div>
    ) : fallbackKind === "encoder" ? (
      <div
        style={{ width: "100%", height: imgH, background: "#1a1816", display: "flex", alignItems: "center", justifyContent: "space-around" }}
      >
        {[ACCENT, "#d8d4cc", "#8aa17a", "#c9b27a"].map((c, i) => (
          <div
            key={i}
            style={{
              width: "16%",
              aspectRatio: "1",
              borderRadius: "50%",
              background: `radial-gradient(circle at 38% 34%, #fff3, ${c} 60%, #000)`,
              boxShadow: "inset 0 -3px 6px #0008",
            }}
          />
        ))}
      </div>
    ) : fallbackKind === "rams" ? (
      <div style={{ width: "100%", height: imgH, background: "#e9e6df", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "62%", height: "44%", background: "#cfcabf", borderRadius: 6, position: "relative", boxShadow: "inset 0 1px 0 #fff8" }}>
          <div style={{ position: "absolute", inset: "18% 8%", display: "flex", gap: "6%" }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ flex: 1, background: "#9a948a", borderRadius: 1 }} />
            ))}
          </div>
          <div style={{ position: "absolute", right: "10%", bottom: "-22%", width: 18, height: 18, borderRadius: "50%", background: ACCENT }} />
        </div>
      </div>
    ) : fallbackKind === "focus" ? (
      <div style={{ width: "100%", height: imgH, background: "#fbfaf7", padding: "10% 12%", boxSizing: "border-box" }}>
        {[0.18, 0.18, 1, 0.18, 0.18].map((o, i) => (
          <div key={i} style={{ height: 8, marginBottom: 8, borderRadius: 2, background: INK0, opacity: o, width: i === 2 ? "90%" : "78%" }} />
        ))}
      </div>
    ) : (
      <div style={{ width: "100%", height: imgH, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: "#fff", letterSpacing: ".02em" }}>
          ▲ <span style={{ color: ACCENT }}>geist</span>/mono
        </span>
      </div>
    );

  return (
    <figure
      style={{
        position: "absolute",
        top,
        left,
        width: w,
        margin: 0,
        transform: `rotate(${rot}deg)`,
        background: PAPER_HI,
        padding: polaroid ? "12px 12px 0" : 10,
        paddingBottom: polaroid ? 0 : 10,
        border: `1px solid ${HAIR}`,
        boxShadow: `${(z % 3) + 2}px ${(z % 4) + 6}px ${(z % 5) + 12}px rgba(0,0,0,.${20 + (z % 6)})`,
        zIndex: z,
      }}
    >
      {tape && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: -11,
            transform: `translateX(-50%) rotate(${tape.rot}deg)`,
            width: 86,
            height: 26,
            background: `rgba(${tape.color},.55)`,
            clipPath:
              "polygon(0 8%, 6% 0, 14% 9%, 22% 1%, 100% 4%, 96% 96%, 88% 88%, 78% 99%, 60% 91%, 40% 100%, 20% 90%, 4% 99%)",
            boxShadow: "0 1px 2px rgba(0,0,0,.15)",
            zIndex: 30,
          }}
        />
      )}
      {pin && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: -7,
            transform: "translateX(-50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 32%, #fff, ${pin.color} 58%, ${INK0})`,
            boxShadow: "1px 2px 3px rgba(0,0,0,.45)",
            zIndex: 30,
          }}
        />
      )}

      {/* image OR onError fallback in the same slot */}
      <div style={{ position: "relative", overflow: "hidden", background: "#ddd9d1" }}>
        <img
          src={img}
          alt={name}
          width={w - (polaroid ? 24 : 20)}
          height={imgH}
          style={{ display: "block", width: "100%", height: imgH, objectFit: "cover" }}
          onError={(e) => {
            const el = e.currentTarget;
            const slot = el.nextElementSibling as HTMLElement | null;
            el.style.display = "none";
            if (slot) slot.style.display = "block";
          }}
        />
        {/* fallback (hidden until onError) */}
        <div style={{ display: "none" }}>{fallbackSwatch}</div>
        {/* tiny swatch strip — always present, ties ref to palette */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            display: "flex",
            zIndex: 4,
          }}
        >
          <span style={{ width: 22, height: 8, background: swatch }} />
          <span style={{ width: 22, height: 8, background: ACCENT }} />
        </div>
      </div>

      <figcaption
        style={{
          padding: polaroid ? "14px 8px 18px" : "9px 6px 4px",
          borderBottom: polaroid ? "0" : "0",
          ...(polaroid ? { borderBottom: "none" } : {}),
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em", color: INK0, fontFamily: SANS }}>{name}</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.4, color: INK1, marginTop: 3, fontFamily: SANS }}>{why}</div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, marginTop: 6, wordBreak: "break-all" }}>{url}</div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: INK2, marginTop: 2 }}>q: {query}</div>
      </figcaption>

      {/* polaroid thick bottom lip already handled by padding; add handwritten tick */}
      {polaroid && (
        <div
          style={{
            position: "absolute",
            right: 14,
            bottom: 6,
            fontFamily: MONO,
            fontSize: 9,
            color: INK2,
            transform: "rotate(-2deg)",
          }}
        >
          ’11 · CNC alu
        </div>
      )}
    </figure>
  );
}

/* ── mood word scrap ─────────────────────────────────────────────────────── */
function MoodWord(props: {
  text: string;
  top: number;
  left: number;
  rot: number;
  size: number;
  accent?: boolean;
  pin?: boolean;
  tape?: { rot: number };
}) {
  const { text, top, left, rot, size, accent, pin, tape } = props;
  const PAPER_HI = "oklch(0.985 0.006 80)";
  const INK0 = "oklch(0.205 0.012 70)";
  const ACCENT = "oklch(0.628 0.196 41)";
  const SANS = '"Helvetica Neue", "Inter", system-ui, sans-serif';
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        transform: `rotate(${rot}deg)`,
        background: accent ? ACCENT : PAPER_HI,
        color: accent ? "#fff" : INK0,
        padding: `${Math.round(size * 0.18)}px ${Math.round(size * 0.4)}px`,
        fontFamily: SANS,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-.03em",
        boxShadow: "2px 6px 13px rgba(0,0,0,.2)",
        clipPath:
          "polygon(1% 4%, 99% 0, 100% 88%, 96% 100%, 4% 97%, 0 60%)",
        zIndex: 21,
      }}
    >
      {tape && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: -10,
            transform: `translateX(-50%) rotate(${tape.rot}deg)`,
            width: Math.max(60, size * 1.8),
            height: 22,
            background: "rgba(210,180,120,.55)",
            clipPath:
              "polygon(0 8%, 8% 0, 18% 9%, 100% 4%, 96% 96%, 80% 99%, 40% 100%, 6% 99%)",
          }}
        />
      )}
      {pin && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: -6,
            transform: "translateX(-50%)",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 32%, #fff, ${ACCENT} 58%, ${INK0})`,
            boxShadow: "1px 2px 3px rgba(0,0,0,.45)",
          }}
        />
      )}
      {text}
    </div>
  );
}
