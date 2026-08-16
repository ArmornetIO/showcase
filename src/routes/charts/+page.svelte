<script lang="ts">
	import Chart from '$lib/chart/Chart.svelte';
	import DonutChart from '$lib/chart/DonutChart.svelte';
	import type { DonutSlice } from '$lib/chart/DonutChart.svelte';
	import type { ChartConfig } from '$lib/chart/chart.types.js';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';

	// ── Line + gradient (traffic volume use case) ─────────────────────────────

	const now = Date.now();
	const hourMs = 3_600_000;
	const HOURS = Array.from({ length: 24 }, (_, i) => i);

	const TRAFFIC = [5120, 4830, 4210, 3940, 3610, 4020, 5180, 6340, 7210, 7890, 8120, 7640, 7980, 8210, 7830, 7440, 6920, 6540, 6230, 5980, 5710, 5490, 5340, 5210];
	const BLOCKED = [0, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0];
	const WARNED =  [0, 1, 0, 0, 1, 0, 2, 1, 3, 2, 1, 0, 2, 1, 0, 1, 2, 1, 1, 2, 0, 1, 0, 1];

	const lineGradientConfig: ChartConfig = {
		type: 'line',
		series: [
			{
				id: 'requests',
				label: 'Requests',
				points: HOURS.map((h) => ({ x: h, y: TRAFFIC[h] })),
				area: true,
				smooth: true,
				gradient: [
					{ t: 0.0, color: '#38BDF8', opacity: 0.5 },
					{ t: 0.3, color: '#5FEAD5', opacity: 0.9 },
					{ t: 0.5, color: '#22D3EE', opacity: 1.0 },
					{ t: 0.7, color: '#C4A8FF', opacity: 0.9 },
					{ t: 1.0, color: '#38BDF8', opacity: 0.5 },
				],
				areaColor: [
					{ t: 0, color: '#38BDF8', opacity: 0.03 },
					{ t: 0.5, color: '#22D3EE', opacity: 0.14 },
					{ t: 1, color: '#38BDF8', opacity: 0.03 },
				],
				strokeWidth: 2,
			},
			{
				id: 'blocked',
				label: 'Blocked',
				points: HOURS.map((h) => ({ x: h, y: BLOCKED[h] })),
				pointColor: (p) => p.y > 0 ? '#FB923C' : 'transparent',
				color: '#FB923C',
				strokeWidth: 0,
				pointRadius: 5,
			},
		],
		xAxis: { ticks: 6, format: (v) => `${v}h` },
		yAxis: { grid: true, unit: 'req' },
		legend: { position: 'top' },
		crosshair: true,
	};

	let lineVisible = $state(new Set(['requests', 'blocked']));

	// ── Multi-series smooth line ───────────────────────────────────────────────

	const multiLineConfig: ChartConfig = {
		type: 'line',
		series: [
			{
				id: 'p50',
				label: 'p50',
				points: HOURS.map((h) => ({ x: h, y: 12 + Math.sin(h * 0.4) * 4 + h * 0.3 })),
				color: '#38BDF8',
				smooth: true,
				strokeWidth: 1.5,
			},
			{
				id: 'p95',
				label: 'p95',
				points: HOURS.map((h) => ({ x: h, y: 28 + Math.sin(h * 0.4 + 1) * 8 + h * 0.5 })),
				color: '#C4A8FF',
				smooth: true,
				strokeWidth: 1.5,
			},
			{
				id: 'p99',
				label: 'p99',
				points: HOURS.map((h) => ({ x: h, y: 55 + Math.cos(h * 0.3) * 12 + h * 0.8 })),
				color: '#FB923C',
				smooth: true,
				strokeWidth: 1.5,
				dashArray: '4,3',
			},
		],
		xAxis: { ticks: 6, format: (v) => `${v}h` },
		yAxis: { grid: true, unit: 'ms' },
		legend: { position: 'top' },
		crosshair: true,
		annotations: [
			{ type: 'line', axis: 'y', value: 50, color: '#FB923C', label: 'SLO', dashArray: '4,2', opacity: 0.6 },
		],
	};

	let multiLineVisible = $state(new Set(['p50', 'p95', 'p99']));

	// ── Bar chart ─────────────────────────────────────────────────────────────

	const ECOSYSTEMS = [0, 1, 2, 3, 4, 5];
	const ECO_LABELS = ['go', 'npm', 'pip', 'docker', 'git', 'apt'];

	const barConfig: ChartConfig = {
		type: 'grouped-bar',
		series: [
			{
				id: 'requests',
				label: 'Requests',
				points: ECOSYSTEMS.map((i) => ({ x: i, y: [3070, 1950, 140, 0, 190, 80][i] })),
				color: '#38BDF8',
			},
			{
				id: 'blocked',
				label: 'Blocked',
				points: ECOSYSTEMS.map((i) => ({ x: i, y: [5, 8, 0, 0, 0, 1][i] })),
				color: '#FB923C',
			},
		],
		xAxis: { format: (v) => ECO_LABELS[v as number] ?? String(v) },
		yAxis: { grid: true },
		legend: { position: 'top' },
	};

	let barVisible = $state(new Set(['requests', 'blocked']));

	// ── Stacked bar ───────────────────────────────────────────────────────────

	const stackedBarConfig: ChartConfig = {
		type: 'stacked-bar',
		series: [
			{
				id: 'clean',
				label: 'Clean',
				points: ECOSYSTEMS.map((i) => ({ x: i, y: [3065, 1942, 140, 0, 190, 79][i] })),
				color: '#4ADE80',
			},
			{
				id: 'warned',
				label: 'Warned',
				points: ECOSYSTEMS.map((i) => ({ x: i, y: [0, 5, 0, 0, 0, 0][i] })),
				color: '#FBBF24',
			},
			{
				id: 'blocked2',
				label: 'Blocked',
				points: ECOSYSTEMS.map((i) => ({ x: i, y: [5, 8, 0, 0, 0, 1][i] })),
				color: '#FB923C',
			},
		],
		xAxis: { format: (v) => ECO_LABELS[v as number] ?? String(v) },
		yAxis: { grid: true },
		legend: { position: 'top' },
	};

	let stackedVisible = $state(new Set(['clean', 'warned', 'blocked2']));

	// ── Scatter ───────────────────────────────────────────────────────────────

	const scatterConfig: ChartConfig = {
		type: 'scatter',
		series: [
			{
				id: 'packages',
				label: 'Package scan',
				points: Array.from({ length: 60 }, (_, i) => ({
					x: Math.random() * 100,
					y: Math.random() * 10,
					meta: { risk: Math.random() },
				})),
				pointColor: (p) => {
					const risk = (p.meta?.risk as number) ?? 0;
					if (risk > 0.8) return '#FB923C';
					if (risk > 0.5) return '#FBBF24';
					return '#4ADE80';
				},
				pointRadius: 4,
			},
		],
		xAxis: { label: 'Activity Score', grid: true },
		yAxis: { label: 'Severity', grid: true },
		legend: { position: 'none' },
	};

	let scatterVisible = $state(new Set(['packages']));

	// ── DonutChart ────────────────────────────────────────────────────────────

	const dataExposureSlices: DonutSlice[] = [
		{ label: 'Confidential', value: 47, color: '#FB923C', haloRgb: '251,146,60' },
		{ label: 'PII',          value: 46, color: 'var(--red)',          haloRgb: '251,113,133' },
		{ label: 'Internal',     value: 16, color: '#94A3B8',             haloRgb: '148,163,184' },
		{ label: 'PCI',          value: 16, color: 'var(--amber)',        haloRgb: '252,211,77' },
	];

	const vendorCriticalitySlices: DonutSlice[] = [
		{ label: 'Critical', value: 50, color: 'var(--red)',           haloRgb: '251,113,133' },
		{ label: 'High',     value: 25, color: 'var(--amber)',         haloRgb: '252,211,77' },
		{ label: 'Medium',   value: 25, color: 'var(--accent-emerald)', haloRgb: '52,211,153' },
		{ label: 'Low',      value: 25, color: '#94A3B8',              haloRgb: '148,163,184' },
	];

	// ── Pie ───────────────────────────────────────────────────────────────────

	const pieConfig: ChartConfig = {
		type: 'pie',
		series: [
			{ id: 'go',     label: 'Go',     points: [{ x: 0, y: 3070 }], color: '#38BDF8' },
			{ id: 'npm',    label: 'npm',    points: [{ x: 0, y: 1950 }], color: '#C4A8FF' },
			{ id: 'pip',    label: 'pip',    points: [{ x: 0, y: 140 }],  color: '#4ADE80' },
			{ id: 'git',    label: 'git',    points: [{ x: 0, y: 190 }],  color: '#FBBF24' },
			{ id: 'docker', label: 'Docker', points: [{ x: 0, y: 80 }],   color: '#FB923C' },
		],
		legend: { position: 'bottom', layout: 'horizontal' },
	};
	let pieVisible = $state(new Set(['go', 'npm', 'pip', 'git', 'docker']));

	// ── Radar ─────────────────────────────────────────────────────────────────

	const radarAxes = ['Latency', 'Throughput', 'Error Rate', 'Coverage', 'Trust Score', 'Isolation'];

	const radarConfig: ChartConfig = {
		type: 'radar',
		series: [
			{
				id: 'agent-a',
				label: 'Agent A',
				points: radarAxes.map((ax, i) => ({ x: ax, y: [0.9, 0.7, 0.95, 0.6, 0.85, 0.75][i] * 100 })),
				color: '#38BDF8',
				smooth: false,
			},
			{
				id: 'agent-b',
				label: 'Agent B',
				points: radarAxes.map((ax, i) => ({ x: ax, y: [0.6, 0.9, 0.7, 0.85, 0.65, 0.9][i] * 100 })),
				color: '#C4A8FF',
				smooth: false,
			},
		],
		legend: { position: 'top' },
	};

	let radarVisible = $state(new Set(['agent-a', 'agent-b']));

	// ── Heatmap ───────────────────────────────────────────────────────────────

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	const heatmapConfig: ChartConfig = {
		type: 'heatmap',
		series: [
			{
				id: 'threats',
				label: 'Threats',
				points: DAYS.map((d) => ({ x: d, y: Math.floor(Math.random() * 8) })),
				color: '#FB923C',
			},
			{
				id: 'requests2',
				label: 'Requests',
				points: DAYS.map((d) => ({ x: d, y: Math.floor(Math.random() * 5000 + 1000) })),
				color: '#38BDF8',
			},
			{
				id: 'blocked3',
				label: 'Blocked',
				points: DAYS.map((d) => ({ x: d, y: Math.floor(Math.random() * 12) })),
				color: '#C4A8FF',
			},
		],
		legend: { position: 'none' },
		padding: { left: 80 },
	};

	let heatmapVisible = $state(new Set(['threats', 'requests2', 'blocked3']));

	// ── Candlestick ───────────────────────────────────────────────────────────

	function genCandles(n: number) {
		let price = 100;
		return Array.from({ length: n }, (_, i) => {
			const open = price;
			const change = (Math.random() - 0.48) * 5;
			const close = open + change;
			const high = Math.max(open, close) + Math.random() * 2;
			const low = Math.min(open, close) - Math.random() * 2;
			price = close;
			return { x: i, y: close, y1: open, y2: high, y3: low };
		});
	}

	const candlestickConfig: ChartConfig = {
		type: 'candlestick',
		series: [{ id: 'price', label: 'Price', points: genCandles(30) }],
		xAxis: { ticks: 6 },
		yAxis: { grid: true },
		legend: { position: 'none' },
	};

	let candleVisible = $state(new Set(['price']));

	// ── Per-point color gradient (the time-of-day use case) ───────────────────

	const timeGradientConfig: ChartConfig = {
		type: 'line',
		series: [
			{
				id: 'intensity',
				label: 'Traffic intensity',
				points: HOURS.map((h) => ({ x: h, y: TRAFFIC[h] })),
				area: true,
				smooth: true,
				strokeWidth: 2.5,
				// Color each segment by time-of-day: night=violet, morning=cyan, peak=orange
				pointColor: (p) => {
					const h = p.x as number;
					if (h < 6)  return '#7C3AED'; // late night — deep violet
					if (h < 9)  return '#38BDF8'; // early morning — sky
					if (h < 12) return '#22D3EE'; // morning peak — cyan
					if (h < 14) return '#4ADE80'; // noon — green
					if (h < 17) return '#FBBF24'; // afternoon — amber
					if (h < 20) return '#FB923C'; // evening — orange
					return '#C4A8FF';              // night — violet
				},
				areaColor: [
					{ t: 0, color: '#7C3AED', opacity: 0.02 },
					{ t: 0.4, color: '#22D3EE', opacity: 0.12 },
					{ t: 0.7, color: '#FB923C', opacity: 0.1 },
					{ t: 1, color: '#C4A8FF', opacity: 0.04 },
				],
			},
		],
		xAxis: { ticks: 6, format: (v) => `${v}:00` },
		yAxis: { grid: true, unit: 'req' },
		legend: { position: 'top' },
		crosshair: true,
	};

	let timeGradientVisible = $state(new Set(['intensity']));

	// ── Stacked Area (supply chain traffic composition) ────────────────────────
	const stackedAreaConfig: ChartConfig = {
		type: 'stacked-area',
		series: [
			{ id: 'clean', label: 'Clean', points: HOURS.map((h) => ({ x: h, y: TRAFFIC[h] * 0.88 })), color: '#4ADE80' },
			{ id: 'warned2', label: 'Warned', points: HOURS.map((h) => ({ x: h, y: TRAFFIC[h] * 0.09 })), color: '#FBBF24' },
			{ id: 'blocked4', label: 'Blocked', points: HOURS.map((h) => ({ x: h, y: TRAFFIC[h] * 0.03 })), color: '#FB923C' },
		],
		xAxis: { ticks: 6, format: (v) => `${v}h` },
		yAxis: { grid: true, unit: 'req' },
		legend: { position: 'top' },
		crosshair: true,
	};
	let stackedAreaVisible = $state(new Set(['clean', 'warned2', 'blocked4']));

	// ── Waterfall (risk delta by category) ────────────────────────────────────
	const waterfallConfig: ChartConfig = {
		type: 'waterfall',
		series: [{
			id: 'risk',
			label: 'Risk Delta',
			points: [
				{ x: 'Base', y: 42 },
				{ x: 'Vuln', y: 18 },
				{ x: 'Exposure', y: 11 },
				{ x: 'Patched', y: -22 },
				{ x: 'Isolated', y: -15 },
				{ x: 'Net Risk', y: 34 },
			],
			color: '#38BDF8',
		}],
		xAxis: {},
		yAxis: { grid: true },
		legend: { position: 'none' },
	};
	let waterfallVisible = $state(new Set(['risk']));

	// ── Box Plot (latency distribution by agent) ──────────────────────────────
	const boxplotConfig: ChartConfig = {
		type: 'boxplot',
		series: [
			{
				id: 'agent-latency',
				label: 'Agent Latency',
				points: [0, 1, 2, 3, 4].map((i) => ({
					x: i,
					y: [28, 35, 22, 40, 31][i],          // median
					y1: [18, 25, 15, 28, 22][i],          // Q1
					y2: [42, 52, 34, 58, 46][i],          // Q3
					meta: {
						whiskerLow: [10, 14, 8, 15, 12][i],
						whiskerHigh: [58, 72, 48, 78, 65][i],
						outliers: i === 1 ? [95, 102] : i === 3 ? [98] : [],
					},
				})),
				color: '#38BDF8',
			},
		],
		xAxis: { format: (v) => ['go', 'npm', 'pip', 'docker', 'git'][v as number] ?? String(v) },
		yAxis: { grid: true, unit: 'ms' },
		legend: { position: 'none' },
	};
	let boxplotVisible = $state(new Set(['agent-latency']));

	// ── Horizon (dense multi-metric view) ────────────────────────────────────
	const horizonConfig: ChartConfig = {
		type: 'horizon',
		series: [
			{
				id: 'cpu',
				label: 'CPU %',
				points: HOURS.map((h) => ({ x: h, y: 20 + Math.sin(h * 0.5) * 35 + (h > 18 ? 20 : 0) })),
				color: '#38BDF8',
			},
			{
				id: 'mem',
				label: 'Memory %',
				points: HOURS.map((h) => ({ x: h, y: 40 + Math.cos(h * 0.3) * 20 })),
				color: '#C4A8FF',
			},
			{
				id: 'net',
				label: 'Net MB/s',
				points: HOURS.map((h) => ({ x: h, y: TRAFFIC[h] / 200 })),
				color: '#4ADE80',
			},
		],
		xAxis: { ticks: 6, format: (v) => `${v}h` },
		yAxis: { ticks: 3 },
		legend: { position: 'none' },
	};
	let horizonVisible = $state(new Set(['cpu', 'mem', 'net']));

	// ── Lollipop (ecosystem request counts) ──────────────────────────────────
	const lollipopConfig: ChartConfig = {
		type: 'bar',
		series: [
			{
				id: 'reqs',
				label: 'Requests',
				style: 'lollipop' as any,
				points: ECOSYSTEMS.map((i) => ({ x: i, y: [3070, 1950, 140, 80, 190, 80][i] })),
				color: '#38BDF8',
			},
		],
		xAxis: { format: (v) => ECO_LABELS[v as number] ?? String(v) },
		yAxis: { grid: true },
		legend: { position: 'none' },
	};
	let lollipopVisible = $state(new Set(['reqs']));

	// ── Log Scale (request volume, wide range) ────────────────────────────────
	const logScaleConfig: ChartConfig = {
		type: 'line',
		series: [
			{
				id: 'go2',     label: 'Go',     points: [{ x: 0, y: 3070 }, { x: 1, y: 2800 }, { x: 2, y: 3200 }], color: '#38BDF8', smooth: true,
			},
			{
				id: 'pip2',    label: 'pip',    points: [{ x: 0, y: 140 },  { x: 1, y: 155 },  { x: 2, y: 130 }],  color: '#4ADE80', smooth: true,
			},
			{
				id: 'docker2', label: 'Docker', points: [{ x: 0, y: 8 },    { x: 1, y: 12 },   { x: 2, y: 6 }],    color: '#FB923C', smooth: true,
			},
		],
		xAxis: { format: (v) => ['Jan', 'Feb', 'Mar'][v as number] ?? String(v) },
		yAxis: { type: 'log', grid: true, unit: 'req' },
		legend: { position: 'top' },
		crosshair: true,
	};
	let logScaleVisible = $state(new Set(['go2', 'pip2', 'docker2']));

	// ── Zoomable line chart ───────────────────────────────────────────────────
	const zoomableConfig: ChartConfig = {
		type: 'line',
		series: [
			{
				id: 'signal',
				label: 'Signal',
				points: Array.from({ length: 100 }, (_, i) => ({ x: i, y: Math.sin(i * 0.2) * 50 + Math.random() * 15 })),
				color: '#C4A8FF',
				smooth: true,
				area: true,
				areaColor: [{ t: 0, color: '#C4A8FF', opacity: 0.02 }, { t: 0.5, color: '#C4A8FF', opacity: 0.1 }, { t: 1, color: '#C4A8FF', opacity: 0.02 }],
			},
		],
		xAxis: { ticks: 6 },
		yAxis: { grid: true },
		legend: { position: 'none' },
		zoomable: true,
		crosshair: true,
	};
	let zoomableVisible = $state(new Set(['signal']));
