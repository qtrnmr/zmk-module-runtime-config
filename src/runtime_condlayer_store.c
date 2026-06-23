/*
 * Copyright (c) 2026 qtrnmr
 * SPDX-License-Identifier: MIT
 *
 * NVS-backed store for runtime conditional-layer entries. Each fork entry
 * registers its live struct + devicetree default; saved values load from NVS
 * and apply to the live struct. Writes are NVS-first.
 */

#include <errno.h>

#include <zephyr/kernel.h>
#include <zephyr/settings/settings.h>
#include <zephyr/sys/printk.h>
#include <zephyr/logging/log.h>

#include <zmk/runtime_condlayers.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

#define ENTRIES CONFIG_ZMK_RUNTIME_CONDLAYERS_MAX
#define SETTINGS_PREFIX "rt_condlayer"

static struct entry_state {
    struct rt_condlayer_entry *live;
    struct rt_condlayer_entry dt_default;
    struct rt_condlayer_entry saved;
    bool has_saved;
    bool registered;
} entries[ENTRIES];

K_MUTEX_DEFINE(rt_condlayer_lock);

static int rt_condlayer_settings_set(const char *name, size_t len, settings_read_cb read_cb,
                                     void *cb_arg) {
    char *endptr;
    long idx = strtol(name, &endptr, 10);
    if (*endptr != '\0' || idx < 0 || idx >= ENTRIES) {
        return -ENOENT;
    }
    struct rt_condlayer_entry e;
    if (len != sizeof(e)) {
        return -EINVAL;
    }
    int rc = read_cb(cb_arg, &e, sizeof(e));
    if (rc < 0) {
        return rc;
    }
    k_mutex_lock(&rt_condlayer_lock, K_FOREVER);
    entries[idx].saved = e;
    entries[idx].has_saved = true;
    if (entries[idx].registered && entries[idx].live) {
        *entries[idx].live = e;
    }
    k_mutex_unlock(&rt_condlayer_lock);
    return 0;
}

SETTINGS_STATIC_HANDLER_DEFINE(rt_condlayer, SETTINGS_PREFIX, NULL, rt_condlayer_settings_set, NULL,
                               NULL);

void rt_condlayer_register(uint8_t index, struct rt_condlayer_entry *live,
                           const struct rt_condlayer_entry *dt_default) {
    if (index >= ENTRIES || live == NULL || dt_default == NULL) {
        return;
    }
    k_mutex_lock(&rt_condlayer_lock, K_FOREVER);
    entries[index].live = live;
    entries[index].dt_default = *dt_default;
    entries[index].registered = true;
    if (entries[index].has_saved) {
        *live = entries[index].saved;
    }
    k_mutex_unlock(&rt_condlayer_lock);
}

int rt_condlayer_get(uint8_t index, struct rt_condlayer_entry *out) {
    if (index >= ENTRIES) {
        return -EINVAL;
    }
    k_mutex_lock(&rt_condlayer_lock, K_FOREVER);
    int rc = entries[index].registered ? 0 : -ENOENT;
    if (rc == 0 && out) {
        *out = *entries[index].live;
    }
    k_mutex_unlock(&rt_condlayer_lock);
    return rc;
}

int rt_condlayer_set(uint8_t index, const struct rt_condlayer_entry *in) {
    if (index >= ENTRIES || in == NULL) {
        return -EINVAL;
    }
    char key[32];
    snprintk(key, sizeof(key), SETTINGS_PREFIX "/%u", index);
    int rc = settings_save_one(key, in, sizeof(*in));
    if (rc) {
        LOG_ERR("rt_condlayer: settings_save_one(%s) failed: %d", key, rc);
        return rc;
    }
    k_mutex_lock(&rt_condlayer_lock, K_FOREVER);
    entries[index].saved = *in;
    entries[index].has_saved = true;
    if (entries[index].registered && entries[index].live) {
        *entries[index].live = *in;
    }
    k_mutex_unlock(&rt_condlayer_lock);
    return 0;
}

int rt_condlayer_reset(uint8_t index) {
    if (index >= ENTRIES) {
        return -EINVAL;
    }
    char key[32];
    snprintk(key, sizeof(key), SETTINGS_PREFIX "/%u", index);
    settings_delete(key);
    k_mutex_lock(&rt_condlayer_lock, K_FOREVER);
    entries[index].has_saved = false;
    if (entries[index].registered && entries[index].live) {
        *entries[index].live = entries[index].dt_default;
    }
    k_mutex_unlock(&rt_condlayer_lock);
    return 0;
}

bool rt_condlayer_registered(uint8_t index) {
    return index < ENTRIES && entries[index].registered;
}

void rt_condlayer_clear_all(void) {
    for (uint8_t i = 0; i < ENTRIES; i++) {
        rt_condlayer_reset(i);
    }
}
