<script module lang="ts">
  // Per-instance id source, so several globes on one page register distinctly.
  let GLOBE_SEQ = 0;
</script>

<script lang="ts">
  // ── MeshCanvas — the mesh canvas SHELL, factored out of any one page ──────────
  // A caller hands it LOGICAL nodes (id, label, icon, radius, ports…) and edges;
  // MeshCanvas owns everything VISUAL: it places the nodes for the chosen layout,
  // spins + projects the globe, preserves positions the operator dragged, and
  // drives the interactive <Canvas>/<MeshStudio>. The caller never touches x/y.
  //
  // One node is the HUB (`hubId`): the crest the mesh arranges around. It is the
  // fixed point of every planar layout and the centre of the globe — never placed,
  // never spun.
  import Canvas from "../../primitives/canvas/Canvas.svelte";
  import type { CanvasCamera } from "../../primitives/canvas/canvas-camera.js";
  import MeshStudio from "../MeshStudio.svelte";
  import type { StudioNode, StudioEdge } from "../studio.types.js";
  import type { ShapeConcept } from "../node-shapes.js";
  import GlobeFrame from "../globe/GlobeFrame.svelte";
  import Icon from "../../icons/Icon.svelte";
  import MeshLayoutPicker from "../layout/MeshLayoutPicker.svelte";
  import { solveMeshLayout, type MeshLayoutId } from "../layout/mesh-layout.js";
  import {
    packSphere,
    packSphereClusters,
    spin,
    project,
    tangentFrame,
    faceYawPitch,
    shortestAngle,
    type Cap,
    type TangentFrame,
    type Vec3,
  } from "../../physics/sphere.js";
  import {
    terrainLift,
    maskTerrain,
    type Terrain,
  } from "../../physics/terrain.js";
  import { PIECE_REACH } from "../layout/mesh-metrics.js";
  import TerritoryCaps, {
    type Territory,
    type TerritoryStyle,
  } from "../globe/TerritoryCaps.svelte";
  import GlobePieces from "../globe/GlobePieces.svelte";
  import {
    orbitIntroStart,
    playOrbitIntro,
    playCameraTo,
    cameraApproach,
    type OrbitIntroConfig,
    type CameraPose,
  } from "../../physics/orbit.js";
  import { registerGlobe } from "../../physics/globeRegistry.svelte.js";
  import { frameProbe } from "../../perf/frame-probe.js";
  import { DEFAULT_TUNING, type MeshTuning } from "../layout/mesh-tuning.js";
  import { meshInk } from "../../theme/palette.svelte.js";
  import { untrack } from "svelte";

  interface Props {
    /** Logical nodes INCLUDING the hub. Positions are ignored on entry — this
     *  component owns them. */
    nodes: StudioNode[];
    /** Edges are pure passthrough — bind them so a draft link the operator draws
     *  writes straight back to the caller's array (MeshStudio adds it there). */
    edges?: StudioEdge[];
    /** The arrangement. Bindable so the on-canvas arrangement control (see
     *  `layoutPicker`) can change it without a header sitting above the canvas. */
    layout: MeshLayoutId;
    /** Which node is the crest — the fixed centre of every layout. */
    hubId: string;
    selectedId?: string | null;
    /** The <Canvas> camera handle, exposed so the caller can fly to a node. */
    camera?: CanvasCamera;
    raisedEdgeIds?: string[];
    onSelect?: (id: string | null) => void;
    onLink?: (edge: StudioEdge) => void;
    onFacetSelect?: (nodeId: string, mode: string, index: number) => void;
    /** MeshStudio passthroughs. */
    concept?: ShapeConcept;
    edgeCurve?: "line" | "bezier" | "bow";
    /** Default footprint radius for a node that declares none. */
    nodeR?: number;
    /** Placement clearances (px). */
    margin?: number;
    hubMargin?: number;
    groupMargin?: number;
    fanSpread?: number;
    /** Radial only — hold each hub→spoke line clear, up to this many spokes. */
    laneClearance?: number;
    maxLaneNodes?: number;
    /** Grouping key per node for the 'grouped' layout (defaults to one group). */
    groupKeyOf?: (n: StudioNode) => string | number;
    /**
     * A node's FOOTPRINT radius for placement — the room it actually occupies once
     * connection rings, captions and fanned facets are counted, which can exceed
     * the drawn disc radius (`r`). Defaults to `r`; a caller that draws rings around
     * nodes should pass the larger footprint so they don't overlap.
     */
    radiusOf?: (n: StudioNode) => number;
    /** Globe tuning. */
    globeSensitivity?: number;
    globeMaxPitch?: number;
    globeBackFade?: number;
    globeBackBlur?: number;
    /** How much a node dims between the point nearest the eye and the limb, on
     *  the side you can see. Small on purpose — this is atmosphere, and the
     *  moment it is strong enough to notice as an effect it is reading as a
     *  vignette instead of as distance. */
    globeFrontFade?: number;
    /** Show the on-canvas globe controls (spin / reset / auto-rotate / zoom),
     *  bottom-right. Only rendered in the 'globe' layout. */
    globeControls?: boolean;
    /** Show the arrangement picker in the same on-canvas control cluster. Unlike
     *  the globe rows it renders in EVERY layout — otherwise leaving 'globe'
     *  would take the only way back with it. */
    layoutPicker?: boolean;
    /** Radians the globe advances per auto-rotate frame. */
    autoRotateSpeed?: number;
    /** Whether the globe is auto-rotating. Bindable so the on-canvas toggle and a
     *  caller can share the state; pass `true` to start spinning by default. */
    autoRotate?: boolean;
    /** Radians the spin axis tips toward the viewer, giving a planet-like tilted
     *  spin instead of a flat upright turn. 0 keeps the axis vertical. */
    axialTilt?: number;
    /** Draw ringed leaf nodes with a smaller glyph and the label + value stacked
     *  inside the disc (passed through to MeshStudio). */
    insetLeafLabels?: boolean;
    /** Print the node's TYPE as an eyebrow above its name (passed through to
     *  MeshStudio). On a mesh of infrastructure the kind of node is half the
     *  story; on a mesh whose labels are already real names it is the same word
     *  stamped on everything. Defaults on, matching MeshStudio. */
    typeLabels?: boolean;
    /** Per-canvas overrides on the studio's draw knobs, merged over DEFAULT_TUNING.
     *  For a caller that has to change what the canvas DRAWS from its own controls
     *  — a mesh big enough that per-link rings or per-link labels stop being
     *  legible needs to turn them off from the page, not from the demo cog. */
    tuning?: Partial<MeshTuning>;
    /** Play the orbit fly-in once when the globe layout first appears. Off by
     *  default; the DevCog can always replay it regardless. */
    globeIntro?: boolean;
    /** Label for this globe in the DevCog's globe controls. */
    globeLabel?: string;
    /** How much bigger than a tight fit the globe reads. 1 fits it exactly; 1.2
     *  makes the sphere fill 20% more of the frame. Node discs are counter-scaled
     *  by the same factor, so they keep the size they had at the tight fit and the
     *  extra room goes into the space BETWEEN them. */
    globeFill?: number;
    /** Edges of the canvas that floating chrome (stat cards, tickers, controls)
     *  occupies. The globe is fitted to — and centred in — what is left, so a node
     *  is never placed underneath a panel. Pixels. */
    hudInsets?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    /** Selecting a node turns the globe until that node faces the viewer.
     *
     *  Off by default. An unrequested camera move is disorienting on a mesh
     *  where selection only means "show me the details" — it is the pairing with
     *  a drawer that turns it into navigation rather than the globe wandering. */
    focusOnSelect?: boolean;
    /** How long that turn takes, ms. Long enough to read as the globe rotating
     *  and not as a cut; short enough that it never feels like waiting. */
    focusDurationMs?: number;
    /** Radians the focused node is lifted ABOVE the middle of the disc, so a
     *  solid standing there is seen head-on instead of from directly overhead.
     *  0 centres it exactly — which is the worst view of a building there is. */
    focusTilt?: number;
    /** View distance, in globe radii, the camera closes to on focus. Lower is
     *  nearer. Below about 1.8 the perspective divide gets violent and the near
     *  limb starts to bow. */
    focusDistance?: number;
    /** How much room the jib leaves around the focused node, in multiples of its
     *  own radius. 1 crops to the node itself; larger keeps more of the ground it
     *  is standing on. Too tight and the subject loses the terrain that says
     *  where it is — the point is a building IN a landscape, not a portrait. */
    focusContext?: number;
    /** How many discrete zoom levels the flight passes through. Fewer means more
     *  consecutive frames share a scale and can reuse what was rasterised at it;
     *  the pan still updates every frame, which is what the eye tracks. */
    focusZoomSteps?: number;
    /** View distance, in globe radii, a flight to a TERRITORY closes to. Further
     *  out than `focusDistance` on purpose: the subject is a region several nodes
     *  across, and diving to node range crops the very grouping being shown. */
    territoryDistance?: number;
    /** How much room a territory flight leaves around the region, as a multiple of
     *  the cap's own projected radius. Above 1 keeps the borders either side of it
     *  in shot, which is what makes it read as one region among several. */
    territoryContext?: number;
    /** Draw the buildings with WebGL2 instead of SVG.
     *
     *  Opt-in while both renderers exist. The SVG path stays the fallback for a
     *  browser without WebGL2 — `GlobePieces` reports that itself and draws
     *  nothing, so the switch is also the A/B: same scene, same camera, one
     *  renderer swapped, measurable with the QA cog's frame capture. */
    glPieces?: boolean;
    /** Pack the globe into TERRITORIES — one region per `groupKeyOf` key — rather
     *  than sowing every node evenly over the sphere. Needs `groupKeyOf`; without
     *  one there are no groups to divide the surface into and it is ignored.
     *
     *  A grouped globe is necessarily BIGGER than an even one at the same node
     *  size: the empty borders between regions are surface that no node may use,
     *  and that space is the entire reason a region reads as a region. */
    globeTerritories?: boolean;
    /** How to NAME and tint a territory. Returning null leaves the region unnamed
     *  (still clustered — just not captioned). Only consulted when
     *  `globeTerritories` is on. */
    territoryOf?: (key: string) => TerritoryStyle | null;
    /** Share of the sphere the regions may occupy between them; the rest is the
     *  border. Passed straight to `packSphereClusters`. */
    territoryFraction?: number;
    /** Which territory the globe currently holds in focus — the one it tints.
     *  Reported OUT (bindable) so a caller listing the territories can light the
     *  same row the globe is lighting, whether the focus came from
     *  `flyToTerritory` or from clicking a node that happens to live there. */
    focusTerritory?: string | null;
    /** How far a territory wall stands off the sphere, in GLOBE RADII — so it
     *  keeps its proportion however big the sphere packs. 0 lays it flat back on
     *  the surface. Bindable, and driveable live from the QA cog. */
    territoryWallHeight?: number;
    /** How far a 3D node piece leans back toward the viewer, RADIANS.
     *
     *  0 stands every piece straight up out of the sphere, which is honest and
     *  unreadable: a piece at the centre of the visible disc is then seen from
     *  directly overhead, and a house and a factory have the same roof. The lean
     *  is constant in camera space — see `tangentFrame` for why it must be
     *  constant rather than strongest where it is most needed. */
    pieceLean?: number;
    /** Ground under the globe. Without one the sphere is perfectly smooth, and
     *  anything standing on it can only ever sit ON the surface — there is
     *  nothing to sit IN. With one, every node rides its own elevation and a
     *  piece is buried to its footings in the patch beneath it. */
    terrain?: Terrain;
    /** Half-range of the terrain's elevation, in globe radii. Small: this is
     *  ground for the mesh to stand on, not a landscape to look at. */
    relief?: number;
    /** How deep a piece sits in the ground, in node radii. Enough that the
     *  ground closes over its footings; more and the building sinks. */
    pieceSink?: number;
    /** Which globe you get, as ONE switch:
     *
     *   · 'relief' — ground, solids standing in it, walls standing up.
     *   · 'flat'   — a smooth sphere, disc nodes, walls lying on the surface.
     *
     *  One switch and not three, because the three are not independent: a
     *  building on a smooth sphere sits on nothing, and a wall standing up
     *  around flat markers is a fence around a diagram. Each set is coherent
     *  with itself, and the two are what a viewer would call two views.
     *
     *  It changes only how the globe is DRAWN. The pack, the camera and the
     *  territories are identical in both, so switching never moves a node. */
    globeSurface?: "relief" | "flat";
  }

  let {
    nodes,
    edges = $bindable([]),
    layout = $bindable("grouped"),
    hubId,
    selectedId = $bindable(null),
    camera = $bindable(),
    raisedEdgeIds = [],
    onSelect,
    onLink,
    onFacetSelect,
    concept = "instrument",
    edgeCurve = "bow",
    nodeR = 44,
    margin = 18,
    hubMargin = 40,
    groupMargin = 64,
    fanSpread = 120,
    laneClearance = 14,
    maxLaneNodes = 24,
    groupKeyOf,
    radiusOf,
    globeSensitivity = 0.008,
    globeMaxPitch = (80 * Math.PI) / 180,
    globeBackFade = 0.86,
    globeBackBlur = 2.4,
    globeFrontFade = 0.3,
    globeControls = false,
    layoutPicker = false,
    autoRotateSpeed = 0.004,
    autoRotate = $bindable(false),
    axialTilt = 0,
    insetLeafLabels = false,
    typeLabels = true,
    tuning,
    globeIntro = false,
    globeLabel = "Mesh",
    globeFill = 1,
    hudInsets,
    focusOnSelect = false,
    focusDurationMs = 1100,
    // ~34°, not ~17°. The tilt is how far the subject sits from the sub-viewer
    // point, and that distance IS the camera's eye height: at 0 you are directly
    // overhead looking at a roof, and toward π/2 you are level with the ground it
    // stands on. This far round, the near faces of a building are square to the
    // eye and its full height is in the silhouette — which is the view the shapes
    // were designed to be read at. Much past this and it foreshortens into the
    // limb instead.
    focusTilt = 0.6,
    focusDistance = 2.05,
    // Tight enough that the subject dominates, wide enough to keep the globe's
    // curve in shot. Crop to the node alone and the scene stops being a world —
    // a building on a flat green field, and the argument for a globe goes with it.
    focusContext = 6.5,
    focusZoomSteps = 14,
    territoryDistance = 2.35,
    territoryContext = 1.35,
    glPieces = false,
    globeTerritories = false,
    territoryOf,
    territoryFraction,
    focusTerritory = $bindable(null),
    territoryWallHeight = $bindable(0.06),
    pieceLean = $bindable((25 * Math.PI) / 180),
    terrain,
    // Measured against the SCREEN, not against the globe: at 2% of a ~800px
    // radius the hills are 18px under a region 500px across, which is a bulge
    // nobody can see. 5.5% is the point where the contour web visibly climbs.
    relief = $bindable(0.055),
    pieceSink = 0.2,
    globeSurface = $bindable("relief"),
  }: Props = $props();

  // What the surface mode actually costs each feature. Read these, never the raw
  // props, so 'flat' can never half-apply — a globe with no ground but solids
  // still standing on it is the exact incoherence the one switch exists to stop.
  const isRelief = $derived(globeSurface === "relief");
  const effRelief = $derived(isRelief ? relief : 0);
  const effWallHeight = $derived(isRelief ? territoryWallHeight : 0);

  // The ground, cut to the regions. Land is only where a territory is; between
  // them there is no floor, no contour and no elevation — not sea, absence. A
  // globe with no territories keeps the raw field, since there is nothing to cut
  // it to and every node is then standing on the same continent.
  const effTerrain = $derived.by(() => {
    if (!terrain) return undefined;
    if (!globeCaps?.size) return terrain;
    // Entries, not values: the biome for cap i has to come from the territory
    // that cap belongs to, so the key and the cap must stay paired.
    const entries = [...globeCaps.entries()];
    return maskTerrain(
      terrain,
      entries.map(([, cap]) => cap),
      0.22,
      entries.map(([key]) => territoryOf?.(key)?.biome ?? "rolling"),
    );
  });

  // Arrangement popover, opened from the on-canvas control cluster.
  let layoutOpen = $state(false);

  // Fallback centre when the hub has no remembered position yet.
  const CX = 540;
  const CY = 360;

  /** Clear angle left between two neighbouring territories, radians. The empty
   *  border is what makes a region read as a region rather than as a crowd. */
  const TERRITORY_BORDER = 0.14;

  // The placed copy MeshStudio renders and drags mutate. Kept separate from the
  // caller's logical `nodes` so a drag never fights a poll. Edges, by contrast,
  // bind straight through — they carry no geometry we own.
  let placed = $state<StudioNode[]>([]);
  // The layout the nodes on canvas were actually placed by — a mismatch means the
  // operator asked for a new arrangement, which re-places every node (even dragged
  // ones), rather than only the new arrivals.
  let placedLayout: MeshLayoutId | null = null;
  // Spoke count the globe was last fitted at. The globe refits the camera when it
  // (re)places, but only on a real change — entering globe, or the count moving —
  // never on every poll, so a manual zoom survives routine data refreshes.
  let lastGlobeFitCount = -1;
  let lastGlobeClustered = false;

  // ── Globe ─────────────────────────────────────────────────────────────────
  // Solves for DIRECTIONS on a sphere; canvas x/y is only ever a projection of
  // those, recomputed every spin. So the sphere is the state, the coordinates the
  // output — which is also why nodes can't be dragged in this mode.
  let meshYaw = $state(0);
  let meshPitch = $state(0);
  // Dolly distance in globe radii (see physics/sphere/project). Fixed while the
  // operator spins; the orbit intro animates it to fly the camera in and out.
  let meshViewDistance = $state(2.6);
  // The pose the globe rests at — the intro settles here, drag/reset return here.
  const GLOBE_REST: CameraPose = { yaw: 0, pitch: 0, viewDistance: 2.6 };
  // Non-reactive: read only inside the projection pass, which spin drives.
  let globeDirs = new Map<string, Vec3>();
  let globeBaseR = new Map<string, number>();
  // $state: the wireframe is drawn from it, so the template has to see it change.
  let globeRadius = $state(0);
  // The regions the last globe pack carved, or null when the globe is sown evenly.
  // $state for the same reason: TerritoryCaps is drawn from it.
  let globeCaps = $state<Map<string, Cap> | null>(null);
  // A region the camera was flown to, held so the tint survives having nothing
  // selected. Selection outranks it (see `focusedTerritory`) — a node is a more
  // specific answer to "what am I looking at" than the region it stands in.
  let territoryFocus = $state<string | null>(null);

  function hubNode(): StudioNode | undefined {
    return placed.find((n) => n.id === hubId);
  }

  /** How wide the ground patch under a piece is, in node radii. Wider than the
   *  widest footprint, so a piece is standing in a clearing rather than balanced
   *  on a plate exactly its own size. */
  const PATCH_R = 1.2;
  /** Samples round the patch. Twelve is smooth enough at node size and keeps the
   *  terrain lookups per piece in the dozens. */
  const PATCH_STEPS = 12;

  /** The ground immediately around a node, as screen offsets from the node
   *  itself, each flagged NEARER to the viewer than the node or not.
   *
   *  This is what a piece is buried in. The far side is drawn behind it and the
   *  near side in FRONT of it, so the ground closes over the building's footings
   *  — which is the whole difference between standing in the ground and being
   *  parked on top of it. Nothing else in the scene can do that job: the globe's
   *  own surface is drawn once, far behind every node.
   *
   *  Every sample is a real point on the terrain, spun and projected like any
   *  other, so the patch tilts with the local slope and foreshortens at the limb
   *  on its own. */
  function groundPatch(
    dir: Vec3,
    step: number,
    centre: { x: number; y: number; depth: number },
  ) {
    // A tangent basis at the UNSPUN direction — the terrain is globe-fixed, so
    // the ring has to be laid out in the globe's own frame and spun afterwards.
    let ex = dir.z;
    let ez = -dir.x;
    let len = Math.hypot(ex, ez) || 1;
    if (Math.hypot(dir.z, dir.x) < 1e-9) {
      ex = 1;
      ez = 0;
      len = 1;
    }
    const east = { x: ex / len, y: 0, z: ez / len };
    const north = {
      x: dir.y * east.z - dir.z * east.y,
      y: dir.z * east.x - dir.x * east.z,
      z: dir.x * east.y - dir.y * east.x,
    };
    const t = (PATCH_R * step) / globeRadius;
    return Array.from({ length: PATCH_STEPS }, (_, k) => {
      const a = (k / PATCH_STEPS) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const q = {
        x: dir.x + (east.x * c + north.x * s) * t,
        y: dir.y + (east.y * c + north.y * s) * t,
        z: dir.z + (east.z * c + north.z * s) * t,
      };
      const m = Math.hypot(q.x, q.y, q.z) || 1;
      const u = { x: q.x / m, y: q.y / m, z: q.z / m };
      const p = project(
        spin(u, meshYaw, meshPitch + axialTilt),
        globeRadius,
        meshViewDistance,
        terrainLift(effTerrain, u, effRelief),
      );
      return {
        x: p.x - centre.x,
        y: p.y - centre.y,
        near: p.depth > centre.depth,
      };
    });
  }

  /** Turn the sphere into canvas positions: spin each direction, project it, and
   *  paint back to front. */
  function applyGlobe() {
    if (layout !== "globe" || !globeDirs.size) return;
    const hub = hubNode();
    const cx = hub?.x ?? CX;
    const cy = hub?.y ?? CY;
    const depth = new Map<string, number>();
    for (const n of placed) {
      const dir = globeDirs.get(n.id);
      // The crest is the CENTRE of the globe, not a point on it — depth 0 puts the
      // far half behind it and the near half in front.
      if (!dir) {
        depth.set(n.id, 0);
        continue;
      }
      // axialTilt tips the whole spin axis toward the viewer: advancing yaw then
      // spins about that tilted axis (Earth's ~23° look) rather than upright.
      const spun = spin(dir, meshYaw, meshPitch + axialTilt);
      // The ground under this node. Sampled on the UNSPUN direction, because
      // the terrain belongs to the globe: spinning moves where a hill is drawn,
      // never how high it is.
      const ground = terrainLift(effTerrain, dir, effRelief);
      const p = project(spun, globeRadius, meshViewDistance, ground);
      // A node drawn as a SOLID needs to know which way is up where it stands.
      // Measured at the node's own unscaled radius, so the frame is exact at the
      // size the piece is actually built — and so piece geometry can be written
      // once in node radii rather than in pixels.
      //
      // Flat mode withholds the frame rather than stripping `piece` off the
      // node: the frame is what a piece needs to exist at all, so a node with
      // nowhere to stand falls back to its disc on its own. The caller's data
      // is never touched, so switching back needs nothing put right.
      if (n.piece && isRelief) {
        const step = globeBaseR.get(n.id) ?? nodeR;
        n.frame = tangentFrame(spun, globeRadius, {
          viewDistance: meshViewDistance,
          step,
          lean: pieceLean,
          lift: ground,
        });
        n.ground = groundPatch(dir, step, p);
        n.sink = pieceSink;
        // The colour of the land it is standing in, so its outline can leave
        // the ground as ground. Resolved here rather than by MeshStudio, which
        // knows nothing about territories.
        // Themed here rather than at the caller: a territory scheme states a
        // hue, and which STEP of that hue is legible depends on the ground the
        // globe is painted on. See palette.svelte.ts.
        n.groundColor = groupKeyOf
          ? (() => {
              const c = territoryOf?.(String(groupKeyOf(n)))?.color;
              return c ? meshInk(c) : undefined;
            })()
          : undefined;
      }
      n.x = cx + p.x;
      n.y = cy + p.y;
      // Perspective scale is most of what reads as roundness.
      n.r = (globeBaseR.get(n.id) ?? nodeR) * p.scale;
      // The far side is visible through the surface but not reachable — spin it
      // round to click it.
      n.inert = !p.front;
      // ── Depth is a gradient, not a switch ──────────────────────────────
      // The front hemisphere used to be a flat 1: every node from the closest
      // point to the horizon drawn at identical strength, with all the falloff
      // crammed into the half you can barely see. That is most of why a globe
      // full of markers reads FLAT — atmospheric perspective is the cue doing
      // the heavy lifting in every hologram shot worth copying, and there was
      // none of it in the half actually on screen.
      //
      // So the front fades gently toward the limb, and the back picks up from
      // exactly where the front left off rather than restarting at full
      // strength. Continuity at depth 0 is the point: a discontinuity there is
      // a visible seam right at the horizon, which is the one place the eye is
      // already looking for the sphere's edge.
      const rim = 1 - globeFrontFade;
      n.opacity = p.front
        ? 1 - (1 - p.depth) * globeFrontFade
        : rim * (1 + p.depth * globeBackFade);
      n.blur = p.front ? 0 : -p.depth * globeBackBlur;
      depth.set(n.id, p.depth);
    }
    // MeshStudio paints in array order with a keyed {#each}, so sorting by depth
    // IS the hidden-surface pass — no z-buffer to maintain.
    //
    // Reassigned only when the ORDER actually moved. Depth changes every frame
    // of a spin; the order it implies does not — two nodes have to cross for
    // that, which is rare. Handing the keyed each a new array regardless made
    // it reconcile the whole list 60×/s, and in DEV that is worse than it
    // sounds: Svelte starts capturing a full stack trace on every write to a
    // source it has already seen five times in one flush, so the reorder paid
    // for `new Error().stack` at `stackTraceLimit = Infinity` per node per
    // frame. That was a third of the frame budget on a globe nobody touched.
    const sorted = [...placed].sort((a, b) => depth.get(a.id)! - depth.get(b.id)!);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== placed[i]) {
        placed = sorted;
        break;
      }
    }
  }

  $effect(() => {
    void meshYaw;
    void meshPitch;
    void meshViewDistance;
    void axialTilt;
    untrack(applyGlobe);
  });

  // Centre + zoom the camera so the whole sphere fits. Node positions register with
  // the canvas a frame after we set `placed`, so wait for that before fitting.
  /** Re-fit after the chrome around the canvas moved.
   *
   *  What "fit" means depends on what the camera is currently looking at. Framing
   *  a subject, the right answer to a panel opening is to re-centre THAT SUBJECT
   *  in the space now left — not to abandon it and frame the sphere. Getting this
   *  wrong is subtle and looked like a different bug entirely: selecting a second
   *  node clears the first for one update, the drawer unmounts, the insets
   *  flicker, and this fires — so every hop between neighbours was quietly reset
   *  to a whole-globe fit before the flight had even started. */
  function scheduleRefit() {
    if (seized) return;
    // Aimed at the framed DIRECTION rather than at the selected node's canvas
    // position: a territory has no node to look up, and a direction re-projected
    // under the current pose is where the subject is on screen for both kinds.
    const dir = framedDir;
    if (isGlobe && dir && framedR != null) {
      const R = framedR;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!camera || globeRadius <= 0) return;
          const p = project(
            spin(dir, meshYaw, meshPitch + axialTilt),
            globeRadius,
            meshViewDistance,
            terrainLift(effTerrain, dir, effRelief),
          );
          const hub = hubNode();
          const nx = (hub?.x ?? CX) + p.x;
          const ny = (hub?.y ?? CY) + p.y;
          camera.fitRect(
            { minX: nx - R, minY: ny - R, maxX: nx + R, maxY: ny + R },
            { padding: hudInsets ? 8 : 40, insets: hudInsets, duration: 320 },
          );
        }),
      );
      return;
    }
    scheduleGlobeFit();
  }

  function scheduleGlobeFit() {
    // A seized camera is somebody else's. Re-fitting under it would land two
    // frames later as a shove from nowhere, which is exactly the failure the
    // handover exists to prevent — the release does the fit instead.
    if (seized) return;
    // Back to framing the sphere itself, so the next flight starts its zoom from
    // the whole globe again rather than from a subject that is no longer framed.
    framedR = null;
    framedDir = null;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const opts = {
          // Insets already carry their own clearance from the panels they
          // measure, so charging the default margin on top of them would
          // double-count it and shrink the globe for no reason.
          padding: hudInsets ? 8 : 56,
          fill: globeFill,
          insets: hudInsets,
        };
        // Fit the SPHERE, not the nodes on it.
        //
        // A globe's bodies crowd toward the limb and vanish round the back as it
        // turns, so their measured bounding box breathes constantly — and any
        // refit while it is turned an unusual way locks in whatever the box
        // happened to be at that instant. Turning to face a node is exactly such
        // a moment, which is how "fly to a node" ended up rescaling the globe.
        //
        // The silhouette does not depend on which contents face you. `limb` is
        // its closed form: under perspective you see slightly less than a
        // hemisphere, but it projects WIDER than the sphere's own radius, by
        // R·k/√(k²−1) for a camera k radii out. Same expression GlobeFrame draws
        // its edge with, so the fit and the drawn edge cannot disagree.
        const hub = hubNode();
        if (isGlobe && camera && globeRadius > 0) {
          const k = Math.max(1.2, meshViewDistance);
          const limb = (globeRadius * k) / Math.sqrt(k * k - 1);
          const gx = hub?.x ?? CX;
          const gy = hub?.y ?? CY;
          camera.fitRect(
            {
              minX: gx - limb,
              minY: gy - limb,
              maxX: gx + limb,
              maxY: gy + limb,
            },
            opts,
          );
        } else {
          camera?.fitAll(opts);
        }
      }),
    );
  }

  // The chrome is measured by the caller, so its insets land a frame or two after
  // the first fit — and change again on resize. Refit when they move, or the globe
  // would stay centred on whatever the HUD measured as at mount (zero).
  $effect(() => {
    void hudInsets?.top;
    void hudInsets?.right;
    void hudInsets?.bottom;
    void hudInsets?.left;
    if (layout === "globe") untrack(scheduleRefit);
  });

  // Drag spins the globe. Pan + node-drag are both off in this mode, so a drag is
  // unambiguous. $state because the cursor reads it (grab vs grabbing).
  let globeDrag = $state<{
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null>(null);
  function globeDown(e: PointerEvent) {
    if (layout !== "globe") return;
    stopGlobeIntro(); // grabbing takes over from the fly-in
    // …and from a flight to a node. A tween still writing yaw while the operator
    // drags is two hands on the globe, and the tween always wins because it
    // writes last — the drag would feel broken rather than overridden.
    stopFlyTo();
    globeDrag = { x: e.clientX, y: e.clientY, yaw: meshYaw, pitch: meshPitch };
  }
  function globeMove(e: PointerEvent) {
    if (!globeDrag) return;
    meshYaw = globeDrag.yaw + (e.clientX - globeDrag.x) * globeSensitivity;
    const p = globeDrag.pitch + (e.clientY - globeDrag.y) * globeSensitivity;
    meshPitch = Math.max(-globeMaxPitch, Math.min(globeMaxPitch, p));
  }
  // Never preventDefault: a drag that never moved is a click, and a click still
  // has to select the node under it.
  function globeUp() {
    globeDrag = null;
  }

  // ── Globe controls ──────────────────────────────────────────────────────────
  // Button-driven equivalents of the drag, plus auto-rotate. They only ever touch
  // yaw/pitch (the sphere's state); the projection $effect above redraws.
  // Radians per button press — a brisk but readable step (~17°).
  const SPIN_STEP = 0.3;
  const clampPitch = (p: number) =>
    Math.max(-globeMaxPitch, Math.min(globeMaxPitch, p));
  function spinGlobe(yawStep: number, pitchStep: number) {
    meshYaw += yawStep;
    meshPitch = clampPitch(meshPitch + pitchStep);
  }
  function resetGlobe() {
    stopGlobeIntro();
    stopFlyTo();
    // Home means "nothing in particular" — including no region.
    territoryFocus = null;
    meshYaw = 0;
    meshPitch = 0;
    meshViewDistance = GLOBE_REST.viewDistance;
    // Home restores the whole view — orientation AND a centred, fully-fitted zoom.
    scheduleGlobeFit();
  }

  // ── Fly to a node ───────────────────────────────────────────────────────────
  // Turn the globe until a chosen node faces the viewer. The pose is SOLVED, not
  // searched — `faceYawPitch` inverts the spin in two atan2s — so this is a tween
  // between two known poses and never a hunt for one.
  //
  // The axial tilt has to come back out. Everything on screen is drawn at
  // `meshPitch + axialTilt`, so the pitch that actually lands the node facing us
  // is the solved one minus the tilt; forgetting that leaves every flight short
  // by exactly the tilt, which looks like a sloppy easing rather than a bug.
  // A node id, or a territory key when the flight's subject is a whole region.
  // Only ever read for truthiness — "the camera is moving on its own".
  let flyingTo = $state<string | null>(null);
  let stopFly: (() => void) | null = null;
  /** The framing radius the camera is currently holding, in world px — null when
   *  it is framing the whole globe rather than a subject.
   *
   *  Remembered because the camera cannot be asked. Its transform is a scale, and
   *  recovering a radius from it means re-deriving the insets and padding that
   *  produced it, which is duplicating `_fitBox` badly. Recording what we last
   *  ASKED for is exact and costs a number. */
  let framedR: number | null = null;
  /** The globe-fixed direction the camera is currently framing — a node's, or a
   *  territory's centre. Kept so a re-fit (the HUD moved) can re-aim at the same
   *  subject under the current pose instead of abandoning it for the whole globe. */
  let framedDir: Vec3 | null = null;
  /** A deferred pull-back to the whole globe, pending because a cleared selection
   *  might be the middle of a hop rather than the end of one. */
  let pullBack: ReturnType<typeof setTimeout> | null = null;
  function stopFlyTo() {
    stopFly?.();
    stopFly = null;
    flyingTo = null;
  }

  /** Turn the globe to put `id` under the eye. No-op off the globe, or for a node
   *  with no direction (the crest sits at the centre and faces every way). */
  export function flyToNode(id: string, durationMs = 900) {
    const dir = globeDirs.get(id);
    if (layout !== "globe" || !dir) return;
    stopGlobeIntro();
    stopFlyTo();
    // `territoryFocus` is deliberately left alone. A selection already outranks it
    // for the tint, and keeping it is what lets closing the drawer return to the
    // region the operator drilled in FROM rather than all the way out to orbit.
    const want = faceYawPitch(dir);
    flyingTo = id;

    // ── One motion ─────────────────────────────────────────────────────────
    // Turning the world and moving the camera are driven from the SAME frame,
    // against the same clock, from one eased t. That is the difference between
    // a shot and a sequence of moves: two animation systems running back to
    // back always read as two events however carefully their durations are
    // matched, because each carries its own acceleration curve and the eye
    // reads acceleration, not position.
    //
    // It also makes the camera genuinely track a MOVING subject. The node is
    // sliding across the screen for the whole flight as the globe turns, so its
    // framing is recomputed every frame from the pose of that frame — a real
    // jib following the action, rather than a pan to where the action will
    // eventually stop.
    const to: CameraPose = {
      yaw: shortestAngle(meshYaw, want.yaw),
      // NOT the pose that centres the node — the pose that lets you SEE it.
      //
      // Dead centre is the sub-viewer point, where the node's local up-axis
      // projects to nothing and a building shows you its roof and nothing
      // else. `tangentFrame` says the same thing about its `lean`: from
      // directly above, a house and a factory are the same shape. So centring
      // the subject is precisely the one framing that destroys it.
      //
      // Adding to the pitch lifts the node ABOVE the middle of the disc (the
      // derivative of screen-y with respect to pitch is −1 there, so it is a
      // clean radians-to-offset trade). Its radial up then projects UPWARD on
      // screen, the near faces turn toward the eye, and the thing reads as a
      // building standing on a horizon rather than a plan view of a roof.
      //
      // Clamped like every other pitch the globe can hold: a node near a pole
      // would otherwise ask for a pose the operator can never drag back from.
      pitch: clampPitch(want.pitch - axialTilt + focusTilt),
      // Dolly in. Lower view distance is a genuinely nearer camera, not a
      // zoom: the perspective divide strengthens, so the near side opens out
      // and the far side falls away. That divergence is what reads as
      // approaching a sphere — scaling the canvas instead just makes a
      // picture of it bigger.
      viewDistance: focusDistance,
    };

    const tight = Math.max(1, (globeBaseR.get(id) ?? nodeR) * focusContext);
    // Hopping between subjects is a shorter move than arriving from orbit, and
    // pacing it the same makes it feel sluggish — the arrival's duration is
    // mostly buying the zoom, which a hop does not have to travel.
    flyAlong(dir, to, tight, framedR == null ? durationMs : durationMs * 0.7);
  }

  /**
   * Turn the globe to face a TERRITORY and frame the whole region.
   *
   * The same flight as `flyToNode` with a different subject: a cap rather than a
   * body. That difference is entirely in the two numbers handed to `flyAlong` —
   * where a node is framed to its own radius and dived on, a region is framed to
   * its angular extent and approached, because the thing being shown IS the
   * grouping and cropping inside it destroys the only fact it carries.
   *
   * No-op unless the globe is packed into territories and this key is one of them.
   */
  export function flyToTerritory(key: string, durationMs = 950) {
    const cap = globeCaps?.get(key);
    if (layout !== "globe" || !cap) return;
    stopGlobeIntro();
    stopFlyTo();
    // A caller that clears its selection on the way here leaves a pull-back armed;
    // letting it fire would restart this same flight 90ms in.
    if (pullBack) {
      clearTimeout(pullBack);
      pullBack = null;
    }
    // The tint follows the camera, not only the selection — a region flown to
    // with nothing selected still has to read as the region in focus.
    territoryFocus = key;
    const want = faceYawPitch(cap.center);
    flyingTo = key;
    const to: CameraPose = {
      yaw: shortestAngle(meshYaw, want.yaw),
      // Half the lift a node gets. A region needs its ground turned toward the
      // eye, but a cap several nodes across pushed as far up the disc as a
      // single building would run its far border off the top of the frame.
      pitch: clampPitch(want.pitch - axialTilt + focusTilt * 0.5),
      viewDistance: territoryDistance,
    };
    // The cap's own size, in world px: a half-angle α about the centre reaches
    // R·sin α across the sphere, which is what it projects to near the middle of
    // the disc. Framing to THAT (times the context) is why every region arrives
    // at a comparable size however many nodes it happens to hold.
    const tight = Math.max(
      1,
      globeRadius * Math.sin(cap.alpha) * territoryContext,
    );
    flyAlong(
      cap.center,
      to,
      tight,
      framedR == null ? durationMs : durationMs * 0.75,
    );
  }

  // ── Handing the camera over ─────────────────────────────────────────────────
  // Everything above is a MOVE this component owns: it decides the path, runs the
  // clock, and the caller gets to say only where and how long. That is right for
  // navigation and wrong for a scene, because a scene fuses the camera with things
  // this component has never heard of — a card resolving, an overlay opening, a
  // body being flown into. Two systems each running their own easing against their
  // own clock read as two moves no matter how carefully the durations are matched.
  //
  // So there is a second mode: the caller SEIZES the camera and writes a pose per
  // frame. While seized, every autonomous move here stands down — the auto-rotate,
  // the fly-to-on-select, and the re-fits — because a component quietly correcting
  // a camera somebody else is driving is the worst of the two worlds.
  //
  // Same three numbers, same projection. Nothing about the globe knows the
  // difference, which is the property that makes this safe to expose.
  let seized = $state(false);

  /** The pose right now — the starting point for any move a caller drives. */
  export function cameraPose(): CameraPose {
    return { yaw: meshYaw, pitch: meshPitch, viewDistance: meshViewDistance };
  }

  /** The pose that puts `id` under the eye, solved rather than searched.
   *
   *  The same solve `flyToNode` flies to, exposed as a VALUE so a caller can
   *  interpolate toward it on its own clock. Both defaults come from this
   *  component's focus props, so "face this node" means the same thing whichever
   *  route asks for it; pass `distance: SURFACE_DISTANCE` to stand on it. */
  export function poseFacing(
    id: string,
    opts?: { tilt?: number; distance?: number },
  ): CameraPose | null {
    const dir = globeDirs.get(id);
    if (layout !== "globe" || !dir) return null;
    const want = faceYawPitch(dir);
    return {
      yaw: shortestAngle(meshYaw, want.yaw),
      // The axial tilt comes back out for the same reason it does in `flyToNode`:
      // everything is drawn at `meshPitch + axialTilt`, so the pitch that lands
      // the node facing us is the solved one minus the tilt.
      pitch: clampPitch(want.pitch - axialTilt + (opts?.tilt ?? focusTilt)),
      viewDistance: opts?.distance ?? focusDistance,
    };
  }

  /** Where a globe body sits on the canvas under the CURRENT pose, in canvas
   *  coordinates — what `CanvasCamera.fitRect` wants, and what a DOM measurement
   *  of the drawn node cannot give you (that is in screen pixels, which the canvas
   *  transform has already scaled). `r` is its drawn radius, perspective included. */
  export function nodeScreen(
    id: string,
  ): { x: number; y: number; r: number } | null {
    const n = placed.find((p) => p.id === id);
    if (!n) return null;
    return { x: n.x, y: n.y, r: n.r ?? nodeR };
  }

  /** The globe's drawn radius in world px. A caller framing anything relative to
   *  the sphere needs it, and it is otherwise private to the projection pass. */
  export function globeSize(): number {
    return globeRadius;
  }

  /** Which way is UP where a node stands, and how far one step of its surface
   *  goes on screen.
   *
   *  The same frame the node's own piece is built in — so a caller drawing
   *  anything else on that plot (a figure standing next to the building, a
   *  marker planted in the ground) places it in the world rather than over a
   *  picture of the world. Undefined off the relief globe, where nothing has
   *  anywhere to stand. */
  export function nodeFrame(id: string): TangentFrame | undefined {
    return placed.find((p) => p.id === id)?.frame;
  }

  /** Take per-frame control. Returns the release, which hands the globe back and
   *  re-frames it — call it in a `finally`, or a cancelled scene leaves the camera
   *  seized and the globe permanently still. */
  export function seizeCamera(): () => void {
    stopGlobeIntro();
    stopFlyTo();
    if (pullBack) {
      clearTimeout(pullBack);
      pullBack = null;
    }
    seized = true;
    return () => {
      if (!seized) return;
      seized = false;
      // Hand back to whatever the globe was doing, not to orbit. A scene is
      // normally played ON a selection — the card was dropped on the building, the
      // building got selected, the camera flew to it, and only then did the scene
      // open. Fitting the whole sphere on the way out would throw that navigation
      // away and leave the player looking at a planet, having just been shown a
      // door. Re-flying also restores this component's own framing bookkeeping,
      // which a seized camera has necessarily been driving around behind its back.
      if (focusOnSelect && selectedId && globeDirs.has(selectedId)) {
        flyToNode(selectedId, 520);
      } else {
        scheduleGlobeFit();
      }
    };
  }

  /** Write a pose. Ignored unless seized — an unseized write would be overwritten
   *  by whatever this component is doing, silently and one frame later. */
  export function setCameraPose(p: CameraPose) {
    if (!seized) return;
    meshYaw = p.yaw;
    meshPitch = clampPitch(p.pitch);
    meshViewDistance = p.viewDistance;
  }

  /** The flight itself: turn the world to `to` while the camera jibs from whatever
   *  it is framing now down to `tight`, both riding ONE eased t. */
  function flyAlong(
    dir: Vec3,
    to: CameraPose,
    tight: number,
    flightMs: number,
  ) {
    const from: CameraPose = {
      yaw: meshYaw,
      pitch: meshPitch,
      viewDistance: meshViewDistance,
    };
    // The camera's own framing, eased on the same t but trailing the turn — the
    // arm starts coming in while the world is still swinging round, and closes
    // last. One curve, two things riding it.
    // Captured ONCE, before the loop. Read inside it, `wide` would be last
    // frame's radius — the ease would chase its own output and crawl instead of
    // travelling from A to B.
    const wide = framedR ?? globeRadius * 1.15;
    let raf = 0;
    let t0 = 0;
    const step = (now: number) => {
      // Two lines, no-ops unless the QA cog has armed a capture. See
      // perf/frame-probe: the question this exists to answer is whether a stall
      // here is our arithmetic or the paint it causes, and nothing cheaper can
      // tell those apart.
      frameProbe.begin(now);
      if (!t0) t0 = now;
      const t = Math.min(1, (now - t0) / Math.max(1, flightMs));
      const pose = cameraApproach(from, to, t);
      meshYaw = pose.yaw;
      meshPitch = pose.pitch;
      meshViewDistance = pose.viewDistance;

      // Where the subject IS under this frame's pose. Same projection the
      // renderer runs, so the camera aims at the node the viewer can see rather
      // than at where it was when the flight began.
      if (camera) {
        const spun = spin(dir, pose.yaw, pose.pitch + axialTilt);
        const lift = terrainLift(effTerrain, dir, effRelief);
        const p = project(spun, globeRadius, pose.viewDistance, lift);
        const hub = hubNode();
        const nx = (hub?.x ?? CX) + p.x;
        const ny = (hub?.y ?? CY) + p.y;
        // Ease the FRAMING radius from where the camera ALREADY is down to
        // this node — not from the whole globe every time.
        //
        // That distinction is the difference between hopping between two
        // neighbours and pulling all the way out to orbit and diving back in.
        // From an unfocused globe `framedR` is null, the start is the whole
        // sphere, and you get the arrival shot. From another node it is that
        // node's framing, so the zoom term begins at its destination and the
        // move collapses to what it should be: a turn, camera tracking across.
        // ── Zoom in STEPS, pan continuously ─────────────────────────────
        // Measured on real hardware, the whole scene is paint-bound: script
        // time is 0.0ms and ~every frame misses 60Hz even during the intro,
        // which nonetheless reads as smooth. That is the clue. Smoothness is
        // CONSISTENCY, not speed — a steady 34ms frame looks fine, and the
        // same 34ms with excursions to 48 looks like lag.
        //
        // The only thing this flight varies that the intro does not is the
        // SCALE, and a scale change is what invalidates a rasterized layer.
        // So the scale is quantised: several consecutive frames land on an
        // identical value and can reuse what was already rasterised, while
        // the PAN keeps updating every frame, which is what the eye is
        // actually tracking. The steps are invisible for the same reason —
        // nothing on screen holds still enough for a 4% zoom increment to
        // read as a jump.
        //
        // It also explains "only from the full globe view": arrival sweeps
        // the scale across a large range, where a hop between neighbours
        // barely moves it and has always felt fine.
        const kRaw = easeInOut(Math.max(0, (t - 0.15) / 0.85));
        const k = Math.round(kRaw * focusZoomSteps) / focusZoomSteps;
        const R = wide + (tight - wide) * k;
        framedR = R;
        framedDir = dir;
        camera.fitRect(
          { minX: nx - R, minY: ny - R, maxX: nx + R, maxY: ny + R },
          { padding: hudInsets ? 8 : 40, insets: hudInsets, duration: 0 },
        );
      }

      frameProbe.endScript();
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        flyingTo = null;
        frameProbe.stop();
      }
    };
    raf = requestAnimationFrame(step);
    stopFly = () => cancelAnimationFrame(raf);
  }

  /** Ease shared by the flight's framing. Matches physics/orbit's curve so the
   *  camera's close-in accelerates like the turn it is riding on. */
  function easeInOut(t: number): number {
    const c = Math.max(0, Math.min(1, t));
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  }

  // ── Orbit intro ───────────────────────────────────────────────────────────
  // The reusable physics/orbit fly-in, driving the globe's own yaw/pitch/distance.
  // Registered with globeRegistry so the DevCog can play any preset on it.
  let introPlaying = $state(false);
  let cancelIntro: (() => void) | null = null;

  function stopGlobeIntro() {
    cancelIntro?.();
    cancelIntro = null;
    introPlaying = false;
  }

  function playGlobeIntro(cfg: OrbitIntroConfig) {
    if (layout !== "globe") return;
    stopGlobeIntro();
    const s = orbitIntroStart(cfg);
    meshYaw = s.yaw;
    meshPitch = clampPitch(s.pitch);
    meshViewDistance = s.viewDistance;
    introPlaying = true;
    cancelIntro = playOrbitIntro(
      cfg,
      (p) => {
        // Probed too, and that is the whole point: the intro moves the same
        // pose state at the same rate WITHOUT touching the canvas zoom, so it
        // is the control the flight is measured against. One capture each and
        // the difference between them is the cost of the thing they do not
        // share.
        frameProbe.begin(performance.now());
        meshYaw = p.yaw;
        meshPitch = clampPitch(p.pitch);
        meshViewDistance = p.viewDistance;
        frameProbe.endScript();
      },
      () => {
        introPlaying = false;
        frameProbe.stop();
      },
    );
  }

  // Announce the globe to the DevCog while the globe layout is active; the handle
  // drops when the layout changes away or the component unmounts.
  const globeInstanceId = `globe-${++GLOBE_SEQ}`;
  $effect(() => {
    if (layout !== "globe") return;
    return registerGlobe({
      id: globeInstanceId,
      label: globeLabel,
      rest: GLOBE_REST,
      play: (cfg) => playGlobeIntro(cfg),
      cancel: () => stopGlobeIntro(),
      // untracked: the cog only needs a value to START its slider at, and a
      // tracked read would re-register the handle on every drag of it.
      wallHeight: untrack(() => territoryWallHeight),
      setWallHeight: (v) => (territoryWallHeight = v),
      pieceLean: untrack(() => pieceLean),
      setPieceLean: (v) => {
        pieceLean = v;
        // The frame is only rebuilt inside the projection pass, and that pass
        // watches the camera — not this. Without a nudge the lean would not
        // take effect until the next spin.
        applyGlobe();
      },
      ...(terrain
        ? {
            relief: untrack(() => relief),
            setRelief: (v: number) => {
              relief = v;
              applyGlobe();
            },
          }
        : {}),
      surface: untrack(() => globeSurface),
      setSurface: (v) => {
        globeSurface = v;
        applyGlobe();
      },
    });
  });

  // Optional auto-play: fly in once, the first time the globe layout appears.
  let introPlayed = false;
  $effect(() => {
    if (layout !== "globe" || !globeIntro || introPlayed) return;
    introPlayed = true;
    // Wait for the entry fit to settle so the dolly starts from the fitted frame.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => playGlobeIntro({ rest: GLOBE_REST })),
    );
  });

  // Advance yaw one step per frame while auto-rotate is on — paused during a drag
  // so the operator's spin isn't fought. Reads autoRotate + layout reactively; the
  // per-frame reads inside the loop are untracked, so writing meshYaw doesn't
  // restart the loop.
  //
  // Also paused while something is SELECTED, not merely while flying to it. A
  // globe that turns to show you a node and then immediately carries it away
  // again has not shown it to you — and the drawer alongside is describing a node
  // that is by then somewhere else. Selection means "hold still and look at
  // this"; the rotation resumes when the selection is cleared.
  $effect(() => {
    if (!autoRotate || layout !== "globe") return;
    let raf = 0;
    const tick = () => {
      // A region held in focus holds the globe still for the same reason a
      // selection does: it was flown to in order to be looked at, and a globe
      // that immediately turns it away has not shown it to anyone.
      if (
        !globeDrag &&
        !introPlaying &&
        !flyingTo &&
        !seized &&
        !selectedId &&
        !territoryFocus
      )
        meshYaw += autoRotateSpeed;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // Selecting a node turns the globe to face it. Opt-in, because on a mesh where
  // selection is just "show me the details" an unrequested camera move is
  // disorienting — it is the pairing with a drawer that makes it read as
  // navigation rather than as the globe wandering off.
  $effect(() => {
    const id = selectedId;
    if (!focusOnSelect || layout !== "globe") return;
    // untrack the pose: this must fire when the SELECTION changes, never when
    // the flight it starts writes a new yaw.
    untrack(() => {
      // A scene that selects the building it is about — which is the normal way
      // to open one — must not have this fly the camera out from under it.
      if (seized) return;
      // Any pending pull-back is cancelled first — see below for why one may be
      // in flight at all.
      if (pullBack) {
        clearTimeout(pullBack);
        pullBack = null;
      }
      if (id) {
        flyToNode(id, focusDurationMs);
        return;
      }

      // ── Deselection is not always deselection ──────────────────────────
      // Clicking straight from one node to another arrives as THREE updates:
      // the old id, a null, then the new id. Acting on that null immediately
      // makes every hop between neighbours pull the camera all the way out to
      // the whole globe and dive back in — which is exactly the re-zoom this
      // is meant to avoid, caused by the fix for it firing on a selection that
      // was never actually cleared.
      //
      // So a null waits a beat. A real deselect is still a beat away from
      // happening, which nobody can perceive; a hop cancels it on the very next
      // update and stays a hop. A flag on the event would be better, but the
      // null genuinely is what the binding reports, and this reads the intent
      // out of it without asking every caller to change how they select.
      pullBack = setTimeout(() => {
        pullBack = null;
        // Drilled in from a region? Pull back to THAT, not to orbit — the region
        // is where "back" is when it is how the operator got here.
        if (territoryFocus && globeCaps?.has(territoryFocus)) {
          flyToTerritory(territoryFocus, focusDurationMs);
          return;
        }
        // Only the DISTANCE is restored, never the orientation. The operator
        // is left looking wherever they were looking — snapping the globe back
        // to its start would undo the navigation they just did, which is the
        // opposite of closing a panel.
        stopFlyTo();
        // Unconditional: the jib re-framed the canvas even when the dolly had
        // nowhere to travel, so an early return would leave the camera parked
        // on a node nobody has selected any more.
        scheduleGlobeFit();
        if (Math.abs(meshViewDistance - GLOBE_REST.viewDistance) < 0.01) return;
        stopFly = playCameraTo(
          { yaw: meshYaw, pitch: meshPitch, viewDistance: meshViewDistance },
          {
            yaw: meshYaw,
            pitch: meshPitch,
            viewDistance: GLOBE_REST.viewDistance,
          },
          (p) => (meshViewDistance = p.viewDistance),
          { durationMs: focusDurationMs * 0.7, onDone: scheduleGlobeFit },
        );
      }, 90);
    });
  });

  // ── Placement ───────────────────────────────────────────────────────────────
  // Rebuild the placed copy from the caller's logical nodes, preserving the
  // position of any node still on the canvas (keyed by id) so polls and drags
  // don't scatter the mesh. A layout change re-places everything.
  function place() {
    const prev = new Map(placed.map((n) => [n.id, n]));
    const relayout = placedLayout !== layout;
    placedLayout = layout;

    const hubIn = nodes.find((n) => n.id === hubId);
    const hubPrev = hubIn ? prev.get(hubId) : undefined;
    const spokesIn = nodes.filter((n) => n.id !== hubId);

    const hub: StudioNode | undefined = hubIn
      ? {
          ...hubIn,
          x: hubPrev?.x ?? CX,
          y: hubPrev?.y ?? CY,
          r: hubIn.r ?? nodeR,
        }
      : undefined;
    const hx = hub?.x ?? CX;
    const hy = hub?.y ?? CY;
    const hubR = hub?.r ?? nodeR;

    // A spoke keeps its place unless it's new or the layout changed.
    const spokes: StudioNode[] = spokesIn.map((n) => {
      const p = relayout ? undefined : prev.get(n.id);
      return { ...n, x: p?.x ?? NaN, y: p?.y ?? NaN, r: n.r ?? nodeR };
    });
    // The FOOTPRINT each spoke occupies for placement — the drawn disc plus any
    // rings/captions the caller declares via radiusOf. Placement solves against
    // these, but the nodes still DRAW at their own `r`.
    //
    // A node standing as a SOLID is the one case the caller cannot be trusted to
    // declare, so it is added here. A building reaches `PIECE_REACH` radii where
    // the disc it replaced reached one — roughly four times the area — and a
    // globe packed for discs puts seventeen of them shoulder to shoulder. The
    // failure is also nearly invisible in review: two tall pieces only collide
    // on the bearings where they line up, so it looks fine until it is spun.
    //
    // Inflating the footprint rather than shrinking the buildings is deliberate.
    // It grows the SPHERE, and `globeFill` then fits that bigger sphere to the
    // viewport — so the structures end up as small marks on a world, which is
    // what a globe should read as, instead of a world crowded by its own labels.
    const footprint = (n: StudioNode) => {
      const base = radiusOf?.(n) ?? n.r ?? nodeR;
      return isRelief && n.piece ? base * PIECE_REACH : base;
    };

    if (layout === "globe") {
      const radii = spokes.map(footprint);
      // Grouping is decided at the SEED — which direction each body gets — so the
      // only thing a territory globe changes is the packer. Everything downstream
      // (radius, spin, projection, depth sort) is identical.
      // A group key may be a number (lanes index by one); a territory is keyed by
      // identity, so normalise to the string form the caps are looked up by.
      const groups =
        globeTerritories && groupKeyOf
          ? spokes.map((s) => String(groupKeyOf(s)))
          : null;
      const grouped = groups
        ? packSphereClusters(radii, groups, {
            margin,
            // The default centres sit evenly around the equator, so neighbours are
            // 2π/N apart and a cap wider than half of that reaches into the next
            // region. Ceiling the half-angle at that geometry (less a border) is
            // what keeps N territories legible AS territories for any N — without
            // it, four populous groups on one sphere just smear into a band.
            maxAlpha: Math.max(
              (18 * Math.PI) / 180,
              Math.PI / new Set(groups).size - TERRITORY_BORDER,
            ),
            ...(territoryFraction === undefined
              ? {}
              : { fraction: territoryFraction }),
          })
        : null;
      globeCaps = grouped?.caps ?? null;
      const sph = grouped ?? packSphere(radii, { margin });
      // packSphere only sees the bodies ON the sphere; the crest sits at its
      // centre, so the shell has to clear that too.
      globeRadius = Math.max(
        sph.radius,
        hubR + hubMargin + (radii.length ? Math.max(...radii) : 0),
      );
      globeDirs = new Map(spokes.map((s, i) => [s.id, sph.dirs[i]]));
      // Scaled against the DRAWN radius, not the footprint — the disc is what the
      // perspective scale grows and shrinks. Dividing by globeFill cancels the
      // overfilled zoom, so a bigger globe spreads its nodes further apart rather
      // than drawing them larger.
      globeBaseR = new Map(
        spokes.map((s) => [s.id, (s.r ?? nodeR) / globeFill]),
      );
      if (hub) hub.r = hubR / globeFill;
      placed = hub ? [hub, ...spokes] : spokes;
      applyGlobe();
      // Refit only when the globe truly changed shape — on entering it, when the
      // vendor count moved, or when grouping came or went — so routine polls
      // don't yank a manual zoom back. Grouping counts: carving the surface into
      // regions needs a bigger sphere for the same nodes, so the pack the camera
      // was fitted to is no longer the pack on screen.
      const clustered = !!grouped;
      if (
        relayout ||
        spokes.length !== lastGlobeFitCount ||
        clustered !== lastGlobeClustered
      ) {
        lastGlobeFitCount = spokes.length;
        lastGlobeClustered = clustered;
        scheduleGlobeFit();
      }
    } else {
      // Territories are a property of the sphere, not of the data — a planar
      // layout groups by proximity on its own and has no caps to draw.
      globeCaps = null;
      // Solve against footprint-sized bodies, then copy the settled positions
      // back onto the render nodes (which keep their own draw radius).
      const bodies = spokes.map((s) => ({ x: s.x, y: s.y, r: footprint(s) }));
      solveMeshLayout(bodies, {
        layout,
        hub: { x: hx, y: hy, r: hubR },
        margin,
        hubMargin,
        groupMargin,
        fanSpread,
        groupKeys: groupKeyOf ? spokes.map(groupKeyOf) : undefined,
        pinned: bodies.map((b) => Number.isFinite(b.x)),
        lanes: layout === "radial" && spokes.length <= maxLaneNodes,
        laneClearance,
      });
      spokes.forEach((s, i) => {
        s.x = bodies[i].x;
        s.y = bodies[i].y;
      });
      placed = hub ? [hub, ...spokes] : spokes;
    }
  }

  // React to the caller's data + layout only; untrack the position-preserving
  // reads/writes so a drag (which mutates placed x/y) doesn't retrigger placement.
  // Territory settings belong in that list too: they change where every body goes,
  // and `place` is the only thing that carves the regions — without them a caller
  // that toggles grouping keeps the old placement AND its now-wrong captions.
  $effect(() => {
    void nodes;
    void layout;
    void globeTerritories;
    void territoryFraction;
    // `groupKeyOf` decides WHICH region each body seeds into, so a caller that
    // swaps the grouping function — a different taxonomy over the same nodes —
    // is asking for exactly the re-placement this effect exists to do. Leaving
    // it untracked meant the only way to re-carve the globe was to reload the
    // page, which throws away camera, selection and spin.
    void groupKeyOf;
    untrack(place);
  });

  /** The hue the whole world draws in on a relief globe. A cold cyan-white: it
   *  sits far enough from both the amber of `degraded` and the red of `offline`
   *  that either reads as an alarm the instant it appears, which is the entire
   *  point of giving the palette back. */
  const WORLD_HUE = "#7FE3F0";

  const isGlobe = $derived(layout === "globe");
  // Globe nodes never settle — applyGlobe re-sorts `placed` by depth every spin
  // frame for paint order, which repeatedly reorders the keyed {#each} in
  // MeshStudio. The per-node pop-in ties its animation to that same array, so
  // on a globe it replays continuously instead of once on mount. Off for globe,
  // on everywhere else where nodes are placed once and stay put.
  // Caller overrides win over both the defaults and the globe's own popIn stance —
  // a page turning a whole layer off means it for every layout.
  const studioTuning = $derived({
    ...DEFAULT_TUNING,
    ...(isGlobe ? { popIn: false } : {}),
    // On a relief globe the nodes are standing IN a projected landscape, so an
    // opaque disc reads as a sticker over it rather than as part of it. Held
    // well above zero — a node still has to be legible against whatever terrain
    // happens to be behind it, and full transparency loses the disc entirely.
    ...(isGlobe && isRelief ? { bodyOpacity: 0.42 } : {}),
    // ── No rings on a globe ────────────────────────────────────────────────
    // Connection arcs are nested circles with dots riding on them, and ports are
    // dots spaced around a circle. Both are a small globe with an orbit — which
    // is the CONTAINER's own shape language repeated at node scale. Repeat a
    // container's vocabulary inside it and the eye loses the one cue it has for
    // separating a level from the level above: everything reads as the same kind
    // of object, and a globe of agents becomes a globe covered in little globes.
    //
    // Keyed to `isGlobe` rather than to whether a node has a building, because
    // the clash is with the sphere and not with the node — a ringed disc is a
    // little globe whether or not a solid was available to stand there instead.
    //
    // Nothing is lost. The links already carry what the arcs said and a globe
    // draws them as true 3D spokes; ports are handles for a drag a globe cannot
    // service anyway, since a body on a sphere has no screen position a drag
    // could set that the next spin would not overwrite.
    ...(isGlobe ? { connArcs: false, ports: false } : {}),
    // One cold world. Only honest on a relief globe, where every node stands as
    // a building and so still has something to be identified BY once its tint
    // stops doing that job.
    ...(isGlobe && isRelief ? { worldHue: WORLD_HUE } : {}),
    ...tuning,
  });

  // The named regions. A cap with no name is still a region — it just goes
  // uncaptioned, which is the right answer for a group the caller has no word for.
  const territories = $derived.by<Territory[]>(() => {
    if (!globeCaps || !territoryOf) return [];
    const out: Territory[] = [];
    for (const [key, cap] of globeCaps) {
      const meta = territoryOf(key);
      if (meta)
        out.push({
          key,
          cap,
          name: meta.name,
          color: meta.color,
          glow: meta.glow,
        });
    }
    return out;
  });

  // Picking a node is what puts its territory in focus — the tint follows the
  // operator's attention rather than needing a control of its own. Failing that,
  // whichever territory the camera was last flown to.
  const focusedTerritory = $derived.by(() => {
    if (selectedId && groupKeyOf && selectedId !== hubId) {
      const n = nodes.find((x) => x.id === selectedId);
      if (n) return String(groupKeyOf(n));
    }
    return territoryFocus;
  });

  // Report the focus out, so a caller's own list of them can light the same row.
  $effect(() => {
    focusTerritory = focusedTerritory;
  });
</script>

<!-- Handlers sit on the wrapper, not inside Canvas: on the globe the whole surface
     is grabbable (including over a node), so the gesture needs the full area. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="absolute inset-0"
  class:cursor-grab={isGlobe && !globeDrag}
  class:cursor-grabbing={!!globeDrag}
  onpointerdown={globeDown}
  onpointermove={globeMove}
  onpointerup={globeUp}
  onpointerleave={globeUp}
>
  <Canvas fitOnLoad bind:camera allowPan={!isGlobe}>
    {#if isGlobe}
      <!-- Same pose and same camera as the nodes, tilt included: the wireframe is
			     only worth drawing if it is the sphere the nodes are actually on. Left
			     upright, or left at a fixed dolly while the intro flies the camera in,
			     it drifts off them and reads as a bug. -->
      <GlobeFrame
        cx={hubNode()?.x ?? CX}
        cy={hubNode()?.y ?? CY}
        radius={globeRadius}
        yaw={meshYaw}
        pitch={meshPitch + axialTilt}
        viewDistance={meshViewDistance}
        terrain={effTerrain}
        relief={effRelief}
      />
      {#if territories.length}
        <!-- The same ground the frame above is riding. One surface drawn twice
				     — sparsely as the globe's own grid, densely as each region's floor —
				     and never two surfaces, which is what a raised landscape over an
				     untouched sphere would be. -->
        <TerritoryCaps
          cx={hubNode()?.x ?? CX}
          cy={hubNode()?.y ?? CY}
          globeR={globeRadius}
          yaw={meshYaw}
          pitch={meshPitch + axialTilt}
          viewDistance={meshViewDistance}
          {territories}
          focus={focusedTerritory}
          wallHeight={effWallHeight}
          terrain={effTerrain}
          relief={effRelief}
          moving={!!flyingTo || introPlaying || !!globeDrag}
        />
      {/if}

      <!-- The buildings, on the GPU. Sits between the terrain and MeshStudio, so
			     the SVG layer still paints labels, hit proxies and beacons over it.
			     Opt-in while both renderers exist: `glPieces` is the A/B switch that
			     lets the same scene be measured either way with the QA cog. -->
      {#if isGlobe && isRelief && glPieces}
        <GlobePieces
          nodes={placed}
          {selectedId}
          styleOf={(n) => ({
            // The SAME precedence MeshStudio uses — state outranks identity, and
            // the world hue only ever replaces the healthy branch. Duplicated
            // deliberately rather than imported: it is three terms, and the
            // alternative is exporting a colour rule out of a component.
            color: meshInk(
              n.state === "degraded"
                ? studioTuning.degradedColor
                : n.state === "offline"
                  ? studioTuning.offlineColor
                  : studioTuning.worldHue || n.strokeColor || WORLD_HUE,
            ),
            // Already themed where it was assigned; the fallback is not.
            land: n.groundColor ?? meshInk(studioTuning.worldHue || WORLD_HUE),
          })}
        />
      {/if}
    {/if}
    <MeshStudio
      {concept}
      {edgeCurve}
      bind:nodes={placed}
      bind:edges
      bind:selectedId
      {raisedEdgeIds}
      allowNodeDrag={!isGlobe}
      {insetLeafLabels}
      {typeLabels}
      depthSortedParticles={isGlobe}
      glBodies={isGlobe && isRelief && glPieces}
      tuning={studioTuning}
      {onSelect}
      {onLink}
      {onFacetSelect}
    />
  </Canvas>
</div>

<!-- On-canvas controls — a sibling of the drag surface (not a child), so pressing
     a button never starts a spin. Bottom-right. The spin/zoom rows are globe-only;
     the arrangement picker rides in the same cluster in every layout. -->
{#if (globeControls && isGlobe) || layoutPicker}
  <div class="gc">
    {#if globeControls && isGlobe}
      <div class="gc-dpad">
        <button
          class="gc-btn gc-up"
          onclick={() => spinGlobe(0, -SPIN_STEP)}
          aria-label="Tilt up"
        >
          <Icon name="chevron-up" size={14} />
        </button>
        <button
          class="gc-btn gc-left"
          onclick={() => spinGlobe(-SPIN_STEP, 0)}
          aria-label="Spin left"
        >
          <Icon name="chevron-left" size={14} />
        </button>
        <button
          class="gc-btn gc-home"
          onclick={resetGlobe}
          aria-label="Reset globe view"
        >
          <Icon name="home" size={12} />
        </button>
        <button
          class="gc-btn gc-right"
          onclick={() => spinGlobe(SPIN_STEP, 0)}
          aria-label="Spin right"
        >
          <Icon name="chevron-right" size={14} />
        </button>
        <button
          class="gc-btn gc-down"
          onclick={() => spinGlobe(0, SPIN_STEP)}
          aria-label="Tilt down"
        >
          <Icon name="chevron-down" size={14} />
        </button>
      </div>
      <div class="gc-row">
        <button
          class="gc-btn"
          class:gc-on={autoRotate}
          aria-pressed={autoRotate}
          onclick={() => (autoRotate = !autoRotate)}
          aria-label="Toggle auto-rotate"
        >
          <Icon name="refresh-cw" size={12} />
        </button>
        <button
          class="gc-btn"
          onclick={() => camera?.zoomOut()}
          aria-label="Zoom out"
        >
          <Icon name="minus" size={14} />
        </button>
        <button
          class="gc-btn"
          onclick={() => camera?.zoomIn()}
          aria-label="Zoom in"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
    {/if}
    {#if layoutPicker}
      <div
        class="gc-arrange"
        class:gc-arrange--alone={!(globeControls && isGlobe)}
      >
        <button
          class="gc-btn gc-wide"
          class:gc-on={layoutOpen}
          aria-expanded={layoutOpen}
          aria-label="Arrangement"
          onclick={() => (layoutOpen = !layoutOpen)}
        >
          <Icon name="settings" size={12} />
        </button>
        {#if layoutOpen}
          <!-- Opens upward: the cluster is pinned to the bottom of the canvas. -->
          <div class="gc-pop">
            <MeshLayoutPicker bind:value={layout} />
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .gc {
    position: absolute;
    bottom: 0.9rem;
    right: 0.9rem;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.4rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg-elev) 88%, transparent);
    backdrop-filter: blur(8px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }
  .gc-dpad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-areas:
      ". up ."
      "left home right"
      ". down .";
    gap: 3px;
  }
  .gc-up {
    grid-area: up;
  }
  .gc-left {
    grid-area: left;
  }
  .gc-home {
    grid-area: home;
  }
  .gc-right {
    grid-area: right;
  }
  .gc-down {
    grid-area: down;
  }
  .gc-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
    border-top: 1px solid var(--border);
    padding-top: 0.4rem;
  }
  .gc-arrange {
    position: relative;
    display: flex;
    justify-content: center;
    border-top: 1px solid var(--border);
    padding-top: 0.4rem;
  }
  /* No globe rows above it — then it is the whole cluster and needs no divider. */
  .gc-arrange--alone {
    border-top: none;
    padding-top: 0;
  }
  .gc-wide {
    width: 100%;
  }
  .gc-pop {
    position: absolute;
    bottom: calc(100% + 0.45rem);
    right: 0;
    z-index: 5;
    width: 16rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }
  .gc-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg);
    color: var(--fg-muted);
    cursor: pointer;
    transition:
      color 0.12s,
      border-color 0.12s,
      background 0.12s;
  }
  .gc-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .gc-btn:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: 1px;
  }
  .gc-on {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
</style>
