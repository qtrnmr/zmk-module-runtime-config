# Runtime combos example

Switch your `combos` node to the runtime compatible. **key-positions are fixed
at build time** — only the binding/timeout/layers/require-prior-idle/slow-release
are runtime-editable:

```dts
/ {
    combos {
        compatible = "zmk,runtime-combos";
        combo_esc {
            timeout-ms = <50>;
            key-positions = <0 1>;
            bindings = <&kp ESC>;
        };
    };
};
```
Edit at runtime (combos are addressed by their module index — `list` maps index
→ key_positions):
```bash
zmkrt combo list
zmkrt combo set 0 binding "kp ESC"
zmkrt combo set 0 timeout-ms 40
zmkrt combo reset 0
```
Capacity: `CONFIG_ZMK_RUNTIME_COMBOS_MAX` (default 16).
