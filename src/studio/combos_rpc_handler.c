// Copyright (c) 2026 qtrnmr
// SPDX-License-Identifier: MIT
//
// ZMK Runtime Combos - custom Studio RPC handler `zmk__combos`.
// count / get / set (per-field, read-modify-write) / reset of per-combo
// runtime params. Read-only key_positions returned by get. All results
// returned in the response (no notifications).

#include <errno.h>

#include <pb_decode.h>
#include <pb_encode.h>
#include <zephyr/logging/log.h>

#include <zmk/runtime_combos.h>
#include <zmk/combos/combos.pb.h>
#include <zmk/studio/custom.h>
#include <zmk/studio/rpc.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

static struct zmk_rpc_custom_subsystem_meta combos_rpc_meta = {
    .security = ZMK_STUDIO_RPC_HANDLER_UNSECURED,
};

static bool combos_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                      pb_callback_t *encode_response);

ZMK_RPC_CUSTOM_SUBSYSTEM(zmk__combos, &combos_rpc_meta, combos_rpc_handle_request);
ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER(zmk__combos, zmk_combos_Response);

static void handle_count(zmk_combos_Response *resp) {
    resp->response_type.count.count = rt_combo_count();
    resp->which_response_type = zmk_combos_Response_count_tag;
}

static void handle_get(const zmk_combos_GetRequest *req, zmk_combos_Response *resp) {
    uint8_t idx = (uint8_t)req->index;
    struct rt_combo_params p;
    int rc = rt_combo_get(idx, &p);

    zmk_combos_GetResponse *get_resp = &resp->response_type.get;
    zmk_combos_ComboInfo *info = &get_resp->info;

    get_resp->has_info = true;
    info->index = idx;
    info->found = (rc == 0);

    if (rc == 0) {
        // Read-only key_positions from the DT-const combos[] array.
        uint8_t kp_len = 0;
        int32_t kp_buf[20];
        int kp_rc = rt_combo_key_positions(idx, kp_buf, 20, &kp_len);
        if (kp_rc == 0) {
            info->key_positions_count = kp_len;
            for (uint8_t i = 0; i < kp_len; i++) {
                info->key_positions[i] = (uint32_t)kp_buf[i];
            }
        }

        info->has_binding = true;
        info->binding.behavior_id = p.behavior_local_id;
        info->binding.param1 = p.param1;
        info->binding.param2 = p.param2;
        info->timeout_ms = p.timeout_ms;
        info->require_prior_idle_ms = p.require_prior_idle_ms;
        info->layer_mask = p.layer_mask;
        info->slow_release = p.slow_release;
    }

    resp->which_response_type = zmk_combos_Response_get_tag;
}

static void handle_set(const zmk_combos_SetRequest *req, zmk_combos_Response *resp) {
    uint8_t idx = (uint8_t)req->index;

    // Read-modify-write: fetch current params, apply only the one oneof field
    // present in the request, then write back.
    struct rt_combo_params p;
    int rc = rt_combo_get(idx, &p);
    if (rc != 0) {
        resp->response_type.set.ok = false;
        resp->which_response_type = zmk_combos_Response_set_tag;
        return;
    }

    switch (req->which_field) {
    case zmk_combos_SetRequest_binding_tag:
        p.behavior_local_id = req->field.binding.behavior_id;
        p.param1 = req->field.binding.param1;
        p.param2 = req->field.binding.param2;
        break;
    case zmk_combos_SetRequest_timeout_ms_tag:
        p.timeout_ms = req->field.timeout_ms;
        break;
    case zmk_combos_SetRequest_require_prior_idle_ms_tag:
        p.require_prior_idle_ms = (int16_t)req->field.require_prior_idle_ms;
        break;
    case zmk_combos_SetRequest_layer_mask_tag:
        p.layer_mask = req->field.layer_mask;
        break;
    case zmk_combos_SetRequest_slow_release_tag:
        p.slow_release = req->field.slow_release;
        break;
    default:
        LOG_WRN("combos_rpc: set: unknown field tag %d", req->which_field);
        resp->response_type.set.ok = false;
        resp->which_response_type = zmk_combos_Response_set_tag;
        return;
    }

    rc = rt_combo_set(idx, &p);
    resp->response_type.set.ok = (rc == 0);
    resp->which_response_type = zmk_combos_Response_set_tag;
}

static void handle_reset(const zmk_combos_ResetRequest *req, zmk_combos_Response *resp) {
    int rc = rt_combo_reset((uint8_t)req->index);
    resp->response_type.reset.ok = (rc == 0);
    resp->which_response_type = zmk_combos_Response_reset_tag;
}

static bool combos_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                      pb_callback_t *encode_response) {
    zmk_combos_Response *resp =
        ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER_ALLOCATE(zmk__combos, encode_response);

    zmk_combos_Request req = zmk_combos_Request_init_zero;
    pb_istream_t stream =
        pb_istream_from_buffer(raw_request->payload.bytes, raw_request->payload.size);
    if (!pb_decode(&stream, zmk_combos_Request_fields, &req)) {
        LOG_WRN("combos_rpc: decode failed: %s", PB_GET_ERROR(&stream));
        resp->which_response_type = zmk_combos_Response_set_tag;
        resp->response_type.set.ok = false;
        return true;
    }

    switch (req.which_request_type) {
    case zmk_combos_Request_count_tag:
        handle_count(resp);
        break;
    case zmk_combos_Request_get_tag:
        handle_get(&req.request_type.get, resp);
        break;
    case zmk_combos_Request_set_tag:
        handle_set(&req.request_type.set, resp);
        break;
    case zmk_combos_Request_reset_tag:
        handle_reset(&req.request_type.reset, resp);
        break;
    default:
        LOG_WRN("combos_rpc: unsupported request type %d", req.which_request_type);
        resp->which_response_type = zmk_combos_Response_set_tag;
        resp->response_type.set.ok = false;
        break;
    }

    return true;
}

static int on_settings_reset(void) {
    rt_combo_clear_all();
    return 0;
}

ZMK_RPC_SUBSYSTEM_SETTINGS_RESET(zmk__combos, on_settings_reset);
