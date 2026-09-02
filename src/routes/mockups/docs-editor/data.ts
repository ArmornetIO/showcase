// ───────────────────────────────────────────────────────────────────────────
// Stub data for the docs-editor mockup.
//
// THE CHAIN this mockup exists to show, end to end:
//
//   clause → control → BINDING → command → run → evidence → back to the clause
//
// A policy clause claims a control. It does NOT carry the script that proves
// it — a policy is a legal document and contains no bash. Instead the clause
// BINDS a Command: a first-class object in the org's catalog, which is the
// allowlist. A runner executes only what the catalog holds. The run's output
// becomes evidence that the control was actually operating, cited back against
// the clause that claimed it. A procedure document is where those commands
// physically live, with its steps ordered, so a runbook runs the sequence.
//
// Everything mirrors the shape the REST layer would return, snake_case and all.
// Prose is NOT stored by Armornet — it lives in the customer's repo, and git is
// the versioning: a run records the sha it ran at. What we hold is the identity
// graph: section ids, control claims, the command catalog, bindings, run
// records and evidence citations, all keyed on the opaque section id.
//
// Direction of authority, which the shell must never blur:
//
//   prose     forge-authoritative   pending until you commit
//   graph     store-authoritative   saved instantly, projected out to
//                                   frontmatter on commit — push-only,
//                                   never merged back
// ───────────────────────────────────────────────────────────────────────────

export type SyncState = 'synced' | 'drifted' | 'local' | 'conflict';
export type AnchorState = 'anchored' | 'reanchor' | 'new';
/**
 * What a document is allowed to contain, which is the whole reason the kind
 * exists. A POLICY is a legal document and renders no code, ever. A PROCEDURE
 * (a runbook) is where the commands actually live. A NOTE is any other dev doc
 * we parse commands out of.
 */
export type DocKind = 'folder' | 'policy' | 'procedure' | 'note';

/** The frontmatter lifecycle used by the corporate policy/procedure templates. */
export type DocStatus = 'draft' | 'review' | 'approved' | 'deprecated';
export type Classification = 'public' | 'internal' | 'confidential' | 'restricted';

/**
 * How a piece of evidence was produced. `run_output` is the only kind Armornet
 * can re-collect on its own, which is why a stale run is a one-click fix and a
 * stale attestation is a person's job.
 */
export type EvidenceKind = 'run_output' | 'attestation' | 'config_capture' | 'document';

/**
 * Evidence is a claim with an expiry, not a file attachment.
 *
 * An audit of operating effectiveness asks whether a control operated
 * *throughout a period*, so a citation collected 400 days ago proves nothing
 * about this quarter. Every citation is scored against the cadence of the
 * control it supports: that ratio, not the file, is what is actually being sold.
 */
export type Freshness = 'fresh' | 'aging' | 'stale' | 'expired';

/** One repo binding: a forge repo plus the subtree holding the documents. */
export interface Corpus {
	id: string;
	label: string;
	forge: string;
	repo: string;
	subtree: string;
	branch: string;
	head_sha: string;
	doc_count: number;
	last_sync: string;
	sync_health: 'healthy' | 'degraded' | 'offline';
}

export interface TreeNode {
	id: string;
	/** Frontmatter id — POL-002, SOP-014. What an auditor cites. */
	doc_id: string;
	title: string;
	/** Repo filename — what an engineer greps for. Both, always. */
	filename: string;
	kind: DocKind;
	depth: number;
	sync_state?: SyncState;
	doc_status?: DocStatus;
	/** Control claims on this doc that cite no evidence. */
	gap_count?: number;
	/** Citations past their control's cadence. */
	stale_count?: number;
	/** Bound checks on this doc — what makes a policy prove itself. */
	check_count?: number;
	/** Bound checks whose last run failed. Outranks a gap: proof it does NOT hold. */
	failing_count?: number;
}

// ── Controls ──────────────────────────────────────────────────────────────

/**
 * A control from the reference catalog. `name` is Armornet's own generic
 * phrasing, never the standard's verbatim text — `ref` carries the citation and
 * the auditor has the source document.
 */
export interface Control {
	control_id: string;
	/** The framework's own citation: CC6.1, A.8.24. */
	ref: string;
	framework: string;
	/** Version is part of a framework's identity — A.8.24 means nothing without it. */
	framework_version: string;
	name: string;
	/**
	 * How often this control's evidence must be re-collected for operating
	 * effectiveness to stay provable. The denominator every citation is scored
	 * against.
	 */
	cadence_days: number;
	/**
	 * Equivalent controls in OTHER frameworks. This is the round trip that pays
	 * for the whole control model: one run proves several things at once.
	 */
	crosswalk: { ref: string; framework: string; strength: 'equivalent' | 'partial' }[];
}

// ── Commands ──────────────────────────────────────────────────────────────
//
// A COMMAND is a first-class object. It exists whether or not any document
// mentions it, and a clause BINDS to it the way a clause cites evidence.
//
// This is the correction that reshaped the model. The old design put a runnable
// block INSIDE a clause, which is wrong for the primary document type in the
// product: a policy is a legal document and must never contain bash. A policy
// clause says access reviews happen quarterly; the script that performs them
// lives in a runbook, and the clause points at it.
//
// Five axes, deliberately separate, because the old four-state machine folded
// three of them together and only worked for fenced markdown:
//
//   identity    which command is this          command_id (survives renames)
//   body        what does it do                body (4 kinds)
//   provenance  how did it come to exist       origin
//   catalog     may a runner execute it        approval vs body_hash
//   history     what actually happened         runs
//
// The binding — when it runs, and for which clause — is its own object, because
// one Command legitimately serves many clauses on different cadences.

