import type { GroupColor, Layer, LayerGroup } from "./types";
import { PICKABLE_COLORS } from "./types";

/** One section of the layer card: a group and the live layers in it. */
export interface GroupedLayers {
  /** null for the trailing 未所属 ("共通") section, which always comes last. */
  group: LayerGroup | null;
  layers: Layer[];
}

/**
 * Layers sectioned by group, in group-definition order, with everything else
 * gathered into a trailing `group: null` section.
 *
 * Two things a group's `layers` array may legitimately contain are dropped
 * here rather than rejected: an id that no live layer has (the layer was
 * removed — restoring it puts the layer straight back in its group) and an id
 * a previous group already claimed. Inside a section the layers are in board
 * order (by index), not in the order the ids happen to be stored.
 *
 * The ungrouped section is emitted even when empty, so `groupLayers(ls, [])`
 * is a single flat section and the card has exactly one shape to render.
 */
export function groupLayers(layers: Layer[], groups: LayerGroup[]): GroupedLayers[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const claimed = new Set<number>();
  const out: GroupedLayers[] = groups.map((group) => {
    const ls: Layer[] = [];
    for (const id of group.layers) {
      const l = byId.get(id);
      if (l && !claimed.has(id)) {
        claimed.add(id);
        ls.push(l);
      }
    }
    ls.sort((a, b) => a.index - b.index);
    return { group, layers: ls };
  });
  out.push({ group: null, layers: layers.filter((l) => !claimed.has(l.id)) });
  return out;
}

/** The group a layer belongs to, or null when it is 未所属. */
export function groupOf(groups: LayerGroup[], layerId: number): LayerGroup | null {
  return groups.find((g) => g.layers.includes(layerId)) ?? null;
}

/** A layer's colour; 未所属 layers keep the card's neutral zinc. */
export function colorOf(groups: LayerGroup[], layerId: number): GroupColor {
  return groupOf(groups, layerId)?.color ?? "zinc";
}

/** Every group minus `layerId`, plus `layerId` in `toGroupId` (null = 共通).
 *  One layer lives in one group, which is why the removal comes first. */
export function moveLayer(
  groups: LayerGroup[],
  layerId: number,
  toGroupId: string | null,
): LayerGroup[] {
  return groups.map((g) => {
    const layers = g.layers.filter((id) => id !== layerId);
    return g.id === toGroupId ? { ...g, layers: [...layers, layerId] } : { ...g, layers };
  });
}

/** The first palette colour no group is using, so a new group looks distinct
 *  without asking; the palette wraps once every colour is taken. */
export function nextColor(groups: LayerGroup[]): GroupColor {
  const used = new Set(groups.map((g) => g.color));
  return PICKABLE_COLORS.find((c) => !used.has(c)) ?? PICKABLE_COLORS[groups.length % PICKABLE_COLORS.length];
}
