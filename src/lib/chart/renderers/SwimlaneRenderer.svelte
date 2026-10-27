<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor, type ChartPoint, type ChartSeries, type SwimlaneLink } from '../chart.types.js';
	import { defaultFormat, generateLinearTicks, linearScale, toNumber } from '../chart-scales.js';

	const ctx = getChartCtx();

	const BAR_H = 26;
	const markerId = 'sl-' + Math.random().toString(36).slice(2, 7);

	const lanes = $derived(
		ctx.config.series
			.map((s, i) => ({ s, color: seriesColor(i, s.color) }))
			.filter(({ s }) => ctx.visibleSeries.has(s.id))
	);
	const laneIdx = $derived(new Map(lanes.map(({ s }, i) => [s.id, i])));
	const laneH = $derived(lanes.length ? ctx.inner.h / lanes.length : 0);
	const barH = $derived(Math.min(BAR_H, laneH * 0.6));

	const links = $derived(
		(ctx.config.links ?? []).filter((l) => laneIdx.has(l.from.lane) && laneIdx.has(l.to.lane))
	);

	// A span's end and a link's ends are x values too, so they widen the domain;
	// the shared inferXDomain only reads p.x and would clip the last span.
	const domain = $derived.by((): [number, number] => {
		const d = ctx.config.xAxis?.domain;
		if (d) return [toNumber(d[0]), toNumber(d[1])];
		const xs: number[] = [];
		for (const { s } of lanes) {
			for (const p of s.points) {
				xs.push(toNumber(p.x));
				if (p.x1 !== undefined) xs.push(toNumber(p.x1));
			}
		}
		for (const l of links) xs.push(toNumber(l.from.x), toNumber(l.to.x));
		return xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1];
	});
	const sx = $derived(linearScale(domain, [0, ctx.inner.w]));

	const ticks = $derived.by(() => {
		const t = ctx.config.xAxis?.ticks;
		return Array.isArray(t) ? t.map((v) => toNumber(v)) : generateLinearTicks(domain, t ?? 6);
	});
	function fmt(v: number | Date) {
		const f = ctx.config.xAxis?.format;
		return f ? f(v) : defaultFormat(v, ctx.config.xAxis?.unit);
	}

	const mid = (i: number) => i * laneH + laneH / 2;

	// A handoff leaves the bar edge facing its target, so arrows never cross
	// their own bar.
	function linkPath(l: SwimlaneLink) {
		const a = laneIdx.get(l.from.lane)!;
		const b = laneIdx.get(l.to.lane)!;
		const dir = b > a ? 1 : -1;
		const x0 = sx(l.from.x);
		const x1 = sx(l.to.x);
		const y0 = mid(a) + (dir * barH) / 2;
		const y1 = mid(b) - dir * (barH / 2 + 4);
		const k = (y1 - y0) * 0.5;
		return `M${x0},${y0} C${x0},${y0 + k} ${x1},${y1 - k} ${x1},${y1}`;
	}

	let hovered = $state<string | null>(null);
	function enter(key: string, s: ChartSeries, p: ChartPoint) {
		hovered = key;
		ctx.hover.series = s;
		ctx.hover.point = p;
	}
	function leave() {
		hovered = null;
		ctx.hover.series = null;
		ctx.hover.point = null;
	}
</script>

<defs>
	<marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
		<path d="M0,0 L8,4 L0,8 z" class="arrow-head" />
	</marker>
</defs>

{#each ticks as t (t)}
	<line class="grid" x1={sx(t)} x2={sx(t)} y1={-6} y2={ctx.inner.h} />
	<text class="tick" x={sx(t)} y={-12}>{fmt(t)}</text>
{/each}

{#each lanes as { s, color }, i (s.id)}
	<rect class="lane-bg" class:odd={i % 2 === 1} x={-ctx.pad.left} y={i * laneH} width={ctx.pad.left + ctx.inner.w + ctx.pad.right} height={laneH} />
	<rect x={-ctx.pad.left} y={i * laneH + 8} width="3" height={Math.max(laneH - 16, 0)} style:fill={color} />
	<text class="lane-label" x={-ctx.pad.left + 16} y={mid(i) + 4}>{s.label}</text>
{/each}

{#each links as l, j (j)}
	<path class="link" d={linkPath(l)} stroke-dasharray={l.dashArray} marker-end="url(#{markerId})" />
	{#if l.label}
		<text
			class="link-label"
			x={(sx(l.from.x) + sx(l.to.x)) / 2 + 6}
			y={(mid(laneIdx.get(l.from.lane)!) + mid(laneIdx.get(l.to.lane)!)) / 2 + 3}
		>{l.label}</text>
	{/if}
{/each}

{#each lanes as { s, color }, i (s.id)}
	{#each s.points as p, k (k)}
		{@const key = `${s.id}:${k}`}
		{@const x = sx(p.x)}
		{@const y = mid(i)}
		<g
			class="span"
			class:dim={hovered !== null && hovered !== key}
			role="presentation"
			onmouseenter={() => enter(key, s, p)}
			onmouseleave={leave}
		>
			{#if p.x1 !== undefined}
				<rect
					{x}
					y={y - barH / 2}
					width={Math.max(sx(p.x1) - x, 4)}
					height={barH}
					rx="3"
					style:fill="color-mix(in srgb, {color} 20%, transparent)"
					style:stroke={color}
				/>
				<text class="span-label" x={x + 8} y={y + 4}>{p.label}</text>
				<title>{s.label} · {p.label} · {fmt(toNumber(p.x))}–{fmt(toNumber(p.x1))}</title>
			{:else}
				<path d="M{x},{y - 8} L{x + 8},{y} L{x},{y + 8} L{x - 8},{y} z" style:fill={color} />
				<text class="span-label" x={x + 12} y={y + 4}>{p.label}</text>
				<title>{s.label} · {p.label} · {fmt(toNumber(p.x))}</title>
			{/if}
		</g>
	{/each}
{/each}

<style>
	.lane-bg {
		fill: transparent;
	}
	.lane-bg.odd {
		fill: color-mix(in srgb, var(--fg) 3%, transparent);
	}
	.lane-label {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		fill: var(--fg-muted);
	}
	.grid {
		stroke: var(--border);
		stroke-dasharray: 2 4;
	}
	.tick {
		font-size: 10px;
		fill: var(--fg-dim);
		text-anchor: middle;
	}
	.span {
		transition: opacity 120ms;
		cursor: default;
	}
	.span.dim {
		opacity: 0.35;
	}
	.span rect {
		stroke-width: 1;
	}
	.span-label {
		font-size: 11px;
		fill: var(--fg);
		pointer-events: none;
	}
	.link {
		fill: none;
		stroke: var(--fg-dim);
		stroke-width: 1.25;
	}
	.arrow-head {
		fill: var(--fg-dim);
	}
	.link-label {
		font-size: 10px;
		fill: var(--fg-dim);
		font-style: italic;
	}
</style>
