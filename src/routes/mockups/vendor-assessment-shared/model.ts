// Shared mock model for the three vendor-assessment layout directions.
// Keeps data, types, and the (mock) findings/scoring logic identical across
// the cockpit / split / focus mockups so they can be compared fairly.

export type AnswerType =
	| 'yes_no'
	| 'yes_no_partial'
	| 'single_select'
	| 'multi_select'
	| 'integer'
	| 'free_text';
export type Severity = 'critical' | 'warning' | 'info';
export type Verdict = 'approved' | 'flagged' | 'needs_info';
export type Status = 'in_progress' | 'in_review' | 'approved';

export interface Opt {
	label: string;
	value: string;
	risk_weight: number;
}
export interface Cond {
	when: string;
	severity: Severity;
	text: string;
}
export interface Q {
	id: string;
	prompt: string;
	answer_type: AnswerType;
	options?: Opt[];
	guidance?: { text: string; references: { label: string }[] };
	hint?: string;
	tags?: string[];
	required: boolean;
	weight: number;
	conditional?: Cond[];
}
export interface Section {
	id: string;
	title: string;
	guidance?: string;
	questions: Q[];
}
export interface Finding {
	severity: Severity;
	text: string;
}
export interface Answer {
	id: string;
	value: string;
	note?: string;
	/** Ids of evidence cited on this answer. Evidence itself lives in the org
	 *  library, not on the answer row. */
	evidence_ids?: string[];
	findings?: Finding[];
}

// SubmitGate is the per-template policy for what blocks advancing an assessment
// from in_progress → in_review. Answering every required question is always
// enforced. The score and critical-findings gates are opt-in: a vendor risk
// assessment leaves them off (a vendor with weak security can still submit — the
// low answers just surface as findings), while an assessment like awareness
// training turns `score` on to hard-block submission until the pass threshold is
// met. In the real model this lives on ScoringConfig (internal/assessment).
export interface SubmitGate {
	required: boolean; // must answer all required questions (always true)
	score: boolean; // must reach pass_threshold to submit
	criticals: boolean; // must resolve open critical findings to submit
}

export const VENDOR_NAME = 'Northwind Data';
export const TEMPLATE = {
	id: 'vra-v1',
	name: 'Vendor Risk Assessment',
	version: '1.0',
	topic: 'vendor',
	description:
		'Standard third-party vendor risk assessment covering encryption, access control, incident response, sub-processors, and vulnerability management. Maps to SOC 2 Type II, ISO 27001:2022, and GDPR.',
	pass_threshold: 0.75,
	// Vendor default: only required-completion is enforced. Score and criticals
	// are advisory (surfaced, not blocking). Flip `score` on for a pass/fail
	// assessment like awareness training.
	gate: { required: true, score: false, criticals: false } as SubmitGate
};

const encTable: Opt[] = [
	{ label: 'AES-256', value: 'aes256', risk_weight: 1.0 },
	{ label: 'AES-128', value: 'aes128', risk_weight: 0.7 },
	{ label: '3DES', value: '3des', risk_weight: 0.3 },
	{ label: 'None / Unknown', value: 'none', risk_weight: 0.0 }
];
const mfaTable: Opt[] = [
	{ label: 'Hardware / FIDO2', value: 'fido2', risk_weight: 1.0 },
	{ label: 'TOTP app', value: 'totp', risk_weight: 0.8 },
	{ label: 'SMS', value: 'sms', risk_weight: 0.4 },
	{ label: 'None', value: 'none', risk_weight: 0.0 }
];

