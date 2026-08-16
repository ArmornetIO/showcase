<script lang="ts">
	// ── Mockup: Risk register ─────────────────────────────────────────────────
	//
	// SCORING — NIST SP 800-30 Rev 1, not likelihood × impact. Two separate
	// likelihood judgements combine before impact is ever considered:
	//
	//   initiation ─┐
	//               ├─(Table G-5)→ overall likelihood ─┐
	//   success ────┘                                  ├─(Table I-2)→ inherent
	//                                        impact ───┘                  │
	//   preventive controls → reduce likelihood ─┐                        │
	//   recovery controls   → reduce impact ─────┴─(Table I-2 again)→ residual
	//
	// Every arrow is a lookup, never arithmetic — an ordinal scale has no
	// meaningful product, which is why NIST uses matrices. The control tables are
	// org policy, not NIST: 800-30 defines inherent risk and stops.
	//
	// TREATMENT vs STATUS — these are not independent, and modelling them as two
	// free dropdowns is what makes registers rot. Treatment is the DECISION;
	// status is the position on the track that decision opens. "Mitigating" is
	// meaningless once you've decided to accept. So:
	//   treatment = null → identified / assessing   (no decision yet)
	//   mitigate         → planned / in progress / mitigated / closed
	//   accept           → pending approval / accepted / expired / closed
	//   transfer         → planned / in progress / transferred / closed
	//   avoid            → planned / in progress / avoided / closed
	// Picking a treatment re-bases status onto that track.
	//
	// APPETITE gates acceptance. Accepting a risk whose residual sits above the
	// org's appetite is an EXCEPTION: it cannot go straight to `accepted`, it
	// parks at `pending approval` until the approver signs off, and the sign-off
	// expires. Above tolerance it cannot be accepted at all. This is the join
	// between treatment, status, and the appetite policy.
	//
	// INTEGRATIONS — both paradigms, each doing the job it's shaped for:
	//   · Trackers (Linear/Jira/Trello) follow the PROXY REGISTRY paradigm — a
	//     credential-backed connection (API key + base URL + verified_at). This
	//     page never asks for credentials; it picks the SPOT inside a connection.
	//   · Reminders follow the ALERT CHANNEL paradigm — slack/webhook fan-out on
	//     a cadence. Nudges are events, not tickets.
	//
	// API stubs:
	//   GET  /api/orgs/:id/risks                            → Risk[]
	//   POST /api/orgs/:id/risks { ...RiskInput }           → Risk
	//   PATCH/DELETE /api/orgs/:id/risks/:rid
	//   POST /api/orgs/:id/risks/:rid/review                → { last_reviewed_at }
	//   POST /api/orgs/:id/risks/:rid/exception             → { approved_by, expires_at }
	//   GET/PUT /api/orgs/:id/risks/appetite                → Appetite
	//   GET/PUT /api/orgs/:id/risks/routing                 → RoutingRule[]
	//   GET  /api/orgs/:id/integrations/trackers            → TrackerConnection[]
	//   GET  /api/orgs/:id/integrations/trackers/:cid/spots → Spot[]
	//   GET  /api/orgs/:id/integrations/alert-channels      → AlertChannel[]

	import DataTable from '$lib/display/table/DataTable.svelte';
	import Avatar from '$lib/display/Avatar.svelte';
	import ActionsMenu from '$lib/primitives/ActionsMenu.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import IconButton from '$lib/primitives/IconButton.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import Textarea from '$lib/primitives/Textarea.svelte';
	import Select from '$lib/primitives/Select.svelte';
	import SearchInput from '$lib/primitives/SearchInput.svelte';
	import StatusDot from '$lib/primitives/StatusDot.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import Tabs from '$lib/layout/Tabs.svelte';
	import Modal from '$lib/layout/Modal.svelte';
	import LayoutHeader from '$lib/layout/LayoutHeader.svelte';
	import SteppedProgress from '$lib/display/progress/SteppedProgress.svelte';
	import type { ProgressVariant } from '$lib/display/progress/ProgressBar.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';
	import type { StatusLevel } from '$lib/primitives/StatusDot.svelte';
	import type { Tab } from '$lib/layout/Tabs.svelte';
	import type { ActionMenuItem } from '$lib/primitives/ActionsMenu.svelte';
	import type { TableColumn } from '$lib/display/table/DataTable.svelte';

	// Fixed "now" so the mockup renders deterministically.
	const TODAY = '2026-07-15';
	const DAY = 86400000;
	const parseDay = (s: string) => new Date(s + 'T00:00:00Z').getTime();
	const addDays = (s: string, d: number) => new Date(parseDay(s) + d * DAY).toISOString().slice(0, 10);
	const daysBetween = (a: string, b: string) => Math.round((parseDay(b) - parseDay(a)) / DAY);

	// ── Scoring model (NIST SP 800-30 Rev 1) ──────────────────────────────────

	type Level = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';

	const LEVELS: Level[] = ['very_low', 'low', 'moderate', 'high', 'very_high'];
	const LEVEL_ABBR: Record<Level, string> = { very_low: 'VL', low: 'L', moderate: 'M', high: 'H', very_high: 'VH' };
	const LEVEL_LABEL: Record<Level, string> = {
		very_low: 'Very low',
		low: 'Low',
		moderate: 'Moderate',
		high: 'High',
		very_high: 'Very high'
	};
	const LEVEL_SCORE: Record<Level, number> = { very_low: 0, low: 2, moderate: 5, high: 8, very_high: 10 };
	const LEVEL_HUE: Record<Level, string> = {
		very_low: '148 163 184',
		low: '52 211 153',
		moderate: '251 191 36',
		high: '251 146 60',
		very_high: '248 113 113'
	};
	const idx = (l: Level) => LEVELS.indexOf(l);

	// Table G-5 — overall likelihood. Row = initiation, column = success.
	// Verified against NIST's worked example: moderate × very_high → high.
	const TABLE_G5: Record<Level, Record<Level, Level>> = {
		very_high: { very_low: 'low', low: 'moderate', moderate: 'high', high: 'very_high', very_high: 'very_high' },
		high: { very_low: 'low', low: 'moderate', moderate: 'moderate', high: 'high', very_high: 'very_high' },
		moderate: { very_low: 'low', low: 'low', moderate: 'moderate', high: 'moderate', very_high: 'high' },
		low: { very_low: 'very_low', low: 'low', moderate: 'low', high: 'moderate', very_high: 'moderate' },
		very_low: { very_low: 'very_low', low: 'very_low', moderate: 'low', high: 'low', very_high: 'low' }
	};

	// Table I-2 — level of risk. Row = overall likelihood, column = impact.
	const TABLE_I2: Record<Level, Record<Level, Level>> = {
		very_high: { very_low: 'very_low', low: 'low', moderate: 'moderate', high: 'high', very_high: 'very_high' },
		high: { very_low: 'very_low', low: 'low', moderate: 'moderate', high: 'high', very_high: 'very_high' },
		moderate: { very_low: 'very_low', low: 'low', moderate: 'moderate', high: 'moderate', very_high: 'high' },
		low: { very_low: 'very_low', low: 'low', moderate: 'low', high: 'low', very_high: 'moderate' },
		very_low: { very_low: 'very_low', low: 'very_low', moderate: 'very_low', high: 'low', very_high: 'low' }
	};

	// ORG POLICY (not NIST) — ordinal steps a control tier buys. Capped at 2 so
	// no control set is credited with erasing a very-high exposure outright.
	const CONTROL_REDUCTION: Record<Level, number> = { very_low: 0, low: 0, moderate: 1, high: 2, very_high: 2 };
	const reduce = (l: Level, by: Level): Level => LEVELS[Math.max(0, idx(l) - CONTROL_REDUCTION[by])];

	type Scoring = {
		likelihood_initiation: Level;
		likelihood_success: Level;
		impact: Level;
		preventive_effectiveness: Level;
		recovery_effectiveness: Level;
	};

	type Assessed = {
		overall_likelihood: Level;
		inherent: Level;
		residual_likelihood: Level;
		residual_impact: Level;
		residual: Level;
	};

	function assess(s: Scoring): Assessed {
		const overall_likelihood = TABLE_G5[s.likelihood_initiation][s.likelihood_success];
		const inherent = TABLE_I2[overall_likelihood][s.impact];
		const residual_likelihood = reduce(overall_likelihood, s.preventive_effectiveness);
		const residual_impact = reduce(s.impact, s.recovery_effectiveness);
		return {
			overall_likelihood,
			inherent,
			residual_likelihood,
			residual_impact,
			residual: TABLE_I2[residual_likelihood][residual_impact]
		};
	}

	// ── Domain types ──────────────────────────────────────────────────────────

	type AssetCategory =
		| 'endpoint'
		| 'user'
		| 'application'
		| 'data_store'
		| 'network'
		| 'cloud_account'
		| 'vendor'
		| 'agent';

	type CIA = 'confidentiality' | 'integrity' | 'availability';
	type Treatment = 'mitigate' | 'accept' | 'transfer' | 'avoid';

	// Blast radius is DECLARED, not described. Three structured axes replace the
	// old "what is exposed, how could it be exploited, how bad" prose box —
	// those were three subjective essay prompts that produced unqueryable text.
	//   asset_categories → what KIND of thing is exposed
	//   data_classes     → what is ON it            (mirrors vendor-edit's set)
	//   scope            → how MUCH of the estate
	// Together they suggest an impact level instead of leaving it to vibes.
	type DataClass = 'none' | 'internal' | 'confidential' | 'pii' | 'pci' | 'phi';
	type Scope = 'single' | 'segment' | 'estate';
	type Status =
		| 'identified'
		| 'assessing'
		| 'planned'
		| 'in_progress'
		| 'mitigated'
		| 'pending_approval'
		| 'accepted'
		| 'expired'
		| 'transferred'
		| 'avoided'
		| 'closed';

	type TrackerKind = 'linear' | 'jira' | 'trello';
	type ConnectionStatus = 'pending' | 'healthy' | 'degraded' | 'offline';
	type AlertKind = 'slack' | 'webhook';
	type Cadence = 'daily' | 'weekly' | 'biweekly' | 'monthly';
	type ReminderTrigger = 'until_closed' | 'review_overdue';

	type TrackerConnection = {
		id: string;
		org_id: string;
		kind: TrackerKind;
		label: string;
		base_url: string;
		status: ConnectionStatus;
		last_error?: string;
		verified_at?: string;
	};
	type Spot = { id: string; connection_id: string; name: string; key: string };
	type AlertChannel = { id: string; kind: AlertKind; label: string; target: string; status: ConnectionStatus };

	type Reminder = { channel_id: string; cadence: Cadence; trigger: ReminderTrigger };

	type RoutingRule = {
		id: string;
		residual: Level[] | null;
		asset_category: AssetCategory[] | null;
		connection_id: string;
		spot_id: string;
	};

	type IssueRef = { connection_id: string; key: string; url: string; state: string };

	// Appetite is global policy — the one object that makes acceptance decidable.
	type Appetite = {
		global_max_residual: Level; // appetite: accept freely at or below this
		tolerance_max_residual: Level; // hard ceiling: never acceptable above this
		overrides: { asset_category: AssetCategory; max_residual: Level }[];
		review_cadence_days: Record<Level, number>;
		acceptance_expiry_days: number;
		approver_role: string;
	};

	type Risk = Scoring & {
		id: string;
		title: string;
		// Optional prose for what the structured fields genuinely can't hold
		// (evidence links, caveats). Never load-bearing.
		notes: string;
		asset_categories: AssetCategory[]; // multi — a risk rarely touches one thing
		data_classes: DataClass[];
		scope: Scope;
		cia_impact: CIA[];
		owner_id: string;
		treatment: Treatment | null; // null = no decision yet
		status: Status;
		created_at: string;
		last_reviewed_at: string;
		accepted_until?: string; // set when an over-appetite acceptance is approved
		reminder: Reminder | null;
		route_override: { connection_id: string; spot_id: string } | null;
		issue_ref: IssueRef | null;
	};

	type Owner = { id: string; name: string; role: string; avatar_initials: string };

	// ── Treatment → status track ──────────────────────────────────────────────

	const STATUS_META: Record<Status, { label: string; hue: string }> = {
		identified: { label: 'Identified', hue: '148 163 184' },
		assessing: { label: 'Assessing', hue: '148 163 184' },
		planned: { label: 'Planned', hue: '56 189 248' },
		in_progress: { label: 'In progress', hue: '251 191 36' },
		mitigated: { label: 'Mitigated', hue: '52 211 153' },
		pending_approval: { label: 'Pending approval', hue: '251 146 60' },
		accepted: { label: 'Accepted', hue: '56 189 248' },
		expired: { label: 'Acceptance expired', hue: '248 113 113' },
		transferred: { label: 'Transferred', hue: '52 211 153' },
		avoided: { label: 'Avoided', hue: '52 211 153' },
		closed: { label: 'Closed', hue: '52 211 153' }
	};

	// The interconnection, made explicit: which statuses a treatment even allows.
	const STATUS_TRACK: Record<'none' | Treatment, Status[]> = {
		none: ['identified', 'assessing'],
		mitigate: ['planned', 'in_progress', 'mitigated', 'closed'],
		accept: ['pending_approval', 'accepted', 'expired', 'closed'],
		transfer: ['planned', 'in_progress', 'transferred', 'closed'],
		avoid: ['planned', 'in_progress', 'avoided', 'closed']
	};
	const trackFor = (t: Treatment | null) => STATUS_TRACK[t ?? 'none'];

	// Work is done — stops reminders and drops the risk out of "live".
	const TERMINAL: Status[] = ['mitigated', 'transferred', 'avoided', 'closed'];

	const TREATMENTS: { value: Treatment; label: string; icon: IconName; blurb: string }[] = [
		{ value: 'mitigate', label: 'Mitigate', icon: 'shield-check', blurb: 'Reduce it' },
		{ value: 'accept', label: 'Accept', icon: 'check-circle', blurb: 'Live with it' },
		{ value: 'transfer', label: 'Transfer', icon: 'git-fork', blurb: 'Insure / contract' },
		{ value: 'avoid', label: 'Avoid', icon: 'x-circle', blurb: 'Stop doing it' }
	];

	// ── Seed: integrations ────────────────────────────────────────────────────

	const CONNECTIONS: TrackerConnection[] = [
		{ id: 'c_lin', org_id: 'o1', kind: 'linear', label: 'Linear · Acme', base_url: 'https://api.linear.app', status: 'healthy', verified_at: '2026-07-14' },
		{ id: 'c_jira', org_id: 'o1', kind: 'jira', label: 'Jira · acme.atlassian.net', base_url: 'https://acme.atlassian.net', status: 'healthy', verified_at: '2026-07-13' },
		{ id: 'c_trello', org_id: 'o1', kind: 'trello', label: 'Trello · Compliance', base_url: 'https://api.trello.com', status: 'degraded', last_error: 'API key rate-limited (429) — retrying', verified_at: '2026-07-02' }
	];
	const SPOTS: Spot[] = [
		{ id: 's_lin_sec', connection_id: 'c_lin', name: 'Security', key: 'SEC' },
		{ id: 's_lin_plat', connection_id: 'c_lin', name: 'Platform', key: 'PLAT' },
		{ id: 's_jira_arm', connection_id: 'c_jira', name: 'Armornet', key: 'ARM' },
		{ id: 's_jira_grc', connection_id: 'c_jira', name: 'Governance', key: 'GRC' },
		{ id: 's_trello_vnd', connection_id: 'c_trello', name: 'Vendor Reviews', key: 'VND' }
	];
	const ALERT_CHANNELS: AlertChannel[] = [
		{ id: 'ch_risk', kind: 'slack', label: '#risk-nudges', target: 'Slack · Acme', status: 'healthy' },
		{ id: 'ch_sec', kind: 'slack', label: '#sec-critical', target: 'Slack · Acme', status: 'healthy' },
		{ id: 'ch_hook', kind: 'webhook', label: 'PagerDuty bridge', target: 'https://events.pagerduty.com/…', status: 'healthy' }
	];

	const TRACKER_META: Record<TrackerKind, { name: string; icon: IconName; spotNoun: string }> = {
		linear: { name: 'Linear', icon: 'git-branch', spotNoun: 'team' },
		jira: { name: 'Jira', icon: 'layers', spotNoun: 'project' },
		trello: { name: 'Trello', icon: 'layout-grid', spotNoun: 'board' }
	};
	const ALERT_ICON: Record<AlertKind, IconName> = { slack: 'message-square', webhook: 'link' };
	const CADENCES: { value: Cadence; label: string; days: number }[] = [
		{ value: 'daily', label: 'Daily', days: 1 },
		{ value: 'weekly', label: 'Weekly', days: 7 },
		{ value: 'biweekly', label: 'Biweekly', days: 14 },
		{ value: 'monthly', label: 'Monthly', days: 30 }
	];
	const TRIGGERS: { value: ReminderTrigger; label: string; blurb: string }[] = [
		{ value: 'until_closed', label: 'Until work is done', blurb: 'Nudge while the risk is still open' },
		{ value: 'review_overdue', label: 'Only when review is overdue', blurb: 'Quiet until the review date slips' }
	];

	// ── Seed: appetite ────────────────────────────────────────────────────────

	let appetite = $state<Appetite>({
		global_max_residual: 'moderate',
		tolerance_max_residual: 'high',
		overrides: [
			{ asset_category: 'data_store', max_residual: 'low' },
			{ asset_category: 'user', max_residual: 'low' }
		],
		review_cadence_days: { very_low: 365, low: 180, moderate: 90, high: 30, very_high: 14 },
		acceptance_expiry_days: 180,
		approver_role: 'Security Lead'
	});

	let rules = $state<RoutingRule[]>([
		{ id: 'r1', residual: ['very_high', 'high'], asset_category: null, connection_id: 'c_lin', spot_id: 's_lin_sec' },
		{ id: 'r2', residual: null, asset_category: ['vendor'], connection_id: 'c_trello', spot_id: 's_trello_vnd' },
		{ id: 'r3', residual: ['moderate'], asset_category: ['data_store', 'cloud_account'], connection_id: 'c_jira', spot_id: 's_jira_arm' },
		{ id: 'r_default', residual: null, asset_category: null, connection_id: 'c_jira', spot_id: 's_jira_grc' }
	]);

	const OWNERS: Owner[] = [
		{ id: 'u1', name: 'Dana Reyes', role: 'Security Lead', avatar_initials: 'DR' },
		{ id: 'u2', name: 'Jordan Kim', role: 'Platform Eng', avatar_initials: 'JK' },
		{ id: 'u3', name: 'Alex Pruitt', role: 'IT Ops', avatar_initials: 'AP' },
		{ id: 'u4', name: 'Sam Okafor', role: 'Compliance', avatar_initials: 'SO' }
	];

	let risks = $state<Risk[]>([
		{
			id: 'RSK-001',
			title: 'Unmanaged endpoints bypass DNS filtering',
			notes: 'Agent rollout at 78% — remainder are contractor BYOD.',
			asset_categories: ['endpoint', 'network'],
			data_classes: ['internal', 'confidential'],
			scope: 'segment',
			cia_impact: ['confidentiality', 'integrity'],
			owner_id: 'u3',
			likelihood_initiation: 'very_high',
			likelihood_success: 'high',
			impact: 'high',
			preventive_effectiveness: 'moderate',
			recovery_effectiveness: 'moderate',
			treatment: 'mitigate',
			status: 'in_progress',
			created_at: '2026-04-02',
			last_reviewed_at: '2026-07-09',
			reminder: { channel_id: 'ch_risk', cadence: 'weekly', trigger: 'until_closed' },
			route_override: null,
			issue_ref: { connection_id: 'c_lin', key: 'SEC-214', url: '#', state: 'In Progress' }
		},
		{
			id: 'RSK-002',
			title: 'Stale PATs with org-wide scope',
			notes: 'No rotation policy exists yet. Oldest live token minted 2024-08.',
			asset_categories: ['user', 'application'],
			data_classes: ['confidential', 'pii'],
			scope: 'estate',
			cia_impact: ['confidentiality'],
			owner_id: 'u1',
			likelihood_initiation: 'high',
			likelihood_success: 'very_high',
			impact: 'very_high',
			preventive_effectiveness: 'low',
			recovery_effectiveness: 'low',
			treatment: 'mitigate',
			status: 'planned',
			created_at: '2026-05-18',
			last_reviewed_at: '2026-05-18', // never re-reviewed → overdue at VH cadence
			reminder: { channel_id: 'ch_sec', cadence: 'daily', trigger: 'until_closed' },
			route_override: null,
			issue_ref: { connection_id: 'c_lin', key: 'SEC-221', url: '#', state: 'Todo' }
		},
		{
			id: 'RSK-003',
			title: 'Postgres backups unencrypted at rest',
			notes: 'Nightly dumps land in object storage with no envelope encryption or lifecycle rules.',
			asset_categories: ['data_store', 'cloud_account'],
			// Whole customer dataset in one artefact — PHI drives impact to VH.
			data_classes: ['pii', 'phi'],
			scope: 'estate',
			cia_impact: ['confidentiality', 'availability'],
			owner_id: 'u2',
			likelihood_initiation: 'low',
			likelihood_success: 'very_high',
			impact: 'very_high',
			preventive_effectiveness: 'moderate',
			recovery_effectiveness: 'low',
			treatment: null, // no decision yet
			status: 'assessing',
			created_at: '2026-07-11',
			last_reviewed_at: '2026-07-14',
			reminder: null,
			route_override: null,
			issue_ref: { connection_id: 'c_jira', key: 'ARM-88', url: '#', state: 'To Do' }
		},
		{
			id: 'RSK-004',
			title: 'Single-region control plane',
			notes: 'Multi-region is on the FY27 roadmap; runbook failover is 40 min.',
			asset_categories: ['cloud_account', 'agent'],
			// Pure availability — no data is disclosed by an outage.
			data_classes: ['none'],
			scope: 'estate',
			cia_impact: ['availability'],
			owner_id: 'u2',
			likelihood_initiation: 'low',
			likelihood_success: 'very_high',
			impact: 'high',
			preventive_effectiveness: 'very_low',
			recovery_effectiveness: 'high',
			// Residual lands at or under appetite → accepted outright, no exception.
			treatment: 'accept',
			status: 'accepted',
			created_at: '2026-02-20',
			last_reviewed_at: '2026-06-30',
			reminder: null,
			route_override: null,
			issue_ref: null
		},
		{
			id: 'RSK-005',
			title: 'Vendor SOC 2 report expired',
			notes: 'Chasing since 2026-06-01. Contract has a 30-day cure clause.',
			asset_categories: ['vendor'],
			data_classes: ['confidential'],
			scope: 'segment',
			cia_impact: ['confidentiality'],
			owner_id: 'u4',
			likelihood_initiation: 'moderate',
			likelihood_success: 'moderate',
			impact: 'moderate',
			preventive_effectiveness: 'moderate',
			recovery_effectiveness: 'low',
			treatment: 'transfer',
			status: 'in_progress',
			created_at: '2026-06-01',
			last_reviewed_at: '2026-07-11',
			reminder: { channel_id: 'ch_risk', cadence: 'monthly', trigger: 'review_overdue' },
			route_override: null,
			issue_ref: { connection_id: 'c_trello', key: 'VND-12', url: '#', state: 'Chasing' }
		},
		{
			id: 'RSK-006',
			title: 'Agent auto-update pulls unpinned image',
			notes: 'Digest pinning shipped in 1.24 — this is why residual collapses.',
			asset_categories: ['agent', 'application'],
			data_classes: ['internal'],
			scope: 'estate',
			cia_impact: ['integrity', 'availability'],
			owner_id: 'u2',
			likelihood_initiation: 'very_low',
			likelihood_success: 'high',
			impact: 'very_high',
			preventive_effectiveness: 'very_high',
			recovery_effectiveness: 'high',
			treatment: 'mitigate',
			status: 'mitigated',
			created_at: '2026-01-14',
			last_reviewed_at: '2026-06-22',
			reminder: null,
			route_override: { connection_id: 'c_lin', spot_id: 's_lin_plat' },
			issue_ref: { connection_id: 'c_lin', key: 'PLAT-190', url: '#', state: 'Done' }
		},
		{
			id: 'RSK-007',
			title: 'Unicode homoglyphs in prompt paths',
			notes: 'Detector exists but is advisory-only; allowlist stays exact-match.',
			asset_categories: ['application', 'network'],
			data_classes: ['internal'],
			scope: 'segment',
			cia_impact: ['integrity'],
			owner_id: 'u1',
			likelihood_initiation: 'high',
			likelihood_success: 'high',
			impact: 'moderate',
			preventive_effectiveness: 'low',
			recovery_effectiveness: 'moderate',
			// Someone wants to accept this, but residual is over appetite →
			// parked at pending_approval until the Security Lead signs off.
			treatment: 'accept',
			status: 'pending_approval',
			created_at: '2026-06-27',
			last_reviewed_at: '2026-07-13',
			reminder: { channel_id: 'ch_risk', cadence: 'weekly', trigger: 'until_closed' },
			route_override: null,
			issue_ref: null
		}
	]);

	// ── Reference tables ──────────────────────────────────────────────────────

	const ASSETS: { value: AssetCategory; label: string; icon: IconName; blurb: string }[] = [
		{ value: 'endpoint', label: 'Endpoint', icon: 'monitor', blurb: 'Laptops, desktops' },
		{ value: 'user', label: 'User', icon: 'user', blurb: 'Identities, tokens' },
		{ value: 'application', label: 'Application', icon: 'code', blurb: 'Services, APIs' },
		{ value: 'data_store', label: 'Data store', icon: 'table', blurb: 'Databases, buckets' },
		{ value: 'network', label: 'Network', icon: 'network', blurb: 'Links, DNS, egress' },
		{ value: 'cloud_account', label: 'Cloud account', icon: 'globe', blurb: 'Regions, projects' },
		{ value: 'vendor', label: 'Vendor', icon: 'package', blurb: 'Third parties' },
		{ value: 'agent', label: 'Agent', icon: 'cpu', blurb: 'Mesh nodes' }
	];
	const ASSET_MAP = Object.fromEntries(ASSETS.map((a) => [a.value, a])) as Record<AssetCategory, (typeof ASSETS)[number]>;

	// Mirrors the DataClass set + org guidance in the vendor editor, so a class
	// means the same thing whether you meet it on a vendor or a risk.
	const DATA_CLASSES: {
		value: DataClass;
		label: string;
		tier: 'public' | 'internal' | 'confidential' | 'restricted';
		summary: string;
	}[] = [
		{ value: 'none', label: 'None', tier: 'public', summary: 'Public or non-business data with no confidentiality requirement.' },
		{ value: 'internal', label: 'Internal', tier: 'internal', summary: 'Internal-only business data not intended for public release.' },
		{ value: 'confidential', label: 'Confidential', tier: 'confidential', summary: 'Sensitive commercial data — contracts, pricing, roadmaps, financials.' },
		{ value: 'pii', label: 'PII', tier: 'restricted', summary: 'Personal data that identifies an individual (names, emails, IDs).' },
		{ value: 'pci', label: 'PCI', tier: 'restricted', summary: 'Cardholder data in scope for PCI-DSS.' },
		{ value: 'phi', label: 'PHI', tier: 'restricted', summary: 'Protected health information under HIPAA.' }
	];
	const DATA_MAP = Object.fromEntries(DATA_CLASSES.map((d) => [d.value, d])) as Record<DataClass, (typeof DATA_CLASSES)[number]>;
	const TIER_HUE: Record<(typeof DATA_CLASSES)[number]['tier'], string> = {
		public: '148 163 184',
		internal: '94 234 212',
		confidential: '56 189 248',
		restricted: '248 113 113'
	};

	const SCOPES: { value: Scope; label: string; icon: IconName; blurb: string }[] = [
		{ value: 'single', label: 'Single asset', icon: 'circle', blurb: 'One host, one account' },
		{ value: 'segment', label: 'Segment', icon: 'layers', blurb: 'A team, tier, or region' },
		{ value: 'estate', label: 'Estate-wide', icon: 'globe', blurb: 'Everything at once' }
	];

	// ORG POLICY — the floor a data class puts under impact, and how scope moves
	// it. Declaring "PHI, estate-wide" should not let anyone quietly file it as
	// Low impact; declaring "internal, single asset" shouldn't inflate to High.
	const DATA_IMPACT: Record<DataClass, Level> = {
		none: 'very_low',
		internal: 'low',
		confidential: 'moderate',
		pii: 'high',
		pci: 'high',
		phi: 'very_high'
	};
	const SCOPE_ADJ: Record<Scope, number> = { single: -1, segment: 0, estate: 1 };

	// Suggested, never forced — impact stays a judgement, but one anchored to
	// what was actually declared, with the reasoning shown.
	function suggestImpact(classes: DataClass[], scope: Scope): { level: Level; driver: DataClass } {
		const driver = classes.length
			? classes.reduce((a, b) => (idx(DATA_IMPACT[b]) > idx(DATA_IMPACT[a]) ? b : a))
			: 'none';
		return { level: LEVELS[Math.min(4, Math.max(0, idx(DATA_IMPACT[driver]) + SCOPE_ADJ[scope]))], driver };
	}

	const CIA_META: { value: CIA; label: string; letter: string; blurb: string }[] = [
		{ value: 'confidentiality', label: 'Confidentiality', letter: 'C', blurb: 'Disclosure' },
		{ value: 'integrity', label: 'Integrity', letter: 'I', blurb: 'Tampering' },
		{ value: 'availability', label: 'Availability', letter: 'A', blurb: 'Downtime' }
	];
	const CIA_ORDER: CIA[] = ['confidentiality', 'integrity', 'availability'];

	const SCALE_HELP = {
		initiation: 'How often is this even attempted? Adversarial: capability × intent × targeting. Non-adversarial: base rate.',
		success: 'Given it is attempted, how likely is adverse impact? Vulnerability severity + predisposing conditions.',
		impact: 'If it succeeds, how bad — before any control response.',
		preventive: 'Controls that stop it landing: pinning, MFA, segmentation. Reduces likelihood.',
		recovery: 'Controls that limit the damage: backups, failover, runbooks. Reduces impact.'
	};

	const ownerOf = (id: string) => OWNERS.find((o) => o.id === id) ?? OWNERS[0];
	const connOf = (id: string) => CONNECTIONS.find((c) => c.id === id);
	const spotOf = (id: string) => SPOTS.find((s) => s.id === id);
	const spotsFor = (cid: string) => SPOTS.filter((s) => s.connection_id === cid);
	const channelOf = (id: string) => ALERT_CHANNELS.find((c) => c.id === id);
	const statusLevel = (s: ConnectionStatus): StatusLevel =>
		s === 'healthy' || s === 'degraded' || s === 'offline' ? s : 'offline';

	// ── Appetite evaluation ───────────────────────────────────────────────────

	// A multi-asset risk answers to the STRICTEST appetite among its categories —
	// binding a risk to `data_store` can only tighten the bar, never loosen it.
	function appetiteFor(cats: AssetCategory[]): { level: Level; source: string } {
		let level = appetite.global_max_residual;
		let source = 'global';
		for (const c of cats) {
			const o = appetite.overrides.find((x) => x.asset_category === c);
			if (o && idx(o.max_residual) < idx(level)) {
				level = o.max_residual;
				source = ASSET_MAP[c].label;
			}
		}
		return { level, source };
	}

	type AppetiteVerdict = {
		limit: Level;
		source: string;
		overAppetite: boolean;
		overTolerance: boolean;
		needsException: boolean; // acceptance requires sign-off
		canAccept: boolean; // above tolerance → acceptance is off the table
	};

	function appetiteVerdict(cats: AssetCategory[], residual: Level): AppetiteVerdict {
		const { level, source } = appetiteFor(cats);
		const overAppetite = idx(residual) > idx(level);
		const overTolerance = idx(residual) > idx(appetite.tolerance_max_residual);
		return {
			limit: level,
			source,
			overAppetite,
			overTolerance,
			needsException: overAppetite && !overTolerance,
			canAccept: !overTolerance
		};
	}

	// ── Review dates ──────────────────────────────────────────────────────────

	// Cadence is driven by residual band — a very-high risk earns a 14-day
	// heartbeat, a very-low one an annual glance. Policy lives in Appetite.
	function reviewOf(r: Risk) {
		const residual = assess(r).residual;
		const due = addDays(r.last_reviewed_at, appetite.review_cadence_days[residual]);
		const slip = daysBetween(due, TODAY);
		return { due, overdue: slip > 0, slip, cadence: appetite.review_cadence_days[residual] };
	}

	function resolveRule(cats: AssetCategory[], residual: Level): RoutingRule {
		return (
			rules.find(
				(r) =>
					(r.residual === null || r.residual.includes(residual)) &&
					(r.asset_category === null || r.asset_category.some((a) => cats.includes(a)))
			) ?? rules[rules.length - 1]
		);
	}

	function routeOf(r: Risk): { connection_id: string; spot_id: string; rule: RoutingRule | null } {
		if (r.route_override) return { ...r.route_override, rule: null };
		const rule = resolveRule(r.asset_categories, assess(r).residual);
		return { connection_id: rule.connection_id, spot_id: rule.spot_id, rule };
	}

	// ── UI state ──────────────────────────────────────────────────────────────

	let activeTab = $state('register');
	let search = $state('');
	let assetFilter = $state('all');
	let statusFilter = $state('all');
	let toast = $state('');
	let showMatrix = $state(false);

	// Each step consumes what the previous one established: blast radius anchors
	// impact, the assessment produces residual, residual gates the decision, the
	// decision picks the destination.
	const STEPS = ['Define', 'Assess', 'Decide', 'Track', 'Review'];
	let step = $state(0);
	// Furthest step reached. Bars light up to here and stay lit, so the stepper
	// reads as progress — going Back doesn't un-light what you've already seen,
	// and on a NEW risk the steps you've never opened stay dark rather than
	// claiming a state you haven't given them yet.
	//
	// An existing risk is different: every step was already answered when it was
	// filed, so all of them are "reached" the moment you open it. openEdit seeds
	// this to the last step, which lights the whole bar green until you change
	// something.
	let furthest = $state(0);

	function goStep(i: number) {
		step = i;
		if (i > furthest) furthest = i;
	}

	let showEditor = $state(false);
	let editingId = $state<string | null>(null);
	// The saved record the form diffs against — null for a new risk.
	let baseline = $state<Risk | null>(null);
	let saving = $state(false);
	let formError = $state('');

	let fTitle = $state('');
	let fNotes = $state('');
	let fAssets = $state<AssetCategory[]>(['endpoint']);
	let fDataClasses = $state<DataClass[]>([]);
	let fScope = $state<Scope>('segment');
	let fCia = $state<CIA[]>([]);
	let fOwner = $state('u1');
	let fInitiation = $state<Level>('moderate');
	let fSuccess = $state<Level>('moderate');
	let fImpact = $state<Level>('moderate');
	let fPreventive = $state<Level>('low');
	let fRecovery = $state<Level>('low');
	let fTreatment = $state<Treatment | null>(null);
	let fStatus = $state<Status>('identified');
	let fCreated = $state(TODAY);
	let fReviewed = $state(TODAY);
	let fReminderOn = $state(false);
	let fChannel = $state('ch_risk');
	let fCadence = $state<Cadence>('weekly');
	let fTrigger = $state<ReminderTrigger>('until_closed');
	let fOverride = $state(false);
	let fConnection = $state('c_lin');
	let fSpot = $state('s_lin_sec');

	// ── Derived ───────────────────────────────────────────────────────────────

	const TABS: Tab[] = $derived([
		{ id: 'register', label: `Register (${risks.length})` },
		{ id: 'appetite', label: 'Appetite' },
		{ id: 'routing', label: `Routing (${rules.length})` }
	]);

	const filtered = $derived(
		risks.filter((r) => {
			const q = search.trim().toLowerCase();
			const matchesSearch =
				!q || r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q);
			return (
				matchesSearch &&
				(assetFilter === 'all' || r.asset_categories.includes(assetFilter as AssetCategory)) &&
				(statusFilter === 'all' || r.status === statusFilter)
			);
		})
	);
	const sorted = $derived(
		[...filtered].sort((a, b) => {
			const A = assess(a);
			const B = assess(b);
			return LEVEL_SCORE[B.residual] - LEVEL_SCORE[A.residual] || LEVEL_SCORE[B.inherent] - LEVEL_SCORE[A.inherent];
		})
	);

	const liveRisks = $derived(risks.filter((r) => !TERMINAL.includes(r.status)));
	const overAppetiteCount = $derived(
		liveRisks.filter((r) => appetiteVerdict(r.asset_categories, assess(r).residual).overAppetite).length
	);
	const overdueCount = $derived(liveRisks.filter((r) => reviewOf(r).overdue).length);
	const awaitingApproval = $derived(risks.filter((r) => r.status === 'pending_approval').length);

	const preview = $derived(
		assess({
			likelihood_initiation: fInitiation,
			likelihood_success: fSuccess,
			impact: fImpact,
			preventive_effectiveness: fPreventive,
			recovery_effectiveness: fRecovery
		})
	);
	const previewVerdict = $derived(appetiteVerdict(fAssets, preview.residual));
	const suggested = $derived(suggestImpact(fDataClasses, fScope));
	const impactMatchesSuggestion = $derived(fImpact === suggested.level);

	// Every blocker knows which step fixes it, so Review can jump you there.
	const blockers = $derived(
		[
			!fTitle.trim() ? { step: 0, msg: 'A risk statement is required.' } : null,
			fDataClasses.length === 0 ? { step: 0, msg: 'Declare what data is in the blast radius.' } : null,
			fCia.length === 0 ? { step: 0, msg: 'Select at least one CIA leg.' } : null,
			fTreatment === 'accept' && !previewVerdict.canAccept
				? { step: 2, msg: `Residual ${LEVEL_LABEL[preview.residual]} is above tolerance — it cannot be accepted.` }
				: null
		].filter(Boolean) as { step: number; msg: string }[]
	);

	const previewCadence = $derived(appetite.review_cadence_days[preview.residual]);
	const previewDue = $derived(addDays(fReviewed, previewCadence));
	const previewRule = $derived(resolveRule(fAssets, preview.residual));
	const effectiveConnection = $derived(fOverride ? fConnection : previewRule.connection_id);
	const effectiveSpot = $derived(fOverride ? fSpot : previewRule.spot_id);
	const allowedStatuses = $derived(trackFor(fTreatment));

	// ── Step state ────────────────────────────────────────────────────────────
	// red   → incomplete: something required is missing
	// amber → answered but not submitted (differs from the saved record)
	// green → saved and unchanged since
	// A new risk has no baseline, so nothing can be green until it's filed.
	const sameSet = (a: string[], b: string[]) =>
		a.length === b.length && [...a].sort().join() === [...b].sort().join();

	const stepComplete = $derived([
		!!fTitle.trim() && fDataClasses.length > 0 && fCia.length > 0,
		true, // every scale always holds a level — nothing can be absent
		fTreatment !== null, // "no decision yet" is honest, but it isn't finished
		true, // a route always resolves, by rule if not by override
		blockers.length === 0
	]);

	const stepDirty = $derived.by(() => {
		const b = baseline;
		if (!b) return [true, true, true, true, true];
		const d0 =
			fTitle !== b.title ||
			fNotes !== b.notes ||
			!sameSet(fAssets, b.asset_categories) ||
			!sameSet(fDataClasses, b.data_classes) ||
			fScope !== b.scope ||
			!sameSet(fCia, b.cia_impact);
		const d1 =
			fInitiation !== b.likelihood_initiation ||
			fSuccess !== b.likelihood_success ||
			fImpact !== b.impact ||
			fPreventive !== b.preventive_effectiveness ||
			fRecovery !== b.recovery_effectiveness;
		const d2 = fTreatment !== b.treatment || fStatus !== b.status || fOwner !== b.owner_id || fReviewed !== b.last_reviewed_at;
		const nextReminder = fReminderOn ? { channel_id: fChannel, cadence: fCadence, trigger: fTrigger } : null;
		const nextOverride = fOverride ? { connection_id: fConnection, spot_id: fSpot } : null;
		const d3 =
			JSON.stringify(nextReminder) !== JSON.stringify(b.reminder) ||
			JSON.stringify(nextOverride) !== JSON.stringify(b.route_override);
		return [d0, d1, d2, d3, d0 || d1 || d2 || d3];
	});

	const stepVariants = $derived(
		STEPS.map((_, i) => (!stepComplete[i] ? 'error' : stepDirty[i] ? 'warn' : 'success')) as ProgressVariant[]
	);

	const stepHint = $derived(
		step === 0
			? `${fAssets.length} asset${fAssets.length === 1 ? '' : 's'} · ${fDataClasses.length} data class${fDataClasses.length === 1 ? '' : 'es'} declared`
			: step === 1
				? `residual ${LEVEL_LABEL[preview.residual]} · inherent ${LEVEL_LABEL[preview.inherent]}`
				: step === 2
					? fTreatment
						? `${TREATMENTS.find((t) => t.value === fTreatment)!.label} · ${STATUS_META[fStatus].label}`
						: 'no treatment decided yet'
					: step === 3
						? `files to ${spotOf(effectiveSpot)?.name} · ${fReminderOn ? fCadence + ' nudges' : 'no nudges'}`
						: blockers.length
							? `${blockers.length} thing${blockers.length === 1 ? '' : 's'} to fix`
							: 'ready'
	);

	const connectionOptions = CONNECTIONS.map((c) => ({ value: c.id, label: c.label }));
	const spotOptions = $derived(spotsFor(fConnection).map((s) => ({ value: s.id, label: `${s.name} (${s.key})` })));
	const channelOptions = ALERT_CHANNELS.map((c) => ({ value: c.id, label: `${c.label} — ${c.target}` }));
	const ownerOptions = OWNERS.map((o) => ({ value: o.id, label: `${o.name} — ${o.role}` }));
	const assetFilterOptions = [{ value: 'all', label: 'All assets' }, ...ASSETS.map((a) => ({ value: a.value, label: a.label }))];
	const statusFilterOptions = [
		{ value: 'all', label: 'All statuses' },
		...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))
	];

	const COLUMNS: TableColumn<Risk>[] = [
		{ key: 'title', header: 'Risk' },
		{ key: 'asset_categories', header: 'Blast radius' },
		{ key: 'cia_impact', header: 'CIA' },
		{ key: 'chain', header: 'Likelihood → Impact' },
		{ key: 'residual', header: 'Residual' },
		{ key: 'owner_id', header: 'Owner' },
		{ key: 'status', header: 'Treatment / status' },
		{ key: 'review', header: 'Reviewed' },
		{ key: 'issue_ref', header: 'Tracked in' },
		{ key: '_actions', header: '' }
	];

	$effect(() => {
		const valid = spotsFor(fConnection);
		if (valid.length && !valid.some((s) => s.id === fSpot)) fSpot = valid[0].id;
	});

	// Treatment re-bases status onto its own track. Without this you get
	// "Accepted + Mitigating" nonsense sitting in the register forever.
	function pickTreatment(t: Treatment | null) {
		fTreatment = t;
		const track = trackFor(t);
		if (!track.includes(fStatus)) {
			// Over-appetite acceptance can't skip the approval gate.
			fStatus = t === 'accept' && previewVerdict.overAppetite ? 'pending_approval' : track[0];
		}
	}

	// ── Actions ───────────────────────────────────────────────────────────────

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 3200);
	}

	function openCreate() {
		step = 0;
		furthest = 0;
		editingId = null;
		baseline = null;
		fTitle = '';
		fNotes = '';
		fAssets = ['endpoint'];
		fDataClasses = [];
		fScope = 'segment';
		fCia = [];
		fOwner = 'u1';
		fInitiation = 'moderate';
		fSuccess = 'moderate';
		fImpact = 'moderate';
		fPreventive = 'low';
		fRecovery = 'low';
		fTreatment = null;
		fStatus = 'identified';
		fCreated = TODAY;
		fReviewed = TODAY;
		fReminderOn = false;
		fChannel = 'ch_risk';
		fCadence = 'weekly';
		fTrigger = 'until_closed';
		fOverride = false;
		fConnection = 'c_lin';
		fSpot = 's_lin_sec';
		formError = '';
		showEditor = true;
	}

	function openEdit(r: Risk) {
		step = 0;
		// Already filed — every step has been answered, so light the whole bar.
		furthest = STEPS.length - 1;
		editingId = r.id;
		baseline = { ...r };
		fTitle = r.title;
		fNotes = r.notes;
		fAssets = [...r.asset_categories];
		fDataClasses = [...r.data_classes];
		fScope = r.scope;
		fCia = [...r.cia_impact];
		fOwner = r.owner_id;
		fInitiation = r.likelihood_initiation;
		fSuccess = r.likelihood_success;
		fImpact = r.impact;
		fPreventive = r.preventive_effectiveness;
		fRecovery = r.recovery_effectiveness;
		fTreatment = r.treatment;
		fStatus = r.status;
		fCreated = r.created_at;
		fReviewed = r.last_reviewed_at;
		fReminderOn = !!r.reminder;
		fChannel = r.reminder?.channel_id ?? 'ch_risk';
		fCadence = r.reminder?.cadence ?? 'weekly';
		fTrigger = r.reminder?.trigger ?? 'until_closed';
		fOverride = !!r.route_override;
		const route = routeOf(r);
		fConnection = route.connection_id;
		fSpot = route.spot_id;
		formError = '';
		showEditor = true;
	}

	const toggleCia = (c: CIA) => (fCia = fCia.includes(c) ? fCia.filter((x) => x !== c) : [...fCia, c]);

	// "None" is exclusive — declaring no data exposure alongside PHI is incoherent.
	function toggleDataClass(d: DataClass) {
		if (fDataClasses.includes(d)) fDataClasses = fDataClasses.filter((x) => x !== d);
		else if (d === 'none') fDataClasses = ['none'];
		else fDataClasses = [...fDataClasses.filter((x) => x !== 'none'), d];
	}
	function toggleAsset(a: AssetCategory) {
		// Never let the last one go — a risk with no asset can't be scored
		// against appetite or routed.
		if (fAssets.includes(a)) {
			if (fAssets.length > 1) fAssets = fAssets.filter((x) => x !== a);
		} else fAssets = [...fAssets, a];
	}

	async function markReviewed(r: Risk) {
		await new Promise((res) => setTimeout(res, 300));
		risks = risks.map((x) => (x.id === r.id ? { ...x, last_reviewed_at: TODAY } : x));
		showToast(`${r.id} marked reviewed today`);
	}

	async function approveException(r: Risk) {
		await new Promise((res) => setTimeout(res, 500));
		risks = risks.map((x) =>
			x.id === r.id
				? { ...x, status: 'accepted' as Status, accepted_until: addDays(TODAY, appetite.acceptance_expiry_days) }
				: x
		);
		showToast(`${r.id} exception approved · expires ${addDays(TODAY, appetite.acceptance_expiry_days)}`);
	}

	async function saveRisk() {
		if (!fTitle.trim()) return (formError = 'A risk statement is required.'), undefined;
		if (fDataClasses.length === 0)
			return (formError = 'Declare what data is in the blast radius — pick “None” if no data is exposed.'), undefined;
		if (fCia.length === 0) return (formError = 'Select at least one CIA leg this risk impacts.'), undefined;
		if (fTreatment === 'accept' && !previewVerdict.canAccept) {
			return (
				(formError = `Residual ${LEVEL_LABEL[preview.residual]} is above tolerance (${LEVEL_LABEL[appetite.tolerance_max_residual]}). This risk cannot be accepted — mitigate, transfer, or avoid.`),
				undefined
			);
		}
		formError = '';
		saving = true;
		await new Promise((r) => setTimeout(r, 800));
		saving = false;

		const base = {
			title: fTitle,
			notes: fNotes,
			asset_categories: fAssets,
			data_classes: fDataClasses,
			scope: fScope,
			cia_impact: CIA_ORDER.filter((c) => fCia.includes(c)),
			owner_id: fOwner,
			likelihood_initiation: fInitiation,
			likelihood_success: fSuccess,
			impact: fImpact,
			preventive_effectiveness: fPreventive,
			recovery_effectiveness: fRecovery,
			treatment: fTreatment,
			status: fStatus,
			created_at: fCreated,
			last_reviewed_at: fReviewed,
			reminder: fReminderOn ? { channel_id: fChannel, cadence: fCadence, trigger: fTrigger } : null,
			route_override: fOverride ? { connection_id: fConnection, spot_id: fSpot } : null
		};

		if (editingId) {
			risks = risks.map((r) => (r.id === editingId ? { ...r, ...base } : r));
			showToast(`${editingId} updated · residual ${LEVEL_LABEL[preview.residual]}`);
		} else {
			const nextId = `RSK-${String(risks.length + 1).padStart(3, '0')}`;
			const spot = spotOf(effectiveSpot);
			risks = [
				...risks,
				{
					id: nextId,
					...base,
					issue_ref: spot ? { connection_id: effectiveConnection, key: `${spot.key}-NEW`, url: '#', state: 'Todo' } : null
				}
			];
			showToast(
				previewVerdict.needsException && fTreatment === 'accept'
					? `${nextId} filed · awaiting ${appetite.approver_role} sign-off`
					: `${nextId} filed in ${spot?.name ?? '—'}`
			);
		}
		showEditor = false;
	}

	async function deleteRisk(r: Risk) {
		await new Promise((res) => setTimeout(res, 400));
		risks = risks.filter((x) => x.id !== r.id);
		showToast(`${r.id} removed`);
	}

	function menuItems(r: Risk): ActionMenuItem[] {
		const items: ActionMenuItem[] = [{ label: 'Edit risk', onclick: () => openEdit(r) }];
		items.push({ label: 'Mark reviewed', onclick: () => markReviewed(r) });
		if (r.status === 'pending_approval') {
			items.push({ label: `Approve exception (${appetite.approver_role})`, onclick: () => approveException(r) });
		}
		items.push({ label: 'Delete', destructive: true, onclick: () => deleteRisk(r) });
		return items;
	}

	function ruleSummary(r: RoutingRule): string {
		const res = r.residual ? r.residual.map((l) => LEVEL_LABEL[l]).join(' / ') : 'any residual';
		const asset = r.asset_category ? r.asset_category.map((a) => ASSET_MAP[a].label).join(' / ') : 'any asset';
		return `${res} · ${asset}`;
	}

	function setOverride(cat: AssetCategory, l: Level) {
		const has = appetite.overrides.find((o) => o.asset_category === cat);
		appetite.overrides = has
			? appetite.overrides.map((o) => (o.asset_category === cat ? { ...o, max_residual: l } : o))
			: [...appetite.overrides, { asset_category: cat, max_residual: l }];
	}
	const clearOverride = (cat: AssetCategory) =>
		(appetite.overrides = appetite.overrides.filter((o) => o.asset_category !== cat));
