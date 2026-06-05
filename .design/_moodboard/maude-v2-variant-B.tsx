import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";

/**
 * maude-v2 · Variant B — "Zed × Webflow / Unified Pro Studio"
 *
 * A 1am pinboard, dark-felt pole. Crisp GPU-sharp editor precision (Zed)
 * fused with a designer-grade panel system (Webflow) into ONE material.
 * Confident chrome that FRAMES a dark canvas without fighting it.
 *
 * Fully self-contained. No DS tokens. Inline styles + one <style> block.
 * Generated blind — independent of any existing repo design system.
 */

// ── self-contained palette (OKLCH-derived, dark-first) ───────────────
const C = {
  // dark elevation ladder (cool neutral greys — Zed-like precise steps)
  bg0: "#0c0e12", // oklch(16% 0.012 255) — deepest canvas
  bg1: "#111419", // oklch(19% 0.012 255) — app shell
  bg2: "#161a20", // oklch(22% 0.012 255) — panel
  bg3: "#1d222a", // oklch(26% 0.012 255) — raised row
  bg4: "#252b34", // oklch(30% 0.012 255) — hover / input
  hair: "#2f3742", // oklch(34% 0.013 250) — 1px hairline
  hair2: "#3a4350",
  // foreground ladder
  fg0: "#e8ecf2", // oklch(94% 0.006 255)
  fg1: "#aab3c0", // oklch(76% 0.012 255)
  fg2: "#727d8c", // oklch(56% 0.014 255)
  fg3: "#4b5462", // oklch(40% 0.015 255)
  // confident editor/builder accent — refined electric indigo-blue
  accent: "#5b7cff", // oklch(64% 0.18 268)
  accentHi: "#7d97ff", // oklch(72% 0.16 266)
  accentDim: "#2c3a78", // oklch(38% 0.11 268)
  // secondary syntax-highlight signal — used sparingly for state
  green: "#43d49b", // oklch(80% 0.15 162) — "added / ok / live"
  magenta: "#e068c8", // oklch(70% 0.17 340) — used once, sparingly
  // paper for scrap cards on the dark board (kept light for legibility)
  paper: "#f4f1ea",
  paper2: "#e9e4d8",
  paperShadow: "rgba(0,0,0,.55)",
  ink: "#1a1714",
  inkSoft: "#5b554c",
  tape: "rgba(214, 206, 184, 0.42)",
  tapeBlue: "rgba(124, 151, 255, 0.30)",
};

// grain data-URI (feTurbulence) — sits BEHIND content at low opacity
const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
  );

// ── tiny atoms ───────────────────────────────────────────────────────
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace';
const SANS = '"Inter", system-ui, sans-serif';

function Pin({ color = "#c9ccd3", left = "50%", top = -7 }) {
  return (
    <span
      style={{
        position: "absolute",
        left,
        top,
        width: 14,
        height: 14,
        borderRadius: "50%",
        transform: "translateX(-50%)",
        background: `radial-gradient(circle at 35% 30%, #fff, ${color} 55%, #00000055 100%)`,
        boxShadow: "0 2px 3px rgba(0,0,0,.6), inset 0 -1px 2px rgba(0,0,0,.4)",
        zIndex: 30,
      }}
    />
  );
}

function Tape({ w = 72, h = 24, rot = 0, left = "50%", top = -10, blue = false }) {
  return (
    <span
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        transform: `translateX(-50%) rotate(${rot}deg)`,
        background: blue ? C.tapeBlue : C.tape,
        borderLeft: "1px solid rgba(255,255,255,.16)",
        borderRight: "1px solid rgba(255,255,255,.16)",
        boxShadow: "0 1px 2px rgba(0,0,0,.35)",
        // frayed ends
        clipPath:
          "polygon(3% 8%, 12% 0, 22% 10%, 35% 2%, 50% 9%, 66% 1%, 80% 11%, 92% 3%, 100% 12%, 97% 92%, 86% 100%, 72% 90%, 55% 99%, 40% 91%, 26% 100%, 13% 90%, 2% 97%)",
        zIndex: 31,
        backdropFilter: "saturate(1.1)",
      }}
    />
  );
}

// torn-edge clip variants (irregular many-point)
const TORN = {
  a: "polygon(0% 4%, 8% 0, 19% 5%, 33% 1%, 48% 6%, 62% 1%, 77% 5%, 90% 1%, 100% 6%, 98% 94%, 88% 100%, 73% 95%, 59% 100%, 44% 95%, 30% 100%, 16% 95%, 4% 100%)",
  b: "polygon(2% 0, 100% 3%, 97% 22%, 100% 44%, 96% 66%, 100% 88%, 95% 100%, 72% 97%, 49% 100%, 27% 97%, 3% 100%, 0% 71%, 4% 47%, 0% 24%)",
  c: "polygon(0 0, 96% 2%, 100% 100%, 6% 97%, 3% 60%, 0 38%)", // one clean-ish machine edge
};

