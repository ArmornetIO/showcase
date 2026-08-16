// ── Scene vocabulary — what a thing can be made to do ──────────────────────
// The taxonomy that matters is CHANNEL vs BURST, and it is not cosmetic: it
// decides whether scrubbing is exact.
//
//   A CHANNEL has a well-defined value at EVERY t. Held between cues, falling
//   back to the object's declared value. Purity: total.
//
//   A BURST has no value at arbitrary t — only an onset. Purity: contained, by
//   keeping them short and never letting one carry narrative information. If
//   the story is unreadable without a burst, it should have been a channel.
//
// Channels split again by interpolation. `lerp` for numbers with a range;
// `step` for enums, strings and booleans — because most of this vocabulary is
// genuinely not interpolatable. `EdgeStyle` is an 8-way enum; forcing it
// through a numeric pipe would mean inventing a value halfway between
// 'blocked' and 'scanning', which does not exist.

import type { ObjectKind } from './types.js';
import { EDGE_STYLE_DASH } from '../primitives/canvas.types.js';
import { COMPONENT_CHANNELS, channelsForComponent } from './component-channels.js';

export type ChannelType = 'lerp' | 'step';

export interface Channel {
	id: string;
	label: string;
	/** Which object kinds this can be bound to. */
	kinds: ObjectKind[];
	/** Dotted path into the object's payload. */
	path: string;
	type: ChannelType;
	/** lerp only. */
	range?: [number, number];
	/** step only. */
	options?: string[];
	/** Grouping in the picker. */
	group: string;
	/** Sensible default target value, so a cue can be created in one keystroke. */
	preset?: unknown;
	/** Carried through from `PropDef` for generated component channels — a prop
	 *  the component's current configuration hides is not offered. */
	showWhen?: { key: string; values: string[] };
}

export const NODE_STATES = ['healthy', 'degraded', 'offline'];
export const EDGE_STYLES = Object.keys(EDGE_STYLE_DASH).concat(['scanning', 'encrypted', 'pulse']);
export const NODE_TYPES = ['control-plane', 'agentic', 'proxy', 'daemon'];

export const CHANNELS: Channel[] = [
	// ── Mesh node ──────────────────────────────────────────────────────────
	{
		id: 'node.state',
		label: 'State',
		kinds: ['mesh.node'],
		path: 'node.state',
		type: 'step',
		options: NODE_STATES,
		group: 'State',
		preset: 'offline',
	},
	{
		id: 'node.flow',
		label: 'Flow',
		kinds: ['mesh.node'],
		path: 'node.flow',
		type: 'lerp',
		range: [0, 1],
		group: 'Energy',
		preset: 1,
	},
	{
		id: 'node.opacity',
		label: 'Opacity',
		kinds: ['mesh.node'],
		path: 'node.opacity',
		type: 'lerp',
		range: [0, 1],
		group: 'Visibility',
		preset: 0,
	},
	{
		id: 'node.r',
		label: 'Radius',
		kinds: ['mesh.node'],
		path: 'node.r',
		type: 'lerp',
		range: [8, 90],
		group: 'Form',
		preset: 52,
	},
	{
		id: 'node.type',
		label: 'Type',
		kinds: ['mesh.node'],
		path: 'node.type',
		type: 'step',
		options: NODE_TYPES,
		group: 'Form',
		preset: 'proxy',
	},
	{
		id: 'node.label',
		label: 'Label',
		kinds: ['mesh.node'],
		path: 'node.label',
		type: 'step',
		group: 'Text',
		preset: '',
	},

	// ── Mesh edge ──────────────────────────────────────────────────────────
	{
		id: 'edge.style',
		label: 'Style',
		kinds: ['mesh.edge'],
		path: 'edge.style',
		type: 'step',
		options: EDGE_STYLES,
		group: 'State',
		preset: 'blocked',
	},
	{
		id: 'edge.sig',
		label: 'Signal',
		kinds: ['mesh.edge'],
		path: 'edge.sig',
		type: 'lerp',
		range: [0, 1],
		group: 'Energy',
		preset: 1,
	},
	{
		id: 'edge.active',
		label: 'Particles',
		kinds: ['mesh.edge'],
		path: 'edge.active',
		type: 'step',
		options: ['true', 'false'],
		group: 'Energy',
		preset: 'false',
	},
	{
		id: 'edge.label',
		label: 'Label',
		kinds: ['mesh.edge'],
		path: 'edge.label',
		type: 'step',
		group: 'Text',
		preset: '',
	},

	// ── Component ──────────────────────────────────────────────────────────
	// Deliberately thin here. The real answer is to GENERATE these from
	// `builder/registry.ts` PropDefs (kind:'number' → lerp, 'enum' → step …),
	// which covers every component in the library for free. These three are the
	// wrapper-level properties that no PropDef describes.
	{
		id: 'component.opacity',
		label: 'Opacity',
		kinds: ['component'],
		path: 'component.opacity',
		type: 'lerp',
		range: [0, 1],
		group: 'Visibility',
		preset: 1,
	},
	{
		id: 'component.w',
		label: 'Width',
		kinds: ['component'],
		path: 'component.w',
		type: 'lerp',
		range: [120, 640],
		group: 'Form',
		preset: 360,
	},
];

