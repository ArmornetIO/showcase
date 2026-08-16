<script module lang="ts">
	/**
	 * Build a windowed list of page tokens: numbers plus 'gap' sentinels.
	 * e.g. total 10, current 6 → [1, 'gap', 5, 6, 7, 'gap', 10]
	 */
	export function pageWindow(current: number, total: number, span = 1): (number | 'gap')[] {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		const out: (number | 'gap')[] = [];
		const lo = Math.max(2, current - span);
		const hi = Math.min(total - 1, current + span);
		out.push(1);
		if (lo > 2) out.push('gap');
		for (let p = lo; p <= hi; p++) out.push(p);
		if (hi < total - 1) out.push('gap');
		out.push(total);
		return out;
	}
</script>

<script lang="ts">
	import Icon from '../../icons/Icon.svelte';

	interface TablePagerProps {
		/** Bindable 1-based current page. */
		page?: number;
		pageSize: number;
		total: number;
		/** Noun for the range label, e.g. "vendor". */
		noun?: string;
		onchange?: (page: number) => void;
	}

	let { page = $bindable(1), pageSize, total, noun, onchange }: TablePagerProps = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const clamped = $derived(Math.min(Math.max(1, page), totalPages));
	const start = $derived(total === 0 ? 0 : (clamped - 1) * pageSize + 1);
	const end = $derived(Math.min(clamped * pageSize, total));
	const tokens = $derived(pageWindow(clamped, totalPages));

	function go(p: number) {
		const next = Math.min(Math.max(1, p), totalPages);
		if (next === page) return;
		page = next;
		onchange?.(next);
	}
</script>

<div class="pgr">
	<span class="pgr-range">
		Showing <strong>{start}–{end}</strong> of {total}{noun ? ` ${total === 1 ? noun : `${noun}s`}` : ''}
	</span>

	{#if totalPages > 1}
		<div class="pgr-nav">
			<button
				class="pg"
				disabled={clamped === 1}
				onclick={() => go(clamped - 1)}
				aria-label="Previous page"
			>
				<Icon name="chevron-left" size={15} />
			</button>
			{#each tokens as t, i}
				{#if t === 'gap'}
					<span class="pg-gap" aria-hidden="true">…</span>
				{:else}
					<button
						class="pg pg-num"
						class:pg-active={clamped === t}
						aria-current={clamped === t ? 'page' : undefined}
						onclick={() => go(t)}>{t}</button
					>
				{/if}
			{/each}
			<button
				class="pg"
				disabled={clamped === totalPages}
				onclick={() => go(clamped + 1)}
				aria-label="Next page"
			>
				<Icon name="chevron-right" size={15} />
			</button>
		</div>
	{/if}
</div>

<style>
	.pgr {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 1rem;
	}
	.pgr-range {
		font-size: 0.76rem;
		color: var(--fg-muted);
	}
	.pgr-range strong {
		color: var(--fg);
		font-family: var(--mono);
	}
	.pgr-nav {
		display: flex;
		align-items: center;
		gap: 3px;
	}
	.pg {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 0.4rem;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: var(--fg-muted);
		font-family: var(--mono);
		font-size: 0.76rem;
		cursor: pointer;
	}
	.pg:hover:not(:disabled) {
		color: var(--fg);
		background: var(--surface-raised);
	}
	.pg:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.pg-active {
		background: var(--accent);
		color: var(--bg);
		font-weight: 700;
	}
	.pg-active:hover {
		color: var(--bg);
	}
	.pg-gap {
		padding: 0 2px;
		color: var(--fg-dim);
		font-family: var(--mono);
		font-size: 0.76rem;
		user-select: none;
	}
</style>
