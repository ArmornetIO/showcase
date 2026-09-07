// ── THE OUTFITTER · state ────────────────────────────────────────────────────
// One rune class, following the showcase store pattern. The shell reads this
// and nothing else, which is what stops the chrome growing a private copy of
// "what is equipped".
//
// The distinction this file exists to hold, carried over from the Locker
// unchanged because it was the right one: OWNERSHIP and EQUIPMENT are two
// different sets, and the shop is the join between them.
//
//   entitlements  what the account HAS   ← server truth, granted or purchased
//   loadout       what is ON right now   ← a choice among what it has
//
// An item's `lock` is neither. It is the price tag, and it stays on the item
// for ever: it is what a stranger would pay, and it is also why the ribbon
// still says ALPHA on a crown somebody was given.

import { BODY_PARTS } from '$lib/character/builds.js';
import { assemble } from '$lib/character/wearables.js';
import { CHARACTERS, type CharacterSkin } from '$lib/character/characters.js';
import { CLIP_DEFAULTS, type ClipId, type ClipOpts } from '$lib/character/poses.js';
import { DEFAULT_ART } from '$lib/character/render.js';
import {
	CATEGORIES,
	DEFAULT_LOADOUT,
	inCategory,
	item,
	slotsOf,
	wornFrom,
	type Category,
	type Item
} from './catalog.js';

export type Persona = 'new' | 'alpha';

const ENTITLED: Record<Persona, string[]> = {
	new: [],
	alpha: [
		// The charter in full: every reward-locked item in the catalogue. A grant
		// list that lags the catalogue produces an alpha account holding half a
		// set, which is worse than holding none.
		'hat.crown',
		'hat.halo',
		'emblem.zero',
		'trim.gold',
		// Bought, not granted — this account has been playing.
		'hat.beret',
		'trim.violet'
	]
};

const BALANCE: Record<Persona, number> = { new: 620, alpha: 3140 };

/** The camera, in radians. Defaults match `DEFAULT_ART` so the Outfitter opens
 *  on the same three-quarter view every roster tile uses. */
const REST_CAMERA = { yaw: 0.62, pitch: 0.11 };

export class OutfitterState {
	persona = $state<Persona>('new');
	balance = $state(BALANCE.new);
	#entitlements = $state<string[]>([...ENTITLED.new]);
	loadout = $state<Record<string, string>>({ ...DEFAULT_LOADOUT });
	callsign = $state('The Trespass');

	/** The figure being dressed. A real roster character, because a cosmetic is
	 *  a layer on something the game already gave you — a preview against a
	 *  stand-in is a preview of nothing. */
	who = $state<CharacterSkin>(CHARACTERS[0]);

	category = $state<Category>('crown');
	/** What the list has highlighted. Distinct from what is equipped on purpose:
	 *  browsing something you cannot afford must not take your colour off you. */
	previewKey = $state<string>(DEFAULT_LOADOUT.crown);


	/** Camera. Lives here rather than in the component so that changing category
	 *  cannot reset it — comparing two hats at the same angle is the entire
	 *  reason the stage turns. */
	yaw = $state(REST_CAMERA.yaw);
	pitch = $state(REST_CAMERA.pitch);
	/** How much of the stage the figure fills. Well under 1: a model cropped to
	 *  the frame edge has nowhere to stand, and half the catalogue adds height
	 *  above the crown that a tight fit pushes off the top. */
	zoom = $state(0.68);

	// ── The clip ─────────────────────────────────────────────────────────────
	// Back from the Character Studio, because "how does this hat look while the
	// character is MOVING" is a question a shop has to answer — a top hat that
	// separates from the head on the third frame of a walk is a top hat nobody
	// keeps. `still` is the pose everything else is measured against; `idle` is
	// the default, since a perfectly motionless figure reads as a prop.
	clip = $state<ClipId>('idle');
	/** Cycles per second, as a multiplier. Past about 2 a walk becomes a run the
	 *  legs are not long enough for, which is exactly what makes it fun. */
	speed = $state(1);
	stride = $state(CLIP_DEFAULTS.stride);
	swing = $state(CLIP_DEFAULTS.swing);
	bob = $state(CLIP_DEFAULTS.bob);

	get clipOpts(): ClipOpts {
		return { stride: this.stride, swing: this.swing, bob: this.bob };
	}

