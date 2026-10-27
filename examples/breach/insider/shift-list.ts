// ── The shift list, as the HUD and the world draw it ─────────────────────────
// One reading of `me.list` (and, for the insider, `me.next`) shared by the list
// in the corner, the waypoints in the world and the radar, so a row and its
// marker always agree on icon, colour and which one is next.
//
// Pure: no Svelte.
import type { IconName } from 'showcase';
import type { OfficeData } from '../internal/office.gen.js';
import type { OfficeMe } from '../wire.gen.js';

export type ShiftKind = 'job' | 'office' | 'secret';

/** A CSS custom property per kind: the job in the accent, office work in a
 *  neutral blue, the insider's own steps in the red only they ever see. */
export const SHIFT_TONE: Record<ShiftKind, string> = {
	job: '--accent',
	office: '--palette-sky',
	secret: '--palette-red'
};

export const SHIFT_ICON: Record<ShiftKind, IconName> = { job: 'wrench', office: 'users', secret: 'cpu' };

export interface ShiftRow {
	key: string;
	kind: ShiftKind;
	task: string;
	station: string;
	done: boolean;
	next: boolean;
	/** The tasks on the list this one still waits on, by name. */
	after: string[];
	/** For the worm's step: how far it has spread, or that it is ready. */
	note?: string;
}

/** The rows, top to bottom: the insider's secret step first, then the list.
 *  Exactly one row is next — the worm's step once it is ready to take,
 *  otherwise the list's. */
export function shiftRows(me: OfficeMe | undefined, D: OfficeData): ShiftRow[] {
	if (!me?.seatId) return [];
	const name = (k: string) => D.tasks.find((t) => t.key === k)?.name ?? D.milestones.find((m) => m.key === k)?.name ?? k;
	const station = (id: string) => D.stations.find((s) => s.id === id)?.name ?? id;
	const rows: ShiftRow[] = [];
	const n = me.next;
	if (me.insider && n?.milestone) {
		rows.push({
			key: `worm:${n.milestone}`,
			kind: 'secret',
			task: name(n.milestone),
			station: n.stations.map(station).join(' / '),
			done: false,
			next: n.ready,
			after: [],
			note: n.ready ? 'ready' : n.need ? `spread ${n.spread}/${n.need}` : undefined
		});
	}
	const wormNext = rows.some((r) => r.next);
	for (const it of me.list ?? []) {
		rows.push({
			key: `${it.task}@${it.station}`,
			kind: it.office ? 'office' : 'job',
			task: name(it.task),
			station: station(it.station),
			done: it.done,
			next: it.next && !wormNext,
			after: (it.after ?? []).map(name)
		});
	}
	return rows;
}

export interface ShiftMark {
	id: string;
	x: number;
	z: number;
	label: string;
	icon: IconName;
	tone: string;
	next: boolean;
	/** A hazard you noticed rather than work you were given: drawn in the
	 *  world, never on the radar. */
	hazard?: boolean;
}

/** The hazards close enough to notice, flagged in the world in amber. Not the
 *  one you stand at: the prompt under the crosshair has that. */
export function hazardMarks(me: OfficeMe | undefined, D: OfficeData, here?: string): ShiftMark[] {
	const out: ShiftMark[] = [];
	for (const h of me?.hazards ?? []) {
		const s = D.stations.find((x) => x.id === h.station);
		const k = D.hazards.kinds.find((x) => x.key === h.kind);
		if (!s || !k || s.id === here) continue;
		out.push({ id: `hazard:${s.id}`, x: s.x, z: s.z, label: k.name, icon: 'alert-triangle', tone: '--palette-amber', next: false, hazard: true });
	}
	return out;
}

/** One marker per station with open work on it, never the one you stand at.
 *  Two tasks at one station share a marker, which is next if either is. */
export function shiftMarks(me: OfficeMe | undefined, D: OfficeData, here?: string): ShiftMark[] {
	if (!me?.seatId) return [];
	const name = (k: string) => D.tasks.find((t) => t.key === k)?.name ?? D.milestones.find((m) => m.key === k)?.name ?? k;
	const out = new Map<string, ShiftMark>();
	const add = (id: string, kind: ShiftKind, label: string, next: boolean) => {
		const s = D.stations.find((x) => x.id === id);
		if (!s || id === here) return;
		const had = out.get(id);
		if (had) {
			had.label += ` · ${label}`;
			had.next ||= next;
			return;
		}
		out.set(id, { id, x: s.x, z: s.z, label, icon: SHIFT_ICON[kind], tone: SHIFT_TONE[kind], next });
	};
	const n = me.insider ? me.next : undefined;
	if (n?.milestone) for (const id of n.stations) add(id, 'secret', name(n.milestone), n.ready);
	for (const it of me.list ?? []) {
		if (!it.done) add(it.station, it.office ? 'office' : 'job', name(it.task), it.next && !n?.ready);
	}
	return [...out.values()];
}
