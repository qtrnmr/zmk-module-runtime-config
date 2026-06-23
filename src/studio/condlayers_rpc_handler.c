// Copyright (c) 2026 qtrnmr
// SPDX-License-Identifier: MIT
//
// ZMK Runtime Conditional Layers - custom Studio RPC handler `zmk__condlayers`.
// count / get / set / reset of per-entry {if_layers_mask, then_layer}. All
// results returned in the response (no notifications).

#include <errno.h>

#include <pb_decode.h>
#include <pb_encode.h>
#include <zephyr/logging/log.h>

#include <zmk/runtime_condlayers.h>
#include <zmk/condlayers/condlayers.pb.h>
#include <zmk/studio/custom.h>
#include <zmk/studio/rpc.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

#define ENTRIES CONFIG_ZMK_RUNTIME_CONDLAYERS_MAX

static struct zmk_rpc_custom_subsystem_meta condlayers_rpc_meta = {
    .security = ZMK_STUDIO_RPC_HANDLER_UNSECURED,
};

static bool condlayers_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                          pb_callback_t *encode_response);

ZMK_RPC_CUSTOM_SUBSYSTEM(zmk__condlayers, &condlayers_rpc_meta, condlayers_rpc_handle_request);
ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER(zmk__condlayers, zmk_condlayers_Response);

static void handle_count(zmk_condlayers_Response *resp) {
    uint32_t count = 0;
    for (uint8_t i = 0; i < ENTRIES; i++) {
        if (rt_condlayer_registered(i)) {
            count++;
        }
    }
    resp->response_type.count.count = count;
    resp->which_response_type = zmk_condlayers_Response_count_tag;
}

static void handle_get(const zmk_condlayers_SlotRequest *req, zmk_condlayers_Response *resp) {
    uint8_t idx = (uint8_t)req->index;
    struct rt_condlayer_entry e;
    int rc = rt_condlayer_get(idx, &e);

    zmk_condlayers_CondLayerInfo *info = &resp->response_type.get;
    info->index = idx;
    info->found = (rc == 0);
    if (rc == 0) {
        info->if_layers_mask = e.if_layers_mask;
        info->then_layer = e.then_layer;
    }
    resp->which_response_type = zmk_condlayers_Response_get_tag;
}

static void handle_set(const zmk_condlayers_SetRequest *req, zmk_condlayers_Response *resp) {
    struct rt_condlayer_entry e = {
        .if_layers_mask = req->if_layers_mask,
        .then_layer = (int8_t)req->then_layer,
    };
    int rc = rt_condlayer_set((uint8_t)req->index, &e);
    resp->response_type.set.ok = (rc == 0);
    resp->response_type.set.error = (rc < 0) ? (uint32_t)(-rc) : 0;
    resp->which_response_type = zmk_condlayers_Response_set_tag;
}

static void handle_reset(const zmk_condlayers_SlotRequest *req, zmk_condlayers_Response *resp) {
    int rc = rt_condlayer_reset((uint8_t)req->index);
    resp->response_type.reset.ok = (rc == 0);
    resp->response_type.reset.error = (rc < 0) ? (uint32_t)(-rc) : 0;
    resp->which_response_type = zmk_condlayers_Response_reset_tag;
}

static bool condlayers_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                          pb_callback_t *encode_response) {
    zmk_condlayers_Response *resp =
        ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER_ALLOCATE(zmk__condlayers, encode_response);

    zmk_condlayers_Request req = zmk_condlayers_Request_init_zero;
    pb_istream_t stream =
        pb_istream_from_buffer(raw_request->payload.bytes, raw_request->payload.size);
    if (!pb_decode(&stream, zmk_condlayers_Request_fields, &req)) {
        LOG_WRN("condlayers_rpc: decode failed: %s", PB_GET_ERROR(&stream));
        resp->which_response_type = zmk_condlayers_Response_set_tag;
        resp->response_type.set.ok = false;
        resp->response_type.set.error = UINT32_MAX;
        return true;
    }

    switch (req.which_request_type) {
    case zmk_condlayers_Request_count_tag:
        handle_count(resp);
        break;
    case zmk_condlayers_Request_get_tag:
        handle_get(&req.request_type.get, resp);
        break;
    case zmk_condlayers_Request_set_tag:
        handle_set(&req.request_type.set, resp);
        break;
    case zmk_condlayers_Request_reset_tag:
        handle_reset(&req.request_type.reset, resp);
        break;
    default:
        LOG_WRN("condlayers_rpc: unsupported request type %d", req.which_request_type);
        resp->which_response_type = zmk_condlayers_Response_set_tag;
        resp->response_type.set.ok = false;
        resp->response_type.set.error = UINT32_MAX;
        break;
    }

    return true;
}

static int rt_condlayer_settings_reset(void) {
    rt_condlayer_clear_all();
    return 0;
}

ZMK_RPC_SUBSYSTEM_SETTINGS_RESET(rt_condlayer, rt_condlayer_settings_reset);