/** What the Command does. Provenance is orthogonal to this — see CommandOrigin. */
export type CommandKind = 'script' | 'inline' | 'binary' | 'assertion';

export type CommandBody =
	| { kind: 'script'; interpreter: 'bash' | 'python' | 'pwsh'; source: string }
	| { kind: 'inline'; lang: string; code: string }
	| { kind: 'binary'; argv: string[]; image: string | null }
	/**
	 * Proof WITHOUT execution — "a file matching X exists in Y, dated within N
	 * days". Nothing runs, but the question still has an answer, a cadence and a
	 * history, so it is the same object. `params` hashes like any other body,
	 * which is what lets the catalog axis stay universal.
	 */
	| {
			kind: 'assertion';
			assert: 'file_exists' | 'file_recent' | 'http_ok' | 'record_count';
			params: Record<string, string | number>;
	  };

/** How the Command came to exist. Not what it is. */
export type Provenance = 'authored' | 'discovered';

/** Only meaningful when discovered: has the source block moved underneath us? */
export type SourceState = 'tracking' | 'drifted' | 'orphaned';

export interface CommandOrigin {
	provenance: Provenance;
	/** Discovered: the document and clause the body was parsed out of. */
	doc_id: string | null;
	section_id: string | null;
	path: string | null;
	/** The commit sha the body was read at. Git is the versioning, not us. */
	sha: string | null;
	source_state: SourceState;
	at: string;
	by: string;
}

/**
 * The catalog row — the allowlist entry. Keyed by content hash so that a
 * re-scrape of the repo is naturally idempotent, and so an edit after approval
 * is detectable without trusting a webhook to have been delivered exactly once.
 */
export interface CommandApproval {
	approved_hash: string;
	approved_at: string;
	approved_by: string;
	runner: string;
	runner_kind: 'agent' | 'sandbox';
	on_failure: 'stop' | 'retry' | 'continue';
}

export interface CommandRun {
	run_id: string;
	at: string;
	age_days: number;
	outcome: 'pass' | 'fail' | 'error';
	/** One line a human reads instead of an exit code: "0 shared accounts". */
	detail: string;
	duration_ms: number;
	triggered_by: 'manual' | 'scheduled' | 'runbook';
	/** The commit sha the body was at when this ran. Answers "which version?". */
	ran_at_sha: string;
	emitted_evidence_id: string | null;
}

export interface Command {
	command_id: string;
	/** The human name. THIS is what a policy clause shows — never the code. */
	name: string;
	summary: string;
	body: CommandBody;
	/** Hash of the body as it stands now. Mismatch with approval ⇒ superseded. */
	body_hash: string;
	origin: CommandOrigin;
	approval: CommandApproval | null;
	/** Newest first. This IS the evidence trail. */
	runs: CommandRun[];
}

/**
 * The clause↔command edge.
 *
 * Bindings live in Armornet's store and are projected out into document
 * frontmatter on commit — push-only, never merged back. So binding is INSTANT
 * (it is graph data, ours) while prose is pending until commit (it is the
 * customer's repo, theirs). The shell must not blur those two.
 */
export type Trigger =
	| { mode: 'manual' }
	/** Post-MVP: unattended execution is scoped but not built. Shown, marked. */
	| { mode: 'scheduled'; every_days: number; next_at: string };

export interface CommandBinding {
	binding_id: string;
	section_id: string;
	command_id: string;
	trigger: Trigger;
	bound_at: string;
	bound_by: string;
	/** Whether the frontmatter projection has caught up with the store yet. */
	projected: boolean;
}

/**
 * A fenced block as it appears in a document — display only.
 *
 * It carries no registration and no run record any more. If it has been
 * promoted into the catalog, `command_id` says which Command it became, and
 * everything runnable about it lives there.
 */
export interface CodeBlock {
	block_id: string;
	lang: string;
	code: string;
	content_hash: string;
	command_id: string | null;
}

// ── Sections ──────────────────────────────────────────────────────────────
export interface DocSection {
	section_id: string;
	heading: string;
	level: number;
	anchor_state: AnchorState;
	body_html: string;
	body_md: string;
	/** Controls this clause claims to satisfy. */
	control_ids: string[];
	/** Evidence cited against this clause. */
	evidence_ids: string[];
	/**
	 * Fenced blocks in this clause's prose. Inert — rendered only in documents
	 * whose kind permits code at all, and never in a policy.
	 */
	blocks: CodeBlock[];
	/** Commands bound to this clause. The runnable link, in place of blocks. */
	binding_ids: string[];
	/** Ordinal within the procedure, when the doc is a runbook. */
	step_no: number | null;
	drift: DriftRecord | null;
}

/**
 * Emitted when a heading is both reworded AND moved between two commits, so
 * content-similarity alone can no longer identify it. Drift is a property of
 * commits made OUTSIDE this editor — an edit made here carries the section id
 * with it, so the question never arises.
 */
export interface DriftRecord {
	known_heading: string;
	known_ordinal: number;
	observed_heading: string;
	observed_ordinal: number;
	commit_sha: string;
	commit_author: string;
	detected_at: string;
	/** Below the auto-bind floor, which is why this is a human decision. */
	match_confidence: number;
	compare_url: string;
}

