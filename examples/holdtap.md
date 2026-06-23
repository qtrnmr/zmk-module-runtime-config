# Runtime hold-tap example

Convert a hold-tap behavior to the runtime variant (logic identical; timing is
NVS-editable):

```dts
/ {
    behaviors {
        lt_runtime: lt_runtime {
            compatible = "zmk,behavior-runtime-hold-tap";
            label = "LT_RUNTIME";
            bindings = <&mo>, <&kp>;
            #binding-cells = <2>;
            tapping-term-ms = <200>;
        };
    };
};
```
Use it like any hold-tap (e.g. `&lt_runtime 1 ESC`). Edit timing at runtime:
```bash
zmkrt holdtap list
zmkrt holdtap set 0 tapping-term-ms 180
zmkrt holdtap set 0 flavor balanced
zmkrt holdtap reset 0
```
Slots: `CONFIG_ZMK_RUNTIME_HOLDTAP_SLOTS` (default 8). Slot index follows the
order of the runtime hold-tap instances; `list` shows each slot's current values.
