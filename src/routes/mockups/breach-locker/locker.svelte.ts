// ── THE LOCKER · state ───────────────────────────────────────────────────────
// One rune class, following the showcase store pattern. The shell components
// read it and nothing else — which is what keeps the studio chrome from growing
// its own private copy of "what is equipped".
//
// The distinction this file exists to hold: OWNERSHIP and EQUIPMENT are two
// different sets, and the shop is the join between them.
//
//   entitlements  what the account HAS   ← server truth, granted or purchased
//   loadout       what is ON right now   ← a choice among what it has
//
// An item's `lock` is neither of those. It is the price tag, and it stays on the
// item forever: it is what a stranger would pay, and it is also the reason the
// ribbon still says ALPHA on a banner somebody was given for free.

import { abilityByKey, klassByKey, ROSTER } from '$examples/breach/internal/rules.js';
import type { CharacterSkin } from 'showcase';
import { DEFAULT_LOADOUT, item, slotsFor, type CosmeticItem, type SlotKey, type Subject } from './catalog.js';

/** Two accounts to look at the same catalogue through. The alpha one is not a
 *  test fixture — it is the reward tier as it will actually read, and the only
 *  way to see whether an owned-but-priced item looks right is to hold one. */
export type Persona = 'new' | 'alpha';

const ENTITLED: Record<Persona, string[]> = {
	new: [],
	alpha: [
		// The charter, in full: every `reward`-locked item in the catalogue. A
		// grant list that lags the catalogue produces an alpha account holding
		// half a set, which is worse than holding none.
		'emblem.zero',
		'banner.gold',
		'hat.crown',
		'hat.halo',
		'back.charter',
		'frame.charter',
		'finish.foil',
		'mark.seal',
		// Bought, not granted — the alpha account has been playing.
		'banner.violet',
		'hat.beret',
		'frame.bracket'
	]
};

const BALANCE: Record<Persona, number> = { new: 620, alpha: 3140 };

export class LockerState {
	/** GET /api/breach/locker → `{ persona, balance_marks, entitlements, loadout }` */
	persona = $state<Persona>('new');
	balance = $state(BALANCE.new);
	#entitlements = $state<string[]>([...ENTITLED.new]);
	loadout = $state<Record<SlotKey, string>>({ ...DEFAULT_LOADOUT });

	/** The side's name, which is the one cosmetic a player types rather than
	 *  picks. It lives here with the rest of the loadout because it ships to the
	 *  table in the same payload — see `teamFlags.set()` in the game. */
	callsign = $state('The Trespass');

	// ── The base ─────────────────────────────────────────────────────────────
	// Both of these are real game objects, not stand-ins: a `Klass` off the
	// roster and an `Ability` out of the generated catalogue. That is the shape
	// of the whole feature — a cosmetic is a layer on something the game already
	// gave you, so the base has to be the game's, or the preview is a lie.
	subject = $state<Subject>('operator');
	klassKey = $state<string>(ROSTER[0].key);
	cardKey = $state<string>('divergence');

	get klass() {
		return klassByKey(this.klassKey);
	}

	/** The roster class, read as what the figure renderer needs. `Klass` carries
	 *  a seat, a resource, four skills and a passive that `Figure` has no use
	 *  for — it supplies the four fields a skin is, so it IS one. */
	get skin(): CharacterSkin {
		return this.klass as CharacterSkin;
	}

	get ability() {
		return abilityByKey(this.cardKey) ?? abilityByKey('divergence')!;
	}

	slot = $state<SlotKey>('headwear');
	/** What the grid has highlighted. Distinct from the equipped item on purpose:
	 *  browsing something you cannot afford must not take your flag off you. */
	previewKey = $state<string>(DEFAULT_LOADOUT.headwear);

	/** Last purchase, for the confirmation flash. */
	justBought = $state<string | null>(null);

	get entitlements() {
		return this.#entitlements;
	}

	owns(key: string) {
		const it = item(key);
		if (!it) return false;
		// No lock means the item ships with the game — everyone owns it.
		return !it.lock || this.#entitlements.includes(key);
	}

	equipped(slot: SlotKey) {
		return this.loadout[slot];
	}

	/** The equipped item in a slot, resolved. Unlike `previewFor` this ignores
	 *  what is being browsed — a tile composes its base out of what is ON. */
	itemAt(slot: SlotKey) {
		return item(this.loadout[slot]);
	}

	isEquipped(key: string) {
		const it = item(key);
		return !!it && this.loadout[it.slot] === key;
	}

	/** What the preview is wearing: the equipped item everywhere except the slot
	 *  being browsed, where the highlighted one stands in. Trying a hat on has to
	 *  show the hat, and it has to keep the flag. */
	previewFor(slot: SlotKey): CosmeticItem | undefined {
		if (slot === this.slot) return item(this.previewKey) ?? item(this.loadout[slot]);
		return item(this.loadout[slot]);
	}

	get selected(): CosmeticItem | undefined {
		return item(this.previewKey);
	}

	get canAfford() {
		const it = this.selected;
		return !!it && it.lock?.kind === 'price' && this.balance >= it.lock.marks;
	}

	selectSlot(slot: SlotKey) {
		this.slot = slot;
		this.previewKey = this.loadout[slot];
	}

	/** Switching subject lands on that subject's first slot rather than keeping a
	 *  slot the new rail does not contain. */
	selectSubject(s: Subject) {
		if (this.subject === s) return;
		this.subject = s;
		this.selectSlot(slotsFor(s)[0].key);
	}

	preview(key: string) {
		this.previewKey = key;
		this.justBought = null;
	}

	/** POST /api/breach/locker/equip `{ slot, item_key }` */
	equip(key: string) {
		const it = item(key);
		if (!it || !this.owns(key)) return;
		this.loadout = { ...this.loadout, [it.slot]: key };
	}

	/** POST /api/breach/locker/purchase `{ item_key }` → new balance + entitlement.
	 *  Equips on success, because nobody buys a hat to leave it in a drawer. */
	buy(key: string) {
		const it = item(key);
		if (!it || it.lock?.kind !== 'price' || this.owns(key)) return;
		if (this.balance < it.lock.marks) return;
		this.balance -= it.lock.marks;
		this.#entitlements = [...this.#entitlements, key];
		this.justBought = key;
		this.equip(key);
	}

	setPersona(p: Persona) {
		this.persona = p;
		this.balance = BALANCE[p];
		this.#entitlements = [...ENTITLED[p]];
		this.justBought = null;
		// Anything equipped that this account cannot claim falls back to default.
		const next = { ...this.loadout };
		for (const [slot, key] of Object.entries(next) as [SlotKey, string][]) {
			if (!this.owns(key)) next[slot] = DEFAULT_LOADOUT[slot];
		}
		this.loadout = next;
		this.previewKey = this.loadout[this.slot];
	}

	get dirty() {
		return (Object.keys(DEFAULT_LOADOUT) as SlotKey[]).some(
			(s) => this.loadout[s] !== DEFAULT_LOADOUT[s]
		);
	}

	reset() {
		this.loadout = { ...DEFAULT_LOADOUT };
		this.previewKey = DEFAULT_LOADOUT[this.slot];
		this.justBought = null;
	}
}
