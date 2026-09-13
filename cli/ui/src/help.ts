/**
 * The UI's explanation dictionaries: what a behavior does, what a parameter
 * means, what an obscure keycode is for, and the Japanese labels/grouping the
 * trackball page needs.
 *
 * Sources, so a wrong entry can be traced back:
 *  - ZMK behaviours / combos / macros: https://zmk.dev/docs/keymaps/...
 *  - trackball fields: cormoran/zmk-module-runtime-input-processor README
 *    (tag zmk-v0.3.0.0), cross-checked against rip_client.py's FIELD_UI.
 *  - roBa-only behaviours (LAYER_TAP_TO_*, TO_*, BT_*, ENCODER_*): the
 *    devicetree in qtrnmr/zmk-config-roBa config/roBa.keymap.
 *
 * Entries nobody could confirm say "(説明未確認)" rather than guessing.
 */
import { MOD_ORDER, paramKind, splitMods } from "./params";
import { pretty } from "./prettyKeycode";
import type { Behavior, Layer, ParamDesc } from "./types";
import { layerLabel } from "./types";

// ---- behaviours -----------------------------------------------------------

/** Keyed by the `display_name` the device reports in /api/state. */
export const BEHAVIOR_HELP: Record<string, string> = {
  // --- ZMK core ---
  "Key Press": "HID のキーコードを 1 つ送る (&kp)。キーを離すとキーコードも離される。",
  Transparent: "このレイヤーでは何もせず、下のレイヤーの割り当てをそのまま使う (&trans)。",
  None: "何も起こさない (&none)。下のレイヤーにも渡さないので、キーを無効化できる。",
  "Momentary Layer": "押している間だけ指定レイヤーを有効にし、離すと戻る (&mo)。",
  "Layer-Tap":
    "長押しでレイヤーを有効化、短く叩くとキーを送る (&lt)。既定は flavor=tap-preferred / tapping-term 200ms。",
  "Mod-Tap":
    "長押しで修飾キー、短く叩くと別のキーを送る (&mt)。既定は flavor=hold-preferred / tapping-term 200ms。",
  "To Layer": "指定レイヤーを有効にし、既定レイヤー以外の他のレイヤーをすべて無効にする (&to)。",
  "Toggle Layer": "指定レイヤーの ON/OFF を切り替える (&tog)。押すたびに反転する。",
  "Sticky Key":
    "修飾キーを「次に押すキー」まで保持する (&sk)。Shift を押しっぱなしにせず大文字が打てる。既定では 1 秒何も押さないと解除。",
  "Sticky Layer": "次にキーを 1 つ押すまでレイヤーを保持する (&sl)。レイヤー版の sticky key。",
  "Caps Word":
    "Caps Lock に似ているが、継続リスト外のキー (既定では英数字・_・BS・Del 以外) を押すか、もう一度押すと自動で解除される (&caps_word)。修飾は A〜Z にだけ掛かる。",
  "Key Repeat": "直前に送ったキーコードをもう一度送る (&key_repeat)。既定では Key usage page のみ追跡する。",
  "Key Toggle":
    "キーの押下をトグルする (&kt)。押されていなければ押しっぱなしにし、押されていれば離す。Shift ロックや Alt-Tab に使う。",
  "Grave/Escape":
    "単独で叩くと Esc、Shift か Gui を押しながらだと ` (GRAVE) を送る mod-morph (&gresc)。",
  Bluetooth:
    "Bluetooth の操作 (&bt)。プロファイルの選択・次/前への移動・切断・プロファイルのクリアができる。",
  "Output Selection": "HID の出力先を USB と BLE で切り替える (&out)。",
  "External Power": "外部電源レール (VCC) の ON / OFF / トグル (&ext_power)。",
  Reset: "キーボードを再起動する (&sys_reset)。保存済みの設定は消えない。",
  Bootloader:
    "ブートローダで再起動する (&bootloader)。USB ドライブとして現れ、uf2 を書き込める状態になる。",
  "Studio Unlock":
    "ZMK Studio からのキーマップ編集を許可する (&studio_unlock)。ロック中は書き込み系の RPC がすべて拒否される。",
  "Mouse Key Press": "マウスのボタンを押す (&mkp)。MB1 = 左、MB2 = 右、MB3 = 中ボタン。",
  mouse_move: "マウスカーソルを動かす (&mmv)。パラメータは X と Y の速度を 1 語に詰めた値。",
  mouse_scroll: "マウスホイールでスクロールする (&msc)。パラメータは X と Y の速度を 1 語に詰めた値。",

  // --- runtime modules ---
  rt_macro:
    "ランタイムマクロ (&rt_macro)。パラメータのスロット番号に保存したキー列を再生する。中身は「マクロ」ページで書き換えられる。",
  rsr_trans:
    "runtime sensor-rotate モジュールが用意する透過インスタンス。回転に何も割り当てず、下のレイヤーの sensor-bindings に委ねる。",

  // --- roBa (config/roBa.keymap) ---
  ENCODER_MSC_DOWN_UP:
    "エンコーダ回転でスクロール。時計回りで SCRL_UP、反時計回りで SCRL_DOWN (&msc)、tap-ms 50。devicetree 固定で runtime からは変えられない。",
  ENCODER_VOL_DOWN_UP:
    "エンコーダ回転で音量。既定は時計回りで C_VOLUME_DOWN、反時計回りで C_VOLUME_UP、tap-ms 20。runtime sensor-rotate なのでこの UI から変更できる。",
  TO_LAYER_0:
    "レイヤー 0 (DEFAULT / Windows 用) に切り替えてから、パラメータのキーを 1 回押すマクロ。",
  TO_APPLE_DEFAULT: "レイヤー 1 (APPLE / Mac 用) に切り替えてから、パラメータのキーを 1 回押すマクロ。",
  TO_ANDROID: "レイヤー 2 (ANDROID) に切り替えてから、パラメータのキーを 1 回押すマクロ。",
  LAYER_TAP_TO_0:
    "長押しで param1 のレイヤーを一時オン (&mo)、タップで TO_LAYER_0 — レイヤー 0 (Windows) に戻ってから param2 のキーを送る。tapping-term 200ms (runtime hold-tap なので変更可)。",
  LAYER_TAP_TO_APPLE:
    "長押しで param1 のレイヤーを一時オン (&mo)、タップで TO_APPLE_DEFAULT — レイヤー 1 (Mac) に戻ってから param2 のキーを送る。tapping-term 200ms (変更可)。",
  LAYER_TAP_TO_ANDROID:
    "長押しで param1 のレイヤーを一時オン (&mo)、タップで TO_ANDROID — レイヤー 2 (Android) に戻ってから param2 のキーを送る。tapping-term 200ms (変更可)。",
  BT_H_FOLD: "BT プロファイル 3 (Galaxy Z Fold) を選び、続けてレイヤー 2 (ANDROID) に切り替えるマクロ。",
  BT_J_MAC: "BT プロファイル 0 (Mac mini) を選び、続けてレイヤー 1 (APPLE) に切り替えるマクロ。",
  BT_K_WIN: "BT プロファイル 1 (職場 Windows) を選び、続けてレイヤー 0 (DEFAULT) に切り替えるマクロ。",
};

