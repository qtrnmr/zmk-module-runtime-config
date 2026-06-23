/*
 * Copyright (c) 2021 The ZMK Contributors
 *
 * SPDX-License-Identifier: MIT
 */

#define DT_DRV_COMPAT zmk_runtime_conditional_layers

#include <stdint.h>
#include <zephyr/kernel.h>

#include <zephyr/devicetree.h>
#include <zephyr/logging/log.h>

#include <zephyr/init.h>

#include <zmk/event_manager.h>
#include <zmk/keymap.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/runtime_condlayers.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

#if DT_HAS_COMPAT_STATUS_OKAY(DT_DRV_COMPAT)

static K_SEM_DEFINE(runtime_conditional_layer_sem, 1, 1);

// Conditional layer config struct is shared with the store (struct
// rt_condlayer_entry in <zmk/runtime_condlayers.h>): { uint32_t if_layers_mask;
// int8_t then_layer; }. Using one type avoids any layout/type-pun risk between
// the listener and the NVS store.

#define IF_LAYER_BIT(node_id, prop, idx) BIT(DT_PROP_BY_IDX(node_id, prop, idx)) |

// Evaluates to rt_condlayer_entry struct initializer.
#define CONDITIONAL_LAYER_DECL(n)                                                                  \
    {                                                                                              \
        .if_layers_mask = DT_FOREACH_PROP_ELEM(n, if_layers, IF_LAYER_BIT) 0,                      \
        .then_layer = DT_PROP(n, then_layer),                                                      \
    },

// Devicetree-default conditional layer configurations (kept const as the
// source for reset-to-default).
static const struct rt_condlayer_entry CONDITIONAL_LAYER_CFGS[] = {
    DT_INST_FOREACH_CHILD(0, CONDITIONAL_LAYER_DECL)};

static const int32_t NUM_CONDITIONAL_LAYER_CFGS =
    sizeof(CONDITIONAL_LAYER_CFGS) / sizeof(*CONDITIONAL_LAYER_CFGS);

// Mutable, NVS-overridable copy that the listener actually reads. Seeded with
// the devicetree defaults at static-init; the store may override entries at
// runtime (decision logic below is unchanged — only the source array differs).
static struct rt_condlayer_entry rt_cfgs[] = {
    DT_INST_FOREACH_CHILD(0, CONDITIONAL_LAYER_DECL)};

static void runtime_conditional_layer_activate(int8_t layer) {
    // This may trigger another event that could, in turn, activate additional then-layers. However,
    // the process will eventually terminate (at worst, when every layer is active).
    if (!zmk_keymap_layer_active(layer)) {
        LOG_DBG("layer %d", layer);
        zmk_keymap_layer_activate(layer);
    }
}

static void runtime_conditional_layer_deactivate(int8_t layer) {
    // This may deactivate a then-layer that's already active via another mechanism (e.g., a
    // momentary layer behavior). However, the same problem arises when multiple keys with the same
    // &mo binding are held and then one is released, so it's probably not an issue in practice.
    if (zmk_keymap_layer_active(layer)) {
        LOG_DBG("layer %d", layer);
        zmk_keymap_layer_deactivate(layer);
    }
}

static int layer_state_changed_listener(const zmk_event_t *ev) {
    static bool runtime_conditional_layer_updates_needed;

    runtime_conditional_layer_updates_needed = true;

    // Semaphore ensures we don't re-enter the loop in the middle of doing update, and
    // ensures that "waterfalling layer updates" are all processed to trigger subsequent
    // nested conditional layers properly.
    if (k_sem_take(&runtime_conditional_layer_sem, K_NO_WAIT) < 0) {
        return 0;
    }

    while (runtime_conditional_layer_updates_needed) {
        int8_t max_then_layer = -1;
        uint32_t then_layers = 0;
        uint32_t then_layer_state = 0;

        runtime_conditional_layer_updates_needed = false;

        // On layer state changes, examines each conditional layer config to determine if then-layer
        // in the config should activate based on the currently active set of if-layers.
        for (int i = 0; i < NUM_CONDITIONAL_LAYER_CFGS; i++) {
            const struct rt_condlayer_entry *cfg = rt_cfgs + i;
            zmk_keymap_layers_state_t mask = cfg->if_layers_mask;
            then_layers |= BIT(cfg->then_layer);
            max_then_layer = MAX(max_then_layer, cfg->then_layer);

            // Activate then-layer if and only if all if-layers are already active. Note that we
            // reevaluate the current layer state for each config since activation of one layer can
            // also trigger activation of another.
            if ((zmk_keymap_layer_state() & mask) == mask) {
                then_layer_state |= BIT(cfg->then_layer);
            }
        }

        for (uint8_t layer = 0; layer <= max_then_layer; layer++) {
            if ((BIT(layer) & then_layers) != 0U) {
                if ((BIT(layer) & then_layer_state) != 0U) {
                    runtime_conditional_layer_activate(layer);
                } else {
                    runtime_conditional_layer_deactivate(layer);
                }
            }
        }
    }

    k_sem_give(&runtime_conditional_layer_sem);
    return 0;
}

ZMK_LISTENER(runtime_conditional_layer, layer_state_changed_listener);
ZMK_SUBSCRIPTION(runtime_conditional_layer, zmk_layer_state_changed);

// Register each entry's live struct + devicetree default with the NVS store so
// saved values override rt_cfgs (and reset can restore DT defaults). rt_cfgs is
// already statically seeded with the DT defaults, so timing of this init only
// affects when an NVS-saved override is applied (handled both orders by the
// store).
static int rt_condlayer_init(void) {
    for (int i = 0; i < NUM_CONDITIONAL_LAYER_CFGS; i++) {
        rt_condlayer_register((uint8_t)i, &rt_cfgs[i], &CONDITIONAL_LAYER_CFGS[i]);
    }
    return 0;
}

SYS_INIT(rt_condlayer_init, POST_KERNEL, CONFIG_KERNEL_INIT_PRIORITY_DEFAULT);

#endif
