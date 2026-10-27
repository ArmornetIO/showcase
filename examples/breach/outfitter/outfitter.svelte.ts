// ── THE OUTFITTER · state ────────────────────────────────────────────────────
// One rune class, following the showcase store pattern. The shell reads this
// and nothing else, which is what stops the chrome growing a private copy of
// "what is equipped".
//
// The distinction this file exists to hold, carried over from the mockup
// unchanged because it was the right one: OWNERSHIP and EQUIPMENT are two
// different sets, and the shop is the join between them.
//
//   entitlements  what the account HAS   ← server truth, granted or purchased
//   loadout       what is ON right now   ← a choice among what it has
//
// An item's `lock` is neither. It is the price tag, and it stays on the item
// for ever: it is what a stranger would pay, and it is also why the ribbon
// still says ALPHA on a crown somebody was given.
//
// `owns()` here decides what is DRAWN as owned. It is not the check — the
// server resolves a claimed loadout against its own entitlements before it
// fans anything out to the other three seats. Now that appearance is the thing
// money buys, a client that names its own loadout would otherwise name the
// alpha crown.

import { BODY_PARTS, DEFAULT_ART, assemble, type ClipId, type ClipOpts, CLIP_DEFAULTS } from 'showcase';
import { DEFAULT_APPEARANCE, resolve, trimOf, type Appearance } from '../internal/appearance.js';
import { buyCosmetic, checkoutMarks, getWallet, type MarksPack } from '../api.js';
import {
	CATEGORIES,
	DEFAULT_LOADOUT,
	inCategory,
	item,
	shapeFrom,
	wornFrom,
	type Category,
	type Item
} from '../internal/wardrobe.js';

export type Persona = 'new' | 'alpha';

const ENTITLED: Record<Persona, string[]> = {
	new: [],
	alpha: [
		// The charter in full: every reward-locked item in the catalogue. A grant
		// list that lags the catalogue produces an alpha account holding half a
		// set, which is worse than holding none.
		'hat.crown',
		'hat.halo',
		'trim.gold',
		// Bought, not granted — this account has been playing.
		'hat.beret',
		'trim.violet'
	]
};

const BALANCE: Record<Persona, number> = { new: 620, alpha: 3140 };

/** The camera, in radians. Matches `DEFAULT_ART` so the outfitter opens on the
 *  same three-quarter view every other portrait uses. */
const REST_CAMERA = { yaw: 0.62, pitch: 0.11 };
const REST_ZOOM = 0.68;

export class OutfitterState {
	/** Who this figure is, for the renderer's cache key and its fallback name.
	 *  Not a roster character any more — that coupling is the thing being cut. */
	readonly who: { key: string; name: string };

	/** Called whenever something COMMITTED changes, so the host can put it on the
	 *  wire. Never fires for a preview: browsing is private, and broadcasting it
	 *  would show three people every hat you tried and did not buy. */
	onchange?: (look: Appearance) => void;

	persona = $state<Persona>('new');
	balance = $state(BALANCE.new);
	#entitlements = $state<string[]>([...ENTITLED.new]);

	/** Where the wallet comes from. `demo` is the standalone example with no
	 *  server — the personas above. `server` is a real account: balance, owned
	 *  items and packs are the server's, and purchases go through it. */
	source = $state<'demo' | 'server'>('demo');
	/** Marks packs for sale; empty when this deployment sells none. */
	packs = $state<MarksPack[]>([]);
	/** A purchase or checkout in flight, so a double-click cannot buy twice. */
	pending = $state(false);
	/** The last refusal, in words a player can act on. */
	notice = $state('');
	loadout = $state<Record<string, string>>({ ...DEFAULT_LOADOUT });
	suit = $state<string>(DEFAULT_ART.suit);
	plate = $state<string | null>(null);
	lamp = $state<string | null>(null);
	/**
	 * Per-thing overrides, keyed by body tag or worn item key.
	 *
	 * The three materials above are the broadcast — move `suit` and every
	 * suit-material mass moves together. This is how ONE thing gets its own
	 * colour: one boot, one hat, the visor. Sparse, so an absent key means "the
	 * material decides" and clearing a part is a delete rather than a guess at
	 * what it used to be.
	 */
	tints = $state<Record<string, string>>({});
	callsign = $state('');

