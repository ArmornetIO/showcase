<script lang="ts">
	interface SearchInputProps {
		value?: string;
		placeholder?: string;
		variant?: 'default' | 'command-trigger';
		oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
		onclick?: () => void;
	}

	let {
		value = $bindable(''),
		placeholder = 'Search…',
		variant = 'default',
		oninput,
		onclick
	}: SearchInputProps = $props();
</script>

{#if variant === 'command-trigger'}
	<button class="cmdk-launch" {onclick} type="button">
		<svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.25" />
			<line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
		</svg>
		{placeholder || 'Search commands…'}
		<kbd>⌘K</kbd>
	</button>
{:else}
	<div class="search-wrap">
		<svg
			class="search-icon"
			width="14"
			height="14"
			viewBox="0 0 14 14"
			fill="none"
			aria-hidden="true"
		>
			<circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.25" />
			<line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
		</svg>
		<input
			type="search"
			bind:value
			{placeholder}
			{oninput}
			class="search-input"
		/>
	</div>
{/if}

<style>
	.search-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		width: 100%;
	}

	.search-icon {
		position: absolute;
		left: 9px;
		color: var(--fg-dim);
		pointer-events: none;
		flex-shrink: 0;
	}

	.search-input {
		width: 100%;
		font-family: var(--mono);
		font-size: 0.75rem;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid var(--border);
		border-radius: var(--radius-inset);
		color: var(--fg);
		padding: 0.375rem 0.625rem 0.375rem 30px;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.search-input:focus {
		border-color: var(--accent);
	}

	.search-input::placeholder {
		color: var(--fg-dim);
	}

	.search-input::-webkit-search-cancel-button {
		appearance: none;
	}

	.cmdk-launch {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 9px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		background: var(--surface-raised);
		color: var(--fg-muted);
		font-family: var(--sans-brand);
		font-size: 14px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.cmdk-launch:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.cmdk-launch kbd {
		font-family: var(--mono);
		font-size: 11px;
		background: var(--bg-elev);
		border: 1px solid var(--border);
		border-radius: var(--radius-control);
		padding: 2px 7px;
		color: var(--fg-dim);
	}
</style>