	// ── Paint ────────────────────────────────────────────────────────────────
	// The Character Studio's colour knobs, brought back — one per MATERIAL,
	// which between them cover every painted face on the model. There is no
	// fifth surface hiding somewhere: `builds.ts` declares exactly four, and a
	// part that wanted its own colour would have to become a fifth material
	// rather than a special case here.
	//
	// `null` means "whatever this character already is", not a colour. That
	// distinction is what lets the four figures keep their own identities until
	// somebody deliberately overrides one — a default of `#38BDF8` would repaint
	// the Maintainer blue the moment the panel mounted.
	suit = $state<string>(DEFAULT_ART.suit);
	plate = $state<string | null>(null);
	lamp = $state<string | null>(null);

	/**
	 * Per-thing overrides, keyed by body tag or worn item key.
	 *
	 * The four materials above are the broadcast — move `suit` and every
	 * suit-material mass moves together. This is how ONE thing gets its own
	 * colour: one boot, one hat, the visor. Sparse, so an absent key means "the
	 * material decides" and clearing a part is a delete rather than a guess at
	 * what it used to be.
	 */
	tints = $state<Record<string, string>>({});

	paintOne(slot: string, color: string) {
		this.tints = { ...this.tints, [slot]: color };
	}

	clearOne(slot: string) {
		const { [slot]: _gone, ...rest } = this.tints;
		this.tints = rest;
	}

	/**
	 * Everything on this figure that can be painted, in the order a person reads
	 * a body: the masses it is made of, then the things it has on.
	 *
	 * Derived from `BODY_PARTS` and the live loadout rather than listed by hand,
	 * so a new body mass or a new hat is paintable the moment it exists. Body
	 * parts a build does not have are dropped — a drone has no boots, and a
	 * colour picker for a part that is not there is a control that does nothing.
	 */
	get paintables(): { slot: string; label: string; group: 'body' | 'worn'; value: string }[] {
		// Ask the assembled figure what is actually ON it, rather than trusting
		// the loadout. Two things fall out for free: a build without boots is not
		// offered boots, and an item that contributes no geometry (`hat.none` is
		// a real catalogue entry meaning "bare") gets no row — a colour picker
		// for nothing is a control that does nothing.
		const parts = assemble(this.who.shape, this.worn);
		const present = new Set(parts.map((p) => p.tag).filter(Boolean));
		const owners = new Set(parts.map((p) => p.owner).filter(Boolean));
		const base: Record<string, string> = {
			suit: this.suit,
			plate: this.plate ?? this.who.color,
			lamp: this.lamp ?? this.plate ?? this.who.color,
			trim: this.trim
		};
		const body = BODY_PARTS.filter((b) => present.has(b.tag)).map((b) => ({
			slot: b.tag as string,
			label: b.label,
			group: 'body' as const,
			value: this.tints[b.tag] ?? base[b.mat]
		}));
		// A wearable key IS its catalogue key — `catalog.ts` builds items with
		// `wearable: key` — so the shop's name for a thing is one lookup away and
		// the panel never invents its own.
		const worn = this.worn
			.filter((key) => owners.has(key))
			.map((key) => ({
				slot: key,
				label: item(key)?.name ?? key,
				group: 'worn' as const,
				value: this.tints[key] ?? base.trim
			}));
		return [...body, ...worn];
	}

	/** The character as painted: its own build and name, wearing whatever plate
	 *  the panel currently says. */
	get skin(): CharacterSkin {
		return this.plate ? { ...this.who, color: this.plate } : this.who;
	}

	/** Every colour the renderer needs, resolved. `lamp: undefined` is not the
	 *  same as a colour — it tells `art()` to keep following the plate. */
	get paint() {
		return {
			suit: this.suit,
			lamp: this.lamp ?? undefined,
			trim: this.trim,
			tints: this.tints
		};
	}

	get painted() {
		return this.suit !== DEFAULT_ART.suit || !!this.plate || !!this.lamp;
	}

	/** Which paint row the panel should call out, when the way in was a swatch
	 *  in the header rather than the menu. Landing on the panel is not the same
	 *  as landing on the row you clicked. */
	paintFocus = $state<'suit' | 'plate' | 'lamp' | 'trim' | null>(null);

	/** Every colour on the model, resolved, for the header's swatches. */
	get swatches() {
		return [
			{ key: 'suit' as const, label: 'Suit', value: this.suit },
			{ key: 'plate' as const, label: 'Plate', value: this.plate ?? this.who.color },
			{ key: 'lamp' as const, label: 'Visor', value: this.lamp ?? this.plate ?? this.who.color },
			{ key: 'trim' as const, label: 'Swag', value: this.trim }
		];
	}

	openPaint(focus: 'suit' | 'plate' | 'lamp' | 'trim') {
		this.selectCategory('trim');
		this.paintFocus = focus;
	}