	category = $state<Category>('build');
	/** What the list has highlighted. Distinct from what is equipped on purpose:
	 *  browsing something you cannot afford must not take your colour off you. */
	previewKey = $state<string>(DEFAULT_LOADOUT.build);
	justBought = $state<string | null>(null);

	// ── The stage ────────────────────────────────────────────────────────────
	// Camera lives here rather than in the component so that changing category
	// cannot reset it — comparing two hats at the same angle is the entire
	// reason the stage turns.
	yaw = $state(REST_CAMERA.yaw);
	pitch = $state(REST_CAMERA.pitch);
	zoom = $state(REST_ZOOM);
	clip = $state<ClipId>('idle');
	speed = $state(1);
	stride = $state(CLIP_DEFAULTS.stride);
	swing = $state(CLIP_DEFAULTS.swing);
	bob = $state(CLIP_DEFAULTS.bob);

	constructor(who: { key: string; name: string }, look: Appearance = DEFAULT_APPEARANCE) {
		this.who = who;
		this.load(look);
	}

	get clipOpts(): ClipOpts {
		return { stride: this.stride, swing: this.swing, bob: this.bob };
	}

	// ── The appearance, in and out ───────────────────────────────────────────

	/** What this editor currently describes. The wire shape, exactly — there is
	 *  no second serialisation step that could disagree with the preview. */
	get appearance(): Appearance {
		return {
			loadout: { ...this.loadout },
			suit: this.suit,
			plate: this.plate,
			lamp: this.lamp,
			tints: { ...this.tints },
			callsign: this.callsign
		};
	}

	/** Adopt an appearance wholesale — opening the outfitter on a stored
	 *  character, or being handed one back by the server after it resolved a
	 *  loadout against entitlements this client guessed wrong about. */
	load(look: Appearance) {
		this.loadout = { ...look.loadout };
		this.suit = look.suit;
		this.plate = look.plate;
		this.lamp = look.lamp;
		this.tints = { ...look.tints };
		this.callsign = look.callsign;
		this.previewKey = this.equipped(this.category);
	}

	/** Everything the renderer needs, with the role badge left off: the outfitter
	 *  shows you YOU. The badge is pinned on by the seat, and a shop that drew it
	 *  would be a shop that looks like it sells it. */
	get figure() {
		return resolve(this.appearance, this.who);
	}

	get trim() {
		return trimOf(this.preview);
	}

	/** The appearance as the STAGE should draw it — the equipped set with the
	 *  browsed item swapped into its own slot. Trying a hat on has to show the
	 *  hat, and it has to keep the colour. */
	get preview(): Appearance {
		const sel = item(this.previewKey);
		const look = this.appearance;
		return sel ? { ...look, loadout: { ...look.loadout, [sel.slot]: sel.key } } : look;
	}

	get stage() {
		return resolve(this.preview, this.who);
	}

	// ── Paint ────────────────────────────────────────────────────────────────

	paintOne(slot: string, color: string) {
		this.tints = { ...this.tints, [slot]: color };
		this.commit();
	}

