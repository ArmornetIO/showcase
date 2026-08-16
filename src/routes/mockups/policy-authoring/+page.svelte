<script lang="ts">
	// ── Mockup: Policy Import → Markdown Authoring → Assessment Evidence Linking ──
	//
	// Three phases on one surface. An org brings in a policy it already wrote
	// (Word/PDF/markdown), edits it as a *document* rather than as markdown, and
	// then wires precise parts of it to an assessment as evidence.
	//
	//   1. Import  — drop a .docx / .pdf / .md. The backend converts to markdown
	//                and hands it straight back. NOTHING IS PERSISTED at this
	//                point (see "Backend notes" below) — the markdown lives in
	//                the browser until the user explicitly saves.
	//   2. Edit    — the beef. A WYSIWYG markdown editor with a deliberately
	//                small toolbar (see TOOLBAR_RATIONALE) plus "clause anchors",
	//                the addressable spans phase 3 links against.
	//   3. Link    — attach a whole policy, a clause anchor, or a pinned version
	//                to an assessment question, to a specific selected answer, or
	//                to a note/evidence item. Backed by an evidence browser modal.
	//
	// ── Backend notes (NOT built — this mockup is UI only) ──────────────────────
	//
	// Conversion is stateless and hold-nothing. The contract we want:
	//
	//   POST /api/policies/convert        multipart: file
	//        → { markdown, source: { filename, mime, bytes, sha256 },
	//            warnings: [{ code, detail }] }
	//        Converts in-process, returns markdown, writes NOTHING to the DB or
	//        to disk. The uploaded bytes are discarded when the request ends.
	//        The browser is the only holder of the document until step 2 below.
	//
	//   POST /api/policies                { title, markdown, source, anchors[] }
	//        → { policy_id, version, created_at }
	//        The first write. The client re-sends the (possibly edited) markdown
	//        it has been holding. This is the ONLY endpoint that persists.
	//
	//   POST /api/policies/:id/versions   { markdown, anchors[], note }
	//        → { version, created_at }   — immutable; versions are never edited.
	//
	// Why hold client-side: a policy is the customer's most sensitive prose. If
	// they abandon the import we should have nothing to delete. It also means a
	// failed conversion costs us no cleanup. Trade-off to accept: a browser
	// crash loses the edit session — mitigate with a localStorage draft keyed by
	// source sha256, NOT a server-side draft row.
	//
	// Conversion library is an open decision (all add a dependency, so it needs
	// sign-off): docx → goldmark-compatible md, pdf → text extraction + heading
	// inference. PDF fidelity will be poor for anything but simple layouts; the
	// `warnings` array exists so the UI can say so honestly (see IMPORT_WARNINGS).
	//
	// Editor core is also an open decision: this mockup hand-rolls contenteditable
	// + execCommand, which is fine for a demo but not for production. A real build
	// picks between hand-rolling a block model or taking a dependency.
	//
	// ── Data shapes (fake data below mirrors these) ────────────────────────────
	//
	//   Policy        { policy_id, org_id, title, status, current_version,
	//                   created_at, updated_at }
	//   PolicyVersion { policy_id, version, markdown, anchors[], note, created_at }
	//   ClauseAnchor  { anchor_id, label, block_ids[], excerpt }
	//                 — stable id so a link survives edits to surrounding prose.
	//   EvidenceLink  { link_id, assessment_id, target_kind, target_id,
	//                   policy_id, scope, ref, created_by, created_at }
	//                 target_kind ∈ { question, answer, note }
	//                 scope       ∈ { document, clause, version }
	//                 ref         — anchor_id when scope=clause, version when
	//                               scope=version, null when scope=document.
	//
	//   POST   /api/assessments/:id/evidence-links   { target_kind, target_id, … }
	//   DELETE /api/assessments/:id/evidence-links/:link_id
	//   GET    /api/policies/:id/anchors             → ClauseAnchor[]

	import Icon, { type IconName } from '$lib/icons/Icon.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import Chip from '$lib/primitives/Chip.svelte';
	import Select from '$lib/primitives/Select.svelte';
	import FileUpload from '$lib/primitives/FileUpload.svelte';
	import SearchInput from '$lib/primitives/SearchInput.svelte';
	import EmptyState from '$lib/primitives/EmptyState.svelte';
	import SegmentGroup from '$lib/primitives/SegmentGroup.svelte';
	import Panel from '$lib/layout/Panel.svelte';
	import Modal from '$lib/layout/Modal.svelte';
	import SteppedProgress from '$lib/display/progress/SteppedProgress.svelte';

	// ══ Phase machine ═══════════════════════════════════════════════════════════

	const PHASES = ['Import', 'Edit', 'Link Evidence'];
	let step = $state(1); // start on Edit — it's the piece under design review
	let furthest = $state(2);

	function goStep(i: number) {
		if (i < 0 || i >= PHASES.length) return;
		if (i > furthest) furthest = i;
		step = i;
	}

	// ══ Phase 1 — Import ════════════════════════════════════════════════════════

	type ImportPhase = 'idle' | 'converting' | 'ready';
	let importPhase = $state<ImportPhase>('ready');
	let uploadValue = $state('');
	let uploadFilename = $state('');

	const SOURCE = {
		filename: 'InfoSec-Policy-v4.docx',
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		bytes: 148_320,
		sha256: '9f2c…a41b'
	};

	// Surfaced from the converter so we never overstate fidelity.
	const IMPORT_WARNINGS = [
		{ code: 'table_flattened', detail: '1 nested table flattened to a single-level table (§4.2)' },
		{ code: 'style_dropped', detail: 'Custom character styles dropped — markdown has no equivalent' }
	];

	const ACCEPTED = '.docx,.pdf,.md,.markdown';

	function runConvert() {
		importPhase = 'converting';
		// Stubbed: POST /api/policies/convert → { markdown, source, warnings }
		setTimeout(() => {
			importPhase = 'ready';
		}, 900);
	}

	// ══ Phase 2 — The editor ════════════════════════════════════════════════════
	//
	// Design position: an org edits a *policy*, not a markdown file. Every control
	// below exists because it maps 1:1 onto a markdown construct they'd otherwise
	// have to hand-type. Anything with no markdown representation is omitted on
	// purpose — see TOOLBAR_RATIONALE. Escape hatch: the Markdown source toggle,
	// for the minority who do want the raw text.

	type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'quote' | 'code';
	type Block = { id: string; type: BlockType; html: string; indent: number };

	const BLOCK_OPTIONS = [
		{ value: 'p', label: 'Paragraph' },
		{ value: 'h1', label: 'Heading 1' },
		{ value: 'h2', label: 'Heading 2' },
		{ value: 'h3', label: 'Heading 3' },
		{ value: 'ul', label: 'Bulleted list' },
		{ value: 'ol', label: 'Numbered list' },
		{ value: 'quote', label: 'Quote' },
		{ value: 'code', label: 'Code block' }
	];

	let nextId = 100;
	const uid = (p: string) => `${p}-${nextId++}`;

	let blocks = $state<Block[]>([
		{ id: 'b-1', type: 'h1', html: 'Information Security Policy', indent: 0 },
		{
			id: 'b-2',
			type: 'p',
			html: 'This policy establishes how <strong>Acme Corp</strong> protects the confidentiality, integrity, and availability of information assets it owns or processes on behalf of customers.',
			indent: 0
		},
		{ id: 'b-3', type: 'h2', html: '4.1 Access Control', indent: 0 },
		{
			id: 'b-4',
			type: 'p',
			html: 'Access to production systems is granted on a <em>least-privilege</em> basis and reviewed quarterly by the system owner.',
			indent: 0
		},
		{ id: 'b-5', type: 'ul', html: 'All access requests are recorded in the ticketing system.', indent: 0 },
		{ id: 'b-6', type: 'ul', html: 'Standing production access is prohibited; access is time-boxed to 8 hours.', indent: 0 },
		{ id: 'b-7', type: 'ul', html: 'Break-glass accounts require two-person approval.', indent: 1 },
		{ id: 'b-8', type: 'h2', html: '4.2 Encryption', indent: 0 },
		{
			id: 'b-9',
			type: 'p',
			html: 'Data at rest is encrypted with <code>AES-256-GCM</code>. Data in transit uses TLS 1.2 or higher.',
			indent: 0
		},
		{
			id: 'b-10',
			type: 'quote',
			html: 'Exceptions require written approval from the CISO and expire after 90 days.',
			indent: 0
		}
	]);

	let focusedBlockId = $state<string | null>('b-4');
	const blockEls = new Map<string, HTMLElement>();

	const focusedBlock = $derived(blocks.find((b) => b.id === focusedBlockId) ?? null);
	const focusedIsList = $derived(focusedBlock?.type === 'ul' || focusedBlock?.type === 'ol');

	/**
	 * Paints a block's HTML into its contenteditable host once, and re-paints on
	 * external change — but never while the node has focus, which would collapse
	 * the caret to position 0 on every keystroke.
	 */
	function editable(node: HTMLElement, initial: string) {
		node.innerHTML = initial;
		return {
			update(next: string) {
				if (document.activeElement !== node && node.innerHTML !== next) node.innerHTML = next;
			}
		};
	}

	function registerEl(node: HTMLElement, id: string) {
		blockEls.set(id, node);
		return { destroy: () => blockEls.delete(id) };
	}

	function syncFromDom(id: string) {
		const el = blockEls.get(id);
		const b = blocks.find((x) => x.id === id);
		if (el && b) b.html = el.innerHTML;
	}

	function setBlockType(type: string) {
		if (!focusedBlock) return;
		focusedBlock.type = type as BlockType;
		if (type !== 'ul' && type !== 'ol') focusedBlock.indent = 0;
	}

	function shiftIndent(delta: number) {
		if (!focusedBlock || !focusedIsList) return;
		focusedBlock.indent = Math.max(0, Math.min(3, focusedBlock.indent + delta));
	}

	// Inline marks. execCommand is deprecated but still the shortest honest path
	// to a working demo; a production build replaces this (see backend notes).
	function exec(cmd: string, arg?: string) {
		const id = focusedBlockId;
		if (!id) return;
		blockEls.get(id)?.focus();
		document.execCommand(cmd, false, arg);
		syncFromDom(id);
	}

	function wrapSelection(open: string, close: string) {
		const id = focusedBlockId;
		if (!id) return;
		const sel = window.getSelection();
		const text = sel?.toString() ?? '';
		if (!text) return;
		document.execCommand('insertHTML', false, `${open}${text}${close}`);
		syncFromDom(id);
	}

	let linkOpen = $state(false);
	let linkUrl = $state('https://');
	let linkLabel = $state('');

	function openLinkPopover() {
		const sel = window.getSelection()?.toString() ?? '';
		linkLabel = sel;
		linkUrl = 'https://';
		linkOpen = true;
	}

	function applyLink() {
		if (linkLabel) wrapSelection(`<a href="${linkUrl}">`, '</a>');
		linkOpen = false;
	}

	function insertRule() {
		if (!focusedBlockId) return;
		const i = blocks.findIndex((b) => b.id === focusedBlockId);
		blocks.splice(i + 1, 0, { id: uid('b'), type: 'p', html: '---', indent: 0 });
	}

	function insertTable() {
		if (!focusedBlockId) return;
		const i = blocks.findIndex((b) => b.id === focusedBlockId);
		blocks.splice(i + 1, 0, {
			id: uid('b'),
			type: 'code',
			html: '| Control | Owner | Frequency |\n| --- | --- | --- |\n| Access review | Sys owner | Quarterly |',
			indent: 0
		});
	}

	// ── Clause anchors ────────────────────────────────────────────────────────
	// The bridge to phase 3. An anchor is a stable id over a span of the policy,
	// so an assessment link keeps pointing at the right clause after the prose
	// around it is edited.

	type ClauseAnchor = { anchor_id: string; label: string; block_ids: string[]; excerpt: string };

	let anchors = $state<ClauseAnchor[]>([
		{
			anchor_id: 'CLS-001',
			label: 'Quarterly access review',
			block_ids: ['b-4'],
			excerpt: 'Access to production systems is granted on a least-privilege basis and reviewed quarterly…'
		},
		{
			anchor_id: 'CLS-002',
			label: 'Encryption at rest',
			block_ids: ['b-9'],
			excerpt: 'Data at rest is encrypted with AES-256-GCM. Data in transit uses TLS 1.2 or higher.'
		}
	]);

	let anchorDraft = $state('');
	let anchorPending = $state<string | null>(null);

	function startAnchor() {
		const sel = window.getSelection()?.toString() ?? '';
		if (!sel.trim()) return;
		anchorPending = sel.trim();
		anchorDraft = '';
	}

	function commitAnchor() {
		if (!anchorPending || !anchorDraft.trim() || !focusedBlockId) return;
		const id = `CLS-${String(anchors.length + 1).padStart(3, '0')}`;
		anchors.push({
			anchor_id: id,
			label: anchorDraft.trim(),
			block_ids: [focusedBlockId],
			excerpt: anchorPending.slice(0, 110)
		});
		anchorPending = null;
		anchorDraft = '';
	}

	// ── Markdown serialisation (the escape hatch + what we'd POST) ─────────────

	function nodeToMd(node: Node): string {
		if (node.nodeType === 3) return node.textContent ?? '';
		if (node.nodeType !== 1) return '';
		const el = node as HTMLElement;
		const inner = Array.from(el.childNodes).map(nodeToMd).join('');
		switch (el.tagName.toLowerCase()) {
			case 'strong':
			case 'b':
				return `**${inner}**`;
			case 'em':
			case 'i':
				return `*${inner}*`;
			case 'code':
				return `\`${inner}\``;
			case 's':
			case 'strike':
			case 'del':
				return `~~${inner}~~`;
			case 'a':
				return `[${inner}](${el.getAttribute('href') ?? ''})`;
			case 'br':
				return '\n';
			default:
				return inner;
		}
	}

	function inlineToMd(html: string): string {
		if (typeof document === 'undefined') return html;
		const host = document.createElement('div');
		host.innerHTML = html;
		return Array.from(host.childNodes).map(nodeToMd).join('');
	}

	const markdown = $derived.by(() => {
		const out: string[] = [];
		let inFence = false;
		for (const b of blocks) {
			const text = inlineToMd(b.html);
			if (b.type === 'code') {
				if (!inFence) {
					out.push('```');
					inFence = true;
				}
				out.push(text);
				continue;
			}
			if (inFence) {
				out.push('```');
				inFence = false;
			}
			const pad = '  '.repeat(b.indent);
			switch (b.type) {
				case 'h1':
					out.push(`# ${text}`);
					break;
				case 'h2':
					out.push(`## ${text}`);
					break;
				case 'h3':
					out.push(`### ${text}`);
					break;
				case 'ul':
					out.push(`${pad}- ${text}`);
					break;
				case 'ol':
					out.push(`${pad}1. ${text}`);
					break;
				case 'quote':
					out.push(`> ${text}`);
					break;
				default:
					out.push(text);
			}
			out.push('');
		}
		if (inFence) out.push('```');
		return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
	});

	let editorView = $state('rich');
	let rationaleOpen = $state(false);
	let dirty = $state(true);

	// First-principles record. Included = has a markdown representation AND a
	// policy author reaches for it. Excluded = one or both are false. This lives
	// in the mockup on purpose so the reasoning survives design review.
	const TOOLBAR_RATIONALE = {
		included: [
			['Block type', 'One control covers #, ##, ###, -, 1., >, ``` — the whole block grammar.'],
			['Bold / Italic / Strike / Code', 'The four inline marks markdown actually has.'],
			['Link', 'Policies cite standards and internal runbooks constantly.'],
			['Indent / Outdent', 'Nested clause lists are the native shape of a policy.'],
			['Table', 'Control matrices are the one structure orgs will not give up.'],
			['Horizontal rule', 'Section breaks in long policies.'],
			['Clause anchor', 'Not a text feature — the addressable unit assessments link to.']
		],
		excluded: [
			['Font family / size / colour', 'No markdown representation. Rendering is ours to control.'],
			['Alignment, line spacing', 'No markdown representation.'],
			['Highlight colours', 'Would become meaningful state we cannot round-trip.'],
			['Images, footnotes', 'Real needs, but they change the storage model — defer, do not half-build.'],
			['Track changes / comments', 'Versions already give us diffing; comments belong to the assessment thread.']
		]
	};

	// ══ Phase 3 — Assessment evidence linking ═══════════════════════════════════

	type TargetKind = 'question' | 'answer' | 'note';
	type LinkScope = 'document' | 'clause' | 'version';

	type EvidenceLink = {
		link_id: string;
		target_kind: TargetKind;
		target_id: string;
		policy_id: string;
		policy_title: string;
		scope: LinkScope;
		ref: string | null;
		ref_label: string | null;
	};

	type Note = { id: string; author: string; kind: 'note' | 'evidence'; body: string };
	type Question = {
		id: string;
		ref: string;
		prompt: string;
		options: { id: string; label: string }[];
		answer_id: string;
		notes: Note[];
	};

	const QUESTIONS: Question[] = [
		{
			id: 'q-1',
			ref: 'AC-02',
			prompt: 'Is access to production systems reviewed on a defined schedule?',
			options: [
				{ id: 'o-1a', label: 'Yes — quarterly or more often' },
				{ id: 'o-1b', label: 'Yes — annually' },
				{ id: 'o-1c', label: 'No defined schedule' }
			],
			answer_id: 'o-1a',
			notes: [
				{ id: 'n-1', author: 'r.okafor', kind: 'evidence', body: 'Q2 access review export attached; 41 accounts reviewed, 3 revoked.' },
				{ id: 'n-2', author: 'j.lindqvist', kind: 'note', body: 'Reviewer asked whether break-glass accounts are in scope.' }
			]
		},
		{
			id: 'q-2',
			ref: 'CR-07',
			prompt: 'Is customer data encrypted at rest using an industry-standard algorithm?',
			options: [
				{ id: 'o-2a', label: 'Yes — AES-256 or equivalent' },
				{ id: 'o-2b', label: 'Yes — other algorithm' },
				{ id: 'o-2c', label: 'Not encrypted at rest' }
			],
			answer_id: 'o-2a',
			notes: [{ id: 'n-3', author: 'r.okafor', kind: 'note', body: 'Confirm KEK rotation cadence before sign-off.' }]
		},
		{
			id: 'q-3',
			ref: 'IR-01',
			prompt: 'Do you maintain a documented incident response plan?',
			options: [
				{ id: 'o-3a', label: 'Yes — tested in the last 12 months' },
				{ id: 'o-3b', label: 'Yes — untested' },
				{ id: 'o-3c', label: 'No' }
			],
			answer_id: 'o-3b',
			notes: []
		}
	];

	let links = $state<EvidenceLink[]>([
		{
			link_id: 'el-1',
			target_kind: 'answer',
			target_id: 'o-1a',
			policy_id: 'pol-1',
			policy_title: 'Information Security Policy',
			scope: 'clause',
			ref: 'CLS-001',
			ref_label: 'Quarterly access review'
		}
	]);

	let expanded = $state<string | null>('q-1');
	const toggleQ = (id: string) => (expanded = expanded === id ? null : id);
	const linksFor = (kind: TargetKind, id: string) =>
		links.filter((l) => l.target_kind === kind && l.target_id === id);
	const removeLink = (id: string) => (links = links.filter((l) => l.link_id !== id));

	// ── Evidence browser ──────────────────────────────────────────────────────

	type EvidenceSource = 'policies' | 'uploads' | 'assessments';
	type EvidenceItem = {
		id: string;
		title: string;
		meta: string;
		source: EvidenceSource;
		versions?: { version: string; created_at: string; note: string }[];
	};

	const EVIDENCE: EvidenceItem[] = [
		{
			id: 'pol-1',
			title: 'Information Security Policy',
			meta: 'v4 · updated 2026-07-28 · 2 clause anchors',
			source: 'policies',
			versions: [
				{ version: 'v4', created_at: '2026-07-28', note: 'Encryption section rewritten' },
				{ version: 'v3', created_at: '2026-03-11', note: 'Access review cadence → quarterly' },
				{ version: 'v2', created_at: '2025-11-02', note: 'Annual refresh' }
			]
		},
		{
			id: 'pol-2',
			title: 'Incident Response Plan',
			meta: 'v2 · updated 2026-05-02 · 0 clause anchors',
			source: 'policies',
			versions: [
				{ version: 'v2', created_at: '2026-05-02', note: 'Added severity matrix' },
				{ version: 'v1', created_at: '2025-09-14', note: 'Initial' }
			]
		},
		{ id: 'pol-3', title: 'Data Retention Standard', meta: 'v1 · updated 2026-01-19', source: 'policies', versions: [{ version: 'v1', created_at: '2026-01-19', note: 'Initial' }] },
		{ id: 'up-1', title: 'Q2-access-review-export.csv', meta: 'uploaded 2026-07-02 · 41 rows', source: 'uploads' },
		{ id: 'up-2', title: 'pen-test-summary-2026.pdf', meta: 'uploaded 2026-06-11 · 14 pages', source: 'uploads' },
		{ id: 'as-1', title: 'SOC 2 readiness — 2025', meta: 'completed 2025-12-04 · 118 answers', source: 'assessments' }
	];

	const SOURCE_TABS = [
		{ value: 'policies', label: 'Policies' },
		{ value: 'uploads', label: 'Uploads' },
		{ value: 'assessments', label: 'Prior assessments' }
	];

	let browserOpen = $state(false);
	let pendingTarget = $state<{ kind: TargetKind; id: string; label: string } | null>(null);
	let browserSource = $state<EvidenceSource>('policies');
	let browserQuery = $state('');
	let selectedItem = $state<string | null>('pol-1');
	let selectedScope = $state<LinkScope>('clause');
	let selectedRef = $state<string | null>('CLS-001');

	const browserResults = $derived(
		EVIDENCE.filter(
			(e) => e.source === browserSource && e.title.toLowerCase().includes(browserQuery.toLowerCase())
		)
	);
	const activeItem = $derived(EVIDENCE.find((e) => e.id === selectedItem) ?? null);
	const scopeAvailable = $derived(activeItem?.source === 'policies');

	function openBrowser(kind: TargetKind, id: string, label: string) {
		pendingTarget = { kind, id, label };
		browserOpen = true;
	}

	function pickItem(id: string) {
		selectedItem = id;
		const item = EVIDENCE.find((e) => e.id === id);
		if (item?.source !== 'policies') {
			selectedScope = 'document';
			selectedRef = null;
			return;
		}
		selectedScope = 'document';
		selectedRef = null;
	}

	function attach() {
		if (!pendingTarget || !activeItem) return;
		const refLabel =
			selectedScope === 'clause'
				? (anchors.find((a) => a.anchor_id === selectedRef)?.label ?? null)
				: selectedScope === 'version'
					? selectedRef
					: null;
		links.push({
			link_id: uid('el'),
			target_kind: pendingTarget.kind,
			target_id: pendingTarget.id,
			policy_id: activeItem.id,
			policy_title: activeItem.title,
			scope: selectedScope,
			ref: selectedRef,
			ref_label: refLabel
		});
		browserOpen = false;
		pendingTarget = null;
	}

	const SCOPE_ICON: Record<LinkScope, IconName> = {
		document: 'file-text',
		clause: 'flag',
		version: 'git-branch'
	};
	const SCOPE_WORD: Record<LinkScope, string> = {
		document: 'Whole document',
		clause: 'Clause',
		version: 'Version'
	};