export const SECTIONS: Section[] = [
	{
		id: 'encryption',
		title: 'Encryption & Data',
		guidance:
			'How the vendor protects customer data at rest and in transit. Answers should reflect production systems.',
		questions: [
			{
				id: 'enc-001',
				prompt: 'What encryption standard is used for data at rest?',
				answer_type: 'single_select',
				options: encTable,
				required: true,
				weight: 2,
				tags: ['encryption', 'soc2', 'iso27001'],
				guidance: {
					text: 'All PII and confidential data must be encrypted at rest with an approved algorithm.',
					references: [{ label: 'SOC 2 CC6.1' }, { label: 'ISO 27001 A.10.1.1' }]
				},
				conditional: [
					{ when: 'none', severity: 'critical', text: 'No encryption at rest is a critical finding. Cannot advance until remediated.' },
					{ when: '3des', severity: 'warning', text: '3DES is deprecated. Migrate to AES-256.' }
				]
			},
			{
				id: 'enc-002',
				prompt: 'Is data encrypted in transit with TLS 1.2 or higher?',
				answer_type: 'yes_no_partial',
				required: true,
				weight: 2,
				tags: ['encryption', 'soc2'],
				conditional: [{ when: 'no', severity: 'critical', text: 'Unencrypted transit is a critical finding.' }]
			},
			{
				id: 'enc-003',
				prompt: 'Describe your key-management and rotation practice.',
				answer_type: 'free_text',
				required: false,
				weight: 1,
				tags: ['key-management']
			}
		]
	},
	{
		id: 'access-control',
		title: 'Access Control',
		guidance: 'Identity and access management controls. Strong MFA and least-privilege are foundational.',
		questions: [
			{
				id: 'ac-001',
				prompt: 'What is the strongest MFA method enforced for admin access?',
				answer_type: 'single_select',
				options: mfaTable,
				required: true,
				weight: 2,
				tags: ['access-control', 'mfa', 'soc2'],
				conditional: [
					{ when: 'none', severity: 'critical', text: 'No MFA on admin access is a critical finding.' },
					{ when: 'sms', severity: 'warning', text: 'SMS MFA is phishable. Prefer TOTP or FIDO2.' }
				]
			},
			{
				id: 'ac-002',
				prompt: 'Is role-based access control (RBAC) enforced?',
				answer_type: 'yes_no_partial',
				required: true,
				weight: 1.5,
				tags: ['rbac', 'iso27001']
			}
		]
	},
	{
		id: 'incident-response',
		title: 'Incident Response',
		guidance: 'A tested IR plan and defined breach-notification SLA are contractual and regulatory requirements.',
		questions: [
			{
				id: 'ir-001',
				prompt: 'Is there a documented, tested incident response plan?',
				answer_type: 'yes_no_partial',
				required: true,
				weight: 2,
				tags: ['incident-response', 'soc2']
			},
			{
				id: 'ir-002',
				prompt: 'Breach notification SLA to customers (hours)?',
				answer_type: 'integer',
				required: false,
				weight: 1,
				tags: ['gdpr'],
				conditional: [{ when: '__gt72', severity: 'warning', text: 'GDPR Art. 33 requires notification within 72 hours.' }]
			}
		]
	},
	{
		id: 'subprocessors',
		title: 'Sub-processors',
		guidance: 'Under GDPR Art. 28, processors must engage sub-processors only with written authorisation.',
		questions: [
			{
				id: 'sub-001',
				prompt: 'Is a current sub-processor list maintained and published?',
				answer_type: 'yes_no',
				required: true,
				weight: 1,
				tags: ['subprocessors', 'gdpr']
			},
			{
				id: 'sub-002',
				prompt: 'Where is customer data physically stored (data residency)?',
				answer_type: 'single_select',
				options: [
					{ label: 'Customer region only', value: 'region', risk_weight: 1.0 },
					{ label: 'Global with DPA', value: 'global-dpa', risk_weight: 0.7 },
					{ label: 'Unspecified', value: 'unspecified', risk_weight: 0.2 }
				],
				required: true,
				weight: 1.5,
				tags: ['data-residency', 'gdpr']
			}
		]
	},
	{
		id: 'vuln-management',
		title: 'Vulnerability Mgmt',
		guidance: 'Effective vulnerability management reduces the window between discovery and remediation.',
		questions: [
			{
				id: 'vuln-001',
				prompt: 'Is annual third-party penetration testing performed?',
				answer_type: 'yes_no',
				required: true,
				weight: 1.5,
				tags: ['pentest', 'soc2']
			},
			{
				id: 'vuln-002',
				prompt: 'Critical-CVE patch SLA (days)?',
				answer_type: 'integer',
				required: false,
				weight: 1,
				conditional: [{ when: '__gt30', severity: 'warning', text: 'Critical CVEs should be patched within 30 days.' }]
			}
		]
	}
];

export const ALL_Q: Q[] = SECTIONS.flatMap((s) => s.questions);
export const REQUIRED: Q[] = ALL_Q.filter((q) => q.required);

export function evalFindings(q: Q, value: string): Finding[] {
	if (!q.conditional || !value) return [];
	const out: Finding[] = [];
	for (const c of q.conditional) {
		let hit = false;
		if (c.when === '__gt72') hit = Number(value) > 72;
		else if (c.when === '__gt30') hit = Number(value) > 30;
		else hit = value.split(',').includes(c.when);
		if (hit) out.push({ severity: c.severity, text: c.text });
	}
	return out;
}

export function qualityOf(q: Q, value: string): number {
	if (!value) return 0;
	if (q.options) {
		const vals = value.split(',');
		const weights = vals
			.map((v) => q.options!.find((o) => o.value === v)?.risk_weight ?? 0)
			.filter((n) => !Number.isNaN(n));
		return weights.length ? Math.max(...weights) : 0;
	}
	if (q.answer_type === 'yes_no') return value === 'yes' ? 1 : 0;
	if (q.answer_type === 'yes_no_partial') return value === 'yes' ? 1 : value === 'partial' ? 0.5 : 0;
	return 1;
}