	clearOne(slot: string) {
		const { [slot]: _gone, ...rest } = this.tints;
		this.tints = rest;
		this.commit();
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
		const look = this.preview;
		const parts = assemble(shapeFrom(look.loadout), wornFrom(look.loadout));
		const present = new Set(parts.map((p) => p.tag).filter(Boolean));
		const owners = new Set(parts.map((p) => p.owner).filter(Boolean));
		const base: Record<string, string> = {
			suit: this.suit,
			plate: this.plate ?? this.figure.skin.color,
			lamp: this.lamp ?? this.plate ?? this.figure.skin.color,
			trim: this.trim
		};
		const body = BODY_PARTS.filter((b) => present.has(b.tag)).map((b) => ({
			slot: b.tag as string,
			label: b.label,
			group: 'body' as const,
			value: this.tints[b.tag] ?? base[b.mat]
		}));
		// A wearable key IS its catalogue key — `wardrobe.ts` builds items with
		// `wearable: key` — so the shop's name for a thing is one lookup away and
		// the panel never invents its own.
		const worn = wornFrom(look.loadout)
			.filter((key) => owners.has(key))
			.map((key) => ({
				slot: key,
				label: item(key)?.name ?? key,
				group: 'worn' as const,
				value: this.tints[key] ?? base.trim
			}));
		return [...body, ...worn];
	}

	/**
	 * The paintable rows belonging to ONE item, for the swatches that sit under
	 * it in the grid.
	 *
	 * The same list the Paint row shows, filtered — not a second computation.
	 * Colour appears in two places on purpose (recolouring a whole figure and
	 * recolouring the thing you are looking at are different jobs), and two
	 * derivations of one list is exactly how those two places come to disagree.
	 */
	paintablesFor(key: string) {
		const i = item(key);
		if (!i) return [];
		if (i.category === 'build') return this.paintables.filter((p) => p.group === 'body');
		return this.paintables.filter((p) => p.slot === i.wearable);
	}

	/** Every colour on the model, resolved, for the header's swatches. */
	get swatches() {
		const base = this.figure.skin.color;
		return [
			{ key: 'suit' as const, label: 'Suit', value: this.suit },
			{ key: 'plate' as const, label: 'Plate', value: this.plate ?? base },
			{ key: 'lamp' as const, label: 'Visor', value: this.lamp ?? this.plate ?? base },
			{ key: 'trim' as const, label: 'Swag', value: this.trim }
		];
	}

	paintFocus = $state<'suit' | 'plate' | 'lamp' | 'trim' | null>(null);

	setMaterial(m: 'suit' | 'plate' | 'lamp', color: string | null) {
		if (m === 'suit') this.suit = color ?? DEFAULT_ART.suit;
		else this[m] = color;
		this.commit();
	}

	openPaint(focus: 'suit' | 'plate' | 'lamp' | 'trim') {
		this.selectCategory('trim');
		this.paintFocus = focus;
	}

	resetPaint() {
		this.suit = DEFAULT_ART.suit;
		this.plate = null;
		this.lamp = null;
		this.tints = {};
		this.commit();
	}

	get painted() {
		return (
			this.suit !== DEFAULT_ART.suit ||
			!!this.plate ||
			!!this.lamp ||
			Object.keys(this.tints).length > 0
		);
	}

