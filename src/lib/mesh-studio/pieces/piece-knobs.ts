// ── piece-knobs — what the Piece Studio exposes ──────────────────────────────
//
// Declared in the SAME `Knob` shape the backdrop and character tools use, so
// `BackdropControls` draws this panel too. Their rule holds here unchanged: a
// value declared below must be a value something actually reads — every entry
// is consumed by `readPieceKnobs` on the next render.
//
// The departure `character-knobs` documents applies here for the same reason. A
// `ColorKnob` names a CSS custom property because a backdrop is painted by CSS;
// a piece is not — it is SVG paths whose stroke is computed per facet from the
// lit colour — so the token is a plain identity for the panel to key on and the
// studio reads the value back out rather than writing it to a style attribute.
//
// WHAT IS NOT HERE: the geometry. `e`, `n` and `h` are the building, and there
// is nowhere to save an edited one to — `pieces-works.ts` and `pieces-civic.ts`
// are hand-authored TypeScript. Exposing vertex sliders would be authoring into
// a void, which is the mistake the backdrop tool made when its compositions had
// no way back to the canvas. Everything below is either the CAMERA or the
// PALETTE: turn a piece round, light it differently, and the piece is unchanged.

import { splitColor, type Knob } from '../../backdrop/backdrop-tokens.js';
import { HOLO_DEFAULTS, type HoloLook } from './holo-look.js';

export const INK_TOKEN = '--piece-ink';
export const LAND_TOKEN = '--piece-land';

/** Radians on the wire, degrees in the panel — nobody turns a model in radians,
 *  and a slider labelled `0.42` is a slider nobody moves on purpose. */
const DEG = 180 / Math.PI;

/** The crest's own framing, which is what a card in the catalogue draws with.
 *  The studio opens here so the first thing on the stage is the thing that was
 *  clicked, at the size it was clicked at, rather than a different view of it. */
export const PIECE_VIEW = { step: 7.5, lean: 0.42, viewDistance: 3.4 };

/** @param free  The piece is being shown DETACHED — in a review harness rather
 *               than standing on a globe. Widens the lean to a full turn; see
 *               the knob's own note for why that is a property of the context
 *               and not of the piece. */
