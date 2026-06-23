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

### Held chords (press / release)

`press <key>` holds a key down; `release <key>` lets it up; `tap <key>` is a
single press+release. Use these to build chords where one key stays held while
another is tapped — e.g. iOS/iPadOS Globe (🌐) shortcuts:

```bash
# switch to the previous app (Globe + Left):
zmkrt macro set 0 "press GLOBE | wait 80 | press LEFT  | wait 120 | release LEFT  | wait 40 | release GLOBE"
# switch to the next app (Globe + Right):
zmkrt macro set 0 "press GLOBE | wait 80 | press RIGHT | wait 120 | release RIGHT | wait 40 | release GLOBE"
# App Switcher (Globe + Up):
zmkrt macro set 0 "press GLOBE | wait 80 | press UP    | wait 120 | release UP    | wait 40 | release GLOBE"
# Control Center (Globe + C):
zmkrt macro set 0 "press GLOBE | wait 80 | press c     | wait 120 | release c     | wait 40 | release GLOBE"
```

> **Timing matters over BLE.** A 0 ms tap (`tap <key>`, or `type`'s per-character
> taps) can be too fast to register over a Bluetooth connection (the host polls
> on a 7.5–30 ms interval), so press and release collapse into one report and
> nothing happens — the same macro works over USB (1 ms polling). For chords, and
> for any macro you drive over BLE, give each key a **real hold duration** with
> explicit `press | wait N | release` instead of `tap`. The host receiving the
> shortcut also needs the modifier (here Globe) held long enough to arm; ~80 ms
> before the chord key and ~120 ms holding it is a reliable starting point — tune
> from there.

Named keys: `GLOBE`, `LEFT`, `RIGHT`, `UP`, `DOWN` (plus single characters,
`C-S-x` modifier forms, and raw `0x..`/decimal keycodes). `wait N` adds `N` ms
to the *previous* step. Every `press` must have a matching `release`; the CLI
rejects an unbalanced macro unless you pass `--allow-unbalanced`.
