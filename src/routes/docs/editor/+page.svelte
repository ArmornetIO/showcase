<script lang="ts">
	// The document editor's parts, assembled over sample data.
	import DocEditorFrame from '$lib/docs/editor/DocEditorFrame.svelte';
	import DocRail from '$lib/docs/editor/DocRail.svelte';
	import DocToolbar from '$lib/docs/editor/DocToolbar.svelte';
	import DocSegments from '$lib/docs/editor/DocSegments.svelte';
	import DocCommitButton from '$lib/docs/editor/DocCommitButton.svelte';
	import SectionCanvas from '$lib/docs/editor/SectionCanvas.svelte';
	import type { CanvasMode, CanvasSection } from '$lib/docs/editor/SectionCanvas.svelte';
	import SectionDock from '$lib/docs/editor/SectionDock.svelte';
	import SectionCallout from '$lib/docs/editor/SectionCallout.svelte';
	import type { InsertItem } from '$lib/docs/editor/InsertMenu.svelte';
	import Icon from '$lib/icons/Icon.svelte';

	const OPENED: CanvasSection[] = [
		{
			id: 'purpose',
			title: 'Purpose',
			level: 2,
			body: 'Access to production is granted by role, never by person.',
			html: '<p>Access to production is granted by role, never by person.</p>'
		},
		{
			id: 'review',
			title: 'Quarterly review',
			level: 2,
			body: 'Every grant is reviewed **each quarter** by its owner.',
			html: '<p>Every grant is reviewed <strong>each quarter</strong> by its owner.</p>'
		},
		{
			id: 'revocation',
			title: 'Revocation',
			level: 3,
			body: 'Leavers lose access within one business day.',
			html: '<p>Leavers lose access within one business day.</p>',
			tone: 'var(--palette-amber)'
		}
	];

	let sections = $state<CanvasSection[]>(OPENED.map((s) => ({ ...s, was: s.title })));
	let mode = $state<CanvasMode | 'preview'>('edit');
	let kind = $state('docs');
	let selected = $state<string | null>(null);
	let open = $state<Record<string, string | null>>({});
	let query = $state('');

	const dirty = $derived(
		sections.filter((s, i) => {
			const o = OPENED.find((x) => x.id === s.id);
			return !o || o.title !== s.title || o.body !== s.body || OPENED[i]?.id !== s.id;
		}).length
	);

	const INSERT: InsertItem[] = [
		{ id: 'h2', label: 'Section', hint: 'A new section with its own id', icon: 'file-text', group: 'Content' },
		{ id: 'code', label: 'Code block', hint: 'Fenced code', icon: 'code', group: 'Content' }
	];

	function patch(id: string, p: Partial<CanvasSection>) {
		sections = sections.map((s) => (s.id === id ? { ...s, ...p } : s));
	}

	function reorder(from: string, to: string, edge: 'above' | 'below') {
		const next = sections.filter((s) => s.id !== from);
		const at = next.findIndex((s) => s.id === to);
		next.splice(edge === 'above' ? at : at + 1, 0, sections.find((s) => s.id === from)!);
		sections = next;
	}

	function append(title: string, body: string) {
		const id = `new-${sections.length}`;
		sections = [...sections, { id, title: title || 'New section', level: 2, body }];
		selected = id;
	}

	function insert(after: string, item: InsertItem) {
		const id = `new-${sections.length}`;
		const at = sections.findIndex((s) => s.id === after);
		const body = item.id === 'code' ? '```sh\necho hi\n```' : '';
		sections = sections.toSpliced(at + 1, 0, { id, title: 'New section', level: 2, body });
		selected = id;
	}
</script>

