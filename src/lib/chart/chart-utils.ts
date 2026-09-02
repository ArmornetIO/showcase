import type { ChartPoint, ChartConfig } from './chart.types.js';
import { toNumber } from './chart-scales.js';

// ── LTTB downsampling ─────────────────────────────────────────────────────────

/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling.
 * Reduces a dense time series to `threshold` points while preserving visual shape.
 */
export function lttbDownsample(points: ChartPoint[], threshold: number): ChartPoint[] {
	if (points.length <= threshold) return points;

	const result: ChartPoint[] = [];
	// Always keep the first point
	result.push(points[0]);

	// Divide the interior points into (threshold - 2) equally-sized buckets
	const bucketCount = threshold - 2;
	const interior = points.slice(1, points.length - 1);
	const bucketSize = interior.length / bucketCount;

	let selectedPoint = points[0];

	for (let i = 0; i < bucketCount; i++) {
		// Bounds for the current bucket (interior indices)
		const bucketStart = Math.floor(i * bucketSize);
		const bucketEnd = Math.floor((i + 1) * bucketSize);
		const bucket = interior.slice(bucketStart, bucketEnd);

		// Compute the average of the next bucket (or last point for the last bucket)
		let avgX: number;
		let avgY: number;

		if (i === bucketCount - 1) {
			// Last bucket: use the final point as the "next" average
			const last = points[points.length - 1];
			avgX = toNumber(last.x);
			avgY = last.y;
		} else {
			const nextBucketStart = Math.floor((i + 1) * bucketSize);
			const nextBucketEnd = Math.floor((i + 2) * bucketSize);
			const nextBucket = interior.slice(nextBucketStart, nextBucketEnd);
			let sumX = 0;
			let sumY = 0;
			for (const p of nextBucket) {
				sumX += toNumber(p.x);
				sumY += p.y;
			}
			avgX = sumX / nextBucket.length;
			avgY = sumY / nextBucket.length;
		}

		// From the current bucket, pick the point that forms the largest triangle
		// with selectedPoint (a) and (avgX, avgY) (c)
		const ax = toNumber(selectedPoint.x);
		const ay = selectedPoint.y;
		const cx = avgX;
		const cy = avgY;

		let maxArea = -1;
		let bestPoint = bucket[0];

		for (const candidate of bucket) {
			const bx = toNumber(candidate.x);
			const by = candidate.y;
			// Triangle area = |((ax - cx) * (by - ay) - (ax - bx) * (cy - ay))| / 2
			const area = Math.abs((ax - cx) * (by - ay) - (ax - bx) * (cy - ay)) / 2;
			if (area > maxArea) {
				maxArea = area;
				bestPoint = candidate;
			}
		}

		result.push(bestPoint);
		selectedPoint = bestPoint;
	}

	// Always keep the last point
	result.push(points[points.length - 1]);

	return result;
}

// ── Config-level downsampling ─────────────────────────────────────────────────

/**
 * Returns a new ChartConfig with each series downsampled according to its
 * `downsample` property (if set) or `defaultThreshold` (if the series exceeds it).
 * Does not mutate the input config.
 */
export function downsampleConfig(config: ChartConfig, defaultThreshold = 500): ChartConfig {
	return {
		...config,
		series: config.series.map((s) => {
			const explicitThreshold = (s as { downsample?: unknown }).downsample;
			if (typeof explicitThreshold === 'number') {
				return { ...s, points: lttbDownsample(s.points, explicitThreshold) };
			}
			if (s.points.length > defaultThreshold) {
				return { ...s, points: lttbDownsample(s.points, defaultThreshold) };
			}
			return s;
		}),
	};
}
