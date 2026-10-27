// ── Lobby characters, meshed for the first-person street ─────────────────────
// The lobby draws a player by projecting `figureParts` to SVG. The street needs
// the same solids as triangles, so they go through `meshPiece`, the kernel the
// map's props go through, and a player looks the same in the lobby as in the
// office: one assembler, two cameras.
//
// A figure is meshed once per look: every frame of the walk cycle plus a
// standing frame, concatenated per colour, so drawing one is choosing a slice
// rather than re-meshing a posed body every frame.
//
// Pure: no GL.
import {
	FRAMES,
	PIECE_VERT_FLOATS,
	REST,
	figureParts,
	meshPiece,
	poseAt,
	type ArtOpts,
	type CharacterSkin,
	type Pose
} from 'showcase';

/** A seat's look, as `resolve()` hands it back. */
export interface FigureLook {
	skin: CharacterSkin;
	art: ArtOpts;
}

/** Every vertex of one colour across all frames, frame after frame. */
export interface FigureGroup {
	color: string;
	/** A light source: drawn at full colour however dark the room. */
	emits: boolean;
	verts: Float32Array;
	/** Vertices per frame; the same every frame, since a pose moves solids
	 *  without changing their faces. */
	count: number;
}

/** The standing frame's index, after the walk's. */
export const STILL = FRAMES;

/** Metres walked per walk cycle: two steps. */
export const STRIDE_M = 1.4;

/** Your own arms' colours, for the first-person view: the arm mass and the plate. */
export function armColors({ skin, art }: FigureLook): { sleeve: string; hand: string } {
	return { sleeve: figureParts(skin, art).find((p) => p.name === 'arm')?.color ?? skin.color, hand: skin.color };
}

export function meshFigure({ skin, art }: FigureLook): FigureGroup[] {
	const poses: Pose[] = [...Array.from({ length: FRAMES }, (_, i) => poseAt('walk', i / FRAMES)), REST];
	const frames = poses.map((pose) => figureParts(skin, { ...art, pose }));
	// Grouped by what it is painted, as the map batches by material.
	const keyOf = (p: { color: string; emits: boolean }) => `${p.emits ? 'lamp' : 'body'}|${p.color}`;
	const keys = [...new Set(frames[0].map(keyOf))];
	const tall = Math.max(...frames[STILL].flatMap((p) => p.solid.verts.map((v) => v.h)));
	return keys.map((key) => {
		const chunks = frames.map((parts) => {
			const verts = meshPiece(parts.filter((p) => keyOf(p) === key).map((p) => p.solid)).verts;
			// Height shading across the whole body, not per colour: `meshPiece`
			// normalises to its own pile, which would light a boot like a crown.
			for (let i = 0; i < verts.length; i += PIECE_VERT_FLOATS) verts[i + 6] = verts[i + 2] / tall;
			return verts;
		});
		const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
		chunks.reduce((o, c) => (all.set(c, o), o + c.length), 0);
		const [, color] = key.split('|');
		return { color, emits: key.startsWith('lamp'), verts: all, count: chunks[0].length / PIECE_VERT_FLOATS };
	});
}
