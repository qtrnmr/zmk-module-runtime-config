# Installing zmk-module-runtime-config

A zero-to-working guide. Follow each section in order.

---

## 1. Prerequisite — cormoran ZMK base

This module requires a ZMK base that provides the **custom Studio RPC layer**
(`app/include/zmk/studio/custom.h`, `ZMK_RPC_CUSTOM_SUBSYSTEM`). Mainline ZMK
does not include this.

**How to tell you have the right base:** the file
`app/include/zmk/studio/custom.h` exists in your ZMK workspace. If it is
absent, your base is mainline ZMK and this module will not build.

The tested base is **cormoran's ZMK fork** at revision `v0.3-branch+dya`.

---

## 2. `west.yml` — manifest fragment

Add the following to your keyboard config's `west.yml`. If you already have a
`zmk` project entry, replace or merge it — do not duplicate it.

```yaml
manifest:
  remotes:
    - name: cormoran
      url-base: https://github.com/cormoran
    - name: qtrnmr          # remote name is arbitrary; referenced in projects below
      url-base: https://github.com/qtrnmr
  projects:
    - name: zmk
      remote: cormoran
      revision: v0.3-branch+dya   # cormoran fork — provides custom Studio RPC
      import: app/west.yml
    - name: zmk-module-runtime-config
      remote: qtrnmr
      revision: main
    # optional companions (trackball / encoder) — omit if you do not use them:
    - name: zmk-module-runtime-input-processor   # trackball runtime
      remote: cormoran
      revision: zmk-v0.3.0.0   # pin keeps the 1-arg API + full custom-RPC surface
    - name: zmk-behavior-runtime-sensor-rotate   # encoder runtime
      remote: cormoran
      revision: zmk-v0.3.0.0
```

> **Why pin companions to `zmk-v0.3.0.0`?** This tag matches the cormoran base
> revision and preserves the single-argument `get` API and the full
> custom-RPC surface. Unpinned versions may have breaking API changes.

After editing `west.yml`, run:

```bash
west update
```

---

## 3. `<shield>.conf` — required and per-feature config

Add the following blocks to your shield (or board) `.conf` file.

### Required (Studio transport)

```conf
# Studio must be enabled. The CLI reaches the keyboard over a USB-serial Studio
# endpoint — build the central side with the studio-rpc-usb-uart snippet.
# (The keyboard's own host transport — BLE and/or USB HID — is independent.)
CONFIG_ZMK_STUDIO=y
# Enlarge RPC buffers — the default RX buffer silently drops larger custom-RPC
# frames (worst-case macro/combo payloads):
CONFIG_ZMK_STUDIO_RPC_RX_BUF_SIZE=1024
CONFIG_ZMK_STUDIO_RPC_CUSTOM_SUBSYSTEM_REQUEST_PAYLOAD_MAX_BYTES=512
```

### Per-feature flags

Enable the features you want. Each `_STUDIO_RPC` flag exposes that feature
over the custom RPC so the CLI can read and write it at runtime.

```conf
CONFIG_ZMK_RUNTIME_MACRO=y                    # runtime-editable macros
CONFIG_ZMK_RUNTIME_MACRO_STUDIO_RPC=y         # expose macros over RPC
CONFIG_ZMK_RUNTIME_HOLDTAP=y                  # runtime-editable hold-tap timing
CONFIG_ZMK_RUNTIME_HOLDTAP_STUDIO_RPC=y       # expose hold-tap over RPC
CONFIG_ZMK_RUNTIME_CONDLAYERS=y               # runtime-editable conditional layers
CONFIG_ZMK_RUNTIME_CONDLAYERS_STUDIO_RPC=y    # expose conditional layers over RPC
CONFIG_ZMK_RUNTIME_COMBOS=y                   # runtime-editable combos
CONFIG_ZMK_RUNTIME_COMBOS_STUDIO_RPC=y        # expose combos over RPC
# companions (optional — requires the companion west.yml entries above):
CONFIG_ZMK_RUNTIME_INPUT_PROCESSOR=y          # trackball runtime (companion module)
CONFIG_ZMK_RUNTIME_INPUT_PROCESSOR_STUDIO_RPC=y
CONFIG_ZMK_RUNTIME_SENSOR_ROTATE=y            # encoder runtime (companion module)
CONFIG_ZMK_RUNTIME_SENSOR_ROTATE_STUDIO_RPC=y
```

