# mesh-studio

The interactive mesh canvas: an editable graph of agents around a control-plane hub. Drag nodes, draw links from any port, fan a multi-mode agent out into satellites, spin the whole thing on a globe.

`MeshStudio.svelte` is a **layer inside a shared `<Canvas>`**, not a standalone widget. Canvas owns pan/zoom and publishes the transform; layers read it and draw into the same world coordinates. That's what lets `GlobeFrame` sit under `MeshStudio` and stay registered to it — they're siblings reading one camera, not a component wrapping another.

## Files

| File                             | Role                                                                    |
| -------------------------------- | ----------------------------------------------------------------------- |
| `MeshStudio.svelte`              | The layer: nodes, edges, ports, drag, link-draw, chips                  |
| `studio.types.ts`                | `StudioNode` / `StudioEdge` — the mesh's domain vocabulary              |
| `node-shapes.ts`                 | Parametric silhouettes + boundary ray-casting                           |
| `modes.gen.ts`                   | **Generated** from `agent/modes.yaml` — do not edit by hand             |
| **`canvas/`**                    |                                                                         |
| `canvas/MeshCanvas.svelte`       | The globe assembly — layout, globe layers and studio together           |
| **`membrane/`**                  |                                                                         |
| `membrane/MeshMembrane.svelte`   | Ambient world→membrane→core frontier scene over `MeshStudio`            |
| **`layout/`**                    |                                                                         |
| `layout/mesh-metrics.ts`         | **How big a node is** — the single source, shared with layout           |
| `layout/mesh-layout.ts`          | Layout solvers, over `physics/` packers                                 |
| `layout/mesh-tuning.ts`          | Live tuning knobs (`DEFAULT_TUNING`)                                    |
| `layout/chip-placement.ts`       | Caption/chip placement around nodes                                     |
| `layout/MeshViewControls.svelte` | Layout picker + view toggles                                            |
| **`globe/`**                     |                                                                         |
| `globe/GlobeFrame.svelte`        | Wireframe sphere layer, drawn behind MeshStudio                         |
| `globe/GlobePieces.svelte`       | WebGL instanced solids on the sphere                                    |
| `globe/TerritoryCaps.svelte`     | Terrain caps / territory shading                                        |
| `globe/GlobeDevControls.svelte`  | Dev-only orbit and globe controls                                       |
| **`pieces/`**                    |                                                                         |
| `pieces/pieces.ts`               | Solid primitives (`box`, `gable`, `tooth`) + the two original buildings |
| `pieces/pieces-works.ts`         | Eight buildings — infrastructure and defence                            |
| `pieces/pieces-civic.ts`         | Seven buildings — cognition and signal                                  |
| `pieces/piece-catalogue.ts`      | **Which mode stands in which building.** Merges the three above         |
| `pieces/piece-facets.ts`         | Facet projection for a solid                                            |
| `pieces/piece-mesh.ts`           | Piece → GL mesh buffers                                                 |
| `pieces/NodePiece.svelte`        | Draws a solid through a node's tangent frame                            |

Mode glyphs and labels live in `icons/mode-tool-icons.ts`, not here — they are
icon content shared beyond the mesh.

## The settlement — why every mode has a building

`pieces/piece-catalogue.ts` maps all 17 agent modes onto 17 distinct solids, and
`pieces/piece-catalogue.spec.ts` fails if a mode arrives without one.

That totality is load-bearing, not tidiness. The globe cannot afford to spend
**hue** on identity — seventeen mode colours plus four territory colours leave
nothing to say _"this one is broken"_, which is why failure had to be drawn as an
opaque badge pasted over the scene. Silhouette is the only other channel that
carries identity at 40px, from any bearing, under one colour. So the buildings
are what identity moves **onto** when colour moves off; a mode with no building
falls back to a disc, and a disc says nothing once the palette collapses.

Review them the way they were authored: all 17 on one turntable, with a size
slider (they are drawn at ~40px in the real thing, and everything looks good at 200) and a squint blur. Two buildings that converge under it are the same
building however different the geometry. That harness lived as a local mockup
under `routes/mockups/` — worth rebuilding there before you add to the
catalogue, since the squint test is the whole review.

