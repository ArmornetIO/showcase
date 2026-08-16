/**
 * Prop coercion for the renderers.
 *
 * Builder props arrive as an untyped bag: the prop editor writes strings for
 * text inputs, numbers for sliders, JSON blobs for anything structured, and
 * writes nothing at all for a prop left at its default. Renderers therefore
 * coerce on read rather than trusting the bag, and every accessor takes the
 * fallback the real component would have used.
 */

export interface PropAccessors {
	/** String prop, or `fb` when unset. */
	s(key: string, fb: string): string;
	/** Boolean prop, or `fb` when unset. */
	b(key: string, fb?: boolean): boolean;
	/** Numeric prop, or `fb` when unset. */
	n(key: string, fb: number): number;
	/** Enum prop narrowed to the component's own union, or `fb` when unset. */
	e<T extends string>(key: string, fb: T): T;
}

/**
 * Build accessors over a prop bag.
 *
 * Takes a *getter* rather than the bag itself: the builder replaces the whole
 * object on every edit, so a captured reference would go stale and the preview
 * would stop updating.
 *
 * ```ts
 * const { s, b, n, e } = accessors(() => props);
 * ```
 */
export function accessors(get: () => Record<string, unknown>): PropAccessors {
	return {
		s: (key, fb) => (get()[key] as string) ?? fb,
		b: (key, fb = false) => Boolean(get()[key] ?? fb),
		n: (key, fb) => Number(get()[key] ?? fb),
		e: <T extends string>(key: string, fb: T) => (get()[key] as T) ?? fb
	};
}

/**
 * Parse a JSON-valued prop, falling back to preview data when the editor holds
 * a half-typed value. Renderers must never throw on bad input — the user is
 * typing into the JSON field while this runs.
 */
export function parseJson<T>(raw: unknown, fallback: T): T {
	try {
		return JSON.parse(String(raw)) as T;
	} catch {
		return fallback;
	}
}

/** Split a multi-line prop into non-empty lines. */
export function lines(raw: string): string[] {
	return raw.split('\n').filter(Boolean);
}

/** Parse a comma-separated numeric prop, dropping anything unparseable. */
export function numbers(raw: string): number[] {
	return raw
		.split(',')
		.map((v) => Number(v.trim()))
		.filter((v) => !isNaN(v));
}

/** Parse a `value:Label,value:Label` prop into option objects. */
export function options(raw: string): Array<{ value: string; label: string }> {
	return raw.split(',').map((pair) => {
		const [value, label] = pair.split(':');
		return { value: value?.trim() ?? pair, label: label?.trim() ?? pair };
	});
}

/** Parse a `Key: value` per line prop into key/value tuples. */
export function keyValues(raw: string): Array<[string, string]> {
	return lines(raw).map((line) => {
		const idx = line.indexOf(':');
		if (idx === -1) return [line.trim(), ''];
		return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
	});
}
