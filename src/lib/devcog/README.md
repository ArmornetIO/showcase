# devcog

The floating dev console, and the framework-agnostic engine behind it. Nothing
here is armornet-specific — a freshly bootstrapped app can wire the whole thing
from `showcase/devcog`.

> **Not to be confused with `showcase/src/lib/dev/`**, which is the showcase
> *site's own* chrome — its sidebar, toolbar, API table and mockup nav. That one
> exists to render the component gallery. This one ships into host apps.

## One console, one cluster

It used to be two floating surfaces — a flags popup and a QA drawer — which
covered each other and could not be read together. Feature flags and serve mode
now have a real home on the host's admin page, so the popup is gone and what
remains is **one console about THIS PAGE**: its canvas, its render tunables, its
page actions, its captures, its frame cost.

The console shows **one group at a time** behind a vertical rail. That is the
whole layout rule, and everything else follows from it: a group is sized to fit,
a group you have to scroll is a group the design failed to fit, and only the
capture batch is allowed to break it (`scrolls: true`) because forty captures
cannot fit any viewport.

The cluster is **two buttons**: arm the element inspector, open the console. The
inspector is deliberately *not* owned by the console — it arms from the cluster
and outlives the panel, because the element you need to click is usually under
where the panel would be.

`DevCog.svelte` owns only what the surfaces share: whether the console is open,
the one nits controller, and the Escape ladder (pending note → inspector →
console). Anything with markup of its own lives in the folder it belongs to.

## Mounting it

```svelte
<DevCog
  groups={[
    { id: 'page', label: 'PAGE', glyph: '▤', order: 10, content: pageGroup }
  ]}
  flagsHref="/admin/flags"
  nitConfig={MY_NIT_CONFIG}
/>
```

`nitConfig` is the storage slot plus the AI-prompt branding for the nit batch —
it is read once at construction, because a host swapping keys mid-session would
strand whatever is already captured. `consoleConfig` is the same arrangement for
the selected-group key. `flagsHref` is one link in the footer; the flags UI
itself is the host's, on its admin page.

## Extending it — `ToolGroup`

**This is the only extension point, and it is deliberate.** Sub-components are
not exported; a host adds tools by contributing groups, not by reaching into the
panel. A group is what lets a host's tools be ordered, gated and reached in the
same two actions as the built-ins.

```svelte
{#snippet pageGroup(nits)}
  <ControlRow label="latency" display="{ms}ms" applies="reload" detail="…">
    <Seg options={PRESETS} value={preset} onchange={pick} />
  </ControlRow>
{/snippet}

<DevCog groups={[
  { id: 'page',  label: 'PAGE',  glyph: '▤', order: 10, content: pageGroup },
  { id: 'mesh',  label: 'MESH',  glyph: '◈', order: 40,
    available: onMesh, gate: 'Only on the mesh canvas.', content: meshGroup }
]} />
```

Built-ins occupy orders 10/20/30/40/50/60, with `CAPTURE` at 50 and `PERF` at
60, so a host group can sit between them.

**A gated group stays in the rail, dimmed, and states its condition.** Set
`available: false` and a `gate` sentence rather than wrapping the tool in an
`{#if}`: a group that vanishes is a group nobody knows exists, which is how half
the old panel could be missing without anyone noticing.

`app-ui/src/lib/components/dev/DevTools.svelte` is the reference host extension —
read it before writing a new one.

### The control vocabulary

Build a group body out of `controls/`, not hand-rolled rows — the old panel ended
up with four different ways to render "a label and a slider", each with its own
paragraph underneath.

| | For |
|---|---|
| `ControlRow` | The alignment contract: label, applies badge, info dot, value, control |
| `Seg` | A dense segmented pick. (`primitives/actions/SegmentGroup` wraps to two rows at this width — the fork is density, not duplication) |
| `Fader` / `FaderBank` | 2+ numeric values compared at a glance, with a reference tick at the measured sweet spot |
| `InfoDot` | Where a control's explanation lives |

