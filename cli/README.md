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

The keyboard drawing *is* the page. The icon rail on the left switches between four pages:

| Page | Edits |
|---|---|
| キーマップ | The board itself: key bindings, hold-tap timing, combos, the encoder, plus layer add/rename/move/remove/restore |
| マクロ | Macro slots: a step table (tap/press/release, keycode, wait, tap) and a DSL import |
| 条件レイヤー | if-layers / then-layer per entry |
| トラックボール | Every input-processor field (scale, rotation, invert, axis-snap, temp-layer) |

On the キーマップ page everything is edited on the board, through an inspector that slides in from
the right (`Esc` closes it):

- **Layer chips** above the board: click to switch, double-click to rename, drag to reorder, `×` to
  remove, `+` to add. A removed layer comes back as a dashed 復元 chip.
- **Click a key** → its binding form, the hold-tap timing when the key is a runtime hold-tap
  (`&mt` / `&lt` are stock behaviors and say so instead), and the same position on every other
  layer — click a row there to follow the key across layers.
- **Combos** are drawn as amber links between the keys they listen on, with a pill showing what the
  combo actually does. Click the pill to edit binding / timeout / prior-idle / active layers /
  slow-release. The コンボ表示 toggle at the right of the chip row hides them (remembered per browser).
- **The encoder knob** shows its `↻` / `↺` bindings for the current layer; click it to edit them.
- **The trackball** opens its page.
- The rail's `…` menu holds 変更履歴 / スナップショット / リセット… (and エンコーダ on a layout whose
  knob is not drawn).

A feature whose custom RPC subsystem the keyboard does not ship says so instead of showing a form.
Counts that are fixed at build time — macro slots, hold-tap and conditional-layer slots, combo
key-positions — are read-only, with the reason shown.

For API users: `GET /api/features` takes an optional `?only=macros,holdtaps,condlayers,combos,encoder,trackball`
to collect just those features (an unknown name is a 400). The UI uses it so one edit costs a couple
of serial round trips instead of the ~40 a full document takes.

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
