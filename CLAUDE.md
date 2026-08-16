# showcase

Svelte 5 component library with showcase app. Components are organized into thematic directories under `src/lib/`: `primitives/`, `layout/`, `display/`, `navigation/`, `chart/`, `builder/`, `storyboard/`, `icons/`, `assessment/`, `perf/`, `theme/`, `api/`, `docs/`, `dev/`. The builder component registry lives at `src/lib/builder/registry.ts`.

## Commands

Run from `showcase/`:

```sh
npm run check     # svelte-check type checking — run after edits
npm run lint      # Prettier + ESLint
npm run format    # Prettier auto-fix
npm run test      # Vitest unit/component tests
```

## Conventions

- **Svelte 5 runes only** — `$state`, `$props`, `$derived`, `$effect`. No Svelte 4 syntax.
- Every new component needs: an entry in `src/lib/builder/registry.ts`, a showcase route under `src/routes/`, and at least one Vitest render test.
- Absorb variants into a single unified component (e.g. Card covers StatCard/DocCard/SummaryCard) — do not ship parallel components for the same concept.
- No new npm dependencies without explicit approval.

## Verification

After adding or absorbing a component, run `npm run check` and `npm run test` to confirm parity and types are clean.
