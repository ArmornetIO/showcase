// The shape of the generated API island — app-ui/src/lib/generated/api.data.json,
// emitted by cmd/apidocgen from server/rest/openapi.yaml.
//
// This file is the contract between that generator and <ApiReference>. Every
// string the page shows comes across it; nothing about the API is written here.

export type Field = {
	name: string;
	type: string;
	ref?: string;
	required?: boolean;
	readOnly?: boolean;
	enum?: string[];
	desc?: string;
};

export type Param = {
	name: string;
	in: string;
	type: string;
	required?: boolean;
	default?: string;
	enum?: string[];
	desc?: string;
};

export type Resp = {
	code: string;
	desc: string;
	schema?: string;
	array?: boolean;
};

export type AuthKind =
	| 'public'
	| 'authenticated'
	| 'self'
	| 'org_role'
	| 'object'
	| 'god_admin'
	| 'agent_ingest';

export type Auth = {
	kind: AuthKind;
	label: string;
	detail: string;
	schemes?: string[];
	scope?: string;
};

export type Endpoint = {
	id: string;
	method: string;
	path: string;
	summary: string;
	desc?: string;
	opId?: string;
	auth: Auth;
	params?: Param[];
	/** Named schema of the request body; its fields live in `schemas`. */
	body?: string;
	/** Inline request body fields, when the body is not a named schema. */
	fields?: Field[];
	responses?: Resp[];
	curl: string;
};

export type Resource = { id: string; title: string; endpoints: Endpoint[] };

export type Scheme = { name: string; label: string; desc: string };

/** x-armornet-fga-model — the object types this API checks, counted off policy.go. */
export type FgaObject = {
	object_type: string;
	relations: string[];
	operations: number;
};

export type WsField = { name: string; type: string };

export type WsMessage = {
	name: string;
	/** `send` = agent → server, `recv` = server → agent, empty = either way. */
	direction: string;
	description: string;
	schemaRef?: string;
	fields?: WsField[];
};

/** x-websocket-endpoint — the Line protocol agents connect over. */
export type LineEndpoint = {
	url: string;
	protocol: string;
	description: string;
	messages: WsMessage[];
};

export type ApiIsland = {
	title: string;
	version: string;
	description: string;
	host: string;
	total: number;
	resources: Resource[];
	schemas: Record<string, Field[]>;
	schemes: Scheme[];
	fgaModel?: FgaObject[];
	line?: LineEndpoint;
};
