// ── backdrops — every backdrop the app can paint, as one list ───────────────
//
// There are two kinds of thing in here and it is worth being clear about the
// difference, because it is the reason this file exists at all:
//
//   FAMILIES    — genuinely different pieces of art with their own component.
//                 Ash Drift, Long Scan, Drift Strata, Isoline Terrain,
//                 Current Field.
//   COMPOSITIONS — arrangements WITHIN one family. The Möbius presets are all
//                 the same component with different strip data.
//
// A selector does not care about that distinction: a person picking a backdrop
// is choosing a look, not a rendering strategy. So both are flattened into one
// id space here, and `Backdrop.svelte` is the single place that knows which id
// needs which component.
//
// `cost` is not decoration. Every backdrop is a per-frame expense on a dense
// page, and a settings row that says so lets someone choose honestly instead of
// discovering it on a low-end laptop.

import type { Component } from 'svelte';
import AshDrift from './AshDrift.svelte';
import CurrentField from './CurrentField.svelte';
import DriftStrata from './DriftStrata.svelte';
import IsolineTerrain from './IsolineTerrain.svelte';
import LongScan from './LongScan.svelte';
import ShearWeave from './ShearWeave.svelte';
import { PRESET_IDS, type PresetId } from './presets.js';

export type FamilyId =
	| 'ash-drift'
	| 'long-scan'
	| 'drift-strata'
	| 'isoline-terrain'
	| 'current-field'
	| 'shear-weave';

/** Everything selectable, `none` included. */
export type BackdropId = 'none' | FamilyId | PresetId;

export interface BackdropMeta {
	id: BackdropId;
	label: string;
	/** One line for a settings row. Says what it costs where that matters. */
	description: string;
	/** Ordering hint and an honest warning. */
	cost: 'free' | 'cheap' | 'moderate' | 'heavy';
}

/**
 * The standalone families, in the order they should be offered.
 *
 * Typed as taking numeric props rather than `Record<string, never>`. The old
 * type said "these components have no inputs", which was never true — every one
 * of them declares real props — and it made that untrue statement structural:
 * no caller could pass `scale` or `density` without a cast, so nothing ever
 * did, and the props sat unreachable. `FAMILY_KNOBS` declares which ones each
 * family actually has; this type is what lets them through.
 */
export const FAMILIES: Record<FamilyId, Component<Record<string, number>>> = {
	'ash-drift': AshDrift as Component<Record<string, number>>,
	'long-scan': LongScan as Component<Record<string, number>>,
	'drift-strata': DriftStrata as Component<Record<string, number>>,
	'isoline-terrain': IsolineTerrain as Component<Record<string, number>>,
	'current-field': CurrentField as Component<Record<string, number>>,
	'shear-weave': ShearWeave as Component<Record<string, number>>
};

const FAMILY_META: BackdropMeta[] = [
	{
		id: 'ash-drift',
		label: 'Ash drift',
		description: 'Two grain layers drifting against each other. No JS at all.',
		cost: 'free'
	},
	{
		id: 'long-scan',
		label: 'Long scan',
		description: 'A still hatched plate and one slow raking light. The cheapest.',
		cost: 'free'
	},
	{
		id: 'drift-strata',
		label: 'Drift strata',
		description: 'Blurred atmosphere in hard bands, sliding at different speeds.',
		cost: 'moderate'
	},
	{
		id: 'isoline-terrain',
		label: 'Isoline terrain',
		description: 'Contours of a landscape you cannot see. Traced once at load.',
		cost: 'cheap'
	},
	{
		id: 'current-field',
		label: 'Current field',
		description: 'Ink trails on a flow field. The only one that runs every frame.',
		cost: 'heavy'
	},
	{
		id: 'shear-weave',
		label: 'Shear weave',
		description: 'A diagonal accent pool under an off-square lattice, slowly shearing.',
		cost: 'free'
	}
];

/** How expensive each Möbius composition is, so the list can say so. */
function mobiusCost(id: PresetId): BackdropMeta['cost'] {
	if (id === 'spider-verse') return 'heavy';
	if (id === 'mr robot' || id === 'ribbon') return 'cheap';
	return 'moderate';
}