// ── Evidence ──────────────────────────────────────────────────────────────
export interface Evidence {
	id: string;
	label: string;
	kind: EvidenceKind;
	source: string;
	collected_at: string;
	age_days: number;
	/** Set when a registered block's run produced this row. */
	from_block_id: string | null;
}

// ── Review ────────────────────────────────────────────────────────────────
// A document is approved or it isn't. There are no per-clause verdicts and
// nothing to flag — the frontmatter carries `status` and `approved_by`, and
// comments are how a reviewer says anything more specific than that.
export interface Approver {
	id: string;
	name: string;
	role: string;
	approved_at: string | null;
}

export interface Comment {
	id: string;
	section_id: string;
	author: string;
	body: string;
	at: string;
}

// ── The document ──────────────────────────────────────────────────────────
export interface Author {
	handle: string;
	commits: number;
}

export interface DocMeta {
	id: string;
	/** Frontmatter id — the citable name. */
	doc_id: string;
	path: string;
	title: string;
	version: string;
	status: DocStatus;
	kind: DocKind;
	owner: string;
	approved_by: string;
	classification: Classification;
	created: string;
	updated: string;
	review_cycle: string;
	next_review: string;
	days_to_review: number;
	tags: string[];
	/** Auto-managed from git history — never hand-edited. */
	authors: Author[];
}

export interface GitState {
	branch: string;
	head_sha: string;
	message: string;
	author_handle: string;
	committed_at: string;
	webhook_state: string;
}

// ══ Data ═══════════════════════════════════════════════════════════════════

export const corpus: Corpus = {
	id: 'cor_01H7ZA',
	label: 'Acme Compliance',
	forge: 'github',
	repo: 'acme-io/compliance',
	subtree: 'docs/',
	branch: 'main',
	head_sha: 'a91f2c4',
	doc_count: 6,
	last_sync: '2 minutes ago',
	sync_health: 'healthy'
};

export const tree: TreeNode[] = [
	// Exactly three documents, one of each kind, mirroring the real templates in
	// docs/corporate/policies/_template.md, docs/corporate/procedures/_template.md
	// and docs/runbooks/. Three is enough to show the whole chain and nothing is
	// filler: the POLICY states the rule and binds checks, the PROCEDURE holds
	// the steps those checks were discovered in, and the RUNBOOK is the ops doc
	// that also turned out to contain a command worth promoting.
	{ id: 'f_pol', doc_id: '', title: 'policies', filename: 'policies/', kind: 'folder', depth: 0 },
	{
		id: 'doc_ac',
		doc_id: 'POL-002',
		title: 'Access Control',
		filename: 'access-control.md',
		kind: 'policy',
		depth: 1,
		sync_state: 'drifted',
		doc_status: 'review',
		gap_count: 1,
		stale_count: 1,
		check_count: 4,
		failing_count: 1
	},
	{
		id: 'f_proc',
		doc_id: '',
		title: 'procedures',
		filename: 'procedures/',
		kind: 'folder',
		depth: 0
	},
	{
		id: 'doc_rk',
		doc_id: 'SOP-014',
		title: 'Rotate Production Keys',
		filename: 'rotate-production-keys.md',
		kind: 'procedure',
		depth: 1,
		sync_state: 'synced',
		doc_status: 'approved',
		gap_count: 0,
		stale_count: 0,
		check_count: 3,
		failing_count: 0
	},
	{
		id: 'f_run',
		doc_id: '',
		title: 'runbooks',
		filename: 'runbooks/',
		kind: 'folder',
		depth: 0
	},
	{
		id: 'doc_gh',
		doc_id: 'RUN-004',
		title: 'GitHub Credential Rotation',
		filename: 'github-credential-rotation.md',
		kind: 'note',
		depth: 1,
		sync_state: 'synced',
		doc_status: 'approved',
		gap_count: 0,
		stale_count: 0,
		check_count: 1,
		failing_count: 0
	}
];

export const doc: DocMeta = {
	id: 'doc_ac',
	doc_id: 'POL-002',
	path: 'docs/corporate/policies/access-control.md',
	title: 'Access Control Policy',
	version: '2.1',
	status: 'review',
	kind: 'policy',
	owner: 'Security',
	approved_by: '',
	classification: 'internal',
	created: '2026-02-14',
	updated: '2026-08-23',
	review_cycle: 'annual',
	next_review: '2027-02-28',
	days_to_review: 189,
	tags: ['access-control', 'iam', 'controls'],
	authors: [
		{ handle: 'd.danes', commits: 14 },
		{ handle: 't.ramos', commits: 6 }
	]
};

export const git: GitState = {
	branch: 'main',
	head_sha: 'a91f2c4',
	message: 'policy(access): clarify rotation cadence',
	author_handle: 'd.danes',
	committed_at: '4 hours ago',
	webhook_state: 'push · healthy'
};

