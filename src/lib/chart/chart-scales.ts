import type { ChartConfig, ChartSeries, AxisConfig } from './chart.types.js';

// ── Scale interface ───────────────────────────────────────────────────────────

export interface ScaleFn {
	(v: number | Date | string): number;
	invert?: (px: number) => number;
	bandwidth?: number;
}

// ── Value normalization ───────────────────────────────────────────────────────

export function toNumber(v: number | Date | string): number {
	if (v instanceof Date) return v.getTime();
	if (typeof v === 'number') return v;
	const n = parseFloat(String(v));
	return isNaN(n) ? 0 : n;
}

// ── Scale constructors ────────────────────────────────────────────────────────

export function linearScale(domain: [number, number], range: [number, number]): ScaleFn {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	const dSpan = d1 - d0 || 1;
	const rSpan = r1 - r0;
	const fn: ScaleFn = (v) => r0 + ((toNumber(v) - d0) / dSpan) * rSpan;
	fn.invert = (px) => d0 + ((px - r0) / rSpan) * dSpan;
	return fn;
}

export function logScale(domain: [number, number], range: [number, number]): ScaleFn {
	const safeD = [Math.max(domain[0], 1e-10), Math.max(domain[1], 1e-10)] as [number, number];
	const logD: [number, number] = [Math.log10(safeD[0]), Math.log10(safeD[1])];
	const lin = linearScale(logD, range);
	const fn: ScaleFn = (v) => lin(Math.log10(Math.max(toNumber(v), 1e-10)));
	return fn;
}

export function bandScale(
	domain: string[],
	range: [number, number],
	paddingOuter = 0.1,
	paddingInner = 0.2
): ScaleFn {
	const n = domain.length;
	if (n === 0) {
		const fn: ScaleFn = () => range[0];
		fn.bandwidth = 0;
		return fn;
	}
	const totalW = range[1] - range[0];
	const outer = paddingOuter * (totalW / n);
	const available = totalW - outer * 2;
	const gap = n > 1 ? (paddingInner * available) / (n - 1) : 0;
	const bw = (available - gap * (n - 1)) / n;
	const fn: ScaleFn = (v) => {
		const i = domain.indexOf(String(v));
		return i < 0 ? range[0] : range[0] + outer + i * (bw + gap);
	};
	fn.bandwidth = bw;
	return fn;
}

// ── Domain inference ──────────────────────────────────────────────────────────

export function inferXDomain(
	series: ChartSeries[],
	visible: Set<string>,
	cfg?: AxisConfig
): [number, number] {
	if (cfg?.domain) return [toNumber(cfg.domain[0] as number | Date), toNumber(cfg.domain[1] as number | Date)];
	let min = Infinity, max = -Infinity;
	for (const s of series) {
		if (!visible.has(s.id)) continue;
		for (const p of s.points) {
			const n = toNumber(p.x);
			if (n < min) min = n;
			if (n > max) max = n;
		}
	}
	return [min === Infinity ? 0 : min, max === -Infinity ? 1 : max];
}

export function inferYDomain(
	series: ChartSeries[],
	visible: Set<string>,
	cfg?: AxisConfig,
	side: 'left' | 'right' = 'left',
	pad = 0.08,
	/** Stacked chart: the top of a bar is the SUM of its segments at that x, not
	 *  the tallest single segment. Taking the per-point max leaves every stack
	 *  overshooting the plot and clipped — which renders as an empty chart. */
	stacked = false
): [number, number] {
	if (cfg?.domain) return [toNumber(cfg.domain[0] as number | Date), toNumber(cfg.domain[1] as number | Date)];
	let min = Infinity, max = -Infinity;
	// Running total per (stack group, x), so two independent stacks on one chart
	// don't get summed into each other.
	const stackTotals = new Map<string, number>();
	for (const s of series) {
		if (!visible.has(s.id)) continue;
		if (side === 'right' && s.yAxis !== 'right') continue;
		if (side === 'left' && s.yAxis === 'right') continue;
		for (const p of s.points) {
			if (stacked) {
				const k = `${s.stackGroup ?? ''}|${String(p.x)}`;
				// Negative and positive segments stack away from the baseline in
				// opposite directions, so they are accumulated separately.
				const signKey = p.y < 0 ? `-${k}` : k;
				const total = (stackTotals.get(signKey) ?? 0) + p.y;
				stackTotals.set(signKey, total);
				if (total < min) min = total;
				if (total > max) max = total;
				if (0 < min) min = 0;
				continue;
			}
			const vals = [p.y, p.y1, p.y2, p.y3].filter((v): v is number => v !== undefined);
			for (const v of vals) {
				if (v < min) min = v;
				if (v > max) max = v;
			}
		}
	}
	if (min === Infinity) return [0, 1];
	const span = max - min || 1;
	return [Math.min(0, min - span * pad), max + span * pad];
}

// ── Tick generation ───────────────────────────────────────────────────────────

export function generateLinearTicks(domain: [number, number], target = 5): number[] {
	const [lo, hi] = domain;
	if (lo === hi) return [lo];
	const span = hi - lo;
	const rawStep = span / (target - 1);
	const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
	const step = Math.ceil(rawStep / mag) * mag;
	const start = Math.ceil(lo / step) * step;
	const ticks: number[] = [];
	for (let t = start; t <= hi + step * 0.001 && ticks.length <= target + 2; t += step) {
		ticks.push(parseFloat(t.toPrecision(10)));
	}
	return ticks;
}

