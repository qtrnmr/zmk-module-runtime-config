import { it, expect } from "vitest";
import { pretty } from "./prettyKeycode";

it("prettifies", () => {
  expect(pretty("LCTRL")).toBe("Ctrl");
  expect(pretty("N1")).toBe("1");
  expect(pretty("KP_N7")).toBe("KP7");
  expect(pretty("LG(TAB)")).toBe("⌘⇥");
  expect(pretty("LC(LS(Z))")).toBe("^⇧Z");
  expect(pretty("WHATEVER")).toBe("WHATEVER");
  expect(pretty("▽")).toBe("▽");
});

// Names actually observed in GET /api/state on a real roBa: zmk_studio_api's
// Keycode enum uses the SHORTEST alias, which is often not the ZMK doc spelling.
it("prettifies the aliases the device really reports", () => {
  expect(pretty("NUM_1")).toBe("1");
  expect(pretty("CMMA")).toBe(",");
  expect(pretty("SEMI")).toBe(";");
  expect(pretty("APOSTROPHE")).toBe("'");
  expect(pretty("FSLH")).toBe("/");
  expect(pretty("EQL")).toBe("=");
  expect(pretty("SPC")).toBe("␣");
  expect(pretty("UARW")).toBe("↑");
  expect(pretty("LEFT_META")).toBe("Gui");
  expect(pretty("LANGUAGE_1")).toBe("かな");
  expect(pretty("LANGUAGE_2")).toBe("英数");
  expect(pretty("K_MUTE")).toBe("Mute");
  expect(pretty("LS(NUM_1)")).toBe("⇧1");
});