// ---- binding parameters ---------------------------------------------------

/** Keyed by the metadata `name` the device reports for a parameter slot. */
export const PARAM_HELP: Record<string, string> = {
  Key: "送る HID キーコード。修飾トグルを足すと LC(LS(Z)) のように同時押しになる。",
  Layer: "対象のレイヤー番号。名前はレイヤーカードで付け替えられる。",
  Slot: "ランタイムマクロのスロット番号。中身は「マクロ」ページで編集する。",
  Profile: "Bluetooth のプロファイル番号 (0 起点)。1 台の接続先が 1 プロファイルを占める。",
  "X Y": "X と Y の速度を 1 語に詰めた値。ZMK の MOVE_X/MOVE_Y・SCRL_LEFT 等のマクロで作る。",
  // Bluetooth / Output / Mouse の定数 (metadata の constant 名がそのまま見出しになる)
  "Select Profile": "指定した番号のプロファイルに切り替える (BT_SEL)。",
  "Next Profile": "次のプロファイルに進む (BT_NXT)。",
  "Previous Profile": "前のプロファイルに戻る (BT_PRV)。",
  "Clear All Profiles": "全プロファイルのペアリング情報を消す (BT_CLR_ALL)。接続先の再ペアリングが必要になる。",
  "Clear Selected Profile": "選択中プロファイルのペアリング情報を消す (BT_CLR)。",
  "Disconnect Profile": "指定プロファイルの接続を切る (BT_DISC)。ペアリングは残る。",
  "Toggle Outputs": "USB と BLE の出力先を切り替える (OUT_TOG)。",
  "USB Output": "出力先を USB に固定する (OUT_USB)。",
  "BLE Output": "出力先を BLE に固定する (OUT_BLE)。",
  MB1: "マウス左ボタン。",
  MB2: "マウス右ボタン。",
  MB3: "マウス中ボタン (ホイール押し込み)。",
  MB4: "マウス 4 番ボタン (多くの環境で「戻る」)。",
  MB5: "マウス 5 番ボタン (多くの環境で「進む」)。",
};