<DocEditorFrame>
	{#snippet header()}
		<header
			class="flex min-h-[2.9rem] items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2"
		>
			<div class="flex min-w-0 items-center gap-2">
				<Icon name="git-fork" size={13} style="color: var(--fg-dim)" />
				<span class="truncate font-(family-name:--mono) text-[0.72rem] text-[var(--fg)]"
					>acme/policies</span
				>
				<span class="font-(family-name:--mono) text-[0.58rem] text-[var(--fg-dim)]">docs/</span>
			</div>
			<span class="flex-1"></span>
			<DocCommitButton count={dirty} verb="Propose" onclick={() => {}} />
		</header>
	{/snippet}

	{#snippet rail()}
		<DocRail
			bind:query
			ref="main"
			sha="a91f2c4"
			status="healthy"
			statusTip="synced 2 min ago"
			lines={['docs: tighten revocation wording', 'jdoe · 2 hours ago']}
			nodes={[
				{ name: 'policies', path: 'policies', depth: 0, is_dir: true, expanded: true },
				{ name: 'Access control', path: 'policies/ac.md', depth: 1, is_dir: false },
				{ name: 'Incident response', path: 'policies/ir.md', depth: 1, is_dir: false }
			]}
			selectedPath="policies/ac.md"
			onselect={() => {}}
			footer={['2 documents', 'acme/policies/docs']}
		/>
	{/snippet}

	<DocToolbar id="POL-AC" title="Access control" version="3" status={{ label: 'draft', color: '#fbbf24' }}>
		{#snippet end()}
			<DocSegments
				label="Kind"
				value={kind}
				onchange={(v) => (kind = v)}
				options={['docs', 'post', 'split', 'editorial', 'changelog'].map((k) => ({
					value: k,
					label: k === 'docs' ? 'default' : k
				}))}
			/>
			<DocSegments
				label="View"
				value={mode}
				onchange={(v) => (mode = v as CanvasMode | 'preview')}
				options={[
					{ value: 'preview', label: 'Preview' },
					{ value: 'edit', label: 'Edit' },
					{ value: 'raw', label: 'Raw' }
				]}
			/>
		{/snippet}
	</DocToolbar>

	<div class="min-h-0 flex-1">
		{#if mode === 'preview'}
			<p class="p-10 text-center font-(family-name:--mono) text-[0.65rem] text-[var(--fg-dim)]">
				Preview renders through the host app's layout for the chosen kind.
			</p>
		{:else}
			<SectionCanvas
				{mode}
				{sections}
				path="policies/ac.md"
				source={sections.map((s) => `${'#'.repeat(s.level)} ${s.title}\n\n${s.body}`).join('\n\n')}
				selectedId={selected}
				onselect={(id) => (selected = id)}
				onheading={(id, title) => patch(id, { title })}
				onbody={(id, body) => patch(id, { body, html: undefined })}
				onreorder={reorder}
				insertItems={INSERT}
				oninsert={insert}
				onappend={append}
				pinDock={(s) => s.id === 'review'}
				frontmatterSummary="owner: security · review: quarterly"
				footer="end of policies/ac.md · POL-AC v3"
			>
				{#snippet frontmatter()}
					<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-(family-name:--mono) text-[0.6rem]">
						<dt class="text-[var(--fg-dim)]">owner</dt>
						<dd class="m-0">security</dd>
						<dt class="text-[var(--fg-dim)]">review_cycle</dt>
						<dd class="m-0">quarterly</dd>
					</dl>
				{/snippet}
				{#snippet dock(s)}
					<SectionDock
						open={open[s.id] ?? null}
						ontoggle={(id) => (open = { ...open, [s.id]: open[s.id] === id ? null : id })}
						items={[
							{
								id: 'checks',
								icon: 'zap',
								label: s.id === 'review' ? '1 check' : 'Bind a check',
								count: s.id === 'review' ? 1 : 0,
								lit: s.id === 'review'
							},
							{ id: 'comments', icon: 'message-square', label: 'Comment on this section' }
						]}
					/>
				{/snippet}
				{#snippet panel(s)}
					{#if open[s.id] === 'checks'}
						<SectionCallout icon="zap" label="Checks · 1">
							<p class="m-0 text-[0.78rem] text-[var(--fg-muted)]">iam.list_grants — passed 2 days ago</p>
						</SectionCallout>
					{/if}
				{/snippet}
			</SectionCanvas>
		{/if}
	</div>
</DocEditorFrame>
