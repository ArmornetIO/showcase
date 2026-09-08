// ── ERD lint — conventions the schema votes on, not a style guide ──────────
// A pure function of the ErdData the diagram already has: no database, no API
// call, no knowledge of any particular schema. That is the whole design. The
// diagram can lint whatever it is currently showing, including a decoded
// capture from six months ago, because nothing here needs a live connection.
//
// Every rule below earned its exclusion clauses against a real 135-table
// schema, and the exclusions are the load-bearing half. Stated naively,
// `name-drift` flags 71 of 138 foreign keys and is unusable noise; with the two
// exclusions it flags 1, and that 1 is a genuine rename that outran its column
// names. A rule that cries wolf is worse than no rule, because it trains the
// reader to close the panel.

import type { ErdData, ErdTable } from './types.js';

export type LintRule = 'missing-fk' | 'name-drift' | 'vocabulary' | 'grouping' | 'case';

/** `warn` — the schema is lying or inconsistent. `advice` — a defensible
 *  recommendation. `info` — housekeeping that costs nothing to ignore today. */
export type LintSeverity = 'warn' | 'advice' | 'info';

export interface LintFinding {
	rule: LintRule;
	severity: LintSeverity;
	/** Empty for schema-level findings that belong to no single table. */
	table: string;
	column?: string;
	message: string;
	/** The concrete recommendation, when there is one to make. */
	fix?: string;
}

export interface LintReport {
	findings: LintFinding[];
	byTable: Map<string, LintFinding[]>;
	counts: Record<LintRule, number>;
	total: number;
}

export interface LintOptions {
	/** Abbreviations this schema treats as the same word. Defaults cover the
	 *  ones that recur across most schemas; a host adds its own jargon. */
	aliases?: Record<string, string>;
	/** Name stems that describe a ROLE rather than a table. `created_by` and
	 *  `parent_id` pointing at users/controls are better names than `user_id`
	 *  and `control_id`, so they must never be reported as drift. */
	roleQualifiers?: string[];
	/** A vocabulary election needs this many voters before the minority is
	 *  worth reporting — otherwise a 2-vs-1 split manufactures advice. */
	minSupport?: number;
}

const DEFAULT_ALIASES: Record<string, string> = {
	org: 'organization',
	conn: 'connection',
	repo: 'repository',
	cert: 'certification',
	config: 'configuration',
	spec: 'specification',
	addr: 'address',
	msg: 'message'
};

// Matched against the whole stem, or as a leading/trailing segment, so
// `subject_org_id` and `from_policy_id` are covered without listing every
// combination.
const DEFAULT_ROLES = [
	'created_by', 'updated_by', 'deleted_by', 'added_by', 'invited_by',
	'accepted_by', 'approved_by', 'reviewed_by', 'owner', 'reviewer', 'author',
	'parent', 'child', 'source', 'target', 'from', 'to', 'subject', 'actor'
];

// ── Normalization — the thing that makes every rule below work ──────────────

/** Squash separators and case so `userId`, `user_id` and `User-Id` are one
 *  word. Deliberately NOT reversible: this is a comparison key, never a name. */
export function squash(s: string): string {
	return s.toLowerCase().replace(/[\s\-_]+/g, '');
}

function singularize(s: string): string {
	if (s.endsWith('ies') && s.length > 4) return `${s.slice(0, -3)}y`;
	if (s.endsWith('ses') && s.length > 4) return s.slice(0, -2);
	if (s.endsWith('s') && !s.endsWith('ss') && s.length > 2) return s.slice(0, -1);
	return s;
}

/** The comparison key: split on separators, expand abbreviations, squash,
 *  singularize. `org_id` stem and `organizations` both land on `organization`. */
export function canon(s: string, aliases: Record<string, string> = DEFAULT_ALIASES): string {
	const parts = s.toLowerCase().split(/[\s\-_]+/).filter(Boolean);
	return singularize(squash(parts.map((p) => aliases[p] ?? p).join('')));
}

const stripIdSuffix = (s: string) => s.replace(/_(id|key)$/, '');

