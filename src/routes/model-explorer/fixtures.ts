// Baked demo data for the Model Explorer page.
//
// Every view here renders a live report fetched from the model daemon in
// app-ui, which is why the subsystem had no showcase page: there was nothing to
// render it against. These fixtures are that missing input — shaped to the WIRE
// names in `model-explorer/types.ts`, not tidied, because the components read
// the JSON straight off the API and a renamed field reads `undefined` silently.
//
// The schema is a plausible slice of armornet's own — organizations, users,
// agents, interceptions — small enough to read at a glance and wide enough that
// the diagram has groups, foreign keys and a table worth inspecting.

import type {
	ErdTable,
	ErdForeignKey,
	ErdGroup,
	DriftReport,
	LedgerEntry,
	ErdDiff,
	CaptureMeta,
	EnvironmentsReport
} from '$lib/model-explorer/types.js';

export const GROUPS: Record<string, ErdGroup> = {
	identity: { label: 'Identity', color: '#818CF8' },
	mesh: { label: 'Mesh', color: '#34D399' },
	telemetry: { label: 'Telemetry', color: '#F59E0B' }
};

function col(
	name: string,
	type: string,
	over: Partial<ErdTable['columns'][number]> = {}
): ErdTable['columns'][number] {
	return { name, type, pk: false, fk: null, unique: false, nullable: false, default: null, ...over };
}

export const TABLES: ErdTable[] = [
	{
		name: 'organizations',
		group: 'identity',
		columns: [
			col('id', 'uuid', { pk: true }),
			col('slug', 'text', { unique: true }),
			col('display_name', 'text'),
			col('created_at', 'timestamptz', { default: 'now()' })
		],
		primaryKey: ['id'],
		indexes: [
			{ name: 'organizations_slug_key', unique: true, method: 'btree', columns: 'slug' }
		],
		checks: [],
		approxRows: 412
	},
	{
		name: 'users',
		group: 'identity',
		columns: [
			col('id', 'uuid', { pk: true }),
			col('subject', 'text', { unique: true }),
			col('display_name', 'text', { nullable: true }),
			col('last_seen_at', 'timestamptz', { nullable: true })
		],
		primaryKey: ['id'],
		indexes: [{ name: 'users_subject_key', unique: true, method: 'btree', columns: 'subject' }],
		checks: [],
		approxRows: 9_180
	},
	{
		name: 'organization_users',
		group: 'identity',
		columns: [
			col('org_id', 'uuid', { pk: true, fk: 'organizations.id' }),
			col('user_id', 'uuid', { pk: true, fk: 'users.id' }),
			col('role', 'text', { default: "'member'" })
		],
		primaryKey: ['org_id', 'user_id'],
		indexes: [],
		checks: [
			{
				name: 'organization_users_role_check',
				expression: "role IN ('owner','admin','member','viewer')"
			}
		],
		approxRows: 11_204
	},
	{
		name: 'agents',
		group: 'mesh',
		columns: [
			col('id', 'uuid', { pk: true }),
			col('org_id', 'uuid', { fk: 'organizations.id' }),
			col('name', 'text'),
			col('mode', 'text'),
			col('last_heartbeat_at', 'timestamptz', { nullable: true })
		],
		primaryKey: ['id'],
		indexes: [{ name: 'agents_org_id_idx', unique: false, method: 'btree', columns: 'org_id' }],
		checks: [],
		approxRows: 2_640
	},
	{
		name: 'interceptions',
		group: 'telemetry',
		columns: [
			col('id', 'bigint', { pk: true }),
			col('org_id', 'uuid', { fk: 'organizations.id' }),
			col('agent_id', 'uuid', { fk: 'agents.id', nullable: true }),
			col('surface', 'text'),
			col('verdict', 'text'),
			col('observed_at', 'timestamptz', { default: 'now()' })
		],
		primaryKey: ['id'],
		indexes: [
			{
				name: 'interceptions_org_observed_idx',
				unique: false,
				method: 'btree',
				columns: 'org_id, observed_at DESC'
			}
		],
		checks: [],
		approxRows: 4_812_390
	},
	{
		name: 'relay_traffic',
		group: 'telemetry',
		columns: [
			col('id', 'bigint', { pk: true }),
			col('agent_id', 'uuid', { fk: 'agents.id' }),
			col('bytes_in', 'bigint', { default: '0' }),
			col('bytes_out', 'bigint', { default: '0' }),
			col('bucket_at', 'timestamptz')
		],
		primaryKey: ['id'],
		indexes: [
			{
				name: 'relay_traffic_agent_bucket_idx',
				unique: false,
				method: 'btree',
				columns: 'agent_id, bucket_at DESC'
			}
		],
		checks: [],
		approxRows: 38_204_115
	}
];

