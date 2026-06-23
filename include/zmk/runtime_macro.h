// Copyright (c) 2026 qtrnmr and contributors
// SPDX-License-Identifier: MIT

#pragma once
#include <zephyr/types.h>

#define RT_MACRO_STEP_KEY 0

struct rt_macro_step {
    uint8_t type;       // RT_MACRO_STEP_KEY
    uint32_t keycode;   // ZMK-encoded keycode incl. implicit mods (e.g. LC(C)=0x01000006). Passed to &kp param1.
    uint16_t wait_ms;
    uint16_t tap_ms;
};

/* Get steps for a slot from the RAM cache (populated by NVS settings load or
 * rt_macro_set_steps).  Returns -EINVAL for an invalid slot. */
int rt_macro_get_steps(uint8_t slot, struct rt_macro_step *out, uint8_t max, uint8_t *count_out);

/* Write steps for a slot to the RAM cache and persist to NVS.
 * count is clamped to CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS.
 * Returns 0 on success, negative errno on failure. */
int rt_macro_set_steps(uint8_t slot, const struct rt_macro_step *steps, uint8_t count);

/* Erase all slots from NVS and zero the RAM cache.
 * Called by the ZMK Studio reset_settings RPC to clear all macro data.
 * Returns 0 on success, first negative errno on settings_delete failure. */
int rt_macro_clear_all(void);
