import { it, expect } from "vitest";
import { splitMods, joinMods, curatedOrder, defaultParam } from "./params";
import type { Behavior, ParamDesc } from "./types";

it("splits and joins modifier bits", () => {
  expect(splitMods((8 << 24) | 0x7002b)).toEqual({ base: 0x7002b, mods: ["LG"] });
  expect(joinMods(0x7001d, ["LC", "LS"])).toBe((3 << 24) | 0x7001d);
  expect(splitMods(0x70004)).toEqual({ base: 0x70004, mods: [] });
});

it("orders curated behaviors first, then the rest alphabetically", () => {
  const bs = [
    { display_name: "Zeta" },
    { display_name: "Transparent" },
    { display_name: "Key Press" },
  ] as Behavior[];
  const out = curatedOrder(bs).map((b) => b.display_name);
  expect(out[0]).toBe("Key Press");
  expect(out[out.length - 1]).toBe("Zeta");
});

it("derives a default value per parameter kind", () => {
  expect(defaultParam([{ type: "range", min: 2, max: 7, name: "Slot" }] as ParamDesc[], [], {})).toBe(2);
  expect(defaultParam([{ type: "constant", value: 4, name: "C" }] as ParamDesc[], [], {})).toBe(4);
  expect(defaultParam([{ type: "hid_usage", name: "Key", keyboard_max: 255, consumer_max: 1024 }] as ParamDesc[], [], { A: 0x70004 })).toBe(0x70004);
  expect(defaultParam([{ type: "layer_id", name: "Layer" }] as ParamDesc[], [], {})).toBe(0);
  expect(defaultParam([], [], {})).toBe(0);
});