**Explanations go in `detail=` on the control they explain, never in standing
prose.** The console used to carry 214 words of paragraphs; they are all info
dots now. Likewise `applies="reload" | "resize"` renders a badge instead of a
sentence saying a change needs a reload.

### Copying a batch, or part of one

Each nit card has its own `copy`, which emits a prompt for that nit alone. Cards
also tick: with a selection live, the capture group's copy button emits only the
ticked nits (`copy 3`), and with nothing ticked it emits the whole batch. `all` /
`none` flip the selection wholesale, and Escape clears it once the note popup and
the inspector are both down.

The fallback is deliberate — the common case (copy everything) stays one click,
so selection is a narrowing tool rather than a step you must complete first.

```ts
nits.copyOne(id); // exactly one, ignoring the ticks
nits.copyPrompt(); // the ticked nits, else the whole batch
nits.copyTargets; // what copyPrompt would emit, in batch order
```

### Borrowing the element inspector

A group's `content` snippet receives the nits controller, so a tool that needs
*which element* reuses the one picker in the cog instead of shipping a second
armed-click mode that fights it for the same clicks:

```svelte
{#snippet pageGroup(nits)}
  <MyTool {nits} />
{/snippet}
```

```ts
nits.pickOnce((el) => { /* the next click lands here; no nit is captured */ });
```

`pickOnce` arms the inspector for exactly one pick and disarms itself.
`nits.borrowed` is true while a tool holds it, so UI can say what it is arming
for. An explicit arm from the cluster's own button always wins back the nit flow.

`showcase/src/lib/primitives/chrome/PanelShapeControls.svelte` is the reference
for this half — it picks a card and re-shapes it in place.

## What belongs in the console, and what does not

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
- **console** — `ToolGroup`, `ConsoleConfig`, `AppliesWhen`,
  `DEFAULT_CONSOLE_CONFIG` — the group seam
- **controls** — `ControlRow`, `Seg`, `Fader`, `FaderBank`, `InfoDot`
- `WasmProbe` — a page tool, so it belongs in a host's PAGE group rather than
  standing as a built-in whether or not it applies
- **flags** — `createFlagStore`, `FlagStore`, `FlagStoreConfig`, `FlagSnapshot`,
  `FlagSource`, `DevRuntime`. The **engine only**: the flags UI moved to the
  host's admin page, but the host is built on the store
- **qa** — `loadNits`, `saveNits`, `parseNits`, `getCssPath`, `buildAIPrompt`,
  `DEFAULT_NIT_CONFIG`, `Nit`, `NitConfig`
- `NitsController`, `DEVCOG_ATTR`, `NitCapture` — the reactive half, exported so
  a host can drive a batch from a shortcut or menu rather than only the console.
  `DEVCOG_ATTR` marks host chrome the element inspector must skip.
- `perfBudget`, `PerfTier`, `PerfPanel` — re-exported from `../perf/` for
  convenience

## Layout

```
DevCog.svelte      shell — console state, Escape ladder, nothing else
DevCogCluster      the floating buttons: arm inspector, open console
DevIcon            the cluster's glyphs
console/
  types.ts         ToolGroup, AppliesWhen, ConsoleConfig — the vocabulary
  console-state    which group is showing, remembered across reloads
  Console.svelte   the panel; GroupRail is the rail beside it
  CaptureGroup     the built-in nit batch group
controls/
  ControlRow       the alignment contract for a non-fader control
  Seg              dense segmented pick
  Fader/FaderBank  vertical channel strips with a reference tick
  InfoDot          where a relocated sentence lives
flags/
  engine.ts        flag resolution + serve mode (framework-agnostic, tested).
                   ENGINE ONLY — the UI is the host's admin page now.
qa/
  nits.ts          pure: parse/serialize, CSS paths, AI prompt (tested)
  nits.svelte.ts   NitsController — the reactive half (tested)
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
