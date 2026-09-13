import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Long enough not to flicker while the pointer crosses the board, short
 *  enough that it never feels like the browser's own `<title>` delay. */
const DELAY_MS = 150;

/** What a component needs to drive one owner's tooltip from its own events. */
export interface TipHandlers {
  show(e: { clientX: number; clientY: number }, content: ReactNode): void;
  hide(): void;
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

/** The dark bubble itself, portalled to <body> so no `overflow-hidden` or
 *  stacking context on the way can clip it. */
function Bubble({ x, y, content }: Tip) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ left: x + 14, top: y + 18 });

  // Flip towards the cursor when the bubble would leave the viewport. Measured
  // after layout, before paint, so it never shows at the wrong place first.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = x + 14;
    let top = y + 18;
    if (left + width > window.innerWidth - 8) left = x - width - 14;
    if (top + height > window.innerHeight - 8) top = y - height - 12;
    setAt({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [x, y, content]);

  return createPortal(
    <div
      ref={ref}
      style={{ left: at.left, top: at.top }}
      className="pointer-events-none fixed z-50 max-w-xs space-y-0.5 rounded-md border border-zinc-700 bg-zinc-900/95 px-2.5 py-1.5 text-xs leading-snug text-zinc-200 shadow-xl shadow-black/60"
    >
      {content}
    </div>,
    document.body,
  );
}

/**
 * Pointer-driven tooltip for one owner (the board, say): `show` on enter and
 * move, `hide` on leave, and `node` rendered once next to the owner.
 */
export function useTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const pending = useRef<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const shown = useRef(false);

  const show = useCallback((e: { clientX: number; clientY: number }, content: ReactNode) => {
    pending.current = { x: e.clientX, y: e.clientY, content };
    if (shown.current) {
      setTip(pending.current);
      return;
    }
    if (timer.current !== undefined) return;
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      shown.current = true;
      setTip(pending.current);
    }, DELAY_MS);
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    shown.current = false;
    pending.current = null;
    setTip(null);
  }, []);

  return { show, hide, node: tip ? <Bubble {...tip} /> : null };
}

/** The ⓘ next to a label: hover or focus explains the field. Renders nothing
 *  when there is no text, so callers can pass a dictionary lookup directly. */
export function Info({ text, label }: { text?: ReactNode; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { show, hide, node } = useTooltip();
  if (!text) return null;

  /** Anchored to the icon, not the cursor, so it does not jitter. */
  const at = () => {
    const r = ref.current?.getBoundingClientRect();
    return { clientX: r ? r.left : 0, clientY: r ? r.bottom - 16 : 0 };
  };

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="note"
        aria-label={label ? `${label} の説明` : "説明"}
        onMouseEnter={() => show(at(), text)}
        onMouseLeave={hide}
        onFocus={() => show(at(), text)}
        onBlur={hide}
        className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-zinc-600 text-[9px] leading-none text-zinc-500 select-none hover:border-sky-500 hover:text-sky-300 focus:border-sky-500 focus:text-sky-300 focus:outline-none"
      >
        i
      </span>
      {node}
    </>
  );
}

export default Bubble;