</script>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Line · Time-Based Per-Point Color</h3>
		<p class="demo-desc">pointColor fn maps hour → hue. Each segment colored individually.</p>
		<div style="height: 220px">
			<Chart
				config={timeGradientConfig}
				bind:visibleSeries={timeGradientVisible}
				onSeriesToggle={(id, on) => { if (on) timeGradientVisible.add(id); else timeGradientVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Line · X-Axis Gradient</h3>
		<p class="demo-desc">gradient[] stops keyed by x-domain fraction. Single SVG linearGradient per series.</p>
		<div style="height: 220px">
			<Chart
				config={lineGradientConfig}
				bind:visibleSeries={lineVisible}
				onSeriesToggle={(id, on) => { if (on) lineVisible.add(id); else lineVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Line · Multi-Series with Annotation</h3>
		<p class="demo-desc">Three latency percentiles. Horizontal threshold annotation at SLO boundary.</p>
		<div style="height: 220px">
			<Chart
				config={multiLineConfig}
				bind:visibleSeries={multiLineVisible}
				onSeriesToggle={(id, on) => { if (on) multiLineVisible.add(id); else multiLineVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="DonutChart">
		<h3 class="demo-label">DonutChart · Standalone Design-System Variant</h3>
		<p class="demo-desc">Self-contained ring chart — title, center readout, hover popover with share bar, legend, caption. Hover a segment or legend item.</p>
		<div style="display:flex;gap:48px;flex-wrap:wrap;padding:8px 0;">
			<DonutChart
				title="Data Exposure"
				slices={dataExposureSlices}
				centerLabel="Vendors"
				caption="Vendors by sensitive data type"
			/>
			<DonutChart
				title="Vendor Criticality"
				slices={vendorCriticalitySlices}
				centerLabel="Vendors"
				caption="Portfolio by criticality tier"
			/>
		</div>
	</ShowcaseBlock>

	<div class="two-col">
		<ShowcaseBlock component="Chart">
			<h3 class="demo-label">Bar · Grouped</h3>
			<div style="height: 200px">
				<Chart
					config={barConfig}
					bind:visibleSeries={barVisible}
					onSeriesToggle={(id, on) => { if (on) barVisible.add(id); else barVisible.delete(id); }}
				/>
			</div>
		</ShowcaseBlock>

		<ShowcaseBlock component="Chart">
			<h3 class="demo-label">Bar · Stacked</h3>
			<div style="height: 200px">
				<Chart
					config={stackedBarConfig}
					bind:visibleSeries={stackedVisible}
					onSeriesToggle={(id, on) => { if (on) stackedVisible.add(id); else stackedVisible.delete(id); }}
				/>
			</div>
		</ShowcaseBlock>
	</div>

	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Pie</h3>
		<div style="height: 240px">
			<Chart
				config={pieConfig}
				bind:visibleSeries={pieVisible}
				onSeriesToggle={(id, on) => { if (on) pieVisible.add(id); else pieVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<div class="two-col">
		<ShowcaseBlock component="Chart">
			<h3 class="demo-label">Scatter · Per-Point Risk Color</h3>
			<p class="demo-desc">pointColor maps risk score → green / amber / orange.</p>
			<div style="height: 220px">
				<Chart
					config={scatterConfig}
					bind:visibleSeries={scatterVisible}
					onSeriesToggle={(id, on) => { if (on) scatterVisible.add(id); else scatterVisible.delete(id); }}
				/>
			</div>
		</ShowcaseBlock>

		<ShowcaseBlock component="Chart">
			<h3 class="demo-label">Radar</h3>
			<div style="height: 220px">
				<Chart
					config={radarConfig}
					bind:visibleSeries={radarVisible}
					onSeriesToggle={(id, on) => { if (on) radarVisible.add(id); else radarVisible.delete(id); }}
				/>
			</div>
		</ShowcaseBlock>
	</div>

	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Candlestick (OHLC)</h3>
		<p class="demo-desc">y=close, y1=open, y2=high, y3=low. Bull/bear color auto-derived.</p>
		<div style="height: 200px">
			<Chart
				config={candlestickConfig}
				bind:visibleSeries={candleVisible}
				onSeriesToggle={(id, on) => { if (on) candleVisible.add(id); else candleVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Heatmap</h3>
		<p class="demo-desc">Series as rows, points as columns. Value → opacity via per-series color.</p>
		<div style="height: 140px">
			<Chart
				config={heatmapConfig}
				bind:visibleSeries={heatmapVisible}
				onSeriesToggle={(id, on) => { if (on) heatmapVisible.add(id); else heatmapVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Stacked Area · Traffic Composition</h3>
		<p class="demo-desc">Three disposition bands stacked. Toggle series in the legend to isolate a band.</p>
		<div style="height: 220px">
			<Chart
				config={stackedAreaConfig}
				bind:visibleSeries={stackedAreaVisible}
				onSeriesToggle={(id, on) => { if (on) stackedAreaVisible.add(id); else stackedAreaVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<div class="two-col">
		<ShowcaseBlock component="Chart">
			<h3 class="demo-label">Waterfall · Risk Delta</h3>
			<div style="height: 200px">
				<Chart
					config={waterfallConfig}
					bind:visibleSeries={waterfallVisible}
					onSeriesToggle={(id, on) => { if (on) waterfallVisible.add(id); else waterfallVisible.delete(id); }}
				/>
			</div>
		</ShowcaseBlock>

		<ShowcaseBlock component="Chart">
			<h3 class="demo-label">Bar · Lollipop Style</h3>
			<div style="height: 200px">
				<Chart
					config={lollipopConfig}
					bind:visibleSeries={lollipopVisible}
					onSeriesToggle={(id, on) => { if (on) lollipopVisible.add(id); else lollipopVisible.delete(id); }}
				/>
			</div>
		</ShowcaseBlock>
	</div>

	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Box Plot · Latency Distribution by Ecosystem</h3>
		<div style="height: 200px">
			<Chart
				config={boxplotConfig}
				bind:visibleSeries={boxplotVisible}
				onSeriesToggle={(id, on) => { if (on) boxplotVisible.add(id); else boxplotVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock component="Chart">
		<h3 class="demo-label">Horizon · Dense Multi-Metric View</h3>
		<p class="demo-desc">Scroll-wheel zoom not shown here. Each row is an independent metric band.</p>
		<div style="height: 180px">
			<Chart
				config={horizonConfig}
				bind:visibleSeries={horizonVisible}
				onSeriesToggle={(id, on) => { if (on) horizonVisible.add(id); else horizonVisible.delete(id); }}
			/>
		</div>
	</ShowcaseBlock>

	<div class="two-col">
		<ShowcaseBlock component="Chart">
			<h3 class="demo-label">Line · Log Y-Axis</h3>
			<p class="demo-desc">Log y-axis. Tick labels are decade-aligned.</p>
			<div style="height: 200px">
				<Chart
					config={logScaleConfig}
					bind:visibleSeries={logScaleVisible}
					onSeriesToggle={(id, on) => { if (on) logScaleVisible.add(id); else logScaleVisible.delete(id); }}
				/>
			</div>
		</ShowcaseBlock>

		<ShowcaseBlock component="Chart">
			<h3 class="demo-label">Line · Zoomable</h3>
			<p class="demo-desc">Scroll to zoom, drag to pan, double-click to reset.</p>
			<div style="height: 200px">
				<Chart
					config={zoomableConfig}
					bind:visibleSeries={zoomableVisible}
					onSeriesToggle={(id, on) => { if (on) zoomableVisible.add(id); else zoomableVisible.delete(id); }}
				/>
			</div>
		</ShowcaseBlock>
	</div>
</div>

<style>
	.two-col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		margin-bottom: 1.5rem;
	}

	.demo-label {
		font-size: 11px;
		font-family: var(--mono);
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg);
		margin: 0 0 4px;
	}

	.demo-desc {
		font-family: var(--mono);
		font-size: 10px;
		color: var(--fg-dim);
		margin: 0 0 12px;
	}

	@media (max-width: 640px) {
		.two-col { grid-template-columns: 1fr; }
	}
</style>
