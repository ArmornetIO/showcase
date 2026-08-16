<script lang="ts">
	interface Props {
		label?: string;
		tall?: boolean;
	}

	let { label, tall = false }: Props = $props();
</script>

{#if label}
	<div class="arrow-group" class:arrow-group--tall={tall}>
		<span class="arrow">→</span>
		<span class="arrow-label">
			{#each label.split('\n') as line, i}
				{#if i > 0}<br />{/if}{line}
			{/each}
		</span>
	</div>
{:else}
	<span class="arrow arrow--plain" class:arrow--tall={tall}>→</span>
{/if}

<style>
	.arrow {
		font-size: 1.5rem;
		color: var(--fg-dim);
		flex-shrink: 0;
		align-self: center;
		padding: 0 2px;
		margin-top: -18px;
	}

	.arrow--plain {
		display: flex;
		align-items: center;
	}

	.arrow--tall {
		align-self: flex-start;
		margin-top: calc(90px - 18px);
	}

	.arrow-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		gap: 3px;
		margin-top: -18px;
		padding: 0 2px;
	}

	.arrow-group--tall {
		align-self: flex-start;
		margin-top: calc(90px - 18px);
	}

	.arrow-label {
		font-size: 0.6rem;
		font-style: italic;
		color: var(--fg-dim);
		text-align: center;
		line-height: 1.3;
		white-space: nowrap;
	}
</style>
