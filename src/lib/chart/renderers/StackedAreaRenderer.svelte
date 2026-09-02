<script lang="ts">
	import { getChartCtx } from '../chart-context.js';
	import { seriesColor } from '../chart.types.js';
	import { toNumber } from '../chart-scales.js';

	const ctx = getChartCtx();

	// Active stacked-area series in declaration order (bottom → top visually)
	const activeSeries = $derived(
		ctx.config.series.filter(
			(s) => ctx.visibleSeries.has(s.id) && (s.type ?? ctx.config.type) === 'stacked-area'
		)
	);

	// Sorted unique x-values across all active series
	const sortedXVals = $derived((): number[] => {
		const set = new Set<number>();
		for (const s of activeSeries) {
			for (const p of s.points) {
				set.add(toNumber(p.x));
			}
		}
		return Array.from(set).sort((a, b) => a - b);
	});

	// For each series, a Map from xVal → y (0 if not present)
	const seriesYMaps = $derived(
		activeSeries.map((s) => {
			const m = new Map<number, number>();
			for (const p of s.points) {
				m.set(toNumber(p.x), p.y);
			}
			return m;
		})
	);

	// Stacked layout: baseline[i][xIdx] and stackedTop[i][xIdx]
	// baseline[0] = 0 everywhere; baseline[i] = sum of y for series 0..i-1
	const stackedLayout = $derived((): Array<{ baseline: number[]; top: number[] }> => {
		const xVals = sortedXVals();
		const result: Array<{ baseline: number[]; top: number[] }> = [];
		// running cumulative y per x position
		const cumulative = new Array<number>(xVals.length).fill(0);

		for (let i = 0; i < activeSeries.length; i++) {
			const yMap = seriesYMaps[i];
			const baseline = cumulative.slice(); // snapshot before adding this series
			const top = xVals.map((xVal, xi) => baseline[xi] + (yMap.get(xVal) ?? 0));
			// advance cumulative
			for (let xi = 0; xi < xVals.length; xi++) {
				cumulative[xi] = top[xi];
			}
			result.push({ baseline, top });
		}
		return result;
	});

	// Pixel paths per series: { fillPath, linePath }
	const pixelPaths = $derived((): Array<{ fillPath: string; linePath: string }> => {
		const xVals = sortedXVals();
		const layout = stackedLayout();

		return activeSeries.map((_, i) => {
			const { baseline, top } = layout[i];

			// Top-edge pixel points (forward)
			const topPts: [number, number][] = xVals.map((xVal, xi) => [
				ctx.scaleX(xVal),
				ctx.scaleY(top[xi])
			]);

			// Bottom-edge pixel points (reverse)
			const botPtsReversed: [number, number][] = xVals
				.map((xVal, xi): [number, number] => [ctx.scaleX(xVal), ctx.scaleY(baseline[xi])])
				.reverse();

			if (topPts.length === 0) return { fillPath: '', linePath: '' };

			// Closed polygon for fill
			const fillPath =
				`M ${topPts[0][0].toFixed(1)} ${topPts[0][1].toFixed(1)}` +
				topPts
					.slice(1)
					.map(([x, y]) => ` L ${x.toFixed(1)} ${y.toFixed(1)}`)
					.join('') +
				botPtsReversed.map(([x, y]) => ` L ${x.toFixed(1)} ${y.toFixed(1)}`).join('') +
				' Z';

			// Open line for top edge stroke only
			const linePath =
				`M ${topPts[0][0].toFixed(1)} ${topPts[0][1].toFixed(1)}` +
				topPts
					.slice(1)
					.map(([x, y]) => ` L ${x.toFixed(1)} ${y.toFixed(1)}`)
					.join('');

			return { fillPath, linePath };
		});
	});
</script>

{#each activeSeries as s, i (s.id)}
	{@const color = seriesColor(i, s.color)}
	{@const hovered = ctx.hover.series?.id === s.id}
	{@const paths = pixelPaths()[i]}
	{#if paths.fillPath}
		<!-- Filled polygon -->
		<path
			d={paths.fillPath}
			fill="{color}{hovered ? '55' : '30'}"
			stroke="none"
		/>
		<!-- Top-edge stroke -->
		<path
			d={paths.linePath}
			fill="none"
			stroke={color}
			stroke-width="1.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	{/if}
{/each}