export function generateLogTicks(domain: [number, number], target = 5): number[] {
	const [lo, hi] = domain;
	if (lo >= hi) return [lo];

	// Step 1 & 2: generate ticks at each power of 10, starting from floor power at lo
	const startExp = Math.floor(Math.log10(Math.max(lo, 1e-10)));
	const ticks: number[] = [];
	for (let exp = startExp; Math.pow(10, exp) <= hi * 1.0001; exp++) {
		ticks.push(Math.pow(10, exp));
	}

	// Step 3: filter to domain
	let inDomain = ticks.filter((t) => t >= lo && t <= hi);

	// Step 4: if fewer than floor(target/2), also add 2× and 5× multiples
	if (inDomain.length < Math.floor(target / 2)) {
		const extended: number[] = [...ticks];
		for (let exp = startExp; Math.pow(10, exp) * 5 <= hi * 1.0001; exp++) {
			extended.push(2 * Math.pow(10, exp));
			extended.push(5 * Math.pow(10, exp));
		}
		inDomain = extended.filter((t) => t >= lo && t <= hi);
		inDomain = [...new Set(inDomain)].sort((a, b) => a - b);
	}

	// Step 5: fall back to linear if still fewer than 3 ticks
	if (inDomain.length < 3) {
		return generateLinearTicks(domain, target);
	}

	// Step 6: return sorted unique array
	return [...new Set(inDomain)].sort((a, b) => a - b);
}

export function generateTimeTicks(domain: [number, number], target = 6): Date[] {
	const span = domain[1] - domain[0];
	const approxStep = span / (target - 1);
	const STEPS = [
		1000, 5000, 15000, 30000, 60000,
		5 * 60000, 10 * 60000, 15 * 60000, 30 * 60000,
		3600000, 3 * 3600000, 6 * 3600000, 12 * 3600000,
		86400000, 7 * 86400000,
	];
	const step = STEPS.reduce((best, s) =>
		Math.abs(s - approxStep) < Math.abs(best - approxStep) ? s : best
	);
	const start = Math.ceil(domain[0] / step) * step;
	const ticks: Date[] = [];
	for (let t = start; t <= domain[1] + step * 0.001 && ticks.length <= target + 2; t += step) {
		ticks.push(new Date(t));
	}
	return ticks;
}

// ── Default formatter ─────────────────────────────────────────────────────────

export function defaultFormat(v: number | Date | string, unit?: string): string {
	const suf = unit ? ` ${unit}` : '';
	if (v instanceof Date) {
		return v.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	const n = typeof v === 'number' ? v : parseFloat(String(v));
	if (isNaN(n)) return String(v);
	if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M${suf}`;
	if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k${suf}`;
	if (n % 1 !== 0) return n.toFixed(1) + suf;
	return n.toFixed(0) + suf;
}

// ── Scale factory ─────────────────────────────────────────────────────────────

export function buildScaleX(config: ChartConfig, visible: Set<string>, innerW: number): ScaleFn {
	const type = config.xAxis?.type ?? 'linear';
	if (type === 'band') {
		const seen = new Set<string>();
		const domain: string[] = [];
		for (const s of config.series) {
			if (!visible.has(s.id)) continue;
			for (const p of s.points) {
				const k = String(p.x);
				if (!seen.has(k)) { seen.add(k); domain.push(k); }
			}
		}
		return bandScale(domain, [0, innerW]);
	}
	const domain = inferXDomain(config.series, visible, config.xAxis);
	if (type === 'log') return logScale(domain, [0, innerW]);
	return linearScale(domain, [0, innerW]);
}

export function buildScaleY(
	config: ChartConfig,
	visible: Set<string>,
	innerH: number,
	side: 'left' | 'right' = 'left'
): ScaleFn {
	const cfg = side === 'right' ? config.y2Axis : config.yAxis;
	const type = cfg?.type ?? 'linear';
	// Any visible series drawn stacked makes the axis a stack axis: the domain has
	// to reach the tallest TOTAL, not the tallest segment.
	const stacked = config.series.some((s) => {
		if (!visible.has(s.id)) return false;
		const t = s.type ?? config.type;
		return t === 'stacked-bar' || t === 'stacked-area';
	});
	const domain = inferYDomain(config.series, visible, cfg, side, 0.08, stacked);
	if (type === 'log') return logScale(domain, [innerH, 0]);
	return linearScale(domain, [innerH, 0]);
}

// ── SVG path builders ─────────────────────────────────────────────────────────

export function linearPath(pts: [number, number][]): string {
	if (pts.length === 0) return '';
	return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

export function smoothPath(pts: [number, number][]): string {
	if (pts.length < 2) return '';
	if (pts.length === 2) return `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} L ${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}`;
	let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[Math.max(i - 1, 0)];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[Math.min(i + 2, pts.length - 1)];
		const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
		const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
		const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
		const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
		d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
	}
	return d;
}

export function areaPath(
	pts: [number, number][],
	baseline: number,
	smooth: boolean
): string {
	if (pts.length === 0) return '';
	const linePart = smooth ? smoothPath(pts) : linearPath(pts);
	const last = pts[pts.length - 1];
	const first = pts[0];
	return `${linePart} L ${last[0].toFixed(1)} ${baseline.toFixed(1)} L ${first[0].toFixed(1)} ${baseline.toFixed(1)} Z`;
}
