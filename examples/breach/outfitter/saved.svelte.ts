// ── Saved characters ─────────────────────────────────────────────────────────
// Looks a player keeps so they can come back to one after trying something
// else. The server stores ONE appearance per player, so these live in this browser only until it has somewhere to put them.
import { readJson, writeJson } from 'showcase';
import { DEFAULT_APPEARANCE, type Appearance } from '../internal/appearance.js';

const KEY = 'breach.outfitter.saved';
export const SLOTS = 6;

/** Two looks so the tab has something in it on a first visit. Free items only,
 *  so a new account can wear both. */
const SEED: (Appearance | null)[] = [
	{
		...DEFAULT_APPEARANCE,
		loadout: { build: 'build.brute', crown: 'hat.hardhat', brow: 'hat.visor', trim: 'trim.amber' },
		callsign: 'Ironside'
	},
	{
		...DEFAULT_APPEARANCE,
		loadout: { build: 'build.ghost', crown: 'hat.headset', brow: 'hat.visor', trim: 'trim.sky' },
		callsign: 'Wisp'
	},
	null,
	null,
	null,
	null
];

const copy = (look: Appearance): Appearance => ({
	...look,
	loadout: { ...look.loadout },
	tints: { ...look.tints }
});

/** Key order is not part of a look: a boot painted before a hat is the same
 *  outfit as the hat painted first. */
function stable(v: unknown): string {
	if (v && typeof v === 'object' && !Array.isArray(v)) {
		const o = v as Record<string, unknown>;
		return `{${Object.keys(o)
			.sort()
			.map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
			.join(',')}}`;
	}
	return JSON.stringify(v);
}

const isLook = (v: unknown): v is Appearance =>
	!!v && typeof v === 'object' && typeof (v as Appearance).loadout === 'object';

class SavedLooks {
	#slots = $state<(Appearance | null)[]>(SEED.map((s) => (s ? copy(s) : null)));

	get slots() {
		return this.#slots;
	}

	#hydrated = false;

	/** Idempotent: reads storage once. */
	hydrate() {
		if (this.#hydrated) return;
		this.#hydrated = true;
		this.#slots = readJson(KEY, this.#slots, (parsed) =>
			Array.isArray(parsed) && parsed.length === SLOTS && parsed.every((s) => s === null || isLook(s))
				? (parsed as (Appearance | null)[])
				: null
		);
	}

	indexOf(look: Appearance) {
		const key = stable(look);
		return this.#slots.findIndex((s) => !!s && stable(s) === key);
	}

	/** Into the first empty slot. The slot it landed in, or -1 when all are full. */
	save(look: Appearance) {
		const i = this.#slots.indexOf(null);
		if (i >= 0) this.saveAt(i, look);
		return i;
	}

	saveAt(i: number, look: Appearance) {
		this.#slots = this.#slots.map((s, n) => (n === i ? copy(look) : s));
		writeJson(KEY, this.#slots);
	}

	remove(i: number) {
		this.#slots = this.#slots.map((s, n) => (n === i ? null : s));
		writeJson(KEY, this.#slots);
	}
}

export const saved = new SavedLooks();
