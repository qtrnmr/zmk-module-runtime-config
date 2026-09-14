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
  "Key Press": "押している間そのキーが押された状態になる、いちばん普通のキー (&kp)。離すと戻る。",
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
  "Key Repeat": "直前に押したキーをもう一度押す (&key_repeat)。音量などのメディアキーは対象外。",
  "Key Toggle":
    "キーの押下をトグルする (&kt)。押されていなければ押しっぱなしにし、押されていれば離す。Shift ロックや Alt-Tab に使う。",
  "Grave/Escape":
    "単独で叩くと Esc、Shift か Gui を押しながらだと ` (GRAVE) を送る mod-morph (&gresc)。",
  Bluetooth:
    "Bluetooth の操作 (&bt)。プロファイルの選択・次/前への移動・切断・プロファイルのクリアができる。",
  "Output Selection": "キー入力の送り先を USB と Bluetooth で切り替える (&out)。",
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
    "runtime sensor-rotate モジュールの dtsi が用意する透過インスタンス。回転に固有の動作を持たない土台で、cw/ccw はこの UI から書き込む (モジュール README 未確認: dtsi が「transparent」と説明しているところまでが確実)。",

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

/** Japanese name for a behaviour, so the picker and the "現在" card can say what
 *  a key does without the user knowing the ZMK spelling. Never contradicts
 *  BEHAVIOR_HELP above; the roBa-only entries follow config/roBa.keymap. */
export const BEHAVIOR_JA: Record<string, string> = {
  "Key Press": "キー入力",
  Transparent: "透過 (下のレイヤーに任せる)",
  None: "無効",
  "Key Toggle": "キーを押しっぱなしにトグル",
  "Key Repeat": "直前のキーを繰り返す",
  "Caps Word": "単語だけ大文字",
  "Grave/Escape": "Esc (修飾付きで `)",
  "Sticky Key": "次の 1 打だけ修飾",

  "Momentary Layer": "押している間レイヤー",
  "To Layer": "レイヤーへ切替",
  "Toggle Layer": "レイヤーをトグル",
  "Sticky Layer": "次の 1 打だけレイヤー",

  "Mod-Tap": "長押し修飾 / タップでキー",
  "Layer-Tap": "長押しレイヤー / タップでキー",
  LAYER_TAP_TO_0: "長押しレイヤー / タップで Windows に戻る+キー",
  LAYER_TAP_TO_APPLE: "長押しレイヤー / タップで Mac に戻る+キー",
  LAYER_TAP_TO_ANDROID: "長押しレイヤー / タップで Android に戻る+キー",

  rt_macro: "ランタイムマクロ",
  TO_LAYER_0: "Windows に戻ってキー入力",
  TO_APPLE_DEFAULT: "Mac に戻ってキー入力",
  TO_ANDROID: "Android に戻ってキー入力",
  BT_H_FOLD: "BT 3 (Fold) + Android 層へ",
  BT_J_MAC: "BT 0 (Mac mini) + Apple 層へ",
  BT_K_WIN: "BT 1 (職場 Windows) + Windows 層へ",

  "Mouse Key Press": "マウスボタン",
  mouse_move: "マウス移動",
  mouse_scroll: "スクロール",
  ENCODER_VOL_DOWN_UP: "エンコーダ: 音量",
  ENCODER_MSC_DOWN_UP: "エンコーダ: スクロール (MSC)",
  rsr_trans: "エンコーダ透過",

  Bluetooth: "Bluetooth 操作",
  "Output Selection": "出力先 (USB/BT) 切替",
  "External Power": "外部電源",
  Reset: "再起動",
  Bootloader: "ブートローダーへ (焼き込みモード)",
  "Studio Unlock": "Studio のロック解除",
};

export const BG_BASIC = "基本";
export const BG_LAYER = "レイヤー";
export const BG_HOLDTAP = "長押し (hold-tap)";
export const BG_MACRO = "マクロ";
export const BG_POINTER = "マウス・エンコーダ";
export const BG_SYSTEM = "Bluetooth・システム";
export const BG_OTHER = "その他";

/** Group order in the behaviour picker; "その他" is appended only when the
 *  device reports a behaviour this file has never heard of. */
