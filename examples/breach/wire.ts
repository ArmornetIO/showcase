/**
 * The breach capability's Line edge: protobuf in and out, the JSON-era view
 * shapes everywhere else.
 *
 * The board, the lobby and the in-browser rules engine all read the snake_case
 * shapes `breachview` publishes as JSON, and the rules engine still hands them
 * over that way. So the wire types stop here: this file rebuilds exactly the
 * object the server used to send, and nothing past it knows the encoding
 * changed.
 */
import type { Appearance } from './internal/appearance.js';
import type { Intent, Pose, TableView, Resolution } from './net.svelte.js';
import {
	decodeErrorFrame,
	decodeEventFrame,
	decodePoseFrame,
	decodeReactionFrame,
	decodeSeatViewFrame,
	encodeIntentFrame,
	newMove,
	type Appearance as WireAppearance,
	type CardView as WireCard,
	type Klass as WireKlass,
	type LogEntry as WireLog,
	type MatchView as WireMatch,
	type Play as WirePlay,
	type Power as WirePower,
	type ReactionFrame,
	type Resolution as WireResolution,
	type TableView as WireTable
} from './wire.gen.js';

/** The zero value of every enum means "not set", which JSON said by omission. */
function set<T extends string>(v: T): Exclude<T, 'unspecified'> | undefined {
	return v === 'unspecified' ? undefined : (v as Exclude<T, 'unspecified'>);
}

function nonEmpty<T>(xs: T[]): T[] | undefined {
	return xs.length ? xs : undefined;
}

export function encodeIntent(tableID: string, intent: Intent, attempt: string): Uint8Array {
	return encodeIntentFrame({
		tableId: tableID,
		attempt,
		intent: newMove({
			op: intent.op,
			seatId: intent.seat_id ?? '',
			klassKey: intent.klass_key ?? '',
			cardKey: intent.card_key ?? '',
			siteId: intent.site_id ?? '',
			mode: intent.mode ?? 'unspecified',
			matchSize: intent.size ?? 'unspecified',
			appearance: intent.appearance ? appearanceToWire(intent.appearance) : undefined,
			variant: intent.variant ?? 'unspecified',
			pose: intent.pose,
			actKey: intent.act_key ?? ''
		})
	});
}

/** An office reaction. Passed through in the wire's own shape: nothing past
 *  this file predates it, so there is no older JSON shape to rebuild. */
export function decodeReaction(b: Uint8Array): ReactionFrame {
	return decodeReactionFrame(b);
}

export function decodePose(b: Uint8Array): { seatID: string; pose: Pose } | null {
	const f = decodePoseFrame(b);
	return f.pose ? { seatID: f.seatId, pose: f.pose } : null;
}

/** `null` means "whatever the figure already is" in the client's type, and the
 *  wire spells that as the empty string — a default hex would repaint every
 *  player who has never chosen a plate, and #000000 is a colour somebody may
 *  legitimately pick, so it cannot double as the sentinel. */
function appearanceToWire(a: Appearance): WireAppearance {
	return {
		loadout: a.loadout,
		suit: a.suit,
		plate: a.plate ?? '',
		lamp: a.lamp ?? '',
		tints: a.tints,
		callsign: a.callsign
	};
}

/** The same trip back. Empty is unset, not black. */
function appearance(a: WireAppearance): Appearance {
	return {
		loadout: a.loadout,
		suit: a.suit,
		plate: a.plate || null,
		lamp: a.lamp || null,
		tints: a.tints,
		callsign: a.callsign
	};
}

export function decodeSeatView(b: Uint8Array): TableView {
	return table(decodeSeatViewFrame(b).view);
}

export function decodeEvent(b: Uint8Array): {
	view: TableView;
	res?: Resolution;
} {
	const f = decodeEventFrame(b);
	return { view: table(f.view), res: f.res ? resolution(f.res) : undefined };
}

