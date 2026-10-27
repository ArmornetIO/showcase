<script lang="ts" module>
	/** edit = rendered sections, each editable in place · raw = the whole file. */
	export type CanvasMode = 'edit' | 'raw';

	/** One addressable part of a document. */
	export interface CanvasSection {
		/** Opaque identity that survives a rewording — the join key for anything docked to it. */
		id: string;
		/** Heading text. Empty for a document with no headings, edited whole. */
		title: string;
		level: number;
		/** Body markdown, WITHOUT the heading line. */
		body: string;
		/** Rendered body. Absent while no renderer is loaded; the markdown shows instead. */
		html?: string;
		/** The heading as opened. A difference shows the rename note. */
		was?: string;
		/** Spine and id tone for a section that needs attention (drift, say). */
		tone?: string;
	}
</script>

<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// SECTION CANVAS — a markdown document read and edited section by section.
	//
	// LAYOUT — prose with affordances, never a card. A section has NO enclosing
	// boundary: its identity lives in a gutter spine, indented by heading level so
	// the hierarchy reads in the margin once the headings have scrolled away.
	//
	// GUTTERS, revealed on hover and split by job. STRUCTURE verbs (insert after me,
	// move me) sit left; BINDING verbs (what is attached to me) dock right, outside
	// the text measure, so revealing them shifts nothing.
	//
	// EDITING IN PLACE. A section reads as rendered prose until you click it; then
	// its heading and body become inputs where they stood. There is no separate
	// write view to lose your place in.
	//
	// DRAG carries the section id with the prose, so a reorder made here needs no
	// re-anchoring — the same move made by hand in the repo is what produces drift.
	// ─────────────────────────────────────────────────────────────────────────
	import type { Snippet } from 'svelte';
	import Icon from '../../icons/Icon.svelte';
	import Tooltip from '../../primitives/status/Tooltip.svelte';
	import Collapsible from '../../primitives/chrome/Collapsible.svelte';
	import CodeBlock from '../../display/code/CodeBlock.svelte';
	import Prose from '../Prose.svelte';
	import InsertMenu from './InsertMenu.svelte';
	import type { InsertItem } from './InsertMenu.svelte';

	interface Props {
		mode: CanvasMode;
		sections: CanvasSection[];
		/** The whole file, for raw mode. */
		source: string;
		/** Title of the raw view — the file path. */
		path: string;
		/** Rendered prose ahead of the first heading, which belongs to no section. */
		lead?: string;
		loading?: boolean;
		selectedId?: string | null;
		onselect?: (id: string | null) => void;
		onheading?: (id: string, text: string) => void;
		onbody?: (id: string, markdown: string) => void;
		/** Enables the drag grip. */
		onreorder?: (fromId: string, toId: string, edge: 'above' | 'below') => void;
		/** Enables the insert `+`. */
		insertItems?: InsertItem[];
		oninsert?: (afterId: string, item: InsertItem) => void;
		/** Enables the standing tail draft: a new-section affordance that is always
		 *  there but stays local until something is written into it. */
		onappend?: (title: string, body: string) => void;
		/** Right-margin dock for a section. */
		dock?: Snippet<[CanvasSection]>;
		/** Keeps a section's dock visible at rest — it carries something worth seeing. */
		pinDock?: (s: CanvasSection) => boolean;
		/** Expanded under a section's text — a dock item's panel. */
		panel?: Snippet<[CanvasSection]>;
		/** Folded metadata above the first section. */
		frontmatter?: Snippet;
		/** Shown beside the fold's label while closed. */
		frontmatterSummary?: string;
		/** The quiet line that closes the document. */
		footer?: string;
		emptyMessage?: string;
	}

	let {
		mode,
		sections,
		source,
		path,
		lead = '',
		loading = false,
		selectedId = null,
		onselect,
		onheading,
		onbody,
		onreorder,
		insertItems,
		oninsert,
		onappend,
		dock,
		pinDock,
		panel,
		frontmatter,
		frontmatterSummary = '',
		footer,
		emptyMessage = 'This document has no content.'
	}: Props = $props();

	let fmOpen = $state(false);
	// The tail draft is LOCAL state, not a buffer entry: an untouched draft must
	// leave no trace, so nothing exists to diff or propose until commitDraft.
	let draftTitle = $state('');
	let draftBody = $state('');
	let draftFocus = $state(false);
	let dragId = $state<string | null>(null);
	let dropTarget = $state<{ id: string; edge: 'above' | 'below' } | null>(null);
	let insertAt = $state<{ afterId: string; x: number; y: number } | null>(null);
	let page = $state<HTMLElement | null>(null);

	function dragOver(e: DragEvent, id: string) {
		if (!dragId || dragId === id) return;
		e.preventDefault();
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		dropTarget = { id, edge: e.clientY < box.top + box.height / 2 ? 'above' : 'below' };
	}

	function drop(e: DragEvent) {
		e.preventDefault();
		if (dragId && dropTarget && dragId !== dropTarget.id) {
			onreorder?.(dragId, dropTarget.id, dropTarget.edge);
		}
		dragId = null;
		dropTarget = null;
	}

	function openInsert(e: MouseEvent, afterId: string) {
		const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const p = page?.getBoundingClientRect();
		insertAt = { afterId, x: b.right + 8 - (p?.left ?? 0), y: b.top - (p?.top ?? 0) };
	}

	// Rows sized from the content: a scrolling textarea inside a scrolling page is two
	// scrollbars for one piece of text.
	const rows = (md: string) => Math.max(3, md.split('\n').length + 1);

	function commitDraft() {
		if (!draftTitle.trim() && !draftBody.trim()) return;
		onappend?.(draftTitle.trim(), draftBody);
		draftTitle = '';
		draftBody = '';
	}

	const ICON_BTN =
		'flex h-[22px] w-[20px] items-center justify-center rounded text-[var(--fg-dim)]';
