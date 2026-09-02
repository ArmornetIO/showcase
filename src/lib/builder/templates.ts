import type { ClusterLayout, FramePreset } from './store.svelte.js';
import { GENERATED_TEMPLATES, GENERATED_SOURCES } from './templates.gen.js';

/**
 * Pre-built canvas layouts — the "start from something" half of the builder.
 *
 * A template is DATA, not a component: registry ids with coordinates and prop
 * overrides, which the store turns into ordinary items on apply. That is the
 * whole point — once placed, nothing about a template survives. There is no
 * template instance to detach from, no link to break, and no second way for a
 * layout to be wrong. It is a starting arrangement, and from then on it is just
 * what is on your canvas.
 *
 * Coordinates are RELATIVE to where the template is dropped, so the same data
 * works wherever it lands. Keep them on a 20px grid — the canvas snaps, and a
 * template that arrives already off-grid looks broken before it is touched.
 */
export interface TemplateItem {
	componentId: string;
	x: number;
	y: number;
	/** 0 (or omitted) means the component sizes itself, as on the canvas. */
	w?: number;
	h?: number;
	/** Prop overrides. Anything omitted takes the registry default. */
	props?: Record<string, unknown>;
}

export interface BuilderTemplate {
	id: string;
	name: string;
	/** One line, shown under the name in the palette. */
	description: string;
	/** Wrap the layout in a frame of this size. Omit for a bare arrangement. */
	frame?: { preset: FramePreset; name?: string; padding?: number };
	/**
	 * The cluster the template lands in. Omitted means a `free` cluster sized to
	 * the arrangement, which is the default because a template is a composition
	 * and a pile of loose items is not one. `false` opts out for the templates
	 * that are deliberately loose parts.
	 */
	cluster?: false | { padding?: number; gap?: number; layout?: ClusterLayout };
	items: TemplateItem[];
}

/**
 * Templates written by hand — PARTS, never screens.
 *
 * A hand-written template may only describe an arrangement no page makes: a
 * bare metrics row, an empty state, something built from canvas-only primitives
 * that cannot appear in a real app. It may NOT describe a product screen. This
 * list used to carry a "Console page", a "Detail drawer" and a phone-sized
 * "Sign-in screen", none of which armornet has ever shipped — so the palette
 * offered invented screens beside measured ones with nothing to tell them
 * apart, and dropping one produced a layout that matched no page in the
 * product. A screen belongs in scripts/templates.manifest.json, where it is
 * measured off the page instead of guessed at.
 */
const HAND_TEMPLATES: BuilderTemplate[] = [
	{
		id: 'metrics-row',
		name: 'Metrics row',
		description: 'Four stat tiles and a sparkline — drop it above anything.',
		items: [
			{ componentId: 'StatTile', x: 0, y: 0, w: 220, h: 120 },
			{ componentId: 'StatTile', x: 240, y: 0, w: 220, h: 120 },
			{ componentId: 'StatTile', x: 480, y: 0, w: 220, h: 120 },
			{ componentId: 'StatTile', x: 720, y: 0, w: 220, h: 120 },
			{ componentId: 'Sparkline', x: 0, y: 140, w: 940, h: 80 }
		]
	},
	{
		id: 'empty-state',
		name: 'Empty state',
		description: 'A framed placeholder with a heading and a call to action.',
		items: [
			{ componentId: 'Rectangle', x: 0, y: 0, w: 520, h: 300, props: { radius: 6 } },
			{ componentId: 'EmptyState', x: 60, y: 80, w: 400 }
		]
	}
];

/** Parts first, then the measured screens. */
export const TEMPLATES: BuilderTemplate[] = [...HAND_TEMPLATES, ...GENERATED_TEMPLATES];

/**
 * The app-ui route a template was measured from, or undefined for a hand-written
 * part. The palette shows it: a template that claims to be a screen has to be
 * able to say which one, and the ones that could not say were the invented ones.
 */
export function templateSource(id: string): string | undefined {
	return GENERATED_SOURCES[id];
}
