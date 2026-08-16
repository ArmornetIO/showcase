# Showcase

**A Svelte 5 component library written by an AI, for AI.**

235 components. 310 exports. Zero hardcoded colors. Every prop typed, every
prop machine-readable, every component placeable, animatable, and inspectable
by an agent that has never seen the source.

Most component libraries are built for humans and then, reluctantly, described
to machines — a docs site scraped into a context window, a `.d.ts` file an
agent has to infer intent from. Showcase was built the other way around. The
component *is* the source of truth, and everything an agent needs — the prop
schema, the enum options, the control affordances, the animation channels, the
layout constraints — is emitted from it as structured data.

The result is a library you can *converse* with.

```
"Put a StatTile in the top-left, sub-variant down, and roll the value up over 400ms."
```

That sentence resolves. Not because someone wrote a natural-language adapter,
but because the registry knows `StatTile` exists, knows `subVariant` is an enum
of exactly `up | down | neutral`, knows it's `placeable`, and knows which of its
props can be driven over time and how.

---

## Install

```sh
npm install showcase
```

```js
// app.css or your root +layout
@import 'showcase/tokens.css';
```

```svelte
<script>
  import { Button, StatCard, StatTile } from 'showcase';
</script>

<StatCard label="Open findings" value={412} variant="critical" size="lg" />
<StatTile label="EVENTS" value="1,284" sub="↑ 12% vs last week" subVariant="up" />
<Button variant="primary" size="lg">Triage</Button>
```

Peer deps are just `svelte ^5` and `@sveltejs/kit ^2`. Nothing else ships to
your bundle. `sideEffects` is honest, so tree-shaking actually works.

---

## What's in the box

| | |
|---|---|
| **235** Svelte 5 components | runes-only — no `export let`, no stores, no `$:` |
| **103** registry entries | every one drag-placeable, prop-editable, scriptable |
| **105** icons | one `<Icon name="…" />`, typed against the catalog |
| **12** chart renderers | line, bar, donut, pie, radar, scatter, heatmap, horizon, waterfall, candlestick, box-plot, stacked-area |
| **4** themes | dark, light, OLED, and a WCAG-AAA high-contrast mode |
| **118** spec files | Vitest, real Chromium via Playwright — not jsdom |

Organized by intent, not by alphabet: `primitives/`, `layout/`, `navigation/`,
`display/`, `chart/`, `builder/`, `storyboard/`, `scene/`, `motion/`,
`frames/`, `icons/`, `theme/`, `docs/`.

---

## The agentic layer

This is the part that isn't in your other component library.

### 1. Every component publishes its own API as JSON

`npm run gen:api` walks the TypeScript AST of every component, resolves the
`$props()` type — whether it's an inline literal or a named interface in a
sibling `.types.ts` — and writes the contract to `src/lib/generated/*.api.json`,
JSDoc descriptions included.

```json
{
  "component": "Button",
  "props": [
    { "name": "variant", "type": "ButtonVariant", "optional": true, "default": "'ghost'" },
    { "name": "href", "type": "string", "optional": true,
      "description": "When set, renders as `<a>`; otherwise renders as `<button>`." }
  ]
}
```

An agent doesn't grep your source to learn `Button`. It reads one small JSON
file and knows the whole contract — including the prose explaining *why* a prop
exists. Documentation that cannot drift, because it is generated from the thing
it documents.

### 2. A registry that describes controls, not just types

`builder/registry.ts` carries what a type signature can't: how a prop should be
*presented*, when it's relevant, and whether it can be driven over time.

```ts
variant: {
  kind: 'enum',
  label: 'Variant',
  default: 'default',
  presentation: 'chips',   // a dropdown is the wrong control for two options
  options: ['default', 'danger']
},
color: {
  kind: 'enum',
  label: 'Color',
  default: '#5FEAD5',
  presentation: 'swatches', // show the palette, don't make them read it
  options: ['#5FEAD5', '#4ADE80', '#38BDF8', '#C4A8FF', '#FB7185', '#FDBA74']
}
```

`presentation` picks the affordance — `select`, `chips`, `swatches`, `icons`.
A color enum rendered as a list of token *names* makes you read the palette
instead of seeing it; swatches fix that. `showWhen` hides props the current
configuration has made meaningless. `animate` declares whether a value can be
interpolated (`lerp`), switched at a cue (`step`), or neither.

Registry invariants are enforced by tests — `registry.spec.ts`,
`registry-parity.spec.ts`, `renderer-coverage.spec.ts`. A component cannot
silently fall out of the registry, and the registry cannot silently describe a
component that doesn't exist.

### 3. Scenes: UI as a scriptable timeline

`scene/` turns a composition into a document an agent can author, validate,
serialize, and scrub. The core distinction is **channel vs burst**, and it isn't
cosmetic — it decides whether scrubbing is exact:

> A **channel** has a well-defined value at *every* t, held between cues,
> falling back to the object's declared value. A **burst** has no value at
> arbitrary t — only an onset. If the story is unreadable without a burst, it
> should have been a channel.

The animatable vocabulary is **derived from the registry**, not authored
separately. Add a prop, and it becomes a scene channel automatically, with
`showWhen` carried through so a hidden prop is never offered as a target. Then:
`SceneBuilder`, `ScenePlayer`, `SceneInspector`, `SceneCuePicker`, plus
`validate.ts` and `serialize.ts` so a generated scene can be checked before it
ever renders.

