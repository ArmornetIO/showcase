# physics

> NOTE: This is a work in progress. This should be considered unstable and not ready for production at this time. 

Layout geometry for canvas meshes. Pure functions over circular bodies — no Svelte, no DOM, no dependencies, and **no knowledge of what a body stands for**.

That last part is the boundary the module is built around. Nothing in here imports `StudioNode` or knows what a caption, an agent, or a mode is. Callers adapt their own shapes into a `Body` (a centre, a radius, an inverse mass) and read positions back. `mesh-studio/layout/mesh-metrics.ts` is the adapter that does that for the mesh — it's what translates "a fanned-out DNS Proxy with a caption below it" into "a circle of radius 146".

Keeping the boundary structural rather than conventional is the point: a solver that *can* reach for `StudioNode` eventually will, and then it stops being unit-testable without building a node fixture.

## Modules

| Module | Kind | What it does |
|---|---|---|
| `ring.ts` | closed form + bisection | One ring around a hub. Every body gets its own bearing. |
| `sunflower.ts` | closed form + bisection | Phyllotactic spiral. Fills an annulus, or a wedge of one. |
| `cluster.ts` | composition | Groups on a spiral, members ringed inside each group. |
| `sphere.ts` | closed form | Fibonacci sphere — evenly sown or carved into territories — plus spin, perspective projection, and the local frame a solid stands in. |
| `terrain.ts` | closed form | Elevation over the sphere. Summed plane waves, cut to the territories, shaped per biome, and cut into contours. |
| `solver.ts` | iterative | Separation, lane clearance, pinning, inward packing. |

The seeds are all deterministic and **feasible by construction** — same input, same output, no iteration count to tune, no way to fail to converge. The solver is the only iterative thing here, and it exists to *improve* a valid layout, never to untangle a pile.

## Choosing a layout

```
Does every body need a clear line back to the hub?
├─ yes → packRing.        A ring IS that constraint. Nothing beats it. (see below)
└─ no  → how should it read?
         ├─ dense          → packSunflower
         ├─ grouped        → packClusters
         ├─ flowing one way → packSunflower({ spread: 120, startAngle: 0 })
         └─ explorable     → packSphere + spin/project
```

## Findings

These are measured, not asserted. Every number below came from running the code; several of them overturned what the author expected, and they're recorded here so the next person doesn't rebuild the same dead ends.

### Lanes force a ring. That's not a bug, it's the geometry.

A `Lane` says no body may sit on the line between two others — it's what keeps hub links traceable. But holding *every* link clear means every body needs its own bearing off the hub, and that **is** a ring. Cost of lanes, by mesh size (68.6px bodies, 58px hub, footprint radius):

```
  n |  ring | lanes on | no lanes | lane cost
 12 |   300 |      300 |      300 |       +0%
 20 |   496 |      407 |      401 |       +2%
 30 |   742 |      596 |      460 |      +29%
 50 |  1236 |      907 |      619 |      +46%
```

Free below ~20. About **46% more radius — roughly double the area — by 50.** So lanes are a small-mesh luxury, and past a threshold it's worth letting links run under bodies. Each body's own link still surfaces at its rim.

**Narrowing lanes doesn't help.** Clearance 14 → 6 moved n=50 from 907 to 896. It's the *existence* of the constraint that costs, not its width — so a soft decay buys nothing and the on/off threshold is the correct shape.

### The golden angle gives distinct bearings, not *sufficient* ones.

Tempting theory: phyllotaxis hands every body its own bearing, so lanes should be nearly free. Measured, it's false. At n=50 the minimum gap between neighbouring bearings is a fraction of a degree — about 6px of clearance at r=600, where a body needs 83. Lanes tear the spiral apart and push it back out into (essentially) a ring:

```
  n | sun seed | sun + solve, lanes on | sun + solve, no lanes
 30 |      535 |                   599 |                   455
 50 |      680 |                   885 |                   609
```

Note n=50: with lanes on the solver makes the sunflower **worse than its own seed** (680 → 885). With lanes on, seed choice barely matters — everything converges to a ring. With lanes off, the sunflower wins by ~33%.