/** The eight modifier toggles in the keycode picker. */
export const MOD_HELP: Record<string, string> = {
  LC: "左 Ctrl を同時押しにする。",
  LS: "左 Shift を同時押しにする。",
  LA: "左 Alt (Mac では ⌥ option) を同時押しにする。",
  LG: "左 Gui (Mac では ⌘ command、Windows では Win) を同時押しにする。",
  RC: "右 Ctrl を同時押しにする。",
  RS: "右 Shift を同時押しにする。",
  RA: "右 Alt (JIS 配列では AltGr / 変換系に割り当てられることがある) を同時押しにする。",
  RG: "右 Gui (⌘ / Win) を同時押しにする。",
};

// ---- keycodes -------------------------------------------------------------

/** Modifier prefix -> the same word prettyKeycode.ts uses, so `LC(LS(Z))`
 *  reads as `Ctrl+Shift+Z` and never contradicts the key cap. */
const MOD_WORD: Record<string, string> = {
  LC: "Ctrl", RC: "Ctrl",
  LS: "Shift", RS: "Shift",
  LA: "Alt", RA: "Alt",
  LG: "Gui", RG: "Gui",
};

/** Keycodes whose name does not say what they do. Both the ZMK doc spelling
 *  and the shortest alias the device actually reports are listed, because the
 *  server's reverse map picks the shortest one. */
