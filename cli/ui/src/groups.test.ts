import { describe, expect, it } from "vitest";
import { colorOf, groupLayers, groupOf, moveLayer, nextColor } from "./groups";
import type { Layer, LayerGroup } from "./types";

const L = (index: number, id: number, name = `L${index}`): Layer =>
  ({ index, id, name, bindings: [] });

/** ids deliberately unlike the indices: groups key on id, the card sorts on index. */
const LAYERS = [L(0, 0, "DEFAULT"), L(1, 7, "APPLE"), L(2, 3, "ANDROID"), L(3, 9, "APPLE_NUM")];

const GROUPS: LayerGroup[] = [
  { id: "apple", name: "Apple", color: "sky", layers: [9, 7] },
  { id: "windows", name: "Windows", color: "violet", layers: [0] },
];

const shape = (secs: ReturnType<typeof groupLayers>) =>
  secs.map((s) => [s.group?.id ?? null, s.layers.map((l) => l.index)]);

describe("groupLayers", () => {
  it("keeps group order but sorts each group by board index", () => {
    expect(shape(groupLayers(LAYERS, GROUPS))).toEqual([
      ["apple", [1, 3]], // stored as [9, 7]; shown 1 then 3
      ["windows", [0]],
      [null, [2]],
    ]);
  });

  it("gathers everything else into a trailing ungrouped section", () => {
    const [, , rest] = groupLayers(LAYERS, GROUPS);
    expect(rest.group).toBeNull();
    expect(rest.layers.map((l) => l.name)).toEqual(["ANDROID"]);
  });

  it("is one flat ungrouped section when there are no groups", () => {
    expect(shape(groupLayers(LAYERS, []))).toEqual([[null, [0, 1, 2, 3]]]);
  });

  it("still emits the ungrouped section when every layer is grouped", () => {
    const all: LayerGroup[] = [{ id: "a", name: "A", color: "sky", layers: [0, 7, 3, 9] }];
    expect(shape(groupLayers(LAYERS, all))).toEqual([
      ["a", [0, 1, 2, 3]],
      [null, []],
    ]);
  });

  it("ignores ids no live layer has, so a removed layer just vanishes", () => {
    const g: LayerGroup[] = [{ id: "apple", name: "Apple", color: "sky", layers: [7, 404] }];
    expect(shape(groupLayers(LAYERS, g))).toEqual([
      ["apple", [1]],
      [null, [0, 2, 3]],
    ]);
  });

  it("gives a doubly-claimed layer to the first group only", () => {
    const g: LayerGroup[] = [
      { id: "a", name: "A", color: "sky", layers: [7] },
      { id: "b", name: "B", color: "rose", layers: [7, 3] },
    ];
    expect(shape(groupLayers(LAYERS, g))).toEqual([
      ["a", [1]],
      ["b", [2]],
      [null, [0, 3]],
    ]);
  });

  it("shows an empty group as an empty section rather than dropping it", () => {
    const g: LayerGroup[] = [{ id: "new", name: "New", color: "amber", layers: [] }];
    expect(shape(groupLayers(LAYERS, g))).toEqual([
      ["new", []],
      [null, [0, 1, 2, 3]],
    ]);
  });
});

describe("groupOf / colorOf", () => {
  it("finds the owning group by layer id", () => {
    expect(groupOf(GROUPS, 7)?.name).toBe("Apple");
    expect(groupOf(GROUPS, 0)?.name).toBe("Windows");
    expect(groupOf(GROUPS, 3)).toBeNull();
  });

  it("colours ungrouped layers zinc", () => {
    expect(colorOf(GROUPS, 9)).toBe("sky");
    expect(colorOf(GROUPS, 3)).toBe("zinc");
    expect(colorOf([], 0)).toBe("zinc");
  });
});

describe("moveLayer", () => {
  it("moves a layer between groups without leaving it in the old one", () => {
    const next = moveLayer(GROUPS, 7, "windows");
    expect(next.map((g) => g.layers)).toEqual([[9], [0, 7]]);
  });

  it("drops a layer back to 共通 with a null target", () => {
    expect(moveLayer(GROUPS, 9, null).map((g) => g.layers)).toEqual([[7], [0]]);
  });

  it("adds an ungrouped layer to a group", () => {
    expect(moveLayer(GROUPS, 3, "apple").map((g) => g.layers)).toEqual([[9, 7, 3], [0]]);
  });

  it("leaves the array alone when the layer is already there", () => {
    expect(moveLayer(GROUPS, 0, "windows").map((g) => g.layers)).toEqual([[9, 7], [0]]);
  });
});

describe("nextColor", () => {
  it("picks the first colour no group is using", () => {
    expect(nextColor([])).toBe("sky");
    expect(nextColor(GROUPS)).toBe("emerald");
  });

  it("wraps once the palette is exhausted", () => {
    const many: LayerGroup[] = ["sky", "emerald", "amber", "violet", "rose", "orange"].map(
      (color, i) => ({ id: `g${i}`, name: `G${i}`, color, layers: [] }) as LayerGroup,
    );
    expect(nextColor(many)).toBe("sky");
  });
});