export const controls: Control[] = [
	{
		control_id: 'ctl_cc61',
		ref: 'CC6.1',
		framework: 'SOC 2',
		framework_version: '2017',
		name: 'Logical access — provisioning',
		cadence_days: 90,
		crosswalk: [
			{ ref: 'A.5.15', framework: 'ISO 27001', strength: 'equivalent' },
			{ ref: '7.1', framework: 'PCI DSS', strength: 'partial' }
		]
	},
	{
		control_id: 'ctl_cc62',
		ref: 'CC6.2',
		framework: 'SOC 2',
		framework_version: '2017',
		name: 'Credential lifecycle',
		cadence_days: 90,
		crosswalk: [
			{ ref: 'A.5.17', framework: 'ISO 27001', strength: 'equivalent' },
			{ ref: '8.3', framework: 'PCI DSS', strength: 'equivalent' }
		]
	},
	{
		control_id: 'ctl_a82',
		ref: 'A.8.2',
		framework: 'ISO 27001',
		framework_version: '2022',
		name: 'Privileged access rights',
		cadence_days: 365,
		crosswalk: [{ ref: 'CC6.3', framework: 'SOC 2', strength: 'partial' }]
	}
];

export const evidence: Evidence[] = [
	{
		id: 'ev_01H9C2',
		label: 'keys rotate — exit 0',
		kind: 'run_output',
		source: 'run · blk_01H8YQ',
		collected_at: '2026-08-11',
		age_days: 12,
		from_block_id: 'blk_01H8YQ'
	},
	{
		id: 'ev_01H9D8',
		label: 'Q2 credential rotation attestation',
		kind: 'attestation',
		source: 'd.danes',
		collected_at: '2026-07-05',
		age_days: 49,
		from_block_id: null
	},
	{
		id: 'ev_01H9E1',
		label: 'IdP MFA enforcement settings',
		kind: 'config_capture',
		source: 'okta · scheduled capture',
		collected_at: '2026-08-02',
		age_days: 21,
		from_block_id: null
	},
	{
		id: 'ev_01H9F4',
		label: 'Session lifetime policy export',
		kind: 'config_capture',
		source: 'okta · scheduled capture',
		collected_at: '2026-03-16',
		age_days: 160,
		from_block_id: null
	},
	{
		id: 'ev_01H9H2',
		label: 'Shared-account audit — 0 findings',
		kind: 'run_output',
		source: 'run · blk_01H8ZC',
		collected_at: '2026-08-19',
		age_days: 4,
		from_block_id: 'blk_01H8ZC'
	},
	{
		id: 'ev_01H9K9',
		label: 'Privileged role matrix (signed)',
		kind: 'document',
		source: 'upload · t.ramos',
		collected_at: '2026-06-28',
		age_days: 56,
		from_block_id: null
	}
];

