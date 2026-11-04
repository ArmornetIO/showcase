---
name: canvas-mode
description: Build a UI mockup or storyboard in showcase from showcase's own components, writing straight to src/routes/mockups/<slug>/ while Vite HMR updates the preview and screenshots confirm it. Use when asked to build a mockup, sketch a screen, generate a UI component demo, or draw a user flow.
---

Paths below are relative to the showcase root (the directory holding
`package.json` and `svelte.config.js`).

## What this does

Claude writes a mockup to `src/routes/mockups/<slug>/+page.svelte`. The Vite
dev server picks up every save through HMR, and a Playwright screenshot
confirms the result.

## The point: a mockup is ASSEMBLED, not drawn

A mockup exists to show a screen built from **showcase's own components**. A
page of hand-rolled `<div class="card">` plus bespoke CSS is a failed mockup
even when it screenshots well: it proves nothing about real use, it drifts from
the design system the moment a token changes, and the library exists so nobody
invents a card again.

**Before writing any markup, look at what already exists.** The library is
large (~200 exports) and not guessable: there is a `DocCard`, a `Tile`, a `HudCard`, a `CompositeCard`, a `PricingCard`, a `PageHero`, a
`SectionBar`, a `StatTile`, an `EmptyState`, a `FaqAccordion`. Assume the thing
you are about to build by hand is already there under a name you did not
predict.

```sh
# every export, by name
grep -oE "as [A-Z][A-Za-z0-9_]+" src/lib/index.ts | sed 's/as //' | sort
# then read the props of each one you intend to use
```

Then **look at them rendered**: `/showcase/cards`, `/showcase/display`,
`/showcase/primitives`, `/showcase/layout` are gallery routes. Screenshot the
gallery for the family you need before choosing. A props list does not tell you
the house card has cut corners, a mono eyebrow and a glow on hover; the picture
does.

### Rules

- **Component first.** If a showcase component covers the block, use it. Raw
  markup is for layout scaffolding (the grid, the gaps) and the one genuinely
  novel thing the page is about.
- **If the library nearly fits, say so.** A missing variant or prop is a
  finding to report: it is how the library grows. Never fork a private copy of
  a component into the mockup.
- **No hardcoded colours, radii or type ramps.** Design tokens only
  (`var(--accent)`, `var(--fg-dim)`, `var(--radius-surface)`, `var(--mono)`,
  `var(--sans-brand)`). A hex literal in a mockup is a bug.
- **Match the house voice.** Mono uppercase eyebrows, brand display font for
  headlines, dense metadata rows. Open a neighbouring mockup and copy its
  register before inventing one.
- **Self-check before screenshotting:** count the components imported from
  `$lib`. If a full page imports fewer than a handful, it was built wrong; go
  back to the gallery.

## Workflow

1. Check the dev server is up (`curl -sI http://127.0.0.1:5173/showcase/`).
   If it is not, ask the user to run `npm run dev`, or run
   `node .claude/skills/canvas-mode/driver.mjs start` if they say to.
2. **Inventory the library**: list `src/lib/index.ts` exports, read the props
   of the candidates, screenshot the relevant gallery routes. Do this *before*
   writing markup, not after a first draft is rejected.
3. Write the mockup to `src/routes/mockups/<slug>/+page.svelte` (conventions
   below).
4. No registration step: the sidebar discovers mockups from disk
   (`src/lib/dev/projects.ts`). `src/routes/mockups/*` is gitignored, so a
   mockup is a local sketch until someone promotes it into the library.
5. Screenshot it: `node .claude/skills/canvas-mode/driver.mjs ss /mockups/<slug> <slug>`.
6. Iterate on the file until the screenshot looks right.
7. Report the URL: `http://127.0.0.1:5173/showcase/mockups/<slug>`.

## Mockup conventions

- Route: `src/routes/mockups/<slug>/+page.svelte`.
- Import library components from `$lib/` paths (`$lib/primitives/Button.svelte`).
- Svelte 5 runes only: `$state`, `$derived`, `$effect`, `$props`.
- At the top of `<script>`: an API stub block with realistic fake data,
  `snake_case` field names, and a comment giving each data shape, so the page
  can be wired to a real endpoint by swapping the stub.
- Styling is design tokens and Tailwind utilities. Custom CSS only where tokens
  do not reach (terminal chrome, full-bleed canvas layouts).

## Storyboards / flow diagrams

1. Use `StoryboardCanvas`, `SwimLane`, `StoryboardFrame`, `StoryboardArrow`,
   `StoryboardBranch` from `$lib/storyboard/`.
2. Write to `src/routes/mockups/<slug>-flow/+page.svelte` (`-flow` suffix by
   convention).
3. Each `SwimLane` is one user or system path ("UI WIZARD", "CLI FAST PATH").
4. Each `StoryboardFrame` is one screen thumbnail; inline the mini mockup as
   scaled content.
5. `StoryboardArrow` between frames (optional `label` for the transition).
6. `StoryboardBranch` for alternate paths (expired, error, skip).
7. Reference: `src/routes/storyboard/+page.svelte`.

| Component | Props | Purpose |
|-----------|-------|---------|
| `StoryboardCanvas` | — | Outer scroll container for all swim lanes |
| `SwimLane` | `pill`, `sub?`, `footer?` snippet | One horizontal user path |
| `StoryboardFrame` | `step?`, `route?`, `badge?`, `badgeVariant?`, `dashed?`, `href?`, `width?`, `height?` | Single screen thumbnail |
| `StoryboardArrow` | `label?`, `tall?` | Connector between frames |
| `StoryboardBranch` | `label?` | Vertical branch for alternate paths |

`StoryboardFrame` content renders at ~0.38× scale: use raw `px` values (not
`rem`) so the scaled innards read correctly.

## Comparing variants

`http://127.0.0.1:5173/showcase/compare?a=<slug-v1>&b=<slug-v2>`

## Driver

`driver.mjs` beside this file uses showcase's own `playwright` dev dependency.
After `npm install`, a fresh clone also needs the browser once:
`npx playwright install chromium`. Screenshots land in `$TMPDIR/showcase-shots/<name>.png`; read them back to
check the result.

```sh
node .claude/skills/canvas-mode/driver.mjs start                 # start `vite dev` on :5173 if nothing is there
node .claude/skills/canvas-mode/driver.mjs ss /cards cards       # screenshot a route (the /showcase base is added)
node .claude/skills/canvas-mode/driver.mjs stop                  # stop a server `start` launched
```
