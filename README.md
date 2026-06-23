# zmk-module-runtime-config

A unified ZMK module that makes macros, hold-tap timing, conditional layers, and
combos **runtime-editable over the custom Studio RPC — without reflashing**.

## Requirement (non-mainline ZMK)

**This module requires a ZMK base that provides the custom Studio RPC layer**
(`zmk/studio/custom.h`, `ZMK_RPC_CUSTOM_SUBSYSTEM`) — for example,
cormoran's ZMK fork. This is **NOT in mainline ZMK**.

## Features

| Kconfig | Description |
|---------|-------------|
| `CONFIG_ZMK_RUNTIME_MACRO` | Runtime-editable macros |
| `CONFIG_ZMK_RUNTIME_HOLDTAP` | Runtime-editable hold-tap timing (tapping-term-ms, quick-tap-ms, require-prior-idle-ms, flavor) |
| `CONFIG_ZMK_RUNTIME_CONDLAYERS` | Runtime-editable conditional layers |
| `CONFIG_ZMK_RUNTIME_COMBOS` | Runtime-editable combos (binding/timeout/layers; key-positions fixed) |

Each feature also has a `_STUDIO_RPC` sub-option (default `y`) to expose it over
the custom RPC, and capacity options (`_MAX_STEPS`, `_SLOTS`, `_MAX`).

## Setup

1. Add to `west.yml`:

```yaml
manifest:
  remotes:
    - name: cormoran
      url-base: https://github.com/cormoran
    - name: qtrnmr          # the remote name is arbitrary — reference it in projects below
      url-base: https://github.com/qtrnmr
  projects:
    - name: zmk
      remote: cormoran
      revision: v0.3-branch+dya
      import: app/west.yml
    - name: zmk-module-runtime-config
      remote: qtrnmr
      revision: main
    # optional companions (trackball / encoder):
    - name: zmk-module-runtime-input-processor
      remote: cormoran
      revision: zmk-v0.3.0.0
    - name: zmk-behavior-runtime-sensor-rotate
      remote: cormoran
      revision: zmk-v0.3.0.0
```

2. Enable desired features in `<board>.conf`:

```
CONFIG_ZMK_RUNTIME_MACRO=y
CONFIG_ZMK_RUNTIME_MACRO_STUDIO_RPC=y
CONFIG_ZMK_RUNTIME_HOLDTAP=y
CONFIG_ZMK_RUNTIME_HOLDTAP_STUDIO_RPC=y
CONFIG_ZMK_RUNTIME_CONDLAYERS=y
CONFIG_ZMK_RUNTIME_CONDLAYERS_STUDIO_RPC=y
CONFIG_ZMK_RUNTIME_COMBOS=y
CONFIG_ZMK_RUNTIME_COMBOS_STUDIO_RPC=y
```

3. Switch keymap nodes to the runtime compatibles:
   - `zmk,behavior-runtime-macro`
   - `zmk,behavior-runtime-hold-tap`
   - `zmk,runtime-conditional-layers`
   - `zmk,runtime-combos`

4. Required config — add to `<board>.conf`:

```conf
# Studio must be enabled. The CLI reaches the keyboard over a USB-serial Studio
# endpoint, so build the central with the studio-rpc-usb-uart snippet. (The
# keyboard's own host transport — BLE and/or USB HID — is independent of this.)
CONFIG_ZMK_STUDIO=y
# Enlarge RPC buffers — the default RX buffer silently drops larger custom-RPC
# frames (worst-case macro/combo payloads):
CONFIG_ZMK_STUDIO_RPC_RX_BUF_SIZE=1024
CONFIG_ZMK_STUDIO_RPC_CUSTOM_SUBSYSTEM_REQUEST_PAYLOAD_MAX_BYTES=512
```

> **Caveat:** keymap-drawer (≤0.23.0) cannot parse the `zmk,runtime-*`
> compatibles and will drop the keymap drawing. The device-tree positions and
> outputs are unchanged, so this is cosmetic.

## Related

- **roBa CLI** (sub-project B): a Python CLI for driving these RPC handlers from
  the host — layer rename, macro edit, hold-tap tuning, etc.
- **cormoran trackball/encoder modules**: companion runtime modules for trackball
  and encoder configuration.
