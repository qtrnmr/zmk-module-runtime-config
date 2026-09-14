// Copyright (c) 2026 qtrnmr
// SPDX-License-Identifier: MIT
//
// ZMK Runtime Monitor - Event listeners. While rt_monitor_enabled(), every
// position / layer / keycode event is forwarded to ZMK Studio as one
// `zmk__monitor` custom notification. Modelled on cormoran's
// src/studio/input_processor_listener.c (encode callback + find_subsystem_index).
//
// Runs on the central: peripheral key positions already arrive here through the
// split transport with `source` set, so the left half needs no change.

#include <string.h>

#include <pb_encode.h>
#include <zephyr/logging/log.h>

#include <zmk/event_manager.h>
#include <zmk/events/keycode_state_changed.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/events/position_state_changed.h>
#include <zmk/keymap.h>
#include <zmk/monitor/monitor.pb.h>
#include <zmk/runtime_monitor.h>
#include <zmk/studio/custom.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

// Encode one zmk_monitor_Notification as the custom notification payload.
// raise_zmk_studio_custom_notification() runs this synchronously, so the
// caller's stack variable stays valid (see zmk/studio/custom.h).
static bool encode_notification(pb_ostream_t *stream, const pb_field_t *field, void *const *arg) {
    zmk_monitor_Notification *notification = (zmk_monitor_Notification *)*arg;
    if (!pb_encode_tag_for_field(stream, field)) {
        return false;
    }

    size_t size;
    if (!pb_get_encoded_size(&size, zmk_monitor_Notification_fields, notification)) {
        LOG_WRN("monitor: failed to get encoded size for notification");
        return false;
    }

    if (!pb_encode_varint(stream, size)) {
        return false;
    }
    return pb_encode(stream, zmk_monitor_Notification_fields, notification);
}

static uint8_t find_subsystem_index(const char *identifier) {
    extern struct zmk_rpc_custom_subsystem _zmk_rpc_custom_subsystem_list_start[];
    extern struct zmk_rpc_custom_subsystem _zmk_rpc_custom_subsystem_list_end[];

    uint8_t index = 0;
    for (struct zmk_rpc_custom_subsystem *subsys = _zmk_rpc_custom_subsystem_list_start;
         subsys < _zmk_rpc_custom_subsystem_list_end; subsys++) {
        if (strcmp(subsys->identifier, identifier) == 0) {
            return index;
        }
        index++;
    }
    return 0; // Default to first subsystem if not found
}

static void send_notification(zmk_monitor_Notification *notification) {
    pb_callback_t encode_cb = {.funcs.encode = encode_notification, .arg = notification};

    raise_zmk_studio_custom_notification((struct zmk_studio_custom_notification){
        .subsystem_index = find_subsystem_index("zmk__monitor"), .encode_payload = encode_cb});
}

// The whole layer state, never a delta: a client that joins mid-stream (or
// misses a frame) is corrected by the next event.
static void send_layer_state(void) {
    zmk_monitor_Notification notification = zmk_monitor_Notification_init_zero;
    notification.which_type = zmk_monitor_Notification_layers_tag;
    notification.type.layers.mask = (uint32_t)zmk_keymap_layer_state();
    notification.type.layers.highest = (uint32_t)zmk_keymap_highest_layer_active();
    send_notification(&notification);
}

static int monitor_position_cb(const zmk_event_t *eh) {
    const struct zmk_position_state_changed *ev = as_zmk_position_state_changed(eh);
    if (!ev || !rt_monitor_enabled()) {
        return ZMK_EV_EVENT_BUBBLE;
    }

    zmk_monitor_Notification notification = zmk_monitor_Notification_init_zero;
    notification.which_type = zmk_monitor_Notification_key_tag;
    notification.type.key.position = ev->position;
    notification.type.key.pressed = ev->state;
    notification.type.key.source = ev->source;
    send_notification(&notification);

    return ZMK_EV_EVENT_BUBBLE;
}

static int monitor_layer_cb(const zmk_event_t *eh) {
    const struct zmk_layer_state_changed *ev = as_zmk_layer_state_changed(eh);
    if (!ev || !rt_monitor_enabled()) {
        return ZMK_EV_EVENT_BUBBLE;
    }

    // ZMK updates the layer mask before raising the event, so reading it here
    // already includes this change; and because every notification carries the
    // whole state, a stale read would be corrected by the next event anyway.
    send_layer_state();

    return ZMK_EV_EVENT_BUBBLE;
}

static int monitor_keycode_cb(const zmk_event_t *eh) {
    const struct zmk_keycode_state_changed *ev = as_zmk_keycode_state_changed(eh);
    if (!ev || !rt_monitor_enabled()) {
        return ZMK_EV_EVENT_BUBBLE;
    }

    zmk_monitor_Notification notification = zmk_monitor_Notification_init_zero;
    notification.which_type = zmk_monitor_Notification_keycode_tag;
    notification.type.keycode.usage_page = ev->usage_page;
    notification.type.keycode.keycode = ev->keycode;
    notification.type.keycode.pressed = ev->state;
    notification.type.keycode.modifiers =
        (uint32_t)(ev->implicit_modifiers | ev->explicit_modifiers);
    send_notification(&notification);

    return ZMK_EV_EVENT_BUBBLE;
}

ZMK_LISTENER(monitor_position_listener, monitor_position_cb);
ZMK_SUBSCRIPTION(monitor_position_listener, zmk_position_state_changed);

ZMK_LISTENER(monitor_layer_listener, monitor_layer_cb);
ZMK_SUBSCRIPTION(monitor_layer_listener, zmk_layer_state_changed);

ZMK_LISTENER(monitor_keycode_listener, monitor_keycode_cb);
ZMK_SUBSCRIPTION(monitor_keycode_listener, zmk_keycode_state_changed);