export const sections: DocSection[] = [
	{
		section_id: 'sec_01H8XJ',
		heading: '1. Purpose',
		level: 2,
		anchor_state: 'anchored',
		body_html:
			'<p>This policy defines how access to Acme production systems is granted, reviewed and revoked. It exists to satisfy the least-privilege and access-review requirements that every framework Acme is assessed against states in some form.</p>',
		body_md:
			'This policy defines how access to Acme production systems is granted, reviewed and revoked. It exists to satisfy the least-privilege and access-review requirements that every framework Acme is assessed against states in some form.',
		control_ids: [],
		evidence_ids: [],
		blocks: [],
		binding_ids: [],
		step_no: null,
		drift: null
	},
	{
		section_id: 'sec_01H8XK',
		heading: '2. Scope',
		level: 2,
		anchor_state: 'anchored',
		body_html:
			'<p>Every human operator, every service identity and every third party granted a credential against production. Non-production environments are explicitly out of scope.</p>',
		body_md:
			'Every human operator, every service identity and every third party granted a credential against production. Non-production environments are explicitly out of scope.',
		control_ids: [],
		evidence_ids: [],
		blocks: [],
		binding_ids: [],
		step_no: null,
		drift: null
	},
	{
		section_id: 'sec_01H8XL',
		heading: '5. Policy Statement',
		level: 2,
		anchor_state: 'anchored',
		body_html:
			'<p>Access to production <strong>must</strong> be granted on a least-privilege basis, authenticated through the corporate identity provider, and reviewed at least quarterly. Credentials <strong>must not</strong> be shared between individuals or held by non-individual accounts.</p>',
		body_md:
			'Access to production **must** be granted on a least-privilege basis, authenticated through the corporate identity provider, and reviewed at least quarterly. Credentials **must not** be shared between individuals or held by non-individual accounts.',
		control_ids: [],
		evidence_ids: [],
		blocks: [],
		binding_ids: [],
		step_no: null,
		drift: null
	},
	{
		section_id: 'sec_01H8XN',
		heading: '6. Control Requirements',
		level: 2,
		anchor_state: 'anchored',
		body_html:
			'<p>Each control area below states what must be done, what evidence demonstrates it, and how often that evidence must be re-collected. The checks bound to each area are what actually produce that evidence.</p>',
		body_md:
			'Each control area below states what must be done, what evidence demonstrates it, and how often that evidence must be re-collected. The checks bound to each area are what actually produce that evidence.',
		control_ids: [],
		evidence_ids: [],
		blocks: [],
		binding_ids: [],
		step_no: null,
		drift: null
	},
	{
		section_id: 'sec_01H8XM',
		heading: '6.1 Authentication',
		level: 3,
		anchor_state: 'anchored',
		body_html:
			'<p>Users authenticate through the corporate identity provider. Local passwords are <strong>not</strong> issued for production systems, and no shared account may hold a production credential.</p><ul><li>Second factor is mandatory for every operator role.</li><li>Session lifetime is capped at 12 hours.</li></ul>',
		body_md:
			'Users authenticate through the corporate identity provider. Local passwords are **not** issued for production systems, and no shared account may hold a production credential.\n\n- Second factor is mandatory for every operator role.\n- Session lifetime is capped at 12 hours.',
		control_ids: ['ctl_cc61'],
		evidence_ids: ['ev_01H9E1', 'ev_01H9F4'],
		// No blocks. This is a policy — the clause states the rule, and the
		// command that proves it lives in a runbook and is bound, not embedded.
		blocks: [],
		// A bound command that ran and FAILED. The expensive state: this is not
		// "we have no proof", it is "we have proof it does not hold".
		binding_ids: ['bind_02'],
		step_no: null,
		drift: null
	},
	{
		section_id: 'sec_01H8XP',
		heading: '6.2 Credential Rotation',
		level: 3,
		anchor_state: 'reanchor',
		body_html:
			'<p>Service credentials rotate every 90 days. Rotation is performed by the production key-rotation runbook, and the rotation log is retained for the audit period.</p>',
		body_md:
			'Service credentials rotate every 90 days. Rotation is performed by the production key-rotation runbook, and the rotation log is retained for the audit period.',
		control_ids: ['ctl_cc62'],
		evidence_ids: ['ev_01H9C2', 'ev_01H9D8'],
		blocks: [],
		// Two bindings on one clause, deliberately: an executable command and a
		// non-executing assertion. Both have a cadence, an outcome and a history,
		// which is the argument for them being the same object.
		binding_ids: ['bind_01', 'bind_04'],
		step_no: null,
		drift: {
			known_heading: 'Key Rotation Schedule',
			known_ordinal: 2,
			observed_heading: 'Credential Rotation',
			observed_ordinal: 3,
			commit_sha: 'a91f2c4',
			commit_author: 'd.danes',
			detected_at: '4 hours ago',
			match_confidence: 0.41,
			compare_url: '#compare'
		}
	},
	{
		section_id: 'sec_01H8XR',
		heading: '6.3 Quarterly Access Review',
		level: 3,
		anchor_state: 'new',
		body_html:
			'<p>Every quarter, system owners attest to the access list for each production system they own. Attestations that lapse past the quarter close escalate to the compliance lead.</p>',
		body_md:
			'Every quarter, system owners attest to the access list for each production system they own. Attestations that lapse past the quarter close escalate to the compliance lead.',
		control_ids: ['ctl_a82'],
		evidence_ids: [],
		blocks: [],
		// The worst square on the board: this clause claims a control, cites no
		// evidence, AND its bound command cannot run because the body in the repo
		// was edited after approval. A gap with a blocked route out of it.
		binding_ids: ['bind_03'],
		step_no: null,
		drift: null
	},
	{
		section_id: 'sec_01H8XT',
		heading: '9. Compliance and Monitoring',
		level: 2,
		anchor_state: 'anchored',
		body_html:
			'<p>Adherence is demonstrated by the checks bound to §6, which run against production and emit their output as evidence. Manual audit is the fallback where no check exists, and every such case is a gap to be closed rather than a permanent arrangement.</p>',
		body_md:
			'Adherence is demonstrated by the checks bound to §6, which run against production and emit their output as evidence. Manual audit is the fallback where no check exists, and every such case is a gap to be closed rather than a permanent arrangement.',
		control_ids: [],
		evidence_ids: [],
		blocks: [],
		binding_ids: [],
		step_no: null,
		drift: null
	}
];

// ── The command catalog ───────────────────────────────────────────────────
//
// These live in the org's catalog, NOT in the policy above. Three were
// discovered by parsing runbooks in the customer's repo; one was authored in
// Armornet. Provenance changes nothing about what they are — it is an origin
// story, and its own failure mode (the source block moving underneath us) is
// the same question the clause re-anchoring flow already asks.

