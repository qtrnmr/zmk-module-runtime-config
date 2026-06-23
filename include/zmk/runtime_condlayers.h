#pragma once

#include <stdint.h>

// One runtime conditional-layer entry: activate then_layer while all layers in
// if_layers_mask are active. Mirrors struct runtime_conditional_layer_cfg.
struct rt_condlayer_entry {
    uint32_t if_layers_mask;
    int8_t then_layer;
};

// Each entry registers its live struct (the mutable rt_cfgs[i] the listener
// reads) and its devicetree default at init. A saved NVS value overrides the
// live struct immediately or when settings load completes.
void rt_condlayer_register(uint8_t index, struct rt_condlayer_entry *live,
                           const struct rt_condlayer_entry *dt_default);

// Fill *out with the entry's current live value. 0 if registered, negative else.
int rt_condlayer_get(uint8_t index, struct rt_condlayer_entry *out);

// Persist an entry to NVS (NVS-first), then update the live struct. 0 on success.
int rt_condlayer_set(uint8_t index, const struct rt_condlayer_entry *in);

// Restore the entry's devicetree default to the live struct and delete its NVS
// key. 0 on success.
int rt_condlayer_reset(uint8_t index);

// True if the index has a registered entry.
bool rt_condlayer_registered(uint8_t index);

// Delete all saved entries and restore each live struct to its DT default.
void rt_condlayer_clear_all(void);
