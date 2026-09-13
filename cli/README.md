# zmk-runtime-cli

CLI for editing ZMK runtime-config features (macros, hold-tap, conditional layers, combos, trackball, encoder) over a custom Studio RPC, without reflashing.

## Requirements

Your keyboard must be flashed with firmware built using `zmk-module-runtime-config`. For trackball support (`zmkrt trackball`), enable the cormoran module `zmk-module-runtime-input-processor`. For encoder support (`zmkrt encoder`), enable `zmk-behavior-runtime-sensor-rotate`. Both are from the `cormoran` remote, pinned to tag `zmk-v0.3.0.0`.

## Install

From the `cli/` directory:

```bash
pipx install .
```

Or for development:

```bash
pip install -e .
```

### zmk-studio-api source-build caveat

The PyPI build of `zmk-studio-api` may lack serial/BLE support on some platforms (notably macOS). During development, a source build from the upstream repository was used. If you encounter connection issues, build and install `zmk-studio-api` from source instead of using the PyPI package.

## Usage

The `zmkrt` command provides the following command groups:

- `info` — Show device/lock/keymap summary
- `key` — Per-key get/set operations (`get <layer> <position>` ; `set <layer> <position> "<behavior>"`)
- `layer` — Layer management: `list` / `rename` / `add` / `remove` / `move` / `restore`
- `macro` — Runtime macro get/set: `get <slot>` ; `set <slot> "<dsl>"` (DSL steps separated by `|`, e.g. `"type hi | wait 200 | C-S-z"`)
- `holdtap` — Hold-tap timing: `list` / `get` / `set` / `reset`
- `condlayer` — Conditional-layer entries: `list` / `get` / `set` / `reset`
- `combo` — Combo management: `list` / `get` / `set` / `reset`
- `encoder` — Encoder bindings: `sensors` / `get` / `set` / `reset` / `behaviors` (requires `zmk-behavior-runtime-sensor-rotate`)
- `trackball` — Trackball config: `get` / `set` / `reset` (requires `zmk-module-runtime-input-processor`)
- `reset` — Reset all settings to devicetree defaults
- `snapshot [path]` — Save raw keymap bytes to a file (record-only; not a lock/unlock operation)
- `ui` — Open the browser UI (local HTTP server; see below)

### Browser UI

`zmkrt ui` starts a local server on http://127.0.0.1:8760 and opens your browser. The server holds the
USB serial port while running, so other `zmkrt` commands must wait until you stop it (Ctrl-C).
Every change is logged to `.zmkrt-backup.jsonl`; a keymap snapshot is written on start.

Tabs, one per runtime-editable feature:

| Tab | Edits |
|---|---|
| キーマップ | Key bindings on the physical layout, plus layer add/rename/move/remove/restore |
| マクロ | Macro slots: a step table (tap/press/release, keycode, wait, tap) and a DSL import |
| Hold-tap | `tapping-term-ms`, `quick-tap-ms`, `require-prior-idle-ms`, flavor per slot |
| 条件レイヤー | if-layers / then-layer per entry |
| コンボ | Binding, timeout, prior-idle, active layers, slow-release (hovering a row lights its keys) |
| エンコーダ | cw / ccw binding and `tap_ms` per sensor and layer |
| トラックボール | Every input-processor field (scale, rotation, invert, axis-snap, temp-layer) |

A tab whose custom RPC subsystem the keyboard does not ship says so instead of showing a form.
Counts that are fixed at build time — macro slots, hold-tap and conditional-layer slots, combo
key-positions — are read-only, with the reason shown.

```bash
zmkrt ui                 # open http://127.0.0.1:8760 in the browser
zmkrt ui --no-open       # start the server only (for `pnpm dev` in cli/ui)
zmkrt ui --http-port 9000
```

### Port detection

The CLI auto-detects the keyboard's USB serial port (e.g., `/dev/cu.usbmodem*` on macOS, `/dev/ttyACM*` on Linux). Use `--port <path>` to override.

### Examples

```bash
# Show device info
zmkrt info

# Get macro at slot 0
zmkrt macro get 0

# Set macro at slot 0 using DSL
zmkrt macro set 0 "type hello | wait 50 | C-c"

# Set a key binding (layer 0, position 1, behavior as one quoted arg)
zmkrt key set 0 1 "KP A"

# List hold-tap slots
zmkrt holdtap list

# Save a raw keymap snapshot (record-only)
zmkrt snapshot mykeymap.bin
```

## Development

Run tests:

```bash
pytest
```

## License

See the parent repository for license information.
