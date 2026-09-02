<script lang="ts">
	// ── PieceCrest — one solid, standing still ───────────────────────────────────
	// `NodePiece` draws a building through a node's local frame, which means it
	// needs a globe to stand on. This is the same solid with nowhere to stand: a
	// fixed head-on frame, so a piece can be used as an ICON — in a roster, a log
	// row, a legend — and still be the same object the canvas draws out there
	// rather than a flat glyph chosen to represent it.
	//
	// Nothing here knows what a piece MEANS. The caller passes a catalogue key.
	//
	// `tangentFrame` wants a surface direction. +z is straight at the viewer, so
	// the piece is seen head-on, and the lean tips it forward the same few degrees
	// the board uses — enough to read as a solid with a roof rather than a
	// footprint.
	import { tangentFrame } from '../../physics/sphere.js';
	import { ALL_PIECES } from './piece-catalogue.js';
	import { SUSPENDED_PIECES } from './pieces-glyphs.js';
	import NodePiece from './NodePiece.svelte';

	interface Props {
		/** `Structure.piece` — the catalogue key, not the structure id. */
		piece: string;
		color: string;
		/** Dims and dashes it, for a building nobody is holding. */
		offline?: boolean;
		size?: number;
	}

	let { piece, color, offline = false, size = 46 }: Props = $props();

	const solid = $derived(ALL_PIECES[piece]);
	/** Resolved from the catalogue, not asked of the caller. Whether a shape is
	 *  founded or projected is a fact about the shape, and a prop would let a
	 *  roster draw the same piece two ways on two screens. */
	const suspended = $derived(SUSPENDED_PIECES.has(piece));

	// Head-on, tipped forward. `step` is the world-units-per-frame-unit the solid
	// is measured in — the pieces are authored around 1, so this is the dial that
	// decides how much of the crest the building fills.
	const frame = $derived(
		tangentFrame({ x: 0, y: 0, z: 1 }, 40, { step: 7.5, lean: 0.42, viewDistance: 3.4 })
	);
</script>

{#if solid}
	<svg
		viewBox="-16 -20 32 30"
		width={size}
		height={size}
		aria-hidden="true"
		style:overflow="visible"
	>
		<NodePiece piece={solid} {frame} {color} {offline} {suspended} plot={0} />
	</svg>
{/if}
