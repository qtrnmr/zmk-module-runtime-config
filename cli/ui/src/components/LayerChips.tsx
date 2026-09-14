import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { groupLayers, moveLayer, nextColor } from "../groups";
import type { GroupColor, Layer, LayerGroup } from "../types";
import { GROUP_COLORS, PICKABLE_COLORS, layerLabel } from "../types";
import ConfirmDialog from "./ConfirmDialog";

export interface RemovedLayer {
  id: number;
  name: string;
  index: number;
}

const COLLAPSED_KEY = "zmkrt.groupCollapsed";
const SUGGEST_KEY = "zmkrt.groupSuggestDismissed";

/** The 共通 (ungrouped) section's key in the collapsed set; ":" never appears
 *  in a server-generated slug, so it cannot collide with a real group id. */
const NONE = ":none";

const readCollapsed = (): Set<string> => {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? (raw as string[]) : []);
  } catch {
    return new Set();
  }
};

/** A popup menu anchored to the button that opened it. It goes through a portal
 *  to <body>: the card clips its own overflow, and its `backdrop-blur` makes it
 *  the containing block for `fixed` children, so a menu rendered in place would
 *  be both cut off and positioned against the card instead of the viewport. */
type MenuAnchor = { kind: "layer"; layer: Layer } | { kind: "group"; group: LayerGroup };
type Menu = MenuAnchor & { x: number; y: number };

