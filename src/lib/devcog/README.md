# devcog

The floating dev toolbar, and the framework-agnostic engine behind it. Nothing
here is armornet-specific — a freshly bootstrapped app can wire the whole thing
from `showcase/devcog`.

> **Not to be confused with `showcase/src/lib/dev/`**, which is the showcase
> *site's own* chrome — its sidebar, toolbar, API table and mockup nav. That one
> exists to render the component gallery. This one ships into host apps.

## Two surfaces, one cluster

| | Question it answers |
|---|---|
| **flags/** | What is this build serving? Feature flags, serve mode, perf. |
| **qa/** | What is wrong with this page? Element inspector, nit batch, plus whatever the host contributes. |

`DevCog.svelte` owns only what both share: which panel is open, the nits
controller they both read, and the Escape ladder. Anything with markup of its
own lives in the folder it belongs to.

## Mounting it

```svelte
<DevCog
  {snap} {mode} {modes}
  onToggle={(key, enabled) => …}
  onModeChange={(m) => …}
  showPerf
  nitConfig={MY_NIT_CONFIG}
>
  {#snippet qaContent()}
    <MyPageTools />
  {/snippet}
</DevCog>
```

`snap` comes from `createFlagStore` in `flags/engine.ts`. `nitConfig` is the
storage slot plus the AI-prompt branding for the nit batch — it is read once at
construction, because a host swapping keys mid-session would strand whatever is
already captured.

## Extending it — `qaContent`

**This is the only extension point, and it is deliberate.** Sub-components are
not exported; a host adds tools through the `qaContent` snippet rather than by
reaching into the drawer.

Wrap each block in `QaSection` so host tools sit flush with the built-in ones
instead of every caller re-inventing a heading:

```svelte
<QaSection label="mesh load">…</QaSection>
<QaSection label="detail" grow>…</QaSection>
```

`app-ui/src/lib/components/dev/MeshDevControls.svelte` is the reference host
extension — read it before writing a new one.

### Copying a batch, or part of one

Each nit card has its own `copy`, which emits a prompt for that nit alone. Cards
also tick: with a selection live, the drawer's copy button emits only the ticked
nits (`copy 3`), and with nothing ticked it emits the whole batch. `all` / `none`
flip the selection wholesale, and Escape clears it once the note popup and the
inspector are both down.

The fallback is deliberate — the common case (copy everything) stays one click,
so selection is a narrowing tool rather than a step you must complete first.

```ts
nits.copyOne(id); // exactly one, ignoring the ticks
nits.copyPrompt(); // the ticked nits, else the whole batch
nits.copyTargets; // what copyPrompt would emit, in batch order
```

### Borrowing the element inspector

`qaContent` receives the nits controller, so a tool that needs *which element*
reuses the one picker in the cog instead of shipping a second armed-click mode
that fights it for the same clicks:

```svelte
{#snippet qaContent(nits)}
  <MyTool {nits} />
{/snippet}
```

```ts
nits.pickOnce((el) => { /* the next click lands here; no nit is captured */ });
```

`pickOnce` arms the inspector for exactly one pick and disarms itself.
`nits.borrowed` is true while a tool holds it, so UI can say what it is arming
for. An explicit arm from the drawer's own button always wins back the nit flow.

`showcase/src/lib/primitives/chrome/PanelShapeControls.svelte` is the reference
for this half — it picks a card and re-shapes it in place.

## What belongs in the QA cog, and what does not

The line that keeps getting crossed: **the cog is for things whose correct value
is a function of the build or the page, not of a user's preference.**

A synthetic load fixture, a per-layer draw toggle, a nit batch — these are
developer instruments. An operator has no opinion about "connection rings". If a
control is something a *user* would reasonably want to set and keep, it belongs
in the product's own view controls (e.g. `MeshViewControls`), not here.

`MeshDevControls` states this explicitly for its DETAIL section, and it is worth
copying the reasoning, not just the pattern.

## Exports

From `showcase/devcog`:

- `DevCog` — the component
- **flags** — `createFlagStore`, `FlagStore`, `FlagStoreConfig`, `FlagSnapshot`,
  `FlagSource`, `DevRuntime`
- **qa** — `loadNits`, `saveNits`, `parseNits`, `getCssPath`, `buildAIPrompt`,
  `DEFAULT_NIT_CONFIG`, `Nit`, `NitConfig`
- `NitsController`, `DEVCOG_ATTR`, `NitCapture` — the reactive half, exported so
  a host can drive a batch from a shortcut or menu rather than only the drawer.
  `DEVCOG_ATTR` marks host chrome the element inspector must skip.
- `perfBudget`, `PerfTier`, `PerfPanel` — re-exported from `../perf/` for
  convenience

## Layout

```
DevCog.svelte      shell — panel state, Escape ladder, nothing else
DevCogCluster      the floating buttons
DevIcon            the cluster's glyphs
flags/
  engine.ts        flag resolution + serve mode (framework-agnostic, tested)
  FlagsPanel       the panel, FlagRow, ModeSwitcher
qa/
  nits.ts          pure: parse/serialize, CSS paths, AI prompt (tested)
  nits.svelte.ts   NitsController — the reactive half (tested)
  QaDrawer         the drawer; QaSection is the block a host fills
  NitLayer         the on-page overlay; NitCard/NitList/NitHighlight/NitNotePopup
  WasmProbe        wasm build readout
```

## Tests

```sh
cd showcase && npx vitest run --project node src/lib/devcog
```

`--project node` is not optional. showcase declares two vitest projects, and the
other one (`browser`) launches Playwright Chromium — omitting the flag starts it
even though devcog has no `.svelte.spec.ts` for it to run.

`engine.spec.ts`, `nits.spec.ts` and `nits-controller.spec.ts` are Node tests
over the pure halves. See `CLAUDE.md` in this directory.
