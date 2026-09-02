<script lang="ts">
	import type { Snippet } from 'svelte';

	const STEP_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
	const SCALE = 0.38;

	interface Props {
		step?: number;
		route?: string;
		badge?: string;
		badgeVariant?: 'default' | 'red';
		dashed?: boolean;
		href?: string;
		width?: number;
		height?: number;
		children: Snippet;
	}

	let {
		step,
		route,
		badge,
		badgeVariant = 'default',
		dashed = false,
		href,
		width = 260,
		height = 180,
		children
	}: Props = $props();

	const innerW = $derived(Math.round(width / SCALE));
	const innerH = $derived(Math.round(height / SCALE));
	const tag = $derived(href && !dashed ? 'a' : 'div');
</script>

<svelte:element
	this={tag}
	href={tag === 'a' ? href : undefined}
	class="frame"
	class:frame--dashed={dashed}
	class:frame--clickable={!!href && !dashed}
>
	{#if step !== undefined}
		<span class="step-num">{STEP_NUMS[step - 1] ?? step}</span>
	{/if}
	{#if badge}
		<span class="state-badge" class:state-badge--red={badgeVariant === 'red'}>{badge}</span>
	{/if}
	<div class="clip" style="width:{width}px;height:{height}px">
		{#if dashed}
			{@render children()}
		{:else}
			<div
				class="inner"
				style="width:{innerW}px;height:{innerH}px;transform:scale({SCALE});transform-origin:top left"
			>
				{@render children()}
			</div>
		{/if}
	</div>
	{#if route}
		<span class="panel-label">{route}</span>
	{/if}
</svelte:element>

<style>
	.frame {
		position: relative;
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		text-decoration: none;
		flex-shrink: 0;
	}

	.clip {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-elev);
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
		overflow: hidden;
		cursor: default;
		transition: border-color 150ms, box-shadow 150ms;
		position: relative;
	}

	.frame--clickable .clip {
		cursor: pointer;
	}

	.frame--clickable:hover .clip {
		border-color: var(--accent);
		box-shadow: 0 2px 12px rgba(94, 234, 212, 0.12);
	}

	.frame--dashed .clip {
		border: 1.5px dashed var(--border);
		background: transparent;
		box-shadow: none;
	}

	.inner {
		position: absolute;
		top: 0;
		left: 0;
	}

	.step-num {
		position: absolute;
		top: -10px;
		left: -2px;
		z-index: 10;
		font-size: 1rem;
		line-height: 1;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
	}

	.state-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 10;
		font-family: var(--mono);
		font-size: 0.52rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--accent);
		background: var(--accent-faint);
		border: 1px solid rgba(94, 234, 212, 0.3);
		border-radius: 3px;
		padding: 1px 5px;
		pointer-events: none;
	}

	.state-badge--red {
		color: var(--palette-red);
		background: rgba(248, 113, 113, 0.08);
		border-color: rgba(248, 113, 113, 0.3);
	}

	.panel-label {
		display: block;
		margin-top: 6px;
		font-family: var(--mono);
		font-size: 0.62rem;
		color: var(--fg-dim);
		letter-spacing: 0.04em;
	}
</style>
