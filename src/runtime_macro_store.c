// Copyright (c) 2026 qtrnmr and contributors
// SPDX-License-Identifier: MIT

#include <zephyr/logging/log.h>
LOG_MODULE_REGISTER(runtime_macro_store, CONFIG_ZMK_LOG_LEVEL);

#include <zephyr/kernel.h>
#include <zephyr/settings/settings.h>
#include <zephyr/sys/util.h>
#include <zephyr/sys/printk.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>
#include <zmk/runtime_macro.h>

#define SLOTS     CONFIG_ZMK_RUNTIME_MACRO_SLOTS
#define MAX_STEPS CONFIG_ZMK_RUNTIME_MACRO_MAX_STEPS

static struct rt_macro_step cache[SLOTS][MAX_STEPS];
static uint8_t cache_count[SLOTS];

/* Protects cache[] and cache_count[] against concurrent access from the RPC
 * work queue and the behavior thread.  NVS writes are performed OUTSIDE this
 * mutex (they can be slow); the cache is updated INSIDE only after a
 * successful NVS write. */
K_MUTEX_DEFINE(rt_macro_mutex);

/* Internal helper: update cache for slot under the assumption that
 * the caller does NOT hold rt_macro_mutex.  Used by set_steps. */
static void cache_update(uint8_t slot, const struct rt_macro_step *steps,
                         uint8_t count) {
    k_mutex_lock(&rt_macro_mutex, K_FOREVER);
    memcpy(cache[slot], steps, count * sizeof(struct rt_macro_step));
    cache_count[slot] = count;
    k_mutex_unlock(&rt_macro_mutex);
}

int rt_macro_get_steps(uint8_t slot, struct rt_macro_step *out, uint8_t max,
                       uint8_t *count_out) {
    if (slot >= SLOTS) {
        LOG_ERR("rt_macro_get_steps: invalid slot %u (max %u)", slot, SLOTS);
        return -EINVAL;
    }

    k_mutex_lock(&rt_macro_mutex, K_FOREVER);
    uint8_t n = MIN(cache_count[slot], max);
    memcpy(out, cache[slot], n * sizeof(struct rt_macro_step));
    *count_out = n;
    k_mutex_unlock(&rt_macro_mutex);
    return 0;
}

int rt_macro_set_steps(uint8_t slot, const struct rt_macro_step *steps,
                       uint8_t count) {
    if (slot >= SLOTS) {
        LOG_ERR("rt_macro_set_steps: invalid slot %u (max %u)", slot, SLOTS);
        return -EINVAL;
    }
    if (count > MAX_STEPS) {
        LOG_WRN("rt_macro_set_steps: count %u clamped to MAX_STEPS %u",
                count, MAX_STEPS);
        count = MAX_STEPS;
    }

    /* Persist to NVS FIRST (outside the mutex — can be slow).
     * Only update the RAM cache if the save succeeds, so the cache never
     * diverges from what is stored in NVS. */
    char key[24];
    snprintk(key, sizeof(key), "rt_macro/%u", slot);
    /* blob layout: [count][steps...] */
    uint8_t buf[1 + MAX_STEPS * sizeof(struct rt_macro_step)];
    buf[0] = count;
    memcpy(&buf[1], steps, count * sizeof(struct rt_macro_step));
    int rc = settings_save_one(key, buf,
                               1 + count * sizeof(struct rt_macro_step));
    if (rc < 0) {
        LOG_ERR("rt_macro_set_steps: settings_save_one failed: %d", rc);
        return rc;
    }

    /* NVS write succeeded — update the RAM cache atomically. */
    cache_update(slot, steps, count);
    return 0;
}

int rt_macro_clear_all(void) {
    char key[24];
    int first_err = 0;

    k_mutex_lock(&rt_macro_mutex, K_FOREVER);
    for (uint8_t slot = 0; slot < SLOTS; slot++) {
        snprintk(key, sizeof(key), "rt_macro/%u", slot);
        int rc = settings_delete(key);
        if (rc < 0 && first_err == 0) {
            first_err = rc;
            LOG_ERR("rt_macro_clear_all: settings_delete slot %u failed: %d", slot, rc);
        }
        cache_count[slot] = 0;
        memset(cache[slot], 0, MAX_STEPS * sizeof(struct rt_macro_step));
    }
    k_mutex_unlock(&rt_macro_mutex);

    if (first_err == 0) {
        LOG_INF("rt_macro_clear_all: all %u slots cleared", SLOTS);
    }
    return first_err;
}

static int rt_macro_set_cb(const char *name, size_t len,
                           settings_read_cb read_cb, void *cb_arg) {
    if (!name) {
        return -ENOENT;
    }
    uint8_t slot = (uint8_t)strtoul(name, NULL, 10);
    if (slot >= SLOTS) {
        LOG_WRN("rt_macro_set_cb: ignoring unknown key '%s'", name);
        return 0;
    }
    uint8_t buf[1 + MAX_STEPS * sizeof(struct rt_macro_step)];
    int rc = read_cb(cb_arg, buf, MIN(len, sizeof(buf)));
    if (rc <= 0) {
        return 0;
    }
    uint8_t count = buf[0];
    if (count > MAX_STEPS) {
        count = MAX_STEPS;
    }
    /* settings callbacks run at boot (single-threaded), no mutex needed here.
     * Direct write is safe and avoids a nested lock. */
    cache_count[slot] = count;
    memcpy(cache[slot], &buf[1], count * sizeof(struct rt_macro_step));
    LOG_INF("rt_macro_store: loaded slot %u, %u steps", slot, count);
    return 0;
}

SETTINGS_STATIC_HANDLER_DEFINE(rt_macro, "rt_macro", NULL, rt_macro_set_cb,
                               NULL, NULL);