export function pieceKnobs(ink: string, free = false): Knob[] {
	return [
		{
			kind: 'color',
			group: 'colour',
			token: INK_TOKEN,
			label: 'Ink',
			hint: 'The building’s own colour. On the globe this is the mode’s hue — the one thing a piece is allowed to be tinted by, and only because the shape is already carrying the identity.',
			value: ink
		},
		{
			kind: 'color',
			group: 'colour',
			token: LAND_TOKEN,
			label: 'Land',
			hint: 'The ground it stands in. Lines leave the footings this colour and become the ink as they rise, so the building starts as terrain and only becomes itself further up. Set it to the ink to turn the ramp off.',
			value: '#0f172a'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'bearing',
			label: 'Bearing',
			hint: 'Turn about the building’s own vertical. This is the review that matters: a silhouette that only reads from one bearing is not carrying identity on the globe, which shows every side of it.',
			value: 0,
			min: -180,
			max: 180,
			step: 1,
			unit: '°'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'lean',
			label: 'Lean',
			hint: free
				? 'Tilt, all the way round. Nothing here is standing on anything — turn it past vertical and look at its underside if you want to.'
				: 'Camera tilt. 0 is plan-on and hides the roof, which is where most of these buildings keep their one break through the top silhouette. Past about 60° the walls start to disappear under it.',
			value: Math.round(PIECE_VIEW.lean * DEG),
			// The clamp belongs to the GLOBE, not to the piece.
			//
			// On a sphere, lean is the camera's angle to the surface a piece sits on,
			// and the range past vertical is that camera rolling under the ground — a
			// view of a state that does not exist, so it is closed off. Detached,
			// there is no surface to roll under: the piece is an object in space and
			// every angle onto it is real.
			//
			// Worth being exact about, because the first version of this tied the
			// range to whether the piece was SUSPENDED, which sounds right and is
			// not. Hanging in the air is a property of the shape; being shown off the
			// globe is a property of where you are looking at it. A founded building
			// on a turntable is exactly as detached as a hologram is, and has exactly
			// as much right to be turned over — it is the same review either way.
			min: free ? -180 : -20,
			max: free ? 180 : 80,
			step: 1,
			unit: '°'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'size',
			label: 'Size',
			hint: 'World units per frame unit — how much of the stage the building fills. Pieces are authored around 1, and the globe draws them at roughly 40px, so a shape that only works at this size is a shape that does not work.',
			value: PIECE_VIEW.step,
			min: 2,
			max: 16,
			step: 0.1,
			unit: '×'
		},
		{
			kind: 'param',
			group: 'shape',
			prop: 'distance',
			label: 'Distance',
			hint: 'Camera distance in globe radii. Near is a strong perspective that flatters a tall mass; far flattens toward isometric. The globe sits around 2.6.',
			value: PIECE_VIEW.viewDistance,
			min: 1.6,
			max: 9,
			step: 0.1
		},
		{
			kind: 'param',
			group: 'floor',
			prop: 'plot',
			label: 'Plot',
			hint: 'Radius of the clearing under the piece, in its own units. Wider than the widest footprint or the building is standing on a plinth rather than in a place.',
			value: 1,
			min: 0,
			max: 3,
			step: 0.05
		},
		{
			kind: 'param',
			group: 'floor',
			prop: 'sink',
			label: 'Sink',
			hint: 'How deep it sits in that ground. Enough that the base edge is buried: a building with a visible bottom edge is parked on the terrain rather than standing in it.',
			value: 0.2,
			min: 0,
			max: 0.8,
			step: 0.01
		},
		// ── The projection material ─────────────────────────────────────────────
		// Only meaningful for a suspended piece, and the studio only shows the
		// section for one. Declared unconditionally anyway: `readPieceKnobs` must
		// answer a complete `HoloLook` whatever is on the stage, and a knob list
		// that changes shape with the subject is a knob list whose values do not
		// survive stepping to the next piece — which is the whole point of keeping
		// the panel between subjects.
		{
			kind: 'param',
			group: 'light',
			prop: 'glow',
			label: 'Glow width',
			hint: 'How far light spills off each surface. Spill is drawn per FACET, so past about 1.5 the stroke outgrows the smallest facet it is glowing off and the halo stops being a halo and becomes a filled lozenge — the dot and the name bar each grow their own blob.',
			value: HOLO_DEFAULTS.glow,
			min: 0,
			max: 2.5,
			step: 0.05,
			unit: '×'
		},
		{
			kind: 'param',
			group: 'light',
			prop: 'glowLevel',
			label: 'Glow',
			hint: 'How bright that spill is. Two widths are drawn, a wide faint one under a narrow brighter one, because real falloff is a curve and a single stroke gives the halo a hard outer edge.',
			value: HOLO_DEFAULTS.glowLevel,
			min: 0,
			max: 3,
			step: 0.05,
			unit: '×'
		},
		{
			kind: 'param',
			group: 'light',
			prop: 'fresnel',
			label: 'Fresnel',
			hint: 'The hologram term, and the only one here that is not decoration. At 1 a face is brightest seen EDGE-ON, which is how a volume of glowing particles behaves. At 0 it is lit flat, like paint. Slide it to watch a projection turn back into a chess piece.',
			value: HOLO_DEFAULTS.fresnel,
			min: 0,
			max: 1,
			step: 0.01
		},
		{
			kind: 'param',
			group: 'light',
			prop: 'through',
			label: 'See-through',
			hint: 'How visible the far side is through the near one. The cue no amount of glow can fake: an opaque object hides its own back and a volume of light does not. At 0 the piece is solid again.',
			value: HOLO_DEFAULTS.through,
			min: 0,
			max: 2.5,
			step: 0.05,
			unit: '×'
		},
		{
			kind: 'param',
			group: 'light',
			prop: 'scan',
			label: 'Scan pitch',
			hint: 'Spacing of the horizontal slices, in node radii. The same plane-cutting-the-solid that draws contours on a building: at 0.24 it reads as terrain at a height, and at a quarter of that as a raster being drawn. Only the pitch decides which.',
			value: HOLO_DEFAULTS.scan,
			min: 0.02,
			max: 0.3,
			step: 0.002
		},
		{
			kind: 'param',
			group: 'light',
			prop: 'scanLevel',
			label: 'Scan',
			hint: 'How strong those lines are. Zero switches them off — worth doing once, to see how much of the read is carried by them and how much by the surface.',
			value: HOLO_DEFAULTS.scanLevel,
			min: 0,
			max: 2.5,
			step: 0.05,
			unit: '×'
		},
		{
			kind: 'param',
			group: 'light',
			prop: 'seat',
			label: 'Occlusion',
			hint: 'A dark wash confined to the piece’s own footprint, so the mesh behind does not read as its edges. Pure transparency at 0 is honest and, over a busy globe, unreadable.',
			value: HOLO_DEFAULTS.seat,
			min: 0,
			max: 0.7,
			step: 0.01
		},
		{
			kind: 'param',
			group: 'motion',
			prop: 'spin',
			label: 'Spin',
			hint: 'Degrees a second on the turntable. The catalogue was authored under a slow one — a shape you have to drag to inspect is a shape you will stop inspecting.',
			value: 0,
			min: 0,
			max: 180,
			step: 1,
			unit: '°/s'
		}
	];
}

