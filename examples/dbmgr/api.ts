// ── dbmgr HTTP API ───────────────────────────────────────────────────────────
// The wire types mirror the Go JSON tags in `dbmgr` exactly. They are declared
// here rather than imported because this app is a consumer: it is built and
// embedded, and must not reach into the server's source tree.

export interface ErdColumn {
	name: string;
	type: string;
	nullable: boolean;
	default?: string;
}

export interface ErdTable {
	name: string;
	group?: string;
	columns: ErdColumn[];
	approxRows?: number;
}

export interface ErdForeignKey {
	fromTable: string;
	fromColumn: string;
	toTable: string;
	toColumn: string;
}

export interface Erd {
	schema: string;
	tables: ErdTable[];
	foreignKeys: ErdForeignKey[];
	groups?: Record<string, { label: string; color: string }>;
}

export interface EventRow {
	sequence: number;
	name: string;
	event: string;
	actor: string;
	reason?: string;
	at?: string;
}

export interface Capture {
	id: string;
	label: string;
	schemaName: string;
	tableCount: number;
	fkCount: number;
	capturedBy?: string;
	capturedAt: string;
}

// The bundle is served from the same origin as the API, so paths are relative.
// A 500 from this API carries {"error": "..."} — surface that rather than a
// bare status code, since the usual cause is a missing DATABASE_URL and the
// message says so.
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
	erd: () => get<Erd>('erd'),
	events: () => get<EventRow[]>('events'),
	captures: () => get<Capture[]>('captures')
};
