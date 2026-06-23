# zmk-runtime-cli

CLI for editing ZMK runtime-config features (macros, hold-tap, conditional layers, combos, trackball, encoder) over a custom Studio RPC, without reflashing.

## Requirements

Your keyboard must be flashed with firmware built using `zmk-module-runtime-config`. For trackball and encoder support, the cormoran companion modules (`zmk-cormoran-input-processor` for trackball, `zmk-cormoran-encoder` for encoder) must also be enabled.

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
- `key` — Per-key get/set operations
- `layer` — Layer list/rename operations
- `macro` — Macro list/add/edit/delete/rename
- `holdtap` — Hold-tap list/set operations
- `condlayer` — Conditional-layer list/add/delete/rename
- `combo` — Combo list/add/edit/delete/rename
- `encoder` — Encoder list/behaviors/set operations (requires `zmk-cormoran-encoder`)
- `trackball` — Trackball config/snapping/scroll operations (requires `zmk-cormoran-input-processor`)
- `reset` — Reset subsystem to defaults
- `snapshot` — Lock/unlock Studio

### Port detection

The CLI auto-detects the keyboard's USB serial port (e.g., `/dev/cu.usbmodem*` on macOS, `/dev/ttyACM*` on Linux). Use `--port <path>` to override.

### Examples

```bash
# Show device info
zmkrt info

# List macros
zmkrt macro list

# Add a macro
zmkrt macro add my_macro 'hello world'

# Set a key binding
zmkrt key set 0 1 2 kp A

# List hold-tap settings
zmkrt holdtap list

# Lock Studio (disable GUI editing)
zmkrt snapshot lock
```

## Development

Run tests:

```bash
pytest
```

## License

See the parent repository for license information.