export const KEYCODE_HELP: Record<string, string> = {
  LANG1: "かな。JIS キーボードの「かな」キー。macOS では IME をかな入力に切り替える。",
  LANGUAGE_1: "かな。JIS キーボードの「かな」キー。macOS では IME をかな入力に切り替える。",
  LANG2: "英数。JIS キーボードの「英数」キー。macOS では IME を英数入力に切り替える。",
  LANGUAGE_2: "英数。JIS キーボードの「英数」キー。macOS では IME を英数入力に切り替える。",

  K_MUTE: "ミュート (キーボード usage page)。",
  C_MUTE: "ミュート (consumer usage page)。",
  C_VOL_UP: "音量を上げる。",
  C_VOLUME_UP: "音量を上げる。",
  C_VOL_DN: "音量を下げる。",
  C_VOLUME_DOWN: "音量を下げる。",
  C_PP: "再生 / 一時停止 (トグル)。",
  C_PLAY_PAUSE: "再生 / 一時停止 (トグル)。",
  C_NEXT: "次のトラックへ。",
  C_NEXT_TRACK: "次のトラックへ。",
  C_PREV: "前のトラックへ。",
  C_PREVIOUS_TRACK: "前のトラックへ。",
  C_BRI_UP: "画面の明るさを上げる。",
  C_BRI_INC: "画面の明るさを上げる。",
  C_BRI_DN: "画面の明るさを下げる。",
  C_BRI_DEC: "画面の明るさを下げる。",

  LCTRL: "左 Ctrl。",
  RCTRL: "右 Ctrl。",
  LSHIFT: "左 Shift。",
  RSHIFT: "右 Shift。",
  LALT: "左 Alt (Mac では ⌥ option)。",
  RALT: "右 Alt (Mac では ⌥ option、JIS では AltGr 的に使われることがある)。",
  LGUI: "左 Gui。Mac では ⌘ command、Windows では Win キー。",
  RGUI: "右 Gui。Mac では ⌘ command、Windows では Win キー。",
  LEFT_META: "左 Gui。Mac では ⌘ command、Windows では Win キー。",
  RIGHT_META: "右 Gui。Mac では ⌘ command、Windows では Win キー。",

  CAPS: "Caps Lock。",
  CLCK: "Caps Lock。",
  GLOBE: "Apple の 🌐 (Fn / Globe) キー。macOS では絵文字パレットや入力ソース切替に使われる。",
  PSCRN: "Print Screen。Windows ではスクリーンショット系のショートカットの起点。",
  SLCK: "Scroll Lock。",
  PAUSE_BREAK: "Pause / Break。",
  INS: "Insert。上書き入力の切り替え。",
  K_APP: "アプリケーションキー (メニューキー)。右クリック相当のコンテキストメニューを開く。",
  K_APPLICATION:
    "アプリケーションキー (メニューキー)。右クリック相当のコンテキストメニューを開く。",
};

/** Generic note for the keypad block, which is too big to list key by key. */
const KEYPAD_HELP = "テンキー (keypad) 側のキー。Num Lock の状態に依存する環境がある。";

/**
 * Explanation for a canonical keycode name, unwrapping modifier prefixes:
 * `LC(LS(Z))` -> `Ctrl+Shift+Z`. Returns undefined when there is nothing
 * useful to say, so callers can skip the ⓘ entirely.
 */
export function keycodeHelp(name: string): string | undefined {
  const words: string[] = [];
  let rest = name;
  for (;;) {
    const m = /^([LR][GCAS])\((.*)\)$/.exec(rest);
    if (!m) break;
    words.push(MOD_WORD[m[1]]);
    rest = m[2];
  }
  const base = KEYCODE_HELP[rest] ?? (rest.startsWith("KP_") ? KEYPAD_HELP : undefined);
  if (!words.length) return base;
  const combo = `${[...words, pretty(rest)].join("+")} の同時押し。`;
  return base ? `${combo} ${rest}: ${base}` : combo;
}

// ---- hold-tap / combos / encoder / macros ---------------------------------

export const HOLDTAP_HELP: Record<string, string> = {
  "tapping-term":
    "この ms を超えて押し続けると hold と判定する。既定の &mt / &lt は 200ms。-1 は未設定 (behavior 側の既定値)。",
  "quick-tap":
    "タップ直後この ms 以内にもう一度押すと、必ず tap 側が出る。Backspace のように「叩いてから押しっぱなしで連打」したいキーで使う。0 で無効。",
  "prior-idle":
    "直前の非修飾キーからこの ms 以内に押されたら、必ず tap と判定する。速く打っている間ホームロー mod が暴発するのを防ぎ、入力遅延も消える。",
  flavor: "hold か tap かを決めるルール。下の 4 種から選ぶ。",
  "hold-preferred": "tapping-term を過ぎるか、他のキーが「押された」時点で hold にする (&mt の既定)。",
  balanced: "tapping-term を過ぎるか、他のキーが押されて「離された」時点で hold にする。ホームロー mod 向け。",
  "tap-preferred":
    "tapping-term を過ぎた時だけ hold にする。他のキーを押しても判定は変わらない (&lt の既定)。",
  "tap-unless-interrupted":
    "tapping-term 内に他のキーが押された時だけ hold。それ以外は常に tap (判定が逆向き)。",
};