### Attraction cannot cluster. Don't try.

The obvious way to group same-kind bodies is to give them a mutual attraction and let the solver clump them. It does not work, and the reason rules out the whole family of fixes:

**Relaxation is local.** Getting two same-group bodies adjacent, when three others sit between them, requires a *permutation* — and every intermediate state overlaps, which is exactly what separation forbids. Attraction pulls until the bodies in the way balance it, then stops.

Measured on a real 12-node mesh, mean same-group distance was **430 at attraction 0, 0.6, and 1.2** — identical to the digit, where touching would be 155.

So grouping is decided where it *can* be: at the seed, by choosing which body takes which position (`packClusters`). `SolveOpts.cohesion` still exists — it's real and tested — but it's a nudge for holding a clump together, never a way to form one.

### Brute force is the right broadphase here.

`relax` is O(n²) over pairs, deliberately. At tens of bodies a spatial hash costs more to rebuild each pass than the pair loop saves. Revisit above ~200 bodies, where the crossover actually is.

## The solver

`packInward` is a **positional** solver, not a simulation. No velocity, no mass, no timestep, no gravity. Each pass nudges bodies toward where they want to be, then *projects* them back onto the constraints.

Why projection rather than forces — this is the load-bearing choice:

- **Force-directed** repulsion falls off with distance and settles wherever it balances the attraction. Bodies come to rest at a gap that depends on the tuning rather than on their size. It structurally cannot deliver "as close as possible without overlapping".
- **Sequential impulses** (Box2D-style) solve *velocity* constraints — they exist for momentum, restitution, and stacking under gravity. There is none of that here.
- **Projection** has no equilibrium to find. It removes exactly the overlap that exists and nothing more, so bodies settle at true contact: `r₁ + r₂ + margin`, less a slop term that stops them trading sub-pixel corrections forever.

### The pull is a density optimiser — most layouts don't want it

`packInward`'s inward pull compresses a layout toward the centre. Only ask for it when density is the goal. **For every other seed, the seed *is* the arrangement, and pulling on it destroys the thing it was chosen for** — it collapses a ring into shells, squashes a fan's wedge flat, and drags clusters into each other. Pass `pull: 0` to run separation only:

```ts
packInward(bodies, lanes, { center, margin: 18, ...(dense ? {} : { pull: 0 }) });
```

The stride adapts to how far bodies actually sit from the centre. A stride fixed in pixels silently caps how far a packing can travel — on a large mesh the bodies run out of steps before they reach anything to collide with, and the result *looks* like the constraints are binding when they aren't. (This was a real bug: it made lanes look free when they cost 46%.)

## The globe

`sphere.ts` inverts the usual arrangement: **the sphere is the state, and x/y is only ever a projection of it.** A body owns a unit direction; `spin(dir, yaw, pitch) → project()` recomputes its screen position every frame. That's also why bodies can't be dragged on a globe — there's nowhere a drag could put one that the next spin wouldn't overwrite.

The radius is closed form. Distance scales linearly with it, so the tightest sphere that fits is just

```
R = max over pairs of (rᵢ + rⱼ + margin) / |uᵢ − uⱼ|
```

A globe is deliberately **not** collision-free once projected — bodies bunch at the limb and hide each other at the back. That's what a globe looks like. Resolving those overlaps in 2D would flatten it into a map. `project` returns `depth` and `scale` so the renderer can say so instead.

Rendering it (see `mesh-studio/GlobeFrame.svelte` and the `mesh-globe` mockup):

- **Sort by depth.** MeshStudio paints in array order and its `{#each}` is keyed, so sorting the array reorders the DOM. That's the entire hidden-surface pass — no z-buffer.
- **Perspective, not orthographic.** The near/far size difference is most of what reads as round; flat scaling looks like a disc of dots.
- **Fade and blur the far side.** Nothing drawn *behind* the bodies can occlude them — the bodies are the thing needing occlusion. `opacity` says faint; `blur` says "not on your focal plane"; together they read as distance. A backdrop only stops the canvas grid at the globe's edge, which is worth doing but is not the same job.
- **Put the hub at the centre**, not on the shell. Links become true 3D spokes, and its depth of 0 automatically splits near from far.

