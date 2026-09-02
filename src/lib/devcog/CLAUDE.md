# devcog/ — the portable dev toolbar

Read `README.md` first for the surface and how to mount it.

## Which package am I in?

- **`showcase/src/lib/devcog/`** — ships into host apps. Feature flags, QA nits,
  the floating cluster. **This one.**
- **`showcase/src/lib/dev/`** — the showcase *site's* own chrome: sidebar,
  toolbar, `ApiTable`, `mockup-nav`. Renders the gallery; never ships.

These get confused constantly. If you are adding something a customer's browser
will load, you are in the right place.

## Rules

- **Nothing armornet-specific.** No `$lib` imports, no product vocabulary, no
  route constants. A host supplies config; this package supplies mechanism. The
  moment a framework name or an org concept appears here, it has become a
  product feature wearing a dev toolbar's clothes.
- **Sub-components stay unexported.** `index.ts` exports `DevCog`, the two
  engines, and the perf re-exports. Nothing else. A host extends through the
  `qaContent` snippet — if a host needs to import `QaDrawer`, the extension
  point is wrong and the fix is the extension point.
- **The pure halves stay pure.** `flags/engine.ts` and `qa/nits.ts` have no
  Svelte imports and are tested in Node. `nits.svelte.ts` is the reactive half
  and is where `$state` lives. Do not collapse them — that split is why the
  logic is testable without a browser.
- **No new dependencies.**

## The judgment call this package keeps forcing

**A dev instrument, not a preference.** The cog is for things whose correct
value follows from the build or the page — a synthetic load fixture, a per-layer
draw toggle, a nit batch. If a *user* would reasonably want to set it and keep
it, it belongs in the product's own view controls (`MeshViewControls` and
friends), not here.

`app-ui/src/lib/components/dev/MeshDevControls.svelte` argues this explicitly
for its DETAIL section: an operator has no opinion about "connection rings", so
the toggle is a developer's comparison tool and lives in the cog. Copy the
reasoning when you add a section, not just the shape.

Host tools wrap in `QaSection` so they sit flush with the built-ins. A caller
that hand-rolls a heading has started a second design.

## Gotchas

- **`nitConfig` is read once**, via `untrack`, at construction. A host swapping
  storage keys mid-session would strand whatever is already captured — so the
  controller is deliberately built from the config it mounted with.
- **`DEVCOG_ATTR` marks chrome the element inspector must skip.** Anything you
  add that floats over the page needs it, or the inspector will happily capture
  a nit against the nit tool.
- **There is ONE armed-click mode, and `pickOnce` is how you share it.** A host
  tool that needs an element borrows the inspector; it does not add a second
  "click something" state. Two pickers competing for the same click is a bug
  the user experiences as the wrong tool winning at random.
- **The Escape ladder lives in `DevCog.svelte`** and nowhere else. A panel that
  handles its own Escape will close two things at once.
- **Localhost gating is the host's job, not this package's.** `MeshDevControls`
  gates its fixture on localhost itself; devcog does not know what environment
  it is in and should not learn.

## Testing

```sh
cd showcase && npx vitest run --project node src/lib/devcog
```

**`--project node` is mandatory.** showcase declares two vitest projects
(`vite.config.ts`): `browser` runs `*.svelte.spec.ts` under Playwright Chromium,
`node` runs everything else. Dropping the flag starts the browser project even
when it has nothing to run, and it hangs the machine.

So: the specs here are Node-only by design — keep them that way, and do not add
a `*.svelte.spec.ts` to this package. For anything visual, take a Playwright
screenshot against a running app instead.

Before declaring done:

```sh
cd showcase && npm run check
```