export interface Burst {
	id: string;
	label: string;
	kinds: ObjectKind[];
	group: string;
	/** Bursts are capped: a long one is narrative, and narrative belongs in a
	 *  channel where scrubbing can reproduce it. */
	maxMs: number;
	/** Description shown in the picker — what it is FOR, not what it looks like. */
	hint: string;
}

export const BURSTS: Burst[] = [
	{
		id: 'flourish.aurora',
		label: 'Aurora glow',
		kinds: ['mesh.node', 'component'],
		group: 'Flourish',
		maxMs: 1200,
		hint: 'Sweeping bloom — highlights a thing already on screen',
	},
	{
		id: 'flourish.sparkle',
		label: 'Sparkle',
		kinds: ['mesh.node', 'component'],
		group: 'Flourish',
		maxMs: 900,
		hint: 'Small radial burst — marks a moment of success',
	},
	{
		id: 'flourish.firework',
		label: 'Firework',
		kinds: ['mesh.node', 'component'],
		group: 'Flourish',
		maxMs: 1000,
		hint: 'Loud radial burst — use once per scene at most',
	},
	{
		id: 'flourish.shimmer',
		label: 'Shimmer',
		kinds: ['mesh.node', 'component'],
		group: 'Flourish',
		maxMs: 900,
		hint: 'Light sweep across the object — reads as “refreshed”',
	},
	{
		id: 'fx.ring',
		label: 'Shockwave',
		kinds: ['mesh.node'],
		group: 'Impact',
		maxMs: 1200,
		hint: 'Expanding ring — marks an instant of impact or interception',
	},
];

export const EASES: { id: string; label: string }[] = [
	{ id: 'linear', label: 'Linear' },
	{ id: 'in', label: 'Ease in' },
	{ id: 'out', label: 'Ease out' },
	{ id: 'inOut', label: 'Ease in-out' },
];

/** Hand-written channels first, then the ones generated from the builder
 *  registry — so a cue can name `props.Card.title` and be resolved without the
 *  evaluator knowing where the channel came from. */
export function channelById(id: string): Channel | undefined {
	return CHANNELS.find((c) => c.id === id) ?? COMPONENT_CHANNELS.get(id);
}

export function burstById(id: string): Burst | undefined {
	return BURSTS.find((b) => b.id === id);
}

/**
 * Everything bindable to the current selection, for the scoped picker.
 *
 * For a component, the wrapper-level channels (opacity, width) are joined by
 * every animatable prop the registry declares for that component — filtered by
 * `showWhen` against the instance's current props, so a Card of type 'stat' is
 * not offered a cue that drives a `title` it does not render.
 */
export function vocabularyFor(
	kind: ObjectKind,
	componentId?: string,
	props?: Record<string, unknown>,
): { channels: Channel[]; bursts: Burst[] } {
	const own = CHANNELS.filter((c) => c.kinds.includes(kind));
	const generated =
		kind === 'component' && componentId ? channelsForComponent(componentId, props ?? {}) : [];
	return {
		channels: [...own, ...generated],
		bursts: BURSTS.filter((b) => b.kinds.includes(kind)),
	};
}