function mobiusNote(id: PresetId): string {
	if (id === 'spider-verse') return 'Every strip drawn twice — the most expensive.';
	if (id === 'mr robot') return 'Three strips, minimal motion — the cheapest Möbius.';
	return 'An animated Möbius composition.';
}

/**
 * Every option, in menu order: none, then the families, then the Möbius
 * compositions. Families first because they are the distinct looks; the Möbius
 * presets are variations on one, and burying them last keeps the top of the
 * list meaningful.
 */
export const BACKDROPS: BackdropMeta[] = [
	{ id: 'none', label: 'None', description: 'No backdrop. Genuinely nothing painted.', cost: 'free' },
	...FAMILY_META,
	...PRESET_IDS.map(
		(id): BackdropMeta => ({
			id,
			label: `Möbius · ${id}`,
			description: mobiusNote(id),
			cost: mobiusCost(id)
		})
	)
];

export const BACKDROP_IDS: BackdropId[] = BACKDROPS.map((b) => b.id);

/** True when the id is a Möbius composition rather than a standalone family. */
export function isMobius(id: BackdropId): id is PresetId {
	return (PRESET_IDS as string[]).includes(id);
}

export function isFamily(id: BackdropId): id is FamilyId {
	return id in FAMILIES;
}

// ── Stacks — more than one backdrop at a time ───────────────────────────────
//
// A backdrop is a layer, and layers compose: Ash Drift's settling dust UNDER
// Current Field's ink trails is a look neither one has alone, and the only
// thing that stood between them was a selector that stored a single id.
//
// The stored form is a comma-joined id list, bottom layer first, so a stack
// survives every place a backdrop is already persisted as a string — a builder
// prop value, a settings key, a scene channel — with no schema change and no
// migration. Single ids keep working unchanged and are just stacks of one,
// which is why this is an encoding rather than a new field.
//
// `,` is safe as the separator: no family id and no Möbius preset name contains
// one (`mr robot` and `silicon valley` contain spaces, hence not that).

const SEP = ',';

/**
 * Read a stored value as a stack.
 *
 * Unknown ids are DROPPED rather than passed through: a renamed composition
 * would otherwise resolve to nothing and paint an empty layer, which looks
 * exactly like a working backdrop that has gone black. Duplicates collapse —
 * a family stacked on itself is a per-frame cost with no visible change.
 *
 * Returns `[]` for `none` or for nothing recognisable, so callers can treat
 * "no backdrop" as "no layers" instead of special-casing a magic id.
 */
export function parseStack(value: unknown): BackdropId[] {
	if (Array.isArray(value)) return parseStack(value.join(SEP));
	if (typeof value !== 'string') return [];
	const seen = new Set<string>();
	const out: BackdropId[] = [];
	for (const raw of value.split(SEP)) {
		const id = raw.trim();
		if (!id || id === 'none' || seen.has(id)) continue;
		if (!(BACKDROP_IDS as string[]).includes(id)) continue;
		seen.add(id);
		out.push(id as BackdropId);
	}
	return out;
}

/** The stored form. An empty stack is `none`, not an empty string. */
export function formatStack(ids: readonly BackdropId[]): string {
	const kept = ids.filter((id) => id !== 'none');
	return kept.length ? kept.join(SEP) : 'none';
}

/**
 * Add or remove one id, preserving order.
 *
 * `none` is exclusive on both sides: choosing it clears the stack, and choosing
 * anything else drops it. Nothing else in here is mutually exclusive — that is
 * the whole point.
 */
export function toggleStack(ids: readonly BackdropId[], id: BackdropId): BackdropId[] {
	if (id === 'none') return [];
	const stack = ids.filter((x) => x !== 'none');
	return stack.includes(id) ? stack.filter((x) => x !== id) : [...stack, id];
}

/**
 * How a stacked layer composites over the ones below it.
 *
 * `screen` is the default rather than `normal` because these are dark plates
 * with faint marks on them: normal blending means the top layer's ground
 * covers everything under it and stacking buys nothing, while screen keeps only
 * what each layer ADDS. `normal` is still offered for the case where occluding
 * is the intent.
 */
export const BLEND_MODES = ['screen', 'lighten', 'plus-lighter', 'overlay', 'soft-light', 'normal'] as const;

export type BlendMode = (typeof BLEND_MODES)[number];

export const DEFAULT_BLEND: BlendMode = 'screen';
