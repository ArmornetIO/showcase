<script lang="ts">
	// ── The badge, small ─────────────────────────────────────────────────────
	// What a role looks like when there is no room for a person.
	//
	// The HUD used to draw a 30px `Figure` in the log feed, the table strip and
	// the seat plates, and it worked: four fixed builds in four fixed hues are
	// four distinguishable silhouettes even that small. Both halves of that
	// sentence stop being true the moment a player chooses their own body and
	// their own colours — at 30px every seat becomes a small grey person.
	//
	// So the small surfaces draw the badge instead. It is the only part of a
	// figure that is guaranteed to mean the same thing on every table: the mark
	// is the role and the tint is the side, and neither is the player's to move.
	//
	// NO RENDERER. `Glyph` is authored as flat convex polygons in a ±1 box with
	// Y up — that is the source form the extruded chest badge is built from, so
	// drawing the polygons directly is not a second copy of the mark, it is the
	// same mark with the extrusion skipped. A 14px badge does not need a camera,
	// a light or a depth sort, and asking for one would make the cheapest thing
	// on screen the most expensive.
	import { CHAR_GLYPHS } from 'showcase';
	import { ROLE_GLYPH, SIDE_TONE } from '../internal/badge.js';
	import { klassByKey, type Faction } from '../internal/rules.js';

	interface Props {
		/** The role. An unknown key still draws — a seat with no mark is a seat
		 *  the reader assumes is empty. */
		klassKey: string;
		side: Faction;
		size?: number;
		/** Say it in words too, for the surfaces that have room. */
		label?: boolean;
	}

	let { klassKey, side, size = 16, label = false }: Props = $props();

	const plates = $derived(CHAR_GLYPHS[ROLE_GLYPH[klassKey] ?? 'ring'] ?? []);
	const tone = $derived(SIDE_TONE[side]);
	const name = $derived(klassByKey(klassKey)?.name ?? klassKey);

	/** Authored Y-up, drawn Y-down. Negating here rather than transforming the
	 *  whole `<svg>` keeps the viewBox centred on the mark at every size. */
	const path = (plate: [number, number][]) =>
		plate.map(([x, y]) => `${x.toFixed(3)},${(-y).toFixed(3)}`).join(' ');
</script>

<span class="badge" title="{name} · {side}" style:--tone={tone}>
	<svg width={size} height={size} viewBox="-1.15 -1.15 2.3 2.3" aria-label="{name} badge">
		<!-- The plate the mark is struck on, so a badge reads as a badge and not
		     as a loose glyph floating in the row. -->
		<circle cx="0" cy="0" r="1.1" class="field" />
		{#each plates as plate, i (i)}
			<polygon points={path(plate)} class="mark" />
		{/each}
	</svg>
	{#if label}<span class="name">{name}</span>{/if}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		vertical-align: middle;
	}
	svg {
		display: block;
		flex: none;
		overflow: visible;
	}
	.field {
		fill: color-mix(in srgb, var(--tone) 16%, transparent);
		stroke: color-mix(in srgb, var(--tone) 55%, transparent);
		stroke-width: 0.08;
	}
	.mark {
		fill: var(--tone);
	}
	.name {
		font-family: var(--mono);
		font-size: 0.52rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
		white-space: nowrap;
	}
</style>
