<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// The DOCS EDITOR — repo-backed policy and procedure authoring.
	//
	// Prose lives in the customer's git repo. Armornet stores references,
	// normalized metadata and ordering — never the prose as the source of
	// truth. A CORPUS is one repo binding: a forge repo plus the subtree
	// holding the documents — never "space", which means nothing here.
	//
	// SHELL DECISION. Two panes: the corpus and the document. There is no
	// inspector panel, deliberately. A panel makes you hold two things at once
	// — which clause is selected, and what the panel is saying about it — and
	// everything it used to carry belongs to a clause anyway. So it is docked
	// to the clause instead (see SectionDock), and the only things left at the
	// top are true of the whole session or of the whole document.
	//
	// CHROME. Top bar: the repo binding, the one alarm that outranks everything,
	// and Commit. Rail header: branch, sha and sync, above the documents they
	// describe. Document toolbar: identity, coverage, how it reads, sign-off.
	//
	// API stubs:
	//   GET  /api/corpora/:id                        → { corpus }
	//   GET  /api/corpora/:id/tree                   → { nodes[] }
	//   GET  /api/docs/:id                           → { doc, sections[] }
	//   GET  /api/docs/:id/content?sha=              → raw markdown from the forge
	//   POST /api/docs/:id/sections/:sid/anchor      → { section }  ← human decision
	//   POST /api/sections/:sid/citations            → { citation } ← link evidence
	//   DEL  /api/sections/:sid/citations/:eid       → 204
	//   POST /api/blocks/:id/run                     → 202 { run_id }
	//   GET  /api/evidence?org=                      → { evidence[] } (the picker pool)
	// ─────────────────────────────────────────────────────────────────────────

	import { Icon, Tooltip } from 'showcase';

	import CommandPicker from './CommandPicker.svelte';
	import CommitPreview from './CommitPreview.svelte';
	import DocTree from './DocTree.svelte';
	import DocumentView from './DocumentView.svelte';
	import EvidencePicker from './EvidencePicker.svelte';
	import InsertMenu from './InsertMenu.svelte';
	import type { InsertItem } from './InsertMenu.svelte';

	import {
		approvers,
		bindings as BINDINGS,
		commands as COMMANDS,
		comments,
		controls,
		corpus,
		documents,
		evidence,
		git,
		source_md,
		tree
	} from './data.js';
	import type { Command, CommandBinding, DocSection, Trigger } from './data.js';
	import {
		DOC_STATUS,
		bindingStatus,
		cadenceFor,
		catalogState,
		worstFreshness
	} from './looks.js';

	type Resolution = 'unresolved' | 'rebound' | 'retired';
	type Mode = 'read' | 'write' | 'source';

	// ── State ────────────────────────────────────────────────────────────────
	let selected_doc_id = $state('doc_ac');
	let selected_section_id = $state<string | null>('sec_01H8XP');
	let mode = $state<Mode>('read');
	let tree_open = $state(true);
	let resolutions = $state<Record<string, Resolution>>({});
	let picker_for = $state<string | null>(null);
	/** Which clause is picking a command to bind. */
	let bind_for = $state<string | null>(null);
	/** Which binding's full run history is open. */
	let history_for = $state<string | null>(null);
	let commit_open = $state(false);
	/** Where the insert palette is anchored, and which clause it inserts after. */
	let insert_at = $state<{ after_id: string; x: number; y: number } | null>(null);
	/** Set after a commit lands, so the bar can say the tree is clean again. */
	let committed = $state(false);

	/**
	 * Every document's sections, held per-document so switching in the tree does
	 * not throw away edits made to the one you were just in. Keyed by tree node
	 * id, which is also the document id.
	 */
	let by_doc = $state<Record<string, DocSection[]>>(
		Object.fromEntries(
			Object.entries(documents).map(([id, d]) => [id, d.sections.map((s) => ({ ...s }))])
		)
	);

	const doc = $derived(documents[selected_doc_id].meta);
	const sections = $derived(by_doc[selected_doc_id] ?? []);
	/** The pristine copy of the open document, for diffing against HEAD. */
	const SECTIONS = $derived(documents[selected_doc_id].sections);

	function setSections(next: DocSection[]) {
		by_doc = { ...by_doc, [selected_doc_id]: next };
	}

	// The catalog and the bindings are OURS, not the repo's — so unlike prose,
	// changes here save instantly and are projected out to frontmatter on the
	// next commit. They are deliberately not counted in `dirty`.
	let commands = $state<Command[]>(COMMANDS.map((c) => ({ ...c })));
	let bindings = $state<CommandBinding[]>(BINDINGS.map((b) => ({ ...b })));
	let running_binding_id = $state<string | null>(null);

	// ── Derived ──────────────────────────────────────────────────────────────
	const by_control = $derived(new Map(controls.map((c) => [c.control_id, c])));
	const by_evidence = $derived(new Map(evidence.map((e) => [e.id, e])));
	const by_command = $derived(new Map(commands.map((c) => [c.command_id, c])));
	const by_binding = $derived(new Map(bindings.map((b) => [b.binding_id, b])));

	const unresolved = $derived(
		sections.filter(
			(s) => s.anchor_state === 'reanchor' && (resolutions[s.section_id] ?? 'unresolved') === 'unresolved'
		)
	);

	const active = $derived(sections.find((s) => s.section_id === selected_section_id) ?? null);


	/** Every citation on the document, scored — the compliance bottom line. */
	const coverage = $derived.by(() => {
		let cited = 0;
		let gaps = 0;
		let past = 0;
		for (const s of sections) {
			const cs = s.control_ids.map((id) => by_control.get(id)!).filter(Boolean);
			if (cs.length === 0) continue;
			const ev = s.evidence_ids.map((id) => by_evidence.get(id)!).filter(Boolean);
			if (ev.length === 0) {
				gaps++;
				continue;
			}
			cited++;
			const w = worstFreshness(ev, cadenceFor(cs, 365));
			if (w === 'stale' || w === 'expired') past++;
		}
		// Bound checks add two figures that a citation count cannot express. A
		// FAILING check is worse than a gap: a gap says "no proof", a failure
		// says "proof that it does not hold". A BLOCKED one says the route to
		// proof is closed until a human looks at a diff.
		let failing = 0;
		let blocked = 0;
		for (const s of sections) {
			const cs = s.control_ids.map((id) => by_control.get(id)!).filter(Boolean);
			const cad = cadenceFor(cs, 365);
			let f = false;
			let b = false;
			for (const bid of s.binding_ids) {
				const bind = by_binding.get(bid);
				const cmd = bind ? by_command.get(bind.command_id) : null;
				if (!cmd) continue;
				const st = bindingStatus(cmd, cad, running_binding_id === bid);
				if (st === 'failing') f = true;
				if (st === 'blocked') b = true;
			}
			if (f) failing++;
			if (b) blocked++;
		}

		return { cited, gaps, past, mapped: cited + gaps, failing, blocked };
	});

	// Approved or not. No verdict spectrum, no flags — the frontmatter carries
	// `status` and `approved_by`, and everything more specific is a comment.
	const signed = $derived(approvers.filter((a) => a.approved_at).length);

	// ── Actions ──────────────────────────────────────────────────────────────

	/**
	 * Open a document. Folders are not documents, so clicking one selects
	 * nothing — the tree still expands it, which is the behaviour you want.
	 * The clause selection is dropped because a section id belongs to exactly
	 * one document and carrying it across would select nothing at all.
	 */
	function openDoc(id: string) {
		if (!documents[id]) return;
		selected_doc_id = id;
		selected_section_id = null;
	}

	function resolve(section_id: string, r: 'rebound' | 'retired') {
		resolutions = { ...resolutions, [section_id]: r };
	}

	function jumpToFirstDrift() {
		const first = unresolved[0];
		if (first) {
			selected_section_id = first.section_id;
			document.getElementById(`sec-${first.section_id}`)?.scrollIntoView({ behavior: 'smooth' });
		}
	}

	function linkEvidence(section_id: string, evidence_id: string) {
		setSections(
			sections.map((s) =>
				s.section_id === section_id && !s.evidence_ids.includes(evidence_id)
					? { ...s, evidence_ids: [...s.evidence_ids, evidence_id] }
					: s
			)
		);
		picker_for = null;
	}

	function detachEvidence(section_id: string, evidence_id: string) {
		setSections(
			sections.map((s) =>
				s.section_id === section_id
					? { ...s, evidence_ids: s.evidence_ids.filter((id) => id !== evidence_id) }
					: s
			)
		);
	}

	/**
	 * A run's output becomes evidence, cited against the clause automatically.
	 * The chain closing: clause → control → binding → command → run → evidence.
	 */
	function emitFromRun(section_id: string) {
		const s = sections.find((x) => x.section_id === section_id);
		if (!s) return;
		for (const bid of s.binding_ids) {
			const bind = by_binding.get(bid);
			const cmd = bind ? by_command.get(bind.command_id) : null;
			const ev = cmd?.runs[0]?.emitted_evidence_id;
			if (ev) {
				linkEvidence(section_id, ev);
				return;
			}
		}
	}

	/**
	 * Running a bound check. A pass emits evidence and cites it back against the
	 * clause; a failure emits nothing, because a failed run is not proof — it is
	 * the absence of proof, stated loudly.
	 */
	function runBinding(binding_id: string) {
		const bind = by_binding.get(binding_id);
		const cmd = bind ? by_command.get(bind.command_id) : null;
		if (!bind || !cmd || catalogState(cmd) !== 'approved') return;

		running_binding_id = binding_id;
		setTimeout(() => {
			running_binding_id = null;

			const ev_id = `ev_run${cmd.runs.length}`;
			commands = commands.map((c) =>
				c.command_id !== cmd.command_id
					? c
					: {
							...c,
							runs: [
								{
									run_id: `run_new${c.runs.length}`,
									at: 'just now',
									age_days: 0,
									outcome: 'pass' as const,
									detail: 'Re-run from the clause · passed',
									duration_ms: 2400,
									triggered_by: 'manual' as const,
									ran_at_sha: 'a91f2c4',
									emitted_evidence_id: ev_id
								},
								...c.runs
							]
						}
			);
		}, 1200);
	}

	/** Binding is instant — it is graph data, ours, not the customer's prose. */
	function bindCheck(section_id: string, command_id: string, trigger: Trigger) {
		const id = `bind_new${bindings.length}`;
		bindings = [
			...bindings,
			{
				binding_id: id,
				section_id,
				command_id,
				trigger,
				bound_at: 'just now',
				bound_by: 'you',
				projected: false
			}
		];
		setSections(
			sections.map((s) =>
				s.section_id === section_id ? { ...s, binding_ids: [...s.binding_ids, id] } : s
			)
		);
		bind_for = null;
	}

	/**
	 * Unbinding removes the edge, never the history. Runs that already emitted
	 * evidence keep it — the clause was proven at the time, and deleting that
	 * would be rewriting the audit trail.
	 */
	function unbind(binding_id: string) {
		bindings = bindings.filter((b) => b.binding_id !== binding_id);
		setSections(
			sections.map((s) => ({
				...s,
				binding_ids: s.binding_ids.filter((id) => id !== binding_id)
			}))
		);
	}

	/**
	 * Reordering a clause moves the prose in the file AND carries the section id
	 * with it, so ordinals shift and nothing needs re-anchoring. The identical
	 * move made by hand in the repo is exactly what produces a drift decision.
	 */
	function reorderSections(from_id: string, to_id: string, edge: 'above' | 'below') {
		const from = sections.findIndex((s) => s.section_id === from_id);
		const to = sections.findIndex((s) => s.section_id === to_id);
		if (from < 0 || to < 0) return;
		const next = [...sections];
		const [moved] = next.splice(from, 1);
		const at = next.findIndex((s) => s.section_id === to_id);
		next.splice(edge === 'above' ? at : at + 1, 0, moved);
		setSections(next);
		committed = false;
	}

	function openInsert(after_id: string, x: number, y: number) {
		insert_at = { after_id, x, y };
	}

	/** Inserting is a prose change like any other — it commits to the repo. */
	function insertBlock(item: InsertItem) {
		const anchor = insert_at;
		insert_at = null;
		if (!anchor) return;
		const at = sections.findIndex((s) => s.section_id === anchor.after_id);
		if (at < 0) return;

		const id = `sec_new${sections.length}`;
		const next = [...sections];
		next.splice(at + 1, 0, {
			section_id: id,
			heading: item.id === 'runnable' ? 'New clause with a check' : 'New clause',
			level: 2,
			anchor_state: 'new',
			body_html: '<p>…</p>',
			body_md: '…',
			control_ids: [],
			evidence_ids: [],
			// Never a code block: inserting something runnable into a policy means
			// BINDING a command, and the picker opens for that.
			blocks: [],
			binding_ids: [],
			step_no: null,
			drift: null
		});
		setSections(next);
		selected_section_id = id;
		if (item.id === 'runnable') bind_for = id;
		committed = false;
	}

	function editHeading(section_id: string, heading: string) {
		setSections(sections.map((s) => (s.section_id === section_id ? { ...s, heading } : s)));
		committed = false;
	}

	function editBody(section_id: string, body_md: string) {
		setSections(sections.map((s) => (s.section_id === section_id ? { ...s, body_md } : s)));
		committed = false;
	}

	// ── The commit diff, derived by comparing against what HEAD holds ────────
	// Deriving beats bookkeeping here: an edit that is typed and then undone
	// leaves no trace, which is what a git diff would also say.
	const original = $derived(new Map(SECTIONS.map((s) => [s.section_id, s])));
	const original_headings = $derived(
		Object.fromEntries(SECTIONS.map((s) => [s.section_id, s.heading]))
	);

	const prose_changes = $derived.by(() => {
		const out: { section_id: string; heading: string; kind: 'heading' | 'body' | 'both'; was: string | null }[] = [];
		for (const s of sections) {
			const o = original.get(s.section_id);
			if (!o) continue;
			const h = o.heading !== s.heading;
			const b = o.body_md !== s.body_md;
			if (!h && !b) continue;
			out.push({
				section_id: s.section_id,
				heading: s.heading,
				kind: h && b ? 'both' : h ? 'heading' : 'body',
				was: h ? o.heading : null
			});
		}
		return out;
	});

	const graph_changes = $derived.by(() => {
		const out: { kind: 'rename' | 'citation_added' | 'citation_removed' | 'anchor_resolved'; section_id: string; detail: string }[] = [];
		for (const s of sections) {
			const o = original.get(s.section_id);
			if (!o) continue;

			// A rename made HERE keeps the id — that is the whole argument for
			// editing in this pane rather than committing straight to the repo.
			if (o.heading !== s.heading) {
				out.push({
					kind: 'rename',
					section_id: s.section_id,
					detail: `“${o.heading}” → “${s.heading}” · id kept, references follow`
				});
			}
			for (const id of s.evidence_ids) {
				if (!o.evidence_ids.includes(id)) {
					out.push({
						kind: 'citation_added',
						section_id: s.section_id,
						detail: by_evidence.get(id)?.label ?? id
					});
				}
			}
			for (const id of o.evidence_ids) {
				if (!s.evidence_ids.includes(id)) {
					out.push({
						kind: 'citation_removed',
						section_id: s.section_id,
						detail: by_evidence.get(id)?.label ?? id
					});
				}
			}
		}
		for (const [section_id, r] of Object.entries(resolutions)) {
			out.push({
				kind: 'anchor_resolved',
				section_id,
				detail: r === 'rebound' ? 'Re-anchored — id kept' : 'Retired — new id minted'
			});
		}
		return out;
	});

	const dirty = $derived(prose_changes.length + graph_changes.length);

	function commit(message: string) {
		// A real implementation would POST the markdown to the forge through the
		// GitHub App and persist the graph changes in one transaction.
		commit_open = false;
		committed = true;
	}

	const picker_section = $derived(sections.find((s) => s.section_id === picker_for) ?? null);
	const picker_controls = $derived(
		picker_section ? picker_section.control_ids.map((id) => by_control.get(id)!).filter(Boolean) : []
	);

	const bind_section = $derived(sections.find((s) => s.section_id === bind_for) ?? null);
	const bind_controls = $derived(
		bind_section ? bind_section.control_ids.map((id) => by_control.get(id)!).filter(Boolean) : []
	);
	/** Commands already bound here — offering them again would be a duplicate. */
	const bind_taken = $derived(
		bind_section
			? bind_section.binding_ids.map((id) => by_binding.get(id)?.command_id ?? '').filter(Boolean)
			: []
	);
