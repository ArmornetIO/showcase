<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// The document canvas.
	//
	// LAYOUT — sections, not lines. An earlier version rendered the file as one
	// row per line with a line number and a 120px anchor gutter on every row: it
	// read as a diff viewer rather than a document, and the gutter carrying the
	// product's central idea was blank on ~80% of rows.
	//
	// GUTTERS — the controls live in the margins, outside the text measure, and
	// are revealed on hover. They are split by job rather than piled together:
	// STRUCTURE verbs (move me, add a block after me) sit in the left gutter,
	// and BINDING verbs (what evidence, identity and comments are attached to me)
	// sit in the right. Two margins means neither set competes with the prose,
	// and neither competes with the other — reordering a document and auditing a
	// clause are different sittings, done by different people.
	//
	// DRAG — reordering a clause here is not cosmetic, and it is safe in a way
	// the same move made in the repo is not. Dragging carries the section id
	// with the prose, so ordinals shift and nothing needs re-anchoring; the
	// identical move committed by hand in git is exactly what produces a drift
	// decision. That asymmetry is the argument for editing here.
	//
	// WRITE MODE is the other half of "editor": editing in this pane keeps the
	// id, so a rename is logged rather than re-matched, and the pane says so at
	// the moment you rename a heading — the only moment it matters.
	// ─────────────────────────────────────────────────────────────────────────

	import { CodeBlock, Collapsible, Icon, Tooltip } from 'showcase';
	// Prose and FileTree aren't re-exported from the library index.
	import Prose from '$lib/docs/Prose.svelte';
	import CheckRail from './CheckRail.svelte';
	import CommandBlock from './CommandBlock.svelte';
	import DriftBanner from './DriftBanner.svelte';
	import EvidenceRail from './EvidenceRail.svelte';
	import SectionCallout from './SectionCallout.svelte';
	import SectionDock from './SectionDock.svelte';
	import type {
		Command,
		CommandBinding,
		Comment,
		Control,
		DocMeta,
		DocSection,
		Evidence
	} from './data.js';
	import {
		ANCHOR,
		BINDING_STATUS,
		FRESHNESS,
		bindingStatus,
		cadenceFor,
		worstBindingStatus,
		worstFreshness
	} from './looks.js';

	type Resolution = 'unresolved' | 'rebound' | 'retired';
	type Panel = 'evidence' | 'identity' | 'comments' | 'checks';

	interface Props {
		mode: 'read' | 'write' | 'source';
		doc: DocMeta;
		sections: DocSection[];
		controls: Control[];
		evidence: Evidence[];
		commands: Command[];
		bindings: CommandBinding[];
		/** Which binding is mid-flight, if any. */
		running_binding_id: string | null;
		comments: Comment[];
		source_md: string;
		selected_section_id: string | null;
		resolutions: Record<string, Resolution>;
		/** Headings as HEAD holds them — the baseline a rename is measured against. */
		original_headings: Record<string, string>;
		onselect: (id: string) => void;
		onresolve: (section_id: string, r: 'rebound' | 'retired') => void;
		onlink: (section_id: string) => void;
		ondetach: (section_id: string, evidence_id: string) => void;
		onemit: (section_id: string) => void;
		onheading: (section_id: string, heading: string) => void;
		onbody: (section_id: string, body: string) => void;
		onbind: (section_id: string) => void;
		onunbind: (binding_id: string) => void;
		onrunbinding: (binding_id: string) => void;
		onhistory: (binding_id: string) => void;
		onreorder: (from_id: string, to_id: string, edge: 'above' | 'below') => void;
		/** Open the insert palette anchored at this section's gutter. */
		oninsert: (after_id: string, x: number, y: number) => void;
	}

	let {
		mode,
		doc,
		sections,
		controls,
		evidence,
		commands,
		bindings,
		running_binding_id,
		comments,
		source_md,
		selected_section_id,
		resolutions,
		original_headings,
		onselect,
		onresolve,
		onlink,
		ondetach,
		onemit,
		onheading,
		onbody,
		onbind,
		onunbind,
		onrunbinding,
		onhistory,
		onreorder,
		oninsert
	}: Props = $props();

	let frontmatter_open = $state(false);

	/** Which toggle is open, per section. Everything starts collapsed. */
	let open_panel = $state<Record<string, Panel | null>>({});

	/** Drag state: what is moving, and where it would land. */
	let drag_id = $state<string | null>(null);
	let drop_target = $state<{ id: string; edge: 'above' | 'below' } | null>(null);

	const by_evidence = $derived(new Map(evidence.map((e) => [e.id, e])));
	const by_control = $derived(new Map(controls.map((c) => [c.control_id, c])));
	const by_command = $derived(new Map(commands.map((c) => [c.command_id, c])));
	const by_binding = $derived(new Map(bindings.map((b) => [b.binding_id, b])));

	/**
	 * A POLICY renders no code, ever — that is the entire reason `kind` exists.
	 * The commands that prove a policy live in the runbooks it binds.
	 */
	const shows_code = $derived(doc.kind !== 'policy');

	function bindingsFor(s: DocSection): CommandBinding[] {
		return s.binding_ids.map((id) => by_binding.get(id)!).filter(Boolean);
	}

	// The assessments UI's header icon-toggle: a small square that lights accent
	// when the field it reveals is open or already carries content.
	const TOGGLE_BASE =
		'inline-flex items-center justify-center w-[24px] h-[24px] rounded-[5px] border cursor-pointer transition-colors bg-transparent';
	const TOGGLE_OFF =
		'border-transparent text-[var(--fg-dim)] hover:text-[var(--accent)] hover:border-[var(--border-strong)]';
	const toggleClass = (active: boolean) => `${TOGGLE_BASE} ${active ? '' : TOGGLE_OFF}`;
	const litStyle = (active: boolean, accent: string) =>
		active
			? `color:${accent};border-color:color-mix(in srgb, ${accent} 45%, transparent);background:color-mix(in srgb, ${accent} 12%, transparent)`
			: '';

	function toggle(section_id: string, panel: Panel) {
		open_panel = {
			...open_panel,
			[section_id]: open_panel[section_id] === panel ? null : panel
		};
	}

	function anchorOf(s: DocSection) {
		const r = resolutions[s.section_id];
		if (s.anchor_state === 'reanchor' && r === 'rebound') return ANCHOR.anchored;
		if (s.anchor_state === 'reanchor' && r === 'retired') return ANCHOR.new;
		return ANCHOR[s.anchor_state];
	}

	function controlsFor(s: DocSection): Control[] {
		return s.control_ids.map((id) => by_control.get(id)).filter((c): c is Control => !!c);
	}

	function citedFor(s: DocSection): Evidence[] {
		return s.evidence_ids.map((id) => by_evidence.get(id)).filter((e): e is Evidence => !!e);
	}

	/** Blast radius of a re-anchoring decision: what points at this id today. */
	function boundCount(s: DocSection): number {
		return (
			s.evidence_ids.length +
			s.control_ids.length +
			comments.filter((c) => c.section_id === s.section_id).length
		);
	}

	function isRenamed(s: DocSection): boolean {
		const was = original_headings[s.section_id];
		return was !== undefined && was !== s.heading;
	}

	// ── Drag handlers ────────────────────────────────────────────────────────
	function dragStart(e: DragEvent, id: string) {
		drag_id = id;
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	/** Above or below, decided by which half of the target you are over. */
	function dragOver(e: DragEvent, id: string) {
		if (!drag_id || drag_id === id) return;
		e.preventDefault();
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		drop_target = { id, edge: e.clientY < box.top + box.height / 2 ? 'above' : 'below' };
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		if (drag_id && drop_target && drag_id !== drop_target.id) {
			onreorder(drag_id, drop_target.id, drop_target.edge);
		}
		drag_id = null;
		drop_target = null;
	}

	function insertAt(e: MouseEvent, after_id: string) {
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		oninsert(after_id, box.right + 8, box.top);
	}

	// The real frontmatter, in the order the templates declare it. `authors` is
	// auto-managed from git history, so it is shown but never presented as
	// editable.
	const FRONTMATTER = $derived<[string, string][]>([
		['id', doc.doc_id],
		['title', doc.title],
		['version', doc.version],
		['status', doc.status],
		['owner', doc.owner],
		['approved_by', doc.approved_by || '—'],
		['classification', doc.classification],
		['review_cycle', doc.review_cycle],
		['next_review', doc.next_review],
		['tags', doc.tags.join(', ')],
		['authors', doc.authors.map((a) => `${a.handle} (${a.commits})`).join(', ')]
	]);
</script>

<div class="h-full overflow-y-auto bg-[var(--bg)]">
	<div
		class="mx-auto px-4 pt-5 pb-[30vh] {mode === 'source'
			? 'max-w-[100ch]'
			: 'max-w-[calc(74ch+7rem)]'}"
	>
		{#if mode === 'source'}
			<!-- An editor that cannot show you the file is not credible. -->
			<CodeBlock code={source_md} title={doc.path} copy wrap />
		{:else}
			<!-- Frontmatter is metadata, not prose: one line until asked. -->
			<div class="mb-5 mx-[3.5rem]">
				<Collapsible bind:open={frontmatter_open}>
					{#snippet trigger({ open, toggle: t })}
						<button
							class="flex items-center gap-2 w-full px-1.5 py-1 rounded border border-transparent
							       text-left text-[var(--fg-dim)] hover:border-[var(--border)] hover:bg-[var(--surface-raised)]"
							onclick={t}
							aria-expanded={open}
						>
							<Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} />
							<!-- Just the label: id, version and status are already stated in
							     the document toolbar, and restating them here was noise. -->
							<span class="font-mono text-[0.55rem] tracking-[0.1em] uppercase">frontmatter</span>
							<span class="truncate font-mono text-[0.58rem] opacity-75">
								{doc.tags.join(', ')}
							</span>
						</button>
					{/snippet}
					<dl
						class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 m-0 mt-1.5 px-3 py-2
						       rounded border border-[var(--border)] bg-[var(--surface-raised)] font-mono text-[0.6rem]"
					>
						{#each FRONTMATTER as [k, v] (k)}
							<dt class="text-[var(--fg-dim)]">{k}</dt>
							<dd class="m-0 text-[var(--fg-muted)]">{v}</dd>
						{/each}
					</dl>
				</Collapsible>
			</div>

			{#each sections as s, i (s.section_id)}
				{@const a = anchorOf(s)}
				{@const on = selected_section_id === s.section_id}
				{@const secs = controlsFor(s)}
				{@const cited = citedFor(s)}
				{@const cadence = cadenceFor(secs, 365)}
				{@const cs = comments.filter((c) => c.section_id === s.section_id)}
				{@const binds = bindingsFor(s)}
				{@const bind_worst = worstBindingStatus(
					binds
						.map((b) => by_command.get(b.command_id))
						.filter((c): c is Command => !!c)
						.map((c, n) =>
							bindingStatus(c, cadence, running_binding_id === binds[n]?.binding_id)
						)
				)}
				{@const worst = worstFreshness(cited, cadence)}
				{@const gap = secs.length > 0 && cited.length === 0}
				{@const ev_tone = gap
					? 'var(--palette-red)'
					: worst && (worst === 'stale' || worst === 'expired')
						? FRESHNESS[worst].color
						: 'var(--accent)'}
				{@const drift_open = resolutions[s.section_id] ?? 'unresolved'}
				{@const panel = open_panel[s.section_id] ?? null}
				{@const dragging = drag_id === s.section_id}
				{@const lit = on || !!panel}

				<!--
					LAYOUT — prose with affordances, never a card.

					A legal document read top to bottom cannot be a stack of boxed
					tiles: that reads as a dashboard, and a dashboard is exactly what
					an auditor distrusts in a policy. So the clause has NO enclosing
					boundary. Its identity lives in a gutter spine — a hairline with a
					tick per clause, indented by heading level so the hierarchy reads
					in the margin even when the headings have scrolled away — and its
					affordances float in the margins without ever enclosing the text.

					The only real borders in the whole document are the callouts
					below, because those are genuinely not prose and should say so.
				-->
				<section
					id="sec-{s.section_id}"
					class="group relative grid scroll-mt-6 transition-opacity
					       {dragging ? 'opacity-40' : ''}
					       {i > 0 ? (mode === 'write' ? (s.level === 1 ? 'mt-8' : 'mt-5') : s.level === 1 ? 'mt-12' : 'mt-8') : ''}"
					style:grid-template-columns="3.5rem minmax(0, 1fr)"
					ondragover={(e) => dragOver(e, s.section_id)}
					ondrop={drop}
					role="listitem"
				>
					<!-- Drop indicator: a single accent rule on the edge you'd land on. -->
					{#if drop_target?.id === s.section_id}
						<div
							class="absolute left-[3.5rem] right-0 h-[2px] bg-[var(--accent)] rounded-full z-10"
							style:top={drop_target.edge === 'above' ? '-0.9rem' : 'auto'}
							style:bottom={drop_target.edge === 'below' ? '-0.9rem' : 'auto'}
						></div>
					{/if}

					<!-- ── LEFT GUTTER: structure verbs ─────────────────────────── -->
					<div
						class="flex items-start justify-end gap-0.5 pr-2 pt-0.5 transition-opacity
						       {on || panel ? 'opacity-60' : 'opacity-0'} group-hover:opacity-100 focus-within:opacity-100"
					>
						<Tooltip content="Insert a block after this clause" placement="left" delay={300}>
							<button
								class="flex items-center justify-center w-[20px] h-[22px] rounded text-[var(--fg-dim)]
								       hover:text-[var(--accent)] hover:bg-[var(--accent-faint)]"
								onclick={(e) => insertAt(e, s.section_id)}
								aria-label="Insert block after {s.heading}"
							>
								<Icon name="plus" size={13} />
							</button>
						</Tooltip>

						<Tooltip content="Drag to reorder — the id travels with it" placement="left" delay={300}>
							<button
								class="flex items-center justify-center w-[20px] h-[22px] rounded cursor-grab
								       text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--surface-strong)]
								       active:cursor-grabbing"
								draggable="true"
								ondragstart={(e) => dragStart(e, s.section_id)}
								ondragend={() => {
									drag_id = null;
									drop_target = null;
								}}
								aria-label="Reorder {s.heading}"
							>
								<!-- The six-dot grip: the one glyph everyone already reads as
								     "pick me up", so it is drawn rather than iconified. -->
								<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
									{#each [2, 7, 12] as cy (cy)}
										<circle cx="2.5" cy={cy} r="1.2" fill="currentColor" />
										<circle cx="7.5" cy={cy} r="1.2" fill="currentColor" />
									{/each}
								</svg>
							</button>
						</Tooltip>
					</div>

					<!-- ── The clause itself: a rule, an indent, and prose ────────── -->
					<div
						class="relative min-w-0 border-l-2 transition-[border-color,background-color] py-1
						       {lit
							? 'border-l-[var(--accent)]'
							: mode === 'write'
								? 'border-l-[var(--border)] group-hover:border-l-[var(--border-strong)]'
								: 'border-l-transparent group-hover:border-l-[var(--border-strong)]'}"
						style:padding-left="{0.9 + (s.level - 1) * 1}rem"
						style:border-left-color={a === ANCHOR.reanchor && !lit
							? 'color-mix(in srgb, var(--palette-amber) 45%, transparent)'
							: undefined}
						style:background={lit
							? 'color-mix(in srgb, var(--accent) 4%, transparent)'
							: undefined}
					>
						<!-- The dock floats OUTSIDE the text measure, so revealing it
						     shifts nothing. It is furniture beside the page, not a
						     toolbar attached to a card edge. -->
						<div
							class="absolute top-1 -right-[3.1rem] z-10 transition-opacity
							       {lit || bind_worst || cs.length > 0 || secs.length > 0
								? 'opacity-100'
								: 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}"
						>
							<SectionDock
								open={panel}
								control_count={secs.length}
								evidence_count={cited.length}
								{gap}
								stale={worst === 'stale' || worst === 'expired'}
								comment_count={cs.length}
								check_count={binds.length}
								check_status={bind_worst}
								drift={!!s.drift && drift_open === 'unresolved'}
								ontoggle={(pnl) => toggle(s.section_id, pnl)}
							/>
						</div>
						<!-- The section id, quiet until wanted. -->
						<button
							class="flex items-center gap-1 mb-1 text-left transition-opacity hover:opacity-80
							       {on || a === ANCHOR.reanchor
								? 'opacity-100'
								: 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
							style:color={a.color}
							onclick={() => onselect(s.section_id)}
							aria-label="Inspect section {s.heading}"
						>
							<Icon name={a.icon} size={10} />
							<code class="font-mono text-[0.55rem] tracking-[0.04em]">{s.section_id}</code>
						</button>

						{#if mode === 'write'}
							<!-- Heading first, because renaming it is the consequential edit. -->
							<input
								class="w-full mb-2 px-2 py-1 -ml-2 rounded border border-transparent bg-transparent
								       font-semibold text-[var(--fg)] tracking-[-0.01em]
								       hover:border-[var(--border)] focus:border-[var(--border-accent)]
								       focus:bg-[var(--surface-raised)] outline-none
								       {s.level === 1 ? 'text-[1.5rem] leading-[1.2]' : 'text-[1.15rem] leading-[1.3]'}"
								value={s.heading}
								oninput={(e) => onheading(s.section_id, e.currentTarget.value)}
								onfocus={() => onselect(s.section_id)}
								aria-label="Heading"
							/>

							{#if isRenamed(s)}
								<!-- The whole argument for editing here rather than in the repo. -->
								<p
									class="flex items-start gap-2 m-0 mb-2 px-2 py-1.5 rounded border font-mono text-[0.6rem] leading-[1.5]"
									style:color="#34d399"
									style:border-color="color-mix(in srgb, #34d399 35%, transparent)"
									style:background="color-mix(in srgb, #34d399 8%, transparent)"
								>
									<Icon name="link" size={11} />
									<span>
										Renamed in place — <code>{s.section_id}</code> is kept and
										{boundCount(s)} references follow it. Logged to the anchor history on commit; no
										re-anchoring decision is created.
									</span>
								</p>
							{/if}

							<textarea
								class="w-full px-2 py-1.5 -ml-2 rounded border border-[var(--border)] bg-[var(--input-bg)]
								       font-mono text-[0.72rem] leading-[1.7] text-[var(--fg-muted)]
								       focus:border-[var(--border-accent)] outline-none resize-y"
								rows={Math.max(3, s.body_md.split('\n').length + 1)}
								value={s.body_md}
								oninput={(e) => onbody(s.section_id, e.currentTarget.value)}
								onfocus={() => onselect(s.section_id)}
								aria-label="Section body, markdown"
							></textarea>
						{:else}
							<svelte:element
								this={s.level === 1 ? 'h1' : 'h2'}
								class="m-0 mb-3 font-semibold text-[var(--fg)]
								       {s.level === 1
									? 'text-[1.75rem] leading-[1.15] tracking-[-0.02em]'
									: 'text-[1.25rem] leading-[1.25] tracking-[-0.01em]'}"
							>
								{s.heading}
							</svelte:element>

							<div class="doc-prose">
								<Prose html={s.body_html} maxWidth="100%" as="div" />
							</div>

							<!-- Code appears ONLY where a document is allowed to hold it.
							     A policy renders none: the clause states the rule, and
							     the command that proves it is bound, not embedded. -->
							{#if shows_code}
								{#each s.blocks as b (b.block_id)}
									<CommandBlock
										block={b}
										command={b.command_id ? (by_command.get(b.command_id) ?? null) : null}
									/>
								{/each}
							{/if}
						{/if}

						<!-- Everything the clause carries beyond its prose, revealed from
						     the right gutter and rendered through one callout shape. -->
						{#if panel === 'identity' && s.drift}
							<DriftBanner
								drift={s.drift}
								section_id={s.section_id}
								bound={boundCount(s)}
								resolution={drift_open}
								onresolve={(r) => onresolve(s.section_id, r)}
							/>
						{/if}

						<!-- Comments, not verdicts. A document is approved or it isn't;
						     there is nothing to flag at clause level, so a reviewer just
						     says the thing they wanted to say. -->
						{#if panel === 'comments'}
							<SectionCallout
								icon="message-square"
								label="Comments · {cs.length}"
								accent="var(--fg-dim)"
							>
								{#each cs as c (c.id)}
									<div class="flex flex-col gap-1">
										<div class="flex items-baseline gap-2">
											<span class="font-mono text-[0.62rem] text-[var(--fg)]">{c.author}</span>
											<span class="font-mono text-[0.58rem] text-[var(--fg-dim)]">{c.at}</span>
										</div>
										<p class="m-0 text-[0.78rem] leading-[1.6] text-[var(--fg-muted)]">{c.body}</p>
									</div>
								{/each}

								<textarea
									class="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--input-bg)]
									       text-[0.78rem] leading-[1.5] text-[var(--fg-muted)] resize-y
									       focus:border-[var(--border-accent)] outline-none"
									rows={2}
									placeholder="Add a comment…"
									aria-label="Add a comment"
								></textarea>
							</SectionCallout>
						{/if}

						{#if panel === 'evidence'}
							<EvidenceRail
								controls={secs}
								{cited}
								cadence_days={cadence}
								can_run={binds.length > 0}
								onlink={() => onlink(s.section_id)}
								ondetach={(ev) => ondetach(s.section_id, ev)}
								onrun={() => onemit(s.section_id)}
							/>
						{/if}

						{#if panel === 'checks'}
							<CheckRail
								bindings={binds}
								{by_command}
								cadence_days={cadence}
								running_id={running_binding_id}
								onbind={() => onbind(s.section_id)}
								{onunbind}
								onrun={onrunbinding}
								{onhistory}
							/>
						{/if}
					</div>
				</section>
			{/each}

			<p class="mt-10 text-center font-mono text-[0.55rem] text-[var(--fg-dim)] opacity-60">
				end of {doc.path} · {doc.doc_id} v{doc.version}
			</p>
		{/if}
	</div>
</div>

<style>
	/* Prose owns the reading typography; we only pin its measure and leading
	   onto the scale the rest of this pane uses. */
	.doc-prose :global(.prose) {
		font-size: var(--t-lead);
		line-height: var(--lh-prose);
	}
	.doc-prose :global(.prose p:last-child) {
		margin-bottom: 0;
	}
</style>