	// ── Ownership ────────────────────────────────────────────────────────────

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
		return this.loadout[c] ?? '';
	}

	equippedItem(c: Category) {
		return item(this.equipped(c));
	}

	isEquipped(key: string) {
		const i = item(key);
		return !!i && this.loadout[i.slot] === key;
	}

	get list() {
		return inCategory(this.category);
	}

	get categories() {
		return CATEGORIES;
	}

	get selected(): Item | undefined {
		return item(this.previewKey);
	}

	get canAfford() {
		const i = this.selected;
		return !!i && i.lock?.kind === 'price' && this.balance >= i.lock.marks;
	}

	// ── Actions ──────────────────────────────────────────────────────────────

	selectCategory(c: Category) {
		if (this.category === c) return;
		this.category = c;
		this.paintFocus = null;
		this.previewKey = this.equipped(c) || (inCategory(c)[0]?.key ?? '');
	}

	/** Highlight an item without putting it on. Named for what it is, because
	 *  the one thing this must never be confused with is `equip`. */
	browse(key: string) {
		this.previewKey = key;
		this.justBought = null;
	}

	/** POST /api/breach/outfitter/equip `{ slot, item_key }` */
	equip(key: string) {
		const i = item(key);
		if (!i || !this.owns(key)) return false;
		this.loadout = { ...this.loadout, [i.slot]: key };
		this.commit();
		return true;
	}

	/** Adopt the signed-in player's wallet. Without a server (the standalone
	 *  example) nothing changes and the demo account stays — the outfitter must
	 *  still open with no backend behind it. */
	async connect() {
		const w = await getWallet();
		if (!w) return;
		this.source = 'server';
		this.balance = w.marks;
		this.#entitlements = [...w.owned];
		this.packs = w.shop ? w.packs : [];
		// Re-resolve what is on against what this account really owns.
		this.load(this.appearance);
	}

	/** After returning from a marks payment: the webhook that credits it can
	 *  land after the redirect, so re-read until the balance moves, then stop. */
	async awaitMarks(tries = 10, everyMs = 2000) {
		const before = this.balance;
		for (let n = 0; n < tries; n++) {
			await new Promise((r) => setTimeout(r, everyMs));
			await this.connect();
			if (this.balance > before) {
				this.notice = '';
				return true;
			}
		}
		this.notice = 'Your marks are taking longer than usual to arrive — they will appear shortly.';
		return false;
	}

	/** POST /api/breach/outfitter/purchase `{ item_key }` → balance + entitlement.
	 *  Equips on success, because nobody buys a hat to leave it in a drawer. */
	buy(key: string) {
		const i = item(key);
		if (!i || i.lock?.kind !== 'price' || this.owns(key)) return;
		if (this.balance < i.lock.marks) return;
		if (this.source === 'server') {
			void this.#buyOnServer(key);
			return;
		}
		this.balance -= i.lock.marks;
		this.#entitlements = [...this.#entitlements, key];
		this.justBought = key;
		this.equip(key);
	}

	async #buyOnServer(key: string) {
		if (this.pending) return;
		this.pending = true;
		this.notice = '';
		try {
			const res = await buyCosmetic(key);
			if (res.ok) {
				this.balance = res.marks;
				this.#entitlements = [...res.owned];
				this.justBought = key;
				this.equip(key);
				return;
			}
			// A refusal still carries the server's wallet: show the real balance,
			// not the one this client guessed.
			if (res.marks !== undefined) this.balance = res.marks;
			if (res.owned) this.#entitlements = [...res.owned];
			this.notice = res.status === 402 ? 'Not enough marks for that.' : res.error;
		} catch {
			this.notice = 'Could not reach the shop. Nothing was spent.';
		} finally {
			this.pending = false;
		}
	}

	/** Leave for the payment page for one pack of marks. */
	async buyMarks(pack: string) {
		if (this.pending || this.source !== 'server') return;
		this.pending = true;
		this.notice = '';
		try {
			window.location.assign(await checkoutMarks(pack));
		} catch (e) {
			this.notice = e instanceof Error ? e.message : 'Could not open the payment page.';
			this.pending = false;
		}
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

	rename(name: string) {
		this.callsign = name;
		this.commit();
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
		this.commit();
	}

	resetCamera() {
		this.yaw = REST_CAMERA.yaw;
		this.pitch = REST_CAMERA.pitch;
		this.zoom = REST_ZOOM;
	}

	get turned() {
		return (
			Math.abs(this.yaw - REST_CAMERA.yaw) > 0.02 ||
			Math.abs(this.pitch - REST_CAMERA.pitch) > 0.02 ||
			Math.abs(this.zoom - REST_ZOOM) > 0.01
		);
	}

	get dirty() {
		return Object.keys(DEFAULT_LOADOUT).some((s) => this.loadout[s] !== DEFAULT_LOADOUT[s]);
	}

	reset() {
		this.loadout = { ...DEFAULT_LOADOUT };
		this.previewKey = this.equipped(this.category);
		this.justBought = null;
		this.resetPaint();
	}

	/** Announce a committed change. Every mutation above routes through here
	 *  rather than each caller remembering — five write paths and one of them
	 *  forgetting is a player whose hat only they can see. */
	private commit() {
		this.onchange?.(this.appearance);
	}
}
