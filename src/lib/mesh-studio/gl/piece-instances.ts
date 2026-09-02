// ── gl/piece-instances — nodes → one instance buffer ─────────────────────────
// The per-frame half of the building renderer. The geometry (piece-mesh) is
// uploaded once and never touched again; this is the only thing that changes as
// the globe turns, and it is deliberately tiny: 27 floats per node, so a full
// mesh of 24 buildings re-uploads about 2.5KB a frame.
//
// That ratio is the entire argument for the port. The SVG renderer rebuilt
// ~1,300 path strings per frame to say what these 27 numbers say.
//
// Pure: no WebGL, no Svelte, no DOM. It packs a Float32Array and nothing else,
// which is what makes the layout testable without a browser — and the layout is
// exactly where instanced rendering goes wrong.
import type { StudioNode } from '../studio.types.js';
import type { TangentFrame } from '../../physics/sphere.js';

/** Floats per instance. Must match `PIECE_ATTRIBS` in `gl/piece-shaders.ts`;
 *  `piece-instances.spec.ts` asserts the two agree rather than trusting it. */
export const INSTANCE_FLOATS = 27;

/** A node's state, as the shader's `iState`. Kept numeric rather than a bitfield
 *  because there are three mutually exclusive values and a float compares in one
 *  instruction — a bitfield would be cleverness with no payer. */
export const STATE_HEALTHY = 0;
export const STATE_OFFLINE = 1;
export const STATE_SELECTED = 2;

/** `#rgb` / `#rrggbb` → three 0..1 floats. Written out rather than pulled from a
 *  colour library because it is six lines and the alternative is a dependency.
 *  Anything it cannot parse comes back mid-grey, which is visible in the scene
 *  rather than silently black — a black building reads as a hole. */
export function hexRgb(hex: string): [number, number, number] {
	const s = hex.trim().replace('#', '');
	if (s.length === 3) {
		const r = parseInt(s[0] + s[0], 16);
		const g = parseInt(s[1] + s[1], 16);
		const b = parseInt(s[2] + s[2], 16);
		if ([r, g, b].every((v) => Number.isFinite(v))) return [r / 255, g / 255, b / 255];
	}
	if (s.length === 6) {
		const n = parseInt(s, 16);
		if (Number.isFinite(n)) return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
	}
	return [0.5, 0.5, 0.5];
}

/** What the packer needs about a node beyond the node itself. Passed in rather
 *  than resolved here because colour is a STUDIO decision — the world hue, the
 *  degraded amber, the offline red and their precedence all live in MeshStudio,
 *  and duplicating that ordering here is how the two would drift. */
export interface InstanceStyle {
	/** The building's own ink, already resolved through state and world hue. */
	color: string;
	/** The land it stands in, so its lines can leave the ground as ground. */
	land: string;
}

/** True when a node is drawable as a solid this frame.
 *
 *  Both halves matter: `piece` is the shape and `frame` is somewhere to stand.
 *  The flat arrangements withhold the frame rather than stripping the piece, so
 *  this is the only honest test — and it is the same one MeshStudio uses to
 *  decide whether to draw a disc instead. */
export function isSolid(n: StudioNode): n is StudioNode & { piece: string; frame: TangentFrame } {
	return !!(n.piece && n.frame);
}

/** Pack one node at `offset` floats into `out`. Returns the next offset.
 *
 *  Split out so the packing order is stated once. The order here, the order in
 *  `PIECE_ATTRIBS`, and the order of the `in` declarations in the vertex shader
 *  are three statements of one fact; the spec ties them together. */
export function packInstance(
	out: Float32Array,
	offset: number,
	n: StudioNode & { frame: TangentFrame },
	style: InstanceStyle,
	/** Passed in, not derived: selection is a property of the SCENE, and a node
	 *  does not know it is the one being looked at. */
	state: number
): number {
	const f = n.frame;
	let i = offset;
	// iOrigin — the node's centre in canvas world coords. The camera uniform
	// takes it from there to pixels, so this layer never thinks about zoom.
	out[i++] = n.x;
	out[i++] = n.y;
	// iE / iN / iU — screen displacement of one unit along each local axis.
	// Already carries the projection, which is why the vertex shader needs no
	// perspective matrix: the CPU did the sphere, the GPU does the building.
	out[i++] = f.e.x;
	out[i++] = f.e.y;
	out[i++] = f.n.x;
	out[i++] = f.n.y;
	out[i++] = f.u.x;
	out[i++] = f.u.y;
	out[i++] = f.grow;
	out[i++] = n.sink ?? 0;
	// iAxis* — the same three axes as WORLD directions. Positions come from the
	// screen displacements above; ORIENTATION has to come from these, because a
	// screen displacement has already been scaled and bent by perspective and
	// cannot be used to judge which way a face points.
	out[i++] = f.axis.e.x;
	out[i++] = f.axis.e.y;
	out[i++] = f.axis.e.z;
	out[i++] = f.axis.n.x;
	out[i++] = f.axis.n.y;
	out[i++] = f.axis.n.z;
	out[i++] = f.axis.u.x;
	out[i++] = f.axis.u.y;
	out[i++] = f.axis.u.z;
	const [cr, cg, cb] = hexRgb(style.color);
	out[i++] = cr;
	out[i++] = cg;
	out[i++] = cb;
	const [lr, lg, lb] = hexRgb(style.land);
	out[i++] = lr;
	out[i++] = lg;
	out[i++] = lb;
	out[i++] = n.opacity ?? 1;
	out[i++] = state;
	return i;
}

export interface PackResult {
	/** Instance data, one 27-float run per drawable node. */
	data: Float32Array;
	/** How many instances are live. `data` may be longer — see `reuse`. */
	count: number;
	/** The nodes packed, in buffer order. The caller draws one instanced batch
	 *  per PIECE, so it needs to know which node landed where. */
	order: (StudioNode & { piece: string })[];
}

/** Pack every solid node into one buffer.
 *
 *  `reuse` lets a caller hand back last frame's array: this runs once per frame
 *  for the life of the globe, and allocating a fresh Float32Array each time is
 *  garbage the collector has to find during an animation. Grown geometrically
 *  and never shrunk, so the steady state is zero allocation. */
export function packInstances(
	nodes: StudioNode[],
	styleOf: (n: StudioNode) => InstanceStyle,
	selectedId?: string | null,
	reuse?: Float32Array
): PackResult {
	const order: (StudioNode & { piece: string })[] = [];
	for (const n of nodes) if (isSolid(n)) order.push(n);

	const need = order.length * INSTANCE_FLOATS;
	const data = reuse && reuse.length >= need ? reuse : new Float32Array(Math.max(need, 64));

	let off = 0;
	for (const n of order) {
		const state =
			n.id === selectedId
				? STATE_SELECTED
				: n.state === 'offline'
					? STATE_OFFLINE
					: STATE_HEALTHY;
		off = packInstance(data, off, n as StudioNode & { frame: TangentFrame }, styleOf(n), state);
	}
	return { data, count: order.length, order };
}