function MenuSheet({ menu, onClose, children }: {
  menu: Menu;
  onClose(): void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={onClose} />
      <div
        style={{ left: menu.x, top: menu.y }}
        className="fixed z-50 w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-xl shadow-black/60"
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

const ITEM =
  "block w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40";

/**
 * The layer switcher: a small floating card beside the keyboard with one row
 * per layer. Click selects, double-click renames inline, drag reorders, `×`
 * removes (with confirm); removed layers get a dashed "復元" row.
 *
 * Twelve layers do not read as anything, so the rows are sectioned by *group*
 * — a UI-only idea (Apple / Windows / Android) stored in .zmkrt-ui.json, never
 * on the device. A group header collapses its section, takes a drop to move a
 * layer in, and carries the section's colour, which each layer's index badge
 * repeats. With no groups defined the card is exactly the flat list it was.
 *
 * While the inspector is open the card collapses to a 44px strip of index
 * badges — still colour-coded, but with no headers and no editing.
 */
export default function LayerChips({
  layers,
  current,
  onSelect,
  availableLayers,
  maxNameLength,
  disabled,
  onRename,
  onMove,
  onAdd,
  onRemove,
  removed,
  onRestore,
  collapsed = false,
  groups,
  suggested,
  onGroups,
  entryHidden,
  onShowEntry,
}: {
  layers: Layer[];
  current: number;
  onSelect(index: number): void;
  availableLayers: number;
  maxNameLength: number;
  disabled: boolean;
  onRename(layerId: number, name: string): void;
  onMove(start: number, dest: number): void;
  onAdd(): void;
  onRemove(index: number): void;
  removed: RemovedLayer[];
  onRestore(layerId: number, atIndex: number): void;
  /** Narrow, index-only mode: on while the right-hand inspector is open. */
  collapsed?: boolean;
  groups: LayerGroup[];
  /** A grouping the server read off the layer names, offered once. */
  suggested?: LayerGroup[];
  /** Save the whole group document (the server answers with what it stored). */
  onGroups(next: LayerGroup[]): void;
  /** The "how do I get here" banner above the board has been dismissed, so
   *  the card carries the only way back to it. */
  entryHidden?: boolean;
  onShowEntry?(): void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [dragFrom, setDragFrom] = useState<Layer | null>(null);
  const [dropGroup, setDropGroup] = useState<string | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [submenu, setSubmenu] = useState<"color" | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [shut, setShut] = useState<Set<string>>(readCollapsed);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(SUGGEST_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...shut]));
  }, [shut]);

  const startEdit = (l: Layer) => {
    if (disabled) return;
    setEditing(l.id);
    setDraft(l.name);
  };
  const commit = (l: Layer) => {
    setEditing(null);
    if (draft !== l.name) onRename(l.id, draft);
  };

  const closeMenu = () => {
    setMenu(null);
    setSubmenu(null);
  };
  const openMenu = (e: React.MouseEvent, m: MenuAnchor) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSubmenu(null);
    setMenu({ ...m, x: Math.min(r.left, window.innerWidth - 184), y: r.bottom + 4 });
  };

  /** Every group edit is a whole-document save, so the server stays the single
   *  source of ids and the card never holds a half-applied state. */
  const save = (next: LayerGroup[]) => {
    closeMenu();
    onGroups(next);
  };

  const toggleShut = (key: string) =>
    setShut((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const canAdd = availableLayers > 0 && !disabled;
  const sections = groupLayers(layers, groups);
  const colorByLayer = new Map<number, GroupColor>();
  for (const s of sections)
    for (const l of s.layers) colorByLayer.set(l.id, s.group?.color ?? "zinc");

  const layerRow = (l: Layer) => {
    const c = GROUP_COLORS[colorByLayer.get(l.id) ?? "zinc"];
    return (
      <li
        key={l.id}
        draggable={!collapsed && !disabled && editing !== l.id}
        onDragStart={(e) => {
          setDragFrom(l);
          e.dataTransfer.setData("text/plain", String(l.index));
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDragFrom(null);
          setDropGroup(null);
        }}
        onDragOver={(e) => {
          if (dragFrom !== null && dragFrom.index !== l.index) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const from = Number(e.dataTransfer.getData("text/plain"));
          setDragFrom(null);
          if (!Number.isNaN(from) && from !== l.index) onMove(from, l.index);
        }}
        className={
          "group flex items-center rounded-lg text-sm transition-colors " +
          (l.index === current
            ? "bg-sky-600 font-semibold text-white shadow-md shadow-sky-900/50"
            : "text-zinc-200 hover:bg-zinc-800") +
          (dragFrom !== null && dragFrom.index !== l.index
            ? " outline outline-1 outline-dashed outline-zinc-600"
            : "")
        }
      >
        {editing === l.id && !collapsed ? (
          <input
            autoFocus
            value={draft}
            maxLength={maxNameLength}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(l)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(l);
              if (e.key === "Escape") setEditing(null);
            }}
            className="m-1 w-full rounded-md border border-sky-600 bg-zinc-950 px-2 py-1 text-sm outline-none"
          />
        ) : (
          <button
            onClick={() => onSelect(l.index)}
            onDoubleClick={() => !collapsed && startEdit(l)}
            title={collapsed ? `${l.index} · ${layerLabel(l)}` : "ダブルクリックで名前を編集"}
            className={
              "flex min-w-0 flex-1 items-center text-left " +
              (collapsed ? "justify-center py-1" : "gap-2 py-1.5 pl-1.5 pr-2")
            }
          >
            <span
              className={
                "inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded px-1 font-mono text-[11px] " +
                (l.index === current ? "bg-white/20 text-white" : c.badge)
              }
            >
              {l.index}
            </span>
            {!collapsed && <span className="truncate">{layerLabel(l)}</span>}
          </button>
        )}
        {!collapsed && (
          <button
            onClick={(e) => openMenu(e, { kind: "layer", layer: l })}
            disabled={disabled}
            title="グループへ移動"
            className={
              "hidden px-1 leading-none group-hover:block disabled:hidden " +
              (l.index === current ? "text-sky-100 hover:text-white" : "text-zinc-500 hover:text-zinc-200")
            }
          >
            ⋯
          </button>
        )}
        <button
          onClick={() => setConfirmIdx(l.index)}
          disabled={disabled || collapsed}
          title="削除"
          className={
            "hidden pr-2 group-hover:block disabled:hidden " +
            (l.index === current ? "text-sky-200 hover:text-white" : "text-zinc-500 hover:text-red-400")
          }
        >
          ×
        </button>
      </li>
    );
  };

  const header = (g: LayerGroup | null, count: number, hasCurrent: boolean) => {
    const key = g?.id ?? NONE;
    const c = GROUP_COLORS[g?.color ?? "zinc"];
    const isShut = shut.has(key);
    return (
      <li
        key={`h:${key}`}
        onDragOver={(e) => {
          // Only a layer drag lands here, and only as a group move: the
          // row-on-row drop above is still the reorder.
          if (dragFrom !== null) {
            e.preventDefault();
            setDropGroup(key);
          }
        }}
        onDragLeave={() => setDropGroup((d) => (d === key ? null : d))}
        onDrop={(e) => {
          e.preventDefault();
          const l = dragFrom;
          setDragFrom(null);
          setDropGroup(null);
          if (l) save(moveLayer(groups, l.id, g?.id ?? null));
        }}
        className={
          "group/h mt-1.5 flex items-center gap-1.5 rounded px-1 py-0.5 first:mt-0 " +
          (dropGroup === key ? "bg-zinc-800 outline outline-1 outline-dashed outline-zinc-500" : "")
        }
      >
        <span className={"h-3.5 w-[3px] shrink-0 rounded-full " + c.bar} />
        {editingGroup === key && g ? (
          <input
            autoFocus
            value={groupDraft}
            maxLength={32}
            onChange={(e) => setGroupDraft(e.target.value)}
            onBlur={() => {
              setEditingGroup(null);
              if (groupDraft.trim() && groupDraft !== g.name)
                save(groups.map((x) => (x.id === g.id ? { ...x, name: groupDraft.trim() } : x)));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingGroup(null);
            }}
            className="w-full rounded border border-sky-600 bg-zinc-950 px-1.5 py-0.5 text-xs outline-none"
          />
        ) : (
          <>
            <button
              onClick={() => toggleShut(key)}
              title={isShut ? "展開" : "折りたたむ"}
              className={"flex min-w-0 flex-1 items-center gap-1 text-left text-xs " + c.text}
            >
              <span className="w-2 shrink-0 text-[9px] text-zinc-500">{isShut ? "▸" : "▾"}</span>
              <span className="truncate font-medium">{g ? g.name : "共通"}</span>
              {/* A collapsed section still has to show it holds the selection. */}
              {isShut && hasCurrent && <span className="shrink-0 text-sky-400">●</span>}
            </button>
            <span className="shrink-0 font-mono text-[10px] text-zinc-600">{count}</span>
            {g && (
              <button
                onClick={(e) => openMenu(e, { kind: "group", group: g })}
                disabled={disabled}
                title="グループを編集"
                className="hidden shrink-0 leading-none text-zinc-500 hover:text-zinc-200 group-hover/h:block disabled:hidden"
              >
                ⋯
              </button>
            )}
          </>
        )}
      </li>
    );
  };

  /** Sectioned when there are groups to show; the plain 0..n ladder otherwise
   *  and while collapsed, where only the badge colours carry the grouping — a
   *  layer stays where its number says it is. */
  const rows =
    collapsed || !groups.length
      ? layers.map(layerRow)
      : sections.flatMap((s) => {
          if (!s.group && !s.layers.length) return [];
          const key = s.group?.id ?? NONE;
          const hasCurrent = s.layers.some((l) => l.index === current);
          return [
            header(s.group, s.layers.length, hasCurrent),
            ...(shut.has(key) ? [] : s.layers.map(layerRow)),
          ];
        });

  const createGroup = (name: string) => {
    setCreating(false);
    const n = name.trim();
    if (!n) return;
    onGroups([...groups, { id: "", name: n, color: nextColor(groups), layers: [] }]);
  };

  return (
    <aside
      className={
        "m-3 flex min-h-0 flex-col self-start overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900/80 shadow-xl shadow-black/40 backdrop-blur transition-[width] duration-150 " +
        (collapsed ? "w-11" : "w-56")
      }
    >
      <header
        className={
          "flex items-center border-b border-zinc-800 " +
          (collapsed ? "gap-0.5 px-1 py-1.5" : "gap-2 px-3 py-2")
        }
      >
        <h2
          title={collapsed ? "レイヤー" : undefined}
          className={
            "font-semibold tracking-wide text-zinc-400 " + (collapsed ? "text-[10px]" : "text-xs")
          }
        >
          {collapsed ? "L" : "レイヤー"}
        </h2>
        {!collapsed && (
          <button
            onClick={() => setCreating(true)}
            disabled={disabled}
            title="グループを作る"
            className="ml-auto shrink-0 rounded-md border border-dashed border-zinc-600 px-1.5 py-0.5 text-[10px] leading-none text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ＋グループ
          </button>
        )}
        <button
          onClick={onAdd}
          disabled={!canAdd}
          title={availableLayers === 0 ? "available_layers = 0 (再フラッシュが必要)" : "レイヤーを追加"}
          className={
            "shrink-0 rounded-md border border-dashed border-zinc-600 leading-none text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 " +
            (collapsed ? "ml-auto h-5 w-5 text-xs" : "h-6 w-6 text-sm")
          }
        >
          +
        </button>
      </header>

      {!collapsed && entryHidden && onShowEntry && (
        <button
          onClick={onShowEntry}
          className="border-b border-zinc-800 px-3 py-1 text-left text-[10px] text-violet-300 hover:bg-violet-500/10"
        >
          ＋ 入り方を表示
        </button>
      )}

      {!collapsed && !!suggested?.length && !dismissed && !groups.length && (
        <div className="border-b border-zinc-800 bg-sky-500/10 px-2 py-1.5 text-[11px]">
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 text-zinc-400">グループの提案</span>
            <span className="min-w-0 truncate text-zinc-200">
              {suggested.map((g) => g.name).join(" / ")}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <button
              onClick={() => onGroups(suggested)}
              disabled={disabled}
              className="flex-1 rounded border border-sky-600/60 py-0.5 text-sky-200 hover:bg-sky-600/20 disabled:opacity-40"
            >
              適用
            </button>
            <button
              onClick={() => {
                localStorage.setItem(SUGGEST_KEY, "1");
                setDismissed(true);
              }}
              className="rounded px-1.5 py-0.5 text-zinc-500 hover:text-zinc-200"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      <ul
        className={"min-h-0 flex-1 space-y-0.5 overflow-y-auto " + (collapsed ? "p-1" : "p-1.5")}
      >
        {rows}

        {creating && !collapsed && (
          <li>
            <input
              autoFocus
              maxLength={32}
              placeholder="グループ名"
              onBlur={(e) => createGroup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setCreating(false);
              }}
              className="w-full rounded-md border border-sky-600 bg-zinc-950 px-2 py-1 text-sm outline-none"
            />
          </li>
        )}

        {!collapsed &&
          removed.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => onRestore(r.id, layers.length)}
                disabled={disabled}
                title="削除したレイヤーを復元"
                className="w-full rounded-lg border border-dashed border-zinc-600 px-2 py-1.5 text-left text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
              >
                復元: {r.name || `L${r.index}`}
              </button>
            </li>
          ))}
      </ul>

      {menu && menu.kind === "layer" && (
        <MenuSheet menu={menu} onClose={closeMenu}>
          <div className="px-3 pb-1 pt-0.5 text-[10px] text-zinc-500">グループへ移動</div>
          {groups.map((g) => (
            <button
              key={g.id}
              className={ITEM + " flex items-center gap-2"}
              onClick={() => save(moveLayer(groups, menu.layer.id, g.id))}
            >
              <span className={"h-2.5 w-[3px] rounded-full " + GROUP_COLORS[g.color].bar} />
              {g.name}
            </button>
          ))}
          <button
            className={ITEM + " flex items-center gap-2 border-t border-zinc-800"}
            onClick={() => save(moveLayer(groups, menu.layer.id, null))}
          >
            <span className="h-2.5 w-[3px] rounded-full bg-zinc-600" />
            共通 (グループなし)
          </button>
          {!groups.length && (
            <div className="px-3 py-1.5 text-[10px] text-zinc-500">
              まだグループがありません。ヘッダの ＋グループ から作れます。
            </div>
          )}
        </MenuSheet>
      )}

      {menu && menu.kind === "group" && (
        <MenuSheet menu={menu} onClose={closeMenu}>
          {submenu === "color" ? (
            <div className="flex flex-wrap gap-1.5 px-3 py-2">
              {PICKABLE_COLORS.map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() =>
                    save(groups.map((x) => (x.id === menu.group.id ? { ...x, color: c } : x)))
                  }
                  className={
                    "h-5 w-5 rounded-full " +
                    GROUP_COLORS[c].bar +
                    (menu.group.color === c ? " ring-2 ring-white/70" : "")
                  }
                />
              ))}
            </div>
          ) : (
            <>
              <button
                className={ITEM}
                onClick={() => {
                  setGroupDraft(menu.group.name);
                  setEditingGroup(menu.group.id);
                  closeMenu();
                }}
              >
                名前を変更
              </button>
              <button className={ITEM} onClick={() => setSubmenu("color")}>
                色を変更 ▸
              </button>
              <button
                className={ITEM + " border-t border-zinc-800 text-red-300 hover:bg-red-500/10"}
                onClick={() => save(groups.filter((x) => x.id !== menu.group.id))}
              >
                グループを削除
              </button>
              <div className="px-3 pb-1 text-[10px] text-zinc-500">所属レイヤーは共通に戻ります</div>
            </>
          )}
        </MenuSheet>
      )}

      <ConfirmDialog
        open={confirmIdx !== null}
        title="レイヤーを削除しますか?"
        body={
          confirmIdx === null
            ? ""
            : `レイヤー ${confirmIdx} · ${layerLabel(layers[confirmIdx])} を削除します。\n削除後は「復元」から戻せます。`
        }
        confirmText="削除"
        danger
        onCancel={() => setConfirmIdx(null)}
        onConfirm={() => {
          const i = confirmIdx!;
          setConfirmIdx(null);
          onRemove(i);
        }}
      />
    </aside>
  );
}