export const FOREIGN_KEYS: ErdForeignKey[] = [
	{
		id: 'organization_users_org_id_fkey',
		fromTable: 'organization_users',
		fromColumns: ['org_id'],
		toTable: 'organizations',
		toColumns: ['id'],
		onDelete: 'CASCADE'
	},
	{
		id: 'organization_users_user_id_fkey',
		fromTable: 'organization_users',
		fromColumns: ['user_id'],
		toTable: 'users',
		toColumns: ['id'],
		onDelete: 'CASCADE'
	},
	{
		id: 'agents_org_id_fkey',
		fromTable: 'agents',
		fromColumns: ['org_id'],
		toTable: 'organizations',
		toColumns: ['id'],
		onDelete: 'CASCADE'
	},
	{
		id: 'interceptions_org_id_fkey',
		fromTable: 'interceptions',
		fromColumns: ['org_id'],
		toTable: 'organizations',
		toColumns: ['id'],
		onDelete: 'CASCADE'
	},
	{
		id: 'interceptions_agent_id_fkey',
		fromTable: 'interceptions',
		fromColumns: ['agent_id'],
		toTable: 'agents',
		toColumns: ['id'],
		onDelete: 'SET NULL'
	},
	{
		id: 'relay_traffic_agent_id_fkey',
		fromTable: 'relay_traffic',
		fromColumns: ['agent_id'],
		toTable: 'agents',
		toColumns: ['id'],
		onDelete: 'CASCADE'
	}
];

// ── Ledger ─────────────────────────────────────────────────────────────────
// One of each state the ledger can show, so the view is exercised rather than
// illustrated: a clean applied row, a pending one, a reverted one, and the two
// that mean someone changed history — checksum drift and an orphan.

export const LEDGER: LedgerEntry[] = [
	{
		sequence: 114,
		name: 'add_org_profile',
		state: 'applied',
		checksum: 'a41f9c2e',
		has_rollback: true,
		rollback_not_possible: false,
		applied_by: 'ci@armornet',
		events: [
			{
				id: 901,
				sequence: 114,
				name: 'add_org_profile',
				event: 'applied',
				actor: 'ci@armornet',
				checksum: 'a41f9c2e',
				occurred_at: '2026-08-11T09:14:02Z'
			}
		]
	},
	{
		sequence: 115,
		name: 'encrypt_org_profile_blob',
		state: 'applied',
		checksum: '7b0d5518',
		has_rollback: false,
		rollback_not_possible: true,
		applied_by: 'ci@armornet',
		events: null
	},
	{
		sequence: 116,
		name: 'add_control_catalog',
		state: 'checksum_drift',
		checksum: 'c93a1104',
		has_rollback: true,
		rollback_not_possible: false,
		applied_by: 'ci@armornet',
		events: [
			{
				id: 902,
				sequence: 116,
				name: 'add_control_catalog',
				event: 'applied',
				actor: 'ci@armornet',
				checksum: '2ee70f8b',
				occurred_at: '2026-08-19T16:41:55Z'
			},
			{
				id: 903,
				sequence: 116,
				name: 'add_control_catalog',
				event: 'checksum_drift',
				actor: 'model-daemon',
				reason: 'file changed after it was applied',
				checksum: 'c93a1104',
				occurred_at: '2026-08-26T08:02:10Z'
			}
		]
	},
	{
		sequence: 117,
		name: 'drop_evidence_url',
		state: 'reverted',
		checksum: '10cc4d7a',
		has_rollback: true,
		rollback_not_possible: false,
		applied_by: 'a-teammate',
		events: null
	},
	{
		sequence: 118,
		name: 'add_agent_entitlements',
		state: 'pending',
		checksum: 'ff21b063',
		has_rollback: true,
		rollback_not_possible: false,
		events: null
	},
	{
		sequence: 0,
		name: 'hotfix_relay_index',
		state: 'orphan_applied',
		checksum: '5d8e0091',
		has_rollback: false,
		rollback_not_possible: true,
		applied_by: 'someone@laptop',
		events: null
	}
];

// ── Diff ───────────────────────────────────────────────────────────────────

