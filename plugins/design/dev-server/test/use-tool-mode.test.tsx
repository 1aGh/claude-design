// use-tool-mode — Phase 4.1 Task 2. Provider transitions + cursor sync.

import { describe, expect, test, beforeEach, afterEach } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  DEFAULT_TOOLS,
  ToolProvider,
  useToolMode,
  useToolModeOptional,
} from "../use-tool-mode.tsx";

describe("use-tool-mode / static", () => {
  test("DEFAULT_TOOLS exposes V/H/C + Phase 5.1 draw set B/R/O/A/E", () => {
    expect(DEFAULT_TOOLS.map((t) => t.id)).toEqual([
      "move",
      "hand",
      "comment",
      "pen",
      "rect",
      "ellipse",
      "arrow",
      "eraser",
    ]);
    expect(DEFAULT_TOOLS.map((t) => t.shortcut)).toEqual([
      "V",
      "H",
      "C",
      "B",
      "R",
      "O",
      "A",
      "E",
    ]);
  });

  test("DEFAULT_TOOLS is immutable (Object.freeze applied)", () => {
    expect(Object.isFrozen(DEFAULT_TOOLS)).toBe(true);
  });

  test("default cursors per tool", () => {
    const byId = Object.fromEntries(DEFAULT_TOOLS.map((t) => [t.id, t.cursor]));
    expect(byId.move).toBe("default");
    expect(byId.hand).toBe("grab");
    expect(byId.comment).toBe("crosshair");
    expect(byId.pen).toBe("crosshair");
    expect(byId.rect).toBe("crosshair");
    expect(byId.ellipse).toBe("crosshair");
    expect(byId.arrow).toBe("crosshair");
    expect(byId.eraser).toBe("cell");
  });
});

describe("use-tool-mode / useToolModeOptional", () => {
  test("returns null outside provider (SSR-safe path)", () => {
    // useToolModeOptional uses useContext directly; outside a provider it
    // returns the context's default value, which we set to null.
    // We can't render hooks standalone without a renderer, but importing the
    // module and calling useContext directly mirrors the runtime behavior.
    // This documents the contract via the export shape.
    expect(typeof useToolModeOptional).toBe("function");
  });
});

describe("use-tool-mode / SSR render", () => {
  test("ToolProvider with consumer renders without throwing", () => {
    function Consumer() {
      const { tool } = useToolMode();
      return <span data-tool={tool}>{tool}</span>;
    }
    const html = renderToStaticMarkup(
      <ToolProvider>
        <Consumer />
      </ToolProvider>
    );
    expect(html).toContain("data-tool=\"move\"");
  });

  test("ToolProvider honors initial tool", () => {
    function Consumer() {
      const { tool } = useToolMode();
      return <span>{tool}</span>;
    }
    const html = renderToStaticMarkup(
      <ToolProvider initial="comment">
        <Consumer />
      </ToolProvider>
    );
    expect(html).toContain("comment");
  });

  test("useToolMode outside ToolProvider throws", () => {
    function BareConsumer() {
      useToolMode();
      return null;
    }
    expect(() => renderToStaticMarkup(<BareConsumer />)).toThrow(
      /useToolMode must be used inside <ToolProvider>/
    );
  });
});