You do not have to enable all features — enable only what your keymap uses.
Features not enabled are excluded from the build entirely.

---

## 4. Keymap — switch to runtime compatibles

For each feature you enabled, change the relevant keymap node's `compatible`
to the runtime variant. The device-tree positions and output bindings are
unchanged; only the compatible string differs.

| Feature | Original compatible | Runtime compatible |
|---------|--------------------|--------------------|
| Macro behavior | `zmk,behavior-macro` | `zmk,behavior-runtime-macro` |
| Hold-tap behavior | `zmk,behavior-hold-tap` | `zmk,behavior-runtime-hold-tap` |
| Conditional layers node | `zmk,conditional-layers` | `zmk,runtime-conditional-layers` |
| Combos node | `zmk,combos` | `zmk,runtime-combos` |

For complete keymap fragments showing each compatible in context, see
[`examples/`](../examples/) (macro, hold-tap, conditional-layers, combos each
have their own subdirectory).

---

## 5. Build and flash

Build exactly as you would for a standard ZMK keyboard. No extra build flags
are needed beyond what the `.conf` already sets.

**Important:** the CLI communicates with the keyboard over the Studio USB-serial
endpoint. Build the **central** side with the `studio-rpc-usb-uart` snippet so
the endpoint is available:

```bash
west build -b <board> -- -DSHIELD=<central_shield> \
  -DSNIPPET=studio-rpc-usb-uart
```

Flash the central side normally:

```bash
west flash
```

The peripheral side (if split) does not need the snippet.

---

## 6. CLI — install and first use

The CLI (`zmkrt`) lives in the `cli/` directory of this repository.

### Install

```bash
# recommended — isolated environment, no dependency conflicts:
pipx install /path/to/zmk-module-runtime-config/cli

# or editable install for development:
pip install -e /path/to/zmk-module-runtime-config/cli
```

### Verify the connection

Plug in the central side over USB, then:

```bash
zmkrt info
```

If the device responds you will see basic build information. If the port is not
auto-detected, pass it explicitly:

```bash
zmkrt --port /dev/tty.usbmodem* info
```

### Example commands

```bash
zmkrt combo list          # list all runtime combos
zmkrt macro get 0         # get macro in slot 0 (macros are addressed by slot number, 0-based; there is no macro list)
zmkrt holdtap list        # list all runtime hold-tap behaviors
zmkrt condlayer list      # list all runtime conditional layers
```

For the full command reference run `zmkrt --help` or `zmkrt <subcommand> --help`.

---

## 7. Caveats

### keymap-drawer incompatibility

**keymap-drawer ≤ 0.23.0** cannot parse the `zmk,runtime-*` compatibles and
will silently drop those nodes from the generated diagram. The device-tree
positions and key outputs are unchanged — this is a cosmetic limitation of the
drawing tool, not a functional issue. Track the upstream keymap-drawer issue
for when support is added.

### `zmk-studio-api` — source build required

The Python package `zmk-studio-api` (a dependency of the CLI) may not be
available on PyPI for the cormoran protobuf schema. If `pipx install` fails on
this dependency, build it from source per the instructions in `cli/README.md`.

### Per-feature `reset` and global reset

Runtime edits are stored in non-volatile storage (NVS). Each feature exposes a
`reset` subcommand that clears its stored values and reverts to the compiled-in
defaults:

```bash
zmkrt combo reset
zmkrt holdtap reset
zmkrt condlayer reset
```

> **Note:** Macros have no per-slot reset — set the slot to an empty macro, or
> use the global `zmkrt reset` (below) to restore all settings to the
> devicetree defaults.

To clear all runtime state at once:

```bash
zmkrt reset
```

After a reset the keyboard reboots and reloads the compiled-in defaults. You do
**not** need to reflash.