function isRoleQualified(stem: string, roles: string[]): boolean {
	const segs = stem.split('_');
	return roles.some(
		(r) => stem === r || (r.includes('_') ? stem.endsWith(r) : segs[0] === r || segs.at(-1) === r)
	);
}

// ── The rules ───────────────────────────────────────────────────────────────

/**
 * R0 — case and shape. Nearly free, and near-silent on a healthy schema; it
 * exists so `userId` can never quietly enter. A leading underscore is exempt:
 * that is how a column escapes a reserved word, not a mistake.
 */
function lintCase(tables: ErdTable[], out: LintFinding[]) {
	for (const t of tables) {
		for (const c of t.columns) {
			if (/^[a-z][a-z0-9_]*$/.test(c.name) || /^_[a-z]/.test(c.name)) continue;
			out.push({
				rule: 'case',
				severity: 'warn',
				table: t.name,
				column: c.name,
				message: `"${c.name}" is not lower snake_case`,
				fix: c.name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s\-]+/g, '_').toLowerCase()
			});
		}
	}
}

/**
 * R1 — a column that names a table but does not point at it. The type gate is
 * what makes this a recommendation rather than a wish: an `org_id text` beside
 * an `organizations.id uuid` cannot take the constraint without a migration
 * this rule has no business proposing.
 */
function lintMissingFk(
	tables: ErdTable[],
	byCanon: Map<string, ErdTable>,
	opts: Required<LintOptions>,
	out: LintFinding[]
) {
	for (const t of tables) {
		for (const c of t.columns) {
			if (c.fk || c.pk || !c.name.endsWith('_id')) continue;
			const target = byCanon.get(canon(c.name.slice(0, -3), opts.aliases));
			if (!target || target.name === t.name) continue;
			const targetPk = target.columns.find((x) => x.name === 'id');
			if (!targetPk || targetPk.type !== c.type) continue;
			out.push({
				rule: 'missing-fk',
				severity: 'advice',
				table: t.name,
				column: c.name,
				message: `names ${target.name} but carries no foreign key`,
				fix: `REFERENCES ${target.name}(id)`
			});
		}
	}
}

/**
 * R2 — the name lies: the stem names a table that EXISTS, and it is not the
 * one referenced. This is the rename detector — when `block_events` became
 * `interceptions`, every `block_id` kept pointing at the right rows under the
 * wrong noun, and nothing in Postgres cared.
 *
 * Both exclusions are mandatory. A composite foreign key's non-`id` leg
 * (`policy_controls.org_id → org_controls.org_id`) is a parent reference, not
 * a lie; and a role-qualified stem is a better name than the table's own.
 */
function lintNameDrift(
	tables: ErdTable[],
	byCanon: Map<string, ErdTable>,
	opts: Required<LintOptions>,
	out: LintFinding[]
) {
	for (const t of tables) {
		for (const c of t.columns) {
			if (!c.fk) continue;
			const [toTable, toColumn] = c.fk.split('.');
			if (toColumn !== 'id') continue; // composite leg
			const stem = stripIdSuffix(c.name);
			if (isRoleQualified(stem, opts.roleQualifiers)) continue;
			const named = byCanon.get(canon(stem, opts.aliases));
			if (!named || canon(named.name, opts.aliases) === canon(toTable, opts.aliases)) continue;
			out.push({
				rule: 'name-drift',
				severity: 'warn',
				table: t.name,
				column: c.name,
				message: `points at ${toTable} while table "${named.name}" exists`,
				fix: `rename toward ${toTable}, or repoint at ${named.name}`
			});
		}
	}
}

/**
 * R3 — vocabulary drift, decided by majority vote. No hardcoded house style:
 * each axis is an election over the schema's own columns, the plurality is the
 * convention and the minority is the finding. It reports what this schema
 * already does, so it stays right when the house style changes.
 *
 * Temporal suffixes are elected PER STORAGE TYPE. Pooling them is the trap:
 * `_on` is used by 6 columns and all 6 are DATE while no `_at` is, which makes
 * `_on` a correct convention that a pooled vote would flag as 6 mistakes.
 */