</script>

<div
	class="grid h-[100dvh] bg-[var(--page-bg)] text-[var(--fg)]"
	style:grid-template-rows="auto minmax(0,1fr)"
	style:grid-template-columns={tree_open
		? 'clamp(220px,18vw,300px) minmax(0,1fr)'
		: 'minmax(0,1fr)'}
>
	<!-- ── Top bar: session-wide facts only ──────────────────────────────── -->
	<header
		class="flex items-center gap-3 px-3 py-2 min-h-[2.9rem] border-b border-[var(--border)] bg-[var(--bg-elev)]"
		style:grid-column="1 / -1"
	>
		<!-- The repo binding. Branch, sha and sync live in the rail header, above
		     the documents they describe, rather than being restated here. -->
		<div class="flex items-center gap-2 min-w-0">
			<Icon name="git-fork" size={13} style="color: var(--fg-dim)" />
			<span class="font-mono text-[0.72rem] text-[var(--fg)] truncate">{corpus.repo}</span>
			<span class="font-mono text-[0.58rem] text-[var(--fg-dim)]">{corpus.subtree}</span>
		</div>

		<span class="flex-1"></span>

		<!-- The one alarm that outranks everything: a binding awaiting a human. -->
		{#if unresolved.length > 0}
			<button
				class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono text-[0.6rem] font-semibold"
				style:color="#fbbf24"
				style:border-color="color-mix(in srgb, #fbbf24 40%, transparent)"
				style:background="color-mix(in srgb, #fbbf24 12%, transparent)"
				onclick={jumpToFirstDrift}
			>
				<Icon name="alert-triangle" size={12} />
				{unresolved.length}
				{unresolved.length === 1 ? 'binding needs' : 'bindings need'} a decision
			</button>
		{/if}


		<!-- The count is the point: it separates "I edited prose" from "I moved
		     evidence around", and both are pending until you commit. -->
		<button
			class="flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[0.6rem]
			       uppercase tracking-[0.1em] disabled:opacity-45
			       {dirty > 0
				? 'text-[var(--accent)] border-[var(--border-accent)] bg-[var(--accent-faint)] hover:bg-[var(--accent-faint-strong)]'
				: 'text-[var(--fg-dim)] border-[var(--border)]'}"
			onclick={() => (commit_open = true)}
			disabled={dirty === 0}
		>
			<Icon name="git-merge" size={12} />
			{dirty > 0 ? `Commit ${dirty}` : committed ? 'Committed' : 'Commit'}
		</button>

	</header>

	<!-- ── Left rail ─────────────────────────────────────────────────────── -->
	{#if tree_open}
		<div class="min-h-0 overflow-hidden border-r border-[var(--border)]">
			<DocTree
				{corpus}
				{git}
				nodes={tree}
				selected_id={selected_doc_id}
				onselect={openDoc}
			/>
		</div>
	{/if}

	<!-- ── Document ──────────────────────────────────────────────────────── -->
	<main class="flex flex-col min-w-0 min-h-0 bg-[var(--bg)]">
		<!-- The document's own toolbar. Everything true of THIS document lives
		     here — its identity, how it reads, whether it is signed off, and the
		     coverage figures that decide whether it can be. -->
		<div
			class="flex items-center gap-3 flex-wrap px-5 py-2 border-b border-[var(--border)] font-mono text-[0.6rem]"
		>
			<span class="text-[var(--accent)]">{doc.doc_id}</span>
			<span class="text-[var(--fg)] truncate">{doc.title}</span>
			<span class="text-[var(--fg-dim)]">v{doc.version}</span>
			<span
				class="px-1.5 py-0.5 rounded border text-[0.55rem] uppercase tracking-wide"
				style:color={DOC_STATUS[doc.status].color}
				style:border-color="color-mix(in srgb, {DOC_STATUS[doc.status].color} 35%, transparent)"
				style:background="color-mix(in srgb, {DOC_STATUS[doc.status].color} 10%, transparent)"
			>
				{DOC_STATUS[doc.status].label}
			</span>

			<!-- Coverage: the compliance bottom line, in three figures. -->
			<Tooltip
				content="{coverage.cited} of {coverage.mapped} control-claiming clauses cite evidence"
				placement="bottom"
			>
				<span class="flex items-center gap-1.5 tabular-nums text-[var(--fg-dim)]">
					<Icon name="shield-check" size={11} />
					<span class="text-[var(--fg)]">{coverage.cited}/{coverage.mapped}</span> cited
				</span>
			</Tooltip>
			{#if coverage.gaps > 0}
				<span class="tabular-nums" style:color="#fca5a5">{coverage.gaps} gap</span>
			{/if}
			{#if coverage.past > 0}
				<span class="tabular-nums" style:color="#fbbf24">{coverage.past} past cadence</span>
			{/if}

			<span class="flex-1"></span>

			<!-- How the document reads. A quiet three-way, not a chunky segment
			     control — switching view is a glance-level act, not a decision. -->
			<div class="flex items-center rounded-[5px] border border-[var(--border)] overflow-hidden">
				{#each [['read', 'Read'], ['write', 'Write'], ['source', 'Source']] as [v, label] (v)}
					<button
						class="px-2 py-[3px] text-[0.6rem] {mode === v
							? 'text-[var(--accent)] bg-[var(--accent-faint)]'
							: 'text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
						onclick={() => (mode = v as Mode)}
						aria-pressed={mode === v}
					>
						{label}
					</button>
				{/each}
			</div>

			<!-- Sign-off. Approved or not — the only review verdict there is. -->
			<Tooltip
				content={approvers
					.map((a) => `${a.name}: ${a.approved_at ?? 'pending'}`)
					.join(' · ')}
				placement="bottom"
			>
				<button
					class="flex items-center gap-1.5 px-2 py-[3px] rounded-[5px] border text-[0.6rem]"
					style:color={signed === approvers.length ? '#34d399' : 'var(--fg-muted)'}
					style:border-color={signed === approvers.length
						? 'color-mix(in srgb, #34d399 45%, transparent)'
						: 'var(--border)'}
					style:background={signed === approvers.length
						? 'color-mix(in srgb, #34d399 12%, transparent)'
						: 'transparent'}
				>
					<Icon name="check-circle" size={11} />
					<span class="tabular-nums">{signed}/{approvers.length}</span>
					signed
				</button>
			</Tooltip>
		</div>

		<div class="flex-1 min-h-0">
			<DocumentView
				{mode}
				{doc}
				{sections}
				{controls}
				{evidence}
				{commands}
				{bindings}
				{running_binding_id}
				{comments}
				{source_md}
				{selected_section_id}
				{resolutions}
				onselect={(id) => (selected_section_id = id)}
				onresolve={resolve}
				onlink={(id) => (picker_for = id)}
				ondetach={detachEvidence}
				onemit={emitFromRun}
				onheading={editHeading}
				onbody={editBody}
				onbind={(id) => (bind_for = id)}
				onunbind={unbind}
				onrunbinding={runBinding}
				onhistory={(id) => (history_for = id)}
				onreorder={reorderSections}
				oninsert={openInsert}
				{original_headings}
			/>
		</div>
	</main>

</div>

<CommitPreview
	open={commit_open}
	repo={corpus.repo}
	branch={git.branch}
	path={doc.path}
	prose={prose_changes}
	graph={graph_changes}
	onclose={() => (commit_open = false)}
	oncommit={commit}
/>

{#if picker_section}
	<EvidencePicker
		open={!!picker_for}
		heading={picker_section.heading}
		controls={picker_controls}
		cadence_days={cadenceFor(picker_controls, 365)}
		pool={evidence}
		linked_ids={picker_section.evidence_ids}
		onlink={(id) => linkEvidence(picker_section.section_id, id)}
		onclose={() => (picker_for = null)}
	/>
{/if}

{#if bind_section}
	<CommandPicker
		open={!!bind_for}
		heading={bind_section.heading}
		control_refs={bind_controls.map((c) => `${c.framework} ${c.ref}`)}
		cadence_days={cadenceFor(bind_controls, 365)}
		pool={commands}
		bound_ids={bind_taken}
		onbind={(id, trigger) => bindCheck(bind_section.section_id, id, trigger)}
		onclose={() => (bind_for = null)}
	/>
{/if}
