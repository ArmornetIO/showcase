# renderer

Draws one builder canvas item — a registry id plus an untyped prop bag — as the
real component.

`ComponentRenderer.svelte` (one level up) is the entry point and does nothing but
dispatch: it resolves the id through `groups.ts` and mounts the one renderer that
claims it. Everything else in here is a family of components and the branches
that render them.

## Layout

| File | Owns |
| --- | --- |
| `groups.ts` | The dispatch table: registry id → render group |
| `types.ts` | `RendererProps` — the contract every renderer speaks |
| `accessors.ts` | Prop coercion (`s`/`b`/`n`/`e`) and parsers for JSON, lines, CSV |
| `trigger.svelte.ts` | Per-instance overlay state for triggerable components |
| `TriggerOverlays.svelte` | The drawer/modal a trigger opens |
| `chart-presets.ts` | Preview `ChartConfig`s, one per chart type |
| `*Renderer.svelte` | One family each — primitives, forms, layout, navigation, metrics, data, display, code, marketing, brand, mesh, assessment, storyboard |

## Adding a component

1. Add it to `REGISTRY` in `../registry.ts` as usual.
2. Add its id to the right group's `ids` in `groups.ts`.
3. Write the `{:else if componentId === 'Foo'}` branch in that group's file.

`renderer-coverage.spec.ts` fails if you stop after step 1 or step 2, if two
groups claim the same id, or if a group claims an id the registry doesn't have.

If a component genuinely fits no existing family, add a group: a new
`FooRenderer.svelte` plus an entry in `RENDER_GROUPS`. Prefer that over letting a
group grow into a catch-all.

## Rules

- **Coerce, never trust.** Props are edited live, so a JSON field is half-typed
  most of the time. Use `parseJson` with the preview data as the fallback and
  never throw.
- **Read props through a getter.** `accessors(() => props)` — the builder
  replaces the whole bag on every edit, so a captured reference goes stale.
- **Handlers are no-ops.** A renderer previews appearance and state; it does not
  run behaviour. The exception is `Trigger`, which exists to demo an interaction.
- **Fixtures stay next to their branch**, unless they are big enough to bury the
  markup — that is what `chart-presets.ts` is for.
- **No store access.** Renderers take props only, which is why the scene stage,
  the palette thumbnails and the theme studio can all reuse them.