function lintVocabulary(tables: ErdTable[], opts: Required<LintOptions>, out: LintFinding[]) {
	type Vote = { suffix: string; table: string; column: string };

	// A plurality is not enough to rename anything. The winner must hold a
	// strict majority, or the schema has no convention and this rule has no
	// business having an opinion — armornet's DATE columns split 6 `_on` to 6
	// bare, and the plurality reading of that tie proposed renaming
	// `effective_on` to `effective_`.
	const elect = (votes: Vote[], describe: (v: Vote, winner: string) => LintFinding) => {
		if (votes.length < opts.minSupport) return;
		const tally = new Map<string, number>();
		for (const v of votes) tally.set(v.suffix, (tally.get(v.suffix) ?? 0) + 1);
		const [winner, top] = [...tally].sort((a, b) => b[1] - a[1])[0];
		if (top === votes.length) return; // unanimous
		if (top * 2 <= votes.length) return; // no majority — no convention to cite
		for (const v of votes) if (v.suffix !== winner) out.push(describe(v, winner));
	};

	// Temporal suffix, one election per storage type.
	const temporal = new Map<string, Vote[]>();
	for (const t of tables) {
		for (const c of t.columns) {
			if (!/^(timestamp|date|time)/.test(c.type)) continue;
			const m = /_(at|on|time|date|ts|timestamp)$/.exec(c.name);
			const bucket = temporal.get(c.type) ?? [];
			bucket.push({ suffix: m ? m[1] : '', table: t.name, column: c.name });
			temporal.set(c.type, bucket);
		}
	}
	for (const votes of temporal.values()) {
		elect(votes, (v, winner) => ({
			rule: 'vocabulary',
			severity: 'advice',
			table: v.table,
			column: v.column,
			message: v.suffix
				? `ends _${v.suffix} where this schema says _${winner}`
				: `no temporal suffix where this schema says _${winner}`,
			fix: `${stripTemporal(v.column)}_${winner}`
		}));
	}

	// Boolean prefix.
	const bools: Vote[] = [];
	for (const t of tables) {
		for (const c of t.columns) {
			if (c.type !== 'boolean') continue;
			const m = /^(is|has|can|should|allow|use|require)_/.exec(c.name);
			bools.push({ suffix: m ? m[1] : '', table: t.name, column: c.name });
		}
	}
	elect(bools, (v, winner) => ({
		rule: 'vocabulary',
		severity: 'advice',
		table: v.table,
		column: v.column,
		message: winner
			? `missing the ${winner}_ prefix this schema uses for booleans`
			: `prefixed ${v.suffix}_ where this schema names booleans bare`,
		fix: winner ? `${winner}_${v.column}` : v.column.replace(/^[a-z]+_/, '')
	}));

	// Abbreviation splits — both spellings of one word are in use.
	const names = new Set<string>();
	for (const t of tables) for (const c of t.columns) names.add(c.name);
	for (const [short, long] of Object.entries(opts.aliases)) {
		const seg = (w: string) => [...names].filter((n) => n.split('_').includes(w));
		const s = seg(short);
		const l = seg(long);
		if (!s.length || !l.length) continue;
		if (s.length + l.length < opts.minSupport) continue; // too thin to call a convention
		if (s.length === l.length) continue; // an even split is a decision, not a finding
		const [minority, winner] = s.length < l.length ? [s, long] : [l, short];
		const loser = winner === long ? short : long;
		for (const n of minority) {
			for (const t of tables) {
				if (!t.columns.some((c) => c.name === n)) continue;
				out.push({
					rule: 'vocabulary',
					severity: 'advice',
					table: t.name,
					column: n,
					message: `spells "${loser}" where this schema prefers "${winner}"`,
					fix: n.split('_').map((p) => (p === loser ? winner : p)).join('_')
				});
			}
		}
	}
}

const stripTemporal = (s: string) => s.replace(/_(at|on|time|date|ts|timestamp)$/, '');

/**
 * R4 — grouping housekeeping. Two of the three checks worth making are
 * computable here; the third is not, and pretending otherwise would be a lie:
 * a group claim for a table that no longer exists cannot be seen from an ERD,
 * because an ERD only contains tables that DO exist. That check belongs to
 * whatever host supplies the grouper.
 */
