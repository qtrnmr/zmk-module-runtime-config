/*
 * Copyright (c) 2026 qtrnmr
 * SPDX-License-Identifier: MIT
 *
 * NVS-backed store for runtime combo params. Each combo registers its live
 * struct + devicetree default; saved values load from NVS and apply to the
 * live struct. Writes are NVS-first.
 */

#include <errno.h>

#include <zephyr/kernel.h>
#include <zephyr/settings/settings.h>
#include <zephyr/sys/printk.h>
#include <zephyr/logging/log.h>

#include <zmk/runtime_combos.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

#define ENTRIES CONFIG_ZMK_RUNTIME_COMBOS_MAX
#define SETTINGS_PREFIX "rt_combo"

static struct entry_state {
    struct rt_combo_params *live;
    struct rt_combo_params dt_default;
    struct rt_combo_params saved;
    bool has_saved;
    bool registered;
} entries[ENTRIES];

K_MUTEX_DEFINE(rt_combo_lock);

static int rt_combo_settings_set(const char *name, size_t len, settings_read_cb read_cb,
                                 void *cb_arg) {
    char *endptr;
    long idx = strtol(name, &endptr, 10);
    if (*endptr != '\0' || idx < 0 || idx >= ENTRIES) {
        return -ENOENT;
    }
    struct rt_combo_params e;
    if (len != sizeof(e)) {
        return -EINVAL;
    }
    int rc = read_cb(cb_arg, &e, sizeof(e));
    if (rc < 0) {
        return rc;
    }
    k_mutex_lock(&rt_combo_lock, K_FOREVER);
    entries[idx].saved = e;
    entries[idx].has_saved = true;
    if (entries[idx].registered && entries[idx].live) {
        *entries[idx].live = e;
    }
    k_mutex_unlock(&rt_combo_lock);
    return 0;
}

SETTINGS_STATIC_HANDLER_DEFINE(rt_combo, SETTINGS_PREFIX, NULL, rt_combo_settings_set, NULL,
                               NULL);

void rt_combo_register(uint8_t index, struct rt_combo_params *live,
                       const struct rt_combo_params *dt_default) {
    if (index >= ENTRIES || live == NULL || dt_default == NULL) {
        return;
    }
    k_mutex_lock(&rt_combo_lock, K_FOREVER);
    entries[index].live = live;
    entries[index].dt_default = *dt_default;
    entries[index].registered = true;
    if (entries[index].has_saved) {
        *live = entries[index].saved;
    }
    k_mutex_unlock(&rt_combo_lock);
}

int rt_combo_get(uint8_t index, struct rt_combo_params *out) {
    if (index >= ENTRIES) {
        return -EINVAL;
    }
    k_mutex_lock(&rt_combo_lock, K_FOREVER);
    int rc = entries[index].registered ? 0 : -ENOENT;
    if (rc == 0 && out) {
        *out = *entries[index].live;
    }
    k_mutex_unlock(&rt_combo_lock);
    return rc;
}

int rt_combo_set(uint8_t index, const struct rt_combo_params *in) {
    if (index >= ENTRIES || in == NULL) {
        return -EINVAL;
    }
    char key[32];
    snprintk(key, sizeof(key), SETTINGS_PREFIX "/%u", index);
    int rc = settings_save_one(key, in, sizeof(*in));
    if (rc) {
        LOG_ERR("rt_combo: settings_save_one(%s) failed: %d", key, rc);
        return rc;
    }
    k_mutex_lock(&rt_combo_lock, K_FOREVER);
    entries[index].saved = *in;
    entries[index].has_saved = true;
    if (entries[index].registered && entries[index].live) {
        *entries[index].live = *in;
    }
    k_mutex_unlock(&rt_combo_lock);
    return 0;
}

int rt_combo_reset(uint8_t index) {
    if (index >= ENTRIES) {
        return -EINVAL;
    }
    char key[32];
    snprintk(key, sizeof(key), SETTINGS_PREFIX "/%u", index);
    settings_delete(key);
    k_mutex_lock(&rt_combo_lock, K_FOREVER);
    entries[index].has_saved = false;
    if (entries[index].registered && entries[index].live) {
        *entries[index].live = entries[index].dt_default;
    }
    k_mutex_unlock(&rt_combo_lock);
    return 0;
}

bool rt_combo_registered(uint8_t index) {
    return index < ENTRIES && entries[index].registered;
}

uint8_t rt_combo_count(void) {
    uint8_t n = 0;
    for (uint8_t i = 0; i < ENTRIES; i++) {
        if (entries[i].registered) n++;
    }
    return n;
}

void rt_combo_clear_all(void) {
    for (uint8_t i = 0; i < ENTRIES; i++) {
        rt_combo_reset(i);
    }
}