### Territories

`packSphereClusters` divides the globe into regions — one spherical cap per group — instead of sowing bodies evenly. Same closed-form radius; **only the direction generator changes.** That is the whole trick: grouping cannot be reached by relaxation, because getting same-group bodies adjacent needs a *permutation* of positions and every intermediate state of a swap overlaps (`cluster.ts` records the same finding in 2D). So grouping is decided at the seed.

- **Caps are sized by population**, not evenly — a cap of half-angle α covers 2π(1−cos α) of 4π, so area ∝ member count keeps density equal across regions.
- **The border is the point.** `fraction` is the share of the sphere the regions may occupy between them; the remainder is empty surface no body may use, and it is the only reason a region reads as a region rather than as a crowd. Callers packing N regions should also cap α below π/N, or neighbours smear together at the limb (`MeshCanvas` derives that ceiling for you).
- **Centres ring the equator** because `spin` yaws about Y: the regions become a carousel, and `capRingYaw(k)` is the closed-form yaw that turns region k to face the viewer — no solving needed to say "now look at this one".
- **A grouped globe is bigger** than an even one at the same node size. That is not a bug to tune away; it is the borders being paid for.
- `capField` fills a cap with anonymous dust. It stays out of the radius solve deliberately — those bodies carry no footprint, and 600² pairs on every re-derive would cost more than the whole scene.

Rendered by `mesh-studio/TerritoryCaps.svelte` (tint + name) via `MeshCanvas`'s `globeTerritories`; see the `mesh-territories` mockup.

## Ground

`terrain.ts` is an elevation field over the sphere: hand it a direction, get a height. Everything that needs ground — the globe's wireframe, a node's altitude, the patch a building is buried in — asks the same field, which is the only reason they agree.

It is a **sum of plane waves**, not grid noise, and on a sphere that is the easier choice rather than the clever one. A wave is a direction and a frequency, and a sphere has those everywhere; Perlin and friends need a lattice or a lat/long grid, which brings a seam at the date line and a pinch at the poles. Summed sinusoids are also smooth by construction and closed form — same seed, same world, nothing cached. The cost is that it cannot make cliffs. That is a real limit and also exactly what is wanted under a mesh.

`maskTerrain` cuts the field to the territory caps: rolling ground inside a region, **exactly zero outside**, with a smoothstep shore. The remainder is not sea and is not drawn — it is absence, the same absence the border between regions already meant. Masked height runs 0..1 rather than −1..1, so land is always above the surface it is cut from; a region whose middle dipped below would have a hole in its own floor, and with nothing beneath it that hole shows through the globe.

### Biomes are a transform of the field, not a tint

`shapeTerrain` reshapes a field into one of four characters — `rolling`, `terraced` (quantise → plateaus and cliffs), `ridged` (fold about zero → the creases summed smooth waves otherwise cannot make), `scattered` (cube → isolated peaks over empty ground). One pointwise line each, applied **before** masking so the shore still takes every region down to the surface at its rim.

The reason it lives in the field rather than in the palette: four regions sharing one elevation field are the same landscape four times, and colour is the channel a viewer reads *last* when the shapes underneath are identical. Reshaping the field changes where the contours fall, and contour **spacing** is what the eye actually reads as terrain — so the distinction survives the whole globe being drawn in one hue.

### Contours: draw ALONG the slope, not across it

`contours` cuts a field into isolines over one cap — marching squares on the cap's own polar lattice, saddles resolved by the cell centre, every 5th line flagged as an index contour. Closed form, no tracing pass.

This replaces a polar web of rings and spokes displaced by height. The difference is not decorative. A line drawn *across* a slope carries elevation only as a few pixels of wobble you cannot read; a line drawn *along* one is the gradient, and its loops are the peaks. Two consequences worth knowing before tuning it:

- **It is not cheaper at equal interval.** Measured on the four-territory overview: 2,524 segments against the web's 2,816. Essentially a tie, and the opposite of what was assumed going in. What you gain is a *knob* — interval 0.16 halves the ink to 1,448 and still reads as terrain, where the web costs 2,816 regardless.
- **Coverage is uneven, and that is the point.** Contours touch 30–40% of a gentle region's cells and 71% of a ridged one's. The web touches 100% by construction, so it spends the same ink on a plain as on a mountain range.

