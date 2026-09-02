# Canvas primitive — cleanup TODO

Findings from an audit of every "canvas" surface in the repo.

**Context, so nobody re-does the wrong work:** there is only *one* camera.
`primitives/Canvas.svelte` owns pan/zoom and publishes `transform {tx,ty,tk}` via
`CANVAS_CTX`; every other surface (`MeshStudio`, `MeshCanvas`, `MeshMembrane`,
`SceneViewport`, `MeshRenderer`, breach's `BoardStage`) is a *layer inside it*,
not a parallel implementation. `mesh-studio/README.md:5` states this deliberately
and the code matches. **Do not consolidate components — the layering is sound.**

The only three real drawing surfaces in the repo are `mesh-studio/gl/context.ts:50`
(WebGL2), `mesh-studio/globe/TerritoryCaps.svelte:455` (2D isolines), and
`dev/svg-export.ts:78` (2D, PNG export). Everything else is SVG or transformed DOM.
`storyboard/StoryboardCanvas.svelte` shares only the word — fixed `SCALE = 0.38`,
no camera concept. Leave it alone.

What *is* worth fixing is the primitive itself. All of the below trace back to one
gap: **`Canvas.svelte` exports the inverse transform but not the forward one, and
its inverse omits `getBoundingClientRect()`.**

---

## 1. Fix `screenToCanvas` — missing element rect · **bug, do this first**

`primitives/Canvas.svelte:36`

```js
function screenToCanvas(sx, sy) {
    return { x: (sx - transform.tx) / transform.tk, y: (sy - transform.ty) / transform.tk };
}
```

It takes raw `clientX/clientY` but never subtracts the root's rect — unlike
`Canvas.svelte`'s own wheel handler at `:108`, which does.

**This is live breakage, not just untidiness.** `screenToCanvas` feeds
`selectionHandler` (`Canvas.svelte:72` and `:86`), which is `SelectionBox`.
`SelectionBox.svelte:43-46` renders back with `x * tk + tx` into an `inset: 0`
overlay, so:

- the rubber band is offset from the cursor by the canvas's page position ÷ zoom
- `SelectionBox.svelte:26-31` hit-tests nodes against the wrong world rect

Only `routes/canvas/+page.svelte:122` mounts `SelectionBox`, which is likely why
this has gone unnoticed.

**Do:** subtract `getRoot()?.getBoundingClientRect()` inside `screenToCanvas`
(the context already exposes `getRoot`, `canvas-camera.ts:65`). Prefer fixing in
place over adding a second helper — every current caller wants the rect-relative
answer.

**Verify:** drag-select on `/canvas` with the page scrolled and the nav offset in
play; band should track the cursor exactly. Add a Vitest case that mounts
`Canvas` inside an offset container and asserts `screenToCanvas` output.

---

## 2. Collapse the three hand-rolled screen→world inverses

Once (1) lands, these all become one call. Each subtracts the rect itself
*because* the shared helper doesn't:

| File | Lines |
|---|---|
| `scene/SceneViewport.svelte` | `71-75` (drop point — comment at `:64-66` names the duplication outright) |
| `mesh-studio/MeshStudio.svelte` | `153-158` (`toCanvas`, also used at `:675`) |
| `primitives/CompositorLayer.svelte` | `164-167` (`handleDrop`) |

Same formula three times, differing only in which element supplies the rect
(`vpEl` / `svgEl` / `getRoot()`). Whatever the fixed helper's signature is, it
needs to let a caller name the element — `MeshStudio` measures its own SVG, not
the Canvas root.

Delete the now-stale comment at `SceneViewport.svelte:64-66` when you do.

---

## 3. Add `camera.framingRadius()` — kill the inverted `_fitBox`

`examples/breach/FirstPerson.svelte:323-330` recovers the framing radius by
algebraically inverting `CanvasCameraImpl._fitBox`:

```js
const availW = Math.max(1, box.w - (insets?.left ?? 0) - (insets?.right ?? 0) - 16);
const availH = Math.max(1, box.h - (insets?.top ?? 0) - (insets?.bottom ?? 0) - 16);
return Math.min(availW, availH) / (2 * k);
```

against `canvas-camera.ts:371-375`. The `- 16` is a hardcoded `padding: 8 * 2`,
matching the `padding: 8` that `frameOnPoint` passes at `FirstPerson.svelte:340`.
The comment at `:317-321` admits the coupling.

**Risk:** change the padding default in `_fitBox` and the breach POV shot silently
mis-frames — no test fails, nothing throws, the shot just pops.

**Do:** expose `framingRadius(): number` on the `CanvasCamera` interface
(`canvas-camera.ts:22-51`), reading the camera's real scale and insets, and
replace `framingNow()` with it.

---

## 4. `worldToScreen` on the context · *optional, lowest value*

`canvas-camera.ts:59-69` has no forward helper, so `scene/SceneStage.svelte:70-72`
writes its own:

```js
function screen(p) {
    return { x: p.x * transform.tk + transform.tx, y: p.y * transform.tk + transform.ty };
}
```

Worth knowing before acting: this has **exactly one caller**. `CompositorLayer`
solves the same problem a different way — a single wrapper div with
`transform: translate(...) scale(...)` (`:199-201`) — rather than positioning each
item. So this is one genuine use, not a duplication. Add the helper only if a
second per-item positioning layer shows up.

---

## Explicitly NOT worth changing

- **Drag-delta math** in `SceneStage.svelte:90-94` vs `Canvas.svelte:90-91` vs
  `MeshCanvas.svelte:692-693`. Looks like three copies of "origin + client delta";
  it isn't. A pure delta needs no rect and no origin, and the three divide by
  different things (scale / nothing / `globeSensitivity`) because they're three
  different gestures. Rationale already written at `SceneStage.svelte:75-76`.
- **Wheel-zoom** in `Canvas.svelte:103-115` vs `chart/Chart.svelte:200-214`.
  Chart zooms a d3-style *domain* via `scale.invert`, not a transform matrix.
  Parallel, not duplicated.
- **`MeshCanvas.svelte:1569-1581`** duplicating MeshStudio's colour precedence for
  `GlobePieces.styleOf` — deliberate, reason stated inline at `:1571-1573`.
- **The globe projection** in `MeshCanvas.svelte:429-556`. Genuinely mesh-studio's
  own coordinate stage on top of `physics/sphere.ts`, not a competing camera.

---

## Order

1 → 2 → 3. Item 1 is the only one with user-visible breakage; item 2 is nearly
free once 1 is done; item 3 is a latent trap with no failing test to catch it.
Item 4 can wait for a second caller.

Run `npm run check` and `npm run test` after each.