function lintGrouping(data: ErdData, out: LintFinding[]) {
	const live = new Set(data.tables.map((t) => t.group));
	for (const key of Object.keys(data.groups)) {
		if (live.has(key)) continue;
		out.push({
			rule: 'grouping',
			severity: 'info',
			table: '',
			message: `group "${data.groups[key].label}" has no tables — a legend entry nobody can reach`,
			fix: `drop "${key}" or claim its tables`
		});
	}

	// An unclaimed prefix shared by 3+ tables is one missing heuristic, not
	// N missing claims — report it once, where the fix is.
	const unclaimed = data.tables.filter((t) => t.group === 'other');
	const families = new Map<string, string[]>();
	for (const t of unclaimed) {
		const prefix = t.name.split('_')[0];
		families.set(prefix, [...(families.get(prefix) ?? []), t.name]);
	}
	for (const [prefix, members] of families) {
		if (members.length < 3) continue;
		out.push({
			rule: 'grouping',
			severity: 'info',
			table: members[0],
			message: `${members.length} unclaimed tables share the "${prefix}_" prefix`,
			fix: `one prefix rule claims all ${members.length}: ${members.join(', ')}`
		});
	}

	const loose = unclaimed.filter((t) => (families.get(t.name.split('_')[0])?.length ?? 0) < 3);
	for (const t of loose) {
		out.push({
			rule: 'grouping',
			severity: 'info',
			table: t.name,
			message: 'unclaimed — renders in the "other" bucket',
			fix: 'claim it in the host grouper'
		});
	}
}

// ── Entry point ─────────────────────────────────────────────────────────────

const EMPTY_COUNTS = (): Record<LintRule, number> => ({
	'missing-fk': 0,
	'name-drift': 0,
	vocabulary: 0,
	grouping: 0,
	case: 0
});

/** Lint whatever the diagram is showing. Pure — same input, same report. */
export function lintErd(data: ErdData, options: LintOptions = {}): LintReport {
	const opts: Required<LintOptions> = {
		aliases: { ...DEFAULT_ALIASES, ...(options.aliases ?? {}) },
		roleQualifiers: options.roleQualifiers ?? DEFAULT_ROLES,
		minSupport: options.minSupport ?? 8
	};

	const findings: LintFinding[] = [];
	const byCanon = new Map<string, ErdTable>();
	for (const t of data.tables) byCanon.set(canon(t.name, opts.aliases), t);

	lintCase(data.tables, findings);
	lintNameDrift(data.tables, byCanon, opts, findings);
	lintMissingFk(data.tables, byCanon, opts, findings);
	lintVocabulary(data.tables, opts, findings);
	lintGrouping(data, findings);

	const RANK: Record<LintSeverity, number> = { warn: 0, advice: 1, info: 2 };
	findings.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.table.localeCompare(b.table));

	const counts = EMPTY_COUNTS();
	const byTable = new Map<string, LintFinding[]>();
	for (const f of findings) {
		counts[f.rule]++;
		if (f.table) byTable.set(f.table, [...(byTable.get(f.table) ?? []), f]);
	}

	return { findings, byTable, counts, total: findings.length };
}

/** Rule metadata for the overlay's legend — label, hue and one-line intent. */
export const LINT_RULES: Record<LintRule, { label: string; color: string; blurb: string }> = {
	'name-drift': {
		label: 'name drift',
		color: '#F87171',
		blurb: 'the column names a table it does not point at — usually a rename that outran its columns'
	},
	case: {
		label: 'case',
		color: '#FB923C',
		blurb: 'not lower snake_case'
	},
	'missing-fk': {
		label: 'missing FK',
		color: '#38BDF8',
		blurb: 'names a table, types match, no constraint'
	},
	vocabulary: {
		label: 'vocabulary',
		color: '#A78BFA',
		blurb: 'a minority spelling against the convention this schema votes for'
	},
	grouping: {
		label: 'grouping',
		color: '#94A3B8',
		blurb: 'unclaimed tables and unreachable legend entries'
	}
};
