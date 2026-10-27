// ── An offline office, hosted by the rules themselves ────────────────────────
// local-table.ts's idea for Insider Threat: the office match runs in
// cmd/breachwasm, the same internal/breach/office the server runs, so an
// offline street has bots doing their real jobs and an insider among them.
// This plays the table's part (internal/breach/table.go): it beats the clock at
// the server's rate, passes on poses and moves, and keeps what the server would
// have sent this seat, in the networked socket's shapes.

import { decodeOfficeView, type OfficeView } from '../wire.gen.js';
import { decodePose, decodeReaction } from '../wire.js';
import type { Perceived, Pose } from '../net.svelte.js';
import type { OfficeActions, Refusal } from '../insider/OfficeHud.svelte';
import { OfficeEngine, type OfficeSeat } from './rules-engine.js';

/** internal/breach/registry.go's streetBeat. */
const BEAT_MS = 100;

export class LocalOffice {
	view = $state<OfficeView | null>(null);
	reactions = $state<Perceived[]>([]);
	/** Where each bot has walked, as a socket keeps relayed poses. */
	poses = $state<Record<string, Pose>>({});
	/** The last move the rules refused, as a server's error frame would say it. */
	refusal = $state<Refusal | null>(null);

	#engine: OfficeEngine;
	#me: string;
	#timer: ReturnType<typeof setInterval>;

	private constructor(engine: OfficeEngine, me: string) {
		this.#engine = engine;
		this.#me = me;
		this.view = decodeOfficeView(engine.view(me));
		this.#timer = setInterval(() => this.#beat(), BEAT_MS);
	}

	/** Deals a match with `me` as the one seat a person is holding. */
	static async open(seats: OfficeSeat[], me: string, seed = Date.now() & 0x7fffffff): Promise<LocalOffice> {
		return new LocalOffice(await OfficeEngine.open(seed, seats), me);
	}

	close() {
		clearInterval(this.#timer);
	}

	pose(p: Pose) {
		this.#engine.pose(this.#me, p.x, p.z);
	}

	readonly actions: OfficeActions = {
		channel: (st, act) => this.#do({ op: 'channel', site_id: st, act_key: act }),
		lift: (seat) => this.#do({ op: 'channel', act_key: 'lift_badge', seat_id: seat }),
		cancel: () => this.#do({ op: 'cancel' }),
		sweep: () => this.#do({ op: 'sweep' }),
		signature: (site, seat) => this.#do({ op: 'signature', site_id: site, seat_id: seat }),
		callMeeting: () => this.#do({ op: 'call_meeting' }),
		vote: (seat) => this.#do({ op: 'vote', seat_id: seat })
	};

	/** A refused move changes nothing but is said, as a server's error frame
	 *  is. The next beat carries what an accepted one fired. */
	#do(intent: object) {
		try {
			this.#engine.do(this.#me, intent);
		} catch (err) {
			this.refusal = { text: err instanceof Error ? err.message : String(err), at: performance.now() };
		}
		this.#beat(true);
	}

	#beat(force = false) {
		const { changed, reactions, walked } = this.#engine.tick(this.#me);
		if (walked.length) {
			const next = { ...this.poses };
			for (const b of walked) {
				const f = decodePose(b);
				if (f) next[f.seatID] = f.pose;
			}
			this.poses = next;
		}
		if (reactions.length) {
			const seen = performance.now();
			this.reactions = [...this.reactions.slice(-15), ...reactions.map((b) => ({ ...decodeReaction(b), seen }))];
		}
		if (changed || force) this.view = decodeOfficeView(this.#engine.view(this.#me));
	}
}
