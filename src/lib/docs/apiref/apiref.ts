// Everything <ApiReference> derives from the island, kept out of the component
// so it can be read — and tested — without a DOM.
//
// The rule the whole file obeys: a sentence about the API comes from the spec or
// it does not get said. What is computed here is only ever SHAPE — which
// operations sit near this one, which authorization rule is the common case,
// what a call to this route looks like in four languages.

import type { ApiIsland, AuthKind, Endpoint, Field, LineEndpoint, WsMessage } from './types.js';

export const LANGS = ['cURL', 'TypeScript', 'Go', 'Python'] as const;
export type Lang = (typeof LANGS)[number];

export const KIND_META: Record<AuthKind, { label: string }> = {
	public: { label: 'Public' },
	authenticated: { label: 'Signed in' },
	self: { label: 'Self' },
	org_role: { label: 'Org role' },
	object: { label: 'Object relation' },
	god_admin: { label: 'Platform admin' },
	agent_ingest: { label: 'Agent token' }
};

export function allEndpoints(data: ApiIsland): Endpoint[] {
	return data.resources.flatMap((r) => r.endpoints);
}

// ── the authorization tuple, reconstructed ───────────────────────────────────

export type Tuple = {
	relation: string;
	objectType: string;
	/** Where the object id comes from: a path param, or the caller's session. */
	source: string;
	param?: string;
};

/** `agent client editor` → `agent_client` / `editor`. Object labels are the
 *  object type and relation joined by spaces, so the last word is the relation
 *  and the rest is the type with its underscores spent. */
function objectTuple(label: string): { objectType: string; relation: string } {
	const parts = label.trim().split(/\s+/);
	const relation = parts.pop() ?? '';
	return { objectType: parts.join('_'), relation };
}

export function tupleFor(e: Endpoint): Tuple | null {
	const a = e.auth;
	const named = /named by \{(\w+)\}/.exec(a.detail)?.[1];

	if (a.kind === 'org_role') {
		const relation = a.label
			.replace(/^Org\s+/i, '')
			.replace(/\s+/g, '_')
			.toLowerCase();
		return {
			relation,
			objectType: 'organization',
			source: named ? 'path parameter' : 'active organization',
			param: named
		};
	}
	if (a.kind === 'object') {
		const { objectType, relation } = objectTuple(a.label);
		return {
			relation,
			objectType,
			source: named ? 'path parameter' : 'path',
			param: named
		};
	}
	return null;
}

export function checkExpr(e: Endpoint): string | null {
	const t = tupleFor(e);
	if (!t) return null;
	const obj = t.param ? `${t.objectType}:{${t.param}}` : `${t.objectType}:<active>`;
	return `check(user:<caller>, ${t.relation}, ${obj})`;
}

/** "Org member" and "signed in" cover more than half the surface. Stating them
 *  on every operation trains readers to skip the access line on the routes where
 *  the rule really is different, so only a departure from the default is drawn. */
export function isNotable(e: Endpoint): boolean {
	const k = e.auth.kind;
	return (
		k === 'object' ||
		k === 'god_admin' ||
		k === 'agent_ingest' ||
		k === 'self' ||
		(k === 'org_role' && tupleFor(e)?.relation !== 'member')
	);
}

/** The spec's own sentence for a kind — whichever wording it emits most often.
 *  org_role and object vary by route, so the commonest is the generic form. */
export function detailFor(endpoints: Endpoint[], kind: AuthKind): string {
	const counts = new Map<string, number>();
	for (const e of endpoints) {
		if (e.auth.kind !== kind) continue;
		counts.set(e.auth.detail, (counts.get(e.auth.detail) ?? 0) + 1);
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

export function kindCounts(endpoints: Endpoint[]): { kind: AuthKind; count: number }[] {
	return (Object.keys(KIND_META) as AuthKind[])
		.map((kind) => ({
			kind,
			count: endpoints.filter((e) => e.auth.kind === kind).length
		}))
		.filter((k) => k.count > 0)
		.sort((a, b) => b.count - a.count);
}

/** Operations on the same record, which the path already knows: the other verbs
 *  on this exact path first, then its immediate parent and children. The
 *  generator has no "related" field and needs none — a REST path IS the
 *  relationship. */
export function siblingsOf(endpoints: Endpoint[], e: Endpoint, limit = 6): Endpoint[] {
	const base = e.path.replace(/\/$/, '');
	const parent = base.split('/').slice(0, -1).join('/');
	const rank = (o: Endpoint) =>
		o.path === base ? 0 : o.path.startsWith(base + '/') ? 1 : o.path === parent ? 2 : 3;
	return endpoints
		.filter((o) => o.id !== e.id && rank(o) < 3)
		.sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path))
		.slice(0, limit);
}

/** A body named only by $ref still has fields; they live in the schema map,
 *  which is why the island ships one. */
export function bodyFieldsOf(data: ApiIsland, e: Endpoint): Field[] {
	if (e.fields?.length) return e.fields;
	return e.body ? (data.schemas[e.body] ?? []) : [];
}

// ── the Line protocol ────────────────────────────────────────────────────────

/** The order the handshake messages occur in, and the ends each travels
 *  between. It is the one thing the spec cannot state per-message — every word
 *  of the description still comes from the spec. */
