<script lang="ts">
	import ThemePicker from '$lib/theme/ThemePicker.svelte';
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
</script>

<svelte:head>
	<title>Theme — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="ThemePicker">
		<h3 class="component-name">ThemePicker</h3>
		<p class="component-desc">Theme selection control backed by the <code class="demo-code">theme</code> store. Place once in the app shell (typically the sidebar footer). Persists the choice to <code class="demo-code">localStorage</code>; the app shell applies <code class="demo-code">theme.resolved</code> to <code class="demo-code">&lt;html&gt;</code>. Use <code class="demo-code">Token swatches</code> below to verify all four themes render correctly.</p>
		<div class="demo-row">
			<span class="demo-label">trigger</span>
			<div class="demo-items">
				<ThemePicker />
			</div>
		</div>
	</ShowcaseBlock>

	<ShowcaseBlock>
		<h3 class="component-name">Token swatches</h3>
		<p class="component-desc">Design token reference — verify all four themes render correctly by switching with the <code class="demo-code">ThemePicker</code> above. Use these token names (e.g. <code class="demo-code">var(--accent)</code>, <code class="demo-code">var(--fg-dim)</code>) directly in component styles; never hardcode hex values.</p>
		<div class="token-grid">
			{#each [['--bg', 'bg'], ['--bg-elev', 'bg-elev'], ['--fg', 'fg'], ['--fg-muted', 'fg-muted'], ['--fg-dim', 'fg-dim'], ['--accent', 'accent'], ['--accent-faint', 'accent-faint'], ['--accent-faint-strong', 'accent-faint-strong'], ['--border', 'border'], ['--border-strong', 'border-strong'], ['--surface-raised', 'surface-raised'], ['--method-get-fg', 'method-get'], ['--method-post-fg', 'method-post'], ['--method-delete-fg', 'method-delete'], ['--method-patch-fg', 'method-patch']] as [token, label]}
				<div class="token-swatch">
					<div
						class="swatch-color"
						style="background: var({token}); border: 1px solid var(--border-strong)"
					></div>
					<code class="swatch-label">{label}</code>
				</div>
			{/each}
		</div>
	</ShowcaseBlock>
</div>

<style>
	.demo-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		min-height: 2rem;
	}

	.demo-label {
		font-family: var(--mono);
		font-size: 0.68rem;
		color: var(--fg-dim);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		min-width: 88px;
		flex-shrink: 0;
	}

	.demo-items {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.token-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.token-swatch {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.swatch-color {
		height: 36px;
		border-radius: 4px;
	}

	.swatch-label {
		font-family: var(--mono);
		font-size: 0.65rem;
		color: var(--fg-dim);
		letter-spacing: 0.04em;
	}
</style>
