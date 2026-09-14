import { useEffect, useRef } from "react";
import { KEYCODE_HELP, behaviorJa } from "../help";
import { MOD_WRAP, PRETTY_MAP } from "../prettyKeycode";
import { TAG } from "./Keyboard";

/** One line of the 記号 table: what is drawn, what it stands for, what it does. */
export interface SymbolRow {
  symbol: string;
  /** Canonical keycode names that all draw as `symbol`. */
  names: string[];
  meaning: string;
}

/** Every symbol `pretty()` can put on a cap, folded back the other way: one row
 *  per glyph, listing the keycode names that produce it. Generated from the
 *  conversion table itself, so a new entry there shows up here. */
export const KEY_SYMBOL_ROWS: SymbolRow[] = (() => {
  const by = new Map<string, string[]>();
  for (const [name, symbol] of Object.entries(PRETTY_MAP)) {
    if (!by.has(symbol)) by.set(symbol, []);
    by.get(symbol)!.push(name);
  }
  return [...by].map(([symbol, names]) => ({
    symbol,
    names,
    meaning: names.map((n) => KEYCODE_HELP[n]).find(Boolean) ?? names[0],
  }));
})();

/** The four modifier glyphs a wrapped keycode picks up: `LG(TAB)` -> `⌘⇥`. */
const MOD_MEANING: Record<string, string> = {
  "^": "Ctrl を押しながら。",
  "⇧": "Shift を押しながら。",
  "⌥": "Alt (Mac の ⌥ option) を押しながら。",
  "⌘": "Gui を押しながら。Mac では ⌘ command、Windows では Win キー。",
};

export const MOD_SYMBOL_ROWS: SymbolRow[] = (() => {
  const by = new Map<string, string[]>();
  for (const [prefix, symbol] of Object.entries(MOD_WRAP)) {
    if (!by.has(symbol)) by.set(symbol, []);
    by.get(symbol)!.push(prefix);
  }
  return [...by].map(([symbol, names]) => ({
    symbol,
    names,
    meaning: MOD_MEANING[symbol] ?? names[0],
  }));
})();

/** The blue abbreviation in a cap's bottom-right corner. */
export const TAG_ROWS: { tag: string; behavior: string; ja: string }[] = Object.entries(TAG).map(
  ([behavior, tag]) => ({ tag, behavior, ja: behaviorJa(behavior) }),
);

/** Marks that are not keycodes and not behaviour tags. */
export const MARK_ROWS: { mark: string; text: string }[] = [
  { mark: "▽", text: "透過。このレイヤーは何も割り当てず、下のレイヤーの割当が効く (薄い文字はその中身)。" },
  { mark: "∅", text: "無効。何も起こらず、下のレイヤーにも渡さない。" },
  { mark: "上段", text: "キー上段の小さい文字 = 長押ししたときの動作。" },
  { mark: "下段", text: "キー下段の大きい文字 = 短く叩いた (タップした) ときの動作。" },
  { mark: "≡", text: "キーのホイール模様 = ロータリーエンコーダ。押し込みがそのキー、↻ ↺ が回転。" },
];

export const BOARD_ROWS: { mark: string; text: string }[] = [
  { mark: "—", text: "キー間の短いグレーの橋 = コンボ (その 2 つを同時押し)。" },
  { mark: "•", text: "キー右上の点 = 離れたキー同士のコンボ。線で結ぶと盤面が読めなくなる組み合わせ。" },
  { mark: "□", text: "水色の枠 = いま選んでいるキー。" },
  { mark: "◌", text: "破線の円 = トラックボール。クリックで速度・反転・軸スナップの設定へ。" },
];

function Head({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="sticky top-0 -mx-3 mb-1 bg-zinc-900/95 px-3 py-1 text-[11px] font-semibold text-zinc-300">
      {children}
    </h3>
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-px flex h-5 min-w-6 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-1 text-[11px] text-zinc-100">
      {children}
    </span>
  );
}

/**
 * What every mark on the board means, opened from the "?" in the header.
 *
 * The key-symbol table is generated from prettyKeycode's own map and the tag
 * table from Keyboard's, so the legend cannot drift away from what is actually
 * drawn — a test walks both the other way.
 */
export default function Legend({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ width: 360, maxHeight: "70vh" }}
      className="absolute top-full right-3 z-40 mt-1 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs shadow-2xl shadow-black/70"
    >
      <div className="mb-2 flex items-center">
        <span className="text-sm font-semibold text-zinc-100">記号の凡例</span>
        <button
          onClick={onClose}
          className="ml-auto rounded px-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>

      <section className="mb-3">
        <Head>キーの記号</Head>
        <ul className="space-y-0.5">
          {[...MOD_SYMBOL_ROWS, ...KEY_SYMBOL_ROWS].map((r) => (
            <li key={r.symbol} className="flex gap-2">
              <Glyph>{r.symbol}</Glyph>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="font-mono text-[10px] text-zinc-500">{r.names.join(" / ")}</span>
                {r.meaning !== r.names[0] && (
                  <span className="ml-1 text-[11px] text-zinc-400">{r.meaning}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-3">
        <Head>キーの印</Head>
        <ul className="space-y-0.5">
          {MARK_ROWS.map((r) => (
            <li key={r.mark} className="flex gap-2">
              <Glyph>{r.mark}</Glyph>
              <span className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-400">{r.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
          キー右下の小さい青文字 = ビヘイビアの略号:
        </p>
        <ul className="mt-1 space-y-0.5">
          {TAG_ROWS.map((r) => (
            <li key={r.tag} className="flex gap-2">
              <span className="mt-px w-9 shrink-0 text-right font-mono text-[11px] text-sky-400/80">
                {r.tag}
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="text-[11px] text-zinc-300">{r.ja}</span>
                <span className="ml-1 font-mono text-[10px] text-zinc-500">{r.behavior}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] leading-snug text-zinc-500">
          表にない behavior は名前の先頭 5 文字がそのまま出ます。
        </p>
      </section>

      <section>
        <Head>盤面の印</Head>
        <ul className="space-y-0.5">
          {BOARD_ROWS.map((r) => (
            <li key={r.mark} className="flex gap-2">
              <Glyph>{r.mark}</Glyph>
              <span className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-400">{r.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
