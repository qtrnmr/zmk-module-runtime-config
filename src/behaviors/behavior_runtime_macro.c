// Copyright (c) 2026 qtrnmr and contributors
// SPDX-License-Identifier: MIT

#define DT_DRV_COMPAT zmk_behavior_runtime_macro
#include <zephyr/device.h>
#include <zephyr/sys/util.h>
#include <drivers/behavior.h>
#include <zmk/behavior.h>
#include <zmk/behavior_queue.h>
#include <zmk/runtime_macro.h>
#include <dt-bindings/zmk/keys.h>

static int on_rt_macro_pressed(struct zmk_behavior_binding *binding,
                               struct zmk_behavior_binding_event event) {
    struct rt_macro_step steps[CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS];
    uint8_t count = 0;
    if (rt_macro_get_steps((uint8_t)binding->param1, steps,
                           CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS, &count) < 0) {
        return ZMK_BEHAVIOR_OPAQUE;
    }
    for (uint8_t i = 0; i < count; i++) {
        struct zmk_behavior_binding kp = { .behavior_dev = "key_press",
                                           .param1 = steps[i].keycode, .param2 = 0 };
        switch (steps[i].type) {
        case RT_MACRO_STEP_PRESS:
            zmk_behavior_queue_add(&event, kp, true, steps[i].wait_ms);
            break;
        case RT_MACRO_STEP_RELEASE:
            zmk_behavior_queue_add(&event, kp, false, steps[i].wait_ms);
            break;
        case RT_MACRO_STEP_TAP:
        default:
            zmk_behavior_queue_add(&event, kp, true, steps[i].tap_ms);
            zmk_behavior_queue_add(&event, kp, false, steps[i].wait_ms);
            break;
        }
    }
    return ZMK_BEHAVIOR_OPAQUE;
}

static int on_rt_macro_released(struct zmk_behavior_binding *binding,
                                struct zmk_behavior_binding_event event) {
    return ZMK_BEHAVIOR_OPAQUE;
}

#if IS_ENABLED(CONFIG_ZMK_BEHAVIOR_METADATA)
// Publish param metadata so ZMK Studio's set_layer_binding accepts assigning
// &rt_macro at runtime. param1 = slot index, a range [0, SLOTS-1]; param2 is
// unused (left empty, so validation only accepts param2 == 0). Without this the
// behavior reports no metadata and Studio rejects every binding as
// INVALID_PARAMETERS — the reason rt_macro placement was DTS-only until now.
static const struct behavior_parameter_value_metadata rt_macro_param1_values[] = {
    {
        .display_name = "Slot",
        .range = {.min = 0, .max = CONFIG_ZMK_RUNTIME_MACRO_SLOTS - 1},
        .type = BEHAVIOR_PARAMETER_VALUE_TYPE_RANGE,
    },
};
static const struct behavior_parameter_metadata_set rt_macro_metadata_set = {
    .param1_values_len = ARRAY_SIZE(rt_macro_param1_values),
    .param1_values = rt_macro_param1_values,
};
static const struct behavior_parameter_metadata rt_macro_metadata = {
    .sets_len = 1,
    .sets = &rt_macro_metadata_set,
};
#endif // IS_ENABLED(CONFIG_ZMK_BEHAVIOR_METADATA)

static const struct behavior_driver_api rt_macro_api = {
    .binding_pressed = on_rt_macro_pressed,
    .binding_released = on_rt_macro_released,
#if IS_ENABLED(CONFIG_ZMK_BEHAVIOR_METADATA)
    .parameter_metadata = &rt_macro_metadata,
#endif // IS_ENABLED(CONFIG_ZMK_BEHAVIOR_METADATA)
};

static int rt_macro_init(const struct device *dev) { return 0; }

#define RT_MACRO_INST(n)                                                          \
    BEHAVIOR_DT_INST_DEFINE(n, rt_macro_init, NULL, NULL, NULL, POST_KERNEL,      \
                            CONFIG_KERNEL_INIT_PRIORITY_DEFAULT, &rt_macro_api);
DT_INST_FOREACH_STATUS_OKAY(RT_MACRO_INST)
