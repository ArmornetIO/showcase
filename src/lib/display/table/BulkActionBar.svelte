<script module lang="ts">
	import type { IconName } from '../../icons/Icon.svelte';

	export interface BulkAction {
		label: string;
		icon?: IconName;
		onclick: () => void;
		/** Renders destructive (red) — only honoured inside the More menu. */
		danger?: boolean;
	}
</script>

<script lang="ts">
	import Icon from '../../icons/Icon.svelte';

	interface BulkActionBarProps {
		count: number;
		/** Light, low-consequence actions shown inline. */
		actions?: BulkAction[];
		/** Heavy / destructive actions tucked behind a "More" overflow menu. */
		moreActions?: BulkAction[];
		moreLabel?: string;
		ondeselect?: () => void;
	}

	let {
		count,
		actions = [],
		moreActions = [],
		moreLabel = 'More',
		ondeselect
	}: BulkActionBarProps = $props();

	let menuOpen = $state(false);
	let moreEl = $state<HTMLDivElement | null>(null);

	function runMore(a: BulkAction) {
		menuOpen = false;
		a.onclick();
	}

	$effect(() => {
		if (!menuOpen) return;
		function onDocClick(e: MouseEvent) {
			if (moreEl && !moreEl.contains(e.target as Node)) menuOpen = false;
		}
		document.addEventListener('click', onDocClick, true);
		return () => document.removeEventListener('click', onDocClick, true);
	});
</script>

{#if count > 0}
	<div class="bam">
		<span class="bam-count"><strong>{count}</strong> selected</span>

		<div class="bam-actions">
			{#each actions as a (a.label)}
				<button class="bam-act" onclick={a.onclick}>
					{#if a.icon}<Icon name={a.icon} size={13} />{/if}
					{a.label}
				</button>
			{/each}

			{#if moreActions.length > 0}
				<div class="bam-more" bind:this={moreEl}>
					<button
						class="bam-act bam-act-ghost"
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						onclick={() => (menuOpen = !menuOpen)}
					>
						{moreLabel} <Icon name="chevron-down" size={12} />
					</button>
					{#if menuOpen}
						<div class="bam-menu" role="menu">
							{#each moreActions as a (a.label)}
								<button
									class="bam-menu-item"
									class:bam-menu-item-danger={a.danger}
									role="menuitem"
									onclick={() => runMore(a)}
								>
									{#if a.icon}<Icon name={a.icon} size={13} />{/if}
									{a.label}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		{#if ondeselect}
			<button class="bam-deselect" onclick={ondeselect}>Deselect</button>
		{/if}
	</div>
{/if}

<style>
	.bam {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.55rem 1rem;
		background: var(--accent-faint);
	}
	.bam-count {
		font-size: 0.78rem;
		color: var(--fg);
	}
	.bam-count strong {
		color: var(--accent);
		font-family: var(--mono);
	}
	.bam-actions {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.bam-act {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		height: 28px;
		padding: 0 0.65rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--fg-muted);
		font-size: 0.74rem;
		font-weight: 500;
		cursor: pointer;
	}
	.bam-act:hover {
		color: var(--fg);
		border-color: var(--fg-dim);
	}
	.bam-act-ghost {
		border-color: transparent;
		background: transparent;
	}
	.bam-act-ghost:hover {
		background: var(--bg);
		border-color: var(--border);
	}
	.bam-more {
		position: relative;
	}
	.bam-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 10;
		min-width: 168px;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5);
	}
	.bam-menu-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.4rem 0.55rem;
		border: none;
		border-radius: 5px;
		background: transparent;
		color: var(--fg-muted);
		font-size: 0.76rem;
		text-align: left;
		cursor: pointer;
	}
	.bam-menu-item:hover {
		background: var(--surface-raised);
		color: var(--fg);
	}
	.bam-menu-item-danger {
		color: var(--palette-red);
	}
	.bam-menu-item-danger:hover {
		background: rgba(252, 165, 165, 0.1);
		color: var(--palette-red);
	}
	.bam-deselect {
		margin-left: auto;
		border: none;
		background: transparent;
		color: var(--accent);
		font-size: 0.76rem;
		font-weight: 600;
		cursor: pointer;
	}
	.bam-deselect:hover {
		text-decoration: underline;
	}
</style>