export default function MaudeV2VariantB() {
  return (
    <DesignCanvas>
      <DCSection
        id="moodboard"
        title="maude-v2 · Variant B — Zed × Webflow / Unified Pro Studio"
      >
        <DCArtboard
          id="board"
          label="B · Zed × Webflow — Unified Pro Studio"
          width={1480}
          height={1180}
        >
          <style>{`
            .scrap { position:absolute; box-sizing:border-box; }
            .vb-mono { font-family:${MONO}; }
            .vb-sans { font-family:${SANS}; }
            .vb-hand {
              font-family:"Bradley Hand","Segoe Print","Comic Sans MS",${SANS};
              font-style:italic;
            }
            .vb-paper {
              background:linear-gradient(170deg, ${C.paper} 0%, ${C.paper2} 100%);
              color:${C.ink};
            }
          `}</style>

          {/* ───────────────── BOARD BASE: dark cool felt ─────────────── */}
          <div
            style={{
              position: "relative",
              width: 1480,
              height: 1180,
              overflow: "hidden",
              background: `radial-gradient(130% 120% at 38% 22%, ${C.bg2} 0%, ${C.bg1} 46%, ${C.bg0} 100%)`,
              boxShadow: "inset 0 0 120px rgba(0,0,0,.35)",
            }}
          >
            {/* grain layer — behind everything, very faint */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url("${GRAIN}")`,
                backgroundSize: "180px 180px",
                opacity: 0.04,
                mixBlendMode: "screen",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
            {/* faint cool speckle to read as felt */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "radial-gradient(rgba(124,151,255,.05) 1px, transparent 1px)",
                backgroundSize: "9px 9px",
                opacity: 0.5,
                pointerEvents: "none",
                zIndex: 0,
              }}
            />

            {/* board title scrap — taped corner label, top-left, slight tilt */}
            <div
              className="scrap vb-mono"
              style={{
                left: 34,
                top: 26,
                width: 360,
                padding: "10px 14px 12px",
                background: C.bg2,
                border: `1px solid ${C.hair}`,
                borderLeft: `3px solid ${C.accent}`,
                color: C.fg1,
                transform: "rotate(-2.4deg)",
                boxShadow: "0 10px 24px rgba(0,0,0,.5)",
                zIndex: 12,
              }}
            >
              <Tape w={64} h={20} rot={6} left="22%" top={-9} blue />
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: ".22em",
                  color: C.accentHi,
                  textTransform: "uppercase",
                }}
              >
                maude-v2 / moodboard
              </div>
              <div
                className="vb-sans"
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  color: C.fg0,
                  marginTop: 4,
                  letterSpacing: "-.01em",
                }}
              >
                Variant B — Unified Pro Studio
              </div>
              <div style={{ fontSize: 11, color: C.fg2, marginTop: 3 }}>
                Zed × Webflow · one material, not editor + bolted-on panels
              </div>
            </div>

            {/* ════════════════ 3 · SIGNATURE HERO ════════════════════ */}
            {/* The unified panel system: toolbar + layers + canvas + inspector
                all sharing ONE material. The large focal scrap. */}
            <div
              className="scrap"
              style={{
                left: 452,
                top: 138,
                width: 720,
                height: 470,
                transform: "rotate(-1.3deg)",
                zIndex: 14,
                boxShadow:
                  "0 30px 60px rgba(0,0,0,.6), 0 6px 14px rgba(0,0,0,.5)",
              }}
            >
              <Tape w={120} h={28} rot={4} left="20%" top={-13} blue />
              <Tape w={104} h={26} rot={-7} left="82%" top={-12} />
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: C.bg1,
                  border: `1px solid ${C.hair2}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* TOP TOOLBAR — one material */}
                <div
                  className="vb-mono"
                  style={{
                    height: 38,
                    flex: "0 0 38px",
                    background: C.bg2,
                    borderBottom: `1px solid ${C.hair}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 12px",
                    fontSize: 11,
                    color: C.fg1,
                  }}
                >
                  <span style={{ display: "flex", gap: 6 }}>
                    {["#3a4350", "#3a4350", "#3a4350"].map((c, i) => (
                      <span
                        key={i}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: c,
                        }}
                      />
                    ))}
                  </span>
                  <span
                    style={{
                      width: 1,
                      height: 18,
                      background: C.hair,
                    }}
                  />
                  {/* active tab — accent in context */}
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: C.accentDim,
                      border: `1px solid ${C.accent}`,
                      color: C.fg0,
                    }}
                  >
                    onboarding.tsx
                  </span>
                  <span style={{ padding: "5px 10px", color: C.fg2 }}>
                    pricing.tsx
                  </span>
                  <span style={{ padding: "5px 10px", color: C.fg2 }}>
                    canvas/flow-2
                  </span>
                  <span style={{ marginLeft: "auto", color: C.green, fontSize: 10 }}>
                    ● agent · live
                  </span>
                  <span
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: C.accent,
                      color: "#0a0d18",
                      fontWeight: 700,
                    }}
                  >
                    Handoff
                  </span>
                </div>

                {/* BODY: layers · canvas · inspector */}
                <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                  {/* LEFT — layers tree */}
                  <div
                    className="vb-mono"
                    style={{
                      width: 168,
                      flex: "0 0 168px",
                      background: C.bg2,
                      borderRight: `1px solid ${C.hair}`,
                      padding: "10px 0",
                      fontSize: 11,
                      color: C.fg1,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "0 12px 8px",
                        color: C.fg2,
                        fontSize: 9,
                        letterSpacing: ".18em",
                        textTransform: "uppercase",
                      }}
                    >
                      Layers
                    </div>
                    {[
                      ["▾ Artboard", 0, false],
                      ["▾ Hero", 1, false],
                      ["◻ Eyebrow", 2, false],
                      ["◻ Headline", 2, true],
                      ["◻ CTA group", 2, false],
                      ["▸ Feature grid", 1, false],
                      ["▸ Pricing", 1, false],
                      ["◻ Footer", 1, false],
                    ].map(([label, depth, sel], i) => (
                      <div
                        key={i}
                        style={{
                          padding: `4px 12px 4px ${12 + Number(depth) * 14}px`,
                          background: sel ? C.accentDim : "transparent",
                          borderLeft: sel
                            ? `2px solid ${C.accent}`
                            : "2px solid transparent",
                          color: sel ? C.fg0 : C.fg1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label as string}
                      </div>
                    ))}
                  </div>

                  {/* CENTER — the dark canvas (hero stays the hero) */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: `radial-gradient(120% 120% at 50% 40%, ${C.bg1} 0%, ${C.bg0} 100%)`,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {/* dotted infinite-canvas grid */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage:
                          "radial-gradient(rgba(170,179,192,.12) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                      }}
                    />
                    {/* a mockup artboard floating on canvas, selected */}
                    <div
                      style={{
                        position: "relative",
                        width: 232,
                        height: 268,
                        background: "#fbfbfd",
                        borderRadius: 6,
                        outline: `1.5px solid ${C.accent}`,
                        boxShadow: `0 0 0 4px ${C.accent}22, 0 18px 40px rgba(0,0,0,.55)`,
                        overflow: "hidden",
                      }}
                    >
                      {/* selection handles */}
                      {[
                        [-4, -4],
                        ["calc(100% - 4px)", -4],
                        [-4, "calc(100% - 4px)"],
                        ["calc(100% - 4px)", "calc(100% - 4px)"],
                      ].map(([l, t], i) => (
                        <span
                          key={i}
                          style={{
                            position: "absolute",
                            left: l as number,
                            top: t as number,
                            width: 8,
                            height: 8,
                            background: "#fff",
                            border: `1.5px solid ${C.accent}`,
                            borderRadius: 2,
                          }}
                        />
                      ))}
                      {/* faux mockup content */}
                      <div style={{ padding: 16 }}>
                        <div
                          className="vb-mono"
                          style={{ fontSize: 8, color: "#8a93a3", letterSpacing: ".1em" }}
                        >
                          MOCKUP · iterace 04
                        </div>
                        <div
                          className="vb-sans"
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#16181d",
                            marginTop: 12,
                            lineHeight: 1.1,
                          }}
                        >
                          Design to
                          <br />
                          production,
                          <br />
                          on one canvas.
                        </div>
                        <div
                          style={{
                            marginTop: 14,
                            display: "inline-block",
                            padding: "6px 12px",
                            borderRadius: 5,
                            background: C.accent,
                            color: "#fff",
                            fontSize: 10,
                            fontFamily: SANS,
                            fontWeight: 600,
                          }}
                        >
                          Start iterating
                        </div>
                        <div
                          style={{
                            marginTop: 26,
                            height: 1,
                            background: "#e5e6ea",
                          }}
                        />
                        <div
                          className="vb-sans"
                          style={{ fontSize: 9, color: "#9aa1ad", marginTop: 10 }}
                        >
                          Powered by the agent · 0.3s
                        </div>
                      </div>
                    </div>
                    {/* tiny floating selection label — mono, tabular */}
                    <div
                      className="vb-mono"
                      style={{
                        position: "absolute",
                        bottom: 12,
                        left: 12,
                        fontSize: 9,
                        color: C.fg2,
                        background: C.bg2,
                        border: `1px solid ${C.hair}`,
                        borderRadius: 4,
                        padding: "2px 6px",
                      }}
                    >
                      232 × 268 · 100%
                    </div>
                  </div>

                  {/* RIGHT — properties inspector (Webflow DNA) */}
                  <div
                    className="vb-mono"
                    style={{
                      width: 196,
                      flex: "0 0 196px",
                      background: C.bg2,
                      borderLeft: `1px solid ${C.hair}`,
                      fontSize: 11,
                      color: C.fg1,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px 8px",
                        borderBottom: `1px solid ${C.hair}`,
                        color: C.fg2,
                        fontSize: 9,
                        letterSpacing: ".18em",
                        textTransform: "uppercase",
                      }}
                    >
                      Inspector · Headline
                    </div>
                    {/* numeric field rows — tabular mono */}
                    {[
                      ["W", "232", "px"],
                      ["H", "auto", ""],
                      ["X", "124.5", "px"],
                      ["Y", "88.0", "px"],
                    ].map(([k, v, u], i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 12px",
                          borderBottom: `1px solid ${C.bg1}`,
                        }}
                      >
                        <span style={{ width: 14, color: C.fg2 }}>{k}</span>
                        <span
                          style={{
                            flex: 1,
                            background: C.bg4,
                            border: `1px solid ${C.hair}`,
                            borderRadius: 4,
                            padding: "3px 7px",
                            color: C.fg0,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {v}
                        </span>
                        <span style={{ width: 16, color: C.fg3 }}>{u}</span>
                      </div>
                    ))}
                    {/* type props */}
                    <div style={{ padding: "8px 12px 4px", color: C.fg2, fontSize: 9, letterSpacing: ".16em" }}>
                      TYPOGRAPHY
                    </div>
                    <div style={{ padding: "0 12px 8px" }}>
                      <div
                        style={{
                          background: C.bg4,
                          border: `1px solid ${C.hair}`,
                          borderRadius: 4,
                          padding: "5px 7px",
                          color: C.fg0,
                          marginBottom: 6,
                        }}
                      >
                        Inter · 48 / 52
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span
                          style={{
                            flex: 1,
                            background: C.bg4,
                            border: `1px solid ${C.hair}`,
                            borderRadius: 4,
                            padding: "5px 7px",
                            color: C.fg1,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          −0.02em
                        </span>
                        <span
                          style={{
                            width: 30,
                            borderRadius: 4,
                            background: C.accent,
                          }}
                          title="fill"
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        margin: "6px 12px",
                        padding: "6px 8px",
                        borderRadius: 5,
                        background: C.bg3,
                        border: `1px solid ${C.hair}`,
                        color: C.green,
                        fontSize: 10,
                      }}
                    >
                      ✓ contrast AA · 7.1:1
                    </div>
                  </div>
                </div>
              </div>
              {/* handwritten margin caption pointing at the hero */}
              <div
                className="vb-hand"
                style={{
                  position: "absolute",
                  right: -8,
                  bottom: -34,
                  fontSize: 16,
                  color: C.accentHi,
                  transform: "rotate(-3deg)",
                }}
              >
                one material → layers · canvas · inspector
              </div>
            </div>

            {/* hand-drawn arrow from caption up into the inspector */}
            <svg
              width="120"
              height="90"
              style={{ position: "absolute", left: 1098, top: 560, zIndex: 16, pointerEvents: "none" }}
            >
              <path
                d="M8 78 C 40 70, 70 46, 92 14"
                fill="none"
                stroke={C.accentHi}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M92 14 L 80 24 M92 14 L 96 30"
                fill="none"
                stroke={C.accentHi}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* ════════════════ 1 · PALETTE ═══════════════════════════ */}
            {/* dark elevation ladder — stepped strip, hole-punched chip */}
            <div
              className="scrap"
              style={{
                left: 56,
                top: 184,
                width: 168,
                padding: "16px 12px 12px",
                background: C.bg2,
                border: `1px solid ${C.hair}`,
                transform: "rotate(2.7deg)",
                boxShadow: "0 14px 30px rgba(0,0,0,.5)",
                zIndex: 11,
              }}
            >
              <Pin color={C.accent} left="50%" top={-6} />
              {/* hole punch */}
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: C.bg0,
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,.7)",
                }}
              />
              <div
                className="vb-mono"
                style={{ fontSize: 9, color: C.fg2, letterSpacing: ".14em", marginBottom: 8 }}
              >
                ELEVATION · bg0→4
              </div>
              {[
                ["bg0", C.bg0, "oklch(16% .012 255)"],
                ["bg1", C.bg1, "oklch(19% .012 255)"],
                ["bg2", C.bg2, "oklch(22% .012 255)"],
                ["bg3", C.bg3, "oklch(26% .012 255)"],
                ["bg4", C.bg4, "oklch(30% .012 255)"],
              ].map(([name, hex, ok], i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 26,
                    background: hex as string,
                    borderTop: i === 0 ? "none" : `1px solid ${C.hair}`,
                    padding: "0 8px",
                  }}
                >
                  <span className="vb-mono" style={{ fontSize: 9, color: C.fg1, width: 26 }}>
                    {name as string}
                  </span>
                  <span className="vb-mono" style={{ fontSize: 7.5, color: C.fg3 }}>
                    {ok as string}
                  </span>
                </div>
              ))}
            </div>

            {/* accent paint-chip fan deck (3 chips, stacked + hole punch) */}
            <div
              className="scrap"
              style={{ left: 196, top: 470, width: 120, height: 150, zIndex: 13 }}
            >
              {[
                ["accent", C.accent, "oklch(64% .18 268)", "2deg", 0],
                ["accentHi", C.accentHi, "oklch(72% .16 266)", "-6deg", 14],
                ["accentDim", C.accentDim, "oklch(38% .11 268)", "5deg", 28],
              ].map(([name, hex, ok, rot, off], i) => (
                <div
                  key={i}
                  className="scrap vb-mono"
                  style={{
                    left: Number(off),
                    top: Number(off) * 0.7,
                    width: 96,
                    height: 116,
                    background: hex as string,
                    transform: `rotate(${rot})`,
                    boxShadow: "0 6px 14px rgba(0,0,0,.5)",
                    borderRadius: 3,
                    zIndex: 3 - i,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: 7,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 8,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#0008",
                    }}
                  />
                  <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>
                    {name as string}
                  </span>
                  <span style={{ fontSize: 7, color: "#ffffffcc" }}>{ok as string}</span>
                </div>
              ))}
            </div>

            {/* secondary signal chips — green + magenta, torn block, sparse */}
            <div
              className="scrap"
              style={{
                left: 60,
                top: 470,
                width: 116,
                padding: "10px 10px 12px",
                background: C.bg3,
                border: `1px solid ${C.hair}`,
                transform: "rotate(-4.4deg)",
                clipPath: TORN.b,
                boxShadow: "0 10px 22px rgba(0,0,0,.45)",
                zIndex: 9,
              }}
            >
              <div className="vb-mono" style={{ fontSize: 8.5, color: C.fg2, letterSpacing: ".1em" }}>
                STATE SIGNAL · sparing
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span style={{ flex: 1 }}>
                  <span
                    style={{ display: "block", height: 30, background: C.green, borderRadius: 3 }}
                  />
                  <span className="vb-mono" style={{ fontSize: 7, color: C.green }}>
                    live/ok
                  </span>
                  <span className="vb-mono" style={{ display: "block", fontSize: 6.5, color: C.fg3 }}>
                    80% .15 162
                  </span>
                </span>
                <span style={{ flex: 1 }}>
                  <span
                    style={{ display: "block", height: 30, background: C.magenta, borderRadius: 3 }}
                  />
                  <span className="vb-mono" style={{ fontSize: 7, color: C.magenta }}>
                    diff
                  </span>
                  <span className="vb-mono" style={{ display: "block", fontSize: 6.5, color: C.fg3 }}>
                    70% .17 340
                  </span>
                </span>
              </div>
            </div>

            {/* accent-in-context HERO chip: a selected layer row + primary btn */}
            <div
              className="scrap"
              style={{
                left: 52,
                top: 700,
                width: 290,
                padding: "12px 14px 14px",
                background: C.bg1,
                border: `1px solid ${C.hair2}`,
                borderRadius: 8,
                transform: "rotate(1.8deg)",
                boxShadow: "0 18px 38px rgba(0,0,0,.55)",
                zIndex: 13,
              }}
            >
              <Tape w={96} h={24} rot={-8} left="30%" top={-12} blue />
              <div className="vb-mono" style={{ fontSize: 9, color: C.fg2, letterSpacing: ".14em" }}>
                ACCENT IN CONTEXT
              </div>
              {/* selected row */}
              <div
                className="vb-mono"
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: C.accentDim,
                  border: `1px solid ${C.accent}`,
                  borderLeft: `3px solid ${C.accent}`,
                  color: C.fg0,
                  fontSize: 12,
                }}
              >
                <span style={{ color: C.accentHi }}>◻</span> Headline
                <span style={{ marginLeft: "auto", color: C.fg2, fontSize: 10 }}>selected</span>
              </div>
              {/* idle row */}
              <div
                className="vb-mono"
                style={{
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  color: C.fg1,
                  fontSize: 12,
                }}
              >
                <span style={{ color: C.fg3 }}>◻</span> CTA group
              </div>
              {/* primary button */}
              <button
                className="vb-sans"
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "9px 0",
                  border: "none",
                  borderRadius: 7,
                  background: C.accent,
                  color: "#0a0d18",
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: `0 2px 0 ${C.accentDim}, 0 8px 18px ${C.accent}33`,
                }}
              >
                Generate iteration ⇧⌘G
              </button>
            </div>

            {/* ════════════════ 2 · TYPE PAIRING ══════════════════════ */}
            {/* ripped type-specimen fragment — UI grotesque + prominent mono */}
            <div
              className="scrap vb-paper"
              style={{
                left: 1188,
                top: 96,
                width: 252,
                padding: "16px 16px 22px",
                transform: "rotate(2.2deg)",
                clipPath: TORN.a,
                boxShadow: `0 16px 34px ${C.paperShadow}`,
                zIndex: 12,
              }}
            >
              <Pin color="#d6d2c4" left="78%" top={-5} />
              <div className="vb-mono" style={{ fontSize: 9, color: C.inkSoft, letterSpacing: ".1em" }}>
                TYPE PAIRING
              </div>
              <div
                className="vb-sans"
                style={{ fontSize: 40, fontWeight: 800, lineHeight: 0.92, marginTop: 8, letterSpacing: "-.03em" }}
              >
                Řemeslnost
              </div>
              <div className="vb-mono" style={{ fontSize: 8.5, color: C.inkSoft, marginTop: 2 }}>
                Inter / Geist Sans · Display 800
              </div>
              <div
                className="vb-sans"
                style={{ fontSize: 13, lineHeight: 1.42, marginTop: 12, color: "#2b2723" }}
              >
                Precizní mřížka, klidná hierarchie. Grotesk nese UI,
                mono nese data — jeden konzistentní materiál.
              </div>
              <div
                style={{
                  marginTop: 12,
                  borderTop: `1px solid #00000020`,
                  paddingTop: 10,
                }}
              >
                <div className="vb-mono" style={{ fontSize: 8.5, color: C.inkSoft }}>
                  Geist Mono / JetBrains Mono / Berkeley
                </div>
                <pre
                  className="vb-mono"
                  style={{
                    margin: "6px 0 0",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: "#23201c",
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "pre-wrap",
                  }}
                >
{`x  124.50  px
w  232      px
ratio 1.618
inspector.props →`}
                </pre>
              </div>
            </div>

            {/* mono-first specimen scrap (dark, editor-feel) */}
            <div
              className="scrap vb-mono"
              style={{
                left: 1208,
                top: 392,
                width: 232,
                padding: "12px 14px",
                background: C.bg1,
                border: `1px solid ${C.hair2}`,
                borderRadius: 8,
                transform: "rotate(-3.1deg)",
                boxShadow: "0 14px 30px rgba(0,0,0,.55)",
                zIndex: 11,
              }}
            >
              <Tape w={90} h={24} rot={7} left="70%" top={-12} />
              <div style={{ fontSize: 8.5, color: C.fg2, letterSpacing: ".12em", marginBottom: 8 }}>
                MONO IS FIRST-CLASS
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.55 }}>
                <span style={{ color: C.fg3 }}>{"// 01234567"}</span>
                <br />
                <span style={{ color: C.accentHi }}>const</span>{" "}
                <span style={{ color: C.fg0 }}>canvas</span>{" "}
                <span style={{ color: C.fg2 }}>=</span>{" "}
                <span style={{ color: C.green }}>infinite</span>
                <span style={{ color: C.fg2 }}>(</span>
                <span style={{ color: C.fg0 }}>agent</span>
                <span style={{ color: C.fg2 }}>)</span>
                <br />
                <span style={{ color: C.accentHi }}>type</span>{" "}
                <span style={{ color: C.fg0 }}>Handoff</span>{" "}
                <span style={{ color: C.fg2 }}>=</span>{" "}
                <span style={{ color: C.magenta }}>Production</span>
              </div>
            </div>

            {/* ════════════════ 4 · VOICE SAMPLE (index card) ═════════ */}
            <div
              className="scrap vb-paper"
              style={{
                left: 470,
                top: 690,
                width: 320,
                padding: "16px 18px 18px",
                transform: "rotate(-2.6deg)",
                boxShadow: `0 16px 34px ${C.paperShadow}`,
                zIndex: 12,
                backgroundImage: `repeating-linear-gradient(${C.paper}, ${C.paper} 26px, #c9c2b0 27px), linear-gradient(170deg, ${C.paper}, ${C.paper2})`,
                backgroundBlendMode: "multiply",
              }}
            >
              <Tape w={120} h={28} rot={5} left="50%" top={-13} />
              {/* red margin line, index-card feel */}
              <span
                style={{
                  position: "absolute",
                  left: 30,
                  top: 0,
                  bottom: 0,
                  width: 1.5,
                  background: "#d98a8a",
                  opacity: 0.6,
                }}
              />
              <div
                className="vb-mono"
                style={{ fontSize: 9, color: C.inkSoft, letterSpacing: ".1em", paddingLeft: 14 }}
              >
                VOICE · hlas
              </div>
              <div
                className="vb-sans"
                style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, marginTop: 8, paddingLeft: 14, color: "#211d19" }}
              >
                „Plátno je nekonečné. Vrstvy zleva, vlastnosti zprava —
                jeden nástroj.”
              </div>
              <div
                className="vb-sans"
                style={{ fontSize: 13, lineHeight: 1.42, marginTop: 10, paddingLeft: 14, color: "#3a352f" }}
              >
                Iteruj mockup s agentem na jednom canvasu; inspector drží
                preciznost, handoff je production-ready.
              </div>
            </div>

            {/* ════════════════ 5 · REFERENCE PROVENANCE (dense) ══════ */}
            {/* Each ref scrap: <img> with onError → labelled fallback in slot.
                Carries: anchor name · why · source · query. */}
            {[
              {
                name: "Zed editor",
                why: "GPU-rendered, dense, mono-tinged, deep cool dark",
                url: "zed.dev/blog/videogame",
                q: "Zed editor interface dark GPU",
                rot: -4.2,
                left: 798,
                top: 636,
                w: 218,
                accent: C.accent,
                img: "https://zed.dev/img/zed-screenshot.png",
                swatch: C.bg0,
              },
              {
                name: "Webflow Designer",
                why: "panel system · style/props inspector · designer blue",
                url: "help.webflow.com · Style panel",
                q: "Webflow designer panels inspector",
                rot: 3.4,
                left: 1024,
                top: 626,
                w: 226,
                accent: "#4353ff",
                img: "https://webflow.com/style-panel.png",
                swatch: "#1b1d24",
              },
              {
                name: "Linear",
                why: "density without noise — cohesion / restraint anchor",
                url: "linear.app/now/how-we-redesigned",
                q: "Linear UI dense panels restraint",
                rot: -2.1,
                left: 470,
                top: 920,
                w: 230,
                accent: "#8b9bff",
                img: "https://linear.app/og.png",
                swatch: C.bg1,
              },
              {
                name: "Framer",
                why: "designer-grade inspector controls · canvas tool",
                url: "framer.com",
                q: "Framer interface inspector",
                rot: 4.6,
                left: 712,
                top: 928,
                w: 214,
                accent: "#0a84ff",
                img: "https://framer.com/og.png",
                swatch: C.bg2,
              },
              {
                name: "Cursor",
                why: "agent-in-editor · code+AI on one surface",
                url: "cursor.com",
                q: "Cursor AI editor dark",
                rot: -3.7,
                left: 952,
                top: 916,
                w: 206,
                accent: C.green,
                img: "https://cursor.com/og.png",
                swatch: C.bg3,
              },
              {
                name: "Figma",
                why: "infinite canvas + right-hand properties grammar",
                url: "figma.com",
                q: "Figma inspector properties panel",
                rot: 2.8,
                left: 1180,
                top: 906,
                w: 210,
                accent: "#a259ff",
                img: "https://figma.com/og.png",
                swatch: C.bg2,
              },
            ].map((r, i) => (
              <div
                key={i}
                className="scrap"
                style={{
                  left: r.left,
                  top: r.top,
                  width: r.w,
                  transform: `rotate(${r.rot}deg)`,
                  background: C.paper,
                  padding: 7,
                  paddingBottom: 30,
                  boxShadow: `0 ${10 + (i % 3) * 4}px ${24 + (i % 3) * 6}px ${C.paperShadow}`,
                  zIndex: 8 + (i % 4),
                }}
              >
                {i % 2 === 0 ? (
                  <Pin color={r.accent} left={`${30 + i * 7}%`} top={-6} />
                ) : (
                  <Tape w={80} h={24} rot={r.rot > 0 ? -9 : 8} left="50%" top={-12} />
                )}
                {/* polaroid-ish image slot with onError → labelled scrap */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 118,
                    overflow: "hidden",
                    background: r.swatch,
                  }}
                >
                  <img
                    src={r.img}
                    alt={r.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = "none";
                      const fb = t.nextElementSibling as HTMLElement | null;
                      if (fb) fb.style.display = "flex";
                    }}
                  />
                  {/* fallback scrap — same slot, never a gap */}
                  <div
                    style={{
                      display: "none",
                      position: "absolute",
                      inset: 0,
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: 10,
                      background: `linear-gradient(150deg, ${r.swatch}, ${C.bg0})`,
                    }}
                  >
                    <div
                      className="vb-mono"
                      style={{ fontSize: 9, color: C.fg2, letterSpacing: ".1em" }}
                    >
                      [ ref · no img ]
                    </div>
                    {/* a treatment block representing the ref */}
                    <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
                      <span style={{ width: 22, height: 38, background: r.accent, borderRadius: 2 }} />
                      <span style={{ width: 14, height: 26, background: C.hair2, borderRadius: 2 }} />
                      <span style={{ width: 14, height: 18, background: C.hair, borderRadius: 2 }} />
                      <span
                        className="vb-sans"
                        style={{ marginLeft: "auto", fontSize: 15, fontWeight: 800, color: r.accent }}
                      >
                        {r.name}
                      </span>
                    </div>
                  </div>
                </div>
                {/* provenance tag */}
                <div style={{ paddingTop: 6 }}>
                  <div className="vb-sans" style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>
                    {r.name}
                  </div>
                  <div className="vb-sans" style={{ fontSize: 10, lineHeight: 1.25, color: C.inkSoft, marginTop: 1 }}>
                    {r.why}
                  </div>
                  <div className="vb-mono" style={{ fontSize: 7.5, color: "#8a8475", marginTop: 4 }}>
                    {r.url}
                  </div>
                  <div className="vb-mono" style={{ fontSize: 7, color: "#a7a08c", marginTop: 1 }}>
                    ⌕ {r.q}
                  </div>
                </div>
              </div>
            ))}

            {/* ════════════════ MOOD WORDS (scraps, angled) ═══════════ */}
            {/* circled "cohesive" — hand-drawn ellipse in accent */}
            <div
              className="scrap"
              style={{ left: 318, top: 96, width: 190, height: 70, transform: "rotate(-5.2deg)", zIndex: 18 }}
            >
              <svg width="190" height="70" style={{ position: "absolute", inset: 0 }}>
                <ellipse
                  cx="95"
                  cy="36"
                  rx="84"
                  ry="27"
                  fill="none"
                  stroke={C.accentHi}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="0"
                  transform="rotate(-2 95 36)"
                  style={{ filter: "none" }}
                />
              </svg>
              <span
                className="vb-sans"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 800,
                  color: C.fg0,
                  letterSpacing: "-.01em",
                }}
              >
                cohesive
              </span>
            </div>

            {/* "dense but calm" — taped torn slip */}
            <div
              className="scrap vb-mono"
              style={{
                left: 1192,
                top: 622,
                width: 156,
                padding: "8px 10px",
                background: C.bg3,
                border: `1px solid ${C.hair}`,
                color: C.fg0,
                fontSize: 13,
                fontWeight: 600,
                transform: "rotate(4.8deg)",
                clipPath: TORN.c,
                boxShadow: "0 8px 18px rgba(0,0,0,.5)",
                zIndex: 17,
              }}
            >
              <Tape w={60} h={20} rot={-10} left="30%" top={-9} />
              dense&nbsp;but&nbsp;calm
            </div>

            {/* "GPU-crisp" — small accent slip */}
            <div
              className="scrap vb-mono"
              style={{
                left: 388,
                top: 624,
                width: 118,
                padding: "6px 10px",
                background: C.accentDim,
                border: `1px solid ${C.accent}`,
                color: C.accentHi,
                fontSize: 12,
                fontWeight: 700,
                transform: "rotate(-3.4deg)",
                boxShadow: "0 8px 16px rgba(0,0,0,.45)",
                zIndex: 17,
              }}
            >
              GPU-crisp · 1px
            </div>

            {/* "pro studio" — big handwritten margin word, bottom-left */}
            <div
              className="vb-hand scrap"
              style={{
                left: 70,
                top: 1086,
                fontSize: 34,
                fontWeight: 700,
                color: C.fg1,
                transform: "rotate(-4deg)",
                zIndex: 16,
              }}
            >
              pro studio.
              <svg width="180" height="20" style={{ position: "absolute", left: 4, top: 40 }}>
                <path
                  d="M4 12 C 44 4, 96 16, 168 6"
                  fill="none"
                  stroke={C.accent}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* "preciznost / klid / originalita" — small brand-value mono slip */}
            <div
              className="scrap vb-mono"
              style={{
                left: 286,
                top: 1004,
                width: 168,
                padding: "8px 11px",
                background: C.bg2,
                border: `1px solid ${C.hair}`,
                borderTop: `2px solid ${C.green}`,
                color: C.fg1,
                fontSize: 10.5,
                lineHeight: 1.7,
                transform: "rotate(2.3deg)",
                boxShadow: "0 9px 20px rgba(0,0,0,.45)",
                zIndex: 14,
              }}
            >
              <span style={{ color: C.fg3 }}>brand values →</span>
              <br />
              řemeslnost · preciznost
              <br />
              klid · originalita
            </div>

            {/* ════════════════ ANTI-REFERENCE ════════════════════════ */}
            {/* circled "NE: bolted-on panels →" with strikethrough mock */}
            <div
              className="scrap"
              style={{
                left: 1166,
                top: 1036,
                width: 290,
                height: 120,
                transform: "rotate(3.2deg)",
                zIndex: 19,
              }}
            >
              {/* a tiny "wrong" mock: editor + mismatched bolted-on panel */}
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: 18,
                  width: 150,
                  height: 84,
                  display: "flex",
                  borderRadius: 5,
                  overflow: "hidden",
                  filter: "saturate(.5)",
                  opacity: 0.78,
                }}
              >
                <span style={{ flex: 1, background: "#0d0f13" }} />
                {/* mismatched bolted-on panel: different radius, different hairline, wrong color */}
                <span
                  style={{
                    width: 52,
                    background: "#2a2118",
                    border: "2px dashed #b9842f",
                    borderRadius: "0 12px 12px 0",
                    boxShadow: "inset 0 0 8px #0008",
                  }}
                />
              </div>
              {/* hand-drawn cross-out + circle */}
              <svg width="290" height="120" style={{ position: "absolute", inset: 0 }}>
                <ellipse
                  cx="82"
                  cy="60"
                  rx="78"
                  ry="48"
                  fill="none"
                  stroke="#ff5a52"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  transform="rotate(-4 82 60)"
                />
                <path d="M22 26 L 150 96" stroke="#ff5a52" strokeWidth="2.5" strokeLinecap="round" />
                <path
                  d="M168 56 C 196 50, 220 54, 250 52"
                  fill="none"
                  stroke="#ff5a52"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path d="M250 52 L 240 46 M250 52 L 240 60" stroke="#ff5a52" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
              <span
                className="vb-hand"
                style={{
                  position: "absolute",
                  right: 0,
                  top: 36,
                  width: 120,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#ff7b73",
                  lineHeight: 1.15,
                  transform: "rotate(-2deg)",
                }}
              >
                NE: bolted-on panels →
              </span>
            </div>

            {/* small anti-ref slips: toolbar soup + busy gradients */}
            <div
              className="scrap vb-mono"
              style={{
                left: 1006,
                top: 1118,
                width: 150,
                padding: "5px 9px",
                background: "#241412",
                border: "1px solid #5a2420",
                color: "#ff8e85",
                fontSize: 9.5,
                transform: "rotate(-5.6deg)",
                zIndex: 18,
                boxShadow: "0 6px 14px rgba(0,0,0,.5)",
              }}
            >
              ✕ toolbar soup · busy gradients
            </div>

            {/* hairline spec slip — GPU-sharp note, mono, tabular */}
            <div
              className="scrap vb-mono"
              style={{
                left: 60,
                top: 916,
                width: 250,
                padding: "10px 12px",
                background: C.bg1,
                border: `1px solid ${C.hair}`,
                borderRadius: 7,
                transform: "rotate(-1.8deg)",
                color: C.fg1,
                fontSize: 10,
                lineHeight: 1.7,
                zIndex: 12,
                boxShadow: "0 10px 22px rgba(0,0,0,.5)",
              }}
            >
              <span style={{ color: C.fg2, fontSize: 8.5, letterSpacing: ".12em" }}>
                MATERIAL TOKENS
              </span>
              <br />
              hairline <span style={{ color: C.accentHi }}>1px</span> · no blur
              <br />
              radius <span style={{ color: C.accentHi }}>6/8/10</span> px · shared
              <br />
              elev <span style={{ color: C.accentHi }}>bg0→4</span> · 4 steps
              <br />
              num <span style={{ color: C.green }}>tabular-nums</span>
            </div>

            {/* a clean machine-cut swatch among the torn ones (authenticity) */}
            <div
              className="scrap"
              style={{
                left: 408,
                top: 470,
                width: 44,
                height: 132,
                transform: "rotate(2.1deg)",
                zIndex: 10,
                boxShadow: "0 8px 16px rgba(0,0,0,.5)",
              }}
            >
              <Pin color={C.fg2} left="50%" top={-6} />
              {[C.fg0, C.fg1, C.fg2, C.fg3].map((c, i) => (
                <div
                  key={i}
                  style={{
                    height: 33,
                    background: c,
                    borderBottom: i < 3 ? "1px solid #0006" : "none",
                  }}
                />
              ))}
              <div
                className="vb-mono"
                style={{ fontSize: 6.5, color: C.fg2, textAlign: "center", marginTop: 2 }}
              >
                fg0→3
              </div>
            </div>

            {/* light-theme reminder slip — secondary theme exists */}
            <div
              className="scrap vb-mono"
              style={{
                left: 800,
                top: 1110,
                width: 168,
                padding: "8px 10px",
                background: "#f4f1ea",
                color: "#2b2723",
                border: "1px solid #00000022",
                fontSize: 9.5,
                transform: "rotate(3.6deg)",
                zIndex: 13,
                boxShadow: "0 10px 22px rgba(0,0,0,.5)",
              }}
            >
              <Tape w={56} h={18} rot={9} left="74%" top={-8} blue />
              <span style={{ color: "#7a7464" }}>secondary →</span> light theme,
              same material, hairlines hold
            </div>

            {/* connector arrow: hero canvas → handoff slip (scrap→scrap) */}
            <svg
              width="160"
              height="120"
              style={{ position: "absolute", left: 360, top: 600, zIndex: 6, pointerEvents: "none" }}
            >
              <path
                d="M150 12 C 96 34, 70 70, 26 104"
                fill="none"
                stroke={C.fg3}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="1 7"
              />
            </svg>

          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
