import { getContext } from 'svelte';
import type { ChartConfig, ChartSeries, ChartPoint } from './chart.types.js';
import type { ScaleFn } from './chart-scales.js';

export const CHART_CTX = Symbol('chart-ctx');

export interface HoverState {
	svgX: number | null;
	svgY: number | null;
	series: ChartSeries | null;
	point: ChartPoint | null;
}

export interface ChartCtxValue {
	config: ChartConfig;
	inner: { w: number; h: number };
	pad: { top: number; right: number; bottom: number; left: number };
	scaleX: ScaleFn;
	scaleY: ScaleFn;
	scaleY2: ScaleFn | null;
	visibleSeries: Set<string>;
	hover: HoverState;
}

export function getChartCtx(): ChartCtxValue {
	return getContext<ChartCtxValue>(CHART_CTX);
}