export const BEHAVIOR_GROUP_ORDER = [
  BG_BASIC,
  BG_LAYER,
  BG_HOLDTAP,
  BG_MACRO,
  BG_POINTER,
  BG_SYSTEM,
] as const;

/** display_name -> group. Key order inside the object is the order the picker
 *  lists a group's rows in, so the common ones come first. */
export const BEHAVIOR_GROUPS: Record<string, string> = {
  "Key Press": BG_BASIC,
  Transparent: BG_BASIC,
  None: BG_BASIC,
  "Key Toggle": BG_BASIC,
  "Key Repeat": BG_BASIC,
  "Caps Word": BG_BASIC,
  "Grave/Escape": BG_BASIC,
  "Sticky Key": BG_BASIC,

  "Momentary Layer": BG_LAYER,
  "To Layer": BG_LAYER,
  "Toggle Layer": BG_LAYER,
  "Sticky Layer": BG_LAYER,

  "Mod-Tap": BG_HOLDTAP,
  "Layer-Tap": BG_HOLDTAP,
  LAYER_TAP_TO_0: BG_HOLDTAP,
  LAYER_TAP_TO_APPLE: BG_HOLDTAP,
  LAYER_TAP_TO_ANDROID: BG_HOLDTAP,

  rt_macro: BG_MACRO,
  TO_LAYER_0: BG_MACRO,
  TO_APPLE_DEFAULT: BG_MACRO,
  TO_ANDROID: BG_MACRO,
  BT_H_FOLD: BG_MACRO,
  BT_J_MAC: BG_MACRO,
  BT_K_WIN: BG_MACRO,

  "Mouse Key Press": BG_POINTER,
  mouse_move: BG_POINTER,
  mouse_scroll: BG_POINTER,
  ENCODER_VOL_DOWN_UP: BG_POINTER,
  ENCODER_MSC_DOWN_UP: BG_POINTER,
  rsr_trans: BG_POINTER,

  Bluetooth: BG_SYSTEM,
  "Output Selection": BG_SYSTEM,
  "External Power": BG_SYSTEM,
  Reset: BG_SYSTEM,
  Bootloader: BG_SYSTEM,
  "Studio Unlock": BG_SYSTEM,
};

/** Japanese name, falling back to the raw display_name for a behaviour this
 *  file does not know (another keyboard's devicetree). */
export function behaviorJa(name: string): string {
  return BEHAVIOR_JA[name] ?? name;
}

/** First sentence of BEHAVIOR_HELP: one line under a picker row. */
export function behaviorSummary(name: string): string {
  const help = BEHAVIOR_HELP[name];
  if (!help) return "";
  const i = help.indexOf("。");
  return i === -1 ? help : help.slice(0, i + 1);
}

/** Split the device's behaviour list into the picker's sections, keeping
 *  BEHAVIOR_GROUPS order inside each one. */
export function groupBehaviors<T extends { display_name: string }>(
  behaviors: T[],
): { group: string; behaviors: T[] }[] {
  const rank = Object.keys(BEHAVIOR_GROUPS);
  const out = new Map<string, T[]>(BEHAVIOR_GROUP_ORDER.map((g) => [g, []]));
  for (const b of behaviors) {
    const g = BEHAVIOR_GROUPS[b.display_name] ?? BG_OTHER;
    if (!out.has(g)) out.set(g, []);
    out.get(g)!.push(b);
  }
  for (const list of out.values())
    list.sort((a, b) => rank.indexOf(a.display_name) - rank.indexOf(b.display_name));
  return [...out.entries()]
    .filter(([, bs]) => bs.length)
    .map(([group, bs]) => ({ group, behaviors: bs }));
}

// ---- binding parameters ---------------------------------------------------

