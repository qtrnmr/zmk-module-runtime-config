# Runtime macro example

Define a runtime-macro behavior and place it on a key:

```dts
/ {
    behaviors {
        rt_macro: rt_macro {
            compatible = "zmk,behavior-runtime-macro";
            #binding-cells = <1>;
        };
    };
};
```
Put `&rt_macro 0` on a key in your keymap (slot 0). Then set its content from the CLI.
Steps are separated by `|`; within a step, `type <text>`, `wait <ms>` (adds to the
previous step), or a chord like `C-c` / `C-S-z` / `A-G-a`:
```bash
zmkrt macro set 0 "type hello"            # types "hello"
zmkrt macro set 0 "C-c"                    # Ctrl+C
zmkrt macro set 0 "type hi | wait 200 | C-S-z"   # type "hi", wait 200ms, then Ctrl+Shift+Z
zmkrt macro get 0
```
Slots: `CONFIG_ZMK_RUNTIME_MACRO_SLOTS` (default 1), steps per macro:
`CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS` (default 32).
