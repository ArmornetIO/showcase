// ── THE OUTFITTER · card bench ───────────────────────────────────────────────
// The Outfitter already had every part of a scene editor except a scene: a
// turntable, a clip clock, and a panel of knobs wired live to a model. Card art
// is a scene of the same figures in the same renderer, so the bench is the same
// bench — this file is only the state that says WHICH card and WHAT is being
// changed about it.
//
// Separate from `OutfitterState` on purpose. The two screens share the shell and
// nothing else: a card has no loadout and a mannequin has no camera window, and
// merging them would give every knob on either screen a meaning it has to
// document as "ignored in the other mode".
//
// The output is a `Shot` — the same object `card-scene.ts` keys on `ability.key`
// — so tuning a card here and keeping it is a copy and a paste, not a port. That
// is why `asSource` exists and why it prints only what was CHANGED: a dump of
// every resolved value would bury the three numbers that matter and freeze the
// derivation's defaults into a table that should still be tracking them.
import { CATALOGUE, klassByKey, type CardDef, type Klass } from '$examples/breach/internal/rules.js';
import { fxFor, type CardFx } from '$examples/breach/internal/fx.js';
import { CLIP_DEFAULTS, type ClipId, type ClipOpts } from '$lib/character/poses.js';
import { CHARACTERS, type CharacterSkin } from '$lib/character/characters.js';
import { ALL_PIECES } from '$lib/mesh-studio/pieces/piece-catalogue.js';
import {
	BACKDROP,
	CAMERA,
	shotFor,
	type Doing,
	type SceneAnim,
	type Shot
} from '../breach-cards/card-scene.js';

/** Every building a card can be set at. Sorted, because this is a picker and an
 *  insertion-ordered list of two dozen names is a list nobody can find a name
 *  in. */
export const SETTINGS = Object.keys(ALL_PIECES).sort();

/**
 * A knob's live value, resolved.
 *
 * The editor has to show a NUMBER on every slider from the moment it opens,
 * including for the cards that have no entry at all — a slider sitting at its
 * minimum because the underlying value is `undefined` is a slider that lies
 * about the picture on screen and moves it the instant it is touched.
 */
export interface Resolved {
	cast: number;
	doing: Doing;
	setting: string;
	lead: { e: number; n: number; h: number; face: number };
	backdrop: { e: number; n: number; size: number; face: number; tint: number };
	ground: { tint: number; relief: number; far: number };
	pitch: number;
	yaw: number;
	look: { e: number; n: number; h: number; width: number };
}

const GROUND = { tint: 0.2, relief: 0.5, far: 7.5 };

export class CardBench {
	/** Red first, because red is the half of the deck with characters on it. */
	cards = $state<CardDef[]>(CATALOGUE.filter((c) => c.side === 'red'));
	key = $state<string>(CATALOGUE[0].ability.key);

	/**
	 * Who is standing in it, when that is not who the card belongs to.
	 *
	 * The point of a card bench is to judge the SHOT — the framing, the setting,
	 * where the cast stands — and a shot that only works for the Maintainer is a
	 * shot that breaks the day somebody plays the Handler. So the figure is
	 * swappable independently of the card, and the card keeps its own owner.
	 */
	standIn = $state<CharacterSkin | null>(null);

	/** Live edits, only. Everything absent falls through to `card-scene`, which
	 *  is what keeps the bench honest about what it has actually changed. */
	edits = $state<Partial<Shot>>({});

	// ── The clip ─────────────────────────────────────────────────────────────
	// Its own clock rather than the mannequin's. The figure screen animates one
	// body to check a hat still sits on it; a card animates a CAST, and the two
	// want different speeds for the same reason a portrait and a crowd shot do.
	clip = $state<ClipId>('still');
	speed = $state(1);
	frame = $state(0);
	stride = $state(CLIP_DEFAULTS.stride);
	swing = $state(CLIP_DEFAULTS.swing);
	bob = $state(CLIP_DEFAULTS.bob);

	/** How big the card is drawn on the bench. A card is judged at the size it is
	 *  held at, but it is TUNED at a size you can see what you are doing. */
	scale = $state(2.4);

	get clipOpts(): ClipOpts {
		return { stride: this.stride, swing: this.swing, bob: this.bob };
	}

	get card(): CardDef {
		return this.cards.find((c) => c.ability.key === this.key) ?? this.cards[0];
	}

	get owner(): Klass {
		return this.standIn
			? ({ ...klassByKey(this.card.owner), ...this.standIn } as Klass)
			: klassByKey(this.card.owner);
	}

	get fx(): CardFx {
		return fxFor(this.card.ability.key, this.card.side);
	}

	get anim(): SceneAnim {
		return { clip: this.clip, t: this.frame, opts: this.clipOpts };
	}

	/** The card's committed shot with the bench's edits on top — what is actually
	 *  on screen. */
	get shot(): Shot {
		return { ...shotFor(this.key), ...this.edits };
	}

	/** Every knob, with a number on it. See `Resolved`. */
	get live(): Resolved {
		const s = this.shot;
		return {
			cast: s.cast ?? Math.min(this.fx.squad.count, 4),
			doing: s.doing ?? 'watch',
			setting: s.setting ?? '',
			lead: { e: 0, n: 0, h: 0, face: -0.5, ...s.lead },
			backdrop: { ...BACKDROP, ...s.backdrop },
			ground: { ...GROUND, ...s.ground },
			pitch: s.pitch ?? CAMERA.pitch,
			yaw: s.yaw ?? 0.62,
			look: { ...CAMERA.look, ...s.look }
		};
	}

	get dirty(): boolean {
		return Object.keys(this.edits).length > 0;
	}

	select(key: string) {
		this.key = key;
		// Edits do NOT survive the change. They are edits to ONE card's shot, and
		// carrying them across would silently apply the Forge's framing to the
		// Archive — which looks like the editor corrupting a card you never opened.
		this.edits = {};
	}

	/**
	 * Merge a patch, one level deep for the nested groups.
	 *
	 * Against the RESOLVED group, not against `edits` alone. Merging into the
	 * edits was the same bug one level down: the first drag of `lead.n` on a card
	 * whose `SHOT` sets `{e, n, face}` wrote `lead: { n }` and dropped the other
	 * two back to the derivation, so the figure jumped across the card and turned
	 * round on the first touch of a slider that only claims to move it in depth.
	 */
	set<K extends keyof Shot>(field: K, value: Partial<Shot[K]> | Shot[K]) {
		const cur = this.shot[field];
		this.edits =
			value && typeof value === 'object' && !Array.isArray(value)
				? { ...this.edits, [field]: { ...(cur as object), ...(value as object) } }
				: { ...this.edits, [field]: value };
	}

	revert() {
		this.edits = {};
	}

	/** The edits as a `SHOT` entry, ready to paste into `card-scene.ts`. */
	asSource(): string {
		const body = JSON.stringify(this.edits, null, '\t')
			.split('\n')
			.map((l, i) => (i === 0 ? l : `\t${l}`))
			.join('\n');
		return `\t${this.key}: ${body}`;
	}
}

export const STAND_INS = CHARACTERS;
