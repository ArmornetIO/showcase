<script lang="ts">
	// ── ErdTableList — search + grouped table list sidebar ─────────────────────
	// Decoupled from the diagram: takes tables + groups + the current selection,
	// owns its own search query, and emits jumps. `focusSearch()` is exported so a
	// parent keyboard shortcut can focus the input without reaching into the DOM.
	import Icon from '../icons/Icon.svelte';
	import type { ErdTable, ErdGroup } from './types.js';

	let {
		tables,
		groups,
		selected = null,
		onjump
	}: {
		tables: ErdTable[];
		groups: Record<string, ErdGroup>;
		selected?: string | null;
		onjump: (name: string) => void;
	} = $props();

	let query = $state('');
	let searchEl = $state<HTMLInputElement | undefined>();

	export function focusSearch() {
		searchEl?.focus();
	}

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return tables;
		return tables.filter(
			(t) => t.name.toLowerCase().includes(q) || t.columns.some((c) => c.name.toLowerCase().includes(q))
		);
	});
	const listGroups = $derived(
		Object.entries(groups)
			.map(([id, g]) => ({ id, ...g, tables: filtered.filter((t) => t.group === id) }))
			.filter((g) => g.tables.length > 0)
	);

	function onInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && filtered.length > 0) {
			onjump(filtered[0].name);
			searchEl?.blur();
		} else if (e.key === 'Escape') {
			searchEl?.blur();
		}
	}
</script>

<aside class="erd-side">
	<div class="erd-search">
		<Icon name="zoom-in" size={13} />
		<input
			bind:this={searchEl}
			bind:value={query}
			onkeydown={onInputKeydown}
			placeholder="Jump to table or column — /"
			spellcheck="false"
		/>
	</div>
	<div class="erd-list">
		{#each listGroups as g (g.id)}
			<div class="erd-list-group">
				<span class="erd-list-dot" style:background={g.color}></span>{g.label}
				<span class="erd-list-n">{g.tables.length}</span>
			</div>
			{#each g.tables as t (t.name)}
				<button class="erd-list-item" class:sel={selected === t.name} onclick={() => onjump(t.name)}>
					<span class="erd-list-name">{t.name}</span>
					<span class="erd-list-meta">{t.columns.length}c{#if t.approxRows > 0}&nbsp;· {t.approxRows}r{/if}</span>
				</button>
			{/each}
		{/each}
		{#if filtered.length === 0}
			<div class="erd-empty">no tables match “{query}”</div>
		{/if}
	</div>
	<div class="erd-side-foot">
		<span class="k">/</span> search <span class="k">f</span> fit <span class="k">1·2·3</span> detail
		<span class="k">d</span> focus <span class="k">a</span> arrange <span class="k">esc</span> clear
	</div>
</aside>

<style>
	.erd-side {
		width: 236px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--border);
		background: var(--bg-elev);
		min-height: 0;
	}
	.erd-search {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
		color: var(--fg-muted);
	}
	.erd-search input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--fg);
		font-family: var(--mono);
		font-size: 0.74rem;
		outline: none;
	}
	.erd-search input::placeholder {
		color: var(--fg-muted);
	}
	.erd-list {
		flex: 1;
		overflow-y: auto;
		padding: 6px;
	}
	.erd-list-group {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 9px 6px 4px;
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--fg-muted);
	}
	.erd-list-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.erd-list-n {
		margin-left: auto;
	}
	.erd-list-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		padding: 4px 6px 4px 19px;
		border: none;
		background: transparent;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.72rem;
		text-align: left;
		border-radius: var(--radius-control);
		cursor: pointer;
	}
	.erd-list-item:hover {
		background: var(--bg);
		color: var(--fg);
	}
	.erd-list-item.sel {
		background: var(--accent-faint);
		color: var(--accent);
	}
	.erd-list-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.erd-list-meta {
		flex-shrink: 0;
		font-size: 0.6rem;
		color: var(--fg-muted);
	}
	.erd-empty {
		padding: 16px 10px;
		font-size: 0.72rem;
		color: var(--fg-muted);
		font-style: italic;
	}
	.erd-side-foot {
		padding: 8px 12px;
		border-top: 1px solid var(--border);
		font-family: var(--mono);
		font-size: 0.6rem;
		color: var(--fg-muted);
		line-height: 1.9;
	}
	.erd-side-foot .k {
		display: inline-block;
		padding: 0 4px;
		margin-right: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--bg);
		color: var(--fg-dim);
	}
</style>
