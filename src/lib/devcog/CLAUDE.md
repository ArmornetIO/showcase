# devcog/ — the portable dev toolbar

Read `README.md` first for the surface and how to mount it.

## Which package am I in?

- **`showcase/src/lib/devcog/`** — ships into host apps. The console, QA nits,
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
- **Sub-components stay unexported.** `index.ts` exports `DevCog`, the group
  seam (`ToolGroup` + the `controls/` vocabulary), the two engines, and the perf
  re-exports. Nothing else. A host extends by contributing a `ToolGroup` — if a
  host needs to import `Console.svelte`, the extension point is wrong and the
  fix is the extension point.
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

Host tools build their body out of `controls/` — `ControlRow`, `Seg`, `Fader`,
`InfoDot` — so they sit flush with the built-ins. A caller that hand-rolls a
label-and-slider row has started a second design; that is how the old panel
ended up with four of them.

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
- **The Escape ladder lives in `DevCog.svelte`** and nowhere else, and its
  order is note → inspector → console. The inspector comes BEFORE the console
  because it outlives the panel; any other order leaves the page armed with
  nothing on screen saying so. A panel that handles its own Escape will close
  two things at once.
- **Closing the console must NOT disarm the inspector.** That reversal is the
  whole reason the inspector moved to the cluster — the element you need to
  click is usually under where the panel would be.
- **No standing prose in a group.** An explanation goes in `detail=` on the
  control it explains, and "this needs a reload" is `applies="reload"`, not a
  sentence. The redesign cut 214 words to 0; a paragraph added back is a
  regression the measure script will catch.
- **A gated group declares `available: false` + `gate`.** It stays in the rail,
  dimmed. Do not wrap the tool in an `{#if}` — a group that vanishes is a group
  nobody knows exists.
- **`const state = ...` in a `.svelte` file is a hard compile error.** Svelte
  reads a bare `state` identifier as a store and SSR 500s rather than degrading.
  Name it `consoleState`.
- **Localhost gating is the host's job, not this package's.** `MeshDevControls`
  gates its fixture on localhost itself; devcog does not know what environment
  it is in and should not learn.

## Testing

```sh
cd showcase && npx vitest run --project node src/lib/devcog
```

**`--project node` is mandatory.** showcase declares two vitest projects
(`vite.config.ts`): `browser` runs `*.svelte.spec.ts` under Playwright Chromium,
`node` runs everything else. Dropping the flag starts the browser project, and
it hangs the machine.

There ARE `*.svelte.spec.ts` files here — `DevCog`, `console/GroupRail`,
`controls/Fader` — because three behaviours are not expressible in node: roving
arrow-key focus, the reference tick's position, and the console closing without
disarming the inspector. **They are authored for CI and must not be run
locally.** Every one carries a CI-ONLY header saying so.

The split to keep: logic in a `.spec.ts` that runs in node, and only what needs
a real layout or a real key event in a `.svelte.spec.ts`. For anything visual,
take a Playwright screenshot against a running app instead, or run
`specs/018-devcog-console/measure.mjs`, which drives the real console in a real
browser and grades it against the spec's criteria.

Before declaring done:

```sh
cd showcase && npx svelte-check --tsconfig ./tsconfig.json --output human
```

`npm run check` also fails on a pre-existing `breach-locker/ItemGrid.svelte`
Tailwind problem unrelated to this package, which is why the check is run
directly.

Changing `<DevCog>`'s prop signature means changing **three** call sites in the
same edit — `showcase/src/routes/+layout.svelte`,
`showcase/src/routes/dev/+page.svelte`, and
`app-ui/src/lib/components/dev/DevTools.svelte`. Missing one degrades quietly:
the console renders empty rather than failing.
