// ── dbmgr HTTP API ───────────────────────────────────────────────────────────
// A thin client over the read-only endpoints `dbmgr ui` serves. Everything that
// mutates schema is a CLI verb, so there is no POST here on purpose.
//
// The wire types come from the showcase barrel rather than being redeclared:
// they are the same shapes the model-explorer components consume, and keeping
// one copy is what stops a field rename from type-checking on one side of the
// render and reading `undefined` on the other.

import type {
	Erd,
	LedgerEntry,
	MigrationEvent,
	CaptureMeta,
	DriftReport,
	ErdDiff,
	EnvironmentsReport
} from 'showcase';

export type {
	Erd,
	LedgerEntry,
	MigrationEvent,
	CaptureMeta,
	DriftReport,
	ErdDiff,
	EnvironmentsReport
};

/**
 * What this console can actually show, decided by how the server was started.
 * The views ask first so a blank Drift tab can say "no shadow database" instead
 * of presenting an empty result as if it meant no drift — the two look
 * identical and mean opposite things.
 */
export interface Capabilities {
	database: boolean;
	shadow: boolean;
	registry: boolean;
	environments: string[];
	schema: string;
}

// The bundle is served from the same origin as the API, so paths are relative.
// A 500 from this API carries {"error": "..."} — surface that rather than a
// bare status code, since the usual cause is a missing connection string and
// the message says which one.
async function get<T>(path: string): Promise<T> {
	const res = await fetch(`/api/${path}`);
	const text = await res.text();
	let body: unknown;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		throw new Error(`${path}: ${res.status} ${text.slice(0, 200)}`);
	}
	if (!res.ok) {
		const msg =
			body && typeof body === 'object' && 'error' in body
				? String((body as { error: unknown }).error)
				: `${res.status}`;
		throw new Error(msg);
	}
	return body as T;
}

export const api = {
	capabilities: () => get<Capabilities>('capabilities'),
	erd: () => get<Erd>('erd'),
	events: () => get<MigrationEvent[]>('events'),
	captures: () => get<CaptureMeta[]>('captures'),
	status: () => get<LedgerEntry[]>('status'),
	drift: () => get<DriftReport>('drift'),
	environments: () => get<EnvironmentsReport>('environments'),
	compare: (source: string, target: string) =>
		get<ErdDiff>(`compare?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`)
};
