import type { ChartConfig } from '$lib/chart/chart.types.js';
import type { DonutSlice } from '$lib/chart/DonutChart.svelte';

/**
 * Preview datasets for the chart components.
 *
 * `Chart` takes a whole `ChartConfig` — series, axes, formatters — which is far
 * more structure than the prop editor can express, so the builder exposes a
 * single `type` enum and each type maps to a hand-built config here. These are
 * fixtures, not real telemetry: they exist so a chart dropped on the canvas
 * looks like the chart it will be in the product.
 */

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TRAFFIC = [
	5120, 4830, 4210, 3940, 3610, 4020, 5180, 6340, 7210, 7890, 8120, 7640, 7980, 8210, 7830, 7440,
	6920, 6540, 6230, 5980, 5710, 5490, 5340, 5210
];

const ECO_LABELS = ['go', 'npm', 'pip', 'docker', 'git', 'apt'];
const ECO_INDEX = [0, 1, 2, 3, 4, 5];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RADAR_AXES = ['Latency', 'Throughput', 'Error Rate', 'Coverage', 'Trust'];

/** Slices for the `DonutChart` preview — package counts by ecosystem. */
export const DONUT_SLICES: DonutSlice[] = [
	{ label: 'Go', value: 3070, color: '#38BDF8', haloRgb: '56,189,248' },
	{ label: 'npm', value: 1950, color: '#C4A8FF', haloRgb: '196,168,255' },
	{ label: 'pip', value: 140, color: '#4ADE80', haloRgb: '74,222,128' },
	{ label: 'Docker', value: 80, color: '#FB923C', haloRgb: '251,146,60' }
];

/** Build the preview config for a chart `type`; unknown types fall back to line. */
export function chartPreset(type: string): ChartConfig {
	switch (type) {
		case 'grouped-bar':
			return {
				type: 'grouped-bar',
				series: [
					{
						id: 'req',
						label: 'Requests',
						points: ECO_INDEX.map((i) => ({ x: i, y: [3070, 1950, 140, 0, 190, 80][i] })),
						color: '#38BDF8'
					},
					{
						id: 'blk',
						label: 'Blocked',
						points: ECO_INDEX.map((i) => ({ x: i, y: [5, 8, 0, 0, 0, 1][i] })),
						color: '#FB923C'
					}
				],
				xAxis: { format: (v) => ECO_LABELS[v as number] ?? String(v) },
				yAxis: { grid: true },
				legend: { position: 'top' }
			};

		case 'stacked-bar':
			return {
				type: 'stacked-bar',
				series: [
					{
						id: 'clean',
						label: 'Clean',
						points: ECO_INDEX.map((i) => ({ x: i, y: [3065, 1942, 140, 0, 190, 79][i] })),
						color: '#4ADE80'
					},
					{
						id: 'warned',
						label: 'Warned',
						points: ECO_INDEX.map((i) => ({ x: i, y: [0, 5, 0, 0, 0, 0][i] })),
						color: '#FBBF24'
					},
					{
						id: 'blocked',
						label: 'Blocked',
						points: ECO_INDEX.map((i) => ({ x: i, y: [5, 8, 0, 0, 0, 1][i] })),
						color: '#FB923C'
					}
				],
				xAxis: { format: (v) => ECO_LABELS[v as number] ?? String(v) },
				yAxis: { grid: true },
				legend: { position: 'top' }
			};

		case 'scatter':
			return {
				type: 'scatter',
				series: [
					{
						id: 'pkgs',
						label: 'Packages',
						points: Array.from({ length: 40 }, () => ({
							x: Math.random() * 100,
							y: Math.random() * 10,
							meta: { risk: Math.random() }
						})),
						pointColor: (p) => {
							const r = (p.meta?.risk as number) ?? 0;
							return r > 0.8 ? '#FB923C' : r > 0.5 ? '#FBBF24' : '#4ADE80';
						},
						pointRadius: 4
					}
				],
				xAxis: { label: 'Activity', grid: true },
				yAxis: { label: 'Severity', grid: true },
				legend: { position: 'none' }
			};

		case 'pie':
			return {
				type: 'pie',
				series: [
					{ id: 'go', label: 'Go', points: [{ x: 0, y: 3070 }], color: '#38BDF8' },
					{ id: 'npm', label: 'npm', points: [{ x: 0, y: 1950 }], color: '#C4A8FF' },
					{ id: 'pip', label: 'pip', points: [{ x: 0, y: 140 }], color: '#4ADE80' },
					{ id: 'docker', label: 'Docker', points: [{ x: 0, y: 80 }], color: '#FB923C' }
				],
				legend: { position: 'bottom', layout: 'horizontal' }
			};

		case 'radar':
			return {
				type: 'radar',
				series: [
					{
						id: 'a',
						label: 'Agent A',
						points: RADAR_AXES.map((ax, i) => ({ x: ax, y: [90, 70, 95, 60, 85][i] })),
						color: '#38BDF8',
						smooth: false
					},
					{
						id: 'b',
						label: 'Agent B',
						points: RADAR_AXES.map((ax, i) => ({ x: ax, y: [60, 90, 70, 85, 65][i] })),
						color: '#C4A8FF',
						smooth: false
					}
				],
				legend: { position: 'top' }
			};

		case 'heatmap':
			return {
				type: 'heatmap',
				series: [
					{
						id: 'threats',
						label: 'Threats',
						points: WEEKDAYS.map((d) => ({ x: d, y: Math.floor(Math.random() * 8) })),
						color: '#FB923C'
					},
					{
						id: 'blocked',
						label: 'Blocked',
						points: WEEKDAYS.map((d) => ({ x: d, y: Math.floor(Math.random() * 12) })),
						color: '#C4A8FF'
					}
				],
				legend: { position: 'none' },
				padding: { left: 72 }
			};

		case 'candlestick': {
			// Random walk: y = close, y1 = open, y2/y3 = the wicks.
			let price = 100;
			const candles = Array.from({ length: 20 }, (_, i) => {
				const open = price;
				const close = open + (Math.random() - 0.48) * 5;
				price = close;
				return {
					x: i,
					y: close,
					y1: open,
					y2: Math.max(open, close) + Math.random() * 2,
					y3: Math.min(open, close) - Math.random() * 2
				};
			});
			return {
				type: 'candlestick',
				series: [{ id: 'price', label: 'Price', points: candles }],
				xAxis: { ticks: 5 },
				yAxis: { grid: true },
				legend: { position: 'none' }
			};
		}

		default:
			return {
				type: 'line',
				series: [
					{
						id: 'traffic',
						label: 'Requests',
						points: HOURS.map((h) => ({ x: h, y: TRAFFIC[h] })),
						area: true,
						smooth: true,
						strokeWidth: 2,
						gradient: [
							{ t: 0, color: '#38BDF8', opacity: 0.5 },
							{ t: 0.5, color: '#22D3EE', opacity: 1 },
							{ t: 1, color: '#38BDF8', opacity: 0.5 }
						],
						areaColor: [
							{ t: 0, color: '#38BDF8', opacity: 0.03 },
							{ t: 0.5, color: '#22D3EE', opacity: 0.14 },
							{ t: 1, color: '#38BDF8', opacity: 0.03 }
						]
					}
				],
				xAxis: { ticks: 6, format: (v) => `${v}h` },
				yAxis: { grid: true, unit: 'req' },
				legend: { position: 'top' },
				crosshair: true
			};
	}
}