export const COMBO_HELP: Record<string, string> = {
  timeout: "key-positions のキーを全部この ms 以内に押すとコンボが成立する。",
  "prior-idle":
    "コンボのキーの直前この ms 以内に非修飾キーが押されていたら、コンボを成立させない。速く打っている時の誤爆防止。",
  "slow-release":
    "ON にすると key-positions が全部離れるまでコンボの binding を離さない。OFF (既定) はどれか 1 つが離れた時点で離す。",
  layers: "コンボを有効にするレイヤー。1 つも選ばないと全レイヤーで有効になる。",
};

export const ENCODER_HELP: Record<string, string> = {
  tap_ms: "回転 1 ノッチあたり、割り当てた behavior を押したままにする ms。",
};

export const MACRO_HELP: Record<string, string> = {
  type: "tap = 押して離す、press = 押したまま、release = 離す。修飾を押しっぱなしにしたい時に press / release を使う。",
  wait_ms: "この手順と次の手順のあいだに入れる待ち時間 (ms)。",
  tap_ms: "tap のとき、キーを押したままにする ms。",
};

// ---- trackball (runtime input processor) ----------------------------------

export interface FieldHelp {
  /** Short Japanese name shown instead of the raw devicetree field name. */
  label: string;
  help: string;
  group: string;
}

export const TB_SPEED = "速度";
export const TB_INVERT = "反転・入替";
export const TB_SNAP = "軸スナップ";
export const TB_TEMP_LAYER = "一時レイヤー";
export const TB_OTHER = "その他";

/** Group order on the page; "その他" is appended only when it has fields. */
export const TRACKBALL_GROUPS = [TB_SPEED, TB_INVERT, TB_SNAP, TB_TEMP_LAYER] as const;

/** Keyed by the field `name` in rip_client.py's FIELD_UI. */
export const TRACKBALL_HELP: Record<string, FieldHelp> = {
  "scale-multiplier": {
    label: "速度の倍率 (分子)",
    help: "出力 = 入力 × 倍率 ÷ 除数。2 / 1 で 2 倍速。端数は内部で持ち越すので刻みは荒くならない。",
    group: TB_SPEED,
  },
  "scale-divisor": {
    label: "速度の除数 (分母)",
    help: "出力 = 入力 × 倍率 ÷ 除数。1 / 2 で半速。0 にはできない。",
    group: TB_SPEED,
  },
  rotation: {
    label: "回転角 (度)",
    help: "入力ベクトルを度単位で回す。ボールやセンサーの取り付け向きのずれを補正する。X と Y は対で処理される。",
    group: TB_SPEED,
  },
  "x-invert": {
    label: "X 軸を反転",
    help: "左右の動きを逆向きにする。",
    group: TB_INVERT,
  },
  "y-invert": {
    label: "Y 軸を反転",
    help: "上下の動きを逆向きにする。",
    group: TB_INVERT,
  },
  "xy-swap": {
    label: "X と Y を入れ替え",
    help: "X 軸と Y 軸の入力を入れ替える。センサーを 90 度回して実装した場合に使う。",
    group: TB_INVERT,
  },
  "xy-to-scroll": {
    label: "移動をスクロールに変換",
    help: "ポインタ移動をホイールスクロールとして出力する。",
    group: TB_INVERT,
  },
  "axis-snap-mode": {
    label: "スナップする軸",
    help: "none = 無効、x = 横方向だけ通す、y = 縦方向だけ通す。斜めスクロールを抑えるための軸ロック。",
    group: TB_SNAP,
  },
  "axis-snap-threshold": {
    label: "ロック解除のしきい値",
    help: "抑えている側の軸の移動量を積算し、この値を超えるとロックを解除する。",
    group: TB_SNAP,
  },
  "axis-snap-timeout": {
    label: "しきい値の減衰時間 (ms)",
    help: "積算した移動量がこの時間をかけてしきい値ぶん減衰する。短いほどロックが外れにくい。",
    group: TB_SNAP,
  },
  "temp-layer-enabled": {
    label: "一時レイヤーを使う",
    help: "ポインタを動かしたあいだだけ指定レイヤーを自動で有効にする機能の ON / OFF。",
    group: TB_TEMP_LAYER,
  },
  "temp-layer-layer": {
    label: "一時レイヤーの対象",
    help: "ポインタ操作中に有効にするレイヤー。",
    group: TB_TEMP_LAYER,
  },
  "temp-layer-activation-delay": {
    label: "有効化までの遅延 (ms)",
    help: "ポインタが動き始めてからレイヤーを有効にするまでの待ち時間。短すぎると触れただけで切り替わる。",
    group: TB_TEMP_LAYER,
  },
  "temp-layer-deactivation-delay": {
    label: "解除までの遅延 (ms)",
    help: "ポインタが止まってからレイヤーを解除するまでの待ち時間。キーを押した場合は (修飾キーと一時レイヤー上のキーを除き) 即座に解除される。",
    group: TB_TEMP_LAYER,
  },
  "active-layers": {
    label: "有効レイヤーのビットマスク",
    help: "このプロセッサを動かすレイヤーを 32bit のビットマスクで指定する (bit 0 = レイヤー 0)。0 は「全レイヤーで有効」。例: 0x3 = レイヤー 0 と 1。",
    group: TB_TEMP_LAYER,
  },
};

