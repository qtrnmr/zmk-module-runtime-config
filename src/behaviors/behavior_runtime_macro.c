// Copyright (c) 2026 qtrnmr and contributors
// SPDX-License-Identifier: MIT

#define DT_DRV_COMPAT zmk_behavior_runtime_macro
#include <zephyr/device.h>
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

static const struct behavior_driver_api rt_macro_api = {
    .binding_pressed = on_rt_macro_pressed,
    .binding_released = on_rt_macro_released,
};

static int rt_macro_init(const struct device *dev) { return 0; }

#define RT_MACRO_INST(n)                                                          \
    BEHAVIOR_DT_INST_DEFINE(n, rt_macro_init, NULL, NULL, NULL, POST_KERNEL,      \
                            CONFIG_KERNEL_INIT_PRIORITY_DEFAULT, &rt_macro_api);
DT_INST_FOREACH_STATUS_OKAY(RT_MACRO_INST)