export const commands: Command[] = [
	{
		command_id: 'cmd_rotate',
		name: 'Rotate production keys',
		summary: 'Rotates every production service credential and writes a rotation log.',
		body: {
			kind: 'inline',
			lang: 'bash',
			code: 'armornet keys rotate --scope=production --confirm'
		},
		body_hash: 'sha256:9ab3d0',
		origin: {
			provenance: 'discovered',
			doc_id: 'SOP-014',
			section_id: 'sec_sop14_03',
			path: 'runbooks/rotate-production-keys.md',
			sha: 'a91f2c4',
			source_state: 'tracking',
			at: '2026-07-02',
			by: 'sync'
		},
		approval: {
			approved_hash: 'sha256:9ab3d0',
			approved_at: '2026-07-02',
			approved_by: 'd.danes',
			runner: 'agent-prod-1',
			runner_kind: 'agent',
			on_failure: 'stop'
		},
		runs: [
			{
				run_id: 'run_01H9C1',
				at: '12 days ago',
				age_days: 12,
				outcome: 'pass',
				detail: '38 credentials rotated, 0 failures',
				duration_ms: 4120,
				triggered_by: 'manual',
				ran_at_sha: 'a91f2c4',
				emitted_evidence_id: 'ev_01H9C2'
			},
			{
				run_id: 'run_01H8B7',
				at: '3 months ago',
				age_days: 102,
				outcome: 'pass',
				detail: '36 credentials rotated, 0 failures',
				duration_ms: 3980,
				triggered_by: 'manual',
				ran_at_sha: '7c22e10',
				emitted_evidence_id: 'ev_01H9D8'
			}
		]
	},
	{
		command_id: 'cmd_shared',
		name: 'Shared-account audit',
		summary: 'Fails if any production credential is held by a non-individual account.',
		body: {
			kind: 'inline',
			lang: 'bash',
			code: 'armornet access audit --scope=production --shared-accounts'
		},
		body_hash: 'sha256:4f1c8e',
		origin: {
			provenance: 'discovered',
			doc_id: 'SOP-014',
			section_id: 'sec_sop14_01',
			path: 'runbooks/rotate-production-keys.md',
			sha: 'a91f2c4',
			source_state: 'tracking',
			at: '2026-06-18',
			by: 'sync'
		},
		approval: {
			approved_hash: 'sha256:4f1c8e',
			approved_at: '2026-06-18',
			approved_by: 'k.ito',
			runner: 'agent-prod-1',
			runner_kind: 'agent',
			on_failure: 'stop'
		},
		runs: [
			{
				run_id: 'run_01H9G2',
				at: '2 days ago',
				age_days: 2,
				outcome: 'fail',
				detail: '2 shared accounts hold production credentials',
				duration_ms: 2210,
				triggered_by: 'manual',
				ran_at_sha: 'a91f2c4',
				emitted_evidence_id: 'ev_01H9E1'
			},
			{
				run_id: 'run_01H9A8',
				at: '32 days ago',
				age_days: 32,
				outcome: 'pass',
				detail: '0 shared accounts',
				duration_ms: 2180,
				triggered_by: 'manual',
				ran_at_sha: '7c22e10',
				emitted_evidence_id: null
			}
		]
	},
	{
		command_id: 'cmd_review',
		name: 'Quarterly access review',
		summary: 'Collects owner attestations and escalates any that lapsed past quarter close.',
		body: {
			kind: 'inline',
			lang: 'bash',
			code: 'armornet access review --quarter=current --escalate-lapsed'
		},
		// The live body no longer matches what was approved — someone edited the
		// runbook after sign-off, so the catalog row is superseded and nothing
		// will execute it until a human looks at the diff.
		body_hash: 'sha256:c07e11',
		origin: {
			provenance: 'discovered',
			doc_id: 'SOP-022',
			section_id: 'sec_sop22_02',
			path: 'runbooks/quarterly-access-review.md',
			sha: 'e40b7d1',
			source_state: 'drifted',
			at: '2026-05-19',
			by: 'sync'
		},
		approval: {
			approved_hash: 'sha256:71bb92',
			approved_at: '2026-05-19',
			approved_by: 'k.ito',
			runner: 'agent-prod-1',
			runner_kind: 'agent',
			on_failure: 'continue'
		},
		runs: [
			{
				run_id: 'run_01H8W4',
				at: '3 months ago',
				age_days: 96,
				outcome: 'pass',
				detail: '14 of 14 owners attested',
				duration_ms: 8890,
				triggered_by: 'scheduled',
				ran_at_sha: '71bb920',
				emitted_evidence_id: null
			}
		]
	},
	{
		command_id: 'cmd_rotation_log',
		name: 'Rotation log retained',
		summary: 'A rotation log exists in the audit share, dated within the last 90 days.',
		// Nothing executes. There is still a question, an answer, a cadence and a
		// history — which is exactly why this belongs in the same object.
		body: {
			kind: 'assertion',
			assert: 'file_recent',
			params: { path: 'audit/rotation/*.log', within_days: 90 }
		},
		body_hash: 'sha256:2de901',
		origin: {
			provenance: 'authored',
			doc_id: null,
			section_id: null,
			path: null,
			sha: null,
			source_state: 'tracking',
			at: '2026-07-09',
			by: 'd.danes'
		},
		approval: {
			approved_hash: 'sha256:2de901',
			approved_at: '2026-07-09',
			approved_by: 'd.danes',
			runner: 'armornet',
			runner_kind: 'agent',
			on_failure: 'continue'
		},
		runs: [
			{
				run_id: 'run_01H9F9',
				at: '1 day ago',
				age_days: 1,
				outcome: 'pass',
				detail: 'audit/rotation/2026-08-12.log — 12 days old',
				duration_ms: 140,
				triggered_by: 'scheduled',
				ran_at_sha: '',
				emitted_evidence_id: null
			}
		]
	}
];

// ── Bindings ──────────────────────────────────────────────────────────────
// Ours, not the repo's. Written to the store immediately, projected out into
// document frontmatter on the next commit — `projected: false` is a binding the
// store knows about and the repo does not yet.

export const bindings: CommandBinding[] = [
	{
		binding_id: 'bind_01',
		section_id: 'sec_01H8XP',
		command_id: 'cmd_rotate',
		trigger: { mode: 'manual' },
		bound_at: '2026-07-02',
		bound_by: 'd.danes',
		projected: true
	},
	{
		binding_id: 'bind_02',
		section_id: 'sec_01H8XM',
		command_id: 'cmd_shared',
		trigger: { mode: 'scheduled', every_days: 30, next_at: 'in 28 days' },
		bound_at: '2026-06-18',
		bound_by: 'k.ito',
		projected: true
	},
	{
		binding_id: 'bind_03',
		section_id: 'sec_01H8XR',
		command_id: 'cmd_review',
		trigger: { mode: 'scheduled', every_days: 90, next_at: 'overdue' },
		bound_at: '2026-05-19',
		bound_by: 'k.ito',
		projected: true
	},
	{
		binding_id: 'bind_04',
		section_id: 'sec_01H8XP',
		command_id: 'cmd_rotation_log',
		trigger: { mode: 'scheduled', every_days: 30, next_at: 'in 6 days' },
		bound_at: 'just now',
		bound_by: 'you',
		// Bound in this session. The store has it; the repo does not yet.
		projected: false
	}
];