/** Split the device's field list into the page's cards, keeping FIELD_UI order
 *  inside each group. Unknown field names (another keyboard's processor) fall
 *  into "その他" with their raw name. */
export function groupTrackballFields<T extends { name: string }>(
  fields: T[],
): { group: string; fields: T[] }[] {
  const groups: string[] = [...TRACKBALL_GROUPS];
  const out = new Map<string, T[]>(groups.map((g) => [g, []]));
  for (const f of fields) {
    const g = TRACKBALL_HELP[f.name]?.group ?? TB_OTHER;
    if (!out.has(g)) out.set(g, []);
    out.get(g)!.push(f);
  }
  return [...out.entries()]
    .filter(([, fs]) => fs.length)
    .map(([group, fs]) => ({ group, fields: fs }));
}

// ---- parameter rendering for the board tooltip ----------------------------

/** `Layer 8 · SETTING`, `Key LANG2 · 英数` — one line per meaningful metadata
 *  slot of a binding, so a tooltip can say what 8 / 458897 actually mean. */
export function paramLines(
  behavior: Behavior | undefined,
  binding: { param1: number; param2: number },
  layers: Layer[],
  rev: Map<number, string>,
): string[] {
  const meta = behavior?.metadata?.[0];
  if (!meta) return [];
  const one = (descs: ParamDesc[], value: number): string | null => {
    const kind = paramKind(descs);
    const name = descs[0]?.name ?? "";
    if (kind === "layer_id") {
      const l = layers.find((x) => x.index === value);
      return `${name || "Layer"} ${value}${l ? ` · ${layerLabel(l)}` : ""}`;
    }
    if (kind === "hid_usage") {
      const canonical = keycodeText(rev, value);
      const shown = pretty(canonical);
      return `${name || "Key"} ${canonical}${shown === canonical ? "" : ` · ${shown}`}`;
    }
    if (kind === "constant") {
      const hit = descs.find((d) => d.type === "constant" && d.value === value);
      return hit ? `${hit.name} (${value})` : null;
    }
    if (kind === "range") return `${name || "値"} ${value}`;
    return null;
  };
  return [one(meta.param1, binding.param1), one(meta.param2, binding.param2)].filter(
    (s): s is string => !!s,
  );
}

/** Same rule as macroFormat.keycodeName, kept here so help.ts stays standalone. */
function keycodeText(rev: Map<number, string>, value: number): string {
  const { base, mods } = splitMods(value);
  const text = rev.get(base) ?? `0x${base.toString(16).toUpperCase()}`;
  return MOD_ORDER.filter((m) => mods.includes(m)).reduceRight((t, m) => `${m}(${t})`, text);
}
