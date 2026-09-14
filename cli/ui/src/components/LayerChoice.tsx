import { groupLayers } from "../groups";
import type { Layer, LayerGroup } from "../types";
import { GROUP_COLORS, layerLabel } from "../types";

/** The heading that marks where one group's layers end and the next begin.
 *  Quiet on purpose: it orders a list, it is not a control. */
export function GroupHeading({ group }: { group: LayerGroup | null }) {
  const c = GROUP_COLORS[group?.color ?? "zinc"];
  return (
    <div className="flex items-center gap-1.5">
      <span className={"h-2.5 w-[3px] shrink-0 rounded-full " + c.bar} />
      <span className={"text-[10px] font-medium " + c.text}>{group ? group.name : "共通"}</span>
    </div>
  );
}

/**
 * `<option>`s for a layer `<select>`, one `<optgroup>` per layer group.
 *
 * The value is the layer *index*, which is what every consumer sends to the
 * device; groups only decide the order and the headings. With no groups
 * defined the options stay a flat list rather than gaining one pointless
 * "共通" optgroup.
 */
export function LayerOptions({ layers, groups }: { layers: Layer[]; groups: LayerGroup[] }) {
  const option = (l: Layer) => (
    <option key={l.id} value={l.index}>
      {l.index} · {layerLabel(l)}
    </option>
  );
  if (!groups.length) return <>{layers.map(option)}</>;
  return (
    <>
      {groupLayers(layers, groups)
        .filter((s) => s.layers.length)
        .map((s) => (
          <optgroup key={s.group?.id ?? ":none"} label={s.group?.name ?? "共通"}>
            {s.layers.map(option)}
          </optgroup>
        ))}
    </>
  );
}

/** A set of layer checkboxes in group order, with a heading per group. */
export function LayerCheckboxes({
  layers,
  groups,
  checked,
  onToggle,
  disabled,
}: {
  layers: Layer[];
  groups: LayerGroup[];
  /** Layer *indices* that are ticked — the same units the device speaks. */
  checked: number[];
  onToggle(index: number): void;
  disabled?: boolean;
}) {
  const box = (l: Layer) => (
    <label key={l.id} className="flex items-center gap-1 text-xs">
      <input
        type="checkbox"
        disabled={disabled}
        checked={checked.includes(l.index)}
        onChange={() => onToggle(l.index)}
        className="accent-sky-500"
      />
      <span className="text-zinc-300">{layerLabel(l)}</span>
    </label>
  );
  if (!groups.length)
    return <div className="flex flex-wrap gap-x-3 gap-y-1">{layers.map(box)}</div>;
  return (
    <div className="space-y-1.5">
      {groupLayers(layers, groups)
        .filter((s) => s.layers.length)
        .map((s) => (
          <div key={s.group?.id ?? ":none"} className="space-y-0.5">
            <GroupHeading group={s.group} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 pl-2.5">{s.layers.map(box)}</div>
          </div>
        ))}
    </div>
  );
}
