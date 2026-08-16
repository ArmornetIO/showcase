// ── Chart taxonomy ────────────────────────────────────────────────────────────

export type ChartType =
	| 'line'
	| 'area'
	| 'bar'
	| 'stacked-bar'
	| 'grouped-bar'
	| 'scatter'
	| 'bubble'
	| 'pie'
	| 'donut'
	| 'heatmap'
	| 'histogram'
	| 'candlestick'
	| 'radar'
	| 'sparkline'
	| 'stacked-area'
	| 'waterfall'
	| 'boxplot'
	| 'horizon'
	| 'timeline'
	| 'lollipop';

export type AxisType = 'linear' | 'time' | 'log' | 'band';

// ── Color primitives ──────────────────────────────────────────────────────────

/** Called per point — return a CSS color string. Return 'transparent' to skip. */
export type ColorFn = (point: ChartPoint, index: number, series: ChartSeries) => string;

/** Gradient stop along the x-axis (time-based): t is 0–1 fraction of x-domain. */
export interface GradientStop {
	t: number;
	color: string;
	opacity?: number;
}

// ── Data ─────────────────────────────────────────────────────────────────────

export interface ChartPoint {
	x: number | string | Date;
	y: number;
	/** OHLC candlestick: y=close, y1=open, y2=high, y3=low */
	y1?: number;
	y2?: number;
	y3?: number;
	/** Box plot: upper whisker / timeline: event end */
	y4?: number;
	/** Timeline: event end time */
	x1?: number | Date;
	/** Bubble chart: radius in px */
	r?: number;
	label?: string;
	meta?: Record<string, unknown>;
}

export interface ChartSeries {
	id: string;
	label: string;
	/** Override chart type per-series — enables mixed charts */
	type?: ChartType;
	points: ChartPoint[];

	// ── Color — most specific wins ────────────────────────────────────────
	/** Per-point color function */
	pointColor?: ColorFn;
	/** Gradient along the stroke, stops keyed by x-domain fraction 0–1 */
	gradient?: GradientStop[];
	/** Solid color fallback */
	color?: string;
	/** Fill beneath a line — string for solid, GradientStop[] for gradient */
	areaColor?: string | GradientStop[];

	// ── Style ─────────────────────────────────────────────────────────────
	strokeWidth?: number;
	dashArray?: string;
	opacity?: number;
	/** Cubic-bezier smoothing */
	smooth?: boolean;
	/** Always fill area beneath line */
	area?: boolean;
	/** Stacked-bar group key */
	stackGroup?: string;
	/** Scatter/bubble: default point radius (px) */
	pointRadius?: number;
	/** Bind to the secondary (right) y-axis */
	yAxis?: 'left' | 'right';
	/** Bar rendering variant */
	style?: 'bar' | 'lollipop';
	/** LTTB downsampling threshold — auto-downsample if point count exceeds this */
	downsample?: number;
}

// ── Axes ─────────────────────────────────────────────────────────────────────

export interface AxisConfig {
	type?: AxisType;
	domain?: [number | Date, number | Date];
	ticks?: number | (number | Date | string)[];
	format?: (v: number | Date | string) => string;
	unit?: string;
	label?: string;
	grid?: boolean;
	gridColor?: string;
	/** Emphasize the zero line */
	zeroLine?: boolean;
}

// ── Legend ───────────────────────────────────────────────────────────────────

export interface LegendConfig {
	position?: 'top' | 'bottom' | 'left' | 'right' | 'none';
	layout?: 'horizontal' | 'vertical';
	/** 'toggle' (default): click hides/shows; long-press isolates.
	 *  'isolate': single click isolates the series; long-press still works. */
	clickMode?: 'toggle' | 'isolate';
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

export interface TooltipConfig {
	enabled?: boolean;
	format?: (series: ChartSeries, point: ChartPoint) => string;
}

// ── Annotations ──────────────────────────────────────────────────────────────

export interface ChartAnnotation {
	type: 'line' | 'band' | 'point' | 'label';
	axis: 'x' | 'y';
	/** Single value, or [lo, hi] for type='band' */
	value: number | Date | string | [number | Date | string, number | Date | string];
	color?: string;
	label?: string;
	dashArray?: string;
	opacity?: number;
}

// ── Root config ───────────────────────────────────────────────────────────────

export interface ChartConfig {
	type: ChartType;
	series: ChartSeries[];
	xAxis?: AxisConfig;
	yAxis?: AxisConfig;
	y2Axis?: AxisConfig;
	legend?: LegendConfig;
	tooltip?: TooltipConfig;
	padding?: { top?: number; right?: number; bottom?: number; left?: number };
	/** Vertical crosshair on hover */
	crosshair?: boolean;
	annotations?: ChartAnnotation[];
	background?: string;
	/** Pie only: hole radius as a fraction of the outer radius (0–1). 0/undefined = solid pie. */
	donut?: number;
	/** Enable scroll-wheel zoom and drag pan on cartesian charts */
	zoomable?: boolean;
	/** Heatmap sequential/diverging color scale: [[t, color], ...] where t is 0–1 */
	colorScale?: [number, string][];
}

// ── Default palette ───────────────────────────────────────────────────────────

export const CHART_PALETTE: readonly string[] = [
	'#38BDF8',
	'#C4A8FF',
	'#4ADE80',
	'#FB923C',
	'#5FEAD5',
	'#FBBF24',
	'#60A5FA',
	'#F472B6',
];

export function seriesColor(index: number, override?: string): string {
	return override ?? CHART_PALETTE[index % CHART_PALETTE.length];
}
