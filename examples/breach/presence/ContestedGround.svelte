<script lang="ts">
	// ── Mode: contested ground ───────────────────────────────────────────────────
	// The board's own thesis, drawn.
	//
	// `rules.ts` says the Outlands is "where the game actually happens", and on
	// screen it currently looks exactly like the other four regions. This mode
	// makes pressure visible: how hard each territory is being leaned on, and —
	// the part that matters — by how many sides. A region both factions are
	// working is a knife fight and should read as one.
	//
	// People are implied here rather than named, which is what lets this mode
	// carry the traffic the trails mode is not allowed to.
	//
	// ── Fog ──────────────────────────────────────────────────────────────────────
	// This is the home of ANONYMOUS pressure. The heat tells blue receives name a
	// region and refuse to name a seat, and they land here as an unattributed
	// ring — visibly a different thing from the seat-coloured arcs beside it.
	// "Something is happening in the Commons" and "the Hunter is in the Commons"
	// must never render as the same mark, and the whole design of this component
	// is that separation.
	import { TERRITORIES } from '../internal/rules.js';
	import type { PresenceModel } from '../internal/presence.js';
	import type { TerritoryAnchor } from './anchors.js';

	interface Props {
		model: PresenceModel;
		anchors: TerritoryAnchor[];
		width: number;
		height: number;
	}

	let { model, anchors, width, height }: Props = $props();

	const regions = $derived(
		model.pressure
			.map((p) => {
				const a = anchors.find((x) => x.territory === p.territory);
				return a && p.total > 0.02 ? { p, a } : null;
			})
			.filter((r): r is NonNullable<typeof r> => !!r)
	);

	/** Attributed weight, split into arcs around the region — one per seat, sized
	 *  by their share. A stacked ring rather than four separate rings, because
	 *  the question is "who has the most of this region", which is a comparison. */
	function arcs(bySeat: Record<string, number>, a: TerritoryAnchor, radius: number) {
		const entries = Object.entries(bySeat);
		const sum = entries.reduce((t, [, w]) => t + w, 0);
		if (sum <= 0) return [];
		let cursor = -Math.PI / 2;
		return entries.map(([key, w]) => {
			const sweep = (w / sum) * Math.PI * 2;
			const from = cursor;
			cursor += sweep;
			const seat = model.seats.find((s) => s.key === key);
			const large = sweep > Math.PI ? 1 : 0;
			const x1 = a.x + Math.cos(from) * radius;
			const y1 = a.y + Math.sin(from) * radius;
			const x2 = a.x + Math.cos(cursor) * radius;
			const y2 = a.y + Math.sin(cursor) * radius;
			return {
				key,
				color: seat?.color ?? 'var(--fg-dim)',
				// A full circle cannot be expressed as an arc — degenerate to a
				// closed ring when one seat owns the whole region.
				full: sweep >= Math.PI * 1.999,
				d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`
			};
		});
	}
</script>

<svg class="absolute inset-0 pointer-events-none" {width} {height} aria-hidden="true">
	{#each regions as { p, a } (p.territory)}
		{@const tint = TERRITORIES[p.territory].color}
		{@const ring = a.r * (0.55 + 0.3 * p.total)}
		<g opacity={a.facing}>
			<!-- The region's own weather. Sized by total pressure so a quiet region
			     is a whisper and a fought-over one fills its ground. -->
			<circle
				cx={a.x}
				cy={a.y}
				r={ring}
				fill="color-mix(in srgb, {tint} {Math.round(4 + p.total * 9)}%, transparent)"
				stroke={p.contested ? tint : 'transparent'}
				stroke-width="1"
				stroke-dasharray="1 5"
				opacity="0.8"
			/>

			<!-- Attributed share, per seat. -->
			{#each arcs(p.bySeat, a, ring + 5) as arc (arc.key)}
				{#if arc.full}
					<circle
						cx={a.x}
						cy={a.y}
						r={ring + 5}
						fill="none"
						stroke={arc.color}
						stroke-width="2.5"
						opacity="0.7"
					/>
				{:else}
					<path
						d={arc.d}
						fill="none"
						stroke={arc.color}
						stroke-width="2.5"
						stroke-linecap="round"
						opacity="0.7"
					/>
				{/if}
			{/each}

			<!-- Unattributed pressure, held deliberately apart from the arcs: no
			     seat colour, dashed, and further out. This is the shape of not
			     knowing, and it must not be mistakeable for someone. -->
			{#if p.anonymous > 0.02}
				<circle
					cx={a.x}
					cy={a.y}
					r={ring + 12}
					fill="none"
					stroke="var(--fg-dim)"
					stroke-width="1.2"
					stroke-dasharray="4 6"
					opacity={Math.min(0.65, 0.25 + p.anonymous)}
				/>
			{/if}

			<!-- Two sides are here. The one label this mode earns. -->
			{#if p.contested}
				<text
					x={a.x}
					y={a.y - ring - 16}
					text-anchor="middle"
					class="font-mono"
					font-size="7"
					letter-spacing="1.4"
					fill={tint}
					opacity="0.85"
				>
					CONTESTED
				</text>
			{/if}
		</g>
	{/each}
</svg>