It also settles a disagreement the renderer had with itself: `mesh-studio/NodePiece` cuts contour bands across the *buildings* at constant height and its comment calls them "the SAME thing the territory floor draws on the ground." They were not. Once the ground draws isolines at the same interval they are, and a building wearing contours reads as the ground continuing up over it rather than an object parked on top.

### Three numbers that all have to be right together

Each of these made the terrain invisible on its own, and none of them looks wrong in isolation:

- **Frequency is set against a TERRITORY, not the globe.** A region is ~70° across, so a wave crossing the whole sphere three times gives one region less than a single bump — a dome, which reads as nothing. It took ~9 before a region had hills of its own.
- **Relief is measured against the SCREEN.** 2% of a ~800px radius is 18px of height under a region 500px wide. Invisible. ~5.5% is where a contour web visibly climbs.
- **A web coarser than the grid behind it reads as more grid.** Contours only become ground once they are closer together than the globe's own parallels.

### The grid must ride the same field

Cutting the ground to the caps is not enough on its own: with the terrain on the territories and the globe's wireframe left on the true sphere, there are **two surfaces** — a wireframe landscape hovering with the sphere's own lines showing through from underneath. Nothing looks joined because nothing is; the nodes stand on one and the globe is the other.

A masked field makes the fix free. It is zero everywhere there is no land, so handing the same field to `GlobeFrame` leaves the grid on the sphere outside the regions and lifts it only inside them. One continuous surface, and the shore is where it meets itself.

## Standing on the surface

Placement answers *where*; a body that is a SOLID also needs *which way is up, here*. `tangentFrame` returns that: east and north along the surface, up off it, each as a screen displacement and as a unit world direction. Positions come from the first, orientation (culling, shading) from the second — they are scaled differently and must not be mixed.

Two findings worth keeping:

**An affine frame has no perspective in it.** The top of a solid would project exactly as wide as its base. That is wrong everywhere and worst at the sub-viewer point, where a piece is seen from directly overhead: `u` collapses to nothing and the ratio `grow` is the only thing left saying the roof is nearer than the floor.

**The radial frame has a degenerate point, and the fix must be constant.** A solid at the centre of the visible disc stands straight at the camera — geometrically correct and useless, since a house and a factory have the same roof from above. `lean` tips the frame back in CAMERA space, and that choice is the whole point: a lean that varied with position — strong at the centre, absent at the limb — is a rotation that changes as the globe turns, so every piece would visibly stand up and lie back as it swept past. A constant camera-space offset adds no motion at all. Note that "constant" means one fixed rotation, **not** that every piece tips by the same visible angle: a piece whose up already lies along the rotation axis barely moves, which is correct, because it is at the limb and already seen side-on.

`projectPoint` is `project` in other coordinates — any point near the globe is some direction at some distance — and it is what lets callers build in ordinary 3D around the sphere instead of expressing everything as a direction plus a lift.

## Testing

132 tests across the module. They pin properties rather than outputs — "nothing overlaps at any mesh size", "a pinned body never moves", "the solver settles", "same input, same output" — so the internals can change without rewriting the suite.

Two things worth keeping:

**Determinism is tested, including from a degenerate seed.** Coincident bodies separate along an index-derived bearing, never a random one, so a layout never reshuffles between runs and snapshots stay stable.

**Assert the property, not the algorithm echoed back.** The lane tests re-derive point-to-segment distance independently rather than calling the solver's own helper. A test that reuses the implementation only proves it's self-consistent.

**State the property carefully enough that it is still true.** Two terrain/frame tests were written asserting something plausible and slightly wrong — that a lift is worth its own factor everywhere (it is worth more toward the viewer, which is the entire point of it), and that a camera-space lean tips every piece by the same visible angle (it does not, and should not). Both failures were the test, not the code. A property test is only worth having if the property is the one the design actually promises.

```sh
npx vitest run src/lib/physics
```