/** Keyed by the metadata `name` the device reports for a parameter slot. */
export const PARAM_HELP: Record<string, string> = {
  Key: "押されたことにするキー。修飾トグルを足すと LC(LS(Z)) のように Ctrl+Shift+Z の同時押しになる。",
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

  K_MUTE: "ミュート (音を消す / 戻す)。キーボード扱いの Mute で、ほぼ全 OS で効く。",
  C_MUTE: "ミュート (音を消す / 戻す)。メディアキー扱いの Mute で、K_MUTE が効かない環境向け。",
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

  // --- 記号 ------------------------------------------------------------
  // The 21 shifted symbols are one keycode each, not "the key plus Shift":
  // EXCL already carries the LS bit. Saying which plain key they sit above is
  // the fastest way to recognise them.
  EXCL: "! (感嘆符)。US 配列の Shift+1 を 1 キーで送る。",
  ATSN: "@ (アットマーク)。US 配列の Shift+2 を 1 キーで送る。",
  HASH: "# (シャープ)。US 配列の Shift+3 を 1 キーで送る。",
  DLLR: "$ (ドル)。US 配列の Shift+4 を 1 キーで送る。",
  PRCNT: "% (パーセント)。US 配列の Shift+5 を 1 キーで送る。",
  CRRT: "^ (キャレット)。US 配列の Shift+6 を 1 キーで送る。",
  AMPS: "& (アンパサンド)。US 配列の Shift+7 を 1 キーで送る。",
  ASTRK: "* (アスタリスク)。US 配列の Shift+8 を 1 キーで送る。",
  LPAR: "( (左丸かっこ)。US 配列の Shift+9 を 1 キーで送る。",
  RPAR: ") (右丸かっこ)。US 配列の Shift+0 を 1 キーで送る。",
  UNDER: "_ (アンダースコア)。US 配列の Shift+- を 1 キーで送る。",
  PLUS: "+ (プラス)。US 配列の Shift+= を 1 キーで送る。テンキーの + は KPLS。",
  LBRC: "{ (左波かっこ)。US 配列の Shift+[ を 1 キーで送る。",
  RBRC: "} (右波かっこ)。US 配列の Shift+] を 1 キーで送る。",
  PIPE: "| (縦棒)。US 配列の Shift+\\ を 1 キーで送る。",
  COLN: ": (コロン)。US 配列の Shift+; を 1 キーで送る。",
  DQT: '" (二重引用符)。US 配列の Shift+\' を 1 キーで送る。',
  LABT: "< (小なり)。US 配列の Shift+, を 1 キーで送る。",
  GT: "> (大なり)。US 配列の Shift+. を 1 キーで送る。",
  QMARK: "? (疑問符)。US 配列の Shift+/ を 1 キーで送る。",
  TILD: "~ (チルダ)。US 配列の Shift+` を 1 キーで送る。",

  APOSTROPHE: "' (シングルクォート)。Shift で \" になる。",
  BSLH: "\\ (バックスラッシュ)。JIS 配列の環境では ￥ が出ることがある。",
  CMMA: ", (カンマ)。",
  DOT: ". (ピリオド)。",
  EQL: "= (イコール)。Shift で + になる。",
  FSLH: "/ (スラッシュ)。",
  GRAV: "` (バッククォート)。US 配列で 1 の左、Esc の下にあるキー。",
  LBKT: "[ (左角かっこ)。",
  RBKT: "] (右角かっこ)。",
  MINUS: "- (ハイフン / マイナス)。",
  SEMI: "; (セミコロン)。",
  NON_US_BSLH: "US 配列には無いキー。欧州系の配列で左 Shift の右隣にある \\ / | のキー。",
  NON_US_HASH: "US 配列には無いキー。英国配列などで Enter の左にある # / ~ のキー。",
  NUHS: "US 配列には無いキー。英国配列などで Enter の左にある # / ~ のキー。",
  PIPE2: "| (縦棒)。NON_US_BSLH を Shift 付きで送る予備の定義で、欧州系の配列向け。",
  TILDE2: "~ (チルダ)。NUHS を Shift 付きで送る予備の定義で、英国配列などの向け。",

  // --- テンキー --------------------------------------------------------
  KPLS: "テンキーの +。",
  KP_MINUS: "テンキーの −。",
  KP_MULTIPLY: "テンキーの ×。",
  KP_SLASH: "テンキーの ÷。",
  KP_EQUAL: "テンキーの =。",
  KP_EQUAL_AS400: "テンキーの = (AS/400 端末向けの予備の定義)。ふつうは KP_EQUAL を使う。",
  KP_DOT: "テンキーの .。",
  KP_COMMA: "テンキーの , (JIS のテンキーでは 、)。",
  KP_ENTER: "テンキーの Enter。",
  KP_LPAR: "テンキーの (。",
  KP_RPAR: "テンキーの )。",
  KP_CLEAR: "テンキーの Clear。入力中の数値を消す。",
  KP_NLCK: "Num Lock。テンキーで数字を打てるかどうかを切り替える。",

  // --- メディア --------------------------------------------------------
  C_PLAY: "再生する。",
  C_PAUSE: "一時停止する (再生には戻らない)。押すたびに再生と一時停止を入れ替えたいなら M_PLAY か K_PP。",
  C_STOP: "再生を止める。",
  C_STOP_EJECT: "再生を止めてディスクを取り出す。",
  C_REC: "録画・録音を始める。",
  C_FF: "早送り。",
  C_FAST_FORWARD: "早送り。",
  C_RW: "巻き戻し。",
  C_REWIND: "巻き戻し。",
  C_SLOW: "スロー再生。",
  C_SLOW2: "スロー再生 (予備の定義)。C_SLOW が効かない機器向け。",
  C_REPEAT: "リピート再生を切り替える。",
  C_SHUFFLE: "シャッフル再生を切り替える。",
  C_MODE_STEP: "再生モードを順に切り替える。",
  C_CAPTIONS: "字幕の表示を切り替える。",
  C_SNAPSHOT: "映像の静止画を保存する。",
  C_PIP: "ピクチャーインピクチャー (小窓表示) を切り替える。",
  C_ASPECT: "画面の縦横比を切り替える。",
  C_DATA_ON_SCREEN: "画面に番組情報などを重ねて表示する。",
  C_BASS_BOOST: "低音の強調を切り替える。",
  C_ALT_AUDIO_INC: "音量を上げる (予備の定義)。C_VOL_UP が効かない機器向け。",
  C_BKLT_TOG: "キーボードのバックライトを ON / OFF する。",
  C_BRI_MAX: "画面の明るさを最大にする。",
  C_BRI_MIN: "画面の明るさを最小にする。",
  C_BRI_AUTO: "画面の明るさの自動調整を切り替える。",
  C_CHAN_INC: "チャンネルを上げる。",
  C_CHAN_DEC: "チャンネルを下げる。",
  C_CHAN_LAST: "直前に見ていたチャンネルに戻る。",
  C_MENU: "メニューを開く (テレビなどのリモコンのメニュー)。",
  C_MENU_PICK: "メニューの項目を決定する。",
  C_MENU_UP: "メニューで上へ移動する。",
  C_MENU_DOWN: "メニューで下へ移動する。",
  C_MENU_LEFT: "メニューで左へ移動する。",
  C_MENU_RIGHT: "メニューで右へ移動する。",
  C_MENU_ESC: "メニューを閉じる。",
  C_MENU_INC: "メニューの値を増やす。",
  C_MENU_DEC: "メニューの値を減らす。",
  C_RED: "リモコンの赤ボタン (データ放送などの色ボタン)。",
  C_GREEN: "リモコンの緑ボタン。",
  C_BLUE: "リモコンの青ボタン。",
  C_YELLOW: "リモコンの黄ボタン。",
  C_MEDIA_HOME: "メディア機器のホーム画面へ。",
  C_MEDIA_GUIDE: "番組表を開く。",
  C_MEDIA_TV: "入力をテレビに切り替える。",
  C_MEDIA_CABLE: "入力をケーブルテレビに切り替える。",
  C_MEDIA_SATELLITE: "入力を衛星放送に切り替える。",
  C_MEDIA_TUNER: "入力をチューナーに切り替える。",
  C_MEDIA_DVD: "入力を DVD に切り替える。",
  C_MEDIA_CD: "入力を CD に切り替える。",
  C_MEDIA_TAPE: "入力をテープに切り替える。",
  C_MEDIA_VCR: "入力をビデオデッキに切り替える。",
  C_MEDIA_VCR_PLUS: "ビデオデッキの録画予約 (VCR Plus)。",
  C_MEDIA_COMPUTER: "入力をパソコンに切り替える。",
  C_MEDIA_WWW: "メディア機器のブラウザを開く。",
  C_MEDIA_GAMES: "ゲームを開く。",
  C_MEDIA_PHONE: "電話を開く。",
  C_MEDIA_VIDEOPHONE: "テレビ電話を開く。",
  C_MEDIA_MESSAGES: "メッセージを開く。",
  M_PLAY: "再生 / 一時停止 (トグル)。メディアキー扱い。",
  M_STOP: "再生を止める。メディアキー扱い。",
  M_NEXT: "次のトラックへ。メディアキー扱い。",
  M_PREV: "前のトラックへ。メディアキー扱い。",
  M_MUTE: "ミュート (音を消す / 戻す)。メディアキー扱いで、K_MUTE が効かない環境向け。",
  M_EJCT: "ディスクを取り出す。メディアキー扱い。",

  // --- アプリ操作 (C_AC_*) ---------------------------------------------
  C_AC_NEW: "新規作成する。",
  C_AC_OPEN: "開く。",
  C_AC_SAVE: "保存する。",
  C_AC_CLOSE: "ウィンドウやファイルを閉じる。",
  C_AC_EXIT: "アプリを終了する。",
  C_AC_PRINT: "印刷する。",
  C_AC_PROPS: "プロパティ (情報) を表示する。",
  C_AC_CANCEL: "実行中の操作を取り消す。",
  C_AC_STOP: "読み込みを中止する。",
  C_AC_REFRESH: "再読み込みする。",
  C_AC_BACK: "戻る (ブラウザの「戻る」)。",
  C_AC_FORWARD: "進む (ブラウザの「進む」)。",
  C_AC_HOME: "ホームへ移動する。",
  C_AC_FAVORITES: "ブックマーク / お気に入りを開く。",
  C_AC_FIND: "検索ダイアログを開く (アプリ内検索)。",
  C_AC_SEARCH: "検索を開く。",
  C_AC_GOTO: "指定した場所へ移動する。",
  C_AC_CUT: "切り取る。",
  C_AC_COPY: "コピーする。",
  C_AC_PASTE: "貼り付ける。",
  C_AC_UNDO: "元に戻す。",
  C_AC_REDO: "やり直す (元に戻すの取り消し)。",
  C_AC_DEL: "選択中のものを削除する。",
  C_AC_EDIT: "編集モードに入る。",
  C_AC_INS: "挿入 / 上書きを切り替える。",
  C_AC_REPLY: "メールに返信する。",
  C_AC_FORWARD_MAIL: "メールを転送する。",
  C_AC_SEND: "送信する。",
  C_AC_ZOOM: "拡大縮小を切り替える。",
  C_AC_ZOOM_IN: "拡大する。",
  C_AC_ZOOM_OUT: "縮小する。",
  C_AC_SCROLL_UP: "上へスクロールする。",
  C_AC_SCROLL_DOWN: "下へスクロールする。",
  C_AC_VIEW_TOGGLE: "表示モードを切り替える。",
  C_AC_DESKTOP_SHOW_ALL_WINDOWS: "開いているウィンドウを一覧表示する (Mission Control / タスクビュー)。",
  C_AC_DESKTOP_SHOW_ALL_APPLICATIONS: "インストール済みのアプリを一覧表示する (Launchpad / アプリ一覧)。",

  // --- アプリ起動 (C_AL_*) ---------------------------------------------
  C_AL_WWW: "ブラウザを開く。",
  C_AL_MAIL: "メールアプリを開く。",
  C_AL_CAL: "カレンダーを開く。",
  C_AL_CALC: "電卓を開く。",
  C_AL_FILES: "ファイルマネージャ (エクスプローラ / Finder) を開く。",
  C_AL_MY_COMPUTER: "「PC」「このコンピュータ」を開く。",
  C_AL_DOCS: "ドキュメントフォルダを開く。",
  C_AL_IMAGES: "画像ビューアを開く。",
  C_AL_MUSIC: "音楽アプリを開く。",
  C_AL_MOVIES: "動画アプリを開く。",
  C_AL_AV_CAPTURE_PLAYBACK: "録画・再生アプリを開く。",
  C_AL_GRAPHICS_EDITOR: "画像編集アプリを開く。",
  C_AL_TEXT_EDITOR: "テキストエディタを開く。",
  C_AL_WORD: "ワープロアプリを開く。",
  C_AL_SHEET: "表計算アプリを開く。",
  C_AL_PRESENTATION: "プレゼンアプリを開く。",
  C_AL_DB: "データベースアプリを開く。",
  C_AL_FINANCE: "家計簿・会計アプリを開く。",
  C_AL_JOURNAL: "日誌・作業記録アプリを開く。",
  C_AL_NEWS: "ニュースリーダーを開く。",
  C_AL_IM: "インスタントメッセンジャーを開く。",
  C_AL_CHAT: "チャットアプリを開く。",
  C_AL_ADDRESS_BOOK: "連絡先・アドレス帳を開く。",
  C_AL_VOICEMAIL: "留守番電話を開く。",
  C_AL_SPELL: "スペルチェックを実行する。",
  C_AL_HELP: "ヘルプを開く。",
  C_AL_TUTORIAL: "メーカー製のヒント・チュートリアルを開く。",
  C_AL_CONTROL_PANEL: "コントロールパネル / システム設定を開く。",
  C_AL_TASK_MANAGER: "タスクマネージャを開く。",
  C_AL_NEXT_TASK: "次のアプリに切り替える (Alt+Tab 相当)。",
  C_AL_PREV_TASK: "前のアプリに切り替える。",
  C_AL_SELECT_TASK: "切り替えるアプリを選ぶ。",
  C_AL_KEYBOARD_LAYOUT: "キーボードの配列を切り替える。",
  C_AL_SCREEN_SAVER: "スクリーンセーバーを起動する。",
  C_AL_COFFEE: "画面をロックする (スクリーンセーバーを起動する)。",
  C_AL_LOGOFF: "サインアウトする。",
  C_AL_CCC: "機器側の設定画面を開く。",

  // --- 電源・システム --------------------------------------------------
  C_PWR: "機器の電源キー。環境によっては押した瞬間に電源が切れる。",
  C_POWER: "機器の電源キー。環境によっては押した瞬間に電源が切れる。",
  C_SLEEP: "スリープさせる。",
  C_SLEEP_MODE: "スリープの動作を切り替える。",
  C_RESET: "機器をリセットする。",
  C_QUIT: "アプリを終了する。",
  C_HELP: "ヘルプを表示する。",
  C_VOICE_COMMAND: "音声アシスタントを呼び出す。",
  SYS_PWR: "パソコン本体の電源を切る。環境によっては押した瞬間に落ちる。",
  SYS_SLEEP: "パソコン本体をスリープさせる。",
  SYS_WAKE: "スリープ中の本体を復帰させる。",

  // --- キーボード扱いのアプリ・メディアキー (K_*) ----------------------
  // Same actions as the C_* ones above, sent as ordinary keyboard keys. Some
  // OSes listen to one set and not the other, hence both exist.
  K_PWR: "電源キー。キーボード扱い。",
  K_SLEEP: "スリープさせる。キーボード扱い。",
  K_LOCK: "画面をロックする。キーボード扱い。",
  K_COFFEE: "画面をロックする。キーボード扱い。",
  K_WWW: "ブラウザを開く。キーボード扱い。",
  K_CALC: "電卓を開く。キーボード扱い。",
  K_BACK: "戻る。キーボード扱いで、C_AC_BACK が効かない環境向け。",
  K_FORWARD: "進む。キーボード扱い。",
  K_REFRESH: "再読み込みする。キーボード扱い。",
  K_STOP: "読み込みを中止する。キーボード扱い。",
  K_STOP2: "読み込みを中止する (予備の定義)。K_STOP が効かない環境向け。",
  K_STOP3: "読み込みを中止する (予備の定義)。K_STOP が効かない環境向け。",
  K_FIND: "検索する。キーボード扱い。",
  K_FIND2: "検索する (予備の定義)。K_FIND が効かない環境向け。",
  K_MENU: "メニューを開く。",
  K_SELECT: "選択を確定する。",
  K_EXEC: "実行する。",
  K_CANCEL: "操作を取り消す。",
  K_EDIT: "編集する。",
  K_REDO: "やり直す。キーボード扱い。",
  K_HELP: "ヘルプを開く。キーボード扱い。",
  K_SCROLL_UP: "上へスクロールする。キーボード扱い。",
  K_SCROLL_DOWN: "下へスクロールする。キーボード扱い。",
  K_PP: "再生 / 一時停止 (トグル)。キーボード扱い。",
  K_NEXT: "次のトラックへ。キーボード扱い。",
  K_PREV: "前のトラックへ。キーボード扱い。",
  K_EJECT: "ディスクを取り出す。キーボード扱い。",
  K_MUTE2: "ミュート (予備の定義)。K_MUTE が効かない環境向け。",
  K_VOL_UP: "音量を上げる。キーボード扱いで、ほぼ全 OS で効く。",
  K_VOL_DN: "音量を下げる。キーボード扱いで、ほぼ全 OS で効く。",
  K_VOL_UP2: "音量を上げる (予備の定義)。K_VOL_UP が効かない環境向け。",
  K_VOL_DN2: "音量を下げる (予備の定義)。K_VOL_DN が効かない環境向け。",

  // --- 言語・国際 ------------------------------------------------------
  LANGUAGE_3: "カタカナ。106 配列の「カタカナ」キー。",
  LANGUAGE_4: "ひらがな。106 配列の「ひらがな」キー。",
  LANGUAGE_5: "半角/全角。JIS キーボードの「半角/全角」キー。Windows では IME の ON / OFF。",
  LANG3: "カタカナ。106 配列の「カタカナ」キー。",
  LANG4: "ひらがな。106 配列の「ひらがな」キー。",
  LANG5: "半角/全角。JIS キーボードの「半角/全角」キー。Windows では IME の ON / OFF。",
  INTERNATIONAL_2: "かな。JIS キーボードの「カタカナ / ひらがな」キー。",
  INT_HENKAN: "変換。JIS キーボードの「変換」キー。IME の再変換に使う。",
  INT_MUHENKAN: "無変換。JIS キーボードの「無変換」キー。",
  INT_RO: "ろ。JIS キーボード右下、右 Shift の左にある「＼ろ」キー。",
  INT_YEN: "￥。JIS キーボードで Backspace の左にある「￥」キー。",
  INT_KPJPCOMMA: "テンキーの 、。JIS のテンキーにある読点キー。",
  C_KBIA_ACCEPT: "IME の変換候補を確定する。",
  C_KBIA_CANCEL: "IME の変換候補の選択をやめる。",
  C_KBIA_NEXT: "次の変換候補へ。",
  C_KBIA_PREV: "前の変換候補へ。",
  C_KBIA_NEXT_GRP: "次の変換候補グループへ。",
  C_KBIA_PREV_GRP: "前の変換候補グループへ。",
  // INT7-9 and LANG6-9 exist in the HID spec with no assigned meaning; saying
  // so is more use than saying nothing.
  INT7: "予備の国際キー。どのキーになるかは決まっておらず、OS 側で使われることはまず無い。",
  INT8: "予備の国際キー。どのキーになるかは決まっておらず、OS 側で使われることはまず無い。",
  INT9: "予備の国際キー。どのキーになるかは決まっておらず、OS 側で使われることはまず無い。",
  LANG6: "予備の言語キー。用途は決まっておらず、OS 側で使われることはまず無い。",
  LANG7: "予備の言語キー。用途は決まっておらず、OS 側で使われることはまず無い。",
  LANG8: "予備の言語キー。用途は決まっておらず、OS 側で使われることはまず無い。",
  LANG9: "予備の言語キー。用途は決まっておらず、OS 側で使われることはまず無い。",

  // --- その他 ----------------------------------------------------------
  BSPC: "Backspace。カーソルの左を 1 文字消す。",
  DEL: "Delete。カーソルの右を 1 文字消す。",
  UARW: "↑ カーソルを上へ動かす。",
  DOWN: "↓ カーソルを下へ動かす。",
  LEFT: "← カーソルを左へ動かす。",
  RIGHT: "→ カーソルを右へ動かす。",
  SPC: "Space。空白を 1 つ入れる。",
  TAB: "Tab。次の入力欄へ移動する / インデントを入れる。",
  ENTER: "Enter。改行する / 決定する。",
  ESC: "Esc。取り消す / 閉じる。",
  HOME: "行頭 (アプリによっては文書の先頭) へ移動する。",
  END: "行末 (アプリによっては文書の末尾) へ移動する。",
  PG_UP: "1 画面ぶん上へスクロールする。",
  PG_DN: "1 画面ぶん下へスクロールする。",
  PAUS: "Pause / Break。",
  SYSREQ: "SysRq。Print Screen の Alt 側で、Linux のマジック SysRq 以外ではまず使わない。",
  COPY: "コピーする。キーボード扱いのコピーキー。",
  CUT: "切り取る。キーボード扱いの切り取りキー。",
  PSTE: "貼り付ける。キーボード扱いの貼り付けキー。",
  UNDO: "元に戻す。キーボード扱いの取り消しキー。",
  LCAPS: "Caps Lock (ロック式)。押し込んだままになる昔のキー向けで、今の OS ではまず効かない。",
  LNLCK: "Num Lock (ロック式)。押し込んだままになる昔のキー向けで、今の OS ではまず効かない。",
  LSLCK: "Scroll Lock (ロック式)。押し込んだままになる昔のキー向けで、今の OS ではまず効かない。",
  RET2: "Enter (予備の定義)。ふつうは ENTER を使う。",
  CLEAR2: "テンキーの Clear を Shift 付きで送る予備の定義。ふつうは KP_CLEAR を使う。",
  // The 0x99-0xA4 block: keys that existed on IBM terminals and have no
  // meaning on a modern OS. Listed so the catalog can say so out loud.
  ALT_ERASE: "入力を消す端末キー (Alt Erase)。今の OS ではまず効かない。",
  CLEAR: "入力を消す端末キー (Clear)。今の OS ではまず効かない。",
  CLEAR_AGAIN: "消してからやり直す端末キー (Clear/Again)。今の OS ではまず効かない。",
  PRIOR: "端末キー (Prior)。PgUp とは別物で、今の OS ではまず効かない。",
  SEPARATOR: "項目の区切りを入れる端末キー。今の OS ではまず効かない。",
  OUT: "端末キー (Out)。今の OS ではまず効かない。",
  OPER: "端末キー (Oper)。今の OS ではまず効かない。",
  CRSEL: "選択範囲を指定する端末キー (CrSel)。今の OS ではまず効かない。",
  EXSEL: "選択範囲を広げる端末キー (ExSel)。今の OS ではまず効かない。",
};

