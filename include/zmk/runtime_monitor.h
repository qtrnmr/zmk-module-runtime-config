#pragma once

#include <stdbool.h>

// Live key / layer / keycode monitor (練習モード). The flag lives in RAM only:
// an idle keyboard never streams, and nothing is persisted. Set over the
// `zmk__monitor` custom Studio RPC (monitor_rpc_handler.c); read by the event
// listeners (monitor_listener.c) before raising a custom notification.
bool rt_monitor_enabled(void);
void rt_monitor_set(bool on);