const HANDSHAKE: Record<string, { n: number; from: string; to: string }> = {
	LineCommand: { n: 1, from: 'server', to: 'A' },
	LineOpen: { n: 2, from: 'A', to: 'server' },
	LineOpenAck: { n: 3, from: 'server', to: 'A' },
	LineNotify: { n: 4, from: 'server', to: 'B' },
	LineControl: { n: 5, from: 'server', to: 'both' }
};

export type LineStep = {
	n: number;
	from: string;
	to: string;
	msg: string;
	text: string;
	fields: string[];
};

export type LineRow = {
	msg: string;
	dir: string;
	text: string;
	fields: string[];
};

/** `send`/`recv` are written from the AGENT's end in the spec, which is who
 *  reads this page. */
function directionOf(m: WsMessage): string {
	if (m.direction === 'send') return 'agent → server';
	if (m.direction === 'recv') return 'server → agent';
	return 'either way';
}

function rowOf(m: WsMessage): LineRow {
	return {
		msg: m.name,
		dir: directionOf(m),
		text: m.description,
		fields: (m.fields ?? []).map((f) => f.name)
	};
}

/** Three readings of the same message list: the handshake in order, the
 *  discovery exchange, and everything else. Splitting by name rather than by a
 *  hand-kept list means a message added to the protocol shows up here on the
 *  next generate instead of vanishing. */
export function lineSections(line: LineEndpoint): {
	steps: LineStep[];
	discovery: LineRow[];
	other: LineRow[];
} {
	const steps: LineStep[] = [];
	const discovery: LineRow[] = [];
	const other: LineRow[] = [];

	for (const m of line.messages) {
		const hop = HANDSHAKE[m.name];
		if (hop) {
			steps.push({
				...hop,
				msg: m.name,
				text: m.description,
				fields: rowOf(m).fields
			});
		} else if (m.name.startsWith('Discovery') || m.name === 'AgentInfo') {
			discovery.push(rowOf(m));
		} else {
			other.push(rowOf(m));
		}
	}
	steps.sort((a, b) => a.n - b.n);
	return { steps, discovery, other };
}

// ── code samples, rendered per language from the operation ───────────────────

export function sampleFor(lang: string, e: Endpoint, host: string): string {
	const url = `${host}${e.path.replace(/\{(\w+)\}/g, '<$1>')}`;
	const method = e.method.toUpperCase();
	const writable = (e.fields ?? []).filter((f) => !f.readOnly).slice(0, 4);
	const jsonBody = writable.length
		? `{ ${writable.map((f) => `"${f.name}": …`).join(', ')} }`
		: undefined;

	if (lang === 'cURL') return e.curl;

	if (lang === 'TypeScript')
		return `const res = await fetch("${url}", {
  method: "${method}",
  headers: {
    Authorization: \`Bearer \${process.env.ARMORNET_TOKEN}\`${jsonBody ? ',\n    "Content-Type": "application/json"' : ''}
  }${jsonBody ? `,\n  body: JSON.stringify(${jsonBody})` : ''}
});

// 403 here means the relation check above failed, not that the route is missing.
if (!res.ok) throw new Error(\`armornet \${res.status}\`);
const data = await res.json();`;

	if (lang === 'Go')
		return `req, _ := http.NewRequestWithContext(ctx, "${method}", "${url}", ${jsonBody ? 'body' : 'nil'})
req.Header.Set("Authorization", "Bearer "+os.Getenv("ARMORNET_TOKEN"))${jsonBody ? '\nreq.Header.Set("Content-Type", "application/json")' : ''}

resp, err := http.DefaultClient.Do(req)
if err != nil {
    return err
}
defer resp.Body.Close()`;

	return `import os, httpx

r = httpx.${e.method}(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['ARMORNET_TOKEN']}"}${jsonBody ? `,\n    json=${jsonBody.replace(/…/g, '"…"')}` : ''}
)
r.raise_for_status()`;
}

/** An illustrative 2xx body, shaped from the operation's declared schema. The
 *  generator emits no examples, so this is the page showing what it WOULD do
 *  with them — from real field names and types, never invented ones. */
export function exampleFor(data: ApiIsland, e: Endpoint): string | null {
	const ok = e.responses?.find((r) => r.code.startsWith('2'));
	if (!ok || ok.code === '204') return null;

	const fields = ok.schema ? (data.schemas[ok.schema] ?? []) : (e.fields ?? []);
	if (!fields.length) return null;

	const body = fields
		.slice(0, 8)
		.map((f) => `  "${f.name}": ${valueFor(f)}`)
		.join(',\n');
	const obj = `{\n${body}\n}`;
	return ok.array
		? `[\n${obj
				.split('\n')
				.map((l) => '  ' + l)
				.join('\n')}\n]`
		: obj;
}

function valueFor(f: Field): string {
	if (f.enum?.length) return `"${f.enum[0]}"`;
	if (f.type.endsWith('[]') || f.type.startsWith('array')) return '[…]';
	if (f.type.startsWith('map')) return '{…}';
	switch (f.type) {
		case 'integer':
		case 'number':
			return '0';
		case 'boolean':
			return 'true';
		default:
			return f.name.endsWith('_at') ? '"2026-09-12T03:11:48Z"' : '"…"';
	}
}