/** Generic note for the keypad block, which is too big to list key by key. */
const KEYPAD_HELP = "テンキー (keypad) 側のキー。Num Lock の状態に依存する環境がある。";

/** F13 upward say the same thing twelve times, so say it once. F1-F12 need no
 *  note at all — everyone has those caps in front of them. */
function extendedFnHelp(name: string): string | undefined {
  const m = /^F(\d+)$/.exec(name);
  if (!m || Number(m[1]) < 13) return undefined;
  return `${name} キー (標準キーボードには無い拡張ファンクションキー)。OS やアプリ側でショートカットに割り当てて使う。`;
}

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
  const base =
    KEYCODE_HELP[rest] ??
    extendedFnHelp(rest) ??
    (rest.startsWith("KP_") ? KEYPAD_HELP : undefined);
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
  // The module README documents neither of the next two; the wording below
  // follows ZMK's stock processors of the same name (zip_xy_swap_mapper,
  // zip_xy_to_scroll_mapper), which its own example chains in front of this
  // processor. Treat as unconfirmed against the module source.
  "xy-swap": {
    label: "X と Y を入れ替え",
    help: "X 軸と Y 軸の入力を入れ替える (ZMK の zip_xy_swap_mapper と同じ働きと思われる。モジュール README に記載なし)。",
    group: TB_INVERT,
  },
  "xy-to-scroll": {
    label: "移動をスクロールに変換",
    help: "ポインタ移動をホイールスクロールとして出力する (ZMK の zip_xy_to_scroll_mapper と同じ働きと思われる。モジュール README に記載なし)。",
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
