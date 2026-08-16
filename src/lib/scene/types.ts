// ── Scene model ────────────────────────────────────────────────────────────
// A scene is a CAST (objects), a SPINE (beats), and a SCORE (cues). Nothing is
// nested: objects live in one flat id-keyed list and hierarchy is expressed by
// reference, so an object can be inserted without renumbering anything and a
// diff stays small — which matters because these files are hand-edited by a
// person and by an assistant, in turn.
//
// THE INVARIANT: everything renders as a pure function of one time value. No
// object owns a timer. That is what makes scrubbing exact rather than
// approximate, and every addition to this model has to preserve it.

import type {
	MeshNodeType,
	NodeState,
	DataType,
	EdgeStyle,
} from '../primitives/canvas/canvas.types.js';
import type { MeshLayoutId } from '../mesh-studio/layout/mesh-layout.js';

export type ObjectKind = 'mesh.node' | 'mesh.edge' | 'component';

/**
 * Who decides where an object sits. This one field is the whole answer to
 * "solver-owned mesh nodes and hand-placed components in one scene":
 *
 *   solved  — the layout places it. Enters the solve with invMass 1.
 *   pinned  — the operator placed it; the solver packs everything else AROUND
 *             it (invMass 0). `mesh-layout.ts` already supports this.
 *   fixed   — hand-placed and not part of the mesh solve at all (components).
 */
export type PlaceMode = 'solved' | 'pinned' | 'fixed';

export interface Place {
	mode: PlaceMode;
	/** Authored position. Meaningless for `solved`; authoritative otherwise. */
	x?: number;
	y?: number;
}

export interface NodePayload {
	type: MeshNodeType;
	state: NodeState;
	label: string;
	r: number;
	flow: number;
	opacity: number;
	/** Raw 24×24 stroke markup, same contract as mesh-studio glyphs. */
	iconMarkup?: string;
}

export interface EdgePayload {
	from: string;
	to: string;
	dataType: DataType;
	style: EdgeStyle;
	sig: number;
	active: boolean;
	label?: string;
}

export interface ComponentPayload {
	/** An id from the builder's REGISTRY. */
	componentId: string;
	props: Record<string, unknown>;
	w: number;
	/** 0..1, animatable — components enter and leave rather than blinking. */
	opacity: number;
	/**
	 * Raw CSS applied to the rendered component, same shape and same plumbing as
	 * the builder's per-item overrides (`CanvasItem.styleOverrides`, set by
	 * ThemeStudio). The escape hatch for anything the component's own props do
	 * not expose — a border, a background, a filter.
	 */
	styleOverrides?: Record<string, string>;
}

export interface SceneObject {
	id: string;
	name: string;
	kind: ObjectKind;
	place: Place;
	/** Selector fodder: a cue can target `tag:registry` and hit the whole set. */
	tags?: string[];
	node?: NodePayload;
	edge?: EdgePayload;
	component?: ComponentPayload;
}

export type BeatCamera = { kind: 'fit' } | { kind: 'flyTo'; target: string; zoom?: number };

export interface Beat {
	/** Stable across retimes — `at` is the thing being edited, so it can never
	 *  be the identity. Lanes and cue anchors both key off this. */
	id: string;
	at: number;
	caption: string;
	sub?: string;
	spin: boolean;
	camera: BeatCamera;
}

export type EaseId = 'linear' | 'in' | 'out' | 'inOut';

/**
 * One thing happening to one target over one span.
 *
 * `anchor` is the important field. A cue anchored to a beat moves when that
 * beat moves, which is what makes retiming survivable — drag a boundary and the
 * cues inside travel with it instead of being orphaned mid-sentence. Absolute
 * cues (no anchor) stay put. The editor defaults to anchored because that is
 * right nearly every time.
 */
export interface Cue {
	id: string;
	/** An object id, or a selector: `tag:<name>` / `kind:<kind>`. */
	target: string;
	/** A channel id (a value over time) — mutually exclusive with `burst`. */
	channel?: string;
	/** A burst id (a one-shot effect fired at onset). */
	burst?: string;
	/** Absolute ms. Ignored when `anchor` is set — resolved from it at load. */
	at: number;
	anchor?: { beatId: string; offset: number };
	dur: number;
	from?: unknown;
	to?: unknown;
	ease?: EaseId;
	/** Seconds of delay per target index when the selector matches a set. Turns
	 *  "glow every registry" into a cascade without authoring N cues. */
	stagger?: number;
}

export interface Scene {
	id: string;
	label: string;
	runMs: number;
	/** All five arrangements, globe included. The globe is not solved to x/y —
	 *  it solves for directions on a sphere and projects them at every moment,
	 *  which `placementAt` handles. */
	layout: MeshLayoutId;
	hub: { x: number; y: number; r: number };
	beats: Beat[];
	objects: SceneObject[];
	cues: Cue[];
}

/** What a burst looks like at a moment — the renderer turns these into effects. */
export interface ActiveBurst {
	cueId: string;
	objectId: string;
	burst: string;
	/** 0..1 through this burst, for this target. */
	progress: number;
}
