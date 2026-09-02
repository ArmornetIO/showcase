<script lang="ts">
	/**
	 * The arrows between components — flow, data paths, "this opens that".
	 *
	 * Drawn as one SVG in canvas coordinates and positioned by the same world
	 * transform as the items, so a connector needs no transform maths of its own:
	 * it reads item rects straight out of the store and re-routes whenever either
	 * end moves, because the path is DERIVED from positions rather than stored.
	 *
	 * Routing is a horizontal-first cubic between the two nearest edge midpoints.
	 * Not orthogonal routing with obstacle avoidance — that is a real algorithm
	 * with real failure modes, and a curve between the facing sides reads as
	 * "A goes to B" without pretending to be a wiring diagram.
	 */
	import { builder } from './store.svelte.js';
	import type { CanvasConnector, CanvasItem } from './store.svelte.js';

	let { interactive = true }: { interactive?: boolean } = $props();

	/** Auto-sized items report 0; hit-testing and routing share this fallback. */
	function rectOf(item: CanvasItem) {
		const w = item.w || 120;
		const h = item.h || 60;
		return { x: item.x, y: item.y, w, h, cx: item.x + w / 2, cy: item.y + h / 2 };
	}

	function endpoint(end: string | { x: number; y: number }) {
		if (typeof end !== 'string') return { ...end, w: 0, h: 0, cx: end.x, cy: end.y };
		const item = builder.items.find((i) => i.id === end);
		return item && item.visible ? rectOf(item) : null;
	}

	type Anchored = { x: number; y: number; side: 'l' | 'r' | 't' | 'b' };

	/** Leave from whichever side actually faces the other end — an arrow that
	 *  exits the left edge to travel right reads as a mistake. */
	function anchor(
		from: { x: number; y: number; w: number; h: number; cx: number; cy: number },
		to: { cx: number; cy: number }
	): Anchored {
		const dx = to.cx - from.cx;
		const dy = to.cy - from.cy;
		if (Math.abs(dx) >= Math.abs(dy)) {
			return dx >= 0
				? { x: from.x + from.w, y: from.cy, side: 'r' }
				: { x: from.x, y: from.cy, side: 'l' };
		}
		return dy >= 0
			? { x: from.cx, y: from.y + from.h, side: 'b' }
			: { x: from.cx, y: from.y, side: 't' };
	}

	function bend(a: Anchored, b: Anchored): string {
		const dist = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
		const c1 =
			a.side === 'r'
				? [a.x + dist, a.y]
				: a.side === 'l'
					? [a.x - dist, a.y]
					: a.side === 'b'
						? [a.x, a.y + dist]
						: [a.x, a.y - dist];
		const c2 =
			b.side === 'r'
				? [b.x + dist, b.y]
				: b.side === 'l'
					? [b.x - dist, b.y]
					: b.side === 'b'
						? [b.x, b.y + dist]
						: [b.x, b.y - dist];
		return `M ${a.x} ${a.y} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${b.x} ${b.y}`;
	}

	interface Routed {
		conn: CanvasConnector;
		d: string;
		mid: { x: number; y: number };
		angle: number;
		head: { x: number; y: number };
	}

	const routed = $derived.by(() => {
		const out: Routed[] = [];
		for (const conn of builder.connectors) {
			if (!conn.visible) continue;
			const from = endpoint(conn.fromId);
			const to = endpoint(conn.toId);
			if (!from || !to) continue;
			const a = anchor(from, to);
			const b = anchor(to, from);
			out.push({
				conn,
				d: bend(a, b),
				mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
				// The head points along the final approach, which is the anchor's
				// own side — the curve arrives perpendicular to the edge it meets.
				angle: b.side === 'l' ? 0 : b.side === 'r' ? 180 : b.side === 't' ? 90 : 270,
				head: { x: b.x, y: b.y }
			});
		}
		return out;
	});

	const DASH: Record<string, string | undefined> = {
		solid: undefined,
		dashed: '8 6',
		dotted: '2 5'
	};
</script>

<!-- Sized to the canvas rather than to its parent: the world wrapper is a
     transform host whose own box is 0×0, and an SVG with no extent clips its
     contents away however far outside they are drawn. -->
<svg
	class="conn-layer"
	class:conn-layer--interactive={interactive}
	width={builder.canvasW}
	height={builder.canvasH}
	aria-hidden="true"
>
	{#each routed as r (r.conn.id)}
		{@const selected = builder.selectedConnectorId === r.conn.id}
		<g class="conn" class:conn--selected={selected}>
			<!-- A 1px curve is nearly impossible to hit, so a fat invisible twin
			     carries the pointer events. -->
			{#if interactive && !r.conn.locked}
				<path
					class="conn-hit"
					d={r.d}
					role="button"
					tabindex="-1"
					onpointerdown={(e) => {
						e.stopPropagation();
						builder.selectConnector(r.conn.id);
					}}
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => {
						if (e.key === 'Delete' || e.key === 'Backspace') builder.deleteConnector(r.conn.id);
					}}
				/>
			{/if}
			<!-- Colours go through `style:`, not presentation attributes: a
			     presentation attribute does not resolve `var(--accent)`, so an
			     attribute-coloured line silently fell back to no stroke at all. -->
			<path class="conn-line" d={r.d} style:stroke={r.conn.color} stroke-dasharray={DASH[r.conn.style]} />
			{#if r.conn.arrowHead !== 'none'}
				<path
					class="conn-head"
					d="M 0 0 L 10 4 L 10 -4 Z"
					style:fill={r.conn.arrowHead === 'open' ? 'none' : r.conn.color}
					style:stroke={r.conn.color}
					transform="translate({r.head.x},{r.head.y}) rotate({r.angle})"
				/>
			{/if}
			{#if r.conn.label}
				<text class="conn-label" x={r.mid.x} y={r.mid.y - 6} style:fill={r.conn.color}>
					{r.conn.label}
				</text>
			{/if}
		</g>
	{/each}
</svg>

<style>
	.conn-layer {
		position: absolute;
		left: 0;
		top: 0;
		overflow: visible;
		/* Below items by default; the hit paths opt back in individually so a
		   connector never blocks a click meant for a component. */
		pointer-events: none;
		z-index: 0;
	}
	.conn-layer--interactive .conn-hit {
		pointer-events: stroke;
	}

	.conn-line {
		fill: none;
		stroke-width: 1.5;
		stroke-linecap: round;
	}
	.conn-hit {
		fill: none;
		stroke: transparent;
		stroke-width: 14;
		cursor: pointer;
	}
	.conn--selected .conn-line {
		stroke-width: 2.5;
	}
	.conn--selected .conn-head {
		stroke-width: 2;
	}

	.conn-head {
		stroke-width: 1.5;
		stroke-linejoin: round;
	}

	.conn-label {
		font-family: var(--mono);
		font-size: 10px;
		text-anchor: middle;
		paint-order: stroke;
		stroke: var(--bg);
		stroke-width: 4;
	}
</style>
