/** Non-key items drawn on the board, in layout units (1/100 key). Keyed by
 *  `<layout name>:<key count>` because the device only reports those two —
 *  there is no RPC that says where the encoder or the trackball sits. */
export interface Decor {
  /** Encoders that sit on a key: pressing the wheel is that key's binding,
   *  so the board draws the key as a wheel and its inspector edits both. */
  encoders: { sensor: number; pos: number }[];
  trackball?: { cx: number; cy: number; r: number };
  /** How a layer is entered when no key and no runtime setting says so: the
   *  devicetree's own `automouse-layer` / `scroll-layers` are compiled in and
   *  reported by no RPC. Keyed by the layer **name**, not its index — renaming
   *  a layer is a runtime edit, so a stale note disappears instead of landing
   *  on whatever layer inherited the index. */
  layerNotes?: Record<string, string>;
}

export const DECOR: Record<string, Decor> = {
  // roBa / roBaish: the left encoder is a horizontal wheel sitting on the
  // Mute key (pos 15; clicking the wheel is that key). Trackball where the
  // mirror of the 英数 key (pos 37) would be: the third right-thumb slot,
  // right of Enter.
  "Default:43": {
    encoders: [{ sensor: 0, pos: 15 }],
    trackball: { cx: 938, cy: 392, r: 48 },
    layerNotes: {
      MOUSE: "トラックボールを動かすと自動で入る (automouse-layer、ファーム固定)",
      SCROLL: "SCROLL は , の長押し中にトラックボールがスクロールになる層 (scroll-layers、ファーム固定)",
    },
  },
};

export function decorFor(layout: { name: string; keys: unknown[] }): Decor | undefined {
  return DECOR[`${layout.name}:${layout.keys.length}`];
}
