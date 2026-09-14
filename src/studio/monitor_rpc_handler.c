// Copyright (c) 2026 qtrnmr
// SPDX-License-Identifier: MIT
//
// ZMK Runtime Monitor - Custom Studio RPC handler. Owns the `monitoring` flag
// behind the `zmk__monitor` subsystem: enable / disable flip it, get_layers
// answers the current layer state. The stream itself is produced by the event
// listeners in monitor_listener.c. Read-only with respect to the device: the
// flag lives in RAM and nothing here changes a setting.

#include <pb_decode.h>
#include <pb_encode.h>
#include <zephyr/logging/log.h>

#include <zmk/keymap.h>
#include <zmk/monitor/monitor.pb.h>
#include <zmk/runtime_monitor.h>
#include <zmk/studio/custom.h>
#include <zmk/studio/rpc.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

static bool monitoring = false;

bool rt_monitor_enabled(void) { return monitoring; }

void rt_monitor_set(bool on) { monitoring = on; }

static struct zmk_rpc_custom_subsystem_meta monitor_rpc_meta = {
    .security = ZMK_STUDIO_RPC_HANDLER_UNSECURED,
};

static bool monitor_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                       pb_callback_t *encode_response);

ZMK_RPC_CUSTOM_SUBSYSTEM(zmk__monitor, &monitor_rpc_meta, monitor_rpc_handle_request);
ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER(zmk__monitor, zmk_monitor_Response);

static void handle_get_layers(zmk_monitor_Response *resp) {
    resp->which_response_type = zmk_monitor_Response_layers_tag;
    resp->response_type.layers.mask = (uint32_t)zmk_keymap_layer_state();
    resp->response_type.layers.highest = (uint32_t)zmk_keymap_highest_layer_active();
}

static void handle_ok(zmk_monitor_Response *resp, bool ok) {
    resp->which_response_type = zmk_monitor_Response_ok_tag;
    resp->response_type.ok.ok = ok;
}

static bool monitor_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                       pb_callback_t *encode_response) {
    zmk_monitor_Response *resp =
        ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER_ALLOCATE(zmk__monitor, encode_response);

    zmk_monitor_Request req = zmk_monitor_Request_init_zero;
    pb_istream_t stream =
        pb_istream_from_buffer(raw_request->payload.bytes, raw_request->payload.size);
    if (!pb_decode(&stream, zmk_monitor_Request_fields, &req)) {
        LOG_WRN("monitor_rpc: decode failed: %s", PB_GET_ERROR(&stream));
        handle_ok(resp, false);
        return true;
    }

    switch (req.which_request_type) {
    case zmk_monitor_Request_get_layers_tag:
        handle_get_layers(resp);
        break;
    case zmk_monitor_Request_enable_tag:
        rt_monitor_set(true);
        handle_ok(resp, true);
        break;
    case zmk_monitor_Request_disable_tag:
        rt_monitor_set(false);
        handle_ok(resp, true);
        break;
    default:
        LOG_WRN("monitor_rpc: unsupported request type %d", req.which_request_type);
        handle_ok(resp, false);
        break;
    }

    return true;
}