Pair it with `storyboard/` — `StoryboardCanvas`, `SwimLane`, `StoryboardBranch`,
`StoryboardArrow` — and you can lay out a flow, then play it.

### 4. Frames: skeletons that *are* the component

A frame is not a loading spinner. It's the state a region is in before its data
exists: the component draws its real outer shell, and its text-bearing fields
drain into shimmer bars sized to their own boxes.

```ts
export const FRAME_MAP: Record<string, FrameSpec> = {
  Panel: { fields: ['.panel-title'] },
  Chip:  { fields: ['.chip-body'] }
};
```

Pixel-accurate, zero layout shift — the skeleton is the real page with the data
removed. No `if (loading)` branch in 235 components: one curated declarative
map, flattened into a single scoped stylesheet, plus `.frame-field` /
`.frame-hide` escape hatches for page-local markup.

### 5. DevCog: close the loop back to the agent

`showcase/devcog` is an in-app cockpit for the humans reviewing what the agent
built. Point at anything on the page, annotate it, and DevCog captures the
selector, the text, and the outer HTML. Collect a batch of nits across a
session, then export the whole thing as a **fix-prompt** — structured, stack-aware,
ready to paste straight back into the agent that wrote the code.

Framework-agnostic, side-effect-light, node-testable, host branding injected via
config. The feedback path from "that padding is wrong" to a merged fix is one
copy.

### 6. Design doctrine, encoded as correct/incorrect pairs

`/design-patterns` doesn't describe the rules in prose an agent will
paraphrase and then violate. It renders each rule as a matched pair of live
components — the right way beside the wrong way — for three-region layout, the
explaining eyebrow, and the trail. Show, don't tell, applied to the machine
reader.

---

## The design system

**Tokens first.** Every color, surface, border, glow, and shadow is a CSS custom
property in `tokens.css`, and a test asserts that every `var()` in the library
resolves to one — including fallback chains, so nothing can quietly opt out.
Swapping a theme is swapping a `:root` block — not a rebuild, not a class sweep,
not a Tailwind config edit.

```css
--bg: #06070b;
--accent: #5eead4;
--border: rgba(255, 255, 255, 0.08);
--shadow-card: 0 30px 80px -30px rgba(0,0,0,.8), 0 0 60px -20px rgba(94,234,212,.3);
```

Cascade layers are declared up front (`@layer theme, base, components, utilities`)
so intentional utilities always out-rank the base reset. Tailwind v4 is used for
layout and spacing; it is never used to smuggle in a color.

**Four themes, one contract.** `dark` (near-black, teal accent — the default),
`light`, `oled` (pure black), and `high-contrast` (WCAG AAA: black, white,
yellow). Each declares its `mode` and a four-stop swatch, so `ThemePicker`
renders the palette rather than a list of names. `system` resolves against
`prefers-color-scheme`.

**Motion with a conscience.** `motion/` ships a real vocabulary — `collapse`,
`implode`, `vanish`, `Flourish`, typed exits and effects — every one of them
routed through `reduced-motion.ts`. Accessibility isn't a prop you remember to
pass.

---

## Beyond primitives

Showcase is not only buttons and inputs. It carries whole vertical surfaces,
built and battle-tested inside a production security platform:

- **`mesh-studio/`** — GL-accelerated mesh canvas, node glyphs resolved per agent
  mode, live topology rendering
- **`physics/`** — orbit simulation with real spec coverage
- **`chart/`** — a composable chart engine: shared context, scales, axis,
  crosshair, legend, tooltip, annotations, and 12 pluggable renderers
- **`assessment/` `risk/` `supply-chain/` `roadmap/`** — domain surfaces that
  prove the primitives compose at real complexity
- **`model-explorer/` `perf/` `settings/` `docs/`** — application chrome:
  docs shell, TOC, breadcrumbs, prose, nav
- **`auth/`** (`showcase/auth`) — sign-in surfaces as a separate entry point

Plus `/mockups` — 37 full-page compositions, from onboarding wizards to breach
maps to policy authoring, each one a working proof that the system holds up past
the storybook.

---

## Develop

```sh
npm install
npm run dev          # the showcase app — every component, live
npm run check        # svelte-check
npm run test:run     # Vitest, real browser
npm run gen:api      # regenerate the machine-readable component contracts
npm run build        # build app + package the library (svelte-package + publint)
```

`src/lib/` is the library. `src/routes/` is the showcase app that documents it.

### Adding a component

1. Build it in the right `src/lib/<category>/` directory. Runes only.
2. Type `$props()` — inline literal or a named interface. JSDoc the non-obvious
   props; that prose ships to agents.
3. Style from tokens. If you type a hex value, you're doing it wrong.
4. Export from `src/lib/index.ts`.
5. Add a registry entry if it should be placeable — `presentation`, `showWhen`,
   and `animate` where the defaults are wrong.
6. `npm run gen:api`, then a `.spec.ts` next to it.
7. Add a route in `src/routes/` so a human can see it too.

The parity and coverage specs will tell you which of these you forgot.

---

## Status

Pre-1.0 and moving fast. The component set is stable enough to build products
on — it already carries one — but exports may shift before the first tagged
release. Pin exactly if that matters to you.

**Contributions welcome**, with one house rule: if a change makes the library
harder for a machine to read, it needs a very good reason. Generated contracts
stay generated. Registry invariants stay enforced. Tokens stay the only source
of color.

---

*Built with Claude. Tuned by hand. Designed to be handed back.*