	resetPaint() {
		this.suit = DEFAULT_ART.suit;
		this.plate = null;
		this.lamp = null;
	}

	justBought = $state<string | null>(null);

	get entitlements() {
		return this.#entitlements;
	}

	owns(key: string) {
		const i = item(key);
		if (!i) return false;
		// No lock means the item ships with the game — everyone owns it.
		return !i.lock || this.#entitlements.includes(key);
	}

	equipped(c: Category) {
		return this.loadout[slotsOf(c)[0] ?? c];
	}

	/** What the filter shows for a category. For the card that is its BACK — the
	 *  one piece that is always there and carries the others. */
	equippedItem(c: Category) {
		return item(this.equipped(c));
	}

	isEquipped(key: string) {
		const i = item(key);
		return !!i && this.loadout[i.slot] === key;
	}

	/** What the stage is wearing: the equipped item everywhere except the
	 *  category being browsed, where the highlighted one stands in. Trying a hat
	 *  on has to show the hat, and it has to keep the colour. */
	get previewLoadout(): Record<string, string> {
		const sel = item(this.previewKey);
		// Swap the browsed item into ITS OWN slot, not the category's first one —
		// browsing a frame must show the frame on the card it sits on, rather
		// than replacing the card.
		return sel ? { ...this.loadout, [sel.slot]: sel.key } : this.loadout;
	}

	/** The wearable keys for `art({ worn })`. */
	get worn() {
		return wornFrom(this.previewLoadout);
	}

	get trim() {
		return item(this.previewLoadout.trim)?.color ?? '#FB7185';
	}

	get selected(): Item | undefined {
		return item(this.previewKey);
	}

	get list() {
		return inCategory(this.category);
	}

	get canAfford() {
		const i = this.selected;
		return !!i && i.lock?.kind === 'price' && this.balance >= i.lock.marks;
	}

	selectCategory(c: Category) {
		if (this.category === c) return;
		this.category = c;
		this.previewKey = this.equipped(c) || (inCategory(c)[0]?.key ?? '');
	}

	preview(key: string) {
		this.previewKey = key;
		this.justBought = null;
	}

	/** POST /api/breach/outfitter/equip `{ category, item_key }` */
	equip(key: string) {
		const i = item(key);
		if (!i || !this.owns(key)) return false;
		this.loadout = { ...this.loadout, [i.slot]: key };
		return true;
	}

	/** POST /api/breach/outfitter/purchase `{ item_key }` → balance + entitlement.
	 *  Equips on success, because nobody buys a hat to leave it in a drawer. */
	buy(key: string) {
		const i = item(key);
		if (!i || i.lock?.kind !== 'price' || this.owns(key)) return;
		if (this.balance < i.lock.marks) return;
		this.balance -= i.lock.marks;
		this.#entitlements = [...this.#entitlements, key];
		this.justBought = key;
		this.equip(key);
	}

	/** The one action the list's button performs, whatever state the item is in.
	 *  One control, because "buy" and "equip" in two places is how a player ends
	 *  up owning something they cannot find. */
	act() {
		const i = this.selected;
		if (!i) return;
		if (this.owns(i.key)) this.equip(i.key);
		else if (i.lock?.kind === 'price') this.buy(i.key);
	}

	setPersona(p: Persona) {
		this.persona = p;
		this.balance = BALANCE[p];
		this.#entitlements = [...ENTITLED[p]];
		this.justBought = null;
		// Anything equipped that this account cannot claim falls back to default.
		const next = { ...this.loadout };
		for (const slot of Object.keys(next)) {
			if (next[slot] && !this.owns(next[slot])) next[slot] = DEFAULT_LOADOUT[slot];
		}
		this.loadout = next;
		this.previewKey = this.equipped(this.category);
	}

	resetCamera() {
		this.yaw = REST_CAMERA.yaw;
		this.pitch = REST_CAMERA.pitch;
		this.zoom = 0.68;
	}

	get turned() {
		return (
			Math.abs(this.yaw - REST_CAMERA.yaw) > 0.02 ||
			Math.abs(this.pitch - REST_CAMERA.pitch) > 0.02 ||
			Math.abs(this.zoom - 0.68) > 0.01
		);
	}

	get dirty() {
		return Object.keys(DEFAULT_LOADOUT).some((s) => this.loadout[s] !== DEFAULT_LOADOUT[s]);
	}

	reset() {
		this.loadout = { ...DEFAULT_LOADOUT };
		this.previewKey = this.equipped(this.category);
		this.justBought = null;
	}
}
