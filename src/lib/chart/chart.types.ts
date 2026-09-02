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
	| 'lollipop'
	| 'gauge';

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

// ── Gauge ─────────────────────────────────────────────────────────────────────

/**
 * One coloured segment of a gauge's scale, named by where it ENDS. Bands are
 * contiguous: each starts where the previous one stopped, and the first starts
 * at the domain's floor — so a scale is described by its boundaries rather than
 * by ranges that can overlap or leave gaps.
 */
export interface GaugeBand {
	/** Upper bound, in domain units (not a fraction). */
	to: number;
	color: string;
	/** Shown in the legend and the band's tooltip. */
	label?: string;
}

export interface GaugeConfig {
	/**
	 * The scale's segments. The filled arc is CUT at these boundaries rather than
	 * painted one colour to the reading: a single hue covers the very bands it is
	 * meant to be read against, leaving a dial that has colour on it but says
	 * nothing with it.
	 */
	bands?: GaugeBand[];
	/** Degrees of arc the scale spans. Default 240. */
	sweep?: number;
	/**
	 * Where the scale starts, in SVG degrees (0 = 3 o'clock, growing clockwise).
	 * Default 150, which opens the gauge downward and centres it on 12 o'clock.
	 */
	startAngle?: number;
	/** Track thickness in px. Defaults to a fraction of the radius. */
	thickness?: number;
	/** Caption under the value — typically the gate, e.g. "pass ≥ 85". */
	label?: string;
	/** Hide the centred numeral, for a gauge used as a bare indicator. */
	showValue?: boolean;
	/** Draw the marker at the reading. Default true. */
	needle?: boolean;
	/** Decimal places on the centred numeral. Default 0. */
	precision?: number;
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
	/**
	 * Gauge only. The READING comes from the first point of the first visible
	 * series, the SCALE from `yAxis.domain` (default [0, 100]), and every marked
	 * value — a pass gate, a peer median, an SLA — from `annotations` with
	 * `axis: 'y'`. Only what is genuinely gauge-specific lives here, so a caller
	 * already fluent in the other chart types has one new object to learn.
	 */
	gauge?: GaugeConfig;
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