</script>

<div class="page">
	<header class="head">
		<div>
			<h1>Policy authoring &amp; evidence linking</h1>
			<p class="sub">
				Import a policy the org already wrote, edit it as a document, then wire precise parts of it
				to an assessment.
			</p>
		</div>
		<Chip look="ghost" color="accent">Mockup · UI only</Chip>
	</header>

	<div class="steps">
		<SteppedProgress
			steps={PHASES}
			current={furthest + 1}
			active={step}
			label="Policy import"
			onstep={(i: number) => goStep(i)}
		/>
	</div>

	<!-- ═══ PHASE 1 — IMPORT ═══════════════════════════════════════════════ -->
	{#if step === 0}
		<div class="grid-2">
			<Panel title="Source document">
				{#snippet icon()}<Icon name="upload" size={14} />{/snippet}
				<div class="pad">
					<p class="lede">
						Upload a <code>.docx</code>, <code>.pdf</code>, or <code>.md</code> file. We convert it
						to markdown and hand it back to your browser.
					</p>

					<FileUpload
						bind:value={uploadValue}
						bind:filename={uploadFilename}
						accept={ACCEPTED}
						placeholder="Drag & drop a policy, or click to browse"
					/>

					<div class="retention">
						<Icon name="shield-check" size={14} />
						<div>
							<strong>Nothing is stored yet.</strong>
							<span>
								Conversion is stateless — the uploaded file is discarded when the request ends, and
								the markdown lives only in this browser tab until you press Save. Abandon the import
								and there is nothing to delete.
							</span>
						</div>
					</div>

					{#if importPhase === 'ready'}
						<div class="file-row">
							<Icon name="file-text" size={16} />
							<div class="fr-main">
								<span class="fr-name">{SOURCE.filename}</span>
								<span class="fr-meta">
									{(SOURCE.bytes / 1024).toFixed(0)} KB · sha256 {SOURCE.sha256}
								</span>
							</div>
							<Chip look="ghost" color="success">Converted</Chip>
						</div>
					{/if}

					<div class="row-end">
						<Button variant="ghost" size="sm" onclick={runConvert} loading={importPhase === 'converting'}>
							Re-run conversion
						</Button>
						<Button size="sm" onclick={() => goStep(1)} disabled={importPhase !== 'ready'}>
							Review markdown →
						</Button>
					</div>
				</div>
			</Panel>

			<Panel title="Conversion report">
				{#snippet icon()}<Icon name="alert-triangle" size={14} />{/snippet}
				<div class="pad">
					{#if importPhase === 'converting'}
						<EmptyState message="Converting…" sub="Parsing document structure and inferring headings" />
					{:else}
						<p class="lede">
							Conversion is lossy by nature. We list what changed rather than pretending the result is
							a faithful copy.
						</p>
						{#each IMPORT_WARNINGS as w (w.code)}
							<div class="warn">
								<Icon name="alert-triangle" size={13} />
								<div>
									<code>{w.code}</code>
									<span>{w.detail}</span>
								</div>
							</div>
						{/each}
						<div class="fidelity">
							<span class="fid-label">Expected fidelity by source</span>
							<div class="fid-row"><Chip look="ghost" color="success">.md</Chip><span>Exact — no conversion</span></div>
							<div class="fid-row"><Chip look="ghost" color="accent">.docx</Chip><span>Good — headings, lists, tables, emphasis survive</span></div>
							<div class="fid-row"><Chip look="ghost" color="warn">.pdf</Chip><span>Poor for complex layouts — headings are inferred, not read</span></div>
						</div>
					{/if}
				</div>
			</Panel>
		</div>
	{/if}

	<!-- ═══ PHASE 2 — EDITOR ═══════════════════════════════════════════════ -->
	{#if step === 1}
		<div class="editor-wrap">
			<div class="editor-col">
				<!-- ── Toolbar ─────────────────────────────────────────────── -->
				<div class="toolbar" role="toolbar" aria-label="Formatting">
					<div class="tb-group">
						<Select
							value={focusedBlock?.type ?? 'p'}
							options={BLOCK_OPTIONS}
							onchange={(e) => setBlockType(e.currentTarget.value)}
						/>
					</div>

					<div class="tb-sep"></div>

					<div class="tb-group">
						<button class="tb-btn" title="Bold (⌘B)" onclick={() => exec('bold')}><b>B</b></button>
						<button class="tb-btn" title="Italic (⌘I)" onclick={() => exec('italic')}><i>I</i></button>
						<button class="tb-btn" title="Strikethrough" onclick={() => exec('strikeThrough')}><s>S</s></button>
						<button class="tb-btn mono" title="Inline code" onclick={() => wrapSelection('<code>', '</code>')}>&lt;/&gt;</button>
						<button class="tb-btn" title="Link" onclick={openLinkPopover}><Icon name="link" size={15} /></button>
					</div>

					<div class="tb-sep"></div>

					<div class="tb-group">
						<button class="tb-btn" title="Outdent" disabled={!focusedIsList} onclick={() => shiftIndent(-1)}>
							<Icon name="chevron-left" size={15} />
						</button>
						<button class="tb-btn" title="Indent" disabled={!focusedIsList} onclick={() => shiftIndent(1)}>
							<Icon name="chevron-right" size={15} />
						</button>
					</div>

					<div class="tb-sep"></div>

					<div class="tb-group">
						<button class="tb-btn" title="Insert table" onclick={insertTable}><Icon name="table-2" size={15} /></button>
						<button class="tb-btn" title="Horizontal rule" onclick={insertRule}><Icon name="minus" size={15} /></button>
					</div>

					<div class="tb-sep"></div>

					<div class="tb-group">
						<button class="tb-btn anchor-btn" title="Anchor selection as a linkable clause" onclick={startAnchor}>
							<Icon name="flag" size={14} /> Anchor clause
						</button>
					</div>

					<div class="tb-spacer"></div>

					<SegmentGroup
						options={[
							{ value: 'rich', label: 'Document' },
							{ value: 'source', label: 'Markdown' }
						]}
						value={editorView}
						onchange={(v) => (editorView = v)}
					/>
				</div>

				{#if linkOpen}
					<div class="popover">
						<span class="pop-label">Link</span>
						<input class="pop-input" bind:value={linkLabel} placeholder="Text" />
						<input class="pop-input" bind:value={linkUrl} placeholder="https://" />
						<Button size="sm" onclick={applyLink}>Apply</Button>
						<Button size="sm" variant="ghost" onclick={() => (linkOpen = false)}>Cancel</Button>
					</div>
				{/if}

				{#if anchorPending}
					<div class="popover accent">
						<Icon name="flag" size={14} />
						<span class="pop-label">Name this clause</span>
						<input class="pop-input wide" bind:value={anchorDraft} placeholder="e.g. Quarterly access review" />
						<Button size="sm" onclick={commitAnchor} disabled={!anchorDraft.trim()}>Create anchor</Button>
						<Button size="sm" variant="ghost" onclick={() => (anchorPending = null)}>Cancel</Button>
					</div>
				{/if}

				<!-- ── Document surface ────────────────────────────────────── -->
				<div class="doc-shell">
					{#if editorView === 'rich'}
						<div class="doc">
							{#each blocks as block (block.id)}
								{@const anchored = anchors.some((a) => a.block_ids.includes(block.id))}
								<div
									class="blk blk-{block.type} {focusedBlockId === block.id ? 'focused' : ''} {anchored ? 'anchored' : ''}"
									style="--indent: {block.indent}"
								>
									{#if block.type === 'ul'}<span class="marker">•</span>{/if}
									{#if block.type === 'ol'}<span class="marker">1.</span>{/if}
									<div
										class="blk-body"
										contenteditable="true"
										role="textbox"
										tabindex="0"
										aria-label="Policy block"
										use:editable={block.html}
										use:registerEl={block.id}
										onfocus={() => (focusedBlockId = block.id)}
										oninput={() => syncFromDom(block.id)}
									></div>
									{#if anchored}
										<span class="anchor-tag">
											<Icon name="flag" size={11} />
											{anchors.find((a) => a.block_ids.includes(block.id))?.anchor_id}
										</span>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<pre class="src">{markdown}</pre>
					{/if}
				</div>

				<div class="doc-foot">
					<span class="foot-note">
						{#if dirty}
							<Icon name="alert-circle" size={13} /> Unsaved — held in this browser only
						{:else}
							<Icon name="check-circle" size={13} /> Saved
						{/if}
					</span>
					<div class="row-end">
						<Button variant="ghost" size="sm" onclick={() => goStep(0)}>← Import</Button>
						<Button variant="solid-ghost" size="sm" onclick={() => (dirty = false)}>Save policy</Button>
						<Button size="sm" onclick={() => goStep(2)}>Link to assessment →</Button>
					</div>
				</div>
			</div>

			<!-- ── Side rail ───────────────────────────────────────────────── -->
			<aside class="rail">
				<Panel title="Clause anchors" flush>
					{#snippet icon()}<Icon name="flag" size={13} />{/snippet}
					<div class="rail-body">
						<p class="rail-lede">
							Select text in the document and press <strong>Anchor clause</strong>. An anchor is a
							stable id over that span — assessment links keep pointing at the right clause even
							after the prose around it changes.
						</p>
						{#if anchors.length === 0}
							<EmptyState message="No anchors yet" sub="Select text to create one" />
						{:else}
							{#each anchors as a (a.anchor_id)}
								<div class="anchor-card">
									<div class="ac-head">
										<code>{a.anchor_id}</code>
										<span class="ac-label">{a.label}</span>
									</div>
									<p class="ac-excerpt">{a.excerpt}</p>
									<span class="ac-uses">
										{links.filter((l) => l.ref === a.anchor_id).length} assessment link(s)
									</span>
								</div>
							{/each}
						{/if}
					</div>
				</Panel>

				<Panel title="Toolbar rationale" flush>
					{#snippet icon()}<Icon name="clipboard-list" size={13} />{/snippet}
					<div class="rail-body">
						<button class="disclose" onclick={() => (rationaleOpen = !rationaleOpen)}>
							<Icon name={rationaleOpen ? 'chevron-down' : 'chevron-right'} size={14} />
							Why these controls and no others
						</button>
						{#if rationaleOpen}
							<div class="rat-block">
								<span class="rat-head in">Included</span>
								{#each TOOLBAR_RATIONALE.included as [name, why] (name)}
									<div class="rat-row"><strong>{name}</strong><span>{why}</span></div>
								{/each}
							</div>
							<div class="rat-block">
								<span class="rat-head out">Deliberately omitted</span>
								{#each TOOLBAR_RATIONALE.excluded as [name, why] (name)}
									<div class="rat-row"><strong>{name}</strong><span>{why}</span></div>
								{/each}
							</div>
						{/if}
					</div>
				</Panel>
			</aside>
		</div>
	{/if}

	<!-- ═══ PHASE 3 — LINK EVIDENCE ════════════════════════════════════════ -->
	{#if step === 2}
		<div class="link-wrap">
			<Panel title="SOC 2 readiness · 2026" flush>
				{#snippet icon()}<Icon name="clipboard-check" size={13} />{/snippet}
				{#snippet actions()}
					<Chip look="ghost" color="accent">{links.length} evidence link(s)</Chip>
				{/snippet}
				<div class="q-list">
					<p class="rail-lede pad-x">
						Attach evidence at three levels of precision: to the <strong>question</strong> itself, to
						the <strong>answer you selected</strong>, or to an individual
						<strong>note or evidence item</strong>. Each attachment picks its own scope — a whole
						policy, a single clause anchor, or a pinned version.
					</p>

					{#each QUESTIONS as q (q.id)}
						<div class="q-card">
							<button class="q-head" onclick={() => toggleQ(q.id)}>
								<Icon name={expanded === q.id ? 'chevron-down' : 'chevron-right'} size={15} />
								<code class="q-ref">{q.ref}</code>
								<span class="q-prompt">{q.prompt}</span>
								{#if linksFor('question', q.id).length + q.options.reduce((n, o) => n + linksFor('answer', o.id).length, 0) + q.notes.reduce((n, o) => n + linksFor('note', o.id).length, 0) > 0}
									<Chip look="ghost" color="success">linked</Chip>
								{/if}
							</button>

							{#if expanded === q.id}
								<div class="q-body">
									<!-- Target: the question -->
									<div class="target">
										<div class="t-head">
											<span class="t-kind">Question</span>
											<button class="attach" onclick={() => openBrowser('question', q.id, q.ref)}>
												<Icon name="plus" size={12} /> Attach evidence
											</button>
										</div>
										{#each linksFor('question', q.id) as l (l.link_id)}
											<div class="link-chip">
												<Icon name={SCOPE_ICON[l.scope]} size={12} />
												<span class="lc-title">{l.policy_title}</span>
												<span class="lc-scope">{SCOPE_WORD[l.scope]}{l.ref_label ? ` · ${l.ref_label}` : ''}</span>
												<button class="lc-x" onclick={() => removeLink(l.link_id)} aria-label="Remove"><Icon name="x" size={12} /></button>
											</div>
										{/each}
									</div>

									<!-- Target: the selected answer -->
									<div class="target">
										<div class="t-head"><span class="t-kind">Answer</span></div>
										{#each q.options as o (o.id)}
											{@const chosen = o.id === q.answer_id}
											<div class="opt {chosen ? 'chosen' : ''}">
												<Icon name={chosen ? 'check-circle-2' : 'circle'} size={14} />
												<span class="opt-label">{o.label}</span>
												{#if chosen}
													<button class="attach" onclick={() => openBrowser('answer', o.id, o.label)}>
														<Icon name="plus" size={12} /> Attach
													</button>
												{/if}
											</div>
											{#each linksFor('answer', o.id) as l (l.link_id)}
												<div class="link-chip indent">
													<Icon name={SCOPE_ICON[l.scope]} size={12} />
													<span class="lc-title">{l.policy_title}</span>
													<span class="lc-scope">{SCOPE_WORD[l.scope]}{l.ref_label ? ` · ${l.ref_label}` : ''}</span>
													<button class="lc-x" onclick={() => removeLink(l.link_id)} aria-label="Remove"><Icon name="x" size={12} /></button>
												</div>
											{/each}
										{/each}
									</div>

									<!-- Target: notes / evidence items -->
									<div class="target">
										<div class="t-head"><span class="t-kind">Notes &amp; evidence</span></div>
										{#if q.notes.length === 0}
											<EmptyState message="No notes on this question" />
										{:else}
											{#each q.notes as n (n.id)}
												<div class="note">
													<div class="n-head">
														<Chip look="ghost" color={n.kind === 'evidence' ? 'accent' : 'default'}>{n.kind}</Chip>
														<span class="n-author">{n.author}</span>
														<button class="attach" onclick={() => openBrowser('note', n.id, n.body.slice(0, 40))}>
															<Icon name="plus" size={12} /> Attach
														</button>
													</div>
													<p class="n-body">{n.body}</p>
													{#each linksFor('note', n.id) as l (l.link_id)}
														<div class="link-chip">
															<Icon name={SCOPE_ICON[l.scope]} size={12} />
															<span class="lc-title">{l.policy_title}</span>
															<span class="lc-scope">{SCOPE_WORD[l.scope]}{l.ref_label ? ` · ${l.ref_label}` : ''}</span>
															<button class="lc-x" onclick={() => removeLink(l.link_id)} aria-label="Remove"><Icon name="x" size={12} /></button>
														</div>
													{/each}
												</div>
											{/each}
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}

					<div class="doc-foot">
						<span class="foot-note"><Icon name="info" size={13} /> Links are references, not copies — the policy stays the source of truth.</span>
						<Button variant="ghost" size="sm" onclick={() => goStep(1)}>← Back to editor</Button>
					</div>
				</div>
			</Panel>
		</div>
	{/if}
</div>

<!-- ═══ EVIDENCE BROWSER ═══════════════════════════════════════════════════ -->
<Modal open={browserOpen} title="Attach evidence" size="xl" onclose={() => (browserOpen = false)}>
	{#if pendingTarget}
		<div class="eb-target">
			<span class="ebt-kind">{pendingTarget.kind}</span>
			<span class="ebt-label">{pendingTarget.label}</span>
		</div>
	{/if}

	<div class="eb">
		<!-- Source column -->
		<div class="eb-left">
			<SearchInput bind:value={browserQuery} placeholder="Search evidence…" />
			<div class="eb-tabs">
				<SegmentGroup
					options={SOURCE_TABS}
					value={browserSource}
					onchange={(v) => {
						browserSource = v as EvidenceSource;
						selectedItem = null;
					}}
				/>
			</div>
			<div class="eb-results">
				{#if browserResults.length === 0}
					<EmptyState message="Nothing matches" sub="Try a different term or source" />
				{:else}
					{#each browserResults as item (item.id)}
						<button class="eb-item {selectedItem === item.id ? 'sel' : ''}" onclick={() => pickItem(item.id)}>
							<Icon name={item.source === 'policies' ? 'file-text' : item.source === 'uploads' ? 'upload' : 'clipboard-check'} size={15} />
							<div class="ebi-main">
								<span class="ebi-title">{item.title}</span>
								<span class="ebi-meta">{item.meta}</span>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Scope + preview column -->
		<div class="eb-right">
			{#if !activeItem}
				<EmptyState message="Select an item" sub="Then choose how much of it to attach" variant="card" />
			{:else}
				<div class="eb-scope">
					<span class="eb-h">What to attach</span>

					<label class="scope {selectedScope === 'document' ? 'on' : ''}">
						<input type="radio" bind:group={selectedScope} value="document" onchange={() => (selectedRef = null)} />
						<div>
							<strong>The whole document</strong>
							<span>Follows the policy as it changes. Use when the question is about the policy existing at all.</span>
						</div>
					</label>

					{#if scopeAvailable}
						<label class="scope {selectedScope === 'clause' ? 'on' : ''} {anchors.length === 0 ? 'off' : ''}">
							<input type="radio" bind:group={selectedScope} value="clause" disabled={anchors.length === 0} />
							<div>
								<strong>A clause anchor</strong>
								<span>Points at one span of the policy. Survives edits to surrounding prose.</span>
							</div>
						</label>
						{#if selectedScope === 'clause'}
							<div class="scope-picks">
								{#each anchors as a (a.anchor_id)}
									<button class="pick {selectedRef === a.anchor_id ? 'sel' : ''}" onclick={() => (selectedRef = a.anchor_id)}>
										<code>{a.anchor_id}</code>
										<span class="pk-label">{a.label}</span>
										<span class="pk-ex">{a.excerpt}</span>
									</button>
								{/each}
							</div>
						{/if}

						<label class="scope {selectedScope === 'version' ? 'on' : ''}">
							<input type="radio" bind:group={selectedScope} value="version" />
							<div>
								<strong>A pinned version</strong>
								<span>Freezes the evidence at a point in time. Use when an auditor must see exactly what was reviewed.</span>
							</div>
						</label>
						{#if selectedScope === 'version'}
							<div class="scope-picks">
								{#each activeItem.versions ?? [] as v (v.version)}
									<button class="pick {selectedRef === v.version ? 'sel' : ''}" onclick={() => (selectedRef = v.version)}>
										<code>{v.version}</code>
										<span class="pk-label">{v.created_at}</span>
										<span class="pk-ex">{v.note}</span>
									</button>
								{/each}
							</div>
						{/if}
					{:else}
						<p class="eb-note">
							<Icon name="info" size={13} />
							Clause and version scopes apply to policies only — this item attaches whole.
						</p>
					{/if}
				</div>

				<div class="eb-preview">
					<span class="eb-h">Preview</span>
					<div class="prev-body">
						{#if selectedScope === 'clause' && selectedRef}
							<p class="prev-quote">{anchors.find((a) => a.anchor_id === selectedRef)?.excerpt}</p>
						{:else if selectedScope === 'version' && selectedRef}
							<p class="prev-quote">{activeItem.title} — {selectedRef}, frozen copy</p>
						{:else}
							<p class="prev-quote">{activeItem.title} — current content, follows future edits</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={() => (browserOpen = false)}>Cancel</Button>
		<Button
			onclick={attach}
			disabled={!activeItem || (selectedScope !== 'document' && !selectedRef)}
		>
			Attach
		</Button>
	{/snippet}
</Modal>

<style>
	.page {
		max-width: 1500px;
		margin: 0 auto;
		padding: 2rem var(--page-x) 4rem;
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 1.25rem;
	}
	h1 {
		font-family: var(--sans-brand);
		font-size: 1.6rem;
		color: var(--fg);
		margin: 0 0 0.35rem;
	}
	.sub {
		color: var(--fg-muted);
		font-size: 0.9rem;
		margin: 0;
		max-width: 62ch;
	}
	.steps {
		margin-bottom: 1.5rem;
	}
	.grid-2 {
		display: grid;
		grid-template-columns: 1.15fr 1fr;
		gap: 1.25rem;
	}
	.pad {
		padding: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.pad-x {
		padding: 0 1.1rem;
	}
	.lede {
		color: var(--fg-muted);
		font-size: 0.86rem;
		line-height: 1.55;
		margin: 0;
	}
	.lede code {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--accent);
	}

	/* ── Import ── */
	.retention {
		display: flex;
		gap: 0.65rem;
		padding: 0.8rem;
		border: 1px solid var(--border-accent);
		border-radius: 6px;
		background: var(--accent-faint);
		color: var(--fg-muted);
		font-size: 0.8rem;
		line-height: 1.5;
	}
	.retention strong {
		color: var(--fg);
		display: block;
		margin-bottom: 0.15rem;
	}
	.file-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface-raised);
	}
	.fr-main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.fr-name {
		font-size: 0.85rem;
		color: var(--fg);
	}
	.fr-meta {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--fg-dim);
	}
	.row-end {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		align-items: center;
	}
	.warn {
		display: flex;
		gap: 0.6rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgba(252, 211, 77, 0.3);
		border-radius: 6px;
		color: var(--palette-amber);
		font-size: 0.78rem;
	}
	.warn code {
		font-family: var(--mono);
		display: block;
		font-size: 0.74rem;
	}
	.warn span {
		color: var(--fg-muted);
	}
	.fidelity {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}
	.fid-label {
		font-family: var(--mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
	}
	.fid-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.8rem;
		color: var(--fg-muted);
	}

	/* ── Editor ── */
	.editor-wrap {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		gap: 1.25rem;
		align-items: start;
	}
	.editor-col {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		overflow: hidden;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 0.7rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-raised);
		flex-wrap: wrap;
	}
	.tb-group {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}
	.tb-sep {
		width: 1px;
		height: 20px;
		background: var(--border);
		margin: 0 0.25rem;
	}
	.tb-spacer {
		flex: 1;
	}
	.tb-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 30px;
		height: 30px;
		padding: 0 0.5rem;
		justify-content: center;
		border: 1px solid transparent;
		border-radius: 5px;
		background: transparent;
		color: var(--fg-muted);
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.12s, color 0.12s, border-color 0.12s;
	}
	.tb-btn:hover:not(:disabled) {
		background: var(--control-surface);
		color: var(--fg);
		border-color: var(--border);
	}
	.tb-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.tb-btn.mono {
		font-family: var(--mono);
		font-size: 0.72rem;
	}
	.anchor-btn {
		font-size: 0.76rem;
		color: var(--accent);
		border-color: var(--border-accent);
	}

	.popover {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.8rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-strong);
	}
	.popover.accent {
		background: var(--accent-faint);
		color: var(--accent);
	}
	.pop-label {
		font-family: var(--mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--fg-dim);
	}
	.pop-input {
		flex: 0 1 220px;
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--input-bg);
		border-radius: 5px;
		background: var(--input-bg);
		color: var(--fg);
		font-size: 0.82rem;
	}
	.pop-input.wide {
		flex: 1 1 auto;
	}
	.pop-input:focus {
		outline: 1px solid var(--accent);
	}

	.doc-shell {
		min-height: 460px;
		max-height: 620px;
		overflow-y: auto;
		background: var(--bg);
	}
	.doc {
		padding: 2rem 2.5rem;
		max-width: 78ch;
	}
	.blk {
		position: relative;
		display: flex;
		gap: 0.5rem;
		margin-left: calc(var(--indent) * 1.4rem);
		padding: 0.15rem 0.4rem;
		border-left: 2px solid transparent;
		border-radius: 3px;
	}
	.blk.focused {
		border-left-color: var(--accent);
		background: var(--accent-faint);
	}
	.blk.anchored .blk-body {
		background: rgba(94, 234, 212, 0.09);
		box-shadow: inset 0 -1px 0 var(--accent-line);
	}
	.blk-body {
		flex: 1;
		min-width: 0;
		outline: none;
		color: var(--fg);
		line-height: 1.65;
		font-size: 0.92rem;
	}
	.blk-body:focus {
		outline: none;
	}
	.marker {
		color: var(--fg-dim);
		font-size: 0.9rem;
		line-height: 1.65;
		user-select: none;
	}
	.blk-h1 .blk-body {
		font-family: var(--sans-brand);
		font-size: 1.5rem;
		font-weight: 600;
		line-height: 1.3;
		margin: 0.6rem 0 0.3rem;
	}
	.blk-h2 .blk-body {
		font-family: var(--sans-brand);
		font-size: 1.15rem;
		font-weight: 600;
		line-height: 1.35;
		margin: 0.9rem 0 0.2rem;
	}
	.blk-h3 .blk-body {
		font-size: 1rem;
		font-weight: 600;
		margin: 0.7rem 0 0.15rem;
	}
	.blk-quote {
		border-left: 3px solid var(--accent-line);
		padding-left: 0.9rem;
		margin-top: 0.5rem;
	}
	.blk-quote .blk-body {
		color: var(--fg-muted);
		font-style: italic;
	}
	.blk-code .blk-body {
		font-family: var(--mono);
		font-size: 0.8rem;
		white-space: pre-wrap;
		background: var(--terminal-bg);
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 0.7rem 0.85rem;
		color: var(--fg-muted);
	}
	.anchor-tag {
		position: absolute;
		right: -0.4rem;
		top: -0.55rem;
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--accent);
		background: var(--bg);
		border: 1px solid var(--border-accent);
		border-radius: 3px;
		padding: 0.05rem 0.3rem;
	}
	.src {
		margin: 0;
		padding: 1.5rem 2rem;
		font-family: var(--mono);
		font-size: 0.8rem;
		line-height: 1.7;
		color: var(--fg-muted);
		white-space: pre-wrap;
	}
	.doc-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--border);
		background: var(--surface-raised);
	}
	.foot-note {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: var(--fg-dim);
	}

	/* ── Rail ── */
	.rail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.rail-body {
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.rail-lede {
		font-size: 0.79rem;
		line-height: 1.55;
		color: var(--fg-muted);
		margin: 0;
	}
	.anchor-card {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.6rem 0.7rem;
		background: var(--surface-raised);
	}
	.ac-head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: 0.3rem;
	}
	.ac-head code {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--accent);
	}
	.ac-label {
		font-size: 0.82rem;
		color: var(--fg);
	}
	.ac-excerpt {
		font-size: 0.75rem;
		color: var(--fg-dim);
		line-height: 1.45;
		margin: 0 0 0.35rem;
	}
	.ac-uses {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-muted);
	}
	.disclose {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: none;
		padding: 0;
		color: var(--fg-muted);
		font-size: 0.8rem;
		cursor: pointer;
		text-align: left;
	}
	.disclose:hover {
		color: var(--fg);
	}
	.rat-block {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}
	.rat-head {
		font-family: var(--mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.rat-head.in {
		color: var(--palette-emerald-l);
	}
	.rat-head.out {
		color: var(--fg-dim);
	}
	.rat-row {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.rat-row strong {
		font-size: 0.76rem;
		color: var(--fg);
		font-weight: 500;
	}
	.rat-row span {
		font-size: 0.72rem;
		color: var(--fg-dim);
		line-height: 1.45;
	}

	/* ── Linking ── */
	.link-wrap {
		max-width: 1080px;
	}
	.q-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 0 0;
	}
	.q-card {
		border: 1px solid var(--border);
		border-radius: 7px;
		margin: 0 1.1rem;
		background: var(--surface-raised);
		overflow: hidden;
	}
	.q-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.8rem 0.9rem;
		background: none;
		border: none;
		color: var(--fg);
		cursor: pointer;
		text-align: left;
	}
	.q-head:hover {
		background: var(--control-surface);
	}
	.q-ref {
		font-family: var(--mono);
		font-size: 0.72rem;
		color: var(--accent);
		border: 1px solid var(--border-accent);
		border-radius: 3px;
		padding: 0.1rem 0.35rem;
	}
	.q-prompt {
		flex: 1;
		font-size: 0.87rem;
	}
	.q-body {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 0.2rem 0.9rem 1rem;
		border-top: 1px solid var(--border);
	}
	.target {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-top: 0.7rem;
	}
	.t-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.t-kind {
		font-family: var(--mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--fg-dim);
	}
	.attach {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: 1px dashed var(--border-strong);
		border-radius: 4px;
		padding: 0.15rem 0.45rem;
		color: var(--fg-muted);
		font-size: 0.72rem;
		cursor: pointer;
	}
	.attach:hover {
		color: var(--accent);
		border-color: var(--border-accent);
	}
	.opt {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem;
		border-radius: 5px;
		color: var(--fg-dim);
		font-size: 0.82rem;
	}
	.opt.chosen {
		color: var(--fg);
		background: var(--accent-faint);
	}
	.opt-label {
		flex: 1;
	}
	.link-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--border-accent);
		border-radius: 5px;
		background: var(--accent-faint);
		font-size: 0.76rem;
		width: fit-content;
		max-width: 100%;
		color: var(--accent);
	}
	.link-chip.indent {
		margin-left: 1.6rem;
	}
	.lc-title {
		color: var(--fg);
	}
	.lc-scope {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
	}
	.lc-x {
		background: none;
		border: none;
		color: var(--fg-dim);
		cursor: pointer;
		display: inline-flex;
		padding: 0;
	}
	.lc-x:hover {
		color: var(--palette-red-l);
	}
	.note {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
	}
	.n-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.n-author {
		font-family: var(--mono);
		font-size: 0.7rem;
		color: var(--fg-dim);
		flex: 1;
	}
	.n-body {
		font-size: 0.81rem;
		color: var(--fg-muted);
		line-height: 1.5;
		margin: 0;
	}

	/* ── Evidence browser ── */
	.eb-target {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		margin-bottom: 0.9rem;
		border: 1px solid var(--border-accent);
		border-radius: 6px;
		background: var(--accent-faint);
	}
	.ebt-kind {
		font-family: var(--mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
	}
	.ebt-label {
		font-size: 0.83rem;
		color: var(--fg);
	}
	.eb {
		display: grid;
		grid-template-columns: 320px minmax(0, 1fr);
		gap: 1.1rem;
		min-height: 400px;
	}
	.eb-left {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border-right: 1px solid var(--border);
		padding-right: 1.1rem;
	}
	.eb-tabs {
		display: flex;
	}
	.eb-results {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		overflow-y: auto;
		max-height: 360px;
	}
	.eb-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.6rem;
		border: 1px solid transparent;
		border-radius: 6px;
		background: none;
		color: var(--fg-muted);
		cursor: pointer;
		text-align: left;
	}
	.eb-item:hover {
		background: var(--control-surface);
	}
	.eb-item.sel {
		border-color: var(--border-accent);
		background: var(--accent-faint);
		color: var(--accent);
	}
	.ebi-main {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.ebi-title {
		font-size: 0.83rem;
		color: var(--fg);
	}
	.ebi-meta {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
	}
	.eb-right {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.eb-h {
		font-family: var(--mono);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--fg-dim);
	}
	.eb-scope {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.scope {
		display: flex;
		gap: 0.6rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		cursor: pointer;
	}
	.scope.on {
		border-color: var(--border-accent);
		background: var(--accent-faint);
	}
	.scope.off {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.scope strong {
		display: block;
		font-size: 0.84rem;
		color: var(--fg);
		font-weight: 500;
	}
	.scope span {
		font-size: 0.75rem;
		color: var(--fg-dim);
		line-height: 1.45;
	}
	.scope-picks {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-left: 1.4rem;
	}
	.pick {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.5rem;
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg);
		cursor: pointer;
		text-align: left;
	}
	.pick.sel {
		border-color: var(--accent);
		background: var(--accent-faint);
	}
	.pick code {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--accent);
	}
	.pk-label {
		font-size: 0.8rem;
		color: var(--fg);
	}
	.pk-ex {
		grid-column: 1 / -1;
		font-size: 0.72rem;
		color: var(--fg-dim);
		line-height: 1.4;
	}
	.eb-note {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: var(--fg-dim);
		margin: 0;
	}
	.eb-preview {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: auto;
	}
	.prev-body {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.75rem 0.85rem;
		background: var(--bg);
	}
	.prev-quote {
		margin: 0;
		font-size: 0.81rem;
		line-height: 1.55;
		color: var(--fg-muted);
	}

	@media (max-width: 1100px) {
		.grid-2,
		.editor-wrap,
		.eb {
			grid-template-columns: minmax(0, 1fr);
		}
		.eb-left {
			border-right: none;
			padding-right: 0;
		}
	}
</style>
