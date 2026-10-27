// ── The simulation autopilot (local dev only) ────────────────────────────────
// A table opened from a script (internal/breach/script.go) tells each person's
// browser its part — seat, look, card plays — on the REST view. This plays it
// with the intents a person's clicks send; walking the office is
// InsiderThreat's `pilot`. Inert anywhere else: only a `dev` build opens a
// scripted table, so no other server ever sends `sim`.
import { describeTable } from '../api.js';
import { DEV_SESSION } from '../insider/maps.js';
import type { Perceived, TableSocket } from '../net.svelte.js';
import { DEFAULT_APPEARANCE, type Appearance } from './appearance.js';

export interface SimStep {
	seat: string;
	after_s?: number;
	station?: string;
	act?: string;
	card?: string;
	site?: string;
}

export interface SimSeat {
	seat: string;
	look?: Partial<Appearance>;
	steps?: SimStep[];
}

/** What this page saw, for a test to read off `window.__breach`. */
export interface SimRecord {
	reactions: { id: number; key: string; station?: string; zone?: string }[];
	/** Each seat's look as the page handed it to the street to draw. */
	dressed: Record<string, Appearance>;
}

export const simRecord: SimRecord | null = DEV_SESSION
	? ((globalThis as { __breach?: SimRecord }).__breach ??= { reactions: [], dressed: {} })
	: null;

export function recordReactions(list: readonly Perceived[]): void {
	if (!simRecord) return;
	const seen = new Set(simRecord.reactions.map((r) => r.id));
	for (const r of list) {
		if (!seen.has(r.id)) simRecord.reactions.push({ id: r.id, key: r.key, station: r.station, zone: r.zone });
	}
}

export function recordDressed(seats: readonly string[], lookAt: (seat: string) => Appearance): void {
	if (!simRecord) return;
	for (const seat of seats) simRecord.dressed[seat] = $state.snapshot(lookAt(seat));
}

/** A refused card play produces no new view, so a turn that has gone quiet
 *  this long is ended rather than left waiting. */
const STALL_MS = 2000;

export class Simulation {
	seat = $state<SimSeat | null>(null);
	#socket: TableSocket;
	#sat = false;
	#played = 0;
	#version = -1;
	#at = 0;

	constructor(socket: TableSocket) {
		this.#socket = socket;
	}

	/** Asks the server for this member's part. The join order decides it, so
	 *  it is not there until the socket has joined. */
	async find(): Promise<void> {
		for (let i = 0; i < 20 && !this.seat; i++) {
			const view = (await describeTable(this.#socket.tableID).catch(() => null)) as { sim?: SimSeat } | null;
			if (view?.sim) this.seat = view.sim;
			else await new Promise((r) => setTimeout(r, 500));
		}
	}

	/** One beat: sit down dressed, then play the written cards on this seat's
	 *  turns. */
	step(myTurn: boolean): void {
		const sim = this.seat, s = this.#socket, v = s.view;
		if (!sim || !v || s.status !== 'live') return;
		if (!this.#sat && !v.your_seat) {
			this.#sat = true;
			s.dress({ ...DEFAULT_APPEARANCE, ...sim.look });
			s.takeSeat(sim.seat);
			return;
		}
		if (!myTurn) return;
		const now = Date.now();
		if (v.version === this.#version && now - this.#at < STALL_MS) return;
		const stalled = v.version === this.#version;
		this.#version = v.version;
		this.#at = now;
		const next = sim.steps?.[this.#played];
		if (!stalled && next?.card && next.site) {
			this.#played++;
			s.commit(next.card, next.site);
		} else {
			s.endTurn();
		}
	}
}
