import { describe, it, expect } from 'vitest';
import {
	BACKDROPS,
	BACKDROP_IDS,
	FAMILIES,
	formatStack,
	isFamily,
	parseStack,
	toggleStack,
	type BackdropId,
	type FamilyId
} from './backdrops.js';
import { FAMILY_KNOBS, familyKnobs } from './family-knobs.js';
import { knobKey, toCss, toParams } from './backdrop-tokens.js';

// Two contracts are locked down here.
//
// THE STACK ENCODING, because it is a string format that three separate stores
// round-trip through — the builder's saved props, the advanced settings key,
// and a scene channel — and none of them validate it. If `parseStack` ever
// stopped dropping ids that no longer resolve, a renamed composition would
// paint an empty layer, which looks exactly like a backdrop that has gone
// black rather than like a bug.
//
// THE FAMILY KNOB DECLARATIONS, because they are a second description of what
// each family reads. The declaration and the component agreeing is the entire
// premise of a generated control panel, and a knob with no reader is a slider
// that does nothing.

describe('backdrop stacks', () => {
	it('reads a single id as a stack of one', () => {
		expect(parseStack('ash-drift')).toEqual(['ash-drift']);
	});

	it('reads a comma-joined list, bottom layer first', () => {
		expect(parseStack('ash-drift,current-field')).toEqual(['ash-drift', 'current-field']);
	});

	it('tolerates whitespace around the separator', () => {
		expect(parseStack(' ash-drift , current-field ')).toEqual(['ash-drift', 'current-field']);
	});

	it('treats none and unrecognised ids as no layer at all', () => {
		expect(parseStack('none')).toEqual([]);
		expect(parseStack('')).toEqual([]);
		expect(parseStack(undefined)).toEqual([]);
		expect(parseStack('a-composition-that-was-renamed')).toEqual([]);
	});

	it('keeps the layers it still recognises when one has gone', () => {
		expect(parseStack('ash-drift,deleted-preset,current-field')).toEqual([
			'ash-drift',
			'current-field'
		]);
	});

	it('collapses a family stacked on itself', () => {
		expect(parseStack('ash-drift,ash-drift')).toEqual(['ash-drift']);
	});

	it('accepts an array as well as a string', () => {
		expect(parseStack(['ash-drift', 'long-scan'])).toEqual(['ash-drift', 'long-scan']);
	});

	it('round-trips through the stored form', () => {
		const stored = formatStack(['ash-drift', 'current-field']);
		expect(stored).toBe('ash-drift,current-field');
		expect(parseStack(stored)).toEqual(['ash-drift', 'current-field']);
	});

	it('stores an empty stack as none, not an empty string', () => {
		expect(formatStack([])).toBe('none');
		expect(formatStack(['none'])).toBe('none');
	});

	it('every id the menu offers survives a round trip', () => {
		for (const id of BACKDROP_IDS) {
			if (id === 'none') continue;
			expect(parseStack(formatStack([id])), `${id} did not round-trip`).toEqual([id]);
		}
	});

	it('separator cannot appear inside an id', () => {
		for (const id of BACKDROP_IDS) expect(id).not.toContain(',');
	});
});

describe('toggleStack', () => {
	it('adds on top and removes in place', () => {
		expect(toggleStack(['ash-drift'], 'current-field')).toEqual(['ash-drift', 'current-field']);
		expect(toggleStack(['ash-drift', 'current-field'], 'ash-drift')).toEqual(['current-field']);
	});

	it('preserves the order layers were added in', () => {
		let stack: BackdropId[] = [];
		for (const id of ['long-scan', 'ash-drift', 'current-field'] as BackdropId[]) {
			stack = toggleStack(stack, id);
		}
		expect(stack).toEqual(['long-scan', 'ash-drift', 'current-field']);
	});

	it('treats none as exclusive in both directions', () => {
		expect(toggleStack(['ash-drift', 'current-field'], 'none')).toEqual([]);
		expect(toggleStack(['none'], 'ash-drift')).toEqual(['ash-drift']);
	});
});

describe('family knobs', () => {
	const ids = Object.keys(FAMILIES) as FamilyId[];

	it('declares knobs for every family', () => {
		for (const id of ids) expect(FAMILY_KNOBS[id]?.length, `${id} has no knobs`).toBeGreaterThan(0);
	});

	it('names no knob twice within a family', () => {
		for (const id of ids) {
			const keys = FAMILY_KNOBS[id].map(knobKey);
			expect(new Set(keys).size, `${id} declares a knob twice`).toBe(keys.length);
		}
	});

	it('gives every knob a value inside its own bounds', () => {
		for (const id of ids) {
			for (const k of FAMILY_KNOBS[id]) {
				if (k.kind === 'color') continue;
				expect(k.value, `${id}.${knobKey(k)} starts below its min`).toBeGreaterThanOrEqual(k.min);
				expect(k.value, `${id}.${knobKey(k)} starts above its max`).toBeLessThanOrEqual(k.max);
			}
		}
	});

	it('splits cleanly into CSS declarations and component props', () => {
		const knobs = familyKnobs('ash-drift');
		// `scale` is a prop on the component; `--ash-grain` is a custom property
		// it reads. Neither may leak into the other bucket.
		expect(toParams(knobs)).toHaveProperty('scale');
		expect(toCss(knobs)).toContain('--ash-grain');
		expect(toCss(knobs)).not.toContain('scale:');
	});

	/**
	 * Ash Drift and Drift Strata both used to read `--backdrop-tint`, meaning
	 * different things at different alphas, so tuning either silently retuned the
	 * other. Nothing catches that by looking at one family — it only shows up as
	 * a name appearing in two lists.
	 *
	 * `--backdrop-ground` is the deliberate exception: it is genuinely one
	 * concept, and `Backdrop` overrides it per layer precisely because it is
	 * shared.
	 */
	it('shares no token between two families except the ground', () => {
		const owners = new Map<string, FamilyId[]>();
		for (const id of ids) {
			for (const k of FAMILY_KNOBS[id]) {
				if (k.kind === 'param') continue;
				owners.set(k.token, [...(owners.get(k.token) ?? []), id]);
			}
		}
		for (const [token, held] of owners) {
			if (token === '--backdrop-ground') continue;
			expect(held, `${token} is read by more than one family`).toHaveLength(1);
		}
	});

	it('hands out a copy, so editing one layer cannot retune the declaration', () => {
		const a = familyKnobs('ash-drift');
		a[0].value = 'rgba(1, 2, 3, 1)';
		expect(familyKnobs('ash-drift')[0].value).toBe(FAMILY_KNOBS['ash-drift'][0].value);
	});

	it('every family in the menu is a family the knob table knows', () => {
		for (const b of BACKDROPS) {
			if (!isFamily(b.id)) continue;
			expect(FAMILY_KNOBS[b.id], `${b.id} is offered but has no knobs`).toBeDefined();
		}
	});
});
