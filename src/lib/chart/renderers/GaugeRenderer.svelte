<script lang="ts">
	// A value against a scale, drawn as a banded arc.
	//
	// It is a chart type rather than a standalone component because everything it
	// needs is already in `ChartConfig` and means the same thing there: the
	// reading is a series point, the scale is `yAxis.domain`, and the marked
	// values — a pass gate, a peer median, an SLA — are `annotations`, which is
	// exactly what an annotation is everywhere else in this library.
	//
	// It is NOT a progress ring. `RadialProgress` answers "how far along"; this
	// answers "where does this sit on a scale somebody else defined", and the
	// bands and ticks are that somebody else's opinion made visible.
	import { getChartCtx } from '../chart-context.js';
	import {
		gaugeArcPath,
		gaugeFilled,
		gaugeFrac,
		gaugePoint,
		gaugeSegments
	} from '../gauge-geometry.js';
	import type { GaugeBand } from '../chart.types.js';

	const ctx = getChartCtx();

	const gauge = $derived(ctx.config.gauge ?? {});
	const sweep = $derived(gauge.sweep ?? 240);
	const start = $derived(gauge.startAngle ?? 150);

	const domain = $derived((ctx.config.yAxis?.domain as [number, number]) ?? [0, 100]);
	const lo = $derived(Number(domain[0]));
	const hi = $derived(Number(domain[1]));
	const spanOf = $derived(hi - lo || 1);
	/** Domain value → 0–1 along the arc, clamped so an out-of-range reading
	 *  pins to an end rather than sweeping off the dial. */
	const frac = (v: number) => Math.max(0, Math.min(1, (v - lo) / spanOf));

	const series = $derived(ctx.config.series.filter((s) => ctx.visibleSeries.has(s.id)));
	const value = $derived(series[0]?.points[0]?.y ?? lo);

	// Square, centred in whatever box the chart was given: an arc in a wide box
	// should grow no larger than the box is tall.
	const box = $derived(Math.min(ctx.inner.w, ctx.inner.h));
	const cx = $derived(ctx.inner.w / 2);
	const cy = $derived(ctx.inner.h / 2 + box * 0.06);
	const track = $derived(gauge.thickness ?? Math.max(6, Math.round(box * 0.085)));
	// Leaves room for tick labels, which sit outside the arc — a radius sized to
	// the box clips the very numbers the ticks exist to show.
	const rOuter = $derived(Math.max(track + 2, box / 2 - Math.round(box * 0.11)));
	const rMid = $derived(rOuter - track / 2);

	const angle = (t: number) => ((start + t * sweep) * Math.PI) / 180;
	const pt = (t: number, r: number): [number, number] => [
		cx + r * Math.cos(angle(t)),
		cy + r * Math.sin(angle(t))
	];

	function arc(t0: number, t1: number, r: number): string {
		const [x0, y0] = pt(t0, r);
		const [x1, y1] = pt(t1, r);
		const large = (t1 - t0) * sweep > 180 ? 1 : 0;
		return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
	}

	const DEFAULT_BANDS: GaugeBand[] = [{ to: Number.POSITIVE_INFINITY, color: 'var(--accent)' }];

	// Bands as [from, to] fractions. Declared by upper bound, so each one starts
	// where the last stopped and the scale cannot end up with gaps or overlaps.
	const segments = $derived.by(() => {
		const bands = gauge.bands?.length ? gauge.bands : DEFAULT_BANDS;
		let cursor = lo;
		return bands.map((b) => {
			const from = cursor;
			const to = Math.min(b.to, hi);
			cursor = to;
			return { from: frac(from), to: frac(to), color: b.color, label: b.label };
		});
	});

	const v = $derived(frac(Number(value)));
	const filled = $derived(
		segments.map((s) => ({ ...s, to: Math.min(s.to, v) })).filter((s) => s.to > s.from)
	);

	// Marked values ride the same scale. `type: 'line'` only — a band or a label
	// annotation has no meaning on an arc, and silently drawing one as a tick
	// would misreport it.
	const ticks = $derived(
		(ctx.config.annotations ?? [])
			.filter((a) => a.axis === 'y' && a.type === 'line' && typeof a.value === 'number')
			.map((a) => {
				const t = frac(a.value as number);
				return {
					t,
					color: a.color ?? 'var(--accent)',
					label: a.label,
					inner: pt(t, rOuter - track - 1),
					outer: pt(t, rOuter + 3),
					text: pt(t, rOuter + Math.round(box * 0.075))
				};
			})
	);

	const needle = $derived(gauge.needle !== false);
	const showValue = $derived(gauge.showValue !== false);
	const unit = $derived(ctx.config.yAxis?.unit ?? '');
	const reading = $derived(Number(value).toFixed(gauge.precision ?? 0));

	const valueSize = $derived(Math.round(box * 0.26));
	const labelSize = $derived(Math.round(box * 0.055));
	const tickSize = $derived(Math.round(box * 0.05));
</script>

{#if box > 0}
	<!-- The scale, dim: it is the ruler, not the reading. -->
	{#each segments as s, i (i)}
		{#if s.to > s.from}
			<path
				d={arc(s.from, s.to, rMid)}
				fill="none"
				stroke={s.color}
				stroke-width={track}
				opacity="0.22"
			>
				{#if s.label}<title>{s.label}</title>{/if}
			</path>
		{/if}
	{/each}

	<!-- The reading, one segment per band it has passed through. -->
	{#each filled as s, i (i)}
		<path d={arc(s.from, s.to, rMid)} fill="none" stroke={s.color} stroke-width={track} />
	{/each}

	{#each ticks as tick, i (i)}
		<line
			x1={tick.inner[0]}
			y1={tick.inner[1]}
			x2={tick.outer[0]}
			y2={tick.outer[1]}
			stroke={tick.color}
			stroke-width="2"
		/>
		{#if tick.label}
			<text
				x={tick.text[0]}
				y={tick.text[1]}
				fill={tick.color}
				font-size={tickSize}
				font-family="var(--mono)"
				text-anchor="middle"
				dominant-baseline="middle">{tick.label}</text
			>
		{/if}
	{/each}

	{#if needle}
		<!-- The arc alone leaves the eye to guess where a thick stroke ends. -->
		<line
			x1={pt(v, rOuter - track - 4)[0]}
			y1={pt(v, rOuter - track - 4)[1]}
			x2={pt(v, rOuter + 1)[0]}
			y2={pt(v, rOuter + 1)[1]}
			stroke="var(--fg)"
			stroke-width="2.5"
		/>
	{/if}

	{#if showValue}
		<text
			x={cx}
			y={cy - box * 0.02}
			fill="var(--fg)"
			font-size={valueSize}
			font-family="var(--mono)"
			font-weight="700"
			text-anchor="middle"
			dominant-baseline="middle">{reading}{unit}</text
		>
		{#if gauge.label}
			<text
				x={cx}
				y={cy + box * 0.15}
				fill="var(--fg-dim)"
				font-size={labelSize}
				font-family="var(--mono)"
				letter-spacing="1.5"
				text-anchor="middle"
				dominant-baseline="middle">{gauge.label}</text
			>
		{/if}
	{/if}
{/if}
