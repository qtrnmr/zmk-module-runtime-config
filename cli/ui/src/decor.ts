/** Non-key items drawn on the board, in layout units (1/100 key). Keyed by
 *  `<layout name>:<key count>` because the device only reports those two —
 *  there is no RPC that says where the encoder or the trackball sits. */
export interface Decor {
  encoders: { sensor: number; cx: number; cy: number; r: number }[];
  trackball?: { cx: number; cy: number; r: number };
}

export const DECOR: Record<string, Decor> = {
  // roBa / roBaish: left encoder above Mute (the empty row-0 slot of column 5),
  // trackball to the right of Enter in the right-hand thumb cluster, under N/M.
  "Default:43": {
    encoders: [{ sensor: 0, cx: 550, cy: 85, r: 45 }],
    trackball: { cx: 950, cy: 420, r: 55 },
  },
};

export function decorFor(layout: { name: string; keys: unknown[] }): Decor | undefined {
  return DECOR[`${layout.name}:${layout.keys.length}`];
}
