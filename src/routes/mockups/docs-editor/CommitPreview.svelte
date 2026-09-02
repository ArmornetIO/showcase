<script lang="ts">
	// Commit is the moment the product's central architectural claim becomes
	// visible, so it is the one screen that states it outright: PROSE goes to
	// the customer's repo as an ordinary git commit; the IDENTITY GRAPH — section
	// ids, anchor history, citations, anchor decisions — stays in Armornet and
	// never appears in the repo at all.
	//
	// Every docs-as-code tool has a commit dialog. What none of them can show is
	// the second column, because they have nothing to put in it. Splitting the
	// review this way is also practically useful: it answers "what will my
	// engineers see in the PR?" and "what did I change that they won't?" as two
	// separate questions, which is exactly how the two audiences read it.

	import { Icon, Modal } from 'showcase';
	import SectionCallout from './SectionCallout.svelte';

	export interface ProseChange {
		section_id: string;
		heading: string;
		kind: 'heading' | 'body' | 'both';
		/** The previous heading, when this change renamed one. */
		was: string | null;
	}

	export interface GraphChange {
		kind: 'rename' | 'citation_added' | 'citation_removed' | 'anchor_resolved';
		section_id: string;
		detail: string;
	}

	interface Props {
		open: boolean;
		repo: string;
		branch: string;
		path: string;
		prose: ProseChange[];
		graph: GraphChange[];
		onclose: () => void;
		oncommit: (message: string) => void;
	}

	let { open, repo, branch, path, prose, graph, onclose, oncommit }: Props = $props();

	let message = $state('policy(access): revise clauses and refresh evidence');

	const GRAPH_LOOK: Record<GraphChange['kind'], { icon: 'link' | 'plus' | 'x' | 'check-circle'; label: string; color: string }> = {
		rename: { icon: 'link', label: 'Rename logged', color: '#34d399' },
		citation_added: { icon: 'plus', label: 'Citation added', color: 'var(--accent)' },
		citation_removed: { icon: 'x', label: 'Citation removed', color: '#fb7185' },
		anchor_resolved: { icon: 'check-circle', label: 'Anchor decision', color: '#34d399' }
	};

	const nothing = $derived(prose.length === 0 && graph.length === 0);
</script>

<Modal {open} {onclose} size="lg" title="Commit changes">
	<div class="flex items-center gap-2 flex-wrap pb-3 border-b border-[var(--border)]">
		<Icon name="git-branch" size={13} style="color: var(--fg-dim)" />
		<span class="font-mono text-[0.66rem] text-[var(--fg)]">{repo}</span>
		<span class="font-mono text-[0.6rem] text-[var(--fg-dim)]">{branch}</span>
		<span class="flex-1"></span>
		<span class="font-mono text-[0.6rem] text-[var(--fg-dim)] truncate">{path}</span>
	</div>

	{#if nothing}
		<p class="py-8 m-0 text-center font-mono text-[0.66rem] text-[var(--fg-dim)]">
			Nothing to commit — the document matches HEAD.
		</p>
	{:else}
		<div class="flex flex-col gap-2 pt-3">
			<!-- Column one: what the engineers will see in the PR. -->
			<SectionCallout
				icon="git-merge"
				label="To the repo · {prose.length} section{prose.length === 1 ? '' : 's'} · one commit"
				accent="var(--accent)"
			>
				{#snippet status()}
					<span class="shrink-0 font-mono text-[0.58rem] text-[var(--fg-dim)]">
						markdown only
					</span>
				{/snippet}

				{#if prose.length === 0}
					<p class="m-0 text-[0.78rem] leading-[1.6] text-[var(--fg-muted)]">
						No prose changed. This commit would be empty — everything below is ours.
					</p>
				{:else}
					{#each prose as c (c.section_id)}
						<div class="flex items-center gap-2 min-w-0 font-mono text-[0.64rem]">
							<span class="shrink-0 text-[var(--accent)]">
								{c.kind === 'heading' ? 'H' : c.kind === 'body' ? 'B' : 'HB'}
							</span>
							<span class="truncate text-[var(--fg)]">{c.heading}</span>
							{#if c.was}
								<span class="shrink-0 text-[var(--fg-dim)]">was “{c.was}”</span>
							{/if}
							<span class="flex-1"></span>
							<code class="shrink-0 text-[0.58rem] text-[var(--fg-dim)]">{c.section_id}</code>
						</div>
					{/each}
				{/if}
			</SectionCallout>

			<!-- Column two: what no docs-as-code tool can show you. -->
			<SectionCallout
				icon="shield-check"
				label="To Armornet · {graph.length} identity change{graph.length === 1 ? '' : 's'}"
				accent="#34d399"
			>
				{#snippet status()}
					<span class="shrink-0 font-mono text-[0.58rem] text-[var(--fg-dim)]">
						never enters the repo
					</span>
				{/snippet}

				{#if graph.length === 0}
					<p class="m-0 text-[0.78rem] leading-[1.6] text-[var(--fg-muted)]">
						No identity changes — no renames to log, no citations moved.
					</p>
				{:else}
					{#each graph as g, i (g.kind + g.section_id + i)}
						{@const look = GRAPH_LOOK[g.kind]}
						<div class="flex items-center gap-2 min-w-0 font-mono text-[0.64rem]">
							<span class="shrink-0" style:color={look.color}>
								<Icon name={look.icon} size={11} />
							</span>
							<span class="shrink-0" style:color={look.color}>{look.label}</span>
							<span class="truncate text-[var(--fg-muted)]">{g.detail}</span>
							<span class="flex-1"></span>
							<code class="shrink-0 text-[0.58rem] text-[var(--fg-dim)]">{g.section_id}</code>
						</div>
					{/each}
				{/if}
			</SectionCallout>

			<p class="m-0 px-1 text-[0.72rem] leading-[1.6] text-[var(--fg-dim)]">
				Prose is committed to <span class="font-mono text-[var(--fg-muted)]">{repo}</span> and is the
				source of truth. Section ids, the anchor history and every citation stay in Armornet keyed to
				<span class="font-mono text-[var(--fg-muted)]">(path, sha)</span> — so the repo never carries a
				manifest that could disagree with us.
			</p>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex items-center gap-2 w-full">
			<input
				class="flex-1 min-w-0 px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--input-bg)]
				       font-mono text-[0.66rem] text-[var(--fg)] outline-none focus:border-[var(--border-accent)]"
				bind:value={message}
				placeholder="Commit message…"
				aria-label="Commit message"
			/>
			<button
				class="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded border font-mono text-[0.62rem]
				       uppercase tracking-[0.1em] text-[var(--accent)] border-[var(--border-accent)]
				       bg-[var(--accent-faint)] hover:bg-[var(--accent-faint-strong)]
				       disabled:opacity-40 disabled:cursor-not-allowed"
				disabled={nothing || !message.trim()}
				onclick={() => oncommit(message)}
			>
				<Icon name="git-merge" size={12} />
				Commit
			</button>
		</div>
	{/snippet}
</Modal>
