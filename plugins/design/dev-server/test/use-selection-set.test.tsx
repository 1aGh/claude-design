// use-selection-set — Phase 4.1 Task 3. Set semantics + wire-shape helpers.

import { describe, expect, test } from "bun:test";

import {
  denormalizeSelectedWrite,
  normalizeSelectedRead,
  type Selection,
} from "../use-selection-set.tsx";

const mkSel = (over: Partial<Selection> = {}): Selection => ({
  selector: "section:nth-child(1) > div",
  ...over,
});

describe("use-selection-set / normalizeSelectedRead", () => {
  test("null → []", () => {
    expect(normalizeSelectedRead(null)).toEqual([]);
    expect(normalizeSelectedRead(undefined)).toEqual([]);
  });

  test("single object → length-1 array", () => {
    const s = mkSel({ id: "cd-a" });
    expect(normalizeSelectedRead(s)).toEqual([s]);
  });

  test("array passes through", () => {
    const a = mkSel({ id: "cd-a" });
    const b = mkSel({ id: "cd-b" });
    expect(normalizeSelectedRead([a, b])).toEqual([a, b]);
  });

  test("array dedupe by data-cd-id", () => {
    const a = mkSel({ id: "cd-a" });
    const aDup = mkSel({ id: "cd-a", text: "should be dropped" });
    expect(normalizeSelectedRead([a, aDup])).toEqual([a]);
  });

  test("array dedupe by selector when no id", () => {
    const a = mkSel({ selector: ".card:nth-child(1)" });
    const b = mkSel({ selector: ".card:nth-child(1)" });
    expect(normalizeSelectedRead([a, b])).toEqual([a]);
  });

  test("mixed id / selector keys don't collide", () => {
    const byId = mkSel({ id: "cd-a", selector: ".x" });
    const bySel = mkSel({ selector: "cd-a" }); // no id, selector happens to be 'cd-a'
    expect(normalizeSelectedRead([byId, bySel])).toEqual([byId, bySel]);
  });
});

describe("use-selection-set / denormalizeSelectedWrite", () => {
  test("empty → null", () => {
    expect(denormalizeSelectedWrite([])).toBeNull();
  });

  test("length-1 → bare object (back-compat with legacy single-element shape)", () => {
    const s = mkSel({ id: "cd-a" });
    expect(denormalizeSelectedWrite([s])).toBe(s);
  });

  test("length>1 → array", () => {
    const a = mkSel({ id: "cd-a" });
    const b = mkSel({ id: "cd-b" });
    expect(denormalizeSelectedWrite([a, b])).toEqual([a, b]);
  });
});

describe("use-selection-set / round trip read-write", () => {
  test("legacy single-element shape → array of 1 → back to single-element", () => {
    const legacy = mkSel({ id: "cd-a" });
    const arr = normalizeSelectedRead(legacy);
    expect(arr).toEqual([legacy]);
    expect(denormalizeSelectedWrite(arr)).toBe(legacy);
  });

  test("null round-trips as null", () => {
    expect(denormalizeSelectedWrite(normalizeSelectedRead(null))).toBeNull();
  });
});

describe("use-selection-set / inspect.ts setSelected widening (integration)", () => {
  test("inspect.setSelected accepts array and collapses single-entry to object", async () => {
    // Spin up createInspect with a real on-disk active file in a tmp dir.
    const { createInspect } = await import("../inspect.ts");
    const { createBus } = await import("../context.ts");
    const tmp = `/tmp/use-selection-set-${Date.now()}`;
    await Bun.write(`${tmp}/.design/.keep`, "");
    const ctx: Parameters<typeof createInspect>[0] = {
      cfg: {} as never,
      projectLabel: "",
      paths: {
        designRoot: `${tmp}/.design`,
        designRel: ".design",
        activeFile: `${tmp}/.design/_active.json`,
        serverFile: `${tmp}/.design/_server.json`,
        historyRoot: `${tmp}/.design/_history`,
        commentsRoot: `${tmp}/.design/_comments`,
        cwd: tmp,
      } as never,
      bus: createBus(),
    };
    const insp = createInspect(ctx, async () => []);

    insp.setSelected({
      file: ".design/ui/Foo.tsx",
      selector: ".x",
      tag: "div",
      classes: "",
      text: "",
      dom_path: [],
      bounds: null,
      html: "",
      id: "cd-a",
    });
    expect(Array.isArray(insp.state.selected)).toBe(false);
    expect((insp.state.selected as { id?: string } | null)?.id).toBe("cd-a");

    insp.setSelected([
      {
        file: ".design/ui/Foo.tsx",
        selector: ".a",
        tag: "div",
        classes: "",
        text: "",
        dom_path: [],
        bounds: null,
        html: "",
        id: "cd-a",
      },
      {
        file: ".design/ui/Foo.tsx",
        selector: ".b",
        tag: "div",
        classes: "",
        text: "",
        dom_path: [],
        bounds: null,
        html: "",
        id: "cd-b",
      },
    ]);
    expect(Array.isArray(insp.state.selected)).toBe(true);
    expect((insp.state.selected as unknown[]).length).toBe(2);

    // Single-entry array → object collapse
    insp.setSelected([
      {
        file: ".design/ui/Foo.tsx",
        selector: ".only",
        tag: "div",
        classes: "",
        text: "",
        dom_path: [],
        bounds: null,
        html: "",
        id: "cd-only",
      },
    ]);
    expect(Array.isArray(insp.state.selected)).toBe(false);
    expect((insp.state.selected as { id?: string } | null)?.id).toBe("cd-only");

    insp.setSelected(null);
    expect(insp.state.selected).toBeNull();
  });
});