export const DIFF: ErdDiff = {
	objects: [
		{
			name: 'agents',
			class: 'different',
			sourceDdl: 'CREATE TABLE agents (\n  id uuid PRIMARY KEY,\n  org_id uuid NOT NULL,\n  name text NOT NULL,\n  mode text NOT NULL,\n  last_heartbeat_at timestamptz\n);',
			targetDdl: 'CREATE TABLE agents (\n  id uuid PRIMARY KEY,\n  org_id uuid NOT NULL,\n  name text NOT NULL\n);',
			alterSql: [
				"ALTER TABLE agents ADD COLUMN mode text NOT NULL DEFAULT 'observe';",
				'ALTER TABLE agents ADD COLUMN last_heartbeat_at timestamptz;'
			],
			dataLoss: false,
			warnings: ['ADD COLUMN NOT NULL rewrites the table — 2.6k rows'],
			columnsAdded: ['mode', 'last_heartbeat_at'],
			columnsRemoved: null,
			columnsChanged: null
		},
		{
			name: 'interceptions',
			class: 'different',
			sourceDdl: 'CREATE TABLE interceptions (\n  id bigint PRIMARY KEY,\n  surface text NOT NULL\n);',
			targetDdl: 'CREATE TABLE block_events (\n  id bigint PRIMARY KEY,\n  kind text NOT NULL\n);',
			alterSql: ['ALTER TABLE block_events RENAME TO interceptions;', 'ALTER TABLE interceptions RENAME COLUMN kind TO surface;'],
			dataLoss: false,
			warnings: null,
			columnsAdded: null,
			columnsRemoved: null,
			columnsChanged: ['kind → surface']
		},
		{
			name: 'org_profile',
			class: 'source_only',
			sourceDdl: 'CREATE TABLE org_profile (\n  org_id uuid PRIMARY KEY,\n  content bytea NOT NULL,\n  nonce bytea NOT NULL\n);',
			targetDdl: '',
			alterSql: ['CREATE TABLE org_profile (org_id uuid PRIMARY KEY, content bytea NOT NULL, nonce bytea NOT NULL);'],
			dataLoss: false,
			warnings: null,
			columnsAdded: null,
			columnsRemoved: null,
			columnsChanged: null
		},
		{
			name: 'evidence_url',
			class: 'target_only',
			sourceDdl: '',
			targetDdl: 'CREATE TABLE evidence_url (\n  id bigint PRIMARY KEY,\n  url text NOT NULL\n);',
			alterSql: ['DROP TABLE evidence_url;'],
			dataLoss: true,
			warnings: ['DROP TABLE discards 14,802 rows'],
			columnsAdded: null,
			columnsRemoved: null,
			columnsChanged: null
		},
		{
			name: 'organizations',
			class: 'identical',
			sourceDdl: '',
			targetDdl: '',
			alterSql: null,
			dataLoss: false,
			warnings: null,
			columnsAdded: null,
			columnsRemoved: null,
			columnsChanged: null
		}
	],
	summary: { different: 2, source_only: 1, target_only: 1, identical: 1 }
};

export const DRIFT: DriftReport = { diff: DIFF, ledger: LEDGER, hasDrift: true };

/** The same report with nothing wrong — the state the view spends most of its life in. */
export const NO_DRIFT: DriftReport = {
	diff: { objects: [], summary: { identical: 6 } },
	ledger: LEDGER.filter((e) => e.state === 'applied'),
	hasDrift: false
};

export const CAPTURES: CaptureMeta[] = [
	{
		id: '01M1AFBDYVDXY3DPM376QZPEGW',
		label: 'pre-0116 control catalog',
		source: 'live',
		sourceDetail: 'stage',
		schemaName: 'public',
		schemaVersion: '1.0115.01',
		tableCount: 84,
		fkCount: 131,
		capturedBy: 'ci@armornet',
		capturedAt: '2026-08-19T16:40:02Z'
	},
	{
		id: '01M1CQ7HK2ZR0V8N4T6B9WXJ3D',
		label: 'nightly',
		source: 'live',
		sourceDetail: 'prod',
		schemaName: 'public',
		schemaVersion: '1.0116.01',
		tableCount: 86,
		fkCount: 134,
		capturedBy: 'model-daemon',
		capturedAt: '2026-08-29T02:00:00Z'
	},
	{
		id: '01M1D2R5NP4XQ7YB0K8M3VZT6F',
		label: 'local before migrate',
		source: 'file',
		sourceDetail: 'schema.sql',
		schemaName: 'public',
		tableCount: 86,
		fkCount: 134,
		capturedAt: '2026-08-30T07:12:44Z'
	}
];

export const ENVIRONMENTS: EnvironmentsReport = {
	environments: [
		{ name: 'local', reachable: true, headSequence: 118 },
		{ name: 'dev', reachable: true, headSequence: 118 },
		{ name: 'stage', reachable: true, headSequence: 116 },
		{ name: 'prod', reachable: false, headSequence: 0, error: 'dial tcp: i/o timeout' }
	],
	migrations: [
		{ sequence: 114, name: 'add_org_profile', applied: { local: true, dev: true, stage: true, prod: false } },
		{ sequence: 115, name: 'encrypt_org_profile_blob', applied: { local: true, dev: true, stage: true, prod: false } },
		{ sequence: 116, name: 'add_control_catalog', applied: { local: true, dev: true, stage: true, prod: false } },
		{ sequence: 117, name: 'drop_evidence_url', applied: { local: true, dev: true, stage: false, prod: false } },
		{ sequence: 118, name: 'add_agent_entitlements', applied: { local: true, dev: true, stage: false, prod: false } }
	]
};