</script>

<svelte:head><title>Risk register — Armornet</title></svelte:head>

{#snippet levelScale(label: string, help: string, value: Level, onpick: (l: Level) => void)}
	<div class="scale">
		<span class="field-label">{label}</span>
		<div class="scale-btns">
			{#each LEVELS as l (l)}
				<button
					type="button"
					class="scale-btn"
					class:scale-on={value === l}
					style={`--h:${LEVEL_HUE[l]}`}
					title={LEVEL_LABEL[l]}
					onclick={() => onpick(l)}
				>
					{LEVEL_ABBR[l]}
				</button>
			{/each}
		</div>
		{#if help}<span class="scale-help">{help}</span>{/if}
	</div>
{/snippet}

{#snippet levelChip(l: Level)}
	<span class="lvl" style={`--h:${LEVEL_HUE[l]}`}>{LEVEL_LABEL[l]}</span>
{/snippet}

{#if toast}
	<div class="toast"><Icon name="check" size={12} /> {toast}</div>
{/if}

<LayoutHeader eyebrow="// console · risk register">
	{#snippet title()}Risk <span class="text-[var(--accent)]">register.</span>{/snippet}
	{#snippet lede()}
		Assess initiation and success separately, cross them with impact, let controls carry it to residual — then measure
		that against the org's appetite.
	{/snippet}
	{#snippet actions()}
		<Button variant="primary" size="sm" onclick={openCreate}>
			<Icon name="plus" size={12} strokeWidth={2.5} /> Define risk
		</Button>
	{/snippet}
</LayoutHeader>

<div class="stat-strip">
	<div class="stat"><span class="stat-k">Live</span><span class="stat-v">{liveRisks.length}</span></div>
	<div class="stat" style={`--h:${LEVEL_HUE.very_high}`}>
		<span class="stat-k">Over appetite</span><span class="stat-v hue">{overAppetiteCount}</span>
	</div>
	<div class="stat" style={`--h:${LEVEL_HUE.high}`}>
		<span class="stat-k">Review overdue</span><span class="stat-v hue">{overdueCount}</span>
	</div>
	<div class="stat" style={`--h:${LEVEL_HUE.moderate}`}>
		<span class="stat-k">Awaiting sign-off</span><span class="stat-v hue">{awaitingApproval}</span>
	</div>
	<button type="button" class="matrix-toggle" onclick={() => (showMatrix = !showMatrix)}>
		<Icon name="table" size={11} /> {showMatrix ? 'Hide' : 'Show'} matrices
	</button>
</div>

{#if showMatrix}
	<div class="matrix-wrap">
		{#each [{ t: 'Table G-5 — Overall likelihood', rowLabel: 'Initiation ↓ / Success →', tbl: TABLE_G5 }, { t: 'Table I-2 — Level of risk', rowLabel: 'Likelihood ↓ / Impact →', tbl: TABLE_I2 }] as m (m.t)}
			<div class="matrix">
				<div class="matrix-t">{m.t}</div>
				<div class="matrix-sub">{m.rowLabel}</div>
				<table>
					<thead>
						<tr>
							<th></th>
							{#each LEVELS as c (c)}<th>{LEVEL_ABBR[c]}</th>{/each}
						</tr>
					</thead>
					<tbody>
						{#each [...LEVELS].reverse() as r (r)}
							<tr>
								<th>{LEVEL_ABBR[r]}</th>
								{#each LEVELS as c (c)}
									{@const v = m.tbl[r][c]}
									<td style={`--h:${LEVEL_HUE[v]}`}>{LEVEL_ABBR[v]}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}
	</div>
{/if}

<div class="mb-4"><Tabs tabs={TABS} bind:active={activeTab} /></div>

{#if activeTab === 'register'}
	<div class="flex flex-wrap items-center gap-3 mb-4">
		<div class="min-w-[240px] flex-1"><SearchInput bind:value={search} placeholder="Search risks…" /></div>
		<Select options={assetFilterOptions} bind:value={assetFilter} />
		<Select options={statusFilterOptions} bind:value={statusFilter} />
	</div>

	{#if sorted.length === 0}
		<EmptyState variant="card" message="No risks match these filters." sub="Clear the search or widen the filters." />
	{:else}
		<DataTable columns={COLUMNS} rows={sorted} onRowClick={openEdit} empty="No risks in the register.">
			{#snippet cell(key, row)}
				{#if key === 'title'}
					<div class="max-w-[260px]">
						<span class="rid">{row.id} · added {row.created_at}</span>
						<div class="rtitle">{row.title}</div>
						{#if row.notes}<div class="rdesc">{row.notes}</div>{/if}
					</div>
				{:else if key === 'asset_categories'}
					{@const sug = suggestImpact(row.data_classes, row.scope)}
					<div class="blast-cell">
						<span class="assets-cell">
							{#each row.asset_categories as a (a)}
								<span class="asset-tag" title={ASSET_MAP[a].label}>
									<Icon name={ASSET_MAP[a].icon} size={11} />
									{ASSET_MAP[a].label}
								</span>
							{/each}
						</span>
						<span class="dc-tags">
							{#each row.data_classes as d (d)}
								<span class="dc-tag" style={`--h:${TIER_HUE[DATA_MAP[d].tier]}`} title={DATA_MAP[d].summary}>
									{DATA_MAP[d].label}
								</span>
							{/each}
							<span class="scope-tag" title={`Scope — suggests ${LEVEL_LABEL[sug.level]} impact`}>
								{SCOPES.find((s) => s.value === row.scope)!.label}
							</span>
						</span>
					</div>
				{:else if key === 'cia_impact'}
					<div class="flex gap-1">
						{#each CIA_META as c (c.value)}
							{@const on = row.cia_impact.includes(c.value)}
							<span class="cia-dot {on ? 'cia-on' : ''}" title={c.label}>{c.letter}</span>
						{/each}
					</div>
				{:else if key === 'chain'}
					{@const a = assess(row)}
					<span class="chain-cell">
						<span class="chain-in" title={`Initiation ${LEVEL_LABEL[row.likelihood_initiation]} × Success ${LEVEL_LABEL[row.likelihood_success]}`}>
							<b style={`--h:${LEVEL_HUE[row.likelihood_initiation]}`}>{LEVEL_ABBR[row.likelihood_initiation]}</b>
							<i>×</i>
							<b style={`--h:${LEVEL_HUE[row.likelihood_success]}`}>{LEVEL_ABBR[row.likelihood_success]}</b>
						</span>
						<Icon name="arrow-right" size={10} />
						<span class="chain-mid" title="Overall likelihood (Table G-5)" style={`--h:${LEVEL_HUE[a.overall_likelihood]}`}>
							{LEVEL_ABBR[a.overall_likelihood]}
						</span>
						<i class="chain-x">×</i>
						<span class="chain-mid" title="Impact" style={`--h:${LEVEL_HUE[row.impact]}`}>{LEVEL_ABBR[row.impact]}</span>
					</span>
				{:else if key === 'residual'}
					{@const a = assess(row)}
					{@const v = appetiteVerdict(row.asset_categories, a.residual)}
					{@const drop = idx(a.inherent) - idx(a.residual)}
					<div class="res-cell">
						<span class="res-top">
							{@render levelChip(a.residual)}
							{#if drop > 0}
								<span class="res-drop" title={`Inherent ${LEVEL_LABEL[a.inherent]} → residual ${LEVEL_LABEL[a.residual]} (controls)`}>
									<Icon name="arrow-down" size={9} />{drop}
								</span>
							{/if}
						</span>
						{#if v.overTolerance}
							<span class="appetite-flag tol" title={`Above tolerance (${LEVEL_LABEL[appetite.tolerance_max_residual]}) — cannot be accepted`}>
								<Icon name="alert-triangle" size={9} /> over tolerance
							</span>
						{:else if v.overAppetite}
							<span class="appetite-flag" title={`Appetite for ${v.source} is ${LEVEL_LABEL[v.limit]}`}>
								<Icon name="alert-circle" size={9} /> over appetite
							</span>
						{/if}
					</div>
				{:else if key === 'owner_id'}
					{@const o = ownerOf(row.owner_id)}
					<div class="owner-cell">
						<Avatar initials={o.avatar_initials} size={24} />
						<div>
							<div class="owner-n">{o.name}</div>
							<div class="owner-r">{o.role}</div>
						</div>
					</div>
				{:else if key === 'status'}
					<div class="ts-cell">
						<span class="pill-static" style={`--h:${STATUS_META[row.status].hue}`}>{STATUS_META[row.status].label}</span>
						<span class="ts-treat">
							{#if row.treatment}
								{@const t = TREATMENTS.find((x) => x.value === row.treatment)!}
								<Icon name={t.icon} size={9} /> {t.label}
							{:else}
								<Icon name="alert-circle" size={9} /> no decision
							{/if}
						</span>
						{#if row.accepted_until}
							<span class="ts-until" title="Acceptance expires — re-approval required">until {row.accepted_until}</span>
						{/if}
					</div>
				{:else if key === 'review'}
					{@const rv = reviewOf(row)}
					<div class="rev-cell">
						<span class="rev-last">{row.last_reviewed_at}</span>
						{#if TERMINAL.includes(row.status)}
							<span class="rev-due">no review needed</span>
						{:else if rv.overdue}
							<span class="rev-late" title={`Due ${rv.due} · ${rv.cadence}-day cadence for ${LEVEL_LABEL[assess(row).residual]}`}>
								<Icon name="clock" size={9} /> {rv.slip}d overdue
							</span>
						{:else}
							<span class="rev-due" title={`${rv.cadence}-day cadence for ${LEVEL_LABEL[assess(row).residual]}`}>
								due {rv.due}
							</span>
						{/if}
						{#if row.reminder}
							{@const ch = channelOf(row.reminder.channel_id)}
							<span class="rev-rem" title={`${ch?.label} · ${row.reminder.cadence} · ${row.reminder.trigger === 'until_closed' ? 'until done' : 'when overdue'}`}>
								{#if ch}<Icon name={ALERT_ICON[ch.kind]} size={9} />{/if}
								{row.reminder.cadence}
							</span>
						{/if}
					</div>
				{:else if key === 'issue_ref'}
					{@const route = routeOf(row)}
					{@const conn = connOf(route.connection_id)}
					{@const spot = spotOf(route.spot_id)}
					{#if row.issue_ref}
						<!-- Follows the link out to the tracker — not the row's editor. -->
						<a
							class="issue-link"
							href={row.issue_ref.url}
							title={`${conn?.label} · ${spot?.name} · ${row.issue_ref.state}`}
							onclick={(e) => e.stopPropagation()}
						>
							{#if conn}<Icon name={TRACKER_META[conn.kind].icon} size={11} />{/if}
							{row.issue_ref.key}
							{#if row.route_override}<span class="ovr" title="Route overridden on this risk">override</span>{/if}
						</a>
					{:else}
						<span class="issue-pending" title={`Will file to ${conn?.label} · ${spot?.name}`}>
							{#if conn}<Icon name={TRACKER_META[conn.kind].icon} size={11} />{/if}
							{spot?.name ?? '—'}
							<span class="ovr pend">not filed</span>
						</span>
					{/if}
				{:else if key === '_actions'}
					<!-- The row opens the editor; the menu must not also trigger it. -->
					<span role="presentation" onclick={(e) => e.stopPropagation()}>
						<ActionsMenu items={menuItems(row)} />
					</span>
				{/if}
			{/snippet}
		</DataTable>
	{/if}

	<!-- ── Appetite ──────────────────────────────────────────────────────── -->
{:else if activeTab === 'appetite'}
	<section class="edit-card mb-4">
		<header class="edit-card-head">
			<Icon name="shield" size={14} />
			<span>Appetite &amp; tolerance</span>
			<span class="edit-card-count">applies to every risk</span>
		</header>
		<div class="scale-row">
			{@render levelScale(
				'Appetite — accept freely at or below',
				'Residual at or under this is acceptable with no ceremony.',
				appetite.global_max_residual,
				(l) => (appetite.global_max_residual = l)
			)}
			{@render levelScale(
				'Tolerance — never acceptable above',
				`Above this, "Accept" is removed as an option. Between the two, acceptance needs ${appetite.approver_role} sign-off.`,
				appetite.tolerance_max_residual,
				(l) => (appetite.tolerance_max_residual = l)
			)}
		</div>
		<div class="band">
			{#each LEVELS as l (l)}
				{@const state = idx(l) <= idx(appetite.global_max_residual) ? 'ok' : idx(l) <= idx(appetite.tolerance_max_residual) ? 'exception' : 'never'}
				<div class="band-cell {state}" style={`--h:${LEVEL_HUE[l]}`}>
					<span class="band-l">{LEVEL_LABEL[l]}</span>
					<span class="band-s">
						{state === 'ok' ? 'acceptable' : state === 'exception' ? `needs ${appetite.approver_role}` : 'never accept'}
					</span>
				</div>
			{/each}
		</div>
		<p class="src-note">
			<Icon name="info" size={11} />
			{overAppetiteCount} live risk{overAppetiteCount === 1 ? '' : 's'} sit above appetite under this policy · {awaitingApproval}
			awaiting sign-off.
		</p>
	</section>

	<section class="edit-card mb-4">
		<header class="edit-card-head">
			<Icon name="layers" size={14} />
			<span>Per-asset overrides</span>
			<span class="edit-card-count">{appetite.overrides.length} tighter than global</span>
		</header>
		<div class="ovr-grid">
			{#each ASSETS as a (a.value)}
				{@const o = appetite.overrides.find((x) => x.asset_category === a.value)}
				<div class="ovr-row" class:ovr-set={!!o}>
					<span class="ovr-asset">
						<Icon name={a.icon} size={12} />
						{a.label}
					</span>
					<div class="ovr-scale">
						{#each LEVELS as l (l)}
							<button
								type="button"
								class="scale-btn sm"
								class:scale-on={(o?.max_residual ?? appetite.global_max_residual) === l}
								class:scale-ghost={!o}
								style={`--h:${LEVEL_HUE[l]}`}
								title={LEVEL_LABEL[l]}
								onclick={() => setOverride(a.value, l)}
							>
								{LEVEL_ABBR[l]}
							</button>
						{/each}
					</div>
					{#if o}
						<IconButton icon="rotate-ccw" size="sm" label="Reset {a.label} to global" onclick={() => clearOverride(a.value)} />
					{:else}
						<span class="ovr-inherit">global</span>
					{/if}
				</div>
			{/each}
		</div>
		<p class="src-note">
			<Icon name="info" size={11} /> A risk spanning several assets answers to the strictest of them.
		</p>
	</section>

	<section class="edit-card">
		<header class="edit-card-head">
			<Icon name="clock" size={14} />
			<span>Review cadence</span>
			<span class="edit-card-count">days between reviews, by residual</span>
		</header>
		<div class="cadence-grid">
			{#each [...LEVELS].reverse() as l (l)}
				<label class="cadence" style={`--h:${LEVEL_HUE[l]}`}>
					<span class="cadence-l">{LEVEL_LABEL[l]}</span>
					<Input
						type="number"
						value={String(appetite.review_cadence_days[l])}
						oninput={(e: Event) =>
							(appetite.review_cadence_days[l] = Number((e.currentTarget as HTMLInputElement).value) || 0)}
					/>
					<span class="cadence-n">
						{risks.filter((r) => !TERMINAL.includes(r.status) && assess(r).residual === l).length} live
					</span>
				</label>
			{/each}
		</div>
		<div class="grid grid-cols-2 gap-3 mt-4 max-[620px]:grid-cols-1">
			<label class="field">
				<span class="field-label"><Icon name="clock" size={11} /> Acceptance expires after (days)</span>
				<Input
					type="number"
					value={String(appetite.acceptance_expiry_days)}
					oninput={(e: Event) => (appetite.acceptance_expiry_days = Number((e.currentTarget as HTMLInputElement).value) || 0)}
				/>
			</label>
			<label class="field">
				<span class="field-label"><Icon name="user" size={11} /> Exception approver</span>
				<Select
					options={OWNERS.map((o) => ({ value: o.role, label: o.role }))}
					bind:value={appetite.approver_role}
					class="!w-full"
				/>
			</label>
		</div>
		<p class="src-note">
			<Icon name="info" size={11} /> {overdueCount} live risk{overdueCount === 1 ? '' : 's'} overdue for review under this
			cadence.
		</p>
	</section>

	<!-- ── Routing ───────────────────────────────────────────────────────── -->
{:else}
	<section class="edit-card mb-4">
		<header class="edit-card-head">
			<Icon name="link" size={14} />
			<span>Tracker connections</span>
			<span class="edit-card-count">{CONNECTIONS.length} configured</span>
		</header>
		<div class="conn-grid">
			{#each CONNECTIONS as c (c.id)}
				<div class="conn">
					<span class="conn-icon"><Icon name={TRACKER_META[c.kind].icon} size={16} strokeWidth={1.5} /></span>
					<div class="conn-body">
						<div class="conn-top">
							<StatusDot status={statusLevel(c.status)} glow />
							<span class="conn-label">{c.label}</span>
						</div>
						<div class="conn-meta">
							{spotsFor(c.id).length}
							{TRACKER_META[c.kind].spotNoun}{spotsFor(c.id).length === 1 ? '' : 's'} ·
							{c.verified_at ? `verified ${c.verified_at}` : 'not verified'}
						</div>
						{#if c.last_error}<div class="conn-err">{c.last_error}</div>{/if}
					</div>
				</div>
			{/each}
		</div>
		<p class="src-note">
			<Icon name="settings" size={11} /> API keys and base URLs live in
			<a href="/console/integrations" class="src-link">Integrations</a> — this page only picks the spot.
		</p>
	</section>

	<section class="edit-card">
		<header class="edit-card-head">
			<Icon name="git-fork" size={14} />
			<span>Routing rules</span>
			<span class="edit-card-count">matched on residual · first match wins</span>
		</header>
		<div class="rule-list">
			{#each rules as r, i (r.id)}
				{@const conn = connOf(r.connection_id)}
				{@const spot = spotOf(r.spot_id)}
				{@const isDefault = r.residual === null && r.asset_category === null}
				<div class="rule" class:rule-default={isDefault}>
					<span class="rule-n">{isDefault ? '—' : i + 1}</span>
					<div class="rule-match">
						<span class="rule-when">{isDefault ? 'Fallback' : 'When'}</span>
						<span class="rule-cond">{isDefault ? 'anything unmatched above' : ruleSummary(r)}</span>
					</div>
					<Icon name="arrow-right" size={13} />
					<div class="rule-dest">
						{#if conn}<span class="rule-dest-icon"><Icon name={TRACKER_META[conn.kind].icon} size={13} /></span>{/if}
						<div>
							<div class="rule-dest-spot">{spot?.name} <span class="rule-dest-key">{spot?.key}</span></div>
							<div class="rule-dest-conn">{conn?.label}</div>
						</div>
					</div>
					<div class="rule-actions">
						<IconButton icon="pencil" size="sm" label="Edit rule" onclick={() => {}} />
						{#if !isDefault}
							<IconButton icon="trash" variant="danger" size="sm" label="Delete rule" onclick={() => (rules = rules.filter((x) => x.id !== r.id))} />
						{/if}
					</div>
				</div>
			{/each}
		</div>
		<div class="mt-3">
			<Button variant="ghost" size="sm" onclick={() => {}}>
				<Icon name="plus" size={12} strokeWidth={2.5} /> Add rule
			</Button>
		</div>
	</section>
{/if}

<!-- ── Risk editor — stepped flow in a wide modal ────────────────────────── -->
<Modal
	open={showEditor}
	title={editingId ? `Edit ${editingId}` : 'Define a risk'}
	size="xl"
	onclose={() => (showEditor = false)}
>
<div class="wiz">
	<div class="stepbar">
		<!-- Bars fill up to the furthest step reached; each filled bar carries its
		     own state colour. `active` marks where you are, independently. -->
		<SteppedProgress
			steps={STEPS}
			current={furthest + 1}
			active={step}
			stepVariants={stepVariants}
			onstep={goStep}
			stepStyle="blocks"
			labelSize="sm"
			labelTone="bright"
			animate={false}
		/>
	</div>

	<div class="cols">
		<main class="wiz-main">
			<!-- ── Step 1 · Define ──────────────────────────────────────────── -->
			{#if step === 0}
		<section class="edit-card">
			<header class="edit-card-head">
				<Icon name="file-text" size={14} /><span>Statement</span>
				{#if editingId}<span class="edit-card-count">added {fCreated}</span>{/if}
			</header>
			<div class="flex flex-col gap-3">
				<label class="field">
					<span class="field-label"><Icon name="pencil" size={11} /> Risk statement</span>
					<Input type="text" placeholder="Unmanaged endpoints bypass DNS filtering" bind:value={fTitle} />
					<span class="scale-help">One declarative sentence: what is exposed. The blast radius is declared below, not written.</span>
				</label>
				<label class="field">
					<span class="field-label"><Icon name="file-text" size={11} /> Notes — optional</span>
					<Textarea rows={2} placeholder="Evidence links, caveats, anything the fields below can't hold." bind:value={fNotes} />
				</label>
				{#if formError}<span class="err"><Icon name="alert-triangle" size={11} /> {formError}</span>{/if}
			</div>
		</section>

		<!-- Blast radius: declared on three axes, never prose. -->
		<section class="edit-card">
			<header class="edit-card-head">
				<Icon name="zap" size={14} /><span>Blast radius</span>
				<span class="edit-card-count">
					{fAssets.length} asset{fAssets.length === 1 ? '' : 's'} · {fDataClasses.length} data class{fDataClasses.length === 1 ? '' : 'es'} · {SCOPES.find((s) => s.value === fScope)!.label.toLowerCase()}
				</span>
			</header>

			<div class="field mb-4">
				<span class="field-label"><Icon name="layers" size={11} /> What is exposed — asset categories</span>
				<div class="asset-grid">
					{#each ASSETS as a (a.value)}
						{@const on = fAssets.includes(a.value)}
						{@const ov = appetite.overrides.find((x) => x.asset_category === a.value)}
						<button type="button" class="asset-btn" class:asset-on={on} onclick={() => toggleAsset(a.value)}>
							<span class="asset-icon" class:asset-icon-on={on}><Icon name={on ? 'check' : a.icon} size={15} /></span>
							<span class="asset-label">{a.label}</span>
							<span class="asset-blurb">
								{#if ov}appetite {LEVEL_ABBR[ov.max_residual]}{:else}{a.blurb}{/if}
							</span>
						</button>
					{/each}
				</div>
				{#if previewVerdict.source !== 'global'}
					<span class="scale-help">
						Strictest appetite comes from <b class="src-em">{previewVerdict.source}</b> — {LEVEL_LABEL[previewVerdict.limit]}.
					</span>
				{/if}
			</div>

			<div class="field mb-4">
				<span class="field-label"><Icon name="table" size={11} /> What data is on it</span>
				<div class="dc-row">
					{#each DATA_CLASSES as d (d.value)}
						{@const on = fDataClasses.includes(d.value)}
						<button
							type="button"
							class="dc-pill"
							class:dc-on={on}
							style={`--h:${TIER_HUE[d.tier]}`}
							title={d.summary}
							onclick={() => toggleDataClass(d.value)}
						>
							<Icon name={on ? 'check' : 'plus'} size={10} />
							{d.label}
						</button>
					{/each}
				</div>
				<span class="scale-help">
					{#if fDataClasses.length}
						{DATA_MAP[suggested.driver].summary}
					{:else}
						Pick every class in reach — the most sensitive one anchors impact. Classes match the vendor register.
					{/if}
				</span>
			</div>

			<div class="field">
				<span class="field-label"><Icon name="maximize" size={11} /> How much of the estate</span>
				<div class="scope-row">
					{#each SCOPES as s (s.value)}
						{@const on = fScope === s.value}
						<button type="button" class="scope-btn" class:scope-on={on} onclick={() => (fScope = s.value)}>
							<Icon name={s.icon} size={13} />
							<span class="scope-l">{s.label}</span>
							<span class="scope-b">{s.blurb}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="derive">
				<Icon name="arrow-down" size={12} />
				<span class="derive-k">Suggests impact</span>
				{@render levelChip(suggested.level)}
				<span class="derive-note">
					{DATA_MAP[suggested.driver].label} at {SCOPES.find((s) => s.value === fScope)!.label.toLowerCase()} scope
				</span>
			</div>
		</section>

		<section class="edit-card">
			<header class="edit-card-head">
				<Icon name="shield" size={14} /><span>CIA impact</span>
				<span class="edit-card-count">{fCia.length} of 3</span>
			</header>
			<div class="cia-grid">
				{#each CIA_META as c (c.value)}
					{@const on = fCia.includes(c.value)}
					<button type="button" class="cia-btn" class:cia-btn-on={on} onclick={() => toggleCia(c.value)}>
						<span class="cia-letter" class:cia-letter-on={on}>{c.letter}</span>
						<span class="cia-text">
							<span class="cia-label">{c.label}</span>
							<span class="cia-blurb">{c.blurb}</span>
						</span>
						<Icon name={on ? 'check' : 'plus'} size={12} />
					</button>
				{/each}
			</div>
		</section>

			{/if}

			<!-- ── Step 2 · Assess ──────────────────────────────────────────── -->
			{#if step === 1}
		<section class="edit-card">
			<header class="edit-card-head">
				<Icon name="activity" size={14} /><span>Likelihood</span>
				<span class="edit-card-count">Table G-5</span>
			</header>
			<div class="scale-row">
				{@render levelScale('Likelihood of initiation', SCALE_HELP.initiation, fInitiation, (l) => (fInitiation = l))}
				{@render levelScale('Likelihood of success', SCALE_HELP.success, fSuccess, (l) => (fSuccess = l))}
			</div>
			<div class="derive">
				<Icon name="arrow-down" size={12} />
				<span class="derive-k">Overall likelihood</span>
				{@render levelChip(preview.overall_likelihood)}
			</div>
		</section>

		<section class="edit-card">
			<header class="edit-card-head">
				<Icon name="zap" size={14} /><span>Impact</span>
				<span class="edit-card-count">Table I-2</span>
			</header>
			<div class="scale-row">
				{@render levelScale('Impact if successful', SCALE_HELP.impact, fImpact, (l) => (fImpact = l))}
				<div class="derive-inline">
					<span class="derive-k">Inherent risk</span>
					{@render levelChip(preview.inherent)}
					<span class="derive-note">
						{LEVEL_ABBR[preview.overall_likelihood]} likelihood × {LEVEL_ABBR[fImpact]} impact — before controls
					</span>
				</div>
			</div>
			{#if !impactMatchesSuggestion}
				<!-- Divergence from the declared blast radius is allowed, but it has
				     to be a visible choice rather than a quiet one. -->
				<div class="nudge">
					<Icon name="info" size={12} />
					<span>
						Blast radius suggests <b>{LEVEL_LABEL[suggested.level]}</b> ({DATA_MAP[suggested.driver].label} at
						{SCOPES.find((s) => s.value === fScope)!.label.toLowerCase()} scope) — you set
						<b>{LEVEL_LABEL[fImpact]}</b>.
					</span>
					<button type="button" class="nudge-btn" onclick={() => (fImpact = suggested.level)}>Use suggestion</button>
				</div>
			{/if}
		</section>

		<section class="edit-card" style={`--h:${LEVEL_HUE[preview.residual]}`}>
			<header class="edit-card-head">
				<Icon name="shield-check" size={14} /><span>Controls</span>
				<span class="edit-card-count">org policy</span>
			</header>
			<div class="scale-row">
				{@render levelScale('Preventive effectiveness', SCALE_HELP.preventive, fPreventive, (l) => (fPreventive = l))}
				{@render levelScale('Recovery effectiveness', SCALE_HELP.recovery, fRecovery, (l) => (fRecovery = l))}
			</div>
			<div class="derive derive-final" style={`--h:${LEVEL_HUE[preview.residual]}`}>
				<Icon name="arrow-down" size={12} />
				<span class="derive-k">Residual risk</span>
				{@render levelChip(preview.residual)}
				<span class="derive-note">
					vs appetite {LEVEL_LABEL[previewVerdict.limit]}
					{#if previewVerdict.overTolerance}
						· above tolerance
					{:else if previewVerdict.overAppetite}
						· over appetite
					{:else}
						· within appetite
					{/if}
				</span>
			</div>
		</section>

			{/if}

			<!-- ── Step 3 · Decide ──────────────────────────────────────────── -->
			{#if step === 2}
		<!-- Treatment drives status; appetite gates acceptance. -->
		<section class="edit-card">
			<header class="edit-card-head">
				<Icon name="git-fork" size={14} /><span>Treatment &amp; status</span>
				<span class="edit-card-count">{fTreatment ? 'decided' : 'no decision yet'}</span>
			</header>

			<div class="field mb-3">
				<span class="field-label"><Icon name="git-fork" size={11} /> Decision</span>
				<div class="treat-grid">
					{#each TREATMENTS as t (t.value)}
						{@const blocked = t.value === 'accept' && !previewVerdict.canAccept}
						<button
							type="button"
							class="treat-btn"
							class:treat-on={fTreatment === t.value}
							class:treat-blocked={blocked}
							disabled={blocked}
							title={blocked ? `Residual ${LEVEL_LABEL[preview.residual]} is above tolerance — acceptance is not available` : t.blurb}
							onclick={() => pickTreatment(t.value)}
						>
							<Icon name={t.icon} size={13} />
							<span class="treat-l">{t.label}</span>
							<span class="treat-b">{blocked ? 'above tolerance' : t.blurb}</span>
						</button>
					{/each}
				</div>
				{#if fTreatment}
					<button type="button" class="undecide" onclick={() => pickTreatment(null)}>
						<Icon name="rotate-ccw" size={10} /> Clear decision
					</button>
				{/if}
			</div>

			{#if fTreatment === 'accept' && previewVerdict.needsException}
				<div class="gate">
					<Icon name="alert-triangle" size={13} />
					<div>
						<b>Exception required.</b> Residual {LEVEL_LABEL[preview.residual]} exceeds the
						{LEVEL_LABEL[previewVerdict.limit]} appetite for {previewVerdict.source}. It parks at
						<b>Pending approval</b> until {appetite.approver_role} signs off, then expires after
						{appetite.acceptance_expiry_days} days.
					</div>
				</div>
			{/if}

			<div class="field">
				<span class="field-label"><Icon name="activity" size={11} /> Status — {fTreatment ? `${fTreatment} track` : 'pre-decision'}</span>
				<div class="track">
					{#each allowedStatuses as s, i (s)}
						{@const gated = s === 'accepted' && previewVerdict.needsException}
						<button
							type="button"
							class="track-step"
							class:track-on={fStatus === s}
							class:track-gated={gated}
							disabled={gated}
							style={`--h:${STATUS_META[s].hue}`}
							title={gated ? `Requires ${appetite.approver_role} sign-off` : STATUS_META[s].label}
							onclick={() => (fStatus = s)}
						>
							{STATUS_META[s].label}
							{#if gated}<Icon name="lock" size={9} />{/if}
						</button>
						{#if i < allowedStatuses.length - 1}<Icon name="chevron-right" size={10} />{/if}
					{/each}
				</div>
				<span class="scale-help">
					{#if fTreatment}
						Statuses are scoped to the {fTreatment} track — changing the decision re-bases this.
					{:else}
						Pick a treatment to open its track.
					{/if}
				</span>
			</div>

			<div class="grid grid-cols-2 gap-3 mt-3 max-[620px]:grid-cols-1">
				<label class="field">
					<span class="field-label"><Icon name="user" size={11} /> Owner</span>
					<Select options={ownerOptions} bind:value={fOwner} class="!w-full" />
				</label>
				<!-- Dates are stamped, not typed: added is set on create, reviewed
				     moves only when someone actually reviews. -->
				<div class="field">
					<span class="field-label"><Icon name="clock" size={11} /> Dates</span>
					<div class="dates">
						<span class="date-row">
							<span class="date-k">Added</span>
							<span class="date-v">{editingId ? fCreated : 'on save'}</span>
						</span>
						<span class="date-row">
							<span class="date-k">Reviewed</span>
							<span class="date-v">{fReviewed}</span>
							{#if fReviewed !== TODAY}
								<button type="button" class="nudge-btn" onclick={() => (fReviewed = TODAY)}>Mark reviewed</button>
							{/if}
						</span>
					</div>
				</div>
			</div>
			<p class="src-note">
				<Icon name="clock" size={11} /> {LEVEL_LABEL[preview.residual]} residual → reviewed every
				<b class="src-em">{previewCadence} days</b> · next due
				<b class="src-em">{previewDue}</b>
				{#if daysBetween(previewDue, TODAY) > 0}<span class="src-late">({daysBetween(previewDue, TODAY)}d overdue)</span>{/if}
			</p>
		</section>

			{/if}

			<!-- ── Step 4 · Track ───────────────────────────────────────────── -->
			{#if step === 3}
		<!-- Reminders — alert-channel paradigm -->
		<section class="edit-card">
			<header class="edit-card-head">
				<Icon name="bell" size={14} /><span>Reminders</span>
				<span class="edit-card-count">{fReminderOn ? 'on' : 'off'}</span>
			</header>
			<div class="treat-row mb-3">
				<button type="button" class="pill" class:pill-on={fReminderOn} onclick={() => (fReminderOn = !fReminderOn)}>
					<Icon name={fReminderOn ? 'check' : 'plus'} size={11} /> Nudge the owner
				</button>
			</div>

			{#if fReminderOn}
				<div class="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
					<label class="field">
						<span class="field-label"><Icon name="send" size={11} /> Channel</span>
						<Select options={channelOptions} bind:value={fChannel} class="!w-full" />
					</label>
					<div class="field">
						<span class="field-label"><Icon name="clock" size={11} /> Cadence</span>
						<div class="treat-row">
							{#each CADENCES as c (c.value)}
								<button type="button" class="pill" class:pill-on={fCadence === c.value} onclick={() => (fCadence = c.value)}>
									{c.label}
								</button>
							{/each}
						</div>
					</div>
				</div>
				<div class="field mt-3">
					<span class="field-label"><Icon name="bell" size={11} /> When</span>
					<div class="cia-grid">
						{#each TRIGGERS as t (t.value)}
							{@const on = fTrigger === t.value}
							<button type="button" class="cia-btn" class:cia-btn-on={on} onclick={() => (fTrigger = t.value)}>
								<span class="cia-text">
									<span class="cia-label">{t.label}</span>
									<span class="cia-blurb">{t.blurb}</span>
								</span>
								<Icon name={on ? 'check' : 'plus'} size={12} />
							</button>
						{/each}
					</div>
				</div>
				{#if channelOf(fChannel)}
					{@const ch = channelOf(fChannel)!}
					<div class="rem-preview">
						<span class="rem-icon"><Icon name={ALERT_ICON[ch.kind]} size={14} /></span>
						<span>
							<b>{ch.label}</b> gets a nudge <b>{fCadence}</b>
							{#if fTrigger === 'until_closed'}
								while this risk is open, naming {ownerOf(fOwner).name} — stops the moment status hits a done state.
							{:else}
								only once the review date slips past {previewDue}.
							{/if}
						</span>
					</div>
				{/if}
				<p class="src-note">
					<Icon name="settings" size={11} /> Channels come from
					<a href="/console/integrations" class="src-link">Integrations → Alert Channels</a>.
				</p>
			{:else}
				<p class="src-note"><Icon name="info" size={11} /> No nudges — this risk relies on the review cadence alone.</p>
			{/if}
		</section>

		<section class="edit-card">
			<header class="edit-card-head">
				<Icon name="send" size={14} /><span>Tracking</span>
				<span class="edit-card-count">{fOverride ? 'overridden' : 'by rule'}</span>
			</header>

			{#if !fOverride}
				{@const conn = connOf(previewRule.connection_id)}
				{@const spot = spotOf(previewRule.spot_id)}
				<div class="route">
					<span class="route-icon">{#if conn}<Icon name={TRACKER_META[conn.kind].icon} size={16} strokeWidth={1.5} />{/if}</span>
					<div class="route-body">
						<div class="route-top">
							{#if conn}<StatusDot status={statusLevel(conn.status)} glow />{/if}
							<span class="route-spot">{spot?.name}</span>
							<span class="route-key">{spot?.key}</span>
						</div>
						<div class="route-meta">
							{conn?.label} · matched
							{previewRule.residual === null && previewRule.asset_category === null ? 'fallback rule' : `rule “${ruleSummary(previewRule)}”`}
						</div>
					</div>
					<Button variant="ghost" size="sm" onclick={() => { fOverride = true; fConnection = previewRule.connection_id; fSpot = previewRule.spot_id; }}>
						Override
					</Button>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
					<label class="field">
						<span class="field-label"><Icon name="link" size={11} /> Connection</span>
						<Select options={connectionOptions} bind:value={fConnection} class="!w-full" />
					</label>
					<label class="field">
						<span class="field-label">
							<Icon name="layout-grid" size={11} />
							{connOf(fConnection) ? TRACKER_META[connOf(fConnection)!.kind].spotNoun : 'spot'}
						</span>
						<Select options={spotOptions} bind:value={fSpot} class="!w-full" />
					</label>
				</div>
				<div class="ovr-foot">
					<span class="ovr-note"><Icon name="info" size={11} /> This risk ignores routing rules.</span>
					<Button variant="ghost" size="sm" onclick={() => (fOverride = false)}>Use rule instead</Button>
				</div>
			{/if}
		</section>

			{/if}

			<!-- ── Step 5 · Review ──────────────────────────────────────────── -->
			{#if step === 4}
				<section class="edit-card">
					<header class="edit-card-head">
						<Icon name="clipboard-check" size={14} /><span>Review</span>
						<span class="edit-card-count">{blockers.length ? `${blockers.length} to fix` : 'ready to file'}</span>
					</header>

					{#if blockers.length}
						<div class="gate">
							<Icon name="alert-triangle" size={13} />
							<div>
								<b>Not ready.</b>
								<ul class="blockers">
									{#each blockers as b (b.msg)}
										<li>
											<button type="button" class="blocker" onclick={() => goStep(b.step)}>
												{b.msg} <span class="blocker-go">→ {STEPS[b.step]}</span>
											</button>
										</li>
									{/each}
								</ul>
							</div>
						</div>
					{/if}

					<div class="sum">
						<div class="sum-row">
							<span class="sum-k">Statement</span>
							<span class="sum-v">{fTitle || '—'}</span>
						</div>
						<div class="sum-row">
							<span class="sum-k">Blast radius</span>
							<span class="sum-v">
								{fAssets.map((a) => ASSET_MAP[a].label).join(', ')}
								· {fDataClasses.length ? fDataClasses.map((d) => DATA_MAP[d].label).join(', ') : 'no data declared'}
								· {SCOPES.find((s) => s.value === fScope)!.label.toLowerCase()}
							</span>
						</div>
						<div class="sum-row">
							<span class="sum-k">CIA</span>
							<span class="sum-v">{fCia.length ? fCia.map((c) => CIA_META.find((x) => x.value === c)!.label).join(', ') : '—'}</span>
						</div>
						<div class="sum-row">
							<span class="sum-k">Assessment</span>
							<span class="sum-v">
								likelihood {LEVEL_LABEL[preview.overall_likelihood]} × impact {LEVEL_LABEL[fImpact]} →
								inherent <b>{LEVEL_LABEL[preview.inherent]}</b> → residual <b>{LEVEL_LABEL[preview.residual]}</b>
							</span>
						</div>
						<div class="sum-row">
							<span class="sum-k">Appetite</span>
							<span class="sum-v">
								limit {LEVEL_LABEL[previewVerdict.limit]} ({previewVerdict.source}) —
								{#if previewVerdict.overTolerance}
									<b class="sum-bad">above tolerance</b>
								{:else if previewVerdict.overAppetite}
									<b class="sum-warn">over appetite, needs {appetite.approver_role}</b>
								{:else}
									within appetite
								{/if}
							</span>
						</div>
						<div class="sum-row">
							<span class="sum-k">Decision</span>
							<span class="sum-v">
								{fTreatment ? TREATMENTS.find((t) => t.value === fTreatment)!.label : 'none yet'} ·
								{STATUS_META[fStatus].label} · {ownerOf(fOwner).name}
							</span>
						</div>
						<div class="sum-row">
							<span class="sum-k">Tracking</span>
							<span class="sum-v">
								{connOf(effectiveConnection)?.label} · {spotOf(effectiveSpot)?.name}
								{fOverride ? '(override)' : '(by rule)'}
							</span>
						</div>
						<div class="sum-row">
							<span class="sum-k">Reminders</span>
							<span class="sum-v">
								{#if fReminderOn}
									{channelOf(fChannel)?.label} · {fCadence} ·
									{fTrigger === 'until_closed' ? 'until done' : 'when overdue'}
								{:else}
									none — review cadence only ({previewCadence}d)
								{/if}
							</span>
						</div>
					</div>
				</section>
			{/if}
		</main>

		<!-- ── Live rail — the derivation, building as you go ─────────────── -->
		<aside class="rail">
			<section class="edit-card">
				<header class="edit-card-head">
					<Icon name="activity" size={14} /><span>Assessment</span>
				</header>
				<div class="rail-chain">
					<div class="rail-row" class:rail-pend={step < 0}>
						<span class="rail-k">Blast radius</span>
						<span class="rail-v">
							{#if fDataClasses.length}
								{DATA_MAP[suggested.driver].label} · {SCOPES.find((s) => s.value === fScope)!.label.toLowerCase()}
							{:else}
								<span class="rail-dash">not declared</span>
							{/if}
						</span>
					</div>
					<div class="rail-row" class:rail-pend={step < 1}>
						<span class="rail-k">Likelihood</span>
						<span class="rail-v">
							{#if step >= 1}
								{@render levelChip(preview.overall_likelihood)}
							{:else}
								<span class="rail-dash">—</span>
							{/if}
						</span>
					</div>
					<div class="rail-row" class:rail-pend={step < 1}>
						<span class="rail-k">Impact</span>
						<span class="rail-v">
							{#if step >= 1}
								{@render levelChip(fImpact)}
							{:else}
								<span class="rail-dash">suggests {LEVEL_LABEL[suggested.level]}</span>
							{/if}
						</span>
					</div>
					<div class="rail-row rail-sep" class:rail-pend={step < 1}>
						<span class="rail-k">Inherent</span>
						<span class="rail-v">{#if step >= 1}{@render levelChip(preview.inherent)}{:else}<span class="rail-dash">—</span>{/if}</span>
					</div>
					<div class="rail-row" class:rail-pend={step < 1}>
						<span class="rail-k">Residual</span>
						<span class="rail-v">{#if step >= 1}{@render levelChip(preview.residual)}{:else}<span class="rail-dash">—</span>{/if}</span>
					</div>
				</div>
			</section>

			<section class="edit-card" style={`--h:${LEVEL_HUE[previewVerdict.limit]}`}>
				<header class="edit-card-head">
					<Icon name="shield" size={14} /><span>Appetite</span>
				</header>
				<div class="rail-chain">
					<div class="rail-row">
						<span class="rail-k">Limit</span>
						<span class="rail-v">{@render levelChip(previewVerdict.limit)}</span>
					</div>
					<div class="rail-row">
						<span class="rail-k">Source</span>
						<span class="rail-v"><span class="rail-t">{previewVerdict.source}</span></span>
					</div>
					{#if step >= 1}
						<div class="rail-verdict" class:rv-bad={previewVerdict.overTolerance} class:rv-warn={previewVerdict.overAppetite && !previewVerdict.overTolerance}>
							<Icon name={previewVerdict.overAppetite ? 'alert-triangle' : 'check-circle'} size={11} />
							{#if previewVerdict.overTolerance}
								Above tolerance — cannot be accepted
							{:else if previewVerdict.overAppetite}
								Over appetite — acceptance needs sign-off
							{:else}
								Within appetite
							{/if}
						</div>
					{/if}
				</div>
			</section>

			{#if step >= 2}
				<section class="edit-card">
					<header class="edit-card-head">
						<Icon name="git-fork" size={14} /><span>Decision</span>
					</header>
					<div class="rail-chain">
						<div class="rail-row">
							<span class="rail-k">Treatment</span>
							<span class="rail-v">
								<span class="rail-t">{fTreatment ? TREATMENTS.find((t) => t.value === fTreatment)!.label : 'none yet'}</span>
							</span>
						</div>
						<div class="rail-row">
							<span class="rail-k">Status</span>
							<span class="rail-v">
								<span class="pill-static" style={`--h:${STATUS_META[fStatus].hue}`}>{STATUS_META[fStatus].label}</span>
							</span>
						</div>
						<div class="rail-row">
							<span class="rail-k">Review</span>
							<span class="rail-v"><span class="rail-t">every {previewCadence}d</span></span>
						</div>
					</div>
				</section>
			{/if}

			{#if step >= 3}
				{@const conn = connOf(effectiveConnection)}
				<section class="edit-card">
					<header class="edit-card-head">
						<Icon name="send" size={14} /><span>Destination</span>
					</header>
					<div class="rail-chain">
						<div class="rail-row">
							<span class="rail-k">Files to</span>
							<span class="rail-v">
								<span class="rail-t">
									{#if conn}<Icon name={TRACKER_META[conn.kind].icon} size={10} />{/if}
									{spotOf(effectiveSpot)?.name}
								</span>
							</span>
						</div>
						<div class="rail-row">
							<span class="rail-k">Nudges</span>
							<span class="rail-v">
								<span class="rail-t">{fReminderOn ? `${channelOf(fChannel)?.label} · ${fCadence}` : 'none'}</span>
							</span>
						</div>
					</div>
				</section>
			{/if}
		</aside>
	</div>

</div>

	{#snippet footer()}
		<div class="commit">
			<Button variant="ghost" size="sm" disabled={step === 0} onclick={() => goStep(Math.max(0, step - 1))}>
				← Back
			</Button>
			<Button variant="ghost" size="sm" onclick={() => (showEditor = false)}>Cancel</Button>
			<div class="flex-1"></div>
			<span class="commit-hint">{stepHint}</span>
			{#if step < STEPS.length - 1}
				<Button variant="primary" size="sm" onclick={() => goStep(step + 1)}>Next · {STEPS[step + 1]} →</Button>
			{:else}
				<Button variant="primary" size="sm" loading={saving} disabled={blockers.length > 0} onclick={saveRisk}>
					<Icon name="save" size={13} /> {editingId ? 'Save changes' : 'Add & file issue'}
				</Button>
			{/if}
		</div>
	{/snippet}
</Modal>

<style>
	/* ── Wide modal ───────────────────────────────────────────────────────── */
	/* Modal's own `xl` caps at 920px — too tight for the stepper + rail, which
	   needs ~1300px before the rail drops below the content. Overridden here
	   rather than adding a size to the shared component: the builder registry
	   still lists Modal as sm/md/lg and hasn't tracked `xl`, so widening the
	   library is a change to make deliberately, not as a side effect of a
	   mockup. If this ships, Modal should gain a real `xxl`. */
	:global(dialog.modal.size-xl .modal-inner) {
		max-width: 1360px;
		width: 94vw;
	}

	/* ── Stepped editor shell — mirrors mockups/vscode-guard-setup ────────── */
	.wiz {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Pinned to the top of the modal's scroll container, so the state colours
	   stay readable while you work down a long step. */
	.stepbar {
		position: sticky;
		top: 0;
		z-index: 5;
		padding: 0.15rem 0 0.75rem;
		background: #080b10;
		border-bottom: 1px solid var(--border);
	}

	/* Content + persistent rail */
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: 1rem;
		align-items: start;
	}
	@media (max-width: 1100px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
	.wiz-main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}
	.rail {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		position: sticky;
		top: 1rem;
	}
	.rail-chain {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.rail-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: space-between;
	}
	.rail-row.rail-pend {
		opacity: 0.35;
	}
	.rail-sep {
		padding-top: 0.4rem;
		border-top: 1px dashed var(--border);
	}
	.rail-k {
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.rail-v {
		display: inline-flex;
		align-items: center;
	}
	.rail-t {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--mono);
		font-size: 0.64rem;
		color: var(--fg-muted);
	}
	.rail-dash {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
	}
	.rail-verdict {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.2rem;
		padding: 0.35rem 0.5rem;
		border-radius: 5px;
		border: 1px solid color-mix(in srgb, var(--palette-emerald) 40%, transparent);
		background: color-mix(in srgb, var(--palette-emerald) 8%, transparent);
		color: var(--palette-emerald-l, #34d399);
		font-family: var(--mono);
		font-size: 0.58rem;
		line-height: 1.35;
	}
	.rail-verdict.rv-warn {
		border-color: color-mix(in srgb, var(--palette-amber) 50%, transparent);
		background: color-mix(in srgb, var(--palette-amber) 8%, transparent);
		color: var(--palette-amber);
	}
	.rail-verdict.rv-bad {
		border-color: color-mix(in srgb, var(--palette-red) 50%, transparent);
		background: color-mix(in srgb, var(--palette-red) 10%, transparent);
		color: var(--palette-red);
	}

	/* Action bar — lives in the modal's footer slot, so no sticky needed */
	.commit {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}
	.commit-hint {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}

	/* Review summary */
	.sum {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.sum-row {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		padding-bottom: 0.5rem;
		border-bottom: 1px dashed var(--border);
	}
	.sum-row:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}
	.sum-k {
		flex-shrink: 0;
		width: 110px;
		font-family: var(--mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.sum-v {
		font-size: 0.76rem;
		color: var(--fg-muted);
		line-height: 1.45;
	}
	.sum-v b {
		color: var(--fg);
	}
	.sum-v b.sum-warn {
		color: var(--palette-amber);
	}
	.sum-v b.sum-bad {
		color: var(--palette-red);
	}
	.blockers {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin-top: 0.3rem;
	}
	.blocker {
		padding: 0;
		border: 0;
		background: none;
		color: var(--fg-muted);
		font-size: 0.7rem;
		text-align: left;
		cursor: pointer;
	}
	.blocker:hover .blocker-go {
		color: var(--accent);
	}
	.blocker-go {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}

	.toast {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--accent);
		border-radius: 8px;
		background: var(--bg-elev);
		box-shadow: var(--shadow-card);
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--accent);
	}

	.stat-strip {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.75rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-raised);
		margin-bottom: 1.1rem;
	}
	.stat {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.stat-k {
		font-family: var(--mono);
		font-size: 0.64rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.stat-v {
		font-family: var(--mono);
		font-size: 0.95rem;
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}
	.stat-v.hue {
		color: rgb(var(--h));
	}
	.matrix-toggle {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg);
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.62rem;
		cursor: pointer;
	}
	.matrix-toggle:hover {
		border-color: var(--border-strong);
		color: var(--fg);
	}

	.matrix-wrap {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-bottom: 1.1rem;
	}
	@media (max-width: 860px) {
		.matrix-wrap {
			grid-template-columns: 1fr;
		}
	}
	.matrix {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		padding: 0.8rem 0.9rem;
	}
	.matrix-t {
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.matrix-sub {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
		margin-bottom: 0.5rem;
	}
	.matrix table {
		border-collapse: separate;
		border-spacing: 2px;
	}
	.matrix th {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
		font-weight: 400;
		width: 30px;
	}
	.matrix td {
		width: 30px;
		height: 20px;
		text-align: center;
		border-radius: 3px;
		border: 1px solid rgb(var(--h) / 0.4);
		background: rgb(var(--h) / 0.12);
		color: rgb(var(--h));
		font-family: var(--mono);
		font-size: 0.55rem;
	}

	.edit-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: color-mix(in srgb, var(--fg) 2%, transparent);
		padding: 1.05rem 1.15rem 1.15rem;
	}
	.edit-card-head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-dim);
		margin-bottom: 0.85rem;
	}
	.edit-card-count {
		margin-left: auto;
		color: var(--accent);
		letter-spacing: 0.04em;
		text-transform: none;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.field-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--mono);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.err {
		display: inline-flex;
		align-items: flex-start;
		gap: 0.3rem;
		font-family: var(--mono);
		font-size: 0.66rem;
		line-height: 1.4;
		color: var(--palette-red);
	}
	.src-note {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.8rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.src-link {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.src-em {
		color: var(--fg-muted);
	}
	.src-late {
		color: var(--palette-red);
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg);
		color: var(--fg-muted);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.12s;
	}
	.pill:hover {
		border-color: var(--border-strong);
		color: var(--fg);
	}
	.pill-on {
		border-color: var(--accent);
		background: var(--accent-faint);
		color: var(--accent);
	}
	.treat-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.pill-static {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		border: 1px solid rgb(var(--h) / 0.5);
		background: rgb(var(--h) / 0.1);
		color: rgb(var(--h));
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}

	.asset-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.5rem;
	}
	@media (max-width: 620px) {
		.asset-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.asset-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.3rem;
		padding: 0.6rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.12s, background 0.12s;
	}
	.asset-btn:hover {
		border-color: var(--border-strong);
	}
	.asset-on {
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.asset-icon {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 6px;
		color: var(--fg-dim);
		background: var(--surface-strong);
		transition: color 0.12s, background 0.12s;
	}
	.asset-icon-on {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.asset-label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--fg-muted);
	}
	.asset-on .asset-label {
		color: var(--fg);
	}
	.asset-blurb {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
		line-height: 1.2;
	}

	/* ── Data classes & scope ─────────────────────────────────────────────── */
	.dc-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.dc-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg);
		color: var(--fg-muted);
		font-size: 0.74rem;
		cursor: pointer;
		transition: all 0.12s;
	}
	.dc-pill:hover {
		border-color: rgb(var(--h) / 0.6);
		color: var(--fg);
	}
	.dc-on {
		border-color: rgb(var(--h));
		background: rgb(var(--h) / 0.12);
		color: rgb(var(--h));
	}
	.scope-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
	}
	@media (max-width: 620px) {
		.scope-row {
			grid-template-columns: 1fr;
		}
	}
	.scope-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
		color: var(--fg-dim);
		cursor: pointer;
		text-align: left;
		transition: all 0.12s;
	}
	.scope-btn:hover {
		border-color: var(--border-strong);
	}
	.scope-on {
		border-color: var(--accent);
		background: var(--accent-faint);
		color: var(--accent);
	}
	.scope-l {
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--fg-muted);
	}
	.scope-on .scope-l {
		color: var(--fg);
	}
	.scope-b {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}

	/* Suggestion divergence nudge */
	.nudge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.9rem;
		padding: 0.5rem 0.65rem;
		border: 1px dashed var(--border-strong);
		border-radius: 6px;
		color: var(--fg-dim);
		font-size: 0.68rem;
		line-height: 1.4;
	}
	.nudge b {
		color: var(--fg-muted);
	}
	.nudge-btn {
		margin-left: auto;
		flex-shrink: 0;
		padding: 0.2rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		border-radius: 4px;
		background: transparent;
		color: var(--accent);
		font-family: var(--mono);
		font-size: 0.58rem;
		cursor: pointer;
	}
	.nudge-btn:hover {
		background: var(--accent-faint);
	}

	/* Stamped dates */
	.dates {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
	}
	.date-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.date-k {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--fg-dim);
		width: 62px;
	}
	.date-v {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
	}

	.cia-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	@media (max-width: 620px) {
		.cia-grid {
			grid-template-columns: 1fr;
		}
	}
	.cia-btn {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
		color: var(--fg-dim);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.12s, background 0.12s;
	}
	.cia-btn:hover {
		border-color: var(--border-strong);
	}
	.cia-btn-on {
		border-color: var(--accent);
		background: var(--accent-faint);
		color: var(--accent);
	}
	.cia-letter {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: var(--surface-strong);
		font-family: var(--mono);
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--fg-dim);
	}
	.cia-letter-on {
		border-color: var(--accent);
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.cia-text {
		display: flex;
		flex-direction: column;
		margin-right: auto;
	}
	.cia-label {
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--fg-muted);
	}
	.cia-btn-on .cia-label {
		color: var(--fg);
	}
	.cia-blurb {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}

	.scale-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}
	@media (max-width: 620px) {
		.scale-row {
			grid-template-columns: 1fr;
		}
	}
	.scale {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.scale-btns {
		display: flex;
		gap: 0.3rem;
	}
	.scale-btn {
		flex: 1;
		padding: 0.35rem 0;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg);
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.12s;
	}
	.scale-btn.sm {
		padding: 0.2rem 0;
		font-size: 0.6rem;
		min-width: 26px;
	}
	.scale-btn:hover {
		border-color: var(--border-strong);
		color: var(--fg);
	}
	.scale-on {
		border-color: rgb(var(--h));
		background: rgb(var(--h) / 0.14);
		color: rgb(var(--h));
	}
	.scale-on.scale-ghost {
		border-style: dashed;
		background: transparent;
		opacity: 0.6;
	}
	.scale-help {
		font-family: var(--mono);
		font-size: 0.58rem;
		line-height: 1.35;
		color: var(--fg-dim);
	}

	.derive {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.9rem;
		padding-top: 0.8rem;
		border-top: 1px dashed var(--border);
		color: var(--fg-dim);
	}
	.derive-final {
		border-top-color: rgb(var(--h) / 0.5);
	}
	.derive-inline {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 0.35rem;
	}
	.derive-k {
		font-family: var(--mono);
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.derive-note {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}
	.lvl {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		border: 1px solid rgb(var(--h) / 0.55);
		background: rgb(var(--h) / 0.12);
		color: rgb(var(--h));
		font-family: var(--mono);
		font-size: 0.62rem;
		white-space: nowrap;
	}

	/* ── Appetite band ────────────────────────────────────────────────────── */
	.band {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.3rem;
		margin-top: 1rem;
	}
	.band-cell {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.5rem 0.6rem;
		border-radius: 6px;
		border: 1px solid rgb(var(--h) / 0.4);
		background: rgb(var(--h) / 0.08);
	}
	.band-cell.exception {
		border-style: dashed;
	}
	.band-cell.never {
		background: rgb(var(--h) / 0.16);
		border-width: 2px;
	}
	.band-l {
		font-size: 0.72rem;
		font-weight: 600;
		color: rgb(var(--h));
	}
	.band-s {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}

	.ovr-grid {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.ovr-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
	}
	.ovr-set {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.ovr-asset {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		width: 150px;
		font-size: 0.74rem;
		color: var(--fg-muted);
	}
	.ovr-scale {
		display: flex;
		gap: 0.25rem;
	}
	.ovr-inherit {
		margin-left: auto;
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}

	.cadence-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.5rem;
	}
	@media (max-width: 860px) {
		.cadence-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.cadence {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.5rem 0.55rem;
		border: 1px solid rgb(var(--h) / 0.35);
		border-radius: 6px;
		background: rgb(var(--h) / 0.06);
	}
	.cadence-l {
		font-size: 0.7rem;
		font-weight: 600;
		color: rgb(var(--h));
	}
	.cadence-n {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}

	/* ── Treatment / status ───────────────────────────────────────────────── */
	.treat-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.4rem;
	}
	@media (max-width: 620px) {
		.treat-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.treat-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
		color: var(--fg-dim);
		cursor: pointer;
		text-align: left;
		transition: all 0.12s;
	}
	.treat-btn:hover:not(:disabled) {
		border-color: var(--border-strong);
	}
	.treat-on {
		border-color: var(--accent);
		background: var(--accent-faint);
		color: var(--accent);
	}
	.treat-blocked {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.treat-l {
		font-size: 0.76rem;
		font-weight: 600;
		color: var(--fg-muted);
	}
	.treat-on .treat-l {
		color: var(--fg);
	}
	.treat-b {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	.undecide {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.4rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.58rem;
		cursor: pointer;
	}
	.undecide:hover {
		color: var(--fg-muted);
	}

	.gate {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.6rem 0.7rem;
		margin-bottom: 0.9rem;
		border: 1px solid color-mix(in srgb, var(--palette-amber) 50%, transparent);
		border-left-width: 2px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--palette-amber) 8%, transparent);
		color: var(--fg-muted);
		font-size: 0.7rem;
		line-height: 1.45;
	}
	.gate :global(svg) {
		color: var(--palette-amber);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.track {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.25rem;
		color: var(--fg-dim);
	}
	.track-step {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg);
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.62rem;
		cursor: pointer;
		transition: all 0.12s;
	}
	.track-step:hover:not(:disabled) {
		border-color: var(--border-strong);
		color: var(--fg);
	}
	.track-on {
		border-color: rgb(var(--h));
		background: rgb(var(--h) / 0.14);
		color: rgb(var(--h));
	}
	.track-gated {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ── Reminder preview ─────────────────────────────────────────────────── */
	.rem-preview {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.9rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
		color: var(--fg-dim);
		font-size: 0.7rem;
		line-height: 1.45;
	}
	.rem-preview b {
		color: var(--fg-muted);
	}
	.rem-icon {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: 6px;
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	/* ── Tracker connections / route ──────────────────────────────────────── */
	.conn-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	@media (max-width: 860px) {
		.conn-grid {
			grid-template-columns: 1fr;
		}
	}
	.conn,
	.route {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
	}
	.conn-icon,
	.route-icon {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		border-radius: 6px;
		color: var(--fg-muted);
		background: var(--surface-strong);
	}
	.conn-body,
	.route-body {
		min-width: 0;
		flex: 1;
	}
	.conn-top,
	.route-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.conn-label,
	.route-spot {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--fg);
	}
	.route-key {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		border-radius: 3px;
		padding: 0 0.25rem;
	}
	.conn-meta,
	.route-meta {
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-dim);
		margin-top: 0.15rem;
	}
	.conn-err {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--palette-amber);
		margin-top: 0.2rem;
	}

	.rule-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.rule {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--bg);
		color: var(--fg-dim);
	}
	.rule-default {
		border-style: dashed;
		background: transparent;
	}
	.rule-n {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		border-radius: 4px;
		background: var(--surface-strong);
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.rule-match {
		min-width: 0;
		width: 40%;
	}
	.rule-when {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-dim);
	}
	.rule-cond {
		display: block;
		font-size: 0.76rem;
		color: var(--fg-muted);
	}
	.rule-dest {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}
	.rule-dest-icon {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		border-radius: 5px;
		color: var(--fg-muted);
		background: var(--surface-strong);
	}
	.rule-dest-spot {
		font-size: 0.76rem;
		color: var(--fg);
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.rule-dest-key {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--accent);
	}
	.rule-dest-conn {
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
	}
	.rule-actions {
		display: flex;
		gap: 0.2rem;
		margin-left: auto;
	}

	.ovr-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.7rem;
	}
	.ovr-note {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
	}
	.file-note {
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
		margin-left: auto;
	}

	/* ── Table cells ──────────────────────────────────────────────────────── */
	.rid {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	.rtitle {
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--fg);
		line-height: 1.25;
	}
	.rdesc {
		font-size: 0.62rem;
		color: var(--fg-dim);
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.blast-cell {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.assets-cell {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.dc-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
	}
	.dc-tag {
		padding: 0 0.25rem;
		border-radius: 3px;
		border: 1px solid rgb(var(--h) / 0.45);
		background: rgb(var(--h) / 0.1);
		color: rgb(var(--h));
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.scope-tag {
		padding: 0 0.25rem;
		border-radius: 3px;
		border: 1px dashed var(--border-strong);
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.asset-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.64rem;
		color: var(--fg-muted);
		white-space: nowrap;
	}
	.cia-dot {
		display: grid;
		place-items: center;
		width: 19px;
		height: 19px;
		border-radius: 4px;
		border: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.58rem;
		color: var(--fg-dim);
		opacity: 0.4;
	}
	.cia-on {
		opacity: 1;
		border-color: var(--accent);
		background: var(--accent-faint);
		color: var(--accent);
		font-weight: 600;
	}
	.chain-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--fg-dim);
		white-space: nowrap;
	}
	.chain-in {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.1rem 0.3rem;
		border: 1px dashed var(--border);
		border-radius: 4px;
	}
	.chain-in b,
	.chain-mid {
		font-family: var(--mono);
		font-size: 0.6rem;
		font-weight: 600;
		color: rgb(var(--h));
	}
	.chain-in i,
	.chain-x {
		font-family: var(--mono);
		font-size: 0.5rem;
		font-style: normal;
		color: var(--fg-dim);
	}
	.chain-mid {
		display: inline-grid;
		place-items: center;
		min-width: 20px;
		height: 18px;
		border-radius: 3px;
		border: 1px solid rgb(var(--h) / 0.45);
		background: rgb(var(--h) / 0.12);
	}
	.res-cell {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		align-items: flex-start;
	}
	.res-top {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.res-drop {
		display: inline-flex;
		align-items: center;
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--palette-emerald-l, #34d399);
	}
	.appetite-flag {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0 0.25rem;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--palette-amber) 45%, transparent);
		color: var(--palette-amber);
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.appetite-flag.tol {
		border-color: color-mix(in srgb, var(--palette-red) 55%, transparent);
		background: color-mix(in srgb, var(--palette-red) 10%, transparent);
		color: var(--palette-red);
	}
	.owner-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}
	.owner-n {
		font-size: 0.72rem;
		color: var(--fg-muted);
		line-height: 1.15;
	}
	.owner-r {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	.ts-cell {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		align-items: flex-start;
	}
	.ts-treat {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	.ts-until {
		font-family: var(--mono);
		font-size: 0.5rem;
		color: var(--palette-amber);
	}
	.rev-cell {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		align-items: flex-start;
	}
	.rev-last {
		font-family: var(--mono);
		font-size: 0.66rem;
		color: var(--fg-muted);
	}
	.rev-due {
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--fg-dim);
	}
	.rev-late {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-family: var(--mono);
		font-size: 0.55rem;
		color: var(--palette-red);
	}
	.rev-rem {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-family: var(--mono);
		font-size: 0.5rem;
		color: var(--accent);
	}
	.issue-link,
	.issue-pending {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-family: var(--mono);
		font-size: 0.66rem;
		white-space: nowrap;
	}
	.issue-link {
		color: var(--accent);
	}
	.issue-link:hover {
		text-decoration: underline;
	}
	.issue-pending {
		color: var(--fg-dim);
	}
	.ovr {
		font-size: 0.5rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--palette-amber);
		border: 1px solid color-mix(in srgb, var(--palette-amber) 45%, transparent);
		border-radius: 3px;
		padding: 0 0.2rem;
	}
	.ovr.pend {
		color: var(--fg-dim);
		border-color: var(--border);
	}
</style>