// ── SOP-014, the procedure ────────────────────────────────────────────────
// This is where the commands physically live. A procedure document renders its
// code inline — that is the whole point of it — and each block shows whether it
// has been promoted into the catalog. Note what is NOT here: no Run button.
// Running belongs to a binding, because only a binding knows which clause the
// result is proving and therefore what cadence to judge it against.

export const sop014: DocMeta = {
	id: 'doc_rk',
	doc_id: 'SOP-014',
	path: 'docs/corporate/procedures/rotate-production-keys.md',
	title: 'Rotate Production Keys',
	version: '1.4',
	status: 'approved',
	kind: 'procedure',
	owner: 'Platform',
	approved_by: 'k.ito',
	classification: 'internal',
	created: '2026-03-02',
	updated: '2026-08-11',
	review_cycle: 'annual',
	next_review: '2027-03-02',
	days_to_review: 190,
	tags: ['runbook', 'credentials', 'production'],
	authors: [
		{ handle: 'k.ito', commits: 21 },
		{ handle: 'd.danes', commits: 3 }
	]
};

export const sop014_sections: DocSection[] = [
	{
		section_id: 'sec_sop14_00',
		heading: '1. Purpose',
		level: 2,
		anchor_state: 'anchored',
		body_html:
			'<p>Rotate every production service credential on a 90-day cycle, and produce the log that POL-002 §6.2 cites as evidence.</p>',
		body_md:
			'Rotate every production service credential on a 90-day cycle, and produce the log that POL-002 §6.2 cites as evidence.',
		control_ids: [],
		evidence_ids: [],
		blocks: [],
		binding_ids: [],
		step_no: null,
		drift: null
	},
	{
		section_id: 'sec_sop14_01',
		heading: 'Step 1: Audit for shared accounts',
		level: 3,
		anchor_state: 'anchored',
		body_html:
			'<p>Nothing rotates until every production credential is held by an individual. Expected result: zero shared accounts.</p>',
		body_md:
			'Nothing rotates until every production credential is held by an individual. Expected result: zero shared accounts.',
		control_ids: [],
		evidence_ids: [],
		blocks: [
			{
				block_id: 'blk_sop14_01',
				lang: 'bash',
				code: 'armornet access audit --scope=production --shared-accounts',
				content_hash: 'sha256:4f1c8e',
				command_id: 'cmd_shared'
			}
		],
		binding_ids: [],
		step_no: 1,
		drift: null
	},
	{
		section_id: 'sec_sop14_03',
		heading: 'Step 2: Rotate the keys',
		level: 3,
		anchor_state: 'anchored',
		body_html:
			'<p>Issues replacements, swaps them in, and revokes the superseded set. Writes <code>audit/rotation/&lt;date&gt;.log</code>.</p>',
		body_md:
			'Issues replacements, swaps them in, and revokes the superseded set. Writes `audit/rotation/<date>.log`.',
		control_ids: [],
		evidence_ids: [],
		blocks: [
			{
				block_id: 'blk_sop14_03',
				lang: 'bash',
				code: 'armornet keys rotate --scope=production --confirm',
				content_hash: 'sha256:9ab3d0',
				command_id: 'cmd_rotate'
			}
		],
		binding_ids: [],
		step_no: 2,
		drift: null
	},
	{
		section_id: 'sec_sop14_04',
		heading: 'Step 3: Verify',
		level: 3,
		anchor_state: 'anchored',
		body_html:
			'<p>A block nobody has promoted. It is ordinary markdown until a human puts it in the catalog — which is the default, and the safe one.</p>',
		body_md:
			'A block nobody has promoted. It is ordinary markdown until a human puts it in the catalog — which is the default, and the safe one.',
		control_ids: [],
		evidence_ids: [],
		blocks: [
			{
				block_id: 'blk_sop14_04',
				lang: 'bash',
				code: 'armornet keys verify --scope=production --since=1h',
				content_hash: 'sha256:88de41',
				command_id: null
			}
		],
		binding_ids: [],
		step_no: 3,
		drift: null
	}
];

// ── RUN-004, a plain ops doc ──────────────────────────────────────────────
// Not written to a compliance template at all — just a runbook someone wrote to
// stop a recurring outage. It still contains a command worth promoting, which
// is the argument for discovery: the useful commands are already written down,
// in documents nobody thought of as compliance artifacts.

export const run004: DocMeta = {
	id: 'doc_gh',
	doc_id: 'RUN-004',
	path: 'docs/runbooks/github-credential-rotation.md',
	title: 'GitHub Credential Rotation',
	version: '1.0',
	status: 'approved',
	kind: 'note',
	owner: 'Platform',
	approved_by: '',
	classification: 'internal',
	created: '2026-07-16',
	updated: '2026-08-02',
	review_cycle: 'annual',
	next_review: '2027-07-16',
	days_to_review: 326,
	tags: ['runbook', 'github', 'argocd'],
	authors: [{ handle: 't.ramos', commits: 5 }]
};