/** Pull the values back out in the units the renderer wants. Colours arrive as
 *  `rgba()` from the panel's swatch; `NodePiece` speaks `#rrggbb`, and alpha on
 *  a lit facet would mean the stage showing through a solid. */
export function readPieceKnobs(knobs: Knob[]) {
	const find = (test: (k: Knob) => boolean) => knobs.find(test);
	const color = (token: string, fallback: string) => {
		const k = find((x) => x.kind === 'color' && x.token === token);
		return k ? splitColor(String(k.value)).hex : fallback;
	};
	/** Raw, in whatever unit the knob is labelled in. */
	const raw = (prop: string, fallback: number) => {
		const k = find((x) => x.kind === 'param' && x.prop === prop);
		return k ? Number(k.value) : fallback;
	};
	return {
		ink: color(INK_TOKEN, '#5eead4'),
		land: color(LAND_TOKEN, '#0f172a'),
		bearing: raw('bearing', 0) / DEG,
		lean: raw('lean', PIECE_VIEW.lean * DEG) / DEG,
		step: raw('size', PIECE_VIEW.step),
		viewDistance: raw('distance', PIECE_VIEW.viewDistance),
		plot: raw('plot', 1),
		sink: raw('sink', 0.2),
		/** Degrees a second. Kept in panel units because the clock that advances
		 *  it is measured in seconds, not radians. */
		spin: raw('spin', 0),
		holo: {
			glow: raw('glow', HOLO_DEFAULTS.glow),
			glowLevel: raw('glowLevel', HOLO_DEFAULTS.glowLevel),
			fresnel: raw('fresnel', HOLO_DEFAULTS.fresnel),
			scan: raw('scan', HOLO_DEFAULTS.scan),
			scanLevel: raw('scanLevel', HOLO_DEFAULTS.scanLevel),
			through: raw('through', HOLO_DEFAULTS.through),
			seat: raw('seat', HOLO_DEFAULTS.seat)
		} satisfies HoloLook
	};
}

/** Write an angle back into the list, for drag-to-turn on the stage. The panel
 *  and the drag have to move the SAME value or one of them silently wins. */
export function setPieceAngle(knobs: Knob[], prop: 'bearing' | 'lean', radians: number): Knob[] {
	return knobs.map((k) => {
		if (k.kind !== 'param' || k.prop !== prop) return k;
		const raw = Math.round(radians * DEG);
		// Whether an angle wraps is read off its own RANGE rather than off its name.
		// A knob covering a full turn has no ends to stop at — stopping dead at due
		// west is not a turntable — while a partial range is a partial range because
		// something outside it is meaningless. Keying on `prop === 'bearing'` was
		// the same rule written as a special case, and it silently kept lean clamped
		// when lean was widened to turn freely.
		const deg =
			k.max - k.min >= 360
				? // Doubled modulo, because JS `%` keeps the sign of the left operand:
					// dragging west past -180° would otherwise land outside the slider's
					// own range and the thumb would pin while the model kept turning.
					((((raw - k.min) % 360) + 360) % 360) + k.min
				: Math.max(k.min, Math.min(k.max, raw));
		return { ...k, value: deg };
	});
}
