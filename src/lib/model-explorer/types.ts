// ── Model Explorer shared types ────────────────────────────────────────────
// The single source of truth for the ERD/ledger/diff shapes.
//
// Every field name here is a WIRE name: it must match the Go `json:` tag on the
// corresponding dbmgr struct exactly, because these objects arrive as parsed
// JSON and are never mapped. dbmgr is not consistent about casing — the ledger
// is snake_case and the diff is camelCase with a shouty `Ddl`/`Sql` — and the
// temptation to tidy that here is a trap: a renamed field does not fail to
// compile, it silently reads `undefined` at runtime. Cross-check against
// dbmgr/event.go, dbmgr/erd.go, dbmgr/erd_diff.go, dbmgr/capture.go and
// dbmgr/environments.go before touching a name.

export interface ErdColumn {
	name: string;
	type: string;
	pk: boolean;
	fk: string | null;
	unique: boolean;
	nullable: boolean;
	default: string | null;
}

export interface ErdIndex {
	name: string;
	unique: boolean;
	method: string;
	columns: string;
}

export interface ErdCheck {
	name: string;
	expression: string;
}

export interface ErdTable {
	name: string;
	group: string;
	columns: ErdColumn[];
	primaryKey: string[];
	indexes: ErdIndex[];
	checks: ErdCheck[];
	approxRows: number;
}

export interface ErdForeignKey {
	id: string;
	fromTable: string;
	fromColumns: string[];
	toTable: string;
	toColumns: string[];
	onDelete: string;
}

export interface ErdGroup {
	label: string;
	color: string;
}

/** The three payloads the diagram needs, as one bundle. */
export interface ErdData {
	tables: ErdTable[];
	foreignKeys: ErdForeignKey[];
	groups: Record<string, ErdGroup>;
}

/** `dbmgr.ERD` as it comes off /api/erd — ErdData plus the schema it came from. */
export interface Erd extends ErdData {
	schema: string;
}

export function defaultErdData(): ErdData {
	return { tables: [], foreignKeys: [], groups: {} };
}

// ── Ledger / status ────────────────────────────────────────────────────────

export interface MigrationEvent {
	id: number;
	sequence: number;
	name: string;
	event: string;
	actor: string;
	reason?: string;
	checksum?: string;
	/** snake_case on the wire — dbmgr/event.go. */
	occurred_at: string;
}

export interface LedgerEntry {
	sequence: number;
	name: string;
	/** applied | pending | reverted | checksum_drift | orphan_applied */
	state: string;
	checksum: string;
	has_rollback: boolean;
	rollback_not_possible: boolean;
	applied_by?: string;
	events?: MigrationEvent[] | null;
}

// ── Diff / drift ───────────────────────────────────────────────────────────

export type ChangeClass = 'different' | 'source_only' | 'target_only' | 'identical';

export interface ObjectDiff {
	name: string;
	class: ChangeClass;
	sourceDdl: string;
	targetDdl: string;
	alterSql: string[] | null;
	dataLoss: boolean;
	warnings: string[] | null;
	columnsAdded: string[] | null;
	columnsRemoved: string[] | null;
	columnsChanged: string[] | null;
}

export interface ErdDiff {
	objects: ObjectDiff[] | null;
	summary: Partial<Record<ChangeClass, number>>;
}

export function defaultErdDiff(): ErdDiff {
	return { objects: [], summary: {} };
}

export interface DriftReport {
	diff: ErdDiff | null;
	ledger: LedgerEntry[] | null;
	hasDrift: boolean;
}

export function defaultDriftReport(): DriftReport {
	return { diff: defaultErdDiff(), ledger: [], hasDrift: false };
}

// ── Captures ───────────────────────────────────────────────────────────────

export interface CaptureMeta {
	id: string;
	label: string;
	source: string;
	sourceDetail?: string;
	schemaName: string;
	schemaVersion?: string;
	tableCount: number;
	fkCount: number;
	capturedBy?: string;
	capturedAt: string;
}

// ── Environments ───────────────────────────────────────────────────────────

export interface EnvSummary {
	name: string;
	reachable: boolean;
	headSequence: number;
	error?: string;
}

export interface EnvMatrixRow {
	sequence: number;
	name: string;
	applied: Record<string, boolean>;
}

export interface EnvironmentsReport {
	environments: EnvSummary[];
	migrations: EnvMatrixRow[];
}

export function defaultEnvironmentsReport(): EnvironmentsReport {
	return { environments: [], migrations: [] };
}