</script>

<div class="h-full overflow-y-auto bg-[var(--bg)]">
	<!-- The whole content area, like a document editor's page: the only margins are
	     the section gutters, which carry the verbs and the dock. -->
	<div bind:this={page} class="relative px-2 pt-5 pb-[30vh]">
		{#if loading}
			<p class="m-0 py-10 text-center font-(family-name:--mono) text-[0.65rem] text-[var(--fg-dim)]">
				Loading document…
			</p>
		{:else if mode === 'raw'}
			<!-- An editor that cannot show you the file is not credible. -->
			<CodeBlock code={source} title={path} copy wrap />
		{:else}
			{#if frontmatter}
				<!-- Metadata, not prose: one line until asked. -->
				<div class="mx-[3.5rem] mb-5">
					<Collapsible bind:open={fmOpen}>
						{#snippet trigger({ open, toggle })}
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded border border-transparent px-1.5 py-1 text-left text-[var(--fg-dim)] hover:border-[var(--border)] hover:bg-[var(--surface-raised)]"
								onclick={toggle}
								aria-expanded={open}
							>
								<Icon name={open ? 'chevron-down' : 'chevron-right'} size={11} />
								<span class="font-(family-name:--mono) text-[0.55rem] tracking-[0.1em] uppercase"
									>frontmatter</span
								>
								<span class="truncate font-(family-name:--mono) text-[0.58rem] opacity-75"
									>{frontmatterSummary}</span
								>
							</button>
						{/snippet}
						<div
							class="mt-1.5 rounded border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2"
						>
							{@render frontmatter()}
						</div>
					</Collapsible>
				</div>
			{/if}

			{#if lead}
				<div class="mx-[3.5rem] mb-8 pl-[1.1rem]">
					<Prose html={lead} density="compact" maxWidth="100%" as="div" />
				</div>
			{/if}

			{#each sections as s, i (s.id)}
				{@const on = selectedId === s.id}
				<!-- Without an edit callback the document is read-only: selecting a
				     section lights it, and nothing turns into an input that goes nowhere. -->
				{@const editing = on && !!onbody}
				{@const renamed = s.was !== undefined && s.was !== s.title}
				<section
					id="section-{s.id}"
					class="group relative grid scroll-mt-6 transition-opacity {dragId === s.id
						? 'opacity-40'
						: ''} {i > 0 ? (s.level <= 1 ? 'mt-12' : 'mt-8') : ''}"
					style:grid-template-columns="3.5rem minmax(0, 1fr) 3.5rem"
					ondragover={(e) => dragOver(e, s.id)}
					ondrop={drop}
					role="listitem"
				>
					{#if dropTarget?.id === s.id}
						<div
							class="absolute right-[3.5rem] left-[3.5rem] z-10 h-[2px] rounded-full bg-[var(--accent)]"
							style:top={dropTarget.edge === 'above' ? '-0.9rem' : 'auto'}
							style:bottom={dropTarget.edge === 'below' ? '-0.9rem' : 'auto'}
						></div>
					{/if}

					<!-- LEFT GUTTER: structure verbs. -->
					<div
						class="flex items-start justify-end gap-0.5 pt-0.5 pr-2 transition-opacity {on
							? 'opacity-60'
							: 'opacity-0'} group-hover:opacity-100 focus-within:opacity-100"
					>
						{#if insertItems && oninsert}
							<Tooltip content="Insert a block after this section" placement="left" delay={300}>
								<button
									type="button"
									class="{ICON_BTN} hover:bg-[var(--accent-faint)] hover:text-[var(--accent)]"
									onclick={(e) => openInsert(e, s.id)}
									aria-label="Insert block after {s.title || 'this section'}"
								>
									<Icon name="plus" size={13} />
								</button>
							</Tooltip>
						{/if}
						{#if onreorder}
							<Tooltip content="Drag to reorder — the id travels with it" placement="left" delay={300}>
								<button
									type="button"
									class="{ICON_BTN} cursor-grab hover:bg-[var(--surface-strong)] hover:text-[var(--fg)] active:cursor-grabbing"
									draggable="true"
									ondragstart={(e) => {
										dragId = s.id;
										e.dataTransfer?.setData('text/plain', s.id);
										if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
									}}
									ondragend={() => {
										dragId = null;
										dropTarget = null;
									}}
									aria-label="Reorder {s.title || 'this section'}"
								>
									<!-- The six-dot grip is the glyph everyone reads as "pick me up". -->
									<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
										{#each [2, 7, 12] as cy (cy)}
											<circle cx="2.5" {cy} r="1.2" fill="currentColor" />
											<circle cx="7.5" {cy} r="1.2" fill="currentColor" />
										{/each}
									</svg>
								</button>
							</Tooltip>
						{/if}
					</div>

					<!-- The section: a rule, an indent, and prose. -->
					<div
						class="relative min-w-0 border-l-2 py-1 transition-[border-color,background-color] {on
							? 'border-l-[var(--accent)]'
							: 'border-l-transparent group-hover:border-l-[var(--border-strong)]'}"
						style:padding-left="{0.9 + Math.max(0, s.level - 1) * 1}rem"
						style:border-left-color={s.tone && !on
							? `color-mix(in srgb, ${s.tone} 45%, transparent)`
							: undefined}
						style:background={on ? 'color-mix(in srgb, var(--accent) 4%, transparent)' : undefined}
					>
						{#if s.title}
							<button
								type="button"
								class="mb-1 flex items-center gap-1 text-left transition-opacity hover:opacity-80 {on ||
								s.tone
									? 'opacity-100'
									: 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
								style:color={s.tone ?? 'var(--fg-dim)'}
								onclick={() => onselect?.(on ? null : s.id)}
								aria-label="Select section {s.title}"
							>
								<Icon name={s.tone ? 'alert-triangle' : 'link'} size={10} />
								<code class="font-(family-name:--mono) text-[0.55rem] tracking-[0.04em]">{s.id}</code>
							</button>
						{/if}

						{#if editing}
							{#if s.title}
								<!-- Heading first: renaming it is the consequential edit. -->
								<input
									class="-ml-2 mb-2 w-full rounded border border-transparent bg-transparent px-2 py-1 font-semibold tracking-[-0.01em] text-[var(--fg)] outline-none hover:border-[var(--border)] focus:border-[var(--border-accent)] focus:bg-[var(--surface-raised)] {s.level <=
									1
										? 'text-[1.5rem] leading-[1.2]'
										: 'text-[1.15rem] leading-[1.3]'}"
									value={s.title}
									oninput={(e) => onheading?.(s.id, e.currentTarget.value)}
									onkeydown={(e) => e.key === 'Escape' && onselect?.(null)}
									aria-label="Heading"
								/>
								{#if renamed}
									<p
										class="m-0 mb-2 flex items-start gap-2 rounded border px-2 py-1.5 font-(family-name:--mono) text-[0.6rem] leading-[1.5]"
										style:color="var(--palette-emerald-l, #34d399)"
										style:border-color="color-mix(in srgb, var(--palette-emerald-l, #34d399) 35%, transparent)"
										style:background="color-mix(in srgb, var(--palette-emerald-l, #34d399) 8%, transparent)"
									>
										<Icon name="link" size={11} />
										<span>
											Renamed in place from “{s.was}” — <code>{s.id}</code> is kept, so anything
											bound to this section follows it.
										</span>
									</p>
								{/if}
							{/if}
							<!-- Markdown, not rich text: the file is the artifact, and every
							     WYSIWYG round trip is a chance to reformat somebody's document. -->
							<!-- svelte-ignore a11y_autofocus -->
							<textarea
								class="-ml-2 w-full resize-y rounded border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1.5 font-(family-name:--mono) text-[0.72rem] leading-[1.7] text-[var(--fg-muted)] outline-none focus:border-[var(--border-accent)]"
								rows={rows(s.body)}
								value={s.body}
								autofocus={!s.title}
								oninput={(e) => onbody?.(s.id, e.currentTarget.value)}
								onkeydown={(e) => e.key === 'Escape' && onselect?.(null)}
								aria-label="Markdown for {s.title || 'this document'}"
							></textarea>
						{:else}
							<!-- Clicking the prose is how you start editing it (or, read-only, select it). -->
							<div
								class={onbody ? 'cursor-text' : 'cursor-default'}
								role="button"
								tabindex="0"
								onclick={() => onselect?.(on && !onbody ? null : s.id)}
								onkeydown={(e) => e.key === 'Enter' && onselect?.(s.id)}
							>
								{#if s.title}
									<svelte:element
										this={s.level <= 1 ? 'h1' : s.level === 2 ? 'h2' : 'h3'}
										class="m-0 mb-3 font-semibold text-[var(--fg)] {s.level <= 1
											? 'text-[1.75rem] leading-[1.15] tracking-[-0.02em]'
											: s.level === 2
												? 'text-[1.25rem] leading-[1.25] tracking-[-0.01em]'
												: 'text-[1.05rem] leading-[1.3]'}"
									>
										{s.title}
									</svelte:element>
								{/if}
								{#if s.html !== undefined}
									<Prose html={s.html} density="compact" maxWidth="100%" as="div" />
								{:else if s.body.trim()}
									<p
										class="m-0 font-(family-name:--mono) text-[0.72rem] leading-[1.7] whitespace-pre-wrap text-[var(--fg-muted)]"
									>
										{s.body}
									</p>
								{/if}
							</div>
						{/if}

						{#if panel}{@render panel(s)}{/if}
					</div>

					<!-- RIGHT GUTTER: the dock. Reserved even when empty, so the text is
					     centred between two equal margins and revealing it shifts nothing. -->
					<div
						class="flex justify-center transition-opacity {on || pinDock?.(s)
							? 'opacity-100'
							: 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}"
					>
						{#if dock}{@render dock(s)}{/if}
					</div>
				</section>
			{/each}

			{#if onappend}
				<!-- The standing tail: a next section that is always on offer but is
				     nobody's edit until something is typed. Committed on leaving or
				     Enter; an untouched draft never reaches the buffer. -->
				<section
					class="group relative grid {sections.length > 0 ? 'mt-12' : ''}"
					style:grid-template-columns="3.5rem minmax(0, 1fr) 3.5rem"
				>
					<div></div>
					<div
						class="relative min-w-0 border-0 border-l-2 [border-left-style:dashed] py-1 pl-[0.9rem] transition-[border-color,opacity] {draftFocus
							? 'border-l-[var(--accent)] opacity-100'
							: 'border-l-[var(--border)] opacity-50 group-hover:opacity-80'}"
						onfocusin={() => (draftFocus = true)}
						onfocusout={(e) => {
							if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
							draftFocus = false;
							commitDraft();
						}}
					>
						<div class="mb-1 flex items-center gap-1 text-[var(--fg-dim)]">
							<Icon name="plus" size={10} />
							<span class="font-(family-name:--mono) text-[0.55rem] tracking-[0.04em]"
								>new section — kept only once you write in it</span
							>
						</div>
						<input
							class="-ml-2 w-full rounded border border-transparent bg-transparent px-2 py-1 text-[1.15rem] leading-[1.3] font-semibold tracking-[-0.01em] text-[var(--fg)] outline-none placeholder:text-[var(--fg-dim)] hover:border-[var(--border)] focus:border-[var(--border-accent)] focus:bg-[var(--surface-raised)]"
							placeholder="New section"
							bind:value={draftTitle}
							onkeydown={(e) => {
								if (e.key === 'Enter') commitDraft();
								if (e.key === 'Escape') {
									draftTitle = '';
									draftBody = '';
								}
							}}
							aria-label="New section heading"
						/>
						{#if draftFocus || draftTitle.trim() || draftBody.trim()}
							<textarea
								class="-ml-2 mt-2 w-full resize-y rounded border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1.5 font-(family-name:--mono) text-[0.72rem] leading-[1.7] text-[var(--fg-muted)] outline-none focus:border-[var(--border-accent)]"
								rows={rows(draftBody)}
								bind:value={draftBody}
								placeholder="Write markdown…"
								onkeydown={(e) => {
									if (e.key === 'Escape') {
										draftTitle = '';
										draftBody = '';
									}
								}}
								aria-label="Markdown for the new section"
							></textarea>
						{/if}
					</div>
					<div></div>
				</section>
			{/if}

			{#if sections.length === 0 && !lead && !onappend}
				<p class="m-0 py-10 text-center font-(family-name:--mono) text-[0.65rem] text-[var(--fg-dim)]">
					{emptyMessage}
				</p>
			{/if}

			{#if footer}
				<p
					class="mt-10 text-center font-(family-name:--mono) text-[0.55rem] text-[var(--fg-dim)] opacity-60"
				>
					{footer}
				</p>
			{/if}
		{/if}

		{#if insertItems}
			<InsertMenu
				open={!!insertAt}
				items={insertItems}
				x={insertAt?.x ?? 0}
				y={insertAt?.y ?? 0}
				oninsert={(item) => {
					const at = insertAt;
					insertAt = null;
					if (at) oninsert?.(at.afterId, item);
				}}
				onclose={() => (insertAt = null)}
			/>
		{/if}
	</div>
</div>