export const run004_sections: DocSection[] = [
	{
		section_id: 'sec_run4_00',
		heading: 'Rotating the ArgoCD repo secret',
		level: 2,
		anchor_state: 'anchored',
		body_html:
			'<p>ArgoCD uses this secret to pull manifests from the private repo. If the PAT expires, every app goes <code>Unknown</code> and nothing deploys.</p>',
		body_md:
			'ArgoCD uses this secret to pull manifests from the private repo. If the PAT expires, every app goes `Unknown` and nothing deploys.',
		control_ids: [],
		evidence_ids: [],
		blocks: [
			{
				block_id: 'blk_run4_01',
				lang: 'bash',
				code: 'make cluster-repo-secret GITHUB_PAT=<token>',
				content_hash: 'sha256:1f77aa',
				command_id: null
			}
		],
		binding_ids: [],
		step_no: null,
		drift: null
	},
	{
		section_id: 'sec_run4_01',
		heading: 'Verifying it works',
		level: 2,
		anchor_state: 'anchored',
		body_html:
			'<p>All apps should move from <code>Unknown</code> to <code>Synced</code> within about thirty seconds.</p>',
		body_md: 'All apps should move from `Unknown` to `Synced` within about thirty seconds.',
		control_ids: [],
		evidence_ids: [],
		blocks: [
			{
				block_id: 'blk_run4_02',
				lang: 'bash',
				code: 'kubectl get applications -n argocd',
				content_hash: 'sha256:6b0c92',
				command_id: null
			}
		],
		binding_ids: [],
		step_no: null,
		drift: null
	}
];

/** Every document the corpus holds, addressed by the tree's node id. */
export const documents: Record<string, { meta: DocMeta; sections: DocSection[] }> = {
	doc_ac: { meta: doc, sections },
	doc_rk: { meta: sop014, sections: sop014_sections },
	doc_gh: { meta: run004, sections: run004_sections }
};

export const approvers: Approver[] = [
	{ id: 'usr_dd', name: 'Dana Danes', role: 'Compliance Lead', approved_at: '1 day ago' },
	{ id: 'usr_tr', name: 'Tomas Ramos', role: 'Security', approved_at: null },
	{ id: 'usr_ki', name: 'Kenji Ito', role: 'Eng Manager', approved_at: null }
];

export const comments: Comment[] = [
	{
		id: 'cm_01',
		section_id: 'sec_01H8XP',
		author: 't.ramos',
		body: 'Body says 90 days but the attestation only covers Q2. Re-run the block before I sign.',
		at: '4 hours ago'
	},
	{
		id: 'cm_02',
		section_id: 'sec_01H8XM',
		author: 'd.danes',
		body: 'Session-lifetime capture is 160 days old — past the CC6.1 cadence.',
		at: '2 days ago'
	}
];

/**
 * A runbook: the ordered, registered steps of a procedure document, executed
 * unattended. Every step must be registered and gated `auto` — a manual gate is
 * exactly the thing that stops a runbook being automatic.
 */
/**
 * A runbook: the ordered steps of a procedure document, each one a Command in
 * the catalog. The runtime is always a stepper — "run the whole thing" is every
 * step gated `auto`, and a manual gate is precisely what stops it.
 *
 * A step references a `command_id`, not a block. The block is where the command
 * was *found*; the Command is what actually runs.
 */
export interface Runbook {
	doc_id: string;
	title: string;
	steps: { step_no: number; heading: string; command_id: string; gate: 'manual' | 'auto' }[];
	last_run_at: string | null;
	last_result: 'passed' | 'failed' | 'partial' | null;
	schedule: string | null;
}

export const runbooks: Runbook[] = [
	{
		doc_id: 'SOP-014',
		title: 'Rotate Production Keys',
		steps: [
			{ step_no: 1, heading: 'Audit for shared accounts', command_id: 'cmd_shared', gate: 'auto' },
			{ step_no: 2, heading: 'Rotate production keys', command_id: 'cmd_rotate', gate: 'auto' },
			{ step_no: 3, heading: 'Confirm rotation log', command_id: 'cmd_rotation_log', gate: 'auto' },
			{ step_no: 4, heading: 'Revoke superseded keys', command_id: 'cmd_review', gate: 'manual' }
		],
		last_run_at: '6 days ago',
		last_result: 'passed',
		schedule: 'every 90 days'
	}
];

/** The file as it exists in the repo, reassembled for SOURCE mode. */
export const source_md = [
	'---',
	`id: "${doc.doc_id}"`,
	`title: "${doc.title}"`,
	`version: "${doc.version}"`,
	`status: ${doc.status}`,
	`owner: ${doc.owner}`,
	`approved_by: "${doc.approved_by}"`,
	`classification: ${doc.classification}`,
	`created: "${doc.created}"`,
	`updated: "${doc.updated}"`,
	`review_cycle: ${doc.review_cycle}`,
	`next_review: "${doc.next_review}"`,
	`tags: [${doc.tags.join(', ')}]`,
	'---',
	'',
	...sections.flatMap((s) => {
		const out = [`${'#'.repeat(s.level)} ${s.heading}`, '', s.body_md, ''];
		// Bindings are OURS, so source view shows them as the frontmatter
		// projection they become on commit — not as fenced blocks.
		if (s.binding_ids.length > 0) {
			out.push(`<!-- armornet:checks ${s.binding_ids.join(' ')} -->`, '');
		}
		for (const b of s.blocks) {
			const meta = b.command_id ? ` armornet:command=${b.command_id}` : '';
			out.push('```' + b.lang + meta, b.code, '```', '');
		}
		return out;
	})
].join('\n');
