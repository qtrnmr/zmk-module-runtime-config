# zmkrt ui — frontend source

Vite + React 18 + TypeScript + Tailwind v4 source for the `zmkrt ui` single-page app.

The build output goes to `../zmk_runtime_cli/ui/static/` and **is committed**, so
`pipx install ./cli` works on machines without node.

## Requirements

node 24 (pinned in `.node-version`, picked up by mise) and pnpm.

## Development

```bash
pnpm install
pnpm dev                    # Vite dev server on :5173, proxies /api -> 127.0.0.1:8760
```

Run the Python server alongside it so the proxy has something to talk to:

```bash
cd .. && .venv/bin/zmkrt ui --no-open
```

The server holds the keyboard's USB serial port, so no other `zmkrt` command can run
while it is up.

## Build

```bash
pnpm build                  # tsc --noEmit && vite build -> ../zmk_runtime_cli/ui/static/
```

**Commit the regenerated `zmk_runtime_cli/ui/static/` together with the source change.**
A build with no source change must produce no diff.

## Test

```bash
pnpm test                   # vitest: geometry (layout maths), prettyKeycode and
                            # macroFormat (label display), params (modifier bits)
```

## Layout of the source

| File | Role |
|---|---|
| `src/api.ts` | typed fetch wrappers for every `/api/...` route; throws `ApiError` |
| `src/types.ts` | the shape of `GET /api/state` and `GET /api/features`, the tab list, `layerLabel()` |
| `src/macroFormat.ts` | macro step preview line and client-side keycode naming |
| `src/geometry.ts` | Studio layout units (1/100 key, 1/100 degree) -> px boxes + bounds |
| `src/prettyKeycode.ts` | canonical ZMK keycode name -> key-cap text |
| `src/components/Keyboard.tsx` | the SVG keyboard on the device's real physical layout |
| `src/components/BindingForm.tsx` | behaviour picker + metadata-driven parameter forms (shared) |
| `src/components/KeyEditor.tsx` | the keymap tab's editor: current binding + `BindingForm` |
| `src/components/LayerSidebar.tsx` | layer list, rename, reorder, add/remove/restore |
| `src/panels/*.tsx` | one panel per feature tab (macro, hold-tap, condlayer, combo, encoder, trackball); `ui.tsx` holds the shared shell and form primitives |
