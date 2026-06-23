// Copyright (c) 2026 qtrnmr and contributors
// SPDX-License-Identifier: MIT

/**
 * ZMK Runtime Macro - Custom Studio RPC Handler
 *
 * Exposes GetMacro / SetMacro over the ZMK Studio custom RPC subsystem so a
 * host can read and write macro steps stored in NVS.
 */

#include <pb_decode.h>
#include <pb_encode.h>
#include <zephyr/logging/log.h>
#include <zmk/runtime_macro.h>
#include <zmk/macros/macros.pb.h>
#include <zmk/studio/custom.h>
#include <zmk/studio/rpc.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

/**
 * Metadata for the custom subsystem.
 * Unsecured matches the device configuration (LOCKING=n) and mirrors the
 * pattern used in zmk-module-settings-rpc.
 */
static struct zmk_rpc_custom_subsystem_meta macros_rpc_meta = {
    .security = ZMK_STUDIO_RPC_HANDLER_UNSECURED,
};

/* Forward declaration */
static bool macros_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                      pb_callback_t *encode_response);

/**
 * Register the custom RPC subsystem.
 * Identifier format: <namespace>__<feature>
 */
ZMK_RPC_CUSTOM_SUBSYSTEM(zmk__macros, &macros_rpc_meta,
                         macros_rpc_handle_request);

ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER(zmk__macros, zmk_macros_Response);

/* --- GetMacro ------------------------------------------------------------ */

static int handle_get_macro(const zmk_macros_GetMacroRequest *req,
                            zmk_macros_Response *resp) {
    uint8_t slot = (uint8_t)req->slot;

    struct rt_macro_step steps[CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS];
    uint8_t count = 0;

    int rc = rt_macro_get_steps(slot, steps, CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS,
                                &count);
    if (rc < 0) {
        LOG_ERR("macros_rpc: get_steps slot %u failed: %d", slot, rc);
        return rc;
    }

    zmk_macros_GetMacroResponse *get_resp =
        &resp->response_type.get_macro;

    get_resp->steps_count = count;
    for (uint8_t i = 0; i < count; i++) {
        get_resp->steps[i].type    = steps[i].type;
        get_resp->steps[i].keycode = steps[i].keycode;
        get_resp->steps[i].wait_ms = steps[i].wait_ms;
        get_resp->steps[i].tap_ms  = steps[i].tap_ms;
    }

    resp->which_response_type = zmk_macros_Response_get_macro_tag;
    LOG_DBG("macros_rpc: GetMacro slot=%u steps=%u", slot, count);
    return 0;
}

/* --- SetMacro ------------------------------------------------------------ */

static int handle_set_macro(const zmk_macros_SetMacroRequest *req,
                            zmk_macros_Response *resp) {
    uint8_t slot  = (uint8_t)req->slot;
    uint32_t cnt  = req->steps_count;

    if (cnt > CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS) {
        cnt = CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS;
    }

    struct rt_macro_step steps[CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS];
    for (uint32_t i = 0; i < cnt; i++) {
        steps[i].type    = (uint8_t)req->steps[i].type;
        steps[i].keycode = req->steps[i].keycode;
        steps[i].wait_ms = (uint16_t)req->steps[i].wait_ms;
        steps[i].tap_ms  = (uint16_t)req->steps[i].tap_ms;
    }

    int rc = rt_macro_set_steps(slot, steps, (uint8_t)cnt);

    zmk_macros_SetMacroResponse *set_resp =
        &resp->response_type.set_macro;
    set_resp->ok    = (rc == 0);
    set_resp->error = (rc < 0) ? (uint32_t)(-rc) : 0;

    resp->which_response_type = zmk_macros_Response_set_macro_tag;
    LOG_DBG("macros_rpc: SetMacro slot=%u steps=%u rc=%d", slot, cnt, rc);
    return rc;
}

/* --- Main request dispatcher --------------------------------------------- */

static bool macros_rpc_handle_request(const zmk_custom_CallRequest *raw_request,
                                      pb_callback_t *encode_response) {
    zmk_macros_Response *resp =
        ZMK_RPC_CUSTOM_SUBSYSTEM_RESPONSE_BUFFER_ALLOCATE(zmk__macros,
                                                          encode_response);

    zmk_macros_Request req = zmk_macros_Request_init_zero;

    pb_istream_t req_stream =
        pb_istream_from_buffer(raw_request->payload.bytes,
                               raw_request->payload.size);
    if (!pb_decode(&req_stream, zmk_macros_Request_fields, &req)) {
        LOG_WRN("macros_rpc: failed to decode request: %s",
                PB_GET_ERROR(&req_stream));
        /* Return a set_macro error response so the host gets a wire reply */
        resp->which_response_type = zmk_macros_Response_set_macro_tag;
        resp->response_type.set_macro.ok    = false;
        resp->response_type.set_macro.error = UINT32_MAX;
        return true;
    }

    int rc = 0;
    switch (req.which_request_type) {
    case zmk_macros_Request_get_macro_tag:
        rc = handle_get_macro(&req.request_type.get_macro, resp);
        break;
    case zmk_macros_Request_set_macro_tag:
        rc = handle_set_macro(&req.request_type.set_macro, resp);
        break;
    default:
        LOG_WRN("macros_rpc: unsupported request type %d",
                req.which_request_type);
        resp->which_response_type            = zmk_macros_Response_set_macro_tag;
        resp->response_type.set_macro.ok    = false;
        resp->response_type.set_macro.error = UINT32_MAX;
        rc = -ENOTSUP;
        break;
    }

    if (rc != 0 &&
        resp->which_response_type == zmk_macros_Response_set_macro_tag) {
        /* Error already encoded in set_macro response (handles set_macro
         * failure and the default/unknown-request case above). */
    } else if (rc != 0) {
        /* Generic fallback error for get_macro and any future handlers. */
        resp->which_response_type            = zmk_macros_Response_set_macro_tag;
        resp->response_type.set_macro.ok    = false;
        resp->response_type.set_macro.error = (uint32_t)(-rc);
    }

    return true;
}

/* Clear all macro slots when ZMK Studio issues a reset_settings RPC. */
static int rt_macro_settings_reset(void) {
    return rt_macro_clear_all();
}

ZMK_RPC_SUBSYSTEM_SETTINGS_RESET(rt_macro, rt_macro_settings_reset);