export function decodeError(b: Uint8Array): { code: string; message: string } {
	const { code, message } = decodeErrorFrame(b);
	return { code, message };
}

function play(p: WirePlay | undefined) {
	const w = p ?? decodePlayZero;
	return {
		key: w.key,
		name: w.name,
		kind: w.kind === 'unspecified' ? '' : w.kind,
		skill: w.skill === 'unspecified' ? '' : w.skill,
		ap: w.ap,
		mod: w.mod,
		noise: w.noise,
		dc: w.dc,
		targets: nonEmpty(w.targets),
		on: nonEmpty(w.on.filter((o) => o !== 'unspecified')),
		effect: set(w.effect),
		wide: w.wide || undefined,
		dormant: w.dormant || undefined,
		foothold: set(w.foothold),
		evicts: w.evicts || undefined,
		text: w.text
	};
}

const decodePlayZero: WirePlay = {
	key: '',
	name: '',
	kind: 'unspecified',
	skill: 'unspecified',
	ap: 0,
	mod: 0,
	noise: 0,
	targets: [],
	on: [],
	effect: 'unspecified',
	wide: false,
	dormant: false,
	foothold: 'unspecified',
	evicts: false,
	text: ''
};

function power(p: WirePower | undefined) {
	return {
		...play(p?.play),
		uses: p?.uses ?? 0,
		cooldown: p?.cooldown || undefined
	};
}

function card(c: WireCard) {
	return {
		...play(c.play),
		owner: c.owner,
		copies: c.copies,
		playable: c.playable,
		sites: c.sites,
		uid: c.uid
	};
}

function klass(k: WireKlass) {
	return {
		key: k.key,
		seat: k.seat,
		name: k.name,
		faction: k.faction === 'unspecified' ? '' : k.faction,
		color: k.color,
		icon: k.icon,
		resource: k.resource,
		skills: k.skills,
		tagline: k.tagline,
		passive: { name: k.passive?.name ?? '', text: k.passive?.text ?? '' },
		shape: k.shape || undefined,
		power: k.power ? power(k.power) : undefined
	};
}

function log(e: WireLog) {
	return {
		id: e.id,
		see: e.see,
		when: e.when,
		title: e.title,
		subject: e.subject,
		icon: e.icon,
		tone: e.tone,
		major: e.major || undefined,
		qualifiers: nonEmpty(e.qualifiers),
		where: set(e.where),
		round: e.round || undefined,
		actor: e.actor || undefined,
		actor_see: set(e.actorSee),
		card: e.card || undefined,
		structure: e.structure || undefined,
		delta: e.delta,
		outcome: set(e.outcome)
	};
}

function match(m: WireMatch) {
	return {
		round: m.round,
		phase: m.phase,
		size: m.matchSize,
		seat_key: m.seatKey,
		active_key: m.activeKey,
		winner: set(m.winner),
		over: m.over,
		your_turn: m.yourTurn,
		footholds: m.footholds.map((f) => ({
			structure_id: f.structureId,
			seat_key: f.seatKey,
			kind: f.kind,
			cost_ap: f.costAp,
			expires_round: f.expiresRound || undefined,
			revealed: f.revealed,
			sleeper: f.sleeper,
			placed_round: f.placedRound,
			staged: f.staged
		})),
		garrison: m.garrison.map((u) => ({
			uid: u.uid,
			structure_id: u.structureId,
			faction: u.faction,
			seat_key: u.seatKey,
			leaves: u.leaves,
			shape: u.shape,
			hue: u.hue,
			revealed: u.revealed,
			phase: u.phase
		})),
		log: m.log.map(log),
		heat: m.heat,
		ap: m.ap,
		res: m.res,
		hardened: m.hardened,
		softened: m.softened,
		quarantined: m.quarantined,
		expiry: m.expiry,
		chip: m.chip,
		hand: m.hand.map(card),
		pile_count: m.pileCount,
		discard_count: m.discardCount,
		power: m.power
			? {
					...power(m.power.power),
					playable: m.power.playable,
					sites: m.power.sites,
					charges: m.power.charges,
					readyIn: m.power.readyIn || undefined
				}
			: undefined,
		// Absent, not empty, in a player's view: the type promises a player never
		// holds this field at all.
		omniscient: m.omniscient || undefined,
		hands: m.omniscient
			? Object.fromEntries(Object.entries(m.hands).map(([seat, l]) => [seat, l.cards.map(card)]))
			: undefined,
		sites: m.sites.map((s) => ({
			id: s.id,
			hardening: s.hardening,
			base: s.base,
			held: s.held,
			kind: set(s.kind),
			expires_round: s.expiresRound || undefined,
			staged: s.staged,
			sealed: s.sealed,
			red: s.red,
			blue: s.blue
		})),
		standing: m.standing,
		standing_label: m.standingLabel,
		chain_held: m.chainHeld,
		results: nonEmpty(
			m.results.map((r) => ({
				seat_key: r.seatKey,
				faction: r.faction,
				won: r.won,
				rounds: r.rounds,
				buildings_held: r.buildingsHeld
			}))
		)
	};
}

