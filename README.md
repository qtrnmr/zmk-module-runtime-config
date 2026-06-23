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
- name: zmk-module-runtime-config
  url: https://github.com/qtrnmr/zmk-module-runtime-config
  revision: main
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

4. Recommended Studio RPC buffer sizes:

```
CONFIG_ZMK_STUDIO_RPC_RX_BUF_SIZE=1024
CONFIG_ZMK_STUDIO_RPC_CUSTOM_SUBSYSTEM_REQUEST_PAYLOAD_MAX_BYTES=512
```

## Related

- **roBa CLI** (sub-project B): a Python CLI for driving these RPC handlers from
  the host — layer rename, macro edit, hold-tap tuning, etc.
- **cormoran trackball/encoder modules**: companion runtime modules for trackball
  and encoder configuration.
