#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <zmk/behavior.h>

// The runtime-editable fields of one combo. Pointer-free (NVS-safe): the
// behavior is stored as local_id + params; behavior_dev is reconstructed on use.
struct rt_combo_params {
    zmk_behavior_local_id_t behavior_local_id;
    uint32_t param1;
    uint32_t param2;
    int32_t timeout_ms;
    int16_t require_prior_idle_ms;
    uint32_t layer_mask;
    bool slow_release;
};

// Register a combo's live params struct + its devicetree default. A saved NVS
// value overrides the live struct immediately or when settings load completes.
void rt_combo_register(uint8_t index, struct rt_combo_params *live,
                       const struct rt_combo_params *dt_default);

// Fill *out with the live params. 0 if registered, negative else.
int rt_combo_get(uint8_t index, struct rt_combo_params *out);

// Persist to NVS (NVS-first), then update the live struct. 0 on success.
int rt_combo_set(uint8_t index, const struct rt_combo_params *in);

// Restore the devicetree default to the live struct and delete the NVS key.
int rt_combo_reset(uint8_t index);

// True if the index has a registered combo.
bool rt_combo_registered(uint8_t index);

// Number of registered combos (contiguous from 0).
uint8_t rt_combo_count(void);

// Delete all saved combos and restore each live struct to its DT default.
void rt_combo_clear_all(void);

// Read the read-only key_positions from the DT-const combos[] array.
// Fills out[0..min(len,max)-1] with the key positions for combo at index.
// Sets *len_out to the actual key_position_len. Returns 0 on success, -EINVAL
// if index is out of range.
int rt_combo_key_positions(uint8_t index, int32_t *out, uint8_t max, uint8_t *len_out);