function table(v: WireTable | undefined): TableView {
	if (!v) throw new Error('breach: a view frame carried no view');
	const l = v.lobby;
	return {
		id: v.id,
		phase: set(v.phase) ?? 'setup',
		config: {
			size: v.config?.matchSize,
			mode: v.config?.mode,
			variant: set(v.config?.variant ?? 'unspecified') ?? 'ctf'
		},
		host_id: v.hostId,
		version: v.version,
		epoch: v.epoch,
		you_id: v.youId,
		you_are_host: v.youAreHost,
		your_seat: v.yourSeat || undefined,
		spectating: v.spectating || undefined,
		members: v.members.map((m) => ({
			user_id: m.userId,
			name: m.name,
			present: m.present,
			last_seen: m.lastSeenUnixMs ? new Date(m.lastSeenUnixMs).toISOString() : undefined
		})),
		lobby: {
			phase: l?.phase ?? 'unspecified',
			mode: set(l?.mode ?? 'unspecified') ?? 'lot',
			size: set(l?.matchSize ?? 'unspecified') ?? '1v1',
			seats: (l?.seats ?? []).map((s) => ({
				id: s.id,
				side: set(s.side) ?? 'red',
				klass_key: s.klassKey || undefined,
				// Absent, not defaulted: a seat the server said nothing about must
				// stay dressed as it was, so the lobby can tell "no change" from
				// "wearing nothing".
				appearance: s.appearance ? appearance(s.appearance) : undefined,
				occupant: {
					kind: set(s.occupant?.kind ?? 'unspecified') ?? 'open',
					user_id: s.occupant?.userId || undefined,
					name: s.occupant?.name || undefined,
					ready: s.occupant?.ready || undefined
				}
			})),
			draft_seat_id: l?.draftSeatId || undefined,
			waiting_on: l?.waitingOn ?? [],
			filled: l?.filled ?? 0,
			can_start: l?.canStart ?? false,
			can_choose: l?.canChoose ?? false,
			your_pool: l && l.yourPool.length ? l.yourPool.map(klass) : undefined
		},
		match: v.match ? (match(v.match) as unknown as TableView['match']) : undefined,
		office: v.office
	} as TableView;
}

function resolution(r: WireResolution): Resolution {
	return {
		seq: r.seq,
		actor_key: r.actorKey,
		faction: r.faction,
		card_key: r.cardKey,
		structure_id: r.structureId,
		territory: r.territory,
		sealed: r.sealed,
		roll: r.roll
			? {
					dice: [r.roll.dice[0] ?? 0, r.roll.dice[1] ?? 0],
					total: r.roll.total,
					hit: r.roll.hit,
					outcome: r.roll.outcome,
					margin: r.roll.margin,
					target: r.roll.target
				}
			: undefined,
		loud: r.loud
	} as unknown as Resolution;
}