Each catalogue was authored as an internally consistent **set** — shared plinth,
battered masses, never-flush stacking, exactly one break through the top
silhouette. Keep that grammar when adding to one; it is what makes seventeen
separate shapes read as one civilisation.

## mesh-metrics — read this before laying anything out

A node is drawn as a disc and then has chrome hung off it: connection rings outside the rim, a caption stack below, a satellite ring when a multi-mode agent fans out. **The disc is the smallest of those.** What a node _occupies_ is the envelope around all of it — a fanned-out agent wants ~146px where a leaf wants ~69px, more than double.

Layout needs that envelope to place nodes without overlapping, and the renderer needs it to draw them. When each side computes its own, they drift, and nodes overlap in exactly the cases the two disagree about. **That is a real bug this module exists to prevent** — the mesh once shipped a layout that gave every node an identical slot regardless of size, and fanned-out agents overlapped their neighbours by ~97px.

```ts
import { packingR } from "showcase";

const radii = nodes.map((n) =>
  packingR(n, {
    radiusScale: tuning.radiusScale,
    connCount: linksOf(n),
    showArcs: tuning.connArcs,
  }),
);
```

- `nodeR` — the bare disc.
- `silhouetteR` — disc + rings + satellites. What it _draws_.
- `packingR` — the above, widened by the caption. **What a layout must reserve.**

Captions are deliberately excluded from `silhouetteR`: they hang in one direction, so folding them in would inflate every node in every direction at once.

## Laying out a mesh

Positions come from [`physics/`](../physics/README.md) — see that README for which arrangement to pick and why. The pattern is always **seed, then solve**:

```ts
const seed = packSunflower(radii, { margin: 18, hubR: 58, hubMargin: 40 });
const bodies = [
  { x: cx, y: cy, r: 58, invMass: 0 },
  ...seed.points.map(/* … */),
];
packInward(bodies, lanes, { center: { x: cx, y: cy }, margin: 18 });
```

The hub is `invMass: 0` — it anchors the mesh. A node the operator placed by hand should be too: **re-solving must never move a deliberate placement**, so pin it and let its neighbours absorb the correction.

## Node properties worth knowing

Most of `StudioNode` is data. Three are the caller telling the layer something it cannot work out for itself:

- **`inert`** — drawn, but the pointer passes through. For a node you can _see_ but shouldn't be able to _reach_. Visible and reachable are different properties, and depth isn't the only reason they might part company — hence a flag, not an inference.
- **`opacity`** — a fade, **multiplied** with the layer's own dimming (flow steps, selection), never replacing it. A node that is both irrelevant _and_ distant should read as both.
- **`blur`** — world px, so it scales with zoom. Depth of field. Dropped on low perf tiers; it's the most expensive thing here and the first worth losing.

Together those three are what make the globe's far side read as behind a surface. Nothing drawn _behind_ the nodes can do that — the nodes are what needs occluding.

## Gotchas

**Paint order is array order.** `{#each nodes}` is keyed, so reordering `nodes` reorders the DOM. Sorting by depth is the whole of hidden-surface removal on the globe — there's no z-buffer and no per-node z-index to maintain.

**`chipPlacements` re-derives on every pointer move during a drag**, and it runs an O(E × 8 × 7) ladder search calling `nearestPort` over every port. It's the main perf landmine. Anything that writes node positions at frame rate should own plain arrays and commit once per frame, not write through `$state` per iteration.

**A caption always points down.** `y = outerR + 14` sits inside the node's transform, so `+y` is world-down regardless of where the node is. Nodes at the top of a mesh fire their captions _inward_, across it. Known, unfixed, and it matters more the denser the arrangement.

**`arcGeom`'s comment overpromises.** The `max(2.4, …)` floor outranks the band bound past ~10 links, so a heavily-linked node's halo keeps widening (20 links → radius 96.6 vs a 44 disc). Nothing overlaps — layout sizes from the real number — but such nodes push a mesh out hard.

## Testing

```sh
npx vitest run src/lib/mesh-studio
```
