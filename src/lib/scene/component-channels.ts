// ── Component channels, derived from the builder registry ──────────────────
// `ComponentMeta.props` already describes every component's props precisely
// enough to animate them: `kind` gives the interpolation, `min`/`max` give the
// range, `options` give the legal steps, `section` gives the grouping.
//
// So the animatable vocabulary is GENERATED, not authored. Every component in
// `REGISTRY` — including ones added next year — becomes scene-animatable with no
// per-component work, and a component whose props change gets a corrected
// vocabulary for free. Hand-writing this list would have meant 93 entries that
// silently rot.
//
// The one thing a PropDef cannot tell us is intent, so `PropDef.animate` exists
// as an override for the cases where the kind-derived default is wrong.

import { REGISTRY, type PropDef, type ComponentMeta } from '../builder/registry.js';
import type { Channel } from './vocabulary.js';

/**
 * How a prop animates when it doesn't say. The defaults encode a judgement:
 *
 *   number   → lerp. The only genuinely interpolatable kind.
 *   enum     → step. There is no value between 'accent' and 'cyan'.
 *   boolean  → step.
 *   text     → step. A short label swap reads fine.
 *   textarea → none. Prose is long; swapping a paragraph mid-scene reads as a
 *              glitch, and interpolating one is meaningless.
 */
function defaultAnimate(kind: PropDef['kind']): 'none' | 'step' | 'lerp' {
	switch (kind) {
		case 'number':
			return 'lerp';
		case 'enum':
		case 'boolean':
		case 'text':
			return 'step';
		default:
			return 'none';
	}
}

/** Builder-internal plumbing (`__trigger`, `__triggerTitle`, …) is not part of
 *  the component's own surface, so it never becomes a channel. */
function isInternal(key: string): boolean {
	return key.startsWith('__');
}

function channelFor(meta: ComponentMeta, key: string, def: PropDef): Channel | null {
	const mode = def.animate ?? defaultAnimate(def.kind);
	if (mode === 'none') return null;

	return {
		// Scoped by component id: two components may both have a `title` prop with
		// different kinds, so a shared id would make `channelById` ambiguous.
		id: `props.${meta.id}.${key}`,
		label: def.label,
		kinds: ['component'],
		// `sceneStateAt` walks this path into the object, and `component.props` is
		// a plain record, so a generated prop needs no special application path.
		path: `component.props.${key}`,
		type: mode,
		range: mode === 'lerp' ? [def.min ?? 0, def.max ?? 100] : undefined,
		options:
			def.kind === 'boolean'
				? ['true', 'false']
				: def.options
					? [...def.options]
					: undefined,
		group: def.section ? titleCase(def.section) : 'Props',
		preset: def.default,
		// Carried through so the picker can decline to offer a prop that the
		// component's current configuration hides.
		showWhen: def.showWhen ? { key: def.showWhen.key, values: [...def.showWhen.values] } : undefined,
	};
}

function titleCase(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Every generated channel, keyed by id. Built once at module load — the
 *  registry is a static const, so there is nothing to invalidate. */
export const COMPONENT_CHANNELS: Map<string, Channel> = (() => {
	const map = new Map<string, Channel>();
	for (const meta of REGISTRY) {
		for (const [key, def] of Object.entries(meta.props)) {
			if (isInternal(key)) continue;
			const ch = channelFor(meta, key, def);
			if (ch) map.set(ch.id, ch);
		}
	}
	return map;
})();

/**
 * The channels bindable to one component instance.
 *
 * `props` is the instance's CURRENT props, used to honour `showWhen`: a Card of
 * type 'stat' has no `title`, so offering a cue that drives `title` would
 * produce a cue that does nothing visible. Filtering here is the difference
 * between a vocabulary and a list of traps.
 */
export function channelsForComponent(
	componentId: string,
	props: Record<string, unknown> = {},
): Channel[] {
	const meta = REGISTRY.find((r) => r.id === componentId);
	if (!meta) return [];
	const out: Channel[] = [];
	for (const [key, def] of Object.entries(meta.props)) {
		if (isInternal(key)) continue;
		const ch = channelFor(meta, key, def);
		if (!ch) continue;
		if (ch.showWhen) {
			// Fall back to the controlling prop's own default when the instance has
			// never set it — otherwise a prop whose controller was left untouched
			// stays hidden even though the component is rendering it.
			const ctrlDef = meta.props[ch.showWhen.key];
			const current = props[ch.showWhen.key] ?? ctrlDef?.default ?? '';
			if (!ch.showWhen.values.includes(String(current))) continue;
		}
		out.push(ch);
	}
	return out;
}

/** How many components and props the generated vocabulary actually covers —
 *  surfaced in the UI so the reach of this is visible rather than implied. */
export function componentChannelStats(): { components: number; channels: number } {
	const components = new Set<string>();
	for (const id of COMPONENT_CHANNELS.keys()) components.add(id.split('.')[1]);
	return { components: components.size, channels: COMPONENT_CHANNELS.size };
}
